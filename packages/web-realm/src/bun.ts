import {isAbsolute, relative, resolve, sep} from "node:path"
import {WEB_REALM_BINDING_NAMES} from "./binding-names.ts"

const BOUND_MARKER = "/* @zavx0z/web-realm bound */"
const NO_TRANSFORM_MARKER = "@zavx0z/web-realm no-transform"
const REACT_DOM_ALIAS_NAMESPACE = "zavx0z-web-realm-react-dom-client"
const REACT_DOM_CLIENT_ADAPTER = "@zavx0z/web-realm/react-dom-client"
const DIRECTIVE_PROLOGUE = /^(?:(?:[ \t\r\n]|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')[ \t]*;?)*/
type WebRealmSourceLoader = "js" | "jsx" | "ts" | "tsx"

export type TransformWebRealmSourceOptions = Readonly<{
  bindingModule: string
  bindingExport?: string
  sourcePath?: string
}>

export type TransformWebRealmSourceResult = Readonly<{
  code: string
  bindings: readonly string[]
}>

export type CreateWebRealmBunPluginOptions = Readonly<{
  bindingModule: string
  bindingExport?: string
  sourceRoots: readonly string[]
  transformPackages?: readonly string[]
  exclude?: readonly RegExp[]
  reactDomClientAdapter?: boolean
}>

/**
 * Adds lexical standard-name bindings to one module without mutating globals.
 *
 * The transform is deliberately conservative: a module that declares one of
 * the injected names at module scope fails in Bun's parser and must be excluded
 * or adapted explicitly instead of silently changing ownership.
 */
export function transformWebRealmSource(
  source: string,
  options: TransformWebRealmSourceOptions,
): TransformWebRealmSourceResult {
  validateBindingModule(options.bindingModule)
  const bindingExport = options.bindingExport ?? "webRealm"
  if (bindingExport !== "default" && !/^[$A-Z_a-z][$\w]*$/.test(bindingExport)) {
    throw new TypeError("bindingExport must be default or a JavaScript identifier")
  }
  if (source.includes(BOUND_MARKER) || source.includes(NO_TRANSFORM_MARKER)) {
    return Object.freeze({code: source, bindings: Object.freeze([])})
  }

  const bindings = Object.freeze(WEB_REALM_BINDING_NAMES.filter(name =>
    new RegExp(`\\b${name}\\b`).test(source)
  ))
  if (bindings.length === 0) return Object.freeze({code: source, bindings})

  const local = uniqueLocalName(source)
  const importStatement = bindingExport === "default"
    ? `import ${local} from ${JSON.stringify(options.bindingModule)};`
    : `import {${bindingExport} as ${local}} from ${JSON.stringify(options.bindingModule)};`
  const bindingStatement = `const {${bindings.join(",")}} = ${local}.bindings;`
  const prefix = `${BOUND_MARKER}\n${importStatement}\n${bindingStatement}\n`
  const offset = bindingInsertionOffset(source)
  const code = `${source.slice(0, offset)}${prefix}${source.slice(offset)}`
  return Object.freeze({code, bindings})
}

/** Bun.build plugin for app roots plus an explicit third-party package allowlist. */
export function createWebRealmBunPlugin(
  options: CreateWebRealmBunPluginOptions,
): Bun.BunPlugin {
  validateBindingModule(options.bindingModule)
  if (!Array.isArray(options.sourceRoots) || options.sourceRoots.length === 0) {
    throw new TypeError("sourceRoots must contain at least one application source root")
  }
  const sourceRoots = options.sourceRoots.map(root => resolve(root))
  const packages = Object.freeze([...(options.transformPackages ?? [])])
  const excludes = Object.freeze([...(options.exclude ?? [])])
  for (const packageName of packages) validatePackageName(packageName)

  return {
    name: "@zavx0z/web-realm-bindings",
    setup(build) {
      build.onResolve({filter: /^react-dom(?:\/.*)?$/}, args => {
        if (args.path === "react-dom/client" && options.reactDomClientAdapter === true) {
          return {path: args.path, namespace: REACT_DOM_ALIAS_NAMESPACE}
        }
        throw new Error(
          `${args.path} is not a global call and cannot target @zavx0z/dom; ` +
          "use the explicit @zavx0z/dom-react adapter policy",
        )
      })
      build.onLoad(
        {filter: /^react-dom\/client$/, namespace: REACT_DOM_ALIAS_NAMESPACE},
        () => ({
          contents:
            'import {createRoot as createSemanticRoot} from ' +
            '"@zavx0z/web-realm/react-dom-client";\n' +
            "export const createRoot = createSemanticRoot;",
          loader: "js",
        }),
      )
      build.onLoad({filter: /\.(?:[cm]?[jt]s|[jt]sx)$/}, async args => {
        if (!shouldTransform(args.path, sourceRoots, packages, excludes)) return
        const source = await Bun.file(args.path).text()
        const governedSource = source.includes(NO_TRANSFORM_MARKER)
          ? source
          : applyDependencyPolicy(
              source,
              args.loader,
              options.reactDomClientAdapter === true,
            )
        const transformed = transformWebRealmSource(governedSource, {
          bindingModule: options.bindingModule,
          ...(options.bindingExport === undefined ? {} : {bindingExport: options.bindingExport}),
          sourcePath: args.path,
        })
        return {contents: transformed.code, loader: args.loader}
      })
    },
  }
}

const applyDependencyPolicy = (
  source: string,
  loader: Bun.Loader,
  reactDomClientAdapter: boolean,
): string => {
  if (!isSourceLoader(loader)) {
    throw new TypeError(`Unsupported web-realm source loader ${loader}`)
  }
  if (/\b(?:eval|Function)\b/.test(source)) {
    throw new Error(
      "Direct eval and Function constructors are outside the web-realm binding boundary",
    )
  }
  if (/\bexport\s+(?:type\s+)?(?:\*\s*(?:as\s+[$\w]+\s*)?|\{[^}]*\}\s*)from\s*["']/.test(source)) {
    throw new Error(
      "Direct re-exports are unsupported in governed Bun 1.4 modules; import then export locally",
    )
  }
  const imports = new Bun.Transpiler({loader}).scanImports(source)
  let governedSource = source
  for (const imported of imports) {
    if (imported.path !== "react-dom" && !imported.path.startsWith("react-dom/")) continue
    if (imported.path !== "react-dom/client" || !reactDomClientAdapter) {
      throw new Error(
        `${imported.path} is not a global call and cannot target @zavx0z/dom; ` +
        "use the explicit @zavx0z/dom-react adapter policy",
      )
    }
    governedSource = rewriteModuleSpecifier(
      governedSource,
      imported.path,
      REACT_DOM_CLIENT_ADAPTER,
    )
  }
  return governedSource
}

const isSourceLoader = (loader: Bun.Loader): loader is WebRealmSourceLoader =>
  loader === "js" || loader === "jsx" || loader === "ts" || loader === "tsx"

const rewriteModuleSpecifier = (source: string, from: string, to: string): string => {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(
    `((?:\\bfrom|\\bimport|\\brequire)\\s*(?:\\(\\s*)?)(["'])${escaped}\\2`,
    "g",
  )
  let replacements = 0
  const rewritten = source.replace(pattern, (_match, prefix: string, quote: string) => {
    replacements += 1
    return `${prefix}${quote}${to}${quote}`
  })
  if (replacements === 0) {
    throw new Error(`Unable to apply the explicit adapter for ${from}`)
  }
  return rewritten
}

const shouldTransform = (
  path: string,
  roots: readonly string[],
  packages: readonly string[],
  excludes: readonly RegExp[],
): boolean => {
  if (excludes.some(pattern => matches(pattern, path))) return false
  const absolute = resolve(path)
  if (roots.some(root => inside(root, absolute))) return true
  const normalized = absolute.replaceAll(sep, "/")
  return packages.some(packageName =>
    normalized.includes(`/node_modules/${packageName}/`)
  )
}

const inside = (root: string, path: string): boolean => {
  const child = relative(root, path)
  return child === "" || (!child.startsWith("..") && !isAbsolute(child))
}

const matches = (pattern: RegExp, value: string): boolean => {
  pattern.lastIndex = 0
  return pattern.test(value)
}

const validateBindingModule = (specifier: string): void => {
  if (typeof specifier !== "string" || specifier.length === 0) {
    throw new TypeError("bindingModule is required")
  }
  if (specifier.startsWith(".")) {
    throw new TypeError("bindingModule must be absolute or a package/import-map specifier")
  }
}

const validatePackageName = (packageName: string): void => {
  if (!/^(?:@[^/]+\/)?[^/]+$/.test(packageName)) {
    throw new TypeError(`Invalid transform package name ${packageName}`)
  }
}

const uniqueLocalName = (source: string): string => {
  let index = 0
  while (source.includes(index === 0 ? "__zavx0zWebRealm" : `__zavx0zWebRealm${index}`)) {
    index += 1
  }
  return index === 0 ? "__zavx0zWebRealm" : `__zavx0zWebRealm${index}`
}

const bindingInsertionOffset = (source: string): number => {
  const newline = source.startsWith("#!") ? source.indexOf("\n") : -1
  const bodyOffset = newline < 0 ? 0 : newline + 1
  const prologue = DIRECTIVE_PROLOGUE.exec(source.slice(bodyOffset))?.[0] ?? ""
  return bodyOffset + prologue.length
}
