import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import {
  GENERATOR_VERSION,
  rendererRoot,
  sha256,
  stableStringify,
  writeJsonIfChanged,
  writeTextIfChanged,
} from "./model.ts"

interface PackageSource {
  id: string
  title: string
  version: string
  canonicalUrl: string
  tarballUrl: string
  integrity: string
  files: Array<{ member: string; output: string }>
}

interface PageSource {
  id: string
  title: string
  type: "standard" | "reference" | "documentation"
  version: string
  canonicalUrl: string
  fetchUrl?: string
  output?: string
}

interface LockedArtifact {
  path?: string
  url: string
  digest: {
    algorithm: "sha256"
    value: string
  }
  bytes: number
}

interface LockedSource {
  id: string
  title: string
  type: string
  version: string
  canonicalUrl: string
  digest: {
    algorithm: "sha256"
    value: string
  }
  integrity?: string
  retrieval: {
    method: string
    artifacts: LockedArtifact[]
  }
  updatedAt: string
  generatorVersion: string
}

const sourcesRoot = resolve(rendererRoot, "specifications/sources")

const packageSources: PackageSource[] = [
  {
    id: "webref-css",
    title: "W3C WebRef curated CSS inventory",
    version: "8.7.3",
    canonicalUrl: "https://github.com/w3c/webref/tree/curated/ed/css",
    tarballUrl: "https://registry.npmjs.org/@webref/css/-/css-8.7.3.tgz",
    integrity: "sha512-iQZOkW9TqVz7p3qnEyv0KsutpXmPh8Ey9oJKHLeo//kn4mrrdG+XLBhmx4IoSWSazlVyK5NTp/FqsvV3U1yc9w==",
    files: [{ member: "package/css.json", output: "webref/css.json" }],
  },
  {
    id: "webref-idl",
    title: "W3C WebRef curated Web IDL inventory",
    version: "3.83.0",
    canonicalUrl: "https://github.com/w3c/webref/tree/curated/ed/idl",
    tarballUrl: "https://registry.npmjs.org/@webref/idl/-/idl-3.83.0.tgz",
    integrity: "sha512-Pb/NhQs3BgbLf1rNhOGMc5xoSqPaaR4Jw8RceBw3gIE8aDQkjTHwD9+KuAH1imFxU0mMubdXOcj1GEkJMwRLGQ==",
    files: [
      "dom.idl",
      "uievents.idl",
      "pointerevents.idl",
      "input-events.idl",
      "selection-api.idl",
      "clipboard-apis.idl",
      "cssom-view.idl",
      "cssom.idl",
      "css-anchor-position.idl",
      "css-animation-worklet.idl",
      "css-animations-2.idl",
      "css-animations.idl",
      "css-cascade-6.idl",
      "css-cascade.idl",
      "css-color-5.idl",
      "css-conditional-5.idl",
      "css-conditional.idl",
      "css-contain.idl",
      "css-counter-styles.idl",
      "css-font-loading.idl",
      "css-fonts-5.idl",
      "css-fonts.idl",
      "css-highlight-api.idl",
      "css-images-4.idl",
      "css-layout-api.idl",
      "css-masking.idl",
      "css-mixins.idl",
      "css-nav.idl",
      "css-nesting.idl",
      "css-paint-api.idl",
      "css-parser-api.idl",
      "css-properties-values-api.idl",
      "css-pseudo.idl",
      "css-regions.idl",
      "css-scroll-snap-2.idl",
      "css-shadow.idl",
      "css-sizing-4.idl",
      "css-transitions-2.idl",
      "css-transitions.idl",
      "css-typed-om.idl",
      "css-view-transitions.idl",
      "css-viewport.idl",
      "html.idl",
    ].map((name) => ({ member: `package/${name}`, output: `webref/idl/${name}` })),
  },
  {
    id: "webref-elements",
    title: "W3C WebRef curated HTML element inventory",
    version: "2.8.0",
    canonicalUrl: "https://github.com/w3c/webref/tree/curated/ed/elements",
    tarballUrl: "https://registry.npmjs.org/@webref/elements/-/elements-2.8.0.tgz",
    integrity: "sha512-EWxcb3d2mkRU0zCfIX8no6xoywnUX3+Pxqhtt4xKwcb+vG4tQUlMZMd3THLH8M1Peg/5ssVRvlMEl/N5sHiFXw==",
    files: [{ member: "package/html.json", output: "webref/elements/html.json" }],
  },
  {
    id: "webref-events",
    title: "W3C WebRef curated event inventory",
    version: "1.25.0",
    canonicalUrl: "https://github.com/w3c/webref/tree/curated/ed/events",
    tarballUrl: "https://registry.npmjs.org/@webref/events/-/events-1.25.0.tgz",
    integrity: "sha512-oosECyL5oKs7pTRaNJpvSdiMaLrWHlBiyWVbUS2WIsDEgL3Ula4rktAjhgZ916NVq6fgXaRSzQ5QDjeNdbhtDQ==",
    files: [{ member: "package/events.json", output: "webref/events/events.json" }],
  },
  {
    id: "webidl2",
    title: "WebIDL2 parser used by the audit generator",
    version: "24.5.0",
    canonicalUrl: "https://github.com/w3c/webidl2.js",
    tarballUrl: "https://registry.npmjs.org/webidl2/-/webidl2-24.5.0.tgz",
    integrity: "sha512-fxOigKkIem1iAgQ9t4cFOP+kWEA8y6Be/uh50FpJh0FijoeeT/VMrOyJzNLUgjy0rGMEcHeReKDCqj0g9dIe9A==",
    files: [{ member: "package/dist/webidl2.js", output: "tooling/webidl2.mjs" }],
  },
  {
    id: "ajv-dist",
    title: "Ajv JSON Schema 2020 validator bundle used by audit tooling",
    version: "8.17.1",
    canonicalUrl: "https://github.com/ajv-validator/ajv",
    tarballUrl: "https://registry.npmjs.org/ajv-dist/-/ajv-dist-8.17.1.tgz",
    integrity: "sha512-KzJwANMzTTR/RERGnkx+bHzmxIfMTPMMv7+cH1d6Lx9UQ7BZyhiieq4hnO5lRuBWOtYTUL8hyWs7RJYI/45Rtg==",
    files: [{ member: "package/dist/ajv2020.bundle.js", output: "tooling/ajv2020.cjs" }],
  },
  {
    id: "typescript-7.0.2",
    title: "TypeScript compiler package used by the workspace",
    version: "7.0.2 tag 1e4744d68260a7cb91b62b12edc3f6a2187faaf1",
    canonicalUrl: "https://github.com/microsoft/TypeScript/tree/v7.0.2",
    tarballUrl: "https://registry.npmjs.org/typescript/-/typescript-7.0.2.tgz",
    integrity: "sha512-8FYau96o3NKOhbjKi/qNvG/W5jhzxkbdm5sj9AbZ/5T5sWqn3hJgLfGx27sRKZWTvyzCP8dLRBTf5tBTSRVUNA==",
    files: [{ member: "package/package.json", output: "reference/typescript-7.0.2-package.json" }],
  },
]

