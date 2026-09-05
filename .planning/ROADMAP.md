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

**Goal:** Wire `/mos:suggest-next` and `/mos:act` to consume the real Brain
orchestration projection (SEED-045 open item 1 / SEED-043; substrate ~85% shipped, never
wired) instead of `recipe-maps.cjs` alone. Includes the navigator-ruled server-side
composition option (mindrian-os MCP tool handlers composing Brain calls at explicit
invocation time, SEED-053 precedents this as Part-8-clean) -- if approved, the 239-05
fail-closed belt in `brain-client.cjs` is a same-phase prerequisite, not a follow-up, since
server-side calls bypass the per-tool-call egress-guard hook's name-matching. Per-turn
`decide()`/sensor dispatch stays projection-fed (R7: no live Brain call at decide()/rank
time) -- this phase does not touch that path.
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04, COMP-01, COMP-02 (minted 2026-09-02 per 254-CONTEXT.md D-05, ratifying 254-RESEARCH.md's proposed family; registered to .planning/REQUIREMENTS.md at phase close by 254-06-PLAN.md, per the Phase 266/269/272/274 precedent)
**Depends on:** Phase 262 (Floor Green -- re-gated 2026-08-20; the retired Phase 253 was its
original dependency, this phase's own work reads the `:Framework` population, which is only
guaranteed clean once 262's exit gate is green)
**Repo:** MindrianOS-Plugin
**Navigator ruling (RESOLVED 2026-09-02, D-01):** RATIFY server-side Brain composition. Research
found it already ships in two released, tested places (`orchestration act*`'s Tier-3 live Brain
call in `brain-router.cjs`, and `suggest_next`'s chain offer in `sensors.cjs`), so the real
question was ratify-vs-remove, not approve-vs-decline. Both sites stay; this phase enumerates them
(COMP-01) and closes the one residual `ambiguous`-verdict gap in the `callTool` belt with
disclose-and-proceed (COMP-02, D-02 Option A).
**Theo forward-compatibility (navigator ruling, 2026-09-02, standing rule -- CLAUDE.md "Consult
ALL Relevant Grounding Sources"):** before this phase's research locks, check whether the
orchestration projection this phase consumes has a Theo-side analog (`/home/jsagi/Theo`, the
designated Brain successor, weeks not months from its cutover per Phase 262's own dated
measurement) -- state explicitly in RESEARCH.md whether the composition work targets a surface
Theo will also need adapting, so the eventual flip is a smaller diff, not a rediscovery.
**Plans:** 6/6 plans complete
Plans:
**Wave 1**

- [x] 254-01-PLAN.md (wave 1) -- the projection-first chain-source seam `lib/workflow/chain-source.cjs` plus the phase aggregator and the WIRE-01/WIRE-02 suites
- [x] 254-03-PLAN.md (wave 1) -- the framework-vocabulary drift gate and its wiring into pre-commit, release and doctor (WIRE-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 254-02-PLAN.md (wave 2) -- wire `suggest-next-command.cjs` and `act-command.cjs` to the one seam, with the source-disclosure line (WIRE-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 254-04-PLAN.md (wave 3) -- the Brain-composition census enumerating every `mindrian-os` handler that reaches the Brain (COMP-01)
- [x] 254-05-PLAN.md (wave 3) -- the `ambiguous`-verdict disclosure in the `callTool` belt plus D-06's two-leg normalize round-trip probe (COMP-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 254-06-PLAN.md (wave 4) -- the R7 structural fence, the D-07 Theo adaptation-list note, and the REQUIREMENTS.md registration

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
**Theo forward-compatibility (navigator ruling, 2026-09-02, standing rule -- CLAUDE.md):**
check whether `DataRoomSection` projection and the section-affinity edge vocabulary have a
Theo-side equivalent before this phase's research locks -- Theo is the designated Brain
successor and is weeks from cutover per Phase 262's own dated measurement.
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

**Goal:** Make the already-shipped Part 8 guard's verdict VISIBLE and CORRECTLY CLASSIFIED at the
model-facing surface, lock it with a wire-level structural invariant, and rule explicitly on the one
surface that genuinely has no local belt. (RESHAPED 2026-09-02 by `257-RESEARCH.md` + `257-CONTEXT.md`:
H3 as originally written below is FALSE and has been since `ca32b612`, 2026-08-19 09:26, two and a half
hours BEFORE the handoff's own base commit. The stdio shim delegates fully through
`brain-client.cjs::callTool`, which carries the fail-closed belt; a live wire probe measured four
`egress_blocked` refusals and zero captured bytes. What is actually broken is honesty at the RETURN
path, G1/G2/G3. The genuinely uncovered surface is `pws-brain-mcp` direct-HTTPS, which is Desktop's and
Cowork's path. Original text preserved below for the record.)

**Original framing (disproven, kept for provenance):** Close H3 from `docs/2026-08-20-HANDOFF-part8-guard-in-mcp-handlers.md`:
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
**Requirements**: LOCUS-01, LOCUS-02, LOCUS-03, LOCUS-04, LOCUS-05, LOCUS-06, LOCUS-07, LOCUS-08,
LOCUS-09, LOCUS-10 (minted at plan time 2026-09-02, registered in `.planning/REQUIREMENTS.md`)
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
**Navigator ruling: RESOLVED 2026-09-02 (D-01 + D-02, `257-CONTEXT.md`).** Far side: LOCAL-ONLY,
documented. No far-side guard is built. `mcp-server-brain/` in this repo is the DEAD Neo4j+Pinecone
service the operator was told to suspend; the live far side is `ProblemsWorthSolving-Brain` (ESM), and
a far-side check runs on content already RECEIVED over TLS, so it can prevent USE but never RECEIPT.
Direct-HTTP: ACCEPT AND DOCUMENT; deprecating or rerouting `pws-brain-mcp` is a separate larger phase.
Both rulings are recorded in `docs/257-NOTE-part8-enforcement-locus-rulings.md`.
**Adjacent, do NOT absorb:** D-239-05-01 (`.planning/phases/239-brain-access-surface/deferred-items.md`)
is a payload-design question (send a generic handle instead of raw domain text); H3 is an
enforcement-locus question. Flag the interaction, leave the decision.
**Canon:** Part 8 PR gate applies (Canon Custodian review required).
**Theo forward-compatibility (navigator ruling, 2026-09-02, standing rule -- CLAUDE.md):**
the direct model-issued `mcp__...mindrian-brain__*` bypass H3 closes has a Theo-shaped question
too -- once Theo consolidates room-side operational tools into the same catalog as content
tools (per Theo's own CLAUDE.md architecture doctrine), check whether this phase's
enforcement-locus fix needs to also cover the Theo-catalog surface, not just today's
`mindrian-os` server, before this phase's research locks.
**Plans:** 9/9 plans complete
Custodian checkpoint, is a blocking human-verify gate and has not yet run)
Plans:
**Wave 1**

- [x] 257-01-PLAN.md - mint the `egress_blocked` refusal kind + amend the two frozen downstream contracts (W1)
- [x] 257-02-PLAN.md - additive `refusal` + `egress_disclosure` pass-through in `wrapDirective()` (W1)
- [x] 257-03-PLAN.md - correct the record: census parenthetical + dated handoff correction (W1)
- [x] 257-04-PLAN.md - the D-01/D-02 rulings note + the Theo T-1/T-2/T-3 forward-compat note (W1)
- [x] 257-05-PLAN.md - baseline honesty: capture pre-change gates + de-freeze the two red 239 arms (W1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 257-06-PLAN.md - shim honest-refusal wiring: G1 branch + `honestRefusal` helper, proven on the wire (W2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 257-07-PLAN.md - the locked egress invariant (spawn + live `tools/list`) + `run-all-257.sh` (W3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 257-08-PLAN.md - `registerTool` + `z.strictObject` migration, closing undeclared-key smuggling (W4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 257-09-PLAN.md - Part 8 gate battery, LOCUS registration, Canon Custodian checkpoint (W5).
      Tasks 1 (`257-COMPLIANCE.md`) and 2 (LOCUS-10 automated half + Traceability + this ROADMAP
      entry) complete 2026-09-03; Task 3 (blocking human-verify checkpoint) pending navigator
      review.

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

- [x] 261-13-PLAN.md (wave 5) - post-close probes, one `GRAPH-WRITE-LOG` row per batch plus a retrospective row for the 2026-08-20 heal run, the execution record, ONE navigator-approved push that discharges the Phase 260 freeze, and the Phase 262 handoff (fresh floor, live `Scenario Planning` resolver count for FLOOR-03, relabel-vs-edges attribution split) (completed 2026-09-02)

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
**Repo:** MindrianOS-Plugin (CORRECTED 2026-09-02, per 262-RESEARCH.md's "Repo Ruling" -- the
gate script, the ratified denominator, the FLOOR-02 fixture and the tracked requirement IDs all
live here; the Brain repo's own independent `.planning/ROADMAP.md` has zero occurrences of
FLOOR-01/02/03 or "Phase 262," verified by grep. FLOOR-01's *measurement* runs entirely in this
repo; its *remediation* for 6 of 8 rows is Brain-repo work, handed off as a written work order,
never executed inline -- kept as a "ProblemsWorthSolving-Brain" pointer, not this phase's repo).
**Downstream:** Phases 254 and 255 (this session's consumption-wiring and section-affinity
work) both depend on THIS phase, not on the retired Phase 253 -- they read the `:Framework`
population and need it green.
**Theo flip (load-bearing, not a footnote -- see 262-RESEARCH.md "The Theo Flip"):** the gate
this phase measures reads response shapes that do not exist on Theo, the designated Brain
successor now weeks (not months) from cutover -- `check-flagship-floor.cjs` and
`scripts/build-brain-census.cjs` are both currently UNLISTED on Theo's own 7-file adaptation
list. This phase adds a tripwire (unrecognized envelope -> VOID, not a false MISS) rather than
adapting to Theo's shape now, and gets both files added to Theo's adaptation list.
**Plans:** 5/5 plans complete
Plans:
**Wave 1**

- [x] 262-01-PLAN.md - Wave 0 measurement floor: ratified-denominator integrity test, the D-07 SEP-projection probe, and the tests/run-all-262.sh aggregator (FLOOR-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 262-02-PLAN.md - The Theo tripwire: unrecognized response envelope becomes a VOID (kind unrecognized_shape), never a silent false RED (FLOOR-01, D-04)
- [x] 262-03-PLAN.md - FLOOR-02: the keyless fixture repurposed to no-identity-refusal, gate 1 hardened with a no-methodology-served negative assertion, wire string byte-locked (FLOOR-02, D-06)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 262-04-PLAN.md - The live, human-gated measurement sitting: dated floor verdict, FLOOR-03 re-measurement, SEP counts, write-seam check (FLOOR-01, FLOOR-03)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 262-05-PLAN.md - The signed gap ledger plus the Brain-repo work order and the Theo adaptation-list note (FLOOR-01, FLOOR-02, FLOOR-03, D-01/D-02/D-05)

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
**Theo forward-compatibility (navigator ruling, 2026-09-02, standing rule -- CLAUDE.md):**
SEED-A/SEED-B's framework-grounding checks and the long-tail worklist reader both read the
incumbent `:Framework` population directly -- re-verify against Theo's population (712 nodes,
149 frameworks as of 2026-09-01, far smaller than the incumbent's) before assuming this
phase's queue logic ports unchanged at cutover.
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
**Plans:** 23/23 plans complete (7 from the first planning pass, 16 added in the second pass on 2026-08-27). Executed across 5 DAG-verified waves (frontmatter declares 6; several wave-4/5-declared plans were DAG-satisfied by wave 2/3 dependencies and ran earlier). Final gate 2026-08-27: `bash tests/run-all-265.sh` (no escape flags) PASS=26 FAIL=0; `TEST_265_GRANTS_STRICT=1` PASS (0 unratified, 11/11 granted); `bash tests/run-all-264.sh` PASS=14 FAIL=0 with `lib/core/chain-executor.cjs` zero-diff intact; both doctor organs (capability-ledger-fresh, mcp-surface-tool-count) green; all generation/coverage gates green. Independently re-verified by the orchestrator, not just the executors' own reports.

**Scoping correction, recorded at plan time (2026-08-27):** stale fact (2) in the Goal above is itself a stale fact. Research verified against shipped code that NOT ONE of the five named PWS engines spawns a Claude Code subagent: eureka fires one detached Node process and polls, bono uses Promise.all over an in-process grid (navigator-confirmed as the intended final design), find-connections runs sequential Brain MCP queries in the main context, whitespace shells one script per subcommand, and find-analogies uses Brain calls plus a report script. Default subagent forking is a no-op for all five. The real fan-out surfaces are /mos:act --swarm, /mos:persona --parallel, /mos:grade --full, and /mos:trending-to-absurd (Expert path), and all three explicit ones instruct Claude to pass run_in_background, a parameter the platform removes in fork mode. A fourth stale fact nobody flagged is the most consequential: references/capability-radar/changelog-cache.md tops out at 2.1.128 and was last written 2026-05-05, so the ledger is 118 versions behind, not 87. The corrected reasoning is preserved in docs/RADAR-ABSORPTION-265.md rather than lost.

Plans:

- [x] 265-01-PLAN.md - Wave 1 - the capability ledger, freshness tripwire, doctor organ, and phase test harness
- [x] 265-02-PLAN.md - Wave 1 - MCP elicitation schema currency (stops multi-select rung-1 gates showing raw slugs)
- [x] 265-03-PLAN.md - Wave 1 - the three swarm-command retrofits: run_in_background removal, the reviewed allowed-tools Task grant, and the reversed resolveModel fix
- [x] 265-04-PLAN.md - Wave 1 - explicit dispatch shapes for trending-to-absurd and explore-opportunity, plus the navigator decision on parallelizing the explore legs
- [x] 265-05-PLAN.md - Wave 2 - /mos:radar --fetch writes the ledger under an injection fence, and both radar reference docs corrected
- [x] 265-06-PLAN.md - Wave 2 - retire SEED-003 and Phase 138 by marking, close drift finding W007-138, and write the decision record
- [x] 265-07-PLAN.md - Wave 3 - regenerate skill and dist mirrors, file the two-home dev-research trail, and run the phase gate

**Second planning pass, 2026-08-27.** The navigator settled nine additional workstreams after the
first pass shipped its plans: the MCP-layer audit, the file-meeting redesign (four parts), the six
generative-redesign candidates, the online-research gap, the persona-builder duplication, and the
explore-opportunity build-out (the navigator answered 265-04's Task 3 decision gate with
`build-now-in-265`). Plans 265-08 onward are that scope. Plan 265-08 was written and then DELETED
before commit: Phase 266 was created the same day to own the four crisp MCP fixes on an independent
shipping schedule, so 265-08 (the instructions 2KB overflow) duplicated MCPFIX-01 exactly, and plans
265-09 and 265-17 were rescoped down to what Phase 266 does not cover. The numbering gap at 265-08
is deliberate.

- [x] 265-09-PLAN.md - Wave 1 - Brain tool descriptions naming retired backends, plus the wire-level description hygiene tripwire Phase 266's shape checks do not cover
- [x] 265-10-PLAN.md - Wave 1 - file-meeting: ask the meeting date before extraction, probe transcript size, and actually render the declared F.8 gate
- [x] 265-11-PLAN.md - Wave 1 - lens-engine: put weighted-by-context on the existing Promise.all branch so /mos:research stops fetching lenses one at a time
- [x] 265-17-PLAN.md - Wave 1 - retire the frozen MCP tool counts and the breached token-budget claim in the server header and three docs
- [x] 265-12-PLAN.md - Wave 2 - the reviewed subagent-dispatch grant registry, covering both Task and Agent tokens (closes the invisible deep-grade grant)
- [x] 265-13-PLAN.md - Wave 2 - declaration truth: 19 unfilled [methodology] placeholders, the futures web_scope correction, and four live requires_evidence consumers
- [x] 265-14-PLAN.md - Wave 4 (declared) / Wave 3 (DAG-actual) - mos-reason: one subagent per room section behind the migration-backup guard, with a cross-section coherence check
- [x] 265-15-PLAN.md - Wave 4 (declared) / Wave 3 (DAG-actual) - scout step 4b: per-competitor fan-out with same-event dedup and typed failures in the shared scanner module
- [x] 265-16-PLAN.md - Wave 4 (declared) / Wave 2 (DAG-actual, depends only on 265-03) - persona: the generate-personas MCP action routes to /mos:persona --parallel instead of serving template output as analysis
- [x] 265-18-PLAN.md - Wave 4 (declared) / Wave 2 (DAG-actual, depends only on 265-04) - explore-opportunity: probe-first parallel legs with a cost guard that reproduces quality_early_stop's cost outcome, zero diff on the shared executor
- [x] 265-19-PLAN.md - Wave 4 (declared) / Wave 3 (DAG-actual) - file-meeting: five parallel whole-transcript extraction perspectives feeding (never bypassing) the nugget routing gate
- [x] 265-20-PLAN.md - Wave 4 (declared) / Wave 3 (DAG-actual) - deep-grade: reconcile the 5-versus-7 rubric FIRST, then the per-component panel with grade-grant's fail-closed consolidation
- [x] 265-21-PLAN.md - Wave 4 (declared) / Wave 3 (DAG-actual) - vault import review and find-analogies --external: threshold-gated and dedup-gated fan-outs
- [x] 265-22-PLAN.md - Wave 4 (declared) / Wave 3 (DAG-actual) - diffusion: a roster parameter on runIntelPipeline's existing stages, closing the one genuine online-research gap
- [x] 265-23-PLAN.md - Wave 5 (declared) / Wave 4 (DAG-actual) - ratify every wave-4 dispatch grant, build the MCP surface doctor organ, and record every deferred architecture decision in the ledger
- [x] 265-24-PLAN.md - Wave 6 (declared) / Wave 5 (DAG-actual) - second close: regenerate the mirrors again, file the second-pass dev-research trail, and run the full gate with the grant strict flag on

### Phase 266: MCP Layer Correctness Fixes

**Goal:** Fast, independently shippable fixes to the MCP transport layer, found live during Phase 265's audit. (1) CRITICAL: `lib/mcp/runtime-instructions.cjs` serves 2173 bytes against Claude Code's 2KB instructions cap (since 2.1.84), silently truncating the Canon Part 8 graph-boundary paragraph mid-sentence in every session -- fix by trimming under 2048 bytes without losing Part 8 language, and fix `no-instructions.test.cjs` to assert the real host-side byte cap instead of the wrong boundary. (2) `tool-router.cjs:648` splices 80 raw chars of `voice-dna.md` into the `room_state` tool description, shipping a malformed stray-H1 mid-word-cut description to every host. (3) `mcp-dep-heal.cjs:104` runs a blocking `spawnSync npm install` capped at 120s during MCP `initialize`, 4x the host's own ~30s connect timeout, so it always fails from the host's side first. (4) the MCP guardrail test reports 35 passed / 0 failed while covering only 8 of 36 registered tools, a false-coverage signal. Deliberately decoupled from Phase 265 (capability-radar-absorption-routing): that phase's redesign work (parallel subagent dispatch across multiple commands) is exploratory and slower; these are crisp, low-risk, mechanical fixes that should ship in the next version cut on their own schedule, not wait on the larger phase.
**Requirements**: MCPFIX-01, MCPFIX-02, MCPFIX-03, MCPFIX-04 (minted at plan time 2026-08-27)
**Depends on:** none -- deliberately independent of Phase 265 so it can ship on its own schedule
**Plans:** 5/5 plans complete. 266-05 closed the MCPFIX-03 gap 266-VERIFICATION.md found (per-call connect budget compounding to a measured 60296ms across the 4 sequential module-scope heal calls each entry point makes, against a ~30000ms host connect timeout) by replacing it with ONE process-wide shrinking deadline. Phase independently re-verified passed 2026-08-27 (8/8 must-haves; `gsd-tools query phase.complete` overwrote this line with a generic "5/5 plans complete" one-liner, restored by hand here per this repo's established resync-clobber precedent).

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

**Navigator ruling (2026-09-01, RESOLVES the three-way decision `267-RESEARCH.md`'s primary recommendation left open): WAIT UPSTREAM.** Do not vendor the two SDK-v1-dependent ext-apps internals; do not gate MCP Apps off. Re-verified live against npm this session: `@modelcontextprotocol/ext-apps` is still at `1.7.5` (dist-tag `latest`), peer dep still `@modelcontextprotocol/sdk: ^1.29.0` -- unchanged since the 07-23 finding, confirmed not stale. Consequence, stated plainly so a future session does not silently re-litigate this: **Phase 268's W1 (MCP-tool transition) stays blocked indefinitely**, with no target date, until ext-apps ships a v2-compatible release. Revisit by re-running the same npm check above; do not re-open the vendor-vs-gate-off question without a new navigator ruling.

### Phase 340: Canon Currency Audit and Amendment (v1.24 to next) -- close the drift between docs/MINDRIAN-CANON.md (last touched 2026-06-25) and four fronts that shipped since: (1) SOURCED CLAIMS DOCTRINE, navigator-ruled 2026-09-05, new Part 12 sub-clause distinguishing hedged-opinion elevation (Canon-legal) from hedged-fabrication (a disclaimer word never exempts an invented number; sourced-or-absent), mirrored into agents/larry-extended.md, traced to SEED-086 and the real Aronhime fabrication incident; (2) THEO BLINDNESS, verified this session: grep confirms zero mentions of Theo anywhere in the Canon, and Appendix C Glossary line 728 still names pws-brain-mcp.onrender.com (the now-retired Memgraph incumbent) as THE Brain, though Phase 339 (shipped 2026-09-04) already flipped brain-client.cjs's live default origin to theo-mcp.onrender.com in production -- Part 8 and the Glossary need the cutover reflected; (3) LOCAL-GRAPH HARDENING, Part 9's chokepoint doctrine should be checked against Phase 273's SQLite chokepoint hardening and the Phase 276 node-insert.cjs single-write-chokepoint precedent for currency; (4) EXTENDED ICM SCHEMA, Phase 275's SECTION_NAMES 8-to-11 extension plus its L1/L2/L3 per-section mechanisms (statement field, CONTEXT.md writer, references/ factory dir) should be checked against Part 9's ICM Layer 0-4 doctrine (Appendix B) for currency. Sub-scope 1's direction is navigator-approved; exact clause wording for all four remains an open blocking checkpoint per this Canon's own Appendix D precedent (every one of 37 prior amendments required navigator sign-off on the literal text before any canon byte landed) -- this phase's discuss step is where that wording gets locked, not this registration. Harness-as-code detector work (a check-tool-honesty.cjs sibling for prose-fabrication) is explicitly OUT of this phase's scope, named as a phase-2 dependent on SEED-032/SEED-062 once that harness exists.

**Goal:** Close the drift between `docs/MINDRIAN-CANON.md` (v1.24, last touched 2026-06-25) and the codebase it governs, via a genuine part-by-part sweep of all 12 Parts and 4 Appendices (navigator directive D-03: "revisit full Canon to fit what Mindrian is, what it needs to be, and its current stack and architecture and JTBD, Larry"). The sweep confirmed the four registered fronts AND surfaced four more (Part 4's typed-edge vocabulary 15 types behind what ships, Part 7's prescriptive "25 methodology commands" stale by ~4.5x, Part 2's retired Pinecone backend, Part 11's stale surface-count snapshot). These land as THREE navigator-gated amendment waves, one Appendix D entry each - entry 38 (Sourced Claims Doctrine, canon v1.25), entry 39 (graph-substrate currency: Part 9 two-chokepoint split, Part 4 edge reconciliation, Appendix B ICM citations, canon v1.26), entry 40 (corpus figures corrected: Appendix C Theo origin, Part 2 e5-local, Part 7 de-frozen surface, Part 11 refreshed snapshot, plus the parallel CLAUDE.md fixes in the SAME commit, canon v1.27) - each preceded by a blocking navigator APPROVE on the exact prose, each carrying its own floor test, none weakening a frozen scalar or touching Appendix D entries 1-37.
**Requirements**: CANON-01, CANON-02, CANON-03, CANON-04, CANON-05, CANON-06, CANON-07, CANON-08, CANON-09, CANON-10 (minted at plan time 2026-09-05 from `340-RESEARCH.md`'s draft table, distributed across the 5 plans below, registered in `.planning/REQUIREMENTS.md` by plan 340-05, the phase-close plan, per the Phase 272 `PYPORT-` / Phase 273 `CHOKE-` / Phase 274 `ANCHOR-` / Phase 275 `ICML-` / Phase 276 `TOOLHON-` precedent)
**Depends on:** Phase 339
**Plans:** 1/5 plans executed

Plans:

- [x] 340-01-PLAN.md - Wave 0 scaffold: `tests/run-all-340.sh` aggregator (3 `run_if` legs SKIP until their wave lands, 4 `run` regression legs green today) plus `340-LIVE-VERIFICATION.md`, the dated live-command re-verification of every figure and citation the three amendment waves consume. Closes RESEARCH Open Questions 2 and 3. Autonomous, zero canon bytes (CANON-10)
- [ ] 340-02-PLAN.md - Amendment Wave A, canon v1.24 to v1.25: the Sourced Claims Doctrine into Part 12 plus its required mirror into `agents/larry-extended.md`, as Appendix D entry 38, behind a blocking navigator APPROVE on the exact prose (CANON-01)
- [ ] 340-03-PLAN.md - Amendment Wave B, canon v1.25 to v1.26: Part 9's two-chokepoint doctrinal split (D-01), Part 4's typed-edge-vocabulary reconciliation, and Appendix B's ICM code citations (D-02), as Appendix D entry 39 with a multi-Part placement-proof floor test, behind a blocking navigator APPROVE (CANON-02, CANON-03, CANON-04)
- [ ] 340-04-PLAN.md - Amendment Wave C, canon v1.26 to v1.27: Appendix C's Theo origin, Part 2's e5-local backend, Part 7's de-frozen command surface and Part 11's refreshed snapshot, as Appendix D entry 40 in the entries-13/16 "corpus figures corrected" voice, with the parallel CLAUDE.md corrections in the SAME commit (Pitfall 3), behind a blocking navigator APPROVE plus three named rulings (CANON-05, CANON-06, CANON-07, CANON-08, CANON-09)
- [ ] 340-05-PLAN.md - Phase close-out: post-amendment verification sweep (suite green, drift re-check, per-number Appendix D preservation proof, residual gaps named openly), `CANON-01 .. CANON-10` registered in `.planning/REQUIREMENTS.md`, and the Dev-Research Compositing trail filed to `rethinking-mindrianos/research/` mirrored to `mindrianOS/research/`. Autonomous (CANON-10)

---
Original goal statement (superseded, kept for paper trail): Bump vendored `@modelcontextprotocol/sdk` from 1.29.0 to 1.30.0+ and adopt the 2026-07-28 stateless-first MCP spec (SEP-2575) across both MCP servers (mindrian-os local server, mcp-server-brain). Scope: (1) enable stateless mode on both servers, removing dependence on the `initialize`/session handshake this repo currently assumes; (2) rework `lib/mcp/gate-render.cjs`'s elicitation implementation from held-open-SSE-stream to the new Multi Round-Trip Requests (MRTR) pattern (`input_required`/`inputResponses`); (3) verify backward compatibility per the Tri-Polar rule (CLI/Desktop/Cowork); (4) re-test the full MCP layer against the new model.
**Requirements**: TBD
**Depends on:** Phase 266 AND the ext-apps upstream blocker clearing (or a confirmed workaround) -- BLOCKED, do not plan yet
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 267 to break down)

### Phase 270: Memory and Context Operator MCP

**Goal:** Navigator observation, 2026-08-27: memory and context in this repo are scattered across many discrete MCP tools (`memory_event`, `graph_write`, `artifact_file`, `room_state_bound`, `graph_query`, `whitespace_scan`...) with no single thing owning the memory lifecycle end to end -- surfaced directly by this session's own finding that `~/.mindrian-user.md` (the promised cross-room "who is this user" file) has zero writers anywhere in the repo despite onboarding prose asserting it exists (Phase 267.1's GAP I-1, now Phase 267.2's W2). Theo's own package.json already frames itself as "MindrianOS's *consolidated* MCP server" for the Brain side -- the room side never got the equivalent treatment. Research this phase's actual shape: does consolidating room-side memory operations into one coherent "operator" surface (rather than many small tools) reduce real friction, or is the current fragmentation load-bearing (e.g. each tool's narrow scope is itself a Part 8 safety property, per `lib/mcp/*` tool descriptions -- verify before assuming consolidation is strictly better)? At minimum this phase should determine: (1) whether the cross-room identity write (Phase 267.2 W2's job) should be built as a first tool under this new operator rather than a one-off function, (2) whether Part 8's Brain-boundary enforcement (currently a documented convention, not a schema-level guarantee) can be made structurally enforced by a memory-operator tool's own input/output schema, and (3) how this interacts with Theo eventually becoming the consolidated Brain-side MCP -- does a room-side "memory operator" mirror that architecture, or is the analogy wrong because Brain content and room content have fundamentally different locality guarantees (Part 8: room data never leaves; Brain content is already remote by design).
**Corrected framing (post-research, 2026-08-27, from `270-RESEARCH.md`; the goal text above is kept verbatim as the ORIGINAL framing for the paper trail).** The question was aimed at the wrong layer. The IMPLEMENTATION is already consolidated: all 19 atomic memory/room tools route exclusively through `lib/core/navigation.cjs`, the single Part 9 chokepoint. What is fragmented is only the MCP tool-surface layer. Three corrections this phase carries and will not re-litigate: (a) **Part 8 is ALREADY triple-enforced** (import-graph isolation in `lib/core/navigation.cjs`, the per-job `privacy_mode` const in `data/brain-packet-schema.json` via `lib/core/navigation/packet.cjs:29-36`, and the runtime PreToolUse block in `scripts/part8-egress-guard-hook.cjs`), so sub-question 2's premise is factually wrong and Part 8 hardening is DE-SCOPED from the operator's justification; (b) **`alwaysLoad` is a SERVER-level flag** in `.mcp.json:6`/`:11`, not a per-tool one, so Phase 268's per-tool rubric is not expressible here and reducing the number and size of registered tool descriptions is the ONLY token lever this repo has; (c) the **"no walker exists" gap was overstated** - `walkFractalMemory` and `rollupSubRooms` both ship, plus `detectUnsentineledArtifactFolder`, and only a forest ROOT was genuinely missing. Design direction: NOT a `z.enum` mega-tool, but a thin operator that is mostly Resources, with every `F.1` write kept atomic and individually shape-declared. Sub-question 3 answered: **"mirror Theo" is EXPLICITLY REJECTED** - Theo consolidates over one already-remote read-mostly store; the room side is N room.db files across a nested forest with a hard cross-room-aggregation fence (`lib/core/navigation/edges.cjs:45`), human-gated promotion moments, and a never-leaves constraint. Sub-question 1 answered: **YES**, the cross-room identity write ships as `identity_write` under this operator (plan 270-11), built on `writeUserMdAtomic` UNMODIFIED - the mechanism already existed, only a caller was missing, so Phase 267.2 W2 must NOT build a second writer. **Not blocked by Phase 267:** every capability is buildable on the currently vendored `@modelcontextprotocol/sdk@^1.29.0`, with zero dependency on the blocked `ext-apps` pin.
**Requirements**: MEMOP-01..MEMOP-15 (phase-local working IDs minted at plan time; REGISTERED in `.planning/REQUIREMENTS.md` by plan 270-12, matching the Phase 266/269 precedent, with the same "minted at plan time" caveat carried on the rows)
**Depends on:** none directly -- cross-references Phase 267.2 W2 (the cross-room identity writer this phase's operator absorbs the MECHANISM half of; that phase still owns the TRIGGER) and Phase 268 (whose per-tool `alwaysLoad` rubric is corrected above, not reused). Sequencing relative to Phase 269 (moat shift) is not a hard dependency but worth planning after 269's credential model lands, since an entitlement check and a memory operator both touch the same MCP surface area.
**Plans:** 12/12 plans executed - PHASE COMPLETE (2026-08-27)

Plans:

**Wave 1** *(parallel; wave 1 ends RED by design - every `tests/test-270-*` pin fails until its implementation plan lands)*

- [x] 270-01-PLAN.md -- MEMOP-15: navigator decision gate. OQ-1 (DEPTH_CAP reconciliation, blocking wave 3) and OQ-2 (identity-write scope, blocking wave 6) answered once, early; OQ-3/OQ-4/OQ-5/OQ-7 recorded as dispositions; writes `270-DECISIONS.md` and no code
- [x] 270-02-PLAN.md -- MEMOP-01/02/09: `tests/run-all-270.sh` (glob discovery, found-eq-0 guard, Part 8 sweep, em-dash fence) plus RED pins for the Resource boot-binding defect and the born-wired connector gap
- [x] 270-03-PLAN.md -- MEMOP-03/04/05/06: the two source tripwires (no second walker, no hardcoded canonical 8 - the latter derives its own forbidden-literal list from `SECTION_NAMES` at runtime) plus the four-class classification and live-tree RED pins
- [x] 270-04-PLAN.md -- MEMOP-07/08: RED pins for the Phase 8 cross-room fence (read-only parameterized ATTACH, both edges tables byte-identical, apostrophe-bearing room name still contributes) and pre-room identity-write reachability under an isolated HOME. **COMPLETE (2026-08-27): Task 1 committed `d4976fc5`; Task 2 (`tests/test-270-identity-write.cjs`, the full 5-leg oq2-ship-caller shape) committed `efae71ea` after plan 270-01 ratified OQ-2.**

**Wave 2**

- [x] 270-05-PLAN.md -- MEMOP-02: fix the Resource boot-binding defect. `registerResources(server, ctx)` resolving per read through `lib/mcp/session-room.cjs`, so `room://state` and `room_state_bound` finally agree. Correctness before any new Resource (Pitfall P3)

**Wave 3** *(parallel)*

- [x] 270-06-PLAN.md -- MEMOP-09/10: OQ-5 closed. `detect_dual_path`/`extract_shallow` extracted into `lib/mcp/tools/dual-path.cjs` with declared hitl_shapes; registries regenerated; the tool-schema token BASELINE measured and exported
- [x] 270-07-PLAN.md -- MEMOP-04/05/06: `lib/core/icm-forest.cjs` - `discoverIcmForest` as a COMPOSITION of the two shipped walkers, `DIRECTORY_CLASSES` imported not restated, subset rooms normal, unsentineled folders surfaced and never promoted

**Wave 4** *(parallel)*

- [x] 270-08-PLAN.md -- MEMOP-03: `mos://tree` and `mos://room/{slug}/tree` Resources plus `lib/mcp/tree-watcher.cjs` - debounced `sendResourceListChanged` over already-vendored chokidar, directories not files
- [x] 270-09-PLAN.md -- MEMOP-11/12: `context_assemble` exposes `getRoomContext` (4 legs, already written, zero MCP surface until now) with its four budget knobs as bounded parameters plus an `estimate_only` cost-before-you-pay mode

**Wave 5**

- [x] 270-10-PLAN.md -- MEMOP-07/13: the graph-native additions. `findTransitiveSupport` (recursive CTE, reusing `findBlockingAssumptions`'s in-file pattern) and `findNearestSubRoomDecisions` (structural distance ACROSS the room.db boundary, read-only, no new ATTACH)

**Wave 6**

- [x] 270-11-PLAN.md -- MEMOP-08: `identity_write`, the first writer `~/.mindrian-user.md` has ever had. Deliberately non-room-scoped, `F.1`, built on `writeUserMdAtomic` unmodified. Ships the MECHANISM half only; Phase 267.2 W2 owns the TRIGGER

**Wave 7**

- [x] 270-12-PLAN.md -- MEMOP-10/14: OQ-6 blocking human gate answered **`keep`**, so the conditional `room_state_bound` retirement did NOT happen and Assumption A2 stays unverified and carried forward (a valid, complete outcome the plan named in advance). Shipped instead: the `listRooms` duplication plan 270-07 recorded is collapsed onto `lib/core/icm-forest.cjs`'s `listRoomRoots` (wire response verified byte-identical), and the measured AFTER/DELTA token number replaces the phase's token CLAIM with a subtraction

**Measured token effect (MEMOP-10, the phase's honest number).** `tests/test-270-tool-schema-budget.cjs` exports `BASELINE` (plan 270-06, frozen), `AFTER` (plan 270-12) and a derived `DELTA`, all three produced by the SAME exported `measure()` function so the result is arithmetic rather than assertion. **The phase net-INCREASED the tool-schema budget: 36 -> 39 tools, 28,669 -> 33,509 bytes, ~7,167 -> ~8,377 approx tokens (+1,210, +16.88 percent).** The three ADDED atomic tools (`context_assemble`, `graph_reason`, `identity_write`) account for the entire increase; the two tools plan 270-06 moved into `lib/mcp/tools/dual-path.cjs` were byte-neutral, and the one contemplated retirement was kept. Recorded in the direction it actually went, per Pitfall P2, which is about not ASSUMING a win rather than about producing one. What this number CANNOT see: the read surface this phase moved onto Resources (`room://state` fixed to resolve per read, `mos://tree`, `mos://room/{slug}/tree`) does not appear in `tools/list` and so costs zero against this budget while carrying real per-turn read capability. That is a reason to measure per-turn context next, not a reason to restate +1,210 as a saving.

**Carried forward (named owners, not dropped):**

- **OQ-2 (the identity-write TRIGGER):** Phase 267.2 W2, jointly with Phase 267.3 for hook-surface declaration jurisdiction. Phase 270 shipped the caller only, and records honestly that a model-invoked MCP tool is not by itself deterministic on a first install with no MCP session.
- **OQ-3 (is MCP-tool `hitl_shape` R16-mandated):** still open as a constitutional question. `docs/HITL-SHAPE-DECLARATION-CONTRACT.md` names four R16 surface classes and MCP tools are not among them. Phase 270 declares shapes anyway (correct under either answer) and plan 270-11 records the empirical observation of whether `scripts/check-shape-declaration.cjs` actually sees an MCP tool's declaration.
- **OQ-6 (Assumption A2, foreign-host Resource support):** RESOLVED AS A DECISION, still OPEN AS A FACT. Plan 270-12's blocking gate ran and the navigator's verdict was **`keep`**, so `room_state_bound` and its connector stay. Two of the three checks passed on the current build: no prose anywhere names the tool (`grep -rn "room_state" lib/mcp/runtime-instructions.cjs commands/ skills/ agents/` returns zero hits), and in-process Resource/Tool room parity holds (`tests/test-270-resource-session-room.cjs` leg 3). The third check, exercising `room://state` from a real foreign non-Claude-Code MCP host, was NOT run because no such host was available, which `270-VALIDATION.md`'s Manual-Only Verifications table had already recorded as having no automated harness. **Assumption A2 therefore remains UNVERIFIED and is carried forward, not quietly resolved.** Whoever next proposes retiring a Tool in favour of a Resource owns running that third check first; in-process parity is evidence about ONE host, and the Tri-Polar rule makes a same-process proof insufficient for a cross-surface retirement.
- **OQ-7 (canonical section-set expansion):** SURFACED ONLY, built by neither this phase nor any plan in it. TWO distinct sub-points, deliberately kept separate because they are different failure modes: (i) five candidate MISSING sections navigator-cited against the pre-MindrianOS Notion Data Room template - Meetings, Value Proposition, Marketing and Sales, Funding Options, Research Documents; (ii) a WITHIN-SECTION structure gap - `team-execution` is correctly canonical and hyper-critical, but its `SECTION_METADATA` entry (`lib/core/room-skeleton-scaffold.cjs:53`) is thin unstructured prose against real Mentor Profiles usage carrying role, domain-expertise, availability and cross-linking fields. The 4.1a schema-driven constraint this phase enforces is exactly what makes either change cost zero operator rewrite later.
- **Three remaining boot-bound MCP call sites** plan 270-05 deliberately left alone: `registerPrompts`, `registerCapabilities`, and the `roomDir` at `bin/mindrian-mcp-server.cjs:119`. Out of scope for a phase whose question is the memory/context surface.

**Dev-Research Compositing:** the durable reasoning trail belongs at `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-memory-context-operator/`, cross-linked back to this phase directory in both directions per CLAUDE.md's mandate. **Status: WRITTEN but NOT YET LANDED, and this is the one item keeping the phase from being fully closed.** Plan 270-12 authored the trail in full (the three corrections with citations, the Theo rejection and its locality reasoning, the langtalks honesty note with the four episodes and two arxiv papers named, the measured token delta, the OQ-6 verdict, and the deliberate non-builds) but the `scripts/write-scope-check` PreToolUse guard blocked the write: the registry's active room is `launchpad-02`, not `rethinking-mindrianos`. That is the room-context bleed already on the WATCH list, not a misfiling, so the guard was NOT bypassed. Landing it takes one navigator action, `/mos:rooms switch rethinking-mindrianos`, after which the staged file copies into place unchanged. Directory created; content staged; the repo-to-room half of the cross-link is this line, the room-to-repo half is in the staged file's header.

**Grounding honesty note:** the mandatory langtalks-graph-expert consultation ran and produced NO citable claim on any of the four navigator questions (all four returned `edges: []`, the known same-day zero-edges bug). In particular the corpus has no documented verdict EITHER WAY on tool-consolidation-versus-narrow-tools. This phase cites langtalks as neither support nor warning. Every design conclusion rests on this repository's own code with file:line citations.

### Phase 271: Bare Reference-Path Resolution Audit

**Goal:** A concurrent session's full RCA (`.planning/debug/file-meeting-missing-reference-files.md`, `kind: rca`, `status: fixing`, severity High) root-caused and fixed `commands/file-meeting.md`'s specific instance: 19 citations of `references/...` as bare paths instead of `${CLAUDE_PLUGIN_ROOT}/references/...`. Bare paths resolve against session cwd, not the plugin install directory -- this works by pure coincidence in this dev repo (which happens to have its own `references/` folder at its root) and fails in every real Data Room a user actually installs into, on all three surfaces (CLI/Desktop/Cowork). The RCA's own blast-radius section names this as a repo-wide PATTERN, not fixed elsewhere: "44 of 121 commands repo-wide share this exact bare-path bug." Independently re-confirmed this session via direct grep: 45 of 113 `commands/*.md` files match the bare `references/...` pattern (count differs slightly from the RCA's own denominators, likely a skills/-mirror vs commands/ counting difference -- re-verify the exact set at plan time, do not assume either number is final). This phase's job: audit each of the ~45 matches individually (a bare `references/` mention is not automatically a bug -- confirm each is actually a load-bearing citation the model would try to resolve, not prose mentioning the word), anchor every genuine hit to `${CLAUDE_PLUGIN_ROOT}/references/...` per the file-meeting fix's own pattern, regenerate skill mirrors via `build-skill-mirrors.cjs`, and add a repo-wide lint/test so this bug class cannot silently reappear (the file-meeting RCA's own fix only covers its one file; per this repo's Part 6 dog-fooding gap pattern, a fix that isn't paired with a structural guard tends to recur elsewhere).
**Requirements**: TBD
**Depends on:** none directly -- do NOT re-fix `commands/file-meeting.md` itself (already fixed and verified by the RCA's own session, 2 files changed, mirror-check 112/112, phase-265 gate suite 4/4). Cross-references Phase 270 (Memory and Context Operator MCP) since path resolution against the plugin install dir vs. session cwd is itself a context-management primitive question that phase's design should be aware of. Also worth checking whether this bug class extends beyond `references/` citations to other bare-path patterns (`scripts/`, `agents/`, `pipelines/`) before scoping the fix as references-only.
**Plans:** 5/5 plans executed. **Phase status: CLOSED-PARTIAL on 2026-08-27, COMPLETED by Phase 267.3 on 2026-08-28.** The partial history is kept rather than deleted, because the reason it closed partial is the finding.

- **What was true on 2026-08-27 (CLOSED-PARTIAL).** Four of the five plans (271-01, 271-02, 271-04, 271-05) were COMPLETE. 271-03 was PARTIAL at 28 of 45 command files and 63 of 94 citation sites, blocked on Phase 267.3 by a pre-existing `interactive_first_reward` linter gap that has nothing to do with path anchoring. Repo-wide the phase had anchored 103 of 134 sites; 31 remained (30 in the 16 held command files, plus `commands/doctor.md:262`). The anchoring gate was deliberately left RED rather than relaxed to make the board green, and `scripts/verify-release` read 31 passed / 1 failed because of it.
- **What is true now (2026-08-28, commit `fa2f1414`).** Phase 267.3 plans 04 and 05 cleared the block the honest way: 17 human-ruled `interactive_first_reward` declarations (04) and then the commit plus the last anchor (05). 271-03 is now COMPLETE at **45 of 45 files and 94 of 94 sites**; repo-wide the phase anchored **134 of 134 sites, 0 remaining**. `node scripts/check-plugin-path-anchoring.cjs --check` reads **VIOLATIONS 0** across all four surfaces, `bash tests/run-all-271.sh` is **PASS=4 FAIL=0**, and `scripts/verify-release` reads **34 passed / 0 failed / 2 warnings (36 checks), CLEAR TO RELEASE**. No gate, hook or allowlist was edited to get there: `git diff HEAD~1 -- scripts/check-plugin-path-anchoring.cjs scripts/hooks/ scripts/verify-release` is empty and `COMMIT_NO_VERIFY` was never set.

**Phase 271 outcome (added by plan 271-05, 2026-08-27).** The ROADMAP's own scoping text asked two questions. Both are now answered with measured numbers rather than estimates.

(a) **YES, the bug class extends beyond `references/`.** The gate's `--include-scripts` advisory tier measures **34 unanchored `bash scripts/` / `node scripts/` invocation sites** over the same four surfaces (30 commands, 3 hand-authored skills, 1 agent, 0 pipelines), plus **1 deliberate exclusion**. Three of the 34 sit in `commands/file-meeting.md` (lines 771, 978, 983, all `node scripts/wikilink-file.cjs`), which is the proof that the RCA's references-only fix did NOT make even its own file fully portable. The single exclusion is `commands/status.md:13`, `- Bash(node scripts/mos-status.cjs:*)`, an `allowed-tools` frontmatter permission matcher: a matcher DECLARES a pattern and never resolves a path, so counting it would be a false positive, and the exclusion count is printed in the gate's own output rather than swallowed. This class is MEASURED and REGISTERED here, not fixed, because a `Read` citation and a `Bash` invocation fail differently and need different verification (a citation fails silently and degrades output; an invocation fails loudly, and some are dev-only by design). It is registered as **Phase 274** below, carrying the count, the file:line evidence, and the ready-made `--include-scripts` measuring instrument.

(b) **The `/mos:radar` exclusion, ruled `option-d`.** All 5 `commands/radar.md` sites are excluded via a reasoned `ALLOWLIST` entry. The human's reason, verbatim: "/mos:radar is a dev-repo-cwd operator command: line 77 WRITES this file and lines 64/73/74 read and write the git-tracked data/capability-ledger.json it renders, so anchoring would redirect writes into references/capability-radar/changelog-cache.md and data/capability-ledger.json through ${CLAUDE_PLUGIN_ROOT}, which points at the plugin install cache that gets wiped on every update - these are genuine writes to a git-tracked source of record, not read-only citations, so this is a real exception, not a defect." `option-d` is `option-a` plus honesty: the residual read-side defect at lines 51, 52, 95, 99 is registered as `FOLLOWUP-271-R1` rather than dropped, and now has a scheduled home in Phase 274 below.

**Denominator reconciliation, in one sentence.** The RCA said "44 of 121 commands" (stale denominator: 121 was the command count when it was written, and the 44 was measured while `commands/file-meeting.md` was itself still unfixed), this ROADMAP said "45 of 113" (correct for its method but incomplete, since a backtick-only grep cannot see `commands/doctor.md:262`, a bare citation after the verb "See"), and the live gate measured **46 of 113 command files carrying 99 sites**, of which 5 are the allowlisted radar sites, leaving the 45 files / 94 sites plan 271-03 actually owns; the three numbers differ for exactly two independent reasons, denominator drift and files-versus-sites counting, and mixing them is what made the count look unstable.

**Release-gate wiring (271-05).** `scripts/check-plugin-path-anchoring.cjs --check` is now gate 10c in `scripts/verify-release`, fail-closed, sitting beside the `build-skill-mirrors.cjs --check` gate so the two markdown-surface gates are read together. It was proven to fire against an A/B temp fixture (exit 1 on a bare citation, exit 0 on the same line anchored) rather than assumed. **Consequence, stated so nobody is surprised: `scripts/verify-release` is now RED and a release cut is blocked until 271-03's remainder lands.** That is the gate working, not the gate misconfigured. Wiring into `doctor.cjs --acceptance` was deliberately omitted as a higher-traffic shared file with no added proof value.

**Plan-time audit findings (re-verified by direct grep, 2026-08-27):** the live blast radius is
larger than either prior denominator. `references/` bare citations: 45 `commands/*.md` files /
98 sites (`commands/file-meeting.md` correctly absent, already fixed at `242e32db`), 5
hand-authored `skills/*/SKILL.md` / 11 sites, 6 `agents/*.md` / 15 sites, `pipelines/` 0.
Total 56 files / 124 sites. All 41 unique cited targets exist on disk, so this is purely a
resolution-mechanism fix with no dangling citations. Two findings the ROADMAP's own scoping
questions asked for: (a) YES, the class extends beyond `references/` -- 31 unanchored
`bash scripts/` / `node scripts/` invocation lines remain repo-wide, including 3 in
`commands/file-meeting.md` (lines 771, 978, 983) that the RCA's references-only fix did not
cover; this phase MEASURES and REGISTERS that class and does not fix it, because a `Read`
citation and a `Bash` invocation fail differently and need different verification. (b) Two
surfaces are unreachable by mirror regeneration and must be hand-edited: the 4 command-less
skills (`larry-personality`, `room-passive`, `ui-system`, `pws-methodology`) and
`trending-to-absurd`, which sits on `build-skill-mirrors.cjs`'s `SKIP_LIST` (line 175). One
genuine exclusion candidate: `commands/radar.md` is dev-repo-cwd by design (line 77 WRITES into
`references/capability-radar/changelog-cache.md`, and lines 64/73/74 read and write the
git-tracked `data/capability-ledger.json`), so anchoring it would redirect a write into the
update-wiped plugin install cache -- routed to a human ruling in plan 271-02. **RULED
2026-08-27: `option-d`** - all 5 `commands/radar.md` sites excluded via a reasoned
`ALLOWLIST` entry, and the residual read-side defect at lines 51/52/95/99 registered as
`FOLLOWUP-271-R1` with a named owner rather than dropped. Live post-ruling sites to
anchor: **134** (the gate measured 139, not the 124 estimated above; the difference is
traced in `271-AUDIT.md` section 1).

Plans:

**Wave 1**

- [x] 271-01-PLAN.md - the anchoring gate, its fixture test, the phase aggregator, and the RED-baseline audit register (commits `e5855e5e`, `4618f9e5`, `b935cddb`, `cef8f045`; row checked by the 271-02 pass, which the 271-01 summary explicitly handed it to after the concurrent 270-12 agent stopped mutating this file)

**Wave 2** *(blocked on Wave 1)*

- [x] 271-02-PLAN.md - the `/mos:radar` dev-repo-cwd disposition checkpoint and the reasoned allowlist (commit `4061483e`; ruled **option-d**: all 5 radar sites allowlisted with a written reason, and the residual read-side defect registered as `FOLLOWUP-271-R1` with a named owner)

**Wave 3** *(blocked on Wave 2)*

- [x] 271-03-PLAN.md - **COMPLETE: 45 of 45 files, 94 of 94 citations anchored and committed** (commits `598fdb7c`, `78e434d2`, and the unblocking commit `fa2f1414` landed by Phase 267.3 plan 05 on 2026-08-28). It closed PARTIAL at 28/45 on 2026-08-27, blocked on Phase 267.3, and the sub-bullets below are that original record, kept verbatim.
  - **CLOSED 2026-08-28 by Phase 267.3.** Phase 267.3 is the phase that ruled the declaration question this plan correctly refused to guess: plan 267.3-04 produced `267.3-CLASSIFICATION.md` (the rubric plus 17 reasoned rows), the navigator ruled every row, and the ruling minted a ninth `REWARD_TYPES` member (`live_deliverable`) rather than force `publish` into a knowingly-false token. Plan 267.3-05 then anchored `commands/doctor.md:264` (DEVIATION-271-03-A, the no-backtick site) and committed all 34 held files - 17 commands and 17 mirrors - as `fa2f1414`, through the full pre-commit hook, `COMMIT_NO_VERIFY` unset. The `mva-rule-linter` arm that refused this exact commit in 271-03 passed on its own, unmodified. Anchoring gate: **VIOLATIONS 0**. `tests/run-all-271.sh`: **PASS=4 FAIL=0**.
  - **Post-ruling correction:** the live target is **94 sites across 45 command files**, not 93/44. `commands/radar.md` is excluded by the option-d allowlist and must not be edited by the sweep.
  - **DEVIATION-271-03-A:** the plan's 44-file list misses `commands/doctor.md:262`, a bare post-"See" citation with no backticks that a backtick-anchored sed cannot reach. `271-AUDIT.md` sections 1 and 2 already named it. The live set is 45 files / 94 sites.
  - **BLOCKED, navigator ruling 2026-08-27:** the pre-commit `mva-rule-linter` (hook lines 299-313) refused 17 of the swept command files because they carry no `interactive_first_reward` declaration. Proven pre-existing: `git log --all -S` returns **zero commits ever** touching that string in those files, and this sweep's diff touches zero frontmatter lines. It surfaced only because Phase 245-02 made the linter `--staged`-scoped (a debt ratchet), and a 44-file sweep is the first commit ever to stage them. **Ruled: close at 28/45. Do NOT bypass the hook. Do NOT declare values inside a mechanical path-anchoring phase** - per `lib/core/mva-rule-linter.cjs` binding decision B5 the field is a per-command design declaration whose value cannot be read off the file, and a first-pass guess already produced one demonstrably false declaration (`publish` is `hitl_shape: F.0` interactive, so `--none (scripting only)` would have been wrong).
  - **Held in the working tree, deliberately not reverted:** 16 command files (30 sites) with anchoring applied and verified, plus their 16 regenerated mirrors, plus `commands/doctor.md` unedited. Safe there - any session trying to commit them hits the same gate. Resume cost: stage-and-commit, one `doctor.md` prefix, one `build-skill-mirrors.cjs` run.
  - The 16: `analyze-systems`, `causal`, `challenge-assumptions`, `compare-ventures`, `deck`, `diagnose`, `find-connections`, `leadership`, `lean-canvas`, `mullins`, `pipeline`, `publish`, `score-innovation`, `show`, `suggest-next`, `systems-thinking`.
  - Full trace: `271-03-SUMMARY.md` and `deferred-items.md` (DEFERRED-271-D1) in the phase directory.

**Wave 4** *(blocked on Wave 3)*

- [x] 271-04-PLAN.md - **COMPLETE: 40 of 40 citations anchored across 17 files** (commits `cca1791b`, `5f4a6845`, `9d2b5e43`, `054cff88`). All three of its surfaces read `violations=0`.
  - **Landed, by surface:** 14 sites / 11 lines / 5 hand-authored skills (long fail-closed wrapper), 17 sites / 16 lines / 7 agents (short form), 9 sites / 9 lines / 5 pipeline stage files (short form). 36 changed line-pairs, added == removed on every file, pairwise purity 0 impure, 0 MISSING-TARGET.
  - **The plan's own 26-citation target was stale and was NOT used.** The live count was re-measured with the gate before any edit and came back 40, matching the post-ruling correction already recorded in this row. Three causes, all traced in `271-AUDIT.md` section 1: skills 11 -> 14 and agents 15 -> 17 are per-LINE vs per-SITE counting (three skill lines and one agent line carry 2 or 3 tokens each, plus `agents/larry-extended.md:121`, a bare post-"see" citation a backtick-only grep cannot see); pipelines 0 -> 9 because the plan-time glob was flat `pipelines/*.md`, which matches zero files.
  - **Task 1 outcome, the plan's named risk (T-271-10): CONFIRMED expands.** `${CLAUDE_PLUGIN_ROOT}` does work in `agents/*.md`. Source: Anthropic's own `plugin-dev` plugin, skill `plugin-structure`, `SKILL.md:291-294`, "Path Resolution Rules", which names "component files (commands, agents, skills)" explicitly. Corroborated by two shipped Anthropic agents already using it in agent markdown (`claude-security/agents/claude-security.md:13,21` and `plugin-dev/agents/plugin-validator.md:114,122`). One counter-signal recorded and answered. **Named blind spot:** the plan's first-choice sources (`claude-code-guide` agent, `claude-api` skill) were NOT reachable from the executor's tool surface, and no source states a negative, so the finding is grounding rather than proof by absence. Full record in `271-AUDIT.md` section 6.
  - **Added by 271-04:** a ruled anchor form for `pipelines/`, a surface no plan in this phase scoped. SHORT form, because `pipelines/` is not a Claude Code component type (stage files are read at RUNTIME by `commands/pipeline.md:120`, so neither form is expanded by Claude Code and no shell evaluates the long form's `:?` clause), and pipelines are never loaded by a foreign Agent-Skills host, which is the only reason skills carry the long wrapper.
  - **NOT blocked by the 271-03 blocker (verified live, not assumed).** The `mva-rule-linter` arm fires on `^commands/.+\.md$` only (hook line 300); 271-04's surface is zero command files. All four commits went in through the full pre-commit hook with no bypass. `skills/trending-to-absurd/SKILL.md` stayed divergent, so `checkSkipList()` still passes.
  - **The gate did NOT turn green, exactly as this row predicted.** Working tree reads **1** violation (`commands/doctor.md:262`), at HEAD **31** (30 held command sites + `doctor.md`). **Zero of that residue is 271-04's** - it is entirely 271-03's blocked work, verified untouched (`git diff --numstat -- commands/` still reads 16 files / 30 lines). `bash tests/run-all-271.sh` is PASS=3 FAIL=1, the one failure being that same anchoring arm. No gate was relaxed to improve the number (T-271-12 held).
  - **New deferred item: DEFERRED-271-D2.** `agents/larry-extended.md` declares `hitl_shape: F.1` AND `connector.excluded: true` simultaneously (Canon Part 11 contradiction). Pre-existing - 271-04's diff on that file is one body prose line, zero frontmatter. 1 of 53 advisory violations repo-wide, the other 52 in untouched `skills/*/SKILL.md`. Advisory only (WARN, exits 0). Natural home is the same declaration-backfill jurisdiction question already raised for Phase 267.3.
  - Full trace: `271-04-SUMMARY.md`, `271-AUDIT.md` section 6, and `deferred-items.md` in the phase directory.

**Wave 5** *(blocked on Wave 4)*

- [x] 271-05-PLAN.md - **COMPLETE: release-gate wiring, CHANGELOG, knowledge-base, compositing trail, and both follow-up registrations** (commits `1e104f0c`, `72972d2f`).
  - **Gate 10c is live in `scripts/verify-release`, fail-closed,** proven against an A/B temp fixture rather than assumed. It was wired already fail-closed, so no promotion step was ever owed: 267.3-05 only had to make the underlying condition true. **Re-measured 2026-08-28 after commit `fa2f1414`: `verify-release` reads 34 passed / 0 failed / 2 warnings over 36 checks, CLEAR TO RELEASE, and gate 10c prints "Every plugin-relative references/ citation is anchored (check-plugin-path-anchoring --check)".** (It read 31 passed / 1 failed on 2026-08-27, and a release cut was blocked until 271-03's remainder landed; the check total moved 32 to 36 because 267.3-03 and other phases added gates in between, so the two totals are not directly comparable and the stale 31/1 is not carried forward.) The two residual warnings are pre-existing and unrelated: 38 command render-quality warnings (over-long descriptions) and a missing CHANGELOG entry for the next version. The gate was NOT relaxed to make the board green (T-271-12 held for the second wave running, and again at closure).
  - **DEVIATION-271-05-A:** the plan's acceptance criterion 3 required a PASS line naming the anchoring gate. Unmeetable by construction, because the plan was written assuming waves 3 and 4 would both drive the tree to zero and wave 3 closed partial. The gate correctly FAILS on `commands/doctor.md:262` in the working tree (31 sites at HEAD). Recorded rather than papered over; the alternative was to make the gate advisory, which is the exact failure this phase exists to prevent.
  - **`doctor.cjs --acceptance` wiring deliberately omitted,** per the plan: it is a higher-traffic shared file and the release gate alone satisfies the RCA's named requirement.
  - **Bare-`scripts/` class registered as Phase 274** with its measured 34 sites, its 1 reasoned exclusion, its file:line evidence, and the `--include-scripts` instrument. **`FOLLOWUP-271-R1` given its scheduled home there too**, so the option-d exception's owed work is no longer code-only.
  - Room mirror: `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-bare-plugin-path-resolution/`, mirrored to `~/MindrianOS/research/`, cross-linked both directions and both links verified to resolve.
  - **Added by the 271-02 ruling:** must ALSO register `FOLLOWUP-271-R1` (split `/mos:radar` into a dev-only `--fetch` write path and a user-safe anchored read path). Owner: repo navigator. It is the residual read-side defect the option-d allowlist knowingly defers at `commands/radar.md` lines 51, 52, 95, 99. It already lives in code (`REGISTERED_FOLLOWUPS` in `scripts/check-plugin-path-anchoring.cjs`, referentially enforced) and in `271-AUDIT.md` section 4; 271-05 gives it a scheduled home here.

### Phase 276: Same-Disease Consolidation -- MCP + Local-Graph False-Success Deep Fixes (was: "MCP Tool Honesty - Triage and Close")

**Goal:** Navigator directive 2026-09-03: consolidate every currently-known instance of the "claims success/behavior it doesn't actually deliver" disease into ONE phase that fixes all of it, rather than leaving instances scattered across a closed phase's unfinished Criticals and separate follow-ups. This is the exact pattern this repo's own standing WATCH item names (`feedback_false_success_silent_skip_gates_academy_testers.md`, personal memory, OPEN since 2026-07-14) -- and Phase 273's own text already cross-referenced it verbatim: "C1 and C5 are both textbook instances of that exact class." Originally scoped narrower (MCP-tool-description triage only); broadened before planning began, so the narrower scope below is folded in, not replaced.

Two layers of the same disease, five concrete pieces:

**Layer 1 -- MCP tool-description vs. actual behavior (original scope):**

1. **[RECONCILED 2026-09-04, plan 276-16]** Triage and close every finding from `scripts/check-tool-honesty.cjs`'s live sweep. The measured sequence (superseding the original "9 findings" estimate, an arithmetic slip): **10** findings at the first live sweep (36 tools / 130 branches, quick 260903-ljj: 1 HIGH RISK -- `orchestration.scout` -- claims "ordinary reads and writes", falls through to a read-only reference echo -- 8 MEDIUM, 1 UNKNOWN); **24** after the D-1 detector fix (the dead `switch (command)` branch splitter, 5 HIGH RISK / 18 MEDIUM / 1 UNKNOWN, discovery totals unchanged at 36/130); and a final post-fix scan of **0 HIGH RISK, 12 MEDIUM, 0 LOW, 0 UNKNOWN, 119 OK** across 37 tools / 131 branches (`276-15-SUMMARY.md`), every non-OK row carrying a written disposition in `tests/fixtures/tool-honesty/276-dispositions.json`. For each finding: fix the real bug (the honesty-fix pattern already proven on `meeting`, commits `3a35f4f6`/`2f1f4cf3`/`86c2e1e1`), fix the detector if it's a false positive (never suppress via `ALLOWED_UNVERIFIED` without root-causing why), or correct the description if it's a genuine scaffolding-tool-by-design case.
2. Resolve the still-open real defect in `.planning/debug/meeting-file-meeting-false-success.md` (status `partial-close`): the Tri-Polar gap where Desktop/Cowork never reach Phase 150.8's real, verified DIKW meeting-filing pipeline (Claimify 4-pass extraction, typed claim writes, human-confirmation gate). Scope and plan the fix in this phase, or hand it to its own phase with a stated reason.
3. Decide whether to extend `check-tool-honesty.cjs` for the `extract_shallow`-class limitation (an argument-gated write invisible to its static description-vs-code scan, per `lib/mcp/tools/dual-path.cjs`) or accept it as a documented detector boundary. Note the checker's own declared scope (`scripts/check-tool-honesty.cjs` header comment) is `lib/mcp/tool-router.cjs` + `lib/mcp/tools/*.cjs` + `lib/mcp/contract-version.cjs` only -- it does NOT reach the substrate layer, which is exactly why pieces 4-5 below are a second, separate finding source, not something a wider checker run would have caught.

**Layer 2 -- local-graph substrate claims a status it doesn't have (pulled in from Phase 273, re-verified live 2026-09-03, confirmed still broken):**

4. **C4** -- the Node >=22.16.0 busy-timeout fix is applied at 1 of 35 `DatabaseSync` openers repo-wide (re-measured live: `grep -rln "new DatabaseSync(" lib/ scripts/` = 35 files; only `lib/core/room-db.cjs:259-260` passes `{timeout: 5000}`). `lib/core/lazygraph-ops.cjs:434` (the most-used opener, ~38 call sites) and `lib/core/cross-room-store.cjs:68`'s `withStore` wrapper are still unprotected. Phase 273 closed 2026-08-31 without landing this fix -- confirmed via `git log --since=2026-08-31 -- lib/core/lazygraph-ops.cjs lib/core/cross-room-store.cjs`, zero commits touching either file since close.
5. **C5** -- `lib/core/navigation/spine-events.cjs`'s `_emit` (lines 133-141, 214-222) still unconditionally reports `{ok:false, reason:'no_room_db'}` from its catch block despite the function proving the file exists via `fs.statSync` first, so a momentarily-locked or corrupt `room.db` still misreports as "no database" to the F-selector. Same live-grep/git-log confirmation as C4: untouched since Phase 273 closed.

Both C4 and C5 are the exact "propagation gap" Phase 273's own reviewer named as its real thesis ("several of the good fixes here were applied at exactly one site and never carried to their siblings... closing that propagation gap, rather than writing new code, is most of the work") -- and they are the SAME disease as pieces 1-3, one layer down: a write/read path silently reports success, or a wrong-but-plausible status, instead of the true state.

**Named related but explicitly OUT of this phase's scope (so nothing is silently dropped):**

- Phase 273's remaining 10 Major issues (M1-M3, M5-M7, M9-M12) -- design/maintainability tier, not the "claims success falsely" tier; candidate for a follow-up phase if the navigator wants them, not folded in here. **M8** (`RoomDbBusyError`'s documented retry contract has zero implementations) is the one Major worth a second look at plan time -- arguably the same disease (a documented contract nothing honors) and cheap to fold in if plan capacity allows; the planner should make an explicit in/out call on M8 rather than silently ignoring it.
- The standing `STATE.md` resync-clobber bug (20+ documented occurrences across this session and every prior handoff that touched it) -- same disease shape (a state-write tool call reports success, the write silently reverts moments later), but the code that produces it (`gsd-tools.cjs` / the state-sync path) lives in the separate `@opengsd/gsd-core` package under `$HOME/.claude/gsd-core/`, not this repo. Out of repo scope by the same logic Theo's tools are out of repo scope below -- name it, do not build a fix for it here, and consider it its own dedicated `/gsd-debug` session against gsd-core per the standing recommendation in every prior handoff that hit it.
- `FOLLOWUP-271-R1`/`FOLLOWUP-271-R2`/`FOLLOWUP-274-R1`/`FOLLOWUP-274-R2` (the `/mos:radar` read/write path split, the `status.md` matcher drift, the anchoring-fallback convention question) -- a different disease (bare-path cwd resolution, not claims-vs-behavior), already has named owners and homes in Phase 271/274's own `REGISTERED_FOLLOWUPS` mechanism. Not pulled in.
- Theo's own ~27 tools deserve the identical `check-tool-honesty.cjs`-style audit before its production launch as a standalone MCP service -- Theo's own repo's work, named here as an out-of-repo recommendation, not built in this phase.

Critical priority per navigator instruction, timed against Theo's approaching production deployment as a separate MCP service.

**Theo forward-compatibility (navigator ruling 2026-09-02, standing rule -- CLAUDE.md; re-measured live against `/home/jsagi/Theo` on 2026-09-03 for this entry):**

- **Where the flip actually stands.** Theo Phase 08.4 (remote hosting) CLOSED 7/7 on 2026-09-02, so the "no hosting story" blocker in the 2026-09-01 handoff is gone. Theo Phase 9 (Brain-Contract Cutover) is 11 of 12 plans done; the one open plan, `09-12`, IS the flip: one `MINDRIAN_BRAIN_URL` default change at `lib/core/brain-client.cjs:24` shipped in a MindrianOS-Plugin release (Theo D-03, all-or-nothing), then soak, then `pws-brain-mcp` decommission. That release is THIS repo's work. But Theo's own `09-MOS-LEARNING.md` `## Addendum 2026-09-02` rules the flip **NOT READY** on content grounds (Theo holds 57.8% of the Brain's named Frameworks, 2.4% of nodes, 5.1% of relationships, and has no standing mechanism to keep coverage current), so "upcoming" means structurally one plan away and content-gated, not scheduled. Plan against the CURRENT Brain; design so the flip is a smaller diff.
- **What the flip does and does not touch in this phase's scope.** Theo absorbs exactly 5 operational tools (`room_bind`, `graph_write`, `gate_render`, `gate_answer`, `chain_run`; Theo Phase 5, 9/9 plans, `src/mcp/operational/`). Per Theo's own `05-MOS-LEARNING.md`: "Only five of roughly thirty-four operational tools moved. The other twenty-nine stay served by `mindrian-os`, and both servers run side by side." So the `check-tool-honesty.cjs` findings (Layer 1) and the substrate fixes C4/C5 (Layer 2) land on code that STAYS in this repo after the flip -- they are not made moot by it. Both servers co-existing also means two callable `room_bind`s under different prefixes (`mcp__plugin_mos_mindrian-os__*` vs `mcp__theo__*`/`mcp__plugin_mos_theo__*`), which Theo flags as "the first thing to decide when a host config exists" -- not this phase's decision, but the planner must not assume a single server.
- **Description fixes do NOT auto-propagate to Theo.** Theo's five absorbed tools delegate to the plugin's handlers at call time (`src/mcp/operational/delegate.ts`, "the ONE place a MindrianOS-Plugin tool payload becomes an MCP CallToolResult"), so a BEHAVIOR fix in this repo flows through -- but each carries its OWN description constant on Theo's side (`ROOM_BIND_DESCRIPTION`, `GRAPH_WRITE_DESCRIPTION`, `GATE_RENDER_DESCRIPTION`, `GATE_ANSWER_DESCRIPTION`, `CHAIN_RUN_DESCRIPTION` in `src/mcp/operational/*.ts`). **Required at plan time:** cross-check the live checker output against those five names; any finding on one of them gets a named Theo-side mirror task (coordinated, not executed from this repo, per Theo's D-04 discipline), otherwise the plugin's fix leaves Theo's catalog carrying the old wrong text.
- **Theo already tracks this exact disease, under its own name, and has a partial detector.** `delegate.ts` names "a FALSE FAILURE, the mirror image of the false-success class this project tracks" (measured live three times: `room_bind` reported a malformed payload for a bind that had ALREADY TAKEN EFFECT). Theo's guard is its chokepoint-audit rule set (rule 5 greps the SDK error-flag literal; rule 15 covers the throw path) -- and rule 5 itself once "reported green over a live violation of the invariant it exists to protect" (Theo `05-REVIEW CR-01`). That is a regex-over-error-shape audit, not a description-vs-behavior scan; Theo has zero mention of `check-tool-honesty` anywhere. Theo's real tool count is **28** (23 `registerContentTool` + 5 `registerOperationalTool`), not "~27". The out-of-repo recommendation therefore has a concrete shape: port the `check-tool-honesty.cjs` methodology to Theo as a SEED in Theo's own `.planning/seeds/` (via that repo's `/gsd-capture`, navigator-approved), citing this phase, before `09-12` authorizes the flip. Not built here.
- **Flip-day same-disease items that live in the plugin but OUTSIDE the checker's scan (`lib/mcp/` only) -- the planner must make an explicit in/out call on each, not skip them silently:** (a) Theo's `09-MOS-LEARNING.md` states "`mode_signals` no longer arrives... The tool description text that promises it is now wrong" -- a description-vs-behavior mismatch in the plugin's Brain shim (`bin/mindrian-brain-mcp-client.cjs` DirectiveEnvelope wrapper) that becomes live at flip; (b) "Incumbent-schema Cypher returns honest empties, not crashes" (`enrichCausalEdges`, `hatAwareRecommend`, `suggestValidationSteps` match zero rows against Theo's labels) -- honest at the tool boundary, but any caller that renders an empty as "no findings" turns it into the false-negative flavor of this disease; (c) `05-MOS-LEARNING.md`: `graph_write`'s stale-version check "fails open on a missing node, deliberately... Do not read a pass here as proof the node existed" -- a documented false-pass on the plugin's own reasoning, worth a one-line honesty note in the tool description at minimum. Already CLOSED and not to be re-fixed: `brain-client.cjs`'s silent-empty `brain_query` return for Theo's `{rows, diagnostics}` shape (`719f4499`/`21fdd7bc`, then made loud for any unrecognized shape in `f264c843`/`8aca8af7`).
- **Adjacent, owned elsewhere, named so it is not mistaken for this phase's gap:** `BRAIN_TOOL_MATCHER` (`lib/core/brain-response-sanitize.cjs:61`) matches only `mindrian-brain|pws-brain-mcp` -- after the flip the Part 8 response-sanitize hook would silently NOT fire on `mcp__theo__*`. That is a silently-skipped gate (the other half of the standing WATCH item) but it sits on Theo's named 7-file plugin adaptation list (`BRAIN_TOOL_MATCHER`/`hooks/hooks.json`, plus `scripts/probe-brain-contract.cjs`, `lib/brain/chain-recommender.cjs`, `lib/core/enrichment-queue.cjs`, `bin/mindrian-brain-mcp-client.cjs`, `lib/core/resolve-brain-key.cjs`, `data/brain-surface-contract.json`; 6 of 7 still untouched), which is the flip-adaptation work of Phase 267/269, not this phase. No reply was ever found to the 2026-09-01 question of whether to start that adaptation now or hold for 08.4 -- with 08.4 now closed, that question is live again and belongs to the navigator.

**Research correction (276-RESEARCH.md, committed `52985ea5`, 2026-09-03) -- read before trusting the counts above:** the live sweep at HEAD is **10** findings (1 HIGH / 8 MEDIUM / 1 UNKNOWN), not 9 -- the "9" was an arithmetic slip. More importantly, **the checker's `switch (command)` branch splitter is dead code and has never split a single branch**: `splitBranches` runs `/\bcase\s+/` over the masked text where string literals are blanked to spaces, so `\s+` swallows the case value and every label is rejected (`scripts/check-tool-honesty.cjs:529, :538-541`). `room_state` (5 branches), `room_content` (15), `room_graph` (13) were all graded against their whole handler body. A one-line fix takes the sweep from 10 to **24** (5 HIGH / 18 MEDIUM / 1 UNKNOWN), including 4 hand-verified new HIGH RISK defects in `room_content` (description at `tool-router.cjs:738` calls it "the WRITE surface (new-project, setup, file-opportunity, create-funding, invoke-persona)"; `:756-773` is a four-label read-only reference echo, and `personaOps.invokePersona` at `lib/core/persona-ops.cjs:550-571` is read-only). `orchestration.scout` CONFIRMED (`tool-router.cjs:1623-1655`): the claim is true of the CLI `/mos:scout` and false of the MCP handler -- the third instance of one disease after `rooms-open` and `file-meeting`. **Sequencing rule for the planner: fix the detector first (RED test against the pre-fix splitter, per the `209b604f`/`75278850` precedent), re-run, then triage the 24. Any plan whose first task edits a description string is closing the wrong list.** Also: local `main` is 5 commits ahead of `origin/main`, 0 behind, and the 4 commits that BUILT the checker are among them -- a session pulling origin today has no `scripts/check-tool-honesty.cjs`.

**Locked decisions (navigator, 2026-09-03, so the planner does not re-open them):**

- **D-276-1 (navigator ruled via card):** the meeting-filing Tri-Polar gap STAYS in this phase. Its fix is blocked on an unruled vocabulary decision (the DIKW rungs in `lib/conversation/operator.cjs` `EPISTEMIC_LEVELS` vs `ALLOWED_EPISTEMIC_TYPES`'s 10 members at `lib/core/node-insert.cjs:113` vs `knowledge_type` -- CLAUDE.md already names the first two as "STILL two unbridged vocabularies") plus a new MCP `writeClaimNode` primitive and `gate_render`/`gate_answer` wiring. So: **wave 1 is a navigator decision plan on the vocabulary mapping** (Phase 270-01 precedent, writes a `276-DECISIONS.md`, no code), and the pipeline build is a LATER wave gated on that ruling, structurally unable to block the Layer-1 / Layer-2 fix waves. Splitting it out was rejected because splitting is exactly how C4/C5 got orphaned.
- **D-276-2:** "close all findings" means every one of the 24 gets a written disposition (real fix / detector fix / description correction), each verified by re-running the checker, never by assertion. MEDIUM and UNKNOWN cannot be suppressed today (`check-tool-honesty.cjs:1162` gates `ALLOWED_UNVERIFIED` on HIGH_RISK only) and this phase adds NO new suppression path; a proven false positive is a detector fix, not an allowlist entry.
- **D-276-4 (second research pass, `e38e056a`):** C4's fix shape is **option-only** at `lib/core/lazygraph-ops.cjs:434` and the other Group-A room.db write openers -- NOT routing them through `openRoomDb`. The researcher's opener recommendation (A9) was overruled: `openRoomDb` is async, returns `{db, conn}` against 38 call sites, and runs the 7-step migration chain on every open, which is the same ~40-file regression shape Phase 273 D-01a already rejected for the `ok` flip. Routing `lazygraph-ops` through `openRoomDb` (which would also close M12 and C2's residue) is registered as a NAMED follow-up of this phase, not silently dropped. Group C/D read-only and `:memory:` openers are explicitly EXCLUDED with the reason stated (`room-db.cjs:251`, WAL readers never block writers). Phase 273's own `273-CONTEXT.md` D-02 registered C4/C5 "as a fast-follow phase, not silently dropped" -- **this phase IS that fast-follow**, and its plans say so; D-05 also hands this phase the `SUBSTRATE-BASELINE.md` reconciliation (it currently states 195, 208 and 205 in three places).
- **D-276-5:** the C5 task carries `getCurrentJTBD`/`getCurrentOperator` (the F-selector path the researcher flagged as A11, unread) as mandatory `read_first`, and its fix is the return-shape variant (`room_db_busy` / `room_db_broken` reasons, `err.name` checked before `instanceof` per `room-db.cjs:158-166`) since `spine-events` cannot re-throw. M8 is IN as its smallest piece: correct the `room-db.cjs:150-153` comment, because `timeout: 5000` already is the retry.
- **D-276-6 (Theo):** of the 24, only `gate_render` lands on a Theo-absorbed tool, but `gate_answer` (1462 vs 1152 bytes) and `chain_run` (1113 vs 1006) descriptions have ALREADY diverged from Theo's constants at Theo `83a1ce2` -- Theo's `gate_answer` predates the `SOURCED_FROM`/`USES_FRAMEWORK` clause from `2c8dfddf`. The five-constant byte-diff is a skip-when-absent, non-blocking signal in this phase's validation, and the Theo-side SEED recommends a TS-AST port of the methodology (a direct run of the current checker against Theo scans zero tools and reports OK).
- **D-276-3:** an in-memory gate-ledger mint is not persistence. `gate_render`'s disposition is a description correction ("mints an in-memory gate id, persists nothing"), not adding `minted` to `STRONG_VERBS` to flip it HIGH RISK. Because `gate_render` is one of Theo's 5 absorbed tools, this correction gets a Theo-side mirror task.

**Requirements**: TOOLHON-01, TOOLHON-02, TOOLHON-03, TOOLHON-04, TOOLHON-05, TOOLHON-06, TOOLHON-07, TOOLHON-08, TOOLHON-09, TOOLHON-10, TOOLHON-11, TOOLHON-12, TOOLHON-13, TOOLHON-14 (minted in `276-RESEARCH.md`'s requirement table, distributed across the 16 plans below, registered in `.planning/REQUIREMENTS.md` at phase close by plan 276-16, per the Phase 272 `PYPORT-` / Phase 273 `CHOKE-` / Phase 274 `ANCHOR-` precedent)
**Depends on:** none technically. The ROADMAP previously read "Depends on: Phase 275" -- verified 2026-09-03 to be spurious: Phase 275 (room-schema-by-ICM-layer) has no substantive link to MCP/substrate false-success fixes, is itself gated and not yet plannable (blocked on Phase 270's OQ-7), and this line matches the known `gsd-tools.cjs query phase.add` heading-boilerplate pattern already caught once for this same phase entry, not a real dependency (same disclosure pattern as Phase 272's "sequenced after Phase 271 only because registered the same session, not a real dependency"). Corrected here rather than left to silently block planning.
**Plans:** 15/16 plans executed

Plans:

**Wave 0** *(test infrastructure; RED by design, parallel, zero files_modified overlap)*

- [x] 276-01-PLAN.md - `tests/run-all-276.sh` (glob discovery, found-eq-0 guard provable via `TEST_276_PREFIX`, Part 8 sweep, no-em-dash fence), the synthetic `switch (command)` fixture, and the RED proof that `splitBranches` is dead code (TOOLHON-01, TOOLHON-05)
- [x] 276-02-PLAN.md - the two Layer 2 held-lock tests, both REUSING the shipped `tests/helpers/room-db-lock-holder-236.cjs` rather than authoring a second lock helper. C4 asserts an elapsed-time floor, not a return value; C5 pins `room_db_busy` / `room_db_broken` and resolves RESEARCH A11 by reading the two getters' catch bodies (TOOLHON-09, TOOLHON-10, TOOLHON-11)
- [x] 276-03-PLAN.md - the two Layer 1 description pins, measured over the wire: `orchestration.scout` (F-1) and `room_content` (F-11..F-14), both forbidding the false claim BY LITERAL and requiring a SUBSET of the two shipped disclosure markers (TOOLHON-03, TOOLHON-04)
- [x] 276-04-PLAN.md - the two-directional ledger diff, the `ALLOWED_UNVERIFIED` contract made structural, and the skip-when-absent non-blocking Theo parity signal pinned to Theo `83a1ce2` (TOOLHON-02, TOOLHON-06, TOOLHON-12)

**Wave 1** *(blocked on Wave 0)*

- [x] 276-05-PLAN.md - **the navigator decision plan (D-276-1), `autonomous: false`, writes `276-DECISIONS.md` only, no code.** OQ-276-1 rules the three-vocabulary collision (`EPISTEMIC_LEVELS` vs `ALLOWED_EPISTEMIC_TYPES` vs `KNOWLEDGE_TYPES`); OQ-276-2 rules the claim-write surface shape and the gate placement. Restates D-276-1..D-276-6 as dispositions of record (TOOLHON-07)
- [x] 276-06-PLAN.md - **the D-1 GREEN fix in a commit separate from 276-01's RED commit** (`209b604f`/`75278850` precedent), the false verification claim inside the honesty checker corrected, the B-1..B-6 boundary enumeration (B-6 newly minted), and the disposition ledger frozen against the post-fix sweep (TOOLHON-01, TOOLHON-05, TOOLHON-06, TOOLHON-02)

**Wave 2** *(blocked on Wave 1; four plans, disjoint file trees)*

- [x] 276-07-PLAN.md - detector triage: the command-name-in-enumeration guard (F-2..F-8), the negation-window fix and the one-level barrel re-export hop with `resolveRepoLocalPath` containment proven by a negative case (F-10 A and B), the `includes()` dispatch half of B-4, and the WEAK-tier sibling-writes ruling recorded at the decision site (TOOLHON-02, TOOLHON-05)
- [x] 276-08-PLAN.md - the `lib/mcp/tool-router.cjs` description fixes: `orchestration.scout`, `export` and `room_content`, plus the revised NOT-EXECUTED membership rule ("does the description claim it", not "does it mutate and lack a branch") and every false completion assertion removed (TOOLHON-03, TOOLHON-04)
- [x] 276-09-PLAN.md - C4 option-only propagation per D-276-4 at Group A and Group B, with Groups C and D excluded quoting `room-db.cjs:251`, the census re-measured at execution time, and the `openRoomDb` re-route registered as a named follow-up at the code site (TOOLHON-09)
- [x] 276-10-PLAN.md - C5 return-shape variant at BOTH `_emit` sites through one shared helper, `err.name` before `instanceof`, the F-selector getters resolved by measurement, the run-time `no_room_db` census, and M8's comment correction proven comments-only (TOOLHON-10, TOOLHON-11, TOOLHON-14)

**Wave 3** *(blocked on Wave 2)*

- [x] 276-11-PLAN.md - `gate_render`'s in-memory-mint disclosure per D-276-3 (no `STRONG_VERBS` widening), `graph_write`'s CAS fail-open disclosure on the `read_version` describe (boundary B-6 territory), and the Brain shim's DirectiveEnvelope correction. The honest-empty trio stays OUT of the code-fix scope as a re-measured recorded finding (TOOLHON-13, TOOLHON-02)
- [x] 276-12-PLAN.md - the claim-write MCP primitive, RED then GREEN, routed through `lib/core/node-insert.cjs` with `writePathRefusal`, its success shape constructed FROM the write's own result, born wired with a shape chosen from the contract, and honest on the checker's first sweep (TOOLHON-07)

**Wave 4** *(blocked on Wave 3)*

- [x] 276-13-PLAN.md - the Theo parity run with the commit re-pinned at execution time, every divergence classified as caused-by-this-phase or pre-existing, and the coordinated SEED recommending a TS-AST port with the zero-tools-scanned false-success warning up front (TOOLHON-12, TOOLHON-13)
- [x] 276-14-PLAN.md - the meeting filing path wired through `gate_render` / `gate_answer`, confirmation verified against `room.db` rather than a response, the per-branch `**filed: false**` decision stated, and `references/meeting/filing-protocol.md`'s gap enumeration corrected to match the code (TOOLHON-07)

**Wave 5** *(blocked on Wave 4)*

- [x] 276-15-PLAN.md - `SUBSTRATE-BASELINE.md` regenerated by its own script resolving the 195/208/205 drift (Phase 273 D-05's deferral, now due), the ledger re-frozen against the post-fix scan surface, and the full gate set reported as a DELTA with the advisory posture confirmed unchanged (TOOLHON-14, TOOLHON-02)

**Wave 6** *(blocked on Wave 5)*

- [ ] 276-16-PLAN.md - phase close, `autonomous: false`: register TOOLHON-01..14 with measured evidence, reconcile the ROADMAP count and plan list, CHANGELOG, seven-plus named follow-ups each with an owner, the meeting-RCA disposition, the dev-research compositing trail in both homes, and a **blocking human verification of Desktop or Cowork meeting filing against `room.db`** (TOOLHON-07, TOOLHON-08, TOOLHON-02)

**Carried forward (named owners).** Phase 273's C4/C5 were deferred and nearly orphaned once
already; this phase's own deferrals get a home here instead, following the Phase 267.3
"SCOPE, explicit" and Phase 271 `REGISTERED_FOLLOWUPS` shape:

- **Route `lazygraph-ops.openGraph` through `openRoomDb`** (D-276-4's named follow-up, would
  also close Phase 273's M12 and C2's residue). Deferred because `openRoomDb` is synchronous
  and returns a bare handle while `openGraph` is async and returns `{db, conn}` across
  roughly 50 call sites (re-measured live by `276-09`, up from the plan's own ~38 estimate),
  and because it runs a 7-step migration chain on every open -- the same ~40-file regression
  shape Phase 273 D-01a already rejected. Owner: repo navigator.

- **The Theo-side TS-AST checker port**, filed as
  `docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md` by plan `276-13`, to be captured as
  a SEED in Theo's own `.planning/seeds/` via that repo's `/gsd-capture`, before Theo plan
  `09-12` authorizes the flip. Owner: whoever works the Theo repo. Never executed from here
  (Theo D-04).

- **The `gate_render` Theo mirror task** (the one description this phase changed on a
  Theo-absorbed tool: adopt the plugin's corrected sentence at
  `src/mcp/operational/gate-render.ts:89-93`, quoted verbatim in the SEED document above),
  plus the `gate_answer` pre-existing divergence (offset 585, plugin 1462 / theo 1152 bytes,
  independently confirmed pre-existing by a zero-count grep against Theo's own source,
  reported but not registered as a second mirror task by `276-13`). Owner: whoever works the
  Theo repo.

- **The `STATE.md` resync-clobber bug** as a dedicated `/gsd-debug` session against
  `@opengsd/gsd-core` under `$HOME/.claude/gsd-core/`, not this repo. Sixty-plus documented
  occurrences across this session and every prior handoff that touched it (up from the
  20+ this ROADMAP entry originally cited). Out of repo scope by the same logic Theo's tools
  are out of repo scope. Owner: repo navigator.

- **The operator-cap comparison against the DIKW rungs** (`epistemic_type` vs.
  `lib/conversation/operator.cjs:133` `EPISTEMIC_LEVELS` / `:138` `OPERATOR_EPISTEMIC_CAP`),
  OQ-276-1(d): ratified as scoped OUT of this phase by the navigator (`276-DECISIONS.md`
  OQ-276-1), the knowledge_type -> epistemic_type mapping direction only was built (`276-12`).
  This close-out's own human verification (Task 3 below) is where the navigator can confirm
  the proposed mapping table's row content, which is executor-proposed and not yet
  navigator-ratified. Owner: repo navigator.

- **The two sibling `no_room_db` sites**: `lib/core/breakthrough/scanner.cjs:124` and
  `lib/core/navigation/lens-nodes.cjs:254` (whose own header comment literally says "mirrors
  spine-events"), discovered by `276-02`'s run-time census and re-confirmed present by
  `276-10`'s own Group E run, sharing the identical catch-and-mislabel shape
  `lib/core/navigation/spine-events.cjs` had before this phase's own C5 fix. Owner: repo
  navigator.

- **The `NOT EXECUTED.` literal detector gap**: `classifyBranch`'s `hasBanner` check
  (`scripts/check-tool-honesty.cjs`) recognizes `noWriteBanner()`/`**filed: false**` but has
  no equivalent recognition of the `NOT EXECUTED.` banner literal, so every command wired
  into `UNIMPLEMENTED_MUTATING_ORCHESTRATION` relies entirely on a claim-free description to
  read OK; the banner itself earns no detector credit. Found by `276-08`. Owner: whoever next
  touches `scripts/check-tool-honesty.cjs`.

- **The honest-empty trio at flip time**: `enrichCausalEdges` (zero production callers today,
  two prose-only references), `hatAwareRecommend` (one caller, pipes raw JSON, no rendering
  layer) and `suggestValidationSteps` (one caller, returns an explicit
  `{enriched:false,steps:0}` on empty) all return honest empties against Theo's labels today,
  but the first future caller inherits an un-audited empty-versus-absent contract at exactly
  the moment the Theo flip makes empties the common case. Re-measured and confirmed unchanged
  from `276-RESEARCH.md`'s original characterization by `276-11`. Owner: repo navigator / the
  first future caller.

- **The `~/.mindrian/card-fire-reached.json` debris entry** `claim:test-session-276-12:3d693cca`,
  left by `276-12`'s pre-hermetic test run before that plan's own Deviation 2 fix pinned
  `MINDRIAN_ROOMS_HOME` to a scratch directory. User-state debris, named here for cleanup per
  this plan's own phase_rules; `~/.mindrian` was deliberately NOT edited by this plan.
  Verified at this plan's own execution time: `~/.mindrian/card-fire-reached.json` now reads
  `{}` (2 bytes), so the entry is already absent -- likely cleared by ordinary process since
  `276-12` ran, not by any action this plan took. Owner: repo navigator, if it ever recurs.

- **Worktree-per-session as the structural answer to the three collision classes** this phase
  met firsthand in its own shared working tree: the git-index race (`276-15`'s Task 1 commit
  absorbed into an unrelated Phase 339 commit, `e484f4b3`), the STATE.md resync-clobber
  (multiple plans in this phase hand-corrected `percent` after a concurrent session's
  legitimate write), and the room-registry bleed that blocks the compositing write below.
  Documented here as a recommendation only, not built (out of this repo's scope; the fix
  lives in how sessions are spawned, not in this codebase). Owner: repo navigator /
  `@opengsd/gsd-core` direction.

- **Hardening `check-tool-honesty.cjs` to `--strict`.** The quick-260903-ljj SUMMARY names
  this as available only after the finding list is empty. The live list is not empty by
  design (D-276-2: MEDIUM stays permanently visible, never suppressible) -- 12 MEDIUM rows
  remain, all with a written `documented-no-action` disposition (`276-15-SUMMARY.md`).
  Whether that residual MEDIUM count is "empty enough" to harden the gate is a navigator
  decision, not a planner one. Owner: repo navigator.

- **`cross-room-store.cjs` / `cross-room-umbilical-closer.cjs`'s fallback swallow.**
  `276-09`'s busy-timeout fix narrows the contention window but `withStore`/
  `withRejectionStore`'s `catch (_e) { return fallback; }` still cannot distinguish a busy
  outcome from any other failure at the caller. Changing the fallback contract is a
  caller-visible behavior change, out of `276-09`'s option-only scope. Owner: repo navigator.

- **The two-hop `resolveReachability` boundary behind `graph-index`/`graph-rebuild`.**
  `276-07` found these two `room_graph` commands genuinely write via a depth-2 dotted call
  chain (`lib/core/graph-ops.cjs` -> `lib/core/lazygraph-ops.cjs`) the detector's one-hop
  reachability model cannot see -- a real, separate boundary (candidate B-7), distinct from
  the WEAK-tier ruling that keeps the other 8 `room_graph` rows at documented-no-action.
  Owner: whoever next touches `scripts/check-tool-honesty.cjs`.

- **`scripts/verify-release`'s one pre-existing plugin-path-anchoring failure**
  (`commands/file-meeting.md:350`, predating this phase at commit `2f1f4cf3`), measured for
  the first time as this phase's own baseline by `276-15`. Not fixed here; `scripts/
  release.sh` was not run by this phase. Owner: repo navigator.

- **The nine mega-tools with no connector descriptor and no `hitl_shape`** (RESEARCH
  constraint C-3, open question 5): `room_state`, `room_content`, `room_graph`,
  `methodology`, `analysis`, `intelligence`, `meeting`, `export`, `orchestration` plus
  `eureka_critic` -- only `room_bind` has one today. Whether Canon Part 11 R16 covers MCP
  tools is OQ-3, still unresolved. Registered as a finding, not built. Owner: repo navigator.

**Dev-Research Compositing:** the durable reasoning trail lives at
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-03-same-disease-consolidation/`,
cross-linked back to this phase directory in both directions per CLAUDE.md's mandate.
**Status: LANDED 2026-09-04.** The write was originally attempted and blocked by the
`scripts/write-scope-check` PreToolUse guard (registry's active room was
`jonathan-contractor-motj`, not `rethinking-mindrianos`); the guard was NOT bypassed, per the
`267.3-08`/`270-12` precedent, and the content was staged instead at
`276-16-COMPOSITING-TRAIL-STAGED.md` in this phase directory. The pending navigator action
was then completed: (1) `/mos:rooms switch rethinking-mindrianos` (active room switched,
session-bound, verified against the registry), (2) the staged body landed at
`~/MindrianRooms/rethinking-mindrianos/research/2026-09-03-same-disease-consolidation/2026-09-03-same-disease-consolidation.md`
(auto-committed by the room's autocommit hook), (3) mirrored to
`~/MindrianOS/research/2026-09-03-same-disease-consolidation/2026-09-03-same-disease-consolidation.md`.
The STAGED file in this phase directory is kept as the historical record of the block; the
landed copy in the room is now the canonical one.

### Phase 277: SEED-004: Fix write-scope-check Nested-Room False-Positive Bug

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 276
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 277 to break down)

### Phase 278: SEED-001: Proactive Sub-Room Suggestions With Atomic Wikilink + SQLite Graph Wiring

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 277
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 278 to break down)

### Phase 279: SEED-002: Agent-Lightning APO Loop for Skill Prompt Optimization

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 278
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 279 to break down)

### Phase 280: SEED-008: Close the Loop — Wire Local Graph + Artifact Cascade + Memory Into Active Triggering

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 279
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 280 to break down)

### Phase 281: SEED-010: Neo4j Investigator Skill — Schema-Aware Brain Diagnostician

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 280
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 281 to break down)

### Phase 282: SEED-012: mos feynman-engine — Room-Integrated Story Command With Mom-Test Panel

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 281
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 282 to break down)

### Phase 283: SEED-013: Eliminate Python From the User-Machine Surface

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 282
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 283 to break down)

### Phase 284: SEED-014: Spin Brain MCP Server Out Into Its Own Deployment Repo

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 283
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 284 to break down)

### Phase 285: SEED-015: Selective Install via with/without Flags + Install Profiles

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 284
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 285 to break down)

### Phase 286: SEED-016: Mindrian AgentShield — Plugin-Wide Security Scanner

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 285
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 286 to break down)

### Phase 287: SEED-017: Hosted MindrianOS Pro Tier — Stripe Billing + Quota

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 286
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 287 to break down)

### Phase 288: SEED-018: Fix RS-Engine Degenerate Output on Hybrid Multi-User Topics

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 287
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 288 to break down)

### Phase 289: SEED-020: Apply Shape F AskUserQuestion Card as the Universal Mindrian UI

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 288
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 289 to break down)

### Phase 290: SEED-022: ICM Fractal Memory Contract — Multi-Level Sub-Room Inheritance

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 289
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 290 to break down)

### Phase 291: SEED-023: Meeting DIKW Filing Engine — Insight Layer, ACTA Reanalyze, Causal Timeline post-150.8 remainder

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 290
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 291 to break down)

### Phase 292: SEED-026: Graph Viz Must Build From room.db Typed Edges, Not Wikilink Cross-Refs

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 291
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 292 to break down)

### Phase 293: SEED-027: Fix export present MCP Tool Resolving the Wrong Active Room

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 292
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 293 to break down)

### Phase 294: SEED-028: Add Retry Fallback to Workflow Final Synthesis Step

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 293
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 294 to break down)

### Phase 295 [CLOSED 2026-09-03, substantially-shipped-elsewhere]: SEED-029: Local-Embedding Vector Spine in room.db, Retire Pinecone for Room + Signal

**Closed (navigator-ratified 2026-09-03, per Phase 296-RESEARCH.md Finding F-10):** this
phase's own "Depends on: Phase 294" line was `phase.add` heading boilerplate, not a real
dependency, and was never planned. SEED-029's real technical ask -- a local embedding layer
with vector persistence in room.db -- shipped anyway, under Phase 211 (`embedding-spine.cjs`)
and quick `260706-13z` (`vector-store.cjs`), with deliberate, documented improvements over
what the seed originally specified (see F-10 for the full comparison table). That covers
SEED-029's acceptance items 1, 2, 3, and 5 for the ROOM corpus. The one piece that did NOT
ship under those phases -- retiring the pre-built Pinecone index for the SIGNAL corpus (the
seed's own F8 cross-room-bleed finding) -- was Phase 296's actual work (SEED-030), closed
2026-09-03. SEED-029's remaining acceptance item 4 (the moat decision on the METHODOLOGY
corpus) is a standing navigator ruling, not a code task, and stays open for whoever picks it
up next; it is not blocked on this phase's closure. This entry is kept for historical record,
not deleted.

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 294
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 295 to break down)

### Phase 296: SEED-030: RS Pipeline Spine-Wiring + Expert-Graph Reconciliation

**Goal:** The reverse-salient discovery pipeline runs fully local: the external and hybrid signal corpus is fetched, embedded by the one shipped local encoder and cached per room instead of in a Pinecone namespace, and `rs-experts` answers "no transport", "unreachable" and "genuinely zero experts" as three distinguishable honest outcomes instead of one hand-rolled string.
**Requirements**: RSLOCAL-01, RSLOCAL-02, RSLOCAL-03, RSLOCAL-04, RSEXP-01, RSEXP-02, RSFENCE-01
**Depends on:** none. The `Depends on: Phase 295` line was `phase.add` heading boilerplate; 296-RESEARCH.md F-10 established that SEED-029's technical shape shipped under Phase 211 plus quick `260706-13z`, not under Phase 295, which remains an unplanned stub. Phase 296 does not wait on it.
**Plans:** 5/6 plans executed

Plans:

- [x] 296-01-PLAN.md - Wave-0 harness, shared both-backends room fixture, and the two already-true regression fences (F-3 and F-9)
- [x] 296-02-PLAN.md - rs-experts three-cause degrade through refusal-messaging.cjs, plus the corrected command doc and regenerated mirrors
- [x] 296-03-PLAN.md - scripts/rs-vector-bridge.cjs, the D-02 CJS vector bridge, and the Pitfall-1 both-backends guard
- [x] 296-04-PLAN.md - retire lib/core/rs_cache.py's Pinecone SDK layer for a per-room local sidecar
- [x] 296-05-PLAN.md - thread room scope through rs-engine.py, rs_hybrid.py, the CJS bridge and the differential scorer; name the auto-explore dispatch leftover
- [x] 296-06-PLAN.md - two-sided Pinecone residue gate, operator docs, full gate sweep, and the human HSI Tier 2 checkpoint (navigator-ratified 2026-09-03, all 4 points, no overrides)

Local working requirement IDs (minted at planning time; `.planning/REQUIREMENTS.md` carries no ROADMAP-mapped IDs for this phase, matching the PYPORT / CHOKE / TOOLHON precedent):

| ID | Requirement |
|---|---|
| RSLOCAL-01 | `lib/core/rs_cache.py` makes zero Pinecone SDK calls; the external and hybrid signal corpus is fetched and embedded locally |
| RSLOCAL-02 | Python never reads room.db's vector tables directly; one CJS bridge owns every vector operation, backend-agnostic across `eureka_vec` and `eureka_vec_fallback` |
| RSLOCAL-03 | The signal cache is per room, closing the SEED-029 F8 cross-room corpus bleed |
| RSLOCAL-04 | No cosine mixes 384-dim local vectors with 1024-dim e5 vectors; the unified corpus lives in one embedding space |
| RSEXP-01 | `rs-experts` degrades through `lib/core/refusal-messaging.cjs` with three distinguishable causes, and a genuinely empty result renders as a success |
| RSEXP-02 | `rs-experts` loads no `brainClient` and carries no `mcp__mindrian-brain__` tool; `PINECONE_API_KEY` and the `pinecone` package stay for `compute-hsi.py` Tier 2 and `pinecone-inference.cjs` |
| RSFENCE-01 | Phase-296 test infrastructure exists and the connector-registry, internal-mode zero-Pinecone, `rs-explain` byte-locked marker and Phase 272 contract fences stay green |

Supersedes Phase 228, which registered this same seed in the closed v1.15.0 milestone and never
received a CONTEXT, RESEARCH, PLAN or SUMMARY (its directory holds only a `.gitkeep`).

### Phase 297: SEED-031: Regulation Layer — Larry as User-Facing Connector, metacognition cost guardrail

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 296
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 297 to break down)

### Phase 298: SEED-032: Harness-as-Code — Declare and Machine-Enforce the MindrianOS Agent Harness

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 297
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 298 to break down)

### Phase 299: SEED-033: Apply Ralph-Loop Lessons to MindrianOS Autonomous Execution

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 298
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 299 to break down)

### Phase 300: SEED-035: SyntheticExpert to Per-Project Skill

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 299
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 300 to break down)

### Phase 301: SEED-036: Generate website commands-canon.json From the Plugin Command-Registry

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 300
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 301 to break down)

### Phase 302: SEED-039: Per-Session Room Binding and Multi-Session Reconciliation

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 301
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 302 to break down)

