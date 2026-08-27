# Roadmap: MindrianOS Plugin

**Current state:** milestone v2.1.0 "Green the Floor" (status: planning, per STATE.md).
Phases 253 and 256 were added 2026-08-20 and then RETIRED same-day on discovering
`.planning/REQUIREMENTS.md` + `.planning/research/SUMMARY.md` (2026-08-13, already-tracked
v2.1.0 requirements this session's own archaeology fork missed) scope the same ground far
more precisely; superseded by Phases 258-263 below, which are that document's own proposed
6-phase structure, unmodified. Phases 254-255 (genuinely new: consumption wiring,
section-affinity) and 257 (Part 8 enforcement locus, added by a parallel session same day)
stand as originally filed, re-gated on Phase 262 (Floor Green) instead of the retired 253.
Confirmed by the navigator as part of the current milestone, not a new one.

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

**Phase numbering:** v2.1.0 spans 253-263 (253 and 256 retired in place, see below; 254/255/257
stand; 258-263 are the research-sourced structure). The next NEW phase after this set is 264.

### Phase 253: RETIRED -- superseded by Phases 258-263

Filed 2026-08-20 as "Framework population integrity (Gate 0)" from this session's own
Command-Framework Map audit + a stale 2026-05-10 debug doc's ~750-node estimate. Same-day
scouting for spec-phase found `.planning/REQUIREMENTS.md` + `.planning/research/SUMMARY.md`
(2026-08-13, HIGH confidence, 4-leg Fable research) already scope this exact ground far more
precisely -- named files (`dedup.mjs`, `normalizeName`), specific node IDs (self-loop 42214,
order-collision 24219), a `check-flagship-floor.cjs` exit-0 gate, a full admin-ceremony
protocol -- and a live count taken same session showed 186 `:Framework` nodes already (not
~100, not ~750; 55 of 238 originally-demoted nodes already restored), evidence of over a
week of untracked-in-this-conversation progress. Retiring this entry rather than deleting it
so the paper trail is honest. Content lives on as Phases 258-263, that document's own
proposed 6-phase structure, filed unmodified. No plans were ever created under this number.

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
**Depends on:** Phase 262 (Floor Green -- re-gated 2026-08-20; the retired Phase 253 was its
original dependency, this phase's own work reads the `:Framework` population, which is only
guaranteed clean once 262's exit gate is green)
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
**Depends on:** Phase 262 (Floor Green -- re-gated 2026-08-20, same reasoning as Phase 254;
parallel with 254, not sequential after it)
**Repo:** Both (ProblemsWorthSolving-Brain for the projection, MindrianOS-Plugin for the
ranking term + local mapping)
**Open navigator ruling:** the explicit local-vs-Brain conflict merge rule (langtalks
counsel: "when local and Brain signals disagree, the merge rule must be explicit, not
emergent").
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 255 to break down)

### Phase 256: RETIRED -- superseded by Phases 260-261

Filed 2026-08-20 as "Framework graph correction pass" for the 25 missing `USES_FRAMEWORK`
edges + entity dedups (MECE x2, Eureka Moment x5, Scenario Planning x3, Mullins alias) this
session's Command-Framework Map audit found
(https://claude.ai/code/artifact/ae659925-4441-4f04-982c-22b6d0843e28). Retired same-day,
same reason as Phase 253: `.planning/research/SUMMARY.md`'s Phase 3 (Pipeline Fixes, now
Phase 260) and Phase 4 (Enrichment Ceremony, now Phase 261) already own this exact class of
work with named fixtures and a ceremony protocol. This session's 25-edge list and the
SAPPhIRE-creation / TRIZ-promotion finding are NOT yet reflected in SUMMARY.md's payload
list -- carry them into Phase 260/261's planning as additional input, they are net-new
findings even though the phase structure that should absorb them already existed. No plans
were ever created under this number.

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

**Open milestone-shape ruling:** RESOLVED 2026-08-20. Phases 253/256 retired in favor of
258-263 (v2.1.0's own pre-existing, more precise research); 254/255/257 stay as v2.1.0
additions per direct navigator confirmation ("it's part of the current milestone... not a
new one"). All of 254/255/257/258-263 sit inside the current milestone, no successor
milestone needed for this work.

### Phase 258: Reconcile the Wave (hard-gates all writing phases)

**Goal:** Damage repair before any new write. RECON-01: the untracked 2026-08-11/12
enrichment wave fully attributed via read-tier census diff + a tracked GRAPH-WRITE-LOG
convention. RECON-02: the 2 measured order collisions (Identify Reverse Salients 24219:
Red Teaming vs Nested Hierarchies; Generate Innovation Opportunities: S-Curve vs Nested
Hierarchies) dis-shared via carded surgery, node-prop `order` ruled single truth. RECON-03
(operator): second-machine untracked-payload recovery + admin-key hygiene verify. RECON-04:
fresh post-reconcile floor baseline replaces the stale 8/28 kickoff number.
**Requirements**: RECON-01, RECON-02, RECON-03, RECON-04
**Depends on:** Phase 252 (last shipped phase; parallel-safe with Phase 259, not sequential
after it -- both are early tracks per SUMMARY.md's ordering rationale)
**Repo:** ProblemsWorthSolving-Brain
**Avoids (per research):** payload authoring against stale floor scores; unattributed writes
**Research flag:** second-machine state is unverifiable from this filesystem, operator-
dependent, plan for both outcomes.
**Plans:** 7/7 plans complete
Plans:
**Wave 1**

- [x] 258-01-PLAN.md (wave 1) - GRAPH-WRITE-LOG convention + GraphWriteEvent ontology-gate registration (D-01, D-02, D-03)
- [x] 258-02-PLAN.md (wave 1) - RECON-01 attribution: provenance probes, forward census baseline, two-target write-up (08-11/12 wave + id 28000-29000 archived block)
- [x] 258-03-PLAN.md (wave 1) - RECON-03 operator prerequisite checklist + RECON-04 floor-baseline trigger, documented not executed (D-04, D-05, D-07)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 258-04-PLAN.md (wave 2) - RECON-02 pre-flight: live claimant label state, missing internal id resolution, LIVE/DORMANT rulings (F-12)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 258-05-PLAN.md (wave 3) - RECON-02 carded surgery payload, ten files, admin-window close as a numbered step (D-08, D-09, D-11)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 258-06-PLAN.md (wave 4) - The admin-window sitting: open, Session 0, dry-run, navigator approval, commit, close last (D-10, D-11)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 258-07-PLAN.md (wave 5) - Post-window verification and records: GRAPH-WRITE-LOG entry 1, execution record, SCHEMA.md ledger EXECUTED

### Phase 259: Plugin-Side Gate Trust (parallel-safe, early)

**Goal:** The milestone's own success metric cannot be trusted while a 429 renders as
BRAIN_UNREACHABLE with zero retries -- the 56-probe floor run would be self-blind.
TRUST-01: `brain-client.cjs` handles 429 honestly (a `rate_limited` sentinel or bounded
Retry-After-aware retry), proven by a forced-429 test. TRUST-02: `check-flagship-floor.cjs`
VOIDs (re-run) on any probe-failure row, never reports a false MISS/RED.
**Requirements**: TRUST-01, TRUST-02
**Depends on:** Phase 252 (parallel-safe with Phase 258, both early tracks)
**Repo:** MindrianOS-Plugin
**Plans:** 4/4 plans complete

Plans:
**Wave 1** *(three parallel plans, zero files_modified overlap)*

- [x] 259-01-PLAN.md (wave 1) - TRUST-01 transport leg: scripted-response extension to the shared capture server (D-04), the forced-429 RED proof, and the 429 branch + `rate_limited` sentinel + `_parseRetryAfterMs` / `_rateLimitWaitMs` in `brain-client.cjs` (D-01, D-02, D-03)
- [x] 259-02-PLAN.md (wave 1) - TRUST-01 honesty rail: `rate_limited` as the fifth `REFUSAL_KIND` mapping to `BRAIN_RATE_LIMITED`, closing the coercion trap (F-09 Option B, D-03 rationale), plus two deliberate pinned-contract amendments
- [x] 259-03-PLAN.md (wave 1) - TRUST-02 floor VOID leg: `errorKind` on `brainCall`, `failures[]` on `probeFramework`, the `VOID` verdict with `voidCount` and exit code 3, and the D-06 VOID renderers (D-05, D-06, D-07, D-08)

**Wave 2** *(blocked on all three Wave 1 plans)*

- [x] 259-04-PLAN.md (wave 2) - Phase gate: `tests/run-all-259.sh` aggregator, the 429 RCA closed with both `needs-source-reverify` tags discharged, the dev-research compositing trail, and a live floor-run checkpoint that also discharges assumption A1

### Phase 260: Pipeline Fixes (brain repo, one pass, one push)

**Goal:** Remote ingest runs deployed code; every payload through the unfixed pipeline
risks a fresh self-loop and silent prop drops at 18x scale. FIX-01: `ingestFramework`
applies additive framework-level props to live nodes (the `dedup.mjs` resolveFramework
noop branch), reports applied/skipped per prop. FIX-02: the dedup path cannot mint
`ALIAS_OF` self-loops -- statement-level `id(a) <> id(canon)` guard; the 42214 minting path
reproduced as an RCA fixture then killed (red-proof). FIX-03: `normalizeName`'s direct-match
branch is alias-aware, gated by a before/after matrix across all four name-matching readers

+ the dedup write-path consumer; its own plan and commit inside the batched push (matrix

attributability, per SUMMARY.md). FIX-04: all fixes ship in ONE batched push, live
round-trip verified on the deployed surface, push freeze declared before the ceremony
window opens.
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04
**Depends on:** Phases 258 AND 259 (needs both the reconciled floor baseline and the
trustworthy floor-check gate before shipping fixes against them)
**Repo:** ProblemsWorthSolving-Brain
**Research flag:** the Fix 3 before/after matrix -- blast radius across all four
name-matching readers + dedup consumer has never been analyzed (P7); this is the one
sub-plan in the whole 258-263 set flagged as needing deeper research during planning.
**Plans:** 5/5 plans complete
Plans:
**Wave 1** *(two parallel plans, zero files_modified overlap)*

- [x] 260-01-PLAN.md (wave 1) - FIX-02: live self-loop RCA (measured 165, not the 41 the source comment claims) plus the statement-level `id(a) <> id(canon)` guard, hermetic RED proof, red-proof.sh registration
- [x] 260-02-PLAN.md (wave 1) - FIX-03 gate: name-matching-reader census from source, BEFORE corpus + proposed-query rehearsal, and an explicit CHANGE-260 / UNCHANGED-DELIBERATE / DEFERRED ruling per reader

**Wave 2** *(two parallel plans; 260-03 blocked on 260-02, 260-04 blocked on 260-01 by dedup.mjs overlap)*

- [x] 260-03-PLAN.md (wave 2) - FIX-03 change, its own commit: alias-aware direct branch via the `exists()` form, typed `:Framework` target, cross-branch dedup, exported NORMALIZE_NAME_CYPHER, honest tool description doubling as the deploy beacon, matrix AFTER slot filled
- [x] 260-04-PLAN.md (wave 2) - FIX-01: `additivePropPlan` on all three noop branches, `propReport` through `buildPlan`, the missing `provenance_note` projection closed, the two live dedup assertions deliberately amended, live round-trip handed to Phase 261 as a numbered pre-item

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 260-05-PLAN.md (wave 3) - FIX-04: batch integrity + suite-delta gate, navigator approval checkpoint, ONE `git push`, deploy-identity proof via `tools/list`, deployed-surface round-trip, push freeze declared

**Research flag DISCHARGED at planning time (2026-08-20/21).** The FIX-03 blast radius was measured
live read-only against canon before the plans were written: 42 `:Framework` nodes carry an outgoing
`ALIAS_OF` to a `:Framework` and are returned by the direct branch as if canonical; 47 NON-Framework
nodes alias into `:Framework` and are invisible to the alias branch's typed source; the fragment
`scenario` returns 8 entries with one duplicate today and 4 with none under the proposed form; all
four candidate Cypher forms (`exists(pattern)`, `EXISTS { }`, count-based, `reduce`) execute on this
Memgraph build. Two corrections the plans carry forward: the live `ALIAS_OF` self-loop population is
**165**, not the 41 in `dedup.mjs` or the singular framing in CER-05; and 157 of 186 frameworks lack
`framework_type`, which means FIX-01 breaks two existing live dedup assertions by design and they are
amended on the record rather than discovered mid-ceremony.

### Phase 261: Enrichment Ceremony (single admin window)

**Goal:** All remaining writes concentrate into one runbook-protocol sitting with a
per-item ledger. CER-01: Tier A (20 frameworks at 3/4) reach 4/4 via classified
`pattern_type` rulings, digest cards by decision-homogeneity, one guarded UNWIND
`brain_write`, read-tier verified. CER-02: Cohort 1, 10 mechanical flagship payloads
(fixture-first from source docs, digest waves of ~5, per-row rejection). CER-03: Cohort 2,
7 judgment flagship payloads via individual cards, including the Triple Validation Compass
source-attribution ruling. CER-04: PEST Analysis ingested per ruling (source:
macro-trends.md Phase 3; new node, 4 HAS_STEP, no fabricated LEADS_TO). CER-05: the
self-loop population DELETEd over HTTPS (**corrected 2026-08-21 by 260-01's live measurement:
165 edges, not the single 42214 node this line originally assumed** - see
`ProblemsWorthSolving-Brain/docs/2026-08-20-RCA-alias-self-loop-minting.md`), post-batch
self-loop probe returns 0, admin disable executes as the LAST scripted write item
(admin-window discipline, the 2-day-open lesson).
Also absorbs this session's 25-missing-edge list + entity dedups (MECE x2, Eureka Moment
x5, Scenario Planning x3, Mullins alias) and the SAPPhIRE-creation / TRIZ-promotion finding
from the retired Phase 256 -- net-new input into this ceremony's payload set, not yet in
SUMMARY.md's original list.
**Requirements**: CER-01, CER-02, CER-03, CER-04, CER-05, CER-06 (UN-DEFERRED 2026-08-21: the
original "ruling recorded at requirements time" was investigated and found never to exist,
then the navigator supplied the real named source directly moments later - Rowan Gibson's
*The Four Lenses of Innovation*, recorded in full at
`ProblemsWorthSolving-Brain/docs/2026-08-21-SOURCE-four-lenses-of-innovation.md`. Back in scope.)
**Depends on:** Phase 260, now COMPLETE and deployed (fixes are live; see
`260-05-SUMMARY.md`). This phase also inherits Phase 260's push freeze
(`ProblemsWorthSolving-Brain/docs/2026-08-20-FREEZE-push-freeze-before-261.md`): the admin
window this phase opens is exactly the release condition that lifts it.
**Repo:** ProblemsWorthSolving-Brain
**Plans:** 11/13 plans executed. 13 plans, 5 waves. Deliberately many and small: the authoring
plans are all local-commit-no-push under Phase 260's freeze, and the single admin window is one
plan by D-11 necessity (261-12, 8 tasks, 4 checkpoints, sizing override stated in the plan itself).
**Planner ruling on the 5 open questions in `261-RESEARCH.md`:** (1) relabel and edge authoring
are SEPARATE batches with separate `GRAPH-WRITE-LOG` rows and a read-tier probe between them,
YES; (2) the navigator signs the ~95-node relabel list at a blocking checkpoint and the sign-off
is recorded in the payload README AND the ledger row, not only the commit; (3) the 7 index DROPs
do NOT ride this window and carry to Phase 263 CARRY-03 (no SSH key, and `brain_write` runs
through `runIngestTx` while Memgraph refuses DDL in a multicommand transaction, so the seam is
technically closed regardless); (4) SAPPhIRE is authored but GATED on a navigator card because
the only source held is one paraphrased sentence; (5) `poverty` 27031 demote CONFIRMED, already
implemented by `payloads/relabel-fix-260820/01-demote-poverty.cypher`.
**Live re-measurement 2026-08-21 supersedes the 8/28 kickoff:** 12 of the ratified 28 clear
readiness >= 3 (4 at 4/4, 8 at 3/4), 16 miss; `PEST Analysis` matches 0; Tier A (graph-wide 3/4
with `pattern_type` absent) is 19 nodes, not 20; `ALIAS_OF` self-loops 165; archived block
100 demoted / 99 archived / 95 in ids 28000-29000.

Plans:

**Wave 1** *(read-tier only, no window)*

- [x] 261-01-PLAN.md (wave 1) - live worklist: replaces three superseded baselines, names every CER row set, audits the 5 already-authored unexecuted payloads for reuse, attributes the 2026-08-20 heal run, and resolves its "all 184 frameworks to 4/4" claim against the live distribution. **DONE 2026-08-21** (`261-01-SUMMARY.md`): 11/28 PASS the two-part floor rule (not 12 by readiness alone -- Scenario Planning's 2-match FLOOR-03 disagreement now scored MISS), 19 Tier A candidates confirmed, 4/5 `aa15966` payloads found to have dropped `pattern_type` live (confirms FIX-01's need), 3 Cohort rows (Lean Canvas, Six Thinking Hats, PWS Value Proposition) dropped to PASS by live measurement. `ProblemsWorthSolving-Brain`: `d943167`, `8d520b0` (local, unpushed per freeze).

**Wave 2** *(nine parallel authoring plans, zero `files_modified` overlap, all local-commit-no-push)*

- [x] 261-02-PLAN.md (wave 2) - CER-01 Tier A: one guarded UNWIND `pattern_type` payload, every row source-quoted, unsourced rows REJECTED not defaulted. **DONE 2026-08-21** (`261-02-SUMMARY.md`): 10 INCLUDE / 9 REJECT of the 19-row Tier A set, every INCLUDE grep-F-quoted against a named source; compile_only payload directory authored (`00-evidence.md` + guarded UNWIND write + dry-run/verify/undo/manifest/README), zero graph calls. `ProblemsWorthSolving-Brain`: `b1147a1`, `020e180` (local, unpushed per freeze).
- [x] 261-03-PLAN.md (wave 2) - CER-02 Cohort 1 batch A: HSI, Root Cause Analysis, Domain Selection, fixtures authored first from source docs
- [x] 261-04-PLAN.md (wave 2) - CER-02 Cohort 1 batch B: Knowns and Unknowns, Dominant Design, Systems Thinking (one disclosed spine), plus the Pyramid Principle node-identity finding. **DONE 2026-08-21** (`261-04-SUMMARY.md`): three payloads authored fixture-first, all 4/4 expected readiness; Systems Thinking's SPINE DECISION (Five Moves over the four-phase script) made testable via a rejected-spine negative control; Pyramid Principle finding proves `minto-pyramid.mjs` targets the wrong node (Minto Pyramid 38968, 3/4) versus the ratified node (The Pyramid Principle 30242, 0/4), disposed RETARGET, header-only note added, both competing survivor rulings recorded unadjudicated. `ProblemsWorthSolving-Brain`: `c218cf8`, `0587bdf`, `f9b4c38` (local, unpushed per freeze).
- [x] 261-05-PLAN.md (wave 2) - CER-03 Cohort 2 batch A: Futures Wheel, MECE, Adaptive Leadership, each with a `RULING REQUIRED:` block and a card with a real reject branch. **DONE 2026-08-21** (`261-05-SUMMARY.md`): three fixtures authored fixture-first from the three contested sources (a command body for Futures Wheel, a shared Phase-2-only section for MECE, a 7-theory persona doc for Adaptive Leadership); three payloads authored with mandatory `RULING REQUIRED:` + `DISCLOSURE:` headers (expected readiness 4/4 Futures Wheel, 2/4 honest ceiling for MECE that does not clear the floor even on approval, 3/4 Adaptive Leadership); one paste-ready navigator card (`docs/2026-08-21-CARDS-cohort2-batch-a.md`) bundling all three source-authority rulings with defined accept and reject branches. `ProblemsWorthSolving-Brain`: `cf426ef`, `bc3293a`, `8f4be86` (local, unpushed per freeze).
- [x] 261-06-PLAN.md (wave 2) - CER-03 Cohort 2 batch B: Triple Validation Compass (the ruling CER-03 names), Hypothesis-Driven, Adoption-Capacity, plus the Mullins payload four-point verification. **DONE 2026-08-21** (`261-06-SUMMARY.md`): four fixtures authored (three from source, one to verify the pre-existing Mullins payload rather than re-author it); three payloads authored with mandatory `RULING REQUIRED:` + `DISCLOSURE:` headers (Triple Validation Compass carries a TWO-QUESTION ruling -- authority + double-attribution -- grounded on `grade.md` alone by default, 4/4; Hypothesis-Driven 4/4; Adoption-Capacity 4/4, verified by negative control to claim zero S-Curve Analysis phase names); `mullins-seven-domains.mjs` got a header-only `VERIFICATION 2026-08-21:` block, four checks all PASS, honest 3/4 ceiling, body unchanged; the plan's own "no document names Triple Validation Compass" premise was re-verified (not repeated) and corrected -- one genuine glossary definition found at `references/personality/pws-lexicon-full.md:175`; one paste-ready navigator card (`docs/2026-08-21-CARDS-cohort2-batch-b.md`) carrying the CER-03-named ruling as two separate option sets plus two more accept/reject rulings plus a Mullins confirmation. CER-03 now fully authored (7/7 judgment rows). `ProblemsWorthSolving-Brain`: `ae504ad`, `b43f6d2`, `d8773e5` (local, unpushed per freeze).
- [x] 261-07-PLAN.md (wave 2) - CER-04 PEST + CER-06 Four Lenses (from the navigator-supplied source) + SAPPhIRE authored and GATED. **DONE 2026-08-21** (`261-07-SUMMARY.md`): two fixtures authored fixture-first (`pest-analysis.json`, `four-lenses-of-innovation.json`; discovered-fixture count 17->19); three payloads authored -- `pest-analysis.mjs` (genuinely NEW `:Framework` node, 4 `HAS_STEP` P/E/S/T + 1 source-quoted `USES_TECHNIQUE` "System Interactions Mapping", NO `LEADS_TO`, honest 3/4 clears the floor, implementing FEATURES.md's already-recorded INGEST ruling exactly), `four-lenses-of-innovation.mjs` (enriches the existing empty node, 4 `HAS_STEP` Gibson lenses, NO `LEADS_TO` per the source's own process note, a `SHAPE PROPOSAL:` block answering all three of the source's "Explicitly NOT decided" questions, honest 2/4 below the floor and disclosed as such), `sapphire.mjs` (`GATED:` leads the file first, quotes its one-sentence source in full with path and line, does not execute without navigator approval, names the Phase 263 alternative, 8 `HAS_STEP` elements in the source's own listed order, NO `LEADS_TO`, honest unpadded 1/4, deliberately NO fixture); one paste-ready navigator card (`docs/2026-08-21-CARDS-new-nodes.md`) covering a PEST confirmation, a Four Lenses shape card, and a SAPPhIRE approval card with a genuinely costless reject. `ProblemsWorthSolving-Brain`: `b46f71a`, `5f3017d`, `e8a8778` (local, unpushed per freeze).
- [x] 261-08-PLAN.md (wave 2) - CER-05 alias hygiene: the 165-edge self-loop DELETE scoped by predicate not label, the absorbed Phase 256 entity dedups, and all four residue items as cards. **DONE 2026-08-21** (`261-08-SUMMARY.md`): self-loop DELETE authored, scoped by the self-loop predicate (source equals target node) only, relationship-only, never label-scoped, since both the RCA's and the worklist's censuses agree the 165-edge population carries zero `:Framework` rows; `02-entity-dedups.cypher` authored with ZERO active statements -- the roadmap's absorbed "Scenario Planning x3" cluster (ids 23450/34454/46099 -> 34362) turned out to be already executed by `docs/2026-08-11-RUNBOOK-249-alias-collapse.md`, "Mullins alias" conflicts with that same already-ratified runbook's opposite-direction ruling and is not actioned, MECE x2 and Eureka Moment x5 are evidence-missing (no resolvable second id / no cluster evidence at all); the Scenario Planning to FLOOR-03 link is answered in one direction with evidence -- entity duplication does NOT explain the resolver's residual count of 2, a documented hop-depth-1 resolver artifact does; four residue cards authored (`docs/2026-08-21-CARDS-alias-hygiene.md`) for JTBD (45915, six candidates, recommends the id the ratified string already resolves to), Pyramid Principle entity type (39014, neither DESCRIBES nor SOURCE_FOR confirmed in the closed vocabulary), and the two contested-survivor pairs (Minto Pyramid 38968, PWS 38305), three of four recommending defer with the reasoning stated. `ProblemsWorthSolving-Brain`: `cc7bfbf`, `0d7d121`, `e2b81a4` (local, unpushed per freeze).
- [x] 261-09-PLAN.md (wave 2) - the Gate 0 archived-block relabel: per-node review list, TRIZ as one row, and the live per-name collision check that stops a restore from breaking a passing floor row. **DONE 2026-08-21** (`261-09-SUMMARY.md`): 100-row human review list authored (one row per `[W-6]` node, re-fetched live via the already-committed `probe-ceremony-worklist.mjs` since the committed worklist document held only the aggregate, not the per-node table); THE SAFETY CHECK live-reproved against canon found 20 of 95 in-range candidates share an exact name with a live `:Framework` node (roughly 4x the ~5 examples the plan's own prose named), all marked EXCLUDE with the colliding live id; 5 rows outside the declared 28000-29000 id range marked EXCLUDE on scope grounds; 4 near-misses marked EXCLUDE, CARD REQUIRED; net 71 INCLUDE / 29 EXCLUDE; TRIZ (28666) closed as one ordinary INCLUDE row per the Phase-256 correction plus a new live finding (an existing Concept node already carries the exact name "TRIZ"); two data-quality findings disclosed without changing any verdict (99/100 rows carry a `<SEP>`-corrupted `name` property, 43/100 carry a pre-existing 3-label chimera); guarded relabel payload authored (`01-relabel-block.cypher` + dry-run/verify/undo/manifest/README), batch_id `pws-blockrelabel-2026-08-21`, its own `GraphWriteEvent`/`GRAPH-WRITE-LOG` row separate from 261-10's edge authoring. `ProblemsWorthSolving-Brain`: `6ec1acf`, `430d436` (local, unpushed per freeze).
- [x] 261-10-PLAN.md (wave 2) - the absorbed missing-`USES_FRAMEWORK`-edge batch, derived from tracked command frontmatter because the original audit artifact is unreachable. **DONE 2026-08-21** (`261-10-SUMMARY.md`): `scripts/derive-command-framework-edges.mjs` authored, reusing the plugin's shipped `scanMethodologyCommands()` via an absolute-path CJS-to-ESM bridge plus a cross-validated per-command attribution walk (the shipped function only aggregates to framework-name/use-count, discarding which command declared which framework); resolves against live canon with 3 batched read-tier queries, no second HTTP client. Live run: 50 `kind: methodology` commands, 51 declared pairs, **AUTHORABLE=0** (50 already carry an unstamped live `USES_FRAMEWORK` edge predating this repo's provenance convention, 1 -- `PEST Analysis` -- has no live `:Framework` node, matching CER-04's independently-measured row exactly), UNRESOLVABLE=1. Honest finding recorded plainly in `00-derivation.md` and the payload `README.md`: neither this batch nor 261-09's relabel moves the 59/112 zero-framework-command metric the worklist's own Section 9 named edge authoring as the sole lever for. Guarded compile_only payload directory authored (`01-merge-uses-framework.cypher` id-plus-name double-bound + dry-run/verify/undo/manifest/README), batch_id `pws-cmdfwedges-2026-08-21`, never executed, its own `GraphWriteEvent`/`GRAPH-WRITE-LOG` row separate from 261-09's relabel per the attribution rule. Same CER-05 frontmatter/REQUIREMENTS.md mismatch 261-09 flagged applies here too, not marked complete. `ProblemsWorthSolving-Brain`: `3899760`, `19f67f5` (local, unpushed per freeze).

**Wave 3** *(pre-flight, blocked on all authoring)*

- [x] 261-11-PLAN.md (wave 3) - payload JSON emitter for the HTTPS admin seam, mechanical batch-integrity gate, and the full window runbook with its close procedure written FIRST. **DONE 2026-08-21** (`261-11-SUMMARY.md`): `payloads/emit-payload-json.mjs` authored (serializer only, no `src/ingest` import, round-trips an `.mjs` payload to JSON for the HTTPS `ingest_framework` boundary); `scripts/check-ceremony-batch-integrity.mjs` authored (8 named checks, distinct exit codes 0/1/2, check 3 correctly printed `DEFERRED TO WINDOW` and never counted toward PASS, ran twice -- 32 PASS/0 FAIL/1 MISSING/1 DEFERRED after Task 1 with Task 2's own not-yet-written runbook as the one MISSING, then 32 PASS/0 FAIL/0 MISSING/1 DEFERRED exit 0 once Task 2 landed); `docs/2026-08-21-RUNBOOK-261-ceremony.md` authored with Section 9 (the close) written and verified FIRST, before any other section existed, all four `batch_id` values named across Sections 4-8, the FIX-01 round-trip transcribed as write item 1 with the before-CER-01-through-CER-04 ordering rule stated in bold, and a disclosed finding that the HTTPS `ingest_framework` tool's response does not surface `propReport` the way `run-ingest.mjs`'s in-process printout does -- the round-trip's load-bearing falsification check is repointed to the direct all-seven-key read comparison instead. No payload authored, no window opened, nothing pushed. `ProblemsWorthSolving-Brain`: `45748cc`, `5dc4d6a` (local, unpushed per freeze).

**Wave 4** *(THE WINDOW, one plan by D-11 necessity, INLINE ONLY, MCP required)*

- [ ] 261-12-PLAN.md (wave 4) - open, Session 0 snapshot, the FIX-01 live round-trip as write item 1, four homogeneous approval checkpoints, commit in order with a probe between the relabel and the edges, `GraphWriteEvent` per batch, CLOSE as the last scripted write item

**Wave 5** *(after the close)*

- [ ] 261-13-PLAN.md (wave 5) - post-close probes, one `GRAPH-WRITE-LOG` row per batch plus a retrospective row for the 2026-08-20 heal run, the execution record, ONE navigator-approved push that discharges the Phase 260 freeze, and the Phase 262 handoff (fresh floor, live `Scenario Planning` resolver count for FLOOR-03, relabel-vs-edges attribution split)

### Phase 262: Floor Green + SWEEP-02 Inversion

**Goal:** The named exit gate. FLOOR-01: `check-flagship-floor.cjs` exits 0 on a
window-fresh run (no probe failures, per TRUST-02). FLOOR-02 (carried from v2.0.0
SWEEP-02): the tier-0-no-key acceptance fixture repurposed to assert the keyless path
refuses correctly -- coverage kept, assertion inverted, never deleted. FLOOR-03: Scenario
Planning measures exactly-1 on the live graph post-FIX-03 before the floor run is ratified
(verify, never predict -- the runbook's arithmetic was wrong once already). **NOTE 2026-08-21:
260-05's live post-deploy round-trip actually measured 2, not 1 (matrix section 7 +
deployed round-trip agree). Re-verify live at 262's own planning time rather than trusting
either number carried forward; do not silently keep the exactly-1 assertion.**
**Requirements**: FLOOR-01, FLOOR-02, FLOOR-03
**Depends on:** Phase 261
**Repo:** ProblemsWorthSolving-Brain
**Downstream:** Phases 254 and 255 (this session's consumption-wiring and section-affinity
work) both depend on THIS phase, not on the retired Phase 253 -- they read the `:Framework`
population and need it green.
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 262 to break down)

### Phase 263: Carry-folds + Long-Tail Reader (post-green)

**Goal:** TAIL-01: a demand-ranked long-tail worklist reader over the existing ENRICH-01
queue (hit_count DESC, SOURCE/NO SOURCE join per row), no bulk authoring -- honest refusal

+ auto-queue stays the designed behavior for the unranked tail. SEED-A: the framework

UN-WIRED gate re-sourced from the live `:Framework` population, post-hygiene -- this is a
direct input into Phase 254's consumption-wiring work. SEED-B: grading/contradiction paths
check a framework's grounding (readiness) before contradicting content against it
(SEED-075) -- an ungrounded framework yields an honest cannot-grade, never an unreliable
contradiction. CARRY-01 (v2.0.0 CACHE-03): live 10+ turn hit-rate measurement, >= 0.91.
CARRY-02 (v2.0.0 AVAIL-03, operator): mindrian-brain suspension + dead env var deletion,
restore path rehearsed once. CARRY-03 (operator, Bolt-gated): the 7 ratified vector-index
DROPs execute at a Bolt-capable checkpoint (Render SSH key registered, confirmed live this
session: srv-d9geq2urnols73cimkfg@ssh.oregon.render.com), snapshot-first, one at a time.
**Requirements**: TAIL-01, SEED-A, SEED-B, CARRY-01, CARRY-02, CARRY-03
**Depends on:** Phase 262
**Repo:** ProblemsWorthSolving-Brain (SEED-A/B, TAIL-01) + operator legs (CARRY-01/02/03)
**Out of scope (recorded, not forgotten):** bulk enrichment of the 90-framework tail
(navigator doctrine: demand drives the queue); any change to WHAT crosses the Part 8
boundary; a permanent HTTP DDL tool (the 2-day-open-window lesson stands).
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 263 to break down)

### Phase 264: Roadmap-Type Selector: challenge-driven act-chain orchestration for the research command family

**Goal:** A navigator's stated research goal is silently classified into one of six
roadmap output-shapes and resolved to the matching framework-name chain via the existing
`chain_resolve` seam, and the Technical Roadmap chain's `find-bottlenecks` step opts into
the already-shipped `ralph_verify` bounded self-critique seam with a real adversarial-panel
`selfCritiqueFn`, proving challenge-driven execution end to end without touching
`chain-executor.cjs`'s B3 / Canon Part 3 stop-condition contract (verified, not asserted).
**Requirements**: R1-R5 (locked in `264-SPEC.md`; this phase sits outside REQUIREMENTS.md's
v2.1.0 REQ-ID scheme, so plans carry SPEC requirement numbers)
**Depends on:** None (independent of Phase 261-263's Brain-graph readiness/ceremony work --
touches `act-chain`/`chain_resolve`/SENSOR_REGISTRY, not the graph population)
**Repo:** MindrianOS-Plugin
**Milestone note:** Not part of v2.1.0 "Green the Floor" -- appended as the next open phase
number per PROJECT.md's continuous-numbering convention; sequence into v2.1.0's tail or a
future milestone at planning time, navigator's call, not blocked on 262/263 completing.
**Origin:** rethinking-mindrianos research trail
`research/2026-08-23-scientific-roadmapping-orchestrator/` -- synthesis of Convergent
Research's "Scientific Roadmapping" (six roadmap-type output taxonomy) + Leibo et al.'s
"A Manifesto for Multi-Agent Intelligence Research" (autocurricula run-loop), mapped onto
MindrianOS's existing research command family (find-bottlenecks, find-connections,
whitespace, find-analogies, macro-trends/explore-futures, build-thesis) and orchestration
substrate (act-chain, chain_resolve/chain_run, Workflow adversarial-verify/loop-until-dry).
**Plans:** 5/5 plans complete
Plans:
**Wave 1**

- [x] 264-01-PLAN.md -- chain table + drift validator + phase aggregator with the 166 regression, chain-executor zero-diff, and em-dash gates (wave 1, R2/R5/C-01)
- [x] 264-02-PLAN.md -- `lib/core/salient-governance.cjs`, the synchronous two-pass adversarial RS critic, plus its unit suite (wave 1, R4)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 264-03-PLAN.md -- SENS-18 roadmap-type classifier sensor, 3-array registration lockstep, 15-fixture suite (wave 2, R1)
- [x] 264-04-PLAN.md -- flagship direct-`runChain` challenge-driven proof + B3 source pin over chain-executor's gate functions (wave 2, R4/R5)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 264-05-PLAN.md -- sensor-to-`chain_resolve` wiring proof + phase closing gate (wave 3, R3/R5)

### Phase 265: Capability Radar Absorption + Routing (re-scoped, supersedes orphaned Phase 138)

**Goal:** Turn /mos:radar from a reader into a router so Claude Code capability findings from --fetch get ABSORBED (retrofit shipped code a new capability obsoletes) and WEAPONIZED (force future phase planning to consider them) instead of rotting in a one-shot SEED or an abandoned phase. Corrects three stale facts from the original 2026-06-01 scoping (originally filed as Phase 138, orphaned when ROADMAP.md's rolling window moved past it without shipping or retiring it): (1) subagent forking is now the unconditional default in Claude Code, not a probabilistic "likely supersedes" call against SEED-003 A4 -- settled, not still open; (2) the real destination for native-default-forking adoption is the PWS parallel-fan-out-then-consolidate engines (/mos:eureka, /mos:bono, /mos:find-connections, /mos:whitespace, /mos:find-analogies), not the previously-assumed Phases 133-136 which are unrelated; (3) the capability ledger needs refreshing from 2.1.159 to 2.1.246, screening in MCP interrupted-tool-call explicit errors, MCP elicitation dialog fixes (directly relevant to this plugin's own gate_render elicitation rung), and Agent Tool's clear-error-on-missing-agent-type fallback. Supersedes SEED-003 and the orphaned Phase 138 (mark both superseded-by this phase, do not delete).
**Requirements**: RADAR-01..RADAR-12, RADAR-14, RADAR-17..RADAR-31 (RADAR-13, RADAR-15 and RADAR-16 were retired before use, superseded by Phase 266's MCPFIX-01, MCPFIX-03 and MCPFIX-04)
**Depends on:** Phase 264
**Plans:** 23 plans in 6 waves (7 from the first planning pass, 16 added in the second pass on 2026-08-27)

**Scoping correction, recorded at plan time (2026-08-27):** stale fact (2) in the Goal above is itself a stale fact. Research verified against shipped code that NOT ONE of the five named PWS engines spawns a Claude Code subagent: eureka fires one detached Node process and polls, bono uses Promise.all over an in-process grid (navigator-confirmed as the intended final design), find-connections runs sequential Brain MCP queries in the main context, whitespace shells one script per subcommand, and find-analogies uses Brain calls plus a report script. Default subagent forking is a no-op for all five. The real fan-out surfaces are /mos:act --swarm, /mos:persona --parallel, /mos:grade --full, and /mos:trending-to-absurd (Expert path), and all three explicit ones instruct Claude to pass run_in_background, a parameter the platform removes in fork mode. A fourth stale fact nobody flagged is the most consequential: references/capability-radar/changelog-cache.md tops out at 2.1.128 and was last written 2026-05-05, so the ledger is 118 versions behind, not 87. The corrected reasoning is preserved in docs/RADAR-ABSORPTION-265.md rather than lost.

Plans:

- [ ] 265-01-PLAN.md - Wave 1 - the capability ledger, freshness tripwire, doctor organ, and phase test harness
- [ ] 265-02-PLAN.md - Wave 1 - MCP elicitation schema currency (stops multi-select rung-1 gates showing raw slugs)
- [ ] 265-03-PLAN.md - Wave 1 - the three swarm-command retrofits: run_in_background removal, the reviewed allowed-tools Task grant, and the reversed resolveModel fix
- [ ] 265-04-PLAN.md - Wave 1 - explicit dispatch shapes for trending-to-absurd and explore-opportunity, plus the navigator decision on parallelizing the explore legs
- [ ] 265-05-PLAN.md - Wave 2 - /mos:radar --fetch writes the ledger under an injection fence, and both radar reference docs corrected
- [ ] 265-06-PLAN.md - Wave 2 - retire SEED-003 and Phase 138 by marking, close drift finding W007-138, and write the decision record
- [ ] 265-07-PLAN.md - Wave 3 - regenerate skill and dist mirrors, file the two-home dev-research trail, and run the phase gate

**Second planning pass, 2026-08-27.** The navigator settled nine additional workstreams after the
first pass shipped its plans: the MCP-layer audit, the file-meeting redesign (four parts), the six
generative-redesign candidates, the online-research gap, the persona-builder duplication, and the
explore-opportunity build-out (the navigator answered 265-04's Task 3 decision gate with
`build-now-in-265`). Plans 265-08 onward are that scope. Plan 265-08 was written and then DELETED
before commit: Phase 266 was created the same day to own the four crisp MCP fixes on an independent
shipping schedule, so 265-08 (the instructions 2KB overflow) duplicated MCPFIX-01 exactly, and plans
265-09 and 265-17 were rescoped down to what Phase 266 does not cover. The numbering gap at 265-08
is deliberate.

- [ ] 265-09-PLAN.md - Wave 1 - Brain tool descriptions naming retired backends, plus the wire-level description hygiene tripwire Phase 266's shape checks do not cover
- [ ] 265-10-PLAN.md - Wave 1 - file-meeting: ask the meeting date before extraction, probe transcript size, and actually render the declared F.8 gate
- [ ] 265-11-PLAN.md - Wave 1 - lens-engine: put weighted-by-context on the existing Promise.all branch so /mos:research stops fetching lenses one at a time
- [ ] 265-17-PLAN.md - Wave 1 - retire the frozen MCP tool counts and the breached token-budget claim in the server header and three docs
- [ ] 265-12-PLAN.md - Wave 2 - the reviewed subagent-dispatch grant registry, covering both Task and Agent tokens (closes the invisible deep-grade grant)
- [ ] 265-13-PLAN.md - Wave 2 - declaration truth: 19 unfilled [methodology] placeholders, the futures web_scope correction, and four live requires_evidence consumers
- [ ] 265-14-PLAN.md - Wave 4 - mos-reason: one subagent per room section behind the migration-backup guard, with a cross-section coherence check
- [ ] 265-15-PLAN.md - Wave 4 - scout step 4b: per-competitor fan-out with same-event dedup and typed failures in the shared scanner module
- [ ] 265-16-PLAN.md - Wave 4 - persona: the generate-personas MCP action routes to /mos:persona --parallel instead of serving template output as analysis
- [ ] 265-18-PLAN.md - Wave 4 - explore-opportunity: probe-first parallel legs with a cost guard that reproduces quality_early_stop's cost outcome, zero diff on the shared executor
- [ ] 265-19-PLAN.md - Wave 4 - file-meeting: five parallel whole-transcript extraction perspectives feeding (never bypassing) the nugget routing gate
- [ ] 265-20-PLAN.md - Wave 4 - deep-grade: reconcile the 5-versus-7 rubric FIRST, then the per-component panel with grade-grant's fail-closed consolidation
- [ ] 265-21-PLAN.md - Wave 4 - vault import review and find-analogies --external: threshold-gated and dedup-gated fan-outs
- [ ] 265-22-PLAN.md - Wave 4 - diffusion: a roster parameter on runIntelPipeline's existing stages, closing the one genuine online-research gap
- [ ] 265-23-PLAN.md - Wave 5 - ratify every wave-4 dispatch grant, build the MCP surface doctor organ, and record every deferred architecture decision in the ledger
- [ ] 265-24-PLAN.md - Wave 6 - second close: regenerate the mirrors again, file the second-pass dev-research trail, and run the full gate with the grant strict flag on

### Phase 266: MCP Layer Correctness Fixes

**Goal:** Fast, independently shippable fixes to the MCP transport layer, found live during Phase 265's audit. (1) CRITICAL: `lib/mcp/runtime-instructions.cjs` serves 2173 bytes against Claude Code's 2KB instructions cap (since 2.1.84), silently truncating the Canon Part 8 graph-boundary paragraph mid-sentence in every session -- fix by trimming under 2048 bytes without losing Part 8 language, and fix `no-instructions.test.cjs` to assert the real host-side byte cap instead of the wrong boundary. (2) `tool-router.cjs:648` splices 80 raw chars of `voice-dna.md` into the `room_state` tool description, shipping a malformed stray-H1 mid-word-cut description to every host. (3) `mcp-dep-heal.cjs:104` runs a blocking `spawnSync npm install` capped at 120s during MCP `initialize`, 4x the host's own ~30s connect timeout, so it always fails from the host's side first. (4) the MCP guardrail test reports 35 passed / 0 failed while covering only 8 of 36 registered tools, a false-coverage signal. Deliberately decoupled from Phase 265 (capability-radar-absorption-routing): that phase's redesign work (parallel subagent dispatch across multiple commands) is exploratory and slower; these are crisp, low-risk, mechanical fixes that should ship in the next version cut on their own schedule, not wait on the larger phase.
**Requirements**: MCPFIX-01, MCPFIX-02, MCPFIX-03, MCPFIX-04 (minted at plan time 2026-08-27)
**Depends on:** none -- deliberately independent of Phase 265 so it can ship on its own schedule
**Plans:** 5 plans, all 5 executed. 266-05 closed the MCPFIX-03 gap 266-VERIFICATION.md found (per-call connect budget compounding to a measured 60296ms across the 4 sequential module-scope heal calls each entry point makes, against a ~30000ms host connect timeout) by replacing it with ONE process-wide shrinking deadline.

Plans:

- [x] 266-01-PLAN.md -- wave 1, MCPFIX-01: trim RUNTIME_INSTRUCTIONS under the 2048-byte host cap with the Canon Part 8 paragraph byte-identical, pin the cap at the HOST boundary, create tests/run-all-266.sh
- [x] 266-02-PLAN.md -- wave 1, MCPFIX-02: replace the voice-dna.md splice in room_state with authored prose naming its five commands, delete the dead compact path at both ends
- [x] 266-03-PLAN.md -- wave 1, MCPFIX-03: bound both arms of the dependency-heal race to a connect-path budget under the host connect timeout, keep the SessionStart hook at 120s
- [x] 266-04-PLAN.md -- wave 2, MCPFIX-04: expand tests/test-234-tool-description-floor.cjs to every registered tool, report its own coverage, run the phase gate with no escape
- [x] 266-05-PLAN.md -- wave 2, MCPFIX-03 GAP CLOSURE (2026-08-27): replaced the per-call connect budget with ONE shrinking process-wide deadline (beginConnectPathBudget/connectPathRemainingMs) armed at each entry point, short-circuits every heal call once it is spent, added the cumulative multi-call wall-clock test (tests/test-266-connect-path-process-budget.cjs) the phase was missing. `bash tests/run-all-266.sh` PASS=9 FAIL=0. See 266-05-SUMMARY.md.

### Phase 267: MCP Stateless Protocol Migration

**Goal:** CORRECTED SCOPE (2026-08-27, post-research) -- the original goal statement below the line was wrong on its central factual claim and has been superseded; kept for the paper trail, not as current direction.

Actual finding: `@modelcontextprotocol/sdk@1.30.0`'s `types.js` is byte-identical to 1.29.0 -- the `sessionIdGenerator: undefined` pattern cited as proof of stateless-spec support predates SEP-2575 entirely and is not evidence of anything. The real 2026-07-28 spec lives in a different, new package family (`@modelcontextprotocol/core`/`/server`/`/client`/`/node`, v2), not a version bump of the `sdk` package this repo vendors.

Further correction: the "Brain server" half of this phase does not belong to MindrianOS-Plugin at all. `/home/jsagi/Theo/package.json` -- a separate, actively developed repo -- describes itself verbatim as "Theo -- MindrianOS's consolidated MCP server over the Book of Innovation graph": it IS the designated Brain-hookup replacement (per the navigator's standing note that Theo replaces MindrianOS's Brain hookup soon), and it is already on `@modelcontextprotocol/sdk@1.30.0` and `zod@4.4.3` -- ahead of this repo on both, including the exact zod 3-to-4 bump this phase's research flagged as carrying a silent-failure risk. There is no Brain-server migration for MindrianOS-Plugin to build here; that work is Theo's own, in Theo's own repo, tracking ahead of this one already.

**Corrected scope: the local `mindrian-os` MCP server only, and it is currently BLOCKED**, not buildable now -- it depends on an upstream `ext-apps` peer-dependency pin that has not been investigated in depth (only surfaced, not root-caused or confirmed unworkaroundable). Do not plan or execute this phase until that blocker is either resolved upstream or confirmed to have a safe local workaround. See `267-RESEARCH.md` for the full finding and `267-RESEARCH-stateless-spec-update.md` for the original (partially superseded) spec research.

---
Original goal statement (superseded, kept for paper trail): Bump vendored `@modelcontextprotocol/sdk` from 1.29.0 to 1.30.0+ and adopt the 2026-07-28 stateless-first MCP spec (SEP-2575) across both MCP servers (mindrian-os local server, mcp-server-brain). Scope: (1) enable stateless mode on both servers, removing dependence on the `initialize`/session handshake this repo currently assumes; (2) rework `lib/mcp/gate-render.cjs`'s elicitation implementation from held-open-SSE-stream to the new Multi Round-Trip Requests (MRTR) pattern (`input_required`/`inputResponses`); (3) verify backward compatibility per the Tri-Polar rule (CLI/Desktop/Cowork); (4) re-test the full MCP layer against the new model.
**Requirements**: TBD
**Depends on:** Phase 266 AND the ext-apps upstream blocker clearing (or a confirmed workaround) -- BLOCKED, do not plan yet
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 267 to break down)

### Phase 267.1: Hooked Model Completeness Audit (first-session onboarding) (INSERTED)

**Goal:** Audit `scripts/session-start`'s `FIRST_INSTALL` prose injection against this repo's own hard rule that the Hooked Model (Fogg B=MAP, Trigger-Action-Reward-Investment) is the mandatory design lens for the first step of any Mindrian surface. Already confirmed this session: real Trigger and Action legs (warm opener, three explicit choices, JTBD-formula framing for returning users). NOT yet verified: Reward and Investment. Does the onboarding flow deliver a genuine variable Reward (a real payoff visible in that same first session, not just a promise) and build real Investment (something the user puts in that increases the odds they return -- e.g. USER.md profile-building, a filed artifact, a habit cue)? Map the full loop explicitly, cite the actual prose/code for each leg, and flag any leg that is asserted in a hard-rule doc but not actually implemented. Content-level UX audit work, not protocol work -- despite sitting numerically under Phase 267, it does NOT depend on the MCP stateless migration (now known to be BLOCKED, see 267) and should be planned/executed independently, on its own schedule.
**Requirements**: TBD
**Depends on:** none -- independent of Phase 267's now-blocked status, planned/executed on its own schedule
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 267.1 to break down)

### Phase 268: Transition Selected Workflows to MCP Tools

**Goal:** Two workstreams.

**W1 -- Build the two already-confirmed candidates.** (1) `find-bottlenecks` / RS-engine -- currently a raw `node -e` shell-out to `lib/agents/reverse-salient-agent.cjs`, parsed from stdout, returning exactly one finding. Promote to a proper MCP tool with a real `outputSchema` (this repo's 36 existing tools declare zero `outputSchema`s per the Phase 265 MCP-layer audit -- this would be the first), consistent structured error handling instead of stdout-scraping, and Tri-Polar reach: callable from Desktop, Cowork, or any other MCP client, not just a Claude Code slash-command. (2) `eureka` -- currently a hand-rolled fire-and-poll pattern (fires one detached Node process, polls status up to 3 times over ~15s). The 2026-07-28 MCP spec ships a native Tasks extension (asynchronous execution of long-running operations, with polling, mid-flight input, and durable handles) built for exactly this shape -- rearchitect eureka onto the platform's own Tasks primitive instead of the hand-rolled poll loop. Explicitly OUT OF SCOPE: `find-connections` / cross-domain innovation -- analyzed and rejected this session as a weak case (thin sequential Brain queries where Larry's in-the-loop reasoning between queries is likely load-bearing).

**W2 -- Every command that RUNS CODE (shells out to a script/process), examined for the same switch, with a real designed MCP schema for each qualifier, not just a verdict.** Scope is narrower and more concrete than "all remaining commands" -- it is specifically the subset Scouts A/B/C already identified as "one Node/Python dispatcher script doing its own internal sequencing" or an equivalent code-shell-out pattern, since those are the commands with actual deterministic logic worth wrapping in a schema (the pure-conversational Larry-narrated methodology commands are NOT in scope here -- flattening those into a tool call would lose the thing that makes them work). Named candidates from this session's own audit, to be confirmed/expanded, not re-discovered from scratch: `whitespace` (8 subcommands, each one script invocation), `find-analogies` (already flagged, `scripts/analogy-fitness-report.cjs`), `diagnostics` (4 Python scripts), `doctor`, `dial-memory-refresh`, `feynman-timeline-refresh`, `dashboard`, `brain-derive`, `mva-brief`/`mva-option`/`mva-report`, `explain-decision`, `correct-reference-now`, `auto-explore`, `rs-fetch`/`rs-experts`/`rs-explain`/`rs-thesis`, `scout`, `vault`, `deep-grade`, `opportunities`, `agentshield`, `room`, `diagnose`, `dogfood-flush`, `new-surface`, `publish`, `present`, `pws-brain`, `intel-pipeline`, `graph`, `memory`/`memory-cortex-reach`, `scheduled-tasks`, `models`, `setup`.

For each: (1) confirm it genuinely runs code rather than just describing that it does, (2) if it qualifies, DESIGN the actual MCP tool -- a real input schema (what parameters it needs) and a real `outputSchema` (what structured result it returns), not a placeholder, (3) apply the token-cost rubric from W1's reasoning: the trade-off is not "MCP tool always costs tokens, command is always free" -- it depends entirely on the `alwaysLoad` choice, which is set per tool. A command's markdown body loads ZERO tokens until invoked (Claude Code's command system is lazy). An MCP tool registered `alwaysLoad: true` (as ALL 36 of this repo's existing tools currently are, ~7,062 tokens combined per the Phase 265 audit) pays its description+schema cost in EVERY session from turn 1 regardless of use -- the fixed tax that justifies `alwaysLoad` existing at all, worth paying only for tools genuinely needed early. A tool registered WITHOUT `alwaysLoad` costs close to nothing until the platform's own tool-search discovers it (deferred loading -- currently unused anywhere in this repo). So each qualifying candidate gets an explicit `alwaysLoad: true/false` call plus its estimated token cost, alongside its designed schema -- the deliverable is schemas ready to build from, not a bare promote/don't-promote list.
**Requirements**: TBD
**Depends on:** Phase 267
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 268 to break down)

### Phase 269: Moat Shift -- Install/Update Entitlement Gate

**Goal:** Move the Brain/Theo access gate off per-query Brain-API-key checks entirely. Once Theo replaces the Brain (Phase 267 / Theo's own Phase 9), Theo access becomes unconditional for any installed MindrianOS user -- no personal key required, no trial-expiry refusal. The entitlement gate moves to a different action: installing and updating MindrianOS itself requires a valid key. Theo stays remote (never bundled -- this does NOT reverse decision #5's "remote by design"; it moves decision #1's "keyless session gets an honest refusal" from query-time to install/update-time). Navigator-locked 2026-08-27: "the key will be required to install and update mindrian... there will be no dependency on key to access [Theo]... it will be accessible to any mindrianOS user... we are shifting the moat."

**Concrete mechanism (navigator refinement, 2026-08-27):** the install page's existing Google-auth flow (`mindrian-website`'s `/brain-access`, Supabase `signInWithOAuth({provider:"google"})`) is repurposed. Today that flow's ONLY output is a Brain API key. Under this phase, the same Google-auth gate issues (or is extended to also issue) the install/update entitlement credential -- the general-access gate is now install-and-update, not Brain-specific. This directly touches the SAME auth-flow code this session already root-caused for Gaurav Thorat's double-sign-in finding (`components/brain/AuthButton.tsx`, `src/app/auth/callback/route.ts`, no canonical-domain redirect in `next.config.ts`) -- fixing that seam and building this gate are the same body of work, not two separate auth flows. Whether the install/update key REPLACES the Brain key outright or the two become one credential with two authorized uses is a decision for this phase's own planning, not decided here.

This requires reconciling, not silently editing: `.claude/includes/decisions.md` Key Decision #1 ("a keyless session gets an honest refusal, never a silent local substitute" -- currently checked at query-time, becomes install/update-time) and #5 ("Brain is remote by design, not optional by default" -- stays true, needs a clause noting per-query keys are gone); `.claude/includes/moat.md` (the moat reframes from "pay per graph query" to "pay for the install/update right" -- the graph itself becomes freely queryable once a user is in); and the personal-memory business-model note (`project_mindrianos_business_model.md`: "Free tier = prompt-Larry + Brain MCP; paid = trained Lawrence model" -- needs revisiting against the new model).

Cross-references: seeds directly into Theo's own `.planning/ROADMAP.md` Phase 9 ("Brain-Contract Cutover") open doctrine question -- "what happens to `brain_ask`/`brain_query`/`brain_search` (the three highest-traffic real callers, none contract-pinned)... no document currently states what happens to it at cutover" -- this phase's decision answers that directly: they become keyless/unconditional. Also touches Phase 234 (MindrianOS as Infrastructure: Skills, MCP Everywhere, Open Core) and Phase 267.1 (Hooked Model onboarding audit -- removing the key-friction step changes the onboarding Trigger/Reward/Investment legs). Directly resolves the Brain-key friction Gaurav Thorat's trial-install testimonial flagged (`docs/testers/gaurav-thorat/FEEDBACK.md`, the `rethinking-mindrianos` research trail).
**Requirements**: TBD
**Depends on:** none technically, but sequenced after Theo's own Phase 9 gets a firmer timeline for the actual install/update-gate ENGINEERING (building a check against an interim cutover state risks throwaway work). The DECISION-RECORDING half (updating decisions.md/moat.md) can happen now via this phase's own planning.
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 269 to break down)
