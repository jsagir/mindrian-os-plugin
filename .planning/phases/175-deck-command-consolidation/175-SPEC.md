---
phase: 175
slug: deck-command-consolidation
canon_parts: [1, 3, 7, 10, 11]
cirs_relationship:
  surfaces_added: ["/mos:deck (consolidated deck command)"]
  surfaces_modified: ["MOSDeckEngine -> alias", "feynman-engine -> alias", "/mos:show make-land lane repoint"]
  surfaces_removed: []
  spine_consumed: "command-resolver (Phase 122) + runChain (Phase 166)"
  gate_impact: "born-wired under CIRS R1/R2; deck-design ruleset enforced WARN-first (deferred-enforcement)"
---

# Phase 175: Deck Command Consolidation (/mos:deck) - Specification

**Created:** 2026-06-23
**Ambiguity score:** 0.15 (gate: <= 0.20)
**Requirements:** 9 locked

## Goal

MOSDeckEngine and the feynman-engine become ONE invokable `/mos:deck` command. The build is a methodological, F.1-guided flow with a deck-style choice (Feynman / HEART / mesh), enforcing a deck-design ruleset (mandatory source hyperlinks, brand-asset reuse, default MindrianOS Design System), so a navigator goes from room content to an on-brand, source-cited deck artifact through one governed surface.

## Background

