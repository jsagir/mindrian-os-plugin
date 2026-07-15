# Phase 223: JTBD-driven intelligence pipeline + governed double-fan bono - Context

**Gathered:** 2026-07-15 (post-Phase-224 world: 224 is COMPLETE - executed, code-review-fixed,
verified 7/7, threat-secure 18/18)
**Status:** Ready for planning

<domain>
## Phase Boundary

Two born-wired surfaces sharing one research-ingestion + graph-close-the-loop spine: `/mos:bono`
evolves from its shipped Phase-164 form into an 8-phase governed research debate (hat-governance,
per-persona web research, version-cut SUPERSEDES chain), and a new `/mos:intel-pipeline`
meta-orchestrator runs calibrate -> decompose -> fan research -> compute -> consolidate ->
synthesize -> write-to-graph against any room, oriented by the room's active JTBD. Both terminate
by writing proposed claim / opportunity / open_question nodes through `lib/core/navigation.cjs`,
surfaced to the opportunity bank.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**6 requirements are locked.** See `223-SPEC.md` for full requirements, boundaries, and acceptance
criteria. Downstream agents MUST read `223-SPEC.md` before planning or implementing. Requirements
are not duplicated here.

**In scope (from SPEC.md):** hat-governance.cjs + persona-research.cjs (net-new); commands/bono.md
body replacement (evolve, not a new connector tuple); commands/intel-pipeline.md +
skills/intel-pipeline/SKILL.md (net-new surface); version-cut SUPERSEDES-chain for bono re-runs;
the shared close-the-loop graph-write contract; wiring/gates/release per Requirement 5.

**Out of scope (from SPEC.md):** a shipped /gsd-quick surface; auto-confirmation of any node
(Part 9 human-only); Brain-side storage of persona/claim/conclusion content (Part 8); multi-room /
portfolio fan-out; locating the missing ~/mindrian-designs/ directory (Requirement 6's fallback:
draft from the SPEC + BUILD-BRIEF Sections 5/6, which are self-contained).

**SPEC ambiguity note:** Constraint Clarity 0.55 (below 0.65 minimum), flagged honestly - the
governed-flow prose is drafted from the SPEC, not transcribed from the missing source directory.
Planner treats the exact prose as an assumption to draft, not a locked transcription.

</spec_lock>

<decisions>
## Implementation Decisions

All four decisions made at an explicit navigator AskUserQuestion gate 2026-07-15 (recommended
option selected in each case), grounded in Phase 224's SHIPPED implementation, not its plans.

### Req-4 write-side gap (the third gap, flagged in 223-SPEC.md 2026-07-15)
- **D-01: Write-through .md pair.** Every opportunity node intel-pipeline/bono writes to room.db
  ALSO files a bank markdown artifact under `room/opportunity-bank/` (node + .md,
  cross-referenced by artifact id). Rationale: `compute-opportunity-state` ->
  `opportunity-ops.cjs` reads ONLY `opportunity-bank/*.md` frontmatter (confirmed: zero
  db/openRoomDb/navigation references in that file) - Phase 224 did NOT close this write-side
  disconnect (its four pipes are all the opposite direction). Write-through keeps the bank's
  single source of truth (frontmatter), needs zero changes to the shipped reader, and the filed
  .md then ALSO rides Phase 224's per-write derivation - the two systems reinforce. The dual-write
  seam (node + .md must stay consistent) is the accepted cost; the executor should write the .md
  first and the node second so a mid-crash leaves a bank-visible artifact without a dangling node,
  and document that ordering.

