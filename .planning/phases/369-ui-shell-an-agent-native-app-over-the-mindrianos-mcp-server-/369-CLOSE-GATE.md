# 369 Close Gate (plan 369-31, Task 1)

Date of the run: 2026-10-04. Node v22.23.1 (nvm), Linux 6.18.33.2 WSL2 aarch64, 12 logical cores. Version of record: 2.0.0-beta.56 (`node lib/core/repo-version.cjs`), no version bump, no release run.
Phase base (the phase plan commit, before any 369 execution commit): `586f6b812`. Plan base (HEAD when this plan started): `5c584e034`. Head at the gate run: `4a82597d4` (Phase 369.1 commits were landing on the same tree in parallel; none of them touches a 369 file).

Rule applied throughout: a row or a status flips only on a command that ran in this session. A red that the phase caused is named as caused by the phase. A red that predates the phase is named with its owner. Nothing here is hidden and nothing here was fixed by this plan.

## Close verdict

Phase 369 is CLOSED WITH NAMED EXCEPTIONS, not clean-green. The shell, the feed, the gate button, the recovery contract, the human-only proof and the canon checks all ran and passed. Three things are red because of 369's own plans and are carried forward by ruling, not fixed here (see "Reds this phase caused"). `nyquist_compliant` stays false for that reason (see 369-VALIDATION.md).

## Gate commands (the plan's nine, in order)

| # | Command | Exit | Summary |
|---|---------|------|---------|
| 1 | `bash tests/run-all-369.sh` | 1 | PASS=54 FAIL=1 SKIP=1. The one FAIL is `regression: release payload ceiling` (sharp install script, see below). The one SKIP is `369: installed layout exact floor (TS369-04)` (ENV GAP). Every 369 leg PASSED, including all four core e2e legs and the long-dash guard. |
| 2 | `bash tests/run-all-267.sh` | 1 | PASS=28 FAIL=3 SKIP=3. FAIL: `267: lockstep (MCPV2-19)` (Check 1 and Check 2: package.json and package-lock.json differ), `267: zod4 contract (MCPV2-03)` (one description diff, `tool:room_list`), `regression: release payload ceiling`. SKIP (ENV GAP): CLI live wire probe (MCPV2-13, opt-in), HTTP flag-OFF multi-request and rebinding (MCPV2-05, MCPV2-17), process lifecycle (MCPV2-14). |
| 3 | `bash tests/run-all-238.sh` | 0 | PASS=10 FAIL=0 SKIP=0 |
| 4 | `bash tests/run-all-198.sh` | 1 | Passed 15, Failed 1, Skipped 0. The FAIL is `SPEC-5 hooks/ adapter-only budget` (scripts/on-stop 618 against a 570 budget). |
| 5 | `node scripts/build-connector-registry.cjs --check` | 0 | `connector-registry: OK` |
| 6 | `node scripts/build-orchestration-projection.cjs --check` | 0 | `orchestration-projection: OK` |
| 7 | `node scripts/check-render-coverage.cjs` | 0 | 17 covered, 0 excluded, 0 gap; md-keyspace 198 wired, 2 excluded, 0 unwired (200 declaring commands) |
| 8 | `node scripts/check-shape-declaration.cjs --check` | 0 | advisory lint (WARN lines enumerate the declared-shape conflicts; never a block as of Phase 210) |
| 9 | `node scripts/doctor.cjs --acceptance` | 1 | 21 of 22 points passed. The one failure is `harness-policies`: the single failing policy is `release-payload-ceiling` (the same sharp finding as leg 1). |

Run order note: legs 2 to 9 ran after leg 1 completed; the core e2e legs were then re-run standalone (table below) with the host quiet (load average 0.6 to 1.5 at start of each).

## Core e2e legs (the nyquist test)

Each ran in the aggregator run (leg PASSED means exit 0; the aggregator reports exit 77 as SKIPPED, and none of these did) and again standalone this session.

| Leg | Aggregator leg | Standalone exit | RAN or SKIPPED |
|-----|----------------|-----------------|----------------|
| `tests/e2e-369/replica.cjs` | PASSED, all 12 arms | 0 (29 s) | RAN, passed |
| `tests/e2e-369/gate-button.cjs` | PASSED, all 15 arms | 0 (27 s) | RAN, passed |
| `tests/e2e-369/egress-and-canon.cjs` | PASSED, C1 through C11 in 33 s | 0 (34 s) | RAN, passed |
| `tests/e2e-369/journey.cjs` | PASSED, steps 1 to 7 in 16 s | 0 in 8 of 9 standalone runs; 1 run exited 1 | RAN, passed in the close-gate run; see "Flakes" |
| HTTP arm 8 of `tests/test-369-human-only.cjs` | PASSED, PASS=10 FAIL=0 SKIP=0 | 0 (3 s); output line "PASS 8 over real HTTP" | RAN, passed |

## SKIPPED (ENV GAP) legs, by name

