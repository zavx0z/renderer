import { createHash } from "node:crypto"
import { dirname, relative, resolve } from "node:path"

export const CAPABILITY_SCHEMA_VERSION = 1 as const
export const GENERATOR_VERSION = "1.0.0"

export const STATUSES = [
  "implemented",
  "partial",
  "unsupported",
  "not-applicable",
  "unverified",
] as const

export const CONFORMANCE = [
  "exact",
  "adapted",
  "extension",
  "none",
  "unknown",
] as const

export const EVIDENCE_KINDS = [
  "implementation",
  "unit-test",
  "integration-test",
  "browser-e2e",
  "visual-evidence",
  "benchmark",
  "requirement",
  "external-spec",
  "consumer-usage",
  "negative-test",
] as const

export type CapabilityStatus = (typeof STATUSES)[number]
export type CapabilityConformance = (typeof CONFORMANCE)[number]
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number]

export interface SourceReference {
  source: string
  version: string
  anchor: string
  profile?: "standard" | "reference" | "project-contract"
}

export interface CapabilityOwner {
  repository: string
  package: string
  stage: string
}

export interface EvidenceRecord {
  type: EvidenceKind
  repository: string
  revision: string
  path: string
  symbol?: string
  lines?: string
  proves: string
  doesNotProve: string
}

export interface CapabilityInventoryEntry {
  id: string
  domain: string
  kind: string
  name: string
  description?: string
  parent?: string
  spec: SourceReference
  ownerHint: CapabilityOwner
  metadata?: Record<string, unknown>
}

export interface InventoryFile {
  schemaVersion: typeof CAPABILITY_SCHEMA_VERSION
  generatorVersion: string
  source: string
  entries: CapabilityInventoryEntry[]
}

export interface SupportRecord {
  id: string
  status: CapabilityStatus
  conformance: CapabilityConformance
  owner: CapabilityOwner
  stages?: Record<string, CapabilityStatus>
  limitations: string[]
  reason?: string
  evidence: EvidenceRecord[]
  consumers: string[]
  blockedBy: string[]
  blocks: string[]
  lastVerified: {
    revision: string
    date: string
  }
}

export interface SupportOverlay {
  schemaVersion: typeof CAPABILITY_SCHEMA_VERSION
  generatorVersion: string
  repository: string
  package: string
  revision: string
  verificationDate: string
  records: SupportRecord[]
}

export interface CapabilityRecord extends CapabilityInventoryEntry, SupportRecord {}

export interface ConsumerDemand {
  capability: string
  repository: string
  package: string
  subject: string
  scope: "production" | "storybook" | "development"
  path: string
  line: number
  behavior: string
  evidence: EvidenceRecord[]
}

export const CAPABILITY_USAGE_SELECTOR_KINDS = [
  "capability",
  "html-element",
  "html-attribute",
  "event",
  "interface-member",
  "css-property",
  "css-selector",
  "named-capability",
  "project-element",
  "html-input-type",
  "css-attribute-selector",
] as const

export const CAPABILITY_USAGE_OPERATIONS = [
  "construct",
  "create",
  "read",
  "write",
  "call",
  "listen",
  "ref",
  "attribute",
  "style",
  "behavior",
] as const

export const CAPABILITY_POLICIES = ["report", "strict", "exact"] as const

export const CAPABILITY_REQUEST_KINDS = [
  "implementation",
  "verification",
  "conformance",
  "inventory",
  "resolution",
  "misuse",
] as const

export type CapabilityUsageOperation = (typeof CAPABILITY_USAGE_OPERATIONS)[number]
export type CapabilityPolicy = (typeof CAPABILITY_POLICIES)[number]
export type CapabilityRequestKind = (typeof CAPABILITY_REQUEST_KINDS)[number]

export interface CapabilityConsumerIdentity {
  repository: string
  package: string
  subject: string
  scope: ConsumerDemand["scope"]
  revision: string
}

export interface CapabilitySourcePosition {
  line: number
  column: number
}

export interface CapabilityUsageSource {
  path: string
  start: CapabilitySourcePosition
  end: CapabilitySourcePosition
  symbol?: string
}

export type CapabilityUsageValue =
  | Readonly<{kind: "dynamic"}>
  | Readonly<{kind: "static"; value: boolean | number | string}>

export type CapabilityUsageSelector =
  | Readonly<{ kind: "capability"; id: string }>
  | Readonly<{ kind: "html-element"; tag: string; interfaceMapping?: boolean }>
  | Readonly<{
      kind: "html-attribute"
      tag?: string
      name: string
      transport: "content-attribute" | "property"
      operation?: "binding" | "mount" | "style"
      value?: CapabilityUsageValue
    }>
  | Readonly<{ kind: "event"; name: string; target?: string; targetTag?: string; capture?: boolean }>
  | Readonly<{
      kind: "interface-member"
      interface: string
      member: string
      standardLibrary?: "lib.dom"
      memberKind?: "attribute" | "operation" | "constructor" | "const" | "inheritance"
      signature?: string
    }>
  | Readonly<{ kind: "css-property"; name: string; value?: CapabilityUsageValue }>
  | Readonly<{ kind: "css-selector"; name: string }>
  | Readonly<{ kind: "named-capability"; domain: string; capabilityKind: string; name: string }>
  | Readonly<{ kind: "project-element"; tag: string }>
  | Readonly<{ kind: "html-input-type"; value: string }>
  | Readonly<{ kind: "css-attribute-selector"; name: string; value: string | null }>

export interface CapabilityUsage {
  requiredBy: CapabilityConsumerIdentity
  source: CapabilityUsageSource
  operation: CapabilityUsageOperation
  selector: CapabilityUsageSelector
  behavior: string
}

