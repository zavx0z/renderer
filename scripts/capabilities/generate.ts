import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import {
  CAPABILITY_SCHEMA_VERSION,
  GENERATOR_VERSION,
  readJson,
  rendererRoot,
  sha256,
  stableStringify,
  workspaceRoots,
  writeJsonIfChanged,
  writeTextIfChanged,
} from "./model.ts"
import type {
  CapabilityRecord,
  CapabilityInventoryEntry,
  CapabilityStatus,
  ConsumerDemand,
  DomainStatistics,
  InventoryFile,
  SupportOverlay,
  SupportRecord,
} from "./model.ts"

interface InventoryManifest {
  schemaVersion: number
  generatorVersion: string
  files: Array<{ path: string; entries: number; digest: string }>
  totalEntries: number
}

interface SourceLock {
  generatorVersion: string
  updatedAt: string
  sources: Array<{
    id: string
    title: string
    type: string
    version: string
    canonicalUrl: string
    digest: { algorithm: string; value: string }
    retrieval: { method: string; artifacts: Array<{ path?: string; digest: { algorithm: string; value: string }; bytes: number }> }
  }>
}

interface DemandFile {
  schemaVersion: number
  generatorVersion: string
  records: ConsumerDemand[]
}

interface GapRecord {
  schemaVersion: number
  id: string
  capability: string
  reportedBy: { repository: string; package: string; subject: string; scenario: string }
  expected: { reference: string; behavior: string }
  actual: { behavior: string; evidence: unknown[] }
  minimalReproduction: { source: string; test: string }
  suspectedOwner: { repository: string; package: string; stage: string }
  severity: "P0" | "P1" | "P2" | "P3" | "P4"
  dependencies?: string[]
  forbiddenLocalWorkarounds?: string[]
}

interface AuditFindings {
  schemaVersion: number
  verificationDate: string
  gaps: GapRecord[]
  contradictions: Array<{
    id: string
    title: string
    claim: string
    fact: string
    owner: string
    evidence: string[]
    impact: string
  }>
  historicalClaims: Array<{
    id: string
    claim: string
    status: string
    evidence: string
    notes: string
  }>
  checks: Array<{
    target: string
    command: string
    status: string
    result: string
  }>
  benchmarks: Array<{
    repository: string
    command: string
    status: string
    result: string
  }>
}

interface AjvValidationFunction {
  (value: unknown): boolean
  errors?: unknown[] | null
}

interface AjvInstance {
  addFormat(name: string, format: RegExp): AjvInstance
  addSchema(schema: unknown): AjvInstance
  getSchema(id: string): AjvValidationFunction | undefined
  compile(schema: unknown): AjvValidationFunction
}

interface AjvConstructor {
  new (options: Record<string, unknown>): AjvInstance
}

const specificationsRoot = resolve(rendererRoot, "specifications")
const supportPaths = [
  resolve(rendererRoot, "packages/dom/support.json"),
  resolve(rendererRoot, "packages/core/support.json"),
  resolve(rendererRoot, "packages/browser/support.json"),
  resolve(rendererRoot, "packages/webgpu/support.json"),
  resolve(rendererRoot, "packages/react/support.json"),
  resolve(rendererRoot, "packages/devtools/support.json"),
  resolve(workspaceRoots.template, "support.json"),
  resolve(workspaceRoots.engine, "packages/core/support.json"),
]

const require = createRequire(import.meta.url)
const Ajv = require(resolve(specificationsRoot, "sources/tooling/ajv2020.cjs")) as AjvConstructor
const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false })
ajv.addFormat("date", /^\d{4}-\d{2}-\d{2}$/)

const capabilitySchema = await readJson<Record<string, unknown>>(resolve(specificationsRoot, "capability.schema.json"))
const supportSchema = await readJson<Record<string, unknown>>(resolve(specificationsRoot, "support.schema.json"))
const gapSchema = await readJson<Record<string, unknown>>(resolve(specificationsRoot, "gap.schema.json"))
ajv.addSchema(capabilitySchema).addSchema(supportSchema).addSchema(gapSchema)

const validateCapability = requiredValidator("https://zavx0z.dev/schemas/platform-capability-v1.json")
const validateSupport = requiredValidator("https://zavx0z.dev/schemas/platform-support-overlay-v1.json")
const validateGap = requiredValidator("https://zavx0z.dev/schemas/platform-capability-gap-v1.json")

