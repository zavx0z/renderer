import {describe, expect, test} from "bun:test"
import {
  Matrix4,
  Object3D,
  Raycaster,
  Space,
  Vector3,
  type Renderer as EngineRenderer,
  type TrueTypeFont,
  type ViewPoint,
} from "@engine/core"
import {createDocument, type Node as SemanticNode} from "@zavx0z/dom"
import type {
  PointerInput,
  RenderFrame,
  RenderViewport,
  WheelInput,
} from "@zavx0z/renderer"
import {RendererWebGpuDocumentPlane} from "@zavx0z/renderer-webgpu"
import type {
  CreateDocumentPlaneRuntimeOptions,
  DocumentPlaneRuntime,
} from "../src/plane-runtime.ts"
import {
  createDocumentOverlayRuntime,
  type DocumentOverlayRuntime,
} from "../src/overlay-runtime.ts"
import type {
  DocumentNativeInputHost,
  DocumentNativeInputTarget,
} from "../src/native-input-host.ts"
import {createDocumentSpaceRuntime} from "../src/index.ts"
import {
  createDocumentSpaceRuntimeWithSeams,
  type DocumentSpaceRuntimeSeams,
  type DocumentSpaceViewPointSnapshot,
} from "../src/space-runtime.ts"

describe("createDocumentSpaceRuntime", () => {
  test("registers stable ids and updates only the named plane owners", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      {canvas: harness.canvas.element},
      harness.seams,
    )
    const first = registration("first")
    const firstRuntime = runtime.addPlane(first)
    const firstPlane = firstRuntime.plane
    const firstContent = firstPlane.content

    expect(runtime.planeIds).toEqual(["first"])
    expect(runtime.getPlane("first")).toBe(firstRuntime)
    expect(harness.calls.planeRuntimeCreates).toBe(1)
    expect(() => runtime.addPlane({...first, document: null as never})).toThrow("already registered")
    expect(harness.calls.planeRuntimeCreates).toBe(1)

    const secondRuntime = runtime.addPlane({
      ...registration("second"),
      transform: {position: {x: 0, y: 0, z: -5}},
    })
    expect(runtime.planeIds).toEqual(["first", "second"])
    expect(runtime.space.children).toEqual([firstPlane, secondRuntime.plane])

    const updated = runtime.updatePlane("first", {
      viewport: {width: 200, height: 80},
      worldUnitsPerPixel: 0.03,
      transform: {
        position: {x: 2, y: 3, z: 4},
        quaternion: {x: 0, y: 0, z: 0, w: 2},
        scale: {x: 2, y: 1, z: 1},
      },
    })
    expect(updated).toBe(firstRuntime)
    expect(updated.plane).toBe(firstPlane)
    expect(updated.plane.content).toBe(firstContent)
    expect(updated.viewport).toEqual({width: 200, height: 80})
    expect(updated.worldUnitsPerPixel).toBe(0.03)
    expect(updated.plane.position).toMatchObject({x: 2, y: 3, z: 4})
    expect(updated.plane.quaternion.w).toBeCloseTo(1)
    expect(runtime.getPlane("second")).toBe(secondRuntime)

    expect(runtime.removePlane("missing")).toBeFalse()
    expect(runtime.removePlane("second")).toBeTrue()
    expect(runtime.planeIds).toEqual(["first"])
    expect(secondRuntime.disposed).toBeTrue()
    expect(firstRuntime.disposed).toBeFalse()
    runtime.dispose()
  })

  test("coalesces one shared loop and keeps presentation-only requests revision-neutral", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      {canvas: harness.canvas.element},
      harness.seams,
    )
    runtime.addPlane(registration("main"))
    runtime.render()
    const plane = harness.plane("main")
    const semanticFlushes = plane.calls.flushes
    const engineFrames = harness.calls.engineFrames

    plane.requestSemanticFrame()
    plane.requestSemanticFrame()
    expect(harness.pendingFrames()).toBe(1)
    harness.flushFrame()
    expect(plane.calls.flushes).toBe(semanticFlushes + 1)
    expect(harness.calls.engineFrames).toBe(engineFrames + 1)

    const revision = plane.runtime.frame.revision
    plane.requestPresentation()
    plane.requestPresentation()
    expect(harness.pendingFrames()).toBe(1)
    harness.flushFrame()
    expect(plane.calls.flushes).toBe(semanticFlushes + 1)
    expect(plane.runtime.frame.revision).toBe(revision)
    expect(harness.calls.engineFrames).toBe(engineFrames + 2)
    runtime.dispose()
  })

  test("schedules one delayed title frame and cancels it with hover ownership", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      {canvas: harness.canvas.element},
      harness.seams,
    )
    runtime.addPlane({...registration("title"), tooltipDelayMs: 650})
    runtime.render()

    harness.canvas.emit("pointermove", pointer({clientX: 50, clientY: 50, pointerId: 40}))
    expect(harness.pendingTimers()).toBe(1)
    expect(harness.timerDelays()).toEqual([651])
    harness.canvas.emit("pointermove", pointer({clientX: 51, clientY: 50, pointerId: 40}))
    expect(harness.pendingTimers()).toBe(1)
    expect(harness.pendingFrames()).toBe(1)
    harness.flushFrame()
    const engineFrames = harness.calls.engineFrames
    const semanticFlushes = harness.plane("title").calls.flushes

    harness.flushTimer()
    expect(harness.pendingFrames()).toBe(1)
    harness.flushFrame()
    expect(harness.calls.engineFrames).toBe(engineFrames + 1)
    expect(harness.plane("title").calls.flushes).toBe(semanticFlushes + 1)

    harness.canvas.emit("pointermove", pointer({clientX: 50, clientY: 50, pointerId: 40}))
    expect(harness.pendingTimers()).toBe(1)
    harness.canvas.emit("pointerleave", pointer({clientX: 150, clientY: 150, pointerId: 40}))
    expect(harness.pendingTimers()).toBe(0)

    harness.canvas.emit("pointermove", pointer({clientX: 50, clientY: 50, pointerId: 41}))
    expect(harness.pendingTimers()).toBe(1)
    runtime.removePlane("title")
    expect(harness.pendingTimers()).toBe(0)
    runtime.dispose()
  })

  test("routes nearest inside hits, exposes hover/active ids and cancels removed capture", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      {canvas: harness.canvas.element},
      harness.seams,
    )
    const near = runtime.addPlane(registration("near"))
    runtime.addPlane({
      ...registration("far"),
      transform: {position: {x: 0, y: 0, z: -5}},
    })
    runtime.render()

    harness.canvas.emit("pointermove", pointer({clientX: 50, clientY: 50, pointerId: 7}))
    expect(runtime.hoveredPlaneId).toBe("near")
    expect(harness.plane("near").calls.pointerMoves.at(-1)).toMatchObject({
      clientX: 50,
      clientY: 50,
    })
    expect(harness.plane("far").calls.pointerMoves).toEqual([])

    let prevented = 0
    harness.canvas.emit("pointerdown", pointer({
      clientX: 50,
      clientY: 50,
      pointerId: 7,
      buttons: 1,
      preventDefault() { prevented += 1 },
    }))
    expect(prevented).toBe(1)
    expect(runtime.activePlaneId).toBe("near")
    expect(harness.canvas.captured.has(7)).toBeTrue()

    expect(runtime.removePlane("near")).toBeTrue()
    expect(near.disposed).toBeTrue()
    expect(harness.plane("near").calls.pointerCancels).toHaveLength(1)
    expect(harness.canvas.captured.has(7)).toBeFalse()
    expect(runtime.activePlaneId).toBeNull()
    expect(runtime.hoveredPlaneId).toBeNull()

    harness.canvas.emit("pointermove", pointer({clientX: 50, clientY: 50, pointerId: 8}))
    expect(runtime.hoveredPlaneId).toBe("far")
    harness.canvas.emit("wheel", wheel({clientX: 50, clientY: 50, deltaY: 6}))
    expect(harness.plane("far").calls.wheels.at(-1)).toMatchObject({
      clientX: 50,
      clientY: 50,
      deltaY: 6,
    })

    runtime.updatePlane("far", {transform: {visible: false}})
    expect(runtime.hoveredPlaneId).toBeNull()
    harness.canvas.emit("pointermove", pointer({clientX: 50, clientY: 50, pointerId: 9}))
    expect(runtime.hoveredPlaneId).toBeNull()
    runtime.dispose()
  })

  test("switches the exact input Document and clears it on empty hit or plane removal", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      {canvas: harness.canvas.element},
      harness.seams,
    )
    const inputRegistration = registration("input")
    const input = inputRegistration.document.createElement("input")
    input.value = "first"
    inputRegistration.root.appendChild(input)
    runtime.addPlane(inputRegistration)
    runtime.render()

    harness.canvas.emit("pointerdown", pointer({clientX: 50, clientY: 50, pointerId: 12, buttons: 1}))
    expect(inputRegistration.document.activeElement).toBe(input)
    expect(runtime.inputTarget).toBe(input)
    expect(runtime.activeInputPlaneId).toBe("input")
    expect(harness.nativeHost.document).toBe(inputRegistration.document)
    expect(harness.nativeHost.ownerId).toBe("input")

    harness.canvas.emit("pointerdown", pointer({clientX: 200, clientY: 200, pointerId: 12}))
    expect(inputRegistration.document.activeElement).toBeNull()
    expect(runtime.inputTarget).toBeNull()
    expect(runtime.activeInputPlaneId).toBeNull()

    input.focus()
    harness.canvas.emit("pointerdown", pointer({clientX: 50, clientY: 50, pointerId: 12, buttons: 1}))
    expect(runtime.activeInputPlaneId).toBe("input")
    runtime.removePlane("input")
    expect(runtime.inputTarget).toBeNull()
    expect(runtime.activeInputPlaneId).toBeNull()
    expect(harness.nativeHost.document).toBeNull()
    runtime.dispose()
  })

  test("uses registration order only for exact distance ties", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      {canvas: harness.canvas.element},
      harness.seams,
    )
    runtime.addPlane(registration("alpha"))
    runtime.addPlane(registration("beta"))
    runtime.render()

    harness.canvas.emit("pointermove", pointer({clientX: 50, clientY: 50}))
    expect(runtime.hoveredPlaneId).toBe("alpha")
    expect(harness.plane("alpha").calls.pointerMoves).toHaveLength(1)
    expect(harness.plane("beta").calls.pointerMoves).toHaveLength(0)
    runtime.dispose()
  })

  test("owns canvas resize, capture and explicit ViewPoint snapshot/restore hooks", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams({
      canvas: harness.canvas.element,
      pixelRatio: 2,
      viewPoint: snapshot({position: {x: 0, y: 0, z: 20}}),
    }, harness.seams)

    expect(runtime.snapshotViewPoint()).toEqual(snapshot({position: {x: 0, y: 0, z: 20}}))
    runtime.restoreViewPoint(snapshot({
      position: {x: 2, y: 3, z: 30},
      target: {x: 1, y: 1, z: 0},
      up: {x: 0, y: 1, z: 0},
      fov: Math.PI / 3,
      near: 0.2,
      far: 8_000,
    }))
    expect(runtime.snapshotViewPoint()).toEqual(snapshot({
      position: {x: 2, y: 3, z: 30},
      target: {x: 1, y: 1, z: 0},
      up: {x: 0, y: 1, z: 0},
      fov: Math.PI / 3,
      near: 0.2,
      far: 8_000,
    }))

    harness.canvas.rect = {left: 10, top: 20, width: 320, height: 180}
    harness.triggerResize()
    expect(harness.calls.pixelRatios.at(-1)).toBe(2)
    expect(harness.calls.sizes.at(-1)).toEqual([320, 180])
    expect(harness.calls.aspects.at(-1)).toBeCloseTo(320 / 180)
    expect(harness.pendingFrames()).toBe(1)
    harness.flushFrame()

    expect(await runtime.captureLastPresentedFramePng()).toBe(harness.capture)
    expect(harness.calls.captures).toBe(1)
    runtime.dispose()
  })

  test("routes camera-locked DOM overlays before world planes in the same Engine frame", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      {canvas: harness.canvas.element},
      harness.seams,
    )
    const plane = runtime.addPlane(registration("world"))
    const overlayRegistrationValue = overlayRegistration("hud")
    let clicks = 0
    overlayRegistrationValue.root.addEventListener("click", () => { clicks += 1 })
    const overlay = runtime.addOverlay(overlayRegistrationValue)
    runtime.render()

    expect(runtime.planeIds).toEqual(["world"])
    expect(runtime.overlayIds).toEqual(["hud"])
    expect(runtime.getOverlay("hud")).toBe(overlay)
    expect(runtime.space.children).toEqual([plane.plane, overlay.overlay])
    expect(harness.calls.overlayRuntimeCreates).toBe(1)

    harness.canvas.emit("pointermove", pointer({clientX: 50, clientY: 50, pointerId: 20}))
    expect(runtime.hoveredOverlayId).toBe("hud")
    expect(runtime.hoveredPlaneId).toBeNull()

    harness.canvas.emit("pointerdown", pointer({
      clientX: 50,
      clientY: 50,
      pointerId: 20,
      buttons: 1,
    }))
    expect(runtime.activeOverlayId).toBe("hud")
    expect(runtime.activePlaneId).toBeNull()
    expect(harness.canvas.captured.has(20)).toBeTrue()
    harness.canvas.emit("pointerup", pointer({clientX: 50, clientY: 50, pointerId: 20}))
    expect(clicks).toBe(1)
    expect(runtime.activeOverlayId).toBeNull()

    harness.canvas.emit("pointerdown", pointer({
      clientX: 50,
      clientY: 50,
      pointerId: 21,
      buttons: 1,
    }))
    expect(runtime.removeOverlay("hud")).toBeTrue()
    expect(overlay.disposed).toBeTrue()
    expect(harness.canvas.captured.has(21)).toBeFalse()
    expect(runtime.overlayIds).toEqual([])
    expect(runtime.getPlane("world")).toBe(plane)
    runtime.dispose()
  })

  test("routes empty-space orbit, pan and zoom after semantic hit ownership", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams({
      canvas: harness.canvas.element,
      cameraGestures: true,
    }, harness.seams)
    runtime.addPlane(registration("world"))
    runtime.render()

    harness.canvas.emit("pointerdown", pointer({
      clientX: 50,
      clientY: 50,
      pointerId: 31,
      button: 0,
      buttons: 1,
    }))
    harness.canvas.emit("pointermove", pointer({
      clientX: 62,
      clientY: 43,
      pointerId: 31,
      button: 0,
      buttons: 1,
    }))
    harness.canvas.emit("pointerup", pointer({clientX: 62, clientY: 43, pointerId: 31}))
    expect(harness.calls.orbits).toEqual([[12, -7]])
    expect(harness.plane("world").calls.pointerDowns).toEqual([])

    harness.canvas.emit("pointerdown", pointer({
      clientX: 20,
      clientY: 20,
      pointerId: 32,
      button: 2,
      buttons: 2,
    }))
    harness.canvas.emit("pointermove", pointer({
      clientX: 25,
      clientY: 29,
      pointerId: 32,
      button: 2,
      buttons: 2,
    }))
    harness.canvas.emit("pointerup", pointer({clientX: 25, clientY: 29, pointerId: 32}))
    expect(harness.calls.pans).toContainEqual([5, 9])

    harness.canvas.emit("wheel", wheel({
      clientX: 40,
      clientY: 45,
      deltaY: 10,
      ctrlKey: true,
    }))
    expect(harness.calls.zooms).toContainEqual([-10, 40, 45])
    expect(runtime.activePlaneId).toBeNull()
    expect(runtime.activeOverlayId).toBeNull()
    runtime.setCameraGesturesEnabled(false)
    expect(runtime.cameraGesturesEnabled).toBeFalse()
    const zooms = harness.calls.zooms.length
    harness.canvas.emit("wheel", wheel({clientX: 40, clientY: 45, deltaY: 10, ctrlKey: true}))
    expect(harness.calls.zooms).toHaveLength(zooms)
    expect(() => runtime.setCameraGesturesEnabled(null as never)).toThrow("boolean")
    runtime.dispose()
  })

  test("cleans all exact owners, listeners, captures and pending work", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      {canvas: harness.canvas.element},
      harness.seams,
    )
    runtime.addPlane(registration("one"))
    runtime.addPlane(registration("two"))
    harness.canvas.emit("pointerdown", pointer({clientX: 50, clientY: 50, pointerId: 4, buttons: 1}))
    runtime.requestRender()
    expect(harness.pendingFrames()).toBe(1)

    runtime.dispose()
    runtime.dispose()
    expect(runtime.disposed).toBeTrue()
    expect(harness.pendingFrames()).toBe(0)
    expect(harness.calls.observerDisconnects).toBe(1)
    expect(harness.calls.viewPointDisposals).toBe(1)
    expect(harness.calls.nativeHostDisposals).toBe(1)
    expect(harness.canvas.listenerCount()).toBe(0)
    expect(harness.canvas.captured.size).toBe(0)
    expect(harness.pendingTimers()).toBe(0)
    expect(harness.plane("one").runtime.disposed).toBeTrue()
    expect(harness.plane("two").runtime.disposed).toBeTrue()
    expect(() => runtime.addPlane(registration("late"))).toThrow("disposed")
    expect(() => runtime.render()).toThrow("disposed")
  })

  test("fails before plane allocation for duplicate ids and malformed transforms", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      {canvas: harness.canvas.element},
      harness.seams,
    )
    runtime.addPlane(registration("valid"))
    const allocations = harness.calls.planeRuntimeCreates
    expect(() => runtime.addPlane({
      ...registration("valid"),
      transform: {scale: {x: 0, y: 1, z: 1}},
    })).toThrow("already registered")
    expect(harness.calls.planeRuntimeCreates).toBe(allocations)
    expect(() => runtime.addOverlay({...overlayRegistration("valid")})).toThrow("already registered")
    expect(harness.calls.overlayRuntimeCreates).toBe(0)
    expect(() => runtime.addPlane({
      ...registration("invalid"),
      transform: {scale: {x: 0, y: 1, z: 1}},
    })).toThrow("scale")
    expect(harness.calls.planeRuntimeCreates).toBe(allocations)
    expect(() => runtime.updatePlane("missing", {})).toThrow("Unknown")
    expect(() => runtime.restoreViewPoint(snapshot({position: {x: 0, y: 0, z: 0}})))
      .toThrow("must differ")
    runtime.dispose()
  })

  test("contains no product, Surface, manual CSS layout or duplicated document pipeline", async () => {
    const source = await Bun.file(new URL("../src/space-runtime.ts", import.meta.url)).text()

    expect(source).toContain("createDocumentPlaneRuntime")
    expect(source).toContain("RendererWebGpuDocumentPlaneIntersection")
    expect(source).toContain("raycaster.setFromCamera")
    for (const forbidden of [
      "UiRuntime",
      "UiSurface",
      "@layout/core",
      "@ui/",
      "HUD",
      "panel",
      "createDocumentRenderer",
      "RendererWebGpuBackend",
      "RendererWebGpuScreenOverlay",
      "style.css",
      "innerHTML",
    ]) expect(source).not.toContain(forbidden)
  })
})

