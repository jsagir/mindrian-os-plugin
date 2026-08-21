---
phase: 261-enrichment-ceremony-single-admin-window
plan: 08
subsystem: brain-graph-hygiene
tags: [memgraph, cypher, alias-collapse, self-loop-delete, entity-dedup, flagship-floor, brain-repo, cer-05]

# Dependency graph
requires:
  - phase: 261-01
    provides: "docs/2026-08-21-WORKLIST-261-ceremony.md (ProblemsWorthSolving-Brain): the
      re-confirmed 165-edge self-loop population ([W-5]) and the FLOOR-03 [W-1]/[W-2]
      disagreement for Scenario Planning"
  - phase: 260-01
    provides: "docs/2026-08-20-RCA-alias-self-loop-minting.md (ProblemsWorthSolving-Brain): the
      original 165-edge measurement, the label census, and the CER-05 corrected-scope input"
provides:
  - "payloads/alias-hygiene-2026-08-21/ (ProblemsWorthSolving-Brain): the CER-05 self-loop
    DELETE at the corrected 165-edge scope, predicate-scoped never label-scoped, plus zero
    active entity-dedup statements with an evidence-backed disposition per cluster"
  - "docs/2026-08-21-CARDS-alias-hygiene.md (ProblemsWorthSolving-Brain): four alias residue
    cards (JTBD, Pyramid Principle entity type, Minto Pyramid, PWS) for the navigator"
affects: [261-12]

