---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 05
subsystem: seed-record-and-handoff
tags: [seed-record, from-brief, resolveFromBrief, sha8, receipt, option-router-bypass]
requires: [389-01]
provides:
  - lib/core/pyramid-seed-record.cjs (SCHEMA, SHA8_RE, validateRecord, idFor, writeRecord, readRecord, listRecords, resolveFromBrief, renderReceipt)
  - tests/test-389-seed-record.cjs (100 asserts)
  - ignite and new-project commands and skills name resolveFromBrief, not resolveOption2
affects: [389-06, 389-08, 389-12]
key-files:
  created:
    - lib/core/pyramid-seed-record.cjs
    - tests/test-389-seed-record.cjs
  modified:
    - commands/ignite.md
    - commands/new-project.md
    - skills/ignite/SKILL.md
    - skills/new-project/SKILL.md
decisions:
  - dist copies not regenerated (spawn instruction: dist stale since beta.52 by design); the four dist paths in the plan file list stay untouched
  - resolveFromBrief(null) uses the newest Seed record; with none it reads ~/.mindrian/mva/state.json (read-only) so an old brief still resolves, like resolveOption2(null)
  - STATE.md, ROADMAP.md, REQUIREMENTS.md not touched (main session updates them)
metrics:
  tasks: 2
  files: 6
completed: 2026-11-08
---

# Phase 389 Plan 05: Seed record and --from-brief hand-off Summary

One line: a Seed record module (validate, write 0600 atomic, read with legacy read-only fallback, list, resolveFromBrief with the same action names and fields as resolveOption2, deterministic receipt) now backs `--from-brief` in /mos:ignite and /mos:new-project, so plan 08 can retire lib/core/mva-option-router.cjs without breaking either command.

## Commits

- 09b721ce8 feat(389-05): Seed record and --from-brief hand-off without the option router (6 files: the module, its test, two commands, two skills)
- The SUMMARY commit follows (docs(389-05)).

## Contract

- Record: schema "mos.pyramid-seed/1", id 8 lowercase hex, created_at ISO, depth seed or full, situation/complication/question/answer (400), support 2 to 5 groups of 1 to 4 claims (120 and 200), objection (300), evidence array of { cell, status ok|empty|error|timeout, summary_line (160) }, optional upgraded_from.
- validateRecord returns { ok:false, code, field } and never throws. Codes: not_object, bad_schema, bad_id, bad_created_at, bad_depth, missing_field, too_long, bad_support, bad_support_count, bad_group, bad_claims_count, bad_claim, bad_evidence, bad_evidence_item, bad_status, bad_upgraded_from.
- Store: `<home>/.mindrian/pyramid-seed/briefs/<id>.json`, mode 0600, temp name in the same folder then rename. Home comes from opts.home or process.env.HOME at call time.
- readRecord checks SHA8_RE (T-155-04-01 kept) before any path join. Seed folder first, then `<home>/.mindrian/mva/briefs/<id>.json` read-only with source "legacy". Reasons: invalid_id, not_found, parse_error.
- resolveFromBrief returns action ignite_from_brief | no_brief_available | brief_parse_error with sha8, brief_content (record plus `receipt` text), canon_verb 8, invoke_command, brief_reward_pending false. No-brief message names /mos:structure-argument. Invalid id adds error invalid_sha8.
- renderReceipt: title line, "Answer:" line, support groups in order with claims, strongest objection, then an evidence section only when an entry has status ok; each line reads "<cell>: outside evidence, quoted: "<summary_line>"". At most 10 evidence lines, whitespace collapsed to one line per field, en and em dashes replaced by a hyphen, 60 lines or fewer.
- Text change: "resolveOption2(sha8) from lib/core/mva-option-router.cjs" became "resolveFromBrief(sha8) from lib/core/pyramid-seed-record.cjs"; "Phase 118 brief side-file" became "Seed record (or an older brief side file)". 8 lines in 4 files. teaching and help_jtbd untouched (Test 11 compares them with HEAD).

## RED output (kept)

Task 1. The module was drafted before the test, so it was moved out of the tree to show a true RED, then restored:

```
FAIL Test 0: lib/core/pyramid-seed-record.cjs exists
test-389-seed-record: 0 passed, 1 failed (module missing)
exit=1
```

After the module was restored (before the text edit), Tests 1 to 9 passed and the docs tests were still RED. First restored run also showed one real failure, Test 9b (a literal dash character had been written into the module and the test; fixed by writing the character as a \u escape):

```
FAIL Test 9b: the module file holds no em dash or en dash
...
test-389-seed-record: 90 passed, 10 failed
```

Task 2, before the text edit:

