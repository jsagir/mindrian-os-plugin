---
phase: 355
slug: hidden-in-plain-sight-jev-through-theo-cross-connection-engi
status: planned
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-23
---

# Phase 355 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled at plan time from the 28 PLAN files; plan 355-27 Task 1 flips the Status column from the real runs, sets `nyquist_compliant: true` and dates the approval.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Plain Node CJS test scripts with PASS/FAIL counters (house style of tests/test-353-tripwires.cjs), exit 0 PASS, 77 SKIP, other FAIL; shared preamble `tests/helpers/hygiene-355.cjs` (scrub TYPESAFE_API_KEY, counting fetch thrower, zero-network final check) |
| **Config file** | none (each test is self-contained) |
| **Quick run command** | `node tests/test-355-<name>.cjs` |
| **Full suite command** | `bash tests/run-all-355.sh` |
| **Registry** | offline `tests/test-355-*.cjs` appended to TEST_FILES in `lib/memory/run-feynman-tests.cjs` by plan 355-27 |
| **Estimated runtime** | quick tests under 30 s each; full suite a few minutes, dominated by the doctor --acceptance leg and the no-regression suites |

---

## Sampling Rate

- **After every task commit:** the task's own `<automated>` command (listed below) plus any amended no-regression test it touched
- **After every plan wave:** `bash tests/run-all-355.sh` (legs for artifacts not yet landed SKIP until 355-27 makes the sweeps hard)
- **Before `/gsd-verify-work`:** full suite green and `node scripts/doctor.cjs --acceptance` with no failing point outside the BASE_355 set recorded in 355-BASELINE.md
- **Max feedback latency:** one task's automated command (well under 5 minutes; live dev-time runs are not in the sampling loop)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 355-01-01 | 01 | 1 | HIPS-10 | T-355-01 | Stops on any peer diff on the six D-57 files | gate + script | `bash -n tests/run-all-355.sh` + hygiene helper export check + BASE_355 in baseline | created by task | pending |
| 355-01-02 | 01 | 1 | HIPS-01 | T-355-05 | Direction module requires only node:crypto | unit (TDD) | `node tests/test-355-direction-convention.cjs && node tests/272-direction-convention.test.cjs` | created by task | pending |
| 355-02-01 | 02 | 2 | HIPS-01 | T-355-07 | PWS author ruling by role, no name | human checkpoint | prints phrases + phraseHash | n/a | pending |
| 355-02-02 | 02 | 2 | HIPS-01 | T-355-06 | PHRASES_CONFIRMED hash pinned | unit | `node tests/test-355-direction-convention.cjs` + hash equality | exists after 01 | pending |
| 355-02-03 | 02 | 2 | HIPS-01 | T-355-08 | Scratch rule file removed | RED agreement test | fixture >= 30 + agreement test exits non-zero on legs C-H only | created by task | pending |
| 355-03-01 | 03 | 2 | HIPS-08 | T-355-15 | No labels, no names in items | fixture check | items >= 120, >= 30% boundary, disjoint tuning set | created by task | pending |
| 355-03-02 | 03 | 2 | HIPS-07, HIPS-08 | T-355-11, T-355-12 | Blinding tripwire; path guard | unit (TDD) | `node tests/test-355-label-cli.cjs` | created by task | pending |
| 355-03-03 | 03 | 2 | HIPS-08 | T-355-14 | Gold before any Jev response | human checkpoint | gold hash / labeled_at / 6-label check | created by navigator | pending |
| 355-04-01 | 04 | 2 | HIPS-02 | T-355-17 | FAKE_FLOOR negative control | sweep (TDD) | `node scripts/check-floor-ledger.cjs --check && node tests/test-355-floor-sweep.cjs` | created by task | pending |
| 355-04-02 | 04 | 2 | HIPS-02 | T-355-19 | Disclosure line carries no value | unit | `node tests/test-355-floor-sweep.cjs` + disclosureLine decimal check | created by task | pending |
| 355-05-01 | 05 | 2 | HIPS-03 | T-355-22 | Names unchanged | RED fixture test | `node tests/test-355-naming-honesty.cjs` exits non-zero | created by task | pending |
| 355-05-02 | 05 | 2 | HIPS-03 | T-355-21, T-355-24 | Descriptions true; registry regenerated, never hand-edited | fixture + CIRS gates | naming test + connector / projection / shape `--check` | exists | pending |
| 355-06-01 | 06 | 2 | HIPS-04 | T-355-29 | No real internal Theo ids in fixtures | RED tests | `node tests/test-355-stamp-truth.cjs` exits non-zero | created by task | pending |
| 355-06-02 | 06 | 2 | HIPS-04 | T-355-25, T-355-26, T-355-27 | Only canon names reach callTool; no fabricated path | unit (TDD) | `node tests/test-355-stamp-truth.cjs && node tests/test-355-theo-unreachable.cjs` | created by task | pending |
| 355-06-03 | 06 | 2 | HIPS-05 | T-355-31 | No decimal, no forbidden glyph | unit (TDD) | `node tests/test-355-stamp-format.cjs` + render coverage `--check` | created by task | pending |
| 355-07-01 | 07 | 2 | HIPS-08, HIPS-09 | T-355-34 | Other builders' profiles unchanged | unit (TDD) | `node tests/test-356-jev-client.cjs` + profile freeze check | exists (356) | pending |
| 355-07-02 | 07 | 2 | HIPS-08, HIPS-09 | T-355-33 | Every mutated payload refused before fetch | unit (TDD) | `node tests/test-355-jev-ceilings.cjs && node tests/test-356-jev-client.cjs` | created by task | pending |
| 355-08-01 | 08 | 2 | HIPS-04 | T-355-38 | Names only, never descriptions | unit (TDD) | refresh-framework-names exports check | created by task | pending |
| 355-08-02 | 08 | 2 | HIPS-04 | T-355-39, T-355-41 | Capped read writes nothing | live dev-time + check | `--check` + framework-names test + registry gates | created by task | pending |
| 355-09-01 | 09 | 3 | HIPS-01 | T-355-43, T-355-46 | Weights and algorithms untouched | amended tests | 272 tests + floor sweep + agreement legs B/C/D | exists | pending |
| 355-09-02 | 09 | 3 | HIPS-01 | T-355-44, T-355-45 | 'none' pairs kept, thesis skipped | amended tests | lib/memory rs tests + agreement legs B/C/D/F | exists | pending |
| 355-10-01 | 10 | 3 | HIPS-01 | T-355-50 | Pin recorded on unchanged code | pin test | `node tests/test-355-eureka-ranking-pin.cjs` + clean diff on both sources | created by task | pending |
| 355-10-02 | 10 | 3 | HIPS-01 | T-355-47, T-355-48 | One atomic commit, ranking unchanged | atomic flip | pin + 211 + 215 + floor sweep + 213 + agreement leg E | exists | pending |
| 355-11-01 | 11 | 3 | HIPS-01 | T-355-51, T-355-52 | No background Python detector | amended test | `node tests/test-scout-cadence-fires.cjs` + agreement leg G | exists | pending |
| 355-11-02 | 11 | 3 | HIPS-01 | T-355-54 | .py diffs are comments only | docs + gates | registry / projection / shape gates + agreement leg G | exists | pending |
| 355-12-01 | 12 | 3 | HIPS-01 | T-355-56 | zod enum rejects 'none' and placeholders | unit (TDD) | readers test + 212 / 213 tests | created by task | pending |
| 355-12-02 | 12 | 3 | HIPS-01 | T-355-55, T-355-57, T-355-58 | Stored strings never trusted; tmp copies only | unit (TDD) | readers + telemetry + floor sweep + agreement leg H | created by task | pending |
| 355-13-01 | 13 | 3 | HIPS-07 | T-355-59, T-355-62 | Tests run on tmp copies; guardian clean | fixture test | guardian + fixture-room test (room-ill-defined legs) | created by task | pending |
| 355-13-02 | 13 | 3 | HIPS-07 | T-355-61 | No real names | fixture test | guardian + fixture-room test (room-extend legs) | created by task | pending |
| 355-13-03 | 13 | 3 | HIPS-07 | T-355-60 | No planted-case hints in room text | fixture test | guardian + `node tests/test-355-fixture-rooms.cjs` | created by task | pending |
| 355-14-01 | 14 | 3 | HIPS-04 | T-355-63, T-355-67 | Non-canon pairs never called | unit (TDD) | `node tests/test-355-theo-capture.cjs` | created by task | pending |
| 355-14-02 | 14 | 3 | HIPS-04, HIPS-09 | T-355-64, T-355-65 | Internal ids sanitized; outage writes nothing | live dev-time + check | capture `--check` + citation items shape | created by task | pending |
| 355-14-03 | 14 | 3 | HIPS-09 | T-355-66 | Citation gold before any Jev citation file | human checkpoint | gold hash / verdict-set check | created by navigator | pending |
| 355-15-01 | 15 | 3 | HIPS-08 | T-355-69, T-355-70, T-355-73 | Refuses without blind gold; no shrunken denominator | unit (TDD) | `node tests/test-355-hsi-measurement-record.cjs` (0 or 77) | created by task | pending |
| 355-15-02 | 15 | 3 | HIPS-08 | T-355-68, T-355-72 | Fixture sentences only; model pinned | live dev-time + replay | `node scripts/measure-hsi-thinking-mode.cjs --check` + record shape | created by task | pending |
| 355-15-03 | 15 | 3 | HIPS-08 | T-355-71 | Bar never relaxed after results | decision checkpoint | `node tests/test-355-hsi-measurement-record.cjs` | exists | pending |
| 355-16-01 | 16 | 4 | HIPS-04, HIPS-05, HIPS-02 | T-355-75, T-355-77, T-355-79 | Only snapshot names reach Theo; no decimals; nothing dropped | producer test | whitespace legs of the producer test + floor sweep | created by task | pending |
| 355-16-02 | 16 | 4 | HIPS-05 | T-355-78 | No new raw SQL | producer test + gates | registry / shape gates + whitespace legs | exists | pending |
| 355-16-03 | 16 | 4 | HIPS-04, HIPS-05 | T-355-76 | Theo before BEGIN; background runs Theo-free | producer test | producer test + telemetry + readers + gates | exists | pending |
| 355-17-01 | 17 | 4 | HIPS-04, HIPS-05 | T-355-81 | rs-engine never requires the stamp module | producer test | bottlenecks legs + reverse-salient tests + floor sweep + gates | created by task | pending |
| 355-17-02 | 17 | 4 | HIPS-04, HIPS-05 | T-355-80, T-355-83, T-355-84 | No MCP tool; Desktop says not yet checked | producer test + gates | `node tests/test-355-producer-rs-connections.cjs` + registry gates | exists | pending |
| 355-18-01 | 18 | 4 | HIPS-04, HIPS-05 | T-355-85, T-355-88 | Handles never sent; stamps before banking | producer test | eureka report / html / stamp legs + 215 + ranking pin | created by task | pending |
| 355-18-02 | 18 | 4 | HIPS-05 | T-355-86, T-355-87 | No score column, no banned claims | producer test + gates | `node tests/test-355-producer-eureka.cjs` + render coverage + gates | exists | pending |
| 355-19-01 | 19 | 4 | HIPS-06 | T-355-89 | Closed v2 schema | RED test | `node tests/test-355-side-channel-v2.cjs` exits non-zero | created by task | pending |
| 355-19-02 | 19 | 4 | HIPS-06 | T-355-90, T-355-94 | Guard probe still available; one lockstep commit | atomic bump | 213 tests + probeGuard available check | exists | pending |
| 355-19-03 | 19 | 4 | HIPS-06, HIPS-01 | T-355-91, T-355-92, T-355-93 | Sensor zod-free, read-only, fail-closed ledger | unit (TDD) | side-channel + readers + 213 + 219 tests | exists | pending |
| 355-20-01 | 20 | 5 | HIPS-06 | T-355-96 | Helper seeds only through navigation | RED test | `node tests/test-355-filing.cjs` exits non-zero | created by task | pending |
| 355-20-02 | 20 | 5 | HIPS-06 | T-355-95, T-355-97, T-355-98, T-355-99, T-355-100 | Born proposed; no await inside the transaction; no content in telemetry | filing test | filing + eureka + 215 + pin + 219 + check-substrate `--diff` | exists | pending |
| 355-21-01 | 21 | 5 | HIPS-04, HIPS-08, HIPS-09 | T-355-101, T-355-102, T-355-103, T-355-105, T-355-106 | Egress sweep, real-guard refusal, tripwires | sweep tests | part8-egress + cirs-wiring + scratch removed | created by task | pending |
| 355-21-02 | 21 | 5 | HIPS-10 | T-355-104 | Degrades only with named not_run | doctor point test | doctor-point + doctor self-coverage + doctor acceptance tests | created by task | pending |
| 355-22-01 | 22 | 6 | HIPS-06 | T-355-107, T-355-108 | Only a human gate confirms | promotion test | gate-opportunity-promotion + SYS-08 test | created by task | pending |
| 355-22-02 | 22 | 6 | HIPS-06, HIPS-05 | T-355-109, T-355-110, T-355-111 | Fires once; decide() never throws on ledger failure | fire-once test | fire-once + drift + 213 + 219 + 237 + render coverage | created by task | pending |
| 355-23-01 | 23 | 7 | HIPS-05 | T-355-112 | Larry narrates stored stamps only | SKILL gates | connector / projection / shape gates + section present | exists | pending |
| 355-23-02 | 23 | 7 | HIPS-05 | T-355-115 | No decimal / banned claim on any surface | render guard | `node tests/test-355-no-decimal.cjs && node tests/test-355-tri-polar.cjs` | created by task | pending |
| 355-23-03 | 23 | 7 | HIPS-04, HIPS-02 | T-355-113, T-355-114 | Byte-true path replay; integer coverage | coverage + sweep | stamp-coverage + floor sweep + `bash tests/run-all-355.sh` | created by task | pending |
| 355-24-01 | 24 | 8 | HIPS-07 | T-355-116 | Fixture-only room guard | unit (TDD) | `node tests/test-355-hit-rate-record.cjs` (0 or 77) | created by task | pending |
| 355-24-02 | 24 | 8 | HIPS-07 | T-355-117, T-355-119 | Engines on tmp copies; no padding | dev-time export | items shape check (3 rooms, >= 20 each, no stamp field) | created by task | pending |
| 355-24-03 | 24 | 8 | HIPS-07 | T-355-118 | Blind sitting before any stamp | human checkpoint | judgments hash / boolean shape check | created by navigator | pending |
| 355-25-01 | 25 | 9 | HIPS-04, HIPS-07 | T-355-121, T-355-124 | Stamps only after the blind sitting | live dev-time + replay | capture `--check` + every stamp parses | created by task | pending |
| 355-25-02 | 25 | 9 | HIPS-07 | T-355-121 | As-shown sitting separate from blind | human checkpoint | stamped judgments shape check | created by navigator | pending |
| 355-25-03 | 25 | 9 | HIPS-07 | T-355-122, T-355-123, T-355-125 | Every rate with n and Wilson; no success claim | record replay | `node scripts/measure-355-hit-rate.cjs --check && node tests/test-355-hit-rate-record.cjs` | created by task | pending |
| 355-26-01 | 26 | 10 | HIPS-09 | T-355-127, T-355-129 | Band from measured accuracy; gold-first | unit (TDD) | `node tests/test-355-jev-calibration-record.cjs` (0 or 77) | created by task | pending |
| 355-26-02 | 26 | 10 | HIPS-09 | T-355-126, T-355-128, T-355-130 | Template / fixture payloads only; no runtime verdict | live dev-time + replay | both `--check` + record test | created by task | pending |
| 355-27-01 | 27 | 11 | HIPS-10 | T-355-140 | Doctor never re-baselined | phase gate | `bash tests/run-all-355.sh && node lib/memory/run-feynman-tests.cjs` | exists | pending |
| 355-27-02 | 27 | 11 | HIPS-01..10 | T-355-135, T-355-136 | Clean-file check; Measured line per closed row | doc check | 10 HIPS rows + section heading | exists | pending |
| 355-27-03 | 27 | 11 | HIPS-04, HIPS-07, HIPS-09 | T-355-137, T-355-138, T-355-139 | Counts only to Theo; no cross-edit; markdown-only room filing | doc check | handoff file + OPEN-HANDOFFS entry + no em-dash | created by task | pending |
| 355-28-01 | 28 | 5 | HIPS-08 | T-355-131 | Distillation set disjoint (adopted path only) | conditional | decision gate + disjointness check (prints SKIPPED on not_adopted) | conditional | pending |
| 355-28-02 | 28 | 5 | HIPS-08 | T-355-132, T-355-134 | Dev-time only; thresholds ledgered | conditional (TDD) | distiller `--check` + distillation test + floor sweep | conditional | pending |
| 355-28-03 | 28 | 5 | HIPS-08 | T-355-133 | Table ships only if it clears the bar | conditional | distillation test + 272 tests + record section | conditional | pending |

