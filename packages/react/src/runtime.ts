import {
  DocumentFragment,
  Element,
  Event,
  HTMLElement,
  HTMLInputElement,
  HTMLOptionElement,
  HTMLSelectElement,
  HTMLTextAreaElement,
  Node,
  Text,
  type Document,
  type EventListener
} from "@zavx0z/dom"
import {
  isCompiledTemplate,
  isHostBinding,
  type CompiledTemplate,
  type HostBinding
} from "@zavx0z/template/compiled"
import type {JsxSourceElement} from "@zavx0z/template/jsx-runtime"
import {
  isComponentValue,
  isContext,
  isKeyedComponentsValue,
  memoPropsEqual,
  contextDefaultValue,
  type CallbackRef,
  type ComponentValue,
  type ComponentKey,
  type Context,
  type ContextProvision,
  type EventHandler,
  type KeyedComponentsValue,
  type StyleBindingValue
} from "./composition.ts"
import {
  resolveStyleValue,
  type ResolvedStyleValue
} from "./style.ts"

const unset = Symbol("@zavx0z/react/unset")
const noContextProvisions = Object.freeze([]) as readonly ContextProvision[]
const roots = new WeakMap<RootContainer, ComponentRoot>()
const schedulers = new WeakMap<Document, DocumentScheduler>()
const pendingHookUpdates = new WeakSet<ComponentInstance<unknown>>()

const MAX_RENDER_PHASE_UPDATES = 25

export type RootContainer = Element | DocumentFragment
export type SetStateAction<Value> = Value | ((previous: Value) => Value)
export type Dispatch<Action> = (action: Action) => void
export type StateDispatch<Value> = Dispatch<SetStateAction<Value>>
export type Reducer<State, Action> = (state: State, action: Action) => State
export type DependencyList = readonly unknown[]
export type MutableRefObject<Value> = {current: Value}
export type RefCallback<Value> = (instance: Value | null) => void | (() => void)
export type RefObject<Value> = {current: Value | null}
export type Ref<Value> = RefCallback<Value> | RefObject<Value> | null
export type EffectCallback = () => void | (() => void)
export type ExternalStoreSubscribe = (onStoreChange: () => void) => () => void

export type RootOptions = Readonly<{
  identifierPrefix?: string
}>

export type RenderOptions = Readonly<{
  key?: ComponentKey
}>

export interface ComponentRoot {
  batch<Result>(callback: () => Result): Result
  flush(): number
  render(element: JsxSourceElement): void
  render<Props>(
    template: CompiledTemplate<Props>,
    props: Readonly<Props>,
    options?: RenderOptions
  ): void
  stats(): ComponentRuntimeStats
  unmount(): void
}

export type ComponentRuntimeStats = Readonly<{
  disposes: number
  mounts: number
  moves: number
  renders: number
}>

export class HookContractError extends Error {
  override readonly name = "HookContractError"
}

export class CompiledTemplateError extends Error {
  override readonly name = "CompiledTemplateError"
}

export class UnsupportedReactFeatureError extends Error {
  override readonly name = "UnsupportedReactFeatureError"

  readonly feature: string

  constructor(feature: string) {
    super(`${feature} is not supported by @zavx0z/react`)
    this.feature = feature
  }
}

type StateHook = {
  dispatch: StateDispatch<unknown>
  kind: "state"
  pendingApplied: boolean
  queue: UpdateQueue<SetStateAction<unknown>>
  value: unknown
}

type ReducerHook = {
  dispatch: Dispatch<unknown>
  kind: "reducer"
  pendingApplied: boolean
  queue: UpdateQueue<unknown>
  reducer: Reducer<unknown, unknown>
  value: unknown
}

type HookUpdate<Action> = {
  action: Action
  next: HookUpdate<Action> | null
}

type UpdateQueue<Action> = {
  head: HookUpdate<Action> | null
  tail: HookUpdate<Action> | null
}

type RefHook = {
  kind: "ref"
  ref: MutableRefObject<unknown>
}

type MemoHook = {
  dependencies: DependencyList
  kind: "memo"
  value: unknown
}

type IdHook = {
  kind: "id"
  value: string
}

type ContextHook = {
  context: Context<unknown>
  kind: "context"
  value: unknown
}

type EffectPhase = "insertion" | "layout" | "passive"

type EffectHook = {
  cleanup: (() => void) | null
  dependencies: DependencyList | null
  kind: "effect"
  needsRun: boolean
  phase: EffectPhase
  setup: EffectCallback
}

type ImperativeHook = {
  cleanup: (() => void) | null
  createHandle: () => unknown
  dependencies: DependencyList | null
  kind: "imperative"
  needsRun: boolean
  ref: Ref<unknown>
}

type ExternalStoreHook = {
  getServerSnapshot: (() => unknown) | undefined
  getSnapshot: () => unknown
  index: number
  kind: "external-store"
  needsSubscribe: boolean
  snapshot: unknown
  subscribe: ExternalStoreSubscribe
  unsubscribe: (() => void) | null
}

type DebugHook = {
  format: ((value: unknown) => unknown) | undefined
  kind: "debug"
  value: unknown
}

type EffectEventCell = {
  callback: (...arguments_: unknown[]) => unknown
  instance: ComponentInstance<unknown>
}

type EffectEventHook = {
  cell: EffectEventCell
  kind: "effect-event"
  nextCallback: (...arguments_: unknown[]) => unknown
}

type HookSlot =
  | StateHook
  | ReducerHook
  | RefHook
  | MemoHook
  | IdHook
  | ContextHook
  | EffectHook
  | ImperativeHook
  | ExternalStoreHook
  | DebugHook
  | EffectEventHook

type ContextFrame = Readonly<{
  context: Context<unknown>
  parent: ContextFrame | null
  value: unknown
}>

class ExternalStoreSnapshotChanged extends Error {
  override readonly name = "ExternalStoreSnapshotChanged"
}

type RuntimeTextBinding = {
  definition: Extract<HostBinding, {kind: "text"}>
  kind: "text"
  value: unknown
}

type RuntimePropertyBinding = {
  definition: Extract<HostBinding, {kind: "property"}>
  kind: "property"
  value: unknown
}

type RuntimeStyleBinding = {
  definition: Extract<HostBinding, {kind: "style"}>
  kind: "style"
  value: ResolvedStyleValue | typeof unset
}

type RuntimeEventBinding = {
  definition: Extract<HostBinding, {kind: "event"}>
  handler: EventHandler | null
  kind: "event"
  listener: EventListener
  value: unknown
}

type RuntimeRefBinding = {
  attached: boolean
  cleanup: (() => void) | null
  definition: Extract<HostBinding, {kind: "ref"}>
  kind: "ref"
  value: CallbackRef | null | typeof unset
}

type RuntimeChildBinding = {
  child: ComponentInstance<unknown> | null
  definition: Extract<HostBinding, {kind: "child"}>
  kind: "child"
  validatedVersion: number
}

type RuntimeConditionalBinding = {
  child: ComponentInstance<unknown> | null
  definition: Extract<HostBinding, {kind: "conditional"}>
  kind: "conditional"
  validatedVersion: number
}

type RuntimeKeyedBinding = {
  childrenByKey: Map<string | number, ComponentInstance<unknown>>
  definition: Extract<HostBinding, {kind: "keyed"}>
  kind: "keyed"
  order: ComponentInstance<unknown>[]
  placementKeep: Uint8Array
  placementOrder: Map<ComponentInstance<unknown>, number>
  placementOrderIndices: Int32Array
  placementPlan: number[]
  placementPredecessors: Int32Array
  placementTails: Int32Array
  scratchOrder: Array<ComponentInstance<unknown> | undefined>
  scratchKeys: Set<string | number>
  validationEpoch: number
  validatedVersion: number
}

type RuntimeBinding =
  | RuntimeTextBinding
  | RuntimePropertyBinding
  | RuntimeStyleBinding
  | RuntimeEventBinding
  | RuntimeRefBinding
  | RuntimeChildBinding
  | RuntimeConditionalBinding
  | RuntimeKeyedBinding

type PreparedPatch = {
  apply(): void
  commit(): void
  rollback(): void
}

type PreparedRefChange = {
  binding: RuntimeRefBinding
  next: CallbackRef | null
}

type PreparedSingleRange = {
  binding: RuntimeChildBinding | RuntimeConditionalBinding
  existingPlan: PreparedComponentUpdate | null
  next: ComponentInstance<unknown> | null
  previous: ComponentInstance<unknown> | null
  staged: ComponentInstance<unknown> | null
}

type PreparedKeyedRange = {
  binding: RuntimeKeyedBinding
  existingPlans: readonly PreparedComponentUpdate[]
  nextByKey: Map<string | number, ComponentInstance<unknown>>
  nextOrder: ComponentInstance<unknown>[]
  placements: readonly number[] | null
  removed: readonly ComponentInstance<unknown>[]
  staged: readonly ComponentInstance<unknown>[]
}

type PreparedRange = PreparedSingleRange | PreparedKeyedRange

type PreparedComponentUpdate = {
  hostPatches: PreparedPatch[]
  instance: ComponentInstance<unknown>
  nextContextFrame: ContextFrame | null
  nextContextProvisions: readonly ContextProvision[]
  nextProps: Readonly<unknown>
  ranges: PreparedRange[]
  refChanges: PreparedRefChange[]
  workHooks: HookSlot[]
}

type PropertyOperation = {
  current(): unknown
  next: unknown
  write(value: unknown): void
}

const noComponentInstances = Object.freeze([]) as readonly ComponentInstance<unknown>[]
const noPreparedComponentUpdates = Object.freeze([]) as readonly PreparedComponentUpdate[]
const noKeyedPlacements = Object.freeze([]) as readonly number[]

class DocumentScheduler {
  readonly document: Document

  disposes = 0
  mounts = 0
  moves = 0
  renders = 0

  private batchDepth = 0
  private flushing = false
  private head: ComponentInstance<unknown> | null = null
  private tail: ComponentInstance<unknown> | null = null
  private idSequence = 0
  private rootsCreated = 0

  constructor(document: Document) {
    this.document = document
  }

  nextRootId(): number {
    const id = this.rootsCreated
    this.rootsCreated += 1
    return id
  }

  nextHookId(prefix: string, rootId: number): string {
    const id = this.idSequence
    this.idSequence += 1
    return `${prefix}:z${rootId}h${id}:`
  }

  stats(): ComponentRuntimeStats {
    return Object.freeze({
      disposes: this.disposes,
      mounts: this.mounts,
      moves: this.moves,
      renders: this.renders
    })
  }

