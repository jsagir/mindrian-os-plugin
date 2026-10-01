---
phase: 365-verification-rung-earned-not-asserted-b2-gate-floor-b3-unatt
plan: 02
subsystem: verification-baseline
tags: [baseline, acceptance, red-first, wave-0]
requires: [365-01]
provides:
  - tests/helpers/fixture-room-365.cjs (claims with and without source edges, ask and read records, ROOM.md floor writer, fresh read-back)
  - tests/helpers/one-week-365-child.cjs (the second process that asks the room a week later)
  - four acceptance tests, red at base with six stable signatures
  - tests/fixtures/365-baseline-red.json (expected-red list the 365-01 aggregator reads)
  - tests/fixtures/365-pre-phase.json and tests/test-365-baseline.cjs (base pin, confirmNode and irreversible-first guards)
affects: [365-04, 365-08, 365-15, 365.1]
requirements: [V365-01, V365-02, V365-03, V365-04]
key-files:
  created:
    - tests/helpers/fixture-room-365.cjs
    - tests/helpers/one-week-365-child.cjs
    - tests/test-365-acceptance-byte.cjs
    - tests/test-365-acceptance-byte-derived.cjs
    - tests/test-365-acceptance-one-week.cjs
    - tests/test-365-acceptance-floor.cjs
    - tests/fixtures/365-baseline-red.json
    - tests/fixtures/365-pre-phase.json
    - tests/test-365-baseline.cjs
  modified: []
decisions:
  - "Claims keep byte-identical text by varying only the sessionId that seeds the claim node id (CLAIM_NODE_ID), not any text input"
  - "The locator on a source rides on the SOURCED_FROM edge properties, because writeEvidenceClaim has no locator field and 365 must not edit it to seed a fixture"
  - "Fresh-handle read-back uses lib/core/room-db.cjs openRoomDb (the test-354 discipline); navigation.cjs exports no openRoomDb"
metrics:
  tasks: 3
  files: 9
  commits: 3
---

# Phase 365 Plan 02: Failing Baseline on Record Summary

The byte, one-week and floor acceptance tests now exist, run against today's code, and fail with six stable signatures, each tied to the plan that heals it. confirmNode and the irreversible-first rule are pinned byte-unchanged from the base for the whole phase.

PLAN_BASE = `9ada13b799c616d178cb29bdfa60956d7c2fd18c` (short `9ada13b79`). `git diff --quiet PLAN_BASE -- lib/ scripts/` held before each task's red run and at each commit: no product code moved. This plan wrote tests and fixtures only.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `92f1ebbaf` | test(365-02): byte acceptance tests, red at base |
| 2 | `c41da0906` | test(365-02): one-week and floor acceptance tests, red at base |
| 3 | `86b1cec77` | test(365-02): red list, pre-phase fixture and baseline test |

Each used `git add <exact paths>` then `git commit --only -- <exact paths>`, and each passed `git merge-base --is-ancestor <sha> HEAD`. A peer's uncommitted Phase 366 hunks in `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` and `366-VALIDATION.md` were left untouched. STATE.md and ROADMAP.md were not written; no `state.*` writer, `roadmap.update-plan-progress` or `query commit` was run.

## Tokens each test prints at PLAN_BASE (and what was observed)

| Leg | Exit | Tokens | Healed by |
|-----|------|--------|-----------|
| tests/test-365-acceptance-byte.cjs | 1 | `RED-365-BYTE` | 365-04 |
| tests/test-365-acceptance-byte-derived.cjs | 1 | `RED-365-BYTE-DERIVED` | 365.1 |
| tests/test-365-acceptance-one-week.cjs | 1 | `RED-365-ONEWEEK-STATUS`, `RED-365-ONEWEEK-STANDING` | 365-08, 365-15 |
| tests/test-365-acceptance-floor.cjs | 1 | `RED-365-FLOOR`, `RED-365-FLOOR-NOTICE` | 365-08, 365-08 |

Observed values:

- **Byte.** Two claims with byte-identical text (read back from a fresh handle), one with a source edge plus a read record at declared rung 3, one with an ask record at the same rung 3. Both `listClaimsForChecking` rows (claim_id removed) are exactly `{text_preview, review_status: proposed, checking_status: checked, records_total: 1}`: no field differs and no `standing` field exists. Signature detail prints `(none)` as the differing keys.
- **Byte derived.** `typeof navigation.deriveRung` is `undefined`. This leg stays red through Phase 365 by design (the ladder fence keeps it from landing) and is handed to Phase 365.1.
- **One-week.** Process 1 files the claim through the meeting tool, records an ask check at rung 2 through claim_verify, then approves through gate_answer. The spawned second process reads `review_status=confirmed` and `confirmed_events=1`, and its claim_read rendering says `method: ask` but carries no standing words (`STANDING_WORDS.model_only.label` is `null` because the map does not exist). The parent's own fresh-handle status agrees with the child's.
- **Floor.** With `verification_floor: secondary_document` in ROOM.md and claim C1 ask-checked only: the why-line is absent on rung a (elicitation), rung b (AskUserQuestion thin adapter), rung c (headless text) and the meeting card, so four `RED-365-FLOOR-NOTICE: why-line absent on rung <a|b|c|meeting>` lines print; a below-floor approve on the rung c gate left C1 at `confirmed` (`RED-365-FLOOR: below-floor approve landed confirmed`); and the met-floor card (claim C3, `example.org` source) does not name its accepted source, a fifth NOTICE line. The hard checks that pass at base: all three renderers selected as expected, rung a captured exactly one elicitation message and schema, no card carries a "confirm anyway" label, and the met-floor approve lands confirmed.

