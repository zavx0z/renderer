# Requirements for `@zavx0z/dom`

`@zavx0z/dom` is a target-independent semantic DOM. It owns stable node
identity, ordered tree mutation, HTML attribute reflection and DOM event
dispatch. It does not own CSS cascade, layout, paint, browser navigation or a
GPU backend.

## DOM-CORE-001 — public hierarchy

The public runtime hierarchy is:

```text
EventTarget
└─ Node
   ├─ Document
   ├─ DocumentFragment
   ├─ CharacterData
   │  ├─ Text
   │  └─ Comment
   └─ Element
      └─ HTMLElement
         ├─ HTMLDivElement
         ├─ HTMLSpanElement
         ├─ HTMLButtonElement
         ├─ HTMLInputElement
         ├─ HTMLSelectElement
         ├─ HTMLOptionElement
         ├─ HTMLProgressElement
         ├─ HTMLMeterElement
         ├─ HTMLTextAreaElement
         ├─ HTMLLabelElement
         ├─ HTMLFieldSetElement
         ├─ HTMLLegendElement
         ├─ HTMLUListElement
         ├─ HTMLLIElement
         ├─ HTMLHeadingElement (`h1` through `h6`)
         ├─ HTMLParagraphElement
         ├─ HTMLTableElement
         ├─ HTMLTableSectionElement (`thead`, `tbody`, `tfoot`)
         ├─ HTMLTableRowElement
         └─ HTMLTableCellElement (`th`, `td`)
```

The public UI-event hierarchy is:

```text
Event
├─ CustomEvent
├─ ToggleEvent
└─ UIEvent
   ├─ FocusEvent
   ├─ InputEvent
   ├─ KeyboardEvent
   ├─ CompositionEvent
   └─ MouseEvent
      ├─ PointerEvent
      └─ WheelEvent
```

`createDocument()` creates an independent `Document`. A Document creates all
other nodes through `createElement()`, `createTextNode()`, `createComment()` and
`createDocumentFragment()`.

## DOM-CORE-002 — tree identity and mutation

Nodes have stable object identity. `appendChild()`, `insertBefore()`,
`removeChild()` and `replaceChild()` mutate the existing objects rather than
copying them. A node has at most one parent, cycles are rejected, sibling links
remain exact, and insertion moves an already-parented node. Inserting a
`DocumentFragment` splices its children and empties the fragment.

A Document accepts at most one Element child and no Text child. Cross-document
insertion adopts the inserted subtree into the destination Document.

## DOM-CORE-003 — text content

`CharacterData.textContent` reflects its own data. `Element` and
`DocumentFragment` concatenate descendant Text data and ignore Comment data.
Setting their `textContent` replaces all children with one Text node, or with no
child for an empty string. `Document.textContent` is `null` and setting it has
no effect.

## DOM-CORE-004 — attributes and reflection

Attribute absence is distinct from an empty value:

```text
absent       → getAttribute(name) === null
present ""   → hasAttribute(name) === true and getAttribute(name) === ""
```

HTML attribute names are ASCII-lowercased. `HTMLElement.title` reflects only
the local `title` content attribute: its getter returns the empty string when
the attribute is absent and its setter always creates or updates the attribute.
`HTMLButtonElement.disabled` is a boolean presence reflection.

## DOM-CORE-005 — events and activation

Event dispatch follows capture, target and bubble order through Node parents.
Listeners support capture and once. `stopPropagation()` prevents traversal to
later targets, `stopImmediatePropagation()` also stops remaining listeners on
the current target, and `preventDefault()` only cancels a cancelable event.

`HTMLButtonElement.click()` does nothing while disabled. Otherwise it dispatches
one bubbling, cancelable and composed `click` MouseEvent. Its internal default
activation runs after propagation only when the Event was not canceled.

`HTMLInputElement.click()` follows the same disabled and fieldset-disabled law.
Checkbox and radio activation applies standard pre-click checked state so a
click listener observes the proposed value. Cancellation rolls checkbox
checked/indeterminate and the complete named radio group back inside the same
Document transaction. Accepted state changes then dispatch bubbling `input`
and `change` in that order. Direct property assignments still dispatch no
events.

## DOM-CORE-006 — document mutation adapter

