---
quick_task: 260911-axz
one_liner: doctor grows an L0 origin-and-shadow layer that catches the exact Tier 0 failure a beta.33 install hit; THEO_NODE_FLOOR moved 1000 -> 27000; two docs corrected; SEED-082 triggered; census re-run live against Theo (27,951 / 39,732 / 452, zero delta)
requirements: [AXZ-01, AXZ-02, AXZ-03]
key-files:
  created: []
  modified:
    - lib/core/integration-registry.cjs
    - lib/core/doctor/class-m-brain-smoke.cjs
    - lib/core/doctor/class-m-brain-smoke.test.cjs
    - scripts/doctor.cjs
    - tests/test-127-02-doctor-class-m.sh
    - docs/339-NOTE-theo-desktop-connector-key.md
    - .planning/phases/339-brain-to-theo-cutover-release-flip-brain-client-default-orig/339-12-SUMMARY.md
    - .planning/seeds/SEED-082-bidirectional-command-framework-sync-drift-detection.md
    - CHANGELOG.md
    - commands/doctor.md
    - skills/doctor/SKILL.md (generated mirror, regenerated via pre-commit hook)
    - scripts/build-brain-census.cjs
    - data/brain-census.generated.json
    - docs/BRAIN-GRAPH-CENSUS.generated.md
metrics:
  duration: ~1h
  completed: 2026-09-11
  tasks: 3/3
---

# Quick Task 260911-axz: Theo QA memo follow-ups (doctor detects a shadow, floor stops rubber-stamping, census re-run) - Summary

## What changed, per task

### Task 1: Doctor grows an origin-and-shadow layer (TDD)

**`lib/core/integration-registry.cjs`** - extracted `_readJsonConfig(configPath)` (private, returns parsed JSON or `null`) out of the existing `parseMcpConfig`, which now delegates to it with byte-unchanged behavior. Added and exported `readScopedMcpServers({configPath, projectDir})`: the one Claude Code `~/.claude.json` scoped `mcpServers` reader, projecting each entry down to `{name, scope, url_host, type}`. It never copies `headers`, the full `url`, or `env` - the projection is the security control (Canon Part 8, T-axz-01).

**`lib/core/doctor/class-m-brain-smoke.cjs`** - prepended `{id: 'origin_shadow', name: 'L0 origin and shadow connector'}` to `LAYERS` (now 7 entries) and `_layer0` to the layer-function array. `_layer0` does three things: (a) shadow scan via `readScopedMcpServers`, filtering for `name === 'mindrian-brain'`, building a not-ok reason naming scope, host, and the exact `claude mcp remove mindrian-brain -s <scope>` fix line; (b) resolved-origin row (always reported) - `resolved_origin`, `is_theo`, `override`; (c) best-effort `theo_health` (mode + build_sha only, never `instanceUri`/`quarantineCode`/`serverAgent`). Verdict: `ok` is false iff a shadow was found; origin/health are information only. The cascade loop's `prevOk` assignment is now gated on `i > 0`, so L0's own failure never blinds L1-L6 (Test H proves this explicitly). `THEO_NODE_FLOOR` moved from `1000` to `27000` (3.4% margin under the 27,951 measured 2026-09-11); `CANON_NODE_FLOOR` (29000) unchanged. Both floors additively exported.

**`scripts/doctor.cjs`** - the human renderer now branches on `layer.id` (`origin_shadow` vs `store_identity`) instead of assuming the old L6-only payload shape. Confirmed (grep, not assumed) that the `--acceptance` activation-reached-the-wire gate finds layers by `id`/`name`, never by index, so the L0 prepend is safe there - verified live in the final `--acceptance` run (`activation-reached-the-wire: ok=true`, `storeIdentity.id === 'store_identity'`, `node_count=27951 at or above floor=27000`). Help text and the `--brain-smoke` banner now say "7-layer".

