---
status: resolved
kind: rca
trigger: "rs-engine-python-insert-not-null-and-detail-drop-regression"
issue_id: ""
severity: high
surfaces: [cli, desktop, cowork]
brain_mode: full-loop
canon_parts: [6, 7, 9]
created: 2026-08-24T00:00:00Z
updated: 2026-08-24T02:00:00Z
---

## Source-of-Truth Preamble

- **CODE claims read against:** `origin/main` HEAD @ `aeec1d93158dedded850c05da843e447ea8fc30d` (chore: bump to v2.0.0-beta.10, next pre-release) in the canonical workspace `/home/jsagi/dev/MindrianOS-Plugin`.
- **WIRE claims probe against:** local execution only. `python3 scripts/rs-engine.py --mode internal --room /home/jsagi/MindrianRooms/pws-website --topk 1` run directly on this dev machine; `node -e` invocation of `lib/agents/reverse-salient-agent.cjs` `detectAndSurface` against the same room. No Brain call involved in either reproduction (Canon Part 8 clean by construction: this is a LOCAL SQLite write failure).
- **Date of audit:** 2026-08-24
- **Re-verification rule:** both findings below were reproduced directly against `origin/main` HEAD in this session, not inferred from an old transcript. No re-verification pending.

## Current Focus

reasoning_checkpoint:
  hypothesis: "Two independent defects compound: (1) scripts/rs-engine.py's bare 3-column INSERT INTO nodes crashes with NOT NULL constraint failed: nodes.source_path on any Phase-109-migrated room.db, because it never received the schema-aware insert lib/core/node-insert.cjs's Phase-140-01 fix gave the 4 JS call sites; (2) lib/agents/reverse-salient-agent.cjs's detectAndSurface() failure-path early return reads only rs.reason off runRsEngine()'s result and drops rs.detail, silently regressing the Phase 127.2-03 F2 fix one call-frame up from where it still correctly executes."
  confirming_evidence:
    - "Direct pre-fix reproduction: `python3 scripts/rs-engine.py --mode internal --room pws-website --topk 1` raised exactly `rs-engine: error: NOT NULL constraint failed: nodes.source_path` (Evidence entry 2, this file)."
    - "Source read of detectAndSurface (pre-fix lines 345-347) showed `return { ok: false, reason: rs.reason, findings: [] }`, omitting `detail`, while runRsEngine (lines 174-214) demonstrably builds `detail: { message, diagnostic }` on the same failure (Evidence entry 4, this file)."
  falsification_test: "If wrong, the schema-aware wide insert would still throw NOT NULL against the same migrated room.db, OR detectAndSurface's patched return would still omit `detail` when the failure path is forced (via MINDRIAN_PYTHON pointed at a nonexistent binary, or a fake script that writes to stderr and exits 1)."
  fix_rationale: "Both fixes are minimal and target the exact confirmed defect, not a workaround: (1) branch scripts/rs-engine.py's INSERT on a PRAGMA table_info(nodes) schema check, mirroring node-insert.cjs's isMigratedSchema/insertNode contract verbatim (same provenance defaults pattern, distinct source_path handle 'system:rs-engine'); (2) add `detail: rs.detail` to the single early-return line in detectAndSurface -- restores the exact Phase 127.2-03 F2 contract without touching runRsEngine, which was already correct."
  blind_spots: "Did not test on Windows/Mac (cross-platform check deferred, same as the RCA's own Gate Compliance section states). Did not run the full /mos:find-bottlenecks command surface end-to-end through the actual dispatcher/session harness -- verified detectAndSurface() and scripts/rs-engine.py directly, which is what the command doc says the surface calls, but not through a live Claude Code session. The sibling-analyzer audit (see next_action below) WAS completed as part of this checkpoint: `grep -rn \"INSERT INTO nodes\" scripts/*.py lib/core/rs_*.py` returns exactly 2 hits, both inside the new `_upsert_node` helper in scripts/rs-engine.py (the migrated-schema branch and the legacy-schema branch) -- no sibling Python analyzer has its own copy of this insert, so the fix's blast radius is fully closed within this file."

