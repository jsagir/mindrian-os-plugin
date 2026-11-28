---
phase: 367
title: "The graph writes itself: turn-close and session-close stages"
status: DRAFT (EGM, before Goldfish review)
date: 2026-11-26
absorbs: Phase 280 / SEED-008, SEED-101
depends_on: 400.3-01, 400.3-02 (executed first)
inputs:
  - scratchpad graph-write-map.md (every room.db write path, gaps G1-G11)
  - scratchpad graph-history.md (history, open phases, owner rules)
  - scratchpad solution-neo4j.md (agent-memory lens), solution-sqlite.md (write-path lens), solution-icm.md (ICM lens)
base: main f328ed520 (beta.94 in progress)
---

# 367 Design draft: the graph writes itself

## 1. Problem

The owner must often ask "write it to the graph". MindrianOS writes the per-room local graph
(`<room>/.mindrian/room.db`) only when the model decides to call a tool, or when someone runs an
index. This is the third report of the same symptom. Quick task 260612-t29 (June) fixed it with
prompt text only, and the symptom came back.

Goal: every substantive event of a session reaches room.db by code, on every surface, with no
reminder. Judgment (what a thing means, whether it is true) stays with the model and the human.

## 2. Root causes (PROVEN unless marked)

| # | Cause | Evidence |
|---|---|---|
| R1 | The only per-write path that makes an Artifact node (post-write cascade) skips every room under `~/MindrianRooms/`: its path rule needs `/room/` or `/rooms/`. Run on a scratch room: `cascade skipped`. | `lib/core/intelligence-cascade.cjs:182-184, 650-654`; `scripts/post-write:282`; debug/384-s2-cascade-path-rule.md |
| R2 | `artifact_file` never indexes the file it writes and still returns `ok: true`. | `lib/mcp/tools/views.cjs:408-440`; Phase 367 brief: 18 calls, 0 Artifact nodes |
| R3 | Every typed record (claim, decision, memory_event, edge) needs a model tool call. The rule "fire memory_event on every substantive turn" is prose in 3 places. | `agents/larry-extended.md:166`; `references/personality/memory-and-findings.md:81`; `skills/larry-personality/SKILL.md:192` |
| R4 | No hook covers Bash writes, card answers (AskUserQuestion), research filing, compaction or session end. Hooks write room.db on 4 events only. | `hooks/hooks.json:196-340` |
| R5 | The transcript reader drops every tool event, so card answers and tool calls never reach the graph. `sessions.key_decisions` is hardcoded `[]`. | `scripts/transcript-ingest.cjs:60, 77`; `scripts/memory-lifecycle.cjs:436, 535` |
| R6 | SubagentStop re-indexes only `.md` files changed in the last 30 s, at most 20, and hits R1. PreCompact reads no transcript_path. FileChanged is inert. | `scripts/on-agent-complete:58-105`; `scripts/pre-compact:132`; `scripts/on-file-changed:13-21` |
| R7 | Desktop and Cowork have no hooks. No MCP code runs an index or a sweep by itself. | grep `lib/mcp`: only `tool-router.cjs:1338,1344`, `room-readiness-gate.cjs:114`; SEED-065 |
| R8 | Typed edges are derived only at the next SessionStart, on the CLI. | Phases 169, 224, 233 (D-169-01) |
| R9 | Two new SQLite defects found in this audit (see 6.4): deferred `BEGIN` fails at once with errcode 517 under a concurrent writer; the fragment watermark is a count, so one failed turn is lost and a later one is written twice. | `lib/core/lazygraph-ops.cjs:628, 738` (PROVEN by run); `scripts/memory-lifecycle.cjs:270-296` (PROVEN by read, not run) |

ICM framing: room.db is a generated index of the room's files and events, but the model edits it by
hand, turn by turn. A hand-kept index always drifts (ICM invariant 9). The L2 contract already
declares what each command must file (`connector.filing` in 83 commands), but it is linted only,
never checked at run time (`scripts/build-connector-registry.cjs:588, 932-944`).

## 3. What 400.3 already fixes, and what it does not

400.3 (session jsagi-d0, planned, not executed): plan 01 makes `artifact_file` index inline and
return `graph_index {ok, reason}` and `partial`; plan 02 replaces the path rule with `.room-root`
plus an existing room.db (index only). This closes R2 and the Write/Edit part of R1.

