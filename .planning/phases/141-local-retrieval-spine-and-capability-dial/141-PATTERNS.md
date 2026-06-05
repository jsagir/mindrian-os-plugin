# Phase 141: Local Retrieval Spine + Capability Dial - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 11 (5 net-new code, 1 net-new doctrine commit, 1 one-token fix, 4 net-new tests + 1 runner)
**Analogs found:** 11 / 11 (every file has a live, verified analog -- this phase is ~90% reuse per Canon Part 7)

> House rule: hyphens only, no em-dashes (CLAUDE.md HARD RULE). All excerpts below preserve the source files' own punctuation.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `lib/core/navigation/room-context.cjs` (NEW) | service (fusion module) | request-response (read) | `lib/core/navigation/packet.cjs::buildBrainPacket` (SHAPE only) + `room-home.cjs` + `memory-ops.cjs` + `neighborhood.cjs` + `focus.cjs` | composite (shape from packet, legs from 3 readers, seed from focus) |
| `lib/core/navigation/file-evidence-readback.cjs` (NEW; or fold into a navigation sibling) | service (write + validate wrapper) | CRUD (write-then-read-back) | `lib/core/navigation/evidence-claim.cjs::writeEvidenceClaim` + `findings-wirer.cjs:147-208` (node+INFORMS) + `focus.cjs:49-80` (BEGIN/COMMIT/ROLLBACK) | role-match (wraps the shipped writer) |
| `lib/core/navigation.cjs` (MODIFIED) | config (Part 9 chokepoint re-export) | n/a | `navigation.cjs:52,73,194` (existing re-export idiom) | exact |
| `scripts/intent-classifier.cjs` (MODIFIED, RETR-02) | controller (per-turn hot path) | event-driven (UserPromptSubmit) | `intent-classifier.cjs:1080-1084` (the `userText:null` seam) + `:635,:1196` (1200ms Promise.race) | exact (in-place edit) |
| `scripts/build-graph-from-sqlite.cjs` (MODIFIED, BUG-01) | script (graph export) | batch (file I/O) | self, line 50 `roomDbPath` (correct) vs line 53 `lazygraphPath` (typo) | exact (one-token fix) |
| `skills/larry-personality/SKILL.md` (MODIFIED, LARRY-01/03/04, DRSCH) | config (prompt-layer doctrine) | n/a | `skills/mva-pipeline/SKILL.md:7` (`canon_parts` frontmatter precedent) + self (5 reach rows already present) | exact (frontmatter + id tokens + new section) |
| `tests/test-dial-reach-ids.cjs` (NEW, LARRY-03) | test (drift / exact-set) | n/a | `tests/test-feynman-timeline-canon-part-9-invariant.cjs` (forbidden-substring + exact-set sweep) | role-match |
| `tests/test-navigator-posture-ids.cjs` (NEW, LARRY-04 / D-12) | test (drift / exact-set) | n/a | same as above (mirror LARRY-03 test) | role-match |
| `tests/test-file-evidence-readback.cjs` (NEW, FILEVAL-02) | test (fixture-first, D-02a) | n/a | `test-feynman-timeline-canon-part-9-invariant.cjs` (in-memory `DatabaseSync` + `applySchema` fixture) | role-match |
| `tests/test-build-graph-no-room-db.cjs` (NEW, BUG-01 regression) | test (exit-0 guard) | n/a | `build-graph-from-sqlite.cjs:45-48` (existing exit-0 path) + run-a-script-then-assert-exit idiom | role-match (no-room-db fixture) |
| `tests/run-all-141.sh` (NEW) | test (per-phase runner) | n/a | `tests/run-all-126.sh` | exact |

> Note (D-04b / RETR-04): a local FTS5 virtual table is a DOCUMENTED CONTINGENCY, not a planned file. Build it only if the RETR-04 benchmark shows graph-ranking misses the 1200ms budget. No analog needed unless triggered.

---

## Pattern Assignments

### `lib/core/navigation/room-context.cjs` (service, request-response read) -- RETR-01