### Phase 303: SEED-040: HITL Memory Governance — What How Who the Room Remembers

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 302
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 303 to break down)

### Phase 304: SEED-042: Always-On Act RedTeam Toggle, Ask-Tell Dial CLI Affordance

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 303
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 304 to break down)

### Phase 305: SEED-043: Brain Command Recommendation — Brain Proposes, Human Triggers

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 304
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 305 to break down)

### Phase 306: SEED-044: Cross-Room Umbilical Cord — F-Shape Gate Connecting Relevant Items Across Rooms

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 305
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 306 to break down)

### Phase 307: SEED-046: Artifact Is Not Conversation — Enforce Clean Deliverable Voice on Filed Artifacts

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 306
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 307 to break down)

### Phase 308: SEED-047: Initial-Target-Market Discipline, 5 Buyers Not a 47B TAM

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 307
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 308 to break down)

### Phase 309: SEED-048: Portfolio-Scale FUSION — Batch-Score N Technologies, Surface the Hidden Gem

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 308
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 309 to break down)

### Phase 310: SEED-051: Fix release.sh Tag-Verify Window Too Tight

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 309
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 310 to break down)

### Phase 311: SEED-052: GSD Each mos Command as Its Own Mini-Product, JTBD Audience F-Shape

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 310
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 311 to break down)

