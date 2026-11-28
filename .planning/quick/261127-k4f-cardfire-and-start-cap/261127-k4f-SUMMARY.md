---
quick_id: 261127-k4f
phase: quick-261127-k4f
branch: work/402-cardfire-startcap
base: d80d87c5b (plan commit; parent acb4de477)
binding: 402-K4F-PLAN-ADDENDUM.md (Checker edits section wins), 402-DESIGN.md r3.1 section 7.1 and section 15
protocol: ~/.claude/protocols/agent-interaction-protocol.md
---

# Quick 261127-k4f SUMMARY: card-fire block continues the turn; session-start cap check

## 0. Written before the first edit (owner rule "deeper, not bigger", OR-47)

### 0.1 What a top professional does here that the plan does not ask

- Read the host behaviour from the host bytes, not from memory. The installed Claude Code 2.1.332 binary is on this machine. Its strings show the real Stop contract (section 0.5). This replaces the "ASSUMED" line of addendum section 9 with a PROVEN line for this host version.
- Prove each red test is red for the right reason. A red leg must fail on the defect (the `continue` key, the missing pass), not on a fixture fault. Each red line is read, not only counted.
- Keep the lock-wait test honest. A run counts only when stderr shows that the lock was held for the whole run (2 "fence exhausted" lines). Without this, a fast run proves nothing.
- Measure the baseline again at d80d87c5b instead of copying the plan table. The plan table was measured at acb4de477 by another session.
- Do not enlarge the task. Items outside the binding list go to "Open items".

### 0.2 The raw material

- Code at d80d87c5b: scripts/check-card-fire.cjs (envelope :854-890, lock constants :958-977, `withRetryStoreLock` :1120-1148, `appendInterceptLog` :1345-1371, `consumeReachedGatesForVerdict` :1417-1431, `main()` :1775-1857); scripts/on-stop :69-147 (the flag-on route, literal at :117-122); scripts/replay-card-fire.cjs `runCliStop` :396-433; lib/core/card-fire-sidechannel.cjs (read only).
- The real intercept records: the copy of the live log that the main session made (12 records, 6 sessions, 11 `reached-registry-gate-no-card`, 1 `bounded-escape-released-after-3-retries`). It stays outside the repository. Only metadata and synthetic text go into fixtures.
- The host binary: ~/.local/share/claude/versions/2.1.332 (strings read with `strings -n 8`, kept in the scratch folder).
- The existing tests that pin the old contract (grep of design 7.1): tests/test-ga4-card-fire-e2e-179.cjs:121, :537, :576; tests/test-ga4-card-fire-interceptor.cjs:188; tests/test-359-declared-arm.cjs:543. The addendum also names tests/test-341-session-start-verify-hook.cjs:207; the grep pattern of the addendum does not match it (it uses `continue: false` with a space inside a string search). It is not a card-fire assert and is not edited. No new hit.

### 0.3 Methods and tools

- Test first: each new test runs red on the unchanged tree; the red output is saved in the scratch folder and copied here.
- Real hook spawns with `spawnSync` of scripts/check-card-fire.cjs, a Stop stdin, a transcript file, and a new temp `MINDRIAN_HOME` and `CARD_FIRE_SIDECHANNEL_PATH` for each spawn.
- A lock holder child process with a live pid that rewrites the lock file every 500 ms through a temp file and a rename.
- Byte checks with `git diff --stat d80d87c5b -- <files>` for the files that must not change.
- The gate runner tests/run-all-402.sh (addendum section 7) and the outside-runner list, before and after.
- No network. No Brain call. Node built-ins only.

### 0.4 What shows the result is right, other than the executor and a reviewer

- The host binary itself: `continue: false` sets `preventContinuation`, and the Stop loop returns `stop_hook_prevented` before it reads blocking errors (section 0.5). That is the mechanism of the defect, read from the host code.
- The existing suites that the fix does not touch stay at their measured baseline (section 4 table).
- tests/test-238-retry-counter-fence.cjs, not edited, is exact in 20 of 20 runs.
- The new log field `stop_hook_active` in ~/.mindrian/card-fire-intercepts.log after 1 day of real use. That is the only independent proof of the host effect, and it is not available in this build (UNVERIFIED).

