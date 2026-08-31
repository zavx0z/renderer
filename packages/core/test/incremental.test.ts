import {describe, expect, it} from "bun:test"
import {createDocument, Node, type Text} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type DisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("characterData incremental frame", () => {
  it("patches one fixed block Text and matches a forced full rebuild", () => {
    const fixture = fixedRows(3)
    const initial = fixture.renderer.flush()
    const target = requireText(fixture.rows[1]?.firstChild)
    const unchanged = requireText(fixture.rows[0]?.firstChild)
    const initialTargetBox = requireBox(initial, target)
    const initialTargetItem = requireTextItem(initial, target)
    const initialUnchangedBox = requireBox(initial, unchanged)
    const initialUnchangedItem = requireTextItem(initial, unchanged)
    const initialParentBox = requireBox(initial, fixture.rows[1]!)

    target.data = "Changed"
    const incremental = fixture.renderer.flush()

    expect(incremental.revision).toBe(initial.revision + 1)
    expect(incremental).not.toBe(initial)
    expect(incremental.boxes).not.toBe(initial.boxes)
    expect(incremental.displayList).not.toBe(initial.displayList)
    expect(incremental.hits).toBe(initial.hits)
    expect(Object.isFrozen(incremental)).toBe(true)
    expect(Array.isArray(incremental.boxes)).toBe(true)
    expect(Array.isArray(incremental.displayList)).toBe(true)
    expect(() => Reflect.set(incremental.boxes, "0", null)).toThrow("immutable")
    expect(Object.isFrozen(requireBox(incremental, target))).toBe(true)
    expect(Object.isFrozen(requireTextItem(incremental, target))).toBe(true)
    expect("set" in incremental.boxByNode).toBe(false)
    expect(requireTextItem(initial, target).text).toBe("Row 1")
    expect(requireTextItem(incremental, target)).toMatchObject({text: "Changed"})
    expect(requireBox(incremental, target)).not.toBe(initialTargetBox)
    expect(requireTextItem(incremental, target)).not.toBe(initialTargetItem)
    expect(requireBox(incremental, unchanged)).toBe(initialUnchangedBox)
    expect(requireTextItem(incremental, unchanged)).toBe(initialUnchangedItem)
    expect(requireBox(incremental, fixture.rows[1]!)).toBe(initialParentBox)

    const forcedRenderer = createDocumentRenderer({
      document: fixture.document,
      root: fixture.root,
      viewport: fixture.viewport,
    })
    const forced = forcedRenderer.flush()
    expect(incremental.boxes).toEqual(forced.boxes)
    expect(incremental.displayList).toEqual(forced.displayList)
    expect([...incremental.boxByNode]).toEqual([...forced.boxByNode])
    expect([...incremental.hits]).toEqual([...forced.hits])
    forcedRenderer.dispose()

    fixture.renderer.invalidate(fixture.root)
    const rebuilt = fixture.renderer.flush()
    expect(requireTextItem(rebuilt, target)).toMatchObject({text: "Changed"})
    fixture.renderer.dispose()
  })

  it("falls back for inline, multi-child, empty and flex-row-auto-width cases", () => {
    assertFullFallback((fixture) => {
      fixture.targetParent.setAttribute("style", "display:inline; height:16px")
    })
    assertFullFallback((fixture) => {
      fixture.targetParent.appendChild(fixture.document.createTextNode(" second"))
    })
    assertFullFallback(
      () => {},
      (target) => {
        target.data = ""
      },
    )
    assertFullFallback((fixture) => {
      fixture.root.setAttribute(
        "style",
        "display:flex; flex-direction:row; width:200px",
      )
    })
    assertFullFallback((fixture) => {
      fixture.root.setAttribute(
        "style",
        "display:flex; flex-direction:column; width:200px; overflow:hidden",
      )
    })
  })

  it("falls back when an ancestor style or another Text changes before flush", () => {
    const fixture = fixedRows(3)
    const initial = fixture.renderer.flush()
    const target = requireText(fixture.rows[1]?.firstChild)
    const other = requireText(fixture.rows[2]?.firstChild)
    const unchangedBox = requireBox(initial, fixture.rows[0]!)

    fixture.document.transaction(() => {
      fixture.root.setAttribute(
        "style",
        "display:flex; flex-direction:column; width:800px; color:red",
      )
      target.data = "Changed"
    })
    const styleFrame = fixture.renderer.flush()
    expect(requireBox(styleFrame, fixture.rows[0]!)).not.toBe(unchangedBox)
    expect(requireTextItem(styleFrame, target)).toMatchObject({
      text: "Changed",
      color: "#ff0000",
    })

    const beforeMultiple = styleFrame
    fixture.document.transaction(() => {
      target.data = "Changed again"
      other.data = "Other changed"
    })
    const multipleFrame = fixture.renderer.flush()
    expect(requireBox(multipleFrame, fixture.rows[0]!)).not.toBe(
      requireBox(beforeMultiple, fixture.rows[0]!),
    )
    fixture.renderer.dispose()
  })

  it("measures preformatted lines, emits line fragments and rejects newline patches", () => {
    const fixture = fallbackFixture()
    fixture.targetParent.setAttribute(
      "style",
      "display:block; height:48px; white-space:pre; font-size:10px",
    )
    const initial = fixture.renderer.flush()
    const initialSiblingBox = requireBox(initial, fixture.sibling)

    fixture.target.data = "ab\n1234\n\nx"
    const multiline = fixture.renderer.flush()
    const items = textItems(multiline, fixture.target)

    expect(requireBox(multiline, fixture.sibling)).not.toBe(initialSiblingBox)
    expect(requireBox(multiline, fixture.target)).toMatchObject({
      width: 24,
      height: 48,
    })
    expect(items).toEqual([
      expect.objectContaining({key: "text:0", text: "ab", x: 0, y: 0}),
      expect.objectContaining({key: "text:1", text: "1234", x: 0, y: 12}),
      expect.objectContaining({key: "text:3", text: "x", x: 0, y: 36}),
    ])
    expect(items.every((item) => !/[\r\n]/.test(item.text))).toBe(true)

    const multilineSiblingBox = requireBox(multiline, fixture.sibling)
    fixture.target.data = "single"
    const single = fixture.renderer.flush()
    expect(requireBox(single, fixture.sibling)).not.toBe(multilineSiblingBox)
    expect(textItems(single, fixture.target)).toEqual([
      expect.objectContaining({key: "text", text: "single", x: 0, y: 0}),
    ])
    fixture.renderer.dispose()
  })
})

