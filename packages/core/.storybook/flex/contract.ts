export const FLEX_STORY_CHANNEL_PROTOCOL = "flex-story-controls/1" as const
export const FLEX_STORY_CHANNEL_VERSION = 1 as const
export const FLEX_STORY_CHANNEL_BRAND = Symbol.for(
  "@zavx0z/renderer/flex-story-channel",
)

export const FLEX_STORY_DIRECTIONS = Object.freeze(["row", "column"] as const)
export const FLEX_STORY_SIZE_MODES = Object.freeze(["auto", "px"] as const)
export const FLEX_STORY_WRAPS = Object.freeze([
  "nowrap",
  "wrap",
  "wrap-reverse",
] as const)
export const FLEX_STORY_JUSTIFY_CONTENTS = Object.freeze([
  "flex-start",
  "flex-end",
  "center",
  "space-between",
  "space-around",
  "space-evenly",
] as const)
export const FLEX_STORY_ALIGN_ITEMS = Object.freeze([
  "stretch",
  "flex-start",
  "center",
  "flex-end",
] as const)
export const FLEX_STORY_ALIGN_CONTENTS = Object.freeze([
  "normal",
  "stretch",
  "flex-start",
  "flex-end",
  "center",
  "space-between",
  "space-around",
  "space-evenly",
] as const)
export const FLEX_STORY_PRESET_IDS = Object.freeze([
  "packing",
  "alignment",
  "sizing",
  "column",
  "reverse",
  "shrink",
] as const)

type NumericBounds = Readonly<{min: number; max: number}>

export const FLEX_STORY_BOUNDS = Object.freeze({
  containerWidth: Object.freeze({min: 160, max: 960}) satisfies NumericBounds,
  containerHeight: Object.freeze({min: 120, max: 720}) satisfies NumericBounds,
  itemCount: Object.freeze({min: 1, max: 12}) satisfies NumericBounds,
  itemWidth: Object.freeze({min: 16, max: 480}) satisfies NumericBounds,
  itemHeight: Object.freeze({min: 16, max: 360}) satisfies NumericBounds,
  flexFactor: Object.freeze({min: 0, max: 8}) satisfies NumericBounds,
  basis: Object.freeze({min: 0, max: 640}) satisfies NumericBounds,
  gap: Object.freeze({min: 0, max: 128}) satisfies NumericBounds,
  margin: Object.freeze({min: -128, max: 128}) satisfies NumericBounds,
})

export type FlexStoryDirection = typeof FLEX_STORY_DIRECTIONS[number]
export type FlexStorySizeMode = typeof FLEX_STORY_SIZE_MODES[number]
export type FlexStoryWrap = typeof FLEX_STORY_WRAPS[number]
export type FlexStoryJustifyContent = typeof FLEX_STORY_JUSTIFY_CONTENTS[number]
export type FlexStoryAlignItems = typeof FLEX_STORY_ALIGN_ITEMS[number]
export type FlexStoryAlignContent = typeof FLEX_STORY_ALIGN_CONTENTS[number]
export type FlexStoryPresetId = typeof FLEX_STORY_PRESET_IDS[number]
export type FlexStoryActivePresetId = FlexStoryPresetId | "custom"
export type FlexStoryAxis = "width" | "height"
export type FlexStoryGapAxis = "row" | "column"
export type FlexStoryMarginEdge = "top" | "right" | "bottom" | "left"
export type FlexStoryItemNumberProperty = "width" | "height" | "grow" | "shrink"

export type FlexStoryGapValue =
  | Readonly<{kind: "normal"}>
  | Readonly<{kind: "px"; value: number}>

export type FlexStoryBasisValue =
  | Readonly<{kind: "auto"}>
  | Readonly<{kind: "px"; value: number}>

export type FlexStoryPhysicalMargins = Readonly<{
  top: number
  right: number
  bottom: number
  left: number
}>

export type FlexStoryItem = Readonly<{
  id: string
  label: string
  width: number
  height: number
  widthMode: FlexStorySizeMode
  heightMode: FlexStorySizeMode
  grow: number
  shrink: number
  basis: FlexStoryBasisValue
  margin: FlexStoryPhysicalMargins
}>

export type FlexStoryContainer = Readonly<{
  width: number
  height: number
  direction: FlexStoryDirection
  wrap: FlexStoryWrap
  justifyContent: FlexStoryJustifyContent
  alignItems: FlexStoryAlignItems
  alignContent: FlexStoryAlignContent
  rowGap: FlexStoryGapValue
  columnGap: FlexStoryGapValue
}>

export type FlexStoryState = Readonly<{
  presetId: FlexStoryActivePresetId
  container: FlexStoryContainer
  items: readonly FlexStoryItem[]
  selectedItemId: string
}>

export type FlexStoryAction =
  | Readonly<{type: "apply-preset"; presetId: FlexStoryPresetId}>
  | Readonly<{type: "set-container-size"; axis: FlexStoryAxis; value: number}>
  | Readonly<{type: "set-direction"; value: FlexStoryDirection}>
  | Readonly<{type: "set-wrap"; value: FlexStoryWrap}>
  | Readonly<{type: "set-justify-content"; value: FlexStoryJustifyContent}>
  | Readonly<{type: "set-align-items"; value: FlexStoryAlignItems}>
  | Readonly<{type: "set-align-content"; value: FlexStoryAlignContent}>
  | Readonly<{
      type: "set-gap"
      axis: FlexStoryGapAxis
      value: FlexStoryGapValue
    }>
  | Readonly<{type: "set-item-count"; value: number}>
  | Readonly<{type: "select-item"; itemId: string}>
  | Readonly<{
      type: "set-item-size-mode"
      itemId: string
      axis: FlexStoryAxis
      value: FlexStorySizeMode
    }>
  | Readonly<{
      type: "set-item-number"
      itemId: string
      property: FlexStoryItemNumberProperty
      value: number
    }>
  | Readonly<{
      type: "set-item-basis"
      itemId: string
      value: FlexStoryBasisValue
    }>
  | Readonly<{
      type: "set-item-margin"
      itemId: string
      edge: FlexStoryMarginEdge
      value: number
    }>

export type FlexStorySubscriber = () => void

export type FlexStoryChannel = Readonly<{
  readonly [FLEX_STORY_CHANNEL_BRAND]: true
  protocol: typeof FLEX_STORY_CHANNEL_PROTOCOL
  version: typeof FLEX_STORY_CHANNEL_VERSION
  getSnapshot(): FlexStoryState
  subscribe(subscriber: FlexStorySubscriber): () => void
  dispatch(action: FlexStoryAction): void
  reset(): void
  dispose(): void
}>