`Document.transaction(callback)` batches connected-tree child, attribute and
character-data mutations. `Document.subscribeMutations(listener)` observes one
immutable batch per outer transaction and returns an unsubscribe function.
Single mutations outside an explicit transaction form a one-record transaction.
Nested transactions flush only at the outer boundary.

The adapter is synchronous and renderer-oriented. It is not a replacement for
the standard asynchronous `MutationObserver`, which remains outside this first
vertical slice.

## DOM-CORE-007 — pointer input interfaces

`UIEvent`, `MouseEvent` and `PointerEvent` use the standard public inheritance
and constructor names. The lean pointer bridge carries viewport and screen
coordinates, button and modifier state, pointer identity, contact geometry,
pressure, orientation, pointer type, primary state, persistent device identity,
and optional coalesced and predicted samples. Constructor defaults follow UI
Events and Pointer Events, including pointer width and height `1` and
`altitudeAngle` `π / 2`.

The DOM package only represents input data and dispatch. Hit testing, coordinate
derivation from rendered geometry, pointer capture, hover state and conversion
of platform input belong to renderer or host adapters.

## DOM-CORE-008 — focus and tab index

`Document.activeElement` stores the currently focused connected HTMLElement.
Focus state is allocated lazily. `HTMLElement.focus()` only focuses a connected,
programmatically focusable element; `blur()` clears that element. A valid
`tabindex` makes an HTMLElement programmatically focusable, while a button is
focusable by default unless disabled. `tabIndex` reflects a signed long content
attribute and returns the HTML default `0` for buttons or `-1` otherwise.

Moving focus dispatches `blur`, `focusout`, `focus`, `focusin` in the order
observed by current browsers. Focus and blur do not bubble; focusin and focusout
do. All four are FocusEvents with the opposite element as `relatedTarget`.
Every committed focus transition also publishes coalesced `focus` and
`focus-within` records through the independent Document state-change channel.
Only the exact old/new focused Elements and the symmetric difference of their
HTMLElement ancestor chains are reported. Attribute mutation is not fabricated.

This target-independent realm has no Window, viewport focus, body element,
scrolling, focus ring, Shadow DOM or navigable. Therefore `UIEvent.view` accepts
an opaque object, `activeElement` is `null` when no HTMLElement owns focus, and
`FocusOptions` are accepted without scroll or visual side effects. These are
declared subset boundaries, not claims of complete browser conformance.

## DOM-CORE-009 — comments and region anchors

`Comment` extends `CharacterData`, has `nodeType === Node.COMMENT_NODE`, and is
created by `Document.createComment(data)`. It participates in the same ordered
tree identity, adoption and character-data mutation laws as other nodes, while
its data is excluded from ancestor `textContent` aggregation.

Comment nodes are the standard semantic anchors for compiled template regions.
The DOM package owns only their tree and data behavior; interpretation of a
region between two anchors belongs to the template mutation program.

## DOM-CORE-010 — input control state

`Document.createElement("input")` returns `HTMLInputElement`. Its `type`,
`defaultValue`, `placeholder`, `disabled`, `readOnly`, `required` and
`defaultChecked` properties reflect their corresponding HTML content
attributes. The `type` getter normalizes supported keywords and returns `text`
for a missing or invalid value.

`value` and `checked` are live control state. Before their first property write,
they follow the corresponding default content attribute. A property write sets
the browser-style dirty state and no longer changes or follows the default
attribute. Checkbox and radio controls without a value attribute expose the HTML
fallback value `on`. The combined dirty/value/checked record is allocated only
after the first live property write.

An enabled connected input is programmatically focusable by default and has
default `tabIndex === 0`; a disabled input ignores `focus()`. Programmatic
`value` or `checked` assignment does not synthesize `input` or `change` events
and does not pretend to be an attribute mutation. A host input adapter updates
the live property and explicitly dispatches the relevant standard event.

Text/search/tel/url/password inputs expose `selectionStart`, `selectionEnd`,
`selectionDirection`, `select()` and `setSelectionRange()`. Indices are clamped
to the current UTF-16 value length; an end before start collapses both to end.
Programmatic value assignment collapses the selection at the new end. Other
input types return null from selection getters and throw `InvalidStateError`
from selection setters/methods. Connected selection changes use the independent
coalesced input state channel and fabricate no select/input event.

