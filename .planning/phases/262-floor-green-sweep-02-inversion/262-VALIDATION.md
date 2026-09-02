---
phase: 262
slug: floor-green-sweep-02-inversion
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-02
---

# Phase 262 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node --test` (Node.js built-in) for `.cjs`; plain `bash` for `.sh` |
| **Config file** | none — discovery is by `tests/run-all-<phase>.sh` glob convention |
| **Quick run command** | `node --test tests/test-262-*.cjs` |
| **Full suite command** | `bash tests/run-all-262.sh` |
| **Estimated runtime** | ~5 seconds hermetic (Wave 0-3); the live floor run is a separate human-gated checkpoint, not part of this budget |

---

## Sampling Rate

- **After every task commit:** `node --test tests/test-262-*.cjs` (hermetic, sub-second)
- **After every plan wave:** `bash tests/run-all-262.sh`
- **Before `/gsd-verify-work`:** `bash tests/run-all-262.sh` plus `bash tests/run-all-127.sh` plus `bash tests/run-all-259.sh` (the two suites this phase modifies or depends on) all green
- **Max feedback latency:** 5 seconds
- **Live legs are never in the automated sampling rate.** The floor run is a human-gated checkpoint (`checkpoint:human-verify`) — a 429 renders VOID and D-08 forbids auto-retry.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 262-01-01 | 01 | 0 | FLOOR-01 | V4 | Floor gate stays read-tier only, never reaches for an admin key | unit, hermetic | `node --test tests/test-249-floor-gate.cjs` | ✅ reuse | ⬜ pending |
| 262-01-02 | 01 | 0 | FLOOR-01 | V4 / V7 | VOID precedence + banners unchanged | unit, hermetic | `node --test tests/test-259-floor-void.cjs` | ✅ reuse | ⬜ pending |
| 262-01-03 | 01 | 0 | FLOOR-01 | — | Ratified denominator matches live scan 1:1, not narrowed | unit, zero network | `node --test tests/test-262-floor-denominator.cjs` | ❌ W0 | ⬜ pending |
| 262-01-04 | 01 | 0 | FLOOR-01 | V7 | Unrecognized envelope (Theo's shape) produces VOID, never a false MISS | unit, zero network | `node --test tests/test-262-unrecognized-shape-voids.cjs` | ❌ W0 | ⬜ pending |
| 262-02-01 | 02 | 1 | FLOOR-02 | V2 / V5 | Keyless path returns byte-locked `no_key` refusal, serves no methodology content | integration, hermetic | `bash tests/test-127-03-acceptance-gates.sh` | ✅ modify | ⬜ pending |
| 262-02-02 | 02 | 1 | FLOOR-02 | — | Refusal fixture directory never deleted, README asserts refusal | unit, zero network | `node --test tests/test-262-refusal-fixture-retained.cjs` | ❌ W0 | ⬜ pending |
| 262-02-03 | 02 | 1 | FLOOR-02 | — | Shim handshake keyless assertion still green under new labels | integration | `bash tests/test-127-00-shim-handshake.sh` | ✅ reuse | ⬜ pending |
| 262-02-04 | 02 | 1 | FLOOR-02 | — | Class-M cascade unaffected by relabel | integration | `bash tests/test-127-02-doctor-class-m.sh` | ✅ modify (label only) | ⬜ pending |
| 262-02-05 | 02 | 1 | FLOOR-02 | V7 | Wire string `DIRECTOR_NOT_AVAILABLE` unchanged (never prints the key) | unit | `node --test lib/core/refusal-messaging.test.cjs` | ✅ reuse (regression lock) | ⬜ pending |
| 262-03-01 | 03 | 2 | FLOOR-01 (gap ledger) | — | Live floor run recorded with dated evidence, gap ledger names root cause + owner per MISS row | live, human-gated | `node scripts/check-flagship-floor.cjs` at `checkpoint:human-verify` | n/a | ⬜ pending |
| 262-03-02 | 03 | 2 | FLOOR-03 | V5 | Re-ruling recorded with live measurement + date; no silent carry-forward | doc gate | grep plan/summary for measured count + command | n/a | ⬜ pending |
| 262-04-01 | 04 | 0 | — | V7 | No em-dashes in any file this phase touches | lint | the `run-all-262.sh` em-dash fence | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders for the planner's own wave/task numbering — the Requirement/Test Type/Command columns are the load-bearing content this VALIDATION.md contributes.*

---

## Wave 0 Requirements

- [ ] `tests/run-all-262.sh` — aggregator, copied from `run-all-259.sh`, with the `TEST_262_PREFIX` discovery guard (must exit non-zero if it discovers zero tests, per Pitfall/Pattern "the aggregator's discovery guard") and the em-dash fence
- [ ] `tests/test-262-floor-denominator.cjs` — proves `data/flagship-floor-set.json` still matches the live frontmatter scan 1:1, and proves the file was not narrowed (`frameworks.length === 28`, `ratified_at` pinned)
- [ ] `tests/test-262-refusal-fixture-retained.cjs` — proves the repurposed FLOOR-02 fixture directory still exists and its README asserts refusal, not availability
- [ ] `tests/test-262-unrecognized-shape-voids.cjs` — the Theo tripwire made hermetic: feeds `evaluateFloor` a row whose probe succeeded but whose payload carries neither `canonical_matches` nor `readiness.readiness_score` (Theo's actual response shapes), asserts VOID + exit 3, never MISS + exit 1
- [ ] No framework install needed — `node --test` is built in

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live floor run against the deployed Brain | FLOOR-01 gap ledger | A 429 mid-run renders VOID; D-08 forbids auto-retry, so a human must re-run and read the result | Run `node scripts/check-flagship-floor.cjs`, confirm 0 VOID rows, transcribe the per-row verdict into the gap ledger with today's date |
| FLOOR-03 live re-measurement | FLOOR-03 | Same live-graph dependency; the exactly-1-vs-2 assertion must be re-verified fresh, not carried forward (this research already found the carried-forward number wrong twice) | Run the `normalize_framework_name` probe for "Scenario Planning" (262-RESEARCH.md "Code Examples" section), confirm the live count, record it with the command and date |
| Theo adaptation-list handoff | D-04 (Theo forward-compat) | Cross-repo coordination, not a code change — Theo's session ("Brain–Theo graph reconciliation execution") was offline this research session | Send `scripts/check-flagship-floor.cjs` and `scripts/build-brain-census.cjs` as an addition to Theo's named 7-file adaptation list; check for a reply before assuming the flip-timing open question is unanswered |
| Brain-repo work-order handoff | D-02 | Cross-repo, Pitfall 6 forbids inline edits from this repo | File the 6 write-dependent MISS rows (node ids + measured evidence) into the Brain repo's own todo/phase intake |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (floor-denominator, unrecognized-shape-voids, refusal-fixture-retained, em-dash fence)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (hermetic legs only)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
