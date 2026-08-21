---
phase: 261-enrichment-ceremony-single-admin-window
plan: 01
subsystem: brain-graph-measurement
tags: [memgraph, cypher, mcp, orchestration-readiness, flagship-floor, brain-repo]

# Dependency graph
requires:
  - phase: 260-pipeline-fixes-brain-repo-one-pass-one-push
    provides: FIX-01/02/03/04 deployed live (prop-drop fix, self-loop guard, alias-aware
      normalizeName), the push freeze this plan operates under
provides:
  - "scripts/probe-ceremony-worklist.mjs (ProblemsWorthSolving-Brain): read-tier probe, 9
    [W-n] measurements mirroring orchestrationReadiness"
  - "docs/2026-08-21-WORKLIST-261-ceremony.md (ProblemsWorthSolving-Brain): the single
    measured worklist every downstream Phase 261 plan reads"
affects: [261-02, 261-03, 261-04, 261-05, 261-06, 261-07, 261-08, 261-09, 261-10, 261-11, 261-13]

# Tech tracking
tech-stack:
  added: []
  patterns: ["read-tier probe scripts import transport from an existing probe-*.mjs rather
    than minting a second HTTP client (Canon Part 7)"]

key-files:
  created:
    - ProblemsWorthSolving-Brain/scripts/probe-ceremony-worklist.mjs
    - ProblemsWorthSolving-Brain/docs/2026-08-21-WORKLIST-261-ceremony.md
  modified: []

key-decisions:
  - "Worked around a live server-side cache-collision bug (combined 5-column WITH/RETURN
    aggregate silently serves a stale value under a garbled key once ~10+ prior queries
    have run in-session) by splitting the archived-block aggregate into four
    single-purpose queries instead of the literal Cypher in 261-RESEARCH.md's Reproduce
    section; verified stable, not fixed server-side (out of this read-only plan's scope)"
  - "PASS/MISS verdict in the worklist requires BOTH resolver-matches-exactly-1 AND
    readiness>=3 (the same two-part rule check-flagship-floor.cjs enforces), not readiness
    alone -- this is why Scenario Planning is scored MISS despite measuring 3/4 readiness"
  - "Reuse-audit dispositions for all 8 existing payloads are evidence-backed (live node
    id/structure/technique comparison against each payload's own documented content), not
    inferred from filenames or commit history alone"

patterns-established:
  - "Ratified-28 readiness measurement pattern: raw case-insensitive [W-1] vs
    normalize_framework_name resolver [W-2], reported separately and cross-checked for
    disagreement (the FLOOR-03 class), rather than trusting either alone"

requirements-completed: [CER-01, CER-02, CER-03, CER-04, CER-05, CER-06]

# Metrics
duration: ~25min
completed: 2026-08-21
---

# Phase 261 Plan 01: Ceremony Worklist Measurement Summary

**Live-measured the ceremony's real worklist (11/28 PASS by the two-part floor rule, 19 Tier A
candidates, 165 self-loops, 100/99/95 archived block, brain_write ABSENT) and found that 4 of 5
already-authored flagship payloads silently lost `pattern_type` on ingest, confirming Phase 260's
FIX-01 prop-drop finding with fresh evidence.**

## Performance

- **Duration:** ~25 min (not separately timestamped at start; bounded by the probe's first live
  run at 2026-08-21T06:27:38Z UTC and this summary's completion at 2026-08-21T06:39:29Z UTC)
- **Tasks:** 2/2 completed
- **Files modified:** 2 (both created, both in `ProblemsWorthSolving-Brain`)

## Accomplishments

- Built and ran `scripts/probe-ceremony-worklist.mjs`: a read-tier probe emitting all nine
  `[W-n]` measurements the ceremony's payload set is sized against, mirroring
  `src/arm1-orchestrator.mjs`'s `orchestrationReadiness` Cypher byte-for-byte and importing its
  HTTP transport from `scripts/probe-wave-attribution.mjs` (no second client minted).
- Wrote `docs/2026-08-21-WORKLIST-261-ceremony.md`: the single measured worklist document every
  other Phase 261 plan reads, replacing the 2026-08-13 kickoff baseline that three write waves
  since invalidated.
- Live numbers cross-check exactly against the planner's own independent 2026-08-21 read-tier
  measurement recorded in `261-01-PLAN.md`'s objective (19 Tier A candidates, 6/28/27/11/114
  readiness distribution, 165 self-loops, 100/99/95 archived block), giving strong confidence the
  probe measures correctly.
