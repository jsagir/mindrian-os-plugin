---
phase: 367
title: "The graph writes itself: one catch-up runner for files and answered cards, on every surface"
status: DESIGN r5 (after Goldfish rounds 1-3; reports 367-GOLDFISH-REPORT-R1.md, -R2.md, -R3.md)
date: 2026-11-26
canon_parts: [3, 8, 9, 11]
absorbs: SEED-101; the record half of Phase 280 / SEED-008
depends_on: none hard. 400.3-01/02/02b are soft: stand-ins (section 4) are swapped when they land
base: origin/main 5cc571e21
owner_rulings:
  OR-1: "A CLI card answer (AskUserQuestion) is the human's approve: it lands as a confirmed decision node" (owner card 2026-11-26; changes the locked HITL rule for this one input)
  OR-2: "Run it end to end: full Goldfish work, apply the fix, register it as a GSD phase" (owner 2026-11-26)
  OR-3: home Phase 367
---

# 367 Design r5: the graph writes itself

## 1. Goals and non-goals

Need, in the owner's words: "I find myself many times asking for local graph writing ... this needs
to be an automated process."

Goals:
- G1 Every content file of a room in the shared artifact set (5.1) reaches
  `<room>/.mindrian/room.db` as an Artifact node with no model tool call: on the CLI at every turn
  end and session start; on Desktop and Cowork at every governed mindrian-os tool call (5.3).
- G2 Every card the navigator answers in the terminal lands as one confirmed decision (OR-1), from a
  host-attested record only.
- G3 Honest status: a room status file and doctor counts show what is behind and why.

Non-goals: claim extraction, baskets and cards from transcript text; the filing contract check;
in-session derive drain; turn, session and per-turn memory_event rows; fragment ingest rework (R8)
and the `key_decisions` merge (a `/gsd-quick` follow-up with a reproduction); removing nodes of
deleted files; scaffold files as Artifacts (5.1); `meetings/`, `team/`, `references/` and files
deeper than one nested level (the existing `discoverSections` rule); top-level sub-rooms (each is
caught up by its own trigger); cross-machine concurrency on a shared or synced folder (one machine
writes a room at a time); resume-only sessions get no SessionStart run (the first Stop covers them).

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

`lib/core/section-registry.cjs` (no dependencies, not banned by the substrate gate, owner of
`isIndexableArtifactFile`) gains `listContentArtifacts(roomDir)`: the `rebuildGraph` passes byte for
byte (`discoverSections(resolved).all`, the flat files, one nested level skipping `.room-root`
children, the root files with an isFile check; `lazygraph-ops.cjs:727-811`) MINUS scaffold files
(`scaffold-predicate.cjs` `isScaffoldFile`, the rule `graph-backfill.cjs` `_artifactsToIndex`
already applies at `:367-399`) and MINUS top-level sub-rooms (a section folder holding `.room-root`).
Return: `[{rel, abs, id}]` sorted by `rel`, where `id` is `getArtifactId` (moved here and
re-exported by lazygraph-ops). On an id collision the order `.md`, `.docx`, `.html`, `.htm` wins;
the others are returned in `collisions`. `graph-backfill.cjs` `_artifactsToIndex` calls it. The
runner and the doctor call it. `rebuildGraph` keeps its own scope in this phase (it still indexes
scaffold files; the test states the difference set is exactly the scaffold files and sub-room files).

`lazygraph-ops.cjs` exports `computeHash` (md5 cut to 8 hex chars, a 32-bit compare, `:419-421`),
`_readArtifactContent` and a SYNCHRONOUS `indexArtifactsBatch(conn, roomDir, files, canonCtx)` that
runs `_indexArtifactBody` per file inside a SAVEPOINT and returns
`{indexed: [rel], failed: [{rel, code}]}`; a failing file rolls back its own savepoint only.

### 5.2 One run

`scripts/graph-catchup.cjs --cwd <dir> --reason stop|session_start|mcp_call [--run-seam <n>] [--hold-ms <n>]`

