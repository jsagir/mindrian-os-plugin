---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 12
subsystem: testing
tags: [perf, ab-verdict, pin-tree, tree-b, interleaved, tooling]
requires:
  - phase: 384-09
    provides: ranking, owner floor of 50 ms (decision 2)
  - phase: 384-11
    provides: q7-write-bench.cjs
provides:
  - ab-verdict.cjs (compare and outcome) with its check file
  - pin-tree.cjs (export, apply-commit) with its check file
  - mcp-probe.cjs block --tree-b, process-census.cjs walls-subagent --tree-b, q7-write-bench.cjs q7 --mode time --tree-b
affects: [384-13, 384-14, 384-15, 384-16, 384-17, 384-18, 384-19, 384-20]
key-files:
  created:
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/ab-verdict.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/test-ab-verdict.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/pin-tree.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/test-pin-tree.cjs
  modified:
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/mcp-probe.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/test-mcp-probe.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/process-census.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/test-process-census.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/q7-write-bench.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/test-q7-write-bench.cjs
key-decisions:
  - "The verdict rule and the p95 rule are fixed in the RED test commit f5809b9ee and in the header of ab-verdict.cjs, before any reading exists."
  - "Tree B of each bench gets its own harness context (H.makeCtx) on the same prepared room, so CLAUDE_PLUGIN_ROOT and the hook list come from tree B."
requirements-completed: [PERF384-F01]
completed: 2026-11-06
---

# Phase 384 Plan 12: Shared A/B tooling for the speed fixes Summary

Wave 2 plans can now export a before tree and an after tree from fixed commits, run both interleaved with one command, turn four result files into one verdict word, and check that git history agrees with the word. No product file changed. This plan took no speed measurement; all timed runs were check runs of the tools on synthetic trees and the live checkout.

## Commits (test first, then code, for each task)

| Sha | Subject |
|-----|---------|
| f5809b9ee | test(384-12): failing checks for the verdict tool and the pinned-tree exporter |
| c30bf6ff4 | feat(384-12): verdict tool and pinned-tree exporter for the Wave 2 before and after runs |
| a75bb2e24 | test(384-12): failing checks for block --tree-b |
| b57acdfcc | feat(384-12): block --tree-b interleaves two plugin trees with a per-pair difference |
| 6a57f5d85 | test(384-12): failing checks for walls-subagent --tree-b |
| 7d290485e | feat(384-12): walls-subagent --tree-b interleaves two plugin trees |
| 519665730 | test(384-12): failing checks for q7 --tree-b |
| 7d4f8dc04 | feat(384-12): q7 --tree-b interleaves two plugin trees for the Write event |

## RED and GREEN checks

| Task | RED (recorded) | GREEN | Checks that moved |
|------|----------------|-------|-------------------|
| 1 | ab-verdict 39 FAILED, pin-tree 3 FAILED (modules missing) | ab-verdict ALL PASS, pin-tree ALL PASS | AV1 to AV6 (five words, two boundaries, noise 0, six refusals, p95 rule, outcome against git), P1, P2 |
| 2 | mcp-probe 6 FAILED, load1 0.90 | mcp-probe ALL PASS, load1 0.75 | BA1 (x2), BA2 (x2), BA3 (x2); M1 to M10 still pass |
| 3 | process-census 6 FAILED (45 ok), load1 0.29 | ALL PASS (51 checks), load1 0.30 | WA1 (x2), WA2 (x3), WA3 (x3) |
| 4 | q7-write-bench 10 FAILED, load1 0.36 | ALL PASS, load1 1.35 | QA0 to QA4; B0 to B8 still pass |

Some checks that exit with code 2 also pass in RED (an unknown flag exits 2 as well). They gain meaning only together with the checks that failed.

## Commands for plans 384-13 to 384-20

Let `B=.planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench` and `L="$HOME/.cache/mos-perf-384.lock"`. Every timed command runs as `mkdir -p "$HOME/.cache" && flock -w 7200 "$L" <command>`; record load1 at the start of each run.

