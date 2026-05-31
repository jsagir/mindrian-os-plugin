# Phase 136: The Liquid State - One Render Spine (M5 render-spine layer) - Specification

**Created:** 2026-05-31
**Ambiguity score:** 0.19 (gate: <= 0.20)
**Requirements:** 10 locked
**Milestone:** v1.14.0 (ANCHOR)
**Authority:** `~/MindrianRooms/mindrianOS/product-evolution/architectural-mandates/M5-liquid-state-fractal-sos.md` (SEED, promoted to ADR by this phase)
**Canon parts:** 7 (consolidation), 8 (graph boundary), 9 (memory locality), 10 (render is the surface)

## Goal

The 7 divergent HTML commands (dashboard / wiki / present / publish / export / visualize / snapshot) collapse into ONE render engine where `shape` and `delivery` are flags; that engine drives an in-conversation CLI navigator (fractal ICM tree + view pane + LazyGraph suggestion slot, rendered per turn), an optional `mos watch` live-event watcher, and a live-SSE web twin - all reading room.db only through `lib/core/navigation.cjs` and all obeying a single De Stijl token source.

## Background

Today the room has 7 separate HTML/visualization commands that each invent their own rendering. `/mos:visualize` is already deprecated into `/mos:dashboard --mermaid`, so the collapse has begun but is not systematized. `lib/render/render-v2.cjs` + `render.cjs` exist (JTBD-aware context-render from Phase 102); `references/visual/palette.json` is the Phase 121.5 token seed; `skills/ui-system/SKILL.md` defines the 4-zone anatomy + 12-glyph vocabulary. The web dashboard already runs on `express` + `chokidar` (file-watch) with SSE live-reload. There is NO full-screen TUI library in the dependency tree (no ink/blessed/terminal-kit) and - per the 2026-04-30 TUI research file 04 (Claude Code render-model implications) - every prior phase deliberately shipped "zero TUI dependency." The truth layer this renders (room.db graph + resolver + `offer_next_step` + `memory_event` stream) shipped in Phase 135 / 109. What does NOT exist: a single render engine with shape/delivery flags, a token contract every renderer obeys, an in-conversation navigator surface, or a CLI event watcher.

## Requirements

1. **One render engine + flag dispatch**: A single engine renders any `shape` for any `delivery`, replacing 7 bespoke command implementations.
   - Current: 7 commands each implement their own HTML/render logic; no shared engine
   - Target: one engine module accepts `{shape: deck|mermaid|wiki|grid|dashboard|snapshot, delivery: cli|web|file}` and produces the corresponding output; all rendering routes through it
   - Acceptance: a test invokes the engine for each (shape x delivery) combination used by the 7 legacy commands and gets non-empty correct output; grep proves no legacy command file contains its own render/HTML-generation body (they call the engine)

2. **Seven commands retired to flag-aliases**: Each legacy command becomes a thin alias on the engine, still working, with a one-line provenance note.
   - Current: dashboard/wiki/present/publish/export/snapshot are full commands; visualize already deprecated
   - Target: each of the 7 command files becomes a thin wrapper that calls the engine with fixed flags and emits a one-line "powered by the render spine" note; no user-facing breakage
   - Acceptance: running each of the 7 commands produces the same class of artifact as before AND the command file body is reduced to an engine call + alias note (verified by line-count + grep); `/mos:dashboard` equals `render --shape dashboard --deliver web`

3. **CLI in-conversation navigator (mandatory baseline, zero process)**: The engine renders a per-turn navigator with no persistent process.
   - Current: no in-conversation navigator surface exists
   - Target: `delivery: cli` renders a fractal ICM tree (room -> section -> sub-section -> MD) + a view pane + a suggestion slot, re-rendered each turn by reading current state via navigation.cjs; works with zero background processes running
   - Acceptance: rendering the CLI navigator for a seeded room with no daemon running produces the tree + view + suggestion slot; a test asserts no child process / no socket is opened by the baseline render path

