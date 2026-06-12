---
quick_id: 260612-pkb
title: Conversation intake plumbing -- Stop hook reads transcript_path, writes real fragments + summary
status: complete
completed: 2026-06-12
canon_parts: [Part 8, Part 9, Part 10]
tasks_total: 4
tasks_complete: 4
key_files:
  created:
    - scripts/transcript-ingest.cjs
  modified:
    - scripts/on-stop
    - scripts/memory-lifecycle.cjs
commits:
  - 5b713779  # Task 1: transcript-ingest parser
  - 0a5ecf23  # Task 2: on-stop captures hook stdin
  - 41650407  # Task 3: ingest fragments at Stop + PreCompact
  - 6a527786  # Task 4: Part 8 gate fix on transcript-ingest comments
---

# Quick Task 260612-pkb: Conversation Intake Plumbing Summary

Fed the single missing seam in the 3-layer memory: the Stop (and PreCompact) hook now
captures Claude Code's `transcript_path`, parses the conversation offline, and writes the
real `user`/`assistant` turns into the active room's `room.db` fragments table. Every
dormant downstream reader (the voice_log writer, `sessions.summary`, the RECENT SESSIONS
resume block) lit up with zero changes to those readers. The Brother Test now works:
close at 11pm, reopen and `session-start` renders a real multi-sentence summary of the
prior session.

## What shipped (per task)

### Task 1 -- scripts/transcript-ingest.cjs (new, offline parser)
- `parseTranscript(path)` returns ordered `Array<{role, content}>` from a Claude Code
  transcript JSONL. User turns: string content used directly; array content keeps only
  `text` blocks (drops `tool_result`). Assistant turns: array of blocks, keeps only `text`
  (drops `thinking` and `tool_use`). Skips empty/whitespace turns and user hook/command
  chrome (`<command-` / `<local-command` / `<system-reminder`). Per-fragment cap 4000
  chars, whole-session cap 1000 fragments (most-recent slice, chronological order kept).
- `buildSummary(fragments)` produces a 3-5 sentence extractive offline summary
  (turn count + Opening + Latest + optional Also-raised), no em-dashes, capped at 800 chars.
- Zero network, zero remote calls, pure read+parse. Returns `[]` / `''` on any failure.

### Task 2 -- scripts/on-stop (hook stdin capture)
- After `PLUGIN_ROOT` (line 21), before any other stdin consumer, captures the Stop hook
  stdin JSON ONCE (`HOOK_STDIN="$(cat 2>/dev/null || true)"`), extracts `transcript_path`
  via a node one-liner, and `export MINDRIAN_TRANSCRIPT_PATH` when present.
- Guarded under `set -euo pipefail` (`|| true` on both `cat` and the node extraction) so a
  manual run with no stdin neither hangs nor errors. `MINDRIAN_MEMORY_DEBUG=1` prints the
  resolved path to stderr. The line-37 `USER_ARCHETYPE` subshell (which pipes its own
  command output, not hook stdin) is unaffected.

### Task 3 -- scripts/memory-lifecycle.cjs (ingest + real summary)
- New `ingestTranscriptFragments(db, sessionId, memory, transcriptIngest)` helper: reads
  `MINDRIAN_TRANSCRIPT_PATH`, idempotency-guards on an existing user/assistant fragment
  count for the session (Stop/PreCompact can fire more than once), then writes each turn
  via `memory.addFragment` (awaited; per-fragment try/catch).
- `cmdStop` and `cmdPreCompact` now ingest BEFORE summarize/endSession, and build the
  summary with `transcriptIngest.buildSummary` over the real fragments; the legacy
  `summarizeSession` stub remains the no-transcript fallback. The 84-07 voice_log writer
  (unchanged) now finds real fragments, so `question` / `answer_summary` populate.
- File-header comment block updated: documents the intake and that the extractive summary
  supersedes the D-12 "last 3 fragments, 500 chars" stub for the populated case.
- `cmdPostCompact` deliberately untouched (it opens a fresh session).

### Task 4 -- Integration smoke + Part 8 gate (verification only)
All four checks green (evidence below). One in-scope fix was required (see Deviations).

## Verification evidence (actual output, not assertion)

**Task 1** (`node --check` + real transcript + missing path):
```
syntax OK
frags 14 [ 'user', 'assistant' ]
summary: Session covered 14 exchanges. Opening: we did update to beta 20 recenlty with a GSD cycle Latest: Plan is written and precise. Also raised: ...
missing parse: []
empty summary: ""
```

**Task 2** (`bash -n` + manual run with transcript_path + no-stdin run):
```
syntax OK
EXIT=0
[on-stop] MINDRIAN_TRANSCRIPT_PATH=/home/jsagi/.claude/projects/-home-jsagi/2b81bb0d-...jsonl
{"continue":true,"systemMessage":"session snapshot saved, 9 sections drained, health low | SESSION SUMMARY: ..."}
no-stdin run: EXIT=0 (no hang)
```

