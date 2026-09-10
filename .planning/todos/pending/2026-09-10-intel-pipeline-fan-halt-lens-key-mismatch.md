---
created: 2026-09-10
title: "intel-pipeline fan halts with no lenses: extractContext called positionally and lens_set never translated to lensSet"
area: intelligence-layer
files:
  - lib/core/intel-pipeline.cjs
  - lib/mcp/tool-router.cjs
  - lib/lens-engine/source-lens-driver.cjs
  - lib/core/research-context-extractor.cjs
source: "Windows QA session RCA (C:\\Users\\jsagi\\handoffs\\RCA-intel-pipeline-fan-halt.md, found on beta.29, reported persisting in beta.31); confirmed by reading on main 2026-09-10"
status: pending
---

## Problem

`lib/core/intel-pipeline.cjs:117-121` drives the source-lens fan with two contract mismatches:

1. `extractor.extractContext(context.roomDir, { dimension })` passes a string positionally, but
   `research-context-extractor.cjs:253` is `function extractContext(opts)` (one object; reads
   `opts.roomDir`, `opts.topic`, `opts.db`). The extractor therefore sees no roomDir.
2. `lensDriver.runSourceLens(Object.assign({ dimension }, extracted || {}))` spreads the extractor's
   `lens_set` (snake case, :278) into the driver, but `source-lens-driver.cjs:445` reads
   `opts.lensSet` (camel case). `rawLensSet` is `[]`, so the fan runs with no lenses and returns no
   findings (quality 'low'), which reads as a silent halt.

The MCP path does it right: `lib/mcp/tool-router.cjs:550-558` calls `extractContext({ roomDir, topic, db })`
and then `runSourceLens({ roomDir, topic, lensSet: extracted.lens_set, preflight: extracted.preflight,
stage: 'explore', db })`. `/mos:intel-pipeline` (the CLI command path through intel-pipeline.cjs) is the
broken caller; there is no third caller (grep 2026-09-10).

Neither `tests/test-223-intel-pipeline.cjs` nor `tests/test-265-intel-roster-fan.cjs` passes a lens set
through `runSourceLens`, which is why the defect was never caught.

## Fix shape (small)

Mirror tool-router's translation in intel-pipeline.cjs: `extractContext({ roomDir: context.roomDir,
topic: <dimension or the pipeline's topic>, db })`, then `runSourceLens({ roomDir, topic, lensSet:
extracted.lens_set, preflight: extracted.preflight, stage, db, dimension })`. Add one test that asserts
the driver receives a non-empty `lensSet` from the intel-pipeline path (an injected `runSourceLens`
spy, zero network). Consider a shared adapter so the two callers cannot drift again (Canon Part 7).

## Notes

- Reported by the Windows QA session as "Defect 1" of two; "Defect 2" is in that session's RCA file
  and is not reproduced here yet.
- Belongs with the intelligence-layer work (Phase 342 catalogs list intel-pipeline as a CLI-only engine
  with no MCP registration); fix before Theo is taught to recommend `/mos:intel-pipeline`.
