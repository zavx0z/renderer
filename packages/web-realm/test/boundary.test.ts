import {describe, expect, test} from "bun:test"
import {join} from "node:path"

const packageRoot = join(import.meta.dir, "..")

describe("@zavx0z/web-realm package boundary", () => {
  test("keeps runtime, Bun binding and React adapter as explicit entrypoints", async () => {
    const manifest = await Bun.file(join(packageRoot, "package.json")).json() as {
      name: string
      exports: Record<string, string>
      peerDependencies: Record<string, string>
      peerDependenciesMeta: Record<string, {optional?: boolean}>
    }
    expect(manifest.name).toBe("@zavx0z/web-realm")
    expect(manifest.exports).toEqual({
      ".": "./src/index.ts",
      "./bun": "./src/bun.ts",
      "./globals": "./src/globals.d.ts",
      "./react-dom-client": "./src/react-dom-client.ts",
    })
    expect(manifest.peerDependencies).toEqual({
      "@zavx0z/dom": "^0.1.0",
      "@zavx0z/dom-react": "^0.1.0",
      "@zavx0z/renderer": "^0.1.0",
    })
    expect(manifest.peerDependenciesMeta).toEqual({
      "@zavx0z/dom-react": {optional: true},
    })
  })

  test("contains no browser Document replacement, WebGPU owner or global patch", async () => {
    const source = await Bun.file(join(packageRoot, "src", "realm.ts")).text()
    expect(source).not.toContain("renderer-webgpu")
    expect(source).not.toContain("@engine/core")
    expect(source).not.toContain("globalThis.document =")
    expect(source).not.toContain("Object.defineProperty(globalThis")
    expect(source).toContain("attachDocumentRenderReadAdapter")
    expect(source).toContain("getRendererComputedStyle")
  })
})
