import {describe, expect, test} from "bun:test"
import type {CachedText} from "@engine/core"
import type {RendererWebGpuBackend} from "@zavx0z/renderer-webgpu"
import {mkdtemp, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {createWebRealmBunPlugin} from "../src/bun.ts"

describe("ordinary source to retained WebGPU", () => {
  test("uses document, standard events and exact semantic owners end to end", async () => {
    const fixtureRoot = join(import.meta.dir, "fixture")
    const outputDirectory = await mkdtemp(join(tmpdir(), "zavx0z-web-realm-"))
    try {
      const result = await Bun.build({
        entrypoints: [join(fixtureRoot, "entry.ts")],
        outdir: outputDirectory,
        target: "bun",
        format: "esm",
        packages: "bundle",
        loader: {".wgsl": "text"},
        plugins: [createWebRealmBunPlugin({
          bindingModule: join(fixtureRoot, "realm-binding.ts"),
          sourceRoots: [fixtureRoot],
        })],
      })
      expect(result.success).toBe(true)
      const output = result.outputs.find(artifact => artifact.kind === "entry-point")
      if (!output) throw new Error("Expected a Bun entry output")
      const application = await import(
        `${pathToFileURL(output.path).href}?realm-proof=${Date.now()}`
      ) as ProofModule
      const proof = application.proof

      expect(proof.realmDocument).toBe(proof.semanticDocument)
      expect(proof.standardElementSeen).toBe(true)
      expect(proof.button).toBeInstanceOf(proof.webRealm.window.HTMLElement)
      expect(proof.semanticRoot.firstChild).toBe(proof.card)

      const firstFrame = proof.flushPipeline()
      const retainedText = requireText(proof.backend)
      expect(firstFrame.displayList.some(item =>
        item.kind === "text" && item.node === proof.label && item.text === "Ready"
      )).toBe(true)
      expect(retainedText.text).toBe("Ready")

      proof.button.click()
      expect(proof.activationCount).toBe(1)
      expect(proof.standardEventSeen).toBe(true)
      expect(proof.label.data).toBe("Clicked 1")
      const secondFrame = proof.flushPipeline()
      expect(secondFrame.revision).toBe(firstFrame.revision + 1)
      expect(requireText(proof.backend)).toBe(retainedText)
      expect(retainedText.text).toBe("Clicked 1")

      proof.webRealm.dispose()
      proof.renderer.dispose()
      proof.backend.dispose()
    } finally {
      await rm(outputDirectory, {recursive: true, force: true})
    }
  })
})

type ProofModule = typeof import("./fixture/entry.ts")

const requireText = (backend: RendererWebGpuBackend): CachedText => {
  const text = backend.root.children.find(child => child.name === "#text:text")
  if (!text || !("text" in text)) throw new Error("Expected retained text")
  return text as CachedText
}
