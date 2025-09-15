import type { Values } from "@zavx0z/context"
import type { Core, NodeLogical, State } from "@zavx0z/template"
import { collect, resolvePath, resolveValue, type Scope } from "../data"

export const applyAttributes = (
  context: Values<any>,
  core: Core,
  state: State,
  el: HTMLElement,
  attrs: Record<string, any>,
  itemScope: Scope | undefined
) => {
  for (const [attr, v] of Object.entries(attrs)) {
    const resolved = resolveValue(context, core, state, v, itemScope)
    if (resolved === false || resolved == null) continue
    if (attr === "class" && Array.isArray(resolved)) {
      el.setAttribute("class", resolved.filter(Boolean).join(" "))
    } else if (attr === "style" && typeof resolved === "object") {
      for (const [k, val] of Object.entries(resolved)) {
        el.style[k as any] = String(val)
      }
    } else if (resolved === true) {
      el.setAttribute(attr, "")
    } else {
      el.setAttribute(attr, String(resolved))
    }
  }
}

export const evalCondition = (
  context: Values<any>,
  core: Core,
  state: State,
  data: string | string[],
  expr: string | undefined,
  itemScope: Scope | undefined
) => {
  if (!expr && typeof data === "string") {
    return Boolean(resolvePath(context, core, state, data, itemScope))
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

export const evalBool = (
  context: Values<any>,
  core: Core,
  state: State,
  node: NodeLogical,
  itemScope: Scope | undefined
) => {
  return evalCondition(context, core, state, node.data, node.expr, itemScope)
}
