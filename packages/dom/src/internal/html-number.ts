const floatingPointPattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/
const floatingPointPrefix = /^[\t\n\f\r ]*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/

export function parseHTMLFloatingPointNumber(value: string): number | null {
  if (!floatingPointPattern.test(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? (Object.is(number, -0) ? 0 : number) : null
}

export function parseHTMLFloatingPointNumberPrefix(value: string): number | null {
  const match = floatingPointPrefix.exec(value)
  if (!match?.[1]) return null
  const number = Number(match[1])
  return Number.isFinite(number) ? (Object.is(number, -0) ? 0 : number) : null
}

export function serializeHTMLNumber(value: number): string {
  return String(Object.is(value, -0) ? 0 : value)
}

export function finiteHTMLNumber(value: number): number {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new TypeError("The value must be a finite number")
  return number
}
