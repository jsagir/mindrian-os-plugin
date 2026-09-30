# MindrianOS bug report: a newly born room does not get a proper local graph

**Date:** 2026-09-30
**Plugin:** mos 2.0.0-beta.51 (marketplace cache install)
**Surface:** Claude Code CLI, Windows 11, Node v22.23.1, Git Bash and PowerShell
**Session:** bc615a22-a62f-430c-ae8f-f87ddf8fc656
**Room:** `<client-room>`, born in this session through `/mos:ignite`
**Reported by:** the agent running the session, at the navigator's request

## Summary

A room was born, a meeting transcript was filed, and 18 claims were filed through `artifact_file`. About 50 minutes and 30 documents later the navigator asked whether the local graph was proper. It was not:

- None of the filed documents was an `Artifact` node.
- The 19 claim nodes had one edge each, to a generic `jtbd:*` anchor. No claim linked to its own document or to another claim.
- There were no `SUPPORTS`, `INFORMS`, `REFINES` or `CONTRADICTS` edges.
- The MCP graph tool reported zero nodes, because it was reading a different directory.

The graph became usable only after the agent called the plugin's library directly: `graphOps.rebuildGraph`, `navigation.writeEdge`, `writeOpenQuestionNode` and `upsertStakeholder`. A navigator on a hookless surface could not have done that.

The expectation: filing through the governed tools leaves a connected graph, without a repair pass.

## Severity key

- **P1** blocks the core promise or can damage data.
- **P2** produces wrong or misleading state.
- **P3** friction or a design gap.

---

## P1-1. `room_graph` commands run against the boot-time room, not the session-bound room

**Observed**
- The session was bound with `room_bind` to `<client-room>`. `artifact_file` and `whitespace_scan` both reported that `room_dir`.
- `room_graph graph-stats` returned `{"total":{"nodes":0,"edges":0}}`. At that moment the bound room's `room.db` held 157 nodes and 31 edges (read directly with `node:sqlite`).
- `room_graph graph-rebuild` returned `{"success":true,"artifacts":0,"sections":2}`. The bound room's `room.db` was unchanged afterwards.

**Cause, from the code**
In `lib/mcp/tool-router.cjs` the `room_graph` handler passes the closure variable `roomDir` to `graphOps.indexArtifact`, `rebuildGraph`, `queryGraph` and `graphStats` (around lines 1139-1180). The `room_state` handler in the same file uses `activeRoomDir`, the per-call resolved room (around lines 896-904). The file's own header comment describes this exact class of bug for `room_content`.

**Not established**
Which directory the rebuild actually ran against. No other `room.db` under the home directory (searched to depth 6) was modified in that window.

**Why P1**
`rebuildGraph` starts with `clearIndexerOwnedRows`. Run against the wrong room, it wipes and regenerates that room's `Artifact` and `Section` nodes and `BELONGS_TO` edges.

**Expected**
`room_graph` resolves the room the same way `room_state`, `artifact_file` and `whitespace_scan` do, and returns `room_dir` in its result so a mismatch is visible.

## P1-2. `graph-index` cannot be called through MCP

**Observed**
`room_graph` with `command: "graph-index"` returns `graph-index requires a file path in the section parameter`.

**Cause, from the code**
`section` is declared as `sectionOptional = z.string().regex(SECTION_RE, 'section must match [a-z0-9-]+')` (`tool-router.cjs` line 136). A file path contains `/` and `.`, so it cannot pass the schema. The command needs a parameter the schema forbids.

**Expected**
A separate validated path parameter for `graph-index`, resolved inside the room.

## P1-3. Filing does not index the file or link the claim to it

**Observed**
After 18 `artifact_file` calls:
- `nodes` had 13 rows of type `Artifact`, all with `source_path = 'system:rs-engine'` and all scaffold templates (`*/FEYNMAN`, `*/CONTEXT`). None was a filed document.
- Each claim node had `source_path = 'artifact:<id>'` and `source_section = NULL`.
- Each `artifact_file` result showed one `anchor_edge`: `SOURCED_FROM` to `jtbd:<something>`, and `reasoning_node.edges_written: 0`.

So a claim could not be traced to its document through the graph, and section membership was absent on the claim.

Files written with the Write tool or a shell (the transcript, the research reports, the synthesis, an HTML form) were not indexed either. A file created after the repair again showed up as unindexed in the health check until `indexArtifact` was called by hand.

**Expected**
- `artifact_file` calls `indexArtifact` on the file it just wrote, writes `SOURCED_FROM` from the claim to that `Artifact` node, and sets `source_section`.
- A post-write hook indexes any indexable file written inside the bound room.