const manifest = await readJson<InventoryManifest>(resolve(specificationsRoot, "inventory.manifest.json"))
const sourceLock = await readJson<SourceLock>(resolve(specificationsRoot, "sources.lock.json"))
const demandFile = await readJson<DemandFile>(resolve(specificationsRoot, "consumer-demand.json"))
const findings = await readJson<AuditFindings>(resolve(specificationsRoot, "audit-findings.json"))
const gapExample = await readJson<GapRecord>(resolve(specificationsRoot, "gap.example.json"))
assertSchema(validateGap, gapExample, "gap example")

validateSourceArtifacts(sourceLock)
const inventoryEntries = await loadInventories(manifest)
const overlays = await Promise.all(supportPaths.map((path) => readJson<SupportOverlay>(path)))
for (const overlay of overlays) assertSchema(validateSupport, overlay, `support overlay ${overlay.package}`)

const inventoryById = uniqueMap(inventoryEntries, (entry) => entry.id, "inventory capability")
const supportRecords = overlays.flatMap((overlay) => overlay.records.map((record) => ({ overlay, record })))
const supportById = uniqueMap(supportRecords, (item) => item.record.id, "support capability")

const missing = [...inventoryById.keys()].filter((id) => !supportById.has(id))
const unknown = [...supportById.keys()].filter((id) => !inventoryById.has(id))
if (missing.length) throw new Error(`Missing support rows (${missing.length}): ${missing.slice(0, 20).join(", ")}`)
if (unknown.length) throw new Error(`Unknown support rows (${unknown.length}): ${unknown.slice(0, 20).join(", ")}`)

const demandByCapability = new Map<string, ConsumerDemand[]>()
for (const demand of demandFile.records) {
  if (!inventoryById.has(demand.capability)) throw new Error(`Consumer demand references unknown capability: ${demand.capability}`)
  validateEvidencePaths(demand.evidence)
  const bucket = demandByCapability.get(demand.capability) ?? []
  bucket.push(demand)
  demandByCapability.set(demand.capability, bucket)
}

const records: CapabilityRecord[] = []
for (const [id, entry] of inventoryById) {
  const mapped = supportById.get(id)
  if (!mapped) throw new Error(`Missing support row after coverage check: ${id}`)
  if (mapped.overlay.package !== mapped.record.owner.package) throw new Error(`Overlay/package mismatch for ${id}`)
  if (entry.ownerHint.package !== mapped.record.owner.package) throw new Error(`Inventory/support owner mismatch for ${id}`)
  validateEvidencePaths(mapped.record.evidence)
  validateStatusEvidence(mapped.record)
  validateCssStages(entry.domain, mapped.record)
  const demands = demandByCapability.get(id) ?? []
  const consumerIds = demands.map(consumerId)
  const record: CapabilityRecord = {
    ...entry,
    ...mapped.record,
    consumers: [...new Set([...mapped.record.consumers, ...consumerIds])].sort(),
    metadata: {
      ...entry.metadata,
      ...(demands.length ? { consumerDemand: demands.map(({ evidence: _evidence, ...demand }) => demand) } : {}),
    },
  }
  assertSchema(validateCapability, record, `capability ${id}`)
  records.push(record)
}
records.sort((left, right) => left.id.localeCompare(right.id))

addParentSummaries(records)
for (const record of records) assertSchema(validateCapability, record, `summarized capability ${record.id}`)

for (const gap of findings.gaps) {
  assertSchema(validateGap, gap, `gap ${gap.id}`)
  if (!inventoryById.has(gap.capability)) throw new Error(`Gap references unknown capability: ${gap.id} -> ${gap.capability}`)
  validateEvidencePaths(gap.actual.evidence as Array<{ repository: string; path: string; lines?: string }>)
}
assertGapReferences(findings.gaps)

const statistics = calculateStatistics(records)
const repositorySnapshots = await snapshotRepositories()
const validation = {
  schemaVersion: CAPABILITY_SCHEMA_VERSION,
  generatorVersion: GENERATOR_VERSION,
  sourceArtifacts: sourceLock.sources.flatMap((source) => source.retrieval.artifacts).filter((artifact) => artifact.path).length,
  inventoryFiles: manifest.files.length,
  specEntries: records.length,
  mappedEntries: records.length,
  missing: 0,
  duplicateCapabilityIds: 0,
  unknownSupportIds: 0,
  brokenEvidencePaths: 0,
  brokenOwnerPackageIds: 0,
  schemaErrors: 0,
}

