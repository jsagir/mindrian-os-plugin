# 380-LIVE-EVIDENCE: idle cost, opt-out persistence, installed layout (plan 380-10)

Code tree: /home/jsagi/dev/MindrianOS-Plugin-release, main, HEAD d8e135577 (plans 16, 17, 18 in). Subject for all runs: a byte copy of lib/mos-face/dist (24 files, all sha256 equal to dist/manifest.json) in the shipped layout, plugin name mos. Every session ran with a scratch HOME and a scratch CLAUDE_CONFIG_DIR; the login file was reached only by a symlink. Home paths are replaced by HOME.

## Part A: opt-out persistence (MOS_FACE_WORDS), three separate processes

Command shape: `claude --plugin-dir SUBJECT -p "/mos-words"`, no model call, run 1 and run 2 with no variable, run 3 with MOS_FACE_WORDS=off. Raw output (PROVEN, ran it):

```
--- run 1: /mos-words (turns the excerpt off) (env: none) exit=0 2.1 s
mos: Theo now gets only a framework name and a problem type. This lasts until this session ends. A new session starts with the excerpt on, unless MOS_FACE_WORDS=off is set in the settings environment.
--- run 2: /mos-words in a new process (does the off state survive?) (env: none) exit=0 3.4 s
mos: Theo now gets only a framework name and a problem type. This lasts until this session ends. A new session starts with the excerpt on, unless MOS_FACE_WORDS=off is set in the settings environment.
--- run 3: /mos-words with MOS_FACE_WORDS=off set (env: MOS_FACE_WORDS=off) exit=0 3.5 s
mos: Theo now also gets a short excerpt of your own recent words, with links, emails, paths, code, key-like strings and names removed. Never the assistant, never the room. Run /mos-words to stop. This lasts until this session ends. A new session starts with the excerpt on, unless MOS_FACE_WORDS=off is set in the settings environment.
```

Reading (PROVEN): the off state does NOT survive a new process (run 2 prints the same handles-only text as run 1, so run 2 started with the excerpt on and turned it off again). With MOS_FACE_WORDS=off the session starts with the excerpt off, so the toggle in run 3 turns it on: the environment switch is read at session start. This matches plan 04 and the owner ruling (the opt-out lasts for the session; the lasting form is the environment variable, which the text itself names). PREFERENCE: the text names an environment variable, which is stack language for a person (D-04).

## Part B: idle CPU window (MOD380-05 measurement): ENV GAP

Method: an interactive claude session in a private tmux server (120x40, scratch config), no prompt ever typed. After the first draw: wait 30 s, read the summed utime, stime, cutime and cstime of the pane process tree from /proc (clock ticks, CLK_TCK = 100), wait 150 s (one 120 s poll tick), read again, kill only my own tmux session. Limit: panel minus baseline under 3.0 s. The baseline folder holds a plugin.json only.

Raw lines (cpu.log, scratch script cpu.cjs):

```
{"label":"panel-1","plugin":"subject","panelTextSeen":false,"procsAtStart":2,"procsAtEnd":2,"names":"bash,claude","ticksStart":1095,"ticksEnd":1190,"cpuSeconds":0.95,"windowSeconds":150.1,"loadStart":"0.76 1.76 3.19","loadEnd":"0.08 1.08 2.72"}
{"label":"baseline-1","plugin":"baseline","panelTextSeen":false,"procsAtStart":2,"procsAtEnd":2,"names":"bash,claude","ticksStart":980,"ticksEnd":1066,"cpuSeconds":0.86,"windowSeconds":150.1,"loadStart":"0.04 0.96 2.61","loadEnd":"5.05 1.79 2.62"}
{"label":"panel-2","plugin":"subject","panelTextSeen":false,"procsAtStart":2,"procsAtEnd":2,"names":"bash,claude","ticksStart":1716,"ticksEnd":1858,"cpuSeconds":1.42,"windowSeconds":150.1,"loadStart":"8.98 3.14 3.05","loadEnd":"10.69 6.37 4.30"}
{"label":"baseline-2","plugin":"baseline","panelTextSeen":false,"panelDrawnAtEnd":false,"procsAtStart":2,"procsAtEnd":2,"names":"bash,claude","ticksStart":1256,"ticksEnd":1371,"cpuSeconds":1.15,"windowSeconds":150.1,"loadStart":"11.74 7.12 4.63","loadEnd":"11.86 9.01 5.72"}
```

