import { describe, it, expect, beforeAll } from "bun:test"
import { Context } from "@zavx0z/context"
import { render } from "@zavx0z/renderer"

const html = String.raw

describe("динамические значения", () => {
  // https://zavx0z.github.io/template/interfaces/NodeText.html#динамический
  const ctx = new Context((t) => ({ dynamic: t.string.required("Dynamic text") }))
  let element: HTMLElement
  beforeAll(() => {
    element = render({
      el: document.createElement("div"),
      ctx,
      st: { state: "", states: [] },
      core: {},
      tpl: ({ html, context }) => html`<p>${context.dynamic}</p>`,
    })
  })
  it("render", () => {
    expect(element.innerHTML).toMatchStringHTML(html`<p>Dynamic text</p>`)
  })
  it("update", () => {
    ctx.update({ dynamic: "Updated text" })
    expect(element.innerHTML).toMatchStringHTML(html`<p>Updated text</p>`)
  })
})
