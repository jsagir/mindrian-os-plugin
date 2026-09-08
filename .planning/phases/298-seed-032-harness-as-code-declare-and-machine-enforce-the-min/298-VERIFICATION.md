---
phase: 298-seed-032-harness-as-code-declare-and-machine-enforce-the-min
verified: 2026-09-08T00:00:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "A fresh Larry passes the four beta.27 behavioral tests on Claude Desktop and on Cowork, and shows a governance basket (readable rows: claim text as label, kind -> section/confidence/source as description) for a two-candidate write, staying silent after confirmation"
    expected: "Behavioral tests pass on both hookless surfaces; the F.8 card renders with the D-01 row shape; Larry does not narrate the memory operation"
    why_human: "Desktop and Cowork have no hook or script runtime this verifier can drive; SPEC.md's own Acceptance section and 298-VALIDATION.md's Manual-Only Verifications table both name this as the one truth that cannot be proven by a command"
---

# Phase 298: SEED-032 Harness-as-Code Verification Report

**Phase Goal:** Declare and machine-enforce the agent harness MindrianOS already runs: harness manifest v2 (three additive keys, maps stays three), a closed policy directory with an enforcement rung per policy, one idempotent policy runner, the SEED-037 4d derive-health gate, and the Larry persona as the manifest's first declared consumer. Absorbs Phase 297's regulation policy (D7).
**Verified:** 2026-09-08
**Status:** human_needed
**Re-verification:** No — initial verification

## Note on Requirements Register