### Phase 312: SEED-053: run_chain MCP Tool — Methodology Chaining With Handoffs, Halting at Material Gates

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 311
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 312 to break down)

### Phase 313: SEED-054: Beautiful-Question to Seed to Multi-Lens Harvest to Feynman-Breakdown Pipeline

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 312
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 313 to break down)

### Phase 314: SEED-055: Broaden SENS-13 to Portfolio Movement + mos eureka-portfolio Command

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 313
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 314 to break down)

### Phase 315: SEED-056: Wire Intelligence + Eureka Engines Into Larrys Own Behavior Contract

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 314
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 315 to break down)

### Phase 316: SEED-057: Synthesis as a Votable Expert — Graph-Native Game Theory Over Whats Next

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 315
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 316 to break down)

### Phase 317: SEED-059: Fallback-Disclosure Convention — Close the Gate-Firing False-Success Gap

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 316
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 317 to break down)

### Phase 318: SEED-061: Skill-Optimization Smoke Calibration Reconciliation

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 317
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 318 to break down)

### Phase 319: SEED-062: Close the Engine Gap — No Agentic Runtime in This Codebase

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 318
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 319 to break down)

### Phase 320: SEED-063: Evaluate OpenCode as Host Runtime Fork Target

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 319
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 320 to break down)

