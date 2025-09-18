import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "../../index"
import { Context } from "@zavx0z/context"

const html = String.raw
describe("условия соседствующие", () => {
  describe("условие соседствующее с условием на верхнем уровне", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      flag1: t.boolean.required(true),
      flag2: t.boolean.required(false),
    }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, context }) => html`
          ${context.flag1
            ? html`<div class="conditional1">Content 1</div>`
            : html`<div class="fallback1">No content 1</div>`}
          ${context.flag2
            ? html`<div class="conditional2">Content 2</div>`
            : html`<div class="fallback2">No content 2</div>`}
        `,
      })
    })
    it("render - flag1=true flag2=false", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="conditional1">Content 1</div>
        <div class="fallback2">No content 2</div>
      `)
    })
    it("update - flag1=false flag2=true", () => {
      ctx.update({ flag1: false, flag2: true })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="fallback1">No content 1</div>
        <div class="conditional2">Content 2</div>
      `)
    })
    it("update - flag1=true flag2=true", () => {
      ctx.update({ flag1: true, flag2: true })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="conditional1">Content 1</div>
        <div class="conditional2">Content 2</div>
      `)
    })
    it("update - flag1=false flag2=false", () => {
      ctx.update({ flag1: false, flag2: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="fallback1">No content 1</div>
        <div class="fallback2">No content 2</div>
      `)
    })
  })

  describe("условие соседствующее с условием внутри элемента", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({ flag1: t.boolean.required(true), flag2: t.boolean.required(false) }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, context }) => html`
          <div class="container">
            ${context.flag1
              ? html`<div class="conditional1">Content 1</div>`
              : html`<div class="fallback1">No content 1</div>`}
            ${context.flag2
              ? html`<div class="conditional2">Content 2</div>`
              : html`<div class="fallback2">No content 2</div>`}
          </div>
        `,
      })
    })
    it("render - flag1=true flag2=false", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="container">
          <div class="conditional1">Content 1</div>
          <div class="fallback2">No content 2</div>
        </div>
      `)
    })
    it("update - flag1=false flag2=true", () => {
      ctx.update({ flag1: false, flag2: true })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="container">
          <div class="fallback1">No content 1</div>
          <div class="conditional2">Content 2</div>
        </div>
      `)
    })
    it("update - flag1=true flag2=true", () => {
      ctx.update({ flag1: true, flag2: true })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="container">
          <div class="conditional1">Content 1</div>
          <div class="conditional2">Content 2</div>
        </div>
      `)
    })
    it("update - flag1=false flag2=false", () => {
      ctx.update({ flag1: false, flag2: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="container">
          <div class="fallback1">No content 1</div>
          <div class="fallback2">No content 2</div>
        </div>
      `)
    })
  })

  describe("условие соседствующее с условием на глубоком уровне вложенности", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({
      flag1: t.boolean.required(true),
      flag2: t.boolean.required(false),
      flag3: t.boolean.required(false),
    }))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {},
        tpl: ({ html, context }) => html`
          <div class="level1">
            <div class="level2">
              <div class="level3">
                ${context.flag1
                  ? html`<div class="conditional1">Content 1</div>`
                  : html`<div class="fallback1">No content 1</div>`}
                ${context.flag2
                  ? html`<div class="conditional2">Content 2</div>`
                  : html`<div class="fallback2">No content 2</div>`}
                ${context.flag3
                  ? html`<div class="conditional3">Content 3</div>`
                  : html`<div class="fallback3">No content 3</div>`}
              </div>
            </div>
          </div>
        `,
      })
    })
    it("render - flag1=true flag2=false flag3=false", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="level1">
          <div class="level2">
            <div class="level3">
              <div class="conditional1">Content 1</div>
              <div class="fallback2">No content 2</div>
              <div class="fallback3">No content 3</div>
            </div>
          </div>
        </div>
      `)
    })
    it("update - flag1=false flag2=true flag3=false", () => {
      ctx.update({ flag1: false, flag2: true, flag3: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="level1">
          <div class="level2">
            <div class="level3">
              <div class="fallback1">No content 1</div>
              <div class="conditional2">Content 2</div>
              <div class="fallback3">No content 3</div>
            </div>
          </div>
        </div>
      `)
    })
    it("update - flag1=true flag2=true flag3=false", () => {
      ctx.update({ flag1: true, flag2: true, flag3: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="level1">
          <div class="level2">
            <div class="level3">
              <div class="conditional1">Content 1</div>
              <div class="conditional2">Content 2</div>
              <div class="fallback3">No content 3</div>
            </div>
          </div>
        </div>
      `)
    })
    it("update - flag1=false flag2=false flag3=false", () => {
      ctx.update({ flag1: false, flag2: false, flag3: false })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="level1">
          <div class="level2">
            <div class="level3">
              <div class="fallback1">No content 1</div>
              <div class="fallback2">No content 2</div>
              <div class="fallback3">No content 3</div>
            </div>
          </div>
        </div>
      `)
    })
    it("update - flag1=false flag2=false flag3=true", () => {
      ctx.update({ flag1: false, flag2: false, flag3: true })
      expect(element.innerHTML).toMatchStringHTML(html`
        <div class="level1">
          <div class="level2">
            <div class="level3">
              <div class="fallback1">No content 1</div>
              <div class="fallback2">No content 2</div>
              <div class="conditional3">Content 3</div>
            </div>
          </div>
        </div>
      `)
    })
  })
})
