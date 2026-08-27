import {describe, expect, it} from "bun:test"
import type {
  MutationBatch,
  StateChangeBatch
} from "../src/index.ts"
import type {HTMLInputElement} from "../src/index.ts"
import {createDocument} from "../src/index.ts"

const internalState = (input: HTMLInputElement): unknown => (input as unknown as {
  inputState: unknown
}).inputState

describe("HTMLInputElement numeric reflection", () => {
  it("reflects min, max and step without allocating live state", () => {
    const input = createDocument().createElement("input")
    expect(input.min).toBe("")
    expect(input.max).toBe("")
    expect(input.step).toBe("")
    expect(internalState(input)).toBeNull()

    input.min = "-10.5"
    input.max = "200"
    input.step = "0.25"
    expect(input.getAttribute("min")).toBe("-10.5")
    expect(input.getAttribute("max")).toBe("200")
    expect(input.getAttribute("step")).toBe("0.25")
    expect(internalState(input)).toBeNull()
  })
})

describe("HTMLInputElement.valueAsNumber", () => {
  it("sanitizes number values and implements NaN and InvalidState behavior", () => {
    const document = createDocument()
    const input = document.createElement("input")
    input.type = "number"
    input.defaultValue = "12.5"
    expect(input.value).toBe("12.5")
    expect(input.valueAsNumber).toBe(12.5)
    expect(internalState(input)).toBeNull()

    input.defaultValue = "not-a-number"
    expect(input.defaultValue).toBe("not-a-number")
    expect(input.value).toBe("")
    expect(Number.isNaN(input.valueAsNumber)).toBe(true)
    expect(internalState(input)).toBeNull()

    input.value = "3.25"
    expect(input.valueAsNumber).toBe(3.25)
    input.value = "invalid"
    expect(input.value).toBe("")
    expect(Number.isNaN(input.valueAsNumber)).toBe(true)

    input.valueAsNumber = 42.5
    expect(input.value).toBe("42.5")
    input.valueAsNumber = Number.NaN
    expect(input.value).toBe("")
    expect(Number.isNaN(input.valueAsNumber)).toBe(true)
    expect(() => {
      input.valueAsNumber = Number.POSITIVE_INFINITY
    }).toThrow(TypeError)

    input.type = "text"
    expect(Number.isNaN(input.valueAsNumber)).toBe(true)
    try {
      input.valueAsNumber = 1
      throw new Error("Expected unsupported numeric state to fail")
    } catch (error) {
      expect((error as Error).name).toBe("InvalidStateError")
    }
  })

  it("provides range defaults, clamping and practical step rounding", () => {
    const input = createDocument().createElement("input")
    input.type = "range"
    expect(input.value).toBe("50")
    expect(input.valueAsNumber).toBe(50)
    expect(internalState(input)).toBeNull()

    input.min = "-10"
    input.max = "30"
    expect(input.value).toBe("10")
    input.value = "-100"
    expect(input.value).toBe("-10")
    input.value = "100"
    expect(input.value).toBe("30")

    input.min = "0"
    input.max = "100"
    input.step = "20"
    input.value = "50"
    expect(input.value).toBe("60")
    expect(input.valueAsNumber).toBe(60)
    input.valueAsNumber = -5
    expect(input.valueAsNumber).toBe(0)
    input.valueAsNumber = 150
    expect(input.valueAsNumber).toBe(100)
    input.valueAsNumber = Number.NaN
    expect(input.valueAsNumber).toBe(60)

    input.min = "80"
    input.max = "20"
    expect(input.valueAsNumber).toBe(80)
  })
})

describe("numeric and check live state records", () => {
  it("publishes effective numeric changes without attributes or events", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    input.type = "number"
    root.append(input)
    document.append(root)
    const states: StateChangeBatch[] = []
    const mutations: MutationBatch[] = []
    const events: string[] = []
    document.subscribeStateChanges(batch => states.push(batch))
    document.subscribeMutations(batch => mutations.push(batch))
    input.addEventListener("input", event => events.push(event.type))
    input.addEventListener("change", event => events.push(event.type))

    input.valueAsNumber = 5
    expect(states.at(-1)?.records).toMatchObject([{
      type: "input",
      target: input,
      property: "value",
      oldValue: "",
      newValue: "5"
    }])
    expect(mutations).toEqual([])
    expect(events).toEqual([])

    const version = document.stateVersion
    input.valueAsNumber = 5
    document.transaction(() => {
      input.valueAsNumber = 10
      input.valueAsNumber = 5
    })
    expect(document.stateVersion).toBe(version)
  })

  it("reports range default-attribute changes only when the effective value changes", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    input.type = "range"
    input.step = "any"
    root.append(input)
    document.append(root)
    const states: StateChangeBatch[] = []
    const mutations: MutationBatch[] = []
    document.subscribeStateChanges(batch => states.push(batch))
    document.subscribeMutations(batch => mutations.push(batch))

    input.min = "80"
    expect(input.value).toBe("90")
    expect(states.at(-1)?.records).toMatchObject([{
      property: "value",
      oldValue: "50",
      newValue: "90"
    }])
    input.max = "85"
    expect(input.value).toBe("82.5")
    input.defaultValue = "100"
    expect(input.value).toBe("85")
    expect(mutations).toHaveLength(3)
    expect(states).toHaveLength(3)

    states.length = 0
    mutations.length = 0
    input.valueAsNumber = 82
    states.length = 0
    input.defaultValue = "81"
    expect(input.valueAsNumber).toBe(82)
    expect(mutations).toHaveLength(1)
    expect(states).toEqual([])
  })

  it("keeps checkbox indeterminate lazy, non-reflected and independently coalesced", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    input.type = "checkbox"
    root.append(input)
    document.append(root)
    const states: StateChangeBatch[] = []
    const events: string[] = []
    document.subscribeStateChanges(batch => states.push(batch))
    input.addEventListener("input", event => events.push(event.type))
    input.addEventListener("change", event => events.push(event.type))

    expect(input.indeterminate).toBe(false)
    expect(internalState(input)).toBeNull()
    input.indeterminate = false
    expect(internalState(input)).toBeNull()
    input.indeterminate = true
    expect(input.indeterminate).toBe(true)
    expect(input.hasAttribute("indeterminate")).toBe(false)
    expect(states.at(-1)?.records).toMatchObject([{
      property: "indeterminate",
      oldValue: false,
      newValue: true
    }])
    expect(events).toEqual([])

    const version = document.stateVersion
    document.transaction(() => {
      input.indeterminate = false
      input.checked = true
      input.indeterminate = true
      input.checked = false
    })
    expect(document.stateVersion).toBe(version)

    input.indeterminate = false
    expect(input.indeterminate).toBe(false)
    expect(internalState(input)).not.toBeNull()

    const fresh = document.createElement("input")
    fresh.type = "checkbox"
    fresh.indeterminate = true
    fresh.indeterminate = false
    expect(internalState(fresh)).toBeNull()
  })
})
