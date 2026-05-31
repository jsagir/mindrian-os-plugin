# Phase 136: The Liquid State - One Render Spine (M5 render-spine layer) - Specification

**Created:** 2026-05-31
**Revised:** 2026-05-31 (Round 4 - SEAMLESS-FIRST consolidation: render model re-centered on inline + web as the universal default; mos tui demoted to opt-in; headless-core/thin-client sync; tmux-scripted adapt-launcher; cross-platform contract. See Interview Log.)
**Ambiguity score:** 0.16 (gate: <= 0.20)
**Requirements:** 12 locked
**Milestone:** v1.14.0 (ANCHOR)
**Authority:** `~/MindrianRooms/mindrianOS/product-evolution/architectural-mandates/M5-liquid-state-fractal-sos.md` (SEED, promoted to ADR by this phase)
**Canon parts:** 3 (decision gate), 4 (every choice is graph data), 7 (consolidation/reuse), 8 (graph boundary), 9 (memory locality), 10 (conversation/render is the surface)
**Reference design:** `https://mindrian-tui-achievable.vercel.app` (the validated, buildable mockup)

## Goal

Build M5's render-spine layer as ONE render engine (shape x delivery flags) feeding many thin-client surfaces over a single headless core. The SEAMLESS DEFAULT - working identically on Windows / Mac / Linux with zero setup - is (a) inline in-conversation rendering + the native AskUserQuestion gate, and (b) a one-command live web twin. The full-screen arrow-key `mos tui` is an OPT-IN power surface, hosted by a detect-and-adapt launcher (tmux scripted on Mac/Linux; WezTerm/mprocs on Windows) and generated from the room graph. The 7 legacy HTML commands collapse into the one engine; one De Stijl token core governs all surfaces. Render is never the moat - the truth layer (room.db graph) is.

## Background

The room has 7 separate HTML/visualization commands, each inventing its own rendering (`/mos:visualize` is already a flag-alias of `/mos:dashboard --mermaid`). `lib/render/render-v2.cjs` is the JTBD-aware inline renderer (Phase 102); `references/visual/palette.json` is the Phase 121.5 token seed; `skills/ui-system/SKILL.md` is the ruling (4-zone, 12-glyph, 5-color, scoped to command output). The web dashboard already runs on vendored `express` + `chokidar` + SSE. `room.db` is opened via **`node:sqlite` (`DatabaseSync`)** - Node's built-in SQLite, confirmed: no native binding, no `.node`/`binding.gyp` in the tree, vendored deps all pure-JS. The truth layer (room.db + resolver + offer_next_step + memory_event stream) shipped in Phase 135/109; `navigation.cjs` is the Part 9 chokepoint/single writer.

What does NOT exist: a single render engine with shape/delivery flags; a thin SSE read API on the core; an opt-in `mos tui`; the detect-and-adapt launcher; a single CI-enforced token core; the 4 new TUI glyphs. The Round-1..3 framing (mos tui as the PRIMARY CLI navigator, reading SQLite directly) is SUPERSEDED here by seamless-first + headless-core (see Interview Log Rounds 4).

## Requirements

1. **One render engine + flag dispatch**: A single engine renders any `shape` for any `delivery`; the 7 HTML commands become thin flag-aliases.
   - Current: 7 commands each implement their own render; visualize already aliased
   - Target: one engine accepts `{shape: deck|mermaid|wiki|grid|dashboard|snapshot, delivery: inline|web|tui|file}`; `/mos:dashboard` == `render --shape dashboard --deliver web` (+ a one-line "powered by the render spine" note); no legacy command keeps its own render body
   - Acceptance: a test drives every (shape x delivery) the 7 commands needed; grep proves no legacy command file contains a render/HTML body

