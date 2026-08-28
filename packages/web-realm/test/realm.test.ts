import {describe, expect, test} from "bun:test"
import {
  DOMRectReadOnly,
  Event,
  HTMLElement,
  createDocument,
} from "@zavx0z/dom"
import {createDocumentRenderer} from "@zavx0z/renderer"
import {
  WebRealmCSSStyleDeclaration,
  WebRealmWindow,
  createWebRealm,
} from "../src/index.ts"

describe("per-Document web realm", () => {
  test("keeps the native host untouched and exposes exact semantic identities", () => {
    const semanticDocument = createDocument()
    const nativeDocument = {kind: "native-document"}
    const host = platformHost({document: nativeDocument})
    const beforeGlobalDocument = Reflect.get(globalThis, "document")
    const realm = createWebRealm({document: semanticDocument, platformWindow: host})

    expect(Reflect.get(globalThis, "document")).toBe(beforeGlobalDocument)
    expect(Reflect.get(host, "document")).toBe(nativeDocument)
    expect(realm.window.document).toBe(semanticDocument)
    expect(realm.window.window).toBe(realm.window)
    expect(realm.window.self).toBe(realm.window)
    expect(realm.window.globalThis).toBe(realm.window)
    expect(realm.bindings).toBe(realm.window)
    expect(realm.window).toBeInstanceOf(WebRealmWindow)
    expect(Object.prototype.toString.call(realm.window)).toBe("[object Window]")
    expect(realm.window.HTMLElement).toBe(HTMLElement)
    expect(realm.window.Event).toBe(Event)
    expect(realm.window.URL).toBe(URL)
    expect(new realm.window.URL("/path", "https://example.test").href)
      .toBe("https://example.test/path")
    expect("localStorage" in realm.window).toBe(false)
    expect(() => Reflect.get(realm.window, "localStorage")).toThrow("support matrix")
    expect(() => Reflect.set(realm.window, "document", nativeDocument)).toThrow("read-only")

    realm.dispose()
    realm.dispose()
    expect(realm.disposed).toBe(true)
    expect(() => realm.window.document).toThrow("disposed")
    expect(Reflect.get(host, "document")).toBe(nativeDocument)
  })

  test("keeps two semantic Documents independently bound on one platform host", () => {
    const host = platformHost()
    const firstDocument = createDocument()
    const secondDocument = createDocument()
    const first = createWebRealm({document: firstDocument, platformWindow: host})
    const second = createWebRealm({document: secondDocument, platformWindow: host})

    expect(first.window).not.toBe(second.window)
    expect(first.window.document).toBe(firstDocument)
    expect(second.window.document).toBe(secondDocument)
    expect(first.window.Element).toBe(second.window.Element)
    expect(() => createWebRealm({document: firstDocument, platformWindow: host}))
      .toThrow("already has")

    first.dispose()
    second.dispose()
  })

  test("delegates only explicit host capabilities with stable bound functions", () => {
    const host = platformHost({
      token: 42,
      setTimeout(this: {token: number}) { return this.token },
    })
    const realm = createWebRealm({document: createDocument(), platformWindow: host})

    const delegatedTimer = realm.window.setTimeout
    expect(delegatedTimer).toBe(realm.window.setTimeout)
    expect(delegatedTimer(() => {})).toBe(42)
    expect(realm.window.navigator).toBe(Reflect.get(host, "navigator"))
    realm.dispose()

    const unavailable = createWebRealm({document: createDocument(), platformWindow: {}})
    expect(() => unavailable.window.navigator).toThrow("unavailable")
    expect(() => unavailable.window.fetch("https://example.test")).toThrow("unavailable")
    unavailable.dispose()
  })

  test("reads computed style and transformed geometry from the attached renderer only", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const hidden = document.createElement("span")
    document.appendChild(root)
    root.appendChild(hidden)
    root.setAttribute(
      "style",
      "width:100px; height:40px; color:#123456; opacity:.5; " +
      "transform:translate(10px, 5px) scale(2); transform-origin:0 0",
    )
    hidden.setAttribute("style", "display:none")
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 300, height: 200},
    })
    const realm = createWebRealm({document, platformWindow: platformHost()})

    expect(() => root.getBoundingClientRect()).toThrow("attachRenderer")
    const detach = realm.attachRenderer({
      getRenderer: () => renderer,
      flush: () => renderer.flush(),
    })
    expect(() => realm.attachRenderer({
      getRenderer: () => renderer,
      flush: () => renderer.flush(),
    })).toThrow("already has")

    const rect = root.getBoundingClientRect()
    expect(rect).toBeInstanceOf(DOMRectReadOnly)
    expect(rect).toMatchObject({x: 10, y: 5, width: 200, height: 80})
    expect(hidden.getBoundingClientRect()).toEqual(new DOMRectReadOnly())

    const style = realm.window.getComputedStyle(root)
    expect(style).toBeInstanceOf(WebRealmCSSStyleDeclaration)
    expect(style.display).toBe("block")
    expect(style.width).toBe("100px")
    expect(style.color).toBe("#123456")
    expect(style.opacity).toBe("0.5")
    expect(style.transform).toBe("translate(10px, 5px) scale(2, 2)")
    expect(style.getPropertyValue("margin-left")).toBe("0px")
    expect(() => style.getPropertyValue("grid-template-columns")).toThrow("unsupported")
    expect(() => style.setProperty("color", "red")).toThrow("read-only")
    expect(() => realm.window.getComputedStyle(root, "::before")).toThrow("Pseudo-element")

    detach()
    expect(() => root.getBoundingClientRect()).toThrow("attachRenderer")
    realm.dispose()
    renderer.dispose()
  })

  test("rejects renderer bridges from a different semantic realm", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    const foreignDocument = createDocument()
    const foreignRoot = foreignDocument.createElement("div")
    foreignDocument.appendChild(foreignRoot)
    const foreignRenderer = createDocumentRenderer({
      document: foreignDocument,
      root: foreignRoot,
      viewport: {width: 1, height: 1},
    })
    const realm = createWebRealm({document, platformWindow: platformHost()})

    expect(() => realm.attachRenderer({
      getRenderer: () => foreignRenderer,
      flush: () => foreignRenderer.flush(),
    })).toThrow("another Document")
    realm.dispose()
    foreignRenderer.dispose()
  })

  test("pins a bridge to one exact renderer even within the same Document", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const nestedRoot = document.createElement("section")
    document.appendChild(root)
    root.appendChild(nestedRoot)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 100},
    })
    const nestedRenderer = createDocumentRenderer({
      document,
      root: nestedRoot,
      viewport: {width: 50, height: 50},
    })
    let currentRenderer = renderer
    const realm = createWebRealm({document, platformWindow: platformHost()})
    realm.attachRenderer({
      getRenderer: () => currentRenderer,
      flush: () => currentRenderer.flush(),
    })

    currentRenderer = nestedRenderer
    expect(() => root.getBoundingClientRect()).toThrow("another DocumentRenderer")
    realm.dispose()
    renderer.dispose()
    nestedRenderer.dispose()
  })
})

const platformHost = (extra: Record<string, unknown> = {}): object => ({
  URL,
  URLSearchParams,
  location: {
    href: "https://example.test/",
    origin: "https://example.test",
    protocol: "https:",
    host: "example.test",
    hostname: "example.test",
    port: "",
    pathname: "/",
    search: "",
    hash: "",
    assign() {},
    replace() {},
    reload() {},
    toString() { return this.href },
  },
  history: {
    length: 1,
    state: null,
    back() {},
    forward() {},
    go() {},
    pushState() {},
    replaceState() {},
  },
  navigator: {gpu: {kind: "native-gpu"}, xr: {kind: "native-xr"}},
  performance,
  crypto,
  console,
  fetch,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  requestAnimationFrame: (_callback: (time: number) => void) => 1,
  cancelAnimationFrame() {},
  devicePixelRatio: 2,
  ...extra,
})
