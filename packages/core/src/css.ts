import type { Element, Node } from "@zavx0z/dom"
import type {
  RenderAlignItems,
  RenderBorderColors,
  RenderBorderWidths,
  RenderBoxSizing,
  RenderDisplay,
  RenderEdges,
  RenderFlexDirection,
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

export type ComputedTextOverflow = "clip" | "ellipsis"

export type ComputedStyle = Readonly<{
  display: RenderDisplay
  boxSizing: RenderBoxSizing
  flexDirection: RenderFlexDirection
  flexGrow: number
  flexShrink: number
  flexBasis: CSSLength | null
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
  gap: number
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

type DeclarationMap = Readonly<Record<string, string>>

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

type ParsedSelector = Readonly<{
  compounds: readonly CompoundSelector[]
  specificity: readonly [number, number, number]
}>

export type StyleRule = Readonly<{
  selector: ParsedSelector
  declarations: DeclarationMap
  order: number
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

export const parseStyleSheets = (
  styleSheets: readonly string[],
): readonly StyleRule[] => {
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
      for (const part of selectorSource.split(",")) {
        const selector = parseSelector(part.trim())
        if (!selector) continue
        rules.push(Object.freeze({ selector, declarations, order: order++ }))
      }
    }
  }
  return Object.freeze(rules)
}

export const computeStyle = (
  element: Element,
  parent: ComputedStyle | null,
  rules: readonly StyleRule[],
): ComputedStyle => {
  const tag = elementTag(element)
  const values = new Map<string, CascadedValue>()
  const sequence: CascadeSequence = { value: 0 }

  applyDeclarations(
    values,
    uaDeclarations(tag, element),
    [0, 0, 0],
    -1_000_000,
    sequence,
  )

  for (const rule of rules) {
    if (!matchesSelector(element, rule.selector)) continue
    applyDeclarations(
      values,
      rule.declarations,
      rule.selector.specificity,
      rule.order,
      sequence,
    )
  }

  const inline = readInlineStyle(element)
  if (inline)
    applyDeclarations(
      values,
      parseDeclarations(inline),
      [1_000_000, 0, 0],
      1_000_000,
      sequence,
    )

  const color = readValue(values, "color") ?? parent?.color ?? "#000000"
  const fontSize = nonNegativeNumber(
    readValue(values, "font-size"),
    parent?.fontSize ?? 16,
  )
  const defaultPadding = tag === "button" ? BUTTON_PADDING : ZERO_EDGES
  const overflow = normalizeOverflowAxes(
    parseOverflow(readValue(values, "overflow-x")),
    parseOverflow(readValue(values, "overflow-y")),
  )

  return Object.freeze({
    display: parseDisplay(readValue(values, "display"), tag),
    boxSizing: parseBoxSizing(readValue(values, "box-sizing")),
    flexDirection: parseFlexDirection(readValue(values, "flex-direction")),
    flexGrow: nonNegativeNumber(readValue(values, "flex-grow"), 0),
    flexShrink: nonNegativeNumber(readValue(values, "flex-shrink"), 1),
    flexBasis: parseLength(readValue(values, "flex-basis")),
    alignItems: parseAlignItems(readValue(values, "align-items")),
    justifyContent: parseJustifyContent(readValue(values, "justify-content")),
    width: parseLength(readValue(values, "width")),
    height: parseLength(readValue(values, "height")),
    minWidth: parseLength(readValue(values, "min-width")),
    minHeight: parseLength(readValue(values, "min-height")),
    maxWidth: parseLength(readValue(values, "max-width")),
    maxHeight: parseLength(readValue(values, "max-height")),
    position: parsePosition(readValue(values, "position")),
    left: parseLength(readValue(values, "left")),
    top: parseLength(readValue(values, "top")),
    right: parseLength(readValue(values, "right")),
    bottom: parseLength(readValue(values, "bottom")),
    transform: parseTransform(readValue(values, "transform")) ?? Object.freeze([]),
    transformOrigin: parseTransformOrigin(readValue(values, "transform-origin")) ?? CENTER_ORIGIN,
    boxShadow: parseBoxShadow(readValue(values, "box-shadow"), color) ?? null,
    gap: nonNegativeNumber(readValue(values, "gap"), 0),
    margin: readEdges(values, "margin", ZERO_EDGES, true),
    padding: readEdges(values, "padding", defaultPadding, false),
    borderWidths: readEdges(values, "border", ZERO_EDGES, false, "width"),
    borderColors: readBorderColors(values, color),
    borderRadii: readBorderRadii(values),
    background:
      readValue(values, "background-color") ??
      readValue(values, "background") ??
      null,
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
  const declarations: Record<string, string> = Object.create(null)
  for (const entry of source.split(";")) {
    const separator = entry.indexOf(":")
    if (separator < 0) continue
    const property = normalizeProperty(entry.slice(0, separator))
    const value = entry.slice(separator + 1).trim()
    if (!property || !value) continue
    declarations[property] = value
  }
  return Object.freeze(declarations)
}

const normalizeProperty = (property: string): string =>
  property
    .trim()
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()

const applyDeclarations = (
  values: Map<string, CascadedValue>,
  declarations: DeclarationMap,
  specificity: readonly [number, number, number],
  order: number,
  sequence: CascadeSequence,
): void => {
  for (const [property, value] of Object.entries(declarations)) {
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
  switch (property) {
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
  if (!source || /[>+~:]/.test(source)) return null
  const compounds: CompoundSelector[] = []
  let ids = 0
  let classes = 0
  let tags = 0

  for (const part of source.split(/\s+/)) {
    const compound = parseCompoundSelector(part)
    if (!compound) return null
    compounds.push(compound)
    if (compound.id) ids++
    classes += compound.classes.length + compound.attributes.length
    if (compound.tag && compound.tag !== "*") tags++
  }

  if (compounds.length === 0) return null
  return Object.freeze({
    compounds: Object.freeze(compounds),
    specificity: Object.freeze([ids, classes, tags] as const),
  })
}

const parseCompoundSelector = (source: string): CompoundSelector | null => {
  let cursor = 0
  let tag: string | null = null
  let id: string | null = null
  const classes: string[] = []
  const attributes: AttributeSelector[] = []

  const tagMatch = /^(\*|[a-zA-Z][\w-]*)/.exec(source)
  if (tagMatch?.[0]) {
    tag = tagMatch[0].toLowerCase()
    cursor = tagMatch[0].length
  }

  while (cursor < source.length) {
    const rest = source.slice(cursor)
    const idMatch = /^#([\w-]+)/.exec(rest)
    if (idMatch?.[1]) {
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
        ? Object.freeze({name: attributeMatch[1]})
        : Object.freeze({
            name: attributeMatch[1],
            value: attributeMatch[2].trim(),
          })
      attributes.push(
        attribute,
      )
      cursor += attributeMatch[0].length
      continue
    }
    return null
  }

  if (!tag && !id && classes.length === 0 && attributes.length === 0)
    return null
  return Object.freeze({
    tag,
    id,
    classes: Object.freeze(classes),
    attributes: Object.freeze(attributes),
  })
}

const matchesSelector = (
  element: Element,
  selector: ParsedSelector,
): boolean => {
  let current: Element | null = element
  for (let index = selector.compounds.length - 1; index >= 0; index--) {
    const compound = selector.compounds[index]
    if (!compound) return false
    if (index === selector.compounds.length - 1) {
      if (!current || !matchesCompound(current, compound)) return false
      current = parentElement(current)
      continue
    }
    while (current && !matchesCompound(current, compound))
      current = parentElement(current)
    if (!current) return false
    current = parentElement(current)
  }
  return true
}

const matchesCompound = (
  element: Element,
  selector: CompoundSelector,
): boolean => {
  if (
    selector.tag &&
    selector.tag !== "*" &&
    elementTag(element) !== selector.tag
  )
    return false
  if (selector.id && element.getAttribute("id") !== selector.id) return false

  const classNames = new Set(
    (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean),
  )
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
  return true
}

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
  const length = parseLength(normalized)
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
  const length = parseLength(normalized)
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
  const length = parseLength(normalized)
  return length !== null && length.unit === "px"
}

const parseLetterSpacing = (value: string | undefined, inherited: number): number => {
  const normalized = value?.trim().toLowerCase()
  if (normalized === undefined || normalized === "inherit") return inherited
  if (normalized === "normal") return 0
  const length = parseLength(normalized)
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

const parseLength = (value: string | undefined): CSSLength | null => {
  if (
    !value ||
    value.trim().toLowerCase() === "auto" ||
    value.trim().toLowerCase() === "none"
  )
    return null
  const source = value.trim().toLowerCase()
  const numeric = Number.parseFloat(source)
  if (!Number.isFinite(numeric)) return null
  if (/^-?(?:\d+|\d*\.\d+)%$/.test(source))
    return Object.freeze({ unit: "percent", value: numeric })
  if (/^-?(?:\d+|\d*\.\d+)(?:px)?$/.test(source))
    return Object.freeze({ unit: "px", value: numeric })
  return null
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
  const source = value.trim().toLowerCase()
  if (!/^-?(?:\d+|\d*\.\d+)(?:px)?$/.test(source)) return fallback
  const numeric = Number.parseFloat(source)
  if (!Number.isFinite(numeric)) return fallback
  return allowNegative ? numeric : Math.max(0, numeric)
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