This is the load-bearing net-new file. It is a COMPOSITE: copy the composition SHAPE of `buildBrainPacket`, call the three legs AS-IS, and add the conversation-seed resolver + Leg B windowing. NEVER import the packet.cjs projection functions.

**Composition shape analog** -- `packet.cjs::buildBrainPacket` (imports + multi-source assembly):
```javascript
// packet.cjs:15-17 -- compose from the shipped readers; do NOT re-derive
const { getNeighborhood } = require('./neighborhood.cjs');
const { findContradictions, findUnsupportedClaims, findRelevantOpportunities } = require('./insights.cjs');
const { findRecentChanges } = require('./memory-events.cjs');
```
Copy this REQUIRE-the-legs-and-fuse pattern. Mirror the return-an-object shape. The RESEARCH-recommended signature:
```javascript
// lib/core/navigation/room-context.cjs (re-exported through navigation.cjs)
// Local in-process 3-leg fusion. 100% local. NEVER egresses. Canon Part 8 + Part 9.
async function getRoomContext(db, roomId, opts) {
  // opts: { seedFragments?, topK?, fragmentWindow?, maxDepth? }
  // returns: { summary, recentMessages, relevantNodes, _meta }
}
module.exports = { getRoomContext };
```

**Leg A analog (raw-prose path, reuse AS-IS)** -- `room-home.cjs:102-140` returns the 9-field object; `safeShape` (`room-home.cjs:29-43`) is the RAW truncator -- reuse it, never hash:
```javascript
// room-home.cjs:29-43 -- the raw-prose truncator (RETR-03: this, NOT packet.cjs projectText)
function safeShape(row) {
  let summary = '';
  try {
    const props = JSON.parse(row.properties || '{}');
    summary = props.summary || props.claim || props.title || '';
  } catch (_) { /* ignore */ }
  return {
    id: row.id, type: row.type,
    summary: summary.length > 120 ? summary.slice(0, 117) + '...' : summary,
    reviewStatus: row.review_status, confidence: row.confidence, lastSeenAt: row.last_seen_at,
  };
}
```
Call `getRoomHomeView(db, roomId, opts)` for Leg A. Do not re-implement its SELECTs.

**Leg B analog (window it)** -- `memory-ops.cjs:314-333`:
```javascript
// memory-ops.cjs:314-333 -- getSessionHistory returns sessions DESC, each with nested fragments[]
async function getSessionHistory(db, limit) {
  const effectiveLimit = typeof limit === 'number' ? limit : 10;
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?').all(effectiveLimit);
  const fragStmt = db.prepare('SELECT * FROM fragments WHERE session_id = ? ORDER BY timestamp ASC');
  for (const session of sessions) { session.fragments = fragStmt.all(session.id); /* ... */ }
  return Promise.resolve(sessions);
}
```
NET-NEW step: take the most-recent session, slice its last N fragments (planner picks N + a char cap). Each fragment carries `role / content / timestamp / section_context` -- `section_context` is the seed-resolver input below.

**Leg C analog (graph-rank, reuse AS-IS)** -- `neighborhood.cjs:48-77`. It politely returns `[]` for an unknown focus (`:54-55`), so a bad seed degrades gracefully:
```javascript
// neighborhood.cjs:54-55 -- the safe-empty guard the seed resolver relies on
const exists = db.prepare("SELECT 1 AS x FROM nodes WHERE id = ?").get(focusNodeId);
if (!exists) return [];
```
Call `getNeighborhood(db, focusNodeId, {topK, maxDepth})`. The frozen score (`neighborhood.cjs:14-46`) is the local relevance substitute -- do NOT add a lexical/vector term.

