# Phase 221: Pipeline-Wide High-Effort LLM Engine Recovery - Pattern Map

**Mapped:** 2026-07-13
**Files analyzed:** 9 create/modify clusters (envelope adoption x2, injection harness, dispatcher, controller, case-file persistence, readback authority, semantics/docs, release wave, tests)
**Analogs found:** 9 / 9 (every cluster has a shipped analog; controller state-machine is a composite of two)

> Load-bearing rule for this phase: 221 EXTENDS 219 Plan 05's additive envelope, it does NOT replace it. 219-05 Task 1 is landing `research_mode` + per-provider `{status, reason, counts, freshness}` on `source-lens-driver.cjs` RIGHT NOW. 221 must read that landed shape and add fields ADDITIVELY (never rename `research_mode`, never break existing callers). Verify at plan time whether 219-05 has merged before touching the driver.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/core/research-corpus.cjs` (modify) | adapter/service | request-response | its own current adapters (self) | exact (in-place) |
| `lib/lens-engine/source-lens-driver.cjs` (modify) | adapter/orchestrator | request-response | 219-05 `research_mode` envelope (same file) | exact (extend) |
| failure-injection harness (env-var seam) | test-utility | transform | `MINDRIAN_FORCE_NO_VEC0` in `lib/core/eureka/vector-store.cjs`; `MINDRIAN_FORCE_ENGINE_ABSENT` (219-05) | exact |
| recovery dispatcher (beside source-lens) | middleware/router | event-driven | `runSourceLens` per-lens loop + `fetchSourceCached` catch | role+flow match |
| `lib/core/recovery/*` controller state machine | service | event-driven / batch | `chain-executor.cjs` `runChain` journal/resume + `mva-state.cjs` atomic writer | composite (2 analogs) |
| recovery case-file persistence (`.mindrian/**`) | store | file-I/O | `lib/core/mva-state.cjs` `_atomicWrite` tmp+rename | exact |
| readback authority calls | service | request-response | `lib/core/navigation/file-evidence-readback.cjs` (consume, do not fork) | exact (existing authority) |
| result semantics + docs (`commands/research.md` + skill) | config/doc | n/a | 219-05 enum block + doc-parity test convention | exact |
| `tests/run-all-221.sh` + fixtures | test | batch | `tests/run-all-218.sh` (file-gated legs + zero-network preload) | exact |
| release wave (`scripts/release.sh` + README + website) | config/process | n/a | `scripts/release.sh` five gates + Step 9.6b website | exact (invoke, do not modify) |

---

## Pattern Assignments

### `lib/core/research-corpus.cjs` (envelope adoption - the empty-collapse targets)

**Analog:** self. These are the EXACT bare-`[]`-on-failure sites the SPEC/annex cite. Every one must become a typed envelope (`status`, `failure_class`, `retryable`, `error`) instead of a swallowing empty.

The four collapse sites to convert (cite these line ranges in the plan):

- **Tavily missing key** - `adapterTavily`, lines 137-141: `if (!apiKey) { return []; }` -> `blocked` / `failure_class: 'missing_credential'`.
- **Tavily network/timeout** - lines 159-163: `catch (_err) { return []; }` -> `failed` / `failure_class: 'network_timeout'`, `retryable: true`.
- **Tavily HTTP non-ok + parse** - lines 164-173: `if (!res || !res.ok) { ...; return []; }` and the `catch` around `res.json()` -> `failed` / `http_error` and `parse_error`.
- **Brain-Cypher unavailable + query throw** - `adapterBrainCypher`, lines 208-211 (`if (!brainClient.isAvailable()) return []`) and lines 228-232 (`catch (_err) { return []; }`) -> `blocked` (credential/unavailable) vs `failed` (query error).
- **Academic delegate** - `adapterAcademic` lines 123-129 reads `envelope.results` and silently `[]` on absence: an empty result from a live fetch is `empty_valid`; a delegate throw is `failed`.

**The audit chokepoint stays sovereign** (lines 292-314): `auditQueryString(query, 'research-corpus')` runs BEFORE dispatch and THROWS `ExternalEgressViolation`. The envelope work MUST NOT catch/soften this - a Part 8 violation is `blocked` with `failure_class: 'policy_blocked'` and is NEVER rerouted (annex 3, SPEC REQ-3). Keep the pre-egress throw exactly where it is.

