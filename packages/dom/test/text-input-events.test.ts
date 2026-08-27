import {describe, expect, it} from "bun:test"
import {
  CompositionEvent,
  Event,
  InputEvent,
  KeyboardEvent,
  UIEvent,
  createDocument
} from "../src/index.ts"

describe("KeyboardEvent", () => {
  it("uses standard defaults, location constants and modifier state", () => {
    const empty = new KeyboardEvent("keydown")
    expect(empty).toBeInstanceOf(KeyboardEvent)
    expect(empty).toBeInstanceOf(UIEvent)
    expect(empty).toBeInstanceOf(Event)
    expect(empty.key).toBe("")
    expect(empty.code).toBe("")
    expect(empty.location).toBe(KeyboardEvent.DOM_KEY_LOCATION_STANDARD)
    expect(empty.repeat).toBe(false)
    expect(empty.isComposing).toBe(false)
    expect(KeyboardEvent.DOM_KEY_LOCATION_STANDARD).toBe(0)
    expect(KeyboardEvent.DOM_KEY_LOCATION_LEFT).toBe(1)
    expect(KeyboardEvent.DOM_KEY_LOCATION_RIGHT).toBe(2)
    expect(KeyboardEvent.DOM_KEY_LOCATION_NUMPAD).toBe(3)
    expect(empty.DOM_KEY_LOCATION_NUMPAD).toBe(3)

    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "NumpadEnter",
      location: KeyboardEvent.DOM_KEY_LOCATION_NUMPAD,
      repeat: true,
      isComposing: true,
      ctrlKey: true,
      shiftKey: true,
      modifierAltGraph: true,
      modifierCapsLock: true,
      detail: 2
    })
    expect(event.key).toBe("Enter")
    expect(event.code).toBe("NumpadEnter")
    expect(event.location).toBe(3)
    expect(event.repeat).toBe(true)
    expect(event.isComposing).toBe(true)
    expect(event.detail).toBe(2)
    expect(event.getModifierState("Control")).toBe(true)
    expect(event.getModifierState("Shift")).toBe(true)
    expect(event.getModifierState("AltGraph")).toBe(true)
    expect(event.getModifierState("CapsLock")).toBe(true)
    expect(event.getModifierState("Alt")).toBe(false)
    expect(event.getModifierState("Unknown")).toBe(false)
  })
})

describe("InputEvent and CompositionEvent", () => {
  it("exposes practical readonly constructor data and explicit DataTransfer gap", () => {
    const emptyInput = new InputEvent("input")
    expect(emptyInput).toBeInstanceOf(UIEvent)
    expect(emptyInput.data).toBeNull()
    expect(emptyInput.inputType).toBe("")
    expect(emptyInput.isComposing).toBe(false)
    expect(emptyInput.dataTransfer).toBeNull()
    expect("getTargetRanges" in emptyInput).toBe(false)

    const input = new InputEvent("beforeinput", {
      data: "Ж",
      inputType: "insertCompositionText",
      isComposing: true,
      dataTransfer: null,
      detail: 1
    })
    expect(input.data).toBe("Ж")
    expect(input.inputType).toBe("insertCompositionText")
    expect(input.isComposing).toBe(true)
    expect(input.detail).toBe(1)

    try {
      new InputEvent("beforeinput", {dataTransfer: {}} as never)
      throw new Error("Expected unsupported DataTransfer to fail")
    } catch (error) {
      expect((error as Error).name).toBe("NotSupportedError")
    }

    const emptyComposition = new CompositionEvent("compositionstart")
    const composition = new CompositionEvent("compositionupdate", {data: "かな"})
    expect(emptyComposition).toBeInstanceOf(UIEvent)
    expect(emptyComposition.data).toBe("")
    expect(composition.data).toBe("かな")
  })

  it("uses ordinary capture, bubble and cancellation for every event family", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const target = document.createElement("input")
    document.append(root)
    root.append(target)

    const events = [
      new KeyboardEvent("keydown", {bubbles: true, cancelable: true, key: "a"}),
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        data: "a",
        inputType: "insertText"
      }),
      new CompositionEvent("compositionupdate", {
        bubbles: true,
        cancelable: true,
        data: "a"
      })
    ]

    for (const event of events) {
      const order: string[] = []
      root.addEventListener(event.type, () => order.push("capture"), {capture: true, once: true})
      target.addEventListener(event.type, current => {
        order.push("target")
        current.preventDefault()
      }, {once: true})
      root.addEventListener(event.type, () => order.push("bubble"), {once: true})
      expect(target.dispatchEvent(event)).toBe(false)
      expect(order).toEqual(["capture", "target", "bubble"])
      expect(event.defaultPrevented).toBe(true)
    }
  })

  it("does not perform text editing, focus, or native proxy behavior", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    document.append(root)
    root.append(input)
    input.value = "seed"

    input.dispatchEvent(new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "x",
      code: "KeyX"
    }))
    input.dispatchEvent(new CompositionEvent("compositionupdate", {
      bubbles: true,
      data: "候補"
    }))
    input.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      data: "x",
      inputType: "insertText"
    }))

    expect(input.value).toBe("seed")
    expect(document.activeElement).toBeNull()
  })
})
