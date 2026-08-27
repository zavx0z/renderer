import {describe, expect, it} from "bun:test"
import type {
  MutationBatch,
  StateChangeBatch
} from "../src/index.ts"
import {
  HTMLOptionElement,
  HTMLSelectElement,
  HTMLElement,
  NodeList,
  createDocument
} from "../src/index.ts"

describe("select and option factories and reflection", () => {
  it("creates exact classes and reflects practical attributes", () => {
    const document = createDocument()
    const select = document.createElement("select")
    const option = document.createElement("option")

    expect(select).toBeInstanceOf(HTMLSelectElement)
    expect(select).toBeInstanceOf(HTMLElement)
    expect(option).toBeInstanceOf(HTMLOptionElement)
    expect(option).toBeInstanceOf(HTMLElement)

    expect(select.disabled).toBe(false)
    expect(select.multiple).toBe(false)
    expect(select.size).toBe(0)
    select.disabled = true
    select.multiple = true
    select.size = 4
    expect(select.getAttribute("disabled")).toBe("")
    expect(select.getAttribute("multiple")).toBe("")
    expect(select.getAttribute("size")).toBe("4")

    option.append("  First \n option  ")
    expect(option.label).toBe("First option")
    expect(option.value).toBe("First option")
    option.label = "Visible"
    option.value = "first"
    option.disabled = true
    option.defaultSelected = true
    expect(option.label).toBe("Visible")
    expect(option.value).toBe("first")
    expect(option.disabled).toBe(true)
    expect(option.defaultSelected).toBe(true)
    option.label = ""
    expect(option.label).toBe("First option")
  })

  it("returns a static NodeList over the current option descendants", () => {
    const document = createDocument()
    const select = document.createElement("select")
    const first = document.createElement("option")
    const wrapper = document.createElement("div")
    const second = document.createElement("option")
    const nestedSelect = document.createElement("select")
    const nestedOption = document.createElement("option")
    wrapper.append(second)
    nestedSelect.append(nestedOption)
    select.append(first, wrapper, nestedSelect)

    const snapshot = select.options
    expect(snapshot).toBeInstanceOf(NodeList)
    expect(snapshot.item(0)).toBe(first)
    expect(snapshot[1]).toBe(second)
    expect([...snapshot]).toEqual([first, second])
    expect(snapshot.length).toBe(2)

    second.remove()
    const third = document.createElement("option")
    select.append(third)
    expect(snapshot.length).toBe(2)
    expect([...select.options]).toEqual([first, third])
  })
})

describe("select live selection", () => {
  it("normalizes one single-select option with first-option fallback", () => {
    const document = createDocument()
    const select = document.createElement("select")
    const first = document.createElement("option")
    const second = document.createElement("option")
    first.value = "a"
    second.value = "b"
    select.append(first, second)

    expect(select.selectedIndex).toBe(0)
    expect(select.value).toBe("a")
    expect(first.selected).toBe(true)
    expect(second.selected).toBe(false)

    select.selectedIndex = 1
    expect(select.selectedIndex).toBe(1)
    expect(select.value).toBe("b")
    expect(first.selected).toBe(false)
    expect(second.selected).toBe(true)

    select.value = "a"
    expect(select.selectedIndex).toBe(0)
    select.value = "missing"
    expect(select.selectedIndex).toBe(-1)
    expect(select.value).toBe("")

    const third = document.createElement("option")
    third.value = "c"
    select.append(third)
    expect(select.selectedIndex).toBe(0)

    select.value = "c"
    third.remove()
    expect(select.selectedIndex).toBe(0)
    expect(select.value).toBe("a")
  })

  it("keeps the last selected option in single mode and multiple selections in multiple mode", () => {
    const document = createDocument()
    const select = document.createElement("select")
    const first = document.createElement("option")
    const second = document.createElement("option")
    first.value = "a"
    second.value = "b"
    first.defaultSelected = true
    second.defaultSelected = true
    select.append(first, second)
    expect(select.selectedIndex).toBe(1)
    expect(first.selected).toBe(false)
    expect(second.selected).toBe(true)

    select.multiple = true
    first.selected = true
    expect(first.selected).toBe(true)
    expect(second.selected).toBe(true)
    expect(select.selectedIndex).toBe(0)
    expect(select.value).toBe("a")

    select.multiple = false
    expect(first.selected).toBe(false)
    expect(second.selected).toBe(true)
    expect(select.selectedIndex).toBe(1)
  })

  it("keeps live selectedness separate from defaultSelected after dirtiness", () => {
    const document = createDocument()
    const select = document.createElement("select")
    select.multiple = true
    const option = document.createElement("option")
    option.defaultSelected = true
    select.append(option)
    expect(option.selected).toBe(true)

    option.selected = false
    expect(option.selected).toBe(false)
    expect(option.defaultSelected).toBe(true)
    option.defaultSelected = false
    option.defaultSelected = true
    expect(option.selected).toBe(false)
    expect(option.defaultSelected).toBe(true)
  })
})

describe("select state and focus adapters", () => {
  it("publishes coalesced option selectedness without attributes or events", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const select = document.createElement("select")
    const first = document.createElement("option")
    const second = document.createElement("option")
    first.value = "a"
    second.value = "b"
    select.append(first, second)
    root.append(select)
    document.append(root)
    expect(select.selectedIndex).toBe(0)

    const states: StateChangeBatch[] = []
    const mutations: MutationBatch[] = []
    const events: string[] = []
    document.subscribeStateChanges(batch => states.push(batch))
    document.subscribeMutations(batch => mutations.push(batch))
    select.addEventListener("input", event => events.push(event.type))
    select.addEventListener("change", event => events.push(event.type))

    second.selected = true
    expect(states).toHaveLength(1)
    expect(states[0]?.records).toEqual([
      {
        type: "option",
        target: first,
        property: "selected",
        oldValue: true,
        newValue: false
      },
      {
        type: "option",
        target: second,
        property: "selected",
        oldValue: false,
        newValue: true
      }
    ])
    expect(mutations).toEqual([])
    expect(events).toEqual([])

    const version = document.stateVersion
    document.transaction(() => {
      select.selectedIndex = 0
      select.value = "b"
    })
    expect(document.stateVersion).toBe(version)

    const third = document.createElement("option")
    select.multiple = true
    select.append(third)
    states.length = 0
    mutations.length = 0
    third.defaultSelected = true
    expect(mutations.at(-1)?.records[0]?.type).toBe("attributes")
    expect(states).toHaveLength(1)
    expect(events).toEqual([])
  })

  it("is focusable while connected and enabled", () => {
    const document = createDocument()
    const select = document.createElement("select")
    document.append(select)

    expect(select.tabIndex).toBe(0)
    select.focus()
    expect(document.activeElement).toBe(select)
    select.blur()
    select.disabled = true
    select.focus()
    expect(document.activeElement).toBeNull()
  })
})
