---
phase: 296-seed-030-rs-pipeline-spine-wiring-expert-graph-reconciliatio
plan: 05
subsystem: rs-pipeline
tags: [reverse-salient, rs_cache, rs_hybrid, pinecone-retirement, local-embedding, room-scoping, dispatch-chokepoint, node-test, canon-part-8, canon-part-9]

# Dependency graph
requires:
  - phase: 296-04
    provides: "lib/core/rs_cache.py rewritten onto a per-room local sidecar, room_dir keyword on get_namespace_freshness/upsert_corpus/fetch_all_from_namespace"
provides:
  - "scripts/rs-engine.py Mode B (run_mode_external) and Mode C (run_mode_hybrid) both wired onto the per-room local signal cache, with the SEED-018 semantic gate rebuilding its topic vector from the same encoder as the corpus it gates"
  - "lib/core/rs_hybrid.py's _load_external_records and build_unified_corpus threading room_dir end to end, closing the Mode C empty-external-corpus state 296-04 deliberately left open"
  - "lib/core/rs-pinecone-bridge.cjs bridging into the local signal cache via a roomDir 4th parameter and MINDRIAN_RS_ROOM, both Part 8 audit layers intact, PINECONE_API_KEY retired in favor of a room_scope_missing gate"
  - "lib/core/rs-differential-scorer.cjs's computeBertCosine and score() threading roomDir through to the bridge"
  - "tests/296-blast-radius.test.cjs: zero-key end-to-end proof (5 tests) plus the auto-explore-fire.cjs <-> rs-engine.py argv contract fence"
  - "scripts/auto-explore-fire.cjs's Phase 272-10 dispatch-chokepoint bypass named in source, comment-only change"
