---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 04
subsystem: structure-argument-full-depth
tags: [pyramid, research-planner, template, adapter, ledger]
requires: [389-01]
provides:
  - pyramid-argument template (explicit_only, framework The Pyramid Principle, door /mos:structure-argument full)
  - lib/core/pyramid-seed-upgrade.cjs (seedToQuestionSet, upgradeSeed, renderUpgrade)
  - tests/test-389-full-pyramid.cjs (15 legs)
affects: [389-05, 389-06]
key-files:
  created:
    - lib/core/pyramid-seed-upgrade.cjs
    - tests/test-389-full-pyramid.cjs
  modified:
    - lib/core/research-planner/question-templates.cjs
    - lib/core/research-planner/CONTEXT.md
    - tests/test-366-templates.cjs
    - tests/test-363-pyramid.cjs
    - tests/test-363-structure.cjs
    - data/research-shape-ledger.json
decisions:
  - Framework-dimension leaves hang at the root of the tree (no key-line entry), because the key line has exactly one entry per support group.
  - The Seed's situation, complication and objection are statements, not questions. They stay in scqa and the record; the framework asks the three matching questions as additions.
  - Template lenses pa.* are not added to LENS_FAMILY (families.cjs is outside the plan file list; the Full depth builds the pyramid and never composes research queries).
metrics:
  tasks: 2
  files: 8
completed: 2026-11-08
---

# Phase 389 Plan 04: Full depth on the Phase 363 pyramid engine Summary

One line: one explicit_only template (pyramid-argument) plus one adapter turn a Seed record into a checked pyramid through the existing buildPyramid and checkPyramid, list the questions the Seed did not ask, and name the room notes that already speak to each support group. No second pyramid builder, MECE checker or coverage check was written.

## Commits

- 5f4ed8ded feat(389-04): Full depth on the Phase 363 pyramid engine, pyramid-argument template and seed upgrade adapter (8 files)
- A docs commit with this SUMMARY follows.

## What was built

- Template pyramid-argument in question-templates.cjs, last key of TEMPLATES. Dimensions: pa:situation (tension), pa:complication (tension), pa:support (paths), pa:objection (limiters), all researchable on concept-evidence/v1 with falsifier ce.counter; pa:answer is closed (reason: the answer is a judgment the person owns). explicit_only true, so templateForCommand('/mos:structure-argument') is null.
- Adapter. Claims become leaves (origin user_stated, dimension pa:support, parent = its key-line entry k1..k5). The three non-support researchable dimensions become leaves q:situation, q:complication, q:objection (origin framework_dimension): these are the additions. A bad record gives ok false with a typed reason and no throw (seedToQuestionSet throws an Error with .reason; upgradeSeed catches it).
- Result of upgradeSeed: ok, upgraded_from, status, pyramid, leaves, check, additions, mece_warnings, restatement_warnings, uncovered, room_evidence (only groups with a hit, via quick.localRoomCheck with the group name and first claim as terms).
- renderUpgrade: states counts of additions and overlap warnings, the checker limit ("cannot prove the groups are separate or that nothing is missing"), uncovered dimensions, room notes. Never says MECE verified.

## RED output (kept)

Before the template and the module existed (`node tests/test-389-full-pyramid.cjs`, exit 1):

```
ok   fixture sentences and records line up
FAIL Test 1 template pyramid-argument is registered, explicit_only, plain command not rerouted :: template missing
FAIL Test 2 dimensions: four researchable on concept-evidence, one closed answer :: Cannot read properties of undefined (reading 'dimensions')
FAIL Test 3.1 seedToQuestionSet(consumer-subscription) ... :: Cannot read properties of null (reading 'seedToQuestionSet')
FAIL Test 3.2 / 3.3 (same reason)
FAIL Test 4.1 to 4.4 upgradeSeed ... :: Cannot read properties of null (reading 'upgradeSeed')
FAIL Test 5a, 5b, 6, 7 (same reason)
FAIL Test 8 exports ... :: Cannot convert undefined or null to object
note: load error :: pyramid-seed-upgrade: Cannot find module '.../lib/core/pyramid-seed-upgrade.cjs'
passed 1 failed 14
```

GREEN: `passed 15 failed 0`.

## BEFORE state (Task 1, step 1)

Run at HEAD fb6266d83 plus peer edits, before my first edit:

| command | exit |
|---------|------|
| node tests/test-366-templates.cjs | 0 |
| node tests/test-363-pyramid.cjs | 0 |
| node tests/test-363-structure.cjs | 0 |
| node tests/test-364-sr-door.cjs | 0 |
| node tests/test-363-command-contract.cjs | 0 |
| node tests/test-3692-lexicon-generic-entries.cjs | 0 |
| node scripts/build-research-shape-ledger.cjs --check | 0 |
| node scripts/build-connector-registry.cjs --check | 0 |
| node scripts/build-orchestration-projection.cjs --check | 0 |
| bash tests/run-all-363.sh | 1 (PASSED=45 FAILED=3 SKIPPED=1 KNOWN=5, see note) |