Not covered by 400.3: R3, R4, R5, the subagent cap of R6, R7, R8, R9, a catch-up sweep, doctor
counts, SOURCED_FROM from a claim to its Artifact. This design covers those and reuses the 400.3
primitives (`busyMs`, `mustExist`, `lockWaitMs`, `classifyIndexError`, `acquireLockWithBackoff`).

## 4. Design principle: record versus claim

Taken from agent-memory practice (neo4j-agent-memory skill) and kept in the repo's HITL rule:

- A RECORD is what happened: a turn, a file write, a card answer, a meeting filed, a research run,
  a subagent end, a compaction, a session. Code captures it every time. It lands with
  `epistemic_type: observation`, `created_by: 'system'`, `properties.origin: 'hook' | 'mcp'`.
  (`created_by: 'hook'` is not allowed by the CHECK enum, `phase-109-nodes-provenance.cjs:297`.)
- A CLAIM is what it means: a decision rationale, an insight, a relation, a contradiction. Local
  code may propose candidates; they go to a pending basket, never straight to `confirmed`. Only a
  human approve through `gate_answer` confirms (unchanged).

Code owns the record. The model and the human own the judgment.

## 5. The two stages

### 5.1 turn-close: make the graph agree with what this turn did

Inputs: transcript delta since the turn watermark (CLI), room files changed since the file
watermark (any writer: Write, Bash, subagent, another app), gate ledger answers since the gate
watermark, `/mos:` commands that ran in the turn with their declared `connector.filing`.

Steps (one run, idempotent):
1. Ingest new transcript fragments, keyed by the transcript entry uuid (fixes R9 count bug).
2. Index every changed room file through `graphOps.indexArtifact` with the 400.3-01 options, in
   batches of at most 25 under `BEGIN IMMEDIATE` and `write.lock`. The graph is its own watermark:
   an Artifact node stores `content_hash` (`lazygraph-ops.cjs:419, 561`); same hash means no work.
3. CLI: read AskUserQuestion tool_use and tool_result pairs; write one `card_answered` record and
   one `decision` node per answer, `decision -SOURCED_FROM-> turn` (status: owner decision O1).
4. Contract check: for each command that ran, compare its declared filing with the rows that
   landed. Report `declared_filing_missing`.
5. Candidate extraction (bounded, local, no model call, no Brain call): write candidates to
   `.mindrian/pending-basket.json` (owner decision O2). Never a graph node at this step.
6. Write exactly one `turn_closed` memory_event (scalars and enums only, Part 8 safe):
   `{files_seen, files_indexed, decisions, candidates, declared_filing_missing, partial, reason}`.
   Advance the watermarks ONLY after steps 1-5 commit.

Failure: a held lock or a busy room.db gives `partial: true` with a typed reason; the watermark does
not move; the next close retries. Never `ok: true` on a partial.

### 5.2 session-close: fold the session into durable memory

Steps: a final turn-close; drain the derive queue in-session (R8) within a bounded budget; fill
`sessions.key_decisions` from the decision nodes of the session; regenerate stale BRIEF and MINTO
faces; raise one F.8 basket card for the session's candidates; write one `session_closed`
memory_event with the 5 health counts (6.5).

### 5.3 Node and edge map (no new edge types)

| Event | Record node | Edges | Identity key |
|---|---|---|---|
| Session start | `session` (new type string) | none | `session:<host session id>` |
| Anchored turn (a turn that something points at: a tool call, a file write, a card answer, a candidate) | `turn` (new type string); plain chat stays in `fragments` only | `turn -PART_OF-> session`; `turn -FOLLOWS_FROM-> previous anchored turn` | `turn:<session id>:<transcript uuid>` |
| File write | `Artifact`, `Section` (existing indexer) | existing section and wikilink edges; `Artifact -SOURCED_FROM-> turn {relation: produced_in, tool}` | room-relative path without extension (`lazygraph-ops.cjs:382-386`) |
| CLI card answer | `memory_event card_answered`; `decision` | `decision -SOURCED_FROM-> turn`; `decision -ATTRIBUTED_TO-> session` | `card_answered:<tool_use_id>` |
| MCP gate answer | `decision` (existing) | existing; add `-ATTRIBUTED_TO-> session` | gate id |
| Meeting filed | transcript `Artifact {kind: meeting}` | `claim -SOURCED_FROM-> meeting Artifact {relation: extracted_from}` | path id; claim `sha(meeting + segment + text)` |
| Research run | `memory_event research_run_completed` | `-FOLLOWS_FROM-> plan decision` | `research_run_completed:<run_id>` |
| Subagent end | `memory_event subagent_completed` | each file it wrote `Artifact -SOURCED_FROM-> event {relation: produced_in}` | `subagent_completed:<agent_id>` (ASSUMED in hook stdin) |
| Compaction | `memory_event compaction` (after a transcript flush) | `-PART_OF-> session` | `compaction:<session id>:<ordinal>` |
| Filing with evidence | claim from `artifact_file` | `claim -SOURCED_FROM-> Artifact` (the missing half of 367 P1-3) | existing |

