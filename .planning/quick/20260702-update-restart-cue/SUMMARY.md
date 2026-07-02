---
kind: quick
slug: 20260702-update-restart-cue
source: .planning/debug/windows-install-update-ux.md (F8)
completed: 2026-07-02
status: complete
---

# Quick: update restart cue (F8) - Summary

Made the post-update session-restart step LOUD and self-detecting, so users
stop reading the mid-session command-vanish as breakage.

## What shipped

**1. Stale-registry self-detector (Part 7 of the SessionStart preflight)**
`scripts/sessionstart-post-update-preflight.cjs` now runs a cheap, LOCAL,
strictly non-blocking check FIRST: it reads the version this session loaded
from (CLAUDE_PLUGIN_ROOT plugin.json, or the installPath basename fallback) and
compares it to `installed_plugins.json`'s registered version for
`mos@mindrian-marketplace`. On a mismatch (an update landed under a running
session) it emits a restart cue: a `systemMessage` banner plus
`additionalContext` telling Larry to surface "An update landed under this
session (X -> Y). Commands may be stale - restart this session to reactivate."
Two JSON reads, no Brain probe. Returns `{continue:true}` + exit 0 on match,
unknown version, malformed/missing file, or ANY error - it can never block the
hook chain.

**2. Loud restart banner + Mindrian mark**
- `commands/update.md` Step 8 now closes EVERY successful update path with the
  Mindrian logo (rendered via the lib/hmi/mindrian-ascii-logo.cjs CLI) FIRST,
  then a bordered `RESTART THIS SESSION NOW` banner as the LAST thing the user
  sees. A dedicated final section carries the verbatim banner block (approved
  glyphs only: box rule + warning + arrow, no emoji, no em-dashes).
- `scripts/post-update-activation.cjs` `renderActionReport` now ends a
  successful swap with the same logo-then-banner block. The logo is loaded
  defensively (best-effort require, wrapped render) so a missing/renamed module
  can never break the activation report.

**3. Logo module (scope extension, navigator-directed)**
`lib/hmi/mindrian-ascii-logo.cjs` was consumed as-is (not rewritten) and
committed with the banner change so there is one writer / one atomic change.

## Tests

`tests/test-update-restart-cue.cjs` - 22/22 PASS:
- (a) version mismatch -> restart cue emitted
- (b) versions match -> silent no-op
- (c) malformed AND missing installed_plugins.json -> graceful, no throw
- (d) grep-tests: update.md ends with banner block; update.md + activation
  reference mindrian-ascii-logo (wiring cannot silently drop)

## Gates

- `node -c` clean on all touched .cjs + logo module.
- Em-dash scan clean across changed files.
- Shape gate: OK (128 declared, 5 skill-exempt, 133 scanned), exit 0.
- Preflight in real dev env: {"continue":true}, exit 0.

## Deviations / deferred

- `tests/test-mos-update-activation-gap.cjs` fails 2/9 PASS pre-existing
  (identical on committed baseline). Root cause is the doctor.cjs --fix
  atomic-swap pipeline in that hermetic test env, unrelated to this task.
  Left untouched per scope boundary.

## Self-Check: PASSED
