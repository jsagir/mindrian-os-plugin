---
name: mindrian-mcp-app
description: House rules for any MCP App (ext-apps UI) in the MindrianOS plugin. Read before /mcp-apps:create-mcp-app, before adding or changing a tool with a UI (decision card, rooms view, startup, dashboard, wiki, graph), before touching lib/mcp/app-html, app-views.cjs, gate-app.cjs or room-app.cjs, and before editing CSP, fonts or the Larry identity header. The generic builder scaffolds a new Vite + TypeScript server; this repo never does that. Auto-loaded during MCP app work.
connector:
  excluded: true
  reason: "Reference skill. It reaches no Decision-Gate fork of its own; the gates it describes belong to gate_render, gate_answer, chain_run, room_create and room_startup."
---

# MCP Apps in MindrianOS: the house pattern

The `/mcp-apps:create-mcp-app` skill teaches the generic way to build an MCP App:
a new server, Vite, `vite-plugin-singlefile`, `tsx`, the split SDK v2 packages.
None of that applies here. MindrianOS already has one MCP server and a shipped
app pattern. Every new UI is one more HTML template plus one more resource
registration on that server. Follow this file; use the generic skill only for
the ext-apps client API (`App` handlers, `ontoolresult`, host context, CSP keys).

## What the generic builder gets wrong for this repo

| Generic skill says | MindrianOS does |
|---|---|
| Create a new server with `registerAppTool` / `registerAppResource` | Register on the existing server: `scripts/mindrian-mcp-server.cjs` (stdio + Streamable HTTP on one `McpServer`). Tool modules live in `lib/mcp/tools/*.cjs` and export `register(server, ctx)`. |
| `npm install @modelcontextprotocol/client|server|node|express@^2` | Never. The server runs on `@modelcontextprotocol/sdk ^1.29` plus `@modelcontextprotocol/ext-apps ^2.0.3`, both already in `package.json` and `npm-shrinkwrap.json`. Adding a package means updating the shrinkwrap and passing `scripts/release-lib/shrinkwrap-gate.sh`. |
| Vite build, `mcp-app.html` bundled from `src/` | No build step on the user's machine. The UI is a plain HTML file in `lib/mcp/app-html/`, read at request time by `loadTemplate()` in `lib/mcp/app-views.cjs`. Inline CSS and JS only. |
| `tsx`, TypeScript server files | Hooks and the MCP server stay `.cjs` (CLAUDE.md, Conventions). |
| Load the ext-apps client from a bundle | The page loads the SDK from `https://cdn.jsdelivr.net/npm/@modelcontextprotocol/ext-apps@2.0.3/dist/src/app-with-deps.js`, through `lib/mcp/app-identity.js`'s `connect()`. Keep the pinned version in step with `package.json`. |
| Fonts from Google Fonts | Fonts are bundled: `lib/mcp/room-assets.cjs` inlines Figtree and DM Sans from `lib/mcp/assets/*.woff2` (OFL, sources in `FONT-SOURCES.md`) as base64 `@font-face`. Never fetch a replacement font. |

## The pattern, file by file

- `lib/mcp/app-html/<view>.html`: the template. `decision.html` (gate card),
  `rooms.html` + `rooms.css` (room picker, first room, returning workday),
  `dashboard.html`, `wiki.html`, `graph.html`, `mindrian-platform.html`.
- `lib/mcp/app-views.cjs`: `loadTemplate(filename)` injects the De Stijl tokens
  (`skills/ui-system/design-system/mos-design-system.css` for the decision card),
  `IDENTITY_CSS`, the Larry identity header, `theo-faces.cjs` and
  `app-identity.js` into the page. It also registers the dashboard, wiki and
  graph apps (`registerAppTool` + `registerAppResource`).
- `lib/mcp/gate-app.cjs` and `lib/mcp/room-app.cjs`: the two-function
  registration shape for a tool-attached app. Copy it for a new view:
  - `URI = 'ui://mindrian-os/<view>/v<N>.html'` (bump the version when the
    contract changes; hosts cache by URI).
  - `TOOL_META = Object.freeze({ ui: { resourceUri: URI, visibility: ['model', 'app'] } })`.
  - `registerXApp(server)` guarded by a `WeakSet` and by
    `typeof server.registerResource === 'function'` (test registrars expose
    tools only). It calls `registerAppResource(server, name, URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({ contents: [...] }))`.
  - CSP goes INSIDE `contents[i]._meta.ui.csp` (`resourceDomains`,
    `connectDomains: []`), never in the config object. Today's allowed
    `resourceDomains`: `https://cdn.jsdelivr.net` (and `data:` for the inlined
    fonts). The dashboard/wiki/graph views also allow the Google Fonts domains
    and, for the graph, `https://cdnjs.cloudflare.com`. Do not widen this list
    without a reason in the plan.
- The tool side: `server.registerTool(name, { title, _meta: TOOL_META, description, inputSchema }, handler)`.
  Every reply is `{ content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload }`
  so a host without UI still gets the text (the `textResponse` helper in
  `lib/mcp/tools/gate.cjs`, `chain.cjs`, `startup.cjs`).
- Client side (`app-identity.js`): register every handler before
  `app.connect()`; the page shows a Theo face state and a status line through
  `MindrianIdentity.setState(state, message)`; a failed or blocked SDK load
  degrades to the text result, never to a blank frame.

## Identity and copy

