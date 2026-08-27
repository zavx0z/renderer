import {describe, expect, it} from "bun:test"
import {createDocument, type Element, type Node} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  hitTest,
  type DisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("overflow clip projection", () => {
  it("keeps own paint uncut and applies hidden padding-box clips to descendants", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("div")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute(
      "style",
      "width:20px; height:20px; overflow:hidden; background:red",
    )
    child.setAttribute("style", "width:40px; height:40px; background:blue")

    const frame = render(document, root, 60, 60)
    const rootPaint = rect(frame, root)
    const childPaint = rect(frame, child)

    expect(rootPaint.clips).toEqual([])
    expect(childPaint.clips).toEqual([
      {
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        radii: ZERO_CLIP_RADII,
        clipX: true,
        clipY: true,
        transform: {scaleX: 1, scaleY: 1, translateX: 0, translateY: 0},
      },
    ])
    expect(frame.hits.get(root)?.clips).toEqual([])
    expect(frame.hits.get(child)?.clips).toBe(childPaint.clips)
    expect(hitTest(frame, 10, 10)?.node).toBe(child)
    expect(hitTest(frame, 30, 10)).toBeNull()
  })

  it("supports axis longhands and CSS visible/clip computed-axis rules", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("div")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute(
      "style",
      "width:20px; height:20px; overflow:clip visible",
    )
    child.setAttribute("style", "width:40px; height:40px")

    const frame = render(document, root, 60, 60)
    const clip = frame.hits.get(child)?.clips[0]

    expect(clip).toMatchObject({clipX: true, clipY: false})
    expect(hitTest(frame, 10, 30)?.node).toBe(child)
    expect(hitTest(frame, 30, 10)).toBeNull()

    root.setAttribute(
      "style",
      "width:20px; height:20px; overflow-x:hidden; overflow-y:visible",
    )
    const normalized = createDocumentRenderer({
      document,
      root,
      viewport: {width: 60, height: 60},
    }).flush()
    expect(normalized.hits.get(child)?.clips[0]).toMatchObject({
      clipX: true,
      clipY: true,
      transform: {scaleX: 1, scaleY: 1, translateX: 0, translateY: 0},
    })
  })

  it("derives normalized elliptical padding radii and uses them for hits", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("div")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute(
      "style",
      [
        "box-sizing:border-box",
        "width:40px",
        "height:40px",
        "border-width:2px 6px 4px 8px",
        "border-color:black",
        "border-radius:12px",
        "overflow:hidden",
        "background:red",
      ].join(";"),
    )
    child.setAttribute("style", "width:60px; height:60px; background:blue")

    const frame = render(document, root, 80, 80)
    const clip = rect(frame, child).clips[0]

    expect(clip).toEqual({
      x: 8,
      y: 2,
      width: 26,
      height: 34,
      radii: {
        topLeft: {x: 4, y: 10},
        topRight: {x: 6, y: 10},
        bottomRight: {x: 6, y: 8},
        bottomLeft: {x: 4, y: 8},
      },
      clipX: true,
      clipY: true,
      transform: {scaleX: 1, scaleY: 1, translateX: 0, translateY: 0},
    })
    expect(hitTest(frame, 8, 2)?.node).toBe(root)
    expect(hitTest(frame, 12, 12)?.node).toBe(child)
  })

  it("keeps nested auto/scroll clips as a logical stack intersection", () => {
    const document = createDocument()
    const outer = document.createElement("div")
    const inner = document.createElement("div")
    const grandchild = document.createElement("div")
    document.appendChild(outer)
    outer.appendChild(inner)
    inner.appendChild(grandchild)
    outer.setAttribute(
      "style",
      "width:50px; height:50px; overflow:auto; background:red",
    )
    inner.setAttribute(
      "style",
      "width:40px; height:40px; margin-left:20px; overflow:scroll; background:green",
    )
    grandchild.setAttribute(
      "style",
      "width:80px; height:20px; background:blue",
    )

    const frame = render(document, outer, 100, 80)
    const innerPaint = rect(frame, inner)
    const grandchildPaint = rect(frame, grandchild)

    expect(innerPaint.clips).toHaveLength(1)
    expect(grandchildPaint.clips).toHaveLength(2)
    expect(grandchildPaint.clips.map(({x, width}) => ({x, width}))).toEqual([
      {x: 0, width: 50},
      {x: 20, width: 40},
    ])
    expect(frame.hits.get(grandchild)?.clips).toBe(grandchildPaint.clips)
    expect(Object.isFrozen(grandchildPaint.clips)).toBe(true)
    expect(grandchildPaint.clips.every(Object.isFrozen)).toBe(true)
    expect(hitTest(frame, 45, 10)?.node).toBe(grandchild)
    expect(hitTest(frame, 55, 10)).toBeNull()
    expect(hitTest(frame, 15, 10)?.node).toBe(outer)
  })
})

const ZERO_CLIP_RADII = {
  topLeft: {x: 0, y: 0},
  topRight: {x: 0, y: 0},
  bottomRight: {x: 0, y: 0},
  bottomLeft: {x: 0, y: 0},
}

const render = (
  document: ReturnType<typeof createDocument>,
  root: Node,
  width: number,
  height: number,
): RenderFrame =>
  createDocumentRenderer({
    document,
    root,
    viewport: {width, height},
  }).flush()

const rect = (frame: RenderFrame, node: Element) => {
  const item = frame.displayList.find(
    (candidate): candidate is Extract<DisplayItem, {kind: "rect"}> =>
      candidate.kind === "rect" && candidate.node === node,
  )
  if (!item) throw new Error("Expected RectDisplayItem")
  return item
}
