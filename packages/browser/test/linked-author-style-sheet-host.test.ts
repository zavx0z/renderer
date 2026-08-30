import {describe, expect, test} from "bun:test"
import {
  acquireDocumentAuthorStyleSheetOwner,
  createDocument,
  readDocumentAuthorStyleSheets
} from "@zavx0z/dom"
import {createBrowserLinkedAuthorStyleSheetHost} from "../src/index.ts"
import {
  createBrowserLinkedAuthorStyleSheetHostWithSeams,
  type BrowserLinkedAuthorStyleSheetHostSeams
} from "../src/linked-author-style-sheet-host.ts"

describe("explicit browser-linked author stylesheet host", () => {
  test("reads only configured, already-loaded origin-clean CSSOM in native tree order", async () => {
    const nativeDocument = nativeDocumentOwner()
    const canvas = {ownerDocument: nativeDocument} as HTMLCanvasElement
    const semanticDocument = createDocument()
    const tokens = linked(nativeDocument, [rule(1, ":root { --accent: rgb(10 20 30); }")])
    const controls = linked(nativeDocument, [rule(1, "button { color: var(--accent); }")])
    const unconfigured = linked(nativeDocument, [rule(1, "body { color: red; }")])
    const harness = observerHarness()

    const host = createBrowserLinkedAuthorStyleSheetHostWithSeams({
      canvas,
      document: semanticDocument,
      sources: [
        {id: "controls", link: controls.link},
        {id: "tokens", link: tokens.link}
      ]
    }, harness.seams)
    await host.ready

    expect(readDocumentAuthorStyleSheets(semanticDocument)).toEqual({
      revision: 1,
      styleSheets: [
        {id: "tokens", cssText: ":root { --accent: rgb(10 20 30); }"},
        {id: "controls", cssText: "button { color: var(--accent); }"}
      ]
    })
    expect(tokens.reads()).toBe(1)
    expect(controls.reads()).toBe(1)
    expect(unconfigured.reads()).toBe(0)
    expect(harness.observedTargets()).toContain(tokens.link)
    expect(harness.observedTargets()).toContain(controls.link)
    expect(harness.observedTargets()).not.toContain(nativeDocument)
    expect(host.canvas).toBe(canvas)
    expect(host.document).toBe(semanticDocument)
    host.dispose()
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets).toEqual([])
  })

  test("awaits required load, adopts changes and explicit CSSOM refresh then cleans up", async () => {
    const nativeDocument = nativeDocumentOwner()
    const canvas = {ownerDocument: nativeDocument} as HTMLCanvasElement
    const semanticDocument = createDocument()
    const source = linked(nativeDocument, null)
    const harness = observerHarness()
    const errors: string[] = []
    const host = createBrowserLinkedAuthorStyleSheetHostWithSeams({
      canvas,
      document: semanticDocument,
      sources: [{id: "theme", link: source.link}],
      onError: error => errors.push(error.message)
    }, harness.seams)
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets).toEqual([])

    source.setRules([rule(1, ":root { --tone: #112233; }")])
    source.dispatch("load")
    await host.ready
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets[0]?.cssText)
      .toBe(":root { --tone: #112233; }")

    harness.mutate([{target: source.link, type: "attributes", attributeName: "href"}])
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets).toEqual([])
    source.setRules([rule(1, ":root { --tone: #223344; }")])
    source.dispatch("load")
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets[0]?.cssText)
      .toBe(":root { --tone: #223344; }")

    source.setRules([rule(1, ":root { --tone: #334455; }")])
    host.refresh()
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets[0]?.cssText)
      .toBe(":root { --tone: #334455; }")

    source.dispatch("error")
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets).toEqual([])
    expect(errors).toEqual(["Native stylesheet link failed to load: theme"])
    source.dispatch("load")
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets[0]?.cssText)
      .toBe(":root { --tone: #334455; }")

    const mutableLink = source.link as unknown as {isConnected: boolean}
    mutableLink.isConnected = false
    harness.mutate([{
      target: nativeDocument.head,
      type: "childList",
      attributeName: null,
      addedNodes: [],
      removedNodes: [source.link]
    }])
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets).toEqual([])
    mutableLink.isConnected = true
    harness.mutate([{
      target: nativeDocument.head,
      type: "childList",
      attributeName: null,
      addedNodes: [source.link],
      removedNodes: []
    }])
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets[0]?.cssText)
      .toBe(":root { --tone: #334455; }")

    host.dispose()
    expect(host.disposed).toBeTrue()
    expect(harness.disconnects()).toBe(1)
    expect(source.listenerCount()).toBe(0)
    expect(() => host.refresh()).toThrow("disposed")
    source.dispatch("load")
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets).toEqual([])
    expect(errors).toEqual(["Native stylesheet link failed to load: theme"])
  })

  test("closes the load-before-listener race by immediately rechecking CSSOM", async () => {
    const nativeDocument = nativeDocumentOwner()
    const source = linked(
      nativeDocument,
      null,
      undefined,
      [rule(1, ":root { --race-safe: #123456; }")]
    )
    const semanticDocument = createDocument()
    const host = createBrowserLinkedAuthorStyleSheetHostWithSeams({
      canvas: {ownerDocument: nativeDocument} as HTMLCanvasElement,
      document: semanticDocument,
      sources: [{id: "race-safe-theme", link: source.link}]
    }, observerHarness().seams)

    await host.ready
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets).toEqual([{
      id: "race-safe-theme",
      cssText: ":root { --race-safe: #123456; }"
    }])
    expect(source.listenerCount()).toBe(2)
    host.dispose()
  })

  test("fails closed for unreadable, imported, font and nested CSS without replacing prior state", async () => {
    const nativeDocument = nativeDocumentOwner()
    const canvas = {ownerDocument: nativeDocument} as HTMLCanvasElement
    const semanticDocument = createDocument()
    const unreadable = linked(nativeDocument, [], new DOMException("blocked", "SecurityError"))
    expect(() => createBrowserLinkedAuthorStyleSheetHostWithSeams({
      canvas,
      document: semanticDocument,
      sources: [{id: "cross-origin", link: unreadable.link}]
    }, observerHarness().seams)).toThrow("origin-clean")
    const releasedOwner = acquireDocumentAuthorStyleSheetOwner(semanticDocument)
    releasedOwner.release()

    const source = linked(nativeDocument, [rule(1, ":root { --tone: #112233; }")])
    const host = createBrowserLinkedAuthorStyleSheetHostWithSeams({
      canvas,
      document: semanticDocument,
      sources: [{id: "theme", link: source.link}]
    }, observerHarness().seams)
    await host.ready
    const before = readDocumentAuthorStyleSheets(semanticDocument)

    source.setRules([rule(3, "@import url(other.css);")])
    expect(() => host.refresh()).toThrow("@import")
    expect(readDocumentAuthorStyleSheets(semanticDocument)).toBe(before)
    source.setRules([rule(5, "@font-face { font-family: Example; src: url(example.woff2); }")])
    expect(() => host.refresh()).toThrow("rule type 5")
    expect(readDocumentAuthorStyleSheets(semanticDocument)).toBe(before)
    source.setRules([rule(1, "button { color: red; &:hover { color: blue; } }")])
    expect(() => host.refresh()).toThrow("nesting")
    expect(readDocumentAuthorStyleSheets(semanticDocument)).toBe(before)

    host.dispose()
  })

  test("rejects ready and releases ownership when a required link errors", async () => {
    const nativeDocument = nativeDocumentOwner()
    const source = linked(nativeDocument, null)
    const semanticDocument = createDocument()
    const errors: string[] = []
    const host = createBrowserLinkedAuthorStyleSheetHostWithSeams({
      canvas: {ownerDocument: nativeDocument} as HTMLCanvasElement,
      document: semanticDocument,
      sources: [{id: "required-theme", link: source.link}],
      onError: error => errors.push(error.message)
    }, observerHarness().seams)

    source.dispatch("error")
    await expect(host.ready).rejects.toThrow("Required native stylesheet link failed")
    expect(host.disposed).toBeTrue()
    expect(errors).toEqual(["Required native stylesheet link failed to load: required-theme"])
    expect(readDocumentAuthorStyleSheets(semanticDocument).styleSheets).toEqual([])
    const replacement = acquireDocumentAuthorStyleSheetOwner(semanticDocument)
    replacement.release()
  })

  test("rejects links from another native Document and contains no scan, fetch or owner creation", async () => {
    const nativeDocument = nativeDocumentOwner()
    const otherDocument = nativeDocumentOwner()
    const source = linked(otherDocument, [rule(1, ":root { color: red; }")])
    expect(() => createBrowserLinkedAuthorStyleSheetHost({
      canvas: {ownerDocument: nativeDocument} as HTMLCanvasElement,
      document: createDocument(),
      sources: [{id: "wrong-realm", link: source.link}]
    })).toThrow("another Document")

    const implementation = await Bun.file(new URL(
      "../src/linked-author-style-sheet-host.ts",
      import.meta.url
    )).text()
    for (const forbidden of [
      "fetch(",
      "querySelector",
      "document.styleSheets",
      "createElement(\"canvas\")",
      "new EngineRenderer",
      "new Space(",
      "createDocument()"
    ]) expect(implementation).not.toContain(forbidden)
  })
})

