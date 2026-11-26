---
phase: 400.5-icm-routed-prompt-hooks-seed-158-promoted-critical-lands-bef
kind: egm-resolution (round 1)
written: 2026-11-26
inputs: R1-zoom-out.md (Z), R1-design.md (D), R1-codebase-details.md (CD), R1-implementation-readiness.md (IR)
target: 400.5-DESIGN.md r2
tree: /home/jsagi/dev/MindrianOS-Plugin-4005 at 9a6d13249 (base a383e57cf)
---

# Phase 400.5 Goldfish round 1: resolution

Totals in the four reports: 10 Blockers (Z 1, D 1, CD 4, IR 4) and 31 Majors (Z 2, D 7, CD 13, IR 9). The reports headers say 30 Majors; CD-05 to CD-17 is 13 items, not 12. After the merge, 21 distinct Blocker or Major issues remain. Each row has one disposition.

Disposition words: FIXED (the DESIGN r2 section changes), CONTESTED (evidence with file and line says the finding does not hold, or a smaller change meets the goal), OWNER (a locked ruling or a ruling-level choice is touched; a NEEDS_HUMAN line is in the DESIGN).

## 1. How each finding was checked

Every Blocker and Major was read against the code at 9a6d13249. Labels: PROVEN (read in code or run), UNVERIFIED (not run).

A simulation was run for the re-pin list (PROVEN). Steps: copy the tree to a scratch directory, commit it, run the 45 tests that read `hooks/hooks.json` (each with a temp HOME, timeout 120 s), replace the six UserPromptSubmit groups with one command entry (a stub `scripts/userprompt-invariant.cjs`) and one `mcp_tool` entry, run the 45 tests again, and compare exit codes and first FAIL lines. Result: 7 tests change from pass to fail (test-261029-qef-hook-timeouts A2 "expected 41 command hooks, found 36" and A4; test-385-hook-unwire; test-389-hook-unwire; test-391-hooks-contract H1; test-derivation-drain-fires NAV-03; test-jtbd-hook-integration Class 9) and test-3696-operation-doctrine RT1 moves from "KNOWN RT1 now passes" to its KNOWN route. 13 tests fail in the scratch copy at base (listed in DESIGN 11.3). 2 tests changed from fail to pass (test-36925-brief-wiring BW4 wall time, test-261118-vbv Q9 "database is locked"); both failures are timing or lock text, so they are ASSUMED flaky, not an effect of the change. The stub requires nothing, so test-369 and test-346 did not show the real effect; DESIGN 11.3 names their re-pin from code reading.

## 2. Deduplicated table: Blockers and Majors

