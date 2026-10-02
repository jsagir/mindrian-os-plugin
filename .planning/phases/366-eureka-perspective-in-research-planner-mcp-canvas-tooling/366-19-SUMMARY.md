---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 19
status: partial
subsystem: spike-run
tags: [spike, recall, judge, jev, claude-arm, blind-label, navigator-checkpoint]
requires:
  - 366-18 (spike harness, bar.json, claude-judge-prompt.md)
provides:
  - tests/fixtures/366-spike/manifest.json (substrate build record, temp paths relativized)
  - tests/fixtures/366-spike/candidates/ (per arm candidates.jsonl, recall.json, pairs.json)
  - tests/fixtures/366-spike/items/ (blind-label input, one file per recall arm with pairs)
  - tests/fixtures/366-spike/verdicts/<arm>/ (stage-a, jev, claude, claude-then-jev, repeats 1..3, plus the raw claude-r<n>.jsonl)
affects: [366-20 (the record and the ruling)]
metrics:
  tasks_done: 1
  tasks_total: 2
  completed: pending Task 2 (navigator labels)
---

# Phase 366 Plan 19: Run the spike arms and get the navigator's blind gold (PARTIAL)

Task 1 is done: the substrate was built, all four recall arms and all four judge arms ran over the same candidates, and the inputs are committed. Task 2 (the navigator labels each items file blind) is pending. No arm is adopted; nothing here is a measurement until gold exists.

## Commits

| Commit | Message |
|--------|---------|
| 21688ac1f | test(366-19): commit spike substrate manifest, candidates, items and judge verdicts |

## Task 1 results

Substrate (all three rooms, from the manifest): tiers that ran `tier1_rules` and `tier2a_local_embedding` (local model present, classifier source embedding), tier 2b never ran, 0 blocked network attempts. DESCRIBES edges 0 in the copies (the shared-entity lane is near empty, as 366-18 predicted).

| Recall arm | Pairs shown (items) | Stage A passed | Jev passed r1/r2/r3 | Claude useful r1/r2/r3 | Claude-then-Jev passed r1/r2/r3 |
|---|---|---|---|---|---|
| eureka-graph-lexical | 7 | 7 | 0/1/0 | 1/1/1 | 0/0/0 |
| eureka-graph-lexical-vector | 96 | 7 | 1/0/0 | 16/9/15 | 0/0/0 |
| rs-graph | 0 | 0 | 0/0/0 | 0/0/0 | 0/0/0 |
| hsi-graph | 7 | 7 | 1/0/0 | 1/1/1 | 0/0/0 |

These are judge passes, not usefulness rates. Rates come from the navigator's gold at plan 366-20.

The vector arm did not hit ENV GAP: the local model was cached, nothing was downloaded. rs-graph shows 0 pairs on the fixtures (no INFORMS-style flow edges, no declared feeds), so it has no items file and nothing to label.

### Cost per arm

Recall (one run each, `/usr/bin/time -v`):

| Arm | Wall | CPU (user + system) | Peak RSS |
|---|---|---|---|
| eureka-graph-lexical | 0.16 s | 0.18 s | 73,976 KB |
| eureka-graph-lexical-vector | 0.64 s | 1.86 s | 268,560 KB |
| rs-graph | 0.16 s | 0.18 s | 74,736 KB |
| hsi-graph | 0.16 s | 0.19 s | 74,588 KB |

Judge arms, summed over repeats, per recall arm (wall ms, CPU ms, max RSS KB, Jev calls, Jev input tokens; dollars are not reported by Jev):

| Recall arm | stage-a (1 run) | jev (3) | claude (3, host subagent, not metered here) | claude-then-jev (3) |
|---|---|---|---|---|
| eureka-graph-lexical | 4 ms, 4 cpu, 72,376 | 8,593 ms, 34 cpu, 72,604, 21 calls, 13,317 tok | 0 ms | 1,647 ms, 15 cpu, 71,568, 3 calls, 1,896 tok |
| eureka-graph-lexical-vector | 4 ms, 5 cpu, 72,100 | 8,855 ms, 36 cpu, 72,388, 21 calls, 13,317 tok | 0 ms | 1,663 ms, 24 cpu, 71,800, 2 calls, 1,264 tok |
| rs-graph | 3 ms, 4 cpu | 0 | 0 | 0 |
| hsi-graph | 4 ms, 4 cpu, 73,912 | 8,748 ms, 35 cpu, 72,188, 21 calls, 13,317 tok | 0 ms | 1,598 ms, 12 cpu, 72,084, 3 calls, 1,896 tok |

The Claude arm's own cost is the host subagent's and is not in these numbers (the harness only times the verdict import).

### Committed layout

`tests/fixtures/366-spike/manifest.json`, `candidates/<arm>.{candidates.jsonl,recall.json,pairs.json}` (titles stripped from candidate rows), `items/<arm>.items.json` (only for arms with pairs), `verdicts/<arm>/{stage-a-r1,jev-r1..3,claude-r1..3,claude-then-jev-r1..3}.json` plus the raw `claude-r<n>.jsonl`. `git status --porcelain tests/fixtures/355-rooms` prints nothing.

## Deviations from Plan

**1. [Rule 1 - Observation] The two eureka arms share one recall tag.** Both ran with `--tag 20261001T120000Z` (the exact command block in 366-18), so the vector arm's run overwrote the lexical arm's candidates in each room's tag folder. Effects: (a) the lexical arm's items were built straight after its own recall, so they are correct; (b) the judge runs for the lexical arm filter the shared candidates file down to the lexical arm's pairs (via pairs.json), and the counts match (7 candidates); (c) the committed `candidates/eureka-graph-lexical.candidates.jsonl` is that filtered view, so its `lanes` and `vector` fields may carry the vector run's lane tags for pairs both arms found. The pair set and the items are unaffected. Recommend a distinct tag per arm in any re-run (366-24).

**2. [Observation] claude-then-jev is gated by Stage A.** Jev runs only on the Claude-useful subset that also passes the Stage A gate (7 of 96 on the vector arm), so claude-then-jev passed 0 everywhere and made 2 or 3 live calls per repeat. That is the harness definition from 366-18, not a fault; 366-20 should read it that way.

**3. [Plan vs. tool mismatch] The labeler refuses `~/.mindrian/spike-366-labels`.** `scripts/label-355-gold.cjs` only accepts a `--session-dir` under the phase dir or `os.tmpdir()` and an `--out` under `tests/fixtures` or `os.tmpdir()`. Session dirs therefore go under `/tmp/spike-366-labels/<arm>/` (outside the repo). The plan's `labels/<arm>.labels.json` and 366-18's `gold/<arm>.json` also differ; the record reads `gold/<arm>.json`, so emit writes there and any `labels/` copy is a plan 20 call.

**4. [Empty arm] rs-graph has no items file** (0 pairs), so the plan's "1 to 96 items" check applies to the three other arms only; empty Claude verdict files were accepted by the harness.

## Task 2: pending (navigator labels)

See the checkpoint returned with this summary for the per-arm commands.

## Known Stubs

None.

## Threat Flags

None new. Fixture copies only, no key printed, `tests/fixtures/355-rooms` untouched, T-366-80 to T-366-83 held.
