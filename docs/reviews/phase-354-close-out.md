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

## Coverage

One row per production area, per the disposition ledger's own coverage map (Section 6),
restated with this close-out's own confirmation of what each plan actually shipped.

| Production area | Examined by | What remains unexamined |
|---|---|---|
| MCP tools and resources (`lib/mcp/`) | SYS-01, SYS-04, SYS-05, SYS-08, THEO-01 (Plans 354-02, 354-05, 354-09, 354-10, 354-14, 354-15); concurrency proven live in Plan 354-16 (K1-K4) | Nothing named by an ID; `lib/mcp/adapter-client.cjs`'s own HTTP-transport daemon lifecycle was exercised only indirectly (via `tests/test-248-surface-probes.cjs`, a prior phase), not re-probed here |
| Local graph (`room.db`, `navigation.cjs`, `write-lock.cjs`, `graph-ops.cjs`) | SYS-02, SYS-08 (Plans 354-02, 354-04); cross-process contention proven live in Plan 354-16 (K2, 4/5 forked writers observed retrying on real lock contention) | Nothing named by an ID |
| Brain client and egress (`brain-client.cjs`, `brain-router.cjs`, `part8-egress-guard.cjs`) | THEO-01, THEO-03, THEO-04 (Plans 354-06, 354-09, 354-10, 354-12, 354-17, 354-18) | THEO-02's provider-consumer half (Theo's own repository, out of scope; BLOCKED on Phase 351) |
| Views/editor and localhost POC (`lib/mcp/tools/views.cjs`, `docs/reviews/localhost-poc/`) | SYS-01, SYS-06 (Plans 354-05, 354-07, 354-08, 354-11); browser-plus-MCP concurrency on the SAME document proven live in Plan 354-16 (K4) | Nothing named by an ID within the POC's own scope |
| Legacy dashboard (`scripts/serve-dashboard-live`) | SYS-06-adjacent Host-check fix only (Plan 354-08 Task 3) | `ROOM_DATA` templating, file-change visible refresh, mobile-layout overflow -- all three CONFIRMED still open this close-out (see "Legacy localhost review recheck" above), never targeted by any SYS/THEO id |
| Chat panel and export (`lib/chat/chat-panel.js`, `scripts/generate-presentation.cjs`) | SYS-03 (Plan 354-07) | Exported-presentation CSP (accepted residual, see below); `scripts/generate-presentation.cjs`'s own inline-script generation was inspected for CSP but not changed |
| Release and doctor tooling (`scripts/release.sh`, `scripts/doctor.cjs`) | THEO-02, THEO-04, SYS-07 (Plans 354-12, 354-13, 354-18) | THEO-02's Theo-side consumer workflow (out of scope) |
| Acceptance runner | SYS-07 (Plan 354-13) | Nothing named by an ID; classification is WORKING per the RCA |
| Hooks, installation/update, commands, skills, pipelines | Not independently re-probed this phase | Explicitly out of scope per `354-CONTEXT.md`'s cross-phase ownership rules (Phase 235/241 hook reliability, Phase 250/341 install/update, THEO-01's blast radius covers command dispatch only where `tool-router.cjs:1802` is reached) -- never silently dropped, named here as unexamined by Phase 354 |

## Residual risks

Explicitly accepted, not fixed by this phase (each traces to a decision record or an
in-scope-boundary call already made and reasoned about during execution):

1. **`brain_query` free-form Cypher on its existing path.** THEO-03/D-354-EGR closed the
   free-form `brain_ask`/`brain_search` classification gap (closed-vocabulary structural proof),
   but `brain_query`'s own Cypher-string surface was not restructured -- it is gated by the same
   typed-question enforcement point (`_typedFreeformGate`) per Plan 354-06's `key-files`, and
   continues to rely on that gate rather than a schema-typed query builder.
2. **Exported presentations have no CSP, relying on escaping.** Plan 354-07 made chat-panel and
   generative-tools rendering inert via escape-first markdown and strict hex-only color
   validation, but did not add a Content-Security-Policy meta tag to
   `scripts/generate-presentation.cjs`'s exported HTML (which inlines the same scripts by
   design, with inline `<script>` blocks a CSP would need to allowlist). Accepted residual per
   354-07-SUMMARY.md's own key-decisions: "escaping is the enforced control per T-354-14b."
3. **The check-then-write race window accepted in Plan 354-05.** `room-path-containment.cjs`
   re-asserts containment after `mkdirSync` (closing the TOCTOU window between the lexical check
   and the directory creation), but the plan's own threat model (T-354-10) accepts a residual: a
   concurrent LOCAL attacker with write access to the room directory itself, between the
   post-mkdir re-assert and the final atomic write. Not exploitable by a remote or sandboxed
   caller; requires local filesystem write access to the room already.
