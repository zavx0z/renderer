/** Renderer-owned external Storybook story support. */
import type {Document, HTMLElement} from "@zavx0z/dom"
import type {ComponentRoot} from "@zavx0z/react"
import type {CompiledTemplate} from "@zavx0z/template/compiled"
import {
  ELEMENT_DOM_STORY_ROUTES,
  type ElementDomStoryRoute,
} from "./dom-routes.ts"
import {
  ElementDomStoryView,
  type ElementDomStoryViewProps,
} from "./dom-stories-view.tsx"
import {mountCompiledStory, serializeStoryElement} from "./compiled-story.ts"

export type ElementDomStory = Readonly<{
  element: HTMLElement
  componentRoot: ComponentRoot
  source: Readonly<{html: string; typescript: string}>
  dispose(): void
}>

export function createElementDomStory(
  document: Document,
  route: ElementDomStoryRoute,
): ElementDomStory {
  const props: ElementDomStoryViewProps = Object.freeze({route})
  const mounted = mountCompiledStory(
    document,
    ElementDomStoryView as unknown as CompiledTemplate<ElementDomStoryViewProps>,
    props,
    "[data-element-dom-story]",
  )
  return Object.freeze({
    element: mounted.element,
    componentRoot: mounted.componentRoot,
    source: Object.freeze({
      html: serializeStoryElement(mounted.element),
      typescript: renderTypeScript(route),
    }),
    dispose: mounted.dispose,
  })
}

export function isElementDomStoryRoute(route: string): route is ElementDomStoryRoute {
  return (ELEMENT_DOM_STORY_ROUTES as readonly string[]).includes(route)
}

function renderTypeScript(route: ElementDomStoryRoute): string {
  const tag = route.includes("/button/") || route.startsWith("elements/events/")
    ? "button"
    : route.includes("/input/")
      ? "input"
      : route.includes("/select/")
        ? "select"
        : route.includes("/list/")
          ? "ul"
          : route.includes("/span/")
            ? "span"
            : "div"
  return [
    'import {createDocument} from "@zavx0z/dom"',
    "",
    "const document = createDocument()",
    `const element = document.createElement(${JSON.stringify(tag)})`,
    `element.setAttribute("data-story-route", ${JSON.stringify(route)})`,
    "document.appendChild(element)",
  ].join("\n")
}