1. Kill switch `MOS_NO_GRAPH_CATCHUP=1` exits 0.
2. Guard (section 4). On no room: exit 0, nothing written (`room_not_resolved` is counted only when
   a room was resolved but has no room.db: `room_db_missing`).
3. Worker caps: `lowerWorkerPriority()` and `armBackstop(30000)` (export them from
   `scripts/gsd-graph-derive-drain.cjs:896, 919` into `lib/core/bg-worker.cjs`; the drain requires
   them back).
4. Runner lock: `job-lock.cjs` `acquire('<room>/.mindrian/graph-catchup.lock', {job:
   'graph-catchup', heartbeatMs: 5000})` (per path; reclaims a dead pid at once). On `held` or
   `recovering`: bump the dirty token (step 9) and exit 0.
5. Status file `<room>/.mindrian/graph-catchup.json` (atomic rename, 0600): `{schema: 1, state:
   'running', run_id, pid, started_at}`.
6. Cards: drain the card ledger (section 6).
7. Files: open room.db once with `openGraph` (after the guard), build the canon context once. Walk
   `listContentArtifacts` from the cursor. Per file: `fstat` on the read fd; when the cache entry
   `[mtimeMs, size, ino]` matches, skip; else read with `_readArtifactContent`, hash with
   `computeHash`, compare with `json_extract(properties,'$.content_hash')` for its id. A match
   refreshes the cache entry; a difference or a missing node joins the batch. A file gone since the
   listing is counted `files_vanished`.
8. Batches of at most 10 files: `acquireLock`, `withRoomTx` (`navigation/room-change-log.cjs:188-205`,
   `BEGIN IMMEDIATE`) around `indexArtifactsBatch`, `releaseLock`. Cache entries update only for
   indexed files; the cache is written atomically after each batch. A file that fails 2 runs in a row
   is quarantined (`quarantined` list in the cache, counted) and the cursor moves past it. On
   `write_lock_held` the cursor is persisted and the run ends `deferred`.
9. Dirty token: every refused spawn increments `<room>/.mindrian/graph-catchup.dirty` (a counter in
   the file, written with an atomic rename). The holder records the token at start; after releasing
   the job lock it re-reads it; when it grew, it re-acquires and runs one more pass (at most 3 passes
   per run). The claim is "recovered at the next pass or the next trigger", not "never lost".
10. Budget: 15 s wall per run, all passes together, over files examined. On the budget the cursor
    is persisted and the run ends `partial` with `remaining`. A full pass resets the cursor and
    prunes cache entries for files not listed.
11. `closeGraph`, release the job lock, write the final status: `{schema: 1, state, reason, run_id,
    trigger, started_at, last_run_at, files_seen, files_indexed, files_vanished, files_quarantined,
    id_collisions, cards_recorded, cards_rejected, cards_skipped, remaining}`. State: `complete`,
    `partial`, `deferred`, `failed`. Reasons: `write_lock_held`, `lock_io_error`, `room_db_busy`,
    `room_db_missing`, `index_failed`, `budget_exhausted`, `ledger_invalid`, `legacy_schema`. When
    files and cards disagree the worse state wins (failed > deferred > partial > complete).

Cache file `<room>/.mindrian/graph-catchup-cache.json`: `{schema: 1, cursor: <rel or null>,
entries: {<rel>: [mtimeMs, size, ino, hash, fails]}, quarantined: [<rel>]}`.

Seams (tests only): `--run-seam <n>` exits after batch n; `--hold-ms <n>` sleeps before step 6.

### 5.3 How it is started

Spawn rule everywhere: `process.execPath` (with `ELECTRON_RUN_AS_NODE=1` when
`process.versions.electron` is set), `detached: true`, `stdio: 'ignore'`, `windowsHide: true`,
`child.on('error', noop)`, `child.unref()`. In bash the repo idiom
`( node ... >/dev/null 2>&1 || true ) &` (`session-start:1813-1818`).

