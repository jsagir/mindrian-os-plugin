# Phase 173: Publish/Visualize JTBD Need-Selector - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 173 ships the **JTBD need-selector** half of the SPEC: one invokable, context-triggered Shape F.1 selector that asks the user their JOB in plain language and resolves to the right visual/publish command underneath, via the Phase 122 command-resolver + the Phase 166 runChain handoff.

**Scope decision (D-01, 2026-06-23): the phase was SPLIT.** 173 delivers the selector (SPEC requirements R1-R7 + R12). The **consolidated deck command + the deck-design ruleset (SPEC R8-R11, R13-R14) move to a new Phase 175** (deck-command-consolidation). Until 175 lands, the selector's "Make it land" jobs route to the EXISTING deck skills (MOSDeckEngine / feynman-engine). The selector delivers value on its own; the heavy engine-merge is isolated where the SPEC flagged it (R11 = highest-risk).

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**14 requirements are locked.** See `173-SPEC.md` for full requirements, boundaries, and acceptance criteria. Downstream agents MUST read `173-SPEC.md` before planning.

**173 covers (this phase):** R1 (F.1 selector surface), R2 (`data/publish-needs.json` map), R3 (resolver + runChain handoff), R4 (the "show my work" context trigger), R5 (born-wired CIRS conformance), R6 (persona-adaptive default lane), R7 ("show the unseen" filter), R12 (cross-surface behavior).

**Deferred to Phase 175 (deck-command-consolidation):** R8 (deck-style sub-selector), R9 (HEART invokable), R10 (HEART 5-section format), R11 (consolidate the two deck engines into one command), R13 (methodological F.1 deck-build flow), R14 (deck-design ruleset). Until 175, the selector routes to existing deck skills.

**In scope (from SPEC, scoped to 173):** the F.1 JTBD selector surface + `data/publish-needs.json`; the show/share context trigger + CIRS born-wired registration; persona-adaptive default lane (role_blend read); the "show the unseen" admission filter; cross-surface selector behavior.
**Out of scope (173):** the consolidated `/mos:deck` command, the Feynman/HEART/mesh styles, the deck-design ruleset (-> Phase 175); building NEW inline `ui://` parity views for present/export/snapshot/radar; DesignSync drift-check; external public-URL changes; any custom TUI (SEED-020).

</spec_lock>

<decisions>
## Implementation Decisions

### Phase scope
- **D-01:** SPLIT the phase. 173 = selector (R1-7, R12). The consolidated deck command + ruleset (R8-11, R13-14) = new **Phase 175**. The selector routes "Make it land" jobs to the existing MOSDeckEngine/feynman-engine until 175 ships the merged `/mos:deck`.

### Selector front door
- **D-02:** The need-selector is a **NEW command, `/mos:show`** (matches the "show my work" trigger). `/mos:publish` is UNCHANGED - it stays the Vercel-publish action that the "give me a link I can send" job RESOLVES to. No repoint, no overload of `/mos:publish` (which already ships body_shape E + its own connector for Vercel publish).

### Trigger behavior
- **D-03:** The "show my work" sensor surfaces a **standing suggestion at the Decision Gate** (Part 3 GUIDED default - ends in a gate, never auto-fires UI; honors the "no card unprompted" doctrine). It **reuses the existing `context_block` reach** - NO 7th reach is minted (CIRS R3; precedent: SENS-09 reused `brain_consult`).

### Deck command (seeds Phase 175, not built in 173)
- **D-04:** Phase 175 will ship **`/mos:deck`**; MOSDeckEngine + feynman-engine become **aliases** (deprecate-not-delete, back-compat); Feynman/HEART/mesh as a **style sub-selector**; the deck-design ruleset (mandatory source hyperlinks, SVG/animation/image-gen standards, brand-asset reuse, default MindrianOS Design System + logo -> mindrian-os.com) starts **WARN**, hard-gates later (CIRS deferred-enforcement pattern, mirrors R6/R11).

### Claude's Discretion
- The exact `data/publish-needs.json` schema fields, the role_blend->default-lane mapping table, the pagination cutoffs, and the `cirs_relationship` block wording are left to research/planning (constrained by the SPEC + the `help-groups.json` precedent).