const index = {
  schemaVersion: CAPABILITY_SCHEMA_VERSION,
  generatorVersion: GENERATOR_VERSION,
  sourceLock: {
    path: "specifications/sources.lock.json",
    digest: sha256(stableStringify(sourceLock)),
    updatedAt: sourceLock.updatedAt,
  },
  repositories: repositorySnapshots,
  statistics,
  validation,
  records,
  consumerDemand: demandFile.records,
  gaps: findings.gaps,
}

await writeJsonIfChanged(resolve(rendererRoot, "capabilities.index.json"), index)
await writeJsonIfChanged(resolve(specificationsRoot, "validation.report.json"), { ...validation, statistics })
await writeTextIfChanged(resolve(rendererRoot, "CAPABILITIES.md"), renderCapabilities(records, statistics, sourceLock, overlays, repositorySnapshots))
await writeTextIfChanged(resolve(rendererRoot, "GAPS.md"), renderGaps(records, findings.gaps, demandByCapability))
await writeTextIfChanged(resolve(rendererRoot, "CONTRADICTIONS.md"), renderContradictions(findings))
await generateReactCompatibility(records, statistics.react)

function requiredValidator(id: string): AjvValidationFunction {
  const validator = ajv.getSchema(id)
  if (!validator) throw new Error(`JSON Schema was not registered: ${id}`)
  return validator
}

async function loadInventories(inventoryManifest: InventoryManifest): Promise<CapabilityInventoryEntry[]> {
  const loaded: CapabilityInventoryEntry[] = []
  for (const file of inventoryManifest.files) {
    const inventory = await readJson<InventoryFile>(resolve(specificationsRoot, file.path))
    if (inventory.entries.length !== file.entries) throw new Error(`Inventory count mismatch: ${file.path}`)
    if (sha256(stableStringify(inventory)) !== file.digest) throw new Error(`Inventory digest mismatch: ${file.path}`)
    loaded.push(...inventory.entries)
  }
  if (loaded.length !== inventoryManifest.totalEntries) throw new Error(`Inventory total mismatch: ${loaded.length} != ${inventoryManifest.totalEntries}`)
  return loaded
}

function validateSourceArtifacts(lock: SourceLock): void {
  for (const source of lock.sources) {
    for (const artifact of source.retrieval.artifacts) {
      if (!artifact.path) continue
      const path = resolve(specificationsRoot, "sources", artifact.path)
      if (!existsSync(path)) throw new Error(`Pinned source artifact is missing: ${source.id}:${artifact.path}`)
      const bytes = readFileSync(path)
      if (bytes.byteLength !== artifact.bytes) throw new Error(`Pinned source artifact size mismatch: ${source.id}:${artifact.path}`)
      const digest = createHash("sha256").update(bytes).digest("hex")
      if (digest !== artifact.digest.value) throw new Error(`Pinned source artifact digest mismatch: ${source.id}:${artifact.path}`)
    }
  }
}

function uniqueMap<T>(values: T[], keyOf: (value: T) => string, label: string): Map<string, T> {
  const map = new Map<string, T>()
  for (const value of values) {
    const key = keyOf(value)
    if (map.has(key)) throw new Error(`Duplicate ${label}: ${key}`)
    map.set(key, value)
  }
  return map
}

function assertSchema(validator: AjvValidationFunction, value: unknown, label: string): void {
  if (!validator(value)) throw new Error(`JSON Schema validation failed for ${label}: ${JSON.stringify(validator.errors, null, 2)}`)
}

function validateEvidencePaths(evidence: Array<{ repository: string; path: string; lines?: string }>): void {
  for (const item of evidence) {
    if (item.repository === "external") continue
    const root = workspaceRoots[item.repository as keyof typeof workspaceRoots]
    if (!root) throw new Error(`Unknown evidence repository: ${item.repository}`)
    const path = resolve(root, item.path)
    if (!existsSync(path)) throw new Error(`Broken evidence path: ${item.repository}:${item.path}`)
    if (item.lines) {
      const [, endText] = item.lines.split("-", 2)
      const end = Number(endText ?? item.lines)
      const lineCount = readFileSync(path, "utf8").split("\n").length
      if (!Number.isInteger(end) || end < 1 || end > lineCount) throw new Error(`Broken evidence line range: ${item.repository}:${item.path}:${item.lines} (file has ${lineCount})`)
    }
  }
}

