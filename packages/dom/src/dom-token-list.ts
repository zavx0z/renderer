import type {Element} from "./element.ts"
import {domError} from "./internal/errors.ts"
import {toLong} from "./internal/web-idl.ts"

const constructionKey = Symbol("DOMTokenList construction")
const tokenLists = new WeakMap<Element, DOMTokenList>()
const associatedElements = new WeakMap<DOMTokenList, Element>()
const asciiWhitespace = /[\t\n\f\r ]/
const asciiWhitespaceRuns = /[\t\n\f\r ]+/
const arrayIndex = /^(0|[1-9]\d*)$/

function parseTokens(value: string): string[] {
  const ordered = new Set(value.split(asciiWhitespaceRuns).filter(Boolean))
  return [...ordered]
}

function validateToken(value: string): string {
  const token = String(value)
  if (token === "") throw domError("SyntaxError", "The token must not be empty")
  if (asciiWhitespace.test(token)) {
    throw domError("InvalidCharacterError", "The token must not contain ASCII whitespace")
  }
  return token
}

function validateTokens(values: readonly string[]): string[] {
  return values.map(validateToken)
}

export class DOMTokenList implements Iterable<string> {
  readonly [index: number]: string

  constructor(element?: Element, key?: symbol) {
    if (key !== constructionKey || !element) throw new TypeError("Illegal constructor")
    associatedElements.set(this, element)
  }

  get length(): number {
    return this.tokens().length
  }

  get value(): string {
    return this.element().getAttribute("class") ?? ""
  }

  set value(value: string) {
    this.element().setAttribute("class", String(value))
  }

  item(index: number): string | null {
    return this.tokens()[toLong(Number(index), 32, true)] ?? null
  }

  contains(token: string): boolean {
    return this.tokens().includes(validateToken(token))
  }

  add(...tokens: string[]): void {
    const additions = validateTokens(tokens)
    const current = this.tokens()
    let changed = false
    for (const token of additions) {
      if (current.includes(token)) continue
      current.push(token)
      changed = true
    }
    if (changed) this.write(current)
  }

  remove(...tokens: string[]): void {
    const removals = new Set(validateTokens(tokens))
    const current = this.tokens()
    const next = current.filter(token => !removals.has(token))
    if (next.length !== current.length) this.write(next)
  }

  toggle(token: string, force?: boolean): boolean {
    const normalized = validateToken(token)
    const current = this.tokens()
    const index = current.indexOf(normalized)
    if (index >= 0) {
      if (force === true) return true
      current.splice(index, 1)
      this.write(current)
      return false
    }
    if (force === false) return false
    current.push(normalized)
    this.write(current)
    return true
  }

  replace(token: string, newToken: string): boolean {
    const [normalized, replacement] = validateTokens([token, newToken])
    const current = this.tokens()
    const index = current.indexOf(normalized!)
    if (index < 0) return false
    if (normalized === replacement) return true
    const replacementIndex = current.indexOf(replacement!)
    if (replacementIndex >= 0) current.splice(index, 1)
    else current[index] = replacement!
    this.write(current)
    return true
  }

  supports(_token: string): boolean {
    throw new TypeError("classList has no supported-token registry")
  }

  entries(): ArrayIterator<[number, string]> {
    return this.tokens().entries()
  }

  forEach(
    callback: (value: string, key: number, parent: DOMTokenList) => void,
    thisArg?: unknown
  ): void {
    const tokens = this.tokens()
    for (let index = 0; index < tokens.length; index += 1) {
      callback.call(thisArg, tokens[index]!, index, this)
    }
  }

  keys(): ArrayIterator<number> {
    return this.tokens().keys()
  }

  values(): ArrayIterator<string> {
    return this.tokens().values()
  }

  [Symbol.iterator](): ArrayIterator<string> {
    return this.values()
  }

  toString(): string {
    return this.value
  }

  private tokens(): string[] {
    return parseTokens(this.value)
  }

  private write(tokens: readonly string[]): void {
    this.element().setAttribute("class", tokens.join(" "))
  }

  private element(): Element {
    const element = associatedElements.get(this)
    if (!element) throw new TypeError("Illegal invocation")
    return element
  }
}

function indexedProperty(property: PropertyKey): number | null {
  if (typeof property !== "string" || !arrayIndex.test(property)) return null
  const index = Number(property)
  return Number.isSafeInteger(index) && index <= 0xffffffff ? index : null
}

export function getClassList(element: Element): DOMTokenList {
  const current = tokenLists.get(element)
  if (current) return current
  const target = new DOMTokenList(element, constructionKey)
  const list = new Proxy(target, {
    get(instance, property, receiver) {
      const index = indexedProperty(property)
      if (index !== null) return instance.item(index) ?? undefined
      return Reflect.get(instance, property, receiver)
    },
    getOwnPropertyDescriptor(instance, property) {
      const index = indexedProperty(property)
      if (index !== null) {
        const value = instance.item(index)
        return value === null ? undefined : {
          configurable: true,
          enumerable: true,
          value,
          writable: false
        }
      }
      return Reflect.getOwnPropertyDescriptor(instance, property)
    },
    has(instance, property) {
      const index = indexedProperty(property)
      if (index !== null) return instance.item(index) !== null
      return Reflect.has(instance, property)
    },
    ownKeys(instance) {
      const indices = Array.from({length: instance.length}, (_, index) => String(index))
      return [...Reflect.ownKeys(instance), ...indices]
    }
  })
  associatedElements.set(list, element)
  tokenLists.set(element, list)
  return list
}
