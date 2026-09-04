# team-execution - who works, who advises, what next

**Statement:** This section holds who does the work, who advises it, and what happens next.

One job: hold who does the work, who advises it, and what happens next.

## Inputs
- Working (this room): `meetings/` (the structural directory where conversations land); the room's `team/` directory.
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

Do NOT load: the market analysis.

## Process
1. Name who does the work: roles, not just names.
2. Name who advises it, using the Mentor-Profiles sub-structure below.
3. Name what happens next: the concrete execution step each person owns.

**D-12, stated explicitly:** Mentor-Profiles is real sub-structure of this section, not a gesture. A mentor profile carries who they are, what domain they cover (their role and their domain expertise), what question they are the right person to answer, their availability, and when they were last consulted, cross-linked back to the meeting or entry that consulted them. The full field list lives in `../references/SUB-SCHEMAS.md` (plan 275-07 writes it); this contract points at that schema instead of duplicating it.

Three spellings are live in this room, named here because a reader will otherwise conflate them: `team-execution/` is this ICM section, a scored destination for methodology content. `team/` is a structural directory (`STRUCTURAL_DIRS`), holding the people layer and, via `/mos:persona`, AI personas at `team/ai-personas/`. `meetings/` is the other structural directory, a source that feeds sections, not a destination. Phase 275 changed none of these; they are named here because the fourth-spelling confusion was found in passing during D-05's citation sweep.

## Outputs
- One folder per artifact at `team-execution/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- For each named person, is there one sentence saying what only they can answer?

## Commands that write here
- Ground truth (the command's own `produces` path names this section): `/mos:leadership`
- Framework-matched (a wildcard command whose framework fits this section's job): `/mos:hat-briefing`, `/mos:think-hats`

Note: `/mos:analyze-needs` used to be cited here and was refiled to `market-analysis` in Phase 275 (D-05), because that is where it actually produces.
