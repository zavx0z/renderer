import {
  DocumentFragment,
  Element,
  Event,
  Node,
  Text
} from "@zavx0z/dom"
import {createContext} from "react"
import ReactReconciler from "react-reconciler"
import {
  ConcurrentRoot,
  ContinuousEventPriority,
  DefaultEventPriority,
  DiscreteEventPriority,
  NoEventPriority
} from "react-reconciler/constants"
import {
  applyProperties,
  clearDeletedProperties
} from "./properties.ts"
import type {HostProps, InvokeEvent} from "./properties.ts"

export type RootContainer = Element | DocumentFragment

type HostContext = Readonly<Record<string, never>>
type HostInstance = Element
type HostTextInstance = Text
type HostNode = HostInstance | HostTextInstance
type TimeoutHandle = ReturnType<typeof setTimeout>
type TransitionStatus = null

type HostConfig = ReactReconciler.HostConfig<
  string,
  HostProps,
  RootContainer,
  HostInstance,
  HostTextInstance,
  never,
  never,
  HostInstance,
  HostNode,
  HostContext,
  never,
  TimeoutHandle,
  -1,
  TransitionStatus
>

type RuntimeHostExtensions = {
  rendererVersion: string
  rendererPackageName: string
  extraDevToolsConfig: null
  maySuspendCommitOnUpdate(type: string, oldProps: HostProps, newProps: HostProps): boolean
  maySuspendCommitInSyncRender(type: string, props: HostProps): boolean
  getSuspendedCommitReason(state: null, container: RootContainer): null
  supportsTestSelectors: false
  supportsResources: false
  supportsSingletons: false
}

const instanceHandles = new WeakMap<Node, ReactReconciler.Fiber>()
const rootHostContext: HostContext = Object.freeze({})
const hostTransitionContext = createContext<TransitionStatus>(null) as unknown as
  ReactReconciler.ReactContext<TransitionStatus>

let currentUpdatePriority: ReactReconciler.EventPriority = NoEventPriority
let currentEventType: string | null = null
let currentEventTimeStamp = -1

function eventPriority(type: string): ReactReconciler.EventPriority {
  return type === "pointermove" || type === "pointerenter" || type === "pointerleave" ||
    type === "pointerover" || type === "pointerout"
    ? ContinuousEventPriority
    : DiscreteEventPriority
}

let reconciler: ReactReconciler.Reconciler<
  RootContainer,
  HostInstance,
  HostTextInstance,
  never,
  HostInstance,
  HostNode
>

const invokeEvent: InvokeEvent = (element, callback, event) => {
  const previousPriority = currentUpdatePriority
  const previousType = currentEventType
  const previousTimeStamp = currentEventTimeStamp
  currentUpdatePriority = eventPriority(event.type)
  currentEventType = event.type
  currentEventTimeStamp = event.timeStamp

  try {
    return element.ownerDocument!.transaction(() => {
      const result = reconciler.discreteUpdates(
        dispatchedEvent => callback(dispatchedEvent),
        event,
        undefined,
        undefined,
        undefined
      )
      if (!reconciler.isAlreadyRendering()) reconciler.flushSyncWork()
      return result
    })
  } finally {
    currentUpdatePriority = previousPriority
    currentEventType = previousType
    currentEventTimeStamp = previousTimeStamp
  }
}

function appendChild(parent: RootContainer | HostInstance, child: HostNode): void {
  parent.appendChild(child)
}

function insertBefore(
  parent: RootContainer | HostInstance,
  child: HostNode,
  beforeChild: HostNode
): void {
  parent.insertBefore(child, beforeChild)
}

function removeChild(parent: RootContainer | HostInstance, child: HostNode): void {
  detachDeletedTree(child)
  parent.removeChild(child)
}

function detachDeletedTree(node: Node): void {
  clearDeletedProperties(node)
  const visit = (current: Node): void => {
    instanceHandles.delete(current)
    for (const child of current.childNodes) visit(child)
  }
  visit(node)
}

function clearContainer(container: RootContainer): void {
  while (container.firstChild) removeChild(container, container.firstChild as HostNode)
}

