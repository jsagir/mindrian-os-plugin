---
phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix
plan: 04
subsystem: mcp-layer
tags: [mcp, tool-descriptions, test-coverage, guardrail-honesty, canon-part-6, canon-part-7]

# Dependency graph
requires:
  - phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix
    plan: "01"
    provides: "tests/run-all-266.sh aggregator with TEST_266_ALLOW_MISSING escape"
  - phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix
    plan: "02"
    provides: "room_state description fix, removing the mid-word-cut ends-with-period failure"
provides:
  - "tests/test-234-tool-description-floor.cjs applies all four prose-shape checks (capital start, sentence terminator, byte ceiling, no em-dash) to every registered tool, derived from tools/list, never a hand-maintained list"
  - "tests/run-all-266.sh runs clean with no TEST_266_ALLOW_MISSING escape, proving every file the phase promised exists on disk"
  - "A tracked, durable record of the nine items Phase 266 deliberately declined, with pointers to their research"
affects: [mcp-server, tests/test-234-tool-description-floor.cjs, tests/run-all-266.sh]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coverage ledger derived from the wire (tools/list), never a literal name list: checkedNames.size / tools.length reported in the suite's own summary line so a green run cannot be misread as covering more than it does."
    - "Presence pin vs coverage gate: REWRITTEN_TOOLS is kept only to assert its 8 names are still registered; it no longer decides which tools get prose-checked."
    - "Host cap measured in bytes (Buffer.byteLength), not JS string length, because the platform's cap is a byte cap."

key-files:
  modified:
    - tests/test-234-tool-description-floor.cjs
    - tests/run-all-266.sh
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Replaced MAX_DESCRIPTION_CHARS=600 with HOST_DESCRIPTION_CAP_BYTES=2048 (the real Claude Code 2.1.84 per-tool description cap), because the old ceiling's own stated exemplar (chain_run at 552) had doubled to 1113 -- the premise had rotted, not the tools."
  - "Relaxed the sentence-terminator check to SENTENCE_TERMINATOR (/[.!?][)\\]\"'’”]*$/) instead of editing room_state_bound's correct prose, since its trailing '.)' IS a terminated sentence -- the old /\\.$/ regex was too literal, not the description wrong."
  - "Demoted REWRITTEN_TOOLS from a coverage gate to a presence pin: it still fails loudly if one of the 8 original rewrite targets is renamed or dropped, but it can never again gate which tools receive a prose check."
  - "Did not add the total-surface token budget assertion (research R-3c): the 'under 7000 token budget' claim is already measured at ~7,062 tokens, so adding that assertion here would land a red leg for a drift this phase did not scope to fix. Named explicitly in both the test file header and the run-all-266.sh out-of-scope record instead of silently dropped."

requirements-completed: [MCPFIX-04]

# Metrics
duration: "~45 minutes"
completed: 2026-08-27
---

# Phase 266 Plan 04: MCP Tool Description Guardrail Coverage Honesty Summary

**Expanded `tests/test-234-tool-description-floor.cjs` from an 8-tool hand-maintained prose-check allow-list to universal coverage of all 36 registered tools, derived live from `tools/list`, fixed the two known false-failures (the `room_state_bound` terminator regex and the rotted 600-char ceiling), and ran the Phase 266 gate with no missing-target escape to prove every file this phase promised actually exists.**

## What Was Built

**Task 1 - Universal coverage in `tests/test-234-tool-description-floor.cjs`.** Four mechanical changes, zero tool-description edits:

1. Deleted `MAX_DESCRIPTION_CHARS = 600` (derived from a stale `chain_run` exemplar that has since doubled from 552 to 1113 characters). Added `HOST_DESCRIPTION_CAP_BYTES = 2048`, the real Claude Code 2.1.84 per-tool description cap, asserted via `Buffer.byteLength(d, 'utf8')` (a byte cap, not a character-length cap).
2. Added `SENTENCE_TERMINATOR = /[.!?][)\]"'’”]*$/`, tolerating a trailing closing bracket or quote after the terminal punctuation, so `room_state_bound`'s correctly-punctuated `"... multi-command tool.)"` stops false-failing against the old, too-literal `/\.$/`.
3. Replaced the `for (const name of REWRITTEN_TOOLS)` prose-check loop with a universal loop over every tool in the live `tools/list` response. Every tool now gets all four checks (capital start, sentence terminator, byte ceiling, no em-dash), and each name is added to a `checkedNames` Set as it is checked. `REWRITTEN_TOOLS` is kept but demoted to a presence pin: it now only asserts each of the 8 original rewrite targets is still registered by name, with a comment stating it must never again gate which tools get checked.
4. Added the structural guard `uncovered = tools.filter(t => !checkedNames.has(t.name))` with a check that `uncovered.length === 0`, and changed the final summary line to append `(prose-shape coverage: N/N registered tools)`. The coverage clause stays even at 100% coverage: the original defect was a passing number that did not state its scope, and a number that always states its scope cannot silently regress into that shape again.

