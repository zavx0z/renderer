import type { Element, Node } from "@zavx0z/dom"
import type {DocumentInteractionState} from "./pseudo-state.ts"
import type {
  RenderAlignContent,
  RenderAlignItems,
  RenderBorderColors,
  RenderBorderWidths,
  RenderBoxSizing,
  RenderDisplay,
  RenderEdges,
  RenderFlexDirection,
  RenderFlexWrap,
  RenderJustifyContent,
  RenderMargin,
  RenderObjectFit,
  RenderOverflow,
  RenderPadding,
  RenderPosition,
  RenderTextAlign,
  RenderWhiteSpace,
  RenderZIndex,
} from "./types.ts"

export type CSSLength =
  | Readonly<{ unit: "px"; value: number }>
  | Readonly<{ unit: "percent"; value: number }>

export type ComputedCornerRadii = Readonly<{
  topLeft: CSSLength | null
  topRight: CSSLength | null
  bottomRight: CSSLength | null
  bottomLeft: CSSLength | null
}>

export type ComputedScrollbarWidth = "auto" | "thin" | "none"

export type ComputedTransformFunction =
  | Readonly<{kind: "translate"; x: CSSLength; y: CSSLength}>
  | Readonly<{kind: "scale"; x: number; y: number}>

export type ComputedTransformOrigin = Readonly<{
  x: CSSLength
  y: CSSLength
}>

export type ComputedBoxShadow = Readonly<{
  offsetX: number
  offsetY: number
  blurRadius: number
  spreadRadius: number
  color: string
}>

export type ComputedLineHeight =
  | "normal"
  | Readonly<{kind: "number" | "length"; value: number}>

export type ComputedCustomProperties = Readonly<{
  parent: ComputedCustomProperties | null
  own: Readonly<Record<string, string>>
}>

export const EMPTY_CUSTOM_PROPERTIES: ComputedCustomProperties = Object.freeze({
  parent: null,
  own: Object.freeze(Object.create(null) as Record<string, string>),
})

export type ComputedTextOverflow = "clip" | "ellipsis"

export type ComputedStyle = Readonly<{
  customProperties: ComputedCustomProperties
  display: RenderDisplay
  boxSizing: RenderBoxSizing
  flexDirection: RenderFlexDirection
  flexWrap: RenderFlexWrap
  flexGrow: number
  flexShrink: number
  flexBasis: CSSLength | null
  alignContent: RenderAlignContent
  alignItems: RenderAlignItems
  justifyContent: RenderJustifyContent
  width: CSSLength | null
  height: CSSLength | null
  minWidth: CSSLength | null
  minHeight: CSSLength | null
  maxWidth: CSSLength | null
  maxHeight: CSSLength | null
  position: RenderPosition
  left: CSSLength | null
  top: CSSLength | null
  right: CSSLength | null
  bottom: CSSLength | null
  transform: readonly ComputedTransformFunction[]
  transformOrigin: ComputedTransformOrigin
  boxShadow: ComputedBoxShadow | null
  rowGap: number
  columnGap: number
  margin: RenderMargin
  padding: RenderPadding
  borderWidths: RenderBorderWidths
  borderColors: RenderBorderColors
  borderRadii: ComputedCornerRadii
  background: string | null
  color: string
  fontSize: number
  lineHeight: ComputedLineHeight
  letterSpacing: number
  opacity: number
  overflowX: RenderOverflow
  overflowY: RenderOverflow
  scrollbarWidth: ComputedScrollbarWidth
  objectFit: RenderObjectFit
  textAlign: RenderTextAlign
  textOverflow: ComputedTextOverflow
  whiteSpace: RenderWhiteSpace
  zIndex: RenderZIndex
}>

type DeclarationEntry = readonly [property: string, value: string]
type DeclarationMap =
  | Readonly<Record<string, string>>
  | readonly DeclarationEntry[]

type AttributeSelector = Readonly<{
  name: string
  value?: string
}>

type SupportedPseudoClass =
  | "active"
  | "checked"
  | "disabled"
  | "focus"
  | "focus-within"
  | "hover"
  | "indeterminate"
  | "root"

type SelectorCombinator = "child" | "descendant"

type CompoundSelector = Readonly<{
  tag: string | null
  id: string | null
  classes: readonly string[]
  attributes: readonly AttributeSelector[]
  pseudos: readonly SupportedPseudoClass[]
}>

type ParsedSelector = Readonly<{
  compounds: readonly CompoundSelector[]
  combinators: readonly SelectorCombinator[]
  specificity: readonly [number, number, number]
}>

export type StyleRule = Readonly<{
  selector: ParsedSelector
  declarations: DeclarationMap
  order: number
}>

export type StyleRuleIndex = Readonly<{
  universal: readonly StyleRule[]
  byAttribute: ReadonlyMap<string, readonly StyleRule[]>
  byClass: ReadonlyMap<string, readonly StyleRule[]>
  byId: ReadonlyMap<string, readonly StyleRule[]>
  byTag: ReadonlyMap<string, readonly StyleRule[]>
}>

type CascadedValue = Readonly<{
  specificity: readonly [number, number, number]
  order: number
  sequence: number
  value: string
}>

type CascadeSequence = { value: number }

const ZERO_EDGES: RenderEdges = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
})

const BUTTON_PADDING: RenderPadding = Object.freeze({
  top: 2,
  right: 6,
  bottom: 2,
  left: 6,
})

const ZERO_RADII: ComputedCornerRadii = Object.freeze({
  topLeft: null,
  topRight: null,
  bottomRight: null,
  bottomLeft: null,
})

const CENTER_PERCENT: CSSLength = Object.freeze({unit: "percent", value: 50})
const CENTER_ORIGIN: ComputedTransformOrigin = Object.freeze({
  x: CENTER_PERCENT,
  y: CENTER_PERCENT,
})

const customPropertyNamePattern = /^--(?:[A-Za-z_]|[^\x00-\x7f])(?:[A-Za-z0-9_-]|[^\x00-\x7f])*$/
const deferredVariablePropertySet: ReadonlySet<string> = new Set([
  "align-content",
  "row-gap",
  "column-gap",
  "flex-wrap",
  "scrollbar-width",
  "text-align",
  "line-height",
  "letter-spacing",
  "white-space",
  "text-overflow",
  "object-fit",
  "position",
  "left",
  "top",
  "right",
  "bottom",
  "transform",
  "transform-origin",
  "box-shadow",
  "z-index",
])
const deferredVariableShorthandSet: ReadonlySet<string> = new Set([
  "border",
  "border-color",
  "gap",
])
const unsupportedVariableShorthandSet: ReadonlySet<string> = new Set([
  "flex",
  "overflow",
  "margin",
  "margin-inline",
  "margin-block",
  "padding",
  "padding-inline",
  "padding-block",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-width",
  "border-style",
  "border-radius",
])

type VariableResolution =
  | Readonly<{valid: true; value: string}>
  | Readonly<{valid: false}>

const INVALID_VARIABLE: VariableResolution = Object.freeze({valid: false})
const variableResolutionCache = new WeakMap<
  ComputedCustomProperties,
  Map<string, VariableResolution>
>()

