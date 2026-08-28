const styleTokenBrand = Symbol("@zavx0z/react/style-token")

export type StylePrimitive = string | number | null | undefined

export type CSSProperties = Readonly<{
  alignItems?: StylePrimitive
  background?: StylePrimitive
  backgroundColor?: StylePrimitive
  border?: StylePrimitive
  borderBottom?: StylePrimitive
  borderBottomColor?: StylePrimitive
  borderBottomLeftRadius?: StylePrimitive
  borderBottomRightRadius?: StylePrimitive
  borderBottomWidth?: StylePrimitive
  borderColor?: StylePrimitive
  borderLeft?: StylePrimitive
  borderLeftColor?: StylePrimitive
  borderLeftWidth?: StylePrimitive
  borderRadius?: StylePrimitive
  borderRight?: StylePrimitive
  borderRightColor?: StylePrimitive
  borderRightWidth?: StylePrimitive
  borderTop?: StylePrimitive
  borderTopColor?: StylePrimitive
  borderTopLeftRadius?: StylePrimitive
  borderTopRightRadius?: StylePrimitive
  borderTopWidth?: StylePrimitive
  borderWidth?: StylePrimitive
  bottom?: StylePrimitive
  boxShadow?: StylePrimitive
  boxSizing?: StylePrimitive
  color?: StylePrimitive
  display?: StylePrimitive
  flex?: StylePrimitive
  flexBasis?: StylePrimitive
  flexDirection?: StylePrimitive
  flexGrow?: StylePrimitive
  flexShrink?: StylePrimitive
  fontSize?: StylePrimitive
  fontWeight?: StylePrimitive
  gap?: StylePrimitive
  height?: StylePrimitive
  justifyContent?: StylePrimitive
  left?: StylePrimitive
  letterSpacing?: StylePrimitive
  lineHeight?: StylePrimitive
  margin?: StylePrimitive
  marginBottom?: StylePrimitive
  marginLeft?: StylePrimitive
  marginRight?: StylePrimitive
  marginTop?: StylePrimitive
  maxHeight?: StylePrimitive
  maxWidth?: StylePrimitive
  minHeight?: StylePrimitive
  minWidth?: StylePrimitive
  objectFit?: StylePrimitive
  opacity?: StylePrimitive
  overflow?: StylePrimitive
  overflowX?: StylePrimitive
  overflowY?: StylePrimitive
  padding?: StylePrimitive
  paddingBottom?: StylePrimitive
  paddingLeft?: StylePrimitive
  paddingRight?: StylePrimitive
  paddingTop?: StylePrimitive
  position?: StylePrimitive
  right?: StylePrimitive
  scrollbarWidth?: StylePrimitive
  textAlign?: StylePrimitive
  textOverflow?: StylePrimitive
  top?: StylePrimitive
  transform?: StylePrimitive
  transformOrigin?: StylePrimitive
  whiteSpace?: StylePrimitive
  width?: StylePrimitive
  zIndex?: StylePrimitive
} & Readonly<Record<`--${string}`, StylePrimitive>>>

export type SupportedStylePseudo =
  | ":active"
  | ":checked"
  | ":disabled"
  | ":focus"
  | ":focus-within"
  | ":hover"
  | ":indeterminate"

export type ComponentStyleDefinition = CSSProperties & Readonly<
  Partial<Record<SupportedStylePseudo, CSSProperties>>
>

export interface StyleToken {
  readonly attributeName: `data-z-${string}`
  readonly cssText: string
  readonly displayName: string
  readonly [styleTokenBrand]: true
}

export type ComponentStyleSheet<Part extends string> = Readonly<
  Record<Part, StyleToken> & {
    cssText: string
    displayName: string
    tokens: readonly StyleToken[]
  }
>

export type StyleValue =
  | CSSProperties
  | StyleToken
  | string
  | false
  | null
  | undefined
  | readonly StyleValue[]

export type ResolvedStyleValue = Readonly<{
  attributes: readonly `data-z-${string}`[]
  cssText: string | null
  signature: string
}>

const supportedPseudoSet: ReadonlySet<string> = new Set<SupportedStylePseudo>([
  ":active",
  ":checked",
  ":disabled",
  ":focus",
  ":focus-within",
  ":hover",
  ":indeterminate"
])

export function defineStyles<const Part extends string>(
  displayName: string,
  definitions: Readonly<Record<Part, ComponentStyleDefinition>>
): ComponentStyleSheet<Part> {
  const name = String(displayName).trim()
  if (name.length === 0) throw new TypeError("defineStyles requires a stable display name")
  if (!definitions || typeof definitions !== "object" || Array.isArray(definitions)) {
    throw new TypeError("defineStyles requires a part definition object")
  }

  const result: Record<string, unknown> = Object.create(null)
  const tokens: StyleToken[] = []
  const css: string[] = []
  for (const [part, definition] of Object.entries(definitions)) {
    if (part.length === 0) throw new TypeError("A style part name cannot be empty")
    const rules = normalizeDefinition(definition, `${name}.${part}`)
    const signature = `${name}\u0000${part}\u0000${rules.map(rule => `${rule.pseudo}\u0000${rule.cssText}`).join("\u0001")}`
    const attributeName = `data-z-${stableHash(signature)}` as const
    const tokenCss = rules
      .filter(rule => rule.cssText.length > 0)
      .map(rule => `[${attributeName}]${rule.pseudo}{${rule.cssText}}`)
      .join("\n")
    const token: StyleToken = Object.freeze({
      [styleTokenBrand]: true as const,
      attributeName,
      cssText: tokenCss,
      displayName: `${name}.${part}`
    })
    result[part] = token
    tokens.push(token)
    if (tokenCss.length > 0) css.push(tokenCss)
  }

  Object.defineProperties(result, {
    cssText: {enumerable: false, value: css.join("\n")},
    displayName: {enumerable: false, value: name},
    tokens: {enumerable: false, value: Object.freeze(tokens)}
  })
  return Object.freeze(result) as ComponentStyleSheet<Part>
}

