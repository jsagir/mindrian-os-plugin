---
phase: 246-live-verification-graph-census
plan: 01
subsystem: brain-verification
tags: [brain, loop, live-verification, hooks, beta13, checkpoint]

# Dependency graph
requires: []
provides:
  - loop01-preflight-of-record (Task 1 complete; Task 2 fresh-session checkpoint OPEN)
affects: [phase-247, phase-248, phase-250]

# Tech tracking
tech-stack:
  added: []
  patterns: [read-only preflight before a hooks-load-at-session-start human checkpoint]

key-files:
  created: []
  modified: []

key-decisions:
  - "Task 1 (automated preflight) executed in full from this orchestration session, which itself runs a stale pre-beta.13 loaded cache; this is safe because all four pre-checks are session-independent (disk/env/network state), not hook-path exercises."
  - "Task 2 (the three-call live Brain test) was NOT attempted from this session. Per the hard constraint given for this execution and per the plan's own design (hooks load at session start; this session's loaded hooks are stale even though beta.13 is installed on disk), only a FRESH session can produce a valid result. Attempting it here would produce a void result per the plan's own Pitfall 1."
  - "No repo files modified; per plan design this is a read-only preflight plus a human checkpoint. Nothing to commit under task_commit_protocol for Task 1 itself."

requirements-completed: []  # LOOP-01 NOT complete - Task 2 checkpoint open, awaiting a fresh session. See checkpoint below.

# Metrics
duration: ~5min (Task 1 only; Task 2 not run)
completed: 2026-08-10
---

# Phase 246 Plan 01: Live Verification of the Beta.13 Brain Path (LOOP-01) Summary

**Preflight green (cache=1.16.0-beta.13 on disk, key resolves read-tier via env, Render /health OK, 245 fence PASS=19/FAIL=0); the fresh-session three-call Brain test is a checkpoint that only a NEW Claude Code process can perform and remains OPEN.**

## Performance

- **Duration:** ~5 min (Task 1 only)
- **Started:** 2026-08-10T09:26:39Z
- **Tasks:** 1 of 2 completed (Task 1); Task 2 is the checkpoint, currently open
- **Files modified:** 0

## Accomplishments

- Ran all four Task 1 pre-checks from this session (all four are session-independent: disk, env, network, and the 245 scriptable fence). All four PASSED.
- Confirmed the plan's own constraint holds: THIS session runs a stale pre-beta.13 loaded hook set even though beta.13 is installed on disk (lastUpdated 2026-08-10T07:43:38.753Z) - hooks load at session start, so the live matcher + sanitize-envelope path cannot be exercised here. Stopped at the checkpoint exactly as designed; did not attempt the three-call test from this session.

## Task Commits

No commits made. Task 1 is read-only (`files_modified: none` per plan) and produced no repo changes; nothing was staged. Task 2 is the open checkpoint - no work to commit yet.

## Pre-flight Results (Task 1, verbatim)

**Pre-check 1 - installed plugin cache version:**
```json
[
  {
    "scope": "user",
    "installPath": "/home/jsagi/.claude/plugins/cache/mindrian-marketplace/mos/1.16.0-beta.13",
    "version": "1.16.0-beta.13",
    "installedAt": "2026-04-10T05:54:02.601Z",
    "lastUpdated": "2026-08-10T07:43:38.753Z",
    "gitCommitSha": "23d3b5a2d0fe9a4f4dfc6c60a3a0007791d8b637"
  }
]
```
Result: PASS. Version 1.16.0-beta.13, installPath ends in `/mos/1.16.0-beta.13`.

**Pre-check 2 - key resolves (`resolveBrainKey()`):**
```
available: true
source: env
reason: (none)
```
Result: PASS. Key bytes never printed (T-246-05).

**Pre-check 3 - Render deployment health:**
```
{"status":"ok","graph":true}
```
Result: PASS.

**Pre-check 4 - 245 envelope/guard fence (`bash tests/run-all-245.sh`):**
```
Phase 245: PASS=19 FAIL=0 SKIP=0
```
Result: PASS. All 19 test files passed, including claim (c) content-free-introspection-allow and claim (d) user-content-still-blocked in `test-245-brain-envelope-shape.cjs`.

All four pre-checks passed. Per the plan, execution proceeds to Task 2.

## CHECKPOINT OPEN: Task 2 - Fresh-Session Three-Call Brain Test (LOOP-01)

**Status:** NOT DONE. This is `type="checkpoint:human-verify" gate="blocking"` and is human-only by construction - hooks load at session start, so no script and no task in the current (stale-cache) session can exercise the live matcher + sanitize-envelope path.

### What the operator must do (verbatim from the plan)

1. Open a NEW Claude Code session (a fully new process, not `/clear`) in `/home/jsagi/dev/MindrianOS-Plugin`. Any session started before 2026-08-10T07:43Z runs the stale pre-beta.13 cache and its result is void.