**Task 3** (temp room, stop with transcript):
```
syntax OK
fragment rows: 15
by role: {"user":3,"assistant":11,"session-summary":1}   # 14 conversational + 1 summary
summary: "Session covered 14 exchanges. Opening: we did update to beta 20 ... Latest: Plan is written and precise. Also raised: ..."
voice_log question non-null: true
voice_log answer_summary non-null: true
```

**Task 3 graceful degradation** (no transcript / empty transcript -- byte-identical to today):
```
conversational fragments (expect 0): 0
session-summary fragment content (expect "session ended"): "session ended"
sessions.summary (expect null): null
empty-transcript conversational fragments (expect 0): 0
empty-transcript session-summary (expect "session ended"): "session ended"
```

**Task 4 end-to-end + idempotency**:
```
(a) conversational fragments: 14 PASS
(b) summary multi-sentence: PASS -> "Session covered 14 exchanges. Opening: we did update to beta 20 recenlty with a "
(c) voice_log question+answer non-null: PASS
(d) conversational fragments before 2nd stop: 14, after: 14 -> PASS (no double-ingest)
```

**Task 4 resume proof (Brother Test)** -- `session-start` RECENT SESSIONS block:
```
## RECENT SESSIONS IN THIS ROOM
...
- 2026-06-12T15:30:32.847Z session 1: Session covered 14 exchanges. Opening: we did update to beta 20 recenlty with a GSD cycle Latest: Plan is written and precise. Also raised: ...
```

**Task 4 Part 8 grep gate** (`grep -nE "fetch|https?:|brain|tavily|onrender" scripts/transcript-ingest.cjs`):
```
Part8: PASS (zero matches)
```

**Task 4 syntax**:
```
bash -n scripts/on-stop          PASS
node --check scripts/memory-lifecycle.cjs   PASS
node --check scripts/transcript-ingest.cjs  PASS
```

**Em-dash HARD RULE** (the three changed files): zero matches (PASS).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Part 8 grep gate tripped by transcript-ingest's own comments**
- **Found during:** Task 4 (Part 8 gate run).
- **Issue:** The Task-1 file header described the Part 8 boundary using the literal
  forbidden tokens (`fetch`, `http`, and the grep pattern `brain|tavily|onrender` itself),
  so `grep -nE "fetch|https?:|brain|tavily|onrender" scripts/transcript-ingest.cjs` matched
  its own comment lines. The mandatory gate (return ZERO matches) failed.
- **Fix:** Reworded the file-header comment to state the zero-egress guarantee without any
  network or remote-endpoint token (and removed the self-referential grep pattern).
  Comment-only; parser output is byte-identical (re-verified: 14 frags, same summary).
- **Files modified:** scripts/transcript-ingest.cjs
- **Commit:** 6a527786

No other deviations. Tasks 1-3 executed exactly as written.

## Canon gate compliance

- **Part 8 (Graph Boundary):** the whole intake path is local. `transcript-ingest.cjs`
  makes zero network/remote calls (grep gate clean); fragments and summaries land only in
  the active room's `room.db`. No user content egresses.
- **Part 9 (Memory Locality):** this writes the within-session substrate (fragments) that
  across-session summary + resume read. No truth-claim nodes are written and nothing is
  promoted to `confirmed`, so the human-confirm rule is untouched.
- **Tri-Polar:** CLI is the surface where the Stop hook + `transcript_path` exist. On
  Desktop/Cowork where the hook may not fire or the path is absent, the existing graceful
  no-op (cmdStop returns on no pointer; falls through to stub on no fragments) is preserved
  and proven byte-identical above.
- **Reuse before build (Part 7):** the readers (`loadAllFragments`, `writeVoiceLogRow`,
  `endSession`, `addFragment`) were reused unchanged; only the one intake seam was added.
- **No em-dashes:** verified zero in all three changed files.

## Out of scope (not built, per plan)

- Periodic mid-session digest writes ("every N turns") -- this task covers the Stop +
  PreCompact boundaries only.
- LLM-based summarization -- no model call is available in a synchronous hook; the
  extractive summary is the correct scope and supersedes the D-12 stub for the populated case.
- The persona_override / synthetic-persona isolation layer (the OTHER QA report). The
  half-built seam is `detectPersonaUpdate`'s `user_override` enum case, confirmed live at
  `lib/core/user-md-ops.cjs:499-500` (`signal.source === 'user_override' -> shouldUpdate`).
  **Recommended next quick task:** wire/guard that persona-override path.

## Self-Check: PASSED
- FOUND: scripts/transcript-ingest.cjs
- FOUND: scripts/on-stop (modified)
- FOUND: scripts/memory-lifecycle.cjs (modified)
- FOUND commit: 5b713779
- FOUND commit: 0a5ecf23
- FOUND commit: 41650407
- FOUND commit: 6a527786
