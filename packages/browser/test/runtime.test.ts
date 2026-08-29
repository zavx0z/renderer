import {describe, expect, test} from "bun:test"
import {
  Object3D,
  Space,
  type Renderer as EngineRenderer,
  type TrueTypeFont,
  type ViewPoint,
} from "@engine/core"
import {
  CompositionEvent as SemanticCompositionEvent,
  InputEvent as SemanticInputEvent,
  KeyboardEvent as SemanticKeyboardEvent,
  PointerEvent as SemanticPointerEvent,
  createDocument,
  type Node as SemanticNode,
} from "@zavx0z/dom"
import {
  createDocumentInteractionController,
  createDocumentRenderer,
  type DocumentInteractionController,
  type DocumentRenderer,
  type PointerInput,
  type RenderFrame,
  type WheelInput,
} from "@zavx0z/renderer"
import type {
  RendererWebGpuBackend,
  RendererWebGpuBackendOptions,
  RendererWebGpuScreenOverlay,
} from "@zavx0z/renderer-webgpu"
import {
  createDocumentCanvasRuntimeWithSeams,
  type DocumentCanvasRuntimeSeams,
} from "../src/runtime.ts"
import {
  createDocumentNativeInputHostWithSeams,
} from "../src/native-input-host.ts"

describe("document canvas browser runtime", () => {
  test("owns resize, presentation, scheduling, capture, coordinates and cleanup", async () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    const harness = createHarness({left: 10, top: 20, width: 200, height: 100})
    const font = fakeFont()
    const runtime = await createDocumentCanvasRuntimeWithSeams({
      canvas: harness.canvas.element,
      document,
      root,
      styleSheets: ["div { background: #111111; }"],
      font,
      pixelRatio: 2,
      tooltipDelayMs: 25,
      distance: 700,
    }, harness.seams)

    expect(runtime.canvas).toBe(harness.canvas.element)
    expect(runtime.document).toBe(document)
    expect(runtime.root).toBe(root)
    expect(runtime.font).toBe(font)
    expect(runtime.engineRenderer).toBe(harness.engineRenderer)
    expect(runtime.space).toBe(harness.space)
    expect(runtime.viewPoint).toBe(harness.viewPoint)
    expect(runtime.backend).toBe(harness.backend)
    expect(runtime.overlay).toBe(harness.overlay)
    expect(runtime.viewport).toEqual({width: 200, height: 100})
    expect(runtime.currentFrame.viewport).toEqual({width: 200, height: 100})
    expect(harness.calls.initialize).toBe(1)
    expect(harness.calls.pixelRatios).toEqual([2])
    expect(harness.calls.sizes).toEqual([[200, 100]])
    expect(harness.calls.aspects).toEqual([2])
    expect(harness.calls.engineFrames).toHaveLength(1)
    expect(harness.calls.observed).toEqual([harness.canvas.element])

    const observed: RenderFrame[] = []
    const unsubscribe = runtime.subscribe((frame) => observed.push(frame))
    expect(observed).toEqual([runtime.currentFrame])
    runtime.render()
    expect(observed).toHaveLength(2)

    runtime.requestRender()
    runtime.requestRender()
    expect(harness.pendingFrames()).toBe(1)
    harness.flushFrame()
    expect(harness.calls.engineFrames).toHaveLength(3)

    const pointerMove = pointer({clientX: 110, clientY: 70, pointerId: 4})
    harness.canvas.emit("pointermove", pointerMove)
    expect(harness.calls.pointerMoves.at(-1)).toMatchObject({clientX: 100, clientY: 50, pointerId: 4})
    expect(harness.pendingTimers()).toBe(1)
    expect(harness.calls.timerDelays.at(-1)).toBe(26)
    harness.flushTimer()

    harness.canvas.emit("pointerdown", pointer({clientX: 10, clientY: 20, pointerId: 4}))
    expect(harness.canvas.captured.has(4)).toBeTrue()
    harness.canvas.emit("pointerup", pointer({clientX: 10, clientY: 20, pointerId: 4}))
    expect(harness.canvas.captured.has(4)).toBeFalse()

    expect(await runtime.captureLastPresentedFramePng()).toBe(harness.capture)
    expect(harness.calls.captures).toBe(1)

    const firstDocumentRenderer = runtime.documentRenderer
    harness.canvas.rect = {left: 10, top: 20, width: 300, height: 100}
    harness.triggerResize()
    expect(runtime.viewport).toEqual({width: 300, height: 100})
    expect(runtime.documentRenderer).not.toBe(firstDocumentRenderer)
    expect(harness.calls.documentRendererDisposals).toBe(1)
    expect(harness.calls.overlayResizes).toEqual([{width: 300, height: 100}])
    expect(harness.calls.sizes.at(-1)).toEqual([300, 100])
    expect(harness.calls.aspects.at(-1)).toBe(3)

    runtime.requestRender()
    harness.canvas.emit("pointerdown", pointer({clientX: 20, clientY: 30, pointerId: 8}))
    expect(harness.canvas.captured.has(8)).toBeTrue()
    unsubscribe()
    runtime.dispose()
    runtime.dispose()

    expect(runtime.disposed).toBeTrue()
    expect(harness.calls.observerDisconnects).toBe(1)
    expect(harness.calls.cancelledFrames).toHaveLength(1)
    expect(harness.canvas.captured.size).toBe(0)
    expect(harness.canvas.listenerCount()).toBe(0)
    expect(harness.calls.interactionDisposals).toBe(1)
    expect(harness.calls.documentRendererDisposals).toBe(2)
    expect(harness.calls.backendDisposals).toBe(1)
    expect(harness.nativeInput.removed).toBeTrue()
    expect(harness.nativeInput.listenerCount()).toBe(0)
    root.textContent = "after dispose"
    expect(harness.pendingFrames()).toBe(0)
    expect(() => runtime.render()).toThrow("disposed")
    expect(() => runtime.requestRender()).toThrow("disposed")
    expect(() => runtime.resize()).toThrow("disposed")
    expect(() => runtime.captureLastPresentedFramePng()).toThrow("disposed")
  })

  test("delegates native wheel to the stable Core scroll owner before rendering", async () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("div")
    document.appendChild(root)
    root.appendChild(child)
    root.setAttribute(
      "style",
      "width: 100px; height: 50px; overflow-y: auto; background: #111111",
    )
    child.setAttribute("style", "width: 100px; height: 200px; background: #222222")
    const harness = createHarness({left: 0, top: 0, width: 100, height: 50})
    const seams: DocumentCanvasRuntimeSeams = Object.freeze({
      ...harness.seams,
      createDocumentRenderer,
      createInteraction: (options) => createDocumentInteractionController(options),
    })
    const runtime = await createDocumentCanvasRuntimeWithSeams({
      canvas: harness.canvas.element,
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
    }, seams)
    expect(runtime.currentFrame.scrolls.get(root)?.maxScrollTop).toBe(150)
    let prevented = 0

    harness.canvas.emit("wheel", wheel({
      clientX: 10,
      clientY: 10,
      deltaY: 25,
      preventDefault: () => { prevented += 1 },
    }))

    expect(root.scrollTop).toBe(25)
    expect(prevented).toBe(1)
    expect(runtime.currentFrame.scrolls.get(root)?.scrollTop).toBe(25)
    const childPaint = runtime.currentFrame.displayList.find(({node}) => node === child)
    expect(childPaint?.y).toBe(-25)

    root.addEventListener("wheel", (event) => event.preventDefault(), {once: true})
    harness.canvas.emit("wheel", wheel({
      clientX: 10,
      clientY: 10,
      deltaY: 40,
      preventDefault: () => { prevented += 1 },
    }))
    expect(root.scrollTop).toBe(25)
    expect(prevented).toBe(2)
    runtime.dispose()
  })

  test("maps browser pointer coordinates once before Core inverse-transform hit testing", async () => {
    const document = createDocument()
    const button = document.createElement("button")
    document.appendChild(button)
    button.setAttribute(
      "style",
      "box-sizing:border-box; width:40px; height:20px; padding:0; border:0; background:#2563eb; transform:translateX(50px) scale(2); transform-origin:0px 0px",
    )
    let clicks = 0
    const semanticPoints: Array<readonly [number, number]> = []
    button.addEventListener("click", () => { clicks += 1 })
    button.addEventListener("pointerdown", (event) => {
      const pointer = event as SemanticPointerEvent
      semanticPoints.push([pointer.clientX, pointer.clientY])
    })
    const harness = createHarness({left: 10, top: 20, width: 400, height: 200})
    const seams: DocumentCanvasRuntimeSeams = Object.freeze({
      ...harness.seams,
      createDocumentRenderer,
      createInteraction: (options) => createDocumentInteractionController(options),
    })
    const runtime = await createDocumentCanvasRuntimeWithSeams({
      canvas: harness.canvas.element,
      document,
      root: button,
      styleSheets: [],
      font: fakeFont(),
    }, seams)
    expect(runtime.viewport).toEqual({width: 400, height: 200})

    harness.canvas.rect = {left: 10, top: 20, width: 200, height: 100}
    harness.canvas.emit("pointerdown", pointer({clientX: 45, clientY: 25, pointerId: 12}))
    harness.canvas.emit("pointerup", pointer({clientX: 45, clientY: 25, pointerId: 12}))
    expect(semanticPoints.at(-1)).toEqual([70, 10])
    expect(document.activeElement).toBe(button)
    expect(clicks).toBe(1)

    harness.canvas.emit("pointerdown", pointer({clientX: 20, clientY: 25, pointerId: 13}))
    harness.canvas.emit("pointerup", pointer({clientX: 20, clientY: 25, pointerId: 13}))
    expect(clicks).toBe(1)
    runtime.dispose()
  })

  test("shares native hover and active state between the browser interaction and CPU renderer", async () => {
    const document = createDocument()
    const button = document.createElement("button")
    document.appendChild(button)
    button.setAttribute("data-component", "button")
    const harness = createHarness({left: 0, top: 0, width: 80, height: 40})
    const seams: DocumentCanvasRuntimeSeams = Object.freeze({
      ...harness.seams,
      createDocumentRenderer,
      createInteraction: (options) => createDocumentInteractionController(options),
    })
    const runtime = await createDocumentCanvasRuntimeWithSeams({
      canvas: harness.canvas.element,
      document,
      root: button,
      styleSheets: [String.raw`
        [data-component="button"] {
          display: block;
          width: 40px;
          height: 20px;
          background: #111111;
        }
        [data-component="button"]:hover { background: #222222; }
        [data-component="button"]:active { background: #333333; }
      `],
      font: fakeFont(),
    }, seams)

    expect(backgroundColor(runtime.currentFrame, button)).toBe("#111111")
    harness.canvas.emit("pointermove", pointer({clientX: 5, clientY: 5, pointerId: 3}))
    expect(backgroundColor(runtime.currentFrame, button)).toBe("#222222")
    harness.canvas.emit("pointerdown", pointer({clientX: 5, clientY: 5, pointerId: 3}))
    expect(backgroundColor(runtime.currentFrame, button)).toBe("#333333")
    harness.canvas.emit("pointerup", pointer({clientX: 5, clientY: 5, pointerId: 3}))
    expect(backgroundColor(runtime.currentFrame, button)).toBe("#222222")
    runtime.dispose()
  })

  test("coalesces external mutation and live input-state channels into one requested frame", async () => {
    const document = createDocument()
    const root = document.createElement("div")
    const label = document.createTextNode("Before")
    const input = document.createElement("input")
    document.appendChild(root)
    root.appendChild(label)
    root.appendChild(input)
    root.setAttribute("style", "width: 120px; height: 60px")
    const harness = createHarness({left: 0, top: 0, width: 120, height: 60})
    const seams: DocumentCanvasRuntimeSeams = Object.freeze({
      ...harness.seams,
      createDocumentRenderer,
      createInteraction: (options) => createDocumentInteractionController(options),
    })
    const runtime = await createDocumentCanvasRuntimeWithSeams({
      canvas: harness.canvas.element,
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
    }, seams)
    const initialRevision = runtime.currentFrame.revision

    label.data = "After"
    input.value = "external"

    expect(harness.pendingFrames()).toBe(1)
    harness.flushFrame()
    expect(runtime.currentFrame.revision).toBe(initialRevision + 1)
    expect(runtime.currentFrame.displayList.find(({node}) => node === label)).toMatchObject({
      kind: "text",
      text: "After",
    })
    expect(harness.pendingFrames()).toBe(0)
    runtime.dispose()
  })

  test("coalesces asynchronous texture presentation without a semantic mutation", async () => {
    const document = createDocument()
    const image = document.createElement("img")
    document.appendChild(image)
    image.src = "metafor:browser-image"
    image.width = 120
    image.height = 60
    const harness = createHarness({left: 0, top: 0, width: 160, height: 90})
    const seams: DocumentCanvasRuntimeSeams = Object.freeze({
      ...harness.seams,
      createDocumentRenderer,
      createInteraction: (options) => createDocumentInteractionController(options),
    })
    const runtime = await createDocumentCanvasRuntimeWithSeams({
      canvas: harness.canvas.element,
      document,
      root: image,
      styleSheets: [],
      font: fakeFont(),
    }, seams)
    const initialFrame = runtime.currentFrame
    expect(initialFrame.displayList).toContainEqual(expect.objectContaining({
      kind: "image",
      node: image,
      src: "metafor:browser-image",
    }))

    harness.emitTextureChange()
    harness.emitTextureChange()
    expect(harness.pendingFrames()).toBe(1)
    harness.flushFrame()
    expect(runtime.currentFrame).toBe(initialFrame)
    expect(harness.pendingFrames()).toBe(0)

    runtime.dispose()
    harness.emitTextureChange()
    expect(harness.pendingFrames()).toBe(0)
  })

  test("proxies focused semantic input through one reusable native text host", async () => {
    const document = createDocument()
    const root = document.createElement("div")
    const input = document.createElement("input")
    document.appendChild(root)
    root.appendChild(input)
    root.setAttribute("style", "width: 100px; height: 40px")
    input.type = "search"
    input.value = "seed"
    input.setSelectionRange(1, 3, "backward")
    input.setAttribute("style", "width: 80px; height: 20px; background: #222222")
    const harness = createHarness({left: 0, top: 0, width: 100, height: 40})
    const seams: DocumentCanvasRuntimeSeams = Object.freeze({
      ...harness.seams,
      createDocumentRenderer,
      createInteraction: (options) => createDocumentInteractionController(options),
    })
    const runtime = await createDocumentCanvasRuntimeWithSeams({
      canvas: harness.canvas.element,
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
    }, seams)

    let pointerDefaultPrevented = 0
    harness.canvas.emit("pointerdown", pointer({
      clientX: 5,
      clientY: 5,
      pointerId: 3,
      cancelable: true,
      preventDefault: () => { pointerDefaultPrevented += 1 },
    }))
    await Promise.resolve()
    expect(document.activeElement).toBe(input)
    expect(runtime.inputTarget).toBe(input)
    expect(harness.nativeInput.focused).toBeTrue()
    expect(harness.nativeInput.type).toBe("search")
    expect(harness.nativeInput.value).toBe("seed")
    expect([
      harness.nativeInput.selectionStart,
      harness.nativeInput.selectionEnd,
      harness.nativeInput.selectionDirection,
    ]).toEqual([1, 3, "backward"])
    expect(runtime.nativeTextArea).toBe(harness.nativeTextarea.element as unknown as HTMLTextAreaElement)
    expect(pointerDefaultPrevented).toBe(1)

    const semanticEvents: string[] = []
    let keyDown: SemanticKeyboardEvent | null = null
    let keyUp: SemanticKeyboardEvent | null = null
    let valueSeenByInputListener = ""
    let inputEvents = 0
    input.addEventListener("keydown", (event) => {
      keyDown = event as SemanticKeyboardEvent
      semanticEvents.push("keydown")
      event.preventDefault()
    })
    input.addEventListener("keyup", (event) => {
      keyUp = event as SemanticKeyboardEvent
      semanticEvents.push("keyup")
      event.preventDefault()
    })
    input.addEventListener("beforeinput", (event) => {
      expect(event).toBeInstanceOf(SemanticInputEvent)
      semanticEvents.push("beforeinput")
      event.preventDefault()
    })
    input.addEventListener("input", (event) => {
      expect(event).toBeInstanceOf(SemanticInputEvent)
      semanticEvents.push("input")
      valueSeenByInputListener = (event.currentTarget as typeof input).value
      inputEvents += 1
    })
    for (const type of ["compositionstart", "compositionupdate", "compositionend"]) {
      input.addEventListener(type, (event) => {
        expect(event).toBeInstanceOf(SemanticCompositionEvent)
        semanticEvents.push(type)
      })
    }

    let keyPrevented = 0
    harness.nativeInput.emit("keydown", nativeKeyboard({
      key: "a",
      code: "KeyA",
      shiftKey: true,
      preventDefault: () => { keyPrevented += 1 },
    }))
    harness.nativeInput.emit("keyup", nativeKeyboard({
      key: "a",
      code: "KeyA",
      preventDefault: () => { keyPrevented += 1 },
    }))
    expect(keyPrevented).toBe(2)
    expect(keyDown).toBeInstanceOf(SemanticKeyboardEvent)
    expect(keyDown).toMatchObject({key: "a", code: "KeyA", shiftKey: true})
    expect(keyUp).toBeInstanceOf(SemanticKeyboardEvent)

    let beforeInputPrevented = 0
    harness.nativeInput.emit("beforeinput", nativeInput({
      data: "x",
      inputType: "insertText",
      cancelable: true,
      preventDefault: () => { beforeInputPrevented += 1 },
    }))
    expect(beforeInputPrevented).toBe(1)

    harness.nativeInput.emit("compositionstart", nativeComposition({data: ""}))
    harness.nativeInput.emit("compositionupdate", nativeComposition({data: "候補"}))
    harness.nativeInput.emit("compositionend", nativeComposition({data: "候補"}))

    harness.nativeInput.value = "seedx"
    harness.nativeInput.setSelectionRange(2, 5, "forward")
    harness.nativeInput.emit("input", nativeInput({
      data: "x",
      inputType: "insertText",
      cancelable: false,
    }))
    expect(valueSeenByInputListener).toBe("seedx")
    expect(input.value).toBe("seedx")
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection])
      .toEqual([2, 5, "forward"])
    expect(inputEvents).toBe(1)
    expect(harness.pendingFrames()).toBe(1)

    let rejectedInputPrevented = 0
    input.addEventListener("input", (event) => event.preventDefault(), {once: true})
    harness.nativeInput.value = "rejected"
    harness.nativeInput.setSelectionRange(0, 8, "backward")
    harness.nativeInput.emit("input", nativeInput({
      data: "!",
      inputType: "insertText",
      cancelable: true,
      preventDefault: () => { rejectedInputPrevented += 1 },
    }))
    expect(rejectedInputPrevented).toBe(1)
    expect(input.value).toBe("seedx")
    expect(harness.nativeInput.value).toBe("seedx")
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection])
      .toEqual([2, 5, "forward"])
    expect([
      harness.nativeInput.selectionStart,
      harness.nativeInput.selectionEnd,
      harness.nativeInput.selectionDirection,
    ]).toEqual([2, 5, "forward"])
    expect(inputEvents).toBe(2)

    input.value = "external"
    input.type = "password"
    expect(harness.nativeInput.value).toBe("external")
    expect(harness.nativeInput.type).toBe("password")
    expect(harness.pendingFrames()).toBe(1)
    harness.flushFrame()

    harness.nativeInput.blur()
    expect(document.activeElement).toBeNull()
    expect(runtime.inputTarget).toBeNull()
    input.focus()
    expect(runtime.inputTarget).toBe(input)
    harness.canvas.emit("pointerdown", pointer({clientX: 200, clientY: 200, pointerId: 4}))
    expect(document.activeElement).toBeNull()
    expect(runtime.inputTarget).toBeNull()
    input.focus()
    input.disabled = true
    expect(document.activeElement).toBeNull()
    expect(runtime.inputTarget).toBeNull()
    expect(harness.nativeInput.focused).toBeFalse()
    expect(semanticEvents).toEqual([
      "keydown",
      "keyup",
      "beforeinput",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "input",
      "input",
    ])

    runtime.dispose()
    expect(harness.nativeInput.removed).toBeTrue()
    expect(harness.nativeTextarea.removed).toBeTrue()
    expect(harness.nativeInput.listenerCount()).toBe(0)
    expect(harness.nativeTextarea.listenerCount()).toBe(0)
    expect(harness.nativeSelectionTarget.listenerCount()).toBe(0)
  })

  test("activates the textarea proxy through the same canvas focus path", async () => {
    const document = createDocument()
    const root = document.createElement("div")
    const textarea = document.createElement("textarea")
    document.appendChild(root)
    root.appendChild(textarea)
    root.setAttribute("style", "width: 120px; height: 60px")
    textarea.value = "first\nsecond"
    textarea.setSelectionRange(2, 8, "forward")
    textarea.setAttribute("style", "width: 100px; height: 40px; background: #222222")
    const harness = createHarness({left: 0, top: 0, width: 120, height: 60})
    const runtime = await createDocumentCanvasRuntimeWithSeams({
      canvas: harness.canvas.element,
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
    }, Object.freeze({
      ...harness.seams,
      createDocumentRenderer,
      createInteraction: (options) => createDocumentInteractionController(options),
    }))

    harness.canvas.emit("pointerdown", pointer({clientX: 5, clientY: 5, pointerId: 9}))
    expect(runtime.inputTarget).toBe(textarea)
    expect(harness.nativeTextarea.focused).toBeTrue()
    expect(harness.nativeInput.focused).toBeFalse()
    expect(harness.nativeTextarea.value).toBe("first\nsecond")
    expect([
      harness.nativeTextarea.selectionStart,
      harness.nativeTextarea.selectionEnd,
      harness.nativeTextarea.selectionDirection,
    ]).toEqual([2, 8, "forward"])

    harness.nativeTextarea.value = "updated\ntext"
    harness.nativeTextarea.setSelectionRange(1, 6, "backward")
    harness.nativeTextarea.emit("input", nativeInput({data: "u", inputType: "insertText"}))
    expect(textarea.value).toBe("updated\ntext")
    expect([textarea.selectionStart, textarea.selectionEnd, textarea.selectionDirection])
      .toEqual([1, 6, "backward"])
    runtime.dispose()
  })

  test("requires one same-document root and an explicit resolved font", async () => {
    const document = createDocument()
    const foreign = createDocument().createElement("div")
    const root = document.createElement("div")
    document.appendChild(root)
    const harness = createHarness({left: 0, top: 0, width: 10, height: 10})
    const options = {
      canvas: harness.canvas.element,
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
    }

    await expect(createDocumentCanvasRuntimeWithSeams(
      {...options, root: foreign},
      harness.seams,
    )).rejects.toThrow("another Document")
    await expect(createDocumentCanvasRuntimeWithSeams(
      {...options, font: null as unknown as TrueTypeFont},
      harness.seams,
    )).rejects.toThrow("font is required")
    expect(harness.calls.initialize).toBe(0)
  })

  test("claims one isolated Experience host and rolls the claim back on failure", async () => {
    const document = createDocument()
    const root = document.createElement("div")
    document.appendChild(root)
    const harness = createHarness({left: 0, top: 0, width: 10, height: 10})
    const options = {
      canvas: harness.canvas.element,
      document,
      root,
      styleSheets: [],
      font: fakeFont(),
    }
    await expect(createDocumentCanvasRuntimeWithSeams(options, Object.freeze({
      ...harness.seams,
      async initializeEngineRenderer() { throw new Error("init failed") },
    }))).rejects.toThrow("init failed")

    const runtime = await createDocumentCanvasRuntimeWithSeams(options, harness.seams)
    const initialized = harness.calls.initialize
    await expect(createDocumentCanvasRuntimeWithSeams(options, harness.seams))
      .rejects.toThrow("canvas already owns")
    expect(harness.calls.initialize).toBe(initialized)

    runtime.dispose()
    const replacement = await createDocumentCanvasRuntimeWithSeams(options, harness.seams)
    replacement.dispose()
  })
})

