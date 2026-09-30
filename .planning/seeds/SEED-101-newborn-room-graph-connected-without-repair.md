---
id: SEED-101
status: promoted
promoted_to: "Phase 367 (2026-10-01)"
priority: critical
planted: 2026-09-30
updated: 2026-10-01
planted_during: "field session on Windows 11 (Claude Code CLI, plugin 2.0.0-beta.51), a client room born through /mos:ignite; claims re-verified at repo HEAD 2.0.0-beta.52"
trigger_when: "immediately; P1-1 can wipe the indexer-owned rows of the wrong room. Fix before the next release cut."
scope: "medium (room resolution in one MCP handler, a path parameter, index-on-file in artifact_file plus a post-write hook, one shared indexable-file predicate, scaffold exclusions, a Stop-hook graph health check)"
depends_on: []
feeds: [Part 9 navigation chokepoint, room graph, /mos:ignite, /mos:doctor]
canon_parts: [8, 9, 10]
evidence: ".planning/debug/newborn-room-graph-not-connected-2026-09-30.md"
navigator_ruling: "2026-09-30: 'we need to run graph health checks every couple of turns.' File the Windows-session report so the fix reaches other users."
---

# SEED-101: A newborn room must end up with a connected graph, with no repair pass

**Governing thought:** filing through the governed tools must leave a connected, correct local
graph. In a real session, after 18 `artifact_file` calls and 30 documents, no filed document was
an `Artifact` node. Every claim hung off a generic `jtbd:*` anchor. The MCP graph tool read a
different directory. The graph only worked after the agent called library internals directly,
which a navigator on a hookless surface cannot do. The room is the product (Part 10). A room
whose graph is empty does not deliver it.

## Fix list, in priority order

**P1: data safety and the core promise**
1. **P1-1: `room_graph` targets the boot-time room.** `lib/mcp/tool-router.cjs:1144-1184` passes
   the closure `roomDir` to `indexArtifact`, `rebuildGraph`, `queryGraph` and `graphStats`.
   Resolve `activeRoomDir` the way `room_state` does (`:887`) and return `room_dir` in every
   result. `rebuildGraph` starts with `clearIndexerOwnedRows`, so today it can wipe another
   room's Artifact and Section rows.
2. **P1-2: `graph-index` cannot be called.** It needs a file path in `section`, whose schema
   (`:136`) forbids `/` and `.`. Add a validated `path` parameter, resolved and contained inside
   the room with a realpath check.
3. **P1-3: filing does not index.** `artifact_file` must call `indexArtifact` on the file it
   wrote, write `SOURCED_FROM` from the claim to that `Artifact` node, and set
   `source_section`. Add a PostToolUse hook that indexes any indexable file written inside the
   bound room by Write, Edit or a shell.

**P2: wrong or misleading state**
4. **P2-1:** `graph-derive-queue.json` is enqueued at birth and never drained during the session.
   Drain it in-session, or make STATE show "derivation pending" and the command that runs it.
5. **P2-2:** `scripts/compute-state:143` counts `CONTEXT.md` and `FEYNMAN.md` as entries and misses
   nested meeting files, so a newborn room reads `Investment`. Use one shared predicate
   (`section-registry.cjs::isIndexableArtifactFile`) for both state and indexing.
6. **P2-3:** the reverse-salient engine links scaffold templates to each other. Skip templates.
   `clearIndexerOwnedRows` must also remove edges whose endpoints it deletes; after a rebuild
   today, 3 edges dangle.
7. **P2-4:** the invariant validator flags a missing per-section `MINTO.md` as critical in every
   empty section. Either scaffold the file, or downgrade the check when the section is empty.
8. **P2-5:** Brain egress blocks generic questions that name a framework ("steps of Red Teaming")
   as `freeform_unproven`. It classifies "wicked" as `IllDefined`. Refusals do not name the term
   that tripped them. Theo side: `chain_coverage` matched 1 of 4.

**P3: gaps and friction**
9. **P3-1:** meetings and people have no node type. `meetings`, `team` and `references` are
   `STRUCTURAL_DIRS` and never indexed, so extracted claims cannot point at their meeting or
   speaker. `file-meeting.md` already implies a meeting node.
10. **P3-2:** `skills/ignite/SKILL.md:180` names `CLAUDE_SESSION_ID`. Claude Code sets
    `CLAUDE_CODE_SESSION_ID`. Following the skill literally births a room that the write guard
    blocks. `CLAUDE_PLUGIN_ROOT` and `MINDRIAN_OS_ROOT` are unset in the Bash tool.
11. **P3-3:** `room-registry` has no `rename`.
12. **P3-4:** the room-binding gate fires on pasted content that belongs to the already-bound
    room ("switch or stay?", "new project?").
13. **P3-5:** `whitespace_scan` returned no unsupported claims while 15 of 19 claims had no
    incoming `SUPPORTS` edge. Check the rule in `findUnsupportedClaims`.
14. **P3-6:** the session-start context says "NO EMOJI, NO exceptions", while the Larry agent
    requires a colored-square glyph on every turn. Pick one; Part 12 says the glyph wins.

## Graph checks on a cadence (navigator request): extend Phase 343, do not add a second home

