import type { Values } from "@zavx0z/context"
import type { Core, NodeLogical, Node as NodeTemplate, State } from "@zavx0z/template"
import { collect, resolvePath, resolveValue } from "../data"

export const applyAttributes = (
  context: Values<any>,
  core: Core,
  state: State,
  el: HTMLElement,
  attrs: Record<string, any>,
  itemScope: NodeTemplate | undefined
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

export const evalBool = (
  context: Values<any>,
  core: Core,
  state: State,
  node: NodeLogical,
  itemScope: NodeTemplate | undefined
) => {
  if (!node.expr && typeof node.data === "string") {
    return Boolean(resolvePath(context, core, state, node.data, itemScope))
  } else {
    const code = "return Boolean(" + node.expr + ");"
    try {
      const data = collect(core, context, state, node.data, itemScope)
      const f = new Function("_", code)
      const result = f(data)
      return result
    } catch {
      return false
    }
  }
}
