---
phase: 226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la
fixed_at: 2026-07-15T18:21:15Z
review_path: .planning/phases/226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la/226-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 226: Code Review Fix Report

**Fixed at:** 2026-07-15T18:21:15Z
**Source review:** .planning/phases/226-eureka-reasoning-mode-fallback-seed-058-give-mos-eureka-a-la/226-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (critical_warning scope: CR-01, CR-02, CR-03, WR-01, WR-02, WR-03; IN-01/IN-02 are Info-tier and out of scope for this pass)
- Fixed: 6
- Skipped: 0

All fixes verified together with `bash tests/run-all-226.sh` after each commit and again after the full set: `PASS=10 FAIL=0 SKIP=0`.

## Fixed Issues

### CR-01: A second degraded `run` silently destroys a completed reasoning-mode report, with no upgrade delta at all on the `encoder_unavailable` path

**Files modified:** `scripts/eureka-portfolio-report.cjs`
**Commit:** 9eaa743c
**Applied fix:** Took the reviewer's first (minimal) suggested fix over the "refuse-to-overwrite" alternative, per this session's guidance. Dropped the `if (idx.embedded === true)` guard around `buildUpgradeDelta(jsonPath, provenance, ranked)` so it now runs unconditionally on every `run` invocation. `buildUpgradeDelta`'s own internal guard (`prev.provenance.run_mode !== 'reasoning'` -> no-op) makes this safe to call even when `ranked` is empty (the still-degraded case): it attaches `provenance.upgrade` with `survived:0`, `demoted_or_absent`, and the prior top-5 pair ids whenever a prior reasoning-mode report existed at `jsonPath` - including a repeated `encoder_unavailable` run, which previously attached no `upgrade` key at all. This satisfies the "never silently destroy with no trace" bar: the canonical file is still overwritten (the minimal fix does not add a refuse-to-overwrite / scratch-path mechanism), but every overwrite of a prior reasoning-mode result now carries a disclosed trace of what was lost.

### CR-02: A stale `pairs.json` lets the reasoning stages overwrite a later, healthy - possibly already-banked - embedded report

**Files modified:** `scripts/eureka-portfolio-report.cjs`
**Commit:** a43fbf32
**Applied fix:** Implemented the reviewer's stated "simplest concrete fix": `reasoningStageSeed`, on a healthy run (`degradeCause === null`), now deletes any stale `pairs.json` left in the reasoning workdir by an earlier degrade (best-effort `fs.unlinkSync` in a try/catch, never blocking the healthy run). This means `reasoningStageEmit`/`reasoningStageScore`'s existing `fs.existsSync(pairsPath)` guard naturally fires ("no pairs.json") if the reasoning stages are re-run after a healthy embedded run has since superseded the degrade, instead of silently overwriting the healthy report.

### CR-03: `reasoningStageSeed` unconditionally regenerates `pairs.json` on every degraded `run`, silently invalidating an in-progress self-judging session

**Files modified:** `scripts/eureka-portfolio-report.cjs`
**Commit:** bfd27363
**Applied fix:** Implemented option (a) from the reviewer's fix: before writing a fresh `pairs.json`, `reasoningStageSeed` now checks whether the workdir already holds an in-progress session (`pairs.json` exists AND at least one of `mappings.json` / `answers.json` / `prompts/manifest.json` is present). If so, it skips re-seeding (idempotent no-op) and returns the existing session's pair count instead of reassigning `P000N` ids out from under mappings/answers the navigator already wrote. A fresh degrade with no in-progress session artifacts still seeds normally.

### WR-01: `reasoning-score` before `reasoning-emit` can crash with an uncaught ENOENT instead of the standard 3-line error

**Files modified:** `scripts/eureka-portfolio-report.cjs`, `scripts/eureka-command.cjs`
**Commit:** 1f454c50
**Applied fix:** Two-part fix per the reviewer's suggestion. (1) `reasoningStageScore`'s retry-latch write now runs `fs.mkdirSync(path.dirname(manifestPath), { recursive: true })` before `fs.writeFileSync`, so the write no longer throws ENOENT when `<workdir>/prompts/` was never created (verified by reproducing the pre-fix crash via `git stash` and confirming the post-fix run exits cleanly with code 2 instead). (2) Added a `.catch()`-equivalent second argument to both top-level `main(...).then(...)` invocations (in `eureka-portfolio-report.cjs` and `eureka-command.cjs`) so any future uncaught throw on this path degrades to a clean exit code 1 with a printed error instead of an unhandled promise rejection / stack trace.

### WR-02: The max-1-retry latch is trivially reset by re-running `reasoning-prompts`

**Files modified:** `lib/core/eureka/reasoning-mode.cjs`
**Commit:** 5362b530
**Applied fix:** `emitReasoningPrompts` now reads the existing `manifest.json` in the workdir (if present) before building the fresh manifest, and carries `retry_used: true` forward if the prior manifest had it set (best-effort read in a try/catch; missing/unreadable/unparseable prior manifest leaves the flag unset, i.e. a fresh session). Verified directly: seeding a workdir with `manifest.json` containing `retry_used:true` and re-running `emitReasoningPrompts` against it now returns a manifest with `retry_used === true`.

### WR-03: `report-html.cjs` embedded ranked rows carry no explicit `mode` field, unlike `statements[]`

**Files modified:** `scripts/eureka-portfolio-report.cjs`
**Commit:** 3b4a4d89
**Applied fix:** Added `mode: 'embedded'` to the embedded writer's `ranked[]` row shape, matching `statements[]` (which already carries `mode: 'embedded'`) and the reasoning-mode `ranked[]` rows (which already carry `mode: 'reasoning'`). `report-html.cjs`'s `r.mode || 'embedded'` fallback is untouched and still correct; this closes the asymmetry the fallback was masking.

## Skipped Issues

None - all 6 in-scope findings were fixed.

## Not Actioned (by design, per this session's scope)

- **IN-01, IN-02:** Info-tier findings, out of scope for the `critical_warning` fix pass. Not fixed, not skipped-with-reason - simply excluded by scope.
- **New regression tests for CR-01/CR-02/CR-03's specific untested edge cases** (a second `encoder_unavailable` run destroying a prior reasoning report; a stale `pairs.json` racing a healthy embedded run; reseeding out from under an in-progress mapping session): per this session's explicit instruction, fixing the bug and confirming via `bash tests/run-all-226.sh` (PASS=10 FAIL=0 SKIP=0, both after each commit and after the full set) was treated as sufficient for this pass. These are flagged here, not silently dropped, as a follow-up candidate for a dedicated test-writing pass.

---

_Fixed: 2026-07-15T18:21:15Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
