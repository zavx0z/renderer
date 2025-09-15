import type { Core } from "@zavx0z/template"
import type { Values } from "@zavx0z/context"

/**
 * Scope — скоуп текущей итерации map
 *
 * - item: текущий элемент массива
 * - index: индекс текущего элемента
 * - parent: скоуп родительской итерации (для путей с ../)
 */
export type Scope = { item: any; index: number; parent?: Scope; itemPath: string }

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
  return data.map((path) => {
    const abs = resolvePath(path, itemScope)
    return abs != null ? readByPath(abs, { context, core, state }) : undefined
  })
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
    const abs = resolvePath(v.data, itemScope)
    return abs != null ? readByPath(abs, { context, core, state }) : undefined
  }
  return v
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

/**
 * Объект данных
 */
export type Data = {
  context: Values<any>
  core: Core
  state: string
}

/**
 * Читает значение по абсолютному пути
 *
 * @throws {Error} если путь некорректен
 */
export const readByPath = (absPath: string, data: Data): any => {
  if (typeof absPath !== "string" || !absPath.startsWith("/")) throw new Error("Invalid path: " + absPath)
  const segments = absPath.replace(/^\//, "").split("/")
  const head = segments.shift()
  if (!head) throw new Error("Invalid path: " + absPath)
  return getBySegments((data as any)[head], segments)
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
