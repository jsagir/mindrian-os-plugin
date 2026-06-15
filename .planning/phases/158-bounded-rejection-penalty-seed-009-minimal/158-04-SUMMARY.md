---
phase: 158
plan: 04
subsystem: tests / the one-command phase gate + the three adversarial boundary sweeps (the SEALING wave)
tags: [run-all-158, byte-stable, orchestrator-purity, part8-no-reason, part9-chokepoint, frozen-148-passthrough, grep-gate-hygiene, RJP-02, RJP-06, RJP-07, RJP-08, SC-05, SC-07]
requires:
  - "the seven Wave 1-3 test-158-*.cjs suites GREEN (reach-id-keying, reach-presentation-counter, reach-reject-only, reach-discount, reach-hard-suppress, reach-fences, reach-frozen-148-guard)"
  - "lib/workflow/reach-reject-reader.cjs computeReachPenalties / countPenalty / rejectCountInWindow + the named constants (Phase 158-03)"
  - "lib/hmi/dial-reach-orchestrator.cjs buildReachList (pure, suppressedReachIds drop; Phase 158-03 / frozen-148 surface)"
  - "tests/run-all-148.sh 18/18 (the frozen constitution passthrough)"
provides:
  - "tests/run-all-158.sh -- the one-command PASS/FAIL phase gate (11 CJS suites + Part 8 sweep + Part 9 sweep + frozen-148 passthrough; exits non-zero if anything fails)"
  - "tests/test-158-reach-byte-stable.cjs -- zero-reject reach list byte-identical to a captured pre-phase baseline (RJP-02)"
  - "tests/test-158-reach-orchestrator-pure.cjs -- comment-stripped tripwire: buildReachList makes zero db/fs/Brain/await calls (Part 9 / SC-07)"
  - "tests/test-158-reach-part8-no-reason.cjs -- behavioral seeded-secret scan + source no-reason-read proof (RJP-06)"
  - "tests/test-158-reach-part9-chokepoint.cjs -- reader reads only via navigation.cjs; no direct sqlite/fs (RJP-07)"
affects:
  - "the phase capstone: one command proves the whole reach-surface penalty build is correct AND that frozen-148 + Part 8 + Part 9 + byte-stable-at-zero hold together"
tech-stack:
  added: []
  patterns:
    - "run-all-148.sh aggregator structure mirrored verbatim (set -uo pipefail, SCRIPT_DIR/REPO_ROOT, CJS_SUITES loop, per-suite PASS/FAIL line, final tally, non-zero exit, carried passthrough)"
    - "grep-gate-hygiene: strip_comments() (grep -vE comment patterns) before every grep so header prose mentioning reason/sqlite/fs never trips OR masks the gate (T-158-04-04)"
    - "Phase 90/110 forbidden-substring tripwire idiom: seed a secret in a reject row, assert ZERO in any value the path reads/emits, assert the count is still correct (reason-blind, not reason-empty)"
    - "test-drift-baseline capture-then-byte-compare: capture buildReachList baseline in-process, JSON.stringify byte-compare the zero-reject fold against it"
    - "shared-file scope discipline: the reader gets a whole-body executable scan; the large shared intent-classifier.cjs is scoped to ONLY its 158 reach-penalty slice so pre-existing unrelated .reason reads are out of scope by construction"
key-files:
  created:
    - "tests/run-all-158.sh"
    - "tests/test-158-reach-byte-stable.cjs"
    - "tests/test-158-reach-orchestrator-pure.cjs"
    - "tests/test-158-reach-part8-no-reason.cjs"
    - "tests/test-158-reach-part9-chokepoint.cjs"
  modified: []
decisions:
  - "intent-classifier.cjs is scoped in the Part 8 sweep to ONLY its 158 reach-penalty slice (grep the 158/penalty-symbol lines, then scan THAT slice), because the shared file carries pre-existing executable .reason reads (offer_next_step.reason:582, offer.reason:1230, routing.reason:1279) that are NOT this phase's code; a whole-file scan would be a false positive on unrelated shipped logic"
  - "the reader gets a whole-body executable scan -- it IS the penalty path and reads only via navigation.cjs"
  - "every grep strips comment lines first (strip_comments) because the reader's only properties.reason / sqlite / fs mentions are comment-only (lines 25/27/183/328); without the strip the gate would self-invalidate on its own honest documentation"
  - "the byte-stable baseline is captured in-process (not a committed golden file) so it can never drift from the orchestrator's current shape while still proving zero-reject == today byte-for-byte"
