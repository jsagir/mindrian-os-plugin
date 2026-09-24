---
phase: quick/260924-ohd
plan: 01
subsystem: dev-tooling
tags: [phase-355, label-355-gold, cli-ux, tdd]
dependency-graph:
  requires: []
  provides: [label-355-gold-sitting-ux]
  affects: [scripts/label-355-gold.cjs, tests/test-355-label-cli.cjs]
tech-stack:
  added: []
  patterns: [PassThrough-driven non-TTY test harness, echo-before-next-prompt, atomic session save unchanged]
key-files:
  created: []
  modified:
    - scripts/label-355-gold.cjs
    - tests/test-355-label-cli.cjs
decisions:
  - "Echo and prompt text share one answerLabel(field) helper so they can never drift apart (R1)."
  - "Counter write happens in showCurrent(), reading session.entries live, so no new state variable or now() call was needed (R2, R5)."
metrics:
  duration: "~35 min"
  completed: "2026-09-24"
---

# Phase quick/260924-ohd Plan 01: label-355-gold sitting UX (echo, counter, undo) Summary

One-liner: label-355-gold.cjs now echoes each accepted y/n or keyed answer, prefixes every item with a `[labeled/total]` counter, and names the cleared item on undo, so raw-mode's silent local echo no longer hides whether a keypress registered.

## What shipped

Two small behavioral additions to the interactive `start`/`resume` loop in `scripts/label-355-gold.cjs`, driven out via TDD (RED then GREEN), plus a new B12 test block (24 checks) in `tests/test-355-label-cli.cjs`:

1. **Answer echo (R1).** A new `answerLabel(field)` helper returns the same field label used in the y/n prompt (`useful?`, `direction ok?`, `already known?`). `promptFor` now composes on top of it (`answerLabel(field) + ' (y/n)'`), so the four prompt strings stay byte-identical. In `handleToken`, the triple branch writes `answerLabel(nextField) + ' ' + token + '\n'` right after `pending[nextField] = val`; the keyed branch writes `'label: ' + label + '\n'` right after the label is resolved, before `recordEntry`.
2. **Progress counter (R2).** `showCurrent()` now writes `'[' + Object.keys(session.entries).length + '/' + order.length + ']\n'` on its own line immediately before `renderItem(...)`. The legend write and the "All items labeled..." completion message are untouched.
3. **Undo line (R3).** `undo()` writes `'undo: ' + lastId + ' cleared\n'` after the save and before `currentId = lastId; showCurrent();`, so the navigator sees which item id was cleared before it re-renders.
4. Ignored keys (R4) still return before any write in every branch - unchanged, verified by the new B12 checks.
5. Session shape, save points, seed/hash refusals, and the six-key session object are untouched (R5) - verified by a B12 leg that resumes a hand-written pre-change-shape session file and asserts the re-saved bytes are byte-identical.
6. No em-dash in either touched file (R7) - verified by `grep -nP '\x{2014}'`.

### Before/after sample - triple set (pairings-unstamped)

```
y/n useful?  y/n direction ok?  y/n already known?   u undo   q save+quit
[0/2]
beta
excerpt a2
excerpt b2
same words with different meaning
useful? (y/n)
useful? y
direction ok? (y/n)
direction ok? n
already known? (y/n)
already known? n
[1/2]
alpha
excerpt a1
excerpt b1
same meaning in different words
useful? (y/n)
```

(Previously, after typing `y` `n` `n` the screen jumped straight from `already known? (y/n)` to the next item with zero visible confirmation.)

### Before/after sample - keyed set (sentences)

```
1 analytical  2 integrative  3 descriptive  4 evaluative  5 creative  6 none   u undo   q save+quit
[0/2]
The audit compared two datasets.
label: analytical
[1/2]
The report lists fields.
```

## TDD Gate Compliance

- RED gate: `test(quick-260924-ohd): ...` - not committed as a separate commit per the plan's explicit instruction (single commit at end of Task 2, so main never carries a red test for peer sessions running `run-all-355.sh`). RED was verified via the automated verify block: `RED-OK` printed, at least one `FAIL: B12...` line, zero non-B12 FAIL lines, `scripts/label-355-gold.cjs` unmodified at that point.
- GREEN gate: `feat(quick-260924-ohd): ...` at commit `d4dc94154` - test file ends `PASS: 96 FAIL: 0` (72 pre-existing + 24 new B12 checks).
- No separate REFACTOR commit was needed.

## Verification results

- `node tests/test-355-label-cli.cjs` -> `PASS: 96 FAIL: 0`.
- `grep -nP '\x{2014}' scripts/label-355-gold.cjs tests/test-355-label-cli.cjs` -> no matches.
- Live-sitting compatibility check: copied the navigator's live `labeling-session-pairings-unstamped.json` (11 entries at the time of this run) into a mktemp dir, ran `resume --session-dir <mktemp>` with stdin from `/dev/null` (no key ever read, nothing ever saved), and confirmed line 2 of the output is exactly `[11/96]` while the copy's sha256 was unchanged before and after. **LIVE-COMPAT-OK N=11.**
- The real live session file under `.planning/phases/355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi/` was only ever `cp`'d (read-only source), never opened for write - confirmed via `git status`/`git diff` on that path showing no change.
- Advisory `bash tests/run-all-355.sh`: `PASS=54 FAIL=5 SKIP=2`. `test-355-label-cli.cjs` itself is among the PASSED legs. The 5 FAILED legs (`test-355-direction-agreement.cjs`, `test-355-direction-readers.cjs`, `doctor --acceptance` no-new-regression check, `272-cache-probe.test.cjs`, `no-regression: run-all-272.sh`, `no-regression: part8-egress-guard.test.cjs`) are unrelated to the two files this plan touched and were not investigated or modified - **observed-not-owned**, consistent with peer sessions editing Phase 355 files in this same shared working tree.

## Deviations from Plan

None - plan executed exactly as written. Both edits (script + test) match the plan's `<action>` blocks precisely; the RED gate and GREEN gate both matched expected shape on the first pass, no auto-fixes were needed.

## Commit

- `d4dc94154` - `feat(quick-260924-ohd): label-355-gold echoes accepted answers, shows [labeled/total], names undone item` - contains exactly `scripts/label-355-gold.cjs` and `tests/test-355-label-cli.cjs`. Verified as an ancestor of HEAD via `git merge-base --is-ancestor d4dc94154 HEAD`.

## Navigator pick-up instructions

Your running `label-355-gold.cjs start --set pairings-unstamped` process still has the OLD code loaded in memory - it will keep working exactly as it has been, silently. To pick up the new echo/counter/undo feedback:

1. Wait until a `[n/96]` counter line appears on screen (never mid-triple - a partial triple (one or two of the three y/n answers) is held in memory only and is not saved until all three are answered, so quitting mid-triple would lose that in-progress item's answers so far).
2. Press `q` to save and quit.
3. Run `node scripts/label-355-gold.cjs resume --set pairings-unstamped` (same as always - no new flags).

From then on, every accepted key echoes back what it registered as (`useful? y`, `label: analytical`, etc.), every item is prefixed with `[labeled/total]`, and `u` names which item id it just cleared.

## Self-Check: PASSED

- FOUND: scripts/label-355-gold.cjs
- FOUND: tests/test-355-label-cli.cjs
- FOUND commit d4dc94154 in `git log --oneline --all`
