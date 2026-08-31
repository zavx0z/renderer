import {describe, expect, test} from "bun:test"
import {createDocument, type StateChangeBatch} from "../src/index.ts"

describe("input and textarea selection state", () => {
  test("implements bounded standard selection APIs for text-like inputs", () => {
    const document = createDocument()
    const input = document.createElement("input")
    input.defaultValue = "output"
    document.appendChild(input)
    const states: StateChangeBatch[] = []
    document.subscribeStateChanges(batch => states.push(batch))

    expect([input.selectionStart, input.selectionEnd, input.selectionDirection])
      .toEqual([0, 0, "none"])
    input.setSelectionRange(2, 99, "forward")
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection])
      .toEqual([2, 6, "forward"])
    input.selectionEnd = 1
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 1])
    input.select()
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection])
      .toEqual([0, 6, "none"])
    expect(states.flatMap(batch => batch.records).every(record =>
      record.type === "input" && record.property === "selection"
    )).toBe(true)
  })

  test("collapses selection to the end on programmatic value writes", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    const textArea = document.createElement("textarea")
    root.append(input, textArea)
    document.appendChild(root)
    input.value = "first"
    textArea.value = "first\nsecond"
    input.setSelectionRange(1, 4, "backward")
    textArea.setSelectionRange(2, 8, "forward")

    document.transaction(() => {
      input.value = "next"
      textArea.value = "next\nvalue"
    })

    expect([input.selectionStart, input.selectionEnd, input.selectionDirection])
      .toEqual([4, 4, "none"])
    expect([textArea.selectionStart, textArea.selectionEnd, textArea.selectionDirection])
      .toEqual([10, 10, "none"])
  })

  test("keeps textarea selection independent from default child text", () => {
    const document = createDocument()
    const textArea = document.createElement("textarea")
    textArea.defaultValue = "first line"
    document.appendChild(textArea)
    textArea.setSelectionRange(3, 10, "backward")
    textArea.defaultValue = "short"
    expect(textArea.value).toBe("short")
    expect([textArea.selectionStart, textArea.selectionEnd, textArea.selectionDirection])
      .toEqual([3, 5, "backward"])
    textArea.value = "owner"
    textArea.defaultValue = "different"
    expect(textArea.value).toBe("owner")
    expect([textArea.selectionStart, textArea.selectionEnd]).toEqual([5, 5])
  })

  test("returns null or throws InvalidStateError for non-text input types", () => {
    const document = createDocument()
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    expect(checkbox.selectionStart).toBeNull()
    expect(checkbox.selectionEnd).toBeNull()
    expect(checkbox.selectionDirection).toBeNull()
    expect(() => checkbox.setSelectionRange(0, 1)).toThrow("Text selection does not apply")
    expect(() => checkbox.select()).toThrow("Text selection does not apply")
    expect(() => { checkbox.selectionStart = 0 }).toThrow("Text selection does not apply")
  })

  test("coalesces a returned selection to no state batch", () => {
    const document = createDocument()
    const input = document.createElement("input")
    input.value = "value"
    document.appendChild(input)
    const states: StateChangeBatch[] = []
    document.subscribeStateChanges(batch => states.push(batch))
    document.transaction(() => {
      input.setSelectionRange(1, 3, "forward")
      input.setSelectionRange(5, 5, "none")
    })
    expect(states).toEqual([])
  })

  test("derives one immutable active text-control selection without parallel state", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const textArea = document.createElement("textarea")
    const button = document.createElement("button")
    textArea.value = "alpha\nbeta"
    root.append(textArea, button)
    document.appendChild(root)

    expect(document.readTextControlSelection()).toBeNull()
    textArea.focus()
    textArea.setSelectionRange(2, 8, "backward")
    const snapshot = document.readTextControlSelection()
    expect(snapshot).toEqual({
      target: textArea,
      start: 2,
      end: 8,
      direction: "backward",
      collapsed: false,
      text: "pha\nbe",
    })
    expect(Object.isFrozen(snapshot)).toBeTrue()

    textArea.setSelectionRange(5, 5, "none")
    expect(document.readTextControlSelection()).toMatchObject({
      target: textArea,
      start: 5,
      end: 5,
      collapsed: true,
      text: "",
    })
    button.focus()
    expect(document.readTextControlSelection()).toBeNull()
  })
})
