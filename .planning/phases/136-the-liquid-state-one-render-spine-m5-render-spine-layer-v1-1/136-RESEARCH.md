# Phase 136: The Liquid State - One Render Spine (M5 render-spine layer) - Research

**Researched:** 2026-05-31
**Domain:** Terminal render engine + headless SSE core + opt-in ink TUI + detect-and-adapt launcher (cross-platform Node 22 CJS plugin)
**Confidence:** HIGH (the four deferred items are de-risked with live verification; the ink vendoring VERDICT is PROVEN end-to-end, not asserted)

## Summary

This is a milestone-scale render-spine phase. The four SPEC-deferred open items were the research targets, and all four are now answered with live evidence from this session.

The single highest-risk item - whether ink + its full transitive tree passes the pure-JS vendoring HARD GATE (D-12, release.sh Step 6.7) - **PASSES decisively**. A real `npm install ink@7.0.5 react@19.2.6` produced a 38-package, 19 MB tree with ZERO `.node` addons, ZERO `binding.gyp`, ZERO `.wasm` files on disk, and ZERO install/postinstall/preinstall lifecycle scripts. yoga-layout 3.2.1 ships its WASM as a **base64-inlined pure-JS ESM module** (`dist/binaries/yoga-wasm-base64-esm.js`, 120 KB) - no separate binary, no compile step. The only native-addon risk in the entire tree is `ws@8.21.0`'s `bufferutil`/`utf-8-validate`, and those are declared `optional: true` peerDependencies and were NOT installed. A pure-CJS boot harness (`require('react')` + `await import('ink')` + `React.createElement`, no JSX, no build step) rendered a bordered box and unmounted cleanly - proving the CLAUDE.md no-build-step constraint is satisfiable.

The remaining three items: the thin SSE read-API reuses the **existing** `lib/wiki/wiki-watcher.cjs` chokidar+SSE pattern verbatim (no second HTTP server); `lib/core/room-db.cjs:91` already sets `journal_mode = WAL` and needs only an additive `readOnly` open mode plus `busy_timeout`/`synchronous=NORMAL` (D-02/D-10); the detect-and-adapt launcher is genuinely net-new (zero tmux/wezterm/zellij precedent in the repo) and probes via env vars + `which`.

