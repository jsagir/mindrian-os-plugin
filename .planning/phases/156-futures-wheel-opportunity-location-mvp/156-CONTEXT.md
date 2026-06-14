# Phase 156: Futures Wheel opportunity-location MVP - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

A new `/mos:futures [concept]` command that does what a linear human cannot: builds a bounded multi-ring consequence wheel (1st/2nd/3rd-order, flat artifacts under the Opportunity Bank, NO sub-rooms) and surfaces the invisible cross-domain ripples a human misses, then locates opportunities. It is the consequence-graph HUB of an 8-partner foresight meta-lens chaining web. Assemble-not-rebuild: orchestrates the shipped ICM backbone, HSI engine, RS engine, opportunity-ops, research-corpus, and the 150.10 chaining web. v1.13.1 milestone.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**13 requirements are locked.** See `156-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `156-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- New `/mos:futures [concept]` command (spine-wired, Part 7-justified as chain-not-duplicate hub)
- Bounded multi-ring (1st/2nd/3rd-order) consequence generation as flat artifacts under `opportunity-bank/futures-<seed>/`
- Advisory linguistic causal-cue flagging (reuse, no ML)
- `horizon` + `confidence` + PESTEL `domain` frontmatter on consequence artifacts
- `ROOT_CAUSES` + `ENABLES` cascade edges via navigation.cjs
- Explicit HSI scan step (compute-hsi.py -> hsi-to-graph.cjs) over filed consequences
- Hidden-bridge surfacing at a tri-context Decision Gate
- Foresight meta-lens chaining web: Decision-Gate handoff HOOKS to 8 partners, resolved via the Phase 122 command resolver
- Bounded SIGNAL research step (seed grounding + per-ring on-demand), 30-day cached
- Subsystem impact map (PESTEL-domain) render mode
- Opportunity banking with edge provenance via opportunity-ops.cjs
- HITL proposed->confirmed gating (Part 3 / Part 9)

**Out of scope (from SPEC.md):**
- Sub-rooms as N-th-order nodes (SEED-004 gate) — flat artifacts + edges instead
- Unbounded depth/fan-out — capped (default 3 rings x 5)
- Reflection / prediction-audit scheduled pass
- Always-on / autonomous horizon scanning across external sources (the bounded on-demand research step is IN; always-on is OUT)
- Multi-agent specialization
- `LEADS_TO`/`CAUSES` edge types (not frozen-legal; `ROOT_CAUSES` covers cause->effect)
- New ML model / dependency for causal extraction
- DEEP integration of chained foresight tools — MVP ships handoff HOOKS only

</spec_lock>

<decisions>
## Implementation Decisions

### Command interaction
- **D-01:** Guided-by-ring generation. `/mos:futures [concept]` generates ring 1, the navigator approves/prunes, ONLY approved nodes expand to ring 2, repeat to the depth cap. The "and then what?" recursion is the literal command loop. NOT a one-shot pipeline (which would let the graph balloon before pruning and remove navigator steering).