### Navigator preference (standing)
- Selectors should always expose an explicit "something else" / free-text option (the AskUserQuestion "Other" choice). Apply to every F.1 surface this phase renders.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's contract
- `.planning/phases/173-publish-jtbd-need-selector/173-SPEC.md` - locked requirements (14); MUST read before planning. 173 covers R1-7 + R12.

### The reusable machinery (the ~90% repoint)
- `scripts/help-renderer.cjs` + `data/help-groups.json` - the existing F.1 two-axis selector this one mirrors.
- `lib/workflow/command-resolver.cjs` - the single resolution door (Phase 122); every job resolves through it.
- `lib/core/chain-executor.cjs` - runChain post-gate handoff (Phase 166): auto-runs autonomous_safe prefix, halts at first material step.
- `lib/core/insight-sensors.cjs` - dispatchSensors; where the show/share trigger sensor registers (reuse `context_block`).
- `lib/core/navigation-engine.cjs` - decide(); the engine-side governed path (CIRS R4).
- `lib/mcp/app-views.cjs` - the 3 shipped inline `ui://` views (dashboard/wiki/graph); the cross-surface render target.
- `commands/publish.md` - the EXISTING Vercel-publish command (do not modify; the selector routes to it).
- `data/dispatch-framework-map.json` - the map idiom `publish-needs.json` mirrors.

### Canon (governing)
- `docs/MINDRIAN-CANON.md` - Part 3 (Shape F.1 + the gate), Part 10 (commands are internals), Part 2a (role_blend default lane), Part 11/CIRS (born-wired R1/R2/R3, one governed path R4), Part 7 (reuse).
- `docs/CIRS-RELATIONSHIP-CONTRACT.md` - the `cirs_relationship:` block 173 must declare.

### Filed research (product room)
- mindrianOS `solution-design/design-mcp-room-deck-and-palette-binding.md` (inline-view parity gap), `product-evolution/design-mcp-connector-authoring-path.md` (design-system brand backend).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `help-renderer.cjs` + `help-groups.json`: the F.1 lanes-as-tabs + options-as-jobs pattern, pagination, and the data-driven map - the selector is this, repointed to publish-needs.
- `command-resolver.cjs`: resolve a job -> a real command object (never a slug from memory).
- `chain-executor.cjs` runChain: the autonomous_safe-prefix + halt-at-material handoff.
- `insight-sensors.cjs` dispatchSensors + `navigation-engine.cjs` decide(): the spine the trigger rides; reuse `context_block`.

### Established Patterns
- F.1 selector = AskUserQuestion only, no custom TUI (SEED-020); host owns the keymap, phase owns the two axes.
- Data-driven maps live in `data/*.json` (help-groups, dispatch-framework-map); `publish-needs.json` follows.
- CIRS born-wired: a `connector:` block on the new `/mos:show` surface + a `cirs_relationship:` declaration; the Phase 172 coverage gate must pass it WIRED.

### Integration Points
- New `/mos:show` command file (`commands/show.md`) with frontmatter `connector:` + `cirs_relationship:`.
- New `data/publish-needs.json`.
- A trigger sensor registered in `insight-sensors.cjs` firing `context_block`.
- The "give me a link" job resolves to the unchanged `/mos:publish`.

</code_context>

<specifics>
## Specific Ideas

- Front-door command name: `/mos:show` (D-02).
- Trigger reach: `context_block`, suggestion-at-gate (D-03).
- Always expose a "something else" free-text option in the selector (navigator standing preference).

</specifics>

<deferred>
## Deferred Ideas

- **Phase 175 - deck-command-consolidation** (SPEC R8-11, R13-14): `/mos:deck` merging MOSDeckEngine + feynman-engine (aliased), Feynman/HEART/mesh styles, the methodological F.1 deck-build flow, the deck-design ruleset (warn-first). Decisions pre-captured in D-04. SEED in ROADMAP this session.
- NEW inline `ui://` parity views for present/export/snapshot/radar (the parity gap) - tracked separately, not 173.
- DesignSync drift-check / 3-design-system dedup - separate maintenance task.

</deferred>

---

*Phase: 173-publish-jtbd-need-selector*
*Context gathered: 2026-06-23*