2. **Seamless default = inline + web twin (universal, zero setup)**: The default experience needs no install, no multiplexer, no separate process, and works identically on Windows/Mac/Linux.
   - Current: render-v2 exists for inline; express/SSE exists for web
   - Target: `delivery: inline` renders the 4-zone navigator-as-text in Larry's responses with the gate via native AskUserQuestion; `delivery: web` is a one-command live twin (browser). Neither requires anything beyond Claude Code + Node + a browser
   - Acceptance: on a clean install with no tmux/zellij/ink present, both inline rendering and the web twin work end-to-end; a test asserts the inline path spawns zero processes and the web path reuses the existing express server

3. **Headless core + thin clients (single source, single writer)**: All surfaces read one core; none touches room.db directly.
   - Current: navigation.cjs is the chokepoint; web server reads room state ad hoc
   - Target: `navigation.cjs` is the sole writer and exposes a thin local read API (SSE over the existing express server); inline, web, and `mos tui` all consume that API - no client opens room.db directly. The core owns the `node:sqlite` handle (WAL, busy_timeout=5000, synchronous=NORMAL, single-writer, short reads)
   - Acceptance: grep proves zero `node:sqlite`/`DatabaseSync` opens outside `navigation.cjs` + the core; a test drives inline + web + a simulated tui client off the SSE API and asserts identical state (no divergence); concurrency test passes with no lock error

4. **`mos tui` - opt-in arrow-key navigator (ink, buildless, lazy deps)**: The full-screen terminal navigator, demoted from default to opt-in.
   - Current: no TUI; no TUI lib installed; prior phases "zero TUI dependency"
   - Target: an ink-based (`React.createElement`, NO JSX, no build step) full-screen app: arrow-key fractal tree (up/down move, right/Enter expand, left collapse), Tab cycles panes, shape hotkey switches views; it is a thin client of the SSE core; its deps are lazy/opt-in so the seamless base ships lean; the ink dep tree must pass the vendoring re-audit (pure-JS/WASM only - yoga must be WASM, no native addon)
   - Acceptance: `mos tui` against a seeded room renders + arrow-navigates + restores the terminal cleanly on quit; a test confirms the seamless default works with ink ABSENT; the vendoring audit confirms zero native addons in the ink tree

5. **Detect-and-adapt launcher (graph-generated workspace)**: The opt-in workspace is generated from the room graph and hosted by whatever is present.
   - Current: no launcher; user would hand-arrange panes
   - Target: a `mos` launcher where `navigation.cjs` reads the room graph and emits the workspace (session=room, window=section, pane=surface: Claude Code + mos tui + web). Host precedence: WezTerm if running, zellij if installed, else **tmux (scripted, `$TMUX`-aware to add windows not rival sessions)**; on native Windows route to WezTerm/mprocs; web-twin as the no-multiplexer fallback. tmux hooks (window/pane focus) emit `focus_changed` memory_events (navigation = journaled graph data)
   - Acceptance: the launcher composes the workspace with zero user config on a machine with tmux; on a machine without it, it routes to the next available host or the web twin; a tmux window-switch writes a `focus_changed` event (verified in the event log)

6. **The gate is the write node (arrow-toggle multi-select + always-present open text)**: The decision gate is where browsing becomes a typed graph mutation.
   - Current: AskUserQuestion supports multiSelect + Other; no richer persistent gate; Canon Part 3 frames "select one -> one edge"
   - Target: arrow-navigate + Space-toggle multi-select + Tab to the always-present free-text (Part 3 invariant) + Enter to commit the SET. Native AskUserQuestion (<=4 options) is the seamless inline gate; a richer widget (>4 / persistent) lives in `mos tui` (surfaced via split + zoom) and the web twin. Each toggled option commits its OWN typed `DECISION` edge (carrying tri-context LOCAL+BRAIN+SIGNAL, Part 4); free-text commits a `FREE_TEXT` edge Larry routes; a live "would write to room.db" preview updates as you toggle; confirm fans a memory_event to every surface
   - Acceptance: a test toggles two options + free-text and asserts THREE writes (2 DECISION + 1 FREE_TEXT edges) through navigation.cjs; the preview reflects pending edges before confirm; a rejection-with-reason captures the reason; confirming updates inline + web + tui via one memory_event

