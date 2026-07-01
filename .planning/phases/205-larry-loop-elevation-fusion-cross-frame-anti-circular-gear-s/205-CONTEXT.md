# Phase 205 - Larry Loop Elevation (FUSION cross-frame + anti-circular gear-shift)

> Slug: larry-loop-elevation | Class: CODE + ARCH | Priority: P0 | Registered 2026-07-01 (navigator-directed)
> Durable spec lives HERE (the ROADMAP.md body entry kept reverting on cascade/reload; this phase-dir file is the source of truth for /gsd-discuss-phase 205 and /gsd-plan-phase 205).
> House rule: no em-dashes, hyphens only. Feynman-simplified, JTBD-oriented.

## Depends on

Phase 191 (Brain orchestration advisor - brain_ask/DirectiveEnvelope as the decision operator), Phase 201 (harness-as-code - the fan-out + behavior-harness spine), Phase 202 (Agent-Lightning APO lab - the reward/optimize loop the harness feeds), Phase 200 (RS engine - the reverse-salient structural/semantic discriminator), Phase 196 (Part-8 runtime SLM guardrail - ALREADY carries `196-02-plurai-baseline-PLAN.md`; the eval suite extends it), Phase 188 (Shape-F selector - the offer/gate render the reaches surface through), Phase 166 (runChain safe-halt - the pipeline), Phases 143.1/144 (LarryReach dial), Phase 115 (persona role_blend/role_level). Sibling to /mos:bono + /mos:find-bottlenecks + /mos:find-analogies + /mos:beautiful-question.

## Goal

Add ONE decision stage to Larry's loop that fires when the navigator is STUCK - either stuck ACROSS frames (FUSION: two-plus live topics share a job/structure/conclusion and Larry never connects them - the Test 6 five-misses failure) or stuck WITHIN a frame (the anti-circular gear-shift: a conversation circles because a claim is unheard, unvalidated, mis-located, or wrongly framed - the Mordi+Eli tester failure). Both are the same upgrade from two sides on one shared substrate. NOT inventing capability (Canon Part 7): wire already-shipped pieces into the loop as decision-makers.

## Grounding sources

- Jonathan Sagir PRD v0.1 "Larry Cross-Frame Elevation (the FUSION stage)", grounded in Test 6 (Professor "Bruce", Churchill counterfactual + cognitive warfare) + Tests 1-6.
- Lawrence Aronhime, Test 6 write-up (the authoritative model - see "Lawrence's model" below).
- Tester feedback Mordi + Eli, 2026-07-01: "circular, back-and-forth, not answering questions; loved the colors."

## Lawrence's model (governing frame - Test 6)

**The unified principle (supersedes "two modes").** Everyone is here for a conversation. Everyone gets their ideas challenged AND elevated AND helped. Only the RATIO shifts by persona: a professor/peer gets more production + horizontal/lateral elevation; a student gets more challenge + vertical elevation. Same ingredients, different mix.

**Three types of elevation (the cross-frame spine).**
- Vertical = depth below the surface. Larry-native, improving across Tests 1-5. WORKING.
- Horizontal = connect ideas the person already holds but presented as separate. The five Test 6 misses. Larry's measurable WEAK point. PRIMARY TARGET.
- Lateral = import something from outside the frame (a reference/idea/strategic suggestion they did not ask for). UNTESTED.

**Tone is the invariant for all three.** Always hedged, cautious, evidence-backed, never confident. "These MIGHT be the same argument - here is why I think so," never "these ARE the same." Larry offers; the person judges. Being wrong is fine; being presumptuous is not. (The Test 6 tone slip: the "a paper about AI written by AI would be its own punchline" quip - presumptuous with a professor.)

**Four universal critical-thinking checks (for everyone, not just learners):** assumptions, evidence, logic, conclusions. The fourth is the sharpest and IS the horizontal trigger: "your evidence supports X, but it also supports Y - have you considered that?"

**Navigator decision 2026-07-01:** KEEP the ASK/TELL/GRILL gear framing AND add the three elevation types alongside it (do not tear out the gears; the elevation types are the cross-frame companion axis).

