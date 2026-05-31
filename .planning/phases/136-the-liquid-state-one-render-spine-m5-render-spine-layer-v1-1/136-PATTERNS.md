# Phase 136: The Liquid State - One Render Spine (M5 render-spine layer) - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 17 (5 EXTEND, 3 REUSE, 9 NET-NEW)
**Analogs found:** 14 with a verified live analog / 17 total (3 net-new have only a structural precedent, not a role+flow analog)

> Verification note: every analog below was read against the LIVE code this session (not taken on faith from RESEARCH.md). Line numbers and signatures are from the current files. No em-dashes (project hard rule; hyphens only).

---

## File Classification

| New/Modified File | Disposition | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|-------------|------|-----------|----------------|---------------|
| `lib/render/render-v2.cjs` | EXTEND | engine/renderer | transform (shape x delivery) | itself (extend in place) | exact (self) |
| `lib/core/room-db.cjs` | EXTEND | data-access/db-opener | file-I/O (SQLite open) | `openRoomDb` (same file, lines 91-114) | exact (self) |
| `lib/core/navigation.cjs` | EXTEND | service/chokepoint | request-response + pub-sub | itself (13-fn re-export surface) | exact (self) |
| `lib/render/sse/read-api.cjs` | NET-NEW (thin) | route/transport | streaming (SSE) + event-driven | `lib/wiki/wiki-watcher.cjs` + `wiki-server.cjs` `/api/sse` | exact (role + flow) |
| `lib/core/navigation/focus.cjs` | REUSE as-is | service helper | event-driven (focus_changed) | itself (setFocus, lines 36-81) | exact (self) |
| `lib/tui/boot.cjs` (App) | NET-NEW | component/entry | event-driven (SSE client) | `bin/mindrian-tools.cjs` (entry shape only) | structural precedent only |
| `lib/tui/tree.cjs` | NET-NEW | component | request-response (read graph) | `lib/wiki/wiki-server.cjs` graph view (read+render) | partial (read-render shape) |
| `lib/tui/detail.cjs` | NET-NEW | component | request-response | none (ink-specific) | structural precedent only |
| `lib/tui/slot.cjs` | NET-NEW | component | event-driven (LazyGraph whisper) | `render-v2.cjs` Zone 3 signals (lines 346-348) | partial (zone semantics) |
| `lib/tui/breadcrumb.cjs` | NET-NEW | component | request-response | `render-v2.cjs` Zone 1 header | partial (zone semantics) |
| `lib/tui/footer.cjs` | NET-NEW | component | request-response | `render-v2.cjs` Zone 4 footer (lines 350-358) | partial (zone semantics) |
| `lib/tui/gate.cjs` (multi-select + free-text) | NET-NEW/MIRROR | component/selector | request-response + write | `lib/hmi/selector-dispatcher.cjs` + `shape-fN-renderer.cjs` family | role-match (mirror) |
| `references/visual/palette.json` | EXTEND | config/token-source | transform (token graph) | itself (base + extended hues) | exact (self) |
| `skills/ui-system/SKILL.md` | EXTEND | config/ruling-doc | n/a (doc) | itself (Section 3 glyphs + Section 4 colors) | exact (self) |
| `scripts/check-tokens.cjs` | NET-NEW (idiom reused) | utility/CI-linter | batch (grep scan) | `scripts/check-substrate.cjs` | role-match (grep-gate idiom) |
| `bin/mindrian-tools.cjs` (add `tui` / `launch` cases) | EXTEND | route/CLI-entry | request-response (subcommand) | itself (switch at line 89) | exact (self) |
| `lib/launcher/{detect,compose,tmux-hooks}.cjs` | NET-NEW | service/launcher | event-driven (host probe + hooks) | none (zero multiplexer precedent) | NO ANALOG (see below) |
| BUD delegation (D-03) | DELEGATE | service call | request-response | `lib/core/room-auto-create.cjs::autoCreatePlaceholderRoom` | role-match (see Open Question) |

---

## Pattern Assignments

### `lib/render/render-v2.cjs` (engine, transform: shape x delivery) - EXTEND

**Analog:** itself. This is the single inline 4-zone formatter (Phase 102). The phase extends its `render(args)` entry into the `shape x delivery` engine. Do NOT fork a parallel formatter (Canon Part 7; RESEARCH Reuse ledger row 1).

