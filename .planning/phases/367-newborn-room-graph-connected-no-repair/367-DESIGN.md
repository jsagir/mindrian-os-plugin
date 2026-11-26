---
phase: 367
title: "The graph writes itself: one catch-up runner for files and answered cards, on every surface"
status: DESIGN r7 (after Goldfish rounds 1-5, cap reached; reports 367-GOLDFISH-REPORT-R1.md to -R5.md)
date: 2026-11-26
canon_parts: [3, 8, 9, 11]
absorbs: SEED-101; the record half of Phase 280 / SEED-008
depends_on: none hard. 400.3-01/02/02b are soft: stand-ins (section 4) are swapped when they land
base: origin/main 2179801e2
owner_rulings:
  OR-1: "A CLI card answer (AskUserQuestion) is the human's approve: it lands as a confirmed decision node" (owner card 2026-11-26; changes the locked HITL rule for this one input)
  OR-2: "Run it end to end: full Goldfish work, apply the fix, register it as a GSD phase" (owner 2026-11-26)
  OR-3: home Phase 367
---

# 367 Design r7: the graph writes itself

## 1. Goals and non-goals

Need, in the owner's words: "I find myself many times asking for local graph writing ... this needs
to be an automated process."

Goals:
- G1 Every content file of a room in the shared artifact set (5.1) reaches
  `<room>/.mindrian/room.db` as an Artifact node with no model tool call: on the CLI at every turn
  end and session start; on Desktop and Cowork at every governed mindrian-os tool call (5.3).
- G2 Every card the navigator answers in the terminal lands as one confirmed decision (OR-1), from a
  host-attested record only, in the session's bound room, or, with no binding, in the room that holds
  the working folder. With neither, or with a true cross-room conflict, nothing lands (counted).
- G3 Honest status: a room status file and doctor counts show what is behind and why.

Non-goals: claim extraction, baskets and cards from transcript text; the filing contract check;
in-session derive drain; turn, session and per-turn memory_event rows; fragment ingest rework (R8)
and the `key_decisions` merge (a `/gsd-quick` follow-up with a reproduction); removing nodes of
deleted files; scaffold files as Artifacts (5.1); `meetings/`, `team/`, `references/` and files
deeper than one nested level (the existing `discoverSections` rule); top-level sub-rooms (each is
caught up by its own trigger); cross-machine concurrency on a shared or synced folder (one machine
writes a room at a time); resume-only sessions get no SessionStart run (the first Stop covers them); a change to the RULE 10 large room leg (AC10 bounds the runner instead).

## 2. Root causes (PROVEN unless marked)

| # | Cause | Evidence |
|---|---|---|
| R1 | The post-write cascade, the only per-write path that makes an Artifact node, skips `~/MindrianRooms/` (case-sensitive `/room/` or `/rooms/` test). The hook printed "post-write: cascade skipped for 367-DESIGN.md" while this design was written | `lib/core/intelligence-cascade.cjs:182-184, 650-654`; `scripts/post-write:282` |
| R2 | `artifact_file` never indexes and returns `ok: true` | `lib/mcp/tools/views.cjs:408-440` |
| R3 | Every typed record needs a model tool call; the per-turn rule is prose | slice (d) list |
| R4 | No hook indexes a Bash or subagent write in an unmarked room | `hooks/hooks.json` |
| R5 | The transcript reader drops tool_use and tool_result, so card answers never reach the graph | `scripts/transcript-ingest.cjs:60, 77, 134` |
| R7 | MCP write tools call `fireCascade` with no filePath | `lib/mcp/tool-router.cjs:937-945, 1339, 1345` |
| R9 | `indexArtifact` and `rebuildGraph` open a deferred `BEGIN`; a read before the first write (the PRAGMA at `node-insert.cjs:148-151`) under a concurrent writer gives errcode 517 at once, with no busy wait (PROVEN on a scratch probe) | `lib/core/lazygraph-ops.cjs:628, 738` |

ICM framing: room.db is a generated index of room files, but the model keeps it by hand.

## 3. Principle

Files and answered cards are RECORDS: code captures them. A claim stays as today (`proposed`, only a
gate approve confirms). OR-1 is the one ruled exception: an answered terminal card is the approve.

## 4. Ownership: 367 versus 400.3

| Item | Owner |
|---|---|
| `artifact_file` inline index; `busyMs`, `mustExist`, `lockWaitMs`, `classifyIndexError`, `acquireLockWithBackoff` | 400.3-01 |
| index-only post-write for marked rooms; `.room-root` use in the cascade | 400.3-02, 02b (`lib/core/room-root.cjs` exists today) |
| deferred `BEGIN` -> `BEGIN IMMEDIATE` (also Phase 273 M5) | 367 slice (a) |
| the runner, its spawn sites, the card ledger, the status file, doctor counts | 367 |
| cascade off the foreground (400.3 proposal plan 08) | 400.3; it may reuse `lib/mcp/graph-catchup-spawn.cjs` and takes the same per-room `write.lock` |
| `last-cascade.json` (per write) vs `graph-catchup.json` (per room) | both stay |

