---
quick_id: 260612-pkb
title: Conversation intake plumbing — Stop hook reads transcript_path, writes real fragments + summary
status: ready
canon_parts: [Part 8, Part 9, Part 10]
must_haves:
  truths:
    - "The Stop hook captures hook-stdin JSON and extracts transcript_path."
    - "On session stop, user/assistant turns from the transcript are written to the fragments table as role='user'/'assistant' fragments, in chronological order, scoped to the active room's room.db ONLY."
    - "sessions.summary is populated with a 3-5 sentence extractive summary built from the now-populated fragments (never the bare 'session ended' stub when real turns exist)."
    - "The existing voice_log writer (writeVoiceLogRow) and RECENT SESSIONS resume block light up automatically because fragments now exist — no change needed to those readers."
    - "Zero user-content egress to Brain: all writes are LOCAL room.db (Canon Part 8)."
    - "Graceful no-op on every failure path: missing transcript, unreadable JSONL, no active session, no node:sqlite — never crash the session (exit 0)."
  artifacts:
    - scripts/on-stop
    - scripts/memory-lifecycle.cjs
    - scripts/transcript-ingest.cjs
  key_links:
    - scripts/on-stop:193
    - scripts/memory-lifecycle.cjs:278
    - scripts/memory-lifecycle.cjs:128
    - lib/core/memory-ops.cjs:293
---

# Quick Task 260612-pkb: Conversation Intake Plumbing

## Problem (from QA: Persona Test Debrief + Context Volatility Report, v1.13.1-beta.20)

The 3-layer memory has complete schemas but **no conversation intake**. Root cause, verified
in code: **nothing reads Claude Code's `transcript_path` hook field**, so the `fragments`
table is never populated. Consequences confirmed in `scripts/memory-lifecycle.cjs`:

- `cmdStop` (line 278) ALREADY harvests `user`/`assistant` fragments (`loadAllFragments` line 198)
  and builds a real `voice_log` row (lines 303-320) — but the table is empty, so it always
  falls through to the stub.
- `summarizeSession` (line 128) concatenates the last 3 fragments — of an empty table — so
  `sessions.summary` is always the `'session ended'` stub.
- The RECENT SESSIONS resume block (`formatHistoryBlock` line 146) and `memory-resume-nudge.cjs`
  already render `summary` — they just have nothing real to show.

**The fix is one seam:** feed fragments from the transcript at Stop. Every dormant downstream
reader (voice_log, summary, resume nudge) lights up with zero changes.

This fixes the "Brother Test" (close laptop at 11pm, open at 8am → Larry references the prior
session) and Context Volatility failure modes #2 (session termination) and #3 (unfiled insights).

## Constraints (MindrianOS gates — MANDATORY)

- **Canon Part 8 (Graph Boundary):** fragments are LOCAL `room.db` only. NO Brain egress. NO
  network calls anywhere in this change. Do NOT add any fetch/http/Brain call.
- **Canon Part 9:** fragments are within-session memory (substrate); this writes the substrate
  that across-session summary + resume read. No truth-claim nodes are written (no `confirmed`
  status), so the human-confirm rule is not touched.
- **Tri-Polar (CLI / Desktop / Cowork):** the Stop hook + transcript_path is a CLI-surface
  mechanism. On Desktop/Cowork the hook may not fire or transcript_path may be absent — the
  existing graceful no-op (cmdStop returns when no pointer; falls through to stub when no
  fragments) MUST be preserved so those surfaces are unaffected.
- **No em-dashes in any shipped output strings** (HARD RULE). Use hyphens.
- **Reuse before build (Part 7):** do NOT touch the readers. Reuse `addFragment`,
  `loadAllFragments`, `writeVoiceLogRow`, `endSession` exactly as they are.
- **Never crash the session:** all new code paths are try/catch + silent no-op + exit 0,
  matching the existing `memory-lifecycle.cjs` failure-mode contract (lines 34-37, 458-466).

## Tasks

### Task 1 — New module: scripts/transcript-ingest.cjs (transcript parser)

**files:** scripts/transcript-ingest.cjs (new)

**action:** Create a small, dependency-free CJS module that parses a Claude Code transcript
JSONL file into ordered conversation fragments.

Export `parseTranscript(transcriptPath)` returning `Array<{role, content}>`:
- Read the file at `transcriptPath`. If it does not exist or is unreadable, return `[]`.
- Split on newlines; `JSON.parse` each line inside try/catch (skip malformed lines).
- Keep ONLY records where `type === 'user'` or `type === 'assistant'` AND `record.message` exists.
  - `user`: `message.content` is a STRING in normal turns (verified). If it is a string, use it.
    If it is an array, keep only blocks where `block.type === 'text'` (join their `.text`);
    DROP `tool_result` blocks. Skip the turn if the resulting text is empty.
  - `assistant`: `message.content` is an ARRAY of blocks (verified). Keep ONLY `block.type === 'text'`
    blocks (join with "\n"); DROP `thinking` and `tool_use` blocks. Skip if empty.
- Skip turns whose extracted text is empty or whitespace-only.
- Skip obvious non-conversational user turns: text starting with `<command-` / `<local-command`
  / `<system-reminder` (hook/command chrome), and pure tool-result echoes.
