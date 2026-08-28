import {describe, expect, it} from "bun:test"
import {createDocument, type Element} from "@zavx0z/dom"
import {
  createDocumentInteractionController,
  createDocumentInteractionState,
  createDocumentRenderer,
  type RectDisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("native pseudo style foundation", () => {
  it("indexes the rightmost compound and preserves child, descendant and specificity semantics", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const direct = label(document)
    const wrapper = document.createElement("div")
    const descendant = label(document)
    const nested = document.createElement("section")
    const nestedLabel = label(document)
    document.appendChild(root)
    root.setAttribute("data-component", "panel")
    root.setAttribute("data-owner", "outer")
    nested.setAttribute("data-component", "panel")
    wrapper.appendChild(descendant)
    nested.appendChild(nestedLabel)
    root.append(direct, wrapper, nested)

    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 160, height: 120},
      styleSheets: [String.raw`
        [data-component="panel"] [data-part="label"] {
          background: #111111;
        }
        [data-component="panel"] > [data-part="label"] {
          background: #222222;
        }
        [data-component="panel"][data-owner="outer"] > [data-part="label"] {
          background: #333333;
        }
        [data-component="panel"]:unknown > [data-part="label"] {
          background: #ff00ff;
        }
        [data-part="label"], [data-part="label"]:unknown {
          background: #00ffff;
        }
      `],
    })
    const frame = renderer.flush()

    expect(background(frame, direct).color).toBe("#333333")
    expect(background(frame, descendant).color).toBe("#111111")
    expect(background(frame, nestedLabel).color).toBe("#222222")
    expect(renderer.flush()).toBe(frame)
    renderer.dispose()
  })

  it("shares exact hover and active chains and keeps a repeated target clean", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const button = document.createElement("button")
    document.appendChild(root)
    root.setAttribute("data-root", "")
    button.setAttribute("data-role", "action")
    root.appendChild(button)
    const interactionState = createDocumentInteractionState(document)
    const stateChanges: Element[][] = []
    interactionState.subscribe(({elements}) => stateChanges.push([...elements]))
    interactionState.setHoveredElement(button)
    interactionState.setHoveredElement(button)
    interactionState.setHoveredElement(null)
    expect(stateChanges).toEqual([[button, root], [button, root]])
    const otherDocument = createDocument()
    expect(() => interactionState.setActiveElement(otherDocument.createElement("button")))
      .toThrow("another Document")
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 80, height: 40},
      interactionState,
      styleSheets: [String.raw`
        [data-root] { display: block; width: 80px; height: 40px; }
        button { display: block; width: 40px; height: 20px; }
        button:hover { background: #222222; }
        [data-role="action"] { background: #111111; }
        div:hover > button { border: 2px solid #abcdef; }
        button:active { background: #333333; }
      `],
    })
    const interaction = createDocumentInteractionController({document, interactionState})
    const initial = renderer.flush()
    expect(background(initial, button).color).toBe("#111111")

    interaction.pointerMove(initial, {clientX: 5, clientY: 5})
    const hovered = renderer.flush()
    expect(background(hovered, button)).toMatchObject({
      color: "#222222",
      border: {widths: {top: 2, right: 2, bottom: 2, left: 2}},
    })

    interaction.pointerMove(hovered, {clientX: 5, clientY: 5})
    expect(renderer.flush()).toBe(hovered)

    interaction.pointerDown(hovered, {clientX: 5, clientY: 5})
    const active = renderer.flush()
    expect(background(active, button).color).toBe("#333333")

    interaction.pointerUp(active, {clientX: 5, clientY: 5})
    const released = renderer.flush()
    expect(background(released, button).color).toBe("#222222")
    expect(renderer.flush()).toBe(released)
    interaction.dispose()
    renderer.dispose()
  })

  it("reads focus, focus-within, checked, indeterminate and effective disabled state", () => {
    const document = createDocument()
    const fieldset = document.createElement("fieldset")
    const input = document.createElement("input")
    document.appendChild(fieldset)
    input.type = "checkbox"
    fieldset.appendChild(input)
    const renderer = createDocumentRenderer({
      document,
      root: fieldset,
      viewport: {width: 80, height: 40},
      styleSheets: [String.raw`
        input:checked { background: #112233; }
        input:indeterminate { background: #223344; }
        input:disabled { opacity: 0.4; }
        fieldset:focus-within > input { background: #334455; }
        input:focus { border: 3px solid #abcdef; }
      `],
    })
    const initial = renderer.flush()

    input.checked = true
    const checked = renderer.flush()
    expect(checked.revision).toBe(initial.revision + 1)
    expect(background(checked, input).color).toBe("#112233")

    input.indeterminate = true
    const indeterminate = renderer.flush()
    expect(background(indeterminate, input).color).toBe("#223344")

    fieldset.disabled = true
    const disabled = renderer.flush()
    expect(background(disabled, input).opacity).toBe(0.4)

    fieldset.disabled = false
    input.focus()
    const focused = renderer.flush()
    expect(background(focused, input)).toMatchObject({
      color: "#334455",
      border: {widths: {top: 3, right: 3, bottom: 3, left: 3}},
    })
    expect(renderer.flush()).toBe(focused)
    renderer.dispose()
  })
})

const label = (document: ReturnType<typeof createDocument>): Element => {
  const element = document.createElement("span")
  element.setAttribute("data-part", "label")
  element.setAttribute("style", "display:block; width:20px; height:10px")
  return element
}

const background = (frame: RenderFrame, element: Element): RectDisplayItem => {
  const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
    candidate.kind === "rect" &&
    candidate.node === element &&
    candidate.key === "background"
  )
  if (item === undefined) throw new Error(`Missing background for ${element.localName}`)
  return item
}
