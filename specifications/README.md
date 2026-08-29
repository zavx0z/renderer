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

`capabilities:support` is a bootstrap/audit-maintenance command. It writes every
owner row explicitly and is deliberately not part of normal generation. After
an external inventory changes, review every new row before accepting the
overlay; `missing` must never be repaired by a generator default.

React 19.2 is a reference profile only. It does not authorize npm React,
ReactDOM, Fiber, a reconciler or a persistent virtual DOM.
