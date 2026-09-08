# financial-model - the numbers and what breaks them

**Statement:** This section holds the numbers, the assumptions under them, and what breaks them.

One job: hold the numbers, the assumptions under them, and what breaks them.

## Inputs
- Working (this room): `business-model/`'s revenue model; `market-analysis/`'s sizing.
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

Do NOT load: the funding pipeline. That is `funding/`, a separate section as of Phase 275: this model says what the venture needs, the pipeline tracks where the money is coming from.

## Process
1. Build the projection.
2. Surface every assumption it rests on.
3. Name the assumption that breaks it first.

## Outputs
- One folder per artifact at `financial-model/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- Change the single most load-bearing assumption by half and see whether the conclusion survives. If the model has no such assumption identified, it is not finished.

## Commands that write here
- Ground truth (the command's own `produces` path names this section): none direct today. This section relies on the wildcard `/mos:build-thesis`, which produces to `room/**/thesis/*`, plus the grading commands. Also a named structural gap.
- Framework-matched (a wildcard command whose framework fits this section's job): `/mos:build-thesis`, `/mos:grade`, `/mos:deep-grade` (the PWS Triple Validation Compass, specifically its "Is It Worth It" gate)
