# Binding input annex: Manus recovery architecture + decision note (navigator-supplied 2026-07-13, "use as suggestion" - adopted)

Condensed to the normative elements a planner/executor consumes blind. Where this annex and 221-SPEC.md disagree, the SPEC wins. Verified against live code where marked.

## 1. Recovery order (tiers)

| Tier | Mode | Exit |
|---|---|---|
| 0 | Normal engine | stage contracts pass |
| 1 | Deterministic retry - IDEMPOTENT ops only, bounded backoff, alternate configured provider/parser/cache | contract passes or retry budget exhausted |
| 2 | Local governed substitute - room artifacts, accepted evidence, snapshots, public cache; NEVER mislabeled as live | coverage restored or gaps explicit |
| 3 | High-effort LLM recovery - diagnose, plan, execute via healthy REGISTERED tools, validate, reconcile | validated recovery bundle or trustworthy-recovery-impossible |
| 4 | Human intervention - smallest missing permission/credential/source/decision | human resolves or defers |
| 5 | Honest termination - partial_recovery / insufficient_evidence / manual_intervention_required / policy_blocked | run ends without invented success |

Tier-3 triggers: typed engine failure, contract violation, implausible coverage vs requested scope, required-stage timeout. NEVER on empty_valid (a legitimate empty is a finding).

## 2. Common stage envelope (the REQ-1 contract)

```json
{
  "run_id": "...", "stage": "retrieval|discovery|normalization|segmentation|extraction|dedup|ranking|synthesis|gate|filing|readback|orchestration|presentation",
  "engine": "engine-or-provider-id",
  "status": "ok|empty_valid|degraded|failed|blocked",
  "failure_class": null, "retryable": false, "attempt": 1,
  "input_fingerprint": "sha256(...)", "output_fingerprint": "sha256(...)|null",
  "started_at": "ISO-8601", "completed_at": "ISO-8601",
  "provenance": [], "warnings": [], "payload": {}, "error": null
}
```

blocked = policy / credential / human-gate / authoritative-source requirement. Fix target verified: lib/core/research-corpus.cjs + lib/lens-engine/source-lens-driver.cjs collapse missing-key/timeout/HTTP/parse/Brain failures into identical empty arrays.

## 3. Failure taxonomy - non-negotiable boundaries per stage

- Preflight/context: reconstruct PROVISIONAL context only; never promote it to project fact.
- Query planning: rewrite GENERIC privacy-safe queries only; never weaken the egress audit.
- Retrieval: never claim live verification without a live result.
- Artifact discovery: never traverse outside the room; folder placement is not authority.
- Parsing: preserve raw bytes + checksum; never silently replace source content.
- Segmentation: claim without locator cannot rise above unverified.
- Extraction: LLM output is ALWAYS a proposed candidate; injection filtered as data.
- Dedup: never overwrite history; similar prose is not identity; SUPERSEDES on change.
- Ranking: never coerce missing to zero; no decorative precision.
- Synthesis: every factual conclusion resolves to a retrieved or local source.
- Gate/review: never auto-confirm truth claims or lifecycle promotion.
- Filing: never write around the governed writer; never report success without readback (lib/core/navigation/file-evidence-readback.cjs - VERIFIED present).
- Orchestration: resume from last verified checkpoint; no blind replay of non-idempotent actions.
- Presentation: render failure never alters research truth status.

## 4. Controller state machine + case file (REQ-3)

diagnose -> plan -> execute -> validate -> reconcile -> resume -> surface.
Artifacts (persisted per recovery run): failure-diagnosis.json; recovery-plan.json (BEFORE execution: alternate tools, budgets, permissions, stop conditions); attempt-ledger.jsonl; validation-report.json (schema/provenance/locator/freshness/dedup/privacy/policy/readback checks); claim-evidence-ledger.json (BEFORE synthesis: supported/conflicting/unsupported/missing); recovery-bundle.json (returns to the pipeline at the failed stage boundary); human-readable recovery notice.
Deterministic code evaluates machine-checkable invariants; LLM judgment supplements, never replaces.

## 5. Profiles

| Profile | Activation | Behavior |
|---|---|---|
| diagnostic | one stage failed, deterministic substitute likely | classify, one alternate path, bounded validation |
| high_effort | multiple engines down / conflicting evidence / consequential decision | decompose, multi-path, cross-check, contradiction pass |
| forensic | filing/readback mismatch, corrupt lineage, unsafe artifact, repeated orchestration failure | preserve state, PROHIBIT mutation, reconstruct provenance, human review packet |

Model selection: capability-based, runtime-resolved, recorded (model+version); smaller model allowed for bounded classification/formatting; a model change never alters governance.

## 6. Result semantics (REQ-4)

research_mode gains: llm_engine_recovery, manual_intervention_required. Outcomes: recovered | partial_recovery | insufficient_evidence | manual_intervention_required | policy_blocked. 'recovered' ONLY when every required stage contract passes AND persisted evidence is readback-confirmed. Disclosure: failed_engines[{stage,engine,failure_class}], recovery_profile, recovery_paths[], coverage{requested/supported/conflicting/unsupported}, freshness{live_verified,newest_source_at,warning}, filing{attempted,confirmed_by_readback,reason}, unresolved_gaps[], model+version.

## 7. Stop conditions / budgets

Max elapsed time, model calls, alternate engines, retries per stage, source count, artifact bytes, resume depth. Early termination on: policy block, missing human authorization, authoritative-source requirement, unsafe artifact, repeated identical failure fingerprint, no remaining independent path. Budget exhaustion -> partial_recovery or insufficient_evidence, NEVER a shortened complete-looking report. Case file retained for resume.

## 8. Implementation seams (verify at plan time)

- research corpus adapters: typed envelopes replace empty-collapse (preserve egress audit + provider gates)
- source-lens orchestration: recovery dispatcher consuming typed failures, resuming at stage boundary
- room-local corpus: separate privacy-aware provider (219 D-16 leg), never a shared-cache hit
- ranking/harvest: unknown components preserved (219 D-18 shipped this)
- research command + skill: document the modes
- evidence filing: proposed-only writer + write-plus-readback wrapper, failures exposed unchanged
- run ledger: checkpoints, failure fingerprints, attempts, model/version, tool path, cost, final status
- user surface: which engine broke, what the LLM did, unsupported claims, freshness, filing state

## 9. Validation matrix (REQ-5 - the fixture classes)

retrieval timeout/malformed; legitimate empty preserved; egress rejection -> policy_blocked (never rerouted); parser corruption w/ raw+checksum intact; prompt injection inert; schema-invalid extraction -> new version w/ lineage (no silent repair); ranker missing features -> unknown; contradictory sources surfaced (never averaged); writer rejection -> unfiled w/ exact reason; readback mismatch -> unconfirmed (recovery cannot claim success); orchestrator crash resume w/o duplicate side effects; multi-engine outage -> explicit coverage + gaps; VANTAGE FIXTURE: authoritative workspace unavailable -> corpus-scoped provisional gap (authoritative_workspace_unavailable) - the permanent Phase-218 negative fixture.

## 10. Correction record (the decision note)

Manus's original "Phase 218 missing" corrected to: not independently visible from the accessible remote baseline; local existence is authoritative user-supplied state pending sync. The defensible pattern: a candidate signal from a thin corpus stays PROVISIONAL until evidence coverage is sufficient - the same qualification principle 219 enforces. This correction is the origin of the vantage fixture.
