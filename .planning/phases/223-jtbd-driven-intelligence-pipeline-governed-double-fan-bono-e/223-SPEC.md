# Phase 223: JTBD-driven intelligence pipeline + governed double-fan bono - Specification

**Created:** 2026-07-14
**Ambiguity score:** 0.24 (gate: <= 0.20 -- NOT CLEARED; written anyway per --auto max-round fallback, one dimension flagged below minimum)
**Requirements:** 6 locked

## Goal

Codify the ad-hoc CorePower investigation workflow as two durable, born-wired surfaces
sharing one research-ingestion + graph-close-the-loop spine: `/mos:bono` evolves from its
shipped Phase-164 form into an 8-phase governed research debate (governed hat personas,
per-persona web research, version-cut via a SUPERSEDES chain), and a new `/mos:intel-pipeline`
meta-orchestrator runs calibrate -> decompose -> fan research -> compute -> consolidate ->
synthesize -> write-to-graph against any room, oriented by that room's active JTBD. Both
terminate by writing proposed claim / opportunity / open_question nodes through
`lib/core/navigation.cjs`, surfaced to the opportunity bank via `compute-opportunity-state`.

## Background

A complete, pre-authored, navigator-pasted build brief already exists and is committed at
`223-BUILD-BRIEF.md` in this phase directory (`kind: phase-context`, originally claimed
`status: ready-to-execute` / `entry_point: /gsd-execute-phase`). It contains a Goal section,
6 locked decisions (D-01 through D-06), a Part-7 reuse map, 3 sub-plans, a governed-hat
table with cited disciplines, a close-the-loop graph-write contract, acceptance criteria,
risks, and a file manifest. This SPEC.md formalizes that brief into GSD's requirement shape;
it does not re-derive the underlying design.

Verified this session, file:line, against commit `1e2a320a`+ (v1.15.3-beta.19):
- `commands/bono.md` already exists and ships (Phase 164, COMPLETE 2026-06-19, `run-all-164.sh`
  20/20 green). The brief's D-01 "evolve, don't rebuild" premise is accurate -- `runCellFanout`,
  `runDebate`, `graph-derivation.runDerivation`, `findings-wirer.wireAccept/wireReject`, and
  `expert-library.assembleTeam` are all real, shipped modules this phase reuses.
- `lib/core/bono/hat-governance.cjs`, `lib/core/bono/persona-research.cjs`,
  `commands/intel-pipeline.md`, and `skills/intel-pipeline/SKILL.md` do not exist anywhere in
  this repo -- confirmed net-new.
- The brief's cited source directory `~/mindrian-designs/` (README.md, the intel-pipeline
  SKILL.md draft, the bono.md replacement draft, BONO-V2-DESIGN.md) does NOT exist on this
  machine. This is the single largest open gap in an otherwise thorough brief -- see
  Constraints and the Ambiguity Report.

## Requirements

