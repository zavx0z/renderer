import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  CAPABILITY_SCHEMA_VERSION,
  GENERATOR_VERSION,
  readJson,
  rendererRoot,
  workspaceRoots,
  writeJsonIfChanged,
} from "./model.ts"
import type { ConsumerDemand, InventoryFile } from "./model.ts"

interface DemandSource {
  capability: string
  repository: keyof typeof workspaceRoots
  package: string
  subject: string
  scope: ConsumerDemand["scope"]
  path: string
  anchor: string
  behavior: string
}

interface DemandSourcesFile {
  schemaVersion: number
  entries: DemandSource[]
}

interface InventoryManifest {
  files: Array<{ path: string }>
}

const specificationsRoot = resolve(rendererRoot, "specifications")
const manifest = await readJson<InventoryManifest>(resolve(specificationsRoot, "inventory.manifest.json"))
const capabilityIds = new Set((
  await Promise.all(manifest.files.map(async (file) => (
    await readJson<InventoryFile>(resolve(specificationsRoot, file.path))
  ).entries))
).flat().map((entry) => entry.id))

const sources = await readJson<DemandSourcesFile>(resolve(specificationsRoot, "consumer-demand.sources.json"))
const revisionCache = new Map<string, string>()
const records: ConsumerDemand[] = []

for (const source of sources.entries) {
  if (!capabilityIds.has(source.capability)) throw new Error(`Unknown consumer-demand capability: ${source.capability}`)
  const root = workspaceRoots[source.repository]
  const absolutePath = resolve(root, source.path)
  const text = await readFile(absolutePath, "utf8")
  const index = text.indexOf(source.anchor)
  if (index < 0) throw new Error(`Consumer-demand anchor not found: ${source.repository}:${source.path} -> ${source.anchor}`)
  const line = text.slice(0, index).split("\n").length
  const revision = await repositoryRevision(source.repository, root)
  records.push({
    capability: source.capability,
    repository: source.repository,
    package: source.package,
    subject: source.subject,
    scope: source.scope,
    path: source.path,
    line,
    behavior: source.behavior,
    evidence: [{
      type: "consumer-usage",
      repository: source.repository,
      revision,
      path: source.path,
      symbol: source.subject,
      lines: String(line),
      proves: source.behavior,
      doesNotProve: "Platform implementation or conformance.",
    }],
  })
}

records.sort((left, right) => left.capability.localeCompare(right.capability) || left.repository.localeCompare(right.repository) || left.path.localeCompare(right.path) || left.line - right.line)

await writeJsonIfChanged(resolve(specificationsRoot, "consumer-demand.json"), {
  schemaVersion: CAPABILITY_SCHEMA_VERSION,
  generatorVersion: GENERATOR_VERSION,
  records,
})

async function repositoryRevision(repository: string, root: string): Promise<string> {
  const cached = revisionCache.get(repository)
  if (cached) return cached
  const result = await Bun.$`git -C ${root} rev-parse HEAD`.quiet().text()
  const status = await Bun.$`git -C ${root} status --short`.quiet().text()
  const revision = `${result.trim()}${status.trim() ? "+dirty" : ""}`
  revisionCache.set(repository, revision)
  return revision
}
