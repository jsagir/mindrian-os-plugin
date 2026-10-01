---
id: SEED-105
status: dormant
priority: high
planted: 2026-10-02
planted_during: Phase 366 (executing)
trigger_when: when the localhost workspace (260920-bhx) moves from review to implementation, OR when a decision gate needs a real click-through UI on any surface (the SEED-104 elicitation pain), OR at the next milestone that scopes a visual Data Room
scope: spike small (separate repo, 3 actions, SSE); full build large
related: 260920-bhx (localhost workspace review, implementation unbuilt), SEED-091 (Workroom auth/tenant), SEED-036 (website commands from registry), SEED-104 (grant card), SEED-106 (Theo relationship), Phase 198 (MCP-first)
---

# SEED-105: The MindrianOS UI is an agent-native app that wraps the MCP tools, never a second store

## The idea

BuilderIO `agent-native` (TypeScript/React, about 7,000 stars, active 2026-10) defines each capability
once as a zod-schema **action**: the agent calls it as a tool, the UI calls it from code, and it is also
exposed over HTTP, MCP, A2A and CLI. MindrianOS already defines its MCP tools with zod schemas, so
every tool maps one-to-one onto an action. A MindrianOS UI can be an agent-native app whose actions are
thin wrappers over the existing MindrianOS MCP server (Streamable HTTP, already served).

What it unlocks:
- **Decision gates become real buttons with a preselected recommendation.** This kills the class of bug
  in SEED-104 (an elicitation dialog that opens on "not set" and loops).
- **Shared application state maps onto `context_assemble focus_node_id`:** select a node in the UI, and
  Larry's context centers on it.
- The localhost workspace design already reviewed in 260920-bhx (task-centered workspace, local
  Claude adapter, room/session ownership, governed persistence) gets an implementation substrate.

## Non-negotiable constraints (canon)

1. **No second store for room state.** The room graph is SQLite per room, the filesystem is the source
   of truth, and writes go only through `navigation.cjs`. agent-native's Postgres/PGlite may hold UI
   session data at most; every room read or write is an MCP tool call.
2. **The plugin stays CJS-only.** The UI is a separate repo/app that talks to the MCP server; no
   TypeScript enters the plugin.
3. **The in-app agent is not Larry-with-hooks.** Gates, the Part 8 egress guard and card enforcement must
   hold server-side (Phase 198 MCP-first). Every Brain/Theo call goes through the guarded shim.
4. **Hooked model** is the mandatory lens for the first screen.
5. Tri-Polar: the app is a fourth surface on top of CLI/Desktop/Cowork, not a replacement.

## Realtime

Start with the existing server-sent events bus (`status_read` publishes `status-segment`): one-way server
push covers "the room changed, refresh". Use WebSockets (fullstack-dev-skills:websocket-engineer as
design guidance) only for Cowork-style multi-user concurrent editing.

## Spike definition

Separate repo, agent-native template, three actions wrapping `room_state`, `graph_query` and
`gate_render` / `gate_answer`, De Stijl tokens, SSE refresh. **Pass:** the navigator approves a research
grant with one click and the room view updates without a reload. **Kill:** the action layer cannot reach
the MCP server without duplicating room state, or the license blocks commercial use.

## Open checks

- License: the root `package.json` says ISC; no root LICENSE file was found (2026-10-02). Verify before
  any dependency.
- Whether agent-native consumes an external MCP server as tools, or only exposes MCP (an `mcp-registry`
  directory exists; unread).
- Its realtime transport (repo search shows websocket, SSE and polling code; unread).

## Breadcrumbs

- `.planning/quick/260920-bhx-localhost-review/`, `docs/reviews/2026-09-20-localhost-workspace-review.md`
- `lib/mcp/tools/*.cjs` (zod tool schemas), `lib/mcp/tools/gate*.cjs` (gate ladder; elicitation rung)
- MCP inline views: `room-dashboard`, `room-graph`, `room-wiki`
- Pattern sibling: Cloudflare Forge (one description, every surface generated), see SEED-106 insight 7

## Enrichment 2026-10-02: the read-copy layer (RxDB) and the one-way sync rule

**Stack, one job per layer:**
- **agent-native**: actions only. The MCP tools, exposed as UI calls and agent tools. This is the
  only write path.
- **RxDB in the browser**: a cached, offline-capable copy of the room for instant views. Free IndexedDB
  storage. It replaces agent-native's own Postgres data layer for room views; never run both.
- **`room.db` + `navigation.cjs`**: the only truth.

**Rule: sync flows one way, from the room to the browser. Writes go only through the MCP actions.**
- Implement RxDB's replication protocol on the room server: a `pullHandler` answering "changes since
  checkpoint {last_modified_at, id}" read through `navigation.cjs` (nodes already carry
  `last_modified_at`, the CAS token `graph_write` uses); superseded claims map to RxDB's soft-delete
  flag (they are closed, never deleted, Canon Part 9). A `pullStream` emits on the existing SSE bus,
  with `RESYNC` on reconnect.
- **No `pushHandler` for room data.** A browser can never push a confirmed claim; truth claims pass gates
  and human approval as today. RxDB's default conflict rule (the master copy wins) matches: the room is
  always the master.
- Cowork (several users on one room) is the only case where a WebSocket stream is worth adding.
- Part 8: replication stays on the machine or the team's server; it never reaches the Brain.

**Do not use RxDB as the room store** (measured 2026-10-02 from rxdb.info): it stores documents as JSON
in its own table layout and cannot read an existing SQLite schema; production SQLite storage is a paid
Premium plugin; the free trial caps at 500 non-deleted documents, uses no indexes and runs queries in
memory. Its Node SQLite driver list includes `node:sqlite` (Node 22+), which matters only if that ever
changes.

**Mockup:** https://claude.ai/artifact/XDbDX2i2jC8CUxGWmNQdEt (De Stijl room workspace: next move, the
one-click gate, prior-art lanes, Larry panel; plus room-graph and Cowork two-user views).

## Navigator rule 2026-10-02 (binding for every UI task on this route)

- Stack, always together: `/icm-workspace-architect` (structure), `/fullstack-dev-skills:websocket-engineer`
  (realtime), RxDB (browser read copy, one-way), agent-native (shell; actions = MCP tools).
- Styling and design: ONLY the M:OS **Design Canon v3: Workshop Modernism** from mindrian-website
  (`~/dev/mindrian-website/docs/DESIGN-CANON.md`, D-29; source spec
  `docs/superpowers/specs/2026-10-01-design-canon-v3-workshop-modernism.md`): paper/ink palette, rust,
  cobalt and ochre as meaning only, Fraunces / DM Sans / Bodoni Moda, radius 0, one decision per view.
  The 2026-10-02 quick mockup's ad-hoc primary palette is superseded and gets restyled when touched.

## Pre-step (navigator, 2026-10-02)

Before any UI/UX work on SEED-104..107: read and discuss
`.planning/research/2026-10-02-UI-UX-PRIOR-ART-INVENTORY.md` (every prior UI/UX seed, phase, command,
doc and memory entry). Discussion first; no design, spike or plan skips this step.
