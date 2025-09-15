import type {
  Core,
  State,
  Node as NodeTemplate,
  NodeText,
  NodeLogical,
  NodeCondition,
  NodeMap,
  NodeElement,
  Params,
} from "@zavx0z/template"
import type { Values, Update, Context, Schema } from "@zavx0z/context"
import { collect, resolvePath } from "./data"
import { TextElement } from "./element/text"
import { Element } from "./element/element"
import { evalBool, evalCondition } from "./attribute"
import { parse } from "@zavx0z/template"

type RenderParams<C extends Schema, I extends Core = Core, S extends State = State> = {
  el: HTMLElement
  ctx: Context<C>
  st: { value: S }
  core: I
  tpl: (params: Params<Values<C>, I, S>) => void
}

export const render = <C extends Schema, I extends Core = Core, S extends State = State>({
  el,
  ctx,
  st,
  core,
  tpl,
}: RenderParams<C, I, S>) => {
  let prevState = st.value
  const nodes = parse<Values<C>, I, S>(tpl)
  const fragment = document.createDocumentFragment()

  const toDOM = (node: NodeTemplate, itemScope: NodeTemplate | undefined): Node | null => {
    if (!node || typeof node !== "object") return null

    switch (node.type) {
      case "text":
        return TextElement(core, ctx.context, st.value, node, itemScope)
      case "el": {
        if (typeof node.tag !== "string") return null
        const el = Element(ctx.context, ctx.update, core, st.value, node, itemScope)
        for (const c of node.child ?? []) {
          const dom = toDOM(c, itemScope)
          if (dom) el.appendChild(dom)
        }
        return el
      }
      case "cond": {
        const ok = evalCondition(ctx.context, core, st.value, node.data, node.expr, itemScope)
        const childIndex = ok ? 0 : 1
        const targetChild = node.child?.[childIndex]
        if (targetChild) {
          return toDOM(targetChild, itemScope)
        }
        return null
      }
      case "log": {
        const ok = evalBool(ctx.context, core, st.value, node, itemScope)
        if (ok) {
          const frag = document.createDocumentFragment()
          for (const c of node.child ?? []) {
            const dom = toDOM(c, itemScope)
            if (dom) frag.appendChild(dom)
          }
          return frag
        }
        return null
      }

      case "map": {
        const arr = resolvePath(ctx.context, core, st.value, node.data, itemScope)
        const frag = document.createDocumentFragment()
        if (Array.isArray(arr)) {
          for (const it of arr) {
            for (const c of node.child ?? []) {
              const dom = toDOM(c, it)
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

  for (const n of nodes) {
    const dom = toDOM(n, undefined)
    if (dom) fragment.appendChild(dom)
  }

  el.replaceChildren(fragment)

  ctx.onUpdate(() => {
    console.log(st.value)
    fragment.replaceChildren()
    for (const n of nodes) {
      const dom = toDOM(n, undefined)
      if (dom) fragment.appendChild(dom)
    }
    el.replaceChildren(fragment)
    prevState = st.value
  })
  return el
}
