# Phase 273: SQLite Graph Chokepoint Hardening (writeEdge silent-failure + propagation-gap fixes) - Research

**Researched:** 2026-08-31
**Domain:** Node `node:sqlite` write-path integrity in `lib/core/navigation/*` (the Canon Part 9 chokepoint)
**Confidence:** HIGH (every finding below was re-executed against this checkout, not read off the review)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fix scope**
- **D-01:** Land the two highest-value fixes now: make `writeEdge`
  (`lib/core/navigation/edges.cjs:833-842`) `changes`-aware (check `run()`'s actual `changes`
  count, don't just return `ok: true` because the query didn't throw), and add the same
  `PRAGMA table_info(edges)` fallback `node-insert.cjs` already uses for `nodes` so `writeEdge`
  degrades gracefully against a `lazygraph-ops.openGraph` handle missing the `review_status`
  column instead of throwing `table edges has no column named review_status`. Per the
  reviewer's own verdict, this single change closes C1 and C2 together, in one function.
- **D-02:** Full propagation of the same fix pattern to its ~20 sibling openers (C4's
  busy-timeout gap), the other 8 `BEGIN` sites lacking the nested-transaction guard (M6), the
  3 migrations with unguarded `ROLLBACK` (M7), and the 33+ call sites not yet consuming typed
  errors (C5/M8) is explicitly OUT of this phase's scope -- registered as a fast-follow phase,
  not silently dropped. Rationale: the two-fix core is landable and high-value on its own;
  full propagation is roadmap-scale work in its own right and would make this phase sprawl.

**C3 -- Brain edge-type allowlist bypass**
- **D-03:** Fix defensively, do not spend phase time investigating whether
  `lib/core/navigation/ingestion.cjs:57`'s raw `INSERT OR IGNORE` (which bypasses
  `ALLOWED_EDGE_TYPES` and `writeEdge` entirely) was a deliberate Phase 109-08 exemption or an
  artifact of predating Phase 125-00's `writeEdge`. Route the Brain-ingestion edge write
  through `writeEdge` (or apply the same allowlist check inline if routing through `writeEdge`
  is structurally awkward for the ingestion call shape) regardless of original intent -- a
  remote-controlled bypass of a closed allowlist is a real integrity risk either way, and the
  fix is small and contained. Do not lose the reviewer's own open question (`specs/...code-review.md`
  §6 Q3) -- record it as answered-by-fix, not investigated, in case the historical intent
  matters later.

**M2 -- cross-room aggregation fence**
- **D-04:** Fix the comment only. The fence already holds structurally: `writeEdge` takes
  `(db, params)` and is physically incapable of opening a second room's db, so the
  enforcement is real even though it isn't an explicit runtime assertion. Correct
  `lib/core/navigation/edges.cjs:45`'s comment to describe the actual mechanism (a structural
  guarantee via function signature) rather than implying a checked invariant that doesn't
  exist in code. Do not add a new runtime assertion in this phase -- no reproduced or
  hypothesized code path exists where a room's db handle is swapped mid-call, so the added
  defense-in-depth has no identified failure mode to catch yet.

**M4 -- substrate baseline drift (195 documented vs 208 measured)**
- **D-05:** Burn the debt down before touching the baseline number. Re-run
  `scripts/check-substrate.cjs --baseline` after D-01/D-02/D-03 land and measure how much of
  the 195->208 delta those fixes already close (C3's raw `INSERT OR IGNORE` is itself one of
  the 55+ raw-write sites the guard counts, so closing it directly reduces the count). Only
  after that re-measurement does `docs/architecture/SUBSTRATE-BASELINE.md` get updated to the
  new honest number -- never regenerated at 208 as a first move, since that would launder
  debt this same phase is positioned to reduce. If sites remain that are genuinely out of this
  phase's fix scope (e.g. debt belonging to the C4/M5-M8 fast-follow), the baseline update
  documents that explicitly rather than silently absorbing it.

### Claude's Discretion
- Exact commit/wave sequencing of D-01 through D-04 (e.g., whether C1/C2's shared fix and
  C3's allowlist fix land in the same commit or separate ones) -- not dictated beyond "the
  two-fix core (D-01) is the highest-priority single change."
- Whether C3's fix routes through `writeEdge` directly or applies an equivalent inline
  allowlist check -- planner/researcher should confirm which is structurally cleaner against
  `ingestion.cjs`'s actual call shape before committing to one.

### Deferred Ideas (OUT OF SCOPE)
- **Full propagation sweep (C4's ~20 openers, M5 BEGIN-IMMEDIATE, M6's 8 remaining
  nested-tx-guard sites, M7's 3 unguarded-ROLLBACK migrations, M8's retry/backoff contract,
  M9's runtime Node-floor assertion, M10's unguarded JSON.parse, M11's hand-rolled SQL
  escaper)** -- explicitly out of scope per D-02, registered as a fast-follow phase once the
  two-fix core (D-01) and C3/M2/M4 (D-03/D-04/D-05) land.
- **M12 schema unification / U-2 bidirectional traversal via the `simple-graph` reference
  pattern** -- named in ROADMAP.md as a reference to plan against, not this phase's scope.
- **SEED-075** (ICM semantic substrate provenance/dependency graph) -- gated on this phase's
  Criticals landing first.
</user_constraints>

## Summary

Every citation in the code review and in CONTEXT.md was re-read against the live tree, and
all three in-scope Critical defects (C1, C2, C3) were re-reproduced empirically on this
checkout at Node v22.23.1. **The findings hold. The line numbers are accurate to within one
line.** No re-investigation of the bugs themselves is needed -- the planner can treat C1/C2/C3
as proven and go straight to fix design.

Three things the planner must know that the review and CONTEXT.md do **not** say:

1. **D-05's stated rationale is factually wrong, and the phase must not act on it.** CONTEXT.md
   D-05 asserts "C3's raw `INSERT OR IGNORE` is itself one of the 55+ raw-write sites the guard
   counts, so closing it directly reduces the count." It is not counted, for two independent
   reasons, both verified by execution: `lib/core/navigation/` is path-allowlisted at
   `check-substrate.cjs:70`, AND `RE_RAW_WRITE` does not match `INSERT OR IGNORE INTO` at all.
   Fixing C3 will change the substrate count by **exactly zero**. D-05's *procedure* (measure
   after, then update honestly) is still right; its *expected outcome* (a number below 208) is
   not achievable by this phase's fix set. Plan D-05 as "re-measure, expect 208, document why
   the delta did not move, and attribute the 195->208 growth."

2. **Changing `writeEdge`'s `ok` semantics is a live regression risk with a 43-file blast
   radius.** 77 call sites across 43 files call `writeEdge`; ~30 branch on `.ok`, and at least
   three treat `!ok` as fatal: `room-birth.cjs:948` throws `nested_within_write_failed` and
   rolls back an entire room birth, `rs-sqlite-mirror.cjs:423` throws, and
   `breakthrough/schema.cjs:138` aborts its transaction. If the C1 fix flips `ok` to `false`
   when the confirmed-guard suppresses a write, a re-birth or re-derivation against a
   human-confirmed edge starts hard-failing where it used to succeed. The review's own
   suggested shape -- keep `ok: true`, add an additive `written: boolean` (+ `reason` when
   `written === false`) -- is the only shape that is safe without auditing all 43 files.

