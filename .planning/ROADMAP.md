# Roadmap: MindrianOS Plugin

**Current state:** milestone v2.1.0 "Green the Floor" (status: planning, per STATE.md).
Phases 253-256 added 2026-08-20, sourced from the complete-system-loop research set
(`.planning/2026-08-20-FINDINGS-complete-system-loop.md` + BRIEF/ARCHAEOLOGY/LANGTALKS-COUNSEL
companions in the same directory). Confirmed by the navigator as part of the current
milestone, not a new one. Phase 257 added 2026-08-20 from a parallel host-portability
finding (`docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md`); it is gated on 254.

## Completed Milestones

- **v2.0.0 "Build the Loop"** (completed 2026-08-13): 7 phases (246-252), 19 plans. The
  local-context -> Brain -> Larry-join -> HITL loop shipped live with honest refusal
  everywhere; released as the v2.0.0-beta train (latest verified v2.0.0-beta.5).
  20/23 requirements closed; SWEEP-02 / CACHE-03 / AVAIL-03 carried open by navigator
  ruling. Full detail: `.planning/milestones/v2.0.0-ROADMAP.md` +
  `.planning/milestones/v2.0.0-REQUIREMENTS.md`.

- **v1.16.0 "Infrastructure Remediation"** (completed 2026-08-10): 12 phases (235-245),
  67 plans. Archives: `.planning/milestones/v1.16.0-ROADMAP.md` +
  `.planning/milestones/v1.16.0-REQUIREMENTS.md`.

- **v1.15.0 "The Cockpit"** and earlier: see `.planning/MILESTONES.md` (honest-close
  records; v1.14.0/v1.15.0 rolled forward without formal archives).

## Carried Forward (not silently dropped)

- SWEEP-02 fixture inversion: floor-gated; the path is source-authored enrichment payloads
  (proven template: payload -> ingest dry-run -> card -> fixture) until
  `check-flagship-floor.cjs` exits 0.

- CACHE-03 closing evidence: live 10+ turn session hit-rate measurement (>= 0.91).
- AVAIL-03: mindrian-brain suspension + restore rehearsal (operator).
- Gate 0 foreign-host verify (234-08 Task 2, navigator's own hands).
- Bolt-capable checkpoint queue: 7 vector-index DROPs + 1 self-loop DELETE
  (Nested Hierarchies 42214).

- Pipeline fixes filed by the 2026-08-11 admin sitting: ingest live-node prop drop, 429
  refusal mislabel, normalizeName alias-awareness.

**Phase numbering continues from 252** - the next milestone's first phase is 253.

### Phase 253: Framework population integrity (Gate 0)

**Goal:** [To be planned by spec-phase/discuss-phase] Confirm the current post-Memgraph-cutover
state of the 2026-05-10 debug finding (`.planning/debug/brain-schema-entropy-and-cooccurs-bloat.md`):
~750 real Framework nodes were mislabeled Concept/__Entity__ by a botched 2026-02-05 relabel.
If still broken, remediate via a human-reviewed triage list (never bulk) -- the 2026-02-05
disaster is the standing warning against unreviewed bulk graph mutation. Every downstream
phase reads the `:Framework` label, so this blocks 254/255/256.
**Requirements**: TBD
**Depends on:** Phase 252 (last shipped phase; this is the first phase of v2.1.0)
**Repo:** ProblemsWorthSolving-Brain
**Blocks:** 254, 255, 256
**Open navigator ruling:** the relabel triage list itself, once Gate 0 confirms current state.
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 253 to break down)

### Phase 254: Orchestration projection consumption wiring (suggest-next, act, server-side composition)

**Goal:** [To be planned] Wire `/mos:suggest-next` and `/mos:act` to consume the real Brain
orchestration projection (SEED-045 open item 1 / SEED-043; substrate ~85% shipped, never
wired) instead of `recipe-maps.cjs` alone. Includes the navigator-ruled server-side
composition option (mindrian-os MCP tool handlers composing Brain calls at explicit
invocation time, SEED-053 precedents this as Part-8-clean) -- if approved, the 239-05
fail-closed belt in `brain-client.cjs` is a same-phase prerequisite, not a follow-up, since
server-side calls bypass the per-tool-call egress-guard hook's name-matching. Per-turn
`decide()`/sensor dispatch stays projection-fed (R7: no live Brain call at decide()/rank
time) -- this phase does not touch that path.
**Requirements**: TBD
**Depends on:** Phase 253
**Repo:** MindrianOS-Plugin
**Open navigator ruling:** approve/reject server-side composition before this phase's plan
locks its architecture.
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 254 to break down)

### Phase 255: Data Room section-affinity ranking

