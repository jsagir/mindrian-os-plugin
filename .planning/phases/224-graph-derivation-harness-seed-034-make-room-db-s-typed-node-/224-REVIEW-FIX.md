---
phase: 224-graph-derivation-harness-seed-034-make-room-db-s-typed-node-
fixed_at: 2026-07-15T11:20:57Z
review_path: .planning/phases/224-graph-derivation-harness-seed-034-make-room-db-s-typed-node-/224-REVIEW.md
iteration: 1
findings_in_scope: 14
fixed: 14
skipped: 0
status: all_fixed
---

# Phase 224: Code Review Fix Report

**Fixed at:** 2026-07-15T11:20:57Z
**Source review:** 224-REVIEW.md (reviewed 2026-07-15T10:49:38Z, depth standard)
**Scope:** Critical + Warning (Info findings IN-01 through IN-05 excluded by scope)

**Summary:**
- Findings in scope: 14 (2 Critical, 12 Warning)
- Fixed: 14
- Skipped: 0

## Fixed Issues

### CR-01: runDerivation's default producer path silently derives nothing (Promise treated as [])

**Files modified:** `lib/core/graph-derivation.cjs`, `lib/core/graph-candidate-producer.cjs`
**Commit:** 75fcb252
**Applied fix:** `deriveForPair` now detects a thenable return from deriveFn and THROWS with a pre-resolution instruction (the review's fail-loud option) instead of returning []. Both false docstrings corrected: the composer header ("both are accepted") and the producer's "The runDerivation loop awaits the return either way". The two shipped callers (drain, backfill) pre-resolve and are unaffected; a future default-path caller now fails loudly instead of silently deriving zero edges.

### CR-02: Command injection via interpolated file path in the cascade's execSync calls

**Files modified:** `lib/core/intelligence-cascade.cjs`
**Commit:** 9a3b0fde
**Applied fix:** All nine listed sites (lines ~319, 413, 418, 434, 446, 462, 481, 494, 507: classify-insight, check-hsi-deps, compute-hsi.py, detect-reverse-salients.py, hsi-to-graph.cjs, generate-presentation.cjs, compute-state, build-graph, analyze-room) converted from shell-string `execSync` to argv-array `execFileSync`. `execSync` removed from the import. Zero `execSync` remains in the module.

### WR-01: clearQueue wipes entries enqueued during the drain window + non-atomic queue writes

**Files modified:** `scripts/gsd-graph-derive-sweep.cjs`, `scripts/gsd-graph-derive-drain.cjs`
**Commit:** e0114ba8
**Applied fix:** `clearQueue` re-reads the queue and removes ONLY the drained snapshot (matched on roomDir+filePath+enqueued_at); verified by a mid-drain-enqueue harness (the new entry survives the clear). New `sweep.writeQueue` does tmp-file + `renameSync` atomic writes, used by both the enqueue and every clear path (the brain-derivation-queue idiom). Legacy deriveRunner path uses the same snapshot-scoped clear (queue-empty round-trip contract preserved, test-graph-derive-sweep 4/4).

### WR-02: SessionStart drain cannot finish real scoring inside its 5000ms hook budget; stuck queue re-stalls every session start

**Files modified:** `scripts/gsd-graph-derive-drain.cjs`, `lib/core/intelligence-cascade.cjs`
**Commit:** a21ef563
**Applied fix:** Review option (c). The drain's hook entry point re-spawns itself detached with `--worker` (detached, stdio ignore, unref) and exits immediately - measured 70ms, far inside the 5000ms budget - so the hook timeout can never kill a cold-encoder scoring pass mid-run, and a surviving queue entry can never re-stall session start. The cascade Step 2b spawn passes `--worker` so it never double-spawns. `MOS_NO_DETACHED_DERIVE=1` suppresses the re-spawn (test seam). hooks.json unchanged.

### WR-03: Detached-drain stampede - one spawn per markdown write, each processing the full queue concurrently

**Files modified:** `scripts/gsd-graph-derive-drain.cjs`, `lib/core/intelligence-cascade.cjs`
**Commit:** 4d76dd35
**Applied fix:** Both suggested guards. (1) `drainScoreBased` takes a per-room single-flight lock (`fs.openSync(.mindrian/graph-derive-drain.lock, 'wx')`, stale-reclaim after 10 minutes, released in finally); a losing concurrent drain returns `{locked:true, remaining:N}` without touching the queue. Verified with two overlapping drains (exactly one locked out; lock releases for a third). (2) Cascade Step 2b skips the spawn when `enqueueDerive` reports `queued:false` (entry already pending). The Step 2b comment's false "extra drains no-op" claim corrected.

### WR-04: runDeriveBackfill's AsyncFunction-name sniffing misroutes promise-returning plain functions into the Promise-as-[] path

**Files modified:** `lib/core/graph-backfill.cjs`
**Commit:** 940b7056
**Applied fix:** `useAsync` now uses `_isPromiseReturning`: AsyncFunction constructor OR a return-value probe with a degenerate step (`{roomDir:'', artifactPair:null}`, answered with [] by every well-behaved producer; probe promise detached; a throwing probe stays on the sync path). A plain arrow wrapping the async score producer now derives real edges via the async runner (verified end-to-end); a sync injected heuristic keeps its plain-object return (byte-compat preserved, not the review's "always async" variant, which would have broken the documented polymorphic-return contract and its tests).

### WR-05: _rebuildRoom is fired and never awaited - rebuild races derivation and the after-count

**Files modified:** `lib/core/graph-backfill.cjs`
**Commit:** 6851d190
**Applied fix:** `await _rebuildRoom(t)` in `_runBackfillAsync` (STEP 2 now sequenced before STEP 3 and before the after-count). In `_runBackfillSync` the race is explicitly documented as accepted (the runner is synchronous for pre-224 byte-compat; callers needing sequencing use the async path) - the review's stated alternative for the sync leg.

### WR-06: writeEdge's ON CONFLICT overwrites the existing edge's properties - derivation can clobber legacy/confirmed edge metadata

**Files modified:** `lib/core/navigation/edges.cjs`, `tests/test-224-migration.cjs`
**Commit:** 6cf2e4da
**Applied fix:** Applied the review's "mirror the review_status invariant onto properties" option for CONFIRMED rows: `DO UPDATE SET properties = excluded.properties WHERE edges.review_status IS NOT 'confirmed'`. DELIBERATELY PARTIAL: NULL (legacy) and 'proposed' rows keep the pre-224 update-on-conflict contract - extending the guard to NULL would have silently frozen properties for every pre-224 writeEdge caller (30+ call sites rely on upsert-updates-properties), and NULL default semantics are the navigator's D-05 ruling (a by-design item this fix must not disturb). test-224-migration Test 5 updated: it previously asserted the confirmed-row clobber as "the existing contract"; it now asserts confirmed properties survive AND proposed properties still update.

### WR-07: Derivation floor env validation accepts 0 and permits band inversion

**Files modified:** `lib/core/graph-derive-classifier.cjs`, `docs/ENV-TUNING.md`
**Commit:** a9f983bd
**Applied fix:** `resolveFloor` requires strictly positive values (`v > 0 && v <= 1`); `resolveFloors` enforces `converges >= informs`, falling back BOTH floors to the calibrated defaults on inversion. ENV-TUNING.md wording aligned with the actual guard. Verified: `DERIVE_CONVERGES_FLOOR=0` rejected; inverted pair falls back to (0.55, 0.45); a valid override pair (0.7, 0.5) is honored.

### WR-08: Encoder failure after a passing probe is a silent skip with no disclosure (probe-then-score TOCTOU; probeOpts not threaded to scoring)

**Files modified:** `lib/core/graph-derive-classifier.cjs`, `scripts/gsd-graph-derive-drain.cjs`, `lib/core/graph-backfill.cjs`
**Commit:** c327fc70
**Applied fix:** `scoreBasedDeriveFn` gains an advisory `onOutcome` callback fired with `{outcome:'encoder_unavailable'}` on both silence returns (semantic null/undefined, warning encoder_unavailable). The drain and the async backfill (default path only) count these outcomes and write the `derivation_skipped` disclosure with the affected pair count when any pair failed AFTER the passing probe; the backfill also reports `result.encoderFailedPairs`. Both callers now thread `probeOpts` as `scoreOpts` into scoring, so the probe seam and the scoring seam can never diverge onto different encoders (the test-224-cost-bound asymmetry the review flagged). The by-design D-04 gating (probe OFF for injected deriveRunner / injected deriveFn test seams) is untouched.

### WR-09: Heal gate is all-or-nothing - per-folder APPROVE/REJECT is not expressible

**Files modified:** `lib/core/graph-backfill.cjs`, `commands/graph.md`
**Commit:** 3bfe5614
**Applied fix:** `runDeriveBackfill` accepts an optional `approveFolders` allow-list (slugs or paths); only listed detected folders receive the `approvedBy` handle at the STEP 0 gate, the rest surface unhealed (`no_approval` = REJECT/DEFER captured). Absent list keeps the existing behavior (back-compatible). Verified: folderA approved + healed while folderB refused in the same run. graph.md STEP 0 now instructs a PER-FOLDER verdict and the --derive snippet threads `MOS_APPROVED_FOLDERS`. NOTE: skills/graph/SKILL.md (the generated mirror) was ALREADY stale before this fix - mirror regeneration is the documented pre-existing coverage-gate gap, left to its own process.

### WR-10: writeEdge accepts review_status 'confirmed' from any caller with no byUser attribution

**Files modified:** `lib/core/navigation/edges.cjs`
**Commit:** c2cf84af
**Applied fix:** A first-insert `'confirmed'` is rejected with `confirmed_requires_by_user` unless `params.byUser` is a non-empty string; the handle is recorded as a `confirmed_by` scalar in properties (mirroring the confirmNode discipline). No production caller passes edge-level 'confirmed' today (grep-verified), so no call site changes were needed; proposed and bare writes are byte-unchanged.

### WR-11: gsd-artifact-graph-hook opens room.db raw, bypassing the Phase-218 busy-timeout write-safety

**Files modified:** `scripts/gsd-artifact-graph-hook.cjs`
**Commit:** 5cdcca1b
**Applied fix:** `new sqlite.DatabaseSync(dbPath, { timeout: 5000 })` - the exact one-line fix suggested, joining the Phase-218 global write-safety fold so a reconcile write busy-waits during an in-flight detached drain instead of instant SQLITE_BUSY + silent no-op.

### WR-12: rollupSubRooms interpolates the child db path into ATTACH SQL - breakage and SQL injection via directory names

**Files modified:** `lib/core/graph-derivation.cjs`
**Commit:** ad8aa85b
**Applied fix:** Parameterized ATTACH (`parentConn.prepare('ATTACH DATABASE ? AS rollup_child').run(...)`) with `_fileUriPath` percent-encoding of the URI-significant bytes (%, ?, #) on both the ATTACH filename and the parent read-only `file:` URI open (the line-413 sibling the review named). Verified end-to-end: a child room under `jonathan's rooms/` with an apostrophe-bearing slug now contributes its edges to the parent rollup (previously silently zero).

## Skipped Issues

None in scope. (IN-01 through IN-05 are Info findings, excluded by the critical_warning scope.)

## By-design items checked and preserved

- Tolerant-then-strict assertion pattern between plans: no fix touched it (run-all-224.sh strict re-assert unchanged).
- D-04 encoder probe gated OFF when a test deriveRunner / deriveFn is injected: preserved byte-for-byte (WR-08's disclosure counting rides the DEFAULT path only; the Phase-169 legacy seam is untouched, test-graph-derive-sweep 4/4).
- NULL default review_status semantics for legacy edges (navigator D-05 ruling): preserved (WR-06 protects 'confirmed' rows only; NULL rows keep the pre-224 properties-update contract).

## Verification

| Gate | Result |
|------|--------|
| `bash tests/run-all-224.sh` | PASS=17 FAIL=0 SKIP=0, exit 0 |
| `node tests/test-graph-derive-sweep.cjs` | PASS (4/4) |
| `bash tests/run-all-169.sh` | 16/20 - the SAME 4 failures as the pre-fix clean-tree baseline (test-edges-room-lineage-floor, test-edges-part4-cascade-floor, test-depth2-full-citizen, test-graph-derivation-verdict), all failing on the identical pre-existing FEYNMAN "## Timeline (auto)" heal-citizen marker findings. Zero NEW failures introduced. |

Baseline for the 169 suite was captured on the untouched tree BEFORE any fix (same 4 legs, same findings), so the delta attributable to this fix pass is zero.

Conventions held: CJS only, no em-dashes, zero new npm dependencies (run-all-224 Req 4 dependency-diff leg green), zero network egress in derivation modules (Part 8 sweep green), all edge writes through navigation.cjs (Part 9 sweep green).

Note: an unrelated commit from a concurrent session (58c37f3a, docs 225-03, .planning-only) landed between the WR-05 and WR-06 fix commits; it does not touch any file modified by this pass.

---

_Fixed: 2026-07-15T11:20:57Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
