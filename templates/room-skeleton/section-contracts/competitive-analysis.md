# competitive-analysis - who else, what survives copying

**Statement:** This section holds who else is solving this, and what would still be true if a competitor copied us.

One job: hold who else is solving this, and what would still be true if a competitor copied us.

## Inputs
- Working (this room): `solution-design/`'s claimed defensibility. This is the reciprocal half of the moat cross-link: `solution-design` records the claim that a technical choice enables a feature that is hard to copy; this section is where that claim gets tested against a real competitor.
- Working (this room): `market-analysis/`'s segments.
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

Do NOT load: the financial model or the legal structure. Competitive positioning is about the market, not the numbers or the paperwork behind it.

## Process
1. Enumerate real competitors.
2. Compare on the dimension the customer actually buys on, not the dimension easiest to compare.
3. Test the `solution-design` moat claim against them: does the claimed defensibility survive the strongest competitor named here?

## Outputs
- One folder per artifact at `competitive-analysis/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- Take the defensibility claim recorded in `solution-design` and ask whether it survives the strongest competitor named here. If it does not, the claim is a feature, not a moat, and `solution-design` needs updating.

## Commands that write here
- Ground truth (the command's own `produces` path names this section): `/mos:compare-ventures`
- Framework-matched (a wildcard command whose framework fits this section's job): `/mos:challenge-assumptions`

Note: the Reverse Salient family moved to `strategy` in Phase 275 (D-06).
