import {describe, expect, it} from "bun:test"
import {
  HTMLFieldSetElement,
  HTMLLabelElement,
  HTMLLegendElement,
  HTMLElement,
  createDocument
} from "../src/index.ts"

describe("HTMLLabelElement", () => {
  it("creates the exact prototype and resolves explicit for/id in same-tree order", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const label = document.createElement("label")
    const duplicate = document.createElement("div")
    const input = document.createElement("input")
    duplicate.id = "control"
    input.id = "control"
    label.htmlFor = "control"
    root.append(label, duplicate, input)

    expect(label).toBeInstanceOf(HTMLLabelElement)
    expect(label).toBeInstanceOf(HTMLElement)
    expect(label.getAttribute("for")).toBe("control")
    expect(label.control).toBeNull()
    duplicate.remove()
    expect(label.control).toBe(input)

    const detachedDocument = createDocument()
    const detachedRoot = detachedDocument.createElement("div")
    const detachedLabel = detachedDocument.createElement("label")
    const detachedInput = detachedDocument.createElement("input")
    detachedLabel.htmlFor = "detached"
    detachedInput.id = "detached"
    detachedRoot.append(detachedLabel, detachedInput)
    expect(detachedLabel.control).toBe(detachedInput)
  })

  it("uses the first supported implicit labelable descendant and honors explicit empty for", () => {
    const document = createDocument()
    const label = document.createElement("label")
    const hidden = document.createElement("input")
    const meter = document.createElement("meter")
    const button = document.createElement("button")
    hidden.type = "hidden"
    label.append(hidden, meter, button)

    expect(label.control).toBe(meter)
    label.htmlFor = ""
    expect(label.hasAttribute("for")).toBe(true)
    expect(label.control).toBeNull()
    label.removeAttribute("for")
    expect(label.control).toBe(meter)
  })

  it("recognizes every exact labelable interface in the supported realm", () => {
    const document = createDocument()
    const controls = [
      document.createElement("button"),
      document.createElement("input"),
      document.createElement("meter"),
      document.createElement("progress"),
      document.createElement("select"),
      document.createElement("textarea")
    ]

    for (const control of controls) {
      const label = document.createElement("label")
      label.append(control)
      expect(label.control).toBe(control)
    }
  })
})

describe("HTMLFieldSetElement and HTMLLegendElement", () => {
  it("reflects the bounded fieldset contract without fabricated forms APIs", () => {
    const document = createDocument()
    const fieldSet = document.createElement("fieldset")
    const legend = document.createElement("legend")

    expect(fieldSet).toBeInstanceOf(HTMLFieldSetElement)
    expect(fieldSet).toBeInstanceOf(HTMLElement)
    expect(legend).toBeInstanceOf(HTMLLegendElement)
    expect(legend).toBeInstanceOf(HTMLElement)
    expect(fieldSet.disabled).toBe(false)
    expect(fieldSet.name).toBe("")
    fieldSet.disabled = true
    fieldSet.name = "preferences"
    expect(fieldSet.getAttribute("disabled")).toBe("")
    expect(fieldSet.getAttribute("name")).toBe("preferences")
    expect("elements" in fieldSet).toBe(false)
    expect("form" in fieldSet).toBe(false)
    expect("validity" in fieldSet).toBe(false)
    expect("form" in legend).toBe(false)
  })

  it("propagates effective disabled focus with the exact first-legend exception", () => {
    const document = createDocument()
    const fieldSet = document.createElement("fieldset")
    const firstLegend = document.createElement("legend")
    const legendInput = document.createElement("input")
    const input = document.createElement("input")
    const button = document.createElement("button")
    const select = document.createElement("select")
    const textArea = document.createElement("textarea")
    const secondLegend = document.createElement("legend")
    const secondLegendInput = document.createElement("input")
    const clickEvents: string[] = []
    firstLegend.append(legendInput)
    secondLegend.append(secondLegendInput)
    fieldSet.append(firstLegend, input, button, select, textArea, secondLegend)
    document.append(fieldSet)
    fieldSet.disabled = true
    button.addEventListener("click", event => clickEvents.push(event.type))

    expect(input.disabled).toBe(false)
    expect(button.disabled).toBe(false)
    expect(select.disabled).toBe(false)
    expect(textArea.disabled).toBe(false)
    legendInput.focus()
    expect(document.activeElement).toBe(legendInput)
    legendInput.blur()

    for (const control of [input, button, select, textArea, secondLegendInput]) {
      control.focus()
      expect(document.activeElement).toBeNull()
    }
    button.click()
    expect(clickEvents).toEqual([])

    fieldSet.disabled = false
    for (const control of [input, button, select, textArea, secondLegendInput]) {
      control.focus()
      expect(document.activeElement).toBe(control)
      control.blur()
    }
  })

  it("still applies a nested fieldset's own disabled state inside an outer legend", () => {
    const document = createDocument()
    const outer = document.createElement("fieldset")
    const outerLegend = document.createElement("legend")
    const nested = document.createElement("fieldset")
    const nestedInput = document.createElement("input")
    nested.append(nestedInput)
    nested.disabled = true
    outerLegend.append(nested)
    outer.append(outerLegend)
    outer.disabled = true
    document.append(outer)

    nestedInput.focus()
    expect(document.activeElement).toBeNull()
    nested.disabled = false
    nestedInput.focus()
    expect(document.activeElement).toBe(nestedInput)
  })
})
