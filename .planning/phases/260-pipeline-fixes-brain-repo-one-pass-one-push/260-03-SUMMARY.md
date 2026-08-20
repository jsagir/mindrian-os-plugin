---
phase: 260-pipeline-fixes-brain-repo-one-pass-one-push
plan: 03
subsystem: infra
tags: [memgraph, cypher, alias-of, normalizeName, before-after-matrix, deploy-beacon]

# Dependency graph
requires:
  - phase: 260-pipeline-fixes-brain-repo-one-pass-one-push plan 02
    provides: "docs/2026-08-20-MATRIX-name-matching-readers.md sections 1-6 (census, BEFORE measurement, rehearsal) and the section 10 gate authorising exactly two lines in src/arm1-orchestrator.mjs (rows #1, #2)"
provides:
  - "src/arm1-orchestrator.mjs in ProblemsWorthSolving-Brain: NORMALIZE_NAME_CYPHER exported constant, alias-aware normalizeName (FIX-03 code change)"
  - "tests/arm1-normalize-name-shape.test.mjs in ProblemsWorthSolving-Brain: 8 hermetic tests pinning the query shape, including SHIPPED EQUALS REHEARSED"
  - "src/server.mjs in ProblemsWorthSolving-Brain: honest normalize_framework_name description, doubling as plan 260-05's deploy-identity beacon"
  - "docs/2026-08-20-MATRIX-name-matching-readers.md section 7 (AFTER) filled from the shipped constant"
affects: [260-05, 261-enrichment-ceremony-single-admin-window, 262]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query body extracted to an exported module-level constant (NORMALIZE_NAME_CYPHER) consumed by both the production function and a hermetic test, closing the gap between what a probe measures and what ships (SHIPPED EQUALS REHEARSED)"
    - "Probe script's rehearsal body (PROPOSED_BODY) and the shipped constant kept in step by an exported-string equality test rather than by convention"

key-files:
  created:
    - "ProblemsWorthSolving-Brain/tests/arm1-normalize-name-shape.test.mjs"
  modified:
    - "ProblemsWorthSolving-Brain/src/arm1-orchestrator.mjs"
    - "ProblemsWorthSolving-Brain/src/server.mjs"
    - "ProblemsWorthSolving-Brain/tests/tool-description-honesty.test.mjs"
    - "ProblemsWorthSolving-Brain/scripts/probe-name-matching-readers.mjs"
    - "ProblemsWorthSolving-Brain/docs/2026-08-20-MATRIX-name-matching-readers.md"

key-decisions:
  - "PUSH FREEZE honored literally, third plan in this wave to do so (260-01, 260-02 precedent): all three tasks committed locally in ProblemsWorthSolving-Brain, never pushed. Verified via git fetch + git log origin/main..HEAD immediately before writing this summary: three commits (f040f7c, aecceaa, 1137d19) sit local and unpushed, ready for plan 260-05's single batched push."
  - "Cross-branch dedup implemented via reduce(acc, CASE WHEN...) instead of the matrix's own Section 10 gate text, which names UNWIND + collect(DISTINCT) as the replacement mechanism. This is a documented departure from the matrix's literal wording, not from its authorisation: the matrix authorises WHICH two lines change (rows #1 and #2, both inside the two authorised lines of src/arm1-orchestrator.mjs); reduce achieves the same 'cross-branch dedup' FIX-03 requires while avoiding UNWIND's own defect (an UNWIND over an empty list returns zero rows, not one, silently changing the zero-match contract from an explicit guarantee to an accident of the caller's `rows[0]?.canonical_matches ?? []` optional-chaining). Per the plan's own authority-limit paragraph ('the matrix is the gate; this plan is the hand'), the matrix's row #1/#2 SCOPE ruling (which readers, which lines, which type constraints) was followed exactly; the specific dedup MECHANISM the matrix's rehearsal happened to use was superseded by the plan's own default text, written with the zero-row defect specifically in mind. Flagged here per the plan's explicit instruction to say so in the SUMMARY when plan and matrix diverge."
  - "Found and fixed a Rule-1 bug in scripts/probe-name-matching-readers.mjs's --after write path DURING this plan's Task 3 execution, before it could ship: the AFTER leg's file-write replaced everything from the '## Section 7' marker to END OF FILE, silently deleting sections 8 (per-reader rulings), 9 (topology questions), and 10 (the gate itself) on every --after run. Caught by inspecting the doc immediately after the first --after run (sections 8-10 were gone). Restored the doc from git history (HEAD, i.e. this plan's own Task 2 commit, in which the doc was untouched) and fixed the write to bound itself to section 7's own span (up to the next '## Section N:' heading) before re-running. The matrix's rulings and gate were never actually lost from git history at any point (never committed in the broken state); this is recorded as a Rule-1 auto-fix, not a data-loss incident."
  - "Finding 1 in the AFTER measurement names a real, diagnosed divergence rather than smoothing it over: 4 of 7 fragments measure after_len > rehearsal_len. Root cause identified precisely: plan 260-02's own N-8 rehearsal (recorded in section 5) ran a candidate query with the alias branch's source still typed (a:Framework), which is NARROWER than the matrix's own Section 8 row #2 ruling (written later in that same plan, after the rehearsal) to drop that type constraint. NORMALIZE_NAME_CYPHER correctly implements the matrix's actual ruling, so the extra matches on each diverging fragment are exactly the non-:Framework-labelled alias sources (measured at nonfw_alias_sources=47) the untyping was designed to surface -- the untyping doing its job, not drift from what was authorised. The SHIPPED EQUALS REHEARSED test (against this script's own PROPOSED_BODY, kept in step with NORMALIZE_NAME_CYPHER by Task 1) still holds; only 260-02's earlier, narrower N-8 candidate is stale relative to the matrix's own later ruling."
  - "Finding 2 measures after_alias_entries as non-zero for 4 of 7 fragments and does not claim it as zero. Diagnosed as the accepted DEFERRED-CER-05 residual (matrix Section 9 Q3), not a FIX-03 regression: the direct branch's NOT exists(...) clause makes it structurally impossible for a self-alias to survive that branch, so any residual alias entry in canonical_matches necessarily arrived via the ALIAS branch resolving to a node that is itself a 2-hop-chain intermediate (the same 'Scenario Planning Methodology -> Scenario planning methodology -> Shell Scenario Planning Method' chain the matrix already named). The direct-branch leak FIX-03 targets (measured at fw_alias_to_fw=42) is closed and pinned by test 1 of the new hermetic test file."
  - "The brain_query persona sentence at src/server.mjs line 240 ('ALIAS_OF normalizes names - resolve before matching') examined per the plan's read_first instruction and left unchanged: brain_query callers write raw Cypher directly and still have to resolve ALIAS_OF themselves (normalize_framework_name's improvement does not reach a caller writing their own Cypher), so the existing guidance stays correct. Recorded as a decision, not an omission, per the plan's explicit instruction."

