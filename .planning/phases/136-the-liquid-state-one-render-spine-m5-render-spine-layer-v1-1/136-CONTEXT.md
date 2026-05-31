# Phase 136: The Liquid State - One Render Spine - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 136 builds M5's render-spine layer: ONE render engine (shape x delivery flags) that collapses the 7 HTML commands, drives the `mos tui` full-screen arrow-key navigator (a separate lazygit-style process), Larry's in-conversation 4-zone inline render, and a live-SSE web twin - all reading room.db only through navigation.cjs and obeying one De Stijl token core. This discussion clarifies HOW; the WHAT is locked in 136-SPEC.md. New capabilities (multi-user, onboarding) are out of scope.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**12 requirements are locked.** See `136-SPEC.md` for full requirements, boundaries, and acceptance criteria. Downstream agents MUST read `136-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):** one render engine (shape x delivery flags); 7 HTML commands retired to flag-aliases; `mos tui` arrow-key navigator (primary CLI surface, separate process); inline 4-zone render (zero-process fallback); live event subscription (chokidar) for TUI + web twin + headless `mos watch`; web live-wiki twin (existing express/chokidar/SSE); LazyGraph overlay suggestion slot; arrow-key multi-select + free-text selector; single De Stijl token + component source + CI linter; dual render (graph + language); fractal navigation (arbitrary depth + zoom/re-root + bud + cross-wall edges); one new TUI-lib dependency; promote M5 SEED to ADR.

**Out of scope (from SPEC.md):** new Desktop/Cowork rendering beyond AskUserQuestion baseline (degrade-only); rendering the navigator INSIDE the Claude Code conversation pane (impossible - lives in `mos tui`); multi-user/team collaboration + Brain-API-key onboarding (other phases); truth-layer changes (Phase 135/109, read-only here).

</spec_lock>

<decisions>
## Implementation Decisions

### TUI rendering stack
- **D-01:** TUI library = **ink** (React-based JSX components). Chosen for alignment with Req-7's single component source - ink components map cleanly to the De Stijl token core, and the CI linter can enforce token usage at the component layer. Actively maintained, pure-JS (vendorable). Accepted cost: vendors React into the production tree (pure-JS, so the cross-platform vendoring rule holds). First justified break of the prior "zero TUI dependency" precedent.
- **D-02:** Concurrency model = **SQLite WAL mode + a read-only handle exposed by navigation.cjs**. `mos tui` opens room.db read-only; WAL lets the long-lived reader and a concurrent Claude Code writer coexist without blocking or corruption. Live updates fire on a chokidar event, then re-read via the read-only handle. navigation.cjs gains a read-only open mode (the only door, per M1).

### Fractal navigation (Req 12)
- **D-03:** BUD = **delegate to the SEED-001 atomic sub-room contract** via navigation.cjs. The navigator surfaces "bud / open as room" and CALLS the existing atomic-or-fail-closed sub-room wiring; Phase 136 does NOT reimplement promotion (Canon Part 7 reuse). Keeps 136 a render phase.
- **D-04:** ZOOM (re-root at a node) = **persisted as a `focus_changed` memory_event** (reuse the focus-node pattern shipped in Phase 129.5 via `lib/core/navigation/focus.cjs`). Zoom state survives, is cross-surface consistent, and costs almost nothing because the event type already exists. Note the audit-node carve-out: `focus_changed` is a system-bookkeeping node (Canon Part 9), not a truth-claim - no human-confirm needed.

### mos tui <-> conversation
- **D-05:** Sync = **two-way via the `focus_changed` event**. A TUI selection/zoom writes the same focus event Larry's next inline turn reads, so the conversation and the TUI stay in lockstep ("the gtm node you are on"). Reuses D-04; near-zero extra cost.

### LazyGraph behavior (M5 knobs)
- **D-06:** Wikilink authorship = **Larry proposes, founder approves**. The LazyGraph proposes candidate cross-wall links in the suggestion slot; the human confirms. Same HITL gate as the offer-loop (Phase 135) and consistent with Canon Part 9 (the human confirms truth). A proposed link lands `review_status: proposed`; approval promotes it. Engagement + moat deepen on approval, not on a silent write.
- **D-07:** Intent = **FILTER the temporal stream, then temporal ranks within**. Intent gates WHICH recent events are eligible (relevant to the active JTBD/operator); temporal ranks inside that set. This is M5's literal wording ("intent gates, temporal ranks"), the cheaper computation, and it avoids the "gas" failure (distant signals drowning the relevant ones).
- **D-08:** Sidebar highlight = **in-place on the tree + whisper into the suggestion slot**. The LazyGraph highlights the relevant node in the tree (never reordering it - M5 hard rule 1) and states the reason in the existing slot. Keeps it "a map you roam," not a linear march. Matches the shipped simulation's behavior.

