import {describe, expect, test} from "bun:test"
import {
  CompositionEvent as SemanticCompositionEvent,
  InputEvent as SemanticInputEvent,
  KeyboardEvent as SemanticKeyboardEvent,
  createDocument,
  getPopoverVisibilityState,
} from "@zavx0z/dom"
import {createDocumentNativeInputHost} from "../src/index.ts"
import {
  createDocumentNativeInputHostWithSeams,
  type DocumentNativeInputHostSeams,
} from "../src/native-input-host.ts"

describe("DocumentNativeInputHost", () => {
  test("owns one input, select and textarea proxy and switches exact semantic Documents", () => {
    const harness = createHarness()
    let frames = 0
    const host = createDocumentNativeInputHostWithSeams({
      requestFrame() { frames += 1 },
    }, harness.seams)
    const inputDocument = createDocument()
    const input = inputDocument.createElement("input")
    input.type = "search"
    input.value = "output"
    input.setSelectionRange(2, 5, "forward")
    inputDocument.appendChild(input)
    input.focus()

    host.setActiveDocument(inputDocument, "input-plane")
    expect(host.nativeInput).toBe(harness.input.element as HTMLInputElement)
    expect(host.nativeTextArea).toBe(harness.textarea.element as HTMLTextAreaElement)
    expect(host.document).toBe(inputDocument)
    expect(host.ownerId).toBe("input-plane")
    expect(host.inputTarget).toBe(input)
    expect(host.activeProxy).toBe("input")
    expect(harness.input).toMatchObject({
      type: "search",
      value: "output",
      readOnly: false,
      disabled: false,
      selectionStart: 2,
      selectionEnd: 5,
      selectionDirection: "forward",
      focused: true,
    })
    expect(harness.textarea.focused).toBeFalse()

    const textareaDocument = createDocument()
    const textarea = textareaDocument.createElement("textarea")
    textarea.value = "first\nsecond"
    textarea.readOnly = true
    textarea.setSelectionRange(1, 8, "backward")
    textareaDocument.appendChild(textarea)
    textarea.focus()
    host.setActiveDocument(textareaDocument, "textarea-plane")

    expect(inputDocument.activeElement).toBeNull()
    expect(host.document).toBe(textareaDocument)
    expect(host.ownerId).toBe("textarea-plane")
    expect(host.inputTarget).toBe(textarea)
    expect(host.activeProxy).toBe("textarea")
    expect(harness.input.focused).toBeFalse()
    expect(harness.textarea).toMatchObject({
      value: "first\nsecond",
      readOnly: true,
      selectionStart: 1,
      selectionEnd: 8,
      selectionDirection: "backward",
      focused: true,
    })

    host.setActiveDocument(textareaDocument, "second-view-of-same-document")
    expect(textareaDocument.activeElement).toBe(textarea)
    expect(host.ownerId).toBe("second-view-of-same-document")
    expect(frames).toBe(0)
    host.dispose()
  })

  test("routes keyboard, beforeinput, input and composition once to an active input", () => {
    const harness = createHarness()
    const host = createDocumentNativeInputHostWithSeams({requestFrame() {}}, harness.seams)
    const document = createDocument()
    const input = document.createElement("input")
    input.value = "seed"
    input.setSelectionRange(1, 3, "forward")
    document.appendChild(input)
    input.focus()
    host.setActiveDocument(document, "plane")
    const events: string[] = []
    let valueAtInput = ""
    let selectionAtInput: unknown = null
    input.addEventListener("keydown", (event) => {
      expect(event).toBeInstanceOf(SemanticKeyboardEvent)
      events.push(event.type)
      event.preventDefault()
    })
    input.addEventListener("keyup", (event) => {
      expect(event).toBeInstanceOf(SemanticKeyboardEvent)
      events.push(event.type)
    })
    input.addEventListener("beforeinput", (event) => {
      expect(event).toBeInstanceOf(SemanticInputEvent)
      events.push(event.type)
      event.preventDefault()
    })
    input.addEventListener("input", (event) => {
      expect(event).toBeInstanceOf(SemanticInputEvent)
      events.push(event.type)
      valueAtInput = input.value
      selectionAtInput = [input.selectionStart, input.selectionEnd, input.selectionDirection]
    })
    for (const type of ["compositionstart", "compositionupdate", "compositionend"]) {
      input.addEventListener(type, (event) => {
        expect(event).toBeInstanceOf(SemanticCompositionEvent)
        events.push(type)
      })
    }

    let prevented = 0
    harness.input.emit("keydown", nativeKeyboard({
      key: "a",
      code: "KeyA",
      preventDefault() { prevented += 1 },
    }))
    harness.input.emit("keyup", nativeKeyboard({key: "a", code: "KeyA"}))
    harness.input.emit("beforeinput", nativeInput({
      data: "x",
      inputType: "insertText",
      cancelable: true,
      preventDefault() { prevented += 1 },
    }))
    harness.input.emit("compositionstart", nativeComposition({data: ""}))
    harness.input.emit("compositionupdate", nativeComposition({data: "候補"}))
    harness.input.emit("compositionend", nativeComposition({data: "候補"}))
    harness.input.value = "seedx"
    harness.input.setSelectionRange(2, 5, "backward")
    harness.input.emit("input", nativeInput({data: "x", inputType: "insertText"}))

    expect(prevented).toBe(2)
    expect(input.value).toBe("seedx")
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection])
      .toEqual([2, 5, "backward"])
    expect(valueAtInput).toBe("seedx")
    expect(selectionAtInput).toEqual([2, 5, "backward"])
    expect(events).toEqual([
      "keydown",
      "keyup",
      "beforeinput",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "input",
    ])
    host.dispose()
  })

  test("rolls a canceled native input value and selection back atomically", () => {
    const harness = createHarness()
    const host = createDocumentNativeInputHostWithSeams({requestFrame() {}}, harness.seams)
    const document = createDocument()
    const input = document.createElement("input")
    input.value = "accepted"
    input.setSelectionRange(1, 4, "forward")
    document.appendChild(input)
    input.focus()
    host.setActiveDocument(document)
    const stateBatches: unknown[] = []
    document.subscribeStateChanges((batch) => stateBatches.push(batch))
    input.addEventListener("input", (event) => event.preventDefault())
    let prevented = 0

    harness.input.value = "rejected"
    harness.input.setSelectionRange(2, 8, "backward")
    harness.input.emit("input", nativeInput({
      data: "!",
      inputType: "insertText",
      cancelable: true,
      preventDefault() { prevented += 1 },
    }))

    expect(prevented).toBe(1)
    expect(input.value).toBe("accepted")
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection])
      .toEqual([1, 4, "forward"])
    expect(harness.input.value).toBe("accepted")
    expect([harness.input.selectionStart, harness.input.selectionEnd, harness.input.selectionDirection])
      .toEqual([1, 4, "forward"])
    expect(stateBatches).toEqual([])
    host.dispose()
  })

  test("mirrors textarea input and native select/selection changes without extra input events", () => {
    const harness = createHarness()
    let frames = 0
    const host = createDocumentNativeInputHostWithSeams({
      requestFrame() { frames += 1 },
    }, harness.seams)
    const document = createDocument()
    const textarea = document.createElement("textarea")
    textarea.value = "alpha\nbeta"
    document.appendChild(textarea)
    textarea.focus()
    host.setActiveDocument(document, "textarea")
    let inputs = 0
    let selects = 0
    textarea.addEventListener("input", () => { inputs += 1 })
    textarea.addEventListener("select", () => { selects += 1 })

    harness.textarea.value = "next\nvalue"
    harness.textarea.setSelectionRange(2, 7, "forward")
    harness.textarea.emit("input", nativeInput({data: "v", inputType: "insertText"}))
    expect(textarea.value).toBe("next\nvalue")
    expect([textarea.selectionStart, textarea.selectionEnd, textarea.selectionDirection])
      .toEqual([2, 7, "forward"])
    expect(inputs).toBe(1)

    harness.textarea.setSelectionRange(1, 4, "backward")
    harness.textarea.emit("select", {type: "select"})
    expect([textarea.selectionStart, textarea.selectionEnd, textarea.selectionDirection])
      .toEqual([1, 4, "backward"])
    expect(selects).toBe(1)
    expect(inputs).toBe(1)
    expect(frames).toBe(1)

    harness.textarea.setSelectionRange(0, 2, "none")
    harness.selectionTarget.emit("selectionchange", {type: "selectionchange"})
    expect([textarea.selectionStart, textarea.selectionEnd, textarea.selectionDirection])
      .toEqual([0, 2, "none"])
    expect(selects).toBe(1)
    expect(frames).toBe(2)
    host.dispose()
  })

  test("copies the exact mirrored readonly textarea selection and honors semantic cancellation", () => {
    const harness = createHarness()
    const host = createDocumentNativeInputHostWithSeams({requestFrame() {}}, harness.seams)
    const document = createDocument()
    const textArea = document.createElement("textarea")
    textArea.value = "copy selected text"
    textArea.readOnly = true
    textArea.setSelectionRange(5, 13, "forward")
    document.appendChild(textArea)
    textArea.focus()
    host.setActiveDocument(document, "readonly-editor")
    const events: string[] = []
    textArea.addEventListener("copy", event => events.push(`${event.type}:${event.cancelable}`))

    expect(harness.textarea.copySelection()).toBe("selected")
    expect(events).toEqual(["copy:true"])
    textArea.addEventListener("copy", event => event.preventDefault(), {once: true})
    expect(harness.textarea.copySelection()).toBeNull()
    expect(events).toEqual(["copy:true", "copy:true"])
    host.dispose()
  })

  test("uses a read-only keyboard host without mirroring non-text control state", () => {
    const harness = createHarness()
    const host = createDocumentNativeInputHostWithSeams({requestFrame() {}}, harness.seams)
    const document = createDocument()
    const checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    document.appendChild(checkbox)
    checkbox.focus()
    host.setActiveDocument(document, "plane")
    expect(document.activeElement).toBe(checkbox)
    expect(host.inputTarget).toBe(checkbox)
    expect(host.activeProxy).toBe("input")
    expect(harness.input).toMatchObject({type: "text", value: "", readOnly: true, focused: true})

    checkbox.type = "email"
    host.synchronize()
    expect(host.inputTarget).toBe(checkbox)
    expect(harness.input).toMatchObject({type: "text", value: "", readOnly: true, focused: true})
    checkbox.type = "text"
    host.synchronize()
    expect(host.inputTarget).toBe(checkbox)
    expect(harness.input.focused).toBeTrue()
    host.dispose()
  })

  test("routes cancellable Escape through a generic focused owner and restores popover focus", () => {
    const harness = createHarness()
    let frames = 0
    const host = createDocumentNativeInputHostWithSeams({
      requestFrame() { frames += 1 },
    }, harness.seams)
    const document = createDocument()
    const root = document.createElement("div")
    const source = document.createElement("button")
    const popover = document.createElement("div")
    const inside = document.createElement("button")
    popover.popover = "auto"
    popover.appendChild(inside)
    root.append(source, popover)
    document.appendChild(root)
    source.focus()
    popover.showPopover({source})
    inside.focus()
    host.setActiveDocument(document, "popover")
    const keys: string[] = []
    inside.addEventListener("keydown", event => keys.push((event as SemanticKeyboardEvent).key))
    let prevented = 0

    expect(host.inputTarget).toBe(inside)
    expect(host.activeProxy).toBe("input")
    expect(harness.input).toMatchObject({type: "text", value: "", readOnly: true, focused: true})
    harness.input.emit("keydown", nativeKeyboard({
      key: "Escape",
      preventDefault() { prevented += 1 },
    }))
    expect(keys).toEqual(["Escape"])
    expect(prevented).toBe(1)
    expect(popover[getPopoverVisibilityState]()).toBe("hidden")
    expect(document.activeElement).toBe(source)
    expect(host.inputTarget).toBe(source)
    expect(frames).toBe(1)

    popover.showPopover({source})
    inside.focus()
    inside.addEventListener("keydown", event => event.preventDefault(), {once: true})
    harness.input.emit("keydown", nativeKeyboard({
      key: "Escape",
      preventDefault() { prevented += 1 },
    }))
    expect(prevented).toBe(2)
    expect(popover[getPopoverVisibilityState]()).toBe("showing")
    popover.hidePopover()
    host.dispose()
  })

  test("mirrors number and range values without fabricating text selection", () => {
    const harness = createHarness()
    const host = createDocumentNativeInputHostWithSeams({requestFrame() {}}, harness.seams)
    const document = createDocument()
    const input = document.createElement("input")
    input.type = "number"
    input.valueAsNumber = 12.5
    input.min = "-10"
    input.max = "100"
    input.step = "0.25"
    document.appendChild(input)
    input.focus()
    host.setActiveDocument(document, "numeric")
    const events: string[] = []
    input.addEventListener("keydown", event => events.push(`keydown:${(event as SemanticKeyboardEvent).key}`))
    input.addEventListener("input", () => events.push(`input:${input.value}`))
    input.addEventListener("change", () => events.push(`change:${input.value}`))

    expect(host.inputTarget).toBe(input)
    expect(host.activeProxy).toBe("input")
    expect(harness.input).toMatchObject({
      type: "number",
      value: "12.5",
      min: "-10",
      max: "100",
      step: "0.25",
      focused: true,
    })
    let numberPrevented = 0
    harness.input.emit("keydown", nativeKeyboard({
      key: "ArrowUp",
      preventDefault() { numberPrevented += 1 },
    }))
    harness.input.applyArrowDefault("ArrowUp")
    harness.input.emit("change", {type: "change"})
    expect(numberPrevented).toBe(0)
    expect(input.valueAsNumber).toBe(12.75)
    expect(events).toEqual(["keydown:ArrowUp", "input:12.75", "change:12.75"])
    events.length = 0
    harness.input.value = "42.25"
    harness.input.emit("input", nativeInput({inputType: "insertText"}))
    harness.input.emit("change", {type: "change"})
    expect(input.valueAsNumber).toBe(42.25)
    expect(events).toEqual(["input:42.25", "change:42.25"])

    input.type = "range"
    input.min = "0"
    input.max = "10"
    input.step = "2"
    host.synchronize()
    expect(harness.input).toMatchObject({type: "range", min: "0", max: "10", step: "2"})
    let prevented = 0
    harness.input.emit("keydown", nativeKeyboard({
      key: "ArrowRight",
      preventDefault() { prevented += 1 },
    }))
    expect(input.valueAsNumber).toBe(10)
    expect(prevented).toBe(1)
    input.valueAsNumber = 4
    host.synchronize()
    harness.input.value = "9"
    harness.input.emit("input", nativeInput())
    expect(input.valueAsNumber).toBe(10)
    expect(harness.input.value).toBe("10")
    host.dispose()
  })

  test("uses the select proxy as a keyboard host for the in-canvas picker", () => {
    const harness = createHarness()
    let frames = 0
    const host = createDocumentNativeInputHostWithSeams({requestFrame() { frames += 1 }}, harness.seams)
    const document = createDocument()
    const select = document.createElement("select")
    const first = document.createElement("option")
    const disabled = document.createElement("option")
    const third = document.createElement("option")
    first.value = "first"
    disabled.value = "disabled"
    disabled.disabled = true
    third.value = "third"
    select.append(first, disabled, third)
    document.appendChild(select)
    select.focus()
    host.setActiveDocument(document, "select")
    const events: string[] = []
    select.addEventListener("input", () => events.push(`input:${select.value}`))
    select.addEventListener("change", () => events.push(`change:${select.value}`))
    let prevented = 0

    expect(host.inputTarget).toBe(select)
    expect(host.activeProxy).toBe("select")
    expect(harness.select.focused).toBeTrue()
    harness.select.emit("keydown", nativeKeyboard({
      key: "ArrowDown",
      preventDefault() { prevented += 1 },
    }))
    expect(select.value).toBe("third")
    expect(events).toEqual(["input:third", "change:third"])
    harness.select.emit("keydown", nativeKeyboard({
      key: " ",
      preventDefault() { prevented += 1 },
    }))
    expect(select.pickerVisibilityState).toBe("open")
    harness.select.emit("keydown", nativeKeyboard({
      key: "Escape",
      preventDefault() { prevented += 1 },
    }))
    expect(select.pickerVisibilityState).toBe("closed")
    expect(prevented).toBe(3)
    expect(frames).toBe(3)
    host.dispose()
  })

  test("blurs on deactivation and removes both proxies and every listener", () => {
    const harness = createHarness()
    let frames = 0
    const host = createDocumentNativeInputHostWithSeams({
      requestFrame() { frames += 1 },
    }, harness.seams)
    const document = createDocument()
    const input = document.createElement("input")
    document.appendChild(input)
    input.focus()
    host.setActiveDocument(document, "plane")

    host.blur()
    expect(document.activeElement).toBeNull()
    expect(host.inputTarget).toBeNull()
    expect(frames).toBe(1)
    host.setActiveDocument(null)
    host.dispose()
    host.dispose()
    expect(host.document).toBeNull()
    expect(host.ownerId).toBeNull()
    expect(harness.input.removed).toBeTrue()
    expect(harness.select.removed).toBeTrue()
    expect(harness.textarea.removed).toBeTrue()
    expect(harness.input.listenerCount()).toBe(0)
    expect(harness.select.listenerCount()).toBe(0)
    expect(harness.textarea.listenerCount()).toBe(0)
    expect(harness.selectionTarget.listenerCount()).toBe(0)
    expect(() => host.setActiveDocument(document)).toThrow("disposed")
  })

  test("publishes one exact browser factory with no semantic activation copy", async () => {
    const source = await Bun.file(new URL("../src/native-input-host.ts", import.meta.url)).text()
    const index = await Bun.file(new URL("../src/index.ts", import.meta.url)).text()

    expect(index).toContain('export {createDocumentNativeInputHost} from "./native-input-host.ts"')
    expect(source.match(/browserDocument\.createElement\("input"\)/gu)).toHaveLength(1)
    expect(source.match(/browserDocument\.createElement\("select"\)/gu)).toHaveLength(1)
    expect(source.match(/browserDocument\.createElement\("textarea"\)/gu)).toHaveLength(1)
    expect(source).toContain("SemanticHTMLInputElement")
    expect(source).toContain("SemanticHTMLTextAreaElement")
    for (const forbidden of [
      "checked =",
      "indeterminate =",
      "new MouseEvent",
      "@layout/core",
      "UiSurface",
      "cloneNode",
      "innerHTML",
    ]) expect(source).not.toContain(forbidden)
  })
})

