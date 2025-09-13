import type { Core, Node as NodeTemplate } from "@zavx0z/template"
import type { Values } from "@zavx0z/context"

export const collect = (
  core: Core,
  context: Values<any>,
  state: string,
  data: any,
  itemScope: NodeTemplate | undefined
) => {
  if (!data) return []
  const vars: any[] = []
  for (const path of data) {
    if (path === "/state") {
      vars.push(state)
    } else if (path.startsWith("/context/")) {
      const target = path.split("/").slice(-1)[0]
      vars.push(context[target])
    } else if (path.startsWith("/core/")) {
      let target = core
      const segments = path.split("/").slice(1)
      for (const segment of segments) target = target[segment]
      vars.push(target)
    } else {
      vars.push(resolvePath(path, itemScope))
    }
  }
  return vars
}

export const resolvePath = (path: string, itemScope: NodeTemplate | undefined) => {
  if (path.startsWith("[item]/")) {
    const rest = path.slice(7)
    // if (rest.startsWith("context/")) return getBySegments(this.context, rest.slice(8).split("/"))
    // if (rest.startsWith("core/")) return getBySegments(this.core as any, rest.slice(5).split("/"))
    // if (rest === "state") return this.state
    if (itemScope && typeof itemScope === "object") return (itemScope as any)[rest]
    return undefined
  }
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
