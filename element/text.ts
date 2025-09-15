import type { Core, State, NodeText } from "@zavx0z/template"
import type { Values } from "@zavx0z/context"
import { resolvePath, readByPath, collect, type Scope } from "../data"
import { evalText } from "../eval"

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
      const fn = evalText(node.expr)
      string = fn(vals)
    } catch (error) {
      throw new Error(`Error evaluating expression: ${node.expr}`, { cause: error })
    }
  } else if (typeof node.data === "string") {
    const path = resolvePath(node.data, itemScope)
    string = path ? readByPath(path, { context, core, state }) : ""
  }
  const textEl = document.createTextNode(string)
  return textEl
}