**`tests/test-127-02-doctor-class-m.sh`** - T2 now asserts 7 layers and `layers[0].id === 'origin_shadow'`; T4's cascade assertions shifted by one index and gained an `L0 should be true` assertion (a hermetic HOME carries no `~/.claude.json`, so no shadow).

**RED/GREEN evidence** (`lib/core/doctor/class-m-brain-smoke.test.cjs`):
- RED run (before any implementation change): 20 tests executed, 3 pass / 17 fail, every failure for the expected reason (`LAYERS.length === 6` not 7, `layers[0].id === 'plugin_root'` not `origin_shadow`, `THEO_NODE_FLOOR === undefined` not exported, etc.). Full failure list captured during execution; representative: `LAYERS constant: ... 6 !== 7`, `THEO_NODE_FLOOR ... + undefined - 27000`.
- GREEN run (after implementation): `PASSED: 22, FAILED: 0`.
- One RED-phase correction along the way: the initial hermetic seam bag (`ALL_PASS_SEAMS`) covered only L0+L6; Tests A-G (which exercise L0 in isolation) would otherwise have let L1-L6 fall through to REAL resolvers (network/filesystem) since L0 never blinds L1-L6. Fixed by folding L1-L5 pass-mocks into the shared seam bag before touching implementation, re-confirmed RED for the same 20 tests, then implemented.
- `bash tests/test-127-02-doctor-class-m.sh`: 5/5 PASS, fast (no network hang from the real `theo_health` call under hermetic HOME - key resolution correctly short-circuits before any auto-registration attempt).

**Live end-to-end proof** (`node scripts/doctor.cjs --brain-smoke --json`, this dev machine, no shadow present as documented): L0 reports `resolved_origin: https://theo-mcp.onrender.com`, `is_theo: true`, `override: false`, `theo_health: {mode: "ok", build_sha: "9ad6545f8519a72df663ffa05037cf121c1c7a74"}`, zero shadows. No `Authorization`/`Bearer` anywhere in the JSON output.

**Verification commands run, all exit 0:**
```
node lib/core/doctor/class-m-brain-smoke.test.cjs            -> PASSED: 22, FAILED: 0
bash tests/test-127-02-doctor-class-m.sh                     -> PASS: 5, FAIL: 0
node -e "...THEO_NODE_FLOOR===27000..."                       -> OK
node -e "...readScopedMcpServers projection leak check..."    -> OK 23 entries
node scripts/doctor.cjs --brain-smoke --json | header check   -> OK origin_shadow true
grep header-access-in-code check                              -> OK no header access in code
node tests/test-339-origin-single-source.cjs                  -> PASS (0 failures)
doctor-modules.json class-M registration check                -> class M registered: false (expected; class M is special-cased in scripts/doctor.cjs, not a registry module)
em-dash scan (5 touched files)                                -> OK no em-dashes
```

### Task 2: The three documents that told a reader the wrong thing, plus SEED-082

**`docs/339-NOTE-theo-desktop-connector-key.md`** - appended `## 9. Claude Code: do NOT add a user-level mindrian-brain server (2026-09-11)`, scoping Section 1's Desktop/Cowork advice away from Claude Code, recording the 2026-09-11 Tier 0 observation and the 503, both `claude mcp remove` fix lines, and why removal (not a URL swap) is correct.

**`339-12-SUMMARY.md`** - appended `## Dated note, 2026-09-11: the documented rollback lever is dead`, zero lines removed (`git diff -U0 ... | grep -c '^-[^-]'` = 0, confirmed).

