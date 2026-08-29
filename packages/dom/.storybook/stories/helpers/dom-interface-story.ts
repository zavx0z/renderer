/** Renderer-owned external Storybook story support. */
import type {
  Document,
  Element,
  HTMLElement,
  HTMLSelectElement,
  Node,
} from "@zavx0z/dom"

export type DomInterfaceStorySource = Readonly<{
  html: string
  css: string
  typescript: string
}>

export type DomInterfaceStory = Readonly<{
  element: HTMLElement
  source: DomInterfaceStorySource
}>

export const domInterfaceStoryCss = String.raw`
.dom-interface-story {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 620px;
  min-height: 300px;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgb(22, 22, 22);
  border-radius: 6px;
  background: rgb(48, 48, 48);
  color: rgb(224, 224, 224);
}

.dom-interface-story__title {
  display: block;
  height: 24px;
  color: rgb(126, 220, 236);
  font-size: 16px;
}

.dom-interface-story__summary {
  display: block;
  min-height: 20px;
  color: rgb(176, 176, 176);
  font-size: 12px;
}

.dom-interface-story__chain {
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  min-height: 34px;
  gap: 6px;
}

.dom-interface-story__type {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: 28px;
  padding: 4px 8px;
  border: 1px solid rgb(72, 72, 72);
  border-radius: 3px;
  background: rgb(36, 36, 36);
  color: rgb(224, 224, 224);
  font-size: 11px;
}

.dom-interface-story__arrow {
  display: inline;
  width: 12px;
  color: rgb(126, 220, 236);
  font-size: 12px;
}

.dom-interface-story__demo {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 584px;
  min-height: 130px;
  padding: 16px;
  border: 1px solid rgb(22, 22, 22);
  border-radius: 4px;
  background: rgb(28, 28, 28);
}

.dom-interface-story__sample {
  box-sizing: border-box;
  display: block;
  width: 240px;
  min-height: 30px;
  padding: 5px 10px;
  border: 1px solid rgb(72, 72, 72);
  border-radius: 4px;
  background: rgb(36, 36, 36);
  color: rgb(224, 224, 224);
  font-size: 12px;
}
`

