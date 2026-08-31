import {describe, expect, test} from "bun:test"
import {
  createDocument,
  type HTMLOptionElement,
  type HTMLSelectElement,
} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type RectDisplayItem,
  type RenderFrame,
  type TextDisplayItem,
} from "../src/index.ts"

describe("collapsed select replaced-control paint", () => {
  test("paints the selected DOM option label while preserving its distinct value", () => {
    const {document, select, first, second} = selectFixture()
    document.appendChild(select)
    const renderer = createDocumentRenderer({
      document,
      root: select,
      viewport: {width: 200, height: 40},
    })
    const frame = renderer.flush()
    const outer = rect(frame, select, "background")
    const value = selectedValue(frame, select)
    const disclosure = disclosureIndicator(frame, select)

    expect(select.selectedIndex).toBe(0)
    expect(select.value).toBe("first-value")
    expect(first.label).toBe("First option")
    expect(frame.boxByNode.get(select)).toMatchObject({
      x: 0,
      y: 0,
      width: 160,
      height: 22,
      contentX: 7,
      contentY: 3,
      contentWidth: 146,
      contentHeight: 16,
    })
    expect(outer).toMatchObject({
      node: select,
      key: "background",
      color: "#ffffff",
      width: 160,
      height: 22,
    })
    expect(value).toMatchObject({
      node: select,
      key: "value",
      text: "First option",
      x: 7,
      y: 3.2,
      color: "#111827",
      fontSize: 13,
      opacity: 1,
    })
    expect(value.clips).toHaveLength(1)
    expect(disclosure).toMatchObject({
      node: select,
      key: "disclosure-indicator",
      text: "▾",
      color: "#111827",
      fontSize: 12,
      letterSpacing: 0,
      opacity: 1,
    })
    expect(disclosure.x).toBeGreaterThan(value.x)
    expect(frame.boxByNode.has(first)).toBeFalse()
    expect(frame.boxByNode.has(second)).toBeFalse()
    expect(frame.hits.has(first)).toBeFalse()
    expect(frame.hits.has(second)).toBeFalse()
    expect(frame.displayList.some(({node}) => node === first || node === second)).toBeFalse()
    expect(frame.hits.get(select)).toMatchObject({
      node: select,
      role: "combobox",
      disabled: false,
      interactive: true,
    })
    renderer.dispose()
  })

  test("updates the same value identity from live selectedness without fabricating events", () => {
    const {document, select, first, second} = selectFixture()
    document.appendChild(select)
    const events: string[] = []
    select.addEventListener("input", ({type}) => events.push(type))
    select.addEventListener("change", ({type}) => events.push(type))
    const renderer = createDocumentRenderer({
      document,
      root: select,
      viewport: {width: 200, height: 40},
    })
    const firstFrame = renderer.flush()
    const firstValue = selectedValue(firstFrame, select)
    const firstDisclosure = disclosureIndicator(firstFrame, select)

    select.value = "second-value"
    const secondFrame = renderer.flush()
    const secondValue = selectedValue(secondFrame, select)
    const secondDisclosure = disclosureIndicator(secondFrame, select)
    expect(select.selectedIndex).toBe(1)
    expect(second.selected).toBeTrue()
    expect(first.selected).toBeFalse()
    expect(secondValue).toMatchObject({
      node: firstValue.node,
      key: firstValue.key,
      text: "Visible second",
      x: firstValue.x,
      y: firstValue.y,
    })
    expect(secondFrame.revision).toBe(firstFrame.revision + 1)
    expect(secondDisclosure).toMatchObject({
      node: firstDisclosure.node,
      key: firstDisclosure.key,
      text: firstDisclosure.text,
      x: firstDisclosure.x,
      y: firstDisclosure.y,
      fontSize: firstDisclosure.fontSize,
    })
    expect(events).toEqual([])

    second.label = "Renamed"
    const renamed = renderer.flush()
    expect(selectedValue(renamed, select).text).toBe("Renamed")
    expect(events).toEqual([])

    select.value = "missing"
    const empty = renderer.flush()
    expect(select.selectedIndex).toBe(-1)
    expect(select.value).toBe("")
    expect(empty.displayList.some((item) => item.node === select && item.key === "value")).toBeFalse()
    expect(rect(empty, select, "background")).toBeDefined()
    expect(renderer.flush()).toBe(empty)
    expect(events).toEqual([])
    renderer.dispose()
  })

  test("keeps an empty label visually empty even when the selected option value is non-empty", () => {
    const document = createDocument()
    const select = document.createElement("select")
    const option = document.createElement("option")
    option.value = "semantic-value"
    select.appendChild(option)
    document.appendChild(select)
    const renderer = createDocumentRenderer({
      document,
      root: select,
      viewport: {width: 200, height: 40},
    })
    const frame = renderer.flush()

    expect(select.value).toBe("semantic-value")
    expect(option.label).toBe("")
    expect(frame.displayList.some((item) => item.node === select && item.key === "value")).toBeFalse()
    expect(disclosureIndicator(frame, select).text).toBe("▾")
    renderer.dispose()
  })

  test("derives collapsed text from author size and CSS while retaining outer ownership", () => {
    const {document, select} = selectFixture()
    select.setAttribute(
      "style",
      "box-sizing:border-box; width:220px; height:32px; padding:4px 10px; border:2px solid #123456; background:#abcdef; color:#102030; font-size:16px",
    )
    document.appendChild(select)
    const renderer = createDocumentRenderer({
      document,
      root: select,
      viewport: {width: 260, height: 60},
    })
    const frame = renderer.flush()
    const outer = rect(frame, select, "background")
    const value = selectedValue(frame, select)

    expect(frame.boxByNode.get(select)).toMatchObject({
      width: 220,
      height: 32,
      contentX: 12,
      contentY: 6,
      contentWidth: 196,
      contentHeight: 20,
    })
    expect(outer).toMatchObject({width: 220, height: 32, color: "#abcdef"})
    expect(outer.border).toMatchObject({
      widths: {top: 2, right: 2, bottom: 2, left: 2},
      colors: {top: "#123456", right: "#123456", bottom: "#123456", left: "#123456"},
    })
    expect(value).toMatchObject({
      x: 12,
      y: 6.4,
      color: "#102030",
      fontSize: 16,
    })
    expect(disclosureIndicator(frame, select)).toMatchObject({
      text: "▾",
      color: "#102030",
      opacity: 1,
    })
    renderer.dispose()
  })

  test("keeps disabled paint but follows DOM focus and hit laws", () => {
    const {document, select} = selectFixture()
    select.disabled = true
    document.appendChild(select)
    const renderer = createDocumentRenderer({
      document,
      root: select,
      viewport: {width: 200, height: 40},
    })
    const frame = renderer.flush()

    expect(rect(frame, select, "background").opacity).toBe(0.5)
    expect(selectedValue(frame, select).opacity).toBe(0.5)
    expect(disclosureIndicator(frame, select).opacity).toBe(0.5)
    expect(frame.hits.get(select)).toMatchObject({
      role: "combobox",
      disabled: true,
      interactive: false,
    })
    select.focus()
    expect(document.activeElement).toBeNull()
    renderer.dispose()
  })

  test("supports collapsed size=1 and fails closed for unimplemented listbox modes", () => {
    const {document, select} = selectFixture()
    document.appendChild(select)
    const renderer = createDocumentRenderer({
      document,
      root: select,
      viewport: {width: 200, height: 80},
    })
    const collapsed = renderer.flush()

    select.multiple = true
    expect(() => renderer.flush()).toThrow("Select listbox rendering is not implemented")
    select.multiple = false
    select.size = 2
    expect(() => renderer.flush()).toThrow("Select listbox rendering is not implemented")
    select.size = 1
    const recovered = renderer.flush()
    expect(selectedValue(recovered, select).text).toBe("First option")
    expect(recovered.revision).toBe(collapsed.revision + 1)
    renderer.dispose()
  })

  test("projects an open picker as top-layer option boxes with exact option hits", () => {
    const {document, select, first, second} = selectFixture()
    select.setAttribute("style", "width:160px; height:22px")
    document.appendChild(select)
    const renderer = createDocumentRenderer({
      document,
      root: select,
      viewport: {width: 200, height: 80},
    })
    const closed = renderer.flush()
    select.showPicker()
    const open = renderer.flush()

    expect(open.revision).toBe(closed.revision + 1)
    expect(rect(open, select, "picker-background")).toMatchObject({
      x: 0,
      y: 22,
      width: 160,
      height: 47.2,
    })
    expect(open.boxByNode.get(first)).toMatchObject({
      parent: select,
      x: 0,
      y: 22,
      width: 160,
      height: 23.6,
    })
    expect(open.boxByNode.get(second)).toMatchObject({y: 45.6, height: 23.6})
    expect(open.hits.get(first)).toMatchObject({role: "option", interactive: true})
    expect(open.hits.get(second)).toMatchObject({role: "option", interactive: true})
    expect(open.displayList.filter(item => item.key === "picker-option-label").map(item => item.node))
      .toEqual([first, second])
    expect(open.displayList.at(-1)?.node).toBe(second)
    renderer.dispose()
  })

  test("clamps picker geometry in presentation coordinates for a transformed select", () => {
    const {document, select} = selectFixture()
    select.setAttribute(
      "style",
      "width:100px; height:22px; transform:translate(80px, 20px) scale(1.5); transform-origin:0px 0px",
    )
    document.appendChild(select)
    const renderer = createDocumentRenderer({
      document,
      root: select,
      viewport: {width: 220, height: 160},
    })
    select.showPicker()
    const frame = renderer.flush()
    const collapsed = rect(frame, select, "background")
    const picker = rect(frame, select, "picker-background")

    expect(visualBounds(collapsed)).toEqual({left: 80, top: 20, right: 230, bottom: 53})
    const bounds = visualBounds(picker)
    expect(bounds.left).toBeCloseTo(70)
    expect(bounds.right).toBeCloseTo(220)
    expect(bounds.top).toBeCloseTo(53)
    expect(bounds.bottom).toBeLessThanOrEqual(160)
    renderer.dispose()
  })
})