- `369: installed layout exact floor (TS369-04)`: no Node 22.18.0 binary (`/home/jsagi/.nvm/versions/node/v22.18.0/bin/node` is missing) and the Docker CLI is absent. `node tests/test-369-installed-layout.cjs --exact-floor` exits 77. The default installed-layout leg (7 passed, 0 failed) ran on Node 22.23.1.
- `267: CLI live wire probe, opt-in (MCPV2-13)`, `267: HTTP flag-OFF multi-request and rebinding (MCPV2-05, MCPV2-17)`, `267: process lifecycle (MCPV2-14)`: Phase 267's environment-gated legs, not 369's. MCPV2-13's human Claude Desktop smoke remains owed by the Phase 267 follow-ons.

## Reds this phase caused (named as caused by 369, carried by ruling, not fixed here)

| Red | Where it shows | Caused by | Carried by |
|-----|----------------|-----------|------------|
| Release payload ceiling: `npm-shrinkwrap.json declares hasInstallScript:true for: node_modules/sharp` | run-all-369 regression leg, run-all-267, doctor `harness-policies`, VALIDATION row 369-28-02 | 369-19: the navigator's 2026-10-03 ruling "Next as a per-machine dependency" put `next` in the root manifest and `sharp` rides in as its optional dependency | Phase 369.1 D-16 and D-16a ("prune", navigator 2026-10-04): `scripts/release-lib/prune-shrinkwrap.cjs` at the cut. Plan 369-28's test-369-ui-dist-fresh arm 7 holds it as a KNOWN RED that passes only while sharp is the sole finding. |
| `267: lockstep (MCPV2-19)` Check 1 and Check 2: `package.json` and `package-lock.json` differ | run-all-267 | 369-19: `next`, `react`, `react-dom` were added to package.json and npm-shrinkwrap.json; `package-lock.json` is stale by design between releases (BAKEOFF-DECISION: "left alone", the release's shrinkwrap step regenerates) | No owner assigned yet. Reported to the orchestrator in the plan SUMMARY. |
| `267: zod4 contract (MCPV2-03)`: one description diff, `tool:room_list` | run-all-267, VALIDATION row 369-13-03 | 369-22: the D-03 two sentences ride in the `room_list` description (navigator Q2, 2026-10-03); the pinned accepted diff set was not refreshed | No owner assigned yet. Reported to the orchestrator in the plan SUMMARY. The wire snapshot and test-270 were refreshed by 369-22; the zod4 pinned set was not. |
| Stale assertion in the retired agent-native candidate's `--built` smoke: `approveDecision` expects a second approve of the same gate to answer `answered:false` ("single use"); it now answers `answered:true` | `node tests/test-369-bakeoff-agent-native.cjs --built` exits 1 (12 passed, 1 failed); VALIDATION row 369-16-02 | 369-26 (GREC369-02, idempotent replay by gate id): a replayed answer is now ok and replayed by design | Not run by the aggregator (it runs the static arms only). The candidate lost the bake-off (BAKE369-04). A one-line assertion update is the fix; no owner assigned. |

## Reds that are not this phase's (named, with owner)

| Red | State before the phase | Owner |
|-----|------------------------|-------|
| test-198-adapter-budget (`SPEC-5 hooks/ adapter-only budget`, scripts/on-stop 618 against 570) | Red since July: the last change to `scripts/on-stop` is 2026-07-30 (`01c3ca19d`), nothing in 369 touches it | Pre-existing, unowned |
| test-237 (MUTATION build), test-345-gate-ratify, test-363-mcp-tool M3 cascade, test-365-floor-gate, test-366 R6b, test-353 filing-gate EVENT_TYPES size | Cascaded from Phase 289's ruled behaviour changes | Routed to a post-369 `/gsd-quick` (orchestrator) |
| test-354 framework ledger (beta.48 against beta.56) | Stamp drift | Pre-existing, unowned |

These were not run by this plan's nine commands (they sit outside the nine aggregators' legs) and are named from the orchestrator's measured state at the start of the plan, not re-measured here.

## Flakes observed (counted, not hidden)

- `tests/e2e-369/journey.cjs`, step 6 (restart both servers and recover): 1 of 10 runs this session failed (`timeout waiting for the read copy to hold all 19 items of room-x`, 60 s, the page showing the Work screen with "Nothing changed since your last visit"). The aggregator run (earlier) passed; the failing run was the first standalone run, started right after egress-and-canon.cjs finished; the eight standalone runs after it passed (gate click to recorded 58 to 159 ms, restart catch-up 2741 to 3666 ms, lost writes 0 in every run). Load average was 0.6 on the next check and no other test was running, so it is probably not the known host-load flake, but the load at the moment of failure was not captured. Cause not established. Plan 30 recorded six clean runs. It is a close gap for the gap planner, not a pass to be assumed.
- `tests/e2e-369/views.cjs` arms 11 and 12: known load flake, about 1 in 5 under host load, green standalone (plan 29). It passed in this run.
- `tests/test-369-shell-actions.cjs`: 1 transient run showed PASS=11 FAIL=6 inside the VALIDATION row 369-32-02 sweep; the same file passed in the aggregator, in the 369-32-01 row, and three further times back to back (PASS=17 FAIL=0). Cause not established.