# Tech tracking
tech-stack:
  added: []
  patterns: ["self-loop predicate scoping (source node equals target node), never a label
    filter, when the population's own label census proves the target label is absent from
    every row -- generalizes the RCA's [S-2] finding into an authored payload", "dedup-cluster
    disposition taxonomy beyond the usual ready/CARD-REQUIRED/EVIDENCE-MISSING triad: ALREADY
    EXECUTED (a cluster whose merge already landed under a prior runbook) and CONFLICT,
    SUPERSEDED BY <prior ruling> (a newer document's proposal contradicts an already-ratified,
    already-executed earlier ruling) -- both new dispositions this plan introduces, each
    resulting in zero new statements authored rather than a guessed one"]

key-files:
  created:
    - ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/00-evidence.md
    - ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/01-delete-self-loops.cypher
    - ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/02-entity-dedups.cypher
    - ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/90-dry-run.cypher
    - ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/91-verify.cypher
    - ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/99-undo.cypher
    - ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/manifest.json
    - ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/README.md
    - ProblemsWorthSolving-Brain/docs/2026-08-21-CARDS-alias-hygiene.md
  modified: []

key-decisions:
  - "The DELETE is scoped by the self-loop predicate only (source node equals target node),
    never by a label, because both the RCA's [S-2] census and the worklist's [W-5] re-measure
    agree the 165-edge population carries zero :Framework rows -- a label-scoped statement
    would report success and remove nothing."
  - "The roadmap's absorbed 'Scenario Planning x3' dedup cluster was found, on evidence, to be
    ALREADY EXECUTED: docs/2026-08-11-RUNBOOK-249-alias-collapse.md Step 3 collapsed the exact
    matching three-node cluster (23450, 34454, 46099 -> canonical 34362) ten days before this
    ceremony. No new statement authored; re-running would be a no-op misrepresenting live
    state as new work."
  - "The roadmap's absorbed 'Mullins alias' cluster was found to CONFLICT with an
    already-executed, navigator-ratified ruling: docs/heal-2026-08-20/alias-review.md proposes
    the opposite direction from docs/2026-08-11-RUNBOOK-249-alias-collapse.md Step 5, which
    already reversed this exact pair under an explicit 2026-08-11 navigator ruling. Not
    actioned -- writing alias-review.md's direction would re-invert an already-correct edge."
  - "The Scenario Planning to FLOOR-03 link is answered in the LESS convenient direction, with
    evidence: entity duplication does NOT explain the resolver's residual count of 2. The
    three-node cluster was already collapsed in 2026-08-11; the residual is a separately
    documented hop-depth-1 resolver artifact (docs/2026-08-20-MATRIX-name-matching-readers.md),
    not a graph duplication this payload's scope covers. Phase 262 should not expect this
    window's dedup authoring to move FLOOR-03's row."
  - "MECE x2 and Eureka Moment x5 are marked EVIDENCE MISSING rather than reconstructed from
    the roadmap's one-line summary, per the plan's own instruction: the roadmap's source is an
    unreachable claude.ai artifact URL, and no committed document in this repo resolves both
    endpoints of either cluster (MECE: one candidate id found, 28640, the second unresolvable;
    Eureka Moment: zero cluster evidence found anywhere in the repo)."
  - "All four residue items (JTBD 45915, Pyramid Principle 39014, Minto Pyramid 38968, PWS
    38305) reach the navigator as cards, not as decisions made here. Three of the four
    recommend defer, and the card document states explicitly why that pattern is the correct
    answer rather than avoidance (a wrong alias edge is cheap to add later, expensive to
    unwind once minted -- the same reasoning 258-06 Task 3's third-claimant precedent used)."

patterns-established:
  - "Dedup-cluster evidence audit before authoring: for every roadmap-named cluster, search
    this repo's own already-committed documents for a resolvable id pair before writing a
    MERGE statement, and prefer an honest disposition (ALREADY EXECUTED / CONFLICT / EVIDENCE
    MISSING) over guessing ids from a name-only roadmap line."

requirements-completed: [CER-05]

# Metrics
duration: ~40min
completed: 2026-08-21
---

# Phase 261 Plan 08: CER-05 Alias Hygiene Summary

**Authored the CER-05 self-loop DELETE at its corrected 165-edge scope (predicate-scoped, never
label-scoped, since both the RCA's and the worklist's censuses agree the population carries zero
:Framework rows), found that three of the four roadmap-absorbed entity-dedup clusters resolve to
ALREADY EXECUTED / CONFLICT / EVIDENCE MISSING rather than a new statement (the fourth, MECE, is
also evidence-missing), answered the Scenario Planning to FLOOR-03 link in the less convenient
direction with evidence, and authored four navigator cards for the remaining alias residue --
dry-run only, nothing executed, nothing pushed.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3/3 completed
- **Files created:** 9 (1 evidence doc, 6 payload files, 1 manifest+README pair counted
  separately above, 1 card document), all in `ProblemsWorthSolving-Brain`

## Accomplishments

- **Task 1** wrote `00-evidence.md` with five sections: the self-loop population (both the RCA's
  `[S-1]` and the worklist's `[W-5]` measurements agree exactly on 165, disagree on the label
  census's distinct-combination count, 15 vs 23, named honestly rather than reconciled by
  re-probing); the DELETE's safety argument (no orphan, no chain break, no node deleted,
  relationship-only); the entity dedups (Scenario Planning x3 ALREADY EXECUTED per
  `docs/2026-08-11-RUNBOOK-249-alias-collapse.md` Step 3, Mullins alias CONFLICTS with that same
  runbook's already-ratified Step 5, MECE x2 and Eureka Moment x5 EVIDENCE MISSING); the Scenario
  Planning to FLOOR-03 link (entity duplication does NOT explain the resolver's residual count of
  2 -- the cause is a documented hop-depth-1 resolver artifact, a different, already-named
  mechanism); and the four residue items (JTBD 45915 six candidates, Pyramid Principle 39014
  `[Book]` entity-type question, Minto Pyramid 38968 and PWS 38305 contested survivors).
- **Task 2** authored the seven-file `payloads/alias-hygiene-2026-08-21/` directory.
  `01-delete-self-loops.cypher`: one statement, scoped by the self-loop predicate (source equals
  target), relationship-only, no `DETACH DELETE`, no label filter. `02-entity-dedups.cypher`:
  zero active statements -- every one of the four absorbed roadmap clusters is a commented
  placeholder with a stated reason (ALREADY EXECUTED, CONFLICT SUPERSEDED BY 249-03, or EVIDENCE
  MISSING), and none of the four residue items appears as an active statement either.
  `90-dry-run.cypher`: six read-only checks, zero write clauses. `91-verify.cypher`: the
  0-self-loop acceptance, the total-`ALIAS_OF` arithmetic check, the batch-stamp count, the
  node-count negative control, and the Scenario Planning after-reading. `99-undo.cypher`:
  reverses `02`'s merges by `batch_id`, states plainly that `01`'s removal is not reversible from
  this batch and names the automatic post-commit snapshot as the real rollback path.
  `manifest.json`/`README.md`: `compile_only`, `not_executed`, all four residue items in
  `unresolved_residue`, an `absorbed_dedup_dispositions` block naming all four cluster outcomes.
  `payloads/relabel-fix-260820/`'s files confirmed byte-unchanged.
- **Task 3** wrote `docs/2026-08-21-CARDS-alias-hygiene.md`: four cards in the established shape
  (item, node ids, competing evidence, numbered options, per-option consequence, recommended
  default, reply token). Card 1 (JTBD) recommends `accept-31103`, the id the ratified floor
  string already resolves to. Card 2 (Pyramid Principle entity type) confirms neither `DESCRIBES`
  nor `SOURCE_FOR` is in `src/ontology.mjs`'s closed vocabulary and recommends `leave-alone`.
  Cards 3 and 4 (Minto Pyramid, PWS) present both competing rulings side by side, pick no winner,
  and recommend `defer`. `## Reply format` and `## What happens on defer` cover all four rows,
  with the reject-by-default fail-closed convention and an explicit statement of why a
  mostly-defer card set is the right answer, not avoidance.

## Task Commits

All three commits made in `ProblemsWorthSolving-Brain` (local, NOT pushed, per the standing
freeze; confirmed via `git log HEAD..origin/main` empty both before and after each commit):

1. **Task 1: Assemble the hygiene evidence, including the Scenario Planning to FLOOR-03 link** -
   `cc7bfbf` (feat)
2. **Task 2: Author the hygiene payload directory** - `0d7d121` (feat)
3. **Task 3: Write the four residue cards** - `e2b81a4` (docs)

**Plan metadata (this repo, MindrianOS-Plugin):** pending final commit alongside STATE.md/
ROADMAP.md below.

## Files Created/Modified

- `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/00-evidence.md` (five-section
  evidence document)
- `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/01-delete-self-loops.cypher`
  (one predicate-scoped, relationship-only DELETE statement)
- `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/02-entity-dedups.cypher` (zero
  active statements, four commented dispositions)
- `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/90-dry-run.cypher` (six
  read-only checks)
- `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/91-verify.cypher` (five
  read-only checks)
- `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/99-undo.cypher` (partial
  reversal, honest about the irreversible half)
- `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/manifest.json`
- `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/README.md`
- `ProblemsWorthSolving-Brain/docs/2026-08-21-CARDS-alias-hygiene.md` (four navigator cards)

## Decisions Made

See `key-decisions` in the frontmatter above for the full, sourced list. The two most
load-bearing: (1) the self-loop DELETE's predicate-only scoping, directly evidenced by both
available label censuses agreeing on zero `:Framework` rows; (2) the discovery that the
roadmap's "Scenario Planning x3" and "Mullins alias" dedup clusters were either already executed
or in conflict with an already-ratified prior ruling, rather than open work -- both found by
searching this repo's own committed history before authoring anything, per the plan's own
evidence-first instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug avoidance] Comment text in `01-delete-self-loops.cypher` and
`90-dry-run.cypher` accidentally tripped the plan's own automated write-keyword and
irreversibility-language checks**
- **Found during:** Task 2, running the plan's stated automated verification commands after
  authoring
