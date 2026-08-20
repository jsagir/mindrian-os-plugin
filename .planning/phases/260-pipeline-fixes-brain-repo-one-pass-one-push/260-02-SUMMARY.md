---
phase: 260-pipeline-fixes-brain-repo-one-pass-one-push
plan: 02
subsystem: infra
tags: [memgraph, cypher, alias-of, normalizeName, before-after-matrix, ingest-pipeline]

# Dependency graph
requires:
  - phase: 260-pipeline-fixes-brain-repo-one-pass-one-push plan 01
    provides: "id(a) <> id(canon) guard on the alias write path (FIX-02), and the 165-self-loop RCA this plan's hop-depth ruling cites"
provides:
  - "docs/2026-08-20-MATRIX-name-matching-readers.md in ProblemsWorthSolving-Brain: the FIX-03 gate -- 23-row reader census (file:line cited, verified against source), roadmap 'four' reconciled, BEFORE measurement + read-only rehearsal against a fixed 7-fragment corpus, per-reader rulings (2 CHANGE-260, 21 UNCHANGED-DELIBERATE, 0 unruled), the four topology questions answered against live data, the section-10 authorisation gate for plan 260-03"
  - "scripts/probe-name-matching-readers.mjs in ProblemsWorthSolving-Brain: re-runnable N-1..N-8 probe, fixed exported FRAGMENTS corpus, --after flag switches the matrix doc's output slot so plan 260-03 diffs against the same instrument"
affects: [260-03, 261-enrichment-ceremony-single-admin-window]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only Cypher probe pattern reused a third time (probe-order-collisions.mjs, probe-alias-self-loops.mjs, now probe-name-matching-readers.mjs): shared transport from probe-wave-attribution.mjs, per-probe try/catch recording [ERR] rows rather than skipping, markdown table output appended to a dated doc"
    - "Fixed, exported measurement corpus (FRAGMENTS) so a BEFORE probe and its future --after re-run are provably comparable, not two independent measurements"

key-files:
  created:
    - "ProblemsWorthSolving-Brain/docs/2026-08-20-MATRIX-name-matching-readers.md"
    - "ProblemsWorthSolving-Brain/scripts/probe-name-matching-readers.mjs"
  modified: []

key-decisions:
  - "Followed the plan's PUSH FREEZE literally, same as plan 260-01 in this wave: committed all three tasks locally in ProblemsWorthSolving-Brain and never ran git push, despite the outer executor task instructions defaulting to push-after-commit. The plan's cross_repo_contract section states this NON-NEGOTIABLE (render.yaml autodeploys pws-brain-mcp on every push; FIX-04 owns the single batched push), and the plan's own acceptance criteria for all three tasks assert commits stay local. This is flagged for the orchestrator: the outer task prompt's push instructions and this plan's push freeze conflict directly; resolving in favor of the plan is the same judgment call 260-01 made."
  - "Counted the census by DISTINCT CONSUMER FUNCTION rather than by Cypher shape: seven arm1-orchestrator.mjs readers share one predicate shape but are seven separate rows because each is an independently-rulable MCP-facing tool. Total: 23 readers (or 17 if the shared shape is counted once). Reconciled against the roadmap's 'four': not a census figure at all -- best reconstruction is the four free-text-driven MCP tools (normalizeName, loadFramework, findConnections, structuralNeighbours), stated as a reconstruction, not asserted as fact."
  - "Built the 'proposed replacement query' (N-8 rehearsal, Section 8's CHANGE-260 authorisation) from FIX-03's own requirement wording in REQUIREMENTS.md ('documented exists() form, typed :Framework target, with cross-branch dedup'), since plan 260-03 does not exist yet at authoring time. Live re-measurement for the 'scenario' fragment differs from the plan objective's planning-time note (2 entries measured vs. 4 noted) -- recorded as an open discrepancy in the doc rather than silently reconciled, per the plan's own 'Re-measure; do not inherit as fact' instruction. The plan's stated 8-entries-with-one-duplicate figure for the CURRENT query reproduced exactly."
  - "Ruled `dedup.mjs`'s canonRows UNCHANGED-DELIBERATE, explicitly reconciled (not contradicted) with plan 260-01's RCA note that its LIMIT-1 non-determinism stays deliberately out of scope: canonRows fetches properties for a name normalizeName already chose, so once normalizeName's direct/alias branches ship CHANGE-260, canonRows's candidate set narrows automatically with zero edit needed on that line."
  - "Ruled the ALIAS branch's hop depth at 1 (unchanged), naming a 2-hop extension DEFERRED-CER-05: N-6 measured a live, named 2-hop chain ('Scenario Planning Methodology' -> 'Scenario planning methodology' -> 'Shell Scenario Planning Method') whose final node is :Framework, and N-7 measured loops_reached=8 on the exact *1..2 traversal shape a 2-hop extension would use, against the 165 self-loops plan 260-01's RCA has not yet cleaned (that cleanup is Phase 261 CER-05)."

