import type {Document, HTMLElement} from "@zavx0z/dom"
import type {ComponentRoot} from "@zavx0z/react"

type RawStory = Readonly<{
  element: HTMLElement
  componentRoot: Pick<ComponentRoot, "readStyleSheets">
  source: Readonly<{html: string; typescript: string}>
  dispose?(): void
}>

export type RoutedOwnerStory = Readonly<{
  story: Readonly<{
    element: HTMLElement
    componentRoot: Pick<ComponentRoot, "readStyleSheets">
    source: Readonly<{html: string; typescript: string}>
    dispose(): void
  }>
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

export function routeStory(story: RawStory): RoutedOwnerStory {
  return Object.freeze({
    story: Object.freeze({
      element: story.element,
      componentRoot: story.componentRoot,
      source: story.source,
      dispose: () => story.dispose?.(),
    }),
  })
}
