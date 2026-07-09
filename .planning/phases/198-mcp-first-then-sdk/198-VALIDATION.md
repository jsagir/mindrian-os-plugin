---
phase: 198
slug: mcp-first-then-sdk
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-09
---

# Phase 198 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Filled 2026-07-09 from 198-RESEARCH.md "Validation Architecture" + the 10-plan set (plan 198-01 IS Wave 0).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `assert` + bash aggregators (`tests/run-all-<phase>.sh`, SKIP-safe run/run_if - the run-all-194.sh clone) |
| **Config file** | none - convention-based (`tests/*.test.cjs` + `tests/run-all-198.sh`) |
| **Quick run command** | `node tests/test-198-<name>.test.cjs` (single file) |
| **Full suite command** | `bash tests/run-all-198.sh` |
| **Estimated runtime** | ~120 seconds (full aggregator incl. flag-OFF coherence smoke) |

---

## Sampling Rate

- **After every task commit:** Run the task's named test file + `node scripts/build-connector-registry.cjs --check` (born-wired stays clean)
- **After every plan wave:** Run `bash tests/run-all-198.sh` + `MINDRIAN_MCP_FIRST= node scripts/coherence-smoke-test.cjs` (SPEC-7 byte-identical guard)
- **Before `/gsd-verify-work`:** Full suite green + parity transcript both legs + `node scripts/198-plurai-gate-check.cjs` + `node scripts/doctor.cjs --acceptance`
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 198-01-01 | 01 | 0 | all (scaffold) | T-198-05 | Part 8 local-only source-grep floor green over lib/mcp | harness | `bash tests/run-all-198.sh` | ❌ W0 (this task creates) | ⬜ pending |
| 198-01-02 | 01 | 0 | SPEC-8 | T-198-16 | gate fails closed on baseline mismatch | gate | `node scripts/198-plurai-gate-check.cjs` | ❌ W0 (this task creates) | ⬜ pending |
| 198-02-01 | 02 | 1 | SPEC-1, SPEC-7 | T-198-01 | flag unset/empty = OFF for every surface; sessionId keys pass isSafeSlug | unit | `node tests/test-198-local-only.test.cjs` + inline load checks | ✅ (W0) | ⬜ pending |
| 198-02-02 | 02 | 1 | SPEC-1, SPEC-7 | T-198-06 | 127.0.0.1 only; flag-OFF transport byte-identical | integration | `node -c bin/mindrian-mcp-server.cjs && MINDRIAN_MCP_FIRST= node scripts/coherence-smoke-test.cjs` | ✅ (smoke exists) | ⬜ pending |
| 198-02-03 | 02 | 1 | SPEC-1 | T-198-02 / T-198-08 | interleaved writes land in own rooms; 2026-07-08 replay impossible flag-ON; reg.active writes deprecated+logged | integration | `node tests/test-198-concurrency-mcp.test.cjs && node tests/test-198-flag-off-parity.test.cjs` | ❌ W0 stubs (198-01) | ⬜ pending |
| 198-03-01 | 03 | 2 | SPEC-1 | T-198-09 | stale pidfile reaped, never trusted; loopback probe only | unit | inline pidfile round-trip + `node tests/test-198-local-only.test.cjs` | ✅ (W0) | ⬜ pending |
| 198-03-02 | 03 | 2 | SPEC-1 | T-198-01 / T-198-06 | shim imports no lib/core; sessionId passthrough validated | integration | `node -c bin/mindrian-mcp-shim.cjs && MINDRIAN_MCP_FIRST= node scripts/coherence-smoke-test.cjs` | ✅ (smoke exists) | ⬜ pending |
| 198-03-03 | 03 | 2 | SPEC-2 | T-198-05 | SSE carries segments only, no room content | unit | inline pub/sub check + `node tests/test-198-local-only.test.cjs` | ✅ (W0) | ⬜ pending |
| 198-04-01 | 04 | 2 | SPEC-2 | T-198-07 | every MCP tool born-wired via exported connectors; --check fails closed on drift | gate | `node scripts/build-connector-registry.cjs --check && MINDRIAN_MCP_FIRST= node scripts/coherence-smoke-test.cjs` | ✅ (gates exist) | ⬜ pending |
| 198-04-02 | 04 | 2 | SPEC-2 | T-198-03 | SECTION_RE + safeResolveSection on every path input | unit | require check + `--check` + local-only + flag-OFF smoke | ✅ (W0) | ⬜ pending |
| 198-04-03 | 04 | 2 | SPEC-2 | T-198-04 | graph writes only via navigation.cjs; bypass rejected | integration | `node tests/test-198-chokepoint-guard.test.cjs` + flag-OFF smoke | ❌ W0 stub (198-01) | ⬜ pending |
| 198-05-01 | 05 | 3 | SPEC-4 | T-198-05 | superset card carries local metadata only; F.8 fires once per session | unit | require check + local-only + flag-OFF smoke | ✅ (W0) | ⬜ pending |
| 198-05-02 | 05 | 3 | SPEC-4 | T-198-10 | gate_answer verified against a live minted gate_id | integration | `node tests/test-198-gate-renderers.test.cjs` + flag-OFF smoke | ❌ W0 stub (198-01) | ⬜ pending |
| 198-06-01 | 06 | 3 | SPEC-2 | T-198-11 | framework_run halts at material steps, no second resolver | unit | require check + `--check` + local-only + flag-OFF smoke | ✅ (W0) | ⬜ pending |
| 198-06-02 | 06 | 3 | SPEC-2 | T-198-05 | status_read segments carry no room content | integration | `node tests/test-198-contract-schema.test.cjs` + flag-OFF smoke | ❌ W0 stub (198-01) | ⬜ pending |
| 198-07-01 | 07 | 4 | SPEC-3 | T-198-11 / T-198-12 | material step executes only after approve verdict tied to minted gate_id | integration | `node tests/test-198-chain-run-halt.test.cjs` + flag-OFF smoke | ❌ W0 stub (198-01) | ⬜ pending |
| 198-08-01 | 08 | 4 | SPEC-5 | T-198-13 / T-198-06 | migrated hooks reach the daemon on loopback only; forgiving statusline contract | integration | adapter-client load + `MINDRIAN_MCP_FIRST= node scripts/coherence-smoke-test.cjs` | ✅ (smoke exists) | ⬜ pending |
| 198-08-02 | 08 | 4 | SPEC-5 | T-198-13 | import audit fails closed on lib/core creep into migrated hooks | unit | `node tests/test-198-adapter-budget.test.cjs` | ❌ W0 stub (198-01) | ⬜ pending |
| 198-09-01 | 09 | 5 | SPEC-5 | T-198-14 | duplicate/irrelevant gate never fires; frozen floor read via check-card-fire.cjs, never re-minted | unit | dedup/handler load checks + local-only + flag-OFF smoke | ✅ (W0) | ⬜ pending |
| 198-09-02 | 09 | 5 | SPEC-5 | T-198-13 / T-198-14 | scripts/on-stop flag-ON branch has zero business invocations (bash grep audit); 2026-07-03 replay returns fire:false | integration | `node tests/test-198-adapter-budget.test.cjs` + flag-OFF smoke + `bash tests/run-all-198.sh` | ❌ W0 stub (198-01) | ⬜ pending |
| 198-10-01 | 10 | 6 | SPEC-7 | T-198-15 | snapshot restore via shipped migration-snapshot ledger; expand-only asserted | integration | `node scripts/198-rollback-rehearsal.cjs && node tests/test-198-flag-off-parity.test.cjs` | ❌ (this task creates rehearsal) | ⬜ pending |
| 198-10-02 | 10 | 6 | SPEC-6, SPEC-8 | T-198-02 / T-198-16 | empty node/edge diff across hosts; Plurai gate on measured baseline | integration + gate | `bash tests/parity-198.sh && node scripts/198-plurai-gate-check.cjs && node scripts/doctor.cjs --acceptance` | ❌ W0 scaffold (198-01) | ⬜ pending |
| 198-10-03 | 10 | 6 | SPEC-6 | T-198-06 | second host connects over loopback only | manual (checkpoint) | - (see Manual-Only below) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All owned by plan 198-01 (Wave 0):

