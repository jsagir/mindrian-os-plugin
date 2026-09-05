---
id: SEED-086
status: dormant
planted: 2026-09-05
planted_during: Phase 276 close-out session (15/16 plans landed, Task 3 human-verify checkpoint pending) - surfaced while resuming the phase, from a real unrelated external report that arrived the same week
trigger_when: "when a second independent instance of hedge-labeled content fabrication is reported (per this repo's own three-instance 'pattern, not gripe' bar, Phase 275 precedent) - promote to a numbered phase only then; or earlier, if whoever plans Phase 276's own follow-up work (STATE.md's named 'hardening check-tool-honesty to --strict' item) is looking for the next tool-honesty-family gap to scope; or when CLAUDE.md / agent system-prompt conventions are next revised for any reason, since the candidate disposition below is cheap to add opportunistically"
scope: unknown
---

# SEED-086: A hedge label ("illustrative", "e.g.") on an unsourced number is a fabrication category, not an exemption from one - and no detector in this repo's tool-honesty family reaches it

## Why This Matters

Phase 276 ("Same-Disease Consolidation - MCP + Local-Graph False-Success Deep Fixes") just landed
15 of 16 plans, hardening `check-tool-honesty.cjs` and the false-success detector against the
class of defect where a tool, an MCP description, or a local-graph write claims success or
completeness it did not actually deliver. That detector's reach is real but bounded: it scans MCP
tool code and local-graph write paths. It has no reach into raw conversational or document prose -
the free-form text an agent generates directly in a chat turn or an HTML/markdown deliverable.

An external report arrived this week describing exactly that uncovered layer: a document under
review by a domain-expert reader (not this repo's own tooling) contained invented figures -
category-shape: unsourced financial estimates (cost, break-even, budget, cohort-size type
numbers) - originally fabricated in one session, then wrapped in a hedge word ("illustrative")
before being reused in a later session. The hedge word did real damage: a subsequent review pass
caught unrelated issues (tone, unproven claims) in the same document but treated the hedged
financial figures as acceptable *because* they were labeled, rather than recognizing the label as
a way a fabrication survives review. The domain-expert reader caught it, not the review process.

Source, not reproduced here: an external report dated 2026-09-04, addressed to this project's own
maintainer, naming this exact failure shape and explicitly asking what standing instruction would
prevent recurrence. The report's own content (a live example of the technique) is not this repo's
material to file verbatim; the defect *shape* is what's actionable here. Cite as: "2026-09-04
external fabrication-hedge report" if this seed is ever enriched or promoted.

This is the same disease Canon Part 6 (Dog-Fooding Mandate) already names - a real violation
surfaces as a CONTRADICTS edge against the plugin's own honesty claims - at a layer none of
Phase 276's sixteen plans scoped, because none of them were about prose/document generation.

## The Gap, Precisely

- **What Phase 276 covers**: MCP tool description accuracy, tool behavior claims, local-graph
  node-write honesty (`lib/core/node-insert.cjs` chokepoint), busy/broken-state reporting
  (`room_db_busy`/`room_db_broken`), and the `check-tool-honesty.cjs` static/dynamic sweep (10 to
  24 findings after the D-1 detector fix, all dispositioned in `276-15-SUMMARY.md`).
- **What it does not and structurally cannot cover**: content an agent writes directly into a
  conversation turn or a generated document (a number, a claim, a statistic) that never passes
  through an MCP tool call or a graph write. There is no tool description to audit and no node to
  inspect - the "tool" in this failure mode is the agent's own unmediated prose.
- **The specific new pattern this instance adds** beyond generic "don't fabricate": a disclaimer
  word is not a neutral hedge, it is potentially a *laundering* mechanism. Something already
  known to be invented, once labeled "illustrative" / "e.g." / "for example," starts reading to a
  later reviewer (human or agent) as pre-cleared rather than as unsourced. The failure is not
  "the agent lied" - it's "the agent's own review step trusted a disclaimer instead of asking
  where the number came from."

## Candidate Disposition (not yet designed, not yet built)

Two non-exclusive directions, either or both worth scoping once/if this pattern repeats:

1. **A standing instruction**, cheap and immediate: encode directly in CLAUDE.md / agent system
   prompts / Larry's own persona instructions a rule shaped like: "a number is either sourced
   (a citable price, a published statistic, a calculation the reader can verify) or it does not
   appear - there is no such thing as an illustrative number that was invented. If a figure
   matters and isn't sourced, say 'this needs to be modeled/measured' and stop." This is close to
   what the external report's own AI-authored reply already drafted unprompted - worth treating as
   a found artifact, not reinvented from scratch, if this seed is ever enriched.
2. **A detector**, harder and not yet scoped: something in the `check-tool-honesty.cjs` family (or
   a sibling) that can flag hedge-word-adjacent numeric claims in generated prose/HTML/markdown
   output for a human second look, the same way the tool-honesty sweep flags MCP description
   drift. Whether this is even tractable (false-positive rate on legitimate hedged estimates,
   e.g. genuinely-labeled illustrative examples that are NOT presented as real data) is an open
   design question, not a given.

Per this repo's own promotion bar (Phase 275's precedent: three independent occurrences from three
different methods before a finding becomes a numbered phase), this is currently ONE occurrence.
It is filed as a seed, deliberately not force-promoted to a phase.

## Scope Estimate

**Unknown** - direction 1 (a CLAUDE.md/prompt instruction) is small if it's ever picked up alone;
direction 2 (a detector) is unscoped and may not be tractable at all. A planner should size
whichever direction is live at trigger time, not this seed.

## Breadcrumbs

- `.planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/` - the
  sibling phase this seed's gap sits directly adjacent to; read `276-15-SUMMARY.md` for the
  detector's actual current reach before scoping either direction above.
- `scripts/check-tool-honesty.cjs` - the existing detector family; direction 2 above would be a
  sibling or extension of this, not a rewrite.
- `.planning/debug/knowledge-base.md` and `.planning/debug/resolved/meeting-file-meeting-false-success.md`
  - the RCA record for the sibling MCP-layer false-success defect Phase 276 closed; same disease,
  different surface, worth cross-reading for how that RCA was written.
- CLAUDE.md's own "Consult ALL Relevant Grounding Sources" and Canon Part 6 (Dog-Fooding Mandate)
  sections - where a standing instruction (direction 1) would most naturally land.
- `feedback_false_success_silent_skip_gates_academy_testers.md` (personal memory, OPEN since
  2026-07-14) - the standing WATCH item this whole disease family traces back to; this seed is a
  new, dated data point for that pattern, not a new pattern of its own.

## Notes

Filed the same session Phase 276 was resumed to close its final human-verify checkpoint - the
adjacency is real, not coincidental: reviewing what Phase 276 actually covers is what made the gap
visible. Deliberately not naming the external reporter or reproducing their private content here,
consistent with this repo's own no-real-names-in-tracked-repos convention; the defect shape is
what travels, not the source.
