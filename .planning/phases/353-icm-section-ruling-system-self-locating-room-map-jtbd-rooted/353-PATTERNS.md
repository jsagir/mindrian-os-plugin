# Phase 353: ICM Section Ruling System - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 25 (9 new, 16 modified)
**Analogs found:** 24 / 25
**Search scope:** `lib/core/`, `lib/core/doctor/`, `lib/core/navigation/`, `lib/mcp/tools/`, `lib/workflow/`, `scripts/`, `data/`, `tests/`, `templates/room-skeleton/`, `evals/`, `.planning/spikes/002-jev-section-framework-ranker/`

House rule honoured throughout this file: hyphens only, no em-dashes.

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match |
|-------------------|---------|------|-----------|----------------|-------|
| `lib/core/room-map.cjs` | new | service (disk walker + fingerprint) | file-I/O, transform | `lib/core/section-registry.cjs` + `lib/core/room-skeleton-scaffold.cjs` | role-match |
| `lib/core/room-skeleton-scaffold.cjs` | mod | service (filesystem writer) | file-I/O | itself (`writeSectionContracts`, `atomicWrite`) | exact |
| `lib/core/navigation/room-birth.cjs` | mod | service (ACID transaction) | event-driven | itself (FINALIZE block 1183-1218) | exact |
| `lib/core/doctor/room-map-module.cjs` | new | middleware (doctor runner) | request-response (sync check/fix) | `lib/core/doctor/room-md-module.cjs` | exact |
| `lib/core/doctor/section-ruling-module.cjs` | new | middleware (doctor runner) | request-response (sync check/fix) | `lib/core/doctor/room-md-module.cjs` | exact |
| `data/doctor-modules.json` | mod | config (registry) | CRUD | itself, 24 existing rows | exact |
| `lib/core/frontmatter-schemas.cjs` | mod | config (schema table) | transform | itself (`ROOM.md` schema, `selectSchemaKey`) | exact |
| `lib/core/section-registry.cjs` | mod | model (shipped canon table) | CRUD | itself (`CORE_SECTIONS`, `EXTENDED_SECTION_META`) | exact |
| `scripts/build-section-command-ledger.cjs` | new | config generator (release-time build) | batch, network (dev-time only) | `scripts/build-harness-manifest.cjs` + `.planning/spikes/002-.../rank.cjs` | role-match |
| `data/section-command-ledger.json` | new | model (shipped data) | CRUD | `data/command-registry.json`, `data/harness-manifest.json` | exact |
| `lib/core/navigation/jtbd-anchor.cjs` | new | model (graph node writer) | CRUD (idempotent upsert) | `lib/core/navigation/goal-anchor.cjs` | exact |
| `lib/core/navigation.cjs` | mod | route (chokepoint re-export) | pass-through | itself, lines 254-260 | exact |
| `lib/mcp/tools/views.cjs` (`artifact_file`) | mod | controller (MCP tool) | request-response | itself (`fileArtifact`, lines 190-235) | exact |
| `lib/mcp/tools/claim.cjs` (`claim_write`) | mod | controller (MCP tool) | request-response | `lib/mcp/tools/views.cjs::fileArtifact` | role-match |
| `lib/core/section-ruling-candidates.cjs` | new | service (pure producer) | transform | `lib/core/orchestration-candidate-lift.cjs::buildTierCandidates` | exact |
| `lib/core/navigation-engine.cjs` (`decide()`) | mod | service (selection engine) | request-response | itself, SENS-16 producer block lines 1046-1100 | exact |
| The ruling document generator (`writeSectionContracts`) | mod | service (template writer) | file-I/O | itself, lines 354-379 + `templates/room-skeleton/MINTO.md.tmpl` sentinel idiom | exact |
| `templates/room-skeleton/section-contracts/*.md` (11) | mod | config (authored prose) | file-I/O | themselves | exact |
| `scripts/release.sh` | mod | config (release gate) | batch | itself, Step 2.4 `--check` gates and Step 0.6 flag family | exact |
| `scripts/doctor.cjs` (22nd acceptance point) | mod | middleware (acceptance) | request-response | `capability-ledger-fresh` point, lines 1857-1905 | exact |
| `tests/fixtures/icm-rooms/` | new | test fixture | file-I/O | `tests/fixtures/195-nested-room-tree/` | exact |
| `evals/icm/` | new | test data | batch | `evals/eureka/` | role-match |
| `scripts/eval-icm-writers.cjs` | new | utility (dev-time eval runner + De Stijl report) | batch, network (Jev) | `.planning/spikes/002-.../rank.cjs` + `.planning/spikes/002-.../report.cjs` | role-match |
| `tests/test-353-*.cjs` | new | test | request-response | `tests/test-345-gate-anchor.cjs` | exact |
| `tests/run-all-353.sh` | new | test aggregator | batch | `tests/run-all-345.sh` | exact |
| `tests/test-275-section-schema.cjs` | mod | test (two assertions amended) | request-response | itself, lines 330 and 366 | exact |

No file in this phase lacks an analog. The one weakest match is `scripts/eval-icm-writers.cjs`, whose Jev half has no in-repo precedent outside the spike directory, which is where the pattern is taken from.

---

## Pattern Assignments

### `lib/core/room-map.cjs` (new; service, file-I/O + transform)

**Analogs:** `lib/core/section-registry.cjs` (walker + table shape), `lib/core/room-skeleton-scaffold.cjs` (write idioms).

**Section canon table shape to extend, not clone** (`lib/core/section-registry.cjs:17-36`):

