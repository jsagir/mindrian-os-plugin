---
phase: 400.5-icm-routed-prompt-hooks-seed-158-promoted-critical-lands-bef
kind: egm-resolution (round 2)
written: 2026-11-26
inputs: R2-design.md (D), R2-codebase-details.md (CD), R2-implementation-readiness.md (IR)
target: 400.5-DESIGN.md r3
tree: /home/jsagi/dev/MindrianOS-Plugin-4005 at ffb6d8fb3
rulings read: 400.5-CONTEXT.md sections 2, 5a, 5b, 5c
---

# Phase 400.5 Goldfish round 2: resolution

Totals in the three reports: 2 Blockers (CD 1, IR 1) and 18 Majors (CD 6, D 7, IR 5). The D header says 6 Majors; the D list has 7 (D-01, D-02, D-03, D-05, D-06, D-07, D-08). The total in the orchestrator brief (17) uses the header. After the merge, 16 distinct Blocker or Major issues remain. Each row has one disposition.

Disposition words: FIXED (DESIGN r3 changes in the named section), CONTESTED (evidence with file and line says that the finding does not hold), OWNER (a locked ruling is touched; a NEEDS_HUMAN line is in DESIGN r3 and in the report).

## 1. How each finding was checked

Every Blocker and Major was read against the code at ffb6d8fb3. Labels: PROVEN (read in code), ASSUMED (reasoning, not run), UNVERIFIED (a spike leg must prove it). No test was run in this round; the round-1 simulation of the re-pin list stays the base evidence.

Code read for this round (all PROVEN):
- `scripts/brain-derivation-drain.cjs:77-103` defines a local `resolveMindrianRoomsRoot()` and `resolveActiveRoomDir()`; `:307` calls the local one. It reads `roomsHomeEnv()` (`lib/core/rooms-home-env.cjs:23-29`: `MINDRIAN_ROOMS_HOME`, then `MINDRIAN_ROOMS_ROOT`), else `$HOME/MindrianRooms`, then `registry.active`. It never reads `CLAUDE_ACTIVE_ROOM` or `USERPROFILE`.
- `scripts/mindrian-mcp-server.cjs:278-281` says that `createServer()` runs once per HTTP request on the flag-off branch and must have no process-level side effects. `:506`, `:510` and `:550` call `createServer()` per request or per session. The stdio branch is `:652-660`; `registerTerminalSignalListeners` is `:392-395`. `lib/mcp/tool-router.cjs:2535` calls `registerCoreTools` inside that factory, so a tool `register()` runs per HTTP request.
- `lib/core/room-db.cjs:305-310` passes the capped value once as the `DatabaseSync` `timeout`; `:321` and `:364` trip the cap only on open and migrate. `lib/core/navigation/spine-events.cjs:480` and `lib/hmi/selector-telemetry.cjs:265` trip it on a locked write. There is no handle cache in `room-db.cjs` (grep for a Map or cache, PROVEN).
- `scripts/intent-classifier.cjs:3008-3023` (`consumePriorF1Pick`) reads the last trace entry and its `f1_closer_payload`; `:4147` sets that payload; `:4221` persists the trace; `:4226-4228` writes the NAV hash; `:3352` `markZeroScoreGateOffered`, `:3404` `markBindingGateOffered`, `:3435` `emitNoMatchGate` write once-per-session marker files. `:4245-4250` `RUN_CHAIN`; `:4252-4277` `runOnce` keeps `OUT` as module state.
- `lib/core/hook-busy-cap.cjs:13` "Zero requires on purpose"; `:17-39` module state.
- `lib/core/session-binding.cjs:176-182` `resolveEffectiveSessionId`; the fallback ends at `stdio-<pid>-<12 hex>` (`:194-204`).
- `lib/core/hook-io.cjs:41-53` `finishCli` writes stdout, then stderr, then calls `process.exit`; it has no after-stdout callback.
- `tests/test-400-job-sentences.cjs:196` builds `MCP_SURFACES` from `data/mcp-tool-connectors.json`; `:223` pins 63; `:224` key set; `:306` `mcp_tools: 63`. `scripts/apply-job-sentences.cjs:229-255` (`runCheck`) counts commands, skills and agents only, so F3 (`:358-362`) does not read MCP surfaces.
- `tests/test-374-engine-busy.cjs:79` and `:452` pin the exact budget line with 76 tools. `tests/test-374-descriptions.cjs:144` pins 76 and `:38-39` `BEFORE_TOTAL` 83855, `GROWTH_MAX` 3000. `tests/test-384-s7-mcp-start.cjs:32` `SPEED384_WRITE_GOLDEN=1` regenerates the golden; `:175` pins 73 tools; `:186` pins 37 files.
- `lib/memory/brain-derivation-queue.test.cjs:435-454` (Test 17) and `lib/memory/minto-debounce-consumer-census.test.cjs:432-449` (Test 3) read `hooks/hooks.json`; `lib/memory/run-feynman-tests.cjs:189` runs the census test. `grep -rl "hooks\.json" lib scripts --include=*.test.cjs` also lists `lib/memory/sessionstart-coordinator.test.cjs` and `scripts/check-pending-breakthrough.test.cjs`.
- `data/hooks-markers.json:23-25` `_firstInstallRouterOrdering` says that the router is registered before brain-derivation-drain.
- Spike `400.4-SPIKE-mcp-tool-hook.md:10` "one server process (same pid) served two prompts in one session"; `:11` `hook_cancelled`; `:13` `--resume` not verified.