| # | Issue | Merged ids | Sev | Verified | Disposition | DESIGN r2 |
|---|---|---|---|---|---|---|
| 1 | The counter ledger repeats the note after one miss, hides the first-prompt miss when the warm tool wins the race, counts a blocked prompt as served, and drifts after a stale file or an invariant timeout. | Z-01, D-01, IR-01, CD-01, CD-02, CD-14 | Blocker | PROVEN by trace of DESIGN r1 section 7 rules (`noted = seen` then `seen + 1`; the tool runs on a blocked prompt under OR-1 A, DESIGN r1 section 3) | FIXED: turn-keyed ledger. The invariant script checks only the key of its own previous non-blocked turn, so no race; a missed-run counter resets on a served turn; truth table added. | 7 |
| 2 | The tool cannot see a late start: the clock origin is the receipt time, and a synchronous room.db wait blocks stdio, so a call that the host cancelled can count as served. | IR-04, D-02, CD-10 | Blocker | PROVEN: `lib/core/room-db.cjs:255-262` (5,000 ms default), `:304-310` (`new DatabaseSync(..., {timeout})`, synchronous) | FIXED: event-loop heartbeat sets a conservative origin; the cancel signal (`signalFromExtra`, `lib/mcp/eureka-tool-contract.cjs:393-395`) marks a cancelled call; a call is served only when both checks pass. | 5.1, 7.3 |
| 3 | No rule says what each spike result changes, what blocks what, or what happens when `${session_id}` is not substituted. | IR-02, CD-15 (Z-07 Nit) | Blocker | PROVEN: `lib/core/session-binding.cjs:176-182` falls back to `CLAUDE_CODE_SESSION_ID`, then `stdio-<pid>-<hex>` (:194-204) | FIXED: wave-0 spike plan with a decision table (pass, fail, branch, unblocked tasks) for L1 to L7. | 9a |
| 4 | test-391 H1 fails on any `mcp_tool` hook; no host version floor; the behaviour of an older host on an unknown hook type is unknown (the Part 8 guard hooks must not be lost). | IR-03, CD-03, CD-13 | Blocker | PROVEN: `tests/test-391-hooks-contract.cjs:75-81` (ruleH1), `:171-174` (mutation arm incl. mcp_tool), header `:13-14`; simulation shows H1 FAIL | FIXED: H1 re-pin with one allowed entry and a kept mutation arm; new spike leg L7 for the floor and the older-host case; typed reason `hook_not_called`. | 9a L7, 7.4, 11.3 |
| 5 | `hostView` and `mergeViews` do not exist; the r1 design also changed the plan 13 empty output without saying so. | CD-04, IR-05 (Z-04, Z-05, CD-19 Nits) | Blocker | PROVEN: no `scripts/userprompt-dispatch.cjs`, no `tests/helpers/userprompt-parity-*`, grep for `hostView` finds none | FIXED: new no-require module `lib/core/hook-views.cjs`; plan 13 P5 rules ported by text; exact exports and the empty output of each tier. | 2 |
| 6 | The per-open cap of 750 ms does not bound a call that opens room.db many times. | D-03 (IR-14, CD-24 Nits) | Major | PROVEN: `lib/core/hook-busy-cap.cjs:28-33`; trip only on a busy result | FIXED: the AsyncLocalStorage store carries `deadlineAt`; `capBusyMs` also caps at the time left. | 5.3 |
| 7 | A cut classifier keeps running and writes the NAV hash, the trace and the cue record, so the next turn shows the unchanged marker. | D-04, CD-07 | Major | PROVEN: `scripts/intent-classifier.cjs:4255-4279` (race, engine continues), `:4221` persistDecisionTrace, `:4226-4228` writeNavBlockHash, `:4183` readNavBlockHash, cue writes `:2672`, `:3881` | FIXED: abort signal into run(); the three writes skip when the signal is set; on a not-served answer the tool clears the hash sidecar. | 5.6 |
| 8 | RUN_CHAIN chains on the race promise, so a new run() can call `setTurnInput` while the old engine still runs. | CD-08 | Major | PROVEN: `scripts/intent-classifier.cjs:4248-4252`, `:508` | FIXED: chain on the real turn promise; a call that cannot start inside its deadline gives `classifier_busy`. | 5.6 |
| 9 | An async throw in a check can kill the server: no `unhandledRejection` handler in the server; the scripts relied on CLI handlers. | D-05, CD-09 | Major | PROVEN: grep of `scripts/mindrian-mcp-server.cjs`, `lib/mcp/*.cjs`, `lib/mcp/tools/*.cjs` finds no handler; CLI-only handler at `scripts/auto-explore-drain.cjs:327-334` | FIXED: audit task, one guarded `unhandledRejection` logger, no `uncaughtException` handler, T5 legs. | 5.7 |
| 10 | auto-explore room change breaks parity: today it uses `MINDRIAN_ROOM_DIR` else the hook cwd, not the session resolver. | CD-06, IR-06, D-06 | Major | PROVEN: `scripts/auto-explore-drain.cjs:68-73` | FIXED: `opts.roomDir` = `MINDRIAN_ROOM_DIR` first, then the literal input `cwd`; no cwd gives `no_cwd`. | 5.4 |
| 11 | r1 named the wrong resolver for jtbd-update and brain-derivation-drain, and gave no table of env vars that differ between the hook process and the server. | CD-05, IR-07 | Major | PROVEN: `scripts/jtbd-update.cjs:189`, `:311`; `scripts/brain-derivation-drain.cjs:307`; `lib/core/resolve-active-room.cjs:598-601` (no cwd); env reads by grep | FIXED: per-check resolver table and env table; L1 captures both env sets. | 5.2, 5.4 |
| 12 | OR-6 B (fallback) is not harmless: every input field is model-controlled; the replay key on the prompt breaks a repeated real "yes". | D-07 | Major | PROVEN: F-30; the model can read env and files with its tools (ASSUMED for a default permission set) | FIXED in part: B is hardened (session id bound to the server env when L2 shows it, cwd check, per-turn replay key from the transcript, transcript-tail rule). OWNER for the residual: a deliberate forgery can still pass. NEEDS_HUMAN line in DESIGN 6.3. | 6 |
| 13 | Cold module load of the first served call is not budgeted; prompt 2 can miss too. | D-08 | Major | PROVEN: `scripts/intent-classifier.cjs` is 4,289 lines; the warm-up note at `scripts/brain-derivation-drain.cjs:170-172` | FIXED: T7 reports the first served call apart; a conditional `setImmediate` module load after initialize only when T7 shows a miss (no process, not a Stage 8 S4 prewarm). | 5.1, 9 T7 |
| 14 | OR-5 A generator change is under-specified (no error channel in `normalizeMcpToolEntry`; coverage slice marks every tool file wired; ledger file not listed). Z-02 says the shape-check change is not needed. | CD-11, IR-09, Z-02, CD-12 | Major | PROVEN: `scripts/build-connector-registry.cjs:477-501`, `:623-624`, `:811-854`, `:1267-1269`; `scripts/check-shape-declaration.cjs:216` (flags excluded only with a shape other than `none`), `:741-759`; `tests/test-270-connector-coverage.cjs:266-278` | FIXED by the smaller path (Z-02): the descriptor keeps `hitl_shape: 'none'` plus `hitl_why`, and adds `excluded: true` plus `reason`. No change to `check-shape-declaration.cjs`. Generator: three named edits, ledger file added. IR-09 item 4 CONTESTED (not needed with `hitl_shape: 'none'`). | 4.2 |
| 15 | The `mcp_first_http_unsupported` branch: wrong predicate (IR-10) or unreachable (Z-03). | Z-03, IR-10 (D-14, CD-22 Nits) | Major | PROVEN: `.mcp.json:3-7` is stdio; HTTP only when `surface.transport === 'http'` (`scripts/mindrian-mcp-server.cjs:398`), the Cowork path; CONTEXT section 7: Cowork and Desktop run no UserPromptSubmit hook | FIXED by deletion (Z-03). IR-10 CONTESTED: the host that runs the hook starts the plugin server from `.mcp.json` over stdio, so no predicate is needed. | 5.5 |
| 16 | test-369 walks only command hooks, so the no-TypeScript proof loses the four scripts; arm 3 needs a baseline for the new script. | IR-08 (D-09, CD-18 Nits) | Major | PROVEN: `tests/test-369-hook-require-graph.cjs:168-176` (`if (h.type !== 'command') continue;`) | FIXED: explicit walk root for the `mcp_tool` entry; baseline re-measure. | 11.3 |
| 17 | test-346 reads only `h.command` and knows only `scripts/X.cjs` and `run-hook.cmd`. | CD-17 (IR-18 Nit) | Major | PROVEN: `tests/test-346-catalogue-schema.cjs:209-219`, `:244-256` | FIXED: re-pin that reads the `mcp_tool` entry as mechanism `mcp:userprompt_hook`. | 11.3 |
| 18 | T4 is not runnable as written (boot delay env needs a server change, multi-turn headless unproven, no kill method). | IR-11 (Z-06 Nit) | Major | PROVEN: no `MOS_TEST_BOOT_DELAY_MS` in the tree (grep) | FIXED: T4a in-process truth table; T4b live with a test-only wrapper server in a temp plugin dir. | 9 T4 |
| 19 | T7 fixture is a private user room; no load script, command, log field or pass rule. | CD-16, IR-12 | Major | PROVEN: `tests/fixtures/large-room/build-fixture.cjs` exists; `scripts/release-lib/large-room-leg.cjs:10`, `:42` (2,105 artifacts); `holdLock` at `tests/test-400.4-hook-budget.cjs:73` | FIXED: T7 uses the fixture builder and `holdLock`; pass rule and SUMMARY fields named. | 9 T7 |
| 20 | Notes go to the server stderr only; the test read point is not defined. | IR-13 | Major | PROVEN by DESIGN r1 section 4 text | FIXED: `dispatch()` returns `notes[]`; in-process tests read it; one spawned-server leg greps stderr. | 4.1, 9 T5 |
| 21 | MINDRIAN-CANON CIRS declaration block. | D-11 (Nit, kept because Part 11 is in scope) | Nit | PROVEN: `scripts/check-cirs-declaration.cjs:38` does not catch it | FIXED: the plan adds a `cirs_relationship` block with `surfaces_added: [mcp:userprompt_hook]`. | 10 |

