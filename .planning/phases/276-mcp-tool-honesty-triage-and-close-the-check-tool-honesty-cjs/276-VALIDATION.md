---
phase: 276
slug: mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-03
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

Task IDs are assigned by the planner; rows are keyed by requirement until then. The planner MUST map every task onto one of these rows or add a row here in the same commit.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | TOOLHON-01 | T-276-01 | `splitBranches` on a `switch (command)` fixture returns a non-empty `branchMap`; authored and observed FAILING against the pre-fix splitter before the fix lands (`209b604f` RED / `75278850` GREEN precedent) | unit | `node tests/test-276-tool-honesty-switch-branches.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TOOLHON-01 | T-276-01 | The nine pre-existing assertions still hold after the splitter change | unit | `node tests/test-ljj-tool-honesty.cjs` | ✅ | ⬜ pending |
| TBD | TBD | 2 | TOOLHON-02 | T-276-02 | Live `scanAll()` rows compared against the checked-in disposition ledger `tests/fixtures/tool-honesty/276-dispositions.json`; any scan row absent from the ledger fails, any ledger row absent from the scan fails as stale | integration | `node tests/test-276-tool-honesty-findings-closed.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TOOLHON-03 | T-276-03 | `orchestration`'s description asserts no write the MCP handler cannot reach; the `scout*` family self-discloses reference-only in-band | unit | `node tests/test-276-orchestration-scout-honesty.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TOOLHON-04 | T-276-03 | `room_content`'s WRITE-surface list names only commands that reach a write primitive; the `new-project`/`setup`/`update` group carries a NOT-EXECUTED banner | unit | `node tests/test-276-room-content-honesty.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TOOLHON-05 | T-276-01 | Every documented detector boundary (B-1..B-5) is either asserted or explicitly listed in the script header | unit | folded into `node tests/test-276-tool-honesty-switch-branches.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TOOLHON-06 | T-276-04 | Every `ALLOWED_UNVERIFIED` entry has a non-empty reason, a triage date, and resolves to a live scan row; MEDIUM/UNKNOWN are declared never-suppressible (D-276-2) | unit | `node tests/test-276-allowed-unverified-contract.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | TOOLHON-07 | - | The meeting Tri-Polar gap carries a recorded disposition (D-276-1: in this phase, gated on the wave-1 vocabulary ruling) and `.planning/debug/meeting-file-meeting-false-success.md` reflects it | doc | `grep -n "D-276-1" .planning/debug/meeting-file-meeting-false-success.md` | ✅ | ⬜ pending |
| TBD | TBD | 1 | TOOLHON-08 | - | ROADMAP Phase 276 entry carries no `Depends on: Phase 275` and reconciles the finding count to the measured value | doc | `grep -c "Depends on:\*\* Phase 275" .planning/ROADMAP.md` returns 0 | ✅ | ⬜ pending |
| TBD | TBD | 2 | TOOLHON-09 | T-276-05 | C4: under a held exclusive write lock on connection A, the opener under test on connection B waits (elapsed-time floor asserted, not just the return value) instead of failing in ~0 ms with `SQLITE_BUSY` | integration | `node tests/test-276-busy-timeout-propagation.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TOOLHON-10 | T-276-05 | C5: `spineEvents.logSpineRead` under the held lock returns `reason: 'room_db_busy'` (never `no_room_db`); a garbage-byte room.db returns `room_db_broken`; both against the real module | integration | `node tests/test-276-spine-events-typed-reason.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | TOOLHON-11 | T-276-05 | Every `no_room_db`-producing site is enumerated at run time from the tree, and each either fires only when `fs.statSync` genuinely fails or has been migrated to a typed reason | unit | folded into `node tests/test-276-spine-events-typed-reason.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | TOOLHON-12 | T-276-06 | The five Theo description constants (pinned to Theo `83a1ce2`) diff against the plugin's live registration strings; IDENTICAL / DIFFERS reported per constant with first divergence offset; SKIPS (does not fail) when the Theo checkout is absent | integration | `node tests/test-276-theo-description-parity.cjs` | ❌ W0 | ⬜ pending |
| TBD | TBD | all | all | - | Every registered description still clears the 120-char floor, prose shape, and 2048-byte wire cap | integration | `node tests/test-234-tool-description-floor.cjs` | ✅ | ⬜ pending |
| TBD | TBD | all | all | - | Total description + schema byte budget within the 10 percent drift tolerance | integration | `node tests/test-270-tool-schema-budget.cjs` | ✅ | ⬜ pending |
| TBD | TBD | all | all | - | The `meeting` honesty fix is not regressed | unit | `node tests/test-kwl-meeting-mcp-honesty.cjs` | ✅ | ⬜ pending |
| TBD | TBD | all | all | - | No em-dash in any touched file | lint | `bash tests/run-all-266.sh` (`EMDASH_TARGETS`) | ✅ | ⬜ pending |
| TBD | TBD | all | all | - | Advisory gate posture unchanged unless deliberately hardened by a named plan | integration | `node scripts/doctor.cjs --acceptance` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

TOOLHON-13 and TOOLHON-14 (per `276-RESEARCH.md`'s requirement table) are covered by the wave-1 decision plan and the meeting-pipeline build wave respectively; their rows are added by the planner once task IDs exist.

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

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
