import type { Node as TemplateNode } from "@zavx0z/template"

export type RenderEvent = (...args: any[]) => unknown
export type ResolvedStyleLeaf = string | number | boolean | symbol

export interface ResolvedStyle {
  readonly [property: string]: ResolvedStyleLeaf | ResolvedStyle
}

export interface ResolvedAttributes {
  readonly string: Readonly<Record<string, string>>
  readonly boolean: Readonly<Record<string, boolean>>
  readonly array: Readonly<Record<string, readonly unknown[]>>
  readonly style?: ResolvedStyle
  readonly event: Readonly<Record<string, RenderEvent>>
}

export interface ResolvedText {
  readonly type: "text"
  readonly value: string
}

export interface ResolvedElement {
  readonly type: "element"
  readonly templateType: "el" | "meta"
  readonly tag: string
  readonly attributes: ResolvedAttributes
  /** Opaque legacy payload. Its identity is retained and it is not frozen by the renderer. */
  readonly core?: unknown
  readonly children: ResolvedTree
}

export type ResolvedNode = ResolvedText | ResolvedElement
/** Frozen tree structure. Opaque user-owned leaf payloads retain their identity. */
export type ResolvedTree = readonly ResolvedNode[]

export interface EvaluateParams {
  /** Root values addressed by absolute template paths such as `/context/name`. */
  readonly bindings: Readonly<Record<string, unknown>>
  readonly update: (...args: any[]) => unknown
}

export interface RenderProgram {
  /** Evaluate already-compiled syntax against the current bindings. */
  readonly evaluate: (params: EvaluateParams) => ResolvedTree
}

export interface RenderHost<HostNode, HostRoot> {
  createText(node: ResolvedText): HostNode
  createElement(node: ResolvedElement): HostNode
  appendChild(parent: HostNode, child: HostNode): void
  replaceChildren(root: HostRoot, children: readonly HostNode[]): void
}

export type Scope = {
  readonly item: unknown
  readonly index: number
  readonly parent?: Scope
  readonly itemPath: string
}

type Evaluation = {
  readonly bindings: Readonly<Record<string, unknown>>
  readonly update: (...args: any[]) => unknown
}

type ValueEvaluator = (
  evaluation: Evaluation,
  scope: Scope | undefined,
) => unknown
type CompiledText = {
  readonly type: "text"
  readonly evaluate: (
    evaluation: Evaluation,
    scope: Scope | undefined,
  ) => string
}
type CompiledElement = {
  readonly type: "el" | "meta"
  readonly tag: ValueEvaluator
  readonly string: readonly (readonly [string, ValueEvaluator])[]
  readonly boolean: readonly (readonly [string, ValueEvaluator])[]
  readonly array: readonly (readonly [string, readonly ValueEvaluator[]])[]
  readonly style?: CompiledStyle
  readonly event: readonly (readonly [string, ValueEvaluator])[]
  readonly core?: ValueEvaluator
  readonly children: readonly CompiledNode[]
}
type CompiledBranch = {
  readonly type: "cond" | "log"
  readonly condition: (
    evaluation: Evaluation,
    scope: Scope | undefined,
  ) => boolean
  readonly children: readonly CompiledNode[]
}
type CompiledMap = {
  readonly type: "map"
  readonly data: string
  readonly children: readonly CompiledNode[]
}
type CompiledNode =
  | CompiledText
  | CompiledElement
  | CompiledBranch
  | CompiledMap
type CompiledStyle = readonly (readonly [
  string,
  ValueEvaluator | CompiledStyle,
])[]
type ValueDescriptor = {
  readonly data: string | string[]
  readonly expr?: string
}
type TemplateNodeRecord = TemplateNode & Record<string, unknown>

const PROGRAM_CACHE = new WeakMap<object, RenderProgram>()
const CORE_CACHE = new Map<string, (values: unknown[]) => unknown>()
const EVENT_CACHE = new Map<
  string,
  (update: (...args: any[]) => unknown, values: unknown[]) => unknown
>()
const BOOLEAN_CACHE = new Map<string, (values: unknown[]) => boolean>()
const TEXT_CACHE = new Map<string, (values: unknown[]) => string>()
const EMPTY_RECORD = Object.freeze({})
const EMPTY_TREE = Object.freeze([]) as ResolvedTree

/**
 * Compile template AST once. Reusing the same AST array reuses the same program.
 * Evaluation performs no expression compilation and has no host dependency.
 */
