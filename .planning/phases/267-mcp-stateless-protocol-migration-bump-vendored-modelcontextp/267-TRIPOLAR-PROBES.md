# Phase 267 Plan 04: Tri-Polar Pre-Migration Wire Probes

Recorded pre-migration host facts (locked_stage "W0 Tri-Polar wire probes
BEFORE the local server adopts serveStdio"). Purpose: CTX Claude's
Discretion says Desktop's actual protocol/elicitation behavior "must be
verified at some point in this phase before claiming Tri-Polar coverage, not
assumed identical to CLI." This file is that verification record for all
three hosts -- CLI (done here, automated), Desktop and Cowork (human probe,
Task 3).

Tool: `tests/helpers/mcp-stdio-tee.cjs` (built in Task 1, self-tested in
`tests/test-267-mcpv2-tee.cjs`). It logs ONLY the opening handshake
(method, protocolVersion, clientInfo, capability keys/values) to
`MOS_TEE_LOG`, never tool arguments or results (see the file header and
T-267-12 in `267-04-PLAN.md`'s threat model).

---

## CLI (automated)

**Run:** `MOS_267_LIVE_CLI_PROBE=1 node tests/test-267-mcpv2-cli-probe.cjs`
**Date:** 2026-09-24
**claude --version:** `2.1.281 (Claude Code)`

| Server | Method | protocolVersion | capabilityKeys | elicitation declared | server/discover seen |
|---|---|---|---|---|---|
| local (`mindrian-os-tee`, wraps `bin/mindrian-mcp-server.cjs`) | `initialize` | `2025-11-25` | `["roots","elicitation"]` | yes | no |
| brain shim (`mindrian-brain-tee`, wraps `bin/mindrian-brain-mcp-client.cjs`) | `initialize` | `2025-11-25` | `["roots","elicitation"]` | yes | no |

**Result:** real probe, not an ENV GAP. Both servers exited 0 with an
opening record captured. This confirms live, on 2.1.281 (one patch above
267-RESEARCH.md's 2.1.280 measurement), the same fact the research's own
wire tee found: Claude Code opens stdio connections with a plain
`initialize` at `2025-11-25`, declares `elicitation:{}`, and never sends
`server/discover` on stdio. No drift since the research pass.

---

## CLI (post-migration)

**Run:** `MOS_267_LIVE_CLI_PROBE=1 node tests/test-267-mcpv2-cli-probe.cjs`, then a
second, fuller run of the same wrapper that keeps the whole tee log (the stock
test deletes it) so the message order could be read.
**Date:** 2026-10-02 (267-18 Task 1). Probe ran as a real probe, not an ENV GAP.
**claude --version:** `2.1.287 (Claude Code)` (pre-migration record above was 2.1.281).
**Servers under test:** the migrated local server (`@modelcontextprotocol/server` 2.1.0
`McpServer` plus `serveStdio`) and the migrated brain shim, each wrapped in the tee.
Both exited 0 and `claude -p "Reply with the single word ok."` answered `ok` through
each (the host listed prompts, resources and tools from the local server and tools
from the shim).

| Server | Opening method | protocolVersion | capabilityKeys at opening | `elicitation` declared at opening | server/discover seen |
|---|---|---|---|---|---|
| local (`mindrian-os-tee`) | `server/discover` | not carried (2026-era opening has no `initialize`) | `[]` | no | yes (twice) |
| brain shim (`mindrian-brain-tee`) | `server/discover` | not carried | `[]` | no | yes (twice) |

Observed message order on both servers, local one shown (methods only, the tee
logs nothing else):

```
c2s  server/discover           (probe)          s2c  result, instructions present
c2s  subscriptions/listen                       s2c  notifications/subscriptions/acknowledged
c2s  server/discover                            s2c  result
c2s  prompts/list, resources/list, tools/list   s2c  the three lists
```

**What changed since the pre-migration record, and why it matters:**

- The pre-migration record (2.1.281) saw `initialize` at `2025-11-25` with
  `elicitation:{}` declared and no `server/discover`. Claude Code 2.1.287 opens
  stdio with `server/discover`, then `subscriptions/listen`, and never sends
  `initialize`. This is the 2026-07-28 era, the one this phase's migration exists
  to serve. It is a host change between two patch versions, not something the
  migration caused.
- The migrated servers answer that era correctly: discovery, the three list
  calls and a model turn all work. Before the migration a v1 server could not
  answer `server/discover`.
- The gate-ladder consequence (from the 267-11 dual-era test, which pins it):
  on a 2026-era connection the server sees no initialize-time client capabilities,
  so rung (a) (inline `elicitInput`) is not used and the gate renders at rung (b).
  Result on this host: the CLI no longer meets "rung (a) conditions (elicitation
  declared)". This is the exact situation the "Decision input for 267-11" rule
  below reserved for Desktop. It needs a navigator acknowledgement, because the
  rule says adopting `serveStdio` must not silently move a host off rung (a).
  Nothing was observed to break: the gate still renders, one rung down.
- Not measured here: a real gate on this host (a model turn that raises a gate).
  The tee cannot show the rung; the dual-era test is the evidence for the rung.

---

## Desktop (human probe)

**Status:** DONE 2026-10-02 (navigator probe)

Steps for the navigator (about 5 minutes):

1. Open Claude Desktop's config (Settings, Developer, Edit Config). Add this
   block under `mcpServers` (do not remove the existing `mindrian-os` or
   `mindrian-brain` entries -- this is an ADDITIONAL, temporary probe entry):

```json
{
  "mcpServers": {
    "mindrian-os-tee": {
      "command": "node",
      "args": [
        "/home/jsagi/dev/MindrianOS-Plugin/tests/helpers/mcp-stdio-tee.cjs",
        "node",
        "/home/jsagi/dev/MindrianOS-Plugin/bin/mindrian-mcp-server.cjs"
      ],
      "env": {
        "MOS_TEE_LOG": "/tmp/mos-tee-desktop.jsonl"
      }
    }
  }
}
```

   (On Windows, replace both absolute paths with the equivalent path on
   whatever machine Desktop runs on, and use a Windows-style temp path for
   `MOS_TEE_LOG`, for example `%TEMP%\mos-tee-desktop.jsonl`.)

2. Restart Claude Desktop. In a new chat, say "list my rooms" so the server
   is exercised once (this fires `initialize`, which is what gets logged).
3. Run `cat /tmp/mos-tee-desktop.jsonl` (or the Windows-path equivalent) and
   paste the first 3 lines back. What we need: the first `method`
   (`initialize` or `server/discover`), its `protocolVersion`, and the
   `capabilityKeys` (is `elicitation` there?).
4. Remove the `mindrian-os-tee` block from the Desktop config and restart
   Desktop (the probe entry is temporary; the tee log is never committed --
   only the summarized fields recorded here are).

**Reported result (2026-10-02, navigator ran it; tee log read directly from
`/tmp/mos-tee-desktop.jsonl`, 22 lines, by the orchestrating session):**

- Host: Claude Desktop on Windows 11, server launched via `wsl.exe -d Ubuntu`
  (same pattern as the user's standing `mindrian-os` entry).
- First c2s method: `initialize` (NO `server/discover` anywhere in the log).
- `protocolVersion`: `2025-11-25` (client) / `2025-11-25` (server reply).
- `clientInfo`: `{"name":"claude-ai","version":"0.1.0"}`.
- `capabilityKeys`: `["extensions"]` only -- `extensions` carries
  `io.modelcontextprotocol/ui` (`text/html;profile=mcp-app`). **No
  `elicitation` key.**
- Methods observed: initialize x2, notifications/initialized x2,
  notifications/roots/list_changed x2, tools/list x2, prompts/list x1,
  resources/list x1, tools/call x3.
- Server: `mindrian-os` `2.0.0-beta.56` (dev tree, pre-267-11 v1 McpServer).

**Reading against the 267-11 decision rule:** Desktop is 2025-era with no
`server/discover`, so the "Desktop opens with server/discover or a
2026-07-28 initialize" STOP branch does NOT fire. Desktop never declared
`elicitation`, so its gate ladder is already rung (b)/(c) today; adopting
`serveStdio` cannot move it off rung (a). **267-11 is unblocked on the
Desktop leg.** No dialog-vs-card observation was possible: the gate prompt
produced no gate because of finding F-2 below.

**Side findings from the same Desktop session (routed to their own RCAs, not
267 scope):**

- F-1: "list my rooms" first returned a reference doc rather than data; the
  model fell back to a second call.
- F-2: `room_bind` fails on Desktop stdio with `no_session_id`; the model
  re-bound under an explicit sessionId, but `claim_write` and room-state reads
  ignore that binding and fall back to the global registry `active` room.
  `claim_write` wrote `claim:nosession:8e71dd1e` into that fallback room and
  reported the location truthfully (tool text matched room.db).
- F-3 (root cause of the fallback target): `tests/test-section-nodes-birth-and-migration.cjs`
  calls `birthRoom()` without sandboxing the room registry, so a test run
  registered `/tmp/birth-*` rooms in the real `~/MindrianRooms/.rooms/registry.json`
  and set `active: "idem-room"` (stamped 2026-10-02T01:21:38Z). Registry
  repaired by the navigator the same day (backup `registry.json.bak-idem`).

---

## Desktop-surrogate (post-migration, automated, NOT a human probe)

> WARNING: this is a scripted stand-in that copies Desktop's handshake. It does
> NOT satisfy MCPV2-13's human Desktop check; MCPV2-13 stays open for the
> Desktop leg until the navigator's real smoke is recorded in a
> "## Desktop (post-migration)" section.

**Date:** 2026-10-02 (267-18, after the navigator's rulings). Script lives in the
executor scratchpad, not the repo.
**Setup:** the dev server `bin/mindrian-mcp-server.cjs` launched with the same WSL
node Desktop uses (`/home/jsagi/.nvm/versions/node/v22.22.2/bin/node`), over stdio,
cwd `/tmp`. `HOME` and `MINDRIAN_ROOMS_HOME` were throwaway directories. The rooms
home held two scratch rooms, `room-a` and `room-b`, registered in a registry whose
`active` was `room-a`. Env scrubbed of `MINDRIAN_ROOM`, `MINDRIAN_SESSION_ID`,
`CLAUDE_CODE_SESSION_ID`, `MINDRIAN_MCP_FIRST`, `MINDRIAN_BRAIN_KEY`.
**Client:** a v2 `Client` (legacy mode) with `clientInfo {claude-ai, 0.1.0}`,
protocolVersion `2025-11-25`, and capabilities
`{extensions: {"io.modelcontextprotocol/ui": {mimeTypes: ["text/html;profile=mcp-app"]}}}`.
No elicitation, no session id. Server reported `mindrian-os` 2.0.0-beta.56, with
tools, prompts and resources capabilities, and 45 tools and 9 prompts listed.

| # | Check | Result |
|---|-------|--------|
| 1 | `room_bind {room: "room-b"}`, no sessionId | `isError: true`, body `{"ok": false, "reason": "no_session_id"}`. Unchanged from the pre-migration Desktop finding F-2. With an explicit `sessionId` the same bind returns `ok: true, bound: true, primary: room-b, effective: true, resolved_source: session.primary` |
| 2 | `prompts/get "status"` | OK, returns one user message ("Call status_read and room_state ..."). No -32603. `bind-room` and `act` also return OK, so all three runtime-loop prompts that failed before 267-09 now work |
| 3 | `gate_render` (single-select, two options) and `suggest_next` | `gate_render` ok:true, `renderer: "askuserquestion"` (rung b, an in-chat card contract), with no elicitation (the client declared none, as Desktop does). `suggest_next` ok:true with `suggestion: null` ("No candidate reach fired") on an empty scratch room, so it raised no gate itself |
| 4 | `room-dashboard` app tool | Tool `inputSchema`: one optional string `room_path`; `_meta.ui.resourceUri = ui://mindrian-os/room-dashboard`. `resources/read` of that URI returns one `text/html;profile=mcp-app` document (8932 bytes). Calls: no `room_path` returns the data for the SERVER-DEFAULT room (name "room", not `room-a`/`room-b`); `room_path: "room-b"` (relative) is rejected with "room_path is outside the rooms home"; `room_path: "<rooms home>/room-b"` (absolute, inside the rooms home) returns `room-b`'s data. Containment works; relative slugs are not accepted. The HTML render itself needs a real host |
| 5 | `room_state_bound` and `room_state {command: "status"}` | Both report **`room-a`, the registry active room**, never `room-b`. Same result after the explicit-sessionId bind in check 1, with or without passing the sessionId. `status_read` also reports `room-a` and `surface: desktop`, `host: claude-desktop` (tier0), `write_path_enabled: true`, `tool_registration: complete` |

**Reading:**
- Check 1 and check 5 reproduce `.planning/debug/desktop-session-binding-fallback.md`
  exactly, post-migration: no change. Not fixed here, per scope; the migration
  neither helped nor hurt it.
- Checks 2, 3 and 4 show the migrated server does what the plan claims for a
  Desktop-shaped client: prompts accept their arguments, the gate renders at rung
  (b) with no elicitation, and the MCP Apps view serves its resource and honors
  `room_path` containment.
- Side note seen in server stderr at shutdown with no room bound:
  `[session-catchup] Failed to save on shutdown: The "path" argument must be of
  type string. Received null`. Harmless in this run, not investigated here.

---

## Desktop (post-migration)

**Status:** DEFERRED 2026-10-02, navigator ruling ("Close now, Desktop deferred"). No
human post-migration Desktop smoke happened. This phase does NOT claim a human
Desktop verification of the migrated servers.

What backs Desktop instead, stated at its real strength:

- **Pre-migration human wire probe** (commit c5add6eb6, section "Desktop (human
  probe)" above): Desktop on Windows via `wsl.exe` opened with `initialize` at
  `2025-11-25`, declared only the `io.modelcontextprotocol/ui` extension, no
  elicitation, no `server/discover`. That is why 267-11 was unblocked.
- **Automated surrogate, post-migration** (commit 5b1770072, section
  "Desktop-surrogate" above): a v2 client copying that exact handshake against the
  migrated dev server. The status prompt answers, the gate renders at rung (b),
  the dashboard view serves its resource with `room_path` containment, and
  `room_bind` without a session id and the registry-active fallback are unchanged.
  It is a stand-in, not a human probe.

Not verified by any human on the migrated build: the real Desktop GUI flow (the
five checks the navigator was asked to run), the dialog-vs-card observation on a
real Desktop gate, and whether Desktop's dashboard view actually paints.
MCPV2-13 therefore stays open for this leg. To close it later: run the
"Setup" and "Desktop checks" steps from the 267-18 checkpoint (temporary
`mindrian-os-dev` entry through `wsl.exe` pointing at the dev tree, tee log to
`/tmp/mos-tee-desktop-post267.jsonl`) and record the result here.

---

## Cowork (post-migration)

**Status:** DEFERRED 2026-10-02, navigator ruling ("Close now, Desktop deferred"
read as both surfaces). Cowork runs the installed plugin, not the dev tree, and no
supported way to load this dev build into a Cowork session was available.

Nothing was observed on Cowork, before or after the migration. What exists is
automated evidence only: `tests/test-267-mcpv2-http-flag-off.cjs` proves the
Cowork-routed HTTP branch (flag OFF) now answers many sequential requests in both
protocol eras, where it used to answer one per process (RCA 1,
`mcp-http-flag-off-one-request-per-process`, resolved by 267-12). Assumption A7
(does Cowork actually reach that HTTP branch) is still unconfirmed, so RCA 1's
live severity stays unconfirmed even though the bug is fixed. MCPV2-13 stays open
for this leg. To close it: a Cowork session with a build of this tree, then
`status_read`, list rooms, one more tool, plus `ps aux | grep mindrian-mcp-server`
and `env | grep -E "CLAUDE_SURFACE|COWORK_SESSION_ID"` in the VM.

---

## Cowork (human probe)

**Status:** PENDING (Task 3; Desktop leg done, Cowork re-asked at 267-18)

Steps for the navigator (about 5 minutes):

5. In a Cowork session with the plugin installed, ask Larry to run
   `status_read`. Then, in that Cowork VM's terminal (if reachable), run:

```bash
ps aux | grep mindrian-mcp-server
env | grep -E "CLAUDE_SURFACE|COWORK_SESSION_ID"
```

   and paste the output. We need to know whether the server runs in HTTP
   mode there (A7 in 267-RESEARCH.md: does Cowork reach the broken flag-OFF
   HTTP branch, RCA 1 / `mcp-http-flag-off-one-request-per-process.md`,
   fix owned by 267-12).
6. If a Cowork VM is not reachable right now, reply `cowork-deferred`:
   267-18 re-asks before Tri-Polar is claimed complete for the phase.

   (A wire-level tee probe on Cowork's actual HTTP path is a separate,
   larger lift than the stdio config above -- this step only needs the
   process/env facts to resolve A7's severity, not a full tee run. If a
   Cowork-side stdio tee run ever becomes useful, the same `mcpServers`
   block shape from the Desktop section applies, adjusted for however
   Cowork registers MCP servers on that VM.)

**Reported result:** not run on 2026-10-02 (Desktop leg only that session).
Still PENDING; 267-18 re-asks. Per the rule below, RCA 1 is fixed by 267-12
regardless of this leg.

---

## Decision input for 267-11

267-11 (the plan that adopts `serveStdio` on the local server's stdio
branch) applies this rule before it lands:

- **If the CLI result above is 2025-era with no `server/discover`** (which
  it is, confirmed live on 2.1.281): `serveStdio` adoption on CLI is
  future-proofing only, no wire-visible change expected, matching
  267-RESEARCH.md's own "Adopt `serveStdio` anyway... do not expect or test
  for a wire-visible change on stdio."
- **If Desktop opens with `server/discover` or a `2026-07-28` `initialize`
  on stdio:** adopting `serveStdio` in 267-11 would make
  `getClientCapabilities()` return `undefined` there and move Desktop's gate
  ladder from rung (a) (inline `elicitInput`) to rung (b)/(c). 267-11 STOPS
  before adopting `serveStdio` unless this section records a navigator
  ruling accepting rung (b)/(c) on Desktop, OR the Desktop result is
  `desktop-deferred` and the navigator explicitly accepts proceeding without
  it (not the default).
- **If Cowork's process/env facts show it reaching the flag-OFF HTTP
  branch:** confirms RCA 1's severity as live-user-facing, not merely
  latent; 267-12 (RCA 1's fix owner) treats it as such. If `cowork-deferred`,
  RCA 1 is still fixed regardless (it is a real bug independent of A7), but
  its severity stays unconfirmed until 267-18 re-asks.

**Navigator ruling (fill in only if triggered by a 2026-era Desktop
result):** _(none recorded yet -- pending Task 3)_
