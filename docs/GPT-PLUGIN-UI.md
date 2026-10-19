# MindrianOS in GPT harnesses

This development change adds an interactive MCP Apps decision component to the
existing MindrianOS plugin. It reuses the current room binding, gate ledger,
chain resolver, chain executor, and guarded Theo connection. mos-platform is
not a dependency and no room data is migrated.

## Use

Connect the existing MindrianOS MCP server and, for Theo, its guarded
mindrian-brain MCP shim. Both are defined in the plugin's existing .mcp.json.
Use the supported Node version declared by package.json. Do not point a client
directly at raw Theo with private room material.

On first activation ask the host to call room_list. In a compatible MCP Apps
host it opens the built-in room picker. Choose an existing local room and select
Open selected room. The component calls room_bind without an invented sessionId,
checks effective/carries_to_later_calls, calls context_assemble for the saved room
briefing, and opens the selected room through room-dashboard. It contributes the
bounded memory snapshot to model context and asks the host to continue in that room.
Nothing binds merely because the list was displayed. No room is silently selected.

The dashboard, wiki and graph use the current session binding when room_path is
omitted. Explicit contained-path views are still allowed and labelled as views,
not as changing the binding. Missing memory is reported as unavailable; the UI
does not invent a successful recall or create/heal a room on its own.

Dashboard controls request grounded command proposals or generic Theo guidance
in the conversation. A request is not a receipt that work has executed.

For commands, the host uses suggest_next and chain_resolve, then chain_run.
The existing chain executor runs its permitted prefix and pauses at material
steps. gate_render and chain_run expose the same decision resource; the UI
submits a selection to gate_answer. That tool saves the decision and, for a
halted chain, resumes the approved step. Do not run chain_run again for that
same approval. gate_answer can return the next decision in the same component.

The UI supports the canonical superset's single and multiple selection,
descriptions, previews, recommendation data, and per-step approval/reject/defer.
It does not add new F-shapes or a second shape dispatcher. In particular an F.8
selection is a confirmed set, not an ordered walk. F.9 decisions remain ordered
by the existing workflow; this UI does not invent drag-to-reorder semantics.
Specialized shape producers still own their option vocabularies and effects.

An MCP Apps capability declaration selects the component route regardless of
client name. Hosts without it retain elicitation or the existing native/text
fallback. Explicit ChatGPT and Codex names no longer receive an instruction to
invoke Claude's AskUserQuestion. A client name is a presentation/default-routing
hint, not authentication, authorization, or proof that hooks are available.
Shared identity names Larry and MindrianOS without inventing an underlying model.

## ChatGPT connection

For ChatGPT web, connect the server through its supported custom MCP connection
using a reachable authenticated endpoint or Secure MCP Tunnel. The local stdio
definition alone is not a web deployment. Keep the guarded Brain connection
available separately; do not expose its credentials through the widget.

Refresh the connection's tools/resources after installing this source change.
No marketplace release, npm publish, account plugin update, tunnel creation,
or current-chat tool refresh is performed by this development task.

## State and limits

The server remains authoritative. Checkbox/radio state is temporary UI state.
Only the server-normalized card is rendered; no ledger session keys or resume
functions enter the widget. Failed writes, expired/stale gates and replayed
decisions retain the existing core semantics. A timed-out submit may already
have committed; retry the same gate to obtain its durable receipt.

The UI's click travels through the standard MCP Apps tools/call bridge.
The existing answer-route records this as mcp_relayed, not the standalone
shell's authenticated browser_nonce. This change does not claim the click
cryptographically proves a human or change the core's human-only policy.

Theo requests from the dashboard carry only a fixed generic problem-type
selection. The host must call the guarded Brain tools and report the real
result, including unavailable or unauthored guidance. No live Theo request is
made during offline tests.

The shared Apps SDK loader currently uses the existing pinned CDN URL. CSP
permits that script source; the new decision component makes no direct API
requests. SDK-load failure displays a disconnected state. Offline bundling is
not introduced here.

## Verification

Run tests/test-gpt-plugin-ui.cjs for real MCP registration and a real
GPT-identified client's bind, invalid choice, durable approval and replay.
Add --browser with an existing Playwright installation to exercise the actual
SDK in a sandboxed iframe, selection, retries, next decisions and proposal messages.
Synthetic local protocol/browser tests are not a live ChatGPT installation.

Official integration contracts checked for this change:
- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/chatgpt-ui
- https://developers.openai.com/api/docs/guides/custom-mcp-server

## Room-first entry verification

tests/test-room-first-entry.cjs drives a real GPT-identified client against two
synthetic local rooms. It verifies the selected non-boot room is shown by all
three views, context_assemble includes a saved decision, and a new server/client
session recovers that decision after binding the same room. With --browser it
checks call order, ineffective binding, missing memory, empty lists and narrow
layout through the actual MCP Apps SDK. This remains local integration evidence,
not a claim that the live ChatGPT account connection has been updated.
