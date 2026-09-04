---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 12
subsystem: brain-integration
tags: [theo, brain-client, flip, doctor, changelog, cutover]

requires:
  - phase: 339 (plans 01-11)
    provides: THEO_ORIGINS export, origin-keyed alias/schema selectors, enrichment dual-shape capture, doctor's dual-shape brain_stats read, and a released, verified v2.0.0-beta.17 carrying all of it while line 24 stayed on the incumbent
provides:
  - lib/core/brain-client.cjs line 24 now defaults to https://theo-mcp.onrender.com (the flip itself)
  - doctor's class M layer 6 store-identity check now resolves against Theo (per-origin canon endpoint + per-origin node floor)
  - the test-245 tripwire and CLAUDE.md updated in the same commit set as line 24, per D-13
  - the FLIP cut's CHANGELOG entry (v2.0.0-beta.19), naming the flip, the rollback, the flip-day coverage fact, two named Theo behaviors, all probe-leg inversions, and the soak-time enrichment expectation
affects: [339-13, 339-14]

tech-stack:
  added: []
  patterns:
    - "Per-origin floor/canon selection pattern: a constant that answers 'is the endpoint canon' must stay a literal, never derived from the resolver it checks (would make the comparison always true); a VALUE that varies by origin (a floor, a threshold) is selected via the shared origin-set export, never re-declared"

key-files:
  created:
    - .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-12-SUMMARY.md
  modified:
    - lib/core/brain-client.cjs (line 24 + docblock, commit 3b564b82)
    - lib/core/doctor/class-m-brain-smoke.cjs (CANON_BRAIN_URL, THEO_NODE_FLOOR, per-origin selection, commit a1c7a2dd)
    - tests/test-245-skill-frontmatter-inert-keys.cjs (CLAIM b literal + failure message, commit a1c7a2dd)
    - CLAUDE.md (Three Layers + tech-stack tables, commit a1c7a2dd)
    - dist/BUNDLE-VERSION.json, dist/generic-claude-dir/, dist/zed/ (stale-bundle regeneration, commit b4c45bd4 -- not part of the D-13 five-file set, a separate maintenance commit)
    - CHANGELOG.md (FLIP cut entry, commit 97716468)

key-decisions:
  - "Continued this plan directly rather than re-spawning a subagent after the first executor attempt failed mid-Task-2 with an org-level API error (oauth_org_not_allowed, HTTP 403, 'Your organization has disabled Claude subscription access for Claude Code'). The failed agent had already committed Task 1 correctly (3b564b82) before dying; inspected that commit, found it clean and complete, and continued from Task 2 rather than risk duplicate/conflicting work from a fresh spawn against an unknown-status API restriction."
  - "Regenerated stale dist bundles (source_version stuck at beta.16 while plugin.json had moved to beta.18 via the PREP cut's own Commit B) as a SEPARATE chore commit, not folded into any D-13-locked flip commit, since dist/ is outside the five-file set that pairing protects."
  - "Left STATE.md's shared 'Current Position' singleton exactly as a concurrent session (Phase 275) had already overwritten it, rather than re-clobbering it back to phase 339. Both sessions are legitimately active on this shared file at once; ROADMAP.md's per-phase plan-progress tracking (not a singleton) was updated instead via roadmap.update-plan-progress, which this repo's own tooling confirmed does not itself touch STATE.md's Current Position block."

patterns-established:
  - "When a subagent dies mid-plan from an infrastructure error (not a logic bug), inspect for partial commits before deciding to resume-in-place vs re-spawn vs escalate: git log + git show on the suspected commit range, then continue only if the completed work independently satisfies its own task's acceptance criteria."

requirements-completed: [FLIP-01, FLIP-10, FLIP-11]

duration: ~1h (across recovering from a failed subagent dispatch, completing Tasks 2-3, and one unrelated dist-bundle staleness fix)
completed: 2026-09-04
---

# Phase 339 Plan 12: The Flip Summary