## P2-1. No relationship edges were derived

**Observed**
`room-birth` printed `BRAIN derivation enqueued for room: <client-room>`. `.mindrian/graph-derive-queue.json` exists (156 bytes). Through the whole session no `INFORMS`, `SUPPORTS`, `CONTRADICTS`, `ENABLES` or `INVALIDATES` edge appeared. `lazygraph-ops.cjs` states that the legacy wikilink cascade is disabled and that derivation is now the sole writer of those types.

**Not established**
Whether the queue was ever drained, or what would drain it on this surface.

**Expected**
Either derivation runs during the session, or the room state says plainly that derivation is pending and how to run it.

## P2-2. `compute-state` counts scaffold files as entries and misreports the stage

**Observed**
Immediately after birth plus the first filings, `STATE.md` read `venture_stage: Investment`, `total_entries: 42`, with most sections `Well-developed`, and `meetings | 0 | Empty`.

**Cause, from the code**
`scripts/compute-state` line 96: `find "$section_dir" -maxdepth 1 -name "*.md" ! -name "ROOM.md"`. It excludes only `ROOM.md`, so `CONTEXT.md` and `FEYNMAN.md` count as entries in every section. The stage ladder (lines 138-149) then reads "has problem, solution, business and financial" as `Investment`. `-maxdepth 1` also misses the nested meeting folder, which held four files.

`section-registry.cjs` already has `isIndexableArtifactFile`, which excludes `CONTEXT.md`. The two predicates disagree.

**Expected**
One shared predicate. A newborn room with no filed content reads as empty and `Pre-Opportunity`.

## P2-3. The reverse-salient engine links scaffold templates in an empty room

**Observed**
Before any content was filed the room had 10 `REVERSE_SALIENT` edges between template files, for example `funding/FEYNMAN -> legal-ip/FEYNMAN` and `competitive-analysis/CONTEXT -> opportunity-bank/CONTEXT`.

After `rebuildGraph`, three of those edges dangle, because `CONTEXT.md` is excluded from indexing and its nodes are wiped and not recreated.

**Expected**
The engine skips scaffold templates, and `clearIndexerOwnedRows` removes edges whose endpoints it deletes.

## P2-4. The invariant validator flags every section of a newborn room as critical

**Observed**
`.mindrian/invariant-report.json` (kind `on-stop`) lists `MINTO.md missing in section "<name>"` with `severity: critical` for each section read (assets, business-model, competitive-analysis, financial-model, funding, legal-ip; the rest of the file was not read). The scaffold creates `ROOM.md`, `CONTEXT.md` and `FEYNMAN.md` per section, and one `MINTO.md` at the room root.

**Expected**
Either the scaffold creates the file, or its absence in a section with no content is not critical.

## P2-5. Brain boundary refuses generic methodology questions, and misclassifies one that passes

**Observed** (no room content was sent in any of these)

| Call | Result |
|---|---|
| `brain_ask`: "Which frameworks fit an ill-defined problem, and in what sequence?" | Answered |
| `brain_ask`: "Which frameworks fit a wicked problem, and in what sequence?" | Answered, but `problem_type: IllDefined` and the identical four options as the row above |
| `brain_ask`: "What are the steps of Red Teaming, and which framework should follow it?" | `BRAIN_EGRESS_BLOCKED`, class `freeform_unproven` |
| `brain_ask`: two longer generic questions about partnership formation and hidden assumptions | `BRAIN_EGRESS_BLOCKED`, class `freeform_unproven` |
| `brain_search`: "frameworks for an ill-defined problem: surface hidden assumptions, find the weakest link, test before committing" | `BRAIN_EGRESS_BLOCKED`, class `freeform_unproven` |

The answered calls reported `chain_coverage: {matched: 1, total: 4}`: one of four recommended frameworks maps to a runnable command.

**Expected**
A question naming a framework and asking for its steps passes. "Wicked" is classified as wicked. The refusal says which term tripped it.

---

## P3-1. A meeting and its speakers cannot be represented in the graph

`section-registry.cjs` lists `meetings`, `team` and `references` as `STRUCTURAL_DIRS`, so the transcript and summary are never indexed. The node types minted anywhere in `lib/` include no meeting and no person. Claims extracted from a meeting therefore cannot point at the meeting or at who said them. People could only be stored in the `stakeholders` table, which no edge references. `commands/file-meeting.md` speaks of a meeting node flagged `has_event_date`, which suggests the type was intended.

## P3-2. The ignite skill names an environment variable that is empty

