---
phase: 155-ignite-flow
plan: 03
subsystem: ignite-flow
tags: [user-md, setFocus-fix, writeUserMdAtomic, convergence, tdd]
dependency_graph:
  requires: [155-01]
  provides:
    - writeUserMdAtomic production callers (new-project.md + onboard.md)
    - setFocus arity fix in shallow-doc-parser.cjs (4-arg, valid setBy 'user')
    - emptyUser() 7-axis role_blend schema documented as the authority
    - /mos:profile-user stub replaced by honest deferred description
    - tests/test-user-md-convergence.cjs round-trip test
  affects:
    - lib/core/shallow-doc-parser.cjs
    - lib/core/user-md-ops.cjs
    - commands/new-project.md
    - commands/onboard.md
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN (one combined task)
    - static-grep arity check (asserting old 3-arg form absent)
    - opts.db optional guard for setFocus (graceful degradation preserved)
key_files:
  created:
    - tests/test-user-md-convergence.cjs
  modified:
    - lib/core/shallow-doc-parser.cjs (setFocus arity fix + opts.db guard)
    - lib/core/user-md-ops.cjs (production callers comment)
    - commands/new-project.md (Step 5 machine schema instruction)
    - commands/onboard.md (USER.md Generation machine schema instruction)
decisions:
  - "setBy 'user' chosen for upload-path focus: the user pasted the document, making it an explicit user-initiated focus change (not auto)"
  - "opts.db optional guard: extractShallow keeps zero-dependency graceful degradation; callers with a held db pass it in opts; callers without skip setFocus cleanly"
  - "journey_stage test uses slug 'crossing_threshold' (taxonomy enum slug, not the full Canon Part 2a label 'Crossing the Threshold')"
  - "production USER.md stub fix: mindrianOS/USER.md updated via Write (active room); pws-website and motj-ecosystem blocked by write-scope hook (different active room); remaining rooms documented as deviation"
metrics:
  duration: 6m
  completed: 2026-06-12
  tasks_completed: 1
  tasks_total: 1
  files_changed: 5
---

# Phase 155 Plan 03: USER.md Convergence + setFocus Arity Fix Summary

One-liner: Dead setFocus call in shallow-doc-parser.cjs fixed from 3-arg to 4-arg form with valid setBy 'user'; writeUserMdAtomic wired as the authoritative USER.md writer in both new-project.md and onboard.md; /mos:profile-user stub replaced by honest deferred description.

## Tasks

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 RED | Failing tests for convergence + arity fix | 5dbe3eb8 | COMPLETE |
| 1 GREEN | Fix setFocus + wire writeUserMdAtomic + stub replacement | 104bfca9 | COMPLETE |

## What Was Built

### setFocus Arity Fix (RESEARCH Pitfall 1, GAP-7)

`lib/core/shallow-doc-parser.cjs` line 149 called
`navigation.setFocus(sessionId, ventureNodeId, 'auto-from-upload')` -- 3 args
against the 4-arg surface `(db, sessionId, nodeId, setBy)` AND with an invalid
`setBy` not in `VALID_SET_BY`. The try/catch silently swallowed the error,
making the upload path's focus-set dead code.

Fix: replaced with `navigation.setFocus(opts.db, sessionId, ventureNodeId, 'user')`
guarded by `if (opts && opts.db)`. The function signature extended to
`extractShallow(text, sessionId, opts)` (backward-compatible; opts undefined =
same behavior as before minus the silent no-op). `console.warn` added on catch
so errors surface instead of being swallowed.

The setBy `'user'` is correct: the user pasted this document, making it an
explicit user-initiated focus change. `'auto-from-upload'` was never in
`VALID_SET_BY` (which holds: user, larry, auto-from-jtbd, auto-from-operator,
auto-from-state).

### writeUserMdAtomic Convergence (GAP-3)

`writeUserMdAtomic` had ZERO production callers before this plan (RESEARCH Atlas 3).
Both command surfaces now document the call:

**new-project.md Step 5:** Replaced the freeform prose USER.md template with a
machine-schema instruction specifying the `emptyUser()` 7-axis role_blend struct
as the authoritative zero-state, with canonical_role/role_blend/journey_stage/
first_seen fields. Includes the resolveByUser dependency note and the deferred
/mos:profile-user note.

**onboard.md USER.md Generation:** Replaced the divergent freeform schema (which
produced a plain Markdown USER.md incompatible with readUserMd's frontmatter
parser) with an identical writeUserMdAtomic call. Both surfaces now produce
schema-identical machine-readable USER.md files.

