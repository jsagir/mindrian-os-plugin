---
phase: 141-local-retrieval-spine-and-capability-dial
plan: 02
subsystem: larry-personality / capability-dial
tags: [LARRY-01, LARRY-02, LARRY-03, LARRY-04, DRSCH-doctrine, capability-dial, hierarchical-navigator, version-lockstep]
requires:
  - "141-01 RED test suites (test-reach-ids-drift.cjs, test-posture-ids-drift.cjs, test-capability-dial-committed.cjs)"
provides:
  - "Committed Capability Dial doctrine in HEAD with canon_parts frontmatter"
  - "5 stable machine-readable reach ids (frozen contract for Phase 143 dial-TUI)"
  - "3 stable machine-readable posture ids (frozen contract for Phase 143 SENS + Phase 144 NAV)"
  - "LARRY-04 Hierarchical Navigator doctrine (Usher division + Reach rule 7 arbitration)"
  - "1.13.1-beta.7 in-repo version lockstep (CHANGELOG + plugin.json + package.json)"
affects:
  - "skills/larry-personality/SKILL.md"
  - "Phase 143 (consumes reach ids + posture ids + MEMDIAL MD projection)"
  - "Phase 144 (NAV engine consumes posture ids)"
tech-stack:
  added: []
  patterns:
    - "Additive SKILL.md edit (preserve existing dial prose + DRSCH rows, D-07)"
    - "Exact-set adversarial drift test (code-span extraction, section-scoped)"
    - "In-repo version lockstep without git tag / marketplace (human-gated betas)"
key-files:
  created: []
  modified:
    - "skills/larry-personality/SKILL.md"
    - "tests/test-reach-ids-drift.cjs"
    - "tests/test-posture-ids-drift.cjs"
    - "CHANGELOG.md"
    - ".claude-plugin/plugin.json"
    - "package.json"
decisions:
  - "D-06 ordering honored: SKILL.md committed FIRST (06a944b8), before the version bump (5b475ccc), so the loseable working-tree edit landed safe before anything else moved."
  - "DRSCH ships as committed doctrine only (D-01): the deep-research 5th reach row + Reach rule 6 preserved exactly; no executable plumbing added."
  - "Rule 1 test fixes applied so the 141-01 drift suites are satisfiable (see Deviations)."
metrics:
  duration: ~12 minutes
  completed: 2026-06-05
  tasks: 2
  files: 6
  commits: 2
---

# Phase 141 Plan 02: Commit the Capability Dial First Summary

Committed the Capability Dial + LARRY-04 Hierarchical Navigator doctrine to HEAD with canon_parts frontmatter, 5 machine-readable reach ids, and 3 posture ids, then bumped the in-repo version lockstep to 1.13.1-beta.7 -- protecting the previously uncommitted dial edit per the D-06 hard ordering constraint.

## What Shipped

**Task 1 (commit 06a944b8) -- the dial + Navigator doctrine, committed FIRST:**
- Added `canon_parts: [Part 2, Part 3, Part 8, Part 9]` to the SKILL.md frontmatter (LARRY-01, D-04c).
- Added 5 machine-readable reach ids as a mapped block after the dial table: `context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research` (LARRY-03, D-05). The existing 5 prose reach rows and Reach rules 1-6 were preserved verbatim (D-07); the DRSCH 5th row + Reach rule 6 remain untouched doctrine (D-01).
- Added the LARRY-04 Hierarchical Navigator section, led by the Usher division (the tool owns Usher steps 1-2 = perceive + set the stage = the reach; the human owns steps 3-4 = the act of insight + critical revision). Encoded 3 posture ids `push_forward` / `hold` / `pull_back` as the bidirectional Usher traversal (D-11/12). Quotes Prof. Aronhime verbatim: "the insight belongs to you; the reach belongs to the tool", "reach matters more than raw intelligence", "restraint is the product working correctly".
- Appended Reach rule 7 (arbitration): the two dials are two dimensions of ONE decision cycle (CoALA), not two captains; reach precedes push; the user is the only helm (HIC + AITL); names the "Reasoning-Action Disconnect" anti-pattern; posture and filing never change silently (D-13).