Rules: a node and its edges are written in one transaction (`writeEdge` does not check endpoints,
`edges.cjs:1050-1061`). A background writer never mints a `confirmed` edge (`edges.cjs:1084-1087`
guard kept). Telemetry bound: the close stages add at most 1 row per turn and 1 per session
(Phase 394: 14,082 of 14,749 nodes are already telemetry).

## 6. Mechanism

### 6.1 One writer, many triggers

- `lib/core/room-close.cjs`: `turnClose(roomDir, opts)` and `sessionClose(roomDir, opts)`. All
  writes through the navigation chokepoint. Never throws; returns an honest status.
- `scripts/graph-catchup.cjs <roomDir> --reason <event>`: the detached runner. A per-room
  `sweep.pid` mutex stops two runs. Triggers only spawn it and return; no trigger opens room.db.
- Status file `<room>/.mindrian/graph-catchup.json`: `complete | partial | deferred | failed`, a
  typed reason, counts, failed files, remaining count. Hooks and tools say "catch-up queued",
  never "indexed".

### 6.2 Where it runs

| Trigger | CLI (hooks) | Desktop and Cowork (MCP only) |
|---|---|---|
| Turn end | Stop (`scripts/on-stop:48`), detached | debounced turn-close before each mindrian-os tool call on a bound room (one `registerTool` wrapper; none exists today) (O4) |
| File change | PostToolUse Write/Edit/MultiEdit (400.3-02); new PostToolUse Bash matcher (sweep only) | the MCP server's tree watcher (`scripts/mindrian-mcp-server.cjs:312, 408, 657`) routes a debounced change to an index-only sweep (ASSUMED feasible) |
| Catch-up | SessionStart, UserPromptSubmit | `room_bind`, `context_assemble`, `room_startup`, `artifact_file`, `stop_gate_check` |
| Subagent | SubagentStop: the watermark sweep replaces the 30 s window and the 20-file cap | n/a |
| Compaction | PreCompact reads `transcript_path`, flushes the transcript first | n/a |
| Session end | SessionEnd spawns session-close; the next SessionStart catches up | re-bind or a new bind closes the prior visit; `stop_gate_check` close-out |

Honest limit: on Desktop, pure talk with no tool call and no file change reaches no server code
(host ceiling, SEED-065). The catch-up at the next tool call or bind closes the gap; nothing is lost.

### 6.3 Durable outbox

`<room>/.mindrian/graph-outbox.jsonl`: append-only side file, no lock, no room.db open. Producers
(hooks, tools) append a line with a deterministic key; the single writer drains it. Copy the
claim-by-rename drain of `lib/core/part8-egress-telemetry-queue.cjs:120-260`. A room.db table was
rejected: a producer then pays the busy wait, which a hook cannot interrupt (measured: 400.3 V3,
5,006 ms; scratch probe: append 0 ms, INSERT under a held lock errcode 5 after 203 ms).

Exactly-once effect over at-least-once delivery: a new `ingest_ledger(key PRIMARY KEY)` table,
written by the drainer in the same transaction as the node. `logMemoryEvent` dedupes for 60 s only
and uses random ids (`memory-events.cjs:890`); it must accept a stable caller id.

### 6.4 SQLite defects fixed on the way

- `lazygraph-ops.cjs:628, 738`: change deferred `BEGIN` to `BEGIN IMMEDIATE`. Scratch run: deferred
  BEGIN, read, other writer commits, write -> errcode 517 after 1 ms; the busy wait never runs.
- `memory-lifecycle.cjs:270-296`: key fragments by transcript uuid, not by count; do not swallow a
  per-fragment failure.