const summaries = Object.freeze({
  EventTarget: "EventTarget хранит listeners и выполняет capture, target и bubble dispatch.",
  Node: "Node владеет identity, parent/child tree, connected state и textContent.",
  Document: "Document является root одного tree и публикует mutation/state channels для renderer adapters.",
  DocumentFragment: "DocumentFragment владеет detached subtree, ParentNode mutation и selector subset.",
  CharacterData: "CharacterData хранит live data, length и characterData mutation records.",
  Text: "Text является CharacterData node с live data и textContent.",
  Comment: "Comment является невидимым CharacterData anchor в том же tree.",
  NodeList: "NodeList является immutable static query snapshot с item и iterator methods.",
  DOMTokenList: "DOMTokenList лениво отражает class attribute и поддерживает add, remove и toggle.",
  Element: "Element добавляет string attributes, selector subset и classList поверх Node.",
  HTMLElement: "HTMLElement добавляет tabIndex, focus, requested scroll и bounded popover state; title находится именно здесь.",
  HTMLDivElement: "HTMLDivElement является exact standard prototype для div container.",
  HTMLSpanElement: "HTMLSpanElement является exact standard prototype для inline span.",
  HTMLButtonElement: "HTMLButtonElement отражает disabled и выполняет обычную click activation.",
  HTMLInputElement: "HTMLInputElement хранит live value, checked и indeterminate отдельно от default attributes.",
  HTMLImageElement: "HTMLImageElement отражает только author src, alt, width и height attributes.",
  HTMLSelectElement: "HTMLSelectElement владеет bounded selectedness своих HTMLOptionElement.",
  HTMLOptionElement: "HTMLOptionElement отражает value, label, disabled и selected/defaultSelected.",
  HTMLProgressElement: "HTMLProgressElement различает determinate value и отсутствие value attribute.",
  HTMLMeterElement: "HTMLMeterElement нормализует value и thresholds внутри min/max.",
  HTMLTextAreaElement: "HTMLTextAreaElement хранит многострочное live value отдельно от defaultValue.",
  HTMLLabelElement: "HTMLLabelElement отражает htmlFor и разрешает bounded labelable control.",
  HTMLFieldSetElement: "HTMLFieldSetElement отражает disabled и name; forms и validity не заявлены.",
  HTMLLegendElement: "HTMLLegendElement является exact legend prototype без дополнительных helper APIs.",
  HTMLUListElement: "HTMLUListElement является exact ul prototype без numbering reflections.",
  HTMLLIElement: "HTMLLIElement является exact li prototype без legacy value reflection.",
  HTMLHeadingElement: "HTMLHeadingElement покрывает exact h1–h6 prototypes.",
  HTMLParagraphElement: "HTMLParagraphElement является exact p prototype.",
  HTMLTableElement: "HTMLTableElement является exact table prototype без collection helpers.",
  HTMLTableSectionElement: "HTMLTableSectionElement покрывает exact thead, tbody и tfoot prototypes.",
  HTMLTableRowElement: "HTMLTableRowElement является exact tr prototype без insertion algorithms.",
  HTMLTableCellElement: "HTMLTableCellElement отражает bounded colSpan, rowSpan и scope.",
  Event: "Event хранит type, phase, cancellation и propagation state.",
  CustomEvent: "CustomEvent добавляет immutable detail поверх Event.",
  ToggleEvent: "ToggleEvent добавляет oldState, newState и optional source.",
  UIEvent: "UIEvent добавляет bounded view и integer detail.",
  FocusEvent: "FocusEvent добавляет relatedTarget поверх UIEvent.",
  MouseEvent: "MouseEvent добавляет coordinates, buttons и modifier state поверх UIEvent.",
  PointerEvent: "PointerEvent добавляет pointer samples, pressure и device fields поверх MouseEvent.",
  WheelEvent: "WheelEvent добавляет delta values и deltaMode поверх MouseEvent.",
  KeyboardEvent: "KeyboardEvent добавляет key, code, location, modifiers и composition flags.",
  InputEvent: "InputEvent добавляет data, inputType и isComposing; DataTransfer не заявлен.",
  CompositionEvent: "CompositionEvent добавляет composition data поверх UIEvent.",
} as const)

type SupportedApiName = keyof typeof summaries

export const DOM_INTERFACE_API_NAMES: readonly SupportedApiName[] = Object.freeze(
  Object.keys(summaries) as SupportedApiName[],
)

export function createDomInterfaceStory(
  document: Document,
  input: Readonly<{apiName: string; title: string; route: string}>,
): DomInterfaceStory {
  const apiName = supportedApiName(input.apiName)
  const root = document.createElement("section")
  const title = document.createElement("h2")
  const summary = document.createElement("p")
  const chain = document.createElement("div")
  const demo = document.createElement("div")
  root.className = "dom-interface-story"
  title.className = "dom-interface-story__title"
  summary.className = "dom-interface-story__summary"
  chain.className = "dom-interface-story__chain"
  demo.className = "dom-interface-story__demo"
  root.setAttribute("data-interface", apiName)
  root.setAttribute("data-route", input.route)
  title.appendChild(document.createTextNode(input.title))
  summary.appendChild(document.createTextNode(summaries[apiName]))

  const hierarchy = hierarchyFor(apiName)
  for (const [index, name] of hierarchy.entries()) {
    if (index > 0) {
      const arrow = document.createElement("span")
      arrow.className = "dom-interface-story__arrow"
      arrow.appendChild(document.createTextNode("→"))
      chain.appendChild(arrow)
    }
    const item = document.createElement("code")
    item.className = "dom-interface-story__type"
    item.appendChild(document.createTextNode(name))
    chain.appendChild(item)
  }

  const sample = createSample(document, apiName)
  demo.appendChild(sample)
  root.append(title, summary, chain, demo)
  return Object.freeze({
    element: root,
    source: Object.freeze({
      html: serializeElement(root),
      css: domInterfaceStoryCss,
      typescript: sampleTypeScript(apiName),
    }),
  })
}