**Envelope shape to emit** (annex section 2, additive over the shipped 219 fields):
```
{ stage:'retrieval', engine:<source>, status:'ok|empty_valid|degraded|failed|blocked',
  failure_class:null, retryable:false, attempt:1,
  input_fingerprint, output_fingerprint, started_at, completed_at,
  provenance:[], warnings:[], payload:{results}, error:null }
```
Preserve the private `_adapters` test-export block (lines 341-352) - add the new envelope helpers there for fixture tests, same idiom.

---

### `lib/lens-engine/source-lens-driver.cjs` (envelope adoption - extend 219-05)

**Analog:** the same file's in-flight 219-05 `research_mode` addition. Read 219-05-PLAN Task 1 first (`{status, reason, counts, freshness}` per provider + `research_mode` enum).

The collapse site to convert - `fetchSourceCached`, lines 181-197:
```
try { const out = await fetchCorpusFn({ source, query, limit: PER_SOURCE_LIMIT });
  results = Array.isArray(out) ? out : []; }
catch (_e) { return []; }   // <- Canon-DoS empty; 221 makes this typed
```
This swallow (line 185-188) and the cache-read swallow (lines 176-179) are where a typed provider failure must surface instead of a bare `[]`. `runSourceLens` currently treats `rotation_threw` as non-fatal (lines 325-329) and still ranks whatever was fetched - keep that resilience but attach the typed per-provider envelope so the dispatcher can SEE which provider died vs returned a legitimate empty.

**Extend, never rename:** 219-05 lands `research_mode` (normal | web_degraded_local_fallback | local_only | insufficient_evidence). 221 adds `llm_engine_recovery` and `manual_intervention_required` to that SAME enum (D-08, additive). Existing consumers keep their fields; the full envelope rides alongside.

---

### Failure-injection harness (env-var seam)

