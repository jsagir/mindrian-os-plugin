# Design Spec: Systems Thinking as an F-Selector (Human-in-the-Loop)

Status: DRAFT for review (build deferred until approved)
Author: Larry (with Jonathan)
Date: 2026-06-13
Source material: IRIS 2026 Session 2 transcript (`~/MindrianRooms/iris2026/sessions/session-2/transcript.md`) + refs.json
Brain consulted: yes (DirectiveEnvelope returned `next_gate.sub_shape: F.1`, chain options, dial overrides)

---

## 1. Intent and the Reframe

The current `/mos:systems-thinking` is a fixed phase-walk: Phase 1 (map) -> 2 (loops) -> 3 (stocks/flows) -> 4 (leverage). That shape forces a march.

We are promoting it to an **F-surface human-in-the-loop selector**. Every turn, the navigator sits at a dial and is offered *ranked moves*. They pick the lens; the tool executes it; the tool re-ranks and offers the next set. Full systems-thinking abilities are exposed behind the dial, not gated behind a sequence.

Reframe in one line: **not a methodology walk, a move-selector.** The navigator drives; the system ranks.

This is not a new command. We promote the existing command in place. It is already wired for it (see Section 3).

---

## 2. The PWS Anchor (what makes this ours, not generic Meadows)

**Systems thinking is a meta-lens. It qualifies and helps at ANY stage, ANY problem type, ANY case -- not only discovery.** A founder bounding an undefined problem, an operator tracing why a fix keeps failing, an investor stress-testing a flywheel, a team debugging a churn loop after launch -- all run the same five moves, at different stages, against different problem types (UDP / IDP / WDP x Simple / Complex / Wicked). Brain confirms this: it returns `stage: null` for the framework. The selector must be invocable from any room section and must adapt, never assume discovery.

Session 2 happens to teach the causal loop inside a discovery arc, but that is ONE application, not the boundary. Larry's transcript arc:

> wicked problem -> causal loops -> "there is no solving a systems problem, only making it better" -> leverage points -> talk to people -> revise the problem candidate

The PWS discipline that DOES hold at every stage: a generic systems tool ends with a pretty diagram; the **PWS** selector ends with an **actionable handle** -- 

- a **leverage-point hypothesis** (the one small change with the biggest effect), and
- a **next-action target** appropriate to the current stage. In discovery that is "which variable, which people to go validate"; in design it is "which intervention to prototype"; in investment it is "which loop the thesis depends on"; in operations it is "which leverage point to instrument."

**Filing is stage-aware, not fixed.** The artifact files to the ACTIVE room section (the section the navigator invoked from / the current venture stage), not always to problem-definition. The loop exists to locate leverage and produce a stage-appropriate next move. That difference -- diagram vs. actionable handle -- is the whole point, and it is stage-independent.

Transcript anchors to preserve verbatim in voice:
- "Every causal map has two kinds of loops and two only: reinforcing and balancing."
- "Reinforcing is not positive or negative. It just means it gets more and more in the same direction."
- "There is no solving the systems problem. None. All you can do is try to make it a little better."
- "Wherever those leverage points are, are opportunities to make the problem better."
- The storytelling method (fishery stock; the breakfast/frustration loop) as the way to BUILD a loop, not just read one.

---

## 3. Surface and Existing Wiring

The command already carries Phase 143.3 connector frontmatter. We keep it and adjust shape:

```yaml
connector:
  connects_to_spine: true
  sensor_triggers: [SENS-06]
  reach_id: context_block
  sub_mode: systems-thinking-loop   # extend with per-move sub-modes (Section 4)
  framework: "Systems Thinking"
  posture: hold
  hierarchy_rank: 44
  filing: fileEvidenceWithReadback
  plan_gated: false
  web_scope: null
  surface: F.2                       # selector renders at F.2; gate options at F.1 per Brain
```

No collision, no duplicate command. SENS-06 already fires this reach.

---

## 4. The Move Set (the abilities behind the dial)

Five within-systems moves. Each is a selectable state with: trigger, what it produces, the PWS anchor, and a Larry voice line. Each maps to a `sub_mode`.

| ID | Move | sub_mode | Produces | Larry line |
|----|------|----------|----------|------------|
| M1 | Draw / challenge the boundary | `st-boundary` | System boundary statement (included / excluded / why) | "Where you draw the boundary determines what you see. You've drawn it too tight." |
| M2 | Build the causal loop | `st-loop` | A CLD told as a story: reinforcing + balancing loops, signed links | "Every causal map has two kinds of loops and two only." |
| M3 | Name the archetype | `st-archetype` | Matched systems archetype + its question | "You're patching the symptom. What's the side effect of this fix?" |
| M4 | Locate the leverage point | `st-leverage` | One Meadows leverage point + rationale | "A small change in one thing produces big changes in everything." |
| M5 | Route to next action (stage-aware) | `st-act` | A stage-appropriate next move: discovery -> validate variable + who to talk to; design -> intervention to prototype; investment -> loop the thesis rests on; operations -> leverage point to instrument | "Now go act on THIS leverage point." (handoff target depends on stage) |

