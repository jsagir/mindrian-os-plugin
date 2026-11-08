---
phase: 370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude
plan: 03
subsystem: review-contract
tags: [owner-card, answer-gate, needs-human]
requires: [370-02]
provides:
  - 370-gate.cjs (answer gate: selftest, check-decision, seal, gate-group, gate-item, resolve)
  - 370-DECISION.md (3 groups, 8 items, sealed, every answer PENDING)
affects: [370-04, 370-05, 370-06, 370-07, 370-08, 370-09, 370-10]
key-files:
  created:
    - .planning/phases/370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude/370-gate.cjs
    - .planning/phases/370-review-contract-for-mos-grade-and-mos-deep-grade-fixed-stude/370-DECISION.md
  modified: []
requirements-completed: [REV370-05]
completed: 2026-11-08
status: awaiting owner answer
---

# Phase 370 Plan 03: Owner cards and answer gate Summary

Status: awaiting owner answer. The gate and the sealed card exist. No answer was written. No product file changed.

## Commits

| Commit | Files |
|--------|-------|
| 5d396ee96 | 370-gate.cjs |
| 0c4cfe2a6 | 370-DECISION.md (G1 draft, not sealed) |
| see git log (final commit of this plan) | 370-DECISION.md (complete, sealed), 370-03-SUMMARY.md |

## What was built

- `370-gate.cjs` is `390-gate.cjs` after one sed pass (390-gate to 370-gate, 390-DECISION to 370-DECISION, "Phase 390" to "Phase 370", "OD-" to "O"). A diff against the sed output of the 390 file shows no other change. No "390" text remains. Selftest prints "selftest passed". With no argument it prints usage and exits 3.
- `370-DECISION.md`: summary table first, how to answer, words, G1 (O1, O2, O4A, O4B), G2 (O3), G3 (O6A, O6B, O8), the notes O5, O7, O9 and N1, and the two closing sections. Each card has facts tagged PROVEN, UNVERIFIED or ASSUMED with file and line, a Surfaces line, the cost of each non-KEEP option, a recommendation with a reason, and one OPTIONS line with KEEP first.
- Card facts from plan 370-02 are on the cards: O3 says Brain and Theo are case-sensitive hard terms, that a student whose name or venture is Theo would be flagged, and that the strict default stands until answered. O2 invents no number and holds three O2-VALUE lines that read PENDING. O6B states the hook skip rules and the H11 latency budget. The O2 text says that setting a cross-domain place keeps the "For advanced students" note allowed.
- The card names no surname and no cohort project. Prose examples of the grammar sit inside a fence.

## Recommendations (all as the plan default)

G1 RECOMMENDED (O1 WITHHOLD, O2 SET-CAPS, O4A DROP, O4B ANONYMIZE). G2 RECOMMENDED (O3 EXEMPT-IF-IN-SOURCE). G3 RECOMMENDED (O6A BLOCKER, O6B LOG-ONLY, O8 FRONTMATTER). No recommendation was changed from the planner default.

## Verification (PROVEN, run in this session)

```
node 370-gate.cjs selftest                                  -> selftest passed
node 370-gate.cjs seal 370-DECISION.md                      -> SEALED groups=3 head=46b7dd8c39dd86904ce8e299625ded8c27250413
node 370-gate.cjs check-decision 370-DECISION.md --expect-pending
                                                            -> OK check-decision groups=3 items=8   (exit 0)
node 370-gate.cjs gate-group 370-DECISION.md G1             -> BLOCKED-PENDING group G1 has no owner answer   (exit 1)
node 370-gate.cjs resolve 370-DECISION.md                   -> all 8 items PENDING
node scripts/build-connector-registry.cjs --check           -> exit 0
node scripts/build-orchestration-projection.cjs --check     -> exit 0
node scripts/check-render-coverage.cjs                      -> exit 0
```

- OWNER-ANSWER lines reading PENDING: 3. O2-VALUE lines reading PENDING: 3. OPTIONS lines: 8, all with KEEP first.
- Non-ASCII bytes in 370-DECISION.md, checked with grep -P on bytes above 0x7F: 0. En or em dash: 0. Write-continue sentinel left: 0.
- The sealed HEAD 46b7dd8c3 is a peer commit that was HEAD at seal time. It is an ancestor of HEAD (merge-base --is-ancestor passed).

## Node start cost for O6B (PROVEN)

Command: `s=$(date +%s%N); for i in 1 2 3 4 5 6 7 8 9 10; do node -e 0; done; e=$(date +%s%N); echo $(( (e-s)/1000000 ))`

Run 1: 222 ms for 10 starts, 22.2 ms per start. Run 2: 187 ms for 10 starts, 18.7 ms per start. Node v22.23.1 on WSL2. The card states "about 20 ms". The hook plan's budget (median of 20 spawns at most the bare start plus 50 ms for a non-review write and plus 150 ms for a review write) is quoted on the card as UNVERIFIED because plan 370-06 has not built the hook.

## Deviations from Plan

None - plan executed as written. The card was written in two parts (the plan allowed this): the G1 draft was committed first as 0c4cfe2a6, then the rest was added by Edit.

Pre-commit branch guard: this tree is a linked worktree on main by design (same as plans 370-01 and 370-02). Every commit used `git add -f` on exact paths and `git commit --only` with the same paths. Peer files modified in the tree (lib/mcp/tools/research.cjs, tests/fixtures/eureka-fake-engine-387/fake-uv.cjs, tests/test-341-eureka-no-brain-reach.cjs, tests/test-387-eureka-egress.cjs, tests/test-387-eureka-fake-engine.cjs) were not touched or staged.

## Known Stubs

None. The PENDING lines are the intended state.

## Threat Flags

None. No network call, no Brain call, no room read. Names, counts and line numbers only.

## The NEEDS_HUMAN line (returned to the main session)

NEEDS_HUMAN: Answer the three group lines in 370-DECISION.md. For each of G1 to G3 reply KEEP-ALL, RECOMMENDED, or CUSTOM with one O-id=OPTION pair per item. If O2 is SET-CAPS, also give three values: body words, reflection questions, and where the first two cross-domain ideas sit (research_reframe, strategic_challenge or NONE). Recommended: G1 RECOMMENDED, G2 RECOMMENDED, G3 RECOMMENDED.

## Self-Check: PASSED

Files exist: 370-gate.cjs, 370-DECISION.md, 370-03-SUMMARY.md. Commits 5d396ee96 and 0c4cfe2a6 exist.
