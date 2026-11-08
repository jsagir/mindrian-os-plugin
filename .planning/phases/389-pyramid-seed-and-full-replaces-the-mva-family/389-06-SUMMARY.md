---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 06
subsystem: structure-argument-seed-and-full
tags: [seed, full, evidence-card, hitl-stages, decide-gate, d11-approve, part8, part11]
requires: [389-02, 389-03, 389-04, 389-05]
provides:
  - scripts/pyramid-seed-run.cjs commands save, show, upgrade (next to card and run)
  - Seed block (seed:start to seed:end) in /mos:structure-argument and its skill mirror, byte equal
  - hitl_stages (Form B) for /mos:structure-argument
  - Seed receipt template and 12 Seed challenge prompts in the methodology reference
  - tests/test-389-seed-cli.cjs (35 checks), tests/test-389-seed-structure.cjs (87 checks)
affects: [389-08, 389-10, 389-12, 389-13]
key-files:
  created:
    - tests/test-389-seed-cli.cjs
    - tests/test-389-seed-structure.cjs
  modified:
    - scripts/pyramid-seed-run.cjs
    - commands/structure-argument.md
    - skills/structure-argument/SKILL.md (generated mirror)
    - references/methodology/structure-argument.md
    - data/hitl-shape-backfill.json
    - data/render-coverage-registry.json (generated)
decisions:
  - D11 APPROVE (owner, 2026-11-08): autonomous_safe stays true behind the card and the code refusal.
  - hitl_shape removed from the command, because the contract says a surface carries Form A or Form B, one of two.
  - The sentence is read from a short-lived scratch file by card and save (to check a rule) and the text tells Larry to delete it; it is never stored, printed or sent.
  - save fills id, created_at, schema and depth when they are absent, because the host model cannot compute a hash or a clock. A value that is present is kept and checked.
metrics:
  tasks: 3
  files: 8
completed: 2026-11-08
---

# Phase 389 Plan 06: Seed and Full in /mos:structure-argument Summary

One line: the Seed is now the third value of the fork of /mos:structure-argument (card F.0 before any lookup, 3-way Decide F.1, hitl_stages in Form B), the Full depth starts from the Seed record and runs the Phase 363 engine through `upgrade`, and the script gained `save`, `show` and `upgrade`. No new command, no new connector row, sub_mode unchanged.

## Owner gate (Task 1)

```
$ node 389-decision.cjs gate 389-DECISION.md D11
D11 APPROVE APPROVED
GATE PASS            (exit 0)
$ ... gate ... D10
D10 APPROVE APPROVED
GATE PASS            (exit 0)
```

Token for this plan: D11 APPROVE. So autonomous_safe stays true in the command and the skill, and the registries are unchanged by this field. D10 APPROVE (share opt-in, default off) is not consumed by this plan.

## Commits

- f7e7a18d0 feat(389-06): save, show and upgrade commands for the Seed script (scripts/pyramid-seed-run.cjs, tests/test-389-seed-cli.cjs)
- d5f638f7a feat(389-06): Seed and Full depth in /mos:structure-argument with evidence card, Decide gate and hitl_stages (7 files)
- b2b0f8f41 chore(389-06): regenerate render coverage registry after structure-argument moved to hitl_stages (1 file)
- The SUMMARY commit follows (docs(389-06)).

## RED output (kept)

Task 1, `node tests/test-389-seed-cli.cjs` before the three commands existed (script printed only its usage line):

```
FAIL Test 1.1: save exits 0 :: code 1 err usage: pyramid-seed-run.cjs card --sprouts FILE ...
FAIL Test 1.2 to 1.6 (save output, path, receipt, files, sentence not stored)
FAIL Test 1.7: invalid record exits 2 with an error code :: code 1
FAIL Test 1.9: wrong id exits 2 and writes nothing :: code 1
FAIL Test 2.1 to 2.5 (show --id, receipt, --latest, missing id exit 4)
FAIL Test 3.1: upgrade exits 0 ; 3.2, 3.3, 3.4, 3.6, 3.8, 3.9
FAIL Test 4.4: the usage line lists card, run, save, show and upgrade
FAIL Test 5.5: the script requires the record and upgrade modules
test-389-seed-cli: 12 passed, 22 failed
```

The 12 passes in RED are negative checks that hold when nothing runs (card and run from plan 03, static scans). Test 1.10 (save fills absent fields) was added after the GREEN run, with the code change that it covers, so it has no separate RED.

Task 2, `node tests/test-389-seed-structure.cjs` before the edit:

```
FAIL Test 1.1 / 1.2 / 1.3 (no seed block in the command, the skill; not equal)
FAIL Test 2: names the quick pass ... (all 28 block-content checks)
FAIL Test 3.3 / 3.4 (the fork question does not mention seed)
FAIL Test 5.1 to 5.5 (no hitl_stages) in both files
FAIL Test 7.1 to 7.7 (no Seed line, no Seed receipt, no Seed challenge prompts)
test-389-seed-structure: 24 passed, 63 failed
```

