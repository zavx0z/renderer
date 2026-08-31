import {describe, expect, test} from "bun:test"
import {createDocument, type StateChangeBatch} from "../src/index.ts"

describe("collapsed select picker state", () => {
  test("opens one exact picker, publishes state and light-dismisses outside", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = select(document, "a", "b")
    const second = select(document, "c", "d")
    const outside = document.createElement("button")
    root.append(first, second, outside)
    document.append(root)
    const batches: StateChangeBatch[] = []
    document.subscribeStateChanges(batch => batches.push(batch))

    first.showPicker()
    expect(document.readOpenSelectPicker()).toBe(first)
    expect(first.pickerVisibilityState).toBe("open")
    second.showPicker()
    expect(first.pickerVisibilityState).toBe("closed")
    expect(second.pickerVisibilityState).toBe("open")
    expect(document.closeSelectPickerOutside(second.options.item(0))).toBeFalse()
    expect(document.closeSelectPickerOutside(outside)).toBeTrue()
    expect(document.readOpenSelectPicker()).toBeNull()
    expect(batches.flatMap(batch => batch.records)
      .filter(record => record.type === "select-picker")
      .map(record => [record.type, record.target]))
      .toEqual([
        ["select-picker", first],
        ["select-picker", first],
        ["select-picker", second],
        ["select-picker", second],
      ])
  })

  test("chooses enabled options with ordered input/change and keyboard defaults", () => {
    const document = createDocument()
    const select = document.createElement("select")
    const first = option(document, "a")
    const disabled = option(document, "b")
    const third = option(document, "c")
    disabled.disabled = true
    select.append(first, disabled, third)
    document.append(select)
    const events: string[] = []
    select.addEventListener("input", () => events.push(`input:${select.value}`))
    select.addEventListener("change", () => events.push(`change:${select.value}`))

    expect(select.applyPickerKeyboardDefault("ArrowDown")).toBeTrue()
    expect(select.value).toBe("c")
    expect(events).toEqual(["input:c", "change:c"])
    expect(select.applyPickerKeyboardDefault(" ")).toBeTrue()
    expect(select.pickerVisibilityState).toBe("open")
    expect(select.choosePickerOption(first)).toBeTrue()
    expect(select.value).toBe("a")
    expect(select.pickerVisibilityState).toBe("closed")
    expect(events).toEqual(["input:c", "change:c", "input:a", "change:a"])
    expect(select.choosePickerOption(disabled)).toBeFalse()
  })

  test("closes on blur and subtree removal without retaining a detached owner", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const select = document.createElement("select")
    select.append(option(document, "a"))
    root.append(select)
    document.append(root)

    select.showPicker()
    select.blur()
    expect(document.readOpenSelectPicker()).toBeNull()
    select.showPicker()
    root.remove()
    expect(document.readOpenSelectPicker()).toBeNull()
  })
})

const select = (
  document: ReturnType<typeof createDocument>,
  ...values: string[]
) => {
  const element = document.createElement("select")
  element.append(...values.map(value => option(document, value)))
  return element
}

const option = (document: ReturnType<typeof createDocument>, value: string) => {
  const element = document.createElement("option")
  element.value = value
  element.append(value.toUpperCase())
  return element
}
