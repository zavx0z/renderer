import type {
  BufferGeometry,
  TrueTypeFont,
  ViewPoint,
} from "@engine/core"
import type {
  Document,
  Element,
  Node,
} from "@zavx0z/dom"
import {
  createDocumentInteractionController,
  createDocumentInteractionState,
  createDocumentRenderer,
  type CreateDocumentRendererOptions,
  type DocumentInteractionController,
  type DocumentInteractionState,
  type DocumentRenderer,
  type PointerInput,
  type RenderFrame,
  type RenderViewport,
  type WheelInput,
} from "@zavx0z/renderer"
import {
  RendererWebGpuBackend,
  RendererWebGpuScreenOverlay,
  type RendererWebGpuBackendOptions,
  type RendererWebGpuScreenOverlayOptions,
} from "@zavx0z/renderer-webgpu"

export type CreateDocumentOverlayRuntimeOptions = Readonly<{
  document: Document
  root: Node
  styleSheets: readonly string[]
  font: TrueTypeFont
  viewport: RenderViewport
  distance?: number
  invalidateGeometry(geometry: BufferGeometry): void
  requestFrame(): void
  requestPresentation(): void
  interactionState?: DocumentInteractionState
  tooltipDelayMs?: number
}>

export type DocumentOverlayRuntimeFrameSubscriber = (frame: RenderFrame) => void

/** Caller-owned semantic document projected into one camera-locked overlay. */
export type DocumentOverlayRuntime = Readonly<{
  document: Document
  root: Node
  styleSheets: readonly string[]
  font: TrueTypeFont
  renderer: DocumentRenderer
  interaction: DocumentInteractionController
  interactionState: DocumentInteractionState
  backend: RendererWebGpuBackend
  overlay: RendererWebGpuScreenOverlay
  frame: RenderFrame
  viewport: RenderViewport
  disposed: boolean
  flush(): RenderFrame
  resize(viewport: RenderViewport): RenderFrame
  updateForViewPoint(viewPoint: ViewPoint): void
  pointerMove(input: PointerInput): Element | null
  pointerDown(input: PointerInput): Element | null
  pointerUp(input: PointerInput): Element | null
  pointerCancel(input: PointerInput): void
  wheel(input: WheelInput): Element | null
  subscribe(subscriber: DocumentOverlayRuntimeFrameSubscriber): () => void
  dispose(): void
}>

/** Internal exact owner seams for GPU-independent lifecycle tests. */
export type DocumentOverlayRuntimeSeams = Readonly<{
  createBackend(options: RendererWebGpuBackendOptions): RendererWebGpuBackend
  createOverlay(options: RendererWebGpuScreenOverlayOptions): RendererWebGpuScreenOverlay
  createDocumentRenderer(options: CreateDocumentRendererOptions): DocumentRenderer
  createInteraction(options: Readonly<{
    document: Document
    interactionState: DocumentInteractionState
    tooltipDelayMs: number
  }>): DocumentInteractionController
  now(): number
}>

const defaultSeams = (): DocumentOverlayRuntimeSeams => Object.freeze({
  createBackend: (options) => new RendererWebGpuBackend(options),
  createOverlay: (options) => new RendererWebGpuScreenOverlay(options),
  createDocumentRenderer,
  createInteraction: (options) => createDocumentInteractionController(options),
  now: () => performance.now(),
})

/** Creates one semantic screen overlay without allocating canvas or Engine hosts. */
export function createDocumentOverlayRuntime(
  options: CreateDocumentOverlayRuntimeOptions,
): DocumentOverlayRuntime {
  return createDocumentOverlayRuntimeWithSeams(options, defaultSeams())
}

