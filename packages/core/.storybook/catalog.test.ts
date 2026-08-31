import {describe, expect, test} from "bun:test"
import {existsSync, readFileSync} from "node:fs"
import {join, resolve} from "node:path"
import {createDocument} from "@zavx0z/dom"
import {
  defineRendererStory,
  runtime,
  type RendererStoryDescriptor,
} from "./runtime.ts"

const packageRoot = resolve(import.meta.dir, "..")
const projectRoot = resolve(packageRoot, "../..")

describe("@zavx0z/renderer external catalog", () => {
  test("declares exact data-only CSS Flex variants and custom Inspector widget", () => {
    const manifest = json(join(import.meta.dir, "manifest.json")) as PackageManifest
    const catalog = json(join(import.meta.dir, "catalog.json")) as Catalog
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      kind: "package",
      id: "@zavx0z/renderer",
      label: "Рендерер",
      runtime: {module: "./runtime.ts", export: "runtime"},
      widgetContributions: {
        protocol: "widget-contribution/1",
        items: [{
          id: "flex-controls",
          kind: "component",
          label: "Параметры Flex",
          module: {path: "./flex/controls.tsx", export: "FlexControlsWidget"},
        }],
      },
      catalog: "./catalog.json",
    })
    expect(catalog.categories).toEqual([{
      id: "css",
      label: "CSS",
      route: "css",
      subjects: [{
        id: "flex",
        kind: "capability",
        label: "Flex",
        apiName: "display: flex",
        route: "css/flex",
        presentation: {
          protocol: "story-presentation/1",
          projection: "display",
          widgets: ["flex-controls", "source", "diagnostics", "dom", "layout", "display"],
        },
        variants: [{
          id: "packing",
          label: "Упаковка",
          group: {id: "flow", label: "Поток"},
          route: "css/flex/packing",
          module: {path: "./flex/story.ts", export: "packing"},
        }, {
          id: "column",
          label: "Колонка",
          group: {id: "flow", label: "Поток"},
          route: "css/flex/column",
          module: {path: "./flex/story.ts", export: "column"},
        }, {
          id: "wrap-reverse",
          label: "Обратный перенос",
          group: {id: "flow", label: "Поток"},
          route: "css/flex/wrap-reverse",
          module: {path: "./flex/story.ts", export: "wrapReverse"},
        }, {
          id: "alignment",
          label: "Выравнивание",
          group: {id: "alignment", label: "Выравнивание"},
          route: "css/flex/alignment",
          module: {path: "./flex/story.ts", export: "alignment"},
        }, {
          id: "sizing",
          label: "Размеры",
          group: {id: "sizing", label: "Размеры"},
          route: "css/flex/sizing",
          module: {path: "./flex/story.ts", export: "sizing"},
        }, {
          id: "shrink",
          label: "Сжатие",
          group: {id: "sizing", label: "Размеры"},
          route: "css/flex/shrink",
          module: {path: "./flex/story.ts", export: "shrink"},
        }],
      }],
    }])
    expect(existsSync(resolve(import.meta.dir, manifest.widgetContributions.items[0]!.module.path)))
      .toBeTrue()
    for (const variant of catalog.categories[0]!.subjects[0]!.variants) {
      expect(existsSync(resolve(import.meta.dir, variant.module.path)), variant.route).toBeTrue()
    }
  })

  test("links the Renderer package from the project declaration", () => {
    const project = json(join(projectRoot, ".storybook/manifest.json")) as ProjectManifest
    expect(project).toMatchObject({
      schemaVersion: 1,
      kind: "project",
      id: "renderer",
      label: "Рендерер",
    })
    expect(project.packages).toContainEqual({
      declaration: "../packages/core/.storybook/manifest.json",
    })
  })

  test("presents arbitrary owner values exactly once per generic runtime operation", async () => {
    expect(runtime.protocol).toBe("storybook-runtime/3")
    const document = createDocument()
    const values = Object.freeze({
      "fixture-controls": Object.freeze({protocol: "fixture-controls/1"}),
    })
    const presentations: unknown[] = []
    const diagnostics: unknown[] = []
    let creates = 0
    let disposes = 0
    const descriptor = defineRendererStory("fixture/interactive", (ownerDocument, signal) => {
      creates += 1
      expect(signal.aborted).toBeFalse()
      const element = ownerDocument.createElement("section")
      return Object.freeze({
        story: Object.freeze({
          element,
          componentRoot: Object.freeze({
            readStyleSheets: () => Object.freeze({revision: 0, styleSheets: Object.freeze([])}),
          }),
          source: Object.freeze({html: "<section></section>", typescript: "<Fixture />"}),
          values,
          dispose() { disposes += 1 },
        }),
      })
    })
    const contextAbort = new AbortController()
    const session = runtime.create({
      document,
      signal: contextAbort.signal,
      present(value) {
        presentations.push(value)
        document.appendChild(value.node)
      },
      reportDiagnostic(value) { diagnostics.push(value) },
    })
    const input = (story: RendererStoryDescriptor) => Object.freeze({
      route: story.route,
      story,
      signal: new AbortController().signal,
    })

    await session.mount(input(descriptor))
    expect(presentations).toHaveLength(1)
    expect((presentations[0] as {values: unknown}).values).toBe(values)
    expect(document.childNodes).toHaveLength(1)

    await session.update?.(input(descriptor))
    expect(presentations).toHaveLength(2)
    expect(creates).toBe(2)
    expect(disposes).toBe(1)
    expect(document.childNodes).toHaveLength(1)

    await session.unmount()
    expect(document.childNodes).toHaveLength(0)
    expect(disposes).toBe(2)
    await session.dispose()
    await session.dispose()
    expect(diagnostics).toEqual([])
  })

  test("fails stale lifecycle before owner creation or presentation", async () => {
    const document = createDocument()
    let creates = 0
    let presents = 0
    const descriptor = defineRendererStory("fixture/stale", () => {
      creates += 1
      throw new Error("must not create")
    })
    const session = runtime.create({
      document,
      signal: new AbortController().signal,
      present() { presents += 1 },
      reportDiagnostic() {},
    })
    const abort = new AbortController()
    abort.abort()
    await expect(session.mount({
      route: descriptor.route,
      story: descriptor,
      signal: abort.signal,
    })).rejects.toMatchObject({name: "AbortError"})
    expect(creates).toBe(0)
    expect(presents).toBe(0)
    await session.dispose()
  })

  test("detaches and disposes a story when presentation fails after attachment", async () => {
    const document = createDocument()
    const diagnostics: unknown[] = []
    let disposes = 0
    const descriptor = defineRendererStory("fixture/presentation-failure", ownerDocument => {
      const element = ownerDocument.createElement("section")
      return Object.freeze({
        story: Object.freeze({
          element,
          componentRoot: Object.freeze({
            readStyleSheets: () => Object.freeze({revision: 0, styleSheets: Object.freeze([])}),
          }),
          source: Object.freeze({html: "<section></section>", typescript: "<Fixture />"}),
          values: Object.freeze({}),
          dispose() { disposes += 1 },
        }),
      })
    })
    const session = runtime.create({
      document,
      signal: new AbortController().signal,
      present(value) {
        document.appendChild(value.node)
        throw new Error("presentation failed")
      },
      reportDiagnostic(value) { diagnostics.push(value) },
    })

    await expect(session.mount({
      route: descriptor.route,
      story: descriptor,
      signal: new AbortController().signal,
    })).rejects.toThrow("presentation failed")
    expect(document.childNodes).toHaveLength(0)
    expect(disposes).toBe(1)
    expect(diagnostics).toEqual([{phase: "runtime", message: "presentation failed"}])
    await session.dispose()
    expect(disposes).toBe(1)
  })

  test("keeps development declarations free of Storybook imports and imperative layout", async () => {
    const productionManifest = json(join(packageRoot, "package.json")) as Readonly<{
      dependencies?: Readonly<Record<string, string>>
      devDependencies?: Readonly<Record<string, string>>
      peerDependencies?: Readonly<Record<string, string>>
    }>
    const dependencies = {
      ...productionManifest.dependencies,
      ...productionManifest.devDependencies,
      ...productionManifest.peerDependencies,
    }
    expect(Object.keys(dependencies).some(name => name.includes("storybook"))).toBeFalse()

    const sources: Array<Readonly<{path: string; source: string}>> = []
    for await (const path of new Bun.Glob("**/*.{ts,tsx}").scan({
      cwd: import.meta.dir,
      onlyFiles: true,
    })) {
      if (/\.test\.[cm]?[jt]sx?$/u.test(path) || path === "test-preload.ts") continue
      sources.push(Object.freeze({path, source: readFileSync(join(import.meta.dir, path), "utf8")}))
    }
    for (const {path, source} of sources) {
      expect(source, path).not.toMatch(/(?:from\s*|import\s*\()(["'])@zavx0z\/storybook(?:\/|\1)/u)
    }
    for (const {path, source} of sources.filter(({path}) => path.endsWith(".tsx") ||
      path === "flex/story.ts")) {
      if (path.endsWith(".tsx")) expect(source, path).not.toContain("createElement(")
      expect(source, path).not.toContain("style={{")
      expect(source, path).not.toContain("style={[")
      expect(source, path).not.toContain("defineStyles")
      expect(source, path).not.toContain("getBoundingClientRect(")
      expect(source, path).not.toMatch(/position\s*:\s*absolute/u)
      expect(source, path).not.toMatch(/(?:offset|client)(?:Width|Height|Left|Top)/u)
    }
    const story = sources.find(({path}) => path === "flex/story.ts")?.source
    expect(story).toBeDefined()
    expect(story?.match(/document\.createElement\("div"\)/gu)).toHaveLength(1)
    expect(story?.match(/createElement\(/gu)).toHaveLength(1)
    expect(story).not.toContain("createDocumentFragment(")
  })
})

type PackageManifest = Readonly<{
  schemaVersion: 1
  kind: "package"
  id: "@zavx0z/renderer"
  runtime: Readonly<{module: string; export: string}>
  catalog: string
  widgetContributions: Readonly<{
    protocol: "widget-contribution/1"
    items: readonly Readonly<{
      id: string
      kind: "component"
      label: string
      module: Readonly<{path: string; export: string}>
    }>[]
  }>
}>

type ProjectManifest = Readonly<{
  schemaVersion: 1
  kind: "project"
  id: string
  packages: readonly Readonly<{declaration: string}>[]
}>

type Catalog = Readonly<{
  categories: readonly Readonly<{
    id: string
    label: string
    route: string
    group?: Readonly<{id: string; label: string}>
    subjects: readonly Readonly<{
      id: string
      kind: string
      label: string
      apiName: string
      route: string
      presentation: Readonly<{
        protocol: "story-presentation/1"
        projection: "display"
        widgets: readonly string[]
      }>
      variants: readonly Readonly<{
        id: string
        label: string
        group?: Readonly<{id: string; label: string}>
        route: string
        module: Readonly<{path: string; export: string}>
      }>[]
    }>[]
  }>[]
}>

function json(path: string): any {
  return JSON.parse(readFileSync(path, "utf8"))
}
