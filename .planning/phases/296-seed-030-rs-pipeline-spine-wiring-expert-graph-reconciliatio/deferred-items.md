# Phase 296 - Deferred Items

Out-of-scope findings discovered during execution. Not fixed here per the
executor's scope-boundary rule (only auto-fix issues directly caused by the
current task's changes).

## 296-02: brain-server-resolution.test.cjs T4 pre-existing failure

- **Found during:** 296-02 Task 2 plan-close verification
  (`node lib/memory/brain-server-resolution.test.cjs`).
- **Symptom:** `FAIL T4 docs/install/BRAIN-SETUP.md exists with canonical
  name + mcpServers snippet: BRAIN-SETUP.md missing user-side .mcp.json
  snippet (\`mcpServers\`)`. Suite reports 4/5 passed, exit 1.
- **Scope check:** `docs/install/BRAIN-SETUP.md` was not touched by this
  plan (last commit `8db8d621`, predates this session).
  `lib/memory/brain-server-resolution.test.cjs` was also not touched by
  this plan (last commit `9b778dc2`, Phase 94-03). Confirmed unrelated to
  `commands/rs-experts.md`'s description/teaching-line edit, which is the
  only surface this plan's Task 2 touches that this suite exercises (T1-T3,
  T5 all still PASS).
- **Action:** none taken. Named here rather than silently left for a third
  session to rediscover.
