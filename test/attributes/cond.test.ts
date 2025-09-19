import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw
describe("условные выражения в атрибутах", () => {
  describe("тернарный оператор с числом в качестве условия", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { count: 2 },
        tpl: ({ html, core }) =>
          html`<div class="${10 > core.count && core.count < 3 ? "active" : "inactive"}">Content</div>`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div class="active">Content</div>`)
    })
  })
  describe("тернарный оператор сравнения через === с динамическими результатами", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      isActive: t.boolean(true),
      status: t.string("running"),
      item: t.string("item"),
    }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { isActive: true, status: "running", item: "item" },
        tpl: ({ html, core, context }) => html`
          <div class="${core.isActive === context.isActive ? `${context.item}-active-${context.status}` : "inactive"}">
            Content
          </div>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div class="item-active-running">Content</div>`)
    })
  })
})
