---
quick_id: 261028-v6m
slug: n7-tolerate-cosmetic-fork-declaration-sl
date: 2026-10-28
status: complete
type: quick
phase_ref: 359
ruling: N-7
commits:
  - 84615de32 feat: parser tolerance + tests + runner leg
  - bba831ae4 test: corpus retirement/replacement + baseline regeneration
files_modified:
  - lib/core/fork-declaration.cjs
  - tests/test-359-fork-declaration-n7.cjs
  - tests/test-359-fork-declaration.cjs
  - tests/run-all-359.sh
  - tests/fixtures/card-fire-replay/prose-forks-359.json
  - tests/fixtures/card-fire-replay/baseline-359.json
---

# Quick 261028-v6m: N-7, tolerate cosmetic fork-declaration slips

**The fork declaration parser now accepts lowercase `what if`, markdown emphasis around the `Your call:` prefix or the whole line, and one trailing blank or short sign-off line. Structural errors stay rejected. Control count: unchanged at 42 (19 synthetic-359).**

Every claim is PROVEN (command run in this task) unless marked otherwise.

## What changed

- `lib/core/fork-declaration.cjs` (only file under lib/ or hooks/ changed). Accepted:
  - lowercase `what if` as the final label prefix;
  - one balanced emphasis pair (`**`, `__`, `*`, `_`) around the `Your call:` prefix, or around the WHOLE line;
  - interpretation: one balanced pair around the `What if` prefix of the final label (named in the 359-06 SUMMARY);
  - one trailing blank line, or one sign-off line.
- Rejected, unchanged: fewer than 3 or more than 4 labels, brackets, duplicates, voice glyphs, a capital `What if` in a non-final label, a line that is not a declaration, mismatched emphasis (`**...*`), two trailing lines, a sign-off with a glyph or bracket.
- Returned labels are canonical (marks removed, capital `What if`). A strict N-3 line returns byte-identical labels. Test S1 compares a set of strict lines against the strict parser at commit `e74fcaa42` (read with `git show`): every strict-accepted line gives the same result.

## Interpretations (documented in the module header)

1. Sign-off: at most 120 code points, no voice glyph, no bracket. A blank line may sit between the declaration and the sign-off.
2. Emphasis around the `What if` prefix of the final label is tolerated (not in the N-7 bullet text, present in the 359-06 SUMMARY).
3. The non-final What-if check stays the strict one (capital `What if` only). Reason: every line the strict grammar accepted must still be accepted. Consequence (ASSUMED harmless): a line with two lowercase what-if labels is now declared.
4. Emphasis marks inside a label body are left as written.

## Scope widening (authorized by the main session, from the N-7 text)

- `tests/test-359-fork-declaration.cjs`: N5, N16, N18 encoded the old strict outcome. They are now accepted cases that match N-7. N18 keeps a reject case for two trailing lines. Every other structural-reject case is untouched.
- `tests/fixtures/card-fire-replay/prose-forks-359.json`: retired `syn359-ctrl-16` (trailing sign-off), `syn359-ctrl-17` (bold prefix), `syn359-ctrl-18` (lowercase moonshot). All three became parser-positive. They are removed, not converted to forks, so the fork count stays 17.
- New structural near-miss negatives, still parser-negative under N-7: `syn359-ctrl-20` (duplicate labels), `syn359-ctrl-21` (declaration plus TWO trailing lines), `syn359-ctrl-22` (mismatched emphasis `**...*`).
- `tests/fixtures/card-fire-replay/baseline-359.json`: regenerated with `node scripts/replay-card-fire.cjs --code-root git:2797903a005b7e0500b74c0af70ea86f6f7958fc --fork359 --surface cli --baseline write-359` (the 359-08 command). Diff: `written_at` and the three ids only.
- `tests/test-359-corpus.cjs`: no edit needed. C4 and C8 pass on the new corpus (C8 needed the retirement only).

## Effect on the control count

Retired 3, added 3. Controls: 42 before, 42 after (baseline `fork359.controls`). Synthetic-359 controls: 19 before, 19 after. Floor of 15 (N-7, C2): met. Prose forks: 17 before and after. Pre-359 missed forks: 17 before and after.

## Verification

- `node tests/test-359-fork-declaration-n7.cjs`: 43/43. On the old parser, 13 of the earlier 31 cases failed (red first).
- `node tests/test-359-fork-declaration.cjs`: 39/39.
- `bash tests/run-all-359.sh`: PASS=27 FAIL=0 SKIP=0.
- `bash tests/run-all-357.sh`: PASS=16 FAIL=0 (0 new false blocks on the 357 corpus).
- `node tests/test-359-inertness.cjs`: 4/4 (R5).
- `node tests/test-359-replay.cjs`: 26/26. `--mutation`: 4/4.
- `bash tests/run-all-238.sh`: PASS=14. `bash tests/run-all-251.sh`: PASS=6. `node scripts/build-harness-manifest.cjs --check`: OK.
- No em-dash or en-dash in any written file (grep).
- Run with HOME, USERPROFILE and MINDRIAN_ROOMS_HOME set to temp directories. No network, no model call, no push.

## Deviations from Plan

**1. [Rule 2 - Missing critical] Whole-line emphasis added.** The saved patch handled only prefix emphasis; the N-7 text also names the whole line. Added with a mismatched-pair guard.

**2. [Rule 1 - Bug] Saved patch rejected previously-accepted strict lines.** It rejected lowercase or marked What-if text in a NON-final practical label, which the strict parser accepted. Reverted to the strict check; superset test added.

## UNVERIFIED

- Live Larry behavior: whether Larry now lands more cards. No live or model run was made (spend limit).
- The `scripts/forward-fork-scenarios-359.cjs` batch was not run or dry-run; it reads the parser through a pinned tree copy (UNVERIFIED whether a running batch uses the working-tree parser).

## Self-Check: PASSED

Commits `84615de32` and `bba831ae4` exist on `feat/eureka-adapter-rebased`. All six listed files exist and are committed.
