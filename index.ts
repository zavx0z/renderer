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
        const el = document.createElement(node.tag)

        if (node.string) this.applyAttributes(el, node.string, itemScope)
        if (node.event) this.applyEvents(el, node.event, itemScope)

        for (const c of node.child ?? []) {
          const dom = this.toDOM(c, itemScope)
          if (dom) el.appendChild(dom)
        }
        return el
      }

      case "log": {
        const ok = this.evalBool(
          node.expr ?? "false",
          collect(this.core, this.context, this.state, node.data, itemScope)
        )
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

  private applyAttributes(el: HTMLElement, attrs: Record<string, any>, itemScope: NodeTemplate | undefined) {
    for (const [attr, v] of Object.entries(attrs)) {
      const resolved = this.resolveValue(v, itemScope)
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

  private applyEvents(el: HTMLElement, evs: Record<string, any>, itemScope: NodeTemplate | undefined) {
    for (const [name, cfg] of Object.entries(evs)) {
      const handler = this.makeHandler(cfg, itemScope)
      if (handler) (el as any)[name] = handler
    }
  }

  private makeHandler(cfg: { expr: string; data?: any[] }, itemScope: NodeTemplate | undefined) {
    const vals = collect(this.core, this.context, this.state, cfg.data, itemScope)
    let code = cfg.expr.replace(/\$\{\s*\[(\d+)\]\s*\}/g, "(__v[$1])")
    code = code.replace(/(?<!\\)\[(\d+)\]/g, "__v[$1]")
    const fn = new Function("update", "__v", "return (" + code + ")") as (
      update: Update<any>,
      __v: any[]
    ) => EventListener
    try {
      return fn(this.updateContext, vals)
    } catch {
      return undefined
    }
  }

  private evalBool(expr: string, vals: any[]) {
    let body = expr
    body = body.replace(/"\s*\$\{\s*\[(\d+)\]\s*\}\s*"/g, "JSON.stringify(__v[$1])")
    body = body.replace(/\$\{\s*\[(\d+)\]\s*\}/g, "(__v[$1])")
    body = body.replace(/(?<!\\)\[(\d+)\]/g, "__v[$1]")
    const code = "return (" + body + ");"
    try {
      const f = new Function("__v", code) as (__v: any[]) => unknown
      return Boolean(f(vals))
    } catch {
      return false
    }
  }

  private resolveValue(v: any, itemScope: any): unknown {
    if (v == null || typeof v !== "object") return v
    if ("data" in v && typeof v.data === "string") {
      return this.resolvePath(v.data, itemScope)
    }
    return v
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
