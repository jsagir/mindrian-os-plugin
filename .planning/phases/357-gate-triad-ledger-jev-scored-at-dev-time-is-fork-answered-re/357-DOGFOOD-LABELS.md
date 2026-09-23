# Phase 357-06: Dogfood label review sheet (D-06)

The navigator ratifies every row below at the plan-08 checkpoint. A confirmed row
flips its `label_origin` from `local` to `human`. Dogfood text never goes to Jev
(D-06, D-11) -- every gist below is a sanitized paraphrase, never raw transcript text.

| id | gist | live outcome | pre-phase verdict | HEAD verdict | proposed | why |
|----|------|---------------|--------------------|--------------|----------|-----|
| dogfood-0208790f-091452 | Peer hand-back echoes a candidate name from a fresh F.8 room-bind gate. | block | block | pass | pass | Harness-preceded false block: the preceding record is a subagent hand-back (isMeta true, origin peer), pre-D-07 code reads its real text block as typed, and it echoes the same candidate name the fresh |
| dogfood-0208790f-092655 | Back-to-back peer status hand-backs echo a fresh reach and room-bind pair. | block | block | pass | pass | Two consecutive peer hand-back turns, both short status notes that echo the same candidate name as a fresh F.1/F.8 pair, force-blocked pre-D-07. Harness-preceded, no genuine human engagement. |
| dogfood-0f86dd63-065920 | Background task-notification echoes a candidate name from a fresh room-bind gate. | block | block | pass | pass | A task-notification record (not isMeta, origin task-notification) carries real text pre-D-07, is misread as typed, and echoes the same candidate name a fresh F.8 gate lists. |
| dogfood-0f86dd63-070027 | Consecutive background notifications echo a candidate name from a fresh room-bind gate. | block | block | pass | pass | Two consecutive task-notification records, same misread-as-typed mechanism, echo the same candidate name a still-fresh (under 120s) F.8 gate lists. |
| dogfood-0f86dd63-093356 | Short background notification echoes the name of a fresh reach gate. | block | block | pass | pass | A terse task-notification record echoes the same pending-item name a fresh F.1 reach gate names, force-blocking pre-D-07. |
| dogfood-21829408-092938 | Skill-body meta record echoes a fresh reach gate name. | block | block | pass | pass | Two isMeta records with real body text (a Skill-body-shaped synthetic record) precede the turn; pre-D-07 the source classifier reads the real text as typed, and it echoes the fresh F.1 gate name, forc |
| dogfood-21829408-093038 | Peer hand-back echoes a fresh reach and room-bind pair. | block | block | pass | pass | A peer hand-back echoes the same candidate name as a fresh F.1/F.8 pair, force-blocking on the low-signal-fresh default; an older, stale, unrelated F.1 mint from the same window is superseded by the f |
| dogfood-21829408-093053 | Consecutive peer hand-backs echo the name on a fresh room-bind gate. | block | block | pass | pass | Consecutive peer hand-backs echo the freshest F.8 gate's candidate name, force-blocking on that overlap; the card never fired. |
| dogfood-0f86dd63-092046 | Human turn asks about a prior thread; a fresh reach gate shares a chrome word and one content word with it. | block | block | block | block | R-C (RESEARCH Open Question 2, CONTEXT R-C): a genuine human turn overlaps the fresh F.1 reach subject on the chrome word "prior" AND on a content-shaped word ("governance"), so relevance holds even a |
| dogfood-0208790f-060830 | Tool-result-only preceding turn, no engagement to evaluate. | pass | pass | pass | pass | Preceding record is a pure tool_result (no human text field); the synthetic-no-user-engagement guard exits before relevance runs. |
| dogfood-0208790f-063354 | Tool-result-only preceding turn against a stale F.8 mint. | pass | pass | pass | pass | Preceding record is a pure tool_result; the gate is stale by the time of the Stop, and the synthetic guard exits before relevance in any case. |
| dogfood-0208790f-064501 | Tool-result-only preceding turn with a mixed F.1/F.8 mint history. | pass | pass | pass | pass | Preceding record is a pure tool_result; both mints predate the guard check, which exits before relevance runs. |
| dogfood-0208790f-065048 | Tool-result-only preceding turn with a stale-then-fresh mint pair. | pass | pass | pass | pass | Preceding record is a pure tool_result; the synthetic guard exits before relevance regardless of mint freshness. |
| dogfood-0208790f-065507 | A tool_result immediately precedes the turn despite an earlier peer note. | pass | pass | pass | pass | The LATEST preceding record before this turn is a pure tool_result even though an earlier peer hand-back appears further back; only the latest record feeds the guard, and it exits before relevance. |
| dogfood-0208790f-065759 | Tool-result-only preceding turn against a fresh F.8 mint. | pass | pass | pass | pass | Preceding record is a pure tool_result; the synthetic guard exits before relevance runs. |
| dogfood-0208790f-083847 | Tool-result-only preceding turn following an unrelated peer note. | pass | pass | pass | pass | The latest preceding record is a pure tool_result; the synthetic guard exits before relevance runs. |
| dogfood-0208790f-084111 | Tool-result-only preceding turn against a still-fresh F.8 mint. | pass | pass | pass | pass | Preceding record is a pure tool_result; the synthetic guard exits before relevance runs. |
| dogfood-0208790f-084140 | Tool-result-only preceding turn following a Skill-body meta record. | pass | pass | pass | pass | A Skill-body meta record appears earlier, but the LATEST preceding record is a pure tool_result, so the synthetic guard exits before relevance runs. |
| dogfood-0208790f-084127 | Substantial peer hand-back about an unrelated topic, zero overlap with the room-bind gate subject. | pass | pass | pass | pass | A peer hand-back with real, substantial text (2+ subject tokens) precedes a fresh F.8 gate, but shares zero non-boilerplate tokens with the gate's own subject (a different topic entirely), so relevanc |
| dogfood-0208790f-060555 | Ordinary short human turn, no gate reached. | pass | pass | pass | pass | No gate was reached this turn (no side-channel mint); an ordinary short human turn with nothing to force. |
| dogfood-0208790f-062150 | Ordinary tool-result turn, no gate reached. | pass | pass | pass | pass | No gate was reached this turn; ordinary tool-result-preceded turn with no forced card. |
| dogfood-0208790f-062345 | Ordinary tool-result turn, no gate reached. | pass | pass | pass | pass | No gate was reached this turn; ordinary tool-result-preceded turn with no forced card. |
| dogfood-0208790f-065535 | Background notification with no gate reached this turn. | pass | pass | pass | pass | No gate was reached this turn despite a task-notification preceding it; nothing to force. |
| dogfood-0208790f-091355 | Ordinary tool-result turn, no gate reached. | pass | pass | pass | pass | No gate was reached this turn; ordinary tool-result-preceded turn. |

