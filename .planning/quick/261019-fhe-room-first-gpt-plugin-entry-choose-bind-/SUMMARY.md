---
task: 261019-fhe
status: complete
date: 2026-10-19
---
# Room-first GPT plugin entry

The existing room_list tool now opens an MCP Apps room picker. A user explicitly
selects a local room; the UI calls existing room_bind, verifies that the binding
is effective and survives later calls, loads context_assemble, reads room-dashboard,
and requests continuation in chat with that room's saved understanding.

Fixed an existing targeting gap: all three embedded room views previously used
the server boot room when no room_path was supplied. They now use the ONE shared
per-session resolver. Explicit contained-path views still work and are labelled
as views rather than a binding change. Existing room_bind briefing text remains;
its structuredContent now carries the authoritative binding object for app clients.

No new executor, room resolver, memory store, room-creation operation or Theo
egress was introduced. Empty lists, ineffective binds and missing memory are
explicit. No room is selected or bound by merely rendering the list.

## Verification
- Actual MCP client: room_list advertises a readable component; two synthetic
  rooms; choose the non-boot room; all three views show only its content.
- context_assemble includes a durable approved decision in the selected room.
  A new server/client session rebinds and recovers the same decision.
- Actual MCP Apps SDK in a sandboxed browser: no implicit bind; explicit click
  order room_bind -> context_assemble -> room-dashboard; host receives context
  and a continuation request; ineffective bind stops reads; missing memory is
  reported honestly; empty-list and narrow-screen behavior pass.
- Existing protocol: 18 pass. Existing app path/input tests: 22 pass.
- Source references and entry guide: docs/GPT-PLUGIN-UI.md.

## Delivery
Local source only. No marketplace release, tunnel, account plugin update, or
live ChatGPT acceptance is claimed. The host's layout controls embedded placement;
this task does not claim a persistent side panel. Room creation is separate.
