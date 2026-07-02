---
kind: quick
slug: statusline-visibility-self-heal
opened: 2026-07-02
completed: 2026-07-02
finding: F6 (.planning/debug/windows-install-update-ux.md)
status: complete
commit: 6449e355
---

# Summary: statusline VISIBILITY self-heal (F6)

Closed the loop the SessionStart onboarding gate left open. Before this change,
`scripts/check-onboard-statusline.cjs` only SURFACED a "do you see the statusline?"
question and waited for the navigator to run `/mos:doctor --statusline-visibility
--fix` by hand. Now the gate auto-repairs on session start and stays silent when the
repair succeeds.

## What changed

`scripts/check-onboard-statusline.cjs` (+ new test). When the gate would fire
(fresh install, no touch-file; or version bump, touch-file mismatch):

1. Auto-fix first. New `attemptStatuslineSelfHeal()` spawns the shipped repair
   `node <PLUGIN_ROOT>/scripts/doctor.cjs --statusline-visibility --fix --json`
   (spawnSync, 4s timeout, try/catch). Canon Part 7 reuse: doctor already owns the
   class G (stale `~/.claude/settings.json` overrides) + class H (missing `statusLine`
   block) detect+repair. We do NOT reimplement the settings.json rewrite.
2. Read health from JSON, not exit code. Under class flags doctor honors its
   graceful-degradation invariant and ALWAYS exits 0 (`_finalizeAndExit`,
   `classFlagsActive` branch). So "resolved" is read from the re-checked JSON check
   statuses: both `checks['statusline-visibility'].status === 'ok'` AND
   `checks['install-incomplete'].status === 'ok'`.
3. On resolve: record + suppress. New `writeTouchFile(ver)` writes
   `~/.mindrian/onboarding/statusline-onboarded.json`
   `{installed_version:<plugin.json version>, completed_at:<ISO>}` (shape unchanged),
   then the gate returns the empty fragment / empty envelope. The manual question is
   NOT surfaced. Loop closed silently.
4. On failure: fall back. If doctor is missing / errored / still reports drift,
   the gate degrades to the pre-existing behavior and surfaces the additionalContext
   question so the human can intervene.

Applied to BOTH code paths: the active `contributeOnboarding()` coordinator
contributor AND the legacy bare-hook `done()`.

## Invariants preserved (HARD)

- Never blocks the hook chain. Every new function is wrapped in try/catch; on any
  error the caller degrades to surface-the-question or `{continue:true}`. The
  `uncaughtException -> emitEmpty()` guard is untouched.
- Idempotent / no wasted spawn. `shouldFire()` still gates BEFORE the doctor
  spawn, so a healthy session with a current touch-file is a pure no-op (no doctor
  process). Proven by test case (b) via an absent invocation sentinel.
- Pure CJS, node built-ins only, zero npm deps. Reuses the already-imported
  `spawnSync`, `fs`, `path`, `os`.
- Touch-file shape unchanged: exactly `installed_version` + `completed_at`.
- Timeout + try/catch on the doctor spawn (4s); doctor-missing short-circuits
  before spawning.
- No em-dashes.

## Test

`tests/test-statusline-visibility-self-heal.cjs` -- 19/19. Stubs the doctor spawn via
a fake `CLAUDE_PLUGIN_ROOT/scripts/doctor.cjs` + temp `HOME` (no real broken install);
each case re-requires the hook fresh so the module-load PLUGIN_ROOT picks up the fake
root. The stub drops a sentinel iff invoked, so "no doctor spawn" is directly assertable.

- (a) missing statusLine wiring -> fake doctor reports repaired -> touch-file written
  with the correct shape + running version, question suppressed, gate then idempotent.
- (b) already-healthy + current touch-file -> no-op, NO doctor spawn (sentinel absent),
  nothing surfaced.
- (c) doctor unavailable (no doctor.cjs in fake root) -> `attemptStatuslineSelfHeal()`
  and `contributeOnboarding()` never throw, self-heal reports unresolved, question
  surfaced as the fallback, no touch-file.
- (d) doctor runs but still reports drift after --fix -> question surfaced, no touch-file.

## Gates

- `node -c scripts/check-onboard-statusline.cjs` OK (pre-commit ran, no --no-verify).
- 19/19 self-heal; adjacent statusline suites green (banner-suppression 5/5,
  liveness-gate).
- No em-dashes across all changed files.
- Canon Part 7 (reuse doctor, not reimplement) + Part 8 (LOCAL-only: a local node
  subprocess + local file writes, zero network / zero Brain).

## Files

- scripts/check-onboard-statusline.cjs (modified: +~110 lines -- 2 helpers, 2 wire-ins,
  exports)
- tests/test-statusline-visibility-self-heal.cjs (new, 165 lines)

## Deviations / follow-ups

- None to the plan. An unrelated 2-line README.md working-tree change (a cascade-hook
  artifact) was deliberately left unstaged and NOT part of this atomic commit.
- F6 in windows-install-update-ux.md can now move from OPEN to FIXED; the remaining
  cluster items (F5 Windows shell verification, F7 warning noise) are untouched.

## Self-Check: PASSED

- scripts/check-onboard-statusline.cjs: FOUND (committed 6449e355)
- tests/test-statusline-visibility-self-heal.cjs: FOUND (committed 6449e355)
- commit 6449e355: FOUND in git log