function selectFixture(): Readonly<{
  document: ReturnType<typeof createDocument>
  select: HTMLSelectElement
  first: HTMLOptionElement
  second: HTMLOptionElement
}> {
  const document = createDocument()
  const select = document.createElement("select")
  const first = document.createElement("option")
  const second = document.createElement("option")
  first.append("  First \n option  ")
  first.value = "first-value"
  second.label = "Visible second"
  second.value = "second-value"
  select.append(first, second)
  return {document, select, first, second}
}

function selectedValue(frame: RenderFrame, select: HTMLSelectElement): TextDisplayItem {
  const item = frame.displayList.find((candidate): candidate is TextDisplayItem =>
    candidate.kind === "text" && candidate.node === select && candidate.key === "value"
  )
  if (!item) throw new Error("Expected collapsed select value")
  return item
}

function disclosureIndicator(
  frame: RenderFrame,
  select: HTMLSelectElement,
): TextDisplayItem {
  const item = frame.displayList.find((candidate): candidate is TextDisplayItem =>
    candidate.kind === "text" &&
    candidate.node === select &&
    candidate.key === "disclosure-indicator"
  )
  if (!item) throw new Error("Expected collapsed select disclosure indicator")
  return item
}

function rect(
  frame: RenderFrame,
  select: HTMLSelectElement,
  key: string,
): RectDisplayItem {
  const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
    candidate.kind === "rect" && candidate.node === select && candidate.key === key
  )
  if (!item) throw new Error(`Expected select ${key}`)
  return item
}

function visualBounds(item: RectDisplayItem) {
  const firstX = item.x * item.transform.scaleX + item.transform.translateX
  const secondX = (item.x + item.width) * item.transform.scaleX + item.transform.translateX
  const firstY = item.y * item.transform.scaleY + item.transform.translateY
  const secondY = (item.y + item.height) * item.transform.scaleY + item.transform.translateY
  return {
    left: Math.min(firstX, secondX),
    top: Math.min(firstY, secondY),
    right: Math.max(firstX, secondX),
    bottom: Math.max(firstY, secondY),
  }
}
