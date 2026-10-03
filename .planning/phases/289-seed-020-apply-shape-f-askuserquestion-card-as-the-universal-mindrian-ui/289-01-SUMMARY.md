---
phase: 289-seed-020-apply-shape-f-askuserquestion-card-as-the-universal-mindrian-ui
plan: 01
subsystem: mcp-gate
tags: [wave-0, tests, gate, capability-ladder, normal-card-on-cli, d-02, d-03]
requires: []
provides:
  - "tests/run-all-289.sh: the Phase 289 verification floor, written once, every leg pre-declared (VAL289-01)"
  - "tests/test-289-capability-ruling.cjs: executable definition of the shared detectGateCapabilities ruling (CARD289-01, CARD289-06), RED"
  - "tests/test-289-cli-card-dual-era.cjs: live three-leg Normal card on CLI proof (CARD289-02), RED"
affects: [289-04, 289-07, 289-09, 369-26, 369-27]
tech-stack:
  added: []
  patterns: ["run/run_if/run_known_if aggregator (run-all-366 idiom)", "hermetic live MCP client tests with pid hygiene"]
key-files:
  created:
    - tests/run-all-289.sh
    - tests/test-289-capability-ruling.cjs
    - tests/test-289-cli-card-dual-era.cjs
  modified: []
key-decisions:
  - "Capability matrix rows pin D-02: Claude surface plus declared elicitation gives the card unless detectHostTier names a recognized non-Claude host (vscode, cursor), which keeps rung (a)"
  - "delegates arm compares each tool copy BOTH to the ruling row and to detectGateCapabilities, so it is RED today independent of the missing export"
  - "dual-era test copies process and daemon bookkeeping instead of importing the 369 daemon helper (peer owns it)"
requirements-completed: [VAL289-01, CARD289-01, CARD289-02, CARD289-06]
duration: 40 min
completed: 2026-10-04
---

# Phase 289 Plan 01: Wave 0 verification floor and capability-ladder tests Summary

The Phase 289 aggregator plus two RED tests that turn "Normal card on CLI" into executable definitions: one shared `detectGateCapabilities` matrix with five-delegate agreement, and a live both-era proof that fails today on the 2025 stdio legs and on the HTTP daemon.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | run-all-289.sh, written once, every leg pre-declared | a3353073f | tests/run-all-289.sh |
| 2 | capability ruling matrix and five-delegate agreement (RED) | 17c5964ab | tests/test-289-capability-ruling.cjs |
| 3 | live Normal card on CLI dual-era test (RED) | e06a6d0f6 | tests/test-289-cli-card-dual-era.cjs |

## What was built

- **tests/run-all-289.sh** (executable): 44 `run_if` legs in seven sections (unit and static, flipped tests, regression neighbours, one `run_known_if` leg for test-237 with its measured signature, a dash guard, live legs, closing 369 probe). Exit 77 counts SKIPPED, never PASSED. The dual-era leg is labelled exactly `CARD289-02 dual-era (live, last)` and is the last Phase 289 leg; the `tests/test-369-289-precondition.cjs` run_if leg closes the file.
- **tests/test-289-capability-ruling.cjs** (236 lines): arms `ruling-matrix`, `delegates`, `source`; `--arm` repeatable. 3 Claude surfaces x 4 Claude-ish clients (card), x 2 non-Claude hosts (rung a), undeclared rows, null and unknown surface rows, both throw cases, null server. Hermetic temp HOME and rooms home. Contains neither "Normal card on CLI" nor "owner-after-stranger".
- **tests/test-289-cli-card-dual-era.cjs** (384 lines): the only `tests/test-289-*.cjs` carrying the literal "Normal card on CLI" (verified with grep -l). Legs: stdio 2025 (CLAUDE_SURFACE=cli, and default hermetic desktop), stdio 2026, HTTP daemon with a 2026 client and a legacy client, plus a hygiene leg.

## RED measurements (today's code)

`node tests/test-289-capability-ruling.cjs`: exit 1, PASS=2 FAIL=168 (ruling-matrix 3, delegates 155, source 10), ends with a RESULT line, no uncaught throw. `--arm source` runs the source arm alone.