This phase's R-01..R-11 are locked in `298-SPEC.md`, not in the global `.planning/REQUIREMENTS.md`. This is the phase's own documented convention (confirmed in every one of the 15 plans' `requirements:` frontmatter, which cites `298-SPEC.md` as the source, and in `298-CONTEXT.md`'s `<spec_lock>` block). `.planning/REQUIREMENTS.md` carries no Phase 298 entries by design — this is not a gap.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | R-01: Manifest v2 adds exactly three top-level keys (`policies`, `larry_surfaces`, `fixture_ref`); `maps` stays exactly 3 | VERIFIED | Live: `node scripts/build-harness-manifest.cjs --check` exit 0, `harness-manifest: OK`. `data/harness-manifest.json` has 9 top-level keys in order `ontology_ref, generated_note, methodology_tier, version, maps, runtime_surfaces, policies, larry_surfaces, fixture_ref`; `maps.length === 3`. `node tests/test-201-harness-manifest.cjs`: 9/9 passed. |
| 2 | R-02: `data/harness-policies/` holds one hand-authored JSON file per policy, validated by a closed `_schema.json`; every existing gate/doctor module reachable from a policy entry | VERIFIED | `ls data/harness-policies/*.json \| wc -l` = 12 (11 policies + `_schema.json`). `node tests/test-298-policies-schema.cjs`: 8/8 passed, including "every non-null runner is repo-relative under scripts/ and resolves on disk" and "exactly three named policies have a null runner, each with a notes explanation." `_schema.json` inspected: closed enums for `rung`, `kind`, `applies_to`, hard-fail-closed validation rule. |
| 3 | R-03: Every policy carries a rung (`declared\|logged\|blocking`); the runner never promotes | VERIFIED | `node scripts/run-harness.cjs --check --json` live output: 11 policies, each with a valid rung, `counts: {total:11, pass:6, fail:0, ghost:3, declared:2}`. `test-298-policies-schema.cjs` assertion 2 confirms rung/kind/applies_to are schema members; `test-298-runner-idempotent.cjs` "never promotes" assertions (zero rung assignments in runner source; two `--policy` runs never change temp policy file mtime) both pass. |
| 4 | R-04: `run-harness.cjs` executes by tier (`--check --tier`) and decides room convergence (`--room`) from Layer 0 alone; a second run on the fixture is a no-op | VERIFIED | Live, run twice: `node scripts/run-harness.cjs --room data/harness-fixtures/converged-room --json` — both runs exit 0, `converged: true`, `cmp -s` on the two output files succeeds (byte-identical), `git status --porcelain` empty, `data/harness-fixtures/converged-room/.mindrian` confirmed absent (`ls` fails with "No such file or directory"). `test-298-runner-idempotent.cjs`: 14/14 passed. |
| 5 | R-05: `gate-graph-derive-health` (SEED-037 4d) built as a check script at rung `logged`; runner refuses `converged:true` while it is a ghost or the derive queue is non-empty | VERIFIED | `data/harness-policies/gate-graph-derive-health.json`: `runner: scripts/check-graph-derive-health.cjs`, `rung: logged`, wraps `detectRoomHealth()` (reuse, not a second detector, per its own `notes`). `node tests/test-298-derive-health.cjs`: 7/7 passed, including ghost-refusal and fixture `skip` status. Live `--check --json`: `gate-graph-derive-health` verdict `pass`, exit 0. |
| 6 | R-06: Larry's three surfaces declared in `larry_surfaces`; `contract-parity-larry` fails `--check` on a dropped phrase or busted byte budget; nine frozen-phrase tests and BOUNDARIES paragraph stay intact | VERIFIED | `node tests/test-298-contract-parity.cjs`: 20/20 passed live — actually tampers each surface (agent/wire/skill), confirms `--check` fails naming the surface+phrase, restores, confirms green again; byte-budget tamper/restore cycle also proven live. `node lib/mcp/no-instructions.test.cjs`: 9/9 passed (1944/1950 bytes, BOUNDARIES paragraph byte-identical). All nine frozen-phrase tests spot-checked live: `test-143.2-doctrine-presence`, `test-larry-handoff-seam`, `test-canon-entry-38-sourced-claims-floor`, `test-gate-native-fire-w1`, `test-chain-executor-part8-leak`, `test-115-persona-variants.sh`, `test-114-substrate-preload.sh` all PASS; `test-205-elevation-doctrine-floor` PASS (45/45). |
| 7 | R-07: `memory-write-policy.json` declares D3/D4/D5 (channels, verbs, basket fires at >= 2 candidates, `NOT_REMEMBERED_BECAUSE`); readable F.8 basket rows (D-01); Part 8 comment fix (D-01a) | VERIFIED | `memory-write-policy.json` inspected: `channels` (Belief/Progress/Experience), `verbs` (track/commit/recall/note mapped to context_assemble/graph_write+claim_write/graph_query+graph_reason/memory_event), `basket_fires_at: 2`, `claim_review_status: proposed`, `toggled_off_writes: NOT_REMEMBERED_BECAUSE`, `narrated: false`. `node tests/test-189-f8-governance-gate.cjs`: 36/36 assertions passed live. `node tests/test-189-governance-candidates.cjs`: 18/18 assertions passed live, including `claim_text`/`knowledge_type`/`source_path` on rows. `governance-candidate-raiser.cjs` header comment confirmed corrected: "Canon Part 8 (corrected 298-04, D-01a): Part 8 fences Brain EGRESS... This card is composed and rendered LOCALLY with zero Brain tokens." |
| 8 | R-08: `lib/hmi/turn-text.cjs` lifts the transcript reader (card-fire repointed); `check-voice-style.cjs` is a log-only Stop hook, always `continue:true` | VERIFIED | `turn-text.cjs` exports 7 functions including `readTurnText`, `readTranscriptTail`. `scripts/check-card-fire.cjs` confirmed repointed: `const turnText = require('../lib/hmi/turn-text.cjs')` at line 166, with comments documenting the 298-03 lift. `hooks/hooks.json` Stop chain carries `check-voice-style.cjs` at 3000ms timeout. `node tests/test-298-voice-log.cjs`: 10/10 passed live, including malformed-stdin and missing-transcript-path cases both returning `continue:true`, exit 0. |
| 9 | R-09: `doctor.cjs --acceptance` gains one `harness-policies` blocker point that spawns the runner | VERIFIED | Live: `node scripts/doctor.cjs --acceptance --pre-tag` → `PASS harness-policies: every declared harness policy runs and no blocking policy failed`, `17/17 points passed`. Live negative: `DOCTOR_TEST_MODE=1 DOCTOR_TEST_FAIL_POINT=harness-policies node scripts/doctor.cjs --acceptance --pre-tag` → exit 1, `FAIL harness-policies ... synthesized failure (test mode)`, `16/17 points passed`. |
| 10 | R-10: `recipe-maps.cjs` tolerates new keys and exposes `policies`; `command-registry.json` and T-side payload unchanged | VERIFIED | Live: `require('./lib/core/recipe-maps.cjs').loadManifest().policies` returns `{path, digest, count: 11}`. `git diff --stat <baseline-HEAD> HEAD -- data/command-registry.json` is empty (zero changes). `recipe-maps.cjs` diff is +5/-1 lines only (additive). |
| 11 | R-11: New tests (`test-298-policies-schema`, `test-298-runner-idempotent`, `test-298-derive-health`, `test-298-voice-log`, `test-298-contract-parity`) plus existing 167/201/235, nine frozen-phrase tests, `no-instructions.test.cjs`, `test-doctor-acceptance-self-coverage`, `check-hook-schema-compatibility` stay green; no new failures | VERIFIED | `bash tests/run-all-298.sh`: `PASS=9 FAIL=0 SKIP=0`. All 5 new `test-298-*` files run live above, all green. Spot-checked 20/20 commands from `298-TEST-BASELINE.md` live (see Behavioral Spot-Checks below): the same 5 pre-existing failures persist or improved, zero new failures. `check-hook-schema-compatibility.cjs` and `test-doctor-acceptance-self-coverage.cjs` both PASS live. |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `data/harness-manifest.json` | v2, 9 top-level keys, `maps` length 3 | VERIFIED | Confirmed live, exact key order matches spec |
| `data/harness-policies/_schema.json` | closed policy schema | VERIFIED | Read in full; closed enums, fail-closed validation rule |
| `data/harness-policies/*.json` (11 files) | one per policy | VERIFIED | 11 present + schema = 12 files; all pass `test-298-policies-schema.cjs` |
| `scripts/run-harness.cjs` | idempotent policy runner | VERIFIED | `--check`, `--tier`, `--room`, `--policy` all live-tested |
| `scripts/check-graph-derive-health.cjs` | SEED-037 4d gate | VERIFIED | wraps `detectRoomHealth()`; live pass; ghost-refusal tested |
| `lib/hmi/turn-text.cjs` | lifted transcript reader | VERIFIED | exports confirmed; card-fire repointed |
| `lib/hmi/voice-style-log.cjs` | log + `evaluatePromotion` | VERIFIED | single evaluator used by both runner and doctor module per D-02 |
| `scripts/check-voice-style.cjs` | log-only Stop hook | VERIFIED | wired in `hooks/hooks.json`; `test-298-voice-log.cjs` 10/10 |
| `lib/core/doctor/voice-style-log-module.cjs` | never-warn doctor module | VERIFIED | registered in `data/doctor-modules.json` at `voice-style-log` |
| `data/harness-fixtures/converged-room/` | scaffold-born, no `.mindrian/` | VERIFIED | 13 entries, `.mindrian` confirmed absent live |
| `lib/core/recipe-maps.cjs` | tolerant, exposes `policies` | VERIFIED | additive diff only, `policies` live-confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `scripts/build-harness-manifest.cjs` | `data/harness-policies/` | digest (path/sha256/count) at `--check` | WIRED | manifest's `policies` key matches `recipe-maps.cjs` output live |
| `scripts/run-harness.cjs` | policy `runner` paths | `spawnSync('node', [resolved, ...args])` | WIRED | live `--check --json` shows 6 pass, 3 honest ghosts (null runner), 2 declared-only — exactly matches `_schema.json`'s three enforcement classes |
| `scripts/doctor.cjs --acceptance` | `scripts/run-harness.cjs --check` | spawned acceptance point | WIRED | live PASS/FAIL round-trip proven both directions |
| `scripts/check-card-fire.cjs` | `lib/hmi/turn-text.cjs` | `require()` | WIRED | grep confirms import + comment trail |
| `hooks/hooks.json` (Stop) | `scripts/check-voice-style.cjs` | hook entry | WIRED | grep confirms entry, 3000ms timeout |
| `lib/core/memory/governance-candidate-raiser.cjs` | F.8 card rows | `label`/`description` mapping | WIRED | `test-189-governance-candidates.cjs` 18/18 confirms `claim_text`, `knowledge_type`, `source_path` populate the row |

