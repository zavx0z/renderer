# Platform capability workflow

This workflow is mandatory for every task that changes or depends on observable
behavior in DOM, HTML, CSS, the React-shaped runtime, Template/TSX, the CPU
Renderer, Browser adapters, WebGPU, DevTools, Engine, or their consumers.

The capability matrix is a live map of the platform's proven current state. It
is not a separate audit that must be completed before development. Each real
task reads only the affected part of the map and leaves that part consistent
with the result.

## Required cycle

```text
task
→ affected capabilities
→ current matrix state
→ implementation
→ checks and evidence
→ update only affected capability records
→ validation
```

A task is complete only when the matrix no longer contradicts the behavior that
the task actually delivered.

## Before changing code

1. Identify the capability IDs directly affected by the task and by its required
   downstream stages.
2. Read those records in `capabilities.index.json` and in the true owner's
   `support.json`.
3. Note their current `status`, `conformance`, owner/stage, limitations,
   evidence, consumers, and blockers.
4. Read relevant entries in `GAPS.md` or `CONTRADICTIONS.md` only when they
   concern the task.

Do not re-audit the complete matrix. Do not change unrelated records.

If the required platform contract has no capability record, add it through the
true owner's existing inventory/support source with an honest initial status.
Do not create a second registry.

If a consumer has reproduced behavior beyond the current record, create or
update a gap that validates against `specifications/gap.schema.json`. Record at
least the capability ID, expected behavior, actual behavior, reproduction,
affected consumer, and suspected owner.

Static source usage is not yet a reproduced gap. Template and other analyzers
emit neutral capability usages; `scripts/capabilities/consumer-check.ts` joins
them to the exact matrix snapshot and emits records that validate against
`specifications/capability-request.schema.json`. Every generated request carries
`runtimeGapProven: false` and consumer-usage evidence whose `doesNotProve`
explicitly excludes runtime failure, severity, implementation, and conformance.

Request disposition is fail closed:

- `implemented/exact` passes for standard/reference capabilities;
- `implemented/extension` passes only for an explicit `project-contract`;
- `partial`, `unsupported`, `unverified`, `not-applicable`, missing, and
  ambiguous rows produce a request and diagnostic;
- `report` records diagnostics without failing;
- `strict` blocks missing, ambiguous, unsupported, unverified, and
  not-applicable requests while leaving conformance requests visible but
  nonblocking for staged migration;
- `exact` returns failure for every request and is the long-term target.

An owner reproduces the submitted behavior before promoting a request to a
`gap`. A request must never be copied into `audit-findings.json` as an observed
runtime fact without that reproduction.

## Implementation law

- Implement generic behavior in the true owner, not as a consumer-specific
  workaround.
- Carry the change through every stage required for observable behavior. A DOM
  API is not complete when Renderer, Browser, WebGPU, or Engine stages required
  by the contract are still missing.
- For a reproduced observable gap, add a generic failing conformance test before
  or together with the implementation when feasible. Closure always requires a
  passing behavioral proof.
- Keep the change vertical and minimal. Do not implement adjacent capabilities
  merely because they are nearby in the matrix.
- Consumer TSX, styles, stories, or product code must not conceal a missing
  generic platform capability.

For structured component-to-platform handoffs, also follow
`PLATFORM-OWNER.md`.

## Evidence and classification

Use the strongest evidence available for the claimed behavior:

```text
conformance test
→ integration test
→ focused owner test
→ browser/live reproduction
→ implementation source
```

Implementation source can prove that a path exists; by itself it does not prove
observable conformance. Every evidence record must state both what it proves and
what it does not prove.

Status rules:

- `implemented` — the complete contract represented by that record is
  implemented and behaviorally proven.
- `partial` — useful behavior exists, but a material limitation remains. Record
  the limitation explicitly.
- `unsupported` — the capability is absent.
- `unverified` — implementation may exist, but sufficient evidence does not.
- `not-applicable` — the capability genuinely does not apply; include the
  reason.

Conformance rules:

- `exact` requires proven observable equivalence to the claimed standard
  contract within the boundaries of the record.
- The presence of a matching name, type, class, method, source branch, or a
  consumer that no longer crashes is not enough for `exact`.
- Use `adapted`, `extension`, `none`, or `unknown` whenever that is the honest
  result.

## Updating the matrix

After implementation and checks:

1. Update only the affected owner records.
2. Keep `status`, `conformance`, stages, limitations, evidence, consumers,
   blockers, and `lastVerified` consistent with the proven result.
3. Use the owner's existing generator or support source. Do not manually edit a
   generated aggregate as an independent source of truth.
4. Run the existing capability regeneration and validation required by the
   affected owner.
5. Run focused owner checks and the affected consumer checks.

Do not redesign audit tooling during an ordinary feature task unless the task
explicitly requires that infrastructure work.

A task that only uses an already proven capability does not need an artificial
status transition. Report the capability as used without change.

## Completion checklist

Before the final response, verify:

```text
[ ] Affected capability IDs were identified.
[ ] Their initial state was read from the matrix and owner overlay.
[ ] Generic behavior was changed in the true owner.
[ ] Required downstream stages were completed.
[ ] Observable behavior has executable evidence.
[ ] Affected records reflect the actual result.
[ ] Known limitations remain explicit.
[ ] Unrelated capability records were not changed.
[ ] Focused owner and affected-consumer checks were run.
```

The final report must include a compact capability section:

```text
Capabilities:
- <id>: <old status/conformance> → <new status/conformance>
- <id>: used without matrix change

Gaps:
- closed
- discovered and remaining

Evidence:
- tests, reproduction, source, benchmark, or browser evidence
```

## Core principle

> The capability matrix does not replace code and does not require the whole
> platform to be implemented in advance. It is the living map of what the
> platform has actually proven. Every real task reads the relevant part of that
> map, performs the work, and leaves the same part truthful.