Today two separate conversational skills exist (`skills/MOSDeckEngine/`, the `feynman-engine` skill) - neither is a deterministically invokable command, neither enforces a design ruleset, and HEART (Ben Weiner's pitch model) lives only as generic methodology in the Brain (verified present 2026-06-23, T3). Phase 173 shipped `/mos:show`, whose "Make it land" lane currently routes to the EXISTING skills (the interim from D-01). The MindrianOS Design System ships live (DesignSync project `aea2a72a-...`, brand tokens + logo). This phase consolidates the engines and makes the deck a first-class, born-wired command. Source: `.planning/phases/173-publish-jtbd-need-selector/173-SPEC.md` R8-R11/R13-R14; decisions D-04; research `173-RESEARCH-tavily.md`.

## Requirements

1. **Consolidated `/mos:deck` command**: MOSDeckEngine + feynman-engine merge into one invokable command.
   - Current: two separate conversational skills, no command
   - Target: `commands/deck.md` (the `/mos:deck` command); `MOSDeckEngine` + `feynman-engine` become ALIASES that resolve to it (deprecate-not-delete, back-compat)
   - Acceptance: `/mos:deck` exists and is invokable; both prior skill entry points resolve to it; a test asserts the alias resolution

2. **Deck-style sub-selector (Feynman / HEART / mesh)**: the build offers a style choice.
   - Current: no style choice
   - Target: an F.1 sub-selection {Feynman, HEART, mesh} (AskUserQuestion, with the "something else" Other option), each routing to a distinct generation path; mesh composes both
   - Acceptance: selecting each of the 3 styles routes to a named distinct path; mesh path invokes both structures; test asserts 3 distinct routes

3. **HEART format (Brain-sourced, 5 sections)**: HEART becomes an invokable, publishable deck structure.
   - Current: HEART is generic methodology in the Brain, not invokable
   - Target: the HEART style emits a 5-section H/E/A/R/T deck (Hypothesis / Enormous stakes / Alternatives inadequate / Radically different / Team) filled from LOCAL room content; the HEART methodology text is fetched generic from Brain
   - Acceptance: invoking the HEART style produces a 5-section artifact; Part 8 sweep clean (no user content sent to Brain)

4. **Feynman format (deterministic pipeline)**: the Feynman style is a repeatable structured pipeline, not free prose.
   - Current: free-form conversational skill
   - Target: the Feynman style runs the defined stage pipeline (reduce to essence -> plain language -> expose confusion -> build mental model -> simplify -> teach back) producing a structured deck
   - Acceptance: invoking the Feynman style twice on one room yields the same section structure (deterministic)

5. **Methodological F.1-guided deck-build flow**: building is step-guided with per-section gates.
   - Current: one-shot output, no per-section gating
   - Target: the command walks the chosen structure with an F.1 gate per section (accept / reshape / skip), filling each from room content
   - Acceptance: the build surfaces an F.1 gate per major section; a test confirms accept/reshape/skip is honored per section

6. **Deck-design ruleset - source linking**: mandatory source hyperlinks.
   - Current: ad-hoc HTML, no provenance
   - Target: every sourced claim/figure carries a resolvable hyperlink to its source artifact or citation (the in-line-citation value lever, per Tavily/Hebbia ISD)
   - Acceptance: a generated deck contains a resolvable hyperlink for every sourced claim; a `--check` flags a sourced claim without a link

7. **Deck-design ruleset - brand + default design system**: on-brand by construction.
   - Current: hardcoded De Stijl HTML, no design-system binding
   - Target: render binds the MindrianOS Design System BY DEFAULT (Brand-Kit model: tokens/fonts/logo applied automatically) with the Mindrian logo linking to https://mindrian-os.com; user brand assets (logo, colors) reused when present; the default is user-overridable
   - Acceptance: with no user brand, the deck renders the MindrianOS Design System + a Mindrian logo whose link target is https://mindrian-os.com; an override re-binds; user brand assets override when present

8. **Deck-design ruleset - visuals + image provenance**: visual-first with AI-image provenance.
   - Current: no visual/image rules
   - Target: SVG/diagram/visual-metaphor first, one main idea per slide; when an AI-generated image is used, stamp a provenance footer (consistent location bottom-right, 8-10pt, tool name + year)
   - Acceptance: a deck using an AI-generated image carries a provenance footer matching the format; a `--check` flags a missing-provenance AI image

9. **Born-wired CIRS + selector repoint**: `/mos:deck` is governed and the `/mos:show` make-land lane points to it.
   - Current: `/mos:show` make-land lane routes to the legacy skills (173 interim)
   - Target: `commands/deck.md` carries a `connector:` block + `cirs_relationship:` (passes the Phase 172 coverage gate WIRED); `data/publish-needs.json` make-land jobs repoint from the skill handles to `/mos:deck`; the deck-design ruleset enforcement starts WARN, hard-gates later (CIRS deferred-enforcement, mirrors R6/R11)
   - Acceptance: `build-connector-registry.cjs --check` exits 0 with `/mos:deck` WIRED; the publish-needs make-land jobs resolve to `/mos:deck`; the ruleset `--check` runs in WARN mode

## Boundaries

**In scope:**
- The consolidated `/mos:deck` command + the two skill aliases
- The Feynman / HEART / mesh style sub-selector
- The HEART (Brain-sourced, 5-section) + Feynman (deterministic pipeline) formats
- The methodological F.1-guided per-section build flow
- The deck-design ruleset (source hyperlinks, brand auto-binding + logo->mindrian-os.com, visual/SVG/image-provenance), WARN-first
- Born-wiring + the `/mos:show` make-land repoint to `/mos:deck`

**Out of scope:**
- The `/mos:show` selector itself (shipped in Phase 173)
- NEW inline `ui://` parity views for present/export/snapshot/radar - the parity gap, tracked separately
- DesignSync drift-check / dedup of the 3 design systems - separate maintenance task
- External public-URL publishing changes - `/mos:publish` (Vercel) unchanged
- Hard-gating the deck-design ruleset (FAIL) - deferred-enforcement; WARN this phase

## Constraints

- AskUserQuestion only for the style sub-selector + per-section gates (SEED-020; no custom TUI)
- One governed path: the deck command resolves through command-resolver + runChain; no second selection brain (CIRS R4)
- Part 8: HEART/Feynman methodology stays generic in the Brain; only LOCAL room content fills the structure; zero venture-content egress by default (inline-only); any off-device egress is a separately-consented feature
- Reuse: build on the shipped MOSDeckEngine/feynman-engine internals + the Phase 173 selector machinery + the live MindrianOS Design System; do not rebuild a deck renderer from scratch (Part 7)
- No em-dashes (project hard rule)

## Acceptance Criteria

- [ ] `/mos:deck` exists, is invokable, and both prior skills resolve to it as aliases
- [ ] The style sub-selector offers Feynman/HEART/mesh (+ "Other"), each a distinct route
- [ ] HEART style emits a 5-section H/E/A/R/T artifact; Part 8 sweep clean
- [ ] Feynman style is deterministic (same section structure on repeat)
- [ ] The build surfaces an F.1 gate per major section (accept/reshape/skip honored)
- [ ] Every sourced claim in a generated deck has a resolvable source hyperlink
- [ ] Default deck renders the MindrianOS Design System + Mindrian logo linking to https://mindrian-os.com; user brand overrides when present
- [ ] AI-generated images carry a provenance footer (bottom-right, 8-10pt, tool+year)
- [ ] `build-connector-registry.cjs --check` exits 0 with `/mos:deck` WIRED; publish-needs make-land jobs resolve to `/mos:deck`
- [ ] Regression: REACH_IDS stays length 6; run-all-172.sh + run-all-173.sh stay green

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                       |
|--------------------|-------|------|--------|-------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ok     | Derived from locked 173-SPEC deferred items + D-04 + Tavily |
| Boundary Clarity   | 0.85  | 0.70 | ok     | Explicit out-of-scope: selector, parity views, dedup, publish |
| Constraint Clarity | 0.72  | 0.65 | ok     | AskUserQuestion-only, one path, Part 8 zero-egress, reuse   |
| Acceptance Criteria| 0.78  | 0.70 | ok     | 10 pass/fail checks                                         |
| **Ambiguity**      | 0.15  | <=0.20| ok    | Engine-merge (R1) is the highest-risk requirement           |

## Interview Log

| Round | Perspective     | Question summary                          | Decision locked                                              |
|-------|-----------------|-------------------------------------------|-------------------------------------------------------------|
| -     | (pre-locked)    | Split from Phase 173 (D-01)               | Deck consolidation is its own phase                          |
| -     | (pre-locked)    | Command + skills (D-04)                    | /mos:deck; alias both engines; styles; ruleset warn-first   |
| -     | (Tavily)        | Best implementation per area              | In-line citation value lever; AI-image provenance; Brand-Kit; Feynman=comprehension / HEART=persuasion |

---

*Phase: 175-deck-command-consolidation*
*Spec created: 2026-06-23*
*Next step: /gsd-discuss-phase 175 (or /gsd-plan-phase 175 - decisions are largely pre-locked)*