### Behavioral Spot-Checks (298-TEST-BASELINE.md 20-command comparison, live re-run)

| Command | Baseline | Live Re-run | Status |
|---------|----------|--------------|--------|
| `build-harness-manifest.cjs --check` | PASS | PASS | ✓ unchanged |
| `test-harness-manifest-check.cjs` | PASS (7/0) | PASS (7/0) | ✓ unchanged |
| `test-harness-manifest-part8-boundary.cjs` | PASS (6/0) | PASS (8/0, widened) | ✓ improved (v2 fields added, expected) |
| `test-201-harness-manifest.cjs` | PASS (5/0) | PASS (9/0, widened) | ✓ improved (298 assertions added, expected) |
| `test-harness-167-verdict.cjs` | FAIL (2 failed) | FAIL (1 failed) | ✓ improved — 298-14 fixed D-167-03 as a documented in-scope R-11 side effect; D-167-06 (unrelated, pre-existing) still fails as expected |
| `test-harness-manifest-precommit-wiring.cjs` | FAIL (1/5) | PASS (8/0) | ✓ improved — same 298-14 fix (`ba7f72b1`/`9a1a4d5b`), documented in 298-14-SUMMARY.md as one auto-fixed deviation, in-scope, no new failures |
| `no-instructions.test.cjs` | PASS (9/0) | PASS (9/0) | ✓ unchanged |
| `test-143.2-doctrine-presence.cjs` | PASS | PASS | ✓ unchanged |
| `test-larry-handoff-seam.cjs` | PASS (6/6) | PASS | ✓ unchanged |
| `test-canon-entry-38-sourced-claims-floor.cjs` | PASS (58) | PASS (58) | ✓ unchanged |
| `test-gate-native-fire-w1.cjs` | PASS (12) | PASS (12) | ✓ unchanged |
| `test-chain-executor-part8-leak.cjs` | PASS | PASS | ✓ unchanged |
| `test-115-persona-variants.sh` | PASS (7/7) | PASS (7/7) | ✓ unchanged |
| `test-114-substrate-preload.sh` | PASS | PASS | ✓ unchanged |
| `test-205-elevation-doctrine-floor.cjs` | PASS (45) | PASS (45) | ✓ unchanged |
| `test-115-surfaces-grep.sh` | FAIL (assertion 3) | FAIL (assertion 3, same) | ✓ unchanged pre-existing (README.md phrase, unrelated to 298) |
| `check-hook-schema-compatibility.cjs` | PASS | PASS | ✓ unchanged |
| `test-doctor-acceptance-self-coverage.cjs` | PASS (6/0) | PASS (6/0) | ✓ unchanged |
| `test-209-declared-implies-wired.cjs` | FAIL | FAIL (same root cause) | ✓ unchanged pre-existing (advisory skill-list drift, unrelated to 298) |
| `test-connector-exhaustive-coverage.cjs` | FAIL (3/3) | FAIL (3/3, same 270≠253) | ✓ unchanged pre-existing (registry-wide identity, unrelated to 298) |

