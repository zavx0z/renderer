# Platform capability inventory

This directory is the pinned, audit-only specification input for the platform
owner. Production packages do not import it.

Canonical roles:

- `sources.lock.json` records exact external source versions, digests and
  retrieval methods.
- `dom/`, `html/`, `css/`, `react-19.2/` and `tsx/` are generated inventories.
- `platform/` is the generated public-export and bounded owner inventory.
- owner `support.json` files are explicit audited overlays. Normal generation
  never invents a missing support row.
- `consumer-demand.sources.json` is the reviewed source-location input;
  `consumer-demand.json` is its verified projection.
- `capability-request.schema.json` defines generated consumer requests. Requests
  prove demand only and are deliberately distinct from reproduced gaps.
- `audit-findings.json` owns gap, contradiction, historical-claim and benchmark
  audit records.
- `capabilities.index.json` at repository root is the canonical joined matrix.

Commands:

```sh
bun run capabilities:refresh   # explicit network refresh of pinned snapshots
bun run capabilities:inventory # rebuild spec/public-export inventories
bun run capabilities:demand    # verify and derive consumer demand
bun run capabilities:generate  # validate and regenerate index/reports
bun run capabilities:check     # typecheck plus deterministic audit tests
```

Consumer builds can join the neutral manifest emitted by
`@zavx0z/template/compiler` directly to an explicit matrix snapshot without a
hand-authored intermediate file:

```sh
bun run capabilities:consumer-check -- \
  --matrix /absolute/path/to/capabilities.index.json \
  --source /absolute/path/to/template-capability-usages.json \
  --output /absolute/path/to/capability-requests.json \
  --source-format template \
  --policy strict \
  --repository ui \
  --package @ui/components \
  --subject governed-components \
  --scope production \
  --revision <exact-consumer-revision>
```

The version 2 Template manifest is the serialized result of
`createCapabilityUsageManifest(...)` / `serializeCapabilityUsageManifest(...)`.
The resolver also accepts its own enriched usage envelope with
`--source-format usage`; `auto` detects either form. `report` writes the same
machine-readable requests and human diagnostics but exits successfully.
`strict` blocks missing, ambiguous, unsupported, unverified, and not-applicable
requirements while reporting conformance drift; `exact` blocks every request.

The neutral `standardLibrary: "lib.dom"` provenance also permits one explicit
source-version alias: TypeScript 7.0.2's historical `HTMLOrSVGElement` maps to
the pinned WHATWG `HTMLOrSVGOrMathMLElement` mixin. The alias is not applied to
unqualified or consumer-defined interfaces.

`capabilities:support` is a bootstrap/audit-maintenance command. It writes every
owner row explicitly and is deliberately not part of normal generation. After
an external inventory changes, review every new row before accepting the
overlay; `missing` must never be repaired by a generator default.

React 19.2 is a reference profile only. It does not authorize npm React,
ReactDOM, Fiber, a reconciler or a persistent virtual DOM.
