import type {
  BufferGeometry,
  TrueTypeFont,
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
  RendererWebGpuDocumentPlane,
  type RendererWebGpuBackendOptions,
  type RendererWebGpuDocumentPlaneOptions,
} from "@zavx0z/renderer-webgpu"

export type CreateDocumentPlaneRuntimeOptions = Readonly<{
  document: Document
  root: Node
  styleSheets: readonly string[]
  font: TrueTypeFont
  viewport: RenderViewport
  worldUnitsPerPixel: number
  invalidateGeometry(geometry: BufferGeometry): void
  requestFrame(): void
  requestPresentation(): void
  interactionState?: DocumentInteractionState
  tooltipDelayMs?: number
}>

export type DocumentPlaneRuntimeFrameSubscriber = (frame: RenderFrame) => void

/** Caller-owned document projection for one world-space display plane. */
export type DocumentPlaneRuntime = Readonly<{
  document: Document
  root: Node
  styleSheets: readonly string[]
  font: TrueTypeFont
  renderer: DocumentRenderer
  interaction: DocumentInteractionController
  interactionState: DocumentInteractionState
  backend: RendererWebGpuBackend
  plane: RendererWebGpuDocumentPlane
  frame: RenderFrame
  viewport: RenderViewport
  worldUnitsPerPixel: number
  disposed: boolean
  flush(): RenderFrame
  resize(viewport: RenderViewport, worldUnitsPerPixel?: number): RenderFrame
  pointerMove(input: PointerInput): Element | null
  pointerDown(input: PointerInput): Element | null
  pointerUp(input: PointerInput): Element | null
  pointerCancel(input: PointerInput): void
  wheel(input: WheelInput): Element | null
  subscribe(subscriber: DocumentPlaneRuntimeFrameSubscriber): () => void
  dispose(): void
}>

/** Internal owner seams used by focused tests; not exported from the package. */
export type DocumentPlaneRuntimeSeams = Readonly<{
  createBackend(options: RendererWebGpuBackendOptions): RendererWebGpuBackend
  createPlane(options: RendererWebGpuDocumentPlaneOptions): RendererWebGpuDocumentPlane
  createDocumentRenderer(options: CreateDocumentRendererOptions): DocumentRenderer
  createInteraction(options: Readonly<{
    document: Document
    interactionState: DocumentInteractionState
    tooltipDelayMs: number
  }>): DocumentInteractionController
  now(): number
}>

const defaultSeams = (): DocumentPlaneRuntimeSeams => Object.freeze({
  createBackend: (options) => new RendererWebGpuBackend(options),
  createPlane: (options) => new RendererWebGpuDocumentPlane(options),
  createDocumentRenderer,
  createInteraction: (options) => createDocumentInteractionController(options),
  now: () => performance.now(),
})

/**
 * Creates a reusable world-plane projection around caller-owned host resources.
 *
 * The runtime creates no canvas, Engine Renderer, Space, ViewPoint, native input,
 * timer or animation loop. Callers schedule `flush()` through `requestFrame`
 * and present the stable `plane` through their existing Engine lifecycle.
 */
export function createDocumentPlaneRuntime(
  options: CreateDocumentPlaneRuntimeOptions,
): DocumentPlaneRuntime {
  return createDocumentPlaneRuntimeWithSeams(options, defaultSeams())
}