All 20 baseline commands re-run live. Zero new regressions. Two tests (`test-harness-167-verdict.cjs`, `test-harness-manifest-precommit-wiring.cjs`) that were pre-existing-red at baseline are now improved/green, a documented, in-scope side effect of plan 298-14's R-11 work (commits `ba7f72b1`, `9a1a4d5b`). Three pre-existing failures unrelated to this phase's scope (`test-115-surfaces-grep.sh`, `test-209-declared-implies-wired.cjs`, `test-connector-exhaustive-coverage.cjs`) persist unchanged, exactly as the baseline predicted.

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `tests/run-all-298.sh` | `bash tests/run-all-298.sh` | `Phase 298: PASS=9 FAIL=0 SKIP=0` | PASS |

### Anti-Patterns Found

None. Scanned all ~28 files changed in this phase (per `git log --name-only`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented". Every match found was a legitimate non-stub usage (SQL bind-variable placeholders in `governance.cjs`, a documented literal-token name `MINDRIAN_HOME_TOKEN` in `run-harness.cjs`, and prose describing artifact-content design in `SKILL.md`/`larry-extended.md` — "filed artifacts carry placeholders for what is unknown," a described behavior, not an implementation stub).

### ROADMAP Integrity Check

`grep -c "ABSORBED BY PHASE" .planning/ROADMAP.md` = 9 (this session's mid-execution navigator-directed fusing of unrelated stub phases, as flagged in the task). Phase 298's own ROADMAP block inspected directly (lines 1272-1287+): goal text matches SPEC.md verbatim, requirements list is `R-01` through `R-11` exactly, `Depends on: Phase 297 (absorbed)`, `Plans: 15/15 plans complete`, all 15 plan checkboxes present and checked in Wave 1/Wave 2 order. No stray damage found in Phase 298's own entry.

### Requirements Coverage

Per the phase-local convention (298-SPEC.md is the requirements register, not the global `.planning/REQUIREMENTS.md`): all 11 requirements (R-01 through R-11) traced to plans 298-01 through 298-15 via each plan's `requirements:` frontmatter, and each is SATISFIED per the Observable Truths table above. No orphaned or unclaimed requirements found.

### Deviations Reviewed (from SUMMARY.md files)

10 of 13 plans with a "Total deviations" section reported 0; three (298-09, 298-10, 298-12, 298-14) reported 1-2 auto-fixed Rule-1 (bug) deviations, each explicitly scoped to "necessary for the plan's own stated acceptance criteria," none expanding scope. Spot-checked the most consequential one (298-14's fix of two pre-existing red tests) directly against live test output above — confirmed accurate and in-scope.

### Human Verification Required

### 1. Fresh Larry behavioral tests + governance basket on Desktop/Cowork

**Test:** Open a fresh Claude Desktop session and a fresh Cowork session. On each, run the four beta.27 behavioral prompts, then state two claims in one turn.
**Expected:** All four behavioral tests pass on both surfaces. The F.8 governance basket renders with readable rows (claim text as the label; `knowledge_type -> target_section`, confidence, and `source_path` in the description, per D-01). Larry stays silent after confirmation (no narration, per Canon Part 12).
**Why human:** Desktop and Cowork have no hook or script runtime this verifier can drive from a command; `298-SPEC.md`'s Acceptance section and `298-VALIDATION.md`'s "Manual-Only Verifications" table both name this as the one truth in this phase that cannot be proven programmatically. All of its supporting machinery (the basket row shape, the silent-after-confirm path, the two-candidate threshold) is independently proven live above via `test-189-f8-governance-gate.cjs` and `test-189-governance-candidates.cjs` — only the end-to-end Desktop/Cowork behavioral render is unverifiable here.

### Gaps Summary

No gaps found. All 11 SPEC.md requirements (R-01 through R-11) are verified live against the actual codebase, not against SUMMARY.md claims: the manifest, policy directory, schema, runner (tiered `--check`, `--room`, `--policy`), the SEED-037 4d derive-health gate, the Larry contract-parity policy (dropped-phrase and byte-budget failures proven live via tamper/restore), the D3/D4/D5 memory-write policy and D-01/D-01a governance basket fix, the R-08 voice-log rung 2 machinery, the R-09 doctor acceptance point (proven both PASS and forced-FAIL live), R-10 recipe-maps tolerance with a byte-unchanged T-side payload, and R-11's full test suite (9/9 in `run-all-298.sh`, zero new regressions across all 20 baseline commands re-run live, two pre-existing failures actually improved as a documented in-scope side effect). The only unresolved item is the single human-verification truth the phase's own SPEC and VALIDATION docs already named as manual-only: the Desktop/Cowork behavioral pass plus governance-basket render, which needs a live conversational session this verifier cannot drive.

---

*Verified: 2026-09-08*
*Verifier: Claude (gsd-verifier)*
