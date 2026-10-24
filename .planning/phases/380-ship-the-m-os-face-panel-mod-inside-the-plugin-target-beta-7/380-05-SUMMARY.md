---
phase: 380-ship-the-m-os-face-panel-mod-inside-the-plugin-target-beta-7
plan: 05
subsystem: ui-mod-hook-budgets
tags: [mos-face, budgets, back-off, windows, paths, no-subprocess, validate-inventory]
requires: [380-04]
provides:
  - ui/mos-face/hooks/paths.ts (homeDir, roomsHome, mindrianDir, registryRoot, workspaceOf)
  - ui/mos-face/tests/budget.test.ts (B1 to B8, B5b, B7b)
  - tests/test-380-budget.cjs (static gate G1 to G5 on the validate inventory)
  - README section Budgets
affects: [380-06, 380-08, 380-10, 380-11]
key-files:
  created:
    - ui/mos-face/hooks/paths.ts
    - ui/mos-face/tests/budget.test.ts
    - tests/test-380-budget.cjs
  modified:
    - ui/mos-face/hooks/probe.ts
    - ui/mos-face/hooks/source.ts
    - ui/mos-face/hooks/bind.ts
    - ui/mos-face/hooks/register.tsx
    - ui/mos-face/tests/support.ts
    - ui/mos-face/panel.test.tsx
    - ui/mos-face/README.md
requirements-completed: [MOD380-05]
completed: 2026-10-23
---

# Phase 380 Plan 05: Hook budgets (MOD380-05) - Summary

The panel now starts no subprocess, asks Theo and the website on a separate 10 minute clock with a 4 second cut-off, backs its ticks off after a slow read, and finds the home and rooms folders the way the plugin does. Tests and a static gate pin all of it.

Code tree: `/home/jsagi/dev/MindrianOS-Plugin-release`, branch `main`. Nothing was pushed. No branch was created or switched. `git rev-list --count origin/main..main` is 17 (14 earlier plus the 3 below).

## Commits (release tree)

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 428d115ad | test(380-05): RED budget tests and validate inventory gate (MOD380-05) |
| 2 | a9c284ae7 | fix(380-05): no subprocess, slow network clock, read back-off, plugin-matching paths (MOD380-05) |
| 3 | cb5b3d046 | docs(380-05): README budgets section |

## Root cause (PROVEN by reading the source before the patch)

