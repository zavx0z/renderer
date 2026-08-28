import {resolve} from "node:path"

const exampleRoot = resolve(import.meta.dir, "..")
const localPackages = [
  resolve(import.meta.dir, "../../../packages/dom"),
  resolve(import.meta.dir, "../../../packages/components"),
  resolve(import.meta.dir, "../../../packages/core"),
  resolve(import.meta.dir, "../../../packages/webgpu"),
  resolve(import.meta.dir, "../../../packages/browser"),
  resolve(import.meta.dir, "../../../../engine/packages/core"),
]

for (const cwd of localPackages) await run([process.execPath, "link"], cwd)
await run([process.execPath, "install"], exampleRoot)

async function run(command: string[], cwd: string): Promise<void> {
  const child = Bun.spawn(command, {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  const exitCode = await child.exited
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed in ${cwd}`)
}
