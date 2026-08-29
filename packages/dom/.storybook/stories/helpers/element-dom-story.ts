/** Renderer-owned external Storybook story support. */
import type {
  Document,
  Element,
  HTMLElement,
  Node,
} from "@zavx0z/dom"
import {
  ELEMENT_DOM_STORY_ROUTES,
  type ElementDomStoryRoute,
} from "./dom-routes.ts"

export type ElementDomStory = Readonly<{
  element: HTMLElement
  source: Readonly<{html: string; css: string; typescript: string}>
}>

export const elementDomStoryCss = String.raw`
.element-dom-story {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 520px;
  min-height: 260px;
  padding: 24px;
  background: rgb(28, 28, 28);
}

.element-dom-story__box {
  box-sizing: border-box;
  display: block;
  width: 260px;
  height: 120px;
  padding: 16px;
  border: 1px solid rgb(72, 72, 72);
  border-radius: 5px;
  background: rgb(48, 48, 48);
  color: rgb(224, 224, 224);
  font-size: 12px;
}

.element-dom-story__box--background {
  background: rgb(45, 104, 128);
}

.element-dom-story__box--border {
  border: 4px solid rgb(126, 220, 236);
}

.element-dom-story__box--padding {
  padding: 30px;
}

.element-dom-story__box--nested {
  overflow: hidden;
}

.element-dom-story__nested {
  box-sizing: border-box;
  display: block;
  width: 320px;
  height: 88px;
  padding: 10px;
  background: rgb(45, 104, 128);
}

.element-dom-story__z-stack {
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  width: 300px;
  height: 120px;
  padding: 12px;
}

.element-dom-story__z-item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 150px;
  height: 90px;
  border: 1px solid rgb(22, 22, 22);
  border-radius: 4px;
  color: rgb(240, 240, 240);
  font-size: 12px;
}

.element-dom-story__z-item--back {
  z-index: -1;
  background: rgb(132, 91, 42);
}

.element-dom-story__z-item--front {
  z-index: 2;
  margin-left: -70px;
  background: rgb(45, 104, 128);
}

.element-dom-story__scroll {
  box-sizing: border-box;
  display: block;
  width: 260px;
  height: 120px;
  padding: 8px;
  border: 1px solid rgb(72, 72, 72);
  background: rgb(36, 36, 36);
  scrollbar-width: thin;
}

.element-dom-story__scroll--vertical { overflow-y: auto; }
.element-dom-story__scroll--horizontal { overflow-x: auto; }
.element-dom-story__scroll--both { overflow: auto; }

.element-dom-story__scroll-content {
  box-sizing: border-box;
  display: block;
  width: 420px;
  height: 240px;
  padding: 12px;
  background: rgb(45, 104, 128);
  color: rgb(240, 240, 240);
  font-size: 12px;
}

.element-dom-story__span {
  display: inline;
  width: 260px;
  height: 28px;
  color: rgb(224, 224, 224);
  font-size: 14px;
}

.element-dom-story__span--center { text-align: center; }
.element-dom-story__span--right { text-align: right; }

.element-dom-story__button,
.element-dom-story__input,
.element-dom-story__select {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 220px;
  height: 32px;
  padding: 5px 10px;
  border: 1px solid rgb(72, 72, 72);
  border-radius: 4px;
  background: rgb(48, 48, 48);
  color: rgb(224, 224, 224);
  font-size: 12px;
}

.element-dom-story__input,
.element-dom-story__select {
  display: block;
  justify-content: flex-start;
  background: rgb(36, 36, 36);
}

.element-dom-story__input--active,
.element-dom-story__select--active {
  border-color: rgb(126, 220, 236);
}

.element-dom-story__button[disabled],
.element-dom-story__input[disabled],
.element-dom-story__select[disabled] {
  opacity: 0.5;
}

.element-dom-story__list {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 300px;
  max-height: 150px;
  padding: 4px;
  gap: 3px;
  border: 1px solid rgb(72, 72, 72);
  border-radius: 4px;
  overflow-y: auto;
  scrollbar-width: thin;
  background: rgb(36, 36, 36);
}

.element-dom-story__list-item {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 30px;
  padding: 6px 9px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: rgb(48, 48, 48);
  color: rgb(224, 224, 224);
  font-size: 12px;
}

.element-dom-story__list--dense .element-dom-story__list-item {
  height: 24px;
  padding: 3px 7px;
  font-size: 11px;
}

.element-dom-story__list--interactive .element-dom-story__list-item[aria-selected="true"] {
  background: rgb(45, 104, 128);
}

.element-dom-story__status {
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 420px;
  height: 28px;
  gap: 20px;
  padding: 4px 10px;
  border: 1px solid rgb(22, 22, 22);
  background: rgb(36, 36, 36);
  color: rgb(176, 176, 176);
  font-size: 11px;
}

.element-dom-story__style {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 260px;
  height: 100px;
  padding: 16px;
  border: 1px solid rgb(72, 72, 72);
  border-radius: 4px;
  background: rgb(48, 48, 48);
  color: rgb(224, 224, 224);
  font-size: 13px;
}

.element-dom-story__style--padding { padding: 32px; }
.element-dom-story__style--flex { flex-direction: row; gap: 10px; }
.element-dom-story__style--rounded { border-radius: 14px; }
.element-dom-story__style--capsule { width: 220px; height: 48px; border-radius: 24px; }
.element-dom-story__style--color { background: rgb(45, 104, 128); color: rgb(240, 240, 240); }
.element-dom-story__style--typography { font-size: 18px; color: rgb(126, 220, 236); }
.element-dom-story__style--cyan { background: rgb(45, 104, 128); }
.element-dom-story__style--green { background: rgb(48, 112, 76); }
.element-dom-story__style--orange { background: rgb(132, 91, 42); }
.element-dom-story__style--red { background: rgb(132, 56, 56); }

.element-dom-story__pointer {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 180px;
  height: 44px;
  padding: 6px 12px;
  border: 2px solid rgb(72, 72, 72);
  border-radius: 5px;
  background: rgb(48, 48, 48);
  color: rgb(224, 224, 224);
  font-size: 12px;
}

.element-dom-story__pointer[data-state="hover"] { border-color: rgb(126, 220, 236); }
.element-dom-story__pointer[data-state="press"] { background: rgb(45, 104, 128); }
.element-dom-story__pointer[data-state="release"] { border-color: rgb(48, 112, 76); }
.element-dom-story__pointer[data-state="click"] { background: rgb(48, 112, 76); }
.element-dom-story__pointer[disabled] { opacity: 0.5; }
`

