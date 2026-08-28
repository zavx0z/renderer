import {expect, test} from "bun:test"
import {rm} from "node:fs/promises"
import {join} from "node:path"

test("builds ordinary linked TSX into one canvas application", async () => {
  await rm(join(import.meta.dir, "../dist"), {recursive: true, force: true})
  const build = Bun.spawn([process.execPath, "run", "build"], {
    cwd: join(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
  })
  expect(await build.exited).toBe(0)
  const outputRoot = join(import.meta.dir, "../dist")
  const artifacts = await Array.fromAsync(new Bun.Glob("**/*").scan({cwd: outputRoot}))
  expect(await Bun.file(join(outputRoot, "index.html")).text()).toContain("host-canvas")
  expect(artifacts.some(path => path.endsWith(".js"))).toBe(true)
  const font = artifacts.find(path => path.endsWith(".ttf"))
  expect(font).toBeDefined()
  expect(Bun.file(join(outputRoot, font!)).size).toBeGreaterThan(0)
})
