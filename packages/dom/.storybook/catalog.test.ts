import {describe, expect, test} from "bun:test"
import {existsSync, readFileSync} from "node:fs"
import {join, resolve} from "node:path"
import {createDocument} from "@zavx0z/dom"
import {runtime} from "./runtime.ts"
import {story_hierarchy_default} from "./stories/subjects/dom-interfaces-node.ts"

const packageRoot = resolve(import.meta.dir, "..")
const projectRoot = resolve(packageRoot, "../..")

describe("@zavx0z/dom external catalog", () => {
  test("preserves all 91 ordered DOM and Elements leaves through static exports", () => {
    const catalog = json(join(import.meta.dir, "catalog.json")) as Catalog
    const variants = catalog.categories.flatMap((category) =>
      category.subjects.flatMap((subject) => subject.variants))
    const baseline = json(join(projectRoot, ".storybook", "route-baseline.json")) as Baseline
    expect(variants.map(({route}) => route)).toEqual(baseline.leafRoutes)
    expect(variants).toHaveLength(91)
    for (const variant of variants) {
      const path = resolve(import.meta.dir, variant.module.path)
      expect(existsSync(path), variant.route).toBeTrue()
      expect(readFileSync(path, "utf8"), variant.route)
        .toContain(`export const ${variant.module.export} = defineOwnerStory(`)
    }
  })

  test("preserves category and subject overviews without restoring a section panel", () => {
    const catalog = json(join(import.meta.dir, "catalog.json")) as Catalog
    const baseline = json(join(projectRoot, ".storybook", "route-baseline.json")) as Baseline
    const overviewRoutes = new Set(baseline.overviewRoutes)
    for (const category of catalog.categories) {
      expect(overviewRoutes.has(category.route), category.route).toBeTrue()
      for (const subject of category.subjects) {
        expect(overviewRoutes.has(subject.route), subject.route).toBeTrue()
        for (const variant of subject.variants) {
          expect(variant.group).not.toBeNull()
          expect(subject.route).not.toBe(variant.group!.id)
        }
      }
    }
    expect(baseline.documentedPackageRoot.reason).toContain("independently openable package tab")
  })

  test("mounts exact-realm DOM stories through storybook-runtime/1", async () => {
    expect(runtime.protocol).toBe("storybook-runtime/1")
    const document = createDocument()
    let source: unknown = null
    const session = runtime.create({
      document,
      signal: new AbortController().signal,
      mount: (node) => document.appendChild(node),
      publishInspector() {},
      publishProps() {},
      publishSource: (value) => { source = value },
      reportDiagnostic() {},
    })
    await session.mount({
      route: story_hierarchy_default.route,
      story: story_hierarchy_default,
      signal: new AbortController().signal,
    })
    expect(document.childNodes).toHaveLength(1)
    expect(source).not.toBeNull()
    session.unmount()
    expect(document.childNodes).toHaveLength(0)
    session.dispose()
    session.dispose()
  })

  test("keeps production exports and external catalog free of Storybook dependencies", async () => {
    const productionManifest = readFileSync(join(packageRoot, "package.json"), "utf8")
    expect(productionManifest).not.toContain("storybook")
    const glob = new Bun.Glob("**/*.{ts,tsx,js,jsx,mjs,cjs}")
    for await (const path of glob.scan({cwd: import.meta.dir, onlyFiles: true})) {
      const source = readFileSync(join(import.meta.dir, path), "utf8")
      expect(source, path).not.toMatch(/(?:from\s*|import\s*\()(["'])@zavx0z\/storybook\//u)
    }
  })
})

type Catalog = Readonly<{
  categories: readonly Readonly<{
    route: string
    subjects: readonly Readonly<{
      route: string
      variants: readonly Readonly<{
        route: string
        group: Readonly<{id: string; label: string}> | null
        module: Readonly<{path: string; export: string}>
      }>[]
    }>[]
  }>[]
}>

type Baseline = Readonly<{
  leafRoutes: readonly string[]
  overviewRoutes: readonly string[]
  documentedPackageRoot: Readonly<{reason: string}>
}>

function json(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"))
}
