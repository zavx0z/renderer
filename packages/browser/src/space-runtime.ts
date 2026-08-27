import {
  Raycaster,
  Renderer as EngineRenderer,
  Space,
  ViewPoint,
  type TrueTypeFont,
} from "@engine/core"
import type {
  Document,
  Element as DomElement,
  Node,
} from "@zavx0z/dom"
import {
  hitTest,
  type HitMetadata,
  type PointerInput,
  type RenderFrame,
  type RenderViewport,
  type WheelInput,
} from "@zavx0z/renderer"
import type {
  RendererWebGpuDocumentPlaneIntersection,
} from "@zavx0z/renderer-webgpu"
import {
  createDocumentPlaneRuntime,
  type CreateDocumentPlaneRuntimeOptions,
  type DocumentPlaneRuntime,
} from "./plane-runtime.ts"
import {
  createDocumentOverlayRuntime,
  type CreateDocumentOverlayRuntimeOptions,
  type DocumentOverlayRuntime,
} from "./overlay-runtime.ts"
import {
  createDocumentNativeInputHost,
  type DocumentNativeInputHost,
  type DocumentNativeInputTarget,
} from "./native-input-host.ts"

export type DocumentSpaceVector3 = Readonly<{x: number; y: number; z: number}>
export type DocumentSpaceQuaternion = Readonly<{x: number; y: number; z: number; w: number}>

export type DocumentSpaceViewPointSnapshot = Readonly<{
  position: DocumentSpaceVector3
  target: DocumentSpaceVector3
  up: DocumentSpaceVector3
  fov: number
  near: number
  far: number
}>

export type DocumentSpacePlaneTransform = Readonly<{
  position?: DocumentSpaceVector3
  quaternion?: DocumentSpaceQuaternion
  scale?: DocumentSpaceVector3
  visible?: boolean
}>

export type DocumentSpacePlaneRegistration = Readonly<{
  id: string
  document: Document
  root: Node
  styleSheets: readonly string[]
  font: TrueTypeFont
  viewport: RenderViewport
  worldUnitsPerPixel: number
  transform?: DocumentSpacePlaneTransform
  tooltipDelayMs?: number
}>

export type DocumentSpacePlaneUpdate = Readonly<{
  viewport?: RenderViewport
  worldUnitsPerPixel?: number
  transform?: DocumentSpacePlaneTransform
}>

export type DocumentSpaceOverlayRegistration = Readonly<{
  id: string
  document: Document
  root: Node
  styleSheets: readonly string[]
  font: TrueTypeFont
  distance?: number
  tooltipDelayMs?: number
}>

export type CreateDocumentSpaceRuntimeOptions = Readonly<{
  canvas: HTMLCanvasElement
  pixelRatio?: number
  viewPoint?: DocumentSpaceViewPointSnapshot
  cameraGestures?: boolean
}>

export type DocumentSpaceRuntime = Readonly<{
  canvas: HTMLCanvasElement
  engineRenderer: EngineRenderer
  space: Space
  viewPoint: ViewPoint
  raycaster: Raycaster
  nativeInputHost: DocumentNativeInputHost
  nativeInput: HTMLInputElement
  nativeTextArea: HTMLTextAreaElement
  inputTarget: DocumentNativeInputTarget | null
  activeInputPlaneId: string | null
  planeIds: readonly string[]
  overlayIds: readonly string[]
  activePlaneId: string | null
  hoveredPlaneId: string | null
  activeOverlayId: string | null
  hoveredOverlayId: string | null
  cameraGesturesEnabled: boolean
  presentedFrames: number
  disposed: boolean
  addPlane(registration: DocumentSpacePlaneRegistration): DocumentPlaneRuntime
  getPlane(id: string): DocumentPlaneRuntime | undefined
  updatePlane(id: string, update: DocumentSpacePlaneUpdate): DocumentPlaneRuntime
  removePlane(id: string): boolean
  addOverlay(registration: DocumentSpaceOverlayRegistration): DocumentOverlayRuntime
  getOverlay(id: string): DocumentOverlayRuntime | undefined
  removeOverlay(id: string): boolean
  render(): void
  requestRender(): void
  resize(): void
  captureLastPresentedFramePng(): Promise<Blob | null>
  snapshotViewPoint(): DocumentSpaceViewPointSnapshot
  restoreViewPoint(snapshot: DocumentSpaceViewPointSnapshot): void
  setCameraGesturesEnabled(enabled: boolean): void
  dispose(): void
}>

type ResizeObserverOwner = Readonly<{
  observe(target: Element): void
  disconnect(): void
}>

type CanvasRect = Readonly<{
  left: number
  top: number
  width: number
  height: number
}>

/** Internal platform seams for GPU-independent multi-plane tests. */
export type DocumentSpaceRuntimeSeams = Readonly<{
  createEngineRenderer(): EngineRenderer
  initializeEngineRenderer(renderer: EngineRenderer, canvas: HTMLCanvasElement): Promise<void>
  createSpace(): Space
  createViewPoint(canvas: HTMLCanvasElement, snapshot: DocumentSpaceViewPointSnapshot): ViewPoint
  createRaycaster(): Raycaster
  createNativeInputHost(options: Readonly<{requestFrame(): void}>): DocumentNativeInputHost
  createPlaneRuntime(options: CreateDocumentPlaneRuntimeOptions): DocumentPlaneRuntime
  createOverlayRuntime(options: CreateDocumentOverlayRuntimeOptions): DocumentOverlayRuntime
  createResizeObserver(callback: () => void): ResizeObserverOwner
  readCanvasRect(canvas: HTMLCanvasElement): CanvasRect
  devicePixelRatio(): number
  requestFrame(callback: () => void): unknown
  cancelFrame(handle: unknown): void
  setTimer(callback: () => void, delayMs: number): unknown
  clearTimer(handle: unknown): void
  now(): number
}>

type PlaneRecord = {
  id: string
  runtime: DocumentPlaneRuntime
  order: number
  dirty: boolean
  tooltipDelayMs: number
}

