---
kind: research
phase: 164
slug: bono-research-debate-engine
milestone: v1.14.0
created: 2026-06-18
canon_parts: [2, 3, 4, 7, 8, 9]
source: "4-lens fan-out 2026-06-18 (GENESIS pipeline, issue-tree engine, synthetic experts, runChain-riding integration)"
consumed_by: Phase 164 plan-phase
depends_on: [163, 130, 166, 167]
note: "surfaced TWO navigator-gated canon amendments + one Part-4 prose-vs-code drift -- see Section E"
---

# Phase 164 Research: BONO research-debate engine on the 166/167 substrate

4-lens synthesis. 164 RIDES the shipped runtime (runChain 166, manifest+fable-mode+generator 167) and
adds the cell->debate composition, the GENESIS expert breakdown, the issue-tree engine, and the
SyntheticExpert citizens. All findings cite file:line.

## A. Integration shape (the load-bearing finding)

runChain is SEQUENTIAL-ONLY (`chain-executor.cjs:343-458` single for-loop; async path same `:538-707`).
So the per-(subdomain x hat) CELL fan-out CANNOT be a runChain sequence. The shape is TWO STAGES:
1. **Parallel cell fan-out** via the swarm pattern (`act.md:381` act --swarm / parallel agent dispatch):
   N independent `(subdomain x hat)` cells, each returns `{stance, evidence, confidence}`.
2. **Sequential debate runChain**: hypothesis-confirm gate -> per-hat argument steps -> ruling gate ->
   residual tension, over the COLLECTED cell results. `postureFn` from the manifest (167),
   `gateFn` halts at hypothesis-confirm + ruling Decision Gates (Part 3), `onStep` dispatches the
   consolidator (the slotted SyntheticExpert IS the onStep target), `provenanceFn` stamps each step.
Fable-mode is TWO-LAYERED: each cell self-critiques its `{stance,evidence,confidence}` pre-collection
(swarm side); the debate runChain additionally carries `selfCritiqueFn` on material steps
(`chain-executor.cjs:176-200,280-283`). Incremental filing rides the `_runChainResilient` journal +
`pipeline-state.cjs:148-190` (D-164-S5; crash-resume from cursor). `/mos:bono` + any cell/consolidator
agent scaffolded via `/mos:new-surface` (`build-new-surface.cjs:80-82,148-160`), pinned to a frozen
reach_id + `bono` sub_mode (never a 7th reach).

## B. GENESIS expert pipeline -> the cell agent
The GENESIS 6-module breakdown (`reference/genesis/MindrianGenesisPipeline.js:15-26`) is the expert
generator: a persona becomes the `(subdomain x hat)` cell sub-agent returning
`{stance, evidence, confidence}` (`164-GENESIS-TRANSLATION.md:73`). Expert lifecycle (generate / mint /
re-invoke / stale / retire) in `164-EXPERT-LIFECYCLE.md` + `164-SYNTHETIC-EXPERTS.md`. reference/genesis
is runnable but reference-only as written; the cell-relevant module ports into lib/, the rest is called
or adapted. Five GENESIS-vs-substrate conflicts flagged (it assumes its own loop; reconcile to ride
runChain for the sequential parts, swarm for the parallel cells).

## C. Issue-tree engine
The diagnostic ("why") issue-tree is the deliverable of TWO GENESIS hats -- White (Data Analyst) +
Black (Risk Assessor) -- the backward-looking causal sibling to 163's forward trend tree
(`164-ISSUE-TREE.md:11,46,70`). `reference/issue-tree/MindrianIssueTree.js` is RUNNABLE/portable (zero
deps, no Math.random): validateMECE (`:38-66`), validateFalsifiability (`:71-83`), renderMarkdown
(`:86-104`), toGraphEdges (`:108-132`). It is a SINGLE deterministic engine call (`:135-150`) -- it does
NOT loop, so it does NOT ride runChain (runChain carries the debate; the issue-tree is a deterministic
build). It ships as a SECOND sub_mode of `/mos:diagnose` (`sub_mode: issue-tree` alongside
problem-diagnosis; same reach_id context_block / framework / fileEvidenceWithReadback /
[SENS-01,SENS-06]; `commands/diagnose.md:19-31`, `164-ISSUE-TREE.md:21-35`), sourcing its key question
from the ignite-born governing problem in `problem-definition/`. The sub_mode connector lands via
`/mos:new-surface` (transitive across the three maps).

## D. Synthetic experts
SyntheticExpert = a NEW typed node promoting `room/team/personas/` .md files (written today by
`persona-ops.cjs:445-452`, no graph node) into queryable, rankable, re-invokable handles carrying
GENERIC-lens metadata only (hat/name/surname/archetype/beautiful_question/method/evidence_tier/
invocation_count/review_status/provenance; `164-SYNTHETIC-EXPERTS.md:23-34`). Mint-at-Decision-Gate
(rank by contribution -> Shape F gate -> APPROVE promotes proposed->confirmed via
`confirm-node.cjs:39-43`, Part 9 role 5). Library-first assembly: query confirmed experts per
(hat,subdomain), generate only the gaps. ROOM-LOCAL this phase; cross-room reuse deferred (Part-8-gated;
a cross-room expert must be a generic lens with zero venture content). persona-analyst.md (today
Read/Write/Glob only, NO Brain -- `:6-24`) upgrades to the cell agent (needs hat-scoped web + local-graph
read + Brain-generic) + the debate consolidator; the connector/manifest wiring is GENERATED via
/mos:new-surface (D-164-S4), not hand-written. Node-type precedent: `typed-domain.cjs:55-157`
(DOMAIN_NODE_TYPES frozen Set + writeDomainNode chokepoint, minted by Phase 163).