function supportedApiName(value: string): SupportedApiName {
  if (Object.prototype.hasOwnProperty.call(summaries, value)) return value as SupportedApiName
  throw new Error(`Unsupported DOM interface story: ${value}`)
}

function hierarchyFor(apiName: SupportedApiName): readonly string[] {
  if (apiName === "EventTarget") return Object.freeze(["EventTarget"])
  if (apiName === "Node") return Object.freeze(["EventTarget", "Node"])
  if (apiName === "Document" || apiName === "DocumentFragment") {
    return Object.freeze(["EventTarget", "Node", apiName])
  }
  if (apiName === "CharacterData") return Object.freeze(["EventTarget", "Node", "CharacterData"])
  if (apiName === "Text" || apiName === "Comment") {
    return Object.freeze(["EventTarget", "Node", "CharacterData", apiName])
  }
  if (apiName === "NodeList" || apiName === "DOMTokenList") return Object.freeze([apiName])
  if (apiName === "Element") return Object.freeze(["EventTarget", "Node", "Element"])
  if (apiName === "HTMLElement") {
    return Object.freeze(["EventTarget", "Node", "Element", "HTMLElement"])
  }
  if (apiName === "Event") return Object.freeze(["Event"])
  if (apiName === "CustomEvent" || apiName === "ToggleEvent") {
    return Object.freeze(["Event", apiName])
  }
  if (apiName === "UIEvent") return Object.freeze(["Event", "UIEvent"])
  if (apiName === "MouseEvent" || apiName === "FocusEvent" || apiName === "KeyboardEvent" ||
    apiName === "InputEvent" || apiName === "CompositionEvent") {
    return Object.freeze(["Event", "UIEvent", apiName])
  }
  if (apiName === "PointerEvent" || apiName === "WheelEvent") {
    return Object.freeze(["Event", "UIEvent", "MouseEvent", apiName])
  }
  return Object.freeze(["EventTarget", "Node", "Element", "HTMLElement", apiName])
}

