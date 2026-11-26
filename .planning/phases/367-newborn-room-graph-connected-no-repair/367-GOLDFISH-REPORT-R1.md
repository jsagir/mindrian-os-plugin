---
phase: 367
round: 1
target: 367-DESIGN-DRAFT.md
reviewers:
  zoom_out: completed (0 Blocker, 7 Major, 5 Nit)
  implementation_readiness: completed (3 Blocker, 14 Major, 5 Nit)
  design_critic: completed (3 Blocker, 11 Major + 4 grouped, 6 Nit)
  codebase_details: completed (2 Blocker, 10 Major, 6 Nit)
clean_round: false
next: 367-DESIGN.md (revision 2), then round 2
---

# Goldfish review, round 1: findings and resolution

Outcomes: FIXED (in 367-DESIGN.md r2), CUT (removed from scope, deferred with a reason),
CONTESTED (evidence given), OWNER (sent to the owner card). Findings raised by more than one
reviewer are merged; the ids list every source (ZO zoom-out, IR implementation readiness,
DC design critic, CD codebase details).

## Blockers

| Id | Finding | Outcome |
|---|---|---|
| IR-B1 | No file boundary; a write allowlist cannot be built | FIXED: section 9 file table, Create/Modify per slice |
| IR-B2, ZO-6 | Candidate extraction names no method, no schema; no human in a hook for the F.8 card | CUT: extraction, basket and F.8 card move to a follow-up plan (Phase 280 scope). O2 leaves the critical path |
| IR-B3, DC-M3 | Watermark model contradicts itself (graph is the watermark vs a moving file watermark); mtime misses cp -p, mv, git checkout, sync | FIXED: one model, section 5.2. Files: graph diff by stored content_hash, with an mtime/size cache only to skip work. Transcript: per-session progress keyed by entry uuid. No moving file watermark |
| DC-B1 | No alternatives section | FIXED: section 8 |
| DC-B2 | turn -PART_OF-> session breaks the frozen PART_OF endpoint contract (edges.cjs:363-368) | CUT: no turn and session nodes in this phase (also ZO-5). No new edges of that kind |
| DC-B3, IR-M11 | Auto-provenance from context node ids fabricates provenance (reasoning-write.cjs:162-165, views.cjs:423-429) | CUT: the never-fabricate floor stands. AC2 no longer asks for SOURCED_FROM to context ids |
| CD-B1, IR-M4, DC-M1 | AC4 fails by construction: logEvent writes every memory_event as confirmed (memory-events.cjs:897-900) | FIXED: AC4 scoped to claim and decision nodes; memory_event rows are confirmed bookkeeping by design (CONTEXT.md:17) |
| CD-B2 | Doctor counts break the graph-integrity-counts contract (integers only, no fs, banned adjectives) | FIXED: counts live in the doctor organ (room-graph-integrity-module.cjs), neutral names |

## Majors

