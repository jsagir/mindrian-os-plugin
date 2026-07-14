# SEED-041 - Shape F Declaration Mandate (canonical ruling: every new surface declares its HITL shape)

**Registered:** 2026-06-30 (navigator-directed, train session)
**Class:** CANON + CODE + PROCESS | **Depends on:** Canon Part 11 (CIRS born-wired gate), Part 3 (Shape F family), Phase 125 (f-selector-ranker), Phase 121.5 (body_shape orthogonality), Phase 188 (F.8), Phase 178 (R15 render-coverage gate)
**Provenance:** navigator-directed out of the Shape-F explainer + full-catalog mapping session. The mapping proved every one of the 103 commands + ~140 frameworks already resolves to a Shape F - so the shape should be DECLARED and ENFORCED, not left implicit/computed-after-the-fact.
**Status:** shipped (added 2026-07-14, this file had no status field at all). `scripts/check-shape-declaration.cjs` confirmed present in the repo; built in Phase 190 (190-03-PLAN.md, "check-shape-declaration.cjs gate core + fixtures + tests"), enforcement mode set to advisory-by-default (with `--strict` override) in Phase 210 (210-02-PLAN.md). Verified during a full-corpus curation pass.

## The ruling (what becomes canonical)

Canon Part 11 (CIRS) says every invocable surface is born WIRED or EXCLUDED. This adds the THIRD born-clause:

> **Every invocable surface is born with a DECLARED HITL SHAPE.** A command/agent/pipeline/framework that reaches a genuine fork MUST declare, in its frontmatter, which Shape F selector fires at its close (`hitl_shape: F.x`) and WHY (`hitl_why:` - one Feynman line justified against the decision rule below). A surface with no fork declares `hitl_shape: none` with a reason. The build fails closed if a forking surface ships without a declared shape, mirroring the born-wired R1/R2 gate.

## The decision rule (the canonical heuristic the gate references)

One question decides the shape: **do the steps depend on each other's order?**
- Ordered / dependent (step N needs N-1) -> **F.9** cascade + **F.2** path
- Independent / any-order set (fill or score a subset) -> **F.8** multi-select
- Parallel branches to resolve -> **F.5**
- Single move / yes-no gate -> **F.1 / F.0**
- Depth budget -> **F.3** ; harvest scope -> **F.4** ; plan review / JTBD-aware -> **F.6** ; ranked capability reaches -> **F.7**

