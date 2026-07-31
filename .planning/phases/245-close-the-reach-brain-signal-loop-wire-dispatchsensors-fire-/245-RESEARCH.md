# Phase 245: Close the reach/Brain signal loop - Research

**Researched:** 2026-07-31
**Domain:** In-repo signal fusion and ranking wiring (CJS, zero new dependencies)
**Confidence:** HIGH (every load-bearing claim verified by live source read or live execution against the working tree, branch `main`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Requirement 1 - Dial-ranking fusion mechanism**
- **D-01:** Sensor/`fire_skill` signal merges into the dial's ranking as a bounded additive, `reach_id`-keyed term inside `lib/workflow/reach-hedge-ranker.cjs` (the repo's own "ONE shared scored-selection layer," already blending the cortex D4 score with a registry signal over the same 6 frozen `reach_id`s, already importing `cortex-reach-adapter`). NOT RRF fusion - RRF discards the score magnitude the frozen 0.70/0.15 RECOMMENDED-marker gate is defined on, and the repo's own `f-selector-ranker.cjs` documents RRF's rank-1/rank-2 gap (~3.8% at k=25) as too flat for a 6-item bank. Keep RRF as the fallback if a future signal source is NOT `reach_id`-keyed.
- **D-02:** The fired-sensor signal is already available at the render callsite via `decision.decision_trace.context_assembly.facts[]` (`navigation-engine.cjs::buildContextAssembly`) - no new plumbing/DB/Brain call needed to wire this.
- **D-03:** `buildReachList` itself (`lib/hmi/dial-reach-orchestrator.cjs`) stays byte-unchanged - its purity tripwire (`tests/test-158-reach-orchestrator-pure.cjs`) and byte-stable snapshot (`tests/test-158-reach-byte-stable.cjs`) must keep passing. The fusion happens upstream, inside the hedge ranker, before scores reach that function.
- **D-04:** Lockstep hazard flagged for the planner: `scripts/intent-classifier.cjs:2048-2108` independently recomputes `buildReachList` for `reach_presented` telemetry and must receive the same fused scores, or logged "what was offered" diverges from what actually rendered.
- **D-05:** The nudge weight is a new tunable that can push a reach across the frozen 0.70 RECOMMENDED floor - the planner must define an explicit bound (or explicitly accept the crossing) rather than leave it unconstrained.
- **D-24 (navigator-confirmed mid-discussion, amends SPEC.md Req 1):** `resolveFireSkill` (`lib/core/navigation-engine.cjs:596-660`) has a strict precedence order - wicked escalation, then a fired sensor reach (step 2), THEN the Brain `pattern_matches` verb path (step 3, gated on `tierMode === 'mode_a' && weightApplied > 0`). A fired sensor reach returns early and the Brain branch never runs. Live observation this session: a sensor fired on essentially every turn, so Brain's own suggested verb would be starved almost always, even once Req 2 makes `BRAIN.md` fresh. Left as originally scoped, Req 1 would satisfy its own acceptance test (dial reacts to sensor signal) without actually satisfying the SPEC's Goal statement ("Brain-informed... dial items"). Navigator confirmed: Req 1's fusion in `reach-hedge-ranker.cjs` (D-01) must treat Brain's `pattern_matches` verb as a genuine third input into the blend, not merely whatever `fire_skill` happens to resolve to after sensor-precedence wins the race. Planner must design the actual blend shape (e.g., Brain-verb as an independent additive term keyed the same way as the sensor term, rather than only reachable through `fire_skill`'s single-winner slot).

**Requirement 2 - Brain re-derive trigger mechanism**
- **D-06:** This is a BUG FIX, not new build. The full trigger -> queue -> drain -> detached-spawn cascade already ships in v1.16.0-beta.1, hook-wired (`hooks/hooks.json` UserPromptSubmit), Part-8-key-allowlisted, and covered by 15+ existing tests.
- **D-07:** Root cause (live-reproduced by the research agent, not inferred): `scripts/brain-derivation-drain.cjs` lines ~149-158 captures `start = Date.now()` BEFORE `Q.drain()`'s lazy `require('./folder-memory.cjs')` (which pulls in `node:sqlite`). Cold-process measurement (matching how the hook actually runs - fresh node per turn): 191ms elapsed at the spawn loop vs. a 100ms `PARENT_BUDGET_MS`. The loop aborts after spawning zero children - but `Q.drain()` has ALREADY removed every dispatched entry from the queue on the way in. Every turn silently vacuums the queue and derives nothing.
- **D-08:** Fix shape: hoist the `require` above `start`, or budget per-spawn instead of loop-abort, AND make drain-removal contingent on an actual spawn happening (re-enqueue any un-spawned remainder) so a future slow turn degrades gracefully instead of silently losing work.
- **D-09:** Flip `commands/brain-derive.md`'s `connector.excluded: true` for the explicit-ask surface - the file's own reason string already names this as the intended fix ("INV-06 promotion candidate... excluded for now").
- **D-10:** Explicitly rejected: a new PostToolUse hook + new enqueue path (would duplicate the existing `post-write` -> `minto-debouncer` -> `vault-section-minto-generator` -> `tryEnqueueBrainDerivation` cascade that already does this - a real Part 7 violation, not demonstrated to be needed).
- **D-11 (navigator-confirmed this discussion):** `age_exceeded` (7-day `BRAIN_STALE_AGE_DAYS` default) is accepted as a legitimate third trigger alongside governing-thought-change and explicit-ask. SPEC.md Requirement 2's acceptance criterion needs rewording per the `<spec_lock>` note.

**Requirement 3 - hats sensor trigger condition**
- **D-12:** New sensor file `sensor-perspective-lock.cjs` (SENS-17), firing on `ctx.freshContradictions >= 2` -> `reach_id: 'hats'`, `posture: 'hold'`.
- **D-13:** The trigger condition is not invented - it's already written as doctrine at `skills/larry-personality/SKILL.md:383` ("CONTRADICTS edges, circular pattern, decision point, jargon spike" -> Six Thinking Hats), and `ctx.freshContradictions` is already computed and threaded onto `sensorCtx` at `navigation-engine.cjs:876` - near-zero new plumbing.
- **D-14:** The `>= 2` threshold (not `> 0`) is load-bearing and must ship with the sensor, not after: `SENS-08` (`sensor-memory-cortex.cjs:84`) already fires `cross_room` on `freshContradictions > 0`, so a hats sensor on the same field at `> 0` would double-fire on every contradiction. One fresh contradiction = memory-cortex bridge; two or more unresolved = perspective lock worth a hats rotation.
- **D-15:** Bonus finding to fix as part of this work: `commands/think-hats.md`, `commands/persona.md`, and `commands/bono.md` all currently declare `sensor_triggers: [SENS-05]` alongside `reach_id: hats` in their frontmatter - but SENS-05 is `sensor-jtbd-reweight.cjs`, which fires `context_block`, not `hats`. These registry declarations are currently false; SENS-17 is what makes them true. Update the frontmatter to point at SENS-17.
- **D-16:** Explicitly rejected: extending `sensor-circularity.cjs` (SENS-10) with a 5th cause. Keyword-only (FALLBACK tier) detection, breaks the audited zero-collision property, overloads a sensor whose header/tests explicitly encode "four causes, four exits."
- **D-17:** Flip-condition check (explicit, per SPEC's boundary note): confirmed NOT tripped. `lib/core/sensors/` holds 19 `.cjs` files today (17 sensor implementations + `sensor-types.cjs` shared contract + `hat-scoping-table.cjs` pure lookup). SENS-17 takes implementations 17 -> 18, against the dial-rethink research's named ~25-30 threshold - 7-13 files of headroom remain.

**Requirement 4 - context_block tie-break rule**
- **D-18 (corrects the room's own prior research):** The existing Hedge/MWU reranker (`lib/workflow/reach-hedge-ranker.cjs::rankFiredCandidates`) does NOT already solve this and is not "unwired" - it IS invoked at both call sites (`navigation-engine.cjs:1015`, `lib/mcp/tools/sensors.cjs:142`), and is structurally blind to same-`reach_id` collisions by construction: every scoring term (`d4For`, `canonicalRegistryRank`, `countPenalty`) is keyed on `reach_id`, not on the individual sensor. Live-tested with a synthetic 3-way collision, including weights skewed 0.99/0.01: output order was IDENTICAL, falling through to the stable sort's `a.index - b.index` (original `SENSOR_REGISTRY` file order) every time. Requirement 4 is genuine new work, not a Part 7 wiring win.
- **D-19:** Corrected collision count: 12 of 18 registered sensors can fire `context_block`, not 11 of 17 (the room's grep missed SENS-01 `sensorFirstMaterial`, which lives inline in `insight-sensors.cjs:613`). SENS-SPEC.md's Requirement 4 background text should be read with this correction; not required to edit the SPEC file itself since the requirement's substance (a real tie-break rule) is unchanged.
- **D-20:** Chosen mechanism: a doctrine-authored `SENS_PRIORITY` frozen ordered constant, consumed as the tie branch inside `rankFiredCandidates`'s comparator (the one shared selection layer both call sites already use - NOT a second selection brain inside `dispatchSensors`, which would violate R4/Canon Part 7).
- **D-21:** Prerequisite: `evidence.sensor_id` (e.g. `'SENS-11'`) must be stamped on all 12 colliding sensors before the priority key exists to sort on - a Part-8-safe one-line add per sensor (evidence already accepts string primitives).
- **D-22:** Enforcement: extend the existing `data/connector-registry.json` `sensor_index` + `scripts/build-connector-registry.cjs --check` machinery so a sensor shipped without a priority table entry fails the build closed, rather than silently degrading to file-registration order.
- **D-23:** Explicitly rejected: per-sensor `trigger_tier` as the primary tie signal. The shipped `classifyTriggerTier` classifier is turn-level, not sensor-level - a generic call returns the identical tier for every colliding sensor on the same turn, so it can't discriminate colliders without inventing per-sensor hand-authored tier constants that reduce to a coarser copy of the priority table anyway, at higher cost and with a second doctrine surface that can drift from the table. `trigger_tier` stays usable as a Req-1-adjacent cross-family fusion input (Phase 244's `orchestration-candidate-lift.cjs`), just not as this requirement's primary mechanism.

### Claude's Discretion

**Requirement 5 - Part 8 egress-guard scoping check.** No advisor-research area was run for Req 5 this discussion (not selected as a gray area - the navigator's 4 selections covered Req 1-4 only). Planner/researcher should treat Req 5 as open-investigation: root-cause the live observation from this session (a plain `brain_stats` call was intercepted by `part8-egress-guard-hook.cjs`'s leak-prevention card) against the guard's actual matcher logic, and determine correctly-conservative vs. over-firing per SPEC.md's stated acceptance criterion. No implementation direction is pre-decided here.

**Also at planner discretion (per CONTEXT.md `<specifics>`):** the dial's fusion weight bound (D-05) and the `BRAIN_STALE_AGE_DAYS` value to test against (D-11) are the two places where a planner-level number needs picking. Flagged as planning-stage decisions, not pre-picked.

### Deferred Ideas (OUT OF SCOPE)

**Semantic vocab-sourcing from canonical docs (navigator, raised mid-discussion, 2026-07-31).** Proposal: instead of each sensor hand-maintaining its own keyword/trigger vocabulary, derive "tripwire phrase" vocab systematically from the plugin's own already-written canonical sources - Brain, `SKILL.md` files, command frontmatter, MCP tool `.md` descriptions - and use the local room graph plus a probability/semantic-similarity ranking (rather than pure keyword match) to surface a few JTBD-aligned options.

This is a real, well-scoped idea, not vague "make it smarter" - and it would have caught, by construction, the exact registry-drift bug Req 3's research just found live (3 commands declaring `sensor_triggers: [SENS-05]` for `hats` when SENS-05 fires `context_block`, not `hats`). It also has real prior art in this repo: Phase 230 ("MindrianOS Skill Fleet Optimization") already derived four skill-description trigger-design principles (WHAT+WHEN, near-miss differentiation, roster-wide testing, held-out validation) - a direct precedent for canonical-doc-sourced trigger vocab, currently sitting as an open todo (`2026-07-17-ingest-skill-description-insight-to-brain.md`, blocked on Brain admin-key access).

**Why this is deferred, not folded into Phase 245:** the phase's 5 requirements are already SPEC-locked and this discussion's 4 areas are already decided. This proposal is broader than any single locked requirement - it is closer to "how does the whole sensor bank source its vocabulary," which is exactly the question the same-day `2026-07-31-dial-rethink-decoupled-from-sensor-bank.md` room research already investigated at length (Section 6): a full semantic/classifier rewrite was explicitly verdicted AGAINST, because the primitives it would need (`lib/core/eureka/embedding-classifier.cjs`, `embedding-spine.cjs`, `hybrid-retrieve.cjs`) already ship for a different feature, and the named flip conditions (a 3rd patch at this seam, or sensor count crossing ~25-30 files) are not currently met. The narrower "source vocab from canonical docs instead of hand-duplicating it" half of the navigator's proposal was NOT directly addressed by that verdict, though, and is a genuinely good candidate for its own future phase or seed.

**Recommended next step (not started):** file as a seed/phase proposal that explicitly scopes "vocab sourcing" separately from "ranking mechanism" (which Req 1 and Req 4 of this phase already handle).

**Reviewed todos (not folded):** `2026-07-17-ingest-skill-description-insight-to-brain.md` (brain-ingestion, match score 0.6) - reviewed via `todo.match-phase`, not folded.

**Also out of scope (from SPEC.md Boundaries):** full sensor-bank rewrite; live/synchronous Brain call in the per-turn hot path; reopening CLOSED Phase 244. Canon Part 8 (Brain egress boundary) held as a hard invariant regardless of the navigator's "everything's open" instruction.
</user_constraints>

<phase_requirements>
## Phase Requirements

`.planning/REQUIREMENTS.md` carries no per-requirement IDs for this phase. `245-SPEC.md`'s 5 numbered requirements are authoritative. Local IDs below (`R1`-`R5`) are research-side handles for cross-referencing within this document only.

| ID | Description (from SPEC.md) | Research Support |
|----|----------------------------|------------------|
| R1 | **Dial reflects sensor/Brain signal.** F.7 dial's top-ranked item changes when the turn's `fire_skill`/sensor signal changes; Brain's `pattern_matches` verb is a genuine third blend input, not gated behind sensor silence (D-24 amendment). | **F-1** (the hedge ranker is NOT upstream of `buildReachList` - D-01/D-03's stated mechanism cannot satisfy this requirement as written; corrected plug point supplied), **F-2** (the Brain verb is never computed when a sensor fires - new plumbing required), **F-7** (a derivable, precedent-grounded bound for D-05's nudge weight), **F-8** (verb -> `reach_id` inversion is many-to-one and undefined for 5 of 10 canonical verbs), Architecture Patterns 1-2, Code Examples 1-2 |
| R2 | **Brain-consult trigger policy.** `BRAIN.md` auto-re-derives on governing-thought change, `BRAIN_STALE_AGE_DAYS` age-out, or explicit ask; never a synchronous per-turn Brain call. | **F-6** (D-07's root cause independently re-reproduced, and refined: the overrun is *flaky*, not deterministic - which explains why 15+ existing tests never caught it), Pitfall 4, Code Example 3, Validation Architecture |
| R3 | **`hats` reach fires proactively.** At least one sensor independently produces `reach_id: 'hats'`. | D-12/D-13/D-14 all confirmed against live source; **F-9** (SENS-17 is free, `>= 2` double-fire hazard confirmed); Architecture Pattern 3; superpowers comparative assessment (Open Question 1) |
| R4 | **`context_block` tie-break.** A documented, code-enforced priority rule replaces file-registration order. | D-19's 12-of-18 count independently re-derived and confirmed; **F-3** (D-22's named enforcement home cannot do the job as-is - `sensor_index` is a *command-declaration* index missing 3 of the 12 colliders); Architecture Pattern 4 |
| R5 | **Part 8 egress-guard scoping check.** `brain_stats` either passes cleanly or its block is documented as intentional. | **F-4** (root cause found and reproduced end-to-end: terminal catch-all in `classify()`), **F-5** (the defect class is wider than `brain_stats` - `brain_schema` is equally blocked and `pws-brain.md`'s documented `brain_search` fallback is dead), Security Domain, Code Example 4 |
</phase_requirements>

## Summary

This is a **wiring and defect-repair phase, not a build phase** - the same shape as CLOSED Phase 244. Every primitive the five requirements need already ships. No new npm package, no new runtime, no new architecture. The work is: put one number where a consumer can read it (R1), un-break one budget accounting bug (R2), add one sensor file (R3), add one comparator branch plus a stamp (R4), and add one recognizer to a classifier (R5).

**The research found three material corrections to the locked decisions, all verified by direct source read rather than inferred.** They do not overturn the decisions' intent - each one leaves the chosen *home* intact - but each one means a plan written literally to the decision text would ship code that passes its own unit test and still fails its SPEC acceptance criterion. In order of severity:

1. **`reach-hedge-ranker.cjs` is not upstream of the dial.** D-01 places R1's fusion inside `rankFiredCandidates`; D-03 states "the fusion happens upstream, inside the hedge ranker, before scores reach that function [`buildReachList`]." Verified false. `rankFiredCandidates` and `buildReachList` are *sibling consumers* of the same `buildReachScoresFromCortex` output; neither feeds the other, and `rankFiredCandidates` never writes back to the `reachScores` map. A fusion confined to its internals reorders which fired sensor wins `fire_skill` (which is exactly right for R4) and changes the dial by nothing at all. This is the same disjointness the room research named in its own Section 4, one level finer.
2. **Brain's `pattern_matches` verb is not merely starved - it is never computed.** D-24 correctly diagnoses that sensor precedence beats the Brain branch in `resolveFireSkill`. What it does not say is that `extractTopCandidateVerb` is called *only* inside the unreached step (3), so on a sensor-fires turn the verb string does not exist anywhere downstream. R1's third blend input needs new plumbing (compute unconditionally, surface on the trace), not just a different blend shape.
3. **D-22's named enforcement home cannot enforce what R4 needs.** `data/connector-registry.json`'s `sensor_index` is built from *command frontmatter* `sensor_triggers`, not from `SENSOR_REGISTRY`. It has 13 keys; it is missing SENS-10, SENS-11, SENS-12 and SENS-16 - three of which are among the 12 `context_block` colliders R4 exists to order. A completeness gate built on it would silently exempt the exact sensors in scope.

**Requirement 5 was the one un-researched area, and it is now fully root-caused and reproduced.** `part8-egress-guard.cjs::classify()` has three positive recognizers (CONTENT-SET forbidden-pattern scan, typed MOVE-SET packet shape, free-form vocabulary match for `brain_ask`/`brain_query`) and one terminal catch-all that returns `ambiguous`. A contentless call carries nothing for any recognizer to match, so it falls through the catch-all, and the hook turns `ambiguous` + Brain-available into `exit 2` - a block. Reproduced live: `classify({}, {toolName: 'mcp__plugin_mos_mindrian-brain__brain_stats'})` returns `{verdict:'ambiguous', class:'unknown', reason:'neither proven move-set nor content hit'}`. The verdict is **over-firing, not correctly conservative**, and the strongest evidence is the guard's own inverted risk ordering: a free-form `brain_ask` carrying an actual user question is ALLOWED (vocabulary match), while a zero-argument `brain_stats` is BLOCKED. An empty payload is the single case where "cannot prove it is safe" and "provably has nothing to leak" coincide.

**Primary recommendation:** Sequence R1 and R4 together at `reach-hedge-ranker.cjs` as D-01/D-20 intend, but split R1's fusion into a *new exported pure function that produces a fused `reachScores` map*, merged at the render callsite (`scripts/intent-classifier.cjs`) using the shipped Phase 158-03 `Object.assign` precedent already sitting there - which preserves D-01's Part 7 "one shared selection layer" intent, preserves D-03's byte-unchanged `buildReachList` invariant exactly, and is the only shape that actually reaches the dial.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sensor firing (`dispatchSensors`) | Core engine (`lib/core/`) | - | Pure, sync, LOCAL-first chokepoint; Phase 144 fence forbids it calling `decide()` |
| Scored selection among fired candidates | Workflow (`lib/workflow/reach-hedge-ranker.cjs`) | - | The repo's declared "one shared scored-selection layer"; both R4's tie-break and R1's fusion math belong here (Canon Part 7) |
| Dial score composition (`reachScores` map) | Render callsite (`scripts/intent-classifier.cjs`) | Workflow (supplies the pure fusion fn) | The map is assembled at the callsite because `buildReachList` is contractually pure and receives only scalars; the Phase 158-03 reject-discount merge is the shipped precedent |
| Dial ranking + frozen 0.70/0.15 gate | HMI (`lib/hmi/dial-reach-orchestrator.cjs`) | - | Must stay byte-unchanged (D-03); purity tripwires `test-158-reach-orchestrator-pure.cjs` / `test-158-reach-byte-stable.cjs` |
| Brain re-derivation trigger + queue | Scripts (`scripts/brain-derivation-drain.cjs`) + Core (`lib/core/brain-derivation-queue.cjs`) | Hook (`hooks/hooks.json` UserPromptSubmit) | Already hook-wired; detached spawn keeps the Brain call out of the per-turn hot path (SPEC constraint) |
| Part 8 egress classification | Core (`lib/core/part8-egress-guard.cjs`) | Hook (`scripts/part8-egress-guard-hook.cjs`) | Classifier is pure + LOCAL + zero-network by contract (D-01 of Phase 196); the hook only translates verdict to exit code |
| Sensor -> command registry enforcement | Scripts (`scripts/build-connector-registry.cjs --check`) | Data (`data/connector-registry.json`) | Fail-closed build gate; see F-3 for why its current *input* is insufficient for R4 |

**Tier misassignment risk this map exists to prevent:** placing R1's fusion in the Workflow tier's `rankFiredCandidates` *output* (a reordered array) rather than in the Render tier's `reachScores` *input* (a scored map). The two tiers consume the same upstream data and produce different artifacts; only the second reaches the dial.

## Standard Stack

### Core

**No new libraries. Zero new dependencies.** This phase is entirely in-repo CJS wiring against modules that already ship.

| Module | Location | Purpose | Why Standard |
|--------|----------|---------|--------------|
| `reach-hedge-ranker.cjs` | `lib/workflow/` | The one shared scored-selection layer (Hedge/MWU over 2 experts, `reach_id`-keyed) | Repo's own declared single selection brain; D-01/D-20 both target it; Canon Part 7 forbids a second one `[VERIFIED: live source read, lib/workflow/reach-hedge-ranker.cjs:456-496]` |
| `cortex-reach-adapter.cjs` | `lib/hmi/` | Builds the `reachScores` map from cortex node presence/recency | The sole producer of dial priors today; its `CONTRIBUTIONS` table is the precedent for R1's nudge weights `[VERIFIED: lib/hmi/cortex-reach-adapter.cjs:85-105,194-258]` |
| `dial-reach-orchestrator.cjs` | `lib/hmi/` | `buildReachList` - the frozen F.7 dial (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15) | Must stay byte-unchanged (D-03); pure by contract `[VERIFIED: lib/hmi/dial-reach-orchestrator.cjs:116-117,306]` |
| `brain-derivation-queue.cjs` | `lib/core/` | Atomic tmp+fsync+rename queue, Part-8 key allowlist, section-keyed idempotency | Entire R2 mechanism already exists; this phase repairs one accounting defect `[VERIFIED: lib/core/brain-derivation-queue.cjs:289-406]` |
| `part8-egress-guard.cjs` | `lib/core/` | Pure LOCAL egress classifier, zero network | R5's fix site; 284 lines, 3 recognizers + 1 catch-all `[VERIFIED: live execution, see F-4]` |
| `sensor-types.cjs::makeReach` | `lib/core/sensors/` | Frozen candidate-reach factory; `evidence` accepts string/number/boolean primitives only | D-21's `sensor_id` stamp rides this with no schema change `[VERIFIED: lib/core/sensors/sensor-types.cjs:237-277]` |

### Supporting

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `lib/core/brain-md-staleness.cjs::computeBrainStaleness` | `BRAIN_STALE_AGE_DAYS` parsing (default 7; non-positive / unparseable falls back to 7 silently) | R2's `age_exceeded` trigger arm `[VERIFIED: lib/core/brain-md-staleness.cjs:46-79]` |
| `lib/workflow/reach-reject-reader.cjs::computeReachPenalties` | Produces `{discountedScores, suppressedReachIds}` merged into `reachScores` at the render callsite | **The shipped precedent R1 should mirror exactly** `[VERIFIED: scripts/intent-classifier.cjs:1284-1291]` |
| `lib/hmi/reach-relevance-gate.cjs::computeOffTopicReachIds` | Structural drop of off-topic reaches via `suppressedReachIds` | Already between `reachScores` assembly and `buildReachList`; shows the seam is an established extension point `[VERIFIED: scripts/intent-classifier.cjs:1307-1338]` |
| `scripts/build-connector-registry.cjs --check` | Fail-closed byte-compare build gate | R4's enforcement home - but see F-3 for the required input change |
| `lib/core/eureka/hybrid-retrieve.cjs::rrfFuse` | Generic RRF fusion | Explicitly the **fallback only** per D-01, if a future signal source is not `reach_id`-keyed. Do not use for R1. |
| `lib/core/eureka/embedding-classifier.cjs` + `embedding-spine.cjs` | Local nearest-neighbor semantic classifier over a curated exemplar set; max-cosine + confidence margin + `confident:false` escalation. **Fully local, zero egress, zero API spend** (Part 8 clean by its own header). | **Build-time** derivation of the verb -> `reach_id` affinity table (F-8 / Open Question 5). Never in the per-turn hot path. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Additive `reach_id`-keyed term (D-01) | RRF fusion (`hybrid-retrieve.cjs::rrfFuse`) | RRF discards score magnitude, which the frozen 0.70/0.15 marker gate is defined on. Rejected by D-01 with the repo's own documented rank-gap evidence. |
| New exported fusion fn in `reach-hedge-ranker.cjs` | Inline the fusion at `scripts/intent-classifier.cjs` | Would put selection math outside the one shared selection layer - a Canon Part 7 violation and a second selection brain. Keep the math in the ranker, call it from the callsite. |
| `SENS_PRIORITY` frozen constant (D-20) | Per-sensor `trigger_tier` | Rejected by D-23: the shipped classifier is turn-level, returns the identical tier for every collider on the same turn. |
| New `sensor-perspective-lock.cjs` (D-12) | 5th cause on `sensor-circularity.cjs` | Rejected by D-16: breaks the audited zero-collision property and the sensor's "four causes, four exits" contract. |

**Installation:** None. `node --version` must satisfy the repo's `>=22.16.0` floor (already enforced).

## Package Legitimacy Audit

**Not applicable - this phase installs zero external packages.**

Verified: no `package.json` change is required by any of the 5 requirements. All modules named in this research are in-repo CJS under `lib/`, `scripts/`, and `data/`. The repo's own convention is explicit on this point (`CLAUDE.md`: "CJS only, no TypeScript... no Commander or yargs"), and CLOSED Phase 244 - the direct predecessor at this seam - shipped with "zero `package.json` changes" as a verified stack constraint `[VERIFIED: .planning/STATE.md, Phase 244 closure entry]`.

**Packages removed due to slopcheck [SLOP] verdict:** none (none proposed).
**Packages flagged as suspicious [SUS]:** none (none proposed).

If the planner's design later introduces any external dependency, it must run the Package Legitimacy Gate before that plan is approved. Nothing in this research recommends one.

## Architecture Patterns

### System Architecture Diagram

The two paths and where each requirement lands. **The left and right columns below never meet today - that is the entire phase.**

```
                        UserPromptSubmit hook (fresh node process, per turn)
                                          |
                    +---------------------+---------------------+
                    |                                           |
        scripts/brain-derivation-drain.cjs          scripts/intent-classifier.cjs
                    |                                           |
             Q.drain(dryRun) --------[R2 BUG: budget            |
                    |                 consumed by module        |
                    |                 load; loop breaks at      |
                    |                 i=0, entries already      |
                    |                 removed -> silent loss]   |
                    |                                           |
             detached spawn                                     |
             --single <section>                                 |
                    |                                           |
             deriveSection -> BRAIN.md                          |
                                                                |
        +-------------------------------------------------------+
        |                                                       |
        v  PATH A: fire_skill (advisory, never rendered)         v  PATH B: the F.7 dial (what the navigator sees)
                                                                    
  lib/core/navigation-engine.cjs::decide()              scripts/intent-classifier.cjs:1274
        |                                                       |
  dispatchSensors(turn, tuple, ctx)                      buildReachScoresFromCortex(cortexNodes)
        |  18 sensors, SENSOR_REGISTRY order                    |  cortex node presence/recency ONLY
        |  12 can fire context_block  <---[R4]                  |  -> reachScores { reach_id: 0..1 }
        v                                                       v  :1288
  rankFiredCandidates(sensorReaches, {cortexNodes, db})   Object.assign(reachScores,
        |  reads reachScores READ-ONLY                          |    reachPenalties.discountedScores)
        |  scores on reach_id; blind to sensor identity         |  <-- Phase 158-03 SHIPPED PRECEDENT
        |  ties -> a.index - b.index (file order)               |  <== [R1 FUSION MERGES HERE]  (F-1)
        |  <---[R4 tie-break: SENS_PRIORITY comparator]         |
        v                                                       v  :1307
  resolveFireSkill(brain, weight, tierMode, sensorReaches)  computeOffTopicReachIds -> suppressedReachIds
        |  (1) wicked                                           |
        |  (2) sensorReaches[0] -> verb   <-- WINS ~every turn  v  :1341
        |  (3) Brain pattern_matches      <-- NEVER REACHED     buildReachList({tierMode, reachScores,
        |      extractTopCandidateVerb() never called (F-2)     |                suppressedReachIds})
        |      <---[R1/D-24: must compute unconditionally       |  FROZEN: MAX_K=3, DIAL_REACH_K=6,
        |           and surface on the trace]                   |          0.70 floor / 0.15 margin
        v                                                       |  MUST STAY BYTE-UNCHANGED (D-03)
  buildContextAssembly -> trace.context_assembly.facts[]        v
        |                                                  renderDial -> what the navigator picks from
        v                                                       |
  additionalContext (advisory text, "the LAST thing              +--> :2063 telemetry recompute
  Larry sees") -- NEVER RENDERED AS A CARD                            reach_presented  <---[R1/D-04 lockstep]


  PreToolUse hook, matcher mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*
        |
  scripts/part8-egress-guard-hook.cjs
        |
  part8-egress-guard.cjs::classify(toolInput, {toolName})
        |  1. CONTENT-SET forbidden-pattern scan -> block
        |  2. typed MOVE-SET packet shape        -> allow
        |  3. free-form vocab (brain_ask/query)  -> allow
        |  4. TERMINAL CATCH-ALL                 -> ambiguous  <---[R5: contentless {} lands here] (F-4)
        v
  ambiguous + brainAvailable() -> render F.1 gate -> exit 2 (BLOCK)
```

### Pattern 1: Merge a second signal into `reachScores` before `buildReachList` (R1 - THE key pattern)

**What:** Assemble the dial's score map at the render callsite by merging additional `reach_id`-keyed maps over the cortex baseline, then hand the composed map to the pure `buildReachList`.

**When to use:** Any time a new signal must influence what the navigator sees on the dial. This is the ONLY shape that reaches the dial.

**Why it is safe:** `buildReachList` is contractually pure and receives only `{tierMode, reachScores, suppressedReachIds}` - scalars and a set, never a db handle. Merging upstream changes its *input* without touching its code, so `test-158-reach-orchestrator-pure.cjs` and `test-158-reach-byte-stable.cjs` (D-03's tripwires) both stay green, and the frozen 0.70/0.15 gate applies to the fused scores exactly as it applies today.

**Shipped precedent (Phase 158-03), verbatim from `scripts/intent-classifier.cjs:1284-1291`:**

```javascript
// Source: scripts/intent-classifier.cjs:1284-1291 (live read 2026-07-31)
const reachPenalties = (ctx && ctx.reach_penalties && typeof ctx.reach_penalties === 'object')
  ? ctx.reach_penalties : null;
if (reachPenalties && reachPenalties.discountedScores
    && typeof reachPenalties.discountedScores === 'object') {
  Object.assign(reachScores, reachPenalties.discountedScores);
}
```

Note the discipline the precedent encodes and R1 must match: **absent signal is a byte-identical no-op.** When `reach_penalties` is missing or empty, `reachScores` is unchanged and the render is byte-identical. R1's fusion must have the same property so every existing dial test stays green.

### Pattern 2: Keep the selection math in the shared layer, call it from the callsite (R1, Canon Part 7)

**What:** `lib/workflow/reach-hedge-ranker.cjs` gains a NEW exported pure function that *produces* a fused `reach_id`-keyed nudge map. It does not change `rankFiredCandidates`'s return contract. The render callsite imports it and merges its output via Pattern 1.

**When to use:** Whenever D-01's "one shared scored-selection layer" intent must be honored but the consumer is a different tier from the existing function's consumer.

**Why not just extend `rankFiredCandidates`:** verified - it returns a reordered array of reach objects and never writes to the `reachScores` map. Its two callers (`navigation-engine.cjs:1015`, `lib/mcp/tools/sensors.cjs:142`) both consume the array. Nothing downstream of it reaches `buildReachList`.

**Why not inline the math at the callsite:** that would put scored selection outside the shared layer, minting the second selection brain Canon Part 7 and the connector-spine convention both forbid.

### Pattern 3: Sensor file shape (R3)

Every sensor in `lib/core/sensors/` follows one shape, which SENS-17 must match: read a scalar off `ctx` -> apply a threshold -> return `makeReach({reach_id, posture, dispatch, signal, evidence})` or `null`. A sensor that throws is treated as "did not fire" by `dispatchSensors`'s soft-fail loop, so it can never poison dispatch `[VERIFIED: lib/core/insight-sensors.cjs:776-791]`.

Registration is three edits: import in `insight-sensors.cjs`, append to `SENSOR_REGISTRY`, add to `module.exports`. Registry position determines today's tie-break order - which is exactly what R4 replaces, so **sequence R4's comparator before or with R3's registration** so SENS-17 does not inherit a position-dependent outcome that R4 then changes.

### Pattern 4: Fail-closed generated-registry enforcement (R4)

`scripts/build-connector-registry.cjs --check` regenerates `data/connector-registry.json` in memory and exits non-zero on any byte difference. This is the right *home* for D-22's completeness gate. See F-3 for the required input change.

### Anti-Patterns to Avoid

- **Fusing inside `rankFiredCandidates` and calling R1 done.** The unit test will pass (the fired list reorders) and the SPEC acceptance criterion will fail (the dial does not move). This is the single most likely way this phase ships a false success. Guard with a test that asserts on `buildReachList` output, not on `rankFiredCandidates` output.
- **Reading Brain's verb off `trace.fire_skill`.** On a sensor-fires turn that field holds the *sensor's* verb. `decision_grounding` will read `'context_block'` (or another reach_id), never `'brain_verb'`. Using it as the Brain input silently re-implements the starvation D-24 exists to fix.
- **Editing `data/connector-registry.json` by hand.** It is generated. Fix the command frontmatter (D-15) and rebuild; `--check` will fail closed on any hand edit.
- **Adding a second selection path inside `dispatchSensors`** for R4 (explicitly rejected by D-20; violates the connector-spine "no second selection brain" rule in CLAUDE.md).
- **Loosening the Part 8 catch-all to `allow` for R5.** The catch-all is correct for unrecognized payloads *that contain something*. The fix is a new positive recognizer for the provably-empty case, not a weakened default.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Merging a signal into dial scores | A new score-composition module | `Object.assign` over `reachScores` at `intent-classifier.cjs:1288` | The Phase 158-03 reject-discount fold is the shipped, tested precedent at the exact same seam |
| Scored selection among reaches | A new ranker | `lib/workflow/reach-hedge-ranker.cjs` | Repo's declared one shared selection layer; a second one is a Canon Part 7 violation |
| Rank fusion (if ever needed) | A new RRF implementation | `lib/core/eureka/hybrid-retrieve.cjs::rrfFuse` | Already ships, generic. (D-01 rejects RRF for R1 specifically - but if a future non-`reach_id`-keyed source appears, reuse this, do not rebuild it.) |
| Brain re-derivation trigger/queue | A new PostToolUse hook + enqueue path | The existing `post-write` -> `minto-debouncer` -> `vault-section-minto-generator` -> `tryEnqueueBrainDerivation` cascade | D-10: explicitly rejected as a real Part 7 violation. R2 is a one-defect repair inside machinery that already works. |
| Staleness / age computation | A new date-diff | `lib/core/brain-md-staleness.cjs::computeBrainStaleness` | Already parses `BRAIN_STALE_AGE_DAYS` with documented fallback semantics |
| Candidate-reach construction | A literal object | `sensor-types.cjs::makeReach` | Enforces the frozen `REACH_IDS`/`POSTURE_IDS` vocabulary and strips non-primitives from `evidence` - the Part 8 sweep depends on it |
| Sensor-to-command index | A hand-maintained map | `scripts/build-connector-registry.cjs` generation from frontmatter | Hand maps drift; D-15 found three commands already carrying a false declaration |

**Key insight:** Every one of the five requirements has its primitive already in the tree. The failure mode this phase must avoid is not "we lacked a library" - it is "we wired the right primitive to the wrong consumer." That is precisely what F-1, F-2 and F-3 each found, in three independent places.

## Runtime State Inventory

Included because R2's defect has been actively destroying runtime state, and R4's enforcement target is a generated artifact. Not a rename phase, so the categories are scoped to what genuinely applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `<roomDir>/.mindrian/` brain-derivation queue files. Every UserPromptSubmit since v1.16.0-beta.1 has had its dispatched entries removed by `Q.drain()` with zero children spawned (F-6). The lost enqueues are **not recoverable** - the governing-thought hashes they carried are gone. | Code fix only (D-08). No data migration is possible or needed: the enqueue is re-derivable. After the fix, the next governing-thought change or the `age_exceeded` arm re-enqueues naturally. **Recommend the planner add a one-time forced `--all` derive** for the navigator's active rooms so they do not wait for the next natural trigger. |
| **Live service config** | None. No external service holds phase-relevant config. Brain is consumed read-only through the MCP door; Canon Part 8 forbids writing user-specific state to it. Verified by grep: no phase-relevant surface outside the repo. | None. |
| **OS-registered state** | None. Hooks are registered declaratively in `hooks/hooks.json` (in-repo, git-tracked). No Task Scheduler / launchd / pm2 registration touches this phase. Verified: the drain is a `UserPromptSubmit` hook entry, not an OS job. | None. |
| **Secrets / env vars** | `BRAIN_STALE_AGE_DAYS` (read at `brain-md-staleness.cjs:79`, default 7, non-positive or unparseable silently falls back to 7). No key rename. R1's nudge weight and R4's priority table should follow the repo's `docs/ENV-TUNING.md` convention if made tunable. | Document any new env var in `docs/ENV-TUNING.md` (the convention Phase 244-08 followed). No secret changes. |
| **Build artifacts** | `data/connector-registry.json` is **generated** and git-tracked. D-15's frontmatter fix (3 commands, SENS-05 -> SENS-17) changes its `sensor_index` on the next build. `scripts/build-connector-registry.cjs --check` fails closed on any drift. | Run `node scripts/build-connector-registry.cjs` (regenerate) after the frontmatter edits, commit the regenerated JSON, then `--check` to prove clean. Do not hand-edit. |

## Common Pitfalls

### Pitfall 1: Shipping R1 into the wrong consumer (HIGHEST RISK)

**What goes wrong:** The fusion lands inside `rankFiredCandidates`' local `combined` computation. Every new unit test passes. The dial does not change, and SPEC acceptance criterion 1 fails at verification.
**Why it happens:** D-01 and D-03's wording states the hedge ranker is upstream of `buildReachList`. Verified false (F-1). The claim is superficially plausible because the ranker *does* import `cortex-reach-adapter` and *does* score over the same 6 frozen `reach_id`s - it just consumes the map read-only and returns an array.
**How to avoid:** Write the R1 regression test against `buildReachList`'s output (or the rendered dial), never against `rankFiredCandidates`'s output. If the test can pass without `scripts/intent-classifier.cjs` being touched, it is testing the wrong thing.
**Warning signs:** A plan whose R1 task list contains no edit to `scripts/intent-classifier.cjs`.

### Pitfall 2: Sourcing the Brain verb from the trace

**What goes wrong:** The Brain-verb term reads `trace.fire_skill` or `decision_grounding`, gets the *sensor's* verb on every sensor-fires turn, and the "Brain-informed" acceptance criterion silently measures the sensor twice.
**Why it happens:** `extractTopCandidateVerb(pm.body)` is called at exactly one place - `resolveFireSkill` step (3) - which is unreachable when step (2) returns early (F-2). The value does not exist downstream.
**How to avoid:** Compute the Brain verb unconditionally (outside `resolveFireSkill`'s precedence chain) and surface it on the decision trace as its own field. Then verify with a test that constructs a turn where a sensor fires AND `pattern_matches` has a parseable verb, and asserts both influence the ranking - which is exactly what SPEC acceptance criterion 2 demands as "a second, distinct regression test from the first."
**Warning signs:** `extractTopCandidateVerb` still has exactly one caller after the change.

### Pitfall 3: Building R4's completeness gate on `sensor_index` as-is

**What goes wrong:** The build gate passes while SENS-10, SENS-11, SENS-12 and SENS-16 ship with no priority entry, silently degrading to file order - the exact behavior R4 exists to eliminate.
**Why it happens:** `sensor_index` is derived from command frontmatter `sensor_triggers`, not from `SENSOR_REGISTRY` (F-3). It has 13 keys and includes IDs (SENS-02, SENS-03, SENS-07) that do not correspond to registered sensor implementations, while omitting four that do.
**How to avoid:** Enumerate the sensor side. Either add a sensor-implementation index generated from `SENSOR_REGISTRY` / the `lib/core/sensors/` directory, or assert the priority table's key set equals `SENSOR_REGISTRY`'s stamped `sensor_id` set directly in a test. The `--check` script is still the right home; it needs a second, sensor-side input.
**Warning signs:** A plan that says "add SENS-17 to `sensor_index`" without adding a sensor-side enumeration.

### Pitfall 4: Treating R2's budget overrun as deterministic

**What goes wrong:** A fix is validated by an in-process test that always completes in <100ms, ships, and the defect recurs on cold, cache-cold, or loaded machines.
**Why it happens:** Independently re-measured across three cold `node` processes on this machine against a *nonexistent* room (the fastest possible path, nothing to read, nothing to spawn): **162ms, 96ms, 145ms** elapsed at the point the spawn loop begins, against `PARENT_BUDGET_MS = 100`. Note run 2 came in *under* budget. The bug is **flaky, not deterministic** - and that flakiness is very likely why 15+ existing tests never caught it, since tests run warm and in-process where the `require` cost is already paid.
**How to avoid:** Implement both halves of D-08, not just the first. Hoisting the `require` above `start` removes today's dominant cost but leaves the same failure shape one slow turn away. The second half - **make queue removal contingent on an actual spawn, re-enqueueing any un-spawned remainder** - is what converts a silent total loss into graceful degradation. Test it by forcing `PARENT_BUDGET_MS` to 0 and asserting the queue still holds its entries afterward.
**Warning signs:** A fix that only moves the `require` statement.

### Pitfall 5: Crossing the frozen 0.70 RECOMMENDED floor by accident

**What goes wrong:** The new nudge stacks additively onto existing `context_block` contributions, the clamped total crosses 0.70, and a reach starts rendering a RECOMMENDED marker it never earned - changing product behavior the SPEC did not authorize.
**Why it happens:** `buildReachScoresFromCortex` accumulates additively and clamps at 1.0. `context_block` already receives up to `governing_thought_fresh` (0.30) + `claim_present`; two new 0.30-class terms take its ceiling to 1.0.
**How to avoid:** See F-7. The existing `CONTRIBUTIONS` table encodes an explicit house invariant - **no single signal solo-crosses 0.70** - documented in its own comments ("stays below the 0.70 recommend gate, so a single signal escalates the one-move but never solo-crosses the marker floor"). Derive the bound from it rather than picking a number. Critically: **R1's acceptance criterion asks for the top-ranked item to CHANGE, which is reordering, not floor-crossing.** Reordering is fully achievable below 0.70. Recommend bounding the combined new (sensor + Brain-verb) contribution so the maximum stacked total on any reach stays under 0.70, and adding a test that asserts the invariant directly.
**Warning signs:** A plan that picks a nudge weight without stating the resulting per-reach maximum.

### Pitfall 6: Fixing R5 by weakening the catch-all

**What goes wrong:** `classify()`'s terminal `ambiguous` is changed to `allow`, or `_isFreeFormTool` is broadened, and genuine content starts crossing the Part 8 boundary. This is a constitutional breach, not a bug.
**Why it happens:** The symptom (a false block) invites relaxing the default.
**How to avoid:** Add a *positive recognizer* for the provably-contentless case ahead of the catch-all, leaving the catch-all's fail-closed posture untouched. See Code Example 4 and the Security Domain section.
**Warning signs:** A diff that touches the `return { verdict: 'ambiguous', ... }` at the end of `classify()`.

### Pitfall 7: Telemetry/render divergence (D-04, worse than stated)

**What goes wrong:** `reach_presented` telemetry logs a different offered set than the navigator actually saw.
**Why it happens:** Verified - the telemetry recompute at `scripts/intent-classifier.cjs:2063-2066` calls `buildReachList({tierMode, reachScores})` with **only** those two keys. It already omits the Phase 158-03 `discountedScores` merge, the `suppressedReachIds` set, and the relevance gate that the live render at :1341 applies. **D-04's divergence hazard is not introduced by this phase - it already exists today.** R1 will widen it.
**How to avoid:** Treat closing the pre-existing divergence as part of R1's scope, or explicitly document it as accepted and out of scope. Do not leave it unnamed.
**Warning signs:** A plan that adds the fusion at :1288 only.

## Code Examples

### Example 1: The R1 fusion merge (the corrected plug point)

```javascript
// Site: scripts/intent-classifier.cjs, between :1274 and :1341
// Mirrors the Phase 158-03 precedent already at :1288 exactly.

const reachScores = adapter.buildReachScoresFromCortex(cortexNodes);   // existing :1274

// existing :1284-1291 reject-discount fold (unchanged)
if (reachPenalties && reachPenalties.discountedScores) {
  Object.assign(reachScores, reachPenalties.discountedScores);
}

// NEW (R1): fused sensor + Brain-verb nudges, produced by the shared
// selection layer, keyed on reach_id, bounded per F-7. Absent signal
// MUST yield an empty map so the render stays byte-identical.
try {
  const ranker = require(path.join(__dirname, '..', 'lib', 'workflow', 'reach-hedge-ranker.cjs'));
  const nudges = ranker.buildSignalNudges({
    baseScores: reachScores,
    sensorReaches: firedReaches,      // from trace.context_assembly.facts[] per D-02
    brainVerb: brainPatternMatchVerb, // NEW plumbing per F-2
  });
  if (nudges && typeof nudges === 'object') {
    for (const reachId of Object.keys(nudges)) {
      const base = typeof reachScores[reachId] === 'number' ? reachScores[reachId] : 0;
      reachScores[reachId] = Math.min(1, base + nudges[reachId]);  // bound per F-7
    }
  }
} catch (_e) {
  // soft-fail: an unfused render is the existing, correct behavior
}
```

Function name `buildSignalNudges` is illustrative; the planner picks the name. The load-bearing properties are: (a) the math lives in `reach-hedge-ranker.cjs`, (b) the merge happens before `buildReachList`, (c) absent signal is a byte-identical no-op, (d) a throw degrades to today's behavior.

### Example 2: The verb -> reach_id inversion problem (R1 / D-24)

```javascript
// Source: lib/core/navigation-engine.cjs:432-440 (live read 2026-07-31)
function reachIdToSkillFamily(reachId) {
  switch (reachId) {
    case 'context_block': return 'Run Methodology';
    case 'contradiction': return "Devil's Advocate";
    case 'cross_room':    return 'Navigate Graph';
    case 'brain_consult': return 'Run Methodology';   // <-- collides with context_block
    case 'deep_research': return 'Spawn Sub-Agent';
    case 'hats':          return 'Synthesize';
    default: return null;
  }
}
```

Inverting this to key a Brain verb onto a `reach_id` is **not a clean bijection** (F-8):
- 4 verbs invert uniquely (`Devil's Advocate` -> `contradiction`, `Navigate Graph` -> `cross_room`, `Spawn Sub-Agent` -> `deep_research`, `Synthesize` -> `hats`).
- `'Run Methodology'` inverts to **two** reach_ids (`context_block`, `brain_consult`) - ambiguous.
- **5 of the 10 frozen `CANONICAL_VERBS`** (`Reformulate`, `Scenario Plan`, `Bank Opportunity`, `Defer`, `Free-Text`) have **no** reach_id preimage at all `[VERIFIED: lib/core/navigation-engine-shared.cjs:65-76]`.

The planner must define behavior for both cases explicitly. Minting new reach_ids to close the gap would move the frozen Phase-148 6-reach set - a canon change the SPEC permits but Part 7 minimality argues hard against.

**Recommended (revised - see Open Question 5): derive the affinity semantically at BUILD time, freeze the result as a constant.** Hand-authoring the inversion re-creates the same hand-maintained-table brittleness that produced D-15's drift. The repo already ships the exact primitive for this, and it needs no Brain call - see below.

### Example 2b: The local semantic leg for the inversion (navigator's suggestion, assessed)

`lib/core/eureka/embedding-classifier.cjs` is a shipped, **fully local, zero-egress, zero-API-spend** nearest-neighbor semantic classifier: it embeds a candidate with the local encoder (`embedding-spine.cjs`), scores max-cosine against curated exemplar sets, and returns `confident: false` rather than forcing a low-margin verdict `[VERIFIED: lib/core/eureka/embedding-classifier.cjs:1-45,217-226]`. Its own header states the scale it was built for - "a ~40-term in-memory reference set" - which is exactly the scale of the verb -> reach_id problem (10 verbs x 6 reaches).

```javascript
// Build-time derivation (a script, NOT the hot path). Reuses the shipped
// classifier's exact shape: local encoder, max-cosine vs. exemplars, and a
// confidence margin below which the answer is "no mapping" rather than a guess.
//
//   for each verb of CANONICAL_VERBS (10):
//     score cosine(verb, exemplars(reach_id)) for each of the 6 reach_ids
//     winner = argmax; margin = top1 - top2
//     margin < DEFAULT_MARGIN -> emit null (documented no-op for that verb)
//     'Run Methodology' ties context_block/brain_consult -> emit BOTH, split the nudge
//
// Output: a frozen VERB_REACH_AFFINITY constant committed to the repo.
// Runtime cost: zero. Network calls: zero. Deterministic: yes.
```

**Why this shape and not a runtime Pinecone/`brain_search` call** - four independent blockers, each sufficient on its own:

1. **SPEC hard constraint.** "No requirement may introduce a synchronous/blocking Brain network call into the per-turn request path." The inversion happens at the render callsite, in the hot path. `brain_search` is a network call.
2. **Quota.** `brain-client.cjs:429-439` surfaces a real `pinecone_quota_exhausted` error with a documented monthly embedding quota and a Neo4j Cypher fallback. A dial whose ranking silently changes shape when the month's quota runs out is worse than a deterministic table.
3. **It is currently unreachable anyway.** Per F-5, `brain_search` is not in `_isFreeFormTool` and therefore always falls to the Part 8 catch-all and blocks. The Pinecone leg cannot be called from the plugin runtime today at all until R5 is resolved.
4. **Wrong corpus.** `pws-brain`'s namespaces hold the generic teaching/methodology corpus. It has no vectors describing what the six frozen `reach_id`s mean; the exemplars for that live in this repo (`reachIdToSkillFamily`'s own doc comment, `dial-reach-orchestrator.cjs`'s `REACH_DEFS`, `skills/larry-personality/SKILL.md`).

**Net:** the navigator's instinct is right that this is a semantic problem rather than a switch-statement problem, and acting on it removes F-8's 5-of-10 coverage hole and gives the ambiguous `'Run Methodology'` a principled split instead of an arbitrary one. The correct leg is the **local** encoder at **build** time, not Pinecone at runtime - which is also the Canon Part 7 answer (reuse a shipped primitive) and keeps R4's "reproducibly across runs" acceptance criterion intact, since a frozen constant is deterministic by construction.

### Example 3: The R2 defect, exactly as it stands

```javascript
// Source: scripts/brain-derivation-drain.cjs:149-158 (live read 2026-07-31)
const start = Date.now();                       // <-- clock starts BEFORE the load
const result = await Q.drain(roomDir, {         // <-- lazily requires folder-memory
  maxEntries: opts.maxEntries,                  //     -> node:sqlite; ~90-160ms cold
  dryRun: true,
});
if (Array.isArray(result.dispatched)) {
  for (const item of result.dispatched) {
    if (Date.now() - start > PARENT_BUDGET_MS) break;   // PARENT_BUDGET_MS = 100
    // ... detached spawn ...
```

And the removal that has already happened by then:

```javascript
// Source: lib/core/brain-derivation-queue.cjs:392-398 (live read 2026-07-31)
// Dispatch deriveSection. In dryRun, just record. The real script ...
result.dispatched.push({ section: entry.section, hash: entry.new_governing_thought_hash });
// Drained entry is removed from queue (do NOT push to remaining).
```

The `break` is evaluated **before the first spawn**, so zero children are spawned, while every dispatched entry is already gone from the queue. Both halves of D-08 are needed; see Pitfall 4.

### Example 4: The R5 root cause and the recommended fix shape

Reproduced live (`node -e` against the working tree, 2026-07-31):

```
brain_stats  {}                -> {"verdict":"ambiguous","class":"unknown","reason":"neither proven move-set nor content hit"}
brain_stats  undefined         -> {"verdict":"ambiguous","class":"unknown","reason":"non-object payload"}
brain_schema {}                -> {"verdict":"ambiguous","class":"unknown","reason":"neither proven move-set nor content hit"}
brain_ask    {question:"lean startup methodology"} -> {"verdict":"allow","class":"move_set","reason":"generic methodology vocabulary handle"}
```

`brain-client.cjs:575` calls `callTool('brain_stats', {})` and `:488` calls `callTool('brain_schema', {})` - both literal empty objects. The hook's matcher (`hooks/hooks.json:236`) is `mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*`, which matches both. `ambiguous` + `brainAvailable()` -> `block()` -> `exit 2`. Chain closed.

Recommended fix - a **new positive recognizer inserted after the CONTENT-SET scan and before the catch-all**, leaving the catch-all's fail-closed posture untouched:

```javascript
// lib/core/part8-egress-guard.cjs::classify, after the scanForContent step.
// An empty payload is the ONE case where "cannot prove it is safe" and
// "provably has nothing to leak" coincide: zero bytes cannot carry user
// content. This is a positive proof of emptiness, NOT a relaxed default.
if (payload && typeof payload === 'object' && !Array.isArray(payload)
    && Object.keys(payload).length === 0) {
  return { verdict: 'allow', class: 'empty_payload', reason: 'zero-key payload carries no bytes' };
}
```

The `undefined` / `null` case currently returns `ambiguous` with reason `'non-object payload'` at the top of `classify()`. The planner should decide whether an absent `tool_input` is also provably empty (it is, for a nullary tool) or whether it signals a malformed hook envelope that should stay fail-closed. **Recommend: keep `null`/`undefined` fail-closed** - a missing envelope field is a different claim from an explicitly empty object, and the shipped callers all pass `{}` explicitly, so nothing needs the looser branch.

**Defense-in-depth option** (planner's call, higher assurance, slightly more maintenance): require BOTH zero keys AND membership in a declared contentless-tool allowlist. This survives a future version of `brain_stats` that gains parameters. The cost is one more list to keep in step with the Brain server's tool surface.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sensorReaches[0]` read directly (registry order = winner) | Hedge/MWU reranker over the fired subset | Phase 222-02 | The ranker exists and is live at both call sites - but is blind to same-`reach_id` collisions, which is why R4 is genuine new work (D-18) |
| `trigger_tier` computed, consumed by nothing | Consumed by `orchestration-candidate-lift.cjs::buildTierCandidates` | Phase 244 (CLOSED 2026-07-30) | Live production consumer confirmed by the Phase 244 verifier; D-23 keeps it as a cross-family fusion input, not R4's mechanism |
| Reaches never lexically relevance-gated | SENS-16 content-relevance (FTS5+bm25) + RRF cross-family fusion + MMR diversity | Phase 244 (CLOSED) | SENS-16 is the 18th registered sensor and one of the 12 `context_block` colliders - R4 must cover it |
| `mcp__brain_*` prefix matcher | `mcp__(?:plugin_[a-z0-9_-]+_)?mindrian-brain__.*`, single exported authority | Phase 239 (BRAIN-01) | The R5 hook's scoping is current and correct; the defect is downstream in the classifier, not in the matcher |
| Dial scored by cortex recency only | Still true today | - | This is exactly what R1 changes; no intermediate state exists |

**Deprecated / outdated in the upstream research this phase builds on:**
- The room research's "11 of 17 sensors" collision count: superseded by D-19's **12 of 18** - independently re-derived and confirmed here (11 files under `lib/core/sensors/` plus `sensorFirstMaterial` inline in `insight-sensors.cjs`; `sensor-types.cjs` is the shared contract, not a sensor).
- The room research's implication that the Hedge reranker was "unwired": superseded by D-18 - it is wired at both call sites, and structurally blind to the collision rather than absent.
- **New this pass:** D-01/D-03's "the hedge ranker is upstream of `buildReachList`" and D-22's "extend `sensor_index`" both need the corrections in F-1 and F-3 respectively.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The live session's `brain_stats` interception was produced by the `classify()` catch-all path reproduced here, rather than by a different failure (e.g. a hook timeout at 2000ms) | R5 / F-4 | LOW. The classify verdict is reproduced deterministically and the hook's `ambiguous` -> `exit 2` translation is a direct source read; a timeout would not render the leak-prevention card. If the planner can capture the actual stderr text from a live block, it confirms which branch fired (gate text vs. the minimal notice). |
| A2 | `PARENT_BUDGET_MS = 100` is intentional rather than itself a defect | R2 / Pitfall 4 | LOW-MEDIUM. If the budget is simply too tight, D-08's fix is still correct but the value may also want raising. No design doc for the 100ms figure was located this pass. |
| A3 | R1's nudge should bound below 0.70 rather than deliberately cross it | F-7 / Pitfall 5 | MEDIUM. D-05 explicitly leaves "or explicitly accept the crossing" open. The recommendation to bound is derived from the existing `CONTRIBUTIONS` house invariant and from the observation that reordering does not require crossing - but the navigator may WANT a strong sensor signal to earn a RECOMMENDED marker. **Worth confirming with the navigator before planning locks it.** |
| A4 | Splitting the ambiguous `'Run Methodology'` nudge across both `context_block` and `brain_consult` is preferable to no-oping it | Code Example 2 | LOW. Either is defensible; both are documented. Largely superseded by Open Question 5's semantic derivation, which resolves the split on evidence rather than by choice. |
| A7 | The local encoder (`embedding-spine.cjs`) is available and its model weights are cached on the machines where a build-time derivation would run | Example 2b / OQ-5 | MEDIUM. The classifier's own header notes a one-time generic model-weight download by model id (Part-8 clean, no user text). Not verified on a cold CI machine this session. **Mitigation is cheap:** commit the derived table as a frozen constant so the encoder is a one-time authoring dependency, not a build-gate dependency. |
| A8 | A build-time semantic derivation of one 10x6 table stays inside Phase 245's scope rather than becoming the DEFERRED vocab-sourcing phase | OQ-5 | MEDIUM. Bounded by construction (one table, no sensor vocabulary touched), but scope creep here is a realistic risk. The plan should state the boundary explicitly. **Worth a navigator confirmation.** |
| A5 | Re-enqueueing an un-spawned remainder (D-08 half two) will not cause unbounded queue growth on a persistently slow machine | Pitfall 4 | LOW-MEDIUM. The queue is section-keyed and idempotent, so duplicates collapse - but a plan should assert this rather than assume it. |
| A6 | The `hats` frontmatter fix (D-15) fully repairs `sensor_index` via regeneration, with no hand edit needed | Runtime State Inventory | LOW. `sensor_index` is verified generated from `sensor_triggers` frontmatter (`build-connector-registry.cjs:566,596`). |

## Open Questions

### 1. Does the superpowers 1% rule change how SENS-17 (R3) should be designed?

**Honest verdict: no for Req 3, yes for the deferred vocab-sourcing idea. Both halves are real; neither should be forced.**

**What was verified, not assumed.** The plugin is genuinely installed and active in this environment (`~/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/`), and the rule is literal, at `skills/using-superpowers/SKILL.md:11`: *"If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill."* It is accompanied by a 12-row "Red Flags" table enumerating rationalizations that mean STOP `[VERIFIED: live file read]`.

**Why it does not transfer to Req 3.** Having read the source rather than the description, I would sharpen the framing the navigator was given. The external research called this "the closest verified analog to context-driven invocation *as a formal mechanism*." It is not a mechanism in the engineering sense at all - there is no classifier, no scoring, no state machine, no threshold. It is an imperative instruction plus an anti-rationalization checklist. It works because **the model is the classifier**, at inference time, with the whole conversation in context.

MindrianOS cannot make the model the classifier at this seam, for three independent and each-sufficient reasons:

1. **Wrong process, wrong time.** `dispatchSensors` runs in a fresh `node` hook process *before* the model's turn, under a documented 1200ms navigation budget. There is no model in the loop to consult.
2. **No return path into a number.** R1's entire problem is that `buildReachList` needs a `0..1` score per `reach_id` to rank. "The model decided to read a file" produces no number. The superpowers pattern cannot supply R1's missing input even in principle, and R3 exists only so `hats` can *have* a score.
3. **Determinism is a locked acceptance criterion.** R4's SPEC criterion reads "reproducibly across runs, independent of file load order." An LLM-judgment trigger is non-reproducible by construction. R3 and R4 ship in the same phase; one requirement's mechanism would violate the other's acceptance test.

There is also a cost asymmetry that is easy to miss. A superpowers false positive costs one file read. A MindrianOS false positive costs a **navigator interruption** - and Canon Part 12 measures Larry by how *invisible* he is. A 1%-threshold posture is close to the opposite of Part 12's default. That is a doctrine conflict, not a taste difference.

**Where it genuinely does transfer - and this is the half worth keeping.** superpowers' `description:` frontmatter field IS the deferred vocab-sourcing idea in production: the skill's trigger vocabulary lives in one line of frontmatter, authored next to the thing it triggers, and the harness surfaces exactly that line as the trigger surface. One source of truth, never duplicated into a separate keyword bank.

MindrianOS already has the identical field shape - `commands/*.md` frontmatter carries `sensor_triggers` + `reach_id` - and this research pass proved it has drifted twice over: D-15's three commands falsely declaring SENS-05 for `hats`, and F-3's `sensor_index` missing four real sensors because it only ever looked at the command side. So superpowers is a live existence proof that the deferred idea's *architecture* works. That is a real, specific transfer, and it strengthens the case for the deferred item's own phase - it does not change a line of SENS-17.

**Recommendation:** no change to R3's design. Record the frontmatter-as-single-source observation in the deferred seed when it is filed.

### 2. Should the pre-existing telemetry/render divergence be closed in this phase?

- **What we know:** the `reach_presented` recompute at `intent-classifier.cjs:2063-2066` already omits the reject-discount merge, `suppressedReachIds`, and the relevance gate that the live render applies. This divergence predates Phase 245.
- **What is unclear:** whether closing it is in scope. D-04 names the hazard prospectively ("must receive the same fused scores") without noting it already exists.
- **Recommendation:** close it as part of R1 (the two sites should share one composition helper), or explicitly document it as accepted pre-existing debt. Either is fine; leaving it unnamed is not, because R1 widens it.

### 3. Is `brain_search`'s documented fallback path currently dead?

- **What we know:** `commands/pws-brain.md:100` documents "If `brain_ask` errors, fall back ONCE to `mcp__mindrian-brain__brain_search`." Verified: `_isFreeFormTool` recognizes only `brain_ask` and `brain_query`, so `brain_search` always falls to the catch-all and blocks.
- **What is unclear:** whether blocking `brain_search` is intentional (a search string IS user content, so a block is defensible) or collateral. Unlike `brain_stats`, this is not obviously a false positive.
- **Recommendation:** in scope to *document* under R5 (whose acceptance criterion explicitly covers "an equivalent pure-metadata Brain tool" and permits "block is demonstrated to be intentional"). **Do not** widen `_isFreeFormTool` to include `brain_search` as part of this phase - that is a real egress-surface change and belongs behind its own decision. Flag it and let the navigator rule.

### 4. Does the `age_exceeded` arm actually have a live trigger?

- **What we know:** `computeBrainStaleness` and `BRAIN_STALE_AGE_DAYS` ship; D-11 accepts `age_exceeded` as a legitimate third trigger; SPEC.md's Background records `BRAIN.md` self-reporting `staleness: "fresh"` at 12 days old because its hash matched.
- **What is unclear:** whether a session-start staleness scan currently *enqueues* on age (as `commands/brain-derive.md`'s own prose asserts - "the automatic triggers (hash-change queue drain, session-start staleness scan)"), or whether age-out is computed and never acted on. That would be the same "computed, consumed by nothing" shape as `trigger_tier`.
- **Recommendation:** the planner should verify the age arm end to end before assuming it only needs the drain fix. If age-out never enqueues, R2 has a second defect, not one.

### 5. Should the verb -> reach_id affinity be derived semantically rather than hand-authored? (navigator, raised mid-research 2026-07-31)

**Assessment: yes, and it materially improves R1 - but via the LOCAL encoder at build time, not Pinecone at runtime.** Full reasoning and the four blockers against the runtime-Pinecone shape are in Example 2b above.

- **What we know:** F-8's hand-authored inversion has a 5-of-10 coverage hole and one 2-way ambiguity. `lib/core/eureka/embedding-classifier.cjs` + `embedding-spine.cjs` ship a local, zero-egress, zero-spend nearest-neighbor semantic classifier explicitly built for a ~40-term reference set, with a `confident: false` escalation path that maps cleanly onto "this verb has no reach_id" - all verified this session.
- **What is unclear:** (a) exactly which text should serve as each `reach_id`'s exemplar set (candidates: `reachIdToSkillFamily`'s doc comment, `dial-reach-orchestrator.cjs`'s `REACH_DEFS`, `skills/larry-personality/SKILL.md`); (b) whether the derived table should be committed as a frozen constant (recommended) or regenerated by `--check` like `connector-registry.json` (higher assurance, but adds an encoder dependency to the build gate); (c) whether the local encoder's model weights are reliably cached on a fresh CI machine - `embedding-classifier.cjs`'s header notes a one-time generic model-weight download by model id, which is Part-8 clean but is a network touch a build gate should not depend on unguarded.
- **Scope caution, stated plainly:** this is a *narrower, bounded* instance of the DEFERRED "semantic vocab-sourcing from canonical docs" idea. It stays in scope only because it derives exactly one 10x6 table for a mechanism R1 already requires, and touches no sensor's trigger vocabulary. **If a plan starts sourcing sensor keyword vocab from docs, it has crossed into the deferred phase and should stop.** That boundary is worth writing into the plan explicitly.
- **Recommendation:** adopt it for R1's Brain-verb term, as a build-time derivation committed as a frozen constant, with `(b)` and `(c)` resolved at planning. Fall back to the hand-authored split (both candidates for `'Run Methodology'`, documented no-op for the 5 un-invertible verbs) if the encoder proves unreliable in CI - that fallback is fully sufficient for the SPEC's acceptance criteria on its own.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (>=22.16.0 floor) | All CJS modules; `node:sqlite` `timeout` option | Yes | Meets floor (repo runs) | None needed |
| `node:sqlite` | `room-db.cjs`, queue, folder-memory | Yes | Built in; emits ExperimentalWarning (expected) | None needed |
| Test harness (`bash tests/run-all-<phase>.sh` + bare `node tests/*.cjs`) | All verification | Yes | 862 test files present | None needed |
| `scripts/build-connector-registry.cjs --check` | R4 enforcement | Yes | Present | None needed |
| Brain MCP (`mindrian-brain`) | R5 live verification; R2 end-to-end derive | Conditional | Remote, key-gated | `PART8_FORCE_BRAIN_AVAILABLE=1/0` test seam makes both R5 branches deterministically exercisable **without a live Brain wire** `[VERIFIED: part8-egress-guard-hook.cjs:78-87]` |
| Pinecone semantic search (via `brain_search`) | Considered for F-8's verb inversion; **rejected** | **Effectively NO** | Remote, monthly embedding quota | Not needed. Blocked four ways (SPEC hot-path constraint, `pinecone_quota_exhausted` quota, currently always Part-8-blocked per F-5, wrong corpus). Fallback is strictly better: the **local** encoder below. |
| Local encoder (`lib/core/eureka/embedding-spine.cjs`) | Optional build-time verb -> `reach_id` derivation (OQ-5) | Yes (in-repo) | Ships; one-time generic model-weight fetch by model id, no user text | Hand-authored table (both candidates for `'Run Methodology'`, documented no-op for the 5 un-invertible verbs) - fully sufficient for the SPEC's acceptance criteria on its own |
| Knowledge graph (`.planning/graphs/graph.json`) | Optional research aid | Present but **stale** | 185h old, 583 commits behind, `stale: true` | Not used for any claim; a discovery query returned zero nodes. All findings come from direct source reads instead. |
| `mcp__langtalks-graph-expert__*` | CLAUDE.md mandatory grounding consult for agent/LLM concepts | **NO** | - | **No fallback needed for this phase.** Recorded honestly, not papered over: the tools are absent from this agent's toolset - the identical MCP-stripping condition Phase 244-RESEARCH.md documented and 244-08 reconfirmed at execution time. It is also genuinely not load-bearing here: every claim in this document is an in-repo source fact, not an agent-architecture concept. The one conceptual question (superpowers vs. sensor bank, Open Question 1) was answered by reading the actual installed plugin source, which is a strictly stronger source than a podcast corpus. |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Brain MCP (test seam covers it); langtalks MCP (not load-bearing, see above).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (no jest/vitest/mocha). Bare `node` scripts that exit non-zero on failure, aggregated by per-phase bash runners. |
| Config file | None. Discovery is by glob inside each `tests/run-all-<phase>.sh`. |
| Quick run command | `node tests/test-<name>.cjs` (single file, seconds) |
| Full suite command | `bash tests/run-all-245.sh` (to be created), plus the regression set below |
| Phase-gate roll-up | `node scripts/doctor.cjs --acceptance` |

**Runner convention to follow (from `tests/run-all-244.sh`, the direct predecessor):** discovery is by **glob, not by a hand-maintained list** - "a list is a second place to forget something." The header enumerates mandatory tests by filename for human readability while the glob does the actual discovery. `tests/run-all-245.sh` must follow this shape.

### Phase Requirements -> Test Map

| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| R1 | Two turns with different intent produce two different **top-ranked dial items** (asserted on `buildReachList` output, NOT on `rankFiredCandidates`) | integration | `node tests/test-245-dial-reactivity.cjs` | Wave 0 |
| R1 | A fresh Brain `pattern_matches` verb influences dial ranking **on a turn where a sensor also fires** | integration | `node tests/test-245-brain-verb-not-starved.cjs` | Wave 0 |
| R1 | Absent sensor + absent Brain verb -> **byte-identical** dial to today (the no-op discipline) | regression | `node tests/test-158-reach-byte-stable.cjs` | Exists |
| R1 | `buildReachList` stays pure (D-03 tripwire) | regression | `node tests/test-158-reach-orchestrator-pure.cjs` | Exists |
| R1 | Fused max per reach stays below the 0.70 floor (F-7 / A3 bound) | unit | `node tests/test-245-nudge-bound.cjs` | Wave 0 |
| R2 | Drain spawns >=1 child on a cold process with a non-empty queue | integration | `node tests/test-245-drain-budget.cjs` | Wave 0 |
| R2 | With `PARENT_BUDGET_MS` forced to 0, the queue **still holds its entries** (D-08 half two) | unit | `node tests/test-245-drain-no-silent-loss.cjs` | Wave 0 |
| R2 | Unchanged governing thought + not aged + no explicit ask -> **no** derive dispatched | unit | `node tests/test-245-trigger-negative.cjs` | Wave 0 |
| R2 | Each of the 3 triggers (hash change / `age_exceeded` / explicit ask) enqueues | unit | `node tests/test-245-trigger-arms.cjs` | Wave 0 |
| R3 | `freshContradictions >= 2` -> `dispatchSensors` yields `reach_id: 'hats'` | unit | `node tests/test-245-sens17-hats.cjs` | Wave 0 |
| R3 | `freshContradictions === 1` -> SENS-08 only, **no** hats double-fire (D-14) | unit | `node tests/test-245-sens17-no-double-fire.cjs` | Wave 0 |
| R4 | 2+ colliding `context_block` sensors resolve to the priority-rule winner, **independent of registry order** (shuffle the input) | unit | `node tests/test-245-tiebreak-deterministic.cjs` | Wave 0 |
| R4 | Every registered sensor has a `SENS_PRIORITY` entry (completeness, fail-closed) | build gate | `node scripts/build-connector-registry.cjs --check` + `node tests/test-245-priority-complete.cjs` | Wave 0 |
| R4 | All 12 `context_block` colliders stamp `evidence.sensor_id` (D-21) | unit | `node tests/test-245-sensor-id-stamped.cjs` | Wave 0 |
| R5 | `brain_stats` / `brain_schema` with `{}` classify as allow (or documented block) | unit | `node tests/test-245-egress-contentless.cjs` | Wave 0 |
| R5 | Content-carrying payloads still block (no regression in the boundary) | regression | `node tests/part8-egress-guard-hook.test.cjs`, `node tests/part8-leak-sweep-191.test.cjs` | Exists |
| All | No synchronous Brain call added to the per-turn hot path (SPEC criterion) | regression | `node tests/test-decide-part8-invariant.cjs` | Exists |

### Sampling Rate

- **Per task commit:** the single `node tests/test-245-<name>.cjs` for the task, plus `node tests/test-158-reach-byte-stable.cjs` and `node tests/test-158-reach-orchestrator-pure.cjs` on any task touching R1 or R4.
- **Per wave merge:** `bash tests/run-all-245.sh` plus `bash tests/run-all-244.sh` (the direct predecessor at this seam) and `bash tests/run-all-222.sh` (the Hedge ranker's own phase gate).
- **Phase gate:** full suite green + `node scripts/doctor.cjs --acceptance` + `node scripts/build-connector-registry.cjs --check` + `node scripts/build-orchestration-projection.cjs --check` + `node scripts/check-render-coverage.cjs` before `/gsd-verify-work`.

**Known pre-existing failures to expect and NOT attribute to this phase** (from Phase 244's verified closure): `eureka-fts-index-visible` doctor point fails on two real rooms with orphaned `eureka_fts` rows (`jonathan-contractor-motj`, `aion-eureka-synergy`); `bash tests/run-all-205.sh` has one pre-existing `edges.review_status` schema-drift failure.

### Wave 0 Gaps

- [ ] `tests/run-all-245.sh` - glob-discovery phase runner (mirror `run-all-244.sh`'s shape)
- [ ] `tests/test-245-dial-reactivity.cjs` - R1 acceptance 1; **must assert on `buildReachList` output**
- [ ] `tests/test-245-brain-verb-not-starved.cjs` - R1 acceptance 2 (D-24)
- [ ] `tests/test-245-nudge-bound.cjs` - F-7 / A3 invariant
- [ ] `tests/test-245-drain-budget.cjs`, `tests/test-245-drain-no-silent-loss.cjs` - R2, both halves of D-08
- [ ] `tests/test-245-trigger-arms.cjs`, `tests/test-245-trigger-negative.cjs` - R2 acceptance
- [ ] `tests/test-245-sens17-hats.cjs`, `tests/test-245-sens17-no-double-fire.cjs` - R3
- [ ] `tests/test-245-tiebreak-deterministic.cjs`, `tests/test-245-priority-complete.cjs`, `tests/test-245-sensor-id-stamped.cjs` - R4
- [ ] `tests/test-245-egress-contentless.cjs` - R5
- [ ] No framework install needed; no shared fixture file required (repo convention is self-contained test scripts)

**Mutation-proof note carried forward from Phase 244's verification:** that phase's one non-blocking finding was a test suite that called a function directly and never exercised it *through its production call site*, leaving no fence against silent future removal. Phase 245's R1 tests are at maximum risk of the identical shape. **Every R1 test must run through the production path** (`intent-classifier` -> `buildReachList`), and the phase gate should include a mutation proof: break the fusion call site and confirm the R1 tests redden.

## Security Domain

`security_enforcement` is not set in `.planning/config.json`; absent = enabled. R5 *is* a security requirement, so this section is load-bearing rather than pro-forma.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in this phase |
| V3 Session Management | no | No session surface |
| V4 Access Control | **yes** | Canon Part 8 egress boundary - `part8-egress-guard.cjs` + `part8-egress-guard-hook.cjs`. R5 modifies this control; it is the phase's primary security surface. |
| V5 Input Validation | **yes** | `makeReach` strips non-primitives from `evidence`; `classify()`'s forbidden-pattern scan; `dispatchSensors`'s `REACH_IDS` membership check. All existing; R3/R4 must not weaken them. |
| V6 Cryptography | no | No crypto. `governing_thought_hash` is an identity/change-detection hash, not a security control. |
| V8 Data Protection | **yes** | Part 8 is a data-egress boundary: user-specific bytes must never cross LOCAL -> BRAIN. Held as a hard invariant by the SPEC, not reopened by this phase. |
| V14 Configuration | **yes** | Fail-closed build gates (`--check`) and the hook matcher's single-source-of-truth (`BRAIN_TOOL_MATCHER`) are configuration controls R4 and R5 both touch. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Widening the egress recognizer lets user content cross to Brain | Information Disclosure | R5's fix must be a **positive** recognizer for provable emptiness, inserted ahead of the catch-all. Never relax the catch-all itself (Pitfall 6). |
| `evidence.sensor_id` stamp (D-21) smuggles user content into a Part-8-swept struct | Information Disclosure | `makeReach` already strips non-primitives and freezes; `sensor_id` must be a **literal constant** in the sensor file, never derived from turn text. Assert this in `test-245-sensor-id-stamped.cjs`. |
| Hook fails open on internal error, leaving the boundary unguarded | Elevation of Privilege | Existing accepted risk A3/T6 (fail-OPEN on parse/require error), deliberately not flipped by Phase 239. **R5 must not change the fail posture.** The complementary fail-CLOSED belt lives in `brain-client.cjs`. |
| Matcher drift re-opens the gate | Tampering | Already mitigated: the in-hook re-check derives from the same exported `BRAIN_TOOL_MATCHER` the `hooks.json` matcher is asserted equal to (Phase 239 OQ-1 backstop). Do not introduce a second copy. |
| Poisoned enum lifts the dial | Tampering | `cortex-reach-adapter` reads enum membership only and ignores off-enum values (threat T-150.8-14). R1's new terms must follow the same discipline: **key on `reach_id` membership in the frozen set, never on prose.** |
| A sensor ships without a priority entry and silently degrades to file order | Repudiation | D-22's fail-closed build gate - but see F-3: it needs a sensor-side enumeration to actually cover the 12 colliders. |

**Canon Part 8 stop-and-ask trigger (restated from SPEC):** if any requirement's implementation appears to require weakening the LOCAL -> BRAIN boundary, that is a stop-and-ask moment for the navigator, not a default this phase takes. Nothing in this research suggests it will arise - R5's recommended fix *narrows* what is ambiguous without widening what is allowed to carry content.

## Project Constraints (from CLAUDE.md)

Directives extracted from the project's own instructions that bind this phase. Treat with the same authority as locked decisions.

| Directive | Binding effect on this phase |
|-----------|------------------------------|
| **Workspace guard** | All work runs from `/home/jsagi/dev/MindrianOS-Plugin/`, never `~/.claude/plugins/`. Confirmed: this research ran from the dev workspace. |
| **Canon Part 3** (Tri-Context Decision Gate; Shape F, MAX_K=3, DIAL_REACH_K=6, **0.70/0.15 frozen**) | The dial gate is frozen. R1 must not move it. See F-7 / Pitfall 5. `CANONICAL_VERBS` is a closed 10-verb set - amendable per SPEC but not a default (see F-8). |
| **Canon Part 7** (Reuse before build) | Every requirement here has its primitive in-tree. D-10 and D-20 both encode Part 7 rejections. Any net-new surface needs explicit justification. |
| **Canon Part 8** (Graph Boundary) | Hard invariant, not reopened. R5 investigates guard *scoping*, not the boundary. |
| **Canon Part 9** (Memory Locality) | Room writes go through `lib/core/navigation.cjs` only. R2's `logSpineRead` already does; R4's stamp is in-memory only. |
| **Canon Part 11** (CIRS - born WIRED or EXCLUDED; `hitl_shape`/`hitl_why` declared) | D-09 flips `brain-derive.md`'s `connector.excluded: true`. Its frontmatter already declares `hitl_shape: "F.0"` with a `hitl_why` - verified present, so the flip does not create a shape-declaration gap. Re-run `check-shape-declaration.cjs` regardless. |
| **Canon Part 12** (Pedagogy / invisibility) | Directly relevant to Open Question 1: a low-threshold "fire if it might apply" posture conflicts with the invisibility mandate. Also bounds R3 - SENS-17's `>= 2` threshold is a Part 12 restraint, not just a de-dup fix. |
| **Tri-Polar Design Rule** | CLI, Desktop, Cowork. R1 lands at `scripts/intent-classifier.cjs` (CLI render path) - the planner must state whether Desktop/Cowork reach the dial through the same seam or a different one, and if skipped, say so deliberately. `lib/mcp/tools/sensors.cjs:142` is a third surface consuming `rankFiredCandidates` and inherits R4's tie-break automatically. |
| **Connector spine** | "One governed reach path: `dispatchSensors` -> `decide()` -> resolver; **no second selection brain**." This is the rule behind D-20 and behind Pattern 2's insistence that R1's math stay in the shared layer. |
| **Code conventions** | CJS only, no TypeScript. `process.argv` switch-case routers, no Commander/yargs. Bash scripts in `scripts/` stay authoritative. |
| **No em-dashes anywhere** | Hyphens only. Applies to code comments, docs, and test output. Phase 244 swept all 26 touched files. |
| **GSD workflow enforcement** | No direct edits outside a GSD command. This phase proceeds `/gsd-plan-phase 245` -> `/gsd-execute-phase 245`. |
| **Verification** | `bash tests/run-all-<phase>.sh`; `node scripts/build-connector-registry.cjs --check`; `node scripts/build-orchestration-projection.cjs --check`; `node scripts/check-render-coverage.cjs`; `node scripts/doctor.cjs --acceptance`. Never bump versions by hand (`scripts/release.sh`). |
| **Dev-research compositing** | This phase touches MindrianOS's own architecture, so findings file in BOTH `.planning/phases/245-.../` and `~/MindrianRooms/rethinking-mindrianos/research/`, cross-linked. **The three corrections F-1, F-2 and F-3 in particular should be mirrored to the room** - F-1 in particular refines the room's own Section 4 finding one level finer. |
| **Grounding-sources rule** | Consult all sources authoritative for the claim. Applied: live source reads + live execution (authoritative for in-repo behavior); installed-plugin source read for the superpowers question; langtalks MCP unavailable and recorded honestly (Environment Availability). |
| **RCA standard** | If R5's investigation is written up as a defect report, use `docs/RCA-TEMPLATE.md` into `.planning/debug/` (`git add -f`, since `.planning/` is gitignored). |

## Sources

### Primary (HIGH confidence - live source read or live execution, this session, working tree `main`)

- `lib/workflow/reach-hedge-ranker.cjs:405-509` - `rankFiredCandidates` full body; confirms read-only `reachScores` consumption, array return, `a.index - b.index` tie-break (F-1, D-18, D-20)
- `lib/hmi/dial-reach-orchestrator.cjs:34-38,116-117,190-207,306` - frozen 0.70/0.15 gate, `_resolveReachScore`, `buildReachList` signature (F-1, F-7, D-03)
- `lib/hmi/cortex-reach-adapter.cjs:51-105,194-258` - `CONTRIBUTIONS` table, the "never solo-crosses 0.70" house invariant, additive accumulate + clamp01 (F-7)
- `scripts/intent-classifier.cjs:1274-1345, 2040-2070, 2110-2145` - the live dial render path, the Phase 158-03 `Object.assign` precedent, the telemetry recompute divergence (F-1, Pattern 1, Pitfall 7)
- `lib/core/navigation-engine.cjs:305-346, 401-440, 596-660, 876, 1000-1030` - `buildContextAssembly`, `reachIdToSkillFamily`, `resolveFireSkill` precedence, `freshContradictions`, the `rankFiredCandidates` call site (F-2, F-8, D-02, D-13, D-24)
- `lib/core/navigation-engine-shared.cjs:65-76` - the frozen 10-verb `CANONICAL_VERBS` (F-8)
- `lib/core/insight-sensors.cjs:696-793` - `SENSOR_REGISTRY` (18 entries), `dispatchSensors` soft-fail loop (D-19, Pattern 3)
- `lib/core/sensors/sensor-types.cjs:237-277` - `makeReach` evidence contract (D-21)
- `scripts/brain-derivation-drain.cjs:55,142-200` + `lib/core/brain-derivation-queue.cjs:289-406` - the R2 defect site and the unconditional queue removal (D-07, D-08, Example 3)
- `lib/core/brain-md-staleness.cjs:46-79` - `BRAIN_STALE_AGE_DAYS` semantics (D-11)
- `scripts/part8-egress-guard-hook.cjs` (full, 224 lines) + `lib/core/part8-egress-guard.cjs:221-268` + `lib/core/brain-response-sanitize.cjs:61-79` + `hooks/hooks.json:236` - the complete R5 chain (F-4, F-5)
- `lib/core/brain-client.cjs:265,333,416-470,488,575,962` - the literal `callTool('brain_stats', {})` / `('brain_schema', {})` payloads (F-4); `brain_search`'s Pinecone leg and its `pinecone_quota_exhausted` monthly-quota error with Cypher fallback (Example 2b blocker 2)
- `lib/core/eureka/embedding-classifier.cjs:1-45,217-226` - the local, zero-egress, zero-spend nearest-neighbor semantic classifier; its own Canon Part 8 statement, its ~40-term reference-set scale, and the `confident:false` escalation contract (Example 2b, Open Question 5)
- `data/connector-registry.json` `sensor_index` (13 keys, enumerated live) + `scripts/build-connector-registry.cjs:121,483,566,596,625` - F-3
- `commands/think-hats.md:30-31`, `commands/persona.md:25-26`, `commands/bono.md:51-52`, `commands/brain-derive.md` frontmatter - D-15 and D-09 confirmed verbatim
- `~/.claude/plugins/cache/claude-plugins-official/superpowers/6.2.0/skills/using-superpowers/SKILL.md:1-60` - the 1% rule verbatim, installed and active (Open Question 1)
- **Live execution:** `part8-egress-guard.cjs::classify()` run against 8 payload/tool combinations (F-4, F-5); cold-process drain timing measured across 3 fresh `node` processes (F-6); `sensor_index` key enumeration (F-3)

### Secondary (MEDIUM confidence - project artifacts, cross-checked against source)

- `.planning/phases/245-.../245-SPEC.md` and `245-CONTEXT.md` - the locked requirements and the 24 decisions
- `~/MindrianRooms/rethinking-mindrianos/research/2026-07-31-dial-rethink-decoupled-from-sensor-bank/` - the same-day room research; Section 4's decoupling finding independently reconfirmed and refined here; Sections 3 and 5 already corrected by D-18/D-19
- `.planning/STATE.md` - Phase 244 closure record (zero `package.json` changes; the mutation-proof coverage-gap lesson; the two known pre-existing test failures)
- `CLAUDE.md` + `.claude/includes/*.md` - Canon Parts 3/6/7/8/9/11/12, Tri-Polar rule, connector spine, verification commands

### Tertiary (LOW confidence - noted, not relied upon)

- `.planning/graphs/graph.json` - 185h stale, 583 commits behind, `stale: true`. A discovery query for "reach dial ranking" returned zero nodes. **No claim in this document rests on it.**
- `mcp__langtalks-graph-expert__*` - unavailable in this agent's toolset (same MCP-stripping condition Phase 244 documented). Recorded honestly; not load-bearing, since every claim here is an in-repo source fact.
- External comparative research supplied by the navigator (wshobson/agents, task-master, repomix, superpowers) - the superpowers leg was independently verified against the installed plugin source and is assessed in Open Question 1. The other three were not investigated: none bears on any of the 5 locked requirements.

## Metadata

**Confidence breakdown:**

- **Standard stack: HIGH** - zero external packages; every module named was opened and read this session at the cited line numbers.
- **Architecture: HIGH** - the F-1 data-flow correction is established by enumerating *all* call sites of both `rankFiredCandidates` (2) and `buildReachList` (2 live + 1 telemetry) and reading each. This is exhaustive, not sampled.
- **R5 root cause: HIGH** - reproduced deterministically by live execution across 8 payload/tool combinations, with the full hook chain (matcher -> classify -> verdict -> exit code) read end to end.
- **R2 root cause: HIGH on the mechanism, MEDIUM on the magnitude** - the accounting bug is a direct source read and is certain. The specific millisecond figures vary by machine and cache state; my three cold runs (162/96/145ms) differ from the prior agent's 191ms, which is itself the finding (Pitfall 4: the overrun is flaky, not deterministic).
- **F-3 (`sensor_index` gap): HIGH** - key set enumerated live and diffed against `SENSOR_REGISTRY` read from source.
- **Pitfalls: HIGH** - each is derived from a verified source fact, not from general experience.
- **Open Question 1 (superpowers): HIGH on the facts, MEDIUM on the judgment** - the plugin, the file, and the rule text are verified. Whether the comparison "changes anything" is an architectural judgment; the reasoning is laid out so the navigator can disagree with it explicitly.
- **A3 (nudge bound below 0.70): MEDIUM** - derived from the existing table's documented invariant, but D-05 explicitly leaves the crossing open as a navigator choice. Flagged for confirmation.

**Research date:** 2026-07-31
**Valid until:** 2026-08-14 (14 days). Shorter than the 30-day default for stable domains: this research is pinned to a fast-moving working tree (583 commits since the last graph build), and F-1/F-2/F-3 are claims about live wiring that any concurrent phase touching `intent-classifier.cjs`, `reach-hedge-ranker.cjs` or `insight-sensors.cjs` could invalidate. Re-verify the call-site enumeration if planning starts after that date.

---

*Phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-*
*Research completed: 2026-07-31*
*Next step: /gsd-plan-phase 245 - and apply the SPEC.md Requirement 2 acceptance-criterion rewording per 245-CONTEXT.md's `<spec_lock>` note before or during planning*
