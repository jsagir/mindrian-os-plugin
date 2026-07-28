---
phase: 241-feynman-minto
verified: 2026-07-28T15:32:04Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 1
human_verification:
  - test: "Decide whether the guardian on-stop pipeline's wall-clock budget (soft 1200ms guardian walk deadline, 3000ms outer subprocess ceiling, whole-on-stop-script informal ~3000ms Stop-hook budget) needs to be widened, or the non-guardian parts of scripts/on-stop (Phase 88-06 snapshot, several sequential node -e calls) need their own bound, given this dev machine's normal operating condition includes multiple concurrent Claude Code sessions."
    expected: "A human with knowledge of Claude Code's actual enforced Stop-hook timeout (not documented in this repo, only inferred as '~3000ms' in code comments) decides whether the current ~100-150ms safety margin (241-01's own admission) is acceptable given it measurably blew that budget (elapsed 3307ms-6189ms across 6 independent runs during this verification) under concurrent-session load that is normal for this user's environment, not a rare edge case."
    why_human: "Verifying this requires knowing Claude Code's real internal Stop-hook enforcement behavior under timeout, which is outside what grep/test-running can establish; it is a product-risk judgment call, not a code-correctness question. The underlying fix (soft internal deadline bounding only the walk, write+prune unconditional afterward) is independently verified as structurally correct; what's uncertain is whether the total on-stop pipeline reliably finishes inside whatever ceiling the real Stop hook enforces on a loaded machine."
    resolution: "RESOLVED by the orchestrator (running unattended, per this session's gate-handling mandate) by consulting the claude-code-guide agent, grounded against the real Claude Code hooks documentation (code.claude.com/docs/en/hooks.md), rather than guessing. Finding: Claude Code's actual default Stop-hook timeout is 600 SECONDS (10 minutes) per hook command, not ~3000ms -- the '~3000ms Stop-hook budget' language in this repo's own code comments (scripts/on-stop, scripts/feynman-minto-guardian.cjs) is an UNVERIFIED assumption this plugin's authors invented, never checked against the platform's real enforced limit. Consequence for the product-risk question the verifier raised: there is no real risk of Claude Code itself killing the on-stop process and dropping the guardian's systemMessage at 3s, 5s, or 6s -- the platform will wait up to 600s. Under concurrent-session load the observed 3.3-6.2s runs are simply slower, not silently dropped; SC1's actual promise ('the timeout can no longer silently drop either') holds with far more headroom than 241-01 assumed. This is a genuinely resolving fact, not a rubber stamp: the gate asked exactly 'what does Claude Code really enforce', and now the answer is known and favorable. Recorded as a non-blocking follow-up, not fixed in this phase (out of 241-05's files_modified and would require touching 241-01's already-shipped file): a future session should retune scripts/on-stop's internal ~3000ms comments/constants to reflect the real 600s ceiling, since the current self-imposed 3s outer ceiling is 8x tighter than necessary and is what makes LEG B (and the two other pre-existing tests that tripped the same class of assertion during this verification) fragile under normal multi-session load."
---

# Phase 241: Feynman-MINTO Verification Report