hypothesis: Two independent defects compound: (1) `scripts/rs-engine.py` never received the Phase 140-01 NOT-NULL-safe node-insert fix that JS callers got, so it crashes on any room whose `room.db` carries the Phase-109 provenance schema; (2) `lib/agents/reverse-salient-agent.cjs`'s `detectAndSurface()` drops the `detail` field on the failure path, silently regressing the May 2026 Phase 127.2-03 fix (F2) that was supposed to forward the Python stderr diagnostic to the caller.
test: Ran `python3 scripts/rs-engine.py` directly against a real migrated room (`pws-website`) and read the raw stderr; separately ran `detectAndSurface()` via `node -e` against the same room and compared its returned object to what `runRsEngine()` actually produces internally. POST-FIX: re-ran both, plus RED/GREEN-verified both new regression tests by stashing each fix independently and confirming the test suite fails without it and passes with it restored.
expecting: `runRsEngine()` returns `{ ok: false, reason: 'rs_engine_invocation_failed', detail: { message, diagnostic } }` (per the Phase 127.2-03 fix); `detectAndSurface()` should pass `detail` through unchanged.
next_action: DONE. Sibling-analyzer audit completed (see blind_spots above): no other Python analyzer shares this insert path. Awaiting human verification that `/mos:find-bottlenecks` now works end-to-end in a live session against a real migrated room (see CHECKPOINT REACHED at end of session for exact steps).

## Meta

- Repo: /home/jsagi/MindrianOS-Plugin
- Plugin version: 2.0.0-beta.10 (Unreleased, dev HEAD)
- Reported by: live dogfood test of the beta.9 Roadmap-Type Selector (Phase 264), navigator-requested "try it on a random room"
- Date first observed: 2026-08-24
- Related debug sessions:
  - `.planning/debug/resolved/windows-tester-find-bottlenecks-silent-failure-qa-sweep.md` -- the PRIOR reverse-salient silent-failure RCA (2026-05-23, resolved as v1.13.0-beta.30). Different root cause (`ModuleNotFoundError: requests`, an env gap), but the SAME F2 fix this session found regressed: that RCA's resolution explicitly says `runRsEngine()`'s catch block was fixed to embed `e.stderr` into `result.detail.diagnostic`. That fix is still present and correct in `runRsEngine()` today. The regression is one call frame up, in `detectAndSurface()`, which was apparently added or reworked afterward (docblock references "Phase 89-07 Wave 2") without preserving `detail` on the failure path.

## Problem Statement

`/mos:find-bottlenecks` silently fails on any room whose `room.db` has the Phase-109 provenance schema, because `scripts/rs-engine.py` performs a bare 3-column node insert that violates the migration's NOT NULL constraints; the caller-facing error also lost the diagnostic detail that a prior fix (Phase 127.2-03) added specifically so this class of failure would self-explain.

## Symptoms

expected: `/mos:find-bottlenecks` either returns ranked reverse-salient candidates for the room, or fails with `result.detail.diagnostic` populated so the empty-result UX (per `commands/find-bottlenecks.md`) can disambiguate "no findings" from "analyzer down."
actual: `detectAndSurface()` returns `{ ok: false, reason: "rs_engine_invocation_failed", findings: [] }` with no `detail` field at all. The command's own documented recovery path ("look for `result.detail.diagnostic` in the agent payload") finds nothing to look at.
errors:
  - From direct `python3 scripts/rs-engine.py --mode internal --room /home/jsagi/MindrianRooms/pws-website --topk 1`: `rs-engine: error: NOT NULL constraint failed: nodes.source_path`
  - From `node -e` calling `detectAndSurface({ roomDir: '/home/jsagi/MindrianRooms/pws-website', sessionId: 'cc-session-test', mode: 'internal', topk: 1 })`: `{"ok":false,"reason":"rs_engine_invocation_failed","findings":[]}` (no `detail` key present)
reproduction:
  1. Bind a session to any room whose `room.db` was created or migrated after Phase 109 (adds `source_path`/`created_by`/`created_at`/`last_seen_at` NOT NULL columns to `nodes`) -- e.g. `/home/jsagi/MindrianRooms/pws-website`.
  2. Run `/mos:find-bottlenecks` (or directly: `python3 scripts/rs-engine.py --mode internal --room <roomDir> --topk 1`).
  3. Observe: the Python process crashes with `NOT NULL constraint failed: nodes.source_path` on the bare `INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)` at `scripts/rs-engine.py:447`.
  4. Observe separately: calling `lib/agents/reverse-salient-agent.cjs`'s `detectAndSurface()` for the same room returns `{ ok: false, reason: 'rs_engine_invocation_failed', findings: [] }` with no `detail` field, even though `runRsEngine()` (the function `detectAndSurface` calls internally) DOES compute a `detail: { message, diagnostic }` object on this exact failure path.
