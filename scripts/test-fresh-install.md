# Fresh Install Test Checklist

Manual test procedure for verifying the install guide works on clean machines.
Run before each release that changes the install flow.

## Prerequisites

- A clean Mac or Windows machine (or VM/container with no prior Node.js or Claude Code)
- An active Claude Pro or Max subscription
- Internet connection
- The install guide page open in a browser: https://mindrian.ai/docs/install

---

## Test Matrix

| Step | Mac | Windows | Notes |
|------|-----|---------|-------|
| 1. Open terminal | [ ] | [ ] | Mac: Cmd+Space > Terminal. Win: Win key > PowerShell |
| 2. Check Node.js | [ ] | [ ] | Should show "command not found" on fresh machine |
| 3. Install Node.js | [ ] | [ ] | Download from nodejs.org LTS, run installer |
| 4. Verify Node.js | [ ] | [ ] | Close terminal, open new one, `node -v` shows version |
| 5. Install Claude Code | [ ] | [ ] | Mac: `sudo npm install -g @anthropic-ai/claude-code`. Win: `npm install -g @anthropic-ai/claude-code` |
| 6. Launch Claude Code | [ ] | [ ] | Type `claude`, press Enter |
| 7. Authenticate | [ ] | [ ] | Follow sub-steps (a)-(g), paste code within 60s |
| 8. Install MindrianOS | [ ] | [ ] | `claude plugin install mindrian-os@mindrian-marketplace` |
| 9. Banner appears | [ ] | [ ] | De Stijl colored blocks visible in terminal |
| 10. Larry greets | [ ] | [ ] | Onboarding walkthrough starts automatically |

---

## Mac-Specific Tests

### M1. sudo password invisible
- [ ] Type sudo command, verify password prompt appears
- [ ] Type password (no characters visible), press Enter
- [ ] Confirm install continues
- **Screenshot:** Terminal showing sudo prompt with no visible characters

### M2. Permission denied fallback
- [ ] If EACCES occurs, try the `~/.npm-global` workaround
- [ ] Verify Claude Code works after alternative install
- **Screenshot:** Terminal showing the alternative npm prefix commands

### M3. Spotlight search for Terminal
- [ ] Cmd+Space, type "Terminal", press Enter
- [ ] Terminal window appears with blinking cursor
- **Screenshot:** Spotlight search showing Terminal result

---

## Windows-Specific Tests

### W1. PowerShell launch
- [ ] Win key, type "PowerShell", press Enter
- [ ] Blue PowerShell window appears
- **Screenshot:** Start menu showing PowerShell search result

### W2. npm not in PATH
- [ ] If "npm is not recognized" appears after Node.js install
- [ ] Verify fix: close PowerShell, rerun Node.js installer with "Add to PATH" checked
- [ ] Open new PowerShell, verify `npm -v` works
- **Screenshot:** PowerShell showing the "not recognized" error

### W3. Right-click paste
- [ ] Verify right-click paste works in PowerShell
- [ ] Verify Ctrl+V paste works as fallback
- **Screenshot:** PowerShell with pasted auth code visible

---

## Post-Install Verification

### P1. Plugin listed
- [ ] Run `claude plugin list` inside Claude Code
- [ ] MindrianOS appears in the list
- **Screenshot:** Plugin list showing MindrianOS installed

### P2. Onboarding flow
- [ ] Larry's welcome message appears on first session
- [ ] Three approach options shown (Q&A / Paste / Research)
- [ ] Skip option works and drops to command menu
- **Screenshot:** Larry's onboarding greeting

### P3. New project flow
- [ ] Type `/mos:new-project`
- [ ] Larry asks about the venture
- [ ] Room directory created in ~/MindrianRooms/
- **Screenshot:** New project conversation start

### P4. Update detection
- [ ] Install an older version first
- [ ] Then update to latest
- [ ] `/mos:onboard whats-new` shows changelog
- **Screenshot:** What's new display

---

## Screenshot Manifest

Each screenshot should be 1200x800 minimum, PNG format, showing only the relevant terminal/browser window.

| ID | Description | Platform | File |
|----|-------------|----------|------|
| S01 | Spotlight/Start search for terminal | Mac + Win | `screenshots/01-open-terminal-{mac,win}.png` |
| S02 | `node -v` command not found | Mac + Win | `screenshots/02-node-not-found-{mac,win}.png` |
| S03 | Node.js installer download page | Both | `screenshots/03-nodejs-download.png` |
| S04 | `node -v` showing version after install | Mac + Win | `screenshots/04-node-version-{mac,win}.png` |
| S05 | Claude Code install command | Mac + Win | `screenshots/05-install-claude-{mac,win}.png` |
| S06 | sudo password prompt (Mac only) | Mac | `screenshots/06-sudo-prompt-mac.png` |
| S07 | Claude Code first launch | Mac + Win | `screenshots/07-claude-launch-{mac,win}.png` |
| S08 | Auth browser page with code | Both | `screenshots/08-auth-browser.png` |
| S09 | Auth code paste in terminal | Mac + Win | `screenshots/09-auth-paste-{mac,win}.png` |
| S10 | Plugin install command | Both | `screenshots/10-plugin-install.png` |
| S11 | MindrianOS banner | Both | `screenshots/11-banner.png` |
| S12 | Larry's onboarding greeting | Both | `screenshots/12-onboarding.png` |

---

## Failure Mode Quick Reference

If any step fails during testing, check the troubleshooting section on the install page.

| Error | One-Line Fix |
|-------|-------------|
| `claude: command not found` | Close terminal, open a new one |
| `npm: command not found` | Install Node.js from nodejs.org, then reopen terminal |
| `EACCES permission denied` | Mac: use `sudo`. Win: run as admin |
| Auth code expired | Type `claude` again, work faster this time |
| Wrong account signed in | Go to claude.ai, log out, then re-auth with subscription email |
| Nothing happens after paste | Click inside terminal first, then paste |
| sudo password invisible | Normal security feature -- type password, press Enter |
| Plugin not found | Check internet, retype exact command |
| Brain connection failed | Check API key, run `/mos:setup brain` |
| Banner does not appear | Run `/mos:onboard` manually |

---

*Last updated: 2026-04-07*
*Covers: MindrianOS v1.8.7+*