  enqueue(instance: ComponentInstance<unknown>): void {
    if (!instance.active || instance.queued) return
    instance.queued = true
    instance.queueNext = null
    if (this.tail) this.tail.queueNext = instance
    else this.head = instance
    this.tail = instance
    if (this.batchDepth === 0 && !this.flushing) this.flush()
  }

  batch<Result>(callback: () => Result): Result {
    this.batchDepth += 1
    try {
      return callback()
    } finally {
      this.batchDepth -= 1
      if (this.batchDepth === 0 && !this.flushing) this.flush()
    }
  }

  flush(): number {
    if (this.flushing || this.batchDepth > 0) return 0
    this.flushing = true
    let completed = 0
    try {
      while (this.head) {
        const instance = this.head
        this.head = instance.queueNext
        if (!this.head) this.tail = null
        instance.queueNext = null
        instance.queued = false
        if (!instance.active) continue
        instance.performScheduledRender()
        completed += 1
      }
      return completed
    } finally {
      this.flushing = false
    }
  }
}

class ComponentInstance<Props> {
  declare keyedValidationEpoch: number | undefined

  readonly document: Document
  readonly end: Node
  readonly rootId: number
  readonly scheduler: DocumentScheduler
  readonly start: Node
  readonly template: CompiledTemplate<Props>

  active = true
  queueNext: ComponentInstance<unknown> | null = null
  queued = false

  private bindings: RuntimeBinding[] = []
  private contextFrame: ContextFrame | null
  private contextProvisions: readonly ContextProvision[]
  private hasCompositionBindings = false
  private hasContextHooks = false
  private hasExternalStoreHooks = false
  private hookSlots: HookSlot[] = []
  private initialized = false
  private key: ComponentKey
  private committed = false
  private pendingProps: Readonly<Props> | typeof unset = unset
  private props: Readonly<Props>
  private readonly rootIdentifierPrefix: string
  private readonly staging: DocumentFragment
  private readonly values: unknown[]

  constructor(
    scheduler: DocumentScheduler,
    rootId: number,
    rootIdentifierPrefix: string,
    template: CompiledTemplate<Props>,
    props: Readonly<Props>,
    key: ComponentKey,
    parentContextFrame: ContextFrame | null,
    contextProvisions: readonly ContextProvision[]
  ) {
    this.scheduler = scheduler
    this.document = scheduler.document
    this.rootId = rootId
    this.rootIdentifierPrefix = rootIdentifierPrefix
    this.template = template
    this.props = props
    this.key = key
    this.contextProvisions = contextProvisions
    this.contextFrame = applyContextProvisions(parentContextFrame, contextProvisions)
    this.start = this.document.createComment(`component:${template.displayName}`)
    this.end = this.document.createComment(`/component:${template.displayName}`)
    this.staging = this.document.createDocumentFragment()
    this.values = Array.from({length: template.bindingCount}, () => unset)

    try {
      this.mountStaticTemplate()
      this.renderAndCommit(
        props,
        "initial",
        this.contextFrame,
        contextProvisions,
        false
      )
      this.scheduler.mounts += 1
    } catch (error) {
      try { this.dispose() } catch {}
      throw error
    }
  }

  get stagedRegion(): DocumentFragment {
    return this.staging
  }

  matches(template: CompiledTemplate<unknown>, key: ComponentKey): boolean {
    return this.template === template && Object.is(this.key, key)
  }

  stageChild(value: ComponentValue, parentFrame: ContextFrame | null): ComponentInstance<unknown> {
    return new ComponentInstance(
      this.scheduler,
      this.rootId,
      this.rootIdentifierPrefix,
      value.template,
      value.props,
      value.key,
      parentFrame,
      value.contexts
    )
  }

  get isCommitted(): boolean {
    return this.committed
  }

  scheduleProps(props: Readonly<Props>): void {
    this.assertActive()
    this.pendingProps = props
    this.scheduler.enqueue(this as ComponentInstance<unknown>)
  }

  performScheduledRender(): void {
    const hasProps = this.pendingProps !== unset
    const props = hasProps ? this.pendingProps as Readonly<Props> : this.props
    this.pendingProps = unset
    this.renderAndCommit(
      props,
      hasProps ? "props" : "state",
      this.contextFrame,
      this.contextProvisions,
      this.committed
    )
  }

  stabilizeDetached(): void {
    this.renderAndCommit(
      this.props,
      "state",
      this.contextFrame,
      this.contextProvisions,
      false
    )
  }

  dispatchState(index: number, action: SetStateAction<unknown>): void {
    this.assertActive()
    if (currentEffectPhase === "insertion") {
      throw new HookContractError("useInsertionEffect cannot update component state")
    }
    const slots = currentInstance === this ? currentHookSlots : this.hookSlots
    const slot = slots?.[index]
    if (!slot || slot.kind !== "state") throw new HookContractError("State hook slot is unavailable")
    if (currentInstance === this) {
      const next = typeof action === "function"
        ? (action as (previous: unknown) => unknown)(slot.value)
        : action
      if (Object.is(next, slot.value)) return
      slot.value = next
      renderPhaseUpdate = true
      return
    }
    if (slot.queue.head === null && typeof action !== "function" && Object.is(action, slot.value)) {
      return
    }
    appendUpdate(slot.queue, action)
    pendingHookUpdates.add(this as ComponentInstance<unknown>)
    this.scheduler.enqueue(this as ComponentInstance<unknown>)
  }

  dispatchReducer(index: number, action: unknown): void {
    this.assertActive()
    if (currentEffectPhase === "insertion") {
      throw new HookContractError("useInsertionEffect cannot update component state")
    }
    const slots = currentInstance === this ? currentHookSlots : this.hookSlots
    const slot = slots?.[index]
    if (!slot || slot.kind !== "reducer") throw new HookContractError("Reducer hook slot is unavailable")
    if (currentInstance === this) {
      const next = slot.reducer(slot.value, action)
      if (Object.is(next, slot.value)) return
      slot.value = next
      renderPhaseUpdate = true
      return
    }
    appendUpdate(slot.queue, action)
    pendingHookUpdates.add(this as ComponentInstance<unknown>)
    this.scheduler.enqueue(this as ComponentInstance<unknown>)
  }

  notifyExternalStore(index: number): void {
    if (!this.active) return
    const slot = this.hookSlots[index]
    if (!slot || slot.kind !== "external-store") return
    const snapshot = slot.getSnapshot()
    if (Object.is(snapshot, slot.snapshot)) return
    this.scheduler.enqueue(this as ComponentInstance<unknown>)
  }

  commitToDocument(): void {
    if (!this.active || this.committed) return
    markCommittedTree(this as ComponentInstance<unknown>)
    let firstError: unknown = null
    try { runInstancePhaseTree(this as ComponentInstance<unknown>, "insertion") } catch (error) {
      firstError = error
    }
    try { attachInstanceRefsTree(this as ComponentInstance<unknown>) } catch (error) {
      firstError ??= error
    }
    try { runInstancePhaseTree(this as ComponentInstance<unknown>, "layout") } catch (error) {
      firstError ??= error
    }
    try { runInstancePhaseTree(this as ComponentInstance<unknown>, "passive") } catch (error) {
      firstError ??= error
    }
    if (firstError) throw firstError
  }

  markCommitted(): void {
    this.committed = true
    this.markRangeBindingsValidated()
  }

  attachCommittedRefs(): void {
    for (const binding of this.bindings) {
      if (binding.kind !== "ref" || binding.value === unset || !binding.value) continue
      attachRef(binding, binding.value)
    }
  }

  runCommitPhase(phase: EffectPhase): void {
    let firstError: unknown = null
    const instance = this as unknown as ComponentInstance<unknown>
    for (const slot of this.hookSlots) {
      try {
        if (slot.kind === "effect" && slot.phase === phase) runEffectHook(instance, slot)
        else if (phase === "layout" && slot.kind === "imperative") runImperativeHook(instance, slot)
        else if (phase === "layout" && slot.kind === "external-store") {
          synchronizeExternalStore(instance, slot)
        }
      } catch (error) {
        firstError ??= error
      }
    }
    if (firstError) throw firstError
  }

  validateExternalSnapshots(): void {
    validateExternalHookSnapshots(this.hookSlots)
    for (const child of this.childInstances()) child.validateExternalSnapshots()
  }

  nextId(): string {
    return this.scheduler.nextHookId(this.rootIdentifierPrefix, this.rootId)
  }

  dispose(): void {
    if (!this.active) return
    this.active = false
    this.pendingProps = unset
    let firstError: unknown = null
    for (const child of this.childInstances()) {
      try { child.dispose() } catch (error) { firstError ??= error }
    }
    try {
      cleanupComponentHooks(this as unknown as ComponentInstance<unknown>, this.hookSlots)
    } catch (error) {
      firstError ??= error
    }
    for (const binding of this.bindings) {
      try {
        if (binding.kind === "event") {
          binding.definition.target.removeEventListener(
            binding.definition.type,
            binding.listener,
            {capture: binding.definition.capture}
          )
        } else if (binding.kind === "ref") {
          detachRef(binding)
        }
      } catch (error) {
        firstError ??= error
      }
    }
    this.bindings = []
    this.contextFrame = null
    this.contextProvisions = noContextProvisions
    this.hookSlots = []
    pendingHookUpdates.delete(this as ComponentInstance<unknown>)
    this.values.fill(unset)
    this.props = undefined as unknown as Readonly<Props>
    this.scheduler.disposes += 1
    if (firstError) throw firstError
  }