metrics:
  tasks_completed: 3
  files_created: 5
  files_modified: 0
  completed: 2026-06-15
---

# Phase 158 Plan 04: the one-command phase gate + the three adversarial sweeps (the SEALING wave) Summary

`bash tests/run-all-158.sh` is now the single PASS/FAIL phase gate that proves the whole bounded-rejection-penalty build: it runs all eleven `test-158-*.cjs` suites, a Part 8 reason-read sweep, a Part 9 chokepoint sweep, and the carried frozen-148 passthrough (`bash tests/run-all-148.sh`), and exits non-zero if anything fails. Plus four boundary suites: the byte-stable-at-zero snapshot (RJP-02, the load-bearing reach-surface proof that a zero-reject room renders byte-identical to a captured pre-phase baseline), the orchestrator-purity tripwire (Part 9 / SC-07), the Part 8 no-reason behavioral + source scan (RJP-06), and the Part 9 chokepoint source scan (RJP-07). This wave changed ZERO production logic -- it only proves the phase.

## What was built

### Task 1: byte-stable-at-zero + orchestrator-purity (commit e0ad713a)

- `tests/test-158-reach-byte-stable.cjs` (3 checks). Captures a `buildReachList` baseline in-process for a fixed `reachScores` input (`deep_research` over the 0.70 floor, the rest below) and asserts: (1) the same input renders byte-identical; (2) an empty `suppressedReachIds:[]` is a no-op; (3) the FULL production fold path -- `computeReachPenalties` on a zero-reject room (rejects 0 for every reach_id, presentations met so the zero-penalty is driven by zero rejects not the M fence) -> `Object.assign` fold -> `buildReachList` -- reproduces the baseline byte-for-byte. Broadens the discount-suite check-4 anchor into a standalone RJP-02 snapshot.
- `tests/test-158-reach-orchestrator-pure.cjs` (3 checks). Comment-stripped source tripwire over `dial-reach-orchestrator.cjs`: zero of {`require('node:sqlite')`, `better-sqlite3`, `fs.read/write`, `fetch(`, `https?://`, `brain-client`, `await`, any `navigation` require} in the executable source; the ONLY require is `f-selector-ranker.cjs`; plus a hygiene proof that the RAW source DOES mention the Brain invariant in a comment (so the comment-strip is genuinely load-bearing).

### Task 2: Part 8 no-reason + Part 9 chokepoint (commit 48f5a9c2)

- `tests/test-158-reach-part8-no-reason.cjs` (2 checks). BEHAVIORAL: seeds two REJECTED `f_selector_decision` rows carrying `reason:'SECRETREASON123'` for `deep_research` in a temp room.db (via `recordSelectorDecision` with the Plan 01 reach_id keying), confirms the secret IS in storage (so the test is meaningful), then runs `rejectCountInWindow` + `countPenalty` + `computeReachPenalties` and asserts `SECRETREASON123` appears in NONE of the JSON.stringify'd outputs AND the count is still correct (2) -- reason-blind, not reason-empty. SOURCE: the comment-stripped reader source never reads `properties.reason` / `.reason`. Mirrors the Phase 90/110 forbidden-substring tripwire idiom.
- `tests/test-158-reach-part9-chokepoint.cjs` (3 checks). Comment-stripped source tripwire over `reach-reject-reader.cjs`: it requires `../core/navigation.cjs` and uses `findRecentChanges`; it contains zero direct-db/fs tokens ({`node:sqlite`, `DatabaseSync`, `better-sqlite3`, `fs.read/write`, `readFileSync`, `fetch(`, http, `brain-client`}); `navigation.cjs` is the ONLY non-`node:`-builtin require; plus the raw-source hygiene proof.

### Task 3: tests/run-all-158.sh -- the one-command phase gate (commit f809fdc3)

