import {
  acquireDocumentAuthorStyleSheetOwner,
  type Document,
  type DocumentAuthorStyleSheet,
  type DocumentAuthorStyleSheetOwner
} from "@zavx0z/dom"

export type BrowserLinkedAuthorStyleSheetSource = Readonly<{
  id: string
  link: HTMLLinkElement
}>

export type BrowserLinkedAuthorStyleSheetErrorHandler = (
  error: Error,
  source: BrowserLinkedAuthorStyleSheetSource | null
) => void

export type CreateBrowserLinkedAuthorStyleSheetHostOptions = Readonly<{
  canvas: HTMLCanvasElement
  document: Document
  sources: readonly BrowserLinkedAuthorStyleSheetSource[]
  onError?: BrowserLinkedAuthorStyleSheetErrorHandler
}>

export type BrowserLinkedAuthorStyleSheetHost = Readonly<{
  canvas: HTMLCanvasElement
  document: Document
  sources: readonly BrowserLinkedAuthorStyleSheetSource[]
  ready: Promise<void>
  disposed: boolean
  refresh(): void
  dispose(): void
}>

type ObservedMutation = Readonly<{
  target: unknown
  type: "attributes" | "childList"
  attributeName: string | null
  addedNodes: readonly unknown[]
  removedNodes: readonly unknown[]
}>

type MutationObserverOwner = Readonly<{
  observe(target: unknown, options: MutationObserverInit): void
  disconnect(): void
}>

/** Internal seams for focused lifecycle tests; not re-exported by the package. */
export type BrowserLinkedAuthorStyleSheetHostSeams = Readonly<{
  createMutationObserver(
    ownerDocument: globalThis.Document,
    callback: (records: readonly ObservedMutation[]) => void
  ): MutationObserverOwner
}>

/**
 * Mirrors only explicitly supplied browser-loaded stylesheet links into one
 * semantic Document. Initial native loading is awaited; CSS is never fetched again.
 */
export function createBrowserLinkedAuthorStyleSheetHost(
  options: CreateBrowserLinkedAuthorStyleSheetHostOptions
): BrowserLinkedAuthorStyleSheetHost {
  return createBrowserLinkedAuthorStyleSheetHostWithSeams(options, defaultSeams())
}

