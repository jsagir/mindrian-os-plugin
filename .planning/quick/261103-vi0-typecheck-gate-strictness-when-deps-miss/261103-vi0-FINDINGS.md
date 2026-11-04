# Quick 261103-vi0: typecheck gate when dependencies are missing

Kind: rca (NEW FAILURE class: silent skip in a release gate). Read-only investigation. No source edited.
Date: 2026-11-03. Branch: release/beta.77-changelog-panel (in sync with origin).

## Question

Does the 380 typecheck gate fail or silently skip when dependencies are missing, and do dependencies install before the gate?

## Evidence

1. `tests/test-380-typecheck.cjs` passes the child exit code 77 through unchanged when no TypeScript compiler is found.
2. `tests/run-all-380.sh` line for "380 typecheck" uses `run_if`. In `run_if` and `run`, exit 77 counts as SKIPPED (ENV GAP). `FAILED` stays 0.
3. The same file already has `run_strict_if`, where 77 counts as FAILED. The "380 installed layout" leg uses it. The typecheck leg does not.
4. Proof on a clean `git archive` copy with no `node_modules` (scratchpad `tc380`): wrapper printed `SKIPPED (ENV GAP): ... no TypeScript found` and exited 77.
5. `tests/run-all-366.sh` runs `bash tests/run-all-380.sh` as a hard `run`. The nested script ends with `[ "$FAIL" -eq 0 ]`, so it exits 0 with SKIPPED=1. The top-level summary shows one PASSED and hides the skip.
6. Nothing installs dependencies before the gate. `npm ci --ignore-scripts` in `ui/mos-face` appears only as a printed prerequisite or fix line (`build-mos-face.cjs`, `test-380-build.cjs`). `release.sh` has no install step for it.

## Root cause

The typecheck leg was registered with the lenient wrapper (`run_if`) instead of the strict one (`run_strict_if`), and the aggregator's exit code ignores SKIPPED. A missing compiler therefore reads as a pass one level up.

## Proposed fix (not applied)

1. In `tests/run-all-380.sh`, change the "380 typecheck" line from `run_if` to `run_strict_if` (same label, guard and command). Exit 77 then counts as FAILED and the cut stops with the existing one-line fix text.
2. Optional, separate: print `SKIPPED=n` loudly in `run-all-366.sh` when a nested aggregator reports SKIPPED greater than 0.
3. No auto-install. The fix text already says `cd ui/mos-face && npm ci --ignore-scripts`, and the wall rule keeps UI dependencies out of the root install.

## Risks

- Strict mode makes every machine without the walled install fail the cut. That is the intended behavior (same as the installed-layout leg).
- `tests/test-380-gate-wiring.cjs` may pin the aggregator text. Run it after the edit.

## Not run

Full run-all-366 and run-all-380 (heavy, one at a time, owner go). Real-room receipt. Release dry-run.
