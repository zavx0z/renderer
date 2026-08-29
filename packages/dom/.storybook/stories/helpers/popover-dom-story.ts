/** Renderer-owned external Storybook story support. */
import {
  getPopoverVisibilityState,
  type Document,
  type Element,
  type HTMLButtonElement,
  type HTMLElement,
  type HTMLLIElement,
  type HTMLUListElement,
  type Node,
  type Text,
} from "@zavx0z/dom"
import {
  POPOVER_DOM_STORY_ROUTES,
  type PopoverDomStoryRoute,
} from "./dom-routes.ts"

export type PopoverDomStoryRefs = Readonly<{
  root: HTMLElement
  trigger: HTMLButtonElement
  popover: HTMLElement
  listbox: HTMLUListElement | null
  options: readonly HTMLLIElement[]
}>

export type PopoverDomStory = Readonly<{
  element: HTMLElement
  refs: PopoverDomStoryRefs
  source: Readonly<{html: string; css: string; typescript: string}>
  dispose(): void
}>

type OptionEntry = Readonly<{
  disabled?: boolean
  label: string
  value: string
}>

const SELECT_OPTIONS: readonly OptionEntry[] = Object.freeze([
  {value: "add", label: "Сложение"},
  {value: "multiply", label: "Умножение"},
  {value: "subtract", label: "Вычитание"},
  {value: "divide", label: "Деление", disabled: true},
] as const)

export const popoverDomStoryCss = String.raw`
.popover-dom-story {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 520px;
  min-height: 300px;
  gap: 7px;
  padding: 24px;
  background: rgb(28, 28, 28);
  color: rgb(224, 224, 224);
}

.popover-dom-story__caption {
  display: block;
  width: 260px;
  min-height: 20px;
  color: rgb(176, 176, 176);
  font-size: 11px;
}

.popover-dom-story__trigger {
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 260px;
  height: 32px;
  gap: 8px;
  padding: 5px 10px;
  border: 1px solid rgb(72, 72, 72);
  border-radius: 4px;
  background: rgb(48, 48, 48);
  color: rgb(224, 224, 224);
  font-size: 12px;
}

.popover-dom-story__trigger[aria-expanded="true"] {
  border-color: rgb(126, 220, 236);
}

.popover-dom-story__trigger-label {
  display: inline;
  color: rgb(224, 224, 224);
}

.popover-dom-story__trigger-indicator {
  display: inline;
  width: 14px;
  color: rgb(126, 220, 236);
  text-align: center;
}

.popover-dom-story__popover {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 260px;
  min-height: 66px;
  padding: 6px;
  border: 1px solid rgb(72, 72, 72);
  border-radius: 4px;
  background: rgb(36, 36, 36);
  color: rgb(224, 224, 224);
}

.popover-dom-story__popover[data-placement="below"] {
  margin-top: 6px;
}

.popover-dom-story__popover[data-placement="above"] {
  margin-bottom: 6px;
}

.popover-dom-story__message {
  display: block;
  min-height: 48px;
  padding: 14px 10px;
  color: rgb(224, 224, 224);
  font-size: 12px;
  text-align: center;
}

.popover-dom-story__menu-header {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 26px;
  padding: 5px 8px;
  border-bottom: 1px solid rgb(72, 72, 72);
  color: rgb(176, 176, 176);
  font-size: 11px;
}

.popover-dom-story__listbox {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 2px;
  padding: 2px 0 0;
  background: rgb(36, 36, 36);
}

.popover-dom-story__option {
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: 26px;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: rgb(48, 48, 48);
  color: rgb(224, 224, 224);
  font-size: 11px;
}

.popover-dom-story__option[aria-selected="true"] {
  background: rgb(45, 104, 128);
  color: rgb(240, 240, 240);
}

.popover-dom-story__option[aria-disabled="true"] {
  opacity: 0.5;
}
`

