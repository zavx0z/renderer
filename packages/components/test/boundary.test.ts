import {describe, expect, test} from "bun:test"

describe("@zavx0z/dom-components boundary", () => {
  test("depends on semantic DOM and the TypeScript 7 build API, not React or render stages", async () => {
    const manifest = await Bun.file(new URL("../package.json", import.meta.url)).json() as {
      bin: Record<string, string>
      name: string
      peerDependencies: Record<string, string>
    }
    const runtime = await Bun.file(new URL("../src/runtime.ts", import.meta.url)).text()

    expect(manifest.name).toBe("@zavx0z/dom-components")
    expect(manifest.bin).toEqual({"zavx0z-build": "./src/build-cli.ts"})
    expect(manifest.peerDependencies).toEqual({
      "@zavx0z/dom": "^0.1.0",
      typescript: "^7.0.0",
    })
    expect(JSON.stringify(manifest)).not.toMatch(/react(?:-dom)?/i)
    expect(runtime).not.toMatch(/@engine|@zavx0z\/renderer/)
  })
})
