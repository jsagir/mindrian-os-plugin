---
kind: quick
quick_id: 260706-4cb
slug: append-opportunity-statement-formula-add
title: "Append the Opportunity Statement formula addendum to SEED-048 (SEED-049 generator -> SEED-050 critic -> SEED-048 bank, PWS Value Proposition backbone per Brain, confidence 0.90)"
date: 2026-07-06
status: complete
one_liner: "SEED-048 gains one purely-additive section pinning the per-candidate output SHAPE it was missing - the Opportunity Statement formula (PWS Value Proposition specialized for cross-domain pairs, Brain-routed at confidence 0.90) grounded as reuse across SEED-049 (generator) -> SEED-050 (critic) -> SEED-048 (bank), with the Eureka-vs-Opportunity-Statement distinction stated plainly."
key_files:
  created:
    - .planning/quick/260706-4cb-append-opportunity-statement-formula-add/260706-4cb-SUMMARY.md
  modified:
    - .planning/seeds/SEED-048-portfolio-scale-fusion.md
commits:
  - fed5f4d docs(seed-048) add Opportunity Statement formula addendum
---

# Quick Task 260706-4cb: append the Opportunity Statement formula to SEED-048

## What changed

`.planning/seeds/SEED-048-portfolio-scale-fusion.md` gained exactly ONE new section,
`## Opportunity Statement formula (the per-candidate output shape)`, appended at the very
end of the file after the "Standalone research" section's closing "Net effect on scope"
paragraph. The append was done with a single Edit whose old_string was the tail of that
closing paragraph, so every byte above the new section is unchanged.

The section pins the SHAPE of the bank's per-candidate output (the one thing the seed's
research addendum had left open - it resolved what the score MEASURES but never the
paragraph the bank actually stores). It carries:

- The verbatim Opportunity Statement formula in a blockquote (Combining [Technology A]
  (unmet need: X) and [Technology B] (unmet need: Y) ... Key risks / Next steps /
  Estimated potential / Score slots).
- The reuse grounding (Part 7): SEED-049 generates the raw pair, SEED-050's critic must
  pass it as REAL before it becomes a statement, SEED-048's ranked bank stores it in this
  shape one per candidate.
- The framework provenance: a generic-methodology Brain MCP query (Part 8 compliant - only
  the abstract question crossed the wire) routed to "PWS Value Proposition" as the
  structural backbone at confidence 0.90, so the formula is that framework specialized for
  portfolio-scale cross-domain candidates, not a new invention.
- The Eureka-vs-Opportunity-Statement distinction stated plainly: curiosity one-off vs
  banked/ranked/repeatable, with the formula as the critic-gated converter.

## Verification (the plan's own grep gates)

| Gate | Expected | Result |
|------|----------|--------|
| `git diff --stat` | additions only | 16 insertions, 0 deletions - PASS |
| deletions in diff (`^-[^-]`) | none | none - PASS |
| `grep -c '^## '` | 6 (was 5) | 6 - PASS |
| em-dash gate `grep -n $'—'` | nothing | no em-dashes - PASS |
| formula presence `grep -c 'Combining \[Technology A\]'` | 1 | 1 - PASS |

All five gates passed.

## Canon gates

- **Part 7 (Reuse before build):** the section explicitly frames the formula as reuse -
  PWS Value Proposition specialized, plus the existing SEED-049/050/048 pipeline; no
  net-new engine or framework minted.
- **Part 8 (Graph boundary):** doc-only edit to a local `.planning/` seed file; the Brain
  routing cited was a generic-methodology query with no room/user data on the wire, noted
  inline in the appended text.
- **No em-dashes** (CLAUDE.md hard rule): confirmed by the em-dash gate.

## Deviations from Plan

None. The plan was executed exactly as written - read + anchor check (Task 1), additive
append via Edit (Task 2), grep gates (Task 2 verify), commit with the repo's Co-Authored-By
trailer (Task 3).

## Out of scope (honored)

No edits to SEED-049, SEED-050, or `.planning/seeds/INDEX.md`; no change to existing
SEED-048 content; no room research entry minted for a doc-only addendum; no version bump,
no CHANGELOG entry.

## Self-Check: PASSED

- .planning/seeds/SEED-048-portfolio-scale-fusion.md -> FOUND (new section is last, formula present, 6 sections)
- .planning/quick/260706-4cb-append-opportunity-statement-formula-add/260706-4cb-SUMMARY.md -> FOUND
- commit fed5f4d -> FOUND
