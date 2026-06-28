---
kind: summary
phase: 185
slug: drift-runtime-reachability
milestone: v1.15.0
created: 2026-06-28
canon_parts: [11]
requirements: [DRIFT-01]
status: built-not-committed
one_liner: "doctor --drift gains a RUNTIME-reachability assertion (Class R): it FAILS NON-ZERO when a capability is WIRED in the connector registry but the Phase-184 decide()-time projection reader can never surface it -- closing the merge-time-only hole the canon concedes at CIRS R7 / Appendix-D entries 19/27; deterministic, LOCAL-only, calibrated GREEN on the shipped artifacts."
requires:
  - lib/core/reader/decide-projection-reader.cjs (Phase 184)
  - lib/core/navigation-engine.cjs (decide projection_offer, Phase 184)
  - data/connector-registry.json
  - data/brain-orchestration-projection.json
provides:
  - lib/core/drift-runtime-reachability.cjs
  - doctor --drift Class R (runtime-reachability)
  - report.checks['runtime-reachability']
affects:
  - scripts/doctor.cjs
---

# Phase 185: DRIFT Runtime Reachability Summary

`doctor --drift` now performs a RUNTIME-reachability assertion. Where the prior
`--drift` did MERGE-TIME marking only (Class P prose-vs-code + Class Q
gsd-record), Class R asks the question the canon concedes is unanswered at CIRS
R7 (Part 11) / Appendix-D entries 19/27: **is a WIRED capability actually
reachable by `decide()` at runtime?** When a capability is WIRED in the connector
registry but the Phase-184 decide()-time projection reader can never surface it,
`doctor --drift` FAILS (non-zero) with a named drift finding.

## The reachability predicate (the exact code definition)

A capability is **unreachable by `decide()` at runtime** when it is WIRED in the
connector registry (`connects_to_spine === true`) AND of a reader-eligible kind
(`command` or `agent` -- the kinds the orchestration projection grants a
`ranking` block), BUT the Phase-184 reader's deterministic ranker
(`rankCapabilities`, the exact read `decide()` performs) does NOT emit a candidate
for its projection node. Concretely the three failure reasons:

- `no_projection_node` -- the projection has no node for this WIRED surface.
- `no_ranking_block` -- a node exists but carries no `ranking` block, so the
  reader can never rank it.
- `reader_skipped` -- the whole projection fails the reader R2 correctness gate,
  so `decide()` skips the offer this turn (every WIRED eligible capability is
  unreachable).

Reader-eligibility is scoped to `command` + `agent` because the projection grants
`ranking` blocks to those kinds and never to skills (skills are trigger-wired
auto-activation surfaces, not Shape-F decision-gate options). This scoping is what
keeps the assertion calibrated GREEN on the shipped artifacts: 85 WIRED
command/agent capabilities, all 85 reader-emitted; the 5 WIRED skills are
correctly not counted.

The predicate leans DIRECTLY on the Phase-184 reader (Part 7 reuse): the same
`loadProjection` / `validateProjection` / `rankCapabilities` that
`lib/core/navigation-engine.cjs` decide() uses to set `trace.projection_offer`.
"Reachable" means "reachable by the real decide() read", never a re-implementation.

## What shipped

### Files created
- `lib/core/drift-runtime-reachability.cjs` -- the assertion.
  `checkRuntimeReachability(opts)` (the entry: loads the registry + projection,
  runs the reader R2 gate, enumerates the reader's full producible set via
  `rankCapabilities` at a large limit, asserts every WIRED reader-eligible
  capability is emitted), `loadRegistry`, `wiredEligibleConnectors`,
  `projectionNodeIdForSurface`. Requires ONLY `node:fs` + `node:path` + the
  Phase-184 reader (itself LOCAL-only). Never throws.