3. **Question 5 is settled: the C2 fix belongs entirely inside `writeEdge`, not in
   `openGraph`.** A `lazygraph-ops.openGraph` handle has exactly three tables (`nodes`,
   `edges`, `stakeholders`) -- verified by execution. It has **no `identity` table**, and the
   Phase 224 migration writes its idempotency sentinel into `identity`. So `openGraph` cannot
   run the migration without also running `memory-ops.initMemorySchema` and the whole Phase
   109/160/222 chain, which is M12 and explicitly deferred. Additionally `room-db.cjs:31`
   requires `lazygraph-ops.cjs` at module top level, so a top-level reverse require would be
   circular. CONTEXT.md's D-01 reading (writeEdge-side `PRAGMA table_info(edges)` detection +
   fallback) is structurally correct and is the only non-M12 option.

**Primary recommendation:** One function change in `edges.cjs::writeEdge` -- probe
`PRAGMA table_info(edges)` for `review_status`, branch to a 5-column or 4-column statement,
capture `run().changes`, and return `{ ok: true, written: changes > 0, reason? }` -- plus a
6-line inline `ALLOWED_EDGE_TYPES` guard in `ingestion.cjs`, plus a comment edit at
`edges.cjs:45`, plus an honest amendment (not a regeneration) to SUBSTRATE-BASELINE.md.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Edge write validation (allowlist, review_status enum, byUser gate) | Chokepoint primitive (`navigation/edges.cjs`) | -- | Canon Part 9: one door. Already lives here; C3's fix moves the last bypass in. |
| Schema-shape detection (which `edges` columns exist) | Chokepoint primitive (`edges.cjs`) | -- | The handle's provenance is unknowable to the caller; only the write site can probe it. Mirrors `node-insert.cjs` for `nodes`. |
| Schema creation / migration | Storage opener (`room-db.cjs` chain, `lazygraph-ops.initSchema`) | -- | Out of scope (M12). This phase must NOT move responsibility here. |
| Write-outcome signalling to callers | Chokepoint return contract | 43 caller files | Contract change is additive-only; caller tier is not touched this phase. |
| Substrate-debt accounting | CI guard (`scripts/check-substrate.cjs`) + doc (`SUBSTRATE-BASELINE.md`) | -- | Measurement tier, separate from the fix tier. D-05 only reads the guard, never edits it (regex fix is M3, deferred). |

## Citation Verification (Priority 1)

Every location cited by the code review and CONTEXT.md, re-read on `main` at
`508ba0458` + untracked `specs/`. **Verdict: no material drift.**

| Cited as | Actual | Status |
|----------|--------|--------|
| `edges.cjs:833-842` writeEdge INSERT + return | `writeEdge` spans **790-843**; the INSERT statement is **833-838** (`db.prepare(` opens at 834, SQL text 835-837, `.run(...)` at 838); catch 839-841; `return { ok: true, ... }` at **842** | ✅ EXACT |
| `edges.cjs:835` names `review_status` unconditionally | Line 835 is `'INSERT INTO edges (source, target, type, properties, review_status) VALUES (?, ?, ?, ?, ?) '` | ✅ EXACT |
| `edges.cjs:832` phantom `edgeId` mint | Line 832: `const edgeId = 'edge:' + edge_type + ':' + Date.now() + ':' + crypto.randomBytes(4)...` | ✅ EXACT (M1, not in scope) |
| `edges.cjs:45` cross-room fence comment | Line 45: `//   never crosses to Brain. Cross-room aggregation forbidden (Phase 8 cross-room fence).` | ✅ EXACT |
| Same comment "again at :64, :236, :746" | Confirmed at 64, 236, 746 -- **and also at 269, 366, 419, 583, 629, 667, 705**. The phrase occurs **11 times**, not 4 | ⚠️ UNDERCOUNT (see D-04 note below) |
| `ingestion.cjs:57` raw `INSERT OR IGNORE` | The statement is at **line 56**, not 57 | ⚠️ OFF BY ONE |
| `ingestion.cjs:53` "only validation is that source/target/type are strings" | The type guard is at **line 50** | ⚠️ OFF BY THREE |
| `ingestion.cjs:8-9` Part 9 header claim | Lines 3-4 carry `Canon Part 9 LOAD-BEARING: Brain CAN'T write trusted memory.` / `Every brain_insight row: created_by='brain', review_status='proposed'...` | ⚠️ OFF BY FIVE (content correct) |
| `ingestion.cjs:42-43` node-side enforcement | Node INSERT is at **42-45**, with `'brain'` / `'proposed'` literals on line 44 | ✅ SUBSTANTIALLY EXACT |
| `node-insert.cjs:68-75` PRAGMA fallback pattern | `isMigratedSchema()` spans exactly **68-75** | ✅ EXACT |
| `node-insert.cjs:68-119` probe + branch | `isMigratedSchema` 68-75, `insertNode` 95-120, branch at 100-119 | ✅ EXACT |
| `lazygraph-ops.cjs:426-442` `openGraph` | `openGraph` spans exactly **426-442**; `new DatabaseSync(dbPath)` (no options) at **434** | ✅ EXACT |
| `lazygraph-ops.cjs:176-182` base `edges` schema | `initSchema` starts at **158**; `CREATE TABLE IF NOT EXISTS edges` spans **177-183** | ⚠️ OFF BY ONE |
| `room-db.cjs:279-303` migration chain | `lazygraph.initSchema(db)` at 282; chain through `runPhase224EdgeReviewStatus(db)` at **303** | ✅ EXACT |
| `room-birth.cjs:940-947` `!ok` throw | `edges.writeEdge(...)` call opens at **941**; `if (!nwRes \|\| !nwRes.ok)` at **948**; throw at **949** | ⚠️ OFF BY ONE |
| `check-substrate.cjs:132` `RE_RAW_WRITE` | Line 132 exactly | ✅ EXACT |
| `check-substrate.cjs:70` navigation path allowlist | Line 70: `/^lib\/core\/navigation\//` | ✅ EXACT |
| `check-substrate.cjs:293-328` `scanStagedDiff` | Spans exactly 293-328 | ✅ EXACT |
| `SUBSTRATE-BASELINE.md:26,285` documenting 195 | Line 26 and line 285 both say 195 | ✅ EXACT |
| `--baseline` returns 208 | Re-run 2026-08-31: **208** (chokepoint-require 47, m3-direct-sqlite-require 33, m4-cypher-interpolation 35, opengraph-bypass 38, raw-graph-write 55) | ✅ EXACT, identical breakdown |

**Planner action from drift:** the off-by-one/three citations are cosmetic (all point into the
right statement) **except one**, which is load-bearing for D-04:

> **D-04 scope correction.** CONTEXT.md D-04 says "correct `edges.cjs:45`'s comment." The
> misleading `Cross-room aggregation forbidden` phrasing appears **11 times** in `edges.cjs`
> (lines 45, 64, 236, 269, 366, 419, 583, 629, 667, 705, 746), not the 4 the review named.
> Fixing only line 45 leaves 10 copies of the same false claim in the same file. The planner
> should either sweep all 11 or state explicitly why only one is corrected. This is the single
> place where "follow CONTEXT.md literally" produces a half-fix.

## Empirical Reproduction (all three, re-run 2026-08-31)

Run against Node **v22.23.1** on this checkout. Full probe script:
`/tmp/claude-1000/-home-jsagi/81302756-c861-43e9-93c7-391b7ec0fc8a/scratchpad/probe273.cjs`.

### C1 -- silent-discard reported as success `[VERIFIED: executed on this checkout]`

