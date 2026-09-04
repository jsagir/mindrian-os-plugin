# problem-definition - the problem, not a solution

**Statement:** This section holds the problem this venture is actually trying to solve, stated so a stranger can restate it.

One job: hold the problem this venture is actually trying to solve, stated so a stranger can restate it.

## Inputs
- Working (this room): meeting notes and uploads in `meetings/`, and this room's own `STATE.md` venture stage.
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

Do NOT load: the solution. That is `solution-design/`'s job. Pulling solution content in here is the single most common way a problem write-up quietly turns into a solution pitch.

## Process
1. State the problem in one sentence, the way it would be said to a stranger with no context.
2. Place it on the PWS ladder: Un-Defined, Ill-Defined, or Well-Defined. Wicked is not a fourth, co-equal rung; it is a score-triggered escalation off any of the three, for a problem that resists decomposition.
3. Decompose the stated problem into its parts only after it is placed on the ladder. Do not decompose before placing it, and do not let the decomposition quietly restate the solution instead of the problem.

## Outputs
- One folder per artifact at `problem-definition/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- Does this read as a problem, or as a solution wearing a problem's clothes?

## Commands that write here
- Ground truth (the command's own `produces` path names this section): `/mos:beautiful-question`, `/mos:diagnose`, `/mos:explore-domains`
- Framework-matched (a wildcard command whose framework fits this section's job): `/mos:root-cause`, `/mos:causal`, `/mos:map-unknowns`, `/mos:build-knowledge`, `/mos:validate`, `/mos:research`

Note: `/mos:trending-to-absurd` used to be cited here and is NOT, as of Phase 275. It produces into `room/opportunity-bank/trending-to-absurd/*`; the misfiling was corrected in Phase 275 (D-05).
