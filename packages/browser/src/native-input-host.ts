import {
  CompositionEvent as SemanticCompositionEvent,
  Event as SemanticEvent,
  HTMLInputElement as SemanticHTMLInputElement,
  HTMLSelectElement as SemanticHTMLSelectElement,
  HTMLTextAreaElement as SemanticHTMLTextAreaElement,
  InputEvent as SemanticInputEvent,
  KeyboardEvent as SemanticKeyboardEvent,
  type Document as SemanticDocument,
} from "@zavx0z/dom"

export type DocumentNativeInputTarget =
  | SemanticHTMLInputElement
  | SemanticHTMLSelectElement
  | SemanticHTMLTextAreaElement

type NativeInputProxy = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type NativeTextProxy = HTMLInputElement | HTMLTextAreaElement
type ActiveProxy = "input" | "select" | "textarea" | null

export type CreateDocumentNativeInputHostOptions = Readonly<{
  requestFrame(): void
}>

export type DocumentNativeInputHost = Readonly<{
  nativeInput: HTMLInputElement
  nativeTextArea: HTMLTextAreaElement
  document: SemanticDocument | null
  ownerId: string | null
  inputTarget: DocumentNativeInputTarget | null
  activeProxy: ActiveProxy
  setActiveDocument(document: SemanticDocument | null, ownerId?: string | null): void
  synchronize(): void
  blur(): void
  dispose(): void
}>

export type DocumentNativeInputHostProxies = Readonly<{
  input: HTMLInputElement
  select: HTMLSelectElement
  textarea: HTMLTextAreaElement
  selectionTarget: EventTarget
}>

/** Internal proxy factory seam; not exported from the package. */
export type DocumentNativeInputHostSeams = Readonly<{
  createProxies(): DocumentNativeInputHostProxies
}>

const defaultSeams = (): DocumentNativeInputHostSeams => Object.freeze({
  createProxies() {
    const browserDocument = globalThis.document
    if (!browserDocument?.body) throw new Error("Browser document.body is unavailable")
    const input = browserDocument.createElement("input")
    const select = browserDocument.createElement("select")
    const textarea = browserDocument.createElement("textarea")
    configureProxy(input, "data-renderer-input-proxy")
    configureProxy(select, "data-renderer-select-proxy")
    configureProxy(textarea, "data-renderer-textarea-proxy")
    input.autocomplete = "off"
    try {
      browserDocument.body.append(input, select, textarea)
    } catch (error) {
      input.remove()
      select.remove()
      textarea.remove()
      throw error
    }
    return Object.freeze({input, select, textarea, selectionTarget: browserDocument})
  },
})

/** Creates one reusable native input/control host with exact input/select/textarea proxies. */
export function createDocumentNativeInputHost(
  options: CreateDocumentNativeInputHostOptions,
): DocumentNativeInputHost {
  return createDocumentNativeInputHostWithSeams(options, defaultSeams())
}

