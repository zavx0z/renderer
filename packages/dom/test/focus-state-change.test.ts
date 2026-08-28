import {describe, expect, it} from "bun:test"
import {createDocument, type FocusStateChange, type StateChangeBatch} from "../src/index.ts"

describe("focus state changes", () => {
  it("publishes exact focus and focus-within changes in one document transaction", () => {
    const document = createDocument()
    const root = document.createElement("div")
    const first = document.createElement("button")
    const second = document.createElement("button")
    document.appendChild(root)
    root.append(first, second)
    const batches: StateChangeBatch[] = []
    document.subscribeStateChanges((batch) => batches.push(batch))

    first.focus()
    expect(batches).toHaveLength(1)
    expect(focusChanges(batches[0]!)).toEqual([
      {target: first, property: "focus", oldValue: false, newValue: true},
      {target: first, property: "focus-within", oldValue: false, newValue: true},
      {target: root, property: "focus-within", oldValue: false, newValue: true},
    ])

    second.focus()
    expect(batches).toHaveLength(2)
    expect(focusChanges(batches[1]!)).toEqual([
      {target: first, property: "focus", oldValue: true, newValue: false},
      {target: first, property: "focus-within", oldValue: true, newValue: false},
      {target: second, property: "focus", oldValue: false, newValue: true},
      {target: second, property: "focus-within", oldValue: false, newValue: true},
    ])

    root.removeChild(second)
    expect(batches).toHaveLength(3)
    expect(focusChanges(batches[2]!)).toEqual([
      {target: second, property: "focus", oldValue: true, newValue: false},
      {target: second, property: "focus-within", oldValue: true, newValue: false},
      {target: root, property: "focus-within", oldValue: true, newValue: false},
    ])
  })
})

const focusChanges = (batch: StateChangeBatch): readonly Omit<FocusStateChange, "type">[] =>
  batch.records
    .filter((record): record is FocusStateChange => record.type === "focus")
    .map(({target, property, oldValue, newValue}) => ({
      target,
      property,
      oldValue,
      newValue,
    }))
