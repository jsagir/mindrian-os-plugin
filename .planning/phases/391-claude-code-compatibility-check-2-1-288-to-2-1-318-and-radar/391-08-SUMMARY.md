---
phase: 391-claude-code-compatibility-check-2-1-288-to-2-1-318-and-radar
plan: 08
subsystem: compatibility
tags: [owner-cards, hooks, doctor, radar, seed]
requires: [391-04, 391-06]
provides:
  - web credential guard hook fails closed (onFailure block) on timeout or start failure
  - radar command pre-approves its one slicer script (narrow Bash entry)
  - doctor ledger organ default lag 20
  - SEED-146 (the /ultrareview Part 8 question, no decision)
affects: [hooks/hooks.json, commands/radar.md, skills/radar/SKILL.md, lib/core/doctor/capability-ledger-module.cjs]
key-files:
  created:
    - .planning/seeds/SEED-146-ultrareview-uploads-the-working-tree-part-8-question.md
  modified:
    - hooks/hooks.json
    - commands/radar.md
    - skills/radar/SKILL.md
    - lib/core/doctor/capability-ledger-module.cjs
    - data/doctor-modules.json
    - tests/test-391-doctor-ledger-gap.cjs
    - tests/test-386-web-credential-hook.cjs
    - tests/test-261029-qef-hook-timeouts.cjs
    - tests/test-391-hooks-contract.cjs
    - tests/test-265-radar-writes-ledger.cjs
    - tests/test-391-radar-command-contract.cjs
decisions:
  - "C2 APPLY, C3 APPLY-NARROW-BASH, C4 FILE-SEED, C6 LAG-20 (owner, 2026-11-08)"
completed: 2026-11-08
---

# Phase 391 Plan 08: Owner cards C2, C3, C4 and C6 Summary

Applied the four owner answers exactly: onFailure block on the web credential guard, one narrow Bash entry for the radar slicer script, the /ultrareview seed, and a doctor default lag of 20. RED tests first for C6, C2 and C3.

## Gate (before any edit)

`node 391-card-check.cjs gate 391-DECISION.md 2 3 4 6` exit 0:

- C2 READY:APPLY
- C3 READY:APPLY-NARROW-BASH
- C4 READY:FILE-SEED
- C6 READY:LAG-20

Drift check: DEFAULT_MAX_VERSION_LAG was 40, the ledger_path seam existed, the web guard group had no onFailure and timeout 5, the radar allowed-tools were the five tools. `git status --short` was empty for every file edited (hooks/hooks.json included).

## Per card

### C6 LAG-20 (doctor default lag)

- RED `e39897e65`: arm D10 (env unset: lag 20 ok, lag 21 warn). Output: `FAIL - D10 ... lag20=ok lag21=ok`, 1 failure, exit 1. Only D10 failed.
- GREEN `89881a564`: DEFAULT_MAX_VERSION_LAG 40 to 20 with the reason in the comment (32 releases in 37 days, about 23 days at 6 per week, MINDRIAN_LEDGER_MAX_VERSION_LAG still overrides). data/doctor-modules.json description now states "default 20". scripts/doctor.cjs untouched.
- After: test-391-doctor-ledger-gap 10 checks 0 failures; test-265-ledger-freshness PASSED; test-265-mcp-surface-organ 16 passed; run-all-265 PASS=26 FAIL=0; test-doctor-module-contract-parity and test-doctor-doc-parity ALL PASS. Real organ result: `status: ok` (installed 2.1.319, ledger_covers.to 2.1.318, lag 1).
- Header comment of the test file updated: it said D10 would pin the default; now it does.

### C2 APPLY (web credential guard onFailure)

- RED `fe41445d6`: WH5 (test-386) requires `onFailure === 'block'` on the web group; A5 (test-261029) pins both guard hooks as the only two with the key; H5 (test-391-hooks-contract) expects exactly two (egress guard, web credential guard), with mutation arms for an observer hook, each guard missing the key, and value warn. Before the edit: WH5 FAIL (`onFailureBlock=false`), A5 FAIL (`web-credential-guard-hook.cjs onFailure is undefined`), H5 FAIL (`1 hooks carry onFailure (expected exactly 2)`). All three exit 1.
- GREEN `d0a95d1e1`: hooks/hooks.json, one key `"onFailure": "block"` added to the web credential hook entry (timeout stays 5; the previous line gains a comma, so git shows 2 insertions and 1 deletion). Nothing else changed.
- After: test-386-web-credential-hook "all arms passed"; test-261029 ALL PASS; test-391-hooks-contract 25 passed 0 failed; test-386-web-path-gate passed; run-all-386 PASS=37 FAIL=0. Exactly 2 hooks carry onFailure block (node check). `git diff --quiet HEAD -- scripts` clean (guard scripts untouched). The egress guard group is unchanged.
- `claude plugin validate .`: "Validation passed with warnings". Same warning as before (CLAUDE.md at the plugin root) plus the tsc digest note, both expected per the 391-07 SUMMARY. No new warning.