## Scope

### (0) Routing fence - navigator-facing vs internal, NOT `kind`-based
Navigator-directed ("some are technical for internal use, make sure you differ"). The registry `kind` field (methodology 49 / meta 3 / utility 49 / mechanical 2, across 103 CLI commands in data/command-registry.json) is NOT the right fence: funding, file-meeting, doctor, heal, deck, show are navigator-facing and CRITICAL despite not being `methodology`. DELIVERABLE: add a `surface: navigator|internal` tag (or `internal:true`) to the registry. Truly-internal set is small (dogfood-flush, dial-memory-refresh, hmi-status, feynman-timeline-refresh, memory-cortex-reach, brain-derive, correct-reference-now). RULES: (a) the anti-circular gear-shift EXITS are thinking moves = `kind:methodology` only; (b) the broader ranker/suggest-next/Provoked surfacer routes to ALL `surface:navigator` commands, NEVER `surface:internal`; (c) the router enforces the tag, never Larry's recall.

### (0b) MCP surface parity (Tri-Polar)
Desktop/Cowork see the 9 hierarchical router tools in lib/mcp/tool-router.cjs covering 64 of 103 CLI commands (ALL_TOOL_COMMANDS). The `surface` tag + routing fence MUST hold on the MCP surface too, or the fence leaks on Desktop/Cowork. 39 CLI-only commands are not MCP-exposed; confirm none is a gear-shift/FUSION exit.

### (1) FUSION cross-frame stage
New loop: understand -> map frames -> research -> synthesize per frame -> FUSION -> write. FUSION is a ROUTER not a monolith: assemble open frames, call brain_ask for the DirectiveEnvelope (move + next_gate.confidence + mode_signals), run the JTBD job-test to classify horizontal (same job -> go UP, name the containing system) vs lateral (same structure, divergent surface = the reverse-salient signature -> go SIDEWAYS, route to a sideways engine + live web fetch), gate on confidence + dial; a session-end quorum forces one OFFERED cross-frame hypothesis if two-plus frames are live and no horizontal move fired.

### (2) Anti-circular within-frame gear-shift
New SENS-10 circularity sensor in lib/core/insight-sensors.cjs SENSOR_REGISTRY (SENS-09 is taken by Phase 170 dual-use diffusion). Four causes -> four exits: answer-unheard -> TELL; assertion-unvalidated -> GRILL; stuck-cannot-say-where -> GRILL via find-bottlenecks (reuse SENS-02 lagging-component); wrong-question/frame -> REFRAME via beautiful-question (Why/What-if/How). Ranker flip in lib/workflow/f-selector-ranker.cjs::rankForSelector: ASK-as-clarification is NEVER the recommended detent when SENS-10 fires (ASK-as-reframe IS allowed - the clarify-vs-reframe distinction is the rule).

### (3) GRILL = two mandatory arms on a load-bearing claim
Arm A logical red-team: challenge-assumptions + Brain bias-consult (Consider-the-Opposite, Base-Rate-Check, Red-Team-Steelman, Premortem, Reference-Class-Forecasting - the Beautiful-Questions bias techniques, reached as brain_consult, Part-8 fenced: bias SHAPE egresses, never claim content). Arm B external validation (CRITICAL - the teeth that end the circle by touching ground truth): bono parallel-fan (runCellFanout hat-scoped: White=data, Black=disconfirming/refutation, Yellow=success, Green=adjacent) then adversarial-verify to a structured verdict (survives / flagged None-tier), Tavily-first / native-WebFetch-fallback as primitives, filed as typed graph evidence via mos:research, plan-gated through the deep_research reach, MCP-stack-ask gate before any external pass.

### (4) Two orthogonal axes (fixes the tone slip AND presumptuous-move risk)
Confidence axis (hedged vs confident - hedging ALWAYS on = the GUIDED default, Canon Part 3) crossed with Initiative axis (ask-first vs act-first, set by mode_signals + persona). Safe modes = ask-and-hedged, tell-and-hedged. Forbidden mode = tell-and-confident (the Test 6 "these ARE the same" + the quip). Splitting the axes makes that failure structurally impossible.