Also replaced the two literal em-dash/en-dash characters used as DATA inside the em-dash check itself (`d.indexOf(String.fromCharCode(0x2014))`, `d.indexOf(String.fromCharCode(0x2013))`) with their escaped code-point forms, so the check's own logic is unchanged but the source file carries zero literal em-dash/en-dash bytes -- closing the false-positive this same file's data literal was tripping against the phase's own no-em-dash fence.

Result measured live: 156 passed, 0 failed, coverage 36/36 (up from the prior 35 passed against 8 named tools).

**Task 2 - Run the phase gate clean, land the out-of-scope record.** Added a "Deliberately out of scope for Phase 266" section to the header of `tests/run-all-266.sh`, listing the nine items the phase declined (alwaysLoad eager-load, missing annotations/outputSchema/title, deprecated elicitation enumNames shape, `type: "mcp_tool"` hook adoption, a doctor tool-count check, `requiresUserInteraction`/`_meta.maxResultSizeChars`, retired-backend names in Brain tool descriptions, counted-facts drift across three separate numbers, and the total-surface token budget assertion), each with its research recommendation ID and a full path to `265-RESEARCH-mcp-layer-audit.md`. Stated plainly that Phase 265's `data/capability-ledger.json` does not exist on disk yet, so these are recorded here (a tracked file, since `.planning/` is gitignored and does not travel between machines) rather than as ledger rows. Confirmed the `EMDASH_TARGETS` glob (`tests/test-266-*`) already discovers both files 266-02 and 266-03 created, with zero edits to the runner needed. Ran `env -u TEST_266_ALLOW_MISSING bash tests/run-all-266.sh`: PASS=8, FAIL=0.

## Sequencing Note (Wave 2 dependency)

This plan's worktree branch was created from an ancestor of `main` (commit `460d5c77`) that predated the Wave 1 merges (`266-01`, `266-02`, `266-03`). Before any edits, fast-forward merged local `main` (`git merge --ff-only main`, confirmed `460d5c77` was an ancestor of `main` first) to bring in the Wave 1 commits this plan's frontmatter declares as `depends_on`. No conflicts; no other local changes existed to lose.

## Deviations from Plan

None beyond the sequencing fast-forward above (not a deviation from the plan's instructions, a prerequisite for following them, since the plan explicitly depends on 266-01 and 266-02's changes being present). Both tasks matched their `<action>` blocks; all acceptance criteria verified below.

## Verification

All items from the plan's `<verification>` block:

