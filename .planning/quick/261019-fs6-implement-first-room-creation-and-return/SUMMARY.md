---
task: 261019-fs6
status: complete
canon_parts: [3, 7, 8, 9, 11]
---
# Navigator startup flows

Implemented first-room creation and returning workday startup in the existing
MCP plugin and embedded room UI.

- room_create previews a name, purpose and safe local destination, then mints
  an F.0 material-step card through the existing gate renderer/ledger.
- gate_answer validates the same live gate before invoking navigation.birthRoom.
  Reject/defer writes no room. Approval rechecks the destination and records a
  durable receipt in the birth identity transaction. Existing-room collisions
  are refused. Shell invocations now pass literal argv for user names and paths.
- room_startup composes saved understanding, session state, recorded changes,
  open questions and pending gates through existing readers. A local SQL visit
  checkpoint preserves the baseline on retries and across sessions. Missing
  history is explicit. The F.1 next-move card follows the briefing.
- The room picker handles clean homes, creation previews and existing-room
  selection. Both converge on effective bind -> context -> startup -> dashboard.
  Direct room_create/room_startup invocations also render the room resource.
- Connector declarations and generated coverage/harness contracts are updated.

## Verification

- tests/test-startup-flows.cjs --browser: real MCP clean-home creation,
  reject/defer, unsafe paths, literal names, collision, durable replay, fresh
  process memory, saved next action, changes, pending gates and retry checkpoint;
  actual Apps SDK sandbox browser covers both flows and direct tool rendering.
- tests/test-room-first-entry.cjs --browser: real selected-room views/memory,
  fresh-session restoration, explicit selection, binding refusal, missing memory,
  empty list and narrow host.
- tests/test-gpt-plugin-ui.cjs --browser: real GPT-client decisions, approval
  replay, SDK selection/submit, stale refusal, command and Theo proposal messages.
- tests/test-room-birth.cjs: 35/35; test-36925-rid-birth.cjs: 7/7;
  test-36925-rft-birth.cjs: 6/6; lib/mcp/no-instructions.test.cjs: 18/18.
- Connector/orchestration/harness generator checks pass with zero coverage gaps;
  render coverage has zero gaps; git diff --check passes.

No live ChatGPT installation/connection update, marketplace release, tunnel,
npm publication, remote Theo write or automatic research was performed. Local
creation runs on the MCP server's machine. A web host does not receive access
to the navigator's PC merely by connecting the plugin. Screenshots are synthetic
local test previews. Unrelated pre-existing untracked design files are preserved.
Current milestone and phase position are unchanged.
