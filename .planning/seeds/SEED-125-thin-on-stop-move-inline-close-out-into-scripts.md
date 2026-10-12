---
id: SEED-125
title: "Thin on-stop: move the inline node -e close-out blocks into scripts/*.cjs and lower the on-stop line budget"
status: filed
priority: medium
filed: 2026-10-12
source: "quick 261012-rey (option a of item 6, sweep search-surface-qa-sweep-20261012, navigator decision 2026-10-12) and the sweep evidence file .planning/debug/search-surface-qa-sweep-20261012/cluster-b/EVIDENCE.md"
depends_on: Phase 198 (D-06 thin adapter, SPEC-5 budget, SPEC-7 flag-OFF byte-identical parity), Phase 88 (the per-folder close-out on the Stop walk), Phase 369.25 plan 19 (the BRIEF.md render inside the line-408 block)
promotes_to: a phase of its own; the navigator decides the slot at the next sequencing gate
---

# SEED-125: Thin on-stop

Quick 261012-rey re-based the on-stop line budget so the release suite is green again. That fix hides the cause. The cause is that the flag-OFF body of scripts/on-stop keeps growing, because close-out code lives inline in bash as `node -e` blocks. This seed holds the real fix: move those blocks out, then lower the budget.

## Measured

- Whole file: 657 lines by `wc -l`, 658 by `split('\n').length` (the measure the test uses). Measured at HEAD 2c0eae9f5 on 2026-10-12. The last commit that touched the file is 26629ecff (2026-10-06).
- Old budget: 570 (Phase 198-09, from 547 measured plus 23).
- Re-based budget: 680 (quick 261012-rey, the smallest multiple of 10 that is at least 658 plus 20).
- Flag-ON thin-adapter span: sentinels at line 47 (BEGIN-MCP-FIRST-STOP-THIN-ADAPTER) and line 136 (END-MCP-FIRST-STOP-THIN-ADAPTER), 90 lines. This span is already thin and has its own audit.
- Inline multi-line `node -e` blocks, by start and end line:
  - 241-247 (7 lines): signal count.
  - 331-343 (13 lines): voice summary line.
  - 376-385 (10 lines): MINTO queue pending count.
  - 408-523 (116 lines): snapshot write, stale-marker write, and the 369.25 BRIEF render from line 483. This is the largest block and the first target.
  - 546-556 (11 lines): guardian summary.
  - 569-609 (41 lines): stop summary.
  - 648-655 (8 lines): final system message.
  - Total inline: 206 lines of the 658.
- Growth history of the line count (split measure): 547 (7226232a7, 2026-07-10), 553 (f63d1ddce), 580 (8462f41ad, 2026-07-28, first breach of 570), 605 (0d02e112e), 612 (c7fb00dba), 618 (01c3ca19d, 2026-07-30), 658 (26629ecff, 2026-10-06).

## The job

Move each inline block into a scripts/*.cjs file that the bash script calls with the same environment inputs. Start with the 116-line block at line 408. Then re-measure scripts/on-stop. Set LINE_BUDGETS['scripts/on-stop'] in lib/mcp/hook-adapter-audit.cjs back down with the same margin rule (smallest multiple of 10 at least measured plus 20). The target is at or under 570.

## Constraints

- SPEC-7: the flag-OFF output stays byte-identical. tests/test-198-flag-off-parity.test.cjs must stay green.
- The flag-ON span and its bespoke audit stay unchanged.
- The 369.25 BRIEF tests stay green.
- The `|| true` failure funnel stays, so the hook always exits 0.
- Measure the cold-start cost of the extra node processes. The comment at line 408 says one node call amortizes cold start, so splitting blocks into more processes has a cost. Record the number.
- Verify Windows Git Bash through the polyglot run-hook.cmd.
- The change is CLI-only by construction (Tri-Polar): Desktop and Cowork have no hooks.
- Canon Part 8 is untouched: no network, no Brain call.

## Done when

- bash tests/run-all-198.sh reports Failed: 0 with the lowered budget.
- bash tests/run-all-366.sh reports FAILED=0 with the lowered budget.
- scripts/on-stop measures at or under 570 lines.

## Not in scope

Option b2 (measure only the flag-ON span and drop the whole-file budget) is kept as a record. It was not chosen. It would remove the signal that the flag-OFF body keeps growing.
