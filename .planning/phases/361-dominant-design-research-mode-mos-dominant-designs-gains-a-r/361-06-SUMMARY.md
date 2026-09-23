---
phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r
plan: 06
subsystem: dominant-design
tags: [cli, filing, evidence-claim, readback, room-db, ui-4-zone, dominant-design]

# Dependency graph
requires:
  - phase: 361-03
    provides: lane-queries.cjs (composeLaneQueries, auditEditedQuery, LANE_IDS), evidence-pack.cjs (validateLaneResult, renderLaneArtifact, toEvidenceClaimParams, laneArtifactName)
  - phase: 361-05
    provides: theo-structure.cjs (readDominantDesignStructure)
provides:
  - scripts/dominant-design-research.cjs (CLI router -- compose-queries, audit-query, theo-structure, validate-lane, file-pack; exports main, fileLane, filePack, renderFilingReport)
  - tests/test-361-cli.cjs (router legs: compose, audit, validate-lane, theo-structure offline, usage errors)
  - tests/test-361-filing.cjs (fixture-room legs for file-pack and fileLane)
affects: [361-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One deterministic CLI door precedent (scripts/analogy-fitness-report.cjs, Phase 214-03) reused for the dominant-design research path: a process.argv switch router, a tiny --name-value/--json flag parser, each handler returns {code, out|text, err} and main does all the printing/exit-code work"
    - "Navigator text never rides argv: compose-queries and audit-query take a JSON FILE PATH only; a refused string is never echoed to stdout (asserted by grep-free string-search tests, not just a manual read)"
    - "file-pack opens room.db exactly once per pack via navigation.openRoomDbForCaller / closeRoomDbForCaller (Part 9 chokepoint), never lib/core/room-db.cjs directly; the script's own source contains no reference to the room-db substrate module by name (grep-checked)"
    - "Lane artifacts are written unconditionally (including empty lanes and the no-room.db case); filing through navigation.fileEvidenceWithReadback only happens when a live handle exists, and every lane surfaces a landed/not_landed reason via navigation.surfaceFileEvidenceResult, never a swallowed failure"

key-files:
  created:
    - scripts/dominant-design-research.cjs
    - tests/test-361-cli.cjs
    - tests/test-361-filing.cjs
  modified:
    - .planning/ROADMAP.md

key-decisions:
  - "validate-lane's --out is written only when the lane is actually run through validateLaneResult (i.e. the lane id was found in gate.json); a lane_not_approved short-circuit never writes --out, since that result never reached the validator (the plan's CLI contract does not specify this edge, so this is this plan's own discretion, documented here for the next reader)"
  - "file-pack derives each lane's identity from its *.valid.json FILENAME (basename minus the .valid.json suffix, matched against LANE_IDS), not from the JSON body's own .lane field -- this lets an ok:false raw file (which may lack a .lane key, e.g. bad_shape/unknown_lane) still be attributed to the correct lane for the not-run report and still be ordered by LANE_IDS"
  - "Top-level file-pack result shape is {ok, room_db, reason, filed, lanes}: ok mirrors room_db (true when a live handle was opened, false with reason:'no_room_db' otherwise); filed is the SUM of every lane's attempted EvidenceClaim count (not just landed ones), so a no-room.db run reports filed:0 exactly as the plan's behavior spec states"
  - "The 4-zone report's Result column reads NOT RUN (<reason>) for an invalid lane, NOT LANDED (room.db not found) when the whole pack ran without a db, NOT LANDED (<landed>/<filed>) for a partial landing, and '<n> filed' otherwise -- chosen to satisfy the plan's literal 'filed or NOT LANDED' wording while still surfacing the not-run case distinctly, since the plan does not specify exact column text"
  - "Every fileLane call inside filePack's per-lane loop is wrapped in its own try/catch (Rule 2, defensive): a thrown containment-assertion or renderer error degrades to a not-run lane result instead of crashing the whole pack run, so one bad lane file can never take down the other lanes' filing"

requirements-completed: []

# Metrics
duration: ~45min
completed: 2026-09-23
---

# Phase 361 Plan 06: Dominant-design research CLI (compose, audit, Theo structure, validate, file-pack) Summary

**Built `scripts/dominant-design-research.cjs`, the one CLI door the `/mos:dominant-designs` command body will call for every deterministic research-path step: composing and auditing lane queries from a JSON file (never argv), reading the Theo/reference framework structure, validating a navigator-approved lane, and -- after approval -- writing every lane's evidence artifact and filing sourced claims through `navigation.fileEvidenceWithReadback` with a 4-zone report.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-23T~16:10:00Z (approx)
- **Completed:** 2026-09-23T16:57:00Z
- **Tasks:** 2 (both completed)
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments

- `scripts/dominant-design-research.cjs` routes five subcommands through one `process.argv` switch (`compose-queries`, `audit-query`, `theo-structure`, `validate-lane`, `file-pack`), a tiny `--name value` / `--json` flag parser, and prints JSON (or the 4-zone text for `file-pack` without `--json`). The script contains zero `child_process`/`execSync`/`spawn` references (asserted by both the plan's own grep and an in-suite source-string check).
- `compose-queries` and `audit-query` read navigator text ONLY from a JSON file path; a refused string (an egress-violating domain or query) is never echoed to stdout, verified against the live `Acme Robotics arms` -> venture-proper-noun pattern and a `jane@example.com` -> email pattern.
- `validate-lane` looks up the raw lane's approved queries by lane id in a gate.json, returning `lane_not_approved` when absent and `query_mismatch` when the echoed queries differ; `--out` is written only when it ends in `.valid.json` (exit 2 otherwise) and only when the lane was actually validated.
- `theo-structure` (offline leg: `HOME` repointed at an empty mkdtemp dir, no Brain key, plus the fetch-thrower `NODE_OPTIONS` preload) degrades to the six-phase local reference and names the reason, exercising the exact D-16 live-Theo-shape fallback path 361-05 built.
- `file-pack` writes one lane artifact per `*.valid.json` in the pack dir (including an explicit empty-lane artifact with `## Searched, not found`), files one `EvidenceClaim` per unique URL per lane through `navigation.fileEvidenceWithReadback` (session suffix `:dd-<lane>`, tier assigned as the highest of the grouped rows), and reports each lane's landed/not-landed rows with reasons. An absent `room.db` still writes every artifact and says so plainly (`reason: 'no_room_db'`, `filed: 0`); a `*.valid.json` whose `ok` is `false` writes no artifact and is reported as not run with its own reason. Re-filing the same pack under the same session UPSERTs (no duplicate nodes).
- Every artifact path is computed from the validated slug/date/lane id and asserted to resolve inside the room directory before any write; a path-traversal `--domain-slug`, a malformed `--date`, a non-existent `--room`, or a missing `--pack` all exit 2 with nothing written.
- The `file-pack` text report follows the 4-zone CLI ruling: Zone 1 header (`-- <room label or dir basename> -- competitive-analysis -- <stage or "unknown stage"> --`), Zone 2 a per-lane body table, no Zone 3, Zone 4 footer naming `/mos:find-bottlenecks` first then `/mos:macro-trends` and `/mos:explore-trends`. Contains no em-dash.
- `tests/test-361-cli.cjs` (33 checks across 12 legs) and `tests/test-361-filing.cjs` (46 checks across 7 legs) both spawn the real CLI via `spawnSync` against JSON/pack fixtures in mkdtemp dirs, with a `NODE_OPTIONS` fetch-thrower preload on every child; both exit 0. `bash tests/run-all-361.sh` shows both new legs PASSED (26 passed, 2 pre-existing peer failures, 1 correctly-skipped 361-07 leg).

## Task Commits

Each task was committed atomically:

1. **Task 1: CLI router for compose-queries, audit-query, theo-structure, validate-lane** - `9b8787d19` (feat)
2. **Task 2: file-pack (lane artifacts, EvidenceClaim filing with readback, 4-zone report)** - `8f588a927` (feat)

_Base commit at plan start:_ `4d33884e1` (per `git rev-parse HEAD` at session start)

## Files Created/Modified

- `scripts/dominant-design-research.cjs` (587 lines) - the CLI router: `parseFlags`, `cmdComposeQueries`, `cmdAuditQuery`, `cmdTheoStructure`, `cmdValidateLane`, `cmdFilePack`, `fileLane`, `filePack`, `renderFilingReport`, `main`
- `tests/test-361-cli.cjs` (277 lines) - 12 legs: compose-queries happy path / degrade-no-echo / missing-file / bad-JSON, audit-query ok / egress-violation-no-echo / unknown-lane, validate-lane ok-with-out / query-mismatch / lane-not-approved / bad-out-suffix, theo-structure offline fallback, router usage errors, source-purity
- `tests/test-361-filing.cjs` (404 lines) - 7 legs: happy-path file-pack (artifacts + readback + JSON shape + room.db assertions), idempotent re-filing (UPSERT), absent room.db, invalid-lane not-run, usage errors (nothing written), default session id, 4-zone report shape
- `.planning/ROADMAP.md` - Phase 361 progress line (5/8 -> 6/8) and the `361-06-PLAN.md` checkbox, verified with `git diff -U0` to touch only those two lines

## Decisions Made

See `key-decisions` in the frontmatter above (validate-lane `--out` write timing, filename-derived lane identity in file-pack, top-level result shape, 4-zone Result-column wording, per-lane defensive try/catch).

## Exact CLI usage lines (for 361-07's command body to quote)

```
node scripts/dominant-design-research.cjs compose-queries <domain.json>
node scripts/dominant-design-research.cjs audit-query <query.json>
node scripts/dominant-design-research.cjs theo-structure [--reference <path>]
node scripts/dominant-design-research.cjs validate-lane <raw.json> --approved <gate.json> [--out <path>]
node scripts/dominant-design-research.cjs file-pack --pack <dir> --room <roomDir> --domain-slug <slug> --date <YYYY-MM-DD> [--session <id>] [--room-label <text>] [--stage <text>] [--json]
```

- `domain.json` = `{"domain": "<phrase>"}`; `query.json` = `{"lane": "<id>", "q": "<string>"}`.
- `gate.json` = `{"domain_slug": "...", "lanes": [{"id": "...", "queries": ["..."]}]}` (the navigator's approved lanes after edits/drops).
- `*.valid.json` files in the `--pack` dir must be named `<lane-id>.valid.json` (e.g. `variant_census.valid.json`); file-pack processes every one it finds in `LANE_IDS` order.
- Default `--session` when absent: `dominant-designs:<slug>:<date>`.
- Exit codes: `0` for any well-formed run (including honest degrades and not-landed filings), `2` for usage errors.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' verify commands and acceptance criteria passed as specified.

**Acceptance criteria verified:**
- `node tests/test-361-cli.cjs` exits 0, all 33 checks PASS
- `node tests/test-361-filing.cjs` exits 0, all 46 checks PASS
- `node scripts/dominant-design-research.cjs` (no args) exits 2, stderr lists all five subcommands
- `grep -c "child_process" scripts/dominant-design-research.cjs` prints `0`
- `grep -c "room-db.cjs" scripts/dominant-design-research.cjs` prints `0`; `grep -c "openRoomDbForCaller"` prints `3`
- em-dash count in both new files is `0` (both `scripts/dominant-design-research.cjs` and the two new test files)
- `node tests/test-fileval-readback.cjs` exits 0 (existing FILEVAL-02 contract untouched)
- `bash tests/run-all-361.sh` shows the CLI and filing legs PASSED

## Issues Encountered

`bash tests/run-all-361.sh` reports `PASSED=26 FAILED=2 SKIPPED=1` after this plan's commits. Both failures are the same pre-existing, unrelated peer failures named in this session's operating instructions (classified, not touched):
- `lib/core/part8-egress-guard.test.cjs` (PB8-03 self-test) - unrelated to this plan's two files.
- `tests/test-209-declared-implies-wired.cjs` - unrelated to this plan's two files.

The one `SKIPPED` leg (`361-07` command-contract test) is correctly skipped: that test file does not exist yet because plan 361-07 has not executed.

**Self-caught, not a deviation:** during authoring, two hygiene slips were caught and fixed before commit (never landed in a committed state): a literal `room-db.cjs` substring in a source comment (violates the plan's own "no room-db.cjs reference" acceptance grep) was reworded to "the room-database substrate module"; and a literal em-dash character (introduced by an editing artifact, not intentional) in one test assertion string was replaced with the `\u2014` escape sequence, matching the 361-03 precedent for the same class of slip. Both fixes were applied and re-verified before either task's commit, so no additional commit was needed.

## Known Stubs

None. Both `fileLane`/`filePack`/`renderFilingReport` and the four other subcommand handlers are complete implementations against the plan's full `<behavior>` specification; no placeholder logic, no hardcoded empty return feeding a UI.

## Threat Flags

None beyond the plan's own declared `<threat_model>` (T-361-25..T-361-30), all mitigated exactly as specified:
- T-361-25 (path tampering): slug/date regexes, lane id from `LANE_IDS`, resolved-path containment check under the room dir before any write; a violation throws and is caught per-lane as a not-run result, nothing is written outside the room.
- T-361-26 (shell injection via navigator text): `compose-queries`/`audit-query` read JSON files only; zero `child_process` in the script (grep- and test-asserted).
- T-361-27 (writing before approval): `file-pack` is the only writing subcommand; this plan does not wire it to the command body (that is 361-07's contract test to pin).
- T-361-28 (false "filed" claims): every filing goes through `fileEvidenceWithReadback` + `surfaceFileEvidenceResult`; not-landed rows are reported with reasons; an absent room.db is stated plainly, never silently skipped.
- T-361-29 (room.db access outside the chokepoint): `openRoomDbForCaller`/`closeRoomDbForCaller` only; zero reference to the room-db substrate module in the script (grep-asserted); every filed node lands `proposed`.
- T-361-30 (refused strings echoed): `audit-query` and `compose-queries` never echo a refused string (asserted against the live `Acme Robotics`/email patterns, not just a synthetic string).

No new network endpoint, auth path, or schema change was introduced. `file-pack` writes only inside `<room>/competitive-analysis/dominant-designs/` and through the two named navigation doors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scripts/dominant-design-research.cjs` is ready for 361-07 to wire into the upgraded `/mos:dominant-designs` command body. The exact usage lines above (subcommand names, flag names, default session format, exit codes) are the contract 361-07's command-body prose and its `tests/test-361-command-contract.cjs` should quote verbatim.
- 361-07 still needs to build the D-08 "File this to competitive-analysis?" confirm step ahead of any `file-pack` invocation (this plan's threat model assumes but does not itself enforce that ordering; T-361-27's mitigation is pinned by 361-07's own contract test, per the plan's `gate_impact` note).
- DDR361-02, DDR361-05, DDR361-06, DDR361-07, and DDR361-09 (this plan's `requirements:` frontmatter) each still name 361-07 as an additional, later-closing owner per `.planning/REQUIREMENTS.md`'s traceability rows; per the shared-tree rule ("do not check off any DDR361 row; 361-08 Task 3 closes all 13"), none were checked off here.
- `tests/run-all-361.sh` (written once by 361-01, never edited here) now shows both `tests/test-361-cli.cjs` and `tests/test-361-filing.cjs` legs PASSED instead of SKIPPED; only the 361-07 command-contract leg remains SKIPPED pending that plan.

## Self-Check: PASSED

- FOUND: scripts/dominant-design-research.cjs
- FOUND: tests/test-361-cli.cjs
- FOUND: tests/test-361-filing.cjs
- FOUND: commit 9b8787d19 (Task 1)
- FOUND: commit 8f588a927 (Task 2)
- `node tests/test-361-cli.cjs` exits 0 on the final on-disk state
- `node tests/test-361-filing.cjs` exits 0 on the final on-disk state
- `bash tests/run-all-361.sh` shows `PASSED=26 FAILED=2 SKIPPED=1` (the 2 failures are the pre-existing peer legs named above)

---
*Phase: 361-dominant-design-research-mode-mos-dominant-designs-gains-a-r*
*Completed: 2026-09-23*
