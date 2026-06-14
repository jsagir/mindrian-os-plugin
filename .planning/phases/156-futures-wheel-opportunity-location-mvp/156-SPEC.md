# Phase 156: Futures Wheel opportunity-location MVP — Specification

**Created:** 2026-06-14
**Ambiguity score:** 0.18 (gate: ≤ 0.20)
**Requirements:** 13 locked
**Milestone:** v1.13.1 "Larry Reaches" (navigator-pulled)
**canon_parts:** Part 2 (Engine 1 Act 1 intelligence), Part 3 (Decision Gate), Part 4 (typed edges + Opportunity Bank), Part 7 (reuse before build), Part 8 (LOCAL only), Part 9 (proposed->confirmed)

## Goal

A new `/mos:futures [concept]` command does what a human provably cannot: it turns a seed concept into a bounded multi-ring consequence wheel (1st/2nd/3rd-order, flat artifacts under the Opportunity Bank, NO sub-rooms) and surfaces the invisible cross-domain ripples a linear human mind misses. It traces "and then what?" causal chains as `ROOT_CAUSES`/`ENABLES` edges, surfaces hidden bridges via the HSI engine and cross-domain reverse-salient (RS) analysis (mutually invoked), tags every consequence with PESTEL domain + temporal horizon + confidence, and banks opportunity candidates whose provenance traces to an `HSI_CONNECTION`, `REVERSE_SALIENT`, or `ROOT_CAUSES` edge.

**The reason this is a software job, not a human one (navigator, 2026-06-14):** the instructor who teaches the Futures Wheel admits he "can't think through first, second, third-order consequences, not well" — human brains are linear, 2nd/3rd-order effects are "nearly invisible," and the wheel "explodes in complexity, mathematically unmanageable without software." The whole point of building this on Claude/MindrianOS is to do the cognitively-impossible part: the non-linear, multi-ring, cross-domain traversal a human cannot hold in their head. Success is therefore measured by surfacing ripples the navigator did NOT already see, not by rendering a tidy diagram.

## Background

**The tool (navigator-grounded, 2026-06-14).** The Futures Wheel (Glenn 1971) places a central change in the middle and maps outward in causal rings: 1st-order (direct), 2nd-order (effects of effects), 3rd-order (deep systemic ripples). The instructor's automobile example: cars -> (1st) no horses / gas stations / traffic lights -> (2nd) mass-production factories / working class / labor movements -> (3rd) middle-manager invented / suburbanization / healthcare+retirement policy. The power is NOT first-order (obvious) — it is the 2nd/3rd-order cross-domain effects that are "nearly invisible" in foresight and obvious only in hindsight. The instructor's candid admission: it is "operationally brutal" because human brains think linearly, downstream effects are invisible, and the wheel "explodes in complexity fast — mathematically unmanageable without software." His usable fallback was a **subsystem impact map**: a flatter, domain-organized version (transportation/industry/politics/social/healthcare). The trained skill is breaking the linear habit: "And then what? And then what after that?"

