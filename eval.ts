import type { Values } from "@zavx0z/context"
import type { Core, State } from "@zavx0z/template"
import { type Scope, resolvePath, collect } from "./data"

export const evalCondition = (
  context: Values<any>,
  core: Core,
  state: State,
  data: string | string[],
  expr: string | undefined,
  itemScope: Scope | undefined
) => {
  if (!expr && typeof data === "string") {
    return Boolean(resolvePath(data, itemScope))
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