Numbers (PROVEN for what ran): panel-1 0.95 s, baseline-1 0.86 s, difference +0.09 s (both pairs-1 windows started at load average 0.76 and 0.04). panel-2 1.42 s, baseline-2 1.15 s, difference +0.27 s (load average 8.98 to 11.86 during these two, above the limit of 6). Mean of the four: panel 1.19 s, baseline 1.01 s, difference +0.18 s. All differences are far under the 3.0 s limit.

Why this is an ENV GAP and not a pass:
- The second pair ran while a peer process (a gsd tool of plugin beta.69, one node process at about 1100 percent CPU, not mine, not killed) held the machine at load average 9 to 14. The rule is load at most 6.
- I waited and retried once (two waits of about 10 minutes each, then a third check): the load average stayed at 11.6 to 14.0 (last read 11.59 11.84 10.69, peer node process 30 minutes old). The window could not be repeated under 6.
- The script recorded the first screen only. It did not record that the panel band was on screen at the end of the panel windows (the field panelDrawnAtEnd was added after panel-1 and panel-2 had started). In the same subject the band always drew within 6 s in the capture runs, but for these two windows that is UNVERIFIED.
- Result: the MOD380-05 idle cost is INDICATIVE only: +0.09 s (valid load) and +0.27 s (invalid load), far below 3.0 s. Not a verified pass. Open item for the main session: repeat the 4 windows when the load average is under 6 (command: `bash scratchpad s10/runcpu.sh`, about 14 minutes) and keep the end screen.

## Part C: installed layout, real engine, and what was not touched

- Installed layout (PROVEN): `npm pack --ignore-scripts` of the release tree gave mindrian_os-cli-2.0.0-beta.74.tgz (13.7 MB); extracted into a layout folder named .../mos/2.0.0-beta.74 under a scratch HOME; `npm ci --ignore-scripts --no-audit --no-fund` added 137 packages in 11 s; claude --plugin-dir on that folder, scratch config, MINDRIAN_BRAIN_URL set to http://127.0.0.1:9 (dead on purpose, Canon Part 8), a settings file that sets the status line to scripts/context-monitor of the layout. Captured: screens/installed/wide.png (docked dashboard) and screens/installed/band.png. They show the full plugin loading with the panel beside the plugin status line (N4): the panel read the room through the plugin tools (real engine path) and printed "WRITES TO nothing - this session is not bound", "ROOM demo-room, Discovery stage" and a NOW line about room identity; the plugin status line under the prompt reads "MindrianOS ... Next: map unknowns ... v2.0.0-beta.74". No UNVERIFIED.txt is needed. The capture used the scratch config, not --config real (rule: no write into the real home), so the person's own plugins and theme are not shown.
- Real engine commands that ran with no model call (PROVEN): /mos-state, /mos-tree (bare, next, find, open, up, clear), /mos-advice (with a local stub tool), /mos-words (Part A). A model was never called and no prompt was typed. The only strings typed were registered commands, after reading the prompt line.
- No real room was read: HOME and the rooms home were scratch folders, with one fixture room demo-room of 18 sections (a section with 2000 files and one with 16 files).
- Sessions wrote their own normal session files, inside the scratch config folders (removed after each run). `ls -ld ~/.claude/projects` still shows the modification time 2026-10-23 21:03:35, before this plan; no folder of this plan appears there. The login file's modification time (2026-10-24 01:55:22) did not change across the later runs. A peer session may refresh it; my runs only read it through symlinks (RISK, as in plan 09).
- The face sheet (faces.png) ran `claude plugin test` in ui/mos-face with scratch HOME and CLAUDE_CONFIG_DIR.
- Playwright: PLAYWRIGHT_BROWSERS_PATH pointed at the real browser cache, read only.
- Windows: UNVERIFIED. This machine cannot test it; plan 11 carries the human Windows check (python3 absent on default Windows; the 120 s poll).
- Banned word hits and their classification: 380-SCREENSHOTS.md, section "Banned word and dash hits" (all Larry hits are the quoted chat chip).
- Desktop and Cowork are not captured: a deliberate skip (N7).
- Not diagnosed: in the scratch captures the panel's NOW reads "Theo is not answering its health check" while the status line fixture says the brain is ok; the panel runs its own probe. Cause UNVERIFIED (no network access to the probe targets, python3, or the loopback brain variable). Listed as gap 13 in 380-SCREENSHOTS.md.