  private mountStaticTemplate(): void {
    const mounted = this.template.mount(this.document)
    if (!mounted || typeof mounted !== "object") {
      throw new CompiledTemplateError(`${this.template.displayName} mount returned no compiled mount`)
    }
    if (mounted.bindings.length !== this.template.bindingCount) {
      throw new CompiledTemplateError(
        `${this.template.displayName} declared ${this.template.bindingCount} bindings but mounted ${mounted.bindings.length}`
      )
    }
    const topLevel = [...mounted.nodes]
    const seen = new Set<Node>()
    for (const node of topLevel) {
      if (!(node instanceof Node)) {
        throw new CompiledTemplateError(`${this.template.displayName} mounted a non-Node value`)
      }
      if (node.ownerDocument !== this.document) {
        throw new CompiledTemplateError(`${this.template.displayName} mounted a cross-Document Node`)
      }
      if (seen.has(node)) throw new CompiledTemplateError(`${this.template.displayName} mounted a duplicate Node`)
      seen.add(node)
    }
    for (const binding of mounted.bindings) {
      if (!isHostBinding(binding)) {
        throw new CompiledTemplateError(`${this.template.displayName} mounted an invalid host binding`)
      }
      for (const target of bindingTargets(binding)) {
        if (target.ownerDocument !== this.document) {
          throw new CompiledTemplateError(`${this.template.displayName} bound a cross-Document target`)
        }
        if (!topLevel.some(node => node === target || node.contains(target))) {
          throw new CompiledTemplateError(`${this.template.displayName} bound a target outside its static region`)
        }
      }
    }

    this.staging.appendChild(this.start)
    for (const node of topLevel) this.staging.appendChild(node)
    this.staging.appendChild(this.end)
    for (const binding of mounted.bindings) {
      if (binding.kind === "child" || binding.kind === "conditional" || binding.kind === "keyed") {
        validateEmptyRange(binding.start, binding.end, this.template.displayName)
      }
    }
    this.bindings = mounted.bindings.map(binding => this.createRuntimeBinding(binding))
    this.hasCompositionBindings = this.bindings.some(binding =>
      binding.kind === "child" || binding.kind === "conditional" || binding.kind === "keyed"
    )
  }

  private createRuntimeBinding(definition: HostBinding): RuntimeBinding {
    if (definition.kind === "event") {
      const state: RuntimeEventBinding = {
        definition,
        handler: null,
        kind: "event",
        listener: () => {},
        value: unset
      }
      state.listener = event => {
        const handler = state.handler
        if (!handler || !this.active) return
        this.document.transaction(() => this.scheduler.batch(() => handler(event)))
      }
      definition.target.addEventListener(definition.type, state.listener, {
        capture: definition.capture
      })
      return state
    }
    if (definition.kind === "ref") {
      return {
        attached: false,
        cleanup: null,
        definition,
        kind: "ref",
        value: unset
      }
    }
    if (definition.kind === "child") {
      return {child: null, definition, kind: "child", validatedVersion: -1}
    }
    if (definition.kind === "conditional") {
      return {child: null, definition, kind: "conditional", validatedVersion: -1}
    }
    if (definition.kind === "keyed") {
      return {
        childrenByKey: new Map(),
        definition,
        kind: "keyed",
        order: [],
        placementKeep: new Uint8Array(),
        placementOrder: new Map(),
        placementOrderIndices: new Int32Array(),
        placementPlan: [],
        placementPredecessors: new Int32Array(),
        placementTails: new Int32Array(),
        scratchKeys: new Set(),
        scratchOrder: [],
        validationEpoch: 0,
        validatedVersion: -1
      }
    }
    return {definition, kind: definition.kind, value: unset} as RuntimeBinding
  }

  private renderAndCommit(
    nextProps: Readonly<Props>,
    reason: "initial" | "props" | "state",
    nextContextFrame: ContextFrame | null,
    nextContextProvisions: readonly ContextProvision[],
    connected: boolean
  ): void {
    let attempts = 0
    while (true) {
      attempts += 1
      if (attempts > MAX_RENDER_PHASE_UPDATES) {
        throw new HookContractError(
          `${this.template.displayName} received an unstable external-store snapshot`
        )
      }
      const prepared = this.prepareUpdate(
        nextProps,
        reason,
        nextContextFrame,
        nextContextProvisions
      )
      if (!prepared) return
      try {
        commitPreparedUpdate(prepared, connected)
        return
      } catch (error) {
        if (!(error instanceof ExternalStoreSnapshotChanged)) throw error
      }
    }
  }

  prepareUpdate(
    nextProps: Readonly<Props>,
    reason: "initial" | "props" | "state",
    nextContextFrame: ContextFrame | null = this.contextFrame,
    nextContextProvisions: readonly ContextProvision[] = this.contextProvisions
  ): PreparedComponentUpdate | null {
    if (
      reason === "props" && this.initialized && !pendingHookUpdates.has(this as ComponentInstance<unknown>) &&
      !this.hasExternalStoreChanges() &&
      !this.hasContextChanges(nextContextFrame) &&
      memoPropsEqual(this.template, this.props, nextProps)
    ) return null
    const workHooks = this.hookSlots.map(cloneHook)
    let expectedHookCount = this.initialized ? this.hookSlots.length : -1
    let attempts = 0

    while (true) {
      attempts += 1
      if (attempts > MAX_RENDER_PHASE_UPDATES) {
        throw new HookContractError(
          `${this.template.displayName} exceeded ${MAX_RENDER_PHASE_UPDATES} render-phase updates`
        )
      }
      this.values.fill(unset)
      currentInstance = this as ComponentInstance<unknown>
      currentHookSlots = workHooks
      currentContextFrame = nextContextFrame
      currentHookIndex = 0
      renderPhaseUpdate = false
      try {
        this.template.render(nextProps, this.values)
      } finally {
        currentInstance = null
        currentHookSlots = null
        currentContextFrame = null
      }
      if (expectedHookCount < 0) expectedHookCount = currentHookIndex
      else if (currentHookIndex !== expectedHookCount) {
        throw new HookContractError(
          `${this.template.displayName} rendered ${currentHookIndex} hooks; expected ${expectedHookCount}`
        )
      }
      const missing = this.values.indexOf(unset)
      if (missing >= 0) {
        throw new CompiledTemplateError(
          `${this.template.displayName} did not write compiled binding slot ${missing}`
        )
      }
      if (!renderPhaseUpdate) break
    }

    this.scheduler.renders += 1
    const patches: PreparedPatch[] = []
    const refChanges: PreparedRefChange[] = []
    const ranges: PreparedRange[] = []
    try {
      for (let index = 0; index < this.bindings.length; index += 1) {
        const binding = this.bindings[index]!
        if (binding.kind === "ref") {
          const refChange = prepareRefChange(binding, this.values[index])
          if (refChange) refChanges.push(refChange)
          continue
        }
        if (binding.kind === "child" || binding.kind === "conditional") {
          ranges.push(prepareSingleRange(
            this as ComponentInstance<unknown>,
            binding,
            this.values[index],
            nextContextFrame
          ))
          continue
        }
        if (binding.kind === "keyed") {
          ranges.push(prepareKeyedRange(
            this as ComponentInstance<unknown>,
            binding,
            this.values[index],
            nextContextFrame
          ))
          continue
        }
        const patch = prepareBindingPatch(binding, this.values[index])
        if (patch) patches.push(patch)
      }
    } catch (error) {
      discardPreparedRanges(ranges)
      throw error
    }
    return {
      hostPatches: patches,
      instance: this as ComponentInstance<unknown>,
      nextContextFrame,
      nextContextProvisions,
      nextProps,
      ranges,
      refChanges,
      workHooks
    }
  }

  finalizePreparedState(prepared: PreparedComponentUpdate): void {
    for (const patch of prepared.hostPatches) patch.commit()
    clearPendingHookQueues(prepared.workHooks)
    pendingHookUpdates.delete(this as ComponentInstance<unknown>)
    this.hookSlots = prepared.workHooks
    this.contextFrame = prepared.nextContextFrame
    this.contextProvisions = prepared.nextContextProvisions
    this.props = prepared.nextProps as Readonly<Props>
    if (!this.initialized) {
      for (const slot of this.hookSlots) {
        if (slot.kind === "context") this.hasContextHooks = true
        else if (slot.kind === "external-store") this.hasExternalStoreHooks = true
      }
    }
    this.initialized = true
    for (const slot of this.hookSlots) {
      if (slot.kind === "effect-event") slot.cell.callback = slot.nextCallback
    }
  }

  applyPreparedRefs(changes: PreparedRefChange[]): void {
    for (const change of changes) {
      if (this.committed) transitionRef(change.binding, change.next)
      else change.binding.value = change.next
    }
  }

  childInstances(): readonly ComponentInstance<unknown>[] {
    if (!this.hasCompositionBindings) return noComponentInstances
    const children: ComponentInstance<unknown>[] = []
    for (const binding of this.bindings) {
      if (binding.kind === "child" || binding.kind === "conditional") {
        if (binding.child) children.push(binding.child)
      } else if (binding.kind === "keyed") {
        children.push(...binding.order)
      }
    }
    return children
  }

  private hasContextChanges(nextContextFrame: ContextFrame | null): boolean {
    if (!this.hasContextHooks && !this.hasCompositionBindings) return false
    for (const slot of this.hookSlots) {
      if (
        slot.kind === "context" &&
        !Object.is(slot.value, readContextValue(nextContextFrame, slot.context))
      ) return true
    }
    for (const binding of this.bindings) {
      if (binding.kind === "child" || binding.kind === "conditional") {
        const child = binding.child
        if (child?.hasContextChanges(
          applyContextProvisions(nextContextFrame, child.contextProvisions)
        )) return true
        continue
      }
      if (binding.kind !== "keyed") continue
      for (const child of binding.order) {
        if (child.hasContextChanges(
          applyContextProvisions(nextContextFrame, child.contextProvisions)
        )) return true
      }
    }
    return false
  }

  private hasExternalStoreChanges(): boolean {
    if (!this.hasExternalStoreHooks) return false
    for (const slot of this.hookSlots) {
      if (slot.kind === "external-store" && !Object.is(slot.snapshot, slot.getSnapshot())) {
        return true
      }
    }
    return false
  }

  private assertActive(): void {
    if (!this.active) throw new Error("Cannot update an unmounted component")
  }

  private markRangeBindingsValidated(): void {
    if (!this.hasCompositionBindings) return
    const version = this.document.version
    for (const binding of this.bindings) {
      if (binding.kind !== "child" && binding.kind !== "conditional" && binding.kind !== "keyed") continue
      if (binding.definition.start.isConnected && binding.definition.end.isConnected) {
        binding.validatedVersion = version
      }
    }
  }
}

function prepareSingleRange(
  owner: ComponentInstance<unknown>,
  binding: RuntimeChildBinding | RuntimeConditionalBinding,
  sourceValue: unknown,
  parentFrame: ContextFrame | null
): PreparedSingleRange {
  const value = sourceValue === null && binding.kind === "conditional"
    ? null
    : requireComponentValue(sourceValue, binding.kind)
  const previous = binding.child
  const nextContextFrame = value
    ? applyContextProvisions(parentFrame, value.contexts)
    : parentFrame
  if (value && previous?.matches(value.template, value.key)) {
    return {
      binding,
      existingPlan: previous.prepareUpdate(
        value.props,
        "props",
        nextContextFrame,
        value.contexts
      ),
      next: previous,
      previous,
      staged: null
    }
  }
  const staged = value ? owner.stageChild(value, parentFrame) : null
  return {binding, existingPlan: null, next: staged, previous, staged}
}

