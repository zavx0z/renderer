# `@zavx0z/react` requirements

## DOM-COMPONENTS-001 — compiled host ownership

One component instance mounts one static `CompiledTemplate` into the exact
owning `@zavx0z/dom` `Document`. Later renders rerun ordinary component
JavaScript and write numeric binding values. They do not create JSX descriptor
trees, a Fiber tree, a virtual DOM, or a generic reconciliation tree.

## DOM-COMPONENTS-002 — incremental bindings

`Text`, host property, inline style, event and callback-ref bindings have stable
numeric slots. The runtime validates all values first and patches only values
whose normalized host value differs under `Object.is`. A text update preserves
the exact `Text` identity and an event update preserves one listener proxy.

## DOM-COMPONENTS-003 — one scheduler per Document

Every semantic `Document` owns one synchronous intrusive render queue. A queued
instance carries its next pointer and queued bit; scheduling does not clone a
`Set`. Root batches coalesce repeated updates and an explicit clean flush does
zero component work.

## DOM-COMPONENTS-004 — hook contracts

Every supported hook uses a compact ordered slot. Dispatch and ref identity are
stable, dependency lists use `Object.is`, hook type/count changes fail closed,
and render-phase updates are bounded to 25 attempts. Outside-render state and
reducer actions append to stable O(1) head/tail queues. A work-in-progress
render consumes them without mutating committed hook values and clears them
only after successful commit.

## DOM-COMPONENTS-005 — failure isolation

A different template or key is mounted and rendered in a detached fragment
before root commit. Render, property validation and cross-Document failures
leave the previous committed DOM region unchanged. Same-template render values
are validated before any host patch and applied with reverse rollback guards.

## DOM-COMPONENTS-006 — direct forms and refs

Controlled `input.value`, `input.checked`, `input.indeterminate`, `textarea.value`, `select.value`,
`select.selectedIndex` and `option.selected` write their semantic DOM
properties directly. Event listener identity is stable. Callback refs support
cleanup returns and fall back to `ref(null)` when no cleanup is returned. A ref
value is validated during render but attached only after its region is
committed; replacement cleanup precedes the new attachment.

## DOM-COMPONENTS-007 — explicit compatibility boundary

The package does not depend on or alias React. Unsupported React 19.2 hook
names, when exported, synchronously throw `UnsupportedReactFeatureError` and
the `./compatibility` manifest marks every feature as supported or unsupported.
Transitions, actions, SSR, hydration, Suspense and portals are not part of the
current runtime. Context, effects and external stores are supported only by the
explicit client-side contracts below.

## DOM-COMPONENTS-008 — executable evidence

Package tests cover derived-local reruns, exact host/Text identity, stable hook
identities, batching, same-root rerender, hook mismatch, bounded render-phase
updates, detached replacement, validation and cross-Document rollback,
controlled properties, ref cleanup, context propagation, commit-phase effect
ordering, failed-render isolation, imperative handles, Effect Events,
no-tearing external stores and clean flush. `bench/components.ts`
measures 10,000 mounts, clean flush and a warm single-leaf state update.
`bench/keyed-components.ts` measures a 10,000-child keyed mount, rotation,
single insertion/deletion and deterministic arbitrary reorder with
mount/dispose/move, retained-heap and identity counters. Sampled modes run one
operation family per fresh process and publish p50/p95 rather than presenting a
single noisy timing as an acceptance result.

## DOM-COMPONENTS-009 — anchored composition identity

Nested, conditional and keyed component bindings own explicit comment-anchor
ranges. Child identity is the parent instance, numeric binding slot, compiled
template identity and key. A parent render supplies ordinary child props and
reruns a non-memo child; independently scheduled child state renders only that
child instance.

## DOM-COMPONENTS-010 — explicit memo

`memo(template)` is opt-in and uses shallow own-property comparison with
`Object.is`. A custom comparator may replace it. Unwrapped compiled templates
are never memoized automatically, and state/reducer work bypasses prop memo.

## DOM-COMPONENTS-011 — keyed and conditional ranges

Conditional branches preserve their instance while template and key remain
equal. Keyed collections reject null and duplicate keys during preparation,
preserve same-key/template DOM, hooks and refs, and keep one transactional
next-order buffer per binding. One-step rotations use one placement; arbitrary
reorders retain a longest increasing subsequence and move the minimum number of
component regions. Consecutive placement indices share one fragment insertion.
Removal recursively disposes descendants before the removed component's own
listeners and refs.

