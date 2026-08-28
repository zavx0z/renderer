# Compiled component support

This is the `@zavx0z/react` authoring/runtime foundation specialized for
`@zavx0z/dom`. It is not React compatibility.

| Surface | First production slice |
|---|---|
| Function execution | Reruns ordinary JavaScript on state/prop render |
| Host structure | One static `CompiledTemplate` mount |
| Dynamic values | Numeric Text/property/style/event/ref slots |
| Scheduler | One intrusive synchronous queue per `Document` |
| Root identity | Same template + key preserves instance and hook state |
| Root replacement | Detached render before commit |
| Hooks | State/reducer/ref/memo/id plus context, three effect phases, external stores, imperative handles, Effect Events and lazy debug values |
| Custom hooks | Governed top-level `useX` functions compose the same compact slots; compiler enforces unconditional calls |
| Events | One stable semantic DOM listener proxy per slot |
| Controlled forms | Input, textarea, select and option direct properties |
| Callback refs | Attach, cleanup return, and `null` fallback |
| Nested components | Specialized comment-anchor child slots |
| Conditional branches | Stable range while template and key match |
| Keyed collections | Duplicate validation plus O(n) reverse-anchor reconciliation |
| `memo` | Explicit shallow `Object.is` props or custom comparator |
| Context | `createContext` fallback plus closest `provideContext` frame; changes cross explicit `memo` ancestors |
| Effects | Transactional render preparation; insertion → refs → layout/imperative/store → passive after successful host commit |
| External stores | Cached immutable snapshots, pre-mutation no-tearing recheck, resubscribe on `subscribe` identity change |
| Transitions/actions/Suspense | Explicit `UnsupportedReactFeatureError` |
| React package alias | Unsupported |
| npm `react` / `react-dom` imports | Forbidden; source imports this package directly |
| TSX compiler owner | `@zavx0z/template/compiler`, not this runtime package |
| TSX compiler profile | Function declarations, intrinsic trees, nested components, conditional component branches and keyed component `.map()` |
| Imported components | Relative governed default/named component bindings |
| Arrow/default-export components, fragments, spreads | Unsupported in this compiler profile |
| Browser target | Bundle is verified; live browser execution remains an acceptance gate |
| Source maps | Unsupported in the current text-lowering slice; errors name the source path but generated frames are not remapped yet |
| GPU instancing | Unsupported; stable template identity is available to a future renderer contract |

The complete machine-readable matrix is exported from
`@zavx0z/react/compatibility` and as
`@zavx0z/react/compatibility.json`.

## Performance and allocation boundary

The runtime eliminates JSX descriptor trees, Fiber nodes and generic host-tree
diffing, but it does not claim allocation-free updates. Every queued external
state/reducer dispatch allocates one intrusive update record. A scheduled
render clones compact hook slots into work-in-progress state and allocates its
patch/range plans plus patch records for changed bindings. Specialized
`component()` and `keyedComponents()` values and keyed entry arrays allocate on
a parent render; they are bounded slot inputs, not a persistent descriptor
tree. The numeric binding-values
array itself is retained and reset in place; values produced by component code
may still allocate. Object-form style bindings allocate declaration entries
and a serialized style string. These costs are explicit targets for later
arena/scratch-buffer optimization, not hidden compatibility overhead.

Context provider frames are immutable linked records and are allocated only for
explicit `provideContext` values. Effect setup and cleanup never run for an
abandoned work-in-progress render. `useSyncExternalStore` retries a changed
render-to-commit snapshot up to the same bounded 25-attempt safety limit and
fails closed when `getSnapshot` does not return a cached stable value.

This client-only runtime runs the passive phase synchronously after layout in
the successful component commit. It does not claim browser paint scheduling,
SSR effects, hydration, Strict Mode's development-only extra effect cycle, or
React DevTools presentation of stored `useDebugValue` data. Effect Event
functions intentionally have render-local identity while dispatching through
the latest successfully committed callback. Runtime enforcement rejects calls
during render and after disposal; full same-component Effect-only call-site
validation belongs to the source compiler/linter because valid timer callbacks
run after the effect call stack has returned.

Template owns one persistent TypeScript 7 async session, a content-hash cache
and one batched source-root snapshot per plugin. It does not initialize one
compiler session per module. Dynamic component names, unkeyed maps, component
children and JSX spreads fail closed. Runtime hook support remains independent
from the compiler profile and is declared in the compatibility manifest.