### (5) Persona auto-detection + NO-CUTE-IRONY filter
role_level (student|practitioner|researcher|professor from the opening turns) biases the dial default and elevation emphasis WITHOUT quotas. NO-CUTE-IRONY tone filter for professor/researcher personas or defence/intelligence/geopolitics domains blocks ironic quips and teacherly asides.

### (6) Pipelining
The exits are not a menu, they COMPOSE. SENS-10/FUSION diagnoses the cause(s) -> composeWorkflow (recipe-maps) builds a chain -> validateChainAutonomy reads each step's autonomous_safe flag -> chain-executor::runChain auto-runs the safe recon prefix (find-bottlenecks[safe], find-analogies[safe]) and HALTS at the first material gate (bono[gate]) then TELL synthesis. GUIDED safe-halt preserved (Reach rule 8 / Phase 166).

### (7) Frozen-six invariant preserved
GRILL/REFRAME/FUSION mint NO new reach_id. The six reach_ids (context_block, contradiction, cross_room, brain_consult, deep_research, hats) stay frozen with the drift test in navigation-engine.cjs. GRILL routes to the existing deep_research reach + local commands; the gear is a nav-dial position (nav-dial.cjs currently Investigate|Blend|Insight), not a reach.

### (8) Three elevation types alongside the gears (Lawrence Test 6, navigator-approved)
Add vertical/horizontal/lateral as the cross-frame companion axis to the ASK/TELL/GRILL gears (keep both). Horizontal is the primary build target (the 5 T6 misses). Lateral is untested and rides the same sideways engines as FUSION's lateral path (reverse-salient, find-analogies, web fetch). The four universal critical-thinking checks are the detectors; the 4th (alternative conclusions) IS the horizontal trigger. Hedged-always is the invariant across all three.

### (9) Behavior harness = a Plurai eval suite (one judge per reach/behavior)
Navigator insight ("larryreacts needs a plurai"): the harness is not one evaluator, it is a SUITE of Plurai LLM-as-a-judge classifiers, one per reach/behavior. Plurai = IntellAgent (open-source, arXiv 2501.11067, plurai-ai/intellagent), now installed as the `evals` MCP plugin (tools: start_evaluator, send_message, upload_data, get_results, search_evaluators). LAB-SIDE, never shipped to the user machine (respects the no-Python-on-user rule); sits with Phase 202 APO + Phase 201 harness-as-code + Phase 196 plurai-baseline. Independent judge (never the Brain that drove the move = no circularity). Part 8: policy from generic doctrine only, personas synthetic, no user data.

**Suite started this session (three judges, each at the samples/Optimize gate):**
- Cross-frame horizontal-elevation judge - labels: No Connection / Hedged / Confident. Thread 392ec50f-282d-4956-adc6-1f03130e3bd8. Golden set (pending real transcript file) = the five Test 6 misses (No Connection) + the "should have said" lines (Hedged) + the quip (Confident). PRIMARY per Lawrence.
- Anti-circular judge - labels: circular / progressing (parked at the Optimize model choice). The within-frame half (Mordi/Eli). Thread 127f8f53-2e72-48d8-a771-4ae9d51e5a00.
- Reach+gate correctness judge - labels: Correct / Wrong / Missed / Ambiguous, over the six frozen reach_ids + none AND the Shape-F (188) gate the reach rendered through. Thread f989b4cf-9ef2-48ca-bb02-9dcd9dba3cc8. (Supersedes an earlier 3-label reach judge, thread 2e1b0bba.)

Optimize decision pending: LLM (diagnostic accuracy first) vs SLM (deployable runtime guardrail). Golden data upload awaits the real Test 6 transcript file (do not fabricate records).

## Graph readiness (SQLite local + Neo4j Brain evaluation)

