import {describe, expect, test} from "bun:test"
import {mkdtemp, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {buildBrowserProof} from "./browser-fixture/build.ts"

describe("browser-target signal component proof", () => {
  test("bundles the bounded TSX component into the production canvas runtime", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "zavx0z-components-browser-"))
    try {
      await buildBrowserProof(outputDirectory)
      const html = await Bun.file(join(outputDirectory, "index.html")).text()
      const javascript = await Bun.file(join(outputDirectory, "browser-entry.js")).text()
      const font = Bun.file(join(outputDirectory, "jetbrains-mono-bold.ttf"))
      expect(html).toContain("<canvas id=\"host-canvas\"")
      expect(html).toContain("engine-default-font")
      expect(html).not.toMatch(/<(?:h1|p|pre|strong)\b/)
      expect(javascript).toContain("standardEventUpdatedState")
      expect(javascript).toContain("proofStatus")
      expect(javascript).not.toContain("react-dom")
      expect(font.size).toBeGreaterThan(0)
    } finally {
      await rm(outputDirectory, {recursive: true, force: true})
    }
  })
})