function createSample(document: Document, apiName: SupportedApiName): Node {
  if (apiName === "Element" || apiName === "HTMLElement") {
    const element = document.createElement(apiName === "Element" ? "section" : "div")
    element.className = "dom-interface-story__sample"
    element.title = apiName === "HTMLElement" ? "HTMLElement.title" : "Element attributes"
    element.appendChild(document.createTextNode(
      apiName === "HTMLElement" ? "title lives on HTMLElement" : "data-owner=DOM",
    ))
    if (apiName === "Element") element.setAttribute("data-owner", "DOM")
    return element
  }
  if (apiName === "HTMLDivElement" || apiName === "HTMLSpanElement" ||
    apiName === "HTMLHeadingElement" || apiName === "HTMLParagraphElement") {
    const tag = apiName === "HTMLDivElement" ? "div"
      : apiName === "HTMLSpanElement" ? "span"
        : apiName === "HTMLHeadingElement" ? "h3"
          : "p"
    const element = document.createElement(tag)
    element.className = "dom-interface-story__sample"
    element.appendChild(document.createTextNode(apiName))
    return element
  }
  if (apiName === "HTMLButtonElement") {
    const button = document.createElement("button")
    button.className = "dom-interface-story__sample"
    button.setAttribute("type", "button")
    button.title = "title inherited from HTMLElement"
    button.appendChild(document.createTextNode("Output"))
    return button
  }
  if (apiName === "HTMLInputElement") {
    const input = document.createElement("input")
    input.className = "dom-interface-story__sample"
    input.type = "text"
    input.value = "Output"
    input.title = "Live input value"
    return input
  }
  if (apiName === "HTMLImageElement") {
    const image = document.createElement("img")
    image.className = "dom-interface-story__sample"
    image.src = ""
    image.alt = "Output preview"
    image.width = 240
    image.height = 72
    return image
  }
  if (apiName === "HTMLSelectElement") return selectSample(document, false)
  if (apiName === "HTMLOptionElement") return selectSample(document, true)
  if (apiName === "HTMLTextAreaElement") {
    const textarea = document.createElement("textarea")
    textarea.className = "dom-interface-story__sample"
    textarea.rows = 3
    textarea.value = "Node\n  Element\n    HTMLElement"
    textarea.readOnly = true
    return textarea
  }
  if (apiName === "HTMLProgressElement") {
    const progress = document.createElement("progress")
    progress.className = "dom-interface-story__sample"
    progress.max = 100
    progress.value = 64
    return progress
  }
  if (apiName === "HTMLMeterElement") {
    const meter = document.createElement("meter")
    meter.className = "dom-interface-story__sample"
    meter.min = 0
    meter.max = 100
    meter.low = 25
    meter.high = 75
    meter.optimum = 50
    meter.value = 64
    return meter
  }
  if (apiName === "HTMLLabelElement") {
    const label = document.createElement("label")
    const input = document.createElement("input")
    label.className = "dom-interface-story__sample"
    label.htmlFor = "interface-label-control"
    label.appendChild(document.createTextNode("Output "))
    input.id = "interface-label-control"
    input.type = "text"
    input.value = "Ready"
    label.appendChild(input)
    return label
  }
  if (apiName === "HTMLFieldSetElement") {
    const fieldset = document.createElement("fieldset")
    const legend = document.createElement("legend")
    const input = document.createElement("input")
    fieldset.className = "dom-interface-story__sample"
    fieldset.name = "output"
    fieldset.disabled = true
    legend.appendChild(document.createTextNode("Output"))
    input.type = "text"
    input.value = "Ready"
    fieldset.append(legend, input)
    return fieldset
  }
  if (apiName === "HTMLLegendElement") {
    const fieldset = document.createElement("fieldset")
    const legend = document.createElement("legend")
    legend.className = "dom-interface-story__sample"
    legend.appendChild(document.createTextNode("Output settings"))
    fieldset.appendChild(legend)
    return fieldset
  }
  if (apiName === "HTMLUListElement") {
    const list = document.createElement("ul")
    list.className = "dom-interface-story__sample"
    for (const value of ["Preview", "Output"]) {
      const item = document.createElement("li")
      item.appendChild(document.createTextNode(value))
      list.appendChild(item)
    }
    return list
  }
  if (apiName === "HTMLLIElement") {
    const list = document.createElement("ul")
    const item = document.createElement("li")
    item.className = "dom-interface-story__sample"
    item.appendChild(document.createTextNode("Output"))
    list.appendChild(item)
    return list
  }
  if (apiName === "HTMLTableElement" || apiName === "HTMLTableSectionElement" ||
    apiName === "HTMLTableRowElement" || apiName === "HTMLTableCellElement") {
    return tableSample(document, apiName)
  }
  return codeSample(document, `${apiName} · implemented runtime subset`)
}

function codeSample(document: Document, value: string): HTMLElement {
  const code = document.createElement("code")
  code.className = "dom-interface-story__sample"
  code.appendChild(document.createTextNode(value))
  return code
}

function selectSample(document: Document, optionInterface: boolean): HTMLSelectElement {
  const select = document.createElement("select")
  if (!optionInterface) select.className = "dom-interface-story__sample"
  const values = optionInterface ? ["Output"] : ["Preview", "Output", "Capture"]
  for (const value of values) {
    const option = document.createElement("option")
    option.value = value.toLowerCase()
    option.appendChild(document.createTextNode(value))
    if (optionInterface && value === "Output") option.className = "dom-interface-story__sample"
    select.appendChild(option)
  }
  select.value = "output"
  return select
}

