import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { st } from "fixture/params"

const html = String.raw
describe("object атрибуты (стили) с переменными из разных уровней map", () => {
  describe("стили с переменными из разных уровней вложенности", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    const core = {
      companies: [
        { id: "1", theme: "red", departments: [{ id: "1", color: "blue" }] },
        { id: "2", theme: "green", departments: [{ id: "2", color: "yellow" }] },
      ],
    }
    beforeAll(() => {
      const nodes = parse<any, typeof core>(
        ({ html, core }) =>
          html`<div>
            ${core.companies.map(
              (company) => html`
                <section style="${{ backgroundColor: company.theme }}">
                  ${company.departments.map(
                    (dept) => html`
                      <article
                        style="${{
                          color: company.theme,
                          borderColor: dept.color,
                        }}">
                        Dept: ${company.id}-${dept.id}
                      </article>
                    `
                  )}
                </section>
              `
            )}
          </div>`
      )
      element = render({ el: document.createElement("div"), ctx, st, core, nodes })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <section style="background-color: red;">
            <article style="color: red; border-color: blue;">Dept: 1-1</article>
          </section>
          <section style="background-color: green;">
            <article style="color: green; border-color: yellow;">Dept: 2-2</article>
          </section>
        </div>
      `)
    })
  })

  describe("стили со смешанными статическими и динамическими значениями", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    const core = {
      users: [{ id: "1", theme: "red" }],
    }
    beforeAll(() => {
      const nodes = parse<any, typeof core>(
        ({ html, core }) => html`
          <div>
            ${core.users.map(
              (user) => html`
                <div
                  style="${{
                    color: "red",
                    backgroundColor: user.theme,
                    border: "1px solid black",
                    fontSize: "14px",
                  }}">
                  User: ${user.id}
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
          <div style="color: red; background-color: red; border: 1px solid black; font-size: 14px;">User: 1</div>
        </div>
      `)
    })
  })
})
