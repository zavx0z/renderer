import {isAbsolute, join, relative, resolve} from "node:path"
import {transformComponentFile} from "./compiler.ts"
export {ComponentCompileError, transformComponentFile} from "./compiler.ts"
export type {
  TransformComponentFileOptions,
  TransformComponentSourceResult,
} from "./compiler.ts"

export type CreateDomComponentsBunPluginOptions = Readonly<{
  sourceRoots: readonly string[]
  exclude?: readonly RegExp[]
}>

/** Compiles the bounded signal-backed JSX subset in explicit application roots. */
export function createDomComponentsBunPlugin(
  options: CreateDomComponentsBunPluginOptions,
): Bun.BunPlugin {
  if (!Array.isArray(options.sourceRoots) || options.sourceRoots.length === 0) {
    throw new TypeError("sourceRoots must contain at least one application source root")
  }
  const roots = options.sourceRoots.map(root => resolve(root))
  const excludes = Object.freeze([...(options.exclude ?? [])])
  return {
    name: "@zavx0z/dom-components",
    setup(build) {
      build.onLoad({filter: /\.(?:jsx|tsx)$/}, async args => {
        if (!insideAny(args.path, roots) || excludes.some(pattern => matches(pattern, args.path))) {
          return
        }
        const source = await Bun.file(args.path).text()
        if (!/\buseState\b/.test(source)) return {contents: source, loader: args.loader}
        const transformed = await transformComponentFile(args.path, {source})
        return {contents: transformed.code, loader: args.loader}
      })
    },
  }
}

const insideAny = (path: string, roots: readonly string[]): boolean => {
  const absolute = resolve(path)
  return roots.some(root => {
    const child = relative(root, absolute)
    return child === "" || (!child.startsWith("..") && !isAbsolute(child))
  })
}

const matches = (pattern: RegExp, value: string): boolean => {
  pattern.lastIndex = 0
  return pattern.test(value)
}

/** Default Bun plugin for conventional applications rooted at `./src`. */
const defaultPlugin = createDomComponentsBunPlugin({
  sourceRoots: [join(process.cwd(), "src")],
})

export default defaultPlugin
