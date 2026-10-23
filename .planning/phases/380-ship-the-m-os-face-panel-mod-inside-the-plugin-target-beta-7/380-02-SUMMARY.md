---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 02
subsystem: ui-mod-typecheck
tags: [mos-face, typecheck, tsconfig, raster-pin, noUncheckedIndexedAccess]
requires: [380-01]
provides:
  - ui/mos-face/tsconfig.json (self-contained, no extends)
  - ui/mos-face/scripts/typecheck.cjs
  - ui/mos-face/scripts/lay-types.cjs
  - ui/mos-face/tests/raster-pin.test.ts (120 sha256 pins)
  - tests/test-380-typecheck.cjs
affects: [380-03, 380-04, 380-05, 380-06, 380-07, 380-08, 380-09, 380-10, 380-11]
key-files:
  created:
    - ui/mos-face/scripts/typecheck.cjs
    - ui/mos-face/scripts/lay-types.cjs
    - ui/mos-face/tests/raster-pin.test.ts
    - tests/test-380-typecheck.cjs
  modified:
    - ui/mos-face/tsconfig.json
    - ui/mos-face/hooks/face.ts
    - ui/mos-face/hooks/meter.ts
    - ui/mos-face/panel.test.tsx
requirements-completed: [MOD380-04]
completed: 2026-10-23
---

# Phase 380 Plan 02: Repair the type-check of ui/mos-face - Summary

The type-check of `ui/mos-face` now runs from a fresh checkout and exits 0. The 16 type errors are cleared. The raster output is unchanged: 120 sha256 pins, taken before the fix, still pass.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing was pushed. No branch was created or switched.

## Commits (release tree)

| Step | Commit | Subject |
|------|--------|---------|
| Task 1, pins | ead0ab6e6 | test(380-02): pin raster output before the type fix |
| Task 1, tooling | 27ba0e316 | fix(380-02): self-contained tsconfig and type-check entry for ui/mos-face |
| Task 2, errors | 18ef5d1f6 | fix(380-02): clear the 16 type errors of the adopted source with no change of behavior |

## Root cause (PROVEN)

Two causes, in order:

1. `tsconfig.json` was `{"extends": "./.claude-plugin/types/tsconfig.json"}`. That base file is written by the engine when a session loads the mod from a folder. The folder is gitignored (`ui/mos-face/.gitignore`). A fresh checkout has no base file, so `tsc` could not start. `claude plugin test` did not lay the folder either (checked: `.claude-plugin/` held only `plugin.json` after a full test run).
2. Once the base file exists, it turns on `strict` and `noUncheckedIndexedAccess`. The code indexes pixel grids as `g[r][c]`. Under that option `g[r]` has type `string[] | undefined`, so each use raised TS2532. Nobody saw this, because the check never ran.

The fix for cause 1 is a self-contained `tsconfig.json` with the same options (strict and noUncheckedIndexedAccess kept) and an `include` list that names the engine-laid folder. The fix for cause 2 is a typed row guard, not a weaker config.

## Error list before the fix (PROVEN, tsc 7.0.2, exit 1)

16 errors, as the plan predicted.

- `hooks/face.ts`: 9 x TS2532 at lines 132, 133, 136, 144, 149, 160, 179, 187, 191.
- `hooks/meter.ts`: 5 x TS2532 at lines 55, 56, 77, 83 (two on line 83: columns 64 and 87 across 55/56 pair; five in total).
- `panel.test.tsx`: TS2344 at line 95 (`Parameters<Parameters<typeof test>[1]>[1]`; `test` takes a rest tuple, so index 1 can be the options object) and TS2322 at line 150 (the `process.run` mock lacked `isStdoutTruncated` and `isStderrTruncated`, which `ProcessRunResult` requires).

## After the fix (PROVEN)

| Command | Result |
|---------|--------|
| `node ui/mos-face/scripts/typecheck.cjs` | exit 0 |
| `node tests/test-380-typecheck.cjs` | `PASS`, exit 0 |
| `claude plugin test .` in `ui/mos-face` via `node tests/test-380-engine-tests.cjs` | 37 pass, 0 fail (34 original plus 3 pin tests) |
| `git diff --quiet HEAD -- ui/mos-face/tests/raster-pin.test.ts` | exit 0 (pins never edited after the first green) |
| `bash tests/run-all-380.sh` | `PASSED=5 FAILED=0 SKIPPED=8 KNOWN=0` (includes plan 03 legs present at that moment) |
| exit 77 path: scratch copy of the two scripts, empty HOME and TMPDIR | `lay-types` exit 77 and `typecheck` exit 77, each prints the one-line fix |
| em-dash byte scan (GNU grep, `LC_ALL=C`, bytes e2 80 94) over all files touched | no hit |