### 0.5 Claude Code hooks reference: `stop_hook_active` and `continue: false` (checker edit 8)

No network is allowed, and no local copy of the hooks reference page exists in the repository or the plugin cache. The source used is the host code of the installed version, Claude Code 2.1.332 (`strings -n 8` of the binary). The lines below are quoted from that output (minified code). PROVEN for 2.1.332 only.

1. The Stop input schema has a boolean `stop_hook_active`: `hook_event_name:P("Stop"),stop_hook_active:M(),last_assistant_message:r().optional()...`.
2. The output schema: `continue:M().describe("Whether Claude should continue after hook (default: true)`.
3. `continue: false` ends the turn before a block is used: `if(Ee.preventContinuation)return ...{reason:"stop_hook_prevented"};` comes before `if(Ee.blockingErrors.length>0){...}`. So a `decision: "block"` with `continue: false` never re-prompts the model. This is the K4 root cause, now read in host code.
4. A block without `continue: false` re-invokes the model and sets the flag: `guards:{...,stopHookActive:!0,stopHookBlockingCount:rt,...},messages:[...,...Ee.blockingErrors],...transition:{reason:"stop_hook_blocking"}`. The next Stop input is built with `stop_hook_active:g` from that guard.
5. The host advice and cap: `A hook blocked the turn from ending ${e} consecutive times...For Stop/SubagentStop hooks, check stop_hook_active in the input and return success while it's true. Set CLAUDE_CODE_STOP_HOOK_BLOCK_CAP to raise this limit.`
6. The feedback text that the model reads: `Stop hook feedback: ` (default summary `"Stop hook feedback"`).

Effect on addendum section 9: the line "Whether the host sets `stop_hook_active: true` on the Stop after a card-fire block" changes from ASSUMED to PROVEN in host code for 2.1.332. It stays UNVERIFIED in a live session, and other host versions are not read.

## 1. Result

- Commit 32d48b17c `fix(402-k4): card-fire block continues the turn; the lock wait fits the 5 s row` (24 files: 3 source, 3 moved test asserts, 2 new tests, 12 fixtures, the runner).
- Commit 46472e20a `test(402-f2): session-start cap holds on a 60-section room` (1 file).
- Base d80d87c5b. No push, no merge, no rebase, no stash.

What changed in code:
- scripts/check-card-fire.cjs: `CARD_FIRE_BLOCK_REASON` and `CARD_FIRE_BLOCK_SYSTEM_MESSAGE` constants next to `ALLOWED_ENVELOPE_KEYS`; the intercept envelope has no `continue` key; the `stop_hook_active === true` terminal pass after `deriveTurnSignals` and the `ctxHash` line (log, clear both counters, consume, pass); the log field `stop_hook_active` (true, false or null); `RETRY_LOCK_MAX_ATTEMPTS` 300 to 75 with the comment rewritten (5 s row, formula, split, 2 tables); 4 additive exports. Header and 2 notes updated.
- scripts/on-stop: line 119 reason is the fixed phrase, line 120 `continue: false,` removed, 1 `//` comment line (2 insertions, 2 deletions).
- scripts/replay-card-fire.cjs `runCliStop`: mirrors the terminal pass.
- Not changed (git diff --stat d80d87c5b prints nothing): lib/core/card-fire-sidechannel.cjs, lib/core/fork-declaration.cjs, hooks/hooks.json, tests/test-238-retry-counter-fence.cjs, scripts/session-start, lib/core/session-context-envelope.cjs, tests/test-359-prose-budget.cjs. classifyCardFire, the regex constants and the ceilings 3 and 12 are not edited (tripwires A13 pass; leg M1 asserts 3 and 12).

## 2. Exact verify commands (checker edit 9; written before they ran)