/** Internal seam constructor for browser-independent tests. */
export function createDocumentNativeInputHostWithSeams(
  options: CreateDocumentNativeInputHostOptions,
  seams: DocumentNativeInputHostSeams,
): DocumentNativeInputHost {
  if (options === null || typeof options !== "object") throw new TypeError("Native input host options are required")
  if (typeof options.requestFrame !== "function") throw new TypeError("requestFrame must be a function")
  if (seams === null || typeof seams !== "object" || typeof seams.createProxies !== "function") {
    throw new TypeError("Native input host seams are required")
  }
  const proxies = seams.createProxies()
  validateProxies(proxies)
  let document: SemanticDocument | null = null
  let ownerId: string | null = null
  let target: DocumentNativeInputTarget | null = null
  let activeProxy: ActiveProxy = null
  let synchronizing = false
  let disposed = false

  const proxyForTarget = (
    candidate: DocumentNativeInputTarget,
  ): NativeInputProxy =>
    candidate instanceof SemanticHTMLTextAreaElement
      ? proxies.textarea
      : candidate instanceof SemanticHTMLSelectElement
        ? proxies.select
        : proxies.input

  const targetForActiveDocument = (): DocumentNativeInputTarget | null => {
    const active = document?.activeElement
    if (active instanceof SemanticHTMLTextAreaElement) return active.disabled ? null : active
    if (active instanceof SemanticHTMLSelectElement) {
      return active.disabled || active.multiple || active.size > 1 ? null : active
    }
    if (
      active instanceof SemanticHTMLInputElement &&
      !active.disabled &&
      (active.selectionStart !== null || active.type === "number" || active.type === "range")
    ) return active
    return null
  }

  const isSupportedTarget = (candidate: DocumentNativeInputTarget): boolean =>
    candidate instanceof SemanticHTMLTextAreaElement ||
    candidate instanceof SemanticHTMLSelectElement && !candidate.multiple && candidate.size <= 1 ||
    candidate instanceof SemanticHTMLInputElement &&
      (candidate.selectionStart !== null || candidate.type === "number" || candidate.type === "range")

  const blurProxies = (except: NativeInputProxy | null = null): void => {
    if (except !== proxies.input) proxies.input.blur()
    if (except !== proxies.select) proxies.select.blur()
    if (except !== proxies.textarea) proxies.textarea.blur()
  }

  const synchronize = (): void => {
    if (disposed || synchronizing) return
    const active = document?.activeElement
    const disabledActive =
      active instanceof SemanticHTMLInputElement ||
      active instanceof SemanticHTMLSelectElement ||
      active instanceof SemanticHTMLTextAreaElement
        ? active.disabled ? active : null
        : null
    const next = targetForActiveDocument()
    synchronizing = true
    try {
      target = next
      if (next === null) {
        activeProxy = null
        disabledActive?.blur()
        blurProxies()
        return
      }
      const proxy = proxyForTarget(next)
      activeProxy = proxy === proxies.input ? "input" : proxy === proxies.select ? "select" : "textarea"
      mirrorProxy(proxy, next)
      blurProxies(proxy)
      proxy.focus({preventScroll: true})
    } finally {
      synchronizing = false
    }
  }

  const activeTarget = (
    proxy: NativeInputProxy,
  ): DocumentNativeInputTarget | null => {
    if (proxy !== activeNativeProxy(proxies, activeProxy)) return null
    const active = document?.activeElement
    if (target !== null && active === target && !target.disabled && isSupportedTarget(target)) return target
    synchronize()
    return proxy === activeNativeProxy(proxies, activeProxy) ? target : null
  }

  const blur = (): void => {
    if (disposed || synchronizing) return
    const previous = target
    synchronizing = true
    try {
      target = null
      activeProxy = null
      previous?.blur()
      blurProxies()
    } finally {
      synchronizing = false
    }
    options.requestFrame()
  }

  const setActiveDocument = (
    nextDocument: SemanticDocument | null,
    nextOwnerId: string | null = null,
  ): void => {
    if (disposed) throw new Error("Document native input host is disposed")
    if (nextDocument !== null && (typeof nextDocument !== "object" || nextDocument.nodeType !== 9)) {
      throw new TypeError("Active input document must be an @zavx0z/dom Document")
    }
    if (nextOwnerId !== null && (typeof nextOwnerId !== "string" || nextOwnerId.length === 0)) {
      throw new TypeError("Active input owner id must be null or a non-empty string")
    }
    if (document === nextDocument) {
      ownerId = nextDocument === null ? null : nextOwnerId
      synchronize()
      return
    }
    const previousDocument = document
    const previousTarget = target
    synchronizing = true
    try {
      previousDocument?.removeEventListener("focusin", onSemanticFocus)
      previousDocument?.removeEventListener("focusout", onSemanticFocus)
      target = null
      activeProxy = null
      previousTarget?.blur()
      blurProxies()
      document = nextDocument
      ownerId = nextDocument === null ? null : nextOwnerId
      document?.addEventListener("focusin", onSemanticFocus)
      document?.addEventListener("focusout", onSemanticFocus)
    } finally {
      synchronizing = false
    }
    synchronize()
  }

  const onSemanticFocus = (): void => synchronize()

  const onNativeBlur = (
    proxy: NativeInputProxy,
  ): void => {
    if (disposed || synchronizing || proxy !== activeNativeProxy(proxies, activeProxy) || target === null) return
    blur()
  }

  const dispatchKeyboard = (
    proxy: NativeInputProxy,
    event: KeyboardEvent,
    type: "keydown" | "keyup",
  ): void => {
    const current = activeTarget(proxy)
    if (current === null) return
    const accepted = current.dispatchEvent(new SemanticKeyboardEvent(type, {
      bubbles: true,
      cancelable: event.cancelable,
      composed: true,
      key: event.key,
      code: event.code,
      location: event.location,
      repeat: event.repeat,
      isComposing: event.isComposing,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      modifierAltGraph: modifierState(event, "AltGraph"),
      modifierCapsLock: modifierState(event, "CapsLock"),
      modifierFn: modifierState(event, "Fn"),
      modifierFnLock: modifierState(event, "FnLock"),
      modifierHyper: modifierState(event, "Hyper"),
      modifierNumLock: modifierState(event, "NumLock"),
      modifierScrollLock: modifierState(event, "ScrollLock"),
      modifierSuper: modifierState(event, "Super"),
      modifierSymbol: modifierState(event, "Symbol"),
      modifierSymbolLock: modifierState(event, "SymbolLock"),
    }))
    if (!accepted) {
      event.preventDefault()
      return
    }
    if (
      type === "keydown" &&
      current instanceof SemanticHTMLSelectElement &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      current.applyPickerKeyboardDefault(event.key)
    ) {
      event.preventDefault()
      options.requestFrame()
      return
    }
    if (
      type === "keydown" &&
      current instanceof SemanticHTMLInputElement &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      current.applyRangeKeyboardDefault(event.key)
    ) {
      event.preventDefault()
      options.requestFrame()
    }
  }

  const onBeforeInput = (
    proxy: NativeTextProxy,
    event: InputEvent,
  ): void => {
    const current = activeTarget(proxy)
    if (current === null || current instanceof SemanticHTMLSelectElement) return
    const accepted = current.dispatchEvent(new SemanticInputEvent("beforeinput", {
      bubbles: true,
      cancelable: event.cancelable,
      composed: true,
      data: event.data,
      inputType: event.inputType,
      isComposing: event.isComposing,
      dataTransfer: null,
    }))
    if (!accepted) event.preventDefault()
  }

  const onInput = (
    proxy: NativeTextProxy,
    event: InputEvent,
  ): void => {
    const current = activeTarget(proxy)
    if (current === null || current instanceof SemanticHTMLSelectElement) return
    const previousValue = current.value
    const previousSelection = selectionOf(current)
    const nextValue = proxy.value
    const nextSelection = selectionOf(proxy)
    let accepted = true
    document!.transaction(() => {
      if (current.value !== nextValue) current.value = nextValue
      if (previousSelection !== null && nextSelection !== null) applySelection(current, nextSelection)
      accepted = current.dispatchEvent(new SemanticInputEvent("input", {
        bubbles: true,
        cancelable: event.cancelable,
        composed: true,
        data: event.data,
        inputType: event.inputType,
        isComposing: event.isComposing,
        dataTransfer: null,
      }))
      if (!accepted) {
        if (current.value !== previousValue) current.value = previousValue
        if (previousSelection !== null) applySelection(current, previousSelection)
      }
    })
    if (!accepted) {
      event.preventDefault()
      mirrorProxy(proxy, current)
    } else if (proxy.value !== current.value) {
      mirrorProxy(proxy, current)
    }
  }

  const onChange = (proxy: NativeTextProxy): void => {
    const current = activeTarget(proxy)
    if (current === null || current instanceof SemanticHTMLSelectElement) return
    current.dispatchEvent(new SemanticEvent("change", {bubbles: true}))
    options.requestFrame()
  }

  const dispatchComposition = (
    proxy: NativeTextProxy,
    event: CompositionEvent,
    type: "compositionstart" | "compositionupdate" | "compositionend",
  ): void => {
    const current = activeTarget(proxy)
    if (current === null || current instanceof SemanticHTMLSelectElement) return
    const accepted = current.dispatchEvent(new SemanticCompositionEvent(type, {
      bubbles: true,
      cancelable: event.cancelable,
      composed: true,
      data: event.data,
    }))
    if (!accepted) event.preventDefault()
  }

  const onNativeSelection = (
    proxy: NativeTextProxy,
    dispatchSelect: boolean,
  ): void => {
    if (disposed || synchronizing) return
    const current = activeTarget(proxy)
    if (current === null || current instanceof SemanticHTMLSelectElement) return
    const previous = selectionOf(current)
    const next = selectionOf(proxy)
    const changed = previous !== null && next !== null && !sameSelection(previous, next)
    if (changed && next !== null) applySelection(current, next)
    if (dispatchSelect) {
      current.dispatchEvent(new SemanticEvent("select", {bubbles: true, composed: true}))
    }
    if (changed || dispatchSelect) options.requestFrame()
  }

  const handlers = new Map<NativeInputProxy, Readonly<Record<string, (event: Event) => void>>>()

  for (const proxy of [proxies.input, proxies.textarea]) {
    const handler = Object.freeze({
      blur: () => onNativeBlur(proxy),
      keydown: (event: Event) => dispatchKeyboard(proxy, event as KeyboardEvent, "keydown"),
      keyup: (event: Event) => dispatchKeyboard(proxy, event as KeyboardEvent, "keyup"),
      beforeinput: (event: Event) => onBeforeInput(proxy, event as InputEvent),
      input: (event: Event) => onInput(proxy, event as InputEvent),
      change: () => onChange(proxy),
      compositionstart: (event: Event) => dispatchComposition(proxy, event as CompositionEvent, "compositionstart"),
      compositionupdate: (event: Event) => dispatchComposition(proxy, event as CompositionEvent, "compositionupdate"),
      compositionend: (event: Event) => dispatchComposition(proxy, event as CompositionEvent, "compositionend"),
      select: () => onNativeSelection(proxy, true),
      selectionchange: () => onNativeSelection(proxy, false),
    })
    handlers.set(proxy, handler)
    for (const [type, listener] of Object.entries(handler)) {
      proxy.addEventListener(type, listener as EventListener)
    }
  }
  const selectHandler = Object.freeze({
    blur: () => onNativeBlur(proxies.select),
    keydown: (event: Event) => dispatchKeyboard(proxies.select, event as KeyboardEvent, "keydown"),
    keyup: (event: Event) => dispatchKeyboard(proxies.select, event as KeyboardEvent, "keyup"),
  })
  handlers.set(proxies.select, selectHandler)
  for (const [type, listener] of Object.entries(selectHandler)) {
    proxies.select.addEventListener(type, listener as EventListener)
  }
  const onSelectionChange = (): void => {
    const proxy = activeNativeProxy(proxies, activeProxy)
    if (proxy === proxies.input || proxy === proxies.textarea) onNativeSelection(proxy, false)
  }
  proxies.selectionTarget.addEventListener("selectionchange", onSelectionChange)

  const host: DocumentNativeInputHost = Object.freeze({
    nativeInput: proxies.input,
    nativeTextArea: proxies.textarea,
    get document() { return document },
    get ownerId() { return ownerId },
    get inputTarget() { return target },
    get activeProxy() { return activeProxy },
    setActiveDocument,
    synchronize,
    blur,
    dispose() {
      if (disposed) return
      disposed = true
      document?.removeEventListener("focusin", onSemanticFocus)
      document?.removeEventListener("focusout", onSemanticFocus)
      proxies.selectionTarget.removeEventListener("selectionchange", onSelectionChange)
      for (const [proxy, handler] of handlers) {
        for (const [type, listener] of Object.entries(handler)) {
          proxy.removeEventListener(type, listener as EventListener)
        }
      }
      handlers.clear()
      const previous = target
      target = null
      activeProxy = null
      document = null
      ownerId = null
      synchronizing = true
      previous?.blur()
      blurProxies()
      synchronizing = false
      proxies.input.remove()
      proxies.select.remove()
      proxies.textarea.remove()
    },
  })
  return host
}

