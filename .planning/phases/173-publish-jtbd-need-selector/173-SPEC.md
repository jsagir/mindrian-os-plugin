---
phase: 173
slug: publish-jtbd-need-selector
canon_parts: [1, 2a, 3, 7, 10, 11]
cirs_relationship:
  surfaces_added: ["/mos:publish (JTBD need-selector front door)", "consolidated invokable deck command (MOSDeckEngine + feynman-engine merged; Feynman/HEART/mesh styles)"]
  surfaces_modified: ["publish/visualize command family entry path"]
  surfaces_removed: []
  spine_consumed: "dispatchSensors -> decide() -> command-resolver (Phase 172)"
  gate_impact: "born-wired under CIRS R1/R2/R3; one governed path R4"
---

# Phase 173: Publish/Visualize JTBD Need-Selector — Specification

**Created:** 2026-06-23
**Ambiguity score:** 0.16 (gate: ≤ 0.20)
**Requirements:** 14 locked

## Goal

The publish/visualize command family becomes ONE invokable, context-triggered JTBD need-selector: when a user expresses the need to show or share their work, a Shape F.1 selector asks the JOB in plain language and resolves to the right visual/publish surface underneath — changing the entry path from "user must know and type 8 command names" to "user names a job; the command stays hidden and runs."

## Background

Today the visual surfaces are 8 disconnected commands (`/mos:dashboard`, `wiki`, `graph`, `present`, `radar`, `export`, `snapshot`, `publish`), each its own Node `.cjs` generator on its own localhost server (`serve-dashboard`, `serve-wiki`, `serve-presentation`). There is no shared entry, no JTBD framing, and nothing fires when a user signals "I need to show this." The `/mos:help` command already proves the F.1 two-axis selector pattern (`AskUserQuestion`, lanes-as-tabs, `data/help-groups.json` + the Phase 122 `command-resolver`). `lib/mcp/app-views.cjs` already ships 3 inline `ui://` views (dashboard/wiki/graph) for Desktop/Cowork; the deck/export/snapshot/radar surfaces have no inline parity. The Brain holds the H.E.A.R.T pitch model (Ben Weiner; verified `brain_search` top-rank 2026-06-23) but it is not invokable as a publishable visual. MOSDeckEngine and the feynman-engine exist as conversational skills, not deterministic publishing formats. Phase 172 (CIRS) ships the born-wired invocation gate this phase must register under.

## Requirements

1. **JTBD need-selector surface**: A Shape F.1 `AskUserQuestion` selector with 4 intent lanes in JTBD voice ("Know where I stand" / "Find what's broken" / "Make it land" / "Get it into the world"), options phrased as user-voice jobs, never command names.
   - Current: no JTBD selector; user types one of 8 command names
   - Target: a single selector whose options are jobs (e.g. "show me how my pieces connect", "give me a link I can send")
   - Acceptance: the selector renders 4 lanes via one `AskUserQuestion` call; zero option label contains a `/mos:` token or command name

2. **Need→command map**: A declarative `data/publish-needs.json` maps each job to its resolving command, mirroring `help-groups.json` + `dispatch-framework-map.json`.
   - Current: no such map; routing would be hardcoded
   - Target: `data/publish-needs.json` with `{ job, jtbd_line, resolves_to, lane, persona_weight, shows: connections|gaps }` rows
   - Acceptance: every job in the selector has exactly one `resolves_to` entry in the map; a `--check` validates every `resolves_to` is a real command/skill

3. **Resolution + runChain handoff**: A selected job resolves through the Phase 122 `command-resolver` and hands the resolved chain to the Phase 166 `runChain` executor.
   - Current: no resolution path from a publish-need to a command
   - Target: selection -> `command-resolver` -> resolved object -> `runChain` (auto-runs `autonomous_safe` prefix, halts at first material step)
   - Acceptance: a selected job invokes its mapped command via the resolver (never a slug from memory); test asserts the resolved object came from `command-resolver`

4. **Context trigger (the "show my work" wire)**: A context sensor detects show/share intent and fires the selector through the dispatchSensors -> decide() spine.
   - Current: no trigger; selector would be typed-only
   - Target: a sensor (keyword + marker + context-enum modes) that fires the publish need-selector reach via the Phase 172 spine
   - Acceptance: a turn expressing "I want to show/present/share this" fires the selector reach in a `dispatchSensors` test; a neutral turn does not

5. **Born-wired CIRS conformance**: The selector is a born-wired surface (R1/R2), context-triggered (R3), resolving through one governed path (R4), with a `cirs_relationship` block.
   - Current: surface does not exist, so is neither wired nor excluded
   - Target: a `connector:` block on the surface + a conformant `cirs_relationship:` declaration per `docs/CIRS-RELATIONSHIP-CONTRACT.md`
   - Acceptance: the Phase 172 coverage gate (`--check`) passes the surface as WIRED; the CIRS gate accepts the `cirs_relationship` block

