---
phase: 220
slug: web-ingestion-agent-mindrian-web-agent-url-clean-markdown-ro
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-13
planned: 2026-07-13
---

# Phase 220 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 220-RESEARCH.md "Validation Architecture" (source of truth for the req->test map).
> Per-task map filled by the planner 2026-07-13 (5 plans, 4 waves).
> Planner deviation from the RESEARCH test list (documented): the standalone test-220-fts5-degrade.cjs is FOLDED into test-220-ingest-e2e.cjs as a forced-absent leg (reuses 219-02's env seam - one file fewer, same coverage); test-220-extract-adapter.cjs and test-220-ingest-safety.cjs are ADDED (adapter contract + the REQ-5 inbound adversarial fixtures the SPEC names).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in assertions + bash harness (no jest/mocha); `tests/test-220-*.cjs` + `tests/run-all-220.sh` |
| **Config file** | none - each test is a standalone `node tests/test-220-<slice>.cjs` returning exit 0/1 |
| **Quick run command** | `node tests/test-220-<slice>.cjs` |
| **Full suite command** | `bash tests/run-all-220.sh` then `node scripts/doctor.cjs --acceptance` |
| **Zero-network rule** | run-all-220.sh exports the eureka-offline-preload before any leg; every 220 test stubs the fetch leg (`opts._fetchCorpus` / globalThis.fetch stub) - live-net happens ONLY in Plan 05's evidence run |
| **Estimated runtime** | ~30-90 seconds (suite); doctor acceptance ~60s |

---

## Sampling Rate

- **After every task commit:** Run the slice test for the surface touched: `node tests/test-220-<slice>.cjs`
- **After every plan wave:** Run `bash tests/run-all-220.sh` + `node scripts/build-connector-registry.cjs --check`
- **Before `/gsd-verify-work`:** Full suite green + `node scripts/doctor.cjs --acceptance` + the LIVE real-URL run recorded in 220-VERIFICATION.md
- **Max feedback latency:** ~90 seconds (offline suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 220-01-T1 | 220-01 | 1 | REQ-1 extract adapter | T-220-03 SSRF; T-220-04 oversize/hang; T-220-05 ok+empty lie | typed provider envelope (never bare empty), scheme allowlist, size+timeout bounds, additive-only edit to research-corpus | unit (RED-first) | `node tests/test-220-extract-adapter.cjs` | ❌ W0 (created by 220-01-T1) | ⬜ pending |
| 220-01-T2 | 220-01 | 1 | REQ-5 egress fence | T-220-01 room-content exfil; T-220-02 payload growth | planted forbidden query -> zero fetch + throw; outbound body key-allowlist walk with negative self-check; chokepoint-uniqueness greps | adversarial unit | `node tests/test-220-part8-egress.cjs` | ❌ W0 (created by 220-01-T2) | ⬜ pending |
| 220-01-T3 | 220-01 | 1 | harness (all reqs) | - | zero-network preload; file-gated run_if legs; 219/218/216/215/211 regression chain | gate | `bash tests/run-all-220.sh` | ❌ W0 (created by 220-01-T3) | ⬜ pending |
| 220-02-T1 | 220-02 | 2 | REQ-1 ingest spine + REQ-4 envelope emission | T-220-06 injection; T-220-10 ok+empty; T-220-12 unlabeled manual | verify-landed gate on 219 seams (opts.paths, research-filing, research_mode); D-03 sidecar + D-11 nesting; scoped extraction; typed outcomes; cadence manual fence; FTS5 forced-absent leg | integration (RED-first) | `node tests/test-220-ingest-e2e.cjs` | ❌ W0 (created by 220-02-T1) | ⬜ pending |
| 220-02-T2 | 220-02 | 2 | REQ-1 idempotency + SUPERSEDES | T-220-11 history overwrite | same sha -> no_op (no re-file/re-extract); changed sha -> new version + SUPERSEDES via navigation; prior bytes sha-asserted untouched; ledger schema + ground-truth fallback | unit (RED-first) | `node tests/test-220-idempotency.cjs` | ❌ W0 (created by 220-02-T2) | ⬜ pending |
| 220-02-T3 | 220-02 | 2 | REQ-5 inbound fixtures + REQ-4 cache purity | T-220-06 injection; T-220-07 path escape; T-220-08 oversize; T-220-09 cache leak | injection inert-filed byte-verbatim; oversize typed-failed; path containment + symlink refusal asserted mechanically; dual-marker cache scan + zero research-cache require | adversarial unit | `node tests/test-220-ingest-safety.cjs` | ❌ W0 (created by 220-02-T3) | ⬜ pending |
| 220-03-T1 | 220-03 | 3 | REQ-2 pasted-URL sensor | T-220-13 evidence leak; T-220-14 auto-file | build-time free-SENS-id re-check recorded; frozen deep_research fail-closed; host+hash-handle evidence only; read-only detector | unit | (covered by 220-03-T3 file) `node tests/test-220-url-sensor.cjs` | ❌ W0 (created by 220-03-T3; sensor load-checked at T1) | ⬜ pending |
| 220-03-T2 | 220-03 | 3 | REQ-2 URL mode + D-10 offer + REQ-4 doc-parity | T-220-15 manual masquerade; T-220-16 auto-fire cost; T-220-17 doc drift | F.1 readback before any fetch; three-rung ladder with gate-OFFERED llm_manual_baseline (never default/silent); reality-to-docs; skill byte-mirror | gate | `node scripts/build-connector-registry.cjs --check && node scripts/check-shape-declaration.cjs --check --strict && node scripts/build-skill-mirrors.cjs --check` | ✅ existing | ⬜ pending |
| 220-03-T3 | 220-03 | 3 | REQ-2 acceptance + REQ-4 doc-parity greps | T-220-13; T-220-14; T-220-17 | fire/suppress(code-block, quoted)/dedup/soft-fail; before-after room-state snapshot proves zero writes without the verb; research_mode enum tokens present in the doc | unit + gate | `node tests/test-220-url-sensor.cjs` + six governance gates + `node scripts/check-render-coverage.cjs` | ❌ W0 (created by 220-03-T3) | ⬜ pending |
| 220-04-T1 | 220-04 | 3 | REQ-3 registry module | T-220-19 hostile entry | defensive parse, enum validation, atomic write-temp-rename, module never fetches (grep-gated) | unit (RED-first) | `node tests/test-220-crawl-loop.cjs` | ❌ W0 (created by 220-04-T1, RED-first; extended T2, finalized T3) | ⬜ pending |
| 220-04-T2 | 220-04 | 3 | REQ-3 cadence step | T-220-18 cost DoS; T-220-20 unattended manual; T-220-22 cadence kill | cap default 2; SEED-031 read-if-present probe (verified ABSENT 2026-07-13 - local cap authoritative); manual rung structurally absent + Plan 02 fence; advisory degrade | integration | `bash -n scripts/scout-cadence-runner.cjs && node tests/test-220-crawl-loop.cjs` | ❌ W0 (same file) | ⬜ pending |
| 220-04-T3 | 220-04 | 3 | REQ-3 acceptance | T-220-21 self-qualification | SPEC-verbatim: one changed + one unchanged -> exactly one ingest under cap 2; ingest_origin 'cadence' provenance; zero lifecycle writes; zero 'harvest' token across 220 modules | integration + gate | `node tests/test-220-crawl-loop.cjs && node scripts/check-shape-declaration.cjs --check --strict` | ❌ W0 (same file) | ⬜ pending |
| 220-05-T1..T3 | 220-05 | 4 | REQ-1 live + REQ-6 readiness (re-amended: the cut transfers to Phase 221) | T-220-23 hand-bump; T-220-24 fixture-green-lied; T-220-26 staging order | live real-URL run + graph_query evidence + live no_op; blocking navigator checkpoint; 219-readiness precondition; staged drafts only | live + release-staging | `bash tests/run-all-220.sh && node scripts/doctor.cjs --acceptance && git diff --exit-code package.json .claude-plugin/plugin.json CHANGELOG.md README.md` | ✅ existing | ⬜ pending |

*Status: ⬜ pending / ✅ green / ❌ red / ⚠ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-220.sh` - phase harness (clone run-all-218.sh; file-gated legs + 219/218/216 regression chain) - **220-01-T3**
- [ ] `tests/test-220-extract-adapter.cjs` - adapter typed-envelope contract + scheme fence + size bound - **220-01-T1 (RED-first)**
- [ ] `tests/test-220-part8-egress.cjs` - REQ-5 egress: planted room-content query -> zero fetch + throw; outbound key-allowlist - **220-01-T2**
- [ ] `tests/test-220-ingest-e2e.cjs` - REQ-1 fixture e2e: file -> extract -> graph-visible + typed failures + manual fence + FTS5 forced-absent leg - **220-02-T1 (RED-first)**
- [ ] `tests/test-220-idempotency.cjs` - content-hash no_op + SUPERSEDES + ledger - **220-02-T2 (RED-first)**
- [ ] `tests/test-220-ingest-safety.cjs` - REQ-5 inbound adversarial (injection/oversize/path-escape) + D-08 cache purity guard - **220-02-T3**
- [ ] `tests/test-220-url-sensor.cjs` - REQ-2 fire/suppress/dedup/no-write + REQ-4 doc-parity greps - **220-03-T3**
- [ ] `tests/test-220-crawl-loop.cjs` - REQ-3 registry + changed-only + cap + provenance + degrade - **220-04-T1 (RED-first; extended T2, finalized T3)**
- [ ] Live checkpoint: one real URL end-to-end + navigator surface confirmation - **220-05 (its own plan, its own evidence)**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live real-URL ingest into a real room (ador-ip-test discipline): cited artifact in research/, entities visible via graph_query, live idempotent re-run no_op | REQ-1 (live half) | Fixture-green lied twice in 218; live-net + a real TAVILY_API_KEY cannot run under the zero-network suite | Plan 220-05 Task 1 (auto, evidence recorded in 220-VERIFICATION.md; honest key-absent fallback routed to the checkpoint) |
| Pasted-URL card fires in a real session; nothing files without the verb; /mos:research URL mode readback + honest no_op; optional Desktop cross-check (Tri-Polar) | REQ-2 | The F.1 card render + AskUserQuestion flow is human-facing; the no-silent-write guarantee must be seen on a production session | Plan 220-05 Task 2 (blocking checkpoint:human-verify; defects -> /gsd-plan-phase 220 --gaps) |
| Release readiness staged, nothing bumped; the joint 219+220+221 cut acceptance (npm + five gates + marketplace pin + README diff + website fact-check) TRANSFERS to Phase 221 | REQ-6 (re-amended 2026-07-13) | The cut executes at Phase 221 completion (ROADMAP release note, navigator-FINAL); 220 proves cleanliness via git diff --exit-code | Plan 220-05 Task 3 (precondition: 219 readiness green - corepower confirmation + 219-RELEASE-STAGING.md) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (the Plan 05 checkpoint is bracketed by the Task 1 sweep and the Task 3 gate sweep)
- [x] Wave 0 covers all MISSING references (every test file has an owning task; RED-first where tdd applies)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-filled 2026-07-13; execution flips row statuses