function createHarness() {
  const input = new FakeTextProxy("input")
  const select = new FakeTextProxy("select")
  const textarea = new FakeTextProxy("textarea")
  const selectionTarget = new FakeEventTarget()
  const seams: DocumentNativeInputHostSeams = Object.freeze({
    createProxies: () => ({
      input: input.element as HTMLInputElement,
      select: select.element as unknown as HTMLSelectElement,
      textarea: textarea.element as HTMLTextAreaElement,
      selectionTarget,
    }),
  })
  return {input, select, textarea, selectionTarget, seams}
}

class FakeEventTarget {
  readonly #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) return
    const listeners = this.#listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(type, listeners)
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener !== null) this.#listeners.get(type)?.delete(listener)
  }
  emit(type: string, event: unknown): void {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) {
      if (typeof listener === "function") listener(event as Event)
      else listener.handleEvent(event as Event)
    }
  }
  dispatchEvent(event: Event): boolean {
    this.emit(event.type, event)
    return !event.defaultPrevented
  }
  listenerCount(): number {
    return [...this.#listeners.values()].reduce((total, listeners) => total + listeners.size, 0)
  }
}

class FakeTextProxy extends FakeEventTarget {
  readonly element = this as unknown as HTMLInputElement | HTMLTextAreaElement
  readonly style: Record<string, string> = {}
  type = "text"
  value = ""
  readOnly = false
  disabled = false
  min = ""
  max = ""
  step = ""
  selectionStart = 0
  selectionEnd = 0
  selectionDirection: "forward" | "backward" | "none" = "none"
  focused = false
  removed = false
  tabIndex = -1
  autocomplete = ""
  readonly attributes = new Map<string, string>()

