---
phase: 364-scientific-roadmapping-command-mos-scientific-roadmap-seed-0
plan: 09
subsystem: cli-door, end-to-end-proof, part8-sweep
tags: [cli, e2e, honest-refusal, part8-sweep, live-smoke, tri-polar, tdd]
requires: [364-05, 364-06, 364-08, 364-14]
provides:
  - "scripts/scientific-roadmap.cjs: start, entry, steps, stage, question-set, plan, basket, file"
  - "tests/test-364-refusal-e2e.cjs (X1-X10, 52 checks), tests/test-364-part8.cjs (Q1-Q8, 17 checks)"
  - "tests/test-364-live-smoke.cjs (opt-in, exit 77 without MOS_364_LIVE)"
affects: [364-11, 364-12, 364-13]
key-files:
  created:
    - scripts/scientific-roadmap.cjs
    - tests/test-364-refusal-e2e.cjs
    - tests/test-364-part8.cjs
    - tests/test-364-live-smoke.cjs
  modified:
    - lib/core/research-planner/sr-filing.cjs
    - tests/test-364-theo-handoff.cjs
decisions:
  - "On a confirm stage call the CLI ignores --state and prints the authoritative state_path (Larry cannot know the run tag before it exists); every other call validates --state strictly (exit 2 state_path_invalid)"
  - "Each Theo-backed next stage re-reads framework_step so step.runIt is Theo's text as served; the run state still keeps only ids and labels (05 decision), so no Theo step text is remembered"
  - "plan writes the ratchet output into state.settled_excluded, which wires the 364-06 'Settled, not re-argued' stub with no change to sr-filing's reader"
requirements: [SRM364-07, SRM364-16, SRM364-09]
metrics:
  tasks: 2
  files: 6
  completed: 2026-10-03
---

# Phase 364 Plan 09: CLI door and end-to-end proof Summary

The command body's every Bash step now works: `scripts/scientific-roadmap.cjs` runs the entry check first, gives the exact honest refusal on today's all-NULL Theo state, walks an authored state through all seven steps to a filed `research-plan/PLAN.md` only on an approved selection, and a planted-marker sweep proves nothing from the room reaches Theo.

PLAN_BASE: `dd79b84e675ea24fdeeb75fa9d53b128282550dc` (HEAD at start; the tree moved under it from peer commits, none touching 364 files).

## Commits (all ancestors of HEAD, all `git commit --only`)

| Order | Phase | Sha | Message |
|-------|-------|-----|---------|
| 1 | RED | ee72d9bd4 | test(364-09): RED CLI end-to-end, Part 8 sweep and opt-in live smoke |
| 2 | RED | 5914238cb | test(364-09): RED leg for plan_ref on the filed plan; tighten sidecar, card and Q8 legs |
| 3 | fix | d4dfae482 | fix(364-09): the filed plan names its plan run when the state carries plan_ref as { run_id } |
| 4 | GREEN | f6df816d3 | feat(364-09): scientific-roadmap CLI door (entry first, honest refusal, walk, plan, basket, file) |
| 5 | test | e4188996f | test(364-09): keep the Theo repo path out of the part8 sweep text (T8 fence) |
| 6 | fix | e14529a5d | fix(364-09): escape the dash literals in the 364-10 handoff test so the phase dash fence is green |

TDD gate: test commits (1, 2) precede the feat commit (4); RED runs exited non-zero (e2e 7 pass 44 fail, part8 9 fail) before the CLI existed; the live smoke exited 77.

## What was built

- **The CLI door** (399 lines, switch-case router, no Commander or yargs, no `brain-client` text, no dash bytes, chmod +x). It holds no methodology logic: sr-entry (entry and card, surface cli), sr-steps (the only Theo reach), sr-door (stage machine, question set, Stage B), sr-filing (basket, filePlan). `start` runs the resolver first: empty room gives `define_what` with zero Theo calls; with a WHAT and the all-NULL state it gives `next:'refused'`, `theo.message` exactly "Theo has not authored this step yet", offer `/mos:research`, coverage `uncovered`, nothing written; an authored state gives `entry_gate` with seven labels in Theo's list order.
- **Path rules** (T-364-38, T-364-39): `--state` must be `<room>/.mindrian/scientific-roadmap/sr-<yyyymmdd>-<8 hex>.json` (lexical and realpath checks, symlink refused); `--input` and `--selection` must be regular files of at most 262144 bytes holding a plain object. Exit 2 usage, 1 internal (detail at most 120 characters), 0 ok and honest refusals. State writes are atomic (temp sibling then rename).
- **Plan 14 path covered end to end**: a Phase 355 stamped finding on file proposes step 6, its stamp lines appear in the card and `start` entry exactly as the formatter prints them, its score never appears, the run has the systems pass open first, and `sr:6` refuses `bound_input_unaddressed:<opportunity id>` (state unchanged) until the row is a limiter row with `source_node_id` or is dismissed with a reason.
- **Plan 06 stub wired**: `plan` copies the ratchet output into `state.settled_excluded` before writing the state. Test: a prior run whose settled key matches limiter LM2 gives `settled_excluded` of one, and the filed PLAN.md lists it under "Settled, not re-argued" instead of the empty line.
- **Part 8 sweep**: a marker room (goal, governing question, claim and every stage output carry MARKER-364-ROOM; the marker is proven present in the state file, the card and the filed PLAN.md so the check is not vacuous). Across 10+ CLI children and the in-process MCP handler on the same room, every recorded call is `framework_step {framework:'Scientific Roadmapping'}` or `recommend_chain {WellDefined, 6}`, and the real guard returns verdict allow, class known_tool_shape for each. Static scans: only sr-steps.cjs references brain-client; no raw Theo reach, `fetch(`, or http/https/net module; no Theo repo path or write call naming Theo in any sr module or the CLI.
- **Parity (X8)**: the in-process MCP handler on the same room carries the same refusal text and "Proposed entry: step 2 of 7" as the CLI.
- **Live smoke**: opt-in; real HOME kept, rooms home sandboxed, calls only the two read-only handles through the guarded client, prints one `LIVE_METRICS` line, treats an unreachable or keyless Brain as an ENV GAP (exit 77, never a pass). NOT run against the network here (364-11 owns that, navigator-approved).

