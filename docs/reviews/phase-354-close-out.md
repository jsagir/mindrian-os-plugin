# Phase 354: System Integrity and Theo Integration -- Close-out

Published by: 354-16 (Task 2, measured gates; Task 3, coverage/residual risks/decisions/
deployment status). Closes the handoff's "Acceptance and close-out" section point by point
(`docs/2026-09-20-HANDOFF-phase-354-system-integrity-and-theo.md`), together with
`docs/reviews/phase-354-disposition-ledger.md`'s Final disposition section (13 IDs) and
`docs/reviews/2026-09-20-full-system-code-review.md`'s Corrections section.

## Environment (this run)

```
$ git rev-parse HEAD
807aeeb81b8a74489cddd4e1c63e9614e1abf0fa

$ node lib/core/repo-version.cjs
2.0.0-beta.48

$ node --version
v22.23.1

$ uname -a
Linux JonathanSagir 6.6.87.2-microsoft-standard-WSL2 #1 SMP PREEMPT_DYNAMIC Thu Jun 5
18:31:42 UTC 2025 aarch64 aarch64 aarch64 GNU/Linux
```

Sandbox: this executor's Bash tool ran every command below with default sandboxing (no
`dangerouslyDisableSandbox`). Network egress was reachable and exercised for real: the live
Theo contract calls recorded in `354-THEO-EVIDENCE.md` (2026-09-23, 354-12), the npm-registry
round trips inside `doctor --acceptance --pre-tag` (`version-of-record-published`,
`npx-roundtrip`), and `bash tests/run-all-349.sh`'s own release-shape-gate legs all completed
against live origins, not mocks. This directly matches `.planning/debug/sys-07-acceptance-timing.md`'s
own finding: no mock-server restriction was in effect for this run.

Concurrent peer sessions: `git status --short` throughout this plan's execution showed
unrelated in-flight changes from other Claude Code sessions sharing this working tree
(`docs/reviews/mindrian-system-explainer.html`, `evals/plurai/211-baseline.json`,
`scripts/eval-icm-writers.cjs`, `tests/test-353-*.cjs`, `tests/test-361-agent-contract.cjs`,
plus new untracked files) -- none of them touched by this plan, none of them files any
Measured gate below scans or classifies. Every commit in this plan stages only its own named
files via `git commit --only`.

## Measured gates

One row per command the handoff and `354-16-PLAN.md` Task 2 name. Exit status and wall-clock
duration measured with `date +%s.%N` deltas around each command; a failing command's own
output excerpt is quoted, never silently re-run until green.