  constructor(readonly kind: "input" | "select" | "textarea") {
    super()
  }

  setAttribute(name: string, value: string): void { this.attributes.set(name, value) }
  focus(): void { this.focused = true }
  blur(): void {
    if (!this.focused) return
    this.focused = false
    this.emit("blur", {type: "blur"})
  }
  remove(): void { this.removed = true }
  setSelectionRange(start: number, end: number, direction: "forward" | "backward" | "none" = "none"): void {
    this.selectionStart = Math.max(0, Math.min(this.value.length, start))
    this.selectionEnd = Math.max(this.selectionStart, Math.min(this.value.length, end))
    this.selectionDirection = direction
  }

  applyArrowDefault(key: "ArrowDown" | "ArrowUp"): void {
    const step = Number(this.step) > 0 ? Number(this.step) : 1
    const minimum = this.min === "" ? Number.NEGATIVE_INFINITY : Number(this.min)
    const maximum = this.max === "" ? Number.POSITIVE_INFINITY : Number(this.max)
    const current = Number(this.value)
    const next = Math.max(
      minimum,
      Math.min(maximum, current + (key === "ArrowUp" ? step : -step)),
    )
    this.value = String(next)
    this.emit("input", nativeInput({inputType: "stepUp"}))
  }

  copySelection(): string | null {
    let prevented = false
    this.emit("copy", {
      type: "copy",
      cancelable: true,
      preventDefault() { prevented = true },
    })
    return prevented
      ? null
      : this.value.slice(this.selectionStart, this.selectionEnd)
  }
}

function nativeKeyboard(values: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key: "",
    code: "",
    location: 0,
    repeat: false,
    isComposing: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    cancelable: true,
    preventDefault() {},
    getModifierState: () => false,
    ...values,
  } as KeyboardEvent
}

function nativeInput(values: Partial<InputEvent> = {}): InputEvent {
  return {
    data: null,
    inputType: "",
    isComposing: false,
    cancelable: false,
    preventDefault() {},
    ...values,
  } as InputEvent
}

function nativeComposition(values: Partial<CompositionEvent> = {}): CompositionEvent {
  return {
    data: "",
    cancelable: false,
    preventDefault() {},
    ...values,
  } as CompositionEvent
}
