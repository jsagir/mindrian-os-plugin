---
phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-
plan: 10
subsystem: testing
tags: [check, staleness, answer-key, d-16, d-20, d-21, zero-network]

# Dependency graph
requires:
  - phase: 356-09
    provides: "scripts/build-command-irreversibility-ledger.cjs's computeThreshold, chainRunCommands, appealGate, loadInputs, assembleLedger, runBuild, and the require.main CLI (--jev-fixture, --from-raw, --raw-out, --out, --root, --registry, --labels)"
  - phase: 356-08
    provides: "the navigator-reviewed answer key (data/jev-labels/command-irreversibility.json, D-20/D-21 shape) and the committed D-20/D-21 labeling artifacts (356-CLAUDE-PRELABELS.json, the four blind sheets, 356-NAVIGATOR-RULINGS.json)"
provides:
  - "scripts/build-command-irreversibility-ledger.cjs: runCheck(opts) and the --check CLI branch (first branch of main) -- a key-free, zero-network report of STALE / UNSCORED / REMOVED / LEDGER_MISSING / LEDGER_UNPARSEABLE / POLICY_MISSING / POLICY_DRIFT / LABELS_MISSING / ANSWER_KEY_DRIFT / LABEL_SET_MISMATCH / FLAG_INCONSISTENT / FALSE_ALARM_COUNT_MISMATCH / BUILD_MODE_FIXTURE, each a WARN line, always exit 0"
  - "tests/test-356-check.cjs: 41 checks proving every --check leg keyless and network-free, plus the runtime staleness parity between --check and lib/core/irreversibility-ledger.cjs's forcesIrreversible"
  - "tests/test-356-answer-key.cjs: 33 checks proving loadInputs's INPUT_REFUSED shape gate over synthetic temp keys, then the shipped answer key's coverage, header, row shape, D-21 sheet-vs-ruling provenance, the pre-label seal, and the D-16 blind-before-reveal order from git history"
