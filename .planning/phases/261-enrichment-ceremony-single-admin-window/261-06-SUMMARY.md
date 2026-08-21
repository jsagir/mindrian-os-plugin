---
phase: 261-enrichment-ceremony-single-admin-window
plan: 06
subsystem: brain-graph-enrichment
tags: [memgraph, cypher, ingest-payload, judgment-payload, flagship-floor, brain-repo, cer-03]

# Dependency graph
requires:
  - phase: 261-01
    provides: "docs/2026-08-21-WORKLIST-261-ceremony.md (ProblemsWorthSolving-Brain): CER-03
      Cohort 2 worklist rows 11/15-17 (Mullins Model, PWS Triple Validation Compass,
      Hypothesis-Driven Problem Solving, Adoption-Capacity Theory), each with a live readiness
      vector and a named source doc, plus Section 4's reuse-audit disposition (RUN) for
      payloads/mullins-seven-domains.mjs"
provides:
  - "payloads/triple-validation-compass.mjs, payloads/hypothesis-driven-problem-solving.mjs,
    payloads/adoption-capacity-theory.mjs (ProblemsWorthSolving-Brain): three CER-03 Cohort 2
    batch B judgment payloads, each carrying a mandatory RULING REQUIRED + DISCLOSURE header
    block, dry-run-only"
  - "payloads/mullins-seven-domains.mjs (ProblemsWorthSolving-Brain): appended VERIFICATION
    2026-08-21 header block, four checks all PASS, body byte-for-byte unchanged"
  - "tests/fixtures/framework-evals/triple-validation-compass.json,
    hypothesis-driven-problem-solving.json, adoption-capacity-theory.json, mullins-model.json
    (ProblemsWorthSolving-Brain): four known-answer fixtures"
  - "docs/2026-08-21-CARDS-cohort2-batch-b.md (ProblemsWorthSolving-Brain): one paste-ready
    navigator card carrying the CER-03-named Triple Validation Compass ruling (two separate
    option sets) plus two more accept/reject rulings plus a Mullins confirmation card, consumed
    verbatim by plan 261-12's Cohort 2 checkpoint"
affects: [261-12]

