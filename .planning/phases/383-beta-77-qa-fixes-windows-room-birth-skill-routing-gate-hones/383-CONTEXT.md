# Phase 383 - Context

**Phase:** 383 - Beta.77 QA fixes: Windows room birth, skill routing, gate honesty, voice
**Gathered:** 2026-11-05 (from the owner's beta.77 QA report as given in the phase request; the report text itself is not in the repo)
**Status:** Ready for planning. No finding is reproduced yet.
**Depends on:** Phase 381 (done)
**PRD:** 383-PRD.md in this directory

## Phase Boundary

Fix ten findings from one QA pass on beta.77, worst first. One is a Windows blocker (room creation). Three are about gates (card timing, missing card, write without a card). Two are about skill routing and the memory calls. Four are about how Larry sounds. The PRD carries the table with a "done when" per finding.

Out of scope: the speed pass (Phase 382, another branch), removing Python (SEED-013), any version bump or release cut, new methodology.

## Evidence mark

Every finding is **reported, not yet reproduced**. The code facts below are a separate thing: they were read from the files at HEAD `67466f27e` (v2.0.0-beta.78 pre-release) on 2026-11-05. A code fact says what the code does. It does not say that the owner's failure happens for that reason.

## What the code read shows

| Fact | Where | Mark |
|------|-------|------|
| `room-birth.cjs` is at `lib/core/navigation/room-birth.cjs`, not `lib/core/room-birth.cjs`. The phase request's file name was short of its folder. | the file tree | code read |
| Line 1439 runs `execFileSync('bash', [registryScript, roomsHome, 'create', slug, roomDir, vname, vstage])`. Line 1447 runs the same call with `update <slug> parent <parent>`. | `lib/core/navigation/room-birth.cjs` | code read |
| Line 240 runs `execFileSync('bash', [registryScript, absRoomsHome, 'create', ...])` with a 5000 ms timeout. | `lib/core/room-auto-create.cjs` | code read |
| Line 446 runs `execFileSync('bash', [<scripts/room-registry>, roomsHome, 'create', ...])` with a 20000 ms timeout. | `lib/core/graph-backfill.cjs` | code read |
| All four pass a path built with `path.join` as a bash argument. On Windows that is a backslash path. | the four sites | code read; the effect on Windows is reported, not yet reproduced (SEED-142) |
| A single-line grep finds at least 60 places that spawn `bash` from `lib`, `bin`, `hooks` and `scripts`. Multi-line calls, such as `graph-backfill.cjs` 446, are not in that count. The real number is higher. | grep, 2026-11-05 | code read |
| `lib/core/platform.cjs` already probes `python3` and treats the Microsoft Store stub as absent (`where python3` matched against `WindowsApps\python3.exe`). It probes `bash` with `bash --version` and accepts exit 0. | `lib/core/platform.cjs` lines 55 to 85 | code read |
| `scripts/room-registry` calls `python3` at many sites and guards only a missing `python3` (exit 127). It does not probe `python` or `py`. | SEED-142 evidence table | code read, from the seed |

## Hypotheses to test, not facts

These are leads for the planner. None is proven.

1. `bash --version` may exit 0 against the WSL launcher when WSL has no distro, or may fail. If the launcher answers, `hasBashNative` reads true while the call then runs in the wrong world (Linux paths, no Windows PATH). Wave 1 tests this with a stub `bash` on a faked PATH, then confirms on the Windows machine.
2. `where python3` lists every match. The current check sets `hasPython3` false if any match is the Store stub, even when a real `python3` sits later on PATH. Wave 1 checks the order.
3. For QA383-02 and QA383-03, the report's own guess: commands do not fire when no room exists. On the test laptop no room was ever made (QA383-01), so this fits. It is not verified. Wave 2 tests routing with a room and without one, so the answer does not rest on the guess.
4. A second candidate for QA383-03: in the session that opened this phase, the `mindrian-os` and `mindrian-brain` MCP servers both reported `CONNECTION_CLOSED`, so `context_assemble` and `memory_event` could not be called. That was seen in this session, not in the owner's QA session. Wave 2 must check the owner's session before it uses this.
5. The roadmap command named in the report is `/mos:scientific-roadmap` (`commands/scientific-roadmap.md`, "Use when you can say what must be delivered but not how"). The exact trigger sentence "I know what I want, I need the how" is not a literal string in the repo (grep over `commands`, `skills`, `agents`, `references` and `lib/core` found none), so the match is by meaning. Wave 2 asks how a meaning match is supposed to reach a command, and where it stops.

## Implementation decisions (proposed, not yet locked)

- **One resolver, not a patch per call site.** Extend `lib/core/platform.cjs` with a function that returns the shell and the interpreter that actually run, and the reason when none does. The four call sites and `scripts/room-registry` use it. Reuse before build, Canon Part 7. The planner searches `lib/core/platform.cjs` and the other Windows debug notes first.
- **Probe by running, not by name.** A candidate counts only if it runs and prints a version. The Store stub and a WSL launcher with no distro both fail that test.
- **No backslash paths into bash.** Pass the registry path as a forward-slash path, or set `cwd` to the script folder and pass the path in an environment variable (SEED-142 directions 1 and 2).
- **Name what was tried.** The failure message lists each candidate it tried and the result. That serves SEED-117 (verbatim line kept) and the beginner (plain words on top).
- **The preview check is the same resolver.** `room_create` preview calls it before it renders the F.0 card (QA383-04). One check, two places.
- **Diagnosis before fix in Wave 2.** Write the cause with evidence first. If the cause is a disconnected MCP server, the fix is an honest first-turn message, not a routing change.
- **Doctor point.** Add a doctor point that names the shell and interpreter found and their versions (SEED-142 direction 4).

## SEED-117 rules (binding for every wave)

On a room create or switch failure: report the failure line verbatim, file a bug seed with the version and machine, stop. Never write the registry by hand. Never create the folders or scaffold files by hand. Never initialise `room.db` outside the birth chokepoint. A failed registry call must leave no half-made room. Test the Windows fix on a copy of the rooms home, never on the owner's real rooms.

## Sequencing and shared-tree rules (binding for the executor)

- Work from `/home/jsagi/dev/MindrianOS-Plugin-release` (a worktree of the dev repo). `pwd` first, then `git fetch origin main` and compare ahead and behind.
- Phase 382 is on another branch. Do not create a 382 directory, and do not renumber 383.
- Commit with `git add -f <paths>` and `git commit --only <paths>`. `.planning/` is gitignored. Do not push.
- This host is WSL on Windows. WSL is not the failing environment. A Windows-native reproduction needs the owner's machine. Say so in every Wave 1 result.
- Wave 4 is a human checkpoint. Do not mark QA383-01, SEED-142 or the phase done without the signed receipt.

## Read before planning Wave 1

- `.planning/seeds/SEED-142-windows-room-switch-python-not-on-path-and-backslash-paths-dropped-by-bash.md`
- `.planning/debug/windows-posix-shell-assumption-installer-statusline.md`
- `.planning/debug/windows-installer-spawn-shell-false.md`
- `.planning/debug/windows-build-brain-python-qa.md`
- `.planning/debug/windows-install-and-field-qa-sweep-2026-08-10.md`
- `lib/core/platform.cjs`, `lib/core/room-open.cjs`, `scripts/room-registry`

## Dev-research compositing

This phase is bug and behaviour fixing, not a change to MindrianOS's own architecture, so the Rethinking Room mirror is not required now. If Wave 2 finds a routing or gate-design cause, file the finding in `rethinking-mindrianos/research/` as well and cross-link it here.

## Research findings that change the plan (383-RESEARCH.md, 2026-11-05)

- The Windows mechanism is reproduced on this host's Windows side (Windows `node.exe` through WSL interop; not the QA laptop): `bash` resolves to `C:\Windows\System32\bash.exe` (the WSL launcher), exits 0 on `--version`, reports `$OSTYPE=linux-gnu`, and drops the backslashes of a path argument. `python3` exits 9009 (Store stub); `python` and `py -3` work. Git Bash handles backslash arguments and `room-registry create` exits 0 under it.
- A defect on ALL platforms: `scripts/room-registry` line 432 runs `mkdir -p "${ROOMS_HOME}/${RPATH}"` and lines 438 to 447 seed `ROOM.md`, `STATE.md`, `USER.md` and `.mindrian` there. `birthRoom` passes an absolute RPATH, so every birth leaves a doubled-path junk tree. The owner's real rooms home holds 8 such entries under `~/MindrianRooms/home/jsagi/MindrianRooms/` and a `C:\Users\jsagi\MindrianRooms\C:` entry. Read with `ls` only; nothing was changed. This is the strongest candidate for QA383-10.
- Routing with no room is suppressed by design: `scripts/session-start` lines 799 and 808 make "Mode 1 (Just Talk)" the default and say "No methodology routing ... Do NOT suggest /mos:new-project unprompted"; `scripts/intent-classifier.cjs:3702` runs `decide()` only `if (roomDir)`. `data/command-registry.json` has no `scientific-roadmap` entry. A third candidate: the host drops skill descriptions when the listing is over budget (227 entries, 17,056 description characters listed).
- No shared resolver exists. `detectPlatform()` has one runtime caller (`scripts/banner`). P0 create-and-switch sites: 4 (`room-birth.cjs` 1439 and 1447, `room-identity.cjs` 562, `room-open.cjs` 160). JS sites that spawn room-registry: 12. Bash spawns overall: 49 sites in 33 files.
- The F.0 card is minted inside `mintCard` (`lib/mcp/startup-operations.cjs:48`); the environment check belongs between line 46 and line 48, re-checked before `birthRoom` (line 60) and inside `birthRoom` before line 1102.
- The doctrine itself tells Larry to show the raw failure line (`agents/larry-extended.md:147`, `commands/rooms.md:246` and `:314`).

## Decisions locked for planning (2026-11-05, taken under the owner's end-to-end autonomy grant; the owner may veto any of them at the Wave 4 checkpoint)

- **D-01 room-auto-create stays gateless by design** (Canon Part 10 sub-claim 3) but obeys the new runtime guard: when no working shell or interpreter resolves, it skips quietly and leaves no half-made room. QA383-10's "done when" narrows to the gated paths (`room_create` preview and `/mos:new-project` through `birthRoom`): no write before approve, plus the absolute-RPATH junk tree removed at the source.
- **D-02 Existing junk trees are not deleted by hand.** A named doctor repair lists the doubled-path trees under the rooms home and removes them only after an F.0 gate the owner answers. This phase ships the repair and the listing; the deletion runs when the owner approves it on the real machine (Wave 4). SEED-117 holds.
- **D-03 The resolver is a lazy `resolveRoomRuntime()` in `lib/core/platform.cjs`**, never inside `detectPlatform()` (which runs on the banner path at every session start). It honors `MINDRIAN_PYTHON` (precedent `scripts/doctor.cjs:4357`) and a new `MINDRIAN_BASH` override, probes by running (`--version` plus an `$OSTYPE` or `uname -s` check that rejects `linux-gnu` from a System32/WindowsApps path), returns `{ bash, python, tried[] }` with forward-slash paths, and is the single helper the 4 P0 sites and `scripts/room-registry` use. Reuse before build: extend the file, add no second module.
- **D-04 QA383-08 without the full report:** run `findUnsourcedNumber` (lib/hmi/larry-reply-checks.cjs) over the static Larry-authored strings (card copy, startup text, the Larry lines in commands/*.md and agents/*.md) and fix what it finds. The specific number from the QA session is requested at the Wave 4 checkpoint and added as a test leg when named.
- **D-05 Raw error versus SEED-117:** the user sees the three-line plain shape from `skills/ui-system/SKILL.md` section 7 (what failed, why, fix); the verbatim line stays in stderr, the log and the bug seed. Both doctrine lines (`larry-extended.md:147`, `rooms.md:246/:314`) change to plain-first, verbatim-filed.
- **D-06 Wave 4 scope:** CLI on the owner's Windows machine is the required leg. Desktop and Cowork rows stay UNVERIFIED unless the owner also runs them; a Desktop run is recorded with `node scripts/real-room-run.cjs --desktop-verified win`.
- **D-07 Hooks on Windows without Git Bash** (`hooks/run-hook.cmd:54` exits 0 silently; its `where bash` branch picks the WSL launcher): out of scope for the fixes here, in scope for a doctor point that names the shell the hooks would use, and a seed for the hook-side fix.
- **D-08 Concurrent session:** Phase 384 (measured plugin speed pass) was added on this branch by another session while 383 was being researched. Executors touch only 383's files and the code paths named here; never edit a 384 file; commit with `--only`.

## Open questions

Still owed by the owner: the full QA report text (for the exact unsourced number, QA383-08), and whether Desktop and Cowork get a Wave 4 run (D-06 default: CLI only).