affects: [356-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "runCheck never throws (every fs/JSON read wrapped) and never calls client.loadKey or client.jev; LEDGER_MISSING/LEDGER_UNPARSEABLE skip only the ledger-dependent checks (STALE/UNSCORED/REMOVED/POLICY_*/ANSWER_KEY_DRIFT/FLAG_INCONSISTENT/FALSE_ALARM_COUNT_MISMATCH/BUILD_MODE_FIXTURE) while LABELS_MISSING/LABEL_SET_MISMATCH (the label checks) still run, since neither needs the ledger"
    - "--check's STALE/UNSCORED detection reuses the exact same commandTextHash the runtime (lib/core/irreversibility-ledger.cjs) uses, proven by editing a temp registry row and showing both --check prints STALE and the runtime silently ignores a forced flag:true entry for that command"
    - "the D-16 labeling-order proof walks git history directly (commitsTouching + git merge-base --is-ancestor + commit timestamps) rather than trusting a self-reported field in the answer key JSON, so it stays true even when the answer key's own shape changes across labeling-workflow revisions"
  patterns-established:
    - "when a plan's action text is written against an artifact shape that later planning amendments changed (here: D-20/D-21 replacing the D-04/D-05 single-blind-sheet --merge shape the plan assumed), the executor re-derives the test's assertions from the ACTUAL shipped shape and documents the mismatch in the test file's own header comment, rather than fabricating fields the shipped data was never given"

key-files:
  created:
    - tests/test-356-check.cjs
    - tests/test-356-answer-key.cjs
  modified:
    - scripts/build-command-irreversibility-ledger.cjs

key-decisions:
  - "The plan's Task 2 action text assumed the answer key would carry blind_sheet_ref, a top-level prelabels_sha256, and a blind_vs_claude_disagreement object (the D-04/D-05 --merge shape). The REAL data/jev-labels/command-irreversibility.json (built by 356-08 under the later D-20/D-21 two-model-blind-plus-arbitration workflow) has none of these; its only two label_source values are two-model-blind-agreement and navigator-arbitrated. Per the objective's context_changes instruction to use the D-20/D-21 artifacts, the shipped-leg checks were rewritten against the actual shape: the D-16 order proof walks the four committed D-20/D-21 sheets via git merge-base --is-ancestor instead of trusting a field that was never written, and the seal check reads the D-04 blind sheet's own recorded prelabels_sha256 header line (the only sheet that carries one) rather than a top-level key field. This is documented at length in tests/test-356-answer-key.cjs's own header comment so a future reader is not confused by the gap between PLAN.md's wording and the test's actual assertions."
  - "Added a D-21-provenance cross-check not explicitly itemized in the plan's row-shape wording: every two-model-blind-agreement row is verified to match sheet B's label and reason exactly, and every navigator-arbitrated row is verified against 356-NAVIGATOR-RULINGS.json's decided rulings (with the documented /mos:admin exception, which uses the navigator's chat clarification text instead of the ruling's own reason field). This closes the gap left by the missing blind_vs_claude_disagreement field: it is a direct, stronger proof that the answer key's rows trace back to the actual committed blind labels and navigator decisions, not just a shape check."
  - "The D-16 order proof does NOT check that the blind sheets precede the policy's first commit (the plan's literal wording for the original D-04/D-16 flow). Checked directly: the policy's first draft commit (55b423709) precedes the D-21 sheets' filled commit (b1a2cfe8d) by several minutes, since D-21 amended the rubric AFTER a policy draft already existed. The objective's context_changes explicitly scoped the D-16 order proof to 'every blind sheet was committed BEFORE the answer key and before any ledger build' -- omitting the policy-precedence leg -- so the test checks exactly that (seal precedes every sheet; every sheet precedes the answer key; every sheet precedes the ledger's built_at once built) and does not assert a policy-ordering claim the actual D-20/D-21 history does not support."
  - "runCheck resolves the policy path via the SAME POLICY_REL constant readPolicy uses, but reads the raw bytes directly (fs.readFileSync) rather than calling readPolicy itself, since readPolicy's shape validation throws INPUT_REFUSED on a malformed policy -- a live-build refusal reason, not something --check should ever throw on. A malformed-but-present policy file degrades to a hash mismatch (POLICY_DRIFT) rather than an uncaught exception."

requirements-completed: [R356-06, R356-02]

# Metrics
duration: ~70min (across a mid-run API spend-limit pause and resume)
completed: 2026-09-23
---

# Phase 356 Plan 10: Key-free --check and answer-key integrity Summary

**Adds a key-free, zero-network `--check` mode (STALE/UNSCORED/REMOVED/drift/mismatch WARN lines, always exit 0) to the irreversibility-ledger builder, plus two new test suites: 41 checks proving `--check` keyless and network-free (including runtime staleness parity with `lib/core/irreversibility-ledger.cjs`), and 33 checks proving the shipped answer key's coverage, provenance, and D-16 blind-before-reveal order from git history.**

## Preflight

Per the objective's `context_changes`, read `356-CONTEXT.md` D-20/D-21/D-22 and `356-08-SUMMARY.md` before writing the answer-key test. Confirmed `data/jev-labels/command-irreversibility.json` (`a6254fd80`) exists with 113 rows, two `label_source` values (`two-model-blind-agreement`: 99, `navigator-arbitrated`: 14), and none of the D-04/D-05 `--merge` output's metadata fields (`blind_sheet_ref`, top-level `prelabels_sha256`, `blind_vs_claude_disagreement`) -- confirming the PLAN.md action text for Task 2 was written against a shape the shipped data does not have. The shipped ledger (`data/command-irreversibility-ledger.json`) was confirmed absent, so shipped-ledger legs in both test files print `PENDING` rather than failing, per the objective's context.

## Performance

- **Duration:** ~70 min (a mid-run API spend-limit error paused the session between finishing the `runCheck` implementation edit and wiring the CLI branch; resumed from the uncommitted diff per the coordinator's message, verified with `git diff`, then continued)
- **Completed:** 2026-09-23
- **Tasks:** 2/2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- **`scripts/build-command-irreversibility-ledger.cjs`** gained `runCheck(opts)` and the `--check` CLI branch (now the first branch of `main`, replacing the placeholder comment left by 356-09). `runCheck` never throws (every `fs`/`JSON` operation wrapped) and never touches `client.loadKey` or `client.jev`. It reports, each as `{ code, detail }`:
  - `REGISTRY_MISSING` (defensive: the registry itself is unreadable)
  - `LABELS_MISSING` / `LABEL_SET_MISMATCH` (the label checks -- run even without a ledger)
  - `LEDGER_MISSING` / `LEDGER_UNPARSEABLE` (skips every ledger-dependent check below)
  - `BUILD_MODE_FIXTURE` (ledger's `build_mode === 'jev-fixture'`)
  - `STALE <command>` (an entry's `text_hash` no longer matches `commandTextHash` over the CURRENT registry row -- the exact hash the runtime uses)
  - `UNSCORED <command>` (a registry command with no ledger entry)
  - `REMOVED <command>` (a ledger entry whose command left the registry)
  - `POLICY_MISSING` / `POLICY_DRIFT` (policy bytes missing, or their sha256 no longer matches `ledger.policy_hash`)
  - `ANSWER_KEY_DRIFT` (answer-key bytes' sha256 no longer matches `ledger.answer_key_hash`)
  - `FLAG_INCONSISTENT <command>` (`entry.flag !== (entry.p_irreversible >= ledger.threshold)`)
  - `FALSE_ALARM_COUNT_MISMATCH` (a recount from entries plus current labels disagrees with `ledger.false_alarm_count`)

  The CLI branch prints each as `WARN: <CODE> <detail>`, then an `OK (...)` or `WARN <count>` summary line, and always calls `process.exit(0)` (SPEC R6: never a release blocker, never needs the key).

- **`tests/test-356-check.cjs`** (41 checks, 11 legs): builds one shared fixture-mode world (a temp policy, a temp answer key over the real registry with only `/mos:publish` labeled `irreversible: true`, and a fixture-mode ledger built via the real 356-09 CLI against `tests/fixtures/356-jev-noul-responses.json`), then exercises clean (exactly one warning, `BUILD_MODE_FIXTURE`), stale (an edited registry row triggers `WARN: STALE`, and separately proves the runtime's `forcesIrreversible` ignores a forced `flag: true` entry once the text hash no longer matches), unscored, removed, flag-inconsistent, false-alarm-recount-mismatch, policy-drift, answer-key-drift, missing-ledger, zero-network/key-free (an in-process `runCheck` call plus a spawned child with a fresh `HOME` and no key), and a shipped-state leg that prints `PENDING` since the real ledger does not exist yet.

- **`tests/test-356-answer-key.cjs`** (33 checks, two groups): unit legs call `loadInputs` directly over synthetic temp answer keys built from the real registry's command set, proving `INPUT_REFUSED` on a missing command, an extra command, missing `reviewed_by`/`reviewed_at`, an invalid `label_source`, an empty `reason`, an unknown `appeal_rulings` command, and an invalid ruling value, plus a clean load. Shipped legs run against the real `data/jev-labels/command-irreversibility.json`: set equality with the live registry, header fields (adapted to the D-20/D-21 shape -- see Decisions), per-row shape and label-source vocabulary, a new D-21-provenance cross-check against the committed `356-D21-SHEET-A.md`/`356-D21-SHEET-B.md` and `356-NAVIGATOR-RULINGS.json`, the pre-label seal (`356-CLAUDE-PRELABELS.json`'s sha256 against the D-04 blind sheet's own header), and the D-16 git-order proof (the seal precedes every one of the four committed blind sheets; every sheet precedes the answer key commit; every sheet would precede the shipped ledger's `built_at` once built, currently `PENDING`).

## Task Commits

Each task was committed atomically:

1. **Task 1: runCheck, the --check branch, and tests/test-356-check.cjs** - `0f3d996ca` (feat)
2. **Task 2: tests/test-356-answer-key.cjs** - `2619fc1af` (test)

**Plan metadata:** (this commit, following SUMMARY.md creation)

## Files Created/Modified

- `scripts/build-command-irreversibility-ledger.cjs` - added `runCheck` and the `--check` CLI branch; exported `runCheck`
- `tests/test-356-check.cjs` - new: 41 checks proving every `--check` staleness/drift signal, keyless and zero-network
- `tests/test-356-answer-key.cjs` - new: 33 checks proving `loadInputs` refusals plus the shipped answer key's integrity and D-16 order

## Decisions Made

See `key-decisions` in the frontmatter for the full reasoning on the D-20/D-21 shape adaptation, the added D-21-provenance cross-check, the dropped policy-precedence leg, and the `readPolicy`-vs-raw-read choice in `runCheck`.

## Deviations from Plan

**1. [Rule 1 pattern -- stale plan wording, not a code bug] Task 2's shipped-leg assertions rewritten against the actual D-20/D-21 answer-key shape**

- **Found during:** Task 2, before writing any test code (per the `read_first` instruction to read the real answer key's header fields).
- **Issue:** PLAN.md's Task 2 action text specifies header/seal/disagreement checks (`blind_sheet_ref`, a top-level `prelabels_sha256`, `blind_vs_claude_disagreement`) that assume the original D-04/D-05 `scripts/irreversibility-answer-key.cjs --merge` output shape. The real `data/jev-labels/command-irreversibility.json` (built by 356-08 under the later D-20/D-21 workflow, per `356-CONTEXT.md` D-20/D-21 and `356-08-SUMMARY.md`) never had these fields; it has a different, D-20/D-21-specific shape (two `label_source` values, no merge metadata).
- **Fix:** Per the objective's own `context_changes` instruction ("The D-16 order proof must use the D-20/D-21 artifacts"), rewrote every shipped-leg assertion against the actual shape: header checks drop `blind_sheet_ref`; the seal check reads the D-04 blind sheet's own header line instead of a top-level field; the D-16 order proof walks git ancestry across all four committed D-20/D-21 sheets directly, named in the objective (`356-BLIND-LABEL-SHEET.md`, `356-BLIND-LABEL-SHEET-REMAINDER.md`, `356-D21-SHEET-A.md`, `356-D21-SHEET-B.md`) rather than trusting a `blind_sheet_ref` string; an added D-21-provenance cross-check (not itemized in the plan) directly verifies every row against the committed sheet A/B labels and `356-NAVIGATOR-RULINGS.json`, closing the gap left by the missing `blind_vs_claude_disagreement` field with a stronger, more direct proof.
- **Files affected:** `tests/test-356-answer-key.cjs` only (documented at length in the file's own header comment).
- **Verification:** all 33 checks pass against the real shipped file; `grep -c "merge-base"` is 1 (>= 1 required); `grep -c "113"` is 0 (no hardcoded row count); `grep -c` for the em-dash byte sequence is 0.

**Total deviations:** 1 (a plan-wording adaptation, not an auto-fixed bug). No scope creep: every added check strengthens the same claim (the answer key traces back to blind labels and navigator decisions committed before it) that the plan's stale wording was trying to prove.

## Issues Encountered

**Mid-run API spend-limit pause.** The session hit an API spend-limit error partway through Task 1, immediately after writing the `runCheck` function body into `scripts/build-command-irreversibility-ledger.cjs` (before wiring the `--check` CLI branch, exporting `runCheck`, or writing the test file). On resume, `git diff` confirmed the uncommitted partial edit was intact and syntactically consistent with the plan; the CLI branch, export, and `tests/test-356-check.cjs` were completed and verified from that point, with no rework needed on the already-written `runCheck` body.

## User Setup Required

None - no external service configuration required. Both new test files make zero network calls, verified in-process (`NET_ATTEMPTS === 0`) and across every spawned child (no `NETWORK_ATTEMPT_356` in stderr).

## Verification

- `node tests/test-356-check.cjs` -> PASS (41/41 checks)
- `node tests/test-356-answer-key.cjs` -> PASS (33/33 checks)
- `node tests/test-356-ledger-build.cjs` -> PASS (73/73 checks, unaffected regression check)
- `env -u TYPESAFE_API_KEY HOME=$(mktemp -d) node scripts/build-command-irreversibility-ledger.cjs --check --ledger /nonexistent/356.json; echo $?` -> prints `WARN: LEDGER_MISSING /nonexistent/356.json` then `0`
- `grep -c "plugin_version" scripts/build-command-irreversibility-ledger.cjs` -> 0
- `grep -c "build-command-irreversibility-ledger" scripts/release.sh` -> 0
- `grep -c "merge-base" tests/test-356-answer-key.cjs` -> 1
- `grep -c "113" tests/test-356-answer-key.cjs` -> 0
- `grep -c` (em-dash, U+2014) across both new test files -> 0 for both
- `bash tests/run-all-356.sh` -> `PASSED=25 FAILED=0 SKIPPED=0` (both new legs, `test-356-check` and `test-356-answer-key`, run and PASSED; no other suite regressed)

## Next Phase Readiness

- `scripts/build-command-irreversibility-ledger.cjs` now exports every 356 CLI mode: live, `--jev-fixture`, `--from-raw`, `--raw-out`, and `--check`. Nothing in this phase remains to be added to the builder itself.
- `tests/run-all-356.sh` is fully green with zero skips for the first time in this phase (every planned 356 test file now exists and passes).
- The D-16 order proof and the D-21-provenance cross-check both degrade gracefully (`PENDING` / `ENV GAP`, never a hard failure) once the real ledger or `356-RAW-SCORES.json` lands, so a later live build needs no test edit to activate the remaining `PENDING` legs in both new suites.
- Per this plan's explicit instruction, `STATE.md` and `ROADMAP.md` were NOT updated by this execution.

## Self-Check: PASSED

- FOUND: scripts/build-command-irreversibility-ledger.cjs (runCheck exported, `--check` wired into `main`)
- FOUND: tests/test-356-check.cjs
- FOUND: tests/test-356-answer-key.cjs
- FOUND commit: 0f3d996ca (Task 1)
- FOUND commit: 2619fc1af (Task 2)

---
*Phase: 356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-*
*Completed: 2026-09-23*
