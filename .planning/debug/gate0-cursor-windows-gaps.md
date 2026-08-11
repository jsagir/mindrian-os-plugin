---
status: gathering
kind: qa-sweep
trigger: "gate0-cursor-windows-gaps"
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [3, 11]
created: 2026-08-11T06:30:00Z
updated: 2026-08-11T06:30:00Z
---

## Source-of-Truth Preamble

- CODE claims read against: origin/main HEAD @ 19552e87 (beta.6 working tree; beta.5 released)
- WIRE claims probe against: Cursor (Windows 11) MCP client -> WSL-bridged
  mindrian-mcp-server.cjs from the beta.5 cache, live 2026-08-11
- Date of audit: 2026-08-11 (navigator's Gate 0 report, docs/gate0-2026-08-11-cursor-windows-report.md)
- Re-verification rule: each finding needs a source re-verify before fixing.

## Findings (classified, routed per the 234-08 checkpoint's routing rule)

1. **chain_run gate_render timeout (MCP -32001) on Cursor** - NEW FAILURE, severity HIGH.
   The 4-step chain (diagnose -> find-bottlenecks -> systems-thinking -> whitespace) died
   at the gate render. Hypothesis: the 3-rung renderer ladder's elicitation rung blocks
   awaiting a client capability Cursor does not provide, until the client's request
   timeout fires - the ladder should detect-and-degrade to headless structured text
   FAST on non-elicitation hosts. Route: the gate-render ladder owner (Phase 198/gate-render.cjs
   lineage). Needs its own /gsd-debug session.

2. **room_bind returns no_session_id on the Cursor client path** - KNOWN-ADJACENT, severity
   MEDIUM. This is CTX-03's named real-host deferral, now OBSERVED failing: the session-id
   plumbing the CLI shim provides is absent on this client path. Route: CTX-03 owner
   (248/MCP-First room resolution). Evidence: { ok:false, reason:"no_session_id" }.

3. **Duplicate MCP registration (marketplace plugin + user mcp.json) = 4 servers, 2x tools**
   - ENV GAP + docs gap, severity MEDIUM. Agent may address either instance; wasted
   context; confusing panel. Route: 234-05 (tool visibility) for a dedup/detection story +
   install docs (pick ONE source, document it).

Cross-cutting docs actions (website install docs): Node >= 22.5 floor stated prominently
(v20 fails node:sqlite; matches the repo's own 22.16 floor rationale); never native
Windows Node with Linux paths (WSL bridge or native-path install); Render cold-wake
latency note; Node-installer "automatically install tools" uncheck tip.

## Not defects

- Instruction-surface tool returns on foreign hosts ("NOT EXECUTED - follow Reference
  steps") - by design (Cursor executes, tools instruct); needs DOCS, not code.
- One pre-restart tier_0_brain_unreachable - config-load timing; deployed Brain was
  simultaneously green from WSL.
