---
phase: 164
slug: bono-research-debate-engine
milestone: v1.14.0
status: queued
canon_parts: [2, 3, 4, 8, 9]
depends_on: [163, 130]
created: 2026-06-17
---

# Phase 164 - BONO Research-Debate Engine (cognitive capstone)

## One-line

The cognitive capstone of the v1.14.0 lens work: sits on top of the domain-graph-citizen substrate (Phase 163) and the cognitive lens family (Phase 130) and adds the net-new part - a per-(subdomain x hat) research fan-out whose readings are consolidated as a structured ARGUMENT between the hats over a graph-proposed "what if" hypothesis, with every pipeline step filed to the room AND embedded into the local graph.

## Why this is a phase (Canon Part 2)

Canon Part 2 already defines the shape: Engine 1 (Act 1 decomposition) feeds Engine 2 (BONO Orchestration); a team member is `Hat (cognitive stance) + Name (main domain) + Surname (sub-domain)`. The navigator requirement dated 2026-06-17 makes `domain/subdomain/focus_area` first-class typed graph citizens (owned by Phase 163). This phase is the consumer that turns that substrate into a researched, adversarial hat debate - making `/mos:bono` (already named in the Phase 163 roadmap entry as the harness-as-code reference impl) a real surface.

## Reuse-before-build (Canon Part 7)

CONSUMES, does not fork:
- **Phase 163** domain/subdomain/focus_area first-class typed nodes + `lib/core/navigation/typed-domain.cjs` writer + `getDomainsForTrendExtrapolation` reader pattern (the domain lens family in `lib/core/lens-engine.cjs`, `reserved_for: 'v1.14.0'`).
- **Phase 130** cognitive lens family (`lens-engine.cjs` cognitive family, 4 clients incl. `think-hats` / `persona` / `hat-briefing` / `challenge-assumptions`) migrated to room.db typed nodes via `navigation.cjs`.
- **Engine 1** decomposition commands: `/mos:explore-domains`, `/mos:whitespace`, `/mos:find-bottlenecks`, `/mos:find-connections`, `/mos:find-analogies`, `/mos:score-innovation`.
- **navigation.cjs** chokepoint for ALL local-graph read/write (Part 9).
- **harness-as-code 9-property architecture** (recon -> foundation -> surfaces -> verify; contracts-on-disk; exclusive file ownership; adversarial structured verdict; rules-in-prompt; resumable; orchestrator-in-loop).

NET-NEW only (~15-20%):
1. Per-(subdomain x hat) **cell research fan-out** as a Workflow harness (cell agent returns `{stance, evidence, confidence}` from web + local-graph-read + Brain-generic).
2. **Inter-hat DEBATE consolidation** over a graph-proposed "what if" hypothesis (the navigator confirms/edits the hypothesis) -> ruling + residual tension, with an adversarial verify pass.
3. **Incremental filing contract:** every pipeline step files an artifact to the room AND embeds its analysis into the local graph via `navigation.cjs` BEFORE the next step (crash-resumable, queryable per step).
4. **Synthetic experts as reusable graph citizens:** high-value team members are FILED as `SyntheticExpert` typed nodes (promoting the existing `room/team/personas/` `.md` files to queryable nodes) and RE-INVOKED as hats in future BONO runs. Mint at the Decision Gate (human confirms which experts to keep, Part 9 role 5); team assembly queries the expert library first, generates only the gaps. ROOM-LOCAL in this phase; cross-room reuse is a deferred Part-8-gated amendment. See `164-SYNTHETIC-EXPERTS.md`.

## Surfaces (provisional - finalized in plan-phase)

- `commands/bono.md` (`/mos:bono`) - the front door; Shape F selector for scope/purpose/substrates/hypothesis (Part 3).
- engine logic in the cognitive/domain lens families (reuse `lens-engine.cjs`; no parallel skill if avoidable).
- the cell-fan-out + debate Workflow (harness-as-code), launched by the command.
- `agents/persona-analyst.md` upgrade to the cell agent + debate consolidator (add research + graph-read tools).
- `commands/think-hats.md` + `commands/persona.md` footer routing into `/mos:bono`.

## Canon boundaries (hard)