const reactPackages = [
  {
    id: "react-19.2",
    title: "React 19.2 package public export surface",
    version: "19.2.0 tag ae74234eae6ebd62f19190731278e20bc1c37d51",
    canonicalUrl: "https://github.com/facebook/react/releases/tag/v19.2.0",
    tarballUrl: "https://registry.npmjs.org/react/-/react-19.2.0.tgz",
    integrity: "sha512-tmbWg6W31tQLeB5cdIBOicJDJRR2KzXsV7uSK9iNfLWQ5bIZfxuPEHp7M8wiHyHnn0DD1i7w3Zmin0FtkrwoCQ==",
    entrypoints: {
      react: "package/cjs/react.development.js",
      "react/jsx-runtime": "package/cjs/react-jsx-runtime.development.js",
      "react/jsx-dev-runtime": "package/cjs/react-jsx-dev-runtime.development.js",
      "react/compiler-runtime": "package/cjs/react-compiler-runtime.development.js",
    },
  },
  {
    id: "react-dom-19.2",
    title: "React DOM 19.2 package public export surface",
    version: "19.2.0 tag ae74234eae6ebd62f19190731278e20bc1c37d51",
    canonicalUrl: "https://github.com/facebook/react/releases/tag/v19.2.0",
    tarballUrl: "https://registry.npmjs.org/react-dom/-/react-dom-19.2.0.tgz",
    integrity: "sha512-UlbRu4cAiGaIewkPyiRGJk0imDN2T3JjieT6spoL2UeSf5od4n5LB/mQ4ejmxhCFT1tYe8IvaFulzynWovsEFQ==",
    entrypoints: {
      "react-dom": "package/cjs/react-dom.development.js",
      "react-dom/client": "package/cjs/react-dom-client.development.js",
      "react-dom/server": "package/server.node.js",
      "react-dom/static": "package/static.node.js",
      "react-dom/test-utils": "package/cjs/react-dom-test-utils.development.js",
    },
  },
] as const

