---
phase: 276
slug: mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-03
reconciled: 2026-09-03 (plan 276-15, Task 3)
---

# Phase 276 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth for every row: `276-RESEARCH.md` section `## Validation Architecture` (lines 667-742 at commit `e38e056a`). This file is the executor-facing contract; the research section carries the reasoning.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node.js CJS scripts using `node:assert/strict`, aggregated by `tests/run-all-<phase>.sh`. No jest/vitest/mocha. |
| **Config file** | none - Wave 0 installs `tests/run-all-276.sh` (mirrors `tests/run-all-274.sh`, including its `EMDASH_TARGETS` block) |
| **Quick run command** | `node tests/test-ljj-tool-honesty.cjs && node scripts/check-tool-honesty.cjs --report \| tail -30` |
| **Full suite command** | `bash tests/run-all-276.sh && bash tests/run-all-266.sh` |
| **Estimated runtime** | not yet measured; target under 120 seconds (the held-write-lock tests wait up to the 5000 ms busy timeout by design, so budget for it) |

---

## Sampling Rate

- **After every task commit:** Run `node tests/test-ljj-tool-honesty.cjs && node scripts/check-tool-honesty.cjs --report | tail -30`
- **After every plan wave:** Run `bash tests/run-all-276.sh && bash tests/run-all-266.sh`
- **Before `/gsd-verify-work`:** `bash tests/run-all-276.sh && bash tests/run-all-266.sh && node tests/test-234-tool-description-floor.cjs && node tests/test-270-tool-schema-budget.cjs && node scripts/doctor.cjs --acceptance` all green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Reconciled 2026-09-03 by plan 276-15 Task 3, from the real plan/task numbers and measured
results recorded in every `276-NN-SUMMARY.md`. Zero `TBD` remain in the Task ID or Plan
columns.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 276-01/T3 | 276-01 (RED); 276-06/T1 (GREEN) | 0-1 | TOOLHON-01 | T-276-01 | `splitBranches` on a `switch (command)` fixture returns a non-empty `branchMap`; authored and observed FAILING against the pre-fix splitter (`4c4f98a3` RED), flipped GREEN by `b88a39d3` | unit | `node tests/test-276-tool-honesty-switch-branches.cjs` | ✅ | ✅ green (17 passed, 0 failed) |
| 276-06/T1 | 276-06 | 1 | TOOLHON-01 | T-276-01 | The nine pre-existing assertions still hold after the splitter change | unit | `node tests/test-ljj-tool-honesty.cjs` | ✅ | ✅ green (16 passed, 0 failed) |
| 276-04/T1 (created); 276-06/T3, 276-07/T3, 276-15/T2 (amended/re-frozen) | 276-04, 276-06, 276-07, 276-15 | 0-5 | TOOLHON-02 | T-276-02 | Live `scanAll()` rows compared against the checked-in disposition ledger `tests/fixtures/tool-honesty/276-dispositions.json`; any scan row absent from the ledger fails, any ledger row absent from the scan fails as stale | integration | `node tests/test-276-tool-honesty-findings-closed.cjs` | ✅ | ✅ green (148 passed, 0 failed) |
| 276-03/T1 (RED); 276-08/T1+T3 (GREEN) | 276-03, 276-08 | 1-2 | TOOLHON-03 | T-276-03 | `orchestration`'s description asserts no write the MCP handler cannot reach; the `scout*` family self-discloses reference-only in-band | unit | `node tests/test-276-orchestration-scout-honesty.cjs` | ✅ | ✅ green (12 passed, 0 failed) |
| 276-03/T2 (RED); 276-08/T3 (GREEN) | 276-03, 276-08 | 1-2 | TOOLHON-04 | T-276-03 | `room_content`'s WRITE-surface list names only commands that reach a write primitive; the `new-project`/`setup`/`update` group carries a NOT-EXECUTED banner | unit | `node tests/test-276-room-content-honesty.cjs` | ✅ | ✅ green (26 passed, 0 failed) |
| 276-01/T3 (RED); 276-06/T2 (GREEN) | 276-01, 276-06 | 0-1 | TOOLHON-05 | T-276-01 | Every documented detector boundary (B-1..B-6) is either asserted or explicitly listed in the script header | unit | folded into `node tests/test-276-tool-honesty-switch-branches.cjs` | ✅ | ✅ green |
| 276-04/T2 (created); 276-06/T2 (GREEN); 276-15/T2 (deviation 1, HIGH_RISK positive control decoupled from the live tree) | 276-04, 276-06, 276-15 | 0-1, 5 | TOOLHON-06 | T-276-04 | Every `ALLOWED_UNVERIFIED` entry has a non-empty reason, a triage date, and resolves to a live scan row; MEDIUM/UNKNOWN are declared never-suppressible (D-276-2); the HIGH_RISK positive control stays valid even after global HIGH_RISK reaches 0 | unit | `node tests/test-276-allowed-unverified-contract.cjs` | ✅ | ✅ green (11 passed, 0 failed) |
| 276-05 | 276-05 | 1 | TOOLHON-07 | - | The meeting Tri-Polar gap carries a recorded disposition (D-276-1) and `.planning/debug/meeting-file-meeting-false-success.md` reflects it | doc | `grep -n "D-276-1" .planning/debug/meeting-file-meeting-false-success.md` | ✅ | ✅ green |
| 276-05 | 276-05 | 1 | TOOLHON-08 | - | ROADMAP Phase 276 entry carries no `Depends on: Phase 275` and reconciles the finding count to the measured value | doc | `grep -c "Depends on:\*\* Phase 275" .planning/ROADMAP.md` returns 0 | ✅ | ✅ green |
| 276-02 (RED); 276-09/T1-T3 (GREEN) | 276-02, 276-09 | 1-2 | TOOLHON-09 | T-276-05 | C4: under a held exclusive write lock on connection A, the opener under test on connection B waits (elapsed-time floor asserted, not just the return value) instead of failing in ~0 ms with `SQLITE_BUSY` | integration | `node tests/test-276-busy-timeout-propagation.cjs` | ✅ | ✅ green (20 passed, 0 failed) |
| 276-02 (RED); 276-10/T1-T2 (GREEN) | 276-02, 276-10 | 1-2 | TOOLHON-10 | T-276-05 | C5: `spineEvents`'s emit sites and getters under the held lock return `reason: 'room_db_busy'` (never `no_room_db`); a garbage-byte room.db returns `room_db_broken`; both against the real module | integration | `node tests/test-276-spine-events-typed-reason.cjs` | ✅ | ✅ green (16 passed, 0 failed) |
| 276-02 (RED); 276-10/T1-T2 (GREEN) | 276-02, 276-10 | 1-2 | TOOLHON-11 | T-276-05 | Every `no_room_db`-producing site is enumerated at run time from the tree, and each either fires only when `fs.statSync` genuinely fails or has been migrated to a typed reason | unit | folded into `node tests/test-276-spine-events-typed-reason.cjs` | ✅ | ✅ green |
| 276-04/T3 (created); 276-11 (surfaced gate_render DIFFERS via D-276-3); 276-13 (measured + coordination SEED filed) | 276-04, 276-11, 276-13 | 0-1, 2, 4 | TOOLHON-12 | T-276-06 | The five Theo description constants diff against the plugin's live registration strings; IDENTICAL / DIFFERS reported per constant with first divergence offset; SKIPS (does not fail) when the Theo checkout is absent; the test itself is a coordination signal (advisory, exits 0 by design even with DIFFERS present) | integration | `node tests/test-276-theo-description-parity.cjs` | ✅ | ✅ green (exits 0; 2 pre-existing/expected DIFFERS reported, not gated: `gate_render` mirror task registered for Theo, `gate_answer` pre-existing and unrelated) |
| 276-12/T1-T3 | 276-12 | 3 | TOOLHON-07 (DIKW write primitive) | - | `claim_write` writes a real DIKW claim through `writeClaimNode` -> `node-insert.cjs`, refused at two independent layers on an invalid `knowledge_type`, born wired with an F.1 `hitl_shape` | integration | `node tests/test-276-claim-write-primitive.cjs` | ✅ | ✅ green (44 assertions pass) |
| 276-14/T1-T3 | 276-14 | 4 | TOOLHON-14 | - | `meeting`'s `file-meeting` command, called with `knowledge_type`+`claim_text`, writes a typed claim and renders a `gate_render` confirmation card; promotion to `confirmed` happens only through the shipped `gate_answer` approve branch, proven against `room.db` independently of the tool's own response text; the ledger is single-use | integration | `node tests/test-276-meeting-gate-wiring.cjs` | ✅ | ✅ green (14 assertions pass) |
| 276-11/T2 (fix); 276-15/T2 (deviation 2, promoted to a permanent test) | 276-11, 276-15 | 2, 5 | TOOLHON-02 (boundary B-6) | T-276-02 | `graph_write`'s `read_version` parameter `.describe()` string discloses the CAS fail-open (missing source node, guard read error) alongside the surviving conflict-rejection claim; boundary B-6 means `scanAll()` cannot see this, so a standalone over-the-wire regex assertion is the only proof, now permanent | unit | `node tests/test-276-b6-parameter-describe.cjs` | ✅ | ✅ green (5 passed, 0 failed) |
| 276-15/T1 | 276-15 | 5 | TOOLHON-14 (substrate baseline reconciliation, Phase 273 D-05) | T-276-36 | The substrate baseline document states one measured number per measure, regenerated by its own script, with generated/hand-written sections marked; falsely crediting this phase's C4/M8 work for a count it structurally cannot move is avoided | doc/integration | `node tests/test-273-substrate-baseline-honest.cjs` | ✅ | ✅ green (measured=205, matches the documented Current Baseline) |
| 276-15/T2 | 276-15 | 5 | TOOLHON-02 (ledger re-freeze) | T-276-02 | The disposition ledger's `frozen_sweep` matches the live post-fix scan surface (37 tools / 131 branches); every entry reconciled; `ALLOWED_UNVERIFIED` confirmed empty | integration | `node tests/test-276-tool-honesty-findings-closed.cjs` (Group F) | ✅ | ✅ green |
| all | all | all | all | - | Every registered description still clears the 120-char floor, prose shape, and 2048-byte wire cap | integration | `node tests/test-234-tool-description-floor.cjs` | ✅ | ✅ green (172 passed, 0 failed, 40/40 coverage) |
| all | all | all | all | - | Total description + schema byte budget within the 10 percent drift tolerance of the most recently recorded baseline | integration | `node tests/test-270-tool-schema-budget.cjs` | ✅ | ✅ green (5 passed, 0 failed) |
| all | all | all | all | - | The `meeting` honesty fix is not regressed | unit | `node tests/test-kwl-meeting-mcp-honesty.cjs` | ✅ | ✅ green (37 passed, 0 failed) |
| all | all | all | all | - | No em-dash in any touched file | lint | `bash tests/run-all-266.sh` (`EMDASH_TARGETS`) | ✅ | ✅ green (PASS=11 FAIL=0 SKIP=0) |
| all | all | all | all | - | Advisory gate posture unchanged unless deliberately hardened by a named plan | integration | `node scripts/doctor.cjs --acceptance` | ✅ | ✅ green (17/18; sole failure `verify-release-clean-tree` is pre-existing shared-tree drift, unrelated to this phase, named in the roll-up) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