### user-md-ops.cjs Documentation

Added the production callers comment above `writeUserMdAtomic`:
- commands/new-project.md Step 5 (first production caller, Phase 155-03)
- commands/onboard.md USER.md Generation section (Phase 155-03)
- lib/core/navigation/room-birth.cjs STEP 1 (Phase 155-02)

No behavior change; function body unchanged.

### /mos:profile-user Stub Replacement

The stub text "Run /mos:profile-user to populate." replaced with the honest
deferred description: "USER.md is populated by writeUserMdAtomic at room birth.
To update your profile, re-run /mos:ignite or edit USER.md frontmatter directly.
The /mos:profile-user command is deferred to a successor phase."

See Deviations section for the write-scope limitation on non-active rooms.

### Round-Trip Test

`tests/test-user-md-convergence.cjs` (20 assertions):
- Tests 1a-1l: writeUserMdAtomic with 7-axis role_blend + canonical_role +
  journey_stage (slug 'crossing_threshold') round-trips via readUserMd with
  all fields intact including parse_failed:false
- Tests 2a-2b: user-authored body below frontmatter preserved byte-for-byte
- Test 3: static grep confirms old 3-arg setFocus(sessionId form absent
- Tests 4/4a/4b: VALID_SET_BY contains 'user', does not contain 'auto-from-upload'
- Tests 5-6: new-project.md and onboard.md contain 'writeUserMdAtomic'

## Verification Results

| Check | Result |
|-------|--------|
| node tests/test-user-md-convergence.cjs | 20/20 PASS |
| grep -c 'writeUserMdAtomic' commands/new-project.md | 4 (>= 1) PASS |
| grep -c 'writeUserMdAtomic' commands/onboard.md | 4 (>= 1) PASS |
| grep -c 'setFocus(sessionId' lib/core/shallow-doc-parser.cjs | 0 PASS |
| bash tests/run-all-155.sh | 2/2 PASS |
| bash tests/run-all-148.sh | 18/18 PASS |
| No em-dashes in modified files | PASS |

## Deviations from Plan

### Deviation 1 (taxonomy constraint -- auto-resolved): journey_stage slug form

The plan's test example used `journey_stage: 'Crossing the Threshold'` (the
human-readable Canon Part 2a label). The `readUserMd` parser validates
journey_stage against `taxonomy.JOURNEY_STAGES` which stores snake_case slugs
(e.g., 'crossing_threshold'). The test was updated to use the slug form so the
round-trip assertion passes. No code change needed -- this was a test data
correction, not a bug.

### Deviation 2 (write-scope limitation): /mos:profile-user stub in non-active rooms

The plan says to replace the stub in "three production rooms." There are 21
USER.md files in ~/MindrianRooms/ with the stub. The write-scope hook blocks
writes to rooms other than the active room (mindrianOS). The following were
fixed or attempted:

- mindrianOS/USER.md: FIXED (active room, Write succeeded)
- pws-website/USER.md: BLOCKED by write-scope hook
- motj-ecosystem/USER.md: BLOCKED by write-scope hook

The remaining 18 files are in rooms outside the current active scope. The
plugin-side changes to commands/new-project.md and commands/onboard.md ensure
all new rooms get the correct machine schema at birth. Existing stub rooms
can be fixed by: (a) switching rooms via /mos:rooms switch + running the fix,
or (b) running a future /mos:ignite pass that rewrites USER.md via
writeUserMdAtomic. This is documented as a known limitation, not a blocker
for the plan's must_haves (the three production-caller truths are satisfied).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes
at trust boundaries. The opts.db parameter to extractShallow accepts a caller-
supplied database handle -- the existing setFocus guard inside focus.cjs
validates that the nodeId already exists in the database (returns 'unknown_node'
if not), so no fabrication is possible via user-controlled ventureNodeId. The
claim is T-155-03-02 from the plan's threat model: mitigated by the existing
setFocus guard. No new threat flags.

## Self-Check: PASSED

Files exist:
- lib/core/shallow-doc-parser.cjs: FOUND
- lib/core/user-md-ops.cjs: FOUND
- commands/new-project.md: FOUND
- commands/onboard.md: FOUND
- tests/test-user-md-convergence.cjs: FOUND
- .planning/phases/155-ignite-flow/155-03-SUMMARY.md: FOUND

Commits exist:
- 5dbe3eb8: RED test commit
- 104bfca9: GREEN implementation commit
