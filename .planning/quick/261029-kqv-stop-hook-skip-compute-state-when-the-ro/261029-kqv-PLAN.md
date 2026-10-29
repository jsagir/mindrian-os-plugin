---
phase: 261029-kqv-stop-hook-skip-compute-state-when-the-ro
plan: 01
quick_id: 261029-kqv
slug: stop-hook-skip-compute-state-when-the-ro
date: 2026-10-29
type: execute
wave: 1
depends_on: []
files_modified:
  - tests/test-261029-kqv-stop-skip-recompute.cjs
  - scripts/on-stop
  - CHANGELOG.md
autonomous: true
requirements:
  - 261029-kqv
canon_parts: [8]
objective: "Perf change A: the Stop hook skips compute-state when the room is unchanged, and runs the rebuild in a detached child under a room-local lock when the room changed (C-1..C-5, DD-1..DD-6)."

must_haves:
  truths:
    - "An unchanged room: the Stop hook returns without running compute-state, and STATE.md stays byte-identical (C-1)"
    - "A changed room: a detached child rebuilds STATE.md through state-write.cjs, and the hook returns before the rebuild ends (C-2)"
    - "A live lock held by another rebuild: the hook starts no second rebuild; a lock with a dead pid or older than 120 s is taken over (C-2)"
    - "A missing or empty STATE.md, or a room with no .mindrian/ directory, is still rebuilt before the hook returns (DD-1, DD-2)"
    - "The hook's JSON output, the MCP-first branch, learning-progress, track-analytics and memory-lifecycle behave as before (C-3)"
    - "The Stop event median on the real room in the unchanged case is measured with the parallel harness and recorded in CHANGELOG.md next to the 15,754 ms baseline (C-5)"
  artifacts:
    - path: "scripts/on-stop"
      provides: "Skip check, detached rebuild, room-local lock"
      contains: "state-recompute.lock"
    - path: "tests/test-261029-kqv-stop-skip-recompute.cjs"
      provides: "Regression test, cases A..H"
      min_lines: 150
    - path: "CHANGELOG.md"
      provides: "Measured before and after numbers under [Unreleased] / ### Changed"
      contains: "Not live until a release carries it."
  key_links:
    - from: "scripts/on-stop"
      to: "scripts/compute-state"
      via: "detached child started with setsid (nohup fallback), std streams on /dev/null, disowned"
      pattern: "setsid|nohup"
    - from: "scripts/on-stop"
      to: "STATE.md mtime"
      via: "one find with -newer STATE.md -print -quit"
      pattern: "-newer .*-print -quit"
    - from: "detached child"
      to: "scripts/state-write.cjs"
      via: "printf of the compute-state output piped to node state-write.cjs (legacy line 151 shape)"
      pattern: "state-write.cjs"
---

# Quick 261029-kqv: Stop hook skips compute-state on an unchanged room, rebuilds detached with a lock

<objective>
Make the Stop hook stop paying for a full room rebuild on every turn end.

Today scripts/on-stop runs scripts/compute-state synchronously at line 144 and persists it at line 151. Measured on 2026-10-29: compute-state takes 8,382 ms on the navigator's room on /mnt/c (584 forks, its child compute-team 957 forks). The Stop event median is 15,754 ms, and the slowest of 3 on-stop runs is 19,110 ms. The hook blocks the session for that whole time on every turn, because Claude Code reads the hooks.json timeout in seconds and the plugin writes 3000.

After this plan:
1. When nothing in the room changed since STATE.md was written, the hook does not run compute-state (C-1).
2. When something changed, a fully detached child runs compute-state plus state-write.cjs under a lock at .mindrian/state-recompute.lock, and the hook returns without waiting (C-2).
3. Every other on-stop behaviour stays byte-for-byte (C-3).
4. A regression test proves the skip, the detached rebuild and the lock (C-4).
5. The real-room Stop time after the change is measured and recorded in CHANGELOG.md (C-5).

Output: tests/test-261029-kqv-stop-skip-recompute.cjs (new), scripts/on-stop (modified, compute block only), CHANGELOG.md (one bullet).
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@scripts/on-stop
@scripts/compute-state
@scripts/state-write.cjs
@tests/test-compute-state-persists.cjs

The agent interaction protocol applies: /home/jsagi/.claude/protocols/agent-interaction-protocol.md. Write STE-style English in the SUMMARY. End with STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT.

## Locked constraints from the orchestrator (C-1..C-5)