# Tech tracking
tech-stack:
  added: []
  patterns: ["JUDGMENT payload pattern (261-05 precedent): a RULING REQUIRED + DISCLOSURE header
    pair, extended here to a TWO-QUESTION ruling for the first time (Triple Validation Compass's
    authority question and its double-attribution question, deliberately NOT collapsed into one
    yes/no)", "VERIFICATION header pattern (new in this plan): for a payload authored and
    executed in a prior cycle, a dated VERIFICATION block records N named checks against the
    live worklist and this plan's own fixture, with an explicit HOLD-if-any-check-fails rule,
    rather than either re-authoring the body or trusting it unverified", "negative-control
    repurposing with a REAL sibling name (261-04/261-05 SPINE DECISION precedent), applied here
    to catch a specific-named S-Curve Analysis phase inside Adoption-Capacity Theory's structure
    and a specific-named PWS Value Proposition Gate inside Triple Validation Compass's structure"]

key-files:
  created:
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/triple-validation-compass.json
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/hypothesis-driven-problem-solving.json
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/adoption-capacity-theory.json
    - ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/mullins-model.json
    - ProblemsWorthSolving-Brain/payloads/triple-validation-compass.mjs
    - ProblemsWorthSolving-Brain/payloads/hypothesis-driven-problem-solving.mjs
    - ProblemsWorthSolving-Brain/payloads/adoption-capacity-theory.mjs
    - ProblemsWorthSolving-Brain/docs/2026-08-21-CARDS-cohort2-batch-b.md
  modified:
    - ProblemsWorthSolving-Brain/payloads/mullins-seven-domains.mjs

key-decisions:
  - "The plan's own premise ('NO document anywhere names Triple Validation Compass', citing
    FEATURES.md's 2026-08-13 'zero hits outside command frontmatter' reading) was RE-VERIFIED,
    not repeated, per the plan's own instruction. A fresh repo-wide grep found 122 hits across 41
    files, and -- the load-bearing correction -- exactly ONE non-frontmatter, non-generated-data
    hit: references/personality/pws-lexicon-full.md:175, a glossary row that DOES define the
    framework ('Is it Real? Can we Win? Is it Worth It? The three gates every PWS must pass.').
    This finding is recorded verbatim in the fixture, the payload header, and the card, rather
    than smoothed over to match the plan's assumed premise."
  - "Given that lexicon definition's wording maps closely onto value-proposition.md's Three
    Gates, the SAFER default was still chosen: triple-validation-compass.mjs grounds its
    structure on grade.md ALONE (five-phase grading process + the Discovery Score Formula
    technique), not on the Three Gates, specifically to avoid colliding with PWS Value
    Proposition's own already-live, unknown-content structure (T-261-29). grade.md is
    independently declared in THREE commands' frontmatter (grade.md, deep-grade.md,
    compare-ventures.md), the strongest such precedent in this repo."
  - "Triple Validation Compass is the first payload in this plan's lineage to carry a
    TWO-QUESTION ruling (authority: which partial source is authoritative; double-attribution:
    does the Three Gates ground both frameworks) rather than one, per the plan's own explicit
    instruction not to collapse them into a single yes/no."
  - "Adoption-Capacity Theory's structure is drawn from commands/diffusion.md's own six
    explicitly numbered ACE steps (Define package -> Mark t0 -> Code FI/OC -> Profile capacity ->
    Compute fit -> Derive forecast), sharing zero phase names with analyze-timing.md's six
    S-Curve Analysis phases (already live, ratified, 3/4) -- verified by a negative control
    naming a real S-Curve phase ('Phase 4: Dominant Design Analysis') and asserting its absence,
    the single most important assertion this plan's own objective names."
  - "mullins-seven-domains.mjs (authored in a prior cycle, commit aa15966, already executed
    once) was NOT re-authored. A dated VERIFICATION 2026-08-21 header block was appended instead,
    covering four named checks (target identity, structure member set vs this plan's fixture,
    absence of LEADS_TO by design, honest 3/4 readiness ceiling with flow permanently
    unsupported) -- all four PASS, no HOLD. git diff confirms the payload body is byte-for-byte
    unchanged; only the header comment grew."
  - "Three of the four rows on this plan's card (Triple Validation Compass, Hypothesis-Driven,
    Adoption-Capacity) already measure live readiness 2/4 (structure=1, flow=1 already present)
    rather than a fresh 0/4 -- of UNKNOWN provenance, not caused by this plan or its payloads.
    Each fixture and payload header discloses this explicitly rather than silently assuming the
    existing content is compatible with what this plan authors; the card recommends an operator
    discover_structure check before any future dry-run/commit."
  - "Mullins Model's card section is a CONFIRMATION card, not an authority card, because its
    source document is uncontested and its payload already exists -- the only open question is
    whether an honest 3/4 ceiling (flow permanently unsupported, because the source names seven
    independent, unordered domains) is accepted. The card states plainly that 3/4 already clears
    the flagship floor's readiness >= 3 requirement."

requirements-completed: []

# Metrics
duration: ~65min
completed: 2026-08-21
---

# Phase 261 Plan 06: CER-03 Cohort 2 Batch B (Triple Validation Compass, Hypothesis-Driven,
Adoption-Capacity, Mullins verify) Summary

**Authored CER-03's remaining four rows: three new CER-03 Cohort 2 batch B judgment payloads
(PWS Triple Validation Compass, Hypothesis-Driven Problem Solving, Adoption-Capacity Theory) plus
a four-point verification of the already-authored Mullins payload, four fixtures, and one
paste-ready navigator card carrying the CER-03-named Triple Validation Compass source-attribution
ruling as two separate option sets (authority + double-attribution) rather than one collapsed
yes/no. Re-verified, rather than repeated, the plan's own "no document names Triple Validation
Compass" premise -- found one genuine glossary definition and recorded the correction plainly.
Adoption-Capacity Theory's structure is proven, by negative control, to share zero phase names
with S-Curve Analysis's already-live six phases. Dry-run only; nothing ingested, nothing pushed.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 3/3 completed
- **Files created:** 8 (4 fixtures, 3 payloads, 1 card document); 1 file modified
  (`payloads/mullins-seven-domains.mjs`, header-only), all in `ProblemsWorthSolving-Brain`

## Accomplishments