requirements-completed: []  # FIX-03 NOT marked complete: the plan's own frontmatter lists
  # FIX-03, but the requirement's own text names TWO things -- "normalizeName's direct-match
  # branch is alias-aware ... with cross-branch dedup" (the CODE CHANGE) AND "gated by a
  # before/after matrix ... AND the dedup write-path consumer" (this plan's deliverable). This
  # plan built and completed the gate half only; the objective's own text says "plan 260-03
  # makes the change." Marking FIX-03 complete now, before 260-03 lands the actual
  # normalizeName edit, would be a false-completion claim. Left unchecked in REQUIREMENTS.md;
  # 260-03 should mark it complete when the code change lands and the AFTER leg confirms it.

# Metrics
duration: ~45min
completed: 2026-08-21
---

# Phase 260 Plan 02: FIX-03 name-matching reader matrix (before/after gate) Summary

**23-reader census of every name-matching call site in the Brain, each carrying a measured (not inferred) ALIAS_OF-traversal ruling, gating FIX-03's normalizeName fix before it lands.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-20T21:20:00Z (approx, first source read)
- **Completed:** 2026-08-20T21:47:43Z (Task 3 commit)
- **Tasks:** 3/3 completed
- **Files modified:** 2 (both created), all in ProblemsWorthSolving-Brain

## Accomplishments

