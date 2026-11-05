# Phase 383: Beta.77 QA fixes (Windows room birth, skill routing, gate honesty, voice) - Research

**Researched:** 2026-11-05
**HEAD read:** `c46714ecc` (v2.0.0-beta.78 pre-release; `node lib/core/repo-version.cjs` -> 2.0.0-beta.78)
**Domain:** Windows process resolution (Node `child_process` -> bash -> Python), MCP room creation gate, Claude Code skill routing, Stop-hook card firing, Larry voice checks
**Confidence:** HIGH for the Windows mechanism (reproduced on a Windows-native Node process, see "Windows evidence"), MEDIUM for routing causes (two code-level causes proven, which one hit the owner's session needs the transcript), MEDIUM-LOW for QA383-07/08 (the verbatim report is not in the repo)

## Summary

The P0 is not a single bug. It is three stacked defects, and two of them were reproduced in this session on the Windows side of this machine (the WSL host's own Windows install, driven through WSL interop with the Windows `node.exe`). (1) A bare `spawnSync('bash', ...)` from Windows Node resolves to `C:\Windows\System32\bash.exe`, the WSL launcher, because Git for Windows only puts `Git\cmd` on PATH, never `Git\bin`. The launcher exits 0 for `bash --version` and runs in Linux (`OSTYPE=linux-gnu`). (2) The WSL launcher re-parses the command line through a Linux shell, so the backslash script path arrives as `C:Usersjsaginonexistent-dirx.sh` (backslashes dropped). (3) `spawnSync('python3')` hits the Microsoft Store stub and exits 9009 ("Python was not found..."), while `python` and `py -3` both work. Git Bash itself handles backslash arguments correctly (a real `room-registry create` under `C:\Program Files\Git\bin\bash.exe` exited 0 with backslash paths).

A fourth defect was found while reproducing, and it is cross-platform and already in the owner's real rooms home: `scripts/room-registry create` runs `mkdir -p "${ROOMS_HOME}/${RPATH}"` and seeds ROOM.md, STATE.md, USER.md and `.mindrian/` there, but `birthRoom` passes an ABSOLUTE `RPATH`. The result is a doubled-path junk tree under the rooms home on every birth. `~/MindrianRooms/home/jsagi/MindrianRooms/` holds 8 such entries on this machine and `C:\Users\jsagi\MindrianRooms\C:` exists on the Windows side. This is the strongest code-backed candidate for QA383-10 ("a folder was created without asking").

For routing (QA383-02/03), the hypothesis "commands do not fire when no room exists" is true by design at two code points: the no-room cold start in `scripts/session-start` instructs Larry "Mode 1 (Just Talk) ... No methodology routing, no filing, no room creation suggestions" and makes Mode 1 the default when the user just starts talking, and the hook-side engine (`decide()`) only runs `if (roomDir)`. A third, room-independent candidate is cited from the Claude Code docs: the skill listing budget drops descriptions of the least-invoked skills when the listing overflows, and this plugin lists at least 227 entries (lower bound 17,056 description characters). Which cause hit the owner's session needs the verbatim transcript.

**Primary recommendation:** Add ONE lazily-called resolver to `lib/core/platform.cjs` (`resolveRoomRuntime()`) that finds a bash that runs in the Windows world (Git Bash, never System32 or WindowsApps) and a Python that runs (python3, python, `py -3`, each probed by running), returns the absolute paths plus a `tried` list, and route the 4 P0 registry spawn sites through one helper that passes forward-slash paths and `MINDRIAN_PYTHON`. Fix the absolute-RPATH `mkdir -p` in `scripts/room-registry` in the same wave, because it writes junk folders on every platform today.

<user_constraints>
## User Constraints (from CONTEXT.md and PRD)

No `## Decisions` / `## Claude's Discretion` / `## Deferred Ideas` headings exist in 383-CONTEXT.md. The binding content is copied here from its "Implementation decisions (proposed, not yet locked)", "SEED-117 rules", "Sequencing and shared-tree rules", and the PRD "Constraints (binding)" and "Out of scope".

### Locked Decisions (binding rules)
- **SEED-117:** on a room create or switch failure, report the failure line verbatim, file the bug, stop. Never hand-build a room. Never write the registry by hand. Never create the folders or scaffold files by hand. Never initialise `room.db` outside the birth chokepoint. A failed registry call leaves no half-made room. Test the Windows fix on a copy of the rooms home, never on the owner's real rooms.
- **Canon Part 8:** no room content goes to the Brain. This phase adds no Brain call.
- **Canon Part 7, reuse before build:** `lib/core/platform.cjs` already probes `python3` (it treats the Store stub as absent) and `bash`. Extend it. Search first, and justify any new module against it.
- **Canon Part 12:** every number Larry states is sourced or absent. Hyphens only, never em-dashes.
- **Tri-Polar:** each fix states its CLI, Desktop and Cowork row. A row that is not tested is marked UNVERIFIED, not assumed.
- **Hooks stay `.cjs`.** Any new core file follows the erasable-only rule if it is `.ts`.
- **Release lockstep:** this phase does not bump a version and does not cut a release.
- **Git:** commit with `git add -f` and `git commit --only <paths>` (`.planning/` is gitignored). Do not push. Work from `/home/jsagi/dev/MindrianOS-Plugin-release`. Phase 382 is on another branch: do not create a 382 directory, do not renumber 383.
- **Wave 4 is a human checkpoint.** Do not mark QA383-01, SEED-142 or the phase done without the signed receipt.
- **Evidence mark:** every finding is "reported, not yet reproduced" until a wave reproduces it. Before Wave 1 starts, the verbatim report goes into `383-QA-REPORT-verbatim.md`.

### Proposed implementation decisions (CONTEXT.md, not yet locked; research supports all of them)
- One resolver, not a patch per call site (extend `lib/core/platform.cjs`).
- Probe by running, not by name.
- No backslash paths into bash (forward-slash path, or cwd + env variant).
- Name what was tried in the failure message.
- The preview check is the same resolver (`room_create` preview calls it before the F.0 card).
- Diagnosis before fix in Wave 2.
- Doctor point that names the shell and interpreter found and their versions.

### Deferred / Out of scope
- The speed pass (Phase 382, another branch).
- Removing Python from the user machine (SEED-013).
- Any release cut, version bump or marketplace change.
- New methodology or new commands.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (PRD) | Research Support |
|----|-------------------|------------------|
| QA383-01 | Room creation fails on Windows (WSL launcher, dropped backslashes, Store-stub python3) | Mechanism reproduced on Windows-native Node (Windows evidence E1-E4). Resolver design in Pattern 1. 4 P0 spawn sites listed. room-registry interpreter change in Pattern 2. |
| QA383-02 | No `/mos` command ran in 19 turns | Two proven code causes with no room (session-start Mode 1 text; `if (roomDir)` gate on `decide()`), one cited room-independent cause (skill listing budget). Diagnosis plan in Pattern 5. |
| QA383-03 | No `context_assemble` / `memory_event` | Doctrine says "in a bound room" (agents/larry-extended.md:163); the tool refuses with no room (lib/mcp/tools/context.cjs:120-129). No first-turn "server not connected" notice exists anywhere. On Windows with no Git Bash, `hooks/run-hook.cmd` exits 0 silently, so no session-start context is injected. |
| QA383-04 | Approval card appeared before the machine could do the job | Hook point: `lib/mcp/startup-operations.cjs` between line 46 (`destination`) and line 48 (`mintCard`, which renders the card). Second check before `birthRoom` (line 60) and inside `birthRoom` before line 1102. |
| QA383-05 | Decision card did not appear at a real fork | Stop hook fires only on 3 signals; the numbered-prose arm was retired; a prose fork without the "Your call:" line is `no-gate-signal` by design (scripts/check-card-fire.cjs:578-583). |
| QA383-06 | Raw error with a file path shown to a beginner | The doctrine itself orders the raw line shown (agents/larry-extended.md:147, commands/rooms.md:246 and :314). Reuse the three-line error pattern (skills/ui-system/SKILL.md section 7). room-registry:46 tells Windows users to "run inside WSL", which is wrong for this failure. |
| QA383-07 | Card wording in third person | Static card strings in code are clean (grep: hits only in comments and model-facing tool descriptions). Card labels are model-authored at `gate_render` time. Needs the verbatim report to name the card. |
| QA383-08 | One number without a source | `findUnsourcedNumber` already exists in lib/hmi/larry-reply-checks.cjs. Needs the verbatim report. |
| QA383-09 | Replies of 15 to 25 sentences | Rule exists (voice-dna.md:66, larry-extended.md:41). `countSentences` exists. Shadow Stop hook `scripts/check-voice-style.cjs` has no length policy yet. |
| QA383-10 | Folder created without asking | Proven: room-registry `create` writes a doubled-path tree under the rooms home (scripts/room-registry:432, :438-439) on every birth; 8 junk entries in the owner's real rooms home. Other ungated writers listed in Pitfall 6. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Work only in the dev workspace (this worktree), never `~/.claude/plugins/*`. Read the version with `node lib/core/repo-version.cjs`.
- Canon Part 7: search commands/agents/pipelines/skills before net-new surface. Part 8: LOCAL never egresses. Part 11: any new invocable surface is born WIRED or EXCLUDED with a HITL shape (`node scripts/build-connector-registry.cjs --check`). Part 12: no grades, sourced numbers, every Larry turn wears a De Stijl mark.
- Hooks and the MCP server stay `.cjs`. A `lib/core` `.ts` file is allowed only if erasable-only and not reachable from a hook; `platform.cjs` is reached by `scripts/banner`, so keep the new code in `.cjs`.
- CLI argv parsing uses a switch-case router; bash scripts in `scripts/` stay authoritative; CJS wraps them.
- No em-dashes anywhere. Feynman-simplified prose.
- QA/RCA findings use `docs/RCA-TEMPLATE.md` in `.planning/debug/<slug>.md` (kind rca or qa-sweep), classified WORKING / known bug / ENV GAP / NEW FAILURE.
- Verification after edits: `bash tests/run-all-<phase>.sh`, `node scripts/build-connector-registry.cjs --check`, `node scripts/build-orchestration-projection.cjs --check`, `node scripts/check-render-coverage.cjs`, `node scripts/doctor.cjs --acceptance`.
- GSD workflow enforcement: edits run inside a GSD command.
- Grounding sources: Context7 for library behavior, claude-code-guide/WebFetch for Claude Code behavior (used here), icm-architect for room structure.

## Windows evidence (this session)

These probes ran on the Windows side of this machine through WSL interop: `"/mnt/c/Program Files/nodejs/node.exe" <probe>.js`, cwd `C:\Users\jsagi`, probe files in `%TEMP%\mos383` (deleted after). This is the owner's dev machine, NOT the QA laptop. The process environment came through WSL interop (PATH had 57 entries, System32 present, no `Git\bin`), which can differ from a Claude Code or Claude Desktop launch. Mark: PROVEN on this host; UNVERIFIED for the QA laptop.

| # | Probe | Result | Mark |
|---|-------|--------|------|
| E1 | `cmd /c where bash` | `C:\Windows\System32\bash.exe`, then `...\WindowsApps\bash.exe`. No Git Bash on PATH (Git adds only `C:\Program Files\Git\cmd`). | PROVEN (this host) |
| E2 | Windows Node `spawnSync('bash',['--version'])` | status 0, `GNU bash 5.2.21 (aarch64-unknown-linux-gnu)`; `bash -c 'echo $OSTYPE'` -> `linux-gnu` | PROVEN (this host, a WSL distro is installed) |
| E3 | Windows Node `spawnSync('bash',['C:\\Users\\jsagi\\nonexistent-dir\\x.sh'])` | status 127, stderr `/bin/bash: C:Usersjsaginonexistent-dirx.sh: No such file or directory` | PROVEN: the backslash loss is the WSL launcher, not Git Bash |
| E4 | Windows Node `spawnSync('python3',['--version'])` | status 9009, `Python was not found; run without arguments to install from the Microsoft Store...` although `where python3` lists a `python3.cmd` shim first (Node does not run `.cmd` without a shell) | PROVEN (matches SEED-142 exit 9009) |
| E5 | `python --version`; `py -3 -c "import sys;print(sys.executable)"` | `Python 3.13.6`; `C:\Python313\python.exe` | PROVEN |
| E6 | `detectPlatform()` from a copy of `lib/core/platform.cjs` under Windows Node | `{"os":"win32","hasPython3":false,"hasBashNative":true,"codePage":437,"supportsUtf8":false}` | PROVEN: `hasBashNative` is true for the WSL launcher |
| E7 | `"C:\Program Files\Git\bin\bash.exe" -c 'echo $OSTYPE; uname -s'` | `msys`, `MINGW64_NT-10.0-26200-ARM64` | PROVEN |
| E8 | Git Bash runs a copy of `scripts/room-registry` with backslash args: `<home> create probe-room <abs dir> Probe Pre-Opportunity` in a temp rooms home | exit 0, registry written, `list` with forward-slash args also exit 0. A stray directory named `C:` appeared inside the temp rooms home. | PROVEN: Git Bash keeps backslashes; the `C:` dir is the RPATH defect (E9) |
| E9 | Linux, temp HOME: `room-registry <home> create probe <abs path>` | exit 0, plus a junk tree `<home>/tmp/.../rooms/probe/{ROOM.md,STATE.md,USER.md,.mindrian}` | PROVEN on Linux |
| E10 | Read-only `ls` of the real rooms homes | `~/MindrianRooms/home/jsagi/MindrianRooms/` has 8 entries (aion-eureka-synergy, air-temp-map, axiom, ...); `C:\Users\jsagi\MindrianRooms\C:` exists | PROVEN (read only, nothing touched) |

What only the QA laptop (Wave 4) can prove: the result of `System32\bash.exe --version` when WSL has NO distro (exit code and output), the PATH order under a native Claude Code CLI launch and under Claude Desktop, whether Claude Code exports `CLAUDE_CODE_GIT_BASH_PATH` or prepends `Git\bin` for its child processes, and the end-to-end room create receipt.

## Hypotheses verdicts

| # | Hypothesis (383-CONTEXT.md) | Verdict | Deciding file:line and evidence |
|---|-----------------------------|---------|----------------------------------|
| 1 | `bash --version` may exit 0 against the WSL launcher, so `hasBashNative` reads true while the call runs in the wrong world | **PROVEN for a host with a WSL distro installed; STILL OPEN for the no-distro case** | `lib/core/platform.cjs:79-85` accepts any exit 0. E2 and E6 above. Microsoft docs: a command after `wsl` "is handled like any command run in WSL. Things such as sudo, piping, and file redirection work" and "File paths must be specified in the WSL format" [CITED: learn.microsoft.com/en-us/windows/wsl/filesystems]. Env vars do not cross into WSL unless listed in `WSLENV` [CITED: same page], so `MINDRIAN_ROOMS_HOME` is lost too. A forward-slash conversion does NOT fix the WSL case (`C:/x` is not a WSL path); the resolver must reject the WSL launcher. |
| 2 | `where python3` any-match sets `hasPython3` false even when a real python3 sits earlier | **PROVEN as a code fact, but NOT a cause of the failure** | `lib/core/platform.cjs:66-67` tests the whole `where` stdout. `detectPlatform().hasPython3` has no runtime consumer: grep finds `detectPlatform` used only by `scripts/banner:33` (for `supportsUtf8`) and `openBrowser`. The live gate is `scripts/room-registry:45` (`command -v python3`), which a Store stub or a shim passes by name. E4 shows Node itself fails on the stub. |
| 3 | Commands do not fire when no room exists | **PROVEN by design at code level; whether it is what happened in the owner's session is STILL OPEN** | `scripts/session-start:799` (no room -> mode card, "default to Just Talk if the navigator starts talking") and `:808` ("Mode 1 (Just Talk): ... No methodology routing, no filing, no room creation suggestions unless the user explicitly asks. ... Do NOT suggest /mos:new-project unprompted"). `scripts/intent-classifier.cjs:3702` runs `emitEngineDecisionBlock` (the `decide()` path) only `if (roomDir)`; `main()` returns 0 at :597 (no rooms root) and :679 (empty room corpus). |
| 4 | MCP servers disconnected, so `context_assemble` / `memory_event` could not be called | **STILL OPEN for the owner's session; design fact PROVEN** | `agents/larry-extended.md:163` "run `context_assemble` at turn start in a bound room". `lib/mcp/tools/context.cjs:120-129` refuses with `no_room_db` when no room. So zero calls with no room is the doctrine, not a separate bug. No code anywhere emits a first-turn "server not connected" notice (grep `setup issue`, `mcp_unreachable`, `not connected` over scripts/lib/hooks: no hit). |
| 5 | The roadmap trigger is matched by meaning, not by a literal | **PROVEN** | No literal "I know what I want, I need the how" (CONTEXT grep). No command trigger table: `data/command-registry.json` has no `scientific-roadmap` entry (node read returned undefined); `SENSOR_REGISTRY` holds reach sensors, not commands. A meaning match reaches a command only through Claude Code's skill listing: commands are merged into skills, the description is "always in context", and Claude invokes it unless `disable-model-invocation: true` [CITED: code.claude.com/docs/en/skills]. `commands/scientific-roadmap.md` has no `disable-model-invocation` and a 259-character description. |
| 6 (new) | The skill listing overflows its budget and drops the roadmap description | **STILL OPEN, cited mechanism** | "if you have many skills, Claude Code drops some descriptions to fit the listing's character budget ... The budget scales at 1% of the model's context window. When the listing overflows, Claude Code drops descriptions starting with the skills you invoke least" [CITED: code.claude.com/docs/en/skills, "Skill descriptions are cut short"]. A fresh user has invoked nothing. This plugin lists 227 model-invocable entries (113 commands + skills, minus 12 with `disable-model-invocation: true`), lower bound 17,056 description characters (12 folded YAML descriptions were undercounted). Test on the QA laptop with `/doctor` (listing estimate) or `claude --debug` (overflow warning). |

What a stubbed-PATH test can prove for hypothesis 1 and the backslash effect: that the resolver rejects a candidate whose probe prints a Linux `OSTYPE` or whose path sits under `System32` or `WindowsApps`, that it falls through to the next candidate, that it records every attempt in `tried`, that it converts paths to forward slashes, and that `room_create` preview refuses before the card. It cannot prove what the real WSL launcher prints with no distro, the real Windows PATH order, or libuv's real search on Windows. Inject `platform`, `env`, `spawnSync` and `existsSync` into the resolver so the win32 branch runs on Linux CI (precedent: `tests/test-l9o-rooms-python-floor.cjs` builds a PATH shim; the installer RCA used a forced `process.platform`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Shell + interpreter resolution | Local runtime (`lib/core/platform.cjs`) | doctor point | One resolver, read by every spawn site and by the preview; Part 7 |
| Registry write (create/switch) | Local script (`scripts/room-registry`, bash + Python) | `lib/core` wrappers | Bash stays authoritative; CJS wraps it |
| Room creation gate (F.0) | MCP server (`lib/mcp/startup-operations.cjs`) | `birthRoom` guard | The card is rendered inside `mintCard`; the check must run before it |
| Command routing | Host (Claude Code skill listing) | plugin hooks (`session-start`, `intent-classifier`) | Meaning-to-command is the host model's choice; plugin text steers it |
| Card firing at a fork | Stop hook (`scripts/check-card-fire.cjs`, node) | Larry doctrine ("Your call:" line) | Hook enforces only declared or registry forks |
| Voice length | Doctrine (`voice-dna.md`, `larry-extended.md`) | shadow Stop hook (`check-voice-style.cjs`) | Measured, not blocked (369.6 rung rule) |

## Standard Stack

No new package. Everything is Node built-ins and existing modules.

| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| Node `child_process.spawnSync` / `execFileSync` | Node >=22.18.0 floor (this host v22.23.1) | Probe by running; argv-array spawns, `shell:false` | existing |
| `lib/core/platform.cjs` | in repo | Extend with the resolver | existing, Part 7 anchor |
| `hooks/run-hook.cmd` | in repo | Precedent for Git Bash lookup order (Program Files, x86, then PATH) | existing; has the same `where bash` exposure |
| `scripts/doctor.cjs` `python-floor` point (lines 2165-2225) and `--check-rs-engine` resolver (4346-4362, honors `MINDRIAN_PYTHON`) | in repo | Doctor point to extend; `MINDRIAN_PYTHON` env contract already exists | existing |
| `lib/core/room-open.cjs` `runRegistry`, `pythonVersion`, `stderrTail` | in repo | Switch path; failure payload | existing |
| `lib/hmi/larry-reply-checks.cjs` (`countSentences`, `findUnsourcedNumber`) | in repo | QA383-08/09 | existing, 143/143 PASS |
| `lib/core/fork-declaration.cjs` + `scripts/check-card-fire.cjs` | in repo | QA383-05 | existing |
| `skills/ui-system/SKILL.md` section 7 | in repo | Three-line plain error pattern | existing |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: this phase installs no external package. slopcheck was not run.

## Architecture Patterns

### System Architecture Diagram

```
user asks for a room
   |
   v
room_create (MCP tool, lib/mcp/tools/startup.cjs:11)
   |
   v
prepareRoomCreation (startup-operations.cjs:42)
   |-- destination(slug)            (line 45-46, read only)
   |-- [NEW] resolveRoomRuntime()   -- not ok --> return {ok:false, reason:'environment_not_ready',
   |                                               plain:<3 lines>, tried:[...]}   (no card, no write)
   |-- mintCard -> renderGate        (line 48; THE CARD IS SHOWN HERE)
   v
gate_answer approve -> resumeFn (line 56)
   |-- destination re-check (line 58)
   |-- [NEW] resolveRoomRuntime() re-check (env may have changed)
   v
birthRoom (room-birth.cjs:985)
   |-- [NEW] runtime guard before line 1102 (covers CLI, auto-create, backfill callers)
   |-- STEP 1 mkdir + scaffold (1116) ... STEP 2 room.db ... STEP 3 compute-state
   |-- STEP 4 registry: spawnRegistry(resolved bash, fwd-slash script, args,
   |                     env {MINDRIAN_ROOMS_HOME, MINDRIAN_PYTHON})   (1439, 1447)
   |        |-- bash scripts/room-registry -> "$PY" -c ...   (registry.json)
   |        '-- [FIX] mkdir/seed only for a RELATIVE rpath (no doubled tree)
   |-- fail -> _rollbackFailedBirth (606) + plain + verbatim to log/seed
   v
_projectIdentity -> room-identity.cjs:562 (registry update room_id)
```

### Recommended file touch list

```
lib/core/platform.cjs                 # + resolveRoomRuntime, toBashPath, spawnRoomRegistry (lazy; NOT in detectPlatform)
lib/core/navigation/room-birth.cjs    # 1439, 1447 via spawnRoomRegistry; guard before 1102
lib/core/navigation/room-identity.cjs # 562 via spawnRoomRegistry
lib/core/room-open.cjs                # runRegistry (160) via spawnRoomRegistry; pythonVersion uses resolver
lib/core/room-auto-create.cjs         # 240 (P1, same helper)
lib/core/graph-backfill.cjs           # 445 (P1, same helper)
lib/mcp/startup-operations.cjs        # preview check before mintCard; re-check in resumeFn
scripts/room-registry                 # interpreter resolution; absolute-RPATH mkdir fix; WSL advice removed
scripts/doctor.cjs                    # python-floor point -> runtime point (bash + python found + versions + tried)
agents/larry-extended.md, commands/rooms.md  # plain-words-first failure doctrine (QA383-06)
scripts/check-voice-style.cjs         # shadow 'voice-length' policy (QA383-09)
tests/test-383-*.cjs, tests/run-all-383.sh
```

### Pattern 1: one resolver in platform.cjs (QA383-01, QA383-04)

**Today's shape (exact):** `detectPlatform()` returns `{os, shell, hasPython3, hasBashNative, codePage, supportsUtf8}`, memoized, and runs `python3 --version`, `where python3` (win32), `bash --version` and `chcp` (win32) eagerly. Its only runtime caller is `scripts/banner:33` on every session start. Do not add probes to it: that adds cost to the banner path. Add a separate, lazy function.

**What to add:**
```js
// lib/core/platform.cjs (proposed; names are the planner's to fix)
// resolveRoomRuntime(opts?) -> {
//   ok, bash: {path, ostype} | null, python: {path, version} | null,
//   tried: [{kind:'bash'|'python', candidate, result, detail}],
//   reason: null | 'no_bash' | 'no_python' | 'python_below_floor',
//   plain: '<what failed>\n  Why: <reason>\n  Fix: <one step>'
// }
// opts = { platform, env, spawnSync, existsSync, refresh } -- injection seams for tests
// result values: 'ok' | 'not_found' | 'rejected_wsl' | 'rejected_store_stub' | 'probe_failed' | 'below_floor'
```
- **bash on win32, candidate order:** `env.MINDRIAN_BASH` (test/override seam) -> `env.CLAUDE_CODE_GIT_BASH_PATH` (Claude Code's documented setting [CITED: code.claude.com/docs/en/setup]) -> `%ProgramFiles%\Git\bin\bash.exe` -> `%ProgramFiles(x86)%\Git\bin\bash.exe` (both mirror `hooks/run-hook.cmd`) -> `%LOCALAPPDATA%\Programs\Git\bin\bash.exe` [ASSUMED per-user Git path] -> `<dir of where git>\..\bin\bash.exe` [ASSUMED layout] -> each `where bash` hit. Reject any path under `%SystemRoot%\System32` or `\WindowsApps\` by name, AND probe each survivor with `bash -c 'printf %s "$OSTYPE"'`; accept only `msys`/`cygwin` on win32 (E7 shows `msys`; E2 shows the WSL launcher prints `linux-gnu`).
- **bash on POSIX:** plain `bash`, probe exit 0 (today's behavior).
- **python, all platforms:** `env.MINDRIAN_PYTHON` (already honored by doctor) -> `python3` -> `python` -> `py -3` (win32). Probe `-c "import sys;print(sys.executable);print('%d.%d'%sys.version_info[:2])"`; accept exit 0 and version >= 3.9 (the SEED-117 floor, `scripts/doctor.cjs` python-floor point). Use the printed `sys.executable` as the one resolved path, so `py -3` collapses to a single absolute executable (E5: `C:\Python313\python.exe`). The Store stub fails this probe (E4, exit 9009).
- **Memoize** per process with an explicit `refresh` flag; the MCP server is long-lived and a user may install Git mid-session.
- **spawnRoomRegistry(args, {roomsHome, cwd, timeout})**: spawns the resolved bash with `toBashPath(scriptPath)` (forward slashes; E8 shows Git Bash accepts both, forward slash is the safer contract), sets `env.MINDRIAN_ROOMS_HOME` and `env.MINDRIAN_PYTHON` (forward-slash path), `windowsHide:true`, `stdio:'pipe'`, `shell:false`. On no runtime, it does not spawn: it returns the resolver's `plain` + `tried` in the same failure shape `room-open.cjs runRegistry` already returns (`{ok, out, stderr, status, python}`), so callers change minimally.

**Spawn-site counts (method stated, Part 12):**
- P0 (interactive room create and switch): **4 sites** - `lib/core/navigation/room-birth.cjs:1439` (create), `:1447` (update parent), `lib/core/navigation/room-identity.cjs:562` (update room_id, reached from birth via `_projectIdentity` at room-birth.cjs:1556), `lib/core/room-open.cjs:160` (switch, get-active).
- All JS sites that spawn `scripts/room-registry`: **12** - the 4 above, plus `room-auto-create.cjs:240`, `graph-backfill.cjs:445`, `room-chooser.cjs:84` (uses `execSync` with a shell string: on win32 that is `cmd.exe` + JSON-quoted backslash path), `room-naming-selector.cjs:244`, `room-discard-cascade.cjs:139`, `scripts/heal-command.cjs:1201` and `:1211`.
- All bash spawns in non-test JS under lib, bin, hooks, scripts: **49 sites in 33 files** by a multi-line scan (regex `(spawnSync|spawn|execFileSync|execFile)\(\s*'bash'` plus `execSync('bash ...')`, excluding node_modules, dist, test files; scratch script `count-bash.cjs`). A looser single-line grep gives 46 to 54 depending on the pattern; CONTEXT's "at least 60" used a different grep. Plus 11 `hooks/run-hook.cmd` hook commands and the `settings.json` statusLine `bash` command.

### Pattern 2: room-registry interpreter and path fixes

- Replace the guard at `scripts/room-registry:45-48` with: `PY="${MINDRIAN_PYTHON:-}"`; if empty, try `python3`, `python`, `py -3` by RUNNING a floor check (`-c 'import sys;sys.exit(0 if sys.version_info>=(3,9) else 3)'`), resolve to `sys.executable`; on none, print one line naming every candidate tried and exit 127. Replace `python3` with `"$PY"` at the 12 call lines (168, 304, 386, 468, 512, 577, 616, 652, 695, 729, 760, 815) and in `_rr_exit_note` (56). Do the same in the 3 sibling scripts of the same family only if the planner includes them (`scripts/resolve-room`, `scripts/update-icm-index`, `scripts/on-cwd-changed`), since `on-cwd-changed` runs as a hook.
- Fix `create` at `scripts/room-registry:432` and `:438-439`: when `RPATH` is absolute (`/*` or a Windows drive form `[A-Za-z]:[\\/]*`), use it as the room dir; never prepend `${ROOMS_HOME}/`. The `case` at :444-447 already does this for `/*` only; extend it with the drive form and use the same resolved value for `mkdir -p` and `ROOMDIR`.
- Remove "or run inside WSL" from the line-46 message; it sends Windows users into the wrong world.
- Keep the existing `room-registry: exited N; python3 is ...` note format or update `_registryCauseLine` in room-birth.cjs:619-625, whose regex matches that literal.

### Pattern 3: preview check before the card (QA383-04)

`lib/mcp/startup-operations.cjs:42-69`. The card is rendered and, on elicitation hosts, shown inside `mintCard` (line 27-41, `gateRender.renderGate` at :34). Insert the resolver call after line 46 and before line 48. On failure return `{ok:false, reason:'environment_not_ready', plain, tried}`; `startup.cjs:8` already maps `ok:false` to `isError:true`. Repeat the check in `resumeFn` before `navigation.birthRoom` (line 60) and inside `birthRoom` before line 1102, so the CLI path (`/mos:new-project`), auto-create and backfill callers get the same refusal with no mkdir.

### Pattern 4: plain words first, verbatim kept (QA383-06)

The failure reaches the user through `answerRoomCreation` (startup-operations.cjs:70-78), which returns `room_creation: {ok:false, reason:'registry_create_failed:<cause line>', stderr, python, rolled_back}` from room-birth.cjs:1518-1527. The host model narrates it, and the doctrine tells it to show the raw line: `agents/larry-extended.md:147` and `commands/rooms.md:246`, `:314` ("Report the failure line verbatim"). Fix: add a `plain` field built in the three-line pattern of `skills/ui-system/SKILL.md` section 7 (line 1 what failed, `Why:` reason, `Fix:` one step; "Never show stack traces, raw errors, JSON, or >3 lines"), and amend the doctrine: show `plain` to the user; put the verbatim line in the bug seed and the log. This needs owner open question 1.

### Pattern 5: diagnosis order for QA383-02/03 (Wave 2)

1. Read `383-QA-REPORT-verbatim.md`. Did the 3-mode cold-start card appear? If yes, `session-start` ran and Mode 1 "Just Talk" is the proven cause (session-start:799, :808). If no, the hooks did not run: on Windows without Git Bash, `hooks/run-hook.cmd:46` `where bash` finds the WSL launcher (E1) or nothing (line 54: "exit silently").
2. Check the listing budget on the QA laptop: `/doctor` listing estimate or `claude --debug` overflow warning (hypothesis 6).
3. Scripted CLI session tests: with a room and without one, prompt "I know what I want, I need the how", assert the Skill tool call names `scientific-roadmap`. `claude plugin eval` with a `tool_used: Skill` grader exists for this [CITED: code.claude.com/docs/en/skills, Troubleshooting]; it needs a live model, so it is a manual or nightly leg, not `run-all-383.sh`.
4. If the cause is "no room + Mode 1", the fix is in session-start text (Mode 1 must still route an explicit method need like the roadmap trigger) and is a doctrine change; a routing-engine change is not indicated.

### Anti-Patterns to Avoid
- **Adding probes to `detectPlatform()`:** it runs on every session start through `scripts/banner`. Keep the resolver lazy.
- **`shell:true` for bash spawns:** the installer RCA shows `shell:true` breaks spaced paths such as `C:\Program Files\...` under cmd.exe.
- **Forward-slash conversion alone:** it does not fix the WSL launcher case (the path is still not a WSL path, and env vars do not cross).
- **Probing by name (`command -v`, `where`):** the Store stub and shims pass by name and fail at run time (E4).
- **Passing script source or long values as argv on Windows:** the `windows-argv-mangling-bash-spawn` RCA shows backslash-before-quote corruption; pass file paths and env vars only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A second platform module | `lib/core/shell-resolve.cjs` | extend `lib/core/platform.cjs` | Part 7; PRD constraint |
| Git Bash lookup order | a new order | mirror `hooks/run-hook.cmd` + `CLAUDE_CODE_GIT_BASH_PATH` | Shipped precedent; documented setting |
| Python env contract | a new env var | `MINDRIAN_PYTHON` (doctor.cjs:4357) | Already honored |
| Plain error copy | new wording scheme | `skills/ui-system/SKILL.md` section 7 | House pattern |
| Sentence counting / unsourced numbers | new regex | `lib/hmi/larry-reply-checks.cjs` | 143 assertions PASS |
| Fork detection | prose heuristics | `lib/core/fork-declaration.cjs` | Numbered-prose arm was retired on purpose (card-fire-relevance-check-gap) |
| Rollback | new cleanup | `_rollbackFailedBirth` (room-birth.cjs:606) | SEED-117 contract, tested |

## Runtime State Inventory

This is a fix phase with a data defect, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Doubled-path junk trees from `room-registry create`: `~/MindrianRooms/home/jsagi/MindrianRooms/` (8 entries) and `C:\Users\jsagi\MindrianRooms\C:`. Every user who created a room through `birthRoom` likely has one. `listRoomRoots` (icm-forest.cjs:231) lists every non-dot directory, so `home` or `C:` may show as a "room". | Code fix stops new ones. Cleanup of existing trees is a data migration on the user's machine: SEED-117 forbids hand edits, so propose a doctor `--fix` point or a separate seed; never delete on the owner's real rooms in this phase. NEEDS a decision. |
| Live service config | None. No Brain or remote state is involved (Part 8). | none |
| OS-registered state | None found. | none |
| Secrets/env vars | `CLAUDE_CODE_GIT_BASH_PATH` (read), `MINDRIAN_PYTHON` (read), new `MINDRIAN_BASH` seam (proposed). | none |
| Build artifacts | None. | none |

## Common Pitfalls

### Pitfall 1: trusting exit 0 from `bash`
**What goes wrong:** the WSL launcher passes `bash --version` (E2). **Avoid:** probe `$OSTYPE`; reject System32/WindowsApps paths. **Warning sign:** `hasBashNative:true` with `hasPython3:false` on win32 (E6).

### Pitfall 2: registry first-argument heuristic
`scripts/room-registry:28-31` treats the first argument as ROOMS_HOME only if `[ -d "$1" ]`. A rooms home that does not exist yet (or a path the bash cannot see) becomes the SUBCOMMAND. Make the caller create nothing; instead pass `MINDRIAN_ROOMS_HOME` in env (already done at most sites) and keep the positional for back-compat.

### Pitfall 3: `_registryCauseLine` regex coupling
room-birth.cjs:622 filters `^room-registry: exited \d+; python3 is `. Changing the note text without the regex makes the cause line the note itself.

### Pitfall 4: rooms home created and left behind
`birthRoom` `fs.mkdirSync(roomDir, {recursive:true})` (room-birth.cjs:1116) also creates the rooms home; rollback removes only `roomDir` (`_bornWiredRollback` :577). A failed first birth leaves an empty `MindrianRooms` (and `.rooms/` if the registry started). The runtime guard before :1102 prevents this for the environment class of failure.

### Pitfall 5: hook coverage on Windows
`hooks/run-hook.cmd` exits 0 silently with no bash, and its `where bash` branch picks the WSL launcher (E1). The 11 bash hooks (session-start, on-stop, write-scope-check, intent-classifier, ...) then do nothing or fail. The `node` hooks (35, including `check-card-fire.cjs`, `check-voice-style.cjs`, `auto-explore-fingerprint.cjs`) still run. This phase should at least reorder `run-hook.cmd` to skip System32/WindowsApps bash; the planner decides scope.

### Pitfall 6: other writes before a gate (QA383-10 inventory)
Code-read writers under the rooms home that run without a gate answer: `room-registry create` doubled tree (proven, above); `lib/core/room-auto-create.cjs:179` mkdir of the rooms home and a whole placeholder room `untitled-<ts>` by design (Canon Part 10 sub-claim 3 "rooms are receipts", triggered by `scripts/auto-explore-fingerprint.cjs:213-240`, a PostToolUse node hook); `lib/mcp/daemon-lifecycle.cjs:97` writes `<rooms home>/.rooms/daemon/`; `lib/core/session-binding.cjs:223` writes `.rooms/sessions/` on bind. The auto-create path conflicts with the QA383-10 "done when" literally; it needs an owner ruling.

### Pitfall 7: card-fire suite has expected RED legs
`tests/test-card-fire-relevance-gate.cjs` exits 1 at HEAD with "6 passed, 5 failed (softened-direction RED legs are EXPECTED until plan 210-05 lands)". Do not list it as must-stay-green; list it as must-not-get-worse.

### Pitfall 8: Windows test from WSL is not the QA laptop
Interop runs inherit a WSL-shaped environment. Say so in every Wave 1 result.

## Code Examples

```js
// Source: this session's Windows probe (E2/E3), the decisive check for the resolver
const r = spawnSync(candidate, ['-c', 'printf %s "$OSTYPE"'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
const ok = r.status === 0 && (platform !== 'win32' || /^(msys|cygwin)/.test(r.stdout || ''));
```

```js
// Source: E5, collapse python3 / python / py -3 to one absolute path
const p = spawnSync(cmd, [...pre, '-c', "import sys;print(sys.executable);print('%d.%d'%sys.version_info[:2])"],
  { encoding: 'utf8', timeout: 5000, windowsHide: true });
// accept: status 0, two lines, version >= 3.9; resolved path = line 1
```

```bash
# Source: scripts/room-registry create, proposed RPATH fix
case "$RPATH" in
  /*|[A-Za-z]:[\\/]*) ROOMDIR="$RPATH" ;;
  *) ROOMDIR="${ROOMS_HOME}/${RPATH}" ;;
esac
mkdir -p "$ROOMDIR"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom slash commands separate from skills | Commands merged into skills; description always in context; listing budget 1% of context window, least-invoked descriptions dropped first | Claude Code docs (current) | A 227-entry plugin can lose its routing text on a fresh install |
| Native Windows required Git Bash | Git for Windows is optional; without it Claude Code uses the PowerShell tool | Claude Code docs (current) | `bash` may not exist for the user at all; hooks via `run-hook.cmd` then no-op |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-user Git installs live at `%LOCALAPPDATA%\Programs\Git\bin\bash.exe` | Pattern 1 | One candidate misses; the PATH and `where git` legs still cover it |
| A2 | `<where git>\..\bin\bash.exe` is Git Bash for a standard Git layout | Pattern 1 | Same as A1 |
| A3 | Git Bash accepts a forward-slash Windows path (`C:/Python313/python.exe`) in `MINDRIAN_PYTHON` | Pattern 2 | Interpreter not found; test in Wave 1 on this host via interop (cheap) |
| A4 | The QA laptop's environment matches E1-E4 (WSL launcher first on PATH, Store stub for python3) | Summary | The P0 cause differs; Wave 4 confirms |
| A5 | Claude Code and Claude Desktop pass a PATH to child processes similar to the interop PATH | Windows evidence | Resolver order matters less or more; Wave 4 |
| A6 | libuv on Windows searches PATH in order and tries `.com`/`.exe` but not `.cmd` | Hypothesis 2 | Explains E4; the probe-by-running design is correct either way |

## Open Questions

1. **Raw error versus SEED-117** (PRD Q1). Recommendation: plain three lines to the user, verbatim line in the seed and the log.
2. **Which number, which card, which folder** (QA383-07, -08, -10). The verbatim report answers them. For QA383-10, the doubled-path tree is the leading candidate.
3. **Room auto-create versus QA383-10.** `room-auto-create.cjs` creates a room with no gate by Canon Part 10 sub-claim 3. Recommendation: keep it but make it honor the runtime guard; ask the owner whether it must move behind a gate.
4. **Existing junk trees.** Recommendation: a doctor `--fix` point in a later quick, not this phase's code path.
5. **Desktop and Cowork on Windows in Wave 4** (PRD Q3).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | yes | v22.23.1 (floor 22.18.0) | - |
| bash (Linux) | registry tests | yes | 5.2.21 aarch64 | - |
| python3 | registry tests | yes | 3.12.3; `python3.9` at `~/.local/bin` for the floor arm | - |
| Windows node.exe via interop | Windows-side probes (E1-E8) | yes | `C:\Program Files\nodejs\node.exe` | none needed |
| Git Bash (Windows side) | Windows-side registry probe | yes | `C:\Program Files\Git\bin\bash.exe` (msys) | - |
| Claude Code CLI | routing evals | yes | 2.1.318 | - |
| A Windows host with no WSL distro and no real Python | QA383-01 done-when | no | - | Wave 4 on the owner's QA laptop (blocking for closure) |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | plain Node assertion scripts (`node tests/test-*.cjs`, exit code), bash aggregators |
| Config file | none |
| Quick run command | `node tests/test-383-<leg>.cjs` |
| Full suite command | `bash tests/run-all-383.sh` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QA383-01 | Resolver rejects WSL launcher (Linux OSTYPE, System32/WindowsApps path), rejects Store stub (exit 9009), falls through to Git Bash / `python` / `py -3`, lists `tried`, returns forward-slash paths; injected `platform:'win32'` + fake spawn | unit, stub PATH and injected spawn | `node tests/test-383-runtime-resolver.cjs` | no, Wave 0 |
| QA383-01 | room-registry resolves `PY` by running; a PATH whose `python3` is a stub script exiting 9009 still creates via `python`; none found -> exit 127 with every candidate named; no room dir left | integration, PATH shim (l9o precedent) | `node tests/test-383-registry-interpreter.cjs` | no, Wave 0 |
| QA383-01 / -10 | `create` with an absolute RPATH writes NO tree under ROOMS_HOME (E9 regression) | integration, temp home | `node tests/test-383-registry-abs-rpath.cjs` | no, Wave 0 |
| QA383-01 | The 4 P0 sites spawn through the one helper (no bare `'bash'` left at those lines) | static grep | `node tests/test-383-spawn-chokepoint.cjs` | no, Wave 0 |
| QA383-01 | Real Windows create with no WSL distro and no real Python: created, or one plain message and no folder | human Windows receipt | Wave 4 receipt in `383-WINDOWS-RECEIPT.md` | manual |
| QA383-04 | `prepareRoomCreation` with a failing injected resolver returns `environment_not_ready`, mints no gate (`gateLedger` count unchanged), writes no file under the temp rooms home; `birthRoom` guard returns before mkdir | unit | `node tests/test-383-preview-env-check.cjs` | no, Wave 0 |
| QA383-02 | session-start no-room context: an explicit method-need line is not suppressed by Mode 1 text (string contract), plus a listing-size report (entries, chars) | string lint + report | `node tests/test-383-no-room-routing.cjs` | no, Wave 0 |
| QA383-02 | Scripted session reaches `scientific-roadmap` with and without a room | eval (live model) | `claude plugin eval` with a `tool_used: Skill` grader (manual / nightly) | manual |
| QA383-03 | First-turn honest notice when the MCP server cannot load (fixture: plugin root without `node_modules/@modelcontextprotocol/sdk`) | hook fixture | `node tests/test-383-mcp-unavailable-notice.cjs` | no, Wave 0 (only if Wave 2 picks this fix) |
| QA383-05 | Transcript with "Your call: A \| B \| What if C" and no AskUserQuestion -> `declared-fork-no-card`; a turn after the user answered with no declaration -> `no-gate-signal` | hook fixture transcript | `node tests/test-383-card-fork.cjs` | no, Wave 0 |
| QA383-06 | Failure payload carries `plain` (3 lines, no path, no stack); verbatim line kept in `stderr`/log; doctrine text says plain-first | unit + string lint | `node tests/test-383-plain-failure.cjs` | no, Wave 0 |
| QA383-07 | No third-person reference to the navigator in static card option labels/descriptions (startup-operations.cjs, commands/*.md "Options:" lines, gate templates) | string lint | `node tests/test-383-card-second-person.cjs` | no, Wave 0 |
| QA383-08 | The named string passes `findUnsourcedNumber` | string lint | `node tests/test-383-sourced-number.cjs` | no, needs verbatim report |
| QA383-09 | Corpus of default turns: `countSentences` <= 8; "just tell me" turn exempt; shadow hook logs a `voice-length` row | unit + hook fixture | `node tests/test-383-voice-length.cjs` | no, Wave 0 |
| QA383-10 | No write under the temp rooms home before approve on the MCP path (snapshot before preview and after reject/defer) | integration | `node tests/test-383-no-write-before-gate.cjs` | no, Wave 0 |

### Must-stay-green (run at HEAD in this session)
| Test | HEAD result |
|------|-------------|
| `tests/test-platform.cjs` | PASS ("all tests passed") |
| `tests/test-room-birth.cjs` | 35/35 PASS |
| `tests/test-l9o-rooms-python-floor.cjs` | 18 passed, 0 failed, 0 skipped |
| `tests/test-room-registry-windows-path.cjs`, `-windows-python-interp.cjs`, `-windows-atomic-replace.cjs` | exit 0 |
| `tests/test-startup-flows.cjs` | exit 0 |
| `tests/test-371-startup-ui.cjs` | exit 0 |
| `tests/test-359-declared-arm.cjs` | 20/20 |
| `tests/test-3696-reply-checks.cjs` | 143/143 |
| `tests/test-card-fire-relevance-gate.cjs` | exit 1, 5 expected RED legs (must not get worse) |
Also not run here, name in plans: `tests/test-room-registry-path-resolution.cjs`, `tests/test-self-update-platform.cjs`, `tests/test-session-start-banner.cjs`, `tests/test-353-subroom-birth.cjs`, `tests/test-209-card-fire-gate.cjs`, `tests/run-all-359.sh`, `tests/run-all-3696.sh`, `tests/test-127.2-04-windows-path-and-update-activation.sh`.

### Sampling Rate
- Per task commit: the task's `node tests/test-383-*.cjs` plus the must-stay-green file for the file touched.
- Per wave merge: `bash tests/run-all-383.sh`.
- Phase gate: `bash tests/run-all-383.sh`, the three born-wired/projection/render gates, `node scripts/doctor.cjs --acceptance`, and the Wave 4 Windows receipt.

### Wave 0 Gaps
- [ ] `tests/run-all-383.sh` - glob discovery of `tests/test-383-*.cjs` with a found-eq-0 guard, a dash fence and a Part 8 sweep (copy the shape of `tests/run-all-381.sh`).
- [ ] The test files listed in the map.
- [ ] `383-QA-REPORT-verbatim.md` (blocks QA383-07/08/10 tests).

## Tri-Polar

| Fix | CLI | Desktop | Cowork |
|-----|-----|---------|--------|
| Resolver + registry (QA383-01) | Same `birthRoom`/`room-open` code; testable here | MCP server spawns the same `birthRoom`; PATH from the Desktop process: UNVERIFIED | Linux sandbox [ASSUMED]: POSIX branch unchanged; UNVERIFIED |
| Preview check (QA383-04) | `/mos:new-project` reaches `birthRoom` guard | `room_create` preview: same code | same code, UNVERIFIED |
| Routing (QA383-02/03) | session-start hook text + skill listing | no hooks on Desktop [ASSUMED]; MCP runtime instructions route instead | UNVERIFIED |
| Card firing (QA383-05) | Stop hook (node) | `stop_gate_check` MCP path (`lib/mcp/stop-gate-handler.cjs`) | UNVERIFIED |

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | argv arrays, `shell:false`; slug regex in `destination()`; no interpolation of paths into Python source (existing sys.argv rule) |
| V12 Files and Resources | yes | `isRealpathContained` in `destination()`; RPATH fix keeps writes inside the intended dir |
| V2/V3/V4/V6 | no | no auth, session or crypto change |

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| PATH hijack of `bash`/`python` | Tampering | probe by running, absolute resolved path, reject System32/WindowsApps bash |
| Command injection via `shell:true` | Tampering | never `shell:true` for bash spawns; fix `room-chooser.cjs:84` `execSync` string if touched |
| Writes outside the room | Tampering | absolute-RPATH fix (E9) |

## Proposed requirements cross-check

| Req | Decisive files (file:line) | Wave |
|-----|---------------------------|------|
| QA383-01 | lib/core/platform.cjs:42-116; lib/core/navigation/room-birth.cjs:1439, :1447; lib/core/navigation/room-identity.cjs:562; lib/core/room-open.cjs:104-116, :160; scripts/room-registry:45-56 and 12 python3 lines; hooks/run-hook.cmd:46 | 1 |
| QA383-02 | scripts/session-start:799, :808; scripts/intent-classifier.cjs:597, :679, :3702; commands/scientific-roadmap.md frontmatter; Claude Code skill listing budget | 2 |
| QA383-03 | agents/larry-extended.md:163; lib/mcp/tools/context.cjs:120-129; hooks/run-hook.cmd:54 | 2 |
| QA383-04 | lib/mcp/startup-operations.cjs:42-69 (check between :46 and :48; re-check before :60); lib/core/navigation/room-birth.cjs:1102 | 1 |
| QA383-05 | scripts/check-card-fire.cjs:556-605 (no-gate-signal at :580-583), :300-308; lib/core/fork-declaration.cjs; agents/larry-extended.md:126, :143 | 3 |
| QA383-06 | lib/core/navigation/room-birth.cjs:1505-1527; lib/mcp/startup-operations.cjs:70-78; agents/larry-extended.md:147; commands/rooms.md:246, :314; skills/ui-system/SKILL.md section 7 (line 425); scripts/room-registry:46 | 3 |
| QA383-07 | lib/mcp/gate-render.cjs:286 (normalizeCard); lib/mcp/startup-operations.cjs:49-54, :89-95; commands/new-project.md:100; skills/new-project/SKILL.md:96 | 3 |
| QA383-08 | lib/hmi/larry-reply-checks.cjs (findUnsourcedNumber); the string named in the verbatim report | 3 |
| QA383-09 | references/personality/voice-dna.md:21, :66; agents/larry-extended.md:41; lib/hmi/larry-reply-checks.cjs:257 (countSentences); scripts/check-voice-style.cjs | 3 |
| QA383-10 | scripts/room-registry:432, :438-447; lib/core/navigation/room-birth.cjs:1116, :577; lib/core/room-auto-create.cjs:179; lib/mcp/daemon-lifecycle.cjs:97 | 1 (RPATH) and 3 |

## Sources

### Primary (HIGH)
- Windows-native probes E1-E10 run in this session (Windows `node.exe` via WSL interop; Git Bash; read-only `ls` of real rooms homes).
- Code read at HEAD `c46714ecc`: files and lines cited inline.
- code.claude.com/docs/en/skills - "Skill descriptions are cut short", frontmatter (`disable-model-invocation`), commands merged into skills, `claude plugin eval` grader.
- code.claude.com/docs/en/setup - native Windows: Git for Windows optional, PowerShell tool without it, `CLAUDE_CODE_GIT_BASH_PATH`.
- learn.microsoft.com/en-us/windows/wsl/filesystems - `wsl <command>` handled like a WSL command (piping, redirection), WSL-format paths, `WSLENV`.
- learn.microsoft.com/en-us/windows/wsl/basic-commands - `bash` listed as deprecated WSL syntax.

### Secondary (MEDIUM)
- `.planning/debug/knowledge-base.md` entries: windows-room-registry-path-normalization-gap, windows-python-interp-and-shim, windows-argv-mangling-bash-spawn, windows-os-rename-registry-wedge, card-fire-relevance-check-gap.
- `.planning/debug/windows-posix-shell-assumption-installer-statusline.md`, `windows-installer-spawn-shell-false.md`, `windows-build-brain-python-qa.md`, `windows-install-and-field-qa-sweep-2026-08-10.md`; SEED-142, SEED-117, SEED-013.

### Tertiary (LOW)
- A1, A2, A5 in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Windows mechanism: HIGH - reproduced on a Windows-native Node process on this host; LOW for the QA laptop until Wave 4.
- Resolver design: HIGH - precedent in run-hook.cmd and doctor; probes verified.
- Routing causes: MEDIUM - two code causes proven, one cited; the owner's session not yet read.
- QA383-07/08: LOW - blocked on the verbatim report.

**Research date:** 2026-11-05
**Valid until:** 2026-12-05 (code facts at HEAD c46714ecc; re-read line numbers if HEAD moves)

SEED-013 status: not partially landed for the registry. SEED-013 targets the Engine 1 analyzers (rs-engine, HSI); no Node port of `scripts/room-registry` exists (grep of lib/core for a registry writer: none; the only mention is the room-registry:46 message "until the Node rewrite lands"). The P0 fix cannot lean on it.