started: The node-insert defect started at Phase 109 (the provenance-column migration) for any room migrated since; it was never triggered before because Phase 140-01's `node-insert.cjs` fix (which covers 4 JS call sites) postdates Phase 109 and nobody audited the Python engine for the same defect class at the time. The `detail`-drop regression's start point is undated in this session; the docblock evidence points to "Phase 89-07 Wave 2" (persona-suffix + telemetry additions to `detectAndSurface`) as the point where the simple pass-through in the original Phase 127.2-03 fix was replaced by the current three-line early return that only forwards `reason`.

## Scope and Impact

- Affected surfaces: cli, desktop, cowork (the analyzer and the agent wrapper are shared code, not surface-specific).
- Affected commands: `/mos:find-bottlenecks` (confirmed directly). The resolved sibling RCA names five other Python-backed Engine 1 Act 1 surfaces sharing `rs-engine.py` / `rs_*.py` machinery -- `/mos:whitespace`, `/mos:find-connections`, `/mos:find-analogies`, `/mos:score-innovation`, `/mos:diagnostics` -- these are BLAST RADIUS, not independently confirmed in this session; see `next_action`.
- Affected users: every room whose `room.db` carries the Phase-109 wide `nodes` schema. Given Phase 109 shipped months before this session and rooms migrate on first touch, this is likely most active rooms at this point, not an edge case.
- Version range: node-insert defect present since Phase 109 shipped through at least v2.0.0-beta.10 (HEAD). `detail`-drop regression range unknown; needs `git log -p` on `detectAndSurface` to bisect the introducing commit.
- Severity: HIGH. This is the exact framework (Reverse Salient) the freshly-shipped beta.9 Roadmap-Type Selector (Phase 264) resolves into its `technical-roadmap` chain, so the newest feature's recommended first step is silently broken on migrated rooms.
- Blast radius: `lib/core/node-insert.cjs`'s own docblock (Phase 140-01, HARD-02) lists exactly 4 JS call sites it fixed (`scripts/hsi-to-graph.cjs`, and three call sites inside `lib/core/lazygraph-ops.cjs`). `scripts/rs-engine.py` is not and cannot be one of them (it is Python; `node-insert.cjs` is a Node module). Any OTHER Python script under `scripts/*.py` or `lib/core/rs_*.py` that writes to `nodes` with its own bare insert shares this exact defect class and was not checked in this session.

## Eliminated

- hypothesis: Missing Python dependencies (the `requests` package), matching the already-resolved May 2026 RCA.
  evidence: `python3 scripts/rs-engine.py` ran past the sentence-transformers model load (visible progress bar, `BertModel LOAD REPORT` printed) and only failed later, inside the SQLite write. `/mos:doctor --check-rs-engine`-class dependency issues would fail before any model load, not after. This is a different failure class from the resolved sibling RCA.
  timestamp: 2026-08-24T00:00:00Z

## Evidence

- timestamp: 2026-08-24T00:00:00Z
  checked: `node -e` direct call to `lib/agents/reverse-salient-agent.cjs` `detectAndSurface({ roomDir: '/home/jsagi/MindrianRooms/pws-website', ... })`
  found: `{"ok":false,"reason":"rs_engine_invocation_failed","findings":[]}`
  implication: the failure reaches the caller but with no diagnostic detail.
- timestamp: 2026-08-24T00:00:00Z
  checked: `python3 scripts/rs-engine.py --mode internal --room /home/jsagi/MindrianRooms/pws-website --topk 1` run directly (bypassing the Node wrapper)
  found: `rs-engine: error: NOT NULL constraint failed: nodes.source_path`
  implication: the Python engine's own SQLite write is the actual point of failure, not a Node-side wrapper bug alone.
- timestamp: 2026-08-24T00:00:00Z
  checked: `grep -n "INSERT INTO nodes" scripts/rs-engine.py`
  found: single hit, `scripts/rs-engine.py:447`: `"INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) "` -- the exact bare 3-column shape `lib/core/node-insert.cjs`'s docblock names as HARD-02's root cause.
  implication: `rs-engine.py` never received the equivalent of the Phase 140-01 fix; it cannot, since that fix is a JS module.
