# Phase 254: Orchestration projection consumption wiring - Context

**Gathered:** 2026-09-02 (navigator ruling captured live during this session, no separate
discuss-phase run -- `workflow.skip_discuss` is `true` for this repo)
**Status:** Ready for planning
**Source:** Navigator AskUserQuestion ruling + 254-RESEARCH.md's findings

<domain>
## Phase Boundary

Two things this phase actually is, and they are decoupled by design:

**1. A real, reproduced bug fix (Wave 1, entirely local, no Brain calls, unaffected by any
ruling below).** `/mos:suggest-next` and `/mos:act`'s chain-selection path
(`framework-chain-composer.cjs::recommendFrameworkChain`) walks a hardcoded 18-name generic
MBA-framework vocabulary that shares exactly 1 name with the 28 real PWS frameworks the
registry and the Brain orchestration projection carry. Executed live this session: every
problem type collapses to a 1-step chain, even though the surface's own body text promises a
step-numbered sequence. `lib/workflow/local-chain-recommender.cjs` -- a shipped, tested,
multi-hop chain recommender with earned per-edge confidence over the projection -- has zero
production consumers and its own header literally says "suggest-next reaches for this." Wiring
it in (projection-first, registry-composed floor when the projection has no edge, never a
straight replace -- a straight replace was proven live to turn the two most common cases into
empty) is a wiring job, not a build job.

