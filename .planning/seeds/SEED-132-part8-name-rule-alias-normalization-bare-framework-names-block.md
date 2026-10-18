---
id: SEED-132
title: "Part 8 name rule: 15 of 26 aliased Theo framework names block in bare form (alias normalization, not approved)"
status: filed
priority: medium
filed: 2026-10-18
source: "debug session part8-egress-guard-name-class-blocks-unknown-tool-names (2026-10-18), side defect; navigator did not approve the fix on 2026-10-18"
depends_on: lib/core/part8-egress-guard.cjs (_hasUnknownProperName, CANONICAL_PHRASES), data/framework-names.json
promotes_to: a /gsd-quick after the navigator approves. The XFAIL legs B1 and B2 in tests/test-part8-name-class-methodology-names.cjs turn into passes when this lands.
---

# SEED-132: alias normalization for the name rule

## Problem

data/framework-names.json is a Theo list_frameworks snapshot. 26 of its names carry an alias, 8 in parentheses ("Jobs to Be Done (JTBD)") and 18 after a slash ("Minimum Viable Product / MVP"). `_hasUnknownProperName` blanks a canonical phrase by searching the lowercased question for the full snapshot string, alias included. A person who asks with the bare name never contains the full string, so the name is not blanked and the TitleCase words are flagged as a proper name.

Result: a flagship framework cannot be asked bare. "Which tool follows Jobs to Be Done?" blocks as room_content / name.

## Evidence

- PROVEN (run over every snapshot name, question form "Which tool follows <name>?"): 422 of 422 names allow as the snapshot spells them. Of the 26 aliased names, 15 block in bare form. Examples: Jobs to Be Done, Minimum Viable Product, Diffusion of Innovations, Problem Taxonomy, IDEO Deep Dive, Systematic Inventive Thinking.
- PROVEN: the control question "After a Jobs to Be Done analysis, ..." passes only because the head noun "analysis" sits next to the run. The exemption is accidental, not the allow-list.
- PROVEN: the same defect does not touch the five reported questions of the debug session (Problem Interview, Opportunity Fitness Check, Five Whys, Five Whys Technique). Theo has no node for the first two and only "5 Whys Technique" for the others.
- Test: legs B1 (two room states) and B2 of tests/test-part8-name-class-methodology-names.cjs run and report XFAIL with the reason "alias normalization not approved".

## Proposed direction

In the name rule's own copy of the list only: at load time, strip the "(alias)" text and split on " / ", keep each side as its own phrase, and add the bare forms to the blanking step. Leave `_proveTypedQuestion` and the lexicon generic filter on the full strings, so their behavior does not change.

Open question for the navigator: the alias text itself (JTBD, MVP, Rogers) may also be a valid way to ask. Splitting on the slash keeps both sides, which would also allow "MVP" alone. That is a wider allow than the bare name; decide whether to keep it.

## Canon Part 8 impact

Small and bounded. The change allows only strings that Theo itself lists as framework names, so no new person-name path opens. The risk is a snapshot alias that is also a common name (for example a surname in parentheses). Review the 26 aliases for that before approving.

## Link

Debug session: .planning/debug/resolved/part8-egress-guard-name-class-blocks-unknown-tool-names.md
Related: SEED-129, SEED-130.
