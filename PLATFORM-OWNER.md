# Platform owner gap workflow

For every incoming component gap:

1. Read the exact row in `capabilities.index.json` and reproduce the submitted
   scenario.
2. Decide whether it is a platform capability gap or incorrect use of an
   existing public API.
3. If it is a platform gap, add a failing generic conformance test in the true
   owner, implement every required downstream stage, preserve one semantic tree
   and retained `(semantic node, display key)` identity, then update the owner
   overlay and evidence.
4. If it is component misuse, do not change the platform. Return the exact
   existing DOM/CSS/TSX API and remove the local workaround in the component
   task.
5. Run affected owner and consumer checks. A row becomes `implemented` only
   when runtime code, observable behavioral tests and every required downstream
   stage are complete.

Component agents submit gaps that validate against
`specifications/gap.schema.json`, using `specifications/gap.example.json` as the
shape. They may change component TSX/styles/tests/stories, but may not implement
DOM, Renderer, Browser, WebGPU, React-shaped runtime, Template compiler or
Engine behavior locally.

Automated builds submit capability requests, not gaps. A request validates
against `specifications/capability-request.schema.json`, records only the exact
consumer usage and matrix snapshot, and always has `runtimeGapProven: false`.
For such an input the owner first resolves any missing/ambiguous leaf and
reproduces the requested behavior. Only then may the owner create a separate
`gap.schema.json` record with actual evidence, reproduction, severity, and the
confirmed owner. `unsupported` may justify an implementation request, but it is
still not evidence that the submitted consumer scenario was executed.

The handoff result must name the capability ID, owner/stage, semantics, tests,
matrix transition, unblocked consumers and remaining limitations.
