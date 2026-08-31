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

  test("activates one nearest control across different nested pointer targets", () => {
    const document = createDocument()
    const button = document.createElement("button")
    const left = document.createElement("span")
    const right = document.createElement("span")
    document.appendChild(button)
    button.setAttribute("style", "display:flex; width:100px; height:24px; padding:0")
    left.setAttribute("style", "display:block; width:50px; height:24px")
    right.setAttribute("style", "display:block; width:50px; height:24px")
    left.append("Left")
    right.append("Right")
    button.append(left, right)
    const frame = createDocumentRenderer({
      document,
      root: button,
      viewport: {width: 100, height: 24},
    }).flush()
    const interaction = createDocumentInteractionController({document})
    const leftBox = frame.boxByNode.get(left)!
    const rightBox = frame.boxByNode.get(right)!
    const events: string[] = []
    const clickTargets: unknown[] = []
    left.addEventListener("pointerdown", () => events.push("left:down"))
    left.addEventListener("pointercancel", () => events.push("left:cancel"))
    right.addEventListener("pointerup", () => events.push("right:up"))
    button.addEventListener("click", event => {
      events.push("button:click")
      clickTargets.push(event.target)
    })

    interaction.pointerDown(frame, center(leftBox))
    interaction.pointerUp(frame, center(leftBox))
    expect(clickTargets).toEqual([left])
    events.length = 0

    expect(interaction.pointerMove(frame, center(leftBox))).toBe(left)
    expect(interaction.hoveredElement).toBe(left)
    expect(interaction.pointerDown(frame, center(leftBox))).toBe(left)
    expect(interaction.pressedElement).toBe(button)
    expect(document.activeElement).toBe(button)
    expect(interaction.pointerUp(frame, center(rightBox))).toBe(right)
    expect(events).toEqual(["left:down", "right:up", "button:click"])
    expect(clickTargets.at(-1)).toBe(button)

    interaction.pointerDown(frame, center(leftBox))
    interaction.pointerCancel(frame, center(rightBox))
    expect(events.at(-1)).toBe("left:cancel")
    expect(clickTargets).toHaveLength(2)
    expect(interaction.pressedElement).toBeNull()
  })

  test("keeps disabled control ownership without activation and preserves plain element clicks", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const button = document.createElement("button")
    const icon = document.createElement("img")
    const plain = document.createElement("span")
    document.appendChild(root)
    root.setAttribute("style", "display:flex; width:80px; height:20px")
    button.setAttribute("style", "display:block; width:40px; height:20px; padding:0")
    icon.setAttribute("style", "display:block; width:40px; height:20px")
    plain.setAttribute("style", "display:block; width:40px; height:20px")
    button.disabled = true
    button.appendChild(icon)
    root.append(button, plain)
    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 80, height: 20},
    }).flush()
    const interaction = createDocumentInteractionController({document})
    let disabledClicks = 0
    let plainClicks = 0
    button.addEventListener("click", () => disabledClicks++)
    plain.addEventListener("click", () => plainClicks++)

    interaction.pointerDown(frame, center(frame.boxByNode.get(icon)!))
    expect(interaction.pressedElement).toBe(button)
    interaction.pointerUp(frame, center(frame.boxByNode.get(icon)!))
    expect(disabledClicks).toBe(0)
    expect(document.activeElement).toBeNull()

    interaction.pointerDown(frame, center(frame.boxByNode.get(plain)!))
    interaction.pointerUp(frame, center(frame.boxByNode.get(plain)!))
    expect(plainClicks).toBe(1)
  })

  test("retargets move/up to an exact semantic pointer-capture owner outside its hit box", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const capture = document.createElement("div")
    const outside = document.createElement("div")
    document.appendChild(root)
    root.setAttribute("style", "display:flex; width:100px; height:20px")
    capture.setAttribute("style", "width:50px; height:20px")
    outside.setAttribute("style", "width:50px; height:20px")
    root.append(capture, outside)
    const frame = createDocumentRenderer({
      document,
      root,
      viewport: {width: 100, height: 20},
    }).flush()
    const interaction = createDocumentInteractionController({document})
    const events: string[] = []
    capture.addEventListener("pointerdown", event => {
      capture.setPointerCapture((event as PointerEvent).pointerId)
      events.push("down")
    })
    capture.addEventListener("gotpointercapture", () => events.push("got"))
    capture.addEventListener("pointermove", () => events.push("move"))
    capture.addEventListener("pointerup", () => events.push("up"))
    capture.addEventListener("lostpointercapture", () => events.push("lost"))
    outside.addEventListener("pointermove", () => events.push("outside:move"))
    outside.addEventListener("pointerup", () => events.push("outside:up"))

    interaction.pointerDown(frame, {clientX: 10, clientY: 10, pointerId: 12})
    expect(interaction.pointerMove(frame, {clientX: 90, clientY: 10, pointerId: 12})).toBe(capture)
    expect(interaction.pointerUp(frame, {clientX: 90, clientY: 10, pointerId: 12})).toBe(capture)

    expect(events).toEqual(["down", "got", "move", "up", "lost"])
    expect(capture.hasPointerCapture(12)).toBeFalse()
    interaction.dispose()
  })

  test("opens, chooses and light-dismisses the owner-controlled select picker", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const select = document.createElement("select")
    const first = document.createElement("option")
    const second = document.createElement("option")
    const outside = document.createElement("button")
    first.value = "first"
    first.append("First")
    second.value = "second"
    second.append("Second")
    select.append(first, second)
    select.setAttribute("style", "width:100px; height:22px")
    outside.setAttribute("style", "width:100px; height:22px")
    root.append(select, outside)
    document.append(root)
    const renderer = createDocumentRenderer({
      document,
      root,
      viewport: {width: 120, height: 100},
    })
    const interaction = createDocumentInteractionController({document})
    const events: string[] = []
    select.addEventListener("input", () => events.push(`input:${select.value}`))
    select.addEventListener("change", () => events.push(`change:${select.value}`))

    interaction.pointerDown(renderer.flush(), {clientX: 10, clientY: 10})
    interaction.pointerUp(renderer.flush(), {clientX: 10, clientY: 10})
    expect(select.pickerVisibilityState).toBe("open")
    const open = renderer.flush()
    const secondBox = open.boxByNode.get(second)!
    interaction.pointerDown(open, center(secondBox))
    interaction.pointerUp(open, center(secondBox))
    expect(select.value).toBe("second")
    expect(select.pickerVisibilityState).toBe("closed")
    expect(events).toEqual(["input:second", "change:second"])

    select.showPicker()
    const reopened = renderer.flush()
    interaction.pointerDown(reopened, {clientX: 110, clientY: 90})
    expect(select.pickerVisibilityState).toBe("closed")
    interaction.pointerCancel(renderer.flush(), {clientX: 110, clientY: 90})
    renderer.dispose()
  })
})

function center(box: Readonly<{x: number; y: number; width: number; height: number}>) {
  return {clientX: box.x + box.width / 2, clientY: box.y + box.height / 2}
}