The two-graph split fits 205: LOCAL room.db = navigator live state; Brain (Neo4j) = generic chains/policies. Well-supported: reaches (SELECTED_REACH/PIVOTED local edges), GRILL contradiction/None-tier (CONTRADICTS/SUPERSEDES + held_contradictions + decisions_index), FUSION brain_ask chain (FEEDS_INTO/PREREQUISITE/LEADS_TO in Neo4j), fractal/cross-room (NESTED_WITHIN), frozen-six reaches. THREE GAPS: (1) no FRAME node in either graph (Q5) - derive frames from section nodes (phase-162) + session topic-shift, do not mint a heavy type; (2) no JOB / containing-system node for the horizontal move - needs ONE additive edge (e.g. SHARES_JOB / ELEVATES_TO), consistent with how CONTRADICTS/SELECTED_REACH were added additively to the frozen allowlist in navigation/edges.cjs; (3) conversational turn-state for SENS-10 not modeled (only voice_log/sessions). Correctly NOT in production graph: the RS LSA/BERT discriminator (compute; results land as Brain surface_similarity/deep_similarity/differential_score nodes) and the IntellAgent policy graph (lab-side).

### (10) Lawrence Test-6 canon amendments (architectural, NOT tonal - navigator/Lawrence-directed 2026-07-01)

Lawrence's canon audit (Test 6 vs Canon v1.19 + larry-personality SKILL.md beta.13): the STUDENT-side findings are in canon (Part 12 elevate sequence, cardinal sins, invisibility); the PROFESSOR/peer-side findings are NOT. Five findings are architectural (they shape how the ENGINE works, not just how Larry talks) and MUST be codified:

