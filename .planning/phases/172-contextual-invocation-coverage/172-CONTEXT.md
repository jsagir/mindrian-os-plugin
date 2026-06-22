---
kind: context
phase: 172
slug: contextual-invocation-coverage
milestone: v1.14.0
created: 2026-06-22
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
spec_loaded: true
status: context-captured
severity: CRITICAL
sequence: "MAJOR FOUNDATIONAL phase, navigator-designated FIRST 2026-06-22. Phases 170 + 171 FOLLOW and reconcile UNDER this phase's coverage contract; the 170/171 release is ON HOLD until reconciled. Load-bearing for upcoming local-graph-critical seeds/phases."
---

# Phase 172 Context: Contextual Invocation Coverage (the reach surface, fully wired)

<domain>
The moat is not the methodology catalog. It is the engine that knows WHEN to reach for WHICH
capability, in WHAT sequence (CLAUDE.md moat formula). Today that engine is full of holes: many
relevant commands are never contextually triggered. This phase closes the holes and adds a GATE so
they can never silently reopen. It supersedes the ad-hoc, per-phase wiring that has been attempted
several times and always regressed because there was no coverage contract.
</domain>

<why_now>
1. Recurring failure: contextual invocation has been wired piecemeal multiple times (Phase 143.x
   connector spine, 144.1 connector-retrofit-sweep RETRO-07 - scoped, never fully executed) and keeps
   regressing because new surfaces ship dark with only a non-blocking "opt-in nudge" warning.
2. ACE (Phase 170) exposed it: we ingested a methodology, wired ONE trigger, and discovered the
   broader truth - knowledge (a Brain methodology node) and trigger (a connector + sensor) are TWO
   SEPARATE WIRES, and the system only reaches for surfaces that have the TRIGGER wire.
3. Local-graph criticality: upcoming seeds/phases make the local graph (room.db + the
   brain-orchestration-projection) the primary substrate. Contextual invocation must work Local-Only,
   against the local projection, with no live Brain dependency. A broken reach surface there is fatal.
</why_now>

<coverage_baseline_2026-06-22>
Measured from data/command-registry.json x data/connector-registry.json (101 commands):
- FULLY WIRED (connector -> contextually reachable): 54 (51 with a sensor trigger / proactively fired)
- HALF-WIRED (declares a framework -> a thinking tool -> but NO connector, so never auto-fires): 9
    /mos:causal, /mos:diagnostics, /mos:hat-briefing, /mos:persona,
    /mos:rs-experts, /mos:rs-explain, /mos:rs-fetch, /mos:rs-thesis, /mos:validate-proposition
    (NOTE: the ENTIRE reverse-salient rs-* family is un-triggered, though Reverse Salient is a
    Canon Engine-1 pillar.)
- DARK (no framework, no connector -> manual only): 38, MOST of which are correctly-manual UTILITIES
    (doctor, admin, models, setup, help, export, publish, rooms, snapshot, ingest-methodology, ...).
The sin is not being dark. The sin is being dark WITHOUT A DECISION. RETRO-07: every surface is
WIRED or EXPLICITLY EXCLUDED.
</coverage_baseline>

<the_two_wires>
- KNOWLEDGE wire: a :Framework node in the Brain (what the command teaches). Filled by the Phase 171
  methodology-ingest pipeline.
- TRIGGER wire: a connector block (sensor_triggers + reach_id [frozen] + framework + posture +
  hierarchy_rank) that maps a navigator CONTEXT to the command. This is what makes the engine reach.
  A command can have knowledge (or not need it) and still be DARK with no trigger wire.
This phase owns the TRIGGER wire across ALL surfaces (commands + skills + agents).
</the_two_wires>

