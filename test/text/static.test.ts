import { describe, it, expect, beforeAll } from "bun:test"
import { Context } from "@zavx0z/context"
import { render } from "@zavx0z/renderer"

const html = String.raw

describe("статические значения", () => {
  // https://zavx0z.github.io/template/interfaces/NodeText.html#статический
  const ctx = new Context((t) => ({}))
  let element: HTMLElement
  beforeAll(() => {
    element = render({
      el: document.createElement("div"),
      ctx,
      st: { state: "", states: [] },
      core: {},
      tpl: ({ html }) => html`Static text`,
    })
  })
  it("render", () => {
    expect(element.innerHTML).toMatchStringHTML(html`Static text`)
  })
})