export const parseStyleSheets = (
  styleSheets: readonly string[],
): StyleRuleIndex => {
  const rules: StyleRule[] = []
  let order = 0
  for (const styleSheet of styleSheets) {
    const source = styleSheet.replace(/\/\*[\s\S]*?\*\//g, "")
    const rulePattern = /([^{}]+)\{([^{}]*)\}/g
    let match: RegExpExecArray | null
    while ((match = rulePattern.exec(source))) {
      const selectorSource = match[1]
      const declarationSource = match[2]
      if (!selectorSource || declarationSource == null) continue
      const declarations = parseDeclarations(declarationSource)
      const selectors = selectorSource
        .split(",")
        .map((part) => parseSelector(part.trim()))
      if (selectors.some((selector) => selector === null)) continue
      for (const selector of selectors) {
        if (selector === null) continue
        rules.push(Object.freeze({ selector, declarations, order: order++ }))
      }
    }
  }
  return indexStyleRules(rules)
}

const indexStyleRules = (rules: readonly StyleRule[]): StyleRuleIndex => {
  const universal: StyleRule[] = []
  const byAttribute = new Map<string, StyleRule[]>()
  const byClass = new Map<string, StyleRule[]>()
  const byId = new Map<string, StyleRule[]>()
  const byTag = new Map<string, StyleRule[]>()

  for (const rule of rules) {
    const compound = rule.selector.compounds.at(-1)!
    if (compound.id !== null) appendIndexedRule(byId, compound.id, rule)
    else if (compound.classes[0] !== undefined) {
      appendIndexedRule(byClass, compound.classes[0], rule)
    } else if (compound.attributes[0] !== undefined) {
      appendIndexedRule(byAttribute, compound.attributes[0].name, rule)
    } else if (compound.tag !== null && compound.tag !== "*") {
      appendIndexedRule(byTag, compound.tag, rule)
    } else universal.push(rule)
  }

  return Object.freeze({
    universal: Object.freeze(universal),
    byAttribute: freezeRuleIndex(byAttribute),
    byClass: freezeRuleIndex(byClass),
    byId: freezeRuleIndex(byId),
    byTag: freezeRuleIndex(byTag),
  })
}

const appendIndexedRule = (
  index: Map<string, StyleRule[]>,
  key: string,
  rule: StyleRule,
): void => {
  const rules = index.get(key)
  if (rules === undefined) index.set(key, [rule])
  else rules.push(rule)
}

const freezeRuleIndex = (
  source: ReadonlyMap<string, readonly StyleRule[]>,
): ReadonlyMap<string, readonly StyleRule[]> => {
  const result = new Map<string, readonly StyleRule[]>()
  for (const [key, rules] of source) result.set(key, Object.freeze([...rules]))
  return result
}

const forEachCandidateRule = (
  index: StyleRuleIndex,
  element: Element,
  callback: (rule: StyleRule) => void,
): void => {
  for (const rule of index.universal) callback(rule)
  for (const rule of index.byTag.get(elementTag(element)) ?? []) callback(rule)

  const id = element.getAttribute("id")
  if (id !== null) {
    for (const rule of index.byId.get(id) ?? []) callback(rule)
  }
  for (const className of classTokens(element.getAttribute("class") ?? "")) {
    for (const rule of index.byClass.get(className) ?? []) callback(rule)
  }
  for (const name of element.getAttributeNames()) {
    for (const rule of index.byAttribute.get(name) ?? []) callback(rule)
  }
}

export const computeStyle = (
  element: Element,
  parent: ComputedStyle | null,
  rules: StyleRuleIndex,
  interactionState?: DocumentInteractionState,
): ComputedStyle => {
  const tag = elementTag(element)
  let values = new Map<string, CascadedValue>()
  const customValues = new Map<string, CascadedValue>()
  const sequence: CascadeSequence = { value: 0 }

  applyDeclarations(
    values,
    customValues,
    uaDeclarations(tag, element),
    [0, 0, 0],
    -1_000_000,
    sequence,
  )

  forEachCandidateRule(rules, element, (rule) => {
    if (!matchesSelector(element, rule.selector, interactionState)) return
    applyDeclarations(
      values,
      customValues,
      rule.declarations,
      rule.selector.specificity,
      rule.order,
      sequence,
    )
  })

  const inline = readInlineStyle(element)
  if (inline)
    applyDeclarations(
      values,
      customValues,
      parseDeclarations(inline),
      [1_000_000, 0, 0],
      1_000_000,
      sequence,
    )

  const customProperties = createCustomPropertyEnvironment(parent, customValues)
  values = resolveCascadedVariables(values, customProperties)

  const inheritedColor = parent?.color ?? "#000000"
  const color = resolvedColor(readValue(values, "color"), inheritedColor)
  const backgroundValue =
    readValue(values, "background-color") ??
    readValue(values, "background")
  const background = backgroundValue === undefined
    ? null
    : resolvedColor(backgroundValue, color)
  const fontSize = parseFontSize(readValue(values, "font-size"), parent?.fontSize ?? 16)
  const defaultPadding = tag === "button" ? BUTTON_PADDING : ZERO_EDGES
  const overflow = normalizeOverflowAxes(
    parseOverflow(readValue(values, "overflow-x")),
    parseOverflow(readValue(values, "overflow-y")),
  )

  return Object.freeze({
    customProperties,
    display: element.hasAttribute("hidden")
      ? "none"
      : parseDisplay(readValue(values, "display"), tag),
    boxSizing: parseBoxSizing(readValue(values, "box-sizing")),
    flexDirection: parseFlexDirection(readValue(values, "flex-direction")),
    flexWrap: parseFlexWrap(readValue(values, "flex-wrap")),
    flexGrow: nonNegativeNumber(readValue(values, "flex-grow"), 0),
    flexShrink: nonNegativeNumber(readValue(values, "flex-shrink"), 1),
    flexBasis: parseLength(readValue(values, "flex-basis"), fontSize),
    alignContent: parseAlignContent(readValue(values, "align-content")),
    alignItems: parseAlignItems(readValue(values, "align-items")),
    justifyContent: parseJustifyContent(readValue(values, "justify-content")),
    width: parseLength(readValue(values, "width"), fontSize),
    height: parseLength(readValue(values, "height"), fontSize),
    minWidth: parseLength(readValue(values, "min-width"), fontSize),
    minHeight: parseLength(readValue(values, "min-height"), fontSize),
    maxWidth: parseLength(readValue(values, "max-width"), fontSize),
    maxHeight: parseLength(readValue(values, "max-height"), fontSize),
    position: parsePosition(readValue(values, "position")),
    left: parseLength(readValue(values, "left"), fontSize),
    top: parseLength(readValue(values, "top"), fontSize),
    right: parseLength(readValue(values, "right"), fontSize),
    bottom: parseLength(readValue(values, "bottom"), fontSize),
    transform: parseTransform(readValue(values, "transform")) ?? Object.freeze([]),
    transformOrigin: parseTransformOrigin(readValue(values, "transform-origin")) ?? CENTER_ORIGIN,
    boxShadow: parseBoxShadow(readValue(values, "box-shadow"), color) ?? null,
    rowGap: parseGapValue(readValue(values, "row-gap"), fontSize) ?? 0,
    columnGap: parseGapValue(readValue(values, "column-gap"), fontSize) ?? 0,
    margin: readEdges(values, "margin", ZERO_EDGES, true),
    padding: readEdges(values, "padding", defaultPadding, false),
    borderWidths: readEdges(values, "border", ZERO_EDGES, false, "width"),
    borderColors: readBorderColors(values, color),
    borderRadii: readBorderRadii(values),
    background,
    color,
    fontSize,
    lineHeight: parseLineHeight(
      readValue(values, "line-height"),
      fontSize,
      parent?.lineHeight ?? "normal",
    ),
    letterSpacing: parseLetterSpacing(
      readValue(values, "letter-spacing"),
      parent?.letterSpacing ?? 0,
      fontSize,
    ),
    opacity: unitNumber(readValue(values, "opacity"), 1),
    overflowX: overflow.x,
    overflowY: overflow.y,
    scrollbarWidth: parseScrollbarWidth(readValue(values, "scrollbar-width")),
    objectFit: parseObjectFit(readValue(values, "object-fit")),
    textAlign: parseTextAlign(
      readValue(values, "text-align"),
      parent?.textAlign ?? "start",
    ),
    textOverflow: parseTextOverflow(readValue(values, "text-overflow")),
    whiteSpace: parseWhiteSpace(
      readValue(values, "white-space"),
      parent?.whiteSpace ?? "normal",
    ),
    zIndex: parseZIndex(readValue(values, "z-index")),
  })
}

export const resolveLength = (
  length: CSSLength | null,
  available: number,
): number | null => {
  if (!length) return null
  if (length.unit === "percent")
    return Math.max(0, available * length.value * 0.01)
  return Math.max(0, length.value)
}

export const elementTag = (element: Element): string => {
  const value = element.localName || element.tagName || ""
  return value.toLowerCase()
}

const uaDeclarations = (tag: string, element: Element): DeclarationMap => {
  switch (tag) {
    case "aside":
    case "body":
    case "div":
    case "header":
    case "main":
    case "nav":
    case "section":
      return Object.freeze({ display: "block" })
    case "button":
      return Object.freeze({
        display: "inline",
        padding: "2px 6px",
        background: "#e5e7eb",
      })
    case "input":
      return inputUaDeclarations(element)
    case "img":
      return imageUaDeclarations(element)
    case "select":
      return selectUaDeclarations(element)
    case "textarea":
      return textAreaUaDeclarations(element)
    case "progress":
    case "meter":
      return gaugeUaDeclarations()
    case "option":
      return Object.freeze({display: "none"})
    case "span":
      return Object.freeze({ display: "inline" })
    default:
      return Object.freeze({ display: "inline" })
  }
}

const inputUaDeclarations = (element: Element): DeclarationMap => {
  const input = element as Element & {
    readonly type?: unknown
    readonly disabled?: unknown
  }
  const type = typeof input.type === "string" ? input.type : "text"
  if (type === "hidden") return Object.freeze({display: "none"})
  const disabled = input.disabled === true
  if (type === "checkbox" || type === "radio") {
    return Object.freeze({
      display: "inline",
      "box-sizing": "border-box",
      width: "13px",
      height: "13px",
      padding: "0",
      border: "1px solid #6b7280",
      "border-radius": type === "radio" ? "50%" : "2px",
      background: "#ffffff",
      color: "#111827",
      overflow: "clip",
      ...(disabled ? {opacity: "0.5"} : {}),
    })
  }
  return Object.freeze({
    display: "inline",
    "box-sizing": "border-box",
    width: "160px",
    height: "22px",
    padding: "2px 6px",
    border: "1px solid #6b7280",
    "border-radius": "2px",
    background: "#ffffff",
    color: "#111827",
    "font-size": "13px",
    overflow: "clip",
    ...(disabled ? {opacity: "0.5"} : {}),
  })
}

const imageUaDeclarations = (element: Element): DeclarationMap => {
  const image = element as Element & {
    readonly width?: unknown
    readonly height?: unknown
  }
  const width = reflectedImageDimension(image.width)
  const height = reflectedImageDimension(image.height)
  return Object.freeze({
    display: "inline",
    ...(element.hasAttribute("width") ? {width: `${width}px`} : {}),
    ...(element.hasAttribute("height") ? {height: `${height}px`} : {}),
  })
}

const reflectedImageDimension = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0

const selectUaDeclarations = (element: Element): DeclarationMap => {
  const select = element as Element & {readonly disabled?: unknown}
  return Object.freeze({
    display: "inline",
    "box-sizing": "border-box",
    width: "160px",
    height: "22px",
    padding: "2px 6px",
    border: "1px solid #6b7280",
    "border-radius": "2px",
    background: "#ffffff",
    color: "#111827",
    "font-size": "13px",
    overflow: "clip",
    ...(select.disabled === true ? {opacity: "0.5"} : {}),
  })
}

const textAreaUaDeclarations = (element: Element): DeclarationMap => {
  const textArea = element as Element & {
    readonly cols?: unknown
    readonly rows?: unknown
    readonly disabled?: unknown
  }
  const cols = typeof textArea.cols === "number" && Number.isFinite(textArea.cols)
    ? Math.max(1, textArea.cols)
    : 20
  const rows = typeof textArea.rows === "number" && Number.isFinite(textArea.rows)
    ? Math.max(1, textArea.rows)
    : 2
  const fontSize = 13
  return Object.freeze({
    display: "inline",
    "box-sizing": "border-box",
    width: `${cols * fontSize * 0.6 + 14}px`,
    height: `${rows * fontSize * 1.2 + 6}px`,
    padding: "2px 6px",
    border: "1px solid #6b7280",
    "border-radius": "2px",
    background: "#ffffff",
    color: "#111827",
    "font-size": `${fontSize}px`,
    overflow: "clip",
    "white-space": "pre",
    ...(textArea.disabled === true ? {opacity: "0.5"} : {}),
  })
}

const gaugeUaDeclarations = (): DeclarationMap => Object.freeze({
  display: "inline",
  "box-sizing": "border-box",
  width: "160px",
  height: "16px",
  padding: "2px",
  border: "1px solid #6b7280",
  "border-radius": "2px",
  background: "#ffffff",
  overflow: "clip",
})

const readInlineStyle = (element: Element): string => {
  const attribute = element.getAttribute("style")
  if (attribute != null) return attribute
  const style = (element as Element & { style?: { cssText?: unknown } }).style
  return typeof style?.cssText === "string" ? style.cssText : ""
}

const parseDeclarations = (source: string): DeclarationMap => {
  const declarations: DeclarationEntry[] = []
  for (const entry of source.split(";")) {
    const separator = entry.indexOf(":")
    if (separator < 0) continue
    const property = normalizeProperty(entry.slice(0, separator))
    const value = entry.slice(separator + 1).trim()
    if (!property || !value) continue
    declarations.push(Object.freeze([property, value] as const))
  }
  return Object.freeze(declarations)
}

const normalizeProperty = (property: string): string => {
  const value = property.trim()
  if (value.startsWith("--")) return validCustomPropertyName(value) ? value : ""
  return value.replace(/([A-Z])/g, "-$1").toLowerCase()
}

const validCustomPropertyName = (value: string): boolean =>
  value !== "--" && customPropertyNamePattern.test(value)

const createCustomPropertyEnvironment = (
  parent: ComputedStyle | null,
  values: ReadonlyMap<string, CascadedValue>,
): ComputedCustomProperties => {
  const inherited = parent?.customProperties ?? EMPTY_CUSTOM_PROPERTIES
  if (values.size === 0) return inherited
  const own = Object.create(null) as Record<string, string>
  for (const [name, value] of values) own[name] = value.value
  return Object.freeze({parent: inherited, own: Object.freeze(own)})
}

const resolveCascadedVariables = (
  values: Map<string, CascadedValue>,
  customProperties: ComputedCustomProperties,
): Map<string, CascadedValue> => {
  let resolved: Map<string, CascadedValue> | null = null
  let resolver: CustomPropertyResolver | null = null
  for (const [property, cascaded] of values) {
    if (!hasVarFunction(cascaded.value)) continue
    resolver ??= new CustomPropertyResolver(customProperties)
    const value = substituteVariables(cascaded.value, resolver)
    if (value === null) {
      resolved ??= new Map(values)
      const current = resolved.get(property)
      if (current !== undefined && comparePriority(current, cascaded) <= 0) {
        resolved.delete(property)
      }
      invalidateDeferredShorthand(resolved, property, cascaded)
      continue
    }
    if (deferredVariableShorthandSet.has(property)) {
      resolved ??= new Map(values)
      resolved.delete(property)
      const expanded = expandDeclaration(property, value)
      if (expanded.length === 0) invalidateDeferredShorthand(resolved, property, cascaded)
      for (const [expandedProperty, expandedValue] of expanded) {
        const next = Object.freeze({...cascaded, value: expandedValue})
        const current = resolved.get(expandedProperty)
        if (!current || comparePriority(current, next) <= 0) {
          resolved.set(expandedProperty, next)
        }
      }
      continue
    }
    if (value === cascaded.value) continue
    resolved ??= new Map(values)
    const next = Object.freeze({...cascaded, value})
    const current = resolved.get(property)
    if (!current || comparePriority(current, next) <= 0) {
      resolved.set(property, next)
    }
  }
  return resolved ?? values
}

const invalidateDeferredShorthand = (
  values: Map<string, CascadedValue>,
  property: string,
  cascaded: CascadedValue,
): void => {
  const targets = property === "border"
    ? [
        "border-top-width", "border-right-width", "border-bottom-width", "border-left-width",
        "border-top-color", "border-right-color", "border-bottom-color", "border-left-color",
      ]
    : property === "border-color"
      ? ["border-top-color", "border-right-color", "border-bottom-color", "border-left-color"]
      : property === "gap"
        ? ["row-gap", "column-gap"]
        : []
  for (const target of targets) {
    const current = values.get(target)
    if (current !== undefined && comparePriority(current, cascaded) <= 0) values.delete(target)
  }
}

class CustomPropertyResolver {
  private readonly cache: Map<string, VariableResolution>
  private readonly cyclic = new Set<string>()
  private readonly stack: string[] = []

  constructor(private readonly environment: ComputedCustomProperties) {
    this.cache = variableResolutionCache.get(environment) ?? new Map()
    variableResolutionCache.set(environment, this.cache)
  }

  resolve(name: string): VariableResolution {
    const cached = this.cache.get(name)
    if (cached !== undefined) return cached
    const declaration = lookupCustomProperty(this.environment, name)
    if (declaration === null) {
      this.cache.set(name, INVALID_VARIABLE)
      return INVALID_VARIABLE
    }
    if (declaration.environment !== this.environment) {
      const result = new CustomPropertyResolver(declaration.environment).resolve(name)
      this.cache.set(name, result)
      return result
    }
    const cycleStart = this.stack.indexOf(name)
    if (cycleStart >= 0) {
      for (let index = cycleStart; index < this.stack.length; index += 1) {
        this.cyclic.add(this.stack[index]!)
      }
      return INVALID_VARIABLE
    }
    this.stack.push(name)
    const value = substituteVariables(declaration.source, this)
    this.stack.pop()
    const result = value === null || this.cyclic.has(name)
      ? INVALID_VARIABLE
      : Object.freeze({valid: true as const, value})
    this.cache.set(name, result)
    return result
  }
}

const lookupCustomProperty = (
  environment: ComputedCustomProperties,
  name: string,
): Readonly<{
  environment: ComputedCustomProperties
  source: string
}> | null => {
  for (
    let current: ComputedCustomProperties | null = environment;
    current !== null;
    current = current.parent
  ) {
    if (Object.prototype.hasOwnProperty.call(current.own, name)) {
      return Object.freeze({environment: current, source: current.own[name]!})
    }
  }
  return null
}

const hasVarFunction = (source: string): boolean => findVarFunction(source, 0) >= 0

const substituteVariables = (
  source: string,
  resolver: CustomPropertyResolver,
): string | null => {
  let cursor = 0
  let output = ""
  while (cursor < source.length) {
    const start = findVarFunction(source, cursor)
    if (start < 0) return `${output}${source.slice(cursor)}`
    output += source.slice(cursor, start)
    const end = matchingParenthesis(source, start + 3)
    if (end < 0) return null
    const argument = splitVarArgument(source.slice(start + 4, end))
    if (argument === null || !validCustomPropertyName(argument.name)) return null
    const variable = resolver.resolve(argument.name)
    if (variable.valid) output += variable.value
    else {
      if (argument.fallback === null) return null
      const fallback = substituteVariables(argument.fallback, resolver)
      if (fallback === null) return null
      output += fallback
    }
    cursor = end + 1
  }
  return output
}

const findVarFunction = (source: string, offset: number): number => {
  let quote: "\"" | "'" | null = null
  for (let index = offset; index <= source.length - 4; index += 1) {
    const character = source[index]!
    if (quote !== null) {
      if (character === "\\") index += 1
      else if (character === quote) quote = null
      continue
    }
    if (character === "\"" || character === "'") {
      quote = character
      continue
    }
    if (source.slice(index, index + 4).toLowerCase() !== "var(") continue
    const previous = source[index - 1]
    if (previous !== undefined && /[A-Za-z0-9_-]/.test(previous)) continue
    return index
  }
  return -1
}

const matchingParenthesis = (source: string, open: number): number => {
  let depth = 0
  let quote: "\"" | "'" | null = null
  for (let index = open; index < source.length; index += 1) {
    const character = source[index]!
    if (quote !== null) {
      if (character === "\\") index += 1
      else if (character === quote) quote = null
      continue
    }
    if (character === "\"" || character === "'") {
      quote = character
      continue
    }
    if (character === "(") depth += 1
    else if (character === ")") {
      depth -= 1
      if (depth === 0) return index
      if (depth < 0) return -1
    }
  }
  return -1
}

const splitVarArgument = (
  source: string,
): Readonly<{name: string; fallback: string | null}> | null => {
  let depth = 0
  let quote: "\"" | "'" | null = null
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!
    if (quote !== null) {
      if (character === "\\") index += 1
      else if (character === quote) quote = null
      continue
    }
    if (character === "\"" || character === "'") {
      quote = character
      continue
    }
    if (character === "(") depth += 1
    else if (character === ")") {
      depth -= 1
      if (depth < 0) return null
    } else if (character === "," && depth === 0) {
      return Object.freeze({
        name: source.slice(0, index).trim(),
        fallback: source.slice(index + 1),
      })
    }
  }
  if (quote !== null || depth !== 0) return null
  return Object.freeze({name: source.trim(), fallback: null})
}

