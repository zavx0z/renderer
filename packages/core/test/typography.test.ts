import {describe, expect, test} from "bun:test"
import {createDocument, type Node} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type RenderFrame,
  type TextDisplayItem,
} from "../src/index.ts"

describe("inherited line-height and letter-spacing", () => {
  test("uses one supplied font advance owner for intrinsic width and ellipsis", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const text = document.createTextNode("SVG")
    document.appendChild(root)
    root.appendChild(text)
    root.setAttribute(
      "style",
      "box-sizing:border-box; display:block; width:22px; height:20px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:10px; line-height:12px",
    )
    const textMeasurer = Object.freeze({
      measureTextAdvance(value: string, fontSize: number, letterSpacing: number): number {
        const characters = Array.from(value)
        return characters.reduce((width, character, index) =>
          width + (character === "…" ? 0.6 : 0.8) * fontSize +
            (index + 1 < characters.length ? letterSpacing : 0), 0)
      },
    })
    const options = {
      document,
      root,
      viewport: {width: 40, height: 30},
      textMeasurer,
    }
    const renderer = createDocumentRenderer(options)
    const frame = renderer.flush()

    expect(frame.boxByNode.get(text)).toMatchObject({width: 24, height: 12})
    expect(textItems(frame, text)[0]).toMatchObject({text: "SV…"})
    renderer.dispose()
  })

  test("keeps whitespace layout while omitting non-painting text items", () => {
    const document = createDocument()
    const root = document.createElement("span")
    const text = document.createTextNode("   ")
    document.appendChild(root)
    root.appendChild(text)
    root.setAttribute("style", "display:block; width:80px; height:20px; white-space:pre; background:#112233")
    const renderer = createDocumentRenderer({document, root, viewport: {width: 100, height: 40}})

    const whitespace = renderer.flush()
    expect(whitespace.boxByNode.get(text)?.width).toBeGreaterThan(0)
    expect(textItems(whitespace, text)).toHaveLength(0)
    expect(whitespace.displayList.some(item => item.kind === "rect" && item.node === root)).toBe(true)

    text.data = " X "
    expect(textItems(renderer.flush(), text).map(item => item.text)).toEqual([" X "])
    text.data = "   "
    expect(textItems(renderer.flush(), text)).toHaveLength(0)
    renderer.dispose()
  })

  test("resolves unitless inheritance per child font and measures every character gap", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("span")
    const text = document.createTextNode("ABC\nD")
    document.appendChild(root)
    root.appendChild(child)
    child.appendChild(text)
    root.setAttribute(
      "style",
      "width:100px; font-size:20px; line-height:1.5; letter-spacing:2px; white-space:pre",
    )
    child.setAttribute("style", "display:block; font-size:10px")
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 100},
    })

    const frame = renderer.flush()
    expect(frame.boxByNode.get(text)).toMatchObject({width: 22, height: 30})
    expect(textItems(frame, text).map(({key, text: value, y, lineHeight, letterSpacing}) => ({
      key,
      value,
      y,
      lineHeight,
      letterSpacing,
    }))).toEqual([
      {key: "text:0", value: "ABC", y: 0, lineHeight: 15, letterSpacing: 2},
      {key: "text:1", value: "D", y: 15, lineHeight: 15, letterSpacing: 2},
    ])

    root.setAttribute(
      "style",
      "width:100px; font-size:20px; line-height:150%; letter-spacing:2px; white-space:pre",
    )
    expect(renderer.flush().boxByNode.get(text)).toMatchObject({width: 22, height: 60})
    root.setAttribute(
      "style",
      "width:100px; font-size:20px; line-height:12px; letter-spacing:normal; white-space:pre",
    )
    const absolute = renderer.flush()
    expect(absolute.boxByNode.get(text)).toMatchObject({width: 18, height: 24})
    expect(textItems(absolute, text)[0]?.letterSpacing).toBe(0)
    renderer.dispose()
  })

  test("drops invalid higher-priority typography values before cascade", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const text = document.createTextNode("AB")
    document.appendChild(root)
    root.appendChild(text)
    root.id = "root"
    root.setAttribute(
      "style",
      "width:100px; font-size:10px; line-height:-1; letter-spacing:10%; white-space:unknown",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 60},
      styleSheets: [
        "#root { line-height:2; letter-spacing:3px; white-space:pre; }",
      ],
    })

    expect(renderer.flush().boxByNode.get(text)).toMatchObject({width: 15, height: 20})
    expect(textItems(renderer.flush(), text)[0]).toMatchObject({letterSpacing: 3})
    renderer.dispose()
  })
})

