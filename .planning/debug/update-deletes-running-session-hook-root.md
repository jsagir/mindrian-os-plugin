---
kind: rca
status: diagnosed
severity: medium
found: 2026-08-11, live, in the orchestrator session itself
---

# Plugin update deletes the cache dir a RUNNING session's hooks still point to

## Symptom (observed live)
After `claude plugin update` moved the machine to 2.0.0-beta.3 and its cleanup pruned old
cache versions, a long-running session whose ${CLAUDE_PLUGIN_ROOT} was frozen at boot to
.../mos/1.16.0-beta.7 began failing ALL 7 Stop hooks every stop:
"Failed to run: Plugin directory does not exist: .../mos/1.16.0-beta.7 - run /plugin to reinstall".

## Class
The known "running session never hot-reloads" rule has an uglier sibling: after an update
prunes the old cache, the running session does not run STALE hook code - it runs NO hook
code, with hard errors per stop. Every hook (Stop, UserPromptSubmit, PostToolUse incl. the
Brain sanitize hook) dies identically. A user mid-session at update time loses the guardian,
the card-fire gate, the sanitize layer - silently except for the error spam.

## Root cause
Two interacting behaviors: (1) hook commands resolve ${CLAUDE_PLUGIN_ROOT} at session start
and keep the literal path for the session's life; (2) the updater's cache cleanup deletes
old version dirs immediately rather than keeping N-1 while any session may reference it.

## Candidate fixes (decide in planning, not here)
- Keep N-1 cache versions on update; prune on the NEXT update (grace window).
- Or: hooks resolve the live plugin root at FIRE time via a stable symlink
  (.../mos/current -> versioned dir) so running sessions degrade to newest code instead
  of nothing (accepting the hot-reload semantics that implies for hooks only).
- Or: updater detects running sessions holding the old root and defers pruning.

## Evidence
This session's stop output 2026-08-11 (7 identical failures); cache listing showing only
2.0.0-beta.1 and 2.0.0-beta.3 present after update; the session booted on the beta.7 era.

## Live mitigation trial (2026-08-11, same session)
Candidate fix #2 applied by hand as an emergency patch: `ln -s 2.0.0-beta.3 1.16.0-beta.7`
inside the cache dir. Result: all 7 hooks resolve and fire again immediately, now running
CURRENT code (per-fire spawn picks up the symlink; the long-lived MCP server processes
keep their in-memory boot code, an acceptable hybrid). Zero errors on subsequent stops.
This upgrades fix #2 from candidate to field-proven: a stable `current` symlink maintained
by the updater gives running sessions modern hooks instead of dead ones. The updater
change (create/repoint the symlink, or keep N-1 dirs) is the durable form of what this
hand-made link proved.
