---
type: tester-rubric-template
phase: 115
created: 2026-05-05
synthesis_target: After all 5 tester replies received (48h window per D-13)
ship_threshold: 4-of-5 vivid recent memory (D-20 hard threshold)
rollback_trigger: < 4-of-5 -> activate fallback emotion #1 per tests/manual/115-rollback-procedure.md
---

# Phase 115 Tester Rubric -- 5x4 Synthesis Table

Fill this in after all 5 replies arrive. ROW per tester, COLUMN per question.

| Tester | Q1: Vivid recent memory? (Y/N) | Q2: How recent? (days/weeks/months) | Q3: Current solution adequate? | Q4: Free-text notes |
|--------|--------------------------------|--------------------------------------|--------------------------------|---------------------|
| Lawrence Aronhime |  |  |  |  |
| Justin Stitzlein |  |  |  |  |
| Aryeh Holtzberg |  |  |  |  |
| Adam Peters |  |  |  |  |
| Shmuel Schuman |  |  |  |  |

## Synthesis tally

- Q1 YES count: __ / 5  (target >= 4 for ship gate per D-20)
- Q1 NO count: __ / 5
- Q2 mean recency: __ days
- Q3 INADEQUATE count: __ / 5  (the testers in our market -- those whose current solution is "I ruminate" / "I push through")
- Q4 themes: __ (cluster free-text into 2-4 themes if signal is rich)

## Decision gate (D-20)

- [ ] Q1 YES count >= 4 AND mean recency Q2 <= 14 days -> SHIP. Apply Phase 115 surface rewrites per 115-01/02/03 plans. Trigger v1.13.0-beta.3 release per 115-04 plan.
- [ ] Q1 YES count < 4 OR mean recency > 30 days -> ROLLBACK. Execute `tests/manual/115-rollback-procedure.md` step-by-step. Pre-committed; no deliberation in failure window.

## Canon Part 5 evidence-tier note

Validation-week result is **Practitioner-tier evidence** (per Canon Part 5). Operational-tier promotion happens at 30-day re-audit per D-19; v1.13.0 final release gates on Operational. Phase 115 ship is acceptable on Practitioner-tier alone.

## Canon Part 8 reminder

This rubric file IS LOCAL. Synthesis content NEVER egresses to Brain. Phase 121 telemetry events emit only enum scalars (Y/N, int days, bool adequate). Free-text Q4 stays in this file and per-tester reply files at `docs/testers/{slug}/replies/`; never queried.