export function createElementDomStory(
  document: Document,
  route: ElementDomStoryRoute,
): ElementDomStory {
  const root = document.createElement("section")
  root.className = "element-dom-story"
  const sample = createSample(document, route)
  root.appendChild(sample)
  return Object.freeze({
    element: root,
    source: Object.freeze({
      html: serializeElement(root),
      css: elementDomStoryCss,
      typescript: renderTypeScript(route),
    }),
  })
}

export function isElementDomStoryRoute(route: string): route is ElementDomStoryRoute {
  return (ELEMENT_DOM_STORY_ROUTES as readonly string[]).includes(route)
}

function createSample(document: Document, route: ElementDomStoryRoute): HTMLElement {
  if (route === "components/data/scrollbar/vertical/default") {
    return createDivSample(document, "elements/primitives/div/scroll/vertical")
  }
  if (route === "components/data/noti/status/unavailable") {
    const status = document.createElement("div")
    status.className = "element-dom-story__status"
    status.setAttribute("role", "status")
    status.appendChild(document.createTextNode("Noti не опубликован в DOM API"))
    return status
  }
  if (route.includes("/div/")) return createDivSample(document, route)
  if (route.includes("/span/")) {
    const span = document.createElement("span")
    span.className = route.endsWith("/center")
      ? "element-dom-story__span element-dom-story__span--center"
      : route.endsWith("/right")
        ? "element-dom-story__span element-dom-story__span--right"
        : "element-dom-story__span"
    span.appendChild(document.createTextNode("Inline text from a standard span"))
    return span
  }
  if (route.includes("/button/")) {
    const button = document.createElement("button")
    button.className = "element-dom-story__button"
    button.setAttribute("type", "button")
    button.disabled = route.endsWith("/disabled")
    button.title = route.endsWith("/clickable") ? "Standard click target" : "Button"
    button.appendChild(document.createTextNode(route.endsWith("/clickable") ? "Clickable" : "Output"))
    return button
  }
  if (route.includes("/input/")) {
    const input = document.createElement("input")
    input.className = route.endsWith("/active")
      ? "element-dom-story__input element-dom-story__input--active"
      : "element-dom-story__input"
    input.type = "text"
    input.value = "Output"
    input.disabled = route.endsWith("/disabled")
    return input
  }
  if (route.includes("/select/")) {
    const select = document.createElement("select")
    select.className = route.endsWith("/active")
      ? "element-dom-story__select element-dom-story__select--active"
      : "element-dom-story__select"
    for (const label of ["Preview", "Output", "Capture"]) {
      const option = document.createElement("option")
      option.value = label.toLowerCase()
      option.appendChild(document.createTextNode(label))
      select.appendChild(option)
    }
    select.value = "output"
    select.disabled = route.endsWith("/disabled")
    return select
  }
  if (route.includes("/list/")) return createListSample(document, route)
  if (route.includes("/status-bar/")) return createStatusSample(document)
  if (route.startsWith("elements/style/")) return createStyleSample(document, route)
  return createPointerSample(document, route)
}