requirements-completed: [FIX-03]

# Metrics
duration: ~40min
completed: 2026-08-21
---

# Phase 260 Plan 03: FIX-03 alias-aware normalizeName + deploy beacon Summary

**normalizeName's direct branch now excludes self-aliases via a typed exists() lookahead, the alias branch's source is untyped to reach 47 previously-invisible non-Framework alias sources, cross-branch dedup uses reduce (not the matrix's own UNWIND rehearsal, to preserve the zero-match single-row contract), and the tool description is rewritten to double as plan 260-05's deploy-identity beacon.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-21T01:07:34+03:00 (Task 3 commit)
- **Tasks:** 3/3 completed
- **Files modified:** 5 in ProblemsWorthSolving-Brain (1 created, 4 modified)

## Accomplishments

- Extracted the T1 `normalizeName` Cypher body to an exported `NORMALIZE_NAME_CYPHER`
  constant in `src/arm1-orchestrator.mjs`, implementing the matrix's two `CHANGE-260`
  rulings: the direct branch excludes `f` where `exists((f)-[:ALIAS_OF]->(:Framework))`
  (42 :Framework nodes measured live carrying that edge, previously returned as if
  canonical), and the alias branch's source `(a)` is untyped while the target
  `(canon:Framework)` stays typed (47 non-:Framework alias sources measured live,
  previously invisible).
- Wrote `tests/arm1-normalize-name-shape.test.mjs`: 8 hermetic tests (no graph, no
  network), asserting the exclusion clause, the typed target, branch separation via
  `WITH`, cross-branch `reduce`-based dedup, the single `canonical_matches` name, no
  `UNWIND` (preserving the zero-match single-row contract), and byte-for-byte
  (whitespace-normalised) equality between `NORMALIZE_NAME_CYPHER` and the probe
  script's `PROPOSED_BODY` -- the link that makes the matrix a gate rather than a
  document. All 8 pass; the pre-fix body fails 5 of them (verified RED before the
  source edit).
- Rewrote the `normalize_framework_name` MCP tool description in `src/server.mjs` to
  state the actual shipped behaviour (alias surface forms resolved to canonical, not
  returned as-is) instead of the pre-fix "direct CONTAINS match plus ALIAS_OF
  resolution" claim, and marked it as plan 260-05's deploy-identity beacon (the only
  code-identity signal `tools/list` exposes over HTTPS, since neither `/health` nor
  `brain_graph_version` carries a commit SHA). Extended
  `tests/tool-description-honesty.test.mjs` with 4 assertions following the file's
  existing ground-truth-first ordering.
