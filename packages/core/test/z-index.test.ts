import {describe, expect, test} from "bun:test"
import {createDocument, type Element} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  hitTest,
  type RenderFrame,
} from "../src/index.ts"

describe("flex item z-index stacking", () => {
  test("paints and hit-tests higher integer z-index later without changing layout order", () => {
    const fixture = overlappingFlex()
    fixture.first.setAttribute("style", `${itemStyle("#ff0000")}; z-index:2`)
    fixture.second.setAttribute(
      "style",
      `${itemStyle("#0000ff")}; left:0; top:0; z-index:1; position:absolute`,
    )
    const renderer = fixture.renderer()
    const frame = renderer.flush()

    expect(paintOrder(frame, fixture.first, fixture.second)).toEqual([
      fixture.second,
      fixture.first,
    ])
    expect(hitOrder(frame, fixture.first, fixture.second)).toEqual([
      fixture.second,
      fixture.first,
    ])
    expect(hitTest(frame, 10, 10)?.node).toBe(fixture.first)
    const firstBoxIndex = frame.boxes.findIndex(({node}) => node === fixture.first)
    const secondBoxIndex = frame.boxes.findIndex(({node}) => node === fixture.second)
    expect(firstBoxIndex).toBeLessThan(secondBoxIndex)
    expect(frame.boxByNode.get(fixture.first)).toMatchObject({x: 0, y: 0, width: 100})
    expect(frame.boxByNode.get(fixture.second)).toMatchObject({x: 0, y: 0, width: 100})
    expect(renderer.flush()).toBe(frame)
    renderer.dispose()
  })

  test("treats auto as zero and preserves tree order for equal levels", () => {
    const auto = overlappingFlex()
    auto.second.setAttribute("style", `${itemStyle("#0000ff")}; margin-left:-100px`)
    const autoRenderer = auto.renderer()
    const autoFrame = autoRenderer.flush()
    expect(paintOrder(autoFrame, auto.first, auto.second)).toEqual([auto.first, auto.second])
    expect(hitTest(autoFrame, 10, 10)?.node).toBe(auto.second)
    autoRenderer.dispose()

    const equal = overlappingFlex()
    equal.first.setAttribute("style", `${itemStyle("#ff0000")}; z-index:3`)
    equal.second.setAttribute("style", `${itemStyle("#0000ff")}; margin-left:-100px; z-index:3`)
    const equalRenderer = equal.renderer()
    expect(paintOrder(equalRenderer.flush(), equal.first, equal.second)).toEqual([
      equal.first,
      equal.second,
    ])
    equalRenderer.dispose()

    const negative = overlappingFlex()
    negative.second.setAttribute("style", `${itemStyle("#0000ff")}; margin-left:-100px; z-index:-1`)
    const negativeRenderer = negative.renderer()
    const negativeFrame = negativeRenderer.flush()
    expect(paintOrder(negativeFrame, negative.first, negative.second)).toEqual([
      negative.second,
      negative.first,
    ])
    expect(hitTest(negativeFrame, 10, 10)?.node).toBe(negative.first)
    negativeRenderer.dispose()
  })

  test("ignores an invalid higher-priority value and keeps the valid cascade integer", () => {
    const fixture = overlappingFlex()
    fixture.first.id = "first"
    fixture.second.id = "second"
    fixture.first.setAttribute("style", `${itemStyle("#ff0000")}; z-index:1.5`)
    fixture.second.setAttribute("style", `${itemStyle("#0000ff")}; margin-left:-100px`)
    const renderer = fixture.renderer([
      "#first { z-index: +5; } #second { z-index: 4; }",
    ])
    const frame = renderer.flush()

    expect(paintOrder(frame, fixture.first, fixture.second)).toEqual([
      fixture.second,
      fixture.first,
    ])
    expect(hitTest(frame, 10, 10)?.node).toBe(fixture.first)
    renderer.dispose()
  })

  test("ignores z-index on static block siblings while positioned siblings participate", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = document.createElement("button")
    const second = document.createElement("button")
    document.appendChild(root)
    root.append(first, second)
    root.setAttribute("style", "display:block; width:100px; height:40px")
    first.setAttribute("style", `${itemStyle("#ff0000")}; z-index:10`)
    second.setAttribute(
      "style",
      `${itemStyle("#0000ff")}; margin-top:-40px; z-index:-1; position:relative`,
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 80},
    })
    const frame = renderer.flush()

    expect(paintOrder(frame, first, second)).toEqual([second, first])
    expect(hitTest(frame, 10, 10)?.node).toBe(first)
    renderer.dispose()
  })

  test("keeps nested flex stacking local and cannot leak a descendant level", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const lowerScope = document.createElement("div")
    const higherScope = document.createElement("div")
    const nestedHigh = document.createElement("button")
    const nestedLow = document.createElement("button")
    const higherChild = document.createElement("button")
    document.appendChild(root)
    root.append(lowerScope, higherScope)
    lowerScope.append(nestedHigh, nestedLow)
    higherScope.append(higherChild)
    root.setAttribute("style", "display:flex; width:100px; height:40px")
    lowerScope.setAttribute(
      "style",
      `${itemStyle("#220000")}; display:flex; z-index:0`,
    )
    higherScope.setAttribute(
      "style",
      `${itemStyle("#000022")}; margin-left:-100px; display:flex; z-index:1`,
    )
    nestedHigh.setAttribute("style", `${itemStyle("#ff0000")}; z-index:999`)
    nestedLow.setAttribute(
      "style",
      `${itemStyle("#aa0000")}; margin-left:-100px; z-index:0`,
    )
    higherChild.setAttribute("style", itemStyle("#0000ff"))
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 60},
    })
    const frame = renderer.flush()

    expect(paintOrder(
      frame,
      lowerScope,
      nestedLow,
      nestedHigh,
      higherScope,
      higherChild,
    )).toEqual([
      lowerScope,
      nestedLow,
      nestedHigh,
      higherScope,
      higherChild,
    ])
    expect(hitTest(frame, 10, 10)?.node).toBe(higherChild)
    renderer.dispose()
  })
})

function overlappingFlex() {
  const document = createDocument()
  const root = document.createElement("div")
  const first = document.createElement("button")
  const second = document.createElement("button")
  document.appendChild(root)
  root.append(first, second)
  root.setAttribute("style", "display:flex; width:100px; height:40px")
  first.setAttribute("style", itemStyle("#ff0000"))
  return {
    document,
    root,
    first,
    second,
    renderer: (styleSheets: readonly string[] = []) => createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 60},
      styleSheets,
    }),
  }
}

function itemStyle(color: string): string {
  return `box-sizing:border-box; flex:none; width:100px; height:40px; padding:0; border:0; background:${color}`
}

function paintOrder(frame: RenderFrame, ...nodes: readonly Element[]): readonly Element[] {
  const accepted = new Set(nodes)
  return frame.displayList.flatMap((item) =>
    item.kind === "rect" && item.key === "background" && accepted.has(item.node as Element)
      ? [item.node as Element]
      : []
  )
}

function hitOrder(frame: RenderFrame, ...nodes: readonly Element[]): readonly Element[] {
  const accepted = new Set(nodes)
  return [...frame.hits.values()].flatMap(({node}) => accepted.has(node) ? [node] : [])
}
