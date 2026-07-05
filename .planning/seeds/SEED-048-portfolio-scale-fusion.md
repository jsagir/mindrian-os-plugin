# SEED-048 - Portfolio-scale FUSION (batch-score N technologies, surface the hidden gem)

**Registered:** 2026-07-01 (navigator-directed; tester finding N3 -- Lawrence's "career-making" vision)
**Class:** CODE + ARCH | **Status:** seed
**Grounding:** docs/testers/oliver-kuntz/FEEDBACK.md (2026-07-01); docs/testers/FINDINGS-2026-07-01.md N3. Depends-on / sibling: Phase 205 (FUSION cross-frame engine), Phase 200 (RS engine), Phase 201 (harness-as-code fan-out).

## The vision (Lawrence, Oliver session)

"Take your 500 rows of technologies. Uncover one gem worth a fortune that nobody was paying attention to. That's the big win. That makes your career." Concretely: prepare a set of questions (Mullins / Thiel / HEART / JTBD), feed N technologies at once, produce per-technology structured output + a score, then COMBINE low-scoring ones into a higher-value whole ("three low into one high"). Run at scale (start with 3-10, aim at 500) with careful multi-source verification, so a human can decide what moves forward.

## Why it matters

This is horizontal + lateral elevation (Part 12) applied at PORTFOLIO scale, not one venture at a time. It is the same engine as Phase 205 FUSION (cross-frame connection) plus Phase 200 Reverse-Salient (find the lagging / hidden-value component) plus Phase 201 fan-out (one agent per technology). The output feeds a scoring database + stage-gate routing (the operational mock-up Oliver built). It turns Mindry from a single-venture thinking partner into a portfolio-triage engine.

## Proposed scope

- Batch mode: feed N technologies (or room sub-rooms), one FUSION/RS pass each (fan-out via the harness), a shared question set, a per-technology Vercel page + a score.
- Cross-technology COMBINE: surface where combining low-scorers yields a high-value whole (the reverse-salient / cross-domain combine).
- A scoring + stage-gate routing surface (archive reasons: tech-limit / people-limit / duplicate / dissolved) with an off-ramp.
- Part 8: LOCAL per-room; only generic handles egress. Part 7: reuse FUSION (205) + RS (200) + harness (201); mint no new engine.

## Relationship

Its OWN phase, registered as Phase 215 (2026-07-04, `.planning/ROADMAP.md`), riding at the end of the EUREKA two-in-a-box track (211-214, SEED-049+050) -- NOT part of that flagship pair, confirmed in `.planning/seeds/INDEX.md`. It is the highest-ceiling finding from the tester evals -- the "uncover one gem" outcome is the product's biggest promise to a tech-transfer / portfolio user.

## Standalone research (WebSearch, 2026-07-04; Tavily was down, 402 payment-required, navigator approved WebSearch fallback)

This seed had zero prior research grounding (unlike SEED-049). Registered as its own update track per navigator instruction, independent of any other in-flight update. Findings validate the vision academically and give the seed a concrete scoring methodology it did not have before.

- **The "hidden gem" thesis has real academic backing, not just Lawrence's intuition.** Innovation-research literature on weak-signal analysis (Topic Emergence Maps) classifies signals as strong (high average attention + high growth) vs weak (low average attention, high growth rate) -- and critically: "patents related to weak rather than strong signals are more likely to be high-impact innovations." That is a direct, citable, empirical validation of "uncover one gem worth a fortune that nobody was paying attention to" -- the gem is disproportionately likely to be hiding in the LOW-attention tail, not the obvious high-scorers. This should anchor the seed's scoring logic: do not just rank by top score, specifically surface high-growth-rate-but-low-average-attention items as a distinct flagged category, mirroring SEED-049's differential (bert-high/lexical-low) logic but over ATTENTION/GROWTH signals instead of semantic/lexical ones.
- **A named academic precedent for the batch + cross-domain-combine mechanic:** Portfolio-based Technology Opportunity Discovery frameworks bridge domain foresight with firm practicality via technology convergence networks (tracking how technologies from different domains converge over time) plus predictive modeling over the firm's own technology portfolio. This is the closest existing framework to "feed N technologies, surface where combining low-scorers yields a high-value whole" -- worth citing as the methodological ancestor rather than inventing the combine-logic from scratch.
- **A concrete staged scoring structure to adopt (resolves "what does the score/stage-gate actually measure" which the seed left open):** innovation portfolio scoring frameworks weight different criteria at different stages -- strategic fit at idea stage, market potential + customer validation at discovery stage, technical feasibility + unit economics + ROI at scaling stage. This maps directly onto the seed's proposed stage-gate routing (archive reasons: tech-limit / people-limit / duplicate / dissolved) -- recommend the per-technology structured output carry THREE scored dimensions (strategic fit, validated demand, technical/economic feasibility), not one flat score, so the "combine low-scorers into a high-value whole" logic can reason about WHICH dimension was weak (e.g. two technologies each weak on market fit but strong on technical feasibility might combine into something with both).
- **AI-assisted stage-gate scoring is already a documented practice with measured impact:** AI-enhanced gate processes report ~25% better gate-decision accuracy and 30-50% cycle-time reduction, doing exactly what SEED-048 proposes at commodity scale -- de-duplicating ideas, clustering themes, flagging gaps, suggesting initial scores for a human to confirm. AHP (Analytic Hierarchy Process) is the recommended scoring method for weighting strategic-alignment criteria; a lightweight risk model covers feasibility. Recommend AHP-style pairwise-weighted scoring over an ad-hoc 0-10 rubric for the "shared question set" (Mullins/Thiel/HEART/JTBD) so the per-technology score is defensible, not just a vibe number -- directly answering the "careful multi-source verification, so a human can decide" requirement already in the seed's vision.
- **A structured-framework precedent worth mirroring for rigor:** the STAGE-MED-AI paper (a stage-gated triage/assessment framework for evaluating medical AI) is cited in current sources specifically for enhancing transparency, traceability, and accountability in AI-assisted evaluation -- a template for how SEED-048's own per-technology structured output + score should document ITS reasoning (not just emit a number), matching this repo's existing contracts-on-disk discipline (Part 7/11).

Net effect on scope: no architecture change to the proposed batch/combine/stage-gate shape, but the scoring layer now has (a) academic grounding for prioritizing the low-attention/high-growth tail specifically, (b) a named 3-dimension scoring structure instead of a flat score, and (c) AHP as the concrete weighting method - closing the seed's most open question ("what does the score actually measure and how is it defensible").
