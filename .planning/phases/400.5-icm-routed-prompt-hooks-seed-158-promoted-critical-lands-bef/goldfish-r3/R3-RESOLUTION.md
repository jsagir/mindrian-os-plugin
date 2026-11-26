---
phase: 400.5-icm-routed-prompt-hooks-seed-158-promoted-critical-lands-bef
kind: egm-resolution (round 3, narrow)
written: 2026-11-26
inputs: R3-implementation-readiness.md (IR), R3-design.md (D)
target: 400.5-DESIGN.md r4
tree: /home/jsagi/dev/MindrianOS-Plugin-4005 at 2b9c4a2cf
rulings read: 400.5-CONTEXT.md sections 2, 5a, 5b, 5c, 5d
---

# Phase 400.5 Goldfish round 3: resolution

Totals in the two reports: 6 Blockers (IR 4, D 2) and 5 Majors (IR 2, D 3), plus 1 Nit (D, lock-release order) and 1 gap on a closed R2 row (IR, R2 #13: `turn` in the trace journal entry). After the merge, 9 distinct Blocker or Major issues remain: 5 Blockers and 4 Majors. Each row has one disposition.

Disposition words: FIXED (DESIGN r4 changes in the named section), CONTESTED (evidence with file and line says that the finding does not hold), OWNER (a locked ruling is touched). No row in this round is CONTESTED or OWNER. CONTEXT 5d (written after r3) closes the only owner cell of r3.

## 1. Dedup table

| # | Merged ids | Sev (kept) | Short finding |
|---|---|---|---|
| 1 | R3-01 (IR), R3-D-01 (D) | Blocker | The r3 cold-connect rule fails when the MCP handshake comes before `tools/call`, and the warm-path rule fails because timers run before the poll read. |
| 2 | R3-02 (IR); R2 #6 still open | Blocker | DESIGN still stops at 6.4, L2 and L3; CONTEXT 5d is not reflected; no rule-4 key without a transcript. |
| 3 | R3-03 (IR) | Major | The rule-3 scan does not exclude the current turn; `seen.last` null is undefined; the "no race" claim is false. |
| 4 | R3-04 (IR, Blocker), R3-D-05 (D, Major) | Blocker | The busy-refresh sites are wrong; the real write paths are `logEvent`, `writeEdge`, the operator INSERT and selector-telemetry; the W1 file list is wrong. |
| 5 | R3-05 (IR) | Major | The T7 rule "0 notes on prompts 2-20" is stricter than G11; IR-14 false positives fail it. |
| 6 | R3-06 (IR) | Blocker | The W3 acceptance runs `lib/memory/run-feynman-tests.cjs`, which fails at base through `test/83-hook-dispatch.test.cjs`; the census misses `test/`. |
| 7 | R3-D-02 (D) | Blocker | The abort fires only on `over_deadline` or a host cancel; when the classifier's internal deadline race wins, the engine keeps running and writes the trace and the NAV hash of a turn the host did not see. |
| 8 | R3-D-03 (D) | Major | `consumePriorBindingAnswer` scans back for a binding-gate payload; the gate entries are written early and are not marked unserved. |
| 9 | R3-D-04 (D) | Major | `noted:true` is set when bytes reach the pipe, not when the host accepts the output. |
| - | D Nit | Nit | 4.1 step 7 and 5.8 give two different lock-release orders. |
| - | IR gap on R2 #13 | gap | The trace journal entry has no `turn`. |

## 2. How each finding was checked

Every row was read against the code at 2b9c4a2cf. Labels: PROVEN (read in code or run), ASSUMED (reasoning, not run), UNVERIFIED (a spike leg must prove it).

Code read and runs for this round:
- `scripts/mindrian-mcp-server.cjs:653-661`: the stdio branch calls `registerStdioProcessSession()`, `serveStdio(() => getServer())` (:656), `startTreeWatcherOnce(getServer())` (:657), then the two listener registrations. `getServer()` (:299-302) builds the server lazily. PROVEN.
- `node_modules/@modelcontextprotocol/server/dist/stdio.cjs:286-288`: `serveStdio(factory, options)` takes `options.transport`; the transport reads stdin with `on('data')` in `start()` (:74) and calls `onmessage` per framed message (:80-85). PROVEN.
- `scripts/intent-classifier.cjs`: `runOnce` (:4258-4278) races `runTurn()` against a timer that resolves 0 (:4266-4269); `RUN_CHAIN` holds the raced job (:4251-4255); `runTurn` awaits `navP` before it returns (:4236); `const emit = OUT` (:3829); trace entry `turn: turnNo` (:4119-4122); `persistDecisionTrace` call sites :632, :3276, :3541, :3728, :4221; `consumePriorBindingAnswer` (:3579-3614) scans backwards and stops only at `binding_gate_consumed` (:3606); `consumePriorF1Pick` (:3002-3023) reads the last entry. PROVEN.
- Readers of `decision-traces/<sid>.json` (grep `decision-traces` in lib and scripts): classifier :2946 (`appendTraceTurnNumber`), :3014, :3599; `lib/core/nav-dial.cjs` (doc :8, :41: reads the latest entry); `scripts/explain-decision-command.cjs` (:199, :446-463, display only); `lib/memory/validators/navigation-invariants.cjs` (:228-264, INV-4 schema). PROVEN by grep; the use of each field is a W0 census item.
- `lib/core/navigation/memory-events.cjs`: `logEvent` at :854; INSERT at :897-900; the catch at :901-903 returns `{ok:false, reason: err.message}` and trips nothing. PROVEN.
- `lib/core/navigation/edges.cjs`: `writeEdge` at :1048; INSERTs at :1103-1107 and :1114-1117. R3-04 cites `:32` and `:192`; those lines are `ALLOWED_EDGE_TYPES` and its comments. The finding holds; the line numbers do not. PROVEN.
- `lib/core/navigation/spine-events.cjs`: `_emit` :190-222 (one open, `logEvent`, optional `writeEdge`, close); operator node INSERT :292-296 (two `run` calls on one statement); `openRoomDbForCaller` probe :470-484 with an inline busy regex at :478. `grep _isBusy` finds no hit in this file, so the r3 text "the `_isBusy` test that `spine-events.cjs:480` already uses" is false. PROVEN.
- `lib/hmi/selector-telemetry.cjs`: `_isBusy` defined at :190; raw `DatabaseSync` open at :252 with `capBusyMs(5000)`; trips at :254, :265 (swallowed `logEvent` result), :268. PROVEN.
- `lib/core/navigation/memory-events.cjs` and `edges.cjs` require only `node:crypto` (:8, :20). `lib/core/hook-busy-cap.cjs:13` has zero requires. PROVEN. So a refresh helper in `hook-busy-cap.cjs` can be required by both without a cycle.
- `hooks/hooks.json` UserPromptSubmit at base: entry 0 = admin-command-gate (timeout 3), entry 1 = intent-classifier (timeout 5). PROVEN (node read).
- `HOME=<temp> node test/83-hook-dispatch.test.cjs`: 4/6 passed, exit 1 at base. PROVEN (run 2026-11-26). It asserts `ups[0].hooks[0]` calls intent-classifier with timeout 2000 (:71-83), and the write-scope entry timeout 2000 (:65-68).
- `HOME=<temp> node lib/memory/brain-derivation-queue.test.cjs`: 19/19, exit 0. `HOME=<temp> node lib/memory/minto-debounce-consumer-census.test.cjs`: 5/5, exit 0. PROVEN (run 2026-11-26).
- `lib/memory/run-feynman-tests.cjs` prints `PASS <rel>` (:2118), `SKIP <rel>` (:2120), `FAIL <rel>` (:2123) per file and exits 1 on any fail (:2136). It runs `test/83-hook-dispatch.test.cjs` (:51). PROVEN.
- MCP handshake order (initialize, notifications/initialized, tools/list, then tools/call): ASSUMED from the protocol. libuv runs due timers before the poll phase: ASSUMED (uv_run order); the W0 clock leg L0 measures it.

## 3. Dispositions

| # | Verified | Disposition | DESIGN r4 |
|---|---|---|---|
| 1 | PROVEN (call order in `main()`); ASSUMED (handshake order, uv_run order) | FIXED. New clock rule with three branches: (a) cold: `receipt - connectAt < SERVED_LIMIT_MS` gives `origin = startedAt`, where `connectAt` is the time the first stdin chunk is read (a `process.stdin.once('data')` listener added in the stdio branch right after `serveStdio()`; fallback `options.transport`); with no `connectAt`, `startedAt` is used (uptime rule); (b) warm gap: `tick` records `gapStart`/`gapEnd` when two ticks are more than 100 ms apart; a request read less than 100 ms after `gapEnd` gets `origin = gapStart`; (c) else `origin = receipt`. Stated cost: a prompt sent less than 2.9 s after connect gets no routable context and one note. W0 leg L0 (scratch child process) proves both back-dating cases and the extra stdin listener; W2 repeats it on the real module. L6 fail cell names a concrete fallback (the first hook call of a process is never served). "Host sends no cancel: still correct" is deleted. | 5.1, 7.3, 9a L0, L6, 11.4 |
| 2 | PROVEN (CONTEXT 5d text; DESIGN r3 :6, :287-289, :407-408) | FIXED. Header and intro cite 5d. 6.4 is rewritten: no stop, no NEEDS_HUMAN. Rule 4 without a transcript: key `sha256(session_id + "\0" + turnKey)` with a 3,000 ms replay window (a repeat inside the window returns the stored text and writes nothing; after it the call runs in full). L1, L2 and L3 fail cells point to 5d. SUMMARY fields `or6_branch_shipped`, `or6_rules_shipped`, `or6_rule3_shipped`; the W0 acceptance reads `or6_rule3_shipped`. | header, intro, 6.3, 6.4, 9a L1-L3, 11.4 |
| 3 | PROVEN (r3 7.2 rule 3 text) | FIXED. Rule 3 counts an entry only when `u.k !== key(this turn)` and `u.at < t0 - 3000`, plus `u.at > seen.last.at + 3000` and `u.k !== seen.last.k` when `seen.last` exists; when `seen.last` is null, only the first two conditions and the 24 h bound apply. The "no race" paragraph is rewritten: each tool entry is counted by one rule on one prompt. New T4a row: `late_start` on N with the tool first; N shows no note for N; N+1 shows count 1. Residual case recorded (tool miss inside 3 s before the next prompt with the invariant record also lost). | 7.2, 7.4, 9.1 T4a |
| 4 | PROVEN (lines in section 2) | FIXED. Refresh and trip sites: `memory-events.cjs` `logEvent` (refresh before the INSERT :897-900; trip from the caught error at :901-903 by errcode `& 0xff === 5` first, then the message regex); `edges.cjs` `writeEdge` (refresh before :1103 and :1114; trip in its catch); `spine-events.cjs` operator INSERT :292-296 (refresh before the first `run`); `selector-telemetry.cjs` needs no edit (its one write goes through `logEvent`; its trip at :265 stays). `refreshBusyTimeout(db)` and `isBusyError(err)` move to `hook-busy-cap.cjs` (zero requires, no cycle). `room-db.cjs` and `navigation.cjs` drop out of the W1 list. Rule for W0 audit additions: the W0 SUMMARY carries a statement table; every row with action `refresh` is added to the 400.5-02 file list and test before 400.5-02 starts. | 5.3, 11.2, 11.4 W1 |
| 5 | PROVEN (G11 text, CONTEXT :38; r3 9.3) | FIXED. T7 passes when prompts 1-20 have 0 `hook_cancelled` for both entries and 0 tool entries with reason `cancelled`, `server_not_answering` or `hook_not_called` (a missing tool entry reads as one of the last two). `late_start` or `deadline` entries without a `hook_cancelled` on the same prompt are IR-14 false positives, counted and reported apart, not a G11 failure. | 9.3, 9.1 T7 |
| 6 | PROVEN (runs above) | FIXED. W3 acceptance runs `lib/memory/brain-derivation-queue.test.cjs` and `lib/memory/minto-debounce-consumer-census.test.cjs` directly, and compares the runner's `FAIL <rel>` set with the base census (the after set must be a subset of the base set). Census grep: `tests test lib scripts`. 11.3 gets the row `test/83-hook-dispatch.test.cjs`: base FAIL 4/6; KNOWN, not re-pinned; its first failing line is recorded. | 11.3, 11.4 W3 |
| 7 | PROVEN (`:4258-4278`, `:4236`, `:3829`) | FIXED. Two aborts: `runOnce` aborts its own per-turn controller when its deadline timer wins the race; `dispatch()` aborts each check's controller as soon as that check's `run()` resolves, for every result (a complete turn has already written, because `runTurn` awaits `navP` at :4236). New export `turnSettled()` returns the un-raced promise; the dispatch lock waits on it. T5 leg: the internal deadline wins; assert no NAV hash and no trace write after `run()` resolves. | 5.6, 5.8, 9.1 T5 |
| 8 | PROVEN (`:3579-3614`, five call sites) | FIXED. `persistDecisionTrace` itself pushes a journal entry for every call of the turn (all five sites); `forgetUnservedTurn` marks every journaled entry `unserved: true`. `consumePriorBindingAnswer` stops its scan with no payload at an unserved entry that carries `binding_gate_payload` (it does not continue to an older gate); `binding_gate_consumed` still stops the scan, served or not. W0 census of the trace readers (list in section 2). T5 leg with a binding-gate turn. | 5.6, 9.1 T5, 11.4 W0 |
| 9 | ASSUMED (host discard after flush, UNVERIFIED) | FIXED. `markNoted` runs in the stdout callback only when `Date.now() - t0 <= NOTED_LIMIT_MS` (2,500 ms); else `noted` stays false and the note shows again (worst case once more). T4a leg: a slow fake router that ends at 2,800 ms; the note shows again on the next prompt. | 3 step 5, 7.2, 9.1 T4a |
| Nit | PROVEN (r3 4.1 step 7, 5.8) | FIXED. One order in 4.1 and 5.8: answer, then `setImmediate` (served decision and ledger append), then wait for every started check to settle (bounded by `origin + 5000`), then `forgetUnservedTurn` when not served, then release. | 4.1, 5.8, 1 |
| gap | PROVEN (`:4119-4122`) | FIXED. A trace journal entry is `{path, kind:'trace', ts, entry_kind, turn}`; `turn` is the entry's `turn` or null. | 5.6 |

## 4. Scope input for the owner direction "r4, then a scope check"

DESIGN r4 section 12 "Simpler alternative considered" names the smallest design that would also stop the UserPromptSubmit timeouts (the plan 13 command dispatcher, one process, no server tier) and states which locked rulings it fails (G5, G6, G7 as written; G3 and G2 record its retirement). This is input for the scope reviewer, not a decision.
