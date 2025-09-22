import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"

const html = String.raw

describe("&& &&", () => {
  // https://zavx0z.github.io/template/interfaces/NodeLogical.html#%D1%81%D0%BB%D0%BE%D0%B6%D0%BD%D0%BE%D0%B5-%D0%BB%D0%BE%D0%B3%D0%B8%D1%87%D0%B5%D1%81%D0%BA%D0%BE%D0%B5-%D1%83%D1%81%D0%BB%D0%BE%D0%B2%D0%B8%D0%B5
  const ctx = new Context((t) => ({
    isAdmin: t.boolean.required(true),
  }))

  let element: HTMLElement
  beforeAll(() => {
    const nodes = parse(
      ({ html, context, core }) => html`
        <div>${core.user && context.isAdmin && html`<div class="admin">Admin Panel</div>`}</div>
      `
    )
    element = render({
      el: document.createElement("div"),
      ctx,
      st: { state: "state", states: [] },
      core: {
        user: { role: "admin" },
      },
      nodes,
    })
  })

  it("render", () => {
    expect(element.innerHTML).toMatchStringHTML(html`
      <div>
        <div class="admin">Admin Panel</div>
      </div>
    `)
  })

  it("update", () => {
    ctx.update({ isAdmin: false })
    expect(element.innerHTML).toMatchStringHTML(html`<div></div>`)
  })
})