- Task 1 red: `export MINDRIAN_HOME="$(mktemp -d)"; unset TYPESAFE_API_KEY MINDRIAN_MCP_FIRST; node tests/test-402-card-fire-envelope.cjs; node tests/test-ga4-card-fire-interceptor.cjs; node tests/test-359-declared-arm.cjs`
- Lock red: `export MINDRIAN_HOME="$(mktemp -d)"; node tests/test-402-card-fire-lock-wait.cjs` at 300 attempts.
- Task 2: the same 3 commands, then `node tests/test-402-card-fire-lock-wait.cjs`, `for i in $(seq 20); do node tests/test-238-retry-counter-fence.cjs | tail -n 1; done`, `bash tests/run-all-402.sh`, the `continue: false` scan of non-comment lines of scripts/check-card-fire.cjs and of the on-stop sentinel branch, the dash scan of added lines and new files.
- Task 3: `node tests/test-402-session-start-cap.cjs`; `git diff --stat d80d87c5b -- scripts/session-start lib/core/session-context-envelope.cjs tests/test-359-prose-budget.cjs`.
- Before and after: the scratch script that runs every row of section 4 with a new temp `MINDRIAN_HOME` (acceptance without the override).

## 3. Red evidence (before the fix)

tests/test-402-card-fire-envelope.cjs on the unchanged code: 8 passed, 33 failed, exit 1.
```
FAIL U1: CARD_FIRE_BLOCK_REASON is the fixed plain phrase of K4-R2 -- export missing
FAIL U2: ... -- keys are ["decision","reason","systemMessage","continue"]
PASS U3: the degrade envelope and the pass envelope are unchanged
FAIL U4: ... -- RETRY_LOCK_MAX_ATTEMPTS export missing
FAIL A1: ... -- keys are ["decision","reason","systemMessage","continue"]
FAIL A2: ... -- keys are ["decision","reason","systemMessage","continue"]
PASS B1: an answered gate (card fired) passes, consumes the record and writes no log line
PASS C1: an unrelated gate passes and consumes the record
PASS X1: present behaviour, pinned; ... a new prompt inside 2 min with the record still kept blocks again
FAIL E1: ... -- stdout {"decision":"block",...,"continue":false}
FAIL E2: ... -- stdout {"decision":"block",...,"continue":false}
PASS F1: a Stop stdin with no stop_hook_active key keeps the old route (the X1 chain blocks)
FAIL G1: ... -- field missing
FAIL T1: ... -- continue key in { decision: 'block', reason: 'stop-gate-relevant-unanswered', continue: false, ... }
PASS R1: release dependency: the flag-on Stop route is off by default, or it has a stop_hook_active guard
FAIL M1: ... -- call sites in main: 2
PASS P0: the replay fixture folder holds 3 to 12 fixtures
FAIL P1a..P12a except P3a (keys include continue); PASS P3a (the degrade fixture); FAIL P1b..P12b (no pass)
```
Required FAIL (U1, U2, U4, A1, A2, E1, G1, T1): all red. Required PASS (U3, B1, C1, F1, X1, R1): all green. Recorded colours: E2 red, M1 red, P legs red except P3a.

tests/test-ga4-card-fire-interceptor.cjs: exit 1 at `ENVELOPE: an intercept envelope carries decision:block and no continue key (402 K4-R1)`. tests/test-359-declared-arm.cjs: `Passed: 19 / 20` (A12: a block envelope has no continue key).

tests/test-402-card-fire-lock-wait.cjs at 300 attempts: 0 passed, 5 failed.
```
FAIL W0: ... -- constants not exported (2 x 300 x 20 = 12000)
  W1 intercept: runs 20 (not counted 0), T min 12252 ms, T median 12305 ms, T max 12503 ms, U max 503 ms
  W2 degrade: runs 20 (not counted 0), T min 12299 ms, T median 12445 ms, T max 12632 ms, U max 632 ms
  W3 pass: runs 20 (not counted 0), T min 12282 ms, T median 12304 ms, T max 12335 ms, U max 335 ms
  W4 stop_hook_active pass: runs 20 (not counted 0), T min 12284 ms, T median 12297 ms, T max 12371 ms, U max 371 ms
```
So at 300 attempts the host ends the hook at 5 s on every route before it prints the envelope.