function prepareKeyedRange(
  owner: ComponentInstance<unknown>,
  binding: RuntimeKeyedBinding,
  sourceValue: unknown,
  parentFrame: ContextFrame | null
): PreparedKeyedRange {
  if (!isKeyedComponentsValue(sourceValue)) {
    throw new TypeError("A keyed binding requires keyedComponents(entries)")
  }
  const entries = sourceValue.entries
  const nextOrderScratch = binding.scratchOrder
  nextOrderScratch.length = entries.length
  const keys = binding.scratchKeys
  const validationEpoch = nextKeyedValidationEpoch(binding)
  keys.clear()
  try {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!
      if (!isComponentValue(entry)) throw new TypeError("A keyed entry must be a component value")
      if (entry.key === null) throw new TypeError("A keyed component entry requires a non-null key")
      const previous = binding.childrenByKey.get(entry.key)
      if (previous) {
        if (previous.keyedValidationEpoch === validationEpoch) {
          throw new CompiledTemplateError(`Duplicate keyed component ${String(entry.key)}`)
        }
        previous.keyedValidationEpoch = validationEpoch
      } else {
        if (keys.has(entry.key)) {
          throw new CompiledTemplateError(`Duplicate keyed component ${String(entry.key)}`)
        }
        keys.add(entry.key)
      }
      nextOrderScratch[index] = previous
    }
  } finally {
    keys.clear()
  }

  let existingPlans: PreparedComponentUpdate[] | null = null
  let staged: ComponentInstance<unknown>[] | null = null
  let mappingStable = entries.length === binding.childrenByKey.size
  try {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!
      const previous = nextOrderScratch[index]
      let next: ComponentInstance<unknown>
      if (previous?.matches(entry.template, entry.key)) {
        next = previous
        const prepared = previous.prepareUpdate(
          entry.props,
          "props",
          entry.contexts.length === 0
            ? parentFrame
            : applyContextProvisions(parentFrame, entry.contexts),
          entry.contexts
        )
        if (prepared) (existingPlans ??= []).push(prepared)
      } else {
        mappingStable = false
        next = owner.stageChild(entry, parentFrame)
        if (staged === null) staged = []
        staged.push(next)
      }
      nextOrderScratch[index] = next
    }
  } catch (error) {
    for (const prepared of existingPlans ?? noPreparedComponentUpdates) discardPreparedUpdate(prepared)
    for (const child of staged ?? noComponentInstances) safeDispose(child)
    throw error
  }
  const nextOrder = nextOrderScratch as ComponentInstance<unknown>[]

  let nextByKey: Map<string | number, ComponentInstance<unknown>>
  let removed: ComponentInstance<unknown>[] | null = null
  if (mappingStable) {
    nextByKey = binding.childrenByKey
  } else {
    nextByKey = new Map()
    for (let index = 0; index < entries.length; index += 1) {
      nextByKey.set(entries[index]!.key as string | number, nextOrder[index]!)
    }
    for (const [key, child] of binding.childrenByKey) {
      if (nextByKey.get(key) !== child) (removed ??= []).push(child)
    }
  }

  const preparedStaged = staged ?? noComponentInstances
  const preparedRemoved = removed ?? noComponentInstances
  return {
    binding,
    existingPlans: existingPlans ?? noPreparedComponentUpdates,
    nextByKey,
    nextOrder,
    placements: planKeyedPlacements(
      binding,
      binding.order,
      nextOrder,
      preparedRemoved,
      preparedStaged
    ),
    removed: preparedRemoved,
    staged: preparedStaged
  }
}

function nextKeyedValidationEpoch(binding: RuntimeKeyedBinding): number {
  if (binding.validationEpoch < Number.MAX_SAFE_INTEGER) {
    binding.validationEpoch += 1
    return binding.validationEpoch
  }
  for (const child of binding.order) child.keyedValidationEpoch = 0
  binding.validationEpoch = 1
  return 1
}

function planKeyedPlacements(
  binding: RuntimeKeyedBinding,
  previous: readonly ComponentInstance<unknown>[],
  next: readonly ComponentInstance<unknown>[],
  removed: readonly ComponentInstance<unknown>[],
  staged: readonly ComponentInstance<unknown>[]
): readonly number[] | null {
  const placements = binding.placementPlan
  placements.length = 0
  if (removed.length === 0 && staged.length === 0) {
    if (sameInstanceOrder(previous, next)) return noKeyedPlacements
    if (isLeftRotationByOne(previous, next)) {
      placements.push(next.length - 1)
      return placements
    }
    if (isRightRotationByOne(previous, next)) {
      placements.push(0)
      return placements
    }
    return planArbitraryKeyedPlacements(binding, previous, next)
  }

  if (removed.length === 1 && staged.length === 0) {
    return sameOrderAfterSingleRemoval(previous, next, removed[0]!)
      ? noKeyedPlacements
      : null
  }

  if (staged.length === 1 && removed.length <= 1) {
    const child = staged[0]!
    const insertionIndex = next.indexOf(child)
    if (insertionIndex < 0) return null
    if (!sameOrderAroundSingleInsertion(previous, next, removed[0] ?? null, insertionIndex)) {
      return null
    }
    placements.push(insertionIndex)
    return placements
  }
  return null
}

function planArbitraryKeyedPlacements(
  binding: RuntimeKeyedBinding,
  previous: readonly ComponentInstance<unknown>[],
  next: readonly ComponentInstance<unknown>[]
): readonly number[] {
  const length = next.length
  ensurePlacementCapacity(binding, length)
  const tails = binding.placementTails
  const predecessors = binding.placementPredecessors
  const keep = binding.placementKeep
  const order = binding.placementOrder
  const orderIndices = binding.placementOrderIndices
  keep.fill(0, 0, length)
  for (let index = 0; index < previous.length; index += 1) {
    order.set(previous[index]!, index)
  }
  for (let index = 0; index < length; index += 1) {
    orderIndices[index] = order.get(next[index]!)!
  }
  order.clear()

  let longest = 0
  for (let index = 0; index < length; index += 1) {
    const orderIndex = orderIndices[index]!
    let low = 0
    let high = longest
    while (low < high) {
      const middle = (low + high) >>> 1
      if (orderIndices[tails[middle]!]! < orderIndex) low = middle + 1
      else high = middle
    }
    predecessors[index] = low === 0 ? -1 : tails[low - 1]!
    tails[low] = index
    if (low === longest) longest += 1
  }

  for (let index = tails[longest - 1] ?? -1; index >= 0; index = predecessors[index]!) {
    keep[index] = 1
  }
  const placements = binding.placementPlan
  for (let index = length - 1; index >= 0; index -= 1) {
    if (keep[index] === 0) placements.push(index)
  }
  return placements
}

function ensurePlacementCapacity(binding: RuntimeKeyedBinding, required: number): void {
  if (binding.placementKeep.length >= required) return
  let capacity = Math.max(16, binding.placementKeep.length)
  while (capacity < required) capacity *= 2
  binding.placementKeep = new Uint8Array(capacity)
  binding.placementOrderIndices = new Int32Array(capacity)
  binding.placementPredecessors = new Int32Array(capacity)
  binding.placementTails = new Int32Array(capacity)
}

function sameInstanceOrder(
  left: readonly ComponentInstance<unknown>[],
  right: readonly ComponentInstance<unknown>[]
): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function isLeftRotationByOne(
  previous: readonly ComponentInstance<unknown>[],
  next: readonly ComponentInstance<unknown>[]
): boolean {
  if (previous.length < 2 || previous.length !== next.length || next.at(-1) !== previous[0]) {
    return false
  }
  for (let index = 0; index < previous.length - 1; index += 1) {
    if (next[index] !== previous[index + 1]) return false
  }
  return true
}

function isRightRotationByOne(
  previous: readonly ComponentInstance<unknown>[],
  next: readonly ComponentInstance<unknown>[]
): boolean {
  if (previous.length < 2 || previous.length !== next.length || next[0] !== previous.at(-1)) {
    return false
  }
  for (let index = 1; index < previous.length; index += 1) {
    if (next[index] !== previous[index - 1]) return false
  }
  return true
}

function sameOrderAfterSingleRemoval(
  previous: readonly ComponentInstance<unknown>[],
  next: readonly ComponentInstance<unknown>[],
  removed: ComponentInstance<unknown>
): boolean {
  if (previous.length !== next.length + 1) return false
  let nextIndex = 0
  let skipped = false
  for (const child of previous) {
    if (!skipped && child === removed) {
      skipped = true
      continue
    }
    if (child !== next[nextIndex]) return false
    nextIndex += 1
  }
  return skipped && nextIndex === next.length
}

function sameOrderAroundSingleInsertion(
  previous: readonly ComponentInstance<unknown>[],
  next: readonly ComponentInstance<unknown>[],
  removed: ComponentInstance<unknown> | null,
  insertionIndex: number
): boolean {
  const expectedLength = previous.length + 1 - (removed === null ? 0 : 1)
  if (next.length !== expectedLength) return false
  let previousIndex = 0
  for (let nextIndex = 0; nextIndex < next.length; nextIndex += 1) {
    if (nextIndex === insertionIndex) continue
    while (removed !== null && previous[previousIndex] === removed) previousIndex += 1
    if (next[nextIndex] !== previous[previousIndex]) return false
    previousIndex += 1
  }
  while (removed !== null && previous[previousIndex] === removed) previousIndex += 1
  return previousIndex === previous.length
}

function requireComponentValue(value: unknown, binding: "child" | "conditional"): ComponentValue {
  if (!isComponentValue(value)) {
    throw new TypeError(`A ${binding} binding requires a compiled component value`)
  }
  return value
}

