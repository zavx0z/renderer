import {
  Node,
  type Document,
  type Element,
  type HTMLElement,
  type Text,
} from "@zavx0z/dom"
import {createRoot} from "@zavx0z/react"
import type {CompiledTemplate} from "@zavx0z/template/compiled"
import {
  defineRendererStory,
  type RendererStoryResult,
} from "../runtime.ts"
import {
  FlexStoryPreview,
  type FlexStoryPreviewProps,
} from "./preview.tsx"
import type {FlexStoryPresetId} from "./contract.ts"
import {createFlexStoryChannel} from "./store.ts"

export const packing = defineFlexStory("css/flex/packing", "packing")
export const column = defineFlexStory("css/flex/column", "column")
export const wrapReverse = defineFlexStory("css/flex/wrap-reverse", "reverse")
export const alignment = defineFlexStory("css/flex/alignment", "alignment")
export const sizing = defineFlexStory("css/flex/sizing", "sizing")
export const shrink = defineFlexStory("css/flex/shrink", "shrink")

function defineFlexStory(route: string, presetId: FlexStoryPresetId) {
  return defineRendererStory(
    route,
    (document, signal) => createFlexStory(document, signal, presetId),
  )
}

function createFlexStory(
  document: Document,
  signal: AbortSignal,
  presetId: FlexStoryPresetId,
): RendererStoryResult {
  if (signal.aborted) throw abortReason(signal)
  const channel = createFlexStoryChannel(presetId)
  const staging = document.createElement("div")
  const componentRoot = createRoot(staging)
  let element: HTMLElement | null = null
  let disposed = false

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    signal.removeEventListener("abort", dispose)
    let firstError: unknown = null
    try {
      componentRoot.unmount()
    } catch (error) {
      firstError = error
    }
    try {
      if (element !== null && element.parentNode !== null) {
        element.parentNode.removeChild(element)
      }
    } catch (error) {
      firstError ??= error
    } finally {
      channel.dispose()
    }
    if (firstError !== null) throw firstError
  }

  try {
    componentRoot.render(
      FlexStoryPreview as unknown as CompiledTemplate<FlexStoryPreviewProps>,
      Object.freeze({channel}),
    )
    const matches = [...staging.querySelectorAll("[data-flex-story-preview]")]
    if (matches.length !== 1) {
      throw new Error(`Flex story requires one preview root, received ${matches.length}`)
    }
    element = matches[0] as HTMLElement
    staging.removeChild(element)
    signal.addEventListener("abort", dispose, {once: true})
    if (signal.aborted) throw abortReason(signal)
    return Object.freeze({
      story: Object.freeze({
        element,
        componentRoot,
        source: Object.freeze({
          html: serializeElement(element),
          typescript: typescriptSource(presetId),
        }),
        values: Object.freeze({"flex-controls": channel}),
        dispose,
      }),
    })
  } catch (error) {
    dispose()
    throw error
  }
}

function typescriptSource(presetId: FlexStoryPresetId): string {
  return `const channel = createFlexStoryChannel("${presetId}")

<FlexStoryPreview channel={channel} />`
}

function serializeElement(element: Element, depth = 0): string {
  const indent = "  ".repeat(depth)
  const attributes = element.getAttributeNames().sort().map(name => {
    const value = element.getAttribute(name) ?? ""
    if (["disabled", "hidden", "readonly", "selected"].includes(name) && value === "") {
      return ` ${name}`
    }
    return ` ${name}="${escapeAttribute(value)}"`
  }).join("")
  const children = [...element.childNodes].filter(node => node.nodeType !== Node.COMMENT_NODE)
  if (children.length === 0) return `${indent}<${element.localName}${attributes}></${element.localName}>`
  if (children.every(node => node.nodeType === Node.TEXT_NODE)) {
    return `${indent}<${element.localName}${attributes}>${escapeText(element.textContent ?? "")}</${element.localName}>`
  }
  const body = children.map(node => node.nodeType === Node.TEXT_NODE
    ? `${"  ".repeat(depth + 1)}${escapeText((node as Text).data)}`
    : serializeElement(node as Element, depth + 1)).join("\n")
  return `${indent}<${element.localName}${attributes}>\n${body}\n${indent}</${element.localName}>`
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', "&quot;")
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Flex story aborted", "AbortError")
}
