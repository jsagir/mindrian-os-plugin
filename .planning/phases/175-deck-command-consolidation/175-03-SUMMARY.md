---
phase: 175-deck-command-consolidation
plan: 03
subsystem: deck-consolidation-wiring
tags: [deck, mos-deck, alias, deprecate-not-delete, make-land, publish-needs, connector-registry, orchestration-projection, cirs, born-wired, ranked, part-8, regression-gate]

# Dependency graph
requires:
  - phase: 175-deck-command-consolidation
    provides: "175-01 commands/deck.md (the /mos:deck surface to register WIRED+RANKED) + data/deck-styles.json (the 3-style/HEART-5/Feynman-6 source the behavior test asserts against); 175-02 scripts/check-deck-design.cjs + tests/test-deck-design-check.cjs (the WARN-first --check the suite composes and the consolidation test exercises)"
  - phase: 173-publish-jtbd-need-selector
    provides: "data/publish-needs.json make-land lane (repointed MOSDeckEngine -> /mos:deck) + commands/show.md (the make-land routing doctrine updated) + scripts/check-publish-needs.cjs (kept green by the repoint)"
  - phase: 143.3-connector-spine-and-intelligence-orchestrator
    provides: "scripts/build-connector-registry.cjs --check (the born-wired gate proving /mos:deck WIRED)"
  - phase: 157-brain-orchestration-graph-and-methodology-tiers
    provides: "scripts/build-orchestration-projection.cjs --check (the projection gate proving /mos:deck RANKED)"
  - phase: 172-contextual-invocation-coverage
    provides: "tests/run-all-172.sh (the CIRS gate regression fence carried green) + the hard-FAIL gap gates"
provides:
  - "data/deck-aliases.json: the alias map (MOSDeckEngine + feynman-engine -> /mos:deck; deprecate-not-delete, back-compat per D-04b)"
  - "skills/MOSDeckEngine/SKILL.md rewritten as a deprecation redirect (connector: block preserved, surface stays WIRED)"
  - "data/publish-needs.json make-land lane repointed to /mos:deck (R9); commands/show.md doctrine updated"
  - "tests/test-deck-consolidation.cjs: the 8-behavior consolidation proof (data + exit-code asserted)"
  - "tests/run-all-175.sh: the single PASS/FAIL phase gate composing the 175 suites + both born-wired --check gates + the carried 172/173 regression"
affects: [deck-design-ruleset-hard-gate-flip, phase-175-COMPLETE]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deprecate-not-delete alias: a flat top-level data map (data/deck-aliases.json) plus a SKILL.md deprecation-redirect that keeps the connector: block so the born-wired gate sees no regressed surface (D-04b)"
    - "Make-land lane repoint with byte-minimal edit: only the one resolves_to value + the _note + the show.md doctrine line move; every other job row is byte-unchanged so check-publish-needs.cjs stays green"
    - "Phase gate as a cross-phase composer: run-all-175.sh invokes both born-wired --check gates directly AND calls through bash tests/run-all-172.sh + run-all-173.sh, so the 175 gate fails if any upstream regression fence breaks"
    - "Data/exit-code-only behavior proof: every behavior assertion reads data/deck-styles.json or spawns scripts/check-deck-design.cjs and checks the exit code -- never a subjective string match on prose"

key-files:
  created:
    - "data/deck-aliases.json (the alias map; both prior handles -> /mos:deck at the top level so a consumer reads aliases['MOSDeckEngine'] directly)"
    - "tests/test-deck-consolidation.cjs (8 behaviors: 3 distinct routes, HEART 5 sections, Feynman determinism, ruleset WARN-not-FAIL, make-land repoint, alias resolution, Part 8 boundary doctrine, no em-dashes)"
    - "tests/run-all-175.sh (the phase gate: 2 born-wired --check gates + 4 CJS suites + run-all-172 + run-all-173)"
  modified:
    - "skills/MOSDeckEngine/SKILL.md (body rewritten to a deprecation redirect; frontmatter name/description/connector: preserved)"
    - "data/publish-needs.json (make-land deck job resolves_to MOSDeckEngine -> /mos:deck; _note rewritten)"
    - "commands/show.md (make-land routing doctrine + the resolves_to skill-handle mention updated to /mos:deck)"