*Status values: pending, green, red, flaky, skipped (with reason)*

---

## Wave 0 Requirements

Wave 0 here means "the failing test lands before the code it pins" (the Phase 354 test-first rule), spread across the plans that own each surface rather than one up-front wave:

- [ ] `tests/helpers/hygiene-355.cjs` and `tests/run-all-355.sh` skeleton (355-01 Task 1), precondition: Phase 354 closed and BASE_355 doctor baseline captured
- [ ] `tests/test-355-direction-convention.cjs` before the module (355-01 Task 2)
- [ ] `tests/fixtures/355/direction-pairs.json` + RED `tests/test-355-direction-agreement.cjs` after the PWS author's phrase ruling (355-02)
- [ ] RED `tests/test-355-floor-sweep.cjs` (355-04), `tests/test-355-naming-honesty.cjs` (355-05), `tests/test-355-stamp-truth.cjs` / `test-355-theo-unreachable.cjs` / `test-355-stamp-format.cjs` (355-06), `tests/test-355-jev-ceilings.cjs` (355-07), `tests/test-355-framework-names.cjs` (355-08)
- [ ] `tests/test-355-eureka-ranking-pin.cjs` green on unchanged code before the D-47 flip (355-10)
- [ ] RED `tests/test-355-side-channel-v2.cjs` (355-19) and `tests/test-355-filing.cjs` (355-20)
- [ ] Sentence items + label CLI so sentence labeling (no direction shown) starts in wave 2 (355-03)
- [ ] One live Theo capture through brain-client with pathLabels (355-14), appended for room pairs in 355-25
- [ ] Fixture rooms authored after the phrase ruling and run through feynman-minto-guardian before commit (355-13)

