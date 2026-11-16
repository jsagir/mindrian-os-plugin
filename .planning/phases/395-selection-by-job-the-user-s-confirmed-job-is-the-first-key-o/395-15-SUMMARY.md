---
phase: 395-selection-by-job
plan: 15
subsystem: command-headers
tags: [bridge-b, framework-registry, pws-sources-supreme]
requires: [395-10, 395-12]
provides: [2 PwS-backed frameworks on 2 command headers (Part 1)]
affects: [data/command-registry.json, data/brain-orchestration-projection.json, data/harness-manifest.json]
key-files:
  created: []
  modified: [commands/challenge-assumptions.md, skills/challenge-assumptions/SKILL.md, commands/macro-trends.md, skills/macro-trends/SKILL.md, data/command-registry.json, data/brain-orchestration-projection.json, data/harness-manifest.json, ui/mindrian-workspace-mod/assets/command-registry.json]
decisions:
  - "Part 1 applies only the 2 KEEP rows of section 13; the 7 HELD rows wait for the section 11 NEEDS_HUMAN answer; no test pin is relaxed."
metrics:
  completed: 2026-11-16
  part1_tasks: 1
  part1_files: 8
---

# Phase 395 Plan 15: Bridge B, new frameworks in the command headers - Summary

## Part 1 (executor, 2026-11-16)

One-liner: `/mos:challenge-assumptions` gets `Pre-mortem Analysis` (SRC-1, catalog) and `/mos:macro-trends` gets `Macro Trends/Macro Trending` (SRC-2), appended after the listed name; the 3 derived files and the asset copy are regenerated.

Base commit (P0): `281a89f48a4c3bf7eaeb283bffc0a1b8276f4618`. Part 1 commit: `574664de9`. HEAD did not change between P0 and the commit.

### Changes

| File | Change |
|---|---|
| `commands/challenge-assumptions.md`, `skills/challenge-assumptions/SKILL.md` | `frameworks: ["Red Teaming", "Pre-mortem Analysis"]` |
| `commands/macro-trends.md`, `skills/macro-trends/SKILL.md` | `frameworks: ["PEST Analysis", "Macro Trends/Macro Trending"]` |
| `data/command-registry.json` | R1, 113 commands |
| `data/brain-orchestration-projection.json` | R2 (389 nodes, 83 edges); `data/orchestration-command-ledger.json` rewritten with the same bytes |
| `data/harness-manifest.json` | R3 |
| `ui/mindrian-workspace-mod/assets/command-registry.json` | R4 byte copy |

Each Find text matched exactly 1 time (count checked by script before each write).

### Verification (all PROVEN)

* Scratch scripts: extracted from the plan text by script; each is byte-equal (`cmp`) to the planner copy. Scratch dir: `/tmp/claude-1000/-home-jsagi/ed9f3b90-f4bf-4117-b6b6-f138961b043c/scratchpad/p15exec`.
* P1 `work/395-selection-by-job`; P2 base-ok; P2b input-committed; P2c `5e4f6d98...c2a9675`; P2d inputs-unchanged; P2e source A `ecba5862...ff1078a`, source B `9b077395...d2e738e4` (both match); P3 empty; P4 to P7 rc=0; P8-equal.
* P9 baseline: `commands=113`; rc not 0: G17 (assets/framework-names.json drift, D6), T09, T10, T11, T13, T15, T16, T17. Bars: B1 13 of 33, B2 8 of 38, B3 24 of 33, B4 4 of 5. Same as the planner dry run at `7c0687de4`.
* P10: `W1 OK 2 names`, rc=0. The guard file was last changed by `93b785273` (386-33); 395-13 is not committed, so W1b (section 9.5) stays open.
* V0: exactly the 8 planned lines.
* V1: `V1 OK`.
* C1: `CMP OK`, rc=0. T08 rc 0 -> 1 on the HEAD leg only ("still declares /mos:eureka, unchanged", 1 line), as the plan expects. After the commit, T08 rc=0 with 0 FAIL lines.
* SOFT line (report only): G11 `check-framework-vocabulary-drift.cjs` counts registry and projection frameworks 30 -> 32 (the 2 new names).
* Pre-commit hooks at commit: registry, connector, projection, vocabulary, mirrors, harness-manifest OK; reward-rule linter 2 of 2 compliant; shape-declaration advisory WARN (55, pre-existing, not blocking).

### Environment

Every repository run used a fresh `mktemp -d` HOME under the scratch dir, `MINDRIAN_ROOMS_HOME=$T/rooms`, `TMPDIR=$T`, `MINDRIAN_BRAIN_URL=http://127.0.0.1:9` (plan rule 8, dead port, no network), `MINDRIAN_BRAIN_KEY` and `CLAUDE_CODE_SESSION_ID` unset, and `< /dev/null`.

### Deviations from Plan

* Plan rule 11 says "Do not commit". The main session told the executor to commit Part 1 with `git commit --only`. The executor committed after C1 passed, then ran T08 on the new HEAD (rc=0, as section 9.6 requires).
* The main session prompt said to unset `MINDRIAN_BRAIN_URL`. The executor used the plan rule 8 value `http://127.0.0.1:9` instead, so that no test can reach the default live Brain URL. The baseline and the after run used the same value.

### Not done in Part 1

* Section 11 NEEDS_HUMAN (relax 4 test pins for 7 HELD rows): pending with the owner. No pin was relaxed.
* W1b (section 9.5): run after 395-13 is committed.
* Part 2 (section 12): a separate executor.

## Self-Check: PASSED

* FOUND: commit `574664de9` on `work/395-selection-by-job`.
* FOUND: the 8 files of the commit (`git show --stat HEAD`).