- C-1: Before compute-state, decide if a rebuild is needed. Use one `find ... -newer STATE.md -print -quit` call, not a loop.
- C-2: A needed rebuild runs compute-state plus state-write.cjs in a fully detached child: setsid or nohup, stdin, stdout and stderr on /dev/null, `disown`, not included in the later `wait`. Guard it with a room-local lock, .mindrian/state-recompute.lock, that holds the pid. The lock is stale when the pid is dead or the lock is older than 120 s. A held lock means skip. The hook returns without waiting.
- C-3: Keep every other on-stop behaviour byte-for-byte: the JSON output, the MCP-first branch, learning-progress, track-analytics, memory-lifecycle.
- C-4: Add tests/test-261029-kqv-stop-skip-recompute.cjs in the style of tests/test-compute-state-persists.cjs.
- C-5: Measure the Stop event 3 times against the real room in the unchanged case. Record before and after in CHANGELOG.md `## [Unreleased]` / `### Changed`. Plain English, Feynman style, no em-dashes, with the sentence "Not live until a release carries it." Real measurements only.
- Scope: scripts/on-stop, the new test file, CHANGELOG.md. Do not edit hooks/hooks.json, compute-state, compute-team, session-start or any other file. `async: true` is out of scope (the MCP-first branch can print `decision: block`).

## Design decisions made in planning (DD-1..DD-6), with the reason for each

- DD-1: A missing or empty (0-byte) STATE.md is rebuilt SYNCHRONOUSLY with the legacy two lines. Reason: lib/memory/on-stop-snapshot.test.cjs Test 6 (line 329-343) asserts STATE.md exists right after on-stop returns on a fresh fixture, and that test is out of scope. A first STATE.md also feeds the KAIROS read at on-stop line 229. The empty-file guard covers scripts/on-agent-complete, which truncates STATE.md with a shell redirect (compute-state line 29-31).
- DD-2: A room with no .mindrian/ directory is rebuilt synchronously. Reason: the lock lives in .mindrian/. Creating .mindrian/ would switch on the Phase 88 block at on-stop line 358 and change behaviour (C-3).
- DD-3: The newer-check prunes every hidden entry at any depth (`-mindepth 1 -name '.*' -prune`), excludes files named STATE.md and STATE.md.tmp.*, and KEEPS ROOM.md and USER.md in the check. Reason for the prune: compute-state reads only non-hidden section folders, meetings/, team/ and MEETINGS-INTELLIGENCE.md, so hidden entries (.mindrian, .context, .git, .obsidian, .snapshots, root dot caches) are never inputs, and pruning them stops constant writers from forcing a rebuild. Reason for keeping ROOM.md: compute-state line 159 reads the newest *.md mtime per section, ROOM.md included, for the Last Updated column. recompile-room-references.cjs writes ROOM.md only when its content changes (line 517-521), so this does not cause a rebuild loop. The line 185 find shape (which excludes ROOM.md and USER.md) serves a different purpose and is not reused for that part.
- DD-4: Two more triggers, both cheap: the rooms registry `${MINDRIAN_ROOMS_HOME:-$HOME/MindrianRooms}/.rooms/registry.json` is newer than STATE.md (compute-state line 36-72 derives the current_room line from it), or STATE.md is older than 24 h (compute-team line 768-797 writes day-relative trend labels). Both only add rebuilds; neither can suppress one.
- DD-5: The hook appends one line per run to `${ROOM_DIR}/.mindrian/session-close.log` (only when .mindrian/ exists): the mode (skip, detached, sync, locked) and the reason. The detached child appends one completion line with its elapsed seconds. Task 3 uses these lines to prove which mode each measured run took. session-close.log already receives on-stop lines (line 519-520, 529-531); no code parses it (grep of lib, scripts, tests).
- DD-6: The lock age is computed exactly with `stat -c %Y` (GNU, Git Bash) falling back to `stat -f %m` (BSD/macOS) against `date +%s`, not with `find -mmin`, because find rounds minutes.

## Interfaces (verbatim from scripts/on-stop at HEAD fd3fcd2b5)

Lines 138-154 today. Line 142 is the last line that must stay identical at the top; the line `  # Track session end` (153) and everything after it must stay identical at the bottom.

```bash
# Determine working directory
WORK_DIR="${PWD}"
ROOM_DIR=$("${SCRIPT_DIR}/resolve-room" "$WORK_DIR") || ROOM_DIR=""

if [ -d "$ROOM_DIR" ]; then
  # Room exists -- compute state and write STATE.md
  state_content=$("${SCRIPT_DIR}/compute-state" "$ROOM_DIR" 2>/dev/null || echo "# Data Room State\n\nError computing state.")
  # Phase 240.1 Plan 03 (CTXL-01): route the persist through
  # ... (comment lines 145-150)
  printf '%s\n' "$state_content" | node "${SCRIPT_DIR}/state-write.cjs" "$ROOM_DIR" || true

  # Track session end
  bash "${SCRIPT_DIR}/track-analytics" session-stop 2>/dev/null &
```

