---
phase: "64"
plan: "01"
subsystem: install-experience
tags: [install, error-handling, troubleshooting, onboarding, testing]
dependency_graph:
  requires: []
  provides: [human-readable-errors, troubleshooting-page, test-checklist]
  affects: [scripts/resolve-room, scripts/room-registry, scripts/session-start, scripts/check-update, scripts/self-update, website/install-page]
tech_stack:
  added: []
  patterns: [what-why-fix-error-pattern]
key_files:
  created:
    - scripts/test-fresh-install.md
  modified:
    - scripts/resolve-room
    - scripts/room-registry
    - scripts/session-start
    - scripts/check-update
    - scripts/self-update
    - /home/jsagi/mindrian-website/website/src/app/docs/install/page.tsx
decisions:
  - "Error pattern: every user-facing error follows [MindrianOS] What / Why: reason / Fix: /mos:command"
  - "Onboarding flows verified correct without code changes needed"
  - "Email template standard verified email-client-safe without changes needed"
metrics:
  duration: "278s"
  completed: "2026-04-07T11:49:51Z"
  tasks_completed: 5
  files_changed: 7
---

# Phase 64 Plan 01: Dummy-Proof Install Experience Summary

Human-readable error messages across 5 scripts, top 10 troubleshooting items on install page, test checklist for Mac/Windows fresh installs.

## What Was Done

### INST-04: Human-Readable Error Messages (Code Changes)

Replaced cryptic error output with the "What / Why / Fix" pattern across 5 scripts:

**resolve-room** (keystone script): Added human-readable messages when no room found (Strategy 3) and when registry exists but no active room (Strategy 1). Previously exited silently with code 1.

**room-registry** (8 subcommands): Improved all error paths for `create`, `read`, `update`, `set-active`, `archive`, `git-config`, `get-active`, and the catch-all. Every "Room not found" Python error now includes a fix suggestion. Every missing-argument error now suggests `/mos:rooms` or `/mos:new-project`.

**session-start**: Improved the compute-state fallback message from "Error computing state" to an actionable message suggesting `/mos:status`.

**check-update**: Added Why/Fix lines to both CHECK_FAILED error paths (version read failure and network failure).

**self-update**: Improved 3 error messages: clone failure (suggests checking internet/firewall), validation failure (suggests retry), and connection failure.

### INST-07: Top 10 Failure Modes (Install Page)

Added 4 new troubleshooting items to the install page, bringing the total to 10:
1. "claude: command not found" -- close terminal, open new one (existing)
2. "npm: command not found" -- install Node.js from nodejs.org (existing)
3. "EACCES permission denied" -- use sudo or alternative prefix (existing)
4. Authentication keeps failing -- subscription email, speed, retry (existing)
5. Cannot paste into terminal -- platform-specific paste shortcuts (existing)
6. Install seems stuck -- wait 2 min, Ctrl+C if hangs (existing)
7. **Password invisible when typing sudo** -- Mac only, security feature (NEW)
8. **Plugin install says 'not found'** -- check internet, exact command (NEW)
9. **Brain connection failed** -- check API key, /mos:setup brain (NEW)
10. **Banner does not appear** -- close/reopen, /mos:onboard, plugin list (NEW)

### INST-05/06: Onboarding Flow Verification (Analysis Only)

Reviewed `commands/onboard.md` and `scripts/check-onboard`:
- Fresh install flow: `FIRST_INSTALL` status correctly triggers full onboarding in session-start
- Update flow: `UPDATE` status correctly parses CHANGELOG.md for whats-new content
- `/mos:onboard whats-new`: Mode detection correctly jumps to Step 5
- `/mos:onboard reset`: Correctly clears marker files
- Marker writing: Documented as CRITICAL, must happen in ALL paths (command handles this)
- Edge case: `python3` unavailable gracefully degrades version to "unknown"
- No code changes needed -- flows are solid.

### INST-08: Email Template Verification (Analysis Only)

Reviewed `references/design/email-template-standard.md`:
- All inline styles (no external CSS) -- email-safe
- Table-based layout throughout -- renders in all clients
- Email-safe fonts only (Trebuchet MS, Arial, Courier New)
- Fixed 600px width -- safe for email clients
- dir="ltr" on outer wrapper -- RTL-safe
- No border-radius, no background images, no web fonts
- No code changes needed -- template is email-client-safe.

### INST-01/02/03: Fresh Install Test Checklist

Created `scripts/test-fresh-install.md` with:
- 10-step test matrix for both Mac and Windows
- 3 Mac-specific test cases (sudo, permissions, Spotlight)
- 3 Windows-specific test cases (PowerShell, PATH, paste)
- 4 post-install verification steps (plugin list, onboarding, new project, update)
- Screenshot manifest with 12 required captures
- Failure mode quick reference table

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Error pattern**: Standardized on `[MindrianOS] What happened / Why: reason / Fix: /mos:command` across all scripts
2. **Onboarding verified, not changed**: The onboarding flow (INST-05/06) was reviewed and found correct -- no code modifications needed
3. **Email template verified, not changed**: The template standard (INST-08) already follows all email-safe practices -- no modifications needed

## Known Stubs

None. All changes are complete and functional.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| INST-04 | 26697a0 | Human-readable error messages in 5 scripts |
| INST-07 | 52b3a3b | Top 10 failure modes on install page (website repo) |
| INST-01/02/03 | 1f87071 | Fresh install test checklist for Mac and Windows |

## Self-Check: PASSED

- scripts/test-fresh-install.md: FOUND
- .planning/phases/64-dummy-proof-install/64-01-SUMMARY.md: FOUND
- Commit 26697a0 (error messages): FOUND in MindrianOS-Plugin repo
- Commit 1f87071 (test checklist): FOUND in MindrianOS-Plugin repo
- Commit 52b3a3b (install page): FOUND in mindrian-website repo
