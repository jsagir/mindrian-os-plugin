# funding - the pipeline from discovery to outcome

**Statement:** This section tracks funding paths, dilutive and non-dilutive, from discovery through submission to outcome.

One job: track funding paths from discovery through submission to outcome, so no deadline is missed and no application is silently abandoned.

## Inputs
- Working (this room): `financial-model/`'s stated need (how much, by when).
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

**Reads from:** `opportunity-bank/`. Every entry here starts life as a banked opportunity promoted by `/mos:funding create`, and carries a `[[opportunity-bank/<source>]]` wikilink back to its discovery.

Do NOT load: the financial model's internals. This section tracks where money comes from, not what the venture does with it.

## Process
1. Promote: `/mos:funding create <opportunity-slug>` moves an opportunity from `opportunity-bank/` into this pipeline at initial stage Discovered.
2. Advance: move a funding entry to the next stage. Stage and outcome are two orthogonal dimensions, named separately because conflating them is the error the command's own Design Note exists to prevent:
   - **Stage** is lifecycle position, sequential and enforced: Discovered, then Researched, then Applying, then Submitted. No skipping. No going backward. Each transition is recorded in `transition_history`.
   - **Outcome** is the result, not a stage: `awarded`, `rejected`, `withdrawn`. `awarded` and `rejected` are only valid once an entry has reached Submitted; `withdrawn` is valid at any stage.
3. Record outcome once a result exists.

The full sub-schema lives in `../references/SUB-SCHEMAS.md`; this contract points at the schema rather than duplicating it.

**Scope: two funding types, one implemented.** The 2026-04-14 primary source nests exactly two types under Funding Options: **Dilutive Funding** (equity and venture capital; you give up ownership) and **Non-Dilutive** (grants and similar; you do not). This section's contract covers both. The command surface today implements only the non-dilutive half: `/mos:funding` and `/mos:opportunities scan` are 100 percent Grants.gov and Simpler-Grants sourced, with zero equity, VC, loan, crowdfunding or angel support (grep-confirmed). Dilutive tracking is a named, deliberate deferral from Phase 275, not an oversight and not a claim that dilutive funding does not matter. Until it is built, record dilutive conversations as ordinary dated entry folders in this section; they will not have a stage machine.

Honest command gap: ground truth is none today. No methodology command produces directly into this section. That absence is exactly what the icm-architect audit found at the room level (an empty `funding/` shell) and what the command sweep confirmed at the command level; the two are the same gap seen from two angles.

## Outputs
- One folder per artifact at `funding/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- For every entry not at Submitted, is there a next action with a date on it. An entry that has not moved in fourteen days is either dead or being avoided; say which.

## Commands that write here
- Ground truth: none today.
- Framework-matched (a wildcard command whose framework fits this section's job): `/mos:mullins`, `/mos:grade`, `/mos:deep-grade`
- Utility surface (operates on the pipeline rather than producing methodology content into it): `/mos:funding`
