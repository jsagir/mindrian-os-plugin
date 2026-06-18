---
kind: research
phase: 167
slug: harness-manifest-and-surface-generator
milestone: v1.14.0
created: 2026-06-18
canon_parts: [2, 3, 4, 6, 7, 8, 9, 10]
source: "4-agent fan-out 2026-06-18 -- past (144.1, 157) + future (164, 165) relevance + build substrate"
realizes_seed: SEED-032
consumed_by: Phase 167 plan-phase
---

# Phase 167 Research: how past (144.1, 157) and future (164, 165) shape the harness-as-code completion

Synthesis of a 4-lens fan-out. 167 = a declared harness MANIFEST (read-layer over the three maps)
+ fable-mode step discipline + a /mos:new-surface generator. All findings cite file:line.

## A. PAST relevance

### A1. Phase 144.1 (connector-retrofit-sweep) -- ORTHOGONAL, supplies machinery
- STATUS: SHIPPED 2026-06-07, 8/8 plans (ROADMAP.md:2138, :2402). Built the 53-connector registry (46 cmds + 7 agents), the generator's agents/-walk (`build-connector-registry.cjs:71,245-290`), and the 114-surface coverage gate (`data/connector-out-of-spine-allowlist.json` 61 keys + `tests/test-connector-exhaustive-coverage.cjs`; 53 wired + 61 allowlisted = 114 disk-derived).
- VERDICT: NOT a prerequisite, NOT absorbed, NOT superseded. 167 does not need every surface wired first (167-SPEC.md:88-90 defers bulk backfill). The coupling is the generator PATTERN, not coverage state.
- REUSE: `/mos:new-surface` (HARN-03) continues 144.1's generator line -- reuse the agents-walk source-discovery (`build-connector-registry.cjs:245-290`, already enumerates commands+skills+agents) and the `--check` tripwire verbatim. The 114-gate stays a connector-only CI tripwire; it does NOT become the manifest coverage contract (HARN-03 --check is per-entry well-formedness).
- HYGIENE follow-up (not 167 scope): close the stale `144.1/DRIFT.md:15` W007 finding (now false) and remove the empty duplicate `144.1/` dir shadowing `144.1-connector-retrofit-sweep/`.

### A2. Phase 157 (brain-orchestration-graph) -- the TEMPLATE + the boundary
- 167's manifest generator (HARN-01) and `/mos:new-surface --check` (HARN-03) MIRROR `scripts/build-orchestration-projection.cjs`: `listSourceFiles()` deterministic walk -> `buildProjection()` (:550) -> `serializeProjection()` (:693, byte-stable JSON+\n) -> `--check` byte-compare (`runCheck` :849) -> categorized failure array (`validateProjection` :750 -> {stale, unwired, unranked}). 167's --check emits its own named failure modes ("entry landed + well-formed").
- The manifest is DISTINCT from the 157 projection: the projection is ONE of three backing maps (ranked next-reach); the manifest is the unified READ LAYER over all three, must NOT merge/retire them (167-SPEC.md:50-53, honoring D-166-03).
- `methodology_tier` carries INTO the manifest as its Part-8 legibility keeper. The manifest inherits the SAME Part 8 boundary (Canon Part 8 "Brain dual role" + Appendix D entry 19): generic machinery metadata only; a build-time boundary scan over the manifest + generator (mirror `tests/test-orchestration-projection-part8-boundary.cjs` planted-secret tripwire); LOCAL derived artifact, no new Brain wire; Part 9 routes via navigation.cjs.
- 167 picks up the CONTROL-PLANE/legibility half (unify the read into a declared manifest; make wiring generatable). It does NOT pick up live nav-engine consumption (deferred with 157) or live Brain write/sync (Phase 137). `rankedNextReach` stays CONTRACT-ONLY (recipe-maps.cjs:36-43); the runtime still selects via decide().

## B. FUTURE relevance

### B1. Phases 164 (bono) + 165 (unknown-unknowns) -- argue for 167 FIRST
- Both INTRODUCE NEW SURFACES with hand-written connector wiring: 164 ships /mos:bono + a /mos:diagnose sub_mode + a connector block + per-(subdomain x hat) fan-out; 165 wires /mos:file-meeting onto the connector spine + new sensor conditions + chain-feeder FEEDS_INTO edges + the 2x2-quadrant chain topology. Both now declared to RIDE the Phase 166 runChain spine.
- They consume the runChain spine (166); the 167 manifest is a CONVENIENCE for them, not a hard dependency.
- VERDICT (the load-bearing future finding): sequence 167 BEFORE 164/165. No hard dependency either way, but 167-first (a) converts their hand-written connector wiring into generated, --check-gated wiring (HARN-03) -- so /mos:new-surface scaffolds their surfaces instead of hand-wiring; and (b) gives their MULTI-STEP research/debate/bandit chains fable-mode discipline (HARN-02) from birth, where step-to-step garbage-propagation is a real risk, instead of retroactive backfill.
- This REVISITS the prior locked order (163 -> 166 -> 164 -> 165). 167-before-164/165 is the reuse-optimal slot. See the open decision below.

## C. BUILD SUBSTRATE (grounding the three requirements)

