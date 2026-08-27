import {describe, expect, it} from "bun:test"
import {
  FocusEvent,
  MouseEvent,
  PointerEvent,
  UIEvent,
  createDocument
} from "../src/index.ts"

describe("UI input event interfaces", () => {
  it("preserves the UIEvent and MouseEvent constructor data", () => {
    const view = {}
    const relatedTarget = createDocument().createElement("div")
    const event = new MouseEvent("mousemove", {
      bubbles: true,
      view,
      detail: 2,
      screenX: 10,
      screenY: 20,
      clientX: 3,
      clientY: 4,
      movementX: 1.5,
      movementY: -2.5,
      button: 2,
      buttons: 3,
      ctrlKey: true,
      modifierCapsLock: true,
      relatedTarget
    })

    expect(event).toBeInstanceOf(MouseEvent)
    expect(event).toBeInstanceOf(UIEvent)
    expect(event.view).toBe(view)
    expect(event.detail).toBe(2)
    expect([event.screenX, event.screenY]).toEqual([10, 20])
    expect([event.clientX, event.clientY, event.x, event.y]).toEqual([3, 4, 3, 4])
    expect([event.movementX, event.movementY]).toEqual([1.5, -2.5])
    expect([event.button, event.buttons]).toEqual([2, 3])
    expect(event.relatedTarget).toBe(relatedTarget)
    expect(event.getModifierState("Control")).toBe(true)
    expect(event.getModifierState("CapsLock")).toBe(true)
    expect(event.getModifierState("Shift")).toBe(false)
    expect(event.getModifierState("Unknown")).toBe(false)
  })

  it("extends MouseEvent with Pointer Events data and lazy sample lists", () => {
    const coalesced = new PointerEvent("pointermove", {pointerId: 7, clientX: 11})
    const predicted = new PointerEvent("pointermove", {pointerId: 7, clientX: 13})
    const event = new PointerEvent("pointermove", {
      pointerId: 7,
      pointerType: "pen",
      isPrimary: true,
      width: 4.5,
      height: 6.5,
      pressure: 0.75,
      tangentialPressure: -0.25,
      tiltX: 30,
      tiltY: -15,
      twist: 180,
      altitudeAngle: 0.7,
      azimuthAngle: 1.2,
      persistentDeviceId: 42,
      clientX: 12,
      buttons: 1,
      coalescedEvents: [coalesced],
      predictedEvents: [predicted]
    })

    expect(event).toBeInstanceOf(PointerEvent)
    expect(event).toBeInstanceOf(MouseEvent)
    expect(event.pointerId).toBe(7)
    expect(event.pointerType).toBe("pen")
    expect(event.isPrimary).toBe(true)
    expect([event.width, event.height]).toEqual([4.5, 6.5])
    expect([event.pressure, event.tangentialPressure]).toEqual([0.75, -0.25])
    expect([event.tiltX, event.tiltY, event.twist]).toEqual([30, -15, 180])
    expect([event.altitudeAngle, event.azimuthAngle]).toEqual([0.7, 1.2])
    expect(event.persistentDeviceId).toBe(42)
    expect(event.clientX).toBe(12)
    expect(event.buttons).toBe(1)
    expect(event.getCoalescedEvents()).toEqual([coalesced])
    expect(event.getPredictedEvents()).toEqual([predicted])
    expect(event.getCoalescedEvents()).not.toBe(event.getCoalescedEvents())

    const defaults = new PointerEvent("pointermove")
    expect([defaults.width, defaults.height]).toEqual([1, 1])
    expect([defaults.pressure, defaults.tangentialPressure]).toEqual([0, 0])
    expect([defaults.tiltX, defaults.tiltY, defaults.twist]).toEqual([0, 0, 0])
    expect([defaults.altitudeAngle, defaults.azimuthAngle]).toEqual([Math.PI / 2, 0])
    expect(defaults.getCoalescedEvents()).toEqual([])
    expect(defaults.getPredictedEvents()).toEqual([])
  })
})

