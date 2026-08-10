# Deferred Items - Phase 248-01 / 248-02

## scripts/on-stop line-budget overage (pre-existing, out of scope)

`tests/test-198-adapter-budget.test.cjs` fails on `checkAdapterBudget()`:
`scripts/on-stop` is 618 lines against a budget of 570. `scripts/on-stop` was
never touched by any 248-01 task (confirmed via `git log --oneline -- scripts/on-stop`,
last modified by 241-05/240.1-03/241-02 commits, all pre-dating this phase).
Per the executor scope boundary (fix only what the current task's changes
directly cause), this is logged here rather than fixed. Not blocking Phase
248-01's success criteria: none of CTX-01/CTX-02's must_haves or verification
commands reference this test.

## `doctor --acceptance` install-state / version-of-record-published (pre-existing, out of scope)

Ran `node scripts/doctor.cjs --acceptance` after 248-02 Task 2 (all Phase 248
verification green, tree clean, no drift): 14/16 acceptance points pass. The
two failures are both pre-existing release-lockstep drift, unrelated to room
resolution:

- `install-state`: the install-state record says `1.16.0-beta.7`;
  `installed_plugins.json` says `1.16.0-beta.13`. Fix is `re-run session-start`,
  not a code change this phase's files touch.
- `version-of-record-published`: marketplace `source.ref` is pinned to
  `v1.16.0-beta.13`; the acceptance check expected `v1.16.0-beta.11`.

Neither file (`~/.mindrian/install-state.json`,
`~/mindrian-marketplace/.claude-plugin/marketplace.json`) was created or
modified by any 248-01/248-02 task, and the phase constraint is explicit:
**no version bumps**. Confirmed with a clean-tree re-run of the SAME command
before this phase's own commits landed vs. after: the ONLY delta between the
13/16 and 14/16 runs was `verify-release-clean-tree` flipping PASS once the
in-progress working tree was committed -- these two version-lockstep
failures were present in both runs, byte-identically. Logged here rather
than fixed, per the executor scope boundary.
