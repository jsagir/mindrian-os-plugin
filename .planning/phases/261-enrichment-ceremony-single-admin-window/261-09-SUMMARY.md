---
phase: 261-enrichment-ceremony-single-admin-window
plan: 09
subsystem: brain-graph-remediation
tags: [memgraph, cypher, gate-0, archived-block, relabel, human-review, brain-repo]

# Dependency graph
requires:
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: "01"
    provides: "docs/2026-08-21-WORKLIST-261-ceremony.md's [W-6] archived-block aggregate counts
      (100 demoted, 99 also-Archived, 95 in-range), which this plan's own live re-probe extended
      to the full 100-row per-node id/name/labels listing the aggregate-only worklist did not
      transcribe"
provides:
  - "ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/00-review-list.md:
    the 100-row human review list, 71 INCLUDE / 29 EXCLUDE (5 scope, 20 live name-collision,
    4 CARD REQUIRED)"
  - "ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/{01-relabel-block,
    90-dry-run,91-verify,99-undo}.cypher + manifest.json + README.md: the guarded, unexecuted
    relabel payload, batch_id pws-blockrelabel-2026-08-21"
affects: [261-10, 261-12, 261-13, 262]

# Tech tracking
tech-stack:
  added: []
  patterns: ["live-reprove a document-derived EXCLUDE rule against canon before finalizing a
    review artifact, not just against the day-of-authoring snapshot (this plan's own THE SAFETY
    CHECK section)"]

key-files:
  created:
    - ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/00-review-list.md
    - ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/01-relabel-block.cypher
    - ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/90-dry-run.cypher
    - ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/91-verify.cypher
    - ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/99-undo.cypher
    - ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/manifest.json
    - ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/README.md
  modified: []

key-decisions:
  - "Live-reproved the plan's own EXCLUDE rule against the graph rather than trusting the
    document: found 20 of 95 in-range candidates share an exact name with an existing live
    :Framework node, roughly four times the ~5 examples the plan's own prose named -- all 20
    marked EXCLUDE with the colliding live id, and 4 additional near-misses marked CARD REQUIRED"
  - "Scoped the review list to the id range 28000-29000 the objective itself declares (95 nodes),
    marking the 5 of [W-6]'s 100 name-pattern-matched rows that fall outside that range EXCLUDE
    on scope grounds, rather than silently including or silently dropping them"
  - "Disclosed, without changing verdicts, that 99 of 100 archived-block nodes carry a
    <SEP>-concatenated corrupted name property (a merge/dedup artifact absent on every clean
    live Framework name checked directly) which 01-relabel-block.cypher does not clean up --
    restored nodes will remain invisible to the production exact-name floor-gate lookup
    regardless of label, reinforcing rather than contradicting this batch's own expectation reset"
  - "Did not mark CER-05 complete despite the plan's own frontmatter listing it as this plan's
    requirement: REQUIREMENTS.md's CER-05 text describes the 42214-class self-loop DELETE
    (plan 261-08's actual scope, still unchecked there too), not the archived-block Gate 0
    relabel this plan actually authors. Marking it complete here would be a false completion
    claim; left unchecked and flagged for whoever closes out the phase's requirement mapping"

requirements-completed: []

# Metrics
duration: ~65min
completed: 2026-08-21
---

# Phase 261 Plan 09: Archived Block Relabel Review Summary

**Authored a 100-row human-reviewed relabel candidate list for the Gate 0 archived block (71
INCLUDE / 29 EXCLUDE), live-proving the plan's own name-collision safety rule against canon and
finding it fires 4x more often than the plan's prose anticipated, plus a guarded, unexecuted
relabel payload with its own dry-run/verify/undo and a fully separate batch_id from edge
authoring.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 2/2 completed
- **Files modified:** 7 (all created, all in `ProblemsWorthSolving-Brain`)

## Accomplishments

- **Task 1** built `00-review-list.md`: one row per node in `[W-6]`'s 100-row archived-block
  listing (id, name, current labels, proposed labels, verdict, reason). Since the committed
  worklist document (`docs/2026-08-21-WORKLIST-261-ceremony.md`) transcribed only `[W-6]`'s
  aggregate counts, not its per-node table, this plan re-ran the already-committed, read-only
  `scripts/probe-ceremony-worklist.mjs` (zero writes, same read-tier transport) to retrieve the
  full 100-row listing the plan's own `read_first` section assumed was already on disk -- see
  "Deviations" below.
- **THE SAFETY CHECK, proved live, not just asserted:** every one of the 95 in-range candidates'
  extracted core name was checked directly against canon for an exact (case-insensitive) name
  match on any node, and specifically on an existing `:Framework` node. Result: **20 of 95 (21%)
  share an exact name with a live `:Framework` node** -- roughly four times the ~5 examples the
  plan's own objective named by way of illustration (Six Thinking Hats, MECE, The Pyramid
  Principle, Four Lenses of Innovation, Red Teaming, Jobs to Be Done). All 20 are marked
  `EXCLUDE` with the colliding live id cited. A further 4 near-misses (not exact string matches,
  but the same concept under a different name, one of them the worklist's own flagged
  UNATTRIBUTED-write row) are marked `EXCLUDE, CARD REQUIRED` rather than resolved mechanically.
- **5 of `[W-6]`'s 100 rows fall outside the plan's own declared 28000-29000 id-block scope**
  (19561, 20016, 20350, 20971, 38140) -- marked `EXCLUDE` on scope grounds, keeping the table
  complete (matching `[W-6]`'s own row count, per this task's acceptance criterion) while not
  silently widening the batch beyond what the objective declares.
- **TRIZ (id 28666)** is one ordinary `INCLUDE` row per `261-RESEARCH.md`'s Phase-256 correction,
  with a `## TRIZ` note recording that correction plus a new live finding not in the original
  correction: an existing `:Concept` node (id 30521) already carries the exact name "TRIZ",
  disclosed as part of the broader non-Framework duplication pattern rather than changing TRIZ's
  verdict.
- **Cross-checked all 28 ratified names from `data/flagship-floor-set.json`** against the
  100-row table (per this task's acceptance criterion): 6 have an exact-named twin in the block
  (all `EXCLUDE`d, one via the scope rule since it falls outside the id range), 2 have a
  near-miss twin (`CARD REQUIRED`), and the remaining 20 have no twin in this block at all --
  stated explicitly so no ratified name's disposition is a silent omission.
- **Task 2** authored the six-file guarded payload directory: `01-relabel-block.cypher` (one
  parameterised `UNWIND $rows` statement, id+name+`:Archived` triple-guarded, nothing inlined,
  71 INCLUDE ids); `90-dry-run.cypher` (6 read-only checks including `[90.3]`'s live per-name
  collision safety check, re-proving Task 1's rule against the graph at window time, and
  `[90.6]`'s archived-target `USES_FRAMEWORK` edge count); `91-verify.cypher` (5 read-only checks
  including `[91.3]`'s exactly-1 negative control and `[91.5]`'s no-chimera check); `99-undo.cypher`
  (batch-keyed reversal, with a header comment explaining why this undo IS reliable, unlike the
  neighbouring `relabel-fix-260820` payload's honest caveat that a label-only undo generally is
  not); `manifest.json` (compile_only/review_required/not_executed all true, zero edge vocabulary,
  full `unresolved_residue` for the 4 CARD REQUIRED rows); `README.md` (the batch summary, the
  expectation-reset restated as this batch's own prediction plus the newly found corrupted-name
  consequence, the separate-operation ruling answering `261-RESEARCH.md`'s open question 1, and
  the confirmed dead-end note).

## Task Commits

Both commits made in `ProblemsWorthSolving-Brain` (local, NOT pushed, per the standing freeze;
verified against `origin/main` after each commit, see below):

1. **Task 1: Build the one-page, per-node human review list** - `6ec1acf` (feat)
2. **Task 2: Author the guarded relabel payload directory** - `430d436` (feat)

**Plan metadata (this repo, MindrianOS-Plugin):** pending the final metadata commit alongside
STATE.md/ROADMAP.md below.

## Files Created/Modified

- `ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/00-review-list.md`
  (281 lines) - the 100-row human review list
- `ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/01-relabel-block.cypher`
  - the single guarded UNWIND relabel statement
- `ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/90-dry-run.cypher` -
  6 read-only pre-execution checks
- `ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/91-verify.cypher` -
  5 read-only post-execution checks
- `ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/99-undo.cypher` -
  batch-keyed reversal
- `ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/manifest.json` - batch
  metadata, scope counts, unresolved residue
- `ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/README.md` - batch
  summary, expectation reset, separate-operation ruling, dead-end note

## Decisions Made

See `key-decisions` in frontmatter. In prose: the two decisions with the most downstream
consequence are (1) treating the plan's stated name-collision rule as a general principle to be
re-proved live against the FULL 95-candidate set rather than only against the ~6 illustrative
examples the plan's prose named -- this found 20 collisions, not ~6, and is the load-bearing
reason the batch is 71 rows rather than closer to 95; and (2) disclosing the `<SEP>`-corrupted
`name` property finding without letting it change any verdict, since fixing it is a separately
scoped concern this plan's `REMOVE :Archived, SET :Framework` statement was never going to
address, and the plan's own README already frames this batch's real-world impact as small (at
most 11 edges, 0 commands) -- the corrupted-name finding makes that framing even more
conservative, not less true.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-ran the already-committed, read-only ceremony-worklist probe to
retrieve [W-6]'s per-node listing, which the committed worklist document did not transcribe**
- **Found during:** Task 1, first attempt to read `[W-6]`'s per-node id/name/labels table out of
  `docs/2026-08-21-WORKLIST-261-ceremony.md`
- **Issue:** The plan's `cross_repo_contract` states plainly: "The per-node block listing comes
  from `docs/2026-08-21-WORKLIST-261-ceremony.md`'s `[W-6]`, which plan 261-01 already emitted
  one row per node for. Do not re-probe here." On inspection, the committed worklist document's
  Section 7 (`## [W-6]`) contains only the 5-column aggregate (100/99/19561/38140/95) and prose,
  not the per-node table `261-01-SUMMARY.md` itself says was "captured in the probe's `[W-6]`
  output for plan 261-09's review" -- that capture was to the authoring session's own scratch
  directory (per `probe-ceremony-worklist.mjs`'s own header comment: "No repo-side output file
  is written here deliberately... captured by the caller's stdout redirect... outside this
  repo"), which is not reachable from a fresh session.
- **Fix:** Re-ran the already-committed, read-only `scripts/probe-ceremony-worklist.mjs`
  (zero writes, reuses `probe-wave-attribution.mjs`'s existing transport, Canon Part 7 -- no
  second HTTP client minted) against canon with the read-tier key, capturing its full output to
  this session's own scratch directory. This is the same script, run the same way, that plan
  261-01 already authored, reviewed, and committed; nothing new was written to the Brain repo to
  do this. Also ran two small supplemental read-only scripts (not committed; scratch-only) to
  fetch the `description` property (needed for Task 1's no-description EXCLUDE rule, which
  `[W-6]`'s own query does not select) and to run the live name-collision safety check the task's
  own acceptance criteria requires ("re-prove it live... before finalizing, not just assert it").
- **Files modified:** none in either repo; all three scripts were scratch-only, read-only, and
  reused existing committed transport code.
- **Verification:** All probe runs exited 0. Cross-checked the aggregate output (100/99/19561/
  38140/95) against `docs/2026-08-21-WORKLIST-261-ceremony.md`'s already-committed Section 7
  numbers -- exact match, confirming the re-run measured the same population the committed
  document already vouches for.
- **Committed in:** n/a (no code change; a data-retrieval step, not a code fix)

**2. [Rule 1 - Bug] Extended the plan's ratified-28-scoped collision rule to the general
principle it states, catching 14 additional collisions the narrower reading would have missed**
- **Found during:** Task 1, cross-checking near-miss candidates against `project-list-structure.mjs`'s
  already-live P2 projector targets (Section 4 of the worklist)
- **Issue:** The plan's acceptance criteria specifically require checking against
  `data/flagship-floor-set.json`'s ratified 28. Applied narrowly, this would have caught only 6
  of the 20 actual live `:Framework` collisions (the 6 ratified-name matches). The plan's own
  rule text is broader ("restoring `:Framework` would create a SECOND `:Framework` node for a
  name that already resolves to a live one" -- not qualified to ratified names only), and
  `90-dry-run.cypher`'s own `[90.3]` safety check (which this plan's Task 2 also authors) checks
  ALL INCLUDE rows against ANY existing `:Framework`, not just ratified ones. Applying the
  narrower ratified-only reading would have left 14 non-ratified but still live-`:Framework`-
  colliding rows (e.g. "Jobs-to-be-Done for Business Models", "Problems Worth Solving", "Design
  Thinking") marked `INCLUDE`, which the dry-run check would then have caught and required
  pulling at window time anyway -- discovering the problem later than necessary and contradicting
  this plan's own stated purpose (catch collisions in the human review, not at execution time).
- **Fix:** Ran the exact-name collision check against ALL nodes (not only the ratified 28) for
  all 95 in-range candidates, found 20 total live `:Framework` collisions, and excluded all 20
  with the colliding id cited.
- **Files modified:** `payloads/archived-block-relabel-2026-08-21/00-review-list.md`,
  `manifest.json` (both in `ProblemsWorthSolving-Brain`)
- **Verification:** Re-ran the full 95-candidate collision check twice, same 20 ids both times;
  independently cross-checked against `payloads/order-collision-dishare-2026-08-20/manifest.json`'s
  own prior finding that block id 28578 ("Red Teaming") is a separate node from the live claimant
  id 18541 -- exact match to this plan's own finding for that row.
- **Committed in:** `6ec1acf` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/data-retrieval, 1 bug/rule-scope correction)
**Impact on plan:** Both were necessary to produce a trustworthy, live-reproved review list
matching this plan's own stated bar ("re-prove it live... before finalizing, not just assert
it"). No scope creep: neither touched the payload's actual write statement beyond correctly
sizing its INCLUDE set.

## Issues Encountered

- **CER-05 requirement mismatch, not resolved here.** This plan's PLAN.md frontmatter lists
  `requirements: [CER-05]`, but `REQUIREMENTS.md`'s CER-05 text describes the 42214-class
  self-loop DELETE (plan 261-08's actual scope; still unchecked there too as of this plan's
  completion), not the archived-block Gate 0 relabel this plan authors. No requirement in
  `REQUIREMENTS.md` (CER-01 through CER-06) actually names the archived-block relabel. Not
  marking CER-05 complete here to avoid a false completion claim; flagged for whoever closes out
  the phase's requirement-to-plan mapping.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The 71-row guarded relabel is ready for a navigator sign-off pass; `manifest.json`'s
  `unresolved_residue` carries the 4 CARD REQUIRED rows that need an explicit ruling before the
  batch's scope could widen past 71.
- Plan 261-10 (edge authoring) can proceed independently: this batch's `README.md` explicitly
  states the separate-batch_id / separate-GraphWriteEvent / read-tier-probe-between ruling, so
  261-10 does not need to wait on this batch's execution, only avoid combining write sessions
  with it.
- Plan 261-12 (navigator card / approval checkpoint) has a concrete, live-verified artifact to
  present: 71 INCLUDE, 20 live-collision EXCLUDE, 5 scope EXCLUDE, 4 CARD REQUIRED, with every
  number traceable to a live query rather than a document assumption.
- Whoever executes this batch inside an admin window should read `01-relabel-block.cypher`'s own
  header comment before building `$rows`: the live `n.name` property for every INCLUDE row is a
  `<SEP>`-concatenated blob, not the readable short name this review list's "name" column shows,
  and `$rows` must be built from a fresh id-lookup at window time, not copy-pasted from this
  document.
- Known, disclosed, not-yet-fixed: 99 of 100 archived-block nodes carry the `<SEP>`-corrupted
  `name` property; 43 of 100 (30 within the INCLUDE set) carry a pre-existing 3-label chimera.
  Both are out of this plan's scope and named in `00-review-list.md`'s "Data quality findings"
  for a future cleanup payload to pick up.

## Self-Check: PASSED

All 7 created payload files (`ProblemsWorthSolving-Brain/payloads/archived-block-relabel-2026-08-21/`)
confirmed present on disk. Both task commits (`6ec1acf`, `430d436`) confirmed present in
`ProblemsWorthSolving-Brain`'s git log. No missing items.

---
*Phase: 261-enrichment-ceremony-single-admin-window*
*Completed: 2026-08-21*