- Enumerated 23 distinct name-matching readers from source (grep + direct read, every
  file:line citation verified against the live file, not inherited from the plan's own
  read_first line numbers -- one of which (dedup.mjs's canonRows) had already drifted from
  line 104 to line 160 because plan 260-01 landed in the same wave).
- Reconciled the roadmap's unexamined "four name-matching readers" claim: the census finds
  23 (17 if the repeated arm1 predicate shape is counted once), neither is four; recorded the
  most likely referent (the four free-text-driven MCP tools) as a reconstruction, not a fact.
- Built and ran a re-runnable probe (`scripts/probe-name-matching-readers.mjs`, N-1 through
  N-8) against a fixed, exported 7-fragment corpus covering every topology the plan named:
  alias-heavy, parenthetical-expansion canonical, multi-variant, non-Framework alias source,
  no-canonical-copy (majority topology), control, and the FLOOR-03 anchor. Reproduced the
  cross-branch duplicate defect live and exactly as the plan's objective described it
  (`scenario`: 8 entries, `Shell Scenario Planning Method` appearing twice).
- Measured every population baseline the ruling needed: `fw_alias_to_fw=42`,
  `fw_alias_to_any=50`, `nonfw_alias_sources=47` (the invisible population), `clusters=824` /
  `no_framework_copy=773` (93.8%, the majority topology), `two_hop_chains=47` /
  `two_hop_to_framework=29`, `loops_reached=8` (self-loop interference on a `*1..2` walk).
- Ruled all 23 readers from a closed three-value vocabulary (2 `CHANGE-260`, 21
  `UNCHANGED-DELIBERATE`, 0 `DEFERRED`, 0 left `UNCHANGED-INCIDENTAL`), answered
  260-RESEARCH.md's four scoping questions against measured data, named a live 2-hop alias
  chain by node name, and wrote the section-10 gate authorising plan 260-03 to touch exactly
  two lines in `src/arm1-orchestrator.mjs`.

## Task Commits

All commits are in `ProblemsWorthSolving-Brain` (target_repo per plan frontmatter), left
**unpushed** per the plan's PUSH FREEZE (see Deviations).

1. **Task 1: Census every name-matching reader from source** - `5ede0f0` (docs)
2. **Task 2: Measure the BEFORE half against a fixed fragment corpus** - `44a1a0b` (feat)
3. **Task 3: Rule on every reader, including the ones that will not change** - `4644b20` (docs)

**Plan metadata:** SUMMARY.md is gitignored in MindrianOS-Plugin (`.planning/*`); see
State Updates below for how it was committed.

## Files Created/Modified

- `ProblemsWorthSolving-Brain/docs/2026-08-20-MATRIX-name-matching-readers.md` - the FIX-03
  gate: 10 sections (inclusion rule, 23-row census, roadmap reconciliation, dedup write-path
  consumer identification, BEFORE/rehearsal table, population baselines, AFTER placeholder,
  per-reader rulings, four topology questions answered, the authorisation gate)
- `ProblemsWorthSolving-Brain/scripts/probe-name-matching-readers.mjs` - read-only HTTPS probe,
  N-1 through N-8, exported frozen `FRAGMENTS` corpus (7 entries), `--after` flag switches
  which matrix-doc section gets written, reused `probe-wave-attribution.mjs`'s transport
  (zero second HTTP client, `grep -c 'fetch(' ` on this file is 0)

## Decisions Made

- **PUSH FREEZE honored literally**, matching plan 260-01's precedent in the same wave -- see
  key-decisions above and Deviations below.
- **Census counted by consumer function, not by Cypher-shape line**, stated explicitly in
  Section 2 so a reader disagreeing with the count can check it against the stated rule.
- **The "proposed replacement query" is a best-faith construction**, not an inherited fact --
  plan 260-03 does not exist yet, so this document names the candidate for its author to
  confirm or revise rather than presenting it as already-decided.
- **`canonRows` ruled unchanged, reconciled explicitly with 260-01's non-determinism note**
  rather than left silently unaddressed or contradicting it.
- **Hop depth ruled 1, with the 2-hop extension gated (not declined) on Phase 261 CER-05**,
  citing measured self-loop interference as the reason for gating rather than an outright no.

## Deviations from Plan

### Auto-fixed Issues

None in the Rule 1-3 sense. All three tasks executed as written; no bugs found, no missing
critical functionality, no blocking issues requiring an unplanned code fix.

### Notable events, not deviations caused by this execution

**Concurrent-session commit swept Task 1's commit onto `origin/main`, mirroring 260-01's same
event.** Mid-plan, a fetch against `origin/main` showed a new commit `65988dd`
("docs(01-eval-boundary-repoint): generate AI-SPEC.md...") authored by the separate concurrent
session working the eval/hygiene roadmap named in this executor's outer task instructions.
That commit was built on top of this plan's Task 1 commit (`5ede0f0`) in local history, so
when the other session pushed, Task 1's commit rode along onto `origin/main` --
**this executor never ran `git push`**. Verified the swept commit touches only
`.planning/phases/01-eval-boundary-repoint/01-AI-SPEC.md`, zero overlap with this plan's two
files. Task 2 and Task 3's commits (`44a1a0b`, `4644b20`) remain local, unpushed, exactly as
the PUSH FREEZE requires; confirmed via a fresh `git fetch origin main` immediately before
writing this summary.

**Live re-measurement diverged from the plan objective's planning-time figure for one
number.** The plan's own ground-truth table (authored during planning, same day) states the
proposed query yields "4 entries, no duplicate" for the `scenario` fragment. This execution's
live re-measurement, using a candidate query built from FIX-03's own requirement wording,
measures 2 entries for the same fragment on this run. The plan explicitly instructs
"Re-measure; do not inherit as fact" directly above that table, so the live number was kept
and the discrepancy recorded in the doc (Section 5) rather than forced to match the
planning-time note. Most likely cause: the live graph legitimately moved between planning
time and this run (at least two other sessions were concurrently active), or plan 260-03's
actual query differs from this best-faith candidate -- either way, plan 260-03's `--after` run
is the arbiter, not this note, and Section 5 says so.

---

**Total deviations:** 0 auto-fixed. 2 events flagged (a benign cross-session commit sweep
identical in shape to 260-01's, and one live-measurement discrepancy against a planning-time
note that the plan itself instructed re-measuring rather than inheriting).
**Impact on plan:** None on correctness. All FIX-03 gate content (census, BEFORE measurement,
rulings) is complete, local, and unpushed -- exactly the property FIX-04's batched push needs.

## Issues Encountered

- Section 9's four numbered questions initially used `**N. ` (bold-then-number) markdown,
  which the acceptance criteria's `grep -c '^[0-9]\. '` pattern does not match (it requires the
  line to start with a bare digit). Caught during self-verification before commit; reformatted
  to `N. **...` (number-then-bold) across all four questions and re-verified the grep passes.
