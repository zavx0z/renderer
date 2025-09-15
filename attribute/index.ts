import type { Values } from "@zavx0z/context"
import type { Core, State } from "@zavx0z/template"
import { resolveValue, type Scope } from "../data"

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