| Id | Finding | Outcome |
|---|---|---|
| ZO-1 | Outbox has no producer that needs it | CUT: every record has a durable source (transcript, file tree, gate ledger). Also removes CD-10 cap-loss and race issue |
| ZO-2 | ingest_ledger duplicates insertNode ON CONFLICT DO NOTHING (node-insert.cjs:244-261) | CUT: deterministic node ids plus the existing upsert; logEvent gets a stable caller id |
| ZO-3, IR-M10 | MCP tool-call wrapper touches every handler; little added coverage | CUT (deferred). AC2 uses context_assemble |
| ZO-4, IR-M9, DC-M5, CD-7 | Tree-watcher subscribes to directories only by design | CUT (deferred). The next bind or context call catches up; nothing is lost |
| ZO-7 | Overlap with 400.3: two detached writers (400.3-08), two status files (last-cascade.json) | FIXED: section 4 ownership table. One runner; 400.3-08 becomes a job type of it; last-cascade.json stays per write, graph-catchup.json is the room-level status |
| IR-M1, CD-6 | indexArtifact cannot batch and never reads the stored hash | FIXED: the runner uses openGraph + _indexArtifactBody under withRoomTx (navigation.cjs:676), and compares json_extract(properties,'$.content_hash') with computeHash(_readArtifactContent(f)); export both helpers |
| IR-M2, DC-M10 | "All writes through the chokepoint" is not true for the reused path | FIXED: exceptions listed (section 6.4): Artifact indexing (lazygraph, BELONGS_TO raw SQL) and logEvent are existing ruled exceptions; no new raw table |
| IR-M3, CD-5, DC-M2 | New memory_event types are not in EVENT_TYPES | FIXED: slice (b) adds turn_closed, session_closed, card_answered |
| IR-M5, CD-4, DC-M2 | uuid keying needs a parser change and a fragments migration | FIXED: slice (a) |
| IR-M6, CD-3 | endSession overwrites key_decisions on every Stop and PreCompact | FIXED: slice (b) changes both callers to merge, never clear |
| IR-M7 | on-stop:48 has no room; MCP-first branch exits at :133 | FIXED: launch after ROOM_DIR at on-stop:144; MCP-first path launches from stop_gate_check |
| IR-M8 | Existing hooks open room.db today | FIXED: stated: on-stop and pre-compact keep their existing opens; the runner is the only NEW writer |
| IR-M12, DC (contract check) | Contract check not specified | CUT (deferred): a detector, not a writer |
| IR-M13 | ACs not testable as written | FIXED: section 10, files_indexed defined, polling for the detached runner, fixture named, AC to slice map |
| IR-M14, CD-12 | Prose rule has more copies (5 in scope, plus destijl.md, harness policy, fixtures) | FIXED: full list in the file table; the pointer text is given |
| DC-M4 | Transcript ownership, concurrent sessions per room | FIXED: per-session progress; one fragment writer (the existing Stop ingest, fixed) |
| DC-M6 | MCP identity keys | FIXED: per-surface key table (section 6.3) |
| DC-M7 | Telemetry bound breakable | FIXED: turn_closed upserted by turn key; the bound counts every row class |
| DC-M8 | Lock hold time unbounded | FIXED: read and hash outside the transaction; batch capped by elapsed ms |
| DC-M9 | Resource cost and RULE 10 | FIXED: budgets stated; one runner per machine via job-lock.cjs; derive drain stays at SessionStart (in-session drain deferred) |
| DC-M11 | Node-and-edges rule vs 400.3-01 transactions | FIXED: the runner writes no new edges in this phase |
| CD-8 | R4 and R7 understate today's write paths | FIXED: corrected in section 2 |
| CD-9 | "Never ok:true on a partial" conflicts with 400.3-01 | FIXED: aligned: a tool keeps ok:true with partial:true; the room status file has its own state field |
| CD-10 | Reuse missed: job-lock.cjs, withRoomTx, room_change_log, session-catchup.cjs, graph-backfill | FIXED: all reused (section 6) |
| CD-11 | New node types need consumer and registry updates | CUT: no new node types |
| DC deletes | Deletes and renames | FIXED: counted only (artifact_nodes_without_file); removal needs a gate (deferred) |
| DC security | Untrusted transcript text into cards; file modes | FIXED for scope: no card from transcript text in this phase; status file has no content |

## Owner items

- O1 restated (IR-M4): the locked rule says only a gate approve confirms. A CLI card answer
  therefore lands as a `card_answered` record plus a `proposed` decision unless the owner changes
  the rule.
- O3 phase home, O4 dropped (wrapper cut), O2 dropped (basket cut).

## Nits

Fixed: base sha, citation ranges, 85 commands, logMemoryEvent dedupe only with dedupe_key,
graphOps naming, 400.3-02b dependency, room guard via .room-root. Deferred: SubagentStop
agent_id (row cut).