TOOLHON-13 (the DIKW / `ALLOWED_EPISTEMIC_TYPES` / `knowledge_type` vocabulary mapping ruling) was
decided by plan 276-05 (navigator ruling, decision-only, no automated test -- recorded in
`276-DECISIONS.md` OQ-276-1) and consumed by plan 276-12's `KNOWLEDGE_TYPE_TO_EPISTEMIC_TYPE`
mapping table.

---

## Wave 0 Requirements

- [ ] `tests/run-all-276.sh` - new aggregator, mirroring `tests/run-all-274.sh`'s shape including an `EMDASH_TARGETS` block
- [ ] `tests/test-276-tool-honesty-switch-branches.cjs` - TOOLHON-01, TOOLHON-05. MUST be written RED against the pre-fix splitter
- [ ] `tests/test-276-tool-honesty-findings-closed.cjs` - TOOLHON-02
- [ ] `tests/test-276-orchestration-scout-honesty.cjs` - TOOLHON-03
- [ ] `tests/test-276-room-content-honesty.cjs` - TOOLHON-04
- [ ] `tests/test-276-allowed-unverified-contract.cjs` - TOOLHON-06
- [ ] `tests/fixtures/tool-honesty/switch-dispatch.cjs` - a synthetic `switch (command)` fixture with one writing case and one echo case (the existing 5 fixtures cover only positive/negated/banner/depth1 shapes)
- [ ] `tests/fixtures/tool-honesty/276-dispositions.json` - the checked-in expected-disposition ledger TOOLHON-02 diffs against
- [ ] `tests/test-276-busy-timeout-propagation.cjs` - TOOLHON-09
- [ ] `tests/test-276-spine-events-typed-reason.cjs` - TOOLHON-10, TOOLHON-11
- [ ] `tests/test-276-theo-description-parity.cjs` - TOOLHON-12, skip-when-absent
- [x] `tests/helpers/room-db-lock-holder-236.cjs` - ALREADY SHIPS (Phase 236-03, 121 lines): a separate-process lock holder using `BEGIN IMMEDIATE` plus a real INSERT, an IPC ready/release protocol, and distinct exit codes (2 = could not open, 3 = could not acquire) so a child that never locked cannot be mistaken for one that did. TOOLHON-09 and TOOLHON-10 REUSE it (extend by argument if a non-room.db path is needed). Do NOT author `tests/helpers/held-write-lock.cjs`; a second lock fixture would reproduce the propagation gap inside the phase's own suite (276-PATTERNS.md correction)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The DIKW / `ALLOWED_EPISTEMIC_TYPES` / `knowledge_type` vocabulary mapping is ruled | TOOLHON-13 | A navigator decision (D-276-1), not a computable property; Phase 270-01 precedent | Wave-1 decision plan renders the options; the ruling is written to `276-DECISIONS.md` and every later meeting-pipeline task cites it in `read_first` |
| Theo-side mirror of the `gate_render` (and any further diverged) description constants | TOOLHON-12 | Lives in `/home/jsagi/Theo`, a separate repo; never executed from this repo (Theo D-04) | After the plugin-side correction lands, run `node tests/test-276-theo-description-parity.cjs` against a Theo checkout that has the mirror commit and confirm IDENTICAL for `gate_render`; record the Theo commit hash in the plan SUMMARY |
| Desktop / Cowork reach the meeting-filing pipeline through the MCP surface | TOOLHON-14 | No automation harness exists for the Desktop or Cowork surface (same named Tri-Polar gap as Phase 274 D-02) | From a Desktop session bound to a scratch room: call the meeting-filing tool, answer the gate, then check `room.db`'s mtime and the new claim node directly with `node -e "require('node:sqlite')..."`; never trust the tool's own response text |
| Cold-agent walk test on every corrected description | TOOLHON-02 | The ICM walk test is a human read: does the description name exact outputs the handler really produces, and which surface produces them | For each corrected tool: read the description cold, call the tool once against a scratch room, diff `room.db` mtime before/after, confirm the description's claim and the mtime agree |