const applyDeclarations = (
  values: Map<string, CascadedValue>,
  customValues: Map<string, CascadedValue>,
  declarations: DeclarationMap,
  specificity: readonly [number, number, number],
  order: number,
  sequence: CascadeSequence,
): void => {
  const entries = Array.isArray(declarations)
    ? declarations as readonly DeclarationEntry[]
    : Object.entries(declarations)
  for (const [property, value] of entries) {
    if (property.startsWith("--")) {
      const next = Object.freeze({
        specificity,
        order,
        sequence: sequence.value++,
        value,
      })
      const current = customValues.get(property)
      if (!current || comparePriority(current, next) <= 0) customValues.set(property, next)
      continue
    }
    for (const [expandedProperty, expandedValue] of expandDeclaration(
      property,
      value,
    )) {
      const next = Object.freeze({
        specificity,
        order,
        sequence: sequence.value++,
        value: expandedValue,
      })
      const current = values.get(expandedProperty)
      if (current && comparePriority(current, next) > 0) continue
      values.set(expandedProperty, next)
    }
  }
}

const comparePriority = (
  left: CascadedValue,
  right: CascadedValue,
): number => {
  for (let index = 0; index < 3; index++) {
    const difference =
      (left.specificity[index] ?? 0) - (right.specificity[index] ?? 0)
    if (difference !== 0) return difference
  }
  const orderDifference = left.order - right.order
  return orderDifference === 0 ? left.sequence - right.sequence : orderDifference
}

