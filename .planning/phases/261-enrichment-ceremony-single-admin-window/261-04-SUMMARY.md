---
phase: 261-enrichment-ceremony-single-admin-window
plan: 04
subsystem: brain-graph-content
tags: [memgraph, ingest-framework, fixture-first, orchestration-readiness, brain-repo, dry-run-only, node-identity]

# Dependency graph
requires:
  - phase: 261-enrichment-ceremony-single-admin-window
    plan: 01
    provides: "docs/2026-08-21-WORKLIST-261-ceremony.md (ProblemsWorthSolving-Brain), the
      live-measured CER-02 Cohort 1 rows (name, live readiness vector, source doc path) this
      plan's four fixtures and three payloads read, plus the reuse audit's RETARGET flag on
      minto-pyramid.mjs this plan's Task 3 resolves into a documented finding"
provides:
  - "payloads/knowns-unknowns-matrix.mjs, payloads/dominant-design.mjs,
    payloads/systems-thinking.mjs (ProblemsWorthSolving-Brain): three CER-02 Cohort 1 batch B
    ingest_framework payloads, dry-run-only, never executed"
  - "tests/fixtures/framework-evals/knowns-unknowns-matrix.json,
    tests/fixtures/framework-evals/dominant-design.json,
    tests/fixtures/framework-evals/systems-thinking.json,
    tests/fixtures/framework-evals/pyramid-principle.json (ProblemsWorthSolving-Brain):
    known-answer eval fixtures authored fixture-first from source documents"
  - "docs/2026-08-21-RULING-pyramid-principle-target.md (ProblemsWorthSolving-Brain): the
    node-identity finding for The Pyramid Principle -- three distinct node ids in one name
    family, both competing survivor rulings stated without adjudication, and a RETARGET
    disposition for payloads/minto-pyramid.mjs"
affects: [261-12, 261-13]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fixture-first authoring order enforced literally, matching 261-03's precedent:
    all four fixtures written and committed from source documents before any payload existed",
    "a SPINE DECISION: header block for a framework whose source carries two candidate
    structural decompositions, with the rejected spine's absence encoded as a machine-checked
    negative control rather than left as prose commentary"]

