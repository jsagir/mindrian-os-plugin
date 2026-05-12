---
phase: 122
slug: workflow-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-12
---

# Phase 122 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populate the body from `122-RESEARCH.md` -> `## Validation Architecture` during planning (`/gsd:plan-phase 122`). The skeleton below is the template; the planner fills it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:assert / hand-rolled CJS test files registered in `lib/memory/run-feynman-tests.cjs` (no jest/vitest/zod in this repo — see RESEARCH `## Standard Stack`) |
| **Config file** | none — tests are `tests/test-*.cjs` + `tests/test-*.sh`; aggregated by `tests/run-all.sh` (and the Feynman runner) |
| **Quick run command** | `node tests/test-command-registry.cjs` (and the per-plan suite as it lands) |
| **Full suite command** | `bash tests/run-all.sh` (or a scoped `tests/run-all-122.sh` if the planner adds one, mirroring `run-all-956.sh`) |
| **Estimated runtime** | TBD (planner) — keep the scoped 122 suite under ~10s |

---

## Sampling Rate

- **After every task commit:** Run the relevant `tests/test-*.cjs` for that task.
- **After every plan wave:** Run the scoped 122 suite (or `bash tests/run-all.sh` for the registry + resolver + CI-tripwire suites).
- **Before `/gsd:verify-work`:** Full 122 suite green; `scripts/build-command-registry.cjs --check` exits 0.
- **Max feedback latency:** ~10 seconds (planner to confirm).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 122-XX-XX | XX | X | WORKFLOW-122-XX | unit / integration | `{command}` | ❌ W0 | ⬜ pending |

*Planner fills this from `122-RESEARCH.md` -> `## Validation Architecture` -> `## Phase Requirements -> Test Map`.*
*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test-command-registry.cjs` — stubs for the registry generator + the `--check` drift tripwire
- [ ] `tests/test-command-resolver.cjs` — stubs for the resolver (framework -> command(s); degrade-don't-fabricate)
- [ ] `tests/test-command-frontmatter-schema.cjs` — stubs for the `frameworks:` / `kind:` / `produces:` / `inputs:` / `autonomous_safe:` frontmatter contract
- [ ] (planner to finalize against the 5 build sub-phases; register all new test files in `lib/memory/run-feynman-tests.cjs` and `tests/run-all.sh`)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Larry actually routing a methodology suggestion -> resolver -> a real `/mos:` in a live CLI session | WORKFLOW-122-XX | Requires a real conversational turn + the navigation hook firing; cannot be unit-tested end-to-end | In a fresh `claude` session in a room with `.room-root`: describe a problem; confirm the `## NAVIGATION DECISION` `offer_next_step` contains a command sequence that resolves (no hallucinated/wrong command); pick it; confirm it runs the right command. |
| The Brain `FEEDS_INTO` graph being current (the `framework-names.json` snapshot is fresh) | WORKFLOW-122-XX | Brain is a live remote endpoint; the snapshot is regenerated at build time, not test time | `node scripts/build-command-registry.cjs` then diff `data/framework-names.json` vs a fresh Brain query (manual, occasional). |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (new test files registered in the Feynman runner + `tests/run-all.sh`)
- [ ] No watch-mode flags
- [ ] Feedback latency < ~10s
- [ ] `nyquist_compliant: true` set in frontmatter (after the planner fills the body)

**Approval:** pending
