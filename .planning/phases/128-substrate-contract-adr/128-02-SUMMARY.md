---
phase: 128-substrate-contract-adr
plan: 02
subsystem: ci-guards
tags: [substrate-contract, ci-guard, canon-part-8, canon-part-9, tdd, reuse-before-build]
requires:
  - 128-01 (the Substrate Contract ADR -- the spec the guard enforces)
  - scripts/check-schema-aliases.cjs (the --check-chokepoint guard this supersedes)
  - lib/core/navigation.cjs (the chokepoint allow-list)
provides:
  - scripts/check-substrate.cjs (the structural CI guard; pure scan API + 3 CLI modes)
  - tests/test-substrate-contract.cjs (5-case + 2-bonus regression fence)
  - tests/run-all-128.sh (phase-128 test aggregator)
affects:
  - 128-03 (wires --diff into the live pre-commit hook + files the --baseline report)
tech-stack:
  added: []
  patterns:
    - "Pure programmatic scan API (scanFiles/scanStaged returning {file,line,rule,match}); no process.exit inside the scanner"
    - "MINDRIAN_HOOK_STAGED_FILES + MINDRIAN_HOOK_STAGED_CONTENT_DIR seams for hermetic test drive"
    - "Strict-superset guard: carries forward BANNED_PATTERNS require-bans + adds M2/M3/M4 + openGraph + raw-write rules"
    - "direct-CJS tests (node:assert/strict, zero npm deps) mirroring test-navigation-acceptance.cjs"
key-files:
  created:
    - scripts/check-substrate.cjs
    - tests/test-substrate-contract.cjs
    - tests/run-all-128.sh
  modified: []
decisions:
  - "Guard exempts lazygraph-ops.cjs OWN body (baseline violation Plan 03 enumerates) but flags every CALLER that openGraph or requires it from a non-allowlisted path"
  - "--baseline is INFORMATIONAL (exit 0); --diff is BLOCKING (exit 1); --check-chokepoint is a superset alias running --diff"
  - "M4 Cypher detection covers two breach shapes: template-literal ${...} interpolation AND string-concat into a MATCH clause; parameterized $param does NOT flag"
  - "Pure // comment lines are skipped so doc-text mentioning banned SQL is not a false flag"
metrics:
  duration: ~25m
  completed: 2026-05-30
  tasks: 2
  files: 3
---

# Phase 128 Plan 02: Substrate Contract CI Guard Summary

The structural CI guard `scripts/check-substrate.cjs` that enforces the Substrate Contract ADR as a strict superset of the legacy `--check-chokepoint`, plus its 5-case TDD regression fence and the phase-128 test aggregator. Built test-first (RED then GREEN).

## What shipped

