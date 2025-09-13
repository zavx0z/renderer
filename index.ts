import type {
  Core,
  State,
  Node as NodeTemplate,
  NodeText,
  NodeLogical,
  NodeCondition,
  NodeMap,
  NodeElement,
} from "@zavx0z/template"
import type { Values, Update } from "@zavx0z/context"
import { collect, resolvePath } from "./data"
import { TextElement } from "./element/text"
import { Element } from "./element/element"
import { evalBool, evalCondition } from "./attribute"

/**
 * Renderer — универсальная реализация по протоколу @zavx0z/template
 */
export class Renderer {
  private target: HTMLElement
  private nodes: NodeTemplate[]
  private context: Values<any>
  private state: State
  private updateContext: Update<any>
  private core: Core

  constructor(
    target: HTMLElement,
    nodes: NodeTemplate[],
    context: Values<any>,
    update: Update<any>,
    state: State,
    core: Core
  ) {
    this.target = target
    this.nodes = Array.isArray(nodes) ? nodes : []
    this.context = context
    this.updateContext = update
    this.state = state
    this.core = core
    this.render()
  }

  update({ context, state }: { context?: Partial<Values<any>>; state?: State }) {
    if (context) this.context = Object.assign({}, this.context, context)
    if (state !== undefined) this.state = state
    this.render()
  }

  private render() {
    const frag = document.createDocumentFragment()
    for (const n of this.nodes) {
      const dom = this.toDOM(n, undefined)
      if (dom) frag.appendChild(dom)
    }
    this.target.replaceChildren(frag)
  }

  private toDOM(node: NodeTemplate, itemScope: NodeTemplate | undefined): Node | null {
    if (!node || typeof node !== "object") return null

    switch (node.type) {
      case "text":
        return TextElement(this.core, this.context, this.state, node, itemScope)
      case "el": {
        if (typeof node.tag !== "string") return null
        const el = Element(this.context, this.updateContext, this.core, this.state, node, itemScope)
        for (const c of node.child ?? []) {
          const dom = this.toDOM(c, itemScope)
          if (dom) el.appendChild(dom)
        }
        return el
      }
      case "cond": {
        const ok = evalCondition(this.context, this.core, this.state, node.data, node.expr, itemScope)
        const childIndex = ok ? 0 : 1
        const targetChild = node.child?.[childIndex]
        if (targetChild) {
          return this.toDOM(targetChild, itemScope)
        }
        return null
      }
      case "log": {
        const ok = evalBool(this.context, this.core, this.state, node, itemScope)
        if (ok) {
          const frag = document.createDocumentFragment()
          for (const c of node.child ?? []) {
            const dom = this.toDOM(c, itemScope)
            if (dom) frag.appendChild(dom)
          }
          return frag
        }
        return null
      }

      case "map": {
        const arr = resolvePath(this.context, this.core, this.state, node.data, itemScope)
        const frag = document.createDocumentFragment()
        if (Array.isArray(arr)) {
          for (const it of arr) {
            for (const c of node.child ?? []) {
              const dom = this.toDOM(c, it)
              if (dom) frag.appendChild(dom)
            }
          }
        }
        return frag
      }

      default:
        return null
    }
  }
}
