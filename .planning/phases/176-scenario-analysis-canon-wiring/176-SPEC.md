---
kind: spec
phase: 176
slug: scenario-analysis-canon-wiring
canon_parts: [2, 3, 4, 7, 8, 9, 11]
---

# Phase 176 SPEC: Scenario Analysis Canon Wiring

Requirement IDs SCN-01..SCN-10. Each is WIRED (done) or DEFERRED (with reason).

| ID | Requirement | State |
|----|-------------|-------|
| SCN-01 | Inbound F.1 edge `Domain Selection -> Scenario Planning` (conf 0.68, transform `domain-to-scenario`) + STEEP feeder `PEST Analysis -> Scenario Planning` (0.60, `steep-to-scenario`), authored in data/command-registry.json curated_chains as BARE framework names. | DONE |
| SCN-02 | Outbound cascade edge `Scenario Planning -> Futures Wheel` (0.66, `scenario-to-cascades`), bare framework, resolves to /mos:futures. | DONE |
| SCN-02b | Outbound boldness edge `Scenario Planning -> Trending to the Absurd`. | DEFERRED (D-176-01: trending-to-absurd command operates "S-Curve Analysis"; re-point is its own phase). |
| SCN-03 | Opportunity-Bank hookup: command body banks the prioritized robust problems (ADD with HSI + domain tags); connector `filing: fileEvidenceWithReadback` already present. | DONE |
| SCN-04 | Command body reconciled to the canonical arc (Define Domain -> STEEP -> independent critical uncertainties -> 2x2 -> PARTS-tested narratives -> identify opportunities -> cross-scenario -> prioritize + bank -> robust strategies -> iterate) + dual-name note. | DONE |
| SCN-05 | references/methodology/scenario-plan.md reconciled: STEEP named + Impact x Uncertainty scoring (Phase 2); PARTS test (Phase 4); prioritize + Opportunity-Bank bank (Phase 5); Phase 7 Iterate. | DONE |
| SCN-06 | "Scenario Analysis" alias of "Scenario Planning". | DEFERRED (D-176-02: no alias substrate; dual-name documented in body). |
| SCN-07 | Regenerate command-registry -> connector-registry -> orchestration-projection in lockstep; both --check gates green; coverage gap=0 on both ledgers. | DONE |
| SCN-08 | cirs_relationship block (R12) present in phase artifacts; canon_parts contains 11 (auto-derived). | DONE |
| SCN-09 | tests/run-all-176.sh: both --check tripwires + test-176-scenario-chain.cjs (edges exist + recommender surfaces them) + carried 6-reach / 3-posture drift fences. | DONE |
| SCN-10 | No frozen-set move: no reach minted, no edge/node type minted, no Brain wire opened. Additive curated_chains only. | DONE |

## Non-goals
- Not re-pointing trending-to-absurd (SCN-02b deferred).
- Not building a framework-alias substrate (SCN-06 deferred).
- Not cutting a release (phase branch only, for review).