**Why MindrianOS can do it (the thesis).** "Unmanageable without software" IS the opening. The engines are already shipped and verified real (2026-06-14):
- **ICM backbone** — Layer 0 = seed identity (ROOM.md), Layer 4 = consequence nodes as artifacts.
- **HSI engine** — `scripts/compute-hsi.py` (writes `.hsi-results.json`) + `scripts/hsi-to-graph.cjs` (reads it, writes `HSI_CONNECTION` + `REVERSE_SALIENT` edges to room.db; requires consequences to already exist as `Artifact` nodes). HSI = |BERT_sim − LSA_sim| × integrative — "connected in ways nobody sees" — i.e. exactly the invisible cross-domain 2nd/3rd-order bridges.
- **Reverse Salient (RS) cross-domain engine** — Phase 89 shipped `scripts/rs-engine.py` (internal / cross-room / external / hybrid modes) + `lib/core/bridge-writer.cjs` + the `REVERSE_SALIENT` edge type that `hsi-to-graph.cjs` ALREADY writes. RS surfaces lagging-component / cross-domain analogies (Hughes 1983). Per the navigator (2026-06-14) RS cross-domain analysis is "even more related" to the Futures Wheel and must be MUTUALLY invoked — the same meta-lens chaining pattern Phase 150.10 established (M4 reverse-salient ↔ systems-thinking). The Futures Wheel can invoke RS when a cross-domain ripple warrants it, and an RS cross-domain finding can seed/feed a wheel.
- **Source material** — the human-foresight limitation framing comes from IRIS 2026 Session 2 (the cohort-2026 lecture already ingested as generic methodology into the Brain teaching graph in Phase 150.10, `source_doc='iris-2026-session-2'`).
- **Causal cascade edges** — `ROOT_CAUSES` (directional cause->effect) + `ENABLES` are BOTH in the frozen `ALLOWED_EDGE_TYPES` set (`ROOT_CAUSES` added by the Phase 150.8 amendment). No Part 4 amendment needed. `LEADS_TO`/`CAUSES` are NOT frozen-legal and are excluded.
- **Opportunity Bank** — `lib/core/opportunity-ops.cjs::bankOpportunity(roomDir, opportunity)` exists with dedup (problem_hash), confidence-update, evidence-append. Needs `opportunity.problem` + `confidence` + `evidence`.
- **Proactive discovery loop** (`.claude/includes/architecture.md`) IS the Futures Wheel loop, unnamed: filed artifact -> cross-relationship scan -> new edges -> Larry surfaces -> user decision -> graph data.

**The delta.** No `/mos:futures` command exists. Consequence artifacts do not carry `horizon`/`confidence`/PESTEL `domain` frontmatter. No bounded multi-ring generator + advisory causal-cue pass exists. No subsystem-impact-map render exists. This phase assembles the existing engines into the named loop and adds these thin deltas.

## Requirements

1. **Seed command**: A new `/mos:futures [concept]` command exists and is spine-wired (connector frontmatter), justified under Canon Part 7.
   - Current: No `/mos:futures` command. `/mos:explore-futures` (TTA+Scenario+S-Curve), `/mos:scenario-plan` (2x2), `/mos:explore-trends` (push-to-extremes) exist but none build a living consequence graph from a seed.
   - Target: `/mos:futures [concept]` creates `opportunity-bank/futures-<seed-slug>/` in the ACTIVE room with a ROOM.md identity (ICM Layer 0), then runs the pipeline below. Part 7 posture: `/mos:futures` is the consequence-GRAPH hub; it does NOT duplicate the existing foresight commands — it CHAINS to them (scenario-plan clusters its branches, explore-trends pushes its consequences to the absurd, systems-thinking reads its causal structure, RS finds its cross-domain bridges). The net-new capability is the living multi-ring consequence graph + HSI bridge scan + opportunity banking, which none of them provide.
   - Acceptance: `/mos:futures "automobile adoption"` creates `opportunity-bank/futures-automobile-adoption/ROOM.md`; the command's frontmatter Part 7 justification names each existing foresight command and states chain-not-duplicate for each.

2. **Bounded multi-ring consequence generation**: Larry generates consequences ring by ring (1st -> 2nd -> 3rd order), tracing causal chains, NOT a flat brainstorm.
   - Current: No consequence generator. The wheel is a manual whiteboard exercise.
   - Target: Larry proposes consequences ring-by-ring as PROPOSED artifacts; each Nth-order consequence links to its parent (the (N-1)th cause). Default depth = 3 rings; default per-node fan-out cap = 5; both navigator-overridable. Consequences are flat artifacts under the seed folder (NO sub-rooms).
   - Acceptance: A seed produces artifacts tagged `ring: 1|2|3`; ring-2 artifacts reference a ring-1 parent; total node count is bounded by the depth × fan-out caps (no unbounded explosion).

