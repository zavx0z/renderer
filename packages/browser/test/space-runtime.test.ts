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
import {createDocumentPlaneRuntime} from "../src/plane-runtime.ts"
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
      harness.options,
      harness.seams,
    )
    const first = harness.registration("first")
    const firstRuntime = runtime.addPlane(first)
    const firstPlane = firstRuntime.plane
    const firstContent = firstPlane.content

    expect(runtime.planeIds).toEqual(["first"])
    expect(runtime.getPlane("first")).toBe(firstRuntime)
    expect(runtime.document).toBe(harness.document)
    expect(runtime.font).toBe(harness.font)
    expect(runtime.styleSheets).toEqual(harness.options.styleSheets)
    expect(firstRuntime.interactionState).toBe(runtime.interactionState)
    expect(harness.calls.planeRuntimeCreates).toBe(1)
    expect(() => runtime.addPlane(first)).toThrow("already registered")
    expect(harness.calls.planeRuntimeCreates).toBe(1)

    const secondRuntime = runtime.addPlane({
      ...harness.registration("second"),
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
      harness.options,
      harness.seams,
    )
    const presented: number[] = []
    const unsubscribePresented = runtime.subscribePresented((frame) => presented.push(frame))
    runtime.addPlane(harness.registration("main"))
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
    expect(presented).toEqual([
      runtime.presentedFrames - 2,
      runtime.presentedFrames - 1,
      runtime.presentedFrames,
    ])
    unsubscribePresented()
    expect(() => runtime.subscribePresented(null as never)).toThrow("listener")
    runtime.dispose()
  })

  test("schedules one delayed title frame and cancels it with hover ownership", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      harness.options,
      harness.seams,
    )
    runtime.addPlane({...harness.registration("title"), tooltipDelayMs: 650})
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
      harness.options,
      harness.seams,
    )
    const near = runtime.addPlane(harness.registration("near"))
    runtime.addPlane({
      ...harness.registration("far"),
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

  test("keeps the exact Experience Document while changing input projection ownership", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      harness.options,
      harness.seams,
    )
    const inputRegistration = harness.registration("input")
    const input = harness.document.createElement("input")
    input.value = "first"
    inputRegistration.root.appendChild(input)
    runtime.addPlane(inputRegistration)
    runtime.render()

    harness.canvas.emit("pointerdown", pointer({clientX: 50, clientY: 50, pointerId: 12, buttons: 1}))
    expect(harness.document.activeElement).toBe(input)
    expect(runtime.inputTarget).toBe(input)
    expect(runtime.activeInputPlaneId).toBe("input")
    expect(harness.nativeHost.document).toBe(harness.document)
    expect(harness.nativeHost.ownerId).toBe("input")

    harness.canvas.emit("pointerdown", pointer({clientX: 200, clientY: 200, pointerId: 12}))
    expect(harness.document.activeElement).toBeNull()
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
      harness.options,
      harness.seams,
    )
    runtime.addPlane(harness.registration("alpha"))
    runtime.addPlane(harness.registration("beta"))
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
      ...harness.options,
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

  test("attaches one bounded direct world to the shared composition with exact backing geometry", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      harness.options,
      harness.seams,
    )
    const worldSpace = new Space()
    const resizes: unknown[] = []
    const world = runtime.addWorld({
      id: "preview",
      space: worldSpace,
      viewport: {x: 10, y: 20, width: 50, height: 40},
      viewPoint: snapshot({position: {x: 4, y: -8, z: 12}}),
      onResize(value) { resizes.push(value) },
    })
    const semanticOverlay = runtime.addOverlay(harness.overlayRegistration("semantic"))

    expect(runtime.worldIds).toEqual(["preview"])
    expect(runtime.getWorld("preview")).toBe(world)
    expect(runtime.space.children).toContain(worldSpace)
    expect(worldSpace.parent).toBe(runtime.space)
    expect(world.logicalViewport).toEqual({x: 10, y: 20, width: 50, height: 40})
    expect(world.backingViewport).toEqual({x: 15, y: 30, width: 75, height: 60})
    expect(resizes).toEqual([{
      logicalViewport: {x: 10, y: 20, width: 50, height: 40},
      backingViewport: {x: 15, y: 30, width: 75, height: 60},
      pixelRatio: 1.5,
    }])

    runtime.render()
    const composition = harness.calls.compositions.at(-1) as any
    expect(composition.space).toBe(runtime.space)
    expect(composition.viewPoint).toBe(runtime.viewPoint)
    expect(composition.overlays).toEqual([semanticOverlay.overlay])
    expect(composition.boundedViews).toEqual([{
      space: worldSpace,
      viewPoint: world.viewPoint,
      viewport: {x: 15, y: 30, width: 75, height: 60},
    }])

    runtime.updateWorld("preview", {viewport: {x: 80, y: 90, width: 50, height: 20}})
    expect(world.logicalViewport).toEqual({x: 80, y: 90, width: 20, height: 10})
    expect(world.backingViewport).toEqual({x: 120, y: 135, width: 30, height: 15})
    expect(harness.calls.viewports.at(-1)).toEqual({left: 80, top: 90, width: 20, height: 10})

    const pending = harness.pendingFrames()
    world.requestRender()
    world.requestRender()
    expect(harness.pendingFrames()).toBe(Math.max(1, pending))
    if (harness.pendingFrames() > 0) harness.flushFrame()

    runtime.updateWorld("preview", {visible: false})
    expect(world.logicalViewport).toBeNull()
    expect(world.backingViewport).toBeNull()
    expect(resizes.at(-1)).toBeNull()
    runtime.render()
    expect((harness.calls.compositions.at(-1) as any).boundedViews).toEqual([])

    runtime.updateWorld("preview", {
      visible: true,
      viewPoint: snapshot({position: {x: 1, y: 2, z: 30}}),
    })
    expect(world.snapshotViewPoint()).toEqual(snapshot({position: {x: 1, y: 2, z: 30}}))
    const disposals = harness.calls.viewPointDisposals
    expect(runtime.removeWorld("preview")).toBeTrue()
    expect(runtime.removeWorld("preview")).toBeFalse()
    expect(world.disposed).toBeTrue()
    expect(worldSpace.parent).toBeNull()
    expect(harness.calls.viewPointDisposals).toBe(disposals + 1)
    runtime.dispose()
  })

  test("routes interactive overlay before bounded world and bounded world before plane/global camera", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams({
      ...harness.options,
      cameraGestures: true,
    }, harness.seams)
    runtime.addPlane(harness.registration("plane"))
    const passiveRoot = harness.document.createElement("div")
    passiveRoot.setAttribute("data-overlay-id", "passive")
    passiveRoot.setAttribute("style", "width:100px; height:100px; background:#111")
    harness.experience.appendChild(passiveRoot)
    runtime.addOverlay({id: "passive", root: passiveRoot})
    let doubleClicks = 0
    const world = runtime.addWorld({
      id: "world",
      space: new Space(),
      viewport: {x: 20, y: 20, width: 60, height: 60},
      viewPoint: snapshot(),
      onDoubleClick() { doubleClicks += 1 },
    })
    runtime.render()

    harness.canvas.emit("pointermove", pointer({clientX: 50, clientY: 50, pointerId: 70}))
    expect(runtime.hoveredWorldId).toBe("world")
    expect(runtime.hoveredOverlayId).toBeNull()
    expect(runtime.hoveredPlaneId).toBeNull()
    harness.canvas.emit("pointerdown", pointer({
      clientX: 50,
      clientY: 50,
      pointerId: 70,
      button: 0,
      buttons: 1,
    }))
    expect(runtime.activeWorldId).toBe("world")
    harness.canvas.emit("pointermove", pointer({
      clientX: 57,
      clientY: 46,
      pointerId: 70,
      button: 0,
      buttons: 1,
    }))
    expect(runtime.activeWorldId).toBe("world")
    expect(harness.calls.orbits).toContainEqual([7, -4])
    expect(harness.plane("plane").calls.pointerDowns).toEqual([])
    harness.canvas.emit("pointerup", pointer({clientX: 57, clientY: 46, pointerId: 70}))
    expect(runtime.activeWorldId).toBeNull()

    harness.canvas.emit("wheel", wheel({clientX: 40, clientY: 45, deltaY: 10, ctrlKey: true}))
    expect(harness.calls.zooms).toContainEqual([-10, 40, 45])
    harness.canvas.emit("dblclick", mouse({clientX: 40, clientY: 45}))
    expect(doubleClicks).toBe(1)

    const interactive = harness.overlayRegistration("interactive")
    runtime.addOverlay(interactive)
    runtime.render()
    const orbitCount = harness.calls.orbits.length
    harness.canvas.emit("pointerdown", pointer({
      clientX: 50,
      clientY: 50,
      pointerId: 71,
      button: 0,
      buttons: 1,
    }))
    expect(runtime.activeOverlayId).toBe("interactive")
    expect(runtime.activeWorldId).toBeNull()
    harness.canvas.emit("pointermove", pointer({clientX: 60, clientY: 50, pointerId: 71, buttons: 1}))
    expect(harness.calls.orbits).toHaveLength(orbitCount)
    harness.canvas.emit("pointerup", pointer({clientX: 60, clientY: 50, pointerId: 71}))
    harness.canvas.emit("dblclick", mouse({clientX: 50, clientY: 50}))
    expect(doubleClicks).toBe(1)

    runtime.removeOverlay("interactive")
    harness.canvas.emit("pointerdown", pointer({
      clientX: 50,
      clientY: 50,
      pointerId: 72,
      button: 0,
      buttons: 1,
    }))
    expect(harness.canvas.captured.has(72)).toBeTrue()
    runtime.updateWorld("world", {visible: false})
    expect(harness.canvas.captured.has(72)).toBeFalse()
    expect(runtime.activeWorldId).toBeNull()
    expect(runtime.hoveredWorldId).toBeNull()
    expect(world.visible).toBeFalse()
    runtime.dispose()
  })

  test("routes nested overlay descendants through their nearest enabled or disabled control", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams({
      ...harness.options,
      cameraGestures: true,
    }, harness.seams)
    const control = nestedControl(harness.document)
    control.button.setAttribute("data-overlay-id", "nested-overlay")
    harness.experience.appendChild(control.button)
    runtime.addOverlay({id: "nested-overlay", root: control.button})
    let worldDoubleClicks = 0
    runtime.addWorld({
      id: "world",
      space: new Space(),
      viewport: {x: 0, y: 0, width: 100, height: 100},
      viewPoint: snapshot(),
      cameraGestures: true,
      onDoubleClick() { worldDoubleClicks += 1 },
    })
    let clicks = 0
    control.button.addEventListener("click", () => { clicks += 1 })
    runtime.render()

    harness.canvas.emit("pointerdown", pointer({
      clientX: 10,
      clientY: 10,
      pointerId: 80,
      buttons: 1,
    }))
    expect(runtime.activeOverlayId).toBe("nested-overlay")
    expect(runtime.activeWorldId).toBeNull()
    expect(harness.canvas.captured.has(80)).toBeTrue()
    harness.canvas.emit("pointerup", pointer({clientX: 75, clientY: 10, pointerId: 80}))
    expect(clicks).toBe(1)
    expect(harness.canvas.captured.has(80)).toBeFalse()

    control.button.disabled = true
    runtime.render()
    const zooms = harness.calls.zooms.length
    harness.canvas.emit("pointerdown", pointer({
      clientX: 10,
      clientY: 10,
      pointerId: 81,
      buttons: 1,
    }))
    expect(runtime.activeOverlayId).toBe("nested-overlay")
    expect(runtime.activeWorldId).toBeNull()
    harness.canvas.emit("pointerup", pointer({clientX: 10, clientY: 10, pointerId: 81}))
    expect(clicks).toBe(1)
    harness.canvas.emit("wheel", wheel({clientX: 10, clientY: 10, deltaY: 8, ctrlKey: true}))
    expect(harness.calls.zooms).toHaveLength(zooms)
    harness.canvas.emit("dblclick", mouse({clientX: 10, clientY: 10}))
    expect(worldDoubleClicks).toBe(0)
    let contextMenus = 0
    harness.canvas.emit("contextmenu", mouse({
      clientX: 10,
      clientY: 10,
      preventDefault() { contextMenus += 1 },
    }))
    expect(contextMenus).toBe(0)

    harness.canvas.emit("pointerdown", pointer({
      clientX: 10,
      clientY: 10,
      pointerId: 82,
      buttons: 1,
    }))
    expect(harness.canvas.captured.has(82)).toBeTrue()
    harness.canvas.emit("pointercancel", pointer({clientX: 10, clientY: 10, pointerId: 82}))
    expect(harness.canvas.captured.has(82)).toBeFalse()
    expect(runtime.activeOverlayId).toBeNull()
    runtime.dispose()
  })

  test("routes nested plane descendants before global camera gestures", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams({
      ...harness.options,
      cameraGestures: true,
    }, harness.seams)
    const control = nestedControl(harness.document)
    control.button.setAttribute("data-plane-id", "nested-plane")
    control.button.setAttribute("data-actual-plane-runtime", "")
    harness.experience.appendChild(control.button)
    runtime.addPlane({
      id: "nested-plane",
      root: control.button,
      viewport: {width: 100, height: 100},
      worldUnitsPerPixel: 0.02,
    })
    let clicks = 0
    control.button.addEventListener("click", () => { clicks += 1 })
    runtime.render()
    const orbits = harness.calls.orbits.length

    harness.canvas.emit("pointerdown", pointer({
      clientX: 10,
      clientY: 10,
      pointerId: 90,
      buttons: 1,
    }))
    expect(runtime.activePlaneId).toBe("nested-plane")
    expect(harness.calls.orbits).toHaveLength(orbits)
    expect(harness.canvas.captured.has(90)).toBeTrue()
    harness.canvas.emit("pointerup", pointer({clientX: 75, clientY: 10, pointerId: 90}))
    expect(clicks).toBe(1)
    expect(harness.canvas.captured.has(90)).toBeFalse()

    control.button.disabled = true
    runtime.render()
    const zooms = harness.calls.zooms.length
    harness.canvas.emit("pointerdown", pointer({
      clientX: 10,
      clientY: 10,
      pointerId: 91,
      buttons: 1,
    }))
    expect(runtime.activePlaneId).toBe("nested-plane")
    expect(harness.calls.orbits).toHaveLength(orbits)
    harness.canvas.emit("pointerup", pointer({clientX: 10, clientY: 10, pointerId: 91}))
    expect(clicks).toBe(1)
    harness.canvas.emit("wheel", wheel({clientX: 10, clientY: 10, deltaY: 8, ctrlKey: true}))
    expect(harness.calls.zooms).toHaveLength(zooms)
    const pans = harness.calls.pans.length
    harness.canvas.emit("pointerdown", pointer({
      clientX: 10,
      clientY: 10,
      pointerId: 92,
      button: 2,
      buttons: 2,
    }))
    expect(runtime.activePlaneId).toBe("nested-plane")
    expect(harness.calls.pans).toHaveLength(pans)
    harness.canvas.emit("pointercancel", pointer({clientX: 10, clientY: 10, pointerId: 92}))
    expect(harness.canvas.captured.has(92)).toBeFalse()
    expect(runtime.activePlaneId).toBeNull()
    let contextMenus = 0
    harness.canvas.emit("contextmenu", mouse({
      clientX: 10,
      clientY: 10,
      preventDefault() { contextMenus += 1 },
    }))
    expect(contextMenus).toBe(0)
    runtime.dispose()
  })

  test("rejects duplicate, attached and malformed world owners before mutating the host", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(harness.options, harness.seams)
    const owner = new Space()
    const first = runtime.addWorld({
      id: "world",
      space: owner,
      viewport: {x: 0, y: 0, width: 20, height: 20},
      viewPoint: snapshot(),
    })
    expect(() => runtime.addPlane({...harness.registration("world")})).toThrow("already registered")
    expect(() => runtime.addWorld({
      id: "duplicate-space",
      space: owner,
      viewport: {x: 0, y: 0, width: 20, height: 20},
      viewPoint: snapshot(),
    })).toThrow("unattached")
    const parent = new Space()
    const attached = new Space()
    parent.add(attached)
    expect(() => runtime.addWorld({
      id: "attached",
      space: attached,
      viewport: {x: 0, y: 0, width: 20, height: 20},
      viewPoint: snapshot(),
    })).toThrow("unattached")
    expect(() => runtime.addWorld({
      id: "invalid-viewport",
      space: new Space(),
      viewport: {x: 0, y: 0, width: -1, height: 20},
      viewPoint: snapshot(),
    })).toThrow("viewport")
    first.dispose()
    expect(runtime.worldIds).toEqual([])
    runtime.dispose()
  })

  test("routes camera-locked DOM overlays before world planes in the same Engine frame", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      harness.options,
      harness.seams,
    )
    const plane = runtime.addPlane(harness.registration("world"))
    const overlayRegistrationValue = harness.overlayRegistration("hud")
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
      ...harness.options,
      cameraGestures: true,
    }, harness.seams)
    runtime.addPlane(harness.registration("world"))
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
      harness.options,
      harness.seams,
    )
    runtime.addPlane(harness.registration("one"))
    runtime.addPlane(harness.registration("two"))
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
    expect(() => runtime.addPlane(harness.registration("late"))).toThrow("disposed")
    expect(() => runtime.render()).toThrow("disposed")
  })

  test("fails before plane allocation for duplicate ids and malformed transforms", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      harness.options,
      harness.seams,
    )
    const validRegistration = harness.registration("valid")
    runtime.addPlane(validRegistration)
    const allocations = harness.calls.planeRuntimeCreates
    const foreignRoot = createDocument().createElement("div")
    const detachedRoot = harness.document.createElement("div")
    expect(() => runtime.addPlane({
      id: "foreign",
      root: foreignRoot,
      viewport: {width: 10, height: 10},
      worldUnitsPerPixel: 1,
    })).toThrow("another Document")
    expect(() => runtime.addOverlay({id: "foreign-overlay", root: foreignRoot}))
      .toThrow("another Document")
    expect(() => runtime.addPlane({
      id: "detached",
      root: detachedRoot,
      viewport: {width: 10, height: 10},
      worldUnitsPerPixel: 1,
    })).toThrow("connected Experience tree")
    expect(() => runtime.addOverlay({id: "detached-overlay", root: detachedRoot}))
      .toThrow("connected Experience tree")
    expect(harness.calls.planeRuntimeCreates).toBe(allocations)
    expect(harness.calls.overlayRuntimeCreates).toBe(0)
    expect(() => runtime.addOverlay({id: "duplicate-root", root: validRegistration.root}))
      .toThrow("root is already registered")
    expect(harness.calls.overlayRuntimeCreates).toBe(0)
    const nestedRoot = harness.document.createElement("div")
    validRegistration.root.appendChild(nestedRoot)
    expect(() => runtime.addOverlay({id: "overlapping-root", root: nestedRoot}))
      .toThrow("overlaps owner")
    expect(harness.calls.overlayRuntimeCreates).toBe(0)
    expect(() => runtime.addPlane({
      ...harness.registration("valid"),
      transform: {scale: {x: 0, y: 1, z: 1}},
    })).toThrow("already registered")
    expect(harness.calls.planeRuntimeCreates).toBe(allocations)
    expect(() => runtime.addOverlay({...harness.overlayRegistration("valid")})).toThrow("already registered")
    expect(harness.calls.overlayRuntimeCreates).toBe(0)
    expect(() => runtime.addPlane({
      ...harness.registration("invalid"),
      transform: {scale: {x: 0, y: 1, z: 1}},
    })).toThrow("scale")
    expect(harness.calls.planeRuntimeCreates).toBe(allocations)
    expect(() => runtime.updatePlane("missing", {})).toThrow("Unknown")
    expect(() => runtime.restoreViewPoint(snapshot({position: {x: 0, y: 0, z: 0}})))
      .toThrow("must differ")
    runtime.dispose()
  })

  test("reparents one focused Element from display to display to HUD in one Experience", async () => {
    const harness = createHarness()
    const runtime = await createDocumentSpaceRuntimeWithSeams(
      harness.options,
      Object.freeze({
        ...harness.seams,
        createPlaneRuntime: createDocumentPlaneRuntime,
        createOverlayRuntime: createDocumentOverlayRuntime,
      }),
    )
    const displayARegistration = harness.registration("display-a")
    const displayBRegistration = harness.registration("display-b")
    const hudRegistration = harness.overlayRegistration("hud")
    const button = harness.document.createElement("button")
    const identity = button
    let clicks = 0
    button.append("Move me")
    button.setAttribute("style", "width:80px; height:24px; background:#112233")
    button.addEventListener("click", () => { clicks += 1 })
    displayARegistration.root.appendChild(button)
    button.focus()

    const displayA = runtime.addPlane(displayARegistration)
    const displayB = runtime.addPlane(displayBRegistration)
    const hud = runtime.addOverlay(hudRegistration)
    runtime.render()

    expect(displayA.interactionState).toBe(runtime.interactionState)
    expect(displayB.interactionState).toBe(runtime.interactionState)
    expect(hud.interactionState).toBe(runtime.interactionState)
    expect(displayA.frame.boxByNode.has(button)).toBeTrue()
    expect(displayB.frame.boxByNode.has(button)).toBeFalse()
    expect(hud.frame.boxByNode.has(button)).toBeFalse()

    displayBRegistration.root.appendChild(button)
    runtime.render()
    button.click()
    expect(button).toBe(identity)
    expect(button.ownerDocument).toBe(harness.document)
    expect(harness.document.activeElement).toBe(button)
    expect(clicks).toBe(1)
    expect(displayA.frame.boxByNode.has(button)).toBeFalse()
    expect(displayB.frame.boxByNode.has(button)).toBeTrue()
    expect(hud.frame.boxByNode.has(button)).toBeFalse()

    hudRegistration.root.appendChild(button)
    runtime.render()
    button.click()
    expect(button).toBe(identity)
    expect(button.ownerDocument).toBe(harness.document)
    expect(harness.document.activeElement).toBe(button)
    expect(clicks).toBe(2)
    expect(displayA.frame.boxByNode.has(button)).toBeFalse()
    expect(displayB.frame.boxByNode.has(button)).toBeFalse()
    expect(hud.frame.boxByNode.has(button)).toBeTrue()
    runtime.dispose()
  })

  test("claims one Space host and releases or rolls it back exactly", async () => {
    const harness = createHarness()
    await expect(createDocumentSpaceRuntimeWithSeams(harness.options, Object.freeze({
      ...harness.seams,
      async initializeEngineRenderer() { throw new Error("space init failed") },
    }))).rejects.toThrow("space init failed")

    const runtime = await createDocumentSpaceRuntimeWithSeams(harness.options, harness.seams)
    const initialized = harness.calls.initializes
    await expect(createDocumentSpaceRuntimeWithSeams(harness.options, harness.seams))
      .rejects.toThrow("canvas already owns")
    expect(harness.calls.initializes).toBe(initialized)

    runtime.dispose()
    const replacement = await createDocumentSpaceRuntimeWithSeams(harness.options, harness.seams)
    replacement.dispose()
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
  const document = createDocument()
  const experience = document.createElement("div")
  document.appendChild(experience)
  const font = fakeFont()
  const calls = {
    initializes: 0,
    engineFrames: 0,
    pixelRatios: [] as number[],
    sizes: [] as Array<readonly [number, number]>,
    aspects: [] as number[],
    viewports: [] as Array<Readonly<{left: number; top: number; width: number; height: number}>>,
    compositions: [] as unknown[],
    worldViewPoints: [] as ViewPoint[],
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
    renderComposition(composition: unknown) {
      calls.engineFrames += 1
      calls.compositions.push(composition)
    },
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
    createWorldViewPoint(initial, viewport) {
      const worldViewPoint = fakeViewPoint(calls)
      worldViewPoint.position.set(initial.position.x, initial.position.y, initial.position.z)
      worldViewPoint.getTarget().set(initial.target.x, initial.target.y, initial.target.z)
      worldViewPoint.getUp().set(initial.up.x, initial.up.y, initial.up.z)
      worldViewPoint.fov = initial.fov
      worldViewPoint.near = initial.near
      worldViewPoint.far = initial.far
      worldViewPoint.setViewport({
        left: viewport.x,
        top: viewport.y,
        width: viewport.width,
        height: viewport.height,
      })
      calls.worldViewPoints.push(worldViewPoint)
      return worldViewPoint
    },
    createRaycaster: () => raycaster,
    createNativeInputHost: () => nativeHost.host,
    createPlaneRuntime(options) {
      calls.planeRuntimeCreates += 1
      const id = (options.root as {getAttribute?(name: string): string | null})
        .getAttribute?.("data-plane-id")
      if (id === undefined || id === null) throw new Error("Fixture plane id is absent")
      if ((options.root as {hasAttribute?(name: string): boolean})
        .hasAttribute?.("data-actual-plane-runtime")) {
        return createDocumentPlaneRuntime(options)
      }
      const runtime = new FakePlaneRuntime(options)
      planes.set(id, runtime)
      return runtime.runtime
    },
    createOverlayRuntime(options) {
      calls.overlayRuntimeCreates += 1
      const id = (options.root as {getAttribute?(name: string): string | null})
        .getAttribute?.("data-overlay-id")
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
    document,
    experience,
    font,
    options: Object.freeze({
      canvas: canvas.element,
      document,
      styleSheets: Object.freeze([]),
      font,
    }),
    calls,
    capture,
    nativeHost,
    seams,
    registration: (id: string) => registration(document, experience, id),
    overlayRegistration: (id: string) => overlayRegistration(document, experience, id),
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
      interactionState: options.interactionState!,
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
  viewports: Array<Readonly<{left: number; top: number; width: number; height: number}>>
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
    setViewport(value: Readonly<{left: number; top: number; width: number; height: number}>) {
      calls.viewports.push(value)
      calls.aspects.push(value.width / value.height)
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

function registration(
  document: ReturnType<typeof createDocument>,
  experience: SemanticNode,
  id: string,
) {
  const root = document.createElement("div")
  root.setAttribute("data-plane-id", id)
  root.setAttribute("style", "width: 100px; height: 100px")
  experience.appendChild(root)
  return {
    id,
    root,
    viewport: {width: 100, height: 100},
    worldUnitsPerPixel: 0.02,
  } as const
}

function overlayRegistration(
  document: ReturnType<typeof createDocument>,
  experience: SemanticNode,
  id: string,
) {
  const root = document.createElement("button")
  root.setAttribute("data-overlay-id", id)
  root.setAttribute("style", "width: 100px; height: 100px")
  root.append("Overlay")
  experience.appendChild(root)
  return {
    id,
    root,
  } as const
}

function nestedControl(document: ReturnType<typeof createDocument>) {
  const button = document.createElement("button")
  const left = document.createElement("span")
  const right = document.createElement("span")
  const icon = document.createElement("img")
  button.setAttribute("style", "display:flex; width:100px; height:100px; padding:0")
  left.setAttribute("style", "display:block; width:50px; height:100px")
  right.setAttribute("style", "display:block; width:50px; height:100px")
  icon.setAttribute("style", "display:block; width:40px; height:40px")
  left.appendChild(icon)
  right.append("Label")
  button.append(left, right)
  return {button, icon, left, right}
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

function mouse(values: Partial<MouseEvent> = {}): MouseEvent {
  return {
    clientX: 0,
    clientY: 0,
    cancelable: true,
    preventDefault() {},
    ...values,
  } as MouseEvent
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
    ascent: 800,
    descent: 200,
    mapCharToGlyph: () => 0,
    getGlyphOutline: () => ({
      points: new Float32Array(),
      onCurve: new Uint8Array(),
      contours: new Uint16Array(),
    }),
    getHMetric: () => ({advanceWidth: 500, lsb: 0}),
  } as unknown as TrueTypeFont
}
