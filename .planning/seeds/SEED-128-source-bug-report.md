# SEED-128 source: the owner's bug report, verbatim

Pasted by the owner 2026-10-13. Kept word for word except: the two room names are pseudonymised (room-A, room-B) and one room family name is generalised, per the no-real-names rule for tracked files. Nothing else changed.

---

MindrianOS bug report · v2.0.0-beta.65 · 2026-10-13
SessionStart hook blocked the first prompt for 37 minutes on Windows ARM64
One MindrianOS hook, run-hook.cmd session-start, ran for 2,226 seconds against a 10-second timeout, and the user's first message waited the whole time. A timed rerun put 86% of the cost in scripts/analyze-room. That script launches thousands of short-lived processes, and each one is slow on this machine because Git Bash runs as x64 code emulated on an ARM chip.

Summary for the dev team
Measured: session-start = 2,226 s in the real session (room room-A). A rerun on room room-B took 569 s: analyze-room 489 s, compute-state 58 s, everything else about 22 s.

Why: analyze-room is written as bash loops, with one subprocess (grep, basename, echo|grep, node -e) per file, per section, per term. On this machine each MSYS process spawn costs about 90 ms, because the shell is an x64 binary emulated on ARM64. The script's own header says "Must complete in under 2 seconds".

Why the timeout didn't help: hooks.json sets timeout: 10000. Claude Code waited until the script exited on its own, presumably because the hook runs as cmd.exe → bash.exe → children and killing cmd.exe doesn't end that tree. Treat hook timeouts as unenforceable on Windows.

System under test
Item    Value
Computer    Lenovo 83ED (Snapdragon laptop)
CPU    Qualcomm Snapdragon X Elite X1E78100 (Oryon), 12 cores / 12 threads, ARM64
RAM    31.6 GB total, 6.3 GB free at time of test
Disk    C: 951.5 GB, 31 GB free
OS    Windows 11 Home 10.0.26200 (build 26200), ARM 64-bit
Antivirus    Microsoft Defender real-time protection ON (scans every new process)
Uptime    53.8 h at test time
Claude Code    2.1.296, model claude-opus-5-5, PowerShell primary shell, auto mode
Bash used by hooks    Git for Windows 2.49.0, GNU bash 5.2.37 x86_64-pc-msys (x64 binary under ARM emulation), MINGW64_NT-10.0-26200-ARM64
Node    v22.23.1 arm64 native
Python    3.13.6 ARM64; python3 resolves to a bash shim in ~/bin/python3 (exec /c/Python313/python.exe), with the WindowsApps stub further down PATH
MindrianOS    mos 2.0.0-beta.65 (mindrian-marketplace). Stale 2.0.0-beta.51/ and 2.0.0-beta.65.tmp~704bf009/ dirs still in plugin cache. Auto-update flag ~/.mindrian/auto-update is ON
Rooms    34 rooms in ~/MindrianRooms (323 MB). room-A: 227 files / 159 .md / 15 dirs. room-B: 220 files / 136 .md / 15 dirs
Other plugins enabled    vercel, wt-agent-hooks, fullstack-dev-skills, gsap-skills, hyperframes; GSD hooks in settings.json; impeccable hooks in settings.local.json

Timeline from the session transcript
Source: ~/.claude/projects/C--Users-jsagi/c3efb003-1fea-48ad-a956-d98930e8ef4a.jsonl (hook attachment records, UTC).

Time (UTC)    Event    Duration
08:33:31    Session starts, SessionStart hooks fire in parallel    -
08:33:37    npm-reconcile, post-update-preflight, check-pending-ambiguous done    6.3 s
08:33:49    impeccable "Preparing build session" cancelled (timeout 5 s), not MOS    17.9 s
08:33:54    sessionstart-reference-now-seed (timeout 5 s)    22.6 s
08:33:59    agentshield scan (timeout 8 s); check-pending-breakthrough (timeout 2 s)    27.9 / 28.0 s
08:34:07    sessionstart-coordinator "Loading room context..." (timeout 10 s)    35.5 s
09:10:37    run-hook.cmd session-start "Loading room context..." (timeout 10 s)    2,226.2 s
09:10:38    User's first prompt is finally submitted    -
-    First turn turn_duration recorded by Claude Code    2,247.9 s
The marker in ~/.mindrian/brain-prewarm.json was written at 09:10:37.178Z with ok:true. brain-prewarm is launched at the end of session-start (line 1962), so this confirms the foreground script itself took 37 minutes, rather than a background job holding the pipe open.

