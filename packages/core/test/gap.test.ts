import {describe, expect, test} from "bun:test"
import {createDocument, type Element} from "@zavx0z/dom"
import {computeStyle, parseStyleSheets} from "../src/css.ts"
import {createDocumentRenderer} from "../src/index.ts"

const computedGaps = (
  inlineStyle: string | null,
  className = "",
  rules = parseStyleSheets([]),
): Readonly<{rowGap: number; columnGap: number}> => {
  const document = createDocument()
  const element = document.createElement("div")
  document.appendChild(element)
  element.className = className
  if (inlineStyle !== null) element.setAttribute("style", inlineStyle)
  const style = computeStyle(element, null, rules)
  return Object.freeze({rowGap: style.rowGap, columnGap: style.columnGap})
}

describe("bounded Flex gaps", () => {
  test("computes one/two-value shorthand and bounded dimensional values", () => {
    expect(computedGaps(null)).toEqual({rowGap: 0, columnGap: 0})
    expect(computedGaps("gap:5px")).toEqual({rowGap: 5, columnGap: 5})
    expect(computedGaps("gap:2px 7px")).toEqual({rowGap: 2, columnGap: 7})
    expect(computedGaps("gap:normal")).toEqual({rowGap: 0, columnGap: 0})
    expect(computedGaps("gap:normal 6px")).toEqual({rowGap: 0, columnGap: 6})
    expect(computedGaps("font-size:20px;gap:.5em 1em")).toEqual({
      rowGap: 10,
      columnGap: 20,
    })
    expect(computedGaps("gap:2 3")).toEqual({rowGap: 2, columnGap: 3})
    expect(computedGaps("gap:calc(2px + 3px) calc(2px * 4)")).toEqual({
      rowGap: 5,
      columnGap: 8,
    })
  })

  test("preserves shorthand/longhand source order", () => {
    expect(computedGaps(
      "row-gap:1px;column-gap:2px;gap:3px 4px;row-gap:5px",
    )).toEqual({rowGap: 5, columnGap: 4})
    expect(computedGaps(
      "gap:3px 4px;column-gap:6px",
    )).toEqual({rowGap: 3, columnGap: 6})
    expect(computedGaps(
      "gap:5px 7px;gap:-2px",
    )).toEqual({rowGap: 5, columnGap: 7})
    expect(computedGaps(
      "gap:1px;row-gap:2px;gap:3px",
    )).toEqual({rowGap: 3, columnGap: 3})
    expect(computedGaps(
      null,
      "ordered",
      parseStyleSheets([".ordered{gap:1px;row-gap:2px;gap:3px}"]),
    )).toEqual({rowGap: 3, columnGap: 3})
    expect(computedGaps(
      "column-gap:9px;--pair:3px 4px;gap:var(--pair);row-gap:7px",
    )).toEqual({rowGap: 7, columnGap: 4})
    expect(computedGaps(
      "--pair:3px 4px;gap:var(--pair);column-gap:9px",
    )).toEqual({rowGap: 3, columnGap: 9})
  })

  test("rejects direct invalid values before cascade priority", () => {
    const rules = parseStyleSheets([
      ".lower{row-gap:4px;column-gap:6px}",
    ])
    for (const inlineStyle of [
      "row-gap:-1px;column-gap:20%",
      "gap:-1px 8px",
      "gap:2px -8px",
      "gap:calc(100% - 2px) 8px",
      "gap:1px 2px 3px",
    ]) {
      expect(computedGaps(inlineStyle, "lower", rules)).toEqual({
        rowGap: 4,
        columnGap: 6,
      })
    }
  })

  test("resolves variables and keeps computed-invalid winners at initial zero", () => {
    const rules = parseStyleSheets([
      ".lower{row-gap:4px;column-gap:6px}",
    ])
    expect(computedGaps(
      "--pair:calc(2px + 3px) 8px;gap:var(--pair)",
    )).toEqual({rowGap: 5, columnGap: 8})
    expect(computedGaps(
      "font-size:20px;--row:.5em;--column:calc(2px * 3);row-gap:var(--row);column-gap:var(--column)",
    )).toEqual({rowGap: 10, columnGap: 6})
    expect(computedGaps(
      "--bad:-1px 8px;gap:var(--bad)",
      "lower",
      rules,
    )).toEqual({rowGap: 0, columnGap: 0})
    expect(computedGaps(
      "--negative:-1px;--percent:20%;row-gap:var(--negative);column-gap:var(--percent)",
      "lower",
      rules,
    )).toEqual({rowGap: 0, columnGap: 0})
    expect(computedGaps(
      "gap:var(--missing)",
      "lower",
      rules,
    )).toEqual({rowGap: 0, columnGap: 0})
    expect(computedGaps(
      "gap:5px 7px;gap:var(--missing)",
    )).toEqual({rowGap: 0, columnGap: 0})
    expect(computedGaps(
      "--bad:-1px 8px;gap:var(--bad);row-gap:9px",
    )).toEqual({rowGap: 9, columnGap: 0})

    const higherShorthand = parseStyleSheets([
      ".high{gap:var(--pair)}div{row-gap:var(--low)}",
    ])
    expect(computedGaps(
      "--pair:5px 6px;--low:2px",
      "high",
      higherShorthand,
    )).toEqual({rowGap: 5, columnGap: 6})
    expect(computedGaps(
      "--pair:5px 6px;--low:-1px",
      "high",
      higherShorthand,
    )).toEqual({rowGap: 5, columnGap: 6})
  })

  test("maps column-gap to a row main axis and row-gap to a column main axis", () => {
    for (const direction of ["row", "column"] as const) {
      const document = createDocument()
      const container = document.createElement("div")
      const children = Array.from({length: 3}, () => document.createElement("div"))
      const absolute = document.createElement("div")
      document.appendChild(container)
      container.append(...children, absolute)
      container.setAttribute(
        "style",
        `display:flex; flex-direction:${direction}; row-gap:7px; column-gap:11px; position:relative`,
      )
      for (const child of children) {
        child.setAttribute("style", "flex:none; width:20px; height:10px")
      }
      absolute.setAttribute(
        "style",
        "position:absolute; width:5px; height:5px",
      )
      const renderer = createDocumentRenderer({
        document,
        root: container,
        viewport: {width: 200, height: 100},
      })

      const frame = renderer.flush()
      expect(children.map((child) => frame.boxByNode.get(child)?.x)).toEqual(
        direction === "row" ? [0, 31, 62] : [0, 0, 0],
      )
      expect(children.map((child) => frame.boxByNode.get(child)?.y)).toEqual(
        direction === "row" ? [0, 0, 0] : [0, 17, 34],
      )
      expect(frame.boxByNode.get(absolute)).toMatchObject({x: 0, y: 0})
      expect(renderer.flush()).toBe(frame)
    }
  })

  test("forms gaps only between rendered flex items", () => {
    for (const middle of ["hidden", "whitespace"] as const) {
      const document = createDocument()
      const container = document.createElement("div")
      const first = document.createElement("div")
      const second = document.createElement("div")
      document.appendChild(container)
      container.appendChild(first)
      const ignored = middle === "hidden"
        ? document.createElement("div")
        : document.createTextNode("   ")
      container.appendChild(ignored)
      container.appendChild(second)
      container.setAttribute("style", "display:flex; width:100px; column-gap:10px")
      first.setAttribute("style", "flex:none; width:20px; height:10px")
      second.setAttribute("style", "flex:none; width:20px; height:10px")
      if (middle === "hidden" && ignored.nodeType === 1) {
        (ignored as Element).setAttribute(
          "style",
          "display:none; flex:none; width:50px; height:10px",
        )
      }

      const frame = createDocumentRenderer({
        document,
        root: container,
        viewport: {width: 100, height: 50},
      }).flush()
      expect(frame.boxByNode.get(first)).toMatchObject({x: 0, width: 20})
      expect(frame.boxByNode.get(second)).toMatchObject({x: 30, width: 20})
      if (middle === "hidden") expect(frame.boxByNode.has(ignored)).toBe(false)
    }
  })

  test("uses distinct main and cross gaps while wrapping rows and columns", () => {
    for (const direction of ["row", "column"] as const) {
      const document = createDocument()
      const container = document.createElement("div")
      const children = Array.from({length: 3}, () => document.createElement("div"))
      document.appendChild(container)
      container.append(...children)
      container.setAttribute(
        "style",
        direction === "row"
          ? "display:flex; width:95px; height:50px; flex-wrap:wrap; align-content:flex-start; row-gap:10px; column-gap:5px"
          : "display:flex; width:50px; height:95px; flex-direction:column; flex-wrap:wrap; align-content:flex-start; row-gap:10px; column-gap:5px",
      )
      for (const child of children) {
        child.setAttribute(
          "style",
          direction === "row"
            ? "flex:none; width:40px; height:10px"
            : "flex:none; width:10px; height:40px",
        )
      }

      const frame = createDocumentRenderer({
        document,
        root: container,
        viewport: {width: 100, height: 100},
      }).flush()
      expect(children.map((child) => frame.boxByNode.get(child)?.x)).toEqual(
        direction === "row" ? [0, 45, 0] : [0, 0, 15],
      )
      expect(children.map((child) => frame.boxByNode.get(child)?.y)).toEqual(
        direction === "row" ? [0, 0, 20] : [0, 50, 0],
      )
    }
  })

  test("keeps the cross gap mandatory before align-content distributes free space", () => {
    for (const direction of ["row", "column"] as const) {
      const document = createDocument()
      const container = document.createElement("div")
      const children = Array.from({length: 3}, () => document.createElement("div"))
      document.appendChild(container)
      container.append(...children)
      container.setAttribute(
        "style",
        direction === "row"
          ? "display:flex; width:95px; height:100px; flex-wrap:wrap; align-content:stretch; align-items:flex-start; gap:10px 5px"
          : "display:flex; width:100px; height:95px; flex-direction:column; flex-wrap:wrap; align-content:stretch; align-items:flex-start; gap:10px 5px",
      )
      for (const child of children) {
        child.setAttribute(
          "style",
          direction === "row"
            ? "flex:none; width:40px; height:10px"
            : "flex:none; width:10px; height:40px",
        )
      }

      const frame = createDocumentRenderer({
        document,
        root: container,
        viewport: {width: 100, height: 100},
      }).flush()
      expect(children.map((child) => frame.boxByNode.get(child)?.x)).toEqual(
        direction === "row" ? [0, 45, 0] : [0, 0, 52.5],
      )
      expect(children.map((child) => frame.boxByNode.get(child)?.y)).toEqual(
        direction === "row" ? [0, 0, 55] : [0, 50, 0],
      )
    }
  })

  test("includes split gaps in auto cross and intrinsic wrapped sizes", () => {
    const document = createDocument()
    const outer = document.createElement("div")
    const row = document.createElement("div")
    const column = document.createElement("div")
    const rowChildren = Array.from({length: 3}, () => document.createElement("span"))
    const columnChildren = Array.from({length: 3}, () => document.createElement("span"))
    document.appendChild(outer)
    outer.append(row, column)
    row.append(...rowChildren)
    column.append(...columnChildren)
    outer.setAttribute(
      "style",
      "display:flex; align-items:flex-start; width:200px",
    )
    row.setAttribute(
      "style",
      "display:flex; flex:none; width:95px; flex-wrap:wrap; align-content:flex-start; row-gap:10px; column-gap:5px",
    )
    column.setAttribute(
      "style",
      "display:flex; flex:none; height:95px; flex-direction:column; flex-wrap:wrap; align-content:flex-start; row-gap:10px; column-gap:5px",
    )
    for (const child of rowChildren) {
      child.setAttribute("style", "flex:none; width:40px; height:10px")
    }
    for (const child of columnChildren) {
      child.setAttribute("style", "flex:none; width:10px; height:40px")
    }

    const renderer = createDocumentRenderer({
      document,
      root: outer,
      viewport: {width: 200, height: 100},
    })
    const frame = renderer.flush()
    expect(frame.boxByNode.get(row)).toMatchObject({width: 95, height: 30})
    expect(frame.boxByNode.get(rowChildren[2]!)).toMatchObject({x: 0, y: 20})
    expect(frame.boxByNode.get(column)).toMatchObject({x: 95, y: 0, width: 25, height: 95})
    expect(frame.boxByNode.get(columnChildren[2]!)).toMatchObject({x: 110, y: 0})
    expect(renderer.flush()).toBe(frame)
  })
})
