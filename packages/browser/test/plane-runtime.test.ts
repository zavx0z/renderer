import {describe, expect, test} from "bun:test"
import {
  Object3D,
  type TrueTypeFont,
} from "@engine/core"
import {
  acquireDocumentAuthorStyleSheetOwner,
  acquireDocumentCompiledStyleSheets,
  createDocument
} from "@zavx0z/dom"
import {
  createDocumentInteractionController,
  createDocumentRenderer,
  type DocumentInteractionController,
  type DocumentRenderer,
  type PointerInput,
  type RenderFrame,
  type WheelInput,
} from "@zavx0z/renderer"
import {
  RendererWebGpuDocumentPlane,
  type RendererWebGpuBackend,
  type RendererWebGpuBackendOptions,
} from "@zavx0z/renderer-webgpu"
import {createDocumentPlaneRuntime} from "../src/index.ts"
import {
  createDocumentPlaneRuntimeWithSeams,
  type DocumentPlaneRuntimeSeams,
} from "../src/plane-runtime.ts"

describe("createDocumentPlaneRuntime", () => {
  test("composes caller-owned DOM, CPU, backend and stable world-plane owners", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const label = document.createElement("span")
    label.append("World display")
    label.setAttribute("data-z-late", "")
    root.setAttribute("style", "width: 160px; height: 80px; background: #112233")
    document.appendChild(root)
    root.appendChild(label)
    let frameRequests = 0
    let presentations = 0
    let invalidations = 0
    const runtime = createDocumentPlaneRuntime({
      document,
      root,
      styleSheets: ["span { color: #ffffff; font-size: 12px; }"],
      font: fakeFont(),
      viewport: {width: 160, height: 80},
      worldUnitsPerPixel: 0.5,
      invalidateGeometry() { invalidations += 1 },
      requestFrame() { frameRequests += 1 },
      requestPresentation() { presentations += 1 },
    })

    expect(runtime.document).toBe(document)
    expect(runtime.root).toBe(root)
    expect(runtime.styleSheets).toEqual(["span { color: #ffffff; font-size: 12px; }"])
    expect(runtime.plane.content).toBe(runtime.backend.root)
    expect(runtime.plane.renderLayer).toBe("world")
    expect(runtime.frame.viewport).toEqual({width: 160, height: 80})
    expect(runtime.frame.displayList.length).toBeGreaterThan(0)
    expect(runtime.backend.root.children.length).toBe(runtime.frame.displayList.length)
    expect(presentations).toBe(1)
    expect(frameRequests).toBe(0)

    const authorStyleOwner = acquireDocumentAuthorStyleSheetOwner(document)
    authorStyleOwner.replace([{
      id: "plane-theme",
      cssText: "[data-z-late]{color:#778899}"
    }])
    expect(frameRequests).toBe(1)
    expect(runtime.flush().displayList.find(item =>
      item.kind === "text" && item.node.parentNode === label
    )).toMatchObject({kind: "text", color: "#778899"})

    const styleLease = acquireDocumentCompiledStyleSheets(document, [{
      id: "late-plane-style",
      cssText: "[data-z-late]{color:#abcdef}"
    }])
    expect(frameRequests).toBe(2)
    const styled = runtime.flush()
    const labelText = styled.displayList.find(item => item.kind === "text" && item.node.parentNode === label)
    expect(labelText).toMatchObject({kind: "text", color: "#abcdef"})

    const frames: RenderFrame[] = []
    runtime.subscribe((frame) => frames.push(frame))
    expect(frames).toEqual([runtime.frame])
    const initial = runtime.frame
    label.textContent = "Updated"
    expect(frameRequests).toBe(3)
    const updated = runtime.flush()
    expect(updated).not.toBe(initial)
    expect(frames.at(-1)).toBe(updated)
    expect(presentations).toBe(4)

    runtime.dispose()
    const requestsBeforeRelease = frameRequests
    styleLease.release()
    authorStyleOwner.release()
    expect(frameRequests).toBe(requestsBeforeRelease)
    expect(runtime.disposed).toBeTrue()
    expect(invalidations).toBeGreaterThan(0)
    expect(() => runtime.flush()).toThrow("disposed")
  })

  test("uses logical pointer and wheel inputs through the standard interaction owner", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    input.type = "checkbox"
    root.setAttribute("style", "width: 80px; height: 40px; overflow: auto")
    input.setAttribute("style", "width: 20px; height: 20px")
    document.appendChild(root)
    root.appendChild(input)
    let frameRequests = 0
    const events: string[] = []
    input.addEventListener("input", ({type}) => events.push(type))
    input.addEventListener("change", ({type}) => events.push(type))
    const runtime = createDocumentPlaneRuntime({
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
      viewport: {width: 80, height: 40},
      worldUnitsPerPixel: 1,
      invalidateGeometry() {},
      requestFrame() { frameRequests += 1 },
      requestPresentation() {},
    })

    const down = runtime.pointerDown(pointer({clientX: 5, clientY: 5, buttons: 1}))
    const up = runtime.pointerUp(pointer({clientX: 5, clientY: 5, buttons: 0}))
    expect(down).toBe(input)
    expect(up).toBe(input)
    expect(input.checked).toBeTrue()
    expect(events).toEqual(["input", "change"])
    expect(frameRequests).toBe(2)

    runtime.pointerMove(pointer({clientX: 6, clientY: 6}))
    runtime.pointerCancel(pointer({clientX: 6, clientY: 6}))
    expect(frameRequests).toBe(4)
    expect(runtime.wheel(wheel({clientX: 6, clientY: 6, deltaY: 4}))).toBe(input)
    expect(frameRequests).toBe(5)
    runtime.dispose()
  })

  test("resizes logical and physical density while preserving plane/backend/interaction identity", () => {
    const document = createDocument()
    const root = document.createElement("div")
    root.setAttribute("style", "width: 100%; height: 100%; background: #222222")
    document.appendChild(root)
    let presentations = 0
    const runtime = createDocumentPlaneRuntime({
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
      viewport: {width: 100, height: 50},
      worldUnitsPerPixel: 0.25,
      invalidateGeometry() {},
      requestFrame() {},
      requestPresentation() { presentations += 1 },
    })
    const plane = runtime.plane
    const backend = runtime.backend
    const interaction = runtime.interaction
    const firstRenderer = runtime.renderer
    const content = plane.content
    const planePosition = plane.position
    const planeQuaternion = plane.quaternion
    const planeScale = plane.scale

    runtime.resize({width: 200, height: 100}, 0.5)
    expect(runtime.plane).toBe(plane)
    expect(runtime.backend).toBe(backend)
    expect(runtime.interaction).toBe(interaction)
    expect(runtime.renderer).not.toBe(firstRenderer)
    expect(runtime.plane.content).toBe(content)
    expect(runtime.plane.position).toBe(planePosition)
    expect(runtime.plane.quaternion).toBe(planeQuaternion)
    expect(runtime.plane.scale).toBe(planeScale)
    expect(runtime.viewport).toEqual({width: 200, height: 100})
    expect(runtime.worldUnitsPerPixel).toBe(0.5)
    expect(runtime.frame.viewport).toEqual({width: 200, height: 100})

    const resizedRenderer = runtime.renderer
    runtime.resize({width: 200, height: 100}, 0.75)
    expect(runtime.renderer).toBe(resizedRenderer)
    expect(runtime.worldUnitsPerPixel).toBe(0.75)
    expect(presentations).toBe(3)

    const viewport = runtime.viewport
    expect(() => runtime.resize({width: -1, height: 100})).toThrow("viewport")
    expect(() => runtime.resize({width: 200, height: 100}, 0)).toThrow("worldUnitsPerPixel")
    expect(runtime.viewport).toBe(viewport)
    expect(runtime.renderer).toBe(resizedRenderer)
    runtime.dispose()
  })

  test("exposes exact seams, request channels, cleanup and late-callback inertness", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    const harness = createHarness(document, root)
    let frameRequests = 0
    let presentations = 0
    const runtime = createDocumentPlaneRuntimeWithSeams({
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
      viewport: {width: 100, height: 50},
      worldUnitsPerPixel: 1,
      invalidateGeometry() {},
      requestFrame() { frameRequests += 1 },
      requestPresentation() { presentations += 1 },
    }, harness.seams)

    expect(harness.calls.backends).toBe(1)
    expect(harness.calls.planes).toBe(1)
    expect(harness.calls.renderers).toBe(1)
    expect(harness.calls.interactions).toBe(1)
    expect(harness.calls.applied).toBe(1)
    expect(presentations).toBe(1)

    root.title = "Changed"
    expect(frameRequests).toBe(1)
    harness.emitTextureChange()
    expect(presentations).toBe(2)
    runtime.pointerMove(pointer({clientX: 3, clientY: 4}))
    runtime.pointerDown(pointer({clientX: 3, clientY: 4}))
    runtime.pointerUp(pointer({clientX: 3, clientY: 4}))
    runtime.pointerCancel(pointer({clientX: 3, clientY: 4}))
    runtime.wheel(wheel({clientX: 3, clientY: 4, deltaY: 2}))
    expect(frameRequests).toBe(6)
    expect(harness.calls.pointerMoves[0]).toMatchObject({clientX: 3, clientY: 4})
    expect(harness.calls.wheels[0]).toMatchObject({clientX: 3, clientY: 4, deltaY: 2})

    const firstRenderer = runtime.renderer
    runtime.resize({width: 200, height: 100})
    expect(runtime.renderer).not.toBe(firstRenderer)
    expect(harness.calls.rendererDisposals).toBe(1)
    expect(harness.calls.renderers).toBe(2)

    runtime.dispose()
    runtime.dispose()
    expect(harness.calls.rendererDisposals).toBe(2)
    expect(harness.calls.interactionDisposals).toBe(1)
    expect(harness.calls.backendDisposals).toBe(1)
    harness.emitTextureChange()
    expect(presentations).toBe(3)
    root.title = "Late"
    expect(frameRequests).toBe(6)
    expect(() => runtime.pointerMove(pointer())).toThrow("disposed")
  })

  test("fails before creating owners for invalid roots and callbacks", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const foreign = createDocument().createElement("div")
    document.appendChild(root)
    const harness = createHarness(document, root)
    const options = {
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
      viewport: {width: 100, height: 50},
      worldUnitsPerPixel: 1,
      invalidateGeometry() {},
      requestFrame() {},
      requestPresentation() {},
    }

    expect(() => createDocumentPlaneRuntimeWithSeams(
      {...options, root: foreign},
      harness.seams,
    )).toThrow("another Document")
    expect(() => createDocumentPlaneRuntimeWithSeams(
      {...options, requestFrame: null as never},
      harness.seams,
    )).toThrow("requestFrame")
    expect(() => createDocumentPlaneRuntimeWithSeams(
      {...options, viewport: {width: Number.MAX_VALUE, height: 50}, worldUnitsPerPixel: 2},
      harness.seams,
    )).toThrow("physical extents")
    expect(harness.calls.backends).toBe(0)
    expect(harness.calls.renderers).toBe(0)
  })

  test("contains no canvas, Engine lifecycle, Layout or ScreenOverlay fallback", async () => {
    const source = await Bun.file(new URL("../src/plane-runtime.ts", import.meta.url)).text()

    expect(source).toContain("RendererWebGpuDocumentPlane")
    expect(source).toContain("createDocumentRenderer")
    expect(source).toContain("createDocumentInteractionController")
    for (const forbidden of [
      "HTMLCanvasElement",
      "new EngineRenderer",
      "new Space",
      "new ViewPoint",
      "requestAnimationFrame",
      "ResizeObserver",
      "RendererWebGpuScreenOverlay",
      "@layout/core",
      "UiSurface",
    ]) expect(source).not.toContain(forbidden)
  })
})