Where the time goes (timed rerun)
I re-ran the hook script directly with an xtrace timestamp on each line: PS4='+ ${EPOCHREALTIME} ${LINENO}: ' bash -x scripts/session-start. The active room was room-B. Exit 0, 569 s total, 17.7 KB of output.

analyze-room 489 s
compute-state 58 s
everything else ~22 s
session-start line    Call    Time
523    proactive_output=$("${SCRIPT_DIR}/analyze-room" "$ROOM_DIR"). Runs only on the "rich" tier    489.4 s
447    state_output=$("${SCRIPT_DIR}/compute-state" "$ROOM_DIR")    57.9 s
1064→1244    section walk block    6.3 s
Why the "rich" tier always runs at startup
CONTEXT_TIER="balanced"
if [ "$CTX_PCT_INT" -ge 70 ]; then CONTEXT_TIER="minimal"
elif [ "$CTX_PCT_INT" -lt 30 ] || [ "$USER_ARCHETYPE" = "venturist" ]; then
  CONTEXT_TIER="rich"          # context % is ~0 at session start, so this always wins
fi
The cost pattern in analyze-room (bash path, bash ≥ 4)
Per .md file: basename, a 6-stage grep|sed|sed|tr|grep|grep|sort pipeline, then one echo|grep -q per extracted term (lines 690-711). The cross-reference pass (lines 787-826) runs 2 × (sections − 1) grep calls per file, plus a node -e for every edge it finds. With about 140 content files and about 14 sections, that comes to several thousand process spawns. A loop of 10 empty /usr/bin/true calls takes 0.89 s here, about 89 ms per spawn, and Defender scans each new process. During the run, analyze-room's bash process had used 59.5 s of CPU after 453 s of wall time, so it spent most of its time waiting on process creation rather than computing.

All MindrianOS findings
P0 analyze-room is in the synchronous SessionStart path
489 s on a 136-file room. The real 2,226 s stall was on room-A (159 .md), while MCP servers and other hooks were starting at the same time; the analyze-room share of that run was not measured separately. The header claims under 2 s. File: scripts/analyze-room, called from scripts/session-start:523.

P0 Hook timeouts are not enforced on Windows
session-start ran 2,226 s against 10 s, on-stop ran ~40 s against 3 s, reference-now-seed ran 22.6 s against 5 s, and check-pending-breakthrough ran 28 s against 2 s. The process tree run-hook.cmd → bash.exe → children outlives the kill. Every script needs its own internal deadline.

P0 on-stop adds ~40 s after every assistant reply
run-hook.cmd on-stop: 41,296 ms and 39,030 ms on the two turns measured. Its configured timeout is 3,000 ms. The user can't send the next prompt until it finishes (the queue-operation records show a 12 s enqueue → dequeue wait).

P1 compute-state takes 58 s
Same per-file fork pattern (find, stat, wc, node spawns per section). It also runs on every agent completion via on-agent-complete.

P1 Each SessionStart hook pays its own node startup cost
Nine separate SessionStart hook groups, each launching node, plus about 61 node invocations inside session-start itself, many of which are node -e just to read one JSON field (lines 413-419, 494-499, 562-564, 756-760).

P1 Backgrounded subshells inherit the hook's stdout
( node … >/dev/null 2>&1 || true ) & still keeps the hook's stdout open in the parent subshell until the child exits. track-analytics … 2>/dev/null & (lines 591, on-stop:154) and the check-update subshell (line ~1838) don't redirect stdout at all. Any of these can keep Claude Code waiting after the script exits. Redirect the whole subshell, ( … ) >/dev/null 2>&1 &, or detach with setsid/disown.