const expandDeclaration = (
  property: string,
  value: string,
): readonly (readonly [string, string])[] => {
  if (hasVarFunction(value)) {
    if (unsupportedVariableShorthandSet.has(property)) return []
    if (deferredVariableShorthandSet.has(property)) return [[property, value]]
    if (deferredVariablePropertySet.has(property)) return [[property, value]]
  }
  switch (property) {
    case "align-content":
      return validAlignContent(value)
        ? [["align-content", value.trim().toLowerCase()]]
        : []
    case "gap":
      return expandGap(value)
    case "row-gap":
    case "column-gap":
      return validGapValue(value)
        ? [[property, value.trim().toLowerCase()]]
        : []
    case "flex-wrap":
      return validFlexWrap(value)
        ? [["flex-wrap", value.trim().toLowerCase()]]
        : []
    case "inline-size":
      return [["width", value]]
    case "block-size":
      return [["height", value]]
    case "min-inline-size":
      return [["min-width", value]]
    case "min-block-size":
      return [["min-height", value]]
    case "max-inline-size":
      return [["max-width", value]]
    case "max-block-size":
      return [["max-height", value]]
    case "grow":
      return [["flex-grow", value]]
    case "overflow":
      return expandOverflow(value)
    case "scrollbar-width":
      return validScrollbarWidth(value)
        ? [["scrollbar-width", value.trim().toLowerCase()]]
        : []
    case "text-align":
      return validTextAlign(value)
        ? [["text-align", value.trim().toLowerCase()]]
        : []
    case "line-height":
      return validLineHeight(value) ? [["line-height", value.trim().toLowerCase()]] : []
    case "letter-spacing":
      return validLetterSpacing(value)
        ? [["letter-spacing", value.trim().toLowerCase()]]
        : []
    case "white-space":
      return validWhiteSpace(value) ? [["white-space", value.trim().toLowerCase()]] : []
    case "text-overflow":
      return validTextOverflow(value)
        ? [["text-overflow", value.trim().toLowerCase()]]
        : []
    case "object-fit":
      return validObjectFit(value)
        ? [["object-fit", value.trim().toLowerCase()]]
        : []
    case "position":
      return validPosition(value)
        ? [["position", value.trim().toLowerCase()]]
        : []
    case "left":
    case "top":
    case "right":
    case "bottom":
      return validInset(value) ? [[property, value.trim().toLowerCase()]] : []
    case "transform":
      return parseTransform(value) !== null ? [["transform", value.trim()]] : []
    case "transform-origin":
      return parseTransformOrigin(value) !== null
        ? [["transform-origin", value.trim()]]
        : []
    case "box-shadow":
      return validBoxShadow(value) ? [["box-shadow", value.trim()]] : []
    case "z-index": {
      const zIndex = validZIndex(value)
      return zIndex === null ? [] : [["z-index", zIndex]]
    }
    case "margin":
    case "padding":
    case "border-width":
    case "border-color":
      return expandQuad(property, value)
    case "margin-inline":
    case "padding-inline":
      return expandPair(property.replace("-inline", ""), "left", "right", value)
    case "margin-block":
    case "padding-block":
      return expandPair(property.replace("-block", ""), "top", "bottom", value)
    case "margin-inline-start":
      return [["margin-left", value]]
    case "margin-inline-end":
      return [["margin-right", value]]
    case "margin-block-start":
      return [["margin-top", value]]
    case "margin-block-end":
      return [["margin-bottom", value]]
    case "padding-inline-start":
      return [["padding-left", value]]
    case "padding-inline-end":
      return [["padding-right", value]]
    case "padding-block-start":
      return [["padding-top", value]]
    case "padding-block-end":
      return [["padding-bottom", value]]
    case "border":
      return expandBorder(value)
    case "border-top":
    case "border-right":
    case "border-bottom":
    case "border-left":
      return expandBorderSide(property, value)
    case "border-style":
      return expandBorderStyle(value)
    case "border-radius":
      return expandRadius(value)
    case "flex":
      return expandFlex(value)
    default:
      return [[property, value]]
  }
}

const expandQuad = (
  property: string,
  value: string,
): readonly (readonly [string, string])[] => {
  const parts = splitCssComponents(value)
  if (parts.length < 1 || parts.length > 4) return []
  const [top, right = top, bottom = top, left = right] = parts
  if (top === undefined || right === undefined || bottom === undefined || left === undefined)
    return []
  const prefix = property === "border-width" || property === "border-color"
    ? "border"
    : property
  const suffix = property.startsWith("border-")
    ? property.slice("border-".length)
    : ""
  const name = (side: string): string =>
    suffix ? `${prefix}-${side}-${suffix}` : `${prefix}-${side}`
  return [
    [name("top"), top],
    [name("right"), right],
    [name("bottom"), bottom],
    [name("left"), left],
  ]
}

const expandPair = (
  property: string,
  start: string,
  end: string,
  value: string,
): readonly (readonly [string, string])[] => {
  const parts = splitCssComponents(value)
  if (parts.length < 1 || parts.length > 2) return []
  const first = parts[0]
  const second = parts[1] ?? first
  if (first === undefined || second === undefined) return []
  return [
    [`${property}-${start}`, first],
    [`${property}-${end}`, second],
  ]
}

const expandGap = (
  value: string,
): readonly (readonly [string, string])[] => {
  const parts = splitCssComponents(value)
  if (parts.length < 1 || parts.length > 2) return []
  const row = parts[0]
  const column = parts[1] ?? row
  if (
    row === undefined ||
    column === undefined ||
    !validGapValue(row) ||
    !validGapValue(column)
  ) return []
  return [
    ["row-gap", row.trim().toLowerCase()],
    ["column-gap", column.trim().toLowerCase()],
  ]
}

