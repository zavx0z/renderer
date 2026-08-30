import {
  getPopoverVisibilityState,
  type Event,
  type HTMLElement,
} from "@zavx0z/dom"
import {useEffect, useId, useRef, useState} from "@zavx0z/react"
import type {
  ElementDomStoryRoute,
  ImageDomStoryRoute,
  PopoverDomStoryRoute,
} from "./dom-routes.ts"

export type DomInterfaceStoryViewProps = Readonly<{
  apiName: string
  title: string
  route: string
  summary: string
  hierarchy: readonly string[]
}>

export type ElementDomStoryViewProps = Readonly<{route: ElementDomStoryRoute}>
export type ImageDomStoryViewProps = Readonly<{route: ImageDomStoryRoute; src: string}>
export type PopoverDomStoryViewProps = Readonly<{route: PopoverDomStoryRoute}>

const storyRootStyle: CssStyle = css`
  & {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 620px;
    min-height: 300px;
    gap: 14px;
    padding: 18px;
    border: 1px solid rgb(22 22 22);
    border-radius: 6px;
    background: rgb(48 48 48);
    color: rgb(224 224 224);
  }
`

const sampleStyle: CssStyle = css`
  & {
    box-sizing: border-box;
    display: block;
    width: 240px;
    min-height: 30px;
    padding: 5px 10px;
    border: 1px solid rgb(72 72 72);
    border-radius: 4px;
    background: rgb(36 36 36);
    color: rgb(224 224 224);
    font-size: 12px;
  }
`

function HierarchyToken(props: Readonly<{name: string; first: boolean}>) {
  return <span style={css`& { display: flex; flex-direction: row; align-items: center; gap: 6px; }`}>
    {!props.first ? <HierarchyArrow /> : null}
    <code style={css`
      & { display: flex; align-items: center; height: 28px; padding: 4px 8px; border: 1px solid rgb(72 72 72); border-radius: 3px; background: rgb(36 36 36); color: rgb(224 224 224); font-size: 11px; }
    `}>{props.name}</code>
  </span>
}

function HierarchyArrow() {
  return <span aria-hidden="true" style={css`& { display: inline; width: 12px; color: rgb(126 220 236); }`}>→</span>
}

function InterfaceElementSample(props: Readonly<{htmlElement: boolean}>) {
  const content = props.htmlElement ? "title lives on HTMLElement" : "data-owner=DOM"
  return <section
    data-interface-sample="true"
    data-owner={props.htmlElement ? undefined : "DOM"}
    title={props.htmlElement ? "HTMLElement.title" : "Element attributes"}
    style={sampleStyle}
  >{content}</section>
}

function InterfaceDivSample() {
  return <div data-interface-sample="true" style={sampleStyle}>HTMLDivElement</div>
}

function InterfaceSpanSample() {
  return <span data-interface-sample="true" style={sampleStyle}>HTMLSpanElement</span>
}

function InterfaceHeadingSample() {
  return <h3 data-interface-sample="true" style={sampleStyle}>HTMLHeadingElement</h3>
}

function InterfaceParagraphSample() {
  return <p data-interface-sample="true" style={sampleStyle}>HTMLParagraphElement</p>
}

function InterfaceButtonSample() {
  return <button type="button" data-interface-sample="true" title="title inherited from HTMLElement" style={sampleStyle}>Output</button>
}

function InterfaceInputSample() {
  return <input type="text" value="Output" data-interface-sample="true" title="Live input value" style={sampleStyle} />
}

function InterfaceImageSample() {
  return <img src="" alt="Output preview" width="240" height="72" data-interface-sample="true" style={sampleStyle} />
}

function InterfaceOption(props: Readonly<{label: string; sample: boolean}>) {
  return <option
    value={props.label.toLocaleLowerCase()}
    selected={props.label === "Output"}
    data-interface-sample={props.sample ? "true" : undefined}
  >{props.label}</option>
}

function InterfaceSelectSample(props: Readonly<{optionInterface: boolean}>) {
  const values = props.optionInterface ? ["Output"] : ["Preview", "Output", "Capture"]
  return <select value="output" data-interface-sample={props.optionInterface ? undefined : "true"} style={sampleStyle}>
    {values.map(label => <InterfaceOption key={label} label={label} sample={props.optionInterface} />)}
  </select>
}