function commitPreparedUpdate(prepared: PreparedComponentUpdate, connected: boolean): void {
  const applied: PreparedPatch[] = []
  try {
    validatePreparedRanges(prepared)
    prepared.instance.document.transaction(() => {
      validateExternalSnapshotsDeep(prepared)
      applyHostPatchesDeep(prepared, applied)
      applyRangeDomDeep(prepared)
    })
    markPreparedRangesValidatedDeep(prepared)
  } catch (error) {
    prepared.instance.document.transaction(() => {
      for (let index = applied.length - 1; index >= 0; index -= 1) applied[index]!.rollback()
    })
    discardPreparedUpdate(prepared)
    throw error
  }

  finalizeStateDeep(prepared)
  finalizeRangeStateDeep(prepared)
  let commitError: unknown = null
  try { disposeRemovedDeep(prepared) } catch (error) { commitError = error }
  if (connected) {
    markPreparedStagedDeep(prepared)
    try { runPreparedPhaseDeep(prepared, "insertion") } catch (error) { commitError ??= error }
  }
  try { applyRefChangesDeep(prepared) } catch (error) { commitError ??= error }
  if (connected) {
    try { attachPreparedStagedRefsDeep(prepared) } catch (error) { commitError ??= error }
    try { runPreparedPhaseDeep(prepared, "layout") } catch (error) { commitError ??= error }
    try { runPreparedPhaseDeep(prepared, "passive") } catch (error) { commitError ??= error }
  }
  if (commitError) throw commitError
}

function applyHostPatchesDeep(
  prepared: PreparedComponentUpdate,
  applied: PreparedPatch[]
): void {
  for (const patch of prepared.hostPatches) {
    patch.apply()
    applied.push(patch)
  }
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) applyHostPatchesDeep(child, applied)
  }
}

function applyRangeDomDeep(prepared: PreparedComponentUpdate): void {
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) applyRangeDomDeep(child)
    applyRangeDom(range)
  }
}

function applyRangeDom(range: PreparedRange): void {
  const parent = range.binding.definition.end.parentNode!
  if ("existingPlan" in range) {
    if (range.previous === range.next) return
    if (range.previous) removeInstanceRegion(range.previous)
    if (range.next) parent.insertBefore(range.next.stagedRegion, range.binding.definition.end)
    return
  }
  for (const child of range.removed) removeInstanceRegion(child)
  if (range.placements !== null) {
    applyKeyedPlacements(range)
    return
  }
  let anchor: Node = range.binding.definition.end
  for (let index = range.nextOrder.length - 1; index >= 0; index -= 1) {
    const child = range.nextOrder[index]!
    placeInstanceBefore(child, anchor)
    anchor = child.start
  }
}

function applyKeyedPlacements(range: PreparedKeyedRange): void {
  const placements = range.placements!
  let cursor = 0
  while (cursor < placements.length) {
    const high = placements[cursor]!
    let low = high
    while (cursor + 1 < placements.length && placements[cursor + 1] === low - 1) {
      cursor += 1
      low -= 1
    }
    const anchor = range.nextOrder[high + 1]?.start ?? range.binding.definition.end
    if (low === high) placeInstanceBefore(range.nextOrder[low]!, anchor)
    else placeInstanceRunBefore(range.nextOrder, low, high, anchor)
    cursor += 1
  }
}

function placeInstanceRunBefore(
  order: readonly ComponentInstance<unknown>[],
  low: number,
  high: number,
  anchor: Node
): void {
  const parent = anchor.parentNode!
  const fragment = anchor.ownerDocument!.createDocumentFragment()
  let committedMoves = 0
  for (let index = low; index <= high; index += 1) {
    const instance = order[index]!
    if (!instance.isCommitted) {
      fragment.appendChild(instance.stagedRegion)
      continue
    }
    appendInstanceRegion(fragment, instance)
    committedMoves += 1
  }
  parent.insertBefore(fragment, anchor)
  if (committedMoves > 0) order[low]!.scheduler.moves += committedMoves
}

function placeInstanceBefore(instance: ComponentInstance<unknown>, anchor: Node): void {
  if (instance.end.nextSibling === anchor && instance.end.parentNode === anchor.parentNode) return
  const parent = anchor.parentNode!
  if (!instance.isCommitted) {
    parent.insertBefore(instance.stagedRegion, anchor)
    return
  }
  const fragment = instance.document.createDocumentFragment()
  appendInstanceRegion(fragment, instance)
  parent.insertBefore(fragment, anchor)
  instance.scheduler.moves += 1
}

function appendInstanceRegion(
  fragment: DocumentFragment,
  instance: ComponentInstance<unknown>
): void {
  let current: Node | null = instance.start
  while (current) {
    const following: Node | null = current.nextSibling
    fragment.appendChild(current)
    if (current === instance.end) break
    current = following
  }
}

function removeInstanceRegion(instance: ComponentInstance<unknown>): void {
  const parent = instance.start.parentNode
  if (!parent) return
  let current: Node | null = instance.start
  while (current) {
    const following: Node | null = current.nextSibling
    parent.removeChild(current)
    if (current === instance.end) break
    current = following
  }
}

function validatePreparedRanges(prepared: PreparedComponentUpdate): void {
  for (const range of prepared.ranges) {
    const {start, end} = range.binding.definition
    if (!start.parentNode || start.parentNode !== end.parentNode ||
      !rangeOrderIsKnown(range.binding, prepared.instance.document.version, start, end)) {
      throw new CompiledTemplateError("A compiled child range lost its ordered anchors")
    }
    for (const child of existingPlans(range)) validatePreparedRanges(child)
    const instances = "existingPlan" in range
      ? range.next ? [range.next] : []
      : range.staged
    for (const child of instances) {
      if (child.document !== prepared.instance.document) {
        throw new CompiledTemplateError("A compiled child range received a cross-Document instance")
      }
    }
  }
}

function rangeOrderIsKnown(
  binding: RuntimeChildBinding | RuntimeConditionalBinding | RuntimeKeyedBinding,
  documentVersion: number,
  start: Node,
  end: Node
): boolean {
  return start.isConnected && end.isConnected && binding.validatedVersion === documentVersion
    ? true
    : precedes(start, end)
}

function markPreparedRangesValidatedDeep(prepared: PreparedComponentUpdate): void {
  const version = prepared.instance.document.version
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) markPreparedRangesValidatedDeep(child)
    const {start, end} = range.binding.definition
    if (start.isConnected && end.isConnected) range.binding.validatedVersion = version
  }
}

function finalizeStateDeep(prepared: PreparedComponentUpdate): void {
  prepared.instance.finalizePreparedState(prepared)
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) finalizeStateDeep(child)
  }
}

function finalizeRangeStateDeep(prepared: PreparedComponentUpdate): void {
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) finalizeRangeStateDeep(child)
    if ("existingPlan" in range) {
      range.binding.child = range.next
    } else {
      const previousOrder = range.binding.order
      range.binding.childrenByKey = range.nextByKey
      range.binding.order = range.nextOrder
      range.binding.scratchOrder = previousOrder
    }
  }
}

function disposeRemovedDeep(prepared: PreparedComponentUpdate): void {
  let firstError: unknown = null
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) {
      try { disposeRemovedDeep(child) } catch (error) { firstError ??= error }
    }
    const removed = "existingPlan" in range
      ? range.previous && range.previous !== range.next ? [range.previous] : []
      : range.removed
    for (const child of removed) {
      try { child.dispose() } catch (error) { firstError ??= error }
    }
  }
  if (firstError) throw firstError
}

function applyRefChangesDeep(prepared: PreparedComponentUpdate): void {
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) applyRefChangesDeep(child)
  }
  prepared.instance.applyPreparedRefs(prepared.refChanges)
}

function markPreparedStagedDeep(prepared: PreparedComponentUpdate): void {
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) markPreparedStagedDeep(child)
    const staged = "existingPlan" in range ? range.staged ? [range.staged] : [] : range.staged
    for (const child of staged) markCommittedTree(child)
  }
}

function attachPreparedStagedRefsDeep(prepared: PreparedComponentUpdate): void {
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) attachPreparedStagedRefsDeep(child)
    const staged = "existingPlan" in range ? range.staged ? [range.staged] : [] : range.staged
    for (const child of staged) attachInstanceRefsTree(child)
  }
}

function runPreparedPhaseDeep(prepared: PreparedComponentUpdate, phase: EffectPhase): void {
  let firstError: unknown = null
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) {
      try { runPreparedPhaseDeep(child, phase) } catch (error) { firstError ??= error }
    }
    const staged = "existingPlan" in range ? range.staged ? [range.staged] : [] : range.staged
    for (const child of staged) {
      try { runInstancePhaseTree(child, phase) } catch (error) { firstError ??= error }
    }
  }
  try { prepared.instance.runCommitPhase(phase) } catch (error) { firstError ??= error }
  if (firstError) throw firstError
}

function validateExternalSnapshotsDeep(prepared: PreparedComponentUpdate): void {
  validateExternalHookSnapshots(prepared.workHooks)
  for (const range of prepared.ranges) {
    for (const child of existingPlans(range)) validateExternalSnapshotsDeep(child)
    const staged = "existingPlan" in range ? range.staged ? [range.staged] : [] : range.staged
    for (const child of staged) child.validateExternalSnapshots()
  }
}

function validateExternalHookSnapshots(slots: HookSlot[]): void {
  for (const slot of slots) {
    if (slot.kind !== "external-store") continue
    if (!Object.is(slot.snapshot, slot.getSnapshot())) {
      throw new ExternalStoreSnapshotChanged()
    }
  }
}

function markCommittedTree(instance: ComponentInstance<unknown>): void {
  instance.markCommitted()
  for (const child of instance.childInstances()) markCommittedTree(child)
}

function attachInstanceRefsTree(instance: ComponentInstance<unknown>): void {
  let firstError: unknown = null
  for (const child of instance.childInstances()) {
    try { attachInstanceRefsTree(child) } catch (error) { firstError ??= error }
  }
  try { instance.attachCommittedRefs() } catch (error) { firstError ??= error }
  if (firstError) throw firstError
}

function runInstancePhaseTree(instance: ComponentInstance<unknown>, phase: EffectPhase): void {
  let firstError: unknown = null
  for (const child of instance.childInstances()) {
    try { runInstancePhaseTree(child, phase) } catch (error) { firstError ??= error }
  }
  try { instance.runCommitPhase(phase) } catch (error) { firstError ??= error }
  if (firstError) throw firstError
}

function discardPreparedUpdate(prepared: PreparedComponentUpdate): void {
  discardPreparedRanges(prepared.ranges)
}

function discardPreparedRanges(ranges: PreparedRange[]): void {
  for (const range of ranges) {
    for (const child of existingPlans(range)) discardPreparedUpdate(child)
    const staged = "existingPlan" in range ? range.staged ? [range.staged] : [] : range.staged
    for (const child of staged) safeDispose(child)
  }
}