Mirrors `run-all-148.sh` verbatim where possible (set -uo pipefail, SCRIPT_DIR/REPO_ROOT, a CJS_SUITES array, a loop that runs each suite to completion and continues on failure, a final tally, exit 1 on any failure). Four parts:

- **(a) CJS suites:** all eleven `test-158-*.cjs` (the seven Wave 1-3 + the four Wave 4). A missing file gates to a FAIL line, never a crash.
- **(b) Part 8 reason-read sweep:** the reader gets a whole-body executable scan for `.reason`; the shared `intent-classifier.cjs` is scoped to ONLY its 158 reach-penalty slice (grep the lines tagged `158-0X` / `computeReachPenalties` / `reach_penalties` / `suppressedReachIds` / `reach_presented` / `discountedScores` / `reachReader` / `reachPenalties`, then scan that slice) so the file's pre-existing unrelated `.reason` reads are out of scope by construction.
- **(c) Part 9 chokepoint sweep:** the reader has no direct sqlite/fs token and DOES require `navigation.cjs`; the orchestrator has no db/fs/Brain/await/navigation token.
- **(d) frozen-148 passthrough:** `bash tests/run-all-148.sh` runs inside the gate; PASS only when it exits 0.

Every grep strips comment lines first (`strip_comments` = `grep -vE '^[[:space:]]*(//|\*|/\*)'`) -- grep-gate hygiene (T-158-04-04): a comment mentioning reason/sqlite/fs must neither trip nor mask the gate.

## The full run-all-158.sh result

```
Phase 158 verification aggregator
  test-158-reach-id-keying.cjs ............. PASSED (4 checks)
  test-158-reach-presentation-counter.cjs .. PASSED (3 checks)
  test-158-reach-reject-only.cjs ........... PASSED (4 checks)
  test-158-reach-discount.cjs .............. PASSED (5 checks)
  test-158-reach-hard-suppress.cjs ......... PASSED (3 checks)
  test-158-reach-fences.cjs ................ PASSED (6 checks)
  test-158-reach-frozen-148-guard.cjs ...... PASSED (8 checks)
  test-158-reach-byte-stable.cjs ........... PASSED (3 checks)
  test-158-reach-orchestrator-pure.cjs ..... PASSED (3 checks)
  test-158-reach-part8-no-reason.cjs ....... PASSED (2 checks)
  test-158-reach-part9-chokepoint.cjs ...... PASSED (3 checks)
  Part 8 reason-read sweep ................. PASSED
  Part 9 chokepoint sweep .................. PASSED
  frozen-148 passthrough (run-all-148.sh) .. PASSED (18/18)

  Total:  14
  Passed: 14
  Failed: 0
  Time:   6s
  EXIT:   0
```

The frozen-148 passthrough is itself the full 148 aggregator: 18/18 (connector-registry --check + IRW-01..08 + 8 carried drift fences + the 148 Part-8 sweep), confirming MAX_K=3, RECOMMEND_FLOOR=0.70, MARGIN_THRESHOLD=0.15, DIAL_REACH_K=6, REACH_IDS length 6, and the 3 postures all held inside the 158 gate (RJP-08 / SC-05).

## Real findings surfaced by the sweeps

None. The Part 8 sweep found zero executable `.reason` reads in the new reach-penalty path; the Part 9 sweep found zero direct sqlite/fs in the reader and zero db/await in the orchestrator. The frozen-148 constitution held. No production logic was changed to make any grep pass.

One pre-existing observation (NOT a 158 finding, already correctly out of scope): the shared `scripts/intent-classifier.cjs` carries three executable `.reason` reads on unrelated paths (`offer_next_step.reason:582`, `offer.reason:1230`, `routing.reason:1279`). These are not the rejection-reason path and were never in the 158 penalty code -- the Part 8 sweep is deliberately scoped to the 158 reach-penalty slice so these do not (and must not) trip the gate.

## Deviations from Plan

None of substance -- the plan was executed as written. One scoping refinement worth recording:

