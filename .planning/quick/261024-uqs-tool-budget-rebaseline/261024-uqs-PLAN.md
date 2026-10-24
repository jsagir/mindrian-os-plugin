---
quick_id: 261024-uqs
slug: tool-budget-rebaseline
date: 2026-10-24
type: quick
files_modified:
  - tests/test-270-tool-schema-budget.cjs
---

# Quick 261024-uqs: re-baseline the tool-schema budget (50 -> 75 tools)

## Goal

The release gate `tests/run-all-366.sh` fails on `tests/test-270-tool-schema-budget.cjs`. The Eureka squash (commit 6bc8cfc55) added 25 MCP tools. The measured surface is 75 tools and 83522 total bytes. The recorded AFTER is 50 tools and 59020 bytes (41.51 percent over the 10 percent tolerance).

## Tree

Work runs in `/home/jsagi/dev/MindrianOS-Plugin-release` (branch main, base 9f5d207da). The precedent is commit dbb9a3efd (quick-261019-k22).

## Tasks

1. Run `node tests/test-270-tool-schema-budget.cjs`. Record the measured numbers from the test's own output. Do no new arithmetic.
2. Name the 25 new tools. List the live tools/list names at HEAD. Check each name against `lib/mcp` and `bin` at dbb9a3efd.
3. Add a dated comment block above the AFTER constant in the form of the k22 block. Update the AFTER constant. Keep `DRIFT_TOLERANCE_PCT` at 10. Change no other rule.
4. Search `tests/` for other pins of the 50-tool count.
5. Run the 270 test until green. Run the release gate only if the machine load is below 8.
6. Commit with `git commit --only` on the one test path.

## Limits

- No push, no tag, no release script, no git stash.
- No `gsd-tools state.*` handler.
- No em-dashes.
- Do not rerun the engine tests (`claude plugin test`) while the machine is loaded.

## Done when

- The 270 test passes 5 of 5.
- The commit message names the measured percentage.
