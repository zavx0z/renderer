import {
  Renderer as EngineRenderer,
  Space,
  ViewPoint,
  type TrueTypeFont,
} from "@engine/core"
import {
  subscribeDocumentCompiledStyleSheets,
  type Document,
  type Node,
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
import {
  createDocumentNativeInputHost,
  type DocumentNativeInputHost,
  type DocumentNativeInputTarget,
} from "./native-input-host.ts"
import {claimBrowserPresentationHost} from "./presentation-host.ts"

export type CreateDocumentCanvasRuntimeOptions = Readonly<{
  canvas: HTMLCanvasElement
  document: Document
  root: Node
  styleSheets: readonly string[]
  font: TrueTypeFont
  pixelRatio?: number
  tooltipDelayMs?: number
  distance?: number
}>

export type DocumentCanvasFrameSubscriber = (frame: RenderFrame) => void

/** One browser-owned composition of the semantic, CPU, GPU and Engine owners. */
export type DocumentCanvasRuntime = Readonly<{
  canvas: HTMLCanvasElement
  document: Document
  root: Node
  styleSheets: readonly string[]
  font: TrueTypeFont
  engineRenderer: EngineRenderer
  space: Space
  viewPoint: ViewPoint
  documentRenderer: DocumentRenderer
  interaction: DocumentInteractionController
  backend: RendererWebGpuBackend
  overlay: RendererWebGpuScreenOverlay
  nativeInputHost: DocumentNativeInputHost
  nativeInput: HTMLInputElement
  nativeTextArea: HTMLTextAreaElement
  inputTarget: DocumentNativeInputTarget | null
  viewport: RenderViewport
  currentFrame: RenderFrame
  disposed: boolean
  render(): RenderFrame
  requestRender(): void
  resize(): RenderFrame
  captureLastPresentedFramePng(): Promise<Blob | null>
  subscribe(subscriber: DocumentCanvasFrameSubscriber): () => void
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

/** Internal host seams used by focused tests; not re-exported from the package. */
export type DocumentCanvasRuntimeSeams = Readonly<{
  createEngineRenderer(): EngineRenderer
  initializeEngineRenderer(renderer: EngineRenderer, canvas: HTMLCanvasElement): Promise<void>
  createSpace(): Space
  createFixedViewPoint(canvas: HTMLCanvasElement, distance: number): ViewPoint
  createBackend(options: RendererWebGpuBackendOptions): RendererWebGpuBackend
  createOverlay(options: RendererWebGpuScreenOverlayOptions): RendererWebGpuScreenOverlay
  createDocumentRenderer(options: CreateDocumentRendererOptions): DocumentRenderer
  createInteraction(options: Readonly<{
    document: Document
    interactionState: DocumentInteractionState
    tooltipDelayMs: number
  }>): DocumentInteractionController
  createNativeInputHost(options: Readonly<{requestFrame(): void}>): DocumentNativeInputHost
  createResizeObserver(callback: () => void): ResizeObserverOwner
  readCanvasRect(canvas: HTMLCanvasElement): CanvasRect
  devicePixelRatio(): number
  requestFrame(callback: () => void): unknown
  cancelFrame(handle: unknown): void
  setTimer(callback: () => void, delayMs: number): unknown
  clearTimer(handle: unknown): void
  now(): number
}>

const defaultSeams = (): DocumentCanvasRuntimeSeams => Object.freeze({
  createEngineRenderer: () => new EngineRenderer(),
  initializeEngineRenderer: (renderer, canvas) => renderer.init(canvas),
  createSpace: () => new Space(),
  createFixedViewPoint(canvas, distance) {
    const viewPoint = new ViewPoint({
      element: canvas,
      fov: Math.PI / 4,
      near: 0.1,
      far: Math.max(5_000, distance * 2),
      position: {x: 0, y: 0, z: 0},
      target: {x: 0, y: 1, z: 0},
    })
    viewPoint.dispose()
    return viewPoint
  },
  createBackend: (options) => new RendererWebGpuBackend(options),
  createOverlay: (options) => new RendererWebGpuScreenOverlay(options),
  createDocumentRenderer,
  createInteraction: (options) => createDocumentInteractionController(options),
  createNativeInputHost: (options) => createDocumentNativeInputHost(options),
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

/**
Creates one complete isolated browser Experience around a caller-owned semantic
tree. A component, panel, display or overlay inside another Experience must use
that Experience's `DocumentSpaceRuntime` projection roots instead.

The required font is already resolved by the caller. This function performs no
network fetch, DOM mirroring, UI composition or Storybook lifecycle work.
*/
export async function createDocumentCanvasRuntime(
  options: CreateDocumentCanvasRuntimeOptions,
): Promise<DocumentCanvasRuntime> {
  return createDocumentCanvasRuntimeWithSeams(options, defaultSeams())
}

/** Internal exact-seam constructor for GPU-independent lifecycle tests. */
export async function createDocumentCanvasRuntimeWithSeams(
  options: CreateDocumentCanvasRuntimeOptions,
  seams: DocumentCanvasRuntimeSeams,
): Promise<DocumentCanvasRuntime> {
  validateOptions(options)
  const presentationHostClaim = claimBrowserPresentationHost(options.canvas)
  try {
    return await createClaimedDocumentCanvasRuntime(options, seams, presentationHostClaim)
  } catch (error) {
    presentationHostClaim.release()
    throw error
  }
}

const createClaimedDocumentCanvasRuntime = async (
  options: CreateDocumentCanvasRuntimeOptions,
  seams: DocumentCanvasRuntimeSeams,
  presentationHostClaim: ReturnType<typeof claimBrowserPresentationHost>,
): Promise<DocumentCanvasRuntime> => {
  const styleSheets = Object.freeze([...options.styleSheets])
  const tooltipDelayMs = finiteNonNegative(options.tooltipDelayMs ?? 500, "tooltipDelayMs")
  const distance = finitePositive(options.distance ?? 600, "distance")
  const fixedPixelRatio = options.pixelRatio === undefined
    ? null
    : finitePositive(options.pixelRatio, "pixelRatio")
  const engineRenderer = seams.createEngineRenderer()
  await seams.initializeEngineRenderer(engineRenderer, options.canvas)
  const space = seams.createSpace()
  const viewPoint = seams.createFixedViewPoint(options.canvas, distance)
  let requestBackendPresentation = (): void => {}
  const backend = seams.createBackend({
    font: options.font,
    invalidateGeometry: (geometry) => engineRenderer.invalidateGeometry(geometry),
    requestPresentation: () => requestBackendPresentation(),
  })
  let viewport = readViewport(options.canvas, seams)
  const interactionState = createDocumentInteractionState(options.document)
  let documentRenderer = seams.createDocumentRenderer({
    document: options.document,
    root: options.root,
    viewport,
    styleSheets,
    interactionState,
  })
  const interaction = seams.createInteraction({
    document: options.document,
    interactionState,
    tooltipDelayMs,
  })
  const overlay = seams.createOverlay({content: backend.root, viewport, distance})
  const subscribers = new Set<DocumentCanvasFrameSubscriber>()
  const capturedPointers = new Set<number>()
  let currentFrame: RenderFrame | null = null
  let resizeObserver: ResizeObserverOwner | null = null
  let requestedFrame: unknown | null = null
  let tooltipTimer: unknown | null = null
  let unsubscribeMutations = (): void => {}
  let unsubscribeStateChanges = (): void => {}
  let unsubscribeStyleSheets = (): void => {}
  let inputHost: DocumentNativeInputHost | null = null
  let disposed = false

  const render = (): RenderFrame => {
    assertActive(disposed)
    if (requestedFrame !== null) {
      seams.cancelFrame(requestedFrame)
      requestedFrame = null
    }
    inputHost?.synchronize()
    const frame = interaction.composeFrame(documentRenderer.flush(), seams.now())
    backend.applyFrame(frame)
    space.updateWorldMatrix()
    viewPoint.update()
    engineRenderer.renderFrame(space, overlay, viewPoint)
    currentFrame = frame
    for (const subscriber of [...subscribers]) subscriber(frame)
    return frame
  }

  const requestRender = (): void => {
    assertActive(disposed)
    if (requestedFrame !== null) return
    requestedFrame = seams.requestFrame(() => {
      requestedFrame = null
      if (!disposed) render()
    })
  }
  requestBackendPresentation = (): void => {
    if (!disposed) requestRender()
  }

  try {
    inputHost = seams.createNativeInputHost({requestFrame: requestRender})
    inputHost.setActiveDocument(options.document)
    unsubscribeMutations = options.document.subscribeMutations(() => {
      inputHost?.synchronize()
      requestRender()
    })
    unsubscribeStateChanges = options.document.subscribeStateChanges(() => {
      inputHost?.synchronize()
      requestRender()
    })
    unsubscribeStyleSheets = subscribeDocumentCompiledStyleSheets(options.document, requestRender)
  } catch (error) {
    if (requestedFrame !== null) seams.cancelFrame(requestedFrame)
    requestBackendPresentation = (): void => {}
    unsubscribeMutations()
    unsubscribeStateChanges()
    unsubscribeStyleSheets()
    inputHost?.dispose()
    interaction.dispose()
    documentRenderer.dispose()
    backend.dispose()
    throw error
  }

  const resize = (): RenderFrame => {
    assertActive(disposed)
    const next = readViewport(options.canvas, seams)
    const ratio = fixedPixelRatio ?? finitePositiveOrOne(seams.devicePixelRatio())
    engineRenderer.setPixelRatio(ratio)
    engineRenderer.setSize(next.width, next.height)
    viewPoint.setAspectRatio(next.width / next.height)
    if (next.width !== viewport.width || next.height !== viewport.height) {
      const previous = documentRenderer
      documentRenderer = seams.createDocumentRenderer({
        document: options.document,
        root: options.root,
        viewport: next,
        styleSheets,
        interactionState,
      })
      viewport = next
      overlay.resize(next)
      previous.dispose()
    }
    return render()
  }

  const pointerInput = (event: PointerEvent): PointerInput => {
    const rect = seams.readCanvasRect(options.canvas)
    return Object.freeze({
      clientX: (event.clientX - rect.left) * viewport.width / positiveExtent(rect.width),
      clientY: (event.clientY - rect.top) * viewport.height / positiveExtent(rect.height),
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      button: event.button,
      buttons: event.buttons,
      pressure: event.pressure,
      isPrimary: event.isPrimary,
      timeStamp: event.timeStamp,
    })
  }

  const wheelInput = (event: WheelEvent): WheelInput => {
    const rect = seams.readCanvasRect(options.canvas)
    return Object.freeze({
      clientX: (event.clientX - rect.left) * viewport.width / positiveExtent(rect.width),
      clientY: (event.clientY - rect.top) * viewport.height / positiveExtent(rect.height),
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    })
  }

  const scheduleTooltipFrame = (): void => {
    if (tooltipTimer !== null) seams.clearTimer(tooltipTimer)
    tooltipTimer = seams.setTimer(() => {
      tooltipTimer = null
      if (!disposed) render()
    }, tooltipDelayMs + 1)
  }

  const onPointerMove = (event: PointerEvent): void => {
    if (disposed) return
    interaction.pointerMove(documentRenderer.flush(), pointerInput(event))
    render()
    scheduleTooltipFrame()
  }
  const onPointerDown = (event: PointerEvent): void => {
    if (disposed) return
    const target = interaction.pointerDown(documentRenderer.flush(), pointerInput(event))
    if (target !== null && event.cancelable) event.preventDefault()
    if (target === null) inputHost?.blur()
    else inputHost?.synchronize()
    options.canvas.setPointerCapture?.(event.pointerId)
    capturedPointers.add(event.pointerId)
    render()
  }
  const releasePointer = (pointerId: number): void => {
    if (options.canvas.hasPointerCapture?.(pointerId)) {
      options.canvas.releasePointerCapture(pointerId)
    }
    capturedPointers.delete(pointerId)
  }
  const onPointerUp = (event: PointerEvent): void => {
    if (disposed) return
    interaction.pointerUp(documentRenderer.flush(), pointerInput(event))
    releasePointer(event.pointerId)
    render()
  }
  const onPointerCancel = (event: PointerEvent): void => {
    if (disposed) return
    interaction.pointerCancel(documentRenderer.flush(), pointerInput(event))
    releasePointer(event.pointerId)
    render()
  }
  const onWheel = (event: WheelEvent): void => {
    if (disposed) return
    const target = interaction.wheel(documentRenderer.flush(), wheelInput(event))
    if (target !== null) {
      event.preventDefault()
      render()
    }
  }

  const subscribe = (subscriber: DocumentCanvasFrameSubscriber): (() => void) => {
    assertActive(disposed)
    if (typeof subscriber !== "function") throw new TypeError("Frame subscriber must be a function")
    subscribers.add(subscriber)
    if (currentFrame !== null) subscriber(currentFrame)
    return () => subscribers.delete(subscriber)
  }

  const captureLastPresentedFramePng = (): Promise<Blob | null> => {
    assertActive(disposed)
    return engineRenderer.captureLastPresentedFramePng()
  }

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    requestBackendPresentation = (): void => {}
    if (requestedFrame !== null) seams.cancelFrame(requestedFrame)
    if (tooltipTimer !== null) seams.clearTimer(tooltipTimer)
    requestedFrame = null
    tooltipTimer = null
    resizeObserver?.disconnect()
    resizeObserver = null
    options.canvas.removeEventListener("pointermove", onPointerMove)
    options.canvas.removeEventListener("pointerdown", onPointerDown)
    options.canvas.removeEventListener("pointerup", onPointerUp)
    options.canvas.removeEventListener("pointercancel", onPointerCancel)
    options.canvas.removeEventListener("wheel", onWheel)
    for (const pointerId of capturedPointers) releasePointer(pointerId)
    capturedPointers.clear()
    subscribers.clear()
    unsubscribeMutations()
    unsubscribeStateChanges()
    unsubscribeStyleSheets()
    inputHost?.dispose()
    inputHost = null
    interaction.dispose()
    documentRenderer.dispose()
    backend.dispose()
    presentationHostClaim.release()
  }

  const runtime: DocumentCanvasRuntime = Object.freeze({
    canvas: options.canvas,
    document: options.document,
    root: options.root,
    styleSheets,
    font: options.font,
    engineRenderer,
    space,
    viewPoint,
    get documentRenderer() {
      return documentRenderer
    },
    interaction,
    backend,
    overlay,
    get nativeInputHost() {
      if (inputHost === null) throw new Error("Document native input host is unavailable")
      return inputHost
    },
    get nativeInput() {
      if (inputHost === null) throw new Error("Document native input host is unavailable")
      return inputHost.nativeInput
    },
    get nativeTextArea() {
      if (inputHost === null) throw new Error("Document native input host is unavailable")
      return inputHost.nativeTextArea
    },
    get inputTarget() {
      return inputHost?.inputTarget ?? null
    },
    get viewport() {
      return viewport
    },
    get currentFrame() {
      if (currentFrame === null) throw new Error("Document canvas runtime has not rendered")
      return currentFrame
    },
    get disposed() {
      return disposed
    },
    render,
    requestRender,
    resize,
    captureLastPresentedFramePng,
    subscribe,
    dispose,
  })

  try {
    options.canvas.addEventListener("pointermove", onPointerMove)
    options.canvas.addEventListener("pointerdown", onPointerDown)
    options.canvas.addEventListener("pointerup", onPointerUp)
    options.canvas.addEventListener("pointercancel", onPointerCancel)
    options.canvas.addEventListener("wheel", onWheel, {passive: false})
    resizeObserver = seams.createResizeObserver(() => {
      if (!disposed) resize()
    })
    resizeObserver.observe(options.canvas)
    resize()
    return runtime
  } catch (error) {
    dispose()
    throw error
  }
}

function validateOptions(options: CreateDocumentCanvasRuntimeOptions): void {
  if (options === null || typeof options !== "object") throw new TypeError("Runtime options are required")
  if (
    options.canvas === null ||
    typeof options.canvas !== "object" ||
    typeof options.canvas.addEventListener !== "function" ||
    typeof options.canvas.getBoundingClientRect !== "function"
  ) throw new TypeError("canvas must be an HTMLCanvasElement-compatible owner")
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
}

function readViewport(canvas: HTMLCanvasElement, seams: DocumentCanvasRuntimeSeams): RenderViewport {
  const rect = seams.readCanvasRect(canvas)
  return Object.freeze({
    width: Math.max(1, Math.round(finiteOrZero(rect.width))),
    height: Math.max(1, Math.round(finiteOrZero(rect.height))),
  })
}

function positiveExtent(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function finitePositiveOrOne(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and positive`)
  return value
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and non-negative`)
  return value
}

function assertActive(disposed: boolean): void {
  if (disposed) throw new Error("Document canvas runtime is disposed")
}