function createHarness() {
  const canvas = new FakeCanvas({left: 0, top: 0, width: 100, height: 100})
  const calls = {
    initializes: 0,
    engineFrames: 0,
    pixelRatios: [] as number[],
    sizes: [] as Array<readonly [number, number]>,
    aspects: [] as number[],
    captures: 0,
    planeRuntimeCreates: 0,
    overlayRuntimeCreates: 0,
    observerDisconnects: 0,
    viewPointDisposals: 0,
    nativeHostDisposals: 0,
    orbits: [] as Array<readonly [number, number]>,
    pans: [] as Array<readonly [number, number]>,
    zooms: [] as Array<readonly [number, number, number]>,
  }
  const capture = new Blob(["space"], {type: "image/png"})
  const engineRenderer = {
    async init() { calls.initializes += 1 },
    setPixelRatio(value: number) { calls.pixelRatios.push(value) },
    setSize(width: number, height: number) { calls.sizes.push([width, height]) },
    invalidateGeometry() {},
    renderFrame() { calls.engineFrames += 1 },
    captureLastPresentedFramePng() {
      calls.captures += 1
      return Promise.resolve(capture)
    },
  } as unknown as EngineRenderer
  const space = new Space()
  const viewPoint = fakeViewPoint(calls)
  const raycaster = new Raycaster()
  raycaster.setFromCamera = ((coords: {x: number; y: number}) => {
    raycaster.ray.origin.set(coords.x, coords.y, 10)
    raycaster.ray.direction.set(0, 0, -1)
  }) as typeof raycaster.setFromCamera
  const planes = new Map<string, FakePlaneRuntime>()
  const overlays = new Map<string, DocumentOverlayRuntime>()
  const nativeHost = new FakeNativeHost(calls)
  let resizeCallback = (): void => {}
  let nextHandle = 1
  const frames = new Map<number, () => void>()
  const timers = new Map<number, Readonly<{callback: () => void; delayMs: number}>>()

  const seams: DocumentSpaceRuntimeSeams = Object.freeze({
    createEngineRenderer: () => engineRenderer,
    async initializeEngineRenderer(renderer, owner) {
      await renderer.init(owner)
    },
    createSpace: () => space,
    createViewPoint(_canvas, initial) {
      viewPoint.position.set(initial.position.x, initial.position.y, initial.position.z)
      viewPoint.getTarget().set(initial.target.x, initial.target.y, initial.target.z)
      viewPoint.getUp().set(initial.up.x, initial.up.y, initial.up.z)
      viewPoint.fov = initial.fov
      viewPoint.near = initial.near
      viewPoint.far = initial.far
      return viewPoint
    },
    createRaycaster: () => raycaster,
    createNativeInputHost: () => nativeHost.host,
    createPlaneRuntime(options) {
      calls.planeRuntimeCreates += 1
      const id = [...options.document.childNodes]
        .map((node) => (node as {getAttribute?(name: string): string | null}).getAttribute?.("data-plane-id"))
        .find((value) => value !== undefined && value !== null)
      if (id === undefined || id === null) throw new Error("Fixture plane id is absent")
      const runtime = new FakePlaneRuntime(options)
      planes.set(id, runtime)
      return runtime.runtime
    },
    createOverlayRuntime(options) {
      calls.overlayRuntimeCreates += 1
      const id = [...options.document.childNodes]
        .flatMap((node) => [...node.childNodes, node])
        .map((node) => (node as {getAttribute?(name: string): string | null}).getAttribute?.("data-overlay-id"))
        .find((value) => value !== undefined && value !== null)
      if (id === undefined || id === null) throw new Error("Fixture overlay id is absent")
      const runtime = createDocumentOverlayRuntime(options)
      overlays.set(id, runtime)
      return runtime
    },
    createResizeObserver(callback) {
      resizeCallback = callback
      return {
        observe() {},
        disconnect() { calls.observerDisconnects += 1 },
      }
    },
    readCanvasRect: () => canvas.rect,
    devicePixelRatio: () => 1.5,
    requestFrame(callback) {
      const handle = nextHandle++
      frames.set(handle, callback)
      return handle
    },
    cancelFrame(handle) { frames.delete(handle as number) },
    setTimer(callback, delayMs) {
      const handle = nextHandle++
      timers.set(handle, {callback, delayMs})
      return handle
    },
    clearTimer(handle) { timers.delete(handle as number) },
    now: () => 100,
  })
  return {
    canvas,
    calls,
    capture,
    nativeHost,
    seams,
    plane(id: string) {
      const plane = planes.get(id)
      if (plane === undefined) throw new Error(`Unknown fixture plane ${id}`)
      return plane
    },
    overlay(id: string) {
      const overlay = overlays.get(id)
      if (overlay === undefined) throw new Error(`Unknown fixture overlay ${id}`)
      return overlay
    },
    pendingFrames: () => frames.size,
    pendingTimers: () => timers.size,
    timerDelays: () => [...timers.values()].map(({delayMs}) => delayMs),
    flushFrame() {
      const entry = frames.entries().next().value as [number, () => void] | undefined
      if (entry === undefined) throw new Error("No pending frame")
      frames.delete(entry[0])
      entry[1]()
    },
    flushTimer() {
      const entry = timers.entries().next().value as [number, Readonly<{callback: () => void}>] | undefined
      if (entry === undefined) throw new Error("No pending timer")
      timers.delete(entry[0])
      entry[1].callback()
    },
    triggerResize: () => resizeCallback(),
  }
}

