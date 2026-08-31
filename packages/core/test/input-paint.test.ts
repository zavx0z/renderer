import {describe, expect, it} from "bun:test"
import {Event, createDocument, type Node} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type DisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("input replaced-control paint", () => {
  it("keeps semantic box/hit ownership and emits one aligned live value fragment", () => {
    const document = createDocument()
    const input = document.createElement("input")
    document.appendChild(input)
    input.value = "Hello"
    input.setAttribute(
      "style",
      "width:200px; height:30px; padding:4px; border:0; background:red; color:blue; font-size:10px",
    )
    const frame = createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 220, height: 50},
    }).flush()
    const value = display(frame, input, "value")

    expect(frame.boxes).toHaveLength(1)
    expect(frame.boxByNode.get(input)).toMatchObject({
      x: 0,
      y: 0,
      width: 200,
      height: 30,
      contentX: 4,
      contentY: 4,
      contentWidth: 192,
      contentHeight: 22,
    })
    expect(frame.hits.get(input)).toMatchObject({
      node: input,
      interactive: true,
      disabled: false,
      role: "textbox",
    })
    expect(value).toMatchObject({
      kind: "text",
      key: "value",
      node: input,
      text: "Hello",
      x: 4,
      y: 9,
      color: "blue",
      fontSize: 10,
      opacity: 1,
    })
    expect(value.clips).toHaveLength(1)
    expect(input.childNodes).toEqual([])
    expect(frame.displayList.filter((item) => item.node === input).map(({key}) => key))
      .toEqual(["background", "value"])
  })

  it("switches placeholder and live state without synthesizing input events", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    document.appendChild(root)
    root.appendChild(input)
    input.placeholder = "Search"
    input.setAttribute(
      "style",
      "width:100px; height:20px; padding:2px; border:0; color:#123456; font-size:10px",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 40},
    })
    const first = renderer.flush()
    const placeholder = display(first, input, "value")
    let inputEvents = 0
    let bubbledEvents = 0
    input.addEventListener("input", () => inputEvents++)
    root.addEventListener("input", () => bubbledEvents++)

    expect(placeholder).toMatchObject({
      text: "Search",
      color: "#123456",
      opacity: 0.55,
    })
    input.value = "Live"
    expect(inputEvents).toBe(0)
    expect(bubbledEvents).toBe(0)
    const live = renderer.flush()
    expect(live.revision).toBe(first.revision + 1)
    expect(display(live, input, "value")).toMatchObject({
      node: input,
      key: "value",
      text: "Live",
      opacity: 1,
    })
    expect(display(first, input, "value")).toBe(placeholder)
    expect(placeholder.text).toBe("Search")
    expect(renderer.flush()).toBe(live)

    input.dispatchEvent(new Event("input", {bubbles: true, composed: true}))
    expect(inputEvents).toBe(1)
    expect(bubbledEvents).toBe(1)
    input.value = ""
    expect(display(renderer.flush(), input, "value")).toMatchObject({
      text: "Search",
      opacity: 0.55,
    })
    renderer.dispose()
  })

  it("masks password graphemes and leaves placeholder text readable", () => {
    const document = createDocument()
    const input = document.createElement("input")
    document.appendChild(input)
    input.type = "password"
    input.placeholder = "Secret"
    const renderer = createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 200, height: 40},
    })

    expect(display(renderer.flush(), input, "value")).toMatchObject({
      text: "Secret",
      opacity: 0.55,
    })
    input.value = "a\u0301👨‍👩‍👧‍👦"
    const masked = display(renderer.flush(), input, "value")
    expect(masked.text).toBe("••")
    expect(masked.text).not.toContain("a")
    expect(masked.text).not.toContain("👨")
    renderer.dispose()
  })

  it("uses UA search defaults while allowing exact author overrides", () => {
    const document = createDocument()
    const input = document.createElement("input")
    document.appendChild(input)
    input.type = "search"
    input.placeholder = "Find"
    const renderer = createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 300, height: 60},
    })
    const defaults = renderer.flush()

    expect(defaults.boxByNode.get(input)).toMatchObject({width: 160, height: 22})
    expect(defaults.hits.get(input)).toMatchObject({role: "searchbox"})
    input.setAttribute(
      "style",
      "box-sizing:border-box; width:90px; height:18px; padding:0; border:0; background:green; color:white; font-size:8px",
    )
    const authored = renderer.flush()
    expect(authored.boxByNode.get(input)).toMatchObject({width: 90, height: 18})
    expect(display(authored, input, "background")).toMatchObject({color: "green"})
    expect(display(authored, input, "value")).toMatchObject({
      color: "white",
      fontSize: 8,
    })
    renderer.dispose()
  })
})