**`SEED-082`** - `status: dormant` -> `triggered`, `triggered_at: 2026-09-11`, `trigger_evidence:` carrying all four drift facts (21-beta registry skew; zero-Sensor/84-Reach projection gap; the framework sync gap stated correctly as 9 methodology commands + alias resolution across 28 names, not 71 missing links; the Sensor claim-side-vs-existence-side open design question) plus a body `## Trigger fired, 2026-09-11` section recording the same facts in prose and the `lib/mcp/brain-router.cjs` Tier 3 2000ms race as an explicitly out-of-scope follow-up. A mid-task addendum from the orchestrator added a fifth fact (`fact_5_live_smoke_addendum`) distinguishing a registry-authoring framework-ranking observation from the reachable +11-edge sync target (42 -> 53 USES_FRAMEWORK edges, 40 -> 51 commands, 21 -> 28 frameworks), folded into the same commit since Task 2 had not yet been committed.

**`CHANGELOG.md`** - filled the empty `[Unreleased]` `### Added` bullet with the layer-0/floor/census facts, and added a `### Changed` group. New-content-only em-dash count: 0.

**`commands/doctor.md`** - both stale "5-layer Brain probe" mentions corrected to "7-layer", naming the new L0 layer in the class M bullet.

**Deviation (Rule 3, blocking issue):** the pre-commit hook's `build-skill-mirrors --check` flagged `skills/doctor/SKILL.md` as stale after the `commands/doctor.md` edit. Regenerated via `node scripts/build-skill-mirrors.cjs` (mirrors the source text change only, confirmed by diff) rather than bypassing the hook.

**Verification commands run, all pass:**
```
grep -F "claude mcp remove mindrian-brain -s user" docs/339-NOTE-...   -> found
grep Section-9/Desktop-Cowork/503 combined check                       -> OK
git diff -U0 -- 339-12-SUMMARY.md | grep -c '^-[^-]'                   -> 0 (append-only)
SEED-082 evidence/negative-guard node -e check                          -> OK
CHANGELOG Unreleased-block content check                                -> OK
grep "5-layer" doctor.md (must be 0) + "7-layer" present                -> OK
em-dash scan (3 touched docs files)                                     -> 0 each
```

### Task 3: The census learns Theo's shape