- `tests/test-drift-runtime-reachability-185.cjs` -- 11 assertions: RED
  (no_ranking_block, no_projection_node, reader R2-gate failure), GREEN (injected
  + the real shipped artifacts), skill-scoping, doctor exit-code (RED non-zero +
  GREEN exit 0), additive (Class P + Q still present under --drift), Part 8
  no-network sweep over the module code, no-em-dash sweep.
- `tests/run-all-185.sh` -- the phase aggregator (Passed/Failed summary, non-zero
  exit on failure).
- `.planning/phases/185-drift-runtime-reachability/185-CONTEXT.md` (canon_parts
  [11]; cirs_relationship block -- this phase CONSUMES the spine, adds no surface).

### Files modified
- `scripts/doctor.cjs` -- three additive edits:
  1. Class R block under `flags.drift` (after Class Q): calls
     `checkRuntimeReachability` and records `report.checks['runtime-reachability']`.
     Soft-fail (a throw records an `error` finding, never crashes doctor). Hermetic
     test seams: `MOS_TEST_REACHABILITY_REGISTRY` / `MOS_TEST_REACHABILITY_PROJECTION`.
  2. A narrow non-zero exit branch in `_finalizeAndExit`, evaluated BEFORE the
     `classFlagsActive` graceful-degradation exit-0: when the runtime-reachability
     check is `warn`, exit 1. Scoped to the runtime-reachability key (populated only
     under `--drift`), so it never alters any other class-flag run's exit code.
  3. `--drift` usage text extended with the Class R line.

## How the hard signal works (non-zero without regressing exit-0)

`--drift` is a class flag, so `classFlagsActive` is true and `_finalizeAndExit`
normally returns exit 0 (the graceful-degradation invariant). The new branch sits
BEFORE that return and fires ONLY on `report.checks['runtime-reachability'].status
=== 'warn'`. Because that key is populated only under `--drift` and the real
artifacts are fully reachable (status `ok`), a real `doctor --drift` stays exit 0
-- no regression -- while a genuine runtime-unreachable WIRED capability flips it
to exit 1. An indeterminate computation (`error`, e.g. a missing artifact) falls
through to exit 0; an internal error is not a drift FAIL.

## Test results

- `bash tests/run-all-185.sh` -> Total 1, Passed 1, Failed 0 (11 assertions).
- `bash tests/run-all-150.9.sh` -> 6/6 (the existing --drift gate: Class P + Q
  suites + the Part 8 zero-egress floor + the deadlock carve-out `doctor --drift`
  exits 0 -- all green; the carve-out holds because the real artifacts are
  reachable). NO regression.
- `node tests/test-doctor-class-p.cjs` -> 4/4. `node tests/test-doctor-class-q.cjs`
  -> 7/7. NO regression to the merge-time marking.
- `bash tests/run-all-184.sh` -> 2/2 (the reader this phase leans on is intact).

## Frozen-contract confirmation

MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 RECOMMENDED gate, the 6-reach bank, and the
dial glyphs are UNTOUCHED -- this phase added a doctor check and a LOCAL helper, it
touched no dial/selector code. No edge/node/reach minted; no Brain wire opened.

## Part 8 / boundary

Zero Brain egress, zero network. The module reads two committed LOCAL artifacts via
the LOCAL-only Phase-184 reader. The Part 8 floor over `scripts/doctor.cjs` added
lines (run-all-150.9.sh) holds (no `fetch|http|curl|brain|tavily` token in the new
lines). The module-code sweep finds no live network/egress call site.

## Deviations from Plan

None affecting the deliverable. One process note: the first run of
`tests/run-all-150.9.sh` failed its Part-8 floor because a new `doctor.cjs` comment
named the projection FILENAME (the literal token `brain-...-projection.json` matched
the floor's `brain` token set). The comment was reworded to "the orchestration
projection (both committed LOCAL artifacts)" with no semantic loss; the floor then
held green. No code path changed.

## Known Stubs

None. The assertion is fully wired and green; the predicate is deterministic and
exercised by RED + GREEN + scoping + doctor-exit-code tests against both injected
fixtures and the real shipped artifacts.
