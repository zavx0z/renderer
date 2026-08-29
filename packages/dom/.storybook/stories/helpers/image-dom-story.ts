/** Renderer-owned external Storybook story support. */
import type {
  Document,
  Element,
  HTMLElement,
  HTMLImageElement,
  Node,
  Text,
} from "@zavx0z/dom"
import {
  IMAGE_DOM_STORY_ROUTES,
  type ImageDomStoryRoute,
} from "./dom-routes.ts"

export type ImageDomStoryRefs = Readonly<{
  root: HTMLElement
  image: HTMLImageElement
}>

export type ImageDomStory = Readonly<{
  element: HTMLElement
  refs: ImageDomStoryRefs
  source: Readonly<{html: string; css: string; typescript: string}>
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

export const imageDomStoryCss = String.raw`
.image-dom-story {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 520px;
  min-height: 300px;
  padding: 24px;
  background: rgb(28, 28, 28);
  color: rgb(224, 224, 224);
}

.image-dom-story__frame {
  box-sizing: border-box;
  display: block;
  width: 320px;
  height: 180px;
  border: 1px solid rgb(72, 72, 72);
  border-radius: 4px;
  overflow: hidden;
  background: rgb(7, 16, 28);
}

.image-dom-story__image {
  box-sizing: border-box;
  display: block;
  width: 320px;
  height: 180px;
  background: rgb(7, 16, 28);
}

.image-dom-story__image--cover {
  object-fit: cover;
}

.image-dom-story__image--contain {
  object-fit: contain;
}

`

export function createImageDomStory(
  document: Document,
  route: ImageDomStoryRoute,
): ImageDomStory {
  const root = document.createElement("section")
  const image = document.createElement("img")

  root.className = "image-dom-story"
  root.setAttribute("aria-label", "Вписывание изображения")
  const frame = document.createElement("div")
  const fit = route.endsWith("/cover") ? "cover" : "contain"
  frame.className = "image-dom-story__frame"
  image.className = `image-dom-story__image image-dom-story__image--${fit}`
  image.src = IMAGE_DOM_STORY_ARTWORK_SRC
  image.alt = "Абстрактная сцена"
  image.width = 320
  image.height = 180
  image.title = fit === "cover" ? "Заполнение области" : "Изображение целиком"
  frame.appendChild(image)
  root.appendChild(frame)

  const refs: ImageDomStoryRefs = Object.freeze({root, image})
  return Object.freeze({
    element: root,
    refs,
    source: Object.freeze({
      html: serializeElement(root),
      css: imageDomStoryCss,
      typescript: renderTypeScript(route),
    }),
  })
}

export function isImageDomStoryRoute(route: string): route is ImageDomStoryRoute {
  return (IMAGE_DOM_STORY_ROUTES as readonly string[]).includes(route)
}

function renderTypeScript(route: ImageDomStoryRoute): string {
  const lines = [
    'import {createDocument} from "@zavx0z/dom"',
    "",
    "const document = createDocument()",
    'const root = document.createElement("section")',
    'const image = document.createElement("img")',
    `image.src = ${JSON.stringify(IMAGE_DOM_STORY_ARTWORK_SRC)}`,
  ]
  const fit = route.endsWith("/cover") ? "cover" : "contain"
  lines.push(
    'const frame = document.createElement("div")',
    'frame.className = "image-dom-story__frame"',
    `image.className = "image-dom-story__image image-dom-story__image--${fit}"`,
    'image.alt = "Абстрактная сцена"',
    "image.width = 320",
    "image.height = 180",
    "frame.appendChild(image)",
    "root.appendChild(frame)",
  )
  lines.push("document.appendChild(root)")
  return lines.join("\n")
}

function serializeElement(element: Element, depth = 0): string {
  const indent = "  ".repeat(depth)
  const attributes = element.getAttributeNames().sort().map((name) => {
    const value = element.getAttribute(name) ?? ""
    return ` ${name}="${escapeAttribute(value)}"`
  }).join("")
  if (element.localName === "img") return `${indent}<img${attributes}>`
  const children = [...element.childNodes]
  if (children.length === 0) return `${indent}<${element.localName}${attributes}></${element.localName}>`
  if (children.every((node) => node.nodeType === 3)) {
    return `${indent}<${element.localName}${attributes}>${escapeText(element.textContent ?? "")}</${element.localName}>`
  }
  const body = children.map((node: Node) => node.nodeType === 3
    ? `${"  ".repeat(depth + 1)}${escapeText((node as Text).data)}`
    : serializeElement(node as Element, depth + 1)).join("\n")
  return `${indent}<${element.localName}${attributes}>\n${body}\n${indent}</${element.localName}>`
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;")
}