<scope>
1. Classify every surface (command/skill/agent) as WIRE | EXCLUDE-UTILITY | GAP.
2. Wire every thinking-surface GAP with a connector block (start with the 9 half-wired; rs-* first).
3. Maintain an explicit utility EXCLUDE allowlist (a committed file), so "dark" is always a decision.
4. Upgrade invocation from keyword-only to CONTEXT-DRIVEN where it matters: triggers keyed on the
   navigator's problem state (stage, JTBD, graph gap), not only string match.
5. Validate CHAINING quality: FEEDS_INTO chains must produce useful sequences, not placeholder edges;
   the local orchestration-projection ranks them; confidences are earned, not uniform defaults.
6. Add the RETRO-07 COVERAGE GATE: build-connector-registry --check FAILS (not warns) on any
   surface that is neither wired nor explicitly excluded. This is what makes the fix STICK.
7. Reconcile Phases 170 + 171 under the contract (ACE/diffusion context-triggered, not keyword-only;
   the ingest pipeline's step-5 trigger wiring enforces this phase's rules).
</scope>

<relationship_to_170_171>
170 (ACE ingestion + /mos:diffusion) and 171 (methodology-ingest pipeline) are the FIRST reconciliation
targets, not prerequisites. They are committed on branch phase-170-171-ace-diffusion-pipeline and the
release is ON HOLD until they conform to this phase's coverage contract (context-driven trigger +
coverage-gate membership). The 171 pipeline's "step 5 (trigger + chain)" becomes a thin caller of this
phase's wiring rules so every FUTURE methodology is born contextually-invocable, never dark.
</relationship_to_170_171>

<open_decisions_for_spec_discuss>
- (a) Where the utility EXCLUDE allowlist lives (data/connector-exclude-allowlist.json vs a frontmatter
  flag connector: {excluded: true, reason}). Frontmatter-local is more auditable.
- (b) Context-trigger model: how a sensor reads navigator problem-state (stage/JTBD/graph-gap) within
  Part 8/9 (LOCAL only, via navigation.cjs; enum/scalar evidence only).
- (c) Reach assignment for the 9 half-wired: which of the 6 frozen reaches each maps to (rs-* family
  -> brain_consult? deep_research? context_block?), and the sensor_triggers per command.
- (d) Chaining-confidence source: keep curated FEEDS_INTO weights vs derive from usage; how the
  orchestration-projection surfaces them in suggest-next.
- (e) Gate severity rollout: warn -> fail. Land as warn+report first, flip to hard fail once the
  baseline is wired/excluded (so CI never goes RED mid-sweep).
</open_decisions_for_spec_discuss>

<part8_9_discipline>
All trigger wiring reads LOCAL context only (navigation.cjs chokepoint); sensor evidence is enum/scalar;
no user content crosses to Brain. The coverage works against the LOCAL brain-orchestration-projection so
contextual invocation holds in Local-Only mode (the load-bearing requirement for the upcoming
local-graph-critical phases).
</part8_9_discipline>

<discussion_outcome date="2026-06-22">
Resolved via /gsd-discuss-phase 172 with a 14-stream research fan-out (8 internal recon + 6 web).
Full evidence in research/: recon-connector-spine.md, recon-remote-projection.md,
recon-internal-synthesis.md, EXTERNAL-RESEARCH.md. Headline: 172 is a GATE-TIGHTENING +
WIRING-COMPLETION phase over SHIPPED machinery (the connector spine + the orchestration projection
both exist) — NOT a greenfield dual-graph build. External research confirms the design is current
SOTA with named prior art for every pillar.

## Measured baseline (corrects the CONTEXT estimate)
- 124 invocable surfaces = 101 commands + 14 skills + 9 agents (the real INV-01 denominator;
  skills + agents were not in the "101 commands" baseline).
