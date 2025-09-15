import type { Core, State, NodeElement } from "@zavx0z/template"
import type { Update, Values } from "@zavx0z/context"
import type { Scope } from "../data"
import { applyAttributes } from "../attribute"
import { applyEvents } from "../attribute/event"

export const Element = (
  context: Values<any>,
  update: Update<any>,
  core: Core,
  state: State,
  node: NodeElement,
  itemScope: Scope | undefined
): Element => {
  const el = document.createElement(node.tag)
  if (node.string) applyAttributes(context, core, state, el, node.string, itemScope)
  if (node.boolean) applyAttributes(context, core, state, el, node.boolean, itemScope)
  if (node.array) applyAttributes(context, core, state, el, node.array, itemScope)
  if (node.style) applyAttributes(context, core, state, el, node.style, itemScope)
  if (node.event) applyEvents(context, update, core, state, el, node.event, itemScope)
  return el
}