const pageSources: PageSource[] = [
  {
    id: "whatwg-dom",
    title: "WHATWG DOM Standard source",
    type: "standard",
    version: "commit a2331a45360129e8645ef7e0a04740241b6e3726",
    canonicalUrl: "https://dom.spec.whatwg.org/",
    fetchUrl: "https://raw.githubusercontent.com/whatwg/dom/a2331a45360129e8645ef7e0a04740241b6e3726/dom.bs",
    output: "normative/whatwg-dom.bs",
  },
  {
    id: "whatwg-html",
    title: "WHATWG HTML Living Standard source",
    type: "standard",
    version: "commit 4aa7694b585e4d551a11cfe6dece823105fdf0a8",
    canonicalUrl: "https://html.spec.whatwg.org/multipage/",
    fetchUrl: "https://raw.githubusercontent.com/whatwg/html/4aa7694b585e4d551a11cfe6dece823105fdf0a8/source",
  },
  {
    id: "whatwg-html-index",
    title: "WHATWG HTML element and attribute index",
    type: "standard",
    version: "Living Standard 2026-08-28",
    canonicalUrl: "https://html.spec.whatwg.org/dev/indices.html",
    output: "normative/html-indices.html",
  },
  {
    id: "ui-events",
    title: "W3C UI Events",
    type: "standard",
    version: "snapshot 2026-08-29",
    canonicalUrl: "https://w3c.github.io/uievents/",
    output: "normative/ui-events.html",
  },
  {
    id: "pointer-events",
    title: "W3C Pointer Events",
    type: "standard",
    version: "snapshot 2026-08-29",
    canonicalUrl: "https://w3c.github.io/pointerevents/",
    output: "normative/pointer-events.html",
  },
  {
    id: "input-events",
    title: "W3C Input Events",
    type: "standard",
    version: "snapshot 2026-08-29",
    canonicalUrl: "https://w3c.github.io/input-events/",
    output: "normative/input-events.html",
  },
  {
    id: "selection-api",
    title: "W3C Selection API",
    type: "standard",
    version: "snapshot 2026-08-29",
    canonicalUrl: "https://w3c.github.io/selection-api/",
    output: "normative/selection-api.html",
  },
  {
    id: "clipboard-apis",
    title: "W3C Clipboard API and events",
    type: "standard",
    version: "snapshot 2026-08-29",
    canonicalUrl: "https://w3c.github.io/clipboard-apis/",
    output: "normative/clipboard-apis.html",
  },
  {
    id: "cssom-view",
    title: "CSSOM View Module",
    type: "standard",
    version: "snapshot 2026-08-29",
    canonicalUrl: "https://drafts.csswg.org/cssom-view/",
    output: "normative/cssom-view.html",
  },
  {
    id: "css-snapshot-2025",
    title: "CSS Snapshot 2025",
    type: "standard",
    version: "W3C Group Note 2025-09-18",
    canonicalUrl: "https://www.w3.org/TR/2025/NOTE-css-2025-20250918/",
    output: "normative/css-snapshot-2025.html",
  },
  {
    id: "aria-in-html",
    title: "ARIA in HTML",
    type: "standard",
    version: "snapshot 2026-08-29",
    canonicalUrl: "https://w3c.github.io/html-aria/",
    output: "normative/aria-in-html.html",
  },
  {
    id: "html-aam",
    title: "HTML Accessibility API Mappings",
    type: "standard",
    version: "snapshot 2026-08-29",
    canonicalUrl: "https://w3c.github.io/html-aam/",
    output: "normative/html-aam.html",
  },
  {
    id: "webgpu-standard",
    title: "WebGPU Standard",
    type: "standard",
    version: "snapshot 2026-08-29",
    canonicalUrl: "https://gpuweb.github.io/gpuweb/",
    output: "normative/webgpu.html",
  },
  {
    id: "typescript-jsx",
    title: "TypeScript JSX syntax and typing model",
    type: "documentation",
    version: "TypeScript 7.0.2, docs snapshot 2026-08-29",
    canonicalUrl: "https://www.typescriptlang.org/docs/handbook/jsx.html",
    output: "reference/typescript-jsx.html",
  },
]

