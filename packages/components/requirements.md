# `@zavx0z/dom-components` requirements

## DOM-COMPONENTS-001 — one semantic tree

JSX host elements are the exact `@zavx0z/dom` `Element` and `Text` instances
created by the root container's `ownerDocument`. Components own no DOM copy,
layout tree, display list, Fiber tree or persistent virtual tree.

## DOM-COMPONENTS-002 — signal-addressed state

The supported `const [value, setValue] = useState(initial)` source form is a
build-time contract. The Bun transform keeps one signal cell and replaces
supported state reads with direct bindings. A state update changes only its
subscribed text or intrinsic property and does not execute the component again.

## DOM-COMPONENTS-003 — React-shaped, not React-compatible

Function components receive ordinary props and return TSX. `createRoot()`,
`render()` and `useState()` deliberately resemble common React authoring, but
their semantics and package identity are independent. React packages, hooks,
elements, reconciliation, hydration and React DevTools are not supported.

## DOM-COMPONENTS-004 — bounded compiler subset

The first slice accepts `useState()` only in a direct `const` array binding in
a function body. State may be read in a JSX child, a supported intrinsic
property, or a JSX event callback. Unsupported reads, dynamic component props,
keyed collections and unsupported runtime child values fail closed.

## DOM-COMPONENTS-005 — lifecycle and mutation batching

Each component invocation owns signal subscriptions and native event listeners.
Root replacement or unmount releases them. Initial mount, event updates and
unmount execute in the owning `Document.transaction()`; signal notifications
are synchronously batched before the transaction is published.

## DOM-COMPONENTS-006 — executable proof

Tests compile ordinary TSX with Bun, pass props into one component, update
`useState()` through `onClick`, preserve the exact dynamic `Text` identity and
observe the mutation in the existing CPU renderer and retained WebGPU backend.
A browser-target build must run through the production canvas composition and
report the same state transition without React or native DOM replacement.

## DOM-COMPONENTS-007 — package-owned Bun integration

A conventional application configures the default `src/` transform through
`[serve.static].plugins` and builds through the package-owned `zavx0z-build`
executable. Application code must not contain transformer options or a local
`Bun.build()` shim. Custom governed roots remain available only through the
explicit plugin factory.
