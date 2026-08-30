import {describe, expect, test} from "bun:test"
import {createDocument} from "@zavx0z/dom"
import {
  createDocumentInteractionState,
  createDocumentRenderer,
  type RectDisplayItem,
  type RenderFrame
} from "@zavx0z/renderer"
import {
  bindStyle,
  defineCompiledTemplate,
  writeBinding
} from "@zavx0z/template/compiled"
import {createRoot} from "../src/index.ts"

describe("class-free styles through the document renderer", () => {
  test("adopts compiled template styles without explicit renderer wiring", () => {
    const Button = defineCompiledTemplate<Record<string, never>>({
      bindingCount: 0,
      displayName: "AutoStyledButton",
      styleSheets: [{
        id: "auto-styled-button",
        cssText: [
          "[data-z-auto-button]{display:block;width:40px;height:20px;background:#123456;color:#abcdef}",
          "[data-z-auto-button]:hover{background:#654321}"
        ].join("\n")
      }],
      mount(document) {
        const button = document.createElement("button")
        const label = document.createElement("span")
        button.setAttribute("data-z-auto-button", "")
        label.append("Auto")
        button.appendChild(label)
        return {nodes: [button], bindings: []}
      },
      render() {}
    })
    const document = createDocument()
    const host = document.createElement("main")
    document.appendChild(host)
    const root = createRoot(host)
    root.render(Button, {})
    const button = host.querySelector("button")!
    const interactionState = createDocumentInteractionState(document)
    const renderer = createDocumentRenderer({
      document,
      root: host,
      viewport: {width: 80, height: 40},
      interactionState,
      styleSheets: []
    })

    const initial = renderer.flush()
    expect(background(initial, button).color).toBe("#123456")
    expect(initial.displayList.find(item => item.kind === "text")).toMatchObject({color: "#abcdef"})
    interactionState.setHoveredElement(button)
    expect(background(renderer.flush(), button).color).toBe("#654321")

    renderer.dispose()
    root.unmount()
  })

  test("resolves native pseudos and keeps caller style above owner defaults", () => {
    const Button = defineCompiledTemplate<{style?: string}>({
      bindingCount: 1,
      displayName: "StyledButton",
      styleSheets: [{
        id: "style.renderer.fixture",
        cssText: [
          "[data-z-style-renderer]{display:block;width:40px;height:20px;background:#111111}",
          "[data-z-style-renderer]:hover{background:#222222}",
          "[data-z-style-renderer]:active{background:#333333}"
        ].join("\n")
      }],
      mount(document) {
        const button = document.createElement("button")
        button.setAttribute("data-z-style-renderer", "")
        return {nodes: [button], bindings: [bindStyle(button)]}
      },
      render(props, values) {
        writeBinding(values, 0, props.style)
      }
    })
    const document = createDocument()
    const host = document.createElement("main")
    document.appendChild(host)
    const root = createRoot(host)
    root.render(Button, {})
    const button = host.querySelector("button")!
    const interactionState = createDocumentInteractionState(document)
    const renderer = createDocumentRenderer({
      document,
      root: host,
      viewport: {width: 80, height: 40},
      interactionState,
      styleSheets: []
    })

    expect(background(renderer.flush(), button).color).toBe("#111111")
    interactionState.setHoveredElement(button)
    expect(background(renderer.flush(), button).color).toBe("#222222")
    interactionState.setActiveElement(button)
    expect(background(renderer.flush(), button).color).toBe("#333333")

    root.render(Button, {style: "background: #abcdef"})
    expect(background(renderer.flush(), button).color).toBe("#abcdef")
    expect(button.className).toBe("")
    renderer.dispose()
    root.unmount()
  })
})

function background(
  frame: RenderFrame,
  node: import("@zavx0z/dom").Element
): RectDisplayItem {
  const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
    candidate.kind === "rect" && candidate.node === node && candidate.key === "background"
  )
  if (!item) throw new Error("Expected a background display item")
  return item
}
