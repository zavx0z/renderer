import {describe, expect, test} from "bun:test"
import {createDocument, HTMLInputElement} from "../src/index.ts"

describe("HTMLInputElement activation", () => {
  test("runs checkbox pre-activation before click and emits input/change after acceptance", () => {
    const document = createDocument()
    const input = document.createElement("input")
    input.type = "checkbox"
    input.indeterminate = true
    document.appendChild(input)
    const order: string[] = []
    const batches: unknown[] = []
    document.subscribeStateChanges(batch => batches.push(batch))
    input.addEventListener("click", () => order.push(`click:${input.checked}:${input.indeterminate}`))
    input.addEventListener("input", () => order.push(`input:${input.checked}`))
    input.addEventListener("change", () => order.push(`change:${input.checked}`))

    input.click()

    expect(input.checked).toBe(true)
    expect(input.indeterminate).toBe(false)
    expect(order).toEqual(["click:true:false", "input:true", "change:true"])
    expect(batches).toHaveLength(1)
  })

  test("rolls a canceled checkbox activation back without state or follow-up events", () => {
    const document = createDocument()
    const input = document.createElement("input")
    input.type = "checkbox"
    input.indeterminate = true
    document.appendChild(input)
    const events: string[] = []
    const batches: unknown[] = []
    document.subscribeStateChanges(batch => batches.push(batch))
    input.addEventListener("click", event => {
      events.push(`click:${input.checked}:${input.indeterminate}`)
      event.preventDefault()
    })
    input.addEventListener("input", () => events.push("input"))
    input.addEventListener("change", () => events.push("change"))

    input.click()

    expect(input.checked).toBe(false)
    expect(input.indeterminate).toBe(true)
    expect(events).toEqual(["click:true:false"])
    expect(batches).toEqual([])
  })

  test("keeps one named radio checked and restores the group when canceled", () => {
    const document = createDocument()
    const first = radio(document, "mode", true)
    const second = radio(document, "mode", false)
    const unnamed = radio(document, "", true)
    const root = document.createElement("div")
    root.append(first, second, unnamed)
    document.appendChild(root)
    const changes: string[] = []
    second.addEventListener("input", () => changes.push("input"))
    second.addEventListener("change", () => changes.push("change"))

    second.click()
    expect([first.checked, second.checked, unnamed.checked]).toEqual([false, true, true])
    expect(changes).toEqual(["input", "change"])

    first.addEventListener("click", event => event.preventDefault())
    first.click()
    expect([first.checked, second.checked, unnamed.checked]).toEqual([false, true, true])
  })

  test("suppresses click activation for direct and fieldset-disabled inputs", () => {
    const document = createDocument()
    const direct = document.createElement("input")
    direct.type = "checkbox"
    direct.disabled = true
    const fieldset = document.createElement("fieldset")
    const nested = document.createElement("input")
    nested.type = "checkbox"
    fieldset.disabled = true
    fieldset.appendChild(nested)
    const root = document.createElement("div")
    root.append(direct, fieldset)
    document.appendChild(root)
    let clicks = 0
    direct.addEventListener("click", () => clicks += 1)
    nested.addEventListener("click", () => clicks += 1)

    direct.click()
    nested.click()

    expect(clicks).toBe(0)
    expect(direct.checked).toBe(false)
    expect(nested.checked).toBe(false)
  })
})

function radio(document: ReturnType<typeof createDocument>, name: string, checked: boolean): HTMLInputElement {
  const input = document.createElement("input")
  input.type = "radio"
  if (name !== "") input.setAttribute("name", name)
  input.checked = checked
  return input
}
