import {
  FLEX_STORY_BOUNDS,
  type FlexStoryBasisValue,
  type FlexStoryContainer,
  type FlexStoryGapValue,
  type FlexStoryItem,
  type FlexStoryPhysicalMargins,
  type FlexStoryPresetId,
  type FlexStoryState,
} from "./contract.ts"

export type FlexStoryPreset = Readonly<{
  id: FlexStoryPresetId
  label: string
  state: FlexStoryState
}>

const NORMAL_GAP: FlexStoryGapValue = Object.freeze({kind: "normal"})
const AUTO_BASIS: FlexStoryBasisValue = Object.freeze({kind: "auto"})
const ZERO_MARGINS: FlexStoryPhysicalMargins = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

const pxGap = (value: number): FlexStoryGapValue => Object.freeze({kind: "px", value})
const pxBasis = (value: number): FlexStoryBasisValue => Object.freeze({kind: "px", value})

const item = (
  ordinal: number,
  values: Partial<Omit<FlexStoryItem, "id" | "label">> = {},
): FlexStoryItem => Object.freeze({
  id: `item-${ordinal}`,
  label: `Элемент ${ordinal}`,
  width: values.width ?? 96,
  height: values.height ?? 48,
  widthMode: values.widthMode ?? "px",
  heightMode: values.heightMode ?? "px",
  grow: values.grow ?? 0,
  shrink: values.shrink ?? 1,
  basis: values.basis ?? AUTO_BASIS,
  margin: values.margin ?? ZERO_MARGINS,
})

const items = (
  count: number,
  values: Partial<Omit<FlexStoryItem, "id" | "label">> = {},
): readonly FlexStoryItem[] => Object.freeze(
  Array.from({length: count}, (_, index) => item(index + 1, values)),
)

const state = (
  presetId: FlexStoryPresetId,
  container: FlexStoryContainer,
  presetItems: readonly FlexStoryItem[],
): FlexStoryState => Object.freeze({
  presetId,
  container: Object.freeze(container),
  items: Object.freeze([...presetItems]),
  selectedItemId: presetItems[0]!.id,
})

const preset = (
  id: FlexStoryPresetId,
  label: string,
  value: FlexStoryState,
): FlexStoryPreset => Object.freeze({id, label, state: value})

const packing = state("packing", {
  width: 360,
  height: 260,
  direction: "row",
  wrap: "wrap",
  justifyContent: "flex-start",
  alignItems: "flex-start",
  alignContent: "flex-start",
  rowGap: pxGap(12),
  columnGap: pxGap(8),
}, items(8))

const alignment = state("alignment", {
  width: 420,
  height: 300,
  direction: "row",
  wrap: "wrap",
  justifyContent: "space-between",
  alignItems: "center",
  alignContent: "space-around",
  rowGap: pxGap(16),
  columnGap: pxGap(8),
}, Object.freeze([
  item(1, {height: 36, heightMode: "auto"}),
  item(2, {height: 64, margin: Object.freeze({...ZERO_MARGINS, top: 8})}),
  item(3, {height: 44, heightMode: "auto"}),
  item(4, {height: 72}),
  item(5, {height: 52, heightMode: "auto"}),
  item(6, {height: 40}),
]))

const sizing = state("sizing", {
  width: 520,
  height: 180,
  direction: "row",
  wrap: "nowrap",
  justifyContent: "flex-start",
  alignItems: "center",
  alignContent: "normal",
  rowGap: NORMAL_GAP,
  columnGap: pxGap(8),
}, Object.freeze([
  item(1, {width: 100, height: 56, grow: 1, shrink: 0, basis: pxBasis(80)}),
  item(2, {width: 120, height: 72, grow: 2, shrink: 1, basis: pxBasis(100)}),
  item(3, {width: 100, height: 48, grow: 1, shrink: 2, basis: pxBasis(80)}),
]))

const column = state("column", {
  width: 360,
  height: 260,
  direction: "column",
  wrap: "wrap",
  justifyContent: "center",
  alignItems: "flex-start",
  alignContent: "flex-start",
  rowGap: pxGap(8),
  columnGap: pxGap(20),
}, items(7, {width: 72, height: 64}))

const reverse = state("reverse", {
  width: 340,
  height: 240,
  direction: "row",
  wrap: "wrap-reverse",
  justifyContent: "flex-start",
  alignItems: "flex-start",
  alignContent: "flex-start",
  rowGap: pxGap(14),
  columnGap: pxGap(8),
}, items(6, {width: 96, height: 40}))

const shrink = state("shrink", {
  width: 240,
  height: 160,
  direction: "row",
  wrap: "nowrap",
  justifyContent: "flex-start",
  alignItems: "center",
  alignContent: "normal",
  rowGap: NORMAL_GAP,
  columnGap: pxGap(12),
}, Object.freeze([
  item(1, {width: 140, height: 72, grow: 0, shrink: 1, basis: pxBasis(140)}),
  item(2, {width: 140, height: 72, grow: 0, shrink: 2, basis: pxBasis(140)}),
  item(3, {width: 140, height: 72, grow: 0, shrink: 1, basis: pxBasis(140)}),
]))

export const FLEX_STORY_PRESETS: readonly FlexStoryPreset[] = Object.freeze([
  preset("packing", "Упаковка", packing),
  preset("alignment", "Выравнивание", alignment),
  preset("sizing", "Размеры", sizing),
  preset("column", "Колонка", column),
  preset("reverse", "Обратный перенос", reverse),
  preset("shrink", "Сжатие", shrink),
])

export function flexStoryPreset(id: FlexStoryPresetId): FlexStoryPreset {
  const value = FLEX_STORY_PRESETS.find(candidate => candidate.id === id)
  if (value === undefined) throw new Error(`Unknown Flex Storybook preset: ${String(id)}`)
  return value
}

export function createDefaultFlexStoryItem(ordinal: number): FlexStoryItem {
  const maximum = FLEX_STORY_BOUNDS.itemCount.max
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > maximum) {
    throw new RangeError(`Flex Storybook item ordinal must be between 1 and ${maximum}`)
  }
  return item(ordinal)
}