export const compile = (nodes: readonly TemplateNode[]): RenderProgram => {
  const cacheKey = nodes as object
  const cached = PROGRAM_CACHE.get(cacheKey)
  if (cached) return cached

  const compiledNodes = Object.freeze(
    nodes
      .map(compileNode)
      .filter((node): node is CompiledNode => node !== null),
  )
  const program = Object.freeze({
    evaluate: ({ bindings, update }: EvaluateParams): ResolvedTree =>
      evaluateNodes(compiledNodes, { bindings, update }, undefined),
  }) satisfies RenderProgram

  PROGRAM_CACHE.set(cacheKey, program)
  return program
}

/** Materialize an immutable resolved tree through one target-specific host. */
export const commit = <HostNode, HostRoot>(
  host: RenderHost<HostNode, HostRoot>,
  root: HostRoot,
  tree: ResolvedTree,
): HostRoot => {
  const materialize = (node: ResolvedNode): HostNode => {
    if (node.type === "text") return host.createText(node)
    const target = host.createElement(node)
    for (const child of node.children)
      host.appendChild(target, materialize(child))
    return target
  }

  host.replaceChildren(root, tree.map(materialize))
  return root
}

const compileNode = (node: TemplateNode): CompiledNode | null => {
  if (!node || typeof node !== "object") return null
  switch (node.type) {
    case "text":
      return compileTextNode(node as TemplateNodeRecord)
    case "el":
    case "meta":
      return compileElementNode(node as TemplateNodeRecord)
    case "cond":
    case "log":
      return compileBranchNode(node as TemplateNodeRecord)
    case "map":
      return compileMapNode(node as TemplateNodeRecord)
    default:
      return null
  }
}

const compileTextNode = (node: TemplateNodeRecord): CompiledText => {
  const value = node.value
  const expr = typeof node.expr === "string" ? node.expr : undefined
  const data = snapshotData(node.data)
  if (value) {
    const text = String(value)
    return Object.freeze({ type: "text", evaluate: () => text })
  }
  if (expr && data) {
    const expression = compileTextExpression(expr)
    return Object.freeze({
      type: "text",
      evaluate: (evaluation, scope) => {
        try {
          const result = expression(getValues(data, evaluation, scope))
          return result === "false" || result === "true" ? "" : result
        } catch (error) {
          reportExpressionError(expr, error)
          return ""
        }
      },
    })
  }
  if (typeof data === "string") {
    return Object.freeze({
      type: "text",
      evaluate: (evaluation, scope) => {
        if (data === "[index]")
          return scope?.index == null ? "" : String(scope.index)
        const resolved = resolveValue(data, evaluation, scope)
        return resolved == null ? "" : String(resolved)
      },
    })
  }
  return Object.freeze({ type: "text", evaluate: () => "" })
}

const compileElementNode = (node: TemplateNodeRecord): CompiledElement => {
  const type = node.type as "el" | "meta"
  const children = compileChildren(node.child)
  return Object.freeze({
    type,
    tag: compileValue(node.tag, "text"),
    string: compileRecord(node.string, compileStringValue),
    boolean: compileRecord(node.boolean, (value) =>
      compileValue(value, "boolean"),
    ),
    array: compileArrayRecord(node.array),
    style: isRecord(node.style) ? compileStyle(node.style) : undefined,
    event: compileRecord(node.event, compileEventValue),
    core:
      type === "meta" && node.core !== undefined
        ? compileValue(node.core, "core")
        : undefined,
    children,
  })
}

const compileBranchNode = (node: TemplateNodeRecord): CompiledBranch => {
  const expr = typeof node.expr === "string" ? node.expr : undefined
  const data = snapshotData(node.data)
  let condition: CompiledBranch["condition"]
  if (!expr && typeof data === "string") {
    condition = (evaluation, scope) =>
      Boolean(resolveValue(data, evaluation, scope))
  } else if (expr && data) {
    const expression = compileBooleanExpression(expr)
    condition = (evaluation, scope) => {
      try {
        return expression(getValues(data, evaluation, scope))
      } catch (error) {
        reportExpressionError(expr, error)
        return false
      }
    }
  } else {
    condition = () => false
  }
  return Object.freeze({
    type: node.type as "cond" | "log",
    condition,
    children: compileChildren(node.child),
  })
}

const compileMapNode = (node: TemplateNodeRecord): CompiledMap =>
  Object.freeze({
    type: "map",
    data: typeof node.data === "string" ? node.data : "",
    children: compileChildren(node.child),
  })

