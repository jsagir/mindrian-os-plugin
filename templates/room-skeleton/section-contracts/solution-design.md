# solution-design - the solution and why

**Statement:** This section holds the solution and the technical choices behind it, and why each choice was made.

One job: hold the solution and the technical choices behind it, and why each choice was made.

## Inputs
- Working (this room): `problem-definition/`'s stated problem; `market-analysis/`'s named job.
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

Do NOT load: the financial model.

## Process
1. State the solution.
2. Name the technology stack.
3. Name the features each stack choice enables. The 2026-04-14 Notion primary source nests Technology Stack directly beside Feature Planning under Solution and Product; that adjacency is why both live in this one section rather than split across two.

## Outputs
- One folder per artifact at `solution-design/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- **Moat:** does this technical choice enable a feature that is hard to copy, or does it just solve the immediate problem? If the answer is "hard to copy," `competitive-analysis` is the section that tests whether the claimed defensibility actually holds against a real competitor: record the claim here, run the test there.

  The doctrine behind this question, quoted verbatim from this plugin's own `.claude/includes/moat.md`: "Prompts can be copied. The graph that knows WHEN to use WHICH prompt, in WHAT SEQUENCE, calibrated by REAL teaching data, is the moat." The same causal shape, a copyable surface plus an uncopyable underlying capability, applied one level down: to the venture this room holds, not to the plugin itself (Canon Part 6 dog-fooding).

  Name this honestly: it is a repeated Larry heuristic, not a book-canon framework. It shows up in Lean Canvas's Unfair Advantage box, in Build-Thesis's "defensible go / no-go" tagline, and in Larry's own investment-mode line, "That's a feature, not a moat. What happens when someone copies it?" Theo's book has no dedicated moat chapter. State that plainly; do not present this heuristic as canon it is not.

## Commands that write here
- Ground truth (the command's own `produces` path names this section): `/mos:bono` (produces `room/solution-design/*`)
- Framework-matched (a wildcard command whose framework fits this section's job): `/mos:find-analogies`, `/mos:find-connections`, `/mos:analyze-systems`, `/mos:systems-thinking`, `/mos:hat-briefing`

Note: the Reverse Salient family (`/mos:rs-experts`, `/mos:rs-explain`, `/mos:rs-fetch`) used to be framework-matched here and moved to `strategy` in Phase 275 (D-06), where it is ground truth instead.
