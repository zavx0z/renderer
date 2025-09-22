import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"

const html = String.raw
describe("map соседствующие", () => {
  describe("map соседствующий с map на верхнем уровне", () => {
    const ctx = new Context((t) => ({}))
    const st = {
      state: "",
      states: [],
    }
    const core = {
      list1: [{ title: "Item 1" }, { title: "Item 2" }],
      list2: [{ title: "Item 3" }, { title: "Item 4" }],
    }
    let element: HTMLElement
    beforeAll(() => {
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, core }) => html`
          ${core.list1.map(({ title }) => html` <div>${title}</div> `)}
          ${core.list2.map(({ title }) => html` <div>${title}</div> `)}
        `
      )
      element = render({
        el: document.createElement("div"),
        ctx,
        st,
        core,
        nodes,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
        <div>Item 4</div>
      `)
    })
  })

  describe("map соседствующий с map внутри элемента", () => {
    const ctx = new Context((t) => ({
      categories: t.array.required(["cat1", "cat2"]),
    }))
    const st = {
      state: "",
      states: [],
    }
    const core = {
      items: [
        { categoryId: 1, title: "Item 1" },
        { categoryId: 2, title: "Item 2" },
      ],
    }
    let element: HTMLElement
    beforeAll(() => {
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, context, core }) => html`
          <div class="dashboard">
            ${context.categories.map((cat) => html`<span class="category">${cat}</span>`)}
            ${core.items.map(
              (item) => html`
                <div class="item" data-category="${item.categoryId}">
                  <h4>${item.title}</h4>
                </div>
              `
            )}
          </div>
        `
      )
      element = render({
        el: document.createElement("div"),
        ctx,
        st,
        core,
        nodes,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="dashboard">
          <span class="category">cat1</span>
          <span class="category">cat2</span>
          <div class="item" data-category="1">
            <h4>Item 1</h4>
          </div>
          <div class="item" data-category="2">
            <h4>Item 2</h4>
          </div>
        </div>
      `)
    })
  })

  describe("map соседствующий с map на глубоком уровне вложенности", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    const core = {
      list1: [{ title: "Item 1" }, { title: "Item 2" }],
      list2: [{ title: "Item 3" }, { title: "Item 4" }],
      list3: [{ title: "Item 5" }, { title: "Item 6" }],
    }
    beforeAll(() => {
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, core }) => html`
          <div class="level1">
            <div class="level2">
              <div class="level3">
                ${core.list1.map(({ title }) => html`<div class="item1">${title}</div>`)}
                ${core.list2.map(({ title }) => html`<div class="item2">${title}</div>`)}
                ${core.list3.map(({ title }) => html`<div class="item3">${title}</div>`)}
              </div>
            </div>
          </div>
        `
      )
      element = render({
        el: document.createElement("div"),
        ctx,
        st: {
          state: "",
          states: [],
        },
        core,
        nodes,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="level1">
          <div class="level2">
            <div class="level3">
              <div class="item1">Item 1</div>
              <div class="item1">Item 2</div>
              <div class="item2">Item 3</div>
              <div class="item2">Item 4</div>
              <div class="item3">Item 5</div>
              <div class="item3">Item 6</div>
            </div>
          </div>
        </div>
      `)
    })
  })
})