const expandBorder = (
  value: string,
): readonly (readonly [string, string])[] => {
  const parsed = parseBorder(value)
  if (!parsed) return []
  return [
    ...expandQuad("border-width", parsed.width),
    ...expandQuad("border-color", parsed.color),
  ]
}

const expandBorderSide = (
  property: string,
  value: string,
): readonly (readonly [string, string])[] => {
  const parsed = parseBorder(value)
  if (!parsed) return []
  return [
    [`${property}-width`, parsed.width],
    [`${property}-color`, parsed.color],
  ]
}

const expandBorderStyle = (
  value: string,
): readonly (readonly [string, string])[] => {
  const parts = splitCssComponents(value)
  if (parts.length < 1 || parts.length > 4) return []
  const [top, right = top, bottom = top, left = right] = parts
  const sides = [top, right, bottom, left]
  const names = ["top", "right", "bottom", "left"]
  return sides.flatMap((style, index) =>
    style === "none" || style === "hidden"
      ? [[`border-${names[index]}-width`, "0"] as const]
      : [],
  )
}

const expandRadius = (
  value: string,
): readonly (readonly [string, string])[] => {
  if (value.includes("/")) return []
  const parts = splitCssComponents(value)
  if (parts.length < 1 || parts.length > 4) return []
  const [topLeft, topRight = topLeft, bottomRight = topLeft, bottomLeft = topRight] = parts
  if (
    topLeft === undefined ||
    topRight === undefined ||
    bottomRight === undefined ||
    bottomLeft === undefined
  )
    return []
  return [
    ["border-top-left-radius", topLeft],
    ["border-top-right-radius", topRight],
    ["border-bottom-right-radius", bottomRight],
    ["border-bottom-left-radius", bottomLeft],
  ]
}

const expandFlex = (
  value: string,
): readonly (readonly [string, string])[] => {
  const normalized = value.trim().toLowerCase()
  if (normalized === "none")
    return [["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]]
  if (normalized === "auto")
    return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]]
  if (normalized === "initial")
    return [["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]]

  const parts = splitCssComponents(normalized)
  if (parts.length < 1 || parts.length > 3) return []

  if (parts.length === 1) {
    const part = parts[0]
    if (part === undefined) return []
    if (isUnitlessNumber(part))
      return [["flex-grow", part], ["flex-shrink", "1"], ["flex-basis", "0%"]]
    if (parseLength(part))
      return [["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", part]]
    return []
  }

  if (parts.length === 2) {
    const first = parts[0]
    const second = parts[1]
    if (first === undefined || second === undefined || !isUnitlessNumber(first)) return []
    if (isUnitlessNumber(second))
      return [["flex-grow", first], ["flex-shrink", second], ["flex-basis", "0%"]]
    if (parseLength(second))
      return [["flex-grow", first], ["flex-shrink", "1"], ["flex-basis", second]]
    return []
  }

  const [grow, shrink, basis] = parts
  if (
    grow === undefined ||
    shrink === undefined ||
    basis === undefined ||
    !isUnitlessNumber(grow) ||
    !isUnitlessNumber(shrink) ||
    (!parseLength(basis) && basis !== "auto")
  )
    return []
  return [["flex-grow", grow], ["flex-shrink", shrink], ["flex-basis", basis]]
}

const expandOverflow = (
  value: string,
): readonly (readonly [string, string])[] => {
  const parts = splitCssComponents(value)
  if (parts.length < 1 || parts.length > 2) return []
  const x = parts[0]
  const y = parts[1] ?? x
  if (x === undefined || y === undefined) return []
  return [["overflow-x", x], ["overflow-y", y]]
}

const parseBorder = (
  value: string,
): Readonly<{ width: string; color: string }> | null => {
  const parts = splitCssComponents(value)
  if (parts.length === 0) return null
  if (parts.length === 1 && (parts[0] === "none" || parts[0] === "hidden"))
    return Object.freeze({ width: "0", color: "currentcolor" })

  let width: string | null = null
  let color: string | null = null
  let disabled = false
  for (const part of parts) {
    const normalized = part.toLowerCase()
    if (normalized === "none" || normalized === "hidden") {
      disabled = true
      continue
    }
    if (normalized === "solid") continue
    if (width === null && parseBorderWidth(part) !== null) {
      width = part
      continue
    }
    color = color === null ? part : `${color} ${part}`
  }
  return Object.freeze({
    width: disabled ? "0" : (width ?? "0"),
    color: color ?? "currentcolor",
  })
}

const parseSelector = (source: string): ParsedSelector | null => {
  const tokens = tokenizeSelector(source)
  if (tokens === null) return null
  const compounds: CompoundSelector[] = []
  let ids = 0
  let classes = 0
  let tags = 0

  for (const part of tokens.compounds) {
    const compound = parseCompoundSelector(part)
    if (!compound) return null
    compounds.push(compound)
    if (compound.id) ids++
    classes += compound.classes.length + compound.attributes.length + compound.pseudos.length
    if (compound.tag && compound.tag !== "*") tags++
  }

  if (compounds.length === 0) return null
  return Object.freeze({
    compounds: Object.freeze(compounds),
    combinators: Object.freeze(tokens.combinators),
    specificity: Object.freeze([ids, classes, tags] as const),
  })
}

const tokenizeSelector = (
  source: string,
): Readonly<{
  compounds: readonly string[]
  combinators: readonly SelectorCombinator[]
}> | null => {
  const compounds: string[] = []
  const combinators: SelectorCombinator[] = []
  let cursor = 0

  const skipWhitespace = (): boolean => {
    const start = cursor
    while (cursor < source.length && /\s/.test(source[cursor]!)) cursor++
    return cursor !== start
  }

  skipWhitespace()
  while (cursor < source.length) {
    const start = cursor
    let bracketDepth = 0
    let quote: "\"" | "'" | null = null
    while (cursor < source.length) {
      const character = source[cursor]!
      if (quote !== null) {
        if (character === "\\") return null
        if (character === quote) quote = null
        cursor++
        continue
      }
      if (character === "\"" || character === "'") {
        if (bracketDepth === 0) return null
        quote = character
        cursor++
        continue
      }
      if (character === "[") bracketDepth++
      else if (character === "]") {
        bracketDepth--
        if (bracketDepth < 0) return null
      } else if (bracketDepth === 0 && (character === ">" || /\s/.test(character))) {
        break
      }
      cursor++
    }
    if (quote !== null || bracketDepth !== 0) return null
    const compound = source.slice(start, cursor).trim()
    if (compound === "") return null
    compounds.push(compound)

    const separated = skipWhitespace()
    if (cursor >= source.length) break
    if (source[cursor] === ">") {
      cursor++
      skipWhitespace()
      if (cursor >= source.length || source[cursor] === ">") return null
      combinators.push("child")
    } else if (separated) combinators.push("descendant")
    else return null
  }

  if (compounds.length === 0 || combinators.length !== compounds.length - 1) return null
  return Object.freeze({
    compounds: Object.freeze(compounds),
    combinators: Object.freeze(combinators),
  })
}

const parseCompoundSelector = (source: string): CompoundSelector | null => {
  let cursor = 0
  let tag: string | null = null
  let id: string | null = null
  const classes: string[] = []
  const attributes: AttributeSelector[] = []
  const pseudos: SupportedPseudoClass[] = []

  const tagMatch = /^(\*|[a-zA-Z][\w-]*)/.exec(source)
  if (tagMatch?.[0]) {
    tag = tagMatch[0].toLowerCase()
    cursor = tagMatch[0].length
  }

  while (cursor < source.length) {
    const rest = source.slice(cursor)
    const idMatch = /^#([\w-]+)/.exec(rest)
    if (idMatch?.[1]) {
      if (id !== null) return null
      id = idMatch[1]
      cursor += idMatch[0].length
      continue
    }
    const classMatch = /^\.([\w-]+)/.exec(rest)
    if (classMatch?.[1]) {
      classes.push(classMatch[1])
      cursor += classMatch[0].length
      continue
    }
    const attributeMatch = /^\[([\w-]+)(?:\s*=\s*["']?([^\]"']+)["']?)?\]/.exec(
      rest,
    )
    if (attributeMatch?.[1]) {
      const attribute = attributeMatch[2] === undefined
        ? Object.freeze({name: attributeMatch[1].toLowerCase()})
        : Object.freeze({
            name: attributeMatch[1].toLowerCase(),
            value: attributeMatch[2].trim(),
          })
      attributes.push(
        attribute,
      )
      cursor += attributeMatch[0].length
      continue
    }
    const pseudoMatch = /^:([a-z-]+)/.exec(rest)
    if (pseudoMatch?.[1]) {
      if (!isSupportedPseudoClass(pseudoMatch[1])) return null
      pseudos.push(pseudoMatch[1])
      cursor += pseudoMatch[0].length
      continue
    }
    return null
  }

  if (!tag && !id && classes.length === 0 && attributes.length === 0 && pseudos.length === 0)
    return null
  return Object.freeze({
    tag,
    id,
    classes: Object.freeze(classes),
    attributes: Object.freeze(attributes),
    pseudos: Object.freeze(pseudos),
  })
}

const isSupportedPseudoClass = (value: string): value is SupportedPseudoClass =>
  value === "active" ||
  value === "checked" ||
  value === "disabled" ||
  value === "focus" ||
  value === "focus-within" ||
  value === "hover" ||
  value === "indeterminate" ||
  value === "root"

const matchesSelector = (
  element: Element,
  selector: ParsedSelector,
  interactionState?: DocumentInteractionState,
): boolean => {
  let current: Element | null = element
  for (let index = selector.compounds.length - 1; index >= 0; index--) {
    const compound = selector.compounds[index]
    if (!compound) return false
    if (!current || !matchesCompound(current, compound, interactionState)) return false
    if (index === 0) return true

    const combinator = selector.combinators[index - 1]
    current = parentElement(current)
    if (combinator === "child") continue
    const ancestor = selector.compounds[index - 1]!
    while (current && !matchesCompound(current, ancestor, interactionState)) {
      current = parentElement(current)
    }
  }
  return false
}

const matchesCompound = (
  element: Element,
  selector: CompoundSelector,
  interactionState?: DocumentInteractionState,
): boolean => {
  if (
    selector.tag &&
    selector.tag !== "*" &&
    elementTag(element) !== selector.tag
  )
    return false
  if (selector.id && element.getAttribute("id") !== selector.id) return false

  const classNames = new Set(classTokens(element.getAttribute("class") ?? ""))
  for (const className of selector.classes)
    if (!classNames.has(className)) return false

  for (const attribute of selector.attributes) {
    if (!element.hasAttribute(attribute.name)) return false
    if (
      attribute.value !== undefined &&
      element.getAttribute(attribute.name) !== attribute.value
    )
      return false
  }
  for (const pseudo of selector.pseudos) {
    if (!matchesPseudoClass(element, pseudo, interactionState)) return false
  }
  return true
}

const classTokens = (value: string): readonly string[] =>
  value.split(/\s+/).filter(Boolean)

const matchesPseudoClass = (
  element: Element,
  pseudo: SupportedPseudoClass,
  interactionState?: DocumentInteractionState,
): boolean => {
  switch (pseudo) {
    case "active":
      return interactionState?.document === element.ownerDocument &&
        interactionState.isActive(element)
    case "hover":
      return interactionState?.document === element.ownerDocument &&
        interactionState.isHovered(element)
    case "focus":
      return element.ownerDocument?.activeElement === element
    case "focus-within": {
      const activeElement = element.ownerDocument?.activeElement ?? null
      return activeElement !== null && element.contains(activeElement)
    }
    case "disabled":
      return isEffectivelyDisabled(element)
    case "checked":
      return element.localName === "input" && readBooleanProperty(element, "checked") ||
        element.localName === "option" && readBooleanProperty(element, "selected")
    case "indeterminate":
      return element.localName === "input" && readBooleanProperty(element, "indeterminate")
    case "root":
      return element.ownerDocument?.documentElement === element
  }
}

const readBooleanProperty = (element: Element, property: string): boolean =>
  (element as Element & Record<string, unknown>)[property] === true

const isEffectivelyDisabled = (element: Element): boolean => {
  if (!DISABLABLE_TAGS.has(element.localName)) return false
  if (readBooleanProperty(element, "disabled")) return true
  if (!FIELDSET_DISABLED_TAGS.has(element.localName)) return false

  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.localName !== "fieldset" || !ancestor.hasAttribute("disabled")) continue
    const firstLegend = ancestor.children.find((child) => child.localName === "legend") ?? null
    if (firstLegend?.contains(element)) continue
    return true
  }
  return false
}

