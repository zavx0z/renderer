# Platform contradictions

> Generated from `specifications/audit-findings.json`. Do not edit by hand.

## contradiction.react.matrix-completeness — React compatibility manifest claims completeness but lists only a selected subset

- Claim: requirements.md says the manifest marks every feature supported or unsupported.
- Current fact: The prior hand-written manifest contains 25 features and 19 hooks, omitting most React/ReactDOM 19.2 public APIs and two required architecture flags.
- Owner: @zavx0z/react
- Impact: Compatibility consumers could infer support from absence or treat a partial list as complete.
- Evidence: `renderer:packages/react/requirements.md#DOM-COMPONENTS-007`, `renderer:packages/react/compatibility.json`

## contradiction.dom.react-custom-renderer — DOM SUPPORT still names an optional React custom renderer

- Claim: An optional React custom renderer is an integration path.
- Current fact: Current architecture uses compiled @zavx0z/react and explicitly excludes npm React, reconciler, Fiber and a custom React renderer.
- Owner: @zavx0z/dom
- Impact: The document points future work toward a removed architecture.
- Evidence: `renderer:packages/dom/SUPPORT.md`, `renderer:packages/react/test/boundary.test.ts`

## contradiction.renderer.migration-react — MIGRATION.md still promises React adapter/reconciler hooks

- Claim: A React adapter and reconciler/DevTools hook remain migration targets.
- Current fact: The current compiled runtime has no npm React/reconciler/Fiber/React DevTools integration.
- Owner: renderer root
- Impact: Historical migration text conflicts with the accepted owner graph.
- Evidence: `renderer:MIGRATION.md`, `renderer:ARCHITECTURE.md`

## contradiction.renderer.performance-current — PERFORMANCE.md numbers are historical and two documented benchmark routes are broken

- Claim: Documented renderer/transform numbers describe the current checkout.
- Current fact: The document predates major retained-instancing changes; renderer.ts and transform.ts fail module resolution for @zavx0z/renderer.
- Owner: renderer audit tooling
- Impact: Historical performance claims cannot be used as current acceptance.
- Evidence: `renderer:PERFORMANCE.md`, `renderer:bench/renderer.ts`, `renderer:bench/transform.ts`

## contradiction.renderer.web-realm-history — Detached web-realm acceptance is absent from canonical main

- Claim: Document-bound DOMRect/readComputedStyle/browser evidence exists in Renderer.
- Current fact: Current main has no packages/web-realm, realm-host.ts, dom-rect.ts, readComputedStyle or getBoundingClientRect implementation.
- Owner: renderer
- Impact: Historical browser proof must not promote current capabilities.
- Evidence: `renderer:packages/dom/src`, `renderer:packages/core/src/renderer.ts`

## contradiction.template.first-html-block — Template static parse claims first html block but slices through the last backtick

- Claim: parse() analyzes the first html tagged template.
- Current fact: extractMainHtmlBlock starts at the first html tag and ends at the final backtick; a two-template probe returned nodes from both blocks.
- Owner: @zavx0z/template
- Impact: Static analysis can merge unrelated tagged templates.
- Evidence: `template:index.ts`, `template:README.md`

## contradiction.template.domain-neutrality — Template README says domain semantics are external while static parser hardcodes MetaFor terms

- Claim: Domain validation belongs outside Template.
- Current fact: The static parser hardcodes meta-*, fields, mass, energy and update descriptors and sometimes logs/degrades unsupported methods.
- Owner: @zavx0z/template
- Impact: The source-analysis DSL is not the same neutral contract as the DOM/compiled runtimes.
- Evidence: `template:README.md`, `template:parser.ts`, `template:node/text.ts`

## contradiction.engine.material-groups — Mesh material-array documentation names geometry.groups that do not exist

- Claim: Material arrays map to BufferGeometry groups.
- Current fact: BufferGeometry has no groups and Renderer selects material[0].
- Owner: @engine/core
- Impact: Public documentation promises an unimplemented draw contract.
- Evidence: `engine:packages/core/src/core/mesh.ts`, `engine:packages/core/src/core/buffer-geometry.ts`, `engine:packages/core/src/renderer/index.ts`

## contradiction.browser.optional-engine-peer — renderer-browser marks Engine optional while its root statically imports Engine

- Claim: @engine/core is an optional peer.
- Current fact: The main browser entry exports modules with runtime Engine imports and cannot load without Engine.
- Owner: @zavx0z/renderer-browser
- Impact: Package installation/loading contract is misleading.
- Evidence: `renderer:packages/browser/package.json`, `renderer:packages/browser/src/runtime.ts`

## contradiction.renderer.disabled-hit-metadata — Hit metadata disabledness is narrower than semantic disabledness

