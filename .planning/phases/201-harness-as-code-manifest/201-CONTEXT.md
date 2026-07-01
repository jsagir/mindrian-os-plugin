# Phase 201 - Harness-as-Code Manifest + Ralph-Loop Runtime (harness-as-code-manifest)

**Registered:** 2026-07-01 | **Class:** CODE + ARCH | **Priority:** P1 (THE INTEGRATIVE SPINE)
**Planned:** 2026-07-01 (cluster plan-only pass; no execution)

## Depends on

- Phase 166 (runChain / chain-executor.cjs) - SHIPPED
- Phase 167-01 (harness-manifest generator + reader) - SHIPPED (the manifest already exists)
- Phase 187 (statusline cockpit) - SHIPPED
- Phases 141/143/144 (LarryReach dial + navigation-engine) - SHIPPED
- Phase 191 (brain_ask / DirectiveEnvelope orchestration) - SHIPPED

Unblocks (with Phase 202): 205-09 (Plurai eval suite), `blocked_until: 201 + 202`.

## Goal

Name, version, and machine-enforce the agent harness that already runs under
MindrianOS as ONE declared manifest (SEED-032), and add the two Ralph-loop runtime
behaviors it should carry (SEED-033): L1 bounded verify-retry INSIDE autonomous_safe
steps, and L2 a propose -> fact-check -> refine loop that lets the graph self-correct.
The harness is Model + everything-around-it; today that "everything" is four hand-rolled
loops (runChain, the Workflow layer, the reach dial, the statusline). This phase declares
them as one rerunnable harness and closes the two convergence-loop gaps - without adding a
new framework (Canon Part 7: declare what exists).

## Grounding sources (recon 2026-07-01, file:line verified)

- **Manifest ALREADY EXISTS:** `data/harness-manifest.json` (3-map digest: posture -> command-registry, wiring -> connector-registry, ranked_next_reach -> brain-orchestration-projection); generator `scripts/build-harness-manifest.cjs` (Phase 167-01, read layer over the three maps, LOCAL only); reader `lib/core/recipe-maps.cjs` (`loadManifest()` `:347`, `postureForCommand` `:170`, `wiringForReach` `:199`, `rankedNextReach` `:232`).
- **runChain:** `lib/core/chain-executor.cjs:374` (`runChain(steps, opts)` -> `{trace, completed, haltedAt}`); gate `makeGateFn` `:272-341`; EXEC-06 budget brake `:425-429`; self-critique seam `:258-265` (runs on material steps, adds NO retry/loop - "the verdict is a gate INPUT, never a convergence stop condition"); resilient/journal path `_runChainResilient` `:604+`; retry substrate `lib/core/chain-retry.cjs`.
- **Workflow layer:** `lib/workflow/command-resolver.cjs` (`composeWorkflow`, `validateChainAutonomy`); fan-out consumers `lib/workflow/f8-fanout-consumer.cjs` etc.; spec `.planning/WORKFLOW-LAYER-SPEC.md`.
- **Navigation spine:** `lib/core/navigation.cjs` (closed 13-fn chokepoint); `lib/core/navigation-engine.cjs` `decide(turn, context)` `:810`, `dispatchSensors -> decide -> resolveFireSkill` `:581`.
- **Statusline cockpit:** `lib/statusline/cockpit-renderer.cjs` (4-tier, LOCAL, no Brain).
- **Brain orchestration:** `lib/core/directive-envelope.cjs` (`DEFAULT_MODE='GUIDED'` `:22`, `selectMode` `:38`); `lib/mcp/brain-router.cjs` (`brainRoute` `:269`).
- Seeds: `.planning/seeds/SEED-032-harness-as-code.md`, `.planning/seeds/SEED-033-ralph-loop-lessons.md`.

## Scope

### (1) Extend the harness manifest to declare the FULL harness

