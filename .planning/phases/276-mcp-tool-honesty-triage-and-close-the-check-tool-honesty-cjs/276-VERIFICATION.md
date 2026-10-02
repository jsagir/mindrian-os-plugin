---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
verified: 2026-10-02T02:00:00Z
status: gaps_found
score: 12/14 requirements fully verified in the current tree (TOOLHON-02 and TOOLHON-14 verified at phase close, now red from downstream drift); 5/5 roadmap pieces delivered, piece 2 qualified by the Desktop routing defect
overrides_applied: 0
re_verification: false
gaps:
  - truth: "TOOLHON-02: the disposition ledger's frozen_sweep matches the live scanAll() surface, so a changed scan surface cannot pass unseen"
    status: failed
    reason: "tests/test-276-tool-honesty-findings-closed.cjs is 146 passed / 2 failed in the current tree (Group F). Ledger frozen_sweep is 41 tools / 135 branches (last re-frozen by Phase 358-10, 7dbac7f92); live scanAll() is 42 / 136. Cause is downstream of Phase 276: Phase 365/366 work plus the in-flight, uncommitted Phase 267-08 registerTool migration (modified lib/mcp/tools/graph.cjs and scripts/check-tool-honesty.cjs in the shared working tree). The guard is doing exactly what 276 built it to do. The 12 non-OK rows are all still dispositioned; only the totals drifted."
    artifacts:
      - path: "tests/fixtures/tool-honesty/276-dispositions.json"
        issue: "frozen_sweep.tools=41 / branches=135 vs live 42 / 136"
    missing:
      - "Re-freeze frozen_sweep (and ok count) once Phase 267-08 lands, per the 358-10 precedent, in the same commit that adds the tool"
  - truth: "TOOLHON-14: SUBSTRATE-BASELINE.md documents one measured number that equals check-substrate.cjs's own count"
    status: failed
    reason: "node tests/test-273-substrate-baseline-honest.cjs exits 1: measured 204, documented 205. Verified at 276-15 close (205) but drifted by one since (some committed change removed one raw-write violation). The doc has no newer dated re-measurement section."
    artifacts:
      - path: "docs/architecture/SUBSTRATE-BASELINE.md"
        issue: "latest 're-measurement' section states Result: **205**; live count is 204"
    missing:
      - "Append a dated re-measurement section stating Result: **204** (run node scripts/check-substrate.cjs --baseline)"
  - truth: "Roadmap piece 2 / TOOLHON-07: Desktop and Cowork reach the meeting-filing pipeline and the write lands where the user bound"
    status: partial
    reason: "Navigator's Desktop check (276-16 Task 3, 2026-10-02) proved HONESTY (tool response matched room.db exactly) but the write landed in a global-registry fallback room (/tmp/birth-idem-.../idem-room), not the bound room ador-ip-test; room_bind failed with no_session_id and claim_write ignores an explicit-sessionId bind. No gate was approved on Desktop. Cowork was not exercised. The SUMMARY routes this to .planning/debug/desktop-session-binding-fallback.md, which DOES NOT EXIST (grep finds it referenced only in 276-16-SUMMARY.md and test-birth-registry-leak.md)."
    artifacts:
      - path: ".planning/debug/desktop-session-binding-fallback.md"
        issue: "named owner of the routing defect is missing; the defect has no tracked home"
    missing:
      - "Create the .planning/debug/desktop-session-binding-fallback.md RCA (or register the defect elsewhere with a real owner)"
      - "Cowork surface check remains unperformed"
human_verification:
  - test: "Cowork: bind a scratch room, file a meeting claim, answer the gate, read room.db directly"
    expected: "Claim lands in the BOUND room as proposed, then confirmed after approve; tool text matches room.db"
    why_human: "No automation harness exists for Cowork; Desktop routing currently fails (see gap 3) so this cannot pass until that RCA is fixed"
---

# Phase 276: Same-Disease Consolidation (MCP + Local-Graph False-Success Deep Fixes) Verification Report

**Phase Goal:** Consolidate every known "claims success it does not deliver" instance into one phase: (1) triage and close every `check-tool-honesty.cjs` finding, (2) resolve the meeting-filing Tri-Polar gap, (3) extend the checker or document the argument-gated-write boundary, (4) C4 busy-timeout propagation, (5) C5 spine-events typed reason.
**Verified:** 2026-10-02
**Status:** gaps_found (two drifted guards plus one missing owner file; the substantive fixes are real)
**Re-verification:** No, initial verification

All test runs used a fresh `mktemp -d` for both `HOME` and `MINDRIAN_ROOMS_HOME`. The real `~/MindrianRooms/.rooms/registry.json` md5 was checked before and after: unchanged. `test-section-nodes-birth-and-migration.cjs` was never run.

## Goal Achievement