const DISABLABLE_TAGS = new Set([
  "button",
  "fieldset",
  "input",
  "option",
  "select",
  "textarea",
])

const FIELDSET_DISABLED_TAGS = new Set([
  "button",
  "input",
  "select",
  "textarea",
])

const parentElement = (node: Node): Element | null => {
  let parent = node.parentNode
  while (parent && parent.nodeType !== 1) parent = parent.parentNode
  return parent as Element | null
}

const parseDisplay = (
  value: string | undefined,
  tag: string,
): RenderDisplay => {
  switch (value?.trim().toLowerCase()) {
    case "none":
      return "none"
    case "flex":
      return "flex"
    case "block":
      return "block"
    case "inline":
    case "inline-block":
      return "inline"
    default:
      return blockTag(tag) ? "block" : "inline"
  }
}

const blockTag = (tag: string): boolean =>
  tag === "aside" ||
  tag === "body" ||
  tag === "div" ||
  tag === "header" ||
  tag === "main" ||
  tag === "nav" ||
  tag === "section"

const parseBoxSizing = (value: string | undefined): RenderBoxSizing =>
  value?.trim().toLowerCase() === "border-box" ? "border-box" : "content-box"

const parseFlexDirection = (value: string | undefined): RenderFlexDirection =>
  value?.trim().toLowerCase() === "column" ? "column" : "row"

const parseFlexWrap = (value: string | undefined): RenderFlexWrap => {
  switch (value?.trim().toLowerCase()) {
    case "wrap":
      return "wrap"
    case "wrap-reverse":
      return "wrap-reverse"
    default:
      return "nowrap"
  }
}

const validFlexWrap = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return normalized === "nowrap" || normalized === "wrap" || normalized === "wrap-reverse"
}

const parseAlignContent = (value: string | undefined): RenderAlignContent => {
  switch (value?.trim().toLowerCase()) {
    case "stretch":
      return "stretch"
    case "flex-start":
      return "flex-start"
    case "center":
      return "center"
    case "flex-end":
      return "flex-end"
    case "space-between":
      return "space-between"
    case "space-around":
      return "space-around"
    case "space-evenly":
      return "space-evenly"
    default:
      return "normal"
  }
}

const validAlignContent = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return normalized === "normal" ||
    normalized === "stretch" ||
    normalized === "flex-start" ||
    normalized === "center" ||
    normalized === "flex-end" ||
    normalized === "space-between" ||
    normalized === "space-around" ||
    normalized === "space-evenly"
}

const parseAlignItems = (value: string | undefined): RenderAlignItems => {
  switch (value?.trim().toLowerCase()) {
    case "center":
      return "center"
    case "end":
    case "flex-end":
      return "flex-end"
    case "start":
    case "flex-start":
      return "flex-start"
    default:
      return "stretch"
  }
}

const parseJustifyContent = (value: string | undefined): RenderJustifyContent => {
  switch (value?.trim().toLowerCase()) {
    case "center":
      return "center"
    case "end":
    case "flex-end":
      return "flex-end"
    case "space-between":
      return "space-between"
    case "space-around":
      return "space-around"
    case "space-evenly":
      return "space-evenly"
    default:
      return "flex-start"
  }
}

const parseWhiteSpace = (
  value: string | undefined,
  inherited: RenderWhiteSpace,
): RenderWhiteSpace => {
  if (value === undefined || value.trim().toLowerCase() === "inherit")
    return inherited
  const normalized = value.trim().toLowerCase()
  if (normalized === "nowrap") return "nowrap"
  return normalized === "pre" || normalized === "pre-wrap" ? "pre" : "normal"
}

const validWhiteSpace = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return normalized === "normal" || normalized === "pre" ||
    normalized === "pre-wrap" || normalized === "nowrap"
}

const validLineHeight = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  if (normalized === "normal") return true
  const number = transformNumber(normalized)
  if (number !== null) return number >= 0
  const length = parseLength(normalized, 16)
  return length !== null && length.value >= 0
}

const parseLineHeight = (
  value: string | undefined,
  fontSize: number,
  inherited: ComputedLineHeight,
): ComputedLineHeight => {
  const normalized = value?.trim().toLowerCase()
  if (normalized === undefined || normalized === "inherit") return inherited
  if (normalized === "normal") return "normal"
  const number = transformNumber(normalized)
  if (number !== null && number >= 0) return Object.freeze({kind: "number", value: number})
  const length = parseLength(normalized, fontSize)
  if (length === null || length.value < 0) return inherited
  return Object.freeze({
    kind: "length",
    value: length.unit === "percent" ? fontSize * length.value / 100 : length.value,
  })
}

export const resolveLineHeight = (style: Pick<ComputedStyle, "fontSize" | "lineHeight">): number => {
  if (style.lineHeight === "normal") return style.fontSize * 1.2
  return style.lineHeight.kind === "number"
    ? style.fontSize * style.lineHeight.value
    : style.lineHeight.value
}

const validLetterSpacing = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  if (normalized === "normal") return true
  const length = parseLength(normalized, 16)
  return length !== null && length.unit === "px"
}

const parseLetterSpacing = (
  value: string | undefined,
  inherited: number,
  fontSize: number,
): number => {
  const normalized = value?.trim().toLowerCase()
  if (normalized === undefined || normalized === "inherit") return inherited
  if (normalized === "normal") return 0
  const length = parseLength(normalized, fontSize)
  return length !== null && length.unit === "px" ? length.value : inherited
}

