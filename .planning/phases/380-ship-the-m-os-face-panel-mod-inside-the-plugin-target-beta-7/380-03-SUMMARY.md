---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 03
subsystem: ui-mod-proof-harness
tags: [mos-face, real-terminal, tmux, playwright, screenshots, capture-harness]
requires: [380-01]
provides:
  - ui/mos-face/scripts/capture-shots.cjs (CLI, six scenarios)
  - ui/mos-face/scripts/lib/ansi-page.cjs (parseAnsi, toHtml, pageSize)
  - ui/mos-face/scripts/lib/tmux-session.cjs (private tmux, scratch config, transcript, trust answer, slash submit)
  - tests/test-380-shots-harness.cjs (hermetic legs P1 to P10 plus the real self-test S1)
affects: [380-10]
tech-stack:
  added: []
  patterns: [private tmux socket, scratch CLAUDE_CONFIG_DIR with credentials symlink, synthetic transcript with claude --resume]
key-files:
  created:
    - ui/mos-face/scripts/capture-shots.cjs
    - ui/mos-face/scripts/lib/ansi-page.cjs
    - ui/mos-face/scripts/lib/tmux-session.cjs
    - tests/test-380-shots-harness.cjs
  modified: []
key-decisions:
  - "Screen background of the page is #2b2b2b, not ink #111111: canon ink is #111111, so a canon black fill was invisible on an ink page (seen in the first self-test image)."
  - "The child hides TMUX and TMUX_PANE: claude rounds every color to 256 inside tmux, even with COLORTERM=truecolor."
  - "The child also loses every inherited CLAUDE_*, CLAUDECODE and MINDRIAN_* name (secrets and our own names stay)."
  - "A scratch capture also gets a scratch HOME: the mod reads HOME/MindrianRooms, so a real HOME would read the real rooms registry."
requirements-completed: [MOD380-01]
duration: about 70 minutes
completed: 2026-10-23
---

# Phase 380 Plan 03: Real-terminal capture harness - Summary

A harness now turns a real Claude Code session into PNG, ANSI, text and HTML files with no human step and no model call. A private tmux server holds the pseudo-terminal, `capture-pane -e` reads the screen with its colors, `lib/ansi-page.cjs` builds one self-contained HTML page, and the global Playwright CLI takes the PNG. No new npm package.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing was pushed. No branch was created or switched.

## Commits (release tree)

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 053cd80d8 | feat(380-03): ANSI page builder and tmux session helper for the real-terminal capture |
| 2 | 6e92d1864 | feat(380-03): real-terminal capture CLI (tmux, ANSI page, Playwright PNG) with a fixed-program self-test |

`git rev-list --count origin/main..main` is 10 after this plan (the plan 01 commits, the plan 02 commits and these 2). Review all before any push.

## Tool versions (PROVEN, from index.json and the shell)

- claude 2.1.309 (Claude Code), logged in.
- tmux 3.7.
- Playwright CLI 1.58.2, chromium. Font: DejaVu Sans Mono.
- Node v22.23.1.

## Task 1: RED then GREEN

- RED, before the helpers existed: `0 passed, 10 failed` (P1 to P10, all with a missing-module error).
- GREEN, after: `10 passed, 0 failed` (P1 to P10). Later a leg P6b was added (inherited session markers), so the final unit count is 11.
- The plan names P1 to P9. A tenth leg P10 (scrub replaces the home path with HOME) was added because the plan asks for the scrub function and T-380-09 depends on it.
- Dash fence on the new files: clean (`LC_ALL=C /usr/bin/grep -qP '\xE2\x80\x94|\xE2\x80\x93'` finds nothing).

## Task 2: self-test S1 (PROVEN)