type OverlayRecord = {
  id: string
  runtime: DocumentOverlayRuntime
  order: number
  dirty: boolean
  tooltipDelayMs: number
}

type CapturedPlanePointer = {
  kind: "plane"
  planeId: string
  input: PointerInput
}

type CapturedOverlayPointer = {
  kind: "overlay"
  overlayId: string
  input: PointerInput
}

type CapturedCameraPointer = {
  kind: "camera"
  mode: "orbit" | "pan"
  clientX: number
  clientY: number
}

type CapturedPointer = CapturedPlanePointer | CapturedOverlayPointer | CapturedCameraPointer

type PlaneHit = Readonly<{
  record: PlaneRecord
  intersection: RendererWebGpuDocumentPlaneIntersection
}>

type OverlayHit = Readonly<{
  record: OverlayRecord
  point: Readonly<{x: number; y: number}>
  hit: HitMetadata
}>

const DEFAULT_VIEW_POINT = Object.freeze({
  position: Object.freeze({x: 0, y: 0, z: 1_000}),
  target: Object.freeze({x: 0, y: 0, z: 0}),
  up: Object.freeze({x: 0, y: 1, z: 0}),
  fov: Math.PI / 4,
  near: 0.1,
  far: 5_000,
}) satisfies DocumentSpaceViewPointSnapshot

const defaultSeams = (): DocumentSpaceRuntimeSeams => Object.freeze({
  createEngineRenderer: () => new EngineRenderer(),
  initializeEngineRenderer: (renderer, canvas) => renderer.init(canvas),
  createSpace: () => new Space(),
  createViewPoint(canvas, snapshot) {
    const viewPoint = new ViewPoint({
      element: canvas,
      fov: snapshot.fov,
      near: snapshot.near,
      far: snapshot.far,
      position: snapshot.position,
      target: snapshot.target,
    })
    viewPoint.getUp().set(snapshot.up.x, snapshot.up.y, snapshot.up.z)
    viewPoint.update()
    viewPoint.dispose()
    return viewPoint
  },
  createRaycaster: () => new Raycaster(),
  createNativeInputHost: (options) => createDocumentNativeInputHost(options),
  createPlaneRuntime: createDocumentPlaneRuntime,
  createOverlayRuntime: createDocumentOverlayRuntime,
  createResizeObserver(callback) {
    if (typeof ResizeObserver !== "function") throw new Error("ResizeObserver is unavailable")
    return new ResizeObserver(callback)
  },
  readCanvasRect(canvas) {
    const rect = canvas.getBoundingClientRect()
    return {left: rect.left, top: rect.top, width: rect.width, height: rect.height}
  },
  devicePixelRatio: () => globalThis.devicePixelRatio,
  requestFrame(callback) {
    if (typeof requestAnimationFrame !== "function") {
      throw new Error("requestAnimationFrame is unavailable")
    }
    return requestAnimationFrame(callback)
  },
  cancelFrame(handle) {
    if (typeof cancelAnimationFrame === "function" && typeof handle === "number") {
      cancelAnimationFrame(handle)
    }
  },
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => performance.now(),
})

/** Creates one canvas host for independently owned world-space DOM planes. */
export async function createDocumentSpaceRuntime(
  options: CreateDocumentSpaceRuntimeOptions,
): Promise<DocumentSpaceRuntime> {
  return createDocumentSpaceRuntimeWithSeams(options, defaultSeams())
}