- Header on every view: one De Stijl glyph then `Larry | MindrianOS`, rendered
  by `theo-faces.cjs`. Host-neutral: no "powered by Claude" or any model name on
  the MCP surface (quick 261019-ey0; the host supplies the model).
- Plain English in Larry's voice, hyphens only, never an em-dash. "Data Room",
  never "ICM" on the UI.
- De Stijl tokens from the design system CSS; black is for borders, rules and
  text, never a fill.

## Governance every new tool or view must clear

1. **HITL shape declaration (Canon Part 11 R16).** Export a `connectors` array
   from the tool module with `tool, surface, connector: 'mcp-tool', hitl_shape,
   hitl_why, layer, layer_why` (see `lib/mcp/tools/startup.cjs`). A write that
   needs approval is `F.0`; a next-move choice is `F.1`.
2. **Born-wired gates.** `node scripts/build-connector-registry.cjs --check`,
   `node scripts/build-orchestration-projection.cjs --check`,
   `node scripts/check-render-coverage.cjs` must stay green.
3. **Tool-schema budget.** `tests/test-270-tool-schema-budget.cjs` pins the
   live `tools/list` count and byte size. A new tool fails it until the AFTER
   constant is re-baselined IN THE SAME CHANGE, measured live by the file's own
   `listToolsOverStdio` + `measure()` pair, with a dated doc block naming the
   commit and every tool in the delta (last: quick 261019-k22, 48 -> 50 for
   `room_create` + `room_startup`). It is a release-gate suite leg.
4. **Server instructions budget.** `lib/mcp/no-instructions.test.cjs` caps the
   served `instructions` at 2000 bytes (hosts cut at 2048) and freezes the Part 8
   boundary paragraph as the last thing served. Do not grow `RUNTIME_INSTRUCTIONS`
   past it.
5. **Part 8.** Nothing from a room reaches `brain_*` or Theo; a view may show
   room content, it may not send it anywhere but the host.
6. **Part 9.** Room writes go through `lib/core/navigation.cjs` only. A room is
   born only by `navigation.birthRoom` (see `lib/mcp/startup-operations.cjs`);
   never hand-build folders or `room.db`.
7. **Gate discipline.** A UI choice is answered by `gate_answer` exactly once,
   from the card's own option ids; `gate_render` mints the gate; the ledger
   replays an already-answered gate instead of re-running it; a retry after an
   unknown host response must not create a second room or a second decision
   node. No ASCII gate boxes anywhere.
8. **Room path containment.** Any path a view sends back is checked with
   `lib/core/room-path-containment.cjs` before use.

## Tests to extend (and wire into the phase `tests/run-all-<phase>.sh`)

- `tests/test-gpt-plugin-ui.cjs`: real MCP registration, normalized card,
  resource, identity, room view, fallbacks, governed-write policy.
- `tests/test-larry-theo-face-apps.cjs`: Playwright browser suite over the real
  Apps SDK (notifications, refresh, cancel, disconnect, blocked SDK, recovery,
  identity label, reduced motion, controls fit the frame at narrow widths).
- `tests/test-startup-flows.cjs`, `tests/test-room-first-entry.cjs`,
  `tests/test-371-startup-ui.cjs`: first-room preview and approval, returning
  workday memory, replay receipts, wrong-room refusal, fonts and CSP.
- `tests/test-267-mcpv2-app-views.cjs`: dashboard, wiki, graph views.
- Widths exercised today: 390 and 960 (screenshots land in the phase dir).
  Keyboard focus, forced colors, reduced motion and a no-JS fallback are part
  of the 371 acceptance (`bash tests/run-all-371.sh`, Node 24).

## Local testing

The generic skill's `basic-host` works here: run the server with
`MINDRIAN_TRANSPORT=http node bin/mindrian-mcp-server.cjs`, then point
`basic-host` at it. The real hosts are Claude Desktop, Cowork and ChatGPT
(Codex); a host that declares `io.modelcontextprotocol/ui` gets the app, one
that declares elicitation gets the native card, anything else gets text
(`detectGateCapabilities` in `lib/mcp/gate-render.cjs`).

## Where the current work is written up

- `docs/GPT-PLUGIN-UI.md`: setup, the ChatGPT connection, state and limits,
  room-first entry, first room and returning workday, the Phase 371 lifecycle.
- `.planning/phases/371-navigator-startup-ui-first-room-and-returning-workday/`:
  UI spec, research, plans, reviews, UAT, verification, acceptance log and
  screenshots. As of 2026-10-19 the phase is `human_needed`: 7 of 8 requirements
  pass locally; the real-ChatGPT checkpoint (`371-UAT.md`) is still open and must
  not be closed by a local iframe run.
- Quick tasks that built the surface: 261019-ey0 (decision card, host-neutral
  identity), 261019-fhe (room-first entry), 261019-k22 (budget re-baseline).

## Live inventory (2026-10-19, v2.0.0-beta.70 placeholder, 50 tools)

| App URI | Template | Tools carrying its `TOOL_META` |
|---|---|---|
| `ui://mindrian-os/decision/v1.html` | `decision.html` | `gate_render`, `gate_answer`, `chain_run` |
| `ui://mindrian-os/rooms/v4.html` | `rooms.html` | `room_list` (entry), `room_create` (F.0), `room_startup` (F.1) |
| dashboard / wiki / graph URIs in `app-views.cjs` | `dashboard.html`, `wiki.html`, `graph.html` | `room-dashboard`, `room-wiki`, `room-graph` |
