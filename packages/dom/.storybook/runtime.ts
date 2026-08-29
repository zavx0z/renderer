import type {Document, Node} from "@zavx0z/dom"

type OwnerStoryResult = Readonly<{
  story: Readonly<{
    element: Node
    source: unknown
    props?: Readonly<Record<string, unknown>>
    dispose?(): void
  }>
}>

type OwnerStoryDescriptor = Readonly<{
  route: string
  create(document: Document): OwnerStoryResult | Promise<OwnerStoryResult>
}>

type RuntimeContext = Readonly<{
  document: Document
  signal: AbortSignal
  mount(node: Node): void
  publishInspector(value: unknown): void
  publishSource(value: unknown): void
  publishProps(value: unknown): void
  reportDiagnostic(value: unknown): void
}>

type RuntimeInput = Readonly<{route: string; story: unknown; signal: AbortSignal}>

export const runtime = Object.freeze({
  protocol: "storybook-runtime/1",
  create(context: RuntimeContext) {
    let current: OwnerStoryResult["story"] | null = null
    let disposed = false

    const unmount = (): void => {
      if (current === null) return
      const previous = current
      current = null
      if (previous.element.parentNode !== null) previous.element.parentNode.removeChild(previous.element)
      previous.dispose?.()
    }

    const mount = async (input: RuntimeInput): Promise<void> => {
      assertActive(disposed, context.signal, input.signal)
      const descriptor = ownerStory(input.story, input.route)
      unmount()
      try {
        const result = await descriptor.create(context.document)
        assertActive(disposed, context.signal, input.signal)
        const story = ownerStoryResult(result, context.document)
        current = story
        context.mount(story.element)
        context.publishSource(story.source)
        context.publishProps(story.props ?? Object.freeze({}))
        context.publishInspector(Object.freeze({route: input.route, props: story.props ?? null}))
      } catch (error) {
        context.reportDiagnostic(Object.freeze({
          phase: "runtime",
          message: error instanceof Error ? error.message : String(error),
        }))
        throw error
      }
    }

    return Object.freeze({
      mount,
      update: mount,
      unmount,
      dispose() {
        if (disposed) return
        disposed = true
        unmount()
      },
    })
  },
})

function ownerStory(value: unknown, route: string): OwnerStoryDescriptor {
  if (value === null || typeof value !== "object") throw new TypeError(`Invalid DOM owner story: ${route}`)
  const descriptor = value as Partial<OwnerStoryDescriptor>
  if (descriptor.route !== route || typeof descriptor.create !== "function") {
    throw new TypeError(`DOM owner story does not match route: ${route}`)
  }
  return descriptor as OwnerStoryDescriptor
}

function ownerStoryResult(value: unknown, document: Document): OwnerStoryResult["story"] {
  if (value === null || typeof value !== "object") throw new TypeError("DOM owner story returned no result")
  const result = value as Partial<OwnerStoryResult>
  const story = result.story
  if (story === null || typeof story !== "object" ||
    typeof story.element !== "object" || story.element.ownerDocument !== document) {
    throw new TypeError("DOM owner story returned an incompatible DOM node")
  }
  return story
}

function assertActive(disposed: boolean, ...signals: readonly AbortSignal[]): void {
  if (disposed || signals.some(({aborted}) => aborted)) throw new DOMException("Story mount aborted", "AbortError")
}