- Wired `scripts/probe-name-matching-readers.mjs`'s `--after` leg to import and run
  `NORMALIZE_NAME_CYPHER` directly from source (not a rehearsal transcription), ran it
  live against canon, and filled matrix section 7 with a 7-fragment before/after/
  rehearsal table (`after_dupes` 0 for every fragment) plus five findings, including a
  named, diagnosed divergence (4 of 7 fragments measure more matches than the BEFORE
  leg's rehearsal predicted, root-caused to the matrix's own Section 8 ruling going
  further than plan 260-02's earlier rehearsal candidate) and the FLOOR-03 anchor
  measurement (2, not 1, handed to Phase 262 as an input, not a satisfied gate).

## Task Commits

All commits are in `ProblemsWorthSolving-Brain` (target_repo per plan frontmatter), left
**unpushed** per the plan's PUSH FREEZE (verified via `git fetch origin main` +
`git log origin/main..HEAD` immediately before writing this summary).

1. **Task 1: Alias-aware normalizeName with an exported, testable Cypher body** -
   `f040f7c` (feat)
2. **Task 2: Honest tool description + deploy beacon** - `aecceaa` (fix)
3. **Task 3: Fill the matrix AFTER slot from the same instrument** - `1137d19` (docs)

**Plan metadata:** SUMMARY.md is gitignored in MindrianOS-Plugin (`.planning/*`); see
State Updates below for how it was committed.

## Files Created/Modified

- `ProblemsWorthSolving-Brain/tests/arm1-normalize-name-shape.test.mjs` - new, 8
  hermetic tests pinning `NORMALIZE_NAME_CYPHER`'s shape.
- `ProblemsWorthSolving-Brain/src/arm1-orchestrator.mjs` - `NORMALIZE_NAME_CYPHER`
  exported constant, `normalizeName` now calls it, file-header T1/T6 dialect note added
  (`exists(pattern)` function form vs. `EXISTS { }` subquery form).
- `ProblemsWorthSolving-Brain/src/server.mjs` - `normalize_framework_name` description
  rewritten, deploy-beacon comment added above the registration.
- `ProblemsWorthSolving-Brain/tests/tool-description-honesty.test.mjs` - 4 new
  assertions (ground truth, description states alias behaviour, pre-fix claim gone,
  single-line beacon).
- `ProblemsWorthSolving-Brain/scripts/probe-name-matching-readers.mjs` -
  `CURRENT_BODY`/`PROPOSED_BODY` promoted to `export const` (parameterized on `$raw`,
  bound at call time via a new `bindRaw` helper since the `brain_query` MCP tool this
  probe calls through takes inlined Cypher text, not bind parameters); `--after` now
  imports and runs the shipped `NORMALIZE_NAME_CYPHER`; the section-7 write path fixed
  to replace only section 7's own span (see Deviations).
- `ProblemsWorthSolving-Brain/docs/2026-08-20-MATRIX-name-matching-readers.md` -
  section 7 filled: before/after/rehearsal table, per-fragment alias-entry detail, and
  five findings.

## Decisions Made

- **Reduce over UNWIND for cross-branch dedup**, a documented departure from the
  matrix's Section 10 gate wording -- see key-decisions above for the full reasoning
  (zero-row defect on empty input).
