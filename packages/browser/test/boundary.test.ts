import {describe, expect, test} from "bun:test"
import {join} from "node:path"

const packageRoot = join(import.meta.dir, "..")

describe("@zavx0z/renderer-browser boundary", () => {
  test("publishes one exact runtime entry and one peer identity per owner", async () => {
    const manifest = await Bun.file(join(packageRoot, "package.json")).json() as {
      name: string
      exports: Record<string, string>
      peerDependencies: Record<string, string>
      peerDependenciesMeta: Record<string, {optional?: boolean}>
    }
    expect(manifest.name).toBe("@zavx0z/renderer-browser")
    expect(manifest.exports).toEqual({".": "./src/index.ts"})
    expect(manifest.peerDependencies).toEqual({
      "@engine/core": "0.0.1",
      "@zavx0z/dom": "^0.1.0",
      "@zavx0z/renderer": "^0.1.0",
      "@zavx0z/renderer-webgpu": "^0.1.0",
    })
    expect(manifest.peerDependenciesMeta).toEqual({
      "@engine/core": {optional: true},
    })
  })

  test("contains no UI, Layout, Storybook, native DOM mirror or hidden font fetch", async () => {
    const source = await Bun.file(join(packageRoot, "src", "runtime.ts")).text()
    const planeSource = await Bun.file(join(packageRoot, "src", "plane-runtime.ts")).text()
    const overlaySource = await Bun.file(join(packageRoot, "src", "overlay-runtime.ts")).text()
    const spaceSource = await Bun.file(join(packageRoot, "src", "space-runtime.ts")).text()
    const inputHostSource = await Bun.file(join(packageRoot, "src", "native-input-host.ts")).text()
    const indexSource = await Bun.file(join(packageRoot, "src", "index.ts")).text()
    expect(source).toContain('from "@engine/core"')
    expect(source).toContain('from "@zavx0z/dom"')
    expect(source).toContain('from "@zavx0z/renderer"')
    expect(source).toContain('from "@zavx0z/renderer-webgpu"')
    expect(source).not.toMatch(/from\s+["']@layout\//u)
    expect(source).not.toMatch(/from\s+["']@ui\//u)
    expect(source).not.toMatch(/from\s+["'][^"']*storybook|@zavx0z\/storybook/iu)
    expect(source).not.toMatch(/fetch\s*\(|loadDocumentDefaultFont/u)
    expect(source).not.toContain("createElement(")
    expect(source).toContain("createDocumentNativeInputHost")
    expect(source).not.toMatch(/cloneNode\s*\(|importNode\s*\(|innerHTML|outerHTML/u)
    expect(source).not.toMatch(/appendChild\s*\(.*canvas|replaceChildren\s*\(/iu)
    expect(planeSource).toContain('from "@zavx0z/dom"')
    expect(planeSource).toContain('from "@zavx0z/renderer"')
    expect(planeSource).toContain('from "@zavx0z/renderer-webgpu"')
    expect(planeSource).toContain("RendererWebGpuDocumentPlane")
    expect(indexSource).toContain('export {createDocumentPlaneRuntime} from "./plane-runtime.ts"')
    expect(indexSource).toContain('export {createDocumentOverlayRuntime} from "./overlay-runtime.ts"')
    expect(indexSource).toContain('export {createDocumentSpaceRuntime} from "./space-runtime.ts"')
    for (const forbidden of [
      "HTMLCanvasElement",
      "RendererWebGpuScreenOverlay",
      "requestAnimationFrame",
      "ResizeObserver",
      "@layout/core",
      "UiSurface",
    ]) expect(planeSource).not.toContain(forbidden)
    expect(planeSource).not.toMatch(/new\s+(?:EngineRenderer|Space|ViewPoint)\b/u)
    expect(overlaySource).toContain("RendererWebGpuScreenOverlay")
    expect(overlaySource).toContain('from "@zavx0z/dom"')
    expect(overlaySource).not.toMatch(/new\s+(?:EngineRenderer|Space|ViewPoint)\b/u)
    expect(overlaySource).not.toMatch(/from\s+["']@layout\/|from\s+["']@ui\//u)
    expect(spaceSource).toContain('from "./plane-runtime.ts"')
    expect(spaceSource).toContain("createDocumentPlaneRuntime")
    expect(spaceSource).toContain("createDocumentNativeInputHost")
    expect(spaceSource).not.toMatch(/from\s+["']@layout\/|from\s+["']@ui\//u)
    expect(spaceSource).not.toMatch(/UiRuntime|UiSurface|RendererWebGpuBackend|createDocumentRenderer/u)
    expect(indexSource).toContain('export {createDocumentNativeInputHost} from "./native-input-host.ts"')
    expect(inputHostSource.match(/browserDocument\.createElement\("input"\)/gu)).toHaveLength(1)
    expect(inputHostSource.match(/browserDocument\.createElement\("textarea"\)/gu)).toHaveLength(1)
    expect(inputHostSource).toContain('configureProxy(input, "data-renderer-input-proxy")')
    expect(inputHostSource).toContain('configureProxy(textarea, "data-renderer-textarea-proxy")')
    expect(inputHostSource).not.toMatch(/cloneNode\s*\(|importNode\s*\(|innerHTML|outerHTML/u)
  })
})
