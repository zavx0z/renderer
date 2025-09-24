import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { contextSchema, contextFromSchema } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw
describe("логические операторы", () => {
  describe("простой логический оператор &&", () => {
    let element: HTMLElement
    const schema = contextSchema((t) => ({ error: t.string.required("error") }))
    const ctx = contextFromSchema(schema)
    beforeAll(() => {
      const nodes = parse(
        ({ html, context }) => html`<div>${context.error && html`<span class="error">${context.error}</span>`}</div>`
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <span class="error">error</span>
        </div>
      `)
    })
  })

  describe("логический оператор с вложенными элементами", () => {
    let element: HTMLElement
    const schema = contextSchema((t) => ({}))
    const ctx = contextFromSchema(schema)
    beforeAll(() => {
      const nodes = parse(
        ({ html, core }) =>
          html`<div>
            ${core.user &&
            html`<div class="user">
              <img src="${core.user.avatar}" alt="${core.user.name}" />
              <span>${core.user.name}</span>
            </div> `}
          </div>`
      )
      element = render({
        el: document.createElement("div"),
        ctx,
        st,
        core: { user: { name: "name", avatar: "avatar" } },
        nodes,
      })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="user">
            <img src="avatar" alt="name" />
            <span>name</span>
          </div>
        </div>
      `)
    })
  })

  describe("логический оператор с булевым условием", () => {
    let element: HTMLElement
    const schema = contextSchema((t) => ({
      isVisible: t.boolean.required(true),
      message: t.string.required("message"),
    }))
    const ctx = contextFromSchema(schema)
    beforeAll(() => {
      const nodes = parse(
        ({ html, context }) => html`<div>${context.isVisible && html`<p>${context.message}</p>`}</div>`
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <p>message</p>
        </div>
      `)
    })
    it("update", () => {
      ctx.update({ isVisible: false })
      expect(element.innerHTML).toMatchStringHTML(html`<div></div>`)
    })
  })

  describe("логический оператор с самозакрывающимся тегом", () => {
    let element: HTMLElement
    const schema = contextSchema((t) => ({
      hasError: t.boolean.required(true),
    }))
    const ctx = contextFromSchema(schema)
    beforeAll(() => {
      const nodes = parse(({ html, context }) => html`<div>${context.hasError && html`<br />`}</div>`)
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <br />
        </div>
      `)
    })
    it("update", () => {
      ctx.update({ hasError: false })
      expect(element.innerHTML).toMatchStringHTML(html`<div></div>`)
    })
  })
})