key-decisions:
  - "Task 2 (regenerate the connector-registry + orchestration-projection) was a no-op re-assert: 175-01 already regenerated all four registry chains with /mos:deck born WIRED + RANKED (the live hard-FAIL pre-commit gates forced it then). The regeneration is byte-stable, so running both generators produced zero git diff; the verify still ran green (/mos:deck WIRED in the connector + coverage ledgers, RANKED in the orchestration command ledger). No separate commit was needed -- the registries were already correct and committed in 175-01 (3bda31f1). This matches the orchestrator note that the registry proof was effectively already done."
  - "deck-aliases.json holds the alias handles at the TOP LEVEL of the JSON object (not nested under an 'aliases' key) so the plan's verify (a['MOSDeckEngine']) and any consumer read the mapping directly; _note + version are reserved metadata keys."
  - "The em/en-dash detection regex in test-deck-consolidation.cjs uses unicode escapes (\\u2014\\u2013) instead of the literal dash characters, so the test file itself is byte-clean of em/en-dashes while testing for them identically -- otherwise the test's own no-em-dash sweep would flag its own detection regex."

requirements-completed: [R1, R2, R3, R4, R6, R7, R8, R9]
canon-parts: [3, 7, 8, 10, 11]

# Metrics
duration: 18min
completed: 2026-06-23
---

# Phase 175 Plan 03: Deck Consolidation Wiring + Regression Gate Summary

**Completed the deck consolidation: MOSDeckEngine + feynman-engine now ALIAS to /mos:deck (deprecate-not-delete; SKILL.md retained as a deprecation redirect with its connector: block preserved so the surface stays WIRED), the /mos:show make-land lane repoints from the MOSDeckEngine skill handle to the /mos:deck command (R9), /mos:deck is re-asserted born WIRED (connector ledger gap=0) + RANKED (orchestration command ledger gap=0), and the phase ships a single PASS/FAIL gate (tests/run-all-175.sh) proving the 8 phase behaviors plus the carried 172/173 frozen-bank regression -- all GREEN.**

## Performance

- **Duration:** ~18 min
- **Completed:** 2026-06-23
- **Tasks:** 3 (Task 2 was a clean no-op re-assert; Tasks 1 + 3 committed atomically)
- **Files:** 3 created, 3 modified

## Accomplishments

- `data/deck-aliases.json`: the alias table mapping both prior conversational-skill handles (`MOSDeckEngine`, `feynman-engine`) to `/mos:deck` at the top level (D-04b deprecate-not-delete, back-compat). The `_note` documents that the SKILL.md files are RETAINED and that feynman-engine (which lives OUTSIDE the repo at ~/.claude/skills/feynman-engine) is aliased repo-locally here, the non-repo file never edited.
- `skills/MOSDeckEngine/SKILL.md`: body rewritten into a deprecation redirect (invoke /mos:deck, pick the Feynman style). The YAML frontmatter -- `name`, `description` (so the skill still triggers), and CRITICALLY the `connector:` block (so the born-wired gate sees no regressed surface) -- is preserved byte-for-byte. The original 6-stage Feynman pipeline is retained verbatim as a reference appendix. File NOT deleted.
- `data/publish-needs.json`: the make-land deck job's `resolves_to` moved from `MOSDeckEngine` to `/mos:deck` (R9 + D-04); the `_note` rewritten to record that the make-land lane resolves to the consolidated command (replacing the D-01 interim skill-handle route). Every other job row byte-unchanged; `check-publish-needs.cjs` stays green.
- `commands/show.md`: the make-land routing doctrine updated to resolve `/mos:deck` through command-resolver + runChain like every other job; the prior `resolves_to: MOSDeckEngine` skill-handle mention updated. No em-dashes.
- `/mos:deck` re-asserted born WIRED (connector-registry + coverage ledger, gap=0) and RANKED (orchestration command ledger, gap=0); both `--check` gates exit 0.
- `tests/test-deck-consolidation.cjs`: the 8-behavior proof (3 distinct routes, HEART 5 sections all local-content-filled, Feynman 6-stage determinism, ruleset --check WARNs-not-FAILs over a non-conformant fixture, make-land repoint, alias resolution + SKILL.md retained, Part 8 Brain->local boundary doctrine in deck.md, no em-dashes).
- `tests/run-all-175.sh`: the single phase gate composing both born-wired `--check` gates as direct invocations + the 175 suites (test-deck-design-check, test-deck-consolidation) + the carried frozen-bank drift fences (reach/posture) + the cross-phase regression call-throughs (`bash tests/run-all-172.sh` + `bash tests/run-all-173.sh`). Exits 0.