## 2. Blockers and Majors

| # | Merged ids | Sev | Finding (short) | Verified | Disposition | DESIGN r3 |
|---|---|---|---|---|---|---|
| 1 | R2-IR-01 | Blocker | Each `claude -p` or `--resume` is a new host process with a cold server, so T7 measures cold connects and T4b kills a gone server; L6 has no fail branch. | ASSUMED (reasoning); spike :10 shows one pid for two prompts in one session, method not recorded | FIXED: one long-lived host process (`claude -p --input-format stream-json --output-format stream-json --verbose`, N user messages on one stdin; tmux interactive as the second method). A pid-recording wrapper writes one line per server start. L6 passes only when one pid serves N=3 prompts; fail = stop for owner (HR-07 not measurable). T4b kills the pid from that file. `hook_cancelled` source: the stream-json hook event when present, else the `--debug` line; L6 records which. | 9.2 (method M1), 9a L6, T4b, T7 |
| 2 | R2-CD-01 | Blocker | brain-derivation-drain uses a local resolver, not `lib/core/resolve-active-room.cjs`. | PROVEN (`scripts/brain-derivation-drain.cjs:77-103`, `:307`) | FIXED: 5.4 row 2 and the env table are corrected; `CLAUDE_ACTIVE_ROOM` is read by jtbd-update and the classifier only; brain-derivation-drain reads `MINDRIAN_ROOMS_HOME`, `MINDRIAN_ROOMS_ROOT`, `HOME`. The section 8 room parity case has a separate expectation per check. | 5.2, 5.4, 8 |
| 3 | R2-IR-02 | Major | The T7 rule "0 of 20 hook_cancelled" fails on the accepted cold first-prompt miss. | PROVEN (DESIGN r2 :296 vs :262) | FIXED: T7 sends 21 prompts in one host process. Prompt 0 is the cold prompt and is judged by the L6 branch. Prompts 1-20 are the G11 run and must show 0 `hook_cancelled`. | T7, 9.3 |
| 4 | R2-CD-02, R2-IR-05, R2-D-03 | Major | Byte equality of the stdin prompt and the `${prompt}` value is unproven; a difference gives a false note and a NAV re-render every turn. | PROVEN (spike :12 says only "passes the full user prompt") | FIXED: L1 leg P runs a fixed 12-prompt set and compares sha256 on both sides. Fail branch: one shared `normalizePrompt()` when the difference is a normalisation; else a host per-turn field; else stop for owner. | 7.1, 9a L1 |
| 5 | R2-IR-04 | Major | The L1 fail branch for `session_id` cannot run when `${session_id}` is not substituted. | PROVEN (`lib/core/session-binding.cjs:176-204`) | FIXED: L1 decides at spike time. `${session_id}` substituted: key on it. Not substituted: compare server `CLAUDE_CODE_SESSION_ID` with the invariant stdin `session_id`; equal = the tool keys on the env value always; else stop for owner. | 7.1, 9a L1 |
| 6 | R2-IR-03, R2-CD-07, R2-D-10 | Major | DESIGN keeps the NEEDS_HUMAN that CONTEXT 5b answered; L2 and L3 fail cells still defer; the cell "L2 fail and no rule 3" is not covered; no SUMMARY field for the shipped branch. | PROVEN (DESIGN r2 :225-227, :306-307; CONTEXT 5b) | FIXED: 6.3 cites 5b; L2 fail = B ships; SUMMARY field `or6_branch_shipped: A or B`. OWNER for one cell only: L2 no marker AND rule 3 not available (L3 fail or literal `transcript_path`) gives a B that is weaker than the B accepted in 5b. Default in r3: stop for owner at spike time. | 6.3, 6.4, 9a L2, L3, 12 |
| 7 | R2-CD-06 | Major | The ledger before the router changes locked OR-3 without a ruling. | PROVEN | FIXED by the owner ruling CONTEXT 5c (admin gate, then turn ledger, then router). r3 cites 5c in the header, section 1 and section 3. | header, 1, 3 |
| 8 | R2-D-01 | Major | A cold connect can write `served:true` for a host-cancelled turn. | ASSUMED (reasoning; F-07 cold start 3.2 s) | FIXED: the heartbeat starts in `main()` with `lastTick = process start` (`performance.timeOrigin`). A request read before the first tick gets `origin = process start`, so a cold call is `late_start`, never served. L6 and T4b assert that no turn with `hook_cancelled` has a `served:true` ledger entry; fail = stop and fix before W3. | 5.1, 7.3, 9a L6, T4b |
| 9 | R2-D-02 | Major | The note can be lost when the invariant is cancelled after the ledger write and before stdout; both tiers failing on one prompt leaves it unchecked. | PROVEN (order of DESIGN r2 section 3; `lib/core/hook-io.cjs:41-53`) | FIXED: `seen.json` carries `noted`; `missed_run` resets only when the previous note was shown (`noted:true`, set in the stdout write callback). The invariant also counts `served.recent` entries with `served:false` newer than `seen.last.at` and not equal to `seen.last.k`. A prompt that neither tier recorded is a stated known limit. | 7.2, 7.4, T4a |
| 10 | R2-CD-05, R2-D-05 | Major | Heartbeat, rejection handler and preload in `register()` run per HTTP request and install a process-wide handler from a tool module. | PROVEN (`scripts/mindrian-mcp-server.cjs:278-281`, `:506`, `:510`, `:550`; `lib/mcp/tool-router.cjs:2535`) | FIXED: new `lib/mcp/process-guards.cjs`, called once from the stdio branch of `main()` (`:652-660`) behind a module once guard, never from `register()`. The rejection logger covers every tool of the stdio server (CLI and Desktop). HTTP keeps today's behaviour. | 2.1, 5.1, 5.7 |
| 11 | R2-D-06 | Major | A late dispatch N-1 can overlap dispatch N: env drift, lost `served.json` entries. | PROVEN (`scripts/intent-classifier.cjs:54-55`; RUN_CHAIN serializes only the classifier) | FIXED: one in-flight `dispatch()` per process. A second call waits up to its start deadline, else returns empty context with note `dispatch_busy`, served false. The ledger append is synchronous inside the lock. T5 adds the overlap leg. | 5.8, T5 |
| 12 | R2-D-07 | Major | The cap is the connection-wide SQLite timeout set once at open; K writes can wait K x 750 ms; a WAL open succeeds under a held write lock. | PROVEN (`lib/core/room-db.cjs:305-321`) | FIXED: inside a store, the open timeout is `min(requested, cap, remaining)`; a new `refreshBusyTimeout(db)` in `room-db.cjs` runs `PRAGMA busy_timeout = <capBusyMs(5000)>` before each write in the navigation write chokepoint; any SQLITE_BUSY in that chokepoint trips the store. A W0 audit lists every room.db write of the four checks outside the chokepoint as a known limit or a refresh site. | 5.3 |
| 13 | R2-D-08 | Major | An unserved turn undoes only the NAV hash; the trace entry read by `consumePriorF1Pick` and the once-per-session gate markers stay. | PROVEN (`scripts/intent-classifier.cjs:3008-3023`, `:3352`, `:3404`, `:3435`, `:4147`, `:4221`) | FIXED: `forgetUnservedTurn()` uses a per-turn write journal: it restores the NAV hash file, marks the last trace entry `unserved:true` (`consumePriorF1Pick` skips it), and restores each gate marker file to its prior state. The cue record stays (known limit, it is a statusline value, not model context). | 5.6 |
| 14 | R2-CD-03 | Major | Missing re-pins: test-400-job-sentences (+ data file), test-374-engine-busy, test-374-descriptions, test-384-s7 + golden. | PROVEN (lines in section 1) | FIXED: test-400-job-sentences filters excluded MCP surfaces at `:196` (count stays 63, data file unchanged, new arm: no excluded surface has an entry); test-374-engine-busy new budget line; test-374-descriptions 77 and a re-measured `BEFORE_TOTAL`; test-384-s7 74 tools, 38 files, golden regenerated with `SPEED384_WRITE_GOLDEN=1`. | 11.3 |
| 15 | R2-CD-04 | Major | Census misses `lib/memory/*.test.cjs` and `run-feynman-tests.cjs`. | PROVEN | FIXED: census grep is widened to `tests lib scripts`; brain-derivation-queue Test 17 and minto census Test 3 are re-pinned to `CHECKS`; `run-feynman-tests.cjs` is in the acceptance command. `data/hooks-markers.json:23` note is rewritten. | 11.3 |
| 16 | R2-IR-06 | Major | Only wave 0 is defined. | PROVEN | FIXED: wave table W0-W4, 7 plans, files and one acceptance command per plan. | 11.4 |

