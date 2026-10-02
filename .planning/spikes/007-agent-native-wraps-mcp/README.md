---
spike: 007
name: agent-native-wraps-mcp
type: standard
validates: "Given an agent-native app with three actions wrapping room_state, graph_query and gate_render/gate_answer over MCP HTTP, and no Postgres holding room data, when the gate's Confirm is clicked once, then the research grant is recorded in the throwaway room and the 006 RxDB view updates without reload; license checked"
verdict: VALIDATED
related: [005, 006]
tags: [agent-native, ui, gate, seed-105]
---

# Spike 007: one click on a real research-grant gate, through agent-native

## What This Validates
Given an agent-native app whose only room access is three actions that call the MindrianOS MCP server,
when a person opens the decision view and clicks Confirm once on the preselected recommendation, then the
grant is saved in the throwaway room and the spike 006 live room view shows the new decision without a
reload. Also: is the license usable commercially, and can agent-native consume an external MCP server as
agent tools (not only expose its own)?

**Verdict: VALIDATED on the machine-verifiable part (the click was driven headless by Playwright, in dev
and in a production build). Awaiting the navigator's own click** (run steps below). Five findings change
the SEED-105 plan; see "What contradicts SEED-105".

## Research
**License (checked first, as required), exactly what was found at commit `8aae00fb` (2026-10-01):**
- Root `package.json`: `"name": "agentnative"`, `"license": "ISC"`. It is the private monorepo root, not a
  published package.
- Root `README.md`, section "License": `MIT`.
- License files in the repo: exactly one, `packages/vscode-extension/LICENSE.md`, the standard MIT text,
  "Copyright (c) Builder.io". There is no root LICENSE file.
- npm `@agent-native/core@0.198.8` (the package this app depends on): `"license": "MIT"`. Its tarball
  contains **no MIT license text file**, only three bundled font licenses (Geist, Liberation, Noto Naskh
  Arabic). Every published `@agent-native/*` package declares MIT; templates are private with no field.
- Reading: MIT by every published declaration; nothing blocks commercial use. A real build should keep
  the MIT notice itself (copy the vscode-extension text with the Builder.io copyright) since the npm
  tarball does not ship one, and check the three OFL font licenses if those fonts ship.

**agent-native, read from source (`packages/core/src`):**
- Actions: `defineAction({ schema: zod, http, run })` in `actions/*.ts`; served at
  `/_agent-native/actions/<name>`; React hooks `useActionQuery` / `useActionMutation` from
  `@agent-native/core/client/hooks` (the README's `@agent-native/core/client` path is refused by 0.198).
- **It can consume external MCP servers as agent tools:** `mcp-client/` loads `mcp.config.json`
  (`type: "stdio"` or `type: "http"`), one `McpClientManager` per authenticated user/org principal, tools
  named `mcp__<server>__<tool>`, plus a remote-server store and OAuth. It also exposes its own actions as MCP.
- Telemetry: the CLI reports to `https://analytics.agent-native.com/track` by default; opt out with
  `DO_NOT_TRACK=1` or `AGENT_NATIVE_TELEMETRY_DISABLED=1` (set for every command in this spike).

## How to Run
Prerequisites: spike 006 installed and built (`cd .planning/spikes/006-room-pull-checkpoint && npm install && npm run build`),
ports 3847, 3871 and 8090 free, Node 22.22+, pnpm.

```bash
# Terminal 1: the throwaway room, the MCP server and the live room view
node .planning/spikes/006-room-pull-checkpoint/stages/03_probe/demo.cjs

# Terminal 2: build the app once, then serve it (production build, loopback only)
.planning/spikes/007-agent-native-wraps-mcp/stages/01_scaffold/setup.sh
.planning/spikes/007-agent-native-wraps-mcp/stages/01_scaffold/serve.sh
```

**Navigator click test:** open `http://127.0.0.1:3871/` (the live room view) and, beside it,
`http://127.0.0.1:8090/gate`. The gate asks "Approve this research grant?" with "Approve this standing
grant" already selected and marked Recommended. Click **Confirm** once. Expected: the gate page shows a rust
square and "Decision recorded in the room."; the room view, without reloading, gains a black decision tile
and a "decision" row at the top of "Most recent". `?source=render` opens a generic gate instead;
choosing "Not now" records the answer and saves nothing.

Headless re-run: `APP_URL=http://127.0.0.1:8090 node .planning/spikes/007-agent-native-wraps-mcp/stages/03_click-test/run.cjs`.

## What to Expect
One view, paper background, the question as a Fraunces headline with the accent in rust, the grant's terms
in plain text, a ruled answer box with the recommendation preselected, and one ink Confirm bar with the ochre
triangle and a consequence line ("Saves this decision to the room. Nothing is searched yet."). After the
click: the rust square locks in, the status names what happened, and one action remains: "Open the live
room view". In production a pink "Configuration error" toast from agent-native's own chrome appears (its
database refusal, below); it does not affect the gate.

## Investigation Trail
1. **Scaffold:** `npx @agent-native/core@0.198.8 create mos-ui --standalone --template chat` (React Router
   8.1, Vite 8.1, Nitro, zod 4, React 19). It writes `CLAUDE.md`, `.claude/skills` and `.mcp.json` into the
   app folder. **That CLAUDE.md auto-loaded into this Claude session** the moment a file there was read.
   `setup.sh` deletes all three; `mos-ui/` is git-ignored and rebuilt from `setup.sh` + the overlay.
2. **Bridge design:** gates are session-owned (005), so the app keeps one MCP client per UI session key
   (a random id in `sessionStorage`), and both the mint and the Confirm travel on it. Verified: every arm's
   mint and answer used the same `mcp-session-id`.
