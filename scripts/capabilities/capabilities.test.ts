import { describe, expect, it } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  rendererRoot,
  sha256,
  workspaceRevision,
  workspaceRoots,
} from "./model.ts"

const generatedPatterns = [
  "specifications/**/*.json",
  "capabilities.index.json",
  "CAPABILITIES.md",
  "GAPS.md",
  "CONTRADICTIONS.md",
  "packages/react/compatibility.json",
  "packages/react/src/compatibility.ts",
]

type VersionInventory = Readonly<{
  entries: readonly Readonly<{spec: Readonly<{version: string}>}>[]
}>

describe("platform capability audit", () => {
  it("regenerates inventories, demand, aggregate and reports without changing bytes", async () => {
    const before = await generatedDigests()
    await run("scripts/capabilities/build-inventories.ts")
    await run("scripts/capabilities/generate-consumer-demand.ts")
    await run("scripts/capabilities/generate.ts")
    expect(await generatedDigests()).toEqual(before)
  }, 30_000)

  it("reports complete schema-validated coverage with no broken references", async () => {
    const report = JSON.parse(await readFile(resolve(rendererRoot, "specifications/validation.report.json"), "utf8"))
    expect(report).toMatchObject({
      missing: 0,
      duplicateCapabilityIds: 0,
      unknownSupportIds: 0,
      brokenEvidencePaths: 0,
      brokenOwnerPackageIds: 0,
      schemaErrors: 0,
    })
    expect(report.specEntries).toBeGreaterThan(8_000)
    expect(report.mappedEntries).toBe(report.specEntries)
    for (const statistics of Object.values(report.statistics) as Array<{ missing: number }>) expect(statistics.missing).toBe(0)
  })

  it("binds live Template contracts and exports to the exact current checkout", async () => {
    const revision = workspaceRevision("template")
    const [compilerInventory, exportInventory] = await Promise.all([
      readJson<VersionInventory>("specifications/tsx/compiler.json"),
      readJson<VersionInventory>("specifications/platform/template-exports.json"),
    ])
    const compilerVersions = new Set(compilerInventory.entries.map(
      entry => entry.spec.version,
    ))
    const exportVersions = new Set(exportInventory.entries.map(
      entry => entry.spec.version,
    ))
    expect(compilerVersions).toEqual(new Set([`@zavx0z/template 2.6.2 at ${revision}`]))
    expect(exportVersions).toEqual(new Set([`2.6.2 at ${revision}`]))
  })

  it("keeps audit tooling out of production package imports and dependencies", async () => {
    const packageRoots = [
      resolve(rendererRoot, "packages/dom"),
      resolve(rendererRoot, "packages/core"),
      resolve(rendererRoot, "packages/browser"),
      resolve(rendererRoot, "packages/webgpu"),
      resolve(rendererRoot, "packages/react"),
      resolve(rendererRoot, "packages/devtools"),
      workspaceRoots.template,
      resolve(workspaceRoots.engine, "packages/core"),
    ]
    for (const root of packageRoots) {
      const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"))
      const runtimeDependencies = { ...manifest.dependencies, ...manifest.peerDependencies }
      expect(runtimeDependencies["@zavx0z/storybook"]).toBeUndefined()
      expect(runtimeDependencies["@ui/storybook"]).toBeUndefined()
      for await (const path of new Bun.Glob("src/**/*.{ts,tsx}").scan({ cwd: root, absolute: true })) {
        const source = await readFile(path, "utf8")
        expect(source).not.toContain("scripts/capabilities")
        expect(source).not.toContain("specifications/")
      }
    }
    const reactManifest = JSON.parse(await readFile(resolve(rendererRoot, "packages/react/package.json"), "utf8"))
    const reactDependencies = { ...reactManifest.dependencies, ...reactManifest.peerDependencies, ...reactManifest.devDependencies }
    expect(reactDependencies.react).toBeUndefined()
    expect(reactDependencies["react-dom"]).toBeUndefined()
    expect(reactDependencies["react-reconciler"]).toBeUndefined()
  })
})

async function run(path: string): Promise<void> {
  const process = Bun.spawn(["bun", path], { cwd: rendererRoot, stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])
  if (exitCode !== 0) throw new Error(`${path} failed (${exitCode})\n${stdout}\n${stderr}`)
}

async function readJson<Value>(path: string): Promise<Value> {
  return JSON.parse(await readFile(resolve(rendererRoot, path), "utf8")) as Value
}

async function generatedDigests(): Promise<Record<string, string>> {
  const paths = new Set<string>()
  for (const pattern of generatedPatterns) {
    for await (const path of new Bun.Glob(pattern).scan({ cwd: rendererRoot, absolute: false })) paths.add(path)
  }
  const entries = await Promise.all([...paths].sort().map(async (path) => [path, sha256(await readFile(resolve(rendererRoot, path)))] as const))
  return Object.fromEntries(entries)
}
