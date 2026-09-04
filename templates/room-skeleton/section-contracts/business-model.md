# business-model - how this venture makes money

**Statement:** This section holds how this venture makes money, and the value proposition that claim rests on.

One job: hold how this venture makes money, and the value proposition that claim rests on.

## Inputs
- Working (this room): `market-analysis/`'s segments; `solution-design/`'s solution.
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

Do NOT load: the legal structure or agreements. That is `legal-ip/`'s job; this section states the revenue logic, not the contracts that implement it.

## Process
1. Name the revenue model: how the venture actually gets paid.
2. Name the customer segments and the payer, who signs, which may not be the same person as the user. If they differ, name both.
3. Name the value proposition the whole claim rests on.

**D-02, stated explicitly:** Value Proposition is sub-structure inside this section, NOT a section of its own. Three independent sources agree: Theo's book has no standalone value-proposition chapter (the material sits inside `bmd`, business model design); the 2026-04-14 Notion primary source gives Value Proposition and Business Model the identical statement text ("How Do We make money") and the identical icon, immediately adjacent; and `/mos:validate-proposition` already produces into `room/business-model/value-proposition/*` in the live command registry. One reservation, stated for the same reason: "Value Proposition" is a loaded PWS term naming the third gate of Triple Validation (Is it Real? / Can We Win? / Is it Worth It?), a venture-level judgment, so it is not reused as a per-section field name anywhere.

## Outputs
- One folder per artifact at `business-model/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact. `value-proposition/` is one such sub-folder, not a separate section.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- Who signs the cheque, and is that the same person as the user? If not, both are named.

## Commands that write here
- Ground truth (the command's own `produces` path names this section): `/mos:lean-canvas`, `/mos:validate-proposition`
- Framework-matched (a wildcard command whose framework fits this section's job): `/mos:explore-futures`, `/mos:mullins`, `/mos:analyze-systems`
