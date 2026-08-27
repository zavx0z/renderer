import {describe, expect, it} from "bun:test"
import type {
  StateChangeBatch
} from "../src/index.ts"
import {
  Event,
  ToggleEvent,
  createDocument,
  getPopoverVisibilityState
} from "../src/index.ts"

function nextTask(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 5))
}

function expectDOMError(callback: () => unknown, name: string): void {
  try {
    callback()
    throw new Error(`Expected ${name}`)
  } catch (error) {
    expect((error as Error).name).toBe(name)
  }
}

describe("ToggleEvent", () => {
  it("extends Event with standard readonly constructor data", () => {
    const document = createDocument()
    const source = document.createElement("button")
    const defaults = new ToggleEvent("toggle")
    const event = new ToggleEvent("beforetoggle", {
      bubbles: true,
      cancelable: true,
      composed: true,
      oldState: "closed",
      newState: "open",
      source
    })

    expect(defaults).toBeInstanceOf(ToggleEvent)
    expect(defaults).toBeInstanceOf(Event)
    expect(defaults.oldState).toBe("")
    expect(defaults.newState).toBe("")
    expect(defaults.source).toBeNull()
    expect(event.oldState).toBe("closed")
    expect(event.newState).toBe("open")
    expect(event.source).toBe(source)
    expect(event.bubbles).toBe(true)
    expect(event.cancelable).toBe(true)
    expect(event.composed).toBe(true)
  })
})

describe("HTMLElement popover reflection and validity", () => {
  it("reflects the bounded auto/manual/null states without eager instance state", () => {
    const document = createDocument()
    const popover = document.createElement("div")
    const ownProperties = Object.getOwnPropertyNames(popover)

    expect(popover.popover).toBeNull()
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    popover.popover = ""
    expect(popover.popover).toBe("auto")
    expect(popover.getAttribute("popover")).toBe("")
    popover.popover = "AUTO"
    expect(popover.popover).toBe("auto")
    expect(popover.getAttribute("popover")).toBe("AUTO")
    popover.popover = "manual"
    expect(popover.popover).toBe("manual")
    popover.popover = "unknown-mode"
    expect(popover.popover).toBe("manual")
    expect(popover.getAttribute("popover")).toBe("unknown-mode")
    popover.popover = null
    expect(popover.popover).toBeNull()
    expect(popover.hasAttribute("popover")).toBe(false)
    expect(Object.getOwnPropertyNames(popover)).toEqual(ownProperties)
  })

  it("throws standard validity errors and keeps same-state calls as no-ops", async () => {
    const document = createDocument()
    const root = document.createElement("div")
    const popover = document.createElement("div")
    popover.popover = "auto"

    expectDOMError(() => popover.showPopover(), "InvalidStateError")
    expect(() => popover.hidePopover()).not.toThrow()
    expectDOMError(() => popover.togglePopover(false), "InvalidStateError")

    root.append(popover)
    document.append(root)
    popover.popover = null
    expectDOMError(() => popover.showPopover(), "NotSupportedError")
    expectDOMError(() => popover.hidePopover(), "NotSupportedError")
    expectDOMError(() => popover.togglePopover(), "NotSupportedError")

    popover.popover = "manual"
    expect(() => popover.hidePopover()).not.toThrow()
    expect(popover.togglePopover(true)).toBe(true)
    expect(popover.togglePopover(true)).toBe(true)
    expect(popover[getPopoverVisibilityState]()).toBe("showing")
    expect(popover.togglePopover(false)).toBe(false)
    expect(popover.togglePopover(false)).toBe(false)
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    await nextTask()
  })

  it("validates method option dictionaries and exact-realm sources", () => {
    const document = createDocument()
    const popover = document.createElement("div")
    popover.popover = "manual"
    document.append(popover)

    expect(() => popover.showPopover([] as never)).toThrow(TypeError)
    expect(() => popover.showPopover({source: {} as never})).toThrow(TypeError)
    expect(() => popover.togglePopover({source: {} as never})).toThrow(TypeError)
  })
})

