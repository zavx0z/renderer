import { describe, it, expect } from "bun:test"
import { Context } from "@zavx0z/context"
import { parse } from "@zavx0z/template"
import { Renderer } from "../index"

const html = String.raw

describe("простой HTML элемент", () => {
  const { context, update, onUpdate } = new Context((t) => ({
    attempt: t.number.required(0),
  }))

  const core = {
    ice: [{ url: "https://ice.com" }, { url: "https://ice2.com" }],
  }

  type State = "online" | "offline"
  let state: State = "online"

  const nodes = parse<typeof context, typeof core, State>(
    ({ html, context, update, core, state }) => html`
      <h1>Config</h1>
      <ul>
        ${core.ice.map((server) => html`<li>Url: ${server.url}</li>`)}
      </ul>
      <h1>State</h1>
      <p>${state}</p>
      ${state === "offline" &&
      html` <button onclick=${() => update({ attempt: context.attempt + 1 })}>Connect</button>`}
    `
  )

  let prevState = state

  it("парсинг", () => {
    expect(nodes, "простой div с текстом").toEqual([
      {
        tag: "h1",
        type: "el",
        child: [
          {
            type: "text",
            value: "Config",
          },
        ],
      },
      {
        tag: "ul",
        type: "el",
        child: [
          {
            type: "map",
            data: "/core/ice",
            child: [
              {
                tag: "li",
                type: "el",
                child: [
                  {
                    type: "text",
                    data: "[item]/url",
                    expr: "Url: ${[0]}",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        tag: "h1",
        type: "el",
        child: [
          {
            type: "text",
            value: "State",
          },
        ],
      },
      {
        tag: "p",
        type: "el",
        child: [
          {
            type: "text",
            data: "/state",
          },
        ],
      },
      {
        type: "log",
        data: ["/state", "/offline"],
        expr: '${[0]} === "${[1]}"',
        child: [
          {
            tag: "button",
            type: "el",
            child: [
              {
                type: "text",
                value: "Connect",
              },
            ],
            event: {
              onclick: {
                expr: "() => update({ attempt: ${[0]} + 1 })",
                upd: "attempt",
                data: "/context/attempt",
              },
            },
          },
        ],
      },
    ])
  })

  it("рендер", () => {
    const target = document.createElement("div")

    const renderer = new Renderer(target, nodes, context, update, state, core)
    onUpdate((updated) => {
      renderer.update({ context: updated, ...(state !== prevState && { state }) })
      prevState = state
    })
    expect(target.innerHTML).toBeDefined()
  })
})
