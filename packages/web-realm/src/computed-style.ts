import type {
  RendererCSSLength,
  RendererComputedStyle,
  RendererComputedTransformFunction,
} from "@zavx0z/renderer"
import {notSupported} from "./errors.ts"

const declarationValues = new WeakMap<
  WebRealmCSSStyleDeclaration,
  ReadonlyMap<string, string>
>()

/** Read-only CSSStyleDeclaration-compatible view of the renderer's supported subset. */
export class WebRealmCSSStyleDeclaration {
  constructor() {
    throw new TypeError("Illegal constructor")
  }

  get length(): number {
    return valuesFor(this).size
  }

  get cssText(): string {
    return [...valuesFor(this)]
      .map(([property, value]) => `${property}: ${value};`)
      .join(" ")
  }

  set cssText(_value: string) {
    throw readOnlyError()
  }

  item(index: number): string {
    if (!Number.isInteger(index) || index < 0) return ""
    return [...valuesFor(this).keys()][index] ?? ""
  }

  getPropertyValue(property: string): string {
    const normalized = normalizeProperty(property)
    const value = valuesFor(this).get(normalized)
    if (value === undefined) {
      throw notSupported(`Computed CSS property ${normalized || String(property)} is unsupported`)
    }
    return value
  }

  getPropertyPriority(property: string): string {
    this.getPropertyValue(property)
    return ""
  }

  setProperty(_property: string, _value: string | null, _priority = ""): void {
    throw readOnlyError()
  }

  removeProperty(_property: string): string {
    throw readOnlyError()
  }

  get display(): string { return this.getPropertyValue("display") }
  get position(): string { return this.getPropertyValue("position") }
  get width(): string { return this.getPropertyValue("width") }
  get height(): string { return this.getPropertyValue("height") }
  get color(): string { return this.getPropertyValue("color") }
  get backgroundColor(): string { return this.getPropertyValue("background-color") }
  get fontSize(): string { return this.getPropertyValue("font-size") }
  get lineHeight(): string { return this.getPropertyValue("line-height") }
  get letterSpacing(): string { return this.getPropertyValue("letter-spacing") }
  get opacity(): string { return this.getPropertyValue("opacity") }
  get overflowX(): string { return this.getPropertyValue("overflow-x") }
  get overflowY(): string { return this.getPropertyValue("overflow-y") }
  get transform(): string { return this.getPropertyValue("transform") }
  get transformOrigin(): string { return this.getPropertyValue("transform-origin") }
  get boxSizing(): string { return this.getPropertyValue("box-sizing") }
  get textAlign(): string { return this.getPropertyValue("text-align") }
  get whiteSpace(): string { return this.getPropertyValue("white-space") }
  get zIndex(): string { return this.getPropertyValue("z-index") }
}

export function createComputedStyleDeclaration(
  style: RendererComputedStyle,
): WebRealmCSSStyleDeclaration {
  const declaration = Object.create(
    WebRealmCSSStyleDeclaration.prototype,
  ) as WebRealmCSSStyleDeclaration
  declarationValues.set(declaration, serializeComputedStyle(style))
  return Object.freeze(declaration)
}

