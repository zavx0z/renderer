import { describe, it, expect, beforeAll } from "bun:test"
import { parse, type Node } from "../../../index"

describe("core/context в атрибутах", () => {
  describe("core с динамическими значениями", () => {
    let elements: Node[]

    beforeAll(() => {
      elements = parse(
        ({ html, core, context }) => html`<meta-${core.tag} core=${{ id: context.id, name: context.name }} />`
      )
    })
    it("data", () => {
      expect(elements).toEqual([
        {
          tag: {
            data: "/core/tag",
            expr: "meta-${_[0]}",
          },
          type: "meta",
          core: {
            data: ["/context/id", "/context/name"],
            expr: "{ id: _[0], name: _[1] }",
          },
        },
      ])
    })
  })

  describe("core со статическими значениями", () => {
    let elements: Node[]

    beforeAll(() => {
      elements = parse(({ html, core }) => html`<meta-${core.tag} core=${{ id: "1", name: "2" }} />`)
    })
    it("data", () => {
      expect(elements).toEqual([
        {
          tag: {
            data: "/core/tag",
            expr: "meta-${_[0]}",
          },
          type: "meta",
          core: '{ id: "1", name: "2" }',
        },
      ])
    })
  })

  describe("core/context во вложенных элементах", () => {
    let elements: Node[]

    beforeAll(() => {
      elements = parse(
        ({ html, core, context }) => html`
          <div><meta-${core.tag} context=${{ id: context.id, name: context.name }} /></div>
        `
      )
    })
    it("data", () => {
      expect(elements).toEqual([
        {
          tag: "div",
          type: "el",
          child: [
            {
              tag: {
                data: "/core/tag",
                expr: "meta-${_[0]}",
              },
              type: "meta",
              context: {
                data: ["/context/id", "/context/name"],
                expr: "{ id: _[0], name: _[1] }",
              },
            },
          ],
        },
      ])
    })
  })

  describe("context", () => {
    let elements: Node[]

    beforeAll(() => {
      elements = parse(
        ({ html, core, context }) => html`<meta-${core.tag} context=${{ id: context.id, name: context.name }} />`
      )
    })
    it("data", () => {
      expect(elements).toEqual([
        {
          tag: {
            data: "/core/tag",
            expr: "meta-${_[0]}",
          },
          type: "meta",
          context: {
            data: ["/context/id", "/context/name"],
            expr: "{ id: _[0], name: _[1] }",
          },
        },
      ])
    })
  })

  describe("core/context", () => {
    let elements: Node[]

    beforeAll(() => {
      elements = parse(
        ({ html, core, context }) => html`
          <meta-${core.tag}
            core=${{ id: context.id, name: context.name }}
            context=${{ id: context.id, name: context.name }} />
        `
      )
    })
    it("data", () => {
      expect(elements).toEqual([
        {
          tag: {
            data: "/core/tag",
            expr: "meta-${_[0]}",
          },
          type: "meta",
          core: {
            data: ["/context/id", "/context/name"],
            expr: "{ id: _[0], name: _[1] }",
          },
          context: {
            data: ["/context/id", "/context/name"],
            expr: "{ id: _[0], name: _[1] }",
          },
        },
      ])
    })
  })
})
