import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { contextSchema, contextFromSchema } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw

describe("renderer: логические операторы в map", () => {
  describe("простой логический оператор в map", () => {
    let element: HTMLElement

    const core = {
      users: [
        { name: "alice", hasAvatar: true },
        { name: "bob", hasAvatar: false },
        { name: "carol", hasAvatar: true },
      ],
    }

    beforeAll(() => {
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      const nodes = parse<typeof ctx.context>(
        ({ html, context }) => html`
          <div>
            ${core.users.map(
              (user) =>
                html`<div class="user">
                  ${user.hasAvatar && html`<img src="/avatar/${user.name}.jpg" alt="${user.name}" />`}<span
                    >${user.name}</span
                  >
                </div>`
            )}
          </div>
        `
      )
      element = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="user">
            <img src="/avatar/alice.jpg" alt="alice" />
            <span>alice</span>
          </div>
          <div class="user">
            <span>bob</span>
          </div>
          <div class="user">
            <img src="/avatar/carol.jpg" alt="carol" />
            <span>carol</span>
          </div>
        </div>
      `)
    })
  })

  describe("логический оператор с вложенными элементами в map", () => {
    let element: HTMLElement

    const core = {
      posts: [
        { title: "Post A", author: { name: "Eve", isVerified: true } },
        { title: "Post B", author: { name: "Mallory", isVerified: false } },
      ],
    }

    const schema = contextSchema((t) => ({}))
    const ctx = contextFromSchema(schema)
    beforeAll(() => {
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, core }) => html`
          <div>
            ${core.posts.map(
              (post) => html`
                <article class="post">
                  <h2>${post.title}</h2>
                  ${post.author.isVerified &&
                  html`
                    <div class="author-verified">
                      <span class="verified-badge">VERIFIED</span>
                      <span>${post.author.name}</span>
                    </div>
                  `}
                </article>
              `
            )}
          </div>
        `
      )
      element = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <article class="post">
            <h2>Post A</h2>
            <div class="author-verified">
              <span class="verified-badge">VERIFIED</span>
              <span>Eve</span>
            </div>
          </article>
          <article class="post">
            <h2>Post B</h2>
          </article>
        </div>
      `)
    })
  })

  describe("логический оператор с самозакрывающимся тегом в map", () => {
    let element: HTMLElement

    const core = {
      items: [
        { name: "One", isNew: true },
        { name: "Two", isNew: false },
        { name: "Three", isNew: true },
      ],
    }

    beforeAll(() => {
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, core }) => html`
          <ul>
            ${core.items.map(
              (item) =>
                html`<li class="item">
                  ${item.isNew && html`<span class="new-badge">NEW</span>`}<span>${item.name}</span>
                </li>`
            )}
          </ul>
        `
      )
      element = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li class="item">
            <span class="new-badge">NEW</span>
            <span>One</span>
          </li>
          <li class="item">
            <span>Two</span>
          </li>
          <li class="item">
            <span class="new-badge">NEW</span>
            <span>Three</span>
          </li>
        </ul>
      `)
    })
  })

  describe("сложный логический оператор в map", () => {
    let element: HTMLElement
    let ctx: any

    const core = {
      products: [
        { name: "Book", price: 10, inStock: true },
        { name: "Pen", price: 2, inStock: false },
        { name: "Lamp", price: 25, inStock: true },
      ],
    }

    beforeAll(() => {
      const schema = contextSchema((t) => ({
        showDetails: t.boolean.required(true),
      }))
      ctx = contextFromSchema(schema)
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, core, context }) => html`
          <div>
            ${core.products.map(
              (product) => html`
                <div class="product">
                  <h3>${product.name}</h3>
                  <p class="price">$${product.price}</p>
                  ${product.inStock &&
                  context.showDetails &&
                  html`
                    <div class="product-details">
                      <span class="stock-status">In Stock</span>
                      <button class="add-to-cart">Add to Cart</button>
                    </div>
                  `}
                </div>
              `
            )}
          </div>
        `
      )
      element = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })

    it("render (showDetails=true)", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="product">
            <h3>Book</h3>
            <p class="price">$10</p>
            <div class="product-details">
              <span class="stock-status">In Stock</span>
              <button class="add-to-cart">Add to Cart</button>
            </div>
          </div>
          <div class="product">
            <h3>Pen</h3>
            <p class="price">$2</p>
          </div>
          <div class="product">
            <h3>Lamp</h3>
            <p class="price">$25</p>
            <div class="product-details">
              <span class="stock-status">In Stock</span>
              <button class="add-to-cart">Add to Cart</button>
            </div>
          </div>
        </div>
      `)
    })

    it("update (showDetails=false)", () => {
      ctx.update({ showDetails: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="product">
            <h3>Book</h3>
            <p class="price">$10</p>
          </div>
          <div class="product">
            <h3>Pen</h3>
            <p class="price">$2</p>
          </div>
          <div class="product">
            <h3>Lamp</h3>
            <p class="price">$25</p>
          </div>
        </div>
      `)
    })
  })

  describe("логический оператор с вложенным map", () => {
    let element: HTMLElement

    const core = {
      categories: [
        {
          name: "Fruits",
          hasSubcategories: true,
          subcategories: [{ name: "Apple" }, { name: "Banana" }],
        },
        {
          name: "Tools",
          hasSubcategories: false,
          subcategories: [],
        },
      ],
    }

    beforeAll(() => {
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, core }) => html`
          <div>
            ${core.categories.map(
              (category) => html`
                <div class="category">
                  <h2>${category.name}</h2>
                  ${category.hasSubcategories &&
                  html`
                    <ul class="subcategories">
                      ${category.subcategories.map((sub) => html` <li>${sub.name}</li> `)}
                    </ul>
                  `}
                </div>
              `
            )}
          </div>
        `
      )
      element = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })

    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="category">
            <h2>Fruits</h2>
            <ul class="subcategories">
              <li>Apple</li>
              <li>Banana</li>
            </ul>
          </div>
          <div class="category">
            <h2>Tools</h2>
          </div>
        </div>
      `)
    })
  })
})
