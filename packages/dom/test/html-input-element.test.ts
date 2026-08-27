import {describe, expect, it} from "bun:test"
import {Event, HTMLInputElement, createDocument} from "../src/index.ts"

const internalState = (input: HTMLInputElement): unknown => (input as unknown as {
  inputState: unknown
}).inputState

describe("HTMLInputElement reflection", () => {
  it("creates an input with standard property defaults and lazy state", () => {
    const input = createDocument().createElement("input")

    expect(input).toBeInstanceOf(HTMLInputElement)
    expect(input.type).toBe("text")
    expect(input.value).toBe("")
    expect(input.defaultValue).toBe("")
    expect(input.placeholder).toBe("")
    expect(input.disabled).toBe(false)
    expect(input.readOnly).toBe(false)
    expect(input.required).toBe(false)
    expect(input.checked).toBe(false)
    expect(input.defaultChecked).toBe(false)
    expect(input.tabIndex).toBe(0)
    expect(internalState(input)).toBeNull()
  })

  it("normalizes type and reflects string and boolean content attributes", () => {
    const input = createDocument().createElement("input")

    input.type = "EMAIL"
    input.placeholder = "Your email"
    input.disabled = true
    input.readOnly = true
    input.required = true

    expect(input.getAttribute("type")).toBe("EMAIL")
    expect(input.type).toBe("email")
    expect(input.placeholder).toBe("Your email")
    expect(input.getAttribute("readonly")).toBe("")
    expect(input.disabled).toBe(true)
    expect(input.readOnly).toBe(true)
    expect(input.required).toBe(true)

    input.setAttribute("type", "unknown")
    expect(input.type).toBe("text")
    input.disabled = false
    input.readOnly = false
    input.required = false
    expect(input.hasAttribute("disabled")).toBe(false)
    expect(input.hasAttribute("readonly")).toBe(false)
    expect(input.hasAttribute("required")).toBe(false)
  })
})

describe("HTMLInputElement live state", () => {
  it("separates live value from the reflected default value", () => {
    const input = createDocument().createElement("input")

    input.defaultValue = "first"
    expect(input.defaultValue).toBe("first")
    expect(input.value).toBe("first")
    expect(internalState(input)).toBeNull()

    input.setAttribute("value", "second")
    expect(input.value).toBe("second")

    input.value = "edited"
    expect(input.value).toBe("edited")
    expect(input.defaultValue).toBe("second")
    expect(input.getAttribute("value")).toBe("second")
    expect(internalState(input)).not.toBeNull()

    input.defaultValue = "new default"
    expect(input.defaultValue).toBe("new default")
    expect(input.value).toBe("edited")
    input.removeAttribute("value")
    expect(input.defaultValue).toBe("")
    expect(input.value).toBe("edited")
  })

  it("uses the HTML checkbox/radio fallback value without allocating state", () => {
    const input = createDocument().createElement("input")
    input.type = "checkbox"
    expect(input.value).toBe("on")
    expect(input.defaultValue).toBe("")
    expect(internalState(input)).toBeNull()

    input.defaultValue = "accepted"
    expect(input.value).toBe("accepted")
    input.value = "live"
    input.defaultValue = "changed"
    expect(input.value).toBe("live")
    expect(input.defaultValue).toBe("changed")
  })

  it("separates live checked state from the reflected checked default", () => {
    const input = createDocument().createElement("input")
    input.type = "checkbox"

    input.defaultChecked = true
    expect(input.defaultChecked).toBe(true)
    expect(input.checked).toBe(true)
    expect(input.getAttribute("checked")).toBe("")
    expect(internalState(input)).toBeNull()

    input.checked = false
    expect(input.checked).toBe(false)
    expect(input.defaultChecked).toBe(true)
    expect(input.hasAttribute("checked")).toBe(true)

    input.defaultChecked = false
    expect(input.defaultChecked).toBe(false)
    expect(input.checked).toBe(false)
    input.defaultChecked = true
    expect(input.defaultChecked).toBe(true)
    expect(input.checked).toBe(false)
  })
})

describe("HTMLInputElement focus and input events", () => {
  it("is focusable by default while connected and enabled", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    document.appendChild(root)
    root.appendChild(input)

    input.focus()
    expect(document.activeElement).toBe(input)
    input.blur()
    expect(document.activeElement).toBeNull()

    input.disabled = true
    input.focus()
    expect(document.activeElement).toBeNull()
    expect(input.tabIndex).toBe(0)
  })

  it("uses native EventTarget dispatch without synthesizing input on assignment", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    const order: string[] = []
    document.appendChild(root)
    root.appendChild(input)

    input.addEventListener("input", event => {
      expect(event.target).toBe(input)
      expect(input.value).toBe("typed")
      order.push("input")
    })
    root.addEventListener("input", () => order.push("root"))

    input.value = "typed"
    expect(order).toEqual([])
    const event = new Event("input", {bubbles: true, composed: true})
    expect(input.dispatchEvent(event)).toBe(true)
    expect(order).toEqual(["input", "root"])
  })

  it("keeps live writes out of attribute mutation batches", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    const recordTypes: string[] = []
    document.appendChild(root)
    root.appendChild(input)
    document.subscribeMutations(batch => {
      recordTypes.push(...batch.records.map(record => record.type))
    })

    input.value = "live"
    input.checked = true
    expect(recordTypes).toEqual([])

    input.defaultValue = "default"
    input.defaultChecked = true
    expect(recordTypes).toEqual(["attributes", "attributes"])
    expect(input.value).toBe("live")
    expect(input.checked).toBe(true)
  })
})