**Seed-resolver analog** -- `focus.cjs::computeAutoFocus` (`focus.cjs:106-143`) is the EXISTING resolver, but it seeds from VENTURE STATE (jtbd -> decision -> room root -> null). 141's NET-NEW resolver seeds from CONVERSATION instead: take the last ~2 Leg-B fragments, resolve to a focus node by matching the fragment's `section_context` to a `section:`/node id (cheap lexical pick against `nodes.properties` as fallback), then feed that id to `getNeighborhood`. Mirror `computeAutoFocus`'s `ensureNodeExists` guard idiom (`focus.cjs:101-104`) before calling the neighborhood query:
```javascript
// focus.cjs:101-104 -- the existence guard idiom to mirror before getNeighborhood
function ensureNodeExists(db, nodeId) {
  const row = db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId);
  return Boolean(row);
}
```

**ANTIPATTERN -- DO NOT REUSE (RETR-03)** -- `packet.cjs:121-139`. Under the default `local_summary_only` mode, `projectText` returns a SHA256 hash, not prose:
```javascript
// packet.cjs:130-139 -- THE EGRESS ANTIPATTERN. getRoomContext MUST NOT import this.
function projectText(text, privacyMode) {
  const s = (typeof text === 'string') ? text : '';
  if (privacyMode === 'allow_excerpts') { /* excerpt */ }
  return hashText(s);   // <-- default path HASHES the prose Larry needs
}
```
Forbidden imports in `room-context.cjs`: `projectText`, `shortText`, `hashText`, `safeNodeProjection`, `safeContradictionProjection`, `safeUnsupportedProjection`, `resolvePrivacyMode`, `PRIVACY_MODES`. The RETR-03 invariant test should grep `room-context.cjs` source and assert ZERO `require('...packet...')` and ZERO `sha256`.

