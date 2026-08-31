import {describe, expect, test} from "bun:test"
import {createDocument, type HTMLInputElement} from "@zavx0z/dom"
import {
  createDocumentInteractionController,
  createDocumentRenderer,
  type RectDisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("range input replaced-control paint", () => {
  test("uses the DOM default midpoint and deterministic horizontal UA geometry", () => {
    const {input, frame} = renderRange()
    const [track, thumb] = rangePaint(frame, input)

    expect(input.value).toBe("50")
    expect(input.valueAsNumber).toBe(50)
    expect(frame.boxByNode.get(input)).toMatchObject({
      x: 0,
      y: 0,
      width: 160,
      height: 22,
      contentX: 7,
      contentY: 3,
      contentWidth: 146,
      contentHeight: 16,
    })
    expect(track).toMatchObject({
      kind: "rect",
      key: "track",
      node: input,
      x: 13,
      y: 9,
      width: 134,
      height: 4,
      color: "#d1d5db",
      opacity: 1,
    })
    expect(track.border.radii).toEqual({
      topLeft: 2,
      topRight: 2,
      bottomRight: 2,
      bottomLeft: 2,
    })
    expect(thumb).toMatchObject({
      kind: "rect",
      key: "thumb",
      node: input,
      x: 74,
      y: 5,
      width: 12,
      height: 12,
      color: "#2563eb",
      opacity: 1,
    })
    expect(thumb.border.radii).toEqual({
      topLeft: 6,
      topRight: 6,
      bottomRight: 6,
      bottomLeft: 6,
    })
    expect(track.clips).toBe(thumb.clips)
    expect(track.clips).toHaveLength(1)
    expect(Object.isFrozen(track)).toBeTrue()
    expect(Object.isFrozen(thumb)).toBeTrue()
    expect(frame.displayList.some((item) => item.node === input && item.kind === "text")).toBeFalse()
  })

  test("places clamped custom min and max values at the travel endpoints", () => {
    const document = createDocument()
    const input = range(document)
    input.min = "10"
    input.max = "20"
    input.step = "any"
    input.valueAsNumber = -100
    document.appendChild(input)
    const renderer = createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 200, height: 40},
    })

    const minimum = renderer.flush()
    expect(input.valueAsNumber).toBe(10)
    expect(rangePaint(minimum, input)[1].x).toBe(7)

    input.valueAsNumber = 100
    const maximum = renderer.flush()
    expect(input.valueAsNumber).toBe(20)
    expect(rangePaint(maximum, input)[1].x).toBe(141)
    renderer.dispose()
  })

  test("uses the DOM step-rounded live value and preserves composite identities", () => {
    const document = createDocument()
    const input = range(document)
    input.min = "10"
    input.max = "20"
    input.step = "4"
    input.valueAsNumber = 16
    document.appendChild(input)
    const renderer = createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 200, height: 40},
    })
    const first = renderer.flush()
    const [firstTrack, firstThumb] = rangePaint(first, input)

    expect(input.valueAsNumber).toBe(18)
    expect(firstThumb.x).toBeCloseTo(114.2)
    input.valueAsNumber = 10
    const second = renderer.flush()
    const [secondTrack, secondThumb] = rangePaint(second, input)

    expect(second.revision).toBe(first.revision + 1)
    expect(secondTrack.node).toBe(firstTrack.node)
    expect(secondTrack.key).toBe(firstTrack.key)
    expect(secondThumb.node).toBe(firstThumb.node)
    expect(secondThumb.key).toBe(firstThumb.key)
    expect(secondTrack).toMatchObject({x: firstTrack.x, y: firstTrack.y, width: firstTrack.width})
    expect(secondThumb.x).toBe(7)
    expect(renderer.flush()).toBe(second)
    renderer.dispose()
  })

  test("keeps disabled paint while hit metadata becomes non-interactive", () => {
    const document = createDocument()
    const input = range(document)
    input.disabled = true
    document.appendChild(input)
    const renderer = createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 200, height: 40},
    })
    const frame = renderer.flush()
    const [track, thumb] = rangePaint(frame, input)

    expect(track.opacity).toBe(0.5)
    expect(thumb.opacity).toBe(0.5)
    expect(frame.hits.get(input)).toMatchObject({
      node: input,
      role: "slider",
      disabled: true,
      interactive: false,
    })
    renderer.dispose()
  })

  test("derives inner paint from the author-sized content box without replacing outer CSS", () => {
    const document = createDocument()
    const input = range(document)
    input.setAttribute(
      "style",
      "box-sizing: border-box; width: 200px; height: 30px; padding: 4px 10px; border: 2px solid #123456; background: #abcdef",
    )
    document.appendChild(input)
    const renderer = createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 240, height: 60},
    })
    const frame = renderer.flush()
    const outer = rect(frame, input, "background")
    const [track, thumb] = rangePaint(frame, input)

    expect(frame.boxByNode.get(input)).toMatchObject({
      width: 200,
      height: 30,
      contentX: 12,
      contentY: 6,
      contentWidth: 176,
      contentHeight: 18,
    })
    expect(outer).toMatchObject({
      x: 0,
      y: 0,
      width: 200,
      height: 30,
      color: "#abcdef",
    })
    expect(outer.border).toMatchObject({
      widths: {top: 2, right: 2, bottom: 2, left: 2},
      colors: {top: "#123456", right: "#123456", bottom: "#123456", left: "#123456"},
    })
    expect(track).toMatchObject({x: 18, y: 13, width: 164, height: 4, color: "#d1d5db"})
    expect(thumb).toMatchObject({x: 94, y: 9, width: 12, height: 12, color: "#2563eb"})
    renderer.dispose()
  })

  test("runs pointer drag default actions through DOM value semantics and input/change", () => {
    const document = createDocument()
    const input = range(document)
    input.min = "10"
    input.max = "20"
    input.step = "2"
    input.setAttribute("style", "width:200px; height:30px")
    document.appendChild(input)
    const renderer = createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 240, height: 60},
    })
    const interaction = createDocumentInteractionController({document})
    const initial = renderer.flush()
    const track = rangePaint(initial, input)[0]
    const events: string[] = []
    input.addEventListener("input", () => events.push(`input:${input.value}`))
    input.addEventListener("change", () => events.push(`change:${input.value}`))

    interaction.pointerDown(initial, {
      clientX: track.x,
      clientY: track.y + track.height / 2,
      pointerId: 4,
      buttons: 1,
    })
    expect(input.valueAsNumber).toBe(10)
    interaction.pointerMove(initial, {
      clientX: track.x + track.width + 100,
      clientY: track.y + track.height / 2,
      pointerId: 4,
      buttons: 1,
    })
    expect(input.valueAsNumber).toBe(20)
    interaction.pointerUp(initial, {
      clientX: track.x + track.width + 100,
      clientY: track.y + track.height / 2,
      pointerId: 4,
    })

    expect(events).toEqual(["input:10", "input:20", "change:20"])
    expect(rangePaint(renderer.flush(), input)[1].x).toBe(track.x + track.width - 6)
    interaction.dispose()
    renderer.dispose()
  })
})

function renderRange(): Readonly<{input: HTMLInputElement; frame: RenderFrame}> {
  const document = createDocument()
  const input = range(document)
  document.appendChild(input)
  return {
    input,
    frame: createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 200, height: 40},
    }).flush(),
  }
}

function range(document: ReturnType<typeof createDocument>): HTMLInputElement {
  const input = document.createElement("input")
  input.type = "range"
  return input
}

function rangePaint(
  frame: RenderFrame,
  input: HTMLInputElement,
): readonly [RectDisplayItem, RectDisplayItem] {
  return [rect(frame, input, "track"), rect(frame, input, "thumb")]
}

function rect(
  frame: RenderFrame,
  input: HTMLInputElement,
  key: string,
): RectDisplayItem {
  const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
    candidate.kind === "rect" && candidate.node === input && candidate.key === key
  )
  if (!item) throw new Error(`Expected range ${key}`)
  return item
}
