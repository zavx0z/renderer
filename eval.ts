import type { Values } from "@zavx0z/context"
import type { Core, State } from "@zavx0z/template"
import { type Scope, resolvePath, readByPath, collect } from "./data"

export const evalCondition = (
  context: Values<any>,
  core: Core,
  state: State,
  data: string | string[],
  expr: string | undefined,
  itemScope: Scope | undefined
) => {
  if (!expr && typeof data === "string") {
    const path = resolvePath(data, itemScope)
    return Boolean(path ? readByPath(path, { context, core, state }) : false)
  } else {
    const code = "return Boolean(" + expr + ");"
    try {
      const collectedData = collect(core, context, state, data, itemScope)
      const f = new Function("_", code)
      const result = f(collectedData)
      return result
    } catch {
      return false
    }
  }
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