F2: tests/test-402-session-start-cap.cjs is a test of existing code (addendum change 24); it is green on the unchanged tree, as the addendum expects. No red phase applies.

## 4. After the fix

tests/test-402-card-fire-envelope.cjs: 41 passed, 0 failed (16 legs, P0, and 2 legs for each of 12 fixtures).

tests/test-402-card-fire-lock-wait.cjs at 75 attempts (the 4 lines as printed):
```
  W1 intercept: runs 20 (not counted 0), T min 3098 ms, T median 3111 ms, T max 3135 ms, U max 135 ms (attempts 75, sleep 20 ms)
  W2 degrade: runs 20 (not counted 0), T min 3097 ms, T median 3113 ms, T max 3128 ms, U max 128 ms (attempts 75, sleep 20 ms)
  W3 pass: runs 20 (not counted 0), T min 3099 ms, T median 3112 ms, T max 3150 ms, U max 150 ms (attempts 75, sleep 20 ms)
  W4 stop_hook_active pass: runs 20 (not counted 0), T min 3112 ms, T median 3178 ms, T max 3274 ms, U max 274 ms (attempts 75, sleep 20 ms)
```
Conclusive at 75. The fallback value 50 was not needed.

tests/test-238-retry-counter-fence.cjs (not edited), 20 runs at 75: 20 of 20 `PASS test-238-retry-counter-fence (6 assertions)`; each run shows exact 200 (leg A) and 40 (leg C); leg D (10) is in the 6 passing assertions.

tests/test-402-session-start-cap.cjs: 11 passed, 0 failed. Measured: rich 8,823 characters, minimal 8,735, fallback 5,500, coordinator 976 of 2,000. S12 ran (not skipped).

Gate runner `bash tests/run-all-402.sh`, full result: exit 0, `Phase 402: PASS=23 FAIL=0 SKIP=0`. Report-only group: ga4 e2e 179 exit 1 at E2E-1; relevance gate 6 passed, 5 failed; qef hook timeouts 1 FAILED (A1 shape); 359 prose budget 16 passed, 2 failed (the 2 B5 lines). All 4 are the baseline reds.

## 5. Baseline table, before (d80d87c5b) and after (46472e20a)

| Check | Before | After | Verdict |
|---|---|---|---|
| hook census | total 41; SessionStart 9, Stop 5, PreToolUse 5, PostToolUse 9, UserPromptSubmit 6 | byte-identical line | same |
| manifest --check | exit 1, 2 STALE lines | byte-identical output | red before, red after, same |
| acceptance | 22 of 25; failed version-of-record-published, harness-policies (contract-parity-larry), eureka-smoke-stack-ready | the same 3 | red before, red after, same. Differs from the plan table: install-state passes here and version-of-record-published fails (marketplace source.version is 2.0.0-beta.95, the branch expects 2.0.0-beta.93; the branch is 3 commits behind origin/main) |
| Stop schema gate | PASS, 13 files | PASS | same |
| hooks contract 391 | 25 passed | 25 passed | same |
| qef hook timeouts | 1 FAILED (A1) | 1 FAILED (A1) | red before, red after, same |
| ga4 interceptor | PASSED (27) | PASSED | same (red between the test edit and the fix, as required) |
| ga4 e2e 179 | exit 1 at E2E-1 | exit 1 at E2E-1 | red before, red after, same |
| relevance gate | 6 passed, 5 failed | 6 passed, 5 failed | red before, red after, same |
| declared arm, tripwires | 20 of 20; 4 of 4 | 20 of 20; 4 of 4 | same |
| 209 x3 | 36, 13, 4 | 36, 13, 4 | same |
| 238 corpus, 238 fence, 198 ceiling, 198 budget, 383, 346, doctor health | all pass | all pass | same |
| 357, 359 replay | 12 of 12, 26 of 26 | 12 of 12, 26 of 26 | same |
| replay bar | exit 0, known false block dogfood-0f86dd63-092046 | exit 0, same | same |
| 362 disposition | 7 of 8 (D6) | 7 of 8 (D6), same D6 text | red before, red after, same |
| run-all-179 | 1 FAILED (179-08) | 1 FAILED (179-08) | red before, red after, same |
| run-all-357 | PASS=16 FAIL=0 | PASS=16 FAIL=0 | same |
| run-all-359 | PASS=26 FAIL=1 (FORK359-08, 2 B5 lines) | the same | red before, red after, same |
| run-all-362 | PASS=21 FAIL=2 (disposition, mutation) | the same | red before, red after, same |
| k1u envelope | 35 of 35 | 35 of 35 | same |
| prose budget | 16 passed, 2 failed | 16 passed, 2 failed | red before, red after, same |
| S1 parity 384 | 3 FAILED (P2 twice, P3) | 3 FAILED | red before, red after, same |
| lx3 skip | ALL PASS | ALL PASS | same |