### Phase 321: SEED-064: Document Grok Build as Runner-Up Host Runtime, Governance Fail

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 320
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 321 to break down)

### Phase 322: SEED-065: Resolve the MCP Ceiling — Persona Proactivity Cannot Ship Over MCP

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 321
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 322 to break down)

### Phase 323: SEED-066: Document Collaborative-Shell Licence Findings, AFFiNE Docmost Disqualified

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 322
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 323 to break down)

### Phase 324: SEED-067: Document Subscription-Passthrough Prohibition, Anthropic Terms

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 323
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 324 to break down)

### Phase 325: SEED-068: Be Infrastructure, Not an Application

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 324
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 325 to break down)

### Phase 326: SEED-069: Open Core, Where the Boundary Is a Network Boundary

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 325
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 326 to break down)

### Phase 327: SEED-070: Capture the Stale-Bytes Lesson From the 2026-07-19 Eureka Live Test

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 326
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 327 to break down)

### Phase 328: SEED-071: MarkItDown LangExtract Evaluation for Devs

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 327
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 328 to break down)

### Phase 329: SEED-073: Filesystem SQLite Stays Canonical — Yjs RxDB Are Disposable Projections

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 328
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 329 to break down)

### Phase 330: SEED-074: Design Salience Clustering Primitive + Query-Time-Join Fallback for the Local Graph Read Layer

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 329
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 330 to break down)