Stand-ins until 400.3-01 lands (each marked `// until 400.3-01` in code; a planned task swaps them):
- Room guard, strictly before any open: `resolveRoomRoot(cwd)` (`lib/core/room-root.cjs:59`) gives the
  room; then `fs.existsSync(<room>/.mindrian/room.db)`. `openGraph` would create room.db
  (`lazygraph-ops.cjs:440-463`), so it is never called before the guard.
- Busy wait: the default `timeout: 5000` (`:449`), harmless in a detached child.
- Lock: `acquireLock(roomDir)` once per batch (`write-lock.cjs:158`; it already retries 3 times and
  recovers a dead owner). A throw from a live holder, a cross-host claim or the recovery mutex is
  `write_lock_held`; any other throw is `lock_io_error`. `releaseLock(roomDir, handle)` after each
  batch.

## 5. The runner

### 5.1 One shared artifact set

New module `lib/core/content-artifacts.cjs` (requires `section-registry.cjs` at the top and
`scaffold-predicate.cjs` lazily inside the function, the `graph-backfill.cjs:372-374` pattern, so no
load-time cycle through `scaffold-template-index.cjs` -> `room-birth.cjs` -> `section-registry.cjs`).
`section-registry.cjs` is not changed.

`listContentArtifacts(roomDir)` returns `{files: [{rel, abs, id}], collisions: [{rel, id}]}` sorted
by `rel`: the passes of `rebuildGraph` (`discoverSections(resolved).all`, the flat files, one nested
level skipping `.room-root` children, the root files; `lazygraph-ops.cjs:727-811`) with an isFile
check on every pass (a directory named `x.md` is skipped), MINUS scaffold files (`isScaffoldFile`)
and MINUS files of a top-level section folder holding `.room-root`. `id` is `getArtifactId`, moved to
`content-artifacts.cjs` and re-exported by lazygraph-ops (pure `path` code). On an id collision the
order `.md`, `.docx`, `.html`, `.htm` wins.

`graph-backfill.cjs` `_artifactsToIndex` becomes `listContentArtifacts(root).files.map(f => f.abs)`.
New backfill set, stated exactly: today's set PLUS the root files, MINUS top-level sub-room files.
`rebuildGraph` keeps its own scope in this phase.

`lazygraph-ops.cjs` exports `computeHash` (md5 cut to 8 hex chars; a 32-bit compare, `:419-421`),
`_readArtifactContent`, and a SYNCHRONOUS `indexArtifactsBatch(conn, roomDir, items, canonCtx)`;
`items` are `{abs, content}` already read by the runner, and `_indexArtifactBody` gains an optional
`content` so nothing is read inside the transaction. Each item runs in a SAVEPOINT; it returns
`{indexed: [abs], failed: [{abs, code: 'node_write'}]}`. A transaction-level SQLite error is thrown,
not returned: `err.errcode` 5 BUSY, 6 LOCKED, 10 IOERR, 11 CORRUPT, 13 FULL. Read and parse failures
happen before the transaction (step 7) and are counted `files_failed` there.

### 5.2 One run

`scripts/graph-catchup.cjs --cwd <dir> [--session <id>] --trigger stop|session_start|mcp_call [--room <dir>]... [--run-seam <n>] [--hold-ms <n>]`

1. Kill switch `MOS_NO_GRAPH_CATCHUP=1` exits 0.
2. Room set (files are idempotent, so every candidate is safe to catch up): `resolveRoomRoot(cwd)`
   (`lib/core/room-root.cjs:59`, walk-up for `.room-root`, `''` when none); the session's bound room
   when `--session` is given (`resolveMcpSessionRoom({sessionId, noFloor: true})`, source
   `session.primary` only: the result is used only when `source === 'session.primary'`, because the
   resolver falls back to the registry with source `reg.active`, `resolve-active-room.cjs:510-522`);
   the `--room` value when it holds `.room-root` or is a registered room; the registry active room
   (`lib/core/resolve-active-room.cjs` `resolveActiveRoomDir`). Deduplicated by realpath. A candidate
   without `.mindrian/room.db` gets nothing: no lock, no mkdir, no status file, no cache (one stderr
   line `room_db_missing`). `openGraph` is never called before this check (it would create room.db,
   `lazygraph-ops.cjs:440-463`). The rooms share the run budget, cwd room first.
3. Worker caps: `lowerWorkerPriority()` and `armBackstop(30000)`, moved from
   `scripts/gsd-graph-derive-drain.cjs:896-923` to `lib/core/bg-worker.cjs` (the drain re-exports them
   for its `_test` at `:1037-1038`). `armBackstop` cannot interrupt the synchronous loop; the per-file
   deadline check is the real bound. A backstop exit skips the final status, so the doctor reads
   `run_pid_dead`.