- **Task 1** authored four known-answer eval fixtures. Three (`triple-validation-compass.json`,
  `hypothesis-driven-problem-solving.json`, `adoption-capacity-theory.json`) were authored
  directly from their contested sources (`references/methodology/grade.md`,
  `commands/research.md`, `commands/diffusion.md` + `lib/core/sensors/sensor-diffusion-
  adoption.cjs`, all read in full or per the plan's own read_first scope). The fourth
  (`mullins-model.json`) was authored independently from `references/methodology/
  mullins-7-domains.md` to VERIFY the existing `mullins-seven-domains.mjs` payload against it,
  not to source a new payload. The repo-wide grep for "Triple Validation Compass" was re-run: 122
  hits across 41 files, with one genuine glossary definition found at
  `references/personality/pws-lexicon-full.md:175` -- recorded verbatim, correcting the plan's
  own stated premise rather than repeating it. Discovered-fixture count rose 13 -> 17, exactly
  +4. `node --test tests/eval-framework-structure.test.mjs`: 17/17 pass. Live probe leg NOT run.
- **Task 2** authored three judgment payloads with `RULING REQUIRED:`/`DISCLOSURE:` header
  blocks, and appended a `VERIFICATION 2026-08-21:` header block to the pre-existing
  `mullins-seven-domains.mjs` (git diff confirmed header-only, body byte-for-byte unchanged, all
  four named checks PASS, no HOLD). All three new payloads import cleanly and export
  `framework.name`/`nodes`/`edges`; readiness vectors cross-checked programmatically against
  Task 1's fixtures: all three MATCH (4/4 each). Every emitted edge type (`HAS_PHASE`,
  `LEADS_TO`, `USES_TECHNIQUE`) confirmed present in `src/contracts/schema-contract.mjs`'s
  `STRUCTURAL_EDGES`/`SEMANTIC_EDGES` closed vocabulary. Zero em-dashes. `payloads/run-ingest.mjs`
  NOT run.
- **Task 3** wrote `docs/2026-08-21-CARDS-cohort2-batch-b.md`: the CER-03-named Triple Validation
  Compass ruling as two separate numbered option sets (authority: grade.md vs
  value-proposition.md; double-attribution: does the Three Gates ground both frameworks), the
  re-verified grep evidence quoted, an explicit de-list-is-not-an-option note citing the PEST
  precedent, two more accept/reject rulings (Hypothesis-Driven, Adoption-Capacity), and a Mullins
  CONFIRMATION section presenting all four Task 2 verification results. `## Reply format` and
  `## What happens on reject` sections cover all five rulings with no reject branch left
  undefined. Cross-linked from all four payload headers.

## Task Commits

All three commits made in `ProblemsWorthSolving-Brain` (local, NOT pushed, per the standing
freeze; confirmed via `git log origin/main..HEAD` showing 47 commits ahead, `git log
HEAD..origin/main` empty):

1. **Task 1: Author four fixtures, re-verify the Triple Validation Compass grep** - `ae504ad` (test)
2. **Task 2: Author three judgment payloads, verify the existing Mullins payload** - `b43f6d2` (feat)
3. **Task 3: Write the batch B card, the named Triple Validation Compass ruling** - `d8773e5` (docs)

**Plan metadata (this repo, MindrianOS-Plugin):** pending final commit alongside STATE.md/
ROADMAP.md below.

## Files Created/Modified

- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/triple-validation-compass.json` (67 lines)
- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/hypothesis-driven-problem-solving.json` (54 lines)
- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/adoption-capacity-theory.json` (65 lines)
- `ProblemsWorthSolving-Brain/tests/fixtures/framework-evals/mullins-model.json` (50 lines)
- `ProblemsWorthSolving-Brain/payloads/triple-validation-compass.mjs` (199 lines)
- `ProblemsWorthSolving-Brain/payloads/hypothesis-driven-problem-solving.mjs` (178 lines)
- `ProblemsWorthSolving-Brain/payloads/adoption-capacity-theory.mjs` (174 lines, clears the
  70-line must_haves floor)
- `ProblemsWorthSolving-Brain/payloads/mullins-seven-domains.mjs` (+39 lines, header only)
- `ProblemsWorthSolving-Brain/docs/2026-08-21-CARDS-cohort2-batch-b.md` (285 lines)

## The four rulings, at a glance (for 261-12's checkpoint)

| Framework | Source | Recommended default | Readiness on approval | Floor row on approval |
|---|---|---|---|---|
| PWS Triple Validation Compass | `grade.md` (8,209 chars), grounds alone (Question 2 default) | grade / grade-alone | 4/4 | PASS |
| Hypothesis-Driven Problem Solving | `commands/research.md` (25,520 chars, command body) | accept | 4/4 | PASS |
| Adoption-Capacity Theory | `commands/diffusion.md` (4,663 chars, command body) | accept | 4/4 | PASS |
| Mullins Model (confirmation) | `mullins-7-domains.md` (already-authored payload) | accept-ceiling | 3/4 (honest ceiling, `flow` unsupported by design) | PASS |

All four rows on this card DO clear the floor on approval -- unlike batch A's MECE row, none of
this plan's four rows is a row that stays MISS even on a clean commit.

## Decisions Made

See `key-decisions` in the frontmatter above for the full, sourced list. The single most
load-bearing one: the plan's own stated premise that no document names "Triple Validation
Compass" was re-verified rather than carried forward, and the fresh measurement found a genuine
(if thin) definition in `references/personality/pws-lexicon-full.md` -- reported plainly rather
than smoothed over, with the safer `grade.md`-alone default chosen anyway to avoid the
double-attribution hazard the closer-matching Three Gates source would create.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Documentation gap, precedent from 261-05] `src/ontology.mjs`'s closed edge list does not include `USES_TECHNIQUE`**
- **Found during:** Task 2, verifying the plan's acceptance criterion "every emitted edge type
  appears in `src/ontology.mjs`'s closed list"
- **Issue:** Same finding 261-05 already documented: `src/ontology.mjs`'s `REL_TYPES` export does
  not include `USES_TECHNIQUE`, even though every payload in this repo (including this plan's own
  four) emits it. `src/contracts/schema-contract.mjs`'s `SEMANTIC_EDGES` set is the actual
  ingest-enforced closed vocabulary and does include it.
- **Fix:** Cross-checked all four payloads' emitted edge types against `schema-contract.mjs`'s
  `STRUCTURAL_EDGES`/`SEMANTIC_EDGES` instead, per the established 261-05 precedent.
- **Files modified:** none (documentation-only finding, no payload edge type changed)
- **Verification:** `grep -oP` confirmed the exact edge-type set emitted by each payload; each
  type is present in `schema-contract.mjs`'s closed sets.
- **Committed in:** `b43f6d2` (Task 2 commit message)

**2. [Rule 1 - Bug, correcting the plan's own stated premise] Re-verified grep contradicted the plan's "no document names it" claim**
- **Found during:** Task 1, the mandated repo-wide grep for "Triple Validation Compass"
- **Issue:** The plan's objective states plainly "NO document anywhere names 'Triple Validation
  Compass'"; a fresh grep found one genuine glossary definition at
  `references/personality/pws-lexicon-full.md:175`.
- **Fix:** Recorded the correction verbatim in the fixture, the payload header, and the card,
  rather than silently reporting the plan's original claim as still true. The payload's actual
  authored content still avoids the Three Gates (the safer default), so this correction changed
  the DISCLOSURE text's accuracy, not the payload's technical shape.
- **Files modified:** none beyond the fixture/payload/card content already being authored in this
  plan's normal scope
- **Verification:** grep re-run twice, same 122/41 result both times.
- **Committed in:** `ae504ad` (Task 1 commit message)

---

**Total deviations:** 2 (1 carried-forward documentation-gap precedent, 1 premise-correction).
**Impact on plan:** Neither affected payload technical shape or readiness outcomes; both are
disclosure/documentation corrections in service of the plan's own honesty requirements.

## Issues Encountered

- Three of the four rows on this plan's card (Triple Validation Compass, Hypothesis-Driven,
  Adoption-Capacity) measure live readiness 2/4 rather than a fresh 0/4 -- `structure=1` and
  `flow=1` already present, of UNKNOWN provenance, not caused by this plan. Named in every
  fixture and payload header as a caveat; the card recommends an operator `discover_structure`
  check before any future dry-run/commit, in case the existing content collides with what these
  payloads would add.

## User Setup Required

None -- no external service configuration required. All five rulings (Triple Validation
Compass's two plus three more) await the navigator's reply at plan 261-12's Cohort 2 checkpoint,
via `docs/2026-08-21-CARDS-cohort2-batch-b.md`.

## Next Phase Readiness

- `docs/2026-08-21-CARDS-cohort2-batch-b.md` is ready for plan 261-12's Cohort 2 checkpoint to
  paste verbatim, alongside batch A's card.
- All three new payloads plus the verified Mullins payload are dry-run-only, never executed
  against canon; `payloads/run-ingest.mjs` was not run in this plan.
- CER-03 is now fully authored across both batches (261-05: Futures Wheel, MECE, Adaptive
  Leadership; 261-06: Triple Validation Compass, Hypothesis-Driven, Adoption-Capacity, Mullins) --
  seven judgment rows total, matching CER-03's own requirement text ("7 judgment flagship
  payloads land via individual cards").
- `ProblemsWorthSolving-Brain` is local-commits-ahead of `origin/main` by 47 commits (many
  accumulated under the standing push freeze across this phase); this plan's three commits
  (`ae504ad`, `b43f6d2`, `d8773e5`) are among them, NOT pushed. Plan 261-13 is the only plan
  permitted to push.

---
*Phase: 261-enrichment-ceremony-single-admin-window*
*Completed: 2026-08-21*
