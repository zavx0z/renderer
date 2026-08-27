import {
  Element,
  Event,
  HTMLElement,
  HTMLInputElement,
  Node
} from "@zavx0z/dom"
import type {EventListener} from "@zavx0z/dom"

export type HostProps = Readonly<Record<string, unknown>>

export type InvokeEvent = (
  element: Element,
  callback: HostEventHandler,
  event: Event
) => unknown

type HostEventHandler = (event: Event) => unknown

type EventBinding = {
  callback: HostEventHandler
  capture: boolean
  listener: EventListener
  type: string
}

type EventDescriptor = Readonly<{
  capture: boolean
  type: string
}>

const eventBindings = new WeakMap<Element, Map<string, EventBinding>>()

const reservedProperties = new Set([
  "children",
  "key",
  "ref",
  "__self",
  "__source",
  "suppressContentEditableWarning",
  "suppressHydrationWarning"
])

const unitlessStyleProperties = new Set([
  "animation-iteration-count",
  "column-count",
  "fill-opacity",
  "flex",
  "flex-grow",
  "flex-shrink",
  "font-weight",
  "grid-column",
  "grid-row",
  "line-height",
  "opacity",
  "order",
  "orphans",
  "scale",
  "stroke-dashoffset",
  "stroke-opacity",
  "stroke-width",
  "tab-size",
  "widows",
  "z-index",
  "zoom"
])

function isAttributePrimitive(value: unknown): value is string | number | bigint | boolean {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
}

function eventDescriptor(propertyName: string): EventDescriptor | null {
  if (!propertyName.startsWith("on") || propertyName.length <= 2) return null
  const capture = propertyName.endsWith("Capture")
  const end = capture ? -"Capture".length : undefined
  const eventName = propertyName.slice(2, end).toLowerCase()
  if (eventName === "click" || eventName === "input" || eventName === "focus" || eventName === "blur") {
    return {capture, type: eventName}
  }
  return eventName.startsWith("pointer") && eventName.length > "pointer".length
    ? {capture, type: eventName}
    : null
}

function stylePropertyName(propertyName: string): string {
  if (propertyName.startsWith("--")) return propertyName
  const kebab = propertyName.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`)
  return kebab.startsWith("ms-") ? `-${kebab}` : kebab
}

function serializeStyle(style: unknown): string | null {
  if (style === null || style === undefined || style === false) return null
  if (typeof style === "string") return style
  if (typeof style !== "object" || Array.isArray(style)) {
    throw new TypeError("style must be a string, an object, null, or undefined")
  }

  const declarations: string[] = []
  for (const [sourceName, sourceValue] of Object.entries(style)) {
    if (sourceValue === null || sourceValue === undefined || sourceValue === "") continue
    if (typeof sourceValue !== "string" && typeof sourceValue !== "number") {
      throw new TypeError(`Unsupported style value for ${sourceName}`)
    }
    const propertyName = stylePropertyName(sourceName)
    if (propertyName === "" || propertyName.includes(":")) {
      throw new TypeError(`Invalid style property ${sourceName}`)
    }
    const value = typeof sourceValue === "number" && sourceValue !== 0 &&
      !propertyName.startsWith("--") && !unitlessStyleProperties.has(propertyName)
      ? `${sourceValue}px`
      : String(sourceValue)
    declarations.push(`${propertyName}: ${value}`)
  }
  return declarations.length > 0 ? declarations.join("; ") : null
}

function validateEventProperty(name: string, value: unknown, descriptor: EventDescriptor): void {
  if (value === null || value === undefined) return
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function, null, or undefined`)
  }
  if (descriptor.type === "") throw new TypeError(`Unsupported event property ${name}`)
}

function validateProperty(name: string, value: unknown): void {
  if (reservedProperties.has(name)) return
  if (name === "dangerouslySetInnerHTML") {
    throw new TypeError("dangerouslySetInnerHTML is not supported by @zavx0z/dom-react")
  }
  if (name === "style") {
    serializeStyle(value)
    return
  }
  const descriptor = eventDescriptor(name)
  if (descriptor) {
    validateEventProperty(name, value, descriptor)
    return
  }
  if (value === null || value === undefined || isAttributePrimitive(value)) return
  throw new TypeError(`Unsupported non-primitive property ${name}`)
}

