# Phase 136: The Liquid State - One Render Spine (M5 render-spine layer) - Specification

**Created:** 2026-05-31
**Revised:** 2026-05-31 (Round 3 - render model flipped to a real arrow-key `mos tui` binary; see Interview Log)
**Ambiguity score:** 0.21 (gate: <= 0.20; just over - residual is deferred how-decisions, see Ambiguity Report)
**Requirements:** 11 locked
**Milestone:** v1.14.0 (ANCHOR)
**Authority:** `~/MindrianRooms/mindrianOS/product-evolution/architectural-mandates/M5-liquid-state-fractal-sos.md` (SEED, promoted to ADR by this phase)
**Canon parts:** 7 (consolidation), 8 (graph boundary), 9 (memory locality), 10 (render is the surface)

## Goal

The 7 divergent HTML commands (dashboard / wiki / present / publish / export / visualize / snapshot) collapse into ONE render engine where `shape` and `delivery` are flags; that engine drives a real full-screen, arrow-key-navigable `mos tui` binary (the lazygit-style CLI navigator: fractal ICM tree + view pane + LazyGraph suggestion slot, keyboard-driven, live-subscribed to room.db), Larry's in-conversation 4-zone render (for conversational turns), and a live-SSE web twin - all reading room.db only through `lib/core/navigation.cjs` and all obeying a single De Stijl token source.

## Background

Today the room has 7 separate HTML/visualization commands that each invent their own rendering. `/mos:visualize` is already deprecated into `/mos:dashboard --mermaid`, so the collapse has begun but is not systematized. `lib/render/render-v2.cjs` + `render.cjs` exist (JTBD-aware context-render from Phase 102); `references/visual/palette.json` is the Phase 121.5 token seed; `skills/ui-system/SKILL.md` defines the 4-zone anatomy + 12-glyph vocabulary. The web dashboard already runs on `express` + `chokidar` (file-watch) with SSE live-reload. There is NO full-screen TUI library in the dependency tree (no ink/blessed/terminal-kit). The truth layer this renders (room.db graph + resolver + `offer_next_step` + `memory_event` stream) shipped in Phase 135 / 109. What does NOT exist: a single render engine with shape/delivery flags, a token contract every renderer obeys, an arrow-key full-screen navigator, or a CLI surface that live-subscribes to room.db.

**Render-model decision (Round 3):** the navigator is a genuine full-screen TUI process (`mos tui`), launched in a terminal ALONGSIDE Claude Code - the same coexistence model lazygit uses. It is NOT rendered inside the Claude Code conversation pane (a conversation cannot capture raw arrow-key events). Larry's in-conversation responses still render the 4-zone text output for conversational turns; the rich keyboard-navigable experience lives in `mos tui`.

## Requirements

1. **One render engine + flag dispatch**: A single engine renders any `shape` for any `delivery`, replacing 7 bespoke command implementations.
   - Current: 7 commands each implement their own HTML/render logic; no shared engine
   - Target: one engine module accepts `{shape: deck|mermaid|wiki|grid|dashboard|snapshot, delivery: tui|web|file|inline}` and produces the corresponding output; all rendering routes through it
   - Acceptance: a test invokes the engine for each (shape x delivery) combination used by the 7 legacy commands and gets non-empty correct output; grep proves no legacy command file contains its own render/HTML body

2. **Seven commands retired to flag-aliases**: Each legacy command becomes a thin alias on the engine, still working, with a one-line provenance note.
   - Current: dashboard/wiki/present/publish/export/snapshot are full commands; visualize already deprecated
   - Target: each of the 7 command files becomes a thin wrapper that calls the engine with fixed flags and emits a one-line "powered by the render spine" note; no user-facing breakage
   - Acceptance: running each of the 7 commands produces the same class of artifact as before AND the command body is reduced to an engine call + alias note (line-count + grep); `/mos:dashboard` equals `render --shape dashboard --deliver web`

