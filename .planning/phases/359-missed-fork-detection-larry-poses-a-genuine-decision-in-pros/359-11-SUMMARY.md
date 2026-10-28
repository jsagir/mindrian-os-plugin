R9: DECLINED (extra-usage billing is real money; the batch projects to USD 76.08 at the highest measured per-run cost)

# Phase 359 Plan 11: R9 full forward run Summary

**The navigator declined the paid batch. Plan 359-11 closed on the `decline` path. No R9 number exists. R8 shipped (656cd8a34) and its adoption on live Larry is unmeasured.**

Every claim is PROVEN (seen in this plan or in a cited SUMMARY) unless marked UNVERIFIED or ASSUMED.

## Navigator ruling (batch)

The human gave these answers in the main session on 2026-10-28. The main session relayed them to this executor. Status: PROVEN (relayed text).

The human wrote, verbatim:

> i have 250 extra usea chaged already and waiting

The main session read this as: extra-usage billing is on and real money is already being charged. The main session then asked: "Extra usage is billing real money ($250 already). What do we do with the 359 live batch?" The human chose, verbatim:

> Skip the batch, close 359 (Recommended)

This equals the plan option `decline`.

## Reason

Extra-usage billing is real money, and the batch would project to USD 76.08 at the highest measured per-run cost (PROVEN in 359-10: 144 runs x 0.4226918 x 1.25; at the lowest measured cost 0.245283 the projection is USD 44.15).

## What did not run

- Task 1 (approval packet): replaced by the ruling above. No dry run of the batch was needed for the decline.
- Task 2 (the batch, evaluation, outcome): NOT run. It needs the batch.
- Task 3 (moonshot scores of forward declarations): NOT run. It needs the batch rows (`declared: true`). No `Forward run (plan 11)` section was appended to `359-MOONSHOT-SCORES.md`.
- No R9 number is stated or estimated here. There is no pre or post fork-run count, no missed-fork count, no floor check, no control-block count, no hook_live_proof from a batch.
- No paid command ran in this plan. `claude -p` was not called. `scripts/forward-fork-scenarios-359.cjs` was not run.

## Spend in the phase

- USD 0.668 in total, all from the 359-10 smoke (2 runs: pre 0.4226918, post 0.245283). PROVEN in 359-10-SUMMARY.md.
- `~/.cache/mindrian-dev/359-forward/` holds `smoke.jsonl`, `streams/` and `trees/`. It holds no `results.jsonl`. PROVEN (directory listing in this plan).

## Consequences

- FORK359-09 stays OPEN: `Open: R9 declined, extra-usage billing is real money`.
- R8 stays in place. It is not reverted, because no bar was failed. It is not confirmed either. Adoption of the `Your call: A | B | What if C` line on live Larry is UNVERIFIED.
- The offline replay gate for R8 passes (`bash tests/run-all-359.sh`, PASS=26 FAIL=0 in 359-09 and 359-10). The replay gate does not measure whether live Larry writes the line.
- No revert commit and no follow-on phase were opened.
- No file under agents, skills, lib, scripts or hooks changed in this plan.

## Deviations from Plan

None beyond the decline path itself. The plan lists `decline` as a valid option: "record `R9: DECLINED` and go to Task 3 step 3". Task 3 step 3 (the final gate runs) is covered by the 359-12 close-out.

## Known Stubs

None.

## Threat Flags

None.