No framework install: nothing is added to package.json (a run-all leg enforces `git diff --quiet package.json package-lock.json`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The two direction phrases mean what the deck meant | HIPS-01 (D-35, AI-SPEC D17) | Only the PWS author can rule on the methodology's meaning | 355-02 Task 1: confirm or replace the three phrases |
| Blind gold labels for >= 120 thinking-mode sentences | HIPS-08 | A human is the judge; the CLI only records | 355-03 Task 3: `node scripts/label-355-gold.cjs start --set sentences` |
| Blind gold verdicts for >= 40 citation pairs | HIPS-09 | Human truth for the calibration | 355-14 Task 3: `--set citations` |
| HSI adoption decision sign-off | HIPS-08 (D-45) | The navigator signs the mechanically applied bar | 355-15 Task 3 |
| Useful / direction ok / already known on >= 20 pairings per room, unstamped then as shown | HIPS-07 | The hit rate is human-judged by definition (SPEC Req 7) | 355-24 Task 3 (`--set pairings-unstamped`), 355-25 Task 2 (`--set pairings-stamped`) |

Every automated check around these sittings (hashes, labeled_at, git ancestry, shape) is code; only the judgments themselves are human.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a named Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency within one task's automated command
- [ ] `nyquist_compliant: true` set in frontmatter (by 355-27 Task 1)

**Approval:** pending (set by 355-27 Task 1 after the final run)