/** Internal exact-seam constructor for deterministic CSSOM/lifecycle evidence. */
export function createBrowserLinkedAuthorStyleSheetHostWithSeams(
  options: CreateBrowserLinkedAuthorStyleSheetHostOptions,
  seams: BrowserLinkedAuthorStyleSheetHostSeams
): BrowserLinkedAuthorStyleSheetHost {
  const {nativeDocument, sources, onError} = validateOptions(options)
  if (seams === null || typeof seams !== "object" || typeof seams.createMutationObserver !== "function") {
    throw new TypeError("Linked author stylesheet host seams are required")
  }

  const owner = acquireDocumentAuthorStyleSheetOwner(options.document)
  const pendingLoads = new Set<HTMLLinkElement>(sources.map(source => source.link))
  for (const source of sources) {
    validateActiveLink(source, true)
  }
  const sourceByLink = new Map(sources.map(source => [source.link, source] as const))
  const listeners = new Map<HTMLLinkElement, Readonly<{
    load(): void
    error(event: Event): void
  }>>()
  let observer: MutationObserverOwner | null = null
  let disposed = false
  let initializing = true
  let readySettled = false
  let resolveReady = (): void => {}
  let rejectReady = (_error: Error): void => {}
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })

  const refresh = (): void => {
    assertActive(disposed)
    const next: DocumentAuthorStyleSheet[] = []
    for (const source of nativeOrderedSources(sources, !readySettled)) {
      const styleSheet = readLinkedStyleSheet(
        source,
        nativeDocument,
        pendingLoads,
        !readySettled
      )
      if (styleSheet !== null) next.push(styleSheet)
    }
    owner.replace(next)
  }

  const report = (error: unknown, source: BrowserLinkedAuthorStyleSheetSource | null): void => {
    const normalized = error instanceof Error ? error : new Error(String(error))
    if (onError !== undefined) onError(normalized, source)
  }

  const settleReady = (): void => {
    if (readySettled || pendingLoads.size > 0) return
    readySettled = true
    resolveReady()
  }

  const failReady = (error: unknown, source: BrowserLinkedAuthorStyleSheetSource): void => {
    const normalized = error instanceof Error ? error : new Error(String(error))
    if (readySettled) {
      report(normalized, source)
      return
    }
    readySettled = true
    disposed = true
    cleanup(owner, observer, listeners)
    observer = null
    report(normalized, source)
    rejectReady(normalized)
  }

  const refreshFromHost = (source: BrowserLinkedAuthorStyleSheetSource | null): void => {
    if (disposed) return
    try {
      refresh()
      settleReady()
    } catch (error) {
      if (!readySettled && source !== null) failReady(error, source)
      else report(error, source)
    }
  }

  try {
    for (const source of sources) {
      const load = (): void => {
        pendingLoads.delete(source.link)
        if (!initializing) refreshFromHost(source)
      }
      const error = (): void => {
        const failure = new Error(
          `${readySettled ? "Native" : "Required native"} stylesheet link failed to load: ${source.id}`
        )
        if (!readySettled) failReady(failure, source)
        else {
          pendingLoads.add(source.link)
          refreshFromHost(source)
          report(failure, source)
        }
      }
      listeners.set(source.link, Object.freeze({load, error}))
      source.link.addEventListener("load", load)
      source.link.addEventListener("error", error)
    }
    observer = seams.createMutationObserver(nativeDocument, records => {
      let relevant = false
      let changedSource: BrowserLinkedAuthorStyleSheetSource | null = null
      for (const record of records) {
        if (record.type === "childList") {
          for (const node of [...record.addedNodes, ...record.removedNodes]) {
            const source = sourceByLink.get(node as HTMLLinkElement)
            if (source === undefined) continue
            relevant = true
            changedSource ??= source
          }
          continue
        }
        const source = sourceByLink.get(record.target as HTMLLinkElement)
        if (source === undefined) continue
        relevant = true
        changedSource ??= source
        if (
          record.attributeName === "href" ||
          record.attributeName === "crossorigin" ||
          record.attributeName === "media" ||
          record.attributeName === "type"
        ) pendingLoads.add(source.link)
      }
      if (relevant) {
        if (observer !== null) observeSources(observer, sources)
        refreshFromHost(changedSource)
      }
    })
    observeSources(observer, sources)
    for (const source of sources) {
      if (source.link.sheet !== null) pendingLoads.delete(source.link)
    }
    initializing = false
    refresh()
    settleReady()
  } catch (error) {
    initializing = false
    cleanup(owner, observer, listeners)
    disposed = true
    throw error
  }

  return Object.freeze({
    canvas: options.canvas,
    document: options.document,
    sources,
    ready,
    get disposed() { return disposed },
    refresh,
    dispose() {
      if (disposed) return
      disposed = true
      cleanup(owner, observer, listeners)
      observer = null
    }
  })
}