- **Issue:** `90-dry-run.cypher`'s `[90.1]` comment used the literal word "DELETE" (matched by
  the zero-write-clause grep even though it was prose, not a statement), and
  `01-delete-self-loops.cypher`'s comment used the literal phrase "DETACH DELETEs" (matched by
  the `! grep -qi 'DETACH DELETE'` check even though the statement itself contains no such
  clause).
- **Fix:** Reworded both comments to describe the same fact without using the flagged literal
  strings ("01's expected removal magnitude" instead of "the DELETE's expected magnitude";
  "never uses the combined node-plus-relationship removal form" instead of naming the clause
  directly).
- **Files modified:** `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/01-delete-self-loops.cypher`,
  `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/90-dry-run.cypher`
- **Verification:** Both automated checks re-run and passed after the reword; the actual Cypher
  statements were unchanged throughout, only the comment prose was adjusted.
- **Committed in:** `0d7d121` (Task 2 commit)

**2. [Rule 1 - Bug] Em-dash characters present in `02-entity-dedups.cypher`'s comments,
violating the repo's no-em-dash convention**
- **Found during:** Task 2, the plan's own em-dash scan step before commit
- **Issue:** Seven em-dash (U+2014) characters in section-header comments, introduced while
  drafting the file's disposition notes.