### Interplay with Phase 224's shipped auto-derivation
- **D-02: Direct semantic writes, proposed, D-05 pattern.** 223's surfaces write their semantic
  edges (INFORMS / CONTRADICTS / SUPPORTS / REJECTED_BECAUSE / CONVERGES) DIRECTLY through
  navigation.cjs - they carry stance knowledge the score-based deriver structurally cannot infer
  (224's classifier deliberately never claims CONTRADICTS). All 223-written edges land
  `review_status: 'proposed'` per 224's D-05 edge-column precedent (one consistent proposal
  lifecycle). 224's auto-derivation runs additionally on any markdown 223 files (including D-01's
  write-through bank artifacts); same-pair overlap is absorbed by the edges table's PRIMARY
  KEY(source,target,type) idempotent upsert - and the shipped WR-06 clobber guard means a
  confirmed edge is never downgraded by a later derived write. No dedup layer needed.

### Compute layer for intel-pipeline's compute step
- **D-03: Eureka measured legs, not compute-hsi.py.** intel-pipeline's Phase 4-5 compute step
  invokes the shipped Phase 211-216 machinery (rs-differential-scorer measured semantic leg,
  eureka portfolio/room report substrate, HSI recompute through the eureka path) - the exact
  replacement Phase 211's D2 named when it RETIRED compute-hsi.py's LSA path. The BUILD-BRIEF's
  Section 3 listing of compute-hsi.py / discover-*-whitespace.py is stale on this point and is
  overridden here. No Python invocation from the new surface (SEED-013 direction).

### SUPERSEDES chain semantics (post-D-05)
- **D-04: SUPERSEDES edges carry review_status NULL (mechanical edge).** A bono re-run's
  SUPERSEDES edge records a system fact - "a newer conclusion exists" - not a truth-claim for
  ratification. NULL matches D-05's documented semantics ("not part of the proposal lifecycle").
  The new conclusion NODE is the proposal a navigator ratifies; the chain edge is bookkeeping;
  `--version-log` chain order stays purely mechanical, independent of confirmation state.