**Entry signature to extend** (lines 112-122):
```javascript
function render(args) {
  args = args || {};
  let zones = args.zones || {};
  const mode = args.mode || 'A';
  const operator = args.operator || null;
  const tier = (args.tier === undefined || args.tier === null) ? 1 : args.tier;
  const jtbd = args.jtbd || null;
  const tokenBudget = args.tokenBudget || { used: 0, total: 1 };
  const roomDir = args.roomDir || process.env.MINDRIAN_ROOM_DIR || process.cwd();
  // ADD HERE: args.shape (deck|mermaid|wiki|grid|dashboard|snapshot)
  //           args.delivery (inline|web|tui|file)
```
The existing args object is the extension seam - add `shape` + `delivery` as two more destructured fields with defensive defaults (the file's whole design is "defensive defaults so {} or undefined cannot crash the formatter", line 30). A new `engine.cjs` shape x delivery router is OPTIONAL per RESEARCH (only if render-v2 grows too large).

**Numbered-hook discipline** (lines 124-127): the file documents "the numbered markers MUST stay so follow-on plans land at the right spot." Phase 136 adds its shape-dispatch as a new numbered step, it does NOT renumber the existing 1-8 compaction/JTBD/provenance hooks.

**4-zone compose pattern to reuse for inline delivery** (composeZones, lines 325-361): Zone 1 header, Zone 2 body, Zone 3 signals (`▷ ` prefix, lines 346-348), Zone 4 footer. The TUI components (Breadcrumb/Tree+Detail/Slot/Footer) map 1:1 onto these 4 zones (UI-SPEC Ruling Extension).

**JTBD -> CLI color map to reuse** (JTBD_CLI_COLOR, lines 64-78; ANSI, lines 87-94): the 5-color contract (red/yellow/cyan/green/gray). The token core (D-14) extends this, it does not replace it. TTY-gating idiom at line 200-201 (`process.stdout.isTTY === true`) is the model for keeping non-TTY captures byte-clean.

**Canon Part 8 by construction** (lines 207-230): the renderer NEVER calls Brain and builds a LOCAL-only `_provenance` envelope with scalar passthroughs only. Any new shape dispatch must preserve this (no user-content into provenance).

---

### `lib/core/room-db.cjs` (db-opener, file-I/O) - EXTEND

**Analog:** `openRoomDb` in the same file (lines 91-114).

**The opener to mirror** (lines 91-114) - WAL is ALREADY set at line 100:
```javascript
function openRoomDb(roomDir) {
  auditBypassIfNeeded(roomDir);              // soft-defense MUST be first
  const resolved = path.resolve(roomDir);
  const dbDir = path.join(resolved, '.mindrian');
  const dbPath = path.join(dbDir, 'room.db');
  fs.mkdirSync(dbDir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');       // <-- WAL already on (line 100)
  db.exec('PRAGMA foreign_keys = ON');
  lazygraph.initSchema(db);
  memory.initMemorySchema(db);
  if (runPhase109NodesProvenance) runPhase109NodesProvenance(db);
  runPhase109SessionFocus(db);
  return db;
}
```

**What D-02/D-10 adds** (additive, do NOT change the writer's schema work):
- a new `openRoomDbReadOnly(roomDir)` that opens `new DatabaseSync(dbPath, { readOnly: true })` (RESEARCH A2: the option was accepted by Node 22.22.2 this session). It must NOT run the migrations (a read-only handle cannot write schema). It SHOULD call `auditBypassIfNeeded` first, same as the writer.
- the WRITER `openRoomDb` gains two pragmas after line 100: `db.exec('PRAGMA busy_timeout = 5000')` and `db.exec('PRAGMA synchronous = NORMAL')`.
- export both from the `module.exports = { openRoomDb, closeRoomDb }` line (line 127).

**`closeRoomDb` is already tolerant** (lines 116-125) of both the bare handle and the legacy `{db}` shape - reuse it for the read-only handle close.

---

### `lib/core/navigation.cjs` (service chokepoint, request-response + pub-sub) - EXTEND

**Analog:** itself - the 13-function closed surface (Phase 109). It is the ONLY door to room.db (M1 Substrate Contract, Canon Part 9).

**The additive-re-export idiom to copy** (lines 76-94, and repeated through line 176): every extension since Phase 109 is "a thin re-export so [caller] can [do X] without reaching into the internal navigation/*." Example (writeEdge, lines 89-94):
```javascript
  // Edge-write primitive (Phase 125-00 ... Plan 06 selector-decisions.cjs is the first consumer ...
  //   Same additive-re-export pattern as logMemoryEvent + firstCapturedLastTouchedBySection.)
  writeEdge: edges.writeEdge,
```
Phase 136 follows this exact idiom to add:
- a read-only open re-export (D-02) - mirror the `openRoomDbForCaller` / `closeRoomDbForCaller` pair already present at lines 134-135 (Phase 135-01), which is the precedent for "hand a caller a room.db handle through the allow-listed chokepoint." Add `openRoomDbReadOnlyForCaller` the same way.
- thin SSE-read accessors (D-10) - these wrap the existing read functions (`getNeighborhood` line 50, `findRecentChanges` line 61, `getRoomHomeView` line 71, `findSurfaceableTensions` line 58) and shape their output to the enum/handle-only SSE payload.

**Read functions already on the surface that the SSE read-API + TUI consume** (no new graph code needed):
- `getNeighborhood` (line 50) - cross-wall edges + fractal tree neighborhood. Signature: `getNeighborhood(db, focusNodeId, opts)` (neighborhood.cjs:48).
- `findRecentChanges` (line 61) - the temporal stream the LazyGraph intent-filters (D-07).
- `findSurfaceableTensions` (line 58) + `findContradictions` (line 54) - the `⚠` tension rows + the slot whisper (D-08).
- `setFocus` (line 47) / `getActiveFocus` (line 46) - zoom + two-way sync (see focus.cjs below).
- `writeEdge` (line 94) - the gate's typed DECISION / FREE_TEXT writes (see gate.cjs below).
- `confirmNode` (line 147) - human-confirms-truth promotion (if the gate confirms a truth-claim node).

**Allow-list note:** `scripts/check-substrate.cjs` (lines 63-85) exempts `^lib\/core\/navigation\//` and `^lib\/core\/navigation\.cjs$`. The new read-only opener code MUST live inside `lib/core/navigation/` (or be re-exported through navigation.cjs) or it trips the `m3-direct-sqlite-require` / `opengraph-bypass` rules. The new TUI / SSE / launcher files are NOT allow-listed, so they must reach room.db ONLY through navigation.cjs.

---

### `lib/render/sse/read-api.cjs` (route/transport, streaming SSE + event-driven) - NET-NEW (thin)

**Analog:** `lib/wiki/wiki-watcher.cjs` (the SSE client registry + broadcast) + `lib/wiki/wiki-server.cjs` (where it mounts). This is the single net-new file with an EXACT role+flow analog.

**SSE client registry + broadcast to reuse verbatim** (wiki-watcher.cjs, lines 13, 62-103):
```javascript
const sseClients = new Set();

function addSSEClient(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(':keepalive\n\n');
  sseClients.add(res);
  res.on('close', () => { removeSSEClient(res); });
}

function broadcast(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(message); }
    catch (e) { sseClients.delete(client); }   // disconnected -> drop
  }
}
module.exports = { startWatcher, addSSEClient, removeSSEClient };
```

**chokidar watcher to reuse verbatim** (wiki-watcher.cjs, lines 21-55): `chokidar.watch(absRoom, { ignoreInitial: true, ignored: [/\.mindrian/, ...], awaitWriteFinish: {...} })`, filter `.md` changes, then `broadcast({ event: 'change', path: relPath, type: event })`.

**How it mounts on the EXISTING express app** (wiki-server.cjs, lines 140-143; the anti-pattern is a SECOND server):
```javascript
  // ── Route: API - SSE (live via chokidar watcher) ──
  app.get('/api/sse', (req, res) => {
    addSSEClient(res);
  });
```
Phase 136 mounts `app.get('/api/room/sse', ...)` the same way, on the `app` returned by `startWikiServer` (wiki-server.cjs line 27, 617). The watcher is already started at wiki-server.cjs lines 608-611 - reuse it, do not start a second one.

**Part 8 payload constraint (D-10, RESEARCH Pitfall 4):** the SSE payload schema is `{event_type, node_id, node_type, review_status}` enums/handles ONLY. NEVER artifact bodies, meeting text, or identifiers. The existing `wiki-watcher.broadcast` sends only `{event, path, type}` (a relative path) - the new room SSE must be even tighter (no path; node-id + enum only), because `check-substrate.cjs` + `brain-boundary-scan` run on the new file.

**HTML-escape for any user-derived bytes that DO reach the web twin** (wiki-server.cjs `escHtml`, lines 663-669) - reuse, do not hand-roll (ASVS V5).

---

### `lib/core/navigation/focus.cjs` (service helper, event-driven) - REUSE AS-IS

**Analog:** itself - `setFocus` (lines 36-81). Zoom (D-04) and two-way sync (D-05) are BOTH a `setFocus` call. No new event type, no new code in this file.

**The zoom write pattern** (focus.cjs lines 36-81; called via navigation.cjs `setFocus`):
```javascript
function setFocus(db, sessionId, nodeId, setBy) {
  if (!VALID_SET_BY.has(setBy)) return { ok: false, reason: 'invalid_set_by' };
  const nodeType = lookupNodeType(db, nodeId);
  if (!nodeType) return { ok: false, reason: 'unknown_node' };
  // ... INSERT OR REPLACE INTO session_focus ...
  // ... INSERT INTO nodes (... 'memory_event' ... 'system' ... 'confirmed' ...) // focus_changed
}
```
`VALID_SET_BY` (line 13) = `{'user','larry','auto-from-jtbd','auto-from-operator','auto-from-state'}`. An explicit TUI zoom uses `setBy = 'user'` (RESEARCH Code Example line 418).

**Audit-node carve-out is already documented in this file** (lines 61-70): the focus_changed memory_event is a system-bookkeeping node, `created_by=system review_status=confirmed`, EXEMPT from the human-confirm rule (Canon Part 9 v1.5). Zoom needs NO human confirm. Do not re-derive this - it is canon-legal as shipped.

**Two-way sync read** (D-05): Larry's next inline turn reads `getActiveFocus(db, sessionId)` (lines 15-29) to render "the node you are on." The TUI writes the focus, the inline surface reads it - one event, both surfaces.

---

### `lib/tui/gate.cjs` (component/selector, request-response + write) - NET-NEW / MIRROR

**Analog:** `lib/hmi/selector-dispatcher.cjs` + the `shape-fN-renderer.cjs` family. The gate is the >4-options / persistent variant of the Part 3 Shape F selector. Do NOT invent a bespoke selector (RESEARCH Don't-Hand-Roll; UI-SPEC line 189).

**The dispatch contract to mirror** (selector-dispatcher.cjs `pickShape`, lines 657-758): returns `{ shape, rendered: { zones, contract } }` where `contract.verbs` is the option list. render-v2 already consumes exactly this shape (render-v2.cjs lines 145-170 pull `result.rendered.contract.verbs`).

**The Free-Text invariant to copy** (selector-dispatcher.cjs `ensureFreeTextLast`, lines 216-227): Free-Text is ALWAYS the last verb (Part 3, the "always-present open-text" of D-13), EXCEPT closed-vocab shapes that set `contract.freeTextOffered === false`. The 136 gate is an OPEN-vocab multi-select, so Free-Text is always offered and always last.

**The closed verb vocabulary** (the 10 MindrianOS-native verbs, Canon Part 3): each toggled option becomes a typed `DECISION` edge, the open-text becomes a `FREE_TEXT` edge (D-13). The verb-alias collapse before persistence is `aliasToCanonical(verb, aliasMap)` (selector-dispatcher.cjs lines 121-129) - aliases render to the user, canonical verbs persist to the graph.

**The write primitive** (the gate's "commit" path): `navigation.writeEdge(db, params)` (edges.cjs `writeEdge`, line 146; allow-list `ALLOWED_EDGE_TYPES` Set, lines 32+). NOTE: the current `ALLOWED_EDGE_TYPES` does NOT yet contain `DECISION` or `FREE_TEXT` - it has `DEFERRED, REJECTED, DERIVED_FROM, FILED_AS_DECISION, FOLLOWS_FROM, OPERATOR_TRANSITION, ...` Phase 136 extends the Set additively (the file's whole history is additive edge-type extension, see the per-type comment blocks at lines 32-101). This is a planned net-new on an existing allow-list, mirroring the Phase 120/125/129 additive idiom.

**Inline vs richer-widget split** (D-13, UI-SPEC line 235): when options <=4 and non-persistent, the inline gate is native AskUserQuestion in the Claude Code pane (no widget). When >4 or persistent, the richer ink widget renders in `mos tui` + the web twin. The selector-dispatcher's F.1..F.7 sub-shapes are the inline gate; gate.cjs is the ink rendering of the same contract.

---

### `references/visual/palette.json` (config/token-source, transform) - EXTEND

**Analog:** itself. The Phase 121.5 token seed.

**Current structure to extend** (palette.json, lines 5-41): `base` (9 named hues incl. `mondrian_blue #1E3A6E`, `mondrian_yellow #C8A43C`, `amethyst #6B4E8B`, `success_green #2D6B4A`, `mondrian_black #0D0D0D`, `cream #F5F0E8`), `palette_a_discovery`, `palette_b_build`, `extended` (incl. `sienna #B5602A`, `surface #1A1A1A`), `ansi_5_color`.

**What D-14 adds:** a surface-agnostic token graph of contrast-checked semantic color PAIRS (base hue + terminal-legible variant), each glyph-backed. The 8 pairs + their terminal variants are fully specified in UI-SPEC "Semantic color PAIRS" table (e.g. `success_green #2D6B4A` -> `t-green #5BBF8A`, contrast 8.57). The 4 new glyphs (`◇ ○ ☑ ☐`) are also added here as a vocabulary block.

**Provenance + derived-files discipline to honor** (lines 4, 42-53): palette.json declares `derived_files` (visual-ops.cjs, banner, destijl-base.css, JTBD-PALETTES.md) and `deferred_consumers`. Any new token added must record its consumers or be listed as deferred - the file's own rule is "captured as deferred so the audit trail records that ... divergence was SEEN, not silently passed" (line 51). render-v2.cjs is ALREADY listed as a deferred consumer (line 52) - Phase 136 promotes it to wired.

---

### `skills/ui-system/SKILL.md` (config/ruling-doc) - EXTEND

**Analog:** itself - Section 3 Symbol Vocabulary (lines 247-264, the 12-glyph table) + Section 4 Color Contract (lines 291-321, the 5-ANSI contract + the dual-palette surface-routing table at line 319).

**Glyph table to extend** (lines 251-264): 12 rows, "One meaning each. No overloading." Phase 136 adds exactly 4 rows (`◇ ○ ☑ ☐`) per D-14. The `NO EMOJI. EVER.` rule (line 266) and its position-anchored statusline carve-out (line 268) are the template for the D-14 decision to EXTEND the ruling to the TUI surface rather than except it (UI-SPEC Ruling Extension).

**Color routing table to extend** (line 319-321): the table already has a `CLI / TUI | 5-color semantic` row. Phase 136 adds the terminal-legible dark-surface variant tier as a third routing row (UI-SPEC).

**Dog-food mandate (Canon Part 6):** any SKILL.md change MUST update `docs/CANON-PHASE-MAP.md` in the SAME commit (UI-SPEC Ruling Extension; the map's own forward-compatibility rule). The carve-out cross-references `skills/ui-system/rules/glyph-disambiguation.md` (line 289) - that rules/ dir (`dual-palette.md`, `glyph-disambiguation.md`, `shape-f-zero-and-six.md`) is where a `tui-glyphs.md` rule could land if the glyph set needs its own rule file.

---

### `scripts/check-tokens.cjs` (utility/CI-linter, batch grep) - NET-NEW (idiom reused)

**Analog:** `scripts/check-substrate.cjs` (the grep-CI-guard). The new linter is net-new code but copies this file's idiom wholesale (RESEARCH Don't-Hand-Roll; Reuse ledger).

**The grep-gate idioms to copy:**
- per-line matcher + `scanLine` (check-substrate.cjs lines 147-179): a pure per-line function returning `{rule, match}` hits.
- pure `scanFiles(files, readContent)` + `scanRepo()` (lines 188-204, 336-348): hermetic, testable, no `process.exit` in the API.
- staged-diff net-new mode `scanStagedDiff()` (lines 276-311): flags ONLY lines the staged diff ADDS (so editing a file with baselined debt is not blocked). check-tokens should mirror this so it blocks NEW hardcoded hex/glyphs, not pre-existing ones.
- CLI modes (lines 376-411): `--baseline` (informational, exit 0) / `--diff` (blocking, exit 1) / programmatic exports (lines 413-421).
- allow-list regex array (lines 63-85): `palette.json` + `visual-ops.cjs` + `JTBD-PALETTES.md` are the legitimate token sources and must be allow-listed (they CONTAIN the hex values by definition).

**What check-tokens enforces (D-14, Req 7):** fail on a hardcoded hex (`#RRGGBB`) or a raw glyph outside the allow-listed token sources; assert each semantic pair clears WCAG 3:1 (UI) / 4.5:1 (text); the meta/hint pair restricted to the `#0D0D0D` background only (UI-SPEC color caveat, the 2026-05-31 UI-checker FLAG).

---

### `bin/mindrian-tools.cjs` (route/CLI-entry, request-response) - EXTEND

**Analog:** itself - the switch-case router (line 89; pattern declared at lines 5-7 "GSD gsd-tools.cjs ... switch-case routing, async main, catch"). VERIFIED: no `tui` / `mos` / `launch` / `watch` case exists yet (grep returned exit 1).

**The case idiom to copy** (e.g. lines 90-122, the `room` command with nested subcommand switch):
```javascript
  switch (command) {
    case 'room': {
      switch (subcommand) {
        case 'list-sections': {
          const result = roomOps.listSections(roomDir);
          output(result, raw, JSON.stringify(result));
          break;
        }
        // ...
```
Phase 136 adds `case 'tui':` and `case 'launch':` (or a `mos` umbrella) per RESEARCH Code Example (lines 406-411). KEY CONSTRAINT (D-12): the require MUST be lazy/in-case so ink/launcher code never loads for the seamless base:
```javascript
    case 'tui':    return require('../lib/tui/boot.cjs').bootTui(roomDir);
    case 'launch': return require('../lib/launcher/compose.cjs').launch(roomDir);
```
Top-level requires (lines 13-24) are eager - do NOT add ink/launcher there. The boot.cjs `await import('ink')` lazy-load lives inside the case target, not here.

**USAGE block to extend** (lines 26-71): add the two new subcommands to the heredoc usage string (the file's own discipline - every command is documented there).

---

## Net-New Files With No Role+Flow Analog

These three surfaces are genuinely net-new (RESEARCH: "the genuinely net-new surfaces are exactly three"). The planner should use the RESEARCH patterns + the structural precedents below, not a codebase analog.

### `lib/tui/boot.cjs` + the ink component tree (`tree/detail/slot/breadcrumb/footer.cjs`)
- **Why no analog:** ink (React-for-terminal) is the first TUI dependency in the repo (D-01, the "first justified break of zero-TUI-dependency"). No JSX, no build step, lazy `await import('ink')` from CJS.
- **Structural precedent for the entry shape:** `bin/mindrian-tools.cjs` (the CJS entry + lazy-require pattern, lines 5-7, 73-89).
- **Buildable boot pattern (PROVEN this session, RESEARCH Pattern 1):**
```javascript
// lib/tui/boot.cjs - CJS, no JSX, no build step.
async function bootTui(roomDir) {
  const { render, Box, Text, useInput, useApp } = await import('ink'); // ESM, lazy
  const React = require('react');                                       // CJS-compatible
  const e = React.createElement;
  const App = () => {
    const { exit } = useApp();
    useInput((input, key) => { if (input === 'q') exit(); });           // q quits
    return e(Box, { flexDirection: 'column', borderStyle: 'round' },
      e(Text, { color: 'green' }, 'MindrianOS navigator'));
  };
  const { waitUntilExit } = render(e(App));                             // ink restores terminal on exit
  await waitUntilExit();
}
module.exports = { bootTui };
```
- **Graceful-degrade requirement (Req 2/4 acceptance):** wrap the dynamic `import('ink')` in try/catch and emit the UI-SPEC ink-absent notice (`[mos tui] ink not installed. The seamless inline + web surfaces work without it.`, exit code 2). The seamless base must work with ink physically removed.
- **Component-to-zone map (UI-SPEC):** Breadcrumb=Zone1, Tree+Detail=Zone2, Slot=Zone3, Footer=Zone4. Each component is a pure SSE-read client (consumes `lib/render/sse/read-api.cjs`); NONE opens room.db (D-10; check-substrate enforces).
- **Read seam:** the tree/detail data come from `navigation.getNeighborhood` (neighborhood.cjs:48 `getNeighborhood(db, focusNodeId, opts)`) shaped into the enum/handle SSE payload; the slot whisper comes from `findRecentChanges` + `findSurfaceableTensions` intent-filtered (D-07).

### `lib/launcher/{detect,compose,tmux-hooks}.cjs` (detect-and-adapt launcher)
- **Why no analog:** zero tmux/wezterm/zellij/mprocs precedent anywhere in the repo (verified - the SEED grep + RESEARCH both confirm).
- **Structural precedent:** none in-repo. Use RESEARCH Pattern 4 (the probe-order function) verbatim:
```javascript
// lib/launcher/detect.cjs
function detectHost() {
  if (process.platform === 'win32') {              // Windows route (D-11)
    if (which('wezterm')) return 'wezterm';
    if (which('mprocs'))  return 'mprocs';
    return 'web';
  }
  if (process.env.WEZTERM_PANE) return 'wezterm';  // WezTerm if running
  if (which('zellij'))          return 'zellij';   // zellij if installed
  if (which('tmux'))            return 'tmux';      // tmux scripted default
  return 'web';                                    // no multiplexer -> web twin
}
```
- **Cross-platform discipline (D-15, RESEARCH Pitfall 6):** `path.join` / normwin; `where` on win32, not `command -v`; tmux is Unix-only.
- **$TMUX-aware (RESEARCH Pitfall 5):** if `process.env.TMUX` is set, `tmux new-window`/`split-window` against the current session; never `tmux new-session`.
- **tmux hooks emit focus_changed:** `set-hook pane-focus-in` runs a shell command that writes a `focus_changed` memory_event - route it through `navigation.setFocus` (focus.cjs), never a direct sqlite write. (RESEARCH A4: tmux hook firing is MEDIUM-confidence, not live-tested - flag for execution-time verification; web-twin fallback covers the no-tmux case.)
- **Follow the CONTEXT, not the mockup:** the `mindrian-tui-achievable.vercel.app` mockup frames a "zellij workspace"; D-11 LOCKS tmux-scripted as default with zellij only "if installed" (RESEARCH Anti-Pattern; UI-SPEC line 51).

---

## Shared Patterns

### Single room.db door (Canon Part 9 / M1 Substrate Contract)
**Source:** `lib/core/navigation.cjs` (the only door); enforced by `scripts/check-substrate.cjs` (allow-list lines 63-85, rules `m3-direct-sqlite-require` / `opengraph-bypass` lines 108/118).
**Apply to:** EVERY new file (read-api.cjs, all of lib/tui/*, all of lib/launcher/*). None of these is allow-listed, so each MUST route room.db access through navigation.cjs. The read-only opener code itself lives inside `lib/core/navigation/` (allow-listed) so it can call `new DatabaseSync`.

### Additive-re-export on the navigation surface
**Source:** `lib/core/navigation.cjs` lines 76-176 (every Phase since 109 added a thin re-export with a comment block citing the precedent).
**Apply to:** the D-02 read-only opener + the D-10 SSE-read accessors. Copy the comment-block idiom: "a thin re-export so [caller] can [X] without reaching into the internal navigation/*. Same additive-re-export pattern as logMemoryEvent / writeEdge."

### Additive edge-type allow-list extension
**Source:** `lib/core/navigation/edges.cjs` `ALLOWED_EDGE_TYPES` (lines 32-101); `writeEdge(db, params)` rejects any type not in the Set (lines 146-179).
**Apply to:** the gate's `DECISION` + `FREE_TEXT` edges (D-13). Add them to the Set with a per-type comment block citing Canon Part 4 + Part 8, mirroring the Phase 120/125/129 idiom.

### Part 8 boundary scan + LOCAL-only telemetry
**Source:** `scripts/check-substrate.cjs` (grep gate) + the telemetry idiom in `room-db.cjs::auditBypassIfNeeded` (lines 53-89: JSONL, sha256 room hash, scalar fields, never throws, opt-out env var) + selector-dispatcher telemetry (lines 277-345, "telemetry NEVER fails Larry's turn").
**Apply to:** the SSE read-API payloads (enum/handle only) + any new telemetry. `brain-boundary-scan` + `check-substrate.cjs` run on every new file (Req 12). No `fetch`/`http`/Brain calls anywhere in the new files (SSE is localhost-only, ASVS V9).

### Graceful-degrade / defensive-default everywhere
**Source:** `render-v2.cjs` (defensive defaults, lines 113-122) + `selector-dispatcher.cjs` `safeRequire` (lines 176-183) + the wiki SSE broadcast drop-on-disconnect (wiki-watcher.cjs lines 95-101).
**Apply to:** the ink lazy-import (try/catch -> notice + exit 2), the launcher host probe (fall through to web twin), the SSE client set (drop on write failure). Every new surface degrades, never crashes.

---

## Open Question Surfaced (planner action required)

### BUD callable target (D-03) - MEDIUM confidence, RESEARCH Open Question 1 / A3
**What was verified this session:**
- `lib/core/room-auto-create.cjs` EXISTS and exports `autoCreatePlaceholderRoom(roomsHome, opts)` (line 314-318). It is the codebase-canonical room.db bootstrap (it explicitly delegates to `room-db.cjs::openRoomDb` and emits a `room_auto_created` memory_event via the navigation chokepoint - exactly the atomic-create + wire pattern BUD needs).
- `lib/core/room-receipt-emit.cjs` EXISTS, exports `emitReceiptWritten(roomSlug, conversationId)` (line 63).
- `scripts/room-registry` EXISTS (bash; `create <name> <path> [venture_name] [venture_stage]` with atomic tmp+mv writes).

**What is NOT present:** a single shipped callable literally named "SEED-001 atomic sub-room contract." A grep for `SEED-001 / createSubRoom / sub_room / subroom` across lib/ + scripts/ found only `scripts/vault-wikilink-injector.cjs` (unrelated). The SEED-001 atomic-or-fail-closed 5-side-effect wiring named in memory `feedback_subroom_creation_wiring_contract.md` does not surface as one named function in the live tree.

**Recommendation (matches RESEARCH):** schedule a Wave 0 CONFIRM task. If a single SEED-001 sub-room callable is not shipped, BUD delegates to the room-creation orchestrator that DOES exist (`autoCreatePlaceholderRoom` + `scripts/room-registry create` + `room-receipt-emit`) and the navigator surfaces "bud / open as room" as a delegating action. Either way Phase 136 does NOT reimplement promotion (Canon Part 7; D-03). Do not let the planner assume a single `seedSubRoom()` exists - it must confirm or compose.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/tui/boot.cjs` + tree/detail/slot/breadcrumb/footer | ink components | event-driven | ink is the first TUI dep in the repo; no React-for-terminal precedent. Structural precedent: bin/mindrian-tools.cjs entry shape + RESEARCH Pattern 1. |
| `lib/launcher/detect.cjs` / `compose.cjs` / `tmux-hooks.cjs` | launcher | event-driven | Zero tmux/wezterm/zellij/mprocs precedent anywhere in the repo. Use RESEARCH Pattern 4 + D-11 probe order. |

---

## Metadata

**Analog search scope:** `lib/render/`, `lib/core/`, `lib/core/navigation/`, `lib/wiki/`, `lib/hmi/`, `references/visual/`, `skills/ui-system/`, `scripts/`, `bin/`.
**Files read in full this session:** render-v2.cjs, room-db.cjs, navigation.cjs, navigation/focus.cjs, wiki-watcher.cjs, wiki-server.cjs, selector-dispatcher.cjs, palette.json, check-substrate.cjs, bin/mindrian-tools.cjs (header + switch map), SKILL.md (Sections 3-4), edges.cjs (allow-list head), plus the 3 phase docs (CONTEXT/RESEARCH/UI-SPEC) and the Canon.
**Files probed (grep/head):** room-auto-create.cjs, room-receipt-emit.cjs, scripts/room-registry, neighborhood.cjs, edges.cjs.
**Pattern extraction date:** 2026-05-31
