import {
  FLEX_STORY_ALIGN_CONTENTS,
  FLEX_STORY_ALIGN_ITEMS,
  FLEX_STORY_BOUNDS,
  FLEX_STORY_CHANNEL_BRAND,
  FLEX_STORY_CHANNEL_PROTOCOL,
  FLEX_STORY_CHANNEL_VERSION,
  FLEX_STORY_DIRECTIONS,
  FLEX_STORY_JUSTIFY_CONTENTS,
  FLEX_STORY_SIZE_MODES,
  FLEX_STORY_WRAPS,
  type FlexStoryAction,
  type FlexStoryBasisValue,
  type FlexStoryChannel,
  type FlexStoryGapValue,
  type FlexStoryItem,
  type FlexStoryPresetId,
  type FlexStoryState,
  type FlexStorySubscriber,
} from "./contract.ts"
import {
  createDefaultFlexStoryItem,
  flexStoryPreset,
} from "./presets.ts"

type Bound = Readonly<{min: number; max: number}>

export function reduceFlexStoryState(
  current: FlexStoryState,
  action: FlexStoryAction,
): FlexStoryState {
  switch (action.type) {
    case "apply-preset":
      return flexStoryPreset(action.presetId).state
    case "set-container-size": {
      const property = action.axis
      const bound = property === "width"
        ? FLEX_STORY_BOUNDS.containerWidth
        : FLEX_STORY_BOUNDS.containerHeight
      const value = boundedNumber(action.value, bound, `container ${property}`)
      if (current.container[property] === value) return current
      return withContainer(current, {[property]: value})
    }
    case "set-direction":
      assertOption(action.value, FLEX_STORY_DIRECTIONS, "direction")
      return current.container.direction === action.value
        ? current
        : withContainer(current, {direction: action.value})
    case "set-wrap":
      assertOption(action.value, FLEX_STORY_WRAPS, "wrap")
      return current.container.wrap === action.value
        ? current
        : withContainer(current, {wrap: action.value})
    case "set-justify-content":
      assertOption(action.value, FLEX_STORY_JUSTIFY_CONTENTS, "justify-content")
      return current.container.justifyContent === action.value
        ? current
        : withContainer(current, {justifyContent: action.value})
    case "set-align-items":
      assertOption(action.value, FLEX_STORY_ALIGN_ITEMS, "align-items")
      return current.container.alignItems === action.value
        ? current
        : withContainer(current, {alignItems: action.value})
    case "set-align-content":
      assertOption(action.value, FLEX_STORY_ALIGN_CONTENTS, "align-content")
      return current.container.alignContent === action.value
        ? current
        : withContainer(current, {alignContent: action.value})
    case "set-gap": {
      const property = action.axis === "row" ? "rowGap" : "columnGap"
      const value = normalizedGap(action.value)
      return sameGap(current.container[property], value)
        ? current
        : withContainer(current, {[property]: value})
    }
    case "set-item-count":
      return withItemCount(current, boundedInteger(
        action.value,
        FLEX_STORY_BOUNDS.itemCount,
        "item count",
      ))
    case "select-item":
      requiredItem(current, action.itemId)
      return current.selectedItemId === action.itemId
        ? current
        : Object.freeze({...current, selectedItemId: action.itemId})
    case "set-item-size-mode": {
      assertOption(action.value, FLEX_STORY_SIZE_MODES, `item ${action.axis} mode`)
      const property = action.axis === "width" ? "widthMode" : "heightMode"
      return updateItem(current, action.itemId, item =>
        item[property] === action.value
          ? item
          : Object.freeze({...item, [property]: action.value}))
    }
    case "set-item-number": {
      const bound = action.property === "width"
        ? FLEX_STORY_BOUNDS.itemWidth
        : action.property === "height"
          ? FLEX_STORY_BOUNDS.itemHeight
          : FLEX_STORY_BOUNDS.flexFactor
      const value = boundedNumber(action.value, bound, `item ${action.property}`)
      return updateItem(current, action.itemId, item =>
        item[action.property] === value
          ? item
          : Object.freeze({...item, [action.property]: value}))
    }
    case "set-item-basis": {
      const value = normalizedBasis(action.value)
      return updateItem(current, action.itemId, item =>
        sameBasis(item.basis, value) ? item : Object.freeze({...item, basis: value}))
    }
    case "set-item-margin": {
      const value = boundedNumber(
        action.value,
        FLEX_STORY_BOUNDS.margin,
        `item margin ${action.edge}`,
      )
      return updateItem(current, action.itemId, item => {
        if (item.margin[action.edge] === value) return item
        const margin = Object.freeze({...item.margin, [action.edge]: value})
        return Object.freeze({...item, margin})
      })
    }
  }
}