2. In that fresh session, run these three tool calls IN ORDER, using EXACTLY these plugin-scope tool names (never the `mcp__pws-brain-mcp__*` project scope - the plugin hooks do not match it; that scope is how the outage stayed invisible):

   | # | Tool call | Arguments | Expected |
   |---|-----------|-----------|----------|
   | 1 | `mcp__plugin_mos_mindrian-brain__brain_stats` | `{}` | JSON with `"backend":"memgraph"`, totalRecordCount around 28,325, relationshipCount around 23,014, 9 vector indexes (1 e5-queryable). Numbers may drift; assert numeric PRESENCE, not exact equality |
   | 2 | `mcp__plugin_mos_mindrian-brain__brain_search` | `{"query":"jobs to be done framework"}` | Pinecone-shape result with hits containing methodology content. Known non-fatal issues to RECORD, not fix: flat ~0.925 scores, empty framework metadata, source_file local-path leak (CONTRACT-03, Phase 247 scope) |
   | 3 | `mcp__plugin_mos_mindrian-brain__brain_ask` | `{"question":"which framework helps identify customer jobs and desired progress?"}` | A DirectiveEnvelope with a synthesized methodology answer (server-side three-arm router). Keep the question generic methodology language, Part 8 |

3. If ANY call fails, copy the failure VERBATIM (the exact error text, in full) and decode it against this table before touching anything:

   | Signature | Meaning | Action |
   |-----------|---------|--------|
   | "e.reduce is not a function" | The RUNNING session loaded a pre-beta.13 cache (non-array updatedToolOutput) | Restart the session; re-run pre-check 1. Do NOT diagnose network or server |
   | PreToolUse egress-guard BLOCK on call 2 | Old guard (pre-PR #2) in the loaded cache | Same: stale cache, restart |
   | Tier-0 sentinel (DIRECTOR_NOT_AVAILABLE shape) on ALL three calls | Key not loaded. Resolution order: MINDRIAN_BRAIN_KEY env, then ~/.mindrian.env, then CWD .env; SEC-02 rejects group/world-readable key files (needs 0600) and logs one stderr line "[mindrian-os] Brain key not loaded: <reason>" | Re-run pre-check 2; fix env or file perms |
   | brain_stats OK but a brain_query attempt returns the tier-0 sentinel | NOT an outage: HTTP 403 admin gate (the current key is READ tier; brain-client conflates 403 with unreachable). Verified live 2026-08-10 | Expected on the read key. Report as the admin-tier gate, never as "Brain down". Lane B of Plan 246-02 handles it |
   | All calls null AND key reason clean | Network or Render outage | curl https://pws-brain-mcp.onrender.com/health; check the Render dashboard |

4. Report the outcome of all three calls VERBATIM - paste the actual outputs (or failures), never a summary like "it worked". Recording the three known non-fatal search issues from row 2 above is part of a PASS, not a failure.

### Resume signal (verbatim from the plan)

Type "approved" with the pasted verbatim outputs of all three calls, or paste the verbatim failure plus which decode-table row it matched. On approval the executor writes the SUMMARY with the verbatim results as the LOOP-01 verification of record. On a stale-cache signature: operator restarts and re-runs; the checkpoint stays open. On any NEW FAILURE (no decode row matches): the executor files an RCA at `.planning/debug/<slug>.md` per `docs/RCA-TEMPLATE.md` (kind: rca, `git add -f`) and the checkpoint stays open - LOOP-01 is NOT done.

## Decisions Made

- Ran Task 1's full automated preflight from this session because all four checks are session-independent (disk, env, network, and the 245 scriptable fence never exercise the live hook path).
- Did not attempt the three-call live test from this session even though beta.13 is installed on disk, because THIS session's loaded hooks predate the 2026-08-10T07:43:38Z update - attempting it here would produce a void, misleading result per the plan's Pitfall 1.

## Deviations from Plan

None - plan executed exactly as written up to and including the checkpoint boundary. Task 1 automated in full; Task 2 stopped as designed for a `checkpoint:human-verify gate="blocking"` task.

## Issues Encountered

None. All four pre-checks passed on the first attempt.

## User Setup Required

None for Task 1. For Task 2: the operator must open a fresh Claude Code session (see checkpoint section above) and run the three plugin-scope Brain calls, then report the verbatim results back for the executor to record as the LOOP-01 verification of record.

## Next Phase Readiness

- Preflight is proven green; nothing blocks the fresh-session checkpoint from being run at any time.
- Phases 247/248/250 cannot yet cite a completed LOOP-01 pass - this plan is NOT complete. A follow-up execution (continuation agent) will record the fresh-session results once the operator provides them and update this SUMMARY, STATE.md, and REQUIREMENTS.md accordingly.
- Plan 246-02 (Lane A of the census) already landed independently per its own SUMMARY; Lane B and this plan's Task 2 are the two open items in Phase 246.

---
*Phase: 246-live-verification-graph-census*
*Status: CHECKPOINT OPEN (Task 2 of 2) - not complete*

## Self-Check: PASSED
- FOUND: `.planning/phases/246-live-verification-graph-census/246-01-SUMMARY.md`
- No commit hashes to verify (Task 1 produced no repo changes; Task 2 is an open checkpoint).