const serializeComputedStyle = (
  style: RendererComputedStyle,
): ReadonlyMap<string, string> => {
  const entries: Array<readonly [string, string]> = [
    ["display", style.display],
    ["box-sizing", style.boxSizing],
    ["position", style.position],
    ["left", length(style.left)],
    ["top", length(style.top)],
    ["right", length(style.right)],
    ["bottom", length(style.bottom)],
    ["width", length(style.width)],
    ["height", length(style.height)],
    ["min-width", length(style.minWidth)],
    ["min-height", length(style.minHeight)],
    ["max-width", length(style.maxWidth)],
    ["max-height", length(style.maxHeight)],
    ["margin-top", pixels(style.margin.top)],
    ["margin-right", pixels(style.margin.right)],
    ["margin-bottom", pixels(style.margin.bottom)],
    ["margin-left", pixels(style.margin.left)],
    ["padding-top", pixels(style.padding.top)],
    ["padding-right", pixels(style.padding.right)],
    ["padding-bottom", pixels(style.padding.bottom)],
    ["padding-left", pixels(style.padding.left)],
    ["border-top-width", pixels(style.borderWidths.top)],
    ["border-right-width", pixels(style.borderWidths.right)],
    ["border-bottom-width", pixels(style.borderWidths.bottom)],
    ["border-left-width", pixels(style.borderWidths.left)],
    ["border-top-color", style.borderColors.top],
    ["border-right-color", style.borderColors.right],
    ["border-bottom-color", style.borderColors.bottom],
    ["border-left-color", style.borderColors.left],
    ["border-top-left-radius", length(style.borderRadii.topLeft, "0px")],
    ["border-top-right-radius", length(style.borderRadii.topRight, "0px")],
    ["border-bottom-right-radius", length(style.borderRadii.bottomRight, "0px")],
    ["border-bottom-left-radius", length(style.borderRadii.bottomLeft, "0px")],
    ["background-color", style.background ?? "transparent"],
    ["color", style.color],
    ["font-size", pixels(style.fontSize)],
    ["line-height", lineHeight(style.lineHeight)],
    ["letter-spacing", pixels(style.letterSpacing)],
    ["opacity", number(style.opacity)],
    ["overflow-x", style.overflowX],
    ["overflow-y", style.overflowY],
    ["scrollbar-width", style.scrollbarWidth],
    ["object-fit", style.objectFit],
    ["text-align", style.textAlign],
    ["text-overflow", style.textOverflow],
    ["white-space", style.whiteSpace],
    ["z-index", style.zIndex === "auto" ? "auto" : number(style.zIndex)],
    ["flex-direction", style.flexDirection],
    ["flex-grow", number(style.flexGrow)],
    ["flex-shrink", number(style.flexShrink)],
    ["flex-basis", length(style.flexBasis)],
    ["align-items", style.alignItems],
    ["justify-content", style.justifyContent],
    ["gap", pixels(style.gap)],
    ["transform", transform(style.transform)],
    [
      "transform-origin",
      `${length(style.transformOrigin.x)} ${length(style.transformOrigin.y)}`,
    ],
    ["box-shadow", boxShadow(style.boxShadow)],
  ]
  return new Map(entries)
}

const valuesFor = (
  declaration: WebRealmCSSStyleDeclaration,
): ReadonlyMap<string, string> => {
  const values = declarationValues.get(declaration)
  if (!values) throw new TypeError("Illegal CSSStyleDeclaration receiver")
  return values
}

const normalizeProperty = (property: string): string =>
  String(property).trim().replace(/[A-Z]/g, character => `-${character.toLowerCase()}`).toLowerCase()

const number = (value: number): string => Object.is(value, -0) ? "0" : String(value)
const pixels = (value: number): string => `${number(value)}px`
const length = (value: RendererCSSLength | null, fallback = "auto"): string =>
  value === null
    ? fallback
    : value.unit === "px"
      ? pixels(value.value)
      : `${number(value.value)}%`

const lineHeight = (value: RendererComputedStyle["lineHeight"]): string =>
  value === "normal" ? value : value.kind === "length" ? pixels(value.value) : number(value.value)

const transform = (operations: readonly RendererComputedTransformFunction[]): string =>
  operations.length === 0
    ? "none"
    : operations.map(operation => operation.kind === "translate"
      ? `translate(${length(operation.x)}, ${length(operation.y)})`
      : `scale(${number(operation.x)}, ${number(operation.y)})`
    ).join(" ")

const boxShadow = (value: RendererComputedStyle["boxShadow"]): string =>
  value === null
    ? "none"
    : `${pixels(value.offsetX)} ${pixels(value.offsetY)} ${pixels(value.blurRadius)} ` +
      `${pixels(value.spreadRadius)} ${value.color}`

const readOnlyError = (): Error => {
  const error = new Error("Computed CSSStyleDeclaration is read-only")
  error.name = "NoModificationAllowedError"
  return error
}