describe("checkbox and radio projection", () => {
  it("emits only resolved checked indicators and disables hit activation", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const checkbox = document.createElement("input")
    const radio = document.createElement("input")
    document.appendChild(root)
    root.appendChild(checkbox)
    root.appendChild(radio)
    checkbox.type = "checkbox"
    radio.type = "radio"
    checkbox.setAttribute("style", "width:20px; height:20px; color:green")
    radio.setAttribute("style", "width:20px; height:20px; color:blue")
    radio.checked = true
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 60},
    })
    const initial = renderer.flush()

    expect(initial.displayList.some(
      (item) => item.node === checkbox && item.key === "indicator",
    )).toBe(false)
    expect(initial.displayList.some(
      (item) => item.node === checkbox && item.kind === "text",
    )).toBe(false)
    const radioIndicator = display(initial, radio, "indicator")
    expect(radioIndicator).toMatchObject({kind: "rect", color: "blue"})
    if (radioIndicator.kind !== "rect") throw new Error("Expected radio Rect")
    expect(radioIndicator.border.radii.topLeft).toBe(
      radioIndicator.width / 2,
    )
    expect(initial.hits.get(checkbox)).toMatchObject({
      interactive: true,
      disabled: false,
      role: "checkbox",
    })
    expect(initial.hits.get(radio)).toMatchObject({role: "radio"})

    checkbox.checked = true
    const checked = renderer.flush()
    const checkedIndicator = display(checked, checkbox, "indicator")
    expect(checkedIndicator).toMatchObject({
      kind: "text",
      key: "indicator",
      node: checkbox,
      text: "✓",
      color: "green",
      opacity: 1,
      letterSpacing: 0,
    })
    if (checkedIndicator.kind !== "text") throw new Error("Expected Checkbox check Text")
    expect(checkedIndicator.clips).toHaveLength(1)
    expect(checked.displayList.some(
      (item) => item.node === checkbox && item.kind === "rect" && item.key === "indicator",
    )).toBe(false)

    checkbox.disabled = true
    const disabled = renderer.flush()
    expect(display(disabled, checkbox, "indicator")).toMatchObject({
      kind: checkedIndicator.kind,
      key: checkedIndicator.key,
      node: checkedIndicator.node,
      text: "✓",
      x: checkedIndicator.x,
      y: checkedIndicator.y,
      fontSize: checkedIndicator.fontSize,
      clips: checkedIndicator.clips,
      transform: checkedIndicator.transform,
      opacity: 0.5,
    })
    expect(disabled.hits.get(checkbox)).toMatchObject({
      interactive: false,
      disabled: true,
      role: "checkbox",
    })

    checkbox.checked = false
    const unchecked = renderer.flush()
    expect(unchecked.displayList.some(
      item => item.node === checkbox && item.key === "indicator",
    )).toBe(false)
    renderer.dispose()
  })

  it("removes hidden input from box, hit and paint projection", () => {
    const document = createDocument()
    const input = document.createElement("input")
    document.appendChild(input)
    input.type = "hidden"
    input.value = "not paint"
    const frame = createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 100, height: 40},
    }).flush()

    expect(frame.boxByNode.has(input)).toBe(false)
    expect(frame.hits.has(input)).toBe(false)
    expect(frame.displayList.some((item) => item.node === input)).toBe(false)
  })
})

function display(
  frame: RenderFrame,
  node: Node,
  key: "value",
): Extract<DisplayItem, {kind: "text"}>
function display(
  frame: RenderFrame,
  node: Node,
  key: "background" | "indicator",
): DisplayItem
function display(frame: RenderFrame, node: Node, key: string): DisplayItem
function display(frame: RenderFrame, node: Node, key: string): DisplayItem {
  const item = frame.displayList.find(
    (candidate) => candidate.node === node && candidate.key === key,
  )
  if (!item) throw new Error(`Expected display item ${key}`)
  return item
}
