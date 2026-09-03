---
phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs
plan: 15
subsystem: tool-honesty-close-out
tags: [mcp-tool-honesty, substrate-baseline, disposition-ledger, gate-roll-up, validation-reconciliation, phase-close]

# Dependency graph
requires:
  - phase: 276-07
    provides: "the 26-entry disposition ledger this plan re-freezes (24 original + 2 intelligence rows added by 276-07's own B-4 fix)"
  - phase: 276-08
    provides: "orchestration/export/room_content honesty fixes, the reason the ledger's 12 HIGH_RISK-at-freeze rows resolved to OK"
  - phase: 276-09
    provides: "the busy-timeout constructor-option propagation (C4), one of the two substrate-adjacent plans this plan's Task 1 confirms did NOT move the substrate baseline count"
  - phase: 276-10
    provides: "the typed-reason classification and doc-comment correction (C5/M8), the second substrate-adjacent plan Task 1 confirms did not move the count"
  - phase: 276-11
    provides: "gate_render's OK-resolving description fix, and the B-6 over-the-wire assertion this plan's Task 2 promotes into a permanent test"
  - phase: 276-12
    provides: "claim_write, the tool addition that invalidated the b88a39d3 freeze (36/130 -> 37/131), the reason Task 2's re-freeze exists"
  - phase: 276-14
    provides: "the meeting gate wiring, one of the tasks this plan's Task 3 adds a 276-VALIDATION.md row for"
provides:
  - "docs/architecture/SUBSTRATE-BASELINE.md: a regenerated GENERATED 'Current Baseline' section stating the one number that matters today (205), with generated-vs-hand-written sections marked and the 195/208/205 historical figures disambiguated as dated snapshots"
  - "tests/fixtures/tool-honesty/276-dispositions.json: re-frozen against the live 37-tool/131-branch scan surface, refrozen_at recorded, 14 entries confirmed resolved with resolved_at_commit, 12 permanently-visible MEDIUM entries confirmed unchanged"
  - "tests/test-276-allowed-unverified-contract.cjs: Group B's HIGH_RISK positive control decoupled from the live tree onto the synthetic fixture_positive fixture (deviation directive 1)"
  - "tests/test-276-b6-parameter-describe.cjs: a new permanent, glob-discovered test promoting 276-11's B-6 over-the-wire assertion (deviation directive 2)"
  - ".planning/phases/276-.../276-VALIDATION.md: every TBD replaced with real plan/task numbers and measured status; nyquist_compliant/wave_0_complete set true, both verified"
