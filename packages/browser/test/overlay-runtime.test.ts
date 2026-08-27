import {describe, expect, test} from "bun:test"
import {
  Vector3,
  type TrueTypeFont,
  type ViewPoint,
} from "@engine/core"
import {createDocument} from "@zavx0z/dom"
import type {PointerInput} from "@zavx0z/renderer"
import {createDocumentOverlayRuntime} from "../src/index.ts"

describe("createDocumentOverlayRuntime", () => {
  test("composes stable DOM, CPU, backend and camera-locked overlay owners", () => {
    const document = createDocument()
    const root = document.createElement("button")
    root.append("Return")
    root.setAttribute("style", "width: 80px; height: 32px; background: #112233")
    document.appendChild(root)
    let frameRequests = 0
    let presentations = 0
    const runtime = createDocumentOverlayRuntime({
      document,
      root,
      styleSheets: ["button { color: #ffffff; }"],
      font: fakeFont(),
      viewport: {width: 320, height: 180},
      distance: 400,
      invalidateGeometry() {},
      requestFrame() { frameRequests += 1 },
      requestPresentation() { presentations += 1 },
    })

    expect(runtime.overlay.content).toBe(runtime.backend.root)
    expect(runtime.overlay.renderLayer).toBe("ui")
    expect(runtime.overlay.distance).toBe(400)
    expect(runtime.frame.viewport).toEqual({width: 320, height: 180})
    expect(runtime.frame.displayList.length).toBeGreaterThan(0)
    expect(presentations).toBe(1)

    runtime.updateForViewPoint(fakeViewPoint())
    expect(runtime.overlay.content.visible).toBeTrue()
    expect(runtime.overlay.content.scale.x).toBeGreaterThan(0)

    let clicks = 0
    root.addEventListener("click", () => { clicks += 1 })
    expect(runtime.pointerDown(pointer({clientX: 10, clientY: 10, buttons: 1}))).toBe(root)
    expect(runtime.pointerUp(pointer({clientX: 10, clientY: 10}))).toBe(root)
    expect(clicks).toBe(1)
    expect(frameRequests).toBe(2)

    const overlay = runtime.overlay
    const backend = runtime.backend
    const interaction = runtime.interaction
    const firstRenderer = runtime.renderer
    runtime.resize({width: 640, height: 360})
    expect(runtime.overlay).toBe(overlay)
    expect(runtime.backend).toBe(backend)
    expect(runtime.interaction).toBe(interaction)
    expect(runtime.renderer).not.toBe(firstRenderer)
    expect(runtime.viewport).toEqual({width: 640, height: 360})

    runtime.dispose()
    expect(runtime.disposed).toBeTrue()
    expect(() => runtime.flush()).toThrow("disposed")
  })

  test("fails closed for foreign roots and invalid overlay geometry", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const foreign = createDocument().createElement("div")
    document.appendChild(root)
    const options = {
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
      viewport: {width: 100, height: 50},
      invalidateGeometry() {},
      requestFrame() {},
      requestPresentation() {},
    }

    expect(() => createDocumentOverlayRuntime({...options, root: foreign}))
      .toThrow("another Document")
    expect(() => createDocumentOverlayRuntime({...options, distance: 0}))
      .toThrow("distance")
    expect(() => createDocumentOverlayRuntime({...options, viewport: {width: -1, height: 50}}))
      .toThrow("viewport")
  })

  test("contains no canvas, Engine host, Layout or product fallback", async () => {
    const source = await Bun.file(new URL("../src/overlay-runtime.ts", import.meta.url)).text()

    expect(source).toContain("RendererWebGpuScreenOverlay")
    expect(source).toContain("createDocumentRenderer")
    expect(source).toContain("createDocumentInteractionController")
    for (const forbidden of [
      "HTMLCanvasElement",
      "new EngineRenderer",
      "new Space",
      "new ViewPoint",
      "requestAnimationFrame",
      "ResizeObserver",
      "@layout/core",
      "UiSurface",
      "Cosmos",
    ]) expect(source).not.toContain(forbidden)
  })
})

function pointer(values: Partial<PointerInput> = {}): PointerInput {
  return Object.freeze({
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 0,
    pressure: 0,
    isPrimary: true,
    timeStamp: 10,
    ...values,
  })
}

function fakeViewPoint(): ViewPoint {
  return {
    position: new Vector3(0, 0, 0),
    getTarget: () => new Vector3(0, 1, 0),
    getUp: () => new Vector3(0, 0, 1),
    fov: Math.PI / 2,
    aspect: 16 / 9,
  } as unknown as ViewPoint
}

function fakeFont(): TrueTypeFont {
  return {
    unitsPerEm: 1_000,
    mapCharToGlyph: () => 0,
    getGlyphOutline: () => ({
      points: new Float32Array(),
      onCurve: new Uint8Array(),
      contours: new Uint16Array(),
    }),
    getHMetric: () => ({advanceWidth: 500, lsb: 0}),
  } as unknown as TrueTypeFont
}
