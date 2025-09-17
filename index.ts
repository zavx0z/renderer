import type {
  Core,
  State,
  Node as NodeTemplate,
  Params,
  ValueStatic,
  ValueDynamic,
  ValueVariable,
} from "@zavx0z/template"
import type { Values, Context, Schema, Update } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
/**
 * Scope — скоуп текущей итерации map
 *
 * - item: текущий элемент массива
 * - index: индекс текущего элемента
 * - parent: скоуп родительской итерации (для путей с ../)
 */
export type Scope = { item: any; index: number; parent?: Scope; itemPath: string }
type RenderParams<C extends Schema, I extends Core = Core, S extends State = State> = {
  el: HTMLElement
  ctx: Context<C>
  st: { state: S; states: readonly S[] }
  core: I
  tpl: (params: Params<Values<C>, I, S>) => void
}
const isStaticValue = (value: ValueStatic | ValueDynamic | ValueVariable | boolean) =>
  typeof value === "string" || typeof value === "boolean" || typeof value === "number" || typeof value === "symbol"
const isDynamicValue = (value: ValueStatic | ValueDynamic | ValueVariable | boolean) =>
  typeof value === "object" && "expr" in value
const isVariableValue = (value: ValueStatic | ValueDynamic | ValueVariable | boolean) =>
  typeof value === "object" && "data" in value && typeof value.data === "string" && !Object.hasOwn(value, "expr")

const getBySegments = (base: any, segments: (string | number)[]) => {
  let cur: any = base
  for (const s of segments) {
    if (cur == null) return undefined
    const key: any = typeof s === "string" && /^\d+$/.test(s) ? Number(s) : s
    cur = cur[key]
  }
  return cur
}