This slice does not implement type-specific value sanitization beyond the
declared Number and Range subset, selection/caret paint, files, form ownership, reset,
validation, direct-assignment radio normalization, virtual keyboard or IME host
integration.

## DOM-CORE-011 — modern tree authoring

`Document`, `DocumentFragment` and `Element` expose the standard ParentNode
`append()`, `prepend()` and `replaceChildren()` methods. `Element` and
`CharacterData` expose the standard ChildNode `before()`, `after()`,
`replaceWith()` and `remove()` methods. String arguments become distinct Text
nodes in the receiver's Document; Node arguments retain their identity.

Multi-node operations follow the viable-sibling rules when the receiver or a
sibling also appears in the argument list. Each call runs inside one outer
Document transaction, so all addressed removals, moves and insertions are
observed in one mutation batch. After standard argument conversion,
`replaceChildren()` validates Document hierarchy constraints before its
replace-all phase.

## DOM-CORE-012 — selector queries and static NodeList

`Document`, `DocumentFragment` and `Element` implement `querySelector()` and
`querySelectorAll()`. `Document.getElementById()`, `Element.matches()` and
`Element.closest()` use the same parser. The supported selector grammar is one
compound or a descendant chain composed from tag names, `*`, one `#id`, any
number of `.class` selectors, `[attribute]` and `[attribute=value]`. Attribute
values may be simple unquoted tokens or quoted strings.

Selector lists, child/adjacent/general-sibling/column combinators,
pseudo-classes, pseudo-elements, namespaces and CSS escapes are unsupported
and throw a `SyntaxError` rather than partially matching. `querySelectorAll()`
returns a standard-named immutable, iterable, indexed `NodeList` snapshot in
tree order. It is never a mutable Array and never becomes live after later
tree mutations.

## DOM-CORE-013 — reflected class tokens

`Element.classList` lazily creates one stable `DOMTokenList` object for that
Element. The object stores no parallel class state: every read parses the
current `class` content attribute and every mutation writes that attribute.
It supports indexed access, `length`, `item`, `contains`, `add`, `remove`,
`toggle`, `replace`, `value`, iteration and `forEach`.

Tokens form an ordered set split on ASCII whitespace. Empty tokens throw
`SyntaxError`; tokens containing ASCII whitespace throw
`InvalidCharacterError`. All arguments are validated before any attribute
write, existing-token no-ops emit no mutation, and `classList.supports()`
fails explicitly because `class` has no supported-token registry.

## DOM-CORE-014 — requested scroll state

`HTMLElement.scrollLeft` and `scrollTop` store the renderer-independent
requested offset for each axis. Their default is zero and merely reading or
writing the default allocates no per-element state. Stored values are finite
and non-negative: `NaN` and infinities normalize to zero as in CSSOM View, and
this target's deliberately one-directional first slice also normalizes negative
requests to zero. Returning both axes to zero releases the lazy state.

`scrollTo(options)`, `scrollTo(x, y)`, `scrollBy(options)` and
`scrollBy(x, y)` synchronously update the same state. An omitted `scrollTo`
axis preserves its current offset; an omitted `scrollBy` axis contributes a
zero delta. `behavior: "auto"` and `"instant"` are accepted. Smooth behavior
throws `NotSupportedError`, and unknown behavior throws `TypeError`, before
state changes.

The DOM neither knows scroll range nor computes `scrollWidth`, `scrollHeight`,
client metrics, overflow or clipping. Renderer layout later clamps requested
offsets to its resolved scroll range. Programmatic state writes dispatch no
fabricated `scroll`, `scrollend`, wheel or pointer event.

Connected requested-offset changes are exposed through the renderer-only,
synchronous `Document.subscribeStateChanges()` channel. `StateChangeBatch` is
separate from mutation batches and MutationObserver semantics. One outer
`Document.transaction()` coalesces a target's scroll writes to its original and
final two-axis state; no-op and net-zero changes emit no record. Detached state
changes remain on the element but emit no connected-document record.

## DOM-CORE-015 — wheel input interface

`WheelEvent` extends `MouseEvent` and adds readonly `deltaX`, `deltaY`,
`deltaZ` and `deltaMode` constructor data. `WheelEventInit` extends
`MouseEventInit`; deltas default to zero and `deltaMode` defaults to
`DOM_DELTA_PIXEL`. The standard `DOM_DELTA_PIXEL`, `DOM_DELTA_LINE` and
`DOM_DELTA_PAGE` constants are available on both the class and instances with
values `0`, `1` and `2`.