function InterfaceTextareaSample() {
  return <textarea rows="3" value={"Node\n  Element\n    HTMLElement"} readOnly={true} data-interface-sample="true" style={sampleStyle}></textarea>
}

function InterfaceProgressSample() {
  return <progress max="100" value="64" data-interface-sample="true" style={sampleStyle}></progress>
}

function InterfaceMeterSample() {
  return <meter min="0" max="100" low="25" high="75" optimum="50" value="64" data-interface-sample="true" style={sampleStyle}></meter>
}

function InterfaceLabelSample() {
  return <label htmlFor="interface-label-control" data-interface-sample="true" style={sampleStyle}>
    Output <input id="interface-label-control" type="text" value="Ready" />
  </label>
}

function InterfaceFieldSetSample() {
  return <fieldset name="output" disabled={true} data-interface-sample="true" style={sampleStyle}>
    <legend>Output</legend><input type="text" value="Ready" />
  </fieldset>
}

function InterfaceLegendSample() {
  return <fieldset><legend data-interface-sample="true" style={sampleStyle}>Output settings</legend></fieldset>
}

function InterfaceListItem(props: Readonly<{label: string; sample: boolean}>) {
  return <li data-interface-sample={props.sample ? "true" : undefined}>{props.label}</li>
}

function InterfaceListSample(props: Readonly<{itemInterface: boolean}>) {
  const values = props.itemInterface ? ["Output"] : ["Preview", "Output"]
  return <ul data-interface-sample={props.itemInterface ? undefined : "true"} style={sampleStyle}>
    {values.map(label => <InterfaceListItem key={label} label={label} sample={props.itemInterface} />)}
  </ul>
}

function InterfaceTableSample(props: Readonly<{apiName: string}>) {
  return <table data-interface-sample={props.apiName === "HTMLTableElement" ? "true" : undefined} style={sampleStyle}>
    <tbody data-interface-sample={props.apiName === "HTMLTableSectionElement" ? "true" : undefined}>
      <tr data-interface-sample={props.apiName === "HTMLTableRowElement" ? "true" : undefined}>
        <th scope="row" colSpan="1" data-interface-sample={props.apiName === "HTMLTableCellElement" ? "true" : undefined}>State</th>
        <td>Ready</td>
      </tr>
    </tbody>
  </table>
}

function InterfaceCodeSample(props: Readonly<{value: string}>) {
  return <code data-interface-sample="true" style={sampleStyle}>{props.value}</code>
}