function existingPlans(range: PreparedRange): readonly PreparedComponentUpdate[] {
  if ("existingPlan" in range) return range.existingPlan ? [range.existingPlan] : []
  return range.existingPlans
}

function safeDispose(instance: ComponentInstance<unknown>): void {
  try { instance.dispose() } catch {}
}

function bindingTargets(binding: HostBinding): Node[] {
  if (binding.kind === "child" || binding.kind === "conditional" || binding.kind === "keyed") {
    return [binding.start, binding.end]
  }
  return [binding.target]
}

function validateEmptyRange(start: Node, end: Node, componentName: string): void {
  if (!start.parentNode || start.parentNode !== end.parentNode || start.nextSibling !== end) {
    throw new CompiledTemplateError(`${componentName} requires an initially empty ordered range`)
  }
}

function precedes(start: Node, end: Node): boolean {
  for (let current: Node | null = start; current; current = current.nextSibling) {
    if (current === end) return true
  }
  return false
}

let currentInstance: ComponentInstance<unknown> | null = null
let currentHookSlots: HookSlot[] | null = null
let currentContextFrame: ContextFrame | null = null
let currentHookIndex = 0
let renderPhaseUpdate = false
let currentEffectPhase: EffectPhase | null = null

export function createRoot(container: RootContainer, options: RootOptions = {}): ComponentRoot {
  if (!(container instanceof Element) && !(container instanceof DocumentFragment)) {
    throw new TypeError("createRoot expects an @zavx0z/dom Element or DocumentFragment")
  }
  const document = container.ownerDocument
  if (!document) throw new TypeError("The component root container has no ownerDocument")
  if (roots.has(container)) throw new Error("This container already has a live component root")
  const scheduler = schedulerFor(document)
  const rootId = scheduler.nextRootId()
  const prefix = options.identifierPrefix ?? ""
  let instance: ComponentInstance<unknown> | null = null
  let active = true

  const root: ComponentRoot = {
    batch<Result>(callback: () => Result): Result {
      assertRootActive(active)
      return scheduler.batch(callback)
    },

    flush(): number {
      assertRootActive(active)
      return scheduler.flush()
    },

    render<Props>(
      template: CompiledTemplate<Props> | JsxSourceElement,
      props?: Readonly<Props>,
      renderOptions: RenderOptions = {}
    ): void {
      assertRootActive(active)
      if (!isCompiledTemplate(template)) {
        throw new TypeError(
          "JSX reached @zavx0z/react at runtime; enable @zavx0z/template/compiler",
        )
      }
      const key = normalizeKey(renderOptions.key)
      if (instance?.matches(template as CompiledTemplate<unknown>, key)) {
        const current = instance as ComponentInstance<Props>
        current.scheduleProps(props as Readonly<Props>)
        return
      }

      const staged = new ComponentInstance(
        scheduler,
        rootId,
        prefix,
        template,
        props as Readonly<Props>,
        key,
        null,
        noContextProvisions
      )
      const previous = instance
      try {
        let attempts = 0
        while (true) {
          attempts += 1
          if (attempts > MAX_RENDER_PHASE_UPDATES) {
            throw new HookContractError(
              `${template.displayName} received an unstable external-store snapshot`
            )
          }
          try {
            document.transaction(() => {
              staged.validateExternalSnapshots()
              container.replaceChildren(staged.stagedRegion)
            })
            break
          } catch (error) {
            if (!(error instanceof ExternalStoreSnapshotChanged)) throw error
            staged.stabilizeDetached()
          }
        }
      } catch (error) {
        staged.dispose()
        throw error
      }
      instance = staged as ComponentInstance<unknown>
      let commitError: unknown = null
      scheduler.batch(() => {
        try { previous?.dispose() } catch (error) { commitError = error }
        try { staged.commitToDocument() } catch (error) { commitError ??= error }
      })
      if (commitError) throw commitError
    },

    stats(): ComponentRuntimeStats {
      return scheduler.stats()
    },

    unmount(): void {
      if (!active) return
      const previous = instance
      instance = null
      try {
        document.transaction(() => container.replaceChildren())
        previous?.dispose()
      } finally {
        active = false
        roots.delete(container)
      }
    }
  }

  roots.set(container, root)
  return root
}

export function batch<Result>(document: Document, callback: () => Result): Result {
  return schedulerFor(document).batch(callback)
}

export function useState<Value>(initialState: Value | (() => Value)): [Value, StateDispatch<Value>] {
  const {index, instance, slots} = nextHook("state")
  let slot = slots[index] as StateHook | undefined
  if (!slot) {
    const value = typeof initialState === "function"
      ? (initialState as () => Value)()
      : initialState
    const dispatch: StateDispatch<Value> = action => instance.dispatchState(index, action)
    slot = {
      dispatch: dispatch as StateDispatch<unknown>,
      kind: "state",
      pendingApplied: false,
      queue: {head: null, tail: null},
      value
    }
    slots[index] = slot
  }
  applyPendingState(slot)
  return [slot.value as Value, slot.dispatch as StateDispatch<Value>]
}

export function useReducer<State, Action, Initial = State>(
  reducer: Reducer<State, Action>,
  initialArg: Initial,
  initializer?: (initialArg: Initial) => State
): [State, Dispatch<Action>] {
  if (typeof reducer !== "function") throw new TypeError("useReducer requires a reducer function")
  const {index, instance, slots} = nextHook("reducer")
  let slot = slots[index] as ReducerHook | undefined
  if (!slot) {
    const value = initializer ? initializer(initialArg) : initialArg as unknown as State
    const dispatch: Dispatch<Action> = action => instance.dispatchReducer(index, action)
    slot = {
      dispatch: dispatch as Dispatch<unknown>,
      kind: "reducer",
      pendingApplied: false,
      queue: {head: null, tail: null},
      reducer: reducer as Reducer<unknown, unknown>,
      value
    }
    slots[index] = slot
  } else {
    slot.reducer = reducer as Reducer<unknown, unknown>
  }
  applyPendingReducer(slot)
  return [slot.value as State, slot.dispatch as Dispatch<Action>]
}

export function useRef<Value>(initialValue: Value): MutableRefObject<Value> {
  const {index, slots} = nextHook("ref")
  let slot = slots[index] as RefHook | undefined
  if (!slot) {
    slot = {kind: "ref", ref: {current: initialValue}}
    slots[index] = slot
  }
  return slot.ref as MutableRefObject<Value>
}

export function useMemo<Value>(factory: () => Value, dependencies: DependencyList): Value {
  if (typeof factory !== "function") throw new TypeError("useMemo requires a factory function")
  assertDependencies(dependencies, "useMemo")
  const {index, slots} = nextHook("memo")
  let slot = slots[index] as MemoHook | undefined
  if (!slot) {
    slot = {dependencies: [...dependencies], kind: "memo", value: factory()}
    slots[index] = slot
  } else if (!sameDependencies(slot.dependencies, dependencies)) {
    slot.dependencies = [...dependencies]
    slot.value = factory()
  }
  return slot.value as Value
}

export function useCallback<Callback extends (...arguments_: any[]) => unknown>(
  callback: Callback,
  dependencies: DependencyList
): Callback {
  if (typeof callback !== "function") throw new TypeError("useCallback requires a function")
  return useMemo(() => callback, dependencies)
}

export function useId(): string {
  const {index, instance, slots} = nextHook("id")
  let slot = slots[index] as IdHook | undefined
  if (!slot) {
    slot = {kind: "id", value: instance.nextId()}
    slots[index] = slot
  }
  return slot.value
}

export function use(_resource: unknown): never {
  return unsupported("use")
}

export function useActionState(..._arguments: unknown[]): never {
  return unsupported("useActionState")
}

export function useContext<Value>(context: Context<Value>): Value {
  if (!isContext(context)) throw new TypeError("useContext expects a createContext result")
  const {index, slots} = nextHook("context")
  const value = readContextValue(currentContextFrame, context)
  let slot = slots[index] as ContextHook | undefined
  if (!slot) {
    slot = {context: context as Context<unknown>, kind: "context", value}
    slots[index] = slot
  } else {
    slot.context = context as Context<unknown>
    slot.value = value
  }
  return value
}

export function useDebugValue<Value>(
  value: Value,
  format?: (value: Value) => unknown
): void {
  if (format !== undefined && typeof format !== "function") {
    throw new TypeError("useDebugValue formatter must be a function")
  }
  const {index, slots} = nextHook("debug")
  let slot = slots[index] as DebugHook | undefined
  if (!slot) {
    slot = {format: format as ((value: unknown) => unknown) | undefined, kind: "debug", value}
    slots[index] = slot
  } else {
    slot.format = format as ((value: unknown) => unknown) | undefined
    slot.value = value
  }
}

export function useDeferredValue(..._arguments: unknown[]): never {
  return unsupported("useDeferredValue")
}

export function useEffect(setup: EffectCallback, dependencies?: DependencyList): void {
  useEffectPhase("passive", setup, dependencies)
}

export function useEffectEvent<Callback extends (...arguments_: any[]) => unknown>(
  callback: Callback
): Callback {
  if (typeof callback !== "function") throw new TypeError("useEffectEvent requires a callback")
  const {index, instance, slots} = nextHook("effect-event")
  let slot = slots[index] as EffectEventHook | undefined
  if (!slot) {
    slot = {
      cell: {
        callback: callback as (...arguments_: unknown[]) => unknown,
        instance
      },
      kind: "effect-event",
      nextCallback: callback as (...arguments_: unknown[]) => unknown
    }
    slots[index] = slot
  } else {
    slot.nextCallback = callback as (...arguments_: unknown[]) => unknown
  }
  const cell = slot.cell
  return ((...arguments_: unknown[]) => {
    if (currentInstance) throw new HookContractError("An Effect Event cannot run during render")
    if (!cell.instance.active && currentEffectPhase === null) {
      throw new HookContractError("An Effect Event cannot run after component disposal")
    }
    return cell.callback(...arguments_)
  }) as Callback
}