WheelEvent owns input representation and ordinary DOM capture/target/bubble
dispatch only. Constructing or dispatching one never changes requested scroll
state and supplies no default action. A renderer interaction bridge chooses
the hit target, event flags and units, dispatches the event, checks
cancelability, and only then may apply a scroll request through the standard
HTMLElement API.

## DOM-CORE-016 — input live-state changes

Connected changes to `HTMLInputElement.value`, `checked` and `indeterminate` join the separate
`Document.subscribeStateChanges()` channel. An input record identifies its
exact target and property, and the old and new effective live
values. One outer `Document.transaction()` coalesces independently by
target/property; setting the same effective value and a transaction whose
final value equals its original value emit no record.

Live property writes remain distinct from content attributes: they create no
attribute mutation and synthesize no `input` or `change` event. Writing the
same effective property value still applies the browser-style dirty flag, so a
later `defaultValue` or `defaultChecked` attribute update no longer changes the
live value and remains a mutation record only.

Before a live property becomes dirty, its default content attribute can change
the effective live state. Such a write remains an ordinary attribute mutation
and additionally emits an input state record only when the effective value or
checked state actually changes. This includes `type` changes that enter or
leave the checkbox/radio fallback value `on`. Detached live state is retained
without publishing a connected-document state record, and the existing lazy
combined input-state allocation remains unchanged.

## DOM-CORE-017 — keyboard, input and composition event interfaces

`KeyboardEvent`, `InputEvent` and `CompositionEvent` extend `UIEvent` and carry
readonly constructor data through the same DOM capture/target/bubble path.
`KeyboardEvent` exposes `key`, `code`, `location`, modifier flags, `repeat`,
`isComposing` and `getModifierState()`. Mouse and keyboard events share the
same standard modifier initializer law. `DOM_KEY_LOCATION_STANDARD`, `LEFT`,
`RIGHT` and `NUMPAD` are available on the class and instances with values
`0` through `3`.

`InputEvent` exposes nullable `data`, `inputType`, `isComposing` and an explicit
`dataTransfer === null` boundary. Non-null DataTransfer initialization throws
`NotSupportedError`; `getTargetRanges()` and StaticRange integration remain
unsupported rather than returning fabricated ranges. `CompositionEvent`
exposes its composition `data`, defaulting to the empty string.

These interfaces describe host input; they implement no text-editing default
action. Constructing or dispatching them does not focus a control, change its
live value, proxy a browser/native event, or synthesize another event. A host
input adapter owns native key mapping, composition session ordering and event
flags. After dispatch and cancellation checks, that adapter explicitly updates
the standard input live property when the platform action should edit text.

## DOM-CORE-018 — numeric, range and indeterminate input state

`HTMLInputElement.min`, `max` and `step` reflect their string content
attributes without allocating live input state. Number values accept the
practical HTML floating-point syntax and sanitize invalid strings to the empty
live value. `valueAsNumber` returns the parsed number for Number and Range and
`NaN` for an empty, invalid or inapplicable value. Setting `NaN` runs the
underlying value sanitization; infinity throws `TypeError`; setting a finite
number on a non-numeric type throws `InvalidStateError`.

Range has default minimum `0`, maximum `100` and value `50`. Missing or invalid
live/default values use the midpoint, or the minimum when maximum is below
minimum. Values clamp to the declared range and use practical HTML step
rounding, preferring the value toward positive infinity on a tie. `step="any"`
disables rounding. This slice does not add `stepUp()`, `stepDown()`, validity,
picker UI or rendered slider geometry.

`indeterminate` is a live, non-reflected boolean input property, used by
checkbox presentation. Its default is false; a false no-op allocates nothing,
and a true-to-false cycle releases the combined input state when no dirty value
or checked state remains. Effective connected changes publish an independent
`indeterminate` input-state record and synthesize no attribute, `input` or
`change` event.

Number/Range property writes and effective sanitization changes share the
existing `value` input-state record. Content-attribute changes remain mutation
records; they additionally publish live state only when `type`, `value`,
`min`, `max` or `step` changes the effective value. Dirty/default and
per-target/property transaction coalescing laws remain intact.

