---
phase: 367
title: "The graph writes itself: one catch-up runner for files and answered cards, on every surface"
status: DESIGN r4 (after Goldfish rounds 1 and 2; reports 367-GOLDFISH-REPORT-R1.md, -R2.md)
date: 2026-11-26
canon_parts: [3, 8, 9, 11]
absorbs: SEED-101; the record half of Phase 280 / SEED-008
depends_on: none hard. 400.3-01/02/02b are soft: three stand-ins below are swapped when they land
base: origin/main def2df273
owner_rulings:
  OR-1: "A CLI card answer (AskUserQuestion) is the human's approve: it lands as a confirmed decision node" (owner card 2026-11-26; changes the locked HITL rule for this one input)
  OR-2: "Run it end to end: full Goldfish work, apply the fix, register it as a GSD phase" (owner 2026-11-26)
  OR-3: home Phase 367
---

# 367 Design r4: the graph writes itself

## 1. Goals and non-goals

Need, in the owner's words: "I find myself many times asking for local graph writing ... this needs
to be an automated process."

Goals:
- G1 Every indexable file in a room under `~/MindrianRooms/<slug>/` reaches `<room>/.mindrian/room.db`
  as an Artifact node with no model tool call and no reminder: on the CLI at every turn end and
  session start; on Desktop and Cowork at every mindrian-os tool call.
- G2 Every card the navigator answers in the terminal lands as one confirmed decision (OR-1), from a
  host-attested record only.
- G3 Honest status: a room-level status file and doctor counts show what is behind and why.

Non-goals (this phase): candidate claim extraction, baskets, the filing contract check, in-session
derive drain, turn and session nodes, a per-turn memory_event, the fragment ingest rework (R8) and
the `key_decisions` merge (both go to a `/gsd-quick` follow-up with a reproduction), node removal
for deleted files, cross-machine concurrency on a shared or synced room folder (SQLite on a synced
folder is out of scope; one machine writes a room at a time), Windows detached-child hardening
beyond the stated spawn options.

## 2. Root causes (PROVEN unless marked)

| # | Cause | Evidence |
|---|---|---|
| R1 | The post-write cascade, the only per-write path that makes an Artifact node, skips `~/MindrianRooms/` (case-sensitive `/room/` or `/rooms/` test). The hook said so while this design was written: "post-write: cascade skipped for 367-DESIGN.md" | `lib/core/intelligence-cascade.cjs:182-184, 650-654`; `scripts/post-write:282` |
| R2 | `artifact_file` never indexes and returns `ok: true` | `lib/mcp/tools/views.cjs:408-440` |
| R3 | Every typed record needs a model tool call; the per-turn rule is prose in 5 places plus the output style and one harness policy | section 9 slice (d) list |
| R4 | No hook indexes a Bash or subagent write in an unmarked room; SessionEnd only removes presence files | `hooks/hooks.json`; `hooks.json:185-195` |
| R5 | The transcript reader drops tool_use and tool_result, so card answers never reach the graph | `scripts/transcript-ingest.cjs:60, 77, 134` |
| R7 | MCP write tools call `fireCascade` with no filePath; no MCP code runs a sweep by itself | `lib/mcp/tool-router.cjs:937-945, 1339, 1345` |
| R9 | `indexArtifact` and `rebuildGraph` open a deferred `BEGIN`; a read before the first write under a concurrent writer gives errcode 517 at once with no busy wait (PROVEN on a scratch probe; plausible on indexArtifact because insertNode runs a PRAGMA read first) | `lib/core/lazygraph-ops.cjs:628, 738` |

ICM framing: room.db is a generated index of room files, but the model keeps it by hand. A
hand-kept index drifts. The fix makes the index generated.

## 3. Principle: record versus claim

- Files and answered cards are RECORDS: code captures them every time.
- A claim stays as today: it lands `proposed` through the existing tools; only a gate approve confirms.
- OR-1 is the one exception the owner ruled: an answered terminal card is itself the human approve.

## 4. Ownership: 367 versus 400.3

