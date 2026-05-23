# ROADMAP.md Phase 121.5 entry update (post-plan-phase 2026-05-16, amended 2026-05-23)

Apply this patch to `.planning/ROADMAP.md` at lines 1278-1282 (the Plans / Authority block for Phase 121.5).

**Current state (2026-05-23):** ALL 11 plans SHIPPED + verified. Plans 121.5-00 through 121.5-09 originally sealed `complete / 10/10` on 2026-05-16. Plan 121.5-10 (Sub-plan K Brain-suggestion content template lock + audit Bundle A) absorbed 2026-05-23 from `.planning/121.5-selector-coverage-audit.md` and SHIPPED same day (final HEAD `0fbb202d`, 7 commits, 14/14 GREEN). VERIFICATION.md RE-SEALED `complete / 11/11` 2026-05-23.

The 16 D-XX decisions from 2026-05-16 are LOCKED + SHIPPED; the original 5 ODDs from 2026-05-16 are RESOLVED. 5 additional Bundle A decisions (D-Bundle-A-01..D-Bundle-A-05) LOCKED + SHIPPED 2026-05-23 alongside Sub-plan K.

`bash tests/run-all-121.5.sh` at re-seal -> `Total: 14 / Passed: 14 / Failed: 0`.

## Replace the existing "**Plans:**" paragraph (line 1278) with:

**Plans:** 11/11 plans complete (RE-SEALED 2026-05-23). ~3-4 days for original 10 plans (closed 2026-05-16) + ~2.5 days for Sub-plan K Bundle A addition (closed 2026-05-23, ~2 hours actual execution).

Plans:
- [x] 121.5-00-PLAN.md -- Sub-plan A SessionStart Coordinator: precedence ladder + 2000-char budget + iterative compression + failed-contributor isolation (D-13..D-16) (wave 2) -- SHIPPED 2026-05-16
- [x] 121.5-01-PLAN.md -- Sub-plan B body_shape sweep + output-styles/destijl.md with force-for-plugin:true (wave 1) -- SHIPPED 2026-05-16
- [x] 121.5-02-PLAN.md -- Sub-plan C SKILL.md v2 reconciliation: F.0/F.6 added; dual palette referenced; ODD 4 RESOLVED (wave 1) -- SHIPPED 2026-05-16
- [x] 121.5-03-PLAN.md -- Sub-plan D Statusline two-row + references/visual/palette.json canonical + statusline-mos wrapper migration (D-01..D-04; ODD 3 RESOLVED) (wave 1) -- SHIPPED 2026-05-16
- [x] 121.5-04-PLAN.md -- Sub-plan E render-v2 disposition + Phase 102 VERIFICATION.md (ODD 5 RESOLVED -- agent-surface-only by design) (wave 3) -- SHIPPED 2026-05-16
- [x] 121.5-05-PLAN.md -- Sub-plan F version-of-record on first-touch (SEED-007 absorption) + stale-copy scanner via /mos:doctor class H (wave 1) -- SHIPPED 2026-05-16
- [x] 121.5-06-PLAN.md -- Sub-plan G truth-telling + housekeeping: delete 40-hook-expansion, fix Phase 88.7 ROADMAP, harden active-phase resolver (wave 1) -- SHIPPED 2026-05-16
- [x] 121.5-07-PLAN.md -- Sub-plan I Bulletproof ASCII /mos:help: terminal-capability.cjs probe + 11 groups (incl. new Export/Publish/Hub trio) + help_jtbd: sweep + 3 torture tests (D-05..D-08) (wave 2) -- SHIPPED 2026-05-16
- [x] 121.5-08-PLAN.md -- Sub-plan J Naming-drift sweep + lifecycle cleanup: 5 soft-alias stubs + /mos:mos state-aware router + F.1 selectors on onboard/diagnose + /mos:doctor class I (D-09..D-12) (wave 3) -- SHIPPED 2026-05-16
- [x] 121.5-10-PLAN.md -- Sub-plan K Brain-suggestion content template lock + selector audit Bundle A: [■ BRAIN] chip + score-right two-line rows + stat-strip footer locked across 5 consumers (/mos:suggest-next NONE->F.1, /mos:act --chain BESPOKE->F.0, tension-hook-agent, auto-explore-agent, reverse-salient-agent) + CI tripwire (tests/test-no-bespoke-brain-prompts.sh) + F-SELECTOR-CONSUMER-GUIDE.md Section 4 published. Source: .planning/121.5-selector-coverage-audit.md Section 5. (wave 3) -- SHIPPED 2026-05-23, final HEAD 0fbb202d
- [x] 121.5-09-PLAN.md -- Sub-plan H coherence smoke test + 121.5-VERIFICATION.md (the precondition citation for Canon Part 10 ratification at v1.13.0 FINAL RELEASE GATE) (wave 4) -- SHIPPED 2026-05-16 + RE-RAN 2026-05-23 (14/14 GREEN, was 11/11 originally; +3 new suites from Plan 10)