**Primary recommendation:** Proceed. Vendor ink 7 + react 19 + yoga 3 as the OPT-IN tui dependency tree; lazy-load via `await import('ink')` only inside the `mos tui` entry so the seamless base ships without it. Extend `render-v2.cjs` into the engine, extend `wiki-watcher.cjs`/`wiki-server.cjs` for the SSE read-API, extend `navigation.cjs`/`room-db.cjs` for the read-only handle, extend `palette.json` into the token core, and delegate BUD to the existing room-creation wiring. Decompose into 5 waves (below).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** TUI library = **ink** (React-based components). Maps to the single component source; the CI linter enforces token usage at the component layer. Pure-JS (vendorable). First justified break of "zero TUI dependency".
- **D-02:** Concurrency = **SQLite WAL + a read-only handle exposed by navigation.cjs**. `mos tui` opens room.db read-only; WAL lets the long-lived reader and a concurrent CC writer coexist. Live updates fire on a chokidar event, then re-read. navigation.cjs gains a read-only open mode (the only door, per M1).
- **D-03:** BUD = **delegate to the SEED-001 atomic sub-room contract** via navigation.cjs. The navigator surfaces "bud / open as room" and CALLS the existing atomic-or-fail-closed wiring; 136 does NOT reimplement promotion (Canon Part 7).
- **D-04:** ZOOM (re-root) = **persisted as a `focus_changed` memory_event** (reuse Phase 129.5 `lib/core/navigation/focus.cjs`). Audit-node carve-out: no human-confirm needed.
- **D-05:** Sync = **two-way via the `focus_changed` event**. A TUI selection/zoom writes the same focus event Larry's next inline turn reads. Reuses D-04.
- **D-06:** Wikilink authorship = **Larry proposes, founder approves** (`review_status: proposed` -> approval promotes). Same HITL gate as Phase 135.
- **D-07:** Intent = **FILTER the temporal stream, then temporal ranks within** ("intent gates, temporal ranks").
- **D-08:** Sidebar highlight = **in-place on the tree + whisper into the suggestion slot** (never reorder - M5 hard rule 1).
- **D-09 (render model flip):** SEAMLESS is the hard requirement. Universal default = **inline (4-zone + native AskUserQuestion) + web twin** (one command, live SSE), both zero-setup, identical Win/Mac/Linux. **`mos tui` is OPT-IN.**
- **D-10 (headless core + thin clients):** `navigation.cjs` is the single writer + sole room.db door, exposing a **thin SSE read API** over the **existing** express server. inline/web/tui are all thin clients - none opens room.db directly. Core pragmas: WAL, busy_timeout=5000, synchronous=NORMAL, single-writer, short reads.
- **D-11 (opt-in host = detect-and-adapt launcher):** navigation.cjs generates the workspace from the room graph (session=room, window=section, pane=surface). Host precedence: WezTerm if running, zellij if installed, else **tmux (scripted, `$TMUX`-aware)**; native Windows -> **WezTerm/mprocs**; web-twin fallback. tmux hooks (window/pane focus) emit `focus_changed` memory_events. NOT zellij-as-default.
- **D-12 (ink, buildless, lazy):** ink via **`React.createElement` (no JSX, no build step)**; ink deps **lazy/opt-in**; the ink tree must pass the **vendoring re-audit** (pure-JS/WASM only; yoga WASM; no native addon).
- **D-13 (gate = write node):** Native AskUserQuestion (<=4 options) inline; richer widget (>4 / persistent) in tui (split+zoom) + web. Arrow + Space-toggle multi-select + always-present open-text + Enter commits the set; each pick a typed `DECISION` edge, open-text a `FREE_TEXT` edge; live "would write to room.db" preview; confirm fans one memory_event to every surface.
- **D-14 (token core):** Extend palette.json into surface-agnostic token graph of **contrast-checked semantic color PAIRS** (WCAG 3:1 UI / 4.5:1 text); **color always glyph-backed**; add 4 TUI glyphs (`◇ ○ ☑ ☐`); extend ui-system/SKILL.md to the TUI surface (or document as named exception); CI linter enforces it.
- **D-15 (cross-platform contract):** Default (inline+web) universal (node:sqlite, no native binding, pure-JS tree). Opt-in host platform-routed. Pin **Node 22+ floor**. mos tui honors Windows path discipline (path.join / normwin).
- **D-16 (packaging):** Ships with the plugin in one install; `mos tui` is CLI-active-only; reference design = `mindrian-tui-achievable.vercel.app` (the achievable mockup is canonical, NOT the sim's zellij-default).

### Claude's Discretion

- Exact ink component decomposition.
- Key-binding map beyond stated keys (arrows / Tab / Enter / Space / q / shape hotkey / zoom key).
- Breadcrumb rendering style.
- WAL checkpoint cadence.

### Deferred Ideas (OUT OF SCOPE)

- A single Claude-Code-native docked surface (impossible - CC owns its screen).
- A standalone agentic TUI that owns the conversation (OpenCode/Crush model).
- New Desktop/Cowork rendering beyond AskUserQuestion baseline (degrade-only; `mos tui` is CLI-only).
- Multi-user/team collaboration + Brain-API-key onboarding (GTM deal-blockers; separate work).
- Truth-layer changes (room.db schema, resolver) - shipped Phase 135/109, consumed read-only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (from SPEC.md) | Research Support |
|----|---------------------------|------------------|
| Req 1 | One render engine + flag dispatch; 7 HTML commands -> thin flag-aliases | Extend `render-v2.cjs` (already the single inline formatter, Part 7); the 7 command `.md` files (dashboard/wiki/present/publish/export/visualize/snapshot) become aliases; `visualize` is already `dashboard --mermaid` |
| Req 2 | Seamless default = inline + web twin (zero setup, cross-platform) | render-v2 inline path exists; `lib/wiki/wiki-server.cjs` express+chokidar+SSE web path exists; both pure-JS + node:sqlite -> portable |
| Req 3 | Headless core + thin clients (single writer, single source) | navigation.cjs is the chokepoint; `check-substrate.cjs` already greps for direct sqlite opens; add SSE read-API on the existing express server |
| Req 4 | `mos tui` opt-in arrow-key navigator (ink, buildless, lazy deps) | **VENDORING VERDICT: PASS** (see Package Legitimacy Audit). CJS-boot + React.createElement + lazy `await import('ink')` proven this session |
| Req 5 | Detect-and-adapt launcher (graph-generated workspace) | Net-new; probe via `$TMUX`/`$WEZTERM_PANE`/`which zellij`/`which mprocs`/`process.platform`; tmux `set-hook` -> focus_changed events |
| Req 6 | The gate is the write node (multi-select + open text) | Mirror `lib/hmi/selector-dispatcher.cjs` + `shape-f*-renderer.cjs`; AskUserQuestion is the inline gate; `navigation.cjs writeEdge` + `focus.cjs setFocus` are the write primitives |
| Req 7 | Single De Stijl token core (contrast pairs, glyph-backed, CI-enforced) | Extend `references/visual/palette.json` (the 121.5 seed); 12-glyph table in `skills/ui-system/SKILL.md` +4 glyphs; linter mirrors `check-substrate.cjs` grep-gate idiom |
| Req 8 | Fractal navigation (depth + zoom/re-root + bud + cross-wall edges) | zoom -> `focus.cjs setFocus` (writes focus_changed, D-04); bud -> existing room-creation wiring (D-03); cross-wall edges via `navigation.cjs getNeighborhood`/`edges.cjs` |
| Req 9 | LazyGraph overlay (intent filters, temporal ranks, never reorders) | `navigation.cjs findRecentChanges` + `findSurfaceableTensions` + spine-events JTBD/operator for intent filter; render into a slot, never reorder tree |
| Req 10 | Dual render (graph + language) | render-v2 emits prose; graph view from `getNeighborhood`; pair them in one render frame |
| Req 11 | Cross-platform contract | node:sqlite confirmed (no binding); pure-JS tree confirmed; Node 22+ floor already in package.json `engines.node >=22.5.0`; launcher platform-routes |
| Req 12 | Canon Part 8 + Part 9 clean | `check-substrate.cjs` grep gate + `brain-boundary-scan`; SSE payloads carry enum/handle only |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| room.db read/write | Headless core (navigation.cjs) | - | Part 9: navigation IS the local mind; single writer + sole door (M1 substrate contract) |
| Render formatting (shape x delivery) | Engine (render-v2 extended) | - | Part 7: one formatter, many entry points; pure function, no Brain |
| Inline 4-zone render | Engine -> Larry's response text | - | Zero-process; CC owns the conversation pane |
| Web twin transport | Frontend server (existing express) | Browser | Reuse wiki-server.cjs; SSE push, browser pulls |
| SSE read-API | Headless core API surface (over existing express) | Thin clients | D-10: clients consume the API, never open room.db |
| `mos tui` rendering | Sibling CLI process (ink) | Headless core (SSE client) | D-09: opt-in; CC cannot dock a native surface |
| Workspace composition | Launcher (net-new) + navigation.cjs graph read | Host (tmux/WezTerm/mprocs) | D-11: tmux is a second projection of the graph |
| Decision gate (write node) | Engine + navigation.cjs (writeEdge / setFocus) | All surfaces (fan-out via memory_event) | Part 3/4: gate converts browsing into typed edges |
| Token enforcement | CI linter (net-new) over palette.json | Engine + ink components | D-14: one token source, linter rejects hardcoded values |

## Standard Stack

### Core (the opt-in `mos tui` tree only - lazy-loaded, NOT in the seamless base)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ink` | 7.0.5 | React-for-terminal renderer; the `mos tui` full-screen app | THE terminal-React library; ~28k stars; D-01 locked. ESM-only, consumed from CJS via `await import('ink')` |
| `react` | 19.2.6 | ink's required peer (`>=19.2.0`); `React.createElement` only, no JSX | CJS-compatible (no `"type":"module"`); the no-build-step path |
| `yoga-layout` | 3.2.1 | flexbox layout engine ink uses for terminal boxes | **Ships WASM as base64-inlined pure-JS ESM** - the keystone of the vendoring PASS. Transitive (pulled by ink) |

### Supporting (already vendored / already present - REUSE, do not add)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express` | ^5.1.0 (present) | Web twin + SSE read-API host | Reuse the wiki-server.cjs server; do NOT add a second HTTP server (Part 7 + SPEC constraint) |
| `chokidar` | ^4.0.3 (present) | File-change watcher -> SSE broadcast | Reuse `lib/wiki/wiki-watcher.cjs` SSE pattern (`addSSEClient` + `broadcast`) |
| `node:sqlite` (`DatabaseSync`) | built-in (Node 22) | room.db handle (WAL); read-only mode for tui | Already in `room-db.cjs`; add `{ readOnly: true }` open option (verified accepted by Node 22 DatabaseSync this session) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ink (LOCKED D-01) | blessed / neo-blessed | blessed is unmaintained + does NOT map to a React component model (the linter-at-component-layer rationale of D-01 is lost). Only relevant IF the vendoring gate FAILED - it did not. |
| ink 7 (ESM) | ink 5.x (`>=18.0.0` react peer, `node>=18`) | ink 5 has the same ESM module type; downgrading buys nothing and loses React 19. Use ink 7 (matches Node 22 floor `engines.node >=22`). |
| tmux-scripted host (LOCKED D-11) | zellij-as-default | zellij ~80 MB / beta / not preinstalled = friction; rejected in Round 4. The achievable mockup's "zellij workspace" framing is NOT the locked default - follow D-11. |

**Installation (opt-in tui tree):**
```bash
npm install ink@7.0.5 react@19.2.6
# yoga-layout@3.2.1 arrives transitively via ink; do not add it directly
```

**Lazy-load mechanism (D-12 - keeps the seamless base lean):** Use `require()`-on-demand. ink is ESM-only, so the loader is a dynamic `import()` inside the `mos tui` entry, never a top-level require:
```js
// bin/ or lib/tui/ entry - ONLY reached when the user runs `mos tui`
async function bootTui() {
  let ink, React;
  try {
    ink = await import('ink');        // ESM, lazy
    React = require('react');         // CJS-compatible
  } catch (e) {
    console.error('[mos tui] ink not installed. The seamless inline + web surfaces work without it.');
    process.exit(2);
  }
  // ... render with React.createElement(ink.Box, ...)
}
```
The seamless base (inline + web) never references ink. A `try/catch` around the dynamic import makes ink-absence a graceful degrade, not a crash (Req 2 acceptance: "seamless default works with ink ABSENT"). Do NOT use `optionalDependencies` for ink - it ships in the one install (D-16); the laziness is at the **require boundary**, not the install boundary.

**Version verification (this session):**
- `npm view ink version` -> 7.0.5 (engines.node `>=22`, type `module`, react peer `>=19.2.0`)
- `npm view yoga-layout version` -> 3.2.1 (zero dependencies, no install scripts, ships `yoga-wasm-base64-esm.js`)
- `npm view react version` -> 19.2.6 (no `type:module`, CJS main; no native)

## Package Legitimacy Audit

> slopcheck was NOT available in this session. Compensating controls applied: a real `npm install` of the full transitive tree, tarball extraction + byte-level inspection of yoga, and an end-to-end CJS boot render. ink/react/yoga are canonical, decade-known packages (not slopsquat candidates). Per protocol, all are tagged `[ASSUMED]` until the planner gates the actual install behind a `checkpoint:human-verify` task; the compensating-control evidence below is strong enough that the checkpoint should be a quick confirm, not a re-investigation.

| Package | Registry | Age | Source Repo | Native addon? | Install script? | Disposition |
|---------|----------|-----|-------------|---------------|-----------------|-------------|
| `ink@7.0.5` | npm | mature (vadimdemedes/ink, ~9 yrs) | github.com/vadimdemedes/ink | NO | NO | Approved [ASSUMED] |
| `react@19.2.6` | npm | mature (facebook/react) | github.com/facebook/react | NO | NO | Approved [ASSUMED] |
| `yoga-layout@3.2.1` | npm | mature (facebook/yoga) | github.com/facebook/yoga | NO (WASM base64-in-JS) | NO | Approved [ASSUMED] |
| (37 transitive deps) | npm | - | various | NONE found | NONE found | Approved [ASSUMED] |

**Full-tree native-addon scan (live, this session):** `npm install ink@7.0.5 react@19.2.6` -> 38 packages, 19 MB.
- `find node_modules -name '*.node'` -> EMPTY
- `find node_modules -name 'binding.gyp'` -> EMPTY
- `find node_modules -name '*.wasm'` -> EMPTY (yoga's WASM is base64-inlined in `.js`)
- install/postinstall/preinstall lifecycle scripts across the tree -> NONE
- `ws@8.21.0` native peers (`bufferutil`, `utf-8-validate`) -> declared `optional: true`, NOT installed (clean)

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged [SUS]:** none.
**Planner action:** insert ONE `checkpoint:human-verify` task before the `npm install ink react` step (per protocol while slopcheck unavailable). The vendoring re-audit grep (`find vendored-tree -iregex '.*\.\(node\|wasm\|gyp\)$'` returns empty) must run as a release-gate assertion in the same wave (Req 4 + Req 11 acceptance).

## Architecture Patterns

### System Architecture Diagram

```
                        +-----------------------------+
   user types -->  CLAUDE CODE (owns its pane)        |
   to Larry        |  Larry response text             |
                   |   = INLINE 4-zone render  <-------+----------------+
                   |   + native AskUserQuestion gate   |                |
                   +-----------------+-----------------+                |
                                     | render({shape, delivery:inline}) |
                                     v                                  |
   +========================== ONE RENDER ENGINE =====================+ |
   |  lib/render/render-v2.cjs (extended)                            | |
   |  input: {shape: deck|mermaid|wiki|grid|dashboard|snapshot,      | |
   |          delivery: inline|web|tui|file}                         | |
   |  obeys: palette.json token core (D-14) + 12+4 glyph vocab       | |
   +=========+===============+===============+========================+ |
             | inline        | web           | tui                     |
             |               v               v                         |
             |    +----------------------+   |                         |
             |    | EXISTING express +   |   |                         |
             |    | chokidar + SSE       |   |                         |
             |    | (wiki-server.cjs)    |   |                         |
             |    | + thin SSE read-API  |   |                         |
             |    +----+-------------+---+   |                         |
             |         | HTML        | SSE   | SSE (read-only client)   |
             |         v             v       v                         |
             |    BROWSER twin   thin clients re-read on event         |
             |                                                         |
             +---------------- all reads go through ------------------+
                                     |
                       +-------------v--------------+
                       | HEADLESS CORE              |  <-- single writer,
                       | lib/core/navigation.cjs    |      sole room.db door
                       |  getNeighborhood / setFocus |     (Part 9 chokepoint)
                       |  writeEdge / confirmNode    |
                       |  + NEW: openReadOnly()      |     (D-02 read mode)
                       |  + NEW: SSE event emit      |     (D-10 enum/handle only)
                       +-------------+--------------+
                                     | node:sqlite DatabaseSync
                                     v             (WAL, busy_timeout=5000,
                       +--------------------------+  synchronous=NORMAL)
                       | room.db (truth layer,    |
                       | Phase 135/109, read-only |
                       | consumed here)           |
                       +--------------------------+

   OPT-IN LAUNCHER (net-new):  mos -> navigation.cjs reads graph ->
     emit workspace (session=room / window=section / pane=surface) ->
     host: WezTerm? -> zellij? -> tmux (scripted, $TMUX-aware) ->
           [Windows: WezTerm/mprocs] -> web-twin fallback
     tmux set-hook (pane-focus-in) --> writes focus_changed memory_event
```

### Recommended Project Structure (net-new + extended)
```
lib/render/
  render-v2.cjs          # EXTEND: add `shape` + `delivery` dispatch to the engine
  engine.cjs             # NEW (optional): the shape x delivery flag router if render-v2 grows too large
lib/core/
  navigation.cjs         # EXTEND: + openReadOnly re-export (D-02), + SSE-read accessors (D-10)
  room-db.cjs            # EXTEND: + readOnly open option, + busy_timeout/synchronous pragmas
  navigation/focus.cjs   # REUSE as-is: setFocus writes focus_changed (zoom D-04, sync D-05)
lib/render/sse/
  read-api.cjs           # NEW: thin SSE endpoints mounted on the EXISTING express app
lib/tui/                 # NEW: the opt-in ink app (lazy-loaded)
  boot.cjs               # dynamic import('ink') guard + terminal restore on quit
  tree.cjs               # arrow-key fractal tree component (createElement)
  gate.cjs               # richer multi-select + free-text widget (mirrors selector-dispatcher)
  slot.cjs               # LazyGraph suggestion slot (highlight-in-place + whisper)
lib/launcher/            # NEW: detect-and-adapt launcher
  detect.cjs             # $TMUX / $WEZTERM_PANE / which zellij / which mprocs / process.platform
  compose.cjs            # graph -> workspace layout generator (session=room/window=section/pane=surface)
  tmux-hooks.cjs         # set-hook pane-focus-in -> focus_changed memory_event
references/visual/
  palette.json           # EXTEND: semantic color PAIRS + 4 TUI glyphs (D-14)
scripts/
  check-tokens.cjs       # NEW: CI linter (mirror check-substrate.cjs grep-gate idiom)
bin/mindrian-tools.cjs   # EXTEND: add `tui` + `launch` (or `mos`) subcommands to the switch
```

### Pattern 1: ink boot from CJS, no JSX, clean terminal restore
**What:** Boot ink from a CommonJS file with `React.createElement` and restore the terminal on quit.
**When to use:** the `mos tui` entry (D-12).
**Example (verified rendering this session):**
```js
// lib/tui/boot.cjs - CJS, no build step, no JSX. PROVEN this session.
async function bootTui(roomDir) {
  const { render, Box, Text, useInput, useApp } = await import('ink'); // ESM, lazy
  const React = require('react');
  const e = React.createElement;
  // App reads the SSE read-API as a thin client; NEVER opens room.db directly (D-10).
  const App = () => {
    const { exit } = useApp();
    useInput((input, key) => { if (input === 'q') exit(); }); // q quits
    return e(Box, { flexDirection: 'column', borderStyle: 'round' },
      e(Text, { color: 'green' }, 'MindrianOS navigator'));
  };
  const { waitUntilExit } = render(e(App)); // ink restores the terminal on unmount/exit
  await waitUntilExit();
}
module.exports = { bootTui };
```

### Pattern 2: thin SSE read-API on the EXISTING express server (Part 8 clean)
**What:** Mount read-only SSE endpoints carrying ENUM/HANDLE only - never user bytes (Part 8).
**When to use:** Req 3, D-10.
**Example (reuses wiki-watcher.cjs idiom verbatim):**
```js
// lib/render/sse/read-api.cjs - mounted on the existing express app, NOT a new server.
function mountReadApi(app, roomDir) {
  // Reuse the wiki-watcher SSE client registry + broadcast pattern.
  const { addSSEClient, startWatcher } = require('../../wiki/wiki-watcher.cjs');
  app.get('/api/room/sse', (req, res) => addSSEClient(res)); // text/event-stream
  // Payload contract (Part 8): node IDs + types + enum statuses + event_type ONLY.
  // NEVER: artifact bodies, meeting text, personal identifiers, proprietary numbers.
  startWatcher(roomDir, (change) => {/* broadcast {event_type, node_id, node_type} */});
}
```

### Pattern 3: read-only room.db handle via navigation.cjs (D-02)
**What:** Add a `readOnly` open mode so the long-lived tui reader coexists with the CC writer under WAL.
**When to use:** Req 3, D-02/D-10.
**Example (extends room-db.cjs:91-114; DatabaseSync readOnly verified accepted in Node 22):**
```js
// lib/core/room-db.cjs - additive: a read-only opener for thin clients.
function openRoomDbReadOnly(roomDir) {
  const dbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');
  const db = new DatabaseSync(dbPath, { readOnly: true }); // verified Node 22
  db.exec('PRAGMA busy_timeout = 5000');       // D-10 core pragma
  // synchronous=NORMAL + WAL are writer-side concerns; readers inherit WAL.
  return db;
}
// The WRITER side (openRoomDb) gains: db.exec('PRAGMA busy_timeout = 5000');
//   db.exec('PRAGMA synchronous = NORMAL');  -- it already sets journal_mode = WAL.
```

### Pattern 4: launcher host detection (D-11 probe order)
**What:** Probe env vars + `which` in the locked precedence order.
**When to use:** Req 5, D-11.
**Example:**
```js
// lib/launcher/detect.cjs
const { execSync } = require('node:child_process');
function which(bin) { try { execSync(process.platform==='win32'?`where ${bin}`:`command -v ${bin}`,{stdio:'ignore'}); return true; } catch { return false; } }
function detectHost() {
  if (process.platform === 'win32') {              // D-11: native Windows route
    if (which('wezterm')) return 'wezterm';
    if (which('mprocs'))  return 'mprocs';
    return 'web';                                  // web-twin fallback
  }
  if (process.env.WEZTERM_PANE) return 'wezterm';  // WezTerm if running
  if (which('zellij'))          return 'zellij';   // zellij if installed
  if (which('tmux'))            return 'tmux';      // tmux scripted default ($TMUX-aware below)
  return 'web';                                    // no multiplexer -> web twin
}
// $TMUX-aware: if process.env.TMUX is set, ADD windows to the current session
//   (tmux new-window / split-window), do NOT spawn a rival session.
```

### Anti-Patterns to Avoid
- **A second HTTP server for the SSE read-API.** SPEC + Part 7 forbid it. Mount on the existing express app from `wiki-server.cjs`.
- **A thin client opening room.db directly.** Violates D-10 + Part 9; `check-substrate.cjs` will flag it. Always go through the SSE read-API or navigation.cjs.
- **JSX or a build step in the tui.** Violates CLAUDE.md hard rule + D-12. Use `React.createElement` only.
- **Top-level `require('ink')`.** Pulls ink into the seamless base + crashes when ink absent. Use lazy `await import('ink')` inside the tui entry only.
- **Reimplementing bud/sub-room promotion.** Violates D-03 + Part 7. Delegate to the existing room-creation wiring.
- **Reordering the tree to surface a suggestion.** Violates M5 hard rule 1 + Req 9/Req 8. Highlight in place + whisper in the slot.
- **Sending user bytes over SSE.** Violates Part 8. Enum/handle/node-id only.
- **Following the mockup's zellij-default.** The `mindrian-tui-achievable.vercel.app` mockup shows a "zellij workspace"; D-11 LOCKS tmux-scripted as the default with zellij only "if installed". Follow CONTEXT, not the mockup.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal flexbox layout + diffing | a custom ANSI layout engine | ink + yoga-layout | ink owns reconciliation, cursor restore, resize; yoga owns flexbox. Rebuilding is the OpenCode-trap the SPEC rejects |
| File-change -> client push | a polling loop or new ws server | existing `wiki-watcher.cjs` chokidar + SSE | already shipped, already vendored, already cross-platform |
| Web server for the twin | a new express instance | existing `wiki-server.cjs` | SPEC + Part 7: no second HTTP server |
| Concurrent SQLite access | file locks / a mutex / a daemon | WAL + read-only handle (D-02) | node:sqlite WAL already enabled in room-db.cjs; readers + one writer coexist natively |
| Sub-room promotion | new atomic-wiring code | the SEED-001 / room-creation contract (D-03) | atomic-or-fail-closed already exists; the navigator only surfaces "bud" |
| Multi-select selector | a bespoke widget from scratch | mirror `selector-dispatcher.cjs` + `shape-f*-renderer.cjs` | the F-shape selector + AskUserQuestion gate already encode the Part 3 invariants |
| Token enforcement | a hand-written value checker | mirror `check-substrate.cjs` grep-gate idiom | the repo already has a grep-based CI guard pattern to copy |
| WASM compilation of yoga | building yoga from source / a postinstall | the published `yoga-layout` (base64 WASM in JS) | npm ships the pre-built WASM inline; no toolchain needed |

**Key insight:** Nearly every piece of this phase EXTENDS shipped code. The genuinely net-new surfaces are exactly three: the SSE read-API mount, the ink tui app, and the detect-and-adapt launcher. Everything else is repointing.

## Runtime State Inventory

> This is a render/integration phase, not a rename/migration. No string rebrand. Inventory is therefore narrow but checked.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | room.db is CONSUMED READ-ONLY (Phase 135/109). The only new writes are `focus_changed` memory_events (zoom/sync, D-04/05) + typed DECISION/FREE_TEXT edges (gate, D-13) - all through navigation.cjs writeEdge/setFocus, which already exist. No schema change. | code edit only (additive event/edge writes via existing chokepoint) |
| Live service config | The opt-in launcher will register tmux `set-hook` entries at launch time (these live in the running tmux server, not git). They are ephemeral per-session and re-created on each launch - no persisted external config to migrate. | none (re-created each launch) |
| OS-registered state | tmux/WezTerm/zellij/mprocs are user-installed multiplexers probed at runtime; the phase registers nothing at the OS level. Windows path discipline (path.join/normwin) applies to the launcher (D-15). | none |
| Secrets/env vars | The launcher READS `$TMUX`, `$WEZTERM_PANE`, `process.platform`. The BYOAPI chat in wiki-server.cjs already reads user-supplied keys client-side (localStorage) - unchanged. No new secret. | none |
| Build artifacts / installed packages | Adding ink/react/yoga to package.json changes package-lock.json + the vendored node_modules tree (release.sh Step 6.7 rebuilds via `npm ci --omit=dev`). The vendoring re-audit grep is the gate. | reinstall + re-vendor at release; run the native-addon grep as a release assertion |

**Nothing found in OS-registered or secrets categories:** verified - the launcher is read-only on env, registers only ephemeral in-session tmux hooks.

## Common Pitfalls

### Pitfall 1: ESM-only ink breaks a top-level CJS require
**What goes wrong:** `require('ink')` throws `ERR_REQUIRE_ESM` (ink is `"type":"module"`).
**Why it happens:** ink 5/7 are ESM-only; React 19 is CJS-compatible but ink is not.
**How to avoid:** `await import('ink')` (dynamic import works from CJS) for ink; `require('react')` for React. Proven this session.
**Warning signs:** `ERR_REQUIRE_ESM` at tui boot.

### Pitfall 2: ink leaks into the seamless base
**What goes wrong:** a stray top-level import pulls ink into a code path the inline/web surfaces hit, breaking the "works with ink absent" acceptance.
**Why it happens:** convenience imports at module top.
**How to avoid:** ink is referenced ONLY inside `lib/tui/` behind a lazy `import()` with a try/catch graceful-degrade. Add a test (Req 4 acceptance) that loads the inline + web entry points with ink physically removed and asserts no throw.
**Warning signs:** the seamless-base test fails when node_modules/ink is deleted.

### Pitfall 3: a native addon sneaks into the vendored tree on a future ink bump
**What goes wrong:** a future ink/transitive bump adds a `.node` addon -> the single cross-platform vendored tree becomes platform-specific (breaks the cross-platform contract).
**Why it happens:** transitive deps change between versions.
**How to avoid:** PIN ink/react/yoga to exact versions; run the native-addon grep (`find node_modules -iregex '.*\.\(node\|wasm\|gyp\)$'` must be empty + no install scripts) as a release.sh assertion, not a one-time check. The `ws` optional-peer native deps (`bufferutil`/`utf-8-validate`) must stay un-installed.
**Warning signs:** the release vendoring assertion finds a `.node` file.

### Pitfall 4: SSE leaks user bytes to a client that could relay to Brain
**What goes wrong:** an SSE payload includes artifact text/meeting content -> a Part 8 boundary risk if any client forwards it.
**Why it happens:** convenience of sending the whole node.
**How to avoid:** SSE payload schema = `{event_type, node_id, node_type, review_status}` enums/handles only. Run `brain-boundary-scan` + the `check-substrate.cjs` grep on the new files.
**Warning signs:** brain-boundary-scan flags the read-api file.

### Pitfall 5: tmux launcher spawns a rival session instead of adding windows
**What goes wrong:** running `tmux new-session` while already inside tmux nests/conflicts.
**Why it happens:** ignoring `$TMUX`.
**How to avoid:** if `process.env.TMUX` is set, use `tmux new-window`/`split-window` against the current session ($TMUX-aware, D-11).
**Warning signs:** nested tmux status bars.

### Pitfall 6: Windows path breakage in the launcher
**What goes wrong:** hardcoded `/` paths or `command -v` on Windows.
**Why it happens:** Unix assumptions.
**How to avoid:** `path.join`/normwin (D-15); use `where` not `command -v` on `win32`; route Windows to WezTerm/mprocs (tmux is Unix-only).
**Warning signs:** the Windows tester reports launcher failure (prior beta.32/36 path fixes are the precedent).

## Code Examples

### Adding the `tui` + `launch` subcommands to the tools entry
```js
// bin/mindrian-tools.cjs - extend the existing switch (pattern at line ~89).
// case 'tui':    return require('../lib/tui/boot.cjs').bootTui(roomDir);
// case 'launch': return require('../lib/launcher/compose.cjs').launch(roomDir);
// Both are lazy-required so the seamless base never loads ink/launcher code.
```

### Zoom writes a focus_changed event (reuse focus.cjs, D-04)
```js
// Zoom/re-root re-uses the EXISTING setFocus chokepoint - no new event type.
const nav = require('lib/core/navigation.cjs');
// setBy must be in VALID_SET_BY: 'user' for an explicit tui zoom.
nav.setFocus(db, sessionId, zoomTargetNodeId, 'user'); // writes focus_changed memory_event
// Larry's next inline turn reads nav.getActiveFocus(db, sessionId) -> two-way sync (D-05).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| yoga-layout-prebuilt (native .node, v1.10.0) | yoga-layout 3.x (WASM, base64-in-JS) | yoga 2.0+ (2023) | The reason ink is now vendorable pure-JS. Old `yoga-layout-prebuilt` was the native blocker; it is gone. |
| ink 3/4 (react 18, node 14/18) | ink 7 (react 19.2, node 22) | ink 6/7 (2024-2025) | Matches the Node 22 floor; ESM-only (use dynamic import) |
| direct-SQLite-read per client (Round 3 framing) | headless core + thin SSE clients (Round 4, D-10) | this phase | removes client-side concurrency; one writer, many readers |

**Deprecated/outdated:**
- `yoga-layout-prebuilt` (the native package): superseded by WASM `yoga-layout`. Do NOT add it.
- The Round-1..3 "mos tui as primary, reads SQLite directly" framing: SUPERSEDED by D-09/D-10 seamless-first + headless-core.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ink/react/yoga tagged `[ASSUMED]` (slopcheck unavailable) | Package Legitimacy Audit | LOW - canonical packages; compensating controls (real install + tarball + boot render) applied. Planner adds one checkpoint:human-verify before install. |
| A2 | DatabaseSync `{ readOnly: true }` is the correct read-only open flag in Node 22 | Pattern 3 / D-02 | LOW - the option was ACCEPTED by Node 22 DatabaseSync this session; confirm the SQLITE_OPEN_READONLY semantics (vs a no-op) during execution with a write-attempt-rejected test. |
| A3 | The SEED-001 atomic sub-room contract is reachable as an existing wiring path | Don't Hand-Roll / D-03 | MEDIUM - SEED-001 is referenced in PROJECT.md/MILESTONES as "sub-room atomic wiring" but appears partly scaffolded; the live wiring is `scripts/room-registry create` + `lib/core/room-auto-create.cjs` + `room-receipt-emit.cjs`. The planner must confirm the exact callable BUD target in Wave 0; if SEED-001 itself is not yet shipped, BUD delegates to the room-creation orchestrator that exists. |
| A4 | tmux `set-hook pane-focus-in` reliably fires a shell command that can write a focus_changed event | Pattern 4 / D-11 | MEDIUM - tmux hooks are well-documented but the focus-events option (`focus-events on`) must be set and the host terminal must report focus. Verify on a real tmux during execution; web-twin fallback covers the no-tmux case. |
| A5 | The 4 new glyphs (`◇ ○ ☑ ☐`) render legibly across common terminals | D-14 / token core | LOW-MEDIUM - these are common Unicode; confirm width/legibility in the contrast check + on the Windows tester's terminal. |

**The four SPEC-deferred items are NOT assumptions - they are de-risked:** ink vendoring (PROVEN PASS), SSE shape (reuse wiki-watcher, designed above), launcher probe order (designed above per D-11), M5 how-knobs (below).

## Open Questions

1. **Exact BUD target (D-03).**
   - What we know: BUD delegates to the existing atomic sub-room wiring; `scripts/room-registry create`, `lib/core/room-auto-create.cjs`, and `lib/core/room-receipt-emit.cjs` are the live room-creation surfaces.
   - What's unclear: whether a single "SEED-001 atomic-or-fail-closed" callable exists yet, or whether BUD composes the room-registry create + the wiring side-effects.
   - Recommendation: Wave 0 task - confirm the callable; if SEED-001 is unshipped, BUD calls the room-creation orchestrator and the navigator surfaces "bud / open as room" as a delegating action (still no reimplementation).

2. **WAL checkpoint cadence (Claude's discretion / M5 how-knob).**
   - What we know: WAL is on; long-lived reader + writer coexist.
   - What's unclear: when to `PRAGMA wal_checkpoint(TRUNCATE)` so the -wal file does not grow unbounded during a long tui session.
   - Recommendation: writer-side periodic `wal_checkpoint(PASSIVE)` on an idle timer (e.g., after N writes or T seconds); leave TRUNCATE to session close. Low risk; discretion.

3. **Breadcrumb rendering style on zoom (Claude's discretion).**
   - Recommendation: a single Zone 1 line `room > section > node` using the existing 12-glyph `arrow` for separators + the focus glyph; re-root shows the path from root to the zoomed node. Keep it inside the 4-zone anatomy.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | YES | 22.22.2 (floor >=22.5.0 in package.json) | none needed |
| node:sqlite DatabaseSync | room.db + read-only handle | YES | built-in (experimental, Node 22) | none needed |
| express | web twin + SSE | YES (vendored ^5.1.0) | 5.x | none needed |
| chokidar | SSE watcher | YES (vendored ^4.0.3) | 4.x | none needed |
| ink / react / yoga | `mos tui` ONLY (opt-in) | NOT yet in deps | 7.0.5 / 19.2.6 / 3.2.1 | tui degrades to absent; seamless base unaffected |
| tmux | opt-in launcher default (Unix) | runtime-probed | - | WezTerm -> zellij -> web twin |
| WezTerm / zellij / mprocs | opt-in launcher hosts | runtime-probed | - | web twin |
| slopcheck | package legitimacy gate | NO | - | compensating controls applied (real install + tarball + boot); planner adds checkpoint:human-verify |

**Missing dependencies with no fallback:** none (the seamless default has every dependency present and vendored).
**Missing dependencies with fallback:** ink/react/yoga (tui-only, degrades gracefully); the multiplexers (launcher routes to web twin).

## Validation Architecture

> nyquist_validation = true (config.json). Section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) - `const test = require('node:test')` / `describe/it` |
| Config file | none - tests are `tests/*.test.cjs` + per-phase `tests/run-all-<phase>.sh` harnesses |
| Quick run command | `node --test tests/136-*.test.cjs` |
| Full suite command | `bash tests/run-all-136.sh` (create in Wave 0, mirror `tests/run-all-121.5.sh`) |

### Phase Requirements -> Test Map
| Req | Behavior | Test Type | Automated Command / Assertion | File Exists? |
|-----|----------|-----------|-------------------------------|-------------|
| Req 1 | every (shape x delivery) renders; no legacy render body remains | unit + grep | `node --test tests/136-engine-shapes.test.cjs` + `grep -L 'render --shape' commands/{dashboard,wiki,present,publish,export,visualize,snapshot}.md` (assert no inline HTML/render body) | NO Wave 0 |
| Req 2 | inline spawns zero processes; web reuses existing express; both work with ink absent | integration | `node --test tests/136-seamless-no-ink.test.cjs` (rm-ink fixture; assert inline path child_process count == 0; assert web path binds the wiki-server app, not a new server) | NO Wave 0 |
| Req 3 | zero direct sqlite opens outside navigation.cjs+core; identical state across inline/web/sim-tui; concurrency clean | grep + integration | `node scripts/check-substrate.cjs --baseline` (assert no new violations) + `node --test tests/136-thin-clients-converge.test.cjs` (3 clients off SSE assert identical state) + a concurrent read+write loop asserts no SQLITE_BUSY | NO Wave 0 |
| Req 4 | tui arrow-navigates + restores terminal; works with ink absent; vendoring audit finds zero native addons | integration + release-gate | `node --test tests/136-tui-boot.test.cjs` (boot + simulated input + clean exit) + vendoring grep assertion `find node_modules -iregex '.*\.\(node\|wasm\|gyp\)$'` empty | NO Wave 0 |
| Req 5 | launcher composes workspace with tmux; routes otherwise; tmux focus -> memory_event | integration | `node --test tests/136-launcher-detect.test.cjs` (env-var matrix asserts probe order) + a tmux-present harness asserts a focus_changed row after a window-switch (manual-justified where CI lacks tmux) | NO Wave 0 |
| Req 6 | toggle 2 options + free-text -> 3 writes (2 DECISION + 1 FREE_TEXT) via navigation.cjs; preview before confirm; one memory_event fans out | unit | `node --test tests/136-gate-write-node.test.cjs` (assert exactly 3 edges through writeEdge; assert preview reflects pending; assert one fan-out event) | NO Wave 0 |
| Req 7 | linter fails on planted hardcoded hex/glyph, passes on engine; semantic pairs pass contrast; 4 glyphs in vocab | unit | `node --test tests/136-token-linter.test.cjs` (planted-violation fixture fails; engine passes) + a WCAG contrast assertion (3:1 UI / 4.5:1 text) on each pair | NO Wave 0 |
| Req 8 | 4+ levels render; zoom re-roots + writes focus event; bud -> registered sub-room; cross-wall edge shows, tree order byte-identical | unit + integration | `node --test tests/136-fractal.test.cjs` (assert focus_changed after zoom; assert sub-room registered after bud; snapshot tree order before/after a cross-wall edge = byte-identical) | NO Wave 0 |
| Req 9 | injecting a suggestion leaves tree order byte-identical; slot silent when nothing relevant changed | unit | `node --test tests/136-lazygraph-overlay.test.cjs` (byte-identical tree snapshot; empty slot on no-change) | NO Wave 0 |
| Req 10 | a seeded CONTRADICTS edge produces a visible edge AND a sentence in one render | unit | `node --test tests/136-dual-render.test.cjs` | NO Wave 0 |
| Req 11 | inline + web pass on Win/Mac/Linux; no native addon in tree; Node 22+ floor pinned; launcher platform-routes | grep + matrix | vendoring grep (Req 4) + `grep '"node": ">=22' package.json` + the launcher detect matrix test (Req 5) | partial (package.json floor exists) |
| Req 12 | brain-boundary-scan passes on new files; zero direct sqlite opens outside core | grep | `brain-boundary-scan` on new files + `node scripts/check-substrate.cjs --diff` on staged | partial (gates exist) |

### Sampling Rate
- **Per task commit:** `node --test tests/136-<touched-area>.test.cjs` (< 30s) + `node scripts/check-substrate.cjs --diff`
- **Per wave merge:** `bash tests/run-all-136.sh`
- **Phase gate:** full 136 suite green + `brain-boundary-scan` clean + the vendoring grep assertion empty, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/run-all-136.sh` - the phase harness (mirror `tests/run-all-121.5.sh`)
- [ ] `tests/136-seamless-no-ink.test.cjs` - the ink-absent seamless-base guard (Req 2/Req 4 - load-bearing)
- [ ] `tests/136-thin-clients-converge.test.cjs` + a concurrency loop (Req 3)
- [ ] `tests/fixtures/136-seeded-room/` - a 4+-level seeded room.db with a CONTRADICTS edge (Req 8/10)
- [ ] confirm the BUD callable target (Open Question 1) before the fractal wave
- [ ] add the vendoring native-addon grep as a `release.sh` Step 6.7 assertion (Req 4/11)

## Security Domain

> security_enforcement absent in config.json -> treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Headless core single-writer + sole room.db door (Part 9); thin clients never open the DB |
| V5 Input Validation | yes | The web twin's BYOAPI chat takes user input + a user API key; gate free-text becomes a FREE_TEXT edge - validate/escape before render (existing `escHtml` in wiki-server) |
| V6 Cryptography | no | no new crypto; SSE is local-only |
| V7 Error/Logging | yes | navigation-bypass telemetry is LOCAL JSONL, sha256 room hash only (existing pattern); keep SSE logs scalar |
| V9 Communications | yes | SSE over localhost only; the read-API binds the existing express server (localhost) |
| Canon Part 8 (project-specific) | yes | SSE payloads + all render paths carry enum/handle only - NO user bytes to Brain; `brain-boundary-scan` gate |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User content leaks to Brain via SSE/render path | Information Disclosure | Part 8: enum/handle-only payloads; brain-boundary-scan + check-substrate.cjs grep on every new file |
| A thin client opens room.db directly (split state / concurrency) | Tampering | D-10 + Part 9: only navigation.cjs opens the DB; check-substrate.cjs flags direct opens |
| Native addon enters the vendored tree | Tampering (supply-chain) | pin versions; release-gate native-addon grep; ws optional native peers stay un-installed |
| HTML injection in the web twin (artifact title -> page) | Tampering/XSS | existing `escHtml` in wiki-server.cjs; apply to all user-derived render output |
| Malicious/typosquat tui dep | Supply-chain | checkpoint:human-verify before install (slopcheck unavailable); pinned exact versions; real-install audit done |

## Proposed Cluster Decomposition (planner may adopt or override)

The SPEC names the cluster shape: engine core / headless SSE API / token core / inline+web seamless default / opt-in mos tui + launcher. Recommended wave order (dependency-driven):

- **Wave 0 - substrate + test scaffold:** `tests/run-all-136.sh`, seeded-room fixture, the ink-absent guard test, confirm the BUD callable (Open Question 1), add the vendoring grep to release.sh. (Blocks everything.)
- **Wave 1 - headless core API (Req 3, D-02/D-10):** add `openRoomDbReadOnly` + busy_timeout/synchronous pragmas to room-db.cjs; add the read-only re-export + SSE-read accessors to navigation.cjs; mount `lib/render/sse/read-api.cjs` on the existing express server. (Blocks the engine's web/tui delivery + the clients.)
- **Wave 2 - token core (Req 7, D-14):** extend palette.json into semantic pairs + 4 glyphs; extend ui-system/SKILL.md; ship `scripts/check-tokens.cjs`. (Blocks every renderer's compliance; independent of Wave 1, can run parallel.)
- **Wave 3 - one engine + seamless default (Req 1/2/9/10, D-09):** extend render-v2 into the shape x delivery engine; collapse the 7 commands to flag-aliases; wire inline + web twin off Wave 1 + Wave 2; LazyGraph slot + dual render. (Depends on Wave 1 + Wave 2.)
- **Wave 4 - opt-in mos tui + gate widget (Req 4/6/8, D-12/D-13):** vendor ink/react/yoga (gated by the Wave 0 checkpoint); `lib/tui/` ink app (lazy boot, no JSX); the richer multi-select + free-text gate; fractal zoom (focus.cjs) + bud (D-03) + cross-wall edges. (Depends on Wave 1 + Wave 2 + Wave 3.)
- **Wave 5 - detect-and-adapt launcher (Req 5/11, D-11/D-15):** `lib/launcher/` detect + compose + tmux-hooks; platform routing; Windows path discipline. (Depends on Wave 4 for the tui pane content.)
- **Capstone - canon + gates (Req 12):** brain-boundary-scan on all new files; promote M5 SEED -> ADR; full suite green; cross-platform proxy.

Waves 2 and 1 are parallelizable. Wave 4 is the heaviest single wave and may itself split (engine-side tui rendering vs the gate-write-node vs fractal nav).

## Reuse-vs-Net-New Ledger (Canon Part 7)

| Piece | Existing file it extends | Net-new? | Why repointing is/ isn't sufficient |
|-------|--------------------------|----------|-------------------------------------|
| One render engine | `lib/render/render-v2.cjs` (the single inline formatter, Phase 102) | EXTEND | render-v2 already owns 4-zone composition + the JTBD color map; add `shape` + `delivery` dispatch. No parallel formatter (Part 7). |
| Web twin transport | `lib/wiki/wiki-server.cjs` + `lib/wiki/wiki-watcher.cjs` | REUSE | express + chokidar + SSE (`addSSEClient`/`broadcast`) already shipped; SPEC forbids a second HTTP server. |
| SSE read-API | mounted ON wiki-server's express app | NET-NEW (thin) | the endpoints + enum-only payload schema are new, but the server, watcher, and client registry are reused. |
| Read-only room.db handle | `lib/core/room-db.cjs` (`openRoomDb`, WAL already on) | EXTEND | additive `openRoomDbReadOnly` + 2 pragmas; the writer + schema are unchanged. |
| Single-writer / sole door | `lib/core/navigation.cjs` (13-fn chokepoint) | EXTEND | add a read-only re-export + SSE accessors; the chokepoint contract + check-substrate gate already exist. |
| Zoom / two-way sync | `lib/core/navigation/focus.cjs` (`setFocus` -> focus_changed) | REUSE | the event type + audit-node carve-out already exist (Phase 129.5); zoom is a `setFocus` call. |
| Gate as write node | `lib/hmi/selector-dispatcher.cjs` + `shape-f*-renderer.cjs` + `navigation.cjs writeEdge`/`confirmNode` | EXTEND/MIRROR | AskUserQuestion inline gate exists; the richer tui widget mirrors the F-shape selector; edge writes use the existing writeEdge primitive. |
| Token core | `references/visual/palette.json` (121.5 seed) + `skills/ui-system/SKILL.md` (12 glyphs) | EXTEND | palette.json is explicitly the seed; add semantic pairs + 4 glyphs; ruling extends to the tui surface. |
| Token linter | mirror `scripts/check-substrate.cjs` grep-gate | NET-NEW (idiom reused) | a new linter, but copies the repo's existing grep-CI-guard pattern. |
| BUD / sub-room | `scripts/room-registry create` + `lib/core/room-auto-create.cjs` (+ SEED-001 if shipped) | DELEGATE | D-03: the navigator surfaces "bud" and CALLS the atomic wiring; reimplementing it is forbidden (Part 7). |
| `mos tui` ink app | none | NET-NEW | genuinely new surface; the SPEC's first justified TUI dependency. |
| Detect-and-adapt launcher | none (zero tmux/wezterm/zellij precedent in repo) | NET-NEW | genuinely new; probes env + which; emits a graph-derived workspace. |

## Sources

### Primary (HIGH confidence - live verification this session)
- `npm view ink@7.0.5 version dependencies engines peerDependencies type scripts` - ESM-only, react `>=19.2.0`, node `>=22`, no install scripts
- `npm view yoga-layout@3.2.1` + `npm pack` + tarball extraction - ships `dist/binaries/yoga-wasm-base64-esm.js` (base64 WASM in pure JS), zero deps, no install scripts
- `npm view react@19.2.6` + `npm pack` - CJS-compatible, no `type:module`, no native, no install scripts
- Real `npm install ink@7.0.5 react@19.2.6` - 38 packages, 19 MB, ZERO `.node`/`binding.gyp`/`.wasm`, ZERO install/postinstall/preinstall scripts; `ws@8.21.0` native peers optional + un-installed
- CJS boot harness (`require('react')` + `await import('ink')` + `React.createElement`) - rendered + unmounted cleanly (no JSX, no build step)
- `node -e` DatabaseSync `{readOnly:true}` accepted in Node 22.22.2
- Codebase reads: `lib/core/navigation.cjs`, `lib/core/navigation/focus.cjs`, `lib/core/room-db.cjs` (WAL at line 100), `lib/wiki/wiki-server.cjs` + `wiki-watcher.cjs` (SSE), `references/visual/palette.json`, `skills/ui-system/SKILL.md` (12-glyph table), `scripts/check-substrate.cjs` (grep gate), `bin/mindrian-tools.cjs` (subcommand switch), `.planning/config.json` (nyquist on)

### Secondary (MEDIUM confidence)
- `mindrian-tui-achievable.vercel.app` (WebFetch) - the reference mockup; NOTE it frames a "zellij workspace" which CONTRADICTS the locked tmux-default (D-11); follow CONTEXT, not the mockup
- `.planning/STATE.md` + `.planning/PROJECT.md` + `.planning/MILESTONES-NAMING.md` - SEED-001 is "sub-room atomic wiring" (partly scaffolded; confirm callable in Wave 0)

### Tertiary (LOW confidence - flagged for validation)
- tmux `set-hook pane-focus-in` reliability (A4) - documented but not tested on a live tmux this session
- the exact SEED-001 BUD callable (A3) - referenced, not located as a single shipped function

## Metadata

**Confidence breakdown:**
- ink vendoring VERDICT: HIGH - proven by real install + tarball inspection + boot render, not asserted
- Standard stack (versions): HIGH - all `npm view`-verified this session
- SSE read-API + read-only handle: HIGH - reuses shipped patterns; DatabaseSync readOnly verified
- Launcher probe order: MEDIUM - designed per D-11; tmux hook firing not live-tested (A4)
- BUD delegation target: MEDIUM - reuse intent clear; exact callable needs Wave 0 confirm (A3)
- Token core + linter: HIGH - palette.json + SKILL.md + check-substrate idiom all present

**Research date:** 2026-05-31
**Valid until:** 2026-06-30 (ink/react are fast-moving; re-run the vendoring grep on any version bump before release)
