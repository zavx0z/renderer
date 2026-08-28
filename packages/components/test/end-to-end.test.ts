import {describe, expect, test} from "bun:test"
import {Node} from "@zavx0z/dom"
import {mkdtemp, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {createDomComponentsBunPlugin} from "../src/bun.ts"

describe("signal component to retained WebGPU", () => {
  test("passes props and updates one exact semantic Text through the existing pipeline", async () => {
    const fixtureRoot = join(import.meta.dir, "fixture")
    const outputDirectory = await mkdtemp(join(tmpdir(), "zavx0z-components-"))
    try {
      const result = await Bun.build({
        entrypoints: [join(fixtureRoot, "entry.tsx")],
        outdir: outputDirectory,
        target: "bun",
        format: "esm",
        packages: "bundle",
        loader: {".wgsl": "text"},
        jsx: {
          runtime: "automatic",
          importSource: "@zavx0z/dom-components",
        },
        plugins: [createDomComponentsBunPlugin({sourceRoots: [fixtureRoot]})],
      })
      expect(result.success).toBe(true)
      const output = result.outputs.find(artifact => artifact.kind === "entry-point")
      if (!output) throw new Error("Expected a component entry output")
      const application = await import(
        `${pathToFileURL(output.path).href}?component-proof=${Date.now()}`
      ) as ProofModule
      const {proof} = application
      const dynamicText = proof.button.lastChild
      expect(dynamicText?.nodeType).toBe(Node.TEXT_NODE)
      expect(proof.button.textContent).toBe("Clicks: 2")
      expect(proof.button.getAttribute("data-component")).toBe("counter")

      const mutationBatches: number[] = []
      const unsubscribe = proof.semanticDocument.subscribeMutations(batch => {
        mutationBatches.push(batch.records.length)
      })
      const firstFrame = proof.flushPipeline()
      const retainedText = proof.backend.root.children.find(child =>
        "text" in child && child.text === "2"
      )
      if (!retainedText || !("text" in retainedText)) throw new Error("Expected retained count text")

      proof.button.click()
      expect(proof.button.lastChild).toBe(dynamicText)
      expect(proof.button.textContent).toBe("Clicks: 5")
      expect(mutationBatches).toHaveLength(1)
      const secondFrame = proof.flushPipeline()
      expect(secondFrame.revision).toBe(firstFrame.revision + 1)
      expect(proof.backend.root.children.find(child => child === retainedText)).toBe(retainedText)
      expect(retainedText.text).toBe("5")

      unsubscribe()
      proof.componentRoot.unmount()
      proof.renderer.dispose()
      proof.backend.dispose()
    } finally {
      await rm(outputDirectory, {recursive: true, force: true})
    }
  })
})

type ProofModule = Readonly<{
  proof: {
    backend: import("@zavx0z/renderer-webgpu").RendererWebGpuBackend
    button: import("@zavx0z/dom").HTMLButtonElement
    componentRoot: import("../src/index.ts").Root
    flushPipeline(): import("@zavx0z/renderer").RenderFrame
    renderer: import("@zavx0z/renderer").DocumentRenderer
    semanticDocument: import("@zavx0z/dom").Document
  }
}>
