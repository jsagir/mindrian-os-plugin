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
