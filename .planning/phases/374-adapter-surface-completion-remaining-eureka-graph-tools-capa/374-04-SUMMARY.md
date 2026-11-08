---
phase: 374-adapter-surface-completion-remaining-eureka-graph-tools-capa
plan: 04
subsystem: planning-gates
tags: [answer-gate, owner-cards, verify-declined, selftest]
requires:
  - phase: 390
    provides: 390-gate.cjs answer gate (gate-item, resolve, seal)
provides:
  - 374-gate.cjs with commands selftest, plan, check-map, table, verify-declined
affects: [374-07, 374-08, 374-09, 374-10, 374-11, 374-12, 374-13, 374-14]
tech-stack:
  added: []
  patterns: [thin wrapper over an existing gate by spawnSync, plan map as frozen data]
key-files:
  created:
    - .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-gate.cjs
    - .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-04-SUMMARY.md
  modified: []
key-decisions:
  - "verify-declined scope: the diff and status checks cover only the plan's own files_modified paths outside the phase folder, plus commits tagged (374-NN) since BASE. Peer commits in the shared tree do not trip it (planner deviation, kept)."
  - "An empty path list skips the diff and status checks. It never widens the check to the whole tree."
  - "BASE must resolve to a commit and must be an ancestor of HEAD, else exit 3."
requirements-completed: [PLG374-03]
duration: 25min
completed: 2026-11-08
---

# Phase 374 Plan 04: Answer gate wrapper for the Phase 374 owner cards Summary

374-gate.cjs asks the Phase 390 answer gate one question per card item and maps the answers to PLAN-GO, PLAN-DECLINED, PLAN-BLOCKED or PLAN-REPLAN for plans 374-08 to 374-14, and its verify-declined command proves a declined plan changed nothing.

## Task commits

1. Task 1 (RED then GREEN) and Task 2 (hand runs, SUMMARY): one commit, see the final line of this file for the hash.

## RED output (selftest against stubs)

Stubs for plan, check-map, table and verify-declined exited 3 with "not implemented". The selftest ran all 12 cases and exited 1. First lines:

```
FAIL W1 an act item PENDING: exit 1, BLOCKED-PENDING, final line PLAN-BLOCKED: exit 3 want 1 (not implemented); ...
FAIL W2 mode all, act item go: exit 0, ACT line, READ line, PLAN-GO: exit 3 want 0 (not implemented); ...
FAIL W3 act item KEEP-ALL: exit 2, PLAN-DECLINED ...: exit 3 want 2 (not implemented); ...
FAIL W4 ... FAIL W5 ... FAIL W6 ... FAIL W7 ...
ok   W8 an unknown plan id, a missing card and a missing 390-gate.cjs each exit 3
FAIL W9 ... FAIL W10 ... FAIL W11 ... FAIL W12 ...
selftest FAILED: W1 W2 W3 W4 W5 W6 W7 W9 W10 W11 W12
```

W8 passed in the RED run only because the stub also exits 3. It tests the exit 3 paths, so it is a weak RED case. All other 11 cases failed.

## GREEN output

```
ok   W1 an act item PENDING: exit 1, BLOCKED-PENDING, final line PLAN-BLOCKED
ok   W2 mode all, act item go: exit 0, ACT line, READ line, PLAN-GO
ok   W3 act item KEEP-ALL: exit 2, PLAN-DECLINED (mode all and mode any with no go item)
ok   W4 mode any, one item go and one decline: exit 0, PLAN-GO, the declined item prints skip
ok   W5 an answer in the replan list, or in no list: exit 1, PLAN-REPLAN with the item and option
ok   W6 act item answered but a read item PENDING: exit 1, BLOCKED-PENDING, PLAN-BLOCKED
ok   W7 an OPTIONS line edited after the seal: exit 1, BLOCKED-HASH passes through
ok   W8 an unknown plan id, a missing card and a missing 390-gate.cjs each exit 3
ok   W9 check-map: MAP-ITEM-MISSING, CARD-ITEM-UNUSED, MAP-OPTION-UNKNOWN each exit 1; a valid pair exit 0
ok   W10 table prints one PLAN line for each of the 7 plans and exits 0
ok   W11 verify-declined: nothing changed, a phase-folder change, or a peer commit on another path: exit 0, DECLINED-OK
ok   W12 verify-declined: dirty file, committed file, untracked file, plan-tagged commit exit 1 DECLINED-VIOLATION; --part-files skips the other part; unknown BASE exit 3
selftest passed
```