const compileChildren = (value: unknown): readonly CompiledNode[] =>
  Array.isArray(value)
    ? Object.freeze(
        (value as TemplateNode[])
          .map(compileNode)
          .filter((child): child is CompiledNode => child !== null),
      )
    : Object.freeze([])

const compileRecord = <Compiled>(
  value: unknown,
  compileEntry: (value: unknown) => Compiled,
): readonly (readonly [string, Compiled])[] => {
  if (!isRecord(value)) return Object.freeze([])
  return Object.freeze(
    Object.entries(value).map(([name, entry]) =>
      Object.freeze([name, compileEntry(entry)] as const),
    ),
  )
}

const compileArrayRecord = (
  value: unknown,
): readonly (readonly [string, readonly ValueEvaluator[]])[] => {
  if (!isRecord(value)) return Object.freeze([])
  return Object.freeze(
    Object.entries(value).map(([name, entries]) =>
      Object.freeze([
        name,
        Object.freeze(
          (Array.isArray(entries) ? entries : []).map((entry) =>
            compileValue(entry, "text"),
          ),
        ),
      ] as const),
    ),
  )
}

const compileStyle = (style: Record<string, unknown>): CompiledStyle =>
  Object.freeze(
    Object.entries(style).map(([property, value]) =>
      Object.freeze([
        property,
        isStyleObject(value)
          ? compileStyle(value)
          : compileValue(value, "text"),
      ] as const),
    ),
  )

const compileEventValue = (value: unknown): ValueEvaluator => {
  if (isEventExpression(value)) {
    const expr = value.expr
    const data = snapshotData(value.data)
    const expression = compileEventExpression(expr)
    return (evaluation, scope) => {
      try {
        return expression(evaluation.update, getValues(data, evaluation, scope))
      } catch (error) {
        reportExpressionError(expr, error)
        return undefined
      }
    }
  }
  if (isVariableValue(value)) {
    const data = value.data
    return (evaluation, scope) => resolveValue(data, evaluation, scope)
  }
  return () => value
}

const compileStringValue = (value: unknown): ValueEvaluator => {
  if (isVariableValue(value)) {
    const data = value.data
    return (evaluation, scope) => String(resolveValue(data, evaluation, scope))
  }
  return compileValue(value, "text")
}

const compileValue = (
  value: unknown,
  mode: "text" | "boolean" | "core",
): ValueEvaluator => {
  if (isDynamicValue(value)) {
    const expr = value.expr
    const data = snapshotData(value.data)
    const expression =
      mode === "boolean"
        ? compileBooleanExpression(expr)
        : mode === "core"
          ? compileCoreExpression(expr)
          : compileTextExpression(expr)
    return (evaluation, scope) => {
      try {
        return expression(getValues(data, evaluation, scope))
      } catch (error) {
        reportExpressionError(expr, error)
        return undefined
      }
    }
  }
  if (isVariableValue(value)) {
    const data = value.data
    return (evaluation, scope) => resolveValue(data, evaluation, scope)
  }
  return () => value
}

const evaluateNodes = (
  nodes: readonly CompiledNode[],
  evaluation: Evaluation,
  scope: Scope | undefined,
): ResolvedTree => {
  if (nodes.length === 0) return EMPTY_TREE
  const resolved: ResolvedNode[] = []
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        resolved.push(
          Object.freeze({
            type: "text",
            value: node.evaluate(evaluation, scope),
          }),
        )
        break
      case "el":
      case "meta": {
        const element = evaluateElement(node, evaluation, scope)
        if (element) resolved.push(element)
        break
      }
      case "cond": {
        const branch = node.condition(evaluation, scope)
          ? node.children[0]
          : node.children[1]
        if (branch) resolved.push(...evaluateNodes([branch], evaluation, scope))
        break
      }
      case "log":
        if (node.condition(evaluation, scope))
          resolved.push(...evaluateNodes(node.children, evaluation, scope))
        break
      case "map": {
        const arrayPath = resolvePath(node.data, scope)
        const array =
          arrayPath == null ? undefined : getValue(arrayPath, evaluation)
        if (!Array.isArray(array) || arrayPath == null) break
        array.forEach((item, index) => {
          resolved.push(
            ...evaluateNodes(node.children, evaluation, {
              item,
              index,
              parent: scope,
              itemPath: `${arrayPath}/${index}`,
            }),
          )
        })
        break
      }
    }
  }
  return Object.freeze(resolved)
}

