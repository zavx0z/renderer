import {describe, expect, test} from "bun:test"
import {
  createDocument,
  HTMLElement,
  HTMLVectorPathElement,
  Node,
  VECTOR_PATH_COORDINATE_LIMIT,
} from "@zavx0z/dom"
import {HTMLVectorPathElement as VectorPathSubpath} from "@zavx0z/dom/html/vector-path-element"

describe("HTMLVectorPathElement", () => {
  test("creates one exact project-extension semantic owner", () => {
    const path = createDocument().createElement("vector-path")

    expect(path).toBeInstanceOf(HTMLVectorPathElement)
    expect(path).toBeInstanceOf(HTMLElement)
    expect(path).toBeInstanceOf(Node)
    expect(path).toBeInstanceOf(VectorPathSubpath)
    expect(path.localName).toBe("vector-path")
    expect(path.d).toBe("")
    expect(VECTOR_PATH_COORDINATE_LIMIT).toBe(16_777_216)
  })

  test("reflects d through the ordinary attribute mutation channel", () => {
    const document = createDocument()
    const path = document.createElement("vector-path")
    document.appendChild(path)
    const mutations: unknown[] = []
    document.subscribeMutations((batch) => mutations.push(...batch.records))

    path.d = "M 0 0 L 10 10"

    expect(path.getAttribute("d")).toBe("M 0 0 L 10 10")
    expect(path.d).toBe("M 0 0 L 10 10")
    expect(mutations).toHaveLength(1)
  })
})
