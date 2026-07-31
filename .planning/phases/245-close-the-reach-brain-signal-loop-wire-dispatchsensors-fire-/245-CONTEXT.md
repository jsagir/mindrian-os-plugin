# Phase 245: Close the reach/Brain signal loop - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

A navigator in a venture room asking two different things in the same session sees two
different, Brain-informed top-ranked dial items, and Brain re-derivation happens on a defined
trigger instead of implicitly whenever someone remembers to run it. Five requirements, all
implementation-level decisions locked below via a 4-area advisor-mode research pass
(gsd-advisor-researcher, opus, minimal_decisive calibration tier).

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `245-SPEC.md` for full requirements, boundaries, and
acceptance criteria.

Downstream agents MUST read `245-SPEC.md` before planning or implementing. Requirements are not
duplicated here.

**One amendment to SPEC.md surfaced during this discussion, not yet applied to the file:**
Requirement 2's acceptance criterion currently reads "a turn with an unchanged governing thought
and no explicit ask does NOT trigger a live Brain call." Research proved the correct,
already-shipped mechanism also fires on `age_exceeded` (7-day staleness) as a legitimate third
trigger. Navigator confirmed (this discussion): reword the acceptance criterion to "unchanged
governing thought AND not aged past `BRAIN_STALE_AGE_DAYS` AND no explicit ask -> no call."
**gsd-planner must apply this wording change to `245-SPEC.md` Requirement 2 before or during
planning** - it is a locked decision from this discussion, not yet written back to the SPEC file
itself.

