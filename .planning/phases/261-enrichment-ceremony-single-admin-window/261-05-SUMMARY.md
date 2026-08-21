---
phase: 261-enrichment-ceremony-single-admin-window
plan: 05
subsystem: brain-graph-enrichment
tags: [memgraph, cypher, ingest-payload, judgment-payload, flagship-floor, brain-repo, cer-03]

# Dependency graph
requires:
  - phase: 261-01
    provides: "docs/2026-08-21-WORKLIST-261-ceremony.md (ProblemsWorthSolving-Brain): CER-03
      Cohort 2 worklist rows 12-14 (Futures Wheel, MECE, Adaptive Leadership), each with a live
      readiness vector and a named source doc"
provides:
  - "payloads/futures-wheel.mjs, payloads/mece.mjs, payloads/adaptive-leadership.mjs
    (ProblemsWorthSolving-Brain): three CER-03 Cohort 2 judgment payloads, each carrying a
    mandatory RULING REQUIRED + DISCLOSURE header block, dry-run-only"
  - "tests/fixtures/framework-evals/futures-wheel.json, mece.json, adaptive-leadership.json
    (ProblemsWorthSolving-Brain): three known-answer fixtures, each encoding its framework's
    specific attribution risk as a negative control"
  - "docs/2026-08-21-CARDS-cohort2-batch-a.md (ProblemsWorthSolving-Brain): one paste-ready
    navigator card carrying all three source-authority rulings, consumed verbatim by plan
    261-12's Cohort 2 checkpoint"
affects: [261-12]