## DOM-CORE-019 — select and option state

`Document.createElement("select")` and `createElement("option")` return exact
`HTMLSelectElement` and `HTMLOptionElement` prototypes. Select reflects
`disabled`, `multiple` and unsigned `size`. Option reflects `disabled`,
`defaultSelected`, `label` and `value`; absent or empty label falls back to
collapsed option text, while absent value falls back to that text.

`select.options` returns a new static, immutable `NodeList` snapshot of exact
option descendants in tree order. It is not a live `HTMLOptionsCollection`.
Nested select subtrees are excluded, and this slice defines no optgroup owner
or disabled-group behavior. Selection getters always derive from the current
tree, so inserting, moving or removing options cannot leave stale indices or
object references in the public result.

Option `selected` is live state with browser-style dirtiness, separate from the
`selected` content attribute exposed by `defaultSelected`. Before dirtiness,
attribute changes update live selectedness; afterwards they remain mutations
only. A single select normalizes multiple defaults to the last selected option
and uses the first enabled option as its initial/tree-change fallback. Explicit
`selectedIndex` or `value` writes may select one option or deliberately leave
none selected when no match exists. Multiple select preserves independent
selected options; returning to single mode retains the last selected option.

Connected effective selectedness writes publish coalesced
`OptionSelectedStateChange` records keyed by exact option and property.
Selection properties, default attributes and normalization run inside the
Document transaction boundary. They fabricate no `input` or `change` event;
a host interaction adapter performs cancellation-aware user selection and
dispatch separately. Enabled connected selects are programmatically focusable
with default `tabIndex === 0`; disabled selects ignore `focus()`.

This slice does not implement form ownership/submission, required/validity,
reset, picker UI, `selectedOptions`, live `HTMLOptionsCollection`, indexed
collection mutation, optgroup or selectedcontent.

## DOM-CORE-020 — progress and meter numeric semantics

`Document.createElement("progress")` and `createElement("meter")` return exact
`HTMLProgressElement` and `HTMLMeterElement` prototypes. Their numeric setters
write finite numbers to content attributes using a stable number
representation; `NaN` and infinities throw `TypeError` before mutation. Their
getters parse and normalize current attributes without keeping parallel state.

Progress defaults `max` to `1` when its attribute is missing, invalid or not
positive. Its determinate value is clamped to `0...max`; an absent value
attribute is indeterminate, so `value` returns `0` and `position` returns `-1`.
Any present value attribute is determinate, including one produced by assigning
the current zero value, and `position` then returns `value / max`.

Meter evaluates its six points in dependency order. `min` defaults to `0`;
`max` defaults to `1` and never resolves below min; value clamps to that range;
low defaults to min and clamps to the range; high defaults to max and clamps to
`low...max`; optimum defaults to the midpoint and clamps to `min...max`.
Setter attributes retain finite out-of-range author values while getters expose
the normalized semantic points.

Both elements remain attribute-owned semantic data. Writes use ordinary
attribute mutation batches and fabricate no live state record, DOM event,
animation, layout geometry or paint. Label association and accessibility
projection remain outside this lean slice.

## DOM-CORE-021 — textarea reflected and live value state

`Document.createElement("textarea")` returns the exact
`HTMLTextAreaElement` prototype. `placeholder` and `wrap` reflect string
content attributes; `disabled` and `readOnly` reflect boolean presence.
`cols` and `rows` are positive unsigned reflections with fallback/defaults
`20` and `2`. `maxLength` and `minLength` are non-negative long reflections,
return `-1` when absent or invalid, and throw `IndexSizeError` for a negative
IDL write.

Textarea child text is its `defaultValue`. Newlines exposed through
`defaultValue` and `value` normalize CRLF and CR to LF. Before the first live
value write, `value` derives from current default child text without allocating
state. A value write stores lazy live state, sets the dirty law even when its
effective value is unchanged, and leaves later defaultValue/textContent
mutations unable to replace the live value.

Connected effective value changes publish a coalesced `TextAreaStateChange`
keyed by exact textarea and `value` or `selection`. DefaultValue writes remain
child-list mutations and additionally publish live state only while the value
still follows its default. `selectionStart`, `selectionEnd`,
`selectionDirection`, `select()` and `setSelectionRange()` use the same
clamping/collapse law as text inputs; value writes collapse at the new end and
default text changes clamp an existing non-dirty selection. Live writes create
no attribute mutation and neither path fabricates `input`, `change` or `select`
events. A host text adapter applies native edits and dispatches events
explicitly after its own cancellation and composition logic.