The navigator asked for graph health checks "every couple of turns". Phase 343 already shipped
the organ for this. Its statements live in one place,
`lib/core/navigation/graph-integrity-counts.cjs`. The doctor module is
`lib/core/doctor/room-graph-integrity-module.cjs` (`/mos:doctor room-graph-integrity`). The
sensor is SENS-19, `sensor-graph-integrity.cjs`, and its watcher is declared in
`sensor-priority.cjs`. The field session could not see it and wrote its own
`.mindrian/graph-health.cjs`. A third script would break ICM invariant 8 (one home per fact).
**Extend the 343 organ instead.**

The field checks, mapped against the organ:

| Field check | 343 today | Action |
|---|---|---|
| Edge points at a missing node | statement: edge rows missing an endpoint | none; already covered |
| Filed claim has `SOURCED_FROM` to an `Artifact` | the no-anchor statement accepts **any** `SOURCED_FROM`/`DERIVED_FROM` out-edge | **tighten or add a statement:** claims whose only provenance edge targets a non-Artifact anchor (`jtbd:*`). This is why 343 could not see P1-3: every field claim was "anchored" to a jtbd node. |
| Indexable file on disk has an `Artifact` node | not measured | **new statement.** It is the ICM invariant 9 measurement: the filesystem is the state machine, and `room.db` is its generated index. Use the shared `isIndexableArtifactFile` predicate from item 5. |
| `Artifact` node has its file | not measured | **new statement** (the reverse of the above) |
| Hypothesis has at least one `SUPPORTS` | not measured | **new statement** |
| Isolated content node, excluding `BELONGS_TO` and `jtbd:*` | not measured | **new statement** |
| Counts by type, drift between runs | not measured | informational count, as the organ already reports for `CONTRADICTS` and self-edges |

Constraints the extension inherits from 343. They are not optional:
- **Counts only.** SEED-074's hard guard applies: no "healthy", "broken", "dangling" or
  pass/fail wording in the output, and no health claim in either direction. The field
  prototype's pass/fail table does not ship as-is.
- A column a legacy schema cannot answer reports `null`, never `0`.
- Every new statement gets its own `watched_by` counter-metric entry (the Phase 343 counter-metric rule).

**Cadence.** Today the organ runs when `/mos:doctor` is called and when SENS-19 fires. Add a
Stop-hook trigger that runs after any write to the bound room and every N turns. It runs the
same organ read-only and raises a finding only when a count rises from the previous run. On
Desktop and Cowork there are no hooks, so the trigger becomes part of Larry's
`stop_gate_check` duty.

Field prototype for reference only: `.mindrian/graph-health.cjs` in the client room. Port the
query ideas into the organ; do not copy room content.

## Acceptance

- [ ] `room_graph` in a session bound to room B never reads or writes room A. Every result carries `room_dir`. A regression test binds two rooms and calls `graph-rebuild`.
- [ ] `graph-index` accepts a room-relative path and refuses paths outside the room.
- [ ] Reproduction steps 1-5 of the evidence report: after 3 `artifact_file` calls, 3 content `Artifact` nodes exist and each claim has `SOURCED_FROM` to its artifact plus a `source_section`.
- [ ] A file written by the Write tool inside the room is indexed without a manual call.
- [ ] A newborn room's STATE reads empty and `Pre-Opportunity`. Nested meeting files count.
- [ ] No `REVERSE_SALIENT` edge touches a scaffold template. A rebuild leaves zero dangling edges.
- [ ] The 343 organ reports 0 for the new statements on a freshly born room after filing, and 1 for a seeded unindexed file. No new health script exists outside `graph-integrity-counts.cjs`.
- [ ] A claim whose only provenance edge targets `jtbd:*` is counted by the tightened statement.
- [ ] `skills/ignite` uses `CLAUDE_CODE_SESSION_ID`; a birth run from the skill text is not write-blocked.

## ICM and layer-contract reading

Source: `docs/2026-09-14-LAYER-CONTRACT-AND-ICM-MAP.md` (the icm-architect reference form).
The icm-architect skill itself was not loadable in the planting session.
- **Root cause is an invariant 9 breach.** The filesystem is the state machine; generated
  indexes are rebuilt by script. `room.db` is the generated index of the room's files. Filing
  that does not index leaves the index out of step with the state machine. P1-3 and P2-1 are
  this one defect.
- **Invariant 8 (one home per fact):** `compute-state` and `section-registry` define "an entry"
  differently (P2-2). Health checks were about to get a third home (see above).
- **Invariant 1 / harness layer:** P1-1 is a room-identity leak. The tool must take the room
  from the session binding, which is the single authority, not from the boot closure.
- **Prompt layer (2.1):** P3-6 is the known gap "persona text lives in five places with no
  single source". Fixing the emoji rule once does not close it.

## Corpus grounding (langtalks-graph-expert, citations only)

- knowledge graph + ingestion: one shared source, Memgraph, "From Data to Knowledge Graphs:
  Building Self Improving AI Memory Systems" (2025-09-30). The grounding for index-on-write is
  thin; consult the corpus again before designing the PostToolUse indexer.
- The Phase 343 origin, 168 edges pointing at missing nodes in the langtalks graph itself, is
  the same class of defect as P2-3.

## Open questions

- Which directory did the misdirected rebuild touch? No other `room.db` changed in the session. Confirm the boot-time `roomDir` on a hookless or no-room start.
- Should the health check run as a hook on every surface, or as a Larry turn-end duty where hooks don't exist (Desktop/Cowork)?
