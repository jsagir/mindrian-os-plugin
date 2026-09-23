# Phase 361: Deferred out-of-scope items

Findings observed during a plan's execution that are out of that plan's own
scope boundary (pre-existing, or owned by another plan). Logged, not fixed.

## From 361-04 execution (2026-09-23)

- **361-03-SUMMARY.md carries 3 literal em-dash characters.** Confirmed
  present at commit `a7cbf3cfb` (361-03's own completion commit), before any
  361-04 edit landed. Out of 361-04's scope (361-04 touched
  `agents/dominant-design-researcher.md`, `tests/test-361-agent-contract.cjs`,
  and the regenerated ledgers only; it never touched this file). Not fixed
  here per the scope-boundary rule. `tests/run-all-361.sh`'s em-dash guard
  already flags this file by name in its `PHASE_361_SURFACES`/glob list, so
  the aggregator surfaces it on every run until a plan that owns
  `361-03-SUMMARY.md` fixes it.

- **`tests/test-209-declared-implies-wired.cjs` fails (pre-existing peer
  drift, not caused by 361-04).** The test's hardcoded
  `KNOWN_CONTRADICTION_SURFACES` allowlist still names
  `commands/brain-derive.md` and `skills/brain-derive/SKILL.md`, but a peer
  session has already fixed both files' hitl_shape-and-excluded contradiction
  (they no longer appear in the live `checkTree()` violation list). 361-04
  never touched either file. This matches the class of known pre-existing
  peer failure named in this session's sequential-execution instructions
  (`tests/test-209-declared-implies-wired.cjs`); classified, not fixed here.
  Whichever session most recently landed the `brain-derive` fix (or the next
  session to touch `test-209`) should update the allowlist.
