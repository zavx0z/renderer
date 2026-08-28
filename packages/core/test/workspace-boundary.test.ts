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
      "react",
      "core",
      "devtools",
      "dom",
      "webgpu",
    ].map(async (directory) => {
      const manifest = await Bun.file(new URL(`packages/${directory}/package.json`, workspaceRoot)).json() as {
        name: string
      }
      return manifest.name
    }))
    expect(names).toEqual([
      "@zavx0z/renderer-browser",
      "@zavx0z/react",
      "@zavx0z/renderer",
      "@zavx0z/dom-devtools",
      "@zavx0z/dom",
      "@zavx0z/renderer-webgpu",
    ])
  })

  test("contains no React runtime or reconciler dependency", async () => {
    const manifests = await Array.fromAsync(
      new Bun.Glob("packages/*/package.json").scan({cwd: new URL("../../../", import.meta.url).pathname}),
    )
    for (const relativePath of manifests) {
      const manifest = await Bun.file(new URL(`../../../${relativePath}`, import.meta.url)).json() as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
        peerDependencies?: Record<string, string>
      }
      const graph = {...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies}
      for (const forbidden of ["react", "react-dom", "react-reconciler", "@types/react", "@types/react-reconciler"]) {
        expect(graph[forbidden], `${relativePath}: ${forbidden}`).toBeUndefined()
      }
    }
  })
})
