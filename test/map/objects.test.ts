import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw

describe("список", () => {
  let elementWithDestructuring: HTMLElement
  let elementWithoutDestructuring: HTMLElement
  const ctx = new Context((t) => ({}))

  const st = {
    state: "",
    states: [],
  }
  const core = {
    configs: [
      { name: "one name", value: "one value" },
      { name: "two name", value: "two value" },
    ],
  }
  describe("с деструктурированными данными", () => {
    beforeAll(() => {
      elementWithDestructuring = render({
        el: document.createElement("div"),
        ctx,
        st,
        core,
        tpl: ({ html, core }) => html`
          <ul>
            ${core.configs.map(({ name, value }) => html`<li>${name} ${value}</li>`)}
          </ul>
        `,
      })
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
      elementWithoutDestructuring = render({
        el: document.createElement("div"),
        ctx,
        st,
        core,
        tpl: ({ html, core }) => html`
          <ul>
            ${core.configs.map((config) => html`<li>${config.name} ${config.value}</li>`)}
          </ul>
        `,
      })
    })
    it("рендер", () => {
      expect(elementWithoutDestructuring.innerHTML).toBe(elementWithDestructuring.innerHTML)
    })
  })
})
