import {describe, expect, test} from "bun:test"
import {
  acquireDocumentCompiledStyleSheets,
  createDocument
} from "@zavx0z/dom"
import {
  createDocumentInteractionState,
  createDocumentRenderer,
  type RectDisplayItem,
  type RenderFrame,
  type TextDisplayItem
} from "../src/index.ts"
import {documentStyleRuleCacheStats} from "../src/stylesheet-cache.ts"

describe("Document-scoped compiled stylesheet consumption", () => {
  test("composes global host CSS with compiled pseudos and inherited values", () => {
    const document = createDocument()
    const root = document.createElement("main")
    const button = document.createElement("button")
    const label = document.createElement("span")
    const text = document.createTextNode("Compiled")
    document.appendChild(root)
    button.setAttribute("data-z-button", "")
    label.appendChild(text)
    button.appendChild(label)
    root.appendChild(button)
    const lease = acquireDocumentCompiledStyleSheets(document, [{
      id: "button",
      cssText: [
        "[data-z-button]{display:block;width:80px;height:24px;background:#112233;color:#abcdef}",
        "[data-z-button]:hover{background:#334455}"
      ].join("\n")
    }])
    const interactionState = createDocumentInteractionState(document)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 60},
      interactionState,
      styleSheets: ["main{display:block;width:120px;height:60px}"]
    })

    const initial = renderer.flush()
    expect(background(initial, button).color).toBe("#112233")
    expect(textItem(initial, text).color).toBe("#abcdef")
    interactionState.setHoveredElement(button)
    expect(background(renderer.flush(), button).color).toBe("#334455")

    renderer.dispose()
    lease.release()
  })

  test("keeps explicit consumer sheets after compiled owner defaults", () => {
    const document = createDocument()
    const button = document.createElement("button")
    document.appendChild(button)
    button.setAttribute("data-z-owner", "")
    button.setAttribute("data-z-consumer", "")
    const lease = acquireDocumentCompiledStyleSheets(document, [{
      id: "owner",
      cssText: "[data-z-owner]{display:block;width:40px;height:20px;background:#112233}"
    }])
    const renderer = createDocumentRenderer({
      document,
      root: button,
      viewport: {width: 40, height: 20},
      styleSheets: ["[data-z-consumer]{background:#abcdef}"]
    })

    expect(background(renderer.flush(), button).color).toBe("#abcdef")
    button.setAttribute("style", "background:#fedcba")
    expect(background(renderer.flush(), button).color).toBe("#fedcba")

    renderer.dispose()
    lease.release()
  })

  test("refreshes late registration and release across cached same-Document projections", () => {
    const document = createDocument()
    const root = document.createElement("main")
    const left = document.createElement("button")
    const right = document.createElement("button")
    document.appendChild(root)
    left.setAttribute("data-z-shared", "")
    right.setAttribute("data-z-shared", "")
    root.append(left, right)
    const globalCss = ["button{display:block;width:40px;height:20px}"]
    const leftRenderer = createDocumentRenderer({
      document,
      root: left,
      viewport: {width: 40, height: 20},
      styleSheets: globalCss
    })
    const rightRenderer = createDocumentRenderer({
      document,
      root: right,
      viewport: {width: 40, height: 20},
      styleSheets: globalCss
    })
    expect(documentStyleRuleCacheStats(document)).toEqual({entries: 1, parses: 1})
    const beforeLeft = leftRenderer.flush()
    const beforeRight = rightRenderer.flush()

    const lease = acquireDocumentCompiledStyleSheets(document, [{
      id: "shared",
      cssText: "[data-z-shared]{background:#556677}"
    }])
    const styledLeft = leftRenderer.flush()
    const styledRight = rightRenderer.flush()
    expect(styledLeft).not.toBe(beforeLeft)
    expect(styledRight).not.toBe(beforeRight)
    expect(background(styledLeft, left).color).toBe("#556677")
    expect(background(styledRight, right).color).toBe("#556677")
    expect(documentStyleRuleCacheStats(document)).toEqual({entries: 1, parses: 2})

    leftRenderer.dispose()
    lease.release()
    const released = rightRenderer.flush()
    expect(background(released, right).color).toBe("#e5e7eb")
    expect(documentStyleRuleCacheStats(document)).toEqual({entries: 1, parses: 3})
    rightRenderer.dispose()
  })
})

function background(frame: RenderFrame, node: import("@zavx0z/dom").Element): RectDisplayItem {
  const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
    candidate.kind === "rect" && candidate.node === node && candidate.key === "background"
  )
  if (!item) throw new Error("Expected a background display item")
  return item
}

function textItem(frame: RenderFrame, node: import("@zavx0z/dom").Text): TextDisplayItem {
  const item = frame.displayList.find((candidate): candidate is TextDisplayItem =>
    candidate.kind === "text" && candidate.node === node
  )
  if (!item) throw new Error("Expected a text display item")
  return item
}
