# Phase 108: Canon Part 9 Cross-Reference Checklist

**Status:** Proposal cross-reference document. RECONCILE-108-06 deliverable. Phase 108 does NOT edit `docs/MINDRIAN-CANON.md`. Phase 109 release gate ratifies Part 9; this file holds the cross-reference proof until then.

**Authority:** This file is auditable proof that every Phase 108 deliverable (D-01 through D-05) carries a Canon Part justification. The full Canon Part 9 amendment text lives at `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md`; this file does NOT duplicate it.

**Date:** 2026-05-03

## Why This File Exists (and what it does NOT do)

Per CONTEXT D-06 + RESEARCH Anti-Pattern #2: Phase 108 ships zero edits to `docs/MINDRIAN-CANON.md`. The Part 9 amendment is RATIFIED at the Phase 109 release gate when the navigation spine ships. Phase 108 ships:

1. The cross-reference matrix below (this file).
2. The "Part 9 (proposed)" row in `docs/CANON-PHASE-MAP.md` (Task 2 of this plan).
3. The completeness test at `tests/test-canon-crossref-completeness.cjs` (Task 3 of this plan).

What Phase 108 does NOT do:
- Edit `docs/MINDRIAN-CANON.md` (deferred to Phase 109 release gate per CONTEXT D-06).
- Duplicate the Part 9 canon text (lives at `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md`).
- Update any existing Canon Part row in CANON-PHASE-MAP.md (only ADDS the Part 9 (proposed) subsection).

## Cross-Reference Matrix (per RESEARCH §7)

Every reconciliation decision shipped by Phase 108 carries a Canon Part justification. The completeness test (Task 3) walks `RECONCILIATION.md` and `aliases.yml` to verify the matrix below holds row-by-row.

| Phase 108 deliverable | Decision class | Required Canon Part references |
|---|---|---|
| RECONCILIATION.md (D-01) every NEW row | Net-new edge or node type | At least one Canon Part justifying why the existing schema is insufficient (typically Part 7 reuse-before-build mandate; often also Part 4 or Part 5) |
| RECONCILIATION.md (D-01) every EXTEND row | Existing concept extended | Canon Part justifying the extension (typically Part 4 for graph data extensions, Part 5 for evidence-bar extensions) |
| RECONCILIATION.md (D-01) every RESERVED row | Name-locked, behavior-deferred | Canon Part 9 (locality + interpretation) + the deferred phase number (currently Phase 112 for BUDDED_FROM, SHARES_ASSUMPTION_WITH, CONTAINS) |
| RECONCILIATION.md (D-01) every EXISTS row | Already shipped | Source phase number (e.g., Phase 87, Phase 88, Phase 89) + Canon Part the existing edge/node implements |
| PROVENANCE.md (D-02) provenance contract | Required + optional fields | Canon Part 4 (every choice is graph data) + Canon Part 9 (the human confirms truth via the confirmed_by != 'user' invariant) + Canon Part 8 (the created_by='brain' enum value annotates LOCAL nodes; does NOT mean egress) |
| TRUTH-STATES.md (D-03) 8-state taxonomy | Closed-set state vocabulary | Canon Part 5 (evidence graded by context - needs_evidence/validated/invalidated align with the evidence-tier model) + Canon Part 9 (the human confirms truth via confirmed state) + Canon Part 4 (state transitions are events, not silent UPDATEs) |
| TRUTH-STATES.md (D-03) status_aliases | Reconciliation with existing assumptions.validity enum | Canon Part 4 (alias migration is a typed event per memory_event row) + Canon Part 9 (the new taxonomy enforces locality semantics that the old enum did not) |
| aliases.yml (D-04) machine-readable companion | Single source of truth for hook | Canon Part 7 (reuse before build - every entry maps to a Codex term that the hook recognizes; net-new tables not in this file fail commit) |
| scripts/check-schema-aliases.cjs (D-05) pre-commit hook | Architectural enforcement | Canon Part 7 (reuse before build - hook is the architectural enforcement of D-05) + Canon Part 8 (constitutional enforcement pattern; analogous to the brain-boundary-scan PR gate referenced in Part 8) |
| This file (PART-9-PROPOSAL.md, D-06) | Cross-reference checklist | Cross-references Canon Parts 1, 4, 5, 7, 8 per the matrix above; references the Part 9 proposal text at .planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md |
| CANON-PHASE-MAP.md "Part 9 (proposed)" subsection | Phase mapping | Documents Phase 108 (proposal), Phase 109 (implementation + ratification at release gate), Phase 110 (Brain wire enforcement) as the implementing cluster |

## Ratification Path

Per `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` "Ratification path" section verbatim:

1. Phase 108 CONTEXT.md (filed) embeds the Part 9 proposal as a deliverable.
2. Phase 108 plan-phase produces this PART-9-PROPOSAL.md plus the CANON-PHASE-MAP.md "Part 9 (proposed)" row plus the cross-reference completeness test.
3. At Phase 108 release gate (likely v1.13.0 given the canon-level nature), the Part 9 proposal is referenced in the CHANGELOG; Codex is named in research provenance attribution.
4. At Phase 109 release gate, Part 9 is MERGED into `docs/MINDRIAN-CANON.md` as a single commit with provenance pointing back to the proposal file and to Codex's research input (`2026-05-03-codex-graph-memory-proposal.md`).
5. Appendix D of MINDRIAN-CANON.md (Canonization Provenance) gains an entry attributing Part 9 to Codex's "SQL as local mind" expansion (2026-05-03).
6. CANON-PHASE-MAP.md `Part 9 (proposed)` subsection is updated at the Phase 109 release commit: status changes from "proposed" to "shipped" for Phase 108 + Phase 109 rows; Phase 110 row remains "planned" until Phase 110 ships.