3. **The cross-session refusal burns the gate.** Spike 005 saw `session_mismatch` and stopped there. Asking
   the next question: after another session's refused answer, the owner's own answer gets
   `unknown_or_expired_gate`. Root cause: `lib/mcp/gate-ledger.cjs:100`, `consumeGate` deletes the entry
   ("single-use: consumed whether or not the verdict below holds") before it checks the session. Anyone who
   learns a gate id (a shared Cowork screen, a log) can cancel someone else's decision. Scripted:
   `stages/02_actions/burn-probe.cjs` (control: owner alone ratifies; with a stranger first: owner refused).
4. **Reject is not an error.** A "Not now" answer returns `ok: true, ratified: false` (a memory_event,
   nothing else). The first UI treated `ratified` as success and showed a refusal; fixed to `ok`.
5. **The recommendation is not in the gate contract.** The rendered contract carries `recommended: null`,
   `preChecked: []`; only `card.options[].recommended` says which option is recommended. The rendered
   gate also drops `approve_run` when there is no run, so the UI shows only options the gate will accept.
6. **agent-native as an MCP client of MindrianOS: fails today, one line from working.** A logging proxy
   showed the handshake: agent-native ships the MCP SDK v2 client (`@modelcontextprotocol/client@2.0.0`,
   protocol `2026-07-28`), which opens with a session-less `server/discover`; the MindrianOS per-connection
   server (SDK v1 `^1.30.1`) answers HTTP 400 "Server not initialized"; the client falls back to
   `initialize` (200, session id), but agent-native's connect guard already recorded the 400 and marks the
   server not connected. A loopback shim that answers that one probe with JSON-RPC `-32601` over HTTP 200
   (`stages/02_actions/discover-shim.cjs`) makes it work: **45 tools listed, room_state answered, a gate
   minted and ratified through agent-native's own `McpClientManager`**. An HTTP 404 instead still fails.
7. **Production build:** `pnpm build` 77 s, 27.4 MB (8.9 MB gzip). Production **refuses PGlite** and wants
   a hosted Postgres (`DATABASE_URL`); its chat, automations and integrations error at boot. The actions and
   the gate route need no database and keep working. Time to the gate on screen falls from about 6.6 s
   (dev, Vite on demand) to 0.65-1.2 s.
8. **Dev server exposure:** `agent-native dev` binds `*:8080` (every interface) and runs a PTY terminal
   server on `127.0.0.1:42003`. `serve.sh` defaults to the production build on `127.0.0.1:8090`.
9. **Reproducible from nothing:** `mos-ui/` was moved away and rebuilt with `setup.sh` (17 s) and
   `serve.sh`; the click test passed again (gate 1.1-1.4 s, click to room view 68-106 ms, new standing grant).
10. **Real room:** the stamp check reported a change on that last run. The changed file is `STATE.md`, and
   `.mindrian/` had already changed at 03:11:34, before the stack started at 03:11:53: the installed mos
   plugin's hooks in live Claude sessions with this room active write it. Spike processes never open it
   (spike 006 controls).
11. **Design:** the gate first rendered inside agent-native's chat shell (white sidebar, Inter, rounded panel,
   "New Chat"), which breaks one decision per view. `root.tsx` now renders `/gate` full-bleed.

## Results
Forensic log: `results.json` (license, scaffold, probes, then `dev.*`, `prod.*` and `prod_fresh_setup.*` click runs on fresh
room copies). Screenshots: `stages/03_click-test/output/`.

| Measure | Dev (Vite) | Production build |
|---|---|---|
| Gate on screen (navigation to Confirm visible) | 6.6-17.3 s (first load compiles) | 0.65-1.2 s |
| Recommended option preselected | yes, 3 of 3 arms | yes, 3 of 3 |
| Click to the room's answer (one MCP round trip through the action) | 60-116 ms | 66-68 ms |
| Click to the decision visible in the 006 RxDB view, no reload | 69-125 ms | 73 ms |
| Grant before / after arm A | none / standing `g-924f8be3` | none / standing `g-7cf3d743` |
| "Not now" arm | answered, nothing saved, decisions unchanged | same |
| Browser hosts contacted | 127.0.0.1, fonts.googleapis.com, fonts.gstatic.com | same |
| App server sockets to non-loopback peers (sampled every 100 ms) | none | none |
| Room data in agent-native's database | none (actions never touch it) | none |

### What contradicts SEED-105
1. **"PGlite may hold UI session data" is a dev-only truth.** agent-native production refuses PGlite and
   requires a hosted Postgres for its own tables. Either the MindrianOS UI runs a Postgres (for UI session
   data only), or it drops agent-native's chat/automation features and uses only actions and routes.
2. **agent-native cannot consume the MindrianOS MCP server as agent tools today** (SDK v2 client vs v1
   per-connection server: the `server/discover` probe gets HTTP 400). Fix on the MindrianOS side is small:
   answer a session-less non-initialize request with a JSON-RPC error over 200, or move the server to the
   v2 SDK. Until then, actions with their own MCP client (this spike's bridge) are the working path.
3. **A refused cross-session answer cancels the owner's gate** (`gate-ledger.cjs:100`). The SEED's Cowork
   view needs the ledger to check the session before consuming, or gate ids must never be shown to other
   sessions.
4. **The gate contract does not carry the recommendation** (`recommended: null`); the "real buttons with a
   preselected recommendation" promise depends on reading `card.options[].recommended` (the same gap behind
   SEED-104's "not set" dialog).
5. The scaffold's CLAUDE.md bleeds into Claude sessions, its CLI phones home by default, and its dev server
   listens on every interface: all three must be handled in any repo that adopts it.