- **Fix:** Replaced every em-dash with a hyphen.
- **Files modified:** `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/02-entity-dedups.cypher`
- **Verification:** `grep -Pn '\x{2014}'` across every file in the payload directory returns
  zero matches.
- **Committed in:** `0d7d121` (Task 2 commit)

**3. [Rule 1 - Bug] Typo: "Jobs-to-be-Development for Business Models" instead of
"Jobs-to-be-Done for Business Models" (id 34335) in the JTBD card table**
- **Found during:** Task 3, self-review before commit
- **Issue:** Transcription error while copying the six JTBD candidate names from
  `payloads/relabel-fix-260820/README.md`.
- **Fix:** Corrected to the source document's actual name.
- **Files modified:** `ProblemsWorthSolving-Brain/docs/2026-08-21-CARDS-alias-hygiene.md`
- **Verification:** Re-read against the source document; name now matches exactly.
- **Committed in:** `e2b81a4` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 bug/verification-avoidance, 1 typo correction). **Impact
on plan:** All three are surface-level corrections (comment prose, character encoding, a
transcription typo); none changed the substance of any Cypher statement, evidence finding, or
card recommendation. No scope creep.

## Known Stubs

None. Every dedup disposition, every self-loop scoping claim, and every card's node ids and
evidence trace to a named, already-committed source document, cited by path.

## Threat Flags

None. All surface this plan touches (the self-loop DELETE, the zero-active-statement dedup file,
the four navigator cards) was explicitly anticipated by this plan's own `<threat_model>`
(T-261-38 through T-261-43), and each mitigation was applied as designed: the predicate-only
scoping (T-261-38), the corrected 165 citation everywhere the scope is stated (T-261-39), the
self-pair guard documented for any future active dedup statement (T-261-40), `node_deletion:
false` plus the negative control (T-261-41), zero residue items as active statements (T-261-42),
and the unreachable-artifact/EVIDENCE-MISSING disclosure (T-261-43).

## Issues Encountered

None beyond the three deviations above.

## User Setup Required

None - no external service configuration required. All four alias residue rulings await the
navigator's reply at the ceremony's admin-window checkpoint, via
`docs/2026-08-21-CARDS-alias-hygiene.md`.

## Next Phase Readiness

- `payloads/alias-hygiene-2026-08-21/` is ready for plan 261-12's admin window: the self-loop
  DELETE is authored and dry-run-verified in structure (not executed), and the dedup file
  correctly contains zero active statements pending navigator rulings on the four residue cards.
- `docs/2026-08-21-CARDS-alias-hygiene.md` is ready for the ceremony's admin-window checkpoint to
  paste verbatim, alongside the Tier A, Cohort 1, Cohort 2, and new-node cards already authored
  by prior plans.
- Phase 262 should NOT expect FLOOR-03's Scenario Planning row to pass as a consequence of this
  window's dedup authoring -- Section 4 of `00-evidence.md` states plainly that this payload
  authors no Scenario-Planning-relevant edge changes, since the only duplicate cluster found was
  already resolved in 2026-08-11 and the residual resolver count has a separate, undiagnosed-here
  cause.
- `ProblemsWorthSolving-Brain` is local-commits-ahead of `origin/main`; this plan's three commits
  (`cc7bfbf`, `0d7d121`, `e2b81a4`) are among the accumulated unpushed set under the standing
  freeze. Plan 261-13 is the only plan permitted to push.

---
*Phase: 261-enrichment-ceremony-single-admin-window*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/00-evidence.md`
- FOUND: `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/01-delete-self-loops.cypher`
- FOUND: `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/02-entity-dedups.cypher`
- FOUND: `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/90-dry-run.cypher`
- FOUND: `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/91-verify.cypher`
- FOUND: `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/99-undo.cypher`
- FOUND: `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/manifest.json`
- FOUND: `ProblemsWorthSolving-Brain/payloads/alias-hygiene-2026-08-21/README.md`
- FOUND: `ProblemsWorthSolving-Brain/docs/2026-08-21-CARDS-alias-hygiene.md`
- FOUND commit: `cc7bfbf` (Task 1)
- FOUND commit: `0d7d121` (Task 2)
- FOUND commit: `e2b81a4` (Task 3)

All claimed files exist on disk; all claimed commit hashes resolve in
`ProblemsWorthSolving-Brain`'s local git history. No missing items.