/** Internal exact-seam constructor for lifecycle and input tests. */
export async function createDocumentSpaceRuntimeWithSeams(
  options: CreateDocumentSpaceRuntimeOptions,
  seams: DocumentSpaceRuntimeSeams,
): Promise<DocumentSpaceRuntime> {
  validateOptions(options)
  validateSeams(seams)
  const fixedPixelRatio = options.pixelRatio === undefined
    ? null
    : finitePositive(options.pixelRatio, "pixelRatio")
  const initialViewPoint = validateViewPointSnapshot(options.viewPoint ?? DEFAULT_VIEW_POINT)
  const engineRenderer = seams.createEngineRenderer()
  await seams.initializeEngineRenderer(engineRenderer, options.canvas)
  const space = seams.createSpace()
  const viewPoint = seams.createViewPoint(options.canvas, initialViewPoint)
  const raycaster = seams.createRaycaster()
  const records = new Map<string, PlaneRecord>()
  const overlays = new Map<string, OverlayRecord>()
  const captures = new Map<number, CapturedPointer>()
  let nextPlaneOrder = 0
  let nextOverlayOrder = 0
  let hoveredPlaneId: string | null = null
  let activePlaneId: string | null = null
  let hoveredOverlayId: string | null = null
  let activeOverlayId: string | null = null
  let canvasViewport: RenderViewport = Object.freeze({width: 1, height: 1})
  let cameraGesturesEnabled = options.cameraGestures === true
  let presentedFrames = 0
  let requestedFrame: unknown | null = null
  let tooltipTimer: unknown | null = null
  let tooltipOwner: Readonly<{kind: "plane" | "overlay"; id: string}> | null = null
  let resizeObserver: ResizeObserverOwner | null = null
  let rendering = false
  let renderRequestedDuringFrame = false
  let disposed = false

  const requestRender = (): void => {
    assertActive(disposed)
    if (rendering) {
      renderRequestedDuringFrame = true
      return
    }
    if (requestedFrame !== null) return
    requestedFrame = seams.requestFrame(() => {
      requestedFrame = null
      if (!disposed) render()
    })
  }

  const cancelTooltipFrame = (
    owner?: Readonly<{kind: "plane" | "overlay"; id: string}>,
  ): void => {
    if (
      owner !== undefined &&
      (tooltipOwner?.kind !== owner.kind || tooltipOwner.id !== owner.id)
    ) return
    if (tooltipTimer !== null) seams.clearTimer(tooltipTimer)
    tooltipTimer = null
    tooltipOwner = null
  }

  const scheduleTooltipFrame = (
    owner: Readonly<{kind: "plane" | "overlay"; id: string}>,
    delayMs: number,
  ): void => {
    cancelTooltipFrame()
    tooltipOwner = owner
    tooltipTimer = seams.setTimer(() => {
      tooltipTimer = null
      const current = tooltipOwner
      tooltipOwner = null
      if (disposed || current === null) return
      const stillHovered = current.kind === "plane"
        ? hoveredPlaneId === current.id
        : hoveredOverlayId === current.id
      if (!stillHovered) return
      const record = current.kind === "plane"
        ? records.get(current.id)
        : overlays.get(current.id)
      if (record === undefined) return
      record.dirty = true
      requestRender()
    }, delayMs + 1)
  }

  let nativeInputHost: DocumentNativeInputHost
  try {
    nativeInputHost = seams.createNativeInputHost({
      requestFrame() {
        if (!disposed) requestRender()
      },
    })
  } catch (error) {
    viewPoint.dispose()
    throw error
  }

  const render = (): void => {
    assertActive(disposed)
    if (rendering) throw new Error("Document space render is already in progress")
    if (requestedFrame !== null) {
      seams.cancelFrame(requestedFrame)
      requestedFrame = null
    }
    rendering = true
    renderRequestedDuringFrame = false
    try {
      for (const record of records.values()) {
        if (!record.dirty) continue
        record.dirty = false
        record.runtime.flush()
      }
      for (const record of overlays.values()) {
        if (!record.dirty) continue
        record.dirty = false
        record.runtime.flush()
      }
      viewPoint.update()
      for (const record of overlays.values()) record.runtime.updateForViewPoint(viewPoint)
      space.updateWorldMatrix(true)
      engineRenderer.renderFrame(space, viewPoint)
      presentedFrames += 1
    } finally {
      rendering = false
    }
    if (
      renderRequestedDuringFrame ||
      [...records.values()].some(({dirty}) => dirty) ||
      [...overlays.values()].some(({dirty}) => dirty)
    ) {
      requestRender()
    }
  }

  const planeIds = (): readonly string[] => Object.freeze([...records.keys()])
  const overlayIds = (): readonly string[] => Object.freeze([...overlays.keys()])

  const getPlane = (id: string): DocumentPlaneRuntime | undefined =>
    records.get(validatePlaneId(id))?.runtime

  const addPlane = (registration: DocumentSpacePlaneRegistration): DocumentPlaneRuntime => {
    assertActive(disposed)
    const id = validatePlaneId(registration?.id)
    if (records.has(id) || overlays.has(id)) {
      throw new Error(`Document space owner id is already registered: ${id}`)
    }
    const transform = validateTransform(registration.transform)
    const tooltipDelayMs = finiteNonNegative(registration.tooltipDelayMs ?? 500, "tooltipDelayMs")
    let record: PlaneRecord | null = null
    let requestedBeforeRegistration = false
    const runtime = seams.createPlaneRuntime({
      document: registration.document,
      root: registration.root,
      styleSheets: registration.styleSheets,
      font: registration.font,
      viewport: registration.viewport,
      worldUnitsPerPixel: registration.worldUnitsPerPixel,
      tooltipDelayMs,
      invalidateGeometry: (geometry) => engineRenderer.invalidateGeometry(geometry),
      requestFrame() {
        if (disposed) return
        if (nativeInputHost.document === registration.document) nativeInputHost.synchronize()
        if (record === null) requestedBeforeRegistration = true
        else record.dirty = true
        requestRender()
      },
      requestPresentation() {
        if (!disposed && !rendering) requestRender()
      },
    })
    try {
      applyTransform(runtime, transform)
    } catch (error) {
      runtime.dispose()
      throw error
    }
    record = {
      id,
      runtime,
      order: nextPlaneOrder++,
      dirty: requestedBeforeRegistration,
      tooltipDelayMs,
    }
    records.set(id, record)
    space.add(runtime.plane)
    requestRender()
    return runtime
  }

  const updatePlane = (
    idValue: string,
    update: DocumentSpacePlaneUpdate,
  ): DocumentPlaneRuntime => {
    assertActive(disposed)
    const id = validatePlaneId(idValue)
    const record = records.get(id)
    if (record === undefined) throw new Error(`Unknown document space plane id: ${id}`)
    if (update === null || typeof update !== "object") throw new TypeError("Plane update is required")
    const transform = update.transform === undefined ? null : validateTransform(update.transform)
    const viewport = update.viewport ?? record.runtime.viewport
    const worldUnitsPerPixel = update.worldUnitsPerPixel ?? record.runtime.worldUnitsPerPixel
    if (update.viewport !== undefined || update.worldUnitsPerPixel !== undefined) {
      record.runtime.resize(viewport, worldUnitsPerPixel)
    }
    if (transform !== null) applyTransform(record.runtime, transform)
    if (record.runtime.plane.visible === false) {
      if (hoveredPlaneId === id) clearHoveredPlane(null)
      cancelCapturedPlane(id)
      if (nativeInputHost.ownerId === id) nativeInputHost.setActiveDocument(null)
    }
    requestRender()
    return record.runtime
  }

  const removePlane = (idValue: string): boolean => {
    assertActive(disposed)
    const id = validatePlaneId(idValue)
    const record = records.get(id)
    if (record === undefined) return false
    cancelTooltipFrame({kind: "plane", id})
    cancelCapturedPlane(id)
    if (hoveredPlaneId === id) hoveredPlaneId = null
    if (nativeInputHost.ownerId === id) nativeInputHost.setActiveDocument(null)
    space.remove(record.runtime.plane)
    records.delete(id)
    record.runtime.dispose()
    requestRender()
    return true
  }

  const getOverlay = (id: string): DocumentOverlayRuntime | undefined =>
    overlays.get(validatePlaneId(id))?.runtime

  const addOverlay = (
    registration: DocumentSpaceOverlayRegistration,
  ): DocumentOverlayRuntime => {
    assertActive(disposed)
    const id = validatePlaneId(registration?.id)
    if (records.has(id) || overlays.has(id)) {
      throw new Error(`Document space owner id is already registered: ${id}`)
    }
    const tooltipDelayMs = finiteNonNegative(registration.tooltipDelayMs ?? 500, "tooltipDelayMs")
    let record: OverlayRecord | null = null
    let requestedBeforeRegistration = false
    const runtime = seams.createOverlayRuntime({
      document: registration.document,
      root: registration.root,
      styleSheets: registration.styleSheets,
      font: registration.font,
      viewport: canvasViewport,
      ...(registration.distance === undefined ? {} : {distance: registration.distance}),
      tooltipDelayMs,
      invalidateGeometry: (geometry) => engineRenderer.invalidateGeometry(geometry),
      requestFrame() {
        if (disposed) return
        if (nativeInputHost.document === registration.document) nativeInputHost.synchronize()
        if (record === null) requestedBeforeRegistration = true
        else record.dirty = true
        requestRender()
      },
      requestPresentation() {
        if (!disposed && !rendering) requestRender()
      },
    })
    record = {
      id,
      runtime,
      order: nextOverlayOrder++,
      dirty: requestedBeforeRegistration,
      tooltipDelayMs,
    }
    overlays.set(id, record)
    space.add(runtime.overlay)
    requestRender()
    return runtime
  }

  const removeOverlay = (idValue: string): boolean => {
    assertActive(disposed)
    const id = validatePlaneId(idValue)
    const record = overlays.get(id)
    if (record === undefined) return false
    cancelTooltipFrame({kind: "overlay", id})
    cancelCapturedOverlay(id)
    if (hoveredOverlayId === id) hoveredOverlayId = null
    if (nativeInputHost.ownerId === id) nativeInputHost.setActiveDocument(null)
    space.remove(record.runtime.overlay)
    overlays.delete(id)
    record.runtime.dispose()
    requestRender()
    return true
  }

  const snapshotViewPoint = (): DocumentSpaceViewPointSnapshot => {
    assertActive(disposed)
    viewPoint.update()
    return viewPointSnapshot(viewPoint)
  }

  const restoreViewPoint = (snapshot: DocumentSpaceViewPointSnapshot): void => {
    assertActive(disposed)
    applyViewPointSnapshot(viewPoint, validateViewPointSnapshot(snapshot))
    requestRender()
  }

  const resize = (): void => {
    assertActive(disposed)
    const rect = seams.readCanvasRect(options.canvas)
    const width = positiveExtent(rect.width)
    const height = positiveExtent(rect.height)
    const nextViewport = Object.freeze({width, height})
    const pixelRatio = fixedPixelRatio ?? finitePositiveOrOne(seams.devicePixelRatio())
    engineRenderer.setPixelRatio(pixelRatio)
    engineRenderer.setSize(width, height)
    viewPoint.setAspectRatio(width / height)
    if (
      canvasViewport.width !== nextViewport.width ||
      canvasViewport.height !== nextViewport.height
    ) {
      canvasViewport = nextViewport
      for (const record of overlays.values()) {
        record.runtime.resize(canvasViewport)
        record.dirty = false
      }
    }
    requestRender()
  }

  const localPointerInput = (
    event: PointerEvent,
    point: Readonly<{x: number; y: number}>,
  ): PointerInput => Object.freeze({
    clientX: point.x,
    clientY: point.y,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    button: event.button,
    buttons: event.buttons,
    pressure: event.pressure,
    isPrimary: event.isPrimary,
    timeStamp: event.timeStamp,
  })

  const localWheelInput = (
    event: WheelEvent,
    point: Readonly<{x: number; y: number}>,
  ): WheelInput => Object.freeze({
    clientX: point.x,
    clientY: point.y,
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaZ: event.deltaZ,
    deltaMode: event.deltaMode,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  })

  const overlayPoint = (
    clientX: number,
    clientY: number,
  ): Readonly<{x: number; y: number}> | null => {
    const rect = seams.readCanvasRect(options.canvas)
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
      return null
    }
    return Object.freeze({
      x: (clientX - rect.left) * canvasViewport.width / rect.width,
      y: (clientY - rect.top) * canvasViewport.height / rect.height,
    })
  }

  const pickOverlay = (clientX: number, clientY: number): OverlayHit | null => {
    const point = overlayPoint(clientX, clientY)
    if (point === null) return null
    const ordered = [...overlays.values()].sort((left, right) => right.order - left.order)
    for (const record of ordered) {
      if (!record.runtime.overlay.visible || !record.runtime.overlay.content.visible) continue
      const hit = hitTest(record.runtime.renderer.flush(), point.x, point.y)
      if (hit !== null) return Object.freeze({record, point, hit})
    }
    return null
  }

  const prepareRay = (clientX: number, clientY: number): boolean => {
    const rect = seams.readCanvasRect(options.canvas)
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
      return false
    }
    viewPoint.update()
    space.updateWorldMatrix(true)
    raycaster.setFromCamera({
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: 1 - ((clientY - rect.top) / rect.height) * 2,
    }, viewPoint)
    return true
  }

  const pickPlane = (clientX: number, clientY: number): PlaneHit | null => {
    if (!prepareRay(clientX, clientY)) return null
    let best: PlaneHit | null = null
    for (const record of records.values()) {
      if (!record.runtime.plane.visible || !record.runtime.plane.content.visible) continue
      const intersection = record.runtime.plane.intersectRay(raycaster.ray)
      if (intersection === null || !intersection.inside) continue
      if (
        best === null ||
        intersection.distance < best.intersection.distance ||
        (intersection.distance === best.intersection.distance && record.order < best.record.order)
      ) best = Object.freeze({record, intersection})
    }
    return best
  }

  const intersectRecord = (
    record: PlaneRecord,
    clientX: number,
    clientY: number,
  ): RendererWebGpuDocumentPlaneIntersection | null => {
    if (!prepareRay(clientX, clientY)) return null
    return record.runtime.plane.intersectRay(raycaster.ray)
  }

  const clearHoveredPlane = (event: PointerEvent | null): void => {
    if (hoveredPlaneId === null) return
    const previous = records.get(hoveredPlaneId)
    cancelTooltipFrame({kind: "plane", id: hoveredPlaneId})
    hoveredPlaneId = null
    if (previous === undefined) return
    previous.runtime.pointerMove(Object.freeze({
      clientX: -1,
      clientY: -1,
      pointerId: event?.pointerId ?? 0,
      pointerType: event?.pointerType ?? "mouse",
      button: event?.button ?? 0,
      buttons: event?.buttons ?? 0,
      pressure: event?.pressure ?? 0,
      isPrimary: event?.isPrimary ?? true,
      timeStamp: event?.timeStamp ?? seams.now(),
    }))
  }

  const clearHoveredOverlay = (event: PointerEvent | null): void => {
    if (hoveredOverlayId === null) return
    const previous = overlays.get(hoveredOverlayId)
    cancelTooltipFrame({kind: "overlay", id: hoveredOverlayId})
    hoveredOverlayId = null
    if (previous === undefined) return
    previous.runtime.pointerMove(Object.freeze({
      clientX: -1,
      clientY: -1,
      pointerId: event?.pointerId ?? 0,
      pointerType: event?.pointerType ?? "mouse",
      button: event?.button ?? 0,
      buttons: event?.buttons ?? 0,
      pressure: event?.pressure ?? 0,
      isPrimary: event?.isPrimary ?? true,
      timeStamp: event?.timeStamp ?? seams.now(),
    }))
  }

  const refreshActiveOwners = (): void => {
    const last = [...captures.values()].at(-1)
    activePlaneId = last?.kind === "plane" ? last.planeId : null
    activeOverlayId = last?.kind === "overlay" ? last.overlayId : null
  }

  const releasePointer = (pointerId: number): void => {
    if (options.canvas.hasPointerCapture?.(pointerId)) options.canvas.releasePointerCapture(pointerId)
    captures.delete(pointerId)
    refreshActiveOwners()
  }

  const cancelCapturedPointer = (pointerId: number): void => {
    const capture = captures.get(pointerId)
    if (capture === undefined) return
    if (capture.kind === "plane") {
      records.get(capture.planeId)?.runtime.pointerCancel(capture.input)
    } else if (capture.kind === "overlay") {
      overlays.get(capture.overlayId)?.runtime.pointerCancel(capture.input)
    }
    releasePointer(pointerId)
  }

  function cancelCapturedPlane(id: string): void {
    for (const [pointerId, capture] of [...captures]) {
      if (capture.kind === "plane" && capture.planeId === id) cancelCapturedPointer(pointerId)
    }
  }

  function cancelCapturedOverlay(id: string): void {
    for (const [pointerId, capture] of [...captures]) {
      if (capture.kind === "overlay" && capture.overlayId === id) cancelCapturedPointer(pointerId)
    }
  }

  const setCameraGesturesEnabled = (enabled: boolean): void => {
    assertActive(disposed)
    if (typeof enabled !== "boolean") throw new TypeError("Camera gesture state must be boolean")
    if (cameraGesturesEnabled === enabled) return
    cameraGesturesEnabled = enabled
    if (enabled) return
    for (const [pointerId, capture] of [...captures]) {
      if (capture.kind === "camera") releasePointer(pointerId)
    }
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (disposed) return
    const capture = captures.get(event.pointerId)
    if (capture !== undefined) {
      if (capture.kind === "camera") {
        const deltaX = event.clientX - capture.clientX
        const deltaY = event.clientY - capture.clientY
        capture.clientX = event.clientX
        capture.clientY = event.clientY
        if (capture.mode === "orbit") viewPoint.orbit(deltaX, deltaY)
        else viewPoint.pan(deltaX, deltaY)
        if (event.cancelable) event.preventDefault()
        requestRender()
        return
      }
      if (capture.kind === "overlay") {
        const record = overlays.get(capture.overlayId)
        const point = overlayPoint(event.clientX, event.clientY)
        if (record === undefined || point === null) {
          cancelCapturedPointer(event.pointerId)
          return
        }
        const input = localPointerInput(event, point)
        capture.input = input
        record.runtime.pointerMove(input)
        hoveredOverlayId = record.id
        activeOverlayId = record.id
        scheduleTooltipFrame({kind: "overlay", id: record.id}, record.tooltipDelayMs)
        return
      }
      const record = records.get(capture.planeId)
      if (record === undefined) {
        releasePointer(event.pointerId)
        return
      }
      const intersection = intersectRecord(record, event.clientX, event.clientY)
      if (intersection === null) {
        record.runtime.pointerCancel(capture.input)
        releasePointer(event.pointerId)
        if (hoveredPlaneId === record.id) hoveredPlaneId = null
        return
      }
      const input = localPointerInput(event, intersection.documentPoint)
      capture.input = input
      record.runtime.pointerMove(input)
      hoveredPlaneId = record.id
      activePlaneId = record.id
      scheduleTooltipFrame({kind: "plane", id: record.id}, record.tooltipDelayMs)
      return
    }
    const overlayHit = pickOverlay(event.clientX, event.clientY)
    if (overlayHit?.record.id !== hoveredOverlayId) clearHoveredOverlay(event)
    if (overlayHit !== null) {
      clearHoveredPlane(event)
      hoveredOverlayId = overlayHit.record.id
      overlayHit.record.runtime.pointerMove(localPointerInput(event, overlayHit.point))
      scheduleTooltipFrame(
        {kind: "overlay", id: overlayHit.record.id},
        overlayHit.record.tooltipDelayMs,
      )
      return
    }
    const hit = pickPlane(event.clientX, event.clientY)
    if (hit?.record.id !== hoveredPlaneId) clearHoveredPlane(event)
    if (hit === null) return
    hoveredPlaneId = hit.record.id
    hit.record.runtime.pointerMove(localPointerInput(event, hit.intersection.documentPoint))
    scheduleTooltipFrame({kind: "plane", id: hit.record.id}, hit.record.tooltipDelayMs)
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (disposed) return
    cancelTooltipFrame()
    cancelCapturedPointer(event.pointerId)
    const overlayHit = pickOverlay(event.clientX, event.clientY)
    if (overlayHit?.record.id !== hoveredOverlayId) clearHoveredOverlay(event)
    if (overlayHit !== null) {
      clearHoveredPlane(event)
      hoveredOverlayId = overlayHit.record.id
      const input = localPointerInput(event, overlayHit.point)
      const target = overlayHit.record.runtime.pointerDown(input)
      if (target === null) {
        nativeInputHost.setActiveDocument(null)
        return
      }
      nativeInputHost.setActiveDocument(overlayHit.record.runtime.document, overlayHit.record.id)
      nativeInputHost.synchronize()
      if (event.cancelable) event.preventDefault()
      options.canvas.setPointerCapture?.(event.pointerId)
      captures.set(event.pointerId, {
        kind: "overlay",
        overlayId: overlayHit.record.id,
        input,
      })
      activeOverlayId = overlayHit.record.id
      activePlaneId = null
      return
    }
    const hit = pickPlane(event.clientX, event.clientY)
    if (hit?.record.id !== hoveredPlaneId) clearHoveredPlane(event)
    const logicalHit = !cameraGesturesEnabled || hit === null
      ? null
      : hitTest(
        hit.record.runtime.renderer.flush(),
        hit.intersection.documentPoint.x,
        hit.intersection.documentPoint.y,
      )
    const cameraMode = cameraGesturesEnabled
      ? event.button === 2
        ? "pan"
        : event.button === 0 && (logicalHit === null || !logicalHit.interactive)
          ? "orbit"
          : null
      : null
    if (cameraMode !== null) {
      clearHoveredOverlay(event)
      clearHoveredPlane(event)
      nativeInputHost.setActiveDocument(null)
      if (event.cancelable) event.preventDefault()
      options.canvas.setPointerCapture?.(event.pointerId)
      captures.set(event.pointerId, {
        kind: "camera",
        mode: cameraMode,
        clientX: event.clientX,
        clientY: event.clientY,
      })
      activePlaneId = null
      activeOverlayId = null
      return
    }
    if (hit === null) {
      nativeInputHost.setActiveDocument(null)
      return
    }
    hoveredPlaneId = hit.record.id
    const input = localPointerInput(event, hit.intersection.documentPoint)
    const target = hit.record.runtime.pointerDown(input)
    if (target === null) {
      nativeInputHost.setActiveDocument(null)
      return
    }
    nativeInputHost.setActiveDocument(hit.record.runtime.document, hit.record.id)
    nativeInputHost.synchronize()
    if (event.cancelable) event.preventDefault()
    options.canvas.setPointerCapture?.(event.pointerId)
    captures.set(event.pointerId, {kind: "plane", planeId: hit.record.id, input})
    activePlaneId = hit.record.id
    activeOverlayId = null
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (disposed) return
    const capture = captures.get(event.pointerId)
    if (capture === undefined) return
    if (capture.kind === "camera") {
      releasePointer(event.pointerId)
      return
    }
    if (capture.kind === "overlay") {
      const record = overlays.get(capture.overlayId)
      const point = overlayPoint(event.clientX, event.clientY)
      if (record === undefined || point === null) {
        cancelCapturedPointer(event.pointerId)
        return
      }
      record.runtime.pointerUp(localPointerInput(event, point))
      releasePointer(event.pointerId)
      return
    }
    const record = records.get(capture.planeId)
    if (record === undefined) {
      releasePointer(event.pointerId)
      return
    }
    const intersection = intersectRecord(record, event.clientX, event.clientY)
    if (intersection === null) record.runtime.pointerCancel(capture.input)
    else record.runtime.pointerUp(localPointerInput(event, intersection.documentPoint))
    releasePointer(event.pointerId)
  }

  const onPointerCancel = (event: PointerEvent): void => {
    if (disposed) return
    cancelCapturedPointer(event.pointerId)
  }

  const onPointerLeave = (event: PointerEvent): void => {
    if (disposed || captures.has(event.pointerId)) return
    clearHoveredOverlay(event)
    clearHoveredPlane(event)
  }

  const onWheel = (event: WheelEvent): void => {
    if (disposed) return
    const overlayHit = pickOverlay(event.clientX, event.clientY)
    if (overlayHit !== null) {
      const target = overlayHit.record.runtime.wheel(localWheelInput(event, overlayHit.point))
      if (target !== null && event.cancelable) event.preventDefault()
      return
    }
    const hit = pickPlane(event.clientX, event.clientY)
    if (hit === null) {
      if (cameraGesturesEnabled) routeCameraWheel(viewPoint, event, canvasViewport.height)
      if (cameraGesturesEnabled && event.cancelable) event.preventDefault()
      if (cameraGesturesEnabled) requestRender()
      return
    }
    if (!cameraGesturesEnabled) {
      const target = hit.record.runtime.wheel(localWheelInput(event, hit.intersection.documentPoint))
      if (target !== null && event.cancelable) event.preventDefault()
      return
    }
    const frame = hit.record.runtime.renderer.flush()
    const logicalHit = hitTest(
      frame,
      hit.intersection.documentPoint.x,
      hit.intersection.documentPoint.y,
    )
    if (
      cameraGesturesEnabled &&
      (logicalHit === null || !logicalHit.interactive) &&
      !hasRemainingScroll(frame, logicalHit?.node ?? null, event)
    ) {
      routeCameraWheel(viewPoint, event, canvasViewport.height)
      if (event.cancelable) event.preventDefault()
      requestRender()
      return
    }
    const target = hit.record.runtime.wheel(localWheelInput(event, hit.intersection.documentPoint))
    if (target !== null && event.cancelable) event.preventDefault()
  }

  const onContextMenu = (event: MouseEvent): void => {
    if (cameraGesturesEnabled && event.cancelable) event.preventDefault()
  }

  options.canvas.addEventListener("pointermove", onPointerMove)
  options.canvas.addEventListener("pointerdown", onPointerDown)
  options.canvas.addEventListener("pointerup", onPointerUp)
  options.canvas.addEventListener("pointercancel", onPointerCancel)
  options.canvas.addEventListener("pointerleave", onPointerLeave)
  options.canvas.addEventListener("wheel", onWheel, {passive: false})
  options.canvas.addEventListener("contextmenu", onContextMenu)

  const runtime: DocumentSpaceRuntime = Object.freeze({
    canvas: options.canvas,
    engineRenderer,
    space,
    viewPoint,
    raycaster,
    nativeInputHost,
    nativeInput: nativeInputHost.nativeInput,
    nativeTextArea: nativeInputHost.nativeTextArea,
    get inputTarget() { return nativeInputHost.inputTarget },
    get activeInputPlaneId() {
      return nativeInputHost.inputTarget === null ? null : nativeInputHost.ownerId
    },
    get planeIds() { return planeIds() },
    get overlayIds() { return overlayIds() },
    get activePlaneId() { return activePlaneId },
    get hoveredPlaneId() { return hoveredPlaneId },
    get activeOverlayId() { return activeOverlayId },
    get hoveredOverlayId() { return hoveredOverlayId },
    get cameraGesturesEnabled() { return cameraGesturesEnabled },
    get presentedFrames() { return presentedFrames },
    get disposed() { return disposed },
    addPlane,
    getPlane,
    updatePlane,
    removePlane,
    addOverlay,
    getOverlay,
    removeOverlay,
    render,
    requestRender,
    resize,
    captureLastPresentedFramePng: () => {
      assertActive(disposed)
      return engineRenderer.captureLastPresentedFramePng()
    },
    snapshotViewPoint,
    restoreViewPoint,
    setCameraGesturesEnabled,
    dispose() {
      if (disposed) return
      disposed = true
      if (requestedFrame !== null) seams.cancelFrame(requestedFrame)
      requestedFrame = null
      cancelTooltipFrame()
      resizeObserver?.disconnect()
      resizeObserver = null
      options.canvas.removeEventListener("pointermove", onPointerMove)
      options.canvas.removeEventListener("pointerdown", onPointerDown)
      options.canvas.removeEventListener("pointerup", onPointerUp)
      options.canvas.removeEventListener("pointercancel", onPointerCancel)
      options.canvas.removeEventListener("pointerleave", onPointerLeave)
      options.canvas.removeEventListener("wheel", onWheel)
      options.canvas.removeEventListener("contextmenu", onContextMenu)
      for (const pointerId of [...captures.keys()]) cancelCapturedPointer(pointerId)
      hoveredPlaneId = null
      activePlaneId = null
      hoveredOverlayId = null
      activeOverlayId = null
      nativeInputHost.setActiveDocument(null)
      nativeInputHost.dispose()
      for (const record of records.values()) {
        space.remove(record.runtime.plane)
        record.runtime.dispose()
      }
      records.clear()
      for (const record of overlays.values()) {
        space.remove(record.runtime.overlay)
        record.runtime.dispose()
      }
      overlays.clear()
      viewPoint.dispose()
    },
  })

  try {
    resizeObserver = seams.createResizeObserver(() => {
      if (!disposed) resize()
    })
    resizeObserver.observe(options.canvas)
    resize()
    render()
    return runtime
  } catch (error) {
    runtime.dispose()
    throw error
  }
}