const evaluateElement = (
  node: CompiledElement,
  evaluation: Evaluation,
  scope: Scope | undefined,
): ResolvedElement | null => {
  const tag = node.tag(evaluation, scope)
  if (typeof tag !== "string") return null
  const core = node.core?.(evaluation, scope)
  return Object.freeze({
    type: "element",
    templateType: node.type,
    tag,
    attributes: Object.freeze({
      string: evaluateStringAttributes(node.string, evaluation, scope),
      boolean: evaluateBooleanAttributes(node.boolean, evaluation, scope),
      array: evaluateArrayAttributes(node.array, evaluation, scope),
      style: node.style
        ? evaluateStyle(node.style, evaluation, scope)
        : undefined,
      event: evaluateEventAttributes(node.event, evaluation, scope),
    }),
    ...(node.type === "meta" && core ? { core } : {}),
    children: evaluateNodes(node.children, evaluation, scope),
  })
}

const evaluateStringAttributes = (
  entries: CompiledElement["string"],
  evaluation: Evaluation,
  scope: Scope | undefined,
): Readonly<Record<string, string>> => {
  if (entries.length === 0) return EMPTY_RECORD
  const result: Record<string, string> = {}
  for (const [name, evaluate] of entries) {
    const value = evaluate(evaluation, scope)
    if (value) result[name] = String(value)
  }
  return Object.freeze(result)
}

const evaluateBooleanAttributes = (
  entries: CompiledElement["boolean"],
  evaluation: Evaluation,
  scope: Scope | undefined,
): Readonly<Record<string, boolean>> => {
  if (entries.length === 0) return EMPTY_RECORD
  const result: Record<string, boolean> = {}
  for (const [name, evaluate] of entries)
    result[name] = Boolean(evaluate(evaluation, scope))
  return Object.freeze(result)
}

const evaluateArrayAttributes = (
  entries: CompiledElement["array"],
  evaluation: Evaluation,
  scope: Scope | undefined,
): Readonly<Record<string, readonly unknown[]>> => {
  if (entries.length === 0) return EMPTY_RECORD
  const result: Record<string, readonly unknown[]> = {}
  for (const [name, evaluators] of entries) {
    const values: unknown[] = []
    for (const evaluate of evaluators) {
      const value = evaluate(evaluation, scope)
      if (value == null || value === "false" || value === "") continue
      values.push(value)
    }
    if (values.length > 0) result[name] = Object.freeze(values)
  }
  return Object.freeze(result)
}

const evaluateStyle = (
  entries: CompiledStyle,
  evaluation: Evaluation,
  scope: Scope | undefined,
): ResolvedStyle => {
  const result: Record<string, ResolvedStyleLeaf | ResolvedStyle> = {}
  for (const [property, compiled] of entries) {
    if (typeof compiled === "function") {
      const value = compiled(evaluation, scope)
      if (value != null && !isRecord(value))
        result[property] = value as ResolvedStyleLeaf
    } else {
      result[property] = evaluateStyle(compiled, evaluation, scope)
    }
  }
  return Object.freeze(result)
}

const evaluateEventAttributes = (
  entries: CompiledElement["event"],
  evaluation: Evaluation,
  scope: Scope | undefined,
): Readonly<Record<string, RenderEvent>> => {
  if (entries.length === 0) return EMPTY_RECORD
  const result: Record<string, RenderEvent> = {}
  for (const [name, evaluate] of entries) {
    const handler = evaluate(evaluation, scope)
    if (typeof handler === "function")
      result[name.replace(/^on/, "")] = handler as RenderEvent
  }
  return Object.freeze(result)
}

const getValues = (
  data: unknown,
  evaluation: Evaluation,
  scope: Scope | undefined,
): unknown[] => {
  if (!data) return []
  const paths =
    typeof data === "string" ? [data] : Array.isArray(data) ? data : []
  return paths.map((path) => {
    if (path === "[index]") return scope?.index
    const absolute =
      typeof path === "string" ? resolvePath(path, scope) : undefined
    return absolute == null ? undefined : getValue(absolute, evaluation)
  })
}

const resolveValue = (
  path: string,
  evaluation: Evaluation,
  scope: Scope | undefined,
): unknown => {
  if (path === "[index]") return scope?.index
  const absolute = resolvePath(path, scope)
  return absolute == null ? "" : getValue(absolute, evaluation)
}