Cross-framework chains (offered when SENS-06 + room state + Brain confidence warrant; do not crowd the within-moves):

| Chain | Brain confidence | Why (from Brain) |
|-------|------------------|------------------|
| Root Cause Analysis | 0.85 | Feedback loops reveal root-cause candidates |
| Scenario Analysis | 0.80 | Causal loops drive scenario variable selection |
| Six Thinking Hats | 0.70 | Shared problem types and venture stages |

---

## 5. Selector State Machine (guided default)

Default posture: **GUIDED** ("let me think") - per canon and the approved decision.

Loop per turn (drives the three-layer blend in Section 6):
1. **Sense** - read all three layers: Brain flow (Layer 1), local graph state via navigation.cjs (Layer 2), trajectory via memory-ops.cjs (Layer 3), plus the SENS-06 signal.
2. **Rank** - compute `rank(move)` locally (Section 6 formula). Heuristic skeleton:
   - If no boundary in local graph -> M1 ranks first.
   - If boundary set, no loop -> M2 first.
   - If loop exists, no archetype/leverage -> M3 then M4.
   - If leverage located -> M5 first (the payoff), chains second.
   - If memory shows a prior-session leverage point with no validation -> M5 first on return.
   - If local graph holds a contradiction -> flag it in the intelligence strip, do not auto-advance.
   - Chains surface below within-moves, capped at top 1-2 by Brain confidence.
3. **Offer** - render the F.1 gate: top move highlighted, 2-3 alternatives, plus the dial.
4. **Navigator picks** - one move (or a dial override).
5. **Execute** - run that move's sub_mode, one question/observation at a time (lens-at-a-time discipline).
6. **Re-rank** - back to step 1.

Dial overrides (from Brain DirectiveEnvelope `user_override`):
- `just tell me` -> switch to AUTONOMOUS: run remaining moves end-to-end to the leverage point + validation target.
- `let me think` -> stay GUIDED: offer the next single ranked move.
- `stop` -> halt, return control, offer to file what exists.

Terminal condition: M5 produces a validation target -> propose filing (read-back before write, per `filing: fileEvidenceWithReadback`).

---

## 6. Three-Layer Navigation Contract (Brain + Local Graph + Memory)

The selector navigates by blending three sources. Each owns a distinct job. They never blur, and the blend happens **locally** - no room content ever crosses to Brain (Canon Part 8).

### Layer 1 - Brain (global teaching graph, Neo4j): the generic FLOW

Brain answers "what does systems thinking look like in general?" It is the canonical, navigator-agnostic methodology layer. Consumed as a `DirectiveEnvelope` (GUIDED default):
- `directive.guided.framework` -> active lens label ("Causal Loop Diagrams" / "Systems Thinking").
- `next_gate.sub_shape: F.1` -> the gate render shape for move options.
- `next_gate.options[]` (verb, label, framework, confidence) -> the cross-framework chain rows (Root Cause 0.85, Scenario 0.80, Six Hats 0.70), ranked by confidence.
- `user_override` -> the dial semantics (just tell me / let me think / stop).

Brain is re-asked when a move completes, so chain suggestions stay live. Brain provides the **flow and the chains**; it knows nothing about this room. Egress to Brain is generic methodology language only.

**Intra-move flow is graph-native (DECIDED).** The five within-moves (M1-M5) are seeded into Brain as nodes with `PREREQUISITE` and `FEEDS_INTO` edges. The selector traverses these edges to drive intra-move ranking, rather than hardcoding the order. This makes the flow editable in the graph without touching command code. Prerequisite traversal requires raw read (`brain_query`, admin) or a dedicated read endpoint; seeding the edges requires `brain_write` (admin, write-capable key). See Section 9 build plan.

### Layer 2 - Local graph (room SQLite at `room/.room-graph/`): the room STATE

The local per-room graph (SQLite, NOT KuzuDB) answers "what has THIS navigator already mapped?" Read via `lib/core/navigation.cjs`; writes are typed cascade edges (graph-native, per the reverse-salient rule). The selector reads:
- Existing **boundary** statements, **causal loops**, **archetypes**, **leverage points** already filed in this room.
- **Contradictions** - e.g. a balancing loop filed last session that conflicts with a new reinforcing loop.
- **Cross-references** - where a systems node already links to problem-definition or solution-design.

