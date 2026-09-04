# opportunity-bank - the opportunities found but not yet chosen

**Statement:** This section banks the opportunities found but not yet chosen, each with its Knight position and confidence.

One job: bank the opportunities found but not yet chosen, so none is lost and none is prematurely committed to.

## Inputs
- Working (this room): `problem-definition/`'s ladder position; `market-analysis/`'s segments; external grant discovery via `/mos:opportunities scan` against Grants.gov and Simpler Grants.
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

Do NOT load: the funding pipeline's own stage state. That is `funding/`'s job; this section holds candidates, not applications.

## Process
1. Bank each opportunity with its Knight position and confidence score. Do not collapse risk and uncertainty into a single undifferentiated "opportunity."
2. Keep the two source kinds distinguished: grant-sourced (via `/mos:opportunities scan`) and cascade-sourced (extracted automatically by any methodology command that triggers analyze-room).
3. Promote only when a candidate earns it, never on a timer.

Quoted verbatim from `commands/opportunities.md:60`: every opportunity carries a Knight position (risk vs uncertainty vs mixed) and a confidence score. Risk is a known problem with quantifiable odds. Uncertainty is an unknown problem requiring exploration. Mixed is a contradiction that could go either way. The full sub-schema (Knight position plus confidence score, and the two source kinds) lives in `../references/SUB-SCHEMAS.md`; this contract points at the schema rather than duplicating it.

**Feeds:** this section feeds `funding/`. `/mos:funding create <opportunity-slug>` promotes a banked opportunity into the funding pipeline at initial stage Discovered, and writes a `[[opportunity-bank/<source>]]` wikilink from the funding entry back to this one, creating a real graph edge back to the discovery. That wikilink is the existing cross-reference mechanism; no other syntax is invented here.

Ground this section's own standing, honestly and briefly: this is the only one of the three sections Phase 275 adds that has a verbatim book-canon hit. Theo's `growth` chapter names "build a bank of opportunities" as the defining action of the Ill-Defined rung of the PWS ladder.

## Outputs
- One folder per artifact at `opportunity-bank/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- For each banked opportunity, is the Knight position argued or just asserted. A confidence score with no reason behind it is a number, not a judgment.

## Commands that write here
- Ground truth (the command's own `produces` path names this section): `/mos:futures`, `/mos:score-innovation`, `/mos:trending-to-absurd`, `/mos:whitespace`
- Framework-matched (a wildcard command whose framework fits this section's job): `/mos:explore-futures`
- Utility surface (operates on the bank rather than producing methodology content into it): `/mos:opportunities`

Note: `/mos:trending-to-absurd` used to be cited under `problem-definition` and was refiled here in Phase 275 (D-05), because that is where it actually produces.