### Claude's Discretion
- Exact hat-governance map encoding (BUILD-BRIEF Section 5's scrutiny table is the source).
- The artifact-id cross-reference scheme for D-01's node + .md pair.
- intel-pipeline SKILL.md body prose (drafted per Requirement 6's fallback).
- Fan sizing / planDispatch budget defaults.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements and design source
- `.planning/phases/223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono-e/223-SPEC.md` - Locked requirements incl. the 2026-07-15 Req-4 write-side gap flag - MUST read first
- `.planning/phases/223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono-e/223-BUILD-BRIEF.md` - The pre-authored design (Sections 5/6 are self-contained sources for hat-governance + close-the-loop; Section 3's compute-hsi.py listing is OVERRIDDEN by D-03)
- `.planning/phases/223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono-e/223-AI-SPEC.md` - AI integration design contract, if present/current

### Phase 224's shipped machinery (the substrate this phase now stands on)
- `.planning/phases/224-graph-derivation-harness-seed-034-make-room-db-s-typed-node-/224-CONTEXT.md` + `224-VERIFICATION.md` - D-01..D-05 decisions + verified state
- `lib/core/navigation/edges.cjs` - writeEdge with review_status enum, WR-06 clobber guard, WR-10 byUser gate, PRIMARY KEY idempotency (D-02's foundation)
- `lib/core/graph-derive-classifier.cjs` - what the auto-deriver claims (CONVERGES/INFORMS only) - defines the complementary boundary of 223's direct semantic writes
- `lib/core/intelligence-cascade.cjs` - Step 2b enqueue + detached spawn; any markdown 223 files triggers this automatically
- `lib/core/migrations/phase-224-edge-review-status.cjs` - NULL semantics documentation (D-04's basis)

### The write-side gap (D-01's target)
- `lib/core/opportunity-ops.cjs` + `scripts/compute-opportunity-state` - the frontmatter-only reader D-01 works around (do NOT modify it)
- `lib/core/navigation.cjs` - writeOpportunityNode + the Part 9 chokepoint

### Bono Phase-164 shipped modules (evolve, don't rebuild - Part 7)
- `commands/bono.md`, `lib/core/bono/cell-fanout.cjs` (runCellFanout), runDebate, `lib/core/graph-derivation.cjs` (runDerivation - post-224 it throws loudly on Promise-returning deriveFn, CR-01), `lib/core/findings-wirer.cjs` (wireAccept/wireReject), expert-library assembleTeam
- `lib/memory/narrative-schema.cjs` - governing_thought <=250 chars, 3-5 key_claims (Requirement 2's shape)

### Compute layer (D-03)
- `lib/core/rs-differential-scorer.cjs` (scoreMeasured), `lib/core/eureka/embedding-spine.cjs`, `scripts/eureka-portfolio-report.cjs` - the measured legs replacing compute-hsi.py
- `.planning/phases/211-eureka-generator-mvp-tri-modal-room-db-sqlite-vec-xenova-all/211-CONTEXT.md` D2 - the retirement decision D-03 honors

### Conventions
- `.planning/seeds/SEED-059-fallback-disclosure-convention.md` - disclosure convention for any degraded step
- `.planning/phases/210-revert-persona-enforcement-over-reach-selectively-undo-the-m/` - hat-governance rules stay scoped to bono's debate logic, never a live-conversation hard-fail (the 210 caution, already in ROADMAP's 223 entry)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 164 bono modules (runCellFanout, runDebate, runDerivation, wireAccept/wireReject,
  assembleTeam) - the evolve-don't-rebuild base
- Phase 224's edges.cjs proposal lifecycle - D-02 rides it as-is
- narrative-schema.cjs - Requirement 2's conclusion shape
- eureka measured legs - D-03's compute layer
- run-all-222/224.sh shape for run-all-223.sh

### Established Patterns
- Part 9: all writes via navigation.cjs; proposed-only; byUser confirmation
- Part 8: per-persona research is SIGNAL->LOCAL only; part8-egress-guard.classify on every Brain
  call; grep-gated egress tests
- D-05/224: edge-level review_status with NULL = mechanical/not-a-proposal
- SEED-059: disclose degraded steps structurally at point of occurrence

### Integration Points
- commands/bono.md body replacement + skills/bono/SKILL.md mirror (build-skill-mirrors.cjs;
  reconcile the known sensor_triggers drift [SENS-05] vs [] as SPEC'd)
- New connector tuple for intel-pipeline (reach_id: context_block, kind: meta, posture: hold,
  autonomous_safe: false, hitl_stages: calibrate F.1 / fan-approve F.1 / synthesize F.5)
- room/opportunity-bank/ - D-01's write-through target
- tests/run-all-223.sh + run-feynman-tests.cjs registration

</code_context>

<specifics>
## Specific Ideas

- D-01 write ordering: bank .md FIRST, room.db node SECOND - a mid-crash leaves a bank-visible
  artifact, never a dangling invisible node. Document in the writer module header.
- The acceptance test for Req 4 should now assert BOTH surfaces: node in room.db (proposed) AND
  the opportunity visible in compute-opportunity-state's bank rollup via the written-through .md.
- 224's auto-derivation firing on 223's filed artifacts is a FEATURE to assert, not a side effect
  to suppress: a filed bank .md should eventually gain derived CONVERGES/INFORMS edges alongside
  223's direct stance edges.

</specifics>

<deferred>
## Deferred Ideas

- Extending opportunity-ops.cjs to read room.db as a second source (rejected D-01 alternative -
  revisit only if the dual-write seam proves fragile in practice)
- Multi-room / portfolio-scale intel-pipeline fan-out (SPEC out-of-scope)
- Locating/reconciling ~/mindrian-designs/ (SPEC Requirement 6 fast-follow)
- SEED-057 synthesis-as-votable-expert - gate now half-cleared (222 + 224 both shipped); still a
  separate navigator call, not this phase

</deferred>

---

*Phase: 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono-e*
*Context gathered: 2026-07-15 (post-224)*
