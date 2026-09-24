# Phase 359 Dogfood Fork-Label Proposals

These `prose_fork` labels are proposals only, authored locally over the
already-sanitized 357 dogfood entries. They carry `fork_label_origin: local`
and are flipped to `human` only at the plan-06 navigator checkpoint. This
file is never sent to Jev (Part 8, D-21); no raw transcript text or names
appear below, only a sanitized one-line gist per id.

| id | sanitized one-line gist | proposed prose_fork | proposed fork_labels | why |
|----|--------------------------|----------------------|------------------------|-----|
| dogfood-0208790f-091452 | harness-preceded false block: subagent hand-back read as typed, echoes fresh F.8 candidate name | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-092655 | two consecutive peer hand-back status notes, harness-preceded, no genuine human engagement | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0f86dd63-065920 | task-notification record misread as typed, echoes fresh F.8 candidate name | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0f86dd63-070027 | two consecutive task-notification records, same misread-as-typed mechanism | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0f86dd63-093356 | terse task-notification record echoes a fresh F.1 reach gate pending-item name | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-21829408-092938 | two isMeta records with real body text, pre-fix source classifier reads them as typed | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-21829408-093038 | peer hand-back echoes fresh F.1/F.8 candidate name, low-signal-fresh default | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-21829408-093053 | consecutive peer hand-backs echo freshest F.8 candidate name; card never fired | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0f86dd63-092046 | R-C known_false_block: single coincidental content-token overlap on a human continuity turn | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-060830 | preceding record is a pure tool_result; synthetic-no-user-engagement guard exits before relevance | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-063354 | preceding record is a pure tool_result; gate stale by Stop time, guard exits before relevance | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-064501 | preceding record is a pure tool_result; both mints predate the guard check | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-065048 | preceding record is a pure tool_result; guard exits before relevance regardless of freshness | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-065507 | latest preceding record is a pure tool_result even though an earlier hand-back appears further back | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-065759 | preceding record is a pure tool_result; guard exits before relevance runs | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-083847 | latest preceding record is a pure tool_result; guard exits before relevance runs | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-084111 | preceding record is a pure tool_result; guard exits before relevance runs | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-084140 | a Skill-body meta record appears earlier, but the LATEST preceding record is a pure tool_result | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-084127 | peer hand-back with real text precedes a fresh F.8 gate but shares zero non-boilerplate tokens | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-060555 | no gate was reached this turn; ordinary short human turn with nothing to force | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-062150 | no gate was reached this turn; ordinary tool-result-preceded turn with no forced card | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-062345 | no gate was reached this turn; ordinary tool-result-preceded turn with no forced card | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-065535 | no gate was reached this turn despite a task-notification preceding it | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |
| dogfood-0208790f-091355 | no gate was reached this turn; ordinary tool-result-preceded turn | false | (none) | exercises the sidechannel/backstop gate-reach classification mechanism, not a Larry-posed prose fork |

## Summary

All 24 dogfood entries are proposed `prose_fork: false`. Every entry in
`tests/fixtures/card-fire-replay/dogfood.json` tests the Stop-hook’s
SIDECHANNEL/BACKSTOP gate-reach classification (harness-preceded false
blocks, task-notification misreads, tool_result guard exits, staleness, and
one navigator-ruled R-C known_false_block); none of the 24 final assistant
turns poses a genuine two-or-more-way decision in flowing prose with no
card. The navigator may overrule any single id at the plan-06 checkpoint.