type SelectionSnapshot = Readonly<{
  start: number
  end: number
  direction: "forward" | "backward" | "none"
}>

const selectionOf = (
  target: DocumentNativeInputTarget | NativeInputProxy,
): SelectionSnapshot | null => {
  if (target instanceof SemanticHTMLSelectElement || !("setSelectionRange" in target)) return null
  const textTarget = target as SemanticHTMLInputElement |
    SemanticHTMLTextAreaElement |
    NativeTextProxy
  const start = textTarget.selectionStart
  if (start === null) return null
  const end = textTarget.selectionEnd ?? start
  const direction = textTarget.selectionDirection
  return Object.freeze({
    start,
    end,
    direction: direction === "forward" || direction === "backward" ? direction : "none",
  })
}

const applySelection = (
  target: DocumentNativeInputTarget,
  selection: SelectionSnapshot,
): void => {
  if (target instanceof SemanticHTMLSelectElement) return
  target.setSelectionRange(selection.start, selection.end, selection.direction)
}

const sameSelection = (left: SelectionSnapshot, right: SelectionSnapshot): boolean =>
  left.start === right.start && left.end === right.end && left.direction === right.direction

const mirrorProxy = (
  proxy: NativeInputProxy,
  target: DocumentNativeInputTarget,
): void => {
  if (target instanceof SemanticHTMLSelectElement) {
    const nativeSelect = proxy as HTMLSelectElement
    nativeSelect.disabled = target.disabled
    return
  }
  if (target instanceof SemanticHTMLInputElement) {
    const nativeInput = proxy as HTMLInputElement
    nativeInput.type = target.type
    nativeInput.min = target.min
    nativeInput.max = target.max
    nativeInput.step = target.step
  }
  const textProxy = proxy as NativeTextProxy
  textProxy.readOnly = target.readOnly
  textProxy.disabled = target.disabled
  try {
    textProxy.value = target.value
    const selection = selectionOf(target)
    if (selection !== null) {
      textProxy.setSelectionRange(selection.start, selection.end, selection.direction)
    }
  } catch (error) {
    throw new Error("Native text proxy cannot mirror semantic value and selection", {cause: error})
  }
}

