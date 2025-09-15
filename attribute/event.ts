import type { Update, Values } from "@zavx0z/context"
import type { Core, State } from "@zavx0z/template"
import { collect, type Scope } from "../data"

export const applyEvents = (
  context: Values<any>,
  update: Update<any>,
  core: Core,
  state: State,
  el: HTMLElement,
  evs: Record<string, any>,
  itemScope: Scope | undefined
) => {
  for (const [name, cfg] of Object.entries(evs)) {
    const handler = makeHandler(context, update, core, state, cfg, itemScope)
    if (handler) (el as any)[name] = handler
  }
}
export const makeHandler = (
  context: Values<any>,
  update: Update<any>,
  core: Core,
  state: State,
  cfg: { expr: string; data: string | string[] },
  itemScope: Scope | undefined
) => {
  const vals = collect(core, context, state, cfg.data, itemScope)
  let code = cfg.expr.replace(/\$\{\s*\[(\d+)\]\s*\}/g, "(__v[$1])")
  code = code.replace(/(?<!\\)\[(\d+)\]/g, "__v[$1]")
  const fn = new Function("update", "__v", "return (" + code + ")") as (
    update: Update<any>,
    __v: any[]
  ) => EventListener
  try {
    return fn(update, vals)
  } catch {
    return undefined
  }
}