- 62 connector entries (55 command + 7 agent + 0 SKILL), 0 marked excluded.
- 54 wired / 8 half-wired / ~38 dark commands. The 8 half-wired: causal, diagnostics, hat-briefing,
  persona, rs-experts, rs-explain, rs-fetch, rs-thesis. (validate-proposition is a PHANTOM — no file;
  the baseline's "9th" does not exist.) 0 skills wired; `hats` reach sensor-dark + engine-unmapped.

## Resolved gray-area decisions

### D-172-a (LOCKED) — Exclude mechanism = frontmatter-local
Utility surfaces are marked dark-by-decision with `connector: {excluded: true, reason: "..."}` in the
surface's own frontmatter (auditable, local, matches INV-03 + the "many small focused files" best
practice). NET-NEW: the generator gains an exclude code path, and a generated wired-XOR-excluded
ledger (mirroring data/orchestration-unwired-allowlist.json) is the gate's source of truth. No
surface is dark by accident.

### D-172-b (LOCKED) — Trigger model = context-driven via dispatchSensors + navigation.cjs; keyword is FALLBACK
Sensors fire on navigator problem-state (stage / JTBD / graph-gap) read LOCALLY through the
navigation.cjs chokepoint (enum/scalar only, Part 8). Keyword match is demoted to a fallback tier, not
the basis (INV-07). External validation: the Context-aware FSM pattern (arXiv 2509.07571) — states =
room conditions, ineligible capabilities masked; pure-embedding/keyword routing collapses past ~100
tools (124 surfaces is IN the collapse zone). Reuse the shipped 9-sensor spine (insight-sensors.cjs
dispatchSensors); add sensors/connectors for the dark thinking-surfaces.

### D-172-c (LOCKED defaults; planner confirms per-command) — Reach assignment for the 8 half-wired
- rs-experts / rs-explain / rs-fetch / rs-thesis → reach_id `context_block`, sub_mode `reverse-salient`,
  posture `pull_back`, framework "Reverse Salient Analysis" (matches the CONNECTOR-CONTRACT example +
  the live sensor-lagging-component.cjs which already fires context_block). rs-* FIRST (Engine-1 pillar).
- causal → `context_block` (causal trace); diagnostics → `context_block` (Wave-1 fingerprint).
- hat-briefing + persona → `hats` (the Phase-148 6th reach) — and 172 must add the missing `hats`
  case to reachIdToSkillFamily (navigation-engine.cjs) so the engine can route it.

### D-172-d (LOCKED) — Chaining confidence = curated for v1; learned DEFERRED to SEED-009
Production currently emits NO confidence (placeholder-by-omission): the BRAIN.md derivation runs a
Pinecone semantic search that drops `r.confidence`; curated_chains is []. Fix (Local-Only): populate
data/command-registry.json `curated_chains` with curated-confidence FEEDS_INTO edges; regenerate
brain-orchestration-projection.json; wire suggest-next to rank off the projection. Optionally switch
the BRAIN.md derivation from the Pinecone `search` path to a structured FEEDS_INTO edge fetch so
`r.confidence` survives the composer noise gate. Usage-derived/learned weights (and the hardcoded
f-selector 0.40/0.30/0.30 weights) = DEFERRED to SEED-009 (trigger: cohort ≥30 AND outcome edges
≥1000). External support: AutoTool's "Tool Inertia Graph" (3.62-bit entropy — next-step is genuinely
learnable from trajectories) → curated prior, then overwrite with usage-derived later.

### D-172-e (LOCKED) — Gate rollout = warn→fail AND wire into CI
INV-10's gate is WARN-only AND ORPHANED today: build-connector-registry --check is not in pre-commit
(install-pre-commit.sh:36 checks build-harness-manifest, not the connector check), not in release.sh,
not in doctor.cjs; the exhaustive test runs only inside run-all-1441.sh with no master caller. 172:
(1) land the gate as warn+report; (2) wire --check into pre-commit + release.sh + doctor --acceptance;
(3) flip to hard-FAIL once the baseline is wired/excluded so CI never goes RED mid-sweep. Pattern =
port IaC drift-detection to CI (no off-the-shelf capability-coverage linter exists as of 2026).

## New architectural decisions (from the dual-graph / fractal / memory / ICM research)