### Round 4 - Seamless-first consolidation (2026-05-31; validated via CC feasibility review + Tavily best-practices + alternatives research; supersedes the Round-3 "mos tui as primary, reads SQLite directly" framing)
- **D-09 (render model flip):** SEAMLESS is the hard requirement. The universal default is **inline** (in-conversation 4-zone render + native AskUserQuestion gate) **+ web twin** (one command, live SSE, browser) - both work identically Windows/Mac/Linux with zero setup. **`mos tui` is demoted to an OPT-IN power surface.** Rationale: Claude Code owns its screen (no native docked surface possible), and a separate binary + multiplexer is the opposite of seamless. Render is never the moat.
- **D-10 (headless core + thin clients):** `navigation.cjs` is the single writer + sole room.db door, exposing a **thin SSE read API** over the existing express server. inline / web / mos tui are all **thin clients** - none opens room.db directly. Supersedes the Round-2 direct-SQLite-read concurrency model (validated: open-design, OpenDev, OpenCode all use headless-core + thin frontends). Core pragmas: WAL, busy_timeout=5000, synchronous=NORMAL, single-writer, short reads.
- **D-11 (opt-in host = detect-and-adapt launcher):** A `mos` launcher where navigation.cjs **generates the workspace from the room graph** (session=room, window=section, pane=surface). Host precedence: WezTerm if running, zellij if installed, else **tmux (scripted, `$TMUX`-aware)**; native Windows routes to **WezTerm/mprocs**; web-twin is the no-multiplexer fallback. **tmux is a second projection of the graph** - its hooks (window/pane focus) emit `focus_changed` memory_events (navigation = journaled graph data). NOT zellij-as-default (80MB/beta/not-preinstalled = friction).
- **D-12 (ink, buildless, lazy):** `mos tui` uses ink via **`React.createElement` (no JSX, no build step)**; ink deps are **lazy/opt-in** so the seamless base ships lean; the ink tree must pass the **vendoring re-audit** (pure-JS/WASM only; yoga must be WASM; no native addon in the single cross-platform vendored tree).
- **D-13 (gate = write node):** The decision gate is where browsing becomes a typed graph mutation. **Native AskUserQuestion (<=4 options)** is the seamless inline gate; a **richer widget (>4 / persistent)** lives in mos tui (split+zoom) and the web twin. Arrow-navigate + Space-toggle multi-select + always-present open-text (Part 3 invariant) + Enter commits the set; each pick a typed `DECISION` edge, open-text a `FREE_TEXT` edge; **live "would write to room.db" preview**; confirm fans one memory_event to every surface. (Refines D-06/Req 11.)
- **D-14 (token core):** Extend palette.json into a surface-agnostic token graph of **contrast-checked semantic color PAIRS** (WCAG 3:1 UI / 4.5:1 text), each meaning bound to a De Stijl hue + its terminal-legible variant; **color always glyph-backed** (never color alone); add 4 TUI glyphs (`◇ ○ ☑ ☐`) to the vocabulary; extend `ui-system/SKILL.md` to the TUI surface (or document as a named exception); CI linter enforces it.
- **D-15 (cross-platform contract):** Default (inline+web) is universal - confirmed portable (`node:sqlite`/`DatabaseSync`, no native binding; pure-JS vendored tree). Opt-in host is platform-routed (tmux Unix / WezTerm-mprocs Windows / web fallback). Pin a **Node 22+ floor** (node:sqlite). mos tui honors Windows path discipline (path.join / normwin).
- **D-16 (packaging):** Ships with the plugin in one install; `mos tui` is CLI-active-only; reference design = `mindrian-tui-achievable.vercel.app`. Three mockups committed in this phase dir (sim / holistic / achievable); the achievable one is canonical.