(The human-readable ruling-system reference is the Shape-F explainer: https://mindrian-f-shapes.vercel.app - the 10 shapes, the per-shape used-by lists, graph/memory behavior, and JTBD.)

## Enforcement (born-declared gate + GSD wiring)

1. **Frontmatter contract.** New required keys on every command/agent/pipeline: `hitl_shape:` (F.0-F.9 or `none`) and `hitl_why:`. Orthogonal to `body_shape:` (layout) per Phase 121.5 decision 4 - `body_shape` is the body LAYOUT, `hitl_shape` is the SELECTOR that fires at close. A command may carry `body_shape: B` AND `hitl_shape: F.1`.
2. **CI tripwire.** `scripts/check-shape-declaration.cjs --check` (new): scans every command/agent frontmatter; FAILS the build if a forking surface lacks `hitl_shape`+`hitl_why`, OR if the declared shape CONTRADICTS what `lib/workflow/f-selector-ranker.cjs` would compute (truth-telling, not drift-blessing). Wired into the release gate beside the born-wired + render-coverage checks.
3. **GSD wiring.** Any CODE phase that introduces a command MUST capture `hitl_shape`+rationale as a LOCKED decision:
   - `/gsd-discuss-phase` adds a standard gray-area: "Which HITL Shape F does this surface fire, and why?" (auto-asked for command-introducing phases).
   - `/gsd-plan-phase` plan template includes the shape declaration; `gsd-plan-checker` flags its absence.
   - `/gsd-verify` confirms the shipped frontmatter matches the planned declaration.
4. **Canon amendment.** Part 11 gains the third born-clause + an Appendix-D entry; rides the entry-31 posture released in Phase 188. Frozen Part 3 scalars (MAX_K=3, DIAL_REACH_K=6, 0.70/0.15) unchanged - this mandates DECLARATION, it does not touch the shapes.

## Why this is the moat, not bureaucracy

The shapes are the HITL contract - they are WHERE the human stays in the loop (Canon Part 10 navigator authority, Part 12 invisibility). Leaving the shape implicit means a future command can ship that quietly decides FOR the navigator (a single-select prose offer over a set that should have been an F.8 basket - the exact GIX bug that motivated Phase 188). Declaring the shape at birth makes navigator authority structural and un-skippable, the same way born-wired made invocation un-skippable.

## Acceptance (when it earns a phase)

- Part 11 third born-clause ratified (navigator-gated) + Appendix-D entry.
- `hitl_shape`+`hitl_why` present on every forking command/agent/pipeline (backfill the existing 103 from the catalog already mapped on the explainer page).
- `scripts/check-shape-declaration.cjs --check` green; wired into the release gate; fails closed on a missing or contradicting declaration.
- GSD discuss/plan/verify capture + check the declaration for command-introducing phases.
- Frozen Part 3 scalars unchanged; no em-dashes; Part 8 clean (declaration is LOCAL frontmatter, zero Brain wire).

## NEXT
Promote to a phase. The backfill is cheap because the full command->shape map already exists (the explainer page + this session's mapping). `/gsd-phase` to register, then `/gsd-discuss-phase`.

---

## CRITICAL UPDATE (2026-06-30) - the full-catalog mapping is DONE, and it changes the ruling

The Shape-F explainer was built out into a COMPLETE, verified mapping of the entire surface. Three findings upgrade this seed from "declare a shape" to "declare a shape PER STAGE":

### 1. Canonical human-readable reference (the ruling now has a live spec)
**https://mindrian-f-shapes.vercel.app** is the canonical reference for this mandate. It carries: the 10 Shape-F selectors (F.0-F.9) animated, each with What/How/HITL + the per-shape used-by list + graph/memory behavior + a JTBD; the full command+framework->shape map; the engine stage-flows; and the complete Neo4j framework appendix. The CI gate's error message + the GSD discuss-phase gray-area should LINK here. (Hosted at `~/mindrian-f-shapes/index.html`.)

### 2. Backfill is no longer "cheap" - it is ALREADY DONE as data
Coverage is verified complete, not estimated:
- **103 / 103 commands** mapped to a shape (incl. `mos:act` = F.7 dial). Audit script proved every command file has an explicit row.
- **177 / 177 Neo4j Framework nodes** mapped, with 37 flagged as aliases (the dedup clusters) and 9 as non-framework noise. The appendix IS the backfill source-of-truth; the phase just transcribes it into frontmatter.

### 3. THE RULING CHANGES: declare a shape PER STAGE, not one per surface (load-bearing)
The engine stage-flow analysis proved an intelligence engine / pipeline is NOT one shape - it is a STAGE PIPELINE where parallel stages are F.8 (independent fan-out), ordered stages are F.9/F.2 (each step needs the last), punctuated by human gates. BONO is the exemplar and says so in its own frontmatter: `Shape F front door -> parallel cell fan-out (F.8) -> sequential inter-hat debate (F.9) -> approve+file gate (F.0)`. Same for rs-fetch (F.0 gate -> F.2 -> F.8 fetchers -> F.9 scoring -> F.2), Trending-to-Absurd (F.3 -> F.5 -> F.8 rings -> F.8 -> F.2), research, and the 3 pipelines.

**Therefore the mandate gains a second frontmatter key for multi-stage surfaces:**
- Single-fork surface: `hitl_shape: F.x` + `hitl_why:` (as before).
- **Multi-stage surface (engine/pipeline): `hitl_stages:` - an ORDERED list of `{stage, shape, mode}` where `mode` is `parallel` (F.8) | `ordered` (F.9/F.2) | `gate`.** The CI check (`check-shape-declaration.cjs`) validates each stage's shape against what the orchestrator actually runs (fan-out call -> must be F.8/parallel; sequential chain -> F.9/F.2; a Decision Gate -> gate). A multi-stage surface that declares a single flat `hitl_shape` for a genuinely staged engine FAILS the gate.
- This makes the parallel-vs-sequential structure of every engine a DECLARED, checked contract - the place navigator authority enters at EACH stage, not just at the end. It directly prevents the inverse of the GIX bug: an engine that quietly runs a material stage without a gate.

### 4. Dedup worklist falls out of the same mapping (cross-ref)
The 177-node pull surfaced 37 alias nodes (JTBD x5, Scenario x4, the PWS cluster, MECE, Reverse Salient, trend-extrapolation x4, ...) + 9 non-framework nodes. Because the CI check's f-selector-ranker contradiction test reasons over framework HANDLES, the dedup (SEED for `ALIAS_OF` merges) should land BEFORE or WITH this mandate so the handle space is clean. Cross-ref the Brain-dedup seed.

### 5. FIELD EVIDENCE (tester meeting, 2026-06-30) - this is the WHY, in the navigator's own words
A live tester cohort call on v1.15.0-beta.13 is primary evidence for this mandate (and for SEED-040):
- **The vision is the mandate.** Navigator, verbatim: "that's exactly the new update - I'm trying to add this gate of human-in-the-loop to every decision... every stroke in the conversation gives you this menu that helps you decide next steps and explain why." That IS born-declared Shape F on every command.
- **The why, verbatim:** "Without it I'm flying blind - guessing what it's trying to do. With this you see the structure, the workflow." The shape is the difference between a visible workflow and a black box. This is why it must be declared, not implicit/computed-after.
- **Fire-from-context, not pre-decided:** "it needs to happen without pre-deciding when a scenario analysis is a perfect fit - it needs to understand it from the context... whether it proposes scenario analysis at the right time, and does it stop / use the menu properly." The declaration is what makes "used the menu properly" auditable; the firing is the sensor->decide()->reach path.
- **Tester signal that the F-gate direction is already working:** beta.13 behavior shifted - "the questions were more real, easy to answer"; "it actually came to a conclusion I can follow"; the room-build "research vs explore" gate was noticed and praised unprompted ("I appreciate that it asks whether you want to research or just explore"). The menu-gate direction validates in the field BEFORE the mandate even lands.
- **Persona entry gates** (student / researcher / venture / hypothesis) the navigator is about to ship to testers = Phase 115; each tester enters through one gate = the live test.

### NEW REQUIREMENT surfaced by the field evidence - the FLOW-VALIDATION REPORT
The navigator stated the test is about FLOW, not RESULT: "not in terms of the result, more in terms of the flow of the conversation. Does it trigger and fire the right things at the right time? ... if we have the workflow figured out." This is only auditable if every surface declares its shape. **So the mandate's load-bearing payoff is a flow-validation report:** for a given session/transcript, emit per-step `{step, command/framework fired, declared_shape, shape actually rendered, fired_at_right_time?}` - the declared-vs-actual diff that tells the navigator whether the right thing fired at the right time. This is the report-extraction surface the navigator keeps asking testers for. The declaration mandate is the PRECONDITION (no declared shape -> nothing to validate flow against); the report is the dividend. Add it to the phase scope.

### 6. CHAINING CONTRACT from the 103-command relationship map (fan-out, 2026-06-30)
A fan-out of one research agent per command (103 dossiers + `.planning/research/command-map/INDEX.md`) established the chaining substrate the declaration mandate governs. Findings that become contract:
- **The graph IS the chaining contract.** A command's downstream targets are its Framework node's `FEEDS_INTO` / `PREREQUISITE` edges in Neo4j, resolved back to commands via `command-resolver.cjs`. Example spine: `diagnose` FEEDS_INTO root-cause / validate / structure-argument / challenge-assumptions / mullins; `explore-domains` FEEDS_INTO beautiful-question / trending-to-absurd / score-innovation / value-proposition. So a SECOND CI check falls out: a multi-stage surface's declared `hitl_stages` chain order must be consistent with the Neo4j FEEDS_INTO direction (a stage cannot feed a stage that is its graph prerequisite).
- **Two-halves coverage (load-bearing for the mandate's scope):** 52/103 commands own a graph node with edges (the C1-C8 methodology + intelligence half); 51/103 are deliberately graph-free (meta-orchestrators act/pipeline/ignite that route OVER the graph via runChain, plus pure room/present/install utilities). The declaration mandate applies to BOTH halves, but the FEEDS_INTO consistency check only applies to the 52 graph-backed commands; graph-free surfaces declare a shape + why with NO chain-consistency obligation (they have no graph edges by design - that is correct, not a gap).
- **`diagnose` is the routing hub** - it classifies the ProblemType (UDP/IDP/WDP) that the dynamic chain derivation consumes; its declared shape (F.0/F.1 classify-gate) and its FEEDS_INTO fan-out are the single most important declaration to get right.
- **Hard-coded pipelines** (`pipelines/{name}/CHAIN.md`: discovery = explore-domains -> think-hats -> analyze-needs; thesis = structure-argument -> challenge-assumptions -> build-thesis) are pre-declared chains; their CHAIN.md stage order is the authoritative `hitl_stages` source for those pipelines.
- **One true orphan** (`correct-reference-now`: no node, no related commands) + 4 near-orphans (hmi-status, organize, dogfood-flush, memory-cortex-reach) - the only surfaces the connector spine does not reach; flagged for wiring.

### Updated acceptance (supersedes the per-surface-only version)
- Single-fork surfaces carry `hitl_shape`+`hitl_why`; multi-stage engines/pipelines carry `hitl_stages` (ordered {stage, shape, mode}).
- `check-shape-declaration.cjs --check` validates BOTH forms and fails on a flat declaration for a staged engine, or a stage mode that contradicts the orchestrator (parallel call not F.8, sequential chain not F.9/F.2, un-gated material stage).
- The explainer page is linked from the gate error + the GSD gray-area.
- Backfill transcribes the verified 103-command + 177-node map; dedup lands first/with.
- Frozen Part 3 scalars unchanged; Part 8 clean; no em-dashes.
