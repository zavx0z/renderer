// @zavx0z/web-realm no-transform
import {join, resolve} from "node:path"
import {createWebRealmBunPlugin} from "../../src/bun.ts"

export async function buildBrowserProof(outputDirectory: string): Promise<void> {
  const applicationRoot = join(import.meta.dir, "application")
  const result = await Bun.build({
    entrypoints: [join(applicationRoot, "browser-entry.ts")],
    outdir: resolve(outputDirectory),
    target: "browser",
    format: "esm",
    packages: "bundle",
    plugins: [createWebRealmBunPlugin({
      bindingModule: join(applicationRoot, "realm-binding.ts"),
      sourceRoots: [applicationRoot],
    })],
  })
  if (!result.success) {
    throw new AggregateError(result.logs, "Browser proof build failed")
  }
  await Bun.write(
    join(resolve(outputDirectory), "index.html"),
    await Bun.file(join(import.meta.dir, "index.html")).text(),
  )
}

if (import.meta.main) {
  const outputDirectory = process.argv[2]
  if (!outputDirectory) throw new TypeError("Browser proof output directory is required")
  await buildBrowserProof(outputDirectory)
}
