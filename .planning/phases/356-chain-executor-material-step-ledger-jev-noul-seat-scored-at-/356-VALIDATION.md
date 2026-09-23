---
phase: 356
slug: chain-executor-material-step-ledger-jev-noul-seat-scored-at-
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-23
---

# Phase 356 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: 356-RESEARCH.md "## Validation Architecture", amended by 356-CONTEXT.md D-14..D-19.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | plain Node harness scripts (`check()` counters, exit 1 on failure, exit 77 = ENV GAP), the repo convention |
| **Config file** | none; Wave 0 adds `tests/run-all-356.sh` modeled on `tests/run-all-354.sh` |
| **Quick run command** | `node tests/test-356-runtime.cjs && node tests/test-356-ledger-build.cjs` |
| **Full suite command** | `bash tests/run-all-356.sh` |
| **Estimated runtime** | ~30 seconds (full suite, excluding the chain-suite reruns) |

Every 356 test clears `TYPESAFE_API_KEY` from its environment and stubs `fetch` to throw: the live key IS set in the developer shell.

---

## Sampling Rate

- **After every task commit:** the quick command plus the test for the touched file
- **After every plan wave:** `bash tests/run-all-356.sh`, plus `node tests/test-264-b3-frozen.cjs` and the chain suites (`tests/test-chain-executor-*.cjs`, `tests/test-larry-handoff-seam.cjs`)
- **Before `/gsd-verify-work`:** full 356 suite green; chain suites at their recorded baseline both WITH the shipped ledger and with `MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent`; the 353 tests at their recorded baseline (`test-353-ledger-shape` 13 pass / 6 fail pre-existing)
- **Max feedback latency:** 60 seconds

---

## Per-Requirement Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| R356-01 | policy file has the fields (criteria as a {true,false} object) and the D-03 sentence, with no em-dash; outgoing payload `state.policy` byte-identical to the file; ledger `policy_hash` = sha256(file bytes) | unit (fixture, fake fetch) | `node tests/test-356-policy.cjs` | ❌ W0 | ⬜ pending |
| R356-02 | label rows == registry command set; header has reviewer and date; every row has a reason and a valid `label_source`; builder refuses mismatched sets; blind sheet committed before ledger `built_at` | unit + git check | `node tests/test-356-answer-key.cjs` | ❌ W0 | ⬜ pending |
| R356-03 | fixture build: one entry per registry command, each with `command`, `p_irreversible`, `flag`, `text_hash`; top-level `threshold`, `false_alarm_count`, `false_alarms[]`, `built_at`, `policy_hash`, `build_mode` | unit + shipped legs | `node tests/test-356-ledger-build.cjs` | ❌ W0 | ⬜ pending |
| R356-04 | `computeThreshold`: normal, ties counted as flagged, all-equal fails, labeled-true with p = 0 fails, zero positives fails, missing p fails; shipped ledger has recall 1.0 over labeled-true rows and `false_alarm_count` recount matches; a failed build writes nothing | unit + shipped legs | same file | ❌ W0 | ⬜ pending |
| R356-04 / D-14 | Jev judges all commands (final D-14): every `flag` = p >= T; chain-run false alarm fails the build (appeal gate), other false alarms are listed in `false_alarms[]` | unit | same file | ❌ W0 | ⬜ pending |
| R356-05 (a) | synthetic ledger with a fresh `flag: true` on an autonomous_safe command makes default-gate `runChain` halt with reason `forced_material` | integration | `node tests/test-356-runtime.cjs` | ❌ W0 | ⬜ pending |
| R356-05 (b) | `/mos:publish` with `flag: false` still halts `forced_material` (add-only) | integration | same | ❌ W0 | ⬜ pending |
| R356-05 (c) | ledger absent or malformed: `isIrreversibleStep` equals the pre-356 predicate over every registry command; chain suites green | integration + suite rerun | `MINDRIAN_IRREVERSIBILITY_LEDGER=/nonexistent` + chain suites | existing | ⬜ pending |
| R356-05 (d) | no non-comment `lib/` or `hooks/` line references `api.typesafe.ai`, `TYPESAFE_API_KEY`, `jev-devtime-client`, or the 356 builder (with a negative control) | tripwire | `node tests/test-356-tripwires.cjs && node tests/test-353-tripwires.cjs` | ❌ W0 / ✅ | ⬜ pending |
| R356-05 | one ledger read per process; zero fetch at runtime | unit | `node tests/test-356-runtime.cjs` | ❌ W0 | ⬜ pending |
| R356-06 | edited teaching makes runtime ignore the entry and `--check` print STALE; an added command prints UNSCORED; exit 0; zero network | integration | `node tests/test-356-check.cjs` | ❌ W0 | ⬜ pending |
| R356-07 | guard throws before `fetchImpl` on `room_path`, an extra question key, a policy mismatch, or over-cap teaching; the message names the key; no key material in `data/` | unit | `node tests/test-356-egress.cjs` | ❌ W0 | ⬜ pending |
| R356-08 | client exports the D-07 interface; `section_command_ledger` profile parity with the pre-extraction guard; the 353 builder keeps its exports and `jev(key, body)` order; no builder contains `fetch(` or a local guard definition | unit + suite | `node tests/test-356-jev-client.cjs` + the 353 tests at baseline | ❌ W0 | ⬜ pending |
| D-12 | larry-extended "## Post-Gate Handoff" still says runChain halts at the first material step; nothing redefines material as irreversible; the handoff seam passes with the shipped ledger | doc scan + suite | `node tests/test-356-larry-contract.cjs && node tests/test-larry-handoff-seam.cjs` | ❌ W0 / ✅ | ⬜ pending |
| D-17 | `test-264-b3-frozen.cjs` passes after the single documented re-pin of `isIrreversibleStep`; the other five pins unchanged | suite | `node tests/test-264-b3-frozen.cjs` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/run-all-356.sh` (guarded run_if legs, em-dash guard over new files)
- [ ] `tests/fixtures/356-jev-noul-responses.json` (synthetic p per command for fixture builds; NOT the real answer key)
- [ ] synthetic ledgers (fresh flag, stale, malformed), built in-test from real registry text via `commandTextHash`
- [ ] recorded baselines before any edit: `test-353-ledger-shape` (13/6), `run-all-166`, `run-all-264`, and the chain suites
- [ ] `tests/test-356-{jev-client,policy,answer-key,ledger-build,runtime,check,egress,tripwires,larry-contract}.cjs`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blind labels on the risk subset | R356-02, D-04, D-16 | Human ground truth; must precede any model output | Navigator fills the label sheet without seeing the policy draft or pre-labels; commit it |
| Policy wording lock | R356-01, D-02 | Navigator owns the wording | Review the drafted `data/jev-policies/command-irreversibility.json`; edit; approve |
| Pre-label review | R356-02, D-04 | Human confirms or corrects Claude's labels for the rest | Row-by-row review; commit the answer key |
| Live Jev build | R356-03, R356-04 | Needs the dev-time key and a live vendor call | Navigator authorizes; run the builder live; commit the ledger |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
