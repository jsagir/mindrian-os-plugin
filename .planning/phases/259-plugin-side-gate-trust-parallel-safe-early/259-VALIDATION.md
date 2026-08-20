---
phase: 259
slug: plugin-side-gate-trust-parallel-safe-early
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-20
---

# Phase 259 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` + `node:assert/strict` (no external test dep, no fake-timer dep) |
| **Config file** | none -- per-phase bash aggregators (`tests/run-all-<phase>.sh`) glob `tests/test-<phase>-*` |
| **Quick run command (TRUST-01 leg)** | `node --test tests/test-259-brain-client-429.cjs` (zero network, loopback mock) |
| **Quick run command (TRUST-02 leg)** | `node --test tests/test-259-floor-void.cjs` (zero network, pure fixtures) |
| **Full suite command** | `bash tests/run-all-259.sh` (does not exist yet -- Wave 0) |
| **Estimated runtime** | sub-second per quick command; ~5-10s full suite including the two regression suites |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/test-259-brain-client-429.cjs` (sub-second at `baseMs=5`) or `node --test tests/test-259-floor-void.cjs` (pure, sub-second), whichever the task touched.
- **After every plan wave:** Run `bash tests/run-all-259.sh` plus the two regression suites (`node --test tests/test-250-transport-retry.cjs`, `node tests/test-249-floor-gate.cjs`) -- these are the contracts most at risk from this phase's edits.
- **Before `/gsd-verify-work`:** `bash tests/run-all-259.sh` green, both regression suites green, and `node scripts/doctor.cjs --acceptance` green. The live `node scripts/check-flagship-floor.cjs` run is a checkpoint observation, not a gate -- its verdict depends on graph state Phases 260-262 own.
- **Max feedback latency:** ~10 seconds (full phase suite + regressions).

---

## Per-Task Verification Map

| Task ID | Requirement | Secure Behavior / Expected Result | Test Type | Automated Command | File Exists | Status |
|---------|-------------|-----------------------------------|-----------|--------------------|-------------|--------|
| 259-01-T2/T3 | TRUST-01 | A single 429 followed by a 200 recovers: `callTool` returns the payload, never `null`, with exactly 2 `tools/call` attempts | unit (loopback mock, zero network egress) | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 | ⬜ pending |
| 259-01-T2/T3 | TRUST-01 | 429 on all 4 attempts returns `{ error: 'rate_limited', ... }`, never `null`, with exactly 4 `tools/call` attempts (1 initial + 3 retries, D-01) | unit | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 | ⬜ pending |
| 259-01-T2 | TRUST-01 | RED PROOF: the same fixture against the pre-fix ladder returns `null` (sentinel is never `null`/`undefined`; `.error === 'rate_limited'`) | unit | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 | ⬜ pending |
| 259-01-T2/T3 | TRUST-01 | `Retry-After: 1` is honored: measured elapsed time between attempts >= 1000ms and returned `retry_after_s === 1` (D-01) | unit (one real ~1s wait, tolerant lower-bound assertion only) | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 | ⬜ pending |
| 259-01-T2/T3 | TRUST-01 | With no `Retry-After` header, waits follow 500/1000/2000 (D-02) | unit, zero sleeps -- pure `_rateLimitWaitMs(0..2, null, 500)` | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 | ⬜ pending |
| 259-01-T2/T3 | TRUST-01 | `_parseRetryAfterMs` returns null for absent/empty/`NaN`/negative/garbage, seconds*1000 for the integer form, a positive delta for a future HTTP-date, 0 for a past one | unit, zero I/O | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 | ⬜ pending |
| 259-01-T2/T3 | TRUST-01 | 429 handling does NOT consume AVAIL-02's budget and ignores `MINDRIAN_BRAIN_RETRY_MAX` (F-02): with `MINDRIAN_BRAIN_RETRY_MAX=0` the 429 path still retries 3 times | unit | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 | ⬜ pending |
| 259-01-T3 | TRUST-01 | Null contract unchanged: 5xx-exhausted still `null`; 403 still `tier_denied` in one attempt; 401 still `invalid_key` | regression | `node --test tests/test-250-transport-retry.cjs` | Yes | ⬜ pending |
| 259-01-T2/T3 | TRUST-01 | Part 8: the 429 branch adds zero outbound payload (captured requests carry only the caller's tool name + args) | unit (capture-server assertion) | `node --test tests/test-259-brain-client-429.cjs` | No -- Wave 0 | ⬜ pending |
| 259-02-T1/T2 | TRUST-01 (refusal-renderer scope TAKEN: F-09 Option B) | `REFUSAL_KINDS` gains `rate_limited`; no kind coerces to `unreachable` | unit | `node --test tests/test-250-refusal-shapes.cjs` (deliberate amendment) | Yes -- needs edit | ⬜ pending |
| 259-03-T2 | TRUST-02 | A row with a `hard_error` failure (HTTP 429) is `VOID`, not `MISS` | unit, pure fixtures, zero network | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 | ⬜ pending |
| 259-03-T2 | TRUST-02 | A row with a `timeout` failure is `VOID` (D-05) | unit | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 | ⬜ pending |
| 259-03-T2 | TRUST-02 | A row with a `malformed` failure (no SSE data line) is `VOID` (D-05) | unit | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 | ⬜ pending |
| 259-03-T2 | TRUST-02 | RED PROOF: all-green fixture with one row's probe sabotaged to a failure flips run from exit 0 to exit 3; `missCount` does NOT increase | unit | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 | ⬜ pending |
| 259-03-T2 | TRUST-02 | A run with both VOID and MISS rows exits 3, not 1 (VOID outranks) | unit | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 | ⬜ pending |
| 259-03-T2 | TRUST-02 | `passCount` never counts a VOID row (flattering-arithmetic guard) | unit | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 | ⬜ pending |
| 259-03-T2/T3 | TRUST-02 | Exit codes stay distinct: 0 clean, 1 real MISS, 2 malformed override, 3 VOID | unit + existing `parseOverrideFile` tests | `node --test tests/test-259-floor-void.cjs` + `node tests/test-249-floor-gate.cjs` | Partial (2-leg exists) | ⬜ pending |
| 259-03-T1 | TRUST-02 | `brainCall` sets `errorKind: 'timeout'` on an `AbortSignal.timeout` abort and `'hard_error'` on a connection failure | unit (loopback server that never responds + a closed port) | `node --test tests/test-259-brain-call-errorkind.cjs` | No -- Wave 0 | ⬜ pending |
| 259-03-T3 | TRUST-02 | D-06: VOID output names every failed row and its trigger type | unit on a pure renderer, or spawned-CLI smoke | `node --test tests/test-259-floor-void.cjs` | No -- Wave 0 | ⬜ pending |
| 259-03-T2 | TRUST-02 | All existing `evaluateFloor`/`parseOverrideFile` assertions stay green unchanged | regression | `node tests/test-249-floor-gate.cjs` | Yes | ⬜ pending |
| 259-04-T1 | Both | No em-dash in any file this phase touches | fence | `bash tests/run-all-259.sh` (fence section) | No -- Wave 0 | ⬜ pending |
| 259-04-T3 | Both | A live floor run against the real Brain produces an honest verdict | manual-only | `node scripts/check-flagship-floor.cjs` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-259-brain-client-429.cjs` -- covers TRUST-01 (all legs above)
- [ ] `tests/test-259-floor-void.cjs` -- covers TRUST-02 (all legs above)
- [ ] Scripted-response extension to `tests/helpers/brain-capture-server.cjs` (`setToolScript` / `getToolCallCount` / `resetToolScript`, default-off) -- prerequisite for the TRUST-01 file, per D-04 and F-08
- [ ] `tests/run-all-259.sh` -- glob runner with the load-bearing `found -eq 0` guard, the `TEST_259_PREFIX` override hook, and the no-em-dash fence over this phase's target list (copy `tests/run-all-250.sh`, which already uses `node --test`)
- [ ] Framework install: none needed -- `node:test` is built in

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| A live floor run against the real Brain produces an honest verdict | TRUST-01, TRUST-02 | Cannot be automated without either burning the real rate window on purpose or asserting against live graph state this phase does not control | `node scripts/check-flagship-floor.cjs` with a read-tier key; confirm the header, per-row verdicts, and exit code match the phase's new VOID/rate_limited contracts |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (259-01 T1/T2, 259-02 T1, 259-03 T1/T2, 259-04 T1)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved at plan time, 2026-08-20. Every task in all four plans carries an `<automated>` verify; the only `<human-check>` is the terminal live-floor-run checkpoint in 259-04, which is an observation and not a gate. `wave_0_complete` stays false until execution creates the four Wave 0 artifacts.
