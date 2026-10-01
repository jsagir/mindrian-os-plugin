---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 01
subsystem: verification-baseline
tags: [baseline, aggregator, requirements, ladder-fence, wave-0]
requires: []
provides:
  - V365-01..18 registered as open rows in REQUIREMENTS.md
  - data/verification-ladder.json (draft 0-5 ladder, ratified false)
  - tests/test-365-ladder-fence.cjs (D-25 fence)
  - tests/run-all-365.sh (phase aggregator, written once)
  - tests/fixtures/365-regression-base.json (what was red before 365 touched anything)
affects: [365-02, 365-03, 365-16, 365-17]
requirements: [V365-01, V365-17, V365-18]
key-files:
  created:
    - data/verification-ladder.json
    - tests/test-365-ladder-fence.cjs
    - tests/run-all-365.sh
    - tests/fixtures/365-regression-base.json
  modified:
    - .planning/REQUIREMENTS.md
decisions:
  - "F3 fences a derived-rung export by key shape (derive+rung or bare derivation), not bare /deriv/i, because deriveCheckStatus and deriveVerificationStatus already exist and are legal"
  - "Neighbor and gate reds are wrapped by run_known with one recorded first-failing-line signature each, held in known_signature() inside run-all-365.sh"
  - "Regression compare normalizes a suite's failing legs to their labels (the text between '>>> ' and ': FAILED'), so base and now compare like for like"
metrics:
  tasks: 3
  files: 5
  commits: 3
---

# Phase 365 Plan 01: Baseline, Ladder Fence and Aggregator Summary

Phase 365 is now registered, fenced and measurable before any product code changes: 18 open V365 rows, a data fence that fails if ladder-blocked work lands while the ladder is unratified, one aggregator with a token-exact red-list rule, and a recorded regression base at the phase base.

PLAN_BASE = `74853207683c1dc5cf5b449050002a35a1805525` (short `748532076`).

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `7933c1631` | docs(365-01): mint the V365 requirement family at plan time |
| 2 | `ba678e542` | test(365-01): verification ladder data and the D-25 fence |
| 3 | `d09c0f092` | test(365-01): phase aggregator run-all-365 and the regression base |

Each commit passed `git merge-base --is-ancestor <sha> HEAD`. Task 1 used the shared-doc procedure (`git diff` to a patch file, `git apply --cached`, `git diff --cached --name-only` showed only `.planning/REQUIREMENTS.md`, plain `git commit -m`). Tasks 2 and 3 used `git add` then `git commit --only` on exact paths. STATE.md and ROADMAP.md progress were not touched.

## What was built

**Task 1, V365 family.** A `### Phase 365 - Verification rung earned not asserted (V365 family)` section sits immediately before `## Traceability`, with an intro paragraph and V365-01..V365-18 as `- [ ]` rows (no Measured line). Traceability: both stated totals moved 418 to 436, `plus V365-01..18 (Phase 365)` was appended to the family list, a minted-at-plan-time paragraph was added after the DRP363 one (closing plan `365-16-PLAN.md` Task 2), and V365 was added to the Caveat list. The diff holds additions inside those two places only, plus the four edited sentences.

**Task 2, ladder file and fence.** `data/verification-ladder.json` records the draft 0-5 ladder (unchecked, recall, model_internal, secondary_document, primary_source_located, person), the three structural predicates, `ratified: false`, and `follow_on_phase: "365.1"`. `tests/test-365-ladder-fence.cjs` runs nine checks (F1..F9):

| Leg | What it fails on |
|-----|------------------|
| F1 | `TODO(358)` marker gone from verification.cjs |
| F2 | VERIFICATION_RUNGS ids differ from the five provisional ids, in order |
| F3 | a derived-rung export on verification.cjs or navigation.cjs |
| F4 | `rung: z.number()` gone from claim_verify's schema |
| F5 | `person` joins TRUTH_CLAIM_TYPES |
| F6 | insights.cjs exports a key matching /silence/i (the B4 split) |
| F7 | FLOOR_IDS (once exported) holds an id outside the draft ladder (vacuous today, and the output says so) |
| F8 | ladder file invalid (schema, six rungs 0..5, ids, no dash characters) |
| F9 | ratified false: fence armed (null `ratified_at`/`ratified_by_role`, follow-on 365.1). When ratified is true, F8 runs, then it prints `RATIFIED: the ladder fence is released; open Phase 365.1` and exits 0 |

`LADDER_FENCE_VERIFICATION_PATH` points F1/F2/F3/F7 at a scratch copy of verification.cjs.

