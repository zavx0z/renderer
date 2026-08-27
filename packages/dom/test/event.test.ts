import {describe, expect, it} from "bun:test"
import {CustomEvent, Event, HTMLButtonElement, MouseEvent, createDocument} from "../src/index.ts"
import {buttonActivationBehavior} from "../src/internal/activation.ts"

describe("EventTarget dispatch", () => {
  it("dispatches capture, target and bubble listeners in DOM order", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const button = document.createElement("button")
    const order: string[] = []
    document.appendChild(root)
    root.appendChild(button)

    document.addEventListener("action", event => {
      expect(event.target).toBe(button)
      expect(event.currentTarget).toBe(document)
      expect(event.eventPhase).toBe(Event.CAPTURING_PHASE)
      order.push("document-capture")
    }, {capture: true})
    root.addEventListener("action", () => order.push("root-capture"), {capture: true})
    button.addEventListener("action", event => {
      expect(event.eventPhase).toBe(Event.AT_TARGET)
      order.push("button-capture")
    }, {capture: true})
    button.addEventListener("action", () => order.push("button-bubble"))
    root.addEventListener("action", () => order.push("root-bubble"))
    document.addEventListener("action", () => order.push("document-bubble"))

    const event = new Event("action", {bubbles: true, cancelable: true})
    expect(button.dispatchEvent(event)).toBe(true)
    expect(order).toEqual([
      "document-capture",
      "root-capture",
      "button-capture",
      "button-bubble",
      "root-bubble",
      "document-bubble"
    ])
    expect(event.target).toBe(button)
    expect(event.currentTarget).toBeNull()
    expect(event.eventPhase).toBe(Event.NONE)
  })

  it("supports once, removal, propagation stopping and cancellation", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const button = document.createElement("button")
    let onceCalls = 0
    let bubbleCalls = 0
    document.appendChild(root)
    root.appendChild(button)

    button.addEventListener("once", () => onceCalls += 1, {once: true})
    button.dispatchEvent(new Event("once"))
    button.dispatchEvent(new Event("once"))
    expect(onceCalls).toBe(1)

    root.addEventListener("stop", event => event.stopPropagation(), {capture: true})
    button.addEventListener("stop", () => bubbleCalls += 1)
    button.dispatchEvent(new Event("stop", {bubbles: true}))
    expect(bubbleCalls).toBe(0)

    button.addEventListener("cancel", event => event.preventDefault())
    expect(button.dispatchEvent(new Event("cancel", {cancelable: true}))).toBe(false)

    button.addEventListener("passive", event => event.preventDefault(), {passive: true})
    const passive = new Event("passive", {cancelable: true})
    expect(button.dispatchEvent(passive)).toBe(true)
    expect(passive.defaultPrevented).toBe(false)
  })

  it("preserves CustomEvent detail", () => {
    const target = createDocument().createElement("div")
    const detail = {value: 42}
    let received: unknown
    target.addEventListener("detail", event => received = (event as CustomEvent).detail)
    target.dispatchEvent(new CustomEvent("detail", {detail}))
    expect(received).toBe(detail)
  })
})

describe("HTMLButtonElement activation", () => {
  it("reflects the standard normalized button type", () => {
    const document = createDocument()
    const button = document.createElement("button")
    expect(button.type).toBe("submit")
    button.type = "BUTTON"
    expect(button.getAttribute("type")).toBe("BUTTON")
    expect(button.type).toBe("button")
    button.type = "unknown"
    expect(button.type).toBe("submit")
  })

  class TestButton extends HTMLButtonElement {
    activations = 0

    protected override [buttonActivationBehavior](_event: Event): void {
      this.activations += 1
    }
  }

  it("runs the default action after an uncanceled click", () => {
    const document = createDocument()
    const button = new TestButton(document)
    const order: string[] = []
    button.addEventListener("click", event => {
      expect(event).toBeInstanceOf(MouseEvent)
      expect((event as MouseEvent).button).toBe(0)
      expect((event as MouseEvent).buttons).toBe(0)
      expect(event.composed).toBe(true)
      order.push("listener")
    })
    button.click()
    order.push(`default:${button.activations}`)
    expect(order).toEqual(["listener", "default:1"])
  })

  it("suppresses disabled and canceled activation", () => {
    const document = createDocument()
    const button = new TestButton(document)
    let clicks = 0
    button.addEventListener("click", event => {
      clicks += 1
      event.preventDefault()
    })

    button.click()
    expect(clicks).toBe(1)
    expect(button.activations).toBe(0)

    button.disabled = true
    button.click()
    expect(clicks).toBe(1)
    expect(button.activations).toBe(0)
  })
})