key-files:
  created:
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/knowns-unknowns-matrix.json
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/dominant-design.json
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/systems-thinking.json
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/pyramid-principle.json
    - ProblemsWorthSolving-Brain/payloads/knowns-unknowns-matrix.mjs
    - ProblemsWorthSolving-Brain/payloads/dominant-design.mjs
    - ProblemsWorthSolving-Brain/payloads/systems-thinking.mjs
    - ProblemsWorthSolving-Brain/docs/2026-08-21-RULING-pyramid-principle-target.md
  modified:
    - ProblemsWorthSolving-Brain/payloads/minto-pyramid.mjs (header-only RETARGET NOTE; nodes/edges byte-identical, verified via git diff)
    - ProblemsWorthSolving-Brain/payloads/relabel-fix-260820/README.md (one ## Cross-reference section appended)

key-decisions:
  - "Systems Thinking's SPINE DECISION chose the Five Moves (M1-M5) over the four-phase
    turn-windowed teaching script: the source's own Meta-Lens Framing section names the Five
    Moves, not the four phases, as what 'the selector' runs at every stage and problem type,
    and 'Find Stocks and Flows' (a rejected-spine phase) has no counterpart anywhere in M1-M5.
    The rejected phase's absence is encoded as a machine-checked negative control (reusing
    checkFrameworkEval's existing fabricated_component_name mechanism against a real, meaningful
    name instead of a nonsense placeholder) rather than left as an unenforced comment"
  - "Knowns and Unknowns Matrix Framework was seriously weighed as this plan's honest-3/4-ceiling
    'no sequence' candidate (its own source calls it 'iterative conversation, not a one-pass
    checklist') and rejected: the live worklist measurement already shows flow=1 for this exact
    framework from its one and only source document, and the 'iterate' caveat reads as
    revisit-in-depth, not absence-of-first-pass-order, once weighed against that evidence and the
    doc's own four non-overlapping turn windows. All three Task 2 payloads ended up linear;
    the flow-honesty discipline was exercised through genuine per-framework analysis (documented
    per-payload), not satisfied by forcing an artificial no-chain case"
  - "Dominant Design authors 'The Utterback-Abernathy Model' as its own Technique node but does
    NOT create a second S-Curve node or emit a framework-to-framework edge to the existing
    ratified 'S-Curve Analysis' (3/4 live): every edge shape src/ingest/pipeline.mjs actually
    executes that resolves BOTH endpoints by framework name requires the SOURCE framework's live
    id (the FEEDS_INTO/to_framework branch MATCHes by {id: $from}), and Dominant Design's own
    live node id is unknown without a re-probe this plan's scope forbids. Naming the relationship
    as a documented, unemitted candidate (rather than fabricating an id or silently dropping the
    finding) is the honest disposition"
  - "The Pyramid Principle: minto-pyramid.mjs's declared target ('Minto Pyramid', resolving live
    to id 38968, already enriched to 3/4) is a DIFFERENT node than the ratified flagship-floor
    string 'The Pyramid Principle' (id 30242, still 0/4) -- confirmed via the worklist's single,
    unambiguous resolver match for the ratified string (no FLOOR-03-class disagreement recorded
    for this name). Disposition: RETARGET. The two competing survivor rulings over node 38968's
    own fate (relabel-fix-260820 treats it as canonical; alias-review.md collapses it into 30242
    as a duplicate) are recorded side by side, unadjudicated -- that is a separate, still-open
    conflict this plan's Task 3 is explicitly not scoped to resolve"
  - "DESCRIBES and SOURCE_FOR (the relabel-fix-260820 README's own recommended edge types for
    the 39014 [Book] node) are absent from src/ontology.mjs's declared REL_TYPES and from its
    PENDING_REL_TYPES lists, confirmed by direct grep against the checked-out repo state. Their
    status in the live rel-type census (the actual write-time gate, per 261-03's precedent) is
    honestly stated as UNKNOWN, not probed, since re-probing canon is out of this plan's scope --
    this is a narrower, more honest claim than either asserting they are fully unusable or
    silently assuming they are live-legal"
  - "Used pathspec-limited git commits (git commit -m ... -- <files>) for all three task commits
    in ProblemsWorthSolving-Brain, because at least one other Claude Code session had its own
    commits landing in the working tree throughout this plan's execution (observed HEAD moving
    between commands, and modified .planning/STATE.md and .planning/ROADMAP.md appearing and
    then disappearing from git status between task commits, resolved by that other session
    itself). None of this plan's three commits swept that content in, confirmed by git status
    --short and a post-commit deletion check (git diff --diff-filter=D) after each commit"

requirements-completed: [CER-02]

# Metrics
duration: ~55min
completed: 2026-08-21
---

# Phase 261 Plan 04: CER-02 Cohort 1 Batch B (Knowns/Unknowns, Dominant Design, Systems Thinking, Pyramid Principle finding) Summary

**Authored three CER-02 Cohort 1 flagship payloads fixture-first (Knowns and Unknowns Matrix,
Dominant Design, Systems Thinking with a disclosed one-spine decision) and produced a node-identity
finding proving the already-executed `minto-pyramid.mjs` enriched the wrong node -- "Minto Pyramid"
(id 38968, 3/4) instead of the ratified "The Pyramid Principle" (id 30242, still 0/4) -- disposed
RETARGET via a header-only note, body left byte-identical, dry-run-only throughout.**

## Performance

- **Duration:** ~55 min (not separately timestamped at start; the three task commits landed within
  an ~5 minute window, 2026-08-21T10:22:47+03:00 to 2026-08-21T10:27:36+03:00, following an
  extensive upfront reading/context-loading phase not itself timestamped -- the plan's own
  cross_repo_contract and threat_model required reading five methodology source documents in full
  plus the relabel-fix manifest, README, alias-review, and DECISION documents before any file was
  written)
- **Tasks:** 3/3 completed
- **Files modified:** 9 (7 created, 2 modified), all in `ProblemsWorthSolving-Brain`

## Accomplishments

- Read all five source documents in full before writing anything: `map-unknowns.md` (5,681
  chars), `dominant-designs.md` (9,957 chars), `systems-thinking.md` (12,573 chars) plus
  `causal-loop-diagrams.md` (5,074 chars) as a genuinely separate secondary source, and
  `structure-argument.md` (6,084 chars) -- all five char counts match the plan's own table
  exactly.
