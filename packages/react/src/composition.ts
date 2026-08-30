import type {Event, Node} from "@zavx0z/dom"
import {
  defineCompiledTemplate,
  isCompiledTemplate,
  type CompiledTemplate
} from "@zavx0z/template/compiled"
import type {JsxSourceElement} from "@zavx0z/template/jsx-runtime"
import type {CompiledStyleValue} from "./style.ts"

const componentValueBrand = Symbol("@zavx0z/react/component-value")
const keyedValueBrand = Symbol("@zavx0z/react/keyed-value")
const contextBrand = Symbol("@zavx0z/react/context")
const contextConsumerBrand = Symbol("@zavx0z/react/context-consumer")
const memoComparators = new WeakMap<CompiledTemplate<unknown>, MemoComparator<unknown>>()
const emptyContextProvisions = Object.freeze([]) as readonly ContextProvision[]

export type ComponentKey = string | number | null
export type MemoComparator<Props> = (
  previous: Readonly<Props>,
  next: Readonly<Props>
) => boolean
export type FunctionComponent<Props = Record<string, never>> = (
  props: Readonly<Props>
) => JsxSourceElement
export type FC<Props = Record<string, never>> = FunctionComponent<Props>

export interface Context<Value> {
  readonly Consumer: ContextConsumer<Value>
  readonly Provider: Context<Value>
  readonly [contextBrand]: true
}

export interface ContextConsumer<Value> {
  readonly [contextConsumerBrand]: true
  readonly context: Context<Value>
}

export type ContextProvision<Value = unknown> = Readonly<{
  context: Context<Value>
  value: Value
}>

export type ComponentValue<Props = any> = Readonly<{
  [componentValueBrand]: true
  contexts: readonly ContextProvision[]
  key: ComponentKey
  props: Readonly<Props>
  template: CompiledTemplate<Props>
}>

export type KeyedComponentsValue = Readonly<{
  [keyedValueBrand]: true
  entries: readonly ComponentValue<any>[]
}>

export type CallbackRef<Target extends Node = Node> = (
  target: Target | null
) => void | (() => void)

export type EventHandler = (event: Event) => unknown
export type StyleBindingValue = CompiledStyleValue

export function createContext<Value>(defaultValue: Value): Context<Value> {
  const context = {
    [contextBrand]: true as const
  } as Context<Value>
  const consumer = Object.freeze({
    [contextConsumerBrand]: true as const,
    context
  })
  Object.defineProperties(context, {
    Consumer: {enumerable: true, value: consumer},
    Provider: {enumerable: true, value: context},
    defaultValue: {value: defaultValue}
  })
  return Object.freeze(context)
}

export function memo<Props>(
  component: FunctionComponent<Props>,
  comparator?: MemoComparator<Props>
): FunctionComponent<Props>
export function memo<Props>(
  component: CompiledTemplate<Props>,
  comparator?: MemoComparator<Props>
): CompiledTemplate<Props>
export function memo<Props>(
  template: CompiledTemplate<Props> | FunctionComponent<Props>,
  comparator: MemoComparator<Props> = shallowEqualProps
): CompiledTemplate<Props> | FunctionComponent<Props> {
  if (!isCompiledTemplate(template)) {
    throw new TypeError(
      "JSX component reached memo at runtime; enable @zavx0z/template/compiler",
    )
  }
  if (typeof comparator !== "function") throw new TypeError("memo comparator must be a function")
  const wrapped = defineCompiledTemplate<Props>({
    bindingCount: template.bindingCount,
    displayName: `Memo(${template.displayName})`,
    styleSheets: template.styleSheets,
    mount: template.mount,
    render: template.render
  })
  memoComparators.set(
    wrapped as CompiledTemplate<unknown>,
    comparator as MemoComparator<unknown>,
  )
  return wrapped
}

export function component<Props>(
  template: CompiledTemplate<Props>,
  props: Readonly<Props>,
  key: ComponentKey = null
): ComponentValue<Props> {
  if (!isCompiledTemplate(template)) throw new TypeError("component expects a compiled template")
  return Object.freeze({
    [componentValueBrand]: true as const,
    contexts: emptyContextProvisions,
    key: componentKey(key),
    props,
    template
  })
}

export function provideContext<Value, Props>(
  context: Context<Value>,
  value: Value,
  child: ComponentValue<Props>
): ComponentValue<Props> {
  if (!isContext(context)) throw new TypeError("provideContext expects a createContext result")
  if (!isComponentValue(child)) throw new TypeError("provideContext expects a compiled component value")
  const provision = Object.freeze({context, value}) as ContextProvision
  return Object.freeze({
    [componentValueBrand]: true as const,
    contexts: Object.freeze([provision, ...child.contexts]),
    key: child.key,
    props: child.props,
    template: child.template
  })
}

export function when<Props>(
  condition: unknown,
  template: CompiledTemplate<Props>,
  props: Readonly<Props>,
  key: ComponentKey = null
): ComponentValue<Props> | null {
  return condition ? component(template, props, key) : null
}

export function keyedComponents(entries: readonly ComponentValue<any>[]): KeyedComponentsValue {
  if (!Array.isArray(entries) || entries.some(entry => !isComponentValue(entry))) {
    throw new TypeError("keyedComponents expects compiled component values")
  }
  return Object.freeze({[keyedValueBrand]: true as const, entries})
}

export function isComponentValue(value: unknown): value is ComponentValue<any> {
  return !!value && typeof value === "object" &&
    (value as Partial<ComponentValue>)[componentValueBrand] === true
}

export function isContext(value: unknown): value is Context<unknown> {
  return !!value && typeof value === "object" &&
    (value as Partial<Context<unknown>>)[contextBrand] === true
}

export function contextDefaultValue<Value>(context: Context<Value>): Value {
  if (!isContext(context)) throw new TypeError("Expected a createContext result")
  return (context as Context<Value> & {readonly defaultValue: Value}).defaultValue
}

export function isKeyedComponentsValue(value: unknown): value is KeyedComponentsValue {
  return !!value && typeof value === "object" &&
    (value as Partial<KeyedComponentsValue>)[keyedValueBrand] === true
}

export function memoPropsEqual<Props>(
  template: CompiledTemplate<Props>,
  previous: Readonly<Props>,
  next: Readonly<Props>
): boolean {
  const comparator = memoComparators.get(template as CompiledTemplate<unknown>)
  return comparator
    ? Boolean(comparator(previous as Readonly<unknown>, next as Readonly<unknown>))
    : false
}

function componentKey(key: ComponentKey): ComponentKey {
  if (key === null || typeof key === "string" || typeof key === "number") return key
  throw new TypeError("A component key must be a string, number, or null")
}

function shallowEqualProps(previous: unknown, next: unknown): boolean {
  if (Object.is(previous, next)) return true
  if (!previous || !next || typeof previous !== "object" || typeof next !== "object") return false
  const previousRecord = previous as Record<string, unknown>
  const nextRecord = next as Record<string, unknown>
  const previousKeys = Object.keys(previousRecord)
  const nextKeys = Object.keys(nextRecord)
  if (previousKeys.length !== nextKeys.length) return false
  for (const key of previousKeys) {
    if (!Object.prototype.hasOwnProperty.call(nextRecord, key)) return false
    if (!Object.is(previousRecord[key], nextRecord[key])) return false
  }
  return true
}
