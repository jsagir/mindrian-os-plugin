# Phase 219: Live REQ-6 Verification (ador-ip-test)

**Run date:** 2026-07-13
**Room:** `~/MindrianRooms/ador-ip-test` (real, live room: 164 IP.com case-study artifacts, pre-218 scaffold, EMPTY opportunity bank)
**Executor start (UTC):** 2026-07-13T04:58:48Z
**Discipline:** 218-VERIFICATION before/after format - fixture-green is NECESSARY, never SUFFICIENT (218 lesson R1: fixture-green lied twice).

---

## 1. Offline Gates (Task 1 - nothing touches the live room until everything is green)

| # | Command | Exit | Result (verbatim counts) |
|---|---------|------|--------------------------|
| 1 | `bash tests/run-all-219.sh` | 0 | `Phase 219: PASS=11 FAIL=0 SKIP=0` - all SEVEN phase legs PASS (219-01 banking, 219-02 FTS5 degrade, 219-02 metadata, 219-03 harvest sensor, 219-04 qualification, 219-05 research contract, 219-05 explore chain), zero SKIP on phase legs; grep gates PASS (no raw node/edge INSERT, zero network, no command surface leaked); 218 substrate no-regression `PASS=13 FAIL=0 SKIP=0`; 211 engine no-regression `PASS=10 FAIL=0 SKIP=0` |
| 2 | `node scripts/build-connector-registry.cjs --check` | 0 | `connector-registry: OK` |
| 3 | `node scripts/check-shape-declaration.cjs --check` | 0 | Advisory WARNs only (pre-existing skills/vault + skills/visualize dual-declaration class, Phase 210 advisory posture - never blocks); zero violations on 219 surfaces |
| 4 | `node scripts/check-render-coverage.cjs` | 0 | `16 covered, 0 excluded, 0 gap (16 entries)`; md-keyspace `204 wired, 2 excluded, 0 unwired (206 declaring commands)` |
| 5 | `node tests/test-sensors-part8-sweep.cjs` | 0 | `sensors Part-8 5-tripwire sweep: 1 passed, 0 failed over 18 file(s)` - SPEC acceptance criterion 9, machine-checked |
| 6 | `node scripts/doctor.cjs --acceptance` | 0 | `Acceptance full: 14/15 points passed; failed: verify-release-clean-tree` |

**Honest note on gate 6:** the single FAIL point (`verify-release-clean-tree`) is 6-file tracked drift owned by CONCURRENT SIBLING SESSIONS (commands/eureka.md, evals/plurai/211-baseline.json, lib/core/research-corpus.cjs, package-lock.json, scripts/eureka-command.cjs, skills/eureka/SKILL.md) - the exact pre-documented item in `deferred-items.md` (logged by the 219-05 executor). Zero overlap with this plan's diff (this plan modifies only 219-VERIFICATION.md). All 219-owned acceptance points PASS, doctor itself exits 0.

**Verdict: GREEN BOARD. The live room may be touched.**

---

## 2. Live ador Run (pre/post) - Task 2

_(populated below as the run proceeds)_

---

## 3. Navigator Checkpoint (card + explore) - Task 3

_(BLOCKING human checkpoint - populated on navigator sign-off)_

---

## 4. Corepower Validation

_(filled by Plan 07 - navigator-run on the Desktop machine)_