affects: ["276-16 (the phase close-out plan reads this plan's gate roll-up and reconciled validation contract as its own starting evidence)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regenerate-with-marked-provenance, not hand-correct: SUBSTRATE-BASELINE.md now carries an explicit '[GENERATED]' section stating the live-measured number, with every other section marked '[HAND-WRITTEN]' or left as a dated historical snapshot anchored to its own heading, per icm-architect's 'schema documents that mandate names the actual files stopped using -- update the schema or the files, pick one.'"
    - "Reuse an existing synthetic fixture over minting a new one: the HIGH_RISK positive-control fix (deviation directive 1) reused tests/fixtures/tool-honesty/positive.cjs, already shipped for test-ljj-tool-honesty.cjs's own POSITIVE_SYNTHETIC assertion, rather than authoring a second HIGH_RISK fixture -- one canonical synthetic HIGH_RISK source in the suite."
    - "Ledger re-freeze carries its own audit trail: refrozen_at names the cause (claim_write's tool addition) and resolved_at_commit is recorded per closed entry, so a future reader can trace exactly which commit closed which finding without re-deriving it from prior SUMMARYs."

key-files:
  created:
    - tests/test-276-b6-parameter-describe.cjs
  modified:
    - docs/architecture/SUBSTRATE-BASELINE.md
    - tests/fixtures/tool-honesty/276-dispositions.json
    - tests/test-276-allowed-unverified-contract.cjs
    - .planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/276-VALIDATION.md

key-decisions:
  - "Task 1's literal framing ('resolve the three-number drift to one number') was satisfied by disambiguation, not deletion: 195 (Phase 128-03, 2026-05-30), 208 (Phase 273, 2026-08-31), and 205 (R17, 2026-09-03) are three genuinely different dated measurements of a moving target, not three competing claims about today's count. Deleting the history would lose the debt-reduction trend (195 -> 208 -> 205); instead a new '[GENERATED] Current Baseline' section states the ONE number a fresh reader should treat as current (205, this plan's own re-measurement at commit 48db8772, unchanged from the R17 figure), and every prior occurrence is re-worded to name its own dated heading explicitly."
  - "This phase's substrate-adjacent work (276-09, 276-10) is stated NOT to have moved the substrate baseline count, and the reasoning is spelled out mechanically (constructor option and error-classification-string changes match none of check-substrate.cjs's five scanned shapes) rather than asserted -- this is precisely the Phase 273 D-05 failure mode ('falsely crediting this phase's fixes for a change they structurally cannot produce') this task exists to avoid."
  - "The disposition ledger's HIGH_RISK-suppression positive control (deviation directive 1) was moved onto the SAME synthetic fixture (tests/fixtures/tool-honesty/positive.cjs) test-ljj-tool-honesty.cjs's own POSITIVE_SYNTHETIC assertion already uses, rather than minting a second HIGH_RISK fixture -- this phase drove global HIGH_RISK to 0, so the suppression-path proof could no longer depend on a live HIGH_RISK row existing without going red the moment the phase succeeded at its own goal."
  - "The B-6 permanent test (deviation directive 2) reproduces 276-11-SUMMARY.md's recorded regexes byte-for-byte (not paraphrased) and adds a third group (Group C) proving boundary B-6 itself -- that scanAll() cannot see the parameter describe text at all -- so the new file is load-bearing evidence for the boundary, not merely a copy of an ad-hoc verification step."

requirements-completed: [TOOLHON-14, TOOLHON-02]

# Metrics
duration: ~50min
completed: 2026-09-04
---

# Phase 276 Plan 15: Reconcile the Substrate Baseline, Re-Freeze the Ledger, and the Measured Gate Roll-Up Summary

**Regenerated `SUBSTRATE-BASELINE.md`'s number (205, unchanged by this phase's own C4/M8 work, stated plainly rather than credited falsely), re-froze the tool-honesty disposition ledger against the live 37-tool/131-branch post-fix surface (HIGH_RISK 0, MEDIUM 12 permanently visible), closed two orchestrator-assigned deviation directives (a synthetic HIGH_RISK positive control, a permanent B-6 boundary test), and reported the full gate set as a measured before/after delta rather than a bare green claim.**

## Performance

