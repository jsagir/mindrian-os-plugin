---
phase: 365
slug: verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-01
---

# Phase 365 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: 365-RESEARCH.md "Validation Architecture", amended by the locked decisions D-01..D-25 in 365-CONTEXT.md and the planning-time constraints (Theo schema parity, shared tree).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain Node scripts (`node:assert/strict` plus the house `check()` idiom), exit 0 PASS / 1 FAIL / 77 ENV GAP; bash aggregators |
| **Config file** | none; `tests/run-all-365.sh` is written once by 365-01 and never edited again |
| **Red list** | `tests/fixtures/365-baseline-red.json` (written by 365-02; a healing plan removes exactly the signatures it heals, in the same commit) |
| **Quick run command** | `node tests/test-365-<name>.cjs` |
| **Full suite command** | `bash tests/run-all-365.sh` |
| **Phase gate command** | `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` plus `node scripts/doctor.cjs --acceptance` |
| **Estimated runtime** | about 90 s without regressions; several minutes with `RUN_365_REGRESSIONS=1` (run-all-354/355/356/358/363 run sequentially) |

Hygiene for every test-365 file: require `tests/helpers/hygiene-355.cjs` and call `scrubVendorKey()` and `installNetGuard()` before anything else; scratch rooms under `os.tmpdir()`, removed in `finally`; read-back through a FRESH `openRoomDb` handle, never the tool's `response.ok` (the test-354 discipline); U+2014 and U+2013 only ever written as `\u2014` / `\u2013` escapes.

Aggregator rule for a leg listed in the red list: every `RED-365-[A-Z0-9-]+` token the leg prints must be listed for it and every listed token must be printed (then KNOWN); an unlisted token is a NEW RED (FAIL); a listed token no longer printed is STALE (FAIL, remove it); a listed leg that exits 0 is NOW GREEN (FAIL, remove it); a non-zero exit with no token is a crash (FAIL). Falsification tests are characterization tests: they exit 0 while the observed behavior matches `tests/fixtures/365-falsification-record.json` and never sit in the red list.

---

## Sampling Rate