**Optional `context_assembled` memory_event (Claude's Discretion):** if logged, treat as a Part 9 audit-node carve-out (`created_by=system review_status=confirmed`) -- mirror `focus.cjs:71-74` exactly (see the carve-out comment at `focus.cjs:61-70`). This may need an additive EVENT_TYPES entry; the additive idiom is in `memory-events.cjs` (existing entries are commented as accepted-because-in-the-Set). Note `research_filed` already exists (`memory-events.cjs:317`) for the FILEVAL path -- no bump needed there.

---

### `lib/core/navigation/file-evidence-readback.cjs` (service, CRUD write-then-read-back) -- FILEVAL-02

> MAJOR REUSE: the typed-evidence node writer SHIPS. The genuine net-new is the read-back assertion + the `artifact_path` additive field. Wrap, do not rebuild.

**The shipped writer to wrap** -- `evidence-claim.cjs::writeEvidenceClaim` (`evidence-claim.cjs:65-119`). The LOCKED Phase-136 provenance schema is at `:82-89`; UPSERT + `review_status:'proposed'` + `created_by:'system'` at `:108-114`:
```javascript
// evidence-claim.cjs:82-89 -- the LOCKED 6-field schema. Add artifact_path PURELY ADDITIVELY.
const props = {
  source: source, url: url,
  retrieved_at: typeof retrieved_at === 'string' ? retrieved_at : '',
  evidence_tier: evidence_tier,
  topic: typeof topic === 'string' ? topic : '',
  summary: typeof summary === 'string' ? summary : '',
  // D-10 NET-NEW: + artifact_path (optional) -- the reserved nested-fractal path
  //   <section>/<research-topic-slug>/<research-topic-slug>.md (Decision 16).
  //   NEVER rename/drop the 4 locked provenance fields above.
};
```
Tier validation against the closed Part-5 set (`evidence-claim.cjs:48`): `Object.freeze(new Set(['Academic','Operational','Practitioner','None']))`. Defensive return contract: `{ ok, node_id } | { ok:false, reason }`.

**The node+INFORMS producer pattern to mirror** -- `findings-wirer.cjs:147-208`: write the EvidenceClaim node, then write the INFORMS edge, returning structured failure at each step (never swallow):
```javascript
// findings-wirer.cjs:150-180 -- node-then-INFORMS, surfacing each failure
claim = navigation.writeEvidenceClaim(db, { topic, source, url, retrieved_at, evidence_tier, summary, sessionId });
if (!claim || !claim.ok) { return { ok: false, reason: (claim && claim.reason) || 'evidence_claim_failed' }; }
const nodeId = claim.node_id;
const informs = navigation.writeEdge(db, {
  source_id: nodeId, target_id: primaryTargetId,
  edge_type: 'INFORMS', properties: edgeProps('finding_informs_target', finding.evidence_tier),
});
if (!informs || !informs.ok) { return { ok: false, reason: (informs && informs.reason) || 'informs_edge_failed', node_id: nodeId }; }
```
`writeEdge` (`edges.cjs:194`) validates `edge_type` against the frozen `ALLOWED_EDGE_TYPES` Set (`edges.cjs:32`) and returns `{ ok, edge_id, type, source, target }`.

**Transaction analog (BEGIN/COMMIT/ROLLBACK)** -- `focus.cjs:49-80` (node:sqlite has no `transaction(fn)` helper; wrap by hand):
```javascript
// focus.cjs:49-80 -- the hand-rolled transaction idiom to mirror for the filing
db.exec('BEGIN');
try {
  // ... writeEvidenceClaim + writeEdge(INFORMS) ...
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  return { ok: false, reason: err.message };
}
```

**The NET-NEW read-back honesty layer** (no shipped path has this). After COMMIT, SELECT the row back and assert it landed with expected provenance; on mismatch return a structured failure (surface, never swallow):
```javascript
// NET-NEW: read-back assertion (FILEVAL honesty rule, D-02). The SELECT shape:
const row = db.prepare(
  "SELECT id, type, review_status, source_path, properties FROM nodes WHERE id = ?"
).get(nodeId);
if (!row || row.review_status !== 'proposed' /* + artifact_path round-trip check */) {
  return { ok: false, reason: 'filing_did_not_land', node_id: nodeId };
}
```
Recommended home: a thin `fileEvidenceWithReadback(db, params)` re-exported through navigation.cjs. Caller-owned db handle ONLY -- never open room.db directly (mirror evidence-claim.cjs's caller-owned-handle rule, `evidence-claim.cjs:10-17`).

---

### `lib/core/navigation.cjs` (config, Part 9 chokepoint) -- D-04a

**Re-export idiom** -- `navigation.cjs:52,73,194` (thin additive re-export):
```javascript
// navigation.cjs:52  getNeighborhood: neighborhoodMod.getNeighborhood,
// navigation.cjs:73  getRoomHomeView: roomHome.getRoomHomeView,
// navigation.cjs:194 writeEvidenceClaim: evidenceClaim.writeEvidenceClaim,
```
ADD three exports the same way: `getRoomContext` (from room-context.cjs), `getSessionHistory` (D-04a mandates promoting it into the chokepoint; today it is only re-exported at memory-ops.cjs:592), and `fileEvidenceWithReadback`. The doc-comment style at `navigation.cjs:180-196` is the precedent for annotating new re-exports.

---

### `scripts/intent-classifier.cjs` (controller, event-driven hot path) -- RETR-02 / D-03

**The exact seam to flip** -- `intent-classifier.cjs:1080-1084`:
```javascript
// intent-classifier.cjs:1080-1084 -- TODAY (the userText:null seam RETR-02 names)
const turn = {
  userText: null, // hot path does not forward prompt content
  sectionPath: sectionPath,
  sessionId: sessionId,
};
```
D-03: un-null `userText` so retrieval seeds from the last ~2 turns. D-03a HARD FENCE: the un-nulled value flows to the LOCAL seed lane ONLY (room-context.cjs); it MUST NOT reach `buildBrainPacket`/brain-client. A test asserts the Brain still gets generic handles only (Part 8).

**The latency envelope to stay inside** -- `intent-classifier.cjs:635` + `:1196`:
```javascript
// intent-classifier.cjs:635
const NAV_HARD_TIMEOUT_MS = 1200;
// intent-classifier.cjs:1196 -- the Promise.race envelope assembly must finish inside
callDecideWithTimeout(navEngine.decide, turn, context, NAV_HARD_TIMEOUT_MS).then(...)
```
RETR-04: getRoomContext assembly must complete inside this 1200ms race OR run off the hot path. Window Leg B; graph-rank first; benchmark before any FTS5 (D-04b).

---

### `scripts/build-graph-from-sqlite.cjs` (script, batch) -- BUG-01 / D-04d

**The one-token fix** -- line 53 references an undeclared `lazygraphPath`; line 50 already defines the correct `roomDbPath`:
```javascript
// build-graph-from-sqlite.cjs:50  const roomDbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');
// build-graph-from-sqlite.cjs:53  if (!fs.existsSync(lazygraphPath)) {   // <- ReferenceError; change to roomDbPath
//                                   process.exit(0);
//                                 }
```
The exit-0 try/catch opens AFTER this guard (`:58-63`), so the ReferenceError is uncaught and crashes non-zero -- defeating the graceful-exit contract. The correct exit-0 idiom is already at `:45-48` (no-roomDir guard). Fix: `lazygraphPath` -> `roomDbPath`.

---

### `skills/larry-personality/SKILL.md` (config, prompt-layer doctrine) -- LARRY-01/02/03/04 + DRSCH

> D-06 HARD ORDERING: commit this FIRST (it is ` M`, in no commit; a stash/checkout loses it).

**Frontmatter precedent (LARRY-01, D-04c)** -- `mva-pipeline/SKILL.md:7`:
```yaml
canon_parts: [Part 2, Part 8, Part 10]
```
Current `larry-personality/SKILL.md` frontmatter is only `name` + `description` (`:1-8`). ADD `canon_parts: [Part 2, Part 3, Part 8, Part 9]`.

**PRESENT-as-prose, just needs committing (D-07):** all 5 reach ROWS (`SKILL.md:35-41`, including the deep-research 5th row at `:41`) + Reach rules 1-6 (`:45-50`). Do NOT rebuild these.

**NET-NEW (LARRY-03, D-05) -- the 5 machine-readable reach ids.** The dial today (`:35-41`) carries prose rows with NO machine tokens. Add a grep-able id block / per-row token for EXACTLY: `context_block`, `contradiction`, `cross_room`, `brain_consult`, `deep_research`. Map: `:37 -> context_block`, `:38 -> contradiction`, `:39 -> cross_room`, `:40 -> brain_consult`, `:41 -> deep_research`.

**NET-NEW (LARRY-04, D-11/12/13) -- the Hierarchical Navigator section** with EXACTLY 3 posture ids `{push_forward, hold, pull_back}` + a new Reach rule 7 (arbitration/precedence). Lead with the Usher division (tool owns Usher steps 1-2; human owns 3-4), quote Aronhime ("the insight belongs to you; the reach belongs to the tool"; "reach matters more than raw intelligence"; "restraint is the product working correctly"). The Reach-rules block at `:43-50` is the structural neighbor to append rule 7 onto.

**LARRY-02:** CHANGELOG `### Added` + version bump 1.13.1-beta.6 -> beta.7. Honor the 5-place lockstep (CHANGELOG / plugin.json / package.json / git tag / marketplace.json `ref`) per `.claude/includes/release-process.md`.

---

### Drift tests (test, exact-set) -- `tests/test-dial-reach-ids.cjs` (LARRY-03) + `tests/test-navigator-posture-ids.cjs` (LARRY-04/D-12)

**Analog** -- `tests/test-feynman-timeline-canon-part-9-invariant.cjs` (the forbidden-substring + exact-set adversarial idiom). The header (`:1-20`) documents the pattern; the constant blocks (`:45-66`) are the grep-set shape to mirror:
```javascript
// test-feynman-timeline-canon-part-9-invariant.cjs:39-66 -- files + forbidden/required sets to scan
const FILES_TO_SCAN = ['lib/core/feynman/timeline-renderer.cjs', /* ... */];
const FORBIDDEN_REQUIRES = [ /require\s*\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/, /* ... */ ];
const FORBIDDEN_SUBSTRINGS = ['SECRET RAW BODY', 'leak@example.com', /* ... */ ];
```
For LARRY-03: grep `SKILL.md` for the reach-id tokens; assert the set is EXACTLY the 5 (no more, no fewer). For LARRY-04: same idiom, assert EXACTLY the 3 posture ids. This mirrors the Phase 90 5-tripwire / Phase 110-05 seed / Phase 124 canon-invariant lineage the CONTEXT names.

> The same file is ALSO the analog for the RETR-03 Part-8 invariant sweep (forbidden `require('...packet...')` + `sha256` in room-context.cjs) and the D-03a brain-fence test (assert no userText threads toward buildBrainPacket).

---

### `tests/test-file-evidence-readback.cjs` (test, fixture-first) -- FILEVAL-02 / D-02a

**Fixture analog** -- `test-feynman-timeline-canon-part-9-invariant.cjs:27-33` (in-memory `DatabaseSync` with SKIP-77 guard) + `:70-75` (`applySchema(db)` building the nodes table inline):
```javascript
// test-feynman-timeline-canon-part-9-invariant.cjs:27-33 -- the node:sqlite-unavailable SKIP idiom
try { DatabaseSync = require('node:sqlite').DatabaseSync; }
catch (_) { process.stdout.write('SKIP ... (node:sqlite unavailable)\n'); process.exit(77); }
```
D-02a: build test-first against a FIXTURE evidence node (no live producer). Assert: (a) node lands with full provenance; (b) read-back catches a simulated failed write; (c) the INFORMS edge lands; (d) `artifact_path` round-trips; (e) `review_status === 'proposed'` (never auto-confirmed -- Part 9 role 5). Treat "unused-consumer" as expected.

---

### `tests/test-build-graph-no-room-db.cjs` (test, exit-0 guard) -- BUG-01 regression / D-04d

**Analog** -- the existing exit-0 path at `build-graph-from-sqlite.cjs:45-48`. Run the script (`child_process`) against a dir with NO `.mindrian/room.db`, assert exit code 0 (the fix proves the guard now REACHES its graceful path instead of throwing the ReferenceError). No close test analog exists for this script; use the generic spawn-script-assert-exit fixture pattern.

---

### `tests/run-all-141.sh` (test, per-phase runner)

**Analog** -- `tests/run-all-126.sh` (copy verbatim; swap the CJS_SUITES list + the header + the "Phase 141" banner). Key structural pieces to preserve: `set -uo pipefail` (`:22`), `SHELL_SUITES` + `CJS_SUITES` arrays (`:27-37`), the per-suite missing-file guard + PASS/FAIL accounting (`:64-77`), and the non-zero exit on any failure (`:90-98`). CJS_SUITES for 141: `test-dial-reach-ids.cjs`, `test-navigator-posture-ids.cjs`, `test-file-evidence-readback.cjs`, `test-build-graph-no-room-db.cjs`, + the RETR-01 fusion test + the RETR-03/D-03a invariant sweep.

---

## Shared Patterns

### Caller-owned db handle, never self-open (Part 9 chokepoint discipline)
**Source:** `evidence-claim.cjs:10-17` (the rule stated in the header), `neighborhood.cjs:48`, `room-home.cjs:102`, `focus.cjs:36`
**Apply to:** `room-context.cjs`, `file-evidence-readback.cjs` -- both take `db` as the first arg from the caller; NEVER `require('node:sqlite')`, NEVER open room.db. This keeps the new modules inside the navigation allow-list (`scripts/check-substrate.cjs` regex `/^lib\/core\/navigation\//`).
```javascript
// evidence-claim.cjs header (:10-17, paraphrased): "takes a db handle owned by the caller
//   ... NEVER requires node:sqlite and NEVER opens room.db itself ... zero substrate bypass."
```

### Defensive structured-return, never throw on caller input
**Source:** `evidence-claim.cjs:65-118` + `findings-wirer.cjs:150-208` + `focus.cjs:36-81`
**Apply to:** `room-context.cjs` (return `{summary, recentMessages, relevantNodes, _meta}` even on partial-leg failure), `file-evidence-readback.cjs` (`{ ok, node_id } | { ok:false, reason }`). Every reason is a short stable string; failures surface, never swallow (the FILEVAL honesty rule).

### Hand-rolled BEGIN/COMMIT/ROLLBACK transaction
**Source:** `focus.cjs:49-80`, `migrations/phase-109-nodes-provenance.cjs:371-382`
**Apply to:** `file-evidence-readback.cjs` (wrap node+INFORMS+read-back atomically). node:sqlite has no `transaction(fn)` higher-order helper (per the Phase 87-06 invariant noted in the migration header) -- wrap by hand.

### Audit-node carve-out for system-bookkeeping events
**Source:** `focus.cjs:61-74` (the canonical carve-out comment + `created_by=system review_status=confirmed` write)
**Apply to:** any optional `context_assembled` memory_event in room-context.cjs. A memory_event is a system-bookkeeping node, EXEMPT from the human-confirm rule -- mirror focus.cjs verbatim so the write stays canon-legal (Canon Part 9 v1.5).

### Additive schema change (no migration, locked-field-safe)
**Source:** `migrations/phase-109-nodes-provenance.cjs:95-108` (the `addColumnsIdempotent` ALTER pattern) + `evidence-claim.cjs:82-89` (the locked props object)
**Apply to:** the D-10 `artifact_path` field. It is a NEW OPTIONAL PROPERTY inside the existing `properties` JSON blob (no `ALTER TABLE` needed -- properties is already `TEXT`), so the lighter pattern is "add one key to the props object" rather than a column migration. The migration file is the analog ONLY if a real column is ever needed; for `artifact_path` the additive-prop approach is correct and the 4 locked provenance fields (`source/url/retrieved_at/evidence_tier`) must be PURELY PRESERVED.

### Exact-set adversarial drift test
**Source:** `test-feynman-timeline-canon-part-9-invariant.cjs` (whole file)
**Apply to:** both id-drift tests (LARRY-03 exactly-5, LARRY-04 exactly-3) AND the RETR-03 / D-03a Part-8 source sweeps. Greps source/skill text, asserts a set is EXACTLY the canonical set, scans for forbidden substrings/requires.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | Every 141 file has a live verified analog. This phase is ~90% wiring (Canon Part 7). The closest thing to "no analog" is the conversation-derived seed resolver inside room-context.cjs -- but `focus.cjs::computeAutoFocus` is its direct structural analog (same resolver shape, different seed source: conversation fragments vs venture state), so it is classified role-match, not net-new-from-scratch. |
| `tests/fixtures/` FTS5 virtual table (contingent) | n/a | n/a | DOCUMENTED CONTINGENCY only (D-04b). No FTS5 exists in the repo today (`grep` exit 1). Build only if the RETR-04 benchmark fails the 1200ms budget; until then there is intentionally no file and no analog. |

---

## Metadata

**Analog search scope:** `lib/core/navigation/`, `lib/core/` (memory-ops), `lib/core/migrations/`, `scripts/`, `skills/`, `tests/`
**Files scanned (read):** room-home.cjs, neighborhood.cjs, packet.cjs, evidence-claim.cjs, memory-ops.cjs, focus.cjs, build-graph-from-sqlite.cjs, intent-classifier.cjs (3 ranges), findings-wirer.cjs, navigation.cjs, migrations/phase-109-nodes-provenance.cjs, run-all-126.sh, test-feynman-timeline-canon-part-9-invariant.cjs, larry-personality/SKILL.md, mva-pipeline/SKILL.md, edges.cjs (grep), memory-events.cjs (grep)
**Pattern extraction date:** 2026-06-05
**Canon parts in scope (from CONTEXT frontmatter):** Part 2, Part 3, Part 8, Part 9