```
C1 first : {"ok":true,"edge_id":"edge:INFORMS:1788182252215:7cc80981","type":"INFORMS",...}
C1 second: {"ok":true,"edge_id":"edge:INFORMS:1788182252220:9d6d67b8","type":"INFORMS",...}
C1 row   : {"properties":"{\"v\":1,\"confirmed_by\":\"navigator\"}","review_status":"confirmed"}
```

The second write's `{"v":2}` never landed; `ok:true` was returned. Matches the review's
transcript exactly.

**The discriminator, measured directly** (this is the fact the fix depends on):

```
run() when confirmed-guard SUPPRESSES  -> {"lastInsertRowid":1,"changes":0}
run() on a fresh INSERT                -> {"lastInsertRowid":2,"changes":1}
run() UPDATE on a 'proposed' row       -> {"lastInsertRowid":1,"changes":1}
run() UPDATE on a NULL-status row      -> {"lastInsertRowid":2,"changes":1}
run() UPDATE writing IDENTICAL props   -> {"lastInsertRowid":2,"changes":1}
typeof changes                          -> "number"   (NOT BigInt; JSON-safe)
```

Three consequences the planner must encode:
- `changes` is a plain `number`, so `changes > 0` needs no BigInt handling.
- `lastInsertRowid` is **stale garbage** on suppression (it reports 1, the prior row).
  `changes` is the **only** valid discriminator. Do not use `lastInsertRowid`.
- A no-op-looking update (identical properties) still reports `changes: 1`. So
  `changes === 0` through this exact statement means **only** "the
  `WHERE edges.review_status IS NOT 'confirmed'` guard fired." **Zero false-positive risk** for
  a `written:false` signal. This is a stronger guarantee than the review claimed and makes the
  fix's assertion cheap to test.

### C2 -- writeEdge broken against an `openGraph` handle `[VERIFIED: executed]`

```
C2 openGraph edges cols: ["source","target","type","properties"]
C2 openGraph tables:     ["edges","nodes","stakeholders"]
C2 writeEdge:            {"ok":false,"reason":"edge_write_failed",
                          "detail":"table edges has no column named review_status"}
```

**New fact, not in the review, and decisive for Question 5:** an `openGraph` database has
**three tables only** and **no `identity` table**. `phase-224-edge-review-status.cjs:78-79`
writes its sentinel with `INSERT OR REPLACE INTO identity (key, value, updated_at)`. Running
the migration against an `openGraph` handle would therefore throw on the sentinel write even
after the `ALTER TABLE` succeeded, leaving the db half-migrated. **The migration cannot be the
fix site.**

### C3 -- Brain edge types bypass the allowlist `[VERIFIED: executed]`

```
C3 ingest:       {"ok":true,"insightIds":["brain_insight:j1:0"],"eventId":"memory_event:..."}
C3 edges landed: [{"source":"n1","target":"n2","type":"TOTALLY_MADE_UP_TYPE"},
                  {"source":"n3","target":"n4","type":"DROP TABLE nodes"}]
C3 allowlist has TOTALLY_MADE_UP_TYPE: false
```

A simulated Brain response minted two edge types, neither in `ALLOWED_EDGE_TYPES`, including
one whose type string is literally `DROP TABLE nodes`. (It is stored as an inert string --
the SQL is parameterized, so this is **not** an injection -- but it proves the type field is
entirely uncontrolled, remote-supplied data landing in the local graph.)

## D-03 structural recommendation: inline guard, not `writeEdge` routing

CONTEXT.md leaves this to discretion. **Recommend the inline `ALLOWED_EDGE_TYPES` check, not
routing through `writeEdge`.** Reasons, all from the actual call shape:

1. `ingestion.cjs:28` opens its own `BEGIN` transaction. Routing through `writeEdge` is safe
   (writeEdge opens no transaction) but changes the failure semantics: `writeEdge` returns
   `{ok:false}` rather than throwing, so the loop would need new `!ok` handling inside a
   transaction that currently only rolls back on a thrown error. That is a behavioral change
   inside a transaction the phase is not otherwise touching.
2. `ingestion.cjs` writes with **`INSERT OR IGNORE`** (skip on conflict). `writeEdge` uses
   **`ON CONFLICT DO UPDATE`** (overwrite properties, subject to the confirmed guard). Routing
   through `writeEdge` silently upgrades Brain suggestions from "never overwrite" to "overwrite
   any non-confirmed edge" -- a **Canon Part 9 regression**: the Brain would gain the ability
   to mutate existing local edge properties, which it currently cannot do. This is the decisive
   argument.
3. `writeEdge` binds `review_status` as a real column; `ingestion.cjs` deliberately encodes
   `review_status: 'proposed'` **inside the properties JSON** (line 53). Routing would change
   where that provenance lives for Brain edges, which is a data-shape change with unmeasured
   downstream readers.

**Recommended shape** (6 lines, preserves every existing semantic):

```js
// C3 (Phase 273): the closed edge-type allowlist is the SAME one writeEdge
// enforces. Brain-supplied types are remote-controlled input and MUST NOT
// bypass it. Reject-and-skip, not throw: one bad suggestion must not roll
// back the whole ingestion batch (the node-side contract at :42-45 is
// per-suggestion too).
const { ALLOWED_EDGE_TYPES } = require('./edges.cjs');
...
if (!ALLOWED_EDGE_TYPES.has(ep.type)) { rejectedEdgeTypes.push(ep.type); continue; }
```

`ALLOWED_EDGE_TYPES` is already exported from `edges.cjs:845`
(`module.exports = { ALLOWED_EDGE_TYPES, writeEdge }`), so the require is free and no second
allowlist is minted (Canon Part 7).

**Return-shape recommendation:** add a `rejectedEdgeTypes` array to the success return so the
rejection is *observable*, not silent. A phase whose entire thesis is "silent failure is the
bug" should not fix a silent bypass with a silent drop. Cheap, and it is what the test asserts
against.

## D-01 fix design

### The shape

```js
// Phase 273 C2: the caller owns the db handle and it may come from either
// opener. room-db.cjs::openRoomDb runs the phase-224 migration (review_status
// present); lazygraph-ops.cjs::openGraph runs initSchema only (review_status
// ABSENT, and no identity table so the migration cannot be run here).
// Probe once per call, exactly as node-insert.cjs:68-75 does for nodes.
function edgesHasReviewStatus(db) {
  try {
    return db.prepare('PRAGMA table_info(edges)').all().some((c) => c && c.name === 'review_status');
  } catch (_e) {
    return false;   // same defensive default as node-insert.cjs: the narrow
  }                 // statement works on both schemas, the wide one does not.
}
```

Then branch:

| Schema | Statement | `changes === 0` means |
|--------|-----------|----------------------|
| migrated (has `review_status`) | current 5-column INSERT with the `WHERE edges.review_status IS NOT 'confirmed'` guard | confirmed-guard suppression |
| base (`openGraph`) | 4-column INSERT, `ON CONFLICT DO UPDATE SET properties = excluded.properties`, **no WHERE guard** (the column it references does not exist) | unreachable -- see below |

### Four design decisions the planner must make explicitly

1. **Return shape.** Recommend `{ ok: true, written: <boolean>, reason: 'suppressed_by_confirmed' \| undefined, edge_id, type, source, target }`. **Do NOT flip `ok`.** See blast radius below.
2. **What happens to `review_status` on the base schema.** A caller passing
   `review_status: 'proposed'` to an `openGraph` handle will have that value silently dropped
   by the fallback. Options: (a) drop silently (matches `node-insert.cjs`'s precedent, which
   silently drops the provenance columns), (b) return an additive
   `review_status_persisted: false`, (c) reject with `{ok:false, reason:'review_status_unsupported_schema'}`.
   **Recommend (b)** -- it is additive, keeps the degrade-gracefully contract D-01 asks for,
   and does not repeat the silent-drop pattern this phase exists to kill. **This is a genuine
   open decision, not a settled one.**
