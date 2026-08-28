import {describe, expect, test} from "bun:test"
import {join} from "node:path"
import {
  ComponentCompileError,
  transformComponentFile,
} from "../src/compiler.ts"

describe("TypeScript 7 component lowering", () => {
  test("turns a useState JSX read into a direct signal binding", async () => {
    const path = join(import.meta.dir, "fixture/counter.tsx")
    const transformed = await transformComponentFile(path)

    expect(transformed.stateBindings).toEqual(["count"])
    expect(transformed.code).toContain("@zavx0z/dom-components/internal")
    expect(transformed.code).toContain("__zavx0zDynamic(() => (__zavx0zReadState(count)))")
    expect(transformed.code).toContain("setCount(value => value + props.step)")
  })

  test("fails closed when state escapes the implemented JSX binding subset", async () => {
    const path = join(import.meta.dir, "fixture/unsupported-derived.tsx")
    const error = await transformComponentFile(path).catch(cause => cause)
    expect(error).toBeInstanceOf(ComponentCompileError)
    expect((error as Error).message).toContain("outside a supported JSX")
  })
})
