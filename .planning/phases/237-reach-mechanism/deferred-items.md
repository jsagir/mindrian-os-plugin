# Phase 237 - Deferred Items (out of scope for the executing plan)

## 1. Pre-existing FAIL in `tests/test-act-on-runchain.cjs` (found during 237-01)

**Found during:** Plan 237-01, Task 1 (wiring the three regression legs into `tests/run-all-237.sh`).

**Observation:** `node tests/test-act-on-runchain.cjs` fails on a clean tree with zero Phase 237
changes applied (reproduced against a stashed working tree at commit `045bf132`, before this
plan touched anything). The assertion at line 122-124 compares the rendered gated-halt card
against a hardcoded baseline string; the baseline predates the `FIRE-IF-FORK` block that
`lib/hmi/selector-dispatcher.cjs` (SEED-021, Phase 210 era) now injects into every rendered
gate card. The actual render is correct and current; the test's expected baseline is stale.

**Scope decision:** `lib/hmi/selector-dispatcher.cjs` and `tests/test-act-on-runchain.cjs` are
NOT in 237-01-PLAN.md's `files_modified` list (`tests/run-all-237.sh`,
`tests/test-198-local-only.test.cjs` only) and are unrelated to REACH-01/02/03. Per the
executor SCOPE BOUNDARY rule, this is a pre-existing, out-of-scope failure and is NOT
auto-fixed here.

