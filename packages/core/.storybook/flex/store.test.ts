import {describe, expect, test} from "bun:test"
import {
  FLEX_STORY_BOUNDS,
  FLEX_STORY_CHANNEL_BRAND,
  FLEX_STORY_CHANNEL_PROTOCOL,
  FLEX_STORY_CHANNEL_VERSION,
} from "./contract.ts"
import {
  FLEX_STORY_PRESETS,
  flexStoryPreset,
} from "./presets.ts"
import {
  createFlexStoryChannel,
  isFlexStoryChannel,
  reduceFlexStoryState,
} from "./store.ts"

describe("Flex Storybook state channel", () => {
  test("publishes exact immutable presets with stable item identities", () => {
    expect(FLEX_STORY_PRESETS.map(preset => preset.id)).toEqual([
      "packing",
      "alignment",
      "sizing",
      "column",
      "reverse",
      "shrink",
    ])
    for (const preset of FLEX_STORY_PRESETS) {
      const state = preset.state
      expect(Object.isFrozen(preset)).toBeTrue()
      expect(Object.isFrozen(state)).toBeTrue()
      expect(Object.isFrozen(state.container)).toBeTrue()
      expect(Object.isFrozen(state.items)).toBeTrue()
      expect(state.items.every(item => Object.isFrozen(item) &&
        Object.isFrozen(item.basis) && Object.isFrozen(item.margin))).toBeTrue()
      expect(state.items.map(item => item.id)).toEqual(
        state.items.map((_, index) => `item-${index + 1}`),
      )
      expect(new Set(state.items.map(item => item.id)).size).toBe(state.items.length)
      expect(state.items.some(item => item.id === state.selectedItemId)).toBeTrue()
    }
    expect(flexStoryPreset("packing").state.container.wrap).toBe("wrap")
    expect(flexStoryPreset("alignment").state.container.alignContent).toBe("space-around")
    expect(flexStoryPreset("sizing").state.items.map(item => item.grow)).toEqual([1, 2, 1])
    expect(flexStoryPreset("column").state.container.direction).toBe("column")
    expect(flexStoryPreset("reverse").state.container.wrap).toBe("wrap-reverse")
    expect(flexStoryPreset("shrink").state.items.map(item => item.shrink)).toEqual([1, 2, 1])
  })

  test("retains snapshot identity for no-op actions and shares untouched records", () => {
    const channel = createFlexStoryChannel()
    const initial = channel.getSnapshot()
    channel.dispatch({type: "set-direction", value: initial.container.direction})
    expect(channel.getSnapshot()).toBe(initial)
    expect(channel.getSnapshot().presetId).toBe("packing")

    channel.dispatch({type: "set-direction", value: "column"})
    const changed = channel.getSnapshot()
    expect(changed).not.toBe(initial)
    expect(changed.container).not.toBe(initial.container)
    expect(changed.items).toBe(initial.items)
    expect(changed.container.direction).toBe("column")
    expect(changed.presetId).toBe("custom")

    channel.dispatch({
      type: "set-item-number",
      itemId: "item-2",
      property: "grow",
      value: 3,
    })
    const itemChanged = channel.getSnapshot()
    expect(itemChanged.items).not.toBe(changed.items)
    expect(itemChanged.items[0]).toBe(changed.items[0])
    expect(itemChanged.items[1]).not.toBe(changed.items[1])
    expect(itemChanged.items[1]?.grow).toBe(3)
  })

  test("notifies subscribers exactly once per changed snapshot", () => {
    const channel = createFlexStoryChannel()
    const observed: string[] = []
    const unsubscribeFirst = channel.subscribe(() => observed.push("first"))
    const unsubscribeSecond = channel.subscribe(() => observed.push("second"))

    channel.dispatch({type: "set-wrap", value: "nowrap"})
    expect(observed).toEqual(["first", "second"])
    channel.dispatch({type: "set-wrap", value: "nowrap"})
    expect(observed).toEqual(["first", "second"])

    unsubscribeFirst()
    unsubscribeFirst()
    channel.dispatch({type: "set-wrap", value: "wrap-reverse"})
    expect(observed).toEqual(["first", "second", "second"])
    unsubscribeSecond()
  })

  test("normalizes bounded container, gap, item, basis and margin actions", () => {
    const channel = createFlexStoryChannel("packing")
    channel.dispatch({type: "set-container-size", axis: "width", value: -10})
    channel.dispatch({type: "set-container-size", axis: "height", value: 10_000})
    channel.dispatch({type: "set-gap", axis: "row", value: {kind: "px", value: 1_000}})
    channel.dispatch({type: "set-gap", axis: "column", value: {kind: "normal"}})
    channel.dispatch({type: "set-justify-content", value: "space-evenly"})
    channel.dispatch({type: "set-align-items", value: "flex-end"})
    channel.dispatch({type: "set-align-content", value: "stretch"})
    channel.dispatch({
      type: "set-item-number",
      itemId: "item-1",
      property: "width",
      value: 1,
    })
    channel.dispatch({
      type: "set-item-number",
      itemId: "item-1",
      property: "grow",
      value: 99,
    })
    channel.dispatch({
      type: "set-item-size-mode",
      itemId: "item-1",
      axis: "height",
      value: "auto",
    })
    channel.dispatch({
      type: "set-item-basis",
      itemId: "item-1",
      value: {kind: "px", value: 1_000},
    })
    channel.dispatch({
      type: "set-item-margin",
      itemId: "item-1",
      edge: "left",
      value: -1_000,
    })

    const state = channel.getSnapshot()
    expect(state.container.width).toBe(FLEX_STORY_BOUNDS.containerWidth.min)
    expect(state.container.height).toBe(FLEX_STORY_BOUNDS.containerHeight.max)
    expect(state.container.rowGap).toEqual({kind: "px", value: FLEX_STORY_BOUNDS.gap.max})
    expect(state.container.columnGap).toEqual({kind: "normal"})
    expect(state.container).toMatchObject({
      justifyContent: "space-evenly",
      alignItems: "flex-end",
      alignContent: "stretch",
    })
    expect(state.items[0]).toMatchObject({
      width: FLEX_STORY_BOUNDS.itemWidth.min,
      heightMode: "auto",
      grow: FLEX_STORY_BOUNDS.flexFactor.max,
      basis: {kind: "px", value: FLEX_STORY_BOUNDS.basis.max},
      margin: {left: FLEX_STORY_BOUNDS.margin.min},
    })
    expect(Object.isFrozen(state)).toBeTrue()
    expect(Object.isFrozen(state.container)).toBeTrue()
    expect(Object.isFrozen(state.items[0])).toBeTrue()
    expect(() => channel.dispatch({
      type: "set-item-number",
      itemId: "item-1",
      property: "height",
      value: Number.NaN,
    })).toThrow("finite")
  })

  test("applies presets and resets to the currently selected preset", () => {
    const channel = createFlexStoryChannel("packing")
    channel.dispatch({type: "apply-preset", presetId: "alignment"})
    expect(channel.getSnapshot()).toBe(flexStoryPreset("alignment").state)
    channel.dispatch({type: "set-direction", value: "column"})
    expect(channel.getSnapshot().container.direction).toBe("column")
    expect(channel.getSnapshot().presetId).toBe("custom")
    channel.reset()
    expect(channel.getSnapshot()).toBe(flexStoryPreset("alignment").state)
    expect(channel.getSnapshot().presetId).toBe("alignment")

    const direct = reduceFlexStoryState(
      flexStoryPreset("packing").state,
      {type: "apply-preset", presetId: "shrink"},
    )
    expect(direct).toBe(flexStoryPreset("shrink").state)
  })

  test("changes item count without renaming retained items and repairs selection", () => {
    const channel = createFlexStoryChannel("sizing")
    const first = channel.getSnapshot()
    const retained = first.items[0]
    channel.dispatch({type: "select-item", itemId: "item-3"})
    expect(channel.getSnapshot().presetId).toBe("sizing")
    channel.dispatch({type: "set-item-count", value: 1})
    const reduced = channel.getSnapshot()
    expect(reduced.items.map(item => item.id)).toEqual(["item-1"])
    expect(reduced.items[0]).toBe(retained)
    expect(reduced.selectedItemId).toBe("item-1")

    channel.dispatch({type: "set-item-count", value: 100})
    const expanded = channel.getSnapshot()
    expect(expanded.items).toHaveLength(FLEX_STORY_BOUNDS.itemCount.max)
    expect(expanded.items[0]).toBe(retained)
    expect(expanded.items.at(-1)?.id).toBe(`item-${FLEX_STORY_BOUNDS.itemCount.max}`)
    expect(() => channel.dispatch({type: "select-item", itemId: "missing"})).toThrow("Unknown")
  })

  test("exposes a branded versioned channel and keeps teardown reads stable", () => {
    const channel = createFlexStoryChannel()
    expect(channel.protocol).toBe(FLEX_STORY_CHANNEL_PROTOCOL)
    expect(channel.version).toBe(FLEX_STORY_CHANNEL_VERSION)
    expect(channel[FLEX_STORY_CHANNEL_BRAND]).toBeTrue()
    expect(isFlexStoryChannel(channel)).toBeTrue()
    expect(isFlexStoryChannel({...channel, version: 2})).toBeFalse()

    const finalSnapshot = channel.getSnapshot()
    let notifications = 0
    const unsubscribe = channel.subscribe(() => notifications++)
    channel.dispose()
    channel.dispose()
    unsubscribe()
    expect(notifications).toBe(0)
    expect(() => channel.dispatch({type: "set-wrap", value: "nowrap"})).toThrow("disposed")
    expect(() => channel.reset()).toThrow("disposed")
    expect(channel.getSnapshot()).toBe(finalSnapshot)
    const staleUnsubscribe = channel.subscribe(() => notifications++)
    staleUnsubscribe()
    expect(notifications).toBe(0)
  })
})