## Verification (measured, HOME and MINDRIAN_ROOMS_HOME sandboxed)

- `node tests/test-364-refusal-e2e.cjs`: PASS 52 FAIL 0. `node tests/test-364-part8.cjs`: PASS 17 FAIL 0.
- Also green: test-364-mcp (31), sr-door (70), sr-entry (37), sr-steps (37), filing (49), compose-355 (21), entry-points (16), theo-handoff (9), registry-gates, test-205-surface-fence, test-369-writer-inventory; build-command-registry, build-connector-registry, check-render-coverage `--check` all exit 0.
- `bash tests/run-all-364.sh`: exit 0, PASSED=61 FAILED=0 SKIPPED=1 (the opt-in live smoke) KNOWN=3 (the pre-existing ledger reds).
- `node scripts/scientific-roadmap.cjs nope` exits 2; acceptance greps: 10 X ids, 8 Q ids, dash bytes 0 in all five files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] sr-filing wrote `plan_ref: null` for a real plan**
- **Found during:** Task 2 (end-to-end walk; the filed PLAN.md showed `plan_ref: null` after a successful `plan`).
- **Issue:** `stageB` records `state.plan_ref` as `{ run_id }` (plan 05); `renderPlanMd` only accepted a string (plan 06), so no filed plan ever named the run it came from. Neither plan's unit tests exercised the pair.
- **Fix:** `planRunId(state)` accepts the object or a string. RED leg first (X5 "plan_ref is the run id", commit 5914238cb), then fix.
- **Files modified:** lib/core/research-planner/sr-filing.cjs (outside files_modified; clean, not peer-owned). **Commit:** d4dfae482. test-364-filing still 49/49.

**2. [Rule 3 - Blocking] Literal dash characters in the plan-10 test failed the phase dash fence**
- **Found during:** run-all-364.sh (acceptance requires FAILED=0).
- **Fix:** `tests/test-364-theo-handoff.cjs` line 38 regex class spelled with `—–` escapes (identical behaviour; same fix 364-08 made for four other files). **Commit:** e14529a5d.

### Judgment calls inside the contract

- `stage` with `confirm` does not read `--state` (the command body passes a placeholder there and the run tag does not exist yet); the printed `state_path` is authoritative. Non-confirm calls and every other subcommand validate it strictly.
- X3 compares the room listing and `room.db` sha256 but skips `room.db-shm` and `room.db-wal`: these are SQLite sidecars of a read-only open of a WAL database (same rule as 364-08's M7), not room content; the database file hash is identical.
- `basket` returns `card` as the card object (title and `body_md`), as `planBasketCard` builds it, not a bare string.
- Extra fields beyond the contract (additive only): `theo_code` and `kind` on a refusal, `plan_status` and `next_stage` on `plan`, `landed`, `not_landed` and `filing_recorded` on `file`, `step.theo_reason` when a fresh step read cannot serve the text.
- Q8 reading: "no Theo runIt text other than what the fixture served" is asserted as: all seven `theo_label` values are fixture labels, no fixture runIt string and no refusal text appears in the filed plan, and the marker appears only in body text the navigator wrote.

## Known Stubs

None. The 364-06 `state.settled_excluded` stub is wired by this plan.

## Threat Flags

None. T-364-38 (X6), T-364-39 (X7), T-364-40 (Q1-Q6), T-364-41 (X5 approval refusal writes nothing), T-364-42 (X2, X8), T-364-43 (argv carries flags and paths only) are mitigated and tested. No new endpoint or auth path.

## Notes for downstream plans

- 364-11 owns the live run: `MOS_364_LIVE=1 node tests/test-364-live-smoke.cjs` (also reached by `run-all-364.sh` when the guard file exists and the env is set).
- Known open item from 364-08/14 unchanged: `lib/mcp/brain-router.cjs KNOWN_METHODOLOGIES` still lacks the slug (outside bounds).
- STATE.md and ROADMAP.md were not touched, per the sequential-executor rules. The unrelated peer-dirty `.planning/phases/289-.../289-VALIDATION.md` and `ui/bakeoff/measure.cjs` were left alone.

## Self-Check: PASSED

- FOUND: scripts/scientific-roadmap.cjs, tests/test-364-refusal-e2e.cjs, tests/test-364-part8.cjs, tests/test-364-live-smoke.cjs.
- FOUND commits (ancestors of HEAD): ee72d9bd4, 5914238cb, d4dfae482, f6df816d3, e4188996f, e14529a5d.