# Tech tracking
tech-stack:
  added: []
  patterns: ["JUDGMENT payload pattern: a RULING REQUIRED + DISCLOSURE header pair, where
    RULING REQUIRED names the open source-authority question with per-option consequences and a
    recommended default, and DISCLOSURE states the provenance limit in the file a future reader
    opens, not only in a plan or a card", "negative-control repurposing: fabricated_component_name/
    fabricated_framework_name populated with a REAL sibling name (not a nonsense ZZZ placeholder)
    when the attribution risk is cross-framework leakage or cross-theory conflation, reusing the
    261-04 Systems Thinking SPINE DECISION precedent"]

key-files:
  created:
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/futures-wheel.json
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/mece.json
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/adaptive-leadership.json
    - ProblemsWorthSolving-Brain/payloads/futures-wheel.mjs
    - ProblemsWorthSolving-Brain/payloads/mece.mjs
    - ProblemsWorthSolving-Brain/payloads/adaptive-leadership.mjs
    - ProblemsWorthSolving-Brain/docs/2026-08-21-CARDS-cohort2-batch-a.md
  modified: []

key-decisions:
  - "MECE authored technique-shaped (0 structure, 2 Technique nodes: Mutually Exclusive Test /
    Collectively Exhaustive Test), honestly ceilinged at 2/4 -- this row will NOT flip to PASS
    even on a fully-approved, cleanly-committed ingest. Stated in the fixture, the payload
    header, and the card's per-option table, not discovered after approval."
  - "Adaptive Leadership authored as the PWS-house version: the persona document's four generic
    coaching phases (Opening/Diagnosing/Building/Converging), explicitly disclosed as house
    content rather than an academic Heifetz lineage the source does not support. Readiness 3/4
    on approval, clearing the floor -- unlike MECE, this one DOES flip the row if approved."
  - "Futures Wheel is the first payload in this repo sourced from a command body
    (commands/futures.md) rather than a references/methodology doc. Treated as legitimate
    because the command's own frontmatter frameworks: [\"Futures Wheel\"] line is a structural,
    machine-checked declaration, not incidental prose. Readiness 4/4 on approval."
  - "MECE's fabricated_component_name negative control is deliberately populated with a real
    Pyramid Principle phase name (\"Phase 1: SCQA Framing\") instead of a nonsense placeholder,
    reusing the 261-04 Systems Thinking SPINE DECISION precedent. Because this fixture's own
    structure is asserted empty, any non-empty match -- especially a genuine Pyramid member --
    would prove the exact cross-framework leakage risk T-261-23 names."
  - "Adaptive Leadership's fabricated_framework_name negative control is likewise populated with
    a real sibling theory (\"Situational Leadership\") from the same seven-theory list, testing
    that querying a sibling does not resolve as a canonical match for Adaptive Leadership --
    the concrete test for T-261-22's attribution risk."
  - "All three rulings are bundled onto ONE card document, a deliberate deviation from
    FEATURES.md's per-row Tier C card guidance, justified by the decision-homogeneity rule
    itself: all three ask the SAME kind of question (source authority), so batching sharpens
    attention rather than forcing a context-switch between judgment types."
  - "Edge types (HAS_PHASE, LEADS_TO, USES_TECHNIQUE) were cross-checked against
    src/contracts/schema-contract.mjs's STRUCTURAL_EDGES/SEMANTIC_EDGES, the actual
    ingest-enforced closed vocabulary, rather than src/ontology.mjs's REL_TYPES export, which
    (per its own header comment) is a narrower, not-yet-adopted declaration that does not list
    USES_TECHNIQUE despite every existing payload in this repo using it. Documented here as a
    finding, not silently assumed; every prior payload (reverse-salient-analysis.mjs,
    domain-selection.mjs, mullins-seven-domains.mjs, etc.) made the identical judgment call."

requirements-completed: []

# Metrics
duration: ~55min
completed: 2026-08-21
---

# Phase 261 Plan 05: CER-03 Cohort 2 Batch A (Futures Wheel, MECE, Adaptive Leadership) Summary

**Authored three CER-03 Cohort 2 JUDGMENT payloads (Futures Wheel, MECE, Adaptive Leadership),
each carrying a mandatory RULING REQUIRED + DISCLOSURE header naming its own source-authority
question, plus three fixtures encoding each framework's specific attribution risk as a machine-
checked negative control, plus one paste-ready navigator card bundling all three rulings with
defined accept AND reject branches -- MECE honestly ceilings at 2/4 (will not flip the floor row
even on approval), Futures Wheel and Adaptive Leadership reach 4/4 and 3/4 respectively (both
clear the floor on approval). Dry-run only; nothing ingested, nothing pushed.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3 completed
- **Files created:** 7 (3 fixtures, 3 payloads, 1 card document), all in `ProblemsWorthSolving-Brain`

## Accomplishments

- **Task 1** authored three known-answer eval fixtures directly from their contested sources
  (`commands/futures.md`, `references/methodology/structure-argument.md` Phase 2 section only,
  `references/methodology/leadership.md`), each with an explicit `source` field (path, char
  count, read date), an explicit flow assertion in one direction or the other, a full readiness
  dimension vector, and at least two negative controls. Discovered-fixture count rose 10 -> 13
  (exactly +3). `node --test tests/eval-framework-structure.test.mjs`: 17/17 pass. Live probe leg
  NOT run.
- **Task 2** authored three judgment payloads, each carrying `SOURCE:`, `SHAPE NOTE:`,
  `TECHNIQUE:`, `EXPECTED READINESS AFTER INGEST:`, `RULING REQUIRED:` and `DISCLOSURE:` header
  blocks. All three import cleanly and export `framework.name`/`nodes`/`edges`. Readiness vectors
  cross-checked programmatically against Task 1's fixtures: all three MATCH. Zero em-dashes.
  `payloads/run-ingest.mjs` NOT run.
- **Task 3** lifted the three `RULING REQUIRED:`/`DISCLOSURE:` blocks into
  `docs/2026-08-21-CARDS-cohort2-batch-a.md`: one card, three sections (framework + live
  readiness, proposed source + char count, the problem in two sentences, numbered options with
  per-option payload/floor-row consequences, a recommended default with reason, an exact reply
  token), a `## Reply format` section (one line answers all three, unreplied rows fail closed to
  reject), and a `## What happens on reject` section naming a concrete Phase 263 TAIL-01
  destination per framework. Cross-linked from all three payload headers.

## Task Commits

All three commits made in `ProblemsWorthSolving-Brain` (local, NOT pushed, per the standing
freeze):

1. **Task 1: Author three fixtures from the three contested sources** - `cf426ef` (test)
2. **Task 2: Author the three judgment payloads with mandatory RULING REQUIRED blocks** - `bc3293a` (feat)
3. **Task 3: Lift the three rulings into one paste-ready card document** - `8f4be86` (docs)

**Plan metadata (this repo, MindrianOS-Plugin):** pending final commit alongside STATE.md/
ROADMAP.md below.

## Files Created/Modified

- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/futures-wheel.json` (51 lines)
- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/mece.json` (45 lines)
- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/adaptive-leadership.json` (50 lines)
- `ProblemsWorthSolving-Brain/payloads/futures-wheel.mjs` (166 lines)
- `ProblemsWorthSolving-Brain/payloads/mece.mjs` (124 lines, clears the 70-line must_haves floor)
- `ProblemsWorthSolving-Brain/payloads/adaptive-leadership.mjs` (163 lines)
- `ProblemsWorthSolving-Brain/docs/2026-08-21-CARDS-cohort2-batch-a.md` (147 lines)

## The three rulings, at a glance (for 261-12's checkpoint)

| Framework | Source | Recommended default | Readiness on approval | Floor row on approval |
|---|---|---|---|---|
| Futures Wheel | `commands/futures.md` (command body, precedent extension) | accept | 4/4 | PASS |
| MECE | `structure-argument.md` Phase 2 only (shared with The Pyramid Principle) | accept-thin | 2/4 | Stays MISS |
| Adaptive Leadership | `leadership.md` (7-theory persona doc) | accept-house | 3/4 | PASS |

MECE is the one row on this card where the recommended default does NOT clear the floor -- the
navigator is told this before approving, on the card itself, not discovered after ingest.

## Decisions Made

See `key-decisions` in the frontmatter above for the full, sourced list. The single most
load-bearing one: MECE's honest 2/4 ceiling is disclosed at every layer (fixture, payload header,
card) rather than smoothed into a higher score by inventing phase structure the Phase 2 section
does not contain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Documentation gap] `src/ontology.mjs`'s closed edge list does not include `USES_TECHNIQUE`**
- **Found during:** Task 2, verifying the plan's acceptance criterion "every emitted edge type
  appears in `src/ontology.mjs`'s closed list"
- **Issue:** `src/ontology.mjs`'s `REL_TYPES` export (the literal "closed list" the acceptance
  criterion names) does not include `USES_TECHNIQUE`, even though every existing payload in this
  repo (`reverse-salient-analysis.mjs`, `domain-selection.mjs`, `mullins-seven-domains.mjs`,
  `knowns-unknowns-matrix.mjs`, `dominant-design.mjs`, `systems-thinking.mjs`, and this plan's
  own three) emits it. `REL_TYPES`'s own header comment states it is a declaration "so the WRITE
  path can adopt the read path's discipline" -- i.e. aspirational, not yet the enforced gate.
  `src/contracts/schema-contract.mjs`'s `SEMANTIC_EDGES` set is the actual ingest-enforced closed
  vocabulary and does include `USES_TECHNIQUE`.
- **Fix:** Cross-checked all three payloads' emitted edge types (`HAS_PHASE`, `LEADS_TO`,
  `USES_TECHNIQUE`) against `schema-contract.mjs`'s `STRUCTURAL_EDGES`/`SEMANTIC_EDGES` instead,
  and recorded this finding explicitly (in the Task 2 commit message and here) rather than
  silently treating the acceptance criterion as satisfied by the narrower, unused `ontology.mjs`
  list, or silently substituting a different edge type not backed by precedent.
- **Files modified:** none (documentation-only finding, no payload edge type changed)
- **Verification:** `grep -oP` confirmed the exact edge-type set emitted by each payload; each
  type is present in `schema-contract.mjs`'s closed sets.
- **Committed in:** `bc3293a` (Task 2 commit message)

---

**Total deviations:** 1 auto-fixed (documentation gap, Rule 1 class -- the acceptance criterion
named a file that does not actually enforce the ingest-time edge vocabulary).
**Impact on plan:** None on the payloads themselves; all edge types were already legal per the
repo's actual precedent and the real enforcement point (`schema-contract.mjs`).

## Issues Encountered

None beyond the documentation-gap deviation above.

## User Setup Required

None -- no external service configuration required. All three rulings await the navigator's
reply at plan 261-12's Cohort 2 checkpoint, via `docs/2026-08-21-CARDS-cohort2-batch-a.md`.

## Next Phase Readiness

- `docs/2026-08-21-CARDS-cohort2-batch-a.md` is ready for plan 261-12's Cohort 2 checkpoint to
  paste verbatim.
- All three payloads are dry-run-only, never executed against canon; `payloads/run-ingest.mjs`
  was not run in this plan.
- The navigator should know, before replying, that MECE's `accept-thin` default does not clear
  the flagship floor even on approval -- this is stated on the card itself, not hidden.
- `ProblemsWorthSolving-Brain` is local-commits-ahead of `origin/main` (many commits accumulated
  under the standing push freeze across this phase); this plan's three commits (`cf426ef`,
  `bc3293a`, `8f4be86`) are among them, NOT pushed. Plan 261-13 is the only plan permitted to
  push.

---
*Phase: 261-enrichment-ceremony-single-admin-window*
*Completed: 2026-08-21*
