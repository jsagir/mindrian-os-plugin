# Synthetic Experts as Reusable Graph Citizens (Phase 164 design input)

- **Date:** 2026-06-17
- **Navigator insight (2026-06-17):** "Personas can be filed as experts to be utilized in the future. They become nodes as synthetic experts. They can also be invoked as a hat for BONO."
- **Canon parts:** 2 (team identity), 4 (typed graph data), 8/9 (locality + truth states), 7 (reuse).

## 0. The idea in one line

A persona that earns its keep in a debate is FILED as a `SyntheticExpert` graph node and RE-INVOKED as a hat in future BONO runs. The team stops being disposable; every run mints reusable expert capital.

## 1. What already exists (Part 7 baseline)

- `/mos:persona generate` already writes persistent persona `.md` files to `room/team/personas/` (six hat-colored lenses from room data).
- `agents/persona-analyst.md` reads those local `.md` files inline (serial, no Brain) and adopts each perspective.
- Canon Part 2 already defines the team member as `Hat (cognitive stance) + Name (main domain) + Surname (sub-domain) + Archetype`.

**The delta:** promote the persona from a flat `.md` file to a FIRST-CLASS TYPED NODE (`SyntheticExpert`) in `room.db`, so it is queryable, rankable, re-invokable, and slottable into a BONO hat role. The `.md` stays (ICM Layer 0 identity + human-readable body); the node is the navigable handle.

## 2. The `SyntheticExpert` node

Filed via the `navigation.cjs` chokepoint (Part 9). Carries GENERIC LENS metadata only (see Part 8 note below):

| Field | Example | Notes |
|---|---|---|
| `hat` | `Black` | de Bono cognitive stance |
| `name` | `Regulatory` | main domain (Engine 1) |
| `surname` | `IND` | sub-domain (Engine 1) |
| `archetype` | `Domain Expert` | fallback tag (7-role taxonomy) |
| `beautiful_question` | "Where does this break against physical reality?" | Canon Appendix E |
| `research_approach` | hat-scoped tool access + query lens | how this expert searches |
| `evidence_tier` | `Operational` | grade of its prior contributions (Part 5) |
| `invocation_count` / `last_used` | scalars | ranking inputs for re-use |
| `review_status` | `proposed -> confirmed` | human confirms an expert is worth keeping (Part 9 role 5) |
| `provenance` | originating run id + domain node ids | edge-traced, never fabricated |

**Node-type discipline:** `SyntheticExpert` is a NEW node type. Node types are governed by the Phase 108 frozen schema/taxonomy reconciliation (aliases.yml + TRUTH-STATES). Adding it follows the same navigator-gated additive discipline as an edge-type amendment - resolved in plan-phase, not invented at command level.

## 3. Filing flow (mint an expert)

After a BONO debate, high-value team members are offered for filing at the Decision Gate:

1. Rank the run's hats by contribution (evidence tier + how often their reading survived the debate).
2. Surface the top candidates at a Shape F gate: "File these as reusable synthetic experts?"
3. APPROVE -> `confirmNode(byUser)` promotes the `SyntheticExpert` from `proposed` to `confirmed` (Part 9 role 5; the human decides which experts are worth keeping).
4. REJECT(reason) / DEFER -> reason becomes graph data (Part 4). "Why not keep this expert" teaches the next ranking.
5. Write edges (frozen allow-list): `SyntheticExpert -AFFILIATED_WITH-> Subdomain`, `SyntheticExpert -STATES/SUPPORTS-> EvidenceClaim`, `SyntheticExpert -INSTANTIATES-> (hat role)`. A genuinely new edge (e.g. `STAFFED_AS`) is a canon amendment, never a command-level invention.

## 4. Re-invocation flow (use an expert as a hat)

Team assembly (Engine 2 BONO) queries the expert library FIRST, generates only the gaps:

1. For each needed `(hat, subdomain)` slot, `navigation` looks up a confirmed `SyntheticExpert` matching the subdomain + hat (ranked by evidence_tier + recency).
2. Hit -> slot the existing expert into the cell as its agent (it carries its research approach + beautiful question). Increment `invocation_count`.
3. Miss -> generate a fresh persona for that slot (current behavior), which then becomes a filing candidate at the end of the run.

This makes BONO progressively cheaper and sharper: the room (and eventually the navigator) accrues a roster of proven experts.

## 5. Part 8 / cross-room caveat (the load-bearing constraint)

- **Room-local first (default, safe):** the `SyntheticExpert` lives in this room's `room.db`. No boundary issue.
- **Cross-room / cross-session reuse (bigger move):** an expert reused in ANOTHER room MUST be a GENERIC lens - hat + domain + subdomain + method + beautiful question - with ZERO venture-specific content from its originating room. The expert is a TOOL (a way of looking), not a record of the first venture's data. Carrying the originating room's findings into another room via an expert node would be a Part 8 LOCAL->elsewhere leak.
- A shared/cross-room expert library is therefore a SEPARATE, navigator-gated decision (touches Part 8 + the Phase 83 cross-room registry). Phase 164 ships ROOM-LOCAL synthetic experts; cross-room promotion is a deferred amendment.
- Brain stays generic-methodology read-only throughout. An expert's domain/hat/framework handles MAY inform a Brain methodology query (generic); the expert's accumulated venture reasoning MAY NOT egress.

## 6. Why this strengthens the moat

This is the team layer of Canon Part 4 ("every choice is graph data") applied to the experts themselves: the team that argued your venture becomes a typed, reusable, human-confirmed asset. Combined with the (subdomain x hat) debate, the room compounds - it remembers not just what was decided, but WHO (which lens) decided it well, and offers them back next time.

## 7. Scope decision for plan-phase

Two ways to slot this:
- **(a) Fold into Phase 164** - the BONO engine both MINTS (files) and CONSUMES (re-invokes) synthetic experts as part of its pipeline. One phase.
- **(b) Split a sub-plan** - 164 ships the debate; the synthetic-expert persistence + re-invocation is its own plan within the phase (clean node-type amendment + library reader). Recommended if the node-type schema work is non-trivial.

Default recommendation: (b) as an internal plan boundary inside Phase 164, so the node-type amendment gets its own focused review, but it remains one phase.