Enabled connected textareas are programmatically focusable with default
`tabIndex === 0`; readonly does not prevent focus, while disabled does. This
slice does not implement selection/caret paint, textLength, hard-wrap form
transformation, required/validity, labels, form ownership/submission, native
editing or resize UI.

## DOM-CORE-022 — labels, fieldsets and legends

`Document.createElement("label")`, `createElement("fieldset")` and
`createElement("legend")` return exact `HTMLLabelElement`,
`HTMLFieldSetElement` and `HTMLLegendElement` prototypes. Label `htmlFor`
reflects the `for` string content attribute. Fieldset `disabled` reflects
boolean presence and `name` reflects its string attribute. Legend introduces
only its exact semantic prototype in this slice.

`label.control` resolves from the current same tree on every read. With a
present `for` attribute it examines the first Element in tree order whose
non-empty ID exactly matches; that element is returned only when it is an exact
supported labelable control. A non-labelable first ID match makes the result
null rather than skipping to a later duplicate. Without `for`, the first
labelable descendant is returned. The supported labelable realm is button,
non-hidden input, meter, progress, select and textarea. Detached same-tree
composition follows the same deterministic rules.

The fieldset disabled law applies to the supported focusable form controls:
button, input, select and textarea. A control under a disabled ancestor
fieldset rejects programmatic focus; button activation is also suppressed.
The first direct legend child and all its descendants are exempt from that
fieldset only. Nested disabled fieldsets and disabled outer fieldsets are
evaluated independently. This effective disabledness never changes a control's
own reflected `.disabled` property or prevents direct programmatic value state
updates.

Label activation, reverse `.labels` collections, forms, fieldset `.elements`,
form ownership/submission, reset and constraint validity are unsupported. The
package exposes none of those members as fabricated null or empty values.

## DOM-CORE-023 — structural list, text and table element interfaces

`Document.createElement()` returns the exact standard prototype for `ul`, `li`,
`p`, `table` and `tr`. The six heading tags share `HTMLHeadingElement`;
`thead`, `tbody` and `tfoot` share `HTMLTableSectionElement`; and `th` and `td`
share `HTMLTableCellElement`. Each object retains its exact requested local
name and otherwise uses the same stable Node identity, attributes, mutation and
event laws as every HTMLElement in this realm.

`HTMLTableCellElement.colSpan` reflects `colspan` with default 1 and getter
range 1 through 1000. `rowSpan` reflects `rowspan` with default 1 and getter
range 0 through 65534, preserving the standard meaningful zero value. The
range limits affect getters, while setters follow unsigned-long conversion and
store any value through 2147483647; values outside that setter range store the
declared default 1. `scope` reflects its string attribute limited on read to
the case-insensitive known values `row`, `col`, `rowgroup` and `colgroup`;
missing and invalid values read as the empty Auto state. The shared interface
exposes the member on both cells even though authoring `scope` on `td` is not
conforming HTML.

This slice intentionally introduces no `HTMLCollection`, `rows`, `cells`,
section/caption accessors, row/cell insertion methods, `cellIndex`, table-model
formation, header assignment, list numbering, `HTMLLIElement.value`, or legacy
alignment and presentation reflections. Unsupported members stay absent rather
than returning fabricated empty collections or indices.

## DOM-CORE-024 — bounded Popover API and visibility state

Every `HTMLElement` exposes the standard `popover`, `showPopover()`,
`hidePopover()` and `togglePopover()` names. In this bounded realm `popover`
reads as null when the attribute is absent, `auto` for the empty or
case-insensitive Auto value, and `manual` for Manual and invalid values. The
setter preserves the supplied string content attribute and removes it for
null. The newer Hint mode is outside this slice; a raw `hint` value therefore
follows this declared invalid-value Manual state until the Hint stack and its
dismissal laws are implemented together.

Popover visibility allocates lazily outside element instance fields.
`showPopover()` requires a connected element with a non-null popover state;
missing support throws `NotSupportedError` and an otherwise valid detached
element throws `InvalidStateError`. Repeating show while already showing and
hide while already hidden are no-ops after the standard expected-state check.
The boolean and dictionary force forms of `togglePopover()` validate even when
the requested state already matches and return the final showing state.
`source` must be an `HTMLElement` from this realm and is carried only for an
opening transition.