- Preserve transcript order (the file is already chronological).
- Per-fragment safety cap: truncate any single fragment's content to `MAX_FRAGMENT_CHARS = 4000`.
- Whole-session cap: return at most `MAX_FRAGMENTS = 1000` (keep the most recent if exceeded,
  but preserve chronological order of the kept slice).
- NO network, NO Brain, NO writes — pure read+parse.

Also export a tiny `buildSummary(fragments)` helper used by Task 3 (extractive, offline):
- If no fragments, return `''`.
- Compose 3-5 sentences from real content, no em-dashes:
  - Sentence 1: turn count, e.g. `"Session covered N exchanges."`
  - Sentence 2: opening ask — first `user` fragment, first sentence, truncated to ~200 chars,
    prefixed `"Opening: ..."`.
  - Sentence 3: latest focus — last `assistant` fragment, first sentence, truncated ~200 chars,
    prefixed `"Latest: ..."`.
  - Optionally Sentence 4: if a later `user` fragment differs from the first, add
    `"Also raised: ..."` (truncated). Keep total <= 5 sentences and <= 800 chars.
- Return the joined string.

**verify:** `node -e "const t=require('./scripts/transcript-ingest.cjs'); const f=t.parseTranscript(process.argv[1]); console.log('frags',f.length, f.slice(0,2).map(x=>x.role)); console.log('summary:', t.buildSummary(f).slice(0,300))" <path-to-a-real-jsonl-in ~/.claude/projects/-home-jsagi/>` prints a non-zero fragment count, roles user/assistant, and a multi-sentence summary.

**done:** module created, both exports work against a real transcript, returns `[]` / `''` for a missing path without throwing.

### Task 2 — scripts/on-stop: capture hook stdin, extract transcript_path, export env var

**files:** scripts/on-stop

**action:** Near the top of `on-stop` (after `PLUGIN_ROOT` is set, line ~21, BEFORE the
`memory-lifecycle.cjs stop` call at line 199), capture the hook stdin JSON ONCE and extract
`transcript_path`, exporting it for the lifecycle subprocess.

- `on-stop` currently does NOT consume its stdin (line 37 pipes a different command's output,
  not the hook stdin), and `run-hook.cmd` does `exec bash .../on-stop "$@"`, so the hook JSON
  is on `on-stop`'s stdin. Capture it defensively so a manual run without stdin cannot hang:
  ```bash
  HOOK_STDIN="$(cat 2>/dev/null || true)"
  if [ -n "$HOOK_STDIN" ]; then
    TRANSCRIPT_PATH="$(printf '%s' "$HOOK_STDIN" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.transcript_path||'')}catch(_){process.stdout.write('')}})" 2>/dev/null || true)"
    if [ -n "$TRANSCRIPT_PATH" ]; then export MINDRIAN_TRANSCRIPT_PATH="$TRANSCRIPT_PATH"; fi
  fi
  ```
  - Capture stdin EXACTLY ONCE and reuse `$HOOK_STDIN` if any other future consumer needs it
    (stdin can only be read once). Place this capture before line 37 so nothing else races for stdin.
  - Note: line 37's `USER_ARCHETYPE` subshell pipes `user-archetype.cjs` output, not hook stdin,
    so it is unaffected — but confirm it still works after the capture is added.
- Must not break `set -euo pipefail`: the `|| true` guards both the `cat` and the node extraction.
- This is purely additive; STATE.md write path (line 27-30) and all other behavior unchanged.

**verify:** `printf '{"transcript_path":"/tmp/x.jsonl","session_id":"s"}' | bash -c 'source <(sed -n "1,40p" scripts/on-stop) ' ` is not a clean test; instead add a guarded debug line under `MINDRIAN_MEMORY_DEBUG=1` if helpful, and verify by Task 4 integration. Minimum: `bash -n scripts/on-stop` passes (syntax), and a manual `echo '{"transcript_path":"/path/real.jsonl"}' | MINDRIAN_MEMORY_DEBUG=1 bash scripts/on-stop` does not hang and does not error.

**done:** `MINDRIAN_TRANSCRIPT_PATH` is exported when the hook JSON carries `transcript_path`; script runs to completion with no stdin (manual) without hanging.

### Task 3 — scripts/memory-lifecycle.cjs: ingest fragments before summarize; real summary

**files:** scripts/memory-lifecycle.cjs

**action:** In `cmdStop` (line 278), BEFORE `summarizeSession`/`addFragment(session-summary)`/
`endSession`, ingest transcript fragments into the just-closing session. Then upgrade the
summary to the extractive multi-sentence form.

1. Add `const transcriptIngest = require(path.join(__dirname, 'transcript-ingest.cjs'));` (top-level
   require alongside the others, or lazy-require inside cmdStop for parity with existing lazy requires).