- Wrote and committed four `source_authored` fixtures BEFORE any payload existed:
  `knowns-unknowns-matrix.json`, `dominant-design.json`, `systems-thinking.json`,
  `pyramid-principle.json`. Ran `node --test tests/eval-framework-structure.test.mjs`: discovered
  fixture count rose from **6 to 10**, exactly +4, 17/17 tests pass.
- `systems-thinking.json` carries a testable SPINE DECISION negative control: it asserts
  `"Phase 3: Find Stocks and Flows"` (a real member of the rejected four-phase spine) is ABSENT
  from the authored structure, reusing `checkFrameworkEval`'s existing
  `fabricated_component_name` mechanism against a meaningful name instead of a nonsense
  placeholder.
- `pyramid-principle.json` asserts the ratified canonical name `The Pyramid Principle` exactly as
  `data/flagship-floor-set.json` spells it, carries `wrong_canonical_name: "Minto Pyramid"` as an
  explicit (informational) negative control, and is designed to stay RED even against a re-run of
  `minto-pyramid.mjs` as currently authored, since that payload targets a different node.
- Wrote three payloads (`knowns-unknowns-matrix.mjs`, `dominant-design.mjs`,
  `systems-thinking.mjs`), each cross-checked programmatically (not just by eye) against its
  fixture: phase-name arrays, technique-name arrays, and flow order compared via `JSON.stringify`
  equality between the imported payload module and the fixture JSON. All three matched exactly.
- `systems-thinking.mjs` carries the mandatory `SPINE DECISION:` header block: chose the Five
  Moves (M1-M5) over the four-phase script, quoted the source's own Meta-Lens Framing section as
  justification, named the rejected spine, and stated the reversal condition.
- `dominant-design.mjs` authors "The Utterback-Abernathy Model" as its own Technique node and
  explicitly declines to create a second S-Curve node or emit an edge to the existing ratified
  "S-Curve Analysis" framework, with the write-mechanics reasoning (no resolvable source-framework
  id without a forbidden re-probe) documented in the header rather than silently worked around.
- Wrote `docs/2026-08-21-RULING-pyramid-principle-target.md`: a finding, not a settled ruling,
  ending in a navigator question for plan 261-12. Tables all three nodes in the name family
  (39014 `[Book]`, 38968 "Minto Pyramid" already 3/4, 30242 the ratified "The Pyramid Principle"
  still 0/4), states both competing survivor rulings (`relabel-fix-260820` vs.
  `alias-review.md`) side by side without picking a winner, checks `DESCRIBES`/`SOURCE_FOR`
  against `src/ontology.mjs`'s closed `REL_TYPES` (neither present, confirmed by direct grep),
  and disposes `payloads/minto-pyramid.mjs` as RETARGET.
- Amended `payloads/minto-pyramid.mjs` with a header-only `RETARGET NOTE:` block; `git diff`
  confirms the `nodes`/`edges` arrays are byte-identical to their pre-task state.
- Appended exactly one `## Cross-reference` section to `payloads/relabel-fix-260820/README.md`,
  pointing at the ruling document; `git diff` confirms nothing else in that file changed.