| Item | Owner |
|---|---|
| `artifact_file` inline index, `graph_index`, `partial`; `busyMs`, `mustExist`, `lockWaitMs`, `classifyIndexError`, `acquireLockWithBackoff` | 400.3-01 |
| `.room-root` + existing room.db marker module (`lib/core/room-root.cjs`); index-only post-write | 400.3-02, 02b |
| deferred `BEGIN` -> `BEGIN IMMEDIATE` (also Phase 273 M5) | 367 slice (a) |
| the catch-up runner, its spawners, the card-answer ledger, the room status file, doctor counts | 367 |
| cascade off the foreground (400.3 proposal plan 08) | stays in 400.3; it may reuse the 367 spawn helper; both take the per-room write.lock, never a second lock |
| `last-cascade.json` (per write) vs `graph-catchup.json` (per room) | both stay; each answers its own question |
| FileChanged (inert), `enqueueWrite` retry, hook-safe opener | 400.3-14, -04, -06 |

Stand-ins until 400.3-01/02 land (each marked `// until 400.3-01` in code, swapped by a planned task):
- Room guard: `fs.existsSync(<room>/.room-root) && fs.existsSync(<room>/.mindrian/room.db)`
  (`.room-root` is an existing sentinel: `lib/core/artifact-scope.cjs:240`). Never create room.db.
- Busy wait: the default `timeout: 5000` of `openGraph` (`lazygraph-ops.cjs:449`); harmless in a
  detached child.
- Lock: one `acquireLock(roomDir)` attempt (`lib/core/write-lock.cjs:158`) per batch; on a throw the
  run ends `deferred`, reason `write_lock_held`.

## 5. The runner

### 5.1 Files and one shared enumerator

