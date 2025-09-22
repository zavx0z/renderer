import { describe, it, expect, beforeAll } from "bun:test"
import { parse, type Node } from "@zavx0z/template"

describe("meta-компоненты с core/context в map и condition", () => {
  describe("meta-элемент с пустыми объектами", () => {
    let elements: Node[]

    beforeAll(() => {
      elements = parse(({ html }) => html` <meta-hash context=${{}} core=${{}} /> `)
    })
    it("attributes", () => {
      expect(elements, "при обработке пустых объектов не должен устанавливаться core и context").toEqual([
        {
          tag: "meta-hash",
          type: "meta",
        },
      ])
    })
    it("data", () => {
      expect(elements, "core и context не должно быть в data").toEqual([
        {
          tag: "meta-hash",
          type: "meta",
        },
      ])
    })
  })
  describe("meta-компоненты в map с core объектами", () => {
    type Core = { items: any[]; tag: string; type: string }
    let elements: Node[]

    beforeAll(() => {
      elements = parse<any, Core>(
        ({ html, core, context }) => html`
          <div>
            ${core.items.map(
              (item) => html`
                <meta-${core.tag}
                  core=${{ id: item.id, name: item.name, type: core.type }}
                  context=${{ status: item.status, active: item.active }} />
              `
            )}
          </div>
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
              type: "map",
              data: "/core/items",
              child: [
                {
                  tag: {
                    data: "/core/tag",
                    expr: "meta-${_[0]}",
                  },
                  type: "meta",
                  core: {
                    data: ["[item]/id", "[item]/name", "/core/type"],
                    expr: "{ id: _[0], name: _[1], type: _[2] }",
                  },
                  context: {
                    data: ["[item]/status", "[item]/active"],
                    expr: "{ status: _[0], active: _[1] }",
                  },
                },
              ],
            },
          ],
        },
      ])
    })
  })

  describe("meta-компоненты в condition с core/context объектами", () => {
    let elements: Node[]

    beforeAll(() => {
      elements = parse(
        ({ html, core, context }) => html`
          <div>
            ${context.showMeta
              ? html`
                  <meta-${core.tag}
                    core=${{ id: context.id, name: context.name }}
                    context=${{ type: "primary", active: true }} />
                `
              : html`
                  <meta-${core.tag}
                    core=${{ id: "default", name: "default" }}
                    context=${{ type: "secondary", active: false }} />
                `}
          </div>
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
              type: "cond",
              data: "/context/showMeta",
              child: [
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
                  context: '{ type: "primary", active: true }',
                },
                {
                  tag: {
                    data: "/core/tag",
                    expr: "meta-${_[0]}",
                  },
                  type: "meta",
                  core: '{ id: "default", name: "default" }',
                  context: '{ type: "secondary", active: false }',
                },
              ],
            },
          ],
        },
      ])
    })
  })

  describe("meta-компоненты в map внутри condition", () => {
    type Core = { items: any[]; tag: string; type: string }
    let elements: Node[]

    beforeAll(() => {
      elements = parse<any, Core>(
        ({ html, core, context }) => html`
          <div>
            ${context.showList
              ? html`
                  ${core.items.map(
                    (item) => html`
                      <meta-${core.tag}
                        core=${{
                          id: item.id,
                          name: item.name,
                          type: core.type,
                          metadata: item.metadata,
                        }}
                        context=${{
                          status: item.status,
                          active: item.active,
                          permissions: item.permissions,
                        }} />
                    `
                  )}
                `
              : html`
                  <meta-${core.tag}
                    core=${{ id: "empty", name: "empty" }}
                    context=${{ type: "empty", active: false }} />
                `}
          </div>
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
              type: "cond",
              data: "/context/showList",
              child: [
                {
                  type: "map",
                  data: "/core/items",
                  child: [
                    {
                      tag: {
                        data: "/core/tag",
                        expr: "meta-${_[0]}",
                      },
                      type: "meta",
                      core: {
                        data: ["[item]/id", "[item]/name", "/core/type", "[item]/metadata"],
                        expr: "{ id: _[0], name: _[1], type: _[2], metadata: _[3] }",
                      },
                      context: {
                        data: ["[item]/status", "[item]/active", "[item]/permissions"],
                        expr: "{ status: _[0], active: _[1], permissions: _[2] }",
                      },
                    },
                  ],
                },
                {
                  tag: {
                    data: "/core/tag",
                    expr: "meta-${_[0]}",
                  },
                  type: "meta",
                  core: '{ id: "empty", name: "empty" }',
                  context: '{ type: "empty", active: false }',
                },
              ],
            },
          ],
        },
      ])
    })
  })

  describe("meta-компоненты в condition внутри map", () => {
    type Core = { items: any[]; tag: string }
    let elements: Node[]

    beforeAll(() => {
      elements = parse<any, Core>(
        ({ html, core }) => html`
          <div>
            ${core.items.map(
              (item) => html`
                ${item.isActive
                  ? html`
                      <meta-${core.tag}
                        core=${{
                          id: item.id,
                          name: item.name,
                          type: "active",
                        }}
                        context=${{
                          status: "active",
                          permissions: item.permissions,
                        }} />
                    `
                  : item.hasError
                  ? html`
                      <meta-${core.tag}
                        core=${{
                          id: item.id,
                          name: item.name,
                          type: "error",
                        }}
                        context=${{
                          status: "error",
                          message: "Item has error",
                        }} />
                    `
                  : html`
                      <meta-${core.tag}
                        core=${{ id: item.id, name: item.name, type: "inactive" }}
                        context=${{ status: "inactive" }} />
                    `}
              `
            )}
          </div>
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
              type: "map",
              data: "/core/items",
              child: [
                {
                  type: "cond",
                  data: "[item]/isActive",
                  child: [
                    {
                      tag: {
                        data: "/core/tag",
                        expr: "meta-${_[0]}",
                      },
                      type: "meta",
                      core: {
                        data: ["[item]/id", "[item]/name"],
                        expr: '{ id: _[0], name: _[1], type: "active" }',
                      },
                      context: {
                        data: "[item]/permissions",
                        expr: '{ status: "active", permissions: _[0] }',
                      },
                    },
                    {
                      type: "cond",
                      data: "[item]/hasError",
                      child: [
                        {
                          tag: {
                            data: "/core/tag",
                            expr: "meta-${_[0]}",
                          },
                          type: "meta",
                          core: {
                            data: ["[item]/id", "[item]/name"],
                            expr: '{ id: _[0], name: _[1], type: "error" }',
                          },
                          context: '{ status: "error", message: "Item has error" }',
                        },
                        {
                          tag: {
                            data: "/core/tag",
                            expr: "meta-${_[0]}",
                          },
                          type: "meta",
                          core: {
                            data: ["[item]/id", "[item]/name"],
                            expr: '{ id: _[0], name: _[1], type: "inactive" }',
                          },
                          context: '{ status: "inactive" }',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ])
    })
  })

  describe("сложные meta-компоненты с вложенными core/context объектами", () => {
    type Core = { users: any[]; tag: string }
    let elements: Node[]

    beforeAll(() => {
      elements = parse<any, Core>(
        ({ html, core }) => html`
          <div>
            ${core.users.map(
              (user) => html`
                ${user.permissions.includes("admin")
                  ? html`<meta-${core.tag}
                      core=${{
                        id: user.id,
                        name: user.name,
                        type: "admin",
                        permissions: user.permissions,
                        metadata: {
                          level: "admin",
                          access: "full",
                          settings: user.settings,
                        },
                      }}
                      context=${{
                        status: "admin",
                        active: user.isOnline,
                        canEdit: true,
                        canDelete: true,
                        canManage: true,
                      }} />`
                  : user.permissions.includes("moderator")
                  ? html`<meta-${core.tag}
                      core=${{
                        id: user.id,
                        name: user.name,
                        type: "moderator",
                        permissions: user.permissions,
                        metadata: {
                          level: "moderator",
                          access: "limited",
                          settings: user.settings,
                        },
                      }}
                      context=${{
                        status: "moderator",
                        active: user.isOnline,
                        canEdit: true,
                        canDelete: false,
                        canManage: false,
                      }} />`
                  : html`<meta-${core.tag}
                      core=${{
                        id: user.id,
                        name: user.name,
                        type: "user",
                        permissions: user.permissions,
                        metadata: {
                          level: "user",
                          access: "basic",
                          settings: user.settings,
                        },
                      }}
                      context=${{
                        status: "user",
                        active: user.isOnline,
                        canEdit: false,
                        canDelete: false,
                        canManage: false,
                      }} />`}
              `
            )}
          </div>
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
              type: "map",
              data: "/core/users",
              child: [
                {
                  type: "cond",
                  data: "[item]/permissions/includes",
                  expr: '_[0]("admin")',
                  child: [
                    {
                      tag: {
                        data: "/core/tag",
                        expr: "meta-${_[0]}",
                      },
                      type: "meta",
                      core: {
                        data: ["[item]/id", "[item]/name", "[item]/permissions", "[item]/settings"],
                        expr: '{ id: _[0], name: _[1], type: "admin", permissions: _[2], metadata: { level: "admin", access: "full", settings: _[3] } }',
                      },
                      context: {
                        data: "[item]/isOnline",
                        expr: '{ status: "admin", active: _[0], canEdit: true, canDelete: true, canManage: true }',
                      },
                    },
                    {
                      type: "cond",
                      data: "[item]/permissions/includes",
                      expr: '_[0]("moderator")',
                      child: [
                        {
                          tag: {
                            data: "/core/tag",
                            expr: "meta-${_[0]}",
                          },
                          type: "meta",
                          core: {
                            data: ["[item]/id", "[item]/name", "[item]/permissions", "[item]/settings"],
                            expr: '{ id: _[0], name: _[1], type: "moderator", permissions: _[2], metadata: { level: "moderator", access: "limited", settings: _[3] } }',
                          },
                          context: {
                            data: "[item]/isOnline",
                            expr: '{ status: "moderator", active: _[0], canEdit: true, canDelete: false, canManage: false }',
                          },
                        },
                        {
                          tag: {
                            data: "/core/tag",
                            expr: "meta-${_[0]}",
                          },
                          type: "meta",
                          core: {
                            data: ["[item]/id", "[item]/name", "[item]/permissions", "[item]/settings"],
                            expr: '{ id: _[0], name: _[1], type: "user", permissions: _[2], metadata: { level: "user", access: "basic", settings: _[3] } }',
                          },
                          context: {
                            data: "[item]/isOnline",
                            expr: '{ status: "user", active: _[0], canEdit: false, canDelete: false, canManage: false }',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ])
    })
  })

  describe("meta-компоненты с динамическими core/context объектами", () => {
    type Core = { items: any[]; tag: string; type: string }
    let elements: Node[]

    beforeAll(() => {
      elements = parse<any, Core>(
        ({ html, core, context }) => html`
          <div>
            ${core.items.map(
              (item) => html`
                <meta-${core.tag}
                  core=${{
                    id: item.id,
                    name: item.name,
                    type: core.type,
                    dynamic: item.isActive ? "active" : "inactive",
                    computed: `${item.id}-${item.name}`,
                    metadata: {
                      status: item.status,
                      priority: item.priority || "normal",
                      tags: item.tags || [],
                    },
                  }}
                  context=${{
                    status: item.isActive ? "active" : "inactive",
                    active: item.isActive,
                    canEdit: item.permissions.includes("edit"),
                    canDelete: item.permissions.includes("delete"),
                    dynamic: {
                      lastModified: item.lastModified,
                      created: item.created,
                      updated: item.updated || item.lastModified,
                    },
                  }} />
              `
            )}
          </div>
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
              type: "map",
              data: "/core/items",
              child: [
                {
                  tag: {
                    data: "/core/tag",
                    expr: "meta-${_[0]}",
                  },
                  type: "meta",
                  context: {
                    data: [
                      "[item]/isActive",
                      "[item]/permissions/includes",
                      "[item]/lastModified",
                      "[item]/created",
                      "[item]/updated",
                    ],
                    expr: '{ status: _[0] ? "active" : "inactive", active: _[0], canEdit: _[1]("edit"), canDelete: _[1]("delete"), dynamic: { lastModified: _[2], created: _[3], updated: _[4] || _[2] } }',
                  },
                  core: {
                    data: [
                      "[item]/id",
                      "[item]/name",
                      "/core/type",
                      "[item]/isActive",
                      "[item]/status",
                      "[item]/priority",
                      "[item]/tags",
                    ],
                    expr: '{ id: _[0], name: _[1], type: _[2], dynamic: _[3] ? "active" : "inactive", computed: `${_[0]}-${_[1]}`, metadata: { status: _[4], priority: _[5] || "normal", tags: _[6] || [] } }',
                  },
                },
              ],
            },
          ],
        },
      ])
    })
  })
})