const validateOptions = (options: CreateDocumentSpaceRuntimeOptions): void => {
  if (options === null || typeof options !== "object") throw new TypeError("Runtime options are required")
  if (
    options.canvas === null ||
    typeof options.canvas !== "object" ||
    typeof options.canvas.addEventListener !== "function" ||
    typeof options.canvas.getBoundingClientRect !== "function"
  ) throw new TypeError("canvas must be an HTMLCanvasElement-compatible owner")
  if (options.pixelRatio !== undefined) finitePositive(options.pixelRatio, "pixelRatio")
  if (options.viewPoint !== undefined) validateViewPointSnapshot(options.viewPoint)
  if (options.cameraGestures !== undefined && typeof options.cameraGestures !== "boolean") {
    throw new TypeError("cameraGestures must be boolean")
  }
}

const validateSeams = (seams: DocumentSpaceRuntimeSeams): void => {
  if (seams === null || typeof seams !== "object") throw new TypeError("Runtime seams are required")
  for (const name of [
    "createEngineRenderer",
    "initializeEngineRenderer",
    "createSpace",
    "createViewPoint",
    "createRaycaster",
    "createNativeInputHost",
    "createPlaneRuntime",
    "createOverlayRuntime",
    "createResizeObserver",
    "readCanvasRect",
    "devicePixelRatio",
    "requestFrame",
    "cancelFrame",
    "setTimer",
    "clearTimer",
    "now",
  ] as const) {
    if (typeof seams[name] !== "function") throw new TypeError(`Runtime seam ${name} must be a function`)
  }
}