function validateStatusEvidence(record: SupportRecord): void {
  const kinds = new Set(record.evidence.map((item) => item.type))
  if (record.status === "implemented") {
    if (!kinds.has("implementation")) throw new Error(`Implemented capability lacks implementation evidence: ${record.id}`)
    if (!["unit-test", "integration-test", "browser-e2e"].some((kind) => kinds.has(kind as never))) throw new Error(`Implemented capability lacks behavioral test: ${record.id}`)
  }
  if (record.status === "partial" && !kinds.has("implementation")) throw new Error(`Partial capability lacks implementation evidence: ${record.id}`)
  if (record.status === "unsupported" && record.evidence.length === 0) throw new Error(`Unsupported capability lacks reference evidence: ${record.id}`)
  if (record.status === "not-applicable" && !record.reason) throw new Error(`Not-applicable capability lacks a reason: ${record.id}`)
}

function validateCssStages(domain: string, record: SupportRecord): void {
  if (domain !== "css") return
  const required = ["parse", "cascade", "computed", "layout", "paint", "hit-test", "webgpu", "browser", "evidence"]
  for (const stage of required) {
    if (!record.stages?.[stage]) throw new Error(`CSS capability lacks ${stage} stage: ${record.id}`)
  }
}

function addParentSummaries(allRecords: CapabilityRecord[]): void {
  const children = new Map<string, CapabilityRecord[]>()
  for (const record of allRecords) {
    if (!record.parent) continue
    const bucket = children.get(record.parent) ?? []
    bucket.push(record)
    children.set(record.parent, bucket)
  }
  for (const record of allRecords) {
    const descendants = children.get(record.id)
    if (!descendants?.length) continue
    const counts = countStatuses(descendants)
    record.metadata = {
      ...record.metadata,
      childSummary: {
        total: descendants.length,
        ...counts,
        derivedStatus: deriveParentStatus(counts),
      },
    }
  }
}

function deriveParentStatus(counts: Record<CapabilityStatus, number>): CapabilityStatus {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  if (counts.implemented === total) return "implemented"
  if (counts.unsupported === total) return "unsupported"
  if (counts["not-applicable"] === total) return "not-applicable"
  if (counts.unverified === total) return "unverified"
  if (counts.implemented || counts.partial) return "partial"
  return counts.unverified ? "unverified" : "partial"
}

function calculateStatistics(allRecords: CapabilityRecord[]): Record<string, DomainStatistics> {
  const grouped = new Map<string, CapabilityRecord[]>()
  for (const record of allRecords) {
    const bucket = grouped.get(record.domain) ?? []
    bucket.push(record)
    grouped.set(record.domain, bucket)
  }
  return Object.fromEntries([...grouped].sort(([left], [right]) => left.localeCompare(right)).map(([domain, domainRecords]) => {
    const counts = countStatuses(domainRecords)
    return [domain, {
      specEntries: domainRecords.length,
      mappedEntries: domainRecords.length,
      ...counts,
      missing: 0,
    } satisfies DomainStatistics]
  }))
}

function countStatuses(values: Array<{ status: CapabilityStatus }>): Record<CapabilityStatus, number> {
  const counts: Record<CapabilityStatus, number> = { implemented: 0, partial: 0, unsupported: 0, "not-applicable": 0, unverified: 0 }
  for (const value of values) counts[value.status] += 1
  return counts
}

function assertGapReferences(gaps: GapRecord[]): void {
  const ids = new Set(gaps.map((gap) => gap.id))
  for (const gap of gaps) {
    for (const dependency of gap.dependencies ?? []) {
      if (dependency.startsWith("gap.") && !ids.has(dependency)) throw new Error(`Gap ${gap.id} references unknown gap dependency: ${dependency}`)
    }
  }
}

async function snapshotRepositories(): Promise<Array<{ id: string; revision: string; branch: string; dirty: boolean }>> {
  const snapshots = []
  for (const [id, root] of Object.entries(workspaceRoots)) {
    const [revision, branch, status] = await Promise.all([
      Bun.$`git -C ${root} rev-parse HEAD`.quiet().text(),
      Bun.$`git -C ${root} branch --show-current`.quiet().text(),
      Bun.$`git -C ${root} status --short`.quiet().text(),
    ])
    snapshots.push({ id, revision: revision.trim(), branch: branch.trim(), dirty: Boolean(status.trim()) })
  }
  return snapshots.sort((left, right) => left.id.localeCompare(right.id))
}