### Approval granularity (HITL)
- **D-02:** Per-ring batch approval. One tri-context Decision Gate per ring (APPROVE / REJECT-with-reason / DEFER over the ring's consequences); pruned nodes do not expand. Balances control vs friction; pairs with D-01. Proposed->confirmed per Part 9; REJECT reasons become graph data per Part 4.

### Default render
- **D-03:** Subsystem (PESTEL) impact map is the DEFAULT view; the concentric consequence ring view is available on demand. Rationale: the instructor found the subsystem map the more usable, practical-first surface; the ring view stays for fidelity. (Reuses the `domain:` frontmatter from the spec.)

### Chaining-web surfacing
- **D-04:** Top-N ranked handoffs, mirroring the shipped 150.x capability dial (top-3-of-N). The wheel surfaces the 2-3 most relevant foresight handoffs (ranked) rather than the full 8-item menu (noisy) or only-when-triggered (less discoverable). Consistent with the existing reach UX; resolves through the Phase 122 command resolver.

### Research / SIGNAL step (FW-13)
- **D-05:** Two fire points — (a) seed grounding up front (research the seed concept to inform ring-1 generation) AND (b) per-ring on-demand (navigator fires a research pass over a ring's consequences). Each pass corroborates confidence + evidence tier (Part 5) and surfaces weak signals that propose additional consequences. Reuses `research-corpus.cjs` + `research-cache.cjs` (30-day cache) + the Phase 131 workflow + `/mos:research`. Bounded + cached; NOT always-on. Part 8: generic domain handles only, zero room-content egress.

### Claude's Discretion
- The advisory causal-cue lexicon internals, the Artifact-node registration mechanics into room.db (required before HSI runs), the exact HSI invocation wiring, the navigation.cjs write calls, the subsystem-map render implementation, and the command's script-vs-markdown-orchestration shape are left to research + planning. Constraint: reuse existing helpers; no new dependency.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec + source vision
- `.planning/phases/156-futures-wheel-opportunity-location-mvp/156-SPEC.md` — Locked requirements (13) — MUST read before planning
- `.planning/seeds/SEED-025-futures-wheel-agent.md` — the vision + MVP-vs-grand scoping
- `.planning/research/futures-wheel-agent-20260614/futures-wheel-agent-research.md` — the agent loop (SEED->SCAN->REASON->PROPAGATE), ICM+HSI grounding, open challenges

### Engines to assemble (HSI + RS + opportunity bank)
- `scripts/compute-hsi.py` — HSI computation; writes `.hsi-results.json`
- `scripts/hsi-to-graph.cjs` — reads HSI results, writes `HSI_CONNECTION` + `REVERSE_SALIENT` edges; REQUIRES consequences to pre-exist as `Artifact` nodes
- `scripts/rs-engine.py` + `lib/core/bridge-writer.cjs` — Phase 89 reverse-salient engine (internal/cross-room/external/hybrid)
- `lib/core/opportunity-ops.cjs` §`bankOpportunity` (line ~1123) — bank ADD with dedup/confidence/evidence

### Cascade edges + memory chokepoint
- `lib/core/navigation/edges.cjs` — frozen `ALLOWED_EDGE_TYPES` (incl. `ROOT_CAUSES` from Phase 150.8, `ENABLES`); the only legal edge types
- `lib/core/navigation.cjs` — the Part 9 write chokepoint (all graph writes route here)
- `docs/MINDRIAN-CANON.md` Part 4 (typed edges), Part 8 (LOCAL-only), Part 9 (proposed->confirmed) — constitutional constraints

### Research / SIGNAL leg (FW-13)
- `docs/RESEARCH-AS-WORKFLOW-STEP.md` — Phase 131 research-as-graph-aware-workflow
- `lib/core/research-corpus.cjs` + `lib/core/research-cache.cjs` — Phase 130.5 shared corpus + 30-day cache
- `commands/research.md` — `/mos:research` (wires findings as typed graph evidence)

### Chaining web (the 8 partners + resolver)
- `.planning/specs/systems-thinking-f-selector-design.md` + `.planning/phases/150.10-systems-thinking-f-selector/150.10-CONTEXT.md` — the 150.10 meta-lens chaining web pattern (M4<->RS, M3<->find-analogies+research) this generalizes
- `lib/workflow/command-resolver.cjs` (Phase 122) — the ONLY door for command handoffs; chaining resolves through it
- `commands/systems-thinking.md`, `commands/scenario-plan.md`, `commands/explore-trends.md`, `commands/analyze-timing.md`, `commands/dominant-designs.md`, `commands/diagnose.md`, `commands/mullins.md`, `commands/explore-futures.md` — the 8 foresight web partners (chain-not-duplicate per Part 7)

### Render + decision gate
- `skills/ui-system/SKILL.md` — Shape F.1 selector + tri-context Decision Gate (the approval surface)
- `lib/core/lazygraph-ops.cjs`, `lib/core/node-insert.cjs` — graph open/insert helpers used by hsi-to-graph

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- HSI pipeline (`compute-hsi.py` -> `.hsi-results.json` -> `hsi-to-graph.cjs`): drop-in hidden-bridge scan; emits `HSI_CONNECTION` (high |BERT-LSA| = invisible cross-domain bridge) + `REVERSE_SALIENT`. Gate: writes edges only between existing `Artifact` nodes (pair skipped if either is missing) — consequences MUST be filed as Artifact nodes before the scan.
- `opportunity-ops.cjs::bankOpportunity(roomDir, opportunity)`: bank ADD with problem_hash dedup, confidence-update, evidence-append. Needs `opportunity.problem` + `confidence` + `evidence`.
- `research-corpus.cjs` + `research-cache.cjs`: bounded external fetch with a 30-day cache — the SIGNAL leg engine.
- `command-resolver.cjs` (Phase 122): resolves chaining handoffs (never a hardcoded command string).
- The 150.10 chaining-web infra + `leverage-scan.cjs`: the precedent and partial wiring for meta-lens mutual invocation.

### Established Patterns
- All graph writes route through `navigation.cjs` (Part 9 chokepoint); only frozen `ALLOWED_EDGE_TYPES` may be written.
- `ROOT_CAUSES` (cause->effect) + `ENABLES` are frozen-legal (150.8 amendment) — no Part 4 amendment needed; `LEADS_TO`/`CAUSES` are forbidden.
- Decision Gates render via the Shape F.1 AskUserQuestion selector; top-N-of-K ranking mirrors the shipped dial.
- ICM Layer 0: every directory (incl. `opportunity-bank/futures-<seed>/`) gets a ROOM.md identity.
- Obsidian nested rule: each consequence artifact in its own named folder.

### Integration Points
- New: the `/mos:futures` command + a consequence-generation orchestrator + an advisory causal-cue helper + the subsystem-map render + the chaining-web hook surface.
- Connect to: navigation.cjs (writeNode/writeEdge/confirmNode), the HSI scripts, opportunity-ops, research-corpus, command-resolver, the F.1 selector.
- The consequence artifacts must register as `Artifact` nodes in room.db (research/planning to determine the exact registration path) — this is the load-bearing precondition for the HSI scan.

</code_context>

<specifics>
## Specific Ideas

- Live example to validate against (instructor's): "automobile adoption" -> ring 1 (no horses / gas stations / traffic lights) -> ring 2 (mass-production factories / working class / labor movements) -> ring 3 (middle manager invented / suburbanization / healthcare+retirement policy). The success test: the wheel surfaces a cross-domain ripple (e.g. "automobile -> middle manager") that the navigator did NOT explicitly draw.
- "The classical tool asked humans to imagine ripples. The agent watches the water." — the felt-experience north star.
- Source grounding: IRIS 2026 Session 2 (cohort 2026), already ingested as generic methodology into the Brain teaching graph in Phase 150.10.

</specifics>

<deferred>
## Deferred Ideas

- Sub-rooms as N-th-order consequence nodes (the fractal wheel) — gated by SEED-004 (nested-room write-scope bug, scheduled v1.14.0).
- Reflection / prediction-audit scheduled pass (compare past consequence predictions vs observed reality) — needs scheduling + the open foresight-evaluation problem.
- Always-on / autonomous horizon scanning across large external source sets — grand-vision research program (the bounded on-demand research step FW-13 is the MVP slice).
- Multi-agent specialization (Scan/Consequence/Propagation/Evaluation/Synthesis/Reflection sub-agents).
- DEEP integration of the 8 chained foresight tools (reworking each to natively consume the consequence graph) — MVP ships handoff hooks only.

</deferred>

---

*Phase: 156-futures-wheel-opportunity-location-mvp*
*Context gathered: 2026-06-14*
