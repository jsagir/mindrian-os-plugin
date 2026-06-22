---
kind: canon-review-synthesis
proposed_part: 11
status: synthesized-pending-navigator-ratification
created: 2026-06-22
reviews: [A canon-compliance, B adversarial, C integration]
---

# Part 11 (Invocation Constitution / CIRS) — Three-Review Synthesis

Mirrors the 2026-05-16 dual-graph 3-reviewer pattern. Three independent reviewers ran against
docs/CANON-PART-11-PROPOSAL-invocation-constitution.md.

## Verdicts
- **A (canon-compliance): CANON-COMPLIANT-WITH-CONSTRAINTS.** No frozen-set conflict in the prose;
  ratifiable with constraints C1–C6.
- **B (adversarial): PROPOSAL-OVERSPECIFIED.** Argues against a new Part: fold R5/R8 into Part 8
  Appendix D entry 19; ship R1/R2/R4/R9 as the phase gate; defer R6/R11; kill R12 as a separate
  mechanism; dissolve the ratify-before-plan forcing function. Two pro-Part arguments survive its own
  attack: (1) the moat-altitude argument is real; (2) R2 born-wired is a genuine improvement over
  coverage-as-a-number.
- **C (integration): RECONCILES-WITH-GAPS.** Keep as Part 11 (right altitude; fold-in would re-scatter).
  No frozen-contract contradiction. Clean Part-3/Part-11 boundary. Lifecycle gaps M1–M6 + R12 must
  compose with canon_parts, keyed on slug.

