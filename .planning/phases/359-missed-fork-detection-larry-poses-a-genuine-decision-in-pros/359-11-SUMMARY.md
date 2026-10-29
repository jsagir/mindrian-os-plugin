R9: PASS (pre 16/36, post 6/36, controls 0; floor 8; decline reversed, see "Addendum: decline reversed")

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

## Addendum: decline reversed

Added 2026-10-29. The history above stays as written. It is the record of the decline path. The old line 1 was:

> R9: DECLINED (extra-usage billing is real money; the batch projects to USD 76.08 at the highest measured per-run cost)

### Navigator ruling (reversal)

The human typed this in the main session on 2026-10-28. Status: PROVEN (text relayed by the main session in the task prompt). Verbatim:

> 359   │ Closed on decline, N-7 running no decline apprve

The main session read this as: no decline, approve the batch (plan option `approve-batch`). The terms were the earlier approvals of the same human, relayed by the main session: raise the ceiling to about USD 80 ("Raise the ceiling to about $80") and rename the user-level agent link, restore after ("Yes, rename, restore after (Recommended)").

Terms applied (PROVEN from the task prompt and the commands run):

- Total cap USD 80.00 all in. `meta.caps.total_usd` was set to 79.33 in `tests/fixtures/forward-fork-scenarios-359.json` (commit `4a8b64e39`, that file alone), because the harness counts only `results.jsonl` rows and the smoke (USD 0.668) is not in that file.
- Per-run cap USD 0.40 (`--max-budget-usd 0.4`). Model `claude-sonnet-5` only. Mode `probe`. 3 runs per scenario, pre and post arms. `R8_SHA` = `656cd8a3410d7f396c25b612a98b49eff846b1f2`. Pre = `R8_SHA^`, post = `R8_SHA`, both archived with `git archive`.
- Command: `node scripts/forward-fork-scenarios-359.cjs --r8-sha 656cd8a3410d7f396c25b612a98b49eff846b1f2 --arm both --mode probe --results ~/.cache/mindrian-dev/359-forward/results.jsonl`. Projection by the harness: 144 runs, USD 72.00 at the 0.40 cap with the 1.25 factor. It did not refuse.
- Nothing under `~/.claude` was touched. The agent link was `larry-extended.md.shadow-bak` for the whole run; the preflight passed (no "shadowed agent" refusal). The main session restores the link.

Outcome: R9 PASS (pre 16/36, post 6/36, controls 0).

### R9 outcome (PROVEN: `node scripts/forward-fork-scenarios-359.cjs --evaluate --mode probe`, output in `~/.cache/mindrian-dev/359-forward/r9-eval.json`)

Counts and scenario ids only. No reply text is recorded here.

| Item | Pre (`656cd8a34^`) | Post (`656cd8a34`) |
|------|--------------------|--------------------|
| Rows | 72 (36 fork, 36 control), all status ok | 72 (36 fork, 36 control), all status ok |
| Fork runs with a non-mode-menu card in attempt 1 | 20 | 30 |
| Mode-menu cards | 0 | 0 |
| Fork runs with a declaration | 0 | 4 |
| Missed forks (no card, no declaration) | 16 of 36 | 6 of 36 |
| Control runs with a declared-fork-no-card block | 0 | 0 |
| Control runs with a non-menu card (info only) | 2 | 0 |
| error_budget rows | 0 | 0 |
| Other error and excluded rows | 0 | 0 |
| Retried rows | 0 | 0 |
| Cost (USD) | 15.513 (max row 0.3005) | 15.817 (max row 0.3255) |

