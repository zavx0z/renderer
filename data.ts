import type { Core } from "@zavx0z/template"
import type { Values } from "@zavx0z/context"

/**
 * Scope — скоуп текущей итерации map
 *
 * - item: текущий элемент массива
 * - index: индекс текущего элемента
 * - parent: скоуп родительской итерации (для путей с ../)
 */
export type Scope = { item: any; index: number; parent?: Scope }

/**
 * Собирает значения по путям из data
 * Возвращает массив значений в исходном порядке
 */
export const collect = (
  core: Core,
  context: Values<any>,
  state: string,
  data: string | string[],
  itemScope: Scope | undefined
) => {
  if (!data) return []
  if (typeof data === "string") data = [data]
  return data.map((path) => resolvePath(context, core, state, path, itemScope))
}

/**
 * Безопасный доступ по цепочке ключей/индексов
 */
export const getBySegments = (base: any, segments: (string | number)[]) => {
  let cur: any = base
  for (const s of segments) {
    if (cur == null) return undefined
    const key: any = typeof s === "string" && /^\d+$/.test(s) ? Number(s) : s
    cur = cur[key]
  }
  return cur
}
/**
 * Нормализует значение атрибута: если это объект вида { data },
 * резолвит путь и возвращает конкретное значение
 */
export const resolveValue = (
  context: Values<any>,
  core: Core,
  state: string,
  v: any,
  itemScope: Scope | undefined
): unknown => {
  if (v == null || typeof v !== "object") return v
  if ("data" in v && typeof v.data === "string") {
    return resolvePath(context, core, state, v.data, itemScope)
  }
  return v
}

/**
 * Резолвит строковую ссылку на значение (path → value) с учётом скоупа map
 * Возвращаемое: ссылка (для объектов/массивов/функций) или примитив (string/number/boolean/null)
 *
 * Поддержка путей:
 * - "../"          — подъём к родительскому скоупу (много уровней допустимо)
 * - "[item]"       — текущий элемент итерации
 * - "[item]/..."   — путь относительно текущего элемента
 * - "[index]"      — индекс текущего элемента
 * - "[index]/..."  — путь относительно объекта индекса (если индекс — объект)
 * - "/context/..." — доступ к контексту
 * - "/core/..."    — доступ к core
 * - "/state"       — текущее состояние
 */
export const resolvePath = (
  context: Values<any>,
  core: Core,
  state: string,
  path: string,
  itemScope: Scope | undefined
): any => {
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
    const baseScope = ascend(itemScope as any, levels)
    // Продолжаем обработку как обычного пути, но с подменённым scope
    return resolvePath(context, core, state, rest.startsWith("[item]") ? rest : rest, baseScope as any)
  }

  // Работа с текущим scope
  const scope: any = itemScope as any
  if (path === "[item]") return scope?.item ?? scope
  if (path === "[index]") return scope?.index
  if (path.startsWith("[item]/")) {
    const rest = path.slice(7)
    if (rest.startsWith("context/")) return getBySegments(context, rest.slice(8).split("/"))
    if (rest.startsWith("core/")) return getBySegments(core, rest.slice(5).split("/"))
    if (rest === "state") return state
    const base = scope?.item ?? scope
    if (base && typeof base === "object") return getBySegments(base, rest.split("/"))
    return undefined
  }
  if (path.startsWith("[index]/")) {
    const rest = path.slice(8)
    const base = scope?.index
    if (base && typeof base === "object") return getBySegments(base, rest.split("/"))
    return undefined
  }

  if (path.startsWith("/")) {
    const segments = path.replace(/^\//, "").split("/")
    const head = segments.shift()
    if (head === "context") return getBySegments(context, segments)
    if (head === "core") return getBySegments(core, segments)
    if (head === "state") return state
    return head
  }

  return undefined
}
