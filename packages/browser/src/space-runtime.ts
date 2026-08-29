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
  createDocumentInteractionState,
  hitTest,
  resolvePointerOwnerHit,
  type DocumentInteractionState,
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
import {claimBrowserPresentationHost} from "./presentation-host.ts"

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
  root: Node
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
  root: Node
  distance?: number
  tooltipDelayMs?: number
}>

/** One caller-owned direct world region in logical canvas coordinates. */
export type DocumentSpaceWorldViewport = Readonly<{
  x: number
  y: number
  width: number
  height: number
}>

/** Exact logical/backing geometry published after host viewport resolution. */
export type DocumentSpaceWorldResize = Readonly<{
  logicalViewport: DocumentSpaceWorldViewport
  backingViewport: DocumentSpaceWorldViewport
  pixelRatio: number
}>

export type DocumentSpaceWorldRegistration = Readonly<{
  id: string
  space: Space
  viewport: DocumentSpaceWorldViewport | null
  viewPoint: DocumentSpaceViewPointSnapshot
  visible?: boolean
  cameraGestures?: boolean
  onResize?(resize: DocumentSpaceWorldResize | null): void
  onDoubleClick?(): void
}>

export type DocumentSpaceWorldUpdate = Readonly<{
  viewport?: DocumentSpaceWorldViewport | null
  viewPoint?: DocumentSpaceViewPointSnapshot
  visible?: boolean
  cameraGestures?: boolean
}>

export type DocumentSpaceWorldRuntime = Readonly<{
  id: string
  space: Space
  viewPoint: ViewPoint
  viewport: DocumentSpaceWorldViewport | null
  logicalViewport: DocumentSpaceWorldViewport | null
  backingViewport: DocumentSpaceWorldViewport | null
  visible: boolean
  cameraGesturesEnabled: boolean
  disposed: boolean
  requestRender(): void
  snapshotViewPoint(): DocumentSpaceViewPointSnapshot
  restoreViewPoint(snapshot: DocumentSpaceViewPointSnapshot): void
  dispose(): void
}>

export type CreateDocumentSpaceRuntimeOptions = Readonly<{
  canvas: HTMLCanvasElement
  document: Document
  styleSheets: readonly string[]
  font: TrueTypeFont
  pixelRatio?: number
  viewPoint?: DocumentSpaceViewPointSnapshot
  cameraGestures?: boolean
}>