export const render = <C extends Schema, I extends Core = Core, S extends State = State>({
  el,
  ctx,
  st,
  core,
  tpl,
}: RenderParams<C, I, S>) => {
  let prevState = st.state
  const nodes = parse<Values<C>, I, S>(tpl)
  const fragment = document.createDocumentFragment()

  const toDOM = (node: NodeTemplate, itemScope: Scope | undefined): Node | null => {
    if (!node || typeof node !== "object") return null

    const collect = (data: string | string[]) => {
      if (!data) return []
      if (typeof data === "string") data = [data]
      return data.map((path) => {
        const abs = resolvePath(path, itemScope)
        return abs != null ? readByPath(abs) : undefined
      })
    }

    const readByPath = (absPath: string): any => {
      if (typeof absPath !== "string" || !absPath.startsWith("/")) {
        console.error("Invalid path: " + absPath)
        return
      }
      const segments = absPath.replace(/^\//, "").split("/")
      const head = segments.shift()
      if (!head) {
        console.error("Invalid path: " + absPath)
        return
      }
      return getBySegments(
        {
          context: ctx.context,
          core: core,
          state: st.state,
        }[head],
        segments
      )
    }

    switch (node.type) {
      case "text":
        const { value, expr, data } = node
        let result = ""
        if (value) result = value
        else if (expr && data) {
          const vals = collect(data)
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
            const v = path ? readByPath(path) : ""
            result = v == null ? "" : String(v)
          }
        }
        return document.createTextNode(result)
      case "el": {
        if (typeof node.tag !== "string") return null
        const { string, boolean, array, style, event, child } = node
        const el = document.createElement(node.tag)
        if (string) {
          for (const [attr, declare] of Object.entries(string)) {
            if (isStaticValue(declare)) {
              el.setAttribute(attr, String(declare))
            } else if (isDynamicValue(declare)) {
              const { expr, data } = declare
              const vals = collect(data)
              try {
                const result = evalText(expr)(vals)
                el.setAttribute(attr, String(result))
              } catch (error) {
                console.error(`Error evaluating expression: ${expr}`, { cause: error })
              }
            } else if (isVariableValue(declare)) {
              const { data } = declare
              const path = resolvePath(data, itemScope)
              const v = path ? readByPath(path) : ""
              el.setAttribute(attr, String(v))
            }
          }
        }
        if (boolean) {
          for (const [attr, declare] of Object.entries(boolean)) {
            if (isStaticValue(declare)) {
              el.setAttribute(attr, String(declare))
            } else if (isDynamicValue(declare)) {
              const { expr, data } = declare
              const vals = collect(data)
              try {
                const result = evalCondition(expr)(vals)
                el.setAttribute(attr, String(result))
              } catch (error) {
                console.error(`Error evaluating expression: ${expr}`, { cause: error })
              }
            } else if (isVariableValue(declare)) {
              const { data } = declare
              const path = resolvePath(data, itemScope)
              const v = path ? readByPath(path) : ""
              el.setAttribute(attr, String(v))
            }
          }
        }
        if (array) {
          for (const [attr, declares] of Object.entries(array)) {
            let result: any[] = []
            for (const declare of declares) {
              let value: any
              if (isStaticValue(declare)) {
                value = declare
              } else if (isDynamicValue(declare)) {
                const { expr, data } = declare
                const vals = collect(data)
                try {
                  value = evalText(expr)(vals)
                } catch (error) {
                  console.error(`Error evaluating expression: ${expr}`, { cause: error })
                }
              } else if (isVariableValue(declare)) {
                const { data } = declare
                const path = resolvePath(data, itemScope)
                const v = path ? readByPath(path) : ""
                value = v
              }
              if (value == null) continue
              result.push(value)
            }
            el.setAttribute(attr, String(result))
          }
        }
        if (style) {
          let style: string = ""
          for (const [attr, declare] of Object.entries(style)) {
            let value: any
            if (isStaticValue(declare)) {
              value = declare
            } else if (isDynamicValue(declare)) {
              const { expr, data } = declare
              const vals = collect(data)
              try {
                value = evalText(expr)(vals)
              } catch (error) {
                console.error(`Error evaluating expression: ${expr}`, { cause: error })
              }
            } else if (isVariableValue(declare)) {
              const { data } = declare
              const path = resolvePath(data, itemScope)
              const v = path ? readByPath(path) : ""
              value = v
            }
            if (value == null) continue
            style += `${attr.replace(/([A-Z])/g, "-$1").toLowerCase()}:${value};`
          }
          el.setAttribute("style", style)
        }
        if (event) {
          for (const [name, declare] of Object.entries(event)) {
            const { data, expr, upd } = declare as any
            const vals = collect(data)
            let code = expr.replace(/\$\{\s*\[(\d+)\]\s*\}/g, "(__v[$1])")
            code = code.replace(/(?<!\\)\[(\d+)\]/g, "__v[$1]")
            const fn = new Function("update", "__v", "return (" + code + ")") as (
              update: Update<any>,
              __v: any[]
            ) => EventListener
            try {
              const handler = fn(ctx.update, vals)
              if (handler) el.addEventListener(name, handler)
            } catch (error) {
              console.error(`Error evaluating expression: ${expr}`, { cause: error })
            }
          }
        }

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
          result = Boolean(path ? readByPath(path) : false)
        } else if (expr && data) {
          if (data === "[index]") {
            const idx = itemScope?.index
            values = idx == null ? [] : [idx]
          } else values = collect(data)
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
        const arr = arrPath != null ? readByPath(arrPath) : undefined
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
const BOOLEAN_CACHE = new Map<string, Function>()

export const evalCondition = (expr: string) => {
  const cached = BOOLEAN_CACHE.get(expr)
  if (cached) return cached
  const compiled = new Function("_", "return Boolean(" + expr + ");")
  BOOLEAN_CACHE.set(expr, compiled)
  return compiled
}

type EvalTextFn = (values: (string | number | boolean | null | undefined)[]) => string

const CACHE = new Map<string, EvalTextFn>()

/**
 * Компилирует expr в функцию вида (values) => string
 * Все вхождения _[i] получают nullish-fallback: ( _[i] ?? "" )
 */
export const evalText = (expr: string): EvalTextFn => {
  const cached = CACHE.get(expr)
  if (cached) return cached
  const body = expr.replace(/(_\[\d+\])/g, '($1 ?? "")')
  const compiled = new Function("_", `return (\`${body}\`)`) as EvalTextFn
  CACHE.set(expr, compiled)
  return compiled
}
/**
 * Преобразует относительный путь в абсолютный (path → absPath), без чтения данных.
 * Работает на уровне строк и учитывает текущий Scope (в т.ч. parent цепочку).
 *
 * Поддерживаемые формы входного пути:
 * - "../"          — подъём на уровни к родительскому скоупу
 * - "[item]"       — ссылка на текущий элемент map (превращается в absPath элемента)
 * - "[item]/..."   — путь относительно текущего элемента map
 * - "/context/..." — абсолютный путь в context
 * - "/core/..."    — абсолютный путь в core
 * - "/state"       — абсолютный путь к состоянию
 *
 * Возвращает: абсолютный путь-строку вида "/context/...", "/core/..." или "/state"
 */
export const resolvePath = (path: string, itemScope: Scope | undefined): string | undefined => {
  // поддержка относительных путей к родительскому scope через ../
  const ascend = (scope: any, levels: number) => {
    let cur = scope
    while (levels > 0 && cur && typeof cur === "object") {
      cur = cur.parent
      levels--
    }
    return cur
  }

  // Если путь начинается с последовательности ../ — поднимаемся по родителям
  if (path.startsWith("../")) {
    const levels = (path.match(/^(?:\.\.\/)+/g)?.[0]?.length ?? 0) / 3
    const rest = path.replace(/^(?:\.\.\/)+/, "")
    const baseScope = ascend(itemScope, levels)
    // Продолжаем обработку как обычного пути, но с подменённым scope
    return resolvePath(rest, baseScope)
  }

  // Работа с текущим scope
  const scope = itemScope
  if (path === "[item]") return scope?.itemPath
  if (path === "[index]") return undefined
  if (path.startsWith("[item]/")) {
    const rest = path.slice(7)
    if (!scope?.itemPath) return undefined
    if (rest === "state") return "/state"
    if (rest.startsWith("context/")) return "/" + rest
    if (rest.startsWith("core/")) return "/" + rest
    return scope.itemPath + "/" + rest
  }
  if (path.startsWith("[index]/")) {
    return undefined
  }

  if (path.startsWith("/")) {
    const segments = path.replace(/^\//, "").split("/")
    const head = segments.shift()
    if (head === "context" || head === "core") return "/" + [head, ...segments].join("/")
    if (head === "state") return "/state"
    return head ? "/" + head : undefined
  }

  return undefined
}