### 6.5 Doctor counts (extend `graph-integrity-counts.cjs:345`, no new health script)

`files_without_artifact_node`, `stale_artifact_nodes`, `orphan_artifact_nodes` (count only; deleting
needs a gate), `outbox_pending`, `outbox_rejected`, `last_sweep_at`, `last_sweep_status`.

## 7. Prose rules converted

| Rule today | Becomes |
|---|---|
| "Fire memory_event silently on every substantive turn" (3 copies) | code (turn-close); one pointer line stays |
| `connector.filing` declarations | runtime contract check in turn-close |
| evidence ids on `artifact_file` | auto-provenance from the session's context node ids |
| "file a confirmed claim through claim_write" (`larry-extended.md:172`) | corrected: claim_write lands `proposed` only |
| proposing claims, analogies, contradictions | gate card (basket); model judgment |
| deciding what is worth keeping | stays model judgment |

## 8. Scope, slices and acceptance

Slices (each a plan; a and b can start right after 400.3-01/02):
- (a) BEGIN IMMEDIATE fix + 517 regression test; fragment uuid watermark.
- (b) `room-close.cjs` turn-close + `graph-catchup.cjs` + status file; Stop and SubagentStop launch.
- (c) MCP launch in bind, context, startup, artifact_file, stop_gate_check + doctor counts.
- (d) outbox + ingest_ledger migration + card-answer and turn producers + session node.
- (e) PreCompact transcript flush, Bash matcher, session-close, in-session derive drain.
- (f) tree-watcher index route; MCP tool-call wrapper; prose removal.

Out of scope: new extraction models; any Brain call (Part 8 unchanged); any auto-confirm.

Acceptance (each a test):
- AC1 CLI, no reminder: a scripted session in `~/MindrianRooms/<slug>/` with zero graph tool calls
  writes 3 files with Write, 1 with Bash, 1 by a subagent, answers 1 card, then Stop. room.db then
  holds 5 content Artifact nodes, 1 decision node, 1 `turn_closed` row with `files_indexed: 5`.
- AC2 MCP, no reminder: in-process server, no hooks: room_bind, context_assemble, 2 x artifact_file
  with no evidence ids, 1 file dropped by another process, then any read tool. room.db holds 3
  Artifact nodes; each filing has SOURCED_FROM to the context node ids.
- AC3 Missed close: roll back the watermark; the next bind or SessionStart restores the same node
  set; a second run adds 0 rows.
- AC4 HITL: no node from the close stages is `confirmed` without a human approve.
- AC5 Honest failure: a held write.lock gives `partial: true` with a reason; the watermark does not
  move; the next close completes and `files_without_artifact_node` returns 0.
- AC6 Contract check: a command declared `fileEvidenceWithReadback` that files nothing gives
  `declared_filing_missing: 1`.
- AC7 Session: one answered card gives `key_decisions` length 1 and one `session_closed` row.
- AC8 Telemetry bound: 10 turns add at most 10 `turn_closed` rows and 1 `session_closed` row.
- AC9 Prose gone: no "every substantive turn" rule in agents/, skills/, references/personality/.
- AC10 Kill safety: kill the runner after batch 1; the next run finishes; no duplicate node.

## 9. Owner decisions needed

- O1 A card answer on the CLI (AskUserQuestion): does its decision node land `confirmed` (the
  answer is the human's act) or `proposed` until a gate_answer?
- O2 Candidates: a pending basket file until the F.8 card (recommended), or `proposed` nodes at once?
- O3 Home: Phase 367 absorbing 280 (recommended), or new plans inside 400.3?
- O4 MCP: accept one tool-call wrapper on every mindrian-os tool (it touches every handler)?

## 10. Risks

- The first sweep of a large room (2,000+ files) takes several triggers; status reads `partial`
  until done. Measured cost: stat walk of 2,259 files 115 ms cold; sha256 of 2,252 files 1,365 ms.
- write.lock contention between the detached runner and the PostToolUse cascade; the runner must
  back off and defer, never fail loud.
- A detached child may not survive a host kill on native Windows (UNVERIFIED). NTFS and OneDrive
  behaviour of WAL and O_EXCL is UNVERIFIED.
- Artifact ids drop the extension, so `a.md` and `a.html` share one id (pre-existing).
- The turn-anchor rule can drift into a node per turn; AC8 and a doctor count guard it.
