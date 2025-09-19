import { describe, it, expect, beforeAll } from "bun:test"
import { render } from "@zavx0z/renderer"
import { Context } from "@zavx0z/context"

const html = String.raw
describe("boolean атрибуты", () => {
  it("булевы атрибуты с переменными из разных уровней вложенности", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: {
          companies: [
            { id: "1", active: true, departments: [{ id: "1", active: true }] },
            { id: "2", active: false, departments: [{ id: "2", active: true }] },
          ],
        },
        tpl: ({ html, core }) => html`
          <div>
            ${core.companies.map(
              (company) => html`
                <section ${company.active && "data-active"}>
                  ${company.departments.map(
                    (dept) => html`
                      <article ${company.active && dept.active && "data-active"}>
                        Dept: ${company.id}-${dept.id}
                      </article>
                    `
                  )}
                </section>
              `
            )}
          </div>
        `,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`
        <div>
          <section data-active>
            <article data-active>Dept: 1-1</article>
          </section>
          <section>
            <article>Dept: 2-2</article>
          </section>
        </div>
      `)
    })
  })
  describe("boolean атрибуты с переменными из разных уровней map", () => {
    let element: HTMLElement
    const ctx = new Context((t) => ({}))
    beforeAll(() => {
      element = render({
        el: document.createElement("div"),
        ctx,
        st: { state: "state", states: [] },
        core: { visible: true },
        tpl: ({ html, core }) => html`<img src="https://example.com" ${core.visible ? "visible" : "hidden"} />`,
      })
    })
    it("render", () => {
      expect(element.innerHTML).toMatchStringHTML(html`<img src="https://example.com" visible />`)
    })
  })
})