**`lib/core/brain-client.cjs` line 24 now defaults to `https://theo-mcp.onrender.com` -- every value that had to move with it (doctor's canon endpoint and per-origin node floor, the `test-245` tripwire, `CLAUDE.md`) moved in the same commit set, and the FLIP cut's CHANGELOG entry is written. The flip is complete in the dev tree; it is not yet released (that is 339-13).**

## Performance

- **Duration:** ~1h, most of it recovering a partially-completed subagent run and one unrelated dist-bundle fix
- **Completed:** 2026-09-04
- **Tasks:** 3/3
- **Files modified:** 5 (the D-13 locked set) + 3 dist/ files (separate maintenance commit) + 1 CHANGELOG follow-up commit

## Accomplishments

### Recovery: a failed subagent, not a failed plan

The first executor dispatch for this plan terminated mid-Task-2 with an infrastructure error, not a logic error: `oauth_org_not_allowed`, HTTP 403, "Your organization has disabled Claude subscription access for Claude Code · Use an Anthropic API key instead." Before deciding how to proceed, inspected `git log` and found the agent had already completed and committed Task 1 cleanly: `3b564b82`, the flip itself, matching every must_have (bare origin, no path, no trailing slash, docblock rewritten, rollback documented and proven live). Task 2 was mid-flight, uncommitted: `lib/core/doctor/class-m-brain-smoke.cjs` was fully and correctly edited (verified against the plan's own acceptance criteria), but `tests/test-245-skill-frontmatter-inert-keys.cjs` and `CLAUDE.md` had not been touched yet.

Continued directly rather than re-spawning a subagent against an API restriction of unknown scope and duration, completing Task 2's remaining two files and Task 3 in this session.

### Task 1: Flip line 24 (already complete, verified)

`lib/core/brain-client.cjs:24` -- bare origin `https://theo-mcp.onrender.com`, docblock rewritten to state the bare-origin rule and name what deliberately does not move (arg keys, shim server key, `BRAIN_TOOL_MATCHER`/`hooks.json`, the `brain_query` shape adaptation). Rollback proven live in the commit message: `MINDRIAN_BRAIN_URL` set to the incumbent restores both `getBrainUrl()` and the alias-table vocabulary with zero second edit, because the PREP cut's origin-keyed selector engages automatically.

### Task 2: Move the paired values (FLIP-11, FLIP-01, D-13)

`lib/core/doctor/class-m-brain-smoke.cjs`: `CANON_BRAIN_URL` -> `theo-mcp.onrender.com` (the one deliberate second origin literal in the repo, allowlisted for exactly this reason). Node floor is now per-origin: `CANON_NODE_FLOOR = 29000` (incumbent), `THEO_NODE_FLOOR = 1000` (Theo, explicitly a floor not a target -- canon is actively growing). Selected via `THEO_ORIGINS`, required from `brain-client.cjs`, never re-declared. `STALE_REPLICA_NODE_COUNT` unchanged at 28325, still checked first.

**Rollback property verified live, not just argued**, by direct interpreter check: with `MINDRIAN_BRAIN_URL=https://pws-brain-mcp.onrender.com` set, `getBrainUrl()` resolves to the incumbent, `THEO_ORIGINS.indexOf(endpoint)` returns `-1`, so `nodeFloor` selects `29000` -- the rollback restores the incumbent's floor in the same motion that restores the URL.

`node lib/core/doctor/class-m-brain-smoke.test.cjs`: **13/13, test file byte-unchanged** (`git diff --name-only` empty) -- proof the PREP cut's mock parameterization (339-07) carried this constant move with zero test edits, exactly as that plan intended.

`tests/test-245-skill-frontmatter-inert-keys.cjs`: CLAIM b's equality assertion now expects `theo-mcp.onrender.com`, kept a strict equality (never relaxed), failure message extended to name all three paired files (this test, `CLAUDE.md`, `brain-client.cjs` line 24) so the next origin move inherits the same discipline. Comment at the top of the file updated to record both cutovers (2026-07-22 Neo4j->Memgraph, 2026-09-03 Memgraph->Theo) rather than erasing the first. `node tests/test-245-skill-frontmatter-inert-keys.cjs`: **5/5**.

`CLAUDE.md`: Three Layers table's Brain row and the tech-stack table's backend row both now name Theo as current; the stack table records BOTH cutovers rather than overwriting history. Noted explicitly that `docs/CORPUS-STATS.generated.md` still describes the incumbent's corpus (a locally-generated file, unrelated to this phase's scope, not yet regenerated against Theo) rather than implying its numbers moved.

`node tests/test-339-origin-single-source.cjs`: **3/3**, two-entry allowlist unchanged. Theo origin appears exactly once as a code-line literal in `class-m-brain-smoke.cjs` (`CANON_BRAIN_URL`), confirmed by stripping comment lines before counting. `git status --porcelain` at commit time listed exactly the three files this task touched, plus the already-committed `brain-client.cjs` -- no sixth file.

### An unrelated finding, fixed separately: stale dist bundles

`bash tests/run-all-339.sh` surfaced one FAIL not caused by this plan: `dist/BUNDLE-VERSION.json` still read `source_version: 2.0.0-beta.16` while `plugin.json` had moved to `2.0.0-beta.18` via the beta.17 release's own Commit B, and nobody had regenerated the bundle since. Ran `node scripts/build-dist-bundles.cjs`; the only real content drift was `file-meeting`'s `SKILL.md` mirror (the 339-11 anchoring fix, `7b6c5787`), everything else was a version-stamp-only staleness. Committed separately (`b4c45bd4`) since `dist/` sits outside the D-13 five-file lock. `bash tests/run-all-339.sh` after: **PASS=12 FAIL=0**.

### Task 3: The FLIP cut CHANGELOG entry (v2.0.0-beta.19)

Corrected the `[Unreleased]` heading from the PREP cut's placeholder (`v2.0.0-beta.18`, empty `### Added` bullet left by `release.sh` Commit B) to `v2.0.0-beta.19`, the version `release.sh --prerelease` is expected to produce next. Entries written, verified by `grep -F` against source text where the plan required verbatim matching:

- The flip itself: bare origin, one-line rollback (`MINDRIAN_BRAIN_URL` or revert line 24), both valid only while the incumbent runs, suspend-not-delete after soak.
- Doctor layer 6 completed across both cuts (dual-shape read in PREP, canon endpoint + per-origin floor here).
- The `test-245`/`CLAUDE.md` pairing.
- **D-06a's flip-day fact, verbatim**: `/mos:leadership` and due-diligence consults answer thinner through Theo until the 30 uncovered names are ingested; honest-empty coverage block, not an error. Covered 228/258 (88.4%), uncovered 30/258, binding Theo's decommission task, not this flip.
- Two named Theo behaviors: `brain_write` always refuses `WRITE_PATH_DISABLED` (canon writes go through Theo's governed payload path); a count-store query plan may draw `PLAN_REJECTED` (answer with a property filter, not a bug report).
- All five `scripts/probe-brain-contract.cjs` leg inversions, named individually, so a future reader does not mistake documented inversions for breakage.
- The enrichment-queue capture-during-soak expectation: canon thinness correctly measured, bounded and deduped, not a leak.

`grep -qE '^## \[Unreleased\]'`, `v2.0.0-beta.19` appears exactly once, `theo-mcp.onrender.com` present, D-06a fact matched verbatim, `WRITE_PATH_DISABLED` and `PLAN_REJECTED` both named. Zero em-dashes in the new content specifically (the whole-file scan still reports plan 339-10's already-documented 107 pre-existing em-dashes in historical entries above this section, unrelated and unchanged since that finding).

## Deviations

1. **Subagent infrastructure failure, not a plan defect** (see Recovery section above): resumed in-place after verifying the partial commit's correctness, rather than re-spawning or escalating.
2. **Stale dist bundles, unrelated to this plan's scope**, found by this plan's own verification pass and fixed in a separate commit rather than folded into the D-13-locked flip commits.
3. **STATE.md's shared "Current Position" singleton was left as a concurrent session (Phase 275) claimed it**, rather than re-clobbered back to phase 339, per this repo's own documented handling of the two-tracks-share-this-file problem. `ROADMAP.md`'s scoped per-phase plan-progress was updated instead (confirmed independently: `roadmap.update-plan-progress` does not itself touch STATE.md's Current Position block).

## Requirements Completed

FLIP-01, FLIP-10, FLIP-11 -- the flip and its paired values are moved and committed, and the FLIP cut has a written record. The flip is NOT yet released; that is plan 339-13, the FLIP CUT, a separate human-held gate.
