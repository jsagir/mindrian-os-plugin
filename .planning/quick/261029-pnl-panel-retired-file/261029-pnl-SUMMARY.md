---
quick_id: 261029-pnl
slug: panel-retired-file
status: complete-source-only
completed: 2026-10-29
branch: release/beta.77-prep
commit: fdb592cff
requires: [341-08]
---

# Quick 261029-pnl: panel post_update follows the session-verify state

Claim marks: PROVEN = seen in a command result in this run. UNVERIFIED = not run. ASSUMED = inferred.

## Decision: option (a), re-point the signal

341-08 did not remove the restart cue. It moved it. `readPostUpdateVerification` in lib/statusline/cockpit-signals.cjs now returns true when `state.local.ok === false` in the state file of lib/core/session-verify-state.cjs (`<home>/.mindrian/session-verify/state.json`). That value drives `post_update` in the real status line, which then shows the doctor fix. PROVEN: new test line B2 shows the real status line prints `-> run /mos:doctor --fix` on a sound room with this file alone. The meaning is equal ("the update left a problem; run doctor --fix"), so inventing no signal and deleting no row was the smallest correct fix.

One meaning changed, on purpose. The old cue meant "a restart is pending". The new cue means "the check after the update failed". The NOW row copy in ui/mos-face/hooks/lines.ts (outside the files the task named) said "A restart is pending after the update", which would now be false. It now says "The check after the update found a problem. Run /mos:doctor --fix". Same command, same row, same priority.

## What changed (commit fdb592cff)

- ui/mos-face/hooks/status.ts: STATUS_FIELDS `post_update` source is `~/.mindrian/session-verify/state.json, local.ok`. `readStatusLocal` reads that file in the same `Promise.all` slot as the old touch-file and sets `postUpdate` true only when `local.ok === false`. A missing, passed, pending or damaged file gives false (fails quiet). The `StatusLocal.postUpdate` field name stays, so types and dist type files do not change.
- ui/mos-face/hooks/lines.ts: NOW copy (see above).
- ui/mos-face/scripts/lib/tmux-session.cjs: the fixture writes a failed `session-verify/state.json` in the real shape when `postUpdate` is set.
- ui/mos-face/tests/budget.test.ts: B9 file list names the new path (still 8 files, still one read each).
- ui/mos-face/tests/status.test.tsx: P10 and P16 use the new file and the new copy. Four new P10 tests: passed, inconclusive, pending and damaged files claim nothing.
- ui/mos-face/README.md: the field table row, the budget paragraph, the status-line-shape sentence. It also says the panel does not read MOS_SESSION_VERIFY_HOME.
- tests/test-380-status-parity.cjs: new line B2 (sound room plus failed verification shows the fix on the real status line), a check that the panel maps `post_update` to the new file, a check that panel source and fixture do not name the retired file.
- tests/test-380-shots-harness.cjs: P11d now reads `postUpdate` through the plugin's own `readPostUpdateVerification` and expects true; P11 expects false on a healthy fixture. This line no longer names the retired file.

Budget: not widened. Still 8 small files, one 4-second cut-off. PROVEN: tests/test-380-budget.cjs 11/11; the engine test B9 passes.

## Test-first evidence

RED, before the source change. PROVEN: tests/test-380-status-parity.cjs gave 46 passed, 3 failed (B2, the mapping check, the retired-name check). tests/test-380-shots-harness.cjs P11d failed (the reader returned false for the old fixture).
GREEN, after. PROVEN: parity 49 passed, 0 failed. P11 and P11d pass.

## Verification (all with temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME, UV_OFFLINE=1)

- PROVEN: the panel engine suite runs offline. `claude plugin test` in ui/mos-face needs no node_modules and no login: 409 pass, 0 fail (it was 405 before; 4 new tests). tests/test-380-engine-tests.cjs: 409 pass, 0 fail, count equals declarations.
- PROVEN: test-380-status-parity 49/0; test-380-budget 11/0; test-380-copy 37/0; rename 8/0; wall 7/0; decisions 74/0; egress 29/0; jobs 32/0; theo-faces 85/0; glossary-hold exit 0.
- PROVEN: tests/test-341-session-verify-state.cjs 18/0.
- PROVEN: `node scripts/build-harness-manifest.cjs --check` OK; `node scripts/build-connector-registry.cjs --check` OK.
- PROVEN: tests/test-341-update-collapsed.cjs: PASS=7 FAIL=1. Before this work the hits were lib/mos-face/dist/status.js and tests/test-380-shots-harness.cjs. Now only lib/mos-face/dist/status.js is left. Arm 2 STAYS RED until the dist is rebuilt. I did not weaken the test.
- PROVEN, known and expected: tests/test-380-build.cjs went from 2 fails (both need git history, not present in the archive baseline I compared) to 8. The extra 6 are the freshness arms. The dist records source hash a7e86072c7f80417; the source now hashes to 7a717565d239494c, because hooks/status.ts and hooks/lines.ts are inside the hash (tests, README and scripts/lib are not). `node scripts/build-mos-face.cjs --check` exits 1 until the rebuild. This is a release-gate item, not a defect in the change.
- PROVEN, pre-existing, not touched: tests/test-380-shots-harness.cjs S1 and S2 (4 fails) are Playwright screenshot failures. tests/test-380-gate-wiring.cjs has 5 fails about CHANGELOG face-panel lines; same 5 on the HEAD archive. tests/test-380-typecheck.cjs and tests/test-380-installed-layout.cjs exit 77 (environment gap: they need `npm ci`).
- UNVERIFIED: the type check (tests/test-380-typecheck.cjs exit 77 needs ui/mos-face/node_modules). The new status.ts lines use `(local as Obj).ok` after an object check; ASSUMED to pass `tsc`. The rebuild runs the compiler, so it will show any error.
- UNVERIFIED: the ui tests were not run against the OLD source to see the new P10 tests red. The offline red proof above covers the signal itself.

## Rebuild the dist (human, on a logged-in machine with network)

Source: ui/mos-face/package.json (`build` script) and scripts/build-mos-face.cjs. The build refuses to run over a node_modules that drifted from the lockfile.

```bash
cd /home/jsagi/dev/MindrianOS-Plugin/ui/mos-face
npm ci --ignore-scripts
cd ../..
node scripts/build-mos-face.cjs
node scripts/build-mos-face.cjs --check
node tests/test-341-update-collapsed.cjs
node tests/test-380-build.cjs
bash tests/run-all-380.sh
```

Generated files that change (ASSUMED from the build design: per-file emit plus a manifest; the final list comes from `git status` after the build):
- lib/mos-face/dist/status.js (the file read and the signal)
- lib/mos-face/dist/lines.js (the NOW copy)
- lib/mos-face/dist/manifest.json (source hash and file hashes)

No other dist file should change. If `git status` shows more, read the diff before committing. Commit those three files in one commit.

## Deviations

- [Rule 1 - Bug] The NOW copy in hooks/lines.ts said "restart is pending". Under the new signal that is false. Changed to the check wording. Not in the task's named file list; needed for correctness.
- The panel reads the state file under HOME only. The plugin's own test seam MOS_SESSION_VERIFY_HOME is not honored, because the panel's environment reads are pinned by tests/test-380-budget.cjs (G3). Real users do not set it. ASSUMED.

## Known stubs

None.

## Self-Check: PASSED

Commit fdb592cff exists on release/beta.77-prep. No push, tag, publish or version bump. lib/mos-face/dist untouched. No em-dash or en-dash in the added lines (grep run on the diff, no hits).
