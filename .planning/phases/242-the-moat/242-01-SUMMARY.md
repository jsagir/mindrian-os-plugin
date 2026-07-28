---
phase: 242-the-moat
plan: 01
subsystem: storage
tags: [sqlite, transactions, moat, crash-safety, wal, mutation-proof]
requirements: [MOAT-01]
canon_parts: [7, 9]
dependency_graph:
  requires:
    - "lib/core/lazygraph-ops.cjs openGraph (WAL enabled at open time, READ ONLY this phase)"
    - "lib/core/node-insert.cjs insertNode (issues no BEGIN of its own)"
  provides:
    - "Atomic HSI_CONNECTION + REVERSE_SALIENT edge rewrite"
    - "MINDRIAN_HSI_CRASH_TEST_DELAY_MS crash-injection seam (test-only, production-inert)"
    - "HSI-CRASH-SEAM: in-transaction stderr protocol marker"
    - "tests/run-all-242.sh phase aggregator (glob discovery, zero per-plan edits)"
  affects:
    - "lib/core/futures/orchestrator.cjs runHsiScan (calls the script via execFileSync; contract unchanged)"
tech_stack:
  added: []
  patterns:
    - "Explicit BEGIN/COMMIT/ROLLBACK (the only transaction idiom node:sqlite DatabaseSync supports)"
    - "Synchronous Atomics.wait park as a SIGKILL-able test seam"
    - "Glob-discovery phase aggregator with a self-testing grep gate"
key_files:
  created:
    - tests/test-242-hsi-to-graph-transaction.cjs
    - tests/run-all-242.sh
  modified:
    - scripts/hsi-to-graph.cjs
decisions:
  - "Open Question 1 DECLINED: no shared withTransaction helper, lib/core/lazygraph-ops.cjs stays untouched"
  - "Crash seam is an env-var delay plus a one-shot stderr marker, so the test kills at a deterministic point instead of racing a timer"
  - "The success stderr line moved AFTER the COMMIT so the script cannot report success about an uncommitted rewrite"
metrics:
  tasks: 3
  duration: ~35 min
  completed: 2026-07-28
  tests_added: 3
  suite_runtime_seconds: 2.3
---

# Phase 242 Plan 01: HSI-to-Graph Transaction Wrap Summary

One-liner: the HSI scoring-layer rewrite now rides a single BEGIN/COMMIT/ROLLBACK, so a SIGKILL mid-rewrite leaves the prior layer byte-identical and a concurrent reader only ever sees 6 or 10 edges, never 0.

## What Changed and Why

`scripts/hsi-to-graph.cjs` used to DELETE every `HSI_CONNECTION` and `REVERSE_SALIENT` edge and only then rewrite them across two loops, with no transaction anywhere. A kill between the DELETE and the last write left the room permanently at zero scoring edges. The scoring layer IS the moat, so the moat was erasable by a badly timed Ctrl-C.

The fix is one transaction spanning the DELETE and BOTH write loops. Three details carry weight beyond the wrap itself:

1. **Scope of the wrap.** Wrapping only the two DELETEs would have reintroduced the identical bug in a narrower window. The BEGIN sits before the first DELETE and the COMMIT after the last `upsertEdge.run()` of the second loop.
2. **The success line moved after the COMMIT.** Previously the script could print `HSI: wrote N connection edges` about work that never landed. That is the same confident-success-over-an-empty-result shape STATE.md already records for Phase 233, so the fix should not be able to reproduce it.
3. **`insertNode` stays, `indexArtifact` stays out.** Verified by direct grep that `lib/core/node-insert.cjs` contains no BEGIN/COMMIT/ROLLBACK/SAVEPOINT, so calling it inside the wrap cannot nest a transaction. `indexArtifact` opens its own BEGIN and must never be substituted here.

## Grounding (done before writing the code)