const validatePlaneId = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new TypeError("Document space plane id must be a non-empty trimmed string")
  }
  return value
}

type ResolvedTransform = Readonly<{
  position: DocumentSpaceVector3 | null
  quaternion: DocumentSpaceQuaternion | null
  scale: DocumentSpaceVector3 | null
  visible: boolean | null
}>

const validateTransform = (
  value: DocumentSpacePlaneTransform | undefined,
): ResolvedTransform => {
  if (value === undefined) {
    return Object.freeze({position: null, quaternion: null, scale: null, visible: null})
  }
  if (value === null || typeof value !== "object") throw new TypeError("Plane transform must be an object")
  const position = value.position === undefined ? null : validateVector(value.position, "position", false)
  const scale = value.scale === undefined ? null : validateVector(value.scale, "scale", true)
  const quaternion = value.quaternion === undefined ? null : validateQuaternion(value.quaternion)
  if (value.visible !== undefined && typeof value.visible !== "boolean") {
    throw new TypeError("Plane transform visible must be boolean")
  }
  return Object.freeze({
    position,
    quaternion,
    scale,
    visible: value.visible ?? null,
  })
}

const applyTransform = (
  runtime: DocumentPlaneRuntime,
  transform: ResolvedTransform,
): void => {
  if (transform.position !== null) {
    runtime.plane.position.set(transform.position.x, transform.position.y, transform.position.z)
  }
  if (transform.quaternion !== null) {
    runtime.plane.quaternion.set(
      transform.quaternion.x,
      transform.quaternion.y,
      transform.quaternion.z,
      transform.quaternion.w,
    ).normalize()
  }
  if (transform.scale !== null) {
    runtime.plane.scale.set(transform.scale.x, transform.scale.y, transform.scale.z)
  }
  if (transform.visible !== null) runtime.plane.visible = transform.visible
  runtime.plane.updateMatrix()
}

