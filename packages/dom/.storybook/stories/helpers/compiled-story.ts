import {Node, type Document, type Element, type HTMLElement, type Text} from "@zavx0z/dom"
import {createRoot, type ComponentRoot} from "@zavx0z/react"
import type {CompiledTemplate} from "@zavx0z/template/compiled"

export type CompiledStoryMount = Readonly<{
  element: HTMLElement
  componentRoot: ComponentRoot
  dispose(): void
}>

export function mountCompiledStory<Props>(
  document: Document,
  template: CompiledTemplate<Props>,
  props: Readonly<Props>,
  selector: string,
): CompiledStoryMount {
  const staging = document.createDocumentFragment()
  const componentRoot = createRoot(staging)
  componentRoot.render(template, props)
  const matches = [...staging.querySelectorAll(selector)]
  if (matches.length !== 1) {
    componentRoot.unmount()
    throw new Error(`Compiled DOM story requires one ${selector}, received ${matches.length}`)
  }
  const element = matches[0] as HTMLElement
  staging.removeChild(element)
  let disposed = false
  return Object.freeze({
    element,
    componentRoot,
    dispose() {
      if (disposed) return
      disposed = true
      componentRoot.unmount()
      if (element.parentNode !== null) element.parentNode.removeChild(element)
    },
  })
}

export function serializeStoryElement(element: Element, depth = 0): string {
  const indent = "  ".repeat(depth)
  const attributes = element.getAttributeNames().sort().map(name => {
    const value = element.getAttribute(name) ?? ""
    if (["disabled", "hidden", "readonly", "selected"].includes(name) && value === "") {
      return ` ${name}`
    }
    return ` ${name}="${escapeAttribute(value)}"`
  }).join("")
  const children = [...element.childNodes].filter(node => node.nodeType !== Node.COMMENT_NODE)
  if ((element.localName === "input" || element.localName === "img") && children.length === 0) {
    return `${indent}<${element.localName}${attributes}>`
  }
  if (children.length === 0) return `${indent}<${element.localName}${attributes}></${element.localName}>`
  if (children.every(node => node.nodeType === Node.TEXT_NODE)) {
    return `${indent}<${element.localName}${attributes}>${escapeText(element.textContent ?? "")}</${element.localName}>`
  }
  const body = children.map(node => node.nodeType === Node.TEXT_NODE
    ? `${"  ".repeat(depth + 1)}${escapeText((node as Text).data)}`
    : serializeStoryElement(node as Element, depth + 1)).join("\n")
  return `${indent}<${element.localName}${attributes}>\n${body}\n${indent}</${element.localName}>`
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;")
}
