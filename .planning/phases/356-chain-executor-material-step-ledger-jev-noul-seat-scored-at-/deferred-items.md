# Phase 356 Deferred Items

Out-of-scope discoveries and deferred refactors surfaced while executing Phase 356
plans. Not fixed under the current task; logged here per the executor's scope-boundary
discipline.

## 356-02: build-section-command-ledger.cjs refactor DEFERRED

- **Date:** 2026-09-23
- **Found during:** 356-02 Task 2, STEP 2 refactor decision.
- **Git status at decision time:**
  ```
   M scripts/eval-icm-writers.cjs
   M tests/test-353-grader-agreement.cjs
   M tests/test-353-ledger-shape.cjs
  ```
  (`scripts/build-section-command-ledger.cjs` itself was clean.)
- **Reason:** D-18 (356-CONTEXT.md): the uncommitted diffs in
  `scripts/eval-icm-writers.cjs` and `tests/test-353-{grader-agreement,ledger-shape}.cjs`
  are unowned by 356 (jsagi-25, jsagi-d9 and jsagi-e0 each disclaim them per the
  navigator's SPEC interview log). 356 never edits, stashes, or reverts them. Since the
  planned refactor of `build-section-command-ledger.cjs` only touches that file itself,
  the risk is not a direct edit conflict; it is that refactoring the shared exports
  (`loadKey`, `assertEgressCeiling`, `jev`, `pool`) while their consumers carry unreviewed,
  in-flight diffs of unknown shape (per the Pattern 1 table in 356-RESEARCH.md,
  `eval-icm-writers.cjs`'s diff adds a typed Choice payload and a `jevFn` seam) risks
  silently breaking a peer session's uncommitted work with no way to verify parity against
  code that has not landed. This is the same guard jsagi-25 applied to 354-17
  (commit `873363114`): refactor only when all four paths are clean.
- **Scope:** `scripts/build-section-command-ledger.cjs`'s local `loadKey`,
  `EGRESS_ALLOWED_*`, `assertEgressCeiling`, `sleep`, `jev`, `pool` definitions
  (`build-section-command-ledger.cjs:67-172` at HEAD). Not touched by 356-02.
- **Impact on 356-02:** None. `scripts/jev-devtime-client.cjs` was extracted and proven
  parity-equivalent to the pre-extraction guard via `tests/fixtures/356-section-guard-parity.json`
  (16 cases) and `tests/test-356-jev-client.cjs` leg (b), which replays every case against
  BOTH the extracted client and the 353 builder's own untouched `assertEgressCeiling`
  export, proving they agree without requiring the builder itself to change.
- **Recipe to apply later** (once `git status --short -- scripts/eval-icm-writers.cjs
  tests/test-353-grader-agreement.cjs tests/test-353-ledger-shape.cjs
  scripts/build-section-command-ledger.cjs` is clean on all four paths):
  1. Message jsagi-25 and jsagi-e0 first (D-06: the 353 builder is a shared file).
  2. Delete the local `loadKey`, `EGRESS_ALLOWED_*` sets, `assertEgressCeiling`, `sleep`,
     `jev`, `pool` definitions (`build-section-command-ledger.cjs:67-172`).
  3. `const client = require('./jev-devtime-client.cjs');`
  4. `const assertEgressCeiling = client.makeEgressGuard(client.EGRESS_PROFILES.section_command_ledger);`
  5. `function loadKey() { return client.loadKey({ env: process.env, secretsPath: path.join(os.homedir(), '.secrets', 'typesafe.env') }); }`
  6. `function jev(key, body) { return client.jev(body, { key: key, guard: assertEgressCeiling, endpoint: ENDPOINT }); }`
  7. `const pool = client.pool;`
  8. Keep `ENDPOINT` and `MODEL` constants in the builder; `module.exports` names
     unchanged (`loadKey`, `assertEgressCeiling`, `jev`, `pool` re-exported exactly as
     before, so `scripts/eval-icm-writers.cjs` and `tests/test-353-*.cjs` need zero
     changes).
  9. Re-run the four 353 suites with `env -u TYPESAFE_API_KEY` and compare against the
     356-02 Task 1 baselines (`test-353-ledger-shape.cjs` PASS=13 FAIL=6,
     `test-353-grader-agreement.cjs` 30/0, `test-353-release-wiring.cjs` 8/0,
     `test-353-tripwires.cjs` green). If any count differs, restore only this file
     (`git checkout -- scripts/build-section-command-ledger.cjs`, sanctioned because it
     was clean before the refactor edit) and re-defer.

## 356-09: pre-existing tests/test-356-policy.cjs shipped-policy leg failure DEFERRED

- **Date:** 2026-09-23
- **Found during:** 356-09 baseline check (`bash tests/run-all-356.sh`), before any 356-09
  edit landed. Confirmed pre-existing: `git stash`-free baseline run (no working-tree
  changes at the time) already reported `PASSED=21 FAILED=1 SKIPPED=3`, with the one
  failure being `test-356-policy.cjs`'s `shipped policy: boundary_cases mentions
  /mos:vault` leg.
- **Reason:** 356-06 landed `data/jev-policies/command-irreversibility.json` under the
  D-21 rubric ("always stop for the navigator", not "outside the machine"). Its
  `boundary_cases` array names `/mos:export`, `/mos:snapshot`, `/mos:present`,
  `/mos:publish`, `/mos:update`, `/mos:doctor`, `/mos:admin`, `/mos:rs-fetch`, and
  `/mos:wiki`, but never `/mos:vault` -- `tests/test-356-policy.cjs`'s shipped-policy
  leg (owned by 356-07) still asserts the pre-D-21 boundary-case list. This is a
  356-06/356-07 mismatch, not caused by any 356-09 edit: `scripts/build-command-
  irreversibility-ledger.cjs`'s Task 1 and Task 2 commits do not touch the policy file,
  `readPolicy`'s validation (shape only: `policy_id`, `version`, `instructions`,
  `criteria.{true,false}`, non-empty `boundary_cases[]`), or `tests/test-356-policy.cjs`.
- **Scope:** `tests/test-356-policy.cjs` (the shipped-policy leg) and/or
  `data/jev-policies/command-irreversibility.json` (`boundary_cases`). Neither file is
  in 356-09's `files_modified`.
- **Impact on 356-09:** `bash tests/run-all-356.sh` reports `FAILED=1` both before and
  after 356-09's two commits (confirmed by re-running the full aggregator after each
  commit); the one failure is this pre-existing mismatch, never a 356-09 regression.
  `node tests/test-356-ledger-build.cjs` itself is green (73/73) standalone.
- **Recipe to apply later** (356-07 or 356-06's owner): either add `/mos:vault` back to
  the policy's `boundary_cases` (if D-21's rubric still wants it named explicitly) or
  update `tests/test-356-policy.cjs`'s shipped-policy leg to match the D-21-era wording,
  whichever the navigator rules is correct for the current rubric.

**RESOLVED in 356-08:** policy v3 adds the `/mos:vault` boundary case (navigator ruling
d21-vault: not flagged, "Only if user has obsidian in their systme or asked for it").
`tests/test-356-policy.cjs` is green (36/36).

## 356-08: items surfaced at the validation desk, out of scope for Phase 356

- **Date:** 2026-09-23
- **Found during:** 356-08 Task 3 (transcribing 356-NAVIGATOR-RULINGS.json, `3ccc1a1ff`,
  into the answer key) and the navigator's D-22 directive.
- **Branding requirement (from the `mos-export` ruling):** "m:os styling can be changed !
  but mind mindrian logo alwasy remais wit h main by mindrisnos with www.mindrian-os.com"
  (verbatim). Consequence: `/mos:export` styling is free to change, but the Mindrian logo
  and the "mindrianos / www.mindrian-os.com" mark must always remain on every exported
  artifact. No 356 file currently enforces this at the export-command level (356 only
  reads the ruling to decide the flag); a future phase should verify `commands/export.md`
  and its renderer actually pin this mark. Out of scope for 356 per the same ruling's own
  text (also recorded in 356-CONTEXT.md D-21).
- **HITL idea (from the `d21-mva-brief` ruling):** "This is a quicl. you can add a if to
  render ask for user. HITL" -- the navigator's suggestion that `/mos:mva-brief` should
  gain a conditional AskUserQuestion gate before its deploy step, rather than always
  running unattended. Not built in 356 (356 only scores the command as not-flagged, since
  running it today renders a brief with no deploy per its own teaching line); a future
  phase should evaluate adding the HITL gate the navigator described.
- **Theo-sync notes (from `d21-new-surface` and `d21-scheduled-tasks` rulings):**
  - `/mos:new-surface`: "need to flash cuz Theo needs to get a mirroring set of nodes
    also" -- the navigator flagged this command as irreversible partly because Theo
    needs a mirrored node set when a new surface is registered; no 356 file wires that
    mirroring today.
  - `/mos:scheduled-tasks`: "Theo needs to get enged to offer" -- the navigator's note
    that Theo should be engaged to offer scheduled-task suggestions; not built in 356.
  - Both are deferred to whichever future phase owns the Theo-mirroring and
    Theo-suggestion work; 356 only carries the navigator's flag/reason into the answer
    key.
- **Impact on 356:** none; these are read-only citations of the navigator's own ruling
  text, carried into `data/jev-labels/command-irreversibility.json`'s `reason` fields
  verbatim. No 356 code change implements any of the three.
