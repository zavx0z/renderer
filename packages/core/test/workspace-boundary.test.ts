import {describe, expect, test} from "bun:test"

const workspaceRoot = new URL("../../../", import.meta.url)

describe("renderer workspace retirement boundary", () => {
  test("has no historical root renderer implementation or release tooling", async () => {
    for (const path of [
      "dom.ts",
      "index.ts",
      "program.ts",
      "fixture/expect.ts",
      "script/build.ts",
      "typedoc.json",
      "markdown.typedoc.json",
      ".github/workflows/docs.yml",
      ".github/workflows/release.yml",
      ".vscode/tasks.json",
    ]) {
      expect(await Bun.file(new URL(path, workspaceRoot)).exists()).toBe(false)
    }
  })

  test("publishes only the clean workspace package graph", async () => {
    const root = await Bun.file(new URL("package.json", workspaceRoot)).json() as {
      name: string
      private: boolean
      workspaces: readonly string[]
      scripts: Record<string, string>
    }
    expect(root).toMatchObject({
      name: "@zavx0z/renderer-workspace",
      private: true,
      workspaces: ["packages/*"],
    })
    expect(root.scripts.check).toBe("bun run typecheck && bun run test")

    const names = await Promise.all([
      "browser",
      "components",
      "core",
      "devtools",
      "dom",
      "react",
      "web-realm",
      "webgpu",
    ].map(async (directory) => {
      const manifest = await Bun.file(new URL(`packages/${directory}/package.json`, workspaceRoot)).json() as {
        name: string
      }
      return manifest.name
    }))
    expect(names).toEqual([
      "@zavx0z/renderer-browser",
      "@zavx0z/dom-components",
      "@zavx0z/renderer",
      "@zavx0z/dom-devtools",
      "@zavx0z/dom",
      "@zavx0z/dom-react",
      "@zavx0z/web-realm",
      "@zavx0z/renderer-webgpu",
    ])
  })
})