**pin-tree** (git only, no lock):

    node $B/pin-tree.cjs export --sha <BEFORE_SHA> --out /tmp/mos-384-scratch-NN/before
    node $B/pin-tree.cjs export --sha <FIX_SHA> --out /tmp/mos-384-scratch-NN/after
    node $B/pin-tree.cjs export --sha <BEFORE_SHA> --out /tmp/mos-384-scratch-NN/after --apply-commit <FIX_SHA>   # same result, patch on top

It prints `sha=<40 hex>` and `tree=<DIR>`; with `--apply-commit` also `applied=<40 hex>`. Exit 2: unknown ref or non-empty DIR. Exit 1: the patch does not apply (rejected file names printed, DIR kept). `node_modules` is linked from the repository. Pass the trees to the benches below. Add `--base-sha db2ea3b05bb70b55741bdeb40b545801b0c37cbe` where the bench takes it.

**Interleaved two-tree runs.** One run gives one result file with both trees. Take two such runs (set 1 and set 2) per fix.

    # MCP event-loop block (S8)
    flock -w 7200 "$L" node $B/mcp-probe.cjs block --tree <BEFORE> --tree-b <AFTER> --label before --label-b after --room fixture --runs 15 --set s1 --tool stop_gate_check --scratch <DIR> --out s1.json
    # SubagentStop census (S4); build the counter once: node $B/process-census.cjs build --scratch <DIR>
    flock -w 7200 "$L" node $B/process-census.cjs walls-subagent --tree <BEFORE> --tree-b <AFTER> --label before --label-b after --files 1,5,20 --runs 15 --room fixture --counter <DIR>/exec-counter.so --repeats 3 --scratch <DIR> --set s1 --out s1.json
    # PostToolUse Write (S2)
    flock -w 7200 "$L" node $B/q7-write-bench.cjs q7 --mode time --tree <BEFORE> --tree-b <AFTER> --label before --label-b after --runs 15 --set s1 --scratch <DIR> --out s1.json

(`start --tree-b` of plan 06 is unchanged: `mcp-probe.cjs start --tree A --tree-b B --server os`.)

Target ids (A = before, B = after):

| Bench | A id | B id | Derived id (A minus B per pair) |
|-------|------|------|-------------------------------|
| block | `mcp:block:stop_gate_check:cold:ping` (also `:warm:`, `:tool`, `mcp:block:idle-ping`) | `mcp:block-b:stop_gate_check:cold:ping` | `mcp:block:stop_gate_check:cold:ping:a-minus-b` |
| walls-subagent | `event:SubagentStop:files5` | `event:SubagentStop-b:files5` | none (use ab-verdict) |
| q7 | `q7:write:rooms:artifact`, `q7:write:rooms:artifact-changed`, `q7:write:rooms:identity`, `q7:write:default:artifact` | same with `q7b:` | `q7:write:default:artifact:a-minus-b` |

Each file holds a `compare` key with the two labels. Positive A minus B means the after tree is smaller.

**ab-verdict** (reads files, no lock):

    node $B/ab-verdict.cjs compare \
      --set1-a s1.json#<A_ID> --set1-b s1.json#<B_ID> \
      --set2-a s2.json#<A_ID> --set2-b s2.json#<B_ID> \
      [--metric wall_ms.median] [--p95-metric wall_ms.p95|none] [--floor 50] \
      --label "<text>" --out verdict-<id>.json --markdown [--expect KEEP]
    node $B/ab-verdict.cjs outcome --readings verdict-<id>.json --fix-sha <FIX_SHA> [--repo DIR]

Prints `VERDICT <WORD> d1=.. d2=.. noise=.. floor=..`. Words: KEEP, BELOW-FLOOR, NO-GAIN, NOT-RESOLVED, WORSE. KEEP needs both set differences above twice the noise and above 50 ms; noise is |mA1 minus mA2| plus |mB1 minus mB2|. Refusals (exit 1, reason word first): n-short (n below 7), noisy, failed-runs, timed-out, bad-schema, missing-id, metric-missing, p95-missing.