This is what turns a generic flow into navigation: Brain says "next, build a loop"; the local graph says "you already have two loops and an unnamed archetype - name it first."

### Layer 3 - Memory system (room.db, `lib/core/memory-ops.cjs`): the TRAJECTORY

The three memory layers answer "what is the navigator doing right now and what did they do before?"
- **Within-session**: which moves ran this session; prevents re-offering a just-completed move.
- **Across-session**: what the navigator did in prior sessions in THIS room (e.g. "last session you located a leverage point but never routed to validation" -> M5 ranks first on return).
- **Cross-room**: SEALED. Never read into this room's navigation. No leak.

### The blend (where ranking actually happens)

Ranking is computed **locally** by overlaying Layer 1 onto Layers 2 and 3:

```
candidate_moves   = Brain.flow (generic next moves) + Brain.chains (confidence-ranked)
local_state       = navigation.cjs read of room/.room-graph/  (boundary? loops? leverage? contradictions?)
trajectory        = memory-ops.cjs read of room.db            (moves this session + prior sessions)

rank(move) = brain_prior(move)
           - already_done_penalty(move, trajectory)      # don't re-offer completed moves
           + unfinished_thread_boost(move, local_state)   # finish what's mapped but dangling
           + contradiction_flag(move, local_state)        # surface conflicts in the intelligence strip
```

Result: Brain gives the shape of the path; the local graph and memory decide where on that path THIS navigator stands. The dial stays human-in-the-loop throughout.

---

## 7. Render Contract (UI Ruling System, 4 zones)

- **Header**: room name, `/mos:systems-thinking`, venture stage.
- **Body** (`body_shape: methodology`, gate sub-shape F.1): the ranked move list. Glyphs only from the allowed set: `▶` active move, `▷` available move, `├─ └─` tree, `→` chain. No emoji.
- **Intelligence strip** (conditional): SENS-06 signal, archetype detected, contradiction with prior room loops.
- **Action footer** (never omit): the dial line - `▷ let me think  ▷ just tell me  ▷ stop` - plus 2-3 suggested next moves.

Lens-at-a-time discipline is mandatory: one question or one observation per turn. Never dump all five moves as prose. Never lecture systems theory in the abstract; anchor every concept in the navigator's specific problem.

---

## 8. License and Provenance

The agilepainrelief.com `systems-thinking` skill is CC BY-SA 4.0 (share-alike: a copied derivative would force the same license onto our file).

Decision: we take only the **idea** of lens-at-a-time selection (uncopyrightable) and source all content from the **IRIS Session 2 transcript** (our own IP). No prose is copied; no attribution burden; no share-alike obligation attaches. Provenance recorded here for the audit trail.

---

## 9. Build Plan (deferred until this spec is approved)

Recommended shape: **promote the existing command in place** (no new command).
Execution: `/gsd-quick` in an isolated git worktree, launched after the design conversation is locked (per approved sequencing).

**Piece A - Ingest IRIS Session 2 into Brain, ADDITIVELY (admin write required). LOAD-BEARING.**

This is a first-class part of the phase, not a side-seed. Session 2's generic PWS methodology is ingested into the CURRENT Brain graph. The governing invariant:

> **ADDITIVE + DEDUPED + CONNECTED. ZERO ORPHANS.** Every node either merges into an existing node or is created new AND wired by at least one edge to an existing or co-created node. No node lands without an edge. No duplicate of an existing framework/concept.

Steps:
1. **Dedup pass first.** Query the current graph for each Session 2 concept. Brain ALREADY holds: causal loops, leverage points (Meadows), wicked problems, systems thinking, nested hierarchies, Meadows as author. These MERGE -- never create a second "Causal Loop" node. (brain_search confirmed coverage 2026-06-13.)
2. **Add the genuinely-new, each wired on creation.** Weakly/not covered: Cynefin (Snowden), Futures Wheel (Glenn), S-curve + dominant design (Anderson-Tushman), Mullins 7-domains, trending-to-absurd, Rittel-Webber as named authors. Each new `Framework`/`Method`/`Author`/`Book` node is created WITH its edges in the same write (RELATED_TO / AUTHORED_BY / PART_OF the Systems Thinking anchor or Session 2 Lecture node).
3. **Examples are the highest-value, lowest-duplication add.** USS Nautilus, Ely's 1910 carrier takeoff, Benz 1885, the fishery CLD, the breakfast/frustration loop -> `Example`/`CaseStudy` nodes wired via `HAS_EXAMPLE`/`ILLUSTRATES` to their frameworks. An example with no `ILLUSTRATES` edge is an orphan -> rejected.
4. **One `Lecture` node "IRIS 2026 Session 2"** as the teaching anchor; every framework taught in it gets `MENTIONED_IN`/`TEACHES`. This makes the session a navigable unit AND guarantees every ingested node has at least the lecture edge (orphan backstop).
5. **The five move-nodes (M1-M5)** are created here too, as `Method`/`ProcessStep`, with `PREREQUISITE` (M1->M2->M3/M4->M5) and `FEEDS_INTO` (M4->M5) edges, linked to the (deduped) Systems Thinking / Causal Loop Diagrams anchor. These supply the graph-native intra-move flow Piece B traverses.
6. **Orphan-scan gate (acceptance):** after the write, assert `MATCH (n) WHERE n.source_doc = 'iris-2026-session-2' AND NOT (n)--() RETURN count(n)` returns 0. Non-zero = phase fails. Source from the Session 2 transcript only (own IP; CC BY-SA sidestepped).
7. Requires a write-capable `brain_write` key live in the build session. BLOCKS Piece B's flow traversal AND this ingestion if absent.