- Reuse audit (Section 4) determined, with live evidence per row, that 6 of 8 existing payload
  files already executed against canon and should not be re-run (`RETIRE`), one targets a
  disputed node id and needs a ruling before re-use (`RETARGET`, `minto-pyramid.mjs`), and one
  should be re-run now that FIX-01 has landed (`RUN`, `mullins-seven-domains.mjs`, still MISSing
  the floor at 2/4 due to the same prop-drop pattern).
- Attribution ledger (Section 5) named 6 write waves since the kickoff baseline, including one
  (a PWS Value Proposition enrichment, readiness 0 to 3) that is genuinely unattributed rather
  than merely un-logged in `GRAPH-WRITE-LOG.md`.
- Resolved the heal-run readiness contradiction (Section 6) by citing
  `src/arm1-orchestrator.mjs:276-295`'s four dimensions: the 2026-08-20 heal wrote description/
  category/routing/chain/authorship/alias edges, none of which the readiness gate measures, so
  its "184 frameworks to 4/4" claim and this probe's live 6/28/27/11/114 distribution are both
  true and describe two different things. Neither number was adjusted to force agreement.

## Task Commits

Both commits made in `ProblemsWorthSolving-Brain` (local, NOT pushed, per the standing freeze):

1. **Task 1: Build and run the ceremony worklist probe** - `d943167` (feat)
2. **Task 2: Write the worklist, the reuse audit, and the attribution ledger** - `8d520b0` (docs)

**Plan metadata (this repo, MindrianOS-Plugin):** pending final commit alongside STATE.md/
ROADMAP.md below.

## Files Created/Modified

- `ProblemsWorthSolving-Brain/scripts/probe-ceremony-worklist.mjs` (387 lines) - the nine-probe
  read-tier measurement script
- `ProblemsWorthSolving-Brain/docs/2026-08-21-WORKLIST-261-ceremony.md` (285 lines) - the
  transcribed, measured worklist document

## Decisions Made

- **Split the [W-6] archived-block aggregate into four single-purpose queries** instead of the
  literal combined 5-column `WITH ... RETURN` Cypher `261-RESEARCH.md`'s own Reproduce section
  specifies. That exact combined shape reproducibly returned a corrupted value (a copy of
  `min_id`) under a garbled key for the last column once the probe had already issued roughly a
  dozen prior distinct queries in the same session -- a live cache-collision bug on the tool's
  query-result path, not a probe bug (confirmed by isolating the same query in a fresh session,
  where it returns correctly). Root-causing the server-side bug is out of this read-only plan's
  scope; it is named plainly in both the probe script's inline comment and the worklist
  document's Section 7, for a future session to pick up.
- **PASS requires resolver-matches-exactly-1 AND readiness>=3**, mirroring
  `check-flagship-floor.cjs`'s own two-part gate, not readiness alone. This is why the worklist's
  Section 2 totals (11 PASS / 17 MISS) differ from the planner's readiness-only reading of the
  same live data (12 at readiness>=3): `Scenario Planning` measures 3/4 readiness but 2 resolver
  matches, so it is MISS under the actual floor rule, matching `FLOOR-03`'s open item in
  `.planning/REQUIREMENTS.md`.
- **Verified every reuse-audit disposition with a live query** rather than filenames or the
  payloads' own header comments alone (e.g. `invention-disclosure.mjs`'s target was confirmed by
  matching the live node's `id` property against the payload's `FW_ID` constant;
  `project-list-structure.mjs`'s 9 targets were confirmed by comparing live `ProcessStep` counts
  against `PROJECTION_PLAN`'s expected counts).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Worked around a live cache-collision bug in the combined `[W-6]` aggregate query**
- **Found during:** Task 1, first live run of the probe
- **Issue:** The exact 5-column `WITH ... RETURN` Cypher from `261-RESEARCH.md`'s Reproduce
  section returned a corrupted value for `in_28k_block` (19561, a copy of `min_id`, instead of
  the correct 95) under a garbled key once the probe had already run ~15+ other queries in the
  same session. Reproduced deterministically via an isolated debug script: the same query text
  returns correctly as the first query of a fresh session and incorrectly after warmup.
