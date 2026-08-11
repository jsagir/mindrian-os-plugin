# Gate 0 - Cursor on Windows: navigator's live observation (VERBATIM external record)

Recorded 2026-08-11 from the navigator's own report, preserved verbatim below (em-dashes
preserved per the verbatim-record convention; the repo's no-em-dash rule applies to
authored prose, never to preserved external records). Closes 234-08 Task 2.

---

## Gate 0 — Cursor on Windows (live observation)

**Tester:** jsagi (navigator)
**Machine:** Windows 11 (build 10.0.26200)
**Host:** Cursor (Agent mode)
**Time budget:** ~20 min
**Date:** 2026-08-11

**Important caveat:** This was **not a cold install**. WSL Ubuntu, Claude Code marketplace plugin, and a hand-tuned `~/.cursor/mcp.json` were already present. This report is "watch it load + what broke / what worked," not a from-zero install path.

### Install configuration observed

**Config file:** `C:\Users\jsagi\.cursor\mcp.json`

Two MCP servers, both launched via **WSL bridge** (not native Windows Node):

| Server | Launch | Plugin root |
|--------|--------|-------------|
| `mindrian-os` | `wsl.exe → bash → node v22.23.1 → mindrian-mcp-server.cjs` | `mos/2.0.0-beta.5` (WSL cache) |
| `mindrian-brain` | same pattern → `mindrian-brain-mcp-client.cjs` | same |

Env loaded from `/home/jsagi/.mindrian.env` (`MINDRIAN_BRAIN_KEY` present).
`MINDRIAN_ROOMS_HOME=/home/jsagi/MindrianRooms`.

**VS Code:** No `mcp.json` under `%APPDATA%\Code` — not tested on this box.

### Load behavior (Cursor MCP panel / tool discovery)

On session start, **four** Mindrian MCP server identities appeared (duplicate registration):

| Identifier | Status | Tool count |
|------------|--------|------------|
| `plugin-mos-mindrian-os` | **ready** | 36 |
| `plugin-mos-mindrian-brain` | **ready** | 6 |
| `user-mindrian-os` | **ready** | 36 |
| `user-mindrian-brain` | **ready** | 6 |

Both OS and Brain servers share the display name `mindrian-os` / brain equivalents — agent sees **2× duplicate tool surfaces**.

Earlier in the same day, `plugin-mos-mindrian-os` had briefly shown **"loading"** before reaching ready after config changes.

**Cold-start stderr** (manual WSL launch, observed once):

```
[mindrian-os] Capabilities: active=[apps] inactive=[hooks, tasks, scripts]
[mindrian-os] MCP Apps registered: room-dashboard, room-wiki, room-graph
[mindrian-os] MCP server v2.0.0-beta.6 started (desktop, stdio, room: .../room)
(node) ExperimentalWarning: SQLite is an experimental feature...
```

### What worked

1. **MCP tool catalog loads** — 36 OS tools + 6 Brain tools discoverable in Cursor.
2. **WSL + Node 22 path works** — when using nvm `v22.23.1`; server starts cleanly.
3. **Skills catalog visible** — MindrianOS skills from `mindrian-marketplace/mos` appear in Cursor agent context (e.g. `mos:*`, `larry-extended`, PWS methodology skills).
4. **Room ops via WSL scripts** — `room-registry create lunar-water-site` succeeded; room at `/home/jsagi/MindrianRooms/lunar-water-site`.
5. **Plugin version** — Claude marketplace reports `mos@2.0.0-beta.5` current via `npx @mindrian_os/cli`.

### What failed or surprised us

| Issue | Severity | Detail |
|-------|----------|--------|
| **Duplicate MCP servers** | Medium | Marketplace plugin *and* user `mcp.json` both register — 4 servers, 2× tools. Agent may pick wrong instance. |
| **Native Windows Node path** | Blocker (without WSL) | Direct `command: node` + Linux path → Cursor/Antigravity mangles to `C:\home\jsagi\...` → `MODULE_NOT_FOUND`. Confirms 234-08 finding. |
| **Node 20 insufficient** | Blocker | WSL system Node `v20.19.5` → `ERR_UNKNOWN_BUILTIN_MODULE` for `node:sqlite`. Requires **Node ≥ 22.5**. |
| **Brain unreachable (one probe)** | Medium | `brain_ask` returned `tier_0_brain_unreachable` / `mode_rationale: brain_unreachable` despite key in `.mindrian.env`. May be cold-start / MCP restart timing. |
| **Tools return docs, not execution** | Expected but confusing | `room_content`, `methodology`, `analysis`, `orchestration` return **"NOT EXECUTED — follow Reference steps"** + full command markdown. Cursor agent must interpret, not call-and-done. |
| **`chain_run` timeout** | High | `gate_render_failed`: MCP error `-32001: Request timed out` when running `["diagnose","find-bottlenecks","systems-thinking","whitespace"]`. |
| **`room_bind` no session** | Medium | `{ ok: false, reason: "no_session_id" }` — session binding not wired in this MCP client path. |
| **No `/mos:*` slash commands** | By design | Full command suite lives in Claude Code; Cursor gets MCP + skills only. |

