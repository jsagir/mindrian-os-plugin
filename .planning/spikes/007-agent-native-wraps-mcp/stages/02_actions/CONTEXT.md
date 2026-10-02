# Stage 02: the three actions and the gate view

Last updated: 2026-10-02

## Inputs
| Source | File/Location | Scope | Why |
| :--- | :--- | :--- | :--- |
| MindrianOS MCP server (Layer 4) | `http://127.0.0.1:3847/mcp`, per-connection mode | room_state, graph_query, research_run, gate_render, gate_answer | the only path to the room |
| Design Canon v3 (Layer 3) | mindrian-website `docs/DESIGN-CANON.md` | tokens, CTA contract, motion | the only styling law |

## Process
1. `overlay/server/lib/mos-mcp.ts`: one MCP client per UI session key; reconnect once if the server restarted.
2. `overlay/actions/`: `room-state`, `graph-query` (GET), `decision-gate` (POST: mint grant or render, answer).
3. `overlay/app/routes/gate.tsx` + `overlay/app/root.tsx`: one decision per view, full-bleed.
4. Probes: `burn-probe.cjs` (cross-session answer), `overlay/scripts/an-mcp-client-probe.ts` + `discover-shim.cjs` (agent-native as MCP client).

## Outputs
| Artifact | Location | Format |
| :--- | :--- | :--- |
| Probe records | `burn-probe.out.json`, `an-mcp-client-probe.*` | JSON / text |