class FakePlaneRuntime {
  readonly calls = {
    flushes: 1,
    pointerMoves: [] as PointerInput[],
    pointerDowns: [] as PointerInput[],
    pointerUps: [] as PointerInput[],
    pointerCancels: [] as PointerInput[],
    wheels: [] as WheelInput[],
  }
  readonly runtime: DocumentPlaneRuntime
  readonly #options: CreateDocumentPlaneRuntimeOptions
  #revision = 1
  #frame: RenderFrame
  #disposed = false

  constructor(options: CreateDocumentPlaneRuntimeOptions) {
    this.#options = options
    const plane = new RendererWebGpuDocumentPlane({
      content: new Object3D(),
      viewport: options.viewport,
      worldUnitsPerPixel: options.worldUnitsPerPixel,
    })
    this.#frame = emptyFrame(options.document, options.root, options.viewport, this.#revision)
    this.runtime = Object.freeze({
      document: options.document,
      root: options.root,
      styleSheets: options.styleSheets,
      font: options.font,
      renderer: {flush: () => this.#frame} as never,
      interaction: {} as never,
      backend: {root: plane.content} as never,
      plane,
      get frame() { return thisOwner.#frame },
      get viewport() { return plane.viewport },
      get worldUnitsPerPixel() { return plane.worldUnitsPerPixel },
      get disposed() { return thisOwner.#disposed },
      flush() { return thisOwner.flush() },
      resize(viewport, scale = plane.worldUnitsPerPixel) {
        plane.configure(viewport, scale)
        thisOwner.#revision += 1
        thisOwner.#frame = emptyFrame(options.document, options.root, viewport, thisOwner.#revision)
        options.requestPresentation()
        return thisOwner.#frame
      },
      pointerMove(input) {
        thisOwner.calls.pointerMoves.push(input)
        options.requestFrame()
        return options.document.documentElement
      },
      pointerDown(input) {
        thisOwner.calls.pointerDowns.push(input)
        options.requestFrame()
        const target = options.document.querySelector("input") ??
          options.document.querySelector("textarea") ??
          options.document.documentElement
        const focusable = target as {focus(): void} | null
        focusable?.focus()
        return target
      },
      pointerUp(input) {
        thisOwner.calls.pointerUps.push(input)
        options.requestFrame()
        return options.document.documentElement
      },
      pointerCancel(input) {
        thisOwner.calls.pointerCancels.push(input)
        options.requestFrame()
      },
      wheel(input) {
        thisOwner.calls.wheels.push(input)
        options.requestFrame()
        return options.document.documentElement
      },
      subscribe() { return () => {} },
      dispose() { thisOwner.#disposed = true },
    })
    const thisOwner = this
    options.requestPresentation()
  }

  flush(): RenderFrame {
    if (this.#disposed) throw new Error("plane disposed")
    this.calls.flushes += 1
    this.#revision += 1
    this.#frame = emptyFrame(
      this.#options.document,
      this.#options.root,
      this.runtime.viewport,
      this.#revision,
    )
    this.#options.requestPresentation()
    return this.#frame
  }

  requestSemanticFrame(): void {
    this.#options.requestFrame()
  }

  requestPresentation(): void {
    this.#options.requestPresentation()
  }
}

class FakeNativeHost {
  readonly nativeInput = {} as HTMLInputElement
  readonly nativeTextArea = {} as HTMLTextAreaElement
  document: ReturnType<typeof createDocument> | null = null
  ownerId: string | null = null
  inputTarget: DocumentNativeInputTarget | null = null
  disposed = false
  readonly host: DocumentNativeInputHost

  constructor(readonly calls: {nativeHostDisposals: number}) {
    const self = this
    this.host = Object.freeze({
      nativeInput: this.nativeInput,
      nativeTextArea: this.nativeTextArea,
      get document() { return self.document },
      get ownerId() { return self.ownerId },
      get inputTarget() { return self.inputTarget },
      get activeProxy() {
        return self.inputTarget?.localName === "textarea" ? "textarea" :
          self.inputTarget?.localName === "input" ? "input" : null
      },
      setActiveDocument(document, ownerId = null) {
        if (self.document !== document) self.inputTarget?.blur()
        self.document = document
        self.ownerId = document === null ? null : ownerId
        self.synchronize()
      },
      synchronize() { self.synchronize() },
      blur() {
        self.inputTarget?.blur()
        self.inputTarget = null
      },
      dispose() {
        if (self.disposed) return
        self.disposed = true
        self.inputTarget?.blur()
        self.inputTarget = null
        self.document = null
        self.ownerId = null
        self.calls.nativeHostDisposals += 1
      },
    })
  }

  synchronize(): void {
    const active = this.document?.activeElement
    this.inputTarget = active !== null && active !== undefined &&
      (active.localName === "textarea" ||
        (active.localName === "input" && (active as {selectionStart?: unknown}).selectionStart !== null))
      ? active as DocumentNativeInputTarget
      : null
  }
}

class FakeCanvas {
  readonly element = this as unknown as HTMLCanvasElement
  readonly captured = new Set<number>()
  readonly #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  constructor(public rect: {left: number; top: number; width: number; height: number}) {}

  get clientWidth(): number { return this.rect.width }
  get clientHeight(): number { return this.rect.height }
  getBoundingClientRect(): DOMRect { return this.rect as DOMRect }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) return
    const listeners = this.#listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(type, listeners)
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener !== null) this.#listeners.get(type)?.delete(listener)
  }
  emit(type: string, event: unknown): void {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) {
      if (typeof listener === "function") listener(event as Event)
      else listener.handleEvent(event as Event)
    }
  }
  listenerCount(): number {
    return [...this.#listeners.values()].reduce((total, listeners) => total + listeners.size, 0)
  }
  setPointerCapture(pointerId: number): void { this.captured.add(pointerId) }
  hasPointerCapture(pointerId: number): boolean { return this.captured.has(pointerId) }
  releasePointerCapture(pointerId: number): void { this.captured.delete(pointerId) }
}

function fakeViewPoint(calls: {
  aspects: number[]
  viewPointDisposals: number
  orbits: Array<readonly [number, number]>
  pans: Array<readonly [number, number]>
  zooms: Array<readonly [number, number, number]>
}): ViewPoint {
  const position = new Vector3(0, 0, 10)
  const target = new Vector3(0, 0, 0)
  const up = new Vector3(0, 1, 0)
  return {
    fov: Math.PI / 4,
    aspect: 1,
    near: 0.1,
    far: 5_000,
    position,
    viewMatrix: new Matrix4(),
    projectionMatrix: new Matrix4(),
    getTarget: () => target,
    getUp: () => up,
    update() {},
    updateProjectionMatrix() {},
    setAspectRatio(value: number) {
      calls.aspects.push(value)
    },
    orbit(deltaX: number, deltaY: number) {
      calls.orbits.push([deltaX, deltaY])
      position.x += deltaX
      position.y += deltaY
    },
    pan(deltaX: number, deltaY: number) {
      calls.pans.push([deltaX, deltaY])
      position.x += deltaX
      position.y += deltaY
      target.x += deltaX
      target.y += deltaY
    },
    zoom(delta: number, anchor?: {clientX: number; clientY: number}) {
      calls.zooms.push([delta, anchor?.clientX ?? 0, anchor?.clientY ?? 0])
      position.z += delta
    },
    dispose() { calls.viewPointDisposals += 1 },
  } as unknown as ViewPoint
}

function registration(id: string) {
  const document = createDocument()
  const root = document.createElement("div")
  root.setAttribute("data-plane-id", id)
  root.setAttribute("style", "width: 100px; height: 100px")
  document.appendChild(root)
  return {
    id,
    document,
    root,
    styleSheets: [],
    font: fakeFont(),
    viewport: {width: 100, height: 100},
    worldUnitsPerPixel: 0.02,
  } as const
}

function overlayRegistration(id: string) {
  const document = createDocument()
  const root = document.createElement("button")
  root.setAttribute("data-overlay-id", id)
  root.setAttribute("style", "width: 100px; height: 100px")
  root.append("Overlay")
  document.appendChild(root)
  return {
    id,
    document,
    root,
    styleSheets: [],
    font: fakeFont(),
  } as const
}

function emptyFrame(
  document: ReturnType<typeof createDocument>,
  root: SemanticNode,
  viewport: RenderViewport,
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

function pointer(values: Partial<PointerEvent> = {}): PointerEvent {
  return {
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 0,
    pressure: 0,
    isPrimary: true,
    timeStamp: 10,
    cancelable: true,
    preventDefault() {},
    ...values,
  } as PointerEvent
}

function wheel(values: Partial<WheelEvent> = {}): WheelEvent {
  return {
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
    cancelable: true,
    preventDefault() {},
    ...values,
  } as WheelEvent
}

function snapshot(
  overrides: Partial<DocumentSpaceViewPointSnapshot> = {},
): DocumentSpaceViewPointSnapshot {
  return {
    position: {x: 0, y: 0, z: 10},
    target: {x: 0, y: 0, z: 0},
    up: {x: 0, y: 1, z: 0},
    fov: Math.PI / 4,
    near: 0.1,
    far: 5_000,
    ...overrides,
  }
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
