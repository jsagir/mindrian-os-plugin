---
phase: quick-260917-ild
plan: 01
subsystem: eureka / part8-egress-guard
tags: [part8, egress-guard, legacy-purge, scaffold-exclusion, tdd]
dependency-graph:
  requires: [quick-260917-dgf, phase-218, phase-219-02]
  provides: [isShimBackedBrainTool, scaffold-template-index, bounded-legacy-purge]
  affects: [scripts/part8-egress-guard-hook.cjs, scripts/entity-extract.cjs, lib/core/navigation/typed-entity.cjs]
tech-stack:
  added: []
  patterns: [content-based template matching, proof-not-pattern deletion, additive re-export]
key-files:
  created:
    - lib/core/eureka/scaffold-template-index.cjs
  modified:
    - tests/test-260917-dgf-part8-hook-disposition.cjs
    - lib/core/brain-response-sanitize.cjs
    - scripts/part8-egress-guard-hook.cjs
    - tests/test-eureka-scaffold-entity-noise.cjs
    - lib/core/navigation/typed-entity.cjs
    - scripts/entity-extract.cjs
    - lib/core/navigation.cjs
    - lib/core/navigation/room-birth.cjs
    - lib/core/feynman/feynman-seed-writer.cjs
    - tests/run-all-218.sh
decisions:
  - "Fixed the LEGACY_DESCRIBES_EDGES_SQL column name from the plan's literal edge_type to the real schema column type (edges table has no edge_type column; writeEdge writes to `type`). Verified live against a real seeded room before proceeding."
metrics:
  duration: "~2.5 hours"
  completed: "2026-09-17"
---

# Phase quick-260917-ild Plan 01: Eureka legacy purge + scaffold exclusion + Part 8 hook narrowing Summary

Closed all four findings (F1-F4) of the 2026-09-17 Codex adversarial review: narrowed the Part 8 ambiguous-verdict allow to shim-backed Brain scopes only, bound the legacy entity purge to proven scaffold-only provenance with review-state and run-scope guards, and replaced kind+basename scaffold exclusion with content-based template matching that preserves authored content.

## What Was Built

**Task 1 (F1) — `lib/core/brain-response-sanitize.cjs` / `scripts/part8-egress-guard-hook.cjs`:** Added `isShimBackedBrainTool` (route predicate) beside the byte-unchanged `isBrainTool` (trust predicate). The Part 8 hook's ambiguous-verdict branch now consults the route predicate instead of the trust predicate, so `mcp__pws-brain-mcp__*` (a direct HTTPS connector with no local plugin code in its path — `lib/mcp/brain-composition-census.cjs`'s ruling) returns to exit 2 on ambiguity. Only the two scopes that provably reach `bin/mindrian-brain-mcp-client.cjs` (`mcp__mindrian-brain__*` project scope, `mcp__plugin_mos_mindrian-brain__*` plugin scope) keep the allow.

**Task 2 (F2, F3) — `lib/core/navigation/typed-entity.cjs` / `scripts/entity-extract.cjs`:** `purgeLegacySelfReferentialEntities(db, opts)` now requires `opts.scaffoldKinds` and deletes a candidate row only when it has at least one DESCRIBES edge and EVERY target resolves to a scaffold-kind `memory_artifact` (proof, not pattern — a mixed scaffold/non-scaffold edge set, or zero edges, keeps the row). The review_status candidate filter narrowed from "not confirmed" to "proposed or NULL only" (a `rejected` row is no longer even a candidate — Canon Part 9). The purge call site moved from the top of `runExtraction` to immediately after the batch `COMMIT` succeeds, guarded to full-room runs only (`options.paths` absent). `status.json` gains `legacy_entities_kept` and `legacy_purge_skipped`.