- **Part 8/9:** all writes LOCAL via `navigation.cjs`; Brain is generic-methodology READ-ONLY (`brain_search`/`brain_query` with framework names + problem-type enums only). ZERO user-content egress. Typed Brain packet only.
- **Part 4:** consolidated tensions/rulings file as typed edges from the FROZEN allow-list (reuse ARGUED_BY-equivalent via existing edge types; any new edge type is a canon amendment, NOT a command-level invention).
- **Part 3:** the hypothesis-confirm and scope selector route through the tri-context Decision Gate via a Shape F sub-shape (AskUserQuestion primitive). No bespoke dialog.
- **No emoji, no em-dashes;** 12-glyph UI vocab + 4-zone anatomy.
- **Tri-polar:** CLI (dial-TUI selector + Workflow), Desktop/Cowork (structured-prompt fallback, no TUI).

## Design input

`.planning/research/2026-06-17-bono-research-debate-engine-scoping.md` (this session). NOTE: an earlier spike implementation (branch `bono-spike-stale-baseline` in the dev clone) was built on a 2239-commit-stale base and is REFERENCE-ONLY, NOT mergeable - its cited APIs are outdated. Re-implement against current main.

## Substrate update (post-166/167, navigator-LOCKED 2026-06-18)

This CONTEXT pre-dated Phases 166 (gated-chain-executor) + 167 (harness-as-code completion), both
now SHIPPED. 164 RIDES that runtime instead of building its own. The harness-as-code 9 properties are
satisfied BY the shared runtime, NOT re-implemented here (Part 7). Revised decisions:

- **D-164-S1: the inter-hat DEBATE consolidation rides `runChain` (Phase 166), not a bespoke Workflow
  harness.** The sequential debate chain (hypothesis -> per-hat argument -> ruling -> residual tension)
  is a `runChain` step sequence: `postureFn` from the manifest, `gateFn` halts at the
  hypothesis-confirm + ruling Decision Gates (Part 3), `onStep` dispatches the cell/consolidator agent,
  `provenanceFn` stamps each step artifact. NO new loop runtime.
- **D-164-S2: the per-(subdomain x hat) CELL fan-out is PARALLEL, not a runChain sequence.** runChain is
  a sequential gated loop; the cell fan-out is N independent cells. OPEN for research/plan: dispatch the
  cells via the existing parallel pattern (act-swarm / parallel agent dispatch) and FEED their
  `{stance, evidence, confidence}` results into the sequential `runChain` debate consolidation. Do NOT
  force the parallel fan-out through the sequential loop.
- **D-164-S3: the cell + debate chains carry fable-mode self-critique (Phase 167 HARN-02).** Each cell's
  `{stance, evidence, confidence}` self-critiques (verify + critique) before it folds into the debate,
  so one bad cell reading cannot propagate into the ruling. This is exactly the multi-step
  garbage-propagation case the 167 research flagged 164/165 as needing from birth.
- **D-164-S4: `/mos:bono` (and any new cell/consolidator agent) is scaffolded via `/mos:new-surface`
  (Phase 167 HARN-03).** Its connector block + manifest landing are GENERATED, not hand-written; the
  surface lands transitively across the three maps with `--check` proof. Pin `reach_id` to a frozen
  reach + `sub_mode`, never a 7th reach.
- **D-164-S5: incremental filing (net-new #3) uses the `pipeline-state.cjs` journal (Phase 166
  D-166-02, the sole chain-state truth).** Each pipeline step is journaled before the next so a crashed
  run resumes from the cursor without re-running completed cells.

Net effect: 164's net-new shrinks further (it inherits the loop, the gate, the generator, fable-mode,
the journal); the genuinely net-new is the cell-fan-out-to-debate composition, the GENESIS expert
breakdown, the issue-tree engine, and the SyntheticExpert citizens. The substrate is plumbing 164
calls, not plumbing 164 writes.

## Next

`/gsd-plan-phase 164` (research-then-plan; RESEARCH.md to be produced -- 164 is design-doc-dense:
GENESIS-TRANSLATION, ISSUE-TREE, SYNTHETIC-EXPERTS, EXPERT-LIFECYCLE + reference/). Depends on 163
(done) + 130 + now 166 + 167 (all done).
