import {describe, expect, test} from "bun:test"
import {MouseEvent, PointerEvent, createDocument} from "@zavx0z/dom"
import {
  createDocumentInteractionController,
  createDocumentRenderer,
} from "../src/index.ts"

describe("document interaction bridge", () => {
  test("hit-tests the deepest element and dispatches native-shaped pointer, focus and click events", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const button = document.createElement("button")
    document.appendChild(root)
    root.appendChild(button)
    root.setAttribute("style", "width: 200px; height: 100px")
    button.setAttribute("style", "width: 60px; height: 20px")
    button.textContent = "Run"
    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 200, height: 100},
    }).flush()
    const interaction = createDocumentInteractionController({document})
    const events: string[] = []
    let clickEvent: unknown

    root.addEventListener("pointerdown", (event) => {
      expect(event).toBeInstanceOf(PointerEvent)
      events.push(`root:${event.eventPhase}`)
    }, true)
    button.addEventListener("pointerdown", (event) => {
      expect((event as PointerEvent).clientX).toBe(5)
      events.push(`button:${event.eventPhase}`)
    })
    button.addEventListener("click", (event) => {
      clickEvent = event
      events.push("click")
    })

    expect(interaction.pointerMove(frame, {clientX: 5, clientY: 5})).toBe(button)
    expect(interaction.pointerDown(frame, {
      clientX: 5,
      clientY: 5,
      buttons: 1,
      pressure: 0.5,
    })).toBe(button)
    expect(document.activeElement).toBe(button)
    expect(interaction.pointerUp(frame, {clientX: 5, clientY: 5})).toBe(button)

    expect(events).toEqual(["root:1", "button:2", "click"])
    expect(clickEvent).toBeInstanceOf(MouseEvent)
  })

  test("inherits title, honors an explicit empty override and emits a clamped UA overlay after delay", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const child = document.createElement("span")
    document.appendChild(root)
    root.appendChild(child)
    root.title = "Parent advice\nSecond line"
    root.setAttribute("style", "width: 100px; height: 100px; background: #222222")
    child.setAttribute("style", "width: 20px; height: 20px")
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 100},
    })
    const frame = renderer.flush()
    const interaction = createDocumentInteractionController({
      document,
      tooltipDelayMs: 100,
      tooltipMaxWidth: 80,
    })

    interaction.pointerMove(frame, {clientX: 5, clientY: 5, timeStamp: 1_000})
    expect(interaction.hoveredElement).toBe(child)
    expect(interaction.composeFrame(frame, 1_099)).toBe(frame)

    interaction.pointerMove(frame, {clientX: 99, clientY: 99, timeStamp: 1_050})
    const presentation = interaction.composeFrame(frame, 1_150)
    const tooltip = interaction.tooltip
    expect(tooltip?.source).toBe(root)
    expect(tooltip?.target).toBe(root)
    expect(tooltip?.lines).toEqual(["Parent", "advice", "Second", "line"])
    expect(tooltip?.x).toBeGreaterThanOrEqual(4)
    expect((tooltip?.x ?? 0) + (tooltip?.width ?? 0)).toBeLessThanOrEqual(96)
    expect(tooltip?.y).toBeGreaterThanOrEqual(4)
    expect((tooltip?.y ?? 0) + (tooltip?.height ?? 0)).toBeLessThanOrEqual(96)
    expect(presentation.displayList.filter((item) => item.node === root).map((item) => item.key))
      .toEqual(["background", "ua:title-background", "ua:title-text:0", "ua:title-text:1", "ua:title-text:2", "ua:title-text:3"])
    expect(interaction.composeFrame(frame, 1_151)).toBe(presentation)

    child.title = ""
    interaction.pointerMove(frame, {clientX: 5, clientY: 5, timeStamp: 2_000})
    expect(interaction.composeFrame(renderer.flush(), 3_000).displayList.some(
      (item) => item.key.startsWith("ua:title"),
    )).toBe(false)
  })

  test("suppresses disabled activation and clears stale pressed state on cancel", () => {
    const document = createDocument()
    const button = document.createElement("button")
    document.appendChild(button)
    button.disabled = true
    button.setAttribute("style", "width: 40px; height: 20px")
    const frame = createDocumentRenderer({
      document,
      root: button,
      viewport: {width: 40, height: 20},
    }).flush()
    const interaction = createDocumentInteractionController({document})
    let clicks = 0
    button.addEventListener("click", () => clicks++)

    interaction.pointerDown(frame, {clientX: 1, clientY: 1})
    interaction.pointerCancel(frame, {clientX: 1, clientY: 1})
    interaction.pointerUp(frame, {clientX: 1, clientY: 1})

    expect(clicks).toBe(0)
    expect(interaction.pressedElement).toBeNull()
    expect(document.activeElement).toBeNull()
  })

  test("delegates checkbox default activation to the DOM owner", () => {
    const document = createDocument()
    const input = document.createElement("input")
    input.type = "checkbox"
    input.setAttribute("style", "width: 20px; height: 20px")
    document.appendChild(input)
    const renderer = createDocumentRenderer({
      document,
      root: input,
      viewport: {width: 20, height: 20},
    })
    const interaction = createDocumentInteractionController({document})
    const events: string[] = []
    input.addEventListener("click", () => events.push(`click:${input.checked}`))
    input.addEventListener("input", () => events.push("input"))
    input.addEventListener("change", () => events.push("change"))

    interaction.pointerDown(renderer.flush(), {clientX: 10, clientY: 10})
    interaction.pointerUp(renderer.flush(), {clientX: 10, clientY: 10})

    expect(input.checked).toBe(true)
    expect(events).toEqual(["click:true", "input", "change"])
    expect(renderer.flush().displayList.some(item => item.key === "indicator")).toBe(true)
  })
})
