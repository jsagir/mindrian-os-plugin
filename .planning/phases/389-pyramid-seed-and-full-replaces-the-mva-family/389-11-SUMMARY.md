---
phase: 389-pyramid-seed-and-full-replaces-the-mva-family
plan: 11
subsystem: mva-retirement
tags: [rename, session-report, soft-alias, d7-approve, d8-approve]
requires: [389-02, 389-09, 389-10]
provides:
  - /mos:session-report and skills/session-report (git mv, body equal to the old body with the name replaced)
  - /mos:mva-report as a soft-alias stub for one release (forwards to /mos:session-report through scripts/soft-alias-runner.cjs)
  - tests/test-389-session-report.cjs (45 checks, mutation arm)
affects: [389-13, 389-14]
key-files:
  created:
    - tests/test-389-session-report.cjs
    - commands/mva-report.md (new stub; the old file moved to session-report)
    - skills/mva-report/SKILL.md (new stub, generated mirror)
  renamed:
    - commands/mva-report.md -> commands/session-report.md
    - skills/mva-report/SKILL.md -> skills/session-report/SKILL.md
decisions:
  - D7 APPROVE and D8 APPROVE (owner, 2026-11-08), read from the gate.
  - No deprecation entry now (D8 APPROVE: the command is still in the registry). The entry for /mos:mva-report is owed when the stub is removed (v2.0.0-beta.84).
  - Telemetry names untouched (no mva_report event exists).
metrics:
  tasks: 2
completed: 2026-11-08
---

# Phase 389 Plan 11: Rename /mos:mva-report to /mos:session-report (owner D7, D8)

One line: the conversation receipt command is now /mos:session-report with a byte-equal body (name replaced, nothing else), and /mos:mva-report stays one release as a soft-alias stub that forwards to it.

## Owner gate (Task 1)

```
$ node 389-decision.cjs gate 389-DECISION.md D7 D8
D7 APPROVE APPROVED
D8 APPROVE APPROVED
GATE PASS            (exit 0)
```

HEAD at start: e44e97b37. Scope guard snapshot 389-11 taken before any edit. `git diff --quiet HEAD` was clean for every tracked path edited. The working tree held no peer edit at start.

## Reference list (git grep -n "mva-report", tree minus .planning and r-and-d)

| file | kind | handled |
|------|------|---------|
| commands/mva-report.md, skills/mva-report/SKILL.md | the command and skill | moved to session-report (git mv, name replaced); new stubs written at the old paths |
| scripts/migrate-skill-frontmatter.cjs:79 | living (list of skills that declare disable-model-invocation) | entry renamed to session-report (the stub does not declare it) |
| tests/test-192-menu-sweep-live-selectors.cjs:74 | living (comment list) | name replaced |
| ui/mos-face/scripts/face-commands.cjs:99-100 | living (hand override map, the source) | key and sentence renamed to /mos:session-report |
| ui/mos-face/hooks/commands.ts, lib/mos-face/dist/commands.js | generated copies | WHY rows for the two names only (see Deviation 2) |
| data/command-registry.json, ui/mindrian-workspace-mod/assets/command-registry.json | generated, derived copy | session-report row added, stub teaching row changed (copy: see Deviation 3) |
| data/connector-coverage-ledger.json, data/brain-orchestration-projection.json, data/orchestration-command-ledger.json, data/render-coverage-registry.json, data/harness-manifest.json | generated | rows for the two names only |
| data/help-groups.json | hand | group entry renamed; mva-report added to deprecated_aliases (same as heal, mva-brief) |
| data/layer-backfill.json, data/hitl-shape-backfill.json | hand maps | key for session-report added (old values); stub key holds the stub values |
| data/section-command-relevance.json | hand | entry renamed to session-report |
| tests/fixtures/341-registry-drift-baseline.json | history snapshot | left (the command is still registered) |
| data/command-irreversibility-ledger.json | add-only ledger | not edited |
| data/jev-labels/command-irreversibility.json | Jev label output | not edited (no generator; the new name is unscored) |
| dist/generic-claude-dir, dist/zed (4 hits) | stale bundles, beta.52 | not regenerated (see Deviation 4) |
| CHANGELOG.md | history | not edited |
| docs, lab | none found | docs/testers/weekly-cohort/2026-07-01-standup.md named in the Notes is a dated history file; it holds no match for the old command name |

No docs or lab file names the command as something to run (git grep over docs and lab: zero hits).

## RED and GREEN

RED (stubs not yet written, files not yet moved; `node tests/test-389-session-report.cjs`, exit 1): 10 passed, 25 failed. Failures: Test 1 (new files missing), Test 3 (stub missing), Test 4 (registries, help groups, backfill maps, workspace copy), Test 5 (old name still in 5 places, mos-face files unrenamed).

GREEN (after): `test-389-session-report: 45 passed, 0 failed`, exit 0. The body parity compares the new files with the HEAD blobs (600a7e6, db2594d) with the name replaced; the whole files equal, so no word changed besides the name. The cited first-delivery line stays :34 and still points at the "Read back over THIS conversation" line.

## BEFORE and AFTER (scratch HOME, Brain URL pointed at a closed port, no keys)