4. Per room: `job-lock.cjs` `acquire('<room>/.mindrian/graph-catchup.lock', {job: 'graph-catchup'})`.
   `held` or `recovering`: skip the room (the next trigger catches up; the tree is the source).
   `error`: the room ends `failed`, reason `lock_io_error`.
5. Status file `<room>/.mindrian/graph-catchup.json` (atomic rename, 0600): `{schema: 1, state:
   'running', run_id, pid, started_at}` (ISO 8601 with ms).
6. Cards: drain this room's card spool (section 6).
7. Files: `openGraph` once (after the guard), the canon context once. Walk `listContentArtifacts`
   from the first `rel` greater than the cursor (lexical). Per file: `statSync`; when the cache entry
   `[mtimeMs, size, ino]` matches, skip; else read with `_readArtifactContent`, hash with
   `computeHash`, compare with `json_extract(properties,'$.content_hash')`. A match refreshes the cache
   entry; a difference or a missing node joins the batch with its content. A file gone since the
   listing is counted `files_vanished`.
8. Batches end at 10 files or 250 ms of collected work: `acquireLock`, `withRoomTx`
   (`navigation/room-change-log.cjs:188-205`, `BEGIN IMMEDIATE`) around `indexArtifactsBatch`,
   `releaseLock(roomDir, handle)`. A `failed` file is counted (`files_failed`) and retried next run;
   the cursor moves on. A thrown transaction error ends the room `failed`, reason `index_failed`, and
   counts against no file. `acquireLock` throws: a live holder, a cross-host claim or the recovery
   mutex is `write_lock_held` (cursor persisted, state `deferred`); the "could not be acquired after
   retry" message and any other throw are `lock_io_error`. Cache entries update only for indexed
   files; the cache is written atomically after each batch.
9. Budget: 15 s wall per run over all rooms, over files examined. On the budget the cursor is
   persisted and the room ends `partial` with `remaining`. A full pass resets the cursor and prunes
   entries of files not listed.
10. `closeGraph`; write the final status WHILE still holding the job lock; then release it:
    `{schema: 1, state, reason, run_id, trigger, started_at, last_run_at, files_seen, files_indexed,
    files_vanished, files_failed, id_collisions, cards_recorded, cards_rejected, cards_skipped,
    cards_failed, remaining}`. State: `complete`, `partial`, `deferred`, `failed`. Reasons:
    `write_lock_held`, `lock_io_error`, `room_db_busy`, `room_db_missing`, `index_failed`,
    `budget_exhausted`, `legacy_schema`. The worse state wins (failed > deferred > partial > complete).

Cache `<room>/.mindrian/graph-catchup-cache.json`: `{schema: 1, cursor: <rel or null>, entries:
{<rel>: [mtimeMs, size, ino, hash]}}`.

Test seams: `--run-seam <n>` exits after batch n; `--hold-ms <n>` sleeps before step 6.

### 5.3 How it is started

Spawn rule: `process.execPath`, `env: process.env`, `detached: true`, `stdio: 'ignore'`,
`windowsHide: true`, `child.on('error', noop)`, `child.unref()` (the same as the detached spawns at
`lib/core/ambient-trigger.cjs:342-347`). In bash the whole group is detached from the hook's pipes:
`( node ... || true ) </dev/null >/dev/null 2>&1 &`, so the subshell holds no hook stdout or stderr
(the P-5 failure recorded in `tests/test-261030-8vd-onstop-wait.cjs:13-16`).

CLI Stop, `scripts/on-stop`: the stdin parse at `:37` also reads `cwd` and `session_id` into
`HOOK_CWD` and `HOOK_SESSION` (empty when absent). Right after the Part 8 drain line (`:48`), before
the MCP-first branch, so both branches spawn:
`( node "${SCRIPT_DIR}/graph-catchup.cjs" --cwd "${HOOK_CWD:-$PWD}" --session "${HOOK_SESSION:-}" --trigger stop || true ) </dev/null >/dev/null 2>&1 &`
(the runner treats an empty `--session` as no session).
No variable set later in the script is used (`set -euo pipefail` at `:22`). The `hook-adapter-audit.cjs:75`
budget (680; on-stop measures 679 by `split('\n').length`) is re-based by its own rule at `:63-65`
(the smallest multiple of 10 at least the measured count + 20) to the count measured after the edit.

CLI SessionStart, `scripts/session-start`, after the heal net (`:132`):
`( node "${SCRIPT_DIR}/graph-catchup.cjs" --cwd "$PWD" --room "${ROOM_DIR:-}" --trigger session_start || true ) </dev/null >/dev/null 2>&1 &`
(no guard: the runner exits when there is no room). Matcher unchanged.

Desktop, Cowork and CLI MCP calls: `lib/mcp/graph-catchup-spawn.cjs` exports `installCatchupWrapper(s)`
and `flushPending()`. `scripts/mindrian-mcp-server.cjs` calls `installCatchupWrapper(s)` once right
after `new McpServer(...)` (`:232-241`), before `registerRouterTools` (`:256`), and `flushPending()`
inside `exitAfterTeardown` before its close loop (`:350-366`).