The 24 RED passes were the checks that must stay true (Setup reads room/STATE.md, filing question, one registry row per surface, teaching and help_jtbd pins, autonomous_safe true, dash scan).

## GREEN output

```
test-389-seed-cli: 35 passed, 0 failed
test-389-seed-structure: 87 passed, 0 failed
test-389-seed-egress: 55 passed, 0 failed      (plan 03, unchanged)
test-389-seed-cells: 53 passed, 0 failed       (plan 03, unchanged)
test-389-seed-record: 100 passed, 0 failed     (plan 05, unchanged)
test-389-full-pyramid: passed 15 failed 0      (plan 04, unchanged)
bash tests/run-all-389.sh: Phase 389: PASS=8 FAIL=0 SKIPPED=0
```

One structure check failed once in the first GREEN try (Test 2, "the filing gate stays for Full"); the Full sentence was reworded in the command, the mirror rebuilt, and the test passed.

## What was built

- Script: `save --record FILE --sentence-file FILE` validates the record (validateRecord), checks that the id is the id of the sentence (idFor), writes under `<home>/.mindrian/pyramid-seed/briefs` (writeRecord) and prints `{ ok, id, path, receipt }`; `show --id ID | --latest` prints resolveFromBrief plus the receipt, exit 4 when no record; `upgrade --record ID [--room DIR]` prints `{ ok, status, additions, mece_warnings, restatement_warnings, uncovered, room_evidence, report }` with report = renderUpgrade(result), exit 4 for a missing record, read-only for the room. Exit codes: 0 ok, 1 usage, 2 invalid input, 3 card_required, 4 no record. card and run are byte-identical in behavior.
- Command: fork line "Quick pass, deep dive, or seed?" with one clause per value; Setup step 4 (script path, the only place the plugin-root token appears for the Seed); the Seed block with the eight steps (capture, frame, draft pyramid, offer, evidence card, argue, receipt, decide), Full, and the Desktop and Cowork sentence; a Full paragraph in "When Complete" (start from the latest record, run upgrade, then file as before). Setup step 3 and the filing question are unchanged.
- Block placement: the Seed block holds no `${CLAUDE_PLUGIN_ROOT}` token (the mirror generator rewrites that token), so the command block and the skill block are byte equal.
- hitl_stages: pyramid build (F.9, ordered), seed evidence card (F.0, gate), decide (F.1, gate), one hitl_why; hitl_shape removed (contract: Form A or Form B).
- Methodology reference: Seed line in "Quick Pass vs Deep Dive", "Seed receipt" template in the section order of renderReceipt, "Seed challenge prompts" (12 questions with red-hat and black-hat lines copied as plain text from QUESTION_REGISTRY; the old cell file was not edited).
- data/hitl-shape-backfill.json: the structure-argument entry now holds the same Form B declaration, so a future backfill run does not put hitl_shape back.

## Answer (h) of 389-CALLERS.md, as applied

PROVEN per command row only: the resolver and the chain gate read `autonomous_safe` of the row and never read `sub_mode`. A Seed branch inside /mos:structure-argument inherits `autonomous_safe: true` (D11 APPROVE keeps it). So the Seed block says the Seed is never taken inside a chain run and the card is required; the script refuses `run` without the card hash (plan 03) and prints `card_required`. `chain_run` needs a bound room (`no_bound_room` refusal), and the Seed applies only when no room is bound, so a no-room Seed cannot run through `chain_run` at all. The CLI chain path (scripts/act-command.cjs, pipeline-command.cjs) was not traced (UNVERIFIED, as in plan 01). Test 6 pins the frontmatter value and the chain gate result through makeGateFn (D11 APPROVE: run; the FLAG-FALSE branch of the test, halt, was written but is not active).

## Generator and gate runs