**Task 3 (F4) — `lib/core/eureka/scaffold-template-index.cjs` (new):** A load-time-built content index derived from `templates/room-skeleton/*.tmpl` (ROOM/STATE/MINTO/USER) plus the BRAIN and FEYNMAN bodies additively exported from `lib/core/navigation/room-birth.cjs` (`BRAIN_STUB_TEMPLATE`) and `lib/core/feynman/feynman-seed-writer.cjs` (`FEYNMAN_DEFAULT_SEED`) — both extractions are byte-identical, no-behavior-change (verified against `tests/test-room-birth.cjs` 35/35 and `tests/test-150-feynman-readback.cjs`). `collectArtifacts` now excludes a scaffold candidate only when its body matches the shipped template byte-for-byte (post-normalization, frontmatter-stripped, token-aware); a body that differs has its authored remainder (`stripTemplate`) pushed as extraction input instead, and the frontmatter metadata pass now runs for BOTH the template-identical branch (via the new `artifacts.metadataOnly` sibling list) and the authored branch (via the new `frontmatterSource` field carrying the original full text).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed the DESCRIBES-edge SQL column name**
- **Found during:** Task 2 GREEN implementation
- **Issue:** The plan's action text specified `SELECT target FROM edges WHERE source = ? AND edge_type = 'DESCRIBES'`, but the real `edges` table has no `edge_type` column — `lib/core/navigation/edges.cjs::writeEdge` writes to a column literally named `type`. Running the plan's literal SQL threw `no such column: edge_type` and the purge degraded to a no-op (`select_failed`), breaking the pre-existing leg 4 assertion.
- **Fix:** Verified live against a real seeded room (`node -e` probe against `INSERT INTO edges (source, target, type, ...)`), then used `type = 'DESCRIBES'` instead of `edge_type = 'DESCRIBES'`.
- **Files modified:** `lib/core/navigation/typed-entity.cjs`
- **Commit:** `931befeaa`

None else — every other task executed per plan.

## Auth Gates

None encountered.

## RED Evidence Per Task

**Task 1:** Before implementing `isShimBackedBrainTool`, ran the extended `tests/test-260917-dgf-part8-hook-disposition.cjs`. Leg 1 case G failed as expected (`G: an ambiguous payload on the direct connector (no second classification behind it) must exit 2, got 0` — the pre-fix hook trusted `mcp__pws-brain-mcp__*` via `isBrainTool`, which also matches that scope). Leg 2's new assertions then crashed with `TypeError: sanitizer.isShimBackedBrainTool is not a function` (the predicate did not exist yet) — the expected "not implemented" RED signal for a brand-new export. Case H (project scope keeps the allow) was already green pre-fix, confirming the fix needed to narrow, not widen.

**Task 2:** Before rewriting `purgeLegacySelfReferentialEntities`, ran `tests/test-eureka-scaffold-entity-noise.cjs` with the new legs 6-9 added. Leg 4 (pre-existing) failed: `status.json legacy_entities_purged must equal 3, got 0` — because `entity-extract.cjs` had not yet been updated to pass `scaffoldKinds` into the new `opts`-based signature, so the purge's new no-op guard (`scaffoldKinds` empty → no-op, `keptNodes` = candidate count) fired for every legacy row. Legs 6-9 all failed identically (each asserts on `entity-extract.main` output that depends on the same unwired call site).