- **Fix:** Replaced the single combined aggregate with four single-purpose queries (`demoted`,
  `also_archived`, `min_id`/`max_id`, `in_28k_block`), each verified to return the correct,
  stable value under the same warmed-cache conditions across repeated runs.
- **Files modified:** `ProblemsWorthSolving-Brain/scripts/probe-ceremony-worklist.mjs`
- **Verification:** Re-ran the full probe twice after the fix; `[W-6]` consistently reported
  100/99/19561/38140/95, matching `261-RESEARCH.md`'s own stated figures (100/99/95) exactly.
- **Committed in:** `d943167` (Task 1 commit)

**2. [Rule 3 - Blocking] Hit the live rate limiter mid-run, waited and re-ran clean**
- **Found during:** Task 1, a run immediately following heavy ad hoc debug-script traffic
  against the same read-tier key
- **Issue:** `HTTP 429: Rate limit exceeded` (per-key limiter, 120 requests/60s window per
  `src/http/rate-limit.mjs`) aborted a probe run mid-`[W-2]`.
- **Fix:** Waited for the fixed window to clear, then re-ran the probe as the next call after
  the wait with no other traffic; completed cleanly, exit 0.
- **Files modified:** none (no code change; a pacing/timing issue, not a logic bug)
- **Verification:** Clean exit-0 run, all nine `[W-n]` sections present.
- **Committed in:** n/a (no code change to commit for this item)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking/environmental)
**Impact on plan:** Both fixes were necessary to produce a trustworthy measurement (TRUST-02's
VOID doctrine: a run with a failed or silently-wrong probe is not a measurement). No scope creep;
neither touched the payload's actual measurement logic beyond correctness.

## Issues Encountered

- Discovered mid-Task-2 (not a blocker, but worth flagging loudly): 4 of the 5 flagship payloads
  landed in commit `aa15966` (`jobs-to-be-done.mjs`, `lean-canvas.mjs`, `minto-pyramid.mjs`,
  `mullins-seven-domains.mjs`) already executed against canon with `pattern_type` silently
  dropped, landing one readiness dimension short of their own documented expected outcome. This
  is exactly the class of defect FIX-01 (phase 260-04) closes, confirming the phase-260 handoff's
  "FIX-01's live round-trip pre-item, before CER-01 through CER-04" with fresh live evidence
  rather than a theoretical risk. Recorded in the worklist document's Section 4 for the CER-01
  through CER-04 plans to act on; not fixed here (read-only plan).
- `minto-pyramid.mjs`'s already-executed target node (id 38968) is the same node
  `payloads/relabel-fix-260820/manifest.json`'s `blocking_preconditions_NOT_MET.contested_
  survivor_picks` independently flags as disputed between that payload and
  `origin/audit/2026-08-20-brain-heal`'s `alias-review.md`. Named as `RETARGET` in Section 4;
  the actual node-identity ruling is out of this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `docs/2026-08-21-WORKLIST-261-ceremony.md` is ready for every downstream Phase 261 plan
  (261-02 through 261-13) to read as its single worklist input, per this plan's own objective.
- CER-01 (Tier A) has its exact 19-row worklist named with ids, ready for a single digest card.
- CER-02/CER-03 (Cohort 1/2) have their now-corrected 7+7 MISS rows (3 rows dropped from
  Cohort 1 by live measurement: Lean Canvas, Six Thinking Hats, PWS Value Proposition), each
  with a live readiness vector and a source doc path, satisfying "no named read source = no
  payload."
- CER-04 (PEST Analysis) and CER-06 (Four Lenses of Innovation) both have a confirmed source and
  a live absence/readiness measurement, ready to author.
- CER-05's DELETE scope is re-confirmed at 165 self-loops (not the roadmap's "the 42214
  self-loop" singular), with a full label census.
- Blocker/watch item for whichever plan next touches `minto-pyramid.mjs` or the alias-collapse
  work: the contested-survivor-pick ruling (Minto Pyramid id 38968, PWS id 38305/40377) remains
  genuinely open; this plan surfaces it again but does not adjudicate it, per its own scope.
- Admin exposure confirmed closed (`brain_write` and `ingest_framework` both ABSENT) at worklist
  time, 2026-08-21T06:33:34.652Z -- a fresh check should still happen at each subsequent plan's
  own execution time per this repo's own discipline (state can drift between commits, since the
  Brain auto-deploys on every push to `main`).

---
*Phase: 261-enrichment-ceremony-single-admin-window*
*Completed: 2026-08-21*