- **[Plan-faithful scoping]** The plan's Task 3 named both `lib/workflow/reach-reject-reader.cjs` and the `scripts/intent-classifier.cjs` reach-penalty edits as Part 8 sweep targets ("the SWEEP_TARGETS (... + scripts/intent-classifier.cjs reach-penalty lines)"). I implemented exactly that scoping: the reader gets a whole-body executable scan, and intent-classifier is scoped to ONLY its reach-penalty lines (via a 158/penalty-symbol line extraction) precisely as the plan's "reach-penalty lines" phrasing requires. A naive whole-file scan of the shared intent-classifier would have been a false positive on three pre-existing unrelated `.reason` reads -- which the handoff note ("scope the sweeps to the NEW 158 code, not the whole repo") explicitly warns against.

## Authentication gates

None.

## Verification

- `bash tests/run-all-158.sh` -> exit 0; 14/14 (11 CJS suites + Part 8 sweep + Part 9 sweep + frozen-148 passthrough). Confirmed by a direct `echo $?` of the gate (DIRECT_GATE_EXIT=0), not a piped exit code.
- `node tests/test-158-reach-byte-stable.cjs` -> PASS (3 checks).
- `node tests/test-158-reach-orchestrator-pure.cjs` -> PASS (3 checks).
- `node tests/test-158-reach-part8-no-reason.cjs` -> PASS (2 checks).
- `node tests/test-158-reach-part9-chokepoint.cjs` -> PASS (3 checks).
- `bash tests/run-all-148.sh` -> 18/18 standalone (RJP-08 / SC-05).
- Byte-stable suite load-bearing proof: injecting a real reject signal into the zero-reject fixture makes the folded render DIFFER from the baseline (so the zero-reject equality assertion is meaningful, not vacuous).
- Part 8 sweep load-bearing proof: appending an executable `const leaked = props.reason;` to a temp copy of the reader TRIPS the strip+grep.
- Part 9 sweep load-bearing proof: appending an executable `require('better-sqlite3')` to a temp copy of the reader TRIPS the strip+grep.
- Em-dash sweep across all five scope files (`run-all-158.sh` + the four suites) -> clean, zero em-dashes.
- This session's three commits (HEAD~3..HEAD) touch ONLY the five new test/bash files -- zero production logic changed.

## Threat surface scan

No new security-relevant surface beyond the plan's `<threat_model>`. Each mitigation is proven in the gate:
- **T-158-04-01 (a future reason read in the penalty path)** mitigated: the Part 8 behavioral seeded-secret suite + the run-all-158.sh comment-stripped reason-read sweep (RJP-06).
- **T-158-04-02 (a future direct sqlite/fs bypass of the chokepoint)** mitigated: the Part 9 source tripwire + the run-all-158.sh Part 9 sweep (RJP-07).
- **T-158-04-03 (a frozen-148 break slipping the phase gate)** mitigated: run-all-148.sh is a carried passthrough inside run-all-158.sh; a broken constant fails the 158 gate (RJP-08 / SC-05).
- **T-158-04-04 (a grep gate self-invalidating on header prose)** mitigated: every sweep strips comment lines (`strip_comments`) before counting; load-bearing-strip proofs confirm both the byte-stable and the purity tests genuinely guard executable lines, and the raw source DOES carry the documenting comments.
- **T-158-04-05 (byte-stability silently broken)** mitigated: the byte-stable snapshot suite (captured-baseline byte-compare) is in the gate; the load-bearing proof confirms a non-identical zero-reject render fails it (RJP-02).
- **T-158-04-SC (npm/pip/cargo installs)** N/A: zero new packages (bash + four CJS test files only).

## Known Stubs

None. All four new suites exercise shipped behavior; the gate runs real suites + real grep sweeps + the real 148 passthrough. No hardcoded empty values, placeholder text, or unwired data sources.

## Self-Check: PASSED

Files verified present:
- FOUND: tests/run-all-158.sh
- FOUND: tests/test-158-reach-byte-stable.cjs
- FOUND: tests/test-158-reach-orchestrator-pure.cjs
- FOUND: tests/test-158-reach-part8-no-reason.cjs
- FOUND: tests/test-158-reach-part9-chokepoint.cjs

Commits verified present:
- FOUND: e0ad713a (test 158-04: byte-stable-at-zero snapshot + orchestrator-purity tripwire)
- FOUND: 48f5a9c2 (test 158-04: Part 8 no-reason scan + Part 9 chokepoint tripwire)
- FOUND: f809fdc3 (test 158-04: run-all-158.sh one-command phase gate)