- **Duration:** ~50 min (investigation + three task commits)
- **Started:** 2026-09-03T~23:15:00+03:00 (approx, first file read)
- **Completed:** 2026-09-04T00:04:49+03:00 (Task 3 commit)
- **Tasks:** 3 completed
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- **Task 1 (substrate baseline regeneration).** `docs/architecture/SUBSTRATE-BASELINE.md` now carries a `[GENERATED]` "Current Baseline" section stating **205** (measured live via `node scripts/check-substrate.cjs --baseline` at commit `48db8772`), the ONE number a fresh reader should treat as current. The three prior figures (195 at Phase 128-03/2026-05-30, 208 at Phase 273/2026-08-31, 205 at R17/2026-09-03) are disambiguated as dated historical snapshots, each explicitly named at its own heading, not competing current claims. A new "2026-09-03 re-measurement (Phase 276-15, D-05 reconciliation)" section closes Phase 273 D-05's deferred update, stating plainly that this phase's own substrate-adjacent work (276-09's busy-timeout constructor option, 276-10's typed-reason classification and doc-comment fix) did NOT move the count, and explaining mechanically why: neither touches any of `check-substrate.cjs`'s five scanned shapes (banned `require()`, raw SQL text, `openGraph(` bypass, direct sqlite require, Cypher interpolation). `node tests/test-273-substrate-baseline-honest.cjs` passes (measured=205). `node scripts/check-substrate.cjs --diff` reports no net-new violation.
- **Task 2 (ledger re-freeze + two deviation directives).** `tests/fixtures/tool-honesty/276-dispositions.json` re-frozen: `frozen_sweep` updated from the stale `36/130` (HIGH_RISK 5, MEDIUM 18, UNKNOWN 1) to the live `37/131` (HIGH_RISK 0, MEDIUM 12, UNKNOWN 0, OK 119), `frozen_at_commit` updated, `refrozen_at` added naming plan 276-12's `claim_write` tool addition as the cause. All 14 entries whose `expected_final_verdict` was `OK` are confirmed resolved live and now carry a `resolved_at_commit` (traced from each owning plan's SUMMARY: `15d65f47` for orchestration.scout/room_content's four rows, `43e3308e` for export's seven rows, `02468fcb` for gate_render, `02287c30` for context_assemble). The 12 `room_graph`/`intelligence` entries stay permanently visible at MEDIUM per D-276-2, confirmed live-matching. `ALLOWED_UNVERIFIED` confirmed empty. `node tests/test-276-tool-honesty-findings-closed.cjs` now exits 0 (148 passed, 0 failed -- Group F, the only remaining failure before this plan, is now green). Deviation directive 1: `tests/test-276-allowed-unverified-contract.cjs` Group B's HIGH_RISK positive control, which depended on a live HIGH_RISK row (now zero, by this phase's own design), was rewired onto the same synthetic `tests/fixtures/tool-honesty/positive.cjs` fixture `test-ljj-tool-honesty.cjs`'s own `POSITIVE_SYNTHETIC` assertion already uses. Deviation directive 2: `tests/test-276-b6-parameter-describe.cjs` (new, glob-discovered) promotes 276-11's ad-hoc B-6 over-the-wire assertion into a permanent three-group test, reproducing 276-11-SUMMARY.md's recorded regexes byte-for-byte and additionally proving boundary B-6 itself (`scanAll()` cannot see the parameter `.describe()` text at all).
- **Task 3 (gate roll-up as a measured delta + 276-VALIDATION.md reconciliation).** Ran the full gate list and recorded every result as a before/after delta (full table below). `bash tests/run-all-276.sh`: PASS=13 FAIL=0 SKIP=0. All three advisory call sites confirmed unchanged by direct inspection (the pre-commit hook's deliberate missing failure tail, `release.sh:360`'s `|| true`, `doctor.cjs:1055`'s `--check` spawn). `276-VALIDATION.md`: every `TBD` in the Task ID/Plan columns replaced with real numbers traced from every `276-NN-SUMMARY.md`; four rows added for tasks that previously had none (claim_write/276-12, the meeting gate wiring/276-14, the substrate baseline regeneration and ledger re-freeze/this plan, the `graph_write` parameter-describe assertion/276-11+276-15); `nyquist_compliant: true` and `wave_0_complete: true` set in the frontmatter, both verified true (31.8s full-suite runtime against a 120s target, zero watch-mode flags, every task carries an automated verify).

## Task Commits

Each task was committed atomically:

1. **Task 1: regenerate the substrate baseline** - content landed inside commit `e484f4b3` (see "Shared-Tree Collision" below; this was NOT this plan's own isolated commit due to a race with the concurrent Phase 339 session)
2. **Task 2: re-freeze the ledger + close two deviation directives** - `e773ae25` (chore)
3. **Task 3: gate roll-up + 276-VALIDATION.md reconciliation** - `82862610` (docs)

## Files Created/Modified

- `docs/architecture/SUBSTRATE-BASELINE.md` (Task 1) - added a `[GENERATED]` "Current Baseline" section (205, commit `48db8772`), disambiguated the 195/208 historical figures with explicit dated headings, appended a "2026-09-03 re-measurement (Phase 276-15, D-05 reconciliation)" section.
- `tests/fixtures/tool-honesty/276-dispositions.json` (Task 2) - `frozen_sweep` -> `37/131`/`0`/`12`/`0`/`0`/`119`, `frozen_at_commit` -> `e484f4b3`, `refrozen_at` added, 14 entries gained `resolved_at_commit`.
- `tests/test-276-allowed-unverified-contract.cjs` (Task 2, deviation 1) - Group B's HIGH_RISK positive control rewired onto `tests/fixtures/tool-honesty/positive.cjs`, header comment updated.
- `tests/test-276-b6-parameter-describe.cjs` (Task 2, deviation 2, new) - 3 groups / 5 assertions, promoting 276-11's B-6 over-the-wire proof to a permanent test.
- `.planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/276-VALIDATION.md` (Task 3) - Per-Task Verification Map fully reconciled (zero TBD), Validation Sign-Off checklist filled with measured evidence, frontmatter `status`/`nyquist_compliant`/`wave_0_complete` set to their true, verified values.

## Shared-Tree Collision (Task 1, recorded per T-276-09)

Task 1's `docs/architecture/SUBSTRATE-BASELINE.md` edit was staged (`git add`, verified via `git diff --cached --name-only` listing exactly that one file) and committed via `git commit`. The commit **failed to create a new commit** ("no changes added to commit") because the concurrently-running Phase 339 session's own `git commit` (a plain commit, no `-a`) ran in the shared working tree between this plan's `git add` and its own `git commit`, and picked up this plan's staged file as part of ITS commit (`e484f4b3`, "docs(339-04): file SUMMARY for brain-client.cjs PREP cut plan"). `git show --stat e484f4b3` confirms both files: the 339-04 SUMMARY.md and `docs/architecture/SUBSTRATE-BASELINE.md` (81 insertions, 3 deletions -- exactly this plan's own diff). The content landed correctly and is fully verified present and correct on disk (re-read after the fact, `node tests/test-273-substrate-baseline-honest.cjs` passes); only the commit ATTRIBUTION is mixed with an unrelated Phase 339 commit, a structural risk of a genuinely shared git index across two live sessions that no per-plan protocol can fully prevent (the check-then-commit gap is inherently racy). Tasks 2 and 3's own commits (`e773ae25`, `82862610`) landed cleanly and atomically with no such collision, confirmed by `git show --stat` on each listing only this plan's own files.

## Deviations from Plan

### Auto-fixed Issues (orchestrator-assigned, Rule 1)

**1. [Rule 1 - Bug] Group B's HIGH_RISK positive control decoupled from the live tree**
- **Found during:** Task 2, running `node tests/test-276-allowed-unverified-contract.cjs` after the ledger re-freeze
- **Issue:** `tests/test-276-allowed-unverified-contract.cjs` Group B's suppression-path positive control asserted "a live HIGH_RISK row exists today." This phase drove global HIGH_RISK to 0 (per plan 276-08's own explicit goal), so the assertion failed the moment the phase succeeded -- a suppression-path proof that depends on the codebase staying broken.
- **Fix:** Sourced the positive control from `tests/fixtures/tool-honesty/positive.cjs` (a synthetic fixture already shipped for `test-ljj-tool-honesty.cjs`'s `POSITIVE_SYNTHETIC` assertion) via a scoped `scanAll({ files: [...] })` call, matching the `unresolvable.cjs` synthetic pattern 276-07 already established for the UNKNOWN control. The two negative controls (MEDIUM, UNKNOWN) stay behavioral against the real live `scanAll()`/`ALLOWED_UNVERIFIED`, per D-276-2's requirement that the never-suppressible guarantee hold against the actual codebase.
- **Files modified:** `tests/test-276-allowed-unverified-contract.cjs`
- **Verification:** `node tests/test-276-allowed-unverified-contract.cjs` -- 11 passed, 0 failed (was 9 passed / 1 failed before the fix).
- **Committed in:** `e773ae25` (Task 2 commit)

**2. [Rule 1 - Bug] Promoted 276-11's B-6 over-the-wire assertion into a permanent test**
- **Found during:** Task 2, per the orchestrator's explicit deviation directive
- **Issue:** `graph_write`'s `read_version` parameter `.describe()` string discloses the CAS fail-open (missing source node, guard read error), a real correctness disclosure that boundary B-6 (`scanAll()` reads only the second positional argument to `server.tool(`, never a parameter `.describe()`) means the standing detector can never verify. 276-11's own SUMMARY recorded a one-off manual verification script, not a standing test, so a future regression on this exact string would go undetected by the suite.
- **Fix:** Created `tests/test-276-b6-parameter-describe.cjs`, reproducing 276-11-SUMMARY.md's recorded regexes byte-for-byte (`/lost update is rejected as a conflict/`, `/fails? open/i`), plus a third group proving boundary B-6 itself (the detector's `scanAll()` over `graph.cjs` resolves `graph_write` to OK via reachability, never via the parameter text). Picked up automatically by `tests/run-all-276.sh`'s glob discovery (no runner edit needed).
- **Files modified:** `tests/test-276-b6-parameter-describe.cjs` (new)
- **Verification:** `node tests/test-276-b6-parameter-describe.cjs` -- 5 passed, 0 failed. `bash tests/run-all-276.sh` confirms glob discovery picked it up (PASS=13, up from 12 aggregator-level checks before this file existed).
- **Committed in:** `e773ae25` (Task 2 commit)

---

**Total deviations:** 2 (both orchestrator-assigned Rule 1 directives, both closed exactly as specified)
**Impact on plan:** No scope creep -- both were named explicitly in the orchestrator's own deviation_directives block and closed within Task 2's own file scope.

## Issues Encountered

- **The shared-tree commit collision on Task 1** (detailed above): not a defect in this plan's own work, but a structural property of two live sessions sharing one git index. No content was lost; only the commit boundary is mixed with an unrelated Phase 339 commit. Documented here rather than attempting any destructive git-history surgery to "fix" the attribution (forbidden by the destructive_git_prohibition and unnecessary -- the content is correct and verified).

## Gate Roll-Up (before/after delta, per Phase 267.2-10 precedent)

| Gate | Before this phase (earliest recorded) | After this plan (measured live) | Moved? |
|---|---|---|---|
| `bash tests/run-all-276.sh` | did not exist (created by 276-01) | PASS=13 FAIL=0 SKIP=0 | new aggregator, RED-by-design at Wave 0, now fully green |
| `bash tests/run-all-266.sh` | PASS=11 FAIL=0 SKIP=0 (per 276-08-SUMMARY.md, unchanged since) | PASS=11 FAIL=0 SKIP=0 | unchanged |
| `bash tests/run-all-273.sh` | PASS=7 FAIL=0 SKIP=0 (per 276-09-SUMMARY.md) | PASS=7 FAIL=0 SKIP=0 | unchanged |
| `node tests/test-234-tool-description-floor.cjs` | 168 passed / 0 failed (per 276-06-SUMMARY.md, pre-claim_write) | 172 passed / 0 failed, 40/40 coverage | +4 (claim_write tool added, 276-12) |
| `node tests/test-270-tool-schema-budget.cjs` | 39 tools / 33509 bytes (270-06 recorded baseline) | 40 tools, 41176 total bytes, delta +11.11% toolCount / +35.93% totalBytes vs the 270-06 baseline (within the 10% tolerance of the most recently recorded 276-12 AFTER baseline, per the test's own comparison logic); 5 passed / 0 failed | moved (claim_write + description rewrites), within tolerance, not re-baselined by this plan |
| `node tests/test-kwl-meeting-mcp-honesty.cjs` | 37 passed / 0 failed (per 276-06-SUMMARY.md, unchanged through 276-14's opt-in wiring) | 37 passed / 0 failed | unchanged |
| `node scripts/check-tool-honesty.cjs --report` bucket split | 36/130 tools/branches, HIGH_RISK 1, MEDIUM 8, LOW 0, UNKNOWN 1, OK 120 (original pre-D-1 baseline, 276-06-SUMMARY.md "Before" column) | 37/131, HIGH_RISK **0**, MEDIUM 12, LOW 0, UNKNOWN 0, OK 119 | HIGH_RISK and UNKNOWN both closed to 0; MEDIUM count moved (net effect of detector fixes surfacing real findings and closing false ones) |
| `node scripts/check-substrate.cjs --diff` | passed (no net-new) throughout the phase | passed (no net-new) | unchanged |
| `node scripts/build-connector-registry.cjs --check` | 208 entries (pre-276-12) | connector-registry: OK, 209 entries | +1 (claim_write, 276-12) |
| `node scripts/build-orchestration-projection.cjs --check` | OK | OK | unchanged |
| `node scripts/check-render-coverage.cjs` | 16 covered / 0 gap | 16 covered, 0 excluded, 0 gap; 202 wired, 2 excluded, 0 unwired | unchanged |
| `node scripts/check-shape-declaration.cjs --check` (advisory) | 53 violations (per 276-11-SUMMARY.md, unrelated to any 276-touched surface) | 53 violations, same set | unchanged |
| `node scripts/doctor.cjs --acceptance` | 17/18 (sole failure `verify-release-clean-tree`, pre-existing shared-tree drift, per 276-06-SUMMARY.md) | 17/18, same sole failure, same 7 pre-existing files | unchanged |
| `scripts/verify-release` | not previously recorded in this phase's own SUMMARYs (measured here for the first time as this plan's own required baseline) | 34 passed / 1 failed / 3 warnings (38 checks); the 1 failure (plugin path anchoring, `commands/file-meeting.md:350`) predates this phase (commit `2f1f4cf3`, quick 260903-kwl) | pre-existing, named, not fixed here; `scripts/release.sh` was NOT run |

**Advisory posture confirmed unchanged (T-276-18):** the pre-commit hook's deliberate missing failure tail at `scripts/hooks/pre-commit-room-minto-guard.sh` (confirmed present, comment intact), `scripts/release.sh:360`'s `node ... --check || true`, `scripts/doctor.cjs:1055`'s `{ id: 'tool-honesty', script: 'check-tool-honesty.cjs' }` spawned with `--check`. No hardening happened in this phase; that decision is deferred to plan 276-16 as a navigator follow-up, per the plan's own explicit instruction.

## Known Stubs

None. Every file touched is a complete, live-verified artifact; no placeholder logic or hardcoded empty return was introduced.

## Threat Flags

None. This plan's own threat register (T-276-02, T-276-36, T-276-18, T-276-37, T-276-09, T-276-SC) covers exactly the surface touched: the ledger re-freeze records `refrozen_at` and never quietly redefines `expected_final_verdict` (T-276-02); Task 1 states plainly that this phase's C4/M8 work did not move the substrate count (T-276-36); the advisory gate posture is confirmed unchanged by direct inspection, not assumed (T-276-18); every gate is reported as a delta, none omitted (T-276-37); every commit (except the Task 1 collision, itself documented) was preceded by an audited `git diff --cached --name-only` (T-276-09); zero package installs (T-276-SC). No new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced -- this plan is documentation regeneration, ledger reconciliation, and two test files.

## User Setup Required

None. No external service configuration required.

## Next Phase Readiness

- Phase 276 is functionally closed by this plan's own measurements: `bash tests/run-all-276.sh` exits 0 (13/13), global HIGH_RISK is 0, the ledger matches the live scan surface exactly, and `276-VALIDATION.md`'s sign-off checklist is genuinely true.
- Plan 276-16 (the phase close-out plan) has this plan's gate roll-up and reconciled validation contract as its starting evidence, plus the carried-forward, explicitly-named-not-fixed items from every prior plan: the `openRoomDb` re-route (D-276-4, 276-09), two sibling `no_room_db`-swallow sites (`breakthrough/scanner.cjs:124`, `navigation/lens-nodes.cjs:254`, 276-10), the `cross-room-store.cjs`/`cross-room-umbilical-closer.cjs` fallback-swallow finding (276-09), the honest-empty trio (276-11), the `gate_answer` Theo divergence (pre-existing, 276-13), the `.planning/debug/meeting-file-meeting-false-success.md` disposition (276-14), the `hasBanner` NOT-EXECUTED-literal detector-coverage gap (276-08), the two-hop `resolveReachability` boundary behind `graph-index`/`graph-rebuild` (276-07), and `scripts/verify-release`'s one pre-existing plugin-path-anchoring failure (this plan).
- No blockers.

---
*Phase: 276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs*
*Plan: 15*
*Completed: 2026-09-04*

## Self-Check: PASSED

- FOUND: `docs/architecture/SUBSTRATE-BASELINE.md` (Current Baseline section present, measured=205 confirmed by `node tests/test-273-substrate-baseline-honest.cjs`)
- FOUND: `tests/fixtures/tool-honesty/276-dispositions.json` (frozen_sweep 37/131, refrozen_at present)
- FOUND: `tests/test-276-allowed-unverified-contract.cjs` (synthetic HIGH_RISK fixture wiring present)
- FOUND: `tests/test-276-b6-parameter-describe.cjs`
- FOUND: `.planning/phases/276-mcp-tool-honesty-triage-and-close-the-check-tool-honesty-cjs/276-VALIDATION.md` (zero TBD in Task ID/Plan columns, nyquist_compliant: true)
- FOUND commit `e773ae25` (chore, Task 2) in `git log --oneline --all`
- FOUND commit `82862610` (docs, Task 3) in `git log --oneline --all`
- FOUND Task 1's content inside commit `e484f4b3` (shared-tree collision, documented above; `git show --stat e484f4b3` confirms `docs/architecture/SUBSTRATE-BASELINE.md` present with 81 insertions / 3 deletions)
