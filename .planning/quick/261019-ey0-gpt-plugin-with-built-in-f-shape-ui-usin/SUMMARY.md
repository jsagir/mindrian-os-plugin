---
task: 261019-ey0
status: complete
date: 2026-10-19
---
# GPT plugin with built-in F-shape UI

Implemented locally in the owning MindrianOS plugin repository. Existing room
and command mechanisms remain authoritative. The component is associated with
gate_render, chain_run and gate_answer; it submits the existing gate_answer call
and renders the actual result or next halted decision. Dashboard controls request
grounded commands and generic Theo guidance through the host conversation.
No source changes were made to mos-platform.

## Verification
- Actual MCP server advertises the component and returns normalized cards and CSP.
- Real ChatGPT-identified MCP client binds a synthetic room, rejects an invalid
  choice, records approval, and retrieves a durable replay receipt.
- Sandboxed browser with real MCP Apps SDK: single/multiple choice, explicit
  confirm, double-submit lock, failed-write retry, next ordered gate, reject,
  replay, stale refusal, command/Theo requests and narrow layout pass.
- Existing Apps browser suite: 11 checks pass, including early notifications,
  refresh, cancellation, disconnect, blocked SDK and recovery.
- Protocol/instructions: 18 pass; host capability ruling: 201 pass;
  ledger consumption: 30 pass; app input/path containment: 22 pass.
- Connector registry and orchestration projection checks: OK.
- Render coverage: 17 covered, 0 gap; command keyspace 196 wired, 2 excluded,
  0 unwired. git diff --check passes.

## Existing test limitation
WORKING: the functional legs of test-237-approve-executes pass.
KNOWN BASELINE TEST DRIFT: its mutation leg fails to find DISPATCHER_CALL_NEEDLE.
The HEAD version of chain.cjs already includes runId in makeChainStepDispatcher;
the test needle omits it. This change neither adds runId nor changes the call.
The old matcher is not silently changed or reported green.

## Delivery limits
No marketplace/npm release, public hosting, tunnel, account plugin change or live
ChatGPT installation was performed. No live Theo result is claimed. Test-client
and sandboxed-browser evidence is separate from a real ChatGPT host acceptance.
Standard MCP Apps clicks retain the existing mcp_relayed attribution; this does
not add the standalone shell's browser_nonce proof. Full specialized F-shape
producer coverage is not claimed; the UI renders the existing canonical superset
and the executor controls ordered decisions.

Setup and behavior: docs/GPT-PLUGIN-UI.md.
