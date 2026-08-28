import {describe, expect, it} from "bun:test"
import {readFileSync} from "node:fs"
import {join} from "node:path"
import {reactCompatibility} from "../src/compatibility.ts"
import {jsxAuthoringProfile} from "@zavx0z/template/compiler"

const packageRoot = join(import.meta.dir, "..")

describe("package boundary", () => {
  it("has no React runtime or reconciler dependency", () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
    const dependencies = {
      ...manifest.dependencies,
      ...manifest.peerDependencies,
      ...manifest.devDependencies
    }
    expect(dependencies.react).toBeUndefined()
    expect(dependencies["react-dom"]).toBeUndefined()
    expect(dependencies["react-reconciler"]).toBeUndefined()

    const runtime = readFileSync(join(packageRoot, "src/runtime.ts"), "utf8")
    expect(runtime).not.toMatch(/from ["']react(?:-dom|-reconciler)?["']/)
    expect(runtime).not.toContain("Fiber")
  })

  it("publishes only the runtime and leaves compiler ownership to Template", () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"))
    expect(manifest.name).toBe("@zavx0z/react")
    expect(manifest.peerDependencies["@zavx0z/template"]).toBeDefined()
    expect(manifest.exports["./compiler-runtime"]).toBeUndefined()
    expect(manifest.exports["./compiler"]).toBeUndefined()
    expect(manifest.exports["./bun"]).toBeUndefined()
    expect(manifest.exports["./compatibility"]).toBe("./src/compatibility.ts")
    expect(manifest.exports["./compatibility.json"]).toBe("./compatibility.json")
    const jsonManifest = JSON.parse(readFileSync(join(packageRoot, "compatibility.json"), "utf8"))
    expect(jsonManifest).toEqual(reactCompatibility)
    expect(reactCompatibility.virtualDom).toBe(false)
    expect(reactCompatibility.features.nestedComponents).toBe("supported")
    expect(reactCompatibility.features.memo).toBe("supported")
    expect(reactCompatibility.features.keyedCollections).toBe("supported")
    expect(reactCompatibility.features.conditionalRanges).toBe("supported")
    expect(reactCompatibility.features.templateCompilerAbi).toBe("supported")
    expect(reactCompatibility.compilerOwner).toBe("@zavx0z/template")
    expect(reactCompatibility.features.tsxAuthoring).toBe("supported")
    expect(reactCompatibility.features.compilerExport).toBe("unsupported")
    expect(reactCompatibility.features.gpuInstancing).toBe("unsupported")
  })

  it("matches the Template compiler hook profile exactly", () => {
    const supported = Object.entries(reactCompatibility.hooks)
      .filter(([, status]) => status === "supported")
      .map(([name]) => name)
      .sort()
    expect(supported).toEqual([...jsxAuthoringProfile.supportedHooks].sort())
    expect(jsxAuthoringProfile.customHooks).toBe(true)
    expect(reactCompatibility.features.customHooks).toBe("supported")
  })

  it("typechecks source TSX with the exact Template JSX namespace", () => {
    const config = JSON.parse(readFileSync(join(packageRoot, "tsconfig.json"), "utf8"))
    expect(config.compilerOptions).toMatchObject({
      jsx: "preserve",
      jsxImportSource: "@zavx0z/template",
      moduleResolution: "bundler"
    })
    expect(config.include).toContain("test/**/*.tsx")
  })
})