- Confirmed `payloads/run-ingest.mjs` was not run this session, and `git log HEAD..origin/main`
  is empty after all three commits (nothing pushed, per the standing freeze). `ProblemsWorthSolving-Brain`
  sits 41 commits ahead of `origin/main` (concurrent-session activity, not this plan's own volume).

## Task Commits

All three commits made in `ProblemsWorthSolving-Brain` (local, NOT pushed, per the standing
freeze), pathspec-limited to avoid sweeping concurrent-session content:

1. **Task 1: Author four fixtures from source documents, before touching any payload** - `c218cf8` (test)
2. **Task 2: Author the three new Cohort 1 payloads** - `0587bdf` (feat)
3. **Task 3: Resolve the Pyramid Principle node identity and dispose of minto-pyramid.mjs** - `f9b4c38` (docs)

**Plan metadata (this repo, MindrianOS-Plugin):** pending final commit alongside STATE.md/
ROADMAP.md below.

## Files Created/Modified

- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/knowns-unknowns-matrix.json` -
  known-answer fixture, expected readiness 4/4, scoped to HAS_PHASE
- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/dominant-design.json` -
  known-answer fixture, expected readiness 4/4
- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/systems-thinking.json` -
  known-answer fixture, expected readiness 4/4, carries the rejected-spine negative control
- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/pyramid-principle.json` -
  known-answer fixture pinned to the ratified name, expected readiness 4/4
- `ProblemsWorthSolving-Brain/payloads/knowns-unknowns-matrix.mjs` (169 lines) - 4-phase linear
  chain, 1 Technique node (Camera Test)
- `ProblemsWorthSolving-Brain/payloads/dominant-design.mjs` (206 lines) - 6-phase linear chain,
  1 Technique node (Utterback-Abernathy Model), no S-Curve duplication
- `ProblemsWorthSolving-Brain/payloads/systems-thinking.mjs` (202 lines) - 5-node Five Moves
  spine (chosen over the 4-phase script), 1 Technique node (CLD Storytelling Method)
- `ProblemsWorthSolving-Brain/docs/2026-08-21-RULING-pyramid-principle-target.md` (169 lines) -
  node-identity finding, RETARGET disposition, navigator question for 261-12
- `ProblemsWorthSolving-Brain/payloads/minto-pyramid.mjs` - header-only RETARGET NOTE added
- `ProblemsWorthSolving-Brain/payloads/relabel-fix-260820/README.md` - one Cross-reference
  section appended

## Decisions Made

See `key-decisions` in the frontmatter above for the full reasoning on: (1) the Systems Thinking
SPINE DECISION and its testable negative control, (2) why Knowns and Unknowns Matrix ended up
linear despite its source's "iterative" framing, (3) why no S-Curve edge is emitted from Dominant
Design, (4) the Pyramid Principle RETARGET finding, (5) the DESCRIBES/SOURCE_FOR ontology check,
(6) pathspec-limited commits under concurrent-session conditions.

**Edge-type verification, recorded explicitly per the plan's acceptance criteria (same
declared-vs-live deviation 261-03 already documented, not re-litigated here):**

| Edge type | In `payloads/*.mjs` this plan wrote | In `src/ontology.mjs` REL_TYPES (declared) | Precedent (already-executed payload) |
|---|---|---|---|
| `HAS_PHASE` | all three | yes | `reverse-salient-analysis.mjs` (4/4 live) |
| `LEADS_TO` | all three | yes | `reverse-salient-analysis.mjs` (4/4 live) |
| `USES_TECHNIQUE` | all three | no (documented pre-existing drift, per 261-03) | `reverse-salient-analysis.mjs`, `six-thinking-hats.mjs` (both 4/4 live) |

**Readiness-vector cross-check (payload vs. fixture), recorded explicitly per the plan's
acceptance criteria:**

| Framework | Fixture expected | Payload's "EXPECTED READINESS AFTER INGEST" | Match |
|---|---|---|---|
| Knowns and Unknowns Matrix Framework | 4/4 (`1 1 1 1`) | 4/4 (`1 1 1 1`) | yes |
| Dominant Design | 4/4 (`1 1 1 1`) | 4/4 (`1 1 1 1`) | yes |
| Systems Thinking | 4/4 (`1 1 1 1`) | 4/4 (`1 1 1 1`) | yes |

**Node-structure cross-check (payload vs. fixture), verified programmatically via
`JSON.stringify` equality of phase-name arrays, technique-name arrays, and flow order:** all
three payloads matched their fixtures exactly on the first attempt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's own verification grep for `SPINE DECISION:` initially failed
against the header I wrote**
- **Found during:** Task 2, running the plan's own automated verify command
- **Issue:** Wrote the header as `// SPINE DECISION (mandatory for this framework...` (no
  colon), but `scripts/probe-framework-evals.mjs`'s discipline and the plan's own verify command
  (`grep -q 'SPINE DECISION:'`) require the literal string `SPINE DECISION:` with a colon.
- **Fix:** Added the colon (`// SPINE DECISION: (mandatory...`).
- **Files modified:** `ProblemsWorthSolving-Brain/payloads/systems-thinking.mjs`
- **Verification:** Re-ran `grep -q 'SPINE DECISION:' payloads/systems-thinking.mjs`, passes.
- **Committed in:** `0587bdf` (Task 2 commit; caught before commit, so no separate fix commit
  needed)

---

