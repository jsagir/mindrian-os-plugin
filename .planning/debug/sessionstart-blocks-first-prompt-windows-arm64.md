---
status: diagnosed
kind: qa-sweep
trigger: "SEED-128: SessionStart blocked the first prompt for 37 minutes on Windows ARM64 (owner's report, v2.0.0-beta.65, 2026-10-13)"
issue_id: "SEED-128"
severity: blocker
surfaces: [cli]
canon_parts: [8]
created: 2026-10-13
updated: 2026-10-13
goal: find_root_cause_only
---

# Debug session: SessionStart blocks the first prompt (Windows ARM64)

Follows docs/RCA-TEMPLATE.md (kind: qa-sweep). Every finding is classified WORKING, known tracked bug, ENV GAP or NEW FAILURE before any fix. Fixes go through /gsd-quick after classification, not inside this session.

State on 2026-10-13: root cause found (diagnose only). No code changed. The fixes are open as proposed /gsd-quick tasks in the Resolution section. Do not move this file to resolved/ until those tasks land.

## Current Focus

- hypothesis: CONFIRMED. SessionStart runs analyze-room and compute-state synchronously; both start one or more processes per file and per section pair (about 6,000 to 10,000 process starts per SessionStart on a 133 to 150 .md room). The tier rule that should skip analyze-room reads a file with no writer, so every session takes the rich tier. on-stop runs compute-state again on every reply. No deadline stops the run, because hooks.json writes milliseconds and Claude Code 2.1.296 reads seconds, and the scripts have no whole-script deadline. Windows ARM64 Git Bash (x64 under emulation) multiplies each process start to 45 to 89 ms.
- test: none open (goal find_root_cause_only).
- expecting: not applicable.
- next_action: open the /gsd-quick tasks in the Resolution order.
- x1_verdict (2026-10-13T11:19Z, runtime, method 1 plus control runs; evidence entry "X-1 runtime check"): X-1 CONFIRMED in effect, REFUTED in mechanism. Effect CONFIRMED: Claude Code 2.1.296 drops the whole session-start context on a room session (4 of 4 headless runs whose session-start stdout held ESC bytes: A, A2, ctrl-prewarm, ctrl-detach; the model probe answered NO in each; 10 of 10 real 2.1.296 records in the owner's transcripts are refusals). Mechanism REFUTED as an AND: invalid JSON (I-1) alone drops the context; the pipe holder (F6) only selects which refusal message fires. With both holders detached and ANSI left in, Claude Code still refuses ("Hook output looks like a JSON object but is not valid JSON"). With ANSI stripped and holders left in, Claude Code accepts. So the X-1 claim "a fix to either I-1 or the F6 holder removes the condition" is false: only T14 restores the context.
- x2_new (runtime): after T14, Claude Code 2.1.296 still does not inline the context. Each hook additionalContext above 10,000 chars (binary constant vRs=1e4) is saved to a file and replaced by a 2,407-char preview. session-start sends 21,881 chars, so the tail (for example the NAVIGATION CARD-FIRE CONTRACT doctrine) never reaches the model (probe NO in 2 of 2 ANSI-fixed runs; head probe YES).
- f6_correction (runtime): brain-prewarm is not the only post-exit holder. The scout-cadence subshell (session-start:1776) held the hook pipes 6.3 to 6.4 s after exit in 3 of 3 harness runs (first run in 24 h per room).
- i7_new (side effect of this check, NEW FAILURE): a copied room is not isolated. The copy's .mindrian/graph-derive-queue.json holds the absolute source roomDir, and the SessionStart drain derives against that path. 4 runs wrote 4 derivation_skipped memory_event nodes into the SOURCE room.db.
- next_action: main session: decide the room.db restore (NEEDS_HUMAN in the report); then re-rank T14 above T13, add T23 (X-2) and T24 (I-7) as proposed below.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Plugin version: reported on 2.0.0-beta.65; investigated on main 451179087 (2.0.0-beta.68 per `node lib/core/repo-version.cjs`).
- Reported by: the owner (one run on a Windows ARM64 laptop).
- Date first observed: 2026-10-13.
- Related: .planning/seeds/SEED-128-sessionstart-blocks-first-prompt-37-min-windows-arm64.md and SEED-128-source-bug-report.md; SEED-125 (on-stop line budget only, not wall time); .planning/debug/doctor-auto-heal-qa-sweep-2026-09-16.md F12 (SQLite ExperimentalWarning pattern); .planning/debug/room-birth-compute-state-node-on-bash.md (a different compute-state defect); .planning/phases/355.1-.../355.1-RESEARCH.md:128 (C5, timeout unit); .planning/phases/369-.../369-HOOK-COLD-START.md:117-130 (observations 1, 2, 3).

### Source-of-Truth Preamble

- CODE claims read against: dev workspace main HEAD @ 451179087 (2.0.0-beta.68). Investigator A ran a byte copy of that tree. Investigator B ran a `git archive HEAD` copy. HEAD was still 451179087 at the merge (checked 2026-10-13T10:52Z).
- Claude Code claims read against: the installed binary ~/.local/share/claude/versions/2.1.296 (the same version as the report).
- WIRE claims: none. No Brain call carried room content. The network was blocked in both sandboxes, and the Brain URL pointed at a refused loopback port.
- Date of audit: 2026-10-13.
- Re-verification rule: every file:line below is on 451179087. Re-verify against origin/main before a task edits it.

## Problem Statement

On a Claude Code CLI install with an active room, the SessionStart hook runs two bash programs that start processes per file, synchronously and without a working deadline, so the first prompt waits minutes (37 minutes reported on Windows ARM64). The Stop hook repeats one of them on every reply.

## Trigger (data, verbatim pointer)

DATA_START
The owner's full report is preserved word for word (room names pseudonymised) in .planning/seeds/SEED-128-source-bug-report.md. The seed summary is .planning/seeds/SEED-128-sessionstart-blocks-first-prompt-37-min-windows-arm64.md.
DATA_END

## Symptoms (from the report)

- Expected: SessionStart completes within its 10 s hook budget; analyze-room's own header says "Must complete in under 2 seconds"; on-stop within 3 s.
- Actual: run-hook.cmd session-start ran 2,226 s; a timed rerun took 569 s (analyze-room 489 s, compute-state 58 s, rest about 22 s). on-stop about 40 s per reply. Other hooks exceeded their timeouts (reference-now-seed 22.6 s vs 5 s; check-pending-breakthrough 28 s vs 2 s).
- Errors: none; the hooks exit 0. Stderr noise from intent-classifier (SQLite ExperimentalWarning; circular-require warning on RECOMMENDED_CONFIDENCE_FLOOR).
- Timeline: reported on beta.65; machine-dependent (Windows ARM64, Git Bash x64 under emulation, about 89 ms per process spawn, Defender on).
- Reproduction: the report's xtrace recipe (PS4 with EPOCHREALTIME, bash -x scripts/session-start) on a room of 136 to 159 .md files.

## Scope and Impact

- Affected surfaces: CLI (hooks). Desktop and Cowork run no hooks. They reach compute-state through MCP only (lib/core/state-ops.cjs:52, 10 s execSync; lib/mcp/stop-gate-handler.cjs:98), so a compute-state change (task T2) changes them too.
- Affected scripts: SessionStart (scripts/session-start and 8 node groups), Stop (scripts/on-stop, scripts/hmi-compliance-poll.cjs), SubagentStop (scripts/on-agent-complete), TaskCompleted (scripts/on-task-complete:51), CwdChanged (scripts/on-cwd-changed:108), UserPromptSubmit (scripts/intent-classifier stderr).
- Affected users: every CLI install with an active room. Windows on ARM64 with x64 Git Bash: minutes per SessionStart, tens of seconds per Stop. Native Linux ARM64 (measured here): 12.5 to 35.7 s per SessionStart (rooms of 133 to 485 .md) and 4.2 to 11.2 s per Stop (rooms of 66 to 529 .md). macOS: UNVERIFIED.
- Version range: 2.0.0-beta.65 (report) to main 451179087 (2.0.0-beta.68). The first bad version was not bisected.
- Severity: blocker.
- Blast radius: every caller of compute-state (6 hook call sites, 2 MCP call sites), every hooks.json timeout value, every background job in session-start, on-stop and on-agent-complete.

## Environment constraint for this session (corrected 2026-10-13)

- PROVEN by both investigators: this machine is WSL2 Linux on aarch64 (uname -m = aarch64; CPU implementer 0x51, Qualcomm; 12 cores; node v22.23.1 arm64). It is not x86_64. The earlier statement in this file was wrong.
- The Linux side runs native ARM64 bash, coreutils and node. It has no x64 emulation and no Defender, so Linux wall time is a lower bound for Windows.
- PROVEN (A): the Windows side of this machine has the reporter's stack: Git for Windows bash 5.2.37 x86_64-pc-msys (an x64 binary under emulation), MSYS_NT-10.0-26200-ARM64, Windows build 26200. Defender state on this Windows side: UNVERIFIED.
- Calibration on the Windows side (A; read-only; Git Bash with --noprofile --norc through WSL interop): 45 to 79 ms per fork+exec (10 x /usr/bin/true = 0.45 to 0.79 s); 36 ms per fork-only subshell; 154 to 164 ms per node.exe start; analyze-room on a link-free 36 .md synthetic room = 85.0 s against 1,374 Linux-counted execs, so 0.062 s per exec effective (fork-only cost and file access included).
- Local Linux baseline (B): 1 to 1.6 ms per /usr/bin/true; about 40 ms per `node -e 0`.
- Projection factors used below, each labelled projection: x0.089 s (the report's factor; primary; spawn-only) and x0.062 s (A's calibrated factor, per exec). The x0.089 projection over-estimated the calibration room by 44%.
- Unit note: A counts execs (process images started) and forks (all new processes). B counts spawns (FORK + VFORK + posix_spawn), which equals A's forks. x0.062 is a per-exec factor. Applied to B's spawn counts it gives an upper estimate for that factor.

## Findings to classify (from the report; re-check each on current main, v2.0.0-beta.67 or later)

1. P0 analyze-room in the synchronous SessionStart path (session-start about line 523; rich tier).
2. P0 hook timeouts not enforced on Windows (process tree run-hook.cmd -> bash.exe -> children); no script has an internal deadline.
3. P0 on-stop about 40 s per reply.
4. P1 compute-state 58 s (per-file fork pattern; also on every agent completion via on-agent-complete).
5. P1 nine SessionStart hook groups each start node; about 61 node invocations inside session-start, many node -e to read one JSON field.
6. P1 backgrounded subshells inherit the hook's stdout (track-analytics; the check-update subshell; on-stop line 154).
7. P1 synchronous auto-update inside session-start without a deadline.
8. P2 brain-prewarm never exits on timeout (no process.exit after the race).
9. P2 intent-classifier stderr noise, including a real circular require.
10. P2 hmi-compliance-poll 4.1 s on a Stop; send-event.ps1 per Stop (check whether send-event.ps1 is MindrianOS or user-side).
11. P2 plugin cache hygiene (old version and .tmp directories left after update).
12. P2 room registry shows many rooms status active while the active field names another room.
Also: the rich-tier rule (CTX_PCT_INT < 30 is always true at startup; session-start about line 442).

Classification of every item: see Evidence > Summary table.

## Constraints

- Read-only for rooms (~/MindrianRooms): copy a room to a scratch directory before running any script that writes, or run scripts against a synthetic fixture. No room writes.
- No push, no release, no version bump. Explicit-path commits only (git commit --only; git add -f for .planning files). No em-dashes. Canon Part 8 local-only (no Brain call with room content).
- Every subagent follows ~/.claude/protocols/agent-interaction-protocol.md.
- Private evidence (room text) never committed; counts and timings only.

## Evidence

### Measurement method

- Sources of code: A used a byte copy of the 451179087 tree (without .git, .planning, .claude, ui, tests). B used a `git archive HEAD` copy. No script ran from the repo or from ~/.claude/plugins.
- Spawn counter A: a ptrace tracer (PTRACE_O_TRACEFORK, TRACEVFORK, TRACECLONE, TRACEEXEC; threads separated by /proc Tgid). It logs each fork, each exec (image, argc, `-e` flag) and each exit. It charges each process to the nearest ancestor that exec'd a script. Counts were identical across repeated passes.
- Spawn counter B: an LD_PRELOAD fork/exec counter. It logs FORK, VFORK and PSPAWN in the parent and EXEC in each new dynamically linked image. A self-test with a bash plus node script gave the expected counts, including node child_process spawns.
- Per-line attribution: bash xtrace with `PS4='+ ${EPOCHREALTIME} ${LINENO}: '` (A) and with `${BASHPID}` added (B).
- Hook-runner models: A timehook.cjs (exit time and pipe EOF, no tracer, hook-style stdin). B harness.cjs (ms to 'exit' and to 'close'; close minus exit = pipe hold). B also counted file reads per node process with a NODE_OPTIONS --require patch.
- Sandboxed HOME: A used bubblewrap 0.9.0 (real root read-only, private tmpfs /tmp, --unshare-net, --unshare-pid, --clearenv; HOME, USERPROFILE, TMPDIR and MINDRIAN_ROOMS_HOME in scratch; MINDRIAN_BRAIN_URL=http://127.0.0.1:9; cwd outside any git repo). B used `unshare -r -n` (no network; a test fetch failed with EAI_AGAIN) with `env -i`, HOME and MINDRIAN_ROOMS_HOME in scratch, a sandbox registry and no MINDRIAN_BRAIN_KEY.
- Rooms, by pseudonym only: SYN (A synthetic, 150 .md, 14 section folders); R1 (A copy of a real room, 133 .md, 13 folders); R2 (A copy, 485 .md, 21 folders); syn-50, syn-150, syn-300 (B synthetic, 66, 166 and 316 .md, 14 sections, 50, 150 and 300 top-level content files); syn-150-s7 and syn-150-s28 (B, 7 and 28 sections); real-M (B copy, 147 .md, 17 sections, 25 top-level content files); real-L (B copy, 529 .md, 21 sections, 43 top-level content files). The source rooms were only read (A checked: 0 files modified). Room-derived raw output stays in the scratch directory and is not committed.
- Wall time: 2 or 3 runs per item. It is a lower bound for Windows and noisy (a parallel session ran; batches differed up to 1.6 times). Spawn counts did not change between passes.
- Claude Code semantics: read from the 2.1.296 bundle by A, by B, and by the merge settle check (entry X-1).

### Reconciliation of the two investigations

- Machine: A and B both PROVED aarch64. No conflict.
- Finding 2: A and B both PROVED that hooks.json timeout values are read as seconds. A cites the schema text "Timeout in seconds for this specific command" and the runner `nn=e.timeout?e.timeout*1000:au`. B cites the same schema text, 355.1-RESEARCH.md:128 and scripts/check-card-fire.cjs:960-975. The root cause is the unit error first. Windows process-tree kill semantics stay UNVERIFIED and come second; they are not needed to explain a 2,226 s run against a 10,000 s budget.
- Finding 6 halves: the SessionStart half (A) is a NEW FAILURE, narrow: the brain-prewarm subshell holds the hook pipes 14.8 s after exit; track-analytics (0.01 s) and check-update (0.06 s) are short. The Stop half (B) is WORKING as measured: on-stop:154 holds nothing after exit, because on-stop:401 `wait $(jobs -p)` reaps it. It is a latent defect: task T7 removes that wait, so T7 must also redirect on-stop:154. The live SubagentStop instance (on-agent-complete:147-153) is filed under Finding 4.
- Finding 6 conflict, settled with one check: A ASSUMED that Claude Code resolves a synchronous hook on 'exit'; B ASSUMED that it waits for 'close'. The settle check (X-1) read the 2.1.296 runner: it resolves on 'exit', then waits for stdout and stderr 'end' until 500 ms pass with no new output (cap 10,000 ms). A is right on timing: a silent holder costs about 0.5 s, not 15 s. B is right that the hold matters, for another reason: the capture is marked stdio-incomplete, and with invalid JSON (I-1) Claude Code refuses it.
- Finding 7: A and B agree that self-update is a no-op stub that exits 1. A counted 3 execs and 5 forks (about 30 ms); B counted 5 spawns (53 ms). Same result in different units.
- compute-state counts: A measured inside session-start in execs (SYN 1,861; R1 666; R2 1,047). B measured it standalone in spawns (syn-150 2,131; real-M 615). The generators and units differ. Both project to the report's 58 s for a room of about 140 .md (A R1 59 s; B real-M 55 s). No conflict.
- Finding 5 wording: the report's "about 61 node invocations inside session-start" equals A's process-tree count for R2 (61), not the direct count (34 to 35).
- Finding 3 projection: B's x0.089 projection for real-M (66 s) is above the report's 39 to 41 s; x0.062 gives 46 s. The calibrated factor fits better. Both are projections.

### Summary table

| Item | Report priority | Classification | One-line cause |
|---|---|---|---|
| F1 analyze-room in sync SessionStart | P0 | NEW FAILURE | Starts 4,902 to 7,873 processes per run, synchronously, before session-start prints; 80 to 89% of all SessionStart execs |
| F2 timeouts not enforced | P0 | NEW FAILURE (root cause re-stated) | hooks.json writes ms, Claude Code reads seconds (10000 = 2 h 46 min); 8 of 9 SessionStart scripts and on-stop have no whole-script deadline; Windows kill reach UNVERIFIED |
| F3 on-stop about 40 s | P0 | NEW FAILURE | Runs compute-state synchronously on every reply, plus a fixed 1 s wait floor from a broken killer subshell |
| F4 compute-state 58 s | P1 | NEW FAILURE | Forks F x (S - 1) greps plus about 13 per section; runs on SessionStart, Stop, SubagentStop, TaskCompleted, CwdChanged |
| F5 node fan-out | P1 | NEW FAILURE (cost) | 9 of 9 SessionStart groups start node; session-start starts node 34 to 35 times; 20 sites read one JSON field |
| F6 background subshells | P1 | SessionStart half NEW FAILURE (narrow); Stop half WORKING, latent defect | Subshell redirects only the inner command; brain-prewarm holds the pipes 14.8 s; scout-cadence holds them 6.3 s on its first run in 24 h (X-1 runtime check); on-stop:154 hidden by the line-401 wait |
| F7 sync auto-update | P1 | WORKING (no stall hazard; cosmetic defect) | self-update is a no-op stub; branch unreachable on 2.0.0-beta; prints a false failure line when reached |
| F8 brain-prewarm exit | P2 | NEW FAILURE (re-stated) | Race timer stays armed; process lives 15.1 to 20.2 s; it does exit |
| F9 intent-classifier stderr | P2 | Warning: KNOWN TRACKED BUG (doctor-auto-heal-qa-sweep-2026-09-16.md F12); cycle: NEW FAILURE | Require cycle makes BEHAVIORAL_CHANNEL_CEILING NaN in the hook process |
| F10 hmi-poll, send-event.ps1 | P2 | hmi-compliance-poll: NEW FAILURE (masked); send-event.ps1: ENV GAP | doctor rescans the plugin surface on every Stop; send-event.ps1 is not MindrianOS code |
| F11 plugin cache hygiene | P2 | ENV GAP | Claude Code owns the .tmp~ staging names and the 14-day orphan sweep |
| F12 registry status drift | P2 | NEW FAILURE | `status` duplicates `active`; only scripts/room-registry keeps them in step |
| Rich-tier rule | not ranked (report fix 6) | NEW FAILURE | Tier input /tmp/mindrian-context-state has no writer since 2026-04-05; tier is always rich; balanced also runs analyze-room |
| I-1 invalid JSON envelope | not in report | NEW FAILURE | escape_for_json leaves ANSI ESC bytes; stdout fails JSON.parse in 9 of 9 runs |
| X-1 I-1 with F6 in Claude Code 2.1.296 | not in report | NEW FAILURE, runtime CONFIRMED in effect; AND-mechanism REFUTED | The session-start context is dropped on every room session; invalid JSON alone causes it; the holder only selects the refusal message |
| X-2 additionalContext size cap | not in report | NEW FAILURE (runtime) | Claude Code 2.1.296 saves any hook additionalContext above 10,000 chars to a file and inlines a 2,407-char preview; session-start sends 21,881 |
| I-7 copied room drains into the source room | not in report | NEW FAILURE (runtime; found as a side effect) | graph-derive-queue.json stores an absolute roomDir; the SessionStart drain derives against it |
| I-2 analyze-room abort | not in report | NEW FAILURE (low) | set -euo pipefail ends analyze-room at line 923 on a file without `status:` |
| I-4 argv not env | not in report | NEW FAILURE (low) | An env assignment placed after `node -e` becomes argv at session-start:1499 |
| I-5 first-session coordinator | not in report | NEW FAILURE (seen in 369-HOOK-COLD-START.md observation 2, never filed) | First-session path runs 3 doctors and 4 server or shim starts synchronously (12.2 s) |
| I-6 reference-now fetch | not in report | NEW FAILURE (low) | Fetch with no AbortSignal keeps the seeder alive 10.6 s on a stalled endpoint |

### Entries

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: F1 analyze-room in the synchronous SessionStart path (report P0)
  classification: NEW FAILURE. No earlier seed, debug file or todo tracks analyze-room cost. SEED-128 is the first tracking item.
  checked: session-start rich and balanced tiers; analyze-room hot loops; spawn tracer and xtrace on SYN, R1, R2; one direct Git Bash run on the Windows side.
  file_line: scripts/session-start:524-539 (rich, call at :526) and :540-557 (balanced, call at :542); the report's line 523 moved by 3 lines. "Must complete in under 2 seconds" at scripts/analyze-room:5 and scripts/session-start:4. Hot loops: scripts/analyze-room:690-711 (convergence: basename plus a 7-stage pipeline per file, one `echo | grep -q` per term), :744-760 (contradictions), :791-825 (cross-references: one grep per file per other section, one `node -e` per edge), :835-850 (one `node wikilink-file.cjs` per source file).
  spawns: analyze-room alone, execs / forks: SYN 7,873 / 12,220 (125 node: 66 `node -e`, 59 wikilink-file); R1 6,261 / 10,135; R2 4,902 / 7,490. Deterministic over 2 passes. Share of all session-start execs: 80% SYN, 89% R1, 81% R2.
  wall_here_lower_bound: analyze-room alone 21.9 to 22.5 s (SYN), 10.8 to 11.8 s (R1), 9.0 to 9.6 s (R2), 3 runs each. Under xtrace inside session-start: 28.7 of 35.7 s (SYN), 10.5 of 17.2 s (R1), 9.0 of 19.1 s (R2). SYN by section: convergence 5.5 s, contradictions 1.6 s, cross-reference plus wikilink 14.4 s.
  windows_projection: x0.089: SYN 701 s, R1 557 s, R2 436 s. x0.062: SYN 488 s, R1 388 s, R2 304 s. Measured on the Windows side (not a projection): 85.0 s for a link-free 36 .md synthetic room (1,374 execs and 2.1 s on Linux). The report measured 489 s on a 136 .md room, inside the R1 range.
  found: R1 and R2 runs end early at analyze-room:923 (I-2), so their full cost is higher. On SYN, wikilink-file.cjs rewrites 59 room files inside the hook (NATIVE-03 design, I-3) and appends to the fixed path /tmp/analyze-room-wikilink.err.
  root_cause: analyze-room is a bash program that starts one or more processes per file, per section pair and per term, so its cost grows as files x sections x terms in process starts. session-start runs it synchronously before it prints its envelope, in every tier except minimal, and minimal is unreachable (rich-tier entry). It breaks its own 2 s budget on native Linux ARM64 (9 to 22 s). At 45 to 89 ms per start on Windows ARM64 Git Bash, 5,000 to 8,000 starts become 5 to 12 minutes.
  implication: the primary cause of the reported 489 s and, with F4, of the 2,226 s stall.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: Rich-tier rule (session-start:438-447; report recommended fix 6)
  classification: NEW FAILURE.
  checked: the tier input and every writer (repo-wide grep); 9 timed runs; a tier probe with a bridge file planted in the private /tmp.
  file_line: scripts/session-start:424-434 (input; `BRIDGE_FILE="/tmp/mindrian-context-state"` at :426), :438-447 (rule), :515-558 (tiers). The live writer is scripts/context-monitor:586-596 (~/.mindrian/bridge/<hash>.json). Commit 256560658 (2026-04-05, "migrate bridge files to per-room paths") moved the writer.
  spawns: R1 with ctx 80 (minimal): 763 execs, 870 forks (compute-state 666). R1 with ctx 50 (rich, venturist): 7,025 execs.
  wall_here_lower_bound: minimal tier exit at 4.4 s (with tracer).
  windows_projection: minimal tier x0.089 = 68 s; x0.062 = 47 s.
  found: CTX_PCT_INT = 0 in 9 of 9 runs (startup, clear, compact); every run reports "Context Tier: rich". Real rooms classify as venturist, which forces rich below 70. The balanced tier also runs analyze-room (:542).
  root_cause: the selector reads a file that no code writes since the bridge moved to per-room paths, so it always sees 0% and selects rich. A working selector would still not remove analyze-room, because balanced runs it too, and minimal still runs compute-state.

- timestamp: 2026-10-13T10:52:31Z
  source: investigators A and B
  item: F2 hook timeouts not enforced on Windows (report P0)
  classification: NEW FAILURE, root cause re-stated. The unit error is noted in-repo but not tracked as work: 355.1-RESEARCH.md:128 and :602, 369-HOOK-COLD-START.md:128-130, scripts/check-card-fire.cjs:960-975.
  checked: hooks/hooks.json; the Claude Code 2.1.296 binary (schema text and runner); every SessionStart and Stop script for a whole-script deadline.
  file_line: hooks/hooks.json:10, 22, 34, 46, 58, 70, 82, 94, 106 (SessionStart 120000, 12000, 10000, 10000, 5000, 2000, 2000, 5000, 8000); :143, 152, 161, 170, 179, 188, 197 (Stop, 3000 each); :206 (ambient-stop `"timeout": 5`, async; the only value in seconds); :471 (SubagentStop on-agent-complete 3000). scripts/measure-hook-cold-start.cjs:26-29 and :68-71 read values of 100 and up as ms. scripts/on-stop:18-19 and :352 say "3000ms hook timeout".
  spawns: not applicable.
  wall_here_lower_bound: not applicable. Declared values read as seconds: session-start 10,000 s (2 h 46 min), on-stop 3,000 s (50 min), reference-now-seed 5,000 s (83 min), check-pending-breakthrough 2,000 s (33 min).
  windows_projection: not applicable. Every duration in the report is below its declared value in seconds: 2,226 < 10,000; 41 < 3,000; 22.6 < 5,000; 28 < 2,000.
  found: binary schema text "Timeout in seconds for this specific command"; runner `nn=e.timeout?e.timeout*1000:au` (byte offset 218050841). On Windows the command runs through Git Bash with detached:false; on POSIX detached:true. Whole-script deadlines: gsd-graph-derive-drain detaches its child and exits (bounded); sessionstart-coordinator has a 1500 ms race per contributor that cannot preempt spawnSync; npm-reconcile and post-update-preflight bound their child only; session-start, reference-now-seed, check-pending-breakthrough, check-pending-ambiguous and agentshield have none. on-stop has none as a whole (only `timeout 8`, `timeout 0.4`, `timeout 3` on single steps and a broken 1 s killer).
  root_cause: first (PROVEN): hooks.json writes every budget in milliseconds, and Claude Code 2.1.296 reads the field as seconds, so each budget is 1000 times too long and no realistic stall reaches the kill. Second (PROVEN): 8 of 9 SessionStart scripts and on-stop have no whole-script deadline, so a slow child runs to completion. Third (UNVERIFIED): whether the Windows kill (group kill, then enumerated descendants) reaches bash.exe grandchildren; it is not needed to explain the 2,226 s run. ASSUMED: the user-side hook that Claude Code cancelled at 17.9 s with timeout 5 shows that the kill does work on Windows when the seconds expire.
  implication: a unit fix without tasks T1 and T7 makes Claude Code kill session-start before it prints (no room context) and kill on-stop mid-write.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator B
  item: F3 on-stop about 40 s per reply (report P0)
  classification: NEW FAILURE. SEED-125 tracks the on-stop line budget only, not wall time.
  checked: on-stop under the hook-runner harness, the LD_PRELOAD counter and xtrace on 5 rooms; the other 6 Stop hooks; the killer subshell with a jobs test.
  file_line: scripts/on-stop:144 (compute-state, synchronous), :151 (state-write.cjs), :263-272 (basename per section), :391-395 (`timeout 0.4` plus node per section with ROOM.md), :396-398 (comment "cap at about 1 s", false), :399 (`( sleep 1 && kill $(jobs -p) ... ) &`), :401 (`wait $(jobs -p)`), :408-523 (Phase 88 node block), :545 (guardian `timeout 3`).
  spawns: on-stop total / of which compute-state: syn-50 958 / 831; syn-150 2,258 / 2,131; syn-300 4,208 / 4,081; real-M 741 / 615; real-L 1,301 / 1,146. compute-state is 83% (real-M), 88% (real-L), 94% (syn-150) of on-stop spawns. on-stop's own spawns are about 2 x sections + 90 (126 to 155).
  wall_here_lower_bound: syn-50 4.5 to 4.7 s; syn-150 6.9 to 8.1 s; syn-300 10.4 to 11.2 s; real-M 4.2 to 4.5 s; real-L 5.2 to 6.5 s (3 runs each). xtrace on syn-150: compute-state 4.76 s (70%), killer plus wait 1.00 s (15%). The other Stop hooks take 33 to 190 ms each (hmi-compliance-poll in F10).
  windows_projection: x0.089 on spawns: syn-150 201 s, real-M 66 s, real-L 116 s. x0.062 on spawns: syn-150 140 s, real-M 46 s, real-L 81 s. The report measured 39 to 41 s on a 159 .md room.
  found: fixed 1 s floor: the parent job list includes the killer, so the wait lasts at least 1 s; inside the subshell `jobs -p` is empty, so the killer kills nothing (jobs test: 0.2 s jobs gave 1.03 s; 3 s jobs gave 3.02 s). Claude Code runs matching Stop hooks in parallel (355.1-RESEARCH.md C5), so on-stop sets the Stop wait.
  root_cause: on-stop recomputes STATE.md on every assistant reply by calling compute-state synchronously (on-stop:144), and that cost grows as files x sections (F4). The script adds a fixed 1 s wait (the killer bug) and 126 to 155 more spawns. Nothing bounds the whole script, and the declared 3000 means 50 minutes.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator B (session-start share from investigator A)
  item: F4 compute-state 58 s (report P1)
  classification: NEW FAILURE. Not tracked (.planning/debug/room-birth-compute-state-node-on-bash.md is a different defect).
  checked: compute-state standalone on 7 rooms with the LD_PRELOAD counter; every call site; on-agent-complete under the harness.
  file_line: scripts/compute-state:249-258 (scan_cross_refs: one `grep -qE` per file per other section), :260-266 (loop over `scaffold-predicate.cjs --list-content` from :239; non-recursive, lib/core/scaffold-predicate.cjs:208-212), :104-113, :136-165, :364-371 (about 13 spawns per section: basename, portable_find_mtime, `date -r` at :161, a `node -e` progress bar at :366), :38-73 (python3 registry read), :342-347 (ANSI Room Map, I-1). Call sites: session-start:450, on-stop:144, on-agent-complete:147-153, on-task-complete:51, on-cwd-changed:108, scripts/post-write:256 -> lib/core/intelligence-cascade.cjs:527 (30 s timeout), lib/core/state-ops.cjs:52, lib/mcp/stop-gate-handler.cjs:98.
  spawns: standalone (B): syn-50 831, syn-150 2,131, syn-300 4,081, syn-150-s7 997, syn-150-s28 4,399, real-M 615, real-L 1,146. Inside session-start (A, execs): SYN 1,861, R1 666, R2 1,047. Fit on all 7 rooms within 2%: spawns = F x (S - 1) + about 13 x S + about 5 (F = top-level content files, S = sections); grep = F x (S - 1) exactly on the synthetic rooms. on-agent-complete (SubagentStop): 2,387 spawns (syn-150) and 824 (real-M) after a recent .md change; 195 when idle.
  wall_here_lower_bound: real-M 2.1 to 2.2 s; real-L 3.2 to 3.3 s; syn-150 4.6 to 5.9 s; syn-300 8.8 to 10.0 s; syn-150-s28 10.0 to 10.7 s (3 runs each). Inside session-start under xtrace: 2.5 to 4.1 s.
  windows_projection: x0.089: real-M 55 s, R1 59 s, syn-150 190 s, syn-150-s28 392 s. x0.062: real-M 38 s, R1 41 s, syn-150 132 s. The report measured 58 s on a 136 .md room.
  found: cost depends on top-level content files and sections, not on total .md count (real-L, 529 .md, costs less than syn-150). on-agent-complete:147-153 runs `( sleep 1; compute-state ...; state-write ... ) &` with no redirect on the subshell, so the hook pipes stay open 3.1 to 6.2 s after a 0.25 s exit. on-agent-complete:64-75 runs 3 `$(echo | cut)` per line on all 20 lines with no break, which is 195 spawns on every SubagentStop, even when nothing changed. on-agent-complete:116-123 and :156 also hold stdout. The post-write cascade returns "skipped" for ~/MindrianRooms-style paths (lib/core/intelligence-cascade.cjs:182-184, :652-654); this needs a separate triage.
  root_cause: compute-state is a bash loop that forks one grep per (content file, other section) plus about 13 forks per section, so its process starts grow as F x (S - 1). It runs synchronously on SessionStart, Stop, TaskCompleted and CwdChanged, and on SubagentStop it runs in a subshell that keeps the hook pipes open. Each start costs 45 to 89 ms on the reporter's machine.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: F5 node fan-out at SessionStart (report P1)
  classification: NEW FAILURE (cost on Windows; behavior otherwise correct).
  checked: hooks.json SessionStart groups; PCRE grep of session-start non-comment lines; tracer node counts; node.exe start calibration on the Windows side.
  file_line: hooks/hooks.json:3-112 (9 groups; 8 start node directly; group 3 starts run-hook.cmd -> bash -> session-start). session-start has 51 node sites (40 `node -e`) at lines 57 59 115 144 150 178 221 408 415 416 417 418 421 422 430 480 497 499 500 501 502 565 566 567 586 587 618 621 759 761 762 763 838 924 1079 1274 1275 1417 1467 1469 1499 1518 1543 1592 1642 1708 1776 1893 1965 1978 1979. Single-field reads: `echo "$X" | node -e` at 416, 417, 418, 422, 497, 499, 500, 501, 502, 587, 761, 762, 763; file reads at 430, 565, 566, 567, 618, 838, 1467.
  spawns: direct node processes from session-start: 34 (SYN), 35 (R1), 35 (R2), of which `node -e` 23 to 24. Whole tree: 178 (SYN), 53 (R1), 61 (R2). Other groups: 1 to 2 node each in steady state (coordinator 8 on the first session). One SessionStart on R1: about 61 node processes plus about 7,000 other execs. Executed single-field reads in a room session: 6 always (416, 417, 418, 422, 587, 838), plus 1 when ~/.claude/settings.json exists (1467), plus 5 when the opportunity bank parses (497-502), plus 4 only with the dead bridge file.
  wall_here_lower_bound: not separated (about 40 ms per node start on Linux, B baseline).
  windows_projection: calibrated measurement on the Windows side: 154 to 164 ms per node.exe start, so 35 direct starts = 5.4 to 5.7 s and the 6 to 7 executed single-field reads = about 1 s. x0.089 gives 3.1 s and under-estimates node.
  root_cause: each JSON field and each helper is read by a fresh node process, and each hook group is its own node process, so one SessionStart pays node start-up 60 or more times. The cost is small next to F1 and F4, but it stays after they are fixed.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A (SessionStart half), investigator B (Stop and SubagentStop halves), merge settle check (X-1)
  item: F6 backgrounded subshells inherit the hook stdout (report P1)
  classification: SessionStart half NEW FAILURE, narrow (first seen in 369-HOOK-COLD-START.md:117-122 observation 1, never filed). Stop half WORKING as measured, with a latent defect. SubagentStop instance NEW FAILURE, filed under F4.
  checked: every background job in session-start, on-stop and on-agent-complete; process lifetimes under the tracer; pipe hold under timehook and the harness.
  file_line: scripts/session-start:594 (track-analytics; stdout not redirected), :1274-1275 (guardian subshell), :1327-1334 (sealed walker; 500 ms bound at :1337-1350), :1776 (scout-cadence subshell), :1842-1851 (check-update subshell; nothing redirected), :1965 (brain-prewarm subshell); :408 (sync-rooms-graph; fully redirected; holds nothing). scripts/on-stop:154 (track-analytics), :394 (recompile subshells), :399 (killer), :401 (wait). scripts/on-agent-complete:116-123, :147-153, :156. No job uses setsid, nohup or disown.
  spawns: lifetimes on R1: track-analytics 0.01 s (4 processes; exits early without ./room), check-update 0.06 s (12 processes; network blocked), guardian 0.09 to 0.11 s, sealed walker 0.02 s, scout-cadence 0.05 s, brain-prewarm 15.07 s.
  wall_here_lower_bound: SessionStart pipe hold after exit: 14.80 to 14.90 s in 9 of 9 runs on 3 rooms; 0.83 s with MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS=1000 (isolates brain-prewarm). Stop: close minus exit = 0 ms in 25 of 25 runs on 5 rooms. SubagentStop: 3.1 to 6.2 s.
  windows_projection: track-analytics at most 4 x 0.089 = 0.4 s; check-update about 12 x 0.089 = 1.1 s plus up to 3 s of curl once a day (ASSUMED from counts); brain-prewarm 15 to 20 s on every platform (timer-bound).
  found: X-1 shows that Claude Code 2.1.296 waits at most about 500 ms of output silence after exit, so a silent holder costs about 0.5 s of hook wait, not 15 s. The hold also marks the capture stdio-incomplete, which matters together with I-1. Harnesses that wait for EOF (scripts/measure-hook-cold-start.cjs, spawnSync callers) wait the full hold.
  root_cause: bash `( cmd >/dev/null 2>&1 || true ) &` redirects only cmd, not the subshell, so the subshell holds the hook pipes until cmd ends; track-analytics and the check-update subshell redirect only stderr or nothing. The only long holder at SessionStart is brain-prewarm (F8). on-stop:154 is hidden today by the on-stop:401 wait, which task T7 removes.

- timestamp: 2026-10-13T10:52:31Z
  source: investigators A and B
  item: F7 synchronous auto-update inside session-start (report P1)
  classification: WORKING (no stall hazard). Cosmetic defect: a dead branch prints a false failure line.
  checked: the cached branch in session-start; scripts/self-update; scripts/check-update; one probe with a planted UPDATE_AVAILABLE cache and consent flag inside the sandbox.
  file_line: scripts/session-start:1810-1838 (cached branch; `"${SCRIPT_DIR}/self-update" install` at :1825), :710-714 (FIRST_INSTALL creates ~/.mindrian/auto-update); scripts/self-update:44-105 (no-op stub since 2026-04-26, v1.10.19); scripts/check-update:28 (parses X.Y.Z headings only).
  spawns: 3 execs and 5 forks (A); 5 spawns (B).
  wall_here_lower_bound: about 30 ms (A); 53 ms (B).
  windows_projection: x0.089 = about 0.4 s.
  found: the context then says "Auto-update failed -- run /mos:update manually." check-update reads 1.15.3 as the latest version and reports UP_TO_DATE for every 2.0.0-beta install, so the branch is unreachable unless an older cache remains. check-update runs in the background once a day with `curl --max-time 3`.
  root_cause: no stall cause. The branch calls a stub that cannot install anything and always reports a failure. A separate low defect: check-update ignores pre-release headings.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: F8 brain-prewarm never exits on timeout (report P2)
  classification: NEW FAILURE, re-stated: it exits, but never before 15 s. First seen in 369-HOOK-COLD-START.md:117-122 (observation 1), untracked.
  checked: three lifetimes in the sandbox with a fake HOME: refused origin (127.0.0.1:9), stalled origin (TCP accept, no reply), stalled origin with MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS=1000.
  file_line: lib/core/brain-prewarm.cjs:131-137 (race; the losing setTimeout is never cleared or unref'd), :160-162 (`prewarm().catch(() => {})`, no process.exit); lib/core/brain-client.cjs:48 (20 s per-request AbortSignal).
  spawns: 1 node process.
  wall_here_lower_bound: refused origin 15.1 s; stalled origin 20.2 s; stalled origin with a 1000 ms race 20.2 s (the race does not bound the process).
  windows_projection: the same 15 to 20 s (timer-bound, not spawn-bound) plus one node.exe start (0.15 to 0.16 s calibrated).
  found: the process prints a SQLite ExperimentalWarning to stderr. The report's marker (ok:true at 09:10:37.178Z) fits a probe that settles fast while the timer keeps the process alive. Canon Part 8: the probe is a content-free theo_health; it failed locally in the sandbox.
  root_cause: the 15 s race timer stays armed after the race and keeps the event loop alive, and a pending probe keeps it alive up to brain-client's 20 s request timeout. The process lives max(15 s, probe) on every start, and the session-start subshell holds the hook pipes for that time (F6).

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: F9 intent-classifier stderr noise (report P2)
  classification: the SQLite ExperimentalWarning is a KNOWN TRACKED BUG (pattern): .planning/debug/doctor-auto-heal-qa-sweep-2026-09-16.md F12 (Change 12), status investigating, scope doctor.cjs only. The require cycle is a NEW FAILURE with a functional effect.
  checked: a UserPromptSubmit payload through hooks/run-hook.cmd intent-classifier on Node v22.23.1 (the reporter's version); a require-trace preload.
  file_line: lib/core/navigation-engine.cjs:42 (requires folder-memory), :126 (RECOMMENDED_CONFIDENCE_FLOOR defined), :2015 (exported), :98-105 (comment on the same NaN pattern, fixed for calibration-gate only). Cycle: navigation-engine.cjs -> lib/core/folder-memory.cjs -> lib/core/feynman/timeline-runner.cjs -> lib/core/feynman/timeline-renderer.cjs -> lib/core/navigation.cjs -> lib/core/navigation/calibration-log.cjs:32 -> lib/workflow/f-selector-ranker.cjs:138 (reads the constant), :141 (BEHAVIORAL_CHANNEL_CEILING) -> navigation-engine.cjs (exports not yet assigned).
  spawns: 1 node process per prompt.
  wall_here_lower_bound: 0.38 s; 3 stderr lines in every run.
  windows_projection: one node.exe start, 0.15 to 0.16 s calibrated. The report measured 1.2 to 5.2 s per prompt (not decomposed here).
  found: in the intent-classifier load order, BEHAVIORAL_CHANNEL_CEILING is NaN instead of 0.85. In the other load order, calibration-log reads two band constants from a half-loaded ranker. The downstream ranking effect is UNVERIFIED.
  root_cause: a second, longer require path re-enters navigation-engine before it assigns module.exports, so module-level constants read as undefined. The warning half is the known SQLite experimental-feature pattern.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator B
  item: F10 hmi-compliance-poll 4.1 s on a Stop; send-event.ps1 per Stop (report P2)
  classification: hmi-compliance-poll: NEW FAILURE (P2, masked today by on-stop). send-event.ps1: ENV GAP (user-side, not MindrianOS).
  checked: 4 runs of hmi-compliance-poll with real-M active; file-read counts; git ls-files, git grep, `npm pack --dry-run --json --ignore-scripts` on the HEAD copy, hooks.json and the installed caches for send-event.ps1.
  file_line: scripts/hmi-compliance-poll.cjs:20 (budget "< 250ms warm"), :96-104 (spawnSync `node scripts/doctor.cjs --ui-compliance --json`, timeout 5000 ms), :251-263 (tier-0 skip); lib/hmi/tier-check.cjs:41-47 (never returns 0, so the skip never fires).
  spawns: 1 child spawn, 2 node processes in total. File reads: doctor 461 readFileSync and 7 readdirSync; poll 99 readFileSync.
  wall_here_lower_bound: 230 to 292 ms; doctor scan 180 ms.
  windows_projection: x0.089 spawn-only = 0.09 s, which does not explain 4.1 s. ASSUMED: 2 node.exe starts (about 0.3 s calibrated) plus about 560 file reads under Defender.
  found: send-event.ps1 is absent from git (0 .ps1 files), from the npm tarball (0 of 2,296 entries), from hooks.json (no PowerShell command) and from the installed caches (beta.53, beta.57, beta.59). Its source is another enabled plugin or a user hook (UNVERIFIED; wt-agent-hooks by name, ASSUMED).
  root_cause: hmi-compliance-poll spawns doctor to rescan the plugin's own commands and scripts on every Stop, although that surface changes only with the plugin version, and its tier-0 skip never fires. It runs in parallel with on-stop, so after task T7 it can become the slowest Stop hook on Windows.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator B
  item: F11 plugin cache hygiene (report P2)
  classification: ENV GAP (Claude Code platform behavior). lib/core/cache-prune.cjs is WORKING as designed but would not remove the owner's two directories.
  checked: Claude Code 2.1.296 binary strings; MindrianOS update and prune code; ~/.claude/plugins (read-only).
  file_line: lib/core/cache-prune.cjs:85-160 (keeps the active version plus 2 non-active directories; counts a .tmp~ directory as a version slot); lib/core/doctor/deployment-surfaces-module.cjs:308-324; scripts/post-update-activation.cjs:183-187; scripts/self-update:44-105 (stub, exits 1); commands/update.md:235 (delegates to `claude plugin update`).
  spawns: not applicable.
  wall_here_lower_bound: not applicable.
  windows_projection: not applicable.
  found: Claude Code names staging directories `<version>.tmp~<8 hex>` and deletes a version directory 14 days after it writes `.orphaned_at`, unless a live session uses it (binary strings; timing ASSUMED from minified code). This machine: 3 version directories, 1,144 MB; 2 stale (619 MB), both inside the 14-day window; 0 .tmp~ directories. Another plugin shows the same pattern (10 version directories, 9 orphaned). Each version directory is about 525 MB because the per-machine loader installs node_modules into it.
  root_cause: Claude Code creates and removes these directories, not MindrianOS. The MindrianOS prune helper keeps 2 non-active slots and counts .tmp~ as a slot, so on the owner's layout it removes nothing.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: F12 registry rooms with status active while `active` names another room (report P2)
  classification: NEW FAILURE (not tracked; searched debug, seeds, knowledge-base).
  checked: the registry on this machine (read once, read-only); every writer of `active` and `status`.
  file_line: registry path from scripts/resolve-room:47-52 and lib/core/room-open.cjs. Writers that keep both fields in step: scripts/room-registry new (:405-415), set-active (:629-638), archive (:706-712). Writers that change `active` or entries without `status`: lib/core/navigation/room-birth.cjs:657, lib/core/room-discard-cascade.cjs:157, lib/core/room-naming-selector.cjs:265, scripts/resolve-room:144-178, scripts/on-cwd-changed:95 (unreachable from the hook). Consumers: scripts/session-start:616-644, scripts/room-registry list (:544).
  spawns: not applicable.
  wall_here_lower_bound: not applicable.
  windows_projection: not applicable.
  found: 55 registry rooms; status parked 55, active 0; the `active` field names a room whose status is parked (the report's disagreement in the opposite direction). 38 room folders on disk, 7 not in the registry; 0 registry paths missing. Which writer produced this state is UNVERIFIED.
  root_cause: `status: active` duplicates the `active` field, several writers change one without the other, and the park step parks only the room that `active` names. Any drift therefore stays.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: I-1 session-start prints invalid JSON (not in report)
  classification: NEW FAILURE.
  checked: JSON.parse on session-start stdout in 9 timed runs (SYN, R1, R2).
  file_line: scripts/session-start:1870-1878 (escape_for_json escapes only backslash, quote, \n, \r, \t). ESC producers: scripts/compute-state:342-347 (ANSI Room Map since 86c03a565, 2026-03-26); scripts/analyze-room:802-805 and :817-820 with lib/core/visual-ops.cjs:153-154 (ANSI in formatEdge).
  spawns: not applicable.
  wall_here_lower_bound: JSON.parse fails in 9 of 9 runs with "Bad control character in string literal". ESC (0x1b) bytes: 132 on SYN (analyze-room EDGE lines), 8 on R1 and 10 on R2 (compute-state Room Map).
  windows_projection: platform-independent.
  root_cause: escape_for_json does not escape control characters U+0000 to U+001F other than \n, \r and \t, and two producers write ANSI color codes into a pipe. The envelope is therefore invalid JSON on every room session that prints a Room Map. Without X-1, Claude Code treats the stdout as plain text (ASSUMED from the docs) and systemMessage is lost.

- timestamp: 2026-10-13T10:52:31Z
  source: merge settle check (one read-only check of /home/jsagi/.local/share/claude/versions/2.1.296 with python mmap; nothing executed)
  item: X-1 Claude Code 2.1.296 hook settle behavior and its interaction with I-1 and F6 (not in report)
  classification: NEW FAILURE (interaction). PROVEN by code reading. Runtime effect UNVERIFIED.
  checked: the command-hook runner, the stream settle helper and the capture validator in the 2.1.296 binary.
  file_line: plugin side: scripts/session-start:1965 (holder), :1870-1878 (invalid JSON). Claude Code side, byte offsets in the binary: command runner near 218050841 (`nn=e.timeout?e.timeout*1000:au`; `Eo.on("exit", ...)` then `await nbt({streamsSettled, lastDataAt, holdOpen})`); settle helper `nbt` near 215643060 (`quietWindowMs=500`, `capMs=1e4`); validator `tbt` directly after it.
  spawns: not applicable.
  wall_here_lower_bound: not applicable.
  windows_projection: not applicable.
  found: (1) Claude Code resolves a synchronous command hook on 'exit', then waits for stdout and stderr 'end' until 500 ms pass with no new output (cap 10,000 ms); it does not wait for 'close'. (2) If the streams did not end, the result carries stdioIncomplete:true. (3) The validator then refuses a capture whose stdout starts with "{" but does not parse, with the text "hook output opens a JSON payload that never completed before its stdio went quiet; refusing to read the partial capture as a verdict". (4) A capture that parses, carries hookSpecificOutput.additionalContext, exits 0 and is a SessionStart event passes the benign test and is kept. (5) The report's timeline agrees with (1): the brain-prewarm marker (09:10:37.178Z) and the hook end (2,226.2 s after 08:33:31) are within about 0.5 s; a wait for 'close' would end about 15 s later.
  root_cause: brain-prewarm keeps the session-start pipes open past the 500 ms window (F6, F8), so Claude Code marks the capture stdio-incomplete, and the capture is also invalid JSON (I-1). Together these meet the refusal condition, so Claude Code 2.1.296 probably discards the session-start room context on every room session. A fix to either I-1 or the F6 holder removes the condition.
  implication: confirm with one live Claude Code session on a room copy, or with the session-start hook record in the owner's transcript, before a claim of context loss.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: I-2 analyze-room aborts on real rooms (not in report)
  classification: NEW FAILURE (low).
  checked: xtrace of analyze-room on R1 and R2.
  file_line: scripts/analyze-room:513 (`set -euo pipefail`), :923 (`status=$(grep -m1 '^status:' "$f" | sed | tr | xargs)`); the same pattern at :943-944, :963-964, :987, :992.
  spawns: included in the F1 counts for R1 and R2.
  wall_here_lower_bound: exit 1 on R1 and R2. Output stops after "## Opportunity Bank"; the capability lines and "## End" are missing. session-start hides it (`2>/dev/null || echo ""`).
  windows_projection: platform-independent (it truncates the output and the cost).
  root_cause: an opportunity-bank file without a `status:` line makes grep exit 1, and pipefail with set -e ends the script. session-start injects the truncated analysis without a sign.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: I-4 wrong env passing at session-start:1499 (not in report)
  classification: NEW FAILURE (low).
  checked: the code line and a one-line node test.
  file_line: scripts/session-start:1499 (`node -e '...' PLUGIN_ROOT_FOR_RESOLVE="$PLUGIN_ROOT_FOR_NODE"`), :1500-1504 (dev-clone pre-commit install).
  spawns: 1 node process per SessionStart.
  wall_here_lower_bound: not applicable. PROVEN: `node -e 'console.log(process.env.X)' X=1` prints undefined.
  windows_projection: one node.exe start, 0.15 to 0.16 s calibrated.
  root_cause: the assignment comes after the command, so bash passes it as argv, not as env. The topology probe always returns not-found, and the dev-clone pre-commit install never runs.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: I-5 first-session coordinator path takes 12.2 s (not in report)
  classification: NEW FAILURE. First seen in 369-HOOK-COLD-START.md:123-127 (observation 2), never filed as work.
  checked: scripts/sessionstart-coordinator.cjs with and without a statusLine block in ~/.claude/settings.json (fake HOME).
  file_line: scripts/sessionstart-coordinator.cjs:51, :75-87, :121-129 (1500 ms race per contributor; spawnSync contributors cannot be preempted), :231, :235 (process.exit).
  spawns: first session: 8 node processes (3 sequential doctor.cjs runs, 2 MCP server starts, 2 Brain shim starts, plus the coordinator) and 2 `claude --version` children. Steady state: 1 node process.
  wall_here_lower_bound: 12.2 s on the first session; 0.29 to 0.31 s in steady state (3 runs).
  windows_projection: x0.089 on 10 processes = 0.9 s, spawn-only. ASSUMED larger, because doctor and server start work dominate, not the spawn count.
  root_cause: the first-session path runs doctor and MCP or shim probes synchronously inside a SessionStart hook, and the per-contributor race cannot preempt spawnSync.

- timestamp: 2026-10-13T10:52:31Z
  source: investigator A
  item: I-6 reference-now-seed blocks on the network (not in report)
  classification: NEW FAILURE (low).
  checked: the seeder with the time endpoint refused, and with it stalled (hosts entry to a local accept-and-hold listener in a private network namespace).
  file_line: lib/core/temporal/reference-now.cjs:197 (fetch with no AbortSignal, not awaited); the header of scripts/sessionstart-reference-now-seed.cjs says it "must never block on the network", which is false.
  spawns: 1 node process.
  wall_here_lower_bound: 0.18 s offline (refused); 10.6 s with a stalled endpoint in 2 of 2 runs.
  windows_projection: network-bound and platform-independent. ASSUMED: a contributor to the report's 22.6 s.
  root_cause: the pending fetch keeps node alive until the socket gives up, and the fetch repeats on every session while no offset is recorded.

- timestamp: 2026-10-13T11:19:46Z
  source: X-1 runtime check (one gsd-debugger agent; read-only for the plugin code)
  item: X-1 runtime check (confirm or refute X-1 in a live Claude Code 2.1.296 session)
  classification: X-1 effect CONFIRMED at runtime (NEW FAILURE). The X-1 AND-mechanism is REFUTED: I-1 alone is sufficient.
  method: method 1 (strongest available). `claude -p` 2.1.296 with `--plugin-dir` on a scratch plugin copy (`git archive` of 6f9b0d1db plus a byte copy of node_modules), cwd = a scratch copy of a real room (pseudonym X1R, 147 .md, read through a scratch registry in MINDRIAN_ROOMS_HOME), `env -i` with a fresh scratch HOME per run, MINDRIAN_BRAIN_URL=http://127.0.0.1:9, MINDRIAN_BRAIN_KEY unset, `--tools ""`, `--strict-mcp-config` with an empty server list, `--model sonnet --effort low`, `--output-format stream-json --verbose --include-hook-events`, `--debug-file`. The room copy and the scratch registry were restored before each run. Records read: stream-json hook_response events, the debug log, and the session transcript JSONL (hook attachments). Controls: scratch copies of the plugin with one or two lines of scripts/session-start changed (never the dev tree). Pipe hold measured outside Claude Code with a spawn harness (exit time, stdout and stderr 'end', 'close', and the processes that hold the hook socket at exit + 600 ms and + 3,000 ms). Canon Part 8: no Brain call left the machine (refused loopback origin; no tools; no MCP servers). Room-derived output stays in the scratchpad, not in git.
  runs (session-start hook only; model probe in the last column):
    - A (HEAD): stdout 22,811 chars, 32 ESC bytes, node JSON.parse FAIL at char 4110. Claude Code: hook_response outcome "error", exit_code 0, stderr "hook output opens a JSON payload that never completed before its stdio went quiet; refusing to read the partial capture as a verdict". Transcript: attachment hook_non_blocking_error, durationMs 8902. SessionStart hook_additional_context = 1,021 chars (agentshield 104 + coordinator 917 only). Probe (tail heading NAVIGATION CARD-FIRE CONTRACT): "OK NO".
    - A2 (HEAD, second probe): same refusal; durationMs 9257; context 1,021 chars. Probe (head text "You are Larry"): "OK NO".
    - ctrl-prewarm (brain-prewarm subshell redirected as a whole): same refusal text; durationMs 9371; context 815 chars. Probe tail: "OK NO".
    - ctrl-detach (brain-prewarm and scout-cadence subshells redirected; ANSI kept; harness hold 0 ms): Claude Code outcome "error", stderr "Hook output looks like a JSON object but is not valid JSON - JSON Parse error: Unterminated string. Emit the payload with a JSON encoder (jq, ConvertTo-Json, json.dumps) rather than string concatenation so backslashes and quotes inside strings are escaped." (the original has an em-dash where this file has " - "). Transcript hook_non_blocking_error, durationMs 8867; context 815 chars. Probe tail: "OK NO".
    - ctrl-ansi (ANSI CSI and other C0 bytes stripped before escape_for_json; holders kept): stdout 22,475 chars, 0 ESC, JSON.parse OK. Claude Code: outcome "success", debug "Hook SessionStart (Loading room context...) provided additionalContext (21881 chars)", durationMs 9006. Probe tail: "OK NO" (see X-2).
    - ansi2 (same plugin as ctrl-ansi, head probe): success, 21,907 chars provided, durationMs 10175. Probe head: "OK YES".
    - ctrl-both (ANSI stripped and brain-prewarm redirected): success, 21,881 chars provided, durationMs 11043. Probe tail: "OK NO".
  debug_log_lines (run A; plugin path shortened to $P): `Hooks: SessionStart:startup ["$P/hooks/run-hook.cmd" session-start] (plugin mos@inline) finished with status 0 (8902ms)`, then the "not valid JSON" line above, then `[ERROR] "Hook SessionStart:startup (SessionStart) error: status code 0\nstdout:\n{...`. No "provided additionalContext" line exists for session-start in runs A, A2, ctrl-prewarm and ctrl-detach.
  pipe_hold (harness, same env, outside Claude Code): HEAD exit 8,704 ms, close 23,602 ms, hold 14,898 ms (brain-prewarm). ctrl-prewarm hold 6,319 / 6,399 / 6,321 ms in 3 of 3 runs; holder at + 600 ms and + 3,000 ms = a session-start subshell whose children are `node $P/scripts/scout-cadence-runner.cjs $ROOM` and a `node -e` that requires lib/core/rs-engine.cjs. ctrl-detach hold 0 ms (exit 8,721 ms = close 8,721 ms).
  timing: Claude Code session-start hook duration 8.9 to 11.0 s on this 147 .md room (Linux ARM64). The first prompt waited for the slowest SessionStart group, the coordinator first-session path: 11,896 ms (I-5); every run used a fresh HOME.
  file_line: plugin side: scripts/session-start:1870-1878 (escape_for_json), :1965 (brain-prewarm), :1776 (scout-cadence). Claude Code 2.1.296 binary: refusal selector `tbt` (returns no refusal when neither stdioIncomplete nor stdioClosedWithoutEnd is set) in the source near byte offset 0xcda7400; executor branch: a refusal from `lwt` yields hook_non_blocking_error for SessionStart (SessionStart is not in the blocking set `Kge`); otherwise a JSON validation error yields hook_non_blocking_error too.
  found: (1) The context is dropped whenever stdout is invalid JSON: 4 of 4 runs with ESC bytes, with or without a holder. (2) The holder only decides which refusal fires: stdio-quiet refusal with a holder longer than the 500 ms quiet window, JSON-validation error without one. (3) Valid JSON is accepted with the holders still running (ctrl-ansi), because a parsed benign SessionStart document passes `obt`. (4) Weaker evidence, the owner's own transcripts under ~/.claude/projects (installed plugin 2.0.0-beta.37 to beta.59, Claude Code 2.1.216 to 2.1.296, 2026-09-14 to 2026-10-13): 234 session-start hook records. 139 are hook_non_blocking_error, and all 139 have ESC bytes and invalid JSON (61 JSON-validation errors on Claude Code 2.1.268 to 2.1.284; 78 stdio-quiet refusals on 2.1.285 to 2.1.296; 10 of 10 records on 2.1.296 are refusals). 92 are hook_success with valid JSON and 0 ESC; in all 92 the following hook_additional_context is a persisted-output preview (X-2). 3 are hook_success with invalid JSON, all on Claude Code 2.1.216 (older plain-text handling). So on Claude Code 2.1.268 and later, 0 of 231 records put the full session-start context inline.
  root_cause: escape_for_json passes ESC bytes from the compute-state Room Map and analyze-room EDGE lines into the JSON string (I-1). Claude Code refuses an invalid JSON object on SessionStart and never uses its text as context (seen on every version from 2.1.268, the first version after 2.1.216 in the sample; 2.1.216 still read it as plain text). Since 2.1.285 a held pipe changes the refusal message, not the outcome.
  implication: T14 is the necessary and sufficient fix for the drop; rank it P0 with T1. T13 alone restores nothing (it is still needed for the pipe hold and for Windows timing). T14's acceptance must also run one live `claude -p --plugin-dir` session and find "provided additionalContext" for session-start in the debug log. After T14, X-2 still limits what the model sees.

- timestamp: 2026-10-13T11:19:46Z
  source: X-1 runtime check
  item: X-2 Claude Code 2.1.296 caps each hook additionalContext at 10,000 chars (not in report)
  classification: NEW FAILURE (runtime). Claude Code platform limit, so it is a plugin design constraint, not a Claude Code defect.
  checked: transcripts of ctrl-ansi, ansi2 and ctrl-both; the 2.1.296 binary.
  file_line: binary: `async function dce(e,n,r,{threshold:s=vRs,...}){if(e.length<=s)return e; ... _4(e,\`hook-${n}-${r}\`...)` with `vRs=1e4`; called for every hook additionalContext, systemMessage and stdout. Plugin: scripts/session-start builds a 21,881 to 21,907 char context on X1R; the NAV_CARD_FIRE_DOCTRINE block is appended last (session-start, the line before escape_for_json).
  found: the SessionStart hook_additional_context item for session-start is 2,407 chars: a `<persisted-output>` block that says "Output too large (21.4KB). Full output saved to: <session dir>/tool-results/hook-<uuid>-8-additionalContext.txt" followed by a preview of the first part. The head text reached the model (probe YES); the tail doctrine did not (probe NO in 2 of 2). The owner's transcripts show the same preview in 92 of 92 valid-JSON session-start records (Claude Code 2.1.270 to 2.1.291).
  root_cause: session-start emits one context block more than 2 times the per-hook inline limit, and it puts the session doctrine at the end.
  implication: proposed task T23 (below). The SEED-128 fix plan (T1 cached injection) must also keep the block under 10,000 chars, or the model reads only the first 2 KB.

- timestamp: 2026-10-13T11:19:46Z
  source: X-1 runtime check (side effect found during the check)
  item: I-7 a copied room drains into its source room (not in report)
  classification: NEW FAILURE (runtime). Affects every QA or test procedure that copies a room and runs SessionStart hooks, and any moved or renamed room.
  checked: a byte diff of the source room against the pre-run copy; read-only snapshots of both room.db files compared with sqlite (immutable mode).
  file_line: scripts/gsd-graph-derive-sweep.cjs:156 writes `{ roomDir: <absolute resolved path>, enqueued_at }` into <room>/.mindrian/graph-derive-queue.json; scripts/gsd-graph-derive-drain.cjs:426 and :440 take `entry.roomDir` as the derivation target instead of the room that owns the queue (runDerivation at :468-474).
  found: the X1R copy carried a queue entry (enqueued 2026-07-08) with the absolute source path. In 4 of the 7 headless runs (11:08:19Z, 11:09:33Z, 11:14:59Z, 11:17:21Z) the SessionStart drain wrote 1 memory_event node (event_type derivation_skipped, reason encoder_unavailable, pairs_skipped 1431, created_by system, no room text) and 1 room_change_log row into the SOURCE room.db: nodes 801 to 805, room_change_log 6 to 10. The empty room.db-wal and the room.db-shm files of the source room were removed (checkpoint), and room.db grew from 3,350,528 to 3,354,624 bytes. No other source file changed. The other 3 runs added no row (dedupe, ASSUMED). The encoder was unavailable only because HOME was a scratch directory; with the real HOME the drain would write proposed edges into the source room (ASSUMED).
  root_cause: the derive queue stores an absolute path, and the drain trusts it.
  implication: proposed task T24 (below). The source room.db needs a restore decision (pre-run byte copy kept in the scratchpad; the main session holds the path).

## Eliminated

- hypothesis: "Claude Code cannot enforce hook timeouts on Windows" is the reason the 10 s budget did not stop session-start.
  evidence: the budget was never 10 s. Claude Code 2.1.296 reads 10000 as 10,000 s (schema text and `timeout*1000`). Every reported duration is below its declared value in seconds. The Windows kill reach to grandchildren stays UNVERIFIED but is not needed (A, B).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: hooks.json timeout values are milliseconds.
  evidence: the 2.1.296 schema says seconds; Phase 241 (check-card-fire.cjs:960-975) and 355.1 research say the same (B).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: a change of the rich-tier threshold alone removes analyze-room from startup.
  evidence: balanced also runs analyze-room (session-start:542); the tier input has no writer; real rooms are venturist, which forces rich (A).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: the synchronous auto-update can stall startup.
  evidence: self-update is a no-op stub (3 execs, about 30 to 53 ms); check-update cannot return UPDATE_AVAILABLE on 2.0.0-beta (A, B).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: brain-prewarm never exits.
  evidence: it exits after 15.1 s (refused origin) or 20.2 s (stalled origin) (A).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: a background job that holds the pipe caused the 37-minute stall.
  evidence: the only post-exit holder at SessionStart is brain-prewarm (15 to 20 s), and Claude Code 2.1.296 waits at most about 0.5 s of silence after exit (X-1); the foreground script is the cost, as the report also found (A, X-1).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: Claude Code waits for pipe 'close' before it resolves a synchronous hook.
  evidence: the 2.1.296 runner resolves on 'exit' and then waits for stream 'end' with a 500 ms quiet window and a 10,000 ms cap (X-1).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: track-analytics and the check-update subshell hold the SessionStart pipe for long.
  evidence: lifetimes 0.01 s and 0.06 s here (A).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: on-stop:154 keeps the Stop pipe open after on-stop exits.
  evidence: close minus exit = 0 ms in 25 runs on 5 rooms; on-stop:401 always reaps the job, and memory-lifecycle stop creates .mindrian, so line 401 always runs (B).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: the on-stop killer subshell caps the recompile wait at about 1 s.
  evidence: `jobs -p` is empty in the subshell; a 3 s job made the wait 3.02 s (B).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: the six other node Stop hooks add material Stop time.
  evidence: 0 to 1 spawns and 33 to 190 ms each here; they run in parallel with on-stop (B).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: analyze-room is slow only on Windows.
  evidence: 9.0 to 22.5 s on native Linux ARM64, 4.5 to 11 times its 2 s budget (A).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: compute-state cost scales with the total .md count.
  evidence: it scales with top-level content files x (sections - 1); real-L (529 .md) costs less than syn-150 (166 .md) (B).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: the cost pattern is an artifact of the synthetic fixtures.
  evidence: real-room copies show the same pattern (R1 6,261 and R2 4,902 analyze-room execs; real-M and real-L follow the compute-state fit) (A, B).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: (X-1 mechanism) the session-start context is dropped only when stdout is invalid JSON AND a background job holds the pipes past the 500 ms quiet window.
  evidence: with both holders detached (harness hold 0 ms) and ANSI kept, Claude Code 2.1.296 still dropped the context with a JSON-validation error (run ctrl-detach). Invalid JSON alone is sufficient (X-1 runtime check).
  timestamp: 2026-10-13T11:19:46Z
- hypothesis: a fix to the F6 holder alone (T13 or T5) restores the session-start context.
  evidence: runs ctrl-prewarm and ctrl-detach: refused in 2 of 2; the model probe answered NO (X-1 runtime check).
  timestamp: 2026-10-13T11:19:46Z
- hypothesis: brain-prewarm is the only long post-exit holder of the SessionStart pipes.
  evidence: with brain-prewarm redirected, the scout-cadence subshell held the pipes 6.3 to 6.4 s after exit in 3 of 3 harness runs (first run in 24 h for the room) (X-1 runtime check).
  timestamp: 2026-10-13T11:19:46Z
- hypothesis: once stdout is valid JSON (T14), the full session-start context reaches the model.
  evidence: Claude Code 2.1.296 inlines at most 10,000 chars per hook additionalContext; the 21,881-char context became a 2,407-char preview plus a file; the tail heading probe answered NO in 2 of 2 (X-2).
  timestamp: 2026-10-13T11:19:46Z
- hypothesis: hmi-compliance-poll cost is spawn-bound.
  evidence: 1 child spawn; its cost is node start plus about 560 file reads (B).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: send-event.ps1 ships with MindrianOS.
  evidence: absent from git, the npm tarball, hooks.json and the installed caches; no PowerShell call in plugin code (B).
  timestamp: 2026-10-13T10:52:31Z
- hypothesis: MindrianOS creates the .tmp~ and old version directories.
  evidence: the naming and the 14-day orphan sweep are in Claude Code 2.1.296 (B).
  timestamp: 2026-10-13T10:52:31Z

## Technical Root Cause

- Site 1: scripts/session-start:450 (compute-state) and :524-557 (analyze-room), synchronous, before the envelope prints. Cost sites: scripts/analyze-room:690-850 and scripts/compute-state:249-266.
- Site 2: scripts/on-stop:144 (compute-state on every reply) and :399-401 (1 s wait floor).
- Site 3: scripts/session-start:424-447 (tier rule reads /tmp/mindrian-context-state, which has no writer).
- Site 4: hooks/hooks.json (every timeout value in ms; Claude Code reads seconds) and the absence of a whole-script deadline in 8 of 9 SessionStart scripts and in on-stop.
- Cause: per-file, per-section-pair and per-term process starts in two bash programs on the synchronous hook path, with no working bound.
- Why it surfaces now: Windows ARM64 with x64 Git Bash raises the cost of each process start to 45 to 89 ms; rooms of 130 to 160 .md reach 6,000 to 10,000 starts; the tier selector has had no input since commit 256560658 (2026-04-05). The first bad version was not bisected.

## Required Code Changes

See Resolution > Proposed /gsd-quick tasks. Each task names its files, its required behavior and a measurable acceptance. Do not apply them in this session (goal find_root_cause_only).

## Tests to Add or Update

- A perf budget test on a 150 .md synthetic room: spawn count and Linux wall time for session-start and on-stop (task T11).
- A hooks.json unit test: every timeout is an integer of seconds in range (task T12).
- A session-start envelope test: stdout passes JSON.parse and the parsed context holds 0 ESC characters on 3 fixtures (task T14).
- A compute-state parity test: byte-identical STATE.md except `computed:` (task T2).
- An on-stop wall budget test inside tests/run-all-198.sh (task T7).
- A load-order test for the navigation constants (task T16), a registry reconcile test (task T18), lifetime tests for brain-prewarm and reference-now (tasks T5, T6).

## Non-Code Follow-ups

- CHANGELOG.md: one Fixed entry per landed task.
- Release lockstep and the real-room rule apply to each release that ships these tasks (docs/RELEASE-CEREMONY-RULING-SYSTEM.md RULE 5 and RULE 10).
- Canon Part 8: tasks T4 and T5 touch the Brain prewarm path. The probe must stay a content-free theo_health; no room bytes reach the Brain.
- Tri-Polar: hooks run on the CLI only. Task T2 also changes the MCP path that Desktop and Cowork use (lib/core/state-ops.cjs:52, lib/mcp/stop-gate-handler.cjs:98); verify both.
- Cross-platform: every change to process spawning or shell behavior needs one Windows Git Bash run. The Windows side of this machine can run read-only calibration.
- Reuse before build (Canon Part 7): tasks T2 and T3 add a lib/core module behind the existing script names; no new command, skill or hook.
- knowledge-base.md: add the summary block when this session resolves.

## Resolution

root_cause: SessionStart runs two bash programs, analyze-room and compute-state, synchronously before it prints its context, and both start one or more processes per file, per section pair and per term (about 6,000 to 10,000 process starts per SessionStart on a 133 to 150 .md room; 12.5 to 35.7 s for the whole session-start on native Linux ARM64). The tier rule that should skip analyze-room reads /tmp/mindrian-context-state, which no code writes since 2026-04-05, so every session takes the rich tier, and the balanced tier runs analyze-room too. on-stop runs compute-state again on every assistant reply and adds a fixed 1 s wait, so each Stop costs about 740 to 4,200 spawns on rooms of 66 to 529 .md. Nothing bounds these runs: hooks.json writes every budget in milliseconds while Claude Code 2.1.296 reads seconds (10000 = 2 h 46 min), and 8 of 9 SessionStart scripts and on-stop have no whole-script deadline; Windows process-tree kill semantics are UNVERIFIED and not needed to explain the 2,226 s run. On Windows ARM64, Git Bash runs as x64 under emulation, so each process start costs 45 to 89 ms and the same counts become minutes per SessionStart and tens of seconds per Stop. Secondary defects on the same path: brain-prewarm holds the hook pipes 15 to 20 s and scout-cadence 6.3 s on its daily run; session-start prints invalid JSON (ANSI ESC bytes), and Claude Code 2.1.296 therefore drops the whole session-start context on every room session (runtime CONFIRMED; invalid JSON alone is sufficient; the held pipe only changes the refusal message). With valid JSON, Claude Code 2.1.296 still inlines only a 2,407-char preview, because the 21,881-char context is above its 10,000-char per-hook limit (X-2).
fix: not applied (goal find_root_cause_only)
verification: not applicable
files_changed: none
commits: this debug file only

### Proposed /gsd-quick tasks

Order: the report's recommended-fix order first (fixes 1 to 7), then items that the report's fix list does not name, by priority. Fixture names are the pseudonyms from Measurement method. "SYN" is the 150 .md synthetic room; "syn-150" is the 150 top-level content file synthetic room.

WARNING (sequencing, named by both investigators): Do not change the hooks.json timeout unit (T12) before T1 (analyze-room and compute-state leave the synchronous SessionStart path) and T7 (on-stop stops waiting on compute-state), or land them together. With a real 10 s or 3 s budget, today's session-start on SYN, R1 or R2 is killed before it prints (no room context), and on-stop is killed mid-write. T12 must also fix scripts/measure-hook-cold-start.cjs, which reads values of 100 and up as milliseconds.

1. T1 (report fix 1; F1, F4, I-3): Inject the last cached analysis and the last STATE.md at SessionStart, and refresh both in a fully detached job (`( ... ) </dev/null >/dev/null 2>&1 &`).
   - Files: scripts/session-start (:450, :524-557), scripts/analyze-room and scripts/compute-state (write a cache file).
   - Acceptance: on SYN, the session-start process tree before exit has fewer than 300 execs and no analyze-room or compute-state process (spawn tracer); session-start exits in under 2 s on Linux in 3 of 3 runs; the second session shows the cached "Proactive Room Intelligence" block and Room Map; exit-to-close time is under 250 ms.
2. T2 (report fix 2; F4): Port compute-state to one node process and keep scripts/compute-state as a thin wrapper that prints the same STATE.md bytes.
   - Files: scripts/compute-state, a new lib/core/compute-state.cjs, a parity test.
   - Acceptance: STATE.md is byte-identical except `computed:` on syn-50, syn-150, syn-300, syn-150-s28 and two real-room copies; compute-state makes at most 3 spawns on every fixture; Linux wall time under 0.3 s on syn-300; lib/core/state-ops.cjs and lib/mcp/stop-gate-handler.cjs callers stay green.
3. T3 (report fix 2; F1, I-2): Port analyze-room to one node process (the existing Python fallback shows the single-process logic).
   - Files: scripts/analyze-room, a new lib/core module, a parity test.
   - Acceptance: at most 5 process starts and under 1 s on SYN; exit 0 and "## End" present on the R1 and R2 copies; the section headings and counts match the bash path on SYN.
4. T4 (report fix 3; F2 second half): Give every SessionStart and Stop script a whole-script deadline that fails open (a node exit timer, or `timeout` on each heavy bash step).
   - Files: scripts/session-start, scripts/on-stop, scripts/sessionstart-reference-now-seed.cjs, scripts/check-pending-breakthrough.cjs, scripts/check-pending-ambiguous.cjs, scripts/agentshield-sessionstart-scan.cjs, scripts/sessionstart-coordinator.cjs.
   - Acceptance: for each of the 9 SessionStart groups and the on-stop hook, a test with an injected 30 s stall exits 0 within its budget plus 0.5 s; stdout is valid JSON or empty.
5. T5 (report fix 3; F8): Clear the brain-prewarm race timer when the probe settles and call process.exit(0) after the marker write.
   - Files: lib/core/brain-prewarm.cjs.
   - Acceptance: refused-origin lifetime under 1 s; stalled-origin lifetime with MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS=1000 under 1.5 s; the marker keeps exactly 3 keys; the probe stays a content-free theo_health (Canon Part 8).
6. T6 (report fix 3; I-6): Add a 1.5 s AbortSignal.timeout to fetchTimeOffsetOnce.
   - Files: lib/core/temporal/reference-now.cjs (:197), the header comment of scripts/sessionstart-reference-now-seed.cjs.
   - Acceptance: stalled-endpoint lifetime under 2 s in 2 of 2 runs.
7. T7 (report fix 4; F3, F6 Stop half): Make on-stop return fast: replace the synchronous compute-state call with a detached, fully redirected refresh, delete the killer-plus-`wait $(jobs -p)` pair in favor of a bounded wait on the recompile PIDs, and redirect on-stop:154 and the :394 subshells as a whole.
   - Files: scripts/on-stop (:18-19, :144-154, :352, :391-402), tests/run-all-198.sh.
   - Acceptance: on syn-150 and on a copy of a 150+ .md room, on-stop makes fewer than 150 spawns and Linux wall time is under 1.5 s; the harness shows close minus exit = 0 ms with ./room present in the cwd; tests/test-198-flag-off-parity.test.cjs and the BRIEF tests stay green; STATE.md is refreshed before the next SessionStart.
8. T8 (report fix 4 family; F4 SubagentStop leg, F6): Add a `break` to the 30 s scan and redirect every background subshell of on-agent-complete as a whole.
   - Files: scripts/on-agent-complete (:64-75, :116-123, :147-156).
   - Acceptance: idle SubagentStop makes fewer than 20 spawns; with a recent .md change on syn-150, close minus exit is under 50 ms.
9. T9 (report fix 5; F5): Replace the single-field `node -e` reads in session-start with one node call that returns all needed fields.
   - Files: scripts/session-start (:415-422, :497-502, :565-567, :587, :838, :1467).
   - Acceptance: the spawn tracer shows at most 12 direct node processes from session-start in a room session; grep finds no `echo "$...` piped into `node -e`. The merge of the nine SessionStart groups into one node entry point is phase-sized: open a seed for it.
10. T10 (report fix 6; rich-tier rule): Read the per-room bridge that scripts/context-monitor writes (or delete the dead /tmp read), and run no analyze-room in any SessionStart tier.
    - Files: scripts/session-start (:424-447, :515-579).
    - Acceptance: grep finds no reader of /tmp/mindrian-context-state; a test with ctx 80 in the per-room bridge selects minimal; no tier calls analyze-room synchronously.
11. T11 (report fix 7): Add a perf budget test with a 150 .md synthetic room that counts spawns and wall time for session-start and on-stop.
    - Files: a new tests/test-seed128-hook-budget.cjs (name open), a tests/run-all-*.sh registration.
    - Acceptance: the test fails on 451179087 and passes after T1 and T7 (session-start fewer than 300 execs before exit and under 2 s; on-stop fewer than 150 spawns and under 1.5 s on Linux). The Windows ARM64 Git Bash CI leg needs a runner (ENV GAP); record it as a follow-up.
12. T12 (P0, F2 unit; not in the report's fix list): Convert every hooks.json timeout to seconds (120000 to 120, 12000 to 12, 10000 to 10, 8000 to 8, 5000 to 5, 3000 to 3, 2000 to 2, 1500 to 2) and make scripts/measure-hook-cold-start.cjs read seconds.
    - Files: hooks/hooks.json, scripts/measure-hook-cold-start.cjs (:26-29, :68-71), scripts/on-stop comments (:18-19, :352), tests that pin the values.
    - Acceptance: a test asserts every hooks.json timeout is an integer from 1 to 600; a probe hook that sleeps 30 s with timeout 2 is killed near 2 s on Linux. Land with or after T1 and T7 (WARNING above).
13. T13 (P1, F6 SessionStart half and X-1): Redirect and detach every background job in session-start as `( ... ) </dev/null >/dev/null 2>&1 &`.
    - Files: scripts/session-start (:594, :1274-1275, :1327-1334, :1776, :1842-1851, :1965).
    - Acceptance: pipe hold after exit is under 250 ms on SYN and the R1 copy in 3 of 3 runs.
14. T14 (P1 by X-1, I-1; not in report): Strip ANSI codes from the injected text and escape every U+0000 to U+001F character in escape_for_json.
    - Files: scripts/session-start (:1870-1878).
    - Acceptance: session-start stdout passes JSON.parse on SYN, R1 and R2 copies (3 of 3), and the parsed context holds 0 ESC characters.
15. T15 (P1, F7, optional low): Remove the self-update call and the FIRST_INSTALL auto-update touch, or print the two-command update path; make check-update read pre-release headings.
    - Files: scripts/session-start (:710-714, :1820-1836), scripts/check-update (:28).
    - Acceptance: with a planted UPDATE_AVAILABLE cache, no "Auto-update failed" line appears; check-update reports the latest 2.0.0-beta heading from the CHANGELOG.
16. T16 (P2, F9): Move RECOMMENDED_CONFIDENCE_FLOOR and the behavioral band constants into a leaf module that requires nothing, and silence the SQLite ExperimentalWarning at the hook entry points.
    - Files: lib/core/navigation-engine.cjs, lib/workflow/f-selector-ranker.cjs, lib/core/navigation/calibration-log.cjs, a new leaf constants module, scripts/intent-classifier.cjs. Coordinate the warning half with doctor-auto-heal-qa-sweep-2026-09-16.md F12.
    - Acceptance: intent-classifier stderr is empty on Node 22.23.1 in 3 of 3 runs; a test asserts BEHAVIORAL_CHANNEL_CEILING === 0.85 in both load orders.
17. T17 (P2, F10): Cache the doctor ui-compliance result by plugin version and the mtime of commands/ and scripts/, and skip the doctor spawn on a cache hit.
    - Files: scripts/hmi-compliance-poll.cjs.
    - Acceptance: a second Stop on the same version makes 0 child spawns and fewer than 20 file reads; last-hmi-poll.json content is unchanged; the 105-01 and 105-03 tests stay green.
18. T18 (P2, F12): Make scripts/room-registry reconcile `status` on every write, and route every `active` writer through set-active.
    - Files: scripts/room-registry, lib/core/navigation/room-birth.cjs, lib/core/room-discard-cascade.cjs, lib/core/room-naming-selector.cjs, scripts/resolve-room.
    - Acceptance: a fixture with 3 rooms at status active and `active` naming a fourth has exactly one active status, equal to `active`, after any registry write.
19. T19 (P2, I-2 short-term; skip if T3 lands first): Make the frontmatter greps in analyze-room tolerate no match.
    - Files: scripts/analyze-room (:923, :943-944, :963-964, :987, :992).
    - Acceptance: exit 0 and "## End" present on the R1 and R2 copies.
20. T20 (P2, I-5): Move the first-session doctor runs and server or shim probes in sessionstart-coordinator off the synchronous path.
    - Files: scripts/sessionstart-coordinator.cjs.
    - Acceptance: first-session coordinator wall time under 2 s on Linux (from 12.2 s); steady state stays under 0.35 s.
21. T21 (P2, I-4): Pass PLUGIN_ROOT_FOR_RESOLVE as an env assignment before `node`.
    - Files: scripts/session-start (:1499-1504).
    - Acceptance: in a dev-clone fixture the topology probe returns found and the pre-commit install runs; in an install fixture it returns not-found.
22. T22 (P2, F11, optional; recommend no change): Exclude `*.tmp~*` directories from the retained version slots in cache-prune, and remove one only when it is older than 24 h.
    - Files: lib/core/cache-prune.cjs and its test.
    - Acceptance: a fixture with the active version, one old version and one 2-day-old .tmp~ directory keeps the first two and removes the third; a 1-hour-old .tmp~ directory stays. Risk: Claude Code owns this directory.

23. T23 (P1, X-2; added by the X-1 runtime check): Keep the session-start additionalContext at or below 9,500 chars, with the session doctrine and the room identity first; move the long blocks (Room Map, Proactive Room Intelligence) into a file that the context names.
    - Files: scripts/session-start (context assembly and the NAV_CARD_FIRE_DOCTRINE append before escape_for_json).
    - Acceptance: on X1R-size and SYN rooms, the parsed additionalContext length is at most 9,500 chars; one live `claude -p --plugin-dir` run shows no `<persisted-output>` in the SessionStart hook_additional_context and a tail-heading probe answers YES.
24. T24 (P1, I-7; added by the X-1 runtime check): Make the derive drain target the room that owns the queue, not the stored absolute roomDir (or store a room-relative marker and resolve it against the owning room).
    - Files: scripts/gsd-graph-derive-drain.cjs (:426, :440, :468-474), scripts/gsd-graph-derive-sweep.cjs (:156), a test.
    - Acceptance: a fixture room copied to a new path, with a queue entry that names the old path, drains into the copy only; the old path gets 0 writes (file mtimes and room.db row counts unchanged).
- Amendment from the X-1 runtime check: T14 alone removes the drop (run ctrl-ansi); T13 alone does not (runs ctrl-prewarm, ctrl-detach). Rank T14 as P0 with T1. T13 must also cover the scout-cadence subshell (:1776). T14 acceptance adds one live `claude -p --plugin-dir` run with "provided additionalContext" for session-start in the debug log.

Triage item (not a quick): the post-write cascade returns "skipped" for central-registry room paths (lib/core/intelligence-cascade.cjs:182-184, :652-654; reached from scripts/post-write:256), so the write path never recomputes STATE.md for those rooms. Open a separate /gsd-debug session.
