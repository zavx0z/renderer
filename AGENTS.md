# Renderer agent rules

- Before any task that changes or depends on observable platform behavior, read
  `PLATFORM-WORKFLOW.md` and follow its capability-matrix cycle.
- Inspect only the capability records affected by the task in
  `capabilities.index.json` and the true owner's `support.json`. Do not start a
  global re-audit and do not modify unrelated records.
- Do not upgrade `status` or `conformance` from source presence alone.
  Observable behavior requires executable evidence; `exact` requires the
  claimed standard behavior.
- Fix generic platform gaps in the true owner and through every required
  downstream stage. Do not hide a platform gap in consumer TSX, styles,
  stories, or product code.
- For structured component-to-platform handoffs, also follow
  `PLATFORM-OWNER.md` and validate gaps against
  `specifications/gap.schema.json`.
- Preserve the supplied checkout, unrelated changes, linked module identity,
  listeners, browser targets, and active runtime sessions. Run focused owner
  and affected-consumer checks. Do not redesign the audit tooling unless the
  task explicitly requires it.
