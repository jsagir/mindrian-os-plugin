---
kind: plan
phase: 176
slug: scenario-analysis-canon-wiring
canon_parts: [2, 3, 4, 7, 8, 9, 11]
waves: 3
---

# Phase 176 PLAN: Scenario Analysis Canon Wiring

Executed in an isolated git worktree on `main` (branch `phase-176-scenario-analysis-wiring`) so the
concurrent phase-175 checkout was never touched.

## Wave 1 - chains + regenerate (gated)  [SCN-01, SCN-02, SCN-07]
1. Inject 3 curated_chains edges into data/command-registry.json (bare framework names):
   - Domain Selection -> Scenario Planning (0.68, domain-to-scenario)
   - PEST Analysis -> Scenario Planning (0.60, steep-to-scenario)
   - Scenario Planning -> Futures Wheel (0.66, scenario-to-cascades)
2. Regenerate command-registry -> connector-registry -> orchestration-projection.
3. Gate: both --check green, gap=0. Verify recommender surfaces the in + out candidates.

## Wave 2 - methodology body  [SCN-03, SCN-04, SCN-05]
1. references/methodology/scenario-plan.md: name STEEP + Impact x Uncertainty scoring; add PARTS
   test; add prioritize + Opportunity-Bank bank to the synthesis phase; add Phase 7 Iterate.
2. commands/scenario-plan.md body: dual-name note (Scenario Analysis = Scenario Planning), the
   canonical arc framing, the explore-domains -> scenario next-move framing, and the bank step.

## Wave 3 - verify + scaffold  [SCN-08, SCN-09, SCN-10]
1. tests/test-176-scenario-chain.cjs: assert the 3 edges exist in curated_chains and that the
   recommender surfaces Domain Selection -> Scenario Planning and Scenario Planning -> Futures Wheel.
2. tests/run-all-176.sh: aggregate both --check tripwires + the chain test + the carried frozen-bank
   drift fences (6 reach_ids, 3 postures).
3. Commit on the phase branch. No push, no release (navigator reviews first).

## Deferred (own follow-ups)
- D-176-01: Scenario Planning -> Trending to the Absurd (re-point trending-to-absurd's framework).
- D-176-02: "Scenario Analysis" resolvable alias (needs an alias substrate).