const validateVector = (
  value: DocumentSpaceVector3,
  label: string,
  nonZero: boolean,
): DocumentSpaceVector3 => {
  if (
    value === null ||
    typeof value !== "object" ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) throw new RangeError(`Plane transform ${label} must be finite`)
  if (nonZero && (value.x === 0 || value.y === 0 || value.z === 0)) {
    throw new RangeError("Plane transform scale axes must be non-zero")
  }
  return Object.freeze({x: value.x, y: value.y, z: value.z})
}

const validateQuaternion = (value: DocumentSpaceQuaternion): DocumentSpaceQuaternion => {
  if (
    value === null ||
    typeof value !== "object" ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z) ||
    !Number.isFinite(value.w) ||
    Math.hypot(value.x, value.y, value.z, value.w) === 0
  ) throw new RangeError("Plane transform quaternion must be finite and non-zero")
  return Object.freeze({x: value.x, y: value.y, z: value.z, w: value.w})
}

const validateViewPointSnapshot = (
  value: DocumentSpaceViewPointSnapshot,
): DocumentSpaceViewPointSnapshot => {
  if (value === null || typeof value !== "object") throw new TypeError("ViewPoint snapshot is required")
  const position = validateSnapshotVector(value.position, "position")
  const target = validateSnapshotVector(value.target, "target")
  const up = validateSnapshotVector(value.up, "up")
  if (distance(position, target) === 0) throw new RangeError("ViewPoint position and target must differ")
  if (Math.hypot(up.x, up.y, up.z) === 0) throw new RangeError("ViewPoint up must be non-zero")
  if (!Number.isFinite(value.fov) || value.fov <= 0 || value.fov >= Math.PI) {
    throw new RangeError("ViewPoint fov must be between zero and pi")
  }
  if (!Number.isFinite(value.near) || value.near <= 0) throw new RangeError("ViewPoint near must be positive")
  if (!Number.isFinite(value.far) || value.far <= value.near) throw new RangeError("ViewPoint far must exceed near")
  return Object.freeze({position, target, up, fov: value.fov, near: value.near, far: value.far})
}