**`scripts/build-brain-census.cjs`** - added `_isTheoStatsShape(stats)` (recognizes Theo's `{nodes, labels, ...}` shape, absence of `totalRecordCount` first, so the incumbent path can never be misclassified) and `_runLaneBTheo(key, brainStats)`, selected in `main()`'s `--lane-b` branch by a `brain_stats` probe. C1 and C5 source directly from `brainStats.labels` (Theo's read allow-list rejects the whole-graph `AllNodesScan` plan those Cypher queries need); C6 sources from `brain_schema` (relationship TYPE NAMES, no per-type counts, honestly `n/a`); C2, C2a-d, C3, C4, C7, C8, C9 are still attempted through `brainCall('brain_query', ...)`. `renderMarkdown` gained two additive, `theo_shape`-gated branches (Census Meta rows; the entire Lane B aggregates section) plus a top-of-file origin/date sentence, all gated so the incumbent path is byte-unchanged.

**A real bug found live and fixed in the same commit (Rule 1):** Theo's read-allow-list refusal does NOT surface as an HTTP error or a JSON-RPC `error` field - `brainCall()` would have returned `ok: false` for either of those, which the first cut of `_runLaneBTheo` correctly treated as a refusal. Instead, Theo returns `ok: true` with a plain-text tool result: `"PLAN_REJECTED: plan operator \`Distinct\` is not on the read allow-list"`, which `brainCall()`'s `JSON.parse` failure wraps as `{text: <that string>}`. The first cut's `if (r.ok) { results.C2 = r.result; }` logic therefore stored the raw `{text: "PLAN_REJECTED..."}"}` object as if it were a successful result: C2/C3 rendered as blank sections (matching neither the array branch nor the refused branch), and C4's three sub-keys were silently DROPPED from the JSON entirely (`row[q.sub]` was `undefined` for all three, and `JSON.stringify` omits `undefined`-valued object keys - confirmed live: `C4: {}` in the first generated artifact). Fixed by adding `_looksLikePlanRejection(result)` and a single `_theoQueryOutcome(r)` normalizer used at every call site in `_runLaneBTheo`, so both refusal shapes (transport-level and Theo's own PLAN_REJECTED text) collapse to the same `{refused: true, error}` shape everywhere. Re-ran `--lane-b` live after the fix; confirmed C2/C3/C4's PLAN_REJECTED reasons now render honestly (see the generated markdown, lines 32-36) instead of silently vanishing.

**Cold-start-one-retry** added to `--lane-a` via `_isColdStartLikeFailure()` (fetch failure / timeout / 502 / 503) wrapping a `brain_stats` reachability probe before the real per-framework loop begins. **Not exercised live this run** - Theo answered on the first attempt (no cold start observed).

**Byte-compatibility proof:** `node scripts/build-brain-census.cjs --render-only` against the pre-existing incumbent JSON produced ZERO diff, both BEFORE any code change (control run) and again immediately AFTER the code change (before the live Theo run overwrote the data files) - confirmed via `git status --porcelain` on both artifact paths being empty each time.

**Live regeneration against Theo**, both `--lane-a` and `--lane-b`, exit 0:
- Lane A: "28 frameworks probed, 28 gaps."
- Lane B (after the PLAN_REJECTED fix): "results for C1, C5, C6, C2, C2a, C2b, C2c, C2d, C3, C4, C7, C8, C9."

**Live census numbers observed** (`data/brain-census.generated.json`):
```
brain_url:      https://theo-mcp.onrender.com
census_date:    2026-09-11
nodes:          27951
relationships:  39732
Framework:      452
```
**Delta against the plan's 2026-09-11 measurement (27,951 / 39,732 / 452): ZERO on all three.** No values edited, no artifacts hand-edited; these are exactly what Theo answered live.

**Verification commands run, all pass:**
```
node scripts/build-brain-census.cjs --render-only + porcelain check   -> empty (byte-identical), both before and after code change
node tests/test-246-census-render.cjs                                  -> PASS (34 assertions)
node tests/test-246-census-guard.cjs                                   -> PASS (59 assertions over 15 census queries)
node --test tests/test-262-floor-denominator.cjs                       -> 6/6 pass
node --test tests/test-262-unrecognized-shape-voids.cjs                -> 7/11 pass, 4 fail (PRE-EXISTING, confirmed via git stash before/after - see Deferred Issues below; does not touch build-brain-census.cjs)
node -e "...live-count delta check..."                                 -> OK (zero delta)
grep origin/date/number spot-checks in generated markdown              -> OK
em-dash scan (docs/BRAIN-GRAPH-CENSUS.generated.md, build-brain-census.cjs) -> 0 each
node tests/test-339-origin-single-source.cjs                           -> PASS (0 failures)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - CLAUDE.md conformance] Removed 13 pre-existing em-dashes from `lib/core/integration-registry.cjs`**
- **Found during:** Task 1, post-implementation em-dash scan (the plan's own verify step scans the WHOLE file, not just new lines)
- **Issue:** the file (last touched by an earlier, unrelated phase) carried 13 pre-existing U+2014 characters in docblock prose, unrelated to this task's own additions
- **Fix:** replaced all with hyphens (`python3` string-replace, verified 0 remaining)
- **Files modified:** lib/core/integration-registry.cjs
- **Commit:** ac24c602

**2. [Rule 3 - blocking issue] Regenerated `skills/doctor/SKILL.md` after editing `commands/doctor.md`**
- **Found during:** Task 2 commit attempt; pre-commit hook's `build-skill-mirrors --check` blocked the commit
- **Issue:** `commands/doctor.md`'s generated skill mirror went stale after the "5-layer" -> "7-layer" text correction
- **Fix:** `node scripts/build-skill-mirrors.cjs` (verified the diff mirrors only the source text change)
- **Files modified:** skills/doctor/SKILL.md
- **Commit:** 57d3a390

**3. [Rule 1 - bug] Theo's PLAN_REJECTED soft-refusal was silently mis-classified as success**
- **Found during:** Task 3, first live `--lane-b` run against Theo
- **Issue:** described in full under Task 3 above. `_runLaneBTheo`'s first cut checked only `r.ok`, missing Theo's `ok:true` + plain-text-refusal shape; C2/C3 rendered blank, C4's three sub-keys were dropped from the JSON entirely
- **Fix:** `_looksLikePlanRejection()` + `_theoQueryOutcome()` normalizer, applied at every `_runLaneBTheo` call site
- **Files modified:** scripts/build-brain-census.cjs
- **Commit:** aef768cf (same commit as the Theo lane itself; the bug was caught and fixed before that commit landed, so no separate fix commit was needed)

### Mid-task addendum (not a deviation from the plan's own instructions; a bounded, additive correction from the orchestrator, applied before Task 2's commit)

The orchestrator sent one mid-task message during Task 2, adding a fifth `trigger_evidence` fact to SEED-082 (`fact_5_live_smoke_addendum`), distinguishing a registry-authoring framework-ranking observation from a Theo live-smoke run from the reachable +11-edge sync target. It was additive-only, kept every existing negative guard intact (re-verified after applying), and was folded into Task 2's single commit since that task had not yet been committed when the message arrived.

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources introduced by this quick task.

## Deferred Issues

- `tests/test-262-unrecognized-shape-voids.cjs`: 4/11 subtests fail (Layer B: probeFramework against a loopback capture server), confirmed PRE-EXISTING via `git stash` before this quick task's changes and identical after. This test exercises `scripts/check-flagship-floor.cjs` only; it does not require or touch `scripts/build-brain-census.cjs`, so it is out of this quick task's scope per the SCOPE BOUNDARY rule. Logged in full at `.planning/quick/260911-axz-theo-qa-memo-follow-ups-doctor-detects-a/deferred-items.md` for a future debug session.

## Threat Flags

None. All threat-model dispositions (T-axz-01 through T-axz-06) were implemented as specified: the `readScopedMcpServers` projection is structural (never copies headers/url/env), `theo_health` projects only `{mode, build_sha}`, the L0 prepend was confirmed (not assumed) safe against the id/name-based acceptance gate, L0 never short-circuits L1-L6, and the shadow reader is proven (Test D) to consult only the Claude Code config path.

## Self-Check: PASSED

Verified on disk:
- `lib/core/integration-registry.cjs` - FOUND, exports `readScopedMcpServers`
- `lib/core/doctor/class-m-brain-smoke.cjs` - FOUND, `LAYERS.length === 7`, `THEO_NODE_FLOOR === 27000`
- `lib/core/doctor/class-m-brain-smoke.test.cjs` - FOUND, 22/22 passing
- `scripts/doctor.cjs` - FOUND, renders `origin_shadow` payload branch
- `tests/test-127-02-doctor-class-m.sh` - FOUND, 5/5 passing
- `docs/339-NOTE-theo-desktop-connector-key.md` - FOUND, Section 9 present
- `339-12-SUMMARY.md` - FOUND, dated note appended, append-only confirmed
- `SEED-082` - FOUND, `status: triggered`
- `CHANGELOG.md` - FOUND, Unreleased block filled
- `commands/doctor.md` - FOUND, "7-layer" present, "5-layer" absent
- `scripts/build-brain-census.cjs` - FOUND, `_runLaneBTheo`/`_isTheoStatsShape` present
- `data/brain-census.generated.json` - FOUND, `lane_b.theo_shape === true`, live counts 27951/39732/452
- `docs/BRAIN-GRAPH-CENSUS.generated.md` - FOUND, names Theo origin and 2026-09-11

Verified commits exist in `git log --oneline`:
- `ac24c602` - FOUND (Task 1)
- `57d3a390` - FOUND (Task 2)
- `aef768cf` - FOUND (Task 3)