3. **`mos tui` arrow-key full-screen navigator (the primary CLI navigator)**: A real keyboard-driven full-screen terminal app, launched alongside Claude Code.
   - Current: no full-screen TUI exists; no TUI library installed; prior phases were "zero TUI dependency"
   - Target: `mos tui` opens a full-screen app where ARROW KEYS navigate the fractal ICM tree (up/down moves the highlight, right/Enter expands a node, left collapses), TAB cycles panes (tree / view / suggestion slot), and a shape hotkey switches views (deck/mermaid/wiki/grid); it runs as its own process in a terminal, not inside the Claude Code conversation pane
   - Acceptance: launching `mos tui` against a seeded room renders the tree; simulated arrow-down moves the selection to the next node; right-arrow expands; the selected node's content shows in the view pane; the process owns the terminal in raw mode and restores it cleanly on quit (q / Ctrl-C)

4. **Live event subscription (true, not turn-based)**: The TUI and web twin subscribe to room.db events and update live; they never rebuild on a timer.
   - Current: only the web server tails events; no CLI live surface
   - Target: `mos tui` (a persistent process) and the web twin both subscribe to `memory_event` via chokidar and re-render the affected region on change, never on a timer (M5 hard rule 3); a headless `mos watch` event-feed mode is available for users who want the stream without the full TUI
   - Acceptance: with `mos tui` open, filing an artifact in a concurrent Claude Code session causes the tree/strip to update within the watch interval with no manual refresh; a test asserts the update is event-driven (fires on change) not interval-driven (no setInterval poll of room.db)

5. **Larry's in-conversation render survives (conversational turns)**: The engine still renders 4-zone text output inside the Claude Code conversation.
   - Current: render-v2.cjs produces JTBD-aware in-conversation output
   - Target: `delivery: inline` renders the 4-zone navigator-as-text for Larry's conversational responses (header / body / intelligence strip / action footer); this is the surface that works with zero processes, the fallback when `mos tui` is not running
   - Acceptance: a conversational turn renders the 4-zone block via the engine with no process spawned; the inline render and the `mos tui` render read the same room.db state via navigation.cjs (no divergence)

6. **LazyGraph overlay (never reorders the ICM)**: The suggestion slot overlays the stable tree; intent gates, temporal ranks.
   - Current: no suggestion slot wired to a navigator tree
   - Target: in both `mos tui` and inline, the suggestion slot surfaces LazyGraph signals that OVERLAY (highlight in place / whisper an edge) and NEVER reorder the ICM tree (M5 hard rule 1); it speaks only when something recently changed (temporal) that serves the active JTBD/operator (intent); human intent is sovereign, agent-proposed intent never overrides
   - Acceptance: a test injecting a LazyGraph suggestion asserts tree node order is byte-identical before/after (overlay only); a test asserts the slot is silent when no memory_event changed since last render AND when the change does not serve the active JTBD

7. **Single De Stijl token + component source (token core)**: One token graph every renderer obeys, extended from palette.json, enforced by a linter.
   - Current: design values scattered (palette.json seed + DS_HEX in visual-ops + destijl CSS + shared CSS); no enforced single source
   - Target: a surface-agnostic token source (color + type + spacing + glyph + component specs) extends `references/visual/palette.json`; the TUI, web twin, and inline render all pull from it; a CI linter rejects any renderer hardcoding a color/glyph/token outside the source
   - Acceptance: the linter fails on a planted hardcoded hex/glyph in a render file and passes on the engine; all three surfaces render a given shape using only token-source values (no inline literals, verified by grep)

8. **Dual render (graph + language)**: Graph-native truths render as BOTH a graph view and a natural-language line.
   - Current: views are either graph or prose, not paired
   - Target: for a graph-native relation, the engine emits both the graph representation (see it) and a natural-language sentence (understand it) in the same render
   - Acceptance: rendering a seeded CONTRADICTS edge produces both a visible edge in the graph view AND a sentence naming the relation in the same output

