SMOKE: BLOCKED - preflight refuses: ~/.claude/agents/larry-extended.md now resolves to a real file (shadowed agent, Finding 10, Pitfall 9). No money was spent.

# Phase 359 Plan 10: Forward smoke run Summary

Plan 359-10 stopped at the Task 1 dry run. The preflight refused. Zero runs started. Zero USD spent.

## Navigator ruling (smoke)

The human typed this in the main session on 2026-10-28. The main session reads it as the plan option `approve-smoke`. Verbatim text:

> dont stop in 10 for mony yes. here it is ! YES !

The approval covers only the smoke: at most 2 runs, one per arm, at most USD 0.40 per run, at most USD 0.80 in total, model claude-sonnet-5 only. It does not cover plan 359-11 or the full batch. Status: PROVEN (text relayed by the main session in the task prompt).

## Task results

| Task | Result | Evidence |
|------|--------|----------|
| 1 Preflight and dry run | REFUSED by preflight, exit 2 | PROVEN: the command below printed the refusal |
| 2 Navigator approval | Recorded above, not used | No run started |
| 3 Run the smoke | NOT RUN | Blocked by Task 1 refusal |

Command: `node scripts/forward-fork-scenarios-359.cjs --r8-sha 656cd8a3410d7f396c25b612a98b49eff846b1f2 --arm both --smoke --dry-run`

Output (PROVEN): `preflight refused: shadowed agent: /home/jsagi/.claude/agents/larry-extended.md resolves to a real file (Finding 10, Pitfall 9)`. Exit code 2.

## Root cause

RESEARCH Finding 10 (2026-10 research) recorded that `~/.claude/agents/larry-extended.md` is a symlink to `~/.claude/plugins/mindrian-os/agents/larry-extended.md`, and that the target was DANGLING, so no shadow existed. The Finding also said: if the symlink is ever repaired, it silently replaces the R8-edited agent.

That has happened. PROVEN today:
- `~/.claude/plugins/mindrian-os/agents/larry-extended.md` exists (21994 bytes, mtime Oct 24 23:07).
- The symlink in `~/.claude/agents/` resolves to it, so `fs.statSync(...).isFile()` is true.
- The harness preflight (`scripts/forward-fork-scenarios-359.cjs`, function `preflight`) correctly refuses.

The preflight is the T-359-47 mitigation. It is working as designed. It was not weakened and it was not bypassed.

## Preconditions

| Check | Result |
|-------|--------|
| `head -1 359-01-SUMMARY.md` is `357 GATE: PASSED` | PROVEN |
| `head -1 359-09-SUMMARY.md` starts with `R8_SHA: ` | PROVEN (656cd8a3410d7f396c25b612a98b49eff846b1f2) |
| `git cat-file -e <R8_SHA>` | PROVEN, exit 0 |
| `git show --stat <R8_SHA>` lists only the six R8 paths | PROVEN: agents/larry-extended.md, data/harness-manifest.json, lib/mcp/runtime-instructions.cjs, scripts/session-start, skills/larry-personality/SKILL.md, tests/test-359-prose-budget.cjs |
| `claude --version` at or above 2.1.259 | PROVEN: 2.1.312 |
| `bash tests/run-all-359.sh` exits 0 | FAILED: PASS=25 FAIL=1 (the forward harness offline test) |

## Second finding: the offline harness test depends on the real home directory

The one failing leg is `tests/test-359-forward-harness.cjs`. It fails for the same root cause. 6 cases fail:
- 4 `preflight` cases (cap other than 0.40, claude older than 2.1.259, projected total exceeds cap, "passes when every check clears") call `preflight()` without `homeDirForCheck`. They read the real `~/.claude/agents/` and hit the shadow refusal first.
- The `--dry-run` case and the `--project` case spawn the script with the real home and hit the same refusal.

This is a test-isolation defect in the plan 359-05 test. It is not a defect in the preflight. The fix would pass a temporary `homeDirForCheck` (or `HOME`) in those 6 cases. It was NOT made here: the Task 1 action limits a fix to the script file, and the test hole is secondary to the real block. The test file is still listed in this plan's `files_modified`, so a gap-closure plan or the main session can fix it.

## Spend and runs

- Runs started: 0. Cost: USD 0.00. The streams directory `~/.cache/mindrian-dev/359-forward/` does not exist (PROVEN).
- A1 to A9 table: NOT VERIFIED (no run). All 9 stay as listed in RESEARCH Assumptions Log.
- Mode (probe or text): not decided.
- Cost projection from a measured run: not produced. The RESEARCH estimate stands. The plan 359-11 checkpoint still decides the batch and its USD 60 ceiling.

## Options for the owner (decision needed)

The fix needs an action on `~/.claude`, which this executor must not edit. Choose one:

1. Remove or rename the symlink `~/.claude/agents/larry-extended.md`. Then the preflight passes and the smoke can run. Side effect: the user-level agent name `larry-extended` stops resolving for sessions that rely on it (UNVERIFIED which sessions do). Recommended path if the user-level link is stale.
2. Keep the symlink and change the preflight to accept a symlink whose target is the same bytes as the arm tree agent file. Weaker guard. Needs a ruling because it changes the T-359-47 mitigation.
3. Run the harness with a clean `HOME` that has only the Claude login copied in. UNVERIFIED that auth works this way. Needs a design check (the plan keeps HOME unchanged by design).

## Deviations from Plan

None to code. No source file, fixture or test was changed. The plan stopped at its own documented refusal path ("If preflight refuses, STOP and report"). The plan says no checkpoint is raised for a refused preflight and the fix is a gap-closure plan.

## Deferred Issues

- Shadowed agent block (above). Owner: main session decision, then a gap-closure plan or a link removal.
- Offline harness test isolation (above).

## Known Stubs

None.

## Threat Flags

None.

## Self-Check

- SUMMARY file exists at the path above: PASSED (written by this step).
- `git ls-files | grep -c "359-forward"` is 0: checked at commit time.
- No change under lib, hooks, agents, skills, scripts/session-start, scripts/check-card-fire.cjs: PASSED (the only commit of this plan is this file).