3. **`written` on the base-schema branch.** With no `WHERE` guard the statement always reports
   `changes: 1`, so `written` is always `true` there. That is correct and honest (nothing was
   suppressed), but the planner should assert it in a test so the two branches are not
   accidentally given different `written` semantics.
4. **Probe cost.** `PRAGMA table_info(edges)` runs per `writeEdge` call, matching
   `node-insert.cjs`'s per-insert precedent. Backfill/derivation loops call `writeEdge` in
   tight loops. If the planner wants a per-handle memo (`WeakMap<db, boolean>`), that is a
   reasonable optimization -- but note it would diverge from `node-insert.cjs`'s pattern that
   D-01 says to "clone, don't reinvent." Recommend matching the precedent first; optimize only
   if a measurement shows it matters.

### Blast radius of the return-contract change `[VERIFIED: grep on this checkout]`

- **77 `writeEdge(` call sites across 43 files** in `lib/` + `scripts/`.
- **~30 branch on `.ok`.** Sites that treat `!ok` as fatal (these are the ones a flipped `ok`
  would break):

| Site | Consequence if `ok` flips false on suppression |
|------|-----------------------------------------------|
| `lib/core/navigation/room-birth.cjs:948` | throws `nested_within_write_failed`, **rolls back the entire room birth** and triggers `_bornWiredRollback` fs cleanup |
| `lib/core/rs-sqlite-mirror.cjs:423` | `throw new Error('rs_writeEdge_failed:' + r.reason)` |
| `lib/core/breakthrough/schema.cjs:138` | aborts the Breakthrough transaction (D-20 atomicity) |
| `lib/core/findings-wirer.cjs:178,313` | wire-accept path bails |
| `lib/core/navigation/reified-claim.cjs:244,258` | claim reification bails |
| `lib/core/eureka/qualify-opportunity.cjs:296` | qualification bails |
| `lib/core/temporal/supersession.cjs:128` | supersession chain bails |
| `lib/workflow/f9-ordered-consumer.cjs:135` | returns `{ok:false, reason}` upward |

Counting sites is verified; the exact per-site consequence is read from the surrounding code
and is HIGH but not executed.

**Conclusion: `ok` must stay `true` on suppression.** The additive `written` field is the only
shape that closes C1 without touching 43 files.

## Priority 2: `scripts/check-substrate.cjs` mechanics (for D-05)

**File:** `scripts/check-substrate.cjs`, 438 lines. **No separate baseline generator exists** --
`SUBSTRATE-BASELINE.md` is hand-authored prose + tables, with each row assigned an owning
downstream phase. There is no `--regenerate`.

### What counts as a violation

Five rules, applied **per line** via `scanLine()` (`:164-196`), skipping lines that are pure
`//` or `*` comments (`isPureLineComment`, `:160-162`):

| Rule id | Regex / source | Line |
|---------|----------------|------|
| `chokepoint-require` | `BANNED_REQUIRE_PATTERNS` -- requires of `room-db\|lazygraph-ops\|memory-ops.cjs` | 114-117 |
| `m3-direct-sqlite-require` | `require('node:sqlite'\|'better-sqlite3')` | 125 |
| `m2-raw-room-db-read` | `readFileSync\|readFile\|createReadStream(... room.db` | 128 |
| `raw-graph-write` | `/\b(?:INSERT\s+INTO\|UPDATE\|DELETE\s+FROM)\s+(nodes\|edges\|memory_event)\b/i` | 132 |
| `opengraph-bypass` | `/\bopenGraph\s*\(/` | 135 |
| `m4-cypher-interpolation` | two Cypher-specific shapes | 149-154 |

### Scope and allowlist

`scanRepo()` (`:353-365`) walks **only `lib/` and `scripts/`**, only `.cjs\|.js\|.mjs`, skipping
`node_modules` and `.git`. `scanFiles` (`:205-221`) skips any path matching
`ALLOWED_DIRECT_IMPORT` (`:63-102`) -- which includes **`/^lib\/core\/navigation\//` at line 70**,
`lazygraph-ops.cjs`, `room-db.cjs`, `/^tests\//`, `/^lib\/core\/migrations\//`, and others.

### Modes

| Mode | Function | Behavior | Exit |
|------|----------|----------|------|
| default / `--baseline` | `runBaseline()` `:393-400` | full-repo scan, prints `Found N violation(s)`, then groups by rule | **always 0** (informational) |
| `--diff` | `runDiff()` `:402-414` | `scanStagedDiff()` -- parses `git diff --cached --unified=0` and flags **only lines the diff ADDS** | 1 on any hit |
| `--check-chokepoint` | alias for `--diff` | same | same |

Hermetic test seams (already wired, reusable for a D-05 test): `MINDRIAN_HOOK_STAGED_FILES`,
`MINDRIAN_HOOK_STAGED_CONTENT_DIR`, `MINDRIAN_HOOK_STAGED_DIFF`. Programmatic API exported at
`:430-438`: `scanFiles`, `scanStaged`, `scanStagedDiff`, `scanRepo`, `isAllowedPath`.

### D-05: the premise is falsified `[VERIFIED: executed]`

```
$ node scripts/check-substrate.cjs --baseline | grep -i ingestion
(no output -- ingestion.cjs is NOT in the violation list)

RE_RAW_WRITE.test('INSERT OR IGNORE INTO edges (source, target, type, properties)')
  -> false
isAllowedPath('lib/core/navigation/ingestion.cjs')
  -> true
```

Two independent exemptions. **Fixing C3 moves the count by 0.** (The review itself says this
at §C3: "defeats the CI guard twice over" -- CONTEXT.md's D-05 lost that detail when it
inherited the number.)

**Recommended D-05 task shape:**
1. Re-run `--baseline` after D-01/D-03 land. **Expect 208, unchanged.** Record the actual number
   and per-rule breakdown.
2. Amend `SUBSTRATE-BASELINE.md` (do not regenerate -- there is no generator and the existing
   per-row phase-ownership assignments are hand-curated institutional knowledge). Add a dated
   "2026-08-31 re-measurement" section stating: the number is 208; the +13 is pre-existing
   accrual on unstaged lines, not net-new bypass; Phase 273's fixes were structurally incapable
   of reducing it because `lib/core/navigation/` is allowlisted and `INSERT OR IGNORE` evades
   `RE_RAW_WRITE`; the remaining delta is owned by the C4/M5-M8 fast-follow and by M3 (the
   regex hole), both explicitly out of this phase's scope per D-02.
3. **Do not fix the M3 regex hole in this phase.** It is deferred (D-02 list). Widening
   `RE_RAW_WRITE` would *increase* the count, which would make the baseline update
   uninterpretable when mixed into the same commit.

## Priority 3: house test convention

### The pattern (per-phase runner + per-behavior file)

- **Runner:** `tests/run-all-<phase>.sh`. Most recent examples: `run-all-270.sh`,
  `run-all-271.sh`, `run-all-269.sh`. **Glob-discovery is the current convention**
  (`run-all-270.sh:98-113`): the runner globs `tests/test-<phase>-*.cjs` and `*.sh`, so adding a
  test file needs no runner edit.
