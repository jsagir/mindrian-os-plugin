---
phase: 340
slug: canon-currency-audit-and-amendment-v1-24-to-next-close-the-d
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-05
---

# Phase 340 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None -- bare Node.js `assert` module, zero third-party test framework (confirmed via Read of `tests/test-canon-frozen-scalars-floor.cjs`, which requires only `node:assert`, `node:fs`, `node:path`) |
| **Config file** | none -- each `tests/test-canon-*-floor.cjs` is a standalone executable script; `tests/run-all-<phase>.sh` is a bash aggregator, not a config file |
| **Quick run command** | `node tests/test-canon-frozen-scalars-floor.cjs` (existing) plus the new `node tests/test-canon-entry-NN-<slug>-floor.cjs` this phase must write per amendment |
| **Full suite command** | `bash tests/run-all-340.sh` (does not yet exist -- Wave 0 gap), modeled on `tests/run-all-190.sh`'s aggregator pattern |
| **Estimated runtime** | ~5-15 seconds (bare Node assert scripts, no framework startup cost) |

---

## Sampling Rate

- **After every task commit:** Run the specific new floor test for that entry, e.g. `node tests/test-canon-entry-38-sourced-claims-floor.cjs`
- **After every plan wave:** Run `bash tests/run-all-340.sh` (once created) plus `node tests/test-canon-frozen-scalars-floor.cjs` plus every prior-entry floor test whose version anchor this wave bumps
- **Before `/gsd-verify-work`:** Full suite green, matching every prior canon-amending phase's own stated gate (e.g. `bash tests/run-all-190.sh` exit 0)
- **Max feedback latency:** ~15 seconds (no framework, no network -- pure local file reads)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 340-01-NN | TBD | TBD | CANON-01 (Sourced Claims, Part 12 + `agents/larry-extended.md` mirror) | N/A -- doc-integrity, not a threat surface | N/A | floor test | `node tests/test-canon-entry-38-sourced-claims-floor.cjs` | ❌ W0 | ⬜ pending |
| 340-01-NN | TBD | TBD | CANON-02 (Theo/Appendix C glossary origin fix) | N/A | N/A | floor test | `node tests/test-canon-entry-39-theo-glossary-floor.cjs` | ❌ W0 | ⬜ pending |
| 340-01-NN | TBD | TBD | CANON-03 (Part 9 two-chokepoint doctrinal split) | N/A | N/A | floor test | `node tests/test-canon-entry-40-two-chokepoint-floor.cjs` | ❌ W0 | ⬜ pending |
| 340-01-NN | TBD | TBD | CANON-04 (Appendix B code citations) | N/A | N/A | floor test | `node tests/test-canon-entry-41-icm-citations-floor.cjs` | ❌ W0 | ⬜ pending |
| 340-01-NN | TBD | TBD | CANON-05 (Part 4 edge-vocabulary reconciliation, 15 types) | N/A | N/A | floor test | `node tests/test-canon-entry-42-edge-reconciliation-floor.cjs` | ❌ W0 | ⬜ pending |
| 340-01-NN | TBD | TBD | CANON-06/07/08 (Part 7 command count, Part 2 Pinecone-retired, Part 11 surface count) | N/A | N/A | floor test(s) | per-entry, mirroring entries 13/16's lighter "corpus figures corrected" style | ❌ W0 | ⬜ pending |
| ALL | ALL | ALL | Frozen scalars unweakened across every wave | N/A | N/A | regression | `node tests/test-canon-frozen-scalars-floor.cjs` | ✅ exists | ⬜ pending |
| ALL | ALL | ALL | Prior 37 entries preserved, never removed/reworded | N/A | N/A | regression | existing entry-specific floor tests (`test-canon-entry-31-two-gauge-floor.cjs`, `test-canon-entry-36-shape-declaration-floor.cjs`) with version anchors bumped | ✅ existing, version-anchor bumps are new work each wave | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Exact task IDs, plan numbers, waves, and floor-test entry numbers are Claude's Discretion at planning time per CONTEXT.md -- this map uses RESEARCH.md's draft `CANON-NN` numbering as a starting point, not a locked assignment.*

---

## Wave 0 Requirements

- [ ] `tests/run-all-340.sh` -- does not exist yet; model on `tests/run-all-190.sh`'s aggregator pattern (glob-discover this phase's own floor tests, run frozen-scalar + prior-entry floor tests alongside them, exit non-zero on any failure)
- [ ] Individual `tests/test-canon-entry-NN-<slug>-floor.cjs` files, one per Appendix D entry this phase's plan decides to create -- entry numbers TBD at plan time (37 entries exist today; this phase's entries start at 38)
- [ ] Framework install: none needed (bare Node.js built-ins, already present and confirmed working via this session's own tool calls)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Exact Appendix D entry prose (wording, provenance paragraph, version bump) | CANON-01 through CANON-08 | Every one of the 37 prior amendments required navigator APPROVE at a blocking checkpoint on the literal text BEFORE any canon byte landed (Anti-Pattern in RESEARCH.md: "Landing a canon byte before the navigator blocking-checkpoint APPROVE"). No automated test can substitute for this sign-off. | A `checkpoint:human-verify` task presents the exact proposed prose diff for each wave; execution halts until the navigator responds APPROVE / REJECT (reason) / DEFER. |
| CLAUDE.md lockstep for Part 7 / Part 11 figures | CANON-06, CANON-08 | Confirming the parallel CLAUDE.md edit lands in the SAME commit/wave as the Canon prose edit is a review judgment (Pitfall 3 in RESEARCH.md), not a single automatable assertion, though `grep -rn "<stale figure>" CLAUDE.md docs/MINDRIAN-CANON.md` returning zero hits in both files is the automatable half. | After the wave lands, grep both files for the old stale figure; confirm zero hits in both, not just the Canon. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/run-all-340.sh` + per-entry floor tests)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter (pending plan completion)

**Approval:** pending