2. At the start of `cmdStop`, after `openRoomDb`, before `summarizeSession`:
   ```js
   // Idempotency guard: only ingest if no real conversation fragments exist yet
   // for this session (Stop can fire more than once).
   const transcriptPath = process.env.MINDRIAN_TRANSCRIPT_PATH || '';
   if (transcriptPath) {
     let alreadyHas = 0;
     try {
       const row = handle.db.prepare(
         "SELECT COUNT(*) AS n FROM fragments WHERE session_id = ? AND role IN ('user','assistant')"
       ).get(pointer.id);
       alreadyHas = (row && row.n) || 0;
     } catch (_) { alreadyHas = 0; }
     if (alreadyHas === 0) {
       const turns = transcriptIngest.parseTranscript(transcriptPath); // [] on any failure
       for (const t of turns) {
         if (!t || !t.content) continue;
         try {
           await memory.addFragment(handle.db, {
             session_id: pointer.id,
             role: t.role === 'assistant' ? 'assistant' : 'user',
             content: t.content,
           });
         } catch (_) { /* per-fragment graceful */ }
       }
     }
   }
   ```
3. Upgrade summary: replace the `summarizeSession(handle.db, pointer.id)` call result usage so
   that when real fragments exist, a 3-5 sentence summary is produced. Simplest: after ingest,
   load fragments and call `transcriptIngest.buildSummary(...)`:
   ```js
   const harvested = loadAllFragments(handle.db, pointer.id);
   const convoFrags = harvested.filter(f => f && (f.role === 'user' || f.role === 'assistant'));
   const summary = convoFrags.length > 0
     ? transcriptIngest.buildSummary(convoFrags)
     : summarizeSession(handle.db, pointer.id); // legacy fallback, unchanged behavior
   ```
   Keep the existing `addFragment(session-summary)` + `endSession({summary, ...})` calls; they
   now receive the real summary. The downstream voice_log block (lines 303-320) already reads
   `loadAllFragments` and finds the real user/assistant fragments — leave it untouched (it will
   now populate question/answer_summary/artifacts_cited correctly).
4. Apply the SAME ingest+summary pattern to `cmdPreCompact` (line 366) so a compact boundary also
   captures the conversation before the context is discontinued (Context Volatility failure mode #1).
   Mirror the idempotency guard. `cmdPreCompact` has no `pointer` variable name collision — it reads
   `pointer` the same way. Do NOT change `cmdPostCompact` (it opens a fresh session).
5. Update the file header comment block (lines 21-37): note that v1.14-era intake now populates
   fragments from `MINDRIAN_TRANSCRIPT_PATH` and the summary is extractive over real turns
   (supersedes the D-12 "last 3 fragments, 500 chars" note for the populated case). No em-dashes.

**verify:** Construct a temp room.db via room-db.openRoomDb on a temp dir, write a fake session
pointer, set `MINDRIAN_TRANSCRIPT_PATH` to a real transcript, run `node scripts/memory-lifecycle.cjs stop <tmpRoomDir>`, then query `SELECT role, substr(content,1,60) FROM fragments` and `SELECT summary FROM sessions` — fragments table has user/assistant rows and summary is multi-sentence (not 'session ended').

**done:** with a transcript present, fragments are populated and sessions.summary is a real 3-5
sentence summary; with no transcript / empty transcript, behavior is byte-identical to today
(stub fallback), proving graceful degradation.

### Task 4 — Integration smoke + Part 8 grep gate

**files:** (no source change; verification only — may add a test under tests/ if cheap)

**action:**
- End-to-end: pick a real transcript from `~/.claude/projects/-home-jsagi/*.jsonl`, create a
  throwaway temp room dir with a `.mindrian/current-session.json` pointer pointing at a session
  row created via `memory-lifecycle.cjs session-start <tmpdir>`, export `MINDRIAN_TRANSCRIPT_PATH`,
  run `stop`, and confirm: (a) fragments populated, (b) summary multi-sentence, (c) voice_log row
  has non-null question/answer_summary, (d) a second `stop` does NOT double-ingest (idempotency).
- Resume proof: run `memory-lifecycle.cjs session-start <tmpdir>` again and confirm the RECENT
  SESSIONS block on stdout now shows the real summary (Brother Test).
- **Part 8 gate (MANDATORY):** `grep -nE "fetch|https?:|brain|tavily|onrender" scripts/transcript-ingest.cjs` returns ZERO matches. The whole intake path is local.
- `bash -n scripts/on-stop` passes; `node --check scripts/memory-lifecycle.cjs` and
  `node --check scripts/transcript-ingest.cjs` pass.

**verify:** all four checks pass; Part 8 grep returns nothing.

**done:** integration smoke green, idempotency confirmed, resume block shows real summary, Part 8 grep clean.

## Out of scope (note in SUMMARY, do not build)

- Periodic mid-session digest writes (Context Volatility recommendation: "every N turns") —
  this plan covers Stop + PreCompact boundaries only.
- The persona_override / synthetic-persona isolation layer (the OTHER QA report). Separate concern;
  the half-built seam is `detectPersonaUpdate`'s unused `user_override` enum case in
  lib/core/user-md-ops.cjs. Flag it in SUMMARY as the recommended next quick task.
- Any LLM-based summarization (no model call available in a synchronous hook; extractive is the
  correct scope here, and supersedes the D-12 stub for the populated case).
