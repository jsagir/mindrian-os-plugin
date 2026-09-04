---
phase: 339-brain-to-theo-cutover-release-flip-brain-client-default-orig
plan: 07
subsystem: origin-single-source-and-doctor-l6
tags: [flip-01, flip-11, d-12, d-12b, origin-single-source, doctor-class-m, census-fixture, a10-discharge]

# Dependency graph
requires:
  - phase: 339-01
    provides: tests/test-339-origin-single-source.cjs (the RED-on-plan's-own-run scan, allowlist, three arms)
  - phase: 339-04
    provides: lib/core/brain-client.cjs getBrainUrl() precedent this plan's two runtime sites now call through (getBrainUrl() itself predates the phase, at lib/core/brain-client.cjs:1163)
provides:
  - scripts/probe-brain-contract.cjs origin resolved through getBrainUrl(), BRAIN_URL const removed
  - scripts/build-brain-census.cjs origin resolved through getBrainUrl(), stale "mirrors line 24" comment removed
  - lib/core/doctor/class-m-brain-smoke.cjs dual-shape L6 node-count read (totalRecordCount first, nodes second), CANON_BRAIN_URL now exported
  - lib/core/doctor/class-m-brain-smoke.test.cjs mock origins derived from the exported CANON_BRAIN_URL, Theo-shaped + neither-field arms, below-floor arm moved to 500
  - tests/fixtures/246-census-fixture.json brain_url fields neutralized to an RFC 2606 placeholder
  - tests/test-339-origin-single-source.cjs now fully GREEN (0 violations, was 6 at wave-1 end)
affects: [339-10, 339-12, 339-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Origin resolution via require + getBrainUrl() at module scope, replacing a self-declared `process.env.MINDRIAN_BRAIN_URL || '<literal>'` const -- the override still works because it is resolved inside the shared resolver, not re-implemented at the call site"
    - "Dual-shape field read in ONE adjacent block (not two branches), older/incumbent field checked first, so today's behavior is provably unchanged and only the fallback field is new territory"
    - "Test-file mock origins derived from a module's own exported canon constant rather than typed literals, so a future constant-only VALUE move (the FLIP cut) requires zero test-file edits"
    - "A below-floor test arm deliberately re-picked to sit under BOTH the current and a KNOWN FUTURE floor value, so the arm cannot silently invert into a pass when the future value lands"

key-files:
  created: []
  modified:
    - scripts/probe-brain-contract.cjs
    - scripts/build-brain-census.cjs
    - lib/core/mcp-profiles.cjs
    - scripts/rs-experts-command.cjs
    - scripts/rs-thesis-command.cjs
    - scripts/sessionstart-post-update-preflight.cjs
    - scripts/session-start
    - .env.brain.template
    - lib/core/doctor/class-m-brain-smoke.cjs
    - lib/core/doctor/class-m-brain-smoke.test.cjs
    - tests/fixtures/246-census-fixture.json

key-decisions:
  - "session-start's banner drops the host entirely rather than deriving it via a node spawn (cosmetic gain not worth startup-latency cost on every session); doctor.cjs class M layer 6 stays the one authoritative reporter of the resolved origin."
  - ".env.brain.template's MINDRIAN_BRAIN_URL comment now states the bare-origin rule (no path, no trailing slash) and the rollback-lever framing instead of naming today's default, so the comment cannot go stale across an origin change."
  - "Generated-artifact disposition (data/brain-census.generated.json, docs/BRAIN-GRAPH-CENSUS.generated.md): left UNCHANGED, three reasons recorded verbatim below for 339-10's CHANGELOG entry. Re-census against Theo registered as a DEFERRED item, not done here."
  - "Case B's below-floor test count moved from 1000 to 500: 1000 is the exact Theo floor plan 339-12 will introduce, so a below-floor arm sitting at 1000 would silently invert to a pass the moment the flip lands."
  - "Two new Test 11 arms given their OWN ok() calls (not folded silently into the single aggregate label) so the suite's PASSED count is mechanically provable as having gone up (11 -> 13), not just eyeballed from a diff."

patterns-established:
  - "A doctor/smoke-layer dual-shape field read states, in the comment at the read site, exactly which constant VALUES are deliberately NOT touched and why (they belong to a later, human-held flip commit) -- so a future reader of the git blame does not have to reconstruct the D-13 boundary from context."

requirements-completed: [FLIP-01, FLIP-11]

# Metrics
duration: 55min
completed: 2026-09-04
---

# Phase 339 Plan 07: Origin Literal Sweep + Doctor/Fixture PREP Cut (FLIP-01, FLIP-11) Summary

**The two runtime origin sites (`probe-brain-contract.cjs`, `build-brain-census.cjs`) and six prose sites now resolve/name the Brain origin through `getBrainUrl()` instead of a self-declared literal or a hard-coded host, `tests/test-339-origin-single-source.cjs` is fully GREEN, and the doctor's class M layer 6 plus its test file and the census fixture are made correct against BOTH the incumbent and Theo ahead of the flip -- with zero constant VALUES moved, so the FLIP commit (339-12) stays exactly the five files D-13 locks it to.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-09-04T04:57Z (immediately after 339-06's plan-completion state update)
- **Completed:** 2026-09-04T05:17Z (Task 3 commit) plus SUMMARY/state work
- **Tasks:** 3 completed
- **Files modified:** 11, plus this SUMMARY

## Accomplishments

### Task 1 -- Runtime origin sites (FLIP-01)

`scripts/probe-brain-contract.cjs` and `scripts/build-brain-census.cjs` no longer declare their own `BRAIN_URL` literal. Both now `require('../lib/core/brain-client.cjs')` and call `getBrainUrl()` at module scope. `build-brain-census.cjs`'s stale comment admitting it "mirrors lib/core/brain-client.cjs line 24" (a written confession of a second source of truth) is replaced with a comment naming phase 339 and stating there is nothing left to mirror. `probe-brain-contract.cjs` gets a comment-as-contract block naming the real risk this closes: post-flip, a self-declared literal here would silently probe the INCUMBENT while every leg's output still claimed to describe "the Brain".

**MINDRIAN_BRAIN_URL override observations, recorded verbatim per this task's own instruction:**

- `scripts/probe-brain-contract.cjs` with `MINDRIAN_BRAIN_URL=https://example-probe.invalid`: printed `Brain URL: https://example-probe.invalid`, then every leg correctly attempted (and failed, as expected for an unreachable host) against that exact origin -- proving the resolution, not the network.
- `scripts/build-brain-census.cjs` with `MINDRIAN_BRAIN_URL=https://example-census.invalid`: `require()`d and read the module's own `BRAIN_URL` export, which equaled `https://example-census.invalid` exactly.
- Independently: `MINDRIAN_BRAIN_URL=https://example.invalid node -e "console.log(require('./lib/core/brain-client.cjs').getBrainUrl())"` printed `https://example.invalid`.

Commit: `b75b36d2`.

### Task 2 -- Prose sweep

Six files rewritten to name the RESOLVER (`getBrainUrl()`, `lib/core/brain-client.cjs`) instead of a hard host: `lib/core/mcp-profiles.cjs`, `scripts/rs-experts-command.cjs`, `scripts/rs-thesis-command.cjs`, `scripts/sessionstart-post-update-preflight.cjs`. `scripts/session-start`'s session-start banner (`Brain: HTTP client active (pws-brain-mcp.onrender.com)`) drops the host entirely -- printed as `Brain: HTTP client active` -- with the reason recorded in place rather than shelling out to node for a cosmetic hostname on every session start; a second reference to the old banner text inside the file's own docblock example (line ~1878, not originally named in the plan's read_first but caught by the automated verify grep) was updated to match. `.env.brain.template`'s `MINDRIAN_BRAIN_URL` comment now states the bare-origin rule and the rollback-lever role instead of naming today's default.

**Generated-artifact disposition, recorded verbatim for plan 339-10's CHANGELOG entry:**

1. The generator's own header states it has NO `--check` release gate by design, because a release gate must never depend on live network; `grep build-brain-census scripts/verify-release` returns nothing, so a stale census blocks no gate.
2. Lane B requires an operator-supplied ADMIN key, and Theo has no admin key -- `brain_write` returns `WRITE_PATH_DISABLED` unconditionally.
3. Re-running Lane A against Theo would replace a census of the incumbent's 29,200-node graph with a census of Theo's (now measured live, see Task 3) 1,253-node graph, silently discarding the record the 2026-08 phases were measured against.

`data/brain-census.generated.json` and `docs/BRAIN-GRAPH-CENSUS.generated.md` are confirmed UNCHANGED (`git diff --stat` on both is empty). Re-census against Theo is registered as a **deferred item**, not addressed by any plan in this phase.

Commit: `d1bd258b`.

### Task 3 -- Doctor smoke layer, test file, census fixture (FLIP-11, D-12b prep half)

**Assumption A10 discharge (recorded verbatim, so plan 339-12 inherits a fact):** one live, read-only `brain_stats` call was made against Theo's real stdio server (`node /home/jsagi/Theo/dist/index.js`, spawned via Theo's own installed `@modelcontextprotocol/sdk` client, connected to the live Neo4j Aura instance `5b8df33f.databases.neo4j.io`). The raw `CallToolResult` came back as:

```json
{
  "content": [{ "type": "text", "text": "{ \"nodes\": 1253, \"relationships\": 1522, \"labels\": [...14 entries...], \"diagnostics\": {...} }" }],
  "structuredContent": { "nodes": 1253, "relationships": 1522, "labels": [...], "diagnostics": {...} }
}
```

**The payload is NOT nested under any further wrapper.** `content[0].text` JSON-parses to exactly `{ nodes, relationships, labels, diagnostics }` at the top level, matching `structuredContent` field-for-field. This is the same shape `lib/core/brain-client.cjs`'s own `callTool()` already unwraps to for the incumbent (it JSON-parses `parsed.result.content[0].text` and returns that flat object directly as `statsResult`), so the dual-shape read written below needs **no additional level of unwrapping** on either side of the flip -- confirming, not merely assuming, A10's premise. Live counts observed: 1,253 nodes / 1,522 relationships, 14 labels (`Framework` 420, `TaxonomyRecord` 270, `Chunk` 210, `MindrianCommand` 113, `BrainRecord` 146, `Chapter` 35, `ProcessStep` 30, `DomainConcept`/`Phase`/`Reach`/`ToolType` 6 each, `Mention` 3, `Technique`/`Root` 1 each).

**Edit 1** -- `lib/core/doctor/class-m-brain-smoke.cjs` layer 6 now reads the node count from one adjacent block: `statsResult.totalRecordCount` first (guarded `typeof === 'number' && Number.isFinite`), `statsResult.nodes` second (same guard), else an honest failure now naming BOTH field names (`brain_stats carried no usable totalRecordCount or nodes field`). `totalRecordCount` recognized first is the proof of inertness -- the incumbent emits it, so it is matched before `nodes` is ever consulted, and today's behavior against the incumbent cannot change. `CANON_BRAIN_URL` is now in `module.exports`; its value, `CANON_NODE_FLOOR` (29000), and `STALE_REPLICA_NODE_COUNT` (28325) are all UNCHANGED -- verified by `grep -F` in the automated verify block.

**INERTNESS PROOF (recorded per the plan's own instruction):** `git diff lib/core/doctor/class-m-brain-smoke.cjs` shows exactly two hunks -- the node-count read (with its comment) and the `module.exports` line. No constant declaration line appears in the diff.

**Edit 2** -- `lib/core/doctor/class-m-brain-smoke.test.cjs` now `require()`s the module once and destructures `CANON_BRAIN_URL`, used everywhere an origin used to be typed (`L6_PASS_SEAMS.mockBrainUrl`, `passBase.mockBrainUrl`, Case C's `payload.endpoint` assertion). The string `onrender.com` appears nowhere in the file. Case B's below-floor count moved from 1000 to 500 (1000 is the exact Theo floor plan 339-12 will introduce; a below-floor arm sitting at 1000 would silently invert to a pass on flip; 500 is also confirmed NOT `STALE_REPLICA_NODE_COUNT`, so the arm still tests the generic floor, not the named signature). Two new arms added, each with its own `ok()` call so the PASSED count is mechanically provable: a Theo-shaped stats arm (`{ nodes: 30000, relationships: 40000, labels: 14 }`, asserting `ok===true` and `payload.node_count===30000`) proving the `nodes` half of the dual read, and a neither-field arm (`{ labels: 14 }`, asserting a failure whose reason matches both `/totalRecordCount/` and `/nodes/`) proving the fallback stays honest. Suite PASSED count: **11 -> 13** (verified against a `git stash`-isolated pre-task run of the same file -- see caveat below).

**Edit 3** -- `tests/fixtures/246-census-fixture.json`'s two `brain_url` fields (lines 6, 173) changed from the incumbent host to the RFC 2606 placeholder `https://example.invalid`. `node tests/test-246-census-render.cjs` still passes (34 assertions) -- the fixture pins census SHAPE, never a host, and the generator now populates the live field from `getBrainUrl()` (Task 1).

Commit: `7353e60f`.

**Process note (not a deviation from the plan's own spec, but worth recording):** to measure the pre-task baseline PASSED count for the "strictly higher" acceptance criterion, `git stash` was used to temporarily set aside the Task 3 edits to `class-m-brain-smoke.cjs`/`.test.cjs`, run the baseline, then `git stash pop` to restore them. This repo's standing `destructive_git_prohibition` rule forbids `git stash` inside a **worktree** (cross-worktree stash-list contamination, #3542); this session runs on the main working tree (not a linked worktree -- confirmed via `git rev-parse --git-dir` returning `.git`, a directory, before use), so the specific hazard the rule targets does not apply here, but the command is called out explicitly per the rule's spirit. `git status`/`git diff --stat` were checked immediately after `stash pop` and confirmed all edits round-tripped intact with no loss.

## Verification (plan-level `<verification>` block, all confirmed)

- `node tests/test-339-origin-single-source.cjs` -- PASS (0 violations; was 6 at the end of wave 1, cleared in stages: 4 after Task 1, 1 after Task 2, 0 after Task 3).
- `bash tests/run-all-339.sh` -- origin arm PASSED. Two pre-existing, out-of-scope failures remain unchanged (`test-339-269-05-checklist.sh`, `test-339-cross-repo-note.sh`, both owned by other plans) plus the expected `339 no-em-dash fence` FAIL for a not-yet-created file (`docs/339-NOTE-theo-desktop-connector-key.md`, another plan's deliverable) -- same baseline profile as before this plan, only the origin arm's status changed.
- `node scripts/doctor.cjs --acceptance` -- 16/18 both before and after this plan's changes, same two failures both times (`npx-roundtrip`: npm network install failure, `verify-release-clean-tree`: tracked-file drift from other in-flight work) -- inert.
- `git diff --stat data/brain-census.generated.json docs/BRAIN-GRAPH-CENSUS.generated.md` -- empty both times.
- `node scripts/check-plugin-path-anchoring.cjs --check-scripts` -- exit 0, `OK`; the one reported VIOLATIONS count (1, in `commands/file-meeting.md`) is pre-existing and unrelated to any file this plan touched.
- `node lib/core/doctor/class-m-brain-smoke.test.cjs` -- 13/13 PASSED (up from 11/11 baseline).
- `node tests/test-246-census-render.cjs` -- PASS (34 assertions).
- The three D-13 constants proven UNMOVED by `grep -F`: `CANON_BRAIN_URL` still `https://pws-brain-mcp.onrender.com`, `CANON_NODE_FLOOR` still `29000`, `STALE_REPLICA_NODE_COUNT` still `28325`.
- `grep -rc 'onrender.com' lib/core/doctor/class-m-brain-smoke.test.cjs tests/fixtures/246-census-fixture.json` -- 0 for both files.

## Deviations from Plan

None beyond the process note above (git-stash use for baseline measurement, explicitly called out rather than silently done) and one additional fix not named in the plan's own `read_first` for Task 2:

**[Rule 1 - Bug] A second stale banner-text reference in `scripts/session-start`'s own docblock (line ~1878)**
- **Found during:** Task 2's automated verify grep, which failed on the first pass.
- **Issue:** The plan's `read_first` named only the live banner line (`:1896`) for editing; a docblock example a few lines above it (`*   - "Brain: HTTP client active (pws-brain-mcp.onrender.com)" -- key resolved.`) also carried the old host and was not named.
- **Fix:** Updated the docblock example to match the new bannerless text, with a one-line pointer to the comment below explaining why.
- **Files modified:** `scripts/session-start` (same commit as the rest of Task 2).
- **Commit:** `d1bd258b`.

## Known Stubs

None. No hardcoded empty/placeholder UI-facing values were introduced by this plan.

## Threat Flags

None. Every file touched maps to a `mitigate` disposition already named in this plan's own `<threat_model>` (T-339-01, T-339-20, T-339-21, T-339-22, T-339-36, T-339-37, T-339-38); no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary was introduced outside that register.

## Self-Check

See `## Self-Check` section appended below.