```
FAIL Test 10: commands/ignite.md has no resolveOption2 and no mva-option-router
FAIL Test 10: commands/ignite.md names resolveFromBrief and lib/core/pyramid-seed-record.cjs
FAIL Test 10: commands/new-project.md ... (2 lines)
FAIL Test 10: skills/ignite/SKILL.md ... (2 lines)
FAIL Test 10: skills/new-project/SKILL.md ... (2 lines)
FAIL Test 12: the old side file is still named as a fallback in the text
test-389-seed-record: 91 passed, 9 failed
exit=1
```

## GREEN output

```
test-389-seed-record: 100 passed, 0 failed       (exit 0)
tests/test-mva-from-brief.cjs                    21/21 PASS
lib/core/mva-option-router.test.cjs              exit 0 (router untouched)
bash tests/run-all-389.sh                        Phase 389: PASS=5 FAIL=0 SKIPPED=0
```

Test 6 (parity with resolveOption2 on a legacy-format file: same action, sha8, canon_verb, invoke_command, same keys; same for parse error and missing id) ran and passed because the router still exists.

## Gates

| Gate | Result |
|------|--------|
| build-skill-mirrors then --check | OK (112 mirrors match; created 0, overwritten 0) |
| build-connector-registry --check | OK |
| build-orchestration-projection --check | OK |
| check-render-coverage | 0 gap, 0 unwired |
| build-command-irreversibility-ledger --check | exit 0, WARN 20, same count and kinds as 389-BASELINE (14 STALE, 2 REMOVED, 2 UNSCORED, ANSWER_KEY_DRIFT, LABEL_SET_MISMATCH); ignite and new-project not named |
| build-dist-bundles --check-stale | exit 1, STALE since beta.52. PRE-EXISTING and by design. NOT regenerated, NOT passed |
| dash sweep (module, test) | no em or en dash; both files pure ASCII |
| guard commit-files 09b721ce8 | all paths allowed |
| guard check 389-05 | exit 1, but every offender is a peer file (lib/core/pyramid-seed-cells.cjs, scripts/pyramid-seed-run.cjs, tests/fixtures/389/sprouts.json, tests/test-389-seed-cells.cjs, tests/test-389-seed-egress.cjs). None is a file of this plan. Not claimed as passed |

## Related tests, before and after the edit

Run over every test that names one of the four files (22 tests plus router test plus test-121-01-scaffold.sh). Exit codes before the edit and after the commit are identical:

- Exit 1 before and after (pre-existing, not caused here): tests/test-115-surfaces-grep.sh, tests/test-383-sourced-number.cjs, tests/test-harness-167-verdict.cjs, tests/test-new-surface-generator.cjs.
- All others exit 0 before and after.
- Transient: tests/test-364-entry-points.cjs and tests/test-b1-reconcile-canonical.cjs failed while the edit was uncommitted, because they assert `git diff --quiet HEAD -- commands/ignite.md`. They passed again after the commit (HEAD now holds the new text). A reader who runs them on a dirty tree will see the same transient failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literal dash characters in written files**
- **Found during:** Task 1 (Test 9b)
- **Issue:** the Write step turned – and — escapes into literal characters in the module (DASH_RE) and the test (one fixture string).
- **Fix:** replaced them with escapes by a script, re-grepped both files for non-ASCII bytes (0 found).
- **Commit:** 09b721ce8

### Plan deltas

- The module was written before the test file (order inverted); RED was shown by moving the module out of the tree. This is a weaker RED than test-first.
- dist files (4 paths of the plan file list) were not regenerated or edited, by spawn instruction. Plan "done" line "dist is clean" is therefore NOT met: --check-stale still fails as before.
- guard check 389-05 reports peer files as offenders (peers 389-02, 389-03, 389-04 work in the same tree). The commit itself was made with git commit --only on six exact paths.

## Known Stubs

None. The new-project "reward" line still says to render `result.brief_content.venture_summary`; for a Seed record brief_reward_pending is always false, so that line never fires for a Seed. It was left as is (plan says touch no other line).

## Threat Flags

None. The module requires only node:fs, node:path, node:os, node:crypto (Test 9c). Mitigations T-389-05-01 to 05 are covered by Tests 3, 4, 9 and 11.

## UNVERIFIED

- No real /mos:ignite or /mos:new-project run was made; the commands are markdown and only their text was checked.
- Nothing calls writeRecord yet (the writer is plan 06); no real room or real home was used.
- dist copies of the four files were not rebuilt, so installs from dist still name the router until a later regeneration.

## Self-Check: PASSED

- lib/core/pyramid-seed-record.cjs: FOUND
- tests/test-389-seed-record.cjs: FOUND
- commit 09b721ce8: FOUND (HEAD~0 at commit time, 6 files, no deletions)