function createDivSample(document: Document, route: ElementDomStoryRoute): HTMLElement {
  if (route.endsWith("/z-index")) {
    const stack = document.createElement("div")
    const back = document.createElement("div")
    const front = document.createElement("div")
    stack.className = "element-dom-story__z-stack"
    back.className = "element-dom-story__z-item element-dom-story__z-item--back"
    front.className = "element-dom-story__z-item element-dom-story__z-item--front"
    back.appendChild(document.createTextNode("z-index -1"))
    front.appendChild(document.createTextNode("z-index 2"))
    stack.append(back, front)
    return stack
  }
  if (route.includes("/scroll/")) {
    const box = document.createElement("div")
    const axis = route.endsWith("/vertical") ? "vertical" : route.endsWith("/horizontal") ? "horizontal" : "both"
    box.className = `element-dom-story__scroll element-dom-story__scroll--${axis}`
    const content = document.createElement("div")
    content.className = "element-dom-story__scroll-content"
    content.appendChild(document.createTextNode(`${axis} overflow uses standard scroll state`))
    box.appendChild(content)
    return box
  }
  const box = document.createElement("div")
  const modifier = route.endsWith("/background")
    ? "background"
    : route.endsWith("/border")
      ? "border"
      : route.endsWith("/padding")
        ? "padding"
        : "nested"
  box.className = `element-dom-story__box element-dom-story__box--${modifier}`
  if (modifier === "nested") {
    const nested = document.createElement("div")
    nested.className = "element-dom-story__nested"
    nested.appendChild(document.createTextNode("Overflow is clipped by the parent div"))
    box.appendChild(nested)
  } else {
    box.appendChild(document.createTextNode(`CSS ${modifier}`))
  }
  return box
}

function createListSample(document: Document, route: ElementDomStoryRoute): HTMLElement {
  const list = document.createElement("ul")
  const mode = route.endsWith("/dense")
    ? "dense"
    : route.endsWith("/interactive")
      ? "interactive"
      : route.endsWith("/scroll")
        ? "scroll"
        : "regular"
  list.className = `element-dom-story__list element-dom-story__list--${mode}`
  list.setAttribute("role", "listbox")
  const count = mode === "scroll" ? 8 : 3
  for (let index = 0; index < count; index++) {
    const item = document.createElement("li")
    item.className = "element-dom-story__list-item"
    item.setAttribute("role", "option")
    item.setAttribute("aria-selected", String(mode === "interactive" && index === 1))
    item.appendChild(document.createTextNode(`Item ${index + 1}`))
    list.appendChild(item)
  }
  return list
}

function createStatusSample(document: Document): HTMLElement {
  const status = document.createElement("div")
  status.className = "element-dom-story__status"
  status.setAttribute("role", "status")
  for (const value of ["Objects 42", "Draws 18", "GPU 1.11 ms"]) {
    const span = document.createElement("span")
    span.appendChild(document.createTextNode(value))
    status.appendChild(span)
  }
  return status
}

function createStyleSample(document: Document, route: ElementDomStoryRoute): HTMLElement {
  const sample = document.createElement("div")
  const leaf = route.split("/").at(-2) === "tone" ? route.split("/").at(-1)! : route.split("/").at(-2)!
  sample.className = `element-dom-story__style element-dom-story__style--${leaf}`
  if (leaf === "flex") {
    for (const label of ["A", "B", "C"]) {
      const span = document.createElement("span")
      span.appendChild(document.createTextNode(label))
      sample.appendChild(span)
    }
  } else {
    sample.appendChild(document.createTextNode(`CSS ${leaf}`))
  }
  return sample
}

function createPointerSample(document: Document, route: ElementDomStoryRoute): HTMLElement {
  const button = document.createElement("button")
  const state = route.split("/").at(-1) ?? "idle"
  button.className = "element-dom-story__pointer"
  button.setAttribute("type", "button")
  button.setAttribute("data-state", state)
  button.disabled = state === "disabled"
  button.title = `Pointer state: ${state}`
  button.appendChild(document.createTextNode(`Pointer · ${state}`))
  return button
}

function renderTypeScript(route: ElementDomStoryRoute): string {
  const tag = route.includes("/button/") || route.startsWith("elements/events/")
    ? "button"
    : route.includes("/input/")
      ? "input"
      : route.includes("/select/")
        ? "select"
        : route.includes("/list/")
          ? "ul"
          : route.includes("/span/")
            ? "span"
            : "div"
  return [
    'import {createDocument} from "@zavx0z/dom"',
    "",
    "const document = createDocument()",
    `const element = document.createElement(${JSON.stringify(tag)})`,
    `element.setAttribute("data-story-route", ${JSON.stringify(route)})`,
    "document.appendChild(element)",
  ].join("\n")
}

function serializeElement(element: Element, depth = 0): string {
  const indent = "  ".repeat(depth)
  const attributes = element.getAttributeNames().sort().map((name) => {
    const value = element.getAttribute(name) ?? ""
    if ((name === "disabled" || name === "readonly") && value === "") return ` ${name}`
    return ` ${name}="${escapeAttribute(value)}"`
  }).join("")
  const children = [...element.childNodes]
  if (children.length === 0) return `${indent}<${element.localName}${attributes}></${element.localName}>`
  if (children.every((node) => node.nodeType === 3)) {
    return `${indent}<${element.localName}${attributes}>${escapeText(element.textContent ?? "")}</${element.localName}>`
  }
  const body = children.map((node: Node) => node.nodeType === 3
    ? `${"  ".repeat(depth + 1)}${escapeText(node.textContent ?? "")}`
    : serializeElement(node as Element, depth + 1)).join("\n")
  return `${indent}<${element.localName}${attributes}>\n${body}\n${indent}</${element.localName}>`
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;")
}