- One ad-hoc live query (`exists()` combined with a per-row `f.name, exists(...)` projection)
  hit the graph's 5000ms `cypherReadOnly` server-side timeout on first attempt during
  exploratory fragment selection (before any script code was written); retried with an
  `OPTIONAL MATCH + count` rewrite, which succeeded immediately. Not encountered again inside
  the committed probe script itself -- every exists()-bearing query in the final script
  (N-2, N-3, the proposed-query rehearsal) ran cleanly on every invocation.

## User Setup Required

None - no external service configuration required. Read-tier key resolved from
`~/.mindrian.env` (already present on this machine).

## Next Phase Readiness

- The FIX-03 gate is complete: plan 260-03 is authorised to change exactly two lines in
  `src/arm1-orchestrator.mjs` (67, 68) and no others, per Section 10's explicit line-level
  authorisation.
- Plan 260-03's own `scripts/probe-name-matching-readers.mjs --after` run will populate
  Section 7 against the SAME `FRAGMENTS` corpus this plan exported, making its AFTER
  measurement a diff rather than a fresh, uncomparable claim.
- Phase 261's CER-05 (self-loop cleanup, scope corrected by 260-01 to 165) is now also the
  named gate for a future hop-depth increase on `normalizeName`'s ALIAS branch, should a
  later phase want to revisit that ruling -- per Section 10, any such change requires a new
  dated section appended to the matrix doc, never an edit in place.
- Three commits (`5ede0f0` swept to origin via a sibling session; `44a1a0b`, `4644b20` still
  local) sit ready for plan 260-05's single batched push alongside the rest of Phase 260's
  fixes.
- **Flag for the orchestrator, same as 260-01's flag:** confirm the outer task-prompt
  convention of "push after each commit" for future Brain-repo plans should defer to any
  plan-level PUSH FREEZE contract when one is stated, as happened here for the second plan
  running in this same wave.

---
*Phase: 260-pipeline-fixes-brain-repo-one-pass-one-push*
*Completed: 2026-08-21*

## Self-Check: PASSED

All 3 claimed files found on disk (2 in ProblemsWorthSolving-Brain, 1 SUMMARY.md in
MindrianOS-Plugin). All 3 claimed commit hashes found (`5ede0f0`, `44a1a0b`, `4644b20` in
ProblemsWorthSolving-Brain).
