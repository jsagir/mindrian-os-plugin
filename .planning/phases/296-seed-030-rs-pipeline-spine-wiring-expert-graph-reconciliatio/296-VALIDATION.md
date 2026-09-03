---
phase: 296
slug: seed-030-rs-pipeline-spine-wiring-expert-graph-reconciliatio
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-03
---

# Phase 296 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node scripts — `node:assert` + `node:test` in `*.test.cjs`; bash harnesses for shape/grep gates. No jest, no vitest, no mocha. |
| **Config file** | none — no test-runner config; `package.json` has no `test` script |
| **Quick run command** | `node tests/<file>.test.cjs` |
| **Full suite command** | `bash tests/run-all-296.sh` (does not exist yet — Wave 0) |
| **Estimated runtime** | ~15s (no ML model load in the unit tier; the encoder-availability probe is a separate, slower integration check) |

---

## Sampling Rate

- **After every task commit:** run the single `node tests/296-<area>.test.cjs` for the area touched (< 5s)
- **After every plan wave:** `bash tests/run-all-296.sh` + `bash tests/run-all-272.sh` (adjacent-subsystem regression fence)
- **Before `/gsd-verify-work`:** `node scripts/doctor.cjs --acceptance` + all four born-wired/projection/render/shape gates green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 296-01-01 | 01 | 0 | Wave 0 infra | — | N/A | infra | `bash tests/run-all-296.sh` | ❌ W0 | ⬜ pending |
| 296-02-01 | 02 | 1 | Acceptance 2 (internal regression fence) | — | N/A | unit | `node tests/296-no-pinecone-internal.test.cjs` | ❌ W0 | ⬜ pending |
| 296-03-01 | 03 | 1 | Acceptance 2 (safety, Pitfall 1) | T-296-01 | Python read never touches `eureka_vec` directly; CJS export step used on both backends | unit | `node tests/296-vector-read-both-backends.test.cjs` | ❌ W0 | ⬜ pending |
| 296-04-01 | 04 | 2 | Acceptance 2 (real gap — signal corpus local) | T-296-02 | `rs_cache.py`'s Pinecone SDK calls retired; local embed-and-cache path serves external/hybrid modes | integration | `node tests/296-signal-corpus-local.test.cjs` | ❌ W0 | ⬜ pending |
| 296-05-01 | 05 | 2 | Dimensional invariant | — | No 384-dim/1024-dim cosine mixing anywhere | unit (source grep) | `bash tests/296-dim-invariant.sh` | ❌ W0 | ⬜ pending |
| 296-06-01 | 06 | 3 | Acceptance 3 (degrade, real gap) | T-296-03 | `rs-experts` routes through `refusal-messaging.cjs`; three causes produce three distinguishable outputs; "zero experts" renders as success, not refusal | unit | `node tests/296-rs-experts-degrade.test.cjs` | ❌ W0 | ⬜ pending |
| 296-07-01 | 07 | 3 | Part 8 regression | T-296-04 | `rs-experts` loads no `brainClient`; no `mcp__mindrian-brain__` in frontmatter | unit (source grep) | extend `lib/memory/brain-server-resolution.test.cjs` | ⚠️ PARTIAL | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs above are planning placeholders — the planner assigns final plan/wave numbers; this map is the acceptance-criteria skeleton it must fill in, not a substitute for its own task breakdown.*

---

## Wave 0 Requirements

- [ ] `tests/run-all-296.sh` — aggregator, modeled on `tests/run-all-272.sh`
- [ ] `tests/296-vector-read-both-backends.test.cjs` — **the Pitfall-1 guard; write this first.** Run once plain, once with `MINDRIAN_FORCE_NO_VEC0=1`, so both the `sqlite-vec` and fallback backends are exercised in CI regardless of which one this checkout happens to have.
- [ ] `tests/296-rs-experts-degrade.test.cjs` stub — cases (a) no transport, (b) unreachable, (c) genuinely zero experts
- [ ] `tests/296-signal-corpus-local.test.cjs` stub — external/hybrid zero-Pinecone
- [ ] `tests/296-no-pinecone-internal.test.cjs` stub — internal-mode regression fence (should already pass; locks the finding)
- [ ] `tests/296-dim-invariant.sh` — 384/1024 non-mixing source grep
- [ ] Test-room fixture: a room.db with a populated vector store on **each** backend — `lib/memory/selector-miss.test.cjs`'s `fs.mkdtempSync` + `openRoomDb` idiom is the precedent
- [ ] Framework install: **none needed** — everything this phase touches is already installed (see 296-RESEARCH.md "Standard Stack")

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| HSI Tier 2 not broken by `rs_cache.py` retirement | Runtime State Inventory (`PINECONE_API_KEY` still load-bearing elsewhere) | `compute-hsi.py` Tier 2 and `pinecone-inference.cjs` share the same env var/package; automating a full HSI run is out of this phase's scope | `python3 scripts/compute-hsi.py --help` exits 0; spot-check one Tier-2 invocation still resolves Pinecone if `PINECONE_API_KEY` is set |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (all 6 test files above are net-new)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter (done above)

**Approval:** pending