4. **Optional `mos watch` live watcher**: An opt-in daemon streams room.db events into the terminal, as the CLI sibling of the web twin.
   - Current: no CLI event watcher; only the web server tails events
   - Target: `mos watch` starts an opt-in persistent process that tails `memory_event` via chokidar and prints a live event feed; it is never required for any other surface to function
   - Acceptance: with `mos watch` running, filing an artifact in a test room prints a new event line within the watch interval; with it NOT running, every other surface (CLI baseline, the 7 aliases) still works (proven by requirement 3's no-daemon test)

5. **Web live-wiki twin (true SSE subscribe)**: The web delivery subscribes to room.db events and updates live, reusing the shipped server.
   - Current: express + chokidar + SSE live-reload exist for the dashboard
   - Target: `delivery: web` serves the navigator (tree + view + suggestion slot) and updates live via SSE on room.db change, reusing the existing express/chokidar plumbing (not a new server)
   - Acceptance: a test writes to a seeded room.db and asserts the web twin pushes an SSE update without a full reload; grep proves no second HTTP server was introduced

6. **LazyGraph overlay (never reorders the ICM)**: The suggestion slot overlays the stable tree; intent gates, temporal ranks.
   - Current: no suggestion slot wired to the stable navigator tree
   - Target: the suggestion slot surfaces LazyGraph signals that OVERLAY (highlight in place / whisper an edge) and NEVER reorder the ICM tree (M5 hard rule 1); it speaks only when something recently changed (temporal) that serves the active JTBD/operator (intent); human-declared intent is sovereign, agent-proposed intent never overrides
   - Acceptance: a test that injects a LazyGraph suggestion asserts the tree node order is byte-identical before/after (overlay only); a test asserts the slot is silent when no memory_event changed since last render AND when the change does not serve the active JTBD

7. **Single De Stijl token + component source (token core)**: One token graph every renderer obeys, extended from palette.json, enforced by a linter.
   - Current: design values scattered (palette.json seed + DS_HEX in visual-ops + destijl CSS + shared CSS); no enforced single source
   - Target: a surface-agnostic token source (color + type + spacing + glyph + component specs) extends `references/visual/palette.json`; a CI linter rejects any renderer that hardcodes a color/glyph/token outside the source
   - Acceptance: the linter fails on a planted hardcoded hex/glyph in a render file and passes on the engine; all engine output for a given shape pulls values from the token source (no inline literals, verified by grep)

8. **Dual render (graph + language)**: Graph-native truths render as BOTH a graph view and a natural-language line.
   - Current: views are either graph (cytoscape/mermaid) or prose, not paired
   - Target: for a graph-native relation, the engine emits both the graph representation (see it) and a natural-language sentence (understand it) in the same render
   - Acceptance: rendering a seeded CONTRADICTS edge produces both a visible edge in the graph view AND a sentence naming the relation in the same output

9. **Desktop/Cowork degrade-only**: No new Desktop/Cowork rendering; the engine degrades cleanly to the AskUserQuestion baseline.
   - Current: Desktop/Cowork use the AskUserQuestion selector baseline (Phase 88.2)
   - Target: on Desktop/Cowork the engine degrades to the existing AskUserQuestion baseline with no new surface built; no crash, no missing-feature error
   - Acceptance: invoking the engine under a simulated Desktop/Cowork surface flag returns the AskUserQuestion baseline path and never attempts a CLI-tree or web-server render (verified by test)

10. **Canon Part 8 + Part 9 clean**: Zero user bytes to Brain; all room.db access via the navigation chokepoint.
    - Current: navigation.cjs is the Part 9 chokepoint; brain-boundary-scan exists
    - Target: every render path reads room.db ONLY through `lib/core/navigation.cjs`; no render path sends user content to the Brain
    - Acceptance: `brain-boundary-scan` passes on all new files; a grep/instrumented test asserts zero direct `node:sqlite` / room-db opener requires in the engine, watcher, and web-twin render paths

## Boundaries

**In scope:**
- One render engine with `shape` x `delivery` flag dispatch
- Retiring all 7 HTML commands to thin flag-aliases on the engine
- CLI in-conversation navigator (mandatory, per-turn, zero-process baseline)
- Optional `mos watch` live-event watcher (opt-in daemon)
- Web live-wiki twin via the existing express/chokidar/SSE plumbing
- LazyGraph overlay suggestion slot (overlay-only, intent-gated, temporal-ranked)
- Single De Stijl token + component source + CI linter (the token core)
- Dual render (graph + language) for graph-native truths
- Promotion of M5 from SEED to ADR

**Out of scope:**
- New Desktop/Cowork rendering beyond the AskUserQuestion baseline - degrade-only this phase (avoids sprawl on an already milestone-scale phase)
- A full-screen TUI binary (ink/blessed) replacing the conversation - ruled out by the in-conversation-only render-model decision (host-coexistence risk)
- Multi-user / team collaboration + Brain-API-key onboarding - the actual GTM deal-blockers; separate work (this phase is architecture-led, recorded as a sequencing risk)
- Resolving M5's three "how" knobs (wikilink authorship; intent filter-vs-re-rank; sidebar highlight in-place-vs-slot) - deferred to discuss-phase
- Changes to the truth layer (room.db schema, resolver, offer_next_step) - shipped in Phase 135/109, consumed read-only here

## Constraints

- The CLI baseline render MUST run with zero persistent processes (host-safe inside the Claude Code CLI); the watcher and web server are the only persistent processes and both are opt-in.
- Reuse before build (Canon Part 7): extend `render-v2.cjs` + `references/visual/palette.json` + the existing express/chokidar server; do NOT introduce a new HTTP server, a new token system, or a TUI library.
- All room.db access via `lib/core/navigation.cjs` only (Canon Part 9 chokepoint).
- No user content to the Brain (Canon Part 8); `brain-boundary-scan` is a release gate.
- Output obeys the 12-glyph vocabulary + 4-zone anatomy (`skills/ui-system/SKILL.md`); no em-dashes in any output.
- Milestone-scale: expected to decompose into a cluster (136 anchor + sub-phases) at plan-phase.

## Acceptance Criteria

- [ ] One engine renders all (shape x delivery) combinations the 7 legacy commands needed; no legacy command retains its own render body
- [ ] All 7 commands work as thin flag-aliases with a provenance note; `/mos:dashboard` == `render --shape dashboard --deliver web`
- [ ] CLI navigator renders tree + view + suggestion slot with ZERO background processes (no child process / socket opened by the baseline path)
- [ ] `mos watch` streams live events when running; every other surface works when it is NOT running
- [ ] Web twin pushes an SSE update on room.db change without a full reload, reusing the existing server (no second HTTP server)
- [ ] LazyGraph suggestion slot overlays only (tree order byte-identical before/after) and is silent when nothing relevant to the active JTBD changed
- [ ] CI linter fails on a hardcoded color/glyph outside the token source and passes on the engine
- [ ] A graph-native relation renders as BOTH a graph view and a natural-language sentence
- [ ] Engine degrades to the AskUserQuestion baseline under Desktop/Cowork without attempting CLI-tree/web render
- [ ] `brain-boundary-scan` passes; zero direct sqlite/room-db requires in engine/watcher/web paths
- [ ] M5 promoted from SEED to ADR

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | Render model + scope + per-surface roles all locked          |
| Boundary Clarity   | 0.80  | 0.70 | ✓      | 7-cmd fate + degrade-only + optional-watcher layering locked |
| Constraint Clarity | 0.80  | 0.65 | ✓      | Event model reconciled; host-safe zero-process baseline      |
| Acceptance Criteria| 0.78  | 0.70 | ✓      | SC2/SC3 rewritten for in-conversation + watcher + web split  |
| **Ambiguity**      | 0.19  | <=0.20| ✓     | Gate passed                                                  |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Open items (deferred to discuss-phase, do not block this spec)

- Wikilink authorship: founder-only vs Larry-proposes-founder-approves (M5 open question; affects the suggestion slot).
- Intent: does it FILTER the temporal stream or RE-RANK the whole graph as the primary axis (M5 open question)?
- Sidebar "next" highlight: in-place (roam a map) vs separate slot (risk of linear march) - the ASCII mockup leaned in-place; confirm at discuss-phase.

## Interview Log

| Round | Perspective     | Question summary                                  | Decision locked                                                                 |
|-------|-----------------|---------------------------------------------------|---------------------------------------------------------------------------------|
| 1     | Researcher      | What IS the "CLI persistent navigator"?           | In-conversation per-turn render (no full-screen TUI binary); host-safe baseline |
| 1     | Researcher      | Phase 136 scope vs cluster?                       | All of M5 render spine, one phase (decomposes into a cluster at plan-phase)      |
| 1     | Researcher      | Sequencing given GTM signal?                      | Anchor v1.14.0 now (architecture-led; GTM risk recorded)                        |
| 2     | Boundary Keeper | Fate of the 7 HTML commands?                      | Retire to thin flag-aliases on the one engine                                   |
| 2     | Boundary Keeper | Desktop/Cowork in 136 - new work or degrade?      | Degrade-only; no new Desktop/Cowork rendering                                   |
| 2     | Failure Analyst | Event model: in-conversation cannot push live     | Per-surface split shown as ASCII; user chose lightweight watcher                |
| 2.5   | Boundary Keeper | Watcher contradicts Round-1 "in-conversation only"| Watcher = OPTIONAL layer (CLI sibling of web twin); in-conversation is baseline |

---

*Phase: 136-the-liquid-state-one-render-spine-m5-render-spine-layer-v1-1*
*Spec created: 2026-05-31*
*Next step: /gsd:discuss-phase 136 - implementation decisions (how to build what's specified above; resolves the 3 open items)*