function tableSample(
  document: Document,
  apiName: "HTMLTableElement" | "HTMLTableSectionElement" | "HTMLTableRowElement" | "HTMLTableCellElement",
): Node {
  const table = document.createElement("table")
  const body = document.createElement("tbody")
  const row = document.createElement("tr")
  const label = document.createElement("th")
  const value = document.createElement("td")
  if (apiName === "HTMLTableElement") table.className = "dom-interface-story__sample"
  if (apiName === "HTMLTableSectionElement") body.className = "dom-interface-story__sample"
  if (apiName === "HTMLTableRowElement") row.className = "dom-interface-story__sample"
  if (apiName === "HTMLTableCellElement") label.className = "dom-interface-story__sample"
  label.scope = "row"
  label.colSpan = 1
  label.appendChild(document.createTextNode("State"))
  value.appendChild(document.createTextNode("Ready"))
  row.append(label, value)
  body.appendChild(row)
  table.appendChild(body)
  return table
}

function sampleTypeScript(apiName: SupportedApiName): string {
  if (apiName === "EventTarget") return documentTypeScript([
    'const target = document.createElement("button")',
    'const listener = () => {}',
    'target.addEventListener("activate", listener)',
    'target.dispatchEvent(new Event("activate", {bubbles: true}))',
  ], "Event")
  if (apiName === "Node") return documentTypeScript([
    'const node = document.createTextNode("Output")',
    'node.textContent = "Ready"',
    "document.appendChild(node)",
  ])
  if (apiName === "Document") return documentTypeScript([
    'const root = document.createElement("section")',
    'root.append("Output")',
    "document.appendChild(root)",
  ])
  if (apiName === "DocumentFragment") return documentTypeScript([
    "const fragment = document.createDocumentFragment()",
    'fragment.append("Preview", "Output")',
  ])
  if (apiName === "CharacterData" || apiName === "Text") return documentTypeScript([
    'const node = document.createTextNode("Out")',
    'node.appendData("put")',
    "document.appendChild(node)",
  ])
  if (apiName === "Comment") return documentTypeScript([
    'const node = document.createComment("stable anchor")',
    "document.appendChild(node)",
  ])
  if (apiName === "NodeList") return documentTypeScript([
    'const root = document.createElement("div")',
    'const item = document.createElement("span")',
    'item.className = "item"',
    "root.appendChild(item)",
    "document.appendChild(root)",
    'const nodes = document.querySelectorAll(".item")',
    "void nodes.item(0)",
  ])
  if (apiName === "DOMTokenList") return documentTypeScript([
    'const node = document.createElement("div")',
    'node.classList.add("selected")',
    'node.classList.toggle("active", true)',
    "document.appendChild(node)",
  ])
  if (apiName === "Element") return documentTypeScript([
    'const node = document.createElement("section")',
    'node.setAttribute("data-owner", "DOM")',
    "document.appendChild(node)",
  ])
  if (apiName === "HTMLElement") return documentTypeScript([
    'const node = document.createElement("div")',
    'node.title = "HTMLElement.title"',
    "node.tabIndex = 0",
    "document.appendChild(node)",
  ])
  if (apiName === "Event") return eventTypeScript("Event", 'new Event("update", {bubbles: true, cancelable: true})')
  if (apiName === "CustomEvent") return eventTypeScript("CustomEvent", 'new CustomEvent("update", {detail: {id: "output"}})')
  if (apiName === "ToggleEvent") return eventTypeScript("ToggleEvent", 'new ToggleEvent("toggle", {oldState: "closed", newState: "open"})')
  if (apiName === "UIEvent") return eventTypeScript("UIEvent", 'new UIEvent("select", {detail: 1})')
  if (apiName === "FocusEvent") return eventTypeScript("FocusEvent", 'new FocusEvent("focusin", {relatedTarget: null})')
  if (apiName === "MouseEvent") return eventTypeScript("MouseEvent", 'new MouseEvent("click", {clientX: 24, clientY: 16, button: 0})')
  if (apiName === "PointerEvent") return eventTypeScript("PointerEvent", 'new PointerEvent("pointermove", {pointerId: 7, pointerType: "mouse", pressure: 0.5})')
  if (apiName === "WheelEvent") return eventTypeScript("WheelEvent", 'new WheelEvent("wheel", {deltaY: 24, deltaMode: WheelEvent.DOM_DELTA_PIXEL})')
  if (apiName === "KeyboardEvent") return eventTypeScript("KeyboardEvent", 'new KeyboardEvent("keydown", {key: "Enter", code: "Enter"})')
  if (apiName === "InputEvent") return eventTypeScript("InputEvent", 'new InputEvent("input", {data: "x", inputType: "insertText"})')
  if (apiName === "CompositionEvent") return eventTypeScript("CompositionEvent", 'new CompositionEvent("compositionupdate", {data: "入力"})')
  return htmlTypeScript(apiName)
}