const validateOptions = (
  options: CreateBrowserLinkedAuthorStyleSheetHostOptions
): Readonly<{
  nativeDocument: globalThis.Document
  sources: readonly BrowserLinkedAuthorStyleSheetSource[]
  onError: BrowserLinkedAuthorStyleSheetErrorHandler | undefined
}> => {
  if (options === null || typeof options !== "object") {
    throw new TypeError("Linked author stylesheet host options are required")
  }
  if (options.canvas === null || typeof options.canvas !== "object") {
    throw new TypeError("canvas must be an HTMLCanvasElement-compatible owner")
  }
  const nativeDocument = options.canvas.ownerDocument
  if (nativeDocument === null || typeof nativeDocument !== "object") {
    throw new TypeError("canvas must belong to a native Document")
  }
  if (options.document === null || typeof options.document !== "object" || options.document.nodeType !== 9) {
    throw new TypeError("document must be a semantic Document")
  }
  if (!Array.isArray(options.sources)) {
    throw new TypeError("sources must be an array of exact native links")
  }
  if (options.onError !== undefined && typeof options.onError !== "function") {
    throw new TypeError("onError must be a function")
  }
  const ids = new Set<string>()
  const links = new Set<HTMLLinkElement>()
  const sources = options.sources.map(source => {
    if (source === null || typeof source !== "object") {
      throw new TypeError("A linked author stylesheet source must be an object")
    }
    const id = typeof source.id === "string" ? source.id.trim() : ""
    if (id === "") throw new TypeError("A linked author stylesheet id cannot be empty")
    if (ids.has(id)) throw new Error(`Linked author stylesheet id collision: ${id}`)
    const link = source.link
    if (
      link === null ||
      typeof link !== "object" ||
      typeof link.addEventListener !== "function" ||
      typeof link.removeEventListener !== "function"
    ) throw new TypeError("A linked author stylesheet source requires an HTMLLinkElement")
    if (link.ownerDocument !== nativeDocument) {
      throw new TypeError(`Native stylesheet link belongs to another Document: ${id}`)
    }
    if (links.has(link)) throw new Error(`Native stylesheet link is configured more than once: ${id}`)
    ids.add(id)
    links.add(link)
    return Object.freeze({id, link})
  })
  return Object.freeze({
    nativeDocument,
    sources: Object.freeze(sources),
    onError: options.onError
  })
}

const readLinkedStyleSheet = (
  source: BrowserLinkedAuthorStyleSheetSource,
  nativeDocument: globalThis.Document,
  pendingLoads: ReadonlySet<HTMLLinkElement>,
  required: boolean
): DocumentAuthorStyleSheet | null => {
  const {link} = source
  if (link.ownerDocument !== nativeDocument) {
    throw new TypeError(`Native stylesheet link belongs to another Document: ${source.id}`)
  }
  if (!validateActiveLink(source, required)) return null
  if (pendingLoads.has(link)) return null
  const sheet = link.sheet
  if (sheet === null) return null

  let rules: CSSRuleList
  try {
    rules = sheet.cssRules
  } catch (error) {
    throw new Error(
      `Native stylesheet CSSOM is not readable for ${source.id}; use an origin-clean loaded link`,
      {cause: error}
    )
  }
  const cssText: string[] = []
  for (const rule of Array.from(rules)) {
    if (rule.type === 1) {
      rejectNestedStyleRule(rule, source.id)
      cssText.push(rule.cssText)
      continue
    }
    if (rule.type === 3) {
      throw new Error(`CSS @import is not supported by linked author stylesheet host: ${source.id}`)
    }
    throw new Error(`Unsupported CSSOM rule type ${rule.type} in linked author stylesheet: ${source.id}`)
  }
  return Object.freeze({id: source.id, cssText: cssText.join("\n")})
}

const validateActiveLink = (
  source: BrowserLinkedAuthorStyleSheetSource,
  required: boolean
): boolean => {
  const {link} = source
  const active = link.isConnected !== false && stylesheetRel(link.rel) && !link.disabled
  if (!active) {
    if (required) throw new Error(`Required native stylesheet link is not active: ${source.id}`)
    return false
  }
  const type = link.type.trim().toLowerCase()
  if (type !== "" && type !== "text/css") {
    throw new Error(`Unsupported native stylesheet type for ${source.id}: ${link.type}`)
  }
  const media = link.media.trim().toLowerCase()
  if (media !== "" && media !== "all" && media !== "screen") {
    throw new Error(`Unsupported native stylesheet media for ${source.id}: ${link.media}`)
  }
  return true
}

