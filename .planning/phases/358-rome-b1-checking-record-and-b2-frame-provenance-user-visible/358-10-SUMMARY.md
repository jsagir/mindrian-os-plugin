---
phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible
plan: 10
subsystem: registry
tags: [b2, cirs, born-wired, registry, theo, baseline, rome]

# Dependency graph
requires:
  - phase: 358-09 (B2 wave 3)
    provides: lib/mcp/tools/question.cjs (question_read, question_set, both connectors declared), the transient connector-registry/test-270/test-276 drift this plan closes
provides:
  - "data/mcp-tool-connectors.json, data/connector-registry.json, data/connector-coverage-ledger.json regenerated fresh, carrying exactly mcp:question_read (hitl_shape none) and mcp:question_set (hitl_shape F.1) plus the question.cjs ledger row"
  - "commands/room.md teaching line naming the question subcommands (Theo command layer source); skills/room/SKILL.md regenerated mirror; data/command-registry.json carries the new teaching value"
  - "data/harness-manifest.json regenerated (posture + wiring digests)"
  - "tests/test-270-tool-schema-budget.cjs AFTER re-baselined to plan 358-10 (44 tools, 48321 bytes, +5.95% vs 358-05)"
  - "tests/fixtures/tool-honesty/276-dispositions.json frozen_sweep re-frozen 39/133 -> 41/135, refrozen_at names plan 358-10 and commit c50cb7f2e"
  - "bash tests/run-all-358.sh exits 0, PASSED=39 FAILED=0 SKIPPED=0"
  - "recorded command-registry sha256 and the pre-release command_neighborhood reading for the post-release Theo check"
