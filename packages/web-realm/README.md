# `@zavx0z/web-realm`

Per-Document ordinary web-name compatibility for the zavx0z semantic DOM and
renderer pipeline.

The host/bootstrap module creates the semantic Document and exports its realm:

```ts
// @zavx0z/web-realm no-transform
import {createDocument} from "@zavx0z/dom"
import {createWebRealm} from "@zavx0z/web-realm"

const semanticDocument = createDocument()
export const webRealm = createWebRealm({
  document: semanticDocument,
  platformWindow: globalThis,
})

webRealm.attachRenderer({
  getRenderer: () => renderer,
  flush: () => renderer.flush(),
})
```

Application source stays ordinary and has no XR-specific UI calls:

```ts
const button = document.createElement("button")
button.addEventListener("click", event => {
  if (event instanceof Event) button.textContent = "Clicked"
})
document.documentElement!.appendChild(button)
```

Bind selected modules at build time:

```ts
import {createWebRealmBunPlugin} from "@zavx0z/web-realm/bun"

await Bun.build({
  entrypoints: ["src/application.tsx"],
  packages: "bundle",
  plugins: [createWebRealmBunPlugin({
    bindingModule: "/absolute/path/to/realm-binding.ts",
    sourceRoots: ["/absolute/path/to/src"],
    transformPackages: ["audited-package"],
  })],
})
```

No call changes the real browser `window` or `document`. The plugin adds module
lexical bindings, the facade delegates only documented host capabilities, and
renderer reads pull from the same frame state used by WebGPU. See
[`SUPPORT.md`](SUPPORT.md) before allowlisting a dependency.