3. **Advisory linguistic causal-cue pass**: Each proposed consequence is flagged cue-supported or cue-thin to combat LLM causal hallucination.
   - Current: No causal-quality check; LLM consequences are unverified.
   - Target: A lightweight pattern-based pass (causal cue lexicon: "leads to", "because", "enables", "results in", "causes", etc.) annotates each consequence as cue-supported/cue-thin and adjusts displayed confidence. Reuse existing regex/parse helpers; NO ML model, NO new dependency. ADVISORY only — it never drops a consequence; the HITL Decision Gate decides.
   - Acceptance: A consequence phrased with an explicit causal cue is flagged cue-supported; one phrased without is flagged cue-thin; both are still presented to the navigator (neither is auto-dropped).

4. **Consequence frontmatter deltas**: Every consequence artifact carries temporal + confidence + PESTEL frontmatter.
   - Current: Artifact frontmatter has no `horizon`, `confidence`, or PESTEL `domain` fields.
   - Target: Each consequence artifact carries `horizon: near|mid|long`, `confidence: 0.0-1.0`, and `domain:` (one of Political/Economic/Social/Technological/Environmental/Legal).
   - Acceptance: A generated consequence file's frontmatter parses with all three fields populated and value-validated (horizon enum, confidence float 0-1, domain enum).

5. **Causal cascade edges**: Ring-to-ring causal links are written as frozen-legal typed edges.
   - Current: No causal edges between consequence artifacts.
   - Target: Each (N-1)->N ring link is a `ROOT_CAUSES` edge (source=cause, target=effect); enabling relations use `ENABLES`. Written via the `navigation.cjs` chokepoint. NO `LEADS_TO`/`CAUSES` (not in the frozen set).
   - Acceptance: After a run, room.db contains `ROOT_CAUSES` edges from ring-1 artifacts to their ring-2 children; a grep/SQL check finds zero non-frozen edge types written by the command.

6. **HSI hidden-bridge scan (explicit pipeline step)**: The command runs HSI over the seed's consequences as a named, ordered step.
   - Current: HSI runs ad hoc; `hsi-to-graph.cjs` requires `Artifact` nodes to pre-exist.
   - Target: `/mos:futures` runs in deterministic order: generate + file consequences as `Artifact` nodes -> invoke `compute-hsi.py` -> `hsi-to-graph.cjs` -> `HSI_CONNECTION` edges. No hidden async; the command owns the sequence.
   - Acceptance: On a seed with ≥4 filed consequences, the command produces `.hsi-results.json` and ≥1 `HSI_CONNECTION` edge in room.db within the single command run.

7. **Hidden-bridge surfacing at a Decision Gate**: High-HSI cross-domain bridges the navigator did not explicitly draw are surfaced for decision.
   - Current: HSI edges are written silently; nothing surfaces them.
   - Target: The top HSI_CONNECTION bridges (cross-domain pairs, high |BERT−LSA|) are surfaced at a tri-context Decision Gate (Part 3) with APPROVE/REJECT(reason)/DEFER; the reason becomes graph data (Part 4).
   - Acceptance: A run with a known high-HSI cross-domain pair surfaces it as a gate option; a REJECT captures a reason edge.

8. **Subsystem impact map view**: The instructor's flatter, domain-organized alternative is a first-class render mode.
   - Current: No subsystem/PESTEL-organized view of consequences.
   - Target: A render that organizes the seed's consequences by PESTEL domain (the "subsystem impact map") — the usable-in-practice complement to the ring view. Reuses the `domain:` frontmatter from FW-04.
   - Acceptance: For a seed with consequences across ≥2 domains, the view groups them by domain and is invocable from the command output footer.

9. **Opportunity banking with bridge provenance**: Approved candidates bank via the existing engine, with provenance to a graph edge.
   - Current: `bankOpportunity()` exists but is not wired to the futures flow.
   - Target: Approved opportunity candidates call `opportunity-ops.cjs::bankOpportunity(roomDir, opportunity)`; each banked opportunity's frontmatter records provenance tracing to an `HSI_CONNECTION`, `REVERSE_SALIENT`, or `ROOT_CAUSES` edge id/pair.
   - Acceptance: A banked candidate file exists under `opportunity-bank/` with a provenance field naming the source edge; dedup (problem_hash) still functions.

