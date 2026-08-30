import {afterAll, describe, expect, test} from "bun:test"
import {mkdtemp, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {createTemplateJsxBunPlugin} from "@zavx0z/template/bun"
import {JsxCompilerSession} from "@zavx0z/template/compiler"

const fixture = join(import.meta.dir, "compiler-fixture/application.tsx")
const importedFixture = join(import.meta.dir, "compiler-fixture/imported-entry.tsx")
const customPropertyFixture = join(import.meta.dir, "compiler-fixture/custom-property.tsx")
const session = new JsxCompilerSession({
  cwd: import.meta.dir,
  sourceRoots: [join(import.meta.dir, "compiler-fixture")]
})

afterAll(() => session.close())

describe("Template-owned TSX compiler with @zavx0z/react", () => {
  test("lowers static, nested and keyed JSX through one persistent TS7 session", async () => {
    const code = await session.transformFile(fixture)
    const cached = await session.transformFile(fixture)

    expect(cached).toBe(code)
    expect(session.stats).toMatchObject({cacheHits: 1, cacheMisses: 1, snapshots: 1})
    expect(code).toContain("defineCompiledTemplate")
    expect(code).toContain("bindChild")
    expect(code).toContain("bindKeyed")
    expect(code).toContain("root.render(App,")
    expect(code).not.toContain('from "react"')
    expect(code).not.toContain('from "react-dom/client"')
    expect(code).not.toContain("return <")
    expect(code).not.toContain("<button")
  })

  test("builds and executes ordinary source without React, preserving DOM and backend identity", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "zavx0z-compiled-tsx-"))
    try {
      const result = await Bun.build({
        entrypoints: [fixture],
        outdir: outputDirectory,
        target: "bun",
        format: "esm",
        packages: "bundle",
        loader: {".wgsl": "text"},
        plugins: [createTemplateJsxBunPlugin({sourceRoots: [join(import.meta.dir, "compiler-fixture")]})],
      })
      expect(result.success).toBe(true)
      const output = result.outputs.find((artifact) => artifact.kind === "entry-point")
      if (!output) throw new Error("Compiler fixture emitted no entry point")
      const javascript = await Bun.file(output.path).text()
      expect(javascript).not.toContain("react-reconciler")
      const proof = Bun.spawn([
        process.execPath,
        join(import.meta.dir, "compiler-proof-runner.ts"),
        output.path,
      ], {
        cwd: join(import.meta.dir, "../../.."),
        stdout: "pipe",
        stderr: "pipe"
      })
      const [exitCode, stdout, stderr] = await Promise.all([
        proof.exited,
        new Response(proof.stdout).text(),
        new Response(proof.stderr).text(),
      ])
      expect(stderr).toBe("")
      expect(exitCode).toBe(0)
      expect(JSON.parse(stdout)).toEqual({
        initial: "Count: 2",
        updated: "Count: 4",
        retainedText: true,
        retainedRows: true,
      })
    } finally {
      await rm(outputDirectory, {recursive: true, force: true})
    }
  })

  test("builds the governed profile for a browser target without a React fallback", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "zavx0z-compiled-browser-"))
    try {
      const result = await Bun.build({
        entrypoints: [fixture],
        outdir: outputDirectory,
        target: "browser",
        format: "esm",
        packages: "bundle",
        plugins: [createTemplateJsxBunPlugin({sourceRoots: [join(import.meta.dir, "compiler-fixture")]})],
      })
      expect(result.success).toBe(true)
      const output = result.outputs.find((artifact) => artifact.kind === "entry-point")
      if (!output) throw new Error("Browser compiler fixture emitted no entry point")
      const javascript = await Bun.file(output.path).text()
      expect(javascript).not.toContain("react-reconciler")
      expect(javascript).not.toContain('from"react"')
    } finally {
      await rm(outputDirectory, {recursive: true, force: true})
    }
  })

  test("compiles relative imported components through the same governed graph", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "zavx0z-compiled-imported-"))
    try {
      const result = await Bun.build({
        entrypoints: [importedFixture],
        outdir: outputDirectory,
        target: "bun",
        format: "esm",
        packages: "bundle",
        plugins: [createTemplateJsxBunPlugin({sourceRoots: [join(import.meta.dir, "compiler-fixture")]})],
      })
      expect(result.success).toBe(true)
      const output = result.outputs.find((artifact) => artifact.kind === "entry-point")
      if (!output) throw new Error("Imported compiler fixture emitted no entry point")
      const application = await import(`${pathToFileURL(output.path).href}?imported=${Date.now()}`) as Readonly<{
        host: import("@zavx0z/dom").HTMLElement
        root: {unmount(): void}
      }>
      const button = application.host.querySelector("button") as import("@zavx0z/dom").HTMLButtonElement
      const text = button.firstChild
      button.click()
      expect(button.firstChild).toBe(text)
      expect(button.textContent).toBe("Imported: 1")
      application.root.unmount()
    } finally {
      await rm(outputDirectory, {recursive: true, force: true})
    }
  })

  test("runs instance custom properties through one shared compiled pseudo sheet", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "zavx0z-compiled-custom-property-"))
    try {
      const result = await Bun.build({
        entrypoints: [customPropertyFixture],
        outdir: outputDirectory,
        target: "bun",
        format: "esm",
        packages: "bundle",
        plugins: [createTemplateJsxBunPlugin({sourceRoots: [join(import.meta.dir, "compiler-fixture")]})],
      })
      expect(result.success).toBe(true)
      const output = result.outputs.find((artifact) => artifact.kind === "entry-point")
      if (!output) throw new Error("Custom-property compiler fixture emitted no entry point")
      const javascript = await Bun.file(output.path).text()
      expect(javascript).toContain("var(--hover-color)")
      expect(javascript).toContain('"--hover-color: "')
      expect(javascript).not.toMatch(/--z-[a-z0-9-]+/)
      const application = await import(`${pathToFileURL(output.path).href}?custom=${Date.now()}`) as Readonly<{
        backgrounds(): readonly string[]
        dispose(): void
        hover(index: number | null): void
        hoverStyleSheetCount(): number
        renderColors(first: string, second: string): void
        styleSheetCount(): number
      }>

      expect(application.styleSheetCount()).toBe(2)
      expect(application.hoverStyleSheetCount()).toBe(1)
      expect(application.backgrounds()).toEqual(["#000000", "#000000"])
      application.hover(0)
      expect(application.backgrounds()).toEqual(["#112233", "#000000"])
      application.renderColors("#778899", "#445566")
      expect(application.backgrounds()).toEqual(["#778899", "#000000"])
      application.hover(1)
      expect(application.backgrounds()).toEqual(["#000000", "#445566"])
      application.dispose()
    } finally {
      await rm(outputDirectory, {recursive: true, force: true})
    }
  })

})
