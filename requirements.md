# Document engine requirements

## RENDERER-PIPELINE-001 — one semantic tree

One stable HTML DOM is the only public UI tree. Template and framework adapters
must mutate that tree instead of creating parallel resolved or component trees.

## RENDERER-PIPELINE-002 — derived rendering stages

Computed style, layout boxes, fragments, display items, hit records, and GPU
resources are derived projections with their own compact identities. They never
replace DOM identity or become public authoring APIs.

## RENDERER-PIPELINE-003 — incremental invalidation

A leaf mutation invalidates only its required style, layout, paint, and
compositor ancestry. A clean frame performs no DOM traversal, style resolution,
layout, materialization, or allocation. Transform-only presentation preserves
unchanged geometry and resources.

## RENDERER-PIPELINE-004 — backend ownership

The CPU renderer emits a target-neutral display list. The WebGPU backend owns
Engine resources and presentation but contains no HTML, CSS, component, or
authoring semantics.

## RENDERER-PIPELINE-005 — exact public ownership

No compatibility aliases or re-exports preserve the historical root Renderer,
Layout, or Elements APIs. Old packages are removed only after all consumers are
migrated and the replacement passes semantic, visual, interaction, build,
browser, memory, and retained-identity gates.

## RENDERER-PIPELINE-006 — realm-scoped ordinary web authoring

Ordinary supported `window`, `document`, DOM constructor, event and Web API
names may be bound lexically to one explicit semantic Document. This boundary
must never replace or mutate the browser WindowProxy/Document, and several
semantic Documents sharing one native canvas must retain independent realms.

Semantic DOM identities come only from `@zavx0z/dom`. URL, navigation, timers,
networking and native capabilities remain delegated to an explicit platform
host allowlist. Geometry and computed-style reads pull lazy derived state from
the renderer for that exact Document. Unsupported names, detached bridges,
cross-Document values, recognized direct dynamic-code escape paths and
unapproved framework host imports fail closed instead of falling through to
the native DOM or fabricated values.

## RENDERER-PIPELINE-007 — bounded signal component authoring

React-shaped TSX components may bind state directly to exact semantic nodes,
but they must not introduce a second DOM, layout, display, Fiber or persistent
virtual tree. The supported Bun transform and runtime are explicit, bounded
contracts: unsupported state escapes, dynamic component props and keyed lists
fail closed rather than claiming React or general npm compatibility.
