# Phase 148: LarryReach Selector Re-wire (Intelligence + Toggleable Components) - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

The LarryReach selector + suggest/next-move surface stops being a flat list of plumbing reaches. Every reach gets real content (the PWS intelligence engines where applicable) AND its own toggleable component matched to what it does. Intelligence engines join the ranked set, Hats becomes the 6th ranked reach, File + Brain review become always-open standing options, selecting a reach invokes the REAL command, and a cold-room "what can I help you with" entry matches relevant commands to typed intent. In-conversation only (AskUserQuestion); the keyboard cockpit, De Stijl color-blocks, Hebrew/RTL, and the ~80-command rollout are later phases.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**8 requirements are locked.** See `148-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `148-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- The LarryReach selector + suggest/next-move surface (F.1 Next Move, offer-resolver, suggest-next, the reach set, posture)
- The five intelligence engines as ranked reaches; Hats as the 6th ranked reach
- File these findings + Brain review as always-open standing options; Free-Text always-last
- Per-option toggleable component routing across the WHOLE surface (not only intelligence rows)
- Real invocation through command-resolver with typed edge + landed artifact
- JTBD ranking via f-selector-ranker; frozen cap/gate preserved

**Out of scope (from SPEC.md):**
- Path A standalone keyboard cockpit / Ink binary (arrow-key TTY) - Phase 154
- De Stijl color-block painting beyond the existing UI-ruling glyph/color - Phase 151/152
- Hebrew / RTL bundle - Phase 153
- The interaction_archetype rollout across the ~80 /mos: commands - Phase 152
- A live Ask-Tell left/right keyboard slider - Path A / Phase 154
- Live arrow-key navigation in-conversation - the TTY wall

</spec_lock>

<decisions>
## Implementation Decisions

### Component-to-reach mapping
- **D-01:** The intelligence engines default to **multi-select / queue** - the navigator checks several engines and runs them as a batch (the "check several, act on the batch" model). NOT Select-one.
- **D-02:** Compose-a-sequence is a **separate on-demand option** using the **ordered-checkbox** (check-order = the pipeline order). It is not the default render; it is reached when the navigator wants a chain.
- **D-03:** Each reach class maps to its archetype component via a **component-map** (new artifact, e.g. `lib/hmi/reach-component-map.json`): engines = multi-select, compose = ordered-checkbox, File = multi-select, Brain review = auto (no pick), Hats = confirm-gated. Every component resolves from the F-family via the dispatcher (SEED-020, no bespoke widget).

### Brain review behavior
- **D-04:** On select, **Brain review auto-reviews the latest findings** - it surfaces contradictions and suggests the next framework chain, with NO scope prompt. Uses a typed methodology packet only; zero user-content egress (Canon Part 8); Brain is the external cortex (Part 9).

### File these findings behavior
- **D-05:** File = **pick-which-findings** (multi-select when several findings are on the table), then write the typed edge via `navigation.cjs` and report where it landed. The multi-select submit IS the confirm step (no separate y/n).

### Hats go-deep handling
- **D-06:** Hats (the 6th ranked reach) **confirms before running** ("Build research personas + run the hats? research spin, ~1 min"), and its row carries a **"go deep" marker** so its heaviness is visible. Research personas are **cached per room, rebuilt on demand** (not rebuilt every run).

### Help entry ("what can I help you with")
- **D-07:** At cold-room / no-signal (tier_0, session start, empty room), the selector **leads with "what can I help you with"**. Once there is JTBD signal, the six intelligence reaches lead instead.
- **D-08:** Matching = the navigator **types intent**, and Larry matches relevant /mos: commands via the **command-resolver (Phase 122) + JTBD ranking**, presented as reaches with their components. Reuses the resolver; keeps 148 inside scope. (The full grouped help-page redesign is Phase 152.)

