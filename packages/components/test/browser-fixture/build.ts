import {join, resolve} from "node:path"
import {createDomComponentsBunPlugin} from "../../src/bun.ts"

export async function buildBrowserProof(outputDirectory: string): Promise<void> {
  const fixtureRoot = join(import.meta.dir, "..")
  const applicationRoot = join(import.meta.dir, "application")
  const result = await Bun.build({
    entrypoints: [join(applicationRoot, "browser-entry.tsx")],
    outdir: resolve(outputDirectory),
    target: "browser",
    format: "esm",
    packages: "bundle",
    loader: {".wgsl": "text"},
    jsx: {
      runtime: "automatic",
      importSource: "@zavx0z/dom-components",
    },
    plugins: [createDomComponentsBunPlugin({
      sourceRoots: [applicationRoot, fixtureRoot],
    })],
  })
  if (!result.success) throw new AggregateError(result.logs, "Component browser proof build failed")
  await Bun.write(
    join(resolve(outputDirectory), "index.html"),
    await Bun.file(join(import.meta.dir, "index.html")).text(),
  )
  await Bun.write(
    join(resolve(outputDirectory), "jetbrains-mono-bold.ttf"),
    Bun.file(resolve(
      import.meta.dir,
      "../../../../../engine/packages/core/static/fonts/jetbrains-mono-bold.ttf",
    )),
  )
}

if (import.meta.main) {
  const outputDirectory = process.argv[2]
  if (!outputDirectory) throw new TypeError("Browser proof output directory is required")
  await buildBrowserProof(outputDirectory)
}