- Scenarios: 12 fork scenarios and 12 control scenarios, 3 runs each, per arm (144 rows in all, 0 duplicate keys).
- Pre missed ids (count): fwd-fork-02 (3), fwd-fork-03 (1), fwd-fork-04 (3), fwd-fork-06 (1), fwd-fork-08 (1), fwd-fork-09 (3), fwd-fork-10 (3), fwd-fork-11 (1). Total 16.
- Post missed ids (count): fwd-fork-01 (2), fwd-fork-02 (2), fwd-fork-08 (1), fwd-fork-09 (1). Total 6.
- Post declarations (scenario, run): fwd-fork-05 run 2, fwd-fork-07 run 1, fwd-fork-07 run 2, fwd-fork-08 run 1. In each of the 4 rows a card also appeared in attempt 1 and `intercept_log_declared` was 1. The 4 labels lists had 3 labels each, the last one a What-if moonshot.
- Control declared blocks (post): 0 (ids: none).
- Vacuity floor: max(6, ceil(0.2 x 36)) = 8. Pre missed 16 is at or above the floor, so the result is not INCONCLUSIVE.
- Bar: post missed 6 is at most 50% of pre missed (16 x 0.5 = 8), and control declared blocks are 0. Outcome PASS.
- `hook_live_proof`: false. The harness definition needs a post fork row with declared true, card false and `intercept_log_declared` above 0. No such row exists: the 4 declared rows each also had a card. The hook path itself did fire in those rows (`intercept_log_declared` 1 each, split `stop-hook` in all 144 rows), so the live-hook evidence is partial. Not a proof by the harness definition.
- Spend: USD 31.331 in `results.jsonl` plus USD 0.668 for the 359-10 smoke = USD 31.999 all in (cap USD 80.00). Every row cost at most USD 0.3255 (cap 0.40 per run). PROVEN by `node` over `results.jsonl`.
- Wall time: 2 h 47 min (20:30:37Z to 23:18:03Z), sequential, one process, no resume needed.
- `git ls-files | grep -c "359-forward"` is 1: the file name `tests/test-359-forward-harness.cjs`. No raw stream or results file is tracked.

### How to read the PASS (disclosures)

- The measured post tree is the R8 commit as shipped, with the strict fork-declaration parser. The N-7 tolerance (cosmetic slips) is NOT in the measured tree. PROVEN: the post arm is `git archive 656cd8a34`; N-7 work was not committed at that sha.
- Most of the drop in missed forks comes from more cards, not from declarations: fork-run cards rose from 20 to 30 of 36, declarations are 4 of 36. The bar is on missed forks, so the verdict holds. That the R8 prose caused the rise is the design hypothesis; the measurement shows the arms differ, with 3 runs per scenario. Causal attribution beyond that is ASSUMED.
- Not every scenario improved: fwd-fork-01 was missed 0 times in pre and 2 times in post. fwd-fork-02, fwd-fork-08 and fwd-fork-09 stayed partly missed. n is small (12 fork scenarios x 3 runs).
- The arms ran in order (pre, then post), not interleaved. A drift effect between the two blocks is UNVERIFIED and ASSUMED small (same binary 2.1.312, same model, same fixtures).
- The per-run cap was not exceeded in any row, so the known after-the-fact overshoot did not occur (error_budget 0 in both arms). Not hidden: the rows were counted as they are.
- Moonshot scoring (Task 3): 4 declared rows scored by Jev at dev time (see `359-MOONSHOT-SCORES.md`, section "Forward run (plan 11)"). The Jev request cost is not metered here (UNVERIFIED); the call went to the TypeSafe key that plan 06 used.

### Consequences (PASS path)

- R8 stays. No revert commit. No follow-on phase opened. No file under agents, skills, scripts/session-start or lib/mcp/runtime-instructions.cjs changed in this addendum (PROVEN: only the fixture cap and docs paths changed).
- FORK359-09 is ticked on the PASS.

### Final gates (PROVEN, run after the batch, main working tree)

| Command | Result |
|---------|--------|
| `bash tests/run-all-359.sh` | PASS=27 FAIL=0 SKIP=0 |
| `node tests/test-359-inertness.cjs` | 4/4 |
| `bash tests/run-all-238.sh` | PASS=14 FAIL=0 SKIP=0 |
| `bash tests/run-all-357.sh` | PASS=16 FAIL=0 SKIP=0 |
| `bash tests/run-all-251.sh` | PASS=6 FAIL=0 SKIP=0 |
| `node scripts/build-harness-manifest.cjs --check` | OK |

Run-all-359 shows 27 legs, one more than the 26 of plan 359-12. The extra leg is not from this plan: commit `84615de32` (quick 261028-v6m, N-7) touched `tests/run-all-359.sh` while this batch ran (PROVEN by `git log` on that file).

## Addendum Self-Check

- Commits: `4a8b64e39` (cap), `f5a190bd3` (moonshot scores). Doc commit follows by explicit path.