function InterfaceSample(props: Readonly<{apiName: string}>) {
  const apiName = props.apiName
  const table = apiName === "HTMLTableElement" || apiName === "HTMLTableSectionElement" ||
    apiName === "HTMLTableRowElement" || apiName === "HTMLTableCellElement"
  const generic = ![
    "Element", "HTMLElement", "HTMLDivElement", "HTMLSpanElement", "HTMLHeadingElement",
    "HTMLParagraphElement", "HTMLButtonElement", "HTMLInputElement", "HTMLImageElement",
    "HTMLSelectElement", "HTMLOptionElement", "HTMLTextAreaElement", "HTMLProgressElement",
    "HTMLMeterElement", "HTMLLabelElement", "HTMLFieldSetElement", "HTMLLegendElement",
    "HTMLUListElement", "HTMLLIElement", "HTMLTableElement", "HTMLTableSectionElement",
    "HTMLTableRowElement", "HTMLTableCellElement",
  ].includes(apiName)
  return <div data-interface-sample-host="" style={css`
    & { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 584px; min-height: 130px; padding: 16px; border: 1px solid rgb(22 22 22); border-radius: 4px; background: rgb(28 28 28); }
  `}>
    {apiName === "Element" ? <InterfaceElementSample htmlElement={false} /> : null}
    {apiName === "HTMLElement" ? <InterfaceElementSample htmlElement={true} /> : null}
    {apiName === "HTMLDivElement" ? <InterfaceDivSample /> : null}
    {apiName === "HTMLSpanElement" ? <InterfaceSpanSample /> : null}
    {apiName === "HTMLHeadingElement" ? <InterfaceHeadingSample /> : null}
    {apiName === "HTMLParagraphElement" ? <InterfaceParagraphSample /> : null}
    {apiName === "HTMLButtonElement" ? <InterfaceButtonSample /> : null}
    {apiName === "HTMLInputElement" ? <InterfaceInputSample /> : null}
    {apiName === "HTMLImageElement" ? <InterfaceImageSample /> : null}
    {apiName === "HTMLSelectElement" ? <InterfaceSelectSample optionInterface={false} /> : null}
    {apiName === "HTMLOptionElement" ? <InterfaceSelectSample optionInterface={true} /> : null}
    {apiName === "HTMLTextAreaElement" ? <InterfaceTextareaSample /> : null}
    {apiName === "HTMLProgressElement" ? <InterfaceProgressSample /> : null}
    {apiName === "HTMLMeterElement" ? <InterfaceMeterSample /> : null}
    {apiName === "HTMLLabelElement" ? <InterfaceLabelSample /> : null}
    {apiName === "HTMLFieldSetElement" ? <InterfaceFieldSetSample /> : null}
    {apiName === "HTMLLegendElement" ? <InterfaceLegendSample /> : null}
    {apiName === "HTMLUListElement" ? <InterfaceListSample itemInterface={false} /> : null}
    {apiName === "HTMLLIElement" ? <InterfaceListSample itemInterface={true} /> : null}
    {table ? <InterfaceTableSample apiName={apiName} /> : null}
    {generic ? <InterfaceCodeSample value={`${apiName} · implemented runtime subset`} /> : null}
  </div>
}

export function DomInterfaceStoryView(props: DomInterfaceStoryViewProps) {
  return <section
    data-dom-interface-story=""
    data-interface={props.apiName}
    data-route={props.route}
    style={storyRootStyle}
  >
    <h2 style={css`& { display: block; height: 24px; margin: 0; color: rgb(126 220 236); font-size: 16px; }`}>{props.title}</h2>
    <p style={css`& { display: block; min-height: 20px; margin: 0; color: rgb(176 176 176); font-size: 12px; }`}>{props.summary}</p>
    <div data-interface-hierarchy="" style={css`& { display: flex; flex-direction: row; align-items: center; min-height: 34px; gap: 6px; }`}>
      {props.hierarchy.map((name, index) => <HierarchyToken key={name} name={name} first={index === 0} />)}
    </div>
    <InterfaceSample apiName={props.apiName} />
  </section>
}

function ElementDivNested() {
  return <div style={css`& { width: 340px; height: 150px; background: rgb(45 104 128); }`}>Overflow is clipped by the parent div</div>
}

function ElementDivSample(props: Readonly<{route: ElementDomStoryRoute}>) {
  const axis = props.route.endsWith("/vertical") ? "vertical"
    : props.route.endsWith("/horizontal") ? "horizontal"
      : props.route.endsWith("/both") ? "both" : "none"
  const variant = props.route.endsWith("/background") ? "background"
    : props.route.endsWith("/border") ? "border"
      : props.route.endsWith("/padding") ? "padding" : "nested"
  const scroll = props.route.includes("/scroll/")
  return <div
    data-element-sample="div"
    data-variant={variant}
    data-scroll-axis={scroll ? axis : undefined}
    style={css`
      & { box-sizing: border-box; display: block; width: 260px; height: 120px; padding: 16px; overflow: hidden; border: 1px solid rgb(72 72 72); border-radius: 5px; background: rgb(48 48 48); color: rgb(224 224 224); font-size: 12px; }
      &[data-variant="background"] { background: rgb(45 104 128); }
      &[data-variant="border"] { border: 4px solid rgb(126 220 236); }
      &[data-variant="padding"] { padding: 30px; }
      &[data-scroll-axis="vertical"] { width: 220px; height: 110px; overflow-y: auto; }
      &[data-scroll-axis="horizontal"] { width: 220px; height: 86px; overflow-x: auto; }
      &[data-scroll-axis="both"] { width: 220px; height: 100px; overflow: auto; }
    `}
  >
    {scroll ? <ElementDivNested /> : null}
    {!scroll && variant === "nested" ? <ElementDivNested /> : null}
    {!scroll && variant !== "nested" ? <ElementText value={`CSS ${variant}`} /> : null}
  </div>
}