describe("nowrap and text-overflow", () => {
  test("collapses one line and emits a width-bounded ellipsis with the stable text key", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const text = document.createTextNode("ABCDE\nFG")
    document.appendChild(root)
    root.appendChild(text)
    root.setAttribute(
      "style",
      "box-sizing:border-box; width:50px; height:20px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:10px; line-height:20px; letter-spacing:2px",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 80, height: 40},
    })

    const frame = renderer.flush()
    expect(frame.boxByNode.get(text)).toMatchObject({width: 62, height: 20})
    expect(textItems(frame, text)).toHaveLength(1)
    expect(textItems(frame, text)[0]).toMatchObject({
      key: "text",
      text: "ABCDE…",
      x: 0,
      y: 0,
      lineHeight: 20,
      letterSpacing: 2,
    })

    root.setAttribute(
      "style",
      "box-sizing:border-box; width:50px; height:20px; overflow:hidden; white-space:nowrap; text-overflow:clip; font-size:10px; line-height:20px; letter-spacing:2px",
    )
    expect(textItems(renderer.flush(), text)[0]?.text).toBe("ABCDE FG")
    renderer.dispose()
  })

  test("uses the same metrics for input/select and multiline textarea fragments", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    const select = document.createElement("select")
    const option = document.createElement("option")
    const textArea = document.createElement("textarea")
    document.appendChild(root)
    root.append(input, select, textArea)
    select.appendChild(option)
    input.value = "ABCDEFG"
    option.label = "ABCDEFG"
    option.selected = true
    textArea.value = "AB\nCD"
    root.setAttribute("style", "display:flex; flex-direction:column; width:80px")
    const singleLine = "box-sizing:border-box; width:35px; height:30px; padding:0; border:0; overflow:hidden; text-overflow:ellipsis; font-size:10px; line-height:20px; letter-spacing:1px"
    input.setAttribute("style", singleLine)
    select.setAttribute("style", singleLine)
    textArea.setAttribute(
      "style",
      "box-sizing:border-box; width:35px; height:50px; padding:0; border:0; white-space:pre; font-size:10px; line-height:20px; letter-spacing:1px",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 140},
    })

    const frame = renderer.flush()
    expect(textItems(frame, input)[0]).toMatchObject({
      key: "value",
      text: "ABCD…",
      y: 5,
      lineHeight: 20,
      letterSpacing: 1,
    })
    expect(textItems(frame, select)[0]).toMatchObject({
      key: "value",
      text: "A…",
      lineHeight: 20,
      letterSpacing: 1,
    })
    const areaLines = textItems(frame, textArea)
    expect(areaLines.map(({key, text, y, letterSpacing}) => ({key, text, y, letterSpacing})))
      .toEqual([
        {key: "value:0", text: "AB", y: 60, letterSpacing: 1},
        {key: "value:1", text: "CD", y: 80, letterSpacing: 1},
      ])
    renderer.dispose()
  })

  test("keeps ellipsis character-data patches equivalent to a forced full frame", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const text = document.createTextNode("ABCDEFG")
    document.appendChild(root)
    root.appendChild(text)
    root.setAttribute(
      "style",
      "box-sizing:border-box; width:35px; height:20px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:10px; line-height:20px; letter-spacing:1px",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 80, height: 40},
    })
    renderer.flush()

    text.data = "HIJKLMN"
    const patched = renderer.flush()
    const forced = createDocumentRenderer({
      document,
      root,
      viewport: {width: 80, height: 40},
    })
    const rebuilt = forced.flush()
    expect(textItems(patched, text)[0]).toMatchObject({key: "text", text: "HIJK…"})
    expect(patched.boxes).toEqual(rebuilt.boxes)
    expect(patched.displayList).toEqual(rebuilt.displayList)
    expect(renderer.flush()).toBe(patched)
    forced.dispose()
    renderer.dispose()
  })
})

function textItems(frame: RenderFrame, node: Node): readonly TextDisplayItem[] {
  return frame.displayList.filter((item): item is TextDisplayItem =>
    item.kind === "text" && item.node === node
  )
}