- Claim: Hit metadata describes effective interactivity.
- Current fact: HitMetadata.disabled reads the element's own disabled attribute while :disabled and activation also consider disabled fieldset ancestry.
- Owner: @zavx0z/renderer
- Impact: Metadata may say interactive even when semantic default action/focus is suppressed.
- Evidence: `renderer:packages/core/src/renderer.ts`, `renderer:packages/core/src/css.ts`

## contradiction.consumer.removed-controllers — Consumers import removed imperative UI controllers

- Claim: Demo, Interpreter and MetaFor visual packages consume current @ui/components exports.
- Current fact: The package exports compiled .tsx components; consumer typechecks fail on JSX configuration and missing create*Controller exports.
- Owner: consumer repositories
- Impact: Current product consumers do not build; restoring controllers would revive the removed architecture.
- Evidence: `ui:packages/components/package.json`, `interpreter:packages/interpreter/web/dom/source-editor.tsx`, `metafor:cosmos/internal/visual/main/index.ts`, `demo:src/dom/journalDocument.ts`

## contradiction.consumer.bulk-overlay-owner — Bulk duplicates browser composition ownership

- Claim: renderer-browser is the single browser composition owner.
- Current fact: Bulk directly creates CPU Renderer/WebGPU and copies pointer/capture/hit/lifecycle behavior.
- Owner: @quantum/bulk
- Impact: Two owners can diverge on exact Document/input/presentation lifecycle.
- Evidence: `metafor:quantum/bulk/dom/overlay-runtime.ts`

## contradiction.consumer.demo-backend-read — Demo reads private retained backend owner objects

- Claim: Consumers receive DOM/CSS/TSX and neutral diagnostics, not Surface/Engine/private materializers.
- Current fact: Demo reads journalPlane.backend.root.children.
- Owner: @zavx0z/demo
- Impact: A product depends on backend materialization shape.
- Evidence: `demo:src/main.ts`

## contradiction.consumer.storybook-concurrent-wip — Current UI and Node Storybook checkouts reference missing local modules

- Claim: Focused Storybook typechecks are green consumer evidence.
- Current fact: The final current-checkout Storybook typechecks fail with TS2307 for multiple missing compiled production story, DOM story, asset and node story modules. Nodes UI also has one owner-route assertion mismatch: /references/ was expected while the current source emits /__storybook/resources/nodes/.... These failures appeared in concurrent owner WIP and are not platform implementation evidence.
- Owner: UI and Node Storybook WIP
- Impact: Current Storybook routes cannot be used as final browser/component acceptance until their owner WIP is completed.
- Evidence: `ui:packages/storybook/app/production-component-stories.ts`, `ui:packages/storybook/app/route-style.ts`, `node:packages/storybook/app/dom-entry.ts`, `node:packages/storybook/app/dom-story.ts`

## Historical claim reproduction

| Claim | Status | Current evidence | Boundary |
|---|---|---|---|
| Lean DOM is about 189 B/node versus 312 B/node for per-instance closures. | current-reproduced | bun bench/dom-memory.ts 100000: empty 188.780-188.801 B/node; closures 312.207 B/node. | Memory benchmark evidence only; it does not establish DOM conformance. |
| Attributes, listeners and control state are lazy. | confirmed-current-code | packages/dom/src/node.ts, element.ts, event-target.ts and specialized control fields allocate optional state on demand. | The exact byte effect varies by node kind and title/control state. |
| Supported DOM classes preserve their exact prototype chains. | confirmed-bounded | DOM structural/control tests assert exact specialized constructor/prototype identity. | Only the currently specialized element map; arbitrary standard tags may still be generic HTMLElement. |
| The platform has one semantic tree. | confirmed-current-code | Document/Node mutation path feeds CPU Renderer and retained backend without a second semantic or virtual tree. | Engine still exposes legacy CSS-like layout fields, recorded as a P0 ownership contradiction. |
| A clean 10k frame is about 0.016-0.020 ms. | not-exactly-reproduced | Current components benchmark measured clean flush 0.02149 ms with zero work. | The O(1) clean path is confirmed; the historical numeric band was narrowly missed in one current run. |
| Warm leaf update is substantially below 16.7 ms. | current-reproduced | Current 10k components benchmark warm leaf p95 0.01385 ms. | A benchmark path, not a universal dirty-frame guarantee. |
| Transform/backend p95 is about 10.77 ms. | not-reproduced | bun bench/transform.ts currently fails to resolve @zavx0z/renderer. | Keep the old number as historical only until the route and threshold are restored. |
| Retained visual identities remain stable. | confirmed-bounded | WebGPU backend tests prove scalar (node,key) owners and instanced generation-guarded stable slots across admitted updates. | Topology/overlap/clip/capacity changes can intentionally rebuild plans or fall back scalar. |
| Transform-only updates cause zero geometry invalidation. | confirmed-bounded | Core transform fast-path and WebGPU backend tests preserve geometry and mutate transform state in place. | Only guarded axis-aligned transform-only updates. |
| Safe Rect instancing is automatic. | current-reproduced | 10k current benchmark: one instanced owner versus 10k scalar owners; one update uploads 128 record bytes; warm p95 about 1.432 ms. | Overlap/touch, clip, Text/Image, capacity and spatial-policy barriers remain scalar. |
| A hidden native input/textarea host exists. | confirmed-unit-only | DocumentNativeInputHost and 39 Browser package tests cover the bounded proxy/rollback path. | No live browser IME/caret/pixel acceptance was reproduced. |
| Native input projection retains the exact semantic Document identity. | confirmed-unit-only | Browser adapter tests assert exact Document/owner routing. | The historical detached web-realm live browser proof is not current canonical evidence. |
| HTMLElement.title and explicit-empty inherited title suppression work. | confirmed-bounded | DOM reflection and Core interaction tests prove nearest present title, empty suppression and deterministic UA overlay. | Not full native tooltip or accessible-name parity. |
| Scroll, clip, input and form-control slices exist. | confirmed-partial | DOM/Core/WebGPU focused tests cover requested/applied scroll, clip stacks, text proxy and bounded control paint. | No complete forms, picker, caret/selection paint, clipboard, range drag/keyboard or all downstream clip combinations. |
| TSX compiles without JSX descriptors, Fiber or a virtual DOM. | confirmed-current-code | Template compiler/runtime/boundary tests and @zavx0z/react dependency boundary prove the fixed-slot compiled ABI and reject npm React/reconciler. | Browser-target build is tested; live browser execution was not reproduced in this audit. |