- **Per-behavior file:** `tests/test-<phase>-<behavior>.cjs`, one behavior per file, kebab-case.
  Examples: `test-236-open-busy-detected.cjs`, `test-270-cross-room-fence.cjs`.
- **Load-bearing runner features to copy from `run-all-270.sh`:**
  - `TEST_<PHASE>_PREFIX` env override + a `found -eq 0` guard that **fails** if discovery finds
    nothing (`:115-118`). Explicitly documented as "MUST NOT BE SOFTENED."
  - A **no-em-dash fence** sweeping every touched file via `grep -lP '\x{2014}'` (`:170-205`) --
    enforces the CLAUDE.md hard rule.
  - A **Part 8 source sweep** grepping new production files for network/Brain tokens (`:129-162`).
  - `PASS`/`FAIL`/`SKIP` counters, final `[ "$FAIL" -eq 0 ]` as the exit.
  - Bare `node "$t"`, **not** `node --test "$t"` (`:94-96` comment: aggregators invoke node:test
    files bare and still get a non-zero exit on failure).

### Two test styles in the tree; both acceptable

| Style | Example | Notes |
|-------|---------|-------|
| `node:test` (`const { test } = require('node:test')`) | `lib/memory/navigation-write-edge.test.cjs` | The existing writeEdge suite. |
| Bare `main()` + `node:assert/strict` + `console.log('  ok - ...')` | `tests/test-224-backfill-idempotent.cjs`, `tests/test-200-graph-chokepoint.cjs` | Dominant in recent phases. |

**Recommend the bare-`main()` style** for Phase 273's new files -- it matches
`test-200-graph-chokepoint.cjs`, which is the nearest structural relative (same subsystem,
same two-opener setup), and it composes cleanly with the glob runner.

### Existing coverage to extend, not duplicate

| File | Covers | Phase 273 relevance |
|------|--------|--------------------|
| `lib/memory/navigation-write-edge.test.cjs` (wired via `tests/run-all-125.sh`) | 9 writeEdge scenarios: happy path, allowlist rejection, missing ids, non-serializable props, UPSERT idempotency, write-isolation across handles | **The C1 regression guard.** Its "UPSERT idempotency" test (`:162,169` -- `ok(r1.ok); ok(r2.ok)`) is the exact assertion that must keep passing after the fix. Also: its header comment at `:32-34` claims "the shipped edges table has FK constraints on (source, target) -> nodes(id)" -- **STALE**, Phase 169 D-169-11 removed the FK (`lazygraph-ops.cjs:165-176`). Worth a comment correction alongside D-04's. |
| `tests/test-200-graph-chokepoint.cjs` | RS writes route through the chokepoint; uses `openRoomDb` **and** `lazygraph.openGraph` in one test | **The C2 harness template.** Copy its setup verbatim. |
| `tests/test-224-*.cjs` (8 files) + `tests/helpers/fixture-room-224.cjs` | review_status derivation, the Ralph/upsert invariant | `test-224-backfill-idempotent.cjs` Test 2 asserts a second backfill leaves the edge count unchanged -- verify the `written:false` change does not break its counting. |
| `tests/test-236-*.cjs` (9 files) + `tests/helpers/room-db-lock-holder-236.cjs`, `fixture-room-236.cjs` | typed-error taxonomy, busy/broken detection | Not touched this phase (C5 deferred), but the helper style is the reference for a lock-holding harness if ever needed. |

**No new helper is needed.** `fs.mkdtempSync` + `openRoomDb` / `openGraph` is used in **461**
test files; that IS the harness.

## Priority 4: validation design per fix

Every repro below was executed as written. `REPO` = repo root, `edges` =
`require('lib/core/navigation/edges.cjs')`.

### Setup primitives (copy into every new test)

```js
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const REPO = path.join(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));

// MIGRATED schema (has review_status). openRoomDb runs the full migration chain.
function migratedDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p273-mig-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return { dir, db: openRoomDb(dir) };
}

// BASE schema (no review_status, no identity table). openGraph runs initSchema only.
async function baseDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p273-base-'));
  const h = await lazygraph.openGraph(dir);   // NOTE: async, returns { db, conn }
  return { dir, h, db: h.conn };
}
```

`openGraph` is `async` and returns `{ db, conn }` where `conn === db`; close with
`await lazygraph.closeGraph(h.db)`. `openRoomDb` is sync; close with `closeRoomDb(db)`.

### `tests/test-273-writeedge-changes-aware.cjs` (C1)

| Assert | Setup | Expected AFTER fix | RED before fix |
|--------|-------|--------------------|----------------|
| Suppressed write is visible | migrated db; write `(a,b,INFORMS)` with `review_status:'confirmed', byUser:'navigator', properties:{v:1}`; then write same key with `properties:{v:2}` | 2nd returns `written === false` and `reason === 'suppressed_by_confirmed'` | `written` is `undefined` |
| `ok` is NOT flipped (regression guard) | same | 2nd still returns `ok === true` | passes before AND after -- this is the contract-preservation guard |
| Row genuinely unchanged | same | `SELECT properties` still `{"v":1,"confirmed_by":"navigator"}` | passes both -- proves the guard still works |
| A real write reports written | migrated db; fresh `(c,d,INFORMS)` | `written === true` | `written` undefined |
| An UPDATE on a `proposed` row reports written | write `(p,q)` proposed, then again | `written === true` (measured: `changes:1`) | `written` undefined |
| An UPDATE writing **identical** props reports written | write `(m,n)` twice with same props | `written === true` (measured: `changes:1`, NOT 0) | -- **this is the false-negative guard.** Without it a naive `changes>0` reading could be mistaken for content-diffing. |
| `room-birth` idempotency unbroken | born-wired birth twice, or direct: write `NESTED_WITHIN` confirmed then re-write | no throw; `ok:true` | passes both -- guards the 43-file blast radius |

### `tests/test-273-writeedge-base-schema.cjs` (C2)

| Assert | Setup | Expected AFTER fix | RED before fix |
|--------|-------|--------------------|----------------|
| No review_status column exists | `baseDb()`; `PRAGMA table_info(edges)` | `["source","target","type","properties"]` | passes both (documents the precondition) |
| No identity table exists | `baseDb()`; `SELECT name FROM sqlite_master WHERE type='table'` | `["edges","nodes","stakeholders"]` | passes both -- **this is the assertion that documents why the fix is not migration-side.** Pin it so a future M12 phase sees it. |
| writeEdge succeeds on base schema | `baseDb()`; `writeEdge(db,{source_id:'x',target_id:'y',edge_type:'INFORMS'})` | `ok === true, written === true` | **RED**: `{"ok":false,"reason":"edge_write_failed","detail":"table edges has no column named review_status"}` |
| Row actually landed | same; `SELECT * FROM edges` | 1 row `(x,y,INFORMS)` | **RED**: 0 rows |
| review_status handling is explicit, not silent | `baseDb()`; write with `review_status:'proposed'` | `ok === true` **and** an explicit signal (`review_status_persisted === false` per the recommended design) | **RED** |
| Migrated schema still binds the column | `migratedDb()`; write with `review_status:'proposed'`; `SELECT review_status` | `'proposed'` | passes both -- proves the fallback did not cannibalize the wide path |
| Both schemas share one code path | assert the same `writeEdge` export handles both | -- | design assertion |

### `tests/test-273-ingestion-allowlist.cjs` (C3)

Build a fake `packetResult` -- **no Brain call, no network** (Canon Part 8):

