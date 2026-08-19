# Deferred items -- quick task 260819-c8j

Out-of-scope discoveries logged per the executor's SCOPE BOUNDARY rule
(pre-existing failures in files this plan does not touch). Not fixed here.

## 1. `bash tests/run-all-122.sh` -- 3 pre-existing RED suites, unrelated to c8j

The plan's Task 2 verification list names `bash tests/run-all-122.sh`. Running
it surfaced 4 failing suites; ONE (`../lib/memory/chain-recommender.test.cjs`)
was a genuine regression this task introduced (a doctrine comment containing
the literal string `/mos:diagnose`, tripping the file's own Canon Part 8
"no command literal anywhere in source, including comments" grep test) --
that one was fixed inline (Rule 1) before commit.

The remaining 3 are pre-existing, in files this plan's `files_modified` list
does not include, and unrelated to the `recommend_chain` / Part 8 belt /
companion-consumer work:

- `test-command-registry.cjs`: `AssertionError: kind is one of
  methodology|utility|meta: /mos:deck -> mechanical` -- a `data/command-
  registry.json` classification mismatch for the `/mos:deck` command's `kind`
  field. Not touched by this plan.
- `../lib/memory/suggest-next-workflow.test.cjs`: `AssertionError: Six
  Thinking Hats resolves to /mos:hat-briefing first; got:
  ["/mos:bono","/mos:hat-briefing","/mos:persona","/mos:think-hats"]` -- a
  command-ordering expectation against `data/command-registry.json` for the
  Six Thinking Hats framework. Not touched by this plan.
- `../lib/memory/workflow-layer-e2e.test.cjs`: `AssertionError: build-
  command-registry.cjs must contain no write-Cypher` -- the test's own regex
  (`/\b(CREATE|MERGE|SET|DELETE|DETACH)\s/i`) has no negative lookahead for
  ordinary English, so it false-positives on the word "set" appearing in
  `scripts/build-command-registry.cjs` (5 occurrences, none of them Cypher).
  A pre-existing test-authoring bug, not touched by this plan.

`tests/run-all-122.sh`'s own header claims all four owning plans (122-02
through 122-05) have landed and these suites should be GREEN. That claim is
currently false for 3 of the 4 listed suites, independent of this quick task.
Recommend a follow-up quick task to re-sync `data/command-registry.json`
against `suggest-next-workflow.test.cjs` / `test-command-registry.cjs`'s
expectations, and to tighten `workflow-layer-e2e.test.cjs`'s write-Cypher
regex (e.g. require a Cypher-shaped context, not a bare keyword).

## 2. Plan verify command references a nonexistent test file

Task 1's `<verify>` list names `node tests/test-249-brain-egress.cjs`. No
file by that name exists in `tests/` and `git log --all` shows no history for
it either -- it appears to be a planning-time typo/hallucination, not a file
that was renamed or deleted after the plan was written. The Part-8 egress
suites that DO exist and DO cover callTool's belt were run instead:
`test-249-capture-seam.cjs`, `test-245-egress-contentless.cjs`,
`test-239-query-egress-canary.cjs`, `test-247-brain-client-403.cjs`,
`test-252-guard-census.cjs` -- all green.
