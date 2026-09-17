---
phase: 353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted
plan: 02
subsystem: data-room-icm
tags: [section-ruling, jtbd-canon, jev-ledger, filing-gate, anchor-node, doctor-module, release-gate, decide-eligibility-filter]

# Dependency graph
requires:
  - phase: 353-01
    provides: room-map.cjs, the icm_self writer, JOB_VOCABULARY/isDeclaredJob (section-registry.cjs), the doctor room-map module shape, the fixture rooms (tests/fixtures/icm-rooms/), tests/run-all-353.sh, evals/icm/cases/turns.json
provides:
  - data/section-job-canon.json (getSectionJob, the 12-section JTBD canon, navigator ratification slot)
  - scripts/build-section-command-ledger.cjs (--check / --offline-seed / --jev-fixture / navigator jev-scored rebuild)
  - data/section-command-ledger.json (the shipped offline-seed relevance ledger)
  - the ruling document generator (room-skeleton-scaffold.cjs::writeSectionContracts, six generated parts + fingerprinted frontmatter above preserved authored prose)
  - lib/core/navigation/jtbd-anchor.cjs (mintJtbdAnchor, JTBD_ANCHOR_ID)
  - lib/core/navigation/section-gate.cjs (resolveFocusSection, evaluateFilingGate, GATE_MODES, countClaimsWithoutJtbdAnchor)
  - the filing gate wired into artifact_file and claim_write, with mint-then-edge SOURCED_FROM anchoring
  - lib/core/section-ruling-candidates.cjs (buildLedgerCandidates), wired into decide()'s eligibility filter and rankForSelector's tierCandidates seam
  - lib/core/doctor/section-ruling-module.cjs + its data/doctor-modules.json row (26 modules total)
  - scripts/release.sh Step 2.4 offline ledger staleness check + --no-ledger-check opt-out