1. **Three elevation types (direction of elevation)** - vertical (depth) / horizontal (connect the navigator's OWN separate ideas) / lateral (import from outside the frame). Canon has the 4-beat elevate sequence but never distinguishes DIRECTION. New taxonomy -> amend Canon Part 12.
2. **Cross-frame connection as the PRIMARY gap** - Larry is strong within-frame, weak across-frames; horizontal is the highest-value move and the measured weakness (5 Test-6 misses). Codify as an engine target.
3. **Universal 4-check critical thinking** - assumptions / evidence / logic / conclusions, for EVERYONE (not just learners). The 4th (alternative conclusions) IS the horizontal trigger. Not in canon.
4. **Unified principle (same ingredients, different ratio)** - challenge + elevate + help always; professor/peer skews to production + horizontal/lateral, student skews to vertical. Part 12 governs pedagogy but not the professor/peer ratio. Not in canon.
5. **Hedged elevation tone** - "these MIGHT be the same argument, here is why" NOT "these ARE the same." Larry offers; the person judges. Being wrong is fine; being presumptuous is not. Not codified.

Ratios (Lawrence): students get mostly vertical + occasional horizontal/lateral; non-students get mostly horizontal/lateral + vertical only when genuinely needed. Current state: vertical strong (Tests 1-5), horizontal weak (Test 6), lateral untested. Horizontal + lateral are the next development target.

### (11) Shape-F selector must state WHAT-YOU-GET and HOW-YOUR-THINKING-IMPROVES (Lawrence-directed 2026-07-01)

Defect Lawrence named: "Your Shape F does not tell me what I will get or how my thinking improves." The LIVE selector prints mechanism-blank rows ("No specific job - general thinking, talking, ranging. 50%"), contradicting the shipped doctrine that rows are Feynman-JTBD what-you-get aliases (lib/hmi/dial-label-composer.cjs). FIX (ties Phase 188 Shape-F + the dial-label-composer to the elevation model): each selector row must be framed as the ELEVATION the navigator receives and the OUTCOME to their thinking -
- vertical -> "Go a level deeper on X - see what's under the surface"
- horizontal -> "Connect X and Y you're holding as separate - they may be one argument"
- lateral -> "Bring in Z from outside your frame - a reference you wouldn't have found"
The elevation type is the row's semantic; the canonical_verb still persists to the graph edge, never to the screen (existing dial-label-composer separation). This is a P0 sub-deliverable: the elevation taxonomy is the selector's VOCABULARY, not just Larry's prose. Scope touches lib/hmi/dial-label-composer.cjs + the F.1/F.7 render (Phase 188).

## Non-goals

No fixed elevation quotas (gate on signal, not counts). Do not rebuild reverse-salient-discovery (wire its logic as a reflex + its skill as an escalation). Do not hand-roll the eval engine (adopt Plurai/IntellAgent lab-side). Move-tagging stays offline in the harness layer, not a runtime gate. Vertical within-frame depth is out of scope (working).

## Locked decisions (discuss-phase, navigator-directed 2026-07-01)

- **D-Q5 (frame boundary) - MINT a first-class Frame node type in room.db.** Navigator override of the derive-from-section-nodes lean. This is an ADDITIVE schema change to the local node/knowledge types - extend the frozen set additively (mirror the CONTRADICTS / SELECTED_REACH additive idiom in navigation/*.cjs) and update the drift test. Frame membership records which section nodes / topics compose each live frame. SUPERSEDES the graph-readiness gap-1 "derive, do not mint" recommendation below.
- **D-Q4 (confidence threshold) - start at 0.70, tunable.** Reuse the frozen Shape-F 0.70/0.15 detent as the act/tell line: at/above 0.70 Larry may act-and-report (hedged); below 0.70 the move becomes offer-as-question; below ~0.40 OR requires_judgment trips the P0-6 override. The exact number is a TUNABLE output of the Bruce harness, not a fixed constant.
- **D-Q6 (surface tag) - two-value `surface: navigator | internal`.** navigator = methodology + navigator-utility (funding, file-meeting, doctor, heal, deck, show, scout, opportunities, present, dashboard, wiki, graph, room, rooms, memory, setup, onboard, ignite, snapshot, publish, export, reanalyze, speakers, status, radar, organize) + meta (act/pipeline/suggest-next); internal = the plumbing set (dogfood-flush, dial-memory-refresh, hmi-status, feynman-timeline-refresh, memory-cortex-reach, brain-derive, correct-reference-now, ingest-methodology, new-surface, admin, splash). Tag spans BOTH the CLI registry and the MCP router surface (item 0b).
- **D-Q1 (FUSION cadence) - boundary-pass first, add continuous if needed.** Run the cross-frame synthesis at session boundaries first (cheap); add continuous per-turn scanning only if the Bruce catch-rate is low (the German-resilience miss was mid-conversation, so continuous is the likely follow-on).

## Open questions still to resolve (deferred to plan)

- Q2: job-test visibility - invisible-for-peers vs visible-for-learners.
- Q3: web-fetch on tell-mode sensitive personas - silent vs announce-but-do-not-ask.

## Canon

Part 3 (GUIDED tri-context gate, hedging-always-on, offer-not-assert), Part 7 (wire shipped pieces, mint no new engine/reach; adopt Plurai, do not hand-roll eval), Part 8 (LOCAL stays local; only generic handles, bias-shape, framework-names egress; Tavily/Brain/Plurai carry no user artifacts), Part 11 (born-wired), Part 12 (invisibility + De Stijl voice mark; the tester-loved colors).

## Known issue flagged during registration

ROADMAP.md body edits for Phase 205 kept reverting to git HEAD after cascade-complete / plugin-reload (the phase DIRECTORY survived; the tracked ROADMAP body did not). Root cause to investigate: a PostToolUse cascade hook or the /reload-plugins resync appears to restore ROADMAP.md to committed state. Until fixed, this CONTEXT file is the durable source; re-add the ROADMAP heading via /gsd-phase and verify it persists.

## Decision registry (parallel-session start-here, 2026-07-01)

Everything a parallel session needs to start 205. All decisions navigator-approved this session.

### Locked decisions (discuss-phase)
- **D-Q5 frame boundary = MINT a first-class Frame node** in room.db (additive to node/knowledge types; mirror the CONTRADICTS/SELECTED_REACH additive idiom; update the drift test). Overrides the derive-lean.
- **D-Q4 confidence threshold = start 0.70** (reuse the frozen Shape-F 0.70/0.15 detent), override below ~0.40 or requires_judgment; TUNABLE via the Bruce harness.
- **D-Q6 surface tag = two-value `surface: navigator|internal`** spanning CLI + MCP; navigator-utility (funding/file-meeting/doctor/heal/deck/show/...) is navigator, plumbing (dogfood-flush/hmi-status/refresh/brain-derive/...) is internal.
- **D-Q1 FUSION cadence = boundary-pass first**, add continuous only if the Bruce catch-rate is low.
- **Keep the ASK/TELL/GRILL gears AND add the three elevation types alongside** (navigator-directed; not a rip-and-replace).

### Doctrine SHIPPED this session (do not redo)
- **Canon RATIFIED v1.21** (parallel session): Part 12 "three directions of elevation" + unified principle + four-check + hedged-tone + surface obligation; Appendix D entry 34; frozen scalars byte-identical.
- **Larry behavior change SHIPPED** (commit 3861be05): `skills/larry-personality/SKILL.md` "Three Directions of Elevation (Part 12)" section (vertical/horizontal/lateral, persona-ratio, hedged-always, four-check, clarify-vs-reframe, artifact!=conversation, Shape-F vocabulary) + `agents/larry-extended.md` terse always-on pointer (single source of truth = the skill).
- **188.1 SHIPPED** (parallel): Shape-F elevation labels in `lib/hmi/dial-label-composer.cjs` (kills the "No specific job" blank); tests 14/14.
- **Drift guard SHIPPED**: `tests/test-205-elevation-doctrine-floor.cjs` (45 assertions; canon<->skill<->body consistency). Deterministic; run in CI.

### Still to BUILD in 205 (the engine)
- SENS-10 circularity sensor in `lib/core/insight-sensors.cjs` (SENS-09 taken by Phase 170); four-cause/four-exit selector.
- The Frame node (D-Q5) + FUSION router (brain_ask DirectiveEnvelope -> JTBD job-test -> horizontal/lateral) + session-boundary quorum.
- Ranker flip in `lib/workflow/f-selector-ranker.cjs::rankForSelector` (ASK-as-clarification never the recommended detent when SENS-10 fires).
- GRILL two-arm (bias-consult + bono-fan validation, Tavily/WebFetch, plan-gated via deep_research).
- The `surface:navigator|internal` registry tag (D-Q6).

### Eval suite (LIVE, Plurai/IntellAgent, optimized LLM 2026-07-01)
- cross-frame elevation `cross-topic-connection` 0.938 -> https://run.plurai.ai/ioa/v1/cross-topic-connection/1.0.0 (classifier 9e4b0f4e-11a0-4620-8f9f-44b9d751a378)
- anti-circular `ai-turn-progress-evaluator` 0.938 -> .../ai-turn-progress-evaluator/1.0.0 (8b4d1181-1400-43d7-8593-f05322582d9e)
- reach+gate `reach-gate-choice-classifier` 0.900 -> .../reach-gate-choice-classifier/1.0.0 (4f36e330-e968-4fc3-b2a6-a1c5af416714)
- voice-signature `de-stijl-mark-classifier` 0.750 -> .../de-stijl-mark-classifier/1.0.0 (8c2ccc55-6407-43ca-92b6-16bf74982756). LAGGARD: make hybrid (deterministic detectVoiceMark for presence/placement/count; LLM only for color-move match). Golden data pending real Test 6 transcript (scrub PII first, Part 8).

### Tester findings feeding 205 (docs/testers, gitignored)
- N1 artifact!=conversation (clean deliverables + placeholders) -> filing layer.
- N2 initial-target-market discipline (5 buyers not $47B TAM) -> /mos:mullins.
- N3 portfolio-scale FUSION (batch-score N techs, surface the hidden gem) -> 205 + 200; possible new phase.
- N4 naming: "Mindry" is the user-chosen name (Midjourney collision risk) -> branding, navigator's call.
- Validation: anti-circular fix landing (Gaurav "it LED me to the conclusion"; Devoushka "not beating around the bush"); Lawrence field-confirms persona-ratio (Oliver session).

## Next

`/gsd-discuss-phase 205` (reads this file), then `/gsd-plan-phase 205`. Blocker for /gsd-plan-phase: roadmap-hygiene (get-phase found=false for all 196/188/200-205; relocate into `## Phase Details`) OR run 205 in a dedicated worktree.
