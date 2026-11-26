---
id: SEED-170
status: planted
planted: 2026-11-26
planted_during: Phase 400.4 plan 11 (cold-start replay and close-out); finding from the 2026-11-26 cold-start QA run
trigger_when: the next Theo-side work on the grounding envelope, or the next time a user reads a Theo answer that says "partial" next to "full"
scope: small
owner: Theo repo (not this plugin)
canon_parts: [8]
related: 400.4-QA-SOURCE.md (smaller notes), lib/core/brain-client.cjs (_coverageLabel, grounding.coverage and grounding.coverage_label)
---

# SEED-170: the Theo envelope says coverage "partial" and coverage_label "full" for the same answer

## What was seen

In the 2026-11-26 cold-start QA run, one Theo answer carried two coverage signals that disagree: the coverage status read "partial" while `grounding.coverage_label` read "full".

## Why it happens (read from the code, not yet reproduced on a live answer)

- `grounding.coverage` is Theo's own frozen unit. It counts problem types, so for one problem type it can never read as complete (the comment in `lib/core/brain-client.cjs` says so).
- `grounding.coverage_label` is the plugin's own word. It comes from `_coverageLabel(chain_coverage)`: "full" when `chain_coverage.full === true`, "no_lead_for_type" when `rank1_leads_total` is 0, "partial" otherwise, "unknown" when the block is missing.
- The two measure different things (problem types seen versus rank-1 leads for this type), but both use plain words a reader takes as one fact.

## What to do (Theo side)

- Decide which signal a reader should see. Either rename the Theo unit so it does not say "partial" (for example a count, not a word), or have Theo send one agreed word.
- Do not patch the Brain from this plugin. Do not change `_coverageLabel` to hide the gap: it would make the label lie where the frozen unit tells the truth.
- Part 8 is not affected: both signals are counts and enums about generic methodology, with no room content.

## Why it is a seed and not a fix in 400.4

The disagreement lives in the Theo payload. The plugin's label rule is documented and correct for what it measures. A fix needs a Theo change and a version bump on the Theo side first. Phase 400.4 only files the finding.