| Run | Result |
|-----|--------|
| build-skill-mirrors (twice, after each command edit), then --check | 1 overwritten (structure-argument), 112 mirrors match |
| build-render-coverage.cjs | changed: the two structure-argument entries (command and skill, declared_shape F.9) were removed and two counts dropped by 1. Cause: that registry lists Form A surfaces only. Committed in b2b0f8f41. After it, build-render-coverage --check and check-render-coverage --check exit 0 |
| build-connector-registry --check | exit 0, no regeneration needed |
| build-orchestration-projection --check | exit 0, no regeneration needed |
| build-command-registry --check | exit 0, no regeneration needed |
| build-harness-manifest --check | exit 0 |
| check-shape-declaration --check | exit 0, 51 violations, same count as baseline, none names structure-argument |
| check-registry-drift --check | exit 0, 0 findings |
| build-command-irreversibility-ledger --check | exit 0, WARN 20 (14 STALE, 2 REMOVED, 2 UNSCORED, ANSWER_KEY_DRIFT, LABEL_SET_MISMATCH), same as baseline; structure-argument not named; teaching and help_jtbd byte equal to HEAD (Test 4.8); no Jev call made |
| build-mos-face --check, face-commands --check | exit 0 (3 drift warnings as baseline) |
| build-dist-bundles --check-stale | exit 1, STALE since beta.52 (PRE-EXISTING, by design; dist NOT regenerated) |
| tests/test-209-declared-implies-wired.cjs | exit 1 (PRE-EXISTING list diff, no structure-argument in the output) |
| hook census (qef, juq, 369 graph) | exit 0; tier-d-hooks and 346-catalogue exit 1 (PRE-EXISTING, as baseline) |
| ui/mindrian-workspace-mod sync-assets --check, test-369.26-registry-sync | exit 1 (PRE-EXISTING, mod assets behind) |
| backfill-hitl-shape --check | exit 1, 121 surfaces (PRE-EXISTING; baseline red) |
| run-all-267 | PASS=32 FAIL=1 SKIP=1 (baseline PASS=26 FAIL=7); the one FAIL is the connector-descriptor count (35 expected, 62 found), not touched by this plan |
| run-all-190 | passes (check-shape-declaration.test 27/27) |
| test-364-entry-points, test-b1-reconcile-canonical, test-363-*, test-366-templates, statusline, hypothesis-family | pass |

Files in the plan list that no generator changed and that are not committed: data/command-registry.json, data/connector-coverage-ledger.json, data/orchestration-command-ledger.json, data/brain-orchestration-projection.json, ui/mindrian-workspace-mod/assets/command-registry.json, lib/mos-face/dist/commands.js, ui/mos-face/hooks/commands.ts, and the two dist SKILL.md copies (dist not regenerated by order).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mirror token breaks "byte equal blocks"**
- **Issue:** build-skill-mirrors rewrites `${CLAUDE_PLUGIN_ROOT}` in the skill body, so a Seed block that used the token would differ between the command and the skill.
- **Fix:** the token appears only in Setup step 4 (outside the block); the block says `<plugin root>/scripts/pyramid-seed-run.cjs` and points to Setup step 4.

**2. [Rule 1 - Bug] The generated render coverage registry went stale**
- **Issue:** moving to hitl_stages removed the two Form A rows; `check-render-coverage.cjs --check` and test-b1-reconcile-canonical failed after the command commit.
- **Fix:** ran build-render-coverage.cjs, committed (b2b0f8f41). Both pass.

**3. [Rule 2 - Missing critical functionality] save fills id, created_at, schema, depth**
- **Issue:** the plan wrote that save requires `record.id` equal to `idFor(sentence)`. The host model cannot compute a SHA-256 or the time, so a record could never pass.
- **Fix:** save fills absent fields and keeps and checks present ones; Test 1.9 (wrong id) and Test 1.10 (absent fields) pin both.

**4. [Plan wording] "The sentence is never written to a file"**
- **Issue:** card and save need the sentence as a file argument (plan 03 design). 
- **Fix:** the block says the sentence is never saved to a room file, never in the record, never sent to the Brain, never in a search; card and save read it once from a short-lived scratch file outside any room, deleted right after. Test 2 pins the first part.

### Commit shape

The plan names one commit; this run made three (script, text, generated registry) so each is atomic. All used `git commit --only` with exact paths.

## Known Stubs

None.

## Threat Flags

None beyond the plan threat model. T-389-06-01 to 06 are covered by Test 2 and Test 6 (text rules) and the plan 03 egress tests; T-389-06-04 by Test 4 (one row per surface, no pyramid-seed sub_mode); T-389-06-05 by Test 4.8 and the ledger check (WARN 20 unchanged).

## UNVERIFIED

- No live Seed run with a real model. The text is the control for the card; the script is the backstop. Both were tested separately.
- The Desktop and Cowork path is text only (no shell there); the guarded Brain tools were not called.
- The CLI chain path (act-command.cjs, pipeline-command.cjs) was not traced for the sub-mode posture.
- Scope guard `check 389-06` exits 1 because of peer files (tests/test-341-eureka-no-brain-reach and tests/test-387-eureka-egress, Phase 374 work); none is a file of this plan. Not claimed as passed.
- dist copies of the command and skill were not regenerated, so dist installs still show the old text until a later regeneration.
- tests/test-check-render-coverage.cjs and tests/test-render-coverage-gate-hardfail.cjs exit 1 on an old assertion that the live tree must have gaps; they failed at baseline for the same reason (the live tree is clean). Not caused by this plan.

## Self-Check: PASSED

- tests/test-389-seed-cli.cjs, tests/test-389-seed-structure.cjs: present.
- Commits f7e7a18d0, d5f638f7a, b2b0f8f41: present; no file deleted.
- No em dash or en dash and no non-ASCII byte in any changed file. No push, tag, version bump, release script or dist build.