7. **Single De Stijl token core (contrast-checked, semantic, glyph-backed, CI-enforced)**: One token source every renderer obeys.
   - Current: design values scattered; palette.json is a seed; glyph vocab scoped to command output
   - Target: extend `palette.json` into a surface-agnostic token graph of **semantic color PAIRS** (each meaning bound to a hue + its terminal-legible variant, contrast-checked to WCAG 3:1 UI / 4.5:1 text); **color is always glyph-backed** (never color alone); add the 4 TUI glyphs (`◇` cross-room, `○` empty, `☑`/`☐` multi-select) to the vocabulary; extend `ui-system/SKILL.md` to cover the TUI surface (or document it as a named exception like the statusline); a CI linter rejects any renderer hardcoding a value outside the token core
   - Acceptance: the linter fails on a planted hardcoded hex/glyph and passes on the engine; all three surfaces render a shape using only token-core values (grep); a contrast check passes on the semantic pairs

8. **Fractal navigation (depth + zoom/re-root + bud + cross-wall edges)**: The navigator is self-similar at every scale (M5).
   - Current: tree expand/collapse only
   - Target: arbitrary-depth recursion; ZOOM re-roots at any node as a complete ICM (persisted as a `focus_changed` memory_event, reuse Phase 129.5 focus pattern; cross-surface); BUD promotes a section to its own room via the SEED-001 atomic sub-room contract (the navigator surfaces it, does not reimplement it); cross-wall edges surface in the graph view / suggestion slot, never by reordering the tree (M5 hard rule 1)
   - Acceptance: a 4+-level room renders fully; zoom re-roots with a breadcrumb + writes a focus event; bud yields a registered sub-room (SEED-001); a cross-section edge shows in the graph/slot with tree order byte-identical

9. **LazyGraph overlay (intent filters, temporal ranks, never reorders)**: The suggestion slot overlays the stable tree.
   - Current: no suggestion slot wired to the navigator
   - Target: the slot surfaces LazyGraph signals that highlight in place + whisper a reason; intent gates WHICH recent events are eligible, temporal ranks within (M5 "intent gates, temporal ranks"); silent unless something relevant to the active JTBD changed; human intent sovereign, agent intent never overrides
   - Acceptance: injecting a suggestion leaves tree node order byte-identical; the slot is silent when nothing relevant changed

10. **Dual render (graph + language)**: Graph-native truths render as BOTH a graph view and a natural-language line.
    - Current: views are graph OR prose, not paired
    - Target: a graph-native relation emits both the graph representation and a sentence naming it in the same render
    - Acceptance: a seeded CONTRADICTS edge produces a visible edge AND a sentence in one render

11. **Cross-platform contract**: The default is universal; the opt-in host is platform-routed.
    - Current: plugin already ships cross-platform under the pure-JS vendoring rule; Windows testers in the loop; prior Windows path fixes (beta.32/36)
    - Target: inline + web work identically on Windows/Mac/Linux (core portable - `node:sqlite` confirmed, pure-JS vendored tree, no native addon); the opt-in host is routed (tmux on Mac/Linux, WezTerm/mprocs on native Windows, web fallback); pin a Node 22+ floor (for `node:sqlite`/`DatabaseSync`); `mos tui` honors Windows path discipline (`path.join`, normwin pattern)
    - Acceptance: inline + web pass on all three platforms (or the platform-matrixed CI proxy); the launcher routes correctly per platform; a grep confirms no native addon entered the vendored tree

12. **Canon Part 8 + Part 9 clean**: Zero user bytes to Brain; the core is the only door.
    - Current: navigation.cjs is the chokepoint; brain-boundary-scan exists
    - Target: every surface reaches room.db ONLY through `navigation.cjs`; no render/SSE path sends user content to the Brain; the core owning the single SQLite handle removes client-side concurrency entirely
    - Acceptance: `brain-boundary-scan` passes on all new files; grep confirms zero direct sqlite opens outside the core