const hostConfig: HostConfig & RuntimeHostExtensions = {
  rendererVersion: "19.2.0",
  rendererPackageName: "@zavx0z/dom-react",
  extraDevToolsConfig: null,
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  supportsMicrotasks: true,
  supportsTestSelectors: false,
  supportsResources: false,
  supportsSingletons: false,
  isPrimaryRenderer: false,
  warnsIfNotActing: false,
  noTimeout: -1,
  NotPendingTransition: null,
  HostTransitionContext: hostTransitionContext,

  createInstance(type, props, rootContainer, _hostContext, internalHandle) {
    const instance = rootContainer.ownerDocument!.createElement(type)
    instanceHandles.set(instance, internalHandle)
    applyProperties(instance, {}, props, invokeEvent)
    return instance
  },

  createTextInstance(text, rootContainer, _hostContext, internalHandle) {
    const instance = rootContainer.ownerDocument!.createTextNode(text)
    instanceHandles.set(instance, internalHandle)
    return instance
  },

  appendInitialChild: appendChild,
  appendChild,
  appendChildToContainer: appendChild,
  insertBefore,
  insertInContainerBefore: insertBefore,
  removeChild,
  removeChildFromContainer: removeChild,
  clearContainer,

  finalizeInitialChildren() {
    return false
  },

  shouldSetTextContent() {
    return false
  },

  getRootHostContext() {
    return rootHostContext
  },

  getChildHostContext(parentHostContext) {
    return parentHostContext
  },

  getPublicInstance(instance) {
    return instance
  },

  prepareForCommit() {
    return null
  },

  resetAfterCommit() {},
  preparePortalMount() {},
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  prepareScopeUpdate() {},

  getInstanceFromScope() {
    return null
  },

  getInstanceFromNode(node) {
    return node instanceof Node ? instanceHandles.get(node) ?? null : null
  },

  detachDeletedInstance(instance) {
    detachDeletedTree(instance)
  },

  commitUpdate(instance, _type, previousProps, nextProps) {
    applyProperties(instance, previousProps, nextProps, invokeEvent)
  },

  commitTextUpdate(instance, _oldText, newText) {
    instance.data = newText
  },

  resetTextContent(instance) {
    instance.textContent = ""
  },

  hideInstance(instance) {
    instance.setAttribute("hidden", "")
  },

  hideTextInstance(instance) {
    instance.data = ""
  },

  unhideInstance(instance, props) {
    const hidden = props.hidden
    if (hidden === null || hidden === undefined || hidden === false) instance.removeAttribute("hidden")
    else instance.setAttribute("hidden", hidden === true ? "" : String(hidden))
  },

  unhideTextInstance(instance, text) {
    instance.data = text
  },

  scheduleTimeout(callback, delay) {
    return setTimeout(callback, delay)
  },

  cancelTimeout(handle) {
    clearTimeout(handle)
  },

  scheduleMicrotask(callback) {
    queueMicrotask(callback)
  },

  setCurrentUpdatePriority(priority) {
    currentUpdatePriority = priority
  },

  getCurrentUpdatePriority() {
    return currentUpdatePriority
  },

  resolveUpdatePriority() {
    return currentUpdatePriority === NoEventPriority ? DefaultEventPriority : currentUpdatePriority
  },

  resolveEventType() {
    return currentEventType
  },

  resolveEventTimeStamp() {
    return currentEventTimeStamp
  },

  trackSchedulerEvent() {},

  shouldAttemptEagerTransition() {
    return false
  },

  requestPostPaintCallback(callback) {
    setTimeout(() => callback(Date.now()), 0)
  },

  maySuspendCommit() {
    return false
  },

  maySuspendCommitOnUpdate() {
    return false
  },

  maySuspendCommitInSyncRender() {
    return false
  },

  preloadInstance() {
    return true
  },

  startSuspendingCommit() {},
  suspendInstance() {},

  waitForCommitToBeReady() {
    return null
  },

  getSuspendedCommitReason() {
    return null
  },

  resetFormInstance() {}
}

reconciler = ReactReconciler(hostConfig)

export {ConcurrentRoot, instanceHandles, reconciler}
