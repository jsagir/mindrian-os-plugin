---
phase: 260-pipeline-fixes-brain-repo-one-pass-one-push
plan: 01
subsystem: infra
tags: [memgraph, cypher, ingest-pipeline, dedup, alias-of, red-proof, tdd]

# Dependency graph
requires: []
provides:
  - "buildAliasStatements pure builder (src/ingest/dedup.mjs) in ProblemsWorthSolving-Brain, statement-level id(a) <> id(canon) guard against ALIAS_OF self-loop minting"
  - "docs/2026-08-20-RCA-alias-self-loop-minting.md, measured 165 self-loops (corrects the stale 41/singular-42214 framing), residuals named for Phase 261 CER-05"
  - "scripts/probe-alias-self-loops.mjs, reusable read-only S-1..S-9 probe against canon"
  - "alias-self-loop row in tests/red-proof.sh, HERMETIC (no Bolt credential needed)"
  - "payloads/relabel-fix-260820's fix_02_self_loop_check blocking precondition discharged in writing"
affects: [260-02, 261-enrichment-ceremony-single-admin-window]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure statement-builder + sabotage-seam pattern for a Cypher-emitting function (buildAliasStatements mirrors droppedNodePropKeys/nullEdgeEndpoints/pickMentionsProps in pipeline.mjs)"

key-files:
  created:
    - "ProblemsWorthSolving-Brain/scripts/probe-alias-self-loops.mjs"
    - "ProblemsWorthSolving-Brain/docs/2026-08-20-RCA-alias-self-loop-minting.md"
    - "ProblemsWorthSolving-Brain/tests/ingest-dedup-selfloop.test.mjs"
  modified:
    - "ProblemsWorthSolving-Brain/src/ingest/dedup.mjs"
    - "ProblemsWorthSolving-Brain/tests/red-proof.sh"

key-decisions:
  - "Followed the plan's PUSH FREEZE literally: committed Task 1-3 locally in ProblemsWorthSolving-Brain, did not run git push at any point, despite the Brain repo's own general CLAUDE.md convention ('no feature branches, commit straight to main, always') and this executor's outer task instructions both defaulting to push-after-commit. The plan's cross_repo_contract section is explicit, detailed, and NON-NEGOTIABLE on this point (render.yaml autodeploys on every push; FIX-04 requires one batched push owned by plan 260-05), and the plan's own acceptance criteria for all three tasks assert commits stay local (git log origin/main..HEAD >= N). Pushing would have both broken FIX-04 and made the plan's own acceptance criteria fail."
  - "Left the 2026-08-07 INCIDENT comment (dedup.mjs, citing '41 such self-loops' and '99 of the 181') untouched. Task 2's action list does not instruct editing that historical comment, and the RCA doc is the designated correction record per Task 1's own design. Editing it would have been scope creep beyond the plan's explicit action items."

requirements-completed: [FIX-02]

duration: 55min
completed: 2026-08-21
---

# Phase 260 Plan 01: Guard the alias write path against self-loop minting (FIX-02) Summary

**Statement-level `id(a) <> id(canon)` guard on the dedup alias branch in ProblemsWorthSolving-Brain, proven by a hermetic RED/GREEN test and registered in the RED-proof sabotage matrix, backed by a live-measured RCA (165 self-loops, not the stale 41).**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-08-20T21:16:00Z (approx, per first probe run timestamp)
- **Completed:** 2026-08-21T00:35:00Z (approx)
- **Tasks:** 3/3 completed
- **Files modified:** 5 (3 created, 2 modified), all in ProblemsWorthSolving-Brain

## Accomplishments