No finding is CONTESTED in this round.

## 3. Nits

| Merged ids | Nit | Disposition | DESIGN r3 |
|---|---|---|---|
| CD N1 | P5 hostView rules are at INPUT plan 13 :134. | FIXED | 2.2 |
| CD N2 | HTTP branch check at `scripts/mindrian-mcp-server.cjs:399`. | FIXED | 5.5 |
| CD N3, IR-08 | `pruneSessionDir(dir, keepFile)` at `lib/statusline/next-move-cache.cjs:127-141`, constants `:49-52`; keepFile per writer. | FIXED | 7.1 |
| CD N4 | Classifier env writes also `:55` and `:1185-1186`. | FIXED (snapshot and restore cover them) | 5.2 |
| CD N5 | `holdLock` is not exported. | FIXED: copy it to `tests/helpers/room-db-hold-lock-400-5.cjs`; test-400.4-hook-budget keeps its copy | T5, T7 |
| CD N6, D-13, IR-07 | `hook-busy-cap.cjs` has zero requires. | FIXED: `reserveMs` is a store field | 5.3 |
| CD N7, IR-09 | `listMcpToolFileHealth` returns `connectorCount` only. | FIXED: it also returns `excludedCount` | 4.2 |
| CD N8 | `data/hooks-markers.json:23`; MASKS at `tests/test-400.4-hook-run-exports.cjs:141`. | FIXED | 11.2, T6 |
| CD N9 | Invariant script needs a CLI net; requiring `eureka-tool-contract.cjs` pulls zod and the client. | FIXED: same last-resort net as `scripts/first-install-router.cjs:1020-1028`; copy the one line of `signalFromExtra` | 2.1, 3 |
| D-04 | Served limit 2,500 vs host 3,000. | FIXED: `SERVED_LIMIT_MS = 2900`; note text "may have been skipped" for reason `deadline` | 7.2, 7.3 |
| D-09 | Signal in a module variable; a never-settling runTurn blocks forever. | FIXED: capture per turn in `runTurn`; dispatch lock has a maximum hold | 5.6, 5.8 |
| D-11 | `served` computed before the ledger writes. | FIXED: answer first, ledger and forget on `setImmediate` inside the lock | 4.1, 7.3 |
| D-12 | A long-lived timer created inside the store keeps it. | FIXED: preload outside the store; audit item | 5.1, 5.7 |
| IR-10 | Truth-table row text for "invariant cancelled on prompt 2". | FIXED | 7.4 |
| IR-11 | Name the L7 install. | FIXED | 9a L7 |
| IR-12 | Budgets sum 4,100 ms vs 2,500 window. | FIXED: deadline formula stated | 2.1 |
| IR-13 | Top-level `refused` key may fail the host. | FIXED: L4 tests an unknown key; fail = stderr only | 2.3, 9a L4 |
| IR-14 | A loop block before receipt can mark a served turn unserved. | FIXED: known limit; T5b counts false positives | 7.3 |

## 4. Owner items

One item touches a locked ruling (CONTEXT 5b). DESIGN r3 does not decide it. Default: stop for the owner at spike time.

NEEDS_HUMAN: If spike L2 finds no host marker and rule 3 is not available (L3 finds no stable tail rule, or `transcript_path` is not substituted), does the owner accept OR-6 B with rules 1, 2 and 4 only (a model call that copies the session id and the cwd can then run the four checks once with no forged file), or must the phase stop at that point?

## 5. Not run

No reviewer ran in this round. No test ran. The orchestrator runs a narrow round-3 check on DESIGN r3 sections 5.1, 5.3, 5.6, 5.8, 7, 9.2, 9a, 11.3, 11.4.