export function isStyleToken(value: unknown): value is StyleToken {
  return !!value && typeof value === "object" &&
    (value as Partial<StyleToken>)[styleTokenBrand] === true
}

export function resolveStyleValue(value: StyleValue): ResolvedStyleValue {
  const attributes: `data-z-${string}`[] = []
  const seenAttributes = new Set<string>()
  const inline: string[] = []
  visitStyleValue(value, attributes, seenAttributes, inline)
  const cssText = inline.length === 0 ? null : inline.join("; ")
  return Object.freeze({
    attributes: Object.freeze(attributes),
    cssText,
    signature: `${attributes.join("\u0000")}\u0001${cssText ?? ""}`
  })
}

type NormalizedRule = Readonly<{pseudo: "" | SupportedStylePseudo; cssText: string}>

function normalizeDefinition(value: unknown, owner: string): readonly NormalizedRule[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${owner} must be a style object`)
  }
  const base: Record<string, StylePrimitive> = Object.create(null)
  const pseudos: Partial<Record<SupportedStylePseudo, CSSProperties>> = Object.create(null)
  const pseudoOrder: SupportedStylePseudo[] = []
  for (const [property, propertyValue] of Object.entries(value)) {
    if (property.startsWith(":")) {
      if (!supportedPseudoSet.has(property)) {
        throw new TypeError(`${owner} uses unsupported pseudo ${property}`)
      }
      if (!propertyValue || typeof propertyValue !== "object" || Array.isArray(propertyValue)) {
        throw new TypeError(`${owner}${property} must be a declaration object`)
      }
      const pseudo = property as SupportedStylePseudo
      pseudos[pseudo] = propertyValue as CSSProperties
      pseudoOrder.push(pseudo)
      continue
    }
    base[property] = propertyValue as StylePrimitive
  }
  const rules: NormalizedRule[] = [{pseudo: "", cssText: serializeDeclarations(base, owner, true)}]
  for (const pseudo of pseudoOrder) {
    const declarations = pseudos[pseudo]
    if (declarations) {
      rules.push({
        pseudo,
        cssText: serializeDeclarations(declarations, `${owner}${pseudo}`, true)
      })
    }
  }
  return Object.freeze(rules.map(rule => Object.freeze(rule)))
}

function visitStyleValue(
  value: StyleValue,
  attributes: `data-z-${string}`[],
  seenAttributes: Set<string>,
  inline: string[]
): void {
  if (value === null || value === undefined || value === false) return
  if (Array.isArray(value)) {
    for (const entry of value) visitStyleValue(entry, attributes, seenAttributes, inline)
    return
  }
  if (isStyleToken(value)) {
    if (!seenAttributes.has(value.attributeName)) {
      seenAttributes.add(value.attributeName)
      attributes.push(value.attributeName)
    }
    return
  }
  if (typeof value === "string") {
    const cssText = value.trim().replace(/;+$/, "")
    if (cssText.length > 0) inline.push(cssText)
    return
  }
  if (typeof value !== "object") {
    throw new TypeError("A style value must be a style token, declaration object, string, array, or null")
  }
  for (const property of Object.keys(value)) {
    if (property.startsWith(":")) {
      throw new TypeError("Dynamic pseudo styles require a defineStyles token")
    }
  }
  const cssText = serializeDeclarations(value as CSSProperties, "style", false)
  if (cssText.length > 0) inline.push(cssText)
}

function serializeDeclarations(value: CSSProperties, owner: string, compact: boolean): string {
  const declarations: string[] = []
  for (const [sourceName, sourceValue] of Object.entries(value)) {
    if (sourceName.startsWith(":")) throw new TypeError(`${owner} cannot nest ${sourceName}`)
    if (sourceValue === null || sourceValue === undefined || sourceValue === "") continue
    if (typeof sourceValue !== "string" && typeof sourceValue !== "number") {
      throw new TypeError(`${owner}.${sourceName} has an unsupported style value`)
    }
    const property = sourceName.startsWith("--") ? sourceName : kebabCase(sourceName)
    const customProperty = property.startsWith("--")
    const serialized = typeof sourceValue === "number" && sourceValue !== 0 &&
      !customProperty && !unitless(property)
        ? `${sourceValue}px`
        : String(sourceValue)
    declarations.push(compact ? `${property}:${serialized}` : `${property}: ${serialized}`)
  }
  return declarations.join(compact ? ";" : "; ")
}

function kebabCase(value: string): string {
  if (!/^-?(?:[a-z][a-zA-Z0-9]*|[a-z][a-z0-9-]*)$/.test(value)) {
    throw new TypeError(`Invalid style property ${value}`)
  }
  return value.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`)
}

function unitless(property: string): boolean {
  return property === "flex" || property === "opacity" || property === "z-index" || property === "line-height" ||
    property === "flex-grow" || property === "flex-shrink" || property === "font-weight"
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}
