import type {Element} from "./element.ts"
import {domError} from "./internal/errors.ts"
import type {Node} from "./node.ts"
import {createStaticNodeList} from "./node-list.ts"
import type {NodeList} from "./node-list.ts"

type AttributeSelector = Readonly<{
  name: string
  value?: string
}>

type CompoundSelector = Readonly<{
  tag: string | null
  id: string | null
  classes: readonly string[]
  attributes: readonly AttributeSelector[]
}>

type ParsedSelector = readonly CompoundSelector[]

type CompoundResult = Readonly<{
  compound: CompoundSelector
  cursor: number
}>

const asciiWhitespace = /[\t\n\f\r ]/
const identifierStart = /[A-Za-z_]/
const identifierCharacter = /[A-Za-z0-9_-]/
const tagStart = /[A-Za-z]/

function syntaxError(source: string, cursor: number): Error {
  return domError("SyntaxError", `Unsupported selector syntax at ${cursor} in ${JSON.stringify(source)}`)
}

function skipWhitespace(source: string, start: number): number {
  let cursor = start
  while (cursor < source.length && asciiWhitespace.test(source[cursor]!)) cursor += 1
  return cursor
}

function readIdentifier(
  source: string,
  start: number,
  startPattern = identifierStart
): Readonly<{cursor: number; value: string}> | null {
  if (start >= source.length || !startPattern.test(source[start]!)) return null
  let cursor = start + 1
  while (cursor < source.length && identifierCharacter.test(source[cursor]!)) cursor += 1
  return {cursor, value: source.slice(start, cursor)}
}

function readAttribute(source: string, start: number): Readonly<{
  attribute: AttributeSelector
  cursor: number
}> {
  let cursor = skipWhitespace(source, start + 1)
  const name = readIdentifier(source, cursor)
  if (!name) throw syntaxError(source, cursor)
  cursor = skipWhitespace(source, name.cursor)
  if (source[cursor] === "]") {
    return {
      attribute: Object.freeze({name: name.value.toLowerCase()}),
      cursor: cursor + 1
    }
  }
  if (source[cursor] !== "=") throw syntaxError(source, cursor)
  cursor = skipWhitespace(source, cursor + 1)
  if (cursor >= source.length) throw syntaxError(source, cursor)

  let value = ""
  const quote = source[cursor] === "\"" || source[cursor] === "'" ? source[cursor] : null
  if (quote) {
    cursor += 1
    const valueStart = cursor
    while (cursor < source.length && source[cursor] !== quote) {
      if (source[cursor] === "\\" || /[\n\f\r]/.test(source[cursor]!)) {
        throw syntaxError(source, cursor)
      }
      cursor += 1
    }
    if (source[cursor] !== quote) throw syntaxError(source, cursor)
    value = source.slice(valueStart, cursor)
    cursor += 1
  } else {
    const valueStart = cursor
    while (cursor < source.length && /[A-Za-z0-9_-]/.test(source[cursor]!)) cursor += 1
    if (cursor === valueStart) throw syntaxError(source, cursor)
    value = source.slice(valueStart, cursor)
  }

  cursor = skipWhitespace(source, cursor)
  if (source[cursor] !== "]") throw syntaxError(source, cursor)
  return {
    attribute: Object.freeze({name: name.value.toLowerCase(), value}),
    cursor: cursor + 1
  }
}

