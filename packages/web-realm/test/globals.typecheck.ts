export const buildOrdinaryView = (): HTMLElement => {
  const element = document.createElement("div")
  element.addEventListener("click", event => {
    if (event instanceof Event) element.title = "clicked"
  })
  const rect: DOMRectReadOnly = element.getBoundingClientRect()
  const style: CSSStyleDeclaration = getComputedStyle(element)
  console.log(rect.width, style.display, window.document === document)
  return element
}

// @ts-expect-error Native browser body is outside the semantic subset.
document.body
// @ts-expect-error Storage is not delegated by the web-realm facade.
window.localStorage