- timestamp: 2026-08-24T00:00:00Z
  checked: `lib/agents/reverse-salient-agent.cjs` lines 174-214 (`runRsEngine`) versus lines 337-356 (`detectAndSurface`)
  found: `runRsEngine`'s catch block correctly builds `detail: { message, diagnostic }` (or a plain string) per the Phase 127.2-03 fix. `detectAndSurface`, at its own failure branch (`if (!rs.ok) { return { ok: false, reason: rs.reason, findings: [] }; }`), does not read or forward `rs.detail` at all.
  implication: the Phase 127.2-03 F2 fix ("agent forwards stderr to result.detail.diagnostic") is intact one call-frame down but unreachable from the public `detectAndSurface` entry point that `/mos:find-bottlenecks` actually calls per its own command doc.
- timestamp: 2026-08-24T00:00:00Z
  checked: `.planning/debug/resolved/windows-tester-find-bottlenecks-silent-failure-qa-sweep.md` (the prior resolved RCA)
  found: root cause was `ModuleNotFoundError: requests` (an environment gap), fully distinct from today's `NOT NULL constraint failed: nodes.source_path`. The F2 fix it shipped is the SAME code path this session finds regressed.
  implication: this is a new, independent finding, not a reopening of the resolved sibling.
- timestamp: 2026-08-24T01:00:00Z
  checked: applied Change 1 (schema-aware `_upsert_node` helper + `_nodes_table_is_migrated` PRAGMA check in `scripts/rs-engine.py`), then re-ran the EXACT reproduction command against the same real room (`pws-website`, confirmed still on the migrated 16-column schema via `PRAGMA table_info(nodes)`).
  found: `rs-engine: 1/68 pairs written to .../.rs-engine-results.json (model=all-MiniLM-L6-v2, edges=1)`, exit code 0, no `NOT NULL` error. Queried `nodes` directly: new rows carry `source_path='system:rs-engine'`, `created_by='system'`, populated epoch-ms `created_at`/`last_seen_at`; `SELECT COUNT(*) FROM nodes WHERE source_path IS NULL` = 0.
  implication: Change 1 verified against the original real-room reproduction, not just a synthetic fixture.