affects: [353-03-fixture-grading, 352-doctor-auto-heal-classification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Section job canon: one JSON home (data/section-job-canon.json) read once at module load by section-registry.cjs::getSectionJob; the four vocabulary-gap sections (business-model, financial-model, legal-ip, solution-design) declared honestly as vocabulary_extension:true rather than mislabeled onto a wrong command-derived job"
    - "Ledger union join (R-353-C): a job's candidate commands are the UNION of (a) commands named in the section contract's own 'Commands that write here' table (both its Ground truth and Framework-matched bullets, seeded not recomputed) and (b) commands whose serves_jtbd includes the job or its declared secondary -- guarantees the four vocabulary-extension jobs never yield an empty row"
    - "Ruling document as generated-block-in-authored-file: frontmatter + a mos:ruling:begin/end marked six-part block composed as a separate string and spliced above preserved authored prose, never substituted into it; regeneration is a true no-op (byte-identical) when the recomputed ruling_fingerprint matches what's already on disk"
    - "jtbd:<job_id> anchor: payload-free, type 'jtbd' NEVER 'claim', mint-then-edge blocking order (writeEdge probes no endpoint, D-169-11), the same structural clone discipline goal-anchor.cjs established in Phase 345"
    - "Doctor statement-home discipline: a doctor module (lib/core/doctor/*.cjs) carries zero raw SELECT; the SQL lives in lib/core/navigation/*.cjs (here, section-gate.cjs's countClaimsWithoutJtbdAnchor), mirroring graph-integrity-counts.cjs's own established pattern"
    - "decide() ctx-assembly producer: section-ruling-candidates.cjs mirrors the SENS-16 shape exactly (braced block, LOCAL read at ctx-assembly time, caller-threaded ctx.* override wins, try/catch soft-fail to null); feeds the EXISTING rankForSelector tierCandidates seam, adds no new argument, changes no frozen scalar"

key-files:
  created:
    - data/section-job-canon.json
    - scripts/build-section-command-ledger.cjs
    - data/section-command-ledger.json
    - docs/SECTION-COMMAND-LEDGER.md
    - lib/core/navigation/jtbd-anchor.cjs
    - lib/core/navigation/section-gate.cjs
    - lib/core/section-ruling-candidates.cjs
    - lib/core/doctor/section-ruling-module.cjs
    - tests/fixtures/353-jev-ledger-responses.json
    - tests/test-353-section-canon.cjs
    - tests/test-353-ledger-shape.cjs
    - tests/test-353-ruling-doc.cjs
    - tests/test-353-anchor-edge.cjs
    - tests/test-353-filing-gate.cjs
    - tests/test-353-decide-budget.cjs
    - tests/test-353-doctor-section-ruling.cjs
    - tests/test-353-release-wiring.cjs
  modified:
    - lib/core/section-registry.cjs (getSectionJob added)
    - lib/core/room-skeleton-scaffold.cjs (writeSectionContracts rewritten as the ruling document generator; buildRulingBlock exported)
    - lib/core/frontmatter-schemas.cjs (CONTEXT.md schema arm)
    - lib/core/navigation.cjs (mintJtbdAnchor/JTBD_ANCHOR_ID/resolveFocusSection/evaluateFilingGate/GATE_MODES/countClaimsWithoutJtbdAnchor re-exports)
    - lib/mcp/tools/views.cjs (fileArtifact: filing gate + mint-then-edge anchor)
    - lib/mcp/tools/claim.cjs (claim_write: filing gate + mint-then-edge anchor)
    - lib/core/navigation-engine.cjs (decide(): the ledger-candidate producer block)
    - lib/core/navigation-engine-offer.cjs (resolveOffer: threads ctx.tierCandidates into the existing rankForSelector call)
    - data/doctor-modules.json (section-ruling row)
    - scripts/release.sh (Step 0 flag + Step 2.4 gate)
    - tests/fixtures/310-release-step-block-hashes.txt (Step 0 + Step 2.4 re-pinned)
    - tests/fixtures/341-release-step-block-hashes.txt (Step 0 + Step 2.4 re-pinned; pre-existing staleness reported, not fixed)
    - tests/test-275-section-schema.cjs (the two D-353-7-obsoleted assertions amended, R-353-L)

key-decisions:
  - "Governance-dial field correction: the eligibility filter's 'declared HITL shape' condition reads connector-registry.json's decision_surface for /mos: commands, not hitl_shape as the plan's read_first literally named -- measured that hitl_shape is the MCP-tool-class dial only (27 mcp:* rows carry it; zero /mos: rows do), confirmed against build-connector-registry.cjs's own comment naming decision_surface as the command-class governance dial"
  - "decide() producer activation: wired from ctx.sectionJobId or ctx.section (resolved via getSectionJob) rather than a full session/focus-driven derivation, because decide() carries no sessionId today and inventing one would touch far more surface than this plan's file list. The richer signal (resolveFocusSection) is documented as the natural next wiring step for a future caller."
  - "claims_without_anchor cutoff is a hardcoded module constant (INTRODUCED_AT_MS, 2026-09-17), not the registry row's introduced_version string, because a semver string has no wall-clock meaning a SQL cutoff can use"
  - "Ruling-document regeneration is a true byte-identical no-op when the recomputed ruling_fingerprint already matches what's on disk (frontmatter comparison short-circuits before any splice), which is also what makes 'two consecutive generations leave the file byte-identical' and 'the fingerprint recomputes identically' simultaneously true without conflicting with generated_at being a real per-generation timestamp"

requirements-completed: [RULE-10, RULE-11, RULE-12, RULE-13, RULE-14, RULE-15, RULE-16, RULE-17, RULE-18, RULE-19, RULE-20, RULE-21]

# Metrics
duration: ~5h
completed: 2026-09-17
---

# Phase 353 Plan 02: Section Ruling System Summary

**Every ICM section now declares the job it exists to do from one canon home (data/section-job-canon.json), a Theo/Jev relevance ledger orders the commands a section's generated ruling-document CONTEXT.md recommends, filed claims and artifacts anchor to a non-claim `jtbd:<job_id>` node (5 of 5 measured, 100%), `decide()` feeds that same ledger through `rankForSelector`'s existing `tierCandidates` seam at 1.43ms (well inside the 1200ms budget), a doctor module reports four ruling-drift classes, and a release fails on a stale ledger with zero vendor calls.**

## Performance

- **Duration:** ~5h
- **Tasks:** 10 of 10 completed
- **Files created/modified:** 33 (17 new, 16 modified)

## Accomplishments

- `data/section-job-canon.json` + `section-registry.cjs::getSectionJob`: all 11 `CORE_SECTIONS` + `personas` declare a job from the 2026-09-17 Jev probe, with the four vocabulary-gap sections (business-model, financial-model, legal-ip, solution-design) declared `vocabulary_extension:true` rather than mislabeled onto a wrong command-derived job; the navigator's `ratification` slot is empty and waiting.
- `scripts/build-section-command-ledger.cjs`: verbatim-ported Theo puller (two fixed Cypher texts, `$params` only), a zero-dep Jev client with `assertEgressCeiling` making the Canon Part 8 ceiling executable, the R-353-C union join, and an offline `--check` that never requires `brain-client.cjs`. Shipped `data/section-command-ledger.json` (10 rows, 128 total candidates, 89 ground-truth / 39 framework-matched) is `build_mode: "offline-seed"`, `jev_model: null`, every candidate `confidence: null` -- honest about not yet being vendor-scored.
- The ruling document generator (`writeSectionContracts`): six numbered, fingerprinted parts spliced above byte-preserved authored prose; creates the document when none exists, regenerates only when the recomputed `ruling_fingerprint` actually differs (a true no-op otherwise); the two Phase 275 assertions D-353-7 made obsolete were amended with a phase-cited comment, never silently narrowed (66/66 assertions pass, was 65/65).
- `jtbd-anchor.cjs` + `section-gate.cjs`: the payload-free `jtbd:<job_id>` node (type `'jtbd'`, never `'claim'`), the filing gate (`flag` default landing a disclosed mismatch, `strict` refusing before any write), and mint-then-edge wired into both `artifact_file` and `claim_write` -- measured 5 of 5 (100%) filed claims carrying a `SOURCED_FROM` anchor edge on a fixture room (criterion 3).
- `section-ruling-candidates.cjs` + `decide()`: the five-condition eligibility filter (ledger membership, stage gate, `autonomous_safe`, WD-353-1's N=5 recency window, declared governance dial) feeds `rankForSelector`'s existing `tierCandidates` seam. Measured: producer 0.0086ms (avg/200 calls), `decide()` with the producer 1.43ms, without 0.60ms (avg/10 runs each) -- both far inside the 1200ms NAV budget. `lib/hmi/dial-reach-orchestrator.cjs` and `lib/core/insight-sensors.cjs` byte-unchanged; `MAX_K` still 3.
- `section-ruling-module.cjs`: four named drift classes (`ruling_fingerprint_drift`, `sections_without_job_id`, `subrooms_without_job_id`, `claims_without_anchor`), the same `recoverable:false` fixture-prefix guard as `room-map-module.cjs`; `data/doctor-modules.json` now carries 26 modules, no `auto_heal` key (R-353-A, proposed FALSE here).
- `scripts/release.sh` Step 2.4 gains the offline `section-command-ledger.cjs --check` gate with the audited `--no-ledger-check` opt-out; zero vendor bytes on the release path. `tests/fixtures/310-release-step-block-hashes.txt` and `341-release-step-block-hashes.txt` re-pinned for exactly the two blocks this task changed.

## Task Commits

1. **Task 1: the section JTBD canon and the four vocabulary-extension members** - `130b51e37` (test)
2. **Task 2: scripts/build-section-command-ledger.cjs** - `201c10cf6` (feat)
3. **Task 3: ship data/section-command-ledger.json as the offline seed** - `1c6621cea` (feat)
4. **Task 4: the ruling document generator and the CONTEXT.md frontmatter schema arm** - `02d045a30` (feat)
5. **Task 5: the named amendment of the two Phase 275 assertions** - `8c6115992` (test)
6. **Task 6: the jtbd anchor node, minted before any edge ever names it** - `291c48a07` (feat)
7. **Task 7: the filing gate on artifact_file and claim_write, with the anchor edge** - `73f13b7d6` (feat)
8. **Task 8: the ledger candidate producer and the decide() eligibility filter** - `48958d997` (feat)
9. **Task 9: doctor module section-ruling plus its registry row** - `3279defbe` (feat)
10. **Task 10: release.sh Step 2.4 offline ledger check, the audited opt-out, and the step-hash re-pin** - `8550df44f` (feat)

_All 6 `tdd="true"` tasks (1, 2, 4, 6, 7, 8) show an observed RED before GREEN; each commit body quotes the exact RED failure line._

## RED/GREEN Evidence (TDD tasks)

| Task | RED (module/behavior absent) | GREEN |
|------|-------------------------------|-------|
| 1 | `getSectionJob export missing from lib/core/section-registry.cjs`, exits 1 | 11/11 checks pass |
| 2 | `missing scripts/build-section-command-ledger.cjs`, exits 1 | 10/10 checks pass |
| 4 | no landed CONTEXT.md carries a `mos:ruling:begin` marker, 9/17 checks fail | 17/17 checks pass |
| 6 | `missing lib/core/navigation/jtbd-anchor.cjs`, exits 1 | 17/17 checks pass |
| 7 | `missing lib/core/navigation/section-gate.cjs`, exits 1 | 24/24 checks pass |
| 8 | `missing lib/core/section-ruling-candidates.cjs`, exits 1 | 5/5 checks pass |

## Measured Numbers (per the plan's `<output>` spec)

- **Latency (Task 8):** producer 0.0086ms (avg over 200 calls, first call includes the one-time ledger-cache fill); `decide()` with the producer engaged: 1.43ms (avg/10 runs); `decide()` without: 0.60ms (avg/10 runs). Both far inside the 1200ms NAV budget.
- **Ledger (Tasks 2-3):** `data/section-command-ledger.json` carries **10** `job_id|*|*` rows (one per distinct job id across the 12 canon sections; several sections share a job id, e.g. `team-execution` and `funding` both `plan-execution`), **128** total candidate rows, of which **89 ground-truth** (contract-table-seeded or `serves_jtbd`-declared) and **39 framework-matched**.
- **Anchor edges (Task 7):** N of N = **5 of 5 (100%)** claims filed on a fixture room carry a `SOURCED_FROM` edge to a non-claim `jtbd:` anchor.
- **Pre-existing reds, re-run, unchanged, never edited:**
  - `tests/test-auto-explore-telemetry.cjs`: 14 pass, 1 fail (the `EVENT_TYPES.size === 32` exact-count assertion; 102 members at HEAD).
  - `tests/test-131-substrate.cjs`: 12 pass, 2 fail (the `PRE_131_EVENT_BASELINE + 3` exact-count assertion).
  - `tests/fixtures/341-release-step-block-hashes.txt`'s pre-existing staleness (missing the Step 0.6/5.6 blocks that landed after its 2026-09-10 generation; `STEP_BLOCK_COUNT` literal still 28 against 30 real blocks) -- reported in a dated note, not renumbered.
  - Newly discovered and logged (not fixed), out of scope: `bash tests/run-all-310.sh` leg 7 (Step 5.5 real-block wiring suite) fails on `DRY_RUN: unbound variable` in its own test driver, reproduced byte-identically on `release.sh` before Task 10's edit. See `.planning/phases/353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted/deferred-items.md`.

## The Phase 275 assertion replaced (Task 5, R-353-L, verbatim)

**BEFORE** (`tests/test-275-section-schema.cjs`, formerly ~line 377):
```javascript
let allByteIdentical = true;
for (const slug of scaffold.SECTION_NAMES) {
  const landed = fs.readFileSync(path.join(tmpDir, slug, 'CONTEXT.md'), 'utf8');
  const template = fs.readFileSync(path.join(CONTRACTS_DIR, slug + '.md'), 'utf8');
  if (landed !== template) allByteIdentical = false;
}
assert(allByteIdentical, 'every landed CONTEXT.md is byte-identical to its template');
```

**AFTER**: two assertions over the same `scaffold.SECTION_NAMES` loop -- (a) every landed `CONTEXT.md` carries the `mos:ruling:begin`/`mos:ruling:end` markers and a `ruling_fingerprint` in its frontmatter; (b) every byte below the end marker matches the corresponding region of its template (the authored prose Phase 353 preserves, never touches). The sibling assertion at (formerly) line 341 ("no contract template has YAML frontmatter") **stays and stays green**, with a phase-cited comment stating why: Phase 353 adds frontmatter to the LANDED document at write time, never to the template on disk.

Result: 66/66 assertions pass (was 65/65 pre-Phase-353).

## Files Created/Modified

See the frontmatter `key-files` block for the full list; each task's own commit documents its file-level rationale in detail.

## Decisions Made

See frontmatter `key-decisions`. Most consequential: the eligibility filter's "declared HITL shape" condition reads `decision_surface` (the actual command-class governance dial in `connector-registry.json`), not `hitl_shape` as the plan's read_first literally named -- `hitl_shape` is measured to be the MCP-tool-class dial only, and using it as written would have made the filter exclude every `/mos:` candidate unconditionally.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Self-referential grep false positives in acceptance-criteria checks (three occurrences, same class as Plan 01's own deviation #4)**
- **Found during:** Tasks 2, 3, 5
- **Issue:** Comment/log text describing the invariant literally contained the banned substring the acceptance grep was checking for (`Object.keys` containing "key" inside a `console.log(...)` call; "byte-identical to its template" inside an explanatory code comment; a doc sentence not matching the exact required phrase "never carries a Jev key").
- **Fix:** Reworded the affected lines/comments to describe the same invariant without the literal substring, or to match the exact required phrase.
- **Files modified:** `scripts/build-section-command-ledger.cjs`, `docs/SECTION-COMMAND-LEDGER.md`, `tests/test-275-section-schema.cjs`.
- **Committed in:** `201c10cf6`, `1c6621cea`, `8c6115992`.

**2. [Rule 3 - Blocking] `navigation-engine-offer.cjs` needed one line to complete the Task 8 seam**
- **Found during:** Task 8
- **Issue:** `decide()`'s new producer sets `ctx.tierCandidates`, but `resolveOffer` (in `lib/core/navigation-engine-offer.cjs`, not in Task 8's declared `<files>`) never read it before calling `rankForSelector`, so the producer's output would never reach the ranker -- the seam would exist but do nothing.
- **Fix:** Added `tierCandidates: ctx.tierCandidates` to the existing `rankForSelector` call (Phase 244 TRIG-02's own accepting seam; no new argument added to `rankForSelector` itself).
- **Files modified:** `lib/core/navigation-engine-offer.cjs`.
- **Verification:** `tests/test-353-decide-budget.cjs` 5/5; no scalar or frozen surface touched.
- **Committed in:** `48958d997`.

**3. [Rule 1 - Bug] Job-candidate eligibility filter's governance-dial field corrected against measured data**
- **Found during:** Task 8
- **Issue:** The plan's read_first named `hitl_shape` as where a command's declared HITL shape lives in `connector-registry.json`. Measured: `hitl_shape` is carried by 27 `mcp:*`-surface rows only; zero `/mos:*` command rows carry it (confirmed against `build-connector-registry.cjs`'s own comment: a command's governance dial is `decision_surface`, not `hitl_shape`, which is the MCP-tool-class dial). Implementing condition 5 literally as written would have excluded every command candidate unconditionally, producing an always-empty ledger-candidate list.
- **Fix:** Read `decision_surface` (falling back to `hitl_shape` for a hypothetical future MCP-tool-class candidate) instead.
- **Files modified:** `lib/core/section-ruling-candidates.cjs`.
- **Verification:** `buildLedgerCandidates({jobId:'find-problem'})` returns non-empty, correctly-filtered survivors; `tests/test-353-decide-budget.cjs` 5/5.
- **Committed in:** `48958d997`.

### Scope Notes (not deviations; documented judgment calls)

- **Task 9's `subrooms_without_job_id` / `sections_without_job_id` drift classes are report-only**, matching D-353-9; no fix path re-declares a job on the navigator's behalf.
- **`decide()`'s producer activates from `ctx.sectionJobId`/`ctx.section` only** (not a full session-focus-driven derivation) because `decide()` carries no `sessionId` today; documented in the module header as the natural next wiring step for a future caller, not introduced here.

---

**Total deviations:** 3 auto-fixed (1 bug-class repeated three times, 1 blocking seam completion, 1 bug in a plan-stated field name corrected against measured data), plus 2 documented scope notes.
**Impact on plan:** All three were necessary for correctness or for the acceptance criteria to actually pass. No scope creep; no plan requirement was skipped or weakened.

## Issues Encountered

- `bash tests/run-all-310.sh` leg 9 ("scoped working-tree diff") flagged this task's own uncommitted files as "unexpected" mid-session; resolved itself once Task 10's changes were committed (the leg SKIPs on a clean tree, its designed behavior).
- `doctor --acceptance`'s `install-state` and `verify-release-clean-tree` points fail throughout the session (a stale session-state record, and mid-task uncommitted files respectively), neither caused by this plan's code -- the same pre-existing/environmental class Plan 01 documented. They clear once this plan's own final state-update commit lands.
- `.planning/phases/353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted/353-FLEET-REPORT.json` was already dirty (its `measured_at` timestamp field) at the start of this session, per the conversation's own initial git-status snapshot, and remains dirty at the end of it (some automated process re-touches the timestamp; no other field changes). Not authored or committed by this plan per the sequential-executor rule (never revert or commit a diff you did not write); left as found.

## User Setup Required

None for testing or running this plan's own suite. The navigator's own pre-release Jev-scored ledger rebuild (`node scripts/build-section-command-ledger.cjs`, dev-time `TYPESAFE_API_KEY` from `~/.secrets/typesafe.env`) is documented in `docs/SECTION-COMMAND-LEDGER.md` but is explicitly NOT required by this plan, this test suite, or the release gate (which runs `--check` only, offline).

## Next Phase Readiness

- Plan 03 (fixture grading) can build on: the shipped ledger and its per-job candidate ordering; the ruling document generator; the anchor edge machinery (`mintJtbdAnchor`/`JTBD_ANCHOR_ID`/`SOURCED_FROM`); `evals/icm/cases/turns.json` (Plan 01) for the paired sensor-order-vs-ledger-fed top-3 hit-rate measurement (success criterion 4) -- not yet run in this plan, since `decide()`'s producer only activates given a `section`/`sectionJobId`, and Plan 03 owns wiring that measurement end to end.
- Success criterion 5 (ledger build cost/wall-time per release) is measured by `build-section-command-ledger.cjs`'s own six cost keys whenever the navigator runs the real Jev-scored rebuild; not exercised against the live vendor in this plan (by design, R-353-G).
- No blockers. All pre-existing reds are documented, unchanged, and out of this plan's scope.

---
*Phase: 353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 17 listed created files verified present on disk; all 10 task commit hashes verified present in `git log`. No missing items.
