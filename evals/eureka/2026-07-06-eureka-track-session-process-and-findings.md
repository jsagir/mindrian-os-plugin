# Eureka track working method + 2026-07-06 session findings

> Registered per navigator request: "register the process we did here, what we found, and how,
> to the Eureka engine research and the rethinking-mindrianos room." This is the reusable
> RECIPE for working the Eureka 211-215 track (the "how"), plus what this session produced (the
> "what"). Mirrored into `rethinking-mindrianos/research/` and `mindrianOS/research/`.

## A. The process (the reusable method - the "how")

Eight moves defined how this session worked. They are the repeatable playbook for the Eureka
track and dev-track architecture work generally.

1. **Verify the premise against live code before trusting a planning doc.** Phase 212's CONTEXT
   opened with "Phase 211 has not shipped, zero executed code" and posed a Path A/B fork on it.
   A 3-minute check of `package.json` + `lib/core/eureka/` + `211-05-SUMMARY.md` proved that
   stale; the fork was moot. Rule: a CONTEXT/RESEARCH claim about what exists is a hypothesis,
   not a fact, until grepped.

2. **Ask the room first, add online research only where the room is thin, attribute every
   source.** The standing session directive. Each research pass consulted the
   rethinking-mindrianos room BEFORE the web, went online only for genuine gaps, and tagged every
   finding `[room]` (path+section) / `[repo]` (path+line) / `[web]` (clickable URL) / `[my
   inference]`. Proof it works: the 215 pass returned room-AGREE rows for the architecture and
   only 2 web-cited gaps (AHP mechanics, weak-signal tail) the room genuinely did not hold.

3. **Fix blockers as isolated GSD quick tasks BEFORE planning the dependent phase.** The two
   production blockers (embedding OOM, vec0 load) were closed as `260706-4yl` and `260706-5b7`
   before Phase 212 was planned, so the 212 plan could reference them as done/excluded instead of
   carrying them as risk. Keeps each phase's scope clean.

4. **Split at a Decision Gate rather than silently dropping scope.** Phase 212's ROADMAP goal
   bundled two separable jobs (critic + graph substrate). Instead of quietly building one and
   dropping the other, the split was made explicit at an AskUserQuestion gate: 212 critic-only,
   212.5 registered as the tracked home for the substrate half. Nothing reads as dropped.

5. **Two-way compositing - the room self-corrects.** Findings were filed BACK into the room,
   including corrections to the room's OWN earlier claims. This session's vec0 fix proved
   sqlite-vec loads on Node 22 (via an `allowExtension` handle), correcting the room's and
   212-RESEARCH's shared ">=23.5.0 required" assumption. The dev repo gets the executable
   decision; the room gets the reasoning AND its own corrections.

6. **Validate research against NAMED prior art, not "go read the room."** The 213/214/215
   researchers were each pointed at the specific room entries relevant to their phase and told to
   state where the ROADMAP approach AGREES vs CONFLICTS with each. This turns research from
   summary into validation and surfaces conflicts (215: the manual drafts exist BECAUSE the
   pipeline could not run at scale - a conflict the ROADMAP had not named).

7. **Workflow for design+build: reconcile -> design panel -> build -> adversarial verify.** The
   graph/doc fix ran as a deterministic workflow: one agent reconciles the numbers, a 3-way
   design panel is judged by two diverse lenses (a user who must navigate it + an engineer who
   must build it), the winner is built and the doc rewritten in parallel, then an adversarial
   verifier headless-loads the result. Design choices with a wide solution space get a panel; the
   result gets an independent skeptic.

8. **Honest count discipline - candidate vs verified never blurred.** Every opportunity number is
   stated with its noun: candidate pairs != shared problems != hand-written statements !=
   critic-verified opportunities. Inflating any of these into a single "opportunities" figure is
   the failure this discipline exists to prevent.

## B. What we found (the locked findings this session)

- **Phase 211 shipped and its two production-scale blockers are fixed.** (1) Embedding OOM: the
  spine embedded all 2117 nodes in one forward pass (~26.7GB ONNX allocation); fixed with a
  batch loop (`260706-4yl`). (2) Offline vec0: backend was inferred from table existence without
  probing the extension load; fixed with a capability probe (`260706-5b7`). `run-all-211.sh` PASS=9
  FAIL=1 (the 1 is a pre-existing env-dependent rerank test, proven pre-existing by revert-repro).

- **Node >=23.5 was a false floor.** sqlite-vec loads on Node v22.22.2 with a `better-sqlite3`
  `allowExtension` handle (`vec_version()`=0.1.9 live). The >=23.5.0 figure applies only to the
  built-in `node:sqlite` binding, which the plugin does not use. No Node floor change needed.

- **Phase 212 planned critic-only** (5 plans / 4 waves): local two-stage Grounding Guard (Stage A
  deterministic gates -> rubric-not-Likert -> verdict-by-code) + a thin `eureka_critic` MCP tool
  whose ONLY Part 8 boundary crossing is the abstracted feature vector. Embedder locked to
  `mdbr-leaf-ir`. The >=0.85 calibration is a human-verify checkpoint.