10. **HITL Decision Gate + proposed->confirmed**: Consequences and banked opportunities are human-confirmed, never silently trusted.
    - Current: N/A (no flow).
    - Target: Consequence artifacts and opportunities land as `proposed` and only reach `confirmed` via a navigator decision (Part 3 gate, Part 9 confirmNode with byUser attribution). REJECT reasons become graph data (Part 4).
    - Acceptance: A freshly generated consequence node has `review_status: proposed`; after navigator APPROVE it is `confirmed` with a `byUser` attribution; a REJECT writes a reason edge.

11. **Part 8 locality**: The entire pipeline is LOCAL.
    - Current: N/A.
    - Target: All consequence artifacts, the HSI computation, all edges, and banking live in the local room (room.db + filesystem). ZERO Brain egress; no user content in any Brain call. (RS external mode, if ever used, queries only the public OpenAlex/arXiv corpus — never room content — consistent with Phase 89's Part 8 posture.)
    - Acceptance: A boundary grep over the new command + any new lib code finds zero Brain-write / Brain-query-with-user-content paths (mirrors the existing check-brain-boundary scan; passes the Part 8 floor test).

12. **Foresight meta-lens chaining web (mutual invocation)**: The Futures Wheel is the consequence-graph HUB of a foresight meta-lens web, mutually invocable with its sibling foresight tools — fired when warranted (NOT always-on), surfaced as Decision-Gate handoffs that REUSE shipped commands (no reimplementation).
    - Current: The chain partners all ship but none connect to a futures flow: RS (`rs-engine.py` + `bridge-writer.cjs`, `REVERSE_SALIENT` edges); `/mos:systems-thinking` (150.10 M1-M5 meta-lens + `leverage-scan.cjs` + its own chaining web); `/mos:scenario-plan` (2x2 scenario matrix); `/mos:explore-trends` (push-to-extremes = "trending to the absurd", a 150.10 Technique node); `/mos:explore-futures` (TTA+Scenario+S-Curve).
    - Target: `/mos:futures` surfaces handoffs to, and is reachable from, each partner:
      - **RS** — invoke cross-domain reverse-salient over the consequence set -> `REVERSE_SALIENT` edges + bridge artifacts (mutual: an RS finding -> "open as a futures wheel?").
      - **Systems-thinking** — the consequence cascade IS a causal structure; hand the graph to `/mos:systems-thinking` (feeds M2 causal-loop / M4 leverage-point); reverse: "project this loop forward" -> a wheel.
      - **Scenario analysis** — cluster co-occurring consequence branches into coherent futures via `/mos:scenario-plan` (scenario clusters = co-occurring branches).
      - **Trending to the absurd** — push a consequence to its extreme via `/mos:explore-trends` to expose long-horizon problems.
      - **S-curve / dominant design** — place a consequence on the timing clock via `/mos:analyze-timing` + `/mos:dominant-designs`; a far-horizon consequence is a candidate future dominant design (fits the `horizon` tag).
      - **Cynefin** — classify a seed/consequence as Simple/Complicated/Complex/Chaotic via `/mos:diagnose` to qualify which consequences are predictable vs emergent.
      - **Mullins 7-domains** — stress-test a banked opportunity candidate via `/mos:mullins` (the evaluate-a-located-opportunity end of the pipeline).
      - **explore-futures** — `/mos:explore-futures` (TTA+Scenario+S-Curve) as the narrative-briefing surface over the consequence graph.
      All reuse the 150.10 chaining-web infrastructure + the Phase 122 command resolver; no new engine. Bounded: surfaced at a Decision Gate on a detected trigger (cross-domain bridge, causal loop, branch co-occurrence, banked candidate), not on every node.
    - Acceptance: On a seed whose consequences span ≥2 domains, the command output footer offers handoffs to the foresight web partners (RS, /mos:systems-thinking, /mos:scenario-plan, /mos:explore-trends, /mos:analyze-timing|dominant-designs, /mos:diagnose, /mos:mullins, /mos:explore-futures); accepting the RS pass writes ≥1 `REVERSE_SALIENT` edge / bridge artifact; each handoff resolves through the Phase 122 command resolver (not a hardcoded string); the reverse "open as a futures wheel" handoff exists from at least the RS and systems-thinking surfaces.

13. **Bounded SIGNAL research step (the SCAN leg)**: The wheel fetches public external evidence to ground consequences and surface weak signals — on-demand and bounded, NOT always-on.
    - Current: The pipeline as otherwise specced is LOCAL-only (Larry-generated consequences + HSI over local artifacts). The SEED->SCAN leg of the research-doc loop has no implementation here. The shipped surfaces exist: `lib/core/research-corpus.cjs` + `research-cache.cjs` (30-day cache, Phase 130.5), the Phase 131 research-as-graph-aware-workflow (`docs/RESEARCH-AS-WORKFLOW-STEP.md`), `/mos:research` (wires findings as typed graph evidence).
    - Target: TWO fire points: (a) seed grounding — research the seed concept once up front to inform ring-1 generation; (b) per-ring on-demand — the navigator can fire a research pass over a ring's consequences. Each pass (i) corroborates a consequence's `confidence` + evidence tier (Part 5), and (ii) surfaces weak signals that propose ADDITIONAL consequences (the "do what a human can't" mandate). Reuses research-corpus + the Phase 131 workflow + `/mos:research`; the 30-day cache bounds external calls. This is the SIGNAL leg of the tri-context Decision Gate.
    - Acceptance: A seed run fetches ≥1 public source up front (cache hit or live); a per-ring research pass either raises/lowers ≥1 consequence's confidence with a cited public source OR proposes ≥1 new consequence tagged as signal-derived; the research queries carry only generic domain handles (Part 8 boundary scan passes — no room content egresses).

## Boundaries

**In scope:**
- New `/mos:futures [concept]` command (spine-wired, Part 7-justified)
- Bounded multi-ring (1st/2nd/3rd-order) consequence generation as flat artifacts under `opportunity-bank/futures-<seed>/`
- Advisory linguistic causal-cue flagging (reuse, no ML)
- `horizon` + `confidence` + PESTEL `domain` frontmatter on consequence artifacts
- `ROOT_CAUSES` + `ENABLES` cascade edges via navigation.cjs
- Explicit HSI scan step (compute-hsi.py -> hsi-to-graph.cjs) over filed consequences
- Hidden-bridge surfacing at a tri-context Decision Gate
- Foresight meta-lens chaining web: Decision-Gate HANDOFF HOOKS to RS, /mos:systems-thinking, /mos:scenario-plan, /mos:explore-trends (mutual where noted), resolved via the Phase 122 command resolver
- Bounded SIGNAL research step (seed grounding + per-ring on-demand) reusing research-corpus + Phase 131 workflow + /mos:research, 30-day cached
- Subsystem impact map (PESTEL-domain) render mode
- Opportunity banking with edge provenance via opportunity-ops.cjs
- HITL proposed->confirmed gating (Part 3 / Part 9)

**Out of scope:**
- Sub-rooms as N-th-order consequence nodes — gated by SEED-004 (nested-room write-scope bug); MVP uses flat artifacts + edges for depth
- Unbounded depth / fan-out — capped (default 3 rings × 5) to stay tractable ("explodes in complexity")
- Reflection / prediction-audit scheduled pass — deferred (grand-vision; needs scheduling + the foresight-evaluation open problem)
- Always-on / autonomous horizon scanning across external sources — deferred (grand-vision research program)
- Multi-agent specialization (Scan/Consequence/Propagation/Evaluation/Synthesis/Reflection sub-agents) — deferred
- DEEP integration of the chained foresight tools (FW-12) — MVP ships the handoff HOOKS only (surface + resolve + reuse the shipped command); reworking scenario-plan / explore-trends / systems-thinking internals to natively consume the consequence graph is a fast-follow
- `LEADS_TO` / `CAUSES` edge types — not in the frozen ALLOWED_EDGE_TYPES; would require a Part 4 amendment, unnecessary (ROOT_CAUSES covers cause->effect)
- New ML model / new dependency for causal extraction — the advisory pass is pattern-based reuse only

## Constraints

- Depth and per-node fan-out MUST be bounded (defaults 3 rings, 5 children) — the wheel is "mathematically unmanageable" otherwise.
- HSI requires consequences to exist as `Artifact` nodes in room.db BEFORE `hsi-to-graph.cjs` runs — the command must file before it scans.
- Only frozen `ALLOWED_EDGE_TYPES` may be written (`ROOT_CAUSES`, `ENABLES`, `HSI_CONNECTION`, `REVERSE_SALIENT`) — no new edge types without a canon amendment.
- All graph writes route through the `lib/core/navigation.cjs` chokepoint (Part 9).
- No new runtime dependency; the causal-cue pass reuses existing regex/parse helpers; HSI uses the shipped Python (Tier 1 LSA+MiniLM default).
- Canon Part 8: zero Brain egress; LOCAL room.db + filesystem only.
- Tri-Polar: works on CLI (command + scripts), Desktop, and Cowork (conversational; the command is Larry-orchestrated).

## Acceptance Criteria

- [ ] `/mos:futures [concept]` exists, is spine-wired, and carries a Part 7 justification in its frontmatter
- [ ] A run creates `opportunity-bank/futures-<seed>/` with a ROOM.md (ICM Layer 0)
- [ ] Consequences generate ring-by-ring (1st/2nd/3rd) as flat PROPOSED artifacts, bounded by depth × fan-out caps
- [ ] Each consequence artifact carries valid `horizon`, `confidence`, and PESTEL `domain` frontmatter
- [ ] Each consequence is flagged cue-supported / cue-thin by the advisory pass; none auto-dropped
- [ ] room.db contains `ROOT_CAUSES` edges linking ring N-1 -> ring N; zero non-frozen edge types written
- [ ] The command runs compute-hsi.py -> hsi-to-graph.cjs and produces ≥1 `HSI_CONNECTION` edge in one run
- [ ] ≥1 hidden cross-domain bridge is surfaced at a Decision Gate with APPROVE/REJECT(reason)/DEFER
- [ ] The subsystem impact map view groups consequences by PESTEL domain
- [ ] An approved candidate banks via `bankOpportunity()` with provenance tracing to an HSI_CONNECTION, REVERSE_SALIENT, or ROOT_CAUSES edge
- [ ] On a multi-domain seed, an RS cross-domain pass is offered at a Decision Gate and (on accept) writes ≥1 REVERSE_SALIENT edge / bridge artifact; the RS-finding -> futures-wheel reverse handoff is present
- [ ] At least one surfaced bridge is one the navigator did NOT explicitly draw (the "do what a human can't" test)
- [ ] Seed grounding fetches ≥1 public source; a per-ring research pass corroborates a confidence OR proposes a signal-derived consequence; Part 8 scan confirms only generic handles egress
- [ ] Consequences/opportunities land `proposed` and reach `confirmed` only via navigator decision (byUser); REJECT writes a reason edge
- [ ] Part 8 boundary scan over new code returns zero user-content-to-Brain paths

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes                                                        |
|--------------------|-------|-------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.82  | 0.75  | ✓      | Success = banked candidate w/ bridge provenance; multi-ring locked |
| Boundary Clarity   | 0.88  | 0.70  | ✓      | Command + edges + seed-home + deferred list explicit         |
| Constraint Clarity | 0.78  | 0.65  | ✓      | Depth/fan-out caps; ROOT_CAUSES frozen-legal; HSI order      |
| Acceptance Criteria| 0.78  | 0.70  | ✓      | 12 pass/fail checks                                          |
| **Ambiguity**      | 0.18  | ≤0.20 | ✓      | Gate passed; all minimums met                                |

## Interview Log

| Round | Perspective     | Question summary                              | Decision locked                                                                 |
|-------|-----------------|-----------------------------------------------|---------------------------------------------------------------------------------|
| 0     | Scout           | What engines exist to assemble?               | ICM + HSI (compute-hsi.py / hsi-to-graph.cjs writes HSI_CONNECTION) + opportunity-ops bankOpportunity all real; ROOT_CAUSES frozen-legal post-150.8 |
| 1     | Researcher      | Part 7: new command vs repoint?               | NEW `/mos:futures` (none of the 3 existing do consequence-graph + HSI + banking) |
| 1     | Researcher      | Consequence generation approach?              | Hybrid: Larry LLM + advisory linguistic cue pass (HITL is the hallucination guard) |
| 1     | Researcher      | Edge vocabulary?                              | Cascade (ROOT_CAUSES + ENABLES) + HSI_CONNECTION; no LEADS_TO/CAUSES (not frozen) |
| 2     | Simplifier      | Success pass/fail?                            | Banked opportunity candidate w/ provenance to an HSI/ROOT_CAUSES edge            |
| 2     | Researcher      | HSI trigger timing?                           | Explicit ordered step inside /mos:futures (file-then-scan)                       |
| 2     | Boundary Keeper | Seed home?                                    | Hybrid (navigator): sub-folder UNDER opportunity-bank in the active room; no sub-room |
| 3     | Boundary Keeper | Hybrid pass scope?                            | Advisory cue-flagging, reuse regex, no ML; never auto-drops                      |
| 3     | Seed Closer     | Anything to regret not specifying?            | Nothing — write SPEC (cap consequence count folded into FW-02 bounds)            |
| 3+    | Navigator input | Instructor breakdown of the Futures Wheel     | MULTI-RING (1st/2nd/3rd) is the essence (value is the invisible cross-domain ripples); subsystem impact map = first-class PESTEL render; bounded depth because it "explodes" — supersedes the seed's first-order-only framing (flat artifacts keep it inside no-sub-rooms) |
| 3+    | Navigator input | "Use Claude to do what a human cannot"        | The phase rationale + success bar elevated into the Goal: surface ripples the navigator did NOT already see (humans are linear, 2nd/3rd-order is invisible). Source = IRIS 2026 Session 2 (already in Brain via 150.10). |
| 3+    | Navigator input | "Cross-domain via RS, mutually invoked"       | FW-12 (initially): Reverse Salient cross-domain analysis (Phase 89) wired BIDIRECTIONALLY to the wheel, fired on detected cross-domain bridges (not always-on); mirrors the 150.10 meta-lens chaining web. |
| 3+    | Navigator input | "Very relevant to systems thinking"           | FW-12 broadened: the wheel IS systems thinking projected forward; chain to /mos:systems-thinking (150.10 M2 causal-loop / M4 leverage-point), mutual. |
| 3+    | Navigator input | "and trending to the absurd and scenario analysis" | FW-12 generalized to the FORESIGHT META-LENS CHAINING WEB: /mos:futures is the consequence-graph HUB chaining to RS + systems-thinking + scenario-plan (branch clustering) + explore-trends (trending-to-absurd). Resolves Part 7 (chain-not-duplicate). Bounded to handoff HOOKS; deep integration deferred. |
| 4     | Seed Closer     | Close the foresight-web membership            | Navigator added ALL remaining 150.10 siblings: S-curve/dominant-design (analyze-timing + dominant-designs), Cynefin (diagnose), Mullins 7-domains, explore-futures. Web = 8 partners. LOCK + commit, then discuss-phase. |
| discuss | HOW decisions | Interaction / approval / view / chaining      | Guided-by-ring generation; per-ring batch approval gate; subsystem (PESTEL) map default + ring on demand; top-N ranked chaining handoffs (mirror the dial). |
| discuss | Navigator catch | "where is the research step?"                 | FW-13 added: bounded SIGNAL research (seed grounding + per-ring on-demand) reusing research-corpus + Phase 131 + /mos:research, 30-day cached, Part 8-safe. Corrects the under-scoped SCAN leg. NOT always-on (that stays deferred). |

---

*Phase: 156-futures-wheel-opportunity-location-mvp*
*Spec created: 2026-06-14*
*Next step: /gsd-discuss-phase 156 — implementation decisions (how to build what's specified above)*
