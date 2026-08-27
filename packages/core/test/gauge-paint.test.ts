import {describe, expect, test} from "bun:test"
import {
  createDocument,
  type HTMLMeterElement,
  type HTMLProgressElement,
} from "@zavx0z/dom"
import {
  createDocumentRenderer,
  type RectDisplayItem,
  type RenderFrame,
} from "../src/index.ts"

describe("progress replaced-control paint", () => {
  test("maps normalized determinate position into stable track/value geometry", () => {
    const document = createDocument()
    const progress = document.createElement("progress")
    const fallback = document.createTextNode("50 percent")
    progress.appendChild(fallback)
    progress.max = 4
    progress.value = 2
    document.appendChild(progress)
    const renderer = createDocumentRenderer({
      document,
      root: progress,
      viewport: {width: 200, height: 40},
    })
    const frame = renderer.flush()
    const [track, value] = gaugePaint(frame, progress)

    expect(progress.position).toBe(0.5)
    expect(frame.boxByNode.get(progress)).toMatchObject({
      width: 160,
      height: 16,
      contentX: 3,
      contentY: 3,
      contentWidth: 154,
      contentHeight: 10,
    })
    expect(frame.displayList.filter(({node}) => node === progress).map(({key}) => key)).toEqual([
      "background",
      "track",
      "value",
    ])
    expect(track).toMatchObject({
      node: progress,
      key: "track",
      x: 3,
      y: 3,
      width: 154,
      height: 10,
      color: "#d1d5db",
    })
    expect(value).toMatchObject({
      node: progress,
      key: "value",
      x: 3,
      y: 3,
      width: 77,
      height: 10,
      color: "#2563eb",
    })
    expect(track.clips).toBe(value.clips)
    expect(track.clips).toHaveLength(1)
    expect(frame.boxByNode.has(fallback)).toBeFalse()
    expect(frame.displayList.some(({node}) => node === fallback)).toBeFalse()
    expect(frame.hits.get(progress)).toMatchObject({
      role: "progressbar",
      interactive: false,
    })
    renderer.dispose()
  })

  test("distinguishes indeterminate from determinate zero without changing composite keys", () => {
    const document = createDocument()
    const progress = document.createElement("progress")
    document.appendChild(progress)
    const events: string[] = []
    progress.addEventListener("input", ({type}) => events.push(type))
    progress.addEventListener("change", ({type}) => events.push(type))
    const renderer = createDocumentRenderer({
      document,
      root: progress,
      viewport: {width: 200, height: 40},
    })
    const indeterminate = renderer.flush()
    const [firstTrack, indeterminateValue] = gaugePaint(indeterminate, progress)

    expect(progress.position).toBe(-1)
    expect(indeterminateValue).toMatchObject({
      width: 51.333333333333336,
      color: "#60a5fa",
    })
    expect(indeterminateValue.x).toBeCloseTo(54.333333333333336)

    progress.value = progress.value
    const determinate = renderer.flush()
    const [secondTrack, determinateValue] = gaugePaint(determinate, progress)
    expect(progress.position).toBe(0)
    expect(determinateValue).toMatchObject({x: 3, width: 0, color: "#2563eb"})
    expect(secondTrack).toMatchObject({
      node: firstTrack.node,
      key: firstTrack.key,
      x: firstTrack.x,
      width: firstTrack.width,
    })
    expect(determinateValue.node).toBe(indeterminateValue.node)
    expect(determinateValue.key).toBe(indeterminateValue.key)
    expect(events).toEqual([])

    progress.removeAttribute("value")
    const restored = renderer.flush()
    expect(gaugePaint(restored, progress)[1]).toMatchObject({
      x: indeterminateValue.x,
      width: indeterminateValue.width,
      color: indeterminateValue.color,
    })
    expect(renderer.flush()).toBe(restored)
    expect(events).toEqual([])
    renderer.dispose()
  })
})

