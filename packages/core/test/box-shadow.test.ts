import {describe, expect, test} from "bun:test"
import {createDocument, type Element} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type RectDisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("single box-shadow projection", () => {
  test("emits one analytical shadow behind the owner background without changing layout or hits", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    root.setAttribute(
      "style",
      "box-sizing:border-box; width:100px; height:50px; border-radius:10px; background:#ffffff; box-shadow:4px 6px 8px 2px rgba(0, 0, 0, .5)",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 160, height: 100},
    })

    const frame = renderer.flush()
    expect(frame.boxByNode.get(root)).toMatchObject({x: 0, y: 0, width: 100, height: 50})
    expect(frame.hits.get(root)).toMatchObject({x: 0, y: 0, width: 100, height: 50})
    expect(frame.displayList.filter(({node}) => node === root).map(({key}) => key)).toEqual([
      "shadow",
      "background",
    ])
    expect(shadow(frame, root)).toMatchObject({
      key: "shadow",
      x: 4,
      y: 6,
      width: 100,
      height: 50,
      color: "rgba(0, 0, 0, .5)",
      opacity: 1,
      shadow: {blurRadius: 8, spreadRadius: 2},
      border: {radii: {topLeft: 10, topRight: 10, bottomRight: 10, bottomLeft: 10}},
    })
    expect(renderer.flush()).toBe(frame)
    renderer.dispose()
  })

  test("discards unsupported multiple/inset/negative-blur declarations before cascade priority", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    root.id = "root"
    root.setAttribute(
      "style",
      "box-sizing:border-box; width:80px; height:40px; color:#123456; background:#ffffff",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 80},
      styleSheets: [
        "#root { box-shadow:1px 2px 3px currentcolor; }",
        "#root { box-shadow:inset 0 0 4px black; }",
        "#root { box-shadow:0 0 -1px red; }",
        "#root { box-shadow:0 0 1px black, 0 0 2px white; }",
      ],
    })

    expect(shadow(renderer.flush(), root)).toMatchObject({
      x: 1,
      y: 2,
      color: "#123456",
      shadow: {blurRadius: 3, spreadRadius: 0},
    })
    root.setAttribute(
      "style",
      "box-sizing:border-box; width:80px; height:40px; background:#ffffff; box-shadow:none",
    )
    expect(renderer.flush().displayList.some(({node, key}) => node === root && key === "shadow"))
      .toBeFalse()
    renderer.dispose()
  })

  test("represents negative spread as an exact contracted source shape", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    root.setAttribute(
      "style",
      "box-sizing:border-box; width:20px; height:10px; border-radius:5px; box-shadow:0 0 4px -2px black",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 60, height: 40},
    })

    expect(shadow(renderer.flush(), root)).toMatchObject({
      x: 2,
      y: 2,
      width: 16,
      height: 6,
      color: "#000000",
      shadow: {blurRadius: 4, spreadRadius: 0},
      border: {radii: {topLeft: 3, topRight: 3, bottomRight: 3, bottomLeft: 3}},
    })
    renderer.dispose()
  })

  test("inherits ancestor clips, effective opacity and cumulative transform", () => {
    const document = createDocument()
    const outer = document.createElement("div")
    const card = document.createElement("div")
    document.appendChild(outer)
    outer.appendChild(card)
    outer.setAttribute(
      "style",
      "box-sizing:border-box; width:100px; height:50px; overflow:hidden; opacity:.5; transform:translateX(10px) scale(2); transform-origin:0 0",
    )
    card.setAttribute(
      "style",
      "box-sizing:border-box; width:60px; height:30px; opacity:.5; box-shadow:4px 2px 6px #0008",
    )
    const renderer = createDocumentRenderer({
      document,
      root: outer,
      viewport: {width: 240, height: 120},
    })

    const item = shadow(renderer.flush(), card)
    expect(item.opacity).toBe(0.25)
    expect(item.transform).toEqual({scaleX: 2, scaleY: 2, translateX: 10, translateY: 0})
    expect(item.clips).toHaveLength(1)
    expect(item.clips[0]?.transform).toEqual(item.transform)
    expect(renderer.flush().hits.has(card)).toBeTrue()
    renderer.dispose()
  })

  test("updates the same composite shadow identity while preserving the owner box", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    const base = "box-sizing:border-box; width:100px; height:50px; background:#ffffff"
    root.setAttribute("style", `${base}; box-shadow:1px 2px 3px #0008`)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 160, height: 100},
    })
    const first = renderer.flush()
    const firstBox = first.boxByNode.get(root)

    root.setAttribute("style", `${base}; box-shadow:5px 6px 9px 2px #123456`)
    const second = renderer.flush()
    expect(second.boxByNode.get(root)).toMatchObject({width: firstBox?.width, height: firstBox?.height})
    expect(shadow(second, root)).toMatchObject({
      node: root,
      key: "shadow",
      x: 5,
      y: 6,
      color: "#123456",
      shadow: {blurRadius: 9, spreadRadius: 2},
    })
    renderer.dispose()
  })
})

function shadow(frame: RenderFrame, node: Element): RectDisplayItem {
  const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
    candidate.kind === "rect" && candidate.node === node && candidate.key === "shadow"
  )
  if (!item) throw new Error("Expected shadow Rect")
  return item
}