Connected range anchors cache only the exact committed `Document.version`.
An external DOM mutation invalidates that proof and forces an ordered-anchor
scan before patches; detached ranges always scan. The optimization therefore
cannot hide anchor corruption or weaken prepare/rollback isolation.

## DOM-COMPONENTS-012 — atomic composition preparation

Parent host bindings and every reused descendant render are prepared before
host mutation. New descendants are fully rendered in detached ranges. A child
render, prop, key, binding or cross-Document failure discards staged work and
leaves all previously committed parent and descendant DOM and hook state
unchanged. Ref callbacks remain a post-commit phase.

## DOM-COMPONENTS-013 — Template-owned JSX compiler

Selected source roots import hooks and `createRoot` directly from
`@zavx0z/react`. `@zavx0z/template/compiler` lowers function-component TSX into
the shared `@zavx0z/template/compiled` ABI, numeric host/child/keyed slots and
direct root template/props calls. npm `react` and `react-dom` imports, dynamic
tags, class-based styling, spreads and unkeyed collections fail before
bundling; no native React or runtime-JSX fallback exists.

## DOM-COMPONENTS-014 — cross-owner compiler evidence boundary

Template golden tests prove that emitted code contains no JSX or React imports. A
executable bundled fixture must preserve derived-local, semantic DOM, keyed
child and retained WebGPU identities through updates. Browser-target bundling
is a build gate only until a live page supplies ready, console and pixel
evidence.

## DOM-COMPONENTS-019 — class-free owner styles

`defineStyles(owner, parts)` creates deterministic immutable style tokens and
flat static CSS for the native pseudo subset. A style binding accepts nested
arrays of owner tokens and caller declaration objects, deduplicates markers,
and commits marker/style changes in the same DOM transaction as other host
patches. Component APIs expose one `style`; owner tokens precede the caller
override. Token-to-token precedence follows the order of their emitted
stylesheets, not the marker array; one component therefore defines base and
variant tokens in one owner sheet. Public caller overrides are declaration
objects and become inline style last. JSX `class` and `className` fail at the
Template compiler boundary.

## DOM-COMPONENTS-015 — context frames

`createContext(defaultValue)` creates an exact-identity context and
`provideContext(context, value, child)` attaches an immutable provider frame to
one compiled child value. `useContext` reads the closest frame or the static
fallback. An `Object.is` context change reaches consumers through explicit
`memo` ancestors, while a shadowing inner provider prevents unrelated work.
Failed preparation does not publish a new frame or consumer value.

## DOM-COMPONENTS-016 — transactional effect phases

`useInsertionEffect`, `useLayoutEffect` and `useEffect` stage setup and
dependency state during render. Only a successful host commit runs changed
cleanup before setup. The runtime orders insertion effects before refs, layout
effects after refs, and passive effects after layout. Detached staged trees run
no effects until connection; disposal runs every established cleanup
child-first. Insertion effects cannot schedule component state.

## DOM-COMPONENTS-017 — external store snapshots

`useSyncExternalStore` reads an immutable cached snapshot during render and
calls `getSnapshot` again immediately before host mutation. A changed snapshot
abandons the prepared tree and retries synchronously; an uncached snapshot
fails after 25 attempts without exposing torn DOM. Subscription starts only
after connection, rechecks the snapshot after subscribe, changes with
`subscribe` identity, and is released exactly once on replacement or disposal.

## DOM-COMPONENTS-018 — commit-bound handles and callbacks

`useImperativeHandle` assigns callback or object refs in the layout phase and
preserves the previous handle when render or handle creation fails.
`useEffectEvent` returns render-local function identity backed by the latest
successfully committed callback and rejects render-phase invocation.
`useDebugValue` stores its raw value and optional formatter without eagerly
executing the formatter.

## DOM-COMPONENTS-020 — compiled stylesheet adoption

Every compiled template exposes immutable `styleSheets` metadata owned by the
Template ABI. A ComponentRoot stages metadata from exact templates encountered
through ordinary retained component construction and acquires every unique
stylesheet id at most once for that root. One thousand instances of one
template therefore own one root-level acquisition, not one thousand style
objects or stylesheet injections.

Acquisition joins the successful Document commit; a failed prepared tree does
not replace the committed DOM or leave a conflicting stylesheet. Multiple
roots in one Document share the Document registry's reference-counted record.
Root `unmount()` releases every stylesheet acquired by that root; disposing an
individual instance performs no stylesheet scan or reference-count churn.
`memo` preserves the wrapped template's stylesheet metadata.