| leg | before | after |
|-----|--------|-------|
| run-all-118 | exit 1, 9 suites, 8 pass, 1 fail (mva-deck-builder.test, pre-existing) | same |
| run-all-267.2 | PASS=19 FAIL=0 SKIP=1 | same |
| run-all-267.3 | PASS=5 FAIL=0 | same |
| run-all-267 | PASS=31 FAIL=2 SKIP=1 | same |
| run-all-389 | PASS=13 | PASS=14 (the new test) |
| run-all-380 (mos-face) | PASSED=17 FAILED=2 SKIPPED=1 | same |
| run-all-3696 | PASSED=124 FAILED=6 SKIPPED=2 KNOWN=19 (first read, taken while edits began; see Note) | PASSED=123 FAILED=6 SKIPPED=2 KNOWN=20 (same 6 failing legs; no leg is worse than a clean HEAD export, see Note) |
| build-command-registry, skill mirrors, connector registry, projection, render coverage, shape declaration, harness manifest, help coverage, registry drift | 0 | 0 (mirrors 111 to 112; render md-keyspace 193 to 195 wired, 0 unwired) |
| face-commands --check | 0, 111 WHY, 3 drift warnings | 0, 112 WHY, same 3 drift warnings |
| build-mos-face --check | 0 | 0 |
| test-192 menu sweep, soft-alias.test | 0, 0 (41 passed) | 0, 0 (41 passed) |
| irreversibility ledger | WARN 22 | WARN 24 (STALE /mos:mva-report, UNSCORED /mos:session-report; the ledger was not edited) |
| baseline-red legs: dist stale, sync-assets, backfill-layer, backfill-hitl-shape, section ledger, test-209 | 1 each | 1 each (same reason) |

Part 11 generators (build-skill-mirrors, build-connector-registry, build-orchestration-projection, check-render-coverage) all exit 0.

check-shape-declaration stays exit 0; its advisory list gains two WARN lines for the stub (hitl_shape F.0 with connector.excluded true), the same two lines the heal and mva-brief stubs already print.

## Deviations from Plan

1. [Rule 3 - Scope] The generated companions data/render-coverage-registry.json, data/harness-manifest.json and lib/mos-face/dist/manifest.json changed (the stub F.0 shape adds two rows; counts and digests move). They are not in the plan file list; they are the output of the plan generators and are committed with them.
2. [Rule 1 - Scope] ui/mos-face/scripts/face-commands.cjs --write also rewrote three unrelated WHY rows (doctor, rs-experts, new eureka-portfolio) that were already drifting at baseline. I reverted that output and applied only the two rows of this plan (the stub row "Deprecated alias" and the new session-report row) in the exact text the generator produced; the file header says "do not edit by hand", so this is a hand application of generator output. The three baseline drift warnings remain, as before. lib/mos-face/dist was then built by scripts/build-mos-face.cjs.
3. [Rule 3 - Scope] ui/mindrian-workspace-mod/assets/command-registry.json: sync-assets would have copied the whole data file (and framework-names.json) and brought the baseline drift with it. I applied only this plan's hunks with git apply, so the sync-assets check stays red for the baseline reason only.
4. dist/generic-claude-dir and dist/zed (4 paths in the plan list) are not regenerated or moved: the bundles are stale since beta.52 by design and the standing instruction is to never regenerate dist/ here. The check-stale leg stays 1 as before. Carry-over.
5. tests/fixtures/341-registry-drift-baseline.json is unchanged. It snapshots the previous release; the new name was not in it, and the stub is still registered. (The plan said to add the new name; I left it to keep the snapshot true. The real baseline is the git tag.)
6. data/jev-labels/command-irreversibility.json is unchanged: it is Jev scoring output, no generator, and scoring needs the external service.
7. The stub frontmatter uses interactive_first_reward "--none (diagnostic surface)" (the value the reward linter accepts for stubs, learned in plan 09).

Note on run-all-3696: the first BEFORE read (124/6/2/19) was taken while this plan's first edits began, so it is a weak baseline, and its per-leg list was lost. I then ran the same runner on a `git archive HEAD` export in the scratch directory (HEAD before this plan; ignored and untracked files are missing there, so it shows more red: PASSED=113 FAILED=17 KNOWN=20). Leg-by-leg diff of that export against the tree after this plan: ten legs go from FAILED to PASSED or SKIPPED (export artifacts), no leg goes from PASSED to a worse state, and the FAILED legs of the runner after this plan (isolation, voice-first budget, test-115 surfaces grep, test-260917 rooms home, test-298 contract parity, test-359 prose budget, plus the aggregator self-test fake) are red in the export too. The one-count move PASSED 124 to 123 and KNOWN 19 to 20 is not explained by a changed leg; the two KNOWN render tests (test-check-render-coverage, test-render-registry-build) fail on a 15 versus 17 entry count that predates this plan.

## Ledger status

STALE /mos:mva-report (teaching text changed on purpose, stub) and UNSCORED /mos:session-report. Needs a Jev rescore, owed by plan 14. No edit to data/command-irreversibility-ledger.json and no paid call.

## Carry-over list (plan 14 and the release that removes the stub)

1. Write the data/command-deprecations.json entry for /mos:mva-report (replaced_by /mos:session-report, decided_by navigator, date 2026-11-08, retired_in 2.0.0-beta.84) when the stub is removed, and drop /mos:mva-report from the drift baseline and the help-groups alias map then.
2. Jev rescore for both names (ledger WARN 24).
3. Dist copies of skills/mva-report stay old and dist has no session-report until the next dist regeneration.
4. scripts/soft-alias-runner.cjs prints "Scheduled removal: v1.14.0" in the note for any stub (its default); the stub file text says v2.0.0-beta.84. The runner is shared and was not changed.
5. Theo and the Desktop copy list the old name until the next release cut.
6. The three face-commands WHY drift rows (doctor, rs-experts, eureka-portfolio) remain for the owner of those commands.

## UNVERIFIED

- The soft-alias-runner call inside a live Claude session (only the runner output was checked).
- Ledger scoring for the new name (needs the external Jev service).
- Theo-side and Desktop-copy state.

## Known Stubs

commands/mva-report.md and skills/mva-report/SKILL.md are intentional soft-alias stubs with a dated removal (v2.0.0-beta.84).

## Threat Flags

None. No new endpoint, auth path or file access pattern.