Today `data/harness-manifest.json` declares three DATA maps. SEED-032's framing is
Agent = Model + Harness, and a harness has four parts (orchestration, context+routing,
governance, convergence). Extend the manifest to also DECLARE the runtime surfaces as
versioned, digested entries: the runChain spine (chain-executor.cjs), the navigation
decide() engine, the statusline cockpit renderer, and the brain-orchestration reader.
Each declared with `{ role, path, digest(sha256), source_count|version }`. Regenerate via
the existing `scripts/build-harness-manifest.cjs` (extend it, do not fork it); `--check`
tripwire stays green. This makes the harness inspectable + drift-detectable as code.

### (2) SEED-033 L1 - bounded verify-retry inside autonomous_safe steps

Today a failed self-critique on a material step HALTS (correct). The Ralph lesson: for
`autonomous_safe` steps ONLY, run a BOUNDED verify -> feedback -> retry-until-pass loop
BEFORE the step can reach a gate. Add a capped retry loop in chain-executor.cjs that
fires only on autonomous_safe steps, bounded by the EXEC-06 token/step budget, never
unbounded, and NEVER on material steps (Canon Part 3 B3 stays intact: material steps halt).
Ralph inside the safe steps; gates at the material ones.

### (3) SEED-033 L2 - self-improving graph (propose -> fact-check -> refine)

A Ralph-style propose -> fact-check -> refine loop over the LOCAL room.db (or the
orchestration projection), all through the navigation.cjs chokepoint (Part 9). Agents
propose graph enrichments (typed edges), a fact-check pass verifies against existing
provenance, and only verified writes land - the moat deepening itself. LOCAL only; no
Brain writes (Part 8). Bounded (never an infinite refine loop).

### (4) Eval GATE (Plurai, reuse 196 pattern)

One judge for verify-retry / fact-check loop behavior: does the loop converge and halt
correctly (retry-until-pass on safe steps, halt-at-material, verified-writes-only)?
Synthetic CSV -> offline baseline -> local parity, per 196. No phase closes without it.

## Open decisions (surfaced for review)

- **D-201-1 (manifest depth):** declare the runtime surfaces as digest-only entries
  (RECOMMENDED - keeps the manifest a read/descriptor layer, D-166-03 preserved) vs a
  richer per-surface schema. Recommend digest-only to avoid turning the descriptor into a
  second orchestration brain (Canon Part 11: one governed path).
- **D-201-2 (L2 locus):** run the self-improving graph loop over the LOCAL room.db
  (RECOMMENDED, Part 8/9 clean) vs the orchestration projection (data/*.json, more moat
  but a generated artifact). Recommend LOCAL room.db first; projection is a later phase.
- **D-201-3 (L1 retry cap):** default retry cap (RECOMMENDED: 2 retries, EXEC-06-budget-bounded)
  - confirm the cap and that it draws from the same token budget, never a separate one.

## Non-goals

- Replacing or rewriting runChain / the Workflow layer / the dial (Part 7: DECLARE what exists).
- Any Brain write from the L2 loop (Part 8: LOCAL only).
- The APO lab loop (Phase 202) - 201 is the spine 202 rides.

## Canon

Part 7 (declare the harness that exists; add no framework), Part 11 (one governed path;
the manifest is a descriptor, not a second selector), Part 3 (L1 halts at material gates;
B3 intact), Part 9 (L2 writes through navigation.cjs), Part 8 (L2 LOCAL only). No em-dashes.

## Plans

- [ ] 201-01-PLAN.md (wave 1) - Extend harness-manifest to declare the runtime surfaces (runChain, decide, cockpit, brain-orchestration) with digests; regenerate + --check
- [ ] 201-02-PLAN.md (wave 2) - SEED-033 L1: bounded verify-retry inside autonomous_safe steps (chain-executor.cjs), EXEC-06-bounded, material steps untouched
- [ ] 201-03-PLAN.md (wave 2) - SEED-033 L2: propose -> fact-check -> refine self-improving graph loop, LOCAL via navigation.cjs
- [ ] 201-04-PLAN.md (wave 3) - Plurai eval gate: verify-retry / fact-check loop-behavior judge

## Next

`/gsd-plan-phase 201` to expand into task-level plans, or execute 201-01 first
(the declaration; lowest risk, makes the harness inspectable before the runtime changes).