## E. BLOCKING canon flags (navigator-gated, resolve in plan-phase Wave 1, like 163-01)

### E1. SyntheticExpert NODE-TYPE addition (canon amendment)
SyntheticExpert is NOT in the Phase 108 frozen node taxonomy; adding it is a navigator-gated additive
amendment (`aliases.yml` node_aliases + TRUTH-STATES), mirroring the 163/150.8 frozen-set moves
(Appendix D entries 18/21). Likely also a `TRUTH_CLAIM_TYPES` extension (`transitions.cjs:28`, currently
{claim,CausalClaim,assumption,decision,opportunity}) because experts are human-confirm-gated (Part 9
role 5). Mirror the `typed-domain.cjs` pattern: a frozen node-type Set + a `writeSyntheticExpertNode`
chokepoint. NO new EDGE type needed for experts (reuses AFFILIATED_WITH/STATES/SUPPORTS/INSTANTIATES,
all in the frozen set); a `STAFFED_AS` edge would be a separate amendment -- AVOID.

### E2. Issue-tree edge reconciliation (canon amendment) -- AND a verified Part-4 prose-vs-code drift
VERIFIED 2026-06-18 against live code: the Part 9 chokepoint frozen set
(`navigation/edges.cjs` ALLOWED_EDGE_TYPES, what `writeEdge` validates) contains INFORMS + ROOT_CAUSES
but NOT INVALIDATES, ENABLES, CONVERGES, or BELONGS_TO. A SEPARATE older path
(`lazygraph-ops.cjs:26` EDGE_TYPES) DOES contain them (the Phase 84 cascade path). So Canon Part 4 PROSE
("INVALIDATES/ENABLES/CONVERGES shipped") + the Phase 84 map row are true for the OLD lazygraph path but
those types were NEVER migrated into the Part 9 frozen set. CONSEQUENCE for 164: the issue-tree edge
remap (INVALIDATED->INVALIDATES; RESOLVES_VIA->ROOT_CAUSES + ENABLES; BELONGS_TO) CANNOT route
INVALIDATES/ENABLES/BELONGS_TO through the Part 9 writeEdge chokepoint as-is -- they would be rejected.
Only INFORMS + ROOT_CAUSES are safe today. RESOLUTION OPTIONS (navigator, plan-phase):
- (a) RECONCILIATION amendment: add INVALIDATES + ENABLES (+ BELONGS_TO) to the edges.cjs frozen set,
  reconciling the canon prose + the old lazygraph path into the Part 9 chokepoint. This is cleaner than
  163's amendment (the canon already blesses these in prose; this honors it in code). RECOMMENDED.
- (b) remap the issue-tree edges onto existing frozen members only (INFORMS + ROOT_CAUSES), dropping
  INVALIDATES/ENABLES distinctions -- lossy.
The drift is bigger than 164 (a Part 4 integrity issue); 164 is just the phase that surfaces it.

## F. Reuse-vs-build split
REUSE: runChain debate (166), swarm cell fan-out (act --swarm), fable-mode selfCritiqueFn (167),
pipeline-state journal (166), /mos:new-surface (167), recipe-maps/manifest (166/167), confirm-node
(129.5), typed-domain node-type pattern (163), MindrianIssueTree.js (port to lib/), GENESIS cell module
(port). NET-NEW: the cell->debate composition orchestrator (swarm-out -> runChain-in seam), the cell
agent + debate consolidator (persona-analyst upgrade), the hypothesis-confirm + ruling gates, the
SyntheticExpert node-type + writer + library-first assembly, the issue-tree sub_mode wiring, and the
TWO canon amendments (E1, E2).

## G. Proposed wave shape (planner refines)
- W1 FOUNDATION (canon gates, navigator-ratified like 163-01): E1 SyntheticExpert node-type amendment
  (+ TRUTH_CLAIM_TYPES) + E2 edge reconciliation (INVALIDATES/ENABLES/BELONGS_TO into edges.cjs) +
  floor tests. ONE atomic lockstep, navigator-gated.
- W2 the SyntheticExpert writer + library-first assembly (writeSyntheticExpertNode chokepoint, mint-at-gate).
- W3 the issue-tree engine port to lib/ + the /mos:diagnose issue-tree sub_mode (via /mos:new-surface).
- W4 the cell agent (persona-analyst upgrade, scaffolded) + the parallel cell fan-out.
- W5 the debate runChain composition (swarm-out -> runChain-in seam, hypothesis-confirm + ruling gates,
  fable-mode two-layered, journal filing) + /mos:bono front door (scaffolded).
- W6 adversarial verify + run-all-164.sh gate.

## H. Open questions for plan-phase
- E1/E2 amendment exact membership + whether BELONGS_TO is needed or remappable.
- Cell agent: new generated agent vs in-place persona-analyst upgrade (D-164-S4 mandates generated wiring either way).
- The swarm-out -> runChain-in seam: where the collected cells are handed to the debate (a new lib/core composition module?).
- Whether the issue-tree (single deterministic call) and the BONO debate (runChain) are one /mos:bono surface or two (diagnose sub_mode + bono).