### D-172-f (LOCKED — collapse to one brain, navigator 2026-06-22) — /mos:act gets ONE governed SELECTION authority
/mos:act is a SECOND ungoverned invocation brain: no connector block (dark to decide()/dispatchSensors),
and act --chain passes decideFn:()=>null (plans its own chain off recommendFrameworkChain instead of the
spine's decide()). RESOLUTION = COLLAPSE TO ONE BRAIN (SPEC INV-18): (1) add a connector block to act.md
(keep autonomous_safe:false — the spine OFFERS it, the navigator confirms); (2) feed the REAL
navigation-engine decide() as act's decideFn (drop `()=>null` at scripts/act-command.cjs:219) so the
chain's per-step next-reach comes from the SAME spine the rest of Mindrian uses; (3) classify act --swarm
+ /mos:pipeline WIRE-or-EXCLUDE under the gate; (4) the RETRO-07 gate asserts act/pipeline/ignite each
wired-or-excluded. 166 runChain already gave act ONE governed EXECUTION loop; this closes the SELECTION
gap so there is one selection authority everywhere. (Navigator rejected the "recorded exception" option.)

### D-172-j (LOCKED — navigator 2026-06-22) — /mos:act is an ALWAYS-ON standing suggestion (additive)
Distinct from D-172-f (which makes act spine-GOVERNED), this makes act always-PRESENT. Larry ALWAYS
surfaces /mos:act in the suggest-next / dial host as a PINNED additive option — first OR last — that
NEVER displaces the MAX_K=3 ranked context-reaches and is NOT a 7th reach (frozen DIAL_REACH_K=6 /
MAX_K=3 untouched; act is a standing suggestion to invoke a command, not a reach_id). It renders a
JTBD-contextualized blurb from the active JTBD (/mos:jtbd state) + STATE.md + MINTO.md: in THIS specific
case it states WHAT /mos:act would do, WHAT it helps with, and HOW (which framework/chain + why). The
blurb is LOCAL-derived (Part 8: enum/scalar + local state only; no Brain egress). Implementation: a
pinned additive row in the suggest-next/dial renderer + a JTBD-blurb generator reading the active JTBD
+ STATE/MINTO; act.md serves_jtbd carries the per-state framing. See SPEC INV-19.

### D-172-k (LOCKED — navigator 2026-06-22) — /mos:act renders on the canonical Shape F.1 host
The pinned act standing suggestion (D-172-j) AND act's own option gate use the shipped Shape F.1
renderer (lib/hmi/shape-f1-renderer.cjs) with the FROZEN F.1 keyboard contract — UP/DOWN option
navigation + SIDE toggle of the toggleable archetype components (lib/hmi/reach-component-map.json).
act's current bespoke body_shape:E `yes/pick another/cancel` prose prompt (act.md:192-196) is replaced
by / unified onto the F.1 host (Phase-148 "suggest surfaces unify onto the F.1 host"). Rendered via the
AskUserQuestion Shape F.1 primitive — never a hand-rolled selector. Frozen F.1 keyboard contract +
MAX_K=3 + DIAL_REACH_K=6 untouched. See SPEC INV-20.

### D-172-l (LOCKED — navigator 2026-06-22) — /mos:act has an internal discuss/calibration phase
Before act selects or executes anything, it runs a short INTENT-CALIBRATION step — a lightweight
internal discuss phase (reusing the discuss-phase pattern + the Shape F.1 gate) that aligns with the
navigator's actual intent (what they want act to do in this room state, scope, constraints, definition
of done) BEFORE routing through the F.1 selector -> decide() -> runChain. act never acts on a presumed
intent; it confirms first, then acts (Part 3 Decision Gate + Part 10 + the post-gate runChain handoff:
calibrate -> approve -> auto-run autonomous_safe prefix -> halt at first material step). Calibration
reads LOCAL state only (JTBD + STATE + MINTO); no Brain egress; the intent is journaled via
navigation.cjs (Part 9) so the run is auditable. See SPEC INV-21.

