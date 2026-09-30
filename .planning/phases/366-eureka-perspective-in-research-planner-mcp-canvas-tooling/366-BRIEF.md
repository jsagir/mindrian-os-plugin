# Phase 366 brief: Eureka becomes a perspective of the research planner

Planted 2026-10-01 from SEED-103. This brief is the hand-off into discuss-phase; the
ROADMAP card is the governing text.

## Read first, in this order

1. `.planning/REVIEWS/2026-10-01-eureka-v2-design.md` (the design, ADRs E12-E16, the spike).
2. `.planning/REVIEWS/2026-10-01-eureka-architecture-review.md` (what is wrong today, verified line references, the ICM system-map addendum).
3. `.planning/seeds/SEED-103-retire-eureka-engine-keep-perspective-in-research-planner.md` (what already shipped on the branch, what is open).
4. `.planning/research/2026-10-01-eureka-rethink-perspective-and-mcp-canvas.md` (sources and citations).
5. Phase 355 `355-VERIFICATION.md` and `355-26-SUMMARY.md` (the measured baseline every arm is judged against).

## The branch

`seed-103-eureka-perspective`, worktree `~/gsd-workspaces/seed-103/MindrianOS-Plugin`.
Run `bash tests/run-all-seed103.sh` with node 22 (`~/.nvm/versions/node/v22.23.1/bin`).
Merging it is wave 1. Nothing in it removes the standalone runner; that waits for the spike.

## Rulings the navigator owns (unchanged from SEED-103)

1. Retire the standalone engine.
2. Runtime Jev under the planner's grant and audit ledger, or dev-time only.
3. The Haiku entity pre-step: a planner egress line, or a separate producer.
4. Label the spike rooms.

## Discuss-phase questions

- Which MOS-CANVAS perspectives get the same op shape in this phase (RS, HSI, whitespace), and which stay reference-only for now.
- Whether `canon_resolved` becomes a Phase 343 statement (counts only) or stays a per-run field.
- Whether the semantic-index split (ADR-E12) is a plan here or its own phase.
