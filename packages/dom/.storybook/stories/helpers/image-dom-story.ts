/** Compiled exact HTMLImageElement Storybook stories. */
import type {Document, HTMLElement, HTMLImageElement} from "@zavx0z/dom"
import type {ComponentRoot} from "@zavx0z/react"
import type {CompiledTemplate} from "@zavx0z/template/compiled"
import {
  IMAGE_DOM_STORY_ROUTES,
  type ImageDomStoryRoute,
} from "./dom-routes.ts"
import {
  ImageDomStoryView,
  type ImageDomStoryViewProps,
} from "./dom-stories-view.tsx"
import {mountCompiledStory, serializeStoryElement} from "./compiled-story.ts"

export type ImageDomStoryRefs = Readonly<{
  root: HTMLElement
  image: HTMLImageElement
}>

export type ImageDomStory = Readonly<{
  element: HTMLElement
  componentRoot: ComponentRoot
  refs: ImageDomStoryRefs
  source: Readonly<{html: string; typescript: string}>
  dispose(): void
}>

const artworkSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">',
  '<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#6fd3ff"/><stop offset=".52" stop-color="#52c47b"/><stop offset="1" stop-color="#ffbe6f"/></linearGradient></defs>',
  '<rect width="480" height="360" fill="#07101c"/>',
  '<circle cx="240" cy="180" r="126" fill="url(#g)" opacity=".82"/>',
  '<path d="M86 270 188 146l72 78 58-66 76 112Z" fill="#eefcff" opacity=".68"/>',
  '<circle cx="354" cy="92" r="28" fill="#eefcff" opacity=".86"/>',
  "</svg>",
].join("")

export const IMAGE_DOM_STORY_ARTWORK_SRC = svgDataUrl(artworkSvg)

export function createImageDomStory(
  document: Document,
  route: ImageDomStoryRoute,
): ImageDomStory {
  const props: ImageDomStoryViewProps = Object.freeze({
    route,
    src: IMAGE_DOM_STORY_ARTWORK_SRC,
  })
  const mounted = mountCompiledStory(
    document,
    ImageDomStoryView as unknown as CompiledTemplate<ImageDomStoryViewProps>,
    props,
    "[data-image-dom-story]",
  )
  const image = mounted.element.querySelector("img") as HTMLImageElement | null
  if (image === null) {
    mounted.dispose()
    throw new Error(`Compiled image story mounted no image: ${route}`)
  }
  const refs: ImageDomStoryRefs = Object.freeze({root: mounted.element, image})
  return Object.freeze({
    element: mounted.element,
    componentRoot: mounted.componentRoot,
    refs,
    source: Object.freeze({
      html: serializeStoryElement(mounted.element),
      typescript: renderTypeScript(route),
    }),
    dispose: mounted.dispose,
  })
}

export function isImageDomStoryRoute(route: string): route is ImageDomStoryRoute {
  return (IMAGE_DOM_STORY_ROUTES as readonly string[]).includes(route)
}

function renderTypeScript(route: ImageDomStoryRoute): string {
  const fit = route.endsWith("/cover") ? "cover" : "contain"
  return [
    'import {createDocument} from "@zavx0z/dom"',
    "",
    "const document = createDocument()",
    'const root = document.createElement("section")',
    'const frame = document.createElement("div")',
    'const image = document.createElement("img")',
    `image.src = ${JSON.stringify(IMAGE_DOM_STORY_ARTWORK_SRC)}`,
    'image.alt = "Абстрактная сцена"',
    "image.width = 320",
    "image.height = 180",
    `image.setAttribute("data-image-fit", ${JSON.stringify(fit)})`,
    "frame.appendChild(image)",
    "root.appendChild(frame)",
    "document.appendChild(root)",
  ].join("\n")
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