export function useImperativeHandle<Value>(
  ref: Ref<Value> | undefined,
  createHandle: () => Value,
  dependencies?: DependencyList
): void {
  if (typeof createHandle !== "function") {
    throw new TypeError("useImperativeHandle requires a createHandle function")
  }
  const normalizedRef = ref ?? null
  assertRef(normalizedRef, "useImperativeHandle")
  const nextDependencies = normalizeDependencies(dependencies, "useImperativeHandle")
  const {index, slots} = nextHook("imperative")
  let slot = slots[index] as ImperativeHook | undefined
  if (!slot) {
    slot = {
      cleanup: null,
      createHandle: createHandle as () => unknown,
      dependencies: nextDependencies,
      kind: "imperative",
      needsRun: true,
      ref: normalizedRef as Ref<unknown>
    }
    slots[index] = slot
    return
  }
  const changed = slot.needsRun || !Object.is(slot.ref, normalizedRef) ||
    dependenciesChanged(slot.dependencies, nextDependencies)
  if (!changed) return
  slot.createHandle = createHandle as () => unknown
  slot.dependencies = nextDependencies
  slot.needsRun = true
  slot.ref = normalizedRef as Ref<unknown>
}

export function useInsertionEffect(setup: EffectCallback, dependencies?: DependencyList): void {
  useEffectPhase("insertion", setup, dependencies)
}

export function useLayoutEffect(setup: EffectCallback, dependencies?: DependencyList): void {
  useEffectPhase("layout", setup, dependencies)
}

export function useOptimistic(..._arguments: unknown[]): never {
  return unsupported("useOptimistic")
}

export function useSyncExternalStore<Snapshot>(
  subscribe: ExternalStoreSubscribe,
  getSnapshot: () => Snapshot,
  getServerSnapshot?: () => Snapshot
): Snapshot {
  if (typeof subscribe !== "function") {
    throw new TypeError("useSyncExternalStore requires a subscribe function")
  }
  if (typeof getSnapshot !== "function") {
    throw new TypeError("useSyncExternalStore requires a getSnapshot function")
  }
  if (getServerSnapshot !== undefined && typeof getServerSnapshot !== "function") {
    throw new TypeError("useSyncExternalStore getServerSnapshot must be a function")
  }
  const snapshot = getSnapshot()
  const {index, slots} = nextHook("external-store")
  let slot = slots[index] as ExternalStoreHook | undefined
  if (!slot) {
    slot = {
      getServerSnapshot: getServerSnapshot as (() => unknown) | undefined,
      getSnapshot,
      index,
      kind: "external-store",
      needsSubscribe: true,
      snapshot,
      subscribe,
      unsubscribe: null
    }
    slots[index] = slot
  } else {
    if (!Object.is(slot.subscribe, subscribe)) slot.needsSubscribe = true
    slot.getServerSnapshot = getServerSnapshot as (() => unknown) | undefined
    slot.getSnapshot = getSnapshot
    slot.snapshot = snapshot
    slot.subscribe = subscribe
  }
  return snapshot
}

export function useTransition(..._arguments: unknown[]): never {
  return unsupported("useTransition")
}

function schedulerFor(document: Document): DocumentScheduler {
  let scheduler = schedulers.get(document)
  if (!scheduler) {
    scheduler = new DocumentScheduler(document)
    schedulers.set(document, scheduler)
  }
  return scheduler
}

function normalizeKey(key: ComponentKey | undefined): ComponentKey {
  if (key === undefined || key === null) return null
  if (typeof key !== "string" && typeof key !== "number") {
    throw new TypeError("A component key must be a string, number, or null")
  }
  return key
}

function assertRootActive(active: boolean): void {
  if (!active) throw new Error("Cannot use an unmounted component root")
}

function nextHook(kind: HookSlot["kind"]): {
  index: number
  instance: ComponentInstance<unknown>
  slots: HookSlot[]
} {
  const instance = currentInstance
  const slots = currentHookSlots
  if (!instance || !slots) throw new HookContractError(`${hookName(kind)} called outside component render`)
  const index = currentHookIndex
  currentHookIndex += 1
  const existing = slots[index]
  if (existing && existing.kind !== kind) {
    throw new HookContractError(
      `${instance.template.displayName} changed hook ${index} from ${hookName(existing.kind)} to ${hookName(kind)}`
    )
  }
  return {index, instance, slots}
}

function hookName(kind: HookSlot["kind"]): string {
  switch (kind) {
    case "state": return "useState"
    case "reducer": return "useReducer"
    case "ref": return "useRef"
    case "memo": return "useMemo/useCallback"
    case "id": return "useId"
    case "context": return "useContext"
    case "effect": return "useEffect/useLayoutEffect/useInsertionEffect"
    case "imperative": return "useImperativeHandle"
    case "external-store": return "useSyncExternalStore"
    case "debug": return "useDebugValue"
    case "effect-event": return "useEffectEvent"
  }
}

function cloneHook(slot: HookSlot): HookSlot {
  switch (slot.kind) {
    case "state": return {...slot, pendingApplied: false}
    case "reducer": return {...slot, pendingApplied: false}
    case "ref": return {...slot}
    case "memo": return {...slot, dependencies: [...slot.dependencies]}
    case "id": return {...slot}
    case "context": return {...slot}
    case "effect": return {
      ...slot,
      dependencies: slot.dependencies ? [...slot.dependencies] : null
    }
    case "imperative": return {
      ...slot,
      dependencies: slot.dependencies ? [...slot.dependencies] : null
    }
    case "external-store": return {...slot}
    case "debug": return {...slot}
    case "effect-event": return {...slot}
  }
}

function appendUpdate<Action>(queue: UpdateQueue<Action>, action: Action): void {
  const update: HookUpdate<Action> = {action, next: null}
  if (queue.tail) queue.tail.next = update
  else queue.head = update
  queue.tail = update
}

function applyPendingState(slot: StateHook): void {
  if (slot.pendingApplied) return
  slot.pendingApplied = true
  let value = slot.value
  for (let update = slot.queue.head; update; update = update.next) {
    value = typeof update.action === "function"
      ? (update.action as (previous: unknown) => unknown)(value)
      : update.action
  }
  slot.value = value
}

function applyPendingReducer(slot: ReducerHook): void {
  if (slot.pendingApplied) return
  slot.pendingApplied = true
  let value = slot.value
  for (let update = slot.queue.head; update; update = update.next) {
    value = slot.reducer(value, update.action)
  }
  slot.value = value
}

function clearPendingHookQueues(slots: HookSlot[]): void {
  for (const slot of slots) {
    if (slot.kind !== "state" && slot.kind !== "reducer") continue
    slot.queue.head = null
    slot.queue.tail = null
    slot.pendingApplied = false
  }
}

function runEffectHook(instance: ComponentInstance<unknown>, slot: EffectHook): void {
  if (!slot.needsRun) return
  let firstError: unknown = null
  const previousCleanup = slot.cleanup
  slot.cleanup = null
  if (previousCleanup) {
    try { invokeEffect(instance, slot.phase, previousCleanup) } catch (error) { firstError = error }
  }
  try {
    const cleanup = invokeEffect(instance, slot.phase, slot.setup)
    if (cleanup !== undefined && typeof cleanup !== "function") {
      throw new TypeError(`${effectHookName(slot.phase)} setup must return a function or undefined`)
    }
    slot.cleanup = cleanup ?? null
    slot.needsRun = false
  } catch (error) {
    firstError ??= error
  }
  if (firstError) throw firstError
}

function runImperativeHook(instance: ComponentInstance<unknown>, slot: ImperativeHook): void {
  if (!slot.needsRun) return
  let firstError: unknown = null
  let handle: unknown
  if (slot.ref !== null) {
    try {
      handle = invokeEffect(instance, "layout", slot.createHandle)
    } catch (error) {
      throw error
    }
  }
  if (slot.cleanup) {
    try { invokeEffect(instance, "layout", slot.cleanup) } catch (error) { firstError = error }
  }
  slot.cleanup = null
  try {
    slot.cleanup = slot.ref === null ? null : attachImperativeRef(slot.ref, handle)
    slot.needsRun = false
  } catch (error) {
    firstError ??= error
  }
  if (firstError) throw firstError
}

function synchronizeExternalStore(
  instance: ComponentInstance<unknown>,
  slot: ExternalStoreHook
): void {
  if (!slot.needsSubscribe) return
  let firstError: unknown = null
  if (slot.unsubscribe) {
    try { invokeEffect(instance, "layout", slot.unsubscribe) } catch (error) { firstError = error }
  }
  slot.unsubscribe = null
  try {
    const unsubscribe = invokeEffect(instance, "layout", () =>
      slot.subscribe(() => instance.notifyExternalStore(slot.index))
    )
    if (typeof unsubscribe !== "function") {
      throw new TypeError("useSyncExternalStore subscribe must return an unsubscribe function")
    }
    slot.unsubscribe = unsubscribe
    slot.needsSubscribe = false
    if (!Object.is(slot.snapshot, slot.getSnapshot())) {
      instance.scheduler.enqueue(instance)
    }
  } catch (error) {
    firstError ??= error
  }
  if (firstError) throw firstError
}

function cleanupComponentHooks(
  instance: ComponentInstance<unknown>,
  slots: HookSlot[]
): void {
  let firstError: unknown = null
  for (const phase of ["insertion", "layout", "passive"] as const) {
    for (const slot of slots) {
      try {
        if (slot.kind === "effect" && slot.phase === phase && slot.cleanup) {
          const cleanup = slot.cleanup
          slot.cleanup = null
          slot.needsRun = false
          invokeEffect(instance, phase, cleanup)
        } else if (phase === "layout" && slot.kind === "imperative" && slot.cleanup) {
          const cleanup = slot.cleanup
          slot.cleanup = null
          slot.needsRun = false
          invokeEffect(instance, "layout", cleanup)
        } else if (phase === "layout" && slot.kind === "external-store" && slot.unsubscribe) {
          const unsubscribe = slot.unsubscribe
          slot.unsubscribe = null
          slot.needsSubscribe = true
          invokeEffect(instance, "layout", unsubscribe)
        }
      } catch (error) {
        firstError ??= error
      }
    }
  }
  if (firstError) throw firstError
}

function invokeEffect<Result>(
  _instance: ComponentInstance<unknown>,
  phase: EffectPhase,
  callback: () => Result
): Result {
  const previousPhase = currentEffectPhase
  currentEffectPhase = phase
  try {
    return callback()
  } finally {
    currentEffectPhase = previousPhase
  }
}

function attachImperativeRef(ref: Ref<unknown>, handle: unknown): (() => void) | null {
  if (ref === null) return null
  if (typeof ref === "function") {
    const cleanup = ref(handle)
    if (cleanup !== undefined && typeof cleanup !== "function") {
      throw new TypeError("A callback ref must return a cleanup function or undefined")
    }
    return cleanup ?? (() => { ref(null) })
  }
  if (!ref || typeof ref !== "object" || !("current" in ref)) {
    throw new TypeError("useImperativeHandle ref must be a callback ref, ref object, or null")
  }
  ref.current = handle
  return () => {
    if (Object.is(ref.current, handle)) ref.current = null
  }
}