`skills/ignite` tells the caller to pass `sessionId: process.env.CLAUDE_SESSION_ID` to `birthRoom`. In Claude Code that variable is empty; `CLAUDE_CODE_SESSION_ID` holds the id. The comment in `scripts/write-scope-check.cjs` already records this. Following the skill literally would birth a room that the write guard then blocks.

`CLAUDE_PLUGIN_ROOT` and `MINDRIAN_OS_ROOT` were also unset in the Bash tool, so every documented `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}` command fails until the path is supplied by hand.

## P3-3. A room cannot be renamed

`scripts/room-registry` has `create`, `read`, `list`, `update`, `set-active`, `archive`, `get-active`, `git-config` and `bootstrap-missing`. There is no rename. The navigator asked for a different room name minutes after birth; only the display name could be changed.

## P3-4. The room-binding gate fires on content that belongs to the bound room

Mid-session, with the room bound, two pasted messages about the same subject triggered the `UserPromptSubmit` gate: once "also matches mindrianos-venture: switch or stay?", once "no room matched: new project?". Both were false.

## P3-5. `whitespace_scan` reported no unsupported claims

After the repair, 15 of 19 claim nodes had no incoming `SUPPORTS` edge, and `whitespace_scan` returned `"unsupported_claims": []`. The rule in `findUnsupportedClaims` was not read, so this may be intended. It needs a check.

## P3-6. Two instruction sources contradict each other

The session-start context says "NO EMOJI anywhere in output. NO exceptions." The agent definition requires every reply to open with one coloured-square emoji. Both are loaded at once.

---

## Request: a graph health check that runs on a cadence

The navigator's words: "we need to run graph health checks every couple of turns".

Proposed: a check on the Stop hook, every N turns and after any write to the bound room, that fails loudly. The checks used in this session:

1. Every indexable content file on disk has an `Artifact` node.
2. No `Artifact` node lacks a file.
3. Every filed claim has a `SOURCED_FROM` edge to an `Artifact` node.
4. No edge points at a missing node.
5. No content node is isolated, not counting `BELONGS_TO` and `jtbd:*` anchors.
6. Every hypothesis has at least one `SUPPORTS` edge.
7. Node and edge counts by type, to show drift between runs.

A working read-only script is at `~/MindrianRooms/<client-room>/.mindrian/graph-health.cjs`. It caught the unindexed form file on its first run.

## What the repair took

| Step | Call |
|---|---|
| Index 29 documents | `graphOps.rebuildGraph(roomDir)` |
| 67 typed edges | `navigation.writeEdge(db, ...)`, all `review_status: 'proposed'` |
| 10 open questions | `writeOpenQuestionNode(db, ...)` |
| 3 people | `lazygraph.upsertStakeholder(db, ...)` |
| 1 later file | `graphOps.indexArtifact(roomDir, path)` |

No raw SQL write was used. The edge types used were `SOURCED_FROM`, `SUPPORTS`, `REFINES`, `CONTRADICTS`, `DERIVED_FROM`, `FOLLOWS_FROM`, `INFORMS` and `VALIDATES`.

## Reproduction

1. In Claude Code, run `/mos:ignite` and approve a venture blueprint.
2. `room_bind` to the new room.
3. File three documents with `artifact_file`.
4. Call `room_graph graph-stats`. It reports zero nodes.
5. Open `<room>/.mindrian/room.db` and run `select type, count(*) from nodes group by type` and the same for `edges`. Claims exist; no content `Artifact` nodes and no claim-to-claim edges do.
6. Read `STATE.md`. It reports a late stage for a room with three documents.

---

## Verified against repo HEAD (2.0.0-beta.52, 2026-09-30)

The report was written against the beta.51 marketplace cache. These claims were re-checked in the dev repo and still hold:

| Item | Where at HEAD |
|---|---|
| P1-1 | `lib/mcp/tool-router.cjs:1144,1150,1179,1184` pass boot-time `roomDir` to `graphOps.*`; `room_state` resolves `activeRoomDir` via `sessionRoom.resolveSessionRoomDir` at `:887` |
| P1-2 | `tool-router.cjs:136` `sectionOptional` regex `[a-z0-9-]+`; `:1142` graph-index demands a file path in that parameter |
| P2-2 | `scripts/compute-state:143` `find -maxdepth 1 -name "*.md" ! -name "ROOM.md"` (line moved from 96) |
| P3-2 | `skills/ignite/SKILL.md:180` still says `process.env.CLAUDE_SESSION_ID` |

The room name is redacted to `<client-room>` in this copy.