Context7 MCP tools were absent from this executor's toolset (upstream bug anthropics/claude-code#13898 strips MCP tools from agents with a `tools:` restriction) and the `ctx7` CLI is not installed on this machine. Per the documented fallback order, and explicitly NOT via `npx --yes` of an unverified package, the same primary sources Context7 proxies were fetched live this session:

| Claim | Source | Result |
|---|---|---|
| `DatabaseSync` has no `.transaction(fn)` helper | nodejs.org/docs/latest-v22.x/api/sqlite.html | CONFIRMED. The full member list is `close/location/exec/function/isOpen/isTransaction/open/prepare/createSession/applyChangeset/[Symbol.dispose]`. Zero matches for `.transaction(`. The only transaction-related member is the read-only boolean `database.isTransaction` (v22.16.0, a `sqlite3_get_autocommit()` wrapper) which reports state but never opens one. Manual BEGIN/COMMIT/ROLLBACK is the only idiom available. |
| `timeout` is irrelevant to atomicity (Pitfall 2) | same | CONFIRMED verbatim: "The busy timeout in milliseconds. This is the maximum amount of time that SQLite will wait for a database lock to be released before returning an error. Default: 0." Contention handling only. No `timeout:` was added; the Task 1 verify command fails the build if one appears. |
| WAL reader visibility | sqlite.org/wal.html | CONFIRMED verbatim: "When a read operation begins on a WAL-mode database, it first remembers the location of the last valid commit record in the WAL... for any particular reader, the end mark is unchanged for the duration of the transaction." A reader can only ever see the last valid COMMIT, which is exactly what makes Leg B's `{6, 10}`-only assertion sound rather than lucky. |
| WAL is a SQLite property, not a Node one | nodejs.org sqlite.html | CONFIRMED by absence: zero `WAL`/`journal_mode` matches on the Node page, so sqlite.org is correctly the authority for the visibility half. |

## Required Re-Check Exit Codes

Both live re-checks the plan mandates were actually run, not asserted.

### 1. BEGIN/COMMIT comment-out mutation re-check

| State | Command | Exit code |
|---|---|---|
| `conn.prepare('BEGIN').run();` and `conn.prepare('COMMIT').run();` commented out | `node tests/test-242-hsi-to-graph-transaction.cjs` | **1** |
| both lines restored | `node tests/test-242-hsi-to-graph-transaction.cjs` | **0** |

With the wrap removed, Leg A failed on exactly the intended assertion: `a crash inside the rewrite must leave the prior scoring layer byte-identical` (3 of 3 legs red). After restore, `git diff HEAD -- scripts/hsi-to-graph.cjs` was empty, proving the restore was byte-identical to the committed version and not an approximate retype.

### 2. Glob-discovery rename re-check

| State | Command | Exit code |
|---|---|---|
| test renamed to `tests/tmp-242-x.cjs` (outside the glob) | `bash tests/run-all-242.sh` | **1**, printing `!!! no tests/test-242-* files discovered` |
| renamed back to `tests/test-242-hsi-to-graph-transaction.cjs` | `bash tests/run-all-242.sh` | **0** |

Additionally, the zero-edit contract was proven positively rather than by assertion: a throwaway second `tests/test-242-globproof.cjs` was dropped in, the aggregator discovered and ran it with no edits to the harness (PASS went 3 to 4), and the throwaway was deleted. Plan 02's `tests/test-242-kuzu-reintroduction-gate.cjs` will therefore be picked up automatically.

## Scope Confirmation

`git diff --stat lib/` is **empty**. Nothing under `lib/` was modified.

`git diff --name-only HEAD~3 HEAD` lists exactly the plan's three files and nothing else:

```
scripts/hsi-to-graph.cjs
tests/run-all-242.sh
tests/test-242-hsi-to-graph-transaction.cjs
```

**Open Question 1 was DECLINED, so `lib/core/lazygraph-ops.cjs` stayed untouched.** This plan writes a third literal inline BEGIN/COMMIT/ROLLBACK block rather than extracting a shared `withTransaction(conn, fn)` helper, because Phase 236 is concurrently editing that exact file's `rebuildGraph` and the extraction would manufacture a merge collision on the one function both phases would then own. Phase 242's file set is provably disjoint from Phase 236's.