function validateProperties(props: HostProps): void {
  if (Object.prototype.hasOwnProperty.call(props, "dangerouslySetInnerHTML")) {
    throw new TypeError("dangerouslySetInnerHTML is not supported by @zavx0z/dom-react")
  }
  for (const [name, value] of Object.entries(props)) validateProperty(name, value)
}

function setStringAttribute(element: Element, name: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    element.removeAttribute(name)
    return
  }
  if (value === true) {
    element.setAttribute(name, "")
    return
  }
  element.setAttribute(name, String(value))
}

function setDataOrAriaAttribute(element: Element, name: string, value: unknown): void {
  if (value === null || value === undefined) {
    element.removeAttribute(name)
    return
  }
  element.setAttribute(name, String(value))
}

function setEventProperty(
  element: Element,
  name: string,
  value: unknown,
  descriptor: EventDescriptor,
  invokeEvent: InvokeEvent
): void {
  const key = `${descriptor.type}:${descriptor.capture ? "capture" : "bubble"}`
  const bindings = eventBindings.get(element)
  const current = bindings?.get(key)

  if (value === null || value === undefined) {
    if (!current) return
    element.removeEventListener(current.type, current.listener, {capture: current.capture})
    bindings!.delete(key)
    if (bindings!.size === 0) eventBindings.delete(element)
    return
  }

  const callback = value as HostEventHandler
  if (current) {
    current.callback = callback
    return
  }

  const nextBindings = bindings ?? new Map<string, EventBinding>()
  const binding: EventBinding = {
    callback,
    capture: descriptor.capture,
    listener: () => undefined,
    type: descriptor.type
  }
  binding.listener = event => invokeEvent(element, binding.callback, event)
  nextBindings.set(key, binding)
  eventBindings.set(element, nextBindings)
  element.addEventListener(binding.type, binding.listener, {capture: binding.capture})
}

function setProperty(
  element: Element,
  name: string,
  value: unknown,
  invokeEvent: InvokeEvent
): void {
  if (reservedProperties.has(name) || name === "dangerouslySetInnerHTML") return

  const descriptor = eventDescriptor(name)
  if (descriptor) {
    setEventProperty(element, name, value, descriptor, invokeEvent)
    return
  }

  switch (name) {
    case "className":
      setStringAttribute(element, "class", value)
      return
    case "id":
    case "title":
      setStringAttribute(element, name, value)
      return
    case "style": {
      const serialized = serializeStyle(value)
      if (serialized === null) element.removeAttribute("style")
      else element.setAttribute("style", serialized)
      return
    }
    case "disabled":
      setStringAttribute(element, "disabled", Boolean(value))
      return
    case "checked":
      if (element instanceof HTMLInputElement) element.checked = Boolean(value)
      else setStringAttribute(element, "checked", Boolean(value))
      return
    case "value":
      if (element instanceof HTMLInputElement) element.value = value === null || value === undefined ? "" : String(value)
      else setStringAttribute(element, "value", value)
      return
    case "type":
    case "placeholder":
      setStringAttribute(element, name, value)
      return
    case "tabIndex":
      if (value === null || value === undefined || value === false) element.removeAttribute("tabindex")
      else if (element instanceof HTMLElement) element.tabIndex = Number(value)
      else element.setAttribute("tabindex", String(value))
      return
    default:
      if (name.startsWith("data-") || name.startsWith("aria-")) {
        setDataOrAriaAttribute(element, name, value)
      } else {
        setStringAttribute(element, name, value)
      }
  }
}

export function applyProperties(
  element: Element,
  previous: HostProps,
  next: HostProps,
  invokeEvent: InvokeEvent
): void {
  validateProperties(next)
  const names = new Set([...Object.keys(previous), ...Object.keys(next)])
  for (const name of names) {
    const previousValue = previous[name]
    const nextValue = next[name]
    if (Object.is(previousValue, nextValue)) continue
    setProperty(element, name, nextValue, invokeEvent)
  }
}

export function clearDeletedProperties(node: Node): void {
  if (node instanceof Element) {
    const bindings = eventBindings.get(node)
    if (bindings) {
      for (const binding of bindings.values()) {
        node.removeEventListener(binding.type, binding.listener, {capture: binding.capture})
      }
      eventBindings.delete(node)
    }
  }
  for (const child of node.childNodes) clearDeletedProperties(child)
}
