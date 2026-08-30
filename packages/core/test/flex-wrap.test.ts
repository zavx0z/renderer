import {describe, expect, test} from "bun:test"
import {createDocument} from "@zavx0z/dom"
import {computeStyle, parseStyleSheets} from "../src/css.ts"
import {createDocumentRenderer} from "../src/index.ts"

describe("flex-wrap", () => {
  test("transports the bounded keywords and falls back to nowrap", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    const values = [
      undefined,
      "nowrap",
      "wrap",
      "wrap-reverse",
      "balance",
      "sideways",
      "var(--mode)",
    ]
    const elements = values.map((value) => {
      const element = document.createElement("div")
      if (value !== undefined) element.setAttribute("style", `flex-wrap:${value}`)
      if (value === "var(--mode)") element.setAttribute("style", "--mode:wrap-reverse;flex-wrap:var(--mode)")
      root.appendChild(element)
      return element
    })
    const rejectedWinner = document.createElement("div")
    rejectedWinner.className = "valid-lower"
    rejectedWinner.setAttribute("style", "flex-wrap:balance")
    root.appendChild(rejectedWinner)
    const rules = parseStyleSheets([".valid-lower{flex-wrap:wrap}"])

    expect(elements.map((element) => computeStyle(element, null, rules).flexWrap)).toEqual([
      "nowrap",
      "nowrap",
      "wrap",
      "wrap-reverse",
      "nowrap",
      "nowrap",
      "wrap-reverse",
    ])
    expect(computeStyle(rejectedWinner, null, rules).flexWrap).toBe("wrap")
  })

  test("wraps rows against their definite width and grows an auto cross size", () => {
    const document = createDocument()
    const row = document.createElement("div")
    const children = Array.from({length: 3}, () => document.createElement("div"))
    document.appendChild(row)
    row.setAttribute("style", "display:flex; width:100px; gap:5px")
    for (const child of children) {
      child.setAttribute("style", "flex:none; width:40px; height:10px")
      row.appendChild(child)
    }
    children[0]!.setAttribute(
      "style",
      "flex:none; width:40px; height:10px; margin-right:5px; margin-bottom:3px",
    )
    const renderer = createDocumentRenderer({
      document,
      root: row,
      viewport: {width: 200, height: 100},
    })

    const nowrap = renderer.flush()
    expect(nowrap.boxByNode.get(row)).toMatchObject({width: 100, height: 13})
    expect(children.map((child) => nowrap.boxByNode.get(child)?.x)).toEqual([0, 50, 95])
    expect(children.map((child) => nowrap.boxByNode.get(child)?.y)).toEqual([0, 0, 0])

    row.setAttribute("style", "display:flex; width:100px; flex-wrap:wrap; gap:5px")
    const wrapped = renderer.flush()
    expect(wrapped.boxByNode.get(row)).toMatchObject({width: 100, height: 28})
    expect(wrapped.boxByNode.get(children[0]!)).toMatchObject({x: 0, y: 0, width: 40, height: 10})
    expect(wrapped.boxByNode.get(children[1]!)).toMatchObject({x: 50, y: 0, width: 40, height: 10})
    expect(wrapped.boxByNode.get(children[2]!)).toMatchObject({x: 0, y: 18, width: 40, height: 10})
    expect(renderer.flush()).toBe(wrapped)
  })

  test("distributes flex space, justification and alignment independently per row line", () => {
    const document = createDocument()
    const row = document.createElement("div")
    const first = document.createElement("div")
    const second = document.createElement("div")
    const centered = document.createElement("div")
    const shrinking = document.createElement("div")
    document.appendChild(row)
    row.append(first, second, centered, shrinking)
    row.setAttribute(
      "style",
      "display:flex; width:100px; flex-wrap:wrap; gap:10px; justify-content:center; align-items:center",
    )
    first.setAttribute("style", "flex:1 1 40px; height:10px")
    second.setAttribute("style", "flex:1 1 40px; height:20px")
    centered.setAttribute("style", "flex:none; width:60px; height:10px")
    shrinking.setAttribute("style", "flex:0 1 120px; min-width:0; height:10px")

    const frame = createDocumentRenderer({
      document,
      root: row,
      viewport: {width: 200, height: 100},
    }).flush()

    expect(frame.boxByNode.get(row)).toMatchObject({width: 100, height: 60})
    expect(frame.boxByNode.get(first)).toMatchObject({x: 0, y: 5, height: 10})
    expect(frame.boxByNode.get(first)?.width).toBeCloseTo(45)
    expect(frame.boxByNode.get(second)).toMatchObject({x: 55, y: 0, height: 20})
    expect(frame.boxByNode.get(second)?.width).toBeCloseTo(45)
    expect(frame.boxByNode.get(centered)).toMatchObject({x: 20, y: 30, width: 60, height: 10})
    expect(frame.boxByNode.get(shrinking)).toMatchObject({x: 0, y: 50, width: 100, height: 10})
  })

  test("uses a wrapped auto cross size as an intrinsic flex item basis", () => {
    const document = createDocument()
    const column = document.createElement("div")
    const row = document.createElement("div")
    const after = document.createElement("div")
    const children = Array.from({length: 3}, () => document.createElement("div"))
    document.appendChild(column)
    column.append(row, after)
    row.append(...children)
    column.setAttribute("style", "display:flex; flex-direction:column; width:100px; height:100px")
    row.setAttribute("style", "display:flex; flex:none; width:100px; flex-wrap:wrap; gap:5px")
    after.setAttribute("style", "flex:none; height:10px")
    for (const child of children) {
      child.setAttribute("style", "flex:none; width:40px; height:10px")
    }

    const frame = createDocumentRenderer({
      document,
      root: column,
      viewport: {width: 200, height: 200},
    }).flush()

    expect(frame.boxByNode.get(row)).toMatchObject({x: 0, y: 0, width: 100, height: 25})
    expect(frame.boxByNode.get(children[2]!)).toMatchObject({x: 0, y: 15})
    expect(frame.boxByNode.get(after)).toMatchObject({x: 0, y: 25, height: 10})
  })

  test("wraps columns only when their main size is definite", () => {
    const document = createDocument()
    const column = document.createElement("div")
    const children = [10, 20, 15].map((width) => {
      const child = document.createElement("div")
      child.setAttribute("style", `flex:none; width:${width}px; height:40px`)
      return child
    })
    document.appendChild(column)
    column.append(...children)
    column.setAttribute(
      "style",
      "display:flex; flex-direction:column; flex-wrap:wrap; width:50px; height:100px; gap:10px; align-items:flex-end",
    )

    const frame = createDocumentRenderer({
      document,
      root: column,
      viewport: {width: 100, height: 200},
    }).flush()

    expect(frame.boxByNode.get(children[0]!)).toMatchObject({x: 10, y: 0, width: 10, height: 40})
    expect(frame.boxByNode.get(children[1]!)).toMatchObject({x: 0, y: 50, width: 20, height: 40})
    expect(frame.boxByNode.get(children[2]!)).toMatchObject({x: 30, y: 0, width: 15, height: 40})
  })

  test("does not invent a column wrap boundary for an auto main size", () => {
    const document = createDocument()
    const column = document.createElement("div")
    const children = Array.from({length: 3}, () => document.createElement("div"))
    document.appendChild(column)
    column.append(...children)
    column.setAttribute(
      "style",
      "display:flex; flex-direction:column; flex-wrap:wrap; width:40px; gap:10px",
    )
    for (const child of children) {
      child.setAttribute("style", "flex:none; width:10px; height:40px")
    }

    const frame = createDocumentRenderer({
      document,
      root: column,
      viewport: {width: 100, height: 100},
    }).flush()

    expect(frame.boxByNode.get(column)).toMatchObject({width: 40, height: 140})
    expect(children.map((child) => frame.boxByNode.get(child)?.x)).toEqual([0, 0, 0])
    expect(children.map((child) => frame.boxByNode.get(child)?.y)).toEqual([0, 50, 100])
  })

  test("packs wrap-reverse source lines from the cross end", () => {
    const document = createDocument()
    const row = document.createElement("div")
    const children = Array.from({length: 3}, () => document.createElement("div"))
    document.appendChild(row)
    row.append(...children)
    row.setAttribute(
      "style",
      "display:flex; width:90px; height:50px; flex-wrap:wrap-reverse; gap:5px",
    )
    for (const child of children) {
      child.setAttribute("style", "flex:none; width:40px; height:10px")
    }

    const frame = createDocumentRenderer({
      document,
      root: row,
      viewport: {width: 100, height: 100},
    }).flush()

    expect(frame.boxByNode.get(children[0]!)).toMatchObject({x: 0, y: 40})
    expect(frame.boxByNode.get(children[1]!)).toMatchObject({x: 45, y: 40})
    expect(frame.boxByNode.get(children[2]!)).toMatchObject({x: 0, y: 25})
  })
})