```js
const packetResult = { job_id: 'j1', suggestions: [{
  summary: 's', suggestion_index: 0,
  graph_updates_proposed: [
    { source: 'n1', target: 'n2', type: 'TOTALLY_MADE_UP_TYPE' },  // not in allowlist
    { source: 'n3', target: 'n4', type: 'DROP TABLE nodes' },      // adversarial string
    { source: 'n5', target: 'n6', type: 'INFORMS' },               // legitimate
  ],
}]};
```

| Assert | Expected AFTER fix | RED before fix |
|--------|--------------------|----------------|
| Out-of-allowlist type does NOT land | `SELECT type FROM edges` contains neither `TOTALLY_MADE_UP_TYPE` nor `DROP TABLE nodes` | **RED**: both land (executed and confirmed) |
| Allowlisted type DOES land | `INFORMS` edge present | passes both |
| One bad suggestion does not roll back the batch | `res.ok === true`; `insightIds` length 1; the `brain_suggestion_received` memory_event present | passes both (asserts the reject-and-skip design) |
| Rejection is observable, not silent | `res.rejectedEdgeTypes` contains both bad types | **RED**: field absent |
| Brain edge properties shape unchanged | landed `INFORMS` edge's `properties` JSON still carries `review_status:'proposed'`, `created_by:'brain'` | passes both -- guards against accidental `writeEdge` routing (Canon Part 9) |
| `INSERT OR IGNORE` semantics preserved | ingest the same suggestion twice; the existing edge's properties are NOT overwritten | passes both -- **the Part 9 guard.** If a planner routes through `writeEdge` instead, this test goes red and correctly flags the regression named above. |

### `tests/test-273-cross-room-comment.cjs` (D-04, optional)

