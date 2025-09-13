import type { Core, State, Node as NodeTemplate, NodeText } from "@zavx0z/template"
import type { Values } from "@zavx0z/context"
import { collect } from "../data"

export const TextElement = (
  core: Core,
  context: Values<any>,
  state: State,
  node: NodeText,
  itemScope: NodeTemplate | undefined
): Text => {
  let string = ""
  if (typeof node.value === "string") string = node.value
  else if (node.expr) {
    const vals = collect(core, context, state, node.data, itemScope)
    try {
      const body = node.expr.replace(/(_\[\d+\])/g, "clean($1)")
      const clean = (x: any) => (x == null ? "" : x)
      const fn = new Function("_", "clean", "return (`" + body + "`)")
      string = fn(vals, clean)
    } catch (error) {
      throw new Error(`Error evaluating expression: ${node.expr}`, { cause: error })
    }
  }
  return document.createTextNode(string)
}
