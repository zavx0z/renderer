#!/usr/bin/env bun

import {resolve} from "node:path"
import domComponentsPlugin from "./bun.ts"

const {entrypoint, outdir} = parseArguments(Bun.argv.slice(2))

const result = await Bun.build({
  entrypoints: [resolve(entrypoint)],
  outdir: resolve(outdir),
  target: "browser",
  loader: {".wgsl": "text"},
  plugins: [domComponentsPlugin],
})

if (!result.success) throw new AggregateError(result.logs, "DOM components build failed")

function parseArguments(args: readonly string[]): {entrypoint: string; outdir: string} {
  let entrypoint: string | undefined
  let outdir = "dist"

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!
    if (argument === "--outdir") {
      const value = args[index + 1]
      if (!value) throw new TypeError("--outdir requires a path")
      outdir = value
      index += 1
      continue
    }
    if (argument.startsWith("--outdir=")) {
      const value = argument.slice("--outdir=".length)
      if (!value) throw new TypeError("--outdir requires a path")
      outdir = value
      continue
    }
    if (argument.startsWith("-")) throw new TypeError(`Unsupported build option: ${argument}`)
    if (entrypoint !== undefined) throw new TypeError("zavx0z-build accepts exactly one HTML entrypoint")
    entrypoint = argument
  }

  if (entrypoint === undefined) {
    throw new TypeError("Usage: zavx0z-build <index.html> [--outdir <directory>]")
  }
  return {entrypoint, outdir}
}
