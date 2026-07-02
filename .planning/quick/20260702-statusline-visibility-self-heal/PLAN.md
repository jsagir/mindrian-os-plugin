---
kind: quick
slug: statusline-visibility-self-heal
opened: 2026-07-02
finding: F6 (.planning/debug/windows-install-update-ux.md)
status: in-progress
---

# Quick task: statusline VISIBILITY self-heal (F6)

## Problem

`scripts/check-onboard-statusline.cjs` (SessionStart hook) only SURFACES a
"do you see the statusline?" question when it fires (fresh install or version
bump). It does NOT fix anything -- the navigator must run
`/mos:doctor --statusline-visibility --fix` by hand. Close the loop.

## Change

Modify `scripts/check-onboard-statusline.cjs` so that, when it would fire:

1. FIRST auto-run the shipped repair by spawning
   `node <PLUGIN_ROOT>/scripts/doctor.cjs --statusline-visibility --fix --json`
   (spawnSync, already imported). REUSE it -- do NOT reimplement settings.json
   repair (Canon Part 7).
2. If the doctor reports the statusline is now OK (class G `statusline-visibility`
   AND class H `install-incomplete` both `status:"ok"` in the JSON -- doctor
   re-checks after `--fix`), WRITE the touch-file
   `~/.mindrian/onboarding/statusline-onboarded.json`
   `{installed_version:<plugin.json version>, completed_at:<ISO>}` and suppress
   the manual question. Loop closed silently.
3. ONLY if the auto-fix could NOT resolve it (doctor missing / errored / still
   drift) fall back to the current behavior: surface the additionalContext
   question.

Applied to BOTH code paths: `contributeOnboarding()` (active coordinator path)
and the legacy bare-hook `done()`.

## Invariants (HARD)

- Never blocks the hook chain: on ANY error -> `{continue:true}`, exit 0.
- uncaughtException guard intact; pure CJS + node built-ins; zero npm deps.
- Touch-file shape unchanged.
- Idempotent: a healthy session with a current touch-file is a no-op --
  `shouldFire()` gates BEFORE the doctor spawn, so no doctor spawn happens.
- Doctor spawn guarded with a timeout + try/catch; degrade to
  surface-the-question, never crash.
- No em-dashes.

## Why doctor exit code is not trusted

Under class flags doctor honors the graceful-degradation invariant and ALWAYS
exits 0 (doctor.cjs `_finalizeAndExit`, `classFlagsActive` branch). So health is
read from the JSON check statuses, NOT the exit code.

## Test

`tests/test-statusline-visibility-self-heal.cjs` -- stubs the doctor spawn via a
fake `CLAUDE_PLUGIN_ROOT/scripts/doctor.cjs` + temp `HOME`:
- (a) missing statusLine wiring -> fake doctor reports repaired -> hook writes
  touch-file (correct shape) + suppresses the question.
- (b) already-healthy + current touch-file -> no-op: no doctor spawn (fake
  doctor drops a sentinel iff invoked -> asserted absent), no question.
- (c) doctor unavailable (no doctor.cjs in fake root) -> degrades gracefully:
  never throws, surfaces the question, writes no touch-file.

## Files

- scripts/check-onboard-statusline.cjs (modify)
- tests/test-statusline-visibility-self-heal.cjs (new)