function createHarness(
  document: ReturnType<typeof createDocument>,
  root: ReturnType<typeof document.createElement>,
) {
  const calls = {
    backends: 0,
    planes: 0,
    renderers: 0,
    interactions: 0,
    applied: 0,
    backendDisposals: 0,
    rendererDisposals: 0,
    interactionDisposals: 0,
    pointerMoves: [] as PointerInput[],
    wheels: [] as WheelInput[],
  }
  let backendOptions: RendererWebGpuBackendOptions | null = null
  let revision = 0
  const backend = {
    root: new Object3D(),
    applyFrame() { calls.applied += 1 },
    dispose() { calls.backendDisposals += 1 },
  } as unknown as RendererWebGpuBackend

  const createRenderer = (
    options: Parameters<DocumentPlaneRuntimeSeams["createDocumentRenderer"]>[0],
  ): DocumentRenderer => {
    calls.renderers += 1
    let disposed = false
    const flush = (): RenderFrame => {
      if (disposed) throw new Error("renderer disposed")
      revision += 1
      return frame(options.document, options.root, options.viewport, revision)
    }
    return {
      document: options.document,
      root: options.root,
      viewport: options.viewport,
      invalidate() {},
      render: flush,
      flush,
      dispose() {
        if (disposed) return
        disposed = true
        calls.rendererDisposals += 1
      },
    }
  }
  const interaction: DocumentInteractionController = {
    document,
    hoveredElement: null,
    pressedElement: null,
    tooltip: null,
    pointerMove(_frame, input) {
      calls.pointerMoves.push(input)
      return root
    },
    pointerDown: () => root,
    pointerUp: () => root,
    pointerCancel() {},
    wheel(_frame, input) {
      calls.wheels.push(input)
      return root
    },
    composeFrame: (value) => value,
    dispose() { calls.interactionDisposals += 1 },
  }
  const seams: DocumentPlaneRuntimeSeams = Object.freeze({
    createBackend(options) {
      calls.backends += 1
      backendOptions = options
      return backend
    },
    createPlane(options) {
      calls.planes += 1
      return new RendererWebGpuDocumentPlane(options)
    },
    createDocumentRenderer: createRenderer,
    createInteraction() {
      calls.interactions += 1
      return interaction
    },
    now: () => 100,
  })
  return {
    calls,
    seams,
    emitTextureChange() {
      if (backendOptions === null) throw new Error("backend not created")
      backendOptions.requestPresentation?.()
    },
  }
}

function frame(
  document: ReturnType<typeof createDocument>,
  root: Parameters<typeof createDocumentRenderer>[0]["root"],
  viewport: Readonly<{width: number; height: number}>,
  revision: number,
): RenderFrame {
  return Object.freeze({
    revision,
    document,
    root,
    viewport,
    boxes: Object.freeze([]),
    boxByNode: new Map(),
    displayList: Object.freeze([]),
    hits: new Map(),
    scrolls: new Map(),
  })
}

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

function wheel(values: Partial<WheelInput> = {}): WheelInput {
  return Object.freeze({
    clientX: 0,
    clientY: 0,
    deltaX: 0,
    deltaY: 0,
    deltaZ: 0,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...values,
  })
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