`lib/core/lazygraph-ops.cjs` gains one exported walker, `listIndexableArtifacts(roomDir)`, with
exactly the `rebuildGraph` scope (sections, one nested level, root files; predicate
`section-registry.cjs` `isIndexableArtifactFile`; child rooms skipped). Where two files map to one
Artifact id (`a.md` and `a.html`, `getArtifactId` at `:382-386`), `.md` wins and the collision is
counted. `rebuildGraph` is refactored to use it, so the runner, the rebuild and the doctor see one
set. It also exports `computeHash` and `_readArtifactContent` and `indexArtifactsBatch(conn, roomDir,
files, canonCtx)` (the body of `rebuildGraph`'s loop, `_indexArtifactBody` per file).

### 5.2 What one run does

`scripts/graph-catchup.cjs --room <dir> --reason stop|session_start|mcp_call [--run-seam <n>]`

1. Kill switch: `MOS_NO_GRAPH_CATCHUP=1` exits 0 at once (precedent `MOS_NO_DETACHED_DERIVE`).
2. Guard (section 4 stand-in). Take the per-room runner lock `<room>/.mindrian/graph-catchup.pid`
   (create-exclusive; stale when its pid is dead or the file is older than 60 s, 4 x the budget).
   If held: touch `<room>/.mindrian/graph-catchup.dirty` and exit 0. The holder re-runs once more at
   its end when the dirty file is newer than its own start (at most 3 passes). No trigger is lost.
3. Write the status file `state: running, run_id, pid, started_at` (atomic rename, mode 0600).
4. Cards: drain the card-answer ledger (section 6).
5. Files: walk with `listIndexableArtifacts`, sorted by path, starting from the persisted cursor.
   For each file: if the cache `<room>/.mindrian/graph-catchup-cache.json` holds the same (mtime,
   size), skip. Else read and hash with `computeHash(_readArtifactContent(f))` (a file removed since
   the listing is skipped and counted) and compare with the stored
   `json_extract(properties,'$.content_hash')`. A match updates the cache entry (mtime, size, hash)
   with no write. A difference or a missing node joins the batch.
6. Write batches of at most 10 files: `acquireLock`, `openGraph`, `withRoomTx` (`BEGIN IMMEDIATE`,
   defined at `navigation/room-change-log.cjs:188-205`), `indexArtifactsBatch`, commit,
   `releaseLock`. The canon context is built once per run. Update cache entries only for committed
   files. Write the cache atomically after each batch.
7. Budget: 15 s wall per run, counted over files examined. On the budget, persist the cursor and end
   `partial` with `remaining`. The next run continues from the cursor; a full pass resets it.
8. Final status (atomic): `{schema: 1, state: complete|partial|deferred|failed, reason, run_id,
   reason_trigger, files_seen, files_indexed, files_vanished, id_collisions, cards_recorded,
   remaining, last_run_at}`. Reasons: `write_lock_held`, `room_db_busy`, `room_db_missing`,
   `room_not_marked`, `index_failed`, `budget_exhausted`, `ledger_invalid`.

`--run-seam <n>` (tests only) exits after batch n to prove kill safety.

### 5.3 How it is started

The runner never runs inside a hook or the MCP process. Spawn options: `process.execPath`,
`detached: true`, `stdio: 'ignore'`, `windowsHide: true`, `child.unref()`. In bash:
`nohup node ... >/dev/null 2>&1 &` then `disown`.

| Surface | Trigger | Where |
|---|---|---|
| CLI | Stop, legacy branch | `scripts/on-stop`, after the `memory-lifecycle.cjs stop` line (`:336`), with the resolved `ROOM_DIR` |
| CLI | Stop, MCP-first branch | `scripts/on-stop`, inside the branch before its `exit 0` (`:133`), with the room resolved by `scripts/resolve-room` from the work dir |
| CLI | SessionStart (startup, clear, compact, resume) | `scripts/session-start`, after the room is resolved |
| Desktop, Cowork (and CLI MCP calls) | every mindrian-os tool call on a bound room | one wrapper of `s.registerTool` installed right after `new McpServer` (`scripts/mindrian-mcp-server.cjs:232`), before any registration; after the handler returns it calls `lib/mcp/graph-catchup-spawn.cjs` `maybeSpawn(boundRoomDir, 'mcp_call')` |

`lib/mcp/graph-catchup-spawn.cjs` holds the spawn and a trailing debounce: an in-memory map per
room; a call inside 10 s of the last spawn sets a pending flag, and one spawn runs when the window
ends. The runner's dirty file covers a spawn refused by a held lock. The wrapper never throws into a
tool result (try/catch, stderr only).

Bash writes and subagent writes need no own trigger: the runner diffs the whole tree at the next
Stop. No new PostToolUse Bash matcher; `on-agent-complete` and `pre-compact` are unchanged.

## 6. Card answers (OR-1), host-attested

Trust rule: only a record written by a host hook counts. The runner never reads a transcript and
never takes a path from an MCP argument for decisions.

- New hook `scripts/card-answer-ledger.cjs` on PostToolUse, matcher `AskUserQuestion`, timeout 3 s.
  The host writes its stdin. It skips a result that is an error, a denial or a cancel. It resolves
  the room from stdin `cwd` (`scripts/resolve-room`), so a session that spans two rooms records each
  answer in the room that was active. It opens no room.db. It appends one line per question to
  `~/.mindrian/card-answers/<room id>.jsonl` (outside the room, mode 0600):
  `{v: 1, tool_use_id, q_index, session_id, question_sha, chosen_labels, answered_at, mac}`, where
  `mac` is an HMAC-SHA256 over the other fields with a per-machine key in `~/.mindrian/card-key`
  (created 0600 on first use).
- The runner drains the file (claim by rename, the `part8-egress-telemetry-queue.cjs:120-260`
  pattern, generalized not forked: the shared part moves to `lib/core/jsonl-claim-queue.cjs`). A line
  whose mac fails is rejected and counted (`ledger_invalid`). For each valid line, in one
  `withRoomTx`: `writeReasoningNode` with type `decision`, id
  `REASONING_NODE_ID('decision:card', tool_use_id + ':' + q_index)`, text = the question and the
  chosen labels (local only; Part 8 holds: nothing leaves the machine), no subject, no evidence, so
  no edge; then `confirmNode(db, id, resolveByUser(roomDir), 'card_answered:' + tool_use_id)`
  (`navigation.cjs:714-715`); then one `card_answered` memory_event with stable id
  `memory_event:card_answered:<tool_use_id>:<q_index>`. A repeat line is a no-op (fixed ids).
- `logEvent` gains `opts.eventId`; with it the insert is `ON CONFLICT(id) DO NOTHING`
  (`memory-events.cjs:890, 897-900`). `card_answered` joins `EVENT_TYPES`.
- Legacy 3-column rooms (no `review_status`, `navigation/CONTEXT.md:41-45`): decisions are skipped
  and counted, reason `legacy_schema`.
- The same question answered twice gives two confirmed decisions; supersession stays a human act
  (Part 9) and is out of scope.

Threat model, stated: a model with an unrestricted shell on the same machine can forge any local
file, key included; no local design stops that. This design guarantees that transcript text, MCP
arguments and room files cannot mint a confirmed decision, and that only host-hook lines with a
valid mac do.

Pre-build spike S0 (blocking slice b): capture one real PostToolUse stdin for AskUserQuestion on this
host (answered, "Other" text, cancelled) and pin the field names in the hook and its test fixture.

## 7. Doctor

`lib/core/doctor/room-graph-integrity-module.cjs` (which may read files; `graph-integrity-counts.cjs`
may not): `room_files_without_artifact_node`, `artifact_nodes_hash_differs`, `artifact_id_collisions`,
`card_ledger_pending`, `card_ledger_rejected` (counts), and `catchup_state`, `catchup_remaining`,
`catchup_last_run_at` from the status file (strings outside `totals`). A `running` state with a dead
pid reads `stale_run`. The doctor module is added to the substrate allowlist with the runner.

## 8. Substrate gate

`scripts/check-substrate.cjs` bans lazygraph imports and `openGraph(` outside `ALLOWED_DIRECT_IMPORT`
(`:63-175`). Add `scripts/graph-catchup.cjs` and `lib/core/doctor/room-graph-integrity-module.cjs`
with the reason "Phase 367 catch-up indexer: generated index of room files, the same scope as
rebuildGraph". Every slice gates on `node scripts/check-substrate.cjs --diff` exiting 0.

## 9. Files (Create C, Modify M) and order a -> b -> c -> d, each green before the next

| Slice | File | Action |
|---|---|---|
| a | `lib/core/lazygraph-ops.cjs` (BEGIN IMMEDIATE at :628, :738; `listIndexableArtifacts`, `indexArtifactsBatch`, exports; `rebuildGraph` refactor) | M |
| a | `tests/test-367-begin-immediate.cjs` (AC11), `tests/test-367-enumerator.cjs` (rebuild set equals walker set; collision) | C |
| b | `scripts/graph-catchup.cjs`, `lib/core/jsonl-claim-queue.cjs`, `scripts/card-answer-ledger.cjs`, `tests/fixtures/367/` (S0 stdin captures) | C |
| b | `lib/core/part8-egress-telemetry-queue.cjs` (use the shared queue) | M |
| b | `lib/core/navigation/memory-events.cjs` (`opts.eventId`, `card_answered`) | M |
| b | `scripts/on-stop`, `scripts/session-start`, `hooks/hooks.json` (PostToolUse AskUserQuestion entry; SessionStart matcher adds `resume`) | M |
| b | `tests/test-389-hook-unwire.cjs` (census: add `PostToolUse:AskUserQuestion: 1`, total 42) | M |
| b | `scripts/check-substrate.cjs` (allowlist) | M |
| b | `tests/test-367-catchup-cli.cjs` (AC1, AC3, AC5, AC10), `tests/test-367-card-ledger.cjs` (AC4, AC7) | C |
| c | `lib/mcp/graph-catchup-spawn.cjs` | C |
| c | `scripts/mindrian-mcp-server.cjs` (wrapper after :232) | M |
| c | `lib/core/doctor/room-graph-integrity-module.cjs` | M |
| c | `tests/test-367-catchup-mcp.cjs` (AC2, AC6, AC8) | C |
| d | `agents/larry-extended.md`, `references/personality/memory-and-findings.md`, `references/personality/agent-operations.md`, `skills/larry-personality/SKILL.md`, `output-styles/destijl.md`, `lib/mcp/runtime-instructions.cjs`, `data/harness-policies/memory-write-policy.json`, `tests/fixtures/3696-persona-h/*` | M |
| d | dist bundles: regenerate with `node scripts/build-dist-bundles.cjs` (never hand edits) | M |
| d | `tests/test-367-prose.cjs` (AC9) | C |
| all | `.planning/phases/367-*/367-CONTEXT.md` (OR-1..3), canon change log entry for OR-1 in `docs/MINDRIAN-CANON.md` Appendix D | C, M |

Pointer text replacing the per-turn rule (all surfaces): "Room files and answered cards are recorded
by code. You record meaning: file claims through the gate."

## 10. Acceptance (each a test; detached runs are polled until the status file leaves `running`, cap 30 s)

- AC1 (b) CLI no reminder: temp `MINDRIAN_ROOMS_HOME/<slug>/` with `.room-root` and room.db, made by
  the room birth chokepoint. Session start runs first. Files: `problem-definition/a.md` (Write path),
  `market-analysis/b.md` (shell write), `solution-design/c/c.md` (simulated subagent, file only).
  Run the real `on-stop` with a Stop stdin. Then the three Artifact ids exist, and
  `files_indexed >= 3`.
- AC2 (c) MCP no reminder: in-process server, no hooks: `room_bind`, `artifact_file` x2, one file
  written by another process, then any read tool, then wait 11 s (trailing debounce). All 3 Artifact
  ids exist.
- AC3 (b) Missed run: kill a run with `--run-seam 1`; delete the cache; the next trigger ends
  `complete` with the same Artifact id set as a `rebuildGraph` of the same room; a second run gives
  `files_indexed: 0`.
- AC4 (b) OR-1: a fixture PostToolUse stdin for an answered card, run through the real hook, then the
  runner: exactly 1 decision node, `review_status = 'confirmed'`, `confirmed_by` = the navigator from
  `resolveByUser`; 1 `card_answered` row. Negative legs, each giving 0 decisions: a cancelled card; a
  forged line with a bad mac; a fabricated AskUserQuestion pair appended to a transcript file; a
  `stop_gate_check` call with a model-supplied `transcript_path`. Repeating the line gives no new node.
- AC5 (b) Honest failure: hold `write.lock`; the run ends `deferred`, reason `write_lock_held`; its
  `last_run_at - started_at < 2000 ms`; the next run ends `complete` and the doctor reports
  `room_files_without_artifact_node = 0`.
- AC6 (c) Doctor: one unindexed file gives `room_files_without_artifact_node = 1`; a killed run gives
  `stale_run`.
- AC7 (b) Two rooms: a card answered with `cwd` in room A while the session later stops in room B:
  the decision lands in A only.
- AC8 (c) Spawn safety: the wrapped tool returns before the runner ends; the MCP stdout carries no
  runner byte; on-stop returns while the runner is still running.
- AC9 (d) Prose: regex `(every|each) substantive turn` finds nothing in `agents/`, `skills/`,
  `references/personality/`, `output-styles/`, `lib/mcp/runtime-instructions.cjs`,
  `data/harness-policies/`; the pointer line is present; `node scripts/run-harness.cjs --check` passes.
- AC10 (b) Large room: 2,000 generated files, empty cache, up-to-date graph: the room reaches
  `complete` with `files_indexed: 0` within 4 runs; then a run on the warm cache takes under 1 s.
- AC11 (a) 517: two processes, one holds `BEGIN IMMEDIATE` then commits; `indexArtifact` waits and
  succeeds (at base it fails with errcode 517).
- AC12 Release: `node scripts/real-room-run.cjs` large room leg stays inside its RULE 10 limits.

## 11. Alternatives considered

| Alternative | Rejected because |
|---|---|
| Louder prose rule | Tried in quick 260612-t29; the symptom returned |
| Per-turn memory_event (`turn_closed`) | Same telemetry flood as Phase 394 (14,082 of 14,749 nodes); the status file holds the run summary |
| Sweep inside the hook | Hooks die at their budget during the uninterruptible 5 s busy wait (400.3 V3) |
| Sweep in-process in the MCP server | Blocks the stdio loop |
| Parse card answers from the transcript | The model can write the transcript file (forgery); a cancelled card also has a tool_result |
| Mint the decision as confirmed at insert | Skips the confirm chokepoint and its audit row (`transitions.cjs`) |
| Outbox for all records, ingest ledger table | Files have a durable source (the tree); the fixed ids plus `ON CONFLICT DO NOTHING` give exactly-once. Only card answers need a queue |
| Four explicit MCP trigger sites | Desktop calls bind and context only at first activation (`runtime-instructions.cjs`); one wrapper at `:232` covers every call with one site |
| Tree-watcher file events | Its contract is directory events only (`tree-watcher.cjs:5-12`) |
| A PostToolUse Bash matcher | Starts a hook per Bash call; Stop already diffs the whole tree |
| Machine-wide job lock (`job-lock.cjs`) | Its 6 h heartbeat ceiling (`:56`) blocks every room after a killed runner whose pid is reused |
| Turn and session nodes; context ids as provenance | Frozen PART_OF endpoints (`edges.cjs:363-368`); never-fabricate floor (`reasoning-write.cjs:162-165`) |

## 12. Risks

- The first full pass of a large room takes several runs; the status reads `partial` with `remaining`
  until it ends (AC10 bounds it).
- `write.lock` contention with the post-write cascade: the runner takes the lock per batch of at most
  10 files and yields between batches.
- PostToolUse for AskUserQuestion is ASSUMED to fire with the answer in stdin; spike S0 proves it
  before slice (b). If it does not fire, OR-1 falls back to a gate-card route and the owner is told.
- A detached child on native Windows may not survive a host kill (UNVERIFIED); the dirty file and the
  next trigger recover.
- On Desktop, a session with no mindrian-os tool call reaches no server code (host ceiling,
  SEED-065); the next call catches up.