function readCompound(source: string, start: number): CompoundResult {
  let cursor = start
  let tag: string | null = null
  let id: string | null = null
  const classes: string[] = []
  const attributes: AttributeSelector[] = []

  if (source[cursor] === "*") {
    tag = "*"
    cursor += 1
  } else {
    const tagName = readIdentifier(source, cursor, tagStart)
    if (tagName) {
      tag = tagName.value.toLowerCase()
      cursor = tagName.cursor
    }
  }

  while (cursor < source.length && !asciiWhitespace.test(source[cursor]!)) {
    const marker = source[cursor]
    if (marker === "#" || marker === ".") {
      const identifier = readIdentifier(source, cursor + 1)
      if (!identifier) throw syntaxError(source, cursor)
      if (marker === "#") {
        if (id !== null) throw syntaxError(source, cursor)
        id = identifier.value
      } else {
        classes.push(identifier.value)
      }
      cursor = identifier.cursor
      continue
    }
    if (marker === "[") {
      const result = readAttribute(source, cursor)
      attributes.push(result.attribute)
      cursor = result.cursor
      continue
    }
    throw syntaxError(source, cursor)
  }

  if (tag === null && id === null && classes.length === 0 && attributes.length === 0) {
    throw syntaxError(source, cursor)
  }
  return {
    compound: Object.freeze({
      tag,
      id,
      classes: Object.freeze(classes),
      attributes: Object.freeze(attributes)
    }),
    cursor
  }
}

function parseSelector(selectors: string): ParsedSelector {
  const source = String(selectors)
  let cursor = skipWhitespace(source, 0)
  if (cursor === source.length) throw syntaxError(source, cursor)
  const compounds: CompoundSelector[] = []

  while (cursor < source.length) {
    const result = readCompound(source, cursor)
    compounds.push(result.compound)
    if (result.cursor === source.length) break
    const next = skipWhitespace(source, result.cursor)
    if (next === result.cursor || next === source.length) throw syntaxError(source, result.cursor)
    cursor = next
  }
  return Object.freeze(compounds)
}

function matchesCompound(element: Element, compound: CompoundSelector): boolean {
  if (compound.tag && compound.tag !== "*" && element.localName !== compound.tag) return false
  if (compound.id !== null && element.getAttribute("id") !== compound.id) return false
  const classNames = new Set((element.getAttribute("class") ?? "").split(/[\t\n\f\r ]+/).filter(Boolean))
  for (const className of compound.classes) {
    if (!classNames.has(className)) return false
  }
  for (const attribute of compound.attributes) {
    if (!element.hasAttribute(attribute.name)) return false
    if (attribute.value !== undefined && element.getAttribute(attribute.name) !== attribute.value) return false
  }
  return true
}

function matchesParsed(element: Element, selector: ParsedSelector): boolean {
  let current: Element | null = element
  for (let index = selector.length - 1; index >= 0; index -= 1) {
    const compound = selector[index]!
    if (index === selector.length - 1) {
      if (!current || !matchesCompound(current, compound)) return false
      current = current.parentElement
      continue
    }
    while (current && !matchesCompound(current, compound)) current = current.parentElement
    if (!current) return false
    current = current.parentElement
  }
  return true
}

function descendants(root: Node): Element[] {
  const elements: Element[] = []
  const visit = (node: Node): void => {
    for (const child of node.childNodes) {
      if (child.nodeType === 1) elements.push(child as Element)
      visit(child)
    }
  }
  visit(root)
  return elements
}

export function matchesSelector(element: Element, selectors: string): boolean {
  return matchesParsed(element, parseSelector(selectors))
}

export function closestMatch(element: Element, selectors: string): Element | null {
  const selector = parseSelector(selectors)
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (matchesParsed(current, selector)) return current
  }
  return null
}

export function queryFirst(root: Node, selectors: string): Element | null {
  const selector = parseSelector(selectors)
  for (const element of descendants(root)) {
    if (matchesParsed(element, selector)) return element
  }
  return null
}

export function queryAll(root: Node, selectors: string): NodeList<Element> {
  const selector = parseSelector(selectors)
  return createStaticNodeList(descendants(root).filter(element => matchesParsed(element, selector)))
}

export function findElementById(root: Node, elementId: string): Element | null {
  const id = String(elementId)
  if (id === "") return null
  for (const element of descendants(root)) {
    if (element.getAttribute("id") === id) return element
  }
  return null
}