**Analog:** `lib/core/eureka/vector-store.cjs` `ensureVecLoaded`, lines 100-110 - the canonical `MINDRIAN_FORCE_*` forcing seam:
```
const forcedEnv = process.env.MINDRIAN_FORCE_NO_VEC0;
if (options._forceVec0Unavailable || (typeof forcedEnv === 'string' && forcedEnv !== '')) {
  if (_vecVerdict === null) { _vecVerdict = { ok:false, detail:'forced_unavailable' }; _vecProbeComputations += 1; }
  return { ok:false, detail:'forced_unavailable' };
}
```
Two precedents to mirror EXACTLY (Claude's discretion on names, per D-decision): `MINDRIAN_FORCE_ENGINE_ABSENT` (219-05 D-20 engine-breaks seam) and `MINDRIAN_FORCE_FTS_ABSENT` (219 plans 02/04). Pattern rule: an `opts._forceX` seam PLUS a non-empty env var, latched once, SILENT (no stderr noise on the forced path - the real failure emits one line, the forced seam emits none). For 221, one env per failure class per stage: e.g. `MINDRIAN_FORCE_RETRIEVAL_TIMEOUT`, `MINDRIAN_FORCE_PARSE_CORRUPT`, `MINDRIAN_FORCE_READBACK_MISMATCH`, `MINDRIAN_FORCE_EGRESS_BLOCK`. Deterministic, toggle each class independently.

---

### Recovery dispatcher (beside source-lens orchestration - D-03)

**Analog:** `source-lens-driver.cjs` `runSourceLens` per-lens loop + `fetchSourceCached`. The dispatcher sits at the seam where `perLensFn` (lines 294-308) catches a typed failure and routes it, and where `runSourceLens` resumes ranking after a partial rotation (lines 331-359 - it already aggregates whatever fetched and continues, which IS resume-at-boundary in embryo).

**Tier ladder mapping to shipped seams (annex 1):**
- Tier-1 idempotent retry -> `chain-executor.cjs` bounded-retry block (lines 277-318, `min(cap, budgetRemaining)`, distinct `haltedAt.reason`). Retries FETCHES only, never writes (D-03).
- Tier-2 local governed substitute -> 219's `queryRoomCorpus` (research-filing.cjs) room-corpus provider, provenance `web: absent (room-corpus degrade)`. Never a shared-cache hit (annex 8).
- Tier-3 trigger discipline is CODE (D-04): typed failure / contract violation / implausible coverage / required-stage timeout. `empty_valid` NEVER triggers. In cadence/background contexts (scout, crawl) Tier-3 is SKIPPED - terminate honestly (Part 3).

**Resume idiom:** the ranked-continue-after-partial pattern already lives at `runSourceLens` lines 331-359. Resume at the FAILED STAGE BOUNDARY, no blind replay of non-idempotent actions (annex 3 orchestration rule).

---

### Controller state machine (`lib/core/recovery/*` - REQ-3, D-05)

**Composite analog - pick BOTH idioms:**

1. **Journal/resume checkpoint** -> `lib/core/chain-executor.cjs` `runChain` (lines 404-432, exports `{ trace, completed, haltedAt }`). The resilient ASYNC path (lines 436-475) engages when any reliability opt is present (`retries`/`journal`/`roomDir`/`resume`/`sleep`); it journals each COMPLETED step via `pipeline-state.cjs recordStep` (lines 866-872) and honors the `isNext` hard gate on resume so a partial re-run re-enters at the failed boundary (lines 72-80). This is the exact 7-step (`diagnose->plan->execute->validate->reconcile->resume->surface`) checkpoint backbone - reuse `recordStep`/`isNext`, build NO new journal.

2. **Atomic case-file persistence** -> `lib/core/mva-state.cjs` `_atomicWrite` (lines 69-77):
```
const tmp = target + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2,10);
fs.writeFileSync(tmp, body, 'utf8');
fs.renameSync(tmp, target);
```
(mirrors the rs-egress-telemetry tmp+rename pattern; a crashed writer cannot leave a torn file). `mkdirSync(dir, {recursive:true})` before write (line 62). Use this for every case-file artifact: `failure-diagnosis.json`, `recovery-plan.json` (written BEFORE execution), `attempt-ledger.jsonl` (append, one line per attempt), `validation-report.json`, `claim-evidence-ledger.json` (BEFORE synthesis), `recovery-bundle.json`.

**Profiles** (annex 5): `diagnostic | high_effort | forensic`. Forensic = preserve state, PROHIBIT mutation, emit human-review packet. Model selection capability-based, runtime-resolved, recorded (`model+version`) in the attempt ledger; a model change never alters governance (D-06).

**Home:** `lib/core/recovery/` (D-05, planner picks exact layout). Case file under the run's `.mindrian` workspace (LOCAL only, Part 8 - annex 9 run ledger).

---

### Readback authority (the ONLY filing-truth authority - REQ-3 fence)

**Analog / authority to CONSUME (never fork):** `lib/core/navigation/file-evidence-readback.cjs`, `fileEvidenceWithReadback(db, params)` (lines 72-162) + `surfaceFileEvidenceResult(result)` (lines 201-240).

The controller reports `filed` ONLY when this returns `{ ok:true, node_id, readback }`. The honesty contract is already built: it writes through the SHIPPED `writeEvidenceClaim` + `writeEdge` inside one `BEGIN/COMMIT/ROLLBACK` txn (lines 80-111), then READS THE ROW BACK and asserts the 4 locked provenance fields round-tripped (lines 116-144). A filing that did not land returns `{ ok:false, reason:'filing_did_not_land' }` (lines 119-136). Fence tests (D-06): the controller cannot report `filed` without this confirmation; cannot bypass the governed writer (this module never contains its own INSERT - the controller must not either). `review_status` lands `proposed`, NEVER auto-confirmed (lines 122-125). Recovery output is proposed-only through existing writers (SPEC out-of-scope: no autonomous graph mutation).

---

### Result semantics + docs (REQ-4, D-08)

**Analog:** 219-05 enum block. The shipped `research_mode` enum (219-05: normal | web_degraded_local_fallback | local_only | insufficient_evidence) gains `llm_engine_recovery` + `manual_intervention_required` ADDITIVELY. Overall outcomes: `recovered | partial_recovery | insufficient_evidence | manual_intervention_required | policy_blocked`. `recovered` ONLY when every required stage contract passes AND persisted evidence is readback-confirmed (annex 6).

**Doc-parity convention:** 219-05 Task 1 corrected `commands/research.md` drift and asserted it with a grep gate (`grep -c "paid -> native" commands/research.md` returns 0). 221 documents the new modes in `commands/research.md` + the skill mirror with the SAME doc-parity test idiom. The VANTAGE FIXTURE (`authoritative_workspace_unavailable`) ships as a permanent named test (annex 10 - the Phase-218 negative fixture).

Disclosure fields (annex 6): `failed_engines[{stage,engine,failure_class}]`, `recovery_profile`, `recovery_paths[]`, `coverage{requested/supported/conflicting/unsupported}`, `freshness{live_verified,newest_source_at,warning}`, `filing{attempted,confirmed_by_readback,reason}`, `unresolved_gaps[]`, `model+version`.

---

### Tests (`tests/run-all-221.sh` + fixtures - REQ-5)

**Analog:** `tests/run-all-218.sh`. Copy its structure:
- `set -uo pipefail`; `ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$ROOT"`.
- Zero-network guard: the offline preload flips `transformers.js env.allowRemoteModels=false` in every spawned leg (an uncached model load fails fast and degrades). Every leg hermetic, stub encoder, zero network - real-room content NEVER reaches a network judge (Part 8, restated).
- File-gated regression legs: `run_if` GATED ON A FILE so a partially-landed tree SKIPs (never RED-fails on absence) - use this for the 211/215/216/219/220 regression legs.
- `git-diff --exit-code` zero-touch gates + `grep` gates (no raw `INSERT INTO`, no network require) for the fence assertions.

The 13 fixture classes to assert are enumerated in annex 9 / SPEC REQ-5 (retrieval timeout, legitimate-empty-preserved, egress->policy_blocked, parser corruption checksum-intact, prompt-injection-inert, schema-invalid->new-version-lineage, ranker-missing->unknown, contradictory-sources-surfaced, writer-rejection->unfiled, readback-mismatch->unconfirmed, orchestrator-resume-no-dup, multi-engine->termination, authoritative_workspace_unavailable). Acceptance: `run-all-221.sh` green + `211/215/216/219/220` regressions green + `doctor --acceptance` green.

---

### Release wave (REQ-6, D-10 - INVOKE, do not modify)

**Analog / authority:** `scripts/release.sh <version>` - the five-gate lockstep. Do NOT hand-edit versions; run the script (CLAUDE.md HARD RULE). Structure (from the dry-run plan, lines 199-245):
- Step 2 / 2.5: `scripts/verify-release` (read-only) + `doctor --acceptance --pre-flight` (HARD ABORT, clean-tree gate).
- Steps 3-6: bump `.claude-plugin/plugin.json` + `package.json` + `~/mindrian-marketplace/.claude-plugin/marketplace.json` (`source.ref` pinned to `vN`); CHANGELOG `[Unreleased]` -> `[$NEW_VERSION] - $(date +%F)`.
- Step 7: Commit A (release commit) + tag `vN` (two-commit form; plugin.json version read FIRST).
- Step 9.5: `npm publish @mindrian_os/cli@$NEW_VERSION`.
- **Step 9.6b (website - the mindrian-os.com update):** `WEBSITE_DIR="${MINDRIAN_WEBSITE_DIR:-$HOME/mindrian-website/website}"`, sed `src/lib/version.ts` `FALLBACK_VERSION` -> grep-verify -> `git push origin main` -> live-poll `https://mindrian-os.com/`. Website repo CONFIRMED present at `~/dev/mindrian-website` and `~/mindrian-website` (the default WEBSITE_DIR is `$HOME/mindrian-website/website`). This is the single canonical web surface (minisite retired 2026-06-09; `NO_WEBSITE=0` default). Version fact-check per VERSION-BUMP discipline is a step 9.6b hard lockstep.
- Step 9.8: full `doctor --acceptance` (HARD ABORT).

**CHANGELOG format** (from `CHANGELOG.md` head): `## [Unreleased] -- vX (in progress)` with `### Added` / `### Fixed` sections; each entry a bolded one-line summary + Feynman detail + RCA slug. The JOINT entry covers 219+220+221 - assemble from `219-RELEASE-STAGING.md` + 220's staging (D-10).

**READMEs content-only** (Feynman + JTBD, styling preserved): repo `README.md` primary + any 219/220/221 feature-touched surface docs. Content updated, styling untouched.

**Corepower gate (D-10, autonomous:false at the cut):** navigator-run Desktop validation recorded in `219-VERIFICATION.md` BEFORE the cut. This is the one gate the agent does NOT self-clear.

---

## Shared Patterns

### Egress audit (Part 8, un-weakenable)
**Source:** `research-corpus.cjs` lines 292-314 (`auditQueryString` pre-dispatch throw).
**Apply to:** every adapter envelope + the Tier-2/Tier-3 recovery paths. A policy violation is `blocked`/`policy_blocked`, NEVER rerouted or softened. Recovery may reformulate GENERIC queries only; room content never egresses. Fence test required (D-06).

### Atomic local write (tmp + rename)
**Source:** `mva-state.cjs` lines 69-77.
**Apply to:** every case-file artifact + the run ledger. LOCAL disk only (`.mindrian`), never the Brain.

### Honest-degrade probe (forced seam, silent)
**Source:** `vector-store.cjs` lines 100-110.
**Apply to:** the injection harness + every capability boundary (Tier-0/1). Forced path silent; real failure one stderr line.

### Governed-write-then-readback
**Source:** `file-evidence-readback.cjs` `fileEvidenceWithReadback` + `surfaceFileEvidenceResult`.
**Apply to:** all controller filing. The ONLY filing-truth authority. `proposed` never auto-confirmed.

### Reliable chain loop (journal + resume + budget)
**Source:** `chain-executor.cjs` `runChain` (lines 404-475, `pipeline-state.recordStep`/`isNext`).
**Apply to:** the controller state machine + the dispatcher resume-at-boundary. Reuse, build no new journal.

---

## No Analog Found

None. Every cluster maps to a shipped analog. The controller is the only NET-NEW module and it is a COMPOSITE of two shipped idioms (chain-executor journal/resume + mva-state atomic write) plus the readback authority - by SPEC design it is an ADAPTER over shipped capabilities, never a parallel research stack.

---

## Verify-at-Plan Flags (load-bearing)

1. **219-05 merge status:** Confirm whether 219-05 Task 1 has landed `research_mode` + per-provider `{status,reason,counts,freshness}` on `source-lens-driver.cjs` BEFORE planning the 221 driver extension. If not merged, 221 must not collide - sequence behind it or coordinate the enum. (Prompt says it is "landing in parallel right now.")
2. **`research_mode` grep returned ZERO hits in `lib/`** at map time - the enum lives in 219-05 plan text, not yet in shipped code. The planner must re-grep at plan time; the extension target may not exist yet.
3. **Website repo:** default `$HOME/mindrian-website/website`; also present at `~/dev/mindrian-website`. Resolve the actual Next.js root (which holds `src/lib/version.ts`) at execution and set `MINDRIAN_WEBSITE_DIR` if it differs. Do not assume `~/dev`.
4. **Doctor modules (217 rule):** any new doctor check for recovery must be a registry module (`data/doctor-modules.json` + `lib/core/doctor/*-module.cjs`), never an inline branch (D-09).
5. **`tests/run-all-219.sh` / `run-all-220.sh` do NOT yet exist on disk** (only up to 218 + 956). The regression legs must be `run_if` file-gated so they SKIP cleanly until 219/220 land their aggregators.

---

## Metadata

**Analog search scope:** `lib/core/`, `lib/lens-engine/`, `lib/core/navigation/`, `lib/core/eureka/`, `lib/mcp/`, `scripts/`, `tests/`, `.planning/phases/219-*`
**Files scanned:** ~14 read/grepped; 4 read in full (research-corpus, source-lens-driver, file-evidence-readback, 219-05-PLAN)
**Pattern extraction date:** 2026-07-13
</content>
</invoke>
