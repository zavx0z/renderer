import {describe, expect, test} from "bun:test"
import {mkdtemp, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {
  createWebRealmBunPlugin,
  transformWebRealmSource,
} from "../src/bun.ts"

describe("web-realm source binding", () => {
  test("injects only referenced standard names as lexical module bindings", () => {
    const result = transformWebRealmSource(`
      const button = document.createElement("button")
      button.addEventListener("click", event => event instanceof Event)
      export const isElement = button instanceof HTMLElement
    `, {
      bindingModule: "/application/realm-binding.ts",
    })

    expect(result.bindings).toEqual(["document", "Event", "HTMLElement"])
    expect(result.code).toContain(
      'import {webRealm as __zavx0zWebRealm} from "/application/realm-binding.ts";',
    )
    expect(result.code).toContain(
      "const {document,Event,HTMLElement} = __zavx0zWebRealm.bindings;",
    )
    expect(result.code).not.toContain("globalThis.document =")
  })

  test("is idempotent, preserves a shebang and leaves explicit host modules alone", () => {
    const shebang = transformWebRealmSource("#!/usr/bin/env bun\nconsole.log(document)", {
      bindingModule: "#realm",
    })
    expect(shebang.code.startsWith("#!/usr/bin/env bun\n/* @zavx0z/web-realm bound */"))
      .toBe(true)
    expect(transformWebRealmSource(shebang.code, {bindingModule: "#realm"}).code)
      .toBe(shebang.code)
    const host = "// @zavx0z/web-realm no-transform\nexport const document = nativeDocument"
    expect(transformWebRealmSource(host, {bindingModule: "#realm"}).code).toBe(host)
    expect(() => transformWebRealmSource("document", {bindingModule: "./realm.ts"}))
      .toThrow("absolute")
  })

  test("preserves JavaScript and TSX directive prologues", () => {
    const result = transformWebRealmSource(
      '/* component */\n"use client";\nconst node = document.createElement("div")',
      {bindingModule: "#realm"},
    )
    expect(result.code.indexOf('"use client"')).toBeLessThan(
      result.code.indexOf("@zavx0z/web-realm bound"),
    )
    expect(result.code.indexOf("@zavx0z/web-realm bound")).toBeLessThan(
      result.code.indexOf("const node"),
    )
  })

  test("fails react-dom imports closed unless the bounded client adapter is explicit", async () => {
    const fixtureRoot = join(import.meta.dir, "fixture")
    const entry = join(fixtureRoot, "react-client-entry.ts")
    const binding = join(fixtureRoot, "realm-binding.ts")
    const denied = await Bun.build({
      entrypoints: [entry],
      target: "bun",
      packages: "bundle",
      throw: false,
      plugins: [createWebRealmBunPlugin({
        bindingModule: binding,
        sourceRoots: [fixtureRoot],
      })],
    })
    expect(denied.success).toBe(false)
    expect(denied.logs.map(log => log.message).join("\n")).toContain("not a global call")

    const outputDirectory = await mkdtemp(join(tmpdir(), "zavx0z-react-adapter-"))
    try {
      const accepted = await Bun.build({
        entrypoints: [entry],
        outdir: outputDirectory,
        target: "bun",
        packages: "bundle",
        throw: false,
        plugins: [createWebRealmBunPlugin({
          bindingModule: binding,
          sourceRoots: [fixtureRoot],
          reactDomClientAdapter: true,
        })],
      })
      expect(accepted.success).toBe(true)
      const output = accepted.outputs.find(artifact => artifact.kind === "entry-point")
      if (!output) throw new Error("Expected an adapter entry output")
      const adapter = await import(
        `${pathToFileURL(output.path).href}?adapter-proof=${Date.now()}`
      ) as {createRoot?: unknown}
      expect(typeof adapter.createRoot).toBe("function")
    } finally {
      await rm(outputDirectory, {recursive: true, force: true})
    }
  })

  test("rejects direct dynamic-code escapes in governed source", async () => {
    const fixtureRoot = join(import.meta.dir, "fixture")
    const result = await Bun.build({
      entrypoints: [join(fixtureRoot, "dynamic-code-entry.ts")],
      target: "bun",
      throw: false,
      plugins: [createWebRealmBunPlugin({
        bindingModule: join(fixtureRoot, "realm-binding.ts"),
        sourceRoots: [fixtureRoot],
      })],
    })
    expect(result.success).toBe(false)
    expect(result.logs.map(log => log.message).join("\n")).toContain("Direct eval")
  })

  test("fails direct re-exports closed under the Bun 1.4 load hook", async () => {
    const fixtureRoot = join(import.meta.dir, "fixture")
    const result = await Bun.build({
      entrypoints: [join(fixtureRoot, "direct-re-export-entry.ts")],
      target: "bun",
      throw: false,
      plugins: [createWebRealmBunPlugin({
        bindingModule: join(fixtureRoot, "realm-binding.ts"),
        sourceRoots: [fixtureRoot],
      })],
    })
    expect(result.success).toBe(false)
    expect(result.logs.map(log => log.message).join("\n")).toContain("import then export")
  })
})
