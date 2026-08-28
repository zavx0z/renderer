import {
  CharacterData,
  Comment,
  CompositionEvent,
  CustomEvent,
  DOMRectReadOnly,
  DOMTokenList,
  Document,
  DocumentFragment,
  Element,
  Event,
  EventTarget,
  FocusEvent,
  HTMLButtonElement,
  HTMLDivElement,
  HTMLElement,
  HTMLFieldSetElement,
  HTMLHeadingElement,
  HTMLImageElement,
  HTMLInputElement,
  HTMLLabelElement,
  HTMLLIElement,
  HTMLLegendElement,
  HTMLMeterElement,
  HTMLOptionElement,
  HTMLParagraphElement,
  HTMLProgressElement,
  HTMLSelectElement,
  HTMLSpanElement,
  HTMLTableCellElement,
  HTMLTableElement,
  HTMLTableRowElement,
  HTMLTableSectionElement,
  HTMLTextAreaElement,
  HTMLUListElement,
  InputEvent,
  KeyboardEvent,
  MouseEvent,
  Node,
  NodeList,
  PointerEvent,
  Text,
  ToggleEvent,
  UIEvent,
  WheelEvent,
  attachDocumentRenderReadAdapter,
} from "@zavx0z/dom"
import {
  getRendererComputedStyle,
  type DocumentRenderer,
  type RenderFrame,
} from "@zavx0z/renderer"
import {
  WebRealmCSSStyleDeclaration,
  createComputedStyleDeclaration,
} from "./computed-style.ts"
import {WEB_REALM_BINDING_NAMES} from "./binding-names.ts"
import {invalidState, notSupported} from "./errors.ts"
import type {
  WebRealmCancelAnimationFrame,
  WebRealmClearTimer,
  WebRealmConsole,
  WebRealmCrypto,
  WebRealmFetch,
  WebRealmHistory,
  WebRealmLocation,
  WebRealmNavigator,
  WebRealmPerformance,
  WebRealmPlatformHost,
  WebRealmRequestAnimationFrame,
  WebRealmSetTimer,
  WebRealmURLConstructor,
  WebRealmURLSearchParamsConstructor,
} from "./platform.ts"

const semanticConstructors = Object.freeze({
  EventTarget,
  Event,
  CustomEvent,
  ToggleEvent,
  UIEvent,
  FocusEvent,
  InputEvent,
  KeyboardEvent,
  CompositionEvent,
  MouseEvent,
  WheelEvent,
  PointerEvent,
  Node,
  NodeList,
  DOMTokenList,
  DOMRectReadOnly,
  Document,
  DocumentFragment,
  CharacterData,
  Text,
  Comment,
  Element,
  HTMLElement,
  HTMLDivElement,
  HTMLFieldSetElement,
  HTMLHeadingElement,
  HTMLSpanElement,
  HTMLButtonElement,
  HTMLInputElement,
  HTMLImageElement,
  HTMLLabelElement,
  HTMLLIElement,
  HTMLLegendElement,
  HTMLMeterElement,
  HTMLOptionElement,
  HTMLParagraphElement,
  HTMLProgressElement,
  HTMLSelectElement,
  HTMLTableCellElement,
  HTMLTableElement,
  HTMLTableRowElement,
  HTMLTableSectionElement,
  HTMLTextAreaElement,
  HTMLUListElement,
})

export type WebRealmRendererBridge = Readonly<{
  getRenderer(): DocumentRenderer
  flush(): RenderFrame
}>

export type CreateWebRealmOptions = Readonly<{
  document: Document
  platformWindow: WebRealmPlatformHost
}>

export type WebRealm = Readonly<{
  document: Document
  window: WebRealmWindow
  bindings: WebRealmBindings
  disposed: boolean
  attachRenderer(bridge: WebRealmRendererBridge): () => void
  dispose(): void
}>

type RealmState = {
  readonly document: Document
  readonly host: WebRealmPlatformHost
  readonly functions: Map<string, Function>
  bridge: WebRealmRendererBridge | null
  renderer: DocumentRenderer | null
  disposed: boolean
  window: WebRealmWindow | null
}

const supportedNames = new Set<string>(WEB_REALM_BINDING_NAMES)

/** Standard-named, non-native Window facade. Its constructor is deliberately illegal. */
export class WebRealmWindow {
  constructor() {
    throw new TypeError("Illegal constructor")
  }

  get [Symbol.toStringTag](): string {
    return "Window"
  }
}