- **`scripts/check-substrate.cjs`** (the guard). Scans `lib/**` + `scripts/**` (cjs/js/mjs) and flags, OUTSIDE the navigation.cjs allow-list, every one of: direct `node:sqlite` / `better-sqlite3` require (M3), raw `fs` read of a `room.db` path (M2), raw `INSERT|UPDATE|DELETE` on `nodes|edges|memory_event` (the un-provenanced write class, including the lazygraph-ops `INSERT INTO nodes` shape), any `openGraph(` caller (the #1 production bypass), Cypher MATCH with user-content interpolation (M4, both template-literal `${...}` and string-concat shapes), and the carried-forward require() bans from `check-schema-aliases.cjs BANNED_PATTERNS` (the strict-superset guarantee, under rule `chokepoint-require`). Parameterized Cypher (`$param`) does NOT flag. Exports a pure `scanFiles(files, readContent)` / `scanStaged()` API returning `{file,line,rule,match}` objects. CLI modes: `--baseline` (full-repo, informational, exit 0), `--diff` (staged-only, blocking, exit 1), `--check-chokepoint` (superset alias running the scan in `--diff` mode so external callers of the retired subcommand keep working).

- **`tests/test-substrate-contract.cjs`** (the regression fence). 5 named cases (2 known-good: navigation.cjs use + parameterized Cypher; 3 known-bad: direct sqlite require, raw room.db read, Cypher interpolation) plus 2 superset bonus assertions (raw INSERT INTO nodes; require of lazygraph-ops from a non-allowlisted path). Hermetic: each case writes fixture bodies to a `fs.mkdtempSync` dir, points the `MINDRIAN_HOOK_STAGED_FILES` + `MINDRIAN_HOOK_STAGED_CONTENT_DIR` seams at them, calls the guard's exported `scanStaged()`, asserts on the returned violation array, and restores env. Zero npm deps, no real git, no network. `node tests/test-substrate-contract.cjs` exits 0 (7 passed, 0 failed).

- **`tests/run-all-128.sh`** (the aggregator). Mirrors `tests/run-all-124.sh` shape (CJS_SUITES array, per-suite PASS/FAIL line, RED-until-owning-plan-lands header). Registers `test-substrate-contract.cjs`. `bash tests/run-all-128.sh` reports the suite GREEN.

## TDD gate compliance

- RED gate: commit `65f60569` (`test(128-02): ...`) landed the suite while the guard was absent. `node tests/test-substrate-contract.cjs` exited 1 with `Cannot find module .../check-substrate.cjs` -- the expected RED state.
- GREEN gate: commit `a6baa645` (`feat(128-02): ...`) shipped the guard. All 5 cases + 2 bonus assertions turned GREEN.
- Sequence verified in git log: `test(...)` then `feat(...)`. No REFACTOR commit needed.

## Verification (all from the plan)

- `node tests/test-substrate-contract.cjs` exits 0 (7 passed, 0 failed).
- `bash tests/run-all-128.sh` reports the substrate-contract suite GREEN.
- `node scripts/check-substrate.cjs --baseline` enumerates 195 live violations across `lib/` + `scripts/`, including 34 `opengraph-bypass` hits and 28 `chokepoint-require` hits (the live bypasses Plan 03 will file). Output names `lazygraph-ops` / `openGraph` (the verify grep matches).
- Strict superset of `--check-chokepoint`: a staged `require('../core/lazygraph-ops.cjs')` from a non-allowlisted path makes both `--diff` and `--check-chokepoint` exit 1 (the old require-pattern still fires).
- Canon Part 8 LOCAL-only: `grep -rEn "fetch\(|https?://|brain.mindrian|tavily|http.request|XMLHttpRequest"` returns nothing.
- Zero new npm deps: only `fs`, `path`, `child_process` builtins required.
- Zero em-dash characters in all three authored files.

### Baseline rule breakdown (informational, Plan 03 owns the report)

| Rule | Count |
|------|-------|
| chokepoint-require | 28 |
| m3-direct-sqlite-require | 20 |
| m2-raw-room-db-read | (0 surfaced; folded into m3/raw-write paths) |
| raw-graph-write | 50 |
| opengraph-bypass | 34 |
| m4-cypher-interpolation | 63 |
| **Total** | **195** |

These are the known baseline violations the ADR scope-boundary names (the ~15 openGraph openers via lazygraph-ops, hsi-to-graph.cjs raw SQL, etc.). Plan 02 produces them informationally; Plan 03 makes the guard hard-fail on net-new.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] M4 Cypher template-literal regex too strict for quoted interpolation**
- **Found during:** Task 2 (first GREEN run; Case 4 failed)
- **Issue:** `RE_CYPHER_INTERP_TEMPLATE = /MATCH\b[^`'"]*\$\{[^}]+\}/i` excluded `'` and `"` from the MATCH-to-interpolation span, so a fixture line `MATCH (a) WHERE a.note = "${userBody}"` (a quote before the interpolation) did not match. That is the exact real-world breach shape (a user value spliced into a quoted Cypher property).
- **Fix:** Relaxed the character class to `[^`]*` -- exclude only the backtick (which would close the template literal), allow embedded quotes. Case 4 then GREEN.
- **Files modified:** scripts/check-substrate.cjs
- **Commit:** a6baa645 (the fix landed within the Task 2 GREEN commit before staging)

No other deviations. The plan executed as written.

## Scope boundary honored

No hook wiring and no committed baseline report in this plan -- those are Plan 03. The guard's `--baseline` mode is informational (exit 0); only `--diff` / `--check-chokepoint` block. The lazygraph-ops.cjs own body stays allow-listed (its internal INSERTs are a known baseline violation Plan 03 enumerates, not new-code to block).

## Threat surface

No new threat surface introduced. The guard reads source files + git index only (never room.db, never network), per its T-128-02 disposition. The 5-case + 2-bonus suite is the T-128-01 regression fence proving each rule fires. T-128-03 (a new openGraph caller bypassing navigation.cjs) is mitigated: the `opengraph-bypass` rule flags every openGraph caller outside the allow-list (34 found in the baseline). T-128-SC: zero new packages added; no install task; no legitimacy checkpoint required.

## Self-Check: PASSED

- Files: scripts/check-substrate.cjs, tests/test-substrate-contract.cjs, tests/run-all-128.sh, .planning/phases/128-substrate-contract-adr/128-02-SUMMARY.md all FOUND.
- Commits: 65f60569 (RED test), a6baa645 (GREEN guard) both FOUND.
