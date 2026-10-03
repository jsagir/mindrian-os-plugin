---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 18
subsystem: ui-bakeoff
tags: [bake-off, measurement, decision-gate, d-05, d-07, playwright, chassis]

requires:
  - phase: 369-14
    provides: room-proposal adapter, the only ProposalSource that exists
  - phase: 369-15
    provides: candidate A (workroom, Next) production build
  - phase: 369-16
    provides: candidate B (agent-native, Vite and Nitro) production build
  - phase: 369-17
    provides: room.changed wake-up, measured by the gate and reconnect runs
provides:
  - ui/bakeoff/measure.cjs, the nine-measure harness plus gate-latency and CSP extras
  - ui/bakeoff/results.json, the measured numbers for both candidates (BAKE369-03)
  - ui/bakeoff/COMPARISON.md, the one-table comparison
  - 369-BAKEOFF-DECISION.md, the navigator's chassis ruling and its consequences (BAKE369-04)
affects: [369-19 through 369-32 chassis-neutral shell plans, 369-28 (shell server, RULE 8, C2 wording)]

tech-stack:
  added: []
  patterns:
    - "measure, do not advocate: a number the harness cannot take is { value: null, not_measured: reason }"
    - "CSP measured by Playwright interception of the document response only, so the server's own guards are untouched"

key-files:
  created:
    - ui/bakeoff/measure.cjs
    - ui/bakeoff/README.md
    - ui/bakeoff/results.json
    - ui/bakeoff/COMPARISON.md
    - tests/test-369-bakeoff-measure.cjs
    - .planning/phases/369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-/369-BAKEOFF-DECISION.md
  modified: []

key-decisions:
  - "Winner: workroom (navigator, 2026-10-03, reply 'workroom (Recommended)'); build tool Next"
  - "Transplants: agent-native's pool-bind-based openRoom (reconnect), and the Nitro output footprint as input to the shell-server question and RULE 8"
  - "Shell server: Next standalone only if the 1,028-file traced node_modules is eliminated; otherwise a plugin-side express server over a static client export, which goes back to the navigator"
  - "CSP: a nonce or hash policy is needed and has not been exercised; never 'unsafe-inline' without a ruling"

requirements-completed: [BAKE369-03, BAKE369-04]

duration: about 5h (harness, three measurement iterations, comparison, checkpoint)
completed: 2026-10-03
---

# Phase 369 Plan 18: Bake-off measurement and chassis decision Summary

**One Playwright harness measured both production-built candidates on the nine D-05 measures on this machine; the comparison split (workroom ahead on 7, agent-native on reconnect and output size, two equal), the navigator ruled workroom with two transplants, and the decision record names the build tool, the unmet RULE 8 condition on the shell server, and the CSP finding.**

## What was built

- `ui/bakeoff/measure.cjs` (`--candidate workroom|agent-native|both`, `--out`, `--skip-build`): checks slice parity (same six actions and exposures) before measuring, deletes and rebuilds each candidate from its own `setup.sh` and `build.sh`, then runs four hermetic launches per candidate under a temp HOME on loopback: adapter-mode selected-state, the full slice end to end (open room, BlockNote document, Ask Claude, gate as UI, Confirm, `change_seq`, `room.changed`, RxDB pull, evidence view), the UI-SPEC CSP, and a daemon-kill reconnect; plus a packaged-copy start with plain `node`. Exports `retainedLines`, `countForbiddenIo`, `diffStorage`, `convergence`, `packagingSummary`, `parseSliceActions`.
- `tests/test-369-bakeoff-measure.cjs`: 12 arms (8 scoring and parser arms, results.json schema arm over both candidates, parity, no long dash). Exit 0.
- `results.json`, `COMPARISON.md`, `README.md` (reproduce from nothing, one sentence per measure).
- `369-BAKEOFF-DECISION.md` with the eight required heading lines.

## Measured result (see COMPARISON.md for the table and methods)

Workroom better: architecture distorted (5 markers against 21), code surviving (347 of 2,911 lines against 0), selected state (pass against fail), persistent state (15 against 20), startup errors (1 against 28), dependencies remaining (17 against 86), CSP violation count (12 against 27). Agent-native better: reconnect (all 6 claims at 315 ms against 6 of 6 missing without a reload) and output size (192 files against 1,262). Equal: direct file writes (0 and 0), gate click to view (112 and 115 ms). Packaging splits inside the measure (workroom build 16.9 s and first paint 68 ms; agent-native 31.4 MB and 1 non-root package).

## Task Commits

1. Task 1, harness, README, tests: `35a264825`
2. Task 2, harness corrections from the first runs: `a59e9ccd7`; results.json and COMPARISON.md: `94cd635d1`
3. Task 3, Decision Gate: navigator reply recorded in the decision file (no commit of its own)
4. Task 4, decision record: `191371c25`

## Deviations from Plan

**1. [Rule 3 - Blocking] Full-slice runs use the `fixed` proposal source.** Candidate B's `proposeDecision` imports `createClaudeAdapterSource`, which plan 14's adapter does not export, so B cannot mint a gate in adapter mode. Measure 3 runs in adapter mode on both (A passes, B fails with the logged error, reported as measured); every other run uses `fixed` on both. No fake-claude binary: plan 14 ruled room-proposal, so nothing is spawned. Neither candidate was edited.

**2. [Rule 1 - Bug] Harness corrections during the first runs** (a59e9ccd7): the wrong Playwright handle, a readiness probe that treated B's `/` 5xx as not ready, e2e claims given a source edge so Approve meets the room floor and writes a decision, reconnect value defined as claims still missing, diagnostics and reload recovery added.

**3. Long dash:** one framework log line carried a literal em-dash; the harness strips them on write, and the committed results.json had the same transform applied to that one string after the run. No number changed.

**4.** Setup and build run under the real HOME (installs need the package cache); every measured process runs under a temp HOME.

**5.** `architecture_distorted` value is the bypass-marker count (mechanical, listed in results.json); outside-file count is 0 for both.

**Checkpoint relay:** the Task 3 reply reached the executor through the orchestrator, which fired the card; the reply is quoted verbatim with its date in the decision file.

## Findings for later plans

- Two results trace to one-file overlay wiring, not the chassis: A's `openRoom` skips the pool's `bind` (so reconnect fails), B's `proposeDecision` names a nonexistent adapter export. Neither was corrected here; transplant 1 covers A's.
- Neither slice renders the `copyReference` line the room-proposal path needs; the person has no pasteable line today.
- B's page has no selection control (URL parameter only); A selects by click.
- UI-SPEC check C2 (zero `rxdb.info` literals) cannot pass for any chassis that bundles RxDB without a build-time rewrite (shared finding in results.json).
- Next standalone output carries a 1,028-file traced `node_modules` and 15 runtime packages outside the root manifest: RULE 8 and the walled-manifest rule are unmet until plan 28 proves otherwise.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-369-18-01 mitigated (blocking checkpoint, reply quoted with date), -02 (identical fixture seeds, parity abort), -03 (egress hosts recorded per run: 127.0.0.1 only), -04 (no `'unsafe-inline'` shipped; the one measurement run that allowed inline scripts is labelled and is not a policy).

## Self-Check: PASSED

- FOUND: ui/bakeoff/measure.cjs, README.md, results.json, COMPARISON.md, tests/test-369-bakeoff-measure.cjs, 369-BAKEOFF-DECISION.md
- FOUND commits: 35a264825, a59e9ccd7, 94cd635d1, 191371c25
- `node tests/test-369-bakeoff-measure.cjs` exit 0; the decision grep prints 8; no ui/shell exists