const reactDocs = [
  "https://react.dev/versions",
  "https://react.dev/reference/react",
  "https://react.dev/reference/react/hooks",
  "https://react.dev/reference/react/components",
  "https://react.dev/reference/react/apis",
  "https://react.dev/reference/react/legacy",
  "https://react.dev/reference/rules",
  "https://react.dev/reference/react-dom",
  "https://react.dev/reference/react-dom/client",
  "https://react.dev/reference/react-dom/server",
  "https://react.dev/reference/react-dom/static",
]

async function main(): Promise<void> {
  const updatedAt = new Date().toISOString()
  const temporaryRoot = await mkdtemp(join(tmpdir(), "renderer-capability-sources-"))
  const locked: LockedSource[] = []
  const previousLockPath = resolve(rendererRoot, "specifications/sources.lock.json")
  const previousLock = await Bun.file(previousLockPath).exists()
    ? JSON.parse(await Bun.file(previousLockPath).text()) as { sources?: LockedSource[] }
    : undefined
  const previousSources = new Map((previousLock?.sources ?? []).map((source) => [source.id, source]))

  try {
    for (const source of packageSources) {
      const bytes = await download(source.tarballUrl)
      verifyIntegrity(bytes, source.integrity, source.id)
      const tarballPath = join(temporaryRoot, `${source.id}.tgz`)
      await Bun.write(tarballPath, bytes)
      const artifacts: LockedArtifact[] = []

      for (const file of source.files) {
        const extracted = await extractMember(tarballPath, file.member)
        const outputPath = resolve(sourcesRoot, file.output)
        await writeBytesIfChanged(outputPath, extracted)
        artifacts.push(artifact(source.tarballUrl, extracted, file.output))
      }

      locked.push(lockPackage(source, bytes, artifacts, updatedAt))
    }

    for (const source of reactPackages) {
      const bytes = await download(source.tarballUrl)
      verifyIntegrity(bytes, source.integrity, source.id)
      const tarballPath = join(temporaryRoot, `${source.id}.tgz`)
      await Bun.write(tarballPath, bytes)
      const entrypoints: Record<string, string[]> = {}

      for (const [name, member] of Object.entries(source.entrypoints)) {
        const code = new TextDecoder().decode(await extractMember(tarballPath, member))
        entrypoints[name] = extractExports(code)
      }

      const exportSnapshot = {
        package: source.id.startsWith("react-dom") ? "react-dom" : "react",
        version: "19.2.0",
        entrypoints,
      }
      const output = `reference/${source.id}-exports.json`
      await writeJsonIfChanged(resolve(sourcesRoot, output), exportSnapshot)
      const snapshotBytes = new TextEncoder().encode(stableStringify(exportSnapshot))

      locked.push({
        id: source.id,
        title: source.title,
        type: "reference-package",
        version: source.version,
        canonicalUrl: source.canonicalUrl,
        digest: { algorithm: "sha256", value: sha256(bytes) },
        integrity: source.integrity,
        retrieval: {
          method: "HTTPS GET npm tarball; extract public exports from development entrypoints",
          artifacts: [artifact(source.tarballUrl, snapshotBytes, output)],
        },
        updatedAt,
        generatorVersion: GENERATOR_VERSION,
      })
    }

    for (const source of pageSources) {
      const url = source.fetchUrl ?? source.canonicalUrl
      let bytes: Uint8Array
      let method = "HTTPS GET"
      try {
        bytes = await download(url)
      } catch (error) {
        if (source.output && await Bun.file(resolve(sourcesRoot, source.output)).exists()) {
          bytes = new Uint8Array(await Bun.file(resolve(sourcesRoot, source.output)).arrayBuffer())
          method = `HTTPS GET failed; reused prior pinned artifact (${error instanceof Error ? error.message : String(error)})`
        } else {
          const previous = previousSources.get(source.id)
          if (!previous) throw error
          locked.push(previous)
          continue
        }
      }
      if (source.output) await writeBytesIfChanged(resolve(sourcesRoot, source.output), bytes)
      locked.push({
        id: source.id,
        title: source.title,
        type: source.type,
        version: source.version,
        canonicalUrl: source.canonicalUrl,
        digest: { algorithm: "sha256", value: sha256(bytes) },
        retrieval: {
          method,
          artifacts: [artifact(url, bytes, source.output)],
        },
        updatedAt,
        generatorVersion: GENERATOR_VERSION,
      })
    }

    const reactArtifacts: LockedArtifact[] = []
    for (const url of reactDocs) {
      const name = basename(new URL(url).pathname) || "versions"
      const suffix = sha256(url).slice(0, 8)
      const output = `reference/react-docs/${name}-${suffix}.html`
      let bytes: Uint8Array
      try {
        bytes = await download(url)
      } catch (error) {
        const outputPath = resolve(sourcesRoot, output)
        if (!await Bun.file(outputPath).exists()) throw error
        bytes = new Uint8Array(await Bun.file(outputPath).arrayBuffer())
      }
      await writeBytesIfChanged(resolve(sourcesRoot, output), bytes)
      reactArtifacts.push(artifact(url, bytes, output))
    }
    const reactDigest = sha256(reactArtifacts.map((item) => item.digest.value).join("\n"))
    locked.push({
      id: "react-docs-19.2",
      title: "Official React 19.2 reference documentation",
      type: "reference",
      version: "19.2 docs at react.dev, snapshot 2026-08-29",
      canonicalUrl: "https://react.dev/reference/react",
      digest: { algorithm: "sha256", value: reactDigest },
      retrieval: { method: "HTTPS GET official reference indexes", artifacts: reactArtifacts },
      updatedAt,
      generatorVersion: GENERATOR_VERSION,
    })

    const lock = {
      schemaVersion: 1,
      generatorVersion: GENERATOR_VERSION,
      updatedAt,
      sources: locked.sort((left, right) => left.id.localeCompare(right.id)),
    }
    await writeJsonIfChanged(resolve(rendererRoot, "specifications/sources.lock.json"), lock)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

function lockPackage(
  source: PackageSource,
  bytes: Uint8Array,
  artifacts: LockedArtifact[],
  updatedAt: string,
): LockedSource {
  return {
    id: source.id,
    title: source.title,
    type: source.id === "webidl2" || source.id === "ajv-dist"
      ? "audit-tool"
      : source.id.startsWith("typescript-")
        ? "reference-package"
        : "machine-inventory",
    version: source.version,
    canonicalUrl: source.canonicalUrl,
    digest: { algorithm: "sha256", value: sha256(bytes) },
    integrity: source.integrity,
    retrieval: { method: "HTTPS GET npm tarball; verified SRI; extracted listed files", artifacts },
    updatedAt,
    generatorVersion: GENERATOR_VERSION,
  }
}

function artifact(url: string, bytes: Uint8Array, path?: string): LockedArtifact {
  return {
    ...(path ? { path } : {}),
    url,
    digest: { algorithm: "sha256", value: sha256(bytes) },
    bytes: bytes.byteLength,
  }
}

async function download(url: string): Promise<Uint8Array> {
  let lastError: unknown
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
      return new Uint8Array(await response.arrayBuffer())
    } catch (error) {
      lastError = error
      if (attempt < 3) await Bun.sleep(attempt * 500)
    }
  }
  throw new Error(`Failed to fetch ${url} after 3 attempts`, { cause: lastError })
}