const validateSnapshotVector = (value: DocumentSpaceVector3, label: string): DocumentSpaceVector3 => {
  if (
    value === null ||
    typeof value !== "object" ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) throw new RangeError(`ViewPoint ${label} must be finite`)
  return Object.freeze({x: value.x, y: value.y, z: value.z})
}

const applyViewPointSnapshot = (
  viewPoint: ViewPoint,
  snapshot: DocumentSpaceViewPointSnapshot,
): void => {
  viewPoint.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z)
  viewPoint.getTarget().set(snapshot.target.x, snapshot.target.y, snapshot.target.z)
  viewPoint.getUp().set(snapshot.up.x, snapshot.up.y, snapshot.up.z)
  viewPoint.fov = snapshot.fov
  viewPoint.near = snapshot.near
  viewPoint.far = snapshot.far
  viewPoint.updateProjectionMatrix()
  viewPoint.update()
}

const viewPointSnapshot = (viewPoint: ViewPoint): DocumentSpaceViewPointSnapshot =>
  validateViewPointSnapshot({
    position: {x: viewPoint.position.x, y: viewPoint.position.y, z: viewPoint.position.z},
    target: {x: viewPoint.getTarget().x, y: viewPoint.getTarget().y, z: viewPoint.getTarget().z},
    up: {x: viewPoint.getUp().x, y: viewPoint.getUp().y, z: viewPoint.getUp().z},
    fov: viewPoint.fov,
    near: viewPoint.near,
    far: viewPoint.far,
  })