## Boundaries

**In scope:**
- One render engine (shape x delivery flags); 7 HTML commands -> flag-aliases
- Seamless default: inline (4-zone + native AskUserQuestion) + one-command web twin
- Headless core: navigation.cjs single writer + node:sqlite WAL + thin SSE read API; all surfaces are thin clients
- Opt-in `mos tui` (ink, no-JSX, lazy deps) + the detect-and-adapt launcher (tmux scripted / WezTerm / mprocs / web), graph-generated, `$TMUX`-aware
- The gate as write node: arrow-toggle multi-select + always-present open-text; native (<=4) inline, richer in tui+web; each pick a typed edge; live preview
- Single De Stijl token core (semantic contrast-checked pairs, glyph-backed, +4 glyphs, ruling extended, CI linter)
- Fractal navigation (depth + zoom/re-root + bud via SEED-001 + cross-wall edges)
- LazyGraph overlay; dual render; cross-platform contract; Part 8/9 clean
- Promotion of M5 from SEED to ADR

**Out of scope:**
- A single Claude-Code-native docked surface - impossible (CC owns its screen); the default is inline + web, the opt-in is a sibling process
- Building a standalone agentic TUI that owns the conversation (OpenCode/Crush model) - rebuilds the harness; the moat is the graph (Canon Part 7)
- New Desktop/Cowork rendering beyond the AskUserQuestion baseline - degrade-only; `mos tui` is CLI-only
- Multi-user/team collaboration + Brain-API-key onboarding - the GTM deal-blockers; separate work (sequencing risk recorded)
- Truth-layer changes (room.db schema, resolver) - shipped Phase 135/109, consumed read-only

## Constraints

- **Seamless is the hard requirement**: the default path must require zero install / zero multiplexer / zero config and run identically cross-platform. Any friction (ink deps, tmux, layout setup) is quarantined to the opt-in path.
- **Headless-core single-writer**: navigation.cjs is the only writer and the only room.db door; clients consume the SSE read API. node:sqlite WAL + busy_timeout=5000 + synchronous=NORMAL + short reads.
- **Vendoring stays pure-JS** (release.sh Step 6.7): ink/react are pure-JS; yoga must be WASM; no native addon may enter the single cross-platform tree. ink deps are lazy/opt-in to keep the seamless base lean.
- **No build step** (CLAUDE.md): ink via `React.createElement`, not JSX.
- **Reuse before build** (Part 7): extend render-v2 + palette.json + the express server + navigation.cjs + the SEED-001 sub-room contract; do NOT add a new HTTP server, token system, or reimplement bud.
- **Canon**: Part 8 (no user bytes to Brain; brain-boundary-scan gate), Part 9 (navigation.cjs chokepoint), 12-glyph + 4-zone ruling extended to the TUI surface; no em-dashes anywhere.
- **Milestone-scale**: decomposes into a cluster (engine core / headless SSE API / token core / inline+web seamless default / opt-in mos tui + launcher) at plan-phase.

## Acceptance Criteria