**Total deviations:** 1 auto-fixed (a self-caught typo in my own header, found by running the
plan's own verification command before committing). No scope creep.

## Issues Encountered

- At least one other Claude Code session was concurrently active in `ProblemsWorthSolving-Brain`
  throughout this plan's execution: `git log --oneline -5` showed HEAD advancing between task
  commits (e.g. `4aebc38 docs(02-04 task 3): BRAIN_EVAL_KEY secret provisioned via gh CLI` landed
  between this plan's Task 1 and Task 2), and `.planning/STATE.md`/`.planning/ROADMAP.md` showed
  as modified in `git status` before Task 1's commit and were gone (committed by the other
  session) by Task 2's commit. Handled entirely by pathspec-limited commits and a `git status
  --short` check before each `git add`; none of this plan's three commits swept that content in.
- A live-readiness check for Knowns and Unknowns Matrix (flow=1 already live) initially
  contradicted my first-pass reading of its source as "no sequence" -- resolved by re-reading
  the source's own anti-pattern language more carefully (see key-decisions) rather than either
  ignoring the live evidence or mechanically forcing a no-chain fixture to satisfy the plan's
  general flow-honesty truth statement.

## User Setup Required

None - no external service configuration required. No MCP tools were used (read-only source
documents and the hermetic test harness only, per the plan's own `mcp_tools` note).

## Known Stubs

None. Every payload's structure/technique content is fully authored from its source document;
nothing renders empty or placeholder data.

## Threat Flags

None. This plan's threat_model register (T-261-17 through T-261-21) maps 1:1 onto this plan's own
five acceptance criteria, all satisfied: the RETARGET note names the ids without adopting a
ruling, the Systems Thinking structure set is scoped to one spine only, DESCRIBES/SOURCE_FOR were
checked against the ontology rather than assumed, and Dominant Design creates no duplicate
S-Curve node. No new network endpoint, auth path, file-access pattern, or schema change was
introduced by any file this plan created or modified.

## Next Phase Readiness

- Four of CER-02's seven Cohort 1 rows are now authored fixture-first and ready for the window's
  dry-run (plan 261-12): Knowns and Unknowns Matrix Framework, Dominant Design, Systems Thinking
  (all three ready to execute as-is), and The Pyramid Principle (ready only once a fresh,
  minimal payload targets id 30242 -- `minto-pyramid.mjs` as currently authored is NOT that
  payload; see the ruling document Section 6 for the exact navigator question and recommended
  default). Combined with 261-03's three batch-A rows, all seven of CER-02 Cohort 1's rows now
  have either an authored payload or a documented finding blocking one.
- `docs/2026-08-21-RULING-pyramid-principle-target.md`'s Section 6 navigator question is ready to
  paste directly into plan 261-12's checkpoint: retarget a fresh payload at node 30242
  (recommended default, does not require Section 3's survivor conflict to resolve first) or
  resolve the survivor conflict before deciding what "retarget" means for node 38968.
- The still-open contested-survivor conflict (38968 vs. 30242, `relabel-fix-260820` vs.
  `alias-review.md`) is now cross-linked from BOTH sides (`payloads/relabel-fix-260820/README.md`
  points at the ruling document; the ruling document points back at both source documents), so a
  reader arriving at either finds the other, per this plan's own key_links requirement.
- The `USES_TECHNIQUE`-vs-`ontology.mjs` drift (documented by 261-03, re-confirmed here) remains
  pre-existing and out of scope to close; flagged again for whichever future session next touches
  `src/ontology.mjs`'s `REL_TYPES` completeness. The DESCRIBES/SOURCE_FOR gap this plan newly
  surfaces is a separate, narrower finding: neither type exists in the declared vocabulary at
  all, not merely undeclared-but-live like `USES_TECHNIQUE`.
- Nothing was ingested, nothing was pushed. `ProblemsWorthSolving-Brain` sits at 3 local commits
  ahead of `origin/main` beyond what was already ahead before this plan started (41 total ahead,
  reflecting concurrent-session volume, not this plan's own), all part of the standing pre-261-13
  freeze.

---
*Phase: 261-enrichment-ceremony-single-admin-window*
*Completed: 2026-08-21*

## Self-Check: PASSED

All 10 files this plan created or modified confirmed present on disk in `ProblemsWorthSolving-Brain`
(4 fixtures, 3 payloads, 1 ruling document, 2 modified files) plus this SUMMARY.md in
`MindrianOS-Plugin`. All three task commits (`c218cf8`, `0587bdf`, `f9b4c38`) confirmed present in
`ProblemsWorthSolving-Brain`'s git history.
