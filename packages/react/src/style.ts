/** Internal compiled style transport accepted by Template bindStyle slots. */
export type CompiledStyleValue =
  | string
  | false
  | null
  | undefined
  | readonly CompiledStyleValue[]

export type ResolvedStyleValue = Readonly<{
  cssText: string | null
  signature: string
}>

export function resolveStyleValue(value: CompiledStyleValue): ResolvedStyleValue {
  const fragments: string[] = []
  visitStyleValue(value, fragments)
  const cssText = fragments.length === 0 ? null : fragments.join("; ")
  return Object.freeze({
    cssText,
    signature: cssText ?? ""
  })
}

function visitStyleValue(value: CompiledStyleValue, fragments: string[]): void {
  if (value === null || value === undefined || value === false) return
  if (Array.isArray(value)) {
    for (const entry of value) visitStyleValue(entry, fragments)
    return
  }
  if (typeof value !== "string") {
    throw new TypeError(
      "A compiled style binding accepts CSS strings, false, null, undefined, or nested arrays"
    )
  }
  const cssText = value.trim().replace(/;+$/, "")
  if (cssText.length > 0) fragments.push(cssText)
}