1. `node tests/test-234-tool-description-floor.cjs` -- exit 0, `156 passed, 0 failed`, `coverage: 36/36`.
2. `env -u TEST_266_ALLOW_MISSING bash tests/run-all-266.sh` -- exit 0, `PASS=8 FAIL=0 SKIP=0`, 2 `tests/test-266-*` files discovered.
3. `bash tests/run-all-234.sh` -- `PASS=9 FAIL=2`, both failures (`test-234-dist-bundle.cjs`, `test-234-free-core-network-scan.cjs`) are the pre-existing baseline documented in `266-02-SUMMARY.md`, unrelated to any file this plan touches. No new failing leg.
4. `node scripts/build-connector-registry.cjs --check` -- OK. `node scripts/doctor.cjs --acceptance` -- `15/16` points passed; the sole failure (`verify-release-clean-tree`, a pre-existing `package-lock.json` version-string drift documented in `266-01-SUMMARY.md` as out of scope) is the documented environmental baseline, not a new failure.
5. `git diff --stat 3fe9fb35..HEAD` (the pre-fast-forward-merge tip through this plan's own two commits) touches only `tests/run-all-266.sh` and `tests/test-234-tool-description-floor.cjs` -- never `lib/` or `bin/`.

Task-level acceptance criteria (all independently checked, not eyeballed):
- `grep -v '^\s*[*/]' tests/test-234-tool-description-floor.cjs | grep -c 'MAX_DESCRIPTION_CHARS'` = 0.
- `grep -v '^\s*[*/]' tests/test-234-tool-description-floor.cjs | grep -c 'HOST_DESCRIPTION_CAP_BYTES'` = 3.
- `grep -v '^\s*[*/]' tests/test-234-tool-description-floor.cjs | grep -c 'Buffer.byteLength'` = 2.
- `grep -v '^\s*[*/]' tests/test-234-tool-description-floor.cjs | grep -c 'checkedNames'` = 5.
- `for (const name of REWRITTEN_TOOLS)` still present as the presence-pin loop; its body contains zero `SENTENCE_TERMINATOR` references.
- `git diff --name-only` shows no `lib/` or `bin/` file changed by this plan.
- `LC_ALL=C.UTF-8 grep -cP '\x{2014}'` = 0 on both modified files.
- `grep -c 'Deliberately out of scope' tests/run-all-266.sh` = 1.
- `grep -c '265-RESEARCH-mcp-layer-audit.md' tests/run-all-266.sh` = 1.
- `grep -c 'capability-ledger' tests/run-all-266.sh` = 1.
- `grep -c 'alwaysLoad' tests/run-all-266.sh` = 1, `grep -c 'maxResultSizeChars' tests/run-all-266.sh` = 1.

## Must-Haves Verification

- **Truth: "Every registered MCP tool receives every prose-shape check, not a hand-maintained list of eight"** -- verified: the universal loop iterates `tools` (the live `tools/list` response), not `REWRITTEN_TOOLS`; 156 checks ran against 36 tools (36 x 4 prose checks + 8 presence-pin checks + 3 harness checks).
- **Truth: "The suite's own summary line states its coverage, so a green run can never again be read as a claim it did not earn"** -- verified: the final `process.stdout.write` line reads `156 passed, 0 failed (prose-shape coverage: 36/36 registered tools)`.
- **Truth: "A newly registered tool is covered automatically, because the checked set is derived from tools/list rather than a literal"** -- verified: `checkedNames` is built inside the `for (const t of tools)` loop from the wire response; no name literal gates entry into that loop.
- **Truth: "The Phase 266 gate runs with no missing-target escape, proving every file this phase promised actually exists"** -- verified: `env -u TEST_266_ALLOW_MISSING bash tests/run-all-266.sh` exits 0 with `FAIL=0`.
- **Artifact: `tests/test-234-tool-description-floor.cjs` provides universal prose-shape coverage, a byte ceiling at the real platform cap, and an honest coverage line, contains "coverage"** -- confirmed (the string `coverage` appears in comments, check labels, and the summary line).
- **Artifact: `tests/run-all-266.sh` provides the phase gate run without `TEST_266_ALLOW_MISSING`, plus the durable out-of-scope record** -- confirmed.
- **Key link: `tests/test-234-tool-description-floor.cjs` -> `bin/mindrian-mcp-server.cjs` via the checked set built from the live `tools/list` response, pattern `checkedNames`** -- confirmed: `checkedNames` is populated inside the loop over `tools`, which comes from `listToolsOverStdio()`'s spawn of `bin/mindrian-mcp-server.cjs`.

## Known Stubs

None.

## Threat Flags

None. This plan's changes are test-file-only (no new tool, no schema change, no new network reach, no tool description edited). All four threats disposed `mitigate` in the plan's `<threat_model>` (T-266-15 through T-266-18) are addressed directly by the coverage ledger, the presence-pin demotion, the pre-measured (not guessed) fix set, and the tracked out-of-scope record; T-266-19 (accept) and T-266-SC (mitigate, zero installs) required no new action.

## Self-Check: PASSED

- FOUND: `tests/test-234-tool-description-floor.cjs` (modified, coverage 36/36, 156/0)
- FOUND: `tests/run-all-266.sh` (modified, PASS=8 FAIL=0)
- FOUND: `.planning/REQUIREMENTS.md` (MCPFIX-04 checkbox flipped to `[x]`)
- FOUND commit `f4f1d754` in `git log --oneline --all`
- FOUND commit `3ef6d105` in `git log --oneline --all`

---
*Phase: 266-mcp-layer-correctness-fixes-fast-independently-shippable-fix*
*Completed: 2026-08-27*
