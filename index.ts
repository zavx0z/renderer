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
import { collect } from "./data"
import { TextElement } from "./element/text"
import { Element } from "./element/element"
import { evalBool } from "./attribute"

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
        const arr = this.resolvePath(node.data, itemScope)
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

  private resolvePath(path: string, itemScope: NodeTemplate | undefined): any {
    if (path.startsWith("[item]/")) {
      const rest = path.slice(7)
      if (rest.startsWith("context/")) return this.getBySegments(this.context, rest.slice(8).split("/"))
      if (rest.startsWith("core/")) return this.getBySegments(this.core as any, rest.slice(5).split("/"))
      if (rest === "state") return this.state
      if (itemScope && typeof itemScope === "object") return (itemScope as any)[rest]
      return undefined
    }

    if (path.startsWith("/")) {
      const segments = path.replace(/^\//, "").split("/")
      const head = segments.shift()
      if (head === "context") return this.getBySegments(this.context, segments)
      if (head === "core") return this.getBySegments(this.core as any, segments)
      if (head === "state") return this.state
      if (/^x[0-9A-Fa-f]+$/.test(head!)) {
        const hex = head!.slice(1)
        const codePoint = parseInt(hex, 16)
        if (Number.isFinite(codePoint)) return String.fromCodePoint(codePoint)
      }
      return head
    }

    return undefined
  }

  private getBySegments(base: any, segments: (string | number)[]) {
    let cur: any = base
    for (const s of segments) {
      if (cur == null) return undefined
      const key: any = typeof s === "string" && /^\d+$/.test(s) ? Number(s) : s
      cur = cur[key]
    }
    return cur
  }
}
