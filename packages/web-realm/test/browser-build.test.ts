import {describe, expect, test} from "bun:test"
import {mkdtemp, rm} from "node:fs/promises"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {buildBrowserProof} from "./browser-fixture/build.ts"

describe("browser-target web realm proof", () => {
  test("bundles governed source without a native global patch", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "zavx0z-browser-build-"))
    try {
      await buildBrowserProof(outputDirectory)
      const html = await Bun.file(join(outputDirectory, "index.html")).text()
      const javascript = await Bun.file(join(outputDirectory, "browser-entry.js")).text()
      expect(html).toContain("Web realm browser proof")
      expect(javascript).toContain("storageFailedClosed")
      expect(javascript).not.toMatch(/\b(?:globalThis|window)\.document\s*=(?!=)/)
    } finally {
      await rm(outputDirectory, {recursive: true, force: true})
    }
  })
})