### C1. SEED-032 required capabilities (verbatim, lines 61-69)
(1) a declared harness MANIFEST naming orchestration steps + context-routing policy + governing check-* gates + convergence rules; (2) ONE idempotent harness runner; (3) the check-* gates re-expressed as declared composable policy entries; (4) connector spine + nav engine + Workflow runtime referenced BY the manifest, not duplicated. Open questions: manifest format (YAML/JSON vs CJS DSL); manifest-in-projection vs purely local; the idempotence "converged room" fixture. NOTE: SEED-032 line 30 convergence ("loop until tests pass") is REJECTED for the executor by 166 B3 -- HARN-02 self-critique must gate-HALT, never auto-retry-to-convergence.

### C2. The generator + --check idiom to mirror
Shared skeleton (both `build-connector-registry.cjs:594-662` and `build-orchestration-projection.cjs:849-863`): deterministic sorted walk -> build -> serialize (JSON.stringify+\n, byte-stable) -> 3-branch main (write / --check / refresh); --check asserts byte-equality (STALE) + a domain validation array, exit-1 + a stderr recovery line. connector --check: frozen-6 reach + frozen-3 posture + WFL-01 resolver + tuple-collision. projection --check: STALE / UN-WIRED / UN-RANKED. ENFORCEMENT GAP to decide: connector + projection --checks run via test aggregators (run-all-1433.sh, run-all-1441.sh), NOT the live pre-commit (which guards command-registry at `.git/hooks/pre-commit:144-145` + brain-packet-schema :160-161). 167 must decide where the manifest --check is enforced.

### C3. recipe-maps: WRAP, do not become
`lib/core/recipe-maps.cjs` (166 W1) is the live read-layer over the three maps, layered not merged (lines 8-12): `postureForCommand` (:144, command-registry via validateChainAutonomy), `wiringForReach` (:173, connector-registry), `rankedNextReach` (:206, projection, contract-only). DECISION: the manifest WRAPS recipe-maps -- the manifest is the declared/versioned descriptor naming the three sources as one entry; recipe-maps stays the executable live join (must NOT be retired, D-166-03). Cleanest: recipe-maps gains a `loadManifest()`/`manifest()` accessor returning the declared three-map binding.

### C4. fable-mode (HARN-02) hook point
`lib/core/chain-executor.cjs` `makeGateFn` (:185-207) is the EXEC-03 gate; it already halts on `priorOutput.quality === LOW_QUALITY` (:195). Quality enum from `framework-runner.md:121-136` FRAMEWORK_RUNNER_RESULT (+ Step-3 quality gate :69-77). HARN-02 inserts a verify+self-critique step BETWEEN onStep return (:359-361) and the `previousOutput` assignment (:389): a `selfCritiqueFn(step, result)` whose verdict augments `result.quality`, feeding the existing LOW_QUALITY halt path so a failed self-critique maps autonomous_safe -> halt next hop. NO new loop. CURRENT STATE: there is NO fable-mode skill in skills/ and ZERO `fable` references anywhere; `model-profiles.cjs:18-26` has no fable alias (opus/sonnet/haiku only). fable-mode is net-new naming over the existing quality machinery.

### C5. /mos:new-surface (HARN-03) precedent to extend
NO generic command/surface scaffolder exists. Extend the room scaffold backend: `/mos:ignite` (front door) + `/mos:new-project` (scaffold backend). Both already carry the exact `connector:` frontmatter HARN-03 emits (new-project.md Phase-144.1 block; ignite.md Phase-155.06 block): connects_to_spine, sensor_triggers, reach_id, sub_mode, framework, posture, hierarchy_rank, filing, plan_gated, web_scope. The contract is `docs/CONNECTOR-CONTRACT.md` (11 keys, build-connector-registry.cjs:89-101). HARN-03 = a generator emitting this frontmatter shape with a --check mirroring C2.

### C6. Manifest format recommendation: generated JSON
Recommend `data/harness-manifest.json` produced by `scripts/build-harness-manifest.cjs`, mirroring the C2 generators, with a --check byte-compare + a "three referenced maps resolve" validation. Rationale (CLAUDE.md "What NOT to Use"): no TS DSL (build step breaks edit-surface), no YAML (would add a parser dep or a 2nd hand-rolled parser = drift surface; the repo adds NO new deps), filesystem-is-truth + single-source. Every shipped harness registry is already generated JSON (connector-registry, command-registry, brain-orchestration-projection, brain-packet-schema). Keep it LOCAL (like the 157 projection), NOT folded into the projection.

## D. The one decision this research surfaces
**167's slot in the v1.14.0 order.** The prior lock was 163 -> 166 -> 164 -> 165 with 167 appended. The future-relevance lens (B1) argues 167 should land BEFORE 164/165 so their surfaces are generated (HARN-03) and their multi-step chains get fable-mode (HARN-02) from birth. No hard dependency forces it; it is a reuse-vs-momentum call for the navigator. Proposed revised order: 163 (done) -> 166 (done) -> 167 -> 164 -> 165.

## E. Open questions for plan-phase
- Manifest format JSON (recommended C6) vs CJS -- confirm at discuss.
- Manifest --check enforcement: live pre-commit vs test aggregator vs both (C2 gap).
- fable-mode: hard per-step (every step self-critiques) vs posture-scoped (only material/uncertain) -- the 166 token-cost tradeoff applies.
- recipe-maps accessor shape (loadManifest/manifest) -- C3.
- /mos:new-surface: extend new-project scaffold backend vs standalone generator -- C5.
