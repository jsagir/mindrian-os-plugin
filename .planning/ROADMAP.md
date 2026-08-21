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
**Plans:** 7/13 plans executed. 13 plans, 5 waves. Deliberately many and small: the authoring
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
- [ ] 261-08-PLAN.md (wave 2) - CER-05 alias hygiene: the 165-edge self-loop DELETE scoped by predicate not label, the absorbed Phase 256 entity dedups, and all four residue items as cards
- [ ] 261-09-PLAN.md (wave 2) - the Gate 0 archived-block relabel: per-node review list, TRIZ as one row, and the live per-name collision check that stops a restore from breaking a passing floor row
- [ ] 261-10-PLAN.md (wave 2) - the absorbed missing-`USES_FRAMEWORK`-edge batch, derived from tracked command frontmatter because the original audit artifact is unreachable

**Wave 3** *(pre-flight, blocked on all authoring)*

- [ ] 261-11-PLAN.md (wave 3) - payload JSON emitter for the HTTPS admin seam, mechanical batch-integrity gate, and the full window runbook with its close procedure written FIRST

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