const nativeOrderedSources = (
  sources: readonly BrowserLinkedAuthorStyleSheetSource[],
  required: boolean
): readonly BrowserLinkedAuthorStyleSheetSource[] => Object.freeze(
  sources.filter(source => validateActiveLink(source, required)).sort((left, right) => {
  if (left.link === right.link) return 0
  const relation = left.link.compareDocumentPosition(right.link)
  if ((relation & 1) !== 0) {
    throw new Error("Configured native stylesheet links are disconnected")
  }
  if ((relation & 4) !== 0) return -1
  if ((relation & 2) !== 0) return 1
  return 0
  })
)

const observeSources = (
  observer: MutationObserverOwner,
  sources: readonly BrowserLinkedAuthorStyleSheetSource[]
): void => {
  const parents = new Set<globalThis.Node>()
  for (const source of sources) {
    observer.observe(source.link, {
      attributes: true,
      attributeFilter: ["href", "rel", "disabled", "media", "crossorigin", "type"]
    })
    if (source.link.parentNode !== null) parents.add(source.link.parentNode)
  }
  for (const parent of parents) observer.observe(parent, {childList: true})
}

const rejectNestedStyleRule = (rule: CSSRule, id: string): void => {
  const nested = (rule as CSSRule & {cssRules?: CSSRuleList}).cssRules
  if (nested !== undefined && nested.length > 0) {
    throw new Error(`CSS nesting is not supported by linked author stylesheet host: ${id}`)
  }
  if (hasNestedBlock(rule.cssText)) {
    throw new Error(`CSS nesting is not supported by linked author stylesheet host: ${id}`)
  }
}

const hasNestedBlock = (cssText: string): boolean => {
  let depth = 0
  let quote: "\"" | "'" | null = null
  for (let index = 0; index < cssText.length; index += 1) {
    const character = cssText[index]!
    if (quote !== null) {
      if (character === "\\") index += 1
      else if (character === quote) quote = null
      continue
    }
    if (character === "\"" || character === "'") {
      quote = character
      continue
    }
    if (character === "{") {
      depth += 1
      if (depth > 1) return true
    } else if (character === "}") depth -= 1
  }
  return depth !== 0
}

const stylesheetRel = (rel: string): boolean =>
  rel.split(/\s+/).some(token => token.toLowerCase() === "stylesheet")

const cleanup = (
  owner: DocumentAuthorStyleSheetOwner,
  observer: MutationObserverOwner | null,
  listeners: ReadonlyMap<HTMLLinkElement, Readonly<{load(): void; error(event: Event): void}>>
): void => {
  observer?.disconnect()
  for (const [link, listener] of listeners) {
    link.removeEventListener("load", listener.load)
    link.removeEventListener("error", listener.error)
  }
  owner.release()
}

const defaultSeams = (): BrowserLinkedAuthorStyleSheetHostSeams => Object.freeze({
  createMutationObserver(
    ownerDocument: globalThis.Document,
    callback: (records: readonly ObservedMutation[]) => void
  ): MutationObserverOwner {
    const Constructor = ownerDocument.defaultView?.MutationObserver ?? globalThis.MutationObserver
    if (Constructor === undefined) throw new Error("MutationObserver is unavailable in the canvas realm")
    const observer = new Constructor(records => callback(records.map(record => Object.freeze({
      target: record.target,
      type: record.type === "attributes" ? "attributes" : "childList",
      attributeName: record.attributeName,
      addedNodes: Object.freeze(Array.from(record.addedNodes)),
      removedNodes: Object.freeze(Array.from(record.removedNodes))
    }))))
    return Object.freeze({
      observe(target: unknown, options: MutationObserverInit) {
        observer.observe(target as globalThis.Node, options)
      },
      disconnect() { observer.disconnect() }
    })
  }
})

const assertActive = (disposed: boolean): void => {
  if (disposed) throw new Error("Linked author stylesheet host is disposed")
}
