---
quick_id: 261128-269-moat05
lane: 269
branch: fix/269-moat05
base: stage/400.5-405 at 85f436089
kind: rca
status: done
---

# 261128-269-moat05: re-pin the MOAT-05 anchor of tests/269-doctrine-reconcile.test.cjs

## Symptom

`node tests/269-doctrine-reconcile.test.cjs` failed 1 of 6 subtests (exit 1). Leg MOAT-05 asserted that `bin/cli.js` contains the string `Optional -- connect the Brain for enriched intelligence:`.

## Root cause (PROVEN)

- `git log -S` on the anchor string in `bin/cli.js` names 2 commits: cf16d85e6 added the string, a2126a394 removed it.
- Commit a2126a394 is quick 261005-l8g, "no key on the Theo path" (SEED-119). It removed the 4 printed Brain-key lines from the install output on purpose and wrote the accepted comment text `Theo needs no key, so there is nothing left to configure after the install.`
- The test file has one commit only (abfd3298d, 269-01), older than a2126a394. Nobody updated the test when the key ceremony left the CLI.
- Anchor present at the parent of a2126a394: yes. Anchor present at origin/main 88c8306e7, at the F1 merge 4314d335a and at the lane tip 85f436089: no (checked with `git show <rev>:bin/cli.js | grep -c`). All 3 revisions contain a2126a394. The test was red at all 3.

Verdict: the product text moved on purpose. The test was stale. No doctrine statement was removed by accident, so `bin/cli.js` does not change.

## Fix

The MOAT-05 assertion now pins the accepted text `Theo needs no key, so there is nothing` (present at all 3 revisions, accepted by a2126a394). No assertion was removed: the `lib/core/entitlement.cjs` absence check stays, and the CLI string check stays with a new anchor. The test title, the header comment and the failure message now say that the CLI carries no key ceremony and name quick 261005-l8g.

## OR-47 points

1. What a top professional would also do: find the commit that removed the anchor before the edit, and pin to text that the removing commit accepted, not to a new guess.
2. The rawest material: `git log -S` output, `git show a2126a394 -- bin/cli.js`, and the test run at 3 revisions.
3. Methods and tools: git pickaxe search, `git merge-base --is-ancestor`, the node test runner with a temp HOME and the Brain address at a closed port.
4. Outside evidence: the diff of a2126a394 shows the deleted lines and the added accepted text; the test passes 6 of 6 after the pin.

## Gate (PROVEN, temp HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_BRAIN_URL=http://127.0.0.1:9)

| Command | Result |
|---|---|
| node tests/269-doctrine-reconcile.test.cjs | exit 0, pass 6, fail 0 |
| bash tests/run-all-261127-bnd.sh | exit 0, PASS=79 FAIL=0 |
| bash tests/run-all-402.sh | exit 0, PASS=26 FAIL=0 SKIP=0 |
| bash tests/run-all-401.sh | exit 0, PASSED=4 FAILED=0 |
| bash tests/run-all-357.sh | exit 0, PASS=16 FAIL=0 SKIP=0 |
| node scripts/run-harness.cjs --check | exit 0, 12 pass, 0 fail, 2 ghost, 5 declared, 19 total |

## Other reds (not in scope, not fixed, different cause)

- tests/test-260906-fda-known-tool-shapes.cjs Arm B: FAIL, the find_connections shape under the wrong tool name `find_bottlenecks` gets verdict `allow` (class generic_question). Cause ASSUMED: the Part 8 guard classifies the strings as generic before it checks the tool name to shape match; last guard change is 5740fbcaf (261118-x1g). UNVERIFIED.
- scripts/backfill-hitl-shape.cjs --check: FAIL, 7 skills lack the shape declaration (client-discovery-interview, mullins-scaffold, trending-to-absurd, conversation-mode, intelligence-orchestrator, room-proactive, larry-personality). Cause ASSUMED: recent skill rewrites (401-f1, 400-03) changed frontmatter without a backfill run. UNVERIFIED.
- tests/test-130-lens-engine-e2e.cjs: FAIL in 5 E2E cases. The zero-leak gate sees a read of `<HOME>/.mindrian/persona-override.json` during rotate. Cause ASSUMED: the persona-override store from dcf9450cc (t2k-1) is read in the rotate path, and the gate allow list holds only USER.md. UNVERIFIED.