type FakeRule = Readonly<{type: number; cssText: string; cssRules?: readonly FakeRule[]}>

const rule = (type: number, cssText: string, cssRules?: readonly FakeRule[]): FakeRule =>
  Object.freeze({type, cssText, ...(cssRules === undefined ? {} : {cssRules})})

const nativeDocumentOwner = (): globalThis.Document => {
  const head = {} as {ownerDocument: globalThis.Document}
  const document = {defaultView: null, head} as unknown as globalThis.Document
  head.ownerDocument = document
  return document
}

const linkOrderByDocument = new WeakMap<globalThis.Document, number>()

const linked = (
  ownerDocument: globalThis.Document,
  initialRules: readonly FakeRule[] | null,
  cssRulesError?: Error,
  rulesBeforeLoadListener?: readonly FakeRule[]
) => {
  const listeners = new Map<string, Set<(event: Event) => void>>()
  let rules = initialRules
  let missedLoad = false
  let reads = 0
  const order = linkOrderByDocument.get(ownerDocument) ?? 0
  linkOrderByDocument.set(ownerDocument, order + 1)
  const sheet = {
    get cssRules() {
      reads += 1
      if (cssRulesError !== undefined) throw cssRulesError
      return rules ?? []
    }
  }
  const link = {
    ownerDocument,
    parentNode: ownerDocument.head,
    isConnected: true,
    rel: "stylesheet",
    disabled: false,
    type: "text/css",
    media: "",
    compareDocumentPosition(other: HTMLLinkElement) {
      if (other.ownerDocument !== ownerDocument) return 1
      const otherOrder = (other as unknown as {__order: number}).__order
      return order < otherOrder ? 4 : 2
    },
    __order: order,
    get sheet() { return rules === null ? null : sheet },
    addEventListener(type: string, listener: (event: Event) => void) {
      if (type === "load" && !missedLoad && rulesBeforeLoadListener !== undefined) {
        missedLoad = true
        rules = rulesBeforeLoadListener
      }
      const owners = listeners.get(type) ?? new Set()
      owners.add(listener)
      listeners.set(type, owners)
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      listeners.get(type)?.delete(listener)
    }
  } as unknown as HTMLLinkElement
  return Object.freeze({
    link,
    reads: () => reads,
    setRules(next: readonly FakeRule[] | null) { rules = next },
    dispatch(type: string) {
      for (const listener of [...listeners.get(type) ?? []]) listener(new Event(type))
    },
    listenerCount: () => [...listeners.values()].reduce((total, owners) => total + owners.size, 0)
  })
}

const observerHarness = () => {
  let callback: ((records: readonly any[]) => void) | null = null
  const targets: unknown[] = []
  let disconnects = 0
  const seams: BrowserLinkedAuthorStyleSheetHostSeams = Object.freeze({
    createMutationObserver(_ownerDocument, subscriber) {
      callback = subscriber
      return Object.freeze({
        observe(next: unknown) { targets.push(next) },
        disconnect() { disconnects += 1 }
      })
    }
  })
  return Object.freeze({
    seams,
    mutate(records: readonly any[]) {
      const subscriber = callback as ((changes: readonly any[]) => void) | null
      if (subscriber === null) throw new Error("Observer is not active")
      subscriber(records)
    },
    observedTargets: () => targets,
    disconnects: () => disconnects
  })
}
