---
phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
plan: 03
subsystem: infra
tags: [windows, room-registry, resolver, git-bash, python, wsl, store-stub]

requires:
  - phase: 383-beta-77-qa-fixes-windows-room-birth-skill-routing-gate-hones
    provides: plan 01 RED tests for the resolver, the registry interpreter and the absolute RPATH
provides:
  - resolveRoomRuntime, toBashPath, spawnRoomRegistry, formatTried and the three PLAIN_* texts in lib/core/platform.cjs
  - CLI node lib/core/platform.cjs room-runtime [--json]
  - scripts/room-registry that resolves Python by running it and writes no doubled-path tree
affects: [383-04, 383-06, 383-09, 383-10, 383-11]

tech-stack:
  added: []
  patterns:
    - "Probe a candidate by running it; reject the WSL launcher by path and by OSTYPE; reject the Store stub by exit 9009 or text"
    - "Lazy runtime resolver, cached only for an ok default call, cleared by __resetForTests"
    - "Bash resolves the interpreter into PY once at the top; every call site uses the quoted variable"

key-files:
  created: []
  modified:
    - lib/core/platform.cjs
    - scripts/room-registry
    - lib/core/navigation/room-birth.cjs

key-decisions:
  - "A drive-letter RPATH (C:/ or C:\\) is refused with exit 1 before any write when OSTYPE is not msys or cygwin. Reason: on Linux it is a relative path and built a folder named C: (test A4 checks the home and the cwd)."
  - "The RPATH classification sits before ensure_registry, not only before mkdir, so a refused create leaves no registry file either (SEED-117)."
  - "py -3 is shown in tried as 'py -3'; python.cmd stays 'py' and python.pre is ['-3'] as the contract says."

patterns-established:
  - "Exit note is 'room-registry: exited N; python is <version line> (<PY>)'. The room-birth cause-line filter accepts python3? so both spellings are skipped."

requirements-completed: [QA383-01, QA383-10]

duration: not timed (start not recorded)
completed: 2026-11-05
---

# Phase 383 Plan 03: Room runtime resolver and registry interpreter Summary

**One shared resolver in lib/core/platform.cjs finds a real Git Bash and a real Python 3.9 or newer (rejecting the WSL launcher and the Microsoft Store stub), and scripts/room-registry now resolves its Python by running it and no longer builds a doubled-path tree for an absolute RPATH.**

## Accomplishments

- `resolveRoomRuntime` follows the 383-01 contract: win32 bash order MINDRIAN_BASH, CLAUDE_CODE_GIT_BASH_PATH, the four Git install paths, then `where bash`; System32 and WindowsApps rejected by path with no spawn; OSTYPE must start with msys or cygwin on win32; Python candidates MINDRIAN_PYTHON, python3, python, `py -3`; floor 3.9; `sys.executable` probe on win32 only. Only an ok default call is cached.
- `detectPlatform()` is byte-unchanged (the diff shows insertions only, none between `function detectPlatform` and `function readPluginJson`) and never calls the resolver.
- `spawnRoomRegistry` spawns nothing when the runtime is not ready (reason `environment_not_ready`, with `plain` and `tried`). Otherwise it spawns the resolved Git Bash with an argv array and no `shell` key.
- `scripts/room-registry`: `_rr_py_try` and `_rr_py_pick` build `_RR_PY_TRIED`; stderr on failure reads `room-registry: no working Python 3.9 or newer found; tried: python3: Microsoft Store stub; python: not found; py -3: not found`; the WSL advice is gone; 13 `"$PY"` call sites.
- The create stanza classifies RPATH first: a POSIX absolute path or a Windows drive path (on msys or cygwin) is the room dir as given, a relative path goes under ROOMS_HOME, a drive path on any other shell is refused. This removes the doubled-path tree (research E9, the leading candidate for QA383-10).
- room-birth `_registryCauseLine` filter regex is now `/^room-registry: exited \d+; python3? is /`.

## Task Commits

