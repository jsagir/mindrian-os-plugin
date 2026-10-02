---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 14
subsystem: research-planner
tags: [perspectives, whitespace, analogies, sapphire, recall, offline, exclusion-set]
requires:
  - 366-04 (ANALOGIES template, an.* lenses)
  - 366-08 (perspective registry, shared.makeCandidateStore/writeRunFiles, eight-key substrate)
provides:
  - perspectives/whitespace-recall.cjs (lanes zone_border, declared_unlinked; TEMPLATE_ID whitespace)
  - perspectives/analogies-recall.cjs (lane structural; STATEMENT_TEMPLATE with host_hint)
affects: [366-12 perspective_recall op (passes statement_template through), 366-16 ledger rows (budgets below)]
tech-stack:
  added: []
  patterns:
    - one exclusion-set upsert (shared.makeCandidateStore) for every perspective
    - analogies re-ranks the eureka pool; no second substrate read
key-files:
  created:
    - lib/core/research-planner/perspectives/whitespace-recall.cjs
    - lib/core/research-planner/perspectives/analogies-recall.cjs
    - tests/test-366-recall-whitespace.cjs
    - tests/test-366-recall-analogies.cjs
  modified: []
decisions:
  - "Whitespace offers a zone name as the ws:gap_claim term only when it is a short composable phrase (max_term_words 4); a longer zone name makes the leaf local-only (SEED-104: a long exact phrase returns a meaningless 0 that reads as gap confirmed)"
  - "declared_unlinked leaves are not researchable: a coupling with no edge is a room gap with no zone term, so it never becomes a literature_gap candidate"
  - "Analogies pair leaves come from eureka's questionSetFor and are re-dimensioned onto an:structural_transfer, so the SEED-104 term gate has one copy"
metrics:
  tasks: 2
  files: 4
  completed: 2026-10-02
---

# Phase 366 Plan 14: Whitespace and analogies perspectives Summary

Two offline perspective recalls: whitespace on its shipped template (zone borders and declared-but-unlinked couplings) and analogies from the eureka pool (relational, low-lexical pairs) with a SAPPhIRE statement template the host fills at the statement stage.

## Commits

- 59958abbf test(366-14): add failing whitespace recall legs W1-W7
- 6dfb68702 feat(366-14): whitespace perspective recall on the shipped whitespace template
- 90c2b2118 test(366-14): add failing analogies recall legs N1-N6
- 8edd3a09a feat(366-14): analogies perspective recall with the SAPPhIRE statement template

## What was built

**whitespace-recall.cjs.** One substrate read through eureka's `buildSubstrate` (read-only door).
- Lane `zone_border`: for each `substrate.whitespace_zones` id, the WHITESPACE_DETECTED rows of `substrate.edges` (zone -> artifact, reversed rows read the same) name the bordering things; the most central bordering thing (highest degree, tie by id) of each two bordering sections is paired. Rows carry `zone_id`.
- Lane `declared_unlinked`: for each `declaredCouplings` entry whose two sections hold things and have zero edge rows between their things, the most central thing of each is paired. No `zone_id`.
- Every pair goes through `shared.makeCandidateStore(substrate).upsert`; sort is lanes count, zone rows first, then ids; cap `max_candidates`, `pairs_truncated` reported; files via `shared.writeRunFiles` (title "Whitespace perspective run", lanes `['zone_border','declared_unlinked']`).
- `questionSetFor` uses the shipped template unchanged: `ws:gap_claim` pair leaves (lens `ws.gap`, slot `term` only, closed pair with perspective `whitespace`), a run-level `ws:covered_elsewhere` leaf when a term exists, a `ws:extraction_failure` room leaf with empty slots, and a coverage note for `ws:irrelevant`.

**analogies-recall.cjs.** `eurekaRecall.recallCandidates` at the eureka cap (200) is the pool (already past the shared exclusion set). Rows are kept when `shared_entities` is non-empty or both things have a USES_FRAMEWORK edge to the same framework node, and `lexical <= 0.15`; lane `structural` is added; rows gain `shared_frameworks`; re-sorted by relational signal count then ids; capped. `STATEMENT_TEMPLATE` is a frozen `mos.sapphire-statement/1` object (sides a, b; slots function, behavior, structure; `fill`; `host_hint`). Leaves carry no SAPPhIRE content. `runRecall` returns `statement_template` so the 366-12 `perspective_recall` op can pass it through.

## SEED-104 handling (navigator's bug report, room egain-des-liquid-conductor)

- Whitespace recall never composes a room-coverage phrase: the room check is the empty-slot `ws:extraction_failure` leaf (the planner's local check owns matching) and the `declared_unlinked` lane is edge-based, not text-based.
- A zone name longer than 4 words (the reported shape was seven) is never turned into an exact-phrase search term: the pair leaf becomes `researchable: false`, `corpus: room`, no slots, with a reason. Leg W5 plants a seven-word zone name and asserts exactly this.
- Not touched (out of scope, peer/other-plan owned): the planner's `localRoomCheck` and the whitespace command's term step. The false-negative itself lives there; this plan only avoids repeating the shape.

## Numeric budgets (for the 366-16 ledger rows)

| Perspective | max_candidates | max_leaves | other |
|-------------|----------------|------------|-------|
| whitespace | 100 | 8 | max_term_words 4 |
| analogies | 100 | 8 | lexical_ceiling 0.15; pool = eureka cap 200 |

STAGE_A_LANES: whitespace `['zone_border','declared_unlinked']`, analogies `['structural','icm_declared']`. RUN_ROOTs: `.mindrian/perspectives/whitespace`, `.mindrian/perspectives/analogies`.

## Verification

- `node tests/test-366-recall-whitespace.cjs`: PASS 7, FAIL 0 (W7 proves one literature_gap item per pair-carrying ws:gap_claim leaf on the real whitespace template)
- `node tests/test-366-recall-analogies.cjs`: PASS 6, FAIL 0
- `node tests/test-363-structure.cjs`: PASS 14, FAIL 0
- `node tests/test-366-perspective-interface.cjs`: PASS 17, FAIL 0 (registry now resolves both modules)
- Greps: `TEMPLATE_ID = 'whitespace'` 1; `makeCandidateStore` 2; analogies `STATEMENT_TEMPLATE` 4, `host_hint` 2, `tavily|fetch(|https?://` 0; `git diff question-templates.cjs` empty.
- Hermetic: HOME, USERPROFILE, MINDRIAN_ROOMS_HOME in temp dirs, session env cleared, zero network attempts.

## Deviations from Plan

None - plan executed as written. Judgment calls inside scope:
- Analogies reuses eureka's `questionSetFor` to build pair leaves (one copy of the term gate) rather than re-implementing it.
- `shared_frameworks` added as an extra row key on analogies; `statement_template` added to the analogies `runRecall` return.

## Known limitations

- Analogies only re-ranks the eureka pool, so a pair sharing only a framework node (no shared entity, no lexical hit, no declared coupling) is never in the pool and cannot surface. Surfacing it would need a framework lane in eureka-recall (366-08 owned); report as a 366-08 gap if wanted.
- Several zone_border candidates from one zone share one term, so their gap leaves issue the same query; the planner owns dedupe.

## Known Stubs

None.

## Self-Check: PASSED

Four created files exist; commits 59958abbf, 6dfb68702, 90c2b2118, 8edd3a09a are in `git log`. STATE.md and ROADMAP.md untouched; no peer-owned file edited.