## 3. Nits

| Ids | Disposition | DESIGN r2 |
|---|---|---|
| Z-04 | FIXED: views in `lib/core/hook-views.cjs`, ledger in `lib/core/userprompt-turns.cjs`. | 2, 7 |
| Z-05 | FIXED: the tool never emits `continue: false`; a stop view becomes the note `routable_stop_ignored`. | 2.3 |
| Z-06 | FIXED: test-only wrapper, no env hook in the shipped server. | 9 T4 |
| Z-07 | FIXED: the literal `${...}` guard stays only if L1 fails. | 9a L1 |
| Z-08 | FIXED: servers are in `.mcp.json:2-13`; `plugin.json` declares name and hooks. | 4.2 (citation) |
| CD-19 | FIXED: `{}` alternative dropped; L4 fail goes to the owner (G6). | 2.3, 9a L4 |
| CD-20 | FIXED: reuse `SAFE_SESSION_RE` and the prune rule by moving them to `lib/core/userprompt-turns.cjs` imports; `lib/statusline/next-move-cache.cjs:58` does not export them, so the plan exports them (no behaviour change). | 7.1 |
| CD-21 | FIXED: reuse `proofFrom` shape of `lib/mcp/answer-route.cjs:73-83` for the `_meta` read in L2. | 6.1 |
| CD-22, D-14 | FIXED by deletion of the HTTP branch (row 15). | 5.5 |
| CD-23 | FIXED: T6 moves CASES (`tests/test-400.4-hook-run-exports.cjs:50`) and the masks into a shared helper; `withTimeout` is copied (it is not exported, `scripts/sessionstart-coordinator.cjs:80-89`). | 9 T6, 11 |
| CD-24, IR-14 | FIXED: API names given; `node:async_hooks` is a built-in, no cycle. | 5.3 |
| CD-25 | FIXED: `stop_gate_check` declares `F.1` (`lib/mcp/tools/stop-gate.cjs:83`), cited correctly; header updated (rulings locked); description true under both OR-6 branches; atomicCount 67 to 68; env restore covers changed and deleted keys. | 4, 5.2 |
| IR-15 | FIXED: measure live first; pin 77 and atomicCount 68 only if the base measures 76 and 67. | 4.3 |
| IR-16 | FIXED: T1 compares with `git show a383e57cf:hooks/hooks.json`. | 9 T1 |
| IR-17 | FIXED: plan 13 budgets admin 300 ms and router 500 ms are reported, not enforced (one process, two synchronous checks); admin gate throw fails open; no session id means no ledger. | 3 |
| IR-18 | FIXED: per-writer 24 h rule; helper path chosen; test-346 rule in row 17. | 7.1 |
| D-09, CD-18 | FIXED in row 16. | 11.3 |
| D-10 | FIXED: a refusal is also a JSON envelope with empty context and the text in a `refused` key, so G6 holds on every result. | 6.2 |
| D-12 | FIXED: rename retry on EPERM and EBUSY (3 tries, 20 ms); a read failure means unknown, never missed. | 7.1 |
| D-13 | FIXED: typed reasons in the ledger. | 7.3 |
| D-15 | FIXED: recorded as a known limit. | 5.2 |
| D-16 | FIXED: T5 leg for an ordinary tool call during the hook await. | 9 T5 |
| D-17 | FIXED: the invariant script calls `setHookBusyCap(HOOK_BUSY_MS)`; stderr notes never carry prompt bytes. | 3, 4.1 |

## 4. Reconciled conflicts between lenses

- Z-02 against IR-09: the smaller change wins. `scripts/check-shape-declaration.cjs:216` flags `excluded: true` only together with a shape other than `none`, and `collectMcpToolSurfaces` (:741-759) reads `hitl_shape` and `hitl_why` only. With `hitl_shape: 'none'` plus a `hitl_why`, the shape check passes and `tests/test-270-connector-coverage.cjs:266-278` passes. The shape-check change is dropped. The generator still needs the three edits of IR-09 items 1, 3 and 5.
- Z-03 against IR-10, D-14, CD-22: deletion wins. The branch protects a configuration that cannot call the hook.
- Z-01 (per-turn key) against IR-01 (notedMissed counter): the key wins, because a counter cannot remove the race of CD-02, and a key on the previous turn has no race (the previous tool call ends before the next prompt exists).

## 5. Owner items

- OR-6 fallback B (row 12). All locked rulings stay as written. DESIGN 6.3 carries one NEEDS_HUMAN line. It applies only when spike L2 finds no host marker.
- Conditional stops in DESIGN 9a (L1 with no session id path, L4, L5 systemMessage, L7) go to the owner only if the spike gives that result. They are not open now.