export type DocumentSpaceRuntime = Readonly<{
  canvas: HTMLCanvasElement
  document: Document
  styleSheets: readonly string[]
  font: TrueTypeFont
  interactionState: DocumentInteractionState
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
  worldIds: readonly string[]
  activePlaneId: string | null
  hoveredPlaneId: string | null
  activeOverlayId: string | null
  hoveredOverlayId: string | null
  activeWorldId: string | null
  hoveredWorldId: string | null
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
  addWorld(registration: DocumentSpaceWorldRegistration): DocumentSpaceWorldRuntime
  getWorld(id: string): DocumentSpaceWorldRuntime | undefined
  updateWorld(id: string, update: DocumentSpaceWorldUpdate): DocumentSpaceWorldRuntime
  removeWorld(id: string): boolean
  render(): void
  requestRender(): void
  resize(): void
  captureLastPresentedFramePng(): Promise<Blob | null>
  snapshotViewPoint(): DocumentSpaceViewPointSnapshot
  restoreViewPoint(snapshot: DocumentSpaceViewPointSnapshot): void
  setCameraGesturesEnabled(enabled: boolean): void
  subscribePresented(listener: (frame: number) => void): () => void
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
  createWorldViewPoint(
    snapshot: DocumentSpaceViewPointSnapshot,
    viewport: DocumentSpaceWorldViewport,
  ): ViewPoint
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

type WorldRecord = {
  id: string
  runtime: DocumentSpaceWorldRuntime
  order: number
  requestedViewport: DocumentSpaceWorldViewport | null
  logicalViewport: DocumentSpaceWorldViewport | null
  backingViewport: DocumentSpaceWorldViewport | null
  visible: boolean
  cameraGestures: boolean
  onResize: ((resize: DocumentSpaceWorldResize | null) => void) | null
  onDoubleClick: (() => void) | null
  resizeSignature: string | null
  disposed: boolean
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

type CapturedWorldPointer = {
  kind: "world"
  worldId: string
  mode: "orbit" | "pan" | null
  clientX: number
  clientY: number
}

type CapturedPointer =
  | CapturedPlanePointer
  | CapturedOverlayPointer
  | CapturedCameraPointer
  | CapturedWorldPointer

type PlaneHit = Readonly<{
  record: PlaneRecord
  intersection: RendererWebGpuDocumentPlaneIntersection
}>

type OverlayHit = Readonly<{
  record: OverlayRecord
  point: Readonly<{x: number; y: number}>
  hit: HitMetadata
  owner: HitMetadata | null
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
      controls: "host",
      fov: snapshot.fov,
      near: snapshot.near,
      far: snapshot.far,
      position: snapshot.position,
      target: snapshot.target,
    })
    viewPoint.getUp().set(snapshot.up.x, snapshot.up.y, snapshot.up.z)
    viewPoint.update()
    return viewPoint
  },
  createWorldViewPoint(snapshot, viewport) {
    const viewPoint = new ViewPoint({
      controls: "host",
      viewport: {
        left: viewport.x,
        top: viewport.y,
        width: viewport.width,
        height: viewport.height,
      },
      fov: snapshot.fov,
      near: snapshot.near,
      far: snapshot.far,
      position: snapshot.position,
      target: snapshot.target,
    })
    viewPoint.getUp().set(snapshot.up.x, snapshot.up.y, snapshot.up.z)
    viewPoint.update()
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

/** Creates the one canvas/Document/Space host for one browser Experience. */
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
  const presentationHostClaim = claimBrowserPresentationHost(options.canvas)
  try {
    return await createClaimedDocumentSpaceRuntime(options, seams, presentationHostClaim)
  } catch (error) {
    presentationHostClaim.release()
    throw error
  }
}