/** Internal exact-seam constructor for owner-independent lifecycle tests. */
export function createDocumentPlaneRuntimeWithSeams(
  options: CreateDocumentPlaneRuntimeOptions,
  seams: DocumentPlaneRuntimeSeams,
): DocumentPlaneRuntime {
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
  let plane: RendererWebGpuDocumentPlane | null = null
  let renderer: DocumentRenderer | null = null
  let interaction: DocumentInteractionController | null = null
  let currentFrame: RenderFrame | null = null
  let unsubscribeMutations = (): void => {}
  let unsubscribeStateChanges = (): void => {}
  let disposed = false
  let requestVersion = 0
  const subscribers = new Set<DocumentPlaneRuntimeFrameSubscriber>()

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
    plane = seams.createPlane({
      content: backend.root,
      viewport: options.viewport,
      worldUnitsPerPixel: options.worldUnitsPerPixel,
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
  const requiredPlane = plane
  let requiredRenderer = renderer
  const requiredInteraction = interaction
  if (
    requiredBackend === null ||
    requiredPlane === null ||
    requiredRenderer === null ||
    requiredInteraction === null
  ) throw new Error("Document plane runtime owners were not created")

  const flush = (): RenderFrame => {
    assertActive(disposed)
    const frame = requiredInteraction.composeFrame(requiredRenderer.flush(), seams.now())
    requiredBackend.applyFrame(frame)
    currentFrame = frame
    for (const subscriber of [...subscribers]) subscriber(frame)
    if (!disposed) options.requestPresentation()
    return frame
  }

  const resize = (
    viewport: RenderViewport,
    worldUnitsPerPixel: number = requiredPlane.worldUnitsPerPixel,
  ): RenderFrame => {
    assertActive(disposed)
    validateViewport(viewport)
    const scale = finitePositive(worldUnitsPerPixel, "worldUnitsPerPixel")
    validatePhysicalExtents(viewport, scale)
    const viewportChanged =
      viewport.width !== requiredPlane.viewport.width ||
      viewport.height !== requiredPlane.viewport.height
    let nextRenderer: DocumentRenderer | null = null
    if (viewportChanged) {
      nextRenderer = seams.createDocumentRenderer({
        document: options.document,
        root: options.root,
        viewport,
        styleSheets,
        interactionState,
      })
    }
    try {
      requiredPlane.configure(viewport, scale)
    } catch (error) {
      nextRenderer?.dispose()
      throw error
    }
    if (nextRenderer !== null) {
      const previous = requiredRenderer
      requiredRenderer = nextRenderer
      renderer = nextRenderer
      previous.dispose()
    }
    return flush()
  }

  const subscribe = (subscriber: DocumentPlaneRuntimeFrameSubscriber): (() => void) => {
    assertActive(disposed)
    if (typeof subscriber !== "function") throw new TypeError("Frame subscriber must be a function")
    subscribers.add(subscriber)
    if (currentFrame !== null) subscriber(currentFrame)
    return () => subscribers.delete(subscriber)
  }

  const runtime: DocumentPlaneRuntime = Object.freeze({
    document: options.document,
    root: options.root,
    styleSheets,
    font: options.font,
    get renderer() { return requiredRenderer },
    interaction: requiredInteraction,
    interactionState,
    backend: requiredBackend,
    plane: requiredPlane,
    get frame() {
      if (currentFrame === null) throw new Error("Document plane runtime has not flushed")
      return currentFrame
    },
    get viewport() { return requiredPlane.viewport },
    get worldUnitsPerPixel() { return requiredPlane.worldUnitsPerPixel },
    get disposed() { return disposed },
    flush,
    resize,
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

const validateOptions = (options: CreateDocumentPlaneRuntimeOptions): void => {
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
  const scale = finitePositive(options.worldUnitsPerPixel, "worldUnitsPerPixel")
  validatePhysicalExtents(options.viewport, scale)
  if (typeof options.invalidateGeometry !== "function") throw new TypeError("invalidateGeometry must be a function")
  if (typeof options.requestFrame !== "function") throw new TypeError("requestFrame must be a function")
  if (typeof options.requestPresentation !== "function") throw new TypeError("requestPresentation must be a function")
}

const validateSeams = (seams: DocumentPlaneRuntimeSeams): void => {
  if (seams === null || typeof seams !== "object") throw new TypeError("Runtime seams are required")
  for (const name of [
    "createBackend",
    "createPlane",
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

const validatePhysicalExtents = (
  viewport: RenderViewport,
  worldUnitsPerPixel: number,
): void => {
  if (
    !Number.isFinite(viewport.width * worldUnitsPerPixel) ||
    !Number.isFinite(viewport.height * worldUnitsPerPixel)
  ) throw new RangeError("document plane physical extents must be finite")
}

const assertActive = (disposed: boolean): void => {
  if (disposed) throw new Error("Document plane runtime is disposed")
}