### Windows-specific notes for install docs

1. **Do not use native Windows Node with Linux plugin paths** — must use WSL bridge or install plugin on Windows with Windows paths.
2. **Document Node 22+ requirement prominently** — v20 fails on `node:sqlite`.
3. **Warn against dual registration** — if Cursor marketplace plugin *and* manual `mcp.json` both define `mindrian-os`, user gets duplicates. Pick one source.
4. **Uncheck "Automatically install necessary tools"** in Node installer (per mindrian-os.com/docs/install) — saves 20–90 min on Windows.
5. **First Brain call may be slow** — Render-hosted Brain sleeps after 15 min idle (30–60s wake per docs).

### Gate 0 verdict (this machine)

| Criterion | Result |
|-----------|--------|
| Plugin installs / MCP servers appear in Cursor | **PASS** (with WSL bridge) |
| Servers reach **ready** state | **PASS** |
| Tool catalog visible (≥30 OS tools) | **PASS** (36 × 2) |
| Brain connects | **PARTIAL** (key present; one live probe failed) |
| Callable end-to-end without agent interpretation | **FAIL** (instruction-surface model; gates timeout) |
| Cold-install from docs alone, no WSL | **NOT TESTED / likely FAIL** |
| VS Code | **NOT TESTED** (not installed/configured) |

**Overall: PASS with caveats** — Tier-0 MCP load works on Cursor+Windows **when WSL + Node 22 + manual mcp.json are already set up**. Not yet proven as a zero-handholding cold path for a fresh Windows user.

### Recommended follow-ups for devs

1. Ship a **Cursor-specific install snippet** (WSL vs native Windows paths).
2. **Deduplicate** marketplace vs user MCP registration.
3. Investigate **`gate_render` timeout** (-32001) in Cursor MCP client.
4. Run Gate 0 on a **fresh Windows 11 VM** with only: Git, Node 22, Cursor, `npx @mindrian_os/cli` — no pre-existing WSL state.
5. Attempt same gate on **VS Code + Copilot** (234-08 Task 2 still open for MCP half).

---

## Sign-off block

| Field | Value |
|---|---|
| Gate | 0 (foreign-host live verification, 234-08 Task 2) |
| Machine | Windows 11 build 10.0.26200, WSL Ubuntu, Node 22.23.1 (nvm) |
| Host | Cursor, Agent mode |
| Plugin | mos@2.0.0-beta.5 (mindrian-marketplace) |
| Verdict | PASS with caveats (see criterion table above) |
| Observed by | navigator (jsagi), 2026-08-11 |
| Recorded by | dev session, commit accompanying this file |
| Gap items | .planning/debug/gate0-cursor-windows-gaps.md (3 defects, routed) |

## ADDENDUM (2026-08-11, post-restart): Gate 0 COMPLETE - PASS

Second navigator report after Cursor restart: both servers connect in 1-2s
(idle -> connecting -> connected), MCP Apps registered (room-dashboard/wiki/graph),
room bound (lunar-water-site), and LIVE tool calls verified: status_read OK (tier0,
write path enabled), room_state OK (Pre-Opportunity, 1 artifact), brain_stats OK
(Memgraph, 28,325 / 23,014), brain_search OK (0.94-0.96 hits), brain_ask GUIDED mode
working as designed (grounding-or-reframe; text2cypher arm disabled_pending_schema_trim
by policy). The earlier Brain PARTIAL flips to PASS.

Navigator's completion statement (verbatim): "Installed Mindrian in Cursor on Windows.
On load, mindrian-os and mindrian-brain MCP servers connected successfully, registered
three MCP Apps, bound to room lunar-water-site, and responded to live tool calls.
Brain graph is live with 28k+ nodes. Gate 0: PASS."

NEW OBSERVATION, upgrades gap item 3: the plugin-channel copy runs NATIVE Windows Node
at v1.16.0-beta.13 alongside the WSL beta.5 - the duplicate registration is
VERSION-SKEWED, and beta.13 is the dead-Brain-leg build. Severity raised to HIGH in
.planning/debug/gate0-cursor-windows-gaps.md: an agent addressing the plugin-channel
instance gets the pre-fix Brain behavior. Recommended immediate operator action:
remove or update the plugin-channel registration so only ONE version serves.
