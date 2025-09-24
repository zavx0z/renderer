import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { contextSchema, contextFromSchema } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw

describe("список", () => {
  let elementWithDestructuring: HTMLElement
  let elementWithoutDestructuring: HTMLElement
  const schema = contextSchema((t) => ({}))
  const ctx = contextFromSchema(schema)

  const core = {
    configs: [
      { name: "one name", value: "one value" },
      { name: "two name", value: "two value" },
    ],
  }
  describe("с деструктурированными данными", () => {
    beforeAll(() => {
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, core }) => html`
          <ul>
            ${core.configs.map(({ name, value }) => html`<li>${name} ${value}</li>`)}
          </ul>
        `
      )
      elementWithDestructuring = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })
    it("рендер", () => {
      expect(elementWithDestructuring.innerHTML).toMatchStringHTML(html`
        <ul>
          <li>one name one value</li>
          <li>two name two value</li>
        </ul>
      `)
    })
  })
  describe("с данными без деструктуриризации", () => {
    beforeAll(() => {
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, core }) => html`
          <ul>
            ${core.configs.map((config) => html`<li>${config.name} ${config.value}</li>`)}
          </ul>
        `
      )
      elementWithoutDestructuring = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })
    it("рендер", () => {
      expect(elementWithoutDestructuring.innerHTML).toBe(elementWithDestructuring.innerHTML)
    })
  })
})