const fixedRows = (count: number) => {
  const document = createDocument()
  const root = document.createElement("div")
  document.appendChild(root)
  root.setAttribute(
    "style",
    "display:flex; flex-direction:column; width:800px",
  )
  const rows = Array.from({length: count}, (_, index) => {
    const row = document.createElement("span")
    row.setAttribute("style", "display:block; height:16px")
    row.textContent = `Row ${index}`
    root.appendChild(row)
    return row
  })
  const viewport = Object.freeze({width: 800, height: Math.max(600, count * 16)})
  const renderer = createDocumentRenderer({document, root, viewport})
  return {document, root, rows, viewport, renderer}
}

const assertFullFallback = (
  configure: (fixture: ReturnType<typeof fallbackFixture>) => void,
  mutate: (target: Text) => void = (target) => {
    target.data = "Changed"
  },
): void => {
  const fixture = fallbackFixture()
  configure(fixture)
  const initial = fixture.renderer.flush()
  const unchangedBox = requireBox(initial, fixture.sibling)
  mutate(fixture.target)
  const updated = fixture.renderer.flush()
  expect(requireBox(updated, fixture.sibling)).not.toBe(unchangedBox)
  fixture.renderer.dispose()
}

const fallbackFixture = () => {
  const document = createDocument()
  const root = document.createElement("div")
  const targetParent = document.createElement("span")
  const sibling = document.createElement("span")
  const target = document.createTextNode("Before")
  document.appendChild(root)
  root.setAttribute(
    "style",
    "display:flex; flex-direction:column; width:200px",
  )
  targetParent.setAttribute("style", "display:block; height:16px")
  sibling.setAttribute("style", "display:block; height:16px")
  targetParent.appendChild(target)
  sibling.textContent = "Sibling"
  root.appendChild(targetParent)
  root.appendChild(sibling)
  const renderer = createDocumentRenderer({
    document,
    root,
    viewport: {width: 200, height: 100},
  })
  return {document, root, targetParent, sibling, target, renderer}
}

const requireText = (node: Node | null | undefined): Text => {
  if (node?.nodeType !== Node.TEXT_NODE) throw new Error("Expected Text")
  return node as Text
}

const requireBox = (frame: RenderFrame, node: Node) => {
  const box = frame.boxByNode.get(node)
  if (!box) throw new Error("Expected RenderBox")
  return box
}

const requireTextItem = (frame: RenderFrame, node: Node) => {
  const item = frame.displayList.find(
    (candidate): candidate is Extract<DisplayItem, {kind: "text"}> =>
      candidate.kind === "text" && candidate.node === node,
  )
  if (!item) throw new Error("Expected TextDisplayItem")
  return item
}

const textItems = (frame: RenderFrame, node: Node) =>
  frame.displayList.filter(
    (candidate): candidate is Extract<DisplayItem, {kind: "text"}> =>
      candidate.kind === "text" && candidate.node === node,
  )
