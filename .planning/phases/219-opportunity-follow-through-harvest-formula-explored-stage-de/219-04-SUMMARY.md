---
phase: 219-opportunity-follow-through-harvest-formula-explored-stage-de
plan: 04
subsystem: qualification-gate
tags: [f1-card, seed-021, qualify-opportunity, born-wired, hitl-shape-f1, rejected-because, d-17-stage-history, d-18-components, d-20-llm-manual-baseline]

# Dependency graph
requires:
  - phase: 219-01
    provides: writeOpportunityNode / advanceOpportunityStage / linkOpportunityEvidence (lib/core/navigation/typed-opportunity.cjs) - the mint/confirm/history door this plan is the only caller of
  - phase: 219-03
    provides: the last-opportunity-harvest.json side-channel schema (candidate id, Q1..Q8 verdicts, D-18 component bag, HarvestIndex_v1) this card renders
  - phase: 143-01 / F.1 renderer
    provides: lib/hmi/shape-f1-renderer.cjs + selector-dispatcher appendAskUserQuestionTrailer (SEED-021 no-ASCII-box door)
provides:
  - "qualifyCandidate / skipCandidate (lib/core/eureka/qualify-opportunity.cjs): the ONLY path that mints+confirms (Qualify) or mints+rejects (Skip) an opportunity node; both idempotent on the same candidate anchor"
  - "formatRubricLines: compresses the Q1..Q8 verdict bag into <= 8 short WHY-lines"
  - "formatComponentLines: renders the D-18 component bag + HarvestIndex_v1 as card lines; typed unknown renders verbatim, never a fabricated 0; index line carries version + EXPERIMENTAL"
  - "D-20 terminal rung: [LLM manual scan (high effort)] verb, OFFERED only under MINDRIAN_FORCE_ENGINE_ABSENT=1 (or a real engine-unavailable signal), never default; manual results carry engine_mode: llm_manual_baseline end-to-end and are excluded from calibration"
  - "commands/qualify-opportunity.md: born-wired F.1 command surface, hitl_shape F.1 + hitl_why declared (Part 11 CIRS), connector-registry + orchestration-projection + skill mirror entries regenerated"
  - "REJECTED_BECAUSE rejection edge on Skip (rejection is data, Decision 13); out-of-enum skip reasons hard-fail with {ok:false}, writing nothing"
