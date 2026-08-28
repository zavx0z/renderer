# Web realm requirements

## WEB-REALM-001 — one explicit semantic Document per realm

`createWebRealm()` requires one exact `@zavx0z/dom` Document and one explicit
platform host. `window.document`, the exported binding object and all
renderer-backed reads remain tied to that Document for the realm lifetime.
Several realms may delegate to the same native WindowProxy, including several
Documents presented on one canvas, but a Document may have only one attached
web-realm read boundary at a time.

## WEB-REALM-002 — no native global replacement

Creating, attaching and disposing a realm must not write to `globalThis`, the
native WindowProxy or its Document. `window`, `self` and realm `globalThis`
refer to a read-only `WebRealmWindow` facade; `Window` is its illegal public
constructor. The native browser objects remain the host for canvas, WebGPU,
WebXR, URL/history, timers, network and native input.

## WEB-REALM-003 — exact semantic identities

`document`, Node/Element/HTMLElement constructors, specialized supported HTML
constructors and standard event constructors are the exact exports of
`@zavx0z/dom`. The facade neither wraps semantic nodes nor creates a second
DOM, layout, display or renderer tree. Cross-Document elements and renderer
bridges are rejected. Attachment pins the exact DocumentRenderer and renderer
root rather than accepting another renderer merely because it shares a
Document.

## WEB-REALM-004 — explicit host capability delegation

Only the documented allowlist is delegated: URL, URLSearchParams, location,
history, navigator (including host-provided WebGPU/WebXR), performance, crypto,
console, fetch, timers, microtasks, animation frames and devicePixelRatio.
Callable values are bound to the platform host and cached per realm. Missing
allowlisted capabilities throw `NotSupportedError` when used; unknown Window
properties are absent from `in` and throw on read. Writes, definitions and
deletions through the facade are rejected.

## WEB-REALM-005 — renderer-owned read APIs

`getComputedStyle()` and `Element.getBoundingClientRect()` require one attached
renderer bridge for the exact semantic Document. Reads flush lazily through
that bridge and consume the existing renderer computed style and RenderFrame
box/transform state. The facade may serialize an immutable supported
CSSStyleDeclaration view and an immutable DOMRectReadOnly result, but must not
cache a parallel style/layout tree or add derived fields to semantic nodes.
Unsupported pseudo-elements and CSS properties throw.

## WEB-REALM-006 — build-scoped lexical bindings

The Bun plugin transforms only explicit source roots and explicitly allowlisted
bundled packages. It imports one application-owned binding module and injects
only referenced supported names as module lexical bindings. It never assigns
browser globals. Binding modules are absolute or package/import-map specifiers,
may export a configurable named/default realm, and can opt out with the
documented no-transform marker.

Transformation is deliberately conservative. A selected module that already
declares an injected top-level name fails at parse time and must be excluded or
adapted explicitly. Direct eval and Function-constructor code, non-selected
dependencies, runtime-generated modules and unsupported loaders are outside
the binding boundary and must fail closed or remain outside the realm build.

## WEB-REALM-007 — framework imports are separate policy

Imports are not global name lookups. `react-dom` and its subpaths therefore
fail the governed build by default. The only opt-in alias is
`react-dom/client` to `@zavx0z/web-realm/react-dom-client`, which re-exports the
bounded `@zavx0z/dom-react` mutation renderer. Other React DOM entrypoints and
unlisted framework host configs remain unsupported.

## WEB-REALM-008 — lifecycle and failure closure

Renderer attachment and detachment are exact and idempotent. Realm disposal
detaches the Document read adapter and releases facade function caches without
disposing the semantic Document, renderer or platform host. Reads after realm
disposal, reads without a bridge, changing bridge ownership and unsupported
members throw named errors rather than falling through to native DOM state or
returning fabricated values.

## WEB-REALM-009 — executable compatibility proof

Tests must compile ordinary source with the global subset declarations and Bun
binding plugin, then prove standard document creation, instanceof identity and
event dispatch against the same semantic tree. The integration proof must
observe the resulting mutation in a DocumentRenderer frame and in the retained
WebGPU backend, including resource identity across an incremental text update.
Native-host non-mutation, two-Document isolation, renderer geometry/style
reads, React import policy and unsupported-member failures require focused
tests.