**Task 2 (commit 5b475ccc) -- version lockstep:**
- New CHANGELOG.md top entry `## [1.13.1-beta.7] - 2026-06-05` naming the Capability Dial, the 5 reach ids, the 3 posture ids, the LARRY-04 doctrine, and Reach rule 7.
- `version` bumped to `1.13.1-beta.7` in `.claude-plugin/plugin.json` and `package.json` (in-repo lockstep).
- No git tag, no marketplace push -- both human-gated for betas per release-process.md.

## Verification

All three tests GREEN against HEAD:
- `tests/test-reach-ids-drift.cjs` -- exactly the 5 reach ids, no more no fewer.
- `tests/test-posture-ids-drift.cjs` -- exactly the 3 posture ids plus the two required Aronhime quote strings.
- `tests/test-capability-dial-committed.cjs` -- dial in HEAD + canon_parts frontmatter + DRSCH 5th row + Reach rule 6 + CHANGELOG beta.7 naming the dial + plugin.json/package.json both at beta.7.

D-06 ordering verified: `git log` shows SKILL.md (06a944b8) committed before the version bump (5b475ccc). `git show HEAD~1:skills/larry-personality/SKILL.md | grep -c "Capability Dial"` returns 1. No `v1.13.1-beta.7` tag exists (correct). Zero em-dashes in SKILL.md and in the new CHANGELOG entry (the 107 em-dashes counted in CHANGELOG.md are all in pre-existing older entries, not this entry).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] reach-id drift test could never match the `contradiction` id**
- **Found during:** Task 1 verification pre-flight.
- **Issue:** `tests/test-reach-ids-drift.cjs` (committed by 141-01) extracted reach ids with a regex that REQUIRED at least one underscore (`/`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g`), then compared the matched set against a canonical set that includes `contradiction` -- a single lowercase word with no underscore. The backtick span `` `contradiction` `` could never be captured, so the deepEqual against the 5-element canonical set was mathematically unsatisfiable. The test would have stayed RED no matter how the dial was authored.
- **Fix:** Broadened the dial-section regex to `/`([a-z][a-z0-9_]*)`/g` and kept a token only if it is in the canonical reach family OR is a snake_case drift candidate (mirrors the proven posture-id test pattern). This catches `contradiction` while still ignoring non-canonical prose words without underscores.
- **Files modified:** tests/test-reach-ids-drift.cjs
- **Commit:** 06a944b8

**2. [Rule 1 - Bug] posture-id drift test anchored on the wrong phrase and had no end bound**
- **Found during:** Task 1 verification pre-flight.
- **Issue:** `tests/test-posture-ids-drift.cjs` anchored with `src.indexOf('Hierarchical Navigator')`, which matches the FIRST occurrence of that phrase. The phrase legitimately appears earlier as a cross-reference inside Reach rule 7 ("see the Hierarchical Navigator"), so the scan sliced the wrong region (the dial reach-rules block) and found zero posture ids. Separately, the slice had no end bound, so backtick snake_case tokens from later sections (the Breakthrough Voice Scaffold auditor failure-mode ids: `evidence_requirement`, `mechanism_clause`, `no_unbacked_superlatives`, `time_anchor`) would have polluted the posture set.
- **Fix:** Anchored on the section HEADING via `/^##[^\n]*Hierarchical Navigator[^\n]*$/m` and bounded the section to the next `## ` heading (mirroring the reach-id test's dial-to-nav slice). The posture set now extracts to exactly `{hold, pull_back, push_forward}`.
- **Files modified:** tests/test-posture-ids-drift.cjs
- **Commit:** 06a944b8

Both fixes are scoped strictly to the test extraction logic; neither changes the canonical id sets, the quote assertions, the version assertions, or the doctrine being committed. The test fixes were staged in the Task 1 commit because they are required for Task 1's own verification gate to pass.

## Authentication Gates

None.

## Known Stubs

None. DRSCH ships as committed doctrine only by design (D-01); the 5th reach row and Reach rule 6 are tracked prose, not unfinished code. The deferred DRSCH executable plumbing and the MEMDIAL MD projection are documented future-phase scope (Phases 142/143), not stubs in this plan's surface.

## Self-Check: PASSED

- FOUND: skills/larry-personality/SKILL.md (Capability Dial in HEAD, count 1)
- FOUND: CHANGELOG.md (1.13.1-beta.7 top entry)
- FOUND: commit 06a944b8 (feat 141-02 dial + Navigator)
- FOUND: commit 5b475ccc (release 141-02 beta.7 bump)
- All 3 tests exit 0.
- No v1.13.1-beta.7 tag (correct; human-gated).
