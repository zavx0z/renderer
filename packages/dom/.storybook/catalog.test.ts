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
    expect(variants.map(({route}) => route)).toEqual([...baseline.leafRoutes])
    expect(variants).toHaveLength(91)
    for (const variant of variants) {
      const path = resolve(import.meta.dir, variant.module.path)
      expect(existsSync(path), variant.route).toBeTrue()
      expect(readFileSync(path, "utf8"), variant.route)
        .toContain(`export const ${variant.module.export} = defineOwnerStory(`)
      expect(Object.hasOwn(variant, "presentation"), variant.route).toBeFalse()
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
        expect(subject.presentation, subject.route).toEqual({
          protocol: "story-presentation/1",
          projection: "display",
          widgets: ["props", "source", "diagnostics"],
        })
        for (const variant of subject.variants) {
          expect(variant.group).not.toBeNull()
          expect(subject.route).not.toBe(variant.group!.id)
        }
      }
    }
    expect(baseline.documentedPackageRoot.reason).toContain("independently openable package tab")
  })

  test("atomically presents exact-realm compiled DOM stories through storybook-runtime/3", async () => {
    expect(runtime.protocol).toBe("storybook-runtime/3")
    const document = createDocument()
    type RuntimePresentation = Parameters<Parameters<typeof runtime.create>[0]["present"]>[0]
    let presentation: RuntimePresentation | null = null
    const session = runtime.create({
      document,
      signal: new AbortController().signal,
      present: (value) => {
        presentation = value
        document.appendChild(value.node)
      },
      reportDiagnostic() {},
    })
    await session.mount({
      route: story_hierarchy_default.route,
      story: story_hierarchy_default,
      signal: new AbortController().signal,
    })
    expect(document.childNodes).toHaveLength(1)
    expect(presentation).not.toBeNull()
    const committed = presentation as unknown as RuntimePresentation
    expect(committed.protocol).toBe("story-presentation/1")
    expect(committed.componentRoot.readStyleSheets()).toBeDefined()
    expect(Object.hasOwn(committed.source, "css")).toBeFalse()
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

  test("keeps governed story presentation free of CSS strings and visible imperative construction", async () => {
    const view = readFileSync(join(import.meta.dir, "stories/helpers/dom-stories-view.tsx"), "utf8")
    const runtimeSource = readFileSync(join(import.meta.dir, "runtime.ts"), "utf8")
    expect(view).not.toContain("createElement(")
    expect(view).not.toContain("className")
    expect(runtimeSource).toContain('protocol: "storybook-runtime/3"')
    expect(runtimeSource).not.toContain("publishSource")
    expect(runtimeSource).not.toContain("publishProps")
    expect(runtimeSource).not.toContain("styleSheets")
    const glob = new Bun.Glob("stories/subjects/*.ts")
    for await (const path of glob.scan({cwd: import.meta.dir, onlyFiles: true})) {
      const source = readFileSync(join(import.meta.dir, path), "utf8")
      expect(source, path).not.toMatch(/(?:StoryCss|source\.css|styleSheets)/u)
    }
  })
})

type Catalog = Readonly<{
  categories: readonly Readonly<{
    route: string
    subjects: readonly Readonly<{
      route: string
      presentation: Readonly<{
        protocol: "story-presentation/1"
        projection: "display"
        widgets: readonly ["props", "source", "diagnostics"]
      }>
      variants: readonly Readonly<{
        route: string
        group: Readonly<{id: string; label: string}> | null
        module: Readonly<{path: string; export: string}>
        presentation?: never
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
