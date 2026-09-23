# Phase 361: Dominant-design research mode - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning
**PM:** jsagi-ec session (the navigator's delegation, 2026-09-23: "build a dominant design research command/agent in MindrianOS that you are the PM of, with any relevant parts needed to support it")

<domain>
## Phase Boundary

`/mos:dominant-designs` is today a purely conversational Utterback-Abernathy walk: six phases, every fact from the navigator's head, `web_scope: null`, no agent, nothing external read. This phase gives it an **evidence engine**, not a second command:

- A new parallel agent, `agents/dominant-design-researcher.md`, answers ONE evidence question per invocation and returns structured JSON in which every claim carries a source or is absent.
- The command's existing "Quick pass or deep dive?" fork gains a research path on the deep-dive side. The quick pass stays exactly as it is today.
- Larry runs the six methodology phases ON TOP of the filed evidence pack, citing evidence rows.
- Supporting parts: Part 8 known-shape entries for the Theo calls, provenance filing, the registry row, and the theo-resync notification.

Out of scope: a new `/mos:` command (ruled out), any scoring or dominance number the evidence does not source, Jev/TypeSafe judgment (rule-1 amendment pending on the Theo side), and Theo-side code (Theo owns its own phases).

</domain>

<decisions>
## Implementation Decisions

### Shape (navigator, 2026-09-23)
- **D-01:** Upgrade the existing `/mos:dominant-designs`. No new command, no duplicate registry row. The registry row `data/command-registry.json` (`/mos:dominant-designs`, around line 545) is updated in place (`web_scope`, the agent it dispatches, `produces`), and the theo-resync dispatch fires per `docs/THEO-NOTIFY-CONTRACT.md`.
- **D-02:** Planned now, in parallel with Theo Phase 20's execution. Different repo, no file overlap.

### Entry and spend guard
- **D-03:** Entry is the existing "Quick pass or deep dive?" question. Deep dive leads to a **query gate**: Larry composes the planned research question(s) per lane from the navigator's domain answer (methodology Phase 1, Domain Selection) and shows them as a gate card. The navigator approves or edits, and only then do the agents fan out. No silent web spend. The pattern to copy is `agents/analogy-query-fetcher.md` (it fetches exactly the navigator-approved query string and never rephrases or supplements it).
- **D-04:** The researcher agent never composes, rephrases or expands a query. It runs exactly what the gate approved, the same contract as analogy-query-fetcher.

### Evidence lanes (all four, navigator multi-select)
- **D-05:** Four lanes, one agent invocation per lane, dispatched in parallel:
  1. **Variant census:** competing designs in the domain, first-appearance dates, backers.
  2. **Convergence signals:** standards, market-share shifts, exits, consolidation dates.
  3. **S-curve limits:** physical, market and economic ceilings of the current dominant design.
  4. **Discontinuity signals:** new entrants, substitutes, patent and funding bursts.
- **D-06:** Every claim row carries `{claim, source_url, source_title, retrieved_at, quote_or_locator}`. A claim without a source is dropped, not hedged (Canon Part 12 sourced-claims rule). No scores, no confidence floats, no "dominance strength" number unless a source states it.

### Output
- **D-07:** **Evidence pack plus Larry.** One filed evidence artifact per lane in the room, through the existing `fileEvidenceWithReadback` filing path with provenance. Larry then runs the six phases, and the final analysis artifact (the existing template in `references/methodology/dominant-designs.md`) links each statement back to its evidence rows. A lane that found nothing files an explicit empty result ("searched X, found no sourced evidence"), never a silent gap.
- **D-08:** Nothing files without the navigator's approval, following the existing command's "File this to competitive-analysis?" confirm step and the nugget-routing rule.

### Theo dependency
- **D-09:** **Use Theo if it is served, degrade otherwise.** When the Theo catalog lists `framework_step` / `framework_techniques` (Theo Phase 20) or `case_story` (Theo Phase 20.1), read the Dominant Design framework structure and worked cases from Theo with generic handles only (the framework name). When a tool is absent, fall back to `references/methodology/dominant-designs.md` and state which source the structure came from in the artifact. Ship does not wait on Theo's deploy.
- **D-10:** Part 8: Theo calls carry ONLY the generic handle `"Dominant Design"` (and case/framework names), never room content or the navigator's domain text. Add known-shape entries for `framework_step`, `framework_techniques` and `case_story` to `lib/core/part8-egress-guard.cjs` `_proveKnownToolShape` (around lines 455-465) as **separate entries**. Do not edit Phase 355's `find_connections` entry, so the two phases do not collide on that block (jsagi-d9's request, 2026-09-23). Tavily queries are web egress, not Brain egress. They carry the navigator-approved query text and are the navigator's explicit spend (D-03).

### Research-round resolutions (navigator, 2026-09-23, after 361-RESEARCH.md)
- **D-11 (registry, answers research OQ-1):** Frontmatter only. Set `connector.web_scope: white` on `commands/dominant-designs.md` (Canon Part 2: White = Tavily + arxiv for research), add a `data/subagent-dispatch-grants.json` grant row for the new agent marked pending until the navigator ratifies, and update the `teaching` line. `scripts/build-command-registry.cjs`'s schema is NOT changed. The registry hash change rides the next release's Step 5.6 theo-resync, and this phase sends no notify itself.
- **D-12 (autonomous_safe, answers OQ-2):** Keep `autonomous_safe: true`, the same as find-analogies, with an explicit body rule: an unattended or chain-driven run ALWAYS takes the quick pass and never researches. The research path always halts at the D-03 query gate.
- **D-13 (evidence tiers, answers OQ-4):** Use the research recommendation. Company primary sources and market data are filed as Operational; peer-reviewed and standards-body sources rank higher; press and blogs rank lower. Every evidence row names its source type.
- **D-14 (Part 8 ownership, answers OQ-3):** The entries for `framework_step` / `framework_techniques` / `case_story` land in 361, after the `recommend_chain` block (research: `part8-egress-guard.cjs` around 476-492). The task FIRST checks whether the post-Theo-20 M-side phase (handoff `docs/2026-09-23-HANDOFF-theo-phase-20-and-phase-361-m-side-work.md` item 1a) already added an entry, and adds only what is missing. It never edits Phase 355's find_connections block.
- **D-15 (case_story shape, OQ-5):** Assume `{framework}` until Theo 20.1 publishes it. A wrong guess only makes the call ambiguous, never unsafe. Recheck when Theo 20.1's MOS-LEARNING lands.
- **D-16 (live Theo reality, research finding):** Today `framework_step` returns Dominant Design with `steps: []`, and `framework_techniques` / `case_story` are not served. "Served but zero steps" is a fallback reason alongside "tool not listed". Detect not-served by the text `Tool X not found`, never by the `-32602` code alone.
- **D-17 (host tool enforcement, research finding):** The new agent declares `tools:` (the only key Claude Code enforces for agents) AND repeats the same list under `allowed-tools:` (the key repo audits read). It uses `connector.excluded` with a reason and no `hitl_shape`. Fixing the two existing fetchers' `tools:` gap is a SEPARATE quick task, not 361.

### Claude's Discretion
- Agent file naming, JSON schema field names beyond D-06's minimum, how many Tavily calls each lane may make (set a small fixed cap and state it), and whether lanes run as `Agent` fan-out or a chain (the `chain_run` autonomous_safe prefix is acceptable if it halts at the query gate).

</decisions>

<canonical_refs>
## Canonical References

- `commands/dominant-designs.md`: the command being upgraded (frontmatter `connector`, `web_scope: null`, session flow)
- `skills/dominant-designs/SKILL.md`: the skill surface
- `references/methodology/dominant-designs.md`: the six phases and the artifact template (the fallback structure source under D-09)
- `agents/analogy-query-fetcher.md`: the approved-query-only fetcher contract to copy (D-03, D-04)
- `agents/competitor-watch-fetcher.md`: the read-only, structured-JSON, never-writes fetcher pattern to copy
- `agents/research.md`: the existing Tavily + Brain research agent (for sourcing and provenance conventions; not reused directly)
- `lib/core/part8-egress-guard.cjs` `_proveKnownToolShape` (around 455-465): where the D-10 known-shape entries go
- `lib/core/navigation.cjs` / `fileEvidenceWithReadback`: the filing path (D-07)
- `data/command-registry.json` (the `/mos:dominant-designs` row) and `docs/THEO-NOTIFY-CONTRACT.md`: the registry update and resync (D-01)
- Theo contract, read-only: `/home/jsagi/Theo/.planning/phases/20-pws-brain-mcp-tool-migration-and-d-06-revisit-make-theo-the-/20-CONTEXT.md` and its `20-MOS-LEARNING.md` once written (tool shapes for `framework_techniques {framework}`, `framework_step`, and later `case_story`); Theo's live canon has `Framework {name: "Dominant Design"}` (resolved live 2026-09-23)
- `docs/2026-09-23-HANDOFF-theo-phase-355-seams.md`: sibling-phase boundaries on the Part 8 recognizer

</canonical_refs>

<code_context>
## Existing Code Insights

- The command already has the right HITL shape (`F.1`), the `connector` frontmatter (`sensor_triggers: [SENS-06]`, `filing: fileEvidenceWithReadback`), and `autonomous_safe: true`. The research path adds a material step (web spend), so the query gate is where the chain must halt. Check that `autonomous_safe` stays truthful for the quick pass, and mark or split the research path so it does not claim autonomous_safe.
- Three other sessions are active in this repo (Phases 355, 358, 359, 360). Commit with `git commit --only` and explicit paths. `.planning/` files need `git add -f` (force-tracked).

</code_context>

<specifics>
## Specific Ideas

- The gate card shows the four lane questions composed from the navigator's domain, for example "competing designs for {domain} since {year}". The navigator can drop a lane before spend.
- Each evidence artifact ends with a "Searched, not found" list, so absence is visible.

</specifics>

<deferred>
## Deferred Ideas

- A Jev-judged "does this evidence support convergence" classifier: waits on the Theo rule-1 amendment (SEED-015) and Phase 355's policy work.
- A scheduled re-scan of a domain's discontinuity lane (a scout-style watch). This would be its own phase.
- Card rendering for Theo's `visualize_framework_map` output of the Dominant Design framework: waits on the Theo card-rendering phase.

</deferred>

---

*Phase: 361-dominant-design-research-mode*
*Context gathered: 2026-09-23*
