import {describe, expect, it} from "bun:test"
import type {
  MutationBatch,
  StateChangeBatch
} from "../src/index.ts"
import {
  HTMLElement,
  HTMLTextAreaElement,
  createDocument
} from "../src/index.ts"

const internalState = (textArea: HTMLTextAreaElement): unknown => (textArea as unknown as {
  textAreaState: unknown
}).textAreaState

describe("HTMLTextAreaElement factory and reflection", () => {
  it("creates the exact class with lazy standard defaults", () => {
    const textArea = createDocument().createElement("textarea")
    expect(textArea).toBeInstanceOf(HTMLTextAreaElement)
    expect(textArea).toBeInstanceOf(HTMLElement)
    expect(textArea.localName).toBe("textarea")
    expect(textArea.placeholder).toBe("")
    expect(textArea.disabled).toBe(false)
    expect(textArea.readOnly).toBe(false)
    expect(textArea.rows).toBe(2)
    expect(textArea.cols).toBe(20)
    expect(textArea.maxLength).toBe(-1)
    expect(textArea.minLength).toBe(-1)
    expect(textArea.wrap).toBe("")
    expect(textArea.value).toBe("")
    expect(textArea.defaultValue).toBe("")
    expect(internalState(textArea)).toBeNull()
  })

  it("reflects strings, booleans and integer constraints", () => {
    const textArea = createDocument().createElement("textarea")
    textArea.placeholder = "Write here"
    textArea.disabled = true
    textArea.readOnly = true
    textArea.rows = 5
    textArea.cols = 40
    textArea.maxLength = 120
    textArea.minLength = 4
    textArea.wrap = "hard"
    expect(textArea.getAttribute("placeholder")).toBe("Write here")
    expect(textArea.getAttribute("disabled")).toBe("")
    expect(textArea.getAttribute("readonly")).toBe("")
    expect(textArea.rows).toBe(5)
    expect(textArea.cols).toBe(40)
    expect(textArea.maxLength).toBe(120)
    expect(textArea.minLength).toBe(4)
    expect(textArea.wrap).toBe("hard")

    textArea.rows = 0
    textArea.cols = 0
    expect(textArea.getAttribute("rows")).toBe("2")
    expect(textArea.getAttribute("cols")).toBe("20")
    textArea.setAttribute("rows", "invalid")
    textArea.setAttribute("cols", "-1")
    textArea.setAttribute("maxlength", "invalid")
    expect(textArea.rows).toBe(2)
    expect(textArea.cols).toBe(20)
    expect(textArea.maxLength).toBe(-1)

    for (const setInvalid of [
      () => {
        textArea.maxLength = -1
      },
      () => {
        textArea.minLength = -1
      }
    ]) {
      try {
        setInvalid()
        throw new Error("Expected negative length to fail")
      } catch (error) {
        expect((error as Error).name).toBe("IndexSizeError")
      }
    }
  })
})

describe("HTMLTextAreaElement value/defaultValue law", () => {
  it("normalizes newlines and separates dirty live value from child text", () => {
    const textArea = createDocument().createElement("textarea")
    textArea.defaultValue = "first\r\nsecond\rthird"
    expect(textArea.defaultValue).toBe("first\nsecond\nthird")
    expect(textArea.value).toBe("first\nsecond\nthird")
    expect(textArea.textContent).toBe("first\nsecond\nthird")
    expect(internalState(textArea)).toBeNull()

    textArea.value = "first\r\nsecond\rthird"
    expect(textArea.value).toBe("first\nsecond\nthird")
    expect(internalState(textArea)).not.toBeNull()
    textArea.defaultValue = "new default"
    expect(textArea.defaultValue).toBe("new default")
    expect(textArea.textContent).toBe("new default")
    expect(textArea.value).toBe("first\nsecond\nthird")

    textArea.value = "live\rvalue"
    expect(textArea.value).toBe("live\nvalue")
    expect(textArea.defaultValue).toBe("new default")
  })
})

describe("HTMLTextAreaElement state and focus adapters", () => {
  it("separates default mutations from live state and fabricates no events", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const textArea = document.createElement("textarea")
    const mutations: MutationBatch[] = []
    const states: StateChangeBatch[] = []
    const events: string[] = []
    root.append(textArea)
    document.append(root)
    document.subscribeMutations(batch => mutations.push(batch))
    document.subscribeStateChanges(batch => states.push(batch))
    textArea.addEventListener("input", event => events.push(event.type))
    textArea.addEventListener("change", event => events.push(event.type))

    textArea.defaultValue = "first"
    expect(mutations).toHaveLength(1)
    expect(states).toHaveLength(1)
    expect(states[0]?.records).toEqual([{
      type: "textarea",
      target: textArea,
      property: "value",
      oldValue: "",
      newValue: "first"
    }])
    expect(events).toEqual([])

    states.length = 0
    mutations.length = 0
    textArea.value = "first"
    expect(states.at(-1)?.records).toMatchObject([{
      property: "selection",
      oldValue: {start: 0, end: 0},
      newValue: {start: 5, end: 5}
    }])
    states.length = 0
    textArea.defaultValue = "second"
    expect(mutations).toHaveLength(1)
    expect(states).toEqual([])
    expect(textArea.value).toBe("first")

    textArea.value = "third"
    expect(mutations).toHaveLength(1)
    expect(states).toHaveLength(1)
    expect(events).toEqual([])
    const version = document.stateVersion
    document.transaction(() => {
      textArea.value = "temporary"
      textArea.value = "third"
    })
    expect(document.stateVersion).toBe(version)
  })

  it("is focusable when enabled, including readonly state", () => {
    const document = createDocument()
    const textArea = document.createElement("textarea")
    document.append(textArea)
    expect(textArea.tabIndex).toBe(0)

    textArea.readOnly = true
    textArea.focus()
    expect(document.activeElement).toBe(textArea)
    textArea.blur()
    textArea.disabled = true
    textArea.focus()
    expect(document.activeElement).toBeNull()
  })
})