Note on timing: the before run of S1 parity and acceptance overlapped the creation of the untracked new test files and fixtures (no tracked file was changed then; verify-release-clean-tree and working-tree-housekeeping passed).

## 6. Research corrections and host record

- F2: the cap is from quick 261013-k1u (commit e3afaaca0). The plan measured 8,943, 8,970 and 8,903 characters; this run measured 8,823 (rich) and 8,735 (minimal) on the 60-section fixture. The value moves with room state.
- K4 host record (plan, Claude Code 2.1.332): 1 gate gave 3 blocks on 3 user turns and 0 cards. Section 0.5 shows the host code that causes it: continue:false returns `stop_hook_prevented` before the block is read.

## 7. Fixtures (tests/fixtures/402-card-fire/, newest first)

| File | Log reason | Hand class |
|---|---|---|
| p01 | reached-registry-gate-no-card | open question |
| p02 | reached-registry-gate-no-card | no fork |
| p03 | bounded-escape-released-after-3-retries | no fork (degrade, not a block) |
| p04 to p10 | reached-registry-gate-no-card | no fork |
| p11 | reached-registry-gate-no-card | prose fork |
| p12 | reached-registry-gate-no-card | no fork |

Blocks with hand class "no fork": 9 of 11 blocks (1 prose fork, 1 open question). This is the base for the measure after the 404 pilots; it is not a gate. Each fixture keeps metadata fields and synthetic text only; the hand class was assigned by the executor from a private read of the log copy (ASSUMED judgment, 1 reader). p09 was a borderline case ("if that works for you" proposal) and is classed "no fork".

## 8. Deviations

