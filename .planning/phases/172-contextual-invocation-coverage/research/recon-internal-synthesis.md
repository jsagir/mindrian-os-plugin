# Phase 172 — Internal Recon Synthesis

> Consolidated from 8 internal recon streams (2026-06-22). Companion files:
> `recon-connector-spine.md`, `recon-remote-projection.md`, `EXTERNAL-RESEARCH.md`.

## A. Surface inventory (the INV-01 denominator)

- **124 invocable surfaces**: 101 commands + 14 skills + 9 agents.
- Connector registry: **62 entries** (55 command + 7 agent + **0 skill**), **0 marked excluded**.
- Coverage today: **54 wired / 8 half-wired / ~38 dark** commands. Skills are 0% wired despite the
  generator walking `skills/*/SKILL.md`. The `hats` reach is sensor-dark AND engine-unmapped
  (`reachIdToSkillFamily` has no `hats` case).
- The 8 half-wired (framework declared, no `connector:`): `causal`, `diagnostics`, `hat-briefing`,
  `persona`, `rs-experts`, `rs-explain`, `rs-fetch`, `rs-thesis`. (`validate-proposition` does NOT
  exist as a file — the CONTEXT baseline's "9th" is phantom.)

## B. The regression root cause (why coverage keeps reopening)

Two defects, both verified on disk:
1. **The nudge is WARN-only.** `scripts/build-connector-registry.cjs:632-647` emits a stderr
   "opt-in nudge" for a framework-command lacking a `connector:` block — **never `exit 1`**. Only the
   STALE byte-compare hard-fails (`:614-629`).
2. **The hard gate is ORPHANED from CI.** `build-connector-registry --check` is NOT in pre-commit
   (`install-pre-commit.sh:36` checks `build-harness-manifest.cjs`, not the connector check), NOT in
   `release.sh`, NOT in `doctor.cjs`. The exhaustive gate `tests/test-connector-exhaustive-coverage.cjs`
   is invoked ONLY by `run-all-1441.sh:48` — a chain with no master CI / release / `doctor --acceptance`
   caller. So a new dark surface trips nothing automatic.
→ **INV-10 = flip WARN→FAIL AND wire the gate into pre-commit + release + doctor --acceptance.**
   Roll out warn+report first, flip once the baseline is wired/excluded so CI never goes RED mid-sweep.

## C. /mos:act — the second, ungoverned invocation brain

- `/mos:act` has **no `connector:` block** → absent from `data/connector-registry.json` →
  `decide()` / `dispatchSensors` CANNOT trigger/chain/monitor it. It is DARK. `autonomous_safe: false`
  (correct — it's a meta-orchestrator).
- `act --chain` ALREADY rides the Phase 166 `runChain` spine (`scripts/act-command.cjs:166-224`,
  delegating to `lib/core/chain-executor.cjs runChain`) — it was the donor. BUT it passes
  **`decideFn: () => null`** (`act-command.cjs:219`): it PLANS a precomposed chain from
  `recommendFrameworkChain` instead of using the spine's live `decide()`. So there are **two selection
  brains**: spine (`dispatchSensors → decide() → connector-registry`) vs act (`brain_ask` single /
  `recommendFrameworkChain` chain → `composeWorkflow`).
- `act --swarm` (`act.md:311-433`) is a THIRD path — parallel framework-runner dispatch, bypasses both
  `decide()` and `runChain`.
- Sibling orchestrators: `/mos:ignite` is WIRED (`ignite.md:21` connector block); `/mos:pipeline` is
  DARK like act.
→ **172 must give act ONE governed SELECTION authority** (166 already gave it ONE governed EXECUTION
  loop): (1) add a `connector:` block so the spine can surface "run /mos:act" as a reach (keep
  `autonomous_safe:false`); (2) reconcile next-step authority — either feed the real `decide()` as
  act's `decideFn`, or canonize act's precomposed-chain planning as a sanctioned exception (the code
  asserts the exception but no registry/canon artifact records it); (3) classify `--swarm` WIRE or
  EXCLUDE; (4) the RETRO-07 gate asserts act/pipeline/ignite each wired-or-excluded.

## D. suggest-next + LarryReach — INV-08 (chains)

- Chain confidence is **ABSENT end-to-end in production** (neither earned nor placeholder-uniform):
  the Brain Neo4j graph genuinely carries `r.confidence` on FEEDS_INTO, but the BRAIN.md derivation
  (`lib/core/brain-derivation.cjs:322-353`) runs a **Pinecone semantic search**
  (`brain-derivation-prompts.cjs:251-258`) and `renderRecords` extracts only the framework NAME,
  dropping confidence → BRAIN.md emits bare `A FEEDS_INTO B` → `parseFrameworkChainSection` assigns
  `confidence: null` → suppressed under NOISE_FLOOR=0.5.
- The orchestration-projection chain layer is SOURCE-EMPTY (`curated_chains: []`), carries no
  confidence field, and isn't read by suggest-next.
- The f-selector ranker weights (`lib/workflow/f-selector-ranker.cjs:47-52`, 0.40/0.30/0.30) are
  HARDCODED (the 2026-05-16 dual-graph proposal already flagged this as the un-learned debt).
→ **INV-08 fix (Local-Only):** populate `data/command-registry.json curated_chains` with
  curated-confidence FEEDS_INTO edges; regenerate `brain-orchestration-projection.json`; wire
  suggest-next to rank off the projection. Optionally switch the BRAIN.md derivation from Pinecone
  `search` to a structured edge fetch so `r.confidence` survives. Learned weights = DEFERRED to
  **SEED-009** (trigger: cohort ≥30 testers AND outcome edges ≥1000).

## E. Future phases + 170/171 reconciliation

- **166 gated-chain-executor: SHIPPED** (`lib/core/chain-executor.cjs`, 8 plans). `runChain` does
  invoke→capture→pass→loop, re-calls `decide()` per iteration, auto-runs `autonomous_safe`, halts at
  material steps via the Part-3 gate. NOT a blocker for INV-08 — 172 consumes it. (SPEC frontmatter
  `status: scoped` is stale.)
- **170 dual-use-diffusion-ace: SHIPPED, release ON HOLD** (branch `phase-170-171-ace-diffusion-pipeline`).
  SENS-09 `sensor-diffusion-adoption.cjs` fires keyword/marker/signal → frozen `brain_consult`.
  **Reconciliation:** add a CONTEXT branch keyed on `tuple.problem_type` (already in hand, only
  decorates evidence today) read via `navigation.cjs`; demote KEYWORD to fallback tier; add ACE's
  `analyze-timing` connector to the RETRO-07 gate. No canon amendment (reuses `brain_consult`).
- **171 methodology-ingest: SHIPPED, NO phase dir** (`lib/core/methodology-ingest.cjs` +
  `commands/ingest-methodology.md`, same commit `36683430`). **Reconciliation:** step-5 ("trigger +
  chain") is a hand-wiring checklist today — rewrite it as a THIN CALLER of 172's INV-02/03/10 so
  every future methodology is born with a `connector:` block + passes the coverage gate at ingest
  time, context-triggered by default. Step-2 Part-8 audit untouched.
- **Ordering:** the navigator-locked v1.14.0 order (163→166→168→164→165) is ALL SHIPPED; 172 is the
  next foundational phase and GATES the held 170/171 release (INV-11). No conflict — 172 adds a
  release-gate ahead of the held branch.

## F. Seeds 172 discharges or depends on

- **SEED-024 (brain-as-orchestration-graph + framework tiers)** — 172 IS the execution of this seed's
  INV-04/05/06 (OPERATES edges, `methodology_tier`, continuous sync). 157 already shipped the
  projection + tiers; 172 completes the dark-command counterpart wiring + the gate. Continuous remote
  SYNC = **Phase 137** (not built) — OUT of 172 (INV-12 keeps 172 LOCAL-only).
- **SEED-009 (learned ranker weights from outcome edges)** — the deferred home for INV-08's
  usage-derived confidences (curated for v1; trigger cohort ≥30, edges ≥1000).
- **SEED-022 (ICM fractal memory contract)** — the fractal/nested axis: recursive depth-3 memory
  reconciliation, umbilical v2, born-wired birth, DRIFT.md. Adjacent — 172's LOCAL graph must respect
  the nested room structure (`NESTED_WITHIN`, depth-3) when it monitors coverage across nested rooms.
  Precondition SEED-004 (nested-room write-scope bug).
- **SEED-034 (graph-derivation-harness) / Phase 169** — shipped the `NESTED_WITHIN` room-lineage edge
  + rollup walk; the substrate 172's nested-room coverage monitoring rides.
- **SEED-030 (rs-pipeline spine + expert-graph reconciliation)** — the rs-* family 172 wires first.
- **2026-05-16 dual-graph proposal (decided)** — already adjudicated: 70% shipped, REJECT the heavy
  DGEKT framing, ship 2 primitives (FOLLOWS_FROM edge, local-chain-recommender), defer learned weights
  to SEED-009. 172 does NOT re-litigate dual-graph architecture; it tightens the gate + wires
  counterparts on the shipped spine.
