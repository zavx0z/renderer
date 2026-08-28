# Linked component example

This is a standalone Bun project. It is intentionally outside the renderer
workspace and consumes every local runtime package through Bun's registered
`link:<package-name>` dependencies.

```bash
cd /Users/admin/repozitarium/renderer/examples/components-counter
bun run bootstrap
bun run check
bun run dev
```

Open <http://127.0.0.1:4180/> and click the WebGPU-rendered button.

`bunfig.toml` selects the component JSX runtime and loads
`@zavx0z/dom-components/bun` for Bun's HTML dev server. Application
source stays in the conventional `src/` root, so there is no local plugin or
serve implementation.

`bun run build` invokes the package-owned `zavx0z-build` executable. The
application contains no `Bun.build()` shim; the package hides that temporary
adaptation until Bun applies `[serve.static].plugins` to its build CLI.

The flow is:

1. Bun's JSX runtime creates lightweight component descriptors.
2. The build plugin lowers supported `useState` reads to direct signal reads.
3. `createRoot()` creates exact `@zavx0z/dom` nodes in one semantic Document.
4. The standard click event updates one signal-bound Text node; the existing
   mutation → CPU renderer → retained WebGPU pipeline presents the change.

There is no React, browser DOM UI, virtual DOM or second layout/render tree.