function consumerId(demand: ConsumerDemand): string {
  return `${demand.repository}:${demand.package}:${demand.subject}:${demand.path}:${demand.line}`
}

function renderCapabilities(
  allRecords: CapabilityRecord[],
  statistics: Record<string, DomainStatistics>,
  lock: SourceLock,
  overlays: SupportOverlay[],
  repositories: Array<{ id: string; revision: string; branch: string; dirty: boolean }>,
): string {
  const lines = [
    "# Platform capabilities",
    "",
    "> Generated by `scripts/capabilities/generate.ts`. Do not edit this file by hand.",
    "",
    "Canonical machine-readable truth: `capabilities.index.json`, pinned sources in `specifications/sources.lock.json`, and explicit owner overlays beside each owner package.",
    "",
    "The React 19.2 inventory is a reference profile, not a claim that `@zavx0z/react` is npm React. `reactPackageAlias`, `npmReactDependency`, `fiber`, `virtualDom`, and `reactDomHost` are all `false`.",
    "",
    "## Repository snapshot",
    "",
    "| Repository | Branch | Revision | Dirty at generation |",
    "|---|---|---|---:|",
    ...repositories.map((repository) => `| ${md(repository.id)} | ${md(repository.branch || "(detached)")} | \`${repository.revision}\` | ${repository.dirty ? "yes" : "no"} |`),
    "",
    "## Pinned external sources",
    "",
    "| ID | Type | Version | Digest | Canonical URL |",
    "|---|---|---|---|---|",
    ...lock.sources.map((source) => `| ${md(source.id)} | ${md(source.type)} | ${md(source.version)} | \`${source.digest.value.slice(0, 16)}…\` | ${md(source.canonicalUrl)} |`),
    "",
    "## Coverage",
    "",
    statisticsTable(statistics),
    "",
    "## Owner overlays",
    "",
    "| Package | Repository | Revision | Records |",
    "|---|---|---|---:|",
    ...overlays.sort((left, right) => left.package.localeCompare(right.package)).map((overlay) => `| ${md(overlay.package)} | ${md(overlay.repository)} | \`${overlay.revision}\` | ${overlay.records.length} |`),
    "",
    "## Complete matrix",
    "",
  ]

  const grouped = groupBy(allRecords, (record) => record.domain)
  for (const [domain, domainRecords] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`### ${domain}`, "", "| Capability | Kind | Status | Conformance | Owner/stage | Stages | Limitation/reason | Evidence | Consumers |", "|---|---|---|---|---|---|---|---:|---:|")
    for (const record of domainRecords) {
      lines.push(`| \`${md(record.id)}\` | ${md(record.kind)} | ${record.status} | ${record.conformance} | ${md(`${record.owner.package}/${record.owner.stage}`)} | ${md(record.reason ?? (record.limitations.join("; ") || "—"))} | ${record.evidence.length} | ${record.consumers.length} |`)
    }
    lines.push("")
  }
  return `${lines.join("\n").trimEnd()}\n`
}

