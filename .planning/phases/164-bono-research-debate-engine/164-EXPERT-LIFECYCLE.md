# Synthetic Expert Lifecycle: Ranking, Freshness, Cross-Room (Phase 164 design input)

- **Date:** 2026-06-17
- **Closes:** the two open threads from `164-SYNTHETIC-EXPERTS.md` - how experts are RANKED for re-invocation, and the cross-room library contract. Adds the anti-ossification guard.
- **Canon parts:** 2, 4, 5, 8, 9.

## 1. Re-invocation ranking (which expert fills a hat slot)

When Engine 2 needs to fill a `(hat, subdomain)` slot, it queries confirmed `SyntheticExpert` nodes and ranks:

**Match tiers (most specific wins):**
1. exact `hat` + exact `subdomain`
2. exact `hat` + same `domain` (different subdomain)
3. exact `hat` + same `archetype`
4. no match -> generate fresh

**Score within a match tier (all LOCAL scalars, no Brain):**
```
score = w1 * evidence_tier_rank        // Academic 4 > Operational 3 > Practitioner 2 > None 1 (Part 5)
      + w2 * survival_rate             // fraction of past debates where this expert's reading was the RULING (not REJECTED_BECAUSE)
      + w3 * recency_decay(last_used)  // newer = higher; exponential decay
      - w4 * staleness_penalty         // see freshness gate below
```
- `survival_rate` is computed by walking the expert's `STATES`/`SUPPORTS` edges to past `RESOLVED_AS` rulings - pure graph walk via `navigation.cjs`. An expert that kept being overruled sinks.
- Weights live in a small config; defaults tuned in plan-phase. The selector surfaces the top candidate at the Decision Gate; Mode A marks RECOMMENDED only at confidence >= 0.70 (Part 3 invariant).

## 2. Freshness gate (an expert can go stale)

Mirror the Act 1 source-hash invalidation pattern (STATE.md caching):

- Each `SyntheticExpert` records the `governing_thought_hash` / subdomain-claim-set hash it was last validated against.
- On lookup, if the subdomain's underlying claims have materially changed since (hash mismatch), the expert is flagged `stale`.
- Stale -> do NOT silently reuse. Either REFRESH (re-run the persona against current room state, re-confirm) or fall back to fresh generation. A stale expert reused blind would argue yesterday's venture.

## 3. Anti-ossification guard (the real failure mode)

A reusable expert roster risks an echo chamber - the same lenses re-winning, the team calcifying around its own priors. Three guards, each canon-flavored:

1. **Mandatory fresh lens per run (Green-hat rule):** at least one slot per BONO run is FRESHLY generated, never reused, so new provocation always enters.
2. **Black hat is always re-derived (adversarial freshness):** the critical/risk hat is regenerated each run rather than reused, so the team never gets comfortable with its own past skepticism.
3. **Reuse cap:** at most K of N slots may be filled from the library per run (K < N). Logged; if the cap bites, `log()` what was reused vs generated (no silent ossification).

This keeps the compounding benefit (cheaper, sharper) without the cost (stagnation). It is the Part 2 team discipline applied to the team's own memory.

## 4. Cross-room expert library (DEFERRED - contract sketch only)

Phase 164 ships ROOM-LOCAL experts. A shared library across the navigator's rooms is a separate, navigator-gated amendment. Sketched here so it is ready:

- **Generic-lens projection:** promoting an expert to the cross-room library strips ALL venture specifics, keeping ONLY hat + domain + subdomain + method + beautiful_question + aggregate evidence_tier. The projection is a TOOL (a way of looking), never a record of any room's data.
- **Storage:** a LOCAL cross-room store keyed by the Phase 83 `.rooms/registry.json` (the same scope mechanism the cross-room contradiction aggregator uses) - NOT the Brain. (An expert is user-derived; even generic, it is LOCAL-derived, so it lives in the local cross-room store, not the methodology Brain. The Part 8 orchestration-projection amendment covers GENERIC MACHINERY, not user-derived experts.)
- **Gate:** per-expert navigator opt-in to promote; a derivation-time boundary scan proves the projected expert carries zero venture bytes (mirror the BRAIN.md 5-tripwire forbidden-substring sweep).
- **Why deferred:** it crosses room boundaries (Part 8 surface) and depends on the Phase 83 registry; it deserves its own gated phase, not a rider on 164.

## 5. Plan-phase checklist (this lifecycle)

- [ ] `SyntheticExpert` node type added under the Phase 108 schema/taxonomy discipline (aliases.yml + TRUTH-STATES).
- [ ] Ranking reader is a pure `navigation.cjs` graph walk (no Brain, no direct room.db).
- [ ] Freshness hash recorded on mint, checked on lookup.
- [ ] Anti-ossification guards (fresh lens + Black re-derive + reuse cap) enforced in team assembly, with `log()` on cap.
- [ ] Cross-room library explicitly OUT of scope; tracked as a deferred Part-8-gated amendment.

## 6. Phase 164 design package (index)

1. `164-CONTEXT.md` - phase contract, canon_parts, depends_on, surfaces, reuse boundary.
2. `2026-06-17-bono-research-debate-engine-scoping.md` (in `.planning/research/`) - the model, pipeline, substrates.
3. `164-GENESIS-TRANSLATION.md` - the external Genesis pattern re-expressed through the Mindrian pipeline (no new MCP); verified wiring file:line.
4. `164-SYNTHETIC-EXPERTS.md` - personas as reusable `SyntheticExpert` graph citizens, invokable as hats.
5. `164-EXPERT-LIFECYCLE.md` (this) - ranking, freshness, anti-ossification, cross-room sketch.

Design is plan-ready. Next: after Phase 163 lands the domain-graph-citizen substrate, open v1.14.0, then `/gsd-discuss-phase 164` (or `/gsd-plan-phase 164`).