affects: [296-06, 296-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Narrate-then-degrade at both Mode B and Mode C entry points: _signal_cache_available(room_dir=...) is called once in run_mode_external (blocking -- gates the whole warm/cold branch) and once in run_mode_hybrid (non-blocking narration only, since build_unified_corpus's own _load_external_records degrades to an empty external side on its own once room_dir threads through it)"
    - "Room-scope gate replaces key-presence gate at every retired Pinecone boundary: scripts/rs-engine.py's _signal_cache_available, lib/core/rs_hybrid.py's _load_external_records bypass, and lib/core/rs-pinecone-bridge.cjs's queryPineconeWithVectors all moved from '(no key) -> bypass/error' to '(no room_dir, no MINDRIAN_RS_ROOM/MINDRIAN_ROOM env fallback) -> bypass/error', with the env-var fallback used specifically by the CJS bridge (roomDir threaded into the child's MINDRIAN_RS_ROOM so the embedded Python bridgeScript needs zero changes)"
    - "Rename pairs always land writer+reader in the same commit: _pinecone_values/_cached_values (scripts/rs-engine.py), pinecone_id/cache_id (lib/core/rs_hybrid.py, swept repo-wide for readers -- none existed outside the file), _pinecone_path_available/_signal_cache_available and _gate_records_pinecone/_gate_records_cached (both scripts/rs-engine.py, including their def-site docstrings which needed a second editing pass because the literal old names inside prose also tripped the acceptance-criteria greps)"
    - "Do-not-rename-for-shared-object reasoning: lib/core/rs-pinecone-bridge.cjs keeps its Pinecone-era filename permanently (or until a dedicated Phase 283 follow-up) because three unrelated modules (embedding-spine.cjs, hsi-lsa.cjs, hsi-engine.cjs) require it purely for the shared cosineSimilarity function object; a rename would fork that shared reference across all three"

key-files:
  created:
    - tests/296-blast-radius.test.cjs
  modified:
    - scripts/rs-engine.py
    - lib/core/rs_hybrid.py
    - lib/core/rs-pinecone-bridge.cjs
    - lib/core/rs-differential-scorer.cjs
    - lib/memory/test-rs-pinecone-bridge.cjs
    - scripts/auto-explore-fire.cjs

key-decisions:
  - "Followed the plan's planner_decision verbatim on Open Question 5: scripts/auto-explore-fire.cjs's --mode hybrid python3 spawn is NAMED (block comment citing rs-backend-dispatch.cjs and 272-10) and FENCED (argv contract test) but NOT rewired onto the Phase 272-10 dispatch chokepoint. No override taken -- the three stated reasons (resolveBackend() defaults to 'cjs' and rs-engine.cjs only implements Mode A internal today; turning tests/272-dispatch-chokepoint.sh green here would make 272's own acceptance state ambiguous; the real risk -- silent drift into all_pipelines_empty telemetry -- is closable without the rewiring) held up under implementation with no friction. bash tests/run-all-272.sh confirmed the two RED-by-design dispatch arms stayed red, exactly as the plan predicted as the correct outcome."
  - "Added a third call site to the renamed _signal_cache_available in scripts/rs-engine.py's run_mode_hybrid (Mode C), beyond the single existing run_mode_external call site the pre-repoint code had. The plan's action text said 'Update both call sites (run_mode_external and the Mode C path)' but 296-RESEARCH.md F-3 and a direct grep both confirmed no such Mode C call existed pre-repoint -- Pinecone entered Mode C only transitively, through lib/core/rs_hybrid.py's OWN independent bypass logic (Task 2's territory), never through scripts/rs-engine.py calling the Mode-B-only gate function directly. Interpreted this as an intentional strengthening the plan wanted: added a non-blocking narration call at the top of run_mode_hybrid (mirrors run_mode_external's gate, but does not block the hybrid path since build_unified_corpus degrades to an empty external side on its own once room_dir threads through). This also satisfies the acceptance criterion requiring at least 3 occurrences of the renamed function name in the file (def + 2 call sites)."
  - "Rewrote two def-site docstrings a second time after the first pass: 'Renamed from _pinecone_path_available' and 'Renamed from _gate_records_pinecone' initially preserved the OLD literal names inside prose for reader context, but the plan's own acceptance criteria run a raw grep for those old names across the WHOLE file (not comment/docstring-stripped for these two specific checks) and require a hard zero. Reworded to 'Renamed from the prior remote-key gate' / 'Renamed from the prior remote-cache gate' -- preserves the reader-facing intent (this used to be something else) without repeating the exact retired identifier."
  - "lib/memory/test-rs-pinecone-bridge.cjs's scenarios 2 and 3 previously set a fake PINECONE_API_KEY value purely to get past the bridge's old env-var gate (mock spawnSync was already installed to intercept the actual python3 call, so the key value itself was never consumed by real code). After the repoint that gate no longer exists; both scenarios now pass an explicit roomDir 4th argument to queryPineconeWithVectors to get past the new room-scope gate instead, with no other change to what each scenario actually verifies (python3-ENOENT graceful degrade; happy-path shape). This is a same-commit test fix directly caused by Task 2's own rename (Rule 1), not a deviation from the plan -- the plan's own read_first section named this exact test file as needing an update, though it called out only the first (missing-key) scenario explicitly."

requirements-completed: [RSLOCAL-01, RSLOCAL-03, RSLOCAL-04]

# Metrics
duration: ~30min
completed: 2026-09-03
---

# Phase 296 Plan 05: RS Pipeline Spine-Wiring + Expert-Graph Reconciliation Summary

**Threaded room scope through every consumer of the Phase 296-04 per-room local signal cache (scripts/rs-engine.py's Mode B and Mode C, lib/core/rs_hybrid.py's external loader, lib/core/rs-pinecone-bridge.cjs, lib/core/rs-differential-scorer.cjs), retired the last PINECONE_API_KEY gates on that path in favor of a room-scope gate, and named-but-deliberately-did-not-fix the scripts/auto-explore-fire.cjs Phase 272-10 dispatch-chokepoint bypass behind a new argv-contract test.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-09-03T21:56:36+03:00
- **Tasks:** 3/3 completed
- **Files modified:** 5 modified, 1 created

## Accomplishments

- **Task 1 (scripts/rs-engine.py):** `_pinecone_path_available` renamed to `_signal_cache_available` and re-gated on room resolution instead of `PINECONE_API_KEY`/`RS_EMBEDDING_MODEL=minilm`; called from both `run_mode_external` (blocking) and `run_mode_hybrid` (non-blocking narration, new call site). `room_dir` threaded into all three `rs_cache` calls in `run_mode_external`. `_gate_records_pinecone` renamed to `_gate_records_cached`, its topic vector now built via `rs_cache._embed_via_bridge` -- the SAME local encoder producing the record vectors it gates, closing the silent dimension-mismatch/no-op hazard the plan's objective called out as the most subtle item in this plan. `_pinecone_values` renamed to `_cached_values` at both writer (`_records_to_artifacts`) and reader (`_build_sem_matrix_from_records`) in the same edit. Deleted the now-dead `_embed_topic_via_pinecone` (its `PINECONE_API_KEY` check would otherwise have been the last live gate on this path) and replaced it with `_embed_topic_via_signal_cache`. Live-smoke-tested end to end against `tests/fixtures/296/stub-embed-bridge.cjs`: `upsert_corpus -> fetch_all_from_namespace -> _gate_records_cached -> _records_to_artifacts -> _build_sem_matrix_from_records` all round-trip correctly with `PINECONE_API_KEY` unset.
- **Task 2 (lib/core/rs_hybrid.py, lib/core/rs-pinecone-bridge.cjs, lib/core/rs-differential-scorer.cjs, lib/memory/test-rs-pinecone-bridge.cjs):** `_load_external_records` gained a `room_dir` parameter threaded into all three `rs_cache` calls; the `PINECONE_API_KEY`/`RS_EMBEDDING_MODEL=minilm` bypass branches were removed and replaced with a room-must-resolve bypass. `build_unified_corpus` now passes `room_dir=str(room_path_obj)`. `pinecone_id` renamed to `cache_id` in both corpus-dict builders; a repo-wide sweep (`grep -rn pinecone_id --include=*.py --include=*.cjs`) confirmed zero readers existed outside this file. `rs-pinecone-bridge.cjs` was deliberately NOT renamed (three modules require it purely for the shared `cosineSimilarity` function object) but gained a fourth `roomDir` parameter threaded into `MINDRIAN_RS_ROOM`, and swapped its `PINECONE_API_KEY` short-circuit for a `room_scope_missing` one -- both Part 8 audit layers (`auditQueryString`, `auditQueryObject`) kept exactly where they were. `rs-differential-scorer.cjs`'s `computeBertCosine` and `score()` thread `roomDir` through to both `queryPineconeWithVectors` calls; the `dim_mismatch` guard (RSLOCAL-04's runtime backstop) is unchanged in code, now protecting against a mixed-space compare instead of a Pinecone shape error. `test-rs-pinecone-bridge.cjs`'s scenario 1 now asserts `room_scope_missing`; scenarios 2/3 pass an explicit `roomDir` to reach the mocked spawnSync path. All 4 bridge scenarios + the A1 forbidden-pattern sweep pass; `test-rs-differential-scorer.cjs` (10/10) also verified green.
- **Task 3 (scripts/auto-explore-fire.cjs, tests/296-blast-radius.test.cjs):** Added a comment-only block above the unchanged `python3 --mode hybrid` spawn (verified via `git diff -U0 | grep -vc '^+\s*(//|\*|/\*)'` = 0 -- every added line is a comment) documenting the Phase 272-10 bypass, why it is not fixed here, what Phase 296 DID change underneath it, and why an argv-contract test exists. New `tests/296-blast-radius.test.cjs` (264 lines, 5 tests, runs in ~0.3s, well under the 15s budget): argv contract between the spawn and `rs-engine.py --help`; the leftover is named in source; `intelligence-cascade.cjs`/`futures/orchestrator.cjs` still route through `rs-backend-dispatch.cjs`; a zero-key `upsert_corpus -> fetch_all_from_namespace` round-trip through a temp room via the deterministic stub bridge (never invokes the real OpenAlex/arXiv/Tavily fetcher); and a combined zero-`PINECONE_API_KEY` sweep across `rs-engine.py`/`rs_hybrid.py`/`rs_cache.py`.

## Task Commits

Each task was committed atomically:

1. **Task 1: wire scripts/rs-engine.py Mode B and Mode C onto the per-room local cache** - `0ff16a3a` (feat)
2. **Task 2: thread room scope through rs_hybrid.py, the CJS bridge and the differential scorer** - `977ae6a5` (feat)
3. **Task 3: name the auto-explore dispatch leftover and fence the zero-key end-to-end path** - `7ad7b117` (test)

**Plan metadata:** pending (this SUMMARY + STATE/ROADMAP update commit)

## Files Created/Modified

- `scripts/rs-engine.py` - Mode B and Mode C wired onto the per-room local signal cache; `_signal_cache_available`, `_gate_records_cached`, `_cached_values` renames landed at both writer and reader
- `lib/core/rs_hybrid.py` - `_load_external_records` and `build_unified_corpus` thread `room_dir`; `pinecone_id` renamed to `cache_id`; module docstring's "stored in Pinecone" claim corrected
- `lib/core/rs-pinecone-bridge.cjs` - `roomDir` 4th parameter, `MINDRIAN_RS_ROOM` env threading, `room_scope_missing` gate replacing the `PINECONE_API_KEY` short-circuit, both Part 8 audit layers preserved, NOT renamed
- `lib/core/rs-differential-scorer.cjs` - `computeBertCosine`/`score()` thread `roomDir` through to the bridge; `dim_mismatch` guard's role reframed in its comment
- `lib/memory/test-rs-pinecone-bridge.cjs` - scenario 1 updated to the `room_scope_missing` tag; scenarios 2/3 updated to pass `roomDir` instead of a fake API key
- `scripts/auto-explore-fire.cjs` - comment-only addition naming the Phase 272-10 dispatch-chokepoint bypass; zero behavior change
- `tests/296-blast-radius.test.cjs` (new) - 5-test zero-key end-to-end proof plus the argv-contract fence

## Decisions Made

See `key-decisions` in frontmatter: (1) followed the plan's `planner_decision` on the auto-explore leftover verbatim, no override; (2) added a second (non-blocking) `_signal_cache_available` call site in `run_mode_hybrid` since none existed pre-repoint, both to satisfy the plan's stated "both call sites" instruction and its own >=3-occurrence acceptance criterion; (3) reworded two renamed-function docstrings a second time to drop the literal old identifier from prose after discovering the plan's own acceptance greps run un-stripped against those two specific renames; (4) fixed `test-rs-pinecone-bridge.cjs` scenarios 2/3 in the same commit as the bridge's gate-condition change, since they broke as a direct, same-task consequence of that rename (Rule 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] lib/memory/test-rs-pinecone-bridge.cjs scenarios 2 and 3 broke as a direct consequence of Task 2's gate-condition rename**
- **Found during:** Task 2, post-edit verification run of `node lib/memory/test-rs-pinecone-bridge.cjs`
- **Issue:** Scenarios 2 (`python3` absent) and 3 (happy path) set a fake `PINECONE_API_KEY` value purely to get past the bridge's old env-var gate before reaching the mocked `spawnSync`. After `queryPineconeWithVectors`'s `PINECONE_API_KEY` short-circuit was replaced with the new `room_scope_missing` gate, both scenarios immediately failed with `room_scope_missing` instead of exercising their intended mocked-`spawnSync` path (3/4 scenarios failing).
- **Fix:** Both scenarios now pass an explicit `roomDir` 4th argument to `queryPineconeWithVectors` to satisfy the new gate; scenario 1 was renamed and rewritten to assert the new `room_scope_missing` tag (this half was explicitly called out in the plan's own `read_first` for this file).
- **Files modified:** `lib/memory/test-rs-pinecone-bridge.cjs`
- **Verification:** All 4 scenarios + the A1 forbidden-pattern sweep pass (`4/4 passed`).
- **Committed in:** `977ae6a5` (Task 2 commit)

**2. [Rule 1 - Bug] Two def-site docstrings tripped the plan's own un-stripped rename-completeness greps**
- **Found during:** Task 1, post-edit verification (`grep -c '_pinecone_path_available' scripts/rs-engine.py` returned 1, not 0; same for `_gate_records_pinecone`)
- **Issue:** The new `_signal_cache_available` and `_gate_records_cached` docstrings initially said "Renamed from `_pinecone_path_available`" / "Renamed from `_gate_records_pinecone`" for reader context. The plan's acceptance criteria run a raw `grep -c` for the OLD names across the whole file with no comment/docstring stripping, so these prose mentions counted as live occurrences of the retired name.
- **Fix:** Reworded to "Renamed from the prior remote-key gate" / "Renamed from the prior remote-cache gate" -- keeps the reader-facing intent without repeating the retired identifier.
- **Files modified:** `scripts/rs-engine.py`
- **Verification:** `grep -c '_pinecone_path_available' scripts/rs-engine.py` and `grep -c '_gate_records_pinecone' scripts/rs-engine.py` both return 0; the corresponding new-name counts are >=3 and >=2 respectively, per the plan's acceptance criteria.
- **Committed in:** `0ff16a3a` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs directly caused by this plan's own renames, caught by the plan's own acceptance criteria and verification suites, not discovered later)
**Impact on plan:** Both fixes were necessary for the plan's own stated acceptance criteria to pass. No scope creep -- neither touched a file outside this plan's declared `files_modified` list.

## Issues Encountered

Running `node scripts/doctor.cjs --acceptance` during Task 3's plan-close verification left `package-lock.json`'s `version` field pointed at a stale value (`1.16.0-beta.12` instead of the repo's actual `2.0.0-beta.16`), most likely a side effect of the acceptance suite's `npx-roundtrip` check invoking `npm`. This was unrelated to any of this plan's declared files and was reverted with a targeted `git checkout -- package-lock.json` before the Task 3 commit, so no stray file ships in this plan's history. `node scripts/doctor.cjs --acceptance` re-run afterward: 18/18 points passed, clean tree confirmed.

`gsd-tools requirements mark-complete RSLOCAL-01 RSLOCAL-03 RSLOCAL-04` returned all three as `not_found`: `.planning/REQUIREMENTS.md` has no `## Phase 296` section at all (confirmed via `grep -n '^## \|^### '` -- the file's last registered phases are 267.2/257/254/272 etc, nothing named 296 or RSLOCAL/RSEXP/RSFENCE anywhere). This is a phase-registration gap from whenever `/gsd-plan-phase 296` ran, not something introduced by this plan and not something a plan-level executor should retroactively invent structure for (registering a phase's requirements section is a planning-step concern). 296-01 through 296-04's own `requirements-completed` frontmatter fields presumably hit the identical `not_found` outcome for their own IDs (RSFENCE-01, RSLOCAL-02, RSEXP-01/02) -- worth a `/gsd-plan-phase` or manual REQUIREMENTS.md registration pass for Phase 296 as a whole, not a per-plan fix.

## User Setup Required

None - no external service configuration required. This plan installs zero packages, adds zero dependencies, and does not touch `PINECONE_API_KEY` or the `pinecone` package's declaration in `requirements-hsi.txt` (per D-06, out of scope here and audited in plan 296-06).

## Tri-Polar / Cowork Note (per this plan's own `<verification>` section)

All three surfaces (CLI, Desktop, Cowork) reach Mode B and Mode C through the same `rs-engine.py` process, so this repoint is surface-neutral by construction -- no surface-specific code path was added or changed. The one surface-specific consequence worth recording, as the plan's own verification section required: the Cowork shared-warm-path behavior described in the OLD `rs_cache.py` docstring (one namespace per topic, shared across rooms) is now GONE, per Plan 296-04's per-room sidecar rewrite that this plan's callers now fully thread `room_dir` into. Two users in two different rooms working the same topic each fetch and embed once, independently, rather than sharing one cache entry. This is a correctness fix (closes SEED-029's F8 cross-room bleed finding) with a real cost (duplicated fetch/embed work across rooms on the same topic) -- named here rather than left to be discovered later as an unexplained latency/cost change.

## Next Phase Readiness

- `scripts/rs-engine.py`, `lib/core/rs_hybrid.py`, `lib/core/rs-pinecone-bridge.cjs`, and `lib/core/rs-differential-scorer.cjs` are all fully room-scoped now; no caller on this path depends on the `MINDRIAN_RS_ROOM`/`MINDRIAN_ROOM` env fallback for correct operation (the fallback still exists as a defensive default, per `lib/core/rs_cache.py`'s own `_resolve_room` precedence, but every real caller now passes an explicit room).
- `bash tests/run-all-296.sh` discovers 6 test files, `PASS=8 FAIL=0 SKIP=0`. `bash tests/run-all-272.sh` unchanged at `PASS=15 FAIL=0 SKIP=0` -- Phase 272's two RED-by-design dispatch arms (`tests/272-dispatch-chokepoint.sh`, `tests/272-rule6-amended.sh`) confirmed still red, exactly the required outcome per this plan's `<verification>` section.
- `scripts/auto-explore-fire.cjs`'s Phase 272-10 bypass is now a documented, tested, known-and-accepted state rather than a silent gap -- a future phase that completes 272-10's CJS Mode C can find this exact spawn site via the `rs-backend-dispatch`/`272-10` source references this plan added, and `tests/296-blast-radius.test.cjs` Test 1 will catch any argv drift between now and then.
- Plan 296-06 (per its own file already present in this phase directory) is the next wave; this plan's `key-decisions` and `Known Temporary State` notes from 296-04 are both now fully closed, with nothing deferred forward on the room-scoping front.

---
*Phase: 296-seed-030-rs-pipeline-spine-wiring-expert-graph-reconciliatio*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: scripts/rs-engine.py
- FOUND: lib/core/rs_hybrid.py
- FOUND: lib/core/rs-pinecone-bridge.cjs
- FOUND: lib/core/rs-differential-scorer.cjs
- FOUND: lib/memory/test-rs-pinecone-bridge.cjs
- FOUND: scripts/auto-explore-fire.cjs
- FOUND: tests/296-blast-radius.test.cjs
- FOUND: .planning/phases/296-seed-030-rs-pipeline-spine-wiring-expert-graph-reconciliatio/296-05-SUMMARY.md
- FOUND commit: 0ff16a3a (Task 1)
- FOUND commit: 977ae6a5 (Task 2)
- FOUND commit: 7ad7b117 (Task 3)
