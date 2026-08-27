import {describe, expect, test} from "bun:test"
import {createDocument, type Element} from "@zavx0z/dom"
import {
  createDocumentInteractionController,
  createDocumentRenderer,
  type RectDisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("UA scrollbar paint", () => {
  test("emits stable auto vertical track/thumb and moves only thumb on wheel scroll", () => {
    const {document, owner, child} = verticalScroller()
    const renderer = createDocumentRenderer({
      document,
      root: owner,
      viewport: {width: 120, height: 80},
    })
    const first = renderer.flush()
    const [firstTrack, firstThumb] = scrollbarAxis(first, owner, "y")

    expect(first.scrolls.get(owner)).toMatchObject({
      clientWidth: 100,
      clientHeight: 50,
      scrollHeight: 200,
      scrollTop: 0,
      maxScrollTop: 150,
    })
    expect(firstTrack).toMatchObject({
      key: "ua:scrollbar-y-track",
      node: owner,
      x: 90,
      y: 0,
      width: 10,
      height: 50,
      color: "#1f2937",
    })
    expect(firstThumb).toMatchObject({
      key: "ua:scrollbar-y-thumb",
      node: owner,
      x: 90,
      y: 0,
      width: 10,
      height: 20,
      color: "#9ca3af",
    })
    expect(firstTrack.clips).toEqual([])
    expect(firstThumb.clips).toBe(firstTrack.clips)
    expect(first.hits.has(owner)).toBeTrue()
    expect(first.hits.has(child)).toBeTrue()
    expect(first.hits.size).toBe(2)

    const interaction = createDocumentInteractionController({document})
    interaction.wheel(first, {clientX: 10, clientY: 10, deltaY: 75})
    const second = renderer.flush()
    const [secondTrack, secondThumb] = scrollbarAxis(second, owner, "y")

    expect(owner.scrollTop).toBe(75)
    expect(secondTrack).toMatchObject({
      node: firstTrack.node,
      key: firstTrack.key,
      x: firstTrack.x,
      y: firstTrack.y,
      width: firstTrack.width,
      height: firstTrack.height,
    })
    expect(secondThumb.node).toBe(firstThumb.node)
    expect(secondThumb.key).toBe(firstThumb.key)
    expect(secondThumb.y).toBe(15)
    expect(secondThumb.height).toBe(20)
    expect(renderer.flush()).toBe(second)
    interaction.dispose()
    renderer.dispose()
  })

  test("emits x and y chrome in owner-local overlay geometry without a corner overlap", () => {
    const document = createDocument()
    const owner = document.createElement("div")
    const child = document.createElement("div")
    document.appendChild(owner)
    owner.appendChild(child)
    owner.setAttribute(
      "style",
      "box-sizing:border-box; width:100px; height:50px; overflow:auto; background:#111111",
    )
    child.setAttribute("style", "width:300px; height:200px; background:#222222")
    const renderer = createDocumentRenderer({
      document,
      root: owner,
      viewport: {width: 140, height: 90},
    })
    const frame = renderer.flush()
    const items = scrollbars(frame, owner)

    expect(items.map(({key}) => key)).toEqual([
      "ua:scrollbar-y-track",
      "ua:scrollbar-y-thumb",
      "ua:scrollbar-x-track",
      "ua:scrollbar-x-thumb",
    ])
    expect(items[0]).toMatchObject({x: 90, y: 0, width: 10, height: 40})
    expect(items[1]).toMatchObject({x: 90, y: 0, width: 10, height: 20})
    expect(items[2]).toMatchObject({x: 0, y: 40, width: 90, height: 10})
    expect(items[3]).toMatchObject({x: 0, y: 40, width: 30, height: 10})

    owner.scrollLeft = 100
    const scrolled = renderer.flush()
    expect(scrollbar(scrolled, owner, "ua:scrollbar-x-track")).toMatchObject({x: 0, width: 90})
    expect(scrollbar(scrolled, owner, "ua:scrollbar-x-thumb")).toMatchObject({
      x: 30,
      width: 30,
    })
    renderer.dispose()
  })

  test("supports standard thin/none and ignores a nonstandard pixel override", () => {
    const thin = renderWidth("thin")
    expect(scrollbar(thin.frame, thin.owner, "ua:scrollbar-y-track")).toMatchObject({
      x: 96,
      width: 4,
    })
    expect(scrollbar(thin.frame, thin.owner, "ua:scrollbar-y-thumb")).toMatchObject({
      width: 4,
      height: 12.5,
    })

    const none = renderWidth("none")
    expect(none.frame.scrolls.get(none.owner)?.maxScrollTop).toBe(150)
    expect(scrollbars(none.frame, none.owner)).toEqual([])

    const document = createDocument()
    const owner = document.createElement("div")
    const child = document.createElement("div")
    document.appendChild(owner)
    owner.appendChild(child)
    owner.id = "owner"
    owner.setAttribute(
      "style",
      "box-sizing:border-box; width:100px; height:50px; overflow-y:auto; scrollbar-width:4px",
    )
    child.setAttribute("style", "height:200px")
    const renderer = createDocumentRenderer({
      document,
      root: owner,
      viewport: {width: 120, height: 80},
      styleSheets: ["#owner { scrollbar-width: thin; }"],
    })
    const frame = renderer.flush()
    expect(scrollbar(frame, owner, "ua:scrollbar-y-track").width).toBe(4)
    renderer.dispose()
  })

  test("does not paint hidden overflow and paints no chrome without remaining range", () => {
    const hidden = renderWidth("auto", "hidden")
    expect(hidden.frame.scrolls.get(hidden.owner)?.maxScrollTop).toBe(150)
    expect(scrollbars(hidden.frame, hidden.owner)).toEqual([])

    const document = createDocument()
    const owner = document.createElement("div")
    const child = document.createElement("div")
    document.appendChild(owner)
    owner.appendChild(child)
    owner.setAttribute("style", "width:100px; height:50px; overflow:scroll")
    child.setAttribute("style", "width:100px; height:50px")
    const renderer = createDocumentRenderer({
      document,
      root: owner,
      viewport: {width: 120, height: 80},
    })
    const frame = renderer.flush()
    expect(frame.scrolls.get(owner)).toMatchObject({maxScrollLeft: 0, maxScrollTop: 0})
    expect(scrollbars(frame, owner)).toEqual([])
    renderer.dispose()
  })

  test("keeps nested owner chrome outside its own clip while inheriting ancestor clips", () => {
    const document = createDocument()
    const outer = document.createElement("div")
    const inner = document.createElement("div")
    const content = document.createElement("div")
    document.appendChild(outer)
    outer.appendChild(inner)
    inner.appendChild(content)
    outer.setAttribute(
      "style",
      "width:80px; height:80px; overflow:hidden; scrollbar-width:thin; background:#111111",
    )
    inner.setAttribute(
      "style",
      "width:60px; height:60px; overflow-y:auto; background:#222222",
    )
    content.setAttribute("style", "width:60px; height:200px; background:#333333")
    inner.scrollTop = 30
    const renderer = createDocumentRenderer({
      document,
      root: outer,
      viewport: {width: 100, height: 100},
    })
    const frame = renderer.flush()
    const [track, thumb] = scrollbarAxis(frame, inner, "y")
    const contentPaint = frame.displayList.find((item) => item.node === content)

    expect(scrollbars(frame, outer)).toEqual([])
    expect(track).toMatchObject({x: 50, y: 0, width: 10, height: 60})
    expect(thumb.y).toBeCloseTo((track.height - thumb.height) * 30 / 140)
    expect(track.clips).toHaveLength(1)
    expect(thumb.clips).toBe(track.clips)
    expect(contentPaint?.clips).toHaveLength(2)
    expect(track.clips[0]).toBe(contentPaint?.clips[0])
    expect(track.clips).not.toContain(contentPaint?.clips[1])
    renderer.dispose()
  })
})

function verticalScroller() {
  const document = createDocument()
  const owner = document.createElement("div")
  const child = document.createElement("div")
  document.appendChild(owner)
  owner.appendChild(child)
  owner.setAttribute(
    "style",
    "box-sizing:border-box; width:100px; height:50px; overflow-y:auto; background:#111111",
  )
  child.setAttribute("style", "height:200px; background:#222222")
  return {document, owner, child}
}

function renderWidth(width: string, overflow = "auto") {
  const {document, owner} = verticalScroller()
  owner.setAttribute(
    "style",
    `box-sizing:border-box; width:100px; height:50px; overflow-y:${overflow}; scrollbar-width:${width}; background:#111111`,
  )
  const renderer = createDocumentRenderer({
    document,
    root: owner,
    viewport: {width: 120, height: 80},
  })
  return {owner, frame: renderer.flush()}
}

function scrollbarAxis(
  frame: RenderFrame,
  owner: Element,
  axis: "x" | "y",
): readonly [RectDisplayItem, RectDisplayItem] {
  return [
    scrollbar(frame, owner, `ua:scrollbar-${axis}-track`),
    scrollbar(frame, owner, `ua:scrollbar-${axis}-thumb`),
  ]
}

function scrollbars(frame: RenderFrame, owner: Element): readonly RectDisplayItem[] {
  return frame.displayList.filter((item): item is RectDisplayItem =>
    item.kind === "rect" &&
    item.node === owner &&
    item.key.startsWith("ua:scrollbar-")
  )
}

function scrollbar(frame: RenderFrame, owner: Element, key: string): RectDisplayItem {
  const item = scrollbars(frame, owner).find((candidate) => candidate.key === key)
  if (!item) throw new Error(`Expected ${key}`)
  return item
}
