import type { Node as TemplateNode } from "@zavx0z/template"
import type { Context, Schema } from "@zavx0z/context"
import {
  commit,
  compile,
  type RenderHost,
  type ResolvedElement,
  type ResolvedStyle,
} from "./program"

export type DOMRoot = HTMLElement | ShadowRoot

const DOM_HOST: RenderHost<Node, DOMRoot> = {
  createText: ({ value }) => document.createTextNode(value),
  createElement: (node) => createDOMElement(node),
  appendChild: (parent, child) => {
    parent.appendChild(child)
  },
  replaceChildren: (root, children) => {
    root.replaceChildren(...children)
  },
}

export const domHost = Object.freeze(DOM_HOST)

export const render = <
  C extends Schema,
  I extends Record<string, any> = Record<string, any>,
  S extends string = string,
  Root extends DOMRoot = HTMLElement,
>({
  el,
  ctx,
  st,
  core,
  nodes,
}: RenderParams<C, I, S, Root>): Root => {
  const program = compile(nodes)
  const update = () =>
    commit(
      domHost,
      el,
      program.evaluate({
        bindings: {
          context: ctx.context,
          core,
          state: st.state,
        },
        update: ctx.update,
      }),
    )

  ctx.onUpdate(update)
  st.onUpdate((newState) => {
    st.state = newState
    update()
  })
  update()
  return el
}

const createDOMElement = (node: ResolvedElement): HTMLElement => {
  const element = document.createElement(node.tag)

  if (node.templateType === "meta" && node.core)
    (element as HTMLElement & { __core: unknown }).__core = node.core

  for (const [name, value] of Object.entries(node.attributes.string)) {
    if (name === "class") {
      if (value !== "false" && value !== "true" && value !== "")
        element.classList.add(value)
    } else {
      element.setAttribute(name, value)
    }
  }

  for (const [name, value] of Object.entries(node.attributes.boolean))
    element.toggleAttribute(name, value)

  for (const [name, values] of Object.entries(node.attributes.array)) {
    if (name === "class") element.className = values.join(" ")
    else element.setAttribute(name, values.join(","))
  }

  if (node.attributes.style)
    element.setAttribute("style", inlineStyle(node.attributes.style))

  for (const [name, handler] of Object.entries(node.attributes.event)) {
    element.addEventListener(name, handler as EventListener)
  }

  return element
}

const inlineStyle = (style: ResolvedStyle): string => {
  let result = ""
  for (const [property, value] of Object.entries(style)) {
    if (value !== null && typeof value === "object") continue
    const cssProperty = property.replace(/([A-Z])/g, "-$1").toLowerCase()
    result += `${cssProperty}: ${String(value)}; `
  }
  return result.trim()
}

export type RenderParams<
  C extends Schema,
  I extends Record<string, any> = Record<string, any>,
  S extends string = string,
  Root extends DOMRoot = HTMLElement,
> = {
  el: Root
  ctx: Context<C>
  st: {
    state: S
    states: readonly S[]
    onUpdate: (listener: (state: S) => void) => () => void
  }
  core: I
  nodes: TemplateNode[]
}
