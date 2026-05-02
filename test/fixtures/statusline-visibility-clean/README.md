# Phase 106 fixture: clean user-level settings (no stale entries)

Purpose: Negative-case fixture for invisibility detector. The plugin's
own settings.json still uses ${CLAUDE_PLUGIN_ROOT}; user-level settings
do not override statusLine. Migration script should be a no-op here.

Used by:
- tests/test-stale-settings-migration.cjs (Plan 106-01 idempotency case)
- tests/test-doctor-class-g.cjs (Plan 106-03 fixture 1: visible)
