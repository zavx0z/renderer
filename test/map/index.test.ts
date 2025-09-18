import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw

describe("индекс", () => {
  describe("в тексте", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      list: t.array.required(["one", "two", "three", "four"]),
    }))
    const st = {
      state: "",
      states: [],
    }

    const core = {
      list: [
        { title: "one", nested: ["one", "two"] },
        { title: "two", nested: ["one", "two"] },
      ],
    }

    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st,
        core,
        tpl: ({ html, context }) => html`
          <ul>
            ${context.list.map((_, i) => html`<li>${i}</li>`)}
          </ul>
        `,
      })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li>0</li>
          <li>1</li>
          <li>2</li>
          <li>3</li>
        </ul>
      `)
    })
  })
  describe("в условии", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      list: t.array.required(["one", "two", "three", "four"]),
    }))
    const st = {
      state: "",
      states: [],
    }

    const core = {
      list: [
        { title: "one", nested: ["one", "two"] },
        { title: "two", nested: ["one", "two"] },
      ],
    }

    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st,
        core,
        tpl: ({ html, context }) => html`
          <ul>
            ${context.list.map((_, i) => html`<li>${i % 2 ? html`<em>A</em>` : html`<strong>B</strong>`}</li>`)}
          </ul>
        `,
      })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li><strong>B</strong></li>
          <li><em>A</em></li>
          <li><strong>B</strong></li>
          <li><em>A</em></li>
        </ul>
      `)
    })
  })
  describe("в логическом блоке", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      list: t.array.required(["one", "two", "three", "four"]),
    }))
    const st = {
      state: "",
      states: [],
    }

    const core = {
      list: [
        { title: "one", nested: ["one", "two"] },
        { title: "two", nested: ["one", "two"] },
      ],
    }

    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st,
        core,
        tpl: ({ html, context }) => html`
          <ul>
            ${context.list.map((_, i) => html`<li>${i === 1 && html`<strong>1</strong>`}</li>`)}
          </ul>
        `,
      })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li></li>
          <li><strong>1</strong></li>
          <li></li>
          <li></li>
        </ul>
      `)
    })
  })
})
