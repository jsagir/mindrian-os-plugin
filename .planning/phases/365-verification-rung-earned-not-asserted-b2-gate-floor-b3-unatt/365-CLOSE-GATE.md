# Phase 365 close gate

Run on 2026-10-01 by plan 365-16 at HEAD `35f942f1c783b229ce021d40e2498484462d6609` (the commit that opened Phase 365.1; it holds only docs and the ROADMAP hunk, so the code under test is the code at `e46359566`, the 365-15 summary commit). The working tree held one peer-owned diff (`353-FLEET-REPORT.json`) and nothing of this plan's beyond docs.

## The aggregator

Command: `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` (the full run, regression block included).

Final counts line: `PASSED=66 FAILED=0 SKIPPED=0 KNOWN=6`, exit 0. This is identical to the baseline recorded at `603e5cba6` (66 / 0 / 0 / 6).

The six KNOWN legs, each matched by exact signature:

| Leg | Signature | Owner |
|-----|-----------|-------|
| tests/test-365-acceptance-byte-derived.cjs | `RED-365-BYTE-DERIVED` | Phase 365.1 (the only 365 leg still red, by design, held by the ladder fence) |
| tests/test-238-chosen-validation.cjs | memory_event count increase | pre-existing, in the regression base |
| tests/test-237-approve-executes.cjs | mutation needle not found | pre-existing, in the regression base |
| tests/test-345-gate-ratify.cjs | `FAIL: test-345-gate-ratify` | pre-existing, in the regression base |
| tests/test-267-mcpv2-zod4-contract.cjs | `tool:research_run:membership` (checks b and d; check a passes) | pre-existing, in the regression base |
| tests/test-198-contract-schema.test.cjs | `contract_version registers (flag off)` | pre-existing, in the regression base |

Every other leg reported PASSED: the 365 acceptance, falsification, ladder-fence, baseline, standing, floor, notice, transitions, never-do, signals, renders, portrait and CLI tests, the Part 8 sweep (every new file clean), the dash fence, the remaining neighbor legs, the gate legs and the CIRS plan check.

## Regression block against the recorded base

Compared with `tests/fixtures/365-regression-base.json` (failing-leg labels, like for like):

| Suite | Exit | Failing legs now | At base | Result |
|-------|------|------------------|---------|--------|
| run-all-354 | 1 | 1 | 1 | PASSED (no leg above base) |
| run-all-355 | 1 | 4 | 4 | PASSED |
| run-all-356 | 0 | 0 | 0 | PASSED |
| run-all-358 | 1 | 6 | 6 | PASSED |
| run-all-363 | 0 | 4 | 4 | PASSED |

No suite is redder than at the phase base. The earlier regressions (365-09 and 365-11 against the 356 pins, the harness-manifest digest and the 348 supersession door; 365-14 against the 363 runner-contract pin) were repaired in `365-REPAIR-01` and in 365-14, and are healed in this run.

## Doctor acceptance

Command: `node scripts/doctor.cjs --acceptance`. Result: `21/22 points passed; failed: verify-release-clean-tree`, exit 1.

| Set | Failing points |
|-----|----------------|
| Base (`doctor_failing_points` in the regression base) | `verify-release-clean-tree` ("tracked-file drift: 1 file(s)") |
| Close | `verify-release-clean-tree` ("tracked-file drift: 1 file(s)") |
| New point caused by 365 | none |

The one drifting tracked file is `.planning/phases/353-icm-section-ruling-system-self-locating-room-map-jtbd-rooted/353-FLEET-REPORT.json`, an uncommitted diff owned by a peer session, not by any 365 plan; this point flips with peer activity in the shared tree, exactly as recorded at base.

## Other checks at the same HEAD

- `node scripts/build-harness-manifest.cjs --check`: `harness-manifest: OK`.
- `node scripts/check-cirs-declaration.cjs --check` over every 365 plan: `OK (17 plan(s))`.
- `node tests/test-365-ladder-fence.cjs`: `PASS=9 FAIL=0`, the fence is armed (`ratified: false`); F7 checks six FLOOR_IDS against the draft ladder.
- Gate legs inside the aggregator: connector registry, command registry, skill mirrors, orchestration projection, render coverage, shape declaration (advisory WARN list is pre-existing and unrelated), floor ledger (52 rows, 0 unresolved), tool honesty (22 tools, 0 high-risk): all PASSED.

## Theo schema-parity list (collected from every 365 SUMMARY)

Mirror on the Theo side only after the tagged release. Detail and reasons are in `365-FOLLOW-ONS.md`.

1. Changed on purpose: the input-schema field description of `gate_render.subject_node_id` (365-08; old and new strings quoted in `365-08-SUMMARY.md`). Nothing else on gate_render, gate_answer, chain_run, graph_write or room_bind changed in field, requiredness or description; N12 (365-13) and K5 (365-09) pin that against the plan-base sources. The `wire-snapshot-zod3.json` entries were updated on purpose; `wire-snapshot-zod4.json` still holds the old strings.
2. Description refresh candidates deliberately not made: `chain_run` (also halts at room-named steps, 365-09), `gate_answer` (lands never-do entries through material_step resumeFns, 365-13), `research_run` (pending cards carry `never_do_gate` and `gate`, 365-13).
3. Response-only additions that change no schema: `chain_run` `halted_at.constraint`, the `constraint_named` and `constraints_malformed` reasons, `never_do_proposal`, `chain_result.never_do_gate`; `research_run` pending `never_do_gate` and the halted_constraint `gate`; gate card data `notice`; `gate_answer` reasoning-node floor fields; `claim_read` `standing`, `standing_portrait` and the extra portrait rows.
