import {describe, expect, it} from "bun:test"
import type {
  MutationBatch,
  StateChangeBatch
} from "../src/index.ts"
import {
  HTMLElement,
  HTMLMeterElement,
  HTMLProgressElement,
  createDocument
} from "../src/index.ts"

describe("HTMLProgressElement", () => {
  it("uses exact factory identity and determinate/indeterminate defaults", () => {
    const progress = createDocument().createElement("progress")
    expect(progress).toBeInstanceOf(HTMLProgressElement)
    expect(progress).toBeInstanceOf(HTMLElement)
    expect(progress.max).toBe(1)
    expect(progress.value).toBe(0)
    expect(progress.position).toBe(-1)
    expect(progress.hasAttribute("value")).toBe(false)

    progress.value = progress.value
    expect(progress.getAttribute("value")).toBe("0")
    expect(progress.position).toBe(0)
    progress.removeAttribute("value")
    expect(progress.position).toBe(-1)
  })

  it("normalizes parsed values while keeping setter attributes explicit", () => {
    const progress = createDocument().createElement("progress")
    progress.max = 4
    progress.value = 2
    expect(progress.getAttribute("max")).toBe("4")
    expect(progress.getAttribute("value")).toBe("2")
    expect(progress.max).toBe(4)
    expect(progress.value).toBe(2)
    expect(progress.position).toBe(0.5)

    progress.value = 10
    expect(progress.getAttribute("value")).toBe("10")
    expect(progress.value).toBe(4)
    expect(progress.position).toBe(1)
    progress.value = -2
    expect(progress.getAttribute("value")).toBe("-2")
    expect(progress.value).toBe(0)

    progress.setAttribute("max", "0")
    expect(progress.max).toBe(1)
    progress.setAttribute("value", "bad")
    expect(progress.value).toBe(0)
    expect(progress.position).toBe(0)
    progress.setAttribute("max", " +2.5 trailing")
    progress.setAttribute("value", " 1.25 trailing")
    expect(progress.max).toBe(2.5)
    expect(progress.value).toBe(1.25)
    expect(progress.position).toBe(0.5)
  })

  it("rejects non-finite reflected setters", () => {
    const progress = createDocument().createElement("progress")
    expect(() => {
      progress.value = Number.NaN
    }).toThrow(TypeError)
    expect(() => {
      progress.max = Number.POSITIVE_INFINITY
    }).toThrow(TypeError)
    expect(progress.hasAttribute("value")).toBe(false)
    expect(progress.hasAttribute("max")).toBe(false)
  })
})

describe("HTMLMeterElement", () => {
  it("uses exact factory identity and standard normalized defaults", () => {
    const meter = createDocument().createElement("meter")
    expect(meter).toBeInstanceOf(HTMLMeterElement)
    expect(meter).toBeInstanceOf(HTMLElement)
    expect(meter.min).toBe(0)
    expect(meter.max).toBe(1)
    expect(meter.value).toBe(0)
    expect(meter.low).toBe(0)
    expect(meter.high).toBe(1)
    expect(meter.optimum).toBe(0.5)
  })

  it("normalizes value and boundaries in the required dependency order", () => {
    const meter = createDocument().createElement("meter")
    meter.min = 0
    meter.max = 100
    meter.value = 75
    meter.low = 20
    meter.high = 80
    meter.optimum = 90
    expect(meter.value).toBe(75)
    expect(meter.low).toBe(20)
    expect(meter.high).toBe(80)
    expect(meter.optimum).toBe(90)

    meter.low = 120
    expect(meter.low).toBe(100)
    meter.high = -20
    expect(meter.high).toBe(100)
    meter.optimum = -10
    expect(meter.optimum).toBe(0)
    meter.value = 200
    expect(meter.getAttribute("value")).toBe("200")
    expect(meter.value).toBe(100)

    meter.min = 10
    meter.max = 5
    expect(meter.min).toBe(10)
    expect(meter.max).toBe(10)
    expect(meter.value).toBe(10)
    expect(meter.low).toBe(10)
    expect(meter.high).toBe(10)
    expect(meter.optimum).toBe(10)
  })

  it("uses parsed fallbacks and rejects non-finite setters", () => {
    const meter = createDocument().createElement("meter")
    meter.setAttribute("min", "invalid")
    meter.setAttribute("max", " +8 trailing")
    meter.setAttribute("value", " 6.5 trailing")
    meter.setAttribute("low", "invalid")
    meter.setAttribute("high", "invalid")
    meter.setAttribute("optimum", "invalid")
    expect(meter.min).toBe(0)
    expect(meter.max).toBe(8)
    expect(meter.value).toBe(6.5)
    expect(meter.low).toBe(0)
    expect(meter.high).toBe(8)
    expect(meter.optimum).toBe(4)

    expect(() => {
      meter.value = Number.NEGATIVE_INFINITY
    }).toThrow(TypeError)
    expect(() => {
      meter.optimum = Number.NaN
    }).toThrow(TypeError)
  })
})

describe("progress and meter channel boundaries", () => {
  it("publishes attributes only and fabricates no state or events", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const progress = document.createElement("progress")
    const meter = document.createElement("meter")
    const mutations: MutationBatch[] = []
    const states: StateChangeBatch[] = []
    const events: string[] = []
    root.append(progress, meter)
    document.append(root)
    document.subscribeMutations(batch => mutations.push(batch))
    document.subscribeStateChanges(batch => states.push(batch))
    for (const element of [progress, meter]) {
      element.addEventListener("input", event => events.push(event.type))
      element.addEventListener("change", event => events.push(event.type))
    }

    progress.max = 10
    progress.value = 4
    meter.min = 0
    meter.max = 10
    meter.value = 6
    expect(mutations).toHaveLength(5)
    expect(mutations.every(batch => batch.records[0]?.type === "attributes")).toBe(true)
    expect(states).toEqual([])
    expect(events).toEqual([])
  })
})