**2. A governance ruling on server-side Brain composition (later wave, gated on the ruling
below).** The ROADMAP framed this as "approve/reject" as if introducing something new. Research
found it already ships in two places (`orchestration act*`'s Tier-3 live Brain call in
`brain-router.cjs`, and `suggest_next`'s chain offer in `sensors.cjs`), both released and
tested. The real question was "ratify vs remove two shipped behaviors," not a green-light
decision -- and the navigator has now ruled on it (D-01 below).

</domain>

<decisions>
## Implementation Decisions

### The composition ruling (the phase's central gate)
- **D-01 (navigator ruling, 2026-09-02, resolving the ROADMAP's "Open navigator ruling"):**
  RATIFY server-side Brain composition. The two existing sites (`orchestration act*` Tier 3,
  `suggest_next`'s chain offer) stay as shipped. This phase may knowingly add a third
  enumeration entry (see D-05) rather than treating composition as forbidden. Rationale
  (navigator-facing, from research): matches the already-ruled Phase 234 D-04 direction
  (governance moves server-side, host-independent); Desktop/Cowork have no MCP hook surface at
  all, so server-side composition is their ONLY Brain-grounded enrichment path -- removing it
  would be a real capability loss on those two surfaces, not a simplification.

### The one real gap the ratify decision surfaces
- **D-02 (Claude's call, low risk, research-recommended -- flag for override):** Close the
  `ambiguous`-verdict gap in `brain-client.cjs::callTool`'s Part 8 belt via **Option A
  (disclose-and-proceed)**: attach a typed disclosure to the response using the existing
  `refusal-messaging.cjs` / `brain_refusal` idiom `brain-router.cjs:414-422` already uses, so
  the navigator sees an ambiguous verdict rather than it silently passing through. Do NOT
  implement Option B (fail-closed on ambiguous) -- research flags it as changing behavior on all
  16 `callTool` wrappers at once, needing its own canary suite; that is out of this phase's
  scope. Do NOT attempt to render a Shape F.1 gate from inside `callTool` -- a gate belongs at
  the MCP handler (`lib/mcp/gate-render.cjs::renderGate`), never at the transport chokepoint.

### Blend, never replace
- **D-03 (locked from research, not a preference -- reproduced live):** The chain-selection
  source becomes projection-first with a disclosed registry floor:
  1. Try `local-chain-recommender.recommendMultiHopChains(seed)` -- multi-hop, earned confidence.
  2. If empty, fall through to today's `recommendFrameworkChain` + `composeWorkflow` answer.
  3. Either way, resolve frameworks to `/mos:` commands through `composeWorkflow` (R4, the one
     door) and posture through `recipe-maps.postureForCommand` (the one authority) -- neither is
     touched by this phase.
  4. Disclose the source (projection vs registry-floor) in the render, per Decision 8 (honest
     refusal, no silent degrade).
  A straight replace of `recommendFrameworkChain` was proven live to turn the two most common
  seeds (`Beautiful Question Framework` -- both the ill-defined case AND the no-problem-type
  default) into an empty result. This is not negotiable scope; it is a correctness requirement.

### Phase structure
- **D-04 (locked from research's own explicit recommendation):** Wave 1 is the local wiring fix
  (WIRE-01..04 below) -- zero Brain calls, R7-clean, Part-8-clean, Theo-zero-diff (see D-07),
  and NOT gated on D-01 either way. A later wave carries the composition governance work
  (COMP-01, COMP-02, D-02's fix) and is gated on D-01's ratify ruling, now resolved. The planner
  should structure waves so Wave 1 can ship even if a future session ever revisits D-01.

### Requirement IDs (none existed; research proposed this family, ratified here)
- **D-05 (locked from research's proposed family, Phase Requirements section):**
  - `WIRE-01`: `/mos:suggest-next` produces a multi-step chain sourced from the projection when
    the projection has edges for the seed.
  - `WIRE-02`: When the projection has no edge for the seed, the surface degrades to the current
    registry-composed answer with a disclosed source, never to empty.
  - `WIRE-03`: `/mos:act --chain` composes from the same source as `suggest-next`; the two
    cannot disagree.
  - `WIRE-04`: The three framework vocabularies (`KNOWN_FRAMEWORKS`, `command-registry.json`,
    the projection) can no longer silently diverge -- a drift gate fails the build. Checked
    against Phase 263's SEED-A (framework un-wired gate, Brain-repo, 0 plans, not started) --
    different concern (a Brain-repo live-population gate vs this phase's local build-time
    vocabulary-drift gate), no conflict, WIRE-04 proceeds independently.
  - `COMP-01`: Every `mindrian-os`-named tool handler that reaches the Brain is enumerated in
    one place and routes through the `callTool` belt.
  - `COMP-02`: The `callTool` belt's verdict handling matches the hook's, or the divergence is a
    stated, tested decision (this is D-02's fix).

### Fresh-measurement requirement for the composition wave only
- **D-06 (locked from research Section 6):** Wave 1 (projection consumption, local file read
  only) needs NO fresh measurement -- Phase 262's D-07 finding (0 `<SEP>` occurrences, 28
  framework nodes, dated 2026-09-02) covers it, independently re-confirmed this research
  session. The composition wave (if it adds or touches a live Brain call) DOES need a fresh,
  targeted probe: for each framework name a live composed call can return, assert it round-trips
  clean through `normalize_framework_name` without the alias fork Phase 262 traced (the
  hop-depth-1 defect that made "Scenario Planning" return 2 canonical matches). Build on
  `chain-recommender.cjs`'s existing `normalizeFrameworkName` retry leg.

### Theo forward-compatibility
- **D-07 (locked from research Section 5, standing CLAUDE.md rule):** The projection-consumption
  half (Wave 1) is a zero-diff surface at Theo cutover -- Theo explicitly decided (its own
  `09-04-PLAN.md`) never to sync the projection, confirmed by reading `orchestration-readiness.ts`
  directly. The composition half targets a surface Theo also needs adapting:
  `lib/brain/chain-recommender.cjs` is already on Theo's 7-file adaptation list.
  **`lib/mcp/brain-router.cjs` is NOT on that list and should be** -- its Tier 3 reads
  `next_gate.options[]`, an incumbent-only shape; post-flip it will silently fall through to
  Tier 2 with no refusal disclosure. This phase produces a written note adding it to Theo's
  list (message to Theo's session, per the 262 precedent -- never a code change to
  `/home/jsagi/Theo`). Additionally: `BRAIN_PROBLEM_TYPE_ALIASES` is already known-broken
  post-flip (projects onto the incumbent's `'Undefined Problem'` / etc., none of which are live
  Theo `DomainConcept` ids). Since this phase's Wave 1 touches the problem-type seed path
  directly, re-pointing those aliases now (cheap) rather than leaving them for a future
  rediscovery is in scope if the planner finds it fits Wave 1's budget; otherwise route it as a
  named follow-up, not silently dropped.

### Claude's Discretion
- Exact shape of the source-disclosure text in the `suggest-next`/`act` render (D-03 step 4) --
  no navigator ruling on wording, only on the requirement that a source is always disclosed.
- Whether `COMP-01`'s enumeration lives as a new file, a table in an existing doc, or inline
  comments at each of the (now three, post-this-phase) composition call sites -- research names
  the requirement, not the container.
- Whether the `BRAIN_PROBLEM_TYPE_ALIASES` re-point (D-07) lands in this phase's Wave 1 or is
  spun out as a named, tracked follow-up -- planner's call based on actual Wave 1 budget.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### This phase's own research
- `.planning/phases/254-orchestration-projection-consumption-wiring-suggest-next-act/254-RESEARCH.md`
  -- 836 lines, HIGH confidence. Sections 1-2 (the wiring bug and its fix), 3 (the composition
  ruling and its tradeoff table), 3.4 (the ambiguous-gap fix), 5 (Theo), 6 (D-07 sufficiency),
  "Validation Architecture", "Common Pitfalls" (8 named pitfalls, read all of them -- Pitfall 2
  in particular: do not treat server-side composition as a greenfield decision when writing the
  plan's own framing text) are all directly load-bearing.

### Cross-repo, read-only (do not edit from this repo)
- `/home/jsagi/Theo/src/mcp/content/orchestration-readiness.ts` -- the Theo-side "not synced"
  decision D-07 cites.
- `/home/jsagi/Theo/src/mcp/operational/chain-run.ts` -- the design-constraint precedent for
  server-side composition ("Theo owns the schema and wire shape, the plugin owns the behavior").

### Prior-phase artifacts this phase reads
- `docs/262-FLOOR-01-GAP-LEDGER.md` section 5 (the D-07 finding this phase's D-06 relies on).
- `data/brain-orchestration-projection.json` and `scripts/build-orchestration-projection.cjs`
  (the projection artifact and its generator -- 384 nodes, 28 frameworks, drift-gated).

### Repo conventions
- `CLAUDE.md` -- Canon Part 8 (LOCAL to BRAIN egress), Part 3 (Tri-Context Decision Gate),
  the Theo standing-consult bullet, WORKSPACE GUARD.
- `.planning/REQUIREMENTS.md` -- currently zero rows for Phase 254; this phase mints WIRE-01..04
  and COMP-01..02 per D-05.

</canonical_refs>

<specifics>
## Specific Ideas

- The measured defect table (every problem type -> 1-step chain) and the KNOWN_FRAMEWORKS vs
  registry/projection vocabulary mismatch (1 of 18 overlap) are already fully documented in
  254-RESEARCH.md Section 2.3 -- cite by reference, do not re-derive.
- `local-chain-recommender.cjs`'s live proof output (S-Curve Analysis -> Adoption-Capacity Theory
  -> Mullins Model, confidence 0.6314) is in Section 1.3 -- useful as a acceptance-criteria
  anchor for a wiring test.
- The three-seam table (model-issued / CLI-script / mindrian-os-handler) in Section 3.1 is the
  right mental model for COMP-01's enumeration.

</specifics>

<deferred>
## Deferred Ideas

- Adapting `lib/mcp/brain-router.cjs`'s reader to Theo's actual response shape -- that is
  flip-day work, once Theo serves traffic; this phase only gets the file added to Theo's
  adaptation list (D-07).
- Option B (fail-closed on `ambiguous`) for the `callTool` belt -- rejected for this phase per
  D-02; would need its own canary suite across all 16 wrappers.
- Re-measuring Phase 262's D-07 finding for Wave 1 -- explicitly not needed per D-06, already
  covered.

</deferred>

---

*Phase: 254-orchestration-projection-consumption-wiring-suggest-next-act*
*Context gathered: 2026-09-02*
