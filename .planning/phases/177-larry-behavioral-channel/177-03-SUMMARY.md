---
kind: summary
phase: 177
plan: 177-03
slug: larry-behavioral-channel
status: complete
---

# 177-03 SUMMARY: BCH-18 single-axis blend threaded to the existing producer

**Outcome:** BCH-18 done, RE-SCOPED correctly. The bundle's "GAP 1" (no role_blend producer
at room birth) was STALE - the producer already ships at room-birth.cjs:426 (Phase 155). No
duplicate producer was built. The real (upstream) work landed: compute a single-axis blend
from the canonical_role scalar and thread it into the existing birthRoom producer.

## Tasks

- Task 1 (commit 5a009ddc): `blendFromCanonicalRole(scalar)` added to
  lib/core/shallow-doc-parser.cjs (exported). Returns `{ <role_key>: 1.0 }` normalized
  against the 7 frozen ROLE_BLEND_KEYS (mirrors persona-override.cjs:280-281); returns null
  for absent/empty/unmappable - never fabricates. Pure, Part-8-clean (role key + 1.0 only).
- Task 2 (this completion, finished in-loop after the executor's connection dropped
  mid-task): lib/core/graph-self-heal.cjs reads an optional `canonicalRole` option, computes
  `computedBlend = blendFromCanonicalRole(canonicalRole)`, and threads `roleBlend` +
  `canonicalRole` into birthRoom's opts ONLY when present (null -> birthRoom's default {}
  cold-start neutral path, room-birth.cjs:350). test-bch-18-persona-write.cjs replaced its
  scaffold stub with 17 real assertions (helper unit + degrade + the threading + the
  re-scope guard that graph-self-heal does NOT call writeUserMdAtomic directly + the
  existing-producer proof + Part 8 scalar-only).

## Verification

- test-bch-18-persona-write: RED stub -> GREEN (17/17).
- run-all-177: 6 pass / 8 fail -> 7 pass / 7 fail.
- Regression: tests/test-sentinel-self-heal.cjs 4/4 green; graph-self-heal loads clean.
- Frozen sets untouched (reach-ids 6, posture-ids 3 fences green); test-bch-14 Part 8 fence
  still green; no Brain wire opened; no em-dashes.

## Note

The gsd-executor for this plan dropped on an API connection error mid-Task-2 (after the
Task-1 commit and after editing graph-self-heal.cjs but before replacing the test stub /
committing). Per the GSD spot-check fallback, the orchestrator verified state via git +
filesystem and completed Task 2 in-loop: the executor's graph-self-heal.cjs threading was
correct and complete, so only the test replacement, the gate run, the commit, and this
SUMMARY remained.