function verifyIntegrity(bytes: Uint8Array, integrity: string, id: string): void {
  const [algorithm, expected] = integrity.split("-", 2)
  if (algorithm !== "sha512" || !expected) throw new Error(`Unsupported integrity for ${id}: ${integrity}`)
  const actual = createHash("sha512").update(bytes).digest("base64")
  if (actual !== expected) throw new Error(`Integrity mismatch for ${id}`)
}

async function extractMember(tarballPath: string, member: string): Promise<Uint8Array> {
  const process = Bun.spawn(["tar", "-xOzf", tarballPath, member], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const [output, error, exitCode] = await Promise.all([
    new Response(process.stdout).arrayBuffer(),
    new Response(process.stderr).text(),
    process.exited,
  ])
  if (exitCode !== 0) throw new Error(`Could not extract ${member}: ${error}`)
  return new Uint8Array(output)
}

function extractExports(code: string): string[] {
  const exports = new Set<string>()
  for (const match of code.matchAll(/exports\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=/g)) {
    const name = match[1]
    if (name && !name.startsWith("__")) exports.add(name)
  }
  for (const match of code.matchAll(/exports\[["']([^"']+)["']\]\s*=/g)) {
    const name = match[1]
    if (name && !name.startsWith("__")) exports.add(name)
  }
  return [...exports].sort((left, right) => left.localeCompare(right))
}

async function writeBytesIfChanged(path: string, bytes: Uint8Array): Promise<void> {
  const existing = Bun.file(path)
  if (await existing.exists()) {
    const previous = new Uint8Array(await existing.arrayBuffer())
    if (sha256(previous) === sha256(bytes)) return
  }
  await Bun.$`mkdir -p ${resolve(path, "..")}`.quiet()
  await Bun.write(path, bytes)
}

await main()