**In scope (from SPEC.md):** dial-ranking fusion (Req 1); Brain-consult trigger/cadence policy
(Req 2); `hats` sensor firing proactively (Req 3); `context_block` tie-break rule (Req 4); Part 8
egress-guard scoping check (Req 5). Canon changes (including Part 3's `CANONICAL_VERBS`) are
explicitly not pre-foreclosed if genuinely required.

**Out of scope (from SPEC.md):** full sensor-bank rewrite (unmet flip conditions per the
2026-07-31 dial-rethink room research); live/synchronous Brain call in the per-turn hot path;
reopening CLOSED Phase 244. Canon Part 8 (Brain egress boundary) held as a hard invariant
regardless of the navigator's "everything's open" instruction - a session-judgment carve-out, not
navigator-declared.

</spec_lock>

<decisions>
## Implementation Decisions

### Requirement 1 - Dial-ranking fusion mechanism
- **D-01:** Sensor/`fire_skill` signal merges into the dial's ranking as a bounded additive,
  `reach_id`-keyed term inside `lib/workflow/reach-hedge-ranker.cjs` (the repo's own "ONE shared
  scored-selection layer," already blending the cortex D4 score with a registry signal over the
  same 6 frozen `reach_id`s, already importing `cortex-reach-adapter`). NOT RRF fusion - RRF
  discards the score magnitude the frozen 0.70/0.15 RECOMMENDED-marker gate is defined on, and
  the repo's own `f-selector-ranker.cjs` documents RRF's rank-1/rank-2 gap (~3.8% at k=25) as too
  flat for a 6-item bank. Keep RRF as the fallback if a future signal source is NOT
  `reach_id`-keyed.
- **D-02:** The fired-sensor signal is already available at the render callsite via
  `decision.decision_trace.context_assembly.facts[]` (`navigation-engine.cjs::buildContextAssembly`)
  - no new plumbing/DB/Brain call needed to wire this.
- **D-03:** `buildReachList` itself (`lib/hmi/dial-reach-orchestrator.cjs`) stays byte-unchanged -
  its purity tripwire (`tests/test-158-reach-orchestrator-pure.cjs`) and byte-stable snapshot
  (`tests/test-158-reach-byte-stable.cjs`) must keep passing. The fusion happens upstream, inside
  the hedge ranker, before scores reach that function.
- **D-04:** Lockstep hazard flagged for the planner: `scripts/intent-classifier.cjs:2048-2108`
  independently recomputes `buildReachList` for `reach_presented` telemetry and must receive the
  same fused scores, or logged "what was offered" diverges from what actually rendered.
- **D-05:** The nudge weight is a new tunable that can push a reach across the frozen 0.70
  RECOMMENDED floor - the planner must define an explicit bound (or explicitly accept the
  crossing) rather than leave it unconstrained.
- **D-24 (navigator-confirmed mid-discussion, amends SPEC.md Req 1):** `resolveFireSkill`
  (`lib/core/navigation-engine.cjs:596-660`) has a strict precedence order - wicked escalation,
  then a fired sensor reach (step 2), THEN the Brain `pattern_matches` verb path (step 3, gated on
  `tierMode === 'mode_a' && weightApplied > 0`). A fired sensor reach returns early and the Brain
  branch never runs. Live observation this session: a sensor fired on essentially every turn, so
  Brain's own suggested verb would be starved almost always, even once Req 2 makes `BRAIN.md`
  fresh. Left as originally scoped, Req 1 would satisfy its own acceptance test (dial reacts to
  sensor signal) without actually satisfying the SPEC's Goal statement ("Brain-informed... dial
  items"). Navigator confirmed: Req 1's fusion in `reach-hedge-ranker.cjs` (D-01) must treat
  Brain's `pattern_matches` verb as a genuine third input into the blend, not merely whatever
  `fire_skill` happens to resolve to after sensor-precedence wins the race. Planner must design
  the actual blend shape (e.g., Brain-verb as an independent additive term keyed the same way as
  the sensor term, rather than only reachable through `fire_skill`'s single-winner slot).

### Requirement 2 - Brain re-derive trigger mechanism
- **D-06:** This is a BUG FIX, not new build. The full trigger -> queue -> drain -> detached-spawn
  cascade already ships in v1.16.0-beta.1, hook-wired (`hooks/hooks.json` UserPromptSubmit),
  Part-8-key-allowlisted, and covered by 15+ existing tests.
- **D-07:** Root cause (live-reproduced by the research agent, not inferred):
  `scripts/brain-derivation-drain.cjs` lines ~149-158 captures `start = Date.now()` BEFORE
  `Q.drain()`'s lazy `require('./folder-memory.cjs')` (which pulls in `node:sqlite`). Cold-process
  measurement (matching how the hook actually runs - fresh node per turn): 191ms elapsed at the
  spawn loop vs. a 100ms `PARENT_BUDGET_MS`. The loop aborts after spawning zero children - but
  `Q.drain()` has ALREADY removed every dispatched entry from the queue on the way in. Every turn
  silently vacuums the queue and derives nothing.
- **D-08:** Fix shape: hoist the `require` above `start`, or budget per-spawn instead of
  loop-abort, AND make drain-removal contingent on an actual spawn happening (re-enqueue any
  un-spawned remainder) so a future slow turn degrades gracefully instead of silently losing work.
- **D-09:** Flip `commands/brain-derive.md`'s `connector.excluded: true` for the explicit-ask
  surface - the file's own reason string already names this as the intended fix ("INV-06
  promotion candidate... excluded for now").
- **D-10:** Explicitly rejected: a new PostToolUse hook + new enqueue path (would duplicate the
  existing `post-write` -> `minto-debouncer` -> `vault-section-minto-generator` ->
  `tryEnqueueBrainDerivation` cascade that already does this - a real Part 7 violation, not
  demonstrated to be needed).
- **D-11 (navigator-confirmed this discussion):** `age_exceeded` (7-day `BRAIN_STALE_AGE_DAYS`
  default) is accepted as a legitimate third trigger alongside governing-thought-change and
  explicit-ask. SPEC.md Requirement 2's acceptance criterion needs rewording per the `<spec_lock>`
  note above.

### Requirement 3 - hats sensor trigger condition
- **D-12:** New sensor file `sensor-perspective-lock.cjs` (SENS-17), firing on
  `ctx.freshContradictions >= 2` -> `reach_id: 'hats'`, `posture: 'hold'`.
- **D-13:** The trigger condition is not invented - it's already written as doctrine at
  `skills/larry-personality/SKILL.md:383` ("CONTRADICTS edges, circular pattern, decision point,
  jargon spike" -> Six Thinking Hats), and `ctx.freshContradictions` is already computed and
  threaded onto `sensorCtx` at `navigation-engine.cjs:876` - near-zero new plumbing.
- **D-14:** The `>= 2` threshold (not `> 0`) is load-bearing and must ship with the sensor, not
  after: `SENS-08` (`sensor-memory-cortex.cjs:84`) already fires `cross_room` on
  `freshContradictions > 0`, so a hats sensor on the same field at `> 0` would double-fire on
  every contradiction. One fresh contradiction = memory-cortex bridge; two or more unresolved =
  perspective lock worth a hats rotation.
- **D-15:** Bonus finding to fix as part of this work: `commands/think-hats.md`,
  `commands/persona.md`, and `commands/bono.md` all currently declare `sensor_triggers: [SENS-05]`
  alongside `reach_id: hats` in their frontmatter - but SENS-05 is `sensor-jtbd-reweight.cjs`,
  which fires `context_block`, not `hats`. These registry declarations are currently false;
  SENS-17 is what makes them true. Update the frontmatter to point at SENS-17.
- **D-16:** Explicitly rejected: extending `sensor-circularity.cjs` (SENS-10) with a 5th cause.
  Keyword-only (FALLBACK tier) detection, breaks the audited zero-collision property, overloads a
  sensor whose header/tests explicitly encode "four causes, four exits."
- **D-17:** Flip-condition check (explicit, per SPEC's boundary note): confirmed NOT tripped.
  `lib/core/sensors/` holds 19 `.cjs` files today (17 sensor implementations + `sensor-types.cjs`
  shared contract + `hat-scoping-table.cjs` pure lookup). SENS-17 takes implementations 17 -> 18,
  against the dial-rethink research's named ~25-30 threshold - 7-13 files of headroom remain.

### Requirement 4 - context_block tie-break rule
- **D-18 (corrects the room's own prior research):** The existing Hedge/MWU reranker
  (`lib/workflow/reach-hedge-ranker.cjs::rankFiredCandidates`) does NOT already solve this and is
  not "unwired" - it IS invoked at both call sites (`navigation-engine.cjs:1015`,
  `lib/mcp/tools/sensors.cjs:142`), and is structurally blind to same-`reach_id` collisions by
  construction: every scoring term (`d4For`, `canonicalRegistryRank`, `countPenalty`) is keyed on
  `reach_id`, not on the individual sensor. Live-tested with a synthetic 3-way collision, including
  weights skewed 0.99/0.01: output order was IDENTICAL, falling through to the stable sort's
  `a.index - b.index` (original `SENSOR_REGISTRY` file order) every time. Requirement 4 is genuine
  new work, not a Part 7 wiring win.
- **D-19:** Corrected collision count: 12 of 18 registered sensors can fire `context_block`, not
  11 of 17 (the room's grep missed SENS-01 `sensorFirstMaterial`, which lives inline in
  `insight-sensors.cjs:613`). SENS-SPEC.md's Requirement 4 background text should be read with
  this correction; not required to edit the SPEC file itself since the requirement's substance
  (a real tie-break rule) is unchanged.
- **D-20:** Chosen mechanism: a doctrine-authored `SENS_PRIORITY` frozen ordered constant, consumed
  as the tie branch inside `rankFiredCandidates`'s comparator (the one shared selection layer both
  call sites already use - NOT a second selection brain inside `dispatchSensors`, which would
  violate R4/Canon Part 7).
- **D-21:** Prerequisite: `evidence.sensor_id` (e.g. `'SENS-11'`) must be stamped on all 12
  colliding sensors before the priority key exists to sort on - a Part-8-safe one-line add per
  sensor (evidence already accepts string primitives).
- **D-22:** Enforcement: extend the existing `data/connector-registry.json` `sensor_index` +
  `scripts/build-connector-registry.cjs --check` machinery so a sensor shipped without a priority
  table entry fails the build closed, rather than silently degrading to file-registration order.
- **D-23:** Explicitly rejected: per-sensor `trigger_tier` as the primary tie signal. The shipped
  `classifyTriggerTier` classifier is turn-level, not sensor-level - a generic call returns the
  identical tier for every colliding sensor on the same turn, so it can't discriminate colliders
  without inventing per-sensor hand-authored tier constants that reduce to a coarser copy of the
  priority table anyway, at higher cost and with a second doctrine surface that can drift from the
  table. `trigger_tier` stays usable as a Req-1-adjacent cross-family fusion input (Phase 244's
  `orchestration-candidate-lift.cjs`), just not as this requirement's primary mechanism.

### Requirement 5 - Part 8 egress-guard scoping check
### Claude's Discretion
No advisor-research area was run for Req 5 this discussion (not selected as a gray area - the
navigator's 4 selections covered Req 1-4 only). Planner/researcher should treat Req 5 as
open-investigation: root-cause the live observation from this session (a plain `brain_stats` call
was intercepted by `part8-egress-guard-hook.cjs`'s leak-prevention card) against the guard's
actual matcher logic, and determine correctly-conservative vs. over-firing per SPEC.md's stated
acceptance criterion. No implementation direction is pre-decided here.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase artifacts (this phase)
- `.planning/phases/245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-/245-SPEC.md` - locked requirements, boundaries, acceptance criteria (read first)
- `/home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-07-31-dial-rethink-decoupled-from-sensor-bank/2026-07-31-dial-rethink-decoupled-from-sensor-bank.md` - the same-day room research this phase builds on; Section 3 (Hedge/MWU history, corrected by D-18), Section 5 (collision count, corrected by D-19), Section 6 (rewrite-vs-finish verdict), the arXiv 2605.30152 citation (Req 2's async-only constraint)
- `/home/jsagi/MindrianRooms/rethinking-mindrianos/research/2026-07-31-phase-245-spec-reach-brain-signal-loop/2026-07-31-phase-245-spec-reach-brain-signal-loop.md` - the room mirror of this phase's own SPEC scoping

### Requirement 1 (dial fusion)
- `lib/workflow/reach-hedge-ranker.cjs:456-496` - the existing weighted blend to extend (`wD4 * d4Adjusted + wReg * registrySignal`)
- `lib/hmi/dial-reach-orchestrator.cjs:199-207,274-288` - `_resolveReachScore` + the self-documented decoupling comment; must stay untouched
- `lib/core/navigation-engine.cjs:305-346,835,1015,1147,1511` - `buildContextAssembly`, `trace === decision.decision_trace` on both return paths, sensor reach-list re-ranking before `facts[]` is built
- `scripts/intent-classifier.cjs:1284-1297,2048-2108` - the shipped precedent for injecting a second signal into `reachScores`; the lockstep telemetry recompute site (D-04)
- `lib/workflow/f-selector-ranker.cjs:101-106,672-745` - the repo's own RRF-limitation note; `_applyTierFusion` as a shape precedent on the disjoint command-slug path
- `lib/core/eureka/hybrid-retrieve.cjs:90-118` - `rrfFuse`, generic and reusable if ever needed
- `tests/test-158-reach-orchestrator-pure.cjs`, `tests/test-158-reach-byte-stable.cjs` - the frozen-purity gates D-03 must keep green

### Requirement 2 (Brain trigger)
- `lib/core/brain-md-staleness.cjs::computeBrainStaleness` - staleness/hash computation
- `scripts/vault-section-minto-generator.cjs::readPriorGoverningThoughtHash`/`tryEnqueueBrainDerivation` (~line 678) - the existing enqueue-on-MINTO-write path
- `lib/core/brain-derivation-queue.cjs` - the shipped queue (atomic tmp+fsync+rename, Part-8 key allowlist, section-keyed idempotency)
- `scripts/brain-derivation-drain.cjs:149-158` - the bug site (D-07/D-08)
- `commands/brain-derive.md` - the `connector.excluded: true` flag to flip (D-09), its own reason string names this exact fix
- `hooks/hooks.json` UserPromptSubmit registration - where the drain is already wired

### Requirement 3 (hats sensor)
- `skills/larry-personality/SKILL.md:383` - the doctrine line naming hats' trigger conditions
- `lib/core/navigation-engine.cjs:876` - where `sensorCtx.freshContradictions` is already computed
- `lib/core/sensors/sensor-memory-cortex.cjs:84` (SENS-08) - the double-fire hazard D-14 guards against
- `commands/think-hats.md`, `commands/persona.md`, `commands/bono.md` - frontmatter to correct (D-15)
- `lib/hmi/dial-reach-orchestrator.cjs:136`, `lib/hmi/dial-label-composer.cjs:116` - the already-existing render path SENS-17 plugs into
- `lib/core/insight-sensors.cjs` - where the new `SENSOR_REGISTRY` entry lands

### Requirement 4 (tie-break)
- `lib/workflow/reach-hedge-ranker.cjs::rankFiredCandidates` step (h) - the comparator's tie branch, the actual plug point (D-20)
- `lib/core/insight-sensors.cjs:613` - `sensorFirstMaterial` (SENS-01), the miscounted 12th `context_block` collider
- `data/connector-registry.json` `sensor_index`, `scripts/build-connector-registry.cjs --check` - the enforcement home for D-22
- `lib/core/orchestration-candidate-lift.cjs::buildTierCandidates` - Phase 244's live `trigger_tier` consumer (why D-23 rejects it as this requirement's primary mechanism, not as dead)
- `lib/core/navigation-engine.cjs::rankBehavioralCue` - the tier-index-then-confidence comparator pattern D-23's alternative would have reused

No external specs beyond the above - requirements fully captured in `245-SPEC.md` and the
decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/workflow/reach-hedge-ranker.cjs` - the one shared scored-selection layer; both Req 1 and
  Req 4 extend it rather than minting a second selection path
- `lib/core/brain-derivation-queue.cjs` + `scripts/brain-derivation-drain.cjs` - the entire Req 2
  trigger mechanism already exists; this phase repairs one budget-accounting defect, it does not
  build new infrastructure
- `data/connector-registry.json` `sensor_index` + `scripts/build-connector-registry.cjs --check` -
  existing fail-closed enforcement machinery, extendable for Req 4's priority-table completeness
  gate

### Established Patterns
- Sensor files follow a consistent shape (signal read -> `reach_id` decision ->
  `trigger_tier`/evidence stamp) that SENS-17 (Req 3) should match
- `evidence` on a fired reach accepts string primitives (Part-8 safe) - both `sensor_id` (Req 4)
  and any similar future stamp can piggyback on this without a new schema

### Integration Points
- Req 1 and Req 4 both integrate at `reach-hedge-ranker.cjs`, sequenced: Req 4's tie-break
  (within-`reach_id` ordering) logically sits inside/alongside Req 1's fusion (`reachScores`
  composition) - the planner should sequence these two together, not as fully independent plans
- Req 3's new sensor integrates via the existing `SENSOR_REGISTRY` + already-built render path -
  no new UI/rendering work needed, only the sensor + registry entry + frontmatter corrections
- Req 2's fix is entirely inside the existing hook-wired cascade - no new hook registration needed

</code_context>

<specifics>
## Specific Ideas

- The dial's fusion weight (D-05) and the Req 2 acceptance wording (D-11) are the two places where
  a planner-level number needs picking (nudge-weight bound; `BRAIN_STALE_AGE_DAYS` value to test
  against) - flagged as planning-stage decisions, not pre-picked here.
- Requirement 4's research corrected two claims from the room's own prior investigation (Hedge
  reranker capability, collision count) - worth a short follow-up correction note in the room
  research trail at some point, not blocking this phase.

</specifics>

<deferred>
## Deferred Ideas

**Semantic vocab-sourcing from canonical docs (navigator, raised mid-discussion, 2026-07-31).**
Proposal: instead of each sensor hand-maintaining its own keyword/trigger vocabulary, derive
"tripwire phrase" vocab systematically from the plugin's own already-written canonical sources -
Brain, `SKILL.md` files, command frontmatter, MCP tool `.md` descriptions - and use the local room
graph plus a probability/semantic-similarity ranking (rather than pure keyword match) to surface
a few JTBD-aligned options.

This is a real, well-scoped idea, not vague "make it smarter" - and it would have caught, by
construction, the exact registry-drift bug Req 3's research just found live (3 commands declaring
`sensor_triggers: [SENS-05]` for `hats` when SENS-05 fires `context_block`, not `hats`). It also
has real prior art in this repo: Phase 230 ("MindrianOS Skill Fleet Optimization") already derived
four skill-description trigger-design principles (WHAT+WHEN, near-miss differentiation,
roster-wide testing, held-out validation) - a direct precedent for canonical-doc-sourced trigger
vocab, currently sitting as an open todo
(`2026-07-17-ingest-skill-description-insight-to-brain.md`, blocked on Brain admin-key access).

**Why this is deferred, not folded into Phase 245:** the phase's 5 requirements are already
SPEC-locked and this discussion's 4 areas are already decided (`<decisions>` above). This
proposal is broader than any single locked requirement - it is closer to "how does the whole
sensor bank source its vocabulary," which is exactly the question the same-day
`2026-07-31-dial-rethink-decoupled-from-sensor-bank.md` room research already investigated at
length (Section 6): a full semantic/classifier rewrite was explicitly verdicted AGAINST, because
the primitives it would need (`lib/core/eureka/embedding-classifier.cjs`,
`embedding-spine.cjs`, `hybrid-retrieve.cjs`) already ship for a different feature, and the
named flip conditions (a 3rd patch at this seam, or sensor count crossing ~25-30 files) are not
currently met. The narrower "source vocab from canonical docs instead of hand-duplicating it"
half of the navigator's proposal was NOT directly addressed by that verdict, though, and is a
genuinely good candidate for its own future phase or seed - distinct enough from a full semantic
classifier rewrite that the existing "don't rewrite" verdict doesn't automatically cover it.

**Recommended next step (not started):** file as a seed/phase proposal that explicitly scopes
"vocab sourcing" (derive trigger phrases from `SKILL.md`/command/MCP docs into the
`sensor_index`/`connector-registry.json` machinery Req 4 is already extending) separately from
"ranking mechanism" (which Req 1 and Req 4 of this phase already handle) - conflating the two
is exactly how the dial-rethink investigation's own false premise happened once already.

**Cross-platform orchestration pattern comparison (navigator, raised after CONTEXT.md was
committed, 2026-07-31; fed to the 245-RESEARCH.md researcher as grounding, not independently
verified against this repo yet).** Three external patterns from named open-source agent
orchestration projects, offered as comparison points for this phase's broader "how does
MindrianOS decide what to invoke" question:

- **obra/superpowers** (a plugin actually active in this same Claude Code session) — mandatory
  pre-task skill check: "if there's even a 1% chance a skill applies, invoke it" is a PROMPT-LEVEL
  instruction to the model itself, not a hand-coded keyword classifier. Its 7-phase chain
  (brainstorm → worktree → plan → subagent-driven execution with two-stage review → TDD → code
  review → branch finish) is a concrete, verified implementation of context-triggered activation.
  Closest of the three to this phase's actual scope (Req 3's `hats` sensor, and the already-
  deferred semantic-vocab-sourcing idea above) — genuinely worth the researcher's attention.
- **eyaltoledano/claude-task-master** — `TASK_MASTER_TOOLS` env var selects one of 4 tool-loading
  tiers (core/standard/all/custom) trading MCP context budget against feature completeness at
  server-configuration time. A session/runtime-level concern (which MCP tools load), not a
  `dispatchSensors`/reach-selection concern — likely NOT this phase's scope, closer to a Cowork/
  CLI-runtime seed if pursued.
- **wshobson/agents** — single-Markdown-source-of-truth generating harness-native artifacts for 5
  CLIs from one definition (relevant to the vocab-sourcing idea above, if MindrianOS ever wants
  one canonical trigger-vocab source feeding multiple surfaces); a 5-tier model-routing strategy
  (Fable/Opus/user-inherited/Sonnet/Haiku by task criticality); lazy, scoped context loading via
  per-plugin installation. The model-routing-tier piece is unrelated to Phase 245's scope.

**Disposition:** not folded into Phase 245 (already SPEC-locked, already discussed). Handed to the
`245-RESEARCH.md` researcher as explicit grounding to assess whether it sharpens Req 3's sensor
design or belongs entirely in the existing deferred vocab-sourcing idea. If it turns out to be a
real, separate opportunity, it should land as its own seed in `rethinking-mindrianos`, not as
scope creep into this phase's already-locked 6 requirements.

No other ideas raised outside phase scope during this discussion - the 4 discussed areas stayed
within Phase 245's 5 locked requirements.

### Reviewed Todos (not folded)
- `2026-07-17-ingest-skill-description-insight-to-brain.md` (brain-ingestion, match score 0.6) -
  reviewed via `todo.match-phase`, not folded. Different problem: ingesting a NEW skill-authoring
  insight into Brain's teaching graph (blocked on Brain admin-key access), not the Req 2
  consult-trigger-timing problem this phase addresses. Stays open in its own todo.

</deferred>

---

*Phase: 245-close-the-reach-brain-signal-loop-wire-dispatchsensors-fire-*
*Context gathered: 2026-07-31*
