---
phase: 371
status: complete
created: 2026-10-19
canon_parts: [3, 7, 8, 9, 11, 12]
---
# Startup phase research

## Existing foundation and provenance

f6bf6cb92/c53beea37 added host-neutral MCP decision UI and command/Theo proposal
controls; ecde228dc added room-first binding and context; ec3d56380 added room
creation and workday memory. b0e4a43de registered this focused phase and its
approved v5 UI contract. These are prerequisite work, not retroactively executed
phase plans. Keep their real MCP tests as baseline evidence.

## Findings

- rooms.html contains the complete startup state machine. App tools use the
  shared app-identity.js bridge and existing server gate/session authorities.
- app-views.loadTemplate injects a legacy global design stylesheet AFTER the
  template styles. Restyling only the HTML would be overridden. Give rooms.html
  a scoped asset/style branch; retain the legacy sheet on decision.html.
- The bridge already auto-resizes through the installed Apps SDK. callTool waits
  up to 60s; refresh hides connection errors in the header. Recovery must retain
  a pending gate payload and avoid new creation previews while outcome is unknown.
- SDK spec.types.d.ts says resourceDomains maps to font-src as well as other
  resource directives. Embed local font bytes in the resource and request data:
  for these assets; verify under a representative CSP, with readable fallback.
  Real ChatGPT host policy acceptance remains a separately measured item.
- Figtree and DM Sans Latin woff2 files already exist in the website repository.
  Package copies and OFL notices inside lib/mcp/assets; root package includes lib.
  No new npm dependency, root framework, service or font network call is needed.
- UI uncertainty: current creation catch hides safe retry, startup choices do not
  retain free text across unknown answers, and old room content can stay visible
  while a rebind fails. Preserve exact gate payloads and clear old content early.
- Dates currently use toLocaleString without timezone/machine-readable markup.
  Format with an explicit zone label and time datetime attributes.
- Direct room_startup can render a briefing without context_assemble in that
  widget. Report its memory limitation instead of implying successful recall.

## Stack and patterns

Use native HTML/CSS/JS; existing loadTemplate resource and MindrianView bridge.
Use textContent, exact normalized option IDs and gate_answer. Never add an
execution loop, claim promotion, memory engine, new F-shape or automatic Theo.
The new UI is governed by Design Canon v5, not the legacy injected CSS.

## Validation architecture

Retain actual ChatGPT-identified MCP client lifecycle tests. Add sandboxed SDK
browser tests for CSP/local fonts, widths, keyboard/focus, zoom, forced colors,
reduced motion, stale-room isolation, missing records and exact-payload retry.
Use fake host transport failures only for failure injection; use actual server
snapshots for the normal journeys. Distinguish local browser evidence, a visual
audit, and real host acceptance. No marketplace or live-account write in scope.