function ElementText(props: Readonly<{value: string}>) {
  return <span>{props.value}</span>
}

function ElementZStack() {
  return <div data-element-sample="z-stack" style={css`& { position: relative; display: block; width: 260px; height: 120px; }`}>
    <div style={css`& { position: absolute; left: 12px; top: 20px; width: 140px; height: 72px; z-index: -1; background: rgb(45 104 128); }`}>z-index -1</div>
    <div style={css`& { position: absolute; left: 88px; top: 36px; width: 140px; height: 72px; z-index: 2; background: rgb(48 112 76); }`}>z-index 2</div>
  </div>
}

function ElementSpanSample(props: Readonly<{route: ElementDomStoryRoute}>) {
  const align = props.route.endsWith("/center") ? "center" : props.route.endsWith("/right") ? "right" : "left"
  return <span data-element-sample="span" data-align={align} style={css`
    & { display: block; width: 320px; min-height: 42px; color: rgb(224 224 224); font-size: 13px; text-align: left; }
    &[data-align="center"] { text-align: center; }
    &[data-align="right"] { text-align: right; }
  `}>Inline text from a standard span</span>
}

function ElementButtonSample(props: Readonly<{route: ElementDomStoryRoute}>) {
  const clickable = props.route.endsWith("/clickable")
  const label = clickable ? "Clickable" : "Output"
  return <button
    type="button"
    data-element-sample="button"
    disabled={props.route.endsWith("/disabled")}
    title={clickable ? "Standard click target" : "Button"}
    style={css`
      & { box-sizing: border-box; display: block; width: 180px; height: 34px; padding: 6px 12px; border: 1px solid rgb(72 72 72); border-radius: 4px; background: rgb(48 48 48); color: rgb(224 224 224); font-size: 12px; }
      &:focus { border-color: rgb(126 220 236); }
      &:disabled { opacity: 0.5; }
    `}
  >{label}</button>
}

function ElementInputSample(props: Readonly<{route: ElementDomStoryRoute}>) {
  return <input
    type="text"
    value="Output"
    data-element-sample="input"
    data-active={props.route.endsWith("/active") ? "true" : undefined}
    disabled={props.route.endsWith("/disabled")}
    style={css`
      & { box-sizing: border-box; display: block; width: 240px; height: 32px; padding: 5px 9px; border: 1px solid rgb(72 72 72); border-radius: 4px; background: rgb(36 36 36); color: rgb(224 224 224); font-size: 12px; }
      &[data-active="true"] { border-color: rgb(126 220 236); }
      &:disabled { opacity: 0.5; }
    `}
  />
}

function ElementSelectOption(props: Readonly<{label: string}>) {
  return <option value={props.label.toLocaleLowerCase()} selected={props.label === "Output"}>{props.label}</option>
}

function ElementSelectSample(props: Readonly<{route: ElementDomStoryRoute}>) {
  const options = ["Preview", "Output", "Capture"]
  return <select
    value="output"
    data-element-sample="select"
    data-active={props.route.endsWith("/active") ? "true" : undefined}
    disabled={props.route.endsWith("/disabled")}
    style={css`
      & { box-sizing: border-box; display: block; width: 240px; height: 32px; padding: 5px 9px; border: 1px solid rgb(72 72 72); border-radius: 4px; background: rgb(36 36 36); color: rgb(224 224 224); font-size: 12px; }
      &[data-active="true"] { border-color: rgb(126 220 236); }
      &:disabled { opacity: 0.5; }
    `}
  >{options.map(label => <ElementSelectOption key={label} label={label} />)}</select>
}

function ElementListItem(props: Readonly<{index: number; selected: boolean; dense: boolean}>) {
  return <li
    role="option"
    aria-selected={String(props.selected)}
    data-dense={props.dense ? "true" : undefined}
    style={css`
      & { box-sizing: border-box; display: block; width: 100%; height: 30px; padding: 6px 9px; border: 1px solid transparent; border-radius: 3px; background: rgb(48 48 48); color: rgb(224 224 224); font-size: 12px; }
      &[data-dense="true"] { height: 24px; padding: 3px 7px; font-size: 11px; }
      &[aria-selected="true"] { background: rgb(45 104 128); }
    `}
  >{`Item ${props.index + 1}`}</li>
}