Facts the executor needs:
- on-stop runs under `set -euo pipefail` (line 22). SCRIPT_DIR is `$(cd "$(dirname "$0")" && pwd)` (line 24), so a symlinked on-stop inside a temp plugin tree resolves siblings in that tree.
- Line 399 runs `kill $(jobs -p)` after 1 s and line 401 runs `wait $(jobs -p)`. A rebuild child that stays in the job table would be killed or waited on. `disown` removes it from the table.
- persistState (lib/core/state-version.cjs line 206-215) writes STATE.md atomically (same-dir tmp plus rename), so a concurrent reader sees the old or the new file, never a partial one.
- compute-state's children write MEETINGS-INTELLIGENCE.md, action-items.md, team/TEAM-STATE.md and team/*/PROFILE.md DURING the scan, before state-write runs. These files are therefore older than the new STATE.md and do not re-trigger a rebuild. Keep compute-state and state-write sequential in the child.
- resolve-room Strategy 0b (line 80-87) maps WORK_DIR basename to `$MINDRIAN_ROOMS_HOME/<basename>`. A registry with no `active` key falls through to 0b (line 52-77).
- The fixture pattern to copy: lib/memory/on-stop-snapshot.test.cjs `seedRoom` (line 88-120) and `invokeOnStop` (line 156-168).
- Commit with `git commit --only` by explicit path. Do not use `gsd-tools query commit --files` (it sweeps the whole index). Two peer sessions share this tree.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Write the failing regression test (RED) for the skip, the detached rebuild and the lock (C-4)</name>
  <files>tests/test-261029-kqv-stop-skip-recompute.cjs</files>
  <read_first>
    - tests/test-compute-state-persists.cjs (whole file: check/checkAsync helpers, summary line, exit code)
    - lib/memory/on-stop-snapshot.test.cjs lines 85-170 (seedRoom and invokeOnStop fixture pattern)
    - scripts/on-stop lines 1-45 and 138-160
    - scripts/resolve-room lines 48-87
  </read_first>
  <behavior>
    - A (skip, C-1): STATE.md newer than every room file. After the hook plus a 2 s grace, the fake compute-state never ran (no marker file), STATE.md is byte-identical, the last stdout line is JSON with continue === true, and .mindrian/session-close.log has a line containing "mode=skip".
    - B (detached, C-2): one section file newer than STATE.md, fake sleep 6 s. Within 10 s after the hook returns, STATE.md contains "kqv-fake-token". The marker has exactly one start and one end line. The end timestamp is LATER than the hook return time (proof that the hook did not wait). The lock file is gone within 3 s after the token appears. The log has "mode=detached". The stdout JSON has continue === true.
    - C (live lock, C-2): a section file newer than STATE.md and a fresh lock that holds the test process pid. After the hook plus a 3 s grace, no marker exists, the lock still holds the test pid, STATE.md is unchanged, and the log has "mode=locked".
    - D (dead-pid lock): the lock holds the pid of an exited process (spawnSync of `true`, use result.pid). Within 10 s STATE.md contains the token; the lock is gone at the end.
    - E (aged lock): the lock holds the live test pid but its mtime is 300 s old. Within 10 s STATE.md contains the token; the lock is gone at the end (the hook removed the aged lock, and the child removed its own).
    - F (missing STATE.md, DD-1): no STATE.md in the fixture. Immediately after the hook returns (no wait), STATE.md exists and contains the token.
    - G (registry newer, DD-4): STATE.md newer than every room file, then rooms-home/.rooms/registry.json written with content {"rooms":{}} and mtime now. Within 10 s STATE.md contains the token.
    - H (STATE.md older than 24 h, DD-4): every room file mtime now minus 3 days, STATE.md mtime now minus 2 days. Within 10 s STATE.md contains the token.
  </behavior>
  <action>
Create tests/test-261029-kqv-stop-skip-recompute.cjs. Use Node built-in modules only (node:assert, node:fs, node:os, node:path, node:child_process). CJS, 'use strict', no test framework. Copy the check/checkAsync helpers, the per-case try/finally cleanup and the final summary line style of tests/test-compute-state-persists.cjs. Print "stop-skip-recompute: ALL PASS" or "stop-skip-recompute: N FAILED" and exit 0 or 1. Write a header comment that names quick 261029-kqv, the measured cost (compute-state 8,382 ms on the real room), the C-1/C-2/DD-1/DD-4 contracts and the hook-free method below. No em-dashes in the file.