## Check audit

| Target | Command | Status | Result |
|---|---|---|---|
| renderer root and six platform packages | `bun run check` | passed | all workspace typechecks; 373 tests / 3344 expectations; audit typecheck; 3 deterministic audit tests / 429 expectations |
| template | `bun run typecheck && bun test` | passed | 698 tests / 885 expectations |
| engine core | `bun run --cwd packages/core typecheck && bun test packages/core/src` | passed | 123 tests / 607 expectations including real bun-webgpu pipeline/pixel tests |
| UI components | `bun run --cwd packages/components typecheck` | passed | production typecheck passed |
| UI components | `bun test packages/components` | passed | 63 tests / 451 expectations |
| Nodes UI | `bun run --cwd packages/ui typecheck` | passed | typecheck passed |
| Nodes UI | `bun test packages/ui` | failed-owner-wip | 101/102 tests passed; NodeWorkbench accepted-reference route expected /references/ but current source emitted /__storybook/resources/nodes/... |
| Demo | `bun run typecheck` | failed-known-gap | TS6142: linked @ui/components .tsx exports require the Template JSX build profile |
| Interpreter | `bun run --cwd packages/interpreter typecheck` | failed-known-gap | TS6142 for compiled UI imports plus two implicit-any errors in current Terminal WIP |
| MetaFor internal visual | `bun run typecheck` | failed-known-gap | TS6142 for linked @ui/components/button.tsx |
| MetaFor Bulk | `tsc --noEmit --pretty false --project tsconfig.json` | failed-known-gap | TS6142 for linked @ui/components/hud.tsx |
| UI Storybook | `bun run typecheck` | failed-owner-wip | TS2307 for missing compiled production stories, DOM stories and reference catalog asset |
| Node Storybook | `bun run typecheck` | failed-owner-wip | TS2307 for missing dom-css, production-node, compiled-node-system and NodeTree story modules |

## Benchmark audit

| Repository | Command | Status | Result |
|---|---|---|---|
| renderer | `bun bench/dom-memory.ts 100000 dom-empty\|dom-title\|closures` | passed | empty 188.780-188.801 B/node; titled 497.454 B/node; closures 312.207 B/node |
| renderer | `bun bench/components.ts 10000` | passed | clean 0.02149 ms; warm leaf p95 0.01385 ms; Text identity retained |
| renderer | `bun bench/keyed-components.ts 10000` | passed | identities retained; rotate p95 4.264 ms; insert 7.829 ms; delete 13.034 ms; arbitrary reorder 178.425 ms |
| renderer | `bun bench/instance-batches.ts 10000` | passed | one instanced owner; 128-byte single update; current warm p95 about 1.432 ms |
| renderer | `bun bench/renderer.ts 10000 500 50` | blocked | Cannot find module @zavx0z/renderer |
| renderer | `bun bench/transform.ts 1000 500 50` | blocked | Cannot find module @zavx0z/renderer |
| template | `bun run bench:jsx / bench:jsx:children` | passed | application cold 288.197 ms cached mean 0.28257 ms; children cold 324.097 ms cached mean 0.20086 ms |
| engine | `benchmark inventory` | absent | No Engine benchmark file or script exists |