### Claude's Discretion
- Exact ink component decomposition, key-binding map beyond the SPEC's stated keys (arrows / Tab / Enter / Space / q / shape hotkey / zoom key), breadcrumb rendering style, and the WAL checkpoint cadence are left to the planner/executor within the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements + product thesis
- `.planning/phases/136-the-liquid-state-one-render-spine-m5-render-spine-layer-v1-1/136-SPEC.md` - Locked requirements, boundaries, acceptance criteria. MUST read before planning.
- `~/MindrianRooms/mindrianOS/product-evolution/architectural-mandates/M5-liquid-state-fractal-sos.md` - the render-spine thesis (solid ICM tree + liquid LazyGraph; render is never the moat). Promote SEED to ADR in this phase.

### Canon + mandates
- `docs/MINDRIAN-CANON.md` Part 7 (reuse before build - bud delegates to SEED-001), Part 8 (graph boundary), Part 9 (memory locality, human-confirms-truth, focus-node audit carve-out), Part 3 (Decision Gate + the multi-select additive extension), Part 10 (render is the surface).
- `docs/architecture/SUBSTRATE-CONTRACT.md` (M1, Phase 128) - navigation.cjs is the ONLY door to room.db; the read-only handle (D-02) must go through it.

### Reuse targets (the substrate this phase extends)
- `references/visual/palette.json` - the Phase 121.5 token seed to extend into the surface-agnostic token core (D-01 token enforcement).
- `lib/core/navigation.cjs` - the Part 9 chokepoint; add a read-only open mode (D-02). All render paths read through it.
- `lib/core/navigation/focus.cjs` - the `focus_changed` memory_event (Phase 129.5) reused for zoom + two-way sync (D-04, D-05).
- `lib/render/render-v2.cjs` + `lib/render/render.cjs` - the inline 4-zone render to extend; the engine seed.
- the SEED-001 sub-room wiring contract (atomic sub-room creation; researcher to confirm exact path - likely `scripts/room-registry` create path + the wiring chokepoint) - reused for BUD (D-03).
- Phase 88.2 AskUserQuestion selector / `lib/hmi/selector-dispatcher.cjs` - the selector to mirror for arrow-key multi-select + free-text in the TUI.
- the 7 HTML command templates (`commands/dashboard.md` etc. + their dashboard/wiki/present generators) + the express/chokidar SSE dashboard server - the seed shapes to consolidate + the web twin transport.
- `skills/ui-system/SKILL.md` - the 12-glyph vocabulary + 4-zone anatomy the engine output must obey.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `render-v2.cjs`: extend into the one engine (the inline `delivery` target already exists).
- `palette.json`: the token seed; the token core extends it, the linter enforces it.
- express + chokidar dashboard server: the web twin reuses it (no second HTTP server).
- `navigation.cjs` + `focus.cjs`: the chokepoint + the focus event for zoom/sync.
- SEED-001 sub-room contract: bud reuses it wholesale.
- AskUserQuestion / selector-dispatcher: the gate primitive to mirror in the TUI.

### Established Patterns
- M1 substrate contract: navigation.cjs is the only door (read-only handle must comply).
- M2 local-graph-awareness: every surface emits/consumes memory_event (focus_changed for the TUI).
- Current-vs-final discipline (Canon Part 7): the shape catalog, token set, and key-map are OPEN vocabularies.

### Integration Points
- New `mos tui` entry point (a `bin/` binary or `mindrian-tools` subcommand) that boots ink, opens room.db read-only via navigation.cjs, and subscribes via chokidar.
- room.db switched to WAL mode (one-time PRAGMA) so the long-lived reader coexists with writers.

</code_context>

<specifics>
## Specific Ideas

- The deployed interactive simulation at `mindrian-136-tui-sim.vercel.app` (source: `136-tui-simulation.html`) is the look-and-feel reference: arrow-key tree, in-place highlight + slot whisper, multi-select-via-space gate, free-text escape. Build to match its behavior.

</specifics>

<deferred>
## Deferred Ideas

None new - the discussion stayed within phase scope and resolved every open item the SPEC deferred. The GTM sequencing risk (testers pull for multi-user + onboarding, not a navigator) is recorded in 136-SPEC.md and is a milestone-sequencing decision, not a 136 implementation decision.

</deferred>

---

*Phase: 136-the-liquid-state-one-render-spine-m5-render-spine-layer-v1-1*
*Context gathered: 2026-05-31*
