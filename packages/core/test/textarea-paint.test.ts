import {describe, expect, test} from "bun:test"
import {
  createDocument,
  type HTMLTextAreaElement,
} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type RenderFrame,
  type TextDisplayItem,
} from "../src/index.ts"

describe("textarea replaced-control paint", () => {
  test("owns one outer box/hit and paints live multiline value with stable line keys", () => {
    const document = createDocument()
    const textArea = document.createElement("textarea")
    textArea.defaultValue = "First\nSecond"
    const fallbackText = textArea.firstChild!
    textArea.setAttribute(
      "style",
      "width:120px; height:50px; padding:4px; border:0; background:red; color:blue; font-size:10px; white-space:pre",
    )
    document.appendChild(textArea)
    const frame = createDocumentRenderer({
      document,
      root: textArea,
      viewport: {width: 140, height: 70},
    }).flush()
    const lines = valueLines(frame, textArea)

    expect(frame.boxes).toHaveLength(1)
    expect(frame.boxByNode.get(textArea)).toMatchObject({
      x: 0,
      y: 0,
      width: 120,
      height: 50,
      contentX: 4,
      contentY: 4,
      contentWidth: 112,
      contentHeight: 42,
    })
    expect(lines.map(({key, text, x, y}) => ({key, text, x, y}))).toEqual([
      {key: "value:0", text: "First", x: 4, y: 4},
      {key: "value:1", text: "Second", x: 4, y: 16},
    ])
    expect(lines.every(({clips}) => clips.length === 1)).toBeTrue()
    expect(frame.hits.get(textArea)).toMatchObject({
      node: textArea,
      role: "textbox",
      disabled: false,
      interactive: true,
    })
    expect(frame.boxByNode.has(fallbackText)).toBeFalse()
    expect(frame.displayList.some(({node}) => node === fallbackText)).toBeFalse()
    expect(textArea.childNodes).toEqual([fallbackText])
  })

  test("switches default, placeholder and live state without synthetic events", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const textArea = document.createElement("textarea")
    root.appendChild(textArea)
    document.appendChild(root)
    textArea.placeholder = "Hint"
    textArea.setAttribute(
      "style",
      "width:120px; height:50px; padding:2px; border:0; font-size:10px; white-space:pre",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 140, height: 70},
    })
    const placeholderFrame = renderer.flush()
    const placeholder = valueLines(placeholderFrame, textArea)[0]!
    const events: string[] = []
    textArea.addEventListener("input", ({type}) => events.push(type))
    textArea.addEventListener("change", ({type}) => events.push(type))

    expect(placeholder).toMatchObject({
      key: "value:0",
      text: "Hint",
      opacity: 0.55,
    })
    textArea.defaultValue = "Default\ntext"
    const defaultFrame = renderer.flush()
    expect(valueLines(defaultFrame, textArea).map(({key, text}) => ({key, text}))).toEqual([
      {key: "value:0", text: "Default"},
      {key: "value:1", text: "text"},
    ])

    textArea.value = "Live\nvalue"
    textArea.defaultValue = "Ignored default"
    const liveFrame = renderer.flush()
    const live = valueLines(liveFrame, textArea)
    expect(live.map(({key, text}) => ({key, text}))).toEqual([
      {key: "value:0", text: "Live"},
      {key: "value:1", text: "value"},
    ])
    expect(live[0]).toMatchObject({
      node: placeholder.node,
      key: placeholder.key,
      opacity: 1,
    })
    expect(textArea.defaultValue).toBe("Ignored default")
    expect(textArea.value).toBe("Live\nvalue")
    expect(events).toEqual([])
    expect(renderer.flush()).toBe(liveFrame)
    renderer.dispose()
  })

  test("wraps preserved and collapsed white-space into deterministic composite lines", () => {
    const document = createDocument()
    const textArea = document.createElement("textarea")
    document.appendChild(textArea)
    textArea.setAttribute(
      "style",
      "box-sizing:border-box; width:42px; height:80px; padding:0; border:0; font-size:10px; white-space:pre; overflow:clip",
    )
    textArea.value = "abcdefghij\n  xy"
    const renderer = createDocumentRenderer({
      document,
      root: textArea,
      viewport: {width: 60, height: 90},
    })
    expect(valueLines(renderer.flush(), textArea).map(({key, text}) => ({key, text}))).toEqual([
      {key: "value:0", text: "abcdefg"},
      {key: "value:1", text: "hij"},
      {key: "value:2", text: "  xy"},
    ])

    textArea.value = "alpha   beta\ngamma"
    textArea.setAttribute("style", `${textArea.getAttribute("style")}; white-space:normal`)
    expect(valueLines(renderer.flush(), textArea).map(({key, text}) => ({key, text}))).toEqual([
      {key: "value:0", text: "alpha"},
      {key: "value:1", text: "beta"},
      {key: "value:2", text: "gamma"},
    ])

    textArea.wrap = "off"
    textArea.value = "abcdefghij"
    textArea.setAttribute("style", `${textArea.getAttribute("style")}; white-space:pre`)
    expect(valueLines(renderer.flush(), textArea).map(({text}) => text)).toEqual(["abcdefghij"])
    renderer.dispose()
  })

  test("derives UA rows/cols size and lets author CSS own the outer box", () => {
    const document = createDocument()
    const textArea = document.createElement("textarea")
    document.appendChild(textArea)
    const renderer = createDocumentRenderer({
      document,
      root: textArea,
      viewport: {width: 300, height: 120},
    })
    const defaults = renderer.flush()
    expect(defaults.boxByNode.get(textArea)?.width).toBeCloseTo(170)
    expect(defaults.boxByNode.get(textArea)?.height).toBeCloseTo(37.2)

    textArea.rows = 3
    textArea.cols = 10
    const reflected = renderer.flush()
    expect(reflected.boxByNode.get(textArea)?.width).toBeCloseTo(92)
    expect(reflected.boxByNode.get(textArea)?.height).toBeCloseTo(52.8)

    textArea.setAttribute(
      "style",
      "box-sizing:border-box; width:200px; height:60px; padding:5px 8px; border:2px solid #123456; background:#abcdef; color:#102030; font-size:16px",
    )
    textArea.value = "Author"
    const authored = renderer.flush()
    expect(authored.boxByNode.get(textArea)).toMatchObject({
      width: 200,
      height: 60,
      contentX: 10,
      contentY: 7,
      contentWidth: 180,
      contentHeight: 46,
    })
    expect(valueLines(authored, textArea)[0]).toMatchObject({
      text: "Author",
      x: 10,
      y: 7,
      color: "#102030",
      fontSize: 16,
    })
    renderer.dispose()
  })

  test("keeps readonly focus/hit active and disables both through disabled state", () => {
    const document = createDocument()
    const textArea = document.createElement("textarea")
    textArea.value = "Text"
    textArea.readOnly = true
    document.appendChild(textArea)
    const renderer = createDocumentRenderer({
      document,
      root: textArea,
      viewport: {width: 200, height: 60},
    })
    const readonly = renderer.flush()

    expect(readonly.hits.get(textArea)).toMatchObject({
      role: "textbox",
      disabled: false,
      interactive: true,
    })
    expect(valueLines(readonly, textArea)[0]?.opacity).toBe(1)
    textArea.focus()
    expect(document.activeElement).toBe(textArea)
    textArea.blur()

    textArea.disabled = true
    const disabled = renderer.flush()
    expect(disabled.hits.get(textArea)).toMatchObject({
      role: "textbox",
      disabled: true,
      interactive: false,
    })
    expect(valueLines(disabled, textArea)[0]?.opacity).toBe(0.5)
    textArea.focus()
    expect(document.activeElement).toBeNull()
    renderer.dispose()
  })
})

function valueLines(frame: RenderFrame, textArea: HTMLTextAreaElement): TextDisplayItem[] {
  return frame.displayList.filter((item): item is TextDisplayItem =>
    item.kind === "text" && item.node === textArea && item.key.startsWith("value:")
  )
}
