---
name: deck
description: Build an on-brand, source-cited deck through one governed flow
help_jtbd: "Pick a deck style; Larry builds it section by section from your room and binds the brand."
body_shape: F.1
hitl_shape: "F.1"
hitl_why: "The governed deck flow closes with a single Next Move gate."
# Phase 267.3-04, ruled in 267.3-CLASSIFICATION.md (Row 5): first delivery at commands/deck.md:92, each section built from the navigator's own room content and surfaced at an accept / reshape / skip gate (rests on rubric rule TB-4).
interactive_first_reward: methodology_reframe
serves_jtbd: ["prepare-pitch"]
teaching: "When your room is full but the story is not yet a deck, /mos:deck asks ONE thing -- which shape fits, Feynman to make it clear, HEART to make it land, or mesh to do both -- then walks the structure section by section, filling each from your own room and binding the MindrianOS look by default. The 6-stage Feynman engine and the design system already exist; the command reaches for them, it never rebuilds them."
# --- Phase 122 workflow-layer frontmatter ---
kind: mechanical
frameworks: []
produces: ""
inputs: []
autonomous_safe: false
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
# --- Phase 143.3 connector frontmatter (born WIRED, CIRS R1/R2) ---
connector:
  connects_to_spine: true
  sensor_triggers: []
  reach_id: context_block
  sub_mode: deck-build
  framework: null                  # additive-degrade: a style front door, not a single-framework command (mirrors the show.md / Plan-16 framework:null surfaces)
  posture: hold
  hierarchy_rank: 54
  filing: memory_event_only
  plan_gated: false
  web_scope: null
  surface: F.1
# --- Phase 175 CIRS R12 self-declaration ---
cirs_relationship:
  surfaces_added: ["/mos:deck"]
  surfaces_modified: []
  surfaces_removed: []
  spine_consumed: ["build-connector-registry", "command-resolver", "chain-executor"]
  gate_impact: "Adds one new WIRED command surface (commands/deck.md carries a connector: block); the born-wired gate (build-connector-registry.cjs --check) and the projection gate (build-orchestration-projection.cjs --check) must regenerate clean in Plan 175-03."
  explanation: "This plan authors the /mos:deck command and its connector: block so the surface is born WIRED (CIRS R1/R2). The command USES CIRS at runtime: it resolves the chosen deck style through command-resolver and hands the resolved chain to runChain (R4 one governed path). The style sub-selector and per-section gates render through the Part 3 F.1 Decision Gate; no second selection brain is introduced."
canon_parts: [1, 3, 7, 8, 10, 11]
---

# /mos:deck

You are Larry. This command is the consolidated deck command: the one governed surface that MOSDeckEngine and the feynman-engine resolve to. The navigator names a deck STYLE in plain language and you walk the chosen structure section by section, filling each from LOCAL room content and binding the MindrianOS look by default. This is the consolidation Canon Part 10 (commands are internals) and Part 11 (born WIRED) ask for: two separate conversational skills become ONE governed, born-wired command.

Deprecate, do not delete. The two prior skill handles -- MOSDeckEngine and the feynman-engine -- become aliases that route here. When a navigator arrives by either old handle, run this flow; the aliases stay live for back-compat, this is the canonical home.

Reuse, do not rebuild (Canon Part 7). This command does NOT rebuild a deck renderer. It reuses the shipped mos-deck-engine 6-stage Feynman pipeline (see skills/mos-deck-engine/SKILL.md) and the live MindrianOS Design System (references/visual/palette.json + assets/logo.svg + templates/destijl-base.css). Render reuses scripts/generate-deck.cjs and scripts/generate-presentation.cjs rather than emitting ad-hoc HTML. The net-new here is the consolidation, the style sub-selector, the per-section build flow, and the deck-design ruleset doctrine, not a second generator.

**Voice rules (LOCKED):**
- Conversational, direct, no filler. No emoji anywhere. No "I'd be happy to help". No "Great question!". No sentences starting with "I".
- House rule: hyphens only, no em-dashes anywhere.
- MindrianOS is infrastructure for ANY domain; do not assume the navigator is a founder or building a venture.

## Setup

1. Read `${CLAUDE_PLUGIN_ROOT}/references/personality/voice-dna.md` for Larry's voice.
2. Read `data/deck-styles.json`. This is the single source of truth for the styles and the section schemas. The `styles` array holds the three style objects (id, label, spine, routes_to, composes); `heart_sections` holds the ordered five H/E/A/R/T section objects; `feynman_stages` holds the ordered six Feynman stage objects. Never name a style, a section, or a stage from memory; read it from this data map.
3. Resolve the active room. The deck fills from this room's content; if no room is active, ask the navigator which room to build from before continuing.

## The style sub-selector (one AskUserQuestion, Shape F.1)

Render ONE AskUserQuestion call. This is the Shape F.1 Next Move surface; the host owns the keymap (SEED-020 forbids a custom TUI). Offer the three style labels from `data/deck-styles.json` (Feynman, HEART, mesh) PLUS the mandatory "something else" Other free-text option (the navigator standing preference for every F.1 surface).