Hook-free method, no test seam in production code (per C-4, the orchestrator's preferred method). For each case build a temp plugin tree under a fresh fs.mkdtempSync(os.tmpdir()) directory. In the temp plugin root, create a symlink for every entry of the real plugin root (path.resolve(__dirname, '..')) except "scripts". Create a real scripts/ directory and symlink every entry of the real scripts/ into it except "compute-state". Symlink on-stop too: on-stop computes SCRIPT_DIR from dirname of $0 without -P, so it calls the siblings in the temp tree. If fs.symlinkSync throws EPERM or EACCES, print "SKIP: symlinks unavailable on this platform" and exit 0.

Write a fake scripts/compute-state in the temp tree (mode 0o755, bash shebang). Behaviour, in order: append "start <epoch ms>" to the file named by env KQV_MARKER; sleep for env KQV_FAKE_SLEEP_S seconds (default 0); append "end <epoch ms>"; print a STATE.md body to stdout whose frontmatter has "computed: kqv-fake" and whose body has the line "kqv-fake-token". Get epoch ms with a one-line node -e call that writes Date.now(), so the fake is portable (macOS date has no %N).

Fixture (copy the seedRoom shape): tmp/rooms-home/venture is the room, with an empty .room-root, a .mindrian/ directory, and one section market-analysis holding ROOM.md and artifact-01.md. WORK_DIR is tmp/work/venture (resolve-room Strategy 0b). HOME is tmp/home (created). Do not create a registry except in case G.

Hook runner: spawnSync('bash', [<temp plugin>/scripts/on-stop]) with cwd WORK_DIR, encoding utf8, input set to a JSON Stop payload that has a session_id and no transcript_path, stdout and stderr as pipes (pipes are required: a leaked stdout in the detached child would hold spawnSync open, which case B detects), and timeout 60000. Env: a copy of process.env with MINDRIAN_MCP_FIRST, CLAUDE_ACTIVE_ROOM and MINDRIAN_TRANSCRIPT_PATH deleted, plus HOME, MINDRIAN_ROOMS_HOME (tmp/rooms-home), PWD (WORK_DIR), CLAUDE_PLUGIN_ROOT (temp plugin root), KQV_MARKER (an absolute path in tmp, outside the room), KQV_FAKE_SLEEP_S, and MINDRIAN_GUARDIAN_ONSTOP_TIMEOUT_S=1. Record Date.now() right after spawnSync returns as the hook return time. Assert exit status 0 in every case.

Helpers: a recursive mtime setter that calls fs.utimesSync on every file and directory of the room, hidden ones included; a marker reader that returns the start and end timestamps; an async poll helper (100 ms interval, deadline in ms); a stdout JSON check that parses the last non-empty stdout line and asserts continue === true. Lock path: <room>/.mindrian/state-recompute.lock, content "<pid>\n".

Cleanup after every case, in finally: poll up to 15 s until the marker has as many end lines as start lines and the lock file is absent or still holds the pid that the case itself planted (a poll timeout in cleanup is not a case failure), then fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }). This keeps a late detached child from racing the delete.

Implement cases A to H exactly as the behavior block states. Only A, B and C assert session-close.log mode lines. The RED set is exactly the behaviour change: the legacy hook always rebuilds synchronously and ignores the lock.

RED check: run the test against the UNMODIFIED scripts/on-stop. Expected: exit 1, with FAIL for A (marker present), B (end timestamp earlier than the hook return), C (marker present), D and E (the planted lock is still there), and ok for F, G and H. If the failing set is different, fix the test until it matches. Do not touch scripts/on-stop in this task.