## R-C case

The 09:20 human-typed block, session 0f86dd63 (RESEARCH Open Question 2, CONTEXT R-C).

- id: dogfood-0f86dd63-092046
- pre-phase verdict: block
- HEAD verdict: block
- why: R-C (RESEARCH Open Question 2, CONTEXT R-C): a genuine human turn overlaps the fresh F.1 reach subject on the chrome word "prior" AND on a content-shaped word ("governance"), so relevance holds even after the planned F.1 chrome-stripping fix (D-08a). Whether the human turn was actually ENGAGING with the pending reach, or the overlap is coincidental phrasing, cannot be settled from structure alone. Recommending fail-toward-card (block) pending navigator ratification, per the codebase's own conservative-on-uncertainty doctrine; if ratified pass, this becomes a known_false_block with a text-dependence reason and a follow-on phase.

Question: is this a genuine relevant fork (block), or a false block with no
deterministic rule to clear it (pass, recorded as known_false_block with a
text-dependence reason and a follow-on phase opened)?

## Jev disagreements (sources a, b, c)

Ruling options per row: `keep-hand` or `accept-jev <verdict>`. No entry text.

| id | source | hand | is_fork | already_answered | relevant | Jev verdict |
|----|--------|------|---------|-------------------|----------|-------------|
| 238:genuine-multiline-bracket-box:s2 | 238 | block | yes | no | no | pass |
| 238:genuine-multiline-bracket-box:s3 | 238 | block | yes | no | no | pass |
| 238:genuine-bulleted-bracket-box:s2 | 238 | block | uncertain | no | no | pass |
| 238:genuine-bulleted-bracket-box:s3 | 238 | block | uncertain | no | no | pass |
| 238:type-1-2-or-3-literal:s2 | 238 | block | yes | no | no | pass |
| 238:type-1-2-or-3-literal:s3 | 238 | block | yes | no | no | pass |
| 238:reconstructed-two-honest-paths-fork:s2 | 238 | block | yes | no | no | pass |
| 238:reconstructed-two-honest-paths-fork:s3 | 238 | block | yes | no | no | pass |
| debug-intern-w1-labeled-fork | debug | block | yes | no | no | pass |
| debug-intern-w1-prose-fork | debug | block | yes | no | no | pass |
| debug-reach-gate-stale-turn-input | debug | block | no | no | uncertain | pass |
| debug-carveout-skill-meta-after-human | debug | block | no | no | uncertain | pass |
| debug-carveout-image-meta-after-human | debug | block | no | no | no | pass |

Not counted as disagreements (Jev verdict itself uncertain, agreement `unlabeled`
in the report, listed here for the navigator's optional skim only, no ruling
required): `debug-block-surface-simple-binary` (is_fork uncertain, relevant yes,
verdict uncertain), `live-2026-09-23-02` (is_fork uncertain, relevant uncertain,
verdict uncertain).

## Replay on HEAD before ruling

`node scripts/replay-card-fire.cjs --surface both`

entries=60 false_blocks=0 missed_forks=0 known_misses=1 known_false_blocks=0 new_misses=0 excluded_partial=0 parity_mismatches=0 errors=0

Non-OK ids: debug-intern-w1-prose-fork (known_miss, unaffected by this plan)

## How to answer

Reply `approved`, or one line per correction: `<id>: block|pass <reason>`.
For the R-C case: `r-c: block` or `r-c: known_false_block <reason>`.