- **After every task commit:** the task's own `node tests/test-365-*.cjs`, plus `node tests/test-358-b1-portrait.cjs` and `node tests/test-b1-verification.cjs` whenever `lib/core/navigation/verification.cjs` is touched.
- **After every plan (wave merge):** `bash tests/run-all-365.sh` (FAILED must be 0).
- **Before `/gsd-verify-work` (phase gate, 365-16):** `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` green and `node scripts/doctor.cjs --acceptance` with no failing point that was not failing at the phase base.
- **Max feedback latency:** 120 seconds for any single test-365 file.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 365-01-01 | 01 | 1 | V365-01..18 (registration) | T-365-11 | rows added as `- [ ]`, no other family changed | doc | `grep -c '^- \[ \] \*\*V365-' .planning/REQUIREMENTS.md` = 18 | n/a | pending |
| 365-01-02 | 01 | 1 | V365-17 | T-365-16 | derivation, person node, B4, migration cannot land while `ratified:false` | static | `node tests/test-365-ladder-fence.cjs` | W0 | pending |
| 365-01-03 | 01 | 1 | V365-01, V365-18 | T-365-12 | a healed or changed red can never pass silently | aggregator | `TEST_365_PREFIX=tests/test-365-ladder bash tests/run-all-365.sh` | W0 | pending |
| 365-02-01 | 02 | 1 | V365-02 | n/a | red at base: `RED-365-BYTE`, `RED-365-BYTE-DERIVED` | acceptance | `node tests/test-365-acceptance-byte.cjs; test $? -eq 1` | W0 | pending |
| 365-02-02 | 02 | 1 | V365-03, V365-04 | T-365-01 | red at base: ONEWEEK-STATUS, ONEWEEK-STANDING, FLOOR, FLOOR-NOTICE | acceptance | `node tests/test-365-acceptance-floor.cjs; test $? -eq 1` | W0 | pending |
| 365-02-03 | 02 | 1 | V365-01 | T-365-12 | base sha, digests and observed signatures pinned from git objects | baseline | `node tests/test-365-baseline.cjs` | W0 | pending |
| 365-03-01 | 03 | 1 | V365-01 | n/a | missing-five and contradiction outcomes recorded (predicted FALSIFIED) | characterization | `node tests/test-365-falsify-missing-five.cjs && node tests/test-365-falsify-contradiction.cjs` | W0 | pending |
| 365-03-02 | 03 | 1 | V365-01 | n/a | remove-destination outcome recorded; two-navigators protocol MANUAL | characterization | `node tests/test-365-falsify-destination.cjs` | W0 | pending |
| 365-04-01 | 04 | 2 | V365-02, V365-16 | T-365-02 | standing computed from outbound provenance edges only (CONTRADICTS never counts); read-only | unit | `node tests/test-365-standing.cjs && node tests/test-365-acceptance-byte.cjs` | W0 | pending |
| 365-04-02 | 04 | 2 | V365-05, V365-07, V365-08 | T-365-13 | invalid floor falls back and is reported; notice composer never writes | unit | `node tests/test-365-floor-reader.cjs` | W0 | pending |
| 365-05-01 | 05 | 3 | V365-06 | T-365-14 | audit of canon rules and confirmNode callers written before any edit | doc | `grep -q 'Recommendation' <PD>/365-D20-AUDIT.md` | n/a | pending |
| 365-05-02 | 05 | 3 | V365-06 | T-365-14 | navigator decides before transitions.cjs changes | checkpoint | manual (decision) | n/a | pending |
| 365-05-03 | 05 | 3 | V365-06 | T-365-14 | agent-attributed needs_evidence->confirmed refused | unit | `node tests/test-365-transitions.cjs && node tests/test-348-agent-supersede-refused.cjs` | W0 | pending |
| 365-06-01 | 06 | 2 | V365-07 | n/a | notice carried as data; gate-render.cjs opens no db | unit | `node tests/test-365-floor-notice.cjs` | W0 | pending |
| 365-06-02 | 06 | 2 | V365-04, V365-07 | n/a | three rungs print the notice; null notice is byte-identical to today | unit | `node tests/test-365-floor-notice.cjs && node tests/test-198-gate-renderers.test.cjs` | W0 | pending |
| 365-07-01 | 07 | 2 | V365-09 | T-365-04, T-365-10 | malformed file halts; fresh read; `why` never matched | unit | `node tests/test-365-never-do-core.cjs` | W0 | pending |
| 365-07-02 | 07 | 2 | V365-10 | T-365-05 | writer refuses without approval trail | unit | `node tests/test-365-never-do-writer.cjs` | W0 | pending |
| 365-08-01 | 08 | 4 | V365-06, V365-08 | T-365-01, T-365-03 | floor from the claim's own edges; one audit event per approve | integration | `node tests/test-365-floor-gate.cjs` | W0 | pending |
| 365-08-02 | 08 | 4 | V365-04, V365-07 | T-365-15 | gate_render composes the why-line; the only five-tool schema text change (subject_node_id, kept by navigator ruling) is named | integration | `node tests/test-365-floor-gate.cjs && node tests/test-267-mcpv2-zod4-contract.cjs` (check (a) PASS) | W0 | pending |
| 365-08-03 | 08 | 4 | V365-04, V365-07 | T-365-15 | meeting cards use the same composer; honest meeting text; floor acceptance test green | integration | `node tests/test-365-acceptance-floor.cjs && node tests/test-365-floor-gate.cjs` | W0 | pending |
| 365-08-04 | 08 | 4 | V365-03, V365-06 | T-365-12 | four pinned suites updated with written reasons; reds healed in the same commit | regression | `bash tests/run-all-365.sh` | W0 | pending |
| 365-09-01 | 09 | 3 | V365-11 | T-365-08 | irreversible check stays first; constraint only adds halts | unit | `node tests/test-365-never-do-chain.cjs` | W0 | pending |
| 365-09-02 | 09 | 3 | V365-11, V365-13 | T-365-04 | halt card shows why plus the floor sentence; trip line; proposal on halt | integration | `node tests/test-365-never-do-chain.cjs && node tests/test-198-chain-run-halt.test.cjs` | W0 | pending |
| 365-10-01 | 10 | 3 | V365-12, V365-13 | T-365-07 | zero fetch and no recordRun on a match or malformed file; the halted card is gate-ready (D-26) | integration | `node tests/test-365-never-do-ambient.cjs && node tests/test-363-ambient.cjs` | W0 | pending |
| 365-10-02 | 10 | 3 | V365-13 | n/a | plan-only ambient cards carry a pre-filled never-do proposal; other payload keys unchanged | integration | `node tests/test-365-never-do-ambient.cjs && node tests/test-363-ambient.cjs` | W0 | pending |
| 365-11-01 | 11 | 3 | V365-15 | T-365-06 | snapshot payload scalars only; one per ISO week; no stall signal when every claim is sourced | unit | `node tests/test-365-signals.cjs` | W0 | pending |
| 365-11-02 | 11 | 3 | V365-15 | n/a | two signals merged into Zone 3 at medium; stall suppressed below 2 snapshots | integration | `node tests/test-365-signals.cjs && node scripts/check-floor-ledger.cjs --check` | W0 | pending |
| 365-12-01 | 12 | 3 | V365-16 | T-365-06 | room home and graph export name the standing from the one map | unit | `node tests/test-365-b5-renders.cjs && node tests/test-graph-export-golden-room.cjs` | W0 | pending |
| 365-12-02 | 12 | 3 | V365-16 | T-365-06 | packet projection toward the Brain unchanged | unit | `node tests/test-365-b5-renders.cjs && node tests/test-navigation-insights.cjs` | W0 | pending |
| 365-12-03 | 12 | 3 | V365-16 | T-365-06 | the presentation graph node detail shows a claim's verification_words from graph-export data | unit + integration | `node tests/test-365-b5-renders.cjs && node tests/test-graph-export-golden-room.cjs` | W0 | pending |
| 365-13-01 | 13 | 4 | V365-10, V365-13 | T-365-05 | entry lands only through a resumeFn after the gate decision node exists | integration | `node tests/test-365-never-do-gate.cjs` | W0 | pending |
| 365-13-02 | 13 | 4 | V365-13 | T-365-05 | reject on a material step, surfaced ambient plan-only cards and halted_constraint gates (D-26) mint the offer | integration | `node tests/test-365-never-do-gate.cjs && node tests/test-363-mcp-tool.cjs` | W0 | pending |
| 365-14-01 | 14 | 4 | V365-10, V365-13 | T-365-05 | CLI door refuses without `--approved-via cli`; mints its own decision node | integration | `node tests/test-365-never-do-cli.cjs` | W0 | pending |
| 365-14-02 | 14 | 4 | V365-12, V365-13 | n/a | research.md fires halted cards as gates and documents the offer; two F.1 stages declared; only this plan's regeneration delta committed | static | `node scripts/build-connector-registry.cjs --check && node scripts/build-skill-mirrors.cjs --check && node scripts/build-orchestration-projection.cjs --check` | n/a | pending |
| 365-15-01 | 15 | 5 | V365-14, V365-16 | n/a | standing rows in words, no score words, closing line last | unit | `node tests/test-365-portrait.cjs && node tests/test-b1-verification.cjs` | W0 | pending |
| 365-15-02 | 15 | 5 | V365-03, V365-14 | T-365-04 | `--checks` prints rows plus the never-do floor sentence; unreadable list reported with its fix; runs after 365-14's regeneration | integration | `node tests/test-365-portrait.cjs && node tests/test-365-acceptance-one-week.cjs` | W0 | pending |
| 365-16-01 | 16 | 6 | V365-17 | n/a | Phase 365.1 exists with the ratification ask recorded as its blocker | doc | `test -f <365.1 dir>/365.1-INPUT.md` | n/a | pending |
| 365-16-02 | 16 | 6 | all | T-365-15 | full gate green and recorded in 365-CLOSE-GATE.md | gate | `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` | n/a | pending |
| 365-16-03 | 16 | 6 | all | T-365-15, T-365-11 | rows closed with Measured proof; shared-doc commits hold only this plan's hunks; Theo parity item recorded | doc | `grep -q 'Theo schema-parity sync needed after the tagged release' <PD>/365-FOLLOW-ONS.md` | n/a | pending |
| 365-16-04 | 16 | 6 | V365-17 | n/a | research trail drafted with a routing table | doc | `grep -q Routing <PD>/365-RESEARCH-TRAIL.md` | n/a | pending |
| 365-17-01 | 17 | 7 | V365-17 | T-365-17 | nothing files to a room without the navigator's approval | checkpoint | manual (human-verify) | n/a | pending |
| 365-17-02 | 17 | 7 | V365-17 | T-365-17 | both room copies byte-identical, or the hold recorded | doc | `cmp <room copy> <mirror copy>` | n/a | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/helpers/fixture-room-365.cjs` - claim seeding with and without source edges, ask and read records, ROOM.md floor writer, fresh read-back (wraps `tests/helpers/fixture-room-354.cjs`)
- [ ] `tests/helpers/one-week-365-child.cjs` - the second process that asks the room a week later
- [ ] `tests/fixtures/365-pre-phase.json`, `tests/fixtures/365-baseline-red.json`, `tests/fixtures/365-falsification-record.json`, `tests/fixtures/365-regression-base.json`
- [ ] `tests/run-all-365.sh` (written once)
- [ ] The acceptance tests (`test-365-acceptance-byte.cjs`, `-byte-derived.cjs`, `-one-week.cjs`, `-floor.cjs`) and the falsification tests (`test-365-falsify-missing-five.cjs`, `-contradiction.cjs`, `-destination.cjs`), run at the phase base with signatures recorded BEFORE any `lib/` edit
- [ ] `data/verification-ladder.json` plus `tests/test-365-ladder-fence.cjs`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Falsification test 1: two navigators, same framework, same room - do the frames diverge as far as two unguided prompts? | V365-01 | needs two people and live model sessions | protocol written in `365-BASELINE.md` by 365-03; status NOT RUN; owned by the navigator and the paper author (roles only) |
| D-20 transition go-ahead (canon rule check before `transitions.cjs` changes) | V365-06 | a canon-amendment question is the navigator's call | 365-05 Task 2 checkpoint reads `365-D20-AUDIT.md` |
| Research-trail routing and the ladder ratification ask | V365-17 | nothing files to a room without approval; the ask is sent by the navigator | 365-17 Task 1 checkpoint |
| Card copy reads well on CLI, Desktop and Cowork | V365-04 | human judgment of plain words | optional look during 365-17; automated legs already assert the words exist on all three rungs |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency under 120 s per file
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
