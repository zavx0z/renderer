import {useState, useSyncExternalStore} from "@zavx0z/react"
import {
  FLEX_STORY_ALIGN_CONTENTS,
  FLEX_STORY_ALIGN_ITEMS,
  FLEX_STORY_BOUNDS,
  FLEX_STORY_DIRECTIONS,
  FLEX_STORY_JUSTIFY_CONTENTS,
  FLEX_STORY_SIZE_MODES,
  FLEX_STORY_WRAPS,
  type FlexStoryBasisValue,
  type FlexStoryChannel,
  type FlexStoryGapAxis,
  type FlexStoryGapValue,
  type FlexStoryItem,
  type FlexStoryItemNumberProperty,
  type FlexStoryMarginEdge,
} from "./contract.ts"
import {isFlexStoryChannel} from "./store.ts"

export type FlexControlsWidgetProps = Readonly<{value: unknown}>

type ChoiceOption = Readonly<{
  value: string
  label: string
  disabled?: boolean
}>

type ChoiceControlProps = Readonly<{
  label: string
  value: string
  options: readonly ChoiceOption[]
  disabled?: boolean
  onChange(value: string): void
}>

type ChoiceButtonProps = Readonly<{
  controlLabel: string
  choice: ChoiceOption
  selected: boolean
  disabled: boolean
  onChange(value: string): void
}>

type NumberControlProps = Readonly<{
  label: string
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  onInput(value: number): void
}>

const FLEX_CONTROL_PANEL_IDS = Object.freeze([
  "setup",
  "alignment",
  "gaps",
  "item",
  "limits",
] as const)

type FlexControlPanelId = typeof FLEX_CONTROL_PANEL_IDS[number]

const FLEX_CONTROL_PANEL_OPTIONS: readonly ChoiceOption[] = Object.freeze([
  Object.freeze({value: "setup", label: "Основное"}),
  Object.freeze({value: "alignment", label: "Выравнивание"}),
  Object.freeze({value: "gaps", label: "Промежутки"}),
  Object.freeze({value: "item", label: "Элемент"}),
  Object.freeze({value: "limits", label: "Ограничения"}),
])

const UNSUPPORTED_FLEX_FEATURES = Object.freeze([
  "row-reverse и column-reverse",
  "flex-flow",
  "order",
  "align-self",
  "процентные значения gap",
  "декорации и линии gap",
  "режимы письма",
  "полный intrinsic-расчёт многострочного Flex",
])

function ChoiceButton(props: ChoiceButtonProps) {
  const choice = props.choice
  return <button
    type="button"
    aria-label={`${props.controlLabel}: ${choice.label}`}
    aria-pressed={props.selected ? "true" : "false"}
    disabled={props.disabled || choice.disabled === true}
    onClick={() => props.onChange(choice.value)}
    style={css`
      box-sizing: border-box;
      display: block;
      min-width: 0;
      height: 24px;
      padding: 2px 6px;
      border: 1px solid rgb(75 85 99);
      border-radius: 3px;
      background: rgb(31 35 43);
      color: rgb(236 239 244);

      &[aria-pressed="true"] {
        border-color: rgb(96 165 250);
        background: rgb(42 67 101);
      }

      &:focus {
        border-color: rgb(147 197 253);
        background: rgb(48 74 110);
      }

      &:disabled {
        opacity: 0.55;
      }
    `}
  >{choice.label}</button>
}

function UnsupportedFeature(props: Readonly<{feature: string}>) {
  return <li><code>{props.feature}</code></li>
}