export type WebRealmBindings = Readonly<typeof semanticConstructors> & Readonly<{
  window: WebRealmWindow
  self: WebRealmWindow
  globalThis: WebRealmWindow
  document: Document
  Window: typeof WebRealmWindow
  CSSStyleDeclaration: typeof WebRealmCSSStyleDeclaration
  getComputedStyle(element: Element, pseudoElement?: string | null): WebRealmCSSStyleDeclaration
  URL: WebRealmURLConstructor
  URLSearchParams: WebRealmURLSearchParamsConstructor
  location: WebRealmLocation
  history: WebRealmHistory
  navigator: WebRealmNavigator
  performance: WebRealmPerformance
  crypto: WebRealmCrypto
  console: WebRealmConsole
  fetch: WebRealmFetch
  setTimeout: WebRealmSetTimer
  clearTimeout: WebRealmClearTimer
  setInterval: WebRealmSetTimer
  clearInterval: WebRealmClearTimer
  queueMicrotask(callback: () => void): void
  requestAnimationFrame: WebRealmRequestAnimationFrame
  cancelAnimationFrame: WebRealmCancelAnimationFrame
  devicePixelRatio: number
}>

export interface WebRealmWindow extends WebRealmBindings {}

export function createWebRealm(options: CreateWebRealmOptions): WebRealm {
  if (!options || typeof options !== "object") throw new TypeError("Web realm options are required")
  if (!(options.document instanceof Document)) {
    throw new TypeError("document must be an exact @zavx0z/dom Document")
  }
  if (!options.platformWindow || typeof options.platformWindow !== "object") {
    throw new TypeError("platformWindow must be the browser platform host")
  }

  const state: RealmState = {
    document: options.document,
    host: options.platformWindow,
    functions: new Map(),
    bridge: null,
    renderer: null,
    disposed: false,
    window: null,
  }
  const window = createWindowFacade(state)
  state.window = window
  const detachReadAdapter = attachDocumentRenderReadAdapter(options.document, {
    getBoundingClientRect: element => boundingClientRect(state, element),
  })

  const attachRenderer = (bridge: WebRealmRendererBridge): (() => void) => {
    assertActive(state)
    if (state.bridge !== null) throw invalidState("The web realm already has a renderer bridge")
    const renderer = validateBridge(state.document, bridge)
    state.bridge = bridge
    state.renderer = renderer
    let attached = true
    return () => {
      if (!attached) return
      attached = false
      if (state.bridge === bridge) {
        state.bridge = null
        state.renderer = null
      }
    }
  }

  const dispose = (): void => {
    if (state.disposed) return
    state.disposed = true
    state.bridge = null
    state.renderer = null
    state.functions.clear()
    detachReadAdapter()
  }

  return Object.freeze({
    document: options.document,
    window,
    bindings: window,
    get disposed() { return state.disposed },
    attachRenderer,
    dispose,
  })
}

const createWindowFacade = (state: RealmState): WebRealmWindow => {
  const target = Object.create(WebRealmWindow.prototype) as WebRealmWindow
  const proxy = new Proxy(target, {
    get(_target, property, receiver) {
      if (typeof property === "symbol") return Reflect.get(target, property, receiver)
      if (Reflect.has(target, property)) return Reflect.get(target, property, receiver)
      if (!supportedNames.has(property)) {
        throw notSupported(`window.${property} is outside the web-realm support matrix`)
      }
      return readBinding(state, property)
    },
    has(_target, property) {
      return typeof property === "string"
        ? supportedNames.has(property) || Reflect.has(target, property)
        : Reflect.has(target, property)
    },
    ownKeys() {
      return [...WEB_REALM_BINDING_NAMES]
    },
    getOwnPropertyDescriptor(_target, property) {
      if (typeof property !== "string" || !supportedNames.has(property)) return undefined
      return {configurable: true, enumerable: true}
    },
    set() {
      throw new TypeError("WebRealmWindow bindings are read-only")
    },
    defineProperty() {
      throw new TypeError("WebRealmWindow bindings are read-only")
    },
    deleteProperty() {
      throw new TypeError("WebRealmWindow bindings are read-only")
    },
  })
  return proxy
}

const readBinding = (state: RealmState, name: string): unknown => {
  assertActive(state)
  if (name === "window" || name === "self" || name === "globalThis") return state.window
  if (name === "document") return state.document
  if (name === "Window") return WebRealmWindow
  if (name === "CSSStyleDeclaration") return WebRealmCSSStyleDeclaration
  if (name === "getComputedStyle") return realmFunction(state, name, () => (
    element: Element,
    pseudoElement?: string | null,
  ) => readComputedStyle(state, element, pseudoElement))
  if (Object.prototype.hasOwnProperty.call(semanticConstructors, name)) {
    return semanticConstructors[name as keyof typeof semanticConstructors]
  }
  if (name === "devicePixelRatio") return hostNumber(state, name)
  if (name === "location" || name === "history" || name === "navigator" ||
    name === "performance" || name === "crypto" || name === "console") {
    return hostObject(state, name)
  }
  if (name === "URL" || name === "URLSearchParams") return hostConstructor(state, name)
  return hostFunction(state, name)
}