The act surface (D-172-f/j/k/l + INV-18..21) now composes a coherent shape: act is spine-GOVERNED
(one brain), always-SUGGESTED (JTBD-contextualized standing row), F.1-RENDERED (up/down + side toggle),
and intent-CALIBRATED (internal discuss before it acts) — the autonomous engine made governed, present,
legible, and safe.

### D-172-m (LOCKED — navigator 2026-06-22) — every future phase declares its CIRS relationship
CIRS is self-propagating (R12 / INV-22): every FUTURE phase that adds/modifies/removes an invocable
surface OR consumes the invocation spine MUST declare and explain how it USES and/or is USED BY this
phase's ruling system — a `cirs_relationship:` frontmatter block (surfaces_added / surfaces_modified /
surfaces_removed / spine_consumed / gate_impact) + prose. A phase touching a surface without a
conformant declaration is gate-FAILED (R2). Recorded via a CIRS column in docs/CANON-PHASE-MAP.md,
mirroring the canon_parts forward-compatibility rule. 172 ships the declaration contract + the map
column + the gate hook. No future phase can silently change the invocation surface without
understanding, declaring, and explaining its relationship to the moat.

### D-172-g (LOCKED principle) — Dual-graph = control-plane / data-plane, projection is a CQRS read-model
The remote orchestration projection (data/brain-orchestration-projection.json, SHIPPED via Phase 157,
220 nodes incl. 192 methodology_tier, 101 command counterparts) is the CONTROL plane (capabilities,
routing, policy); the local room.db is the DATA plane. Invariant: policy flows down, user data NEVER
flows up (Part 8 = T-Box/A-Box federation; Solid-pod "no data leaks up"). The local capability view is
a DERIVED, non-authoritative CQRS materialized view — carry 3 markers (source version, per-room
checkpoint, freshness budget), invalidate-by-version, rebuild lazily, consume LOCAL-ONLY at
decide/rank time (INV-12). Continuous remote SYNC = Phase 137 (NOT built) — OUT of 172.