### Phase 331: SEED-075a: Grading-Framework Grounding Check — Distinguish Reworded From Empty Before Firing a Contradiction

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 330
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 331 to break down)

### Phase 332: SEED-075b: ICM Provenance Dependency Sidecar

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 331
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 332 to break down)

### Phase 333: SEED-076a: Room-as-GraphRAG Conversational Component, BYOAPI Larry-Voiced

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 332
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 333 to break down)

### Phase 334: SEED-076b: Room Walk-Test + Pattern-Confirmation Threshold Against ICM Reference Form

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 333
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 334 to break down)

### Phase 335: SEED-077: Feynman-MINTO Wired Into the Graph — Per-Artifact Queryable Explanation

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 334
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 335 to break down)

### Phase 336: SEED-078: Bake Brain API Key Into Onboarding by Default

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 335
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 336 to break down)

### Phase 337: SEED-079: Fix Brain Identifier Corruption + the Role-Blind Extraction Pass Behind It

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 336
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 337 to break down)

### Phase 338: SEED-FW-COVERAGE: Re-Source the Framework UN-WIRED Gate From the Live Framework Population

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 337
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 338 to break down)

### Phase 339: Brain-to-Theo cutover release: flip brain-client default origin to theo-mcp.onrender.com, sweep old-origin sites, refresh 269-05 readiness checklist

**Goal:** Execute the Brain-to-Theo cutover from the plugin side: ship the single change Theo's `09-FLIP-RECORD.md` (status 2026-09-03: AUTHORIZED, not yet executed) names, as a plugin release, so every installed user's Brain traffic moves to Theo and Theo's own Phase 9 plan 09-12 can pass its Task 2 human gate. Registered 2026-09-03 by navigator directive ("make the transition to Theo, clean cutover, two sessions in parallel: one in Theo, one in MindrianOS"). This is NOT Phase 267 (the SDK v2 migration, blocked upstream on ext-apps, re-verified 2026-09-03: `@modelcontextprotocol/ext-apps` still 1.7.5, peer `sdk ^1.29.0`); it is a URL flip against the v1 SDK the repo already runs.

**The one required change:** `lib/core/brain-client.cjs:24`, default from `https://pws-brain-mcp.onrender.com` to `https://theo-mcp.onrender.com`. BARE origin, no path, no trailing slash: the client appends `/mcp` and `/register` itself, and a `/mcp` suffix 404s, which the client renders as "Brain unreachable" rather than a config error. Same commit: the stale docblock at lines 4-7. Live on 2026-09-03: `GET https://theo-mcp.onrender.com/health` returns `{"status":"ok"}`, keyless.

**Explicitly NOT required for the flip** (per the flip record, section 2): arg keys (`tests/test-247-contract-client.cjs` stays green untouched); the `mindrian-brain` shim server key; `BRAIN_TOOL_MATCHER` / `hooks/hooks.json` for a URL-only flip; the `brain_query` `{rows, diagnostics}` shape adaptation (already shipped, commit `21fdd7bc`, verified closed 2026-09-03).

**Plugin-side work that rides the same release, on the plugin's schedule:**

1. Sweep the hard-coded old origin so no second literal survives. Runtime sites first: `lib/core/mcp-profiles.cjs`, `lib/core/enrichment-queue.cjs`, `lib/core/doctor/class-m-brain-smoke.cjs` (+ `.test.cjs`), `scripts/probe-brain-contract.cjs`, `scripts/build-brain-census.cjs`, `scripts/rs-experts-command.cjs`, `scripts/rs-thesis-command.cjs`, `scripts/sessionstart-post-update-preflight.cjs`. Rule: every runtime site derives from `brain-client.cjs`'s exported endpoint resolver, never its own literal. Then user-facing surfaces: `commands/pws-brain.md`, `commands/setup.md`, `skills/pws-brain/SKILL.md`, `skills/setup/SKILL.md`, their `dist/*` mirrors, `docs/brain-setup.md`, `docs/install/BRAIN-SETUP.md`, `docs/THE-BRAIN.md`, `CLAUDE.md` (Three Layers table + stack table), fixtures `tests/fixtures/246-census-fixture.json` and `tests/test-245-skill-frontmatter-inert-keys.cjs`. Dated handoffs and RCAs under `docs/` are historical records: leave them.
2. Flush the `brain_schema` 30-minute memo across the flip (a cached incumbent schema would describe labels Theo does not carry). Also the retired-backend wording in `bin/mindrian-brain-mcp-client.cjs` tool descriptions ("live Memgraph backend").
3. Rewrite Phase 269-05's six-item Theo-readiness checklist. It is stale in a dangerous direction: items 1-3 now read PASS while the real legs went unchecked. The real gate, per Theo's `09-MOS-LEARNING.md` addendum of 2026-09-02: (a) coverage re-measured live against a PINNED Brain count (post Theo Phase 10 close on 2026-09-03: Theo 1252 nodes / 1518 rels / 419 named Frameworks vs Brain 29,200 / 24,375 / 258 at `Brain@56bf75a`), (b) Theo Phase 06.2 live, meaning summaries on disk (4/4 as of 2026-09-03), (c) 09-12's infrastructure legs (08.4 closed 2026-09-02, 09-11 remote parity 0 mismatches 2026-09-03, `/register` compat route). Leg (a) is a navigator RULING, not a mechanical check; record it in Theo's flip record before the release ships.
4. Cutover communication. Once `pws-brain-mcp` is suspended (Theo 09-12 Task 3, only after a soak window), any install that has not updated gets an honest "Brain unreachable" refusal (a `main` commit is not live until released AND picked up). Draft the tester note and the CHANGELOG entry; state the two-command update path.
5. Release: run touched-phase suites, `scripts/verify-release`, then `scripts/release.sh <next version>` (CHANGELOG currently carries `v2.0.0-beta.16 (in progress)`; latest tag `v2.0.0-beta.15`; the tree is 295 commits ahead of `origin/main`, push before cutting). The release is human-held. Phase 276 is mid-execution in the same working tree: pause it at a wave boundary for the cut.
6. Post-release verification, reported back to the Theo session as 09-12 Task 2's resume signal: on an installed session running the release, exercise `brain_stats` / `brain_ask` through Larry and confirm structured Theo answers; run `scripts/probe-brain-contract.cjs` (leg inversions are EXPECTED and documented, not failures); reply with the shipped version and "flip verified".

**Tri-Polar:** CLI traffic goes through the local shim (`mindrian-brain` key), zero change. Desktop and Cowork reach the remote directly: if the connector re-registers under a new key, `BRAIN_TOOL_MATCHER` gains one alternation token and `hooks/hooks.json` changes in the same commit (a parity test enforces byte equality); if only the URL moves, no change. Canon Part 8 unchanged: Theo is keyless and nothing user-specific crosses.

**Rollback:** revert line 24 in a patch release, or `MINDRIAN_BRAIN_URL` per install. Valid only while `pws-brain-mcp` still runs, which is why decommission waits for the soak.

**Coordination (two sessions):** Session T in `~/Theo` resumes Phase 9 at 09-12 Task 2 (human gate) and owns Task 3 (soak, suspend `srv-d9gfa03tqb8s73csfmtg` then `srv-d9geq2urnols73cimkfg`, never delete) and Task 4 (close-out). Session M in `~/dev/MindrianOS-Plugin` owns this phase. The seam is the flip record's section 2 plus 09-12's resume signal.
**Requirements**: FLIP-01, FLIP-02, FLIP-03, FLIP-04, FLIP-05, FLIP-06, FLIP-07, FLIP-08,
FLIP-09, FLIP-10, FLIP-11, FLIP-12
**Depends on:** Phase 269 (269-05 gate rewrite), Theo Phase 08.4 (deployed origin), Theo Phase 9 (09-12 Task 2 consumes this release)
**Plans:** 14/14 plans complete