- Measured the live `ALIAS_OF` self-loop population at **165** (not the stale 41 the source
  comment claims, not the singular "42214 self-loop" the v2.1.0 roadmap's CER-05 line names),
  and wrote a full RCA walking node 42214 through the exact minting shape, plus a third
  defect (unconditional `SET a.name` renaming the canonical node on a self-pair).
- Extracted `buildAliasStatements` as a pure, exported, sabotage-seamed builder that emits a
  Cypher statement with a deterministic single-canon binding (`ORDER BY id(canon) LIMIT 1`)
  and an `id(a) <> id(canon)` guard placed so both the rename and the `ALIAS_OF` merge sit
  behind it.
- Proved the guard with a 7-test hermetic suite (no graph, no network) that is RED under
  `CONTRACT_SABOTAGE=alias-self-loop` and GREEN otherwise, and registered it as the newest
  row in `tests/red-proof.sh` -- the only ingest-side guard in that matrix provable without a
  Bolt credential.
- Discharged `payloads/relabel-fix-260820/manifest.json`'s
  `blocking_preconditions_NOT_MET.fix_02_self_loop_check` in writing (RCA section 7), while
  explicitly leaving its sibling precondition (`contested_survivor_picks`) open for Phase 261.

## Task Commits

All commits are in `ProblemsWorthSolving-Brain` (target_repo per plan frontmatter), left
**unpushed** per the plan's PUSH FREEZE (see Deviations for the one item worth flagging).

1. **Task 1: Measure the live self-loop population and write the RCA** - `8477ce3` (feat)
2. **Task 2 RED: hermetic guard proof (failing)** - `06fb7e6` (test)
2. **Task 2 GREEN: guard the alias statement** - `e3fa46a` (feat)
3. **Task 3: register alias-self-loop in the RED-proof matrix** - `5538db2` (test)

**Plan metadata:** SUMMARY.md is gitignored in MindrianOS-Plugin (`.planning/*`); see
State Updates below for how it was committed.

_TDD task 2 produced two commits (RED then GREEN) per the tdd_execution protocol; no
refactor commit was needed._

## Files Created/Modified

- `ProblemsWorthSolving-Brain/scripts/probe-alias-self-loops.mjs` - read-only HTTPS probe, S-1 through S-9, reused `resolveReadKey`/`call`/`q`/`initHandshake` from `probe-wave-attribution.mjs` (zero second HTTP client)
- `ProblemsWorthSolving-Brain/docs/2026-08-20-RCA-alias-self-loop-minting.md` - the FIX-02 RCA, measured 165 self-loops, two minting-path defects + the rename defect, guard-rehearsal proof (S-7=1, S-8=0), residuals, downstream unblock, full appendix of transcribed probe tables
- `ProblemsWorthSolving-Brain/src/ingest/dedup.mjs` - new `buildAliasStatements` pure builder (guarded statement + sabotage fallback), alias branch now calls it instead of inlining Cypher, two new flag kinds (`alias_not_mintable`, `alias_canon_has_no_id`)
- `ProblemsWorthSolving-Brain/tests/ingest-dedup-selfloop.test.mjs` - 7 hermetic tests pinning the guard, the deterministic canon binding, the rename/merge ordering, the param shape, the sabotage-seam RED proof, and the empty-aliasId no-op
- `ProblemsWorthSolving-Brain/tests/red-proof.sh` - `alias-self-loop:tests/ingest-dedup-selfloop.test.mjs` row added with its explanatory paragraph, HERMETIC noted, no existing row removed or reordered

## Decisions Made

- **PUSH FREEZE honored literally over the outer task's generic push instructions.** The
  plan's `cross_repo_contract` section states, in explicit NON-NEGOTIABLE terms, that this
  plan commits locally and never pushes (render.yaml autodeploys `pws-brain-mcp` on every
  push to `main`; FIX-04 requires all of Phase 260's fixes to ship in one batched push owned
  by plan 260-05). The outer executor task prompt separately instructed pushing after each
  commit and listed "both repos pushed" as a top-level success criterion -- that instruction
  conflicts directly with the plan's explicit contract and with the plan's own acceptance
  criteria for all three tasks (`git log origin/main..HEAD --oneline | wc -l` must be >= N,
  which would read 0 if pushed). I followed the plan, which is the artifact under execution
  and carries detailed, specific safety reasoning; the Brain repo's general "commit straight
  to main" convention in its own `CLAUDE.md` is explicitly and knowingly overridden by this
  one plan for this one phase, as the plan itself states. **This is flagged for the
  orchestrator/user:** the outer task prompt's push instructions and this plan's push freeze
  are in direct conflict; resolving in favor of the plan was the judgment call made here.
- **Left the historical 2026-08-07 INCIDENT comment in `dedup.mjs` untouched** rather than
  updating its "41 self-loops" / "99 of 181" figures inline, since Task 2's action list does
  not instruct that edit and the RCA doc is the plan's designated correction record.

## Deviations from Plan

### Auto-fixed Issues

None in the Rule 1-3 sense (no bugs found, no missing critical functionality, no blocking
issues requiring an unplanned fix). All three tasks executed as written.

### Notable event, not a deviation caused by this execution

**Concurrent-session push swept Task 1's commit onto `origin/main`.** Mid-plan, a fetch
against `origin/main` showed a new commit `709f56c` ("fix(01): strike brain_ask_anything...")
authored by a separate concurrent session sharing this working tree (per the standing
multi-session warning in this repo's own `CLAUDE.md`). That commit was built on top of this
plan's Task 1 commit (`8477ce3`) in local history, so when the other session pushed, Task 1's
commit rode along onto `origin/main` -- **this executor never ran `git push`**. Verified the
swept commit touches only unrelated GSD tracking docs (`01-CONTEXT.md`, `REQUIREMENTS.md`,
`ROADMAP.md`, `PROJECT.md` in the `01-eval-boundary-repoint` phase), with zero overlap with
`dedup.mjs`, `red-proof.sh`, or this plan's new files -- no merge conflict risk. Task 1's own
content (`probe-alias-self-loops.mjs`, the RCA doc) is inert: neither is imported by any
production code path, so the FIX-04 concern (deploying a half-fixed ingest pipeline) does not
apply to what got swept. The actual FIX-02 code change (`dedup.mjs`, guarded now) and the
`red-proof.sh` registration -- the parts that touch live ingest behavior -- remain unpushed
local commits, exactly as the PUSH FREEZE requires. Confirmed via fresh `git fetch origin
main`: `origin/main..HEAD` shows exactly 3 commits (`06fb7e6`, `e3fa46a`, `5538db2`), matching
Task 2 and Task 3.

---

**Total deviations:** 0 auto-fixed. 1 cross-session event flagged (push freeze integrity
holds for the load-bearing commits; Task 1's inert docs/probe commit reached origin via a
sibling session's push, not this execution's).
**Impact on plan:** None on correctness. The guard, its RED/GREEN proof, and its red-proof.sh
registration are all still local and unpushed, which is the property FIX-04 actually needs.

## Issues Encountered

- The RCA doc's first draft had only 5 markdown table rows (`grep -c '^| '`), short of the
  plan's `>= 9` acceptance threshold. Fixed by adding a full appendix transcribing all nine
  probe tables (S-1 through S-9) verbatim from the run output, bringing the count to 46.
- Two of Task 3's `grep -c` acceptance-criteria lines (`moat:tests/ingest-admin-gate.test.mjs`
  expected `1`, `e5:tests/ingest-embed.test.mjs` expected `1`) do not match the actual
  pre-existing file: both already appear twice in `tests/red-proof.sh` on `origin/main`
  (once in the guard's explanatory comment, once in the `GUARDS=` list), confirmed via
  `git show HEAD:tests/red-proof.sh` before this plan's edit. This is a planner miscount
  against the real file, not something this execution introduced or could fix without either
  breaking the established per-guard comment-then-list convention (which Task 3's own
  `read_first` instructs following) or removing content that predates this plan. The new
  `alias-self-loop` row follows the identical established convention (comment + list = 2
  occurrences), consistent with every other guard in the file. The functional intent of the
  check -- "no existing row was removed" -- holds: both counts are unchanged before and after
  this plan's edit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- FIX-02's guard is implemented, hermetically proven, and registered in the RED-proof matrix,
  unblocking `payloads/relabel-fix-260820`'s `fix_02_self_loop_check` precondition per the
  RCA's section 7.
- Three commits (`06fb7e6`, `e3fa46a`, `5538db2`) sit local in `ProblemsWorthSolving-Brain`,
  ready for plan 260-05's single batched push alongside the rest of Phase 260's fixes.
- Phase 261 CER-05 should re-scope its self-loop cleanup target to the measured **165**, not
  the single "42214 self-loop" its current roadmap line names.
- Plan 260-02 (FIX-03, the alias-aware `normalizeName` matrix) is unblocked to proceed; this
  plan's residuals section explicitly leaves the stranded-2-hop-chain question to it.
- **Flag for the orchestrator:** confirm the outer task-prompt convention of "push after
  each commit" for future Brain-repo plans should defer to any plan-level PUSH FREEZE
  contract when one is stated, as happened here.

---
*Phase: 260-pipeline-fixes-brain-repo-one-pass-one-push*
*Completed: 2026-08-21*

## Self-Check: PASSED

All 6 claimed files found on disk (5 in ProblemsWorthSolving-Brain, 1 SUMMARY.md in
MindrianOS-Plugin). All 5 claimed commit hashes found (`8477ce3`, `06fb7e6`, `e3fa46a`,
`5538db2` in ProblemsWorthSolving-Brain; `d1f9d7f4` in MindrianOS-Plugin).