describe("popover transitions", () => {
  it("cancels only opening beforetoggle and queues non-bubbling toggle", async () => {
    const document = createDocument()
    const root = document.createElement("div")
    const source = document.createElement("button")
    const popover = document.createElement("div")
    const stateBatches: StateChangeBatch[] = []
    const events: Array<{
      cancelable: boolean
      current: string
      newState: string
      oldState: string
      source: unknown
      type: string
    }> = []
    let cancelOpening = true
    popover.popover = "manual"
    root.append(source, popover)
    document.append(root)
    document.subscribeStateChanges(batch => stateBatches.push(batch))

    root.addEventListener("beforetoggle", event => {
      const toggle = event as ToggleEvent
      events.push({
        cancelable: toggle.cancelable,
        current: "capture",
        newState: toggle.newState,
        oldState: toggle.oldState,
        source: toggle.source,
        type: toggle.type
      })
    }, {capture: true})
    root.addEventListener("beforetoggle", () => events.push({
      cancelable: false,
      current: "bubble",
      newState: "",
      oldState: "",
      source: null,
      type: "beforetoggle"
    }))
    root.addEventListener("toggle", event => {
      const toggle = event as ToggleEvent
      events.push({
        cancelable: toggle.cancelable,
        current: "capture",
        newState: toggle.newState,
        oldState: toggle.oldState,
        source: toggle.source,
        type: toggle.type
      })
    }, {capture: true})
    popover.addEventListener("beforetoggle", event => {
      const toggle = event as ToggleEvent
      events.push({
        cancelable: toggle.cancelable,
        current: "target",
        newState: toggle.newState,
        oldState: toggle.oldState,
        source: toggle.source,
        type: toggle.type
      })
      if (cancelOpening && toggle.newState === "open") {
        cancelOpening = false
        event.preventDefault()
      }
    })
    popover.addEventListener("toggle", event => {
      const toggle = event as ToggleEvent
      events.push({
        cancelable: toggle.cancelable,
        current: "target",
        newState: toggle.newState,
        oldState: toggle.oldState,
        source: toggle.source,
        type: toggle.type
      })
      event.preventDefault()
    })

    popover.showPopover({source})
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    expect(stateBatches).toEqual([])
    await nextTask()
    expect(events.map(event => event.current)).toEqual(["capture", "target"])
    expect(events.every(event => event.cancelable)).toBe(true)

    events.length = 0
    popover.showPopover({source})
    expect(popover[getPopoverVisibilityState]()).toBe("showing")
    expect(stateBatches).toHaveLength(1)
    expect(stateBatches[0]?.records).toEqual([{
      type: "popover",
      target: popover,
      property: "open",
      oldValue: false,
      newValue: true
    }])
    await nextTask()
    expect(events.map(event => `${event.current}:${event.type}`)).toEqual([
      "capture:beforetoggle",
      "target:beforetoggle",
      "capture:toggle",
      "target:toggle"
    ])
    expect(events[2]).toMatchObject({
      cancelable: false,
      newState: "open",
      oldState: "closed",
      source
    })
    expect(events.some(event => event.current === "bubble")).toBe(false)

    events.length = 0
    popover.hidePopover()
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    expect(stateBatches).toHaveLength(2)
    expect(stateBatches[1]?.records).toEqual([{
      type: "popover",
      target: popover,
      property: "open",
      oldValue: true,
      newValue: false
    }])
    await nextTask()
    expect(events.map(event => `${event.current}:${event.type}`)).toEqual([
      "capture:beforetoggle",
      "target:beforetoggle",
      "capture:toggle",
      "target:toggle"
    ])
    expect(events[0]).toMatchObject({
      cancelable: false,
      newState: "closed",
      oldState: "open",
      source: null
    })
  })

  it("keeps manual popovers and ancestor auto popovers while closing unrelated auto peers", async () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = document.createElement("div")
    const second = document.createElement("div")
    const manual = document.createElement("div")
    const nested = document.createElement("div")
    const batches: StateChangeBatch[] = []
    first.popover = "auto"
    second.popover = "auto"
    manual.popover = "manual"
    nested.popover = "auto"
    first.append(nested)
    root.append(first, second, manual)
    document.append(root)
    document.subscribeStateChanges(batch => batches.push(batch))

    first.showPopover()
    await nextTask()
    nested.showPopover()
    expect(first[getPopoverVisibilityState]()).toBe("showing")
    expect(nested[getPopoverVisibilityState]()).toBe("showing")
    manual.showPopover()
    expect(manual[getPopoverVisibilityState]()).toBe("showing")
    await nextTask()

    second.showPopover()
    expect(first[getPopoverVisibilityState]()).toBe("hidden")
    expect(nested[getPopoverVisibilityState]()).toBe("hidden")
    expect(second[getPopoverVisibilityState]()).toBe("showing")
    expect(manual[getPopoverVisibilityState]()).toBe("showing")
    expect(batches.at(-1)?.records.map(record => record.target)).toEqual([
      nested,
      first,
      second
    ])
    await nextTask()
  })

  it("closes on mode changes and subtree removal without top-layer or focus fabrication", async () => {
    const document = createDocument()
    const root = document.createElement("div")
    const popover = document.createElement("div")
    const events: string[] = []
    const batches: StateChangeBatch[] = []
    popover.popover = "manual"
    root.append(popover)
    document.append(root)
    document.subscribeStateChanges(batch => batches.push(batch))
    popover.addEventListener("beforetoggle", event => {
      events.push(`${event.type}:${(event as ToggleEvent).newState}`)
    })
    popover.addEventListener("toggle", event => {
      events.push(`${event.type}:${(event as ToggleEvent).newState}`)
    })

    popover.showPopover()
    await nextTask()
    events.length = 0
    popover.popover = "auto"
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    expect(events).toEqual(["beforetoggle:closed"])
    await nextTask()
    expect(events).toEqual(["beforetoggle:closed", "toggle:closed"])

    popover.showPopover()
    await nextTask()
    events.length = 0
    root.remove()
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    expect(events).toEqual([])
    expect(document.activeElement).toBeNull()
    expect("topLayer" in document).toBe(false)
    expect("popoverOpen" in popover).toBe(false)
    expect(batches.at(-1)?.records).toEqual([{
      type: "popover",
      target: popover,
      property: "open",
      oldValue: true,
      newValue: false
    }])
    await nextTask()
    expect(events).toEqual([])
  })

  it("coalesces state records and queued toggle tasks independently", async () => {
    const document = createDocument()
    const popover = document.createElement("div")
    const batches: StateChangeBatch[] = []
    const toggles: ToggleEvent[] = []
    popover.popover = "manual"
    document.append(popover)
    document.subscribeStateChanges(batch => batches.push(batch))
    popover.addEventListener("toggle", event => toggles.push(event as ToggleEvent))

    document.transaction(() => {
      popover.showPopover()
      popover.hidePopover()
      popover.showPopover()
    })

    expect(batches).toHaveLength(1)
    expect(batches[0]?.records).toEqual([{
      type: "popover",
      target: popover,
      property: "open",
      oldValue: false,
      newValue: true
    }])
    expect(toggles).toEqual([])
    await nextTask()
    expect(toggles).toHaveLength(1)
    expect(toggles[0]).toMatchObject({oldState: "closed", newState: "open"})
  })
})
