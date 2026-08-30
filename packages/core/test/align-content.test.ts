import {describe, expect, test} from "bun:test"
import {createDocument} from "@zavx0z/dom"
import {computeStyle, parseStyleSheets} from "../src/css.ts"
import {createDocumentRenderer} from "../src/index.ts"
import type {RenderAlignContent, RenderAlignItems} from "../src/types.ts"

type FlexDirection = "row" | "column"
type FlexWrap = "nowrap" | "wrap" | "wrap-reverse"

const renderPackedLines = (
  direction: FlexDirection,
  alignContent: RenderAlignContent,
  options: Readonly<{
    alignItems?: RenderAlignItems
    childCount?: number
    crossSize?: number | null
    wrap?: FlexWrap
  }> = {},
): Readonly<{
  childCrossPositions: readonly number[]
  childCrossSizes: readonly number[]
  containerCrossSize: number
}> => {
  const document = createDocument()
  const container = document.createElement("div")
  const children = Array.from(
    {length: options.childCount ?? 3},
    () => document.createElement("div"),
  )
  const crossSize = options.crossSize === undefined ? 100 : options.crossSize
  const mainDeclaration = direction === "row" ? "width:90px" : "height:90px"
  const crossDeclaration = crossSize === null
    ? ""
    : direction === "row"
      ? `height:${crossSize}px`
      : `width:${crossSize}px`
  document.appendChild(container)
  container.append(...children)
  container.setAttribute(
    "style",
    `display:flex; flex-direction:${direction}; flex-wrap:${options.wrap ?? "wrap"}; align-content:${alignContent}; align-items:${options.alignItems ?? "flex-start"}; gap:10px; ${mainDeclaration}; ${crossDeclaration}`,
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
  const containerBox = frame.boxByNode.get(container)!
  const childBoxes = children.map((child) => frame.boxByNode.get(child)!)
  return Object.freeze({
    childCrossPositions: Object.freeze(
      childBoxes.map((box) => direction === "row" ? box.y : box.x),
    ),
    childCrossSizes: Object.freeze(
      childBoxes.map((box) => direction === "row" ? box.height : box.width),
    ),
    containerCrossSize: direction === "row" ? containerBox.height : containerBox.width,
  })
}

const expectCloseArray = (
  actual: readonly number[],
  expected: readonly number[],
): void => {
  expect(actual).toHaveLength(expected.length)
  for (let index = 0; index < expected.length; index++) {
    expect(actual[index]).toBeCloseTo(expected[index]!)
  }
}

describe("align-content", () => {
  test("computes the bounded keywords, variables and invalid-declaration fallback", () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    const values = [
      undefined,
      "normal",
      "stretch",
      "flex-start",
      "flex-end",
      "center",
      "space-between",
      "space-around",
      "space-evenly",
      "start",
      "baseline",
      "var(--packing)",
    ]
    const elements = values.map((value) => {
      const element = document.createElement("div")
      if (value !== undefined) element.setAttribute("style", `align-content:${value}`)
      if (value === "var(--packing)") {
        element.setAttribute(
          "style",
          "--packing:space-evenly; align-content:var(--packing)",
        )
      }
      root.appendChild(element)
      return element
    })
    const rejectedWinner = document.createElement("div")
    rejectedWinner.className = "valid-lower"
    rejectedWinner.setAttribute("style", "align-content:baseline")
    root.appendChild(rejectedWinner)
    const rules = parseStyleSheets([".valid-lower{align-content:center}"])

    expect(elements.map((element) => computeStyle(element, null, rules).alignContent)).toEqual([
      "normal",
      "normal",
      "stretch",
      "flex-start",
      "flex-end",
      "center",
      "space-between",
      "space-around",
      "space-evenly",
      "normal",
      "normal",
      "space-evenly",
    ])
    expect(computeStyle(rejectedWinner, null, rules).alignContent).toBe("center")
  })

  test("positions and distributes positive cross free space for rows and columns", () => {
    const expectations: readonly (readonly [RenderAlignContent, readonly number[]])[] = [
      ["normal", [0, 0, 55]],
      ["stretch", [0, 0, 55]],
      ["flex-start", [0, 0, 20]],
      ["flex-end", [70, 70, 90]],
      ["center", [35, 35, 55]],
      ["space-between", [0, 0, 90]],
      ["space-around", [17.5, 17.5, 72.5]],
      ["space-evenly", [70 / 3, 70 / 3, 200 / 3]],
    ]

    for (const direction of ["row", "column"] as const) {
      for (const [alignContent, expected] of expectations) {
        const result = renderPackedLines(direction, alignContent)
        expectCloseArray(result.childCrossPositions, expected)
      }
    }
  })

  test("applies alignment to one wrapped line and ignores it for nowrap", () => {
    for (const direction of ["row", "column"] as const) {
      expectCloseArray(
        renderPackedLines(direction, "flex-end", {childCount: 1}).childCrossPositions,
        [90],
      )
      expectCloseArray(
        renderPackedLines(direction, "space-between", {childCount: 1}).childCrossPositions,
        [0],
      )
      expectCloseArray(
        renderPackedLines(direction, "space-around", {childCount: 1}).childCrossPositions,
        [45],
      )
      expectCloseArray(
        renderPackedLines(direction, "space-evenly", {childCount: 1}).childCrossPositions,
        [45],
      )
      expectCloseArray(
        renderPackedLines(direction, "flex-end", {wrap: "nowrap"}).childCrossPositions,
        [0, 0, 0],
      )
    }
  })

  test("does not invent free space for an auto cross size", () => {
    for (const alignContent of ["stretch", "flex-end", "space-between"] as const) {
      const result = renderPackedLines("row", alignContent, {crossSize: null})
      expect(result.containerCrossSize).toBe(30)
      expectCloseArray(result.childCrossPositions, [0, 0, 20])
      expectCloseArray(result.childCrossSizes, [10, 10, 10])
    }
  })

  test("uses a larger cross size allocated to an auto-authored nested flex item", () => {
    const document = createDocument()
    const parent = document.createElement("div")
    const wrapped = document.createElement("div")
    const children = Array.from({length: 3}, () => document.createElement("div"))
    document.appendChild(parent)
    parent.appendChild(wrapped)
    wrapped.append(...children)
    parent.setAttribute(
      "style",
      "display:flex; flex-direction:column; width:90px; height:100px",
    )
    wrapped.setAttribute(
      "style",
      "display:flex; flex:1 1 0px; width:90px; flex-wrap:wrap; align-items:flex-start; gap:10px",
    )
    for (const child of children) {
      child.setAttribute("style", "flex:none; width:40px; height:10px")
    }

    const frame = createDocumentRenderer({
      document,
      root: parent,
      viewport: {width: 100, height: 100},
    }).flush()

    expect(frame.boxByNode.get(wrapped)).toMatchObject({width: 90, height: 100})
    expectCloseArray(
      children.map((child) => frame.boxByNode.get(child)!.y),
      [0, 0, 55],
    )
  })

  test("stretches line cross sizes before align-items stretches auto-cross children", () => {
    for (const direction of ["row", "column"] as const) {
      const document = createDocument()
      const container = document.createElement("div")
      const children = Array.from({length: 4}, () => document.createElement("span"))
      document.appendChild(container)
      container.append(...children)
      container.setAttribute(
        "style",
        direction === "row"
          ? "display:flex; width:90px; height:100px; flex-wrap:wrap; align-content:stretch; align-items:stretch; gap:10px"
          : "display:flex; width:100px; height:90px; flex-direction:column; flex-wrap:wrap; align-content:stretch; align-items:stretch; gap:10px",
      )
      for (const child of children) {
        child.setAttribute(
          "style",
          direction === "row" ? "flex:none; width:40px" : "flex:none; height:40px",
        )
      }
      children[0]!.setAttribute(
        "style",
        direction === "row"
          ? "flex:none; width:40px; height:10px"
          : "flex:none; width:10px; height:40px",
      )
      children[2]!.setAttribute(
        "style",
        direction === "row"
          ? "flex:none; width:40px; height:20px"
          : "flex:none; width:20px; height:40px",
      )

      const frame = createDocumentRenderer({
        document,
        root: container,
        viewport: {width: 100, height: 100},
      }).flush()
      const boxes = children.map((child) => frame.boxByNode.get(child)!)
      expectCloseArray(
        boxes.map((box) => direction === "row" ? box.y : box.x),
        [0, 0, 50, 50],
      )
      expectCloseArray(
        boxes.map((box) => direction === "row" ? box.height : box.width),
        [10, 40, 20, 50],
      )
    }
  })

  test("uses explicit negative-free fallbacks without collapsing natural lines", () => {
    const expectations: readonly (readonly [RenderAlignContent, readonly number[]])[] = [
      ["normal", [0, 0, 20]],
      ["stretch", [0, 0, 20]],
      ["flex-start", [0, 0, 20]],
      ["flex-end", [-15, -15, 5]],
      ["center", [-7.5, -7.5, 12.5]],
      ["space-between", [0, 0, 20]],
      ["space-around", [0, 0, 20]],
      ["space-evenly", [0, 0, 20]],
    ]

    for (const [alignContent, expected] of expectations) {
      const result = renderPackedLines("row", alignContent, {crossSize: 15})
      expectCloseArray(result.childCrossPositions, expected)
    }
  })

  test("reverses align-content and align-items cross-start for wrap-reverse", () => {
    for (const direction of ["row", "column"] as const) {
      expectCloseArray(
        renderPackedLines(direction, "flex-start", {wrap: "wrap-reverse"})
          .childCrossPositions,
        [90, 90, 70],
      )
      expectCloseArray(
        renderPackedLines(direction, "flex-end", {wrap: "wrap-reverse"})
          .childCrossPositions,
        [20, 20, 0],
      )
      expectCloseArray(
        renderPackedLines(direction, "space-between", {wrap: "wrap-reverse"})
          .childCrossPositions,
        [90, 90, 0],
      )

      expectCloseArray(
        renderPackedLines(direction, "normal", {
          alignItems: "flex-start",
          childCount: 1,
          wrap: "wrap-reverse",
        }).childCrossPositions,
        [90],
      )
      expectCloseArray(
        renderPackedLines(direction, "normal", {
          alignItems: "flex-end",
          childCount: 1,
          wrap: "wrap-reverse",
        }).childCrossPositions,
        [0],
      )
    }
  })
})