P1 Synchronous auto-update inside session-start
With ~/.mindrian/auto-update present and a cached UPDATE_AVAILABLE, self-update install runs in the foreground (session-start ~line 1820) with no deadline. It didn't trigger this time, but it can stall startup the same way.

P2 brain-prewarm never exits on timeout
lib/core/brain-prewarm.cjs races the probe against a 15 s timer but doesn't call process.exit() afterwards, so an open MCP socket keeps the process alive. Add .finally(() => process.exit(0)) in the require.main block.

P2 Noisy stderr on every prompt
intent-classifier (1.2-5.2 s per prompt) prints ExperimentalWarning: SQLite is an experimental feature and Accessing non-existent property 'RECOMMENDED_CONFIDENCE_FLOOR' of module exports inside circular dependency. The circular require is a real bug. The warning can be silenced with --no-warnings=ExperimentalWarning.

P2 Other per-turn hook costs
hmi-compliance-poll --hook took 4.1 s on one Stop. send-event.ps1 spawns PowerShell on every Stop (0.9 s).

P2 Plugin cache hygiene
Old 2.0.0-beta.51/ and an orphaned 2.0.0-beta.65.tmp~704bf009/ are left behind after update. The update flow should clean these up.

P2 Registry state inconsistent
17 rooms of one family show status: active while the registry's active field is a different room (room-A). rooms list output can't be trusted to show which room is actually active.

Recommended fixes, in order
Take analyze-room and compute-state out of SessionStart. Inject the last cached STATE.md and analysis, then refresh them in a fully detached background job (( … ) >/dev/null 2>&1 </dev/null & disown) for the next session to use.
Port analyze-room and compute-state to a single node process. Node is native arm64 here, and one process reading about 140 files takes well under a second. The Python fallback inside analyze-room already shows the same logic as a single-process loop.
Give every hook script its own deadline (for example a node wrapper that does setTimeout(() => process.exit(0), budget), or timeout 8s on each heavy step) and fail open. Don't rely on Claude Code's timeout on Windows.
Make on-stop return immediately and do its snapshot and summary work detached.
Merge the nine SessionStart hooks into one node entry point that loads modules in-process instead of spawning a node process per JSON read.
Re-check the "rich" tier rule: ctx% < 30 is always true at startup, so every session pays the most expensive path.
Add a Windows ARM64 + Git Bash run to CI or perf tests, with a 2 s SessionStart budget assertion, and include a room of 150+ .md files in the fixture.

How to reproduce
P=~/.claude/plugins/cache/mindrian-marketplace/mos/2.0.0-beta.65
export CLAUDE_PLUGIN_ROOT="$P"
echo '{"session_id":"diag","source":"startup"}' | \
  PS4='+ ${EPOCHREALTIME} ${LINENO}: ' bash -x "$P/scripts/session-start" >out.txt 2>trace.txt
# rank slow steps
awk '$1=="+" && $2~/^[0-9.]+$/{print $2,$3}' trace.txt | \
  awk 'NR>1{d=$1-p; if(d>1.5) printf "%.1fs after line %s\n",d,pl}{p=$1;pl=$2}' | sort -rn
Process spawn baseline on the same machine: time (for i in $(seq 10); do /usr/bin/true; done) → 0.89 s real.

Not MindrianOS (user-side, listed for completeness)
13 MCP servers failed to connect at startup, 10 of them via a 30 s CONNECT_TIMEOUT. They're configured in ~/.mcp.json (arxiv, nanobanana, render, pinecone, my-neo4j, markitdown, …) and ~/.claude.json (blender, elevenlabs, langtalks). The plugin:mos:mindrian-os MCP server also timed out.
About 20 MCP server processes left over from a session ~6 h earlier were still running, along with a 14 h-old hyperframes preview and Codex runtime nodes. 91 node/python/bash processes in total, with 6.3 GB RAM free.
The impeccable SessionStart hook (settings.local.json) timed out at 17.9 s.
Only 31 GB free on C:.
Collected 2026-10-13 from session c3efb003-1fea-48ad-a956-d98930e8ef4a. All durations come from Claude Code's hook records or the xtrace rerun. Estimates are marked as such.