Phase 236's off-limits files were neither read for modification nor touched: no `.planning/phases/236-*`, no `lib/core/lazygraph-ops.cjs` edit, no `tests/test-236-*`, no `tests/helpers/fixture-room-236.cjs`. `lib/core/lazygraph-ops.cjs` was read only, as the plan's `<read_first>` directs.

## Verification Results

| Check | Command | Result |
|---|---|---|
| Three MOAT-01 legs | `node tests/test-242-hsi-to-graph-transaction.cjs` | exit **0**, 3/3 pass, 2.26s |
| Phase aggregator | `bash tests/run-all-242.sh` | exit **0**, PASS=3 FAIL=0 SKIP=0 |
| Task 1 structure gate | exactly-one BEGIN/COMMIT/ROLLBACK, seam present, no `timeout:` | `structure OK` |
| Production inertness | seeded temp room, env var unset | exit **0**, printed `HSI: wrote 1 connection edges, 1 reverse salient edges`, seam marker absent, 2 edges committed |
| Syntax | `node -c scripts/hsi-to-graph.cjs` | OK |
| No em-dashes | `grep -cP '\x{2014}'` on all three files | **0**, **0**, **0** |
| Repo cleanliness after a full test run | `git status --porcelain` | only the new plan files; the suite writes nothing inside the repo |
| `lib/` untouched | `git diff --stat lib/` | empty |

### The three legs, and why each is not vacuous

- **Leg A (crash injection).** Seeds an already-scored room with 6 edges tagged `{"tier":"prior"}`, spawns the real script, waits for the `HSI-CRASH-SEAM: in-transaction` marker, SIGKILLs it, asserts the child was signal-killed (not a clean exit), reopens through a fresh read-only connection, and asserts exact-set equality against the prior snapshot. The extra `tier:prior` provenance assertion is what rules out a coincidentally-equal new layer.
- **Leg B (concurrent reader).** A real `fork()`ed reader polls every 15ms and is required to produce its first sample BEFORE the writer starts, guaranteeing a pre-rewrite observation. Every sample must be exactly 6 or 10; the prior total (6) and post total (10) are deliberately different so the two states can never be confused. Assertions: at least 5 samples, never 0, no value outside `{6, 10}`, at least one 6, last one 10.
- **Leg C (mutation proof).** Builds a temp-dir COPY with both wrap lines stripped, and the builder itself asserts the source actually changed and both literals are gone, so Leg C cannot pass by silently testing an unmutated script. It then runs the identical crash sequence and asserts the invariant BREAKS, plus that fewer than 6 prior-tier rows survive, which is the concrete shape of the bug MOAT-01 closes.

## Deviations from Plan

**None affecting the three tasks.** The plan was executed exactly as written, including its `<planner_resolutions>`.

One defensive addition worth naming, inside the plan's own spec rather than beyond it: `snapshotScoringEdges` normalizes rows to plain objects before `assert.deepStrictEqual`. This is not decoration. While running the plan's Task 1 verify I traced a live failure mode in an existing suite (D-242-01 below) where `node:sqlite` returns **null-prototype** rows and `deepStrictEqual` compares prototypes, so a row unequal only in prototype fails against an object literal. Without the normalization, Legs A and C would have been vulnerable to the identical trap.

## Deferred Issues (pre-existing, out of scope)

Logged in full at `.planning/phases/242-the-moat/deferred-items.md`. Both were discovered while running the plan's own verification commands and both are provably unrelated to this change: each suite requires only `lib/core/lazygraph-ops.cjs`, never `scripts/hsi-to-graph.cjs`, and `lib/` is byte-identical to this plan's base commit.

