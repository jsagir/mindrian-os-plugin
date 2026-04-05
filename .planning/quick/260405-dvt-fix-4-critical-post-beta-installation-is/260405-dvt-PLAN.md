---
phase: quick-260405-dvt
goal: Fix 4 critical post-beta installation issues that blocked first external users
must_haves:
  truths:
    - Banner displays on every cold start regardless of marker files
    - /mos:onboard reset deletes marker files and triggers re-onboarding
    - Brain key lookup falls back to ~/.mindrian.env when CWD .env missing
    - Room creation shows OS-native "open folder" command
  artifacts:
    - scripts/session-start (banner logic)
    - commands/onboard.md (reset argument)
    - lib/core/brain-client.cjs (getApiKey fallback)
    - commands/new-project.md (open folder instruction)
  key_links:
    - scripts/session-start
    - commands/onboard.md
    - lib/core/brain-client.cjs
    - commands/new-project.md
---

# Quick Task 260405-dvt: Fix 4 Critical Post-Beta Installation Issues

## Plan 1: All fixes (single executor wave)

### Task 1: Banner on every cold start
- **files:** `scripts/session-start`
- **action:** In the cold start branch (line ~188-227), move the banner call OUTSIDE the LAST_VERSION conditional. Banner should fire on every cold start (no room detected), not just first install or version change. Keep the LAST_VERSION gate for the onboarding type detection (FIRST_INSTALL vs UPDATE vs CURRENT) and the marker file write.
- **verify:** `grep -A5 "Cold start" scripts/session-start` shows banner call before any LAST_VERSION check
- **done:** Banner fires every cold start; onboarding still respects markers

### Task 2: /mos:onboard reset command
- **files:** `commands/onboard.md`
- **action:** Add handling for "reset" argument at the top of the command. When user runs `/mos:onboard reset`, run `rm -f ~/.mindrian-onboarded ~/.mindrian-last-version`, then tell user: "Onboarding markers cleared. Close Claude Code and reopen it -- you'll see the banner and onboarding sequence fresh." Do NOT proceed with normal onboarding flow after reset.
- **verify:** Read commands/onboard.md, confirm reset handling exists before main flow
- **done:** Users can replay onboarding with `/mos:onboard reset`

### Task 3: Global Brain key fallback
- **files:** `lib/core/brain-client.cjs`
- **action:** In `getApiKey()` function, after the CWD `.env` check fails, add a third fallback that reads `~/.mindrian.env` (using `os.homedir()`). Same pattern: read file, match `MINDRIAN_BRAIN_KEY=(.+)`, return trimmed value. Also update the `setup.md` command to write to BOTH CWD/.env AND ~/.mindrian.env as a backup.
- **verify:** `node -e "const b = require('./lib/core/brain-client.cjs'); console.log(typeof b.getApiKey)"` succeeds
- **done:** Brain key survives directory changes

### Task 4: Post-room "open folder" instruction
- **files:** `commands/new-project.md`
- **action:** After room creation confirmation, add instruction to open the folder in the OS file browser. Use bash to detect OS: `uname -s` returns Darwin (macOS), Linux, or MINGW*/MSYS* (Windows). Show appropriate command: macOS = `open /path`, Linux = `xdg-open /path`, Windows = `explorer /path`. Frame it conversationally: "Your room is at [path]. To see it in your file browser, run: [command]"
- **verify:** Read commands/new-project.md, confirm OS detection and open command exists
- **done:** New users can find their room folder
