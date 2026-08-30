# `@zavx0z/react`

React-shaped component authoring specialized for `@zavx0z/dom` and the
retained WebGPU pipeline.

This package owns `createRoot`, component composition, context and hooks. It
does not depend on npm `react`, `react-dom` or `react-reconciler`; it contains
no Fiber tree, virtual DOM or generic host reconciliation.

```tsx
import {createRoot, useState} from "@zavx0z/react"

function Counter({label}: Readonly<{label: string}>) {
  const [count, setCount] = useState(0)
  return (
    <button title="Increment" onClick={() => setCount(value => value + 1)}>
      {label}: {count}
    </button>
  )
}

createRoot(container).render(<Counter label="Count" />)
```

The consumer TypeScript project keeps JSX for the Template transform and uses
Template's JSX namespace:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@zavx0z/template",
    "moduleResolution": "bundler"
  }
}
```

The Bun build then includes
`createTemplateJsxBunPlugin({sourceRoots: [...]})` from
`@zavx0z/template/bun`. Omitting the plugin fails closed at
`@zavx0z/template/jsx-runtime`; it never falls back to React or runtime JSX
descriptors.

`@zavx0z/template/compiler` removes JSX at build time. Its output mounts one
static `@zavx0z/dom` shape through `@zavx0z/template/compiled`, then writes
dynamic values into numeric binding slots. Ordinary component JavaScript and
derived locals rerun, while only changed Text/property/style/event/ref/range
bindings mutate.

Keyed ranges retain their key map and alternate two order buffers. Rotating a
large list performs one component-region move; an arbitrary permutation keeps
its longest increasing subsequence and coalesces consecutive moved regions into
one fragment insertion. Anchor validation is cached only for the exact
connected `Document.version`, so external mutations still fail closed before
runtime patches.

Hooks follow the familiar names and dependency semantics. Supported now:
`useState`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useId`,
`useContext`, `useEffect`, `useLayoutEffect`, `useInsertionEffect`,
`useEffectEvent`, `useImperativeHandle`, `useSyncExternalStore` and
`useDebugValue`. Unsupported names throw `UnsupportedReactFeatureError`.

## Styles

Components expose one source-level `style?: CssStyle` prop. Owner defaults and
caller composition are authored through the global Template `css`` intrinsic;
the compiler emits static sheets/markers plus ordered inline CSS strings.

```tsx
function Button({style, label}: Readonly<{style?: CssStyle; label: string}>) {
  return <button style={css`
    & { display: flex; height: 22px; }
    &:hover { background: rgb(101 101 101); }
    &:active { background: rgb(71 114 179); }
    ${style}
  `}>{label}</button>
}
```

At runtime React receives only compiler-produced CSS strings and nested arrays;
objects, CSSProperties, style tokens and `defineStyles` do not exist. Native
Renderer selectors own hover/focus/active/disabled behavior, while compiled
template metadata owns Document stylesheet adoption and release.

The machine-readable support matrix is available from
`@zavx0z/react/compatibility`. Compiler APIs deliberately remain in
`@zavx0z/template`; this package exports runtime only.
