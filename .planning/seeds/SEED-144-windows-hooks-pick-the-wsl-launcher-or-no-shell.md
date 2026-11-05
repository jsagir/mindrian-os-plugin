---
id: SEED-144
title: "Windows hooks pick the WSL launcher or no shell: run-hook.cmd takes the first where-bash hit and exits silently without bash"
status: open
priority: high
filed: 2026-11-05
planted_during: "Phase 383 plan 09 (D-07)"
origin: "the beta.77 QA report (no context, no routing on a Windows laptop) and 383-RESEARCH.md E1, E2"
trigger_when: "the next phase that touches hooks/run-hook.cmd or the Windows hook path, or the plan 383-11 receipt shows a hook kind other than git-bash"
scope: medium
surfaces: [MindrianOS-Plugin]
related: [SEED-142, SEED-117, SEED-013]
promotes_to: "a quick for run-hook.cmd, then a phase for the remaining spawn sites"
---

# SEED-144: Windows hooks pick the WSL launcher or no shell

## As found

Every claim about the QA laptop is reported, not yet reproduced. The QA report says the laptop showed no context and no routing. The code gives two ways that can happen on Windows. Which one the laptop took is open until the plan 383-11 receipt.

hooks/run-hook.cmd runs the bash hooks in this order. Line numbers were read on 2026-11-05.

| Step | File and line | Mark |
|------|---------------|------|
| Try `C:\Program Files\Git\bin\bash.exe`, then `C:\Program Files (x86)\Git\bin\bash.exe`. | hooks/run-hook.cmd lines 32 to 44 | PROVEN (code read) |
| Else run `where bash` and use the first hit. The wrapper never looks at what that hit is. | hooks/run-hook.cmd lines 46 to 52 | PROVEN (code read) |
| Else exit 0 with no message. The bash hooks do nothing and nothing says so. | hooks/run-hook.cmd lines 54 to 56 | PROVEN (code read) |
| The node hooks do not use this wrapper path and still run. | hooks/hooks.json | PROVEN (code read) |
| On the QA laptop, the first `where bash` hit is the WSL launcher, or there is no bash. | the QA report | reported, not yet reproduced |

Two bad outcomes follow. With no Git Bash in a standard place and a WSL launcher on PATH, line 46 hands the hook to the WSL launcher, which runs it in the wrong world (Linux paths, no Windows environment variables). With no bash at all, the wrapper exits 0 and the hooks do not run.

## Evidence

From 383-RESEARCH.md, Windows evidence table.

| Id | Observation | Mark |
|----|-------------|------|
| E1 | `cmd /c where bash` lists `C:\Windows\System32\bash.exe`, then the WindowsApps copy. No Git Bash is on PATH, because Git adds only `C:\Program Files\Git\cmd`. | PROVEN on the dev machine's Windows side |
| E2 | Windows Node `spawnSync('bash', ['--version'])` returns status 0 and `GNU bash 5.2.21 (aarch64-unknown-linux-gnu)`. `bash -c 'echo $OSTYPE'` returns `linux-gnu`. A WSL distro is installed there. | PROVEN on the dev machine's Windows side |
| E1 and E2 on the QA laptop | The same PATH order and the same WSL answer. | UNVERIFIED (reported, not yet reproduced) |

The case of a laptop with no WSL distro is still open: the launcher may fail instead of answering.

## Who is hit

The 11 hooks in hooks/hooks.json that run through run-hook.cmd:

1. session-start
2. pre-compact
3. post-compact
4. on-stop
5. write-scope-check
6. post-write
7. intent-classifier
8. on-file-changed
9. on-cwd-changed
10. on-agent-complete
11. on-task-complete

session-start carries the cold-start card and intent-classifier carries the routing text. When both are silent, routing rests on the skill listing and the agent doctrine alone (383-ROUTING-DIAGNOSIS.md, C5).

## Fix directions (not a plan)

1. In the `where bash` branch of hooks/run-hook.cmd, skip any hit under System32 or WindowsApps.
2. Add the `CLAUDE_CODE_GIT_BASH_PATH` and `%LOCALAPPDATA%\Programs\Git\bin\bash.exe` candidates, in the order the Phase 383 resolver uses (resolveRoomRuntime in lib/core/platform.cjs).
3. Print one line on stderr instead of the silent exit, so a missing shell is visible.
4. Give the sibling bash scripts that still call `python3` directly (scripts/resolve-room, scripts/update-icm-index, scripts/on-cwd-changed) the PY resolution that scripts/room-registry now has.
5. Route the registry spawn sites that Phase 383 left on a bare `bash` through spawnRoomRegistry (re-check the line numbers with grep before the work starts):
   - lib/core/room-chooser.cjs line 84 to 89 (an execSync shell string with a JSON-quoted path)
   - lib/core/room-naming-selector.cjs line 244 (execFileSync 'bash')
   - lib/core/room-discard-cascade.cjs line 139 (execFileSync 'bash')
   - scripts/heal-command.cjs line 1201 and line 1211 (two spawnSync 'bash' calls)

   All five sites are PROVEN (code read) on 2026-11-05. 383-RESEARCH.md counted 12 JS sites that spawn room-registry and 49 bash spawns in 33 files by a multi-line scan; Phase 383 routed 7 of the 12 through spawnRoomRegistry.

## Doctor

Phase 383 plan 09 added the `room-runtime` row to `/mos:doctor`. It names the bash and the Python room creation would use, what it tried, and the hook shell kind (git-bash, wsl-launcher, path-bash, none). On Windows it warns when the kind is not git-bash. The row only reports. It fixes nothing.

## Tri-polar

| Surface | Status |
|---------|--------|
| Claude Code CLI on Windows | Affected. The bash hooks run through run-hook.cmd. |
| Claude Desktop | Runs no bash hooks. ASSUMED. |
| Cowork | Runs no bash hooks. ASSUMED. |

## Canon

Part 8 holds. The fix moves no room data and calls no Brain.