## The fixes (behavior preserved)

- `face.ts` `rasterState` and `rasterCrew`: each outer loop holds the row in `const row = g[r]` and skips if it is missing. Writes go to `row[c]`. The run square uses `runRow`. The index `r` is always in `[0, n)`, so the guard never fires for a valid `n`.
- `meter.ts` `contextCanvas`: the same pattern for the vertical lines, the horizontal lines, the painted cells (the `left -= 1` stays outside the guard) and the white-cell pass.
- `panel.test.tsx`: `world()` now takes `Parameters<TestBody>[1]` with `import type { TestBody }`. The `process.run` mock adds `isStdoutTruncated: false` and `isStderrTruncated: false`. No assertion changed. No hook reads those two fields (searched `hooks/` and the test file).
- No non-null assertion, no `any`, no cast, no change to an algorithm, a constant, a color or a string.

## Pins (T-380-04)

`tests/raster-pin.test.ts` pins sha256 of the JSON text of:

- R1: `rasterState` for each of the 7 poses x ticks 0 to 3 x sizes 8, 12, 16 = 84.
- R2: `rasterCrew` for each of the 6 crew faces x 3 sizes = 18.
- R3: `contextCanvas` wide (32 x 12) and compact (32 x 8) at 0, 1, 17, 50, 62, 80, 99, 100 and `undefined` = 18.

Total 120 pins. Method: the test ran with an empty pin table on the UNFIXED source (3 fail), the 120 hashes were read from the failure output, put in the file, and the test then passed (37 pass) before any source edit. After Task 2 the same file passes unchanged. 59 distinct hashes exist among the 120; the duplicates are expected (ticks only change the `search` pose, which has `run: true`; wide and compact canvases share some inputs at full paint).

First pins, as an anchor: `state:found:0:8` = `29d7a28a81a2144f20f0917d26bd05a25391d09384d4028cbc89ef2820e39d74`; `state:rest:0:8` = `dc04e40997e924b89633bb9ef5dff26a150823d6563be8572f2e91c781848dd2`. All 120 are in the test file.

## Declaration file provenance (T-380-05)

`lay-types.cjs` laid the folder from `~/.claude/dev-mods/0edce8e1-1cd3-4a4c-8354-d35eb4d22ffd/mos-face/.claude-plugin/types`. Its first line: `// Written by Claude Code 2.1.304.` The installed engine is `2.1.309 (Claude Code)`. The declaration file is 5 minor patch levels behind the engine. The check passes against it. The laid folder is gitignored and is not committed. Each run prints both lines.

Compiler: TypeScript 7.0.2 from `ui/mos-face/node_modules` (lockfile pin from plan 01). The `tools/ts-check` copy is the fallback.

## Deviations from Plan

None that change scope. Two notes:

1. **Mock fields (test only).** The plan said "change only types". The TS2322 fix needs two fields in a mock value, since a type cannot add a missing property. The fields are false, they equal what a real child that did not truncate returns, and no code reads them. Judged inside the intent of the plan.
2. **Guard on a degenerate input.** For `n <= 0` the old code threw a TypeError in the run-square line; the new code does nothing. `n` is 8 to 16 in all callers. The pins cover 8, 12 and 16.

## Notes for later plans

- Plan 03 committed `053cd80d8` between my last two commits on the same branch. My `--only` commits did not touch its files. `tests/test-380-shots-harness.cjs` and `ui/mos-face/scripts/lib/` belonged to plan 03 and were not staged by this plan.
- `claude plugin test` does not lay `.claude-plugin/types`. A person on a new machine needs `lay-types.cjs` to find a copy. If no copy exists, the check exits 77 with the fix (load the mod once with `claude --plugin-dir ui/mos-face`). Whether that skip may stay non-strict in the aggregator is a plan 11 decision (T-380-06 accepts it).
- The 5 plan 01 commits and the 3 commits of this plan plus the plan 03 commits are still unpushed. Review every commit ahead of origin before any push.

## Known Stubs

None.

## Threat Flags

None. No network, no new file access beyond reading a local declaration-file copy and writing it into the gitignored folder.

## Self-Check: PASSED

- Files present in the release tree: `ui/mos-face/scripts/typecheck.cjs`, `ui/mos-face/scripts/lay-types.cjs`, `ui/mos-face/tests/raster-pin.test.ts`, `tests/test-380-typecheck.cjs`, `ui/mos-face/tsconfig.json` (all ran).
- Commits ead0ab6e6, 27ba0e316, 18ef5d1f6 are on `main` in the release tree.
