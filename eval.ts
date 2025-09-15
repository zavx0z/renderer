const BOOLEAN_CACHE = new Map<string, Function>()

export const evalCondition = (expr: string) => {
  const cached = BOOLEAN_CACHE.get(expr)
  if (cached) return cached
  const compiled = new Function("_", "return Boolean(" + expr + ");")
  BOOLEAN_CACHE.set(expr, compiled)
  return compiled
}

type Value = string | number | boolean | null | undefined
type EvalTextFn = (values: Value[]) => string

const CACHE = new Map<string, EvalTextFn>()

/**
 * Компилирует expr в функцию вида (values) => string
 * Все вхождения _[i] получают nullish-fallback: ( _[i] ?? "" )
 */
export const evalText = (expr: string): EvalTextFn => {
  const cached = CACHE.get(expr)
  if (cached) return cached
  const body = expr.replace(/(_\[\d+\])/g, '($1 ?? "")')
  const compiled = new Function("_", `return (\`${body}\`)`) as EvalTextFn
  CACHE.set(expr, compiled)
  return compiled
}