const getValue = (absolutePath: string, evaluation: Evaluation): unknown => {
  if (!absolutePath.startsWith("/")) {
    console.error("Invalid path: " + absolutePath)
    return undefined
  }
  const segments = absolutePath.replace(/^\//, "").split("/")
  const root = segments.shift()
  if (!root) {
    console.error("Invalid path: " + absolutePath)
    return undefined
  }
  return getBySegments(evaluation.bindings[root], segments)
}

/** Resolve a template path against the current map scope without reading data. */
export const resolvePath = (
  path: string,
  scope: Scope | undefined,
): string | undefined => {
  const ascend = (
    current: Scope | undefined,
    levels: number,
  ): Scope | undefined => {
    let target = current
    while (levels > 0 && target) {
      target = target.parent
      levels--
    }
    return target
  }
  if (path.startsWith("../")) {
    const prefix = path.match(/^(?:\.\.\/)+/)?.[0] ?? ""
    return resolvePath(
      path.slice(prefix.length),
      ascend(scope, prefix.length / 3),
    )
  }
  if (path === "[item]") return scope?.itemPath
  if (path === "[index]") return undefined
  if (path.startsWith("[item]/")) {
    const rest = path.slice(7)
    if (!scope?.itemPath) return undefined
    if (rest === "state") return "/state"
    return rest.startsWith("context/") || rest.startsWith("core/")
      ? `/${rest}`
      : `${scope.itemPath}/${rest}`
  }
  if (path.startsWith("[index]/")) return undefined
  if (path.startsWith("/")) {
    const segments = path.replace(/^\//, "").split("/")
    const root = segments.shift()
    return root ? `/${[root, ...segments].join("/")}` : undefined
  }
  return undefined
}

const compileCoreExpression = (
  expr: string,
): ((values: unknown[]) => unknown) => {
  const cached = CORE_CACHE.get(expr)
  if (cached) return cached
  const compiled = new Function("_", `return (${expr})`) as (
    values: unknown[],
  ) => unknown
  CORE_CACHE.set(expr, compiled)
  return compiled
}

const compileEventExpression = (
  expr: string,
): ((update: (...args: any[]) => unknown, values: unknown[]) => unknown) => {
  const cached = EVENT_CACHE.get(expr)
  if (cached) return cached
  const compiled = new Function("update", "_", `return (${expr})`) as (
    update: (...args: any[]) => unknown,
    values: unknown[],
  ) => unknown
  EVENT_CACHE.set(expr, compiled)
  return compiled
}

const compileBooleanExpression = (
  expr: string,
): ((values: unknown[]) => boolean) => {
  const cached = BOOLEAN_CACHE.get(expr)
  if (cached) return cached
  const compiled = new Function("_", `return Boolean(${expr})`) as (
    values: unknown[],
  ) => boolean
  BOOLEAN_CACHE.set(expr, compiled)
  return compiled
}

const compileTextExpression = (
  expr: string,
): ((values: unknown[]) => string) => {
  const cached = TEXT_CACHE.get(expr)
  if (cached) return cached
  const body = expr.replace(/(_\[\d+\])/g, '($1 ?? "")')
  const compiled = new Function(
    "_",
    body.startsWith("`") && body.endsWith("`")
      ? `return (${body})`
      : `return (\`${body}\`)`,
  ) as (values: unknown[]) => string
  TEXT_CACHE.set(expr, compiled)
  return compiled
}

const reportExpressionError = (expr: string, error: unknown) =>
  console.error(`Error evaluating expression: ${expr}`, { cause: error })

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const isDynamicValue = (
  value: unknown,
): value is ValueDescriptor & { readonly expr: string } =>
  isRecord(value) &&
  typeof value.expr === "string" &&
  (typeof value.data === "string" || Array.isArray(value.data))
const isVariableValue = (
  value: unknown,
): value is ValueDescriptor & { readonly data: string } =>
  isRecord(value) &&
  typeof value.data === "string" &&
  !Object.hasOwn(value, "expr")
const isEventExpression = (
  value: unknown,
): value is { readonly data?: string | string[]; readonly expr: string } =>
  isRecord(value) && typeof value.expr === "string"
const isStyleObject = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && !isDynamicValue(value) && !isVariableValue(value)

const snapshotData = (data: unknown): unknown =>
  Array.isArray(data) ? Object.freeze([...data]) : data

const getBySegments = (base: unknown, segments: readonly string[]): unknown => {
  let current = base
  for (const segment of segments) {
    if (current == null) return undefined
    const key = /^\d+$/.test(segment) ? Number(segment) : segment
    current = (current as any)[key]
  }
  return current
}
