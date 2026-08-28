import {
  DocumentFragment,
  Element,
  Event,
  HTMLElement,
  HTMLInputElement,
  Node,
  type Document,
  type EventListener,
} from "@zavx0z/dom"

const descriptorBrand = Symbol("@zavx0z/dom-components/descriptor")
const dynamicBrand = Symbol("@zavx0z/dom-components/dynamic")
const stateBrand = Symbol("@zavx0z/dom-components/state")
const fragmentType = Symbol("@zavx0z/dom-components/fragment")

export type SetStateAction<Value> = Value | ((previous: Value) => Value)
export type StateSetter<Value> = (action: SetStateAction<Value>) => void

export type FunctionComponent<Props extends object = Record<string, never>> = (
  props: Props & Readonly<{children?: Renderable}>,
) => Renderable

export type ElementType = string | FunctionComponent<any> | typeof fragmentType

export type Renderable =
  | JsxElement
  | Node
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly Renderable[]

export type JsxElement = Readonly<{
  [descriptorBrand]: true
  key: string | number | null
  props: Readonly<Record<string, unknown>>
  type: ElementType
}>

type DynamicValue = Readonly<{
  [dynamicBrand]: true
  read: () => unknown
}>

type Scope = {
  active: boolean
  children: Set<Scope>
  cleanups: Set<() => void>
  document: Document
  parent: Scope | null
}

type Computation = {
  active: boolean
  dependencies: Set<StateCell<unknown>>
  run(): void
}

type StateCell<Value> = {
  [stateBrand]: true
  scope: Scope
  subscribers: Set<Computation>
  value: Value
}

export type RootContainer = Element | DocumentFragment

export interface Root {
  render(children: Renderable): void
  unmount(): void
}

let currentScope: Scope | null = null
let currentComputation: Computation | null = null
let batchDepth = 0
let flushing = false
const pendingComputations = new Set<Computation>()
const roots = new WeakMap<RootContainer, Root>()

export const Fragment = fragmentType

export function createJsxElement(
  type: ElementType,
  sourceProps: Record<string, unknown> | null,
  key?: string | number,
): JsxElement {
  if (typeof type !== "string" && typeof type !== "function" && type !== fragmentType) {
    throw new TypeError("JSX type must be an intrinsic tag, function component, or Fragment")
  }
  if (key !== undefined && key !== null) {
    throw new TypeError("Keyed JSX is not supported by @zavx0z/dom-components yet")
  }
  return Object.freeze({
    [descriptorBrand]: true as const,
    key: null,
    props: Object.freeze({...sourceProps}),
    type: type as ElementType,
  })
}

/**
 * React-shaped authoring intrinsic. The first tuple member is a compiler-owned
 * signal handle at runtime and must only be read through the Bun transform.
 */
export function useState<Value>(initial: Value | (() => Value)): [Value, StateSetter<Value>] {
  const scope = requireCurrentScope("useState")
  const value = typeof initial === "function"
    ? (initial as () => Value)()
    : initial
  const cell: StateCell<Value> = {
    [stateBrand]: true,
    scope,
    subscribers: new Set(),
    value,
  }
  const setValue: StateSetter<Value> = action => {
    if (!scope.active) throw new Error("Cannot update state after its component was unmounted")
    scope.document.transaction(() => batch(() => {
      const next = typeof action === "function"
        ? (action as (previous: Value) => Value)(cell.value)
        : action
      if (Object.is(next, cell.value)) return
      cell.value = next
      for (const subscriber of [...cell.subscribers]) schedule(subscriber)
    }))
  }
  return [cell as unknown as Value, setValue]
}

export function batch<Result>(callback: () => Result): Result {
  batchDepth += 1
  try {
    return callback()
  } finally {
    batchDepth -= 1
    if (batchDepth === 0) flushComputations()
  }
}

export function readState<Value>(candidate: Value): Value {
  const cell = candidate as unknown as Partial<StateCell<Value>>
  if (!cell || typeof cell !== "object" || cell[stateBrand] !== true) {
    throw new TypeError("A useState value was read without the @zavx0z/dom-components transform")
  }
  if (!cell.scope?.active) throw new Error("Cannot read state after its component was unmounted")
  if (currentComputation) {
    currentComputation.dependencies.add(cell as StateCell<unknown>)
    cell.subscribers?.add(currentComputation)
  }
  return cell.value as Value
}

export function dynamic(read: () => unknown): DynamicValue {
  if (typeof read !== "function") throw new TypeError("A dynamic JSX binding requires a function")
  return Object.freeze({[dynamicBrand]: true as const, read})
}