**Task 3, aggregator and base.** `tests/run-all-365.sh` (Bash 3.2 compatible, written once): glob discovery with the found-eq-0 guard, the red-list rule (KNOWN only on an exact token-set match; NOW GREEN, STALE, NEW RED, crash and a malformed list all FAIL; a listed file not yet created is SKIPPED), the Part 8 sweep, the dash fence over every file any 365 plan touches, 33 neighbor legs, 8 gate legs plus the CIRS plan check, and the opt-in regression block (`RUN_365_REGRESSIONS=1`) comparing run-all-354/355/356/358/363 failing legs with the recorded base. Known reds are wrapped by `run_known` through `known_signature()`.

## Verification (aggregator results, with the HEAD they ran on)

| Run | HEAD | Result |
|-----|------|--------|
| `node tests/test-365-ladder-fence.cjs` | `ba678e542` | PASS=9 FAIL=0, exit 0 |
| `TEST_365_PREFIX=tests/test-365-ladder bash tests/run-all-365.sh` | `ba678e542` | exit 0, PASSED=40 FAILED=0 SKIPPED=1 KNOWN=5 (the one skip is the regression block, RUN_365_REGRESSIONS unset) |
| `RUN_365_REGRESSIONS=1 bash tests/run-all-365.sh` (full) | `ba678e542` | exit 0, PASSED=45 FAILED=0 SKIPPED=0 KNOWN=5; all five regression suites PASSED against the base (354: 1 vs 1, 355: 4 vs 4, 356: 0 vs 0, 358: 6 vs 6, 363: 4 vs 4) |

`ba678e542` is the HEAD that was current when these ran; `d09c0f092` (the aggregator commit) differs from it only by adding the two files that ran. Re-run `bash tests/run-all-365.sh` at your HEAD before trusting any green.

At the moment of the full run the sibling Wave 1 plans had landed nothing: `tests/test-365-ladder-fence.cjs` was the only `tests/test-365-*.cjs`, and `tests/fixtures/365-baseline-red.json` did not exist yet (365-02 writes it), so the red list was empty and no listed leg was reported.

### Scratch proof that the fence bites

A scratch copy of verification.cjs (in the session scratchpad, not the repo) had `deriveRung() { return 3; }` added to its exports. With `LADDER_FENCE_VERIFICATION_PATH` pointing at it, the fence printed `FAIL: F3 no derived-rung export ... (derived rung landed while unratified: verification.deriveRung)`, `PASS=8 FAIL=1`, exit 1. The copy was discarded. The ratified-true branch was also proved in a scratch tree: F8 and F9 pass, the `RATIFIED:` line prints, exit 0.

The aggregator's red-list rule was proved on a scratch copy with eight synthetic legs: a matching red gave KNOWN, an extra token NEW RED, a missing token STALE, a listed leg exiting 0 NOW GREEN, a listed leg with no token crash, an unlisted failure FAILED, exit 77 SKIPPED, a listed-but-absent file SKIPPED, a malformed list FAILED the run, and an empty prefix exited 1.

## Known-red signatures (confirmed at execution time, wrapped by run_known)

| Leg | Signature recorded |
|-----|--------------------|
| tests/test-267-mcpv2-zod4-contract.cjs | `tool:research_run:membership` (check (b) red, check (d) red on the fork359 importer, check (a) passes; confirmed as planned) |
| tests/test-198-contract-schema.test.cjs | `AssertionError [ERR_ASSERTION]: contract_version registers (flag off)` (confirmed as planned) |
| tests/test-238-chosen-validation.cjs | `expected memory_event count to increase by exactly 1 (before=0, after=2)` (not named in the plan) |
| tests/test-237-approve-executes.cjs | `7: MUTATION -- could not build the mutated copy (dispatcher-call needle not found` (not named in the plan) |
| tests/test-345-gate-ratify.cjs | `FAIL: test-345-gate-ratify` (stack: `tests/test-345-gate-ratify.cjs:433`; not named in the plan) |

Each of the three extra reds failed identically on three consecutive runs. Every gate leg (connector, command, skill-mirrors, orchestration, render-coverage, shape-declaration, floor-ledger, tool-honesty) was green at base, as were the other 28 neighbor legs. The three extra reds sit on the gate and ledger path 365 will edit; 365-08's updated suites should expect them.

## Regression base (tests/fixtures/365-regression-base.json)