```javascript
const CORE_SECTIONS = {
  'problem-definition':    { label: 'PROBLEM DEFINITION',    color: '#A63D2F' },
  'market-analysis':       { label: 'MARKET ANALYSIS',       color: '#C8A43C' },
  // ... 11 total
};
const EXTENDED_SECTION_META = {
  'personas':         { label: 'PERSONAS',         color: '#6C3483' },
};
const STRUCTURAL_DIRS = ['meetings', 'team', 'references'];
```

These are plain object literals, NOT `Object.freeze`d (unlike `SECTION_NAMES` in the scaffolder), so adding `job_id` / `secondary_job` per slug is a data edit. Consume `discoverSections(roomDir)`, which already skips dot-dirs, `STRUCTURAL_DIRS` and any child carrying a `.room-root` sentinel (line 128). That sentinel skip IS the sub-room boundary the map needs.

**Atomic write pattern to copy verbatim** (`lib/core/room-skeleton-scaffold.cjs:139-149`):

```javascript
function atomicWrite(filePath, content) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o755 });
    const tmpPath = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (_e) {
    return false;
  }
}
```

**YAML escape, mandatory on every string value in the `icm_self` block** (`room-skeleton-scaffold.cjs:130-132`, exported):

```javascript
function escapeYamlDoubleQuoted(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
```

**Frontmatter read:** do NOT add a thirteenth local `parseFrontmatter`. Use `gray-matter` (already at `package.json:50`, the ruling is recorded at `tests/test-275-section-schema.cjs:26-28`).

**Suggested exports:** `buildRoomMap(roomDir)`, `writeRoomMap(roomDir, map)`, `renderSelfBlock(node)`, `writeSelfBlocks(roomDir, map)`, `mapFingerprint(nodes)`. All sync (`fs.readdirSync`, `crypto.createHash('sha256')`), because the doctor engine calls `check()` synchronously.

---

### `lib/core/navigation/room-birth.cjs` (mod; service, event-driven ACID)

**Analog:** itself. The FINALIZE block, lines 1183-1218, verbatim at HEAD:

```javascript
if (bornWired) {
  const se = { s1: false, s2: false, s3: false, s4: false, s5: false };
  se.s3 = _verifyNestedWithin(roomDir, slug, parent);
  try {
    se.s2 = _patchChildStateParent(roomDir, parent);
    se.s4 = _patchRegistryLineage(roomsHomeForBirth, slug, parent, roomDir, bornWiredDepth);
    se.s1 = _patchParentStateSubroom(parentRoomDir, slug);
    se.s5 = _invalidateParentWikilinkCache(parentRoomDir);
    // Test-only fault seam: force one side-effect to read as failed to exercise
    // the compensating rollback. Never set in production.
    if (typeof options._faultInject === 'string' && /^s[1-5]$/.test(options._faultInject)) {
      se[options._faultInject] = false;
    }
  } catch (e) {
    _bornWiredRollback(roomDir, slug, roomsHomeForBirth, null, parent);
    return {
      ok: false,
      reason: 'born_wired_side_effect_failed',
      detail: String(e.message || '').slice(0, 120),
      side_effects: se,
    };
  }
  const allWired = se.s1 && se.s2 && se.s3 && se.s4 && se.s5;
  if (!allWired) {
    _bornWiredRollback(roomDir, slug, roomsHomeForBirth, null, parent);
    return { ok: false, reason: 'born_wired_incomplete', side_effects: se };
  }
  return { ok: true, roomDir, slug, db_created: true, born_wired: true, side_effects: se };
}
```

**The exact four-line edit for side effect six:** add `s6: false` to the initializer; add `se.s6 = <map writer>(...)` inside the same `try` (after `se.s5`, so the child tree is complete); add `&& se.s6` to `allWired`; widen the fault regex to `/^s[1-6]$/`. The regex widening is one character and is the only way the unwind test can be written. `_bornWiredRollback` (lines 392-396) needs no change; state explicitly in the plan whether the parent room's own map rebuild is re-run by the rollback or is left in place as an idempotent no-op.

---

### `lib/core/doctor/room-map-module.cjs` and `lib/core/doctor/section-ruling-module.cjs` (new; middleware, sync request-response)

**Analog:** `lib/core/doctor/room-md-module.cjs` (207 lines). Both `check` and `fix` are SYNCHRONOUS; the engine never awaits.

**Reusable walker, do not write a new one** (`room-md-module.cjs:39-75`):

```javascript
const SKIP_DIRS = new Set([
  '.git', '.mindrian', '.context', '.lazygraph', '.rooms',
  'node_modules', '.next', 'dist', 'build', '.cache',
]);

function listSubdirs(rootDir, opts) {
  const o = opts || {};
  const recursive = o.recursive !== false;
  const maxDepth = typeof o.maxDepth === 'number' ? o.maxDepth : 8;
  const results = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_) { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;   // categorical dot-dir skip
      if (SKIP_DIRS.has(entry.name)) continue;
      const sub = path.join(dir, entry.name);
      results.push(sub);
      if (recursive) walk(sub, depth + 1);
    }
  }
  walk(rootDir, 0);
  return results;
}
```

**Registry + scope-resolution + skip-with-detail pattern** (`room-md-module.cjs:101-121`):

```javascript
function check(_ctx) {
  const reg = readRegistry();
  if (!reg) {
    return { status: 'skip', detail: 'no registry; class E scoped to active room', missing: [] };
  }
  const activeName = reg.registry && reg.registry.active;
  if (!activeName) {
    return { status: 'skip', detail: 'no active room', missing: [] };
  }
  const activeInfo = (reg.registry.rooms || {})[activeName];
  if (!activeInfo || !activeInfo.path) {
    return { status: 'skip', detail: 'active room not in registry', missing: [] };
  }
  const roomPath = path.isAbsolute(activeInfo.path)
    ? activeInfo.path
    : path.join(reg.roomsHome, activeInfo.path);
  if (!fs.existsSync(path.join(roomPath, '.room-root'))) {
    return { status: 'skip', detail: 'active room missing .room-root sentinel (class B finding)', missing: [], roomPath };
  }
  // ... walk, collect drift ...
}
```