The wrapper:
- replaces `s.registerTool` per server instance, forwards `(name, config, handler)` and returns the
  original return value (the RegisteredTool); config is untouched, so the wire snapshots
  `tests/fixtures/267/wire-snapshot-zod3.json` and `zod4.json` stay byte-identical;
- for a tool outside the governed set, registers the original handler unwrapped;
- for a governed tool, the wrapped handler is `(...a) => Promise.resolve().then(() => handler(...a))
  .finally(() => setImmediate(() => maybeSpawn(a[a.length - 1])))` and returns that same promise, so
  the spawn starts only after the handler's write settles (an async rejection still spawns); `extra`
  is the LAST argument (a tool with no input schema gets `(extra)` only);
- governed set: every tool that writes the room or reads its context. A census test
  (`tests/test-367-governed-census.cjs`) lists the tools with the `wireSnapshot` helper of
  `tests/helpers/mcp-wire-267.cjs`, once per surface (CLI, Desktop, Cowork HTTP), and asserts that
  every name in the union is in exactly one of `GOVERNED` or `PURE_READ`, so a new write tool cannot
  ship unlisted. `status_read` is in
  `PURE_READ` (the statusline queries it on every render, `mindrian-mcp-server.cjs:459-461`);
- room: `resolveEffectiveSessionId(undefined, extra)` (`lib/core/session-binding.cjs:176-182`), then
  `classifyMcpWriteRoom({sessionId, ctx: {fallbackRoomDir: serverRoomDir, surface}})`, a new
  side-effect-free function factored out of `resolveMcpWriteRoom` (`lib/mcp/session-room.cjs:285-377`):
  the same resolution and refusal rule, with no readiness probe, no recovery gate mint
  (`:325-338`) and no stderr token (`:313-322`); `resolveMcpWriteRoom` calls it, so the two cannot
  drift. Spawn only when it answers `ok: true` and `source` is not `'cwd'`. This follows the writes on
  every surface, Cowork flag-OFF included (a session-less write already lands in the registry room);
