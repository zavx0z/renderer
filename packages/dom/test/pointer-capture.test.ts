import {describe, expect, test} from "bun:test"
import {createDocument} from "../src/index.ts"

describe("Element pointer capture", () => {
  test("processes pending overrides and dispatches got/lost events in order", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = document.createElement("span")
    const second = document.createElement("span")
    document.appendChild(root)
    root.append(first, second)
    const events: string[] = []
    first.addEventListener("gotpointercapture", event => events.push(`${event.type}:${event.eventPhase}`))
    first.addEventListener("lostpointercapture", event => events.push(`${event.type}:${event.eventPhase}`))
    second.addEventListener("gotpointercapture", event => events.push(`${event.type}:${event.eventPhase}`))
    second.addEventListener("lostpointercapture", event => events.push(`${event.type}:${event.eventPhase}`))

    document.beginPointer(7)
    first.setPointerCapture(7)
    expect(first.hasPointerCapture(7)).toBeTrue()
    expect(events).toEqual([])
    expect(document.readPointerCaptureTarget(7)).toBe(first)
    expect(events).toEqual(["gotpointercapture:2"])

    second.setPointerCapture(7)
    expect(first.hasPointerCapture(7)).toBeFalse()
    expect(second.hasPointerCapture(7)).toBeTrue()
    expect(document.readPointerCaptureTarget(7)).toBe(second)
    expect(events).toEqual([
      "gotpointercapture:2",
      "lostpointercapture:2",
      "gotpointercapture:2",
    ])

    second.releasePointerCapture(7)
    expect(second.hasPointerCapture(7)).toBeFalse()
    expect(document.readPointerCaptureTarget(7)).toBeNull()
    expect(events.at(-1)).toBe("lostpointercapture:2")
    document.endPointer(7)
  })

  test("implicitly releases after pointer end and rejects inactive ids", () => {
    const document = createDocument()
    const target = document.createElement("div")
    document.appendChild(target)
    let lost = 0
    target.addEventListener("lostpointercapture", () => lost += 1)

    expect(() => target.setPointerCapture(9)).toThrow("not active")
    document.beginPointer(9)
    target.setPointerCapture(9)
    expect(document.readPointerCaptureTarget(9)).toBe(target)
    document.endPointer(9)
    expect(lost).toBe(1)
    expect(target.hasPointerCapture(9)).toBeFalse()
    target.releasePointerCapture(9)
  })

  test("drops a disconnected pending target before retargeting", () => {
    const document = createDocument()
    const target = document.createElement("div")
    document.appendChild(target)
    document.beginPointer(3)
    target.setPointerCapture(3)
    target.remove()

    expect(target.hasPointerCapture(3)).toBeFalse()
    expect(document.readPointerCaptureTarget(3)).toBeNull()
    document.endPointer(3)
  })
})
