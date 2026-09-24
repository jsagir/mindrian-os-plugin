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

## Desktop (human probe)

**Status:** PENDING (Task 3)

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

**Reported result:** _(fill in verbatim from the navigator's paste, or
`desktop-deferred` with today's date if this could not be run now)_

---

## Cowork (human probe)

**Status:** PENDING (Task 3)

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

**Reported result:** _(fill in verbatim from the navigator's paste, or
`cowork-deferred` with today's date if this could not be run now)_

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