**Close-out (2026-09-04).** Both releases shipped and verified on all four surfaces (npm, git tag,
marketplace pin, install cache): the PREP cut `v2.0.0-beta.17` (commit `cf99f110`) carried every
incumbent-safe adaptation, and the FLIP cut `v2.0.0-beta.19` (commit `39a096aa`) moved
`lib/core/brain-client.cjs:24` to `https://theo-mcp.onrender.com`, a bare origin, confirmed directly
in the installed cache. Cold-start latency on the first successful call after the cut: 1.726 seconds
against the 20 second budget. `scripts/probe-brain-contract.cjs` legs a and d passed clean; legs b, c
and e inverted exactly as documented (Theo serves `text2cypher` with no allowlist gate; Theo's
refusals are typed codes like `PLAN_REJECTED` rather than `BoundedReadRefusal` text; Theo's Aura
instance carries none of the incumbent's Memgraph index names). The D-03 regression check proved
both enrichment-queue shapes live in the shipped bytes: `orchestration_readiness_theo@` for a covered
framework and `orchestration_readiness_theo_refusal@FRAMEWORK_NOT_FOUND@` for an uncovered one, with
an honest-empty coverage block and no raw refusal text leaked (Canon Part 8 held). The resume signal
("v2.0.0-beta.19 flip verified", all six flip-day fields) was sent to Session T for Theo's own
09-12 Task 2.

**What this phase deliberately did NOT close, and who owns it:**

- **Decommission of `pws-brain-mcp` and `pws-brain-db`.** Theo 09-12 Task 3, operator-held. Soak
  window set by the navigator (several days, per the standing never-same-day rule); suspend only,
  never delete; compute suspended before data. Watch item from this phase: intermittent Theo-side
  rate-limiting (explicit JSON-RPC `-32005 Rate limit exceeded`, roughly 40-60% of calls over one
  observed 20-minute window), corroborated three independent ways and not a code defect, but worth
  tracking through the soak.

- **Sending the tester cutover note.** `docs/testers/outbox/2026-09-03-theo-cutover.md` now carries
  the real shipped version (`v2.0.0-beta.19`) but stays `status: drafted`, `sent_to: []`, and its
  suspend-date placeholder unfilled. The operator's, after a decommission date exists.

- **Re-census against Theo.** Deferred, per plan 339-07's three stated reasons; not reopened here.
- **`lib/brain/chain-recommender.cjs`'s Theo-shape adaptation.** D-03 consumer 2, a named follow-up,
  rides as-is (still incumbent-shaped) until its own phase.

- **`brain_write` and `ingest_framework` write paths.** Both meet `WRITE_PATH_DISABLED` by design;
  Theo's own governed payload mechanism is a separate phase's territory, not this one's.

- **The 30 uncovered Frameworks** (20 leadership/teams, 5 due diligence, 5 misc) bind Theo's
  decommission task per the coverage ruling, not this flip; `/mos:leadership` and due-diligence
  consults answer thinner through Theo (an honest-empty coverage block, not an error) until they are
  ingested or waived by name.

Plans:

**Wave 1 (tests first)**

- [x] 339-01-PLAN.md - FLIP-01..12 requirement family, tests/run-all-339.sh aggregator, origin-single-source scan
- [x] 339-02-PLAN.md - enrichment Theo-shapes, update-path drift and schema-memo tests
- [x] 339-03-PLAN.md - cross-repo note, 269-05 checklist and gate-zero-write arms, plus test-254 and test-250 extensions

**Wave 2 (PREP adaptations, all incumbent-safe)**

- [x] 339-04-PLAN.md - brain-client: origin-derived alias selector, origin-keyed schema memo, capture log shape
- [x] 339-05-PLAN.md - enrichment-queue two additive arms, brain-router Tier-3 disclosure
- [x] 339-06-PLAN.md - lib/core/update-path.cjs and the refusal-copy amendment
- [x] 339-07-PLAN.md - the literal sweep onto getBrainUrl(), plus the prose and banner sites
- [x] 339-08-PLAN.md - Desktop and Cowork connector docs, regenerated mirrors, backend-agnostic shim descriptions
- [x] 339-09-PLAN.md - docs/339-NOTE-theo-desktop-connector-key.md and the 269-05 checklist rewrite

**Wave 3 (PREP written record)**

- [x] 339-10-PLAN.md - PREP CHANGELOG entry and the tester cutover note draft

**Wave 4 (PREP cut, human-held)**

- [x] 339-11-PLAN.md - PREP CUT: clean-tree gate, push, suites, verify-release, release.sh --prerelease, post-release checks

**Wave 5 (the flip)**

- [x] 339-12-PLAN.md - line 24, the docblock, class-m constants, the test-245 tripwire with CLAUDE.md, FLIP CHANGELOG

**Wave 6 (FLIP cut, human-held)**

- [x] 339-13-PLAN.md - FLIP CUT: blocking coverage gate, the Session T cue, release.sh --prerelease

**Wave 7 (post-release)**

- [x] 339-14-PLAN.md - FLIP-12 installed verification, the Session T resume signal with six flip-day fields, close-out

### Phase 267.1: Hooked Model Completeness Audit (first-session onboarding) (INSERTED)

**Goal:** Audit `scripts/session-start`'s `FIRST_INSTALL` prose injection against this repo's own hard rule that the Hooked Model (Fogg B=MAP, Trigger-Action-Reward-Investment) is the mandatory design lens for the first step of any Mindrian surface. Already confirmed this session: real Trigger and Action legs (warm opener, three explicit choices, JTBD-formula framing for returning users). NOT yet verified: Reward and Investment. Does the onboarding flow deliver a genuine variable Reward (a real payoff visible in that same first session, not just a promise) and build real Investment (something the user puts in that increases the odds they return -- e.g. USER.md profile-building, a filed artifact, a habit cue)? Map the full loop explicitly, cite the actual prose/code for each leg, and flag any leg that is asserted in a hard-rule doc but not actually implemented. Content-level UX audit work, not protocol work -- despite sitting numerically under Phase 267, it does NOT depend on the MCP stateless migration (now known to be BLOCKED, see 267) and should be planned/executed independently, on its own schedule.

Cross-references: the audit shipped at `.planning/research/2026-08-27-hooked-first-install-audit.md`, scoring FIRST_INSTALL 30/70, Fragile loop band (30-44), the score labelled diagnostic and not a gate (Canon Appendix D entry 31). **Navigator verdict on the score (267.1-06 Task 2 checkpoint, 2026-08-27): the 30/70 score and its cited gaps (GAP R-1, GAP I-1) stand as real findings, comparable to the 45/70 LarryReach and 38/70 `/mos:ignite` precedents** - no score-row corrections ordered. The navigator did flag that the audit's Quick win 1 recommendation ("add `/mos:ignite` to the cold-start menu") may be treating the wrong lever, since in practice `/mos:ignite` has rarely if ever triggered a session while a plain Larry greeting sometimes has; that empirical concern and the navigator's own preferred design candidate (a Brain-backed, context-sensitive greeting router) are recorded as scope for Phase 267.2, not decided or built here. The one remediation this phase shipped: the SEED-021 `AskUserQuestion` card mandate added to the FIRST_INSTALL prose (commit `f39f24d9`), bringing it into the rendering contract the two sibling cold-start branches already obeyed. **Navigator verdict on scope (OQ-3, REVERSED):** this fix should not have shipped inside an otherwise audit-only phase; the navigator ordered it deferred to Phase 267.2 instead. Per plan 267.1-06 Task 2's own constraint, the revert (of `scripts/session-start`'s SEED-021 line and the matching positive pin in `tests/test-267-1-first-install-hooked-audit.cjs`) is NOT performed inside this checkpoint task - the code and test currently still reflect the shipped-not-yet-reverted state, and the revert is registered as explicit follow-up work in Phase 267.2's own entry below. What it registered rather than fixed: Also touches Phase 267.2 (First-Install Hooked Loop Repair - GAP R-1 reward routing and GAP I-1 investment writer, registered by this audit, now also carrying the navigator's greeting-router design input and the deferred SEED-021 revert). Also touches Phase 267.3 (Reward-Before-Investment Guard Jurisdiction - GAP G-1, the one finding with no Phase 269 collision; navigator confirmed this sequencing as-is, no changes). Also touches Phase 269 (Moat Shift - Install/Update Entitlement Gate - the audit's GAP S-1, the two sign-ins across two domains before the Trigger ever fires, is documented and quantified here and OWNED there; this phase deliberately did not fix or re-decide it), citing `docs/testers/gaurav-thorat/FEEDBACK.md` by path as the primary evidence. Room mirror: the full reasoning trail lives at `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-hooked-first-install-audit/`.
**Requirements**: TBD
**Depends on:** none -- independent of Phase 267's now-blocked status, planned/executed on its own schedule
**Plans:** 6/6 plans complete. Navigator ruled on all three 267.1-06 Task 2 checkpoint items 2026-08-27: score stands, OQ-3 reversed (SEED-021 revert deferred to Phase 267.2 W0), sequencing confirmed. Phase close-out verdict CHANGES REQUESTED, entirely scoped to Phase 267.2 -- Phase 267.1 itself is COMPLETE.
Plans:
**Wave 1**

- [x] 267.1-01-PLAN.md - Wave 0 validation scaffold plus the in-scope SEED-021 card-mandate fix in FIRST_INSTALL (fix now slated for revert in Phase 267.2 W0 per navigator ruling)
- [x] 267.1-02-PLAN.md - Pre-audit grounding: hard-rule provenance (A5) and the two-question Claude Code hook consultation (A1/A2) -- all three settled

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 267.1-03-PLAN.md - The scored /70 Hooked audit of FIRST_INSTALL with the cited leg-by-leg gap register -- 30/70, Fragile loop band, navigator-confirmed

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 267.1-04-PLAN.md - Rethinking-room mirror plus bidirectional cross-link (Dev-Research Compositing mandate) -- both directions verified via fs.existsSync
- [x] 267.1-05-PLAN.md - Follow-up phase registrations 267.2 and 267.3 plus the 267.1 Cross-references paragraph

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 267.1-06-PLAN.md - Phase gate roll-up and navigator review of the scores, the scope call, and the registrations -- all gates green, navigator ruled, phase closed

### Phase 267.2: First-Install Hooked Loop Repair (Reward + Investment) (INSERTED)

**Goal:** `.planning/research/2026-08-27-hooked-first-install-audit.md` (v2.0.0-beta.12 / main @ 86a9af2728077e715e5f6a0ebf7ac9d6dcc1d50c) scored the FIRST_INSTALL surface's Reward and Investment legs 2/10 and 1/10: the FIRST_INSTALL surface asserts a variable reward and an investment deposit as prose instructions to the model, and neither is wired.

**W0 - Revert the SEED-021 fix shipped in Phase 267.1 (navigator-ordered scope correction, 2026-08-27 267.1-06 Task 2 checkpoint).** Phase 267.1's OQ-3 scope call - shipping the SEED-021 `AskUserQuestion` card mandate as an in-scope fix inside an otherwise audit-only phase - was reversed by navigator ruling: it should have been deferred here instead. Two-part revert: (1) undo the one-line change in `scripts/session-start`'s FIRST_INSTALL block (commit `f39f24d9`, "Offer three approaches - fire the AskUserQuestion card with these three as options; default to option 3 (Skip)... (SEED-021)" reverts to the original prose-list wording); (2) invert `tests/test-267-1-first-install-hooked-audit.cjs`'s Action-leg assertion back to a negative pin (asserting the mandate's absence, matching `267.1-VALIDATION.md` row 267.1-01-04's original pre-fix framing). Not performed by Phase 267.1's own close-out task per that plan's explicit constraint ("do NOT revert scripts/session-start inside this task") - recorded here as this phase's first work item so the fix ships together with the Reward/Investment leg work below rather than piecemeal.

**W1 - Route the first session to a real reward (GAP R-1).** The reward promise line lives in the FIRST_INSTALL payload with no wired call. `lib/core/domain-insight-sweep.cjs` declares itself "THE single entry point for the Hooked variable-reward leg" but is invoked only from `/mos:ignite` and requires an open `db` handle that a first install has no room to provide. `scripts/check-pending-breakthrough.cjs` returns `{continue:true}` in silence when no rooms directory exists, so the flagship automatic reward is structurally silent on the one session where a first reward matters most. `COLD_START_MENU` routes the first-time user to `/mos:new-project`, the scaffold backend, while `skills/ignite/SKILL.md:50` names `/mos:ignite` the canonical front door. Two candidate mechanisms, neither pre-decided: add `/mos:ignite` to the cold-start menu, and/or give `sweepDomainInsights` a pre-room text-only path using the degradation its own header already documents.

**Navigator design input (2026-08-27, 267.1-06 Task 2 checkpoint) - read before planning W1.** The navigator's own observation: `/mos:ignite` has never actually started a session in practice; a plain Larry greeting sometimes does. That is a real empirical/design concern the audit's static-analysis view could not see (the code names `/mos:ignite` "the canonical front door" per `skills/ignite/SKILL.md:50`, but static analysis cannot confirm real usage matches that intent) - "add `/mos:ignite` to the cold-start menu" (the first candidate mechanism above) may be treating the wrong lever. Two navigator instructions for this phase's future planning, not yet decided or built: (a) before building either W1 candidate, get empirical data on whether `/mos:ignite` vs. a plain-Larry-greeting actually drives continued engagement in practice - instrument/log if no usage data already exists, or review existing session data if it does; (b) the navigator's own preferred candidate design, offered as one option among several rather than a decision: replace the static `COLD_START_MENU` with a Brain-backed, context-sensitive greeting that asks the user what they are actually here for (starting a new project / continuing an existing one / curating a few / first time / just want to talk) and routes to `/mos:ignite`, a plain Larry conversation, or elsewhere based on that answer, rather than presenting a fixed menu.

**W2 - Give the investment assertion a writer, or delete the assertion (GAP I-1).** `~/.mindrian-user.md` has zero writers repo-wide; `lib/core/user-archetype.cjs:64` READS it; the only deterministic writer `writeUserMdAtomic` (`lib/core/user-md-ops.cjs:440`) is reachable only from `lib/core/navigation/room-birth.cjs:572` and `:801` and writes to `roomDir/USER.md`, which a first install does not have. Either wire a home-directory writer, or remove the prose instruction so the product stops promising something it does not do. Hard constraint: `/mos:profile-user` is referenced by USER.md stubs in production rooms and DOES NOT EXIST, so it must not be adopted as the mechanism. Fragility item: `check-onboard --write` is itself an LLM instruction, so the onboarding state machine's advance step depends on model compliance.

Each workstream flips a negative assertion in `tests/test-267-1-first-install-hooked-audit.cjs` to positive when its gap closes; flipping that pin is part of this phase's work, not a test failure to route around.

Cross-references: Also touches Phase 269 (Moat Shift - Install/Update Entitlement Gate - removing the Brain-key friction step changes the onboarding Trigger/Reward/Investment legs this phase repairs, so building against the current key-gated flow risks rework). Also touches Phase 267.1 (Hooked Model Completeness Audit - the audit that registered GAP R-1 and GAP I-1, `.planning/research/2026-08-27-hooked-first-install-audit.md`).
**Requirements**: HOOK-01..HOOK-12 (minted at plan time in `267.2-DECISIONS.md` D-A, registered in
`.planning/REQUIREMENTS.md` at phase close by plan 267.2-10, per the Phase 254/257/265/267.3/270/272/274
precedent for phase-local working IDs)
**Depends on:** none technically, but sequenced after Phase 269 lands its onboarding-flow change (repairing the reward and investment legs against the current key-gated first session risks throwaway work, and the audit that motivates this phase says so explicitly).
**Theo forward-compatibility (navigator ruling, 2026-09-02, standing rule -- CLAUDE.md):**
Phase 269 already ties the key-gate removal to Theo's cutover becoming keyless/unconditional --
before this phase's research locks, confirm whether the reward/investment repair should assume
the post-cutover keyless flow (Theo, weeks not months away per Phase 262) as the target state
rather than designing against the current key-gated one.
**Plans:** 10/10 plans complete
`267.2-VALIDATION.md` reconciled, the gate roll-up measured as a delta against `267.2-BASELINE.md`,
the dev-research trail composited, and a blocking navigator sign-off checkpoint (Task 3) pending.

Plans:

**Wave 1** *(parallel; no production code touched)*

- [x] 267.2-01-PLAN.md - HOOK-01: record `267.2-BASELINE.md` BEFORE any code edit (the 267.1 suite is RED today for a reason unrelated to this phase, research C-2), plus the unmeasured `runPipeline` hook-budget measurement research left at LOW confidence, appended to `267.2-DECISIONS.md` as the D-D confirmation
- [x] 267.2-02-PLAN.md - HOOK-02: `tests/run-all-267.2.sh` (glob discovery, found-eq-0 guard provable via the PREFIX override, three explicit gate lines, two-array em-dash fence) plus `tests/test-267-2-helpers.cjs`, the isolated-HOME fixture four later tests need and the mitigation for research Pitfall 6

**Wave 2** *(parallel; zero files_modified overlap)*

- [x] 267.2-03-PLAN.md - HOOK-03/04, W0: the navigator-ordered `f39f24d9` SEED-021 revert in `scripts/session-start`, the Action-leg pin inversion, and the GAP I-1 leg repair to post-270-11 reality. Both test edits in ONE wave because the file aborts on first failure (research Pitfall 7)
- [x] 267.2-04-PLAN.md - HOOK-11, folded todo: `/mos:ignite` Door 1 becomes a two-step pick reaching all 7 frozen `ROLE_BLEND_KEYS` within the 4-option `AskUserQuestion` cap, `mentor` included at `blueprintFamily=exploration` (D-H), Tri-Polar fallback fixed in lockstep, drift pin added, Portfolio Manager NOT minted (D-J)
- [x] 267.2-05-PLAN.md - HOOK-05/06, W1a+W1c: `lib/core/greeting-intent-detector.cjs`, a pure per-bucket-scored classifier with a mandatory negative-weight feature, `ambiguous` on a tie, scalars-only features, zero network; plus the frozen 4-bucket to 3-outcome routing table (D-C) and its exhaustive pin

**Wave 3**

- [x] 267.2-06-PLAN.md - HOOK-08, W1b decision layer + W1d: `scripts/first-install-router.cjs` as a `UserPromptSubmit` hook cloned in shape from `scripts/mva-detect.cjs`. Owns its own one-shot state so a model-run `check-onboard --write` cannot disarm it (Pitfall 3), never blocks, never exits non-zero. Registered AFTER `mva-detect` in the chain, born wired, with scalar-only telemetry that also measures whether the ignite route actually produced a room (Pitfall 5)

**Wave 4**

- [x] 267.2-07-PLAN.md - HOOK-07, W1b delivery: the room-free Instant Brief gets a deterministic caller. Fired as a detached unref-ed child with stdout captured, drained as `additionalContext` on a later turn. `runPipeline` is NEVER called inline: `lib/core/mva-dispatcher.cjs`'s own binding decision B2 is a 45s global / 35s per-agent budget against a 3000ms hook ceiling (D-D). Proven with no room and no API keys

**Wave 5**

- [x] 267.2-08-PLAN.md - HOOK-09, W1 prose leg + C-5: FIRST_INSTALL asks ONE open question and renders no menu (D-B); `${COLD_START_MENU}` the variable stays byte-identical because it feeds three branches (D-F); `data/first-reward-surfaces.json` moves to `instant_brief` with an honest `why`; the GAP R-1 prose-citation pin flips

**Wave 6**

- [x] 267.2-09-PLAN.md - HOOK-10, W2: the investment trigger. A hook-side read-modify-write CALLER of the shipped `writeUserMdAtomic`, never a second writer (MEMOP-08, D-E), gated strictly behind the reward (D-L, test-pinned). Fixes research C-3 at the reader so a founder stops reading back as a student (D-G). GAP I-1 flips to CLOSED

**Wave 7**

- [x] 267.2-10-PLAN.md - HOOK-12: register `HOOK-01..HOOK-12`, reconcile `267.2-VALIDATION.md` against real plan numbers (D-M), run the full gate set reported as a DELTA against the recorded baseline rather than a bare green claim, composite the dev-research trail to `rethinking-mindrianos` (never bypassing `write-scope-check`), and a BLOCKING navigator sign-off on the actual first-install experience with the released-build limitation stated

**Stated gaps this phase does not close** (recorded, not overlooked): Claude Desktop and Cowork get no hook-side router, so the classifier ships as a pure `lib/core/` function reusable by a future MCP handler while the CLI hook is the only wiring (D-K); the reward lands one turn after the triggering sentence (D-D); `identity_write`'s frontmatter clobber on a second call, `user-archetype`'s first-declared tie-break, the Portfolio Manager vocabulary question, and `check-onboard --write`'s own model-compliance fragility are all registered with named owners in `267.2-DECISIONS.md` D-N.

### Phase 267.3: Reward-Before-Investment Guard Jurisdiction (hooks and injected-prose surfaces) (INSERTED)

**Goal:** The reward-before-investment hard rule has a real enforcement mechanism, and that mechanism cannot see the surface that needs it most. Three independent proofs of its scope: the `lib/core/mva-rule-linter.cjs` header stating it scans `commands/*.md` frontmatter, `scanCommands` reading `commandsDir` only, and `scripts/check-reward-before-investment.cjs` defaulting its target to `path.join(__dirname, '..', 'commands')`. Consequence: `scripts/session-start` is a bash hook with no frontmatter to carry an `interactive_first_reward` declaration, so the single most-first flow in the product, the one every user hits before any command, is structurally outside the guard. `/mos:onboard` at least carries `interactive_first_reward: reframe_question` with an honest inline "Remediation tracked as follow-up phase" comment (`commands/onboard.md:12`) while FIRST_INSTALL carries no declaration at all. This is a governance gap, not just a content gap, and it explains why the other gaps survived - nothing was ever built to catch them (GAP G-1, `.planning/research/2026-08-27-hooked-first-install-audit.md`).

Open design question, not decided here: how does a bash hook or an injected-prose surface declare a first-reward contract the linter can read? A sidecar declaration file, a manifest, a comment convention the linter parses, or an extension of the born-wired connector registry are all candidates. Canon Part 11 adjacency noted, since that is the repo's existing machinery for "every invocable surface is born declared".

Cross-references: this is the ONE audit finding with no Phase 269 collision and can be planned immediately. Also touches Phase 267.1 (Hooked Model Completeness Audit, `.planning/research/2026-08-27-hooked-first-install-audit.md`, the audit that registered GAP G-1).
**SCOPE-WIDENING QUESTION, raised by Phase 271 plan 03 (2026-08-27, navigator-directed).** This phase is currently scoped to the surfaces the linter CANNOT see (a bash hook has no frontmatter to carry a declaration). Plan 271-03 surfaced an adjacent gap on the surface the linter CAN already see: **67 of 113 commands carry no `interactive_first_reward` declaration at all** (only 46 do). Phase 118-06 (`5175d33b`, 2026-05-15) shipped the rule with 6 declarations and no backfill, and the rest accreted opportunistically as unrelated phases happened to touch files - there is no family pattern, direct twins land on opposite sides (`analyze-needs` declared, `analyze-systems` missing; `find-analogies` declared, `find-connections` missing). Phase 245-02 then made the linter `--staged`-scoped, so the debt is invisible until an unrelated sweep stages the files, which is exactly how plan 271-03 hit it and stalled at 28/45.

**Recommendation for whoever plans this phase:** widen the goal from "how does an out-of-frontmatter surface declare a first-reward contract" to ALSO include **"declare `interactive_first_reward` for all currently-missing interactive commands"**, and decide here whether the linter keeps its `--staged` scope or gains a whole-tree audit mode that makes the debt visible without waiting for an unrelated commit. Both halves are the same jurisdiction question: who must declare, on what surface, and what enforces it. Note the values are genuinely per-command and cannot be rubber-stamped - `lib/core/mva-rule-linter.cjs` binding decision B5 states the file validates only the DECLARATION and that per-command remediations are follow-up phases, and a first-pass guess during 271-03 already produced one demonstrably false declaration.

**SCOPE RULING (made at plan time, 2026-08-27).** The scope-widening question above is answered YES, with a tiering the ROADMAP's own recommendation did not anticipate. Both halves are the same jurisdiction question, so both are in scope: the out-of-frontmatter declaration contract AND the whole-tree backfill of all 67 undeclared commands. The planning-time audit found a third finding neither half anticipated: the closed six-value `REWARD_TYPES` vocabulary cannot honestly describe a conversational methodology command (`analyze-systems`, `mullins`, `systems-thinking` and four others) or a diagnostic/report command (`status`, `doctor`, `heal` and five others), because five of the six terms were minted against exactly one flow each and `--none (scripting only)` is legitimate only where a real `--no-interactive`/`--script`/`-q` path exists. `docs/reward-before-investment-rule.md` names a `/mos:status` output as a non-reward in its own words, so `status` can honestly declare neither a reward type nor the scripting opt-out. A vocabulary amendment therefore GATES the backfill; that is a missing-information constraint, not a difficulty judgment, and it is why the backfill is sequenced after the ruling rather than split out. NOT absorbed by this phase, stated so a later reader does not assume otherwise: DEFERRED-271-D2 (`agents/larry-extended.md` declaring `hitl_shape: F.1` and `connector.excluded: true` simultaneously, plus 52 `skills/*/SKILL.md` advisory violations) is a Canon Part 11 SHAPE-declaration question on a different field and stays OPEN; and Phase 267.2 still owns repairing the FIRST_INSTALL Reward and Investment legs, since this phase declares the contract and does not change the onboarding flow.

**Requirements**: GUARD-01, GUARD-02, GUARD-03, GUARD-04, GUARD-05, GUARD-06, GUARD-07, GUARD-08, GUARD-09, GUARD-10 (minted at plan time in `267.3-DECISIONS.md`, registered in `.planning/REQUIREMENTS.md` at phase close, per the Phase 270 precedent)
**Depends on:** none - independent of Phase 269 and of Phase 267.2; this is a lint-scope and declaration-contract change, not an onboarding-flow change.
**Blocks:** ~~Phase 271 plan 03's remaining 17 command files~~ **CLEARED 2026-08-28 by plan 267.3-05, commit `fa2f1414`.** The block was Phase 271 plan 03's remaining 17 command files (16 with anchoring edits held uncommitted in the working tree, plus `commands/doctor.md`), which could not be committed until the declaration question was ruled. See `271-03-SUMMARY.md`. Plan 267.3-04 ruled the 17 declarations and plan 267.3-05 anchored `commands/doctor.md:264` and committed all 34 held files through the full pre-commit hook with no bypass. Nothing is held in the working tree anymore (`git diff --name-only -- commands/ skills/` is empty), gate 10c is GREEN, and Phase 271 is no longer blocking a release cut.
**Plans:** 8/8 plans executed. COMPLETE. 8 plans across 7 waves. Plan-time measurement: 46 compliant / 67 missing / 0 invalid over 113 `commands/*.md`; `scripts/verify-release` gate 10c RED; 16 command files plus 16 mirrors held uncommitted in the shared tree. Re-measured live at 267.3-01 execution time (2026-08-27, HEAD `cf7eabf3`): IDENTICAL, 46 / 67 / 0 over 113, gate 10c RED with 1 violation (`commands/doctor.md:262`), 16 + 16 still held. See `267.3-AUDIT.md` Sections 1 and 4. **Post-267.3-04 (2026-08-28, HEAD `ef1704d4`): 63 / 50 / 0. `REWARD_TYPES` is 9 members.** Gate 10c is STILL RED, now with its 1 violation at `commands/doctor.md:264` (the two inserted frontmatter lines shifted it by 2); the linter block that stopped the 34 files from being committed is GONE, but the anchoring fix itself is 267.3-05's work, so 267.3-04 unblocks the commit without greening the gate. **Post-267.3-05 (2026-08-28, HEAD `fa2f1414`): 63 / 50 / 0 unchanged (this wave declared nothing new; the remaining 50 are plans 06 and 07). Gate 10c is GREEN: `check-plugin-path-anchoring.cjs --check` reads VIOLATIONS 0 across all four surfaces, `scripts/verify-release` reads 34 passed / 0 failed / 2 warnings and CLEAR TO RELEASE, and nothing is held in the working tree.** **Post-267.3-06 (2026-08-28, worktree merge `f6ec7be4`): 88 / 25 / 0 (batch A, 25 of the remaining 50 commands declared -- `admin` through `mos`). `tests/run-all-267.3.sh` PASS=5 FAIL=0 SKIP=0 post-merge. Remaining 25 are plan 267.3-07's batch B.** **Post-267.3-07 (2026-08-28, worktree merge `8f2feddc`): 113 / 0 / 0 -- whole-tree audit reads zero missing for the first time since Phase 118-06. `node scripts/check-reward-before-investment.cjs` exits 0, independently re-run and confirmed post-merge, not just trusted from the executor's own report. `tests/run-all-267.3.sh` PASS=5 FAIL=0 SKIP=0. This is the precondition plan 267.3-08 needs to promote the full-audit gate to fail-closed.**

**PHASE OUTCOME (267.3-08, phase close, measured numbers).** All three legs of the plan-01 jurisdiction ruling landed. D-A (out-of-frontmatter declaration mechanism): a sibling registry, `data/first-reward-surfaces.json`, modeled on `data/first-touch-surfaces.json`, holding 4 declared surfaces (`session-start:FIRST_INSTALL`, `session-start:UPDATE`, `session-start:MODE_ROUTING`, `session-start:COLD_START_MENU`), all `--none (diagnostic surface)`, audited by `--surfaces` mode and gate 10d. D-B (vocabulary amendment): `REWARD_TYPES` grew from 6 to 9 members across two separate amendments - `methodology_reframe` and `--none (diagnostic surface)` ruled at plan time (267.3-DECISIONS.md Section 3), `live_deliverable` minted mid-classification for `/mos:publish`'s live-URL deploy (267.3-CLASSIFICATION.md Row 13) when none of the eight prior terms could describe it honestly. D-C (lint scope): the commit gate stayed `--staged` exactly as Phase 245-02 built it (never widened, never relaxed); the whole-tree audit gained two release gates instead - gate 10d (the registry audit, wired in wave 3) and gate 10e (the whole-tree `commands/*.md` audit, wired in this final wave, both proven fail-closed against a stripped-fixture A/B test before being declared done, per the 271-05 discipline: a copy of `commands/` with one declaration stripped exits 1, the real tree exits 0). 67 commands declared across three waves (17 in wave 3 blocking Phase 271, 25 in wave 5 batch A, 25 in wave 6 batch B). Final whole-tree audit: 113 compliant / 0 missing / 0 invalid, unchanged since 267.3-07 and independently re-confirmed at this plan's own Task 1 execution and again at Task 3's roll-up.

**SCOPE, explicit (what this phase did NOT absorb).** DEFERRED-271-D2 (`agents/larry-extended.md` declaring `hitl_shape: F.1` and `connector.excluded: true` simultaneously, plus 52 `skills/*/SKILL.md` advisory violations) is a Canon Part 11 SHAPE-declaration question on a different field (`hitl_shape` vs. `connector.excluded`), not a reward-declaration question, and remains OPEN with no owner assigned. Phase 267.2 still owns repairing the FIRST_INSTALL Reward and Investment legs of the onboarding flow; this phase declared the enforcement contract and did not change the flow itself.

**Dev-Research Compositing (Rethinking Room).** The reasoning trail was drafted in full (governance finding, debt-ratchet mechanism, the D-A/D-B/D-C ruling with rejected alternatives, measured before/after, the no-relaxation audit verdict) and staged at `.planning/phases/267.3-reward-before-investment-guard-jurisdiction/267.3-08-COMPOSITING-TRAIL-STAGED.md`, but **could NOT be landed** at its intended target, `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-reward-guard-jurisdiction/`, from this plan's worktree-isolated execution context: the Write tool itself refuses any path outside the worktree root, a broader block than the anticipated `scripts/write-scope-check` room-scope guard (which would ALSO have blocked the write independently -- the room registry at `~/MindrianRooms/.rooms/registry.json` reads `"active": "launchpad-02"`, not `rethinking-mindrianos`, confirmed by direct inspection). Per this plan's own instruction, the guard was not bypassed. **Pending navigator action:** a non-worktree-isolated session with room-write access must (1) switch the active room (`/mos:rooms switch rethinking-mindrianos`), (2) copy the staged file's body to `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-reward-guard-jurisdiction/2026-08-27-reward-guard-jurisdiction.md`, and (3) mirror it to `~/MindrianOS/research/` per the standing Dev-Research Compositing convention. This line itself is the room-to-repo cross-link named in the plan's own action once the room side lands.

Plans:

**Wave 1**

- [x] 267.3-01-PLAN.md - The measured jurisdiction map (`267.3-AUDIT.md`) plus the blocking navigator ruling on D-A (out-of-frontmatter declaration mechanism), D-B (vocabulary amendment) and D-C (lint scope), recorded with rejected alternatives in `267.3-DECISIONS.md`

**Wave 2** *(blocked on Wave 1)*

- [x] 267.3-02-PLAN.md - The declaration contract: `data/first-reward-surfaces.json`, the `REWARD_TYPES` amendment as a recorded canon amendment, `scanDeclaredSurfaces()`, the `--surfaces` CLI mode, and `tests/run-all-267.3.sh` (commits `1967e28d`, `9a1b9fda`, `92be6e27`; `REWARD_TYPES` now 8 members, registry ships schema-complete with `surfaces: []` for 267.3-03 to populate, `run-all-267.3.sh` PASS=4 FAIL=0, and the `commands/` audit is UNCHANGED at 46 / 67 / 0 because this plan built a mechanism and declared nothing)

**Wave 3** *(blocked on Wave 2)*

- [x] 267.3-03-PLAN.md - Declare the `scripts/session-start` injected-prose branches (FIRST_INSTALL, UPDATE, MODE_ROUTING), add in-file anchor comments, add the anchor tripwire test, and wire the fail-closed surfaces gate into `scripts/verify-release` (commits `1166ca48`, `d8177876`, `4b35f2c1`; FOUR records declared, not three - `COLD_START_MENU` is its own surface per `267.3-AUDIT.md` Section 2.1 and is appended by all three branches. All four declare `--none (diagnostic surface)`: none delivers a qualifying variable reward today, per GAP R-1 (Reward leg 2/10), and a reward term would have been a false declaration. `scripts/session-start` diff is comments-only and PROVEN so: every non-comment line byte-identical to pre-plan HEAD `fd3afd46`, 34 added / 0 deleted, zero changed lines mentioning SEED-021, so the deferred SEED-021 revert stays Phase 267.2's untouched work. `verify-release` gains fail-closed gate 10d, sited after 10c, purely additive at 42 added / 0 deleted so 10c is untouched by construction and stays correctly RED. `run-all-267.3.sh` PASS=5 FAIL=0. New vocabulary-precision item logged as DEFERRED-267.3-D2: `--none (diagnostic surface)` is a strained fit for FIRST_INSTALL and MODE_ROUTING, which ask before they give rather than reporting state, and a third opt-out term would be a canon amendment D-B does not authorize)
- [x] 267.3-04-PLAN.md - The classification rubric plus the 17 commands blocking Phase 271, human-ruled before any frontmatter is written (commit `ef1704d4` plus the docs commit below; `267.3-CLASSIFICATION.md` carries Part 1's rubric with S-1, the four qualifying tests, disqualifiers D-1/D-2 and six tie-break rules TB-1..TB-6, Part 2's 17 reasoned rows each citing a `path:line` first-delivery moment, and the navigator's `## Navigator ruling`. **The ruling widened scope beyond wave 2: it minted a NINTH `REWARD_TYPES` member, `live_deliverable`, for `commands/publish.md:149`**, because all eight prior terms could only describe publish's live shareable URL falsely and `--none (diagnostic surface)` would have been false in the opposite direction (publish performs an irreversible action rather than reporting state). Landed as a full canon amendment across all four places a term must live: the frozen Set, the rule doc's allowed-values list, its `## Vocabulary amendments` entry, and `data/first-reward-surfaces.json`'s mirror, with test T15 added as T12's sibling for the added members. `--none (diagnostic surface)` also gained its narrow, documented ROUTER sub-case (Row 15, `show`). All 17 declarations applied and all 17 mirrors regenerated; the audit moved 46 / 67 / 0 to **63 / 50 / 0**, missing down by exactly 17, invalid still 0. The 30 held 271-03 anchoring lines survive byte-identically, proven per-file. **Nothing in `commands/` or `skills/` is committed here by plan instruction** - that is 267.3-05's job)

**Wave 4** *(blocked on Wave 3)*

- [x] 267.3-05-PLAN.md - **COMPLETE: Phase 271 unblocked, gate 10c GREEN** (commits `fa2f1414` the 34-file unblocking commit, plus the docs commit below). `commands/doctor.md:264`'s bare `references/personality/voice-dna.md` citation anchored as a pure `${CLAUDE_PLUGIN_ROOT}/` prefix insertion, no backticks added and no prose reworded, closing DEVIATION-271-03-A. `skills/doctor/SKILL.md` regenerated (1 mirror overwritten, `--check` OK 112/112). All 34 held files committed - 17 commands and 17 mirrors, 130 insertions / 62 deletions, every changed line proven to be an anchoring line, a declaration line or its provenance comment. **The commit ran the FULL pre-commit hook with `COMMIT_NO_VERIFY` unset and passed on its own**; the `mva-rule-linter` arm that refused this exact set at 271-03 now reads `compliant: 17 / missing: 0 / invalid: 0`. Anchoring gate `VIOLATIONS 0` at HEAD across all four surfaces; `tests/run-all-271.sh` PASS=4 FAIL=0 (was PASS=3 FAIL=1); `tests/run-all-267.3.sh` PASS=5 FAIL=0; `scripts/verify-release` 34 passed / 0 failed / 2 warnings, CLEAR TO RELEASE. **No promotion step was owed:** 271-05 wired 10c fail-closed from the start, so this wave only had to make the underlying condition true. `git diff HEAD~1 -- scripts/check-plugin-path-anchoring.cjs scripts/hooks/ scripts/verify-release` is empty, so GUARD-10 held. DEFERRED-271-D1 marked RESOLVED and DEVIATION-271-03-A marked applied; DEFERRED-271-D2 deliberately left OPEN and NOT absorbed

**Wave 5** *(blocked on Wave 4)*

- [x] 267.3-06-PLAN.md - Backfill batch A: 25 commands (`admin` through `mos`), classified against the ruled rubric with the scripting opt-out mechanically proven, human-ruled, applied and committed

**Wave 6** *(blocked on Wave 5)*

- [x] 267.3-07-PLAN.md - Backfill batch B: the final 25 commands (`mva-report` through `wiki`), driving the whole-tree audit to 0 missing / 0 invalid for the first time since Phase 118-06

**Wave 7** *(blocked on Wave 6)*

- [x] 267.3-08-PLAN.md - Close-out: promote the whole-tree audit to a fail-closed release gate proven against an A/B fixture, correct the rule doc's enforcement description, register GUARD-01..10, update ROADMAP/CHANGELOG/knowledge-base, file the rethinking-mindrianos compositing trail, and run the phase-wide no-relaxation audit

### Phase 268: Transition Selected Workflows to MCP Tools

**Goal:** Two workstreams.

**W1 -- Build the two already-confirmed candidates.** (1) `find-bottlenecks` / RS-engine -- currently a raw `node -e` shell-out to `lib/agents/reverse-salient-agent.cjs`, parsed from stdout, returning exactly one finding. Promote to a proper MCP tool with a real `outputSchema` (this repo's 36 existing tools declare zero `outputSchema`s per the Phase 265 MCP-layer audit -- this would be the first), consistent structured error handling instead of stdout-scraping, and Tri-Polar reach: callable from Desktop, Cowork, or any other MCP client, not just a Claude Code slash-command. (2) `eureka` -- currently a hand-rolled fire-and-poll pattern (fires one detached Node process, polls status up to 3 times over ~15s). The 2026-07-28 MCP spec ships a native Tasks extension (asynchronous execution of long-running operations, with polling, mid-flight input, and durable handles) built for exactly this shape -- rearchitect eureka onto the platform's own Tasks primitive instead of the hand-rolled poll loop. Explicitly OUT OF SCOPE: `find-connections` / cross-domain innovation -- analyzed and rejected this session as a weak case (thin sequential Brain queries where Larry's in-the-loop reasoning between queries is likely load-bearing).

**W2 -- Every command that RUNS CODE (shells out to a script/process), examined for the same switch, with a real designed MCP schema for each qualifier, not just a verdict.** Scope is narrower and more concrete than "all remaining commands" -- it is specifically the subset Scouts A/B/C already identified as "one Node/Python dispatcher script doing its own internal sequencing" or an equivalent code-shell-out pattern, since those are the commands with actual deterministic logic worth wrapping in a schema (the pure-conversational Larry-narrated methodology commands are NOT in scope here -- flattening those into a tool call would lose the thing that makes them work). Named candidates from this session's own audit, to be confirmed/expanded, not re-discovered from scratch: `whitespace` (8 subcommands, each one script invocation), `find-analogies` (already flagged, `scripts/analogy-fitness-report.cjs`), `diagnostics` (4 Python scripts), `doctor`, `dial-memory-refresh`, `feynman-timeline-refresh`, `dashboard`, `brain-derive`, `mva-brief`/`mva-option`/`mva-report`, `explain-decision`, `correct-reference-now`, `auto-explore`, `rs-fetch`/`rs-experts`/`rs-explain`/`rs-thesis`, `scout`, `vault`, `deep-grade`, `opportunities`, `agentshield`, `room`, `diagnose`, `dogfood-flush`, `new-surface`, `publish`, `present`, `pws-brain`, `intel-pipeline`, `graph`, `memory`/`memory-cortex-reach`, `scheduled-tasks`, `models`, `setup`.

For each: (1) confirm it genuinely runs code rather than just describing that it does, (2) if it qualifies, DESIGN the actual MCP tool -- a real input schema (what parameters it needs) and a real `outputSchema` (what structured result it returns), not a placeholder, (3) apply the token-cost rubric from W1's reasoning: the trade-off is not "MCP tool always costs tokens, command is always free" -- it depends entirely on the `alwaysLoad` choice, which is set per tool. A command's markdown body loads ZERO tokens until invoked (Claude Code's command system is lazy). An MCP tool registered `alwaysLoad: true` (as ALL 36 of this repo's existing tools currently are, ~7,062 tokens combined per the Phase 265 audit) pays its description+schema cost in EVERY session from turn 1 regardless of use -- the fixed tax that justifies `alwaysLoad` existing at all, worth paying only for tools genuinely needed early. A tool registered WITHOUT `alwaysLoad` costs close to nothing until the platform's own tool-search discovers it (deferred loading -- currently unused anywhere in this repo). So each qualifying candidate gets an explicit `alwaysLoad: true/false` call plus its estimated token cost, alongside its designed schema -- the deliverable is schemas ready to build from, not a bare promote/don't-promote list.
**Requirements**: TBD
**Depends on:** Phase 267
**Theo forward-compatibility (navigator ruling, 2026-09-02, standing rule -- CLAUDE.md):**
Theo's own architecture already widens its tool catalog to absorb the `mindrian-os` operational
surface into one server -- before this phase's research locks, check whether any command
promoted to an MCP tool here should be schema-designed with Theo's eventual single-catalog
shape in mind, so it does not need a second design pass at cutover.
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 268 to break down)

### Phase 269: Moat Shift -- Install/Update Entitlement Gate

**Goal:** Move the Brain/Theo access gate off per-query Brain-API-key checks entirely. Once Theo replaces the Brain (Phase 267 / Theo's own Phase 9), Theo access becomes unconditional for any installed MindrianOS user -- no personal key required, no trial-expiry refusal. The entitlement gate moves to a different action: installing and updating MindrianOS itself requires a valid key. Theo stays remote (never bundled -- this does NOT reverse decision #5's "remote by design"; it moves decision #1's "keyless session gets an honest refusal" from query-time to install/update-time). Navigator-locked 2026-08-27: "the key will be required to install and update mindrian... there will be no dependency on key to access [Theo]... it will be accessible to any mindrianOS user... we are shifting the moat."

**Concrete mechanism (navigator refinement, 2026-08-27):** the install page's existing Google-auth flow (`mindrian-website`'s `/brain-access`, Supabase `signInWithOAuth({provider:"google"})`) is repurposed. Today that flow's ONLY output is a Brain API key. Under this phase, the same Google-auth gate issues (or is extended to also issue) the install/update entitlement credential -- the general-access gate is now install-and-update, not Brain-specific. This directly touches the SAME auth-flow code this session already root-caused for Gaurav Thorat's double-sign-in finding (`components/brain/AuthButton.tsx`, `src/app/auth/callback/route.ts`, no canonical-domain redirect in `next.config.ts`) -- fixing that seam and building this gate are the same body of work, not two separate auth flows. Whether the install/update key REPLACES the Brain key outright or the two become one credential with two authorized uses is a decision for this phase's own planning, not decided here.

This requires reconciling, not silently editing: `.claude/includes/decisions.md` Key Decision #1 ("a keyless session gets an honest refusal, never a silent local substitute" -- currently checked at query-time, becomes install/update-time) and #5 ("Brain is remote by design, not optional by default" -- stays true, needs a clause noting per-query keys are gone); `.claude/includes/moat.md` (the moat reframes from "pay per graph query" to "pay for the install/update right" -- the graph itself becomes freely queryable once a user is in); and the personal-memory business-model note (`project_mindrianos_business_model.md`: "Free tier = prompt-Larry + Brain MCP; paid = trained Lawrence model" -- needs revisiting against the new model).

Cross-references: seeds directly into Theo's own `.planning/ROADMAP.md` Phase 9 ("Brain-Contract Cutover") open doctrine question -- "what happens to `brain_ask`/`brain_query`/`brain_search` (the three highest-traffic real callers, none contract-pinned)... no document currently states what happens to it at cutover" -- this phase's decision answers that directly: they become keyless/unconditional. Also touches Phase 234 (MindrianOS as Infrastructure: Skills, MCP Everywhere, Open Core) and Phase 267.1 (Hooked Model onboarding audit -- removing the key-friction step changes the onboarding Trigger/Reward/Investment legs). Directly resolves the Brain-key friction Gaurav Thorat's trial-install testimonial flagged (`docs/testers/gaurav-thorat/FEEDBACK.md`, the `rethinking-mindrianos` research trail).
**Requirements**: MOAT-01, MOAT-02, MOAT-03, MOAT-04, MOAT-05, MOAT-06 (phase-local working IDs minted at planning time; `.planning/REQUIREMENTS.md` carries no Phase 269 rows, so these are NOT yet backed by the project requirements doc and need formal registration)
**Depends on:** none technically, but sequenced after Theo's own Phase 9 gets a firmer timeline for the actual install/update-gate ENGINEERING (building a check against an interim cutover state risks throwaway work). The DECISION-RECORDING half (updating decisions.md/moat.md) can happen now via this phase's own planning. Verified 2026-08-27: Theo Phase 9 is blocked on Phase 8, Phase 8 on Phase 7, and Phase 7 is mid-execution at plan 07-02 of 12, so the gating condition is TWO unplanned phases away. Plans 01 through 04 are the executable decision-recording family; plan 05 is the deferred engineering family and is held behind a blocking human-action gate.
**Plans:** 5 plans in 5 waves

Plans:

- [x] 269-01-PLAN.md - Wave 0 test infra: `tests/269-doctrine-reconcile.test.cjs` + `tests/run-all-269.sh`, committed RED as the can-fail proof (commits `abfd3298`, `0a306a27`)
- [x] 269-02-PLAN.md - Reconcile `.claude/includes/decisions.md` rows 1 and 5 and add the commercial-boundary clause to `.claude/includes/moat.md` (commits `7069e2d6`, `30be509f`)
- [x] 269-03-PLAN.md - File the dated amendment record and the four cross-cutting flags (BUSINESS-MODEL-AND-MOAT.md, the personal-memory note, LICENSE grant (d), the Gaurav RCA gap) (commit `fdbcd8ca`) -- `bash tests/run-all-269.sh` now PASS=5 FAIL=0 SKIP=0
- [x] 269-04-PLAN.md - Blocking decision checkpoint: credential model A (replace) / B (unify) / C (promote install token), then record the choice. Navigator chose option-b (unify: one credential, two authorized uses); Q2 answered as refuse-to-operate, stays public. Recorded in `docs/AMENDMENT-2026-08-27-DECISIONS-1-AND-5-MOAT-SHIFT.md` (commit `621bf707`).
- [ ] 269-05-PLAN.md - DEFERRED engineering family: `autonomous: false` behind a blocking `checkpoint:human-action` on Theo Phase 9; produces specs only, zero entitlement-check code. Gate checked 2026-08-27 and did NOT clear: 3 of 6 preconditions fail (Theo Phase 9 and Phase 8 both still read `Plans: TBD`, Theo Phase 7 is mid-execution at plan 2 of 12, not completed). Tasks 2/3 correctly did not run -- reporting the block is this plan's designed success outcome, not a failure. See `269-05-SUMMARY.md` for the full six-item evidence table. Re-check once Theo's own ROADMAP.md Phase 9 no longer reads `Plans: TBD`.

### Phase 272: Phase 134 Real Remediation -- CJS Python Elimination Port

**Goal:** Phase 134 (source: `SEED-013`) was scoped to eliminate Python from the user-machine surface entirely -- replacing `scripts/*.py` HSI/reverse-salient analyzers (`compute-hsi.py`, `rs-engine.py`, `lib/core/rs_math.py`, `rs_corpus.py`, `rs_hybrid.py`, `rs_cache.py`, and 7 sibling whitespace scripts) with in-process `@huggingface/transformers`-based CJS modules (`lib/core/rs-engine.cjs`, `rs-math.cjs`, `hsi-*.cjs`, per Phase 134's own design table). Its 8 plans read COMPLETE in tracking, but the RCA filed this session (`.planning/debug/phase-134-python-elimination-false-complete.md`, severity: blocker) proves the CJS port code does not exist anywhere in the repo -- `134-01-SUMMARY.md` and `134-08-SUMMARY.md` are both `kind: summary-stub, generated_by: doctor --drift --fix (I001 auto-stub)`, a structural drift-checker satisfying "a SUMMARY file exists" without ever verifying "the plan's code was actually written." `requirements-hsi.txt` (PyTorch ~2GB + numpy + sklearn + requests) is still a real, live, required dependency today for 3 of the original 8 named commands (`/mos:find-bottlenecks` via `rs-engine.py`; `/mos:act` and `/mos:mos-reason` via `compute-hsi.py`; `/mos:diagnostics` partially, already self-healing) -- refined down from the RCA's original 8-command estimate, since `root-cause.md`, `systems-thinking.md`, `value-proposition.md`, and `new-project.md` were confirmed to have zero direct Python dependency (their grep hit was a next-command suggestion string, not an invocation).

This session (2026-08-27, goal-directed 265-271 sweep) shipped only the near-term mitigation ("Change 1", commit `5dce0a24`): wired the plugin's own already-shipped `scripts/lib/ensure_ml_deps.py` auto-installer into `compute-hsi.py` and `rs-engine.py`, matching the 6 sibling scripts that already had it. This makes the Python dependency self-remediating (`doctor --check-rs-engine --fix`) instead of a hard manual-pip-install wall, but does NOT eliminate Python -- Phase 134's actual, tracked, still-false objective. Two changes remain:

- **Change 2 (the real fix, this phase's primary scope):** the actual `@huggingface/transformers` CJS port per Phase 134's own design table -- `lib/core/rs-engine.cjs`, `rs-math.cjs`, `hsi-*.cjs` replacing the Python analyzers. `Xenova/multilingual-e5-large` running in-process; pure-JS math port for cosine similarity, LSA approximation, HSI scoring. This is real, roadmap-scale build work, not a follow-up commit -- do not underscope it as a quick patch.
- **Change 3 (process fix, prevents recurrence of the false-complete pattern itself):** `doctor --drift --fix`'s I001 auto-stub currently satisfies "a SUMMARY file exists" by writing a stub that reads identically to a real completion in any status rollup (ROADMAP.md, MILESTONES.md, `--acceptance`) that only checks file presence. Required: an auto-stubbed SUMMARY should propagate a visible UNVERIFIED/NEEDS-REVIEW flag into the phase's own rollup status instead of silently reading as equivalent to a real SUMMARY. Investigate `lib/core/drift-baseline.cjs`'s `stubMissingSummary()` (wired from `scripts/doctor.cjs`'s `--drift --fix` heal arm) as the likely fix site (already located, not yet touched, by the RCA).

Also carries forward, not yet done: SEED-013's own frontmatter needs a second correction pass (its 2026-07-14 self-correction fixed the seed's own status field but not Phase 134's plan/summary tracking one layer down -- same root pattern, one level deeper, unaddressed).

Cross-references: `.planning/debug/phase-134-python-elimination-false-complete.md` (`status: resolved-partial` -- kept open in `.planning/debug/`, deliberately NOT moved to `resolved/`, since Change 1 alone does not close a `severity: blocker` finding), `.planning/debug/knowledge-base.md` (Change-1 summary block filed 2026-08-27), `.planning/debug/python-requirements-orphan-deps-audit.md` (cross-linked, narrower hygiene scope, unaffected), `.planning/phases/134-cjs-port-of-python-analyzers-via-xenova-transformers-elimina/` (the original, falsely-closed phase -- this new phase does not silently reopen or renumber it; 272 is the real remediation, 134's own record stays as historical evidence of the false-complete pattern for Change 3's own fix to reference). Canon Part 6 (dog-fooding -- the plugin's own tracking told a false story about its own state) and Part 7 (reuse-before-build -- other seeds/phases reading Phase 134's status as ground truth is exactly the failure mode Part 7 exists to prevent) both apply.
**Requirements**: PYPORT-01, PYPORT-02, PYPORT-03, PYPORT-04, PYPORT-05, PYPORT-06, PYPORT-07 (phase-local working IDs, minted in `272-RESEARCH.md`'s Phase Requirements section 2026-08-31; registered complete in `.planning/REQUIREMENTS.md` at phase close by plan 272-11, per the Phase 273/CHOKE precedent)
**Depends on:** none technically. Sequenced after Phase 271 in this document only because it was registered during the same session, not because of a real dependency -- either can be planned/executed first.
**Plans:** 11/11 plans complete

Plans:

- [x] 272-01-PLAN.md -- Wave 0 test infra: `tests/run-all-272.sh` aggregator, the sklearn `svd_flip` sign-convention spike (pinned live against installed sklearn 1.8.0), and 5 fixed-input unit RED tests (tfidf parity, abs-diff top-k, direction convention, spectral, hsi-lsa algorithm)
- [x] 272-02-PLAN.md -- Wave 0 fixture room (90+ artifacts) + 20-pair probe corpus + ARPACK-regenerated Python baseline + measured noise-floor gate threshold + 2 RED integration tests (rs-engine contract, rank agreement)
- [x] 272-03-PLAN.md -- Wave 0 dispatch/infra RED tests: dispatch-chokepoint + rule6-amended acceptance greps, cache-probe/cache-location unit tests, Pinecone /embed unit test (mocked fetch)
- [x] 272-04-PLAN.md -- `rs-backend-dispatch.cjs` (D-04 flag chokepoint), `pinecone-inference.cjs` (D-01 /embed module), `embedding-spine.cjs` D-06/D-07 cache fixes
- [x] 272-05-PLAN.md -- `lib/core/numeric/svd.cjs` (deterministic truncated SVD + sklearn's verified svd_flip) and `lib/core/numeric/tfidf.cjs` (sklearn-compatible TF-IDF)
- [x] 272-06-PLAN.md -- `lib/core/rs-math.cjs`: full port of `rs_math.py` (Convention A, topic-keyword-membership signal)
- [x] 272-07-PLAN.md -- `lib/core/hsi-lsa.cjs` (Convention B, cosine-on-SVD) + `lib/core/hsi-spectral.cjs` (Markov/OMHMM spectral surface)
- [x] 272-08-PLAN.md -- `lib/core/rs-engine.cjs`: Mode A internal orchestration + REVERSE_SALIENT edge writes; generates and gates against the real candidate-cjs fixture (the phase's core numerical proof)
- [x] 272-09-PLAN.md -- `lib/core/hsi-engine.cjs`: Tier 1 orchestration (Tier 2 explicitly refused, not silently skipped)
- [x] 272-10-PLAN.md -- Wire the D-04 dispatch at all 3 real callers (reverse-salient-agent.cjs, intelligence-cascade.cjs, futures/orchestrator.cjs) + D-09 rule-6 amendment in both live copies, same commit
- [x] 272-11-PLAN.md -- Full regression gate (doctor --acceptance, build-connector-registry --check), PYPORT-01..07 registration in REQUIREMENTS.md, DEFERRED-SCOPE.md

### Phase 273: SQLite Graph Chokepoint Hardening (writeEdge silent-failure + propagation-gap fixes)

**Goal:** A `code-reviewer`-skill pass over the local SQLite graph layer (`lib/core/room-db.cjs`, `lib/core/navigation.cjs`, `lib/core/navigation/*.cjs`, `lib/core/node-insert.cjs`), run this session, found 5 Critical + 12 Major + 10 Minor issues, all grounded in file:line citations and 3 of the 5 Criticals empirically reproduced against this checkout. Full report: `specs/mindrianos-plugin_sqlite-graph-layer_code-review.md`. Verdict: Request Changes. A separate, independent spec-mining pass the same session (`specs/mindrianos-plugin_room-graph-memory_reverse_spec.md`) corroborates the same root weakness from a different angle (`room-birth.cjs`'s nested-`BEGIN` silently voiding `setFocus`/`confirmNode` during room creation) -- two independent analyses landing on the same class of bug is a strong signal, not a coincidence.

**The headline finding:** this repo's CLAUDE.md asserts "typed edges and `memory_event` nodes are written only through" `navigation.cjs` (the Part 9 chokepoint). `node scripts/check-substrate.cjs --baseline` on this checkout returns **208 violations** against a documented baseline of **195** (`docs/architecture/SUBSTRATE-BASELINE.md:26,285`) -- the claim is currently false by at least 55 raw-write sites. The guard only blocks violations a staged diff *adds*, so debt on existing lines accrues invisibly.

**The five Critical issues (all in the write path of the single chokepoint this architecture depends on):**

1. **C1 -- `writeEdge` (`lib/core/navigation/edges.cjs:833-842`) returns `ok: true` for a write silently discarded** by its own correct confirmed-row guard. `run()`'s `changes` count is never checked. Reproduced: a second write to the same edge returns `ok:true` and changes nothing. `room-birth.cjs:940-947` throws `nested_within_write_failed` only on `!ok`, so it cannot detect this.
2. **C2 -- `writeEdge` fails outright against any handle from `lazygraph-ops.openGraph`** (38 call sites, the most-used opener in the repo), because that opener never runs the Phase 224 migration that added the `review_status` column `writeEdge` unconditionally references. Reproduced: `table edges has no column named review_status`.
3. **C3 -- Brain-supplied edge types bypass the closed `ALLOWED_EDGE_TYPES` allowlist entirely.** `lib/core/navigation/ingestion.cjs:57` is a raw `INSERT OR IGNORE` that never passes through `writeEdge`, so a remote Brain response can mint arbitrary edge types into the local room graph. Also defeats the CI guard twice over (path allow-listed; `INSERT OR IGNORE` doesn't match the guard's regex either, see M3).
4. **C4 -- the busy-timeout fix CLAUDE.md pins the `node >=22.16.0` engine floor to is applied at 1 of ~20 `DatabaseSync` openers.** The unprotected ones include `lazygraph-ops.cjs:434` (most-used opener, 38 call sites) and the cross-session registry store `cross-room-store.cjs:68`, whose `withStore` wrapper silently swallows lock contention into a fallback value. Live-fire, not hypothetical, given this repo's own documented multi-session-sharing-one-tree operating reality (lived through this exact session).
5. **C5 -- a locked or corrupt `room.db` is misreported as `no_room_db`.** `spine-events.cjs`'s `_emit` already proves the file exists via `fs.statSync` before the catch block that reports `no_room_db` -- the only two errors reachable there are `RoomDbBusyError`/`RoomDbBrokenError`, neither of which means "no database." A momentarily-busy room reads as an empty cold-start room to the F-selector. Only 2 of 35+ `openRoomDb` call sites actually consume the typed errors Phase 236 (GRAPHDB-02) was built to provide; the rest still swallow.

**The reviewer's own framing, worth preserving verbatim as this phase's thesis:** "The underlying SQL craft is not the problem... What is missing is **propagation**: several of the good fixes here were applied at exactly one site and never carried to their siblings -- the busy timeout (1 of ~20 openers), the nested-transaction guard (1 of 9 `BEGIN` sites), the guarded `ROLLBACK` (1 of 4 migrations), the typed error consumption (2 of 35+ call sites), the `PRAGMA` schema probe (`nodes` but not `edges`). Closing that propagation gap, rather than writing new code, is most of the work." Highest-value single change per the review: make `writeEdge` `changes`-aware and add the same `PRAGMA table_info` fallback `node-insert.cjs` already uses for `nodes` -- closes C1 and C2 together, in one function.

**12 Major issues** (design/maintainability, not must-fix-before-anything): phantom `edge_id` never persisted (M1); the cross-room aggregation fence at `edges.cjs:45` is a comment, not enforcement -- the real fence is structural (`writeEdge` takes `(db, params)` and physically cannot open a second room's db) (M2); the substrate CI guard's regex misses `INSERT OR REPLACE/IGNORE INTO` entirely (M3); the 195->208 baseline drift itself (M4); every transaction uses `BEGIN` (DEFERRED) never `BEGIN IMMEDIATE` (M5); the nested-transaction `ownsTransaction` guard exists at exactly 1 of ~9 `BEGIN` sites, in `ranker-weights.cjs`, and was never propagated (M6); 3 of 4 migrations issue an unguarded `ROLLBACK` that can mask the real error (M7); `RoomDbBusyError`'s documented retry contract has zero implementations (M8); nothing asserts the Node >=22.16.0 floor at runtime (M9); unguarded `JSON.parse` on graph-sourced data can take down `buildBrainPacket`/`findRecentChanges` on one malformed row (M10); `lib/wiki/graph-links.cjs` interpolates SQL through a hand-rolled escaper outside the CI guard's Cypher-only scan (M11, not exploitable as written, still ungoverned); two competing schema authorities for `nodes`/`edges` depending on which opener touches a room.db first (M12, C2's root cause).

**Positive, for balance (do not lose this in remediation):** zero SQL injection anywhere in the primary review scope; the parameterized cross-room `ATTACH` in `graph-derivation.cjs` is exemplary (a real injection vector, found and closed, with the finding preserved in comments); Phase 236's failure classification (`room-db.cjs:94-227`) is described by the reviewer as "the best-grounded code in the module"; `lazygraph-ops.cjs`'s indexer-ownership allowlist is real data-loss prevention with the reasoning attached; `cross-room-store.cjs` shows what a real property/endpoint fence looks like (the model `edges.cjs` should follow for M2); migrations are sentinel-idempotent and defensively probed; test coverage is real (1184 files, a dedicated Phase 236 suite covering the hard cases).

Cross-references: `specs/mindrianos-plugin_sqlite-graph-layer_code-review.md` (the full report, Critical/Major/Minor + Questions for the author + Positive feedback sections), `specs/mindrianos-plugin_room-graph-memory_reverse_spec.md` (the corroborating spec-mining pass, its own U-1 finding on `room-birth.cjs`'s nested-`BEGIN`), `docs/architecture/SUBSTRATE-BASELINE.md` (stale at 195, needs regenerating per M4), Phase 236 (GRAPHDB-02, the typed-error work this phase's C5 finds under-consumed), the standing WATCH item `feedback_false_success_silent_skip_gates_academy_testers.md` (C1 and C5 are both textbook instances of that exact class).

**Prior-art cross-link (verified, not taken on trust):** `~/MindrianRooms/rethinking-mindrianos/research/2026-07-25-graph-query-time-collapse-sag-paper-sqlite-kg-crate/` and `.planning/seeds/SEED-074-local-graph-read-layer-lacks-salience-and-query-time-joins.md` diagnosed an ANALOGOUS but distinct failure class one month earlier: a langtalks-graph-expert read-time query (`query_relationship`) silently dropped real, existing edges because its BFS node-dump exhausted the token budget before any edge line printed -- the graph was built correctly, the READ path lost the data. Named in the literature as the SAG paper's (arxiv.org/html/2606.15971v1) "systematic decoupling between offline structure and online recall." **Related, not identical, to this phase's findings:** SEED-074's gap is read-time (query traversal degrading under budget/density pressure, no salience/clustering primitive); C1/C2 here are write-time (a write silently discarded, a schema mismatch silently failing). Same family -- a chokepoint that looks correct but data doesn't actually get through -- different mechanism and different fix shape. Worth the same discipline SAG argues for: propagate the fix pattern (typed check + explicit signal), not just patch the one reported symptom. SEED-074 stays gated (unfired -- checked live during this same session via `mcp__langtalks-graph-expert__get_entity`/`query_relationship`, corpus is healthy at 8,543 nodes/19,765 edges but `query_relationship`'s BFS-zero-edges bug reproduced again live on 4 of 5 fresh queries this session, `relationship_path`/`get_entity` remain the reliable point-to-point path per the standing hard rule) -- this cross-link does not fire it, just records the connection for whoever plans 273.

**A second prior-art candidate, verified live this session, DIFFERENT from the two crates SEED-074 already rejected:** `dpapathanasiou/simple-graph` (github.com/dpapathanasiou/simple-graph, MIT, 1,527 stars, updated 2026-08-25, checked via `gh api` -- schema and file contents read directly, not taken on a description). Unlike `sqlite-knowledge-graph` and `sqlite-graph` (both rejected in the 2026-07-25 note for requiring a compiled native SQLite extension per platform), `simple-graph` ships **zero compiled code**: a `sql/schema.sql`, a handful of `.sql` CRUD statements with qmark placeholders, and Jinja2 `.template` files for search/traversal, all pure SQL runnable from any language's stock SQLite binding -- exactly the "no native binaries" constraint that ruled the other two out. No official JS/Node port exists (bindings today: Python, Go, Julia, R, Flutter/Dart, Swift), but the SQL itself is language-agnostic and directly portable to `node:sqlite`.

Two concrete things worth Phase 273 planning time, verified by reading the actual files (`sql/schema.sql`, `sql/traverse.template`, `sql/insert-edge.sql`):

- **Schema:** `nodes(body TEXT, id TEXT GENERATED ALWAYS AS (json_extract(body,'$.id')) VIRTUAL NOT NULL UNIQUE)` -- the id is DERIVED from the JSON body, structurally impossible for id and body to drift apart. Directly relevant to M12 ("two competing schema authorities for nodes/edges, which schema a given room.db has depends on which opener touched it first") as a worked counter-example of a schema designed so there is only one thing to be a schema authority OVER.
- **Traversal:** `sql/traverse.template`'s single recursive CTE handles inbound (`target = x`) and outbound (`source = x`) as separate, explicit `UNION` branches selected by template flag, in one query. Directly relevant to U-2 (`findNearestSubRoomDecisions` silently walks only outgoing edges via `neighborhood.cjs`'s CTE, so a `NESTED_WITHIN` child->parent edge is structurally unreachable) -- this is what "handle both directions on purpose" looks like as real, working SQL, not a description of the gap.

Not a recommendation to adopt the library (no JS binding exists; the SQL would need porting). A reference implementation to plan against when 273 or SEED-074 gets to the schema-unification (M12) or bidirectional-traversal (U-2) fixes -- closer and more load-bearing than the two rejected crates were, because it is a pattern to port, not a dependency to reject.

**ICM fit, checked explicitly (per this repo's own `.claude/includes/architecture.md` Layer 0-4 model), not assumed:** `simple-graph`'s role, if ported, lands entirely inside ICM Layer 4 (Artifacts -- room entries as claims with cross-refs), as a possible re-implementation detail of the storage mechanism that already serves that layer. It does not touch Layers 0-3. Checked against this repo's actual `edges` schema (`lib/core/lazygraph-ops.cjs:177-183`), two things must NOT be ported as-is:

- **The FK constraints are a direct regression, not a neutral simplification.** `simple-graph`'s `edges` table hard-FKs `source`/`target` to `nodes(id)`. MindrianOS's own `edges` table DELIBERATELY carries no such FK, per its own in-code comment: "Phase 169 D-169-11: ... The room-lineage `NESTED_WITHIN` edge (source `room:<child>`, target `room:<parent>`) ... reference[s] ROOM node ids that are not always materialized as `nodes(id)` rows in the same db (a child room node lives in the child's db, not the parent's)." Porting the FK constraint verbatim would re-break the exact cross-room fractal-forest bug Phase 169 already fixed. Any adoption of `simple-graph`'s schema ideas must drop the FK, keep the D-169-11 comment's reasoning, and only enforce `(source, target, type)` uniqueness locally, same as today.
- **`review_status` (and the Phase 109/160/224 provenance/bitemporal columns) must stay real columns, not fold into `properties`.** `simple-graph`'s edges carry only an optional untyped `properties` JSON blob, no status/validity concept at all. ICM Layer 4 is explicitly "claims WITH VALIDITY STATUS", and Canon Part 9 requires a human to confirm a truth-claim node -- that is a first-class column this repo's schema already has and `simple-graph`'s does not. Folding it into `properties` would be a real regression against both the ICM definition and Canon Part 9, not a simplification.
- **What it does NOT inform at all: the cross-room forest.** `simple-graph` is a single-file, single-database graph -- it has no concept of the N-stores-not-one problem (a nested forest of per-room `room.db` files, `rollupSubRooms`'s cross-room `ATTACH`, the aggregation fence at `edges.cjs:45`) that is this repo's actual hardest and most distinguishing local-graph problem, per the 2026-08-27 memory-context-operator research trail's own "Theo analogy: explicitly rejected" section. Useful strictly for the WITHIN-one-room schema/traversal shape (the id-generation column, the bidirectional CTE); contributes nothing to the forest-of-rooms problem, which stays MindrianOS's own architecture to solve.

**Verdict: fits Layer 4 as a within-room storage-pattern reference, with two named modifications required before any porting (drop the FK, keep review_status as a real column) and one explicit non-fit (does not address the cross-room forest).** Not a wholesale schema swap-in.

**SEED-075 registered (2026-08-27), gated hard on this phase landing first:** `.planning/seeds/SEED-075-icm-semantic-substrate-provenance-dependency-graph.md` -- a navigator-proposed provenance/dependency/versioning sidecar (disposable SQLite under ICM's canonical filesystem, never replacing it), directly extending Section 6 of this repo's own already-cited founding paper (Van Clief & McDermott 2026, arXiv 2603.16021, cited in `docs/MWP-SPECIFICATION.md:15,25,532`) -- the paper's own words: "ICM currently provides observability but not traceability." Verified independently before filing (paper fetched and read in full, existing `packet.cjs`/decisions.md mechanisms checked against live code, not assumed). Explicit sequencing: do not start SEED-075 before this phase's 5 Critical bugs are fixed -- a provenance graph built on an unreliable write chokepoint inherits that unreliability invisibly. Full trail: `~/MindrianRooms/rethinking-mindrianos/research/2026-08-27-icm-semantic-substrate/`.

**Sibling SEED-076 registered (2026-08-28):** `.planning/seeds/SEED-076-room-walk-test-and-pattern-confirmation-threshold.md` -- checked `github.com/RinDig/icm-architect` (a community reference implementation of the same paper) against a real room; confirmed MindrianOS's room design already matches the tool's validated "Record library" form and independently validates Phase 271/274's reference-integrity approach and Phase 270's OQ-7 drift finding. One confirmed gap (the walk test fails for a tool-less foreign host), one already-built mechanism that should not be silently re-proposed (`memory_event` IS the durable-event-log pattern), and one open reuse-check (whether an N-occurrence pattern-confirmation gate already exists -- read before building). Not a build mandate; validation and vocabulary, one real open question.

**Sibling SEED-084 registered (2026-08-28):** `.planning/seeds/SEED-084-enlarge-room-schema-layered-icm-structure-plus-notion-gap-close.md` -- three independent sources (a Notion "Problem Worth Solving" template diff captured 2026-04-14 in `PROJECT.md`, this session's live icm-architect audit, and Phase 270's OQ-7) converged on the same structural gaps (no first-class `funding/` section, no self-guiding room, no always-visible per-section statement). Proposes enlarging the room schema by LAYER (icm-architect's L0-L4 hierarchy, which `MindrianRooms/CLAUDE.md` already claims but no room implements past L0/L1) rather than as a flat item list, using SEED-075's Feynman-Minto grounding for the L2 contract's Human-check and the PWS 22-task workbook's task shape as the L2 contract template. Surfaces, does not resolve, an open question: three different stage-taxonomy vocabularies (Brain's `InnovationStage` zones, the 22-task workbook's problem-type ladder, and the ad-hoc `venture_stage` strings actually in use) need reconciling before the L3 reference layer can cite one canonically.
**Requirements**: CHOKE-01, CHOKE-02, CHOKE-03, CHOKE-04, CHOKE-05, CHOKE-06
**Depends on:** none technically. Independent of Phase 272 (different subsystem: 272 is the RS-engine Python-to-CJS port, this is the SQLite write chokepoint) despite being registered the same session -- either can be planned/executed first. Not blocking or blocked by Phase 271.
**Plans:** 5/5 plans complete

Plans:

- [x] 273-01-PLAN.md -- Wave 0 verification harness: tests/run-all-273.sh, C1 + C2 RED tests (completed 2026-08-31)
- [x] 273-02-PLAN.md -- Wave 0 completion: C3 + D-04 + D-05 RED tests
- [x] 273-03-PLAN.md -- C1+C2 fix (writeEdge changes-aware + PRAGMA fallback) plus M2 comment sweep
- [x] 273-04-PLAN.md -- C3 fix (ingestion.cjs inline ALLOWED_EDGE_TYPES allowlist guard)
- [x] 273-05-PLAN.md -- Phase close: substrate baseline reconciliation, full regression, REQUIREMENTS.md registration, dev-research mirror

### Phase 274: Bare `scripts/` Invocation Anchoring (the adjacent class Phase 271 measured and did not fix)

**Goal:** Phase 271 fixed one resolution-mechanism defect (`references/...` citations resolving against session cwd instead of the plugin install dir) and MEASURED a second, adjacent one over the same four surfaces without fixing it: **34 unanchored `bash scripts/<name>` / `node scripts/<name>` invocation sites** that resolve against the user's cwd exactly the same way. Measured live by `node scripts/check-plugin-path-anchoring.cjs --report --include-scripts`, split **30 commands / 3 hand-authored skills / 1 agent / 0 pipelines**, plus **1 deliberate exclusion**. Named evidence, not a vague pointer: three of the 34 sit in `commands/file-meeting.md` at lines 771, 978 and 983 (all `node scripts/wikilink-file.cjs`), which is the proof that the originating RCA's references-only fix did not make even its own file portable. The single exclusion is `commands/status.md:13`, `- Bash(node scripts/mos-status.cjs:*)`, an `allowed-tools` frontmatter permission matcher, which DECLARES a pattern and never resolves a path, so counting it would be a false positive; the gate prints the exclusion count rather than swallowing it, so a future reader can see a suppression happened and how many.

**Why 271 deliberately did not fix this (do not re-litigate as an oversight):** a `Read` citation and a `Bash` invocation fail differently and need different verification. A citation fails silently and quietly degrades the model's output; an invocation fails loudly with a shell error, and some of these invocations are dev-only by design in the same way `/mos:radar` is (see `FOLLOWUP-271-R1` below). Verifying an anchored `Bash` line means actually RUNNING it on all three surfaces (CLI, Desktop, Cowork), which is a different and heavier verification burden than diffing a path prefix. Mixing 34 invocation changes into a 134-site citation sweep would have made the diff unreviewable and put a genuinely different risk profile behind a single green check.

**The generalizable lesson this phase should apply, from `271-AUDIT.md` and the room mirror:** this will be the THIRD pass at the same disease class in this repo. `.planning/debug/resolved/intern-w1-rooms-skill-script-path.md` fixed `bash scripts/<name>` in 11-12 SKILL.md files; `.planning/debug/resolved/file-meeting-missing-reference-files.md` fixed `references/...` in one command; Phase 271 swept `references/...` repo-wide. Every one of them was scoped **by grep pattern rather than by resolution mechanism**, which is precisely why each left the other pattern untouched. Scope this phase by the mechanism it repairs (every unanchored plugin-relative path, whatever token follows), not by the string that happened to surface it, or a fourth pass will be needed.

**Also carries `FOLLOWUP-271-R1`** (registered here by plan 271-05, previously code-only): split `/mos:radar` into a dev-only `--fetch` write path and a user-safe anchored read path. Owner: repo navigator (the human who ruled `option-d`). Residual risk: `commands/radar.md` lines 51, 52, 95 and 99 are pure READS reached by plain `/mos:radar` (Step 2) and `/mos:radar --domain` (Step 4), so a user invoking either from their own Data Room hits exactly the file-meeting failure. It belongs here rather than in a phase of its own because it is the same read/write-path-split question this phase must answer for the dev-only `scripts/` invocations. **The naive fix is `option-b` and `option-b` is worse than doing nothing:** anchoring only the reads splits one file's citations of the SAME file across two resolution bases, so after a `--fetch` the summary a user reads would never be the summary just written. It lives in code at `REGISTERED_FOLLOWUPS` in `scripts/check-plugin-path-anchoring.cjs`, where `validateAllowlist()` throws at module load on a dangling id, so the exception and its owed work cannot be separated.

**Requirements**: ANCHOR-01, ANCHOR-02, ANCHOR-03, ANCHOR-04, ANCHOR-05, ANCHOR-06, ANCHOR-07, ANCHOR-08, ANCHOR-09, ANCHOR-10
**Depends on:** Phase 271, which measured this class and left behind the ready-made measuring instrument: `node scripts/check-plugin-path-anchoring.cjs --report --include-scripts` (the advisory tier NEVER affects the gate's exit code, so this phase must decide whether to promote it to a hard gate as part of its own close-out, the way 271-05 wired the citation tier into `scripts/verify-release` gate 10c). Not blocked by Phase 271's CLOSED-PARTIAL status: the 31 residual `references/` sites are blocked on Phase 267.3 and touch a different token, so this phase can be planned and executed independently. Re-run the instrument at plan time and do NOT assume the 34 above is still live.
**Plans:** 6/6 plans complete

Plans:
**Wave 0**

- [x] 274-01-PLAN.md (wave 0) - Extend check-plugin-path-anchoring.cjs's script tier (widened predicate, anchored/allowlisted/target classification, --check-scripts mode) plus the Wave 0 fixture suite and CLI runtime smoke test (ANCHOR-01, ANCHOR-07, ANCHOR-08)

**Wave 1** *(three parallel plans, zero files_modified overlap)*

- [x] 274-02-PLAN.md (wave 1) - Command sweep batch A: bono, causal, export (incl. the python3 render-pdf site), file-meeting, find-analogies, intel-pipeline, mos-reason (ANCHOR-02)
- [x] 274-03-PLAN.md (wave 1) - Command sweep batch B: mva-brief, new-surface, publish, room, skill, snapshot, vault (ANCHOR-02)
- [x] 274-04-PLAN.md (wave 1) - Hand-authored skills (long fail-closed form) and the 1 agent site (short form), plus SCRIPT_ALLOWLIST entries and FOLLOWUP-274-R1/R2 registration for the status.md matcher drift and the help.md/eureka.md fallback-convention question (ANCHOR-03, ANCHOR-04, ANCHOR-06)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 274-05-PLAN.md (wave 2) - Mirror regeneration (build-skill-mirrors.cjs) and full sweep verification / live count reconciliation (ANCHOR-02, ANCHOR-05)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 274-06-PLAN.md (wave 3) - Gate 10f wiring into scripts/verify-release, REQUIREMENTS.md registration, CHANGELOG/ROADMAP/knowledge-base close-out, and the dev-research compositing trail (ANCHOR-09, ANCHOR-10)

**Outcome:** all 6 plans landed; the full sweep is verified green (`bash tests/run-all-274.sh`
PASS=4 FAIL=0, `scripts/verify-release` clean end to end including the new gate 10f) and the
class is now structurally blocked at release time, not just cleaned up once. Two items were
deliberately measured and registered rather than fixed in this phase:
**FOLLOWUP-274-R1** (the `commands/status.md` `allowed-tools` matcher still reads the pre-274
bare form while the command body underneath it is already anchored -- a pre-existing,
low-severity permission-prompt drift, not a functional failure; owner: repo navigator, since
confirming whether an anchored `${...}`-bearing matcher pattern matches correctly in Claude
Code's own matcher engine could not be done safely without guessing) and
**FOLLOWUP-274-R2** (whether the newer fail-closed `${MINDRIAN_OS_ROOT:-${CLAUDE_PLUGIN_ROOT:?...}}`
form should supersede the older `./scripts/...` cwd-relative fallback convention used in
`commands/help.md` and `commands/eureka.md` -- a design question, not a defect; owner: repo
navigator). Both are registered in code at `REGISTERED_FOLLOWUPS` in
`scripts/check-plugin-path-anchoring.cjs`, where `validateAllowlist()` throws at module load on
a dangling id, so neither can be silently dropped. **D-02's Tri-Polar gap, stated explicitly:**
verification on the CLI surface includes both static path-correctness AND an actual runtime
smoke test (`tests/smoke-274-cli-invocation.sh`); Desktop and Cowork get the SAME static
path-correctness check applied to their invocation sites, but NO automated runtime execution
proof on those two surfaces -- a deliberate, named call per this repo's own Tri-Polar Design
Rule, not a silent omission, since no automation harness exists for either surface today.

### Phase 275: Enlarge Room Schema by ICM Layer (Notion Gap-Close + icm-architect Audit Convergence)

**Goal:** Promote `.planning/seeds/SEED-084-enlarge-room-schema-layered-icm-structure-plus-notion-gap-close.md` (proposed 2026-08-28) to a numbered phase. Three independent sources, four months apart, converged on the same structural gaps in every room this plugin scaffolds: a 2026-04-14 diff against a third-party Notion "Problem Worth Solving" template (`PROJECT.md`'s "Notion Template Gap Close"), the `icm-architect` skill's live audit of `launchpad-02` (SEED-076), and this repo's own Phase 270 OQ-7 (`funding/` has no real identity; `team-execution`'s `SECTION_METADATA` is thin unstructured prose against real Mentor-Profiles usage). Three occurrences of the same class of finding from three different methods is the "pattern, not gripe" bar for promoting a signal, per this repo's own `forms.md` Context-map form.

**The proposal (full detail in SEED-084, do not re-derive here):** enlarge the room schema **by LAYER**, not by flat item list. `MindrianRooms/CLAUDE.md` already claims the icm-architect L0-L4 hierarchy (identity / routing / contracts / reference / artifacts) but no room implements it past L0/L1. This phase builds the claimed layers for real: L1 gets a per-section `STATEMENT` (the one sentence always true, always visible) plus a stable room-root pointer for the self-guiding-room gap; L2 gets the missing per-section `CONTEXT.md` contract (what the section reads/does/writes, populated with SEED-075's Feynman-Minto Human-check, using the PWS 22-task workbook's task shape as template); L3 gets a genuinely new `references/`/`_shared/` folder per room (taxonomy, brand/voice, section schema) that today only exists claimed at the fleet root; L4 gets SEED-076's inline-content drift fixed. The Notion-diff section-set changes (`marketing-sales/` split from `market-analysis/`, `funding/` promoted to first-class, `value-proposition/` as its own top-level section) are the L4/L0 consequence of doing the layering properly, not a separate ask — do them in the same pass.

**Gated, not ready to plan yet.** Two conditions from SEED-084 itself, one now cleared:

1. **RESOLVED 2026-09-02.** The taxonomy open question this seed surfaced but did not resolve:
   three vocabularies coexist for "what stage is this venture" - Brain's `InnovationStage` zones
   (Discovery/Focus/Proof/Creation/Launch), the PWS problem-type ladder (Un-Defined/Ill-Defined/
   Well-Defined + Wicked escalation), and the ad-hoc `venture_stage` strings actually written
   into rooms (`INDEX.md`: "Investment", "Pre-Opportunity", "Discovery", "Validation", "Design",
   "QA"). Ruling: these are three distinct axes, not one taxonomy - problem-type is L1 routing,
   `venture_stage` is L0 identity whose SCHEMA (not its per-room value) belongs at L3, and Brain
   `InnovationStage` has zero runtime consumers in this repo today. Full ruling, grounding, and
   research trail: SEED-084's `## ADDENDUM 2026-09-02` section.

2. **Phase 270's OQ-7 — PARTIALLY RESOLVED 2026-09-04.** OQ-7 has two sub-points; they resolved
   differently:

   - The SCHEMA half is now CLOSED, no navigator sign-off needed to plan against it: SEED-084's
     `## ADDENDUM 2026-09-04` found `SECTION_METADATA`'s `default_methodologies` array
     (`lib/core/room-skeleton-scaffold.cjs:47-55`) is the same kind of L3 fact as
     `stage_relevance` — promote both in the same pass, at both the section grain and the
     `data/room-blueprints.json` family grain. Grounding this also found a real, verified defect
     in scope for this phase's own work: 2 of the 10 `default_methodologies` slugs
     (`domain-explorer`, `scenario-analysis`) match zero command in the live
     `data/command-registry.json` — dead references from an upstream rename never propagated
     (the propagation-gap shape Phase 273/276 already named), fix in the same L3 pass.

   - The SECTION-ADOPTION half — which of the 5 Notion-diff candidate sections (Meetings, Value
     Proposition, Marketing and Sales, Funding Options, Research Documents) actually get added to
     the frozen 8-entry `SECTION_NAMES`, plus the `team-execution` Mentor-Profiles schema
     thickening — is STILL OPEN. This changes what every future room is scaffolded with (a Canon
     Part 3 Tri-Context-Gate-weight call), so it stays a navigator Decision Gate rather than
     something this addendum settles unilaterally. A grounded recommendation is on record
     (favor `funding-options` as the highest-evidence single addition — three independent sources
     converge on it, live-audited as a bare empty shell today; weigh the other four
     individually, not as a bundle).

**MANDATORY (navigator ruling, 2026-08-31): langtalks-graph-expert must be consulted CONTINUOUSLY throughout every stage of this phase's lifecycle** — discuss, research, plan, and execute — not as a one-time check at research time. This phase is memory/context-engineering/agent-architecture work (layered context hierarchy, per-section contracts, a reference/factory layer) squarely inside `langtalks-graph-expert`'s corpus (memory, RAG, knowledge graphs, context engineering, agent protocols). Every plan this phase produces, and every task within those plans that touches the layer design, must show a live `mcp__langtalks-graph-expert__*` consult in its `<read_first>` or task notes, not just a passing citation. This is IN ADDITION TO, not instead of, the existing standing `icm-architect` consult (`feedback_mindrianos_dev_consult_icm_architect.md`) — both apply, langtalks for the memory/context-engineering literature grounding, icm-architect for the concrete room-structure validation (ten invariants, six-forms taxonomy, walk test).

**What NOT to steal / re-propose (Canon Part 7, per SEED-084):** `lib/core/room-skeleton-scaffold.cjs` and `lib/core/section-registry.cjs` already implement schema-driven section scaffolding — this phase EXTENDS their schema, it does not replace the mechanism. `/mos:onboard` and session-start nudges already partially cover the self-guiding-room gap for the CLI/Larry path; the real gap is the foreign-host-without-tools case specifically.

**Requirements**: ICML-01 .. ICML-16 (minted at plan time 2026-09-04; written into `.planning/REQUIREMENTS.md` by plan 275-08, the phase-close plan)
**Depends on:** none remaining — Phase 270's OQ-7 is FULLY RESOLVED 2026-09-04 (both the schema half and the section-adoption half; see SEED-084's `## RULING 2026-09-04`, `## ADDENDUM 2026-09-04g`, and `## ADDENDUM 2026-09-04j`). Navigator decision, all sourced against Brain + Theo + the actual 2026-04-14 Notion primary source: adopt `opportunity-bank`, `funding`, and `strategy` into `SECTION_NAMES` (8 → 11); `value-proposition` stays sub-structure inside `business-model`; `meetings` needs no change (already correctly modeled as a structural dir, not a section); `marketing-sales` and `research-documents` deferred (real intended content per the primary source, just never built — worth re-raising at planning time, not yet evidenced in code). `/gsd-plan-phase 275` is UNBLOCKED and can run.
**Theo forward-compatibility (navigator ruling, 2026-09-02, standing rule -- CLAUDE.md):** the
taxonomy open question this seed surfaces (which "venture stage" vocabulary is canonical) is
exactly the kind of schema-direction question Theo's own graph-rulebook governs for its own
labels -- when this phase becomes actionable, check whether Theo has already settled an
analogous vocabulary question before re-deriving one locally.
**Plans:** 8/8 plans complete
Plans:
**Wave 1**

- [x] 275-01-PLAN.md - the section tables: SECTION_NAMES 8 to 11, three new SECTION_METADATA entries, the L1 statement field, all seven propagation-gap citation corrections, section-registry promotion, blueprint data and CI gate (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 275-02-PLAN.md - the three ICM layer mechanisms in the scaffold: L1 statement render, L2 per-section CONTEXT.md writer, L3 references/ factory directory writer (wave 2)
- [x] 275-03-PLAN.md - de-duplicate the two runtime SECTION_NAMES mirrors (room-birth.cjs, grade-grant.cjs) onto the scaffold export (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 275-04-PLAN.md - reconcile the seven stale count assertions, keeping the single-legitimate-home rule test-270-baseline-schema-driven.cjs names by file and line (wave 3)
- [x] 275-05-PLAN.md - the L2 contracts for the 8 original sections, including the solution-design moat check cross-linked to competitive-analysis (wave 3)
- [x] 275-07-PLAN.md - the two L3 reference documents: SECTION-SCHEMA.md (venture_stage axis, both methodology grains, the precedence rule) and SUB-SCHEMAS.md (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 275-06-PLAN.md - the L2 contracts for the 3 new sections, including the opportunity-bank to funding pipeline in both directions and the dilutive/non-dilutive scope (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 275-08-PLAN.md - the idempotent additive migration for existing rooms, the phase assertion suite, run-all-275.sh, and the REQUIREMENTS.md block (wave 5)