6. **Persona-adaptive default lane**: The lane that opens first is chosen from `USER.md` `role_blend` (Part 2a).
   - Current: no persona adaptivity
   - Target: founder -> "Get it into the world"; researcher -> "Find what's broken"; investor -> thesis/red-team; fallback -> "Know where I stand"
   - Acceptance: with a founder-weighted `role_blend` fixture the default lane is "Get it into the world"; with researcher-weighted it is "Find what's broken"

7. **"Show the unseen" filter**: A job earns a selector slot only if it surfaces CONNECTIONS or GAPS (the moat), not decoration.
   - Current: no admission rule
   - Target: each `publish-needs.json` job carries a `shows: connections|gaps` tag; decoration-only candidates are excluded
   - Acceptance: every job row has a non-empty `shows` value of `connections` or `gaps`; a job lacking it fails the `--check`

8. **Default design-system binding (user-overridable)**: Rendered output binds to the MindrianOS Design System by default; the user can select an alternative.
   - Current: surfaces hardcode De Stijl HTML; no design-system selection
   - Target: a default-design-system binding (the live `MindrianOS Design System` project) with a user override (any system from `DesignSync.list_projects`)
   - Acceptance: default render references the MindrianOS Design System id; an override setting changes the bound system; default is restored when override is unset

9. **Deck-style sub-selector**: The "Make it land" lane offers a deck-style choice — Feynman / HEART / mesh.
   - Current: no deck-style choice; only a single deck path
   - Target: an F.1 sub-selection of {Feynman, HEART, mesh} each routing to its structure
   - Acceptance: selecting each of the 3 styles routes to a distinct, named generation path; the mesh path composes both structures

10. **HEART as invokable publishing format**: The H.E.A.R.T model (Ben Weiner, Brain-sourced) becomes an invokable command that emits a published visual.
    - Current: HEART is generic methodology in the Brain, not invokable
    - Target: a HEART deck command whose structure (H/E/A/R/T) is filled by LOCAL room content and emitted as an on-brand visual
    - Acceptance: invoking the HEART format produces a 5-section (H/E/A/R/T) deck artifact; the HEART methodology text is fetched generic from Brain, never user content sent to Brain (Part 8 sweep clean)

11. **Consolidate the deck engines into one matured command**: MOSDeckEngine and the feynman-engine are MERGED into a single, deterministically invokable deck command — not two skills.
    - Current: MOSDeckEngine and feynman-engine are two separate conversational skills
    - Target: one deck command (e.g. `/mos:deck`) with a defined invocation contract producing a structured, repeatable deck artifact; Feynman / HEART / mesh are STYLES within it (R9); both prior skills route through this single command
    - Acceptance: a single command emits the deck; both prior skill entry points resolve to it; invoking the same style twice on one room yields the same section structure (deterministic)

12. **Cross-surface behavior**: The selector works on CLI/Desktop/Cowork; rendered results degrade per the 3-layer model.
    - Current: Node generators are CLI-only; degrade silently on Desktop/Cowork
    - Target: selector (AskUserQuestion) identical across surfaces; results route to inline `ui://` where Node can't run, with an explicit note when a Node-only surface is unavailable
    - Acceptance: on a Desktop-flagged run the selector renders and a Node-only result returns an explicit degradation note (not a silent failure)

13. **Methodological deck-build flow (F.1-guided)**: Building a deck is a methodological, step-guided process driven by F.1 selectors, not a one-shot dump.
    - Current: deck skills produce a single free-form output with no per-section gating
    - Target: the deck command walks the user through the chosen structure (the H/E/A/R/T sections or the 6 Feynman stages) with an F.1 gate at each section, filling each from LOCAL room content; the user accepts / reshapes / skips each
    - Acceptance: the build surfaces an F.1 gate per major deck section/stage; a test confirms an accept/reshape/skip choice per section is honored

14. **Deck-design ruleset (source-linking + visual standards + brand assets)**: A codified deck-design rule set the command enforces.
    - Current: no deck-design rules; generators emit ad-hoc HTML with no provenance or asset policy
    - Target: enforce (a) MANDATORY source hyperlinks — every claim/figure links to its source artifact or citation; (b) visual-component standards; (c) SVG + animation usage rules; (d) AI image generation when no suitable asset exists; (e) reuse of the user's EXISTING brand assets (logo, brand colors) when present; (f) DEFAULT ALWAYS the MindrianOS Design System, with the Mindrian logo linking to https://mindrian-os.com
    - Acceptance: a generated deck contains a resolvable hyperlink for every sourced claim; with no user brand present, the deck renders the MindrianOS Design System and a Mindrian logo whose link target is https://mindrian-os.com; with user brand assets present, they are used instead of the defaults

## Boundaries

