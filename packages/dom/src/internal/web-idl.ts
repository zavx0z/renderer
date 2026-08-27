export function toLong(value: number, bits = 32, unsigned = false): number {
  if (!Number.isFinite(value) || value === 0) return 0
  const integer = Math.trunc(value)
  const modulo = 2 ** bits
  const normalized = ((integer % modulo) + modulo) % modulo
  if (unsigned || normalized < modulo / 2) return normalized
  return normalized - modulo
}

export function parseHTMLInteger(value: string): number | null {
  const match = /^[\t\n\f\r ]*([+-]?\d+)/.exec(value)
  if (!match?.[1]) return null
  const parsed = Number(match[1])
  if (!Number.isFinite(parsed) || parsed < -2147483648 || parsed > 2147483647) return null
  return parsed
}
