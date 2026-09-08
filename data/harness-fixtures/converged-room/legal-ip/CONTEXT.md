# legal-ip - structure, agreements, what is protected

**Statement:** This section holds the legal structure, the agreements, and what is actually protected.

One job: hold the legal structure, the agreements, and what is actually protected.

## Inputs
- Working (this room): `solution-design/`'s technical choices (what is patentable or trade-secret depends on them); `business-model/`'s revenue model (what needs contracting).
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

Do NOT load: market sizing or competitive positioning. Those live in `market-analysis/` and `competitive-analysis/`.

## Process
1. Name the entity.
2. Name the agreements.
3. Name the IP position and the regulatory surface, using the 2026-04-14 Notion primary source's own four nested sub-areas under Legal Docs as the working structure: Regulatory Compliance, Incorporation docs, Contracts and Agreements, Intellectual Property.

## Outputs
- One folder per artifact at `legal-ip/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- For each thing claimed as protected, name the mechanism and its expiry.

## Commands that write here
- Ground truth (the command's own `produces` path names this section): none today. No methodology command produces directly into this section. This is a real, named structural gap (SEED-084 `## ADDENDUM 2026-09-04e`), not an omission in this contract.
- Framework-matched (a wildcard command whose framework fits this section's job): `/mos:challenge-assumptions` (Red Teaming, whose risk-surfacing fits legal and IP exposure review)