| Surface | Trigger | Site |
|---|---|---|
| CLI | Stop, both branches | `scripts/on-stop`, one line right after the Part 8 drain line (`:48`), before the MCP-first branch: `( node "$SCRIPT_DIR/graph-catchup.cjs" --cwd "$WORK_DIR" --reason stop >/dev/null 2>&1 || true ) &`. The runner resolves the room itself, so the line needs no `ROOM_DIR`. The on-stop line budget (`lib/mcp/hook-adapter-audit.cjs:75`, 680) is raised to 682 with the reason |
| CLI | SessionStart (startup, clear, compact) | `scripts/session-start`, after the heal net (`:132`), guarded by `[ -d "$ROOM_DIR" ]`; matcher unchanged |
| Desktop, Cowork (and CLI MCP calls) | governed tool calls on a bound room | `installCatchupWrapper(s)` from `lib/mcp/graph-catchup-spawn.cjs`, called in `scripts/mindrian-mcp-server.cjs` right after `new McpServer(...)` (`:232-241`) and before `registerRouterTools` (`:256`) |

The wrapper:
- replaces `s.registerTool` once per server instance, forwarding `(name, config, handler)` unchanged
  (config untouched: the wire snapshots `tests/fixtures/267/wire-snapshot-zod3.json` and `zod4.json`
  stay byte-identical), and wraps only `handler`, forwarding every argument;
- runs the handler, then in `finally` schedules `setImmediate(maybeSpawn)` (a throw still spawns);
- fires only for the governed set (writes and room context): `room_bind`, `context_assemble`,
  `room_startup`, `stop_gate_check`, `artifact_file`, `claim_write`, `graph_write`, `memory_event`,
  `gate_answer`, `meeting`, `research_run`, `room_content`, `methodology`, `analysis`,
  `intelligence`; never `status_read` (the statusline queries it on every render,
  `mindrian-mcp-server.cjs:459-461`) or other pure reads;
- finds the room with `resolveEffectiveSessionId(undefined, extra)` (`session-binding.cjs:176-182`)
  and `resolveMcpSessionRoom({sessionId, noFloor: true})` (`session-room.cjs:158-203`), and spawns
  only when `source === 'session.primary'`. Cowork flag-OFF (stateless HTTP) has no session
  binding: it is caught up by the next CLI or Desktop trigger, stated as a limit;
- debounce: a module-level map `room -> {last, pending, timer}`; a call within 10 s of the last
  spawn sets `pending` and one trailing spawn runs when the window ends; on teardown
  (`mindrian-mcp-server.cjs:350-366, 377-390`) a pending room gets its dirty token bumped instead;
- never throws into a tool result (try/catch, stderr only).

Bash and subagent writes need no own trigger: the runner diffs the tree at the next Stop.

## 6. Card answers (OR-1), host-attested

Trust rule: only a line written by the host hook counts. The runner never reads a transcript and
never takes a path from an MCP argument for decisions.

Hook `scripts/card-answer-ledger.cjs`, PostToolUse, matcher `AskUserQuestion`, timeout 3 s. It reuses
the stdin parse of `scripts/operator-update.cjs:164-176` (`tool_name`, `tool_input`, `tool_response`).
- It records only a `tool_response` that carries a non-empty `answers` object (the shape the
  transcript shows: `toolUseResult = {questions, answers: {<question>: <label or free text>},
  annotations}`); anything else (a cancel, an error, no answers) writes nothing.
- Room: `resolveRoomRoot(stdin.cwd)`; no room, nothing written. Never the registry active room.
- room key: `sha256(realpath(room))`, the same function (`lib/core/room-key.cjs`) in hook, runner and
  doctor.
- It opens no room.db. It appends one line per answered question to
  `~/.mindrian/card-answers/<room key>.jsonl` (dir 0700, file 0600):
  `{v: 1, room_key, tool_use_id, q_index, session_id, question, chosen, answered_at, mac}`;
  `question` and `chosen` are cut to 500 chars each. `mac` = HMAC-SHA256 over the canonical JSON of
  the other fields (keys sorted, UTF-8) with the key in `~/.mindrian/card-key`.