export function createRoot(container: RootContainer): Root {
  assertRootContainer(container)
  if (roots.has(container)) throw new Error("This container already has a live component root")
  const document = container.ownerDocument!
  let mountedScope: Scope | null = null
  let active = true

  const root: Root = {
    render(children) {
      if (!active) throw new Error("Cannot render through an unmounted component root")
      document.transaction(() => {
        if (mountedScope) disposeScope(mountedScope)
        clearContainer(container)
        const nextScope = createScope(document, null)
        try {
          const nodes = withScope(nextScope, () => materialize(children, nextScope))
          for (const node of nodes) container.appendChild(node)
          mountedScope = nextScope
        } catch (error) {
          disposeScope(nextScope)
          clearContainer(container)
          throw error
        }
      })
    },

    unmount() {
      if (!active) return
      document.transaction(() => {
        if (mountedScope) disposeScope(mountedScope)
        mountedScope = null
        clearContainer(container)
      })
      active = false
      roots.delete(container)
    },
  }

  roots.set(container, root)
  return root
}

function materialize(value: Renderable | DynamicValue, scope: Scope): Node[] {
  if (value === null || value === undefined || typeof value === "boolean") return []
  if (value instanceof Node) {
    if (value.ownerDocument !== scope.document) {
      throw new TypeError("JSX cannot insert a Node from another semantic Document")
    }
    return [value]
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return [scope.document.createTextNode(String(value))]
  }
  if (Array.isArray(value)) {
    return value.flatMap(child => materialize(child, scope))
  }
  if (isDynamic(value)) return [materializeDynamicText(value, scope)]
  if (!isJsxElement(value)) {
    throw new TypeError("Unsupported JSX child; expected a semantic Node, primitive, or component")
  }
  if (value.type === fragmentType) {
    return materialize(value.props.children as Renderable, scope)
  }
  if (typeof value.type === "function") return materializeComponent(value, scope)
  return [materializeIntrinsic(value, scope)]
}

function materializeComponent(descriptor: JsxElement, parentScope: Scope): Node[] {
  const componentScope = createScope(parentScope.document, parentScope)
  try {
    return withScope(componentScope, () => {
      const output = (descriptor.type as FunctionComponent<any>)(descriptor.props)
      return materialize(output, componentScope)
    })
  } catch (error) {
    disposeScope(componentScope)
    throw error
  }
}

function materializeIntrinsic(descriptor: JsxElement, scope: Scope): Element {
  const element = scope.document.createElement(descriptor.type as string)
  for (const [name, value] of Object.entries(descriptor.props)) {
    if (name === "children" || name === "ref") continue
    if (isDynamic(value)) {
      if (eventDescriptor(name)) {
        throw new TypeError(`Dynamic event property ${name} is not supported`)
      }
      createComputation(scope, () => applyProperty(element, name, value.read(), scope))
    } else {
      applyProperty(element, name, value, scope)
    }
  }
  const children = materialize(descriptor.props.children as Renderable, scope)
  for (const child of children) element.appendChild(child)
  const ref = descriptor.props.ref
  if (ref !== null && ref !== undefined) {
    if (typeof ref !== "function") throw new TypeError("ref must be a callback, null, or undefined")
    ref(element)
    scope.cleanups.add(() => ref(null))
  }
  return element
}

function materializeDynamicText(binding: DynamicValue, scope: Scope): Node {
  const text = scope.document.createTextNode("")
  createComputation(scope, () => {
    const value = binding.read()
    if (
      value !== null && value !== undefined && typeof value !== "boolean" &&
      typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint"
    ) {
      throw new TypeError("A dynamic JSX child must resolve to a primitive value")
    }
    const next = value === null || value === undefined || typeof value === "boolean"
      ? ""
      : String(value)
    if (text.data !== next) text.data = next
  })
  return text
}

function applyProperty(element: Element, name: string, value: unknown, scope: Scope): void {
  if (name === "dangerouslySetInnerHTML") {
    throw new TypeError("dangerouslySetInnerHTML is not supported by @zavx0z/dom-components")
  }
  const event = eventDescriptor(name)
  if (event) {
    if (typeof value !== "function") {
      throw new TypeError(`${name} must be a function`)
    }
    const handler = value as (event: Event) => unknown
    const listener: EventListener = dispatched => {
      scope.document.transaction(() => batch(() => handler(dispatched)))
    }
    element.addEventListener(event.type, listener, {capture: event.capture})
    scope.cleanups.add(() => element.removeEventListener(event.type, listener, {capture: event.capture}))
    return
  }
  if (name === "style") {
    const serialized = serializeStyle(value)
    if (serialized === null) element.removeAttribute("style")
    else element.setAttribute("style", serialized)
    return
  }
  if (name === "className") {
    setAttribute(element, "class", value)
    return
  }
  if (name === "tabIndex") {
    if (value === null || value === undefined || value === false) element.removeAttribute("tabindex")
    else if (element instanceof HTMLElement) element.tabIndex = Number(value)
    else element.setAttribute("tabindex", String(value))
    return
  }
  if (name === "checked" && element instanceof HTMLInputElement) {
    element.checked = Boolean(value)
    return
  }
  if (name === "value" && element instanceof HTMLInputElement) {
    element.value = value === null || value === undefined ? "" : String(value)
    return
  }
  if (value !== null && value !== undefined && typeof value === "object") {
    throw new TypeError(`Unsupported object property ${name}`)
  }
  if (typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`Unsupported property ${name}`)
  }
  setAttribute(element, name, value)
}