Commit, per the tdd RED step: run git add on this one path, then git commit --only with message "test(261029-kqv): add failing test for the Stop hook state rebuild skip and lock", ending with the line "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Before the commit, run git status --porcelain on this path and confirm it is the only path you stage.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && node tests/test-261029-kqv-stop-skip-recompute.cjs > "${TMPDIR:-/tmp}/kqv-red.txt" 2>&1; echo "exit=$?"; grep -E '(ok|FAIL) ' "${TMPDIR:-/tmp}/kqv-red.txt"; ! LC_ALL=C grep -q $'\xe2\x80\x94' tests/test-261029-kqv-stop-skip-recompute.cjs && echo "no-emdash"</automated>
  </verify>
  <done>The test file exists (150 lines or more), uses no framework, runs in under 60 s, and on the unmodified on-stop exits 1 with FAIL lines for A, B, C, D and E only and ok lines for F, G and H. No em-dash in the file. The file is committed alone with git commit --only.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add the skip check, the detached rebuild and the lock to scripts/on-stop (GREEN, C-1, C-2, C-3, DD-1..DD-6)</name>
  <files>scripts/on-stop</files>
  <read_first>
    - scripts/on-stop lines 1-160 and 347-405 (set -euo pipefail, SCRIPT_DIR, the compute block, the jobs -p kill and wait)
    - scripts/compute-state lines 28-40 and 155-165 (ROOMS_HOME registry path, per-section *.md mtime read)
    - lib/core/state-version.cjs lines 200-220 (atomic write)
    - tests/test-261029-kqv-stop-skip-recompute.cjs (the contract from Task 1)
  </read_first>
  <behavior>
    - All 8 cases of tests/test-261029-kqv-stop-skip-recompute.cjs pass.
    - Lines 1-142 of scripts/on-stop and every line from "  # Track session end" to the end of the file are byte-identical to commit fd3fcd2b5 (the pre-change baseline).
  </behavior>
  <action>
Step 0, before you edit: run git status --porcelain scripts/on-stop. If it shows a change you did not make, stop and return NEEDS_HUMAN with the path (a peer session owns that change). Then record a baseline: run each of these with node and record the exit code and any FAIL line: tests/test-363.1-compute-state.cjs, tests/test-compute-state-persists.cjs, lib/memory/on-stop-snapshot.test.cjs, lib/memory/guardian-onstop-reaches-user.test.cjs, lib/memory/minto-debounce-consumer-census.test.cjs, tests/test-36925-brief-wiring.cjs, tests/test-36925-practical.cjs, tests/test-241-guardian-tripolar-parity.cjs, tests/test-3551-concurrency.cjs, tests/test-198-adapter-budget.test.cjs. A test that fails in this baseline is not a regression of this task; name it in the SUMMARY.

Edit only the region between line 142 (if [ -d "$ROOM_DIR" ]; then) and the line "  # Track session end". Replace the legacy compute plus persist lines (143-151) with the block below. Put all explanatory comments inside the new block. Cite "Quick 261029-kqv" and the measured 8,382 ms. Use hyphens, never em-dashes. Do not change lines 1-142, even the header comment at line 2-3, because the byte-identical gate in verify compares them.

1. Decision (C-1, DD-1, DD-3, DD-4). Set STATE_FILE to the room's STATE.md, and set a mode variable and a reason variable. If STATE_FILE is missing or 0 bytes (test ! -s), the mode is sync with reason missing or empty. Else, in this order, the first true check sets the mode to needed. Check 1 (reason registry): the registry file at ${MINDRIAN_ROOMS_HOME:-$HOME/MindrianRooms}/.rooms/registry.json exists and is -nt STATE_FILE. Check 2 (reason age): find STATE_FILE -mmin +1440 -print -quit prints something. Check 3 (reason newer:<path relative to the room>): exactly one find call, find "$ROOM_DIR" -mindepth 1 -name '.*' -prune -o -type f ! -name STATE.md ! -name 'STATE.md.tmp.*' -newer "$STATE_FILE" -print -quit, with 2>/dev/null and || true, prints a path. Write this find call on one line (the verify gate greps for it). If no check is true, the mode is skip. Every command in the decision must be safe under set -euo pipefail.

2. If the mode is needed and ${ROOM_DIR}/.mindrian is not a directory, set the mode to sync (DD-2). Do not create .mindrian.

3. If the mode is needed, check the lock at ${ROOM_DIR}/.mindrian/state-recompute.lock (C-2). If the lock exists, read the first line as the pid with read -r and || true. The lock is live only when all three conditions are true: the pid matches the digits-only case pattern, kill -0 on the pid succeeds, and the lock age is 120 s or less. Compute the age as date +%s minus the lock mtime from stat -c %Y, with a fallback to stat -f %m (DD-6). A live lock sets the mode to locked, and no child starts. A stale lock is removed with rm -f, and the hook continues to step 4.

4. Detached start (C-2). Put the child script in a shell variable with a quoted heredoc and read -r -d '' plus || true, so that nothing from the room path is expanded into code. Run it with bash -c "$VAR" plus a fixed $0 name and three positional arguments: the room dir, SCRIPT_DIR and the lock path. Do not interpolate a path into the code string (threat T-kqv-01). When command -v setsid succeeds, start the child with setsid; else start it with nohup. In both cases send stdin from /dev/null and stdout and stderr to /dev/null, and start it with a trailing &. Then run disown "$!" 2>/dev/null || true, so line 399 (kill $(jobs -p)) and line 401 (wait $(jobs -p)) never see the child. Set the mode to detached.

