# strategy - the futures and the bottlenecks

**Statement:** This section holds where this venture could go and what is holding it back: the scenarios and the reverse salients.

One job: work the futures and the bottlenecks. Where could this venture go, and what is holding it back right now.

## Inputs
- Working (this room): `problem-definition/`'s ladder position (Scenario Planning addresses Un-Defined, Ill-Defined AND Wicked problems, so it is broadly applicable rather than narrow); `market-analysis/`'s trends; `solution-design/`'s current architecture (a reverse salient is usually a technical or organisational bottleneck inside it).
- Reference (every run): ../references/SECTION-SCHEMA.md
- Reference (when relevant): ../references/SUB-SCHEMAS.md

Do NOT load: the financial model. A scenario is a story about a plausible future, not a prediction with a number on it; do not turn scenarios into forecasts.

## Process
1. Find the reverse salient, the specific lagging component holding the whole system back (Thomas Hughes' bottleneck theory, the founding case).
2. Build scenarios around it (Royal Dutch Shell's 1960s Group Planning department, the founding case).
3. Name what each scenario would require you to decide differently.

State the grounding for the pairing directly: the book's own graph asserts `Reverse Salient Analysis FEEDS_INTO Scenario Planning` with confidence 0.65 and the transform label `bottleneck-to-scenario`. These are not two unrelated tools filed under a label of convenience; the pairing is a graph-asserted relationship, not an engineering shortcut.

Evidence-tier honesty, stated the way SEED-084 itself states it: `opportunity-bank` earned its place with a single verbatim book-canon hit defining one taxonomy rung; `strategy` is two strong, separately-chaptered frameworks that the book never groups under the name "Strategy." The organising label is a room-design choice; the two frameworks under it are canon. This is not inflated to canon it does not have, and it is not undersold either.

## Outputs
- One folder per artifact at `strategy/<artifact-slug>/<artifact-slug>.md` (the Obsidian-nested convention, Key Decision 16). The folder IS the artifact.
- Never inline content into `ROOM.md`. `ROOM.md` is ICM Layer 0 identity only: statement, purpose, stage relevance, default methodologies. Real content is ICM Layer 4 and lives in its own dated entry folder. Five of twelve sections in the audited `launchpad-02` room had already drifted this way; this line is why the contract exists.

## Human check
- Feynman: can a stranger restate this section's governing thought in one sentence, without jargon?
- Minto: does the apex claim sit on MECE-grouped, non-overlapping support?
- For each scenario, name the one thing that would have to be observed for you to believe it is the one actually happening. A scenario with no such signal is a story, not a planning tool.

## Commands that write here
- Ground truth (locked by D-06): `/mos:scenario-plan`, `/mos:find-bottlenecks`, `/mos:rs-experts`, `/mos:rs-explain`, `/mos:rs-fetch`, `/mos:rs-thesis`

Note: the dead slug `scenario-analysis` was cited by `market-analysis`, `business-model` AND `financial-model`; its live replacement `/mos:scenario-plan` now has a proper home here rather than three patched citations. The Reverse Salient family, previously framework-matched for `competitive-analysis` and `solution-design` and ground truth nowhere, is ground truth here.