| # | Command | Exit | Duration | Result |
|---|---------|------|----------|--------|
| 1 | `bash tests/run-all-354.sh` | 0 | 40.8s | PASSED=19 FAILED=0 SKIPPED=1 (SKIPPED leg: the opt-in live Theo contract test, `MINDRIAN_354_LIVE` unset for this specific run -- already exercised live and recorded separately in `354-THEO-EVIDENCE.md`) |
| 2 | `node scripts/check-substrate.cjs --diff` | 0 | 0.0s | clean, no drift |
| 3 | `node scripts/build-connector-registry.cjs --check` | 0 | 0.2s | clean, no drift |
| 4 | `node scripts/build-orchestration-projection.cjs --check` | 0 | 0.0s | clean, no drift |
| 5 | `node scripts/check-render-coverage.cjs` | 0 | 0.0s | clean |
| 6 | `node scripts/check-tool-honesty.cjs --check` | 0 | 0.5s | clean |
| 7 | `node scripts/check-shape-declaration.cjs --check` | 0 | 0.1s | advisory WARN, non-blocking: 53 violations detected (the same 53 CLAUDE.md's Part 11 section already names as open); `--strict` would restore hard-fail, not invoked here |
| 8 | `node scripts/build-skill-mirrors.cjs --check` | 0 | 0.0s | clean, no drift |
| 9 | `timeout 900 node scripts/doctor.cjs --acceptance --pre-tag --json` | 0 | 56.1s | 18/18 points passed; `summary.duration_ms: 56020`; `summary.slowest: {"id":"doctor-all","duration_ms":29109}`; per-point progress on stderr (354-13 instrumentation); zero timeouts, zero orphan processes |
| 10 | `bash tests/run-all-166.sh` | 1 | 2.6s | 22/23 legs passed; the one failure is the pre-existing, unrelated `test-act-prebehavior-snapshot.cjs` render-snapshot mismatch, root-caused and logged in `deferred-items.md` under 354-03 (confirmed byte-identical against `chain-executor.cjs` reverted to its pre-354-03 state) |
| 11 | `bash tests/run-all-349.sh` | 0 | 215.8s | 14/14 legs passed (release-shape-gate x5, doctor acceptance self-coverage x6, connector-registry-fresh, em-dash guard) |
| 12 | `node lib/memory/write-lock-atomic.test.cjs` | 0 | 3.1s | clean, 20 forked workers, exactly 1 winner |
| 13 | 19 files matching `tests/*egress*.cjs` and `tests/part8-egress*.cjs` | see below | see below | 18 of 19 passed; the one failure (`tests/test-257-brain-tool-egress-invariant.cjs`, exit 1) is the pre-existing Arm 2 `theo_health` prewarm-race flake logged in `deferred-items.md` under 354-06 (root cause: `brain-prewarm.cjs`'s unawaited prewarm racing the test's own capture-server reset, not a defect in `part8-egress-guard.cjs`/`brain-client.cjs`) |
| 14 | 13 files matching `tests/test-345-*.cjs` | see below | see below | 12 of 13 passed; the one failure (`tests/test-345-gate-ratify.cjs`, exit 1) is the pre-existing `anchor_confirmed` failure in `goal-gate.cjs`'s own strategy-card path, logged in `deferred-items.md` under 354-02 (confirmed byte-identical against `gate.cjs` reverted to its pre-354-02 state) |
| 15 | `node tests/test-276-meeting-gate-wiring.cjs` | 0 | 0.4s | 14/14 checks passed |
| 16 | `node tests/test-354-concurrency-surfaces.cjs` | 0 | 10.6s | 25/25 checks passed (K1-K5, see Task 1 commit) |
| 17 | `node tests/audit-localhost-workspace-review.cjs` | 0 | 6.1s | recheck of the legacy dashboard findings, see "Legacy localhost review recheck" below |

Row 13 detail (19 files, 18 passed / 1 pre-existing failure, total wall time 8.6s across all
19): `part8-egress-e2e-smoke.test.cjs` (0.1s), `part8-egress-guard-hook.test.cjs` (0.9s),
`test-148-brain-review-egress.cjs` (0.1s), `test-149-brain-egress.cjs` (0.1s),
`test-150-brain-egress.cjs` (0.1s), `test-220-part8-egress.cjs` (0.7s),
`test-223-part8-egress.cjs` (0.3s), `test-239-query-egress-canary.cjs` (0.3s),
`test-245-egress-contentless.cjs` (0.7s), `test-257-brain-tool-egress-invariant.cjs`
(0.3s, **FAILED**, pre-existing per above), `test-257-refusal-egress-kind.cjs` (0.1s),
`test-354-egress-typed-question.cjs` (2.4s), `test-356-egress.cjs` (0.1s),
`test-361-egress-shapes.cjs` (0.3s), `test-bch-14-part8-egress.cjs` (0.0s),
`test-domain-insight-egress-tripwire.cjs` (0.1s), `test-heal-obs2-regression.cjs` (0.0s),
`test-room-home-vs-brain-derivation-regression.cjs` (0.5s),
`test-room-state-no-registry-regression.cjs` (0.1s).

Row 14 detail (13 files, 12 passed / 1 pre-existing failure, total wall time 5.9s across all
13): `test-345-cadence.cjs` (1.5s), `test-345-climb.cjs` (0.0s), `test-345-cooldown.cjs`
(0.2s), `test-345-doctrine.cjs` (0.0s), `test-345-gate-anchor.cjs` (1.7s),
`test-345-gate-ratify.cjs` (2.1s, **FAILED**, pre-existing per above),
`test-345-goal-record.cjs` (0.1s), `test-345-goal-version-stamp.cjs` (0.0s),
`test-345-lockstep.cjs` (0.0s), `test-345-part8.cjs` (0.0s), `test-345-producer-fires.cjs`
(0.3s), `test-345-rung-mapping.cjs` (0.1s), `test-345-strategy-sensor.cjs` (0.0s).

Both pre-existing failures (rows 13 and 14) were root-caused during their owning plans
(354-02, 354-06) by reverting exactly the file each plan modified and re-running: both
reproduced byte-identically with Phase 354's own fix code absent, confirming neither is
caused by this phase. Both remain open, tracked in
`.planning/phases/354-system-integrity-and-theo-integration-independent-research-a/deferred-items.md`,
not silently fixed or hidden here.

## Legacy localhost review recheck

Source: `docs/reviews/2026-09-20-localhost-workspace-review.md`, rechecked this run via
`node tests/audit-localhost-workspace-review.cjs` against `scripts/serve-dashboard-live` (the
legacy dashboard -- a different surface than the POC at `docs/reviews/localhost-poc/`, which
354-07/354-08/354-11 hardened and journeyed).

| Legacy finding | Recheck result | Evidence |
|---|---|---|
| Foreign `Host` accepted on a read endpoint (`review.invalid` GET returns 200) | ALREADY FIXED (354-08) | This recheck's own `foreignHostGet` check still shows `status: 200` for a `Host: review.invalid` GET, but that is a **false negative of the recheck script itself**, not a live gap: `audit-localhost-workspace-review.cjs:27` forges the Host header through global `fetch()` (undici), which silently discards a caller-set `Host` header override (the same limitation 354-08-SUMMARY.md documented and worked around). The dedicated, correctly-instrumented regression -- `tests/test-354-dashboard-host-read.cjs`, which uses `node:http` (honors a forged `Host` header, matching a real DNS-rebinding attacker's TCP-level view) -- ran inside `bash tests/run-all-354.sh` (row 1 above) and shows `ok - foreign Host refused on GET /` (403) across every enumerated route. The fix holds; only this older audit script's own transport choice cannot observe it. |
| `ROOM_DATA` empty (`{}`) on initial browser load, raw template placeholder unresolved | CONFIRMED, still open | `browser.roomData: {}` in this run's fresh evidence capture. No Phase 354 plan targeted `scripts/serve-dashboard-live`'s `ROOM_DATA` templating (only 354-08 Task 3's Host-check-on-every-GET fix touched this file). Not silently dropped: carried forward as an open finding. |
| File-change event does not trigger a visible browser refresh | CONFIRMED, still open | `fileChangeEvent` fires correctly (`event: artifact-changed`, real SSE payload), but `browser.requestsAfterChange` is byte-identical to `browser.requests` (no new fetch after the event) and `browser.roomDataAfterChange` is still `{}` -- the event reaches the page and nothing visible happens. Not touched by any Phase 354 plan (354-11's revision-poll/reload fix lives in the POC's `app.js`, a separate file from the legacy dashboard's own client script). |
| Mobile layout overflows viewport at 390x844 | CONFIRMED, still open | `browser.mobileOverflow: true` in this run. Not touched by any Phase 354 plan (no SYS/THEO id names dashboard CSS/layout). |
| Browser chat is not a real Claude Code adapter (direct Anthropic Messages call, no session bridge) | PRODUCT GAP, carried forward, not independently re-observed this run | This recheck's own `unauthenticatedChat` probe now returns `403 Forbidden origin` (354-08's Origin allowlist correctly refusing the probe's own unauthenticated fetch, which sends no matching `Origin` header) -- a side effect of the security hardening, not a re-test of the original architectural finding (the probe can no longer reach the chat handler at all to observe which backend it calls). No Phase 354 plan added a Claude Code session-bridge; the architecture is unchanged. Classification carried forward per the disposition ledger's own instruction, not silently dropped. |

None of these five legacy findings were silently excluded: each carries a named owning plan
in the disposition ledger's Section 5 (legacy localhost review findings), and each has an
explicit recheck result here from a fresh browser-level capture, not an assumption.

<!-- gsd:write-continue -->