/** Internal exact-seam constructor for lifecycle and routing tests. */
export function createDocumentOverlayRuntimeWithSeams(
  options: CreateDocumentOverlayRuntimeOptions,
  seams: DocumentOverlayRuntimeSeams,
): DocumentOverlayRuntime {
  validateOptions(options)
  validateSeams(seams)
  const styleSheets = Object.freeze([...options.styleSheets])
  const tooltipDelayMs = finiteNonNegative(options.tooltipDelayMs ?? 500, "tooltipDelayMs")
  if (
    options.interactionState !== undefined &&
    options.interactionState.document !== options.document
  ) throw new TypeError("interactionState belongs to another Document")
  const interactionState = options.interactionState ?? createDocumentInteractionState(options.document)
  let requestBackendPresentation = (): void => {}
  let backend: RendererWebGpuBackend | null = null
  let overlay: RendererWebGpuScreenOverlay | null = null
  let renderer: DocumentRenderer | null = null
  let interaction: DocumentInteractionController | null = null
  let currentFrame: RenderFrame | null = null
  let unsubscribeMutations = (): void => {}
  let unsubscribeStateChanges = (): void => {}
  let disposed = false
  let requestVersion = 0
  const subscribers = new Set<DocumentOverlayRuntimeFrameSubscriber>()

  const requestFrame = (): void => {
    if (disposed) return
    requestVersion += 1
    options.requestFrame()
  }
  const requestFrameUnlessSignaled = (version: number): void => {
    if (requestVersion === version) requestFrame()
  }

  const cleanupOwners = (): void => {
    requestBackendPresentation = (): void => {}
    unsubscribeMutations()
    unsubscribeStateChanges()
    unsubscribeMutations = () => {}
    unsubscribeStateChanges = () => {}
    interaction?.dispose()
    renderer?.dispose()
    backend?.dispose()
  }

  try {
    backend = seams.createBackend({
      font: options.font,
      invalidateGeometry: options.invalidateGeometry,
      requestPresentation: () => requestBackendPresentation(),
    })
    overlay = seams.createOverlay({
      content: backend.root,
      viewport: options.viewport,
      ...(options.distance === undefined ? {} : {distance: options.distance}),
    })
    renderer = seams.createDocumentRenderer({
      document: options.document,
      root: options.root,
      viewport: options.viewport,
      styleSheets,
      interactionState,
    })
    interaction = seams.createInteraction({
      document: options.document,
      interactionState,
      tooltipDelayMs,
    })
    requestBackendPresentation = (): void => {
      if (!disposed) options.requestPresentation()
    }
    unsubscribeMutations = options.document.subscribeMutations(requestFrame)
    unsubscribeStateChanges = options.document.subscribeStateChanges(requestFrame)
  } catch (error) {
    cleanupOwners()
    throw error
  }

  const requiredBackend = backend
  const requiredOverlay = overlay
  let requiredRenderer = renderer
  const requiredInteraction = interaction
  if (
    requiredBackend === null ||
    requiredOverlay === null ||
    requiredRenderer === null ||
    requiredInteraction === null
  ) throw new Error("Document overlay runtime owners were not created")

  const flush = (): RenderFrame => {
    assertActive(disposed)
    const frame = requiredInteraction.composeFrame(requiredRenderer.flush(), seams.now())
    requiredBackend.applyFrame(frame)
    currentFrame = frame
    for (const subscriber of [...subscribers]) subscriber(frame)
    if (!disposed) options.requestPresentation()
    return frame
  }

  const resize = (viewport: RenderViewport): RenderFrame => {
    assertActive(disposed)
    validateViewport(viewport)
    const viewportChanged =
      viewport.width !== requiredOverlay.viewport.width ||
      viewport.height !== requiredOverlay.viewport.height
    if (!viewportChanged) return flush()
    const nextRenderer = seams.createDocumentRenderer({
      document: options.document,
      root: options.root,
      viewport,
      styleSheets,
      interactionState,
    })
    try {
      requiredOverlay.resize(viewport)
    } catch (error) {
      nextRenderer.dispose()
      throw error
    }
    const previous = requiredRenderer
    requiredRenderer = nextRenderer
    renderer = nextRenderer
    previous.dispose()
    return flush()
  }

  const subscribe = (subscriber: DocumentOverlayRuntimeFrameSubscriber): (() => void) => {
    assertActive(disposed)
    if (typeof subscriber !== "function") throw new TypeError("Frame subscriber must be a function")
    subscribers.add(subscriber)
    if (currentFrame !== null) subscriber(currentFrame)
    return () => subscribers.delete(subscriber)
  }

  const runtime: DocumentOverlayRuntime = Object.freeze({
    document: options.document,
    root: options.root,
    styleSheets,
    font: options.font,
    get renderer() { return requiredRenderer },
    interaction: requiredInteraction,
    interactionState,
    backend: requiredBackend,
    overlay: requiredOverlay,
    get frame() {
      if (currentFrame === null) throw new Error("Document overlay runtime has not flushed")
      return currentFrame
    },
    get viewport() { return requiredOverlay.viewport },
    get disposed() { return disposed },
    flush,
    resize,
    updateForViewPoint(viewPoint) {
      assertActive(disposed)
      requiredOverlay.updateForViewPoint(viewPoint)
    },
    pointerMove(input) {
      assertActive(disposed)
      const version = requestVersion
      const target = requiredInteraction.pointerMove(requiredRenderer.flush(), input)
      requestFrameUnlessSignaled(version)
      return target
    },
    pointerDown(input) {
      assertActive(disposed)
      const version = requestVersion
      const target = requiredInteraction.pointerDown(requiredRenderer.flush(), input)
      requestFrameUnlessSignaled(version)
      return target
    },
    pointerUp(input) {
      assertActive(disposed)
      const version = requestVersion
      const target = requiredInteraction.pointerUp(requiredRenderer.flush(), input)
      requestFrameUnlessSignaled(version)
      return target
    },
    pointerCancel(input) {
      assertActive(disposed)
      const version = requestVersion
      requiredInteraction.pointerCancel(requiredRenderer.flush(), input)
      requestFrameUnlessSignaled(version)
    },
    wheel(input) {
      assertActive(disposed)
      const version = requestVersion
      const target = requiredInteraction.wheel(requiredRenderer.flush(), input)
      requestFrameUnlessSignaled(version)
      return target
    },
    subscribe,
    dispose() {
      if (disposed) return
      disposed = true
      subscribers.clear()
      cleanupOwners()
    },
  })

  try {
    flush()
    return runtime
  } catch (error) {
    runtime.dispose()
    throw error
  }
}

