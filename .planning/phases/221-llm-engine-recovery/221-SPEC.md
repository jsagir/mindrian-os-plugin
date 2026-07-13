# Phase 221: Pipeline-Wide High-Effort LLM Engine Recovery -- Specification

**Created:** 2026-07-13
**Ambiguity score:** 0.16 (gate: <= 0.20)
**Requirements:** 6 locked

## Goal

Any registered engine failure in the research pipeline becomes a typed, recoverable event instead of a silent empty: common stage envelopes distinguish ok / empty_valid / degraded / failed / blocked; a 6-tier recovery ladder routes failures (deterministic retry -> local governed substitute -> gate-offered high-effort LLM recovery -> human -> honest termination); a bounded LLM controller does the recovery intelligence while deterministic validators, privacy gates, human gates, and transactional readback retain ALL authority - and the phase ends by EXECUTING the joint 219+220+221 version cut.

## Background

Verified (Manus, confirmed against lib/lens-engine/source-lens-driver.cjs + lib/core/research-corpus.cjs): several provider failures (missing key, timeout, HTTP, parse, Brain) collapse into identical empty arrays - the orchestrator cannot distinguish a legitimate empty finding from a dead engine, so no intelligent recovery is possible. Phase 219 fixed the seam locally (D-19 envelope on exploreOpportunity/queryRoomCorpus + the drift fix); Phase 220 consumes it for ingestion. Phase 221 generalizes: typed envelopes across the research-pipeline adapters, a recovery dispatcher, and the bounded LLM controller - the generalization of 219's D-20 per-surface manual rungs into an architecture. lib/core/navigation/file-evidence-readback.cjs (verified present) is the filing-truth authority. Binding input: the navigator-supplied Manus recovery architecture + decision note (annexed at 221-INPUT-MANUS-RECOVERY.md); implementation priority is envelopes FIRST, so the controller receives observable failures, not undefined behavior.

## Requirements

1. **Typed stage envelopes + failure injection**: The research-pipeline adapters return the common contract.
   - Current: research-corpus adapters + source-lens driver collapse failures to empty arrays (verified); no failure-injection harness exists
   - Target: every stage result carries {stage, engine, status: ok|empty_valid|degraded|failed|blocked, failure_class, retryable, attempt, input/output fingerprints, provenance, warnings, payload, error}; empty_valid is DISTINCT from failed; blocked covers policy/credential/human-gate; a deterministic failure-injection harness (env-var driven) can force each failure class per stage
   - Acceptance: fixture test per failure class proves the typed envelope surfaces (missing key != timeout != legitimate empty); zero adapters still return bare [] on failure; injection harness toggles each class deterministically

2. **Recovery dispatcher + tier ladder**: Typed failures route through the 6-tier order with trigger discipline.
   - Current: no dispatcher; failures dead-end
   - Target: tiers 0-5 codified (normal -> bounded idempotent retry -> local governed substitute [room corpus/cache/snapshots, never mislabeled] -> high-effort LLM recovery -> human intervention -> honest termination); Tier-3 fires ONLY on typed failure / contract violation / implausible coverage / required-stage timeout - NEVER on empty_valid; resume happens at the failed stage boundary
   - Acceptance: fixture matrix: retrieval timeout routes to healthy provider/local corpus without infinite retries; legitimate empty stays empty_valid with NO recovery invented; budget exhaustion terminates as partial_recovery, never a complete-looking short report

3. **Bounded LLM recovery controller**: The intelligence tier, fenced.
   - Current: only 219's per-surface manual rungs (offer verbs) exist
   - Target: a controller state machine (diagnose -> plan -> execute -> validate -> reconcile -> resume -> surface) persisting the recovery case file (failure-diagnosis.json, recovery-plan.json BEFORE execution, attempt-ledger.jsonl, validation-report.json, claim-evidence-ledger.json BEFORE synthesis, recovery-bundle.json); profiles diagnostic | high_effort | forensic (forensic = preserve state, prohibit mutation, human review packet); capability-based model selection recorded (model+version in the ledger; a model change never alters governance); stop conditions + budgets (max time/calls/engines/retries/sources/bytes/resume-depth)
   - Acceptance: hard-fence tests: controller cannot weaken the egress audit (policy_blocked, not rerouted); cannot convert unknown->zero; cannot bypass the governed writer (attempted direct write = test failure); cannot report filed without file-evidence-readback confirmation; prompt-injection in recovered content stays quoted data; case-file artifacts exist and validate per schema after a forced high_effort run

4. **Result semantics + disclosure**: Recovery is visible, honest, and scoped.
   - Current: 219's research_mode enum (normal | web_degraded_local_fallback | local_only | insufficient_evidence)
   - Target: enum gains llm_engine_recovery + manual_intervention_required; overall outcomes recovered | partial_recovery | insufficient_evidence | manual_intervention_required | policy_blocked ('recovered' ONLY when every required stage contract passes AND persisted evidence is readback-confirmed); user-visible disclosure of failed engines, recovery profile, paths used, claim coverage (supported/conflicting/unsupported), freshness, model+version, filing readback state; commands/research.md + skill mirror document the modes; the VANTAGE FIXTURE ships permanently: absence from one accessible corpus while an authoritative workspace is unavailable yields a corpus-scoped provisional gap tagged authoritative_workspace_unavailable - never project-level nonexistence
   - Acceptance: forced multi-engine outage produces partial_recovery with explicit coverage + unresolved gaps; the vantage fixture test passes; doc-parity check on the modes documentation

