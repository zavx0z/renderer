# `@zavx0z/dom-devtools` requirements

`@zavx0z/dom-devtools` exposes one serializable inspection boundary for the
custom `@zavx0z/dom` realm. It is intended for a product-owned DevTools panel,
debug transport or AI bridge. It does not pretend that the semantic tree is the
browser's native DOM.

## `DOM-DEVTOOLS-001` — exact realm and ownership

`createDomInspector({document, renderer?, readFrame?})` receives one exact
`@zavx0z/dom` `Document`. Every inspected Node must be that Document or have it
as `ownerDocument`; foreign DOM realms and Documents fail closed. The optional
`@zavx0z/renderer` peer must project the same Document. A caller that keeps its
Renderer private may instead provide one `readFrame(node)` function owned by the
same Experience; `renderer` and `readFrame` are mutually exclusive. The package has no
Engine, UI, browser DOM, CDP or GPU dependency.

## `DOM-DEVTOOLS-002` — stable local identity

`idForNode()` assigns monotonically increasing positive safe integers and never
reuses an ID within one inspector lifetime. Repeated lookup and in-Document
movement preserve identity. `nodeForId()` provides the reverse lookup while the
Node is retained by the inspected Document or explicitly requested by the
caller.

The forward association is weak. After a subtree is removed from the Document,
its reverse strong references are released after mutation subscribers have run.
If a caller still owns and later reinserts that Node, its weakly remembered ID is
restored rather than replaced.

## `DOM-DEVTOOLS-003` — pull snapshot

`snapshot(root?)` returns one deeply immutable JSON-serializable pre-order
snapshot. It contains independent Document mutation and state versions, one root
ID and flat Node records with standard `nodeType`, `nodeName`, `localName`,
`nodeValue`, ordered attributes, boundary-relative parent ID and ordered child
IDs. The selected root has `parent: null`, so a subtree snapshot is
self-contained.

When neither renderer nor frame reader is configured, render projection keys
are omitted. With either exact source, each record additionally contains its current serializable
RenderBox or `null`, HitMetadata or `null`, and ordered display identity pairs
`{key, kind}` for Rect, Text and Image items. Image source/texture state is not
duplicated into this identity index. Node references, Maps and Engine objects
never enter the snapshot.

RenderBox and HitMetadata projections include an immutable serializable
axis-aligned RenderTransform. Every copied RenderClip includes its independently
owned transform as well. Inspector copies only the four resolved numeric fields;
Engine coordinate spaces, matrices and retained objects never enter the
snapshot.

## `DOM-DEVTOOLS-004` — compact mutation signal

The inspector subscribes to committed Document mutation and state-change
batches. Its public `subscribe()` signal contains only a discriminating
`mutation`/`state` kind, both current version counters and a deduplicated ordered
list of changed Node IDs. Mutation IDs are targets plus added or removed subtree
roots; state IDs are exact record targets. Callers pull a fresh snapshot when
they need state. Signals do not duplicate trees, attributes, text, live values
or render records.

Removed roots remain reverse-resolvable during the synchronous notification and
are released immediately afterwards if they are still disconnected. A move
within the same Document therefore keeps the same live reverse identity.

## `DOM-DEVTOOLS-005` — disposal

`dispose()` is idempotent. It unsubscribes from both Document channels, clears
public subscribers and releases every reverse strong Node reference. Later
`nodeForId()` calls return `null`; operations that would allocate identity,
subscribe or snapshot fail as disposed.

## `DOM-DEVTOOLS-006` — Chrome boundary

This package is not Chrome Elements spoofing. Chrome DevTools' DOM domain is
owned by Blink and addresses native backend nodes with Blink `BackendNodeId`
identity. Matching Web IDL names or serializing `nodeType` does not register a
custom renderer tree in that domain. Integration with stock Chrome Elements
would require browser/Blink participation or a dedicated protocol adapter.

The supported product path is a custom DevTools panel or AI/debug bridge that
consumes this package's IDs, mutation signals and pull snapshots directly.

## `DOM-DEVTOOLS-007` — live state projection

HTMLElement records optionally carry one separate immutable `state` object with
requested `scrollLeft`/`scrollTop` and a `focused` flag derived from the current
`Document.activeElement`. HTMLInputElement state additionally carries normalized
`.type`, live `.value`/`.checked` and nullable selection start/end/direction.
HTMLTextAreaElement carries live value, rows/cols and non-null selection state.
Reflected/default attributes remain only in the standard attributes array;
dirty values, checked and selection state are not rewritten as attributes or
duplicated elsewhere.

Direct scroll and input property changes advance only the Document state version
and produce `kind: "state"` signals. Attribute/tree/text mutations advance only
the mutation version and produce `kind: "mutation"` signals. Focus is read at
snapshot time; the inspector does not invent a version outside the DOM's state
channel.