function ElementListSample(props: Readonly<{route: ElementDomStoryRoute}>) {
  const dense = props.route.endsWith("/dense")
  const interactive = props.route.endsWith("/interactive")
  const count = props.route.endsWith("/scroll") ? 8 : 3
  const items = Array.from({length: count}, (_, index) => index)
  return <ul role="listbox" data-element-sample="list" style={css`
    & { box-sizing: border-box; display: flex; flex-direction: column; width: 300px; max-height: 150px; padding: 4px; gap: 3px; border: 1px solid rgb(72 72 72); border-radius: 4px; overflow-y: auto; scrollbar-width: thin; background: rgb(36 36 36); }
  `}>{items.map(index => <ElementListItem key={index} index={index} selected={interactive && index === 1} dense={dense} />)}</ul>
}

function ElementStatusItem(props: Readonly<{value: string}>) {
  return <span>{props.value}</span>
}

function ElementStatusSample() {
  const values = ["Objects 42", "Draws 18", "GPU 1.11 ms"]
  return <div role="status" data-element-sample="status" style={css`
    & { box-sizing: border-box; display: flex; flex-direction: row; align-items: center; width: 420px; height: 28px; gap: 20px; padding: 4px 10px; border: 1px solid rgb(22 22 22); background: rgb(36 36 36); color: rgb(176 176 176); font-size: 11px; }
  `}>{values.map(value => <ElementStatusItem key={value} value={value} />)}</div>
}

function ElementStyleToken(props: Readonly<{value: string}>) {
  return <span>{props.value}</span>
}

function ElementStyleSample(props: Readonly<{route: ElementDomStoryRoute}>) {
  const parts = props.route.split("/")
  const variant = parts.at(-2) === "tone" ? parts.at(-1)! : parts.at(-2)!
  const tokens = variant === "flex" ? ["A", "B", "C"] : []
  return <div data-element-sample="style" data-variant={variant} style={css`
    & { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 260px; height: 100px; padding: 16px; border: 1px solid rgb(72 72 72); border-radius: 4px; background: rgb(48 48 48); color: rgb(224 224 224); font-size: 13px; }
    &[data-variant="padding"] { padding: 32px; }
    &[data-variant="flex"] { flex-direction: row; gap: 10px; }
    &[data-variant="rounded"] { border-radius: 14px; }
    &[data-variant="capsule"] { width: 220px; height: 48px; border-radius: 24px; }
    &[data-variant="color"] { background: rgb(45 104 128); color: rgb(240 240 240); }
    &[data-variant="typography"] { font-size: 18px; color: rgb(126 220 236); }
    &[data-variant="cyan"] { background: rgb(45 104 128); }
    &[data-variant="green"] { background: rgb(48 112 76); }
    &[data-variant="orange"] { background: rgb(132 91 42); }
    &[data-variant="red"] { background: rgb(132 56 56); }
  `}>
    {tokens.map(value => <ElementStyleToken key={value} value={value} />)}
    {tokens.length === 0 ? <ElementText value={`CSS ${variant}`} /> : null}
  </div>
}

function ElementPointerSample(props: Readonly<{route: ElementDomStoryRoute}>) {
  const state = props.route.split("/").at(-1) ?? "idle"
  return <button
    type="button"
    data-element-sample="pointer"
    data-state={state}
    disabled={state === "disabled"}
    title={`Pointer state: ${state}`}
    style={css`
      & { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 180px; height: 44px; padding: 6px 12px; border: 2px solid rgb(72 72 72); border-radius: 5px; background: rgb(48 48 48); color: rgb(224 224 224); font-size: 12px; }
      &[data-state="hover"] { border-color: rgb(126 220 236); }
      &[data-state="press"] { background: rgb(45 104 128); }
      &[data-state="release"] { border-color: rgb(48 112 76); }
      &[data-state="click"] { background: rgb(48 112 76); }
      &:disabled { opacity: 0.5; }
    `}
  >{`Pointer · ${state}`}</button>
}

