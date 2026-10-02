---
phase: 366-eureka-perspective-in-research-planner-mcp-canvas-tooling
plan: 19
status: complete
subsystem: spike-run
tags: [spike, recall, judge, jev, claude-arm, blind-label, navigator-checkpoint]
requires:
  - 366-18 (spike harness, bar.json, claude-judge-prompt.md)
provides:
  - tests/fixtures/366-spike/manifest.json (substrate build record, temp paths relativized)
  - tests/fixtures/366-spike/candidates/ (per arm candidates.jsonl, recall.json, pairs.json)
  - tests/fixtures/366-spike/items/ (blind-label input, one file per recall arm with pairs)
  - tests/fixtures/366-spike/verdicts/<arm>/ (stage-a, jev, claude, claude-then-jev, repeats 1..3, plus the raw claude-r<n>.jsonl)
  - tests/fixtures/366-spike/gold/{eureka-graph-lexical,hsi-graph}.json (navigator blind gold, 7 items each)
  - tests/fixtures/366-spike/labels/{eureka-graph-lexical,hsi-graph}.labels.json (byte copies of the gold)
affects: [366-20 (the record and the ruling)]
metrics:
  tasks_done: 2
  tasks_total: 2
  completed: 2026-10-02
---

# Phase 366 Plan 19: Run the spike arms and get the navigator's blind gold Summary

All four recall arms and all four judge arms ran over the same candidates on indexed copies of the three 355 fixture rooms, and the navigator labeled the two small arms blind (14 items, 7 per arm); the vector arm is UNMEASURED by navigator ruling. No arm is adopted here; the record and the rulings are plan 366-20.

## Commits

| Commit | Message |
|--------|---------|
| 21688ac1f | test(366-19): commit spike substrate manifest, candidates, items and judge verdicts |
| fac5ce077 | docs(366-19): partial summary (Task 1 done, Task 2 awaits navigator labels) |
| 1277ecdc9 | test(366-19): commit the navigator's blind gold for the two labeled recall arms |

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

**5. [Navigator ruling] The vector arm was not labeled.** The plan asks for labels for every items file; the navigator ruled "Label the 14 small, rule on vector", so `eureka-graph-lexical-vector` (96 items) has no gold and the plan's Task 2 verify one-liner fails on that file by design. The record lists it under `awaiting_gold` and reports no rate for it.

**6. [Plan vs. tool] labels/ mirrored by copy, not import.** See Task 2.

## Task 2 results (navigator labels)

**Ruling, verbatim (navigator, 2026-10-02):** "Label the 14 small, rule on vector".

**How the sitting ran.** One blind sitting in this session: the 14 items of `eureka-graph-lexical` (7) and `hsi-graph` (7) were shown through `scripts/label-355-gold.cjs` (set `pairings-unstamped`) as one seeded shuffle that mixed both arms, with no arm and no producer shown. The labels were written by the labeler's own `emit` to `tests/fixtures/366-spike/gold/<arm>.json` (labeler `navigator`, `fixture_sha256` equal to each committed items file). `labels/<arm>.labels.json` are byte copies of the gold (the plan's verify path; the record reads `gold/`). `import` was not used: it refuses the `navigator` labeler by design (it is the external-model path).

**Coverage check** (one-line node script over every items file):

| Items file | Items | Labels | Missing | Duplicate | sha matches | Gold useful |
|---|---|---|---|---|---|---|
| eureka-graph-lexical | 7 | 7 | 0 | 0 | yes | 3 |
| hsi-graph | 7 | 7 | 0 | 0 | yes | 4 |
| eureka-graph-lexical-vector | 96 | none | n/a | n/a | n/a | UNMEASURED by ruling |

rs-graph has no items file (0 pairs), so nothing to label.

**Same seven pairs in both files.** The two arms surfaced the identical seven pair_ids (different direction phrase only: lexical shows "no wording signal measured", HSI shows a wording phrase). The navigator therefore labeled each pair twice, blind. Usefulness agreed on 6 of 7 (pair `f06bd895b05b`: not useful in the lexical sitting, useful in the HSI one). direction_ok and already_known are not comparable across the two because only the HSI items carried a direction phrase.

**The vector arm.** No gold exists for its 96 items and none is fabricated. Its recall and judge outputs stay committed (Task 1); its rate is recorded as UNMEASURED and the vector lane stays OFF.

## Known Stubs

None.

## Threat Flags

None new. Fixture copies only, no key printed, `tests/fixtures/355-rooms` untouched, T-366-80 to T-366-83 held.

## Self-Check: PASSED

Files: gold/ and labels/ for eureka-graph-lexical and hsi-graph present. Commits 21688ac1f, fac5ce077, 1277ecdc9 are ancestors of HEAD. `git status --porcelain tests/fixtures/355-rooms` empty.
