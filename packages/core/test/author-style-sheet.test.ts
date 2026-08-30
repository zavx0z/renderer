import {describe, expect, test} from "bun:test"
import {
  acquireDocumentAuthorStyleSheetOwner,
  acquireDocumentCompiledStyleSheets,
  createDocument
} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type RectDisplayItem,
  type RenderFrame
} from "../src/index.ts"
import {documentStyleRuleCacheStats} from "../src/stylesheet-cache.ts"

describe("Document-scoped author stylesheet consumption", () => {
  test("cascades author themes before compiled owners, explicit consumers and inline style", () => {
    const document = createDocument()
    const root = document.createElement("main")
    const themed = document.createElement("button")
    const consumed = document.createElement("button")
    const inline = document.createElement("button")
    document.appendChild(root)
    root.append(themed, consumed, inline)
    for (const button of [themed, consumed, inline]) button.setAttribute("data-owner", "")
    consumed.setAttribute("data-consumer", "")
    inline.setAttribute("data-consumer", "")
    inline.setAttribute("style", "background:#445566")
    const author = acquireDocumentAuthorStyleSheetOwner(document)
    author.replace([
      {id: "tokens", cssText: ":root{--theme-color:#112233}"},
      {id: "theme-controls", cssText: "[data-owner]{background:#000000}"}
    ])
    const compiled = acquireDocumentCompiledStyleSheets(document, [{
      id: "component-owner",
      cssText: "[data-owner]{display:block;width:30px;height:20px;background:var(--theme-color)}"
    }])
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 90, height: 20},
      styleSheets: ["[data-consumer]{background:#334455}"]
    })

    const frame = renderer.flush()
    expect(background(frame, themed).color).toBe("#112233")
    expect(background(frame, consumed).color).toBe("#334455")
    expect(background(frame, inline).color).toBe("#445566")

    renderer.dispose()
    compiled.release()
    author.release()
  })

  test("matches :root only on the semantic documentElement and inherits its variables", () => {
    const document = createDocument()
    const root = document.createElement("main")
    const child = document.createElement("div")
    const nested = document.createElement("section")
    document.appendChild(root)
    root.append(child, nested)
    child.setAttribute("data-child", "")
    nested.setAttribute("data-nested", "")
    const author = acquireDocumentAuthorStyleSheetOwner(document)
    author.replace([{
      id: "root-theme",
      cssText: ":root{--root-color:#123456}[data-child]{display:block;width:20px;height:20px;background:var(--root-color)}:root[data-nested]{background:#ffffff}"
    }])
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 40, height: 20},
      styleSheets: []
    })

    const frame = renderer.flush()
    expect(background(frame, child).color).toBe("#123456")
    expect(hasBackground(frame, nested)).toBeFalse()

    renderer.dispose()
    author.release()
  })

  test("invalidates multiple projections and shares one parsed revision", () => {
    const document = createDocument()
    const root = document.createElement("main")
    const left = document.createElement("div")
    const right = document.createElement("div")
    document.appendChild(root)
    root.append(left, right)
    left.setAttribute("data-themed", "")
    right.setAttribute("data-themed", "")
    const styleSheets = ["[data-themed]{display:block;width:20px;height:20px}"]
    const leftRenderer = createDocumentRenderer({
      document,
      root: left,
      viewport: {width: 20, height: 20},
      styleSheets
    })
    const rightRenderer = createDocumentRenderer({
      document,
      root: right,
      viewport: {width: 20, height: 20},
      styleSheets
    })
    expect(documentStyleRuleCacheStats(document)).toEqual({entries: 1, parses: 1})

    const owner = acquireDocumentAuthorStyleSheetOwner(document)
    owner.replace([{id: "theme", cssText: "[data-themed]{background:#556677}"}])
    expect(background(leftRenderer.flush(), left).color).toBe("#556677")
    expect(background(rightRenderer.flush(), right).color).toBe("#556677")
    expect(documentStyleRuleCacheStats(document)).toEqual({entries: 1, parses: 2})

    owner.replace([{id: "theme", cssText: "[data-themed]{background:#667788}"}])
    expect(background(leftRenderer.flush(), left).color).toBe("#667788")
    expect(background(rightRenderer.flush(), right).color).toBe("#667788")
    expect(documentStyleRuleCacheStats(document)).toEqual({entries: 1, parses: 3})

    leftRenderer.dispose()
    rightRenderer.dispose()
    owner.release()
  })
})

function background(frame: RenderFrame, node: import("@zavx0z/dom").Element): RectDisplayItem {
  const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
    candidate.kind === "rect" && candidate.node === node && candidate.key === "background"
  )
  if (!item) throw new Error("Expected a background display item")
  return item
}

function hasBackground(frame: RenderFrame, node: import("@zavx0z/dom").Element): boolean {
  return frame.displayList.some(candidate =>
    candidate.kind === "rect" && candidate.node === node && candidate.key === "background"
  )
}
