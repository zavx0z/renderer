import type {Document, HTMLElement} from "@zavx0z/dom"

type RawStory = Readonly<{
  element: HTMLElement
  source: unknown
  dispose?(): void
}>

export type RoutedOwnerStory = Readonly<{
  story: Readonly<{
    element: HTMLElement
    source: unknown
    dispose(): void
  }>
  css: string
}>

export type OwnerStoryDescriptor = Readonly<{
  route: string
  create(document: Document): RoutedOwnerStory | Promise<RoutedOwnerStory>
}>

export function defineOwnerStory(
  route: string,
  create: OwnerStoryDescriptor["create"],
): OwnerStoryDescriptor {
  return Object.freeze({route, create})
}

export function routeStory(story: RawStory, css: string): RoutedOwnerStory {
  return Object.freeze({
    story: Object.freeze({
      element: story.element,
      source: story.source,
      dispose: () => story.dispose?.(),
    }),
    css,
  })
}