1. Task 1: resolver, spawn helper, CLI in platform.cjs - `013f86f18`
2. Task 2: registry PY resolution, absolute RPATH fix, room-birth filter - `229f7bc6d`

## Test results (measured in this run)

| Check | Result |
|-------|--------|
| tests/test-383-runtime-resolver.cjs | exit 0, `PASS: 15 FAIL: 0 PENDING: 0` (R0 to R14) |
| tests/test-383-registry-interpreter.cjs | exit 0, `PASS: 6 FAIL: 0 PENDING: 0` (I1 to I6) |
| tests/test-383-registry-abs-rpath.cjs | exit 0, `PASS: 5 FAIL: 0 PENDING: 0` (A1 to A5) |
| `bash tests/run-all-383.sh` | `Phase 383: PASS=5 FAIL=9 SKIP=0` (was PASS=2 FAIL=12 at the end of Wave 0) |
| tests/test-383-no-write-before-gate.cjs | `PASS: 3 FAIL: 1`: W3 turned green (the RPATH fix); W4 stays RED for plan 04 |

Still RED in run-all-383 (expected, later plans): card-fork, card-second-person, no-room-routing, no-write-before-gate (W4), plain-failure, preview-env-check, sourced-number, spawn-chokepoint, voice-length.

Must-stay-green set, each run after both commits:

| Test | Result |
|------|--------|
| test-platform.cjs | exit 0, all tests passed |
| test-room-birth.cjs | exit 0, 35/35 PASS |
| test-l9o-rooms-python-floor.cjs | exit 0, 18 passed, 0 failed, 0 skipped |
| test-room-registry-windows-path.cjs, -python-interp.cjs, -atomic-replace.cjs | each exit 0 |
| test-room-registry-path-resolution.cjs | exit 0 |
| tests/test-127.2-04-windows-path-and-update-activation.sh | exit 0 |
| test-353-subroom-birth.cjs | exit 0, 38/38 PASS |
| test-rooms-open-actually-switches.cjs | exit 0 |
| test-startup-flows.cjs | exit 0 |
| test-371-startup-ui.cjs | exit 0 |
| test-359-declared-arm.cjs | exit 0, 20 / 20 |
| test-3696-reply-checks.cjs | exit 0, PASS: 143 FAIL: 0 |
| test-369-hook-require-graph.cjs | exit 0, 5 passed, 0 failed |
| test-session-start-banner.cjs | exit 0 |

`tests/test-self-update-platform.cjs` is listed in the plan acceptance list and exits 1 with `19 passed, 5 failed`. The 5 failures are static checks on scripts/self-update (win32 copy branch, rename branch, uname fallback, exec-bash line count, validation gate). I ran the same test on a detached HEAD worktree of the commit before this plan and got the same `19 passed, 5 failed`, so the failures pre-date this plan (PROVEN). Not fixed: out of scope, logged as a deferred item below.

Other checks: `bash -n scripts/room-registry` exit 0; `grep -c "run inside WSL"` prints 0; the bare `python3 -c|-` grep prints 0; no en or em dash in the three edited files; `grep -c "shell:" lib/core/platform.cjs` is 3 at HEAD and 3 now; `node lib/core/platform.cjs room-runtime --json` exits 0 on this Linux host with `"ok": true` (bash `bash`, python `python3`).

## Windows-side proof on this host (WSL interop)

Host: WSL2 with Windows `node.exe` and Git for Windows installed. `cmd.exe` is not on the PATH of this shell, so the Windows temp dir was taken as `C:\Users\jsagi\AppData\Local\Temp` (the directory exists at `/mnt/c/Users/jsagi/AppData/Local/Temp`). I copied `lib/core/platform.cjs` and `scripts/room-registry` to `<TEMP>\mos383` with `cp`, and used `<TEMP>\mos383\rooms` as the home. The owner's real rooms home was not touched. The probe folder was deleted after the run.

Command: `cd /mnt/c/Users/jsagi/AppData/Local/Temp/mos383 && "/mnt/c/Program Files/nodejs/node.exe" probe.cjs`