All three rungs and the meeting card were driven offline; no leg needed exit 77.

## Baseline test (tests/test-365-baseline.cjs)

Seven lines pass (the six plan legs plus a no-network check): base_sha is an ancestor of HEAD; all nine `files_at_base` digests recompute from `git show <base_sha>:<path>`; confirmNode's body digest (`eb9544dff8c5...`) matches from git and from the working tree (D-06); gateFn's first statement `if (isIrreversibleStep(step)) return 'halt';` matches from git and from the working tree (D-12); the six red-list signatures were all observed at base, each has a `365-NN` or `365.1` healer, and none observed is unlisted; no U+2014 or U+2013 in either fixture. The extraction helpers are exported for later 365 plans.

## Verification (with the HEAD it ran on)

| Run | HEAD | Result |
|-----|------|--------|
| `bash tests/run-all-365.sh` | `86b1cec778c7bca468652012ae8fff8fa4e60c67` | exit 0, `PASSED=41 FAILED=0 SKIPPED=1 KNOWN=9` (the one skip is the opt-in regression block, RUN_365_REGRESSIONS unset) |

The four acceptance legs each report `KNOWN (recorded red, signatures match: ...)`; `test-365-baseline.cjs` reports PASSED. KNOWN=9 is the four acceptance legs plus the five neighbor reds 365-01 recorded (267, 198, 238, 237, 345). `node tests/test-365-baseline.cjs` alone: exit 0. Re-run `bash tests/run-all-365.sh` at your own HEAD before trusting any green.

## Deviations from Plan

**1. [Rule 1 - Bug] Dash literals in the baseline test.** The first write of `tests/test-365-baseline.cjs` landed literal U+2014 and U+2013 characters in two constants (the escape sequences were expanded by the write). `grep -nP '[\x{2013}\x{2014}]'` caught it before commit; the constants are now `String.fromCharCode(0x2014)` and `String.fromCharCode(0x2013)`. No dash reached any commit. (Same slip 365-01 recorded.)

**2. [Scope note] Fresh-handle import.** The plan says "a fresh handle from `navigation.openRoomDb`", but navigation.cjs exports no `openRoomDb`; the tests use `lib/core/room-db.cjs` openRoomDb and closeRoomDb, exactly as tests/test-354-gate-subject-promotion.cjs does. Behavior is the plan's intent: every verdict reads through a NEW handle, never a handler's.

**3. [Scope note] Locator placement.** `addSourceEdge` writes the locator onto the SOURCED_FROM edge properties, not the EvidenceClaim node, since writeEvidenceClaim has no locator field and this plan must not edit product code. 365-04 or 365.1 may place it elsewhere; the byte-derived test only needs `deriveRung` to exist, so it will need its fixture revisited if the locator's home moves.

No authentication gates. No checkpoints in this plan.

## Known Stubs

None.

## Threat Flags

None. Tests and fixtures only: no endpoint, auth path, file access at a trust boundary, or schema change. The fixtures contain no real person names (roles only) and no dash characters.

## Hand-offs

- **365-04** heals `RED-365-BYTE`: `listClaimsForChecking` rows must carry a computed `standing` that differs between a source-edge claim and an ask-only claim of identical text, and `listClaimsForChecking(db, {standing})` must filter. After 365-04 lands, remove `tests/test-365-acceptance-byte.cjs` from `tests/fixtures/365-baseline-red.json` (the aggregator fails NOW GREEN until you do) and keep `observed_at_base` in `365-pre-phase.json` as is (the baseline test's leg 5 compares the list against it, so the list may shrink but must never name a signature the pin lacks).
- **365-08** heals `RED-365-FLOOR` and `RED-365-FLOOR-NOTICE`, and `RED-365-ONEWEEK-STATUS`. The tests look for the fixed words `Checked against:`, `needs evidence`, and the exact approve label `Approve, mark as needs evidence` on every rung and on the meeting card; a met-floor card must name its source host (`example.org`); a below-floor approve must land `needs_evidence`; no "confirm anyway" label. The floor test keeps option ids `approve` and `reject` and sends `chosen: ['approve']`, so the relabelled option must keep id `approve`.
- **365-15** heals `RED-365-ONEWEEK-STANDING`: `navigation.STANDING_WORDS.model_only.label` must exist and appear in claim_read's rendered claim alongside the ask check.
- **Phase 365.1** owns `RED-365-BYTE-DERIVED` (`navigation.deriveRung`, located primary source 4, model ask 2). It stays red and KNOWN through Phase 365; the ladder fence (`tests/test-365-ladder-fence.cjs` F3) fails if it lands early.
- Every healing plan edits `tests/fixtures/365-baseline-red.json` to drop the healed signature (or the whole leg when its last signature heals); that is a fixture edit, not an aggregator edit, and the aggregator stays written-once.
- Not modified by this plan: `tests/run-all-365.sh`, `tests/fixtures/365-regression-base.json`, STATE.md, ROADMAP.md, any file under `lib/` or `scripts/`.

## Self-Check: PASSED

- FOUND: tests/helpers/fixture-room-365.cjs, tests/helpers/one-week-365-child.cjs, tests/test-365-acceptance-byte.cjs, tests/test-365-acceptance-byte-derived.cjs, tests/test-365-acceptance-one-week.cjs, tests/test-365-acceptance-floor.cjs, tests/fixtures/365-baseline-red.json, tests/fixtures/365-pre-phase.json, tests/test-365-baseline.cjs
- FOUND commits: 92f1ebbaf, c41da0906, 86b1cec77 (all ancestors of HEAD)