- Commit trailer: the plan asks for `Co-Authored-By: Claude Fable 5.2`. The commits carry `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, the model that ran this build. So the plan grep for the Fable trailer prints 0.
- The P fixture legs use the test's fixed PROMPT and REL subject for every fixture (the log holds no prompt or subject), and seed the per-gate counter at 3 for the degrade fixture.
- The Write tool turned 2 escape sequences into literal dash characters in a regex; the dash scan found it and it was fixed before the commit.

## 9. Open items (not done here)

(a) The flag-on route (`MINDRIAN_MCP_FIRST`) has no `stop_hook_active` guard. Leg R1 holds the release dependency. Owner: the phase that turns the flag on by default.
(b) The open case of addendum section 2: a person stops the continued turn before its Stop arrives and types again inside 2 min; the record can block 1 more time. Pinned by leg X1.
(c) F2 fallback gaps (bash fallback route only, runs when the node encoder gives no output or `MINDRIAN_SESSION_CONTEXT_FALLBACK=1`): the cut `${context:0:8500}` cuts bytes in a C locale and can split a character; no full context file is saved; the note names no file. Measured 5,500 characters on the 60-section fixture, under the cap.
(d) The host effect is UNVERIFIED until a session runs the fixed hook: read the new log field `stop_hook_active` after 1 day of use.
(e) A CHANGELOG line is owed under 2.0.0-beta.96 at merge time.
(f) After the merge of origin/main, the manifest row, the acceptance point eureka-smoke-stack-ready, and version pins can move; run the gate runner and the outside list again.
(g) The open debug file .planning/debug/recurring-reach-card-defeats-relevance-gate-and-hsi-clamp-garbage.md (its 2026-07-25 entries match this mechanism).

Known risks (checker edit 10, not fixed): a 20 ms sleep can last longer on Windows, so the 4,000 ms bound is not proven there; a block by another Stop hook sets `stop_hook_active`, and a real fork on that Stop is consumed with no block; on the declared-fork route 1 stale per-gate count can stay for 24 h.

## 10. Report

STATUS: DONE
CHANGED: 32d48b17c (scripts/check-card-fire.cjs, scripts/on-stop, scripts/replay-card-fire.cjs, 3 moved test asserts, tests/test-402-card-fire-envelope.cjs, tests/test-402-card-fire-lock-wait.cjs, tests/fixtures/402-card-fire/p01-p12.json, tests/run-all-402.sh); 46472e20a (tests/test-402-session-start-cap.cjs); this SUMMARY (commit below).
VERIFIED: bash tests/run-all-402.sh exit 0, PASS=23 FAIL=0 SKIP=0; lock wait at 75 T max 3,274 ms; test-238 exact 20 of 20; every baseline row the same before and after.
UNVERIFIED: the host effect in a live session; Windows and macOS lock timing; host versions other than 2.1.332.
RISKS: the flag-on route has no loop guard (leg R1 blocks a default change); the X1 open case; the known risks above.
NEXT: Merge the branch after origin/main is integrated, run the gate runner again, and add the CHANGELOG line.

## 11. Follow-up after the staging finding: lock attempts 75 to 50 (2026-11-28)

Instruction: addendum 402-K4F-PLAN-ADDENDUM.md, last section. The staging run had T 4,613 ms and U 1,613 ms at 75 attempts under load from other work. The fixed fallback of K4-R5 applies.

- Test (commit b8530200d): tests/test-402-card-fire-lock-wait.cjs asserts T at most 4,000 ms, the sleep part at most 2,000 ms and U at most 2,000 ms. The held-lock case runs 2 times: quiet arm (W1 to W4) and made-load arm (L1 to L4, 1 busy worker for each CPU core, 12 on this machine). `--arm quiet|load|both`, default both. Each worker stops when its parent ends or after 900 s; the test kills all workers at the end of the arm, on an exception and on exit.
- Red at 75, load arm, 5 runs: exit 1 in 5 of 5. The failing leg is W0 only (2 x 75 x 20 = 3,000 ms above 2,000 ms). L1 to L4 passed in 5 of 5: T max per run 3,177 / 3,136 / 3,146 / 3,165 / 3,315 ms, U max 315 ms. FACT: the made load did not reproduce the staging failure in 5 runs. The change is kept; the staging record is the evidence (as the decision says).
- Fix (commit below): `RETRY_LOCK_MAX_ATTEMPTS = 50` in scripts/check-card-fire.cjs; the comment block gives the formula, the 2,000 / 2,000 split, why 50 and the numbers.
- Green at 50, both arms, 5 runs: exit 0 in 5 of 5 (9 passed, 0 failed each). T max over 5 runs: quiet 2,229 / 2,152 / 2,229 / 2,162 ms; load 2,240 / 2,148 / 2,206 / 2,157 ms (intercept / degrade / pass / stop_hook_active pass); U max 240 ms.
- tests/test-238-retry-counter-fence.cjs (not edited), 20 runs at 50: exit 0 in 20 of 20; each run exact 200 (leg A), 40 (leg C), 10 (leg D).
- `bash tests/run-all-402.sh` at 50: exit 0, `Phase 402: PASS=23 FAIL=0 SKIP=0`. Report-only group the same as the baseline: ga4 e2e 179 exit 1 at E2E-1; relevance gate 6 passed, 5 failed; qef hook timeouts 1 FAILED; 359 prose budget 16 passed, 2 failed.
- Stray load workers after every batch: 0 (pgrep).
- Evidence files (ignored by git): evidence-lockwait/ in this folder (red-75-load-run1..5, green-50-both-run1..5, test238-50, run-all-402-at-50).
- Not changed: tests/test-402-card-fire-envelope.cjs still asserts the sleep part at most 3,000 ms; 2,000 ms passes it. The made load is CPU only; disk and memory pressure are not made. Windows and macOS timing stay UNVERIFIED.
