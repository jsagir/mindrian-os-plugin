---
phase: 357
slug: gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-23
---

# Phase 357 - Validation Strategy

> This is the per-phase validation contract for feedback sampling during execution. Its source is the
> 357-RESEARCH.md "Validation Architecture" section. The navigator's post-research rulings (357-CONTEXT
> `<post_research_rulings>`) take precedence where they differ.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node assert scripts + bash `run_if` aggregators (the repo convention) |
| **Config file** | none; `tests/run-all-357.sh` (Wave 0) |
| **Quick run command** | `node tests/test-357-replay.cjs` |
| **Full suite command** | `bash tests/run-all-357.sh && bash tests/run-all-238.sh` |
| **Estimated runtime** | ~5 seconds (quick), ~60 seconds (full) |

## Sampling Rate

- **After every task commit:** run `node tests/test-357-replay.cjs`
- **After every plan wave:** run `bash tests/run-all-357.sh`
- **Before `/gsd-verify-work`:** the full suite plus the GATE357-08 mutation check, plus a manual review of the
  disagreements in `357-JEV-LABEL-REPORT.md`
- **Max feedback latency:** 60 seconds
- **Known pre-existing reds, recorded and NOT fixed in 357 (R-J):**
  - run-all-179 E2E-1
  - run-all-209 209-03
  - run-all-238 238-03
  - 5 legs of test-card-fire-relevance-gate

## Requirement -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| GATE357-01 | >=45 entries, 4 sources, 4 fields, meta.sanitization_statement, live/dogfood in transcript mode | unit | `node tests/test-357-corpus-loader.cjs` | W0 |
| GATE357-02 | On the pre-phase code root the live entries are FALSE_BLOCK with exit !=0; on HEAD exit is 0; fetch is stubbed to throw | integration | `node tests/test-357-replay.cjs` (wraps `replay-card-fire.cjs --code-root`) | W0 |
| GATE357-03 | The labeler refuses dogfood and missing-statement entries before building a request; keyless run exits 0 as `unlabeled`; tripwire green | unit | `node tests/test-357-labeler-refusal.cjs && node tests/test-353-tripwires.cjs && ! grep -rn api.typesafe.ai lib/ hooks/` | W0 |
| GATE357-04 | Harness source (V3 carve-out): peer, task-notification and meta-after-tool_result give a synthetic pass; human+Skill-meta and human+image still block | unit | `node tests/test-357-harness-source.cjs && node tests/test-209-primary-sidechannel.cjs` | W0 |
| GATE357-05 | F.1 chrome strip: live #2 passes; the chrome list covers the renderer's static strings; 238 Half B still blocks | unit | `node tests/test-357-f1-chrome.cjs && node tests/test-238-card-fire-corpus.cjs` | W0 |
| GATE357-06 | CLI and MCP verdict class identical per entry (dedup excluded); `business.room_dir === null` | integration | `node scripts/replay-card-fire.cjs --surface both --baseline compare` | W0 |
| GATE357-07 | The two card spans shrink >=50% (<=1115 B), or the skip is recorded; gate-native-fire-w1, voice-mark-182, handoff-seam and 298 parity green; manifest regenerated | unit | `node tests/test-gate-native-fire-w1.cjs && node tests/test-larry-voice-mark-182.cjs && node tests/test-larry-handoff-seam.cjs && node scripts/build-harness-manifest.cjs --check` | yes |
| GATE357-08 | Reverting the fix fails the standing leg | integration | `node tests/test-357-replay.cjs --mutation` | W0 |
| GATE357-09 | Dogfood has >=20 entries, all `label_origin: human`, with sanitized verdict equal to raw verdict | manual + unit | `node tests/test-357-corpus-loader.cjs --dogfood-strict` | W0 |

## Wave 0 Requirements

- [x] `tests/run-all-357.sh`, `tests/test-357-corpus-loader.cjs`, `test-357-replay.cjs`, `test-357-labeler-refusal.cjs`, `test-357-harness-source.cjs`, `test-357-f1-chrome.cjs`
- [x] `tests/fixtures/card-fire-replay/` skeleton with `meta.sanitization_statement`
- [x] The pre-phase sha recorded (the commit before the first 357 code change) for `--code-root` and `--baseline write`

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dogfood labels ratified | GATE357-09 | D-06: the navigator is the label authority; Part 8 bars Jev | Review `357-DOGFOOD-LABELS.md` and flip confirmed rows to `human` |
| The 09:20 case labeled (R-C) | GATE357-09 / R4 | This is a judgment on real text | Label it at the same checkpoint; if it is a false block with no deterministic fix, mark it `known_false_block` |
| Jev disagreements ruled | GATE357-03 | Labels are never auto-applied | Rule on each row of `357-JEV-LABEL-REPORT.md` |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-23 (357-09 bar: MET)