type Rect = {left: number; top: number; width: number; height: number}

class FakeCanvas {
  readonly element = this as unknown as HTMLCanvasElement
  rect: Rect
  width = 0
  height = 0
  style: Record<string, string> = {}
  readonly captured = new Set<number>()
  readonly #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  constructor(rect: Rect) {
    this.rect = rect
  }

  get clientWidth(): number {
    return this.rect.width
  }

  get clientHeight(): number {
    return this.rect.height
  }

  getBoundingClientRect(): DOMRect {
    return this.rect as DOMRect
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) return
    const listeners = this.#listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) return
    this.#listeners.get(type)?.delete(listener)
  }

  emit(type: string, event: unknown): void {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) {
      if (typeof listener === "function") listener(event as Event)
      else listener.handleEvent(event as Event)
    }
  }

  listenerCount(): number {
    return [...this.#listeners.values()].reduce((count, listeners) => count + listeners.size, 0)
  }

  setPointerCapture(pointerId: number): void {
    this.captured.add(pointerId)
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId)
  }

  releasePointerCapture(pointerId: number): void {
    this.captured.delete(pointerId)
  }
}

class FakeNativeInput {
  readonly element = this as unknown as HTMLInputElement
  type = "text"
  value = ""
  readOnly = false
  disabled = false
  selectionStart = 0
  selectionEnd = 0
  selectionDirection: "forward" | "backward" | "none" = "none"
  focused = false
  removed = false
  readonly #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) return
    const listeners = this.#listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (listener === null) return
    this.#listeners.get(type)?.delete(listener)
  }

  emit(type: string, event: unknown): void {
    for (const listener of [...(this.#listeners.get(type) ?? [])]) {
      if (typeof listener === "function") listener(event as Event)
      else listener.handleEvent(event as Event)
    }
  }

  focus(): void {
    this.focused = true
  }

  blur(): void {
    if (!this.focused) return
    this.focused = false
    this.emit("blur", {type: "blur"})
  }

  remove(): void {
    this.removed = true
  }

  setSelectionRange(
    start: number,
    end: number,
    direction: "forward" | "backward" | "none" = "none",
  ): void {
    this.selectionStart = Math.max(0, Math.min(this.value.length, start))
    this.selectionEnd = Math.max(this.selectionStart, Math.min(this.value.length, end))
    this.selectionDirection = direction
  }

  listenerCount(): number {
    return [...this.#listeners.values()].reduce((count, listeners) => count + listeners.size, 0)
  }
}

function createHarness(rect: Rect) {
  const canvas = new FakeCanvas(rect)
  const nativeInput = new FakeNativeInput()
  const nativeTextarea = new FakeNativeInput()
  const nativeSelectionTarget = new FakeNativeInput()
  const calls = {
    initialize: 0,
    pixelRatios: [] as number[],
    sizes: [] as Array<readonly [number, number]>,
    aspects: [] as number[],
    engineFrames: [] as unknown[][],
    captures: 0,
    observed: [] as unknown[],
    observerDisconnects: 0,
    overlayResizes: [] as Array<Readonly<{width: number; height: number}>>,
    documentRendererDisposals: 0,
    interactionDisposals: 0,
    backendDisposals: 0,
    pointerMoves: [] as PointerInput[],
    pointerDowns: [] as PointerInput[],
    pointerUps: [] as PointerInput[],
    pointerCancels: [] as PointerInput[],
    wheels: [] as WheelInput[],
    timerDelays: [] as number[],
    cancelledFrames: [] as unknown[],
  }
  const capture = new Blob(["frame"], {type: "image/png"})
  const engineRenderer = {
    setPixelRatio(value: number) {
      calls.pixelRatios.push(value)
    },
    setSize(width: number, height: number) {
      calls.sizes.push([width, height])
    },
    invalidateGeometry() {},
    renderFrame(...owners: unknown[]) {
      calls.engineFrames.push(owners)
    },
    captureLastPresentedFramePng() {
      calls.captures += 1
      return Promise.resolve(capture)
    },
  } as unknown as EngineRenderer
  const space = new Space()
  space.updateWorldMatrix = (() => {}) as typeof space.updateWorldMatrix
  const viewPoint = {
    update() {},
    setAspectRatio(value: number) {
      calls.aspects.push(value)
    },
  } as unknown as ViewPoint
  const backend = {
    root: new Object3D(),
    applyFrame() {},
    dispose() {
      calls.backendDisposals += 1
    },
  } as unknown as RendererWebGpuBackend
  const overlay = Object.assign(new Object3D(), {
    resize(viewport: Readonly<{width: number; height: number}>) {
      calls.overlayResizes.push(viewport)
    },
  }) as unknown as RendererWebGpuScreenOverlay
  let backendOptions: RendererWebGpuBackendOptions | null = null
  let revision = 0
  const createFakeDocumentRenderer = (
    options: Parameters<DocumentCanvasRuntimeSeams["createDocumentRenderer"]>[0],
  ): DocumentRenderer => {
    let disposed = false
    const flush = (): RenderFrame => {
      if (disposed) throw new Error("fake renderer disposed")
      revision += 1
      return frame(options.document, options.root, options.viewport, revision)
    }
    return {
      document: options.document,
      root: options.root,
      viewport: options.viewport,
      invalidate() {},
      render: flush,
      flush,
      dispose() {
        if (disposed) return
        disposed = true
        calls.documentRendererDisposals += 1
      },
    }
  }
  const interaction = (document: ReturnType<typeof createDocument>): DocumentInteractionController => ({
    document,
    hoveredElement: null,
    pressedElement: null,
    tooltip: null,
    pointerMove(_frame, input) {
      calls.pointerMoves.push(input)
      return document.documentElement
    },
    pointerDown(_frame, input) {
      calls.pointerDowns.push(input)
      return document.documentElement
    },
    pointerUp(_frame, input) {
      calls.pointerUps.push(input)
      return document.documentElement
    },
    pointerCancel(_frame, input) {
      calls.pointerCancels.push(input)
    },
    wheel(_frame, input) {
      calls.wheels.push(input)
      return document.documentElement
    },
    composeFrame: (value) => value,
    dispose() {
      calls.interactionDisposals += 1
    },
  })
  let resizeCallback = (): void => {}
  let nextHandle = 1
  const frames = new Map<number, () => void>()
  const timers = new Map<number, () => void>()
  const seams: DocumentCanvasRuntimeSeams = Object.freeze({
    createEngineRenderer: () => engineRenderer,
    async initializeEngineRenderer() {
      calls.initialize += 1
    },
    createSpace: () => space,
    createFixedViewPoint: () => viewPoint,
    createBackend(options) {
      backendOptions = options
      return backend
    },
    createOverlay: () => overlay,
    createDocumentRenderer: createFakeDocumentRenderer,
    createInteraction: ({document}) => interaction(document),
    createNativeInputHost(options) {
      return createDocumentNativeInputHostWithSeams(options, {
        createProxies: () => ({
          input: nativeInput.element,
          textarea: nativeTextarea.element as unknown as HTMLTextAreaElement,
          selectionTarget: nativeSelectionTarget.element,
        }),
      })
    },
    createResizeObserver(callback) {
      resizeCallback = callback
      return {
        observe(target) {
          calls.observed.push(target)
        },
        disconnect() {
          calls.observerDisconnects += 1
        },
      }
    },
    readCanvasRect: () => canvas.rect,
    devicePixelRatio: () => 1.5,
    requestFrame(callback) {
      const handle = nextHandle++
      frames.set(handle, callback)
      return handle
    },
    cancelFrame(handle) {
      calls.cancelledFrames.push(handle)
      frames.delete(handle as number)
    },
    setTimer(callback, delayMs) {
      const handle = nextHandle++
      timers.set(handle, callback)
      calls.timerDelays.push(delayMs)
      return handle
    },
    clearTimer(handle) {
      timers.delete(handle as number)
    },
    now: () => 100,
  })
  return {
    canvas,
    nativeInput,
    nativeTextarea,
    nativeSelectionTarget,
    calls,
    capture,
    engineRenderer,
    space,
    viewPoint,
    backend,
    overlay,
    seams,
    triggerResize: () => resizeCallback(),
    pendingFrames: () => frames.size,
    pendingTimers: () => timers.size,
    emitTextureChange() {
      if (backendOptions === null) throw new Error("Backend was not created")
      backendOptions.requestPresentation?.()
    },
    flushFrame() {
      const entry = frames.entries().next().value as [number, () => void] | undefined
      if (entry === undefined) throw new Error("No pending frame")
      frames.delete(entry[0])
      entry[1]()
    },
    flushTimer() {
      const entry = timers.entries().next().value as [number, () => void] | undefined
      if (entry === undefined) throw new Error("No pending timer")
      timers.delete(entry[0])
      entry[1]()
    },
  }
}

function frame(
  document: ReturnType<typeof createDocument>,
  root: SemanticNode,
  viewport: Readonly<{width: number; height: number}>,
  revision: number,
): RenderFrame {
  return Object.freeze({
    revision,
    document,
    root,
    viewport,
    boxes: Object.freeze([]),
    boxByNode: new Map(),
    displayList: Object.freeze([]),
    hits: new Map(),
    scrolls: new Map(),
  })
}

function backgroundColor(frame: RenderFrame, node: SemanticNode): string | undefined {
  const item = frame.displayList.find((candidate) =>
    candidate.kind === "rect" && candidate.node === node && candidate.key === "background"
  )
  return item?.kind === "rect" ? item.color : undefined
}

function pointer(values: Partial<PointerEvent> = {}): PointerEvent {
  return {
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
    buttons: 0,
    pressure: 0,
    isPrimary: true,
    timeStamp: 10,
    cancelable: true,
    preventDefault() {},
    ...values,
  } as PointerEvent
}

function wheel(values: Partial<WheelEvent> = {}): WheelEvent {
  return {
    clientX: 0,
    clientY: 0,
    deltaX: 0,
    deltaY: 0,
    deltaZ: 0,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    preventDefault() {},
    ...values,
  } as WheelEvent
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

function fakeFont(): TrueTypeFont {
  return {
    unitsPerEm: 1_000,
    mapCharToGlyph: () => 0,
    getGlyphOutline: () => ({
      points: new Float32Array(),
      onCurve: new Uint8Array(),
      contours: new Uint16Array(),
    }),
    getHMetric: () => ({advanceWidth: 500, lsb: 0}),
  } as unknown as TrueTypeFont
}
