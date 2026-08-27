import {describe, expect, it} from "bun:test"
import type {
  MutationBatch,
  StateChangeBatch
} from "../src/index.ts"
import {createDocument} from "../src/index.ts"

function connectedInput() {
  const document = createDocument()
  const root = document.createElement("div")
  const input = document.createElement("input")
  root.append(input)
  document.append(root)
  return {document, input, root}
}

describe("HTMLInputElement live state changes", () => {
  it("records connected value and checked writes without attributes or events", () => {
    const {document, input} = connectedInput()
    const mutations: MutationBatch[] = []
    const states: StateChangeBatch[] = []
    const events: string[] = []
    document.subscribeMutations(batch => mutations.push(batch))
    document.subscribeStateChanges(batch => states.push(batch))
    input.addEventListener("input", event => events.push(event.type))
    input.addEventListener("change", event => events.push(event.type))

    input.value = "one"
    expect(states).toHaveLength(1)
    expect(states[0]?.records).toEqual([
      {
        type: "input",
        target: input,
        property: "value",
        oldValue: "",
        newValue: "one"
      },
      {
        type: "input",
        target: input,
        property: "selection",
        oldValue: {start: 0, end: 0, direction: "none"},
        newValue: {start: 3, end: 3, direction: "none"}
      }
    ])
    expect(Object.isFrozen(states[0]?.records[0])).toBe(true)
    expect(mutations).toEqual([])
    expect(input.getAttribute("value")).toBeNull()

    input.value = "one"
    expect(states).toHaveLength(1)
    input.checked = true
    expect(states).toHaveLength(2)
    expect(states[1]?.records).toEqual([{
      type: "input",
      target: input,
      property: "checked",
      oldValue: false,
      newValue: true
    }])
    expect(input.hasAttribute("checked")).toBe(false)
    expect(mutations).toEqual([])
    expect(events).toEqual([])
  })

  it("coalesces independently per target and property alongside scroll state", () => {
    const {document, input} = connectedInput()
    const states: StateChangeBatch[] = []
    document.subscribeStateChanges(batch => states.push(batch))

    document.transaction(() => {
      input.value = "one"
      input.value = "two"
      input.checked = true
      input.scrollTop = 4
      input.scrollLeft = 3
    })
    expect(states).toHaveLength(1)
    expect(states[0]?.records).toEqual([
      {
        type: "input",
        target: input,
        property: "value",
        oldValue: "",
        newValue: "two"
      },
      {
        type: "input",
        target: input,
        property: "selection",
        oldValue: {start: 0, end: 0, direction: "none"},
        newValue: {start: 3, end: 3, direction: "none"}
      },
      {
        type: "input",
        target: input,
        property: "checked",
        oldValue: false,
        newValue: true
      },
      {
        type: "scroll",
        target: input,
        oldScrollLeft: 0,
        oldScrollTop: 0,
        scrollLeft: 3,
        scrollTop: 4
      }
    ])
    const version = document.stateVersion

    document.transaction(() => {
      input.value = "temporary"
      input.value = "two"
      input.checked = false
      input.checked = true
      input.scrollTo(0, 0)
      input.scrollTo(3, 4)
    })
    expect(states).toHaveLength(1)
    expect(document.stateVersion).toBe(version)
  })

  it("keeps default attribute writes mutation-only after the live property becomes dirty", () => {
    const {document, input} = connectedInput()
    const mutations: MutationBatch[] = []
    const states: StateChangeBatch[] = []
    document.subscribeMutations(batch => mutations.push(batch))
    document.subscribeStateChanges(batch => states.push(batch))

    input.setAttribute("value", "seed")
    expect(input.value).toBe("seed")
    expect(mutations).toHaveLength(1)
    expect(states.at(-1)?.records).toMatchObject([{
      property: "value",
      oldValue: "",
      newValue: "seed"
    }])

    states.length = 0
    mutations.length = 0
    input.value = "seed"
    expect(states.at(-1)?.records).toMatchObject([{
      property: "selection",
      oldValue: {start: 0, end: 0},
      newValue: {start: 4, end: 4}
    }])
    states.length = 0
    input.defaultValue = "next-default"
    expect(input.value).toBe("seed")
    expect(input.defaultValue).toBe("next-default")
    expect(mutations).toHaveLength(1)
    expect(states).toEqual([])

    input.defaultChecked = true
    expect(input.checked).toBe(true)
    expect(states.at(-1)?.records).toMatchObject([{
      property: "checked",
      oldValue: false,
      newValue: true
    }])
    states.length = 0
    input.checked = true
    expect(states).toEqual([])
    input.defaultChecked = false
    expect(input.checked).toBe(true)
    expect(states).toEqual([])
  })

  it("records attribute-driven fallback changes only when effective live state changes", () => {
    const {document, root} = connectedInput()
    const fallback = document.createElement("input")
    const states: StateChangeBatch[] = []
    root.append(fallback)
    document.subscribeStateChanges(batch => states.push(batch))

    fallback.type = "checkbox"
    expect(fallback.value).toBe("on")
    expect(states.at(-1)?.records).toMatchObject([{
      property: "value",
      oldValue: "",
      newValue: "on"
    }])

    states.length = 0
    fallback.setAttribute("type", "radio")
    expect(fallback.value).toBe("on")
    expect(states).toEqual([])
    fallback.setAttribute("value", "custom")
    expect(states.at(-1)?.records).toMatchObject([{
      property: "value",
      oldValue: "on",
      newValue: "custom"
    }])

    states.length = 0
    fallback.removeAttribute("value")
    expect(fallback.value).toBe("on")
    expect(states.at(-1)?.records).toMatchObject([{
      property: "value",
      oldValue: "custom",
      newValue: "on"
    }])
  })

  it("retains detached live state without publishing a Document record", () => {
    const {document, root} = connectedInput()
    const detached = document.createElement("input")
    const states: StateChangeBatch[] = []
    document.subscribeStateChanges(batch => states.push(batch))

    detached.value = "detached"
    detached.checked = true
    expect(states).toEqual([])
    root.append(detached)
    detached.value = "detached"
    detached.checked = true
    expect(states).toEqual([])
    detached.value = "connected"
    expect(states).toHaveLength(1)
    expect(states[0]?.records[0]).toMatchObject({
      property: "value",
      oldValue: "detached",
      newValue: "connected"
    })
    expect(states[0]?.records[1]).toMatchObject({
      property: "selection",
      oldValue: {start: 8, end: 8},
      newValue: {start: 9, end: 9}
    })
  })
})
