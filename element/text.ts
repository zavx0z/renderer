import type { Core, State, NodeText } from "@zavx0z/template"
import type { Values } from "@zavx0z/context"
import { collect, type Scope } from "../data"

export const TextElement = (
  core: Core,
  context: Values<any>,
  state: State,
  node: NodeText,
  itemScope: Scope | undefined
): Text => {
  let string = ""
  if (typeof node.value === "string") string = node.value
  else if (node.expr) {
    const vals = collect(core, context, state, node.data!, itemScope)
    try {
      const body = node.expr.replace(/(_\[\d+\])/g, "clean($1)")
      const clean = (x: unknown) => (x == null ? "" : x)
      const fn = new Function("_", "clean", "return (`" + body + "`)")
      string = fn(vals, clean)
    } catch (error) {
      throw new Error(`Error evaluating expression: ${node.expr}`, { cause: error })
    }
  } else if (node.data) {
    const vals = collect(core, context, state, node.data, itemScope)
    if (Array.isArray(node.data)) {
      string = vals.map((v) => (v == null ? "" : String(v))).join("")
    } else {
      const v = vals[0]
      string = v == null ? "" : String(v)
    }
  }
  return document.createTextNode(string)
}