function documentTypeScript(statements: readonly string[], extraImport?: string): string {
  const imports = extraImport === undefined ? "createDocument" : `createDocument, ${extraImport}`
  return [
    `import {${imports}} from "@zavx0z/dom"`,
    "",
    "const document = createDocument()",
    ...statements,
  ].join("\n")
}

function eventTypeScript(apiName: string, constructor: string): string {
  return [
    `import {${apiName}} from "@zavx0z/dom"`,
    "",
    `const event = ${constructor}`,
    "void event.type",
  ].join("\n")
}

function htmlTypeScript(apiName: SupportedApiName): string {
  if (apiName === "HTMLButtonElement") return documentTypeScript([
    'const node = document.createElement("button")',
    'node.setAttribute("type", "button")',
    'node.title = "Output"',
    'node.append("Output")',
    "document.appendChild(node)",
  ])
  if (apiName === "HTMLInputElement") return documentTypeScript([
    'const node = document.createElement("input")',
    'node.type = "text"',
    'node.value = "Output"',
    "document.appendChild(node)",
  ])
  if (apiName === "HTMLImageElement") return documentTypeScript([
    'const node = document.createElement("img")',
    'node.src = ""',
    'node.alt = "Output preview"',
    "node.width = 240",
    "node.height = 72",
    "document.appendChild(node)",
  ])
  if (apiName === "HTMLSelectElement") return documentTypeScript([
    'const node = document.createElement("select")',
    'for (const label of ["Preview", "Output", "Capture"]) {',
    '  const option = document.createElement("option")',
    "  option.value = label.toLowerCase()",
    "  option.append(label)",
    "  node.appendChild(option)",
    "}",
    'node.value = "output"',
    "document.appendChild(node)",
  ])
  if (apiName === "HTMLOptionElement") return documentTypeScript([
    'const select = document.createElement("select")',
    'const node = document.createElement("option")',
    'node.value = "output"',
    'node.append("Output")',
    "node.selected = true",
    "select.appendChild(node)",
    "document.appendChild(select)",
  ])
  if (apiName === "HTMLTextAreaElement") return documentTypeScript([
    'const node = document.createElement("textarea")',
    "node.rows = 3",
    'node.value = "Preview\\nOutput"',
    "node.readOnly = true",
    "document.appendChild(node)",
  ])
  if (apiName === "HTMLProgressElement") return documentTypeScript([
    'const node = document.createElement("progress")',
    "node.max = 100",
    "node.value = 64",
    "document.appendChild(node)",
  ])
  if (apiName === "HTMLMeterElement") return documentTypeScript([
    'const node = document.createElement("meter")',
    "node.min = 0",
    "node.max = 100",
    "node.low = 25",
    "node.high = 75",
    "node.optimum = 50",
    "node.value = 64",
    "document.appendChild(node)",
  ])
  if (apiName === "HTMLLabelElement") return documentTypeScript([
    'const node = document.createElement("label")',
    'const control = document.createElement("input")',
    'control.id = "interface-label-control"',
    'control.type = "text"',
    'control.value = "Ready"',
    'node.htmlFor = "interface-label-control"',
    'node.append("Output ", control)',
    "document.append(node)",
    "void node.control",
  ])
  if (apiName === "HTMLFieldSetElement") return documentTypeScript([
    'const node = document.createElement("fieldset")',
    'const legend = document.createElement("legend")',
    'const input = document.createElement("input")',
    'node.name = "output"',
    "node.disabled = true",
    'legend.append("Output")',
    'input.type = "text"',
    'input.value = "Ready"',
    "node.append(legend, input)",
    "document.appendChild(node)",
  ])
  if (apiName === "HTMLLegendElement") return documentTypeScript([
    'const fieldset = document.createElement("fieldset")',
    'const node = document.createElement("legend")',
    'node.append("Output settings")',
    "fieldset.appendChild(node)",
    "document.appendChild(fieldset)",
  ])
  if (apiName === "HTMLUListElement") return documentTypeScript([
    'const node = document.createElement("ul")',
    'const item = document.createElement("li")',
    'item.append("Output")',
    "node.appendChild(item)",
    "document.appendChild(node)",
  ])
  if (apiName === "HTMLLIElement") return documentTypeScript([
    'const list = document.createElement("ul")',
    'const node = document.createElement("li")',
    'node.append("Output")',
    "list.appendChild(node)",
    "document.appendChild(list)",
  ])
  if (apiName === "HTMLTableElement" || apiName === "HTMLTableSectionElement" ||
    apiName === "HTMLTableRowElement" || apiName === "HTMLTableCellElement") {
    return tableTypeScript(apiName)
  }
  const tag = simpleHtmlTag(apiName)
  return documentTypeScript([
    `const node = document.createElement(${JSON.stringify(tag)})`,
    `node.append(${JSON.stringify(apiName)})`,
    "document.appendChild(node)",
  ])
}

