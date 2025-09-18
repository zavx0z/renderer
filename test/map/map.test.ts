import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw
describe("map", () => {
  describe("map вложенный в map", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))

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
        tpl: ({ html, core }) => html`
          <ul>
            ${core.list.map(
              ({ title, nested }) => html`
                <li>
                  <p>${title}</p>
                  ${nested.map((n) => html`<em>${n}</em>`)}
                </li>
              `
            )}
          </ul>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li>
            <p>one</p>
            <em>one</em>
            <em>two</em>
          </li>
          <li>
            <p>two</p>
            <em>one</em>
            <em>two</em>
          </li>
        </ul>
      `)
    })
  })
  describe("простой map", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { list: ["Item 1", "Item 2"] },
        tpl: ({ html, core }) => html`
          <ul>
            ${core.list.map((name) => html`<li>${name}</li>`)}
          </ul>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `)
    })
  })

  describe("простой map с несколькими детьми", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { list: ["Item 1", "Item 2"] },
        tpl: ({ html, core }) => html`
          <ul>
            ${core.list.map(
              (name) => html`
                <li>${name}</li>
                <br />
              `
            )}
          </ul>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li>Item 1</li>
          <br />
          <li>Item 2</li>
          <br />
        </ul>
      `)
    })
    describe("map в элементе вложенный в map", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: {
            list: [
              { title: "Item 1", nested: ["Item 2", "Item 3"] },
              { title: "Item 4", nested: ["Item 5", "Item 6"] },
            ],
          },
          tpl: ({ html, core }) => html`
            <ul>
              ${core.list.map(
                ({ title, nested }) => html`
                  <li>
                    <p>${title}</p>
                    ${nested.map((n) => html`<em>${n}</em>`)}
                  </li>
                `
              )}
            </ul>
          `,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`
          <ul>
            <li>
              <p>Item 1</p>
              <em>Item 2</em>
              <em>Item 3</em>
            </li>
            <li>
              <p>Item 4</p>
              <em>Item 5</em>
              <em>Item 6</em>
            </li>
          </ul>
        `)
      })
    })
    describe("map с индексом", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({}))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: { list: ["Item 1", "Item 2", "Item 3", "Item 4"] },
          tpl: ({ html, core }) => html`
            <ul>
              ${core.list.map((_, i) => html`<li>${i % 2 ? html`<em>A</em>` : html`<strong>B</strong>`}</li>`)}
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
    describe("map в условии", () => {
      let element: HTMLElement
      const ctx = new Context((t) => ({ flag: t.boolean.required(true) }))
      beforeAll(() => {
        element = render({
          el: document.createElement("div"),
          ctx,
          st: { state: "state", states: [] },
          core: {
            list: [
              { title: "Item 1", nested: ["Item 2", "Item 3"] },
              { title: "Item 4", nested: ["Item 5", "Item 6"] },
            ],
          },
          tpl: ({ html, core, context }) => html`
            ${context.flag
              ? html`
                  <ul>
                    ${core.list.map(
                      ({ title, nested }) => html`<li>${title} ${nested.map((n) => html`<em>${n}</em>`)}</li>`
                    )}
                  </ul>
                `
              : html`<div>x</div>`}
          `,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`
          <ul>
            <li>Item 1 <em>Item 2</em> <em>Item 3</em></li>
            <li>Item 4 <em>Item 5</em> <em>Item 6</em></li>
          </ul>
        `)
      })
    })
  })
  describe("map в text вложенный в map", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {
          list: [
            { title: "Item 1", nested: ["Item 2", "Item 3"] },
            { title: "Item 4", nested: ["Item 5", "Item 6"] },
          ],
        },
        tpl: ({ html, core }) => html`
          <ul>
            ${core.list.map(({ title, nested }) => html`<li>${title} ${nested.map((n) => html`<em>${n}</em>`)}</li>`)}
          </ul>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li>Item 1 <em>Item 2</em> <em>Item 3</em></li>
          <li>Item 4 <em>Item 5</em> <em>Item 6</em></li>
        </ul>
      `)
    })
  })
})