export interface CapabilityUsageFile {
  schemaVersion: typeof CAPABILITY_SCHEMA_VERSION
  generatorVersion: string
  usages: CapabilityUsage[]
}

export interface CapabilityRequestMatrixSnapshot {
  digest: string
  status: CapabilityStatus | "missing" | "ambiguous"
  conformance: CapabilityConformance
  owner: CapabilityOwner | null
  stages: Record<string, CapabilityStatus> | null
  limitations: string[]
  reason: string | null
  blockedBy: string[]
  blocks: string[]
  lastVerified: SupportRecord["lastVerified"] | null
}

export interface CapabilityRequest {
  schemaVersion: typeof CAPABILITY_SCHEMA_VERSION
  id: string
  kind: CapabilityRequestKind
  capability: string | null
  candidateCapabilities?: string[]
  requiredBy: CapabilityConsumerIdentity
  usage: Omit<CapabilityUsage, "requiredBy">
  expected: {
    reference: string
    behavior: string
  }
  matrix: CapabilityRequestMatrixSnapshot
  disposition:
    | "needs-implementation"
    | "needs-verification"
    | "needs-conformance"
    | "needs-inventory"
    | "needs-resolution"
    | "consumer-misuse"
  runtimeGapProven: false
  evidence: EvidenceRecord[]
}

export interface CapabilityDiagnostic {
  code: string
  severity: "info" | "warning" | "error"
  blocking: boolean
  message: string
  requestId: string
  source: CapabilityUsageSource
}

export interface CapabilityRequestReport {
  schemaVersion: typeof CAPABILITY_SCHEMA_VERSION
  generatorVersion: string
  policy: CapabilityPolicy
  matrix: {
    path: string
    digest: string
  }
  source: {
    path: string
    digest: string
  }
  requests: CapabilityRequest[]
  diagnostics: CapabilityDiagnostic[]
  summary: {
    usages: number
    satisfied: number
    requests: number
    blocking: number
  }
}

export interface DomainStatistics {
  specEntries: number
  mappedEntries: number
  implemented: number
  partial: number
  unsupported: number
  "not-applicable": number
  unverified: number
  missing: number
}

export interface RepositorySnapshot {
  id: string
  root: string
  revision: string
  branch: string
  dirty: boolean
}

export interface WorkspaceRoots {
  renderer: string
  template: string
  engine: string
  storybook: string
  ui: string
  node: string
  metafor: string
  interpreter: string
  demo: string
}

export const rendererRoot = resolve(import.meta.dir, "../..")
export const repozitariumRoot = resolve(rendererRoot, "..")

export const workspaceRoots: WorkspaceRoots = {
  renderer: rendererRoot,
  template: resolve(repozitariumRoot, "template"),
  engine: resolve(repozitariumRoot, "webxr-space/projects/engine"),
  storybook: resolve(repozitariumRoot, "storybook"),
  ui: resolve(repozitariumRoot, "webxr-space/projects/ui"),
  node: resolve(repozitariumRoot, "webxr-space/projects/node"),
  metafor: resolve(repozitariumRoot, "metafor"),
  interpreter: resolve(repozitariumRoot, "interpreter"),
  demo: resolve(repozitariumRoot, "demo"),
}

/** Returns the exact checked-out revision label for a live workspace source. */
export function workspaceRevision(repository: keyof WorkspaceRoots): string {
  const root = workspaceRoots[repository]
  const head = gitText(root, ["rev-parse", "HEAD"])
  const status = gitText(root, ["status", "--short", "--untracked-files=all"])
  return `${head}${status === "" ? "" : "+dirty"}`
}

function gitText(root: string, arguments_: readonly string[]): string {
  const result = Bun.spawnSync({
    cmd: ["git", "-C", root, ...arguments_],
    stdout: "pipe",
    stderr: "pipe",
  })
  if (result.exitCode !== 0) {
    throw new Error(
      `git ${arguments_.join(" ")} failed in ${root}: ${new TextDecoder().decode(result.stderr).trim()}`,
    )
  }
  return new TextDecoder().decode(result.stdout).trim()
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value === null || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortValue(child)]),
  )
}

export async function writeTextIfChanged(path: string, text: string): Promise<boolean> {
  const file = Bun.file(path)
  const previous = await file.exists() ? await file.text() : undefined
  if (previous === text) return false

  await Bun.$`mkdir -p ${dirname(path)}`.quiet()
  await Bun.write(path, text)
  return true
}

export async function writeJsonIfChanged(path: string, value: unknown): Promise<boolean> {
  return writeTextIfChanged(path, stableStringify(value))
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await Bun.file(path).text()) as T
}

export function sha256(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex")
}

export function sourcePath(repository: keyof WorkspaceRoots, absolutePath: string): string {
  return relative(workspaceRoots[repository], absolutePath)
}

export function normalizeIdSegment(value: string): string {
  if (value === ".") return "root"
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/^-+/, (prefix) => prefix.replaceAll("-", "vendor-"))
    .replace(/\*/g, "wildcard")
    .replace(/%/g, "percent")
    .replace(/@/g, "at-")
    .replace(/::/g, "pseudo-element-")
    .replace(/:/g, "pseudo-class-")
    .replace(/\(\)/g, "-function")
    .replace(/[()\[\]{}<>|=+~^$!?,/'\"\\]+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")

  return normalized || `anonymous-${sha256(value).slice(0, 8)}`
}

export function uniqueId(base: string, identity: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base)
    return base
  }

  const candidate = `${base}--${sha256(identity).slice(0, 8)}`
  if (used.has(candidate)) throw new Error(`Duplicate capability identity: ${identity}`)
  used.add(candidate)
  return candidate
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`)
}
