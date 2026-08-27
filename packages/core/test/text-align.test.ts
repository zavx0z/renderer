import {describe, expect, test} from "bun:test"
import {createDocument, type Node} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type RenderFrame,
  type TextDisplayItem,
} from "../src/index.ts"

describe("text-align cascade and ordinary Text paint", () => {
  test("inherits standard values, ignores invalid declarations and maps start/end as LTR", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    root.className = "root"
    const inherited = row(document, "aa")
    const center = row(document, "aaaa", "center")
    const left = row(document, "aaa", "left")
    const right = row(document, "aaa", "right")
    const start = row(document, "aaa", "start")
    center.setAttribute("style", "display:block; height:16px; text-align:bogus")
    start.setAttribute("style", "display:block; height:16px; text-align:start; direction:rtl")
    root.append(inherited, center, left, right, start)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 100},
      styleSheets: [String.raw`
        .root { width: 200px; font-size: 10px; text-align: end; }
        .center { text-align: center; }
        .left { text-align: left; }
        .right { text-align: right; }
      `],
    })
    const frame = renderer.flush()

    expect(text(frame, inherited).x).toBe(188)
    expect(text(frame, center).x).toBe(88)
    expect(text(frame, left).x).toBe(0)
    expect(text(frame, right).x).toBe(182)
    expect(text(frame, start).x).toBe(0)
    expect([
      text(frame, inherited).key,
      text(frame, center).key,
      text(frame, left).key,
      text(frame, right).key,
      text(frame, start).key,
    ]).toEqual(["text", "text", "text", "text", "text"])
    renderer.dispose()
  })

  test("aligns every preserved line independently with stable line keys", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const content = document.createTextNode("aa\n12345")
    document.appendChild(root)
    root.appendChild(content)
    root.setAttribute(
      "style",
      "width:200px; font-size:10px; white-space:pre; text-align:center",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 240, height: 80},
    })
    const centered = renderer.flush()
    const centeredLines = textItems(centered, content)

    expect(centeredLines).toEqual([
      expect.objectContaining({key: "text:0", text: "aa", x: 94}),
      expect.objectContaining({key: "text:1", text: "12345", x: 85}),
    ])

    root.setAttribute(
      "style",
      "width:200px; font-size:10px; white-space:pre; text-align:end",
    )
    const ended = renderer.flush()
    expect(textItems(ended, content)).toEqual([
      expect.objectContaining({key: "text:0", text: "aa", x: 188}),
      expect.objectContaining({key: "text:1", text: "12345", x: 170}),
    ])
    renderer.dispose()
  })
})

describe("text-align replaced value fragments", () => {
  test("aligns input, select and textarea values inside their own content boxes", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    const select = document.createElement("select")
    const option = document.createElement("option")
    const textArea = document.createElement("textarea")
    document.appendChild(root)
    root.append(input, select, textArea)

    input.value = "abcd"
    input.setAttribute(
      "style",
      "display:block; box-sizing:border-box; width:100px; height:20px; padding:0; border:0; font-size:10px; text-align:right",
    )
    option.label = "abcde"
    select.appendChild(option)
    select.setAttribute(
      "style",
      "display:block; box-sizing:border-box; width:100px; height:20px; padding:0; border:0; font-size:10px; text-align:center",
    )
    textArea.value = "aa\n12345"
    textArea.wrap = "off"
    textArea.setAttribute(
      "style",
      "display:block; box-sizing:border-box; width:100px; height:40px; padding:0; border:0; font-size:10px; white-space:pre; text-align:end",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 140, height: 100},
    })
    const frame = renderer.flush()

    expect(valueItems(frame, input)).toEqual([
      expect.objectContaining({key: "value", text: "abcd", x: 76}),
    ])
    expect(valueItems(frame, select)).toEqual([
      expect.objectContaining({key: "value", text: "abcde", x: 35}),
    ])
    expect(valueItems(frame, textArea)).toEqual([
      expect.objectContaining({key: "value:0", text: "aa", x: 88}),
      expect.objectContaining({key: "value:1", text: "12345", x: 70}),
    ])
    renderer.dispose()
  })
})

describe("text-align incremental equivalence", () => {
  test("updates right-aligned X through the indexed leaf patch", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const owner = document.createElement("span")
    const content = document.createTextNode("aa")
    document.appendChild(root)
    root.appendChild(owner)
    owner.appendChild(content)
    root.setAttribute("style", "width:200px")
    owner.setAttribute(
      "style",
      "display:block; width:200px; height:16px; font-size:10px; text-align:right",
    )
    const viewport = {width: 240, height: 40}
    const renderer = createDocumentRenderer({document, root, viewport})
    const initial = renderer.flush()
    const initialItem = textItems(initial, content)[0]!
    expect(initialItem).toMatchObject({key: "text", text: "aa", x: 188})

    content.data = "12345"
    const incremental = renderer.flush()
    const nextItem = textItems(incremental, content)[0]!
    expect(nextItem).toMatchObject({key: "text", text: "12345", x: 170})
    expect(nextItem.key).toBe(initialItem.key)

    const forced = createDocumentRenderer({document, root, viewport}).flush()
    expect(incremental.boxes).toEqual(forced.boxes)
    expect(incremental.displayList).toEqual(forced.displayList)
    expect([...incremental.boxByNode]).toEqual([...forced.boxByNode])
    renderer.dispose()
  })
})

function row(
  document: ReturnType<typeof createDocument>,
  value: string,
  className = "",
) {
  const element = document.createElement("span")
  element.className = className
  element.setAttribute("style", "display:block; height:16px")
  element.textContent = value
  return element
}

function text(frame: RenderFrame, owner: Node): TextDisplayItem {
  const item = textItems(frame, owner.firstChild)[0]
  if (!item) throw new Error("Expected aligned Text item")
  return item
}

function textItems(frame: RenderFrame, node: Node | null): readonly TextDisplayItem[] {
  return frame.displayList.filter((item): item is TextDisplayItem =>
    item.kind === "text" && item.node === node
  )
}

function valueItems(frame: RenderFrame, node: Node): readonly TextDisplayItem[] {
  return frame.displayList.filter((item): item is TextDisplayItem =>
    item.kind === "text" && item.node === node && item.key.startsWith("value")
  )
}