Canon Part 8 holds throughout: only generic methodology crosses to Brain. Session 2's PWS frameworks ARE generic teaching material; no venture/room/personal content is ingested.

**Piece B - Build the selector:**
5. `commands/systems-thinking.md` - rewrite Session Flow into the selector loop; extend `sub_mode` notes (st-boundary, st-loop, st-archetype, st-leverage, st-validate).
6. `references/methodology/systems-thinking.md` - add the 5-move definitions, the CLD storytelling method, the leverage-point -> validation handoff. Fold in session 2 examples (fishery stock, breakfast loop).
7. (Optional) `references/methodology/causal-loop-diagrams.md` - dedicated CLD-building reference if M2 warrants its own depth.
8. Selector reads intra-move flow by traversing Brain `PREREQUISITE`/`FEEDS_INTO` edges (Section 6, Layer 1), blended locally with navigation.cjs graph state + memory-ops.cjs trajectory.
9. Verify connector frontmatter renders the F.1 gate via the navigation engine (`lib/core/navigation-engine.cjs decide()`).
10. Eval: confirm SENS-06 fires the selector, the dial overrides route correctly, and the flow traversal returns the seeded edges.

Dependency: Piece A must land before Piece B step 8 can be verified end-to-end. If the admin write key is unavailable at build time, Piece B falls back to the hardcoded heuristic (Section 5) and Piece A becomes a follow-up.

---

## 10. Open Questions (all RESOLVED)

1. ~~Should M5 auto-hand off or just name the target and stop?~~ **RESOLVED 2026-06-14**: NAME-AND-STOP. M5 names the stage-appropriate next-action target and OFFERS the handoff; it does NOT auto-jump (CONTEXT carried default, navigator-confirmed 2026-06-14). Plan 02 implements name-and-stop via fileEvidenceWithReadback.
2. ~~6th move for trending-to-absurd / S-curve, or cross-chain?~~ **RESOLVED 2026-06-14**: keep as a CROSS-CHAIN, no 6th core move (CONTEXT carried default, navigator-confirmed 2026-06-14). The move set stays M1-M5; trending-to-absurd / S-curve re-entry is a cross-chain, not a core move.
3. ~~Confidence-ranking source~~ **RESOLVED 2026-06-13**: intra-move flow is graph-native, read from Brain `PREREQUISITE`/`FEEDS_INTO` edges (Section 6, Layer 1). Blended locally with room-state + memory for ranking.
4. ~~Artifact target~~ **RESOLVED 2026-06-13**: filing is STAGE-AWARE -> the ACTIVE room section the navigator invoked from / the current venture stage. NOT a fixed default. Systems thinking is a meta-lens usable at any stage (navigator correction 2026-06-13).

## 11. Decisions Log

- Build shape: design spec first, then build (approved).
- Default posture: GUIDED ("let me think").
- Promote existing command in place (no new command).
- Flow source: Brain prerequisite edges, graph-native (Piece A seeds them).
- Sequencing: registered as roadmap Phase 150.10 (next after 150.9); run /gsd-plan-phase 150.10 to break down.
- License: source from IRIS Session 2 transcript (own IP); no CC BY-SA derivative obligation.
- Scope (navigator 2026-06-13): systems thinking is a META-LENS -- any stage, any problem type, any case, NOT discovery-only. Filing is stage-aware (active section).
- Piece A is LOAD-BEARING (navigator 2026-06-13): Brain ingestion of Session 2 must be ADDITIVE + DEDUPED + CONNECTED, ZERO orphans, with an orphan-scan acceptance gate.
