---
phase: 173-publish-jtbd-need-selector
plan: 02
subsystem: publish-visualize
tags: [jtbd, need-selector, cirs, born-wired, part-10, part-11, connector, selector]
requires:
  - data/publish-needs.json (173-01 -- the JTBD need->command map the selector reads)
  - lib/core/publish-needs-default-lane.cjs (173-01 -- defaultLaneForRoleBlend, R6)
  - lib/workflow/command-resolver.cjs (Phase 122 -- the one resolver door)
  - lib/core/chain-executor.cjs (Phase 166 -- runChain post-gate handoff)
  - scripts/build-connector-registry.cjs (Phase 143.3 -- the connector generator + --check)
  - scripts/build-orchestration-projection.cjs (Phase 157 -- the R5 projection generator + --check)
provides:
  - commands/show.md (the /mos:show F.1 JTBD need-selector front door, born-wired)
  - data/connector-coverage-ledger.json (/mos:show classified WIRED, gap=0)
affects:
  - 173-03 (the show/share trigger sensor registers SENS-SHOW, which /mos:show declares)
tech-stack:
  added: []
  patterns:
    - "born-wired CIRS surface: connector: block on the command + cirs_relationship: in the plan frontmatter"
    - "framework: null selector front door (additive-degrade -- mirrors the Plan-16 framework:null surfaces)"
    - "reuse the existing context_block reach -- no 7th reach minted (D-03; SENS-09 brain_consult precedent)"
    - "generated registries regenerated in lockstep, never hand-edited (connector + projection + harness manifest)"
key-files:
  created:
    - commands/show.md
  modified:
    - data/command-registry.json
    - data/connector-registry.json
    - data/connector-coverage-ledger.json
    - data/harness-manifest.json
    - data/brain-orchestration-projection.json
    - data/orchestration-command-ledger.json
decisions:
  - "hierarchy_rank 53 (the plan's example 18 collided with /mos:analyze-systems; ranks are tie-break inputs, picked a free integer)"
  - "framework: null so the WFL-01 resolver check degrades cleanly (a selector front door is not a single-framework command)"
  - "class derives to mechanical (the show base matches no framework/pipeline/intelligence marker) -- the correct non-framework-command class"
metrics:
  duration: ~25m
  completed: 2026-06-23
  tasks: 2
  files: 6
---

# Phase 173 Plan 02: /mos:show JTBD Need-Selector Front Door Summary

The NEW `/mos:show` command ships as the Shape F.1 JTBD need-selector front door (R1):
the navigator names a JOB in plain language and Larry resolves it to the right
visual/publish command underneath, the command staying hidden (Canon Part 10). It is
born-wired under CIRS (R5/R12) -- a `connector:` block on the command plus the
`cirs_relationship:` block in the plan frontmatter -- and passes the Phase 172 coverage
gate as WIRED with gap unchanged at 0. It consumes the Wave-1 contracts verbatim
(`data/publish-needs.json` + `defaultLaneForRoleBlend`) and routes every job through the
one governed path (command-resolver -> runChain). `/mos:publish` stays UNCHANGED (D-02).

## What shipped

### Task 1 -- commands/show.md (R1/R5/R12)

A new command, `name: show`, `body_shape: F.1`, `disable-model-invocation` NOT set (so
Larry can route to it). The directive body instructs Larry to:

1. read `data/publish-needs.json` (the single source of truth for the 4 lanes + the 8
   jobs + each job's `resolves_to`);
2. read the active room `USER.md` `role_blend` and call
   `defaultLaneForRoleBlend(role_blend)` from `lib/core/publish-needs-default-lane.cjs`
   to pick the OPENING lane (R6);
3. render ONE AskUserQuestion Shape F.1 selector whose 4 tabs are the lane labels from
   `_lanes` and whose options are the user-voice `job` labels -- NEVER a `/mos:` token or
   a command name (R1, Part 10);
4. ALWAYS include the AskUserQuestion "Other" / free-text option ("something else") per
   the navigator standing preference;
5. on selection, look up the job's `resolves_to`, resolve it through
   `lib/workflow/command-resolver.cjs` (never name a command from memory -- D-03), and
   hand the resolved chain to `runChain` in `lib/core/chain-executor.cjs` (Phase 166 --
   auto-runs the autonomous_safe prefix, halts at the first material step at the Decision
   Gate, Part 3); the give-me-a-link job resolves to the UNCHANGED `/mos:publish` (D-02);
6. route the make-land lane to the EXISTING MOSDeckEngine skill (D-01 -- not a `/mos:deck`,
   which is Phase 175).

The `connector:` block mirrors `commands/think-hats.md` verbatim (the
`# --- Phase 143.3 connector frontmatter ---` delimiter, all 11 sub-keys):
`connects_to_spine: true`, `sensor_triggers: [SENS-SHOW]` (the sensor Plan 03 registers),
`reach_id: context_block` (the EXISTING reach -- no 7th minted, D-03),
`sub_mode: jtbd-need-selector`, `framework: null` (additive-degrade), `posture: hold`,
`hierarchy_rank: 53`, `filing: memory_event_only`, `plan_gated: false`, `web_scope: null`,
`surface: F.1`. No fenced implementation code in the body; directive prose only. No
em-dashes.

### Task 2 -- regenerate the connector registry + coverage ledger + harness manifest + projection (R5)

Ran `node scripts/build-connector-registry.cjs` to pick up the new connector block.
`/mos:show` now classifies WIRED in `data/connector-coverage-ledger.json` (`class:
mechanical`); counts moved 88 -> 89 wired, excluded held at 36, **gap held at 0** (no
regression from the Plan-16 baseline). `node scripts/build-connector-registry.cjs
--check` exits 0 (registry not stale). The `framework: null` degraded cleanly through the
WFL-01 resolver guard, exactly as the additive-degrade rule (CONNECTOR-CONTRACT.md
section 4) prescribes for a selector front door.

## Verification

- `node scripts/build-connector-registry.cjs --check` exits 0.
- `data/connector-coverage-ledger.json` lists `/mos:show` as WIRED; `counts.gap` is 0
  (89 wired / 36 excluded / 0 gap).
- `bash tests/run-all-172.sh` -> 20/20 PASS (CIRS gate green; the reach-ids drift fence
  stays exactly-6, the posture fence exactly-3 -- no 7th reach minted).
- CIRS adversarial verdict (`test-cirs-adversarial-verify.cjs`) 19/19 PASS, including the
  clean-repo PROJECTION + CONNECTOR hard-gate legs.
- `node scripts/check-cirs-declaration.cjs --check .../173-02-PLAN.md` -> OK (the
  `cirs_relationship` block is conformant; `canon_parts` contains 11).
- `node scripts/check-publish-needs.cjs` -> OK (the 173-01 contract the selector consumes
  is still valid: 8 jobs, all resolves_to real, all shows in {connections,gaps}).
- `/mos:publish` last touched in Phase 172-06, NOT this plan (D-02 honored).
- No em-dashes in any new or changed file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated data/command-registry.json in lockstep (Phase 122)**
- **Found during:** Task 1 commit
- **Issue:** The Phase 122 pre-commit hook (build-command-registry.cjs --check) failed the
  commit because adding a new command file made `data/command-registry.json` stale (101 ->
  102 commands). The plan scoped only the connector registry, but the command registry is a
  separate generator the pre-commit hook also gates.
- **Fix:** Ran `node scripts/build-command-registry.cjs` (regenerated, never hand-edited)
  and folded `data/command-registry.json` into the Task 1 commit.
- **Files modified:** data/command-registry.json
- **Commit:** 72f67f6f

**2. [Rule 3 - Blocking] Regenerated the Phase 157 orchestration projection + command ledger in lockstep (R5)**
- **Found during:** Task 2 post-verify (tests/run-all-172.sh)
- **Issue:** `orchestration-projection --check` and `test-cirs-adversarial-verify.cjs`
  (the ADV-07b clean-repo PROJECTION-gate leg) failed because the new WIRED command needs a
  `mindrian-operation` counterpart node in the Part-8 orchestration projection (CIRS R5).
  The Phase 172 v1.15 amendment makes the projection hard-gate part of the CIRS suite, so a
  new command surface MUST propagate to the projection or both --check gates trip.
- **Fix:** Ran `node scripts/build-orchestration-projection.cjs` (regenerated, never
  hand-edited). `/mos:show` now carries its `mindrian-operation` counterpart;
  `data/orchestration-command-ledger.json` shows 77 ranked / 25 excluded / **0 gap** (no
  regression). Re-ran `build-harness-manifest.cjs` after the projection regen because the
  manifest digests the projection. tests/run-all-172.sh then 20/20.
- **Files modified:** data/brain-orchestration-projection.json,
  data/orchestration-command-ledger.json, data/harness-manifest.json
- **Commit:** 445bab90

**3. [Rule 1 - Adjustment] hierarchy_rank 53 instead of the plan's example 18**
- **Found during:** Task 1 authoring
- **Issue:** The plan suggested `hierarchy_rank` "e.g. 18", but 18 is already taken by
  `/mos:analyze-systems`. `hierarchy_rank` is a one-reach-per-beat tie-break input
  (collisions are not fatal), but the plan explicitly asked for "a free integer not
  colliding with shipped ranks".
- **Fix:** Picked 53 (verified free against the connector registry's used ranks).
- **Files modified:** commands/show.md
- **Commit:** 72f67f6f

## Authentication Gates

None.

## Known Stubs

None. `/mos:show` is a directive command that routes to existing, shipped surfaces (the 7
view commands + /mos:publish + the MOSDeckEngine skill, all live and WIRED). It reads the
fully-populated `data/publish-needs.json` (173-01) and the real `defaultLaneForRoleBlend`
mapper. `SENS-SHOW` is the sensor id Plan 03 registers; the connector declares it forward
(an unmatched sensor fires nothing -- silent, honest -- per CONNECTOR-CONTRACT.md section
4, the documented additive-degrade behavior, not a stub).

## Self-Check: PASSED

Files (all FOUND):
- commands/show.md
- data/connector-coverage-ledger.json (contains /mos:show, state wired, gap=0)
- data/connector-registry.json
- data/harness-manifest.json
- data/brain-orchestration-projection.json
- data/orchestration-command-ledger.json

Commits (verified in git log):
- 72f67f6f: feat(173-02): author commands/show.md F.1 JTBD need-selector front door (R1/R5/R12)
- fd2a0a1d: feat(173-02): regenerate connector registry + coverage ledger + harness manifest in lockstep (R5)
- 445bab90: feat(173-02): regenerate orchestration projection + command ledger + harness manifest in lockstep (R5)