`node tests/test-289-cli-card-dual-era.cjs`: exit 1, PASS=2 FAIL=4. Each leg's printed line, the first live measurement of the HTTP capability backfill:

| Leg | Printed line |
|-----|--------------|
| stdio 2025, CLAUDE_SURFACE=cli | `negotiated 2025-11-25; elicitation requests seen: 1; renderer elicitation` (FAIL, expected) |
| stdio 2025, default env (desktop) | `negotiated 2025-11-25; elicitation requests seen: 1; renderer elicitation` (FAIL, expected) |
| stdio 2026 | `negotiated 2026-07-28; elicitation requests seen: 0; renderer askuserquestion` (ok, green today as predicted) |
| HTTP daemon, 2026 client declaring elicitation | `negotiated 2026-07-28; elicitation requests seen: 0; renderer undefined; refused: render_failed (Server-to-client requests are not available on protocol revision 2026-07-28: 'elicitation/create' cannot be sent while serving a request on ...)` (FAIL) |
| HTTP daemon, legacy-mode client declaring elicitation | `negotiated 2025-11-25; elicitation requests seen: 1; renderer elicitation` (FAIL, expected) |
| hygiene | ok, no leaked server process |

**Finding for plan 07 (research assumption A7 confirmed, and worse than inferred):** on the HTTP daemon the 2026 handler DOES backfill the declared elicitation capability, so the server picks rung (a), calls `elicitInput`, and the SDK throws; `gate_render` returns `ok:false, reason: render_failed`. Today a 2026 HTTP client that declares elicitation gets NO gate at all, not even a card. The shared `detectGateCapabilities` fix (card on every Claude surface) must therefore turn this leg green, and plan 07 should not assume the HTTP 2026 path already degrades gracefully.

## run-all-289.sh counters (expected-today baseline)

`PASSED=31 FAILED=4 SKIPPED=7 KNOWN=1`, exit 1.

- FAILED (all expected): `289 capability ruling`, `CARD289-02 dual-era (live, last)`, plus the two pre-existing reds plans 05 and 06 heal: `flipped: 238 chosen validation`, `healed: 192 menu sweep live selectors`.
- SKIPPED (missing files, written by plans 02 and 03): ledger, contract-recommended (unit and live), elicit-default (unit and live), menu-fence; and the 369 precondition probe (lands with 369 plan 26).
- KNOWN: test-237 (`MUTATION -- could not build the mutated copy`).
- The 369-07 sessionful acceptance leg and the 369-21 human-only leg run and pass; their `KNOWN:` lines ("a cross-session refusal burns the owner's gate ... Phase 289 fixes it") are the ones plan 05 flips.
- `git status --short` after the full run showed only this plan's own files (all committed); the peer's tree was not touched. `check-render-coverage --check` wrote nothing.

## Deviations from Plan

None - plan executed as written. Two small notes, neither a deviation: a one-character syntax slip in the capability test (missing `+` in a row name) was fixed before its first commit; the dual-era assertion line gained a `refused: <reason>` suffix so a refused render is visible in the printed leg line (the plan asks the SUMMARY to record what each leg printed).

## Known Stubs

None.

## Threat Flags

None. Tests are hermetic (temp HOME and rooms home, MINDRIAN_BRAIN_URL=http://127.0.0.1:9, Brain key deleted); only PIDs the test spawned are killed; pgrep before and after shows a pre-existing server pid (126630, not started by this test) left untouched.

## Out-of-scope handling

No `lib/` file touched, no registerTool or description change (tool-honesty sweep unmoved). STATE.md, ROADMAP.md and REQUIREMENTS.md untouched per D-09 and the orchestrator's instruction.

## Self-Check: PASSED

- tests/run-all-289.sh, tests/test-289-capability-ruling.cjs, tests/test-289-cli-card-dual-era.cjs exist; commits a3353073f, 17c5964ab, e06a6d0f6 are on main.
- `grep -l "Normal card on CLI" tests/test-289-*.cjs` lists exactly the dual-era file; no em-dash or en-dash in any of the three files.
