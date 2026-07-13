# Phase 221: Pipeline-Wide High-Effort LLM Engine Recovery - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning
**Mode:** --auto (navigator pre-approved the full run to the joint cut; decisions derive from 221-SPEC.md + the binding annex)

<domain>
## Phase Boundary

Typed stage envelopes replace failure-to-empty across the research-pipeline adapters; a 6-tier recovery ladder + bounded LLM recovery controller (case-filed, fenced, gate-offered) recover intelligence when engines break; result semantics disclose everything; the joint 219+220+221 version cut executes as this phase's final act.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**6 requirements are locked.** See `221-SPEC.md`. Downstream agents MUST read it plus `221-INPUT-MANUS-RECOVERY.md` (the binding annex - where they disagree, SPEC wins).

**In scope:** typed envelopes + injection harness; recovery dispatcher + tiers; bounded controller + case file + profiles; result semantics + docs + vantage fixture; failure-injection suite; joint release execution (READMEs + mindrian-os.com updates included).
**Out of scope:** parallel research stack; autonomous graph mutation; continuous crawling; broad formats; model-name-pinned governance; envelope adoption beyond the research pipeline + 219/220 seams.

</spec_lock>

<decisions>
## Implementation Decisions

### Envelopes first (the implementation-priority decision)
- **D-01:** Wave order is envelopes -> injection harness -> dispatcher/tiers -> controller -> semantics/docs -> release. The controller is built LAST so it receives observable typed failures, never undefined behavior.
- **D-02:** Envelope adoption touch-list (verify at plan time): lib/core/research-corpus.cjs adapters (the verified empty-collapse), lib/lens-engine/source-lens-driver.cjs per-provider results (extends 219-05's additive {status,reason,counts,freshness}), the 219/220 seams (exploreOpportunity/queryRoomCorpus/url-ingest) which ALREADY return research_mode - 221 aligns them to the full envelope additively, no breaking change.

### Dispatcher + tiers
- **D-03:** The recovery dispatcher lives beside the source-lens orchestration (adapter layer), consumes typed failures, resumes at the failed stage boundary. Tier-1 retries idempotent ops only (fetches yes, writes no). Tier-2 substitutes ride 219's room-corpus provider + research-cache with explicit provenance.
- **D-04:** Tier-3 trigger discipline is code, not judgment: typed failure / contract violation / implausible coverage (declared thresholds) / required-stage timeout. empty_valid NEVER triggers. In cadence/background contexts (scout, crawl loop) Tier-3 is SKIPPED - terminate honestly (Part 3: no unattended LLM cost).

### Controller
- **D-05:** One module (lib/core/recovery/ home, planner picks exact layout) implementing the 7-step state machine + persisted case file under the run's .mindrian workspace; profiles diagnostic|high_effort|forensic; forensic prohibits mutation and emits a human review packet.
- **D-06:** Hard fences are TESTS, not comments: egress-audit un-weakenable (policy_blocked path), unknown-never-zero, writer-bypass impossible (grep + behavioral), readback-truth (file-evidence-readback.cjs is the only filing authority), injection-as-data. Capability-based model selection recorded in the attempt ledger.
- **D-07:** On MATERIAL surfaces the Tier-3 offer reuses 219's D-20 gate semantics (the [LLM manual/high-effort] verb pattern) - one doctrine, two phases, zero duplication.

### Semantics + docs
- **D-08:** research_mode + outcome enums extend the 219-shipped enum ADDITIVELY. Disclosure fields per the annex section 6. commands/research.md + skill mirror document all modes (doc-parity test). The vantage fixture (authoritative_workspace_unavailable) ships as a permanent named test.
- **D-09:** If any doctor check is added it is a registry module (217 rule). Run-ledger telemetry is LOCAL (Part 8).

### The cut (REQ-6)
- **D-10:** Final wave (autonomous: false at the cut gate): verify 219 readiness (corepower confirmation recorded) + 220 readiness + all 221 gates; assemble the joint CHANGELOG entry from the staged drafts (219-RELEASE-STAGING.md + 220's staging); refresh ALL READMEs content-only (repo README.md primary; any feature-touched surface docs); update mindrian-os.com in the relevant locations (new capabilities: opportunity follow-through, web ingestion, engine recovery) + reconcile every hand-typed version string (VERSION-BUMP discipline); then scripts/release.sh <version> (default next increment on the current line per D-14) + npm publish + marketplace source.ref pin; record everything in 221-VERIFICATION.md. Website repo location resolved at execution (pws-website room / canonical web surface per the standing single-surface rule).

### Claude's Discretion
- Exact failure_class enum values per stage; envelope field naming alignment with 219's shipped fields; case-file directory naming; injection-harness env-var scheme (mirror MINDRIAN_FORCE_* precedents).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/phases/221-llm-engine-recovery/221-SPEC.md` - locked requirements
- `.planning/phases/221-llm-engine-recovery/221-INPUT-MANUS-RECOVERY.md` - BINDING annex (tiers, envelope, taxonomy, controller, profiles, semantics, matrix)
- `.planning/phases/219-*/219-CONTEXT.md` D-16..D-21 + `.planning/phases/219-*/219-05-PLAN.md` (the D-19 envelope beginnings + drift fix 221 extends)
- `.planning/phases/220-*/220-CONTEXT.md` D-07/D-10 (envelope consumption + manual rung)
- `lib/core/research-corpus.cjs` + `lib/lens-engine/source-lens-driver.cjs` - the fix targets (verified empty-collapse)
- `lib/core/navigation/file-evidence-readback.cjs` - the filing-truth authority (verified present)
- `docs/MINDRIAN-CANON.md` Parts 3/7/8/9/11; `.claude/includes/release-process.md` + `scripts/release.sh` + `scripts/verify-release` - the cut
- 219-RELEASE-STAGING.md + 220's staging artifact (produced by their final waves) - the cut's inputs

</canonical_refs>

<code_context>
## Existing Code Insights

- 219 ships: research_mode enum, per-provider status beginnings, drift fix, unknown-never-zero components, D-20 gate-offer pattern, run-all harness convention, MINDRIAN_FORCE_* injection precedents (FTS_ABSENT, ENGINE_ABSENT)
- 220 ships: ingestion ladder with typed provider_unavailable, content-hash idempotency, SUPERSEDES lineage
- Capability-probe discipline (vec0/FTS5) = the Tier-0/1 boundary precedent
- One governed reach path + frozen deep_research reach = the controller's only web lane

</code_context>

<specifics>
## Specific Ideas

- Navigator: "make sure we have a fallback plan using the LLM as high effort to do the intelligence work with fetching if the engine breaks" - generalized here per the Manus architecture.
- Navigator pre-approval (2026-07-13): run through 221 + full cut, updating all READMEs and mainly the Mindrian website in relevant locations. Corepower Desktop validation remains the one navigator-run gate before the cut.

</specifics>

<deferred>
## Deferred Ideas

- Envelope adoption for eureka/doctor/meeting pipelines (follow-on)
- Forensic-profile deep tooling (lineage reconstruction UI)
- Recovery telemetry aggregation across rooms (portfolio view)

</deferred>

---

*Phase: 221-llm-engine-recovery*
*Context gathered: 2026-07-13*