1. `probe.ts` ran `python3 -c <script>` on the room database for the graph numbers. python3 is absent on a default Windows machine (SEED-142). The call ran only on the files fallback, but it was a subprocess in a panel that must never run one.
2. `source.ts` called `probeReach` on every read, so two HTTP fetches left the machine on every 120 second tick. The fetches had no cut-off. A fetch that never answered held the whole read until the 30 second limit.
3. `register.tsx` had no wait after a slow read. A starved machine got a new read on every tick.
4. `bind.ts`, `probe.ts` and the workspace test in `register.tsx` read only HOME, and hard-coded `HOME/MindrianRooms`. A native Windows process may not set HOME, and MINDRIAN_ROOMS_HOME (the plugin's rule) was ignored.

## RED list (commit 428d115ad, PROVEN)

`claude plugin test .`: 54 pass, 7 fail (the 51 earlier tests plus 10 new). Failing: B1 (process ran twice), B3 (10 fetches in one 10 minute window, limit 2), B4 (no cut-off), B5 (reads at 0, 240000, 480000 ... instead of the back-off list), B5b, B7, B7b. Passing in RED, kept as guards: B2 (the prompt path was already I/O free), B6 (the 45 second guard already held), B8 (no timer leak; see below).

`node tests/test-380-budget.cjs` in RED: 7 passed, 4 failed (G1a source scan, probe.ts python, G1 calls line, G3 env reads). G2 (hook list, 23 of 23) and G4, G5 passed in RED, as they guard the future.

## GREEN run (PROVEN)

| Command | Result |
|---------|--------|
| `claude plugin test .` in `ui/mos-face` (via `node tests/test-380-engine-tests.cjs`) | 61 pass, 0 fail (34 original, 3 raster pins, 14 egress, 10 budget) |
| `node tests/test-380-budget.cjs` | 11 passed, 0 failed |
| `node tests/test-380-egress.cjs` | 29 passed, 0 failed |
| `node ui/mos-face/scripts/typecheck.cjs` | exit 0 |
| `bash tests/run-all-380.sh` | `PASSED=7 FAILED=0 SKIPPED=6 KNOWN=0` |
| `grep -n process.run` over hooks/*.ts and register.tsx | no hit (exit 1) |
| `LC_ALL=C /usr/bin/grep -P '\xE2\x80[\x93\x94]'` over all touched files | no hit |

## Mutation runs (PROVEN, scratch copy under the session scratchpad, no git checkout)

Each mutation was made in a copy of `ui/mos-face` and run with `claude plugin test .`:

| Mutation | Failing tests |
|----------|---------------|
| `stopSpin` made empty | B8 |
| back-off guard `started < slowUntil` removed | B5, B5b |
| `REACH_EVERY_MS = 0` | B3 |
| fetch without the 4 second race | B4 (and the file-level hang) |
| `fs.read` added to `turn.start` | B2 |

## Validate inventory (PROVEN, `claude plugin validate --json ui/mos-face`)

Hooks line: the same before and after (23 entries): session.start, 13 command.run, prompt.submit, turn.start, tool.call, turn.complete, 5 ui.render.

Calls line, before (plan time, and again in RED): `... $.http.fetch (via reach), $.process.run (via probe), $.prompt.fill ...`

Calls line, after:

```
./register.tsx calls: $.clock.after, $.clock.every, $.clock.now, $.command.register, $.env.get, $.fs.list (via listSection, probe), $.fs.read (via boundRoom, probe, readJson, staleFromFile), $.http.fetch (via reach), $.prompt.fill (via askAbout), $.prompt.suggest, $.session.cwd (via knownNames, refresh), $.session.id (via boundRoom), $.session.messages (via runAdvice), $.session.usage, $.state.get, $.state.set, $.tool.call (via askTheo, call, searchChapters), $.ui.invalidate, $.ui.open, $.ui.panes, $.ui.resolve, $.ui.status (via pin), $.ui.toast
```

Env reads, before: `HOME, MOS_FACE_WORDS, NO_COLOR`. After:

```
./register.tsx env reads: HOME, MINDRIAN_ROOMS_HOME, MOS_FACE_WORDS, NO_COLOR, USERPROFILE
```

Hooks line, after (unchanged):

```
./register.tsx hooks: session.start, command.run{command=mos-state}, command.run{command=mos-face}, command.run{command=mos-style}, command.run{command=mos-chip}, command.run{command=mos-suggest}, command.run{command=mos-ask}, command.run{command=mos-refresh}, command.run{command=mos-words}, command.run{command=mos-text}, command.run{command=mos-plain}, command.run{command=mos-advice}, command.run{command=mos-auto}, command.run{command=theo-calls}, prompt.submit, turn.start, tool.call, turn.complete, ui.render{component=Pane, requestId=mos-state}, ui.render{component=AbovePrompt}, ui.render{component=PromptHint}, ui.render{component=Pane, requestId=theo-calls}, ui.render{component=AssistantMessage}
```

## What changed

- `hooks/paths.ts` (new): `homeDir` (HOME, then USERPROFILE, empty counts as unset), `roomsHome` (MINDRIAN_ROOMS_HOME first, else home plus /MindrianRooms), `mindrianDir`, `registryRoot`, `workspaceOf`. Forward slashes, no trailing slash. Backslash paths (C:\Users\t) become C:/Users/t.
- `hooks/probe.ts`: the python3 query and its script are deleted. The files fallback sets graph null and adds the note "The graph numbers were not read: they need the room tools, which were out of reach". `reach` races the fetch against `$.clock.after(4000)`; on timeout it returns status null and ms null. The two checks start together (`Promise.all`), so the whole reading ends within 4 seconds. `probe($, far)` takes the far reading from the caller.
- `hooks/source.ts`: a module cache `{at, far, notes}`. A reading younger than 600000 ms is reused, with its notes. `readRoom($, force)` re-asks when forced. `resetReach()` runs at session start. Notes from the reach checks stay after the probe notes, as before, so the first four notes of /mos-text keep their order.
- `hooks/register.tsx`: `slowStreak` and `slowUntil`. A non-forced tick returns while now is before `slowUntil`. After a read, a failed or time-out read, or one over 8000 ms, sets the streak to min(streak + 1, 3) and the wait to min(120000 x 2^streak, 600000). A quick read resets both. `/mos-refresh` and the Refresh button force the read and the reach checks. `/mos-state` forces the read but not the reach checks. The workspace test uses `workspaceOf`.
- `hooks/bind.ts`: reads the registry under `roomsHome`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Engine rules for `$` past an import**
- **Found during:** Task 2 first test run (all hooks failed to load).
- **Issue:** the engine follows `$` past an import only into a function declaration, and `$.env.get` needs a literal name.
- **Fix:** `paths.ts` uses function declarations and writes each variable name as a literal in its own `$.env.get` call. This also lets validate list the five names.
- **Commit:** a9c284ae7

**2. [Rule 1 - Bug in a test premise] Original test "a read that hangs is cut off, shows as stale..." (panel.test.tsx)**
- **Found during:** Task 2.
- **Issue:** the test hung `http.fetch` to make the read hang. By design (MOD380-05), a hung fetch is now cut at 4 seconds, so it can no longer stall the read. The assertions (stale reading, "too long", keyboard routes) are about a read that hangs, and they are still right.
- **Fix:** the test's `world(...)` call gets a `tool` option that also hangs the room tools while `hang.on` is true. No assertion changed. The count stays 34.
- **Commit:** a9c284ae7

**3. [Rule 3 - Blocking] support.ts (plan 04 file) needed three additive options**
- `reads` (record of fs paths, kept apart from `calls` so the egress leak scan never sees a path), `files` (content by path ending), `processThrows`. The tool.call handler became async so a test can delay an answer on the mock clock. No egress test changed and all pass.
- **Commit:** 428d115ad

**4. [Rule 1 - Bug in an earlier doc] README egress section named the wrong plan for the build script**
- Plan 04 wrote that `scripts/build-mos-face.cjs` is added by plan 380-05. Plan 08 adds it. The text now says 380-08. The plan 05 file list holds no build script, so none was written here.
- **Commit:** cb5b3d046

### Test expectation fixes (my own tests, written in Task 1)

- B7: a Windows drive path (C:/Users/t/...) is relative on a Linux engine, so the engine puts its own folder in front. The test checks the end of the path and that no backslash survives.
- B1: lines.ts rewrites the word "graph" to "data room" in notes (the plain-English layer), so the test accepts either word.
- B5b: after the quick read at 360000 the wait resets, so the tick at 480000 also reads. The expected list is [0, 360000, 480000].

## Timer-leak finding

None. B8 passed in RED and in GREEN: the 220 ms spinner stops at turn.complete, and the 400 ms flash timer stops when the flash ends (9000 ms). The mutation run shows B8 is not vacuous. No code was changed for it.

## Decisions

- A registry root of "~/MindrianRooms" (the default) or a missing root follows `roomsHome`, so MINDRIAN_ROOMS_HOME also moves the room paths. Any other leading tilde is the home folder. The plan said "replace it with homeDir"; the default case is the one where the plugin's own rule differs, and plan 10 sets MINDRIAN_ROOMS_HOME.
- The reach cache key is time only, and it resets at session start. A module cache from an earlier test or session never hides the first check.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema. The two fetches keep a constant URL and a host checked by a pattern (N3 still passes). The subprocess path (T-380-18) is gone and pinned by G1.

## Not measured

- The real idle CPU cost of the panel is UNVERIFIED until plan 380-10. The README says so and holds no number.
- The Windows path rule is proven with USERPROFILE and a backslash string on a Linux engine. It is UNVERIFIED on a native Windows machine.

## Self-Check: PASSED

- Files found: `ui/mos-face/hooks/paths.ts`, `ui/mos-face/tests/budget.test.ts`, `tests/test-380-budget.cjs` (release tree).
- Commits found in the release tree: 428d115ad, a9c284ae7, cb5b3d046.