**The MANDATORY `detail` on the ok path (D-03 rule 9)** (`room-md-module.cjs:136-148`):

```javascript
if (missing.length === 0) {
  // D-03 rule 9: non-empty detail on the ok path (the pre-migration ok return
  // had none).
  return {
    status: 'ok',
    detail: subdirs.length + ' section dir(s) have ROOM.md + MINTO.md',
    missing: [],
    roomPath,
    subdirs: subdirs.length,
  };
}
return {
  status: 'warn',
  missing,
  roomPath,
  subdirs: subdirs.length,
  detail: missing.length + ' dir(s) missing ROOM.md or MINTO.md',
};
```

Every return from both new modules, including `skip` and `ok`, must carry a non-empty `detail` string.

**Fix contract, fix-then-recheck shape** (`room-md-module.cjs:160-198, 201-206`):

```javascript
function performRoomMdRecovery(checkResult) {
  if (!checkResult || checkResult.status !== 'warn') {
    return { status: 'skip', detail: 'no class E drift to recover', tool: '<tool-name>' };
  }
  if (!checkResult.roomPath) {
    return { status: 'error', detail: 'roomPath not set on check result', tool: '<tool-name>' };
  }
  // ... do the repair ...
  const afterCheck = check();
  if (afterCheck.status === 'ok') {
    return { status: 'ok', detail: 'all subdirs now have ROOM.md + MINTO.md', tool: '<tool-name>' };
  }
  return {
    status: 'partial',
    detail: (afterCheck.missing || []).length + ' dir(s) still missing after generation',
    tool: '<tool-name>',
    remaining: afterCheck.missing,
  };
}

// fix(ctx) -- the engine passes the just-run check result on ctx.check_result.
function fix(ctx) {
  const c = ctx || {};
  return performRoomMdRecovery(c.check_result);
}

module.exports = { check, fix };
```

**The `--fix`-on-a-real-room opt-out seam (D-353-9):** set `result.recoverable = false` on the drift classes `--fix` must not auto-heal. The engine's gate at `scripts/doctor.cjs:2690-2700` is `wantFix && mod.fix_supported === true && typeof fixFn === 'function' && (result.status === 'warn' || result.status === 'error') && result.recoverable !== false`.

---

### `data/doctor-modules.json` (mod; config, CRUD)

**Analog:** the 24 existing rows. Every row carries exactly these seven keys, no others. Newest row at HEAD (`icm-part-wiring`, tail of the `modules` array):

```json
{
  "id": "icm-part-wiring",
  "introduced_version": "2.0.0-beta.38",
  "cadence": "always",
  "flag": null,
  "fix_supported": false,
  "runner": "lib/core/doctor/icm-part-wiring-module.cjs",
  "description": "Declaration counts for ICM nested parts ... Check-only: raw counts and totals, no health or completeness claim."
}
```

Two rows to add: `room-map` and `section-ruling`, both `cadence: 'always'`, `fix_supported: true`, `runner: 'lib/core/doctor/<id>-module.cjs'`. `flag: null` means the module runs on bare / `--all` / `--fix`; a named flag means it runs only when that flag is set. `scripts/release.sh` Step 6.6a verifies every runner path exists, so a row pointing at a missing file reds the release. Note the `auto_heal` key does NOT exist in this file at HEAD (grep returned zero hits repo-wide); it is a Phase 352 deliverable that is registered but unplanned, so this phase must either ship without it or land it here deliberately.

---

### `lib/core/navigation/jtbd-anchor.cjs` (new; model, idempotent CRUD)

**Analog:** `lib/core/navigation/goal-anchor.cjs` (160 lines, Phase 345-06). Near-verbatim clone. The full body to copy:

```javascript
const { insertNode } = require('../node-insert.cjs');

function GOAL_ANCHOR_ID(roomSlug) {
  if (typeof roomSlug !== 'string' || roomSlug.length === 0) return null;
  return 'goal:' + roomSlug;
}

function mintGoalAnchor(db, roomSlug) {
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'no_db' };
  }
  const id = GOAL_ANCHOR_ID(roomSlug);
  if (id === null) {
    return { ok: false, reason: 'invalid_slug' };
  }

  let existing;
  try {
    existing = db.prepare('SELECT id FROM nodes WHERE id = ?').get(id);
  } catch (e) {
    return { ok: false, reason: 'anchor_write_failed', detail: String((e && e.message) || e).slice(0, 80) };
  }
  const created = !existing;

  try {
    // on_conflict: 'nothing' is load-bearing: it is what makes the mint safe
    // to re-run on every card build without touching last_seen_at.
    insertNode(db, id, 'goal', '{}', {
      source_path: 'system:goal-anchor',
      created_by: 'system',
      epistemic_type: 'assumption',
      review_status: 'proposed',
      on_conflict: 'nothing',
    });
  } catch (e) {
    return { ok: false, reason: 'anchor_write_failed', detail: String((e && e.message) || e).slice(0, 80) };
  }

  return { ok: true, node_id: id, created: created };
}

module.exports = { mintGoalAnchor, GOAL_ANCHOR_ID };
```

