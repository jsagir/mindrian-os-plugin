---
phase: 150
slug: memory-cortex-as-graph-members-local-and-brain-queryable-when-reaching
status: scoped (v1.14.0; navigator-directed 2026-06-09)
priority: P1 -- the substrate the LarryReach selector + "what's next" actually need; makes the website's memory/graph claims true
created: 2026-06-09
milestone: v1.14.0
sequencing: "Belongs to the LarryReach + selector cluster (140-148), NOT the 133-136 consumer cluster. Sequence as the SUBSTRATE under Phase 148: the dial reads the memory cortex through getRoomContext, so this lands before the consumer phases and ahead of Phase 138. It is the user-memory twin of Phase 149 (149 bridged DEV .planning/ docs; this bridges the USER memory cortex)."
origin: "5-agent utilization audit 2026-06-09 (FEYNMAN/BRAIN/STATE+USER/ROOM+MINTO/the MD<->room.db bridge). Verdict: 0 of 6 per-folder memory MD files are graph members; Phase 149 gave the DEV planning docs the bridge the USER memory files never got. The navigator's directive: 'this needs to be the real 149 -- the md files we built never get used; they have to be relevant on the graph and queryable by local AND remote when reaching.'"
canon_parts:
  - Part 9 (Memory Locality -- THE phase: finally honors "the USER-FACING memory files are the ones that should be richly graph-navigable"; SQL remembers and navigates)
  - Part 8 (Graph Boundary -- REMOTE queryability is the typed-packet contract ONLY; zero raw content egress; mirrors 149 GAM-04/06)
  - Part 3 (Tri-Context Decision Gate -- the projected cortex feeds LOCAL context at every gate; the selector is graph-driven)
  - Part 2 (Team Around the Navigator -- the reaches arm the navigator using the cortex; persona node feeds team composition)
  - Part 6 (Dog-fooding -- corrects the 149 inversion: the plugin must navigate the NAVIGATOR's memory as well as its own dev docs)
  - Part 7 (Reuse -- repoint the 149 planning-artifact writer + reconcile spine, the 143.3 connector spine, getRoomContext + the navigation chokepoint; do NOT rebuild)
  - Part 10 (Conversation as Product -- the website claims are the acceptance bar)
depends_on:
  - Phase 149 gsd-planning-artifacts-as-local-graph-members (THE pattern to mirror: writePlanningArtifactNode + reconcile-runner + lineage edges + PostToolUse hook + typed Brain packet -- repoint for the 6 memory files)
  - Phase 109 sql-context-memory-navigation-spine (lib/core/navigation.cjs -- the only door; all node/edge writes route here)
  - Phase 110 brain-context-packet-contract (the typed-packet wire for REMOTE queryability, Part 8)
  - Phase 141 local-retrieval-spine + capability-dial (getRoomContext / room-context.cjs -- the dial's room.db reach that must surface the cortex)
  - Phase 143.3 connector-spine-and-intelligence-orchestrator (connector: frontmatter + connector-registry.json + dispatchSensors -- the spine the cortex reaches hang off)
  - Phase 144 navigation-engine-legacy-engine-flip (decide() -- the "what's next" consumer that must read the cortex from the graph, not flat files)
  - Phase 148 larryreach-selector-re-wire (the selector + reach-component-map toggleable archetypes to make graph-driven)
  - Phase 90 brain-derivation-layer (BRAIN.md derivation -- its 9 sections become the projected priors)
  - Phase 124 feynman-temporal-awareness (FEYNMAN.md timeline -- the write-only sink to close the read-back loop on)
brain_impact: TYPED-PACKET-ONLY (REMOTE queryability carries generic handles -- governing-thought sha256, problem-type/complexity/persona enums, framework-name handles, gap/stage scalars; NEVER raw memory prose. Adversarial zero-egress test required, mirroring 149 test-149-brain-egress.cjs. Canon Part 8 absolute.)
hotfix_discipline: NO (net-new substrate + cross-cutting selector rewire)
estimated_days: 6-9
---

# Phase 150: Memory Cortex as Graph Members (Local + Brain-queryable when reaching)

> The REAL 149. Phase 149 bridged the developer's `.planning/` docs into the graph. This bridges the NAVIGATOR's memory cortex -- the six per-folder memory MD files the whole product is built on. Navigator-directed 2026-06-09.

## Goal

Make every per-folder memory markdown file (ROOM.md, STATE.md, MINTO.md, BRAIN.md, FEYNMAN.md, USER.md) a first-class GRAPH MEMBER in `room.db` via the `navigation.cjs` chokepoint, and make the projected cortex QUERYABLE BY BOTH LOCAL AND REMOTE WHEN REACHING -- so that when the LarryReach dial fires a reach (and when "what's next" computes a next move), it navigates the navigator's own memory through the local graph and can ask the remote Brain about it via the typed-packet contract (generic handles only, zero raw egress). The selector's reach ranking AND its toggleable archetype components become graph-driven. Every orphan the audit found is closed. This makes the website's memory/graph/next-move claims actually true.

## The problem (5-agent utilization audit, 2026-06-09)

The audit verdict was unanimous and evidence-backed: **0 of the 6 per-folder memory MD files are graph members.** They are read flat off disk via `lib/core/folder-memory.cjs` and never projected into `room.db`. Consequences:

- **FEYNMAN.md is write-only.** 2 writers (timeline-runner + dial-memory-runner), 0 genuine consumers. Not in `readTriple`/`readQuadruple`. Every would-be reader reaches PAST the file to the SQL source. The seed-writer `discover.md:170` claims doesn't exist, so fresh rooms get no auto-section at all.
- **BRAIN.md: 9 sections, only 4 affect any decision.** The dial uses ONE bit (presence -> mode). `SECTION_WEIGHTS` is imported DEAD (no weighted scorer exists). `brainAnchors` has a consumer but NO producer. `confidence_baseline` parsed, read by nobody. (Correction to an earlier claim: the dial's 40% `brain_confidence` comes from the room.db Brain packet, NOT BRAIN.md directly -- BRAIN.md is even less wired to the selector than assumed.)
- **STATE.md sensors built then starved.** `sensor-lagging-component` (gaps) and `sensor-gate-approach` (stage) are built and ABSTAINING because nobody populates `lowFillSections`/`venture_stage` in the decide() context.
- **USER.md greeting-only.** `journey_stage` parsed + taxonomy-validated, then ZERO ranking/sensor reads (Canon Part 2a half-wired). The new `hats` cache builds 6 default hats with NO USER.md read.
- **ROOM.md over-enforced, unread.** `identity_text` reaches 3 display sites, no router/selector/sensor. The `room` leg of the triple is a near-total dead read.
- **MINTO.md: governing thought used as a presence-gate + hash.** The MECE pyramid (evidence_density, mece_status, flagged_weaknesses) collapses to one display scalar. Claims never reified as nodes.
- **Two disconnected stores joined only by the folder slug.** The human MD substrate and the room.db graph (claims/events) never talk. `getRoomContext` -- the dial's whole "walk the room graph" reach -- sees in-content claims + events, and NONE of the memory-file content.
- **The dev/user inversion (headline).** Phase 149 built a complete bridge (writer + reconcile + lineage + hook) for the DEV `.planning/` docs. `grep memory_artifact` returns nothing for the USER memory files. The plugin navigates its own SPECs better than the navigator's governing thought. This inverts Part 9's intent.
- **Decision double-ledger drift.** Decisions live in MINTO frontmatter + `decisions_index` table + (promised, never shipped) graph `decision` nodes. `room-home` queries decision nodes nothing creates -> silent empty set. The selector writes `f_selector_decision` to `memory_event`; STATE.md `## Decisions` stays "(none yet)"; the JTBD recency that feeds the ranker reads that empty ledger.

## The acceptance bar: the website must really work (navigator directive)

The canonical sites (mindrian-explanation.vercel.app, mindrian-getting-started.vercel.app) PROMISE a product the audit proves does not yet function. These claims become falsifiable acceptance tests:

| Website claim (verbatim) | What this phase must make true |
|--------------------------|--------------------------------|
| "Larry reads what is there and picks up where you left off" | The memory cortex (incl. FEYNMAN timeline) is read back from the graph into the next-move + greeting, not write-only |
| "It suggests a next move -- grounded in what your workspace actually contains" | The selector + decide() rank reaches off the PROJECTED cortex (gaps, governing thought, Brain priors, persona), via getRoomContext |
| "Knowledge graph -- which findings contradict each other... structural parallels" | Governing-thought + Brain-derivation + decisions are navigable graph nodes, so contradiction/parallel detection can reach them |
| "The Brain can surface relevant patterns... cross-reference through a knowledge graph" | REMOTE queryability: a typed Brain packet projects the cortex as generic handles when reaching |
| "Every claim, every decision, every piece of evidence is indexed" | Close the decision double-ledger: project decisions to graph nodes (the Phase 108/109 promised promotion) |
| "The Brain never sees your project content" | PRESERVE: remote = typed packets only, zero raw egress (Part 8 absolute; adversarial test) |

## LOCKED decisions (navigator, 2026-06-09 AskUserQuestion + directives)

- **D-01 Scope = full cortex.** All 6 memory MD files projected in this phase (not staged).
- **D-02 Coupling = graph-driven.** The dial's reach ranking AND the reach-component-map toggleable archetypes are driven by the projected memory graph via getRoomContext. Retire the flat-file `roomState` side-channels (demote to fallback only where a frozen-148 contract requires it). "Perfectly utilized + togglable graph based."
- **D-03 Close all orphans.** Same phase wires the starved sensor ctx (lowFillSections/venture_stage), the `brainAnchors` producer, a real `SECTION_WEIGHTS` scorer (or deletes it), and the decision double-ledger projection.
- **D-04 Queryable LOCAL and REMOTE when reaching.** Local = getRoomContext/navigation.cjs surfaces the cortex nodes; Remote = a typed Brain packet of generic handles. Both fire on a reach.
- **D-05 Spine-connected.** The memory-cortex reach(es) declare `connector:` frontmatter, register in `connector-registry.json`, and are dispatchable by the Phase 143.3 intelligence-orchestrator.
- **D-06 Sequencing.** LarryReach/selector cluster (140-148), substrate under 148, ahead of Phase 138 + the 133-136 consumers. NOT folded into 148 (its own phase, like 149 was).
- **D-07 The website is the bar.** The claims table above are falsifiable acceptance tests; the phase is not done until they function.
- **D-08 The 148/150 render unlock (load-bearing -- understanding pass 2026-06-09).** `decide()` fires live on every prompt, but `buildReachList` -> `dial-presenter` have ZERO production callers: the engine decides the one next move and the navigator NEVER SEES it. 150 + 148 must together wire `buildReachList` -> `dial-presenter` into the live response surface so the grounded next-move is actually PRESENTED. 148 built the UI machinery; 150 grounds it AND surfaces it. This is claim C2's unlock.
- **D-09 The claim harness is the acceptance gate.** Phase 150 ships against a `tests/claim-harness/` (7 falsifiable claim drivers C1..C7 over a real fixture room.db, no mocked Brain) that asserts each public site claim FUNCTIONS. Ship RED; each `claim-cN` turns GREEN as the bridge delivers. The semantic-quality claims (C2 "is it good", C4 "relevance") are carved out to the Part-10 human empathy gate, not faked.
- **D-10 The vision frame (navigator).** 150 + 148 are the one phase-pair that unlocks Mindrian by proving it in its own structure (Part 6): ICM = structure (the graph the cortex joins), PWS = structured thinking (the reaches), Mondrian = creativity within constraints (the frozen rails + the moving-M splash -- breakthrough comes from the constraint), a liquid ever-changing structure organized through the one navigation chokepoint, thinking big and small at once (the ONE next move grounded in the WHOLE room).

## The mechanism (mostly REPOINT -- Canon Part 7)

Mirror Phase 149's four pieces, repointed from `.planning/` dev docs to the 6 memory files:

1. **`memory_artifact` node writer** beside `lib/core/navigation/planning-artifacts.cjs` -- `writeMemoryArtifactNode(db, {section, kind, path, hash})`, kinds {ROOM, STATE, MINTO, BRAIN, FEYNMAN, USER}, plus richer typed nodes where the content warrants: a `governing_thought` node (from MINTO), a `navigator_persona` node (from USER role_blend x journey_stage), and the long-promised `decision` node projection (from decisions_index/decision_log -- the Phase 108/109 EXTEND that never shipped a writer). All via the navigation chokepoint; system-bookkeeping carve-out applies (created_by=system), so no Part-9 role-5 issue.
2. **Idempotent reconcile spine** -- `reconcileMemoryArtifacts(roomDir)` walks the room's section folders (reuse `section-registry.cjs` discovery), classifies by filename, upserts on stable ids. Mirrors `reconcile-runner.cjs`.
3. **Typed lineage edges** -- governing_thought STATES section; MECE claims SUPPORT governing_thought; decisions INFORM section; persona DESCRIBES room; BRAIN-derivation INFORMS section. Reuse the ALLOWED_EDGE_TYPES additive idiom.
4. **Hybrid trigger** -- a PostToolUse hook on `*/{ROOM,STATE,MINTO,BRAIN,FEYNMAN,USER}.md` (the user-memory twin of `gsd-artifact-graph-hook.cjs`) + a session-start reconcile slot for Desktop/Cowork (tri-polar). Best-effort, never blocks.

Then the consumption side (the "perfectly utilized" half):

5. **LOCAL queryable when reaching** -- extend `getRoomContext` (room-context.cjs) so its neighborhood/legs surface the new cortex nodes; the dial + decide() read the cortex from the graph.
6. **REMOTE queryable when reaching** -- a typed memory-cortex Brain packet (generic handles: governing-thought sha256, problem-type/complexity/persona enums, framework-name handles, gap/stage scalars). Adversarial zero-egress test (mirror test-149-brain-egress.cjs + the 9-tripwire pattern). Part 8 absolute.
7. **Selector graph-driven** -- the dial's `reachScores` priors AND the reach-component-map archetype routing are fed from the projected cortex via getRoomContext; wire `buildReachList` to a live session; retire the side-channels.
8. **Close the orphans** -- populate sensor ctx from the STATE projection; wire the `brainAnchors` producer from the BRAIN-derivation nodes; implement-or-delete `SECTION_WEIGHTS`; ship the decision-node projection so the double-ledger collapses to one graph-authoritative source.
9. **FEYNMAN read-back** -- add FEYNMAN.md to the read contract (readQuintuple or fold), ship the missing seed-writer (`discover.md:170` promise), and project the human-authored body freshness + the stale-flag rows as typed graph signals so the timeline stops being a dead-end sink.

## Scope

- The `memory_artifact` writer + the richer typed nodes (governing_thought / navigator_persona / decision) + the reconcile spine + lineage edges + the hybrid trigger.
- LOCAL queryability: getRoomContext surfaces the cortex; the dial + decide() read it.
- REMOTE queryability: the typed memory-cortex Brain packet + adversarial zero-egress test.
- Spine connection: connector: frontmatter + connector-registry registration + orchestrator dispatch.
- The 148 selector made graph-driven (ranking + toggleable archetypes); buildReachList wired live.
- The 4 orphan closures (sensor ctx, brainAnchors producer, SECTION_WEIGHTS, decision double-ledger).
- The FEYNMAN read-back + seed-writer.
- A run-all-150.sh aggregator + the Part-8 grep sweep.

## Out of scope (LOCKED)

- Anything that changes the frozen 148 selector contracts (MAX_K=3, the 0.70/0.15 gate, DIAL_REACH_K=6). The selector becomes graph-FED, not re-architected.
- Re-deriving BRAIN.md (Phase 90 owns derivation; this phase PROJECTS the existing BRAIN.md, it does not change how it is computed).
- Any raw-content egress to the Brain. Remote = generic handles only, no exceptions (Part 8).
- The 133-136 consumer phases (unrelated).

## Acceptance criteria (draft -- refine at /gsd:plan-phase 150)

- [ ] All 6 memory MD files are projected into room.db as typed nodes via navigation.cjs; reconcile is idempotent (re-run upserts, no dup); a PostToolUse hook + session-start slot fire it (tri-polar)
- [ ] getRoomContext surfaces the cortex nodes; the dial + decide() rank reaches off the PROJECTED cortex (gaps, governing thought, Brain priors, persona)
- [ ] A typed memory-cortex Brain packet exists; the adversarial test proves zero raw memory prose reaches any Brain packet (Part 8)
- [ ] The memory-cortex reach(es) are spine-connected (connector-registry + orchestrator dispatch)
- [ ] The 148 selector is graph-driven: reach ranking + reach-component-map toggleable archetypes read the cortex from the graph; buildReachList has a live caller; side-channels retired/demoted
- [ ] Orphans closed: sensor ctx populated (the 2 dead sensors fire), brainAnchors producer wired, SECTION_WEIGHTS implemented-or-deleted, decisions projected to graph nodes (double-ledger collapsed)
- [ ] FEYNMAN.md read-back: in the read contract + seed-writer shipped + timeline no longer a write-only sink
- [ ] The 148/150 render unlock: buildReachList -> dial-presenter is wired into the live response so the navigator SEES the grounded next-move (claim C2 render arm passes)
- [ ] The claim harness ships: tests/claim-harness/ with C1..C7 drivers over a real fixture room.db (no mocked Brain), run-all-claims.sh + optional doctor --claims; each claim green as the bridge delivers; semantic claims carved out to the human gate
- [ ] The website claims table functions end-to-end (each row a falsifiable test)
- [ ] run-all-150.sh green; no em-dashes

## Cross-references

- **150-UNDERSTANDING.md** (this dir) -- the pre-planning understanding pass: the 140-148 reuse-seam map, the connector-spine plug-in shape, the dual-graph remote-query shape + the 4 substrate caveats, the full claim-harness design, and the vision frame. READ BEFORE PLANNING.
- 5-agent utilization audit, 2026-06-09 (this transcript) -- the grounding; capture as a findings doc if not already
- Phase 149 (the DEV-doc bridge this mirrors): lib/core/navigation/planning-artifacts.cjs, lib/core/planning/reconcile-runner.cjs, scripts/gsd-artifact-graph-hook.cjs, tests/test-149-brain-egress.cjs
- Phase 109 navigation chokepoint (lib/core/navigation.cjs); Phase 110 Brain packet contract
- Phase 141 getRoomContext (lib/core/navigation/room-context.cjs); Phase 148 selector (lib/hmi/dial-reach-orchestrator.cjs, reach-component-map.json, f-selector-ranker.cjs)
- Phase 143.3 connector spine (data/connector-registry.json, skills/intelligence-orchestrator); Phase 144 decide() (lib/core/navigation-engine.cjs)
- The flat-read contract being replaced: lib/core/folder-memory.cjs (readTriple/readQuadruple), lib/core/folder-memory-shared.cjs
- Website bar: mindrian-explanation.vercel.app, mindrian-getting-started.vercel.app