const createClaimedDocumentSpaceRuntime = async (
  options: CreateDocumentSpaceRuntimeOptions,
  seams: DocumentSpaceRuntimeSeams,
  presentationHostClaim: ReturnType<typeof claimBrowserPresentationHost>,
): Promise<DocumentSpaceRuntime> => {
  validateSeams(seams)
  const fixedPixelRatio = options.pixelRatio === undefined
    ? null
    : finitePositive(options.pixelRatio, "pixelRatio")
  const styleSheets = Object.freeze([...options.styleSheets])
  const initialViewPoint = validateViewPointSnapshot(options.viewPoint ?? DEFAULT_VIEW_POINT)
  const interactionState = createDocumentInteractionState(options.document)
  const engineRenderer = seams.createEngineRenderer()
  await seams.initializeEngineRenderer(engineRenderer, options.canvas)
  const space = seams.createSpace()
  const viewPoint = seams.createViewPoint(options.canvas, initialViewPoint)
  const raycaster = seams.createRaycaster()
  const records = new Map<string, PlaneRecord>()
  const overlays = new Map<string, OverlayRecord>()
  const worlds = new Map<string, WorldRecord>()
  const worldOwners = new Map<Space, string>()
  const projectionRoots = new Map<Node, string>()
  const captures = new Map<number, CapturedPointer>()
  const presentedListeners = new Set<(frame: number) => void>()
  let nextPlaneOrder = 0
  let nextOverlayOrder = 0
  let nextWorldOrder = 0
  let hoveredPlaneId: string | null = null
  let activePlaneId: string | null = null
  let hoveredOverlayId: string | null = null
  let activeOverlayId: string | null = null
  let hoveredWorldId: string | null = null
  let activeWorldId: string | null = null
  let canvasViewport: RenderViewport = Object.freeze({width: 1, height: 1})
  let currentPixelRatio = fixedPixelRatio ?? 1
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
      for (const record of worlds.values()) {
        synchronizeWorldGeometry(record)
        if (record.visible && record.logicalViewport !== null) record.runtime.viewPoint.update()
      }
      space.updateWorldMatrix(true)
      engineRenderer.renderComposition({
        space,
        viewPoint,
        overlays: [...overlays.values()]
          .sort((left, right) => left.order - right.order)
          .map((record) => record.runtime.overlay),
        boundedViews: [...worlds.values()]
          .filter((record) => record.visible && record.backingViewport !== null)
          .sort((left, right) => left.order - right.order)
          .map((record) => Object.freeze({
            space: record.runtime.space,
            viewPoint: record.runtime.viewPoint,
            viewport: record.backingViewport!,
          })),
      })
      presentedFrames += 1
      for (const listener of [...presentedListeners]) listener(presentedFrames)
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
    if (records.has(id) || overlays.has(id) || worlds.has(id)) {
      throw new Error(`Document space owner id is already registered: ${id}`)
    }
    validateProjectionRoot(options.document, registration.root)
    const rootOwner = projectionRoots.get(registration.root)
    if (rootOwner !== undefined) {
      throw new Error(`Document space root is already registered by owner: ${rootOwner}`)
    }
    validateProjectionRootSeparation(projectionRoots, registration.root)
    const transform = validateTransform(registration.transform)
    const tooltipDelayMs = finiteNonNegative(registration.tooltipDelayMs ?? 500, "tooltipDelayMs")
    let record: PlaneRecord | null = null
    let requestedBeforeRegistration = false
    const runtime = seams.createPlaneRuntime({
      document: options.document,
      root: registration.root,
      styleSheets,
      font: options.font,
      viewport: registration.viewport,
      worldUnitsPerPixel: registration.worldUnitsPerPixel,
      interactionState,
      tooltipDelayMs,
      invalidateGeometry: (geometry) => engineRenderer.invalidateGeometry(geometry),
      requestFrame() {
        if (disposed) return
        if (nativeInputHost.document === options.document) nativeInputHost.synchronize()
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
    projectionRoots.set(registration.root, id)
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
    projectionRoots.delete(record.runtime.root)
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
    if (records.has(id) || overlays.has(id) || worlds.has(id)) {
      throw new Error(`Document space owner id is already registered: ${id}`)
    }
    validateProjectionRoot(options.document, registration.root)
    const rootOwner = projectionRoots.get(registration.root)
    if (rootOwner !== undefined) {
      throw new Error(`Document space root is already registered by owner: ${rootOwner}`)
    }
    validateProjectionRootSeparation(projectionRoots, registration.root)
    const tooltipDelayMs = finiteNonNegative(registration.tooltipDelayMs ?? 500, "tooltipDelayMs")
    let record: OverlayRecord | null = null
    let requestedBeforeRegistration = false
    const runtime = seams.createOverlayRuntime({
      document: options.document,
      root: registration.root,
      styleSheets,
      font: options.font,
      viewport: canvasViewport,
      interactionState,
      ...(registration.distance === undefined ? {} : {distance: registration.distance}),
      tooltipDelayMs,
      invalidateGeometry: (geometry) => engineRenderer.invalidateGeometry(geometry),
      requestFrame() {
        if (disposed) return
        if (nativeInputHost.document === options.document) nativeInputHost.synchronize()
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
    projectionRoots.set(registration.root, id)
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
    projectionRoots.delete(record.runtime.root)
    record.runtime.dispose()
    requestRender()
    return true
  }

  const worldIds = (): readonly string[] => Object.freeze([...worlds.keys()])

  const getWorld = (id: string): DocumentSpaceWorldRuntime | undefined =>
    worlds.get(validatePlaneId(id))?.runtime

  const resolveWorldGeometry = (
    requested: DocumentSpaceWorldViewport | null,
    visible: boolean,
  ): Readonly<{
    logicalViewport: DocumentSpaceWorldViewport | null
    backingViewport: DocumentSpaceWorldViewport | null
    clientViewport: DocumentSpaceWorldViewport
  }> => {
    const rect = seams.readCanvasRect(options.canvas)
    if (!visible || requested === null) {
      return Object.freeze({
        logicalViewport: null,
        backingViewport: null,
        clientViewport: Object.freeze({
          x: rect.left,
          y: rect.top,
          width: positiveExtent(rect.width),
          height: positiveExtent(rect.height),
        }),
      })
    }
    const left = clamp(requested.x, 0, canvasViewport.width)
    const top = clamp(requested.y, 0, canvasViewport.height)
    const right = clamp(requested.x + requested.width, left, canvasViewport.width)
    const bottom = clamp(requested.y + requested.height, top, canvasViewport.height)
    if (right <= left || bottom <= top) {
      return Object.freeze({
        logicalViewport: null,
        backingViewport: null,
        clientViewport: Object.freeze({
          x: rect.left,
          y: rect.top,
          width: positiveExtent(rect.width),
          height: positiveExtent(rect.height),
        }),
      })
    }
    const logicalViewport = Object.freeze({
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    })
    const backingWidth = Math.max(1, Math.floor(canvasViewport.width * currentPixelRatio))
    const backingHeight = Math.max(1, Math.floor(canvasViewport.height * currentPixelRatio))
    const backingLeft = clamp(Math.floor(left * currentPixelRatio), 0, backingWidth)
    const backingTop = clamp(Math.floor(top * currentPixelRatio), 0, backingHeight)
    const backingRight = clamp(Math.ceil(right * currentPixelRatio), backingLeft, backingWidth)
    const backingBottom = clamp(Math.ceil(bottom * currentPixelRatio), backingTop, backingHeight)
    const backingViewport = Object.freeze({
      x: backingLeft,
      y: backingTop,
      width: backingRight - backingLeft,
      height: backingBottom - backingTop,
    })
    const scaleX = positiveExtent(rect.width) / canvasViewport.width
    const scaleY = positiveExtent(rect.height) / canvasViewport.height
    return Object.freeze({
      logicalViewport,
      backingViewport,
      clientViewport: Object.freeze({
        x: rect.left + left * scaleX,
        y: rect.top + top * scaleY,
        width: logicalViewport.width * scaleX,
        height: logicalViewport.height * scaleY,
      }),
    })
  }

  const synchronizeWorldGeometry = (record: WorldRecord): void => {
    const geometry = resolveWorldGeometry(record.requestedViewport, record.visible)
    record.logicalViewport = geometry.logicalViewport
    record.backingViewport = geometry.backingViewport
    record.runtime.viewPoint.setViewport({
      left: geometry.clientViewport.x,
      top: geometry.clientViewport.y,
      width: geometry.clientViewport.width,
      height: geometry.clientViewport.height,
    })
    const signature = geometry.logicalViewport === null || geometry.backingViewport === null
      ? "hidden"
      : [
          geometry.logicalViewport.x,
          geometry.logicalViewport.y,
          geometry.logicalViewport.width,
          geometry.logicalViewport.height,
          geometry.backingViewport.x,
          geometry.backingViewport.y,
          geometry.backingViewport.width,
          geometry.backingViewport.height,
          currentPixelRatio,
        ].join(":")
    if (record.resizeSignature === signature) return
    record.resizeSignature = signature
    if (record.onResize === null) return
    record.onResize(
      geometry.logicalViewport === null || geometry.backingViewport === null
        ? null
        : Object.freeze({
            logicalViewport: geometry.logicalViewport,
            backingViewport: geometry.backingViewport,
            pixelRatio: currentPixelRatio,
          }),
    )
  }

  const addWorld = (
    registration: DocumentSpaceWorldRegistration,
  ): DocumentSpaceWorldRuntime => {
    assertActive(disposed)
    if (registration === null || typeof registration !== "object") {
      throw new TypeError("Document space world registration is required")
    }
    const id = validatePlaneId(registration.id)
    if (records.has(id) || overlays.has(id) || worlds.has(id)) {
      throw new Error(`Document space owner id is already registered: ${id}`)
    }
    if (!(registration.space instanceof Space)) {
      throw new TypeError("Document space world must be an exact Engine Space")
    }
    if (registration.space === space) throw new Error("Document space world cannot be the host Space")
    if (registration.space.parent !== null) {
      throw new Error("Document space world must be an unattached Engine Space")
    }
    const existingOwner = worldOwners.get(registration.space)
    if (existingOwner !== undefined) {
      throw new Error(`Document space world is already registered by owner: ${existingOwner}`)
    }
    const requestedViewport = validateWorldViewport(registration.viewport)
    const snapshot = validateViewPointSnapshot(registration.viewPoint)
    const visible = registration.visible ?? true
    const cameraGestures = registration.cameraGestures ?? true
    if (typeof visible !== "boolean") throw new TypeError("World visibility must be boolean")
    if (typeof cameraGestures !== "boolean") throw new TypeError("World cameraGestures must be boolean")
    if (registration.onResize !== undefined && typeof registration.onResize !== "function") {
      throw new TypeError("World onResize must be a function")
    }
    if (registration.onDoubleClick !== undefined && typeof registration.onDoubleClick !== "function") {
      throw new TypeError("World onDoubleClick must be a function")
    }
    const initialGeometry = resolveWorldGeometry(requestedViewport, visible)
    const worldViewPoint = seams.createWorldViewPoint(snapshot, initialGeometry.clientViewport)
    let record!: WorldRecord
    const runtime: DocumentSpaceWorldRuntime = Object.freeze({
      id,
      space: registration.space,
      viewPoint: worldViewPoint,
      get viewport() { return record.requestedViewport },
      get logicalViewport() { return record.logicalViewport },
      get backingViewport() { return record.backingViewport },
      get visible() { return record.visible },
      get cameraGesturesEnabled() { return record.cameraGestures },
      get disposed() { return record.disposed },
      requestRender() {
        if (record.disposed) throw new Error("Document space world is disposed")
        requestRender()
      },
      snapshotViewPoint() {
        if (record.disposed) throw new Error("Document space world is disposed")
        worldViewPoint.update()
        return viewPointSnapshot(worldViewPoint)
      },
      restoreViewPoint(value) {
        if (record.disposed) throw new Error("Document space world is disposed")
        applyViewPointSnapshot(worldViewPoint, validateViewPointSnapshot(value))
        requestRender()
      },
      dispose() {
        if (record.disposed || disposed) return
        removeWorld(id)
      },
    })
    record = {
      id,
      runtime,
      order: nextWorldOrder++,
      requestedViewport,
      logicalViewport: null,
      backingViewport: null,
      visible,
      cameraGestures,
      onResize: registration.onResize ?? null,
      onDoubleClick: registration.onDoubleClick ?? null,
      resizeSignature: null,
      disposed: false,
    }
    try {
      worlds.set(id, record)
      worldOwners.set(registration.space, id)
      space.add(registration.space)
      synchronizeWorldGeometry(record)
      requestRender()
      return runtime
    } catch (error) {
      worlds.delete(id)
      worldOwners.delete(registration.space)
      space.remove(registration.space)
      record.disposed = true
      worldViewPoint.dispose()
      throw error
    }
  }

  const updateWorld = (
    idValue: string,
    update: DocumentSpaceWorldUpdate,
  ): DocumentSpaceWorldRuntime => {
    assertActive(disposed)
    const id = validatePlaneId(idValue)
    const record = worlds.get(id)
    if (record === undefined) throw new Error(`Unknown document space world id: ${id}`)
    if (update === null || typeof update !== "object") throw new TypeError("World update is required")
    if (update.viewport !== undefined) record.requestedViewport = validateWorldViewport(update.viewport)
    if (update.visible !== undefined) {
      if (typeof update.visible !== "boolean") throw new TypeError("World visibility must be boolean")
      record.visible = update.visible
    }
    if (update.cameraGestures !== undefined) {
      if (typeof update.cameraGestures !== "boolean") throw new TypeError("World cameraGestures must be boolean")
      record.cameraGestures = update.cameraGestures
      if (!record.cameraGestures) cancelCapturedWorld(id)
    }
    if (update.viewPoint !== undefined) {
      applyViewPointSnapshot(record.runtime.viewPoint, validateViewPointSnapshot(update.viewPoint))
    }
    synchronizeWorldGeometry(record)
    if (!record.visible || record.logicalViewport === null) {
      if (hoveredWorldId === id) hoveredWorldId = null
      cancelCapturedWorld(id)
    }
    requestRender()
    return record.runtime
  }

  function removeWorld(idValue: string): boolean {
    assertActive(disposed)
    const id = validatePlaneId(idValue)
    const record = worlds.get(id)
    if (record === undefined) return false
    cancelCapturedWorld(id)
    if (hoveredWorldId === id) hoveredWorldId = null
    if (activeWorldId === id) activeWorldId = null
    worlds.delete(id)
    worldOwners.delete(record.runtime.space)
    if (record.runtime.space.parent === space) space.remove(record.runtime.space)
    record.disposed = true
    record.runtime.viewPoint.dispose()
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
    currentPixelRatio = pixelRatio
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
    for (const record of worlds.values()) synchronizeWorldGeometry(record)
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
      const frame = record.runtime.renderer.flush()
      const hit = hitTest(frame, point.x, point.y)
      if (hit !== null) {
        return Object.freeze({record, point, hit, owner: resolvePointerOwnerHit(frame, hit)})
      }
    }
    return null
  }

  const pickWorld = (clientX: number, clientY: number): WorldRecord | null => {
    const point = overlayPoint(clientX, clientY)
    if (point === null) return null
    const ordered = [...worlds.values()].sort((left, right) => right.order - left.order)
    for (const record of ordered) {
      const viewport = record.logicalViewport
      if (!record.visible || viewport === null) continue
      if (
        point.x >= viewport.x &&
        point.y >= viewport.y &&
        point.x < viewport.x + viewport.width &&
        point.y < viewport.y + viewport.height
      ) return record
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

  const clearHoveredWorld = (): void => {
    hoveredWorldId = null
  }

  const refreshActiveOwners = (): void => {
    const last = [...captures.values()].at(-1)
    activePlaneId = last?.kind === "plane" ? last.planeId : null
    activeOverlayId = last?.kind === "overlay" ? last.overlayId : null
    activeWorldId = last?.kind === "world" ? last.worldId : null
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

  function cancelCapturedWorld(id: string): void {
    for (const [pointerId, capture] of [...captures]) {
      if (capture.kind === "world" && capture.worldId === id) releasePointer(pointerId)
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

  const subscribePresented = (listener: (frame: number) => void): (() => void) => {
    assertActive(disposed)
    if (typeof listener !== "function") throw new TypeError("Presented frame listener must be a function")
    presentedListeners.add(listener)
    return () => presentedListeners.delete(listener)
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
      if (capture.kind === "world") {
        const record = worlds.get(capture.worldId)
        if (record === undefined || !record.visible || record.logicalViewport === null) {
          releasePointer(event.pointerId)
          return
        }
        const deltaX = event.clientX - capture.clientX
        const deltaY = event.clientY - capture.clientY
        capture.clientX = event.clientX
        capture.clientY = event.clientY
        if (capture.mode === "orbit") record.runtime.viewPoint.orbit(deltaX, deltaY)
        else if (capture.mode === "pan") record.runtime.viewPoint.pan(deltaX, deltaY)
        hoveredWorldId = record.id
        activeWorldId = record.id
        if (capture.mode !== null) {
          if (event.cancelable) event.preventDefault()
          requestRender()
        }
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
        activeWorldId = null
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
      activeWorldId = null
      scheduleTooltipFrame({kind: "plane", id: record.id}, record.tooltipDelayMs)
      return
    }
    const overlayHit = pickOverlay(event.clientX, event.clientY)
    if (overlayHit?.record.id !== hoveredOverlayId) clearHoveredOverlay(event)
    if (overlayHit !== null && overlayHit.owner !== null) {
      clearHoveredWorld()
      clearHoveredPlane(event)
      hoveredOverlayId = overlayHit.record.id
      overlayHit.record.runtime.pointerMove(localPointerInput(event, overlayHit.point))
      scheduleTooltipFrame(
        {kind: "overlay", id: overlayHit.record.id},
        overlayHit.record.tooltipDelayMs,
      )
      return
    }
    const world = pickWorld(event.clientX, event.clientY)
    if (world !== null) {
      clearHoveredOverlay(event)
      clearHoveredPlane(event)
      hoveredWorldId = world.id
      return
    }
    clearHoveredWorld()
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
    if (overlayHit !== null && overlayHit.owner !== null) {
      clearHoveredWorld()
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
      activeWorldId = null
      return
    }
    const world = pickWorld(event.clientX, event.clientY)
    if (world !== null) {
      clearHoveredOverlay(event)
      clearHoveredPlane(event)
      hoveredWorldId = world.id
      nativeInputHost.setActiveDocument(null)
      const mode = world.cameraGestures
        ? event.button === 2
          ? "pan"
          : event.button === 0
            ? "orbit"
            : null
        : null
      if (event.cancelable) event.preventDefault()
      options.canvas.setPointerCapture?.(event.pointerId)
      captures.set(event.pointerId, {
        kind: "world",
        worldId: world.id,
        mode,
        clientX: event.clientX,
        clientY: event.clientY,
      })
      activeWorldId = world.id
      activePlaneId = null
      activeOverlayId = null
      return
    }
    clearHoveredWorld()
    const hit = pickPlane(event.clientX, event.clientY)
    if (hit?.record.id !== hoveredPlaneId) clearHoveredPlane(event)
    const logicalFrame = !cameraGesturesEnabled || hit === null
      ? null
      : hit.record.runtime.renderer.flush()
    const logicalHit = logicalFrame === null || hit === null
      ? null
      : hitTest(
        logicalFrame,
        hit.intersection.documentPoint.x,
        hit.intersection.documentPoint.y,
      )
    const logicalOwner = logicalFrame === null
      ? null
      : resolvePointerOwnerHit(logicalFrame, logicalHit)
    const cameraMode = cameraGesturesEnabled && logicalOwner === null
      ? event.button === 2
        ? "pan"
        : event.button === 0
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
      activeWorldId = null
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
    activeWorldId = null
  }

  const onPointerUp = (event: PointerEvent): void => {
    if (disposed) return
    const capture = captures.get(event.pointerId)
    if (capture === undefined) return
    if (capture.kind === "camera") {
      releasePointer(event.pointerId)
      return
    }
    if (capture.kind === "world") {
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
    clearHoveredWorld()
    clearHoveredPlane(event)
  }

  const onWheel = (event: WheelEvent): void => {
    if (disposed) return
    const overlayHit = pickOverlay(event.clientX, event.clientY)
    const overlayFrame = overlayHit?.record.runtime.renderer.flush() ?? null
    const overlayOwnsWheel = overlayHit !== null && (
      overlayHit.owner !== null ||
      overlayFrame !== null && hasRemainingScroll(overlayFrame, overlayHit.hit.node, event)
    )
    if (overlayHit !== null && overlayOwnsWheel) {
      const target = overlayHit.record.runtime.wheel(localWheelInput(event, overlayHit.point))
      if (target !== null && event.cancelable) event.preventDefault()
      return
    }
    const world = pickWorld(event.clientX, event.clientY)
    if (world !== null) {
      if (!world.cameraGestures) return
      routeCameraWheel(
        world.runtime.viewPoint,
        event,
        world.logicalViewport?.height ?? canvasViewport.height,
      )
      if (event.cancelable) event.preventDefault()
      requestRender()
      return
    }
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
    const logicalOwner = resolvePointerOwnerHit(frame, logicalHit)
    if (
      cameraGesturesEnabled &&
      logicalOwner === null &&
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
    const overlayHit = pickOverlay(event.clientX, event.clientY)
    if (overlayHit !== null && overlayHit.owner !== null) return
    const world = pickWorld(event.clientX, event.clientY)
    if (world === null) {
      const planeHit = pickPlane(event.clientX, event.clientY)
      if (planeHit !== null) {
        const frame = planeHit.record.runtime.renderer.flush()
        const hit = hitTest(
          frame,
          planeHit.intersection.documentPoint.x,
          planeHit.intersection.documentPoint.y,
        )
        if (resolvePointerOwnerHit(frame, hit) !== null) return
      }
    }
    if ((world?.cameraGestures === true || cameraGesturesEnabled) && event.cancelable) {
      event.preventDefault()
    }
  }

  const onDoubleClick = (event: MouseEvent): void => {
    if (disposed) return
    const overlayHit = pickOverlay(event.clientX, event.clientY)
    if (overlayHit !== null && overlayHit.owner !== null) return
    const world = pickWorld(event.clientX, event.clientY)
    if (world === null || world.onDoubleClick === null) return
    world.onDoubleClick()
    requestRender()
  }

  options.canvas.addEventListener("pointermove", onPointerMove)
  options.canvas.addEventListener("pointerdown", onPointerDown)
  options.canvas.addEventListener("pointerup", onPointerUp)
  options.canvas.addEventListener("pointercancel", onPointerCancel)
  options.canvas.addEventListener("pointerleave", onPointerLeave)
  options.canvas.addEventListener("wheel", onWheel, {passive: false})
  options.canvas.addEventListener("contextmenu", onContextMenu)
  options.canvas.addEventListener("dblclick", onDoubleClick)

  const runtime: DocumentSpaceRuntime = Object.freeze({
    canvas: options.canvas,
    document: options.document,
    styleSheets,
    font: options.font,
    interactionState,
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
    get worldIds() { return worldIds() },
    get activePlaneId() { return activePlaneId },
    get hoveredPlaneId() { return hoveredPlaneId },
    get activeOverlayId() { return activeOverlayId },
    get hoveredOverlayId() { return hoveredOverlayId },
    get activeWorldId() { return activeWorldId },
    get hoveredWorldId() { return hoveredWorldId },
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
    addWorld,
    getWorld,
    updateWorld,
    removeWorld,
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
    subscribePresented,
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
      options.canvas.removeEventListener("dblclick", onDoubleClick)
      for (const pointerId of [...captures.keys()]) cancelCapturedPointer(pointerId)
      hoveredPlaneId = null
      activePlaneId = null
      hoveredOverlayId = null
      activeOverlayId = null
      hoveredWorldId = null
      activeWorldId = null
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
      for (const record of worlds.values()) {
        if (record.runtime.space.parent === space) space.remove(record.runtime.space)
        record.disposed = true
        record.runtime.viewPoint.dispose()
      }
      worlds.clear()
      worldOwners.clear()
      projectionRoots.clear()
      presentedListeners.clear()
      viewPoint.dispose()
      presentationHostClaim.release()
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
  if (options.document === null || typeof options.document !== "object" || options.document.nodeType !== 9) {
    throw new TypeError("document must be a semantic Document")
  }
  if (!Array.isArray(options.styleSheets) || options.styleSheets.some((sheet) => typeof sheet !== "string")) {
    throw new TypeError("styleSheets must be an array of CSS strings")
  }
  if (options.font === null || typeof options.font !== "object") {
    throw new TypeError("font is required")
  }
  if (options.pixelRatio !== undefined) finitePositive(options.pixelRatio, "pixelRatio")
  if (options.viewPoint !== undefined) validateViewPointSnapshot(options.viewPoint)
  if (options.cameraGestures !== undefined && typeof options.cameraGestures !== "boolean") {
    throw new TypeError("cameraGestures must be boolean")
  }
}

const validateProjectionRoot = (document: Document, root: Node): void => {
  if (
    root === null ||
    typeof root !== "object" ||
    !Number.isInteger(root.nodeType) ||
    typeof root.getRootNode !== "function"
  ) {
    throw new TypeError("Document space projection root must be a semantic Node")
  }
  if (root !== document && root.ownerDocument !== document) {
    throw new TypeError("Document space projection root belongs to another Document")
  }
  if (root !== document && root.getRootNode() !== document) {
    throw new TypeError("Document space projection root must belong to the connected Experience tree")
  }
}

const validateProjectionRootSeparation = (
  roots: ReadonlyMap<Node, string>,
  root: Node,
): void => {
  for (const [registered, owner] of roots) {
    if (registered.contains(root) || root.contains(registered)) {
      throw new Error(`Document space projection root overlaps owner: ${owner}`)
    }
  }
}

const validateSeams = (seams: DocumentSpaceRuntimeSeams): void => {
  if (seams === null || typeof seams !== "object") throw new TypeError("Runtime seams are required")
  for (const name of [
    "createEngineRenderer",
    "initializeEngineRenderer",
    "createSpace",
    "createViewPoint",
    "createWorldViewPoint",
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

const validateWorldViewport = (
  value: DocumentSpaceWorldViewport | null,
): DocumentSpaceWorldViewport | null => {
  if (value === null) return null
  if (
    typeof value !== "object" ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.width) ||
    !Number.isFinite(value.height) ||
    value.width < 0 ||
    value.height < 0
  ) throw new RangeError("World viewport must have finite coordinates and non-negative extents")
  return Object.freeze({x: value.x, y: value.y, width: value.width, height: value.height})
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

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

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