- Key: created with flag `wx` (0600), re-read when it exists; read with the guards of
  `lib/mcp/answer-route.cjs` `readControlToken` (`:52-71`: lstat, no symlink, owner, 0600), factored
  to `lib/core/private-key-file.cjs` and used by both.

Runner drain (step 6), holding the room's job lock:
1. Claim: rename `<room key>.jsonl` to `<room key>.claimed.<pid>.jsonl`; a claimed file of a dead
   pid is taken over. No cap: an approval is never dropped.
2. Per line: verify the mac and that `room_key` equals this room's key; on failure append to
   `<room key>.rejected.jsonl` and count `cards_rejected`.
3. Skip (count `cards_skipped`): a line whose `question` matches a gate card recorded in this room's
   gate records (`gate_list` data; the CLI renders gate cards through AskUserQuestion,
   `lib/mcp/gate-render.cjs:18-23, 470-475`, and `gate_answer` already mints `decision:gate:<id>`,
   `gate.cjs:816-845`). The exact match field is pinned in the plan (UNVERIFIED which field).
4. Id `REASONING_NODE_ID('decision:card', tool_use_id + ':' + q_index)` (null check). If a node
   with that id exists (`SELECT review_status`), skip: never re-confirm, never rewrite.
5. Else, holding `write.lock`, in one `withRoomTx`: `writeReasoningNode(db, {nodeId, nodeType:
   'decision', epistemicType: 'decision', text: question + ' -> ' + chosen (cut to 500),
   sourcePath: 'card:' + tool_use_id, origin: 'card_answered', answeredVia: 'host_hook'})` (the
   `gate.cjs:816-822` precedent); then `confirmNode(db, nodeId, resolveByUser(roomDir),
   'card_answered:' + tool_use_id + ' via host_hook')`. If either returns `ok: false`, throw inside
   the transaction (both roll back) and count `confirm_refused:<reason>`; the line goes back to the
   ledger for the next run. `confirmNode` writes its own audit memory_event
   (`transitions.cjs:289-297`); no extra event type is added.
6. Legacy 3-column rooms (`navigation/CONTEXT.md:41-45`): the line is kept in the ledger (never
   dropped), counted `legacy_schema`.
7. After the transaction, unlink the claimed file. A crash before the unlink replays lines; step 4
   makes replay a no-op.

The same question answered twice gives two confirmed decisions; supersession stays a human act.
Retention: the rejected file and claimed files are removed after 30 days; they hold card text
outside the room and are local only (Part 8 holds).

Threat model: a model with an unrestricted shell can forge any local file, key included; no local
design stops that. This design guarantees that transcript text, MCP arguments, room files and a
line copied from another room cannot mint a confirmed decision; only host-hook lines with a valid
mac for this room do.

Spike S0 (blocking slice b): capture real PostToolUse stdin for AskUserQuestion (answered, "Other",
cancelled) on this host and pin the hook test fixtures; the hook is defensive either way.

## 7. Doctor

`lib/core/doctor/room-graph-integrity-module.cjs` keeps its read-only contract: room.db only through
`openRoomDbReadOnlyForCaller`; files through `section-registry.cjs` `listContentArtifacts` (no
substrate allowlist entry). New integer fields (outside `totals`, not summed): 
`room_files_without_artifact_node` (an id-set compare, no hashing), `artifact_id_collisions`,
`card_ledger_pending`, `card_ledger_rejected`, `catchup_state` (enum: 0 complete, 1 partial,
2 deferred, 3 failed, 4 running, 5 run_pid_dead), `catchup_age_s`. No strings in the payload
(T-343-02).

## 8. Substrate gate

Only `scripts/graph-catchup.cjs` joins `ALLOWED_DIRECT_IMPORT` (`check-substrate.cjs:63-175`), as
`/^scripts\/graph-catchup\.cjs$/` with a comment: "Phase 367 catch-up indexer: generated index of
room files". Every slice gates on `node scripts/check-substrate.cjs --diff` (staged files) exiting 0.

