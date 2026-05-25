---
id: SEED-001
status: dormant
planted: 2026-05-03
planted_during: v1.11.0 -- Phase 106 (statusline-visibility-context-window-broadcast)
trigger_when: room-proactive expands (next milestone touching the room-proactive skill, multi-room registry, or local-graph layer)
scope: medium
bundle: nested-room-correctness
related_phases: [112]
related_seeds: [SEED-004]
companion_artifacts: []
---

# SEED-001: MindrianOS proactively suggests opening sub-rooms and nested rooms based on context, with mandatory wikilink + local SQLite graph wiring on creation

## Why This Matters

**Wiring is the value.** Suggesting a sub-room is hollow unless the wikilink and SQLite graph wiring land atomically with creation. Otherwise:

- Orphan folders accumulate under MindrianRooms/ that the proactive layer can't traverse next session.
- Parent rooms lose their navigability — the user knows there's a child, the system doesn't.
- The local graph (SQLite at `room/.room-graph/`, NOT Kuzu — that was migrated) ends up out of sync with disk reality, breaking nl-graph queries, cross-room aggregation, and the dashboard's hyperlinked traversal.
- Tester case studies and per-vertical sub-rooms (e.g. align-x-milken under align-ecosystem, or per-scientist case studies under beta-testing) become disconnected silos.

The point of *proactive* is anticipation. The point of *nested* is structure. Anticipation without structure is noise; structure without wiring is a lie.

## When to Surface

**Trigger:** When room-proactive expands.

This seed should be presented during `/gsd:new-milestone` when the milestone scope matches any of these conditions:

- A phase touches `skills/room-proactive/` or `skills/room-passive/` SKILL.md
- A phase touches the multi-room registry (`scripts/room-registry`, `.rooms/registry.json`, `lib/core/room-ops*.cjs`)
- A phase touches the local SQLite graph layer (`lib/core/room-db.cjs`, `lib/core/graph-ops.cjs`, `lib/core/lazygraph-ops.cjs`, `scripts/build-graph-from-sqlite.cjs`)
- A phase touches wikilink generation/scanning (`lib/vault/wikilink-builder.cjs`, `lib/vault/room-scanner.cjs`)
- A milestone-level theme is "navigation," "proactive intelligence," "knowledge graph traversal," or "multi-room UX"
- The user explicitly mentions sub-rooms, nested rooms, parent-child rooms, room hierarchy, or room nesting

## Scope Estimate

**Medium** — A phase or two. Concretely:

1. **Detection phase** — extend `room-proactive` to identify sub-room candidates from room state (unfiled clusters, cross-section convergence ≥ N, domain branching in entries, explicit user mentions). Emit candidate via the Intelligence Strip (UI Ruling System zone 3).
2. **Creation contract phase** — build `/mos:room create-nested <slug> --under <parent>` (or extend `/mos:rooms`) with a verification gate that refuses to return success unless ALL FIVE wiring side-effects landed. Add idempotency for re-runs.

## Acceptance Contract — Non-Negotiable Side-Effects on Creation

A `create-nested` command MUST fail closed (non-zero exit, no partial state) unless every one of these wrote successfully:

1. **Parent STATE.md** gets a `[[<sub-slug>]]` entry under a `## Sub-rooms` section (created if missing).
2. **Sub-room STATE.md** gets `parent: [[<parent-slug>]]` in frontmatter and a `## Parent Room` link section in body.
3. **SQLite local graph** (`room/.room-graph/graph.sqlite` on the parent OR a designated nest-db): `INSERT room` node for the sub-room + `INSERT edge (parent → child, type=contains, depth=N)`.
4. **Registry** (`.rooms/registry.json`): new entry with `parent: <parent-slug>`, `depth: N`, `path: <relative-path>`, plus parent's entry updated with `children: [..., <new-slug>]`.
5. **Wikilink resolver cache invalidation** — `lib/vault/wikilink-builder.cjs` cache for the parent room must invalidate so the next render picks up the new link.

Verification gate runs all 5 checks post-write. Re-running the command on an existing sub-room is idempotent: detects existing wiring, no-ops cleanly, exits 0.

## Breadcrumbs

Code touched on detection + suggestion side:
- `skills/room-proactive/SKILL.md` — existing proactive layer to extend
- `skills/room-passive/SKILL.md` — context awareness, useful signal source
- `lib/core/cross-room-aggregator.cjs` — cross-room signals that feed candidate detection
- `lib/core/room-type-detector.cjs` — likely helpful for distinguishing "this is a sub-room" vs "new top-level"

Code touched on creation + wiring side:
- `commands/room.md`, `commands/rooms.md` — current room commands (create-nested goes here)
- `scripts/room-registry` — registry CLI
- `scripts/resolve-room` — slug resolution (must handle parent/<child> paths)
- `scripts/migrate-rooms` — migration patterns to mirror
- `lib/core/room-ops.cjs`, `room-ops-shared.cjs`, `room-ops-async.cjs`, `room-ops-sync.cjs` — core room ops
- `lib/core/room-db.cjs` — SQLite room db (graph node/edge inserts go here)
- `lib/core/graph-ops.cjs`, `lib/core/lazygraph-ops.cjs` — graph operations
- `scripts/build-graph-from-sqlite.cjs` — graph rebuild pipeline (must handle nested rooms)
- `scripts/sync-rooms-graph` — keeps graph in sync, must not lose nesting on resync
- `lib/vault/wikilink-builder.cjs` — wikilink construction
- `lib/vault/room-scanner.cjs` — scans for wikilink anchor points

UI surface:
- UI Ruling System zone 3 (Intelligence Strip) — where suggestion emits
- `commands/dashboard.md` and `dashboard/index.html` — must render parent-child edges in the Cytoscape graph

Related artifacts:
- `.rooms/registry.json` — current flat registry (needs parent/children fields added)
- `.planning/STATE.md`, `.planning/ROADMAP.md` — current state references room-proactive but no nesting

Related memories (from `~/.claude/projects/-home-jsagi/memory/`):
- `feedback_local_graph_sqlite.md` — HARD RULE: local graph is SQLite, not Kuzu
- `feedback_align_room_means_ecosystem.md` — example of parent-child confusion (align-x-milken under align-ecosystem)
- `project_mos_multi_room.md` — multi-room management vision (this seed extends it)
- `feedback_room_dashboard_structure.md` — Mondrian + intelligence + graph-with-hyperlinks rule

## Notes

- Decision: SQLite, not Kuzu. Per `feedback_local_graph_sqlite.md` migration is done; any new wiring goes through `lib/core/room-db.cjs` / `graph-ops.cjs`.
- Decision: Brain stays Neo4j (separate concern); this seed only governs the *local* per-room graph. Sub-room creation does NOT need to write to Brain in v1 — that can be a follow-up if/when Brain gets a hierarchy schema.
- Open question for planning time: where does the SQLite db for nested rooms live — under the parent's `.room-graph/`, the sub's `.room-graph/`, or a registry-level shared db? Phase planning should answer before build.
- Open question: depth limits. Should the system cap nesting at depth 3 (parent → child → grandchild) for v1 to keep the dashboard renderable?
- Tester onboarding angle (per the "knowledge depth" framing): once this lands, beta-testing case studies (e.g. prof-dahbura-cybersecurity, scientists/ subtree) become first-class nested rooms instead of folder conventions.
