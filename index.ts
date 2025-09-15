import type { Core, State, Node as NodeTemplate, Params } from "@zavx0z/template"
import type { Values, Context, Schema } from "@zavx0z/context"
import { resolvePath, readByPath, type Scope } from "./data"
import { TextElement } from "./element/text"
import { Element } from "./element/element"
import { evalCondition } from "./eval"
import { parse } from "@zavx0z/template"

type RenderParams<C extends Schema, I extends Core = Core, S extends State = State> = {
  el: HTMLElement
  ctx: Context<C>
  st: { state: S; states: readonly S[] }
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
  const data = {
    context: ctx.context,
    core: core,
    state: st.state,
  }

  let prevState = st.state
  const nodes = parse<Values<C>, I, S>(tpl)
  const fragment = document.createDocumentFragment()

  const toDOM = (node: NodeTemplate, itemScope: Scope | undefined): Node | null => {
    if (!node || typeof node !== "object") return null

    switch (node.type) {
      case "text":
        return TextElement(core, ctx.context, st.state, node, itemScope)
      case "el": {
        if (typeof node.tag !== "string") return null
        const el = Element(ctx.context, ctx.update, core, st.state, node, itemScope)
        for (const c of node.child ?? []) {
          const dom = toDOM(c, itemScope)
          if (dom) el.appendChild(dom)
        }
        return el
      }
      case "cond": {
        const ok = evalCondition(ctx.context, core, st.state, node.data, node.expr, itemScope)
        const childIndex = ok ? 0 : 1
        const targetChild = node.child?.[childIndex]
        if (targetChild) {
          return toDOM(targetChild, itemScope)
        }
        return null
      }
      case "log": {
        const ok = evalCondition(ctx.context, core, st.state, node.data, node.expr, itemScope)
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
        const arrPath = resolvePath(node.data, itemScope)
        const arr = arrPath != null ? readByPath(arrPath, { context: ctx.context, core, state: st.state }) : undefined
        const frag = document.createDocumentFragment()
        if (Array.isArray(arr)) {
          arr.forEach((item, index) => {
            const itemPath = (arrPath as string) + "/" + String(index)
            const scope = {
              item,
              index,
              parent: itemScope,
              itemPath,
            }
            for (const c of node.child ?? []) {
              const dom = toDOM(c, scope as any)
              if (dom) frag.appendChild(dom)
            }
          })
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
    console.log(st.state)
    fragment.replaceChildren()
    for (const n of nodes) {
      const dom = toDOM(n, undefined)
      if (dom) fragment.appendChild(dom)
    }
    el.replaceChildren(fragment)
    prevState = st.state
  })
  return el
}