| Suite | Exit | Failing legs at base |
|-------|------|----------------------|
| run-all-354 | 1 | `354: framework command ledger (THEO-01)` |
| run-all-355 | 1 | `272-cache-probe.test.cjs`, `no-regression: part8-egress-guard.test.cjs`, `no-regression: run-all-272.sh`, `test-355-direction-agreement.cjs` |
| run-all-356 | 0 | none |
| run-all-358 | 1 | `358: B2 Part 8 (B2-09)`, `358: MCP surfaces (B1-02/B1-04/B1-05/B1-06)`, `358: claim-write primitive (run only, never edited by 358)`, `358: filing gate (run only, never edited by 358)`, `358: new-session persistence (B1-03)`, `358: tool honesty findings closed (run only, never edited by 358)` |
| run-all-363 | 0 | `216 no-regression (chains 215 + 211)`, `218 substrate no-regression`, `220 no-regression`, `test-131-e2e.cjs` (nested-suite lines its known-red wrappers print; run-all-363 itself reports FAILED=0 KNOWN=10) |

The plan expected run-all-358 to be red on `test-353-filing-gate.cjs` (`EVENT_TYPES.size is 102`). That line did not appear; the observed 358 reds are the six legs above (the claim_verify/claim_read scanAll rows and the CLI write/read persistence legs inside them). They reproduced identically in the full regression run, so they are stable, not flaky.

Doctor `--acceptance` failing points at base: `verify-release-clean-tree` ("verify-release Step 12 reports clean git tree (tracked files only)", detail "tracked-file drift: 1 file(s)"); summary `21/22 points passed`. The drift file was a peer session's uncommitted `.planning/REQUIREMENTS.md` hunk (Phase 366 family) in the shared tree, so this point will flip with peer activity.

The fixture's `base_sha` is PLAN_BASE; `captured_on_head` is `ba678e542` (PLAN_BASE plus the two plan commits that touch no suite input).

## Deviations from Plan

**1. [Rule 1 - Bug] F3 regex narrowed.** The behavior list said "no key matching /deriv/i", but `deriveCheckStatus` (verification.cjs) and `deriveVerificationStatus` (navigation.cjs) are existing, legal exports; the literal regex would fail at base. F3 now fences keys shaped like derive+rung, rung+derive, or the bare word `derivation`. Standing derivation (V365-02) stays legal. File: tests/test-365-ladder-fence.cjs. Commit `ba678e542`.

**2. [Rule 1 - Bug] Dash literals in the test.** The first write of the fence test landed literal U+2014/U+2013 characters in two constants (the escape sequences had been expanded). `grep -nP '[\x{2013}\x{2014}]'` caught it before commit; the constants are now `String.fromCharCode(0x2014)` and `String.fromCharCode(0x2013)`. No dash reached any commit.

**3. [Scope note] F9 shape.** The behavior list defined F9 only as the ratified-true branch, yet the acceptance criteria want nine passing checks in the armed state. F9 therefore also has an armed-state form (ratified false, null ratified_at and ratified_by_role, follow_on_phase 365.1); the net-guard check is folded into the exit code rather than counted as a tenth check.

**4. [Scope note] More known reds than the plan listed** (three extra, table above) and a different 358 failing set than the plan predicted. Both are recorded as measured; nothing was fixed (out of scope).

No authentication gates. No checkpoints in this plan.

## Known Stubs

None. `known_signature()` in run-all-365.sh holds five real signatures; no placeholder data flows anywhere.

## Threat Flags

None. No new network endpoint, auth path, file access or schema at a trust boundary. The aggregator runs local code under the offline preload; data/verification-ladder.json is a static fence file with no real person names (roles only).

## Hand-offs

- 365-02 writes `tests/fixtures/365-baseline-red.json` in the exact shape in the header of run-all-365.sh; the token form is `RED-365-[A-Z0-9-]+`, printed as `RED-365-<NAME>: <detail>`.
- 365-04 exports `FLOOR_IDS`; F7 then activates and checks it against the draft ids.
- 365-16 closes the V365 rows and records Measured lines; 365-17 owns the Phase 365.1 open, gated on `ratified` flipping to true.
- Not modified by this plan: `tests/test-363-cli.cjs`, `tests/test-363-run-quick.cjs`, STATE.md, ROADMAP.md.

## Self-Check: PASSED

- FOUND: .planning/REQUIREMENTS.md (18 `- [ ] **V365-` rows), data/verification-ladder.json, tests/test-365-ladder-fence.cjs, tests/run-all-365.sh, tests/fixtures/365-regression-base.json
- FOUND commits: 7933c1631, ba678e542, d09c0f092 (all ancestors of HEAD)