**Goal:** [To be planned] Project the already-shipped canonical taxonomy
(`lib/core/section-registry.cjs` CORE_SECTIONS, 8 sections + extended + structural) into
Brain `DataRoomSection` nodes (currently the label exists with zero instances). Add a
Framework/Command-to-section affinity edge (edge-vocabulary amendment, additive per Part 4)
and a section-affinity term in the 222 combiner/ranker. Local-only mapping of user-custom
sections onto canonical slugs -- only canonical slugs ever cross the wire (Part 8). Includes
the Funding section's dilutive/non-dilutive children + grant-grading routing
(`/mos:grade`, `/mos:qualify-opportunity`, `/mos:opportunities`), grounded in the
2026-08-05/06 grant-grader research trails.
**Requirements**: TBD
**Depends on:** Phase 253 (parallel with 254, not sequential after it)
**Repo:** Both (ProblemsWorthSolving-Brain for the projection, MindrianOS-Plugin for the
ranking term + local mapping)
**Open navigator ruling:** the explicit local-vs-Brain conflict merge rule (langtalks
counsel: "when local and Brain signals disagree, the merge rule must be explicit, not
emergent").
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 255 to break down)

### Phase 256: Framework graph correction pass (edges, dedup, SAPPhIRE/TRIZ)

**Goal:** [To be planned] The 25 missing `USES_FRAMEWORK` edges and entity dedups (MECE x2,
Eureka Moment x5, Scenario Planning x3, Mullins Model/"John Mullins Framework" alias) found
by this session's Command-Framework Map audit
(https://claude.ai/code/artifact/ae659925-4441-4f04-982c-22b6d0843e28), plus creating
SAPPhIRE (currently absent from the graph entirely) and promoting TRIZ from an uncurated
stub Concept to a real Framework.
**Requirements**: TBD
**Depends on:** Phase 253 (can run any time after Gate 0 clears; independent of 254/255)
**Repo:** ProblemsWorthSolving-Brain
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 256 to break down)

### Phase 257: Part 8 enforcement locus (host-independent egress guard)

**Goal:** [To be planned] Close H3 from `docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md`:
a direct model-issued `mcp__...mindrian-brain__brain_ask/brain_query/brain_search/brain_write`
bypasses `lib/core/brain-client.cjs` entirely, so no belt inside that file can ever cover it, and
it is guarded only by a `PreToolUse` hook whose MCP-tool matcher does not fire on hosts without
MCP-scoped tool hooks (verified 2026-08-20: Codex CLI fires PreToolUse/PostToolUse for Bash tool
events ONLY; ChatGPT custom connectors have no hook surface at all). Makes Phase 234 D-04
("enforce governance server-side in MCP tool handlers, not via client hooks") true in code for the
direct-call path. The handoff catalogues THREE distinct holes sharing one root cause (enforcement
locus, not enforcement logic): H1 is Phase 254's to close, H2 shipped narrowly in 239-05
(`hatAwareRecommend`/`suggestValidationSteps` only, plus a `query()` backstop its own comment
labels insufficient alone), H3 is unowned and is this phase. The trap this phase exists to prevent
is 254 shipping H1, citing 239-05, and the record concluding Part 8 is closed while H3 stays open.
**Requirements**: TBD
**Depends on:** Phase 254. Hard gate, not a preference: 254 reshapes `brain-client.cjs` and moves
Brain composition into `mindrian-os`-named tool handlers, so planning 257 first would plan against
a tree about to change. Section 4 of the handoff is a MANDATORY re-verification step (every factual
claim there is written as a runnable command, not a frozen line number) before this phase's plan locks.
**Repo:** MindrianOS-Plugin
**Inherited conventions (Part 7, do not re-invent):** fail-CLOSED in code vs fail-OPEN in the hook
(deliberate, both correct for their surface); classify the RAW value before sanitize and before
interpolation, cloning `lib/core/bono/persona-research.cjs` approx 208-233; disclosure via
`_logEventBestEffort(options.db, ...)` scalars-only; the `check-substrate.cjs` ALLOWED_DIRECT_IMPORT
pre-commit trap; egress proof modelled on `tests/test-239-query-egress-canary.cjs` reusing
`tests/helpers/brain-capture-server.cjs`; regression lock shaped like `lib/mcp/no-instructions.test.cjs`.
**Open navigator ruling:** whether `mcp-server-brain/` (far side of the network boundary, deploys
standalone with its own package.json and render.yaml) also carries the guard as a last line of
defence, or stays local-only with the decision documented explicitly.
**Adjacent, do NOT absorb:** D-239-05-01 (`.planning/phases/239-brain-access-surface/deferred-items.md`)
is a payload-design question (send a generic handle instead of raw domain text); H3 is an
enforcement-locus question. Flag the interaction, leave the decision.
**Canon:** Part 8 PR gate applies (Canon Custodian review required).
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 257 to break down)

**Open milestone-shape ruling (applies across all four phases):** whether 253-256 stay as
v2.1.0 phase-family additions (current placement) or get resequenced into a successor
milestone once v2.1.0's existing scope (SWEEP-02/CACHE-03/AVAIL-03, the Bolt-capable
checkpoint queue) is clearer. Placed inside v2.1.0 per direct navigator confirmation
2026-08-20 ("it's part of the current milestone... not a new one"); revisit only if that
changes.