p95 rule: the default p95 path is the metric path with `.median` replaced by `.p95` (wall_ms.median gives wall_ms.p95, cpu_ms.median gives cpu_ms.p95) and otherwise the metric path plus `_p95` (background_ms gives background_ms_p95). A target without that number gives `p95-missing`. For a metric without p95 (`survivor_cpu_ms`, `exec_total`, `node_starts`, `load1_end`) pass `--p95-metric none`; the table and JSON then hold `n/a`. Metric hints: wall of an event `--metric wall_ms.median`; background work of SubagentStop `--metric background_ms`; hook CPU `--metric cpu_ms.median`; process count `--metric exec_total --p95-metric none`.

`outcome` rule: KEEP needs the fix commit to be an ancestor of HEAD with no `This reverts commit <sha>` line after it; every other word needs such a revert commit. It exits 1 on a mismatch, so a SUMMARY cannot say KEEP while a revert exists.

## Deviations from Plan

**1. [Rule 1 - Bug in check data] Two test fixes after the RED commit.** The NOT-RESOLVED case used the medians 300, 100, 100, 100, which give noise 200 and a NO-GAIN verdict by the rule itself (the two set differences cannot differ by more than the noise). I changed it to 130, 100, 118, 100 (d 30 and 18, noise 12). The P2 path check read the `tree=` line, which holds the folder by design; it now reads the rejected lines and stderr. Both fixes are in commit c30bf6ff4 with the tool. The rule in the tool was not changed.

**2. [Rule 2 - Added] Two extra derived rows.** block --tree-b also writes `mcp:block:idle-ping:a-minus-b`, and q7 --tree-b also writes the B copies of the four `q7:d:` rows as `q7b:d:...`. The plan names neither; both are cheap and keep the A and B row sets symmetric.

**3. [Process] No separate hypothesis document.** This plan measures no speed. The rules (five words, 50 ms floor, n of 7 or more, p95 rule, expected numbers of the tree-b checks) are fixed in the RED test commits and in the header of ab-verdict.cjs. The plan lists no md file.

**4. [Process] Pre-commit HEAD assertion.** The tree is the release tree on branch main, not a worktree-agent branch (same as plan 384-11). I committed with `git add -f` and `git commit --only <paths>`.

## Notes

- Interleave order is proven by an order log for block (BA1: 24 server starts in the exact A B / B A pattern) and for walls-subagent (WA1: `abab abab baba abab baba`). For q7 the interleave rests on the code and on the per-round pairs behind the `:a-minus-b` rows (QA3, QA4); there is no order log for q7 (UNVERIFIED).
- Both trees of a q7 run share the same two rooms. Room state left by tree A (ledger, graph) is seen by tree B in the same round. Alternating the order each round balances this; it does not remove it.
- QA4 uses the live checkout as tree A and an export of HEAD (made by pin-tree.cjs) as tree B. A peer edit of an uncommitted product file would add a difference besides the `sleep 0.2`; the check allows 50 ms of slack.
- phase-guard from BASE_SHA_384 prints FAIL for one commit that is not mine: 5d58018aa touches a phase path and `.planning/HANDOFF-2026-11-06-audit-repairs.md` and a 390 PRD (rule a). My 8 commits touch only the 10 bench files (checked with `git show --name-only` for each).
- The list of dirty product paths (hooks, scripts, lib, bin, package.json, npm-shrinkwrap.json, data) was empty at the end.
- No real room, registry, ledger or home folder was read. No push, tag, release or version bump. STATE.md, ROADMAP.md and REQUIREMENTS.md were not edited.
- Stale files /tmp/mos-384-f12-census.txt, /tmp/mos-384-f12-probe.txt, /tmp/mos-384-f12-q7.txt and /tmp/mos-384-s8-par.txt exist; they were not made by this run (it wrote its logs to the session scratch folder). Not touched.

## NOT MEASURED, UNVERIFIED

- Any speed claim. This plan measures no fix.
- Whether the machine load of other agents changes the QA4 or BA3 margins (the checks use margins of 150 ms against expected 200 and 300 ms; load1 at the start of the runs was 0.29 to 1.35, and 2.55 at the end of the q7 run).
- The Desktop and Cowork surfaces (tooling measures the Linux CLI path).

## Self-Check: PASSED

All 4 new files and 6 modified files exist; the 8 commits above exist in the log; ab-verdict and pin-tree checks re-run ALL PASS at the end; the 4 timed check files ran ALL PASS under the lock.