**Requirements:** COHERENCE-121.5-A-01..04 (Sub-plan A); COHERENCE-121.5-B-01..03 (B); COHERENCE-121.5-C-01..04 (C); COHERENCE-121.5-D-01..05 (D); COHERENCE-121.5-E-01..02 (E); COHERENCE-121.5-F-01..03 (F); COHERENCE-121.5-G-01..03 (G); COHERENCE-121.5-I-01..04 (I, NEW Sub-plan); COHERENCE-121.5-J-01..04 (J, NEW Sub-plan); COHERENCE-121.5-H-01..03 (H).

## Status of 16 LOCKED decisions (per CONTEXT.md 2026-05-16 discuss-phase):

D-01..D-04 (Statusline) LOCKED -> implemented in 121.5-03.
D-05..D-08 (Bulletproof help) LOCKED -> implemented in 121.5-07.
D-09..D-12 (Naming sweep) LOCKED -> implemented in 121.5-08.
D-13..D-16 (SessionStart Coordinator) LOCKED -> implemented in 121.5-00.

## Status of 5 ODDs:

ODD 1 (SessionStart precedence ladder): LOCKED via D-13 in discuss-phase.
ODD 2 (Combined token budget): LOCKED via D-14/15/16 in discuss-phase.
ODD 3 (Palette keep-or-rebrand): RESOLVED in plan-phase -- keep muted/earthy (121.5-03).
ODD 4 (🎯 + JTBD collision): RESOLVED in plan-phase -- document-as-explicit-exception (121.5-02).
ODD 5 (render-v2 disposition): RESOLVED in plan-phase -- agent-surface-only by design (121.5-04).

All 5 ODDs resolved; zero carry-forward.

## Wave structure (parallelism for /gsd:execute-phase):

- Wave 1 (5 parallel plans): 121.5-01 body_shape sweep + output-style; 121.5-02 SKILL.md v2; 121.5-03 statusline + palette.json; 121.5-05 version-of-record + stale-copy; 121.5-06 housekeeping
- Wave 2 (2 parallel plans, depend on Wave 1): 121.5-00 SessionStart Coordinator; 121.5-07 bulletproof help
- Wave 3 (2 parallel plans, depend on Wave 1/2): 121.5-04 render-v2 disposition (depends on 121.5-02 SKILL.md); 121.5-08 naming sweep (depends on 121.5-07 help groups)
- Wave 4 (1 plan, acceptance): 121.5-09 coherence smoke + VERIFICATION.md

## Authority update

**Authority**: `.planning/phases/121.5-terminal-coherence-capstone/121.5-CONTEXT.md` (frozen 2026-05-16 with 16 D-XX decisions captured + 10 sub-plans scoped + 13 acceptance criteria + Canon compliance section + still-open ODDs section). Related seed: `.planning/seeds/SEED-007-version-dynamic-first-touch-greeting.md` (absorbed as sub-plan F). Audit provenance: three UI/UX audits + parallel-research SessionStart-flood note (2026-05-10) + Cluster 5 audit (2026-05-15) + 4-day discuss-phase chain (2026-05-10..16).