4. **A live but hung lock owner requires `breakLock`.** Plan 354-04's write-lock fix makes
   liveness (never age) the sole takeover truth -- a live owner is never automatically displaced,
   by design (T-354-08 accepted risk). A genuinely hung-but-alive owner (not crashed, not
   releasing) requires the new operator-only `breakLock(roomDir, {expectedToken, reason})`
   escape hatch; there is no automatic caller anywhere in the repo, deliberately.
5. **Host UI checks not run.** `tests/test-354-concurrency-surfaces.cjs` (Plan 354-16) proves
   CLI-equivalent, MCP-stdio-equivalent and browser-equivalent concurrency at the transport and
   filesystem/database layer, and prints the required `HOST UI NOT RUN: Claude Desktop app,
   Cowork app` line. No actual Claude Desktop app or Cowork VM session was driven by this phase;
   that is a stated, explicit deferral, not a silent gap.
6. **THEO-02's provider consumer is absent.** Phase 351 (owner `jsagir/theo`) is registered but
   still has 0 plans as of this close-out. The plugin side is fully proven and the drift is
   fresh-measured (6 betas of stamp mismatch), but nothing in this repo can make Theo's own
   `.github/workflows/` gain a `theo-resync` consumer -- that is explicitly Phase 351's task, per
   `354-CONTEXT.md`'s "never patch or deploy that repository incidentally from this plugin phase"
   rule.

## Decisions

- **D-354-SYS05** (`extract_shallow` is an honest pure parser, not governed persistence):
  implemented exactly as decided, Plan 354-15. Impact: the tool description, response fields
  (`persisted:false`, `persist_via:'claim_write'`), connector `hitl_why` and
  `agents/larry-extended.md` all now agree; `claim_write` is named as the one governed
  persistence step. No navigator veto was raised before wave 3 ran.
- **D-354-EGR** (Brain free-form egress forwarded only when the whole string is proven
  closed-vocabulary methodology): approved 2026-09-23 (354-CONTEXT.md Addendum) before wave 3
  ran, implemented unchanged in Plan 354-06. Impact: a `brain_ask`/`brain_search` string
  containing any token outside the closed vocabulary (a venture name, a date, a possessive) is
  refused with the existing honest `egress_blocked` envelope instead of forwarded with a
  disclosure; plugin-internal templated questions keep working (each proven against the
  vocabulary). Live-certified in Plan 354-12 (9/9 records against the real Theo origin).
- **THEO-04 navigator ruling** (document + procedural discipline, not removal, not a code fix):
  implemented exactly as ruled, Plan 354-18. Impact: CLAUDE.md and `docs/GROUNDING-SOURCES.md`
  now state the routing rule explicitly (guarded `mindrian-brain` shim for any Brain-adjacent
  question carrying plugin-user or venture-room content; raw `theo` only for Theo's own
  repository/schema/code questions); `scripts/doctor.cjs --acceptance` gained a WARN-only,
  zero-network advisory check naming a live dual-MCP-server co-registration every run. The
  underlying structural exposure (two independent MCP registrations, one of them ungated) is
  unchanged -- MITIGATED-DOCUMENTED, not fixed.
- **TypeSafe/Jev framework-command-ledger extension** (navigator-directed, 2026-09-23, "any
  part that falls into the typesafe ai realm of capabilities, utilize it"): implemented in
  Plan 354-17, sitting on top of (not instead of) Plan 354-09's exact-slug safety check. Impact:
  `scripts/build-framework-command-ledger.cjs` ships a sibling dev-time-scored, offline-checkable
  lookup consulted only after the exact-match safety check fails. The committed ledger ships
  `--offline-seed` (uncalibrated) by deliberate design and therefore promotes zero candidates
  today -- infrastructure, not delivered recall, until a navigator runs a jev-scored build with a
  real `TYPESAFE_API_KEY` pre-release. Not a bug; documented and tested as the intended day-one
  shape (T-neg-seed).

## Deployment status

**Fixed on `main`, not live until released and picked up.** Every commit cited in this
close-out and in the disposition ledger's Final disposition section (Section 11) is on this
repository's `main` branch. No release was cut by this phase -- `scripts/release.sh` was not
invoked with a real version argument at any point in Phase 354's execution (only
`--dry-run` previews, exercised read-only by Plan 354-12's THEO-02 verification and by
`tests/run-all-349.sh`'s own regression legs).

Per this repository's own release process (`docs/RELEASE-CEREMONY-RULING-SYSTEM.md`,
`.claude/includes/release-process.md`): a `main` commit is not live until a version is cut
(`scripts/release.sh <version>`, all five lockstep files updated, the git tag pushed) AND a
user's install picks it up (`/plugin marketplace update` then
`claude plugin update mos@mindrian-marketplace` -- third-party plugins never auto-push). No
user is running any Phase 354 fix yet. The next release cut should include every commit this
phase produced; `scripts/release.sh`'s own Theo-notify step (Step 5.6) will fire a
`repository_dispatch: theo-resync` at that time, though THEO-02's disposition above already
establishes that event currently has no consumer on Theo's side.