## Research trail: one copy filed, one blocked

- Filed: `/home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md` (the source-of-record mirror; dated 2026-10-04 because the close happened after 2026-10-02, so the plan's `2026-10-02-` file name was not used).
- Blocked: `/home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369-ui-shell-close-out.md`. The Write tool was refused by the mos `write-scope-check` hook ("write to rethinking-mindrianos denied. Active room is egain-des-liquid-conductor. To authorize, run: /mos:rooms switch rethinking-mindrianos"). Switching the active room is a user-state change and the hook's authorization is the user's to give, so it was not worked around (no Bash copy, no room switch). Once authorized, the room copy is a plain `cp` of the mirror file; then `cmp` of the two files must exit 0 (VALIDATION row 369-31-02).
- The orchestrator's brief named the mirror as `/home/jsagi/dev/MindrianOS/research/`; that directory does not exist (`/home/jsagi/dev/MindrianOS` is a separate checkout last touched in March 2026 and has no `research/` directory). The plan's path and the Phase 364 precedent commit both use `/home/jsagi/MindrianOS/research/`, which is where the mirror was written.

## Locked decisions D-01 to D-19 traced to plan and proof

| Decision | Implemented by | Proof |
|----------|----------------|-------|
| D-01 Canon v3 scope: shell only, scoped SKILL.md exception, bundled fonts, no outside host | 369-09 (exception), 369-20 (tokens, bundled fonts, primitives), 369-29 | `node tests/test-369-canon-scope-docs.cjs` (leg PASSED); `node tests/test-369-canon-skin.cjs` (30 passed); `node tests/e2e-369/egress-and-canon.cjs` C1 (1,095 requests, only 127.0.0.1), C2 (262 dist files, 0 hits), C6 (four fonts loaded from 127.0.0.1) |
| D-02 MCP App views untouched, orphan page parked, C10/C11 seed, C12 retired | 369-09 | Three checks, run this session. (1) `ls .planning/seeds/SEED-*-mcp-app-html-dark-theme-and-cdn-debt.md` found `SEED-112-mcp-app-html-dark-theme-and-cdn-debt.md`. (2) `head -3 lib/mcp/app-html/mindrian-platform.html \| grep -c "PARKED 2026-10-02 (Phase 369, D-02)"` printed 1. (3) `git diff --stat 586f6b812..HEAD -- lib/mcp/app-views.cjs lib/mcp/app-html/` shows one file changed, 1 insertion: `lib/mcp/app-html/mindrian-platform.html` (the parked header line); `lib/mcp/app-views.cjs` has no diff. |
| D-03 reach: user's machine only, Desktop and Cowork show the one plain line, never simulate | 369-22 (launcher, command doc, `room_list` description), 369-LAUNCH-RULING.md (Q1 extend /mos:dashboard, Q2 desktop-sentences-tool-description, 2026-10-03) | `node tests/test-369-launch-surface.cjs` (17 passed); navigator approved the two sentences on both surfaces, 2026-10-04 (369-MANUAL-VERIFICATION.md) |
| D-04 session indicator co-designed with the navigator | 369-10 (brief, signed note, 2026-10-03: Q1 A, Q2 B, Q3 B, Q4 A), 369-24 (component) | `node tests/test-369-indicator-note.cjs`; `node tests/test-369-session-indicator.cjs` (11 of 11 arms) |
| D-05 same vertical slice built twice, production-built, judged on nine measures | 369-15 (workroom), 369-16 (agent-native), 369-18 (harness) | `node tests/test-369-bakeoff-workroom.cjs` (PASS=9), `node tests/test-369-bakeoff-agent-native.cjs` (static arms 11 passed), `node tests/test-369-bakeoff-measure.cjs` (PASS=12); `ui/bakeoff/COMPARISON.md` and `ui/bakeoff/results.json` |
| D-06 every read and write through the action layer; GPL xl-* exporters out | 369-15, 369-16, 369-08, 369-32 | Hygiene arms in the two bake-off tests (no xl-* package, no file-system import, no AI Gateway route); `node tests/test-369-shared-core.cjs` (PASS=13); `node tests/test-369-shell-actions.cjs` (PASS=17) |
| D-07 bake-off ends in a Decision Gate to the navigator, never an executor verdict | 369-18 (gate), 369-19 (RULE 8 ruling), 369-28 | 369-BAKEOFF-DECISION.md: "workroom (Recommended)" with the default transplants (2026-10-03); RULE 8 ruling "Next as a per-machine dependency" (2026-10-03). Honest note: this ruling is the origin of the sharp, lockstep and install-size consequences above. |
| D-08 v1 is a review-and-decision surface; local auth, room isolation, safe rendering, offline assets | 369-19 (security layer), 369-25, 369-30 | `node tests/test-369-shell-server.cjs` (35 passed); `node tests/e2e-369/journey.cjs` (the recoverable journey); hostile-markup document rendered inert (`window.__pwned` undefined) |
| D-09 first screen: question, what changed, next decision; never an invented history | 369-25 | `node tests/test-369-views-copy.cjs` (24 passed); `node tests/e2e-369/views.cjs` (12 of 12 arms) |
| D-10 Work / Evidence / Decisions / Deliverables, Rooms as selector, Status secondary | 369-20 (frame), 369-25 (views) | `node tests/test-369-canon-skin.cjs`; `node tests/e2e-369/views.cjs` |
| D-11 task-centered; tile never carries a state alone; one decision per view | 369-20 (primitives), 369-25, 369-27, 369-29 | egress-and-canon C7 (every `[data-tile]` on 31 captures carries its written status); gate-button e2e (15 arms) |
| D-12 graph is a secondary text tab | 369-25 | `node tests/test-369-views-copy.cjs`; `node tests/e2e-369/views.cjs` |
| D-13 BlockNote displays only; no second direct-save path | 369-25, 369-13 (`room_artifact`), 369-32 (write actions not registered) | VALIDATION row 369-25-02 command (`editable={false}` present, no change or save or PUT handler under the views) exit 0; `node tests/test-369-room-artifact.cjs` (PASS=8) |
| D-14 local Claude adapter proven first; no second model key | 369-14, 369-08 (proposal contract) | 369-ADAPTER-RULING.md: A1 ruled `room-proposal` (2026-10-03), the shell never spawns `claude`; `node tests/test-369-claude-adapter.cjs` (PASS=9) |
| D-15 exposure policy; human-only `gate_answer` and truth-claim confirmation | 369-08, 369-21, 369-32 | `node tests/test-369-human-only.cjs` (PASS=10), including HTTP arm 8 over real HTTP; `node tests/test-369-shell-actions.cjs` (PASS=17); `node tests/test-369-shared-core.cjs` |
| D-16 Phase 289 first; consume only after every check; durable and replayable | 369-26, 369-27 (after Phase 289), `tests/test-369-289-precondition.cjs` | `node tests/test-369-289-precondition.cjs` (precondition holds by behaviour); `node tests/test-369-gate-recovery.cjs` (PASS=11); `node tests/test-369-gate-web-mapping.cjs` (22 passed); `node tests/e2e-369/gate-button.cjs` (15 arms) |
| D-17 TypeScript allowed plugin-wide; erasable-only; Node floor 22.18.0; hooks and server stay .cjs; UI built at release | 369-01, 369-02, 369-03, 369-28 | `node tests/test-369-constitution.cjs` (7), `test-236-engines-floor` (5), `test-369-ts-erasable-gate` (8), `test-369-walled-manifest` (8), `test-369-installed-layout` (7; exact-floor leg SKIPPED, ENV GAP), `test-369-hook-require-graph` (5; 59 roots, 328 reachable files, 0 .ts), `test-369-ui-dist-fresh` (11 passed, 1 known red). Hook cold start p50 and p95 recorded in 369-HOOK-COLD-START.md. |
| D-18 durable change feed before any RxDB; writer inventory; `room_changes`; one additive SSE kind; cross-process wake-up | 369-04, 369-05, 369-06, 369-11, 369-12, 369-13, 369-17, 369-23 | `test-369-change-log-ddl` (11), `test-369-tx-ownership`, `test-369-writer-inventory` (29), `test-369-change-log-cross-process` (6), `test-369-change-log-compaction` (8), `test-369-room-changes` (11), `test-369-sse-room-changed` (7), `test-369-sse-vocab-pin` (4), `tests/e2e-369/replica.cjs` (12 arms) |
| D-19 sessionful acceptance, legacy path explicit, no discovery shim | 369-07 (also 369-08, 369-32) | `node tests/test-369-sessionful-acceptance.cjs` (PASS=6); `node tests/test-369-daemon-env-scrub.cjs` (PASS=3); 369-SESSION-CONTRACT.md |

## Navigator rulings traced

- Chassis: workroom (D-07, 369-BAKEOFF-DECISION.md, "workroom (Recommended)", 2026-10-03), then RULE 8 "Next as a per-machine dependency" (2026-10-03, plan 19).
- A1 adapter: `room-proposal` (369-ADAPTER-RULING.md, 2026-10-03).
- Session indicator: signed (369-SESSION-INDICATOR-DESIGN.md, Q1 A, Q2 B, Q3 B, Q4 A, 2026-10-03).
- Launch surface: Q1 extend /mos:dashboard, Q2 desktop-sentences-tool-description (369-LAUNCH-RULING.md, 2026-10-03).
- Font packages: approved at 5.3.0, JetBrains Mono kept (369-20, 2026-10-03).
- Manual verification: "approved" (369-MANUAL-VERIFICATION.md, 2026-10-04): click test, Canon v3 visual review, Desktop and Cowork line. No host build numbers were reported.
- The sharp payload ceiling: ruled into Phase 369.1 D-16 and D-16a "prune" (2026-10-04).

## Gaps for `/gsd-plan-phase 369 --gaps`

1. The shipped shell has no browser control that raises a gate. `askClaude` exists but nothing in `ui/shell/client` calls it; a default `launch.cjs start` runs `MOS_PROPOSAL_SOURCE=fixed` and answers `no_proposal`. The ADAPTER-RULING hop "the shell raises the gate on the browser session" is not built; the journey and the navigator mode call the action directly. A person using the shipped shell as launched cannot start the Approve flow from the browser alone. (369-MANUAL-VERIFICATION.md, Gaps item 1.)
2. After a shell restart an old gate id shows "This decision is no longer open" instead of "This decision was already recorded", because the shell keeps gate records in memory. The room itself replays correctly (one node). The restart re-answer wording is the gap. (369-MANUAL-VERIFICATION.md, Gaps item 2.)
3. journey.cjs step 6 intermittent timeout (1 of 10 runs this session). Cause not established.
4. The three phase-caused reds above (sharp is already owned by 369.1 D-16; lockstep and zod4 `room_list` have no owner; the agent-native `--built` assertion is stale).
5. Composition observations the navigator accepted without change (not gaps): at 390 px the "Stay here" action wraps to two lines; the Work screens collapse the 8 plus 4 layout to one column.

## Open navigator items (listed, not closed)

- The 404-page copy (`NOT_FOUND` in `ui/shell/client/copy.ts`, 369-20).
- The duplicate "Reconnect now" placement (header and connection-lost banner) and the "Catching up" fallback wording when the copy has no change number yet (369-24).
- Research A5 (Phase 289's research): whether a rank-derived recommendation falls outside the 0.70 Brain-confidence rule for F.1 Mode A; if the canon reading requires 0.70 for any marker, rank-only recommendations need a separate ruling. The 369-14 adapter derives its recommendation from the room's own record, so it inherits the question.
- MCPV2-13's human Claude Desktop smoke (owed by the Phase 267 follow-ons, not this phase's gate).

## CHANGELOG hand-off (Phase 364 plan 13, follow-on A8)

`CHANGELOG.md` is clean in the working tree (`git status --short CHANGELOG.md` prints nothing) and carries Phase 369's own `[Unreleased]` lines (plans 01 and 28, already committed). This close edits nothing in it. From the commit of 369-31-SUMMARY.md, Phase 369 holds no pending claim on `CHANGELOG.md`, which is the gate 364-13 named; whether Phase 364 proceeds or defers its `/mos:scientific-roadmap` bullet is 364-13's decision with the orchestrator, not made here.

## Not done here, by instruction

STATE.md and ROADMAP.md (the orchestrator's), the Phase 369.1 files and DPI rows, the root package.json, any version bump or release, and the fixes for every red listed above.

---

## Gap closure re-run (369-47)

Date: 2026-10-04. Node v22.23.1 (nvm), Linux 6.18.33.2 WSL2 aarch64, 12 logical cores, version of record 2.0.0-beta.56 (`node lib/core/repo-version.cjs`), no version bump, no release run. Plans 369-33 to 369-46 had all landed (every SUMMARY present). HEAD for every command below: `d7817c712` (this plan's aggregator commit; no 369 or peer commit landed under lib, bin, scripts or ui while the commands ran). Rule as before: a status flips only on a command that ran in this session; a red is named with its owner or its flake count, never hidden.

### Close verdict (gap closure)

The gap closure is CLOSED. Every gate command is green on a clean run, the four phase-caused reds of the first close are green, the three gaps of 369-VERIFICATION.md are closed by measured lines, and what is open is listed with an owner or as a navigator item. Two flakes (one in run 1 of `run-all-369.sh`, one in run 1 of `run-all-267.sh`) are counted below. One step belongs to the orchestrator: the room copy of the research entry (hook-blocked here).

### Gate commands (in the order run)

| # | Command | Exit | Summary |
|---|---------|------|---------|
| 1a | `bash tests/run-all-369.sh` (run 1) | 1 | PASS=62 FAIL=1 SKIP=1. The one FAIL is `369: Phase 289 precondition probe`: its part 3 re-runs `tests/test-289-cli-card-dual-era.cjs`, which failed its process-hygiene leg inside the aggregator. A separate probe script of mine (node children plus a copy of the dist) was running at that moment, so I cannot exclude it as the cause; nothing else was started by me. Standalone: the dual-era test PASS=6 FAIL=0 twice, the precondition probe PASS. |
| 1b | `bash tests/run-all-369.sh` (run 2, nothing else running, load 1.2) | 0 | PASS=63 FAIL=0 SKIP=1. The SKIP is `369: installed layout exact floor (TS369-04)` (ENV GAP, as at 369-31). Of the 48 `369:` legs 47 PASSED and 1 SKIPPED; all 15 regression legs and the long-dash guard PASSED; the eight legs this plan registered all ran. |
| 2a | `bash tests/run-all-267.sh` (run 1) | 1 | PASS=30 FAIL=1 SKIP=3. FAIL: `267: local server dual era (MCPV2-02)` on its process-hygiene leg ("local server process(es) started by this test survived: 1901555"); the pid was gone when I looked, nothing of mine was running concurrently. |
| 2b | `bash tests/run-all-267.sh` (run 2) | 0 | PASS=31 FAIL=0 SKIP=3. Zod4 contract, lockstep, CIRS gates, registration, dual-era and the payload ceiling regression leg all PASSED. The three SKIPs are Phase 267's ENV GAP legs (CLI live wire probe MCPV2-13, HTTP flag-OFF MCPV2-05 and MCPV2-17, process lifecycle MCPV2-14). `tests/test-267-mcpv2-dual-era.cjs` alone: 3 of 3 runs PASS=5. |
| 3 | `bash tests/run-all-238.sh` | 0 | PASS=10 FAIL=0 SKIP=0 |
| 4 | `bash tests/run-all-289.sh` | 0 | PASSED=47 FAILED=0 SKIPPED=0 KNOWN=1 (the Phase 369 precondition probe leg PASSED) |
| 5 | `bash tests/run-all-198.sh` | 1 | Passed 15, Failed 1: `SPEC-5 hooks/ adapter-only budget` (scripts/on-stop 618 against 570), unchanged since July, not 369's |
| 6 | `node scripts/build-connector-registry.cjs --check` | 0 | OK |
| 7 | `node scripts/build-orchestration-projection.cjs --check` | 0 | `orchestration-projection: OK` |
| 8 | `node scripts/check-render-coverage.cjs` | 0 | 17 covered, 0 gap; md-keyspace 198 wired, 2 excluded, 0 unwired |
| 9 | `node scripts/check-shape-declaration.cjs --check` | 0 | advisory lint, never a block |
| 10 | `node scripts/doctor.cjs --acceptance` | 0 | 22 of 22 points passed (`harness-policies` green: `release-payload-ceiling` passes) |
| 11 | `node scripts/check-release-payload-ceiling.cjs --check` | 0 | OK, 0 findings (2276 entries, 43,784,988 bytes unpacked, 13,242,835 packed) |
| 12 | `node scripts/build-ui-shell.cjs --check` | 0 | fresh, source hash 539768ed075ce362, 270 dist files verified |
| 13 | `node ui/shared/scripts/gen-mcp-adapter.mjs --check`, `node scripts/check-tool-honesty.cjs --check` | 0, 0 | adapter up to date; 45 tools, 0 high-risk |
| 14 | `node tests/test-369-bakeoff-agent-native.cjs --built` | 0 | 13 passed, 0 failed (static arms 11 passed) |
| 15 | `MOS_369_STRICT_CEILING=1 node tests/test-369-ui-dist-fresh.cjs` | 0 | 18 passed, 0 failed, 0 skipped |
| 16 | `node tests/e2e-369/journey.cjs` x 5 standalone | 0 x 5 | 5 of 5 pass, 0 void (table below) |
| 17 | `cmp` of the two research copies | 0 before the addendum | After the gap-closure addendum the mirror and the room copy differ by design (the room write is refused by the write-scope hook); see "Research trail" |

### Core e2e legs (the nyquist test)

| Leg | Aggregator leg (run 2) | RAN or SKIPPED |
|-----|------------------------|----------------|
| `tests/e2e-369/replica.cjs` | PASSED, all 12 arms | RAN, passed |
| `tests/e2e-369/gate-button.cjs` | PASSED, all 18 arms | RAN, passed |
| `tests/e2e-369/egress-and-canon.cjs` | PASSED, C1 through C11 in 35 s (1,143 requests, hosts 127.0.0.1 only) | RAN, passed |
| `tests/e2e-369/journey.cjs` | PASSED, steps 1 to 8 in 22 s | RAN, passed; 5 of 5 standalone below |
| HTTP arm 8 of `tests/test-369-human-only.cjs` | PASSED, PASS=10 FAIL=0 SKIP=0 | RAN, passed |
| `tests/e2e-369/views.cjs` | PASSED, all 15 arms | RAN, passed |

### Five standalone journey runs (HEAD d7817c712, `git status --short -- lib bin scripts ui` empty before and after each, no STEP-EVIDENCE, DAEMON-EXIT-UNEXPECTED or VOID-RUN line)

| Run | gate_click_to_recorded_ms | raised_to_listed_ms | restart_catch_up_ms | lost_writes | answered_elsewhere_replays |
|-----|---------------------------|---------------------|---------------------|-------------|----------------------------|
| 1 | 95 | 813 | 2798 | 0 | 1 |
| 2 | 73 | 820 | 2811 | 0 | 1 |
| 3 | 85 | 814 | 2805 | 0 | 1 |
| 4 | 79 | 812 | 2818 | 0 | 1 |
| 5 | 60 | 814 | 2801 | 0 | 1 |

Medians: 79 ms, 814 ms, 2805 ms. With the ten runs of plan 369-46 (medians 66.5 / 809 / 2805, lost writes 0 in every run) that is 15 of 15 non-void passes since the step 6 fix work. The eight steps (sign-in with no printed code, room, evidence, decide through Ask Larry, decide a gate raised in Claude Code, persisted, restart and recover with "already recorded" on the old gate id, offline) all printed PASS in every run.

### SKIPPED (ENV GAP) legs, by name

- `369: installed layout exact floor (TS369-04)`: no Node 22.18.0 binary and no Docker CLI; `--exact-floor` exits 77. The default installed-layout leg ran (7 passed, 0 failed).
- `267: CLI live wire probe, opt-in (MCPV2-13)`, `267: HTTP flag-OFF multi-request and rebinding (MCPV2-05, MCPV2-17)`, `267: process lifecycle (MCPV2-14)`: Phase 267's own environment-gated legs. MCPV2-13's human Desktop smoke remains a navigator item.

### Reds this phase caused, and their state now

| Red at 369-31 | Caused by | State now (measured this session) |
|---------------|-----------|-----------------------------------|
| Release payload ceiling (sharp install script) | 369-19 | GREEN: `check-release-payload-ceiling --check` 0 findings; the prune landed in Phase 369.1 plan 08 (D-16, D-16a); `doctor --acceptance` 22 of 22 |
| `267: lockstep (MCPV2-19)` Checks 1 and 2 | 369-19 | GREEN: `test-267-mcpv2-lockstep` PASS=6 FAIL=0 (plan 369-35, 59baf772e, package-lock.json derived from the pruned shrinkwrap) |
| `267: zod4 contract (MCPV2-03)` room_list description diff | 369-22 | GREEN: PASS=4 FAIL=0 (plan 369-41, ef7814d8b: both wire snapshots, accepted deltas, importers baseline) |
| Stale `--built` single-use assertion | 369-26 | GREEN: 13 passed 0 failed (plan 369-41, 359f7cba2 asserts the replay contract) |
| journey step 6 intermittent timeout | cause not established | Not reproduced: 134 valid soak cycles (369-34), 15 of 15 non-void runs (369-46 and here). WR-10 (a relay poll that ignored a reset) was fixed at its own proven cause; the original two occurrences carried no load or process data and the RCA records the stall as NOT ESTABLISHED, not as fixed |

### Reds that are not this phase's (re-measured, named with owner)

| Red | Measured now | Owner |
|-----|--------------|-------|
| `test-198-adapter-budget` (SPEC-5, scripts/on-stop 618 against 570) | red, unchanged | Pre-existing since July (last on-stop change 2026-07-30), unowned |
| `test-237-approve-executes` (leg 7 MUTATION build: "dispatcher-call needle not found") and `test-237-autonomy-parity` (leg 5 MUTATION) | red, same legs | Cascaded from Phase 289's ruled behaviour changes; post-369 `/gsd-quick` |
| `test-345-gate-ratify` | red under the real `~/MindrianRooms` registry (approve legs answer `no_bound_room`); PASS under a clean `HOME` and `MINDRIAN_ROOMS_HOME` (33 checks) | Environment: the real registry; post-369 `/gsd-quick` |
| `test-363-mcp-tool` M3 to M7 | PASS 11 FAIL 4 | Phase 289's ruled behaviour change; post-369 `/gsd-quick` |
| `test-365-floor-gate` H6 | GREEN now (PASS 59 FAIL 0): plan 369-41's zod4 move cleared it | Cleared, no owner needed |
| `test-366-gated-term-release` R6b | PASS 27 FAIL 1 | Post-369 `/gsd-quick` |
| `test-353-filing-gate` | PASS=23 FAIL=1 (`EVENT_TYPES.size is 102`) | Pre-existing, post-369 `/gsd-quick` |
| `test-354-framework-command-ledger` T2 | 8 passed 1 failed (ledger stamp beta.48 against beta.56) | Pre-existing stamp drift, unowned |

### Flakes observed (counted, not hidden)

- `run-all-369.sh` run 1: the Phase 289 precondition probe failed once (its part 3 spawns `test-289-cli-card-dual-era.cjs`, whose process-hygiene leg failed); run 2 and three standalone runs were green. 1 of 2 aggregator runs. Cause not established; my own concurrent probe script cannot be excluded.
- `run-all-267.sh` run 1: `267: local server dual era` process-hygiene leg failed once; run 2 and three standalone runs were green. 1 of 2 aggregator runs; nothing of mine was running. Both are the family plan 369-34 named: hygiene legs that count repo-anchored `mindrian-mcp-server` pids before and after (tests/test-267-mcpv2-dual-era.cjs, tests/test-289-cli-card-dual-era.cjs, tests/test-369.1-bin-relocation.cjs). Hand-off to Phase 369.1 or a post-369 quick: sweep only processes the test started.
- Journey: 0 flakes in 5 standalone runs (step 6 not reproduced).
- Not mine and left alone: server processes 126630 and 1703775 (`node .../bin/mindrian-mcp-server.cjs` of this repo, started hours before this plan) and the plugin-cache servers; I started and stopped only the processes my own commands spawned.

### Reviewer probes re-run (read-only, scratch only)

| Probe | Before (369-REVIEW.md) | Now |
|-------|------------------------|-----|
| Ledger overwrite (WR-05): mint a live id under a second session | the owner's next answer read `session_mismatch` | `mintGate` returns false for the second session, the owner's peek is intact |
| `isOurShell` against `node -e ... <entry path>` (WR-12) | true (substring match) | false, with or without a recorded start time |
| `build-ui-shell --check` on a copy of the dist with one byte flipped (WR-16) | exit 0, fresh | exit 1, "the dist bytes do not match manifest.files" (untouched copy: exit 0, 270 files verified) |
| `readChanges(after: 5000)` with latest_seq 3 (WR-07), `room_search` through a symlink (WR-19), ledger-boundary expiry (WR-02), curl redemption of a fresh link (CR-01) | ok with no changes; snippet from outside the room; `gate_expired` after a committed answer; session cookie issued | their arms in `test-369-read-surfaces` (9), `test-369-gate-hardening` (20) and `test-369-shell-server` (43, live curl-shaped request: 403) pass; see 369-REVIEW-FIX.md |

### D-ids the gap plans touched, with proving arms

| Decision | Gap plans | Proof (this session) |
|----------|-----------|----------------------|
| D-08 local auth, no credential in the conversation | 37, 40, 46 | `test-369-shell-server` 43 passed (live arms); `test-369-launch-surface` 30 passed (arms 1a to 1s); journey step 1 asserts the launcher printed no code, 5 of 5 |
| D-14 / D-15 Ask Larry control, only a person approves | 42, 43, 44 | `test-369-human-only` PASS=10 (HTTP arm 8); `test-369-gate-mirror-shell` PASS=10 (arms 6 and 8: Hold-approve refused, one nonce issue site); `e2e-369/views.cjs` arms 12 to 14 |
| D-16 durable, replayable answers | 33, 36, 38, 42 | `test-369-gate-raised` 11, `test-369-gate-mirror` 10, `test-369-gate-hardening` 20, `test-369-gate-recovery` 11 |
| D-19 sessionful, session-scoped ledger kept | 33, 36 | `test-369-gate-mirror` arm 9 (ledger untouched, stranger `session_mismatch`, owner still answers); `run-all-238` PASS=10; `run-all-289` PASSED=47 |
| D-18 durable change feed | 34, 37, 39 | `test-369-read-surfaces` 9, `test-369-feed-guards` 11, `test-369-shared-core` 15 (arms 3c and 3d), replica e2e 12 arms |
| D-11 / D-09 / D-10 views and gate states | 43, 44 | `test-369-views-copy` 35, `test-369-gate-web-mapping` 26, `e2e-369/gate-button.cjs` 18 arms, `e2e-369/views.cjs` 15 arms, egress-and-canon C1 to C11 |
| D-07 / D-17 release-built dist | 35, 41, 45 | `test-369-ui-dist-fresh` 18 passed (strict ceiling), `build-ui-shell --check` 270 files verified, `test-267-mcpv2-lockstep` 6, payload ceiling 0 findings |
| D-03 / D-01 launch surface and canon | 40, 43, 44 | `test-369-launch-surface` 30 passed; `test-369-canon-skin` 30 passed; egress-and-canon C1 to C11 (zero CSP events) |

### Research trail (gap closure)

- Mirror: `/home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md` gained a dated "Gap closure addendum (2026-10-04)" (the cross-process gate mirror design and its rejected alternative, the CR-01 sign-in boundary and its residual risk, the step-6 root cause, the review disposition counts), committed in the home repository with an explicit path (hash in 369-47-SUMMARY.md).
- Room copy: `/home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369-ui-shell-close-out.md` is NOT updated by this plan. The write is the same one the mos `write-scope-check` hook refused at 369-31 (active room egain-des-liquid-conductor; the hook's authorization is the navigator's to give); it was not worked around (no Bash copy, no room switch). The room copy still holds the 369-31 content, so `cmp` exits 1 until the orchestrator runs, with the navigator's authorization, `cp /home/jsagi/MindrianOS/research/2026-10-04-phase-369-ui-shell-close-out.md /home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-10-04-phase-369-ui-shell-close-out.md` and then `cmp` of the two files (must exit 0). VALIDATION rows 369-31-02 and 369-47-03 follow that result.

### Open navigator items (listed, not closed)

CR-02 (an MCP `gate_answer` has no human principal; options in 369-REVIEW-FIX.md); IN-01 to IN-11 (IN-07 and IN-11 untouched by plan 369-45); the 404-page copy; the duplicate "Reconnect now" and the "Catching up" fallback; Research A5; MCPV2-13's Desktop smoke; the Desktop and Cowork host build numbers (not reported); the never-do mirrored proposal and the 1000-character mirrored preview (369-36 open items); the same-user header forgery inside the 60 s sign-in window (CR-02 class). Handed to Phase 369.1 plan 04 (lib/mcp/daemon-lifecycle.cjs): WR-15 and the daemon half of WR-13.

### Not done here, by instruction

STATE.md and ROADMAP.md (the orchestrator's), CHANGELOG.md (Phase 369.1 plan 14's file; the hand-off lines are in 369-47-SUMMARY.md), the Phase 369.1 files and DPI rows, any version bump or release, and the fixes for every red listed above.