describe("meter replaced-control paint", () => {
  test("uses normalized range geometry and standard optimum-region tones", () => {
    const document = createDocument()
    const meter = document.createElement("meter")
    meter.min = 0
    meter.max = 100
    meter.low = 20
    meter.high = 80
    meter.optimum = 90
    meter.value = 75
    document.appendChild(meter)
    const renderer = createDocumentRenderer({
      document,
      root: meter,
      viewport: {width: 200, height: 40},
    })
    const first = renderer.flush()
    const [firstTrack, firstValue] = gaugePaint(first, meter)

    expect(firstValue).toMatchObject({width: 115.5, color: "#d97706"})
    expect(frameRole(first, meter)).toMatchObject({role: "meter", interactive: false})

    meter.optimum = 50
    const optimumMiddle = renderer.flush()
    const middleValue = gaugePaint(optimumMiddle, meter)[1]
    expect(middleValue).toMatchObject({
      node: firstValue.node,
      key: firstValue.key,
      width: firstValue.width,
      color: "#16a34a",
    })
    expect(gaugePaint(optimumMiddle, meter)[0]).toMatchObject({
      node: firstTrack.node,
      key: firstTrack.key,
      width: firstTrack.width,
    })

    meter.value = 10
    meter.optimum = 90
    expect(gaugePaint(renderer.flush(), meter)[1]).toMatchObject({width: 15.4, color: "#dc2626"})

    meter.optimum = 10
    expect(gaugePaint(renderer.flush(), meter)[1].color).toBe("#16a34a")
    meter.value = 50
    expect(gaugePaint(renderer.flush(), meter)[1].color).toBe("#d97706")
    meter.value = 90
    expect(gaugePaint(renderer.flush(), meter)[1].color).toBe("#dc2626")
    renderer.dispose()
  })

  test("keeps degenerate normalized range finite and value geometry empty", () => {
    const document = createDocument()
    const meter = document.createElement("meter")
    meter.min = 10
    meter.max = 5
    meter.value = 20
    document.appendChild(meter)
    const renderer = createDocumentRenderer({
      document,
      root: meter,
      viewport: {width: 200, height: 40},
    })
    const value = gaugePaint(renderer.flush(), meter)[1]

    expect(meter.min).toBe(10)
    expect(meter.max).toBe(10)
    expect(meter.value).toBe(10)
    expect(value).toMatchObject({x: 3, width: 0})
    expect(Number.isFinite(value.width)).toBeTrue()
    renderer.dispose()
  })

  test("derives inner gauge from author CSS while keeping fallback children unpainted", () => {
    const document = createDocument()
    const meter = document.createElement("meter")
    const fallback = document.createTextNode("half")
    meter.appendChild(fallback)
    meter.min = 0
    meter.max = 10
    meter.value = 5
    meter.setAttribute(
      "style",
      "box-sizing:border-box; width:220px; height:24px; padding:3px 5px; border:2px solid #123456; background:#abcdef",
    )
    document.appendChild(meter)
    const renderer = createDocumentRenderer({
      document,
      root: meter,
      viewport: {width: 260, height: 60},
    })
    const frame = renderer.flush()
    const outer = rect(frame, meter, "background")
    const [track, value] = gaugePaint(frame, meter)

    expect(frame.boxByNode.get(meter)).toMatchObject({
      width: 220,
      height: 24,
      contentX: 7,
      contentY: 5,
      contentWidth: 206,
      contentHeight: 14,
    })
    expect(outer).toMatchObject({width: 220, height: 24, color: "#abcdef"})
    expect(outer.border).toMatchObject({
      widths: {top: 2, right: 2, bottom: 2, left: 2},
      colors: {top: "#123456", right: "#123456", bottom: "#123456", left: "#123456"},
    })
    expect(track).toMatchObject({x: 7, y: 5, width: 206, height: 14})
    expect(value).toMatchObject({x: 7, y: 5, width: 103, height: 14})
    expect(frame.boxByNode.has(fallback)).toBeFalse()
    expect(frame.displayList.some(({node}) => node === fallback)).toBeFalse()
    renderer.dispose()
  })
})

type Gauge = HTMLProgressElement | HTMLMeterElement

function gaugePaint(frame: RenderFrame, gauge: Gauge): readonly [RectDisplayItem, RectDisplayItem] {
  return [rect(frame, gauge, "track"), rect(frame, gauge, "value")]
}

function rect(frame: RenderFrame, gauge: Gauge, key: string): RectDisplayItem {
  const item = frame.displayList.find((candidate): candidate is RectDisplayItem =>
    candidate.kind === "rect" && candidate.node === gauge && candidate.key === key
  )
  if (!item) throw new Error(`Expected gauge ${key}`)
  return item
}

function frameRole(frame: RenderFrame, gauge: Gauge) {
  const hit = frame.hits.get(gauge)
  if (!hit) throw new Error("Expected gauge hit metadata")
  return hit
}
