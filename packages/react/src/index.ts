import {
  DocumentFragment,
  Element
} from "@zavx0z/dom"
import type {ReactNode} from "react"
import {ConcurrentRoot, instanceHandles, reconciler} from "./reconciler.ts"
import type {RootContainer} from "./reconciler.ts"

export interface Root {
  render(children: ReactNode): void
  unmount(): void
}

const roots = new WeakMap<RootContainer, Root>()

function assertContainer(container: RootContainer): void {
  if (!(container instanceof Element) && !(container instanceof DocumentFragment)) {
    throw new TypeError("createRoot expects an @zavx0z/dom Element or DocumentFragment")
  }
  if (!container.ownerDocument) {
    throw new TypeError("The root container must have an ownerDocument")
  }
}

function reportCaughtError(error: Error): void {
  console.error(error)
}

function reportRecoverableError(error: Error): void {
  console.error(error)
}

export function createRoot(container: RootContainer): Root {
  assertContainer(container)
  if (roots.has(container)) throw new Error("This container already has a live React root")

  let uncaughtError: Error | null = null
  const internalRoot = reconciler.createContainer(
    container,
    ConcurrentRoot,
    null,
    false,
    null,
    "",
    error => {
      uncaughtError = error
    },
    reportCaughtError,
    reportRecoverableError,
    () => undefined
  )
  let mounted = true

  const root: Root = {
    render(children) {
      if (!mounted) throw new Error("Cannot render through an unmounted React root")
      uncaughtError = null
      container.ownerDocument!.transaction(() => {
        reconciler.updateContainerSync(children, internalRoot, null, null)
        reconciler.flushSyncWork()
      })
      if (uncaughtError) throw uncaughtError
    },

    unmount() {
      if (!mounted) return
      container.ownerDocument!.transaction(() => {
        reconciler.updateContainerSync(null, internalRoot, null, null)
        reconciler.flushSyncWork()
      })
      mounted = false
      roots.delete(container)
    }
  }

  roots.set(container, root)
  return root
}

export function injectIntoDevTools(): boolean {
  return reconciler.injectIntoDevTools({
    bundleType: process.env.NODE_ENV === "production" ? 0 : 1,
    version: "19.2.0",
    rendererPackageName: "@zavx0z/dom-react",
    findFiberByHostInstance(instance) {
      return instanceHandles.get(instance) ?? null
    }
  })
}

export type {RootContainer}
