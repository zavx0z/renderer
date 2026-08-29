# Performance baseline

The numeric runs below are historical evidence. Current reproduction status is
generated in `CONTRADICTIONS.md`; in the 2026-08-29 audit the DOM/components and
instance-batch routes reproduced, while `bench/renderer.ts` and
`bench/transform.ts` were blocked by root module resolution. Do not treat an
old number as current acceptance without rerunning its exact command.

The benchmark scripts are diagnostics, not universal thresholds:

```bash
bun bench/dom-memory.ts 100000 dom-empty
bun bench/dom-memory.ts 100000 dom-title
bun bench/dom-memory.ts 100000 closures
bun bench/renderer.ts 10000 500 50
bun bench/transform.ts 1000 500 50
```

One local Bun 1.4 / Intel macOS run on 2026-08-27 produced:

| Case | Time | Retained JS heap |
|---|---:|---:|
| 100,000 empty `HTMLDivElement` objects | ~39 ms | ~189 B/node |
| 100,000 per-instance closure objects | ~52 ms | ~312 B/node |
| 100,000 titled elements with unique text | ~128 ms | ~497 B/node |
| initial 10,000-row CPU frame | ~302 ms | 20,001 boxes / 10,000 display items |
| clean 10,000-row flush | ~0.020 ms | exact previous frame identity |
| cold first indexed leaf update | ~24.8 ms | builds frame-local lookup indexes once |
| warm fixed-row leaf update p50 | ~0.096 ms | 500 samples after 50 warmups |
| warm fixed-row leaf update p95 | ~0.322 ms | target `< 16.7 ms` |
| warm fixed-row leaf update p99 | ~2.331 ms | max sample ~13.161 ms |

Three additional post-gate 500-sample process runs observed initial frames
between roughly `268–306 ms`, cold first indexed updates between `20.8–37.3
ms`, and warm p95 between `0.188–0.322 ms`. The acceptance claim uses the worst
observed warm p95, not the best run.

After the bounded `position` layout slice, a fresh 500-sample regression run
observed an initial frame of `367.4 ms`, a clean flush of `0.018 ms`, a cold
first indexed update of `21.0 ms`, and warm p50/p95/p99 of
`0.026/0.201/0.286 ms`. The added full-frame positioning projection therefore
does not change the accepted warm dirty-leaf `< 16.7 ms` gate or clean exact
frame identity. An accidental quadratic flex child lookup found during this
gate was removed before acceptance.

The bounded transform compositor has a separate combined CPU-frame plus
retained-backend gate. A 1,000-Rect run with 500 samples after 50 warmups
measured p50 `5.106 ms`, p95 `7.908 ms`, p99 `8.691 ms` and max
`13.737 ms`. A final post-workspace run improved those values to p50
`5.183 ms`, p95 `7.551 ms`, p99 `8.506 ms` and max `9.711 ms`. Every
semantic/display composite identity, Mesh, PlaneGeometry and
material remained exact; geometry invalidations were zero. The benchmark
alternates root translate/scale through the transform-only Core patch and then
applies the resulting frame to the production WebGPU backend, so it measures
the complete retained update rather than parser time alone.

After the deterministic typography slice, the 10,000-row/500-sample text
regression measured an initial frame of `300.619 ms`, clean exact-identity flush
of `0.014 ms`, cold indexed update of `13.866 ms`, and warm p50/p95/p99 of
`0.027/0.172/0.229 ms` (max `5.397 ms`). Inherited line-height resolution,
Unicode code-point counting, per-gap letter spacing and ellipsis equivalence
therefore remain inside the existing `< 16.7 ms` warm dirty-leaf gate.

After the generic world-space DocumentPlane slice, the unchanged 1,000-Rect
combined transform/backend gate measured p50/p95/p99
`5.048/7.656/8.280 ms` with max `10.129 ms`. Every retained identity remained
exact and geometry invalidations stayed at zero. The O(1) plane adapter is not
part of this semantic/display update loop, and its addition did not change the
accepted transform identity law.

The final post-retirement audit on 2026-08-28 repeated the default diagnostic
runs after SpaceRuntime overlays, camera gestures, DPR2 and title scheduling:
empty DOM remained `189.30 B/node` versus `312.21 B/node` for per-instance
closure objects, and titled nodes remained `497.46 B/node`. The 10,000-row
frame measured initial `434.73 ms`, clean exact-identity `0.016 ms`, cold
indexed update `20.43 ms`, and warm p50/p95/p99
`0.128/0.349/4.484 ms` across 100 samples after 20 warmups. The final
1,000-Rect transform/backend run measured p50/p95/p99
`6.859/10.770/18.541 ms`; all semantic and retained identities were
preserved and geometry invalidations remained zero. The accepted p95 gates
therefore remain below one 60 Hz frame on this Intel host.

These numbers demonstrate the implementation law, not a browser comparison:

- standard interface names and prototype methods create no duplicate method
  closure per node;
- unused attributes, listeners, `classList`, focus, scroll and control state are
  absent or WeakMap-backed;
- adding a title allocates its actual string and attribute storage, as expected;
- the clean frame is constant-time;
- fixed-row incremental frames use indexed identity lookup, chunked readonly
  Array facades and a persistent node-map override. Old frames remain immutable
  while one warm leaf update shares every untouched chunk and stays below the
  16.7 ms p95 gate on this machine.

## 10,000-row incremental profile

Before this slice, a repeated warm run (`100` samples, `20` warmups) measured
approximately p50 `15.07 ms`, p95 `18.45 ms`, p99 `19.57 ms`. A 300-sample Bun
CPU profile attributed `76.9%` of total sampled time (`~4.48 s`) to freezing
the newly copied 20,001-entry boxes and 10,000-entry display arrays. Remaining
linear costs included `indexOf`/display scanning and cloning the complete
20,001-entry node map.

The accepted representation keeps the public `readonly T[]` contract and
ordinary Array behavior through an Array Proxy backed by 256-entry persistent
chunks. Numeric lookup, iteration, spread, `at`, `find`, `filter`, `map`,
`slice`, `indexOf`, `Object.keys`, `in` and `Array.isArray` remain observable as
Array operations. Every write/delete/define/mutating method is rejected. The
collection facade itself intentionally does not report `Object.isFrozen`; its
records are frozen and its private chunks are never exposed or mutated.

Full frames lazily acquire WeakMap-backed box and `(node,key)` display indexes
on the first eligible incremental update. Later updates clone one chunk and one
small persistent map override instead of copying or freezing complete exposed
collections. This explains the separately reported cold first update; the
requested acceptance gate is repeated warm p95.

## Open acceptance gates

1. Add browser native-DOM and device WebGPU measurements with the same data,
   while keeping native C++ DOM memory separate from JS heap measurements.
2. Reduce or precompute the one-time cold frame-index construction without
   moving hidden O(n) work into every initial frame.
3. Profile text geometry and GPU submission separately from CPU layout.
4. Record small product-shaped Inspector/Node-editor budgets in addition to
   synthetic large trees.

No class-versus-function choice is accepted from syntax alone. A component
factory may be a function; observable DOM runtime types use prototypes; only
measured per-instance state and pipeline work decide performance.