const readComputedStyle = (
  state: RealmState,
  element: Element,
  pseudoElement?: string | null,
): WebRealmCSSStyleDeclaration => {
  assertActive(state)
  if (!(element instanceof Element) || element.ownerDocument !== state.document) {
    throw new TypeError("getComputedStyle() expects an Element from this web realm")
  }
  if (pseudoElement !== undefined && pseudoElement !== null && pseudoElement !== "") {
    throw notSupported("Pseudo-element computed style is unsupported")
  }
  const bridge = requireBridge(state)
  const renderer = state.renderer
  if (renderer === null) throw invalidState("The web realm renderer is detached")
  readFrame(state, bridge)
  return createComputedStyleDeclaration(
    getRendererComputedStyle(renderer, element),
  )
}

const boundingClientRect = (state: RealmState, element: Element): DOMRectReadOnly => {
  assertActive(state)
  if (element.ownerDocument !== state.document) {
    throw new TypeError("The Element belongs to another web realm")
  }
  if (!element.isConnected) return new DOMRectReadOnly()
  const frame = readFrame(state, requireBridge(state))
  const box = frame.boxByNode.get(element)
  if (!box) return new DOMRectReadOnly()
  const firstX = box.transform.scaleX * box.x + box.transform.translateX
  const secondX = box.transform.scaleX * (box.x + box.width) + box.transform.translateX
  const firstY = box.transform.scaleY * box.y + box.transform.translateY
  const secondY = box.transform.scaleY * (box.y + box.height) + box.transform.translateY
  return new DOMRectReadOnly(
    Math.min(firstX, secondX),
    Math.min(firstY, secondY),
    Math.abs(secondX - firstX),
    Math.abs(secondY - firstY),
  )
}

const validateBridge = (
  document: Document,
  bridge: WebRealmRendererBridge,
): DocumentRenderer => {
  if (!bridge || typeof bridge.getRenderer !== "function" || typeof bridge.flush !== "function") {
    throw new TypeError("A renderer bridge with getRenderer() and flush() is required")
  }
  const renderer = bridge.getRenderer()
  if (renderer.document !== document) throw new TypeError("Renderer bridge belongs to another Document")
  return renderer
}

const readFrame = (state: RealmState, bridge: WebRealmRendererBridge): RenderFrame => {
  const renderer = bridge.getRenderer()
  if (renderer !== state.renderer) {
    throw new TypeError("Renderer bridge changed to another DocumentRenderer")
  }
  const frame = bridge.flush()
  if (frame.document !== state.document) throw new TypeError("Renderer frame belongs to another Document")
  if (state.renderer !== renderer || bridge.getRenderer() !== renderer) {
    throw new TypeError("Renderer bridge changed during flush")
  }
  if (frame.root !== renderer.root) throw new TypeError("Renderer frame belongs to another root")
  return frame
}

const requireBridge = (state: RealmState): WebRealmRendererBridge => {
  if (state.bridge === null) {
    throw notSupported("Renderer-backed reads require attachRenderer() on this web realm")
  }
  return state.bridge
}

const hostValue = (state: RealmState, name: string): unknown =>
  Reflect.get(state.host, name, state.host)

const hostObject = (state: RealmState, name: string): object => {
  const value = hostValue(state, name)
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    throw notSupported(`Platform capability window.${name} is unavailable`)
  }
  return value
}

const hostConstructor = (state: RealmState, name: string): Function => {
  const value = hostValue(state, name)
  if (typeof value !== "function") {
    throw notSupported(`Platform constructor window.${name} is unavailable`)
  }
  return value
}

const hostNumber = (state: RealmState, name: string): number => {
  const value = hostValue(state, name)
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw notSupported(`Platform numeric capability window.${name} is unavailable`)
  }
  return value
}

const hostFunction = (state: RealmState, name: string): Function =>
  realmFunction(state, name, () => {
    const value = hostValue(state, name)
    if (typeof value !== "function") {
      return () => {
        throw notSupported(`Platform function window.${name} is unavailable`)
      }
    }
    return value.bind(state.host) as Function
  })

const realmFunction = (
  state: RealmState,
  name: string,
  create: () => Function,
): Function => {
  const existing = state.functions.get(name)
  if (existing) return existing
  const value = create()
  state.functions.set(name, value)
  return value
}

const assertActive = (state: RealmState): void => {
  if (state.disposed) throw invalidState("The web realm is disposed")
}