9. **Desktop/Cowork degrade-only**: No new Desktop/Cowork rendering; the engine degrades to the AskUserQuestion baseline.
   - Current: Desktop/Cowork use the AskUserQuestion selector baseline (Phase 88.2)
   - Target: on Desktop/Cowork the engine degrades to the existing AskUserQuestion baseline with no new surface built; `mos tui` is a CLI-only surface; no crash, no missing-feature error
   - Acceptance: invoking the engine under a simulated Desktop/Cowork surface flag returns the AskUserQuestion baseline path and never attempts a TUI/web render (verified by test)

10. **Canon Part 8 + Part 9 clean, concurrency-safe**: Zero user bytes to Brain; all room.db access via the chokepoint; the TUI reads concurrently with a live Claude Code session without corruption.
    - Current: navigation.cjs is the Part 9 chokepoint; brain-boundary-scan exists; SQLite concurrency not yet exercised by a long-lived reader
    - Target: every render path (TUI, web, inline) reads room.db ONLY through `lib/core/navigation.cjs`; no render path sends user content to the Brain; the `mos tui` long-lived reader and a concurrent Claude Code writer do not corrupt or deadlock room.db (read path is concurrency-safe, e.g. WAL/read-only handle via the chokepoint)
    - Acceptance: `brain-boundary-scan` passes on all new files; grep/instrumented test asserts zero direct `node:sqlite`/room-db opener requires in the engine/TUI/web paths; a concurrency test runs `mos tui` reads against simultaneous navigation.cjs writes with no corruption/lock error