## Citation Index (which Canon Part each Phase 108 deliverable cites)

Useful for the cross-reference test (Task 3) which walks RECONCILIATION.md row-by-row and verifies every row has at least one Canon Part citation.

| Canon Part | Cited from |
|---|---|
| Part 1 (Wicked Navigator) | aliases.yml node_aliases entry for `room` (cites Part 1, Part 4); RECONCILIATION.md `room` row |
| Part 2 (Team Around Navigator + Engine 1) | RECONCILIATION.md edges HSI_CONNECTION, ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, WHITESPACE_*, DISCOVERED, AUTHORED_BY, AFFILIATED_WITH; nodes opportunity (filesystem + graph), Stakeholder; opportunity edges BANKED_BY, RANKS_OPPORTUNITY, ANSWERS_OPPORTUNITY |
| Part 3 (Tri-Context Decision Gate) | aliases.yml node_aliases entry for `decision` (cites Part 3); RECONCILIATION.md decision row; TRUTH-STATES.md transition triggers (User APPROVE / REJECT at Decision Gate) |
| Part 4 (Every Choice Is Graph Data) | EVERY edge row in RECONCILIATION.md (every typed edge IS Canon Part 4); EVERY node row; PROVENANCE.md (every node carries provenance per Part 4); TRUTH-STATES.md (transitions are events per Part 4); aliases.yml status_aliases section (alias migration is a memory_event per Part 4) |
| Part 5 (Evidence Is Graded By Context) | RECONCILIATION.md edges SUPPORTS, EVIDENCES; node `evidence`; PROVENANCE.md confidence REAL field; TRUTH-STATES.md states needs_evidence, validated, invalidated; transition required-evidence column |
| Part 7 (Reuse Before Build) | EVERY NEW row in RECONCILIATION.md (Canon Part 7 mandates net-new capability is justified); aliases.yml ENTIRE FILE (the alias table IS the reuse-before-build enforcement substrate); scripts/check-schema-aliases.cjs (the hook IS Canon Part 7 in code form) |
| Part 8 (Graph Boundary) | PROVENANCE.md created_by='brain' enum value (Canon Part 8 note: 'brain' is creator, not egress destination); aliases.yml node_aliases entry for `brain_insight` (cites Part 8); scripts/check-schema-aliases.cjs (LOCAL-only enforcement; zero Brain queries) |
| Part 9 (Memory Locality and Interpretation - PROPOSED) | EVERY NEW row in RECONCILIATION.md (locality contract); EVERY RESERVED row (Part 9 carries the deferral); PROVENANCE.md confirmed_by != 'user' invariant (the canonical Part 9 SQL); TRUTH-STATES.md proposed/confirmed distinction (Part 9 truth-state contract); aliases.yml status_aliases (Part 9 reconciliation with existing enum) |

## Risks Acknowledged (per Canon Part 9 proposal "Risks of ratifying as-written")

1. **Risk: prose elevation of an unimplemented architecture.** Mitigation: ratify at Phase 109 release gate, not Phase 108. Phase 108 cites Part 9 as a proposed amendment.
2. **Risk: confusion with Part 8.** Mitigation: explicitly cross-reference Part 8 in Part 9's text (done in the proposal file); update Part 8 to forward-reference Part 9 in the same canon edit (Phase 109 release gate).
3. **Risk: "the human confirms truth" is sentimental, not architectural.** Mitigation: the truth-state taxonomy (TRUTH-STATES.md) and the confirmed_by != 'user' invariant SQL (PROVENANCE.md) make this concrete and testable.

## Recommended Decision (verbatim from proposal)

**Approve in principle now. Ratify at Phase 109 release gate.** Phase 108 carries the amendment as a proposed deliverable; Phase 109 ships the implementation; the canon merge happens with the Phase 109 release commit. This pattern matches how Part 8 was sharpened with teeth (PR gate, persona protection table, "violations are bugs") in canon v1.1.

## Anti-Patterns Avoided

- No edit to `docs/MINDRIAN-CANON.md` (Phase 109 release gate per CONTEXT D-06 + RESEARCH Anti-Pattern #2).
- No duplicate of the Part 9 canon text (the source-of-truth is `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md`).
- No invention of new Canon Parts beyond the Part 9 already proposed.
- No edit to existing CANON-PHASE-MAP.md rows (Part 1..Part 8 untouched; only Part 9 (proposed) ADDED).

## Cross-Reference Test (Task 3)

The completeness check at `tests/test-canon-crossref-completeness.cjs` enforces:
1. Every reconciliation row in RECONCILIATION.md cites at least one Canon Part.
2. Every Canon Part cited resolves to either Parts 1-8 in `docs/MINDRIAN-CANON.md` OR Part 9 in this PART-9-PROPOSAL.md (per RESEARCH Pitfall 7 - the test treats this file as a valid Part 9 source during Phase 108).
3. `docs/CANON-PHASE-MAP.md` contains a "Part 9 (proposed)" subsection (Task 2).
4. After Phase 109 ratification, the test reads `docs/MINDRIAN-CANON.md` for Part 9 instead.