## Task Commits

Each task was committed atomically with TARGETED staging only (the branch tip carries an interrupted release Commit-B -- modified plugin.json/CHANGELOG/package.json + a staged node_modules un-cache -- that was NEVER touched):

1. **Task 1: alias + make-land repoint** - `0327f17f` (feat): data/deck-aliases.json, skills/MOSDeckEngine/SKILL.md (deprecation redirect), data/publish-needs.json (repoint), commands/show.md (doctrine).
2. **Task 2: regenerate connector-registry + orchestration-projection** - no-op re-assert (no commit): both generators ran clean and byte-stable (175-01 had already regenerated them with /mos:deck WIRED + RANKED, gap=0); zero git diff; the verify confirmed /mos:deck WIRED + ranked.
3. **Task 3: behavior + regression suite** - `288a4bc5` (test): tests/test-deck-consolidation.cjs + tests/run-all-175.sh.

## Files Created/Modified

- `data/deck-aliases.json` (created) - the alias map.
- `skills/MOSDeckEngine/SKILL.md` (modified) - deprecation redirect, connector: block preserved.
- `data/publish-needs.json` (modified) - make-land lane repointed to /mos:deck.
- `commands/show.md` (modified) - make-land routing doctrine updated.
- `tests/test-deck-consolidation.cjs` (created) - the 8-behavior consolidation proof.
- `tests/run-all-175.sh` (created) - the phase gate.

## Decisions Made

