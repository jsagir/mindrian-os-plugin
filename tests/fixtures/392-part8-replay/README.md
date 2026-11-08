# Part 8 replay matrices (Phase 392, plan 392-01)

This folder holds the recorded refusal matrices of the Part 8 egress guard. A matrix is COUNTS ONLY: verdicts by set, group, tool, class and token class, plus `extended_blocked` and `must_refuse_blocked`. No probe text, no room word, no room file name, no credential shape and no Brain identifier is stored here. `assertMatrixHygiene` in tests/helpers/part8-overblock-replay.cjs refuses a string longer than 40 characters, a key named question, text, cypher, query, statement, payload or snippet, and any string that matches CREDENTIAL_SHAPES (lib/core/cross-room-aggregator.cjs); the harness runs it before every write and tests/test-392-replay-harness.cjs (RH6) runs it again on the committed file.

Files:

- baseline-beta81.json: the matrix of the v2.0.0-beta.81 guard (`guard_head` 8455416a5, the tag commit), recorded before any Phase 392 guard change. `recorded_head` is the branch commit the harness ran on (docs and test commits only after the tag; `git log v2.0.0-beta.81..HEAD -- lib/core/part8-*` was empty). The fixture rows (694) and the local real-call rows (126, set R) share the matrix.
- ../386-audit-probes: the 694 probe cases this matrix counts (see its README).

## How to record a matrix

```
node tests/helpers/part8-overblock-replay.cjs --record <out.json> \
  [--real-calls "$HOME/.mindrian/part8-replay/real-calls.jsonl"] [--labels <json>] \
  [--guard-head <sha>] [--note <text>]
```

The command uses a temporary HOME and synthetic rooms, counts network attempts (the count must stay 0) and writes counts only. Never overwrite baseline-beta81.json; the harness refuses to overwrite a `baseline-*` file without `--force`. A later matrix gets its own name (for example after-392-P1.json) so before and after stay side by side. Plan 392-09 compares its matrix against this one.

The real-call sample comes from `node scripts/part8-real-calls-extract.cjs` (default output $HOME/.mindrian/part8-replay/real-calls.jsonl, outside the repository; an --out path inside the repository exits 2). Its lines hold the tool input, so the file never enters the repository. The owner labels the unique inputs (legitimate, not, unknown) in a labels file keyed by the sha256 of the canonical input JSON; until then every real-call row counts as unknown.

## The numbers and their sources

The audit baseline (tests/fixtures/386-audit-probes/baseline-before.json, guard commit f0df97036, before plans 386-25, 386-28, 386-31 and 386-33):

- corpora (set C): 573 allow, 83 block
- extended group: 498 allow, 37 block (36 by the name rule as class room_content, 1 as content_set)
- must_refuse group: 10 block of 10

The beta.81 matrix (baseline-beta81.json, guard 8455416a5, recorded 2026-11-08):

- corpora (set C): 606 allow, 50 block
- extended group: 527 allow, 8 block (all 8 as class sprouts_required, token class edge_rule)
- must_refuse group: 10 block of 10
- P set: 5 allow, 10 block; ADV set: 4 allow, 19 block
- real calls (set R, 126 blocks, 87 unique inputs, all unlabelled): 115 allow, 2 ambiguous, 9 block
- by tool: brain_ask 668 allow / 2 ambiguous / 83 block; brain_query 43 / 0 / 2; brain_search 8 / 0 / 0; brain_write 0 / 0 / 3; brain_schema 6 allow; brain_stats 4 allow; normalize_framework_name 1 allow
- network_calls 0

Why the extended count moved from 37 to 8: plan 386-33 (commit 93b785273, "sprouts pass, bodies and private claims get sprouts_required") landed between f0df97036 and the tag. Of the 36 name-rule blocks, 28 became allow (generic_question) and 8 became sprouts_required (edge_rule); the 1 content_set block became allow. Plans 386-25 (typed read arms), 386-28 (job key), 386-31 (credential shapes) and 386-46 (obfuscated email, international phone) explain the other 63 of the 100 changed rows (P, ADV, negatives, violation, 354-private, known_leaks). The replay of both trees with the same harness produced these counts; the per-row diff is not committed because rows carry case ids.

The target of this phase (392-CONTEXT.md F7, success criterion 1): the new shape rule must refuse fewer legitimate extended questions than the audit's 37 of 535, and the beta.81 figure to beat on this tree is 8 of 535; must_refuse stays 10 of 10. Plan 392-09 asserts both against its own matrix.

## Anchored lines

fixture_cases: 694
real_call_blocks: 126
real_call_unique_inputs: 87
audit_baseline_commit: f0df97036
audit_corpora: 573 allow, 83 block
audit_extended_blocked: 37 of 535
beta81_guard_head: 8455416a5
beta81_corpora: 606 allow, 50 block
beta81_extended_blocked: 8 of 535
beta81_must_refuse_blocked: 10 of 10
beta81_real_calls: 115 allow, 2 ambiguous, 9 block
network_calls: 0
