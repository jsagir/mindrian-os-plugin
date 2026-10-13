# SEED-128: CRITICAL - SessionStart blocks the first prompt for 37 minutes on Windows ARM64

- Filed: 2026-10-13, session jsagi-49, on the owner's instruction ("seed a critical bug in mindrian-os plugin dev").
- Severity: P0, user-blocking. A user's first message waited 2,226 s (37 min) on one hook with a 10 s timeout.
- Reported against: v2.0.0-beta.65 (the plugin is now at beta.67; re-measure against current main before fixing).
- Status: seed, not started. The full measured report is preserved in SEED-128-source-bug-report.md (room names pseudonymised, nothing else changed).
- Next step when picked up: open a `/gsd-debug` session (kind: rca, per docs/RCA-TEMPLATE.md) to confirm each finding on current main, then fix through GSD.

## What happened, in one paragraph

On a Snapdragon (ARM64) Windows laptop, Git Bash is an x64 binary running under emulation, so every process spawn costs about 90 ms (Defender scans each one). `scripts/analyze-room` is a bash loop that spawns one subprocess per file, per section and per term (grep, basename, echo|grep, node -e): several thousand spawns on a 140-file room. It runs synchronously inside `scripts/session-start` (line about 523) on the "rich" context tier, and the rich tier always wins at session start because context percent is near 0 (session-start about line 442). A timed rerun: session-start 569 s, of which analyze-room 489 s and compute-state 58 s. Claude Code's 10 s hook timeout did not stop it: on Windows the tree run-hook.cmd -> bash.exe -> children outlives the kill. The script's own header says "Must complete in under 2 seconds".

## Findings (verbatim priorities from the report)

- P0 analyze-room in the synchronous SessionStart path (489 s on a 136-file room).
- P0 hook timeouts are not enforced on Windows (session-start 2,226 s vs 10 s; on-stop about 40 s vs 3 s; reference-now-seed 22.6 s vs 5 s; check-pending-breakthrough 28 s vs 2 s). Every script needs its own internal deadline.
- P0 on-stop adds about 40 s after every assistant reply.
- P1 compute-state takes 58 s (same per-file fork pattern; also runs on every agent completion via on-agent-complete).
- P1 nine SessionStart hook groups each pay node startup, plus about 61 node invocations inside session-start, many only to read one JSON field.
- P1 backgrounded subshells inherit the hook's stdout (`( node ... ) &` without redirecting the subshell; track-analytics, the check-update subshell).
- P1 synchronous auto-update inside session-start (no deadline).
- P2 brain-prewarm never exits on timeout (no process.exit after the race).
- P2 noisy stderr on every prompt from intent-classifier, including a real circular require (RECOMMENDED_CONFIDENCE_FLOOR).
- P2 other per-turn hook costs (hmi-compliance-poll 4.1 s; send-event.ps1 spawns PowerShell on every Stop).
- P2 plugin cache hygiene (old beta.51 and an orphaned beta.65.tmp directory left after update).
- P2 room registry inconsistent (17 rooms show status active while the registry's active field names another room).

## Recommended fixes (the report's order)

1. Take analyze-room and compute-state out of SessionStart: inject the last cached STATE.md and analysis, refresh in a fully detached background job for the next session.
2. Port analyze-room and compute-state to one node process (node is native arm64; one process over about 140 files is well under a second; the Python fallback already shows the single-process shape).
3. Give every hook script its own deadline and fail open; do not rely on Claude Code's timeout on Windows.
4. Make on-stop return immediately and do its work detached.
5. Merge the nine SessionStart hooks into one node entry point that loads modules in process.
6. Re-check the rich-tier rule (ctx% < 30 is always true at startup).
7. Add a Windows ARM64 plus Git Bash perf run with a 2 s SessionStart budget and a 150+ .md room fixture.

## Links to existing work (check before building; Canon Part 7)

- SEED-125 (thin on-stop) and quick 261012-rey (on-stop budget 570 to 680, SPEC-5 leg in run-all-366): related; the on-stop budget there is a byte or line budget, not wall time on Windows.
- tests/run-all-198.sh SPEC-5 hooks budget leg.
- Memory rule: three surfaces (CLI, Desktop, Cowork) and Tri-Polar; this is the CLI on Windows ARM64.
