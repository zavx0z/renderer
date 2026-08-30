/** Compiled standard Popover and compound-select Storybook stories. */
import {
  getPopoverVisibilityState,
  type Document,
  type HTMLButtonElement,
  type HTMLElement,
  type HTMLLIElement,
  type HTMLUListElement,
} from "@zavx0z/dom"
import type {ComponentRoot} from "@zavx0z/react"
import type {CompiledTemplate} from "@zavx0z/template/compiled"
import {
  POPOVER_DOM_STORY_ROUTES,
  type PopoverDomStoryRoute,
} from "./dom-routes.ts"
import {
  PopoverDomStoryView,
  type PopoverDomStoryViewProps,
} from "./dom-stories-view.tsx"
import {mountCompiledStory, serializeStoryElement} from "./compiled-story.ts"

export type PopoverDomStoryRefs = Readonly<{
  root: HTMLElement
  trigger: HTMLButtonElement
  popover: HTMLElement
  listbox: HTMLUListElement | null
  options: readonly HTMLLIElement[]
}>

export type PopoverDomStory = Readonly<{
  element: HTMLElement
  componentRoot: ComponentRoot
  refs: PopoverDomStoryRefs
  source: Readonly<{html: string; typescript: string}>
  dispose(): void
}>

export function createPopoverDomStory(
  document: Document,
  route: PopoverDomStoryRoute,
): PopoverDomStory {
  const props: PopoverDomStoryViewProps = Object.freeze({route})
  const mounted = mountCompiledStory(
    document,
    PopoverDomStoryView as unknown as CompiledTemplate<PopoverDomStoryViewProps>,
    props,
    "[data-popover-dom-story]",
  )
  const trigger = mounted.element.querySelector("[data-popover-trigger]") as HTMLButtonElement | null
  const popover = mounted.element.querySelector("[data-popover-owner]") as HTMLElement | null
  if (trigger === null || popover === null) {
    mounted.dispose()
    throw new Error(`Compiled popover story mounted an incomplete owner: ${route}`)
  }
  const listbox = mounted.element.querySelector("[data-popover-listbox]") as HTMLUListElement | null
  const options = Object.freeze([
    ...mounted.element.querySelectorAll("[data-popover-option]"),
  ] as HTMLLIElement[])
  const refs: PopoverDomStoryRefs = Object.freeze({
    root: mounted.element,
    trigger,
    popover,
    listbox,
    options,
  })
  const initialOpenTask = route.endsWith("/closed") ? null : setTimeout(() => {
    if (mounted.element.isConnected && popover[getPopoverVisibilityState]() !== "showing") {
      popover.showPopover({source: trigger})
    }
  }, 0)
  let disposed = false
  return Object.freeze({
    element: mounted.element,
    componentRoot: mounted.componentRoot,
    refs,
    source: Object.freeze({
      html: serializeStoryElement(mounted.element),
      typescript: renderTypeScript(route, popover.id),
    }),
    dispose() {
      if (disposed) return
      disposed = true
      if (initialOpenTask !== null) clearTimeout(initialOpenTask)
      if (popover.isConnected && popover[getPopoverVisibilityState]() === "showing") popover.hidePopover()
      mounted.dispose()
    },
  })
}

export function isPopoverDomStoryRoute(route: string): route is PopoverDomStoryRoute {
  return (POPOVER_DOM_STORY_ROUTES as readonly string[]).includes(route)
}

function renderTypeScript(route: PopoverDomStoryRoute, popoverId: string): string {
  const selectRoute = route.includes("/select/")
  return [
    'import {createDocument} from "@zavx0z/dom"',
    "",
    "const document = createDocument()",
    'const root = document.createElement("section")',
    'const trigger = document.createElement("button")',
    'const popover = document.createElement("div")',
    `popover.id = ${JSON.stringify(popoverId)}`,
    'popover.popover = "manual"',
    `trigger.setAttribute("aria-haspopup", ${JSON.stringify(selectRoute ? "listbox" : "dialog")})`,
    "trigger.addEventListener(\"click\", () => {",
    '  if (popover.matches(\":popover-open\")) popover.hidePopover()',
    "  else popover.showPopover({source: trigger})",
    "})",
    "root.append(trigger, popover)",
    "document.appendChild(root)",
  ].join("\n")
}