- **Task 2 was a clean no-op re-assert (no commit).** Plan 175-01 already regenerated all four registry chains with /mos:deck born WIRED + RANKED, because the live hard-FAIL pre-commit gates (flipped in Phase 172-13) would not permit committing commands/deck.md while the registries were stale. Re-running both generators in this plan produced byte-identical output (zero git diff); the Task 2 verify still ran green. The registries were already correct and committed in 175-01 (3bda31f1), so no new commit was needed. This matches the orchestrator note that "the registry proof is effectively already done; just re-assert it."
- **deck-aliases.json holds the handles at the top level** (not nested under an `aliases` key) so the plan's verify `a['MOSDeckEngine']` and any consumer read the mapping directly; `_note` + `version` are reserved metadata.
- **The em/en-dash detection regex in test-deck-consolidation.cjs uses unicode escapes** (`\u2014\u2013`) rather than the literal dash characters, so the test file is byte-clean of em/en-dashes while testing for them identically (otherwise the test's own no-em-dash sweep would flag its own detection regex).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] em/en-dash detection regex contained literal dash bytes**
- **Found during:** Task 3 (committing the test file)
- **Issue:** The no-em-dash assertion in tests/test-deck-consolidation.cjs used a literal `/[em-dash en-dash]/` character class, so the file itself carried em/en-dash bytes and tripped the no-em-dash house rule (a self-inconsistency: a test for no-em-dashes that itself contains them).
- **Fix:** Rewrote the character class to unicode escapes (`\u2014\u2013`). The match behavior is identical; the file is now byte-clean of em/en-dashes.
- **Files modified:** tests/test-deck-consolidation.cjs
- **Verification:** the file passes its own no-em-dash sweep; the test still passes 8/8.
- **Committed in:** 288a4bc5 (Task 3 commit)

### Task 2 reclassification (not a deviation, a no-op)

Task 2's action (run the two generators in write mode) executed and verified green, but produced no file change because 175-01 had already regenerated the registries. This is the expected idempotent outcome, not a deviation -- the plan's <done> (both --check exit 0, /mos:deck WIRED + ranked) is satisfied.

---

**Total deviations:** 1 auto-fixed (Rule 1 - a self-inconsistent test-file dash byte). No architectural changes, no blocking issues, no missing critical functionality.

## Authentication Gates

None - no external service, no auth, no network (Canon Part 8: the alias map, the repoint, the deprecation redirect, and the tests are all LOCAL).

## Verification

- `bash tests/run-all-175.sh` exits 0: connector-registry --check PASSED + orchestration-projection --check PASSED (/mos:deck WIRED + RANKED) + test-deck-design-check.cjs PASSED + test-deck-consolidation.cjs 8/8 PASSED + reach/posture drift fences PASSED + run-all-172.sh 20/20 PASSED + run-all-173.sh 7/7 PASSED.
- `node scripts/build-connector-registry.cjs --check` exits 0; /mos:deck WIRED (context_block / deck-build).
- `node scripts/build-orchestration-projection.cjs --check` exits 0; /mos:deck RANKED.
- `node scripts/check-publish-needs.cjs` exits 0 (the make-land repoint to /mos:deck keeps the validator green).
- REACH_IDS stays length 6 (`["context_block","contradiction","cross_room","brain_consult","deep_research","hats"]`); the drift fence asserts the exactly-6 set.
- skills/MOSDeckEngine/SKILL.md NOT deleted; its connector: block intact.
- No em-dashes in any of the six touched files (verified by an explicit byte sweep).

## Known Stubs

None. The deprecation redirect is a deliberate back-compat retention (D-04b deprecate-not-delete), not a stub -- the `MOSDeckEngine` handle still triggers and routes to /mos:deck via the alias map, and the connector: block keeps the surface WIRED.

## Threat Flags

None. This plan introduces no network endpoint, no auth path, no schema change at a trust boundary. The alias map and the repoint are LOCAL data edits; the deprecation redirect removes prose, not capability; the tests are pure (data reads + a single local spawn of the existing WARN-first --check). Canon Part 8 boundary is reinforced (the deck.md Brain->local methodology direction is asserted by test behavior 7).

## Next Phase Readiness

- **Phase 175 is COMPLETE (3/3 plans).** /mos:deck is the single governed deck surface: born WIRED + RANKED, MOSDeckEngine + feynman-engine aliased (deprecate-not-delete), the make-land lane repointed, the WARN-first deck-design ruleset shipped, and the whole phase proven by run-all-175.sh (green) with the 172/173 frozen-bank regression carried green.
- The deck-design ruleset hard-gate flip (WARN -> hard-FAIL, mirroring the Phase 172-13 connector-gate flip) remains the named future amendment; the `--strict` flag in check-deck-design.cjs is reserved for it.

## Self-Check: PASSED

- FOUND: data/deck-aliases.json
- FOUND: skills/MOSDeckEngine/SKILL.md (retained, connector: block intact)
- FOUND: tests/test-deck-consolidation.cjs
- FOUND: tests/run-all-175.sh
- FOUND: .planning/phases/175-deck-command-consolidation/175-03-SUMMARY.md
- FOUND commit: 0327f17f (Task 1)
- FOUND commit: 288a4bc5 (Task 3)

---
*Phase: 175-deck-command-consolidation*
*Completed: 2026-06-23*