Opening fires one non-bubbling, cancelable `beforetoggle` ToggleEvent from
`closed` to `open`; cancellation leaves the popover hidden and emits no state
record or `toggle`. Closing fires a non-bubbling, non-cancelable
`beforetoggle` from `open` to `closed`. Completed transitions queue a
non-bubbling, non-cancelable `toggle` task. Pending toggle tasks coalesce using
the first old state and final new state. `ToggleEvent` exposes exact readonly
`oldState`, `newState` and `source` constructor data; Shadow-DOM retargeting is
not claimed because Shadow DOM itself is outside this realm.

An Auto popover closes unrelated showing Auto peers while preserving its
showing node/source ancestor chain. Manual popovers coexist. Changing a showing
popover to a different reflected state closes it, with transition events;
removing its subtree closes it without fabricated transition events. These are
semantic visibility laws only, not renderer behavior.

Core and other renderer owners read the exact internal visibility through the
public renderer contract
`element[getPopoverVisibilityState](): "hidden" | "showing"`. Each connected
effective change also publishes a synchronous, transaction-coalesced
`PopoverStateChange` with `type: "popover"`, `property: "open"` and boolean
old/new values. There is deliberately no non-standard `popoverOpen` property.

Top-layer ordering and paint, `:popover-open` selector matching, light dismiss,
close requests/watchers, invoker and command attributes, implicit anchors,
autofocus/focus restoration, accessibility projection, Hint stacks, fullscreen
and modal-dialog interaction are unsupported. A renderer consumes the
visibility contract and state records; the DOM does not fabricate callbacks,
geometry, z-order or UI.

## DOM-CORE-025 — bounded image author attributes

`Document.createElement("img")` returns the exact `HTMLImageElement`
prototype. `src` and `alt` reflect their string content attributes without
resolving a URL or allocating fetch state. `width` and `height` reflect
unsigned-long author dimensions; missing, malformed, negative and values above
the supported HTML integer parser range read as zero. Setter conversion follows
unsigned 32-bit Web IDL conversion and writes the resulting decimal attribute.

This semantic slice deliberately exposes no fabricated `currentSrc`,
`complete`, `naturalWidth`, `naturalHeight` or `decode()`. Fetching, URL/base
resolution, decoding, intrinsic metrics and load/error events belong to a host
image adapter. The document renderer may consume the exact reflected `src`,
`alt` and author dimensions without moving network state into the DOM object.

## Initial exclusions

The first slice intentionally excludes parsing, serialization, namespaces,
live collections including live `NodeList`/`HTMLCollection`, the remainder of
Selectors, Shadow DOM, custom elements, CSSOM beyond the declared requested
scroll subset, forms, accessibility projection, tooltip timing, geometry, hit
testing and rendering.

## DOM-CORE-026 — external owner catalog

`packages/dom/.storybook` is development-only owner data, not a production
export or npm package. Its manifest and catalog contain no executable loader,
Storybook import or lifecycle wrapper. Every executable variant names one
static module/export and preserves an exact `dom/...` or `elements/...` leaf.

Category and subject route overrides preserve former category/interface
overviews. Former section overviews are documented as variant grouping
metadata and never select a representative leaf. Unknown routes remain
fail-closed. The runtime adapter receives the exact package-tab Document and
mounts only Nodes owned by that realm.

## DOM-CORE-027 — opaque compiled stylesheet ownership

One Document owns an opaque, ordered set of immutable compiled stylesheet
records `{id, cssText}` independently of its semantic Node tree. Acquisition
deduplicates repeated ids with exact equal CSS and returns an idempotent lease;
the same id with different CSS fails before changing the active set. A record
remains active until the last lease releases it.

Every active-set change advances one monotonic Document-local revision and
publishes one immutable snapshot to synchronous subscribers. Changes inside an
outer `Document.transaction()` are coalesced; acquiring and releasing the same
previously absent record in that transaction publishes nothing. This internal
compiled-style transport does not claim `CSSStyleSheet`, `StyleSheetList`,
`Document.styleSheets` or `adoptedStyleSheets` CSSOM behavior.
