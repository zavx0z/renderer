import {describe, expect, it} from "bun:test"
import {
  Event,
  MouseEvent,
  UIEvent,
  WheelEvent,
  createDocument
} from "../src/index.ts"

describe("WheelEvent", () => {
  it("uses the standard inheritance, defaults and delta constants", () => {
    const event = new WheelEvent("wheel")

    expect(event).toBeInstanceOf(WheelEvent)
    expect(event).toBeInstanceOf(MouseEvent)
    expect(event).toBeInstanceOf(UIEvent)
    expect(event).toBeInstanceOf(Event)
    expect(event.deltaX).toBe(0)
    expect(event.deltaY).toBe(0)
    expect(event.deltaZ).toBe(0)
    expect(event.deltaMode).toBe(WheelEvent.DOM_DELTA_PIXEL)
    expect(WheelEvent.DOM_DELTA_PIXEL).toBe(0)
    expect(WheelEvent.DOM_DELTA_LINE).toBe(1)
    expect(WheelEvent.DOM_DELTA_PAGE).toBe(2)
    expect(event.DOM_DELTA_PIXEL).toBe(0)
    expect(event.DOM_DELTA_LINE).toBe(1)
    expect(event.DOM_DELTA_PAGE).toBe(2)
  })

  it("preserves readonly wheel and inherited mouse initializer data", () => {
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: 12,
      clientY: 34,
      buttons: 1,
      ctrlKey: true,
      deltaX: -1.5,
      deltaY: 20.25,
      deltaZ: 3,
      deltaMode: WheelEvent.DOM_DELTA_LINE
    })

    expect(event.bubbles).toBe(true)
    expect(event.cancelable).toBe(true)
    expect(event.composed).toBe(true)
    expect(event.clientX).toBe(12)
    expect(event.clientY).toBe(34)
    expect(event.buttons).toBe(1)
    expect(event.ctrlKey).toBe(true)
    expect(event.deltaX).toBe(-1.5)
    expect(event.deltaY).toBe(20.25)
    expect(event.deltaZ).toBe(3)
    expect(event.deltaMode).toBe(WheelEvent.DOM_DELTA_LINE)
  })

  it("dispatches through capture and bubble without applying scrolling", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const target = document.createElement("div")
    const order: string[] = []
    document.append(root)
    root.append(target)
    target.scrollTop = 10

    root.addEventListener("wheel", () => order.push("capture"), {capture: true})
    target.addEventListener("wheel", event => {
      order.push(`target:${(event as WheelEvent).deltaY}`)
      event.preventDefault()
    })
    root.addEventListener("wheel", () => order.push("bubble"))

    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 5,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL
    })
    expect(target.dispatchEvent(event)).toBe(false)
    expect(order).toEqual(["capture", "target:5", "bubble"])
    expect(event.defaultPrevented).toBe(true)
    expect(target.scrollTop).toBe(10)

    target.dispatchEvent(new WheelEvent("wheel", {bubbles: true, deltaY: 50}))
    expect(target.scrollTop).toBe(10)
  })
})