`node tests/test-380-shots-harness.cjs`: `19 passed, 0 failed`, exit 0. S1 runs the CLI on a fixed shell program (five canon-color truecolor blocks with words, a bold line, a dim line, a half-block row) for `std` and `nocolor` through the real tmux and Playwright path. The checks: each PNG exists, is larger than 2,000 bytes, starts with the PNG signature, and has an IHDR size of at least 400 by 300; the text capture holds the sample words; the std ANSI capture holds `48;2;31;63;191` (cobalt 1F3FBF); the nocolor ANSI capture holds no `48;2`.

`bash tests/run-all-380.sh` after this plan: `PASSED=5 FAILED=0 SKIPPED=8 KNOWN=0`. The shots harness leg is PASSED.

### Self-test image

I opened the PNG with the Read tool. First image (page background ink #111111, std scenario): blue, red, yellow and white blocks showed, the words were readable, the half-block row was drawn (red upper half, yellow lower half), bold and dim lines were distinct. Defect: the black block (canon black #111111) was invisible, because the page background had the same value. Root cause: canon ink and the page background are the same color. Fix: the screen background is now #2b2b2b (a neutral stand-in for a terminal theme; recorded in the header of `ansi-page.cjs`). Second image after the fix: all five blocks show, the black block reads as darker than the screen, words readable, bold and dim lines distinct, half-block row drawn. Remaining small defect: faint vertical seams between the cells of the half-block row (the fractional character width of 8.43 px). It does not hide anything. The nocolor image: plain words, no fills, the plain-text stand-in row shows. PROVEN for what the opened images show only.

## Beyond the plan: a real claude run (PROVEN, no model call)

I ran the real path with `--plugin ui/mos-face` and opened the PNGs: wide (120x40), std, narrow, nocolor, small and chip all returned `ok`; `--keys /mos-state` opened the panel on wide.

- No onboarding screen, no trust dialog, no user plugin and no user status line showed in the scratch session. The `answered` list is empty: the seeded `.claude.json` made the dialog unnecessary, so the pointer-first answer code ran only in the hermetic test P5 and in unit form, not against the live dialog (UNVERIFIED live).
- Chip: the resumed synthetic transcript shows `Hello.` and the reply "This is a fixed test sentence for the screenshot harness." with the chip `Larry | MindrianOS` drawn in cobalt blue on the reply's own lead. No model call was made. The transcript slug rule (every character that is not a letter or digit becomes a hyphen) matched.
- `--keys /mos-state`: typed, the safe submit read the screen, the highlighted row was `/mos-state`, Enter pressed; the dashboard panel opened on the right side at 120 columns and was readable in the image.
- Truecolor: 15 to 22 `38;2` or `48;2` sequences per colored capture; the nocolor capture holds none.
- The real `~/.claude/.credentials.json` mtime (17:05) is older than every run (about 17:48 onward); `~/.claude/projects` holds no scratch slug. I wrote nothing by hand into `~/.claude`. The `--config real` mode was not run.

## Deviations from Plan

**1. [Rule 1 - Bug] Claude rounded all colors to 256 inside tmux**
- **Found during:** the first real run: 0 truecolor sequences in std, chip showed 38;5 forms only, the chip was purple instead of cobalt.
- **Root cause:** claude 2.1.309 clamps to the 256 palette when the `TMUX` variable is set, even with `COLORTERM=truecolor`. Measured: unsetting `TMUX` and `TMUX_PANE` gave 25 truecolor sequences and 0 palette sequences.
- **Fix:** both names join the unset list. Files: `tmux-session.cjs`. Commit 6e92d1864.

**2. [Rule 1 - Bug] Inherited session markers polluted every screenshot**
- **Found during:** second real run, chip image showed "Transcript saving is off - inherited CLAUDE_CODE_CHILD_SESSION marker".
- **Root cause:** the harness ran inside a Claude Code session, so `CLAUDE_CODE_CHILD_SESSION` and other markers reached the child.
- **Fix:** the child env builder unsets every inherited `CLAUDE_*`, `CLAUDECODE` and `MINDRIAN_*` name except the secrets and its own names. Test P6b. Commit 6e92d1864.

**3. [Rule 1 - Bug] Suggestion list was not found**
- **Found during:** `--keys /mos-state`: the safe submit refused with "no suggestion list is on the screen".
- **Root cause:** in claude 2.1.309 the list is drawn above the prompt rule (the panel block sits between the list and the rule); the copied reader scanned only below the prompt.
- **Fix:** the reader scans both sides. The refusal itself was correct and cleared the prompt (Ctrl-U), which is the T-380-08 behavior. Commit 6e92d1864.

**4. [Rule 2 - Missing critical functionality] Scratch HOME**
- **Found during:** reading `hooks/bind.ts`: the mod reads `$HOME/MindrianRooms/.rooms/registry.json`, not `MINDRIAN_ROOMS_HOME`. A real HOME would show real room names (T-380-09).
- **Fix:** a scratch capture sets HOME to a scratch folder and builds the throwaway `MindrianRooms` inside it; `MINDRIAN_ROOMS_HOME` still points there. The login rides on the credentials symlink. `--config real` keeps the real HOME and says in `--help` that the files may show real room names.

**5. [Plan literal] Page screen background #2b2b2b instead of #111111** (see Self-test image). The plan said ink #111111.

**6. [Plan literal] Slug rule widened** to "every non-alphanumeric character becomes a hyphen" (the plan named slash and dot). The result is identical for the paths the harness makes.

**7. Self-test program honors NO_COLOR.** The fixed program prints plain text when `NO_COLOR` is set, because a plain `printf` ignores the variable and the plan asks for no `48;2` in the nocolor capture.

**8. Allow-list** holds /mos-state, /mos-face, /mos-style, /mos-chip, /mos-suggest, /mos-refresh, /mos-plain, /mos-text, /mos-words, /mos-auto and /theo-calls. `/mos-ask` (puts a question in the prompt box) and `/mos-advice` (asks Theo now) are left out on purpose.

**9. `--plugin` may repeat.** One `--plugin` is the plan's form; repeating it adds more `--plugin-dir` flags. Plan 10 needs this to load the mindrian-os plugin next to the mod.

## Notes for plan 10

- With only `--plugin ui/mos-face`, the panel has no room tools, so it shows "not bound to a room" and "Theo is not answering its health check". To show room data, also pass the plugin that serves `room_state_bound` and friends. UNVERIFIED that the throwaway room then reads; not run.
- The mod's probe polls the network on its own (the panel said Theo was not answering). That is mod behavior, not harness behavior.
- The capture shows tmux's screen; the font (DejaVu Sans Mono) and the screen color (#2b2b2b) are the harness's, not the person's terminal. Colors are rounded to the 256 palette only if TMUX reaches the child; the harness prevents that.
- The scratch path `/tmp/mos-face-shots-XXXX/work` shows on screen in the Claude Code header. It holds no home path. Plan 10 still greps every `.txt` and `.ansi` file (T-380-09).
- After `kill-session`, claude needs about 1.5 seconds to leave. The CLI waits that long before it removes the scratch folders; without the wait four scratch folders stayed behind.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-380-07 (trust dialog): pointer-first code and test P5; the live dialog did not appear, so the live path is UNVERIFIED. T-380-08 (no prompt): allow-list enforced inside the session wrapper (`keysLit` and `keyName` throw on anything else), test P4; a live refusal was seen and cleared. T-380-09 (disclosure): scratch HOME, scratch cwd, scrub of the home path. T-380-10 (server outlives run): private socket named by pid and scenario, killed in `finally`; no leftover tmux server or scratch folder remained after the final run (checked with `ls /tmp`).

## Self-Check: PASSED

- Files exist in the release tree: `ui/mos-face/scripts/capture-shots.cjs`, `ui/mos-face/scripts/lib/ansi-page.cjs`, `ui/mos-face/scripts/lib/tmux-session.cjs`, `tests/test-380-shots-harness.cjs` (checked by running them).
- Commits 053cd80d8 and 6e92d1864 are on `main` in the release tree (`git log` shows both).
- `git status` in the release tree shows no stray file after the run.
