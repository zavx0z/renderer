# `@zavx0z/dom-components`

React-shaped, signal-backed TSX that creates the exact semantic nodes consumed
by `@zavx0z/renderer` and `@zavx0z/renderer-webgpu`.

```tsx
import {createRoot, useState} from "@zavx0z/dom-components"

function Counter(props: {initial: number; step: number}) {
  const [count, setCount] = useState(props.initial)
  return <button onClick={() => setCount(value => value + props.step)}>{count}</button>
}

createRoot(container).render(<Counter initial={0} step={1} />)
```

For a conventional Bun HTML application whose source is under `src/`, put the
runtime and plugin in `bunfig.toml`. The transform is required: raw runtime use
of the state value fails closed.

```toml
jsx = "react-jsx"
jsxImportSource = "@zavx0z/dom-components"

[serve.static]
plugins = ["@zavx0z/dom-components/bun"]
```

Then `bun index.html` compiles TSX without application build plumbing. The
production command is package-owned as well:

```bash
bunx zavx0z-build ./index.html
```

For additional governed source roots, use the explicit factory:

```ts
import {createDomComponentsBunPlugin} from "@zavx0z/dom-components/bun"

await Bun.build({
  entrypoints: ["src/application.tsx"],
  target: "browser",
  jsx: {runtime: "automatic", importSource: "@zavx0z/dom-components"},
  plugins: [createDomComponentsBunPlugin({sourceRoots: ["src"]})],
})
```

Bun 1.4's `bun build` CLI does not consume `[serve.static].plugins`; the
package-owned executable contains the temporary `Bun.build()` adaptation.

See `SUPPORT.md` for the exact first-slice boundary.
