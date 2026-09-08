# market-analysis - who has it, how many, doing what

**Statement:** This section holds who has this problem, how many of them there are, and what they do about it today.

One job: hold who has this problem, how many of them there are, and what they do about it today.

## Inputs
- Working (this room): `problem-definition/`'s stated problem.
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

Do NOT load: the funding pipeline, or marketing and sales strategy. Marketing and Sales is a real, deliberately deferred gap: the 2026-04-14 Notion primary source names a distinct "Marketing & Sales" section (Marketing Strategies, Sales Strategies & Pipelines) that Phase 275 chose NOT to build. Do not silently absorb that content into this section; if it shows up, name it as belonging to a section that does not exist yet, rather than filing it here.

## Process
1. Size the market: how many people or organizations actually have this problem.
2. Segment it: which of them are alike enough to sell to the same way.
3. Name the job being hired for: the outcome the segment is actually paying to get, not the feature they ask for.

## Outputs
- One folder per artifact at `market-analysis/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- Is there a real number here, sourced, or is an adjective standing in for one?

## Commands that write here
- Ground truth (the command's own `produces` path names this section): `/mos:analyze-needs` (produces `room/market-analysis/jtbd-analysis/*`, refiled here from `team-execution` in Phase 275 per D-05), `/mos:user-needs`
- Framework-matched (a wildcard command whose framework fits this section's job): `/mos:macro-trends`, `/mos:analyze-timing`, `/mos:diffusion`, `/mos:explore-trends`, `/mos:dominant-designs`, `/mos:mullins`

Note: `/mos:scenario-plan` used to be cited here under the dead slug `scenario-analysis` and now lives in `strategy` (D-05, D-06).