**Task 3:** Before wiring `scaffold-template-index.cjs` into `collectArtifacts`, ran the test with the hand-typed `SCAFFOLD_BODY` fixture still in place against the new content-based `isScaffoldCandidate` + `isTemplateIdentical` logic already implemented in `entity-extract.cjs`. Leg 1 failed: `scaffoldFilesSkipped must equal 3 sections x 5 scaffold kinds, got 3` — 12 of the 15 hand-typed scaffold bodies (built from short marker sentences, never actually rendered from `templates/room-skeleton/*.tmpl`) legitimately differed from the real shipped templates and were correctly classified as "authored, extract the remainder" rather than "template-identical, skip" — proving the content-based comparator works, and that the OLD fixture needed replacing with real rendered templates (per the plan's own Task 3 action).

## Test Tallies (final, post-Task-3)

```
tests/test-260917-dgf-part8-hook-disposition.cjs  -> PASS (all legs green)
tests/test-brain-response-sanitize.cjs             -> 20/20 pass
tests/test-260906-gr1-brain-shaped-tool-gate.cjs   -> 12/12 pass
tests/test-213-part8-boundary.cjs                  -> PASS=6 FAIL=0
tests/test-eureka-scaffold-entity-noise.cjs        -> 9/9 legs pass
node scripts/check-substrate.cjs --diff            -> 0 violations in this diff
tests/test-216-room-substrate.cjs                  -> 47 assertions passed
tests/test-213-sensor-eureka.cjs                   -> PASS=11 FAIL=0
tests/test-216-field-contract.cjs                  -> 11 assertions passed
tests/test-260906-fda-known-tool-shapes.cjs        -> PASS (87 assertions)
tests/test-245-egress-contentless.cjs              -> PASS (41 assertions)

bash tests/run-all-196.sh   -> Passed: 6  Failed: 0  Skipped: 0
bash tests/run-all-218.sh   -> Phase 211: PASS=10 FAIL=0 SKIP=0
                                Phase 218: PASS=10 FAIL=9 SKIP=0
                                (the nine pre-existing "insertNode: invalid
                                epistemic_type \"undefined\"" reds are
                                UNCHANGED from the 0c68c8dde baseline --
                                test-218-entity-writer, test-218-what-why-
                                classifier, T-218-VD cohort-stratification,
                                T-218-VD-4 extend-to-artifacts, T-218-VD-5
                                auto-extract, REQ-5 noise-reduction,
                                quick-260715-0nj scaffold-pair-filter,
                                RCA-260719 low-trust-exclusion, CR-01
                                duplicate-entity-reconciliation)

tests/test-room-birth.cjs           -> 35/35 pass (BRAIN.md stub byte-identical)
tests/test-150-feynman-readback.cjs -> PASS (5 assertions, FEYNMAN default seed unchanged)
```

## Files Changed

```
tests/test-260917-dgf-part8-hook-disposition.cjs  (Task 1 -- case G/H, LEG 0/2 extensions)
lib/core/brain-response-sanitize.cjs               (Task 1 -- isShimBackedBrainTool)
scripts/part8-egress-guard-hook.cjs                 (Task 1 -- ambiguous branch narrowed)
tests/test-eureka-scaffold-entity-noise.cjs         (Task 2+3 -- legs 5-9, template-based fixture)
lib/core/navigation/typed-entity.cjs                (Task 2 -- bounded purge)
scripts/entity-extract.cjs                          (Task 2+3 -- purge call site, content-based exclusion)
lib/core/navigation.cjs                             (Task 2 -- door comment refresh)
lib/core/eureka/scaffold-template-index.cjs         (Task 3 -- NEW)
lib/core/navigation/room-birth.cjs                  (Task 3 -- BRAIN_STUB_TEMPLATE additive export)
lib/core/feynman/feynman-seed-writer.cjs            (Task 3 -- FEYNMAN_DEFAULT_SEED additive export)
tests/run-all-218.sh                                (Task 3 -- registration comment refresh)
```

git diff confirms: `lib/core/brain-client.cjs`, `lib/core/part8-egress-guard.cjs`, `hooks/hooks.json` byte-unchanged; `isBrainTool`, `BRAIN_TOOL_MATCHER`, `BRAIN_SHAPED_TOOL_MATCHER` byte-unchanged (only additive code added after them).

## Commits

| Hash | Message |
|------|---------|
| `69eebdd00` | fix(part8): narrow the ambiguous-verdict allow to shim-backed Brain scopes |
| `931befeaa` | fix(eureka): bound the legacy entity purge by provenance, review state and run scope |
| `d4470cc5f` | fix(eureka): exclude a scaffold file on template match, keep authored scaffold content |

All three commits carry the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` per the workspace rules.

## Deferred / Out of Scope

- `evals/plurai/211-baseline.json` picked up an unrelated modified `date` field (2026-08-27 → 2026-09-17) as a side effect of running `tests/run-all-218.sh` (the 211-05 judge-gate test writes a deferred baseline with today's date whenever the plurai endpoint is unreachable, which it is in this offline environment). This file is NOT in the plan's `files_modified` list and was left unstaged/uncommitted — a pre-existing test-harness side effect, not a defect introduced by this plan.

## Self-Check

Verifying created files and commits:

```
FOUND: lib/core/eureka/scaffold-template-index.cjs
FOUND: 69eebdd0046e402f84a2006373a16dc543f381d5
FOUND: 931befeaab6eabbd3d18a5ce4d16b093a18be787
FOUND: d4470cc5f01efc25c68e06363154b3c508c65e12
```

## Self-Check: PASSED