function setAttribute(element: Element, name: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    element.removeAttribute(name)
  } else if (value === true) {
    element.setAttribute(name, "")
  } else {
    element.setAttribute(name, String(value))
  }
}

function serializeStyle(value: unknown): string | null {
  if (value === null || value === undefined || value === false) return null
  if (typeof value === "string") return value
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("style must be a string, object, null, or undefined")
  }
  const declarations: string[] = []
  for (const [sourceName, sourceValue] of Object.entries(value)) {
    if (sourceValue === null || sourceValue === undefined || sourceValue === "") continue
    if (typeof sourceValue !== "string" && typeof sourceValue !== "number") {
      throw new TypeError(`Unsupported style value for ${sourceName}`)
    }
    const property = sourceName.startsWith("--")
      ? sourceName
      : sourceName.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`)
    const unitless = property === "opacity" || property === "z-index" ||
      property === "line-height" || property === "flex-grow" || property === "flex-shrink"
    const serialized = typeof sourceValue === "number" && sourceValue !== 0 && !unitless
      ? `${sourceValue}px`
      : String(sourceValue)
    declarations.push(`${property}: ${serialized}`)
  }
  return declarations.length === 0 ? null : declarations.join("; ")
}

function eventDescriptor(name: string): Readonly<{capture: boolean; type: string}> | null {
  if (!name.startsWith("on") || name.length <= 2) return null
  const capture = name.endsWith("Capture")
  const eventName = name.slice(2, capture ? -"Capture".length : undefined).toLowerCase()
  if (eventName === "click" || eventName === "input" || eventName === "focus" || eventName === "blur") {
    return {capture, type: eventName}
  }
  return eventName.startsWith("pointer") && eventName.length > "pointer".length
    ? {capture, type: eventName}
    : null
}

function createComputation(scope: Scope, callback: () => void): Computation {
  const computation: Computation = {
    active: true,
    dependencies: new Set(),
    run() {
      if (!computation.active) return
      for (const dependency of computation.dependencies) dependency.subscribers.delete(computation)
      computation.dependencies.clear()
      const previous = currentComputation
      currentComputation = computation
      try {
        callback()
      } finally {
        currentComputation = previous
      }
    },
  }
  scope.cleanups.add(() => {
    computation.active = false
    pendingComputations.delete(computation)
    for (const dependency of computation.dependencies) dependency.subscribers.delete(computation)
    computation.dependencies.clear()
  })
  computation.run()
  return computation
}

function schedule(computation: Computation): void {
  if (!computation.active) return
  pendingComputations.add(computation)
  if (batchDepth === 0) flushComputations()
}

function flushComputations(): void {
  if (flushing) return
  flushing = true
  try {
    while (pendingComputations.size > 0) {
      const next = [...pendingComputations]
      pendingComputations.clear()
      for (const computation of next) computation.run()
    }
  } finally {
    flushing = false
  }
}

function createScope(document: Document, parent: Scope | null): Scope {
  const scope: Scope = {
    active: true,
    children: new Set(),
    cleanups: new Set(),
    document,
    parent,
  }
  parent?.children.add(scope)
  return scope
}

function disposeScope(scope: Scope): void {
  if (!scope.active) return
  scope.active = false
  for (const child of [...scope.children]) disposeScope(child)
  scope.children.clear()
  for (const cleanup of [...scope.cleanups].reverse()) cleanup()
  scope.cleanups.clear()
  scope.parent?.children.delete(scope)
}

function withScope<Result>(scope: Scope, callback: () => Result): Result {
  const previous = currentScope
  currentScope = scope
  try {
    return callback()
  } finally {
    currentScope = previous
  }
}

function requireCurrentScope(api: string): Scope {
  if (!currentScope || !currentScope.active) {
    throw new Error(`${api} must be called while mounting a function component`)
  }
  return currentScope
}

function clearContainer(container: RootContainer): void {
  while (container.firstChild) container.removeChild(container.firstChild)
}

function assertRootContainer(container: RootContainer): void {
  if (!(container instanceof Element) && !(container instanceof DocumentFragment)) {
    throw new TypeError("createRoot expects an @zavx0z/dom Element or DocumentFragment")
  }
  if (!container.ownerDocument) throw new TypeError("The root container must have an ownerDocument")
}

function isJsxElement(value: unknown): value is JsxElement {
  return !!value && typeof value === "object" &&
    (value as Partial<JsxElement>)[descriptorBrand] === true
}

function isDynamic(value: unknown): value is DynamicValue {
  return !!value && typeof value === "object" &&
    (value as Partial<DynamicValue>)[dynamicBrand] === true
}