- timestamp: 2026-08-24T01:00:00Z
  checked: applied Change 2 (`detail: rs.detail` added to `detectAndSurface`'s failure-path return), then called `detectAndSurface()` twice via `node -e`: once with `MINDRIAN_PYTHON` pointed at a nonexistent binary (ENOENT, no stderr), once against the real room with the Change-1 fix applied (success path).
  found: ENOENT case returns `{ ok:false, reason:'rs_engine_invocation_failed', detail:'spawnSync /nonexistent/python3 ENOENT', findings:[] }` (detail now present, was absent pre-fix); success case returns `{ ok:true, findingsCount:1 }`.
  implication: Change 2 verified; `detail` now survives to `detectAndSurface`'s public return in both the failure and success paths without disturbing the success shape.
- timestamp: 2026-08-24T01:00:00Z
  checked: RED/GREEN discipline on both new regression tests -- `git stash push -- scripts/rs-engine.py` then re-ran `tests/test-rs-engine-node-insert-provenance.sh`; separately `git stash push -- lib/agents/reverse-salient-agent.cjs` then re-ran `node --test tests/test-reverse-salient-agent.cjs`; restored both stashes after.
  found: without Change 1, the new integration test fails 3/5 checks with the exact `NOT NULL constraint failed: nodes.source_path` error reproduced live inside the test; without Change 2, exactly the 2 new detail-forwarding unit tests fail (23/25 still pass, proving the tests are specific to the regressed behavior, not a false positive from something else breaking).
  implication: both new tests are proven to catch the exact regression they were written for, not just proven to pass post-fix.
- timestamp: 2026-08-24T01:00:00Z
  checked: `grep -rn "INSERT INTO nodes" scripts/*.py lib/core/rs_*.py` (the deferred sibling-analyzer audit from next_action)
  found: exactly 2 hits, both inside the new `_upsert_node` helper in `scripts/rs-engine.py` (the migrated-schema branch and the legacy-schema branch). No other `scripts/*.py` or `lib/core/rs_*.py` file has its own `INSERT INTO nodes`.
  implication: the fix's blast radius is fully closed; no sibling Python analyzer (`/mos:whitespace`, `/mos:find-connections`, `/mos:find-analogies`, `/mos:score-innovation`, `/mos:diagnostics`) has an independent copy of this bug class within this repo as of HEAD.

## Technical Root Cause

- Site 1: `scripts/rs-engine.py:447`, the node-write function (unnamed in this session's read; the bare insert statement itself).
  - Cause: `INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)` omits the four NOT NULL provenance columns (`source_path`, `created_by`, `created_at`, `last_seen_at`) that the Phase-109 migration (`lib/core/migrations/phase-109-nodes-provenance.cjs`) added to `nodes`. This is the exact defect class `lib/core/node-insert.cjs` (Phase 140-01, HARD-02) was built to eliminate, but that fix only covers 4 JS call sites; `rs-engine.py` is Python and was never touched.
  - Why it surfaces now: any room whose `room.db` is on the migrated (wide) schema hits this on every `/mos:find-bottlenecks` run. `pws-website`'s room.db is migrated; the failure is deterministic, not intermittent.
- Site 2: `lib/agents/reverse-salient-agent.cjs:345-347`, function `detectAndSurface`.
  - Cause: `if (!rs.ok) { return { ok: false, reason: rs.reason, findings: [] }; }` reads only `rs.reason` off `runRsEngine()`'s return value and drops `rs.detail`, even though `runRsEngine()` (lines 174-214) populates `detail` specifically so this information survives to the caller.
  - Why it surfaces now: undetermined without a `git blame`/`git log -p` on this function; docblock context ("Phase 89-07 Wave 2 -- F.0 dispatch + persona suffix + telemetry mirror") suggests `detectAndSurface` was reworked after the May 2026 fix landed, and the rework's early-return on failure was not written against the Phase 127.2-03 contract.

## Required Code Changes

- Change 1:
  - Location: `scripts/rs-engine.py`, the node-write insert (around line 447)
  - Current behavior: bare `INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)`, no provenance columns.
  - Required behavior: detect the schema (mirror `lib/core/node-insert.cjs`'s `isMigratedSchema` PRAGMA-based detection, ported to Python's `sqlite3`) and, on the migrated (wide) schema, supply `source_path` (a synthetic handle, e.g. `'system:rs-engine'`), `created_by='system'`, `created_at`, `last_seen_at` alongside `id`/`type`/`properties`. On the legacy 3-column schema, keep the existing bare insert.
  - Short-term patch: hard-code the wide insert with the same system-provenance defaults `node-insert.cjs` uses (`SYSTEM_SOURCE_PATH = 'system:hsi-to-graph'` is the JS precedent; use an analogous `'system:rs-engine'` handle so RS-written nodes are distinguishable from HSI-written ones), guarded by the same PRAGMA `table_info(nodes)` schema check so a legacy 3-column room.db does not break.
  - Long-term fix: extract a single Python helper (e.g. `lib/core/rs_node_insert.py`) mirroring `node-insert.cjs`'s contract, and route every bare `INSERT INTO nodes` in `scripts/rs-engine.py` and any sibling `lib/core/rs_*.py` file through it, closing the reuse-before-build gap between the JS and Python insert paths permanently instead of patching one call site.
- Change 2:
  - Location: `lib/agents/reverse-salient-agent.cjs:345-347`, function `detectAndSurface`
  - Current behavior: `if (!rs.ok) { return { ok: false, reason: rs.reason, findings: [] }; }`
  - Required behavior: forward `rs.detail` unchanged: `if (!rs.ok) { return { ok: false, reason: rs.reason, detail: rs.detail, findings: [] }; }`
  - Short-term patch: the one-line change above restores the Phase 127.2-03 contract immediately.
  - Long-term fix: add a regression test asserting `detectAndSurface`'s failure-path return value is a superset of `runRsEngine`'s failure-path return value (so a future rework of `detectAndSurface` cannot silently drop a field again without a test failing).

## Tests to Add or Update

- Test 1:
  - Type: integration
  - Location: `tests/test-rs-engine-node-insert-provenance.sh` (new)
  - Given: a room.db migrated to the Phase-109 wide `nodes` schema, with at least one artifact indexed
  - When: `python3 scripts/rs-engine.py --mode internal --room <roomDir> --topk 1` is run directly
  - Then: exit code 0, no `NOT NULL constraint failed` in stderr, and `nodes` gains rows with `source_path` populated (not NULL)
- Test 2:
  - Type: unit
  - Location: `lib/agents/reverse-salient-agent.test.cjs` (extend existing test file if present, else new)
  - Given: `runRsEngine` mocked to return `{ ok: false, reason: 'rs_engine_invocation_failed', detail: { message: 'x', diagnostic: 'y' }, pairs: [] }`
  - When: `detectAndSurface(...)` is called
  - Then: the returned object includes `detail: { message: 'x', diagnostic: 'y' }`, not just `reason`
- Test 3:
  - Type: e2e / smoke
  - Location: extend `tests/test-127.2-03-rs-engine-silent-failure-fixes.sh` (the existing sibling-RCA smoke test) with a case for the NOT-NULL failure mode, so both known rs-engine failure classes (missing deps, schema mismatch) are covered by the same suite
  - Given: a migrated room.db
  - When: `/mos:find-bottlenecks`'s agent-first flow runs
  - Then: `result.detail.diagnostic` contains the SQLite constraint error text, proving the empty-result UX (per `commands/find-bottlenecks.md`) can actually disambiguate this case

## Non-Code Follow-ups

- CHANGELOG.md: add a Fixed entry under the next Unreleased/beta version once Changes 1-2 land.
- Release lockstep: applies once shipped (see `.claude/includes/release-process.md`).
- Canon: none directly touched (Canon Part 9 governs typed-edge writes through `navigation.cjs`; this defect is a raw `nodes` table write from a script that predates that chokepoint being mandatory for system-bookkeeping node types -- worth a separate question of whether `rs-engine.py`'s node writes should route through `navigation.cjs` at all, but that is a bigger structural question than this RCA's scope).
- knowledge-base.md: add a summary block on resolve, cross-referencing the resolved sibling RCA so a future reader does not conflate the two failure classes.
- Audit ask: someone should grep every `scripts/*.py` and `lib/core/rs_*.py` file for `INSERT INTO nodes` to confirm whether other Python analyzers (whitespace, find-connections, find-analogies, score-innovation, diagnostics) share `rs-engine.py`'s insert code path or have their own copy of the same bug. Not done in this session (see `next_action`).

## MindrianOS Gate Compliance (RCA Section 5)

- **Canon Part 8 (Brain boundary):** PASS. Both findings are LOCAL SQLite / LOCAL Node-process failures. No Brain call is involved in either reproduction or either proposed fix.
- **Tri-Polar (CLI / Desktop / Cowork):** all three affected identically; the agent and the Python script are shared code with no surface-specific branch. Not independently re-verified on Desktop/Cowork in this session (CLI-only reproduction); verified-by-construction for the other two given the shared code path.
- **Cross-platform:** the schema-detection approach mirrors `node-insert.cjs`'s existing PRAGMA-based approach, which is already cross-platform-safe (pure SQLite, no OS-specific behavior). Not independently tested on Windows/Mac in this session.
- **Release lockstep:** applies once the fix ships; not yet actioned.
- **No em-dashes:** PASS. This file uses hyphens only.
- **Reuse-before-build (Canon Part 7):** PASS by design. The proposed fix explicitly reuses `node-insert.cjs`'s existing schema-detection contract and system-provenance-default pattern, ported to Python, rather than inventing a new insert convention.

## Specialist Review

- Reviewer: senior Python/SQLite code review (specialist_hint: python; the named skill
  `python-expert-best-practices-code-review` is not registered as an agent in this environment,
  so the review ran via a general-purpose agent explicitly framed as a senior Python/SQLite
  reviewer, given the live diff and told to read `scripts/rs-engine.py` and
  `lib/core/node-insert.cjs` directly rather than trust the summary alone).
- Verdict: **LOOKS_GOOD.**
- Findings: `conn.execute` usage is consistent (connection-level shortcut, no separate cursor to
  leak); single `conn.commit()` after the loop and `conn.close()` in `finally` -- correct resource
  handling, no regression vs. the prior pattern. Timestamp units confirmed correct: `datetime.now
  (timezone.utc).timestamp()` returns UTC POSIX seconds regardless of the attached tz, so `* 1000`
  truncated to int matches JS `Date.now()` epoch-ms exactly -- no unit/timezone mismatch. The
  `ON CONFLICT` clause on the migrated path only touches `properties`/`last_seen_at`, correctly
  leaving `source_path`/`created_by`/`created_at` untouched on repeat writes. `_nodes_table_is_migrated`
  defaulting to legacy on PRAGMA failure is safe, since the wide insert would itself throw on a true
  legacy table (same rationale as the JS original). Schema detection is once-per-call with no
  cross-call caching (each call opens its own fresh `conn`), so no staleness risk.
- Non-blocking nit: `node-insert.cjs`'s `ON CONFLICT` also refreshes `type = excluded.type`; the
  Python port's `DO UPDATE` never touches `type` in either branch. This mirrors the *pre-existing*
  Python behavior (the original 3-column insert also omitted `type` from its update clause) -- not
  a regression introduced by this fix -- and is inert in practice since both call sites always
  upsert with the constant type `"Artifact"`. Not worth blocking the fix on; noted as a follow-up
  if `_upsert_node` is ever extended to write non-Artifact node types.
- No changes made as a result of this review; fix proceeds as implemented.

## Resolution

root_cause: CONFIRMED, both findings. (1) `scripts/rs-engine.py`'s bare 3-column `INSERT INTO nodes` never received a Phase-140-01-equivalent schema-aware insert, so it violates the Phase-109 migration's NOT NULL provenance columns on any migrated room.db. (2) `lib/agents/reverse-salient-agent.cjs`'s `detectAndSurface()` failure-path early return read only `rs.reason` and dropped `rs.detail`, even though `runRsEngine()` already computes it correctly (Phase 127.2-03 F2) -- the introducing commit for this specific regression was not individually bisected (would require `git log -p` on `detectAndSurface`), but the defect itself (the dropped field on the current HEAD) is directly confirmed by reading the code and by the forced-failure reproduction, independent of when it was introduced.
fix: Change 1 -- added `_nodes_table_is_migrated()` (PRAGMA table_info(nodes) check) and `_upsert_node()` (schema-branching insert with `source_path='system:rs-engine'`, `created_by='system'`, epoch-ms `created_at`/`last_seen_at` on the migrated branch) to `scripts/rs-engine.py`, and routed both artifact-node upserts in `write_reverse_salient_edges` through it. Mirrors `lib/core/node-insert.cjs`'s `isMigratedSchema`/`insertNode` contract exactly, ported to Python's `sqlite3`. Change 2 -- `detectAndSurface`'s failure-path return in `lib/agents/reverse-salient-agent.cjs` now includes `detail: rs.detail` alongside `reason` and `findings`.
verification: Self-verified (see Evidence entries 6-9, this file): (a) exact original reproduction command re-run against the real `pws-website` room now exits 0, writes nodes with populated `source_path`, zero NULL rows; (b) `detectAndSurface()` now forwards `detail` in both the ENOENT-no-stderr string shape and the stderr-present `{message, diagnostic}` object shape, without disturbing the `ok:true` success shape; (c) both new tests independently RED-failed against the pre-fix code and GREEN-passed with the fix restored, proving they catch the exact regression and are not false positives; (d) full `tests/test-reverse-salient-agent.cjs` suite (25 tests) and `tests/test-127.2-03-rs-engine-silent-failure-fixes.sh` (8 checks) and new `tests/test-rs-engine-node-insert-provenance.sh` (5 checks) all pass; (e) sibling-analyzer audit confirms no other Python analyzer shares this insert path. HUMAN-CONFIRMED 2026-08-24: independently re-ran the exact repro against `pws-website` in a live session (not just trusting the self-verification above) -- `python3 scripts/rs-engine.py` wrote 1/68 pairs successfully with no NOT NULL error, and `detectAndSurface()` returned a real finding (`team-execution` lagging vs `mindrian-page`, `signed_diff=0.6522`). Specialist review (Python/SQLite, general-purpose agent standing in for the unregistered `python-expert-best-practices-code-review` skill) returned LOOKS_GOOD with one non-blocking nit (see `## Specialist Review`). CHECKPOINT closed.
files_changed:
  - scripts/rs-engine.py (added `_now_ms`, `_nodes_table_is_migrated`, `_upsert_node`; routed `write_reverse_salient_edges`'s two artifact-node upserts through the new helper)
  - lib/agents/reverse-salient-agent.cjs (`detectAndSurface` failure-path return now includes `detail: rs.detail`)
  - tests/test-rs-engine-node-insert-provenance.sh (new; RCA Test 1)
  - tests/test-reverse-salient-agent.cjs (extended; RCA Test 2, 2 new regression tests)
  - tests/test-127.2-03-rs-engine-silent-failure-fixes.sh (extended; RCA Test 3 adaptation, Check 8)
commits: []
