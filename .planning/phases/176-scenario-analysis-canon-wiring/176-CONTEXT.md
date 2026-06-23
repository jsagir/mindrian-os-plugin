---
kind: context
phase: 176
slug: scenario-analysis-canon-wiring
milestone: v1.14.0
created: 2026-06-23
canon_parts: [2, 3, 4, 7, 8, 9, 11]
cirs_relationship:
  surfaces_added: []
  surfaces_modified: [scenario-plan]
  surfaces_removed: []
  spine_consumed:
    - data/command-registry.json#curated_chains
    - scripts/build-orchestration-projection.cjs
    - lib/workflow/local-chain-recommender.cjs
  gate_impact: "Extends curated_chains (R6 confidence layer) with 3 scenario edges; both coverage --check gates re-run and stay gap=0; no surface added or removed; adds tests/run-all-176.sh. No reach minted, no Brain wire."
  explanation: "Wires the PWS Scenario Analysis chain per canon. INBOUND: Domain Selection -> Scenario Planning (the F.1 next-step after /mos:explore-domains, R3/R6) plus a PEST/STEEP feeder. OUTBOUND: Scenario Planning -> Futures Wheel (R6 earned chain). Reconciles the scenario-plan command body and reference to the canonical STEEP / 2x2 / PARTS / Opportunity-Bank methodology. Uses the spine (curated_chains -> projection -> local-chain-recommender) to surface scenario-plan contextually; modifies only the scenario-plan surface; opens no Brain wire."
status: context-captured
severity: NORMAL
sequence: "Follows the v1.14.0-beta train. Sibling fix to the contextual-invocation work (172): fills a specific dark chain the canon requires."
---

# Phase 176 Context: Scenario Analysis Canon Wiring

<domain>
Scenario Analysis (the PWS canon name; the framework node is "Scenario Planning") is the
undefined-problem foresight tool: given high uncertainty, build a 2x2 of two independent critical
uncertainties, develop four plausible futures, and harvest the robust problems as banked
opportunities. Provenance: Pierre Wack / Royal Dutch Shell (1970s).

The wiring gap: scenario-plan was a chain SINK. Everything fed INTO Scenario Planning
(Adoption-Capacity, Reverse Salient, Futures Wheel, pipeline); nothing flowed in from domain
exploration and nothing flowed out. So after /mos:explore-domains surfaced an uncertain space, the
system never offered scenario analysis as the next move, and after a scenario reframe it had no
successor to hand off to. The canon (Notion: tool page + Chapter 2 + Chapter 3 + Bot Instructions +
Appendix 1; Brain: Session-2 Terms + problem-types) is explicit that domain definition and trend
analysis FEED IN, and that opportunities + Futures Wheel cascades FLOW OUT.
</domain>

<why_now>
Surfaced from a live teaching session where Larry coasted after a scenario reframe: the missing
chain meant no contextual next-step. Canon-grounded across five Notion sources and a Brain
cross-check. Scoped narrow (one surface modified) so it ships clean under the CIRS coverage gate.
</why_now>

## Canon sources

- Notion: Scenario Analysis tool page; Chapter 2 (6-step method + Shell origin); Chapter 3 (4 case
  studies: education, water infrastructure, Shell, Walmart); Bot Instructions (10-step + STEEP +
  quadrant deep-dives + idea generator); Appendix 1 (7-step framework + STEEP/PESTEL + 2x2 chart).
- Brain (brain_ask + brain_search): confirms Domain Definition -> Trend Analysis (STEEP) -> Critical
  Uncertainties -> 2x2 -> Cross-Scenario -> Bank of Opportunities; adds the PARTS test (Plausible,
  Actionable, Relevant, Transformative, Systematic), axis Independence Testing, and the upper-left
  Uncertainty/Risk quadrant as the trigger condition.

## Recon findings (load-bearing)

- curated_chains is HAND-MAINTAINED in data/command-registry.json and carried through regen
  (build-command-registry.cjs preserves it). Edits go there, then regenerate.
- local-chain-recommender confidence-join matches the curated from/to VERBATIM against the
  projection edge's SPLIT node name. So only BARE framework names join; "command:/mos:x" targets are
  dropped (the pre-existing command:/mos:pipeline edge is dead for the same reason). All scenario
  edges therefore use bare framework names.
- No framework-alias mechanism exists. "Scenario Analysis" cannot be registered as a clean alias of
  "Scenario Planning" without minting a phantom separate node. The dual name is documented in the
  command body instead; a real alias substrate is a deferred follow-up.
- The boldness successor (Scenario Planning -> Trending to the Absurd) is DEFERRED: the
  /mos:trending-to-absurd command operates framework "S-Curve Analysis" (not a "Trending to the
  Absurd" node), and that label is coupled across 6 surfaces (run-all-163, the 170/171 conformance
  test, the orchestrator test, the skill, methodology-ingest). Re-pointing it is its own phase.

## Deferrals (honest, not punts)

- D-176-01: Scenario Planning -> Trending to the Absurd (boldness chain). Blocked on
  trending-to-absurd's framework mislabel. Own phase.
- D-176-02: "Scenario Analysis" as a resolvable alias of "Scenario Planning". Blocked on the absence
  of an alias substrate in the framework-name registry.