function renderGaps(
  allRecords: CapabilityRecord[],
  gaps: GapRecord[],
  demandByCapability: Map<string, ConsumerDemand[]>,
): string {
  const severityRank = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 } as const
  const explicitByCapability = new Map<string, GapRecord[]>()
  for (const gap of gaps) {
    const bucket = explicitByCapability.get(gap.capability) ?? []
    bucket.push(gap)
    explicitByCapability.set(gap.capability, bucket)
  }
  const lines = [
    "# Platform gaps",
    "",
    "> Generated from `capabilities.index.json`, `specifications/audit-findings.json`, and `specifications/consumer-demand.json`. Do not edit by hand.",
    "",
    "## Explicit P0-P4 gaps",
    "",
  ]

  for (const gap of [...gaps].sort((left, right) => severityRank[left.severity] - severityRank[right.severity] || left.id.localeCompare(right.id))) {
    lines.push(
      `### ${gap.severity} — ${gap.id}`,
      "",
      `- Capability: \`${gap.capability}\``,
      `- Reported by: ${gap.reportedBy.repository}/${gap.reportedBy.package}/${gap.reportedBy.subject} — ${gap.reportedBy.scenario}`,
      `- Expected: ${gap.expected.behavior}`,
      `- Actual: ${gap.actual.behavior}`,
      `- Owner: ${gap.suspectedOwner.repository}/${gap.suspectedOwner.package}/${gap.suspectedOwner.stage}`,
      `- Minimal source: ${gap.minimalReproduction.source}`,
      `- Recommended conformance test: ${gap.minimalReproduction.test}`,
      `- Dependencies: ${(gap.dependencies ?? []).map((value) => `\`${value}\``).join(", ") || "none"}`,
      `- Forbidden local workarounds: ${(gap.forbiddenLocalWorkarounds ?? []).join("; ") || "none"}`,
      "",
    )
  }

  lines.push("## Complete prioritized non-implemented inventory", "", "| Priority | Capability | Status | Owner | Consumer demand | Limitation |", "|---|---|---|---|---:|---|")
  for (const record of allRecords.filter((record) => ["partial", "unsupported", "unverified"].includes(record.status))) {
    const explicit = explicitByCapability.get(record.id) ?? []
    const demands = demandByCapability.get(record.id) ?? []
    const priority = explicit.length
      ? [...explicit].sort((left, right) => severityRank[left.severity] - severityRank[right.severity])[0]!.severity
      : demands.some((demand) => demand.scope === "production")
        ? record.status === "unsupported" ? "P1" : "P2"
        : record.spec.profile === "standard" || record.spec.profile === "reference" ? "P3" : "P4"
    lines.push(`| ${priority} | \`${md(record.id)}\` | ${record.status} | ${md(`${record.owner.package}/${record.owner.stage}`)} | ${demands.length} | ${md(record.limitations[0] ?? "Evidence is insufficient.")} |`)
  }
  lines.push("")
  return `${lines.join("\n").trimEnd()}\n`
}

function renderContradictions(findings: AuditFindings): string {
  const lines = [
    "# Platform contradictions",
    "",
    "> Generated from `specifications/audit-findings.json`. Do not edit by hand.",
    "",
  ]
  for (const contradiction of findings.contradictions) {
    lines.push(
      `## ${contradiction.id} — ${contradiction.title}`,
      "",
      `- Claim: ${contradiction.claim}`,
      `- Current fact: ${contradiction.fact}`,
      `- Owner: ${contradiction.owner}`,
      `- Impact: ${contradiction.impact}`,
      `- Evidence: ${contradiction.evidence.map((value) => `\`${value}\``).join(", ")}`,
      "",
    )
  }
  lines.push("## Historical claim reproduction", "", "| Claim | Status | Current evidence | Boundary |", "|---|---|---|---|")
  for (const claim of findings.historicalClaims) lines.push(`| ${md(claim.claim)} | ${md(claim.status)} | ${md(claim.evidence)} | ${md(claim.notes)} |`)
  lines.push("", "## Check audit", "", "| Target | Command | Status | Result |", "|---|---|---|---|")
  for (const check of findings.checks) lines.push(`| ${md(check.target)} | \`${md(check.command)}\` | ${md(check.status)} | ${md(check.result)} |`)
  lines.push("", "## Benchmark audit", "", "| Repository | Command | Status | Result |", "|---|---|---|---|")
  for (const benchmark of findings.benchmarks) lines.push(`| ${md(benchmark.repository)} | \`${md(benchmark.command)}\` | ${md(benchmark.status)} | ${md(benchmark.result)} |`)
  lines.push("")
  return `${lines.join("\n").trimEnd()}\n`
}