export function createPopoverDomStory(
  document: Document,
  route: PopoverDomStoryRoute,
): PopoverDomStory {
  const selectRoute = route.includes("/select/")
  const initiallyOpen = !route.endsWith("/closed")
  const root = document.createElement("section")
  const caption = document.createElement("span")
  const trigger = document.createElement("button")
  const triggerLabel = document.createElement("span")
  const triggerLabelText = document.createTextNode(selectRoute ? "Умножение" : "Открыть")
  const indicator = document.createElement("span")
  const popover = document.createElement("div")
  const popoverId = route.includes("/popover/")
    ? `elements-popover-state-${route.split("/").at(-1)}`
    : `elements-select-state-${route.split("/").at(-1)}`
  let listbox: HTMLUListElement | null = null
  const options: HTMLLIElement[] = []
  const optionListeners: Array<Readonly<{
    listener: () => void
    option: HTMLLIElement
  }>> = []
  let disposed = false

  root.className = "popover-dom-story"
  root.setAttribute("aria-label", selectRoute ? "Составной выбор значения" : "Всплывающий слой")
  caption.className = "popover-dom-story__caption"
  caption.appendChild(document.createTextNode(selectRoute ? "Операция" : "Стандартный Popover API"))

  trigger.className = "popover-dom-story__trigger"
  trigger.setAttribute("type", "button")
  trigger.setAttribute("aria-controls", popoverId)
  trigger.setAttribute("aria-expanded", String(initiallyOpen))
  trigger.setAttribute("aria-haspopup", selectRoute ? "listbox" : "dialog")
  trigger.setAttribute("popovertarget", popoverId)
  trigger.title = selectRoute ? "Выбрать операцию" : initiallyOpen ? "Закрыть" : "Открыть"
  triggerLabel.className = "popover-dom-story__trigger-label"
  triggerLabel.appendChild(triggerLabelText)
  indicator.className = "popover-dom-story__trigger-indicator"
  indicator.setAttribute("aria-hidden", "true")
  indicator.appendChild(document.createTextNode(route.endsWith("/flipped") ? "▴" : "▾"))
  trigger.append(triggerLabel, indicator)

  popover.id = popoverId
  popover.className = "popover-dom-story__popover"
  popover.popover = "manual"
  popover.setAttribute("data-placement", route.endsWith("/flipped") ? "above" : "below")

  if (selectRoute) {
    const menuHeader = route.endsWith("/header") || route.endsWith("/flipped")
      ? document.createElement("header")
      : null
    if (menuHeader) {
      menuHeader.className = "popover-dom-story__menu-header"
      menuHeader.appendChild(document.createTextNode("Операция"))
      popover.appendChild(menuHeader)
    }
    listbox = document.createElement("ul")
    listbox.className = "popover-dom-story__listbox"
    listbox.setAttribute("role", "listbox")
    listbox.setAttribute("aria-label", "Операция")
    for (const entry of SELECT_OPTIONS) {
      const option = document.createElement("li")
      const listener = (): void => selectOption(entry, option)
      option.className = "popover-dom-story__option"
      option.setAttribute("role", "option")
      option.setAttribute("data-value", entry.value)
      option.setAttribute("aria-selected", String(entry.value === "multiply"))
      if (entry.disabled) option.setAttribute("aria-disabled", "true")
      option.appendChild(document.createTextNode(entry.label))
      if (!entry.disabled) {
        option.addEventListener("click", listener)
        optionListeners.push(Object.freeze({listener, option}))
      }
      options.push(option)
      listbox.appendChild(option)
    }
    popover.appendChild(listbox)
  } else {
    const message = document.createElement("div")
    message.className = "popover-dom-story__message"
    message.setAttribute("role", "dialog")
    message.setAttribute("aria-label", "Popover")
    message.appendChild(document.createTextNode("Содержимое всплывающего слоя"))
    popover.appendChild(message)
  }

  const setOpen = (open: boolean): void => {
    if (disposed || !root.isConnected) return
    const showing = popover[getPopoverVisibilityState]() === "showing"
    if (open && !showing) popover.showPopover({source: trigger})
    if (!open && showing) popover.hidePopover()
    trigger.setAttribute("aria-expanded", String(open))
    if (!selectRoute) {
      triggerLabelText.data = open ? "Закрыть" : "Открыть"
      trigger.title = open ? "Закрыть" : "Открыть"
    }
  }
  const onTriggerClick = (): void => {
    setOpen(popover[getPopoverVisibilityState]() !== "showing")
  }
  const selectOption = (entry: OptionEntry, option: HTMLLIElement): void => {
    if (disposed || entry.disabled) return
    for (const candidate of options) {
      candidate.setAttribute("aria-selected", String(candidate === option))
    }
    triggerLabelText.data = entry.label
    setOpen(false)
  }

  trigger.addEventListener("click", onTriggerClick)
  root.append(caption, trigger, popover)

  const initialOpenTask = initiallyOpen ? setTimeout(() => setOpen(true), 0) : null
  const refs: PopoverDomStoryRefs = Object.freeze({
    root,
    trigger,
    popover,
    listbox,
    options: Object.freeze([...options]),
  })

  return Object.freeze({
    element: root,
    refs,
    source: Object.freeze({
      html: serializeElement(root),
      css: popoverDomStoryCss,
      typescript: renderTypeScript(route, popoverId),
    }),
    dispose() {
      if (disposed) return
      disposed = true
      if (initialOpenTask !== null) clearTimeout(initialOpenTask)
      trigger.removeEventListener("click", onTriggerClick)
      for (const entry of optionListeners) {
        entry.option.removeEventListener("click", entry.listener)
      }
      if (root.isConnected && popover[getPopoverVisibilityState]() === "showing") {
        popover.hidePopover()
      }
    },
  })
}