**In scope:**
- The F.1 JTBD need-selector surface + `data/publish-needs.json` map
- The context trigger sensor (show/share intent) + CIRS born-wired registration
- Persona-adaptive default lane (role_blend read)
- The "show the unseen" admission filter
- Default design-system binding + user override setting
- The deck-style sub-selector (Feynman/HEART/mesh)
- ONE consolidated, INVOKABLE deck command (MOSDeckEngine + feynman-engine merged; Feynman/HEART/mesh as styles; born-wired under CIRS, triggerable when a user is building a business deck)
- The methodological F.1-guided deck-build flow (per-section accept/reshape/skip gates)
- The deck-design ruleset (mandatory source hyperlinks; visual-component + SVG/animation + image-generation standards; reuse of existing user brand assets; DEFAULT ALWAYS MindrianOS Design System + Mindrian logo -> https://mindrian-os.com)
- HEART promoted from Brain methodology into a style of the consolidated command

**Out of scope:**
- Building NEW inline `ui://` parity views for present/export/snapshot/radar — tracked as the inline-view parity gap (mindrianOS solution-design); this phase routes to them, does not build them
- The DesignSync drift-check / dedup of the 3 design systems — that is a separate design-system maintenance task
- External public-URL sharing changes — the Vercel/CLI publish path is unchanged (the connector cannot mint public URLs; competitive-analysis finding)
- A net-new TUI / custom keymap — forbidden (SEED-020); AskUserQuestion only
- Cross-room expert/asset reuse — Part-8-gated, deferred

## Constraints

- AskUserQuestion primitive only — no bespoke scrollable widget, no raw-mode TUI (SEED-020); the host owns the keymap, the phase owns the two axes
- One governed selection path — must route through dispatchSensors -> decide() -> command-resolver; no second selection brain (CIRS R4)
- Part 8: HEART/Feynman methodology stays generic in the Brain; only LOCAL room content fills the structure; zero user content egresses to Brain or to the design backend by default (zero-egress inline default; any off-device venture-content egress is a separate consented feature)
- Build is ~90% repoint of the `/mos:help` selector machinery + the Phase 122 resolver + the Phase 166 runChain; net-new is `data/publish-needs.json`, the trigger sensor, the design-system binding, and the HEART format
- Requirement 11 (engine maturation) is the highest-risk; if it proves larger than the selector it splits to a companion phase but remains a hard dependency of 173

## Acceptance Criteria

- [ ] The F.1 selector renders 4 JTBD lanes via one `AskUserQuestion` call with zero command-name labels
- [ ] `data/publish-needs.json` exists; every job maps to exactly one real `resolves_to` and carries a `shows: connections|gaps` tag
- [ ] A selected job invokes its command via the Phase 122 `command-resolver` (asserted in test), handed to `runChain`
- [ ] A show/share-intent turn fires the selector reach via `dispatchSensors`; a neutral turn does not
- [ ] The Phase 172 coverage gate passes the surface as WIRED; the `cirs_relationship` block is accepted
- [ ] Default lane follows `role_blend` (founder/researcher fixtures verified)
- [ ] Default render binds the MindrianOS Design System; a user override re-binds; unsetting restores default
- [ ] The "Make it land" lane offers Feynman/HEART/mesh, each routing to a distinct path
- [ ] Invoking the HEART format produces a 5-section H/E/A/R/T deck artifact; Part 8 sweep clean
- [ ] Invoking the Feynman format twice on one room yields the same section structure (deterministic)
- [ ] The deck is ONE invokable command both prior skills resolve to; the Phase 172 gate passes it as WIRED (born-wired, triggerable)
- [ ] The deck-build surfaces an F.1 gate per major section; accept/reshape/skip is honored per section
- [ ] Every sourced claim/figure in a generated deck has a resolvable source hyperlink
- [ ] With no user brand present, the default deck renders the MindrianOS Design System and a Mindrian logo linking to https://mindrian-os.com; user brand assets override when present
- [ ] On a Desktop-flagged run, a Node-only result returns an explicit degradation note (no silent failure)

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Navigator-dictated across the 2026-06-23 session             |
| Boundary Clarity   | 0.82  | 0.70 | ✓      | Explicit out-of-scope: parity views, dedup, public URLs      |
| Constraint Clarity | 0.72  | 0.65 | ✓      | AskUserQuestion-only, one path, Part 8 zero-egress           |
| Acceptance Criteria| 0.78  | 0.70 | ✓      | 11 pass/fail checks                                          |
| **Ambiguity**      | 0.16  | ≤0.20| ✓      | R11 engine-maturation flagged as highest-risk / may split    |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective     | Question summary                          | Decision locked                                                |
|-------|-----------------|-------------------------------------------|----------------------------------------------------------------|
| 1     | Researcher      | What is a viz tool good for, any user?    | Show the unseen (connections + gaps), not decoration           |
| 2     | Simplifier      | JTBD terminology, not technical?          | Lanes + options in user-voice jobs; commands hidden (Part 10)  |
| 3     | Boundary Keeper | Invokable, not just typed?                | Context trigger fires it; born-wired CIRS (R1/R2/R3)           |
| 3     | Boundary Keeper | Branding?                                  | MindrianOS Design System default; user can differ              |
| 4     | Failure Analyst | What makes the deck unreliable?           | Engine maturation: deterministic publish contract (R11)        |
| 5     | Seed Closer     | HEART model + deck styles?                | Feynman/HEART/mesh; HEART promoted from Brain to invokable      |

---

*Phase: 173-publish-jtbd-need-selector*
*Spec created: 2026-06-23*
*Next step: /gsd-discuss-phase 173 — implementation decisions (how to build what's specified above)*