async function generateReactCompatibility(
  allRecords: CapabilityRecord[],
  reactStatistics: DomainStatistics | undefined,
): Promise<void> {
  if (!reactStatistics) throw new Error("React statistics are missing")
  const byId = new Map(allRecords.map((record) => [record.id, record]))
  const hooks = Object.fromEntries(allRecords
    .filter((record) => record.id.startsWith("react.hooks.react."))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((record) => [record.name, binaryCompatibility(record.status)]))
  const featureIds: Record<string, string> = {
    createRoot: "react.semantics.create-root",
    functionComponents: "react.semantics.function-components",
    nestedComponents: "react.semantics.nested-components",
    memo: "react.semantics.memo",
    keyedCollections: "react.semantics.keys",
    conditionalRanges: "react.semantics.conditional-ranges",
    customHooks: "react.semantics.custom-hooks",
    contextConsumer: "react.semantics.context-consumer",
    jsxContextProvider: "react.semantics.jsx-context-provider",
    lowLevelContextProviders: "react.semantics.low-level-context-providers",
    debugValueInspection: "react.semantics.debug-value-inspection",
    effectEventCallsiteValidation: "react.semantics.effect-event-callsite-validation",
    governedReactImports: "react.semantics.governed-react-imports",
    templateCompilerAbi: "react.semantics.template-compiler-abi",
    templateCompilerIntegration: "react.semantics.template-compiler-integration",
    compilerExport: "react.semantics.compiler-export",
    tsxAuthoring: "react.semantics.tsx-authoring",
    browserTargetBuild: "react.semantics.browser-target-build",
    browserExecution: "react.semantics.browser-execution",
    gpuInstancing: "react.semantics.gpu-instancing",
    passivePaintScheduling: "react.semantics.passive-paint-scheduling",
    serverExternalStoreSnapshots: "react.semantics.server-external-store-snapshots",
    sourceMaps: "react.semantics.source-maps",
    staticTemplateIdentity: "react.semantics.static-template-identity",
    strictModeEffectReplay: "react.semantics.strict-mode-effect-replay",
  }
  const features = Object.fromEntries(Object.entries(featureIds).map(([name, id]) => {
    const record = byId.get(id)
    if (!record) throw new Error(`React compatibility projection references missing capability: ${id}`)
    return [name, binaryCompatibility(record.status)]
  }))
  const reactCapabilities = allRecords
    .filter((record) => record.owner.package === "@zavx0z/react" && !record.id.startsWith("platform."))
    .sort((left, right) => left.id.localeCompare(right.id))
  const capabilities = Object.fromEntries(reactCapabilities.map((record) => [record.id, {
    status: record.status,
    conformance: record.conformance,
    limitation: record.limitations[0] ?? null,
  }]))
  const compatibility = {
    package: "@zavx0z/react",
    reference: "React 19.2 complete reference profile",
    compilerOwner: "@zavx0z/template",
    runtimeModel: "compiled-static-template",
    reactPackageAlias: false,
    npmReactDependency: false,
    fiber: false,
    virtualDom: false,
    reactDomHost: false,
    featureCount: reactCapabilities.length,
    statistics: reactStatistics,
    features,
    hooks,
    capabilities,
  }
  await writeJsonIfChanged(resolve(rendererRoot, "packages/react/compatibility.json"), compatibility)
  const ts = `export type CompatibilityStatus = "supported" | "unsupported"\n\nexport type CapabilityStatus = "implemented" | "partial" | "unsupported" | "not-applicable" | "unverified"\n\nconst compatibilityData = ${JSON.stringify(compatibility, null, 2)} as const\n\nexport const reactCompatibility = Object.freeze({\n  ...compatibilityData,\n  features: Object.freeze(compatibilityData.features),\n  hooks: Object.freeze(compatibilityData.hooks),\n  capabilities: Object.freeze(compatibilityData.capabilities),\n})\n\nexport type ReactCompatibilityManifest = typeof reactCompatibility\n`
  await writeTextIfChanged(resolve(rendererRoot, "packages/react/src/compatibility.ts"), ts)
}

function binaryCompatibility(status: CapabilityStatus): "supported" | "unsupported" {
  return status === "implemented" || status === "partial" ? "supported" : "unsupported"
}

function statisticsTable(statistics: Record<string, DomainStatistics>): string {
  return [
    "| Domain | Spec entries | Mapped | Implemented | Partial | Unsupported | Not applicable | Unverified | Missing |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...Object.entries(statistics).map(([domain, value]) => `| ${md(domain)} | ${value.specEntries} | ${value.mappedEntries} | ${value.implemented} | ${value.partial} | ${value.unsupported} | ${value["not-applicable"]} | ${value.unverified} | ${value.missing} |`),
  ].join("\n")
}

function formatStages(stages: Record<string, CapabilityStatus> | undefined): string {
  return stages ? Object.entries(stages).map(([stage, status]) => `${stage}:${status}`).join("; ") : "—"
}

function md(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ")
}

function groupBy<T>(values: T[], keyOf: (value: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const value of values) {
    const key = keyOf(value)
    const bucket = grouped.get(key) ?? []
    bucket.push(value)
    grouped.set(key, bucket)
  }
  return grouped
}