affects: [358-11 (go/no-go runbook cites this plan's green runner and the Theo registryHash evidence)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regenerate-last collision discipline (same as 358-05): every shared registry regenerated and committed in ONE commit only after every B2 surface landed, so peers doing the same regenerate never churn against this plan's bytes"
    - "AFTER re-baseline with a signed-percentage comment block naming every intervening non-B2 change (355-05's scout-hsi/whitespace_scan description edits), never silently absorbed into an unexplained delta"

key-files:
  created: []
  modified:
    - commands/room.md
    - skills/room/SKILL.md
    - data/command-registry.json
    - data/mcp-tool-connectors.json
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json
    - tests/test-270-tool-schema-budget.cjs
    - tests/fixtures/tool-honesty/276-dispositions.json

key-decisions:
  - "No data/brain-orchestration-projection.json regenerate: build-orchestration-projection --check reported OK (no drift) both before and after the connector-registry regenerate, so this plan left it untouched, exactly as the plan's own step 6 conditional specifies."
  - "No personality_skill manifest-digest carry-forward: the plan's planning-time facts expected data/harness-manifest.json's personality_skill digest to be stale from committed peer commit 5fffa21d6 (skills/larry-personality/SKILL.md) and need carrying into this regenerate. By the time this plan's Task 1 ran, that digest was already current (a prior peer regenerate must have picked it up), so the actual harness-manifest.json diff was exactly the posture and wiring digests only -- nothing to carry, nothing else changed, confirmed by inspecting the full diff (2 fields, 6 lines)."
  - "AFTER's totalBytes delta (45606 -> 48321, +2715 bytes) is NOT entirely B2's: peer plan 355-05 (commit f2314ec97) lengthened the scout-hsi (lib/mcp/tool-router.cjs) and whitespace_scan (lib/mcp/tools/sensors.cjs) descriptions between the 358-05 measurement and this one. toolCount's entire +2 delta (42 -> 44) is B2's (question_read, question_set); named explicitly in the new AFTER comment block and the commit message rather than silently absorbed."

requirements-completed: [B2-10]

# Metrics
duration: ~1h (continuous with 358-09's session; includes recovering a dropped commit, see 358-09-SUMMARY.md Issues Encountered)
completed: 2026-09-24
---

# Phase 358 Plan 10: B2 Born-Wired Registry Regeneration and Baseline Close-out Summary

**Regenerated every shared registry for question_read/question_set in one clean commit (commands/room.md teaching line, connector registry + ledger, harness manifest), then re-baselined the tool-schema budget (44 tools, 48321 bytes, +5.95%) and re-froze the honesty sweep (41/135); the phase runner now exits 0 with 39/39 legs passed.**

## Performance

- **Duration:** ~1h (continuous with 358-09; see that plan's SUMMARY for the shared-tree git-reset recovery this plan's Task 2 commit needed)
- **Completed:** 2026-09-24
- **Tasks:** 2/2 completed
- **Files modified:** 9

## Accomplishments

- Confirmed the clean-tree precondition (`git status --short -- data/ lib/mcp/ commands/ skills/ agents/ bin/ lib/core/chain-executor.cjs lib/core/navigation-engine.cjs lib/core/directive-envelope.cjs lib/statusline/cockpit-renderer.cjs` empty) before regenerating, and confirmed 355-05 had already landed.
- `commands/room.md`'s `teaching:` line (the ONLY frontmatter key changed) now reads: "When you need to view the active Data Room, /mos:room opens it. /mos:room question shows the room's governing question with its origin and history, and asks what the old question got wrong before a changed question is recorded." (227 characters, two sentences, no em-dash) -- navigator requirement 2026-09-23 item 2.
- `node scripts/build-skill-mirrors.cjs` touched only `skills/room/SKILL.md`; `node scripts/build-command-registry.cjs` changed only the `/mos:room` teaching value in `data/command-registry.json`.
- `node scripts/build-connector-registry.cjs` regenerated `data/mcp-tool-connectors.json`, `data/connector-registry.json` and `data/connector-coverage-ledger.json` with a diff that is EXACTLY the two new `mcp:question_read` (hitl_shape none) / `mcp:question_set` (hitl_shape F.1) records and one added `mcp_tool_file:lib/mcp/tools/question.cjs` ledger row (wired 198 -> 199); nothing else moved.
- `node scripts/build-orchestration-projection.cjs --check` reported OK (no drift), so `data/brain-orchestration-projection.json` was left untouched, per the plan's own conditional.
- `node scripts/build-harness-manifest.cjs` regenerated `data/harness-manifest.json`: diff is exactly the `posture` digest (from the command-registry teaching change) and the `wiring` digest + `source_count` (211 -> 213, from the connector-registry change) -- 6 lines total, nothing else.
- All eight gates in the plan's own step 8 passed clean: `build-connector-registry --check`, `build-command-registry --check`, `build-orchestration-projection --check`, `build-harness-manifest --check`, `build-skill-mirrors --check`, `check-shape-declaration --check` (pre-existing advisory WARNs only, not blocking), `check-render-coverage --check`, `build-render-coverage --check`, `test-270-connector-coverage.cjs` (44/44 wire tools vs 31 declared connectors), `test-358-b2-cli.cjs`, `test-358-b2-routing.cjs`, `check-cirs-declaration --check` for 358-10-PLAN.md.
- Committed the whole regenerate together (commands/room.md, skills/room/SKILL.md, and the 5 data files) with `git commit --only` -- the pre-commit hook re-ran every guard on the staged set and passed.
- Theo evidence recorded: `sha256sum data/command-registry.json` at commit `c50cb7f2e` = `2afa656e2ebc049072453ca55587bc8a7f6920f77ec864b4369ae29bc6f85d7e` (this is the `registryHash` Theo should report for `/mos:room` once a release containing `c50cb7f2e` is cut and resynced). Pre-release `command_neighborhood('/mos:room')` reading (read-only, command name only, through `lib/core/brain-client.cjs`): `{"mappedBy":"command-registry@2.0.0-beta.42","registryHash":"43d13474f8028fb9a2cc589388a9aa2a2ef90cf5a7bb55fee10eb203c850f9f8"}` -- an older `mappedBy` and a `registryHash` that differs from the recorded sha256, exactly the expected honest pre-release state (a main commit is not live until released and picked up).
- `node tests/test-270-tool-schema-budget.cjs` measured live: 44 tools, 19395 desc bytes, 28926 schema bytes, 48321 total bytes, ~12080 approx tokens (router 9 / atomic 35). `AFTER` re-baselined: `measuredAt: '2026-09-23'`, `plan: '358-10'`, with a new dated comment block naming the measured numbers, the signed `pctChange(45606, 48321) = 5.95` percent (under `DRIFT_TOLERANCE_PCT`, moved anyway per this file's own protocol), and explicitly attributing part of the byte delta (not the toolCount delta) to committed peer plan 355-05 (commit `f2314ec97`). `DRIFT_TOLERANCE_PCT` left at 10, unchanged.
- Live honesty sweep re-frozen: `tests/fixtures/tool-honesty/276-dispositions.json` `frozen_sweep` 39/133 -> 41/135 (`ok` 121 -> 123); `refrozen_at` now names plan 358-10 and commit `c50cb7f2e`. `question_read` and `question_set` rows both scan OK, so no disposition was added for either. `high_risk` is 0. Only `frozen_sweep` and `refrozen_at` changed; `schema_version`, `frozen_at_commit` and every `dispositions` entry stayed byte-identical.
- `node tests/test-270-tool-schema-budget.cjs`, `node tests/test-276-tool-honesty-findings-closed.cjs`, `node tests/test-234-tool-description-floor.cjs` all exit 0 (5, 148, 188 passed respectively).
- `bash tests/run-all-358.sh` exits 0: `PASSED=39 FAILED=0 SKIPPED=0`. `tests/test-358-b2-routing.cjs` prints "routing text: 3 of 3 checked"; `tests/test-358-b2-part8.cjs` prints "part8 static: 4 of 4 B2 files scanned".
- `node scripts/doctor.cjs --acceptance`: 20/21 points passed (see Deviations / Peer Drift Observed below for the one FAIL, confirmed peer-caused and transient, observed twice).

## Task Commits

Each task was committed atomically:

1. **Task 1: Teaching line for Theo plus one born-wired regenerate of every shared registry** - `c50cb7f2e` (chore)
2. **Task 2: Re-baseline the tool-schema budget, re-freeze the honesty sweep, prove the phase green** - `7dbac7f92` (test) -- recovered via `git cherry-pick` after a peer session's `git reset` on the shared tree dropped this commit's first landing (`201355ada`); full incident and recovery steps documented in `358-09-SUMMARY.md` Issues Encountered (the same session, same incident, discovered mid-way through this plan's Task 2 verification).

## Files Created/Modified

- `commands/room.md` - `teaching:` line only, names the question subcommands for Theo's command layer
- `skills/room/SKILL.md` - regenerated mirror of `commands/room.md`
- `data/command-registry.json` - `/mos:room` teaching value only
- `data/mcp-tool-connectors.json` - `mcp:question_read` and `mcp:question_set` records added
- `data/connector-registry.json` - same two records, mirrored
- `data/connector-coverage-ledger.json` - one `mcp_tool_file:lib/mcp/tools/question.cjs` row added, wired count 198 -> 199
- `data/harness-manifest.json` - `posture` digest (command-registry) and `wiring` digest + `source_count` (connector-registry, 211 -> 213)
- `tests/test-270-tool-schema-budget.cjs` - new dated comment block; `AFTER` re-baselined to plan 358-10 (44 tools, 48321 bytes)
- `tests/fixtures/tool-honesty/276-dispositions.json` - `frozen_sweep` (41/135) and `refrozen_at` (plan 358-10, commit c50cb7f2e) updated; dispositions untouched

## Decisions Made

See `key-decisions` in the frontmatter above. In short: no orchestration-projection regenerate needed (no drift), no personality_skill digest to carry forward (already current by the time this plan ran), and the AFTER byte-delta comment block explicitly separates B2's own toolCount contribution from peer plan 355-05's description-length contribution.

## Deviations from Plan

None beyond the shared-tree git-reset recovery already fully documented in `358-09-SUMMARY.md` (Issues Encountered) -- that incident's recovery commit (`7dbac7f92`, replacing the dropped `201355ada`) IS this plan's own Task 2 commit; it is not re-documented here as a separate deviation since it produced the exact content this plan's Task 2 specified, just via `cherry-pick` instead of a fresh `git commit --only` the first time around.

### Auto-fixed Issues

None specific to this plan's own scope (Task 1 and Task 2 both executed exactly as specified once the shared-tree collision from 358-09 was resolved).

---

**Total deviations:** 0 (this plan's own scope); 1 shared-tree git-collision recovery, fully attributed to 358-09's Issues Encountered section
**Impact on plan:** Zero behavior change from what the plan specified. No scope creep.

## Issues Encountered

- See `358-09-SUMMARY.md` Issues Encountered for the full shared-tree `git reset` incident and its non-destructive recovery (this plan's Task 2 commit, `7dbac7f92`, is the direct output of that recovery via `git cherry-pick`).
- The `verify-release-clean-tree` doctor.cjs acceptance point failed twice during this plan's own verification runs (first with "tracked-file drift: 9 file(s)", then again with "tracked-file drift: 1 file(s)" after a peer's own commit landed). Both times, an immediate `git status --porcelain --untracked-files=no` run by this session showed a CLEAN tracked tree -- the FAIL is a snapshot taken mid-way through the doctor run's ~70-90 second span, catching a PEER session's own transient staged-but-uncommitted tracked-file state at that instant, not a B2-caused or self-caused drift. This is the same class of finding `358-05-SUMMARY.md` already documented under "Peer Drift Observed" for the identical check.

## Peer Drift Observed (not touched, not committed)

`node scripts/doctor.cjs --acceptance` reported one FAIL out of 21 points on both runs: `verify-release-clean-tree`. At the time of the second run, the drift was traced to `scripts/refresh-framework-names.cjs` and `tests/test-355-framework-names.cjs` -- both STAGED (git-added) but not yet committed by a concurrent peer session (Phase 355.1/355-08 territory, confirmed by their eventual commit `7e8be3330 test(355-08): framework-names snapshot builder with offline --check (D-51)` landing shortly after). Neither file was read, staged, or modified by this plan; `git diff --cached --name-only` was checked before and after every one of this plan's own commits to confirm only this plan's intended paths were ever committed via `git commit --only`.

Also present throughout, untouched (carried forward from 358-05's own note, same files, same reason): `docs/FRAME-PROVENANCE-PRODUCT-WORKUP.md` (untracked, a peer's B2/product-research artifact) and `docs/reviews/mindrian-system-atlas.html` (untracked, on this plan's own "never touch docs/reviews/*" list).

## Verification Evidence

```
node scripts/build-connector-registry.cjs --check       -> OK
node scripts/build-command-registry.cjs --check         -> OK
node scripts/build-orchestration-projection.cjs --check -> OK
node scripts/build-harness-manifest.cjs --check          -> OK
node scripts/build-skill-mirrors.cjs --check              -> OK (112 mirrors match)
node tests/test-270-connector-coverage.cjs                -> 6 passed, 0 failed (44/44 wire tools vs 31 declared connectors)
grep -c '"surface": "mcp:question_read"' data/mcp-tool-connectors.json -> 1
grep -c '"surface": "mcp:question_set"' data/connector-registry.json   -> 1
grep -c "mcp_tool_file:lib/mcp/tools/question.cjs" data/connector-coverage-ledger.json -> 1

node tests/test-270-tool-schema-budget.cjs               -> 5 passed, 0 failed
  budget: 44 tools, 19395 desc bytes, 28926 schema bytes, 48321 total, ~12080 approx tokens (router 9 / atomic 35)
  delta 270-06 -> 358-10: toolCount +8 (22.22%), totalBytes +19652 (68.55%)

node tests/test-276-tool-honesty-findings-closed.cjs      -> 148 passed, 0 failed
  GROUP F: ledger frozen_sweep.tools=41 branches=135; live scanAll toolCount=41 branchCount=135 (match)

node tests/test-234-tool-description-floor.cjs            -> 188 passed, 0 failed (prose-shape coverage 44/44)

bash tests/run-all-358.sh                                 -> PASSED=39 FAILED=0 SKIPPED=0, exit=0
node tests/test-358-b2-routing.cjs | grep "routing text: 3 of 3 checked"     -> match
node tests/test-358-b2-part8.cjs | grep "part8 static: 4 of 4 B2 files scanned" -> match

node scripts/doctor.cjs --acceptance                      -> Acceptance full: 20/21 points passed; failed: verify-release-clean-tree (peer drift, transient, see above)
```

Acceptance-criteria checks (all satisfied):
- `grep -c "plan: '358-10'" tests/test-270-tool-schema-budget.cjs` = 1
- `grep -c "DRIFT_TOLERANCE_PCT = 10" tests/test-270-tool-schema-budget.cjs` = 1 (unchanged)
- `node -e "...frozen_sweep vs scanAll() vs refrozen_at.reason..."` exits 0
- `git log -1 --format=%s` (Task 2 commit) names the measured tool count, total bytes and percentage
- `bash tests/run-all-358.sh` exits 0, `PASSED=39 FAILED=0 SKIPPED=0`
- em-dash grep on both edited test-honesty files = 0
- `git diff <PLAN_BASE> -- commands/room.md | grep '^[-+]' | grep -v '^[-+][-+]' | grep -vc '^[-+]teaching:'` = 0 (only the teaching line changed)
- `git status --short -- data/ commands/ skills/` prints nothing after both commits

## Threat Model Coverage

All four threats in this plan's own STRIDE register are mitigated exactly as declared:

- **T-358-49** (Tampering, regenerating a shared registry over a peer's uncommitted work): the clean-tree precondition ran before both the connector-registry regenerate and the tool-schema-budget measurement and passed both times; every post-regenerate diff was inspected and contained exactly the B2 additions plus the two already-attributed peer changes (355-05's description edits, named in the AFTER comment block; 5fffa21d6's already-absorbed personality_skill digest).
- **T-358-50** (Repudiation, a baseline moved silently): the measured numbers and signed percentage change are written into both the new source comment block and the Task 2 commit message; `DRIFT_TOLERANCE_PCT` is unchanged.
- **T-358-51** (Tampering, honesty findings suppressed by a re-freeze): the re-freeze touches only `frozen_sweep` and `refrozen_at`; every `dispositions` entry is byte-identical; `test-276-tool-honesty-findings-closed.cjs` GROUP A still ran and passed; `high_risk` is 0 in the live scan; both new rows (question_read, question_set) are OK, never dispositioned.
- **T-358-52** (Information disclosure, the Theo probe carrying room content): the probe sent only the literal command name `/mos:room` through `lib/core/brain-client.cjs`, the same call `release-lib/theo-stamp-gate.sh` makes; no room path or text left this process.

No new trust boundaries were introduced. No `## Threat Flags` section is needed.

## Known Stubs

None. Every file touched is a generated data artifact or a measured/re-frozen test fixture; nothing renders a placeholder or aspirational value.

## Next Steps

- 358-11 writes the operator go/no-go runbook (`docs/2026-10-06-ROME-B2-GO-NO-GO.md`), citing this plan's now-green `bash tests/run-all-358.sh` (PASSED=39 FAILED=0 SKIPPED=0), the recorded `data/command-registry.json` sha256 (`2afa656e2ebc049072453ca55587bc8a7f6920f77ec864b4369ae29bc6f85d7e` at commit `c50cb7f2e`) as the Theo `registryHash` to check post-release, and the "peer drift, transient" note above (should be re-checked once peer sessions land their own in-flight commits).

## Self-Check: PASSED

- FOUND: `commands/room.md` (modified, teaching line names question subcommands)
- FOUND: `skills/room/SKILL.md` (modified, regenerated mirror)
- FOUND: `data/command-registry.json` (modified, contains `/mos:room question`)
- FOUND: `data/mcp-tool-connectors.json` (modified, contains `mcp:question_set`)
- FOUND: `data/connector-registry.json` (modified, contains `mcp:question_read`)
- FOUND: `data/connector-coverage-ledger.json` (modified, contains the question.cjs ledger row)
- FOUND: `data/harness-manifest.json` (modified)
- FOUND: `tests/test-270-tool-schema-budget.cjs` (modified, contains `plan: '358-10'`)
- FOUND: `tests/fixtures/tool-honesty/276-dispositions.json` (modified, contains `358-10`)
- FOUND commit `c50cb7f2e` (chore, Task 1)
- FOUND commit `7dbac7f92` (test, Task 2)

---
*Phase: 358-rome-b1-checking-record-and-b2-frame-provenance-user-visible*
*Completed: 2026-09-24*