1. **Governed hat personas replace bono's current undifferentiated hat behavior.**
   - Current: `commands/bono.md`'s shipped cell-fanout (`lib/core/bono/cell-fanout.cjs
     runCellFanout`) runs each `(subdomain x hat)` cell with generic hat-scoped tool access
     (White=data, Black=failures, Green=innovation, Yellow=success, Red=none, Blue=synthesis)
     but no per-hat SCRUTINY discipline (ACH disconfirming-evidence weighting, heterogeneity
     mandate, anti-premature-convergence, Key-Assumptions-Check) and no per-persona web
     research world-of-knowledge.
   - Target: new `lib/core/bono/hat-governance.cjs` exports a governance map keyed by hat
     (white/black/yellow/green/red/blue) encoding the scrutiny table in the build brief's
     Section 5, plus the 5 cross-cutting rules (heterogeneity mandate, anti-convergence,
     Key-Assumptions-Check-first, disconfirming-evidence weighting, strongest-model judge);
     `runDebate` consumes it. New `lib/core/bono/persona-research.cjs` (or an extension of
     `cell-fanout.cjs`) calls `extractContext` -> `runSourceLens` per `(subdomain x hat)` cell,
     wiring accepted sources via `wireAccept` (EvidenceClaim `proposed` + `INFORMS`); a persona
     may not assert beyond its own wired sources.
   - Acceptance: `runDebate` invoked with the new governance map produces measurably different
     behavior per hat (Black's argument references disconfirming evidence before confirming;
     a fixture test asserts the heterogeneity mandate -- no two persona cells in one run share
     an identical lens); a persona-research fixture test asserts a persona's claim cannot cite
     a source outside its own wired `INFORMS` set.

2. **Bono's conclusion is a governed MECE-Minto synthesis with a version-cut SUPERSEDES chain.**
   - Current: bono's Phase-164 conclusion path files a synthesis on APPROVE with no narrative-
     schema discipline and no re-run/version awareness -- a second run on the same topic has
     no relationship to the first.
   - Target: after `runDebate`, the Pyramid+MECE discipline of `/mos:structure-argument` emits
     the narrative JSON (`lib/memory/narrative-schema.cjs`: `governing_thought` <=250 chars,
     3-5 `key_claims`) and `/mos:map-unknowns`'s matrix produces the unknowns base. On a re-run
     for the same topic, the new conclusion node writes a `SUPERSEDES` edge to the prior
     conclusion; `--version-log` walks the chain.
   - Acceptance: a 2-run fixture (same topic, re-invoked) produces two conclusion nodes linked
     by one `SUPERSEDES` edge; `--version-log` output lists both in chain order; a single-run
     fixture produces zero `SUPERSEDES` edges (no false chain on a first run).

3. **`/mos:intel-pipeline` runs the full calibrate-through-write-to-graph loop against any room.**
   - Current: no `intel-pipeline` command, skill, or connector entry exists anywhere in this
     repo. The equivalent workflow today is ad-hoc (manual invocation of separate `/mos:*`
     commands with no JTBD-oriented orchestration).
   - Target: new `commands/intel-pipeline.md` + `skills/intel-pipeline/SKILL.md`, `kind: meta`
     (sibling of `/mos:act`), `reach_id: context_block`, `sub_mode: intel-pipeline`,
     `framework: null`, `posture: hold`, `autonomous_safe: false`. Runs: read STATE/MINTO +
     `jtbd-state.getCurrent` -> F.1 calibrate gate -> `jtbd-state.setCurrent` -> derive
     dimensions from JTBD cues -> `planDispatch` sizes the fan -> F.1 fan-approve gate ->
     dispatch N research passes (`extractContext` -> `runSourceLens` -> `wireAccept` per pass,
     `quality: low` HALTs) -> compute scripts + HSI recompute -> F.5 synthesize gate (bull/bear
     ruling + ACH skeptics) -> close the loop (Requirement 4).
   - Acceptance: a `--dry-run` invocation against a fixture room emits the correct phase/fan
     plan without dispatching real research; a real run against a scratch room produces at
     least one `claim` node through the full pipeline and halts correctly at each of the 3
     declared `hitl_stages` (calibrate F.1, fan-approve F.1, synthesize-approve F.5) in a
     fixture that forces a `quality: low` mid-fan.

4. **Both surfaces close the loop through the same graph-write contract.**
   - Current: bono's existing writes use `graph-derivation.runDerivation` +
     `findings-wirer.wireAccept/wireReject`; intel-pipeline does not exist and has no writes
     to reconcile.
   - Target: both surfaces route every write through `lib/core/navigation.cjs`, using ONLY
     edge types already in `lib/core/navigation/edges.cjs ALLOWED_EDGE_TYPES` (finding/persona
     claim -> `claim` node `proposed`; relation -> `SUPPORTS`/`CONTRADICTS`/`CONVERGES`/
     `INFORMS`; killed claim -> one `REJECTED_BECAUSE`; governing thought -> conclusion node
     `proposed`; knowns -> `claim` + `SUPPORTS` -> conclusion; unknowns -> `open_question`
     nodes; actionable resolution -> `opportunity` node + `SUPPORTS` -> its claims; bono's
     prior conclusion -> `SUPERSEDES`). `bash scripts/compute-opportunity-state <roomDir>` runs
     after either surface completes so new opportunities surface into the bank. No claim is
     ever auto-confirmed; only `navigation.confirmNode(byUser)` promotes one.
   - Acceptance: a real run of each surface against a scratch test room writes `claim` +
     `opportunity` + `open_question` nodes verifiable directly in room.db, all `review_status:
     proposed`; `compute-opportunity-state` run afterward surfaces the new opportunities in
     the bank rollup; a fixture asserting `confirmNode` requires an explicit `byUser` argument
     passes for both surfaces.

5. **Both surfaces are born-wired and pass every existing structural gate.**
   - Current: neither surface exists, so none of these gates currently run against them.
   - Target: `node scripts/build-connector-registry.cjs --check` passes with both surfaces
     registered and zero minted reach (bono keeps `reach_id: hats`, intel-pipeline uses
     `reach_id: context_block`); `node scripts/check-shape-declaration.cjs` confirms
     `hitl_stages` declared on both; `node scripts/build-orchestration-projection.cjs --check`
     and `node scripts/check-render-coverage.cjs` both pass; `tests/run-all-223.sh` (mirroring
     this repo's existing `run-all-<phase>.sh` shape) aggregates the new test suites; a Part 8
     egress test asserts `part8-egress-guard` rejects a seeded LOCAL-content breach and that
     Brain calls carry only generic handles; `node scripts/doctor.cjs --acceptance` passes.
   - Acceptance: all six commands/scripts listed above exit 0 against the post-implementation
     tree; the connector registry's before/after diff shows exactly 2 new entries and 0 changed
     reach_ids for any existing surface.

6. **The missing `~/mindrian-designs/` source directory does not block delivery.**
   - Current: the build brief cites `~/mindrian-designs/commands/bono.md` and
     `~/mindrian-designs/skills/intel-pipeline/SKILL.md` as the literal replacement text for
     two of this phase's core deliverables, but that directory does not exist on this machine
     as of this SPEC's filing.
   - Target: the planner/executor draft the 8-phase bono.md governed-flow body and the
     intel-pipeline SKILL.md body directly from THIS SPEC (Requirements 1-4) plus the build
     brief's Section 5 hat-governance table and Section 6 close-the-loop contract, both of
     which are fully self-contained in `223-BUILD-BRIEF.md` and do not depend on the missing
     directory. If `~/mindrian-designs/` is later located (different machine, different room,
     not yet transferred), reconcile against it as a fast-follow; its absence is not a blocker
     to this phase's acceptance criteria above.
   - Acceptance: `commands/bono.md`'s replacement body and `skills/intel-pipeline/SKILL.md`
     exist and pass Requirement 5's gates without any reference to a file path under
     `~/mindrian-designs/` in the shipped code (a grep for the literal string
     `mindrian-designs` across `commands/`, `skills/`, and `lib/core/bono/` returns nothing).

## Boundaries

**In scope:**
- `lib/core/bono/hat-governance.cjs` + `lib/core/bono/persona-research.cjs` (net-new).
- `commands/bono.md` body replacement (evolve, not a new connector tuple).
- `commands/intel-pipeline.md` + `skills/intel-pipeline/SKILL.md` (net-new surface).
- Version-cut SUPERSEDES-chain pattern for bono re-runs.
- The shared close-the-loop graph-write contract (Requirement 4).
- Wiring/gates/release per Requirement 5, including a version cut via `scripts/release.sh`.

**Out of scope:**
- A shipped `/gsd-quick` surface -- external dev tooling, never distributed.
- Auto-confirmation of any claim/opportunity/conclusion node -- Part 9 is human-only, always.
- Any Brain-side storage of persona/claim/conclusion content -- Part 8, generic handles only.
- Multi-room / portfolio-scale fan-out -- this phase is single-room; portfolio is a follow-on,
  not scoped here.
- Locating or transferring the actual `~/mindrian-designs/` directory -- Requirement 6 makes
  this phase deliverable without it; finding it is a separate, optional fast-follow.

## Constraints

- Zero new npm dependencies beyond what Phase 164's shipped bono modules already use.
- Part 8 Graph Boundary: per-persona and per-dimension research is SIGNAL (public web) ->
  LOCAL only, never LOCAL -> BRAIN; every Brain call carries generic framework/domain handles
  only, guarded by `part8-egress-guard.classify`.
- Frozen reach set (Canon Part 3/11): bono keeps `reach_id: hats` (shares with
  `/mos:think-hats`, a sub_mode split, never a 7th reach); intel-pipeline's `reach_id:
  context_block` is an existing frozen reach, not a new one.
- The `connector:` block for both surfaces must be machine-regenerated
  (`build-connector-registry.cjs`), never hand-trusted as final.
- `sensor_triggers` drift between `commands/bono.md` (`[SENS-05]`) and its `skills/bono/
  SKILL.md` mirror (currently `[]`) must be reconciled via `scripts/build-skill-mirrors.cjs`
  as part of this phase, not left as a pre-existing inconsistency.
- Feynman/MINTO stage prompts (`lib/memory/feynman-prompts.cjs`) are byte-checked; if the
  conclusion step touches them, they stay byte-identical.
- Per-persona research fan cost is budget-capped via `planDispatch`; the fan-approve /
  hypothesis-confirm gates are the navigator-facing cost controls, not a hidden limit.

## Acceptance Criteria

- [ ] Hat-governance map + persona-research wrapper ship; heterogeneity and disconfirming-
      evidence-first behavior verifiable in a debate fixture (Req 1)
- [ ] Bono conclusion emits narrative-schema JSON + unknowns matrix; a 2-run fixture proves
      exactly one `SUPERSEDES` edge, a 1-run fixture proves zero (Req 2)
- [ ] `/mos:intel-pipeline` `--dry-run` and real-run fixtures both pass, including a
      `quality: low` forced-halt fixture (Req 3)
- [ ] Both surfaces write `claim`/`opportunity`/`open_question` nodes verifiable in room.db,
      all `proposed`; `compute-opportunity-state` surfaces them; `confirmNode` requires
      `byUser` (Req 4)
- [ ] `build-connector-registry.cjs --check`, `check-shape-declaration.cjs`,
      `build-orchestration-projection.cjs --check`, `check-render-coverage.cjs`, the Part 8
      egress test, and `doctor.cjs --acceptance` all pass (Req 5)
- [ ] `grep -r "mindrian-designs" commands/ skills/ lib/core/bono/` returns nothing in the
      shipped tree (Req 6)
- [ ] `bash tests/run-all-223.sh` exits PASS with 0 FAIL, 0 SKIP
- [ ] No emoji, no em-dashes, 12-glyph vocabulary, 3-line errors, `voice-dna.md` honored
      (carried from the build brief's own Section 7, unchanged)

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|---------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | OK     | The build brief's Goal + two-surface split is thorough and specific |
| Boundary Clarity   | 0.85  | 0.70 | OK     | Explicit in/out-of-scope lists carried from the brief's Section 11 |
| Constraint Clarity | 0.55  | 0.65 | BELOW MINIMUM | The missing `~/mindrian-designs/` directory removes the literal source text for two core deliverables (the bono.md replacement body, the intel-pipeline SKILL.md). Requirement 6 is this SPEC's mitigation -- draft from this document instead -- but the underlying uncertainty (does the drafted version match what the original designer intended) is real and not fully closable without the missing files. Planner must treat the exact governed-flow prose as an assumption to draft, not a locked transcription. |
| Acceptance Criteria| 0.80  | 0.70 | OK     | 8 phase-level + per-requirement pass/fail checks, largely inherited from the brief's own Section 7 |
| **Ambiguity**      | 0.24  | <=0.20| NOT CLEARED | Written anyway per --auto max-round fallback; Constraint Clarity is the single below-minimum dimension, explicitly flagged rather than inflated to force a clean gate |

Status: OK = met minimum. BELOW MINIMUM = planner must treat as an assumption per the flagged note, not a locked requirement.

## Addendum (2026-07-15, systems-thinking / causal-loop pass ahead of AI-SPEC.md)

Per a navigator-directed causal-loop analysis run during `/gsd-ai-integration-phase 223`
(before any planning), four causal loops were traced between bono/intel-pipeline's
documented writes and already-shipped machinery. Two materially affect this SPEC and are
recorded here rather than only in `223-AI-SPEC.md`'s Guardrails section, since they bear on
this document's own locked Requirements.

**Req 4 acceptance criterion verified UNACHIEVABLE as currently written (BLOCKING, not just
a risk).** Requirement 4's acceptance line states: "`compute-opportunity-state` run
afterward surfaces the new opportunities in the bank rollup." Verified false against shipped
code: `scripts/compute-opportunity-state` -> `bin/mindrian-tools.cjs:304-309` ->
`lib/core/opportunity-ops.cjs`'s `computeOpportunityBankState`/`listOpportunities` read ONLY
markdown frontmatter under `room/opportunity-bank/*.md` via `fs.readdirSync`/`fs.readFileSync`
-- independently confirmed zero `db.`/`openRoomDb`/`navigation.cjs` references anywhere in
that file. `navigation.cjs`'s `writeOpportunityNode` (the write path both bono and
intel-pipeline are speced to use, Requirement 4) writes ONLY to room.db. These are two fully
disconnected stores today. This is not new to Phase 223 -- Eureka's own
`writeOpportunityNode` calls (`eureka-portfolio-report.cjs:1192`) have the identical gap,
already present and previously unflagged. Requirement 4 as written cannot pass its own
acceptance test without either (a) a new bridge that projects graph-written opportunity
nodes into `room/opportunity-bank/*.md` frontmatter, or (b) rewriting Requirement 4's
acceptance criterion to check room.db directly instead of the markdown bank rollup, or (c)
scoping the bridge itself as this phase's Requirement 7. Planner/executor MUST NOT assume
this wiring exists; treat it as an open blocker, not an implementation detail.

**2026-07-15, navigator-directed: does Phase 224/SEED-034 (in progress) resolve this?
Checked directly against `.planning/seeds/SEED-034-graph-derivation-harness.md` -- NO, not
as currently scoped.** SEED-034's four broken pipes are all ONE direction: normal markdown
writes never getting indexed/derived into room.db's typed graph (the "moat is empty"
problem). This Requirement 4 gap is the OPPOSITE direction: `navigation.cjs`'s
`writeOpportunityNode` already writes to room.db correctly; `compute-opportunity-state` ->
`opportunity-ops.cjs` never reads room.db at all (confirmed: zero `db.`/`openRoomDb`/
`navigation` references in that file), only `room/opportunity-bank/*.md` frontmatter. These
are inverse gaps in the same general "graph and filesystem are disconnected" family, but
Phase 224 shipping does NOT automatically close this one. ROADMAP.md's existing "Real,
bidirectional risk with Phase 224/SEED-034" paragraph already flagged the READ-side risk
(223 reasoning over a thin graph before 224 populates it) -- this is a THIRD, WRITE-side risk
the roadmap entry did not yet name. Sequencing (224 before 223) still holds and is worth
waiting for regardless, but do not assume it closes Requirement 4's specific gap without a
separate, explicit check once 224 ships.

**Req 3's calibrate-then-fan sequence has an undisclosed reinforcing loop (non-blocking,
worth a guardrail).** `lib/hmi/jtbd-state.cjs`'s `setCurrent` is called once, before research
dimensions are derived from that same JTBD value (per Requirement 3's own sequence:
calibrate gate -> `setCurrent` -> derive dimensions from JTBD cues -> fan research); no
second `setCurrent` call exists anywhere later in the documented flow to correct against
what the research actually finds. JTBD orients the search, the search produces findings,
findings are never checked against JTBD for drift -- a reinforcing loop with no counter-
signal. Not a blocker (the phase can ship without fixing this), but Requirement 3's
acceptance criteria should add: a fixture proving that a `--dry-run` (or real) intel-pipeline
run does NOT silently update JTBD state as a side effect of its findings without a
navigator-facing gate, OR an explicit design decision that JTBD drift-correction is
out-of-scope and deferred (matching this SPEC's own Boundaries convention of naming
deferrals explicitly rather than leaving them silent).

Two further loops (a claim-nudge feedback into the reach/dial machinery's `context_block`
score, and Eureka's cross-domain scoring reading ALL nodes regardless of `review_status` so
unreviewed AI-proposed claims compete with human-confirmed ones) are lower-severity and
recorded in `223-AI-SPEC.md` Section 6 (Guardrails) rather than here, since they don't
threaten a locked acceptance criterion the way the two above do.

## Interview Log

Conducted as a same-session --auto pass using the pre-authored build brief as primary
grounding, rather than a live Socratic round (the brief already answers most of what a
Researcher/Simplifier/Boundary-Keeper pass would ask). Reconstructed here as the interview
record:

| Round | Perspective     | Question / check                                          | Decision locked                                                            |
|-------|-----------------|-------------------------------------------------------------|-------------------------------------------------------------------------------|
| 1     | Researcher      | Does `commands/bono.md` already exist, or is this a build-from-scratch? | Already exists and ships (Phase 164, COMPLETE) -- D-01 "evolve, don't rebuild" confirmed accurate |
| 1     | Researcher      | Do the three net-new files (hat-governance.cjs, persona-research.cjs, intel-pipeline surface) exist anywhere already? | Confirmed: none exist. Genuinely net-new, matching the brief's own reuse map |
| 2     | Simplifier      | Is the missing `~/mindrian-designs/` directory a hard blocker? | No -- Requirement 6 locks a fallback (draft from this SPEC + the brief's self-contained Section 5/6), explicitly not gated on locating the missing files |
| 3     | Boundary Keeper | What's explicitly NOT this phase? | Portfolio-scale fan-out, Brain-side storage of any conclusion, auto-confirmation, and locating the missing source directory itself -- all named as out of scope |
| 4     | Failure Analyst | What would make a verifier reject this phase's output? | A hat-governance map with no measurable behavioral difference per hat; a version-cut chain that fires on a first run (false chain); intel-pipeline writes that bypass navigation.cjs; any shipped reference to `~/mindrian-designs/` in the final tree |
| 5     | Seed Closer     | Is Constraint Clarity's below-minimum score actually resolvable this pass? | No -- it depends on files that do not exist on this machine; flagged honestly rather than forced clean, consistent with this session's own verification discipline on Phase 222 |

---

*Phase: 223-jtbd-driven-intelligence-pipeline-governed-double-fan-bono-e*
*Spec created: 2026-07-14*
*Next step: /gsd-discuss-phase 223 -- implementation decisions (exact bono.md governed-flow prose, exact intel-pipeline SKILL.md body, both drafted against Requirement 6's fallback since the cited source directory is unavailable)*
