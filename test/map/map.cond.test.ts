import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw
describe("map с условиями", () => {
  describe("map соседствующий с map в условии на верхнем уровне", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      flag: t.boolean.required(true),
    }))

    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {
          list1: [{ title: "Item 1" }, { title: "Item 2" }],
          list2: [{ title: "Item 3" }, { title: "Item 4" }],
        },
        tpl: ({ html, core, context }) => html`
          ${core.list1.map(({ title }) => html`<div class="item1">${title}</div>`)}
          ${context.flag
            ? html`<div class="conditional">
                ${core.list2.map(({ title }) => html`<div class="item2">${title}</div>`)}
              </div>`
            : html`<div class="fallback">No items</div>`}
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="item1">Item 1</div>
        <div class="item1">Item 2</div>
        <div class="conditional">
          <div class="item2">Item 3</div>
          <div class="item2">Item 4</div>
        </div>
      `)
    })
  })

  describe("map соседствующий с map в условии внутри элемента", () => {
    const ctx = new Context((t) => ({
      flag: t.boolean.required(true),
    }))
    let element: HTMLElement

    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {
          list1: [{ title: "Item 1" }, { title: "Item 2" }],
          list2: [{ title: "Item 3" }, { title: "Item 4" }],
        },
        tpl: ({ html, core, context }) => html`
          <div class="container">
            ${core.list1.map(({ title }) => html`<div class="item1">${title}</div>`)}
            ${context.flag
              ? html`<div class="conditional">
                  ${core.list2.map(({ title }) => html`<div class="item2">${title}</div>`)}
                </div>`
              : html`<div class="fallback">No items</div>`}
          </div>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="container">
          <div class="item1">Item 1</div>
          <div class="item1">Item 2</div>
          <div class="conditional">
            <div class="item2">Item 3</div>
            <div class="item2">Item 4</div>
          </div>
        </div>
      `)
    })
  })

  describe("map соседствующий с map в условии на глубоком уровне вложенности", () => {
    const ctx = new Context((t) => ({
      flag: t.boolean.required(true),
      deepFlag: t.boolean.required(true),
    }))
    let element: HTMLElement

    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {
          list1: [{ title: "Item 1" }, { title: "Item 2" }],
          list2: [{ title: "Item 3" }, { title: "Item 4" }],
          list3: [{ title: "Item 5" }, { title: "Item 6" }],
        },
        tpl: ({ html, core, context }) => html`
          <div class="level1">
            <div class="level2">
              <div class="level3">
                ${core.list1.map(({ title }) => html`<div class="item1">${title}</div>`)}
                ${context.flag
                  ? html`<div class="conditional">
                      ${core.list2.map(({ title }) => html`<div class="item2">${title}</div>`)}
                      ${context.deepFlag
                        ? html`<div class="deep-conditional">
                            ${core.list3.map(({ title }) => html`<div class="item3">${title}</div>`)}
                          </div>`
                        : html`<div class="deep-fallback">No deep items</div>`}
                    </div>`
                  : html`<div class="fallback">No items</div>`}
              </div>
            </div>
          </div>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="level1">
          <div class="level2">
            <div class="level3">
              <div class="item1">Item 1</div>
              <div class="item1">Item 2</div>
              <div class="conditional">
                <div class="item2">Item 3</div>
                <div class="item2">Item 4</div>
                <div class="deep-conditional">
                  <div class="item3">Item 5</div>
                  <div class="item3">Item 6</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `)
    })
  })

  describe("map внутри condition", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({ show: t.boolean.required(true) }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { items: ["Item 1", "Item 2"] },
        tpl: ({ html, core, context }) => html`
          <div>
            ${context.show
              ? html` ${core.items.map((item) => html`<div class="true-${item}"></div>`)}`
              : html` ${core.items.map((item) => html`<div class="false-${item}"></div>`)}`}
          </div>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="true-Item 1"></div>
          <div class="true-Item 2"></div>
        </div>
      `)
    })
  })
})
