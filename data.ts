import type { Core, Node as NodeTemplate } from "@zavx0z/template"
import type { Values } from "@zavx0z/context"

export const collect = (
  core: Core,
  context: Values<any>,
  state: string,
  data: string | string[],
  itemScope: NodeTemplate | undefined
) => {
  if (!data) return []
  if (typeof data === "string") data = [data]
  return data.map((path) => resolvePath(context, core, state, path, itemScope))
}

export const getBySegments = (base: any, segments: (string | number)[]) => {
  let cur: any = base
  for (const s of segments) {
    if (cur == null) return undefined
    const key: any = typeof s === "string" && /^\d+$/.test(s) ? Number(s) : s
    cur = cur[key]
  }
  return cur
}
export const resolveValue = (
  context: Values<any>,
  core: Core,
  state: string,
  v: any,
  itemScope: NodeTemplate | undefined
): unknown => {
  if (v == null || typeof v !== "object") return v
  if ("data" in v && typeof v.data === "string") {
    return resolvePath(context, core, state, v.data, itemScope)
  }
  return v
}
export const resolvePath = (
  context: Values<any>,
  core: Core,
  state: string,
  path: string,
  itemScope: NodeTemplate | undefined
): any => {
  if (path.startsWith("[item]/")) {
    const rest = path.slice(7)
    if (rest.startsWith("context/")) return getBySegments(context, rest.slice(8).split("/"))
    if (rest.startsWith("core/")) return getBySegments(core, rest.slice(5).split("/"))
    if (rest === "state") return state
    if (itemScope && typeof itemScope === "object") return (itemScope as any)[rest]
    return undefined
  }

  if (path.startsWith("/")) {
    const segments = path.replace(/^\//, "").split("/")
    const head = segments.shift()
    if (head === "context") return getBySegments(context, segments)
    if (head === "core") return getBySegments(core, segments)
    if (head === "state") return state
    if (/^x[0-9A-Fa-f]+$/.test(head!)) {
      const hex = head!.slice(1)
      const codePoint = parseInt(hex, 16)
      if (Number.isFinite(codePoint)) return String.fromCodePoint(codePoint)
    }
    return head
  }

  return undefined
}
