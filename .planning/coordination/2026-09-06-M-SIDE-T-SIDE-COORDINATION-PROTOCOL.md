---
status: active
kind: coordination-protocol
scope: cross-repo
sides: [MindrianOS-Plugin, Theo]
mirrors: "T-side session copy, sent 2026-09-06"
canon_parts: [8]
created: 2026-09-06T07:44:24Z
updated: 2026-09-06T07:44:24Z
---

# M-side / T-side Coordination Protocol

**M-side** = `~/dev/MindrianOS-Plugin` -- Larry's persona/doctrine, plugin release pipeline, `command-registry.json`/`recipe-maps.cjs`, room graph.
**T-side** = `~/Theo` -- the graph, ingestion pipeline, Theo's own tool catalog (content + operational).

## Boundary -- no overlap, no exceptions
Each side owns its own repo's files, schema, and GSD process. Neither side edits the other's files, ever -- not even a "obviously correct" one-line doc fix. Propose it across the boundary; the owning repo's own GSD process lands it.

**Grey zone, explicitly assigned:** shipping a release, flipping a default, suspending/decommissioning a service -- all HUMAN-HELD, on both sides, regardless of how ready a plan looks or which repo's checkpoint fires it.

## Two channels, neither sufficient alone
1. **Durable (source of truth):** a dated, evidenced entry in a shared file, git-committed, citing exact paths/lines/live-measured numbers with timestamps -- the discipline SEED-004 and 09-FLIP-RECORD.md already model. Every real finding or ask goes here first.
2. **Live (nudge only):** a cross-session ping saying "there's something in the durable file for you." First line self-contained -- it's the only part previewed. Never the only record of anything.

## T-side triggers M-side when:
- A Theo phase's checkpoint:human-action names a MindrianOS-Plugin action (a release, a flip).
- T-side needs the current command-registry.json/recipe-maps.cjs for a MindrianCommand sync payload -- ask for the exact shape needed, not "everything."
- A doctrine question's answer might live in MindrianOS-Plugin (persona rules, reach doctrine) -- ask before assuming it doesn't exist.
- T-side finds a live gap or collision touching the plugin (tool-name collision, a doctrine-named tool with no Theo equivalent) -- report it, don't patch it from that side.
- T-side needs a plugin-side number (installed version, live tool count) re-confirmed rather than assumed stale-safe.

## M-side triggers T-side when:
- A persona/room feature needs a Theo content tool that doesn't exist -- spec the exact contract, don't make T-side guess intent.
- A cutover-scoping decision needs a live coverage/parity re-measurement -- never reuse a stale snapshot across the boundary.
- A plugin release is about to touch command-registry.json/recipe-maps.cjs -- that's T-side's own sync trigger, per its CLAUDE.md.

## Never, either side:
- Ship/flip/suspend without the human navigator's explicit go.
- Assume the other side's state from memory -- re-measure live, cite the call and timestamp.
- Let a live ping substitute for the durable file entry.
- Cross-edit the other repo's files.

## Addressing (ephemeral, not permanent)
Session identity is ephemeral -- resolve the live address via ListAgents at send-time. As of 2026-09-06: M-side session answered to `jsagi-9d`, T-side session answered to `Brain–Theo graph reconciliation execution`. Do not hardcode either past this date.