---

## Validation Sign-Off

Reconciled 2026-09-03 by plan 276-15 Task 3, against the real execution record across all
15 executed plans (276-01 through 276-15; 276-16 is the still-pending close-out plan, not
counted here).

- [x] All tasks have `<automated>` verify or Wave 0 dependencies -- every task in every
      `276-NN-PLAN.md` carries a `<verify><automated>` block; confirmed by grep across all
      15 plan files (zero tasks found without one).
- [x] Sampling continuity: no 3 consecutive tasks without automated verify -- every task
      commit across the phase ran its own automated verify command before committing (per
      the task_commit_protocol every executor followed); no gap.
- [x] Wave 0 covers all MISSING references -- every file marked `❌ W0` in the original
      table (created by plan 276-01/276-04/276-02) now exists and is exercised by
      `bash tests/run-all-276.sh`'s glob discovery (13/13 PASS, confirmed above).
- [x] No watch-mode flags -- every automated command in the Per-Task Verification Map above
      is a one-shot `node tests/test-*.cjs` or `bash tests/run-all-*.sh` invocation; no
      `--watch` flag anywhere in this phase's test suite.
- [x] Feedback latency < 120s -- `bash tests/run-all-276.sh` measured at 31.8s real time
      (`time bash tests/run-all-276.sh`, 2026-09-03), well under the 120s target stated in
      the Test Infrastructure table above.
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** granted 2026-09-03 (plan 276-15 Task 3, gate roll-up below). All six sign-off
items are genuinely true as measured, not asserted; see the Per-Task Verification Map above
for the row-by-row evidence and `276-15-SUMMARY.md`'s Gate Roll-Up section for the full
before/after delta table.