const distance = (left: DocumentSpaceVector3, right: DocumentSpaceVector3): number =>
  Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)

const positiveExtent = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : 1

const finitePositiveOrOne = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 1

const finitePositive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and positive`)
  return value
}

const finiteNonNegative = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and non-negative`)
  return value
}

const hasRemainingScroll = (
  frame: RenderFrame,
  target: DomElement | null,
  event: WheelEvent,
): boolean => {
  for (let element = target; element !== null; element = element.parentElement) {
    const metrics = frame.scrolls.get(element)
    if (metrics === undefined) continue
    const scrollElement = element as DomElement & {scrollLeft: number; scrollTop: number}
    const left = Math.min(metrics.maxScrollLeft, scrollElement.scrollLeft)
    const top = Math.min(metrics.maxScrollTop, scrollElement.scrollTop)
    if (event.deltaX < 0 ? left > 0 : event.deltaX > 0 && left < metrics.maxScrollLeft) return true
    if (event.deltaY < 0 ? top > 0 : event.deltaY > 0 && top < metrics.maxScrollTop) return true
  }
  return false
}

const routeCameraWheel = (
  viewPoint: ViewPoint,
  event: WheelEvent,
  viewportHeight: number,
): void => {
  if (event.ctrlKey) {
    const deltaY = wheelDeltaPixels(event.deltaY, event.deltaMode, viewportHeight)
    const delta = Math.abs(deltaY) >= 0.01
      ? deltaY
      : wheelDeltaPixels(event.deltaX, event.deltaMode, viewportHeight)
    viewPoint.zoom(-delta, {clientX: event.clientX, clientY: event.clientY})
    return
  }
  viewPoint.pan(event.deltaX, event.deltaY)
}

const wheelDeltaPixels = (
  delta: number,
  mode: number,
  viewportHeight: number,
): number => {
  if (!Number.isFinite(delta) || delta === 0) return 0
  if (mode === 1) return delta * 40
  if (mode === 2) return delta * viewportHeight
  return delta
}

const assertActive = (disposed: boolean): void => {
  if (disposed) throw new Error("Document space runtime is disposed")
}