## 9. Files (C create, M modify); order a -> b -> c -> d, each green before the next

| Slice | File | Action |
|---|---|---|
| a | `lib/core/lazygraph-ops.cjs` (BEGIN IMMEDIATE :628, :738; exports; `indexArtifactsBatch`; `getArtifactId` re-export) | M |
| a | `lib/core/section-registry.cjs` (`listContentArtifacts`, `getArtifactId`) | M |
| a | `lib/core/graph-backfill.cjs` (`_artifactsToIndex` calls the shared walker) | M |
| a | `tests/test-367-begin-immediate.cjs` (AC11), `tests/test-367-artifact-set.cjs` (walker vs rebuild difference = scaffold + sub-room files; collisions; backfill parity) | C |
| b | `scripts/graph-catchup.cjs`, `lib/core/bg-worker.cjs`, `lib/core/room-key.cjs`, `lib/core/private-key-file.cjs`, `scripts/card-answer-ledger.cjs`, `tests/fixtures/367/` | C |
| b | `scripts/gsd-graph-derive-drain.cjs` (require `bg-worker.cjs`), `lib/mcp/answer-route.cjs` (use `private-key-file.cjs`) | M |
| b | `scripts/on-stop` (1 line), `scripts/session-start` (spawn after :132), `hooks/hooks.json` (PostToolUse AskUserQuestion group) | M |
| b | `lib/mcp/hook-adapter-audit.cjs` (on-stop budget 680 -> 682), `tests/test-389-hook-unwire.cjs` (expected: `PostToolUse` 9 -> 10, `PostToolUse:AskUserQuestion: 1`, total 42), `tests/test-359-prose-budget.cjs` (re-base the session-start sha), `scripts/isolate-larry-voice.cjs` (declare the new child in `STARTUP_CONTAINMENT`, `MOS_NO_GRAPH_CATCHUP` in `HOOK_SWITCHES`), `tests/test-3696-isolation.cjs` | M |
| b | `scripts/check-substrate.cjs` (allowlist) | M |
| b | `tests/test-367-catchup-cli.cjs` (AC1, AC3, AC5, AC10), `tests/test-367-card-ledger.cjs` (AC4, AC7) | C |
| c | `lib/mcp/graph-catchup-spawn.cjs` | C |
| c | `scripts/mindrian-mcp-server.cjs` (one call after :241) | M |
| c | `lib/core/doctor/room-graph-integrity-module.cjs`, `tests/test-343-room-graph-integrity.cjs` (new integer fields) | M |
| c | `scripts/release-lib/large-room-leg.cjs` (third child: the runner, AC12) | M |
| c | `tests/test-367-catchup-mcp.cjs` (AC2, AC6, AC8) | C |
| d | `agents/larry-extended.md` (:72, :166), `references/personality/memory-and-findings.md` (:81), `references/personality/agent-operations.md` (:15), `skills/larry-personality/SKILL.md` (:192), `output-styles/destijl.md` (:23), `data/harness-policies/memory-write-policy.json` (:27), `tests/fixtures/3696-persona-h/*` | M |
| d | `tests/test-359-prose-budget.cjs` (re-base the larry-extended and SKILL shas), `tests/test-3696-operation-doctrine.cjs` (D2 requires the pointer line instead of the per-turn line) | M |
| d | dist bundles: `node scripts/build-dist-bundles.cjs` (never hand edits) | M |
| d | `tests/test-367-prose.cjs` (AC9) | C |
| all | `367-CONTEXT.md`; `docs/MINDRIAN-CANON.md` Appendix D (`:786`) entry for OR-1; `docs/CANON-PHASE-MAP.md` row for 367 | M |

`lib/mcp/runtime-instructions.cjs` is NOT changed: it holds no per-turn rule and sits at its
2000-byte budget.

Pointer text replacing the per-turn rule: "Room files and answered cards are recorded by code. You
record meaning: file claims through the gate."

## 10. Acceptance (detached runs are polled until the status file leaves `running`, cap 30 s)

