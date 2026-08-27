# `@zavx0z/dom-react` requirements

`@zavx0z/dom-react` is an optional React authoring adapter for the same
`@zavx0z/dom` tree consumed by the CPU renderer. It owns no second semantic
tree, layout state, display list or GPU object.

## `DOM-REACT-001` — one DOM realm

`createRoot(container)` accepts only an `@zavx0z/dom` `Element` or
`DocumentFragment`. Host instances are the exact `Element` and `Text` objects
created by the container's `ownerDocument`. React and `@zavx0z/dom` are peer
dependencies so an application supplies one React runtime and one DOM realm.

## `DOM-REACT-002` — addressed mutation

The adapter uses React reconciler mutation mode. It maps host work directly to
`createElement()`, `createTextNode()`, `appendChild()`, `insertBefore()`,
`removeChild()`, property or attribute mutation, and `Text.data`. A compatible
React update preserves the exact host object identities; it never rebuilds or
copies the DOM tree as an intermediate representation.

## `DOM-REACT-003` — practical HTML properties and events

The first slice supports `className`, `id`, `title`, `style` as a string or
object, `data-*`, `aria-*`, `disabled`, `checked`, `value`, `type`,
`placeholder`, `tabIndex`, unknown primitive attributes, and the `onClick`,
`onInput`, `onPointer*`, `onFocus` and `onBlur` families with `Capture`
suffixes. Handler changes update one stable native DOM listener per
element/event/phase. Handlers receive `@zavx0z/dom` Event objects and state
updates are flushed through the reconciler event boundary.

`dangerouslySetInnerHTML` is rejected. Unknown object, function and symbol
properties are rejected instead of being stringified into misleading support.

## `DOM-REACT-004` — root lifecycle

One live React root may own a container. `render()` performs a synchronous
React 19 update and batches its addressed DOM mutations through the owning
Document transaction. `unmount()` is idempotent, removes owned host children
and listeners, and releases the container for a later root. Rendering through
an unmounted root fails.

## `DOM-REACT-005` — reconciler and DevTools boundary

The adapter targets stable React `19.2.x` and pins `react-reconciler` exactly to
`0.33.0` because React documents the custom-renderer API as experimental and
not semver-stable. The DefinitelyTyped `0.33.0` declarations omit several
runtime host hooks and declare stale event-priority literal values compared
with the official React `v19.2.0` source. The adapter supplies the missing
no-suspension hooks locally against that exact runtime; it does not select a
canary build.

The reconciler's public `injectIntoDevTools()` API is exposed explicitly. It
may register the React component/Fiber tree with React DevTools. It does not
make custom JavaScript nodes appear in the browser Elements or CSS panels and
must not be described as doing so.