describe("document focus", () => {
  it("reflects tabIndex and enforces practical programmatic focusability", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const panel = document.createElement("div")
    const button = document.createElement("button")
    const detachedButton = document.createElement("button")
    document.appendChild(root)
    root.appendChild(panel)
    root.appendChild(button)

    expect(document.activeElement).toBeNull()
    expect(panel.tabIndex).toBe(-1)
    expect(button.tabIndex).toBe(0)
    expect(detachedButton.tabIndex).toBe(0)

    panel.focus()
    detachedButton.focus()
    expect(document.activeElement).toBeNull()

    panel.tabIndex = -1
    expect(panel.getAttribute("tabindex")).toBe("-1")
    expect(panel.tabIndex).toBe(-1)
    panel.focus({preventScroll: true, focusVisible: true})
    expect(document.activeElement).toBe(panel)

    button.disabled = true
    button.focus()
    expect(document.activeElement).toBe(panel)
    expect(button.tabIndex).toBe(0)

    panel.setAttribute("tabindex", "invalid")
    expect(panel.tabIndex).toBe(-1)
  })

  it("dispatches blur, focusout, focus and focusin with related targets", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = document.createElement("button")
    const second = document.createElement("button")
    const order: string[] = []
    document.appendChild(root)
    root.appendChild(first)
    root.appendChild(second)

    first.focus()
    expect(document.activeElement).toBe(first)

    first.addEventListener("blur", event => {
      expect(event).toBeInstanceOf(FocusEvent)
      expect((event as FocusEvent).relatedTarget).toBe(second)
      expect(event.bubbles).toBe(false)
      expect(document.activeElement).toBeNull()
      order.push("first:blur")
    })
    first.addEventListener("focusout", event => {
      expect((event as FocusEvent).relatedTarget).toBe(second)
      expect(event.bubbles).toBe(true)
      order.push("first:focusout")
    })
    second.addEventListener("focus", event => {
      expect((event as FocusEvent).relatedTarget).toBe(first)
      expect(event.bubbles).toBe(false)
      expect(document.activeElement).toBe(second)
      order.push("second:focus")
    })
    second.addEventListener("focusin", event => {
      expect((event as FocusEvent).relatedTarget).toBe(first)
      expect(event.bubbles).toBe(true)
      order.push("second:focusin")
    })

    second.focus()
    expect(order).toEqual([
      "first:blur",
      "first:focusout",
      "second:focus",
      "second:focusin"
    ])
    expect(document.activeElement).toBe(second)

    order.length = 0
    second.addEventListener("blur", () => order.push("second:blur"))
    second.addEventListener("focusout", () => order.push("second:focusout"))
    second.blur()
    expect(order).toEqual(["second:blur", "second:focusout"])
    expect(document.activeElement).toBeNull()
  })

  it("exposes capture for focus and bubbling for focusin", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const button = document.createElement("button")
    const order: string[] = []
    document.appendChild(root)
    root.appendChild(button)

    root.addEventListener("focus", () => order.push("root:focus:capture"), {capture: true})
    root.addEventListener("focus", () => order.push("root:focus:bubble"))
    root.addEventListener("focusin", () => order.push("root:focusin"))
    button.addEventListener("focus", () => order.push("button:focus"))
    button.addEventListener("focusin", () => order.push("button:focusin"))

    button.focus()
    expect(order).toEqual([
      "root:focus:capture",
      "button:focus",
      "button:focusin",
      "root:focusin"
    ])
  })

  it("returns null after the focused element leaves its Document", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const button = document.createElement("button")
    document.appendChild(root)
    root.appendChild(button)
    button.focus()
    expect(document.activeElement).toBe(button)

    root.removeChild(button)
    expect(document.activeElement).toBeNull()

    root.appendChild(button)
    expect(document.activeElement).toBeNull()
  })
})