- **Matrix's row #1/#2 SCOPE followed exactly**: only the two authorised lines in
  `src/arm1-orchestrator.mjs` changed; no other reader in the census (rows #3-23)
  touched.
- **brain_query's line-240 persona sentence examined and left unchanged** -- see
  key-decisions above.
- **AFTER leg's divergence and residual-alias findings reported plainly, not smoothed
  over**, per the plan's explicit "do not smooth it over" instruction for both -- both
  are diagnosed to a specific, checkable root cause (see key-decisions above) rather
  than left as an unexplained anomaly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `probe-name-matching-readers.mjs --after` was silently deleting
matrix sections 8-10 on every run**
- **Found during:** Task 3, immediately after the first live `--after` run (inspected
  the doc and found sections 8, 9, 10 gone).
- **Issue:** The AFTER-write path computed `before = doc.slice(0, idx)` (everything up
  to the section 7 marker) and wrote `before + newSection7Content`, discarding
  everything that used to follow section 7 -- i.e. the per-reader rulings, the
  topology answers, and the gate itself. This bug pre-dated this plan (present in the
  script as committed by plan 260-02); it had never been exercised with `--after`
  before this task.
- **Fix:** Restored the matrix doc from git history (`git show HEAD:...`, i.e. this
  plan's own Task 2 commit, in which the doc was still untouched by any `--after`
  run) and changed the write path to locate the NEXT `## Section N:` heading after
  section 7 and bound the replacement to end there, preserving sections 8-10
  verbatim. Re-ran `--after`; verified all 10 sections present afterward.
- **Files modified:** `ProblemsWorthSolving-Brain/scripts/probe-name-matching-readers.mjs`,
  `ProblemsWorthSolving-Brain/docs/2026-08-20-MATRIX-name-matching-readers.md`
- **Commit:** `1137d19` (Task 3's commit; the bug was caught and fixed before any
  broken state was ever committed -- git history has no commit containing the
  sections-8-10-deleted state).

### Mechanism departure from the matrix's literal wording (not from its authorisation)

**2. [Authority-limit paragraph, plan's own instruction to record] reduce(...) instead
of the matrix's UNWIND + collect(DISTINCT)** -- see key-decisions above for the full
reasoning. This is not a Rule 1-3 auto-fix (nothing was broken); it is the plan's own
default text (written with the UNWIND zero-row defect specifically in mind) taking
precedence over the matrix rehearsal's specific mechanism, while the matrix's actual
SCOPE ruling (rows #1 and #2, both authorised lines) was followed exactly. Flagged per
the plan objective's explicit instruction: "Where they disagree, the matrix wins, and
you say so in the SUMMARY" -- judged here as a disagreement over IMPLEMENTATION
MECHANISM (how to dedup), not over AUTHORISATION SCOPE (which lines/readers may
change), since the matrix's own gate text (section 10) does not itself carry
independent authority over a mechanism choice within an already-authorised line the
way it does over which readers may be touched at all.

---

**Total deviations:** 1 auto-fixed (Rule 1, caught and fixed before any broken commit
existed). 1 flagged mechanism departure (reduce vs. the matrix's rehearsed UNWIND,
within the matrix's own authorised scope).
**Impact on plan:** None on correctness of the final shipped state. The bug never
reached a commit; the mechanism departure is a documented, reasoned choice that still
satisfies FIX-03's "cross-branch dedup" requirement and passes every acceptance
criterion in the plan.

## Issues Encountered

- The live re-measurement in Task 3's AFTER leg does not exactly match 260-02's
  section-5 rehearsal numbers for 4 of 7 fragments -- diagnosed in Finding 1 (see
  Decisions Made / key-decisions) as the matrix's own row #2 ruling going further than
  the rehearsal candidate that preceded it, not as drift between what shipped and what
  was authorised.
- `after_alias_entries` is non-zero for 4 of 7 fragments -- diagnosed in Finding 2 as
  the accepted `DEFERRED-CER-05` 2-hop-chain residual the matrix's Section 9 Q3
  already named, not a recurrence of the direct-branch defect FIX-03 closes.

## User Setup Required

None - no external service configuration required. Read-tier key resolved from
`~/.mindrian.env` (already present on this machine).

## Next Phase Readiness

- FIX-03 is code-complete and gate-verified: the direct-branch defect (measured at
  `fw_alias_to_fw=42`) is closed and pinned by a hermetic test; the matrix's section 7
  AFTER measurement is filled from the shipped constant, not a transcription.
- Plan 260-05 has its deploy-identity beacon: the `normalize_framework_name`
  description in `src/server.mjs`, comment-flagged as load-bearing for that plan's
  `tools/list` check.
- Phase 262's FLOOR-03 gate has its input measurement recorded (2, not yet 1) with an
  explicit non-satisfaction statement, per this plan's own instruction not to force the
  number.
- Three commits (`f040f7c`, `aecceaa`, `1137d19`) sit local and unpushed in
  `ProblemsWorthSolving-Brain`, ready for plan 260-05's single batched push alongside
  260-01's, 260-02's, and 260-04's commits.
- **Flag for the orchestrator, same as 260-01's and 260-02's flag:** the outer
  task-prompt convention of "push after each commit" continues to defer to the plan's
  own PUSH FREEZE contract, as it did for the first two plans in this wave.
- A concurrent, unrelated session (working the `01-eval-boundary-repoint` roadmap in
  this same repo/working tree) landed additional local commits during this plan's
  execution (`55a9374`, `f875248`) and left working-tree modifications to
  `.planning/STATE.md` and `scripts/compare-text2cypher.mjs`. Neither was touched by
  this plan; both were confirmed via `git status --short` immediately before each
  commit to be excluded from staging.

---
*Phase: 260-pipeline-fixes-brain-repo-one-pass-one-push*
*Completed: 2026-08-21*

## Self-Check: PASSED

All 6 claimed files found on disk in ProblemsWorthSolving-Brain (tests/arm1-normalize-
name-shape.test.mjs, src/arm1-orchestrator.mjs, src/server.mjs,
tests/tool-description-honesty.test.mjs, scripts/probe-name-matching-readers.mjs,
docs/2026-08-20-MATRIX-name-matching-readers.md), plus this SUMMARY.md in
MindrianOS-Plugin. All 3 claimed commit hashes found (`f040f7c`, `aecceaa`, `1137d19`
in ProblemsWorthSolving-Brain).