11. **Decision-gate selector: arrow-key, multi-select, free-text escape**: The selector the navigator presents supports keyboard navigation, selecting MORE THAN ONE option, and an open-text escape for a direction nobody proposed.
    - Current: AskUserQuestion supports single-select + multiSelect + an "Other" free-text on the inline/Desktop surface, but no arrow-key multi-select widget exists in a CLI full-screen surface; Canon Part 3 frames the gate as "selects one -> one typed edge"
    - Target: in `mos tui` (and mirrored on the inline surface), the F-shape selector supports ARROW keys to move the highlight, SPACE to toggle a checkbox (multi-select: more than one option selectable at once), ENTER to confirm the selection set, and an always-present free-text field (the canonical verb #10) where the user types a direction COMPLETELY DIFFERENT from every proposed option; Larry interprets and routes the free-text
    - Acceptance: a test toggles two options via space then Enter and asserts BOTH are returned; a test enters free-text and asserts it returns as a Free-Text verb (routed by Larry), not coerced onto a proposed option; EACH confirmed option writes its OWN typed decision edge (Canon Part 4), and the free-text writes a Free-Text edge carrying the user's string; a rejection-with-reason still captures the reason

## Boundaries

**In scope:**
- One render engine with `shape` x `delivery` flag dispatch
- Retiring all 7 HTML commands to thin flag-aliases on the engine
- `mos tui` full-screen arrow-key navigator (the primary CLI navigator, a separate process)
- Larry's in-conversation 4-zone inline render (the zero-process fallback that always works)
- Live event subscription (chokidar) for the TUI + web twin; headless `mos watch` feed mode
- Web live-wiki twin via the existing express/chokidar/SSE plumbing
- LazyGraph overlay suggestion slot (overlay-only, intent-gated, temporal-ranked)
- Decision-gate selector: arrow-key navigation + space-to-toggle multi-select (>1 option) + always-present free-text escape, in `mos tui` and inline; each pick writes its own edge
- Single De Stijl token + component source + CI linter (the token core)
- Dual render (graph + language) for graph-native truths
- One new TUI-library dependency (ink or blessed - chosen at discuss-phase), justified by the arrow-key requirement
- Promotion of M5 from SEED to ADR

**Out of scope:**
- New Desktop/Cowork rendering beyond the AskUserQuestion baseline - degrade-only this phase
- Rendering the full navigator INSIDE the Claude Code conversation pane - impossible (a conversation cannot capture raw keystrokes); the inline surface stays the 4-zone text block, the arrow-key experience lives in the separate `mos tui` process
- Multi-user / team collaboration + Brain-API-key onboarding - the actual GTM deal-blockers; separate work (recorded as a sequencing risk)
- Resolving M5's three "how" knobs (wikilink authorship; intent filter-vs-re-rank; sidebar highlight in-place-vs-slot) - deferred to discuss-phase
- Changes to the truth layer (room.db schema, resolver, offer_next_step) - shipped in Phase 135/109, consumed read-only here

## Constraints

- `mos tui` runs as its own process in a terminal (the lazygit coexistence model), launched alongside Claude Code - NOT inside the conversation pane. It owns the terminal in raw mode and must restore it cleanly on exit.
- A new TUI-library dependency is required (ink or blessed) - the FIRST justified break of the "zero TUI dependency" precedent, warranted only by the arrow-key requirement (Canon Part 7: name why reuse is insufficient - no existing dep can capture raw keystrokes / drive a full-screen cursor).
- Concurrency: `mos tui` is a long-lived room.db reader that may run while a Claude Code session writes; the read path must be concurrency-safe through navigation.cjs (no corruption, no deadlock).
- Reuse before build (Canon Part 7): extend `render-v2.cjs` + `references/visual/palette.json` + the existing express/chokidar server; do NOT introduce a new HTTP server or a new token system.
- All room.db access via `lib/core/navigation.cjs` only (Canon Part 9 chokepoint).
- No user content to the Brain (Canon Part 8); `brain-boundary-scan` is a release gate.
- Output obeys the 12-glyph vocabulary + 4-zone anatomy (`skills/ui-system/SKILL.md`); no em-dashes in any output.
- Milestone-scale: expected to decompose into a cluster (136 anchor + sub-phases: engine core / token core / `mos tui` / surface twins) at plan-phase.

## Acceptance Criteria

- [ ] One engine renders all (shape x delivery) combinations the 7 legacy commands needed; no legacy command retains its own render body
- [ ] All 7 commands work as thin flag-aliases with a provenance note; `/mos:dashboard` == `render --shape dashboard --deliver web`
- [ ] `mos tui` opens a full-screen app; arrow keys move/expand/collapse the ICM tree; TAB cycles panes; a shape hotkey switches views; terminal restored cleanly on quit
- [ ] `mos tui` + web twin update live on room.db change (event-driven, no timer poll); headless `mos watch` feed mode works
- [ ] Inline 4-zone render works with ZERO processes and reads the same state as `mos tui` (no divergence)
- [ ] LazyGraph suggestion slot overlays only (tree order byte-identical) and is silent when nothing relevant to the active JTBD changed
- [ ] Selector supports arrow-key navigation, space-to-toggle multi-select (>1 option), and a free-text escape; each selected option writes its own edge; free-text routes as the Free-Text verb
- [ ] CI linter fails on a hardcoded color/glyph outside the token source and passes on the engine
- [ ] A graph-native relation renders as BOTH a graph view and a natural-language sentence
- [ ] Engine degrades to the AskUserQuestion baseline under Desktop/Cowork without attempting TUI/web render
- [ ] `brain-boundary-scan` passes; zero direct sqlite/room-db requires in engine/TUI/web paths; concurrency test passes (TUI reads + concurrent writes, no corruption)
- [ ] M5 promoted from SEED to ADR

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                 |
|--------------------|-------|------|--------|-----------------------------------------------------------------------|
| Goal Clarity       | 0.83  | 0.75 | ✓      | Render model now decided (arrow-key `mos tui` binary); surfaces clear  |
| Boundary Clarity   | 0.80  | 0.70 | ✓      | TUI in-scope; conversation-pane render explicitly out; degrade-only    |
| Constraint Clarity | 0.72  | 0.65 | ✓      | TUI-lib CHOICE + concurrency MODEL are deferred how-decisions          |
| Acceptance Criteria| 0.78  | 0.70 | ✓      | Arrow-key + concurrency acceptance added                               |
| **Ambiguity**      | 0.21  | <=0.20| ⚠     | Just over gate - reopening a locked decision honestly cost clarity     |

Status: ✓ = met minimum, ⚠ = below minimum / over gate (planner treats residual as assumption to resolve in discuss-phase)

**Why 0.21 not 0.19:** the Round-3 flip to an arrow-key binary re-decided the render model (clarity up on Goal/Boundary) but introduced two genuine new unknowns - WHICH TUI library, and the concurrent-room.db-access model - that are how-decisions, the proper territory of discuss-phase. The "what" (a full-screen arrow-key navigator that coexists like lazygit) is clear; the residual sits in Constraint and is named below.

## Open items (deferred to discuss-phase, do not block this spec)

- TUI library choice: ink (React-based, JSX components) vs blessed/neo-blessed (widget-based) vs a thin raw-ANSI layer. Trade-offs: dependency weight, vendoring (must be pure-JS for cross-platform per the release vendoring rule), maintenance.
- Concurrency model: how `mos tui` (long-lived reader) and a live Claude Code session (writer) share room.db safely (WAL mode, read-only handle, snapshot-per-render) - all via navigation.cjs.
- How `mos tui` and the inline conversation stay in sync (does selecting in the TUI inform Larry's next turn? one-way or two-way?).
- Canon Part 3 additive extension: a multi-select gate writes one edge PER selected option (today's canon reads "selects one -> one edge"). Confirm the additive canon note at discuss-phase (current-vs-final discipline) so the gate semantics stay canon-legal.
- M5 knobs: wikilink authorship (founder-only vs Larry-proposes-approves); intent FILTERS vs RE-RANKS the stream; sidebar highlight in-place vs separate slot.

## Interview Log

| Round | Perspective     | Question summary                                  | Decision locked                                                                 |
|-------|-----------------|---------------------------------------------------|---------------------------------------------------------------------------------|
| 1     | Researcher      | What IS the "CLI persistent navigator"?           | (initial) in-conversation per-turn render - SUPERSEDED by Round 3               |
| 1     | Researcher      | Phase 136 scope vs cluster?                       | All of M5 render spine, one phase (decomposes into a cluster at plan-phase)      |
| 1     | Researcher      | Sequencing given GTM signal?                      | Anchor v1.14.0 now (architecture-led; GTM risk recorded)                        |
| 2     | Boundary Keeper | Fate of the 7 HTML commands?                      | Retire to thin flag-aliases on the one engine                                   |
| 2     | Boundary Keeper | Desktop/Cowork in 136 - new work or degrade?      | Degrade-only; no new Desktop/Cowork rendering                                   |
| 2     | Failure Analyst | Event model on a turn-based surface?              | (per the then-baseline) per-surface split - REVISED by Round 3                  |
| 3     | Navigator-need  | Do you want true arrow-key navigation?            | YES - flip render model to a real `mos tui` full-screen arrow-key binary        |
| 3     | Failure Analyst | Can a full-screen TUI coexist with the CC host?   | RESOLVED: yes, as a separate process in its own terminal (the lazygit model)    |
| 3     | Navigator-need  | Selector richness - single pick or more?          | Multi-select (arrow + space-toggle) + always-present free-text escape; each pick its own edge (Part 3 additive extension) |

---

*Phase: 136-the-liquid-state-one-render-spine-m5-render-spine-layer-v1-1*
*Spec created: 2026-05-31 (revised same day, Round 3 render-model flip)*
*Next step: /gsd:discuss-phase 136 - implementation decisions (TUI library, concurrency model, sync model, and the 3 M5 knobs)*
