# Architecture

This repository owns one document rendering pipeline with separately loadable
production packages:

```text
@zavx0z/dom
    ↓
@zavx0z/renderer
    ↓
@zavx0z/renderer-webgpu
    ↓
@engine/core
```

`@zavx0z/web-realm` is an authoring compatibility boundary in front of
`@zavx0z/dom`, not another stage or tree. A build-scoped lexical binding maps
ordinary names such as `window`, `document`, `Element` and `Event` to one
explicit semantic `Document`. The real browser `WindowProxy` and `Document`
remain the platform host and are never replaced or monkey-patched.

`@zavx0z/renderer-browser` is the platform composition root for a browser
canvas. It connects those exact owners, viewport resize, routed camera input,
world document planes and camera-locked document overlays in one Engine frame;
it does not add another semantic or layout tree.

One browser canvas may therefore present several semantic Documents. Each
Document has its own web-realm facade and renderer read bridge, while all of
them may delegate allowed platform capabilities to the same native WindowProxy.

## Semantic DOM

`@zavx0z/dom` is the sole owner of observable HTML DOM identity and behavior:
tree mutation, attributes and reflection, events, focus, and HTML element
state. It has no rendering, CSS layout, Engine, WebGPU, Template, React, or UI
dependency.

## CPU document renderer

`@zavx0z/renderer` consumes one DOM tree and derives computed style, box and
fragment geometry, display items, and hit metadata. CSS, layout, paint, input,
and compositor modules are internal stages of this one engine rather than
independent public trees.

The semantic DOM remains stable while derived stages may be replaced. One
semantic node may create zero, one, or several boxes and display items. A
display item is retained by the composite identity `(node, key)`, never by its
array position.

## WebGPU backend

`@zavx0z/renderer-webgpu` consumes the abstract display list and owns only its
retained Engine/WebGPU realization. It does not own DOM, CSS, HTML control, or
authoring semantics.

## Authoring boundary

Imperative DOM, templates, custom elements, and optional framework adapters all
mutate the same DOM. Consumer code never receives a render surface, manual
rectangle, Engine object, or materializer function.

`@zavx0z/dom-components` is the lean component path: function components and
props use React-shaped TSX, while its Bun/TypeScript 7 transform lowers the
supported `useState` reads to direct signal subscriptions on exact semantic
nodes. Components execute once on mount; updates do not reconcile or retain a
virtual/Fiber tree. The bounded API is intentionally not React-compatible.

`@zavx0z/dom-react` is an optional mutation-mode host adapter. React owns its
component/Fiber tree and commits standard DOM mutations; it does not create a
second render/layout tree and does not make `react-dom` a dependency.

`@zavx0z/web-realm` injects lexical bindings only into selected application
modules and explicitly selected bundled dependencies. Its Window facade owns
the semantic `document` and DOM constructor identities, delegates an allowlist
of URL/history/timer/network/native capabilities to the browser host, and
throws for names outside its support matrix. Renderer-backed reads pull from
the attached renderer lazily; no geometry or computed-style tree is copied
into DOM instances. `react-dom` module imports are a separate build concern:
they fail closed unless the explicit `react-dom/client` to
`@zavx0z/dom-react` adapter policy is enabled.

`@zavx0z/dom-devtools` assigns stable realm-local IDs and exposes immutable
serializable DOM/render snapshots plus compact mutation signals. It is the
foundation for an AI inspector or custom DevTools panel. It deliberately does
not claim Chrome Elements integration: Blink alone owns CDP `BackendNodeId`.

## Migration boundary

The former root `compile/evaluate/ResolvedTree/RenderHost/replaceChildren`
implementation was removed after external-source zero-import proof and the new
semantic, layout, visual, interaction, delivery, identity, and performance
gates passed. It has no compatibility export or alternate runtime path.

Generic Layout and `@ui/elements` were retired after their production consumers
reached zero imports. They have no compatibility aliases or alternate runtime
path in the new graph. The unrelated `@nodes/layout` domain package remains the
Node owner's numeric layout and routing boundary.