**Four substitutions for this phase:** id prefix `'jtbd:'`; `source_path: 'system:jtbd-anchor'`; `epistemic_type: 'observation'` (a folder's declared job is a fact about the folder, per D-353-8); and the node type. **The node type MUST NOT be `'claim'`.** `goal-anchor.cjs:29-33` states why verbatim:

> `node.type` IS `'goal'` AND NEVER `'claim'`. A `claim`-typed anchor with nothing above it would land in Phase 343's `unanchored_claims` numerator as a brand-new unanchored claim in every room.

Use `'jtbd'`. `ALLOWED_EPISTEMIC_TYPES` has exactly 10 members and `lib/core/node-insert-epistemic.test.cjs:84` asserts that count exactly; `observation` is already a member, so no change is needed there.

**The BLOCKING ordering rule** (`goal-anchor.cjs:47-56`): `writeEdge` never probes whether either endpoint has a node row (the FK was removed in Phase 169 D-169-11). Mint the `jtbd:<job_id>` node, confirm `ok: true`, THEN write the edge. Every time.

**Re-export from the chokepoint** (`lib/core/navigation.cjs:254-260`), alongside the existing pair:

```javascript
  //   load-bearing: the caller MUST mint before writeEdge/writeReasoningNode
  //   ever names this id, because writeEdge probes no endpoint (D-169-11)
  //   and a SOURCED_FROM edge to an unminted anchor becomes a dangling row.)
  mintGoalAnchor: goalAnchor.mintGoalAnchor,
  GOAL_ANCHOR_ID: goalAnchor.GOAL_ANCHOR_ID,
```

---

### The anchor edge write (WD-353-2 resolves to `SOURCED_FROM`)

**Analog:** `lib/core/navigation/reasoning-write.cjs:178-192`, the shipped claim-to-anchor edge write:

```javascript
let edgesWritten = 0;
for (const target of targets) {
  // Edge properties are ENUM/scalar only per Canon Part 8 -- a relation
  // enum and an origin enum. Never prose, never a claim or artifact body.
  const result = edges.writeEdge(db, {
    source_id: nodeId,
    target_id: target,
    edge_type: 'SOURCED_FROM',
    properties: { relation: 'sourced_from', origin: (typeof origin === 'string' ? origin : '') },
  });
  if (result && result.ok === true) edgesWritten += 1;
  // Never let an edge failure fail the whole call: the node write already
  // succeeded and losing it would be worse than a missing edge.
}
```

`SOURCED_FROM` is already a member of the 44-strong frozen `ALLOWED_EDGE_TYPES` in `lib/core/navigation/edges.cjs:32`. Add no new member. Explicitly record the rejection of the three tempting alternatives: `SHARES_JOB` is taken by `lib/core/fusion-router.cjs:358`, `MAPS_TO_SECTION` by `lib/core/navigation/grant-rubric.cjs:134`, and `PART_OF` has no claim-to-anchor precedent.

---

### `lib/mcp/tools/views.cjs` (`artifact_file`) and `lib/mcp/tools/claim.cjs` (`claim_write`) (mod; controller, request-response)

**Analog:** `fileArtifact` in `lib/mcp/tools/views.cjs:190-235`. It already does all three things the filing gate needs. The memory_event log (reuse `mcp_client_event_logged` for the `job_mismatch` disclosure; do NOT mint a new `EVENT_TYPES` member, there are 102 and the test convention on that set is not a floor):

```javascript
const logResult = navigation.logMemoryEvent(db, 'mcp_client_event_logged', {
  label: 'artifact_file',
  section: p.section || null,
  filename: filename,
  artifact_id: artifactId,
});
```

The node mint plus the never-fabricate-provenance guard:

```javascript
let reasoningNode = null;
if (artifactId) {
  try {
    const nodeId = navigation.REASONING_NODE_ID('claim:artifact', artifactId);
    if (nodeId) {
      const text = firstArtifactBodyLine(typeof p.content === 'string' ? p.content : '');
      const epistemicType = (typeof p.epistemicType === 'string' && p.epistemicType.length > 0)
        ? p.epistemicType
        : 'conclusion';
      reasoningNode = navigation.writeReasoningNode(db, {
        nodeId, nodeType: 'claim', epistemicType, text,
        section: p.section || null,
        sourcePath: 'artifact:' + artifactId,
        evidenceNodeIds: p.evidenceNodeIds,
        framework: null,
        origin: 'artifact_file',
      });
    }
  } catch (e) {
    reasoningNode = { ok: false, reason: 'reasoning_write_threw', detail: String((e && e.message) || e).slice(0, 80) };
  }
}
```

**`artifact_file` already has a `section` parameter** (`z.string().regex(SECTION_RE)`, registered line 317), so the gate can compare directly against the section's `job_id`. **`claim_write` has no `section` and no `serves_jtbd` parameter.** Resolve the section through `navigation.getActiveFocus(db)` (exported at `navigation.cjs:75`) rather than widening the MCP schema; widening changes the born-wired source of truth and forces a `build-connector-registry.cjs` regeneration. Both tools carry `hitl_shape: 'F.1'`, `layer: 'harness'`; a read-only gate does not change either declaration.

**Canon Part 9 floor:** a failed anchor mint means no edge, never a refused claim, unless the navigator set `strict`. Bookkeeping never blocks a write.

---

### `lib/core/section-ruling-candidates.cjs` (new) + `lib/core/navigation-engine.cjs` `decide()` (mod)

**Analog:** the SENS-16 producer block, `lib/core/navigation-engine.cjs:1046-1100`. Copy the shape exactly: a braced block, ctx-assembly-time LOCAL read, caller-threaded `ctx.*` overrides winning as the test seam, try/catch soft-failing to a neutral value, and a header comment stating the measured cost against the 1200 ms budget.

```javascript
  // Phase 244 Plan 05 producer (SENS-16, TRIG-01): derive the content-relevance
  // scalars sensorContentRelevance reads ... The db read
  // runs HERE (ctx-assembly), NEVER inside the pure sensor (Part 8/9). ...
  // Caller-threaded ctx.* scalar overrides win (the test seam that lets a unit
  // test fire the sensor with no db, no FTS index, and no fixture at all).
  // Defensive; never throws. lexicalSearch is sync and measured at 0-1 ms on a
  // warm index, so this block is free against the 1200ms NAV budget.
  {
    let contentHitCount = 0;
    let contentCoverage = 0;
    let contentIndexState = 'unavailable';
    const roomDb = (ctx.roomDb && typeof ctx.roomDb.prepare === 'function') ? ctx.roomDb : null;
    if (roomDb) {
      try {
        const sig = detectContentRelevance(roomDb, { turnText, roomDir: roomDirForContent || undefined });
        if (sig && typeof sig === 'object') { /* ... narrow to scalars ... */ }
      } catch (_e) { /* soft-fail to the neutral value */ }
    }
  }
```

**The runtime seam is `rankForSelector`'s EXISTING `o.tierCandidates` input**, not the reach dial. Do not touch `lib/hmi/dial-reach-orchestrator.cjs`: its `REACH_DEFS` is a frozen six-member machine-reach vocabulary and it does not rank commands at all. Do not add a sensor: `SENSOR_REGISTRY` / `SENSOR_REGISTRY_IDS` / `SENS_PRIORITY` is a seven-place lockstep with two build gates. Producer shape to copy: `lib/core/orchestration-candidate-lift.cjs:79::buildTierCandidates(sensorReaches, projectionOffer)`, which groups option command slugs by family preserving option order. Module-level cache the shipped ledger JSON on first read.

---

### `writeSectionContracts` becomes the ruling document generator (mod; service, file-I/O)

**Analog:** itself, `lib/core/room-skeleton-scaffold.cjs:354-379`, today a verbatim copier:

```javascript
function writeSectionContracts(roomDir, sectionList, result) {
  for (const slug of sectionList) {
    const targetPath = path.join(roomDir, slug, 'CONTEXT.md');
    if (fs.existsSync(targetPath)) continue; // Canon Part 9: never overwrite

    const sourcePath = path.join(SECTION_CONTRACTS_DIR, slug + '.md');
    if (!fs.existsSync(sourcePath)) {
      result.warnings.push('contract_template_missing:' + slug);
      continue;
    }
    let contractContent;
    try {
      contractContent = fs.readFileSync(sourcePath, 'utf8');
    } catch (_e) {
      result.errors.push('contract_write_failed:' + slug);
      continue;
    }
    if (atomicWrite(targetPath, contractContent)) {
      result.contracts_created.push(slug);
    } else {
      result.errors.push('contract_write_failed:' + slug);
    }
  }
}
```

**Three deliberate changes, each a named task:** the never-overwrite `continue` becomes a replace-the-marked-block write for the generated region only; frontmatter is added; the two shipped assertions in `tests/test-275-section-schema.cjs` (line 330 "no contract template has YAML frontmatter"; line 366 "every landed CONTEXT.md is byte-identical to its template") are amended deliberately, not stumbled over. Never run `renderTemplate` substitution over contract prose (T-275-13: a stray `{{` in prose corrupts a room file).

**Generated-block-in-an-authored-file precedent:** `templates/room-skeleton/MINTO.md.tmpl`, described at `room-skeleton-scaffold.cjs:506-507` as "the sentinel-bounded content is the contract". Target shape:

```markdown
---
icm_layer: 2
job_id: find-problem
ruling_fingerprint: <sha256 over canon-row + ledger-row + writer-contract version>
generated_at: <iso>
---

<!-- mos:ruling:begin  DO NOT EDIT. Regenerated from data/section-command-ledger.json
     and lib/core/section-registry.cjs by doctor --fix. Edits here are drift. -->
## 1. Job
## 2. Methodology sequence
## 3. Writing rules
## 4. Gates
## 5. Checks
## 6. Commands that write here
<!-- mos:ruling:end -->

# problem-definition - the problem, not a solution
**Statement:** ...
One job: ...
## Inputs
Do NOT load: ...
## Process
## Outputs
## Human check
```

The `Do NOT load:` line stays authored and mandatory (icm-architect invariant 4). The whole file stays in the L2 band (200-500 tokens); overflow goes to `references/SECTION-SCHEMA.md` (L3), which `writeReferenceDocs` already ships.

---

### `lib/core/frontmatter-schemas.cjs` (mod; config, transform)

**Analog:** itself. `selectSchemaKey` (lines 279-289) switches on `path.basename`: `ROOM.md`, `STATE.md`, `MINTO.md`, `USER.md`, else `artifact-default`. `CONTEXT.md` falls through to `artifact-default` today.

**Two required edits, each a named task:**
1. Add `icm_self` and `job_id` to the `ROOM.md` schema's `optional` allow-list. An unlisted key emits a `{ type: 'unknown' }` violation at line 318. It is advisory (line 466: unknown fields "do NOT invalidate"), but it is a PostToolUse hook that fires on every write and the file's own header names the last drift here as a Canon Part 6 dog-food self-violation.
2. Add a `CONTEXT.md` arm to `selectSchemaKey` with its own schema carrying `icm_layer`, `job_id`, `ruling_fingerprint`, `generated_at`, or the ruling document lands four `unknown` violations on every regeneration.

---

### `scripts/build-section-command-ledger.cjs` (new; config generator, batch + dev-time network)

**Analog for the `--check` idiom:** `scripts/build-harness-manifest.cjs:1052-1064`, one of eleven `build-*.cjs --check` siblings:

```javascript
// main() -- the 3-branch entry: default write / --check / --refresh.
function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--check')) {
    runCheck();
    return;
  }
  writeManifest();
}

if (require.main === module) {
  main();
} else {
  module.exports = { buildManifest, serializeManifest, validateManifest, digestBytes, /* ... */ };
}
```

```javascript
function writeManifest() {
  const manifest = buildManifest();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, serializeManifest(manifest));
}
```

**State the divergence from the sibling contract in the script header:** the full rebuild needs Theo and Jev, so `--check` must NOT rebuild. It asserts only what is verifiable offline: `plugin_version`, `built_at` age, `theo_frameworks` count, `jev_model`, and that every `rows` key parses as `<job_id>|<problem_type>|<stage>` with a known `job_id`. Also note `runCheck()` prints `'<name>: OK'` on success and exits non-zero on drift; keep that contract.

**Theo puller:** verbatim port of `.planning/spikes/002-jev-section-framework-ranker/rank.cjs::pullTheoFrameworks` (lines 145-195). Two FIXED Cypher texts (`CYPHER_PREFIX` at 160-167, `CYPHER_OTHER` at 168-175); every variation rides in `$params` because `check-substrate.cjs` rule `m4-cypher-interpolation` forbids concatenated Cypher. Read the result as `(res && (res.rows || res.records)) || []` (`brain-client.cjs::query` at line 920 normalizes three shapes and returns `{records: [], error: 'brain_query_unrecognized_shape'}` on a fourth). Honour `ROW_CAP=100` with 36 alnum buckets plus one catch-all and recursive split to depth >= 2 on a cap hit.

**Jev client:** the zero-dep `jev(key, body)` + `pool(items, n, fn)` + `400 * 2 ** attempt` backoff from the spike sources. Key at `~/.secrets/typesafe.env` mode 600, never hardcoded, never printed, never committed. Batch 20, concurrency 4.

**Canon Part 8 egress ceiling:** only a framework name, a JTBD statement and a glossary line ever cross to Jev. Never room content, never a full Theo description.

**Release wiring** (`scripts/release.sh`): Step 2.4 (lines 356-370) gets the `--check` staleness assertion, NOT the rebuild. The audited opt-out is a third flag of the `--no-theo-check` / `--no-theo-notify` family (e.g. `--no-ledger-rebuild`), declared in `USAGE_BLOCK` (line 149) and named in the release log with its consequence.

---

### `scripts/doctor.cjs` 22nd acceptance point (mod; middleware, request-response)

**Analog:** the `capability-ledger-fresh` point, `scripts/doctor.cjs:1878-1905`. Exact template:

```javascript
      id: 'capability-ledger-fresh',
      label: 'capability ledger freshness: data/capability-ledger.json tracks the installed claude --version',
      severity: 'blocker',
      applies_to: ['pre-tag', 'full'],
      run: async function () {
        if (inTestMode && process.env.DOCTOR_TEST_FAIL_POINT === 'capability-ledger-fresh') {
          return { ok: false, finding: 'capability-ledger-fresh synthesized failure (test mode)', detail: {} };
        }
        if (process.env.DOCTOR_SKIP_CAPABILITY_LEDGER === '1') {
          return { ok: true, finding: null, detail: { skipped: true, reason: 'DOCTOR_SKIP_CAPABILITY_LEDGER=1' } };
        }
        try {
          const ledgerMod = require(path.join(__dirname, '..', 'lib', 'core', 'doctor', 'capability-ledger-module.cjs'));
          const result = ledgerMod.check({});
          if (!result || result.status !== 'ok') {
            return {
              ok: false,
              finding: 'capability-ledger-fresh: ' + (result && result.detail || 'check() returned no detail'),
              detail: { status: result && result.status },
            };
          }
          return { ok: true, finding: null, detail: { status: result.status, detail: result.detail } };
        } catch (e) {
          return { ok: false, finding: 'capability-ledger-fresh threw: ' + e.message, detail: {} };
        }
      },
```

Note the three reusable moves: `require` the module runner directly and call `check({})` in-process (never re-spawn doctor.cjs); a `DOCTOR_TEST_FAIL_POINT` arm; and a `DOCTOR_SKIP_<NAME>=1` hermetic-CI escape.

**Hard constraint for this phase:** the eval runner is NOT purely local (it calls Jev), so the new point must read `evals/icm/last-run.json` and assert freshness plus the >= 0.8 agreement threshold. It must never fire a vendor call on the release path. It must degrade to `ok` with a named `detail` on a missing eval file, or it will break `tests/test-doctor-acceptance-self-coverage.cjs`, which asserts a per-fixture pass/fail signature across five scaffolded broken-state fixtures. That test asserts no point count, so adding a 22nd point is otherwise safe.

---

### `tests/fixtures/icm-rooms/` (new; test fixture, file-I/O)

**Analog:** `tests/fixtures/195-nested-room-tree/`, the only committed fixture that models nesting:

```
195-nested-room-tree/root-room/{.room-root, ROOM.md, STATE.md, MINTO.md, USER.md, FEYNMAN.md, BRAIN.md}
  section-alpha/{ROOM.md, STATE.md, MINTO.md, USER.md, FEYNMAN.md, BRAIN.md}
    sub-room/{.room-root, ROOM.md, STATE.md, MINTO.md, USER.md, FEYNMAN.md, BRAIN.md}
      sub-sub-room/{...}
```

Six-file memory complement at every level; `.room-root` at each room boundary but NOT at `section-alpha`. **Build `icm-rooms/` as a NEW sibling; do not extend `195-nested-room-tree`**, because `tests/test-195-recursive-reconcile.cjs:172` asserts `files.length === 16` against that exact tree.

**In-test fixture room construction idiom** (`tests/test-345-gate-anchor.cjs:64-73`), for the db-backed legs:

```javascript
function makeFixtureRoom() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), '345-06-anchor-'));
  const handle = roomDbMod.openRoomDb(roomDir);
  return { roomDir: roomDir, db: handle };
}

function cleanupFixtureRoom(fixture) {
  try { roomDbMod.closeRoomDb(fixture.db); } catch (_e) { /* tolerant */ }
  try { fs.rmSync(fixture.roomDir, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
}
```

Plus the module-load SKIP guard from the same file (lines 36-53): `require` everything inside one try, and on failure print `SKIP: <test> -- node:sqlite or a required module is unavailable` and `process.exit(0)` rather than failing.

---

### `tests/run-all-353.sh` (new; test aggregator, batch)

**Analog:** `tests/run-all-345.sh:1-60`:

```bash
#!/usr/bin/env bash
# Phase 345 ... verification aggregator.
#
# STRAT ids each leg gates:
#   test-345-rung-mapping.cjs        STRAT-03
#   ...
#
# IMPORTANT: this aggregator is written ONCE, here, in 345-01, and NO LATER
# PLAN IN THIS PHASE EDITS IT. A later plan adds its own test file
# (tests/test-345-*.cjs); the run_if legs below and the em-dash guard's
# targeted glob both pick up a landed file automatically.
#
# House rule: hyphens only, no em-dashes, no emoji.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
SKIP=0

run() {
  local label="$1"; shift
  echo "--- $label ---"
  if "$@"; then echo ">>> $label: PASSED"; PASS=$((PASS+1)); else echo ">>> $label: FAILED"; FAIL=$((FAIL+1)); fi
  echo ""
}

run_if() {
  local label="$1"; local guard="$2"; shift 2
  if [ -f "$guard" ]; then
    run "$label" "$@"
  else
    echo "--- $label ---"; echo ">>> $label: SKIPPED (missing $guard)"; SKIP=$((SKIP+1)); echo ""
  fi
}
```

Binding convention to carry over: write the aggregator ONCE in Plan 1, list which requirement id each leg gates in the header, use `run_if` so a not-yet-landed test file SKIPs rather than fails, and carry the phase's own targeted em-dash guard glob.

---

### `scripts/eval-icm-writers.cjs` and `evals/icm/` (new; utility, batch)

**Analog for the directory shape:** `evals/eureka/` (README.md, per-phase report `.md` + `.json` pairs, a `cases/` dir). `evals/icm/` follows: `README.md`, one checklist file per writer, `cases/`, and a `last-run.json` the acceptance point reads.

**Analog for the De Stijl renderer:** `.planning/spikes/002-jev-section-framework-ranker/report.cjs`. Its header states the contract verbatim: "renders results.json as a static De Stijl HTML page the navigator can open and feel. No CDN, no deps, inline CSS/JS, hyphens only." Palette: `--red:#D40920; --blue:#1356A2; --yellow:#F7D842; --black:#111; --white:#FAFAF7`, 3px/6px black rules, IBM Plex Sans. **Port it; do not author a new palette.** There is no shared renderer module in the repo, so this is the closest and most directly reusable source.

**Token measurement:** use `lib/core/token-estimator.cjs::estimateTokens` (line 123-127, `Math.ceil(str.length / 4)`) and nothing else. Do not add a fourth chars-over-4 copy. For the per-turn number, read `getRoomContext`'s `_meta.legCostChars` / `_meta.legCostTokensApprox` (`lib/core/navigation/room-context.cjs:417-418`) with `opts.estimateOnly` (line 390). Adding the `icm_self` + ruling read as `legE` must be PURELY additive; the return-shape comment at lines 393-399 requires every existing field stay byte-stable. Say "chars-over-4 approximation, the repo's own estimator" rather than "tokens" unqualified.

---

## Shared Patterns

### Atomic write (apply to every file writer in this phase)
**Source:** `lib/core/room-skeleton-scaffold.cjs:139-149` (`atomicWrite`), mirrored at `room-birth.cjs:414-416, 465-467, 487-489`.
**Apply to:** `room-map.cjs`, the `icm_self` block writer, the ruling document generator, both doctor `fix()` paths.
tmp + pid + random suffix, then rename. A torn ROOM.md is worse than a missing one (Phase 124-02 precedent).

### Frontmatter parse
**Source:** `gray-matter` ^4.0.3, `package.json:50`. Ruling recorded at `tests/test-275-section-schema.cjs:26-28`.
**Apply to:** every ROOM.md and CONTEXT.md read in this phase.
Twelve independent local `parseFrontmatter` copies already exist (`mva-rule-linter.cjs:127`, `opportunity-ops.cjs:24`, `scheduled-scanner.cjs:33`, `decision-capture.cjs:89`, `brain-md-staleness.cjs:131`, `user-md-ops.cjs:145`, `reasoning-ops.cjs:39`, `persona-ops.cjs:32`, `feynman/timeline-runner.cjs:35`, `vault/frontmatter-schema.cjs:90`, `vault/room-scanner.cjs:87`, `mcp/app-views.cjs:65`). Do not add a thirteenth.

### YAML value escape
**Source:** `room-skeleton-scaffold.cjs:130-132::escapeYamlDoubleQuoted` (exported).
**Apply to:** every string value in the `icm_self` block (`room`, `path`, `parent`, each child name) and every string in the ruling document frontmatter.
It exists because a mid-sentence `": "` already corrupted a room file once (Phase 275-08 CR-01).

### Never-throw, degrade-to-a-reason error handling
**Source:** `goal-anchor.cjs` throughout, `reasoning-write.cjs:155-157`.
**Apply to:** every new module in this phase.
```javascript
} catch (e) {
  return { ok: false, reason: '<named_reason>', detail: String((e && e.message) || e).slice(0, 80) };
}
```
The 80-char `detail` slice and the `{ ok, reason, detail }` triple are the house shape. The birth block uses a 120-char slice (`room-birth.cjs:1201`); match whichever file you are inside.

### The single graph write door
**Source:** `lib/core/navigation.cjs` (Canon Part 9, CLAUDE.md constraint 4).
**Apply to:** the `jtbd:<job_id>` node mint and its anchor edge.
Node through `node-insert.cjs::insertNode` (via the anchor module), edge through `navigation.writeEdge`. Never a raw `INSERT INTO nodes` or `INSERT INTO edges`; `scripts/check-substrate.cjs` refuses `raw-graph-write` in `--diff` mode at pre-commit with exit 1.

### Doctor module contract
**Source:** `lib/core/doctor/room-md-module.cjs`, D-03 rule 9 cited at `room-md-module.cjs:139`, `cascade-rooms-module.cjs:88`, `cascade-rooms-active-module.cjs:24`, `ui-compliance-module.cjs:206`, `card-fire-health-module.cjs:140`.
**Apply to:** both new doctor modules.
`{ check(ctx), fix(ctx) }`, both SYNCHRONOUS, both returning a non-empty `detail` on every path including `skip` and `ok`. Never back-require the doctor CLI (circular). `result.recoverable = false` opts a drift class out of auto-fix.

### No em-dashes
**Source:** CLAUDE.md hard rule, enforced by `scripts/check-voice-style.cjs` and a targeted glob inside each `tests/run-all-<phase>.sh`.
**Apply to:** every file in this phase, including comments, JSON descriptions, the generated ruling documents and the eval report HTML.

---

## No Analog Found

None. Every file in this phase has at least a role-match analog in the repo or in `.planning/spikes/002-jev-section-framework-ranker/`.

The two nearest things to a gap, both worth flagging to the planner:

| Gap | Why it is not a missing analog |
|-----|-------------------------------|
| A fingerprinted frontmatter writer | None exists at HEAD (Seam 3 verdict). The write idiom is assembled from `atomicWrite` + `escapeYamlDoubleQuoted` + `gray-matter` + `node:crypto` sha256, all shipped. |
| A shared De Stijl report renderer | None exists; every report inlines its own CSS. `.planning/spikes/002-.../report.cjs` is the navigator-approved source to port. |

---

## Anti-Patterns (explicit do-not list for the planner)

| Do not | Because |
|--------|---------|
| Touch `lib/hmi/dial-reach-orchestrator.cjs` | `REACH_DEFS` is a frozen six-member machine-reach vocabulary; it does not rank commands. `DIAL_REACH_K=6`, `RECOMMEND_FLOOR=0.70`, `MARGIN_THRESHOLD=0.15` are Canon Part 3 frozen. |
| Add a sensor | `SENSOR_REGISTRY` / `SENSOR_REGISTRY_IDS` / `SENS_PRIORITY` is a seven-place lockstep with two build gates (`build-connector-registry.cjs --check`, `tests/test-245-priority-complete.cjs`). This phase needs none of it. |
| Type the `jtbd:` anchor as `'claim'` | It would land in Phase 343's `unanchored_claims` numerator as a brand-new unanchored claim in every room. The sharpest trap in the phase. |
| Add a member to `ALLOWED_EPISTEMIC_TYPES` | `node-insert-epistemic.test.cjs:84` asserts `size === 10` exactly. `observation` is already a member. |
| Add a member to `EVENT_TYPES` | 102 members; reuse `mcp_client_event_logged` for the `job_mismatch` disclosure. |
| Add a member to `ALLOWED_EDGE_TYPES` | `SOURCED_FROM` already carries this exact claim-to-anchor semantics on `artifact_file`'s own shipped path. |
| Substitute `{{TOKENS}}` into contract prose | T-275-13 exists because a stray `{{` in prose corrupts a room file. |
| Extend `tests/fixtures/195-nested-room-tree/` | `test-195-recursive-reconcile.cjs:172` asserts `files.length === 16`. |
| Build a second self-location store | The map is truth, the block is the derived view (icm-architect authority rule, invariant 9). A block that disagrees is a doctor finding, not a preference. |
| Block a write on bookkeeping | Canon Part 9. A failed anchor mint means no edge, never a refused claim, unless the navigator set `strict`. |
| Register a doctor check inline in `doctor.cjs` main() | Phase 217 migrated the last inline checks out; Step 6.6a gates the registry. |

---

## Metadata

**Analog search scope:** `lib/core/`, `lib/core/doctor/`, `lib/core/navigation/`, `lib/core/sensors/`, `lib/mcp/tools/`, `lib/workflow/`, `lib/hmi/`, `scripts/`, `data/`, `tests/`, `tests/fixtures/`, `templates/room-skeleton/`, `evals/`, `.planning/spikes/002-jev-section-framework-ranker/`
**Files read for excerpts:** `lib/core/navigation/goal-anchor.cjs`, `lib/core/doctor/room-md-module.cjs`, `lib/core/room-skeleton-scaffold.cjs`, `lib/core/navigation/room-birth.cjs`, `lib/core/section-registry.cjs`, `lib/core/navigation.cjs`, `lib/core/navigation-engine.cjs`, `lib/core/navigation/reasoning-write.cjs`, `lib/mcp/tools/views.cjs`, `scripts/build-harness-manifest.cjs`, `scripts/doctor.cjs`, `data/doctor-modules.json`, `tests/test-345-gate-anchor.cjs`, `tests/run-all-345.sh`
**Pattern extraction date:** 2026-09-17
**HEAD at extraction:** `c9d8cf91b` (v2.0.0-beta.45 line)