5. **Failure-injection validation matrix**: Fixture-first proof across the pipeline.
   - Current: none
   - Target: offline suite covering at minimum: retrieval timeout/malformed, legitimate empty preserved, egress-audit rejection -> policy_blocked, parser corruption w/ checksum intact, prompt injection inert, schema-invalid extraction -> new-version lineage not silent repair, ranker missing features -> unknown components, contradictory sources surface in the claim ledger, writer rejection -> unfiled with reason, readback mismatch -> filing unconfirmed, orchestrator resume without duplicate side effects, multi-engine outage termination, authoritative_workspace_unavailable
   - Acceptance: run-all-221.sh green with every listed class asserted; run-all-211/215/216/219/220 regressions green

6. **THE JOINT CUT**: The 219+220+221 version ships.
   - Current: 219 Plan 07 + 220's final wave stage readiness (drafts, checklists, corepower validation recorded); no version bump anywhere
   - Target: with 219 + 220 readiness green and all 221 requirements passed, execute scripts/release.sh <version> (five-gate lockstep): CHANGELOG (joint entry covering all three phases) + plugin.json + package.json + git tag + marketplace source.ref pin; npm publish; ALL READMEs refreshed (repo README.md + any surface READMEs touched by 219/220/221 features - content updated, styling preserved: Feynman + JTBD); mindrian-os.com website updated in the relevant locations (feature/capability surfaces + every hand-typed version string reconciled per the VERSION-BUMP discipline); VERSION-BUMP-CHECKLIST complete
   - Acceptance: npm shows the new version; five lockstep gates verified (scripts/verify-release green); marketplace ref points at the tag; README diffs are content-only; website locations updated + version fact-check recorded; the session goal (version cut after all needs met) CLOSES

## Boundaries

**In scope:** typed envelopes on the research-pipeline adapters + source-lens dispatcher seam; recovery dispatcher + tiers; the bounded controller + case file + profiles; result semantics + docs + vantage fixture; failure-injection suite; the joint release execution (including README + website updates).

**Out of scope:**
- A parallel research stack (the controller is an ADAPTER over shipped capabilities - Manus's own rule)
- Autonomous graph mutation; recovery output is proposed-only through existing writers
- Continuous crawling (220's registered loop stays cadence-bounded; recovery never crawls)
- Broad format support (PDF breadth stays deferred)
- Model-name-pinned governance (capability-resolved at runtime)
- Extending envelopes beyond the research pipeline + 219/220 seams (eureka/doctor adoption = follow-on)

## Constraints

- CJS only, no new deps, no em-dashes; all writes via navigation.cjs; Part 8 absolute (recovery may reformulate GENERIC queries only; room content never egresses; the audit is fail-closed and un-weakenable)
- Part 3: Tier-3 LLM recovery on a MATERIAL surface is gate-offered (219 D-20 semantics); background/cadence contexts terminate honestly instead of invoking the LLM tier unattended
- Deterministic code owns machine-checkable invariants (schemas, hashes, path guards, transitions, dedup identities, readback equality); LLM judgment supplements, never replaces
- file-evidence-readback.cjs is the ONLY filing-truth authority; a filing failure remains a failure regardless of LLM confidence
- Any doctor check added = registry module (data/doctor-modules.json + lib/core/doctor/*-module.cjs), never an inline branch (217 rule)
- Release ONLY via scripts/release.sh; the cut is the LAST act of the phase, after all three phases' gates are green + the navigator's corepower confirmation is recorded

## Acceptance Criteria

- [ ] Every failure class returns its typed envelope; zero bare-[] failure collapses remain in the touched adapters
- [ ] empty_valid never triggers recovery; typed failures route through the tier ladder; budget exhaustion = partial_recovery
- [ ] Controller hard-fence suite green (egress, unknown-never-zero, writer bypass, readback truth, injection-as-data)
- [ ] Case-file artifacts produced + schema-valid on a forced high_effort run; forensic profile prohibits mutation
- [ ] research_mode + outcome enums live; disclosure fields complete; vantage fixture (authoritative_workspace_unavailable) permanent
- [ ] run-all-221.sh green; 211/215/216/219/220 regressions green; doctor --acceptance green
- [ ] scripts/release.sh executed: npm published, five gates + marketplace pin verified, READMEs content-only refreshed, mindrian-os.com updated + version fact-check recorded
- [ ] Corepower validation (navigator, Desktop) recorded in 219-VERIFICATION.md BEFORE the cut

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                            |
|--------------------|-------|------|--------|--------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | Envelope -> ladder -> controller -> cut, ordered |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Adapter-not-stack rule + 6 exclusions            |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Fences enumerated; authorities named             |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 8 criteria incl. the cut + corepower gate        |
| **Ambiguity**      | 0.16  | <=0.20| ✓     |                                                  |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 0 | (navigator) | "221 needs to be new cut goal" + "pre-approve... run till and including 221 and full cut with updating all READMEs and mainly the mindrian website" | Joint 219+220+221 release; cut executes here; READMEs + website in scope; pre-approved autonomous run (corepower validation stays navigator-run) |
| 0 | (Manus architecture, navigator-supplied "use as suggestion") | Recovery order, taxonomy, controller contract, profiles, fences, result semantics, validation matrix | Adopted as binding input (annex); envelopes-first implementation priority; controller = adapter, never a parallel stack |
| 0 | (219/220 boundary) | What 221 owns vs the shipped D-19/D-20 seams | 221 generalizes; consumes 219's envelope beginnings; never duplicates the per-surface manual rungs |

---

*Phase: 221-llm-engine-recovery*
*Spec created: 2026-07-13*
*Next step: /gsd-discuss-phase 221 (auto) - implementation decisions (adapter touch list, dispatcher home, controller module shape, case-file location)*
