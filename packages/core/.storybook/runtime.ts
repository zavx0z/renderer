import type {Document, Node} from "@zavx0z/dom"

type RendererStorySource = Readonly<{
  html: string
  typescript: string
}>

type RendererStoryValues = Readonly<Record<string, unknown>>

type RendererStory = Readonly<{
  element: Node
  componentRoot: Readonly<{readStyleSheets(): unknown}>
  source: RendererStorySource
  values: RendererStoryValues
  dispose(): void
}>

export type RendererStoryResult = Readonly<{
  story: RendererStory
}>

export type RendererStoryDescriptor = Readonly<{
  route: string
  create(
    document: Document,
    signal: AbortSignal,
  ): RendererStoryResult | Promise<RendererStoryResult>
}>

type RuntimeContext = Readonly<{
  document: Document
  signal: AbortSignal
  present(value: Readonly<{
    protocol: "story-presentation/1"
    node: Node
    componentRoot: RendererStory["componentRoot"]
    source: RendererStorySource
    values: RendererStoryValues
  }>): void
  reportDiagnostic(value: unknown): void
}>

type RuntimeInput = Readonly<{
  route: string
  story: unknown
  signal: AbortSignal
}>

export function defineRendererStory(
  route: string,
  create: RendererStoryDescriptor["create"],
): RendererStoryDescriptor {
  return Object.freeze({route, create})
}

export const runtime = Object.freeze({
  protocol: "storybook-runtime/3",
  create(context: RuntimeContext) {
    let current: RendererStory | null = null
    let disposed = false

    const unmount = (): void => {
      const previous = current
      current = null
      if (previous === null) return
      releaseStory(previous)
    }

    const mount = async (input: RuntimeInput): Promise<void> => {
      assertActive(disposed, context.signal, input.signal)
      const descriptor = exactDescriptor(input.story, input.route)
      const signal = AbortSignal.any([context.signal, input.signal])
      unmount()
      let candidate: RendererStory | null = null
      try {
        const result = await descriptor.create(context.document, signal)
        candidate = exactResult(result, context.document)
        assertActive(disposed, signal)
        current = candidate
        context.present(Object.freeze({
          protocol: "story-presentation/1",
          node: candidate.element,
          componentRoot: candidate.componentRoot,
          source: candidate.source,
          values: candidate.values,
        }))
        candidate = null
      } catch (error) {
        let failure = error
        if (candidate !== null) {
          if (current === candidate) current = null
          try {
            releaseStory(candidate)
          } catch (cleanupError) {
            failure = new AggregateError(
              [error, cleanupError],
              "Renderer story mount and cleanup both failed",
              {cause: error},
            )
          }
        }
        if (!isAbort(failure)) {
          context.reportDiagnostic(Object.freeze({
            phase: "runtime",
            message: failure instanceof Error ? failure.message : String(failure),
          }))
        }
        throw failure
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

function releaseStory(story: RendererStory): void {
  const failures: unknown[] = []
  try {
    if (story.element.parentNode !== null) story.element.parentNode.removeChild(story.element)
  } catch (error) {
    failures.push(error)
  }
  try {
    story.dispose()
  } catch (error) {
    failures.push(error)
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(failures, "Renderer story detach and dispose both failed")
  }
}

function exactDescriptor(value: unknown, route: string): RendererStoryDescriptor {
  if (value === null || typeof value !== "object") {
    throw new TypeError(`Invalid Renderer owner story: ${route}`)
  }
  const descriptor = value as Partial<RendererStoryDescriptor>
  if (descriptor.route !== route || typeof descriptor.create !== "function") {
    throw new TypeError(`Renderer owner story does not match route: ${route}`)
  }
  return descriptor as RendererStoryDescriptor
}

function exactResult(value: unknown, document: Document): RendererStory {
  if (value === null || typeof value !== "object") {
    throw new TypeError("Renderer owner story returned no result")
  }
  const story = (value as Partial<RendererStoryResult>).story
  if (story === null || typeof story !== "object" ||
    story.element === null || typeof story.element !== "object" ||
    story.element.ownerDocument !== document ||
    story.componentRoot === null || typeof story.componentRoot !== "object" ||
    typeof story.componentRoot.readStyleSheets !== "function" ||
    story.source === null || typeof story.source !== "object" ||
    typeof story.source.html !== "string" || typeof story.source.typescript !== "string" ||
    story.values === null || typeof story.values !== "object" || Array.isArray(story.values) ||
    typeof story.dispose !== "function") {
    throw new TypeError("Renderer owner story returned an incompatible presentation")
  }
  return story as RendererStory
}

function assertActive(disposed: boolean, ...signals: readonly AbortSignal[]): void {
  if (disposed || signals.some(({aborted}) => aborted)) {
    throw new DOMException("Renderer story mount aborted", "AbortError")
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}