- debounce: a module-level map `room -> {last, pending, timer}` (timer unref'd); a call within 10 s
  of the last spawn sets `pending`, and one trailing spawn runs when the window ends;
  `flushPending()` spawns every pending room at once;
- never throws into a tool result (try/catch, stderr only).

Bash and subagent writes need no own trigger: the runner diffs the tree at the next Stop.

## 6. Card answers (OR-1), host-attested

Trust rule: only a record written by the host hook counts. The runner never reads a transcript and
never takes a path from an MCP argument for decisions.

Hook `scripts/card-answer-ledger.cjs`, PostToolUse, matcher `AskUserQuestion`, timeout 3 s. It reads
`tool_name`, `tool_input`, `tool_response` with the camelCase fallbacks of
`scripts/operator-update.cjs:164-166` (not its registry guard at `:168-171`).
- It records only a `tool_response` with a non-empty `answers` object (the transcript shape
  `toolUseResult = {questions, answers: {<question>: <label or free text>}, annotations}`) and a
  `tool_use_id`; otherwise nothing is written (a counter in `~/.mindrian/card-answers/skipped.count`).
- Room: the session binding first: `resolveMcpSessionRoom({sessionId: stdin.session_id, noFloor:
  true})`, used only when `source === 'session.primary'`. With no binding, `resolveRoomRoot(stdin.cwd)`.
  When both exist and differ, the binding wins if the cwd room is the bound room or one of its
  descendants (the write guard's ancestor rule, `session-binding.cjs:111-139`); any other conflict
  writes nothing (counted). Neither, nothing written. Never the registry active room.
- Room key: `sha256(realpath(room))`, one helper in `lib/core/room-key.cjs` for hook, runner and
  doctor. A copied room gets a different key (a `.room-root`-based key would be shared by a `cp -r`
  copy, `room-birth.cjs:1137-1145`; `room-auto-create.cjs:206` even writes an empty `.room-root`). A
  room moved before its spool drains strands those files (kept, counted pending by the doctor).
- It opens no room.db. Per answered question it creates one spool file with flag `wx` (0600):
  `~/.mindrian/card-answers/<room key>/<tool_use_id>.<q_index>.json` (dir 0700) holding
  `{v: 1, room_key, tool_use_id, q_index, session_id, header, labels, question, chosen, answered_at,
  mac}`; `q_index` is the index in `tool_input.questions` (two questions with the same text keep their
  own index); `question` and `chosen` are cut to 500 chars, `header` and each label to 200 (the
  `lib/mcp/gate-raised.cjs:44-45` caps). `wx` makes each write atomic and a repeat a
  no-op. `mac` = HMAC-SHA256 over the canonical JSON of the other fields (keys sorted, UTF-8).
- Key `~/.mindrian/card-key`: created atomically (a temp file, `link` to the final name, unlink the
  temp; `EEXIST` means another hook won, then re-read). Read with the guards of
  `lib/mcp/answer-route.cjs` `readControlToken` (`:52-71`: lstat, no symlink, `O_NOFOLLOW`, owner uid,
  no group or other bits; skipped on win32), factored to `lib/core/private-key-file.cjs` and used by
  both (the header sentence at `answer-route.cjs:30` is updated). A lost key makes pending files fail
  their mac; they stay in place, never deleted, counted `cards_rejected`.

Runner drain (step 6), holding the room's job lock:
1. First a read-only open (`openRoomDbReadOnlyForCaller`, `spine-events.cjs:523-535`) and
   `PRAGMA table_info(nodes)`: no `review_status` column (legacy 3-column rooms,
   `navigation/CONTEXT.md:41-45`) means every file stays in the spool, counted `legacy_schema`, and the
   write door is not opened (it would migrate the room, `room-db.cjs:307-334`). Else open with
   `navigation.openRoomDbForCaller(roomDir)` (the `lib/mcp/tools/gate.cjs:1765` door); a `null`
   handle keeps every file, reason `room_db_busy`.
2. Per spool file: verify the mac and that `room_key` equals this room's key; a failure is counted
   `cards_rejected` and the file is left in place.
3. Gate cards: a new navigation read `findRaisedGatesByCard(db, header, labels)` selects ALL
   `memory_event` rows labelled `gate_raised` (no TTL, no answered filter; stored contract `header`,
   `options[].label`, `gate_id`, `lib/mcp/gate-raised.cjs:73-110`) whose capped `header` and ordered
   labels equal the spool values. For a match: when `navigation.readGateAnswerAnchor(db,
   gate_id).found` (`navigation.cjs:693`; it covers approve, reject, defer and mirrors), skip
   (counted `cards_skipped`). When no anchor exists and the spool file is younger than 10 minutes,
   leave it for a later run (the model usually calls `gate_answer` within that time). When no anchor
   exists after 10 minutes, record the card decision (OR-1: the human answered); a still later
   `gate_answer` can add a second record (known limit).
4. Id `REASONING_NODE_ID('decision:card', tool_use_id + ':' + q_index)` (null check). If the node
   exists, unlink the spool file: never re-confirm, never rewrite.
5. Else, holding `write.lock`, in one `withRoomTx`: `writeReasoningNode(db, {nodeId, nodeType:
   'decision', epistemicType: 'decision', text: question + ' -> ' + chosen (cut to 500), sourcePath:
   'card:' + tool_use_id, origin: 'card_answered'})` (the `gate.cjs:816-822` precedent; no
   `answeredVia`, so `ANSWERED_VIA_VALUES` stays two values); then `confirmNode(db, nodeId,
   resolveByUser(roomDir), 'card_answered:' + tool_use_id)`. Either returning `ok: false`, or the audit
   event throwing (`transitions.cjs:301`), throws inside the transaction (both roll back); the file
   stays in the spool and is counted `cards_failed`. A lock or transaction-level error is a room
   outcome (`write_lock_held`, `room_db_busy`), not a card failure. Nothing is ever moved or deleted
   except by step 6. `confirmNode` writes its own audit memory_event (`transitions.cjs:289-297`); no
   event type is added.
6. After the commit, unlink the spool file. A crash before the unlink replays it; step 4 makes the
   replay a no-op.

The same question answered twice gives two confirmed decisions; supersession stays a human act.

Threat model: a model with an unrestricted shell can forge any local file, key included; no local
design stops that. This design guarantees that transcript text, MCP arguments, room files and a spool
file copied from another room cannot mint a confirmed decision; only host-hook files with a valid mac
for this room do.

Spike S0 (blocking slice b): capture real PostToolUse stdin for AskUserQuestion (answered, "Other",
cancelled, and one gate card the model rendered) on this host; confirm `tool_use_id`, `cwd`,
`session_id`, the `tool_response` shape, whether the gate `header` reaches the card verbatim, and
whether hook stdin `session_id` equals the `CLAUDE_CODE_SESSION_ID` the MCP server got; pin the hook
fixtures. If the gate header does not carry over, the gate skip falls back to the 10-minute wait.

Spike S1 (blocking slice c): on a Windows Desktop host and in Cowork, spawn the runner with
`--hold-ms 5000` from the MCP server, end the request or the window, and check that the status file
reaches its final state. If the child does not survive, the declared fallback is a `worker_threads`
runner inside the server (no stdio block; it shares the server's lifetime).

## 7. Doctor

`lib/core/doctor/room-graph-integrity-module.cjs` keeps its read-only contract: room.db through
`openRoomDbReadOnlyForCaller`; files through `content-artifacts.cjs` `listContentArtifacts` (no
substrate allowlist entry; the module requires no lazygraph code). New integer fields, outside
`totals`, not summed, `null` when unknown (no status file, legacy schema), never 0 for unknown:
`room_files_without_artifact_node` (an id-set compare, no hashing), `card_ledger_pending`,
`card_ledger_oldest_age_s`, `catchup_state` (0 complete, 1 partial, 2 deferred, 3 failed, 4 running,
5 run_pid_dead when `job-lock.cjs` `read` gives `alive === false || pid_start_match === false`),
`catchup_age_s`. The check warns when `catchup_state` is 3 or 5, or a spool file is older than 24 h.
No strings in the payload (T-343-02). The module has no direct lazygraph require.

## 8. Substrate gate

Only `scripts/graph-catchup.cjs` joins `ALLOWED_DIRECT_IMPORT` (`check-substrate.cjs:63-175`), as
`/^scripts\/graph-catchup\.cjs$/` with a comment: "Phase 367 catch-up indexer: generated index of
room files". Every slice gates on `node scripts/check-substrate.cjs --diff` exiting 0.

## 9. Files (C create, M modify); order a -> b -> c -> d, each green before the next

| Slice | File | Action |
|---|---|---|
| a | `lib/core/content-artifacts.cjs` | C |
| a | `lib/core/lazygraph-ops.cjs` (BEGIN IMMEDIATE :628, :738; exports; `indexArtifactsBatch`; `_indexArtifactBody` content param; `getArtifactId` re-export) | M |
| a | `lib/core/graph-backfill.cjs` (`_artifactsToIndex` via the walker) | M |
| a | `tests/test-367-begin-immediate.cjs` (AC11), `tests/test-367-artifact-set.cjs` (walker vs rebuild difference = scaffold + sub-room files; collisions; isFile; the new backfill set) | C |
| a | `tests/test-sqlite-ops.cjs:391` (pins 21 exports, red at base with 30): re-base to the new count | M |
| b | `scripts/graph-catchup.cjs`, `lib/core/bg-worker.cjs`, `lib/core/room-key.cjs`, `lib/core/private-key-file.cjs`, `scripts/card-answer-ledger.cjs`, `tests/fixtures/367/` (S0 captures) | C |
| b | `scripts/gsd-graph-derive-drain.cjs` (require `bg-worker.cjs`), `lib/mcp/answer-route.cjs` (use `private-key-file.cjs`) | M |
| b | `scripts/on-stop` (stdin parse + 1 spawn line), `scripts/session-start` (1 spawn line after :132), `hooks/hooks.json` (PostToolUse AskUserQuestion group) | M |
| b | `lib/mcp/hook-adapter-audit.cjs` (on-stop budget re-based by its `:63-65` rule to the measured count) | M |
| b | `tests/test-261029-qef-hook-timeouts.cjs` (a `P367` block `added: [{event: 'PostToolUse', sub: 'card-answer-ledger.cjs', timeout: 3}]` in `EXPECTED` and A1 `addedAll`; a `TABLE` row `['PostToolUse', 'card-answer-ledger.cjs', 3]`) | M |
| b | `tests/test-389-hook-unwire.cjs` (`expected`: `PostToolUse` 9 -> 10, `PostToolUse:AskUserQuestion` 0 -> 1, `total` 41 -> 42) | M |
| b | `scripts/isolate-larry-voice.cjs` (`MOS_NO_GRAPH_CATCHUP` under `HOOK_SWITCHES['hooks/run-hook.cmd session-start']` `:494`; the new child in that entry's evidence; re-pin its five evidence lines `:437-441`), `tests/test-359-prose-budget.cjs` (re-base the session-start sha) | M |
| b | `scripts/check-substrate.cjs` (allowlist) | M |
| b | `tests/test-367-catchup-cli.cjs` (AC1, AC3, AC5, AC10), `tests/test-367-card-ledger.cjs` (AC4, AC7) | C |
| c | `lib/mcp/graph-catchup-spawn.cjs`, `tests/test-367-governed-census.cjs` | C |
| c | `lib/mcp/session-room.cjs` (`classifyMcpWriteRoom` factored out; `resolveMcpWriteRoom` calls it) | M |
| b | `lib/core/navigation.cjs` (export `findRaisedGatesByCard`; it lives in `lib/core/navigation/room-projection.cjs`) | M |
| c | `scripts/mindrian-mcp-server.cjs` (install after :241; `flushPending()` in `exitAfterTeardown`) | M |
| c | `lib/core/doctor/room-graph-integrity-module.cjs`, `tests/test-343-room-graph-integrity.cjs` (new fields) | M |
| c | `tests/test-367-catchup-mcp.cjs` (AC2, AC6, AC8) | C |
| d | the seven prose sites below; `tests/test-359-prose-budget.cjs` (re-base larry-extended and SKILL shas); `tests/test-3696-operation-doctrine.cjs` (D2 reads the new sentence); `tests/test-261125-runtime-core-forced-style.cjs` (unchanged; must pass) | M |
| d | dist bundles: `node scripts/build-dist-bundles.cjs` | M |
| d | `tests/test-367-prose.cjs` (AC9) | C |
| all | `367-CONTEXT.md`; `docs/MINDRIAN-CANON.md` Appendix D (`:786`): new entry "OR-1 (Phase 367, owner card 2026-11-26): an AskUserQuestion card the navigator answered in the CLI is the human approve; its decision lands confirmed through confirmNode, from a host-hook record only"; `docs/CANON-PHASE-MAP.md` row for 367 | M |

`tests/fixtures/3696-persona-h/*` (an immutable base snapshot) and `lib/mcp/runtime-instructions.cjs`
(no per-turn rule; 2000-byte budget) are NOT changed.

Prose: only the per-turn sentence changes; every other sentence on the line stays byte-identical.
- `agents/larry-extended.md:72`: "each substantive turn recorded silently" -> "room files and answered cards recorded by code".
- `agents/larry-extended.md:166`: "Fire `memory_event` silently on every substantive turn." -> "Room files and answered cards are recorded by code; fire `memory_event` silently when a turn holds meaning worth keeping."
- `references/personality/memory-and-findings.md:81`: "`memory_event` fires silently on every substantive turn" -> "`memory_event` fires silently when a turn holds meaning worth keeping (room files and answered cards are recorded by code)".
- `references/personality/agent-operations.md:15`: "`memory_event` fires silently on every substantive turn;" -> "room files and answered cards are recorded by code; `memory_event` fires silently when a turn holds meaning worth keeping;".
- `skills/larry-personality/SKILL.md:192`: "`memory_event` fires silently on every substantive turn and is never narrated." -> "Room files and answered cards are recorded by code; `memory_event` fires silently when a turn holds meaning worth keeping and is never narrated."
- `output-styles/destijl.md:23`: "and record each substantive turn (`memory_event`)" -> "and record meaning worth keeping (`memory_event`); room files and answered cards are recorded by code" (keeps `memory_event` and `context_assemble`, which `tests/test-261125-runtime-core-forced-style.cjs:26` needs).
- `data/harness-policies/memory-write-policy.json:27`: "D4 (memory_event fires silently on every substantive turn;" -> "D4 (memory_event fires silently when a turn holds meaning worth keeping; room files and answered cards are recorded by code;".

The policy identifiers that `tests/test-298-policies-schema.cjs:309-357` needs stay in SKILL.md and
memory-and-findings.md.

## 10. Acceptance (detached runs are polled until the status file leaves `running`, cap 30 s)

- AC1 (b) CLI no reminder: a room born by `lib/core/navigation/room-birth.cjs` under a temp
  `MINDRIAN_ROOMS_HOME/<slug>/`; session start run first. Files `problem-definition/a.md`,
  `market-analysis/b.md` (shell write), `solution-design/c/c.md` (simulated subagent). The real
  `on-stop` runs with its process cwd OUTSIDE the room and a Stop stdin whose `cwd` is the room: the
  three Artifact ids exist and `files_indexed >= 3` (the stdin cwd is used). A second leg with no stdin
  `cwd` and the process cwd inside the room gives the same result.
- AC2 (c) MCP no reminder: `installCatchupWrapper` on a test `McpServer`; a bound session:
  `room_bind`, 2 x `artifact_file`, one file written by another process, then `context_assemble`,
  wait 11 s: all 3 Artifact ids exist. A leg where `artifact_file` is the LAST call also has its id
  after 11 s. The bound leg registers a session (`registerStdioProcessSession`); a session-less leg
  (Cowork flag-OFF) writing to the registry room also spawns.
- AC3 (b) Missed run: kill with `--run-seam 1`; delete the cache; the next trigger ends `complete`
  with the id set of `listContentArtifacts`; a second run gives `files_indexed: 0`.
- AC4 (b) OR-1: a fixture PostToolUse stdin for an answered card through the real hook, then the
  runner: 1 decision node, `review_status = 'confirmed'`, `confirmed_by = resolveByUser(roomDir)`,
  text holding the question and the chosen label. Each negative leg gives 0 new decisions: no
  `answers`; no `tool_use_id`; a bad mac; a spool file copied from another room; a fabricated pair in
  a transcript file; `stop_gate_check` with a model-supplied `transcript_path`; a card matching a gate
  whose answer anchor exists (approve, and a reject leg); a cwd room in a different room tree than the
  session's bound room. A card matching a gate with no anchor gives 0 decisions before 10 minutes and
  1 card decision after. Bound session with cwd outside any room: the decision lands in the bound room.
  Bound to a parent with cwd in its sub-room: it lands in the parent. Replaying a spool file gives no
  new node and no rewrite. A forced `confirmNode` refusal keeps the file and counts `cards_failed`. A
  copied room folder: a card answered in the source and a run for the copy gives 0 decisions in the copy.
- AC5 (b) Honest failure: hold `write.lock`; the run ends `deferred`, reason `write_lock_held`,
  `last_run_at - started_at < 2000` ms; the next run ends `complete`; the doctor reports
  `room_files_without_artifact_node = 0`.
- AC6 (c) Doctor: one unindexed file gives `room_files_without_artifact_node = 1`; a run killed during
  `--hold-ms` gives `catchup_state = 5`; no status file gives `catchup_state = null`.
- AC7 (b) Two rooms: the registry's active room is B; a card answered with `cwd` in room A and no
  session binding lands in A only.
- AC8 (c) Spawn safety: `--hold-ms 5000` keeps the runner alive; the wrapped tool returns before it
  ends; MCP stdout carries no runner byte; `on-stop` and `session-start` run with piped stdout and
  stderr reach EOF in under 2 s while the runner is still alive; the wire snapshots are
  byte-identical; 100 `status_read` calls give 0 spawns; a handler that throws and an async rejection
  both still spawn; the wrapper mints 0 gates.
- AC9 (d) Prose: `/(every|each) substantive turn/i` finds nothing in `agents/`, `skills/`,
  `references/personality/`, `output-styles/`, `data/harness-policies/`, `dist/`; the new sentences are
  present; `node scripts/run-harness.cjs --check`, `tests/test-359-prose-budget.cjs`,
  `tests/test-261125-runtime-core-forced-style.cjs`, `tests/test-298-policies-schema.cjs`,
  `tests/test-3696-operation-doctrine.cjs` and the test-189 policy tests pass.
- AC10 (b) Large room: 2,000 generated files, empty cache, up-to-date graph: `complete` with
  `files_indexed: 0` within 4 runs; one warm run's `last_run_at - started_at` is under 1000 ms; the
  longest `BEGIN IMMEDIATE` hold in the run is under 500 ms.
- AC11 (a) 517: process A holds `BEGIN IMMEDIATE` (a child that signals on a pipe), process B starts
  `indexArtifact` after the signal, A commits after 300 ms; B succeeds (at base B fails with 517).

## 11. Alternatives considered

| Alternative | Rejected because |
|---|---|
| Louder prose rule | Tried in quick 260612-t29; the symptom returned |
| Per-turn memory_event | The Phase 394 telemetry flood (14,082 of 14,749 nodes) |
| Sweep inside the hook | Hooks die at their budget in the uninterruptible 5 s busy wait (400.3 V3) |
| Sweep in-process in the MCP server | Blocks the stdio loop |
| Parse card answers from the transcript | The model can write the transcript file; a cancelled card also has a tool_result |
| Mint the decision as confirmed at insert | Skips the confirm chokepoint and its audit row |
| A `card_answered` event type | `confirmNode` already writes the audit event; it would also change the pinned `EVENT_TYPES` size (`test-353-filing-gate.cjs:145`, `test-4002-rulings.cjs:375`) |
| A shared queue module from the Part 8 queue; a claim-by-rename ledger | A refactor of a boundary module the need does not require; a rename leaves a lost-line window; one `wx` spool file per answer is atomic and dedupes for free |
| A new pid lock; a dirty token; quarantine | Reinvents `job-lock.cjs`; a refused spawn loses nothing because every run diffs the whole tree; quarantine adds a state with no exit and SAVEPOINT already contains a bad file |
| Spawn only for `session.primary` | Misses Cowork flag-OFF, where a session-less write already lands in the registry room; following `resolveMcpWriteRoom` matches the writes |
| Walker in `section-registry.cjs` | A load-time require cycle through `scaffold-template-index.cjs` -> `room-birth.cjs` |
| A runner child in the RULE 10 large room leg | Touches the release gate, its receipt and four consumers; AC10 bounds the runner |
| Four explicit MCP sites | Desktop calls bind and context only at first activation (`runtime-instructions.cjs`); one wrapper covers every governed call |
| Wrapper on every tool | `status_read` runs on every statusline render: a sweep every 10 s in an idle window |
| Tree-watcher file events; a Bash matcher | Directory-only contract (`lib/mcp/tree-watcher.cjs:5-12`); Stop already diffs the tree |
| `resolve-room` for the card hook | Returns the registry active room first (`scripts/resolve-room:50-78`): wrong room with two sessions; bash on Windows |
| Turn and session nodes; context ids as provenance | Frozen PART_OF endpoints (`edges.cjs:363-368`); never-fabricate floor (`reasoning-write.cjs:162-165`) |

## 12. Risks

- The first full pass of a large room takes several runs; `partial` with `remaining` until done.
- `write.lock` contention with the post-write cascade: batches of at most 10 files, lock per batch.
- PostToolUse for AskUserQuestion is documented generically (it fires for every tool, subagents
  included); its response shape for this tool is ASSUMED from transcripts until spike S0. If it does
  not fire, OR-1 falls back to the gate route and the owner is told.
- A detached child on native Windows or in the Cowork sandbox may not survive a host kill
  (UNVERIFIED; spike S1); the next trigger recovers.
- A late `gate_answer` after an answered gate card can add a second confirmed decision for one human act (both linked by `header`).
- A room moved or renamed before its card spool drains strands those files (kept on disk, counted pending).
- `computeHash` is a 32-bit compare; a collision leaves one file unindexed until its next change.
- The confidence floor of the section ledger moves between rebuilds (RCA 395-tests-after-beta93);
  not touched here.