A source-text assertion, mirroring the repo's existing source-assertion idiom
(`run-all-270.sh`'s Part 8 sweep): grep `lib/core/navigation/edges.cjs` for the exact phrase
`Cross-room aggregation forbidden` and assert either 0 remaining occurrences of the
enforcement-implying phrasing, or that every occurrence carries the corrected structural
wording. Recommended because D-04 is a comment-only change with no runtime behavior -- without
a source assertion it has no verification at all, and Nyquist Dimension 8 needs one.

### D-05 validation

Not a unit test -- a **checkpoint**: run `node scripts/check-substrate.cjs --baseline`, capture
the count and the 5-rule breakdown, and assert it against the number written into the amended
`SUBSTRATE-BASELINE.md`. A tiny `tests/test-273-substrate-baseline-honest.cjs` that requires
`scanRepo()` from the guard, counts, and compares against a number parsed out of the doc, is
achievable and makes the drift class self-detecting going forward. **Recommend it** -- it is
the only thing that stops 208 becoming the next stale 195.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting which `edges` schema a handle has | A version table, a handle registry, a `WeakMap` cache invented here | `PRAGMA table_info(edges)` mirroring `node-insert.cjs:68-75` verbatim | The precedent exists, is tested, and D-01 explicitly says clone it. |
| Validating Brain edge types | A second allowlist in `ingestion.cjs` | `require('./edges.cjs').ALLOWED_EDGE_TYPES` (already exported at `edges.cjs:845`) | Canon Part 7 reuse; two allowlists guarantee future drift. |
| Temp room fixtures | A new fixture helper | `fs.mkdtempSync` + `openRoomDb` (migrated) / `lazygraph.openGraph` (base) | Used in 461 test files; `test-200-graph-chokepoint.cjs` already does both in one file. |
| Detecting "did the write land" | A follow-up `SELECT` to compare properties | `run().changes` | Measured: `changes === 0` occurs **only** on confirmed-guard suppression through this statement. A read-back is slower and no more accurate. |
| Regenerating the substrate baseline | A new generator script | Hand-amend `SUBSTRATE-BASELINE.md` with a dated re-measurement section | No generator exists; the per-row owning-phase assignments are hand-curated and would be destroyed by a naive regeneration. |
| A per-phase test runner | A new runner shape | Copy `tests/run-all-270.sh` (glob discovery + `found -eq 0` guard + em-dash fence) | Newest convention; adding test files then needs no runner edit. |

## Common Pitfalls

### Pitfall 1: flipping `ok` to false on suppression
**What goes wrong:** room birth starts hard-failing on any room whose `NESTED_WITHIN` edge was
human-confirmed; `rs-sqlite-mirror` and `breakthrough/schema` throw.
**Why:** 8+ sites treat `!ok` as fatal, including a full transaction rollback plus filesystem
cleanup at `room-birth.cjs:948-949`.
**Avoid:** additive `written` field; `ok` stays `true`.
**Warning sign:** `tests/run-all-125.sh` or any born-wired birth test going red.

### Pitfall 2: assuming `lastInsertRowid` signals success
**What goes wrong:** a suppression check built on `lastInsertRowid` never fires.
**Why:** measured -- on a suppressed write `run()` returned `{"lastInsertRowid":1,"changes":0}`;
the rowid is a stale value from the prior statement.
**Avoid:** `changes` only.

### Pitfall 3: "fix C3, watch the substrate number drop"
**What goes wrong:** the phase closes with a baseline update that claims a reduction that did
not happen, or stalls waiting for one.
**Why:** `lib/core/navigation/` is path-allowlisted **and** `INSERT OR IGNORE` evades
`RE_RAW_WRITE`. Verified both ways.
**Avoid:** plan D-05 as "expect 208, explain why."

### Pitfall 4: fixing only `edges.cjs:45`
**What goes wrong:** 10 other copies of the same misleading claim survive in the same file.
**Why:** the review counted 4 occurrences; there are 11.
**Avoid:** sweep all 11 or state the scope decision explicitly.

### Pitfall 5: routing C3 through `writeEdge` without noticing the conflict-semantics change
**What goes wrong:** the Brain silently gains the ability to overwrite existing local edge
properties -- a Canon Part 9 regression introduced by a Part 9 hardening phase.
**Why:** `INSERT OR IGNORE` (skip) vs `ON CONFLICT DO UPDATE` (overwrite non-confirmed).
**Avoid:** inline allowlist check; keep `INSERT OR IGNORE`. Test it (see the C3 table's last row).

### Pitfall 6: the em-dash fence
**What goes wrong:** the phase runner fails on a stray U+2014 in a new file or comment.
**Why:** CLAUDE.md hard rule, enforced by `grep -lP '\x{2014}'` in `run-all-27x.sh`.
**Avoid:** hyphens only, in code comments and docs alike.

## Runtime State Inventory

This is a code-and-doc change phase, not a rename/migration, but two categories are worth
stating because the phase touches a **schema-shape branch**:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None requiring migration.** The fix is read-side schema *detection*; no existing `room.db` row is rewritten, no column added or dropped. Both schemas keep working exactly as today. | none |
| Live service config | None -- zero network surface, zero MCP/Brain config touched. Verified: `ingestion.cjs` consumes a `packetResult` object handed in by a caller; it makes no Brain call itself. | none |
| OS-registered state | None -- verified: no scheduler, daemon, or pm2 process references these modules by name. | none |
| Secrets/env vars | None new. The phase may *read* the existing `MINDRIAN_HOOK_STAGED_*` test seams; it introduces no key. | none |
| Build artifacts | None -- CJS ships as source (CLAUDE.md convention: `lib/core/*.cjs` ships as source, no compile step). No `node_modules` change, no version bump implied. | none |
| **Latent state worth naming** | Existing `room.db` files in the wild are in **one of two shapes** depending on which opener touched them first (M12). This phase makes both work rather than converging them. After this phase, a room's schema shape is still opener-dependent. | none this phase; documented for M12 |

## Project Constraints (from CLAUDE.md)

| Directive | Bearing on this phase |
|-----------|----------------------|
| **GSD Workflow Enforcement** | No direct edits; all work through `/gsd-execute-phase`. |
| **Canon Part 9 (Memory Locality)** | The whole phase. Brain reasons over typed packets and never writes trusted memory -- C3's fix is literally this. Do not let the C3 fix widen the Brain's write powers (see Pitfall 5). |
| **Canon Part 6 (Dog-Fooding)** | The plugin honors its own canon. `check-substrate.cjs` is the dog-food instrument; D-05 is the honesty half of Part 6. |
| **Canon Part 7 (Reuse Before Build)** | Clone `node-insert.cjs`'s probe; import the existing `ALLOWED_EDGE_TYPES`. No second allowlist, no new fixture helper. |
| **Canon Part 8 (Graph Boundary)** | Tests must construct fake `packetResult` objects; **never** call the live Brain. The `run-all-273.sh` Part 8 source sweep should cover any new file. |
| **No em-dashes anywhere** | Hyphens only, enforced by the phase runner's fence. |
| **CJS only, no TypeScript** | `lib/core/*.cjs`. |
| **Verification: `bash tests/run-all-<phase>.sh`** | Create `tests/run-all-273.sh`. |
| **Consult ALL relevant grounding sources** | `icm-architect` skill is a standing consult for local-graph / `navigation.cjs` / `room-db.cjs` work -- **applies to this phase**. Context7 is the authority for `node:sqlite` API claims (used here for the `changes` contract, cross-checked by direct execution). |
| **Dev-Research Compositing** | This research must also be mirrored to `~/MindrianRooms/rethinking-mindrianos/research/` per the standing rule -- an execution-time task, not a research-time one. |
| **Tri-Polar Design Rule** | Not surface-differentiated: `writeEdge` is shared core called identically from CLI, Desktop (MCP), and Cowork. State this explicitly rather than skipping it. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | **v22.23.1** (floor is >=22.16.0) | -- |
| `node:sqlite` `DatabaseSync` | all repro + tests | ✓ | built-in (experimental warning expected and harmless) | -- |
| `git` | `--diff` mode of the guard | ✓ | -- | env seams exist for hermetic tests |
| Brain / network | **nothing** | n/a | -- | tests use constructed `packetResult` objects (Canon Part 8) |

**No missing dependencies. No new packages.** This phase installs nothing -- the
`## Package Legitimacy Audit` section is intentionally omitted because no external package is
recommended, added, or upgraded.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:assert/strict` (+ `node:test` in older files); no external runner |
| Config file | none -- per-phase bash aggregators |
| Quick run command | `node tests/test-273-<name>.cjs` |
| Full suite command | `bash tests/run-all-273.sh` |

### Phase Requirements → Test Map

`.planning/REQUIREMENTS.md` has **no REQ IDs for Phase 273** (ROADMAP.md line 881: `**Requirements**: TBD`).
Mapped against CONTEXT.md decision IDs instead; the planner should mint REQ IDs at plan time.

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-01 (C1) | A suppressed edge write is reported as not-written, and `ok` stays true | unit | `node tests/test-273-writeedge-changes-aware.cjs` | ❌ Wave 0 |
| D-01 (C2) | `writeEdge` succeeds against an `openGraph` base-schema handle | unit | `node tests/test-273-writeedge-base-schema.cjs` | ❌ Wave 0 |
| D-01 (regression) | The 9 existing writeEdge scenarios still pass | unit | `bash tests/run-all-125.sh` | ✅ exists |
| D-01 (regression) | Backfill idempotency + review_status derivation unchanged | integration | `node tests/test-224-backfill-idempotent.cjs`, `node tests/test-224-proposed-only.cjs` | ✅ exists |
| D-01 (regression) | Chokepoint routing for RS writes unchanged | integration | `node tests/test-200-graph-chokepoint.cjs` | ✅ exists |
| D-03 (C3) | Out-of-allowlist Brain edge types are rejected and observable | unit | `node tests/test-273-ingestion-allowlist.cjs` | ❌ Wave 0 |
| D-04 (M2) | The cross-room comment describes the structural mechanism | source-assert | `node tests/test-273-cross-room-comment.cjs` | ❌ Wave 0 |
| D-05 (M4) | The documented baseline equals the measured baseline | source-assert | `node tests/test-273-substrate-baseline-honest.cjs` | ❌ Wave 0 |
| all | No em-dash, no Part 8 egress in new files | lint | `bash tests/run-all-273.sh` (fences) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the single `node tests/test-273-<name>.cjs` for that task (< 2s each).
- **Per wave merge:** `bash tests/run-all-273.sh` **plus** the regression set
  (`bash tests/run-all-125.sh`, `node tests/test-200-graph-chokepoint.cjs`,
  `node tests/test-224-backfill-idempotent.cjs`). The regression set is the 43-file blast-radius
  guard and must run at every wave merge, not just at the phase gate.
- **Phase gate:** all of the above green, plus `node scripts/doctor.cjs --acceptance` and
  `node scripts/check-substrate.cjs --diff` (must exit 0 -- the C3 fix must not itself add a
  net-new flagged line).

### Wave 0 Gaps
- [ ] `tests/run-all-273.sh` -- glob runner, copied from `run-all-270.sh` (keep the `found -eq 0`
      guard and the em-dash fence)
- [ ] `tests/test-273-writeedge-changes-aware.cjs` -- covers D-01/C1
- [ ] `tests/test-273-writeedge-base-schema.cjs` -- covers D-01/C2
- [ ] `tests/test-273-ingestion-allowlist.cjs` -- covers D-03/C3
- [ ] `tests/test-273-cross-room-comment.cjs` -- covers D-04 (comment-only changes have no other
      verification surface)
- [ ] `tests/test-273-substrate-baseline-honest.cjs` -- covers D-05, and makes the drift class
      self-detecting
- No framework install needed; no shared fixture needed (`mkdtempSync` + the two openers suffice).

**Wave 0 is RED by design**, matching `run-all-270.sh:30-32`'s documented convention.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth surface in this phase |
| V3 Session Management | no | -- |
| V4 Access Control | **yes** | The `confirmed_requires_by_user` gate (`edges.cjs:818-821`) is a trust-level control: only a human-supplied `byUser` may mint a `confirmed` edge. The C1 fix must not weaken it -- the suppression it causes is the control *working*, and the fix only makes it visible. |
| V5 Input Validation | **yes** | **C3 is exactly this.** `ep.type` is remote-supplied (Brain response body) and validated only as `typeof === 'string'` (`ingestion.cjs:50`). The control is the existing closed `ALLOWED_EDGE_TYPES` allowlist -- deny-by-default, already built. |
| V6 Cryptography | no | `crypto.randomBytes` is used only for a non-security display id (M1's phantom `edge_id`) |

### Known Threat Patterns for node:sqlite + remote-suggestion ingestion

| Pattern | STRIDE | Standard Mitigation | State on this checkout |
|---------|--------|---------------------|-----------------------|
| SQL injection via remote-supplied values | Tampering | parameterized `?` placeholders | **Already correct.** The review scanned all of `lib/` and found zero interpolation in scope. `ingestion.cjs:56` is fully parameterized -- the `DROP TABLE nodes` string in the C3 repro lands as an inert type string, not executed SQL. |
| Unbounded vocabulary injection from a remote peer | Tampering / Spoofing | closed allowlist, deny-by-default | **BROKEN (C3).** Verified: arbitrary types land. This is the phase's real security fix. |
| Trust-level escalation (remote peer minting human-confirmed data) | Elevation of Privilege | `byUser` requirement + `review_status` separation | Holds for **nodes** (`created_by:'brain'`, `review_status:'proposed'`, `ingestion.cjs:44`). For **edges** it holds only by convention -- the provenance is written into the properties JSON, not enforced. C3's fix closes the type vocabulary; it does **not** add an edge-side provenance enforcement, and the planner should not claim it does. |
| Silent write loss presented as success | Repudiation | explicit outcome signalling | **BROKEN (C1).** This is the phase's core fix. |
| Local privilege boundary crossing (cross-room writes) | Tampering | structural: `writeEdge(db, params)` cannot open a second db | **Holds structurally** (D-04's whole point). The comment overstates it as a checked invariant; correcting the comment is the honest fix, and adding an unmotivated runtime assertion is explicitly out of scope per D-04. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The per-site consequence table for a flipped `ok` (room birth rollback, RS throw, breakthrough abort) is read from surrounding code, not executed end-to-end. The **counts** (77 sites / 43 files / ~30 `.ok` branches) are grep-verified. | D-01 blast radius | Low. The recommendation (additive `written`) is safe regardless of which specific sites would break. |
| A2 | The recommended `review_status_persisted: false` signal for the base-schema branch is a design proposal, not a decision. The alternatives (silent drop, hard reject) are both defensible. | D-01 design decision 2 | Medium. If the planner picks silent-drop it should say so deliberately -- it repeats the pattern this phase exists to kill. |
| A3 | `tests/test-273-substrate-baseline-honest.cjs` (parsing the count out of the markdown doc) is a proposal; no such doc-parsing test exists in the tree today. | Validation Architecture | Low. It is additive; if it proves brittle, the checkpoint alternative (manual re-run + record) still satisfies D-05. |
| A4 | The `run-all-270.sh` glob-discovery pattern is "the current convention" -- inferred from 269/270/271 all using it. Older runners (125, 236) predate it. | Test convention | Low. |
| A5 | Phase 273 has no REQ IDs; ROADMAP.md says `**Requirements**: TBD`. The planner is expected to mint them. | Requirements map | Low, but the planner must not assume they exist. |

## Open Questions

1. **Does any production caller actually pass an `openGraph` handle into `writeEdge` today?**
   (The reviewer's own §6 Q1.) The review names three modules that do both
   (`futures/orchestrator.cjs`, `rs-sqlite-mirror.cjs`, `lazygraph-ops.cjs`), but a module doing
   both does not prove the same handle crosses. **Recommendation:** do not spend phase time
   proving it. The C2 fix is correct whether or not a live caller exists today -- and
   `opengraph-bypass` at 38 sites means the exposure only grows. Note it as answered-by-fix,
   the same disposition D-03 gives Q3.

2. **Should D-04 sweep all 11 occurrences or only line 45?**
   - What we know: 11 occurrences, CONTEXT.md names 1.
   - What's unclear: whether the user intended "the comment" (singular claim) or "line 45"
     (literal).
   - **Recommendation:** sweep all 11 -- it is the same edit repeated, costs nothing, and
     leaving 10 false claims in the file after a phase whose thesis is "the comment lies" is
     self-defeating. Flag it to the user at plan time rather than deciding silently.

3. **Does `written: false` change any existing counter?**
   - What we know: several sites count successes as `if (r && r.ok) count += 1`
     (`entity-extract.cjs:854,870`, `research-filing.cjs:358`). With `ok` preserved, their counts
     are unchanged.
   - What's unclear: whether "unchanged" is actually *desired* -- `research-filing.cjs`'s
     `derivedFromWritten += 1` is arguably counting writes that did not happen.
   - **Recommendation:** preserve current behavior in this phase (do not touch callers, per
     D-02), but record it as a fast-follow candidate. Changing caller counting is exactly the
     C5/M8 "propagation" work D-02 defers.

## Sources

### Primary (HIGH confidence -- direct execution against this checkout, 2026-08-31)
- `node /tmp/.../probe273.cjs` -- C1, C2, C3 all reproduced; `run()` return shape measured
- `node /tmp/.../probe273b.cjs` -- `changes` semantics across insert / update-proposed /
  update-NULL / identical-props paths
- `node scripts/check-substrate.cjs --baseline` -- 208, per-rule breakdown, ingestion.cjs absent
- `node -e` probe of `RE_RAW_WRITE` and `isAllowedPath('lib/core/navigation/ingestion.cjs')`
- Direct reads: `lib/core/navigation/edges.cjs` (1-75, 760-845), `lib/core/navigation/ingestion.cjs`
  (full), `lib/core/node-insert.cjs` (full), `lib/core/lazygraph-ops.cjs` (150-194, 415-454),
  `lib/core/room-db.cjs` (26-45, 275-320), `lib/core/migrations/phase-224-edge-review-status.cjs`
  (55-86), `lib/core/navigation/room-birth.cjs` (925-975), `scripts/check-substrate.cjs` (full),
  `docs/architecture/SUBSTRATE-BASELINE.md` (1-40, 275-292), `tests/run-all-270.sh` (full),
  `tests/run-all-271.sh` (1-20), `tests/test-200-graph-chokepoint.cjs` (1-70),
  `tests/test-224-backfill-idempotent.cjs` (1-60), `lib/memory/navigation-write-edge.test.cjs` (1-40)
- `./CLAUDE.md` and its four `@include` files

### Secondary (HIGH confidence -- prior in-repo analysis, spot-verified above)
- `specs/mindrianos-plugin_sqlite-graph-layer_code-review.md` -- C1/C2/C3/M2/M4 §2-§7 read in full
- `specs/mindrianos-plugin_room-graph-memory_reverse_spec.md` §6.1 -- U-1, U-2, U-3
- `.planning/ROADMAP.md:835-888` -- the Phase 273 section
- `.planning/research/2026-08-27-langtalks-grounding-for-phase-272-and-273.md` Finding 1 --
  the recurring "chokepoint reports success while the data never moved" failure class (SAG paper,
  arXiv 2606.15971v1), same family as C1 at the opposite pipeline end

### Not consulted, deliberately
- Context7 / WebSearch / langtalks: every claim in this document is about **this repo's own
  code**, verified by executing it. The one API-contract claim (`run()` returns
  `{changes, lastInsertRowid}`, `changes` is a `number`) was settled by direct measurement on the
  target runtime, which is stronger than a docs lookup for this purpose.

## Metadata

**Confidence breakdown:**
- Citation accuracy: **HIGH** -- every location re-read; drift enumerated line by line
- C1/C2/C3 reproduction: **HIGH** -- all three re-executed, transcripts included
- D-05 premise falsification: **HIGH** -- proven two independent ways by execution
- Question 5 (fix belongs in `writeEdge`): **HIGH** -- proven by the missing `identity` table plus
  the top-level require direction
- Blast radius counts: **HIGH** (grep-verified); per-site consequences **MEDIUM** (read, not executed)
- Test convention: **HIGH** -- read from the three most recent runners
- D-03 recommendation (inline over routing): **HIGH** -- rests on the measured
  `INSERT OR IGNORE` vs `ON CONFLICT DO UPDATE` semantic difference

**Research date:** 2026-08-31
**Valid until:** 2026-09-30 for the conventions; the empirical findings are pinned to this
checkout and should be re-run if `main` moves before execution (the probe scripts in the
scratchpad are re-runnable as-is).