function effectHookName(phase: EffectPhase): string {
  if (phase === "insertion") return "useInsertionEffect"
  if (phase === "layout") return "useLayoutEffect"
  return "useEffect"
}

function assertDependencies(dependencies: DependencyList, hook: string): void {
  if (!Array.isArray(dependencies)) throw new TypeError(`${hook} dependencies must be an array`)
}

function normalizeDependencies(
  dependencies: DependencyList | undefined,
  hook: string
): DependencyList | null {
  if (dependencies === undefined) return null
  assertDependencies(dependencies, hook)
  return [...dependencies]
}

function dependenciesChanged(
  previous: DependencyList | null,
  next: DependencyList | null
): boolean {
  return previous === null || next === null || !sameDependencies(previous, next)
}

function useEffectPhase(
  phase: EffectPhase,
  setup: EffectCallback,
  dependencies?: DependencyList
): void {
  const hook = effectHookName(phase)
  if (typeof setup !== "function") throw new TypeError(`${hook} requires a setup function`)
  const nextDependencies = normalizeDependencies(dependencies, hook)
  const {index, instance, slots} = nextHook("effect")
  let slot = slots[index] as EffectHook | undefined
  if (!slot) {
    slot = {
      cleanup: null,
      dependencies: nextDependencies,
      kind: "effect",
      needsRun: true,
      phase,
      setup
    }
    slots[index] = slot
    return
  }
  if (slot.phase !== phase) {
    throw new HookContractError(
      `${instance.template.displayName} changed hook ${index} from ${effectHookName(slot.phase)} to ${hook}`
    )
  }
  if (!slot.needsRun && !dependenciesChanged(slot.dependencies, nextDependencies)) return
  slot.dependencies = nextDependencies
  slot.needsRun = true
  slot.setup = setup
}

function assertRef(ref: unknown, hook: string): void {
  if (ref === null || typeof ref === "function") return
  if (typeof ref === "object" && "current" in ref) return
  throw new TypeError(`${hook} ref must be a callback ref, ref object, or null`)
}

function applyContextProvisions(
  parent: ContextFrame | null,
  provisions: readonly ContextProvision[]
): ContextFrame | null {
  let frame = parent
  for (const provision of provisions) {
    frame = {
      context: provision.context,
      parent: frame,
      value: provision.value
    }
  }
  return frame
}

function readContextValue<Value>(frame: ContextFrame | null, context: Context<Value>): Value {
  for (let current = frame; current; current = current.parent) {
    if (current.context === context) return current.value as Value
  }
  return contextDefaultValue(context)
}

function sameDependencies(left: DependencyList, right: DependencyList): boolean {
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
}

function prepareBindingPatch(binding: RuntimeBinding, sourceValue: unknown): PreparedPatch | null {
  switch (binding.kind) {
    case "text": return prepareTextPatch(binding, sourceValue)
    case "property": return preparePropertyPatch(binding, sourceValue)
    case "style": return prepareStylePatch(binding, sourceValue)
    case "event": return prepareEventPatch(binding, sourceValue)
    case "ref": throw new CompiledTemplateError("Ref bindings require the commit-ref phase")
    case "child": throw new CompiledTemplateError("Child bindings require the range phase")
    case "conditional": throw new CompiledTemplateError("Conditional bindings require the range phase")
    case "keyed": throw new CompiledTemplateError("Keyed bindings require the range phase")
  }
}

function prepareTextPatch(binding: RuntimeTextBinding, sourceValue: unknown): PreparedPatch | null {
  const next = textValue(sourceValue)
  const previous = binding.definition.target.data
  if (Object.is(previous, next)) {
    binding.value = next
    return null
  }
  return {
    apply: () => { binding.definition.target.data = next },
    rollback: () => { binding.definition.target.data = previous },
    commit: () => { binding.value = next }
  }
}

function preparePropertyPatch(
  binding: RuntimePropertyBinding,
  sourceValue: unknown
): PreparedPatch | null {
  const operation = propertyOperation(binding.definition.target, binding.definition.name, sourceValue)
  const previous = operation.current()
  if (Object.is(previous, operation.next)) {
    binding.value = operation.next
    return null
  }
  return {
    apply: () => operation.write(operation.next),
    rollback: () => operation.write(previous),
    commit: () => { binding.value = operation.next }
  }
}

function prepareStylePatch(binding: RuntimeStyleBinding, sourceValue: unknown): PreparedPatch | null {
  const next = resolveStyleValue(sourceValue as StyleBindingValue)
  const previous = binding.value === unset
    ? initialResolvedStyle(binding.definition.target.getAttribute("style"))
    : binding.value
  if (
    previous.signature === next.signature &&
    binding.definition.target.getAttribute("style") === next.cssText &&
    next.attributes.every(attribute => binding.definition.target.hasAttribute(attribute))
  ) {
    binding.value = next
    return null
  }
  return {
    apply: () => writeResolvedStyle(binding.definition.target, previous, next),
    rollback: () => writeResolvedStyle(binding.definition.target, next, previous),
    commit: () => { binding.value = next }
  }
}

function prepareEventPatch(binding: RuntimeEventBinding, sourceValue: unknown): PreparedPatch | null {
  const next = sourceValue === null || sourceValue === undefined
    ? null
    : eventHandler(sourceValue)
  if (Object.is(binding.handler, next)) {
    binding.value = next
    return null
  }
  const previous = binding.handler
  return {
    apply: () => { binding.handler = next },
    rollback: () => { binding.handler = previous },
    commit: () => { binding.value = next }
  }
}

function prepareRefChange(
  binding: RuntimeRefBinding,
  sourceValue: unknown
): PreparedRefChange | null {
  const next = callbackRef(sourceValue)
  if (binding.value !== unset && Object.is(binding.value, next)) return null
  return {binding, next}
}

function transitionRef(binding: RuntimeRefBinding, next: CallbackRef | null): void {
  const previous = binding.value === unset ? null : binding.value
  detachRef(binding)
  binding.value = next
  if (!next) return
  try {
    attachRef(binding, next)
  } catch (error) {
    binding.value = previous
    binding.cleanup = null
    binding.attached = false
    if (previous) attachRef(binding, previous)
    throw error
  }
}

function textValue(value: unknown): string {
  if (value === null || value === undefined || typeof value === "boolean") return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return String(value)
  }
  throw new TypeError("A compiled text binding requires a primitive value")
}

function eventHandler(value: unknown): EventHandler {
  if (typeof value !== "function") throw new TypeError("An event binding requires a function or null")
  return value as EventHandler
}

function callbackRef(value: unknown): CallbackRef | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "function") throw new TypeError("A ref binding requires a callback or null")
  return value as CallbackRef
}

function attachRef(binding: RuntimeRefBinding, callback: CallbackRef): void {
  const cleanup = callback(binding.definition.target)
  if (cleanup !== undefined && typeof cleanup !== "function") {
    try { callback(null) } catch {}
    throw new TypeError("A callback ref cleanup must be a function or undefined")
  }
  binding.value = callback
  binding.cleanup = cleanup ?? null
  binding.attached = true
}

function detachRef(binding: RuntimeRefBinding): void {
  if (!binding.attached) return
  const callback = binding.value === unset ? null : binding.value
  const cleanup = binding.cleanup
  binding.attached = false
  binding.cleanup = null
  if (cleanup) cleanup()
  else callback?.(null)
}

function propertyOperation(target: Element, name: string, value: unknown): PropertyOperation {
  if (name === "style") {
    throw new CompiledTemplateError("Style values require a bindStyle binding")
  }
  if (name === "value" && (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLOptionElement
  )) {
    const next = value === null || value === undefined ? "" : String(value)
    return {current: () => target.value, next, write: source => { target.value = source as string }}
  }
  if (name === "checked" && target instanceof HTMLInputElement) {
    const next = Boolean(value)
    return {current: () => target.checked, next, write: source => { target.checked = source as boolean }}
  }
  if (name === "indeterminate" && target instanceof HTMLInputElement) {
    const next = Boolean(value)
    return {
      current: () => target.indeterminate,
      next,
      write: source => { target.indeterminate = source as boolean }
    }
  }
  if (name === "selected" && target instanceof HTMLOptionElement) {
    const next = Boolean(value)
    return {current: () => target.selected, next, write: source => { target.selected = source as boolean }}
  }
  if (name === "selectedIndex" && target instanceof HTMLSelectElement) {
    const next = Number(value)
    if (!Number.isFinite(next)) throw new TypeError("selectedIndex must be a finite number")
    return {
      current: () => target.selectedIndex,
      next,
      write: source => { target.selectedIndex = source as number }
    }
  }
  if (name === "tabIndex" && target instanceof HTMLElement) {
    const next = Number(value)
    if (!Number.isFinite(next)) throw new TypeError("tabIndex must be a finite number")
    return {current: () => target.tabIndex, next, write: source => { target.tabIndex = source as number }}
  }
  const attributeName = name === "className" ? "class" : name
  const next = attributeValue(value, name)
  return {
    current: () => target.getAttribute(attributeName),
    next,
    write: source => {
      if (source === null) target.removeAttribute(attributeName)
      else target.setAttribute(attributeName, source as string)
    }
  }
}

function attributeValue(value: unknown, name: string): string | null {
  if (value === null || value === undefined || value === false) return null
  if (value === true) return ""
  if (
    typeof value === "string" || typeof value === "number" || typeof value === "bigint"
  ) return String(value)
  throw new TypeError(`Host property ${name} requires a primitive value`)
}

function initialResolvedStyle(cssText: string | null): ResolvedStyleValue {
  return Object.freeze({
    attributes: Object.freeze([]),
    cssText,
    signature: `\u0001${cssText ?? ""}`
  })
}

function writeResolvedStyle(
  target: Element,
  previous: ResolvedStyleValue,
  next: ResolvedStyleValue
): void {
  const nextAttributes = new Set(next.attributes)
  for (const attribute of previous.attributes) {
    if (!nextAttributes.has(attribute)) target.removeAttribute(attribute)
  }
  for (const attribute of next.attributes) {
    if (!target.hasAttribute(attribute)) target.setAttribute(attribute, "")
  }
  if (next.cssText === null) target.removeAttribute("style")
  else target.setAttribute("style", next.cssText)
}

function unsupported(feature: string): never {
  throw new UnsupportedReactFeatureError(feature)
}
