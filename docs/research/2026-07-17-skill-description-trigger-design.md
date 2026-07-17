# Skill-Description Trigger Design -- generic, transferable insight (pending Brain ingestion)

- **Date**: 2026-07-17
- **Status**: verified in production, blocked on Brain admin-key ingestion
- **Origin**: Phase 230 (MindrianOS Skill Fleet Optimization), `docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md`
- **Brain write attempted, blocked**: `brain_query`/`brain_write` require an admin key this session's Brain MCP connection does not carry ("Contact Jonathan for elevated access"). This file is the durable, ready-to-ingest staging copy until a session with that key can run the actual write. See the companion todo: `.planning/todos/pending/2026-07-17-ingest-skill-description-insight-to-brain.md`.

## The insight (generic -- applies to any agent-skill system using progressive disclosure, not MindrianOS-specific)

An AI agent's skill/tool description is the entire routing signal before the agent decides to load anything more -- get it wrong and the skill silently never fires, or fires when it shouldn't. Four principles:

1. **State WHAT and WHEN, not just capability.** A description naming only what a skill does reads as a blurb; an agent needs the trigger conditions -- the situations, phrasing, and intent that should invoke it -- to actually route correctly.
2. **Near-miss siblings need explicit differentiation.** In any dense namespace (multiple skills doing adjacent things), a vague description loses to a sharper sibling's description on genuinely ambiguous queries -- not a bug in the routing, a gap in the wording.
3. **Test against the full candidate roster, not one skill in isolation.** Grading a description alone cannot see competitive collisions -- two skills fighting over one query. Judging the SAME query against every candidate at once is the only way to catch it, and it is cheaper too (one roster-wide call beats N isolated calls).
4. **Revisions need a held-out validation set.** A description "improvement" that only helps the training queries can silently break phrasing that used to work -- real gain must be measured on queries never used to write the fix, selecting the best iteration by validation pass-rate, not the last one produced.

## Verification: this is not just filed prose -- it is already load-bearing, verified 2026-07-17

All four principles are frozen, verbatim, in the shipped Phase 230 rubric files that actually run in production today:

| Principle | Where it lives | Verbatim confirmation |
|---|---|---|
| 1. WHAT + WHEN | `references/methodology/skillopt-revise-rubric.md` | "Write it as a routing rule, not a tagline... 1. WHAT the skill does... 2. WHEN to invoke it" |
| 2. Near-miss differentiation | `references/methodology/skillopt-queries-rubric.md` | "The highest-value negatives are near-misses: a query that shares keywords with a SIBLING in this same family but actually needs the different sibling... spend your best effort here" |
| 3. Roster-wide testing | `references/methodology/skillopt-judge-rubric.md` | "You stand in for progressive disclosure... you receive the FULL MindrianOS skill roster... Predict which ONE skill would actually fire" |
| 4. Held-out validation | `references/methodology/skillopt-revise-rubric.md` | "You never see the validation-set queries or their results... if you could see it you would overfit to it and the check would be worthless" |

Grep-verified directly against the files, not asserted from memory (2026-07-17, this session).

## Related graph content

Brain already holds generic skill-authoring / progressive-disclosure material (T3, `prior_art` tier, e.g. the `skill-creator` chunk and progressive-disclosure explanation surfaced via `brain_search` this session). This insight extends that material with the two pieces it does not yet cover: roster-wide competitive testing (#3) and held-out-validation-gated revision (#4).

## Sources
- `docs/superpowers/specs/2026-07-17-mindrian-skill-optimization-design.md`
- `.planning/phases/230-mindrianos-skill-fleet-optimization-fleet-wide-trigger-accur/230-AI-SPEC.md`
- `references/methodology/skillopt-queries-rubric.md`, `skillopt-judge-rubric.md`, `skillopt-revise-rubric.md` (Phase 230, plans 230-02/230-03)