### C3 APPLY-NARROW-BASH (radar command)

- RED `0b002ac5d`: arm 6 of test-265-radar-writes-ledger and arm P8 of test-391-radar-command-contract expect the five tools plus `Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/radar-changelog-slice.cjs" *)`. Before: test-265 FAILED (`missing=[the Bash entry]`); test-391 FAILED on P8 (and on P7, which runs test-265). 2 failures.
- GREEN `7ec5ff0ec`: one list item after AskUserQuestion in commands/radar.md frontmatter. Nothing else in the file changed. `node scripts/build-skill-mirrors.cjs` regenerated skills/radar/SKILL.md (1 overwritten); dist/ not touched. Body check: the body tells the model to run `node "${CLAUDE_PLUGIN_ROOT}/scripts/radar-changelog-slice.cjs" --list` and `--approve`, which matches the rule text after variable substitution (quoted path, trailing space-star).
- After: test-265-radar-writes-ledger PASSED (6 arms); test-391-radar-command-contract 11 checks 0 failures; build-skill-mirrors --check OK (112 mirrors); build-connector-registry --check exit 0; build-orchestration-projection --check OK; check-render-coverage 0 gap; check-plugin-path-anchoring --check OK; plugin validate passes.

### C4 FILE-SEED

- `895f968b9`: SEED-146 created (shape of SEED-144). Facts copied from the card with its marks, no new claim, no decision, no wiring. This plan made no /ultrareview decision.

## Part 11 and phase gates

- bash tests/run-all-391.sh: PASS=8 FAIL=0.
- bash tests/run-all-265.sh: PASS=26 FAIL=0.
- The commit hook run (pre-commit gates) passed on every commit, including the command-registration sweep (113 scanned, 39 existing length warnings, none new).

## Deviations from Plan

None in scope. Notes:

- The RED commit of C3 also fails P7 (it runs test-265). That is the same cause and goes green with the same edit.
- The plan text says "exactly one added line" for hooks.json. JSON needs a comma on the previous line, so the diff is +2 -1 lines with one new key.

## Known risks (not defects of this plan)

- Generated mirror skills/radar/SKILL.md writes allowed-tools comma-joined (`Read, Write, ..., Bash(node "..." *)`). Earlier it was space-joined. This is the generator output. Whether the host parses a Bash pattern with an inner space inside a comma list is UNVERIFIED. If it does not match, the host asks for permission once per run, as before the grant (card C3 risk).
- The body of commands/radar.md still says "Until the navigator pre-approves Bash for this command, the host may ask you for one permission prompt". Left unchanged on purpose (the plan forbids body edits). The sentence stays true when the rule does not match.
- A slow or broken web guard now blocks WebSearch, WebFetch and Tavily (card C2 risk, accepted by the owner). Measured time: about 25 ms against a 5000 ms limit.
- A lag above 20 now blocks a release cut (blocker point capability-ledger-fresh) until a radar fetch is run. Opt-outs: MINDRIAN_LEDGER_MAX_VERSION_LAG, DOCTOR_SKIP_CAPABILITY_LEDGER=1.

## Not done

- Nothing was pushed, tagged, released or version-bumped. CHANGELOG.md and the version files are unchanged. The changes are on main only and are not live until a release is cut and picked up.
- No network call. The live radar fetch is left to the main session.
- STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched.
- The requirement ids CC391-A to CC391-J exist only in ROADMAP.md and in the plan frontmatter. They are not tracked in REQUIREMENTS.md.

## Commits

- e39897e65 test (RED) C6
- 89881a564 fix C6
- 895f968b9 docs C4 seed
- fe41445d6 test (RED) C2
- d0a95d1e1 fix C2
- 0b002ac5d test (RED) C3
- 7ec5ff0ec fix C3

## Self-Check: PASSED

All created and modified files exist; all 7 commits are ancestors of HEAD; the working tree shows only the peer's uncommitted eureka files.