function ChoiceControl(props: ChoiceControlProps) {
  return <section
    role="group"
    aria-label={props.label}
    data-flex-choice-control=""
    style={css`
      display: flex;
      flex-direction: column;
      min-width: 0;
      gap: 4px;
    `}
  >
    <code>{props.label}</code>
    <section style={css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 3px;
    `}>
      {props.options.map(choice => <ChoiceButton
        key={choice.value}
        controlLabel={props.label}
        choice={choice}
        selected={choice.value === props.value}
        disabled={props.disabled === true}
        onChange={props.onChange}
      />)}
    </section>
  </section>
}

function NumberControl(props: NumberControlProps) {
  const step = props.step ?? 1
  return <section
    role="group"
    aria-label={`${props.label}: управление`}
    data-flex-number-control=""
    style={css`
      display: flex;
      flex-direction: row;
      align-items: center;
      min-width: 0;
      gap: 6px;
    `}
  >
    <code style={css`
      min-width: 104px;
      flex-shrink: 0;
    `}>{props.label}</code>
    <button
      type="button"
      aria-label={`Уменьшить: ${props.label}`}
      disabled={props.disabled === true || props.value <= props.min}
      onClick={() => props.onInput(props.value - step)}
      style={css`
        box-sizing: border-box;
        display: block;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 1px solid rgb(75 85 99);
        border-radius: 3px;
        background: rgb(31 35 43);
        color: rgb(236 239 244);

        &:focus {
          border-color: rgb(147 197 253);
          background: rgb(48 74 110);
        }

        &:disabled {
          opacity: 0.55;
        }
      `}
    >−</button>
    <output
      aria-label={`Значение: ${props.label}`}
      data-min={props.min}
      data-max={props.max}
      data-step={step}
      style={css`
        box-sizing: border-box;
        display: block;
        min-width: 0;
        width: 64px;
        height: 24px;
        padding: 2px 5px;
        border: 1px solid rgb(75 85 99);
        border-radius: 3px;
        background: rgb(31 35 43);
        color: rgb(236 239 244);
      `}
    >{props.value}</output>
    <button
      type="button"
      aria-label={`Увеличить: ${props.label}`}
      disabled={props.disabled === true || props.value >= props.max}
      onClick={() => props.onInput(props.value + step)}
      style={css`
        box-sizing: border-box;
        display: block;
        width: 24px;
        height: 24px;
        padding: 0;
        border: 1px solid rgb(75 85 99);
        border-radius: 3px;
        background: rgb(31 35 43);
        color: rgb(236 239 244);

        &:focus {
          border-color: rgb(147 197 253);
          background: rgb(48 74 110);
        }

        &:disabled {
          opacity: 0.55;
        }
      `}
    >+</button>
  </section>
}

function GapControl(props: Readonly<{
  axis: FlexStoryGapAxis
  value: FlexStoryGapValue
  channel: FlexStoryChannel
}>) {
  const label = props.axis === "row" ? "row-gap" : "column-gap"
  const dispatch = (value: FlexStoryGapValue) => props.channel.dispatch({
    type: "set-gap",
    axis: props.axis,
    value,
  })
  return <section
    data-flex-gap-control={props.axis}
    style={css`
      display: flex;
      flex-direction: column;
      gap: 4px;
    `}
  >
    <ChoiceControl
      label={`Режим ${label}`}
      value={props.value.kind}
      options={[
        {value: "normal", label: "normal"},
        {value: "px", label: "px"},
      ]}
      onChange={kind => dispatch(kind === "normal"
        ? {kind: "normal"}
        : {kind: "px", value: props.value.kind === "px" ? props.value.value : 0})}
    />
    <NumberControl
      label={label}
      value={props.value.kind === "px" ? props.value.value : 0}
      min={FLEX_STORY_BOUNDS.gap.min}
      max={FLEX_STORY_BOUNDS.gap.max}
      disabled={props.value.kind === "normal"}
      onInput={value => dispatch({kind: "px", value})}
    />
  </section>
}

function BasisControl(props: Readonly<{
  item: FlexStoryItem
  channel: FlexStoryChannel
}>) {
  const dispatch = (value: FlexStoryBasisValue) => props.channel.dispatch({
    type: "set-item-basis",
    itemId: props.item.id,
    value,
  })
  return <section
    data-flex-basis-control=""
    style={css`
      display: flex;
      flex-direction: column;
      gap: 4px;
    `}
  >
    <ChoiceControl
      label="Режим flex-basis"
      value={props.item.basis.kind}
      options={[
        {value: "auto", label: "auto"},
        {value: "px", label: "px"},
      ]}
      onChange={kind => dispatch(kind === "auto"
        ? {kind: "auto"}
        : {
            kind: "px",
            value: props.item.basis.kind === "px" ? props.item.basis.value : props.item.width,
          })}
    />
    <NumberControl
      label="flex-basis"
      value={props.item.basis.kind === "px" ? props.item.basis.value : 0}
      min={FLEX_STORY_BOUNDS.basis.min}
      max={FLEX_STORY_BOUNDS.basis.max}
      disabled={props.item.basis.kind === "auto"}
      onInput={value => dispatch({kind: "px", value})}
    />
  </section>
}

function SelectedItemControls(props: Readonly<{
  item: FlexStoryItem
  items: readonly FlexStoryItem[]
  channel: FlexStoryChannel
  hidden: boolean
}>) {
  const item = props.item
  const numberControls: readonly Readonly<{
    property: FlexStoryItemNumberProperty
    label: string
    min: number
    max: number
    step: number
  }>[] = [
    {property: "grow", label: "flex-grow", step: 0.25, ...FLEX_STORY_BOUNDS.flexFactor},
    {property: "shrink", label: "flex-shrink", step: 0.25, ...FLEX_STORY_BOUNDS.flexFactor},
    {property: "width", label: "Ширина элемента", step: 8, ...FLEX_STORY_BOUNDS.itemWidth},
    {property: "height", label: "Высота элемента", step: 8, ...FLEX_STORY_BOUNDS.itemHeight},
  ]
  const marginControls: readonly Readonly<{
    edge: FlexStoryMarginEdge
    label: string
  }>[] = [
    {edge: "top", label: "margin-top"},
    {edge: "right", label: "margin-right"},
    {edge: "bottom", label: "margin-bottom"},
    {edge: "left", label: "margin-left"},
  ]
  return <fieldset
    data-flex-controls-group="selected-item"
    hidden={props.hidden}
    style={css`
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 7px;
      border: 1px solid rgb(55 65 81);
      border-radius: 4px;

      &[hidden] {
        display: none;
      }
    `}
  >
    <legend>Выбранный элемент</legend>
    <ChoiceControl
      label="Выбранный элемент"
      value={item.id}
      options={props.items.map(candidate => ({value: candidate.id, label: candidate.label}))}
      onChange={itemId => props.channel.dispatch({type: "select-item", itemId})}
    />
    <ChoiceControl
      label="Режим ширины"
      value={item.widthMode}
      options={FLEX_STORY_SIZE_MODES.map(value => ({value, label: value}))}
      onChange={value => props.channel.dispatch({
        type: "set-item-size-mode",
        itemId: item.id,
        axis: "width",
        value: value as typeof item.widthMode,
      })}
    />
    <ChoiceControl
      label="Режим высоты"
      value={item.heightMode}
      options={FLEX_STORY_SIZE_MODES.map(value => ({value, label: value}))}
      onChange={value => props.channel.dispatch({
        type: "set-item-size-mode",
        itemId: item.id,
        axis: "height",
        value: value as typeof item.heightMode,
      })}
    />
    {numberControls.map(control => <NumberControl
      key={control.property}
      label={control.label}
      value={item[control.property]}
      min={control.min}
      max={control.max}
      step={control.step}
      disabled={control.property === "width"
        ? item.widthMode === "auto"
        : control.property === "height" && item.heightMode === "auto"}
      onInput={value => props.channel.dispatch({
        type: "set-item-number",
        itemId: item.id,
        property: control.property,
        value,
      })}
    />)}
    <BasisControl item={item} channel={props.channel} />
    {marginControls.map(control => <NumberControl
      key={control.edge}
      label={control.label}
      value={item.margin[control.edge]}
      min={FLEX_STORY_BOUNDS.margin.min}
      max={FLEX_STORY_BOUNDS.margin.max}
      onInput={value => props.channel.dispatch({
        type: "set-item-margin",
        itemId: item.id,
        edge: control.edge,
        value,
      })}
    />)}
  </fieldset>
}

function LiveFlexControls(props: Readonly<{channel: FlexStoryChannel}>) {
  const state = useSyncExternalStore(props.channel.subscribe, props.channel.getSnapshot)
  const [activePanel, setActivePanel] = useState<FlexControlPanelId>("setup")
  const container = state.container
  const selectedItem = state.items.find(item => item.id === state.selectedItemId)!
  const selectPanel = (value: string) => {
    if (!FLEX_CONTROL_PANEL_IDS.includes(value as FlexControlPanelId)) return
    setActivePanel(value as FlexControlPanelId)
  }
  return <section
    data-flex-controls-content="live"
    aria-label="Параметры Flex"
    style={css`
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      width: 100%;
      min-width: 0;
      gap: 7px;
      padding: 7px;
      overflow: auto;
      color: rgb(236 239 244);
    `}
  >
    <ChoiceControl
      label="Раздел"
      value={activePanel}
      options={FLEX_CONTROL_PANEL_OPTIONS}
      onChange={selectPanel}
    />

    <fieldset
      data-flex-controls-group="container"
      hidden={activePanel !== "setup"}
      style={css`
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 7px;
        border: 1px solid rgb(55 65 81);
        border-radius: 4px;

        &[hidden] {
          display: none;
        }
      `}
    >
      <legend>Контейнер</legend>
      <NumberControl
        label="Ширина контейнера"
        value={container.width}
        min={FLEX_STORY_BOUNDS.containerWidth.min}
        max={FLEX_STORY_BOUNDS.containerWidth.max}
        step={8}
        onInput={value => props.channel.dispatch({type: "set-container-size", axis: "width", value})}
      />
      <NumberControl
        label="Высота контейнера"
        value={container.height}
        min={FLEX_STORY_BOUNDS.containerHeight.min}
        max={FLEX_STORY_BOUNDS.containerHeight.max}
        step={8}
        onInput={value => props.channel.dispatch({type: "set-container-size", axis: "height", value})}
      />
      <ChoiceControl
        label="Направление (flex-direction)"
        value={container.direction}
        options={FLEX_STORY_DIRECTIONS.map(value => ({value, label: value}))}
        onChange={value => props.channel.dispatch({type: "set-direction", value: value as typeof container.direction})}
      />
      <ChoiceControl
        label="Перенос (flex-wrap)"
        value={container.wrap}
        options={FLEX_STORY_WRAPS.map(value => ({value, label: value}))}
        onChange={value => props.channel.dispatch({type: "set-wrap", value: value as typeof container.wrap})}
      />
    </fieldset>

    <fieldset
      data-flex-controls-group="alignment"
      hidden={activePanel !== "alignment"}
      style={css`
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 7px;
        border: 1px solid rgb(55 65 81);
        border-radius: 4px;

        &[hidden] {
          display: none;
        }
      `}
    >
      <legend>Выравнивание</legend>
      <ChoiceControl
        label="Главная ось (justify-content)"
        value={container.justifyContent}
        options={FLEX_STORY_JUSTIFY_CONTENTS.map(value => ({value, label: value}))}
        onChange={value => props.channel.dispatch({
          type: "set-justify-content",
          value: value as typeof container.justifyContent,
        })}
      />
      <ChoiceControl
        label="Элементы (align-items)"
        value={container.alignItems}
        options={FLEX_STORY_ALIGN_ITEMS.map(value => ({value, label: value}))}
        onChange={value => props.channel.dispatch({
          type: "set-align-items",
          value: value as typeof container.alignItems,
        })}
      />
      <ChoiceControl
        label="Строки (align-content)"
        value={container.alignContent}
        disabled={container.wrap === "nowrap"}
        options={FLEX_STORY_ALIGN_CONTENTS.map(value => ({value, label: value}))}
        onChange={value => props.channel.dispatch({
          type: "set-align-content",
          value: value as typeof container.alignContent,
        })}
      />
    </fieldset>

    <fieldset
      data-flex-controls-group="gaps"
      hidden={activePanel !== "gaps"}
      style={css`
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 7px;
        border: 1px solid rgb(55 65 81);
        border-radius: 4px;

        &[hidden] {
          display: none;
        }
      `}
    >
      <legend>Промежутки</legend>
      <GapControl axis="row" value={container.rowGap} channel={props.channel} />
      <GapControl axis="column" value={container.columnGap} channel={props.channel} />
    </fieldset>

    <fieldset
      data-flex-controls-group="items"
      hidden={activePanel !== "setup"}
      style={css`
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 7px;
        border: 1px solid rgb(55 65 81);
        border-radius: 4px;

        &[hidden] {
          display: none;
        }
      `}
    >
      <legend>Элементы</legend>
      <NumberControl
        label="Количество элементов"
        value={state.items.length}
        min={FLEX_STORY_BOUNDS.itemCount.min}
        max={FLEX_STORY_BOUNDS.itemCount.max}
        onInput={value => props.channel.dispatch({type: "set-item-count", value})}
      />
    </fieldset>

    <SelectedItemControls
      item={selectedItem}
      items={state.items}
      channel={props.channel}
      hidden={activePanel !== "item"}
    />

    <fieldset
      data-flex-controls-group="reset"
      hidden={activePanel !== "setup"}
      style={css`
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 7px;
        border: 1px solid rgb(55 65 81);
        border-radius: 4px;

        &[hidden] {
          display: none;
        }
      `}
    >
      <legend>Сброс</legend>
      <button
        type="button"
        aria-label="Сбросить параметры Flex"
        onClick={() => props.channel.reset()}
        style={css`
          box-sizing: border-box;
          display: block;
          height: 26px;
          border: 1px solid rgb(75 85 99);
          border-radius: 3px;
          background: rgb(48 54 65);
          color: rgb(236 239 244);

          &:focus {
            border-color: rgb(147 197 253);
            background: rgb(58 66 80);
          }

          &:hover {
            background: rgb(58 66 80);
          }
        `}
      >Сбросить</button>
    </fieldset>

    <fieldset
      data-flex-controls-group="unsupported"
      aria-readonly="true"
      hidden={activePanel !== "limits"}
      style={css`
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 7px;
        border: 1px solid rgb(55 65 81);
        border-radius: 4px;

        &[hidden] {
          display: none;
        }
      `}
    >
      <legend>Ограничения</legend>
      <ul aria-label="Неподдерживаемые возможности Flex" style={css`
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 0;
        padding-left: 18px;
      `}>
        {UNSUPPORTED_FLEX_FEATURES.map(feature => <UnsupportedFeature key={feature} feature={feature} />)}
      </ul>
    </fieldset>
  </section>
}

function PassiveFlexControls() {
  return <section
    data-flex-controls-content="passive"
    aria-label="Параметры Flex недоступны"
    style={css`
      box-sizing: border-box;
      display: block;
      width: 100%;
      padding: 8px;
      color: rgb(156 163 175);
    `}
  >Выберите вариант CSS / Flex</section>
}

/** Governed Inspector widget receiving only the package-owned value channel. */
export function FlexControlsWidget(props: FlexControlsWidgetProps) {
  const channel = isFlexStoryChannel(props.value) ? props.value : null
  return <section
    data-flex-controls-widget={channel === null ? "passive" : "live"}
    style={css`
      box-sizing: border-box;
      display: block;
      width: 100%;
      min-width: 0;
      min-height: 0;
    `}
  >
    {channel === null ? <PassiveFlexControls /> : null}
    {channel === null ? null : <LiveFlexControls channel={channel} />}
  </section>
}
