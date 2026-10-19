---
task: 261019-ey0
status: executing
canon_parts: [3, 7, 8, 9, 11]
---
# GPT plugin with built-in F-shape UI

User intent: first make the existing MindrianOS plugin usable through GPT harnesses,
with a built-in UI that proposes Theo work and commands and drives governed decisions.
Do not implement mos-platform or replace the shared execution/room machinery.

## Tasks
1. Reuse the existing MCP Apps bridge for a built-in gate component. Associate
   gate_render, chain_run and gate_answer with it. Return the server-normalized
   card as structured data. All answers use the existing gate_answer handler;
   no second gate ledger, executor, claim promotion path, or network egress.
2. Add dashboard controls for requesting grounded next commands and generic Theo
   guidance through the host. Make MCP identity and instructions model-neutral.
   Recognize explicit GPT host names for presentation and existing governed write
   defaults; do not infer hooks or tool availability from a model/provider name.
3. Verify actual server registration, tool outputs, host capability behavior,
   browser interactions and failures. Document setup and the measured limits.

## Acceptance
- Gate widget loads through an MCP UI resource; describes options and previews,
  supports single/multiple selection, and requires an explicit submit.
- Chain approval calls gate_answer once and displays its actual result/next gate.
- Refused/stale/failed answers remain visible; no optimistic success or auto-run.
- Room UI requests Theo using generic terms only; private room text is not
  placed in a Theo request. Host messages are requests, not execution receipts.
- Existing Claude behavior and gate validations retain regression coverage.
- UI declarations, CSP and fallback data are usable in compatible MCP Apps hosts.

## Sources
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/chatgpt-ui
- Existing gate-render, gate ledger, chain and MCP Apps modules.

## Verification limits
Live ChatGPT installation and hosted/tunnel connection require a host connection
not presently verified. Local server and browser tests must be reported separately.