### Observable Truths (ROADMAP pieces + TOOLHON requirements)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| R1 | Every checker finding triaged and closed with a written disposition | VERIFIED | Live sweep: 0 HIGH_RISK, 12 MEDIUM, 0 LOW, 0 UNKNOWN; all 12 carry ledger dispositions (Group A/B/D of findings-closed test pass). `ALLOWED_UNVERIFIED` empty. |
| R2 | Meeting-filing Tri-Polar gap resolved | PARTIAL | `claim_write` + gate wiring built and test-proven against room.db (see TOOLHON-07); Desktop live check: honest but wrong-room (gap 3). |
| R3 | argument-gated-write limitation extended or documented | VERIFIED | B-1..B-6 enumerated in script header; asserted by TOOLHON05_BOUNDARIES (17/17 in switch-branches test). |
| R4 | C4: busy-timeout propagated | VERIFIED | `lazygraph-ops.cjs:441` and `cross-room-store.cjs:77` now pass `{ timeout: 5000 }`, plus 11 other writer openers; read-only / `:memory:` openers correctly excluded. Held-lock test 20/20. |
| R5 | C5: spine-events typed reason | VERIFIED | `_classifyOpenError` yields `room_db_busy` / `room_db_broken` / `room_db_open_failed`; the remaining `no_room_db` returns (lines 192, 274) sit behind `_hasRoomDb` (genuine absence). Test 16/16. |
| T01 | splitBranches splits `switch (command)` | VERIFIED | switch-branches test 17/0; GREEN commit `b88a39d3e`. |
| T02 | Ledger matches live scan | FAILED (drift) | 146/2; ledger 41/135 vs live 42/136. See gap 1. |
| T03 | orchestration.scout honest | VERIFIED | test 12/0; HIGH_RISK global 0. |
| T04 | room_content WRITE list honest | VERIFIED | test 26/0. |
| T05 | Boundaries enumerated | VERIFIED | see R3. |
| T06 | ALLOWED_UNVERIFIED contract | VERIFIED | test 11/0. |
| T07 | meeting gap disposition + claim write path | VERIFIED (tests) | claim-write 44 assertions pass; meeting-gate-wiring 14 pass incl. single-use gate and confirmed node read via node:sqlite. `276-DECISIONS.md` exists. |
| T08 | ROADMAP count reconciled, stale dep removed | VERIFIED | Phase 276 entry states 10/24/12 sequence; the only `Depends on:** Phase 275` hit (line 938) belongs to a different phase. (ROADMAP still shows "15/16 plans executed" and 276-16 unchecked: stale bookkeeping, orchestrator-owned.) |
| T09 | C4 | VERIFIED | see R4. |
| T10 | C5 | VERIFIED | see R5. |
| T11 | no_room_db census run-time | VERIFIED | folded into spine-events test (passes). |
| T12 | Theo description parity signal | VERIFIED | test exits 0 (advisory by design); Theo mirror SEED present at `docs/2026-09-03-THEO-SEED-tool-honesty-ts-ast-port.md`. |
| T13 | Vocabulary ruling + flip-day items | VERIFIED | `276-DECISIONS.md` OQ-276-1; b6-parameter-describe test 5/0. |
| T14 | M8 comment + baseline reconciliation | FAILED (drift) | M8 comment corrected (`room-db.cjs:149-160`). Baseline test red 204 vs 205. See gap 2. |

**Score:** 12/14 TOOLHON requirements verified now; the two failures are downstream drift, not unbuilt work.

### Behavioral Spot-Checks / Probe Execution

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| Phase aggregator | `bash tests/run-all-276.sh` (sandboxed HOME) | PASS=12 FAIL=1; only failure is findings-closed Group F | FAIL (drift) |
| found-eq-0 guard, Part 8 sweep, em-dash fence | same run | PASSED | PASS |
| checker unit | `node tests/test-ljj-tool-honesty.cjs` | 16/0 | PASS |
| description floor | `node tests/test-234-tool-description-floor.cjs` | 192/0 (45/45 tools) | PASS |
| schema budget | `node tests/test-270-tool-schema-budget.cjs` | 5/0 | PASS |
| meeting honesty not regressed | `node tests/test-kwl-meeting-mcp-honesty.cjs` | 37/0 | PASS |
| em-dash lint | `bash tests/run-all-266.sh` | PASS=11 FAIL=0 | PASS |
| substrate baseline | `node tests/test-273-substrate-baseline-honest.cjs` | exit 1, 204 vs 205 | FAIL (drift) |

No `scripts/*/tests/probe-*.sh` probes are declared by this phase. `doctor.cjs --acceptance` was not re-run (shared-tree drift noted by 276-15 is unrelated).

### Anti-Patterns

No TBD/FIXME/XXX in the phase's production files or tests. No stubs found: `claim_write` (254 lines) routes through `node-insert.cjs`; spine-events classification is substantive.

### Human Verification Required

1. **Cowork meeting filing** (no harness; blocked on Desktop routing fix). Test: bind scratch room, file claim, answer gate, read room.db directly. Expected: claim in bound room, proposed then confirmed.

### Gaps Summary

The honesty fixes themselves (detector, descriptions, C4, C5, claim-write, gate wiring) are present, wired, and test-proven in a sandboxed run. Three things keep this from `passed`:

1. The disposition ledger frozen totals (41/135) no longer match the live scan (42/136). Cause is Phase 365/366 plus the uncommitted Phase 267-08 registerTool work in the shared tree, not Phase 276. A re-freeze in the commit that settles 267-08 closes it.
2. The substrate baseline doc says 205; the tree measures 204. Append a dated re-measurement section.
3. The Desktop live check showed the claim_write lands in a global-registry fallback room instead of the bound room. The tool told the truth about it (this phase's subject holds), but the Tri-Polar goal "Desktop reaches the pipeline" is only half met, Cowork is unchecked, and the RCA file the SUMMARY names as owner (`.planning/debug/desktop-session-binding-fallback.md`) was never created.

Gaps 1 and 2 are one-commit bookkeeping fixes. Gap 3 needs the missing RCA filed; the underlying routing fix is correctly out of this phase's honesty scope.

---

_Verified: 2026-10-02_
_Verifier: Claude (gsd-verifier)_
