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
  ui: resolve(repozitariumRoot, "webxr-space/projects/ui"),
  node: resolve(repozitariumRoot, "webxr-space/projects/node"),
  metafor: resolve(repozitariumRoot, "metafor"),
  interpreter: resolve(repozitariumRoot, "interpreter"),
  demo: resolve(repozitariumRoot, "demo"),
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