function tableTypeScript(apiName: string): string {
  const target = apiName === "HTMLTableElement" ? "table"
    : apiName === "HTMLTableSectionElement" ? "body"
      : apiName === "HTMLTableRowElement" ? "row"
        : "cell"
  return documentTypeScript([
    'const table = document.createElement("table")',
    'const body = document.createElement("tbody")',
    'const row = document.createElement("tr")',
    'const cell = document.createElement("th")',
    'const value = document.createElement("td")',
    'cell.scope = "row"',
    "cell.colSpan = 1",
    'cell.append("Output")',
    'value.append("Ready")',
    "row.append(cell, value)",
    "body.appendChild(row)",
    "table.appendChild(body)",
    `const node = ${target}`,
    "document.appendChild(table)",
    "void node.localName",
  ])
}

function simpleHtmlTag(apiName: SupportedApiName): string {
  if (apiName === "HTMLDivElement") return "div"
  if (apiName === "HTMLSpanElement") return "span"
  if (apiName === "HTMLHeadingElement") return "h3"
  if (apiName === "HTMLParagraphElement") return "p"
  throw new Error(`DOM interface sample has no HTML tag: ${apiName}`)
}

function serializeElement(element: Element, depth = 0): string {
  const indent = "  ".repeat(depth)
  const attributes = element.getAttributeNames()
    .sort()
    .map((name) => {
      const value = element.getAttribute(name) ?? ""
      if ((name === "disabled" || name === "readonly" || name === "selected") && value === "") {
        return ` ${name}`
      }
      return ` ${name}="${escapeAttribute(value)}"`
    })
    .join("")
  const children = [...element.childNodes]
  if ((element.localName === "input" || element.localName === "img") && children.length === 0) {
    return `${indent}<${element.localName}${attributes}>`
  }
  if (children.length === 0) return `${indent}<${element.localName}${attributes}></${element.localName}>`
  if (children.every((node) => node.nodeType === 3)) {
    return `${indent}<${element.localName}${attributes}>${escapeText(element.textContent ?? "")}</${element.localName}>`
  }
  const body = children.map((node) => node.nodeType === 3
    ? `${"  ".repeat(depth + 1)}${escapeText(node.textContent ?? "")}`
    : serializeElement(node as Element, depth + 1)).join("\n")
  return `${indent}<${element.localName}${attributes}>\n${body}\n${indent}</${element.localName}>`
}

function escapeText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;")
}
