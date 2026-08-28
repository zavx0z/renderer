import {describe, expect, test} from "bun:test"
import {createDocument} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  getRendererComputedStyle,
} from "../src/index.ts"

describe("renderer computed-style read boundary", () => {
  test("returns the exact immutable cascade result and flushes dirty state lazily", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("span")
    document.appendChild(root)
    root.appendChild(child)
    root.className = "theme"
    child.setAttribute("style", "font-size: 12px; opacity: .5")
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 200, height: 100},
      styleSheets: [".theme span { color: #123456; display: block }"]
    })

    const first = getRendererComputedStyle(renderer, child)
    expect(first).toMatchObject({
      display: "block",
      color: "#123456",
      fontSize: 12,
      opacity: 0.5
    })
    expect(Object.isFrozen(first)).toBe(true)
    expect(getRendererComputedStyle(renderer, child)).toBe(first)

    child.setAttribute("style", "font-size: 14px; opacity: .75")
    const second = getRendererComputedStyle(renderer, child)
    expect(second).not.toBe(first)
    expect(second).toMatchObject({fontSize: 14, opacity: 0.75})
    expect(renderer.flush().revision).toBe(2)

    const grandchild = document.createElement("span")
    child.appendChild(grandchild)
    expect(getRendererComputedStyle(renderer, grandchild).fontSize).toBe(14)
    child.setAttribute("style", "display: none; font-size: 18px")
    expect(() => getRendererComputedStyle(renderer, grandchild)).toThrow("no renderer")
    child.setAttribute("style", "display: block; font-size: 18px")
    expect(getRendererComputedStyle(renderer, grandchild).fontSize).toBe(18)
    renderer.dispose()
  })

  test("is exact-realm, renderer-root and lifecycle scoped", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const outside = document.createElement("div")
    const foreign = createDocument().createElement("div")
    document.appendChild(root)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 100}
    })

    expect(() => getRendererComputedStyle(renderer, outside)).toThrow("outside")
    expect(() => getRendererComputedStyle(renderer, foreign)).toThrow("another Document")
    renderer.dispose()
    expect(() => getRendererComputedStyle(renderer, root)).toThrow("live")
  })
})