const validTextOverflow = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return normalized === "clip" || normalized === "ellipsis"
}

const parseTextOverflow = (value: string | undefined): ComputedTextOverflow =>
  value?.trim().toLowerCase() === "ellipsis" ? "ellipsis" : "clip"

const parseOverflow = (value: string | undefined): RenderOverflow => {
  switch (value?.trim().toLowerCase()) {
    case "hidden":
      return "hidden"
    case "clip":
      return "clip"
    case "auto":
      return "auto"
    case "scroll":
      return "scroll"
    default:
      return "visible"
  }
}

const validScrollbarWidth = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return normalized === "auto" || normalized === "thin" || normalized === "none"
}

const parseScrollbarWidth = (value: string | undefined): ComputedScrollbarWidth => {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "thin" || normalized === "none") return normalized
  return "auto"
}

const validObjectFit = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return normalized === "cover" || normalized === "contain"
}

const parseObjectFit = (value: string | undefined): RenderObjectFit =>
  value?.trim().toLowerCase() === "contain" ? "contain" : "cover"

const validPosition = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return normalized === "static" || normalized === "relative" || normalized === "absolute"
}

const parsePosition = (value: string | undefined): RenderPosition => {
  const normalized = value?.trim().toLowerCase()
  return normalized === "relative" || normalized === "absolute" ? normalized : "static"
}

const validInset = (value: string): boolean =>
  value.trim().toLowerCase() === "auto" || parseLength(value) !== null

const parseTransform = (
  value: string | undefined,
): readonly ComputedTransformFunction[] | null => {
  if (value === undefined || value.trim().toLowerCase() === "none") {
    return Object.freeze([])
  }
  const source = value.trim()
  if (source === "") return null
  const functions: ComputedTransformFunction[] = []
  let cursor = 0
  while (cursor < source.length) {
    while (cursor < source.length && /\s/.test(source[cursor]!)) cursor += 1
    const match = /^([a-zA-Z]+)\(([^()]*)\)/.exec(source.slice(cursor))
    if (!match) return null
    const name = match[1]!.toLowerCase()
    const args = transformArguments(match[2]!)
    const parsed = parseTransformFunction(name, args)
    if (parsed === null) return null
    functions.push(parsed)
    cursor += match[0].length
  }
  return Object.freeze(functions)
}

const parseTransformFunction = (
  name: string,
  args: readonly string[],
): ComputedTransformFunction | null => {
  const zero: CSSLength = Object.freeze({unit: "px", value: 0})
  if (name === "translate" && (args.length === 1 || args.length === 2)) {
    const x = parseLength(args[0])
    const y = args[1] === undefined ? zero : parseLength(args[1])
    return x !== null && y !== null ? Object.freeze({kind: "translate", x, y}) : null
  }
  if ((name === "translatex" || name === "translatey") && args.length === 1) {
    const value = parseLength(args[0])
    if (value === null) return null
    return name === "translatex"
      ? Object.freeze({kind: "translate", x: value, y: zero})
      : Object.freeze({kind: "translate", x: zero, y: value})
  }
  if (name === "scale" && (args.length === 1 || args.length === 2)) {
    const x = transformNumber(args[0])
    const y = args[1] === undefined ? x : transformNumber(args[1])
    return x !== null && y !== null ? Object.freeze({kind: "scale", x, y}) : null
  }
  if ((name === "scalex" || name === "scaley") && args.length === 1) {
    const value = transformNumber(args[0])
    if (value === null) return null
    return name === "scalex"
      ? Object.freeze({kind: "scale", x: value, y: 1})
      : Object.freeze({kind: "scale", x: 1, y: value})
  }
  return null
}

const transformArguments = (source: string): readonly string[] => {
  const trimmed = source.trim()
  if (trimmed === "") return Object.freeze([])
  const parts = trimmed.includes(",")
    ? trimmed.split(",").map((part) => part.trim())
    : trimmed.split(/\s+/)
  return parts.some((part) => part === "") ? Object.freeze([]) : Object.freeze(parts)
}

