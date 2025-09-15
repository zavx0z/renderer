import { describe, it, expect, beforeAll } from "bun:test"
import { Context } from "@zavx0z/context"
import { render } from "../index"

const html = String.raw

describe("простой HTML элемент", () => {
  const ctx = new Context((t) => ({
    cups: t.number.required(0)({ title: "orders" }),
    last: t.string.optional()({ title: "last ordered drink" }),
  }))

  let element: HTMLElement
  const st = {
    state: "open",
    states: []
  }

  beforeAll(() => {
    element = render({
      el: document.createElement("div"),
      ctx,
      st,
      core: {
        menu: [
          { label: "Espresso", size: "30ml" },
          { label: "Cappuccino", size: "200ml" },
          { label: "Latte", size: "250ml" },
        ],
      },
      tpl: ({ html, context, update, core, state }) => html`
        <h1>Quick Coffee Order</h1>

        <p>
          Status: ${state === "open" ? "Open" : "Closed"} Orders:
          ${context.cups}${context.last && ` last: ${context.last}`}
        </p>

        ${state === "open" &&
        html`
          <ul>
            ${core.menu.map(
              (product) =>
                html`<li>
                  ${product.label} (${product.size})
                  <button onclick=${() => update({ cups: context.cups + 1, last: product.label })}>Add</button>
                </li>`
            )}
          </ul>
        `}
        ${state === "closed" && html`<p>Come back later — we’ll brew something tasty</p>`}
      `,
    })
  })
  it("рендер", () => {
    expect(element.innerHTML).toMatchStringHTML(html`
      <h1>Quick Coffee Order</h1>
      <p>Status: Open Orders: 0</p>
      <ul>
        <li>
          Espresso (30ml)
          <button>Add</button>
        </li>
        <li>
          Cappuccino (200ml)
          <button>Add</button>
        </li>
        <li>
          Latte (250ml)
          <button>Add</button>
        </li>
      </ul>
    `)
  })

  it("update", () => {
    st.state = "closed"
    ctx.update({ cups: 1, last: "Espresso" })
    expect(element.innerHTML).toMatchStringHTML(html`
      <h1>Quick Coffee Order</h1>
      <p>Status: Closed Orders: 1 last: Espresso</p>
      <p>Come back later — we’ll brew something tasty</p>
    `)
  })
})