5. The child script, in order. (a) Run set -C, write $$ plus a newline into the lock (O_EXCL create), then set +C. If the write fails, exit 0 because another rebuild owns the lock. (b) Set trap on EXIT to remove the lock only when its first line still equals $$. (c) If the room dir is no longer a directory, exit 0. (d) Run the two legacy lines verbatim, with only the variables changed to the positional arguments. Use the same variable name state_content, the same fallback echo string "# Data Room State\n\nError computing state.", 2>/dev/null on compute-state, and || true on the state-write pipe. compute-state and state-write stay sequential. (e) Append a completion line "<date -u +%FT%TZ> on-stop-state-bg done elapsed_s=$SECONDS" to <room>/.mindrian/session-close.log with || true. Inside the heredoc, use double quotes only. Make sure no line of the child depends on the parent's set -e.

6. The sync path runs the two legacy lines exactly as they are at HEAD lines 144 and 151, the same text, in the parent, before track-analytics. The skip and locked paths run neither line.

7. Observability (DD-5): if ${ROOM_DIR}/.mindrian is a directory, append one line "<date -u +%FT%TZ> on-stop-state mode=<mode> reason=<reason>" to ${ROOM_DIR}/.mindrian/session-close.log with 2>/dev/null || true. The modes are skip, sync, detached and locked. Do not print anything to stdout; stdout carries only the final JSON (C-3).

Then run the gates in verify. Run tests/test-261029-kqv-stop-skip-recompute.cjs twice in a row; both runs must pass. Rerun the step 0 baseline list; every test that passed in the baseline must pass now. Run the on-stop suites (on-stop-snapshot, guardian-onstop-reaches-user, minto-debounce-consumer-census, test-36925-brief-wiring) a second time to check for flakes from a late detached child (RISK R-3). Do not edit any of those tests.

Commit: git commit --only with message "perf(261029-kqv): skip compute-state on an unchanged room and run the rebuild detached under a lock", ending with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", path scripts/on-stop only.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && bash -n scripts/on-stop && diff <(git show fd3fcd2b5:scripts/on-stop | sed -n 1,142p) <(sed -n 1,142p scripts/on-stop) && diff <(git show fd3fcd2b5:scripts/on-stop | sed -n '/^  # Track session end$/,$p') <(sed -n '/^  # Track session end$/,$p' scripts/on-stop) && ! git diff fd3fcd2b5 -- scripts/on-stop | grep '^+' | LC_ALL=C grep -q $'\xe2\x80\x94' && grep -q 'state-recompute.lock' scripts/on-stop && grep -Eq -- '-newer .*-print -quit' scripts/on-stop && node tests/test-261029-kqv-stop-skip-recompute.cjs && node tests/test-363.1-compute-state.cjs && node tests/test-compute-state-persists.cjs && node lib/memory/on-stop-snapshot.test.cjs && echo GATES-GREEN</automated>
  </verify>
  <done>GATES-GREEN prints. The new test passes twice in a row. Every test that passed in the step 0 baseline still passes. The diff of scripts/on-stop touches only the region between line 142 and "  # Track session end". There is no em-dash in the added lines. The file is committed alone with git commit --only.</done>
</task>

