import type { Core, State, Node as NodeTemplate, Params } from "@zavx0z/template"
import type { Values, Context, Schema } from "@zavx0z/context"
import { resolvePath, readByPath, type Scope, collect } from "./data"
import { evalCondition, evalText } from "./eval"
import { parse } from "@zavx0z/template"
import { applyAttributes } from "./attribute"
import { applyEvents } from "./attribute/event"

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
        const { value, expr, data } = node
        let result = ""
        if (value) result = value
        else if (expr && data) {
          const vals = collect(core, ctx.context, st.state, data, itemScope)
          try {
            const fn = evalText(expr)
            result = fn(vals)
          } catch (error) {
            console.error(`Error evaluating expression: ${expr}`, { cause: error })
          }
        } else if (typeof data === "string") {
          if (data === "[index]") {
            const idx = itemScope?.index
            result = idx == null ? "" : String(idx)
          } else {
            const path = resolvePath(data, itemScope)
            const v = path ? readByPath(path, { context: ctx.context, core, state: st.state }) : ""
            result = v == null ? "" : String(v)
          }
        }
        return document.createTextNode(result)
      case "el": {
        if (typeof node.tag !== "string") return null
        const { string, boolean, array, style, event, child } = node
        const el = document.createElement(node.tag)
        if (string) applyAttributes(ctx.context, core, st.state, el, string, itemScope)
        if (boolean) applyAttributes(ctx.context, core, st.state, el, boolean, itemScope)
        if (array) applyAttributes(ctx.context, core, st.state, el, array, itemScope)
        if (style) applyAttributes(ctx.context, core, st.state, el, style, itemScope)
        if (event) applyEvents(ctx.context, ctx.update, core, st.state, el, event, itemScope)

        if (!child) return el
        for (const c of child) {
          const dom = toDOM(c, itemScope)
          if (dom) el.appendChild(dom)
        }
        return el
      }
      case "cond":
      case "log": {
        const { expr, data, type, child } = node
        let values: any[] = []
        let result = false
        if (!expr && typeof data === "string") {
          const path = resolvePath(data, itemScope)
          result = Boolean(path ? readByPath(path, { context: ctx.context, core, state: st.state }) : false)
        } else if (expr && data) {
          if (data === "[index]") {
            const idx = itemScope?.index
            values = idx == null ? [] : [idx]
          } else values = collect(core, ctx.context, st.state, data, itemScope)
          try {
            const fn = evalCondition(expr)
            result = fn(values)
          } catch (error) {
            console.error(`Error evaluating expression: ${expr}`, { cause: error })
          }
        }
        if (type === "log") {
          if (result) {
            const frag = document.createDocumentFragment()
            for (const c of child) {
              const dom = toDOM(c, itemScope)
              if (dom) frag.appendChild(dom)
            }
            return frag
          }
        } else if (type === "cond") {
          const childIndex = result ? 0 : 1
          const targetChild = child![childIndex]
          if (targetChild) return toDOM(targetChild, itemScope)
        }
        return null
      }

      case "map": {
        const { data, child } = node
        const arrPath = resolvePath(data, itemScope)
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
            for (const c of child) {
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