export function ElementDomStoryView(props: ElementDomStoryViewProps) {
  const route = props.route
  return <section data-element-dom-story="" data-route={route} style={css`
    & { box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 520px; min-height: 260px; padding: 24px; background: rgb(28 28 28); }
  `}>
    {route.endsWith("/z-index") ? <ElementZStack /> : null}
    {route.includes("/div/") && !route.endsWith("/z-index") ? <ElementDivSample route={route} /> : null}
    {route.includes("/span/") ? <ElementSpanSample route={route} /> : null}
    {route.includes("/button/") ? <ElementButtonSample route={route} /> : null}
    {route.includes("/input/") ? <ElementInputSample route={route} /> : null}
    {route.includes("/select/") ? <ElementSelectSample route={route} /> : null}
    {route.includes("/list/") ? <ElementListSample route={route} /> : null}
    {route.includes("/status-bar/") ? <ElementStatusSample /> : null}
    {route.startsWith("elements/style/") ? <ElementStyleSample route={route} /> : null}
    {route.startsWith("elements/events/") ? <ElementPointerSample route={route} /> : null}
  </section>
}

export function ImageDomStoryView(props: ImageDomStoryViewProps) {
  const fit = props.route.endsWith("/cover") ? "cover" : "contain"
  return <section
    data-image-dom-story=""
    data-route={props.route}
    aria-label="Вписывание изображения"
    style={css`& { box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 520px; min-height: 300px; padding: 24px; background: rgb(28 28 28); color: rgb(224 224 224); }`}
  >
    <div style={css`& { box-sizing: border-box; display: block; width: 320px; height: 180px; overflow: hidden; border: 1px solid rgb(72 72 72); border-radius: 4px; background: rgb(7 16 28); }`}>
      <img
        src={props.src}
        alt="Абстрактная сцена"
        width="320"
        height="180"
        title={fit === "cover" ? "Заполнение области" : "Изображение целиком"}
        data-image-fit={fit}
        style={css`
          & { box-sizing: border-box; display: block; width: 320px; height: 180px; background: rgb(7 16 28); object-fit: contain; }
          &[data-image-fit="cover"] { object-fit: cover; }
        `}
      />
    </div>
  </section>
}

type PopoverOptionEntry = Readonly<{value: string; label: string; disabled?: boolean}>
const POPOVER_OPTIONS: readonly PopoverOptionEntry[] = Object.freeze([
  {value: "add", label: "Сложение"},
  {value: "multiply", label: "Умножение"},
  {value: "subtract", label: "Вычитание"},
  {value: "divide", label: "Деление", disabled: true},
])

function PopoverOption(props: Readonly<{
  entry: PopoverOptionEntry
  selected: boolean
  onSelect(value: string): void
}>) {
  const onClick = (_event: Event) => {
    if (!props.entry.disabled) props.onSelect(props.entry.value)
  }
  return <li
    role="option"
    data-popover-option=""
    data-value={props.entry.value}
    aria-selected={String(props.selected)}
    aria-disabled={props.entry.disabled ? "true" : undefined}
    onClick={onClick}
    style={css`
      & { box-sizing: border-box; display: block; width: 100%; height: 26px; padding: 5px 8px; border: 1px solid transparent; border-radius: 3px; background: rgb(48 48 48); color: rgb(224 224 224); font-size: 11px; }
      &[aria-selected="true"] { background: rgb(45 104 128); color: rgb(240 240 240); }
      &[aria-disabled="true"] { opacity: 0.5; }
    `}
  >{props.entry.label}</li>
}

function PopoverList(props: Readonly<{selected: string; onSelect(value: string): void}>) {
  return <ul role="listbox" aria-label="Операция" data-popover-listbox="" style={css`
    & { box-sizing: border-box; display: flex; flex-direction: column; width: 100%; gap: 2px; padding: 2px 0 0; background: rgb(36 36 36); }
  `}>{POPOVER_OPTIONS.map(entry => <PopoverOption
    key={entry.value}
    entry={entry}
    selected={entry.value === props.selected}
    onSelect={props.onSelect}
  />)}</ul>
}