- **D-242-01** `tests/test-sqlite-concurrent.cjs`, 1 failure (`WAL mode is active on database`). Root cause traced: `node:sqlite` now returns null-prototype rows, and `assert.deepStrictEqual` compares prototypes. WAL mode IS active; the value is correct and only the assertion style is stale. The plan's Task 1 acceptance criterion expected this suite to exit 0; it exits 1 for this pre-existing reason. The no-regression half of that criterion IS met: the 3-pass/1-fail split is identical before and after Task 1.
- **D-242-02** `tests/test-sqlite-ops.cjs`, 4 failures (the same null-prototype issue, plus frozen-literal expectations of "19 edge types" and "21 exports" that the library has since grown past). Fixing these means editing `lib/core/lazygraph-ops.cjs`'s test expectations, which is Phase 236 territory and explicitly off limits here.

Neither was fixed, per the scope boundary. Neither blocks MOAT-01.

## Threat Model Compliance

| Threat ID | Disposition | Status |
|---|---|---|
| T-242-01 (partial-write corruption, Tampering/DoS) | mitigate | **Closed.** One BEGIN/COMMIT/ROLLBACK spans the DELETE and both loops, proven by Legs A and B and proven load-bearing by Leg C plus the live comment-out re-check. |
| T-242-02 (SQL parameter binding) | mitigate | **Held.** Every write keeps its existing `?` binding. The wrap added only BEGIN/COMMIT/ROLLBACK; zero string-interpolated SQL was introduced. |
| T-242-03 (crash seam as unintended control flow) | accept | **As designed.** The seam reads no secrets and writes no data; a non-numeric or unset env var parses to 0 and the guarded branch never runs, proven live by the production-inertness check. |
| T-242-04 (false success line, Repudiation) | mitigate | **Closed.** The summary write now sits after the COMMIT. |
| T-242-SC (package installs) | accept | **N/A.** Zero package-manager installs. No `package.json` line changed. Only the `node:sqlite` builtin already in use across `lib/core/`. |

No new threat surface was introduced: no network endpoint, no auth path, no new file-access pattern, and no schema change. Part 8 is enforced permanently by the aggregator's self-tested egress sweep over `scripts/hsi-to-graph.cjs`.

## Known Stubs

None. Every artifact this plan claims is wired and exercised by a passing test.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 | `b9cc2184` | `fix(242-01): wrap HSI-to-graph edge rewrite in one transaction (MOAT-01)` |
| 2 | `298e7233` | `test(242-01): three-leg mutation-proof MOAT-01 transaction gate` |
| 3 | `2c036bec` | `test(242-01): add Phase 242 aggregator with glob discovery and self-tested Part 8 sweep` |

## Notes for Plan 02 and the Verifier

- `tests/run-all-242.sh` needs **zero edits** for Plan 02. Drop `tests/test-242-kuzu-reintroduction-gate.cjs` in and it is discovered. This was verified positively with a throwaway second file, not merely asserted.
- The aggregator's `PART8_TARGETS` deliberately contains only `scripts/hsi-to-graph.cjs`. Plan 02 asserts its own surface inside its own test, which is what keeps the two plans independently green in the same wave. Do not add Plan 02's script to that array.
- STATE.md and ROADMAP.md were deliberately NOT touched; the orchestrator owns those writes after both Wave 1 plans complete. `REQUIREMENTS.md`'s MOAT-01 checkbox and traceability row were updated, since Plan 01 delivers MOAT-01 in full.

## Self-Check: PASSED

Every file and commit claimed above was verified present on disk after writing this summary.

| Claimed artifact | Verified |
|---|---|
| `scripts/hsi-to-graph.cjs` | FOUND |
| `tests/test-242-hsi-to-graph-transaction.cjs` | FOUND |
| `tests/run-all-242.sh` | FOUND, executable bit set |
| `.planning/phases/242-the-moat/242-01-SUMMARY.md` | FOUND |
| `.planning/phases/242-the-moat/deferred-items.md` | FOUND |
| commit `b9cc2184` | FOUND |
| commit `298e7233` | FOUND |
| commit `2c036bec` | FOUND |