- **Phase 212.5 substrate = Burt structural holes, internal-edge only.** Whitespace/bridge
  detection should use Burt network constraint `c_ij = (p_ij + Sum_q p_iq p_qj)^2` and effective
  size (Borgatti `n - 2t/n`), computed purely from the room's own edges. This is structurally
  immune to the SEED-018 degeneracy the old whitespace engine hit on small rooms (which defined
  gaps by absence-against-external-vocabulary and exploded into "everything this room lacks").

- **Phase 213 (reach-wiring, THE KEY) - wire into the SOFTENED semantics, not the ROADMAP's
  pre-210 binding forms.** The one real conflict: the goal sentence names 190/202/205 in their
  pre-Phase-210 "build-gate / disqualifier / elevation tree" forms, but Phase 210 softened all
  three (verified live: R16 advisory, `apo-loop.cjs:47` "SIGNAL not a gate", `fusion-router.cjs:516`
  quorum "SUGGESTS"). 213 wires into the softened forms. The room raises the stakes: 213 is the
  FIRST born-wired-at-feature-time proof (`04-synthesis` Step 2), and its once-empty dir was
  exhibit-A of the "wire later, wire never" failure. SENS-13 verified free (SENS-01..12 live) and
  must ride the FROZEN `deep_research` reach. Execution stays gated on the curing-track verdict +
  212-05 >=0.85 calibration; planning may proceed.

- **Phase 214 (find-analogies) - almost pure assembly, one Part 8 gap found.** The decorative-stub
  claim confirmed three ways; the `archimedes-darkmatter` Type-3 gold case is on disk. The Part 8
  "online" tension resolves precisely: the web is the SIGNAL channel; only the SAPPhIRE-abstracted
  pattern vocabulary crosses outbound, gated through `auditQueryString`. REAL GAP: the Phase 196
  runtime hook matches `mcp__brain_.*` only (`hooks/hooks.json:216,318`), so Tavily egress needs
  inline audit wiring, not a new fence. Only genuinely new code: the two-leg fitness fusion (text
  cosine + SAPPhIRE rubric layer-match).

- **Phase 215 (portfolio fusion) validates against room + web.** AHP 3-dimension scoring + the
  weak-signal low-attention/high-growth tail flag agree with room prior art; AHP mechanics and the
  weak-signal thesis were the two genuine web-cited gaps. Open question for planning: compose the
  AHP tail-flag WITH Burt betweenness (a possible 215 -> 212.5 dependency).

- **Cross-cutting proof the compositing loop works:** the Node-22 correction filed into the room
  mid-session propagated to ALL THREE downstream researchers (213/214/215) - each independently
  refused to carry the >=23.5 floor, citing the room entry. A finding filed back became binding on
  the next research pass. That is move 5 (two-way compositing) demonstrated end-to-end.

- **The JHU catalog idea-graph exists as ranking substrate.** From `lens3_crossdomain_pairs.csv`:
  cross-domain candidate pairs across 84 shared problems, with the highest-degree hub technology
  the visual form of the portfolio-fusion payoff. (Navigability + canonical-count reconciliation
  in progress via the graph/doc workflow at time of writing.)

## C. Evidence trail (commits this session)

- `c222ff7d` / `7ec75b5e` - embedding OOM batch fix + test (quick 260706-4yl)
- `73698c73` / `37ed9c67` - vec0 capability-probe fix + test (quick 260706-5b7)
- `872a93b4` - 212-RESEARCH (cited)
- `d190e270` - 212 plans (5/4 waves) + VALIDATION + 212.5 stub
- `be7b11c1` - CSV idea-graph v1 (being redesigned for navigability)
- gitignore Part 8 hygiene fix (room.db patterns)
- Room entries: `2026-07-06-phase212-blockers-fixed-node22-vec0-correction`,
  `2026-07-06-whitespace-structural-holes-algorithm` (both mirrored to mindrianOS)

## D. In flight at time of registration (honest)

- Phases 213/214/215 research: ALL RETURNED (findings folded into section B above). Committed
  `08e499bf` (213), `45257898` (214), and the 215 RESEARCH.md. PLAN.md files not yet written -
  planning is the next step, gated as noted (213/214 execution waits on the curing-track + 212-05).
- Per the Dev-Research Compositing rule, the 213/214/215 RESEARCH passes still owe a room mirror in
  rethinking-mindrianos (the 213 researcher explicitly flagged this) - a follow-up compositing step.
- The graph navigability redesign + Oliver-doc rewrite + canonical-count reconciliation workflow -
  not yet returned. The final canonical counts and the navigable graph supersede the v1 graph.

This record is updated as those land; the METHOD in section A is stable regardless.

## Cross-references

- `.planning/phases/21{1,2}-*` (the shipped + planned phases), `.planning/ROADMAP.md` Phase 212.5
- `.planning/seeds/SEED-048/049/050` (the seeds this track implements)
- rethinking-mindrianos: `2026-07-06-phase212-blockers-fixed-node22-vec0-correction`,
  `2026-07-06-whitespace-structural-holes-algorithm`, `2026-07-06-jhtv-d15-real-room-test-and-opportunity-formula`
- `evals/eureka/README.md` (the critic gold-set + COMPRESSION metric this track calibrates)