- [ ] `tests/run-all-198.sh` - SKIP-safe aggregator (clone run-all-194.sh; run_if-gated legs)
- [ ] `tests/test-198-concurrency-mcp.test.cjs` - SPEC-1 stub (clone test-194-concurrency-integration; gated on lib/mcp/session-registry.cjs)
- [ ] `tests/test-198-contract-schema.test.cjs` - SPEC-2 stub (gated on lib/mcp/contract-version.cjs)
- [ ] `tests/test-198-chokepoint-guard.test.cjs` - SPEC-2 stub (gated on lib/mcp/tools/graph.cjs)
- [ ] `tests/test-198-chain-run-halt.test.cjs` - SPEC-3 stub (gated on lib/mcp/tools/chain.cjs)
- [ ] `tests/test-198-gate-renderers.test.cjs` - SPEC-4 stub (gated on lib/mcp/gate-render.cjs)
- [ ] `tests/test-198-adapter-budget.test.cjs` - SPEC-5 stub (gated on hooks.json migration marker)
- [ ] `tests/test-198-flag-off-parity.test.cjs` - SPEC-7 stub (gated on lib/mcp/mcp-first-flag.cjs)
- [ ] `tests/test-198-local-only.test.cjs` - Part 8 floor, NOT a stub (clone test-194-local-only; passes in Wave 0)
- [ ] `tests/parity-198.sh` - SPEC-6 transcript scaffold (all steps run_if-gated)
- [ ] `scripts/198-plurai-gate-check.cjs` + `evals/plurai/198-baseline.json` - SPEC-8 gate (clone 189; baseline_deferred seed)

No framework install needed - Node built-in assert + bash is the house convention.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-host parity: same transcript on an elicitation-capable non-Anthropic MCP host (VS Code v1.102+ or MCP Inspector) | SPEC-6 | The second host runs on the navigator's own install (RESEARCH Environment Availability: test-execution dependency the navigator supplies); Claude cannot drive VS Code's MCP client | Plan 198-10 Task 3 checkpoint: connect the host to the daemon on 127.0.0.1 (port from the pidfile), run the transcript (bind, reach card via elicitation, chain halt + approve, gated write, artifact), then `bash tests/parity-198.sh` with both legs present; confirm empty node/edge diff + identical gate sequence |

All other phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (21 automated tasks; 1 checkpoint task manual by design)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (plan 198-01 creates every test file the later plans name)
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (flips on 198-01 execution when `wave_0_complete: true`)