### D-172-h (LOCKED principle) — Fractal/nested coverage rides ONE scale-invariant rollup over NESTED_WITHIN
Coverage + chain monitoring (INV-09) must respect the nested-room fractal (Simon near-decomposability;
NESTED_WITHIN room-lineage edge, Phase 169). Engineer ONE scale-invariant rollup(room) operator applied
recursively up NESTED_WITHIN, precomputing a per-room Aggregate-Vertex summary node per level
(GraphRAG hierarchical-Leiden pattern), normalized by subtree size, with LCA query routing (LeanRAG)
and a depth-3 recursion cap (= Simon's OOM cutoff = the SEED-022 depth-3 memory contract). Cross-room
boundary signals travel ONLY as aggregates. This is the substrate SEED-022 (fractal memory) + SEED-034
/ Phase 169 (graph-derivation) already began; 172 monitors coverage across it, it does not rebuild it.

### D-172-i (LOCKED principle) — Memory contract aligns with Part 9 + bi-temporal SOTA
Keep the proposed→confirmed HITL truth gate (Part 9 role 5) as a HARD gate — external research shows
it is the documented defense against memory-poisoning and that most managed systems skip it (a
differentiator). Sharpen toward 4-timestamp bi-temporal edges (add transaction/provenance time beside
valid_from/valid_until) and keep the typed-packet boundary as the single Brain egress (AMP/MemPrivacy
"typed > untyped" — type must survive the boundary). These sharpenings are RECORDED here as Part-9
alignment notes; the load-bearing 172 work is invocation coverage, not a memory-schema rewrite.

## Reconciliation work owned by 172 (INV-11)
- 170 (SHIPPED, release-held): sensor-diffusion-adoption.cjs gains a CONTEXT branch keyed on
  tuple.problem_type via navigation.cjs; KEYWORD demoted to fallback; analyze-timing connector added
  to the gate. No canon amendment.
- 171 (SHIPPED, no phase dir): methodology-ingest step-5 ("trigger + chain") rewritten as a THIN CALLER
  of INV-02/03/10 — every ingested methodology born with a connector block + passes the gate at ingest,
  context-triggered by default. Step-2 Part-8 audit untouched.
- Release rule: 170 + 171 do NOT release until they conform to this contract; 172 is the release-gate.

## Canonical refs (MANDATORY — full paths)
- docs/MINDRIAN-CANON.md (Parts 2,3,4,6,7,8,9,10; Appendix D entries 19 [Brain dual-role + methodology_tier], 23 [NESTED_WITHIN])
- docs/CANON-PHASE-MAP.md (Phase 172 row; Phase 157 / 166 / 169 / 170 rows)
- docs/CONNECTOR-CONTRACT.md (the 11 connector sub-keys; the frozen 6 reaches + 3 postures)
- docs/ORCHESTRATION-PROJECTION-CONTRACT.md (the projection schema + --check)
- .planning/phases/172-contextual-invocation-coverage/172-SPEC.md (INV-01..12 — LOCKED, read before planning)
- .planning/seeds/SEED-024-brain-as-orchestration-graph-framework-tiers.md (172 executes this)
- .planning/seeds/SEED-009-learned-ranker-weights-from-outcome-edges.md (the deferred learned-weights home)
- .planning/seeds/SEED-022-icm-fractal-memory-contract.md (the fractal/nested-memory adjacency; precond SEED-004)
- .planning/seeds/SEED-030-rs-pipeline-spine-and-expert-graph-reconciliation.md (the rs-* family)
- .planning/seeds/SEED-034-graph-derivation-harness.md + Phase 169 (NESTED_WITHIN rollup substrate)
- .planning/research/2026-05-16-dual-graph-architectural-proposal.md (the ALREADY-DECIDED dual-graph adjudication)
- .planning/research/2026-06-18-orchestration-executor-dual-graph-conversation.md (Phase 166 runChain context)
- arXiv 2603.16021 (ICM — verify external; fix acronym to "Interpretable Context Methodology")

## Code context (reusable assets — file:line)
- scripts/build-connector-registry.cjs (generator + --check; :319-322 connects_to_spine filter; :632-647 WARN nudge to flip)
- scripts/build-orchestration-projection.cjs (:733-840 validateProjection; :824 UN-RANKED early-continue to INVERT)
- data/connector-registry.json, data/command-registry.json (curated_chains:[] to populate), data/brain-orchestration-projection.json
- lib/core/insight-sensors.cjs dispatchSensors (the 9-sensor spine), lib/core/sensors/sensor-types.cjs (frozen 6 reaches / 3 postures)
- lib/core/navigation-engine.cjs decide() (:596) + reachIdToSkillFamily (add `hats` case)
- lib/core/chain-executor.cjs runChain (SHIPPED — INV-08 consumes it), scripts/act-command.cjs:166-224 (act rides runChain, decideFn:()=>null at :219)
- lib/core/methodology-ingest.cjs ingestPlan step-5 (rewrite as thin caller), commands/ingest-methodology.md
- lib/core/brain-derivation.cjs:322-353 + brain-derivation-prompts.cjs:251-258 (the confidence-dropping Pinecone search)
- scripts/hooks/pre-commit + install-pre-commit.sh:36 + release.sh + scripts/doctor.cjs (wire the gate into all four)

## Deferred (NOT 172)
- Continuous remote Brain sync of the projection (Phase 137, not built).
- Usage-derived / learned ranker weights (SEED-009; cohort ≥30, outcome edges ≥1000).
- Cross-room invocation intelligence (separate product, separate legal review — Part 8).
- The SEED-022 fractal-memory birth-defect fixes (depth-3 recursive reconciler, umbilical v2, DRIFT.md)
  beyond what coverage-monitoring needs — its own phase; precondition SEED-004.
</discussion_outcome>