## The split + the synthesized 4th path
A + C support a new Part at the correct altitude (2-of-3); C explicitly rebuts B's fold-in. B's thesis
(no new Part) is outvoted on altitude, but B's RISK reductions are valid and compatible with keeping the
Part. Synthesized recommendation (mirroring the dual-graph "reject framing / approve minimal / defer
rest" resolution, but here inverted — KEEP the Part, DISCIPLINE the rules):

**RATIFY Part 11 as a new Part, in a disciplined-minimal form:**
- **BINDING NOW** (shipped or structural): R1 (two states), R2 (born-wired), R4 (one path),
  R5 (counterpart — cite entry 19), R7 (local-only CQRS), R8 (promotion), R9 (enforced),
  R10 (lockstep), R12 (forward-declaration — as a canon_parts SPECIALIZATION, slug-keyed).
- **DECLARED-BUT-DEFERRED-ENFORCEMENT** (substrate not yet shipped — answers B's premature-closure
  attack): R6 (earned chains) and R11 (fractal rollup). They are CANON (the direction is law) but their
  hard-FAIL enforcement is gated on substrate existing: R6 enforces once curated_chains is populated +
  the projection carries confidence; R11 enforces once the scale-invariant rollup operator ships
  (Phase 169 NESTED_WITHIN exists; the operator does not). Until then they are warn/aspirational. This
  keeps the constitution COMPLETE without freezing an unproven number as hard law.
- **DECOUPLE** "Part 11 is binding canon" from "172 is fully green" (B + C agree). The Part binds on
  ratification; 172 (and Phase 166 runChain, which R4/R6 lean on) implement it over time.

## Constraints to fold into the Part text before ratification

### From Review A (C1–C6)
- **C1** Reaches/postures frozen — triggers wire to the existing 6 reaches; no R-rule mints a 7th
  (precedent: SENS-09 reuses frozen brain_consult).
- **C2** Shape F scalars frozen — the /mos:act standing suggestion + F.1 render move NOTHING
  (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15, single-marker glyph, F.1 keyboard, appendAskUserQuestionTrailer).
  A standing suggestion below 0.70 carries NO RECOMMENDED marker + NO second body glyph.
- **C3** Edge-set disambiguation — R6 confidence lives on the Part-8 PROJECTION FEEDS_INTO (generic
  machinery, LOCAL cache), NOT the Part-4/Part-9 navigation ALLOWED_EDGE_TYPES FEEDS_INTO; no property
  added to the frozen navigation edge; Part 11 mints no edge type.
- **C4** Node-taxonomy frozen + EXCLUDED terminal-legal — R5 counterpart is a Part-8 PROJECTION node
  (methodology_tier-tagged), NOT a room.db Part-9 node; a new room.db node type is a separate
  Phase-108/Part-9 amendment (precedent: SyntheticExpert entry 24). EXCLUDED-with-reason is a
  first-class conformant terminal state, NOT "dark".
- **C5** Part-8 boundary + fractal aggregation unchanged — no new Brain wire; R11 reads child coverage
  SCALARS only and honors entry 23's rule that cross-room aggregation of NESTED_WITHIN edges is FORBIDDEN.
- **C6** Ratification path — numbered Part 11 body + new Appendix D entry + CANON-PHASE-MAP section +
  version-history row; bump from the THEN-CURRENT version (do NOT hardcode 1.13→1.14); Part 6
  dog-fooding mechanism at a navigator-LOCKED checkpoint.

### From Review C (gap fixes + composition)
- **R6 ranking-deferral sentence** — "ordering of surfaced chain candidates is Part 3's MAX_K ranker,
  not CIRS." Seals the only double-governance seam.
- **R1 unit-of-coverage line** — "a surface = one command file, one skill SKILL.md, one agent file;
  sub-behaviors are not independently counted" (resolves the SEED-024 M4 granularity question for v1).
- **R12 composition + slug** — cirs_relationship is a SPECIALIZATION of canon_parts (declaring any
  cirs_relationship field auto-implies 11 ∈ canon_parts; the gate derives one from the other); the
  CANON-PHASE-MAP CIRS column keys on phase SLUG (absorbs the map's own number-collision warning).
- **M1 removal/retired state** — add (as R13 or an R10 extension): a removed surface transitions to a
  RETIRED ledger state with mandatory inbound-chain re-point-or-drop; the gate FAILS on a live
  FEEDS_INTO whose target is retired.
- **M3 trigger-overlap** — add (R14 or R4 clause): trigger-overlap detection in the gate (WARN min);
  arbitration defers to the Part 3 MAX_K ranker.
- **M6 autonomous_safe** — make autonomous_safe a REQUIRED field of the R1 WIRED connector block,
  governed by the gate (it is referenced by INV-18/21 but ungoverned today).
- **Cite the right phases** — R5/R7 cite Appendix D entry 19 (Phase 157); R9 "wired into doctor" cites
  Phase 150.9 doctor --drift (NOT the never-built Phase 92). Name Phase 166 (runChain) as a hard
  prerequisite for the R4/R6 SUCCESS CRITERIA. NOTE: 166 is SHIPPED on disk (chain-executor.cjs, 8 plans)
  though the map frontmatter still says "scoped" (stale).
- **M2/M5** (capability versioning / exclude re-review) — name as known follow-ons if not closed now.

## Minimal "LANDED" edit checklist (one atomic lockstep wave)
1. docs/MINDRIAN-CANON.md — add `## Part 11 - The Invocation Constitution` (doctrine + R1–R14 +
   Relationship-to-existing-Parts), with the C1–C6 + R6-deferral + R1-unit + R12-composition + M1/M3/M6
   fixes folded in; R6/R11 marked declared-but-deferred-enforcement.
2. Appendix D — new entry 25 (Part 11 ratified; navigator-LOCKED; Part 6 mechanism).
3. Version bump — header + footer 1.13 → 1.14 (then-current); CLAUDE.md @docs reference text.
4. CANON-PHASE-MAP — new `### Part 11` section + 172 row + 170/171 conformance rows; re-tag implementers
   (143.2/143.3/144/144.1/148/157/166/169) with canon_parts 11 (additive map metadata).
5. The CIRS column — slug-keyed, 172 row as first cirs_relationship exemplar; declared the R12 surface +
   canon_parts specialization.
6. Version-history row — v1.14 | 2026-06-2x | Part 11 ratified.

All six move in ONE commit (lockstep, CI never RED).