export function isPopoverDomStoryRoute(route: string): route is PopoverDomStoryRoute {
  return (POPOVER_DOM_STORY_ROUTES as readonly string[]).includes(route)
}

function renderTypeScript(route: PopoverDomStoryRoute, popoverId: string): string {
  const selectRoute = route.includes("/select/")
  const lines = [
    'import {createDocument, getPopoverVisibilityState} from "@zavx0z/dom"',
    "",
    "const document = createDocument()",
    'const root = document.createElement("section")',
    'const trigger = document.createElement("button")',
    'const popover = document.createElement("div")',
    `popover.id = ${JSON.stringify(popoverId)}`,
    'popover.popover = "manual"',
    `trigger.setAttribute("popovertarget", ${JSON.stringify(popoverId)})`,
    `trigger.setAttribute("aria-haspopup", ${JSON.stringify(selectRoute ? "listbox" : "dialog")})`,
  ]
  if (selectRoute) {
    lines.push(
      'const listbox = document.createElement("ul")',
      'listbox.setAttribute("role", "listbox")',
      'const option = document.createElement("li")',
      'option.setAttribute("role", "option")',
      'option.setAttribute("aria-selected", "true")',
      "listbox.appendChild(option)",
      "popover.appendChild(listbox)",
    )
  }
  lines.push(
    "root.append(trigger, popover)",
    "document.appendChild(root)",
    'trigger.addEventListener("click", () => {',
    '  if (popover[getPopoverVisibilityState]() === "showing") popover.hidePopover()',
    "  else popover.showPopover({source: trigger})",
    "})",
    route.endsWith("/closed")
      ? 'trigger.setAttribute("aria-expanded", "false")'
      : "popover.showPopover({source: trigger})",
    'const open = popover[getPopoverVisibilityState]() === "showing"',
  )
  return lines.join("\n")
}

function serializeElement(element: Element, depth = 0): string {
  const indent = "  ".repeat(depth)
  const attributes = element.getAttributeNames().sort().map((name) => {
    const value = element.getAttribute(name) ?? ""
    return ` ${name}="${escapeAttribute(value)}"`
  }).join("")
  const children = [...element.childNodes]
  if (children.length === 0) return `${indent}<${element.localName}${attributes}></${element.localName}>`
  if (children.every((node) => node.nodeType === 3)) {
    return `${indent}<${element.localName}${attributes}>${escapeText(element.textContent ?? "")}</${element.localName}>`
  }
  const body = children.map((node: Node) => node.nodeType === 3
    ? `${"  ".repeat(depth + 1)}${escapeText((node as Text).data)}`
    : serializeElement(node as Element, depth + 1)).join("\n")
  return `${indent}<${element.localName}${attributes}>\n${body}\n${indent}</${element.localName}>`
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;")
}