affects: [219-05 explore chain (consumes a qualified/explored candidate), 219-06 live ador acceptance, 219-07 release readiness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Qualify and Skip both mint the proposed anchor node idempotently first (stable identity for rejection-edge/dedup purposes); only Qualify calls advanceOpportunityStage to confirm + bank"
    - "D-20 LLM-manual offer is a gate verb, never a silent substitution - the corepower lesson encoded as a behavioral test (Test 4: qualifyCandidate never auto-fires the analysis chain)"
</tech-stack>

## What shipped

REQ-3's qualification gate: a real F.1 AskUserQuestion card (never an ASCII-box fallback, SEED-021) rendering a harvested candidate's Q1..Q8 rubric WHY-lines and D-18 component bag, with five verbs [Qualify+file] [Ask Brain] [Rephrase] [Suggest next] [Skip], plus the D-20 engine-breaks offer verb gated strictly behind an unavailable-engine signal. Qualify is the ONLY door that advances an opportunity node's D-17 stage_history from `candidate` to `qualified`/banked, with actor + reason + evidence_ids on every transition. Skip writes a REJECTED_BECAUSE edge with the failed-check enum reason (never deletes, never silently drops - Decision 13: rejection is data). The command surface (`commands/qualify-opportunity.md`) is born WIRED with a declared `hitl_shape: F.1`, and the connector registry, orchestration projection, and skill mirror were regenerated to include it.

## Task-by-task

1. **RED** (`0dad5f67`): failing REQ-3 suite - 12 assertion groups covering Qualify/Skip/idempotency/no-auto-fire/rendering/D-17/D-18/D-20/born-wired.
2. **GREEN** (`213edae3`): `lib/core/eureka/qualify-opportunity.cjs` verb handlers - qualifyCandidate, skipCandidate, formatRubricLines, formatComponentLines, the D-20 manual-scan branch, suggestNext/askBrain stubs (Part 8 generic-handle degrade).
3. **Born-wired surface** (`21f84ba8`): `commands/qualify-opportunity.md` authored (F.1 hitl_shape + hitl_why, connector block, firing block), registered in connector-registry + orchestration-projection.
4. **Registry regen + skill mirror** (`a36802fb`): stale command-registry from step 3 regenerated; skill mirror + orchestration projection finalized.

## Test results

`node tests/test-219-qualify.cjs`: **12/12 passed** - Qualify files via navigation.cjs (mint+confirm+D-17 advance+bank), idempotent re-qualify never duplicates the anchor, Skip produces a REJECTED_BECAUSE rejection edge (node stays proposed, bank stays empty), out-of-enum skip reason rejected with `{ok:false}` writing nothing, nothing lands in opportunity-bank/ without an explicit Qualify (render+skip+rephrase paths all checked), qualifyCandidate never auto-fires the analysis chain (behavioral + comment-filtered source scan), formatRubricLines compresses to <= 8 lines, formatComponentLines renders D-18 components with typed `unknown` verbatim (never 0) and the versioned EXPERIMENTAL index line, D-20 manual-scan offered only under the forced-absent env var with `engine_mode: llm_manual_baseline` propagated end-to-end, suggestNext/askBrain stubs degrade gracefully, the card fires as a real F.1 AskUserQuestion contract with the 5 verbs + WHY lines (no ASCII box), and the born-wired surface declares `hitl_shape: F.1` + `hitl_why`.

`node scripts/build-connector-registry.cjs --check`: **OK** (post-recovery re-verification, see Recovery Note below).

## Threat Flags

None beyond the plan's modeled threat model (T-219-13 auto-confirm, T-219-15 auto-fire) - both closed by Test 4 and the idempotent-mint-then-confirm-only-on-Qualify design.

## Commits

| Commit | Type | What |
| ------ | ---- | ---- |
| 0dad5f67 | test | RED: failing REQ-3 qualification gate suite |
| 213edae3 | feat | GREEN: qualification gate verb handlers |
| 21f84ba8 | feat | born-wired qualify-opportunity F.1 command surface + registries |
| a36802fb | chore | skill mirror + orchestration projection for qualify-opportunity |

## Recovery Note (post-hoc, this entry)

This SUMMARY was written and the plan closed out in a follow-up pass after the executing agent was terminated by an account-level API spend-limit error immediately following commit `a36802fb` (mid self-check, per its last progress message: "Pre-commit hook flagged stale command-registry... Fixing."). Re-verification performed before writing this SUMMARY: all three target files (`lib/core/eureka/qualify-opportunity.cjs`, `commands/qualify-opportunity.md`, `tests/test-219-qualify.cjs`) confirmed present and already committed through `a36802fb` (git status showed zero diff against HEAD for these paths - the agent's GREEN/registry commits had already landed); `node tests/test-219-qualify.cjs` reconfirmed 12/12 passing; `node scripts/build-connector-registry.cjs --check` reconfirmed OK, meaning the stale-registry issue the agent was mid-fix on was ALREADY resolved by commit `21f84ba8`/`a36802fb` before the kill - no code or registry repair was needed, only this trailing docs/SUMMARY step. No files were reverted, stashed, or discarded during recovery.

## Self-Check: PASSED

All 3 target files verified on disk and matching HEAD (already committed by the terminated agent); all 4 task commits (0dad5f67, 213edae3, 21f84ba8, a36802fb) verified in git log; 12/12 test assertions green on re-run; connector-registry --check OK on re-run.
