import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { contextSchema, contextFromSchema } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw
describe("class атрибуты в data.ts", () => {
  describe("простые случаи", () => {
    describe("class в элементе с одним статическим значением", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(({ html }) => html`<div class="div-active"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active"></div>`)
      })
    })

    describe("class в элементе с одним статическим значением без кавычек", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(({ html }) => html`<div class="div-active"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active"></div>`)
      })
    })

    describe("class в элементе с несколькими статическими значениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="div-active div-inactive"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active div-inactive"></div>`)
      })
    })
  })

  describe("динамические значения", () => {
    describe("class в элементе с одним динамическим значением", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="${core.active ? "active" : "inactive"}"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })

      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active"></div>`)
      })
    })

    describe("class в элементе с несколькими статическими значениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="div-active div-inactive"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active div-inactive"></div>`)
      })
    })
    describe("class в элементе с несколькими статическими значениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="div-active div-inactive"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active div-inactive"></div>`)
      })
    })
  })

  describe("динамические значения", () => {
    describe("class в элементе с одним динамическим значением", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="${core.active ? "active" : "inactive"}"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active"></div>`)
      })
    })

    describe("class в элементе с одним динамическим значением без кавычек", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class=${core.active ? "active" : "inactive"}></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("ren der", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active"></div>`)
      })
    })

    describe("class в элементе с несколькими динамическими значениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(({ html }) => html`<div class="div-active div-inactive"></div> `)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active div-inactive"></div>`)
      })
    })

    describe("class в элементе с несколькими динамическими значениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) =>
            html`<div class="${core.active ? "active" : "inactive"} ${core.active ? "active" : "inactive"}"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active active"></div>`)
      })
    })

    describe("class в элементе с операторами сравнения", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="${core.count > 5 ? "large" : "small"}"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { count: 6 }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="large"></div>`)
      })
    })

    describe("class в элементе с операторами равенства", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)
      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<div class="${core.status === "loading" ? "loading" : "ready"}"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { status: "loading" }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="loading"></div>`)
      })
    })

    describe("class в элементе с логическими операторами", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<div class="${core.active && core.visible ? "show" : "hide"}"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true, visible: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="show"></div>`)
      })
    })

    describe("class в элементе с оператором ИЛИ", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<div class="${core.error || core.warning ? "alert" : "normal"}"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { error: true, warning: false }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="alert"></div>`)
      })
    })

    describe("class в элементе с оператором НЕ", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="${!core.disabled ? "enabled" : "disabled"}"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { disabled: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="disabled"></div>`)
      })
    })

    describe("class в элементе с оператором НЕ", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="${!core.disabled ? "enabled" : "disabled"}"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { disabled: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="disabled"></div>`)
      })
    })
    describe("class в элементе с оператором И &&", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="${core.active && "active"}"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active"></div>`)
      })
    })
  })

  describe("смешанные значения", () => {
    describe("class в элементе с одним смешанным значением", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="div-${core.active ? "active" : "inactive"}"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active"></div>`)
      })
    })

    describe("class в элементе с одним смешанным значением без кавычек", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(({ html, core }) => html`<div class="div-${core.active ? "active" : "inactive"}"></div>`)
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active"></div>`)
      })
    })

    describe("class в элементе с несколькими смешанными значениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`
            <div class="div-${core.active ? "active" : "inactive"} div-${core.active ? "active" : "inactive"}"></div>
          `
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active div-active"></div>`)
      })
    })
  })

  describe("различные варианты", () => {
    describe("class в элементе с смешанным и статическим значениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<div class="div-${core.active ? "active" : "inactive"} visible"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="div-active visible"></div>`)
      })
    })

    describe("class в элементе с динамическим и статическим значениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<div class="${core.active ? "active" : "inactive"} visible"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="active visible"></div>`)
      })
    })

    describe("class в элементе с тремя различными типами значений", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) =>
            html`<div class="static-value ${core.active ? "active" : "inactive"} mixed-${core.type}"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true, type: "type" }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="static-value active mixed-type"></div>`)
      })
    })

    describe("class в элементе с несколькими смешанными значениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<div class="btn-${core.variant} text-${core.size} bg-${core.theme}"></div>`
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st,
          core: { variant: "variant", size: "size", theme: "theme" },
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="btn-variant text-size bg-theme"></div>`)
      })
    })

    describe("class в элементе с условными классами", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) =>
            html`<div
              class="base-class ${core.active ? "active" : "inactive"} ${core.disabled ? "disabled" : ""}"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true, disabled: false }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="base-class active"></div>`)
      })
    })

    describe("class в элементе с вложенными выражениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<div class="container ${core.nested ? "nested" : "default"}"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { nested: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="container nested"></div>`)
      })
    })

    describe("class в элементе с пустыми значениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) =>
            html`<div class="visible ${core.hidden ? "" : "show"} ${core.active ? "active" : ""}"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { hidden: true, active: true }, nodes })
      })
      it("render", () => {
        console.log(element.innerHTML)
        expect(element.innerHTML).toMatchStringHTML(html`<div class="visible active"></div>`)
      })
    })

    describe("class в элементе с атрибутом без кавычек", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<div class="static-value-${core.active ? "active" : "inactive"}"></div>`
        )
        element = render({ el: document.createElement("div"), ctx, st, core: { active: true }, nodes })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="static-value-active"></div>`)
      })
    })

    describe("class в элементе со сложной строкой с несколькими переменными", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<div class="user-${core.user.id}-${core.user.role}-${core.theme}"></div>`
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st,
          core: { user: { id: "id", role: "role" }, theme: "theme" },
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="user-id-role-theme"></div>`)
      })
    })

    describe("class в элементе со сложной строкой с условными выражениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) =>
            html`<div
              class="user-${core.user.id}-${core.user.role}-${core.theme}-${core.isActive
                ? "active"
                : "inactive"}"></div>`
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st,
          core: { user: { id: "id", role: "role" }, theme: "theme", isActive: true },
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="user-id-role-theme-active"></div>`)
      })
    })

    describe("class в элементе с массивом классов со сложной строкой", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) => html`<div class="base user-${core.user.id}-${core.user.role} theme-${core.theme}"></div>`
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st,
          core: { user: { id: "id", role: "role" }, theme: "theme" },
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="base user-id-role theme-theme"></div>`)
      })
    })

    describe("class в элементе с массивом классов и сложными условными выражениями", () => {
      let element: HTMLElement
      const schema = contextSchema((t) => ({}))
      const ctx = contextFromSchema(schema)

      beforeAll(() => {
        const nodes = parse(
          ({ html, core }) =>
            html`<div
              class="base user-${core.user.id} ${core.isActive ? "active" : "inactive"} ${core.isAdmin
                ? "admin"
                : "user"} theme-${core.theme}"></div>`
        )
        element = render({
          el: document.createElement("div"),
          ctx,
          st,
          core: { user: { id: "id", role: "role" }, theme: "theme", isActive: true, isAdmin: true },
          nodes,
        })
      })
      it("render", () => {
        expect(element.innerHTML).toMatchStringHTML(html`<div class="base user-id active admin theme-theme"></div>`)
      })
    })
  })
  describe("постфикс с условием и статическими значениями", () => {
    let element: HTMLElement
    const schema = contextSchema((t) => ({}))
    const ctx = contextFromSchema(schema)

    beforeAll(() => {
      const nodes = parse(
        ({ html, core }) => html`<div class="${core.status ? "active" : "inactive"}-status">Status</div>`
      )
      element = render({ el: document.createElement("div"), ctx, st, core: { status: true }, nodes })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<div class="active-status">Status</div>`)
    })
  })
})
