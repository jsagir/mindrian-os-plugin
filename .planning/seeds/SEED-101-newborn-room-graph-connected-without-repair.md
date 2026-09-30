---
id: SEED-101
status: dormant
priority: critical
planted: 2026-09-30
updated: 2026-09-30
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

## Graph health check on a cadence (navigator request)

Ship the field-proven read-only check as `scripts/graph-health.cjs`. Run it from the Stop hook
after any write to the bound room and every N turns, and have it fail loudly. Expose it as
`/mos:doctor --graph`. The checks:
1. Every indexable content file has an `Artifact` node.
2. No `Artifact` node is missing its file.
3. Every filed claim has a `SOURCED_FROM` edge to an `Artifact` node.
4. No edge points at a missing node.
5. No content node is isolated, not counting `BELONGS_TO` and `jtbd:*` anchors.
6. Every hypothesis has at least one `SUPPORTS` edge.
7. Node and edge counts by type, compared with the previous run to show drift.

The field prototype caught an unindexed file on its first run. Source: `.mindrian/graph-health.cjs`
in the client room from the session. Port it; do not copy room content.

## Acceptance

- [ ] `room_graph` in a session bound to room B never reads or writes room A. Every result carries `room_dir`. A regression test binds two rooms and calls `graph-rebuild`.
- [ ] `graph-index` accepts a room-relative path and refuses paths outside the room.
- [ ] Reproduction steps 1-5 of the evidence report: after 3 `artifact_file` calls, 3 content `Artifact` nodes exist and each claim has `SOURCED_FROM` to its artifact plus a `source_section`.
- [ ] A file written by the Write tool inside the room is indexed without a manual call.
- [ ] A newborn room's STATE reads empty and `Pre-Opportunity`. Nested meeting files count.
- [ ] No `REVERSE_SALIENT` edge touches a scaffold template. A rebuild leaves zero dangling edges.
- [ ] `graph-health` passes on a freshly born room and fails on a seeded unindexed file.
- [ ] `skills/ignite` uses `CLAUDE_CODE_SESSION_ID`; a birth run from the skill text is not write-blocked.

## Open questions

- Which directory did the misdirected rebuild touch? No other `room.db` changed in the session. Confirm the boot-time `roomDir` on a hookless or no-room start.
- Should the health check run as a hook on every surface, or as a Larry turn-end duty where hooks don't exist (Desktop/Cowork)?