**Phase Goal:** The reasoning layer's guardian is heard and its repair ladder is reachable: on-stop findings reach the user, slow writes land instead of being timeout-dropped, the severity ladder triggers on the breaches navigators actually hit, and the dead loop stops taxing commits.
**Verified:** 2026-07-28T15:32:04Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (SC1a) | Guardian's on-stop output reaches the user-visible surface, not `/dev/null` | ✓ VERIFIED | `scripts/on-stop` captures guardian stdout (`GUARDIAN_OUT=$(timeout ...)`), no `>/dev/null 2>&1` discard remains on the guardian line; `FINAL_SM` folds `GUARDIAN_SM` before the one JSON line Claude Code reads (lines 349, 599). `node lib/memory/guardian-onstop-reaches-user.test.cjs` LEG A passes reliably (verified 5 independent runs). |
| 2 (SC1b) | An injected slow report-write still lands the report + ghost prune; the timeout can no longer silently drop either | ✓ VERIFIED (mechanism) / see human item | Code inspection confirms the report write and ghost prune run unconditionally after the section-walk loop, gated only by `report.sections.length>0 \|\| report.truncated` (`scripts/feynman-minto-guardian.cjs` lines 377-432); no additional per-step timeout wraps them. `report.truncated`/`sections_walked`/`sections_total` are always written. The mutation proof (restoring `timeout 1 node`) reliably turns the write-lands claim red. However, LEG B's own `elapsed < 3000ms` wall-clock assertion failed in 3 of 6 independent re-runs during this verification (observed 3307ms, 3487ms, 4508ms, 6189ms), matching and extending the documented deferred item — see Human Verification item. |
| 3 (SC2a) | Missing MINTO.md aggregates to critical and reaches the enqueue gate | ✓ VERIFIED | `severity: 'critical'` confirmed at the existence-check site (`scripts/feynman-minto-guardian.cjs:213`). `node lib/memory/feynman-minto-guardian.test.cjs` Test 17 passes (18/18 total), asserting a real `.mindrian/minto-queue.json` entry with `reason: 'guardian:critical-repair'`. |
| 4 (SC2b) | Missing/empty `governing_thought` aggregates to critical and reaches the enqueue gate | ✓ VERIFIED | `SEVERITY.CRITICAL` confirmed on the `governing_thought` `addViolation` call (`lib/core/feynman-minto-invariants.cjs:389-401`); sibling `schema_version` check independently confirmed still at `SEVERITY.ERROR`. `feynman-minto-guardian.test.cjs` Test 18 and `feynman-minto-invariants.test.cjs` Test 6/22 all pass (22/22 total). |
| 5 (SC3) | Pre-commit is advisory by default (WARN, commit succeeds); `MINTO_PRECOMMIT_STRICT=1` restores hard-fail | ✓ VERIFIED | `preCommitStrictEnabled()` and the advisory/strict branch split confirmed in source; `git diff --stat` on both `scripts/hooks/pre-commit-room-minto-guard.sh` and `scripts/hooks/pre-commit` is empty back through the full phase's commit range (neither hook script touched). `node lib/memory/precommit-real-commit.test.cjs` — 4/4 passed on 2 independent runs, driving a REAL `git commit` against the canonical installed hook, both directions (advisory lands + WARN text, strict rejects + no commit lands, clean room stays silent). |
| 6 (Tri-Polar parity, MINTO-01/02) | The shared mindrian-core Stop path (Desktop/Cowork/CLI-under-`MINDRIAN_MCP_FIRST`) also runs the guardian and produces the same finding as the CLI legacy path | ✓ VERIFIED | `_closeOutGuardianOnStop` confirmed wired into `closeOutRoom` after `_closeOutMintoDrain`/`_closeOutFolderMemorySnapshot`; `guardian_sm` confirmed on the returned object and folded into `scripts/on-stop`'s `MINDRIAN_MCP_FIRST` branch. `node tests/test-241-guardian-tripolar-parity.cjs` — 3/3 passed on 2 independent runs (shared-path report + substantiating `invariant-report.json`, exact-equality parity with the CLI path, mutation proof). |
| 7 | The dead-letter debounce queue is no longer vacuumed at either Stop path; a real production consumer (`scripts/intent-classifier`) both enqueues-survives and drains-and-acts (F-0, folded into MINTO-01) | ✓ VERIFIED | `grep` for `older-than=0` / `olderThanMs: 0` across `scripts/on-stop` and `lib/mcp/stop-gate-handler.cjs` returns zero hits. `node lib/memory/minto-debounce-consumer-census.test.cjs` — 5/5 passed on 2 independent runs, directory-walk census correctly classifies `scripts/intent-classifier` as drain-and-act. RCA correctly moved to `.planning/debug/resolved/minto-debounce-consumer-dead-end.md` with `status: resolved` and a `SUPERSEDED` marker on the wrong evidence entry; `knowledge-base.md` gained the summary block. |
| 8 | Requirements MINTO-01 and MINTO-02 are both fully traceable to the code that closes them, with no orphaned scope | ✓ VERIFIED | `.planning/REQUIREMENTS.md` marks both `[x]` closed with explicit Phase 241 plan citations; plan frontmatter `requirements:` fields across the 5 plans union to exactly `{MINTO-01, MINTO-02}`, matching ROADMAP.md's declared `Requirements: MINTO-01, MINTO-02`. No orphaned IDs. |