<task type="auto">
  <name>Task 3: Measure the real-room Stop event after the change and record it in CHANGELOG.md (C-5)</name>
  <files>CHANGELOG.md</files>
  <read_first>
    - /tmp/claude-1000/-home-jsagi/f5142fde-6a56-4889-9ce0-822f4eb3c4d0/scratchpad/bench/perf-audit-baseline.md (section 2: method and the before numbers)
    - /tmp/claude-1000/-home-jsagi/f5142fde-6a56-4889-9ce0-822f4eb3c4d0/scratchpad/bench/hook-bench-parallel.cjs (the "slowest" field is the MAXIMUM over the runs, not a median)
    - CHANGELOG.md lines 1-21 (the [Unreleased] section and its ### Changed list)
  </read_first>
  <action>
Measurement (real numbers only, no estimates). ROOM=/mnt/c/Users/jsagi/MindrianRooms/israel-frontier-criticality/translational-capital-lab and BENCH=/tmp/claude-1000/-home-jsagi/f5142fde-6a56-4889-9ce0-822f4eb3c4d0/scratchpad/bench.
1. With cwd ROOM, confirm that bash /home/jsagi/dev/MindrianOS-Plugin/scripts/resolve-room "$ROOM" prints ROOM. If it prints a different path, use that path as ROOM for every step below and name it in the SUMMARY.
2. Bring the room to the unchanged state. With cwd ROOM and CLAUDE_PLUGIN_ROOT=/home/jsagi/dev/MindrianOS-Plugin, run bash /home/jsagi/dev/MindrianOS-Plugin/scripts/on-stop once with stdin from /dev/null. Then poll up to 60 s until ROOM/.mindrian/state-recompute.lock is absent. Then run the Task 2 newer-check find expression against ROOM and confirm that it prints nothing.
3. Run: SCRATCH="$BENCH" node "$BENCH/hook-bench-parallel.cjs" /home/jsagi/dev/MindrianOS-Plugin "$ROOM" 3 Stop. This is the baseline method, median of 3. Save the output line.
4. Read the last 3 "on-stop-state mode=" lines of ROOM/.mindrian/session-close.log. The measured set is valid only if all 3 say mode=skip. If any run took another mode, record its reason. Then repeat steps 2-4, at most 3 attempts in total. A peer session works in this room, so a peer write can trigger a rebuild.
5. After the last attempt, poll up to 60 s until no state-recompute.lock remains in ROOM, and record that.
6. Write every attempt's harness line, its mode lines, and the final lock state into the SUMMARY.

CHANGELOG (only when step 4 produced a valid all-skip set). First run git status --porcelain CHANGELOG.md. If it shows a change you did not make, stop and return NEEDS_HUMAN (a peer hunk would be swept into the commit). Add one bullet at the end of the existing "### Changed" list under "## [Unreleased]". Do not touch the heading or other bullets. House style: the bullet is one single line (as every other bullet in the file), a bold lead sentence, then plain English, Feynman style, hyphens only. The sentence "Not live until a release carries it." already appears in other Unreleased bullets, so the verify gate checks that the NEW line holds 15,754, 19,110 and that sentence together. Content:
- The lead says that the end of each turn no longer waits for the room summary (STATE.md) to be rebuilt when nothing in the room changed.
- Explain the mechanism in one or two simple sentences. Before, every turn end rebuilt the whole summary from scratch, and the session waited. Now the hook first asks one cheap question: did any room file change since the summary was written? If no, it skips the rebuild. If yes, the rebuild runs in the background, with a lock so only one runs at a time.
- Give the before numbers: Stop event median 15,754 ms; the slowest of 3 on-stop runs 19,110 ms. Give the after numbers exactly as measured in the valid set: the median and the on-stop slowest-of-3. Name the room as a real room on a Windows drive under WSL, measured as a median of 3 runs. Do not name the navigator or the room slug.
- End with the sentence "Not live until a release carries it."
If no valid all-skip set exists after 3 attempts, do not edit CHANGELOG.md, and report STATUS: PARTIAL with every measured number.

Commit: git commit --only with message "docs(261029-kqv): record the measured Stop hook time in the changelog", ending with "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", path CHANGELOG.md only. Then verify that all three commit shas of this plan are ancestors of HEAD (git merge-base --is-ancestor). Do not push.
  </action>
  <verify>
    <automated>cd /home/jsagi/dev/MindrianOS-Plugin && awk '/^## \[Unreleased\]/{f=1;next} /^## \[/{f=0} f' CHANGELOG.md | grep -F '15,754' | grep -F '19,110' | grep -qF 'Not live until a release carries it.' && ! git diff fd3fcd2b5 -- CHANGELOG.md | grep '^+' | LC_ALL=C grep -q $'\xe2\x80\x94' && test -z "$(git status --porcelain -- scripts/on-stop CHANGELOG.md tests/test-261029-kqv-stop-skip-recompute.cjs)" && echo CHANGELOG-OK</automated>
  </verify>
  <done>The SUMMARY holds every harness line and mode line of each attempt. CHANGELOG.md [Unreleased] / ### Changed has one new bullet with the before numbers (15,754 ms, 19,110 ms), the measured after numbers, and the sentence "Not live until a release carries it." There is no em-dash in the bullet. The three owned files are clean in git status, and all three commits are ancestors of HEAD. Nothing is pushed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| room filesystem -> on-stop | Room paths and file names are user-controlled and reach bash, find and the child script |
| on-stop -> detached child | A long-lived process outlives the hook and writes STATE.md |
| test and benchmark -> real data | The benchmark runs real hooks against the navigator's real room |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kqv-01 | Tampering (code injection) | on-stop child launch | mitigate | The child code is a quoted heredoc in a variable; the room dir, SCRIPT_DIR and the lock path are passed as positional argv to bash -c, never interpolated into code (Task 2 step 4) |
| T-kqv-02 | Denial of service | state-recompute.lock | mitigate | The lock is stale when the pid is dead or older than 120 s (exact stat age, DD-6); the child removes its own lock on EXIT through a trap; noclobber create gives one owner |
| T-kqv-03 | Denial of service | detached rebuild pile-up | mitigate | One lock per room; a live lock skips the start; a hung compute-state allows at most one new start per 120 s |
| T-kqv-04 | Tampering | planted lock with a live unrelated pid | accept | Same-user room folder; the effect is a rebuild delay of 120 s or less |
| T-kqv-05 | Information disclosure (Canon Part 8) | whole change | accept | Local only: no network call, no Brain call; the log line stays in the room's .mindrian/ |
| T-kqv-06 | Tampering (integrity of STATE.md) | rebuild overlapping a later write | accept | A room write during a running rebuild (3-8 s window) can be overwritten by an older snapshot until the next room change; documented as R-1 |
| T-kqv-07 | Tampering | test touches real rooms | mitigate | The test sets HOME, MINDRIAN_ROOMS_HOME, PWD and CLAUDE_PLUGIN_ROOT to temp paths and deletes MINDRIAN_MCP_FIRST and CLAUDE_ACTIVE_ROOM |
| T-kqv-08 | Tampering | benchmark rewrites the navigator's real room | accept | Instructed by the orchestrator; the same as the baseline method (perf-audit-baseline.md section 4) |
</threat_model>

<verification>
- node tests/test-261029-kqv-stop-skip-recompute.cjs passes twice in a row.
- node tests/test-363.1-compute-state.cjs and node tests/test-compute-state-persists.cjs pass.
- Every on-stop suite that passed in the Task 2 baseline still passes.
- Lines 1-142 and the tail from "  # Track session end" of scripts/on-stop are byte-identical to commit fd3fcd2b5, the pre-change baseline. The MCP-first branch and the JSON output are therefore unchanged (C-3).
- hooks/hooks.json, scripts/compute-state, scripts/compute-team and scripts/session-start are unchanged: git diff --stat of the 3 plan commits lists only the 3 owned files.
- Tri-Polar: the change is on the Claude Code CLI legacy Stop path only. The MCP-first branch (Desktop, Cowork and the daemon close-out in lib/mcp/stop-gate-handler.cjs) is untouched. On macOS, where setsid is absent, the nohup fallback runs; this is not measured (UNVERIFIED).
</verification>

<success_criteria>
- On an unchanged room, on-stop does not run compute-state (test case A, plus 3 of 3 measured runs with mode=skip).
- On a changed room, STATE.md is rebuilt by a detached child, and the hook returns first (test case B).
- The lock prevents a second concurrent rebuild and recovers from a dead or aged lock (cases C, D, E).
- The legacy synchronous write still happens for a missing or empty STATE.md and for rooms without .mindrian/ (case F, DD-2).
- CHANGELOG.md records the measured before and after Stop times with "Not live until a release carries it."
- 3 commits, each made with git commit --only on one owned path; none pushed.
</success_criteria>

<risks>
- R-1: A room write made while a rebuild is still running (3-8 s on /mnt/c) can be overwritten by the rebuild's older snapshot. The next Stop then skips until the next room change. The window is narrow: the user must start a new turn and write a room file within seconds of the previous turn end.
- R-2: The KAIROS block (on-stop line 229) reads the venture stage from STATE.md. In the detached mode, it reads the previous STATE.md, which can be one turn old.
- R-3: Existing on-stop tests that run the hook twice in one fixture can start a detached child on the second run. On a tiny fixture the child usually ends before the hook does, but a late child can race the test's rmSync. Task 2 reruns those suites to detect this.
- R-4: On macOS and Git Bash without setsid, the nohup child stays in the hook's process group. If the host kills that group after the hook exits, the rebuild dies, and the next Stop retries.
- R-5: state-write.cjs advisory stderr is lost in the detached mode, because stderr goes to /dev/null per C-2.
</risks>

<output>
Create `.planning/quick/261029-kqv-stop-hook-skip-compute-state-when-the-ro/261029-kqv-SUMMARY.md` when done. Include the Task 2 baseline and after table of test results, every Task 3 harness line and mode line, the 3 commit shas, and the protocol report fields (STATUS, CHANGED, VERIFIED, UNVERIFIED, RISKS, NEXT).
</output>