Exit codes 0 (W2, W4, W9 ok, W10, W11), 1 (W1, W5, W6, W7, W9 bad, W12), 2 (W3) and 3 (W8, W12 bad BASE) each appear in a case.

## Proof that verify-declined can fail

W12 makes a declined plan change things and expects exit 1 with the path or the sha: (a) lib/a.cjs dirty, (b) lib/a.cjs changed by a commit after BASE, (c) untracked lib/b.cjs, (d) a commit "feat(374-99): ..." on an unrelated file. Two mutation checks on a copy of the script confirm the cases bite: with the tag check switched off W12 fails; with the status check switched off W11 and W12 fail. The copies were deleted.

## Exit code table

| Command | Code | Meaning |
|---------|------|---------|
| plan | 0 | PLAN-GO |
| plan | 2 | PLAN-DECLINED (change nothing, then run verify-declined) |
| plan | 1 | PLAN-BLOCKED (PENDING, bad token, hash, head or structure) or PLAN-REPLAN (answer no plan covers) |
| plan | 3 | usage error, unknown plan, missing card, missing 390-gate.cjs |
| verify-declined | 0 / 1 / 3 | DECLINED-OK / DECLINED-VIOLATION / bad BASE or usage |
| check-map | 0 / 1 / 3 | OK check-map / problem lines / usage or missing card |

## Output grammar of plan

```
ACT <od> <option> go|skip|replan
READ <od> <option>
<blocked line of the answer gate, passed through>
PLAN-GO <plan> | PLAN-DECLINED <plan> | PLAN-BLOCKED <plan> <WORD> <od> | PLAN-REPLAN <plan> <od>=<option>
```

An option in no list of the act item counts as replan. An answer KEEP (exit 2 of the answer gate) counts as an answered item with option KEEP, never as a stop; the go, decline and replan lists decide. A declined act item with a pending read item is PLAN-BLOCKED (every read item must be answered first).

## Lines for the gated plans

Before the gate run `BASE=$(git rev-parse HEAD)` and keep the value.

Your first step is `node .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-gate.cjs plan 374-NN`. Exit 0 PLAN-GO: continue and read the ACT and READ lines. Exit 2 PLAN-DECLINED: change nothing, then run `node .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-gate.cjs verify-declined 374-NN $BASE`; only when it exits 0 report STATUS DONE, CHANGED NONE. Exit 1: change nothing, STATUS BLOCKED, and return NEEDS_HUMAN with the printed PLAN-BLOCKED or PLAN-REPLAN line. Exit 3: change nothing, STATUS BLOCKED, name the reason.

For the mode any plan 374-12, a skipped part is checked with `node .planning/phases/374-adapter-surface-completion-remaining-eureka-graph-tools-capa/374-gate.cjs verify-declined 374-12 $BASE --part-files <the files of the skipped part>`. With --part-files only the named files are checked and the plan-tag commit check is off (the other part may have committed under the plan tag).

## Hand runs (Task 2)

- `table`: 7 lines, matches the plan map of the context block row by row (PROVEN by eye: 08, 09, 10, 11, 12, 13, 14; modes, act items, options, read items).
- `plan 374-08` with no card: exit 3, "the card is missing: .../374-DECISION.md" (plan 374-07 writes the card).
- `verify-declined 374-08 $(git rev-parse HEAD)` in the real tree: `DECLINED-OK 374-08`, exit 0. `verify-declined 374-08 deadbeef`: exit 3.
- `node 390-gate.cjs selftest`: 13 ok lines, "selftest passed".
- Non-ASCII byte scan of 374-gate.cjs: none. No em dash or en dash.

## Deviations from Plan

None. The plan executed as written. W8 is the weak RED case (see above); that follows from the plan's own stub rule (stubs exit 3).

## Known Stubs

None.

## Threat Flags

None. The script writes only temp files and spawns git and node. It reads the card and the plan files. Node built-ins only.

## Notes for later plans

- check-map has not yet run on the real card: 374-DECISION.md does not exist until plan 374-07. Plan 374-07 must run `node 374-gate.cjs check-map` on it.
- The plan map in 374-gate.cjs matches the owner decision map of 374-CONTEXT.md. If 374-07 changes an option name, the map and the card must change together (check-map catches drift).
- verify-declined reads files_modified from `<script folder>/<PLAN_ID>-PLAN.md`; it ignores paths under `.planning/phases/374-*/`.
