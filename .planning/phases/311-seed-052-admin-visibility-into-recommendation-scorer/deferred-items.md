# Deferred Items - Phase 311 (SEED-052 smallest slice)

Out-of-scope discoveries found during execution, logged per the executor's
scope-boundary rule (fix only what this task's own changes caused).

## `lib/memory/command-registry.test.cjs` fails on `/mos:deck` kind value

- **Found during:** Task 3 phase-level verification (`node lib/memory/command-registry.test.cjs`).
- **Failure:** `AssertionError: kind is one of methodology|utility|meta: /mos:deck -> mechanical`.
- **Root cause:** `commands/deck.md` frontmatter declares `kind: mechanical`, a value
  outside the three-value enum this test asserts. This predates Phase 311 entirely --
  confirmed via `git show f93e779e~1:data/command-registry.json`, the registry state
  immediately before Phase 311's Task 1 commit, already carried `"kind": "mechanical"`
  for `/mos:deck`. Last touched by commit `fa2f1414` (fix(267.3): declare
  interactive_first_reward for 17 commands and land Phase 271-03's held anchoring),
  unrelated to this phase.
- **Why deferred, not fixed:** Phase 311's `files_modified` list does not include
  `commands/deck.md` or the `kind` enum/derivation logic anywhere in
  `scripts/build-command-registry.cjs`. Fixing it here would exceed this task's scope
  boundary (only fix issues directly caused by this task's own changes). This phase's
  `visibility` field addition does not touch `kind` at all.
- **Action needed:** a future session should either widen the `kind` enum this test
  asserts to include `mechanical` (if that is a legitimate value), or correct
  `commands/deck.md`'s frontmatter to one of `methodology|utility|meta` (if
  `mechanical` was a typo/drift). Not adjudicated here -- out of this phase's scope.