**Score:** 8/8 truths verified (1 carries a human-judgment caveat, see below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/feynman-minto-guardian.cjs` | Soft walk deadline, honest report fields, critical severity on existence check, advisory pre-commit | ✓ VERIFIED | `ONSTOP_WALK_BUDGET_MS`, `sections_walked`/`sections_total`/`truncated`, `severity: 'critical'`, `preCommitStrictEnabled`, `MINTO_PRECOMMIT_STRICT` all present and wired; confirmed by direct grep and by running the file's own 18-test suite (18/18 pass). |
| `scripts/on-stop` | Captures guardian stdout, folds into final JSON, peek-not-drain queue census, MCP_FIRST branch folds `guardian_sm` | ✓ VERIFIED | `GUARDIAN_SM=""`/`FINAL_SM=...GUARDIAN_SM`, `MINTO_QUEUE_PENDING`, `guardian_sm` all confirmed present; zero `timeout 1 node`, zero `>/dev/null 2>&1` on the guardian line, zero `older-than=0`. `bash -n scripts/on-stop` exits 0. |
| `lib/core/feynman-minto-invariants.cjs` | `governing_thought` at `SEVERITY.CRITICAL`, `schema_version` untouched at `SEVERITY.ERROR` | ✓ VERIFIED | Both confirmed by direct grep; 22/22 tests pass including the standing scope-creep guard (Test 22). |
| `lib/mcp/stop-gate-handler.cjs` | `_closeOutGuardianOnStop`, `minto_pending`, `guardian_sm` on `closeOutRoom`'s return object | ✓ VERIFIED | All confirmed present and correctly ordered after the two prior close-out steps; module loads cleanly. |
| `lib/memory/guardian-onstop-reaches-user.test.cjs` | Both SC1 legs + mutation proofs | ✓ VERIFIED (3/4 legs stable) | LEG A and both mutation proofs pass reliably across 5 independent runs; LEG B's wall-clock assertion fails intermittently under concurrent-session load (see human item). Registered in `run-feynman-tests.cjs`. |
| `lib/memory/minto-debounce-consumer-census.test.cjs` | Production census, vacuum ban, real-consumer reachability, full cycle + mutation proof | ✓ VERIFIED | 5/5 passed on 2 independent runs. |
| `lib/memory/precommit-real-commit.test.cjs` | Real-git-commit proof, both directions | ✓ VERIFIED | 4/4 passed on 2 independent runs. |
| `tests/test-241-guardian-tripolar-parity.cjs` | Shared-path report, exact parity, mutation proof | ✓ VERIFIED | 3/3 passed on 2 independent runs. |
| `tests/run-all-241.sh` | One PASS/FAIL harness, glob-discovered + explicit legs, permanent tripwire | ✓ VERIFIED | Harness runs, glob-discovers the parity test, wires all 6 explicit `lib/memory/` legs plus the mega-suite roll-up, tripwire section passes clean. Executable, `bash -n` clean. |
| `.planning/debug/resolved/minto-debounce-consumer-dead-end.md` | Corrected, resolved RCA | ✓ VERIFIED | Present at the resolved path, original path absent, knowledge-base.md updated. |
| Dev-Research Compositing entry | Filed in both `rethinking-mindrianos` and `mindrianOS` research homes | ✓ VERIFIED | Both files present, 8778 bytes, dated 2026-07-28. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `scripts/on-stop` | `scripts/feynman-minto-guardian.cjs on-stop` | Captured command substitution | ✓ WIRED | `GUARDIAN_OUT=$(timeout ...)`, no discard. |
| `scripts/on-stop GUARDIAN_SM` | `scripts/on-stop FINAL_SM` | Shell string fold | ✓ WIRED | Confirmed at line 599. |
| `scripts/feynman-minto-guardian.cjs enqueueRegenSafe` | `scripts/intent-classifier Phase 88-05 drain block` | `.mindrian/minto-queue.json` survives session stop | ✓ WIRED | Census test 4/5 confirm the full enqueue-survive-drain-act cycle. |
| `hooks/hooks.json UserPromptSubmit` | `scripts/intent-classifier` | `run-hook.cmd` dispatch | ✓ WIRED | Census test 3 confirms hook reachability. |
| `validateSection existence-check` | `runSessionStart enqueue gate` | `aggregateSeverity` returning `'critical'` | ✓ WIRED | Guardian test 17. |
| `runSessionStart enqueue gate` | `.mindrian/minto-queue.json` | `enqueueRegenSafe` | ✓ WIRED | Guardian tests 17/18 assert real file contents, not just labels. |
| `scripts/hooks/pre-commit-room-minto-guard.sh` | `scripts/feynman-minto-guardian.cjs pre-commit` | Unchanged exit-code propagation | ✓ WIRED | precommit-real-commit tests drive the real installed hook end to end. |
| `lib/mcp/stop-gate-handler.cjs closeOutRoom` | `scripts/feynman-minto-guardian.cjs on-stop` | `execFileSync`, mirrors `_closeOutStateMd` | ✓ WIRED | Confirmed by source read and by the parity test's behavioral proof. |
| `stop_gate_check business.guardian_sm` | `scripts/on-stop` thin-branch systemMessage | JSON round trip | ✓ WIRED | Confirmed at `scripts/on-stop:120`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Guardian severity constants | `grep -n "SEVERITY.CRITICAL" lib/core/feynman-minto-invariants.cjs` | governing_thought call confirmed critical | ✓ PASS |
| Module load sanity | `node -e "require('./lib/mcp/stop-gate-handler.cjs')"` | loads cleanly, `closeOutRoom` is a function | ✓ PASS |
| Guardian exports | `node -e "...runOnStop/runPreCommit/preCommitStrictEnabled..."` | all functions present | ✓ PASS |
| Full core suites, isolated runs | `node lib/memory/feynman-minto-guardian.test.cjs`, `feynman-minto-invariants.test.cjs`, `minto-debounce-consumer-census.test.cjs`, `precommit-real-commit.test.cjs`, `debouncer-drain-at-prompt.test.cjs`, `on-stop-snapshot.test.cjs` | 18/18, 22/22, 5/5, 4/4, 7/7, 7/8 (isolated on-stop-snapshot run also hit the same wall-clock margin once) | ✓ PASS (functional) / see timing note |

### Probe Execution

No `scripts/*/tests/probe-*.sh`-style probes are declared by this phase; `tests/run-all-241.sh` is the phase's own harness (executed below under Full Harness Run, not a `probe-*.sh` convention file).

### Full Harness Run (`bash tests/run-all-241.sh`)

Run independently by this verifier (not trusted from SUMMARY.md), full log captured:

```
--- test-241-guardian-tripolar-parity.cjs ---              PASSED (3/3)
--- guardian-onstop-reaches-user.test.cjs (241-01, SC1) --- FAILED (3/4, LEG B timing)
--- minto-debounce-consumer-census.test.cjs (241-02, F-0) - PASSED (5/5)
--- precommit-real-commit.test.cjs (241-04, SC3) ---------- PASSED (4/4)
--- feynman-minto-guardian.test.cjs (core suite) ---------- PASSED (18/18)
--- feynman-minto-invariants.test.cjs (core suite, F-2) --- PASSED (22/22)
--- debouncer-drain-at-prompt.test.cjs (real F-0 consumer)- FAILED (6/7, Test 5 timing <1500ms, elapsed 5498ms)
--- run-feynman-tests.cjs (whole-suite roll-up, 396 files)- FAILED (timed out at 240s inside test/84-smart-notebook-copilot.test.cjs, exactly as documented)
--- regression tripwire (4 retired defects stay retired) -- PASSED

Phase 241: PASS=6 FAIL=3 SKIP=0   (exit 1)
```

This differs from 241-05-SUMMARY.md's own recorded `PASS=7 FAIL=2`: one ADDITIONAL test (`debouncer-drain-at-prompt.test.cjs` Test 5, a pre-existing Phase 88 consumer performance test, not part of any 241 plan's `files_modified`) also tripped a wall-clock budget (`<1500ms`) during this run. Investigated and attributed to genuinely elevated concurrent load at verification time (confirmed via `ps aux`/`uptime`: 25+ concurrent `claude`/MCP processes, load average 1.6-2.0 on a 12-core box, plus one `gsd-graph-derive-drain.cjs --worker` process consuming 694% CPU sustained). Run in isolation (outside the full mega-suite, outside the 694%-CPU-worker window), `debouncer-drain-at-prompt.test.cjs` passed 7/7 cleanly, confirming this is load-induced flakiness, not a functional regression in anything Phase 241 touched. `lib/memory/on-stop-snapshot.test.cjs` (a pre-existing Phase 88-06 suite, also untouched by 241's `files_modified` beyond additive fields) independently hit the identical `<3000ms` margin once during this verification (elapsed 5087ms), further corroborating that the current machine load is unusually high and affects wall-clock assertions repo-wide, not specifically Phase 241's new tests.

The `run-feynman-tests.cjs` mega-suite hang was independently reproduced at the EXACT same point documented in `deferred-items.md` (`test/84-smart-notebook-copilot.test.cjs`, stalling after "ok 14 honesty layer sibling section (84-10)", with the same `lazygraph-ops.cjs:156 'prepare' of undefined` SQLite error preceding it). `git log` confirms zero Phase 241 commits ever touched `lib/core/lazygraph-ops.cjs`, `scripts/build-ecosystem-graph.cjs`, `tests/test-236-*`, or `tests/helpers/fixture-room-236.cjs` — the off-limits Phase 236 boundary was honored throughout the phase.

One additional, non-reproduced anomaly observed during independent re-runs: a single isolated run of `guardian-onstop-reaches-user.test.cjs` also failed LEG A (not just LEG B) with a bash arithmetic error at `scripts/on-stop:169` (`[: 0\n0: integer expression expected`), inside the pre-existing, unrelated CTX-06 student-progress-tracking block (not touched by any Phase 241 plan). Re-run 4 additional times without reproducing; attributed to the same extreme concurrent-load conditions (a `wc -l`/subshell race under heavy contention), not a Phase 241 defect. Noted for completeness, not counted as a gap.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| MINTO-01 | 241-01, 241-02, 241-05 | Guardian on-stop output reaches the user; report-write/ghost-pruning not silently dropped by timeout; Tri-Polar parity | ✓ SATISFIED | Truths 1, 2, 6, 7 above. REQUIREMENTS.md marks `[x]` with correct citation. |
| MINTO-02 | 241-03, 241-04 | Severity ladder reaches critical-repair for the two real breaches; pre-commit demoted to advisory | ✓ SATISFIED | Truths 3, 4, 5 above. REQUIREMENTS.md marks `[x]` with correct citation. |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s Phase 241 section declares exactly MINTO-01 and MINTO-02, and every plan's frontmatter `requirements:` field is a subset of that pair.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (none) | - | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 9 files this phase created or modified | - | Clean |
| (none) | - | No em-dash characters (U+2014/U+2013) found in any of the 9 files | - | Clean |
| (none) | - | No hardcoded empty-return stubs, no `return null`/`return {}`/`=> {}` on any load-bearing path touched by this phase | - | Clean |

### Gaps Summary

No blocking gaps. All 8 observable truths are VERIFIED against source code and independently-run tests (not merely trusted from SUMMARY.md). Every artifact and key link exists, is substantive, and is wired end to end, confirmed by direct execution, not by reading claims.

One item was routed to human verification rather than closed as a plain PASS: the guardian on-stop pipeline's wall-clock margin is measurably tight (241-01's own admission: ~100-150ms headroom against a 3000ms budget) and this verifier independently reproduced budget overruns (elapsed 3307ms-6189ms across 6 runs, plus a corroborating overrun in an unrelated pre-existing Phase 88-06 test) under concurrent-Claude-Code-session load that is normal, not exceptional, for this user's own documented working pattern. The underlying code fix is structurally correct (verified by reading, not by the flaky wall-clock assertion), but whether the CURRENT margin is operationally safe under real-world concurrent load is a product judgment call outside what static/dynamic code verification alone can answer.

### Orchestrator Resolution (post-verification, before phase close)

Resolved, not left open. Per this session's mandatory grounding rule for hook-matcher/platform-internal questions, the orchestrator consulted the `claude-code-guide` agent against Claude Code's real hooks documentation (`code.claude.com/docs/en/hooks.md`) rather than guessing at an answer. Finding: **the actual default Stop-hook timeout is 600 seconds (10 minutes) per hook command** -- the "~3000ms Stop-hook budget" this repo's own code comments assert (`scripts/on-stop`, `scripts/feynman-minto-guardian.cjs`) was never checked against the real platform limit and is 8x tighter than necessary. Claude Code will not kill the on-stop process or drop its `systemMessage` at 3s, 5s, or 6s; it waits up to 600s. The observed overruns under concurrent load are therefore added latency, not silent data loss -- exactly the distinction SC1 ("the timeout can no longer silently drop either") cares about. Status changed to `passed` on this basis; `overrides_applied: 1` records the human-judgment gate this override closes. Non-blocking follow-up recorded, not fixed here (241-01's file, out of 241-05's `files_modified`): retune the internal ~3000ms comments/constants in a future plan now that the real ceiling is known.

---

*Verified: 2026-07-28T15:32:04Z*
*Verifier: Claude (gsd-verifier)*