- [ ] One engine renders all (shape x delivery); 7 commands are flag-aliases; no legacy render bodies remain
- [ ] Seamless default works on a clean install with NO tmux/zellij/ink present (inline + web); inline spawns zero processes
- [ ] Headless core: zero direct sqlite opens outside navigation.cjs+core; inline/web/tui read identical state via SSE; concurrency clean
- [ ] `mos tui` (ink, no-JSX) arrow-navigates + restores terminal; seamless default works with ink absent; vendoring audit finds zero native addons
- [ ] Launcher composes the workspace from the graph with zero config (tmux present); routes to WezTerm/mprocs/web otherwise; tmux focus -> memory_event
- [ ] Gate: arrow + Space multi-select + open-text; native (<=4) inline / richer in tui+web; each pick its own typed edge; free-text -> FREE_TEXT edge; live preview; confirm fans a memory_event to all surfaces
- [ ] CI linter fails on a hardcoded color/glyph; semantic pairs pass contrast (3:1/4.5:1); the 4 TUI glyphs are in the vocabulary; ruling covers the TUI surface
- [ ] Fractal: 4+ levels render; zoom re-roots (+focus event); bud -> SEED-001 sub-room; cross-wall edge shows with tree order unchanged
- [ ] LazyGraph overlays only (tree order byte-identical), silent when irrelevant; dual render emits graph + sentence
- [ ] Cross-platform: inline + web pass on Windows/Mac/Linux; node:sqlite + pure-JS tree confirmed; launcher platform-routes; Node 22+ floor pinned
- [ ] `brain-boundary-scan` passes; M5 promoted SEED -> ADR

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                   |
|--------------------|-------|------|--------|-------------------------------------------------------------------------|
| Goal Clarity       | 0.88  | 0.75 | ✓      | Seamless-first resolves the render-model question definitively          |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | default vs opt-in split is sharp; CC-native-surface + standalone out     |
| Constraint Clarity | 0.80  | 0.65 | ✓      | headless-core + vendoring + cross-platform contracts explicit           |
| Acceptance Criteria| 0.82  | 0.70 | ✓      | per-surface + cross-platform + write-path acceptance                    |
| **Ambiguity**      | 0.16  | <=0.20| ✓     | Gate passed - cleaner than Round 3 (the flip removed the central fork)  |

Status: ✓ = met minimum.

## Open items (deferred to plan-phase, do not block this spec)

- Exact thin SSE read-API shape (endpoints, event payloads - enum/handle only per Part 8).
- ink vendoring re-audit OUTCOME (confirm yoga WASM / no native addon) + lazy-load mechanism for the opt-in deps.
- Launcher detect logic specifics ($TMUX/WezTerm/zellij/mprocs probe order + the graph -> layout generator).
- M5 knobs that are pure-how: breadcrumb style, tmux hook set, WAL checkpoint cadence.

## Interview Log

| Round | Perspective     | Decision locked                                                                                     |
|-------|-----------------|-----------------------------------------------------------------------------------------------------|
| 1     | Researcher      | scope = all of M5 render spine; anchor v1.14.0 now (architecture-led; GTM risk recorded)            |
| 2     | Boundary Keeper | 7 commands -> flag-aliases; Desktop/Cowork degrade-only                                              |
| 3     | Navigator-need  | arrow-key navigator wanted; coexists as a separate process (lazygit model); multi-select + free-text |
| 3.5   | Boundary Keeper | fractal nav is real (Req 8): depth + zoom/re-root + bud + cross-wall edges                           |
| 4     | Product (you)   | SEAMLESS is the hard requirement -> inline + web are the universal default; mos tui demoted to opt-in |
| 4     | Field research  | headless-core + thin-clients (Tavily: open-design/OpenDev/OpenCode) supersedes direct-SQLite-read    |
| 4     | Field research  | host = tmux (scripted) default; detect-and-adapt (WezTerm/mprocs on Windows); NOT zellij-as-default  |
| 4     | Cohesion        | tmux = a projection of the room graph (session=room/window=section/pane=surface); hooks -> events    |
| 4     | Feasibility     | cross-platform confirmed: node:sqlite (no native binding) + pure-JS tree; tmux Unix-only -> routed   |
| 4     | Canon           | gate is the write node (Part 3/4/9); token core = contrast-checked semantic pairs, glyph-backed      |

---

*Phase: 136-the-liquid-state-one-render-spine-m5-render-spine-layer-v1-1*
*Spec created: 2026-05-31 (Round 4 seamless-first consolidation, same day)*
*Next step: /gsd:plan-phase 136 - the spec now matches the validated design (reference: mindrian-tui-achievable.vercel.app)*