Note on run-all-363: the BEFORE run started before my first edit but ran for about 10 minutes, so its late legs may have seen the new template. For that reason the failing legs were also checked on their own causes (below).

## AFTER state

All the single checks above exit 0 (also check-render-coverage). run-all-389.sh: PASS=6 FAIL=0 SKIPPED=0 (includes the dash fence and the peer 389 tests that exist now). run-all-363.sh: PASSED=45 FAILED=3 SKIPPED=1 KNOWN=5, the same set as BEFORE:

- 363 runner contract (363-18): FAILED on leg K6 only (scout.md and scheduled-tasks.md text vs git base). Neither file is changed by this plan or in the working tree. Not caused by this plan.
- test-131-e2e.cjs: FAILED on the zero-leak gate (reads of /home/jsagi/.mindrian/persona-override.json). Environment. Not caused by this plan.
- 216 and 220 no-regression: FAILED on the same E2E zero-leak gate (Phase 216). Not caused by this plan.
- run-all-3551 (known red): signature not found (PASS=63 FAIL=5, expected 64/4). Same count in BEFORE and AFTER. A pristine HEAD export gave 62/6, so this leg varies with the tree and is outside this plan.
- no new dependency: FAILED (package.json vs fixture). No package was added by this plan.
- live OpenAlex smoke: SKIPPED (MOS_363_LIVE unset).

## Candidate pin list (git grep of PLANNER_TEMPLATE_IDS, Q.TEMPLATES, DIMENSION_INDEX, question-templates)

Tests: test-363-grants, test-363-pyramid, test-363-structure, test-364-sr-door, test-366-eureka-filing, test-366-offline-recall, test-366-recall-analogies, test-366-recall-hsi, test-366-recall-rs, test-366-recall-whitespace, test-366-templates, test-366-theo-lateral-lane, test-3692-perspectives-web, test-seed103-eureka-perspective, test-seed104-grant-family-loop. Scripts: build-research-shape-ledger.cjs. Lib: grants, job-lines, planner, sr-door, structure, perspectives/*-recall.

Only 3 tests broke and each was fixed by adding the id (no assert removed or weakened):

- tests/test-366-templates.cjs T1: new constant PYRAMID = ['pyramid-argument']; the expected id list is SEVEN.concat(NEW, PYRAMID). NEW is unchanged so T2 to T6 are unchanged.
- tests/test-363-pyramid.cjs Y1: 'pyramid-argument' added to the sorted `want` list.
- tests/test-363-structure.cjs B3: template_frameworks count 11 to 12, plus one new assert that pyramid-argument maps to The Pyramid Principle.
- Leg names that say "eleven" were left as they are (earlier logs cite them).

## Ledger diff

`node scripts/build-research-shape-ledger.cjs` (default, from the committed snapshot, no --live). `git diff --stat`: 1 insertion. The only change is in template_frameworks: `"pyramid-argument": "The Pyramid Principle"`. `--check` prints OK.

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Claim-level restatement warning in the adapter**
- Found during: Task 2.
- Issue: checkPyramid skips user_stated leaves in its restatement check, so a Seed whose claims only repeat the question would pass unseen, and Test 5b (restatement warning or d00_failed) could not hold.
- Fix: claimRestatements() in the adapter flags a claim when at least 2 shared words and at least 60 percent of the claim's content words are words of the question. It is a warning only, it decides nothing, and it lives in the result's restatement_warnings (the engine's check is untouched). The plain issue-tree rule (2 shared words) was too loud: it flagged an ordinary fixture claim.
- Files: lib/core/pyramid-seed-upgrade.cjs.

**2. [Rule 1 - Bug avoided] Prompt wording of two dimensions**
- Issue: with the suggested prompts, issue-tree flagged an overlap between the generic objection question and a normal claim (shared words "what", "does"). That would put noise in every overlap count.
- Fix: pa:complication prompt is "Did a real change turn the situation into a problem?" and pa:objection prompt is "Is the strongest objection answered by the evidence?". Both remain plain questions.

Otherwise the plan ran as written.

## Known limits

- Overlap warnings are the issue-tree word-overlap heuristic (2 shared content words). They can name a framework question against a long claim. The report says the checker cannot prove the groups are separate.
- Lenses pa.* are not in families.cjs LENS_FAMILY. If a future plan composes research queries for this template, it must add them (that is a change to families.cjs and test-366 T2).
- The record validator in the adapter mirrors the shared contract; plan 05 owns the full validator.

## Known Stubs

None.

## Threat Flags

None. The module reads room files with fs only (through localRoomCheck), writes nothing and makes no network or Brain call; Test 7 installs a fetch thrower (0 attempts) and hashes the fixture room before and after.

## Self-Check: PASSED

- lib/core/pyramid-seed-upgrade.cjs, tests/test-389-full-pyramid.cjs: present.
- Commit 5f4ed8ded: present; `git show --name-only` lists only plan paths; guard check and commit-files passed.
- No em dash or en dash in the changed files; no push, tag, version bump or dist build.
