import {describe, expect, test} from "bun:test"
import {
  getPopoverVisibilityState,
  createDocument,
  type Element,
} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  hitTest,
  type RectDisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("popover top-layer projection", () => {
  test("removes hidden popovers from flow and centers showing author boxes", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const before = block(document, "#111111", 20)
    const popover = document.createElement("div")
    const content = block(document, "#ff8800", 20)
    const after = block(document, "#222222", 20)
    document.appendChild(root)
    root.append(before, popover, after)
    popover.appendChild(content)
    root.setAttribute("style", "width:300px")
    popover.popover = "manual"
    popover.setAttribute(
      "style",
      "box-sizing:border-box; width:100px; height:40px; border:2px solid #550000; padding:4px; background:#ff0000",
    )
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 300, height: 200},
    })
    const hidden = renderer.flush()

    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    expect(hidden.boxByNode.has(popover)).toBeFalse()
    expect(hidden.boxByNode.has(content)).toBeFalse()
    expect(hidden.hits.has(popover)).toBeFalse()
    expect(hidden.displayList.some(({node}) => node === popover || node === content)).toBeFalse()
    expect(hidden.boxByNode.get(after)).toMatchObject({y: 20})

    popover.showPopover()
    const showing = renderer.flush()
    const popoverBox = showing.boxByNode.get(popover)
    expect(popover[getPopoverVisibilityState]()).toBe("showing")
    expect(popoverBox).toMatchObject({
      node: popover,
      parent: null,
      x: 100,
      y: 80,
      width: 100,
      height: 40,
      contentX: 106,
      contentY: 86,
    })
    expect(showing.boxByNode.get(after)).toMatchObject({y: 20})
    expect(showing.boxByNode.get(content)).toMatchObject({x: 106, y: 86})
    expect(paintIndex(showing, popover)).toBeGreaterThan(paintIndex(showing, after))
    expect(showing.hits.has(popover)).toBeTrue()
    expect(document.activeElement).toBeNull()
    expect(renderer.flush()).toBe(showing)

    popover.hidePopover()
    const closed = renderer.flush()
    expect(closed.boxByNode.has(popover)).toBeFalse()
    expect(closed.boxByNode.get(after)).toMatchObject({y: 20})
    renderer.dispose()
  })

  test("keeps a canceled beforetoggle as an exact clean renderer frame", () => {
    const document = createDocument()
    const popover = document.createElement("div")
    popover.popover = "manual"
    popover.setAttribute("style", "width:80px; height:30px; background:#ff0000")
    document.appendChild(popover)
    const renderer = createDocumentRenderer({
      document,
      root: popover,
      viewport: {width: 200, height: 100},
    })
    const hidden = renderer.flush()
    const events: string[] = []
    popover.addEventListener("beforetoggle", (event) => {
      events.push(event.type)
      event.preventDefault()
    })
    popover.addEventListener("toggle", ({type}) => events.push(type))

    popover.showPopover()

    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    expect(renderer.flush()).toBe(hidden)
    expect(events).toEqual(["beforetoggle"])
    renderer.dispose()
  })

  test("escapes ancestor overflow clips and stacks atomic nested content after the document", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const clipped = document.createElement("div")
    const underlay = document.createElement("button")
    const popover = document.createElement("div")
    const child = document.createElement("button")
    document.appendChild(root)
    root.append(clipped, underlay)
    clipped.appendChild(popover)
    popover.appendChild(child)
    root.setAttribute("style", "width:200px; height:100px")
    clipped.setAttribute(
      "style",
      "width:50px; height:50px; overflow:hidden; background:#111111",
    )
    underlay.setAttribute(
      "style",
      "box-sizing:border-box; width:200px; height:100px; margin-top:-50px; padding:0; border:0; background:#0000ff",
    )
    popover.popover = "manual"
    popover.setAttribute(
      "style",
      "box-sizing:border-box; width:100px; height:60px; padding:0; border:0; background:#ff0000",
    )
    child.setAttribute(
      "style",
      "box-sizing:border-box; width:100px; height:60px; padding:0; border:0; background:#00ff00",
    )
    popover.showPopover()
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 200, height: 100},
    })
    const frame = renderer.flush()
    const popoverPaint = rect(frame, popover)
    const childPaint = rect(frame, child)

    expect(frame.boxByNode.get(popover)).toMatchObject({x: 50, y: 20, width: 100, height: 60})
    expect(popoverPaint.clips).toEqual([])
    expect(childPaint.clips).toEqual([])
    expect(paintIndex(frame, popover)).toBeGreaterThan(paintIndex(frame, underlay))
    expect(paintIndex(frame, child)).toBeGreaterThan(paintIndex(frame, popover))
    expect(hitTest(frame, 120, 30)?.node).toBe(child)
    expect([...frame.hits.values()].at(-1)?.node).toBe(child)
    renderer.dispose()
  })

  test("reflects DOM auto peer closure while preserving showing manual peers", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = popover(document, "auto", "#ff0000")
    const second = popover(document, "auto", "#00ff00")
    const manual = popover(document, "manual", "#0000ff")
    document.appendChild(root)
    root.append(first, second, manual)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 200, height: 100},
    })

    first.showPopover()
    manual.showPopover()
    const firstFrame = renderer.flush()
    expect(firstFrame.boxByNode.has(first)).toBeTrue()
    expect(firstFrame.boxByNode.has(manual)).toBeTrue()
    expect(firstFrame.boxByNode.has(second)).toBeFalse()

    second.showPopover()
    const secondFrame = renderer.flush()
    expect(first[getPopoverVisibilityState]()).toBe("hidden")
    expect(second[getPopoverVisibilityState]()).toBe("showing")
    expect(manual[getPopoverVisibilityState]()).toBe("showing")
    expect(secondFrame.boxByNode.has(first)).toBeFalse()
    expect(secondFrame.boxByNode.has(second)).toBeTrue()
    expect(secondFrame.boxByNode.has(manual)).toBeTrue()
    expect(paintIndex(secondFrame, manual)).toBeGreaterThan(paintIndex(secondFrame, second))

    manual.hidePopover()
    const onlySecond = renderer.flush()
    expect(hitTest(onlySecond, 80, 40)?.node).toBe(second)
    renderer.dispose()
  })
})

function block(
  document: ReturnType<typeof createDocument>,
  color: string,
  height: number,
): Element {
  const element = document.createElement("div")
  element.setAttribute("style", `width:100%; height:${height}px; background:${color}`)
  return element
}

function popover(
  document: ReturnType<typeof createDocument>,
  mode: "auto" | "manual",
  color: string,
) {
  const element = document.createElement("div")
  element.popover = mode
  element.setAttribute("style", `width:80px; height:40px; background:${color}`)
  return element
}

function rect(frame: RenderFrame, node: Element): RectDisplayItem {
  const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
    candidate.kind === "rect" && candidate.node === node && candidate.key === "background"
  )
  if (!item) throw new Error("Expected background paint")
  return item
}

function paintIndex(frame: RenderFrame, node: Element): number {
  return frame.displayList.findIndex((item) =>
    item.kind === "rect" && item.node === node && item.key === "background"
  )
}
