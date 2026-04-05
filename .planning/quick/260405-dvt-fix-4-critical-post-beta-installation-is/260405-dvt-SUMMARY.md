---
phase: quick-260405-dvt
plan: 260405-dvt
subsystem: installation-ux
tags: [cold-start, onboarding, brain-key, file-browser]
key-files:
  modified:
    - scripts/session-start
    - commands/onboard.md
    - lib/core/brain-client.cjs
    - commands/setup.md
    - commands/new-project.md
decisions:
  - Banner fires unconditionally on cold start; version transition only changes banner args
  - Reset is a top-level argument check that short-circuits before any walkthrough logic
  - Global key fallback uses ~/.mindrian.env (not ~/.env) to avoid conflicting with other tools
  - WSL detection via /proc/version grep for Windows file browser command
metrics:
  duration: 100s
  completed: 2026-04-05
  tasks: 4
  files: 5
---

# Quick Task 260405-dvt: Fix 4 Critical Post-Beta Installation Issues

Banner fires every cold start, onboard reset clears markers, Brain key falls back to ~/.mindrian.env, room creation shows OS-native file browser command.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Banner on every cold start | 53354ae | scripts/session-start |
| 2 | /mos:onboard reset command | 25d0fce | commands/onboard.md |
| 3 | Global Brain key fallback | ef307bd | lib/core/brain-client.cjs, commands/setup.md |
| 4 | Post-room open folder instruction | c453f63 | commands/new-project.md |

## What Changed

### Task 1: Banner on every cold start
Moved the `bash banner` call outside the `LAST_VERSION` conditional so it fires on every cold start (no room detected). The version transition banner still passes the old version arg when an update is detected. The LAST_VERSION checks remain for onboarding type detection (FIRST_INSTALL vs UPDATE vs CURRENT) and marker file writes.

### Task 2: /mos:onboard reset
Added a "Reset Mode" section at the top of onboard.md that checks for the `reset` argument before anything else. Runs `rm -f ~/.mindrian-onboarded ~/.mindrian-last-version`, tells the user to restart Claude Code, then stops. Does not fall through to any walkthrough steps.

### Task 3: Global Brain key fallback
Added a third fallback in `getApiKey()`: env var -> CWD .env -> ~/.mindrian.env. Uses `require('os').homedir()` to locate the global file. Updated `commands/setup.md` to write the key to both CWD .env and ~/.mindrian.env during Brain setup, with sed-based update-or-append logic.

### Task 4: Post-room open folder
Added Step 7.5 between STATE.md computation and Cowork context. Detects OS via `uname -s`, handles macOS (open), Linux (xdg-open), Windows (explorer), and WSL (wslpath conversion + explorer.exe). Framed conversationally as a helpful nudge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Updated setup.md alongside brain-client.cjs**
- **Found during:** Task 3
- **Issue:** Plan mentioned updating setup.md but the brain-client.cjs was the primary target. Both needed changes to complete the feature.
- **Fix:** Added step 4 to setup.md's key saving flow with sed-based update-or-append for ~/.mindrian.env
- **Files modified:** commands/setup.md
- **Commit:** ef307bd

## Known Stubs

None -- all changes are complete and functional.

## Self-Check: PASSED