- AC1 (b) CLI no reminder: a room born by `lib/core/navigation/room-birth.cjs` under a temp
  `MINDRIAN_ROOMS_HOME/<slug>/`; session start run first. Files `problem-definition/a.md` (Write
  path), `market-analysis/b.md` (shell write), `solution-design/c/c.md` (simulated subagent).
  The real `on-stop` with a Stop stdin whose `cwd` is the room. Then the three Artifact ids exist and
  `files_indexed >= 3`.
- AC2 (c) MCP no reminder: `installCatchupWrapper` on a test `McpServer`; a bound session:
  `room_bind`, 2 x `artifact_file`, one file written by another process, then `context_assemble`,
  then wait 11 s. All 3 Artifact ids exist.
- AC3 (b) Missed run: kill with `--run-seam 1`; delete the cache; the next trigger ends `complete`
  with the id set of `listContentArtifacts`; a second run gives `files_indexed: 0`.
- AC4 (b) OR-1: a fixture PostToolUse stdin for an answered card through the real hook, then the
  runner: 1 decision node, `review_status = 'confirmed'`, `confirmed_by = resolveByUser(roomDir)`,
  text containing the question and the chosen label. Each negative leg gives 0 new decisions: a
  cancelled card (no `answers`); a bad mac; a valid line copied into another room's ledger; a
  fabricated AskUserQuestion pair in a transcript file; a `stop_gate_check` call with a model-supplied
  `transcript_path`; a card that matches a recorded gate card. Replaying the same line gives no new
  node and no rewrite.
- AC5 (b) Honest failure: hold `write.lock`; the run ends `deferred`, reason `write_lock_held`,
  `last_run_at - started_at < 2000 ms`; the next run ends `complete`; the doctor reports
  `room_files_without_artifact_node = 0`.
- AC6 (c) Doctor: one unindexed file gives `room_files_without_artifact_node = 1`; a run killed with
  `--hold-ms` gives `catchup_state = 5`.
- AC7 (b) Two rooms and the registry: the registry's active room is B; a card answered with `cwd` in
  room A lands in A only.
- AC8 (c) Spawn safety: `--hold-ms 5000` keeps the runner alive; the wrapped tool returns before it
  ends; MCP stdout carries no runner byte; on-stop returns while it runs; the wire snapshots are
  byte-identical; 100 `status_read` calls give 0 spawns.
- AC9 (d) Prose: regex `/(every|each) substantive turn/i` finds nothing in `agents/`, `skills/`,
  `references/personality/`, `output-styles/`, `data/harness-policies/`, `dist/`; the pointer line is
  present; `node scripts/run-harness.cjs --check`, `tests/test-359-prose-budget.cjs`,
  `lib/mcp/no-instructions.test.cjs` and the test-189 policy tests pass.
- AC10 (b) Large room: 2,000 generated files, empty cache, up-to-date graph: `complete` with
  `files_indexed: 0` within 4 runs; then one warm run's `last_run_at - started_at` is under 1000 ms.
- AC11 (a) 517: process A holds `BEGIN IMMEDIATE` (an `--hold` child that signals on a pipe), process
  B starts `indexArtifact` after the signal, A commits after 300 ms; B succeeds (at base B fails with
  errcode 517).
- AC12 (c) Release: `scripts/release-lib/large-room-leg.cjs` runs the runner as a third child on its
  fixture; one cold run stays under 15 s wall, 600 s CPU and 1024 MB RSS (the RULE 10 limits).

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
| A shared queue module from the Part 8 queue | A refactor of a boundary module the need does not require; one reader per room needs only an inline claim |
| A new pid lock | Reinvents `job-lock.cjs` (per path, dead-pid reclaim, recovery) and its race fixes |
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
  (UNVERIFIED); the dirty token and the next trigger recover.
- `computeHash` is a 32-bit compare; a collision leaves one file unindexed until its next change.
- The confidence floor of the section ledger moves between rebuilds (RCA 395-tests-after-beta93);
  not touched here.