**Effect on 237-01:** `tests/run-all-237.sh` wires this file as a plain `run` regression leg
per 237-01-PLAN.md Task 1 (the file already exists today, so `run_if` would be dishonest). The
leg genuinely FAILS, so the aggregator's observed Wave-0 output is `Passed: 2 Failed: 1
Skipped: 9` (Task 1) / `Passed: 5 Failed: 1 Skipped: 9` (Task 2), not the `Failed: 0` the plan
assumed. This is documented as a deviation in `237-01-SUMMARY.md` rather than silently patched:
the aggregator reporting a real, previously-invisible failure honestly is the entire point of
this phase (per 237-01-PLAN.md's own objective: "the whole v1.16.0 milestone exists because
gates that could not fail were reading green").

**Recommended follow-up:** a future plan (or a `/gsd-quick` fix) should update
`tests/test-act-on-runchain.cjs`'s expected baseline string to include the current
`FIRE-IF-FORK` block, or make the assertion tolerant of that block, so the regression leg
returns to a real PASS. Not claimed as fixed here.

## 2. Plan 237-05 BLOCKED -- pre-commit's Phase 118-06 guardian scans all of `commands/`, not just staged files (found 2026-07-28/29)

**Found during:** Plan 237-05, Task 1 (build-time `executable` frontmatter join). Task 1's
implementation is complete and independently verified (all acceptance criteria green:
`build-connector-registry.cjs --check`, `build-orchestration-projection.cjs --check`,
`check-render-coverage.cjs`, `check-shape-declaration.cjs --check`, the registry assertions,
`test-237-autonomy-parity.cjs` 5/5, zero em-dashes) but is **not committed**. Preserved in
`git stash` (`237-05 Task 1 (verified, uncommitted) -- ...`) rather than discarded.

**Observation:** `scripts/hooks/pre-commit`'s Phase 118-06 reward-before-investment guardian
(`scripts/check-reward-before-investment.cjs`) fires whenever any staged `commands/*.md`
changes, but scans the **entire** `commands/` directory rather than only staged files. 103 of
112 commands (including `commands/snapshot.md` itself, confirmed via
`git show HEAD:commands/snapshot.md | grep -c interactive_first_reward` = 0, i.e. it never had
the field) already lack `interactive_first_reward` -- a pre-existing, repo-wide gap this plan's
change neither introduces nor touches. The plan's own `files_modified` list requires editing
`commands/snapshot.md` (the SC1 fixture), so any commit trips the guardian.

**Scope decision:** fixing all 103 missing declarations is a separate, disproportionate
remediation project (Phase 118-06's own comment already flags "per-command actual remediations
are out-of-scope follow-up phases"), not something to freelance inside Phase 237. The hook
documents its own scoped bypass (`COMMIT_NO_VERIFY=1`, distinct from `git commit --no-verify`
-- skips only this one guardian block; every other pre-commit check still runs), described in
its own comment as "wave-protocol invariant per Phase 125-08 SUMMARY" with a required
"canon-amendment PR within 24 hours" follow-up if used. Two independent attempts to use it
(one via a gsd-executor subagent, one directly by the orchestrator) were both explicitly denied
by this session's Claude Code auto-mode classifier, which is a governance signal in its own
right and was not routed around -- per the standing project hard rule ("never skip hooks ...
unless the user has explicitly asked for it") and per the classifier's own guidance ("stop and
explain ... let the user decide").

**Effect on the phase:** Plan 237-05 is incomplete (Task 1 verified but uncommitted, Task 2 not
started). Plan 237-07 (Wave 3, `depends_on: [237-05]`) and Plan 237-08 (Wave 4,
`depends_on: [237-02, 237-07]`) are therefore also blocked in the dependency chain. Waves 1 and
2's independent plan (237-06) are unaffected and proceed normally.

**Recommended follow-up:** the navigator/user decides one of: (a) explicitly authorize
`COMMIT_NO_VERIFY=1` for the 237-05 Task 1 commit (the stashed diff is ready to restore and
commit as-is, already independently verified), opening the canon-amendment PR the hook's own
convention calls for; or (b) scope a separate, disproportionate remediation phase to backfill
`interactive_first_reward` across the 103 missing commands first, then resume 237-05 on a
clean gate; or (c) narrow the guardian itself to check only staged files (a genuine, separate
infrastructure fix to `scripts/check-reward-before-investment.cjs` / the hook's invocation of
it, also out of Phase 237's own `files_modified` scope). Not resolved here.

**RESOLVED 2026-07-29:** navigator explicitly authorized `COMMIT_NO_VERIFY=1` for the one
237-05 commit, independently re-verified from the orchestrator side (same 103/112 count, same
conclusion: pre-existing, unrelated). Landed as `f95fa0c6`. Per the hook's own convention this
entry IS the canon-amendment record: `interactive_first_reward` is still missing on 103/112
commands, unchanged by this phase, and still needs its own remediation pass (option (b) or (c)
above, not attempted here). The canon-amendment PR the convention names has not been separately
opened; if one is required by process, it should point at this entry plus item 4 below rather
than duplicate the analysis.

## 4. A second, unrelated pre-existing gate fired on the same 237-05 commit: `data/help-groups.json` missing two commands, plus one legitimate `data/harness-manifest.json` regeneration (found 2026-07-29, resolved same day)

**Found during:** the same 237-05 Task 1 commit attempt, after the reward-before-investment
guardian was bypassed per item 2's resolution. Two SEPARATE pre-commit checks then fired in
sequence, neither of them the reward-before-investment guardian and neither covered by the
navigator's `COMMIT_NO_VERIFY=1` authorization (that env var only guards the one block in
`scripts/hooks/pre-commit` around the reward-before-investment linter -- confirmed by reading
the hook source; every other check in the file is unconditional):

1. **`data/harness-manifest.json` drift (legitimate consequence of this phase's own work, fixed
   for real).** `lib/core/chain-executor.cjs` changed earlier in Phase 237 (237-03) without
   regenerating the manifest. Fixed via the hook's own documented recovery command
   (`node scripts/build-harness-manifest.cjs`, deterministic, zero judgment) and included in
   the `f95fa0c6` commit.
2. **`data/help-groups.json` missing `intel-pipeline` and `pws-brain` (pre-existing, unrelated
   to Phase 237 -- confirmed via a temporary `git stash` against the clean base before this
   plan's changes, same reproduction method as item 1's finding).** Both commands exist on disk
   with normal (non-admin, non-deprecated) frontmatter but were never added to any help group.
   Fixed by adding each to its closest-matching, `serves_jtbd`-coherent existing group (verified
   against `scripts/check-help-coverage.cjs`'s own jtbd-intersection rule, not just directory
   presence): `intel-pipeline` (`serves_jtbd: ["plan-execution"]`) -> `orchestrate-automate`
   (`jtbd: ["plan-execution"]`, sibling to `act`/`pipeline`); `pws-brain`
   (`serves_jtbd: ["audit-room"]`) -> `system-maintenance` (`jtbd: ["audit-room","explore",
   "build"]`, sibling to `doctor`/`diagnostics`/`agentshield`). Deliberately did NOT set
   `visibility: admin` on `pws-brain.md` even though it self-describes as a "TEST HARNESS" --
   that field triggers a REAL runtime behavior change (the `UserPromptSubmit` hook
   `scripts/admin-command-gate.cjs` intercepts every `visibility: admin` command), which would
   have been a bigger, unjustified change than a purely additive help-group listing.

**Scope decision:** both fixes are purely additive/regenerative (a JSON list entry, a
deterministic digest recompute), touch zero runtime logic, and are exactly what each check's
own error message asks for ("add the command to data/help-groups.json", "Run:
node scripts/build-harness-manifest.cjs") -- not a bypass, not a freelance redesign. Both are
outside 237-05-PLAN.md's declared `files_modified` but were required to land the plan's actual
scoped work; included in the `f95fa0c6` commit with the reasoning documented in the commit
message itself.

**The underlying pattern worth a real infrastructure fix (not attempted here):** BOTH gates
that fired unexpectedly on this commit (item 2's reward-before-investment guardian, and this
item's help-coverage check) share the same shape -- `scripts/hooks/pre-commit` triggers each
one off "any `commands/*.md` staged" but then runs the underlying checker against the WHOLE
`commands/` directory (or, for help-coverage, the whole repo's command surface) rather than
just the staged file(s). This means ANY future commit touching a single `commands/*.md` file
is exposed to the full accumulated backlog of every OTHER command's pre-existing gaps, not just
its own change's correctness -- a blast-radius mismatch between what triggers a check and what
the check evaluates. A genuine fix (scope each checker to staged files, or to files reachable
from the staged diff, with a separate scheduled full-repo sweep for the accumulated backlog) is
real, cross-cutting infrastructure work, outside Phase 237's scope, and is not attempted here.

**Recommended follow-up:** (a) a future remediation phase should backfill
`interactive_first_reward` across the 103 missing commands (item 2) and audit for any other
help-coverage gaps beyond the two found here; (b) a separate, smaller infrastructure fix should
narrow both `scripts/check-reward-before-investment.cjs` and `scripts/check-help-coverage.cjs`
(or their `scripts/hooks/pre-commit` call sites) to evaluate only staged/changed files by
default, with an opt-in full-repo mode for CI and `doctor --acceptance`, so a single-command
commit is never blocked by an unrelated backlog it did not create.

## 3. `intelligence-cascade.cjs`'s proactiveIntelligence step persists before it diffs, so `newFindings` is always empty on a single real cascade run (found during 237-06)

**Found during:** Plan 237-06, Task 1 (authoring the end-to-end writer test for
`scripts/post-write`'s `last-cascade.json`). Confirmed live: driving the real
`scripts/post-write` -> `bin/mindrian-tools.cjs cascade` -> `lib/core/intelligence-
cascade.cjs::_runCascadeSteps` against a fresh fixture room produced
`proactive_intelligence: {status:"ok", persisted:5, new:5, suppressed:0, newFindings:[]}` --
`persisted`/`new` show 5 genuinely-new gap insights were recorded, but the co-returned
`newFindings` array is empty.

**Root cause:** `_runCascadeSteps` (`lib/core/intelligence-cascade.cjs` around lines 524-528)
calls `proactiveIntel.persistIntelligence(roomDir, analyzeOutput)` FIRST, which writes the
current insights into `<roomDir>/.proactive-intelligence.json` as already-persisted, and only
THEN calls `proactiveIntel.getNewFindings(roomDir, parsed)` -- which loads that JUST-updated
persisted store and diffs the current insights against it. Every insight on the very run that
produced it is therefore already "existing" with an unchanged confidence by the time the diff
runs, so `getNewFindings` never returns anything on a room's first (or any single) cascade
pass. A second insight only shows up in `newFindings` if it is DIFFERENT from what the first
run already persisted (e.g. a section transitioning out of a venture-stage gap exemption).

**Scope decision:** `lib/core/intelligence-cascade.cjs` and `lib/core/proactive-intelligence.cjs`
are not in 237-06-PLAN.md's `files_modified` list (`scripts/post-write`,
`scripts/auto-explore-fingerprint.cjs`, `scripts/auto-explore-fire.cjs`,
`tests/test-237-post-write-session-stamp.cjs`) and this ordering defect is unrelated to
REACH-03's session-stamping surface. Per the executor SCOPE BOUNDARY rule, not auto-fixed here.
Worked around in the test itself by patching ONLY the `proactive_intelligence.newFindings`
field of the real, session-stamped marker Leg 1 produces (documented inline in the test's file
header and in `237-06-SUMMARY.md`); `session_id` and every other real-writer field are left
byte-identical.

**Recommended follow-up:** swap the call order in `_runCascadeSteps` (diff via
`getNewFindings` against the PRE-persist state, then call `persistIntelligence`), or have
`persistIntelligence` return the pre-write snapshot so `getNewFindings` can diff against it
without a second disk read. Either fix makes every existing room's proactive-intelligence
surfacing actually fire on first touch instead of only on a second, different-shaped run --
a real user-facing behavior gap, not just a test-authoring inconvenience. Not fixed here.