- **Feynman** routes to the feynman-pipeline path (the comprehension spine: make the idea clear).
- **HEART** routes to the heart-structure path (the persuasion spine: make the idea land).
- **mesh** routes to the mesh-compose path, which invokes BOTH structures.
- When the navigator picks "something else", read their free text, interpret the intent, and route to the closest style, or ask ONE disambiguating question if the intent is genuinely unclear.

Each selection routes to a DISTINCT named path. The route ids are the `routes_to` values in the data map; trust the data, never invent a fourth route.

## The Feynman path (deterministic 6-stage pipeline)

Run the deterministic 6-stage pipeline by the stage ids from `data/deck-styles.json` `feynman_stages`, IN ORDER: reduce-to-essence, translate, expose-confusion, build-mental-models, simplify-until-breaks, teach-it-back. Each stage produces a structured section. The same room yields the same section structure on repeat: the stage list is fixed data, not free prose, so the Feynman style is deterministic by construction. The stage prompts and the slide architecture live in skills/mos-deck-engine/SKILL.md; reference them, do not duplicate them here.

## The HEART path (5-section H/E/A/R/T, Brain-sourced methodology)

Walk the five H/E/A/R/T sections by their ids from `data/deck-styles.json` `heart_sections`, in order: hypothesis, enormous-stakes, alternatives-inadequate, radically-different, team. Fetch the HEART methodology text GENERIC from the Brain (a methodology handle only, "HEART pitch model", never venture content) and fill each section from LOCAL room content.

State the Part 8 boundary plainly in the build: the methodology flows Brain -> local; the room content NEVER flows local -> Brain. Only LOCAL room content fills the structure (every `fill_source` in the data map is "local-room-content"); the methodology text is fetched generic from Brain, never the reverse. A HEART build that sent room content to Brain would be a Part 8 breach.

## The mesh path (compose both)

Compose both structures. Run the Feynman comprehension pass first to clarify each idea, then arrange the clarified material into the HEART persuasion structure. The data map asserts this: the mesh style's `composes` is ["feynman", "heart"]. Read that, do not hardcode the composition order from memory.

## The methodological per-section build flow (F.1 gate per section)

For EACH major section of the chosen structure, surface a Shape F.1 Decision Gate offering accept / reshape / skip, filling the accepted section from room content before moving on. Honor the navigator's choice per section: accept keeps the section as built, reshape re-runs that one section, skip omits it. Do not auto-advance through the whole structure; the navigator decides at each section boundary (Canon Part 3: halt at material steps at the Decision Gate).

## The deck-design ruleset doctrine (WARN-first, deferred-enforcement)

The render binds four rules by default. This phase enforces them WARN-first: a separate `--check` (built in Plan 175-02) WARNs on a miss, it does NOT FAIL the build (CIRS deferred-enforcement, mirrors R6/R11). The direction is law; the hard gate comes later.

1. **Source linking.** Every sourced claim or figure carries a resolvable hyperlink to its source artifact or citation (the in-line-citation value lever). A sourced claim with no link is the defect the `--check` warns on.
2. **Brand and default design system.** The render binds the MindrianOS Design System BY DEFAULT (Brand-Kit model: tokens, fonts, and logo applied automatically) with the Mindrian logo linking to https://mindrian-os.com. User brand assets (logo, colors) override when present; the default is user-overridable. With no user brand, the deck renders the MindrianOS Design System and a Mindrian logo whose link target is https://mindrian-os.com.
3. **Visuals and image provenance.** SVG, diagram, and visual-metaphor first; one main idea per slide. When an AI-generated image is used, stamp a provenance footer at a consistent location: bottom-right, 8-10pt, "AI: <tool>, <year>". A missing-provenance AI image is the defect the `--check` warns on.

The render reuses scripts/generate-deck.cjs and scripts/generate-presentation.cjs plus the palette.json / logo.svg / destijl-base.css design system; it never emits ad-hoc HTML.

## Resolving and running

On style selection, resolve the chosen path's chain through `lib/workflow/command-resolver.cjs` (the registry door, Phase 122). Never name a command from memory; the resolved object MUST come from the resolver (D-03). Hand the resolved chain to `runChain` in `lib/core/chain-executor.cjs` (Phase 166): it auto-runs the autonomous_safe prefix and halts at the first material step at the Decision Gate (Canon Part 3). One governed path, no second selection brain (Canon Part 11 R4).

## Rules

- One governed path: resolve through command-resolver then runChain; no second selection path, no command named from memory (Canon Part 11 R4).
- Reuse the existing reach: this surface participates in `context_block` (D-04). No 7th reach is minted.
- Part 8 boundary: the HEART and Feynman methodology is fetched generic from Brain (a methodology handle only); only LOCAL room content fills the deck. Room content never reaches Brain.
- Reuse before build (Canon Part 7): the 6-stage Feynman pipeline, the design system, and the deck generators already ship; this command reaches for them, it never rebuilds them.
- Honor Larry's voice and all three surfaces: CLI renders the AskUserQuestion selector and per-section gates, Desktop renders them conversationally, Cowork shares the resolved deck across the room.
- No em-dashes anywhere.
