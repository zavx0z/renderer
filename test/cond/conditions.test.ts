import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "../../index"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw

describe("conditions", () => {
  describe("тернарник с внутренними тегами", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      cond: t.boolean.required(true),
    }))
    beforeAll(() => {
      const nodes = parse(
        ({ html, context }) => html`<div>${context.cond ? html`<em>A</em>` : html`<span>b</span>`}</div>`
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })
    it("render - cond=true", () => {
      expect(element.innerHTML).toMatchStringHTML(html` <div><em>A</em></div> `)
    })
    it("update - cond=false", () => {
      ctx.update({ cond: false })
      expect(element.innerHTML).toMatchStringHTML(html` <div><span>b</span></div> `)
    })
  })

  describe("простой тернарный оператор с context с оберткой и соседними элементами", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      isActive: t.boolean.required(true),
    }))
    beforeAll(() => {
      const nodes = parse(
        ({ html, context }) =>
          html`<div>
            <header>Header</header>
            ${context.isActive ? html`<span>Active</span>` : html`<span>Inactive</span>`}
            <footer>Footer</footer>
          </div>`
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })

    it("render - isActive=true", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <header>Header</header>
          <span>Active</span>
          <footer>Footer</footer>
        </div>
      `)
    })
    it("update - isActive=false", () => {
      ctx.update({ isActive: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <header>Header</header>
          <span>Inactive</span>
          <footer>Footer</footer>
        </div>
      `)
    })
  })

  describe("сравнение нескольких переменных", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      cond: t.boolean.required(true),
      cond2: t.boolean.required(true),
    }))
    beforeAll(() => {
      const nodes = parse(
        ({ html, context }) =>
          html`<div>${context.cond && context.cond2 ? html`<em>A</em>` : html`<span>b</span>`}</div>`
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })

    it("render - cond=true cond2=true", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div><em>A</em></div>`)
    })
    it("update - cond=false cond2=true", () => {
      ctx.update({ cond: false, cond2: true })
      expect(element.innerHTML).toMatchStringHTML(html`<div><span>b</span></div>`)
    })
    it("update - cond=true cond2=false", () => {
      ctx.update({ cond: true, cond2: false })
      expect(element.innerHTML).toMatchStringHTML(html`<div><span>b</span></div>`)
    })
    it("update - cond=false cond2=false", () => {
      ctx.update({ cond: false, cond2: false })
      expect(element.innerHTML).toMatchStringHTML(html`<div><span>b</span></div>`)
    })
  })

  describe("сравнение переменных на равенство", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      cond: t.boolean.required(true),
      cond2: t.boolean.required(true),
    }))
    beforeAll(() => {
      const nodes = parse(
        ({ html, context }) =>
          html`<div>${context.cond === context.cond2 ? html`<em>A</em>` : html`<span>b</span>`}</div>`
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })
    it("render - cond=true cond2=true", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div><em>A</em></div>`)
    })
    it("update - cond=false cond2=true", () => {
      ctx.update({ cond: false, cond2: true })
      expect(element.innerHTML).toMatchStringHTML(html`<div><span>b</span></div>`)
    })
    it("update - cond=true cond2=false", () => {
      ctx.update({ cond: true, cond2: false })
      expect(element.innerHTML).toMatchStringHTML(html`<div><span>b</span></div>`)
    })
    it("update - cond=false cond2=false", () => {
      ctx.update({ cond: false, cond2: false })
      expect(element.innerHTML).toMatchStringHTML(html`<div><em>A</em></div>`)
    })
  })

  describe("логические операторы без тегов", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      a: t.number.required(1),
      b: t.number.required(2),
      c: t.number.required(4),
      d: t.number.required(3),
    }))
    beforeAll(() => {
      const nodes = parse<typeof ctx.context>(
        ({ html, context }) => html`${context.a < context.b && context.c > context.d ? "1" : "0"}`
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })

    it("render - a<b c>d", () => {
      expect(element.innerHTML).toMatchStringHTML(html`1`)
    })
    it("update - a>b c<d", () => {
      ctx.update({ a: 2, b: 1, c: 3, d: 4 })
      expect(element.innerHTML).toMatchStringHTML(html`0`)
    })
  })

  describe("условие вокруг self/void", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      flag: t.boolean.required(true),
    }))
    beforeAll(() => {
      const nodes = parse<typeof ctx.context>(
        ({ html, context }) => html`<div>${context.flag ? html`<br />` : html`<img src="x" />`}</div>`
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })

    it("render - flag=true", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div><br /></div>`)
    })
    it("update - flag=false", () => {
      ctx.update({ flag: false })
      expect(element.innerHTML).toMatchStringHTML(html`<div><img src="x" /></div>`)
    })
  })

  describe("condition внутри map", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    const core = {
      items: [{ show: true }, { show: false }],
    }
    beforeAll(() => {
      const nodes = parse<typeof ctx.context, typeof core>(
        ({ html, core }) => html`
          <div>
            ${core.items.map((item) =>
              item.show ? html`<div class="true-branch"></div>` : html`<div class="false-branch"></div>`
            )}
          </div>
        `
      )
      element = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })
    it("render - show=true", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="true-branch"></div>
          <div class="false-branch"></div>
        </div>
      `)
    })
    it("update - show=false", () => {
      ctx.update({ items: [{ show: false }, { show: true }] })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <div class="true-branch"></div>
          <div class="false-branch"></div>
        </div>
      `)
    })
  })

  describe("map + условия", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      list: t.array.required(["A", "B", "C", "D"]),
    }))
    beforeAll(() => {
      const nodes = parse<typeof ctx.context>(
        ({ html, context }) => html`
          <ul>
            ${context.list.map(
              (_, i) => html` <li>${(i + 1) % 2 ? html` <em>${"A"}</em> ` : html` <strong>${"B"}</strong>`}</li> `
            )}
          </ul>
        `
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })
    it("render - list=[A,B,C,D]", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <ul>
          <li><em>A</em></li>
          <li><strong>B</strong></li>
          <li><em>A</em></li>
          <li><strong>B</strong></li>
        </ul>
      `)
    })
  })

  describe("операторы сравнения — без тегов", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      a: t.number.required(1),
      b: t.number.required(2),
      c: t.number.required(4),
      d: t.number.required(3),
    }))
    beforeAll(() => {
      const nodes = parse<typeof ctx.context>(
        ({ html, context }) => html`${context.a < context.b && context.c > context.d ? "1" : "0"}`
      )
      element = render({ el: document.createElement("div"), ctx, st, core: {}, nodes })
    })
    it("render - a<b c>d", () => {
      expect(element).toMatchStringHTML(html`<div>1</div>`)
    })
    it("update - a>b c<d", () => {
      ctx.update({ a: 2, b: 1, c: 2, d: 3 })
      expect(element).toMatchStringHTML(html`<div>0</div>`)
    })
    it("update - a>b c>d", () => {
      ctx.update({ a: 2, b: 1, c: 4, d: 3 })
      expect(element).toMatchStringHTML(html`<div>0</div>`)
    })
  })
})