const transformNumber = (value: string | undefined): number | null => {
  if (value === undefined || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
    return null
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

const parseTransformOrigin = (
  value: string | undefined,
): ComputedTransformOrigin | null => {
  if (value === undefined) return CENTER_ORIGIN
  const parts = splitCssComponents(value.trim().toLowerCase())
  if (parts.length < 1 || parts.length > 2) return null
  const x = transformOriginAxis(parts[0])
  const y = transformOriginAxis(parts[1] ?? "center")
  return x !== null && y !== null ? Object.freeze({x, y}) : null
}

const transformOriginAxis = (value: string | undefined): CSSLength | null =>
  value === "center" ? CENTER_PERCENT : parseLength(value)

const validBoxShadow = (value: string): boolean =>
  parseBoxShadow(value, "#000000") !== undefined

const parseBoxShadow = (
  value: string | undefined,
  currentColor: string,
): ComputedBoxShadow | null | undefined => {
  if (value === undefined || value.trim().toLowerCase() === "none") return null
  const source = value.trim()
  if (source === "" || hasTopLevelComma(source)) return undefined
  const components = splitCssComponents(source)
  if (components.some((component) => component.toLowerCase() === "inset")) return undefined
  const lengths: number[] = []
  let color: string | null = null
  for (const component of components) {
    const length = parseLength(component)
    if (length !== null && length.unit === "px") {
      lengths.push(length.value)
      continue
    }
    if (color !== null || !isBoxShadowColor(component)) return undefined
    color = resolveBoxShadowColor(component, currentColor)
  }
  if (lengths.length < 2 || lengths.length > 4) return undefined
  const blurRadius = lengths[2] ?? 0
  if (blurRadius < 0) return undefined
  return Object.freeze({
    offsetX: lengths[0]!,
    offsetY: lengths[1]!,
    blurRadius,
    spreadRadius: lengths[3] ?? 0,
    color: color ?? currentColor,
  })
}

const hasTopLevelComma = (value: string): boolean => {
  let depth = 0
  for (const character of value) {
    if (character === "(") depth += 1
    else if (character === ")") depth = Math.max(0, depth - 1)
    else if (character === "," && depth === 0) return true
  }
  return false
}

const isBoxShadowColor = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return normalized === "currentcolor" ||
    normalized === "transparent" ||
    normalized in BOX_SHADOW_NAMED_COLORS ||
    /^#[0-9a-f]{3,4}(?:[0-9a-f]{3,4})?$/i.test(normalized) ||
    /^(?:rgb|rgba)\([^()]+\)$/i.test(normalized)
}

const resolveBoxShadowColor = (value: string, currentColor: string): string => {
  const normalized = value.trim().toLowerCase()
  if (normalized === "currentcolor") return currentColor
  return BOX_SHADOW_NAMED_COLORS[normalized] ?? value.trim()
}

const BOX_SHADOW_NAMED_COLORS: Readonly<Record<string, string>> = Object.freeze({
  black: "#000000",
  silver: "#c0c0c0",
  gray: "#808080",
  white: "#ffffff",
  maroon: "#800000",
  red: "#ff0000",
  purple: "#800080",
  fuchsia: "#ff00ff",
  green: "#008000",
  lime: "#00ff00",
  olive: "#808000",
  yellow: "#ffff00",
  navy: "#000080",
  blue: "#0000ff",
  teal: "#008080",
  aqua: "#00ffff",
})

const validTextAlign = (value: string): boolean => {
  const normalized = value.trim().toLowerCase()
  return normalized === "start" ||
    normalized === "end" ||
    normalized === "left" ||
    normalized === "right" ||
    normalized === "center"
}

const parseTextAlign = (
  value: string | undefined,
  inherited: RenderTextAlign,
): RenderTextAlign => {
  const normalized = value?.trim().toLowerCase()
  return normalized === "start" ||
    normalized === "end" ||
    normalized === "left" ||
    normalized === "right" ||
    normalized === "center"
    ? normalized
    : inherited
}

const validZIndex = (value: string): string | null => {
  const normalized = value.trim().toLowerCase()
  if (normalized === "auto") return normalized
  if (!/^[+-]?\d+$/.test(normalized)) return null
  const number = Number(normalized)
  return Number.isSafeInteger(number) ? String(Object.is(number, -0) ? 0 : number) : null
}

const parseZIndex = (value: string | undefined): RenderZIndex => {
  if (value === undefined || value === "auto") return "auto"
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : "auto"
}

const normalizeOverflowAxes = (
  x: RenderOverflow,
  y: RenderOverflow,
): Readonly<{x: RenderOverflow; y: RenderOverflow}> => {
  if (!scrollContainerValue(x) && !scrollContainerValue(y))
    return Object.freeze({x, y})
  return Object.freeze({
    x: normalizeOverflowAxis(x),
    y: normalizeOverflowAxis(y),
  })
}

const scrollContainerValue = (value: RenderOverflow): boolean =>
  value !== "visible" && value !== "clip"

const normalizeOverflowAxis = (value: RenderOverflow): RenderOverflow => {
  if (value === "visible") return "auto"
  if (value === "clip") return "hidden"
  return value
}

const parseLength = (value: string | undefined, emBase?: number): CSSLength | null => {
  if (
    !value ||
    value.trim().toLowerCase() === "auto" ||
    value.trim().toLowerCase() === "none"
  )
    return null
  const source = value.trim().toLowerCase()
  const calculated = parseCalculatedLength(source, emBase)
  if (calculated !== null) return calculated
  const numeric = Number.parseFloat(source)
  if (!Number.isFinite(numeric)) return null
  if (/^-?(?:\d+|\d*\.\d+)%$/.test(source)) {
    return Object.freeze({unit: "percent", value: numeric})
  }
  if (/^-?(?:\d+|\d*\.\d+)(?:px)?$/.test(source)) {
    return Object.freeze({unit: "px", value: numeric})
  }
  if (/^-?(?:\d+|\d*\.\d+)em$/.test(source) && emBase !== undefined) {
    return Object.freeze({unit: "px", value: numeric * emBase})
  }
  return null
}

type CalculatedValue = Readonly<{
  unit: "number" | "px" | "percent"
  value: number
}>

const parseCalculatedLength = (source: string, emBase?: number): CSSLength | null => {
  if (!source.startsWith("calc(") || !source.endsWith(")")) return null
  const parser = new CalculationParser(source.slice(5, -1), emBase)
  const value = parser.parse()
  if (value === null || !Number.isFinite(value.value)) return null
  if (value.unit === "number") {
    return value.value === 0 ? Object.freeze({unit: "px", value: 0}) : null
  }
  return Object.freeze({unit: value.unit, value: value.value})
}

class CalculationParser {
  private cursor = 0

  constructor(
    private readonly source: string,
    private readonly emBase: number | undefined,
  ) {}

  parse(): CalculatedValue | null {
    const value = this.sum()
    this.whitespace()
    return value !== null && this.cursor === this.source.length ? value : null
  }

  private sum(): CalculatedValue | null {
    let value = this.product()
    if (value === null) return null
    while (true) {
      this.whitespace()
      const operator = this.source[this.cursor]
      if (operator !== "+" && operator !== "-") return value
      this.cursor += 1
      const right = this.product()
      if (right === null || right.unit !== value.unit) return null
      value = Object.freeze({
        unit: value.unit,
        value: operator === "+" ? value.value + right.value : value.value - right.value,
      })
    }
  }

  private product(): CalculatedValue | null {
    let value = this.unary()
    if (value === null) return null
    while (true) {
      this.whitespace()
      const operator = this.source[this.cursor]
      if (operator !== "*" && operator !== "/") return value
      this.cursor += 1
      const right = this.unary()
      if (right === null) return null
      if (operator === "/") {
        if (right.unit !== "number" || right.value === 0) return null
        value = Object.freeze({unit: value.unit, value: value.value / right.value})
        continue
      }
      if (value.unit === "number") {
        value = Object.freeze({unit: right.unit, value: value.value * right.value})
      } else if (right.unit === "number") {
        value = Object.freeze({unit: value.unit, value: value.value * right.value})
      } else return null
    }
  }

  private unary(): CalculatedValue | null {
    this.whitespace()
    const operator = this.source[this.cursor]
    if (operator !== "+" && operator !== "-") return this.primary()
    this.cursor += 1
    const value = this.unary()
    return value === null || operator === "+"
      ? value
      : Object.freeze({unit: value.unit, value: -value.value})
  }

  private primary(): CalculatedValue | null {
    this.whitespace()
    if (this.source[this.cursor] === "(") {
      this.cursor += 1
      const value = this.sum()
      this.whitespace()
      if (value === null || this.source[this.cursor] !== ")") return null
      this.cursor += 1
      return value
    }
    const match = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(this.source.slice(this.cursor))
    if (match === null) return null
    this.cursor += match[0].length
    const numeric = Number(match[0])
    if (!Number.isFinite(numeric)) return null
    if (this.source[this.cursor] === "%") {
      this.cursor += 1
      return Object.freeze({unit: "percent", value: numeric})
    }
    const unit = /^[a-z]+/i.exec(this.source.slice(this.cursor))?.[0]?.toLowerCase()
    if (unit !== undefined) this.cursor += unit.length
    if (unit === undefined) return Object.freeze({unit: "number", value: numeric})
    if (unit === "px") return Object.freeze({unit: "px", value: numeric})
    if (unit === "em" && this.emBase !== undefined) {
      return Object.freeze({unit: "px", value: numeric * this.emBase})
    }
    return null
  }

  private whitespace(): void {
    while (/\s/.test(this.source[this.cursor] ?? "")) this.cursor += 1
  }
}

const readValue = (
  values: ReadonlyMap<string, CascadedValue>,
  property: string,
): string | undefined => values.get(property)?.value

const readEdges = (
  values: ReadonlyMap<string, CascadedValue>,
  prefix: "margin" | "padding" | "border",
  fallback: RenderEdges,
  allowNegative: boolean,
  suffix = "",
): RenderEdges => {
  const property = (side: string): string =>
    suffix ? `${prefix}-${side}-${suffix}` : `${prefix}-${side}`
  const number = (side: string, fallbackValue: number): number => {
    const value = readValue(values, property(side))
    if (prefix === "border" && suffix === "width")
      return parseBorderWidth(value ?? "") ?? fallbackValue
    return pixelNumber(value, fallbackValue, allowNegative)
  }
  return Object.freeze({
    top: number("top", fallback.top),
    right: number("right", fallback.right),
    bottom: number("bottom", fallback.bottom),
    left: number("left", fallback.left),
  })
}

const readBorderColors = (
  values: ReadonlyMap<string, CascadedValue>,
  currentColor: string,
): RenderBorderColors =>
  Object.freeze({
    top: resolvedColor(readValue(values, "border-top-color"), currentColor),
    right: resolvedColor(readValue(values, "border-right-color"), currentColor),
    bottom: resolvedColor(readValue(values, "border-bottom-color"), currentColor),
    left: resolvedColor(readValue(values, "border-left-color"), currentColor),
  })

const readBorderRadii = (
  values: ReadonlyMap<string, CascadedValue>,
): ComputedCornerRadii => {
  const radii = Object.freeze({
    topLeft: parseLength(readValue(values, "border-top-left-radius")),
    topRight: parseLength(readValue(values, "border-top-right-radius")),
    bottomRight: parseLength(readValue(values, "border-bottom-right-radius")),
    bottomLeft: parseLength(readValue(values, "border-bottom-left-radius")),
  })
  return Object.values(radii).every((value) => value === null) ? ZERO_RADII : radii
}

const nonNegativeNumber = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) return fallback
  const numeric = Number.parseFloat(value)
  return Number.isFinite(numeric) ? Math.max(0, numeric) : fallback
}

const parseFontSize = (value: string | undefined, inherited: number): number => {
  if (value === undefined || value.trim().toLowerCase() === "inherit") return inherited
  const length = parseLength(value, inherited)
  if (length === null) return inherited
  const pixels = length.unit === "percent" ? inherited * length.value / 100 : length.value
  return Math.max(0, pixels)
}

const parseGapValue = (
  value: string | undefined,
  emBase: number,
): number | null => {
  if (value?.trim().toLowerCase() === "normal") return 0
  const length = parseLength(value, emBase)
  return length?.unit === "px" && length.value >= 0 ? length.value : null
}

const validGapValue = (value: string): boolean => parseGapValue(value, 16) !== null

const unitNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const numeric = Number.parseFloat(value)
  if (!Number.isFinite(numeric)) return fallback
  const resolved = value.trim().endsWith("%") ? numeric / 100 : numeric
  return Math.min(1, Math.max(0, resolved))
}

const pixelNumber = (
  value: string | undefined,
  fallback: number,
  allowNegative: boolean,
): number => {
  if (!value) return fallback
  const length = parseLength(value)
  if (length === null || length.unit !== "px") return fallback
  return allowNegative ? length.value : Math.max(0, length.value)
}

const parseBorderWidth = (value: string): number | null => {
  switch (value.trim().toLowerCase()) {
    case "thin":
      return 1
    case "medium":
      return 3
    case "thick":
      return 5
    default: {
      const number = pixelNumber(value, Number.NaN, false)
      return Number.isFinite(number) ? number : null
    }
  }
}

const resolvedColor = (value: string | undefined, currentColor: string): string => {
  if (!value || value.trim().toLowerCase() === "currentcolor") return currentColor
  return value.trim()
}

const isUnitlessNumber = (value: string): boolean =>
  /^-?(?:\d+|\d*\.\d+)$/.test(value)

const splitCssComponents = (value: string): string[] => {
  const parts: string[] = []
  let current = ""
  let depth = 0
  for (const character of value.trim()) {
    if (character === "(") depth++
    if (character === ")") depth = Math.max(0, depth - 1)
    if (/\s/.test(character) && depth === 0) {
      if (current) {
        parts.push(current)
        current = ""
      }
      continue
    }
    current += character
  }
  if (current) parts.push(current)
  return parts
}