const activeNativeProxy = (
  proxies: DocumentNativeInputHostProxies,
  active: ActiveProxy,
): NativeInputProxy | null =>
  active === "input"
    ? proxies.input
    : active === "select"
      ? proxies.select
      : active === "textarea"
        ? proxies.textarea
        : null

const configureProxy = (
  proxy: NativeInputProxy,
  marker: string,
): void => {
  proxy.tabIndex = -1
  proxy.setAttribute(marker, "")
  proxy.style.position = "fixed"
  proxy.style.left = "-10000px"
  proxy.style.top = "0"
  proxy.style.width = "1px"
  proxy.style.height = "1px"
  proxy.style.opacity = "0"
  proxy.style.pointerEvents = "none"
}

const validateProxies = (proxies: DocumentNativeInputHostProxies): void => {
  if (
    proxies === null ||
    typeof proxies !== "object" ||
    proxies.input === null ||
    typeof proxies.input.addEventListener !== "function" ||
    proxies.select === null ||
    typeof proxies.select.addEventListener !== "function" ||
    proxies.textarea === null ||
    typeof proxies.textarea.addEventListener !== "function" ||
    proxies.selectionTarget === null ||
    typeof proxies.selectionTarget.addEventListener !== "function"
  ) throw new TypeError("Native input host requires input, select, textarea and selection event owners")
}

const modifierState = (event: KeyboardEvent, key: string): boolean => {
  try {
    return event.getModifierState(key)
  } catch {
    return false
  }
}
