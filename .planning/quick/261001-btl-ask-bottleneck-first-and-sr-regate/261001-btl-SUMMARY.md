---
type: quick
id: 261001-btl
slug: ask-bottleneck-first-and-sr-regate
date: 2026-10-01
requirement: DRP363-19
commits:
  red: 8d66997ec
  green: fca0d37d2
---

# Quick 261001-btl: ask for the bottleneck first, and re-gate scientific-roadmapping on revise

**One-liner:** a whitespace deep run now starts by asking the navigator what blocks the gap (`needs_limiter` plus an `add_limiter` edit that stores their own words), and a scientific-roadmapping deep plan that drops its last limiter becomes a wish.

## Ruling 1: ask for the bottleneck first

- **Quick card offer.** A thin or contested quick run whose plan names no limiter now offers "name what blocks this and I'll plan a deep run" (offer kind `needs_limiter`, option `name_limiter`) instead of "run deep on this?". A plan that already names a limiter keeps the old offer and the `run_deep` option.
- **Typed next-move.** `cardFor` (and so `escalate` and `revise`) answers `next: needs_limiter`, `reason: no_nameable_limiter`, with a `name_limiter` / `stop` card, for a deep plan that grew from a quick run (`plan.seed`) and has no limiter. A deep plan built directly with no limiter keeps `revise` / `no_nameable_limiter` (C15 is unchanged).
- **The navigator's words.** New `revise` edit `{"op": "add_limiter", "statement": "<their words>"}`. The statement is stored verbatim with whitespace collapsed, as an `assumed` limiter with `raised_by: navigator`, `question` equal to the statement, and is linked to the first searchable leaf. It is never derived from room text and never sent to the Brain (Canon Part 8, D-10); a blank statement is refused (`statement_required`), a statement over 240 characters is refused. The edit file is written with the Write tool, never passed on argv. Adding a limiter clears the tension wish, so the plan comes back ready for review.
- **Sticky wish fixed.** `assess` kept a previously wished plan a wish forever. It now stays a wish only while the plan still has no limiter, which is what lets `add_limiter` work.
- **Docs.** `commands/whitespace.md` gets step 5a (ask before any deep run, write the words as a limiter, offer only the quick run if none) and a longer step 7. `commands/research.md` explains the two escalation lines and the `revise` call. Both skill mirrors regenerated with `scripts/build-skill-mirrors.cjs`, and `--check` is OK. The registry `teaching:` line was not changed, so the generated registries did not change.
- **MCP.** `research_run` op `deep_plan` returns a `next_step` for `needs_limiter` (there is no revise op over MCP, so it says to add the words as a limiter in the question set and plan again).
- **Born-wired checks, all OK:** `build-connector-registry --check`, `build-orchestration-projection --check`, `check-render-coverage`, `build-command-registry --check`, `build-skill-mirrors --check`, `check-skill-spec --check`, `check-help-coverage`.

## Ruling 2: scientific-roadmapping re-gate

The deep wish branch in `assess` no longer excludes scientific-roadmapping. The build-time scientific-roadmapping branch (perspective errors, `perr.length > 0`) is untouched, so building an SR plan is identical; the only change is that an SR plan with no limiter left after a revise (drop_path of the last limiter path) is now a wish with `no_nameable_limiter`. C16 drops all three fixture paths one at a time: while limiters remain the plan stays ready, and it is a wish with no `deep_run` or `review` at zero.

## Tests and commits

| Leg | sha | What |
|-----|-----|------|
| RED | 8d66997ec | C16, C17 in test-363-cli; Q3 (changed) and Q3b (new) in test-363-run-quick. C16 and C17 and Q3 failed for the intended reasons; Q3b passed (the old offer is kept when a limiter is named) |
| GREEN | fca0d37d2 | plan.cjs, planner.cjs, quick.cjs, lib/mcp/tools/research.cjs, the two commands and their skill mirrors, and a one-character-class fix to C17's own regex (the card starts the sentence with a capital N) |

C17 also asserts, through a fetch tripwire preload in the spawned CLI, that neither the blank edit nor the real edit fetches anything. Q3 was changed, with its reason in the file: a limiterless quick plan now asks for the bottleneck, so its assertions moved to the new text, and Q3b keeps the original assertions for a limiter-bearing plan.

### Counts

Every tests/test-363-*.cjs except live-smoke: 394 PASS, 4 FAIL. Per file: acceptance-diffusion 8, acceptance-whitespace 16, ambient 19, audit-ledger 6, baseline 8, cache 13, cli 23 (was 21, +C16 +C17), command-contract 9, corpus-honesty 19, evidence-rows 32, families 12, filing 52, grants 14, mcp-tool 16, part8-sweep 21, perspective 17, plan-schema 28, pyramid 21 (1 FAIL), run-deep 18, run-quick 20 (was 19, +Q3b), runner-contract 10, structure 12 (3 FAIL).

`bash tests/run-all-363.sh` final line: `PASSED=40 FAILED=3 SKIPPED=1 KNOWN=10` (exit 1). The 3 FAILED are the pyramid and structure suites below, not this work.

## Deferred: red suites that predate this work

`tests/test-363-pyramid.cjs` Y1 ("TEMPLATES has exactly the six ids", now sees `eureka`) and `tests/test-363-structure.cjs` B1, D3, B4 (the shipped research-shape ledger no longer equals a fresh build) are red on HEAD since merge `ebd9090cf` (SEED-103 Eureka perspective added an `eureka` template). Verified by running both suites in a detached worktree at `8d66997ec` (the RED commit, before any planner change here): the same 4 legs fail. They are outside this task and were not touched; the owner of SEED-103 or a separate quick task should update Y1 and regenerate the ledger.

## Deviations from Plan

None in approach. The offer text change in `runQuick` goes one step past the literal "escalate/cardFor" code-side ask, because the ruling says the offer itself must read "name what blocks this ...".

## Residual

- A researcher room that names a limiter still plans per-limiter lanes (363-20 isSR fix), so a researcher-room whitespace deep run never uses the lens lanes that W5 and W5b prove; the legs stay in a founder room.
- Only `no_nameable_limiter` gates. Missing forum roles, `paths_too_few` and an unquantified goal stay advisory outside scientific-roadmapping.

## Files

- lib/core/research-planner/plan.cjs, planner.cjs, quick.cjs; lib/mcp/tools/research.cjs
- commands/whitespace.md, commands/research.md, skills/whitespace/SKILL.md, skills/research/SKILL.md
- tests/test-363-cli.cjs, tests/test-363-run-quick.cjs
- .planning/phases/363-deep-research-planner-quick-and-deep-runs/363-FOLLOW-ONS.md (A5 updated)
