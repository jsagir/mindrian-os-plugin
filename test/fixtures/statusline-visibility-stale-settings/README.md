# Phase 106 fixture: stale user-level statusLine override

Purpose: Simulates the Aryeh Holtzberg incident (2026-04-26).
`~/.claude/settings.json` contains a `statusLine.command` pinned to a
version-specific cache directory that no longer exists on disk.

Used by:
- tests/test-stale-settings-migration.cjs (Plan 106-01)
- tests/test-doctor-class-g.cjs (Plan 106-03 fixture 2)
- tests/test-doctor-class-g-fix.cjs (Plan 106-03)

Hermetic via MINDRIAN_ROOMS_HOME override per Phase 95.1 D-05 pattern.
