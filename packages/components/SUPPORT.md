# Component support matrix

This is a minimal signal-backed TSX authoring layer, not a React implementation.

| Feature | First slice |
|---|---|
| Function components and static props | Supported |
| Intrinsic HTML elements and primitive children | Supported |
| `createRoot(container).render(element)` / `unmount()` | Supported; a later root render remounts |
| `const [value, setValue] = useState(initial)` | Supported through the Bun transform |
| Functional and direct state setters | Supported and synchronously batched |
| State in JSX text and intrinsic primitive properties | Direct signal binding |
| State reads inside JSX event callbacks | Current signal value, no stale closure |
| `className`, `id`, `title`, `style`, primitive/data/aria attributes | Supported subset |
| Click/input/focus/blur and pointer event props | Standard semantic DOM listeners |
| Fragments and static arrays | Supported |
| Effects, context, memo, refs as objects | Unsupported |
| Dynamic component props, keyed lists, portals | Unsupported |
| SSR, hydration, Suspense, error boundaries | Unsupported |
| React/npm component compatibility | Unsupported |
| Bun HTML dev server via `bunfig.toml` | Supported for the conventional application `src/` root |
| Production HTML build | `bunx zavx0z-build ./index.html`; application-local `build.ts` is unnecessary |
| Native `bun build` plugin loading | Unsupported by Bun 1.4; hidden inside the package executable |

The compiler rejects state reads whose update semantics are not implemented.
In the first slice each state value identifier must also be unique in its
module and may not be shadowed.
The runtime rejects unsupported objects, functions and cross-Document nodes
instead of stringifying or remounting them silently.