export function createFlexStoryChannel(
  initialPresetId: FlexStoryPresetId = "packing",
): FlexStoryChannel {
  let snapshot = flexStoryPreset(initialPresetId).state
  let resetSnapshot = snapshot
  let disposed = false
  const subscribers = new Set<FlexStorySubscriber>()

  const assertActive = (): void => {
    if (disposed) throw new Error("Flex Storybook channel is disposed")
  }
  const publish = (next: FlexStoryState): void => {
    if (next === snapshot) return
    snapshot = next
    for (const subscriber of [...subscribers]) subscriber()
  }

  return Object.freeze({
    [FLEX_STORY_CHANNEL_BRAND]: true as const,
    protocol: FLEX_STORY_CHANNEL_PROTOCOL,
    version: FLEX_STORY_CHANNEL_VERSION,
    getSnapshot(): FlexStoryState {
      return snapshot
    },
    subscribe(subscriber: FlexStorySubscriber): () => void {
      if (typeof subscriber !== "function") {
        throw new TypeError("Flex Storybook subscriber must be a function")
      }
      if (disposed) return () => {}
      subscribers.add(subscriber)
      let active = true
      return () => {
        if (!active) return
        active = false
        subscribers.delete(subscriber)
      }
    },
    dispatch(action: FlexStoryAction): void {
      assertActive()
      const next = reduceFlexStoryState(snapshot, action)
      if (action.type === "apply-preset") resetSnapshot = next
      publish(next)
    },
    reset(): void {
      assertActive()
      publish(resetSnapshot)
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      subscribers.clear()
    },
  })
}

export function isFlexStoryChannel(value: unknown): value is FlexStoryChannel {
  if (value === null || typeof value !== "object") return false
  const candidate = value as Partial<FlexStoryChannel>
  return candidate[FLEX_STORY_CHANNEL_BRAND] === true &&
    candidate.protocol === FLEX_STORY_CHANNEL_PROTOCOL &&
    candidate.version === FLEX_STORY_CHANNEL_VERSION &&
    typeof candidate.getSnapshot === "function" &&
    typeof candidate.subscribe === "function" &&
    typeof candidate.dispatch === "function" &&
    typeof candidate.reset === "function" &&
    typeof candidate.dispose === "function"
}

function withContainer(
  state: FlexStoryState,
  patch: Partial<FlexStoryState["container"]>,
): FlexStoryState {
  return Object.freeze({
    ...state,
    presetId: "custom",
    container: Object.freeze({...state.container, ...patch}),
  })
}

function withItemCount(state: FlexStoryState, count: number): FlexStoryState {
  if (state.items.length === count) return state
  const nextItems = count < state.items.length
    ? state.items.slice(0, count)
    : [
        ...state.items,
        ...Array.from(
          {length: count - state.items.length},
          (_, index) => createDefaultFlexStoryItem(state.items.length + index + 1),
        ),
      ]
  const items = Object.freeze(nextItems)
  const selectedItemId = items.some(item => item.id === state.selectedItemId)
    ? state.selectedItemId
    : items.at(-1)!.id
  return Object.freeze({...state, presetId: "custom", items, selectedItemId})
}

function updateItem(
  state: FlexStoryState,
  itemId: string,
  update: (item: FlexStoryItem) => FlexStoryItem,
): FlexStoryState {
  const index = requiredItemIndex(state, itemId)
  const current = state.items[index]!
  const next = update(current)
  if (next === current) return state
  const items = [...state.items]
  items[index] = next
  return Object.freeze({...state, presetId: "custom", items: Object.freeze(items)})
}

function requiredItem(state: FlexStoryState, itemId: string): FlexStoryItem {
  return state.items[requiredItemIndex(state, itemId)]!
}

function requiredItemIndex(state: FlexStoryState, itemId: string): number {
  const index = state.items.findIndex(item => item.id === itemId)
  if (index < 0) throw new Error(`Unknown Flex Storybook item: ${itemId}`)
  return index
}

function normalizedGap(value: FlexStoryGapValue): FlexStoryGapValue {
  if (value?.kind === "normal") return Object.freeze({kind: "normal"})
  if (value?.kind !== "px") throw new TypeError("Flex Storybook gap must be normal or px")
  return Object.freeze({
    kind: "px",
    value: boundedNumber(value.value, FLEX_STORY_BOUNDS.gap, "gap"),
  })
}

function normalizedBasis(value: FlexStoryBasisValue): FlexStoryBasisValue {
  if (value?.kind === "auto") return Object.freeze({kind: "auto"})
  if (value?.kind !== "px") throw new TypeError("Flex Storybook basis must be auto or px")
  return Object.freeze({
    kind: "px",
    value: boundedNumber(value.value, FLEX_STORY_BOUNDS.basis, "basis"),
  })
}

function sameGap(left: FlexStoryGapValue, right: FlexStoryGapValue): boolean {
  return left.kind === right.kind &&
    (left.kind === "normal" || right.kind === "normal" || left.value === right.value)
}

function sameBasis(left: FlexStoryBasisValue, right: FlexStoryBasisValue): boolean {
  return left.kind === right.kind &&
    (left.kind === "auto" || right.kind === "auto" || left.value === right.value)
}

function boundedInteger(value: number, bound: Bound, label: string): number {
  return Math.round(boundedNumber(value, bound, label))
}

function boundedNumber(value: number, bound: Bound, label: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`Flex Storybook ${label} must be finite`)
  return Math.min(bound.max, Math.max(bound.min, value))
}

function assertOption<Value extends string>(
  value: Value,
  options: readonly Value[],
  label: string,
): void {
  if (!options.includes(value)) throw new Error(`Unknown Flex Storybook ${label}: ${String(value)}`)
}
