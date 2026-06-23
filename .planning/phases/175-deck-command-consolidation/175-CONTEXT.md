# Phase 175: Deck Command Consolidation - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Consolidate MOSDeckEngine + feynman-engine into ONE invokable `/mos:deck` command, with a Feynman/HEART/mesh style sub-selector, a methodological F.1-guided per-section build flow, and a deck-design ruleset (source hyperlinks, brand auto-binding, visual/image-provenance) enforced WARN-first. Born-wired under CIRS; the Phase 173 `/mos:show` make-land lane repoints to `/mos:deck`. Decisions were pre-locked when this phase split out of 173 (D-01/D-04) - this is NOT a fresh discuss.
</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**9 requirements are locked.** See `175-SPEC.md` for full requirements, boundaries, acceptance criteria. Downstream agents MUST read it before planning.

**In scope:** the `/mos:deck` command + 2 skill aliases; the Feynman/HEART/mesh sub-selector; the HEART (5-section, Brain-sourced) + Feynman (deterministic) formats; the F.1 per-section build flow; the deck-design ruleset (WARN-first); born-wiring + the make-land repoint.
**Out of scope:** the `/mos:show` selector (Phase 173); NEW inline ui:// parity views; DesignSync drift/dedup; `/mos:publish` (Vercel) changes; hard-gating the ruleset (deferred).
</spec_lock>

<decisions>
## Implementation Decisions (pre-locked - D-04 + Tavily)

### Command + skills
- **D-04a:** command name `/mos:deck` (`commands/deck.md`).
- **D-04b:** MOSDeckEngine + feynman-engine become ALIASES that resolve to `/mos:deck` (deprecate-not-delete; back-compat). Do NOT delete the skills.
- **D-04c:** Feynman / HEART / mesh are STYLES inside the command, surfaced as an F.1 sub-selector (with the "Other" free-text option per navigator standing preference).

### Ruleset enforcement
- **D-04d:** the deck-design ruleset starts WARN (a `--check` that warns), hard-gates later (CIRS deferred-enforcement, mirrors R6/R11). Do NOT FAIL the build on a ruleset miss this phase.

### From Tavily research (173-RESEARCH-tavily.md)
- In-line source citation is a value lever (Hebbia ISD) - make source hyperlinks first-class, not bureaucratic.
- AI-generated-image provenance footers: bottom-right, 8-10pt, tool name + year.
- Brand auto-binding via a Brand-Kit model (Beautiful.ai): tokens/fonts/logo applied by default.
- Feynman = comprehension spine (deterministic 6-stage); HEART = persuasion spine (Ben Weiner); mesh = per deck type.

### Claude's Discretion
- The exact deck artifact format (HTML vs the existing generator output), the per-style section schemas, the ruleset `--check` script shape, and how the make-land repoint edits `data/publish-needs.json` are left to research/planning (constrained by the SPEC + the existing generators + the Phase 173 publish-needs idiom).

### Navigator preference (standing)
- Every selector exposes an explicit "something else" / "Other" free-text option.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning.**

### Contract
- `.planning/phases/175-deck-command-consolidation/175-SPEC.md` - locked requirements (9).
- `.planning/phases/173-publish-jtbd-need-selector/173-SPEC.md` - source of R8-R11/R13-R14 (this phase's lineage).
- `.planning/phases/173-publish-jtbd-need-selector/173-RESEARCH-tavily.md` - best-implementation research (sections 3-4 are the deck guidance).

### The engines to consolidate (reuse, do not rebuild - Part 7)
- `skills/MOSDeckEngine/SKILL.md` - the 6-stage Feynman deck pipeline (the comprehension spine).
- the `feynman-engine` skill (at ~/.claude/skills/feynman-engine or skills/) - the other engine being aliased.
- `scripts/generate-deck.cjs`, `scripts/generate-presentation.cjs` - the existing deck/slide generators.

### The brand + the selector seam
- `references/visual/palette.json` + `assets/logo.svg` + `templates/destijl-base.css` - the MindrianOS Design System tokens/logo (default brand binding; logo -> mindrian-os.com).
- `data/publish-needs.json` + `commands/show.md` (Phase 173) - the make-land lane to repoint to `/mos:deck`.
- `lib/workflow/command-resolver.cjs` + `lib/core/chain-executor.cjs` - the one governed path.
- a command file with a connector: block (e.g. commands/show.md, commands/think-hats.md) - the born-wired frontmatter to mirror.
- `docs/CIRS-RELATIONSHIP-CONTRACT.md` - the cirs_relationship block `/mos:deck` declares.

### Canon
- `docs/MINDRIAN-CANON.md` - Part 3 (F.1 + gate), Part 10 (commands as internals), Part 11/CIRS (born-wired), Part 7 (reuse), Part 8 (HEART/Feynman methodology generic in Brain; zero venture-content egress).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- MOSDeckEngine + feynman-engine: the deck-generation logic to merge under `/mos:deck` (alias, don't rebuild).
- generate-deck.cjs / generate-presentation.cjs: the renderers.
- palette.json + logo.svg + destijl-base.css: the default Brand-Kit.
- command-resolver + chain-executor: the resolution + runChain path.
- Phase 173's publish-needs.json + show.md: the make-land seam to repoint.

### Established Patterns
- Born-wired command = connector: block + cirs_relationship: block; Phase 172 gate must pass it WIRED.
- AskUserQuestion only for the style sub-selector + per-section gates (SEED-020).
- WARN-first enforcement = a `--check` that warns, mirroring CIRS deferred-enforcement.

### Integration Points
- New `commands/deck.md` + aliases for the two skills.
- The `/mos:show` make-land jobs in `data/publish-needs.json` repoint to `/mos:deck`.
- A deck-design ruleset `--check` script (WARN mode).
</code_context>

<specifics>
## Specific Ideas
- Logo links to https://mindrian-os.com on every generated deck.
- AI-image provenance footer format: bottom-right, 8-10pt, "AI: <tool>, <year>".
- HEART = H/E/A/R/T 5 sections (Ben Weiner); Feynman = the 6-stage pipeline.
</specifics>

<deferred>
## Deferred Ideas
- Hard-gating (FAIL) the deck-design ruleset - this phase is WARN-only.
- NEW inline ui:// parity views (present/export/snapshot/radar) - separate.
- DesignSync drift-check / 3-design-system dedup - separate maintenance.
</deferred>

---

*Phase: 175-deck-command-consolidation*
*Context gathered: 2026-06-23 (decisions pre-locked from the 173 split)*