const validateOptions = (options: CreateDocumentOverlayRuntimeOptions): void => {
  if (options === null || typeof options !== "object") throw new TypeError("Runtime options are required")
  if (options.document === null || typeof options.document !== "object") {
    throw new TypeError("document must be an @zavx0z/dom Document")
  }
  if (options.root === null || typeof options.root !== "object") {
    throw new TypeError("root must be an @zavx0z/dom Node")
  }
  if (options.root !== options.document && options.root.ownerDocument !== options.document) {
    throw new Error("root belongs to another Document")
  }
  if (!Array.isArray(options.styleSheets) || options.styleSheets.some((sheet) => typeof sheet !== "string")) {
    throw new TypeError("styleSheets must be an array of CSS strings")
  }
  if (options.font === null || typeof options.font !== "object") {
    throw new TypeError("font is required and must be a resolved TrueTypeFont")
  }
  validateViewport(options.viewport)
  if (options.distance !== undefined) finitePositive(options.distance, "distance")
  if (typeof options.invalidateGeometry !== "function") throw new TypeError("invalidateGeometry must be a function")
  if (typeof options.requestFrame !== "function") throw new TypeError("requestFrame must be a function")
  if (typeof options.requestPresentation !== "function") throw new TypeError("requestPresentation must be a function")
}

const validateSeams = (seams: DocumentOverlayRuntimeSeams): void => {
  if (seams === null || typeof seams !== "object") throw new TypeError("Runtime seams are required")
  for (const name of [
    "createBackend",
    "createOverlay",
    "createDocumentRenderer",
    "createInteraction",
    "now",
  ] as const) {
    if (typeof seams[name] !== "function") throw new TypeError(`Runtime seam ${name} must be a function`)
  }
}

const validateViewport = (viewport: RenderViewport): void => {
  if (
    viewport === null ||
    typeof viewport !== "object" ||
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width < 0 ||
    viewport.height < 0
  ) throw new RangeError("viewport must be finite and non-negative")
}

const finiteNonNegative = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and non-negative`)
  return value
}

const finitePositive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and positive`)
  return value
}

const assertActive = (disposed: boolean): void => {
  if (disposed) throw new Error("Document overlay runtime is disposed")
}