### Reach model (A1 resolution - load-bearing, navigator decision 2026-06-08)
- **D-09:** Hats becomes a REAL 6th **machine** reach_id, NOT a render-label sub_mode (resolves the researcher's open-question A1). This is a **constitutional amendment**. The lockstep surfaces that MUST move together (or the build breaks the frozen-5-reach drift suite):
  1. `sensor-types.REACH_IDS` - add the 6th reach_id.
  2. Both SKILL files carrying the "NO 6th reach_id" verbatim fence - amend the fence to 6.
  3. The connector `--check` tripwire - expect 6.
  4. The 4 drift tests that assert exactly 5 - rewrite to expect 6.
  5. `DIAL_REACH_K` 5 -> 6.
  6. A Canon amendment (`docs/MINDRIAN-CANON.md` + `docs/CANON-PHASE-MAP.md`) recording the reach-count change with `canon_parts`, per the dog-fooding mandate (Part 6).
- The 5 intelligence engines ride as the engine reach set; Hats is the 6th machine reach. `MAX_K=3` chooser cap and the frozen 0.70/0.15 gate stay UNCHANGED. The planner must treat the lockstep + drift-test rewrite + Canon amendment as in-scope tasks for Phase 148.

### Claude's Discretion
- Cold-room tier_0 base set keeps the canon fallback (Run Methodology / Reformulate / Free-Text) beneath the "what can I help you with" lead, plus the standing trio.
- The standing trio (File these findings + Brain review + Free-Text-last) renders at every selector render regardless of mode/tier.
- The "go deep" marker uses the existing 12-glyph UI-ruling vocabulary (candidate: the lightning glyph already used for heavy/convergence), not a new glyph; final pick is the planner's within the vocabulary.
- Multi-select batch submit + confirm uses the AskUserQuestion multiSelect primitive; no bespoke widget.
- recommended-marker (frozen 0.70/0.15 gate) coexists with multi-select: the recommended reach is pre-highlighted but the navigator can still check others. The gate and MAX_K=3 chooser cap are unchanged.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements + grounding
- `.planning/phases/148-larryreach-selector-re-wire-intelligence-toggleable-componen/148-SPEC.md` - Locked requirements, boundaries, acceptance criteria. MUST read before planning.
- `.planning/research/2026-06-08-keyboard-tui-capability-cockpit-research.md` §1 (TUI tech / arsenal), §10 (the component archetype matrix + master mapping + De Stijl color-as-state), §14 (tester evidence), §15 (roadmap + phase mapping). The component-to-reach decisions trace to §10.

### Canon
- `docs/MINDRIAN-CANON.md` Part 3 (Tri-Context Decision Gate / Shape F selector + the 10 verbs + tier-awareness Mode A/B/Tier 0), Part 4 (every choice is a typed edge), Part 7 (reuse before build), Part 8 (the graph boundary - zero Brain egress), Part 9 (Memory Locality - Brain as external cortex, writes through navigation.cjs), Part 10 (conversation as product).
- `docs/CANON-PHASE-MAP.md` - phase ledger; the 143.x / 144 connector-spine + engine-flip rows the selector rides on.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Canon Part 7 - this is ~90% repoint, not rebuild)
- `lib/hmi/dial-reach-orchestrator.cjs`: holds `DIAL_REACH_K` (5, extend to 6 for Hats), the frozen 0.70/0.15 gate, `OFFERED_CAP = MAX_K`. Extend the reach defs to add the 5 engines + Hats; keep the gate frozen.
- `lib/hmi/shape-f1-renderer.cjs`: the F.1 render host (Free-Text-always-last, RECOMMENDED marker `▶`/`▷`). The selector + suggest surfaces unify onto this renderer.
- `lib/hmi/dial-label-composer.cjs`: WHAT-THEY-GET labels; add families for the engine + Hats reaches.
- `lib/workflow/f-selector-ranker.cjs`: `MAX_K=3`, D4 score + D9 investment-aware `why`. JTBD-ranks the 6 reaches.
- `lib/workflow/dial-close-reach.cjs`: 4-outcome write through `navigation.cjs` (SELECTED_REACH / PIVOTED / defer-reject / miss). Real invocation hangs off the sync path.
- `lib/workflow/command-resolver.cjs` (Phase 122): reach -> real command. Powers BOTH the engine invocation (D-01/IRW-06) AND the help-entry intent matching (D-08).
- `lib/core/navigation.cjs` (Phase 109): the write chokepoint - all edges/artifacts route here.
- `resolveOfferNextStep` (Phase 135 offer-resolver) + suggest-next: unify onto the one component-routed host (IRW-05).
- `skills/intelligence-orchestrator` (Phase 143.3): the dispatchSensors -> reach consumer that feeds the ranked set.

### Established Patterns
- AskUserQuestion is the ONLY interactive primitive in-conversation (the TTY wall, research §0). `multiSelect: true` gives the checkboxes D-01/D-05 need.
- SEED-020 / Shape-F family: no bespoke selector; every component resolves through the dispatcher.
- check-brain-boundary scan (Phase 117-04) gates the Brain-review path for zero egress.
- Per-room cache pattern (Phase 124 timeline / 143.1 dial-memory) for the Hats persona cache.

### Integration Points
- New `reach-component-map.json` (reach -> toggleable component) consumed by the renderer/dispatcher.
- `command-resolver` is the shared door for engine invocation and help-entry matching.
- tier_mode (from getRoomContext / resolveTierMode) drives the cold-room "what can I help you with" lead vs intelligence-reaches lead.

</code_context>

<specifics>
## Specific Ideas

- The navigator's dominant mental model is **multi-select**: "check several, act on the batch" - it won both the engine-reaches and the File decisions. The render should make batching feel natural.
- The cold-room entry is literally **"what can I help you with"** + a free-text intent box that resolves to matched reaches (the user's explicit phrasing).
- Hats confirm copy: "Build research personas + run the hats? (research spin, ~1 min)".
- Brain review is the "outside review" - it reviews from outside the room (Canon Part 9 external cortex), surfacing contradictions the navigator cannot see.

</specifics>

<deferred>
## Deferred Ideas

- **Full /mos:help page redesign + grouped lane menu** - Phase 152 (the help entry in 148 is the thin "what can I help you with" + matched-reaches version only).
- **Path A standalone keyboard cockpit** (Ink + @clack/prompts + inquirer-ordered-checkbox, arrow keys / live toggles) - Phase 154.
- **De Stijl color-block painting** (red=selected, yellow=recommended, blue=deep cells) - Phase 151/152; 148 stays within the existing glyph + 5-color CLI ruling.
- **Hebrew / RTL bundle** (`lib/render/bidi.cjs`, retire HEBREW_REFUSAL) - Phase 153.
- **Ask-Tell keyboard slider** (live left/right posture control) - Phase 154.
- **interaction_archetype rollout across the ~80 /mos: commands** - Phase 152.

</deferred>

---

*Phase: 148-larryreach-selector-re-wire-intelligence-toggleable-components*
*Context gathered: 2026-06-08*
