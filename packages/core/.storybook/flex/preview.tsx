import {useSyncExternalStore} from "@zavx0z/react"
import type {
  FlexStoryBasisValue,
  FlexStoryChannel,
  FlexStoryGapValue,
  FlexStoryItem,
} from "./contract.ts"

export type FlexStoryPreviewProps = Readonly<{
  channel: FlexStoryChannel
}>

type FlexStoryItemViewProps = Readonly<{
  item: FlexStoryItem
  selected: boolean
}>

/** One retained semantic item whose box is positioned only by its Flex parent. */
function FlexStoryItemView(props: FlexStoryItemViewProps) {
  const item = props.item
  return <article
    role="listitem"
    data-flex-story-item={item.id}
    data-selected={props.selected ? "true" : undefined}
    aria-current={props.selected ? "true" : undefined}
    aria-label={props.selected ? `${item.label}, выбран` : item.label}
    style={css`
      & {
        box-sizing: border-box;
        display: block;
        width: ${sizeCss(item.widthMode, item.width)};
        height: ${sizeCss(item.heightMode, item.height)};
        min-width: 0;
        min-height: 0;
        flex-grow: ${item.grow};
        flex-shrink: ${item.shrink};
        flex-basis: ${basisCss(item.basis)};
        margin: ${item.margin.top}px ${item.margin.right}px ${item.margin.bottom}px ${item.margin.left}px;
        padding: 8px;
        overflow: hidden;
        border: 1px solid rgb(92 101 116);
        border-radius: 4px;
        background: rgb(48 54 65);
        color: rgb(236 239 244);
      }
      &[data-selected="true"] {
        border-color: rgb(96 165 250);
        background: rgb(42 67 101);
      }
    `}
  >
    <code>{item.label}</code>
  </article>
}

/** Renderer-owned compiled CSS Flex story; Inspector owns every control. */
export function FlexStoryPreview(props: FlexStoryPreviewProps) {
  const state = useSyncExternalStore(props.channel.subscribe, props.channel.getSnapshot)
  const container = state.container
  return <section
    data-flex-story-preview=""
    data-preset={state.presetId}
    style={css`
      & {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        gap: 8px;
        padding: 8px;
        overflow: hidden;
        background: rgb(22 25 31);
        color: rgb(236 239 244);
      }
    `}
  >
    <header style={css`
      & {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        gap: 2px;
      }
    `}>
      CSS Flex
      <code>{containerSummary(container)}</code>
    </header>
    <section
      data-flex-story-stage=""
      aria-label="Область Flex"
      style={css`
        & {
          box-sizing: border-box;
          display: block;
          min-width: 0;
          min-height: 0;
          flex-grow: 1;
          padding: 12px;
          overflow: auto;
          border: 1px solid rgb(55 65 81);
          border-radius: 4px;
          background: rgb(15 18 23);
        }
      `}
    >
      <section
        role="list"
        data-flex-story-container=""
        data-direction={container.direction}
        data-wrap={container.wrap}
        data-justify-content={container.justifyContent}
        data-align-items={container.alignItems}
        data-align-content={container.alignContent}
        aria-label="Контейнер Flex"
        style={css`
          & {
            box-sizing: border-box;
            display: flex;
            width: ${container.width}px;
            height: ${container.height}px;
            flex-direction: ${container.direction};
            flex-wrap: ${container.wrap};
            flex-shrink: 0;
            justify-content: ${container.justifyContent};
            align-items: ${container.alignItems};
            align-content: ${container.alignContent};
            row-gap: ${gapCss(container.rowGap)};
            column-gap: ${gapCss(container.columnGap)};
            padding: 8px;
            border: 1px solid rgb(99 102 241);
            border-radius: 5px;
            background: rgb(30 34 43);
          }
        `}
      >
        {state.items.map(item => <FlexStoryItemView
          key={item.id}
          item={item}
          selected={item.id === state.selectedItemId}
        />)}
      </section>
    </section>
  </section>
}

function gapCss(value: FlexStoryGapValue): string {
  return value.kind === "normal" ? "normal" : `${value.value}px`
}

function basisCss(value: FlexStoryBasisValue): string {
  return value.kind === "auto" ? "auto" : `${value.value}px`
}

function sizeCss(mode: "auto" | "px", value: number): string {
  return mode === "auto" ? "auto" : `${value}px`
}

function containerSummary(container: Readonly<{
  direction: string
  wrap: string
  justifyContent: string
  alignItems: string
  alignContent: string
}>): string {
  return [
    `flex-direction: ${container.direction}`,
    `flex-wrap: ${container.wrap}`,
    `justify-content: ${container.justifyContent}`,
    `align-items: ${container.alignItems}`,
    `align-content: ${container.alignContent}`,
  ].join("; ")
}
