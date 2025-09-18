import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw
describe("text", () => {
  describe("примитивы", () => {
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

  describe("объекты без деструктуризации", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { configs: [{ name: "name", value: "value" }] },
        tpl: ({ html, core }) => html`
          <ul>
            ${core.configs.map((config) => html`<li>${config.name} ${config.value}</li>`)}
          </ul>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li>name value</li>
        </ul>
      `)
    })
  })
  describe("объекты с деструктуризацией", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { configs: [{ name: "name", value: "value" }] },
        tpl: ({ html, core }) => html`
          <ul>
            ${core.configs.map(({ name, value }) => html`<li>${name} ${value}</li>`)}
          </ul>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li>name value</li>
        </ul>
      `)
    })
  })

  describe("вложенные объекты", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { posts: [{ author: { name: "name", email: "email" } }] },
        tpl: ({ html, core }) => html`
          <div>${core.posts.map((post) => html`<p>Author: ${post.author.name} (${post.author.email})</p>`)}</div>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <p>Author: name (email)</p>
        </div>
      `)
    })
  })

  describe("динамический текст в map с условными выражениями", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { items: [{ name: "name", isActive: true }] },
        tpl: ({ html, core }) => html`
          <ul>
            ${core.items.map((item) => html`<li>${item.isActive ? item.name : "Inactive"}</li>`)}
          </ul>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li>name</li>
        </ul>
      `)
    })
  })

  describe("динамический текст в map с вычислениями", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { products: [{ name: "name", price: 1, quantity: 1 }] },
        tpl: ({ html, core }) => html`
          <div>
            ${core.products.map((product) => html`<p>${product.name}: $${product.price * product.quantity}</p>`)}
          </div>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <p>name: $1</p>
        </div>
      `)
    })
  })

  describe("динамический текст в map с методами", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { users: [{ name: "name", email: "email" }] },
        tpl: ({ html, core }) => html`
          <div>${core.users.map((user) => html`<p>${user.name.toUpperCase()} - ${user.email.toLowerCase()}</p>`)}</div>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <p>NAME - email</p>
        </div>
      `)
    })
  })

  describe("динамический текст в map с вложенными map", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {
          categories: [
            { name: "Category 1", products: [{ name: "Product 1", price: 1 }] },
            { name: "Category 2", products: [{ name: "Product 2", price: 2 }] },
          ],
        },
        tpl: ({ html, core }) => html`
          <div>
            ${core.categories.map(
              (category) => html`
                <h2>${category.name}</h2>
                <ul>
                  ${category.products.map((product) => html`<li>${product.name} - $${product.price}</li>`)}
                </ul>
              `
            )}
          </div>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <h2>Category 1</h2>
          <ul>
            <li>Product 1 - $1</li>
          </ul>
          <h2>Category 2</h2>
          <ul>
            <li>Product 2 - $2</li>
          </ul>
        </div>
      `)
    })
  })

  describe("динамический текст в map с условными элементами", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { items: [{ name: "name", isVisible: true, description: "description" }] },
        tpl: ({ html, core }) => html`
          <div>
            ${core.items.map(
              (item) => html`
                ${item.isVisible ? html`<p>${item.name}: ${item.description}</p>` : html`<p>Hidden item</p>`}
              `
            )}
          </div>
        `,
      })
    })
    it("data", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <p>name: description</p>
        </div>
      `)
    })
  })
})