function PopoverHeader() {
  return <header style={css`& { box-sizing: border-box; display: block; width: 100%; height: 26px; padding: 5px 8px; border-bottom: 1px solid rgb(72 72 72); color: rgb(176 176 176); font-size: 11px; }`}>Операция</header>
}

function PopoverDialog() {
  return <div role="dialog" aria-label="Popover" style={css`& { display: block; min-height: 48px; padding: 14px 10px; color: rgb(224 224 224); font-size: 12px; text-align: center; }`}>Содержимое всплывающего слоя</div>
}

export function PopoverDomStoryView(props: PopoverDomStoryViewProps) {
  const selectRoute = props.route.includes("/select/")
  const initiallyOpen = !props.route.endsWith("/closed")
  const header = props.route.endsWith("/header") || props.route.endsWith("/flipped")
  const flipped = props.route.endsWith("/flipped")
  const popoverId = useId()
  const popoverRef = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(initiallyOpen)
  const [selected, setSelected] = useState("multiply")
  const bindPopover = (element: HTMLElement | null) => { popoverRef.current = element }
  const onTrigger = (_event: Event) => setOpen(value => !value)
  const onSelect = (value: string) => {
    setSelected(value)
    setOpen(false)
  }
  const selectedLabel = POPOVER_OPTIONS.find(option => option.value === selected)?.label ?? "Операция"
  const caption = selectRoute ? "Операция" : "Стандартный Popover API"
  const triggerLabel = selectRoute ? selectedLabel : open ? "Закрыть" : "Открыть"
  const indicator = flipped ? "▴" : "▾"
  useEffect(() => {
    const popover = popoverRef.current
    if (popover === null || !popover.isConnected) return
    const showing = popover[getPopoverVisibilityState]() === "showing"
    if (open && !showing) popover.showPopover()
    if (!open && showing) popover.hidePopover()
    return () => {
      if (popover.isConnected && popover[getPopoverVisibilityState]() === "showing") popover.hidePopover()
    }
  }, [open])
  return <section
    data-popover-dom-story=""
    data-route={props.route}
    aria-label={selectRoute ? "Составной выбор значения" : "Всплывающий слой"}
    style={css`& { box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 520px; min-height: 300px; gap: 7px; padding: 24px; background: rgb(28 28 28); color: rgb(224 224 224); }`}
  >
    <span style={css`& { display: block; width: 260px; min-height: 20px; color: rgb(176 176 176); font-size: 11px; }`}>{caption}</span>
    <button
      type="button"
      data-popover-trigger=""
      aria-controls={popoverId}
      aria-expanded={String(open)}
      aria-haspopup={selectRoute ? "listbox" : "dialog"}
      popovertarget={popoverId}
      title={selectRoute ? "Выбрать операцию" : open ? "Закрыть" : "Открыть"}
      onClick={onTrigger}
      style={css`
        & { box-sizing: border-box; display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 260px; height: 32px; gap: 8px; padding: 5px 10px; border: 1px solid rgb(72 72 72); border-radius: 4px; background: rgb(48 48 48); color: rgb(224 224 224); font-size: 12px; }
        &[aria-expanded="true"] { border-color: rgb(126 220 236); }
      `}
    ><span>{triggerLabel}</span><span aria-hidden="true">{indicator}</span></button>
    <div
      ref={bindPopover}
      id={popoverId}
      popover="manual"
      data-popover-owner=""
      data-placement={flipped ? "above" : "below"}
      style={css`
        & { box-sizing: border-box; display: flex; flex-direction: column; width: 260px; min-height: 66px; padding: 6px; border: 1px solid rgb(72 72 72); border-radius: 4px; background: rgb(36 36 36); color: rgb(224 224 224); }
        &[data-placement="below"] { margin-top: 6px; }
        &[data-placement="above"] { margin-bottom: 6px; }
      `}
    >
      {header ? <PopoverHeader /> : null}
      {selectRoute ? <PopoverList selected={selected} onSelect={onSelect} /> : null}
      {!selectRoute ? <PopoverDialog /> : null}
    </div>
  </section>
}