`resolveRoomRuntime({ refresh: true })` output (PROVEN):

```
ok: true
bash:   { path: "C:/Program Files/Git/bin/bash.exe", ostype: "msys" }
python: { path: "C:/Python313/python.exe", cmd: "python", pre: [], version: "3.13", version_line: "Python 3.13.6" }
tried:  bash   C:\Program Files\Git\bin\bash.exe   ok  (msys)
        python python3                             rejected_store_stub (Microsoft Store stub)
        python python                              ok  (Python 3.13.6)
```

`spawnRoomRegistry([home, 'create', 'probe-383', home + '\\probe-383', 'Probe', 'idea'], { roomsHome: home })`:

```
ok: true, status: 0, reason: null, stderr: ""
out: {"path": "C:/Users/jsagi/AppData/Local/Temp/mos383/rooms/probe-383", "status": "active", "venture_name": "Probe", "venture_stage": "idea", ...}
registry.json present: true
top-level entries of the home: [".rooms","probe-383"]   (no "C:" entry)
ROOM.md present: true
```

A second run set `MINDRIAN_BASH=C:\Windows\System32\bash.exe` (a real WSL launcher on this host): `tried` shows `C:\Windows\System32\bash.exe rejected_wsl` and the resolver moved on to Git Bash (ok). `formatTried` printed `bash: C:/Windows/System32/bash.exe rejected_wsl, C:/Program Files/Git/bin/bash.exe ok; python: python3 rejected_store_stub, python ok`.

Scope of this proof: it covers this host's Windows side only (a WSL distro is installed, Git Bash and a real Python 3.13 are present, python3 is the Store stub). The QA laptop leg (no WSL distro, no real Python) waits for plan 383-11 (PRD Wave 4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A drive-letter RPATH on a non-Windows shell created a folder named C:**
- **Found during:** Task 2, test A4 after the first create-stanza edit
- **Issue:** The plan's case `/*|[A-Za-z]:[\\/]*) ROOMDIR="$RPATH"` made `mkdir -p C:/Users/x/...` create a `C:` folder in the cwd on Linux (the guard treats the path as relative, so it passes).
- **Fix:** In the create stanza a drive path sets ROOMDIR only when `$OSTYPE` starts with `msys` or `cygwin`; on any other shell the script prints a 3-line refusal and exits 1. The classification moved above `ensure_registry`, so a refused create writes nothing at all. `case "$RPATH" in` still comes before the first `mkdir -p` and the stanza still holds the `[A-Za-z]:` pattern (A5).
- **Files modified:** scripts/room-registry
- **Commit:** 229f7bc6d

**2. [Out of scope, noted] The plan said the Windows temp dir comes from `cmd.exe /c 'echo %TEMP%'`.** `cmd.exe` is not on this shell's PATH. I used the known Windows temp path under /mnt/c instead. No effect on the result.

## Deferred Issues

- `tests/test-self-update-platform.cjs` fails 5 of 24 legs at HEAD before and after this plan (static checks on scripts/self-update). Pre-existing; not touched.

## Known Stubs

None.

## Threat Flags

None. No network or Brain call was added. The Part 8 sweep in run-all-383.sh reports `clean: lib/core/platform.cjs` and `clean: scripts/room-registry`. T-383-01, T-383-02 and T-383-03 are mitigated as planned: probe by running, argv arrays with no shell key, absolute RPATH used as given.

## UNVERIFIED

- The QA laptop (no WSL distro, no real Python): waits for plan 383-11.
- Desktop launch PATH: the MCP server will call the same helper once plan 04 lands; the PATH of a Desktop launch was not observed.
- Cowork host: the POSIX branch keeps today's behavior and is tested on Linux only.
- macOS bash 3.2 for the new `_rr_py_try` code: written in 3.2 syntax (no associative arrays, no case modification) but not run on macOS here.

## Self-Check: PASSED

- FOUND: lib/core/platform.cjs, scripts/room-registry, lib/core/navigation/room-birth.cjs
- FOUND commits: 013f86f18, 229f7bc6d
