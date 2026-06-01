#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-01 Task 2 -- backfill-correlation-id.cjs
 * ====================================================
 * The one-time, idempotent, reversible backfill that stamps a deterministic
 * correlation_id scalar onto every ACTIVE, CLEAN-named teaching-graph
 * methodology node, AND emits the LOCAL correlation_labels index
 * (canonical_name -> {primary_label, edge_degree}) that Plan 02's no-fork
 * canonical pick consumes WITHOUT a live Cypher.
 *
 * It mirrors scripts/seed-brain-commands.cjs:
 *   --dry-run (DEFAULT) prints the generated MERGE/SET Cypher (clean 3-property
 *     write + held marker) + the serialized correlation_labels index + a count
 *     summary, then exit(0) WITHOUT touching the Brain.
 *   --execute requires isAvailable() (a write-capable MINDRIAN_BRAIN_KEY, the
 *     SAME gate seed-brain-commands.cjs --execute uses) and runs each write via
 *     brain-client.query with $-bound params, then writes the local index.
 *
 * THE HASH IS OWNED BY lib/core/correlation.cjs.
 * ==============================================
 * correlation_id = computeCorrelationId(canonical_name, primary_label),
 * computed IN NODE.JS (never in Cypher), so the Brain value and the local
 * recommender value are identical BY CONSTRUCTION. The name is hashed RAW (no
 * trim, no case-fold) per the locked contract. It is name-based and
 * embedding-INDEPENDENT (safe under Phase 134 / 127.1 vector-substrate swaps).
 *
 * LOCKED CONTRACT OF RECORD (Phase 131 close-out packet, 2026-06-01)
 * =================================================================
 * The live teaching graph already carries 721 backfilled correlation_ids under
 * THIS exact scheme; this script MUST reproduce it byte-for-byte.
 *
 *   1. SCOPE: active nodes (NOT carrying :Archived) that carry at least one of
 *      the 10 methodology labels AND have a non-null name.
 *   2. primary_label = the highest-priority label by the LOCKED order
 *      (Framework > Technique > Method > Tool > CorePrinciple > ProblemType >
 *       ValidationTool > WorthinessCriteria > Stage > Phase). The order lives in
 *      lib/core/correlation-label-index.cjs (resolvePrimaryLabel) and is REUSED
 *      here (Canon Part 7) so the two cannot drift.
 *   3. PARTITION: size(name) <= 80 is CLEAN (backfilled); size(name) > 80 is
 *      HELD (quarantined -- the name holds a description paragraph, a Phase 132
 *      cleanup candidate).
 *   4. CLEAN write -- exactly THREE properties:
 *        correlation_id            = the locked 16-char hex
 *        correlation_scope         = 'curated-v1'
 *        correlation_backfilled_at = ISO timestamp string
 *      HELD write -- ONLY:
 *        correlation_status        = 'held-name-not-canonical'   (NO correlation_id)
 *      This script writes NO created_by:'phase-132-curation' anywhere -- that
 *      tag is RESERVED for Phase 132. No correlation_backfill_version (removed;
 *      it was the old non-conformant scheme).
 *
 * CANON PART 8 (Graph Boundary) -- the ONLY values that EVER move toward Brain:
 * ============================================================================
 *   $name   -- a generic methodology/framework handle (already public in the
 *              teaching graph; a node name, not user content)
 *   $label  -- the node's primary label enum (e.g. 'Framework')
 *   $cid    -- the computed hex correlation_id scalar
 *   $scope  -- the literal 'curated-v1' enum
 *   $status -- the literal 'held-name-not-canonical' enum (held nodes only)
 *   $ts     -- the audit timestamp (ISO string)
 * ZERO artifact bodies, ZERO room content, ZERO meeting text, ZERO PII cross
 * the boundary. The correlation_labels index is a LOCAL artifact (LOCAL ->
 * LOCAL: YES) and NEVER egresses. The read Cypher selects only n.name + the
 * label set + the integer degree -- never a property that could carry user
 * content. No destructive verbs anywhere: the backfill only ADDS scalar
 * properties; it never relabels, never removes a node, never touches an edge.
 * Reversible via the correlation_scope='curated-v1' stamp.
 *
 * THE READ NODE SET (where the (name,labels,degree) rows come from):
 * =================================================================
 *   --execute  -- enumerated LIVE from the Brain via a READ-ONLY Cypher that
 *      excludes :Archived, requires a non-null name, and requires at least one
 *      of the 10 methodology labels. primary_label is resolved in Node via the
 *      shared resolvePrimaryLabel (the LOCKED priority order).
 *   --dry-run  -- built from a LOCAL fixture (data/correlation-backfill-fixture.json
 *      when present, else a small built-in representative set that INCLUDES a
 *      held > 80-char node so the captured Cypher exercises BOTH the clean
 *      3-property write AND the held correlation_status path). The dry-run NEVER
 *      touches the Brain -- not even a read -- so the captured Cypher is a pure
 *      preview the maintainer approves before any --execute go-ahead.
 *      (Pass --read-brain with --dry-run to preview against the LIVE read-only
 *      enumeration; that flag still performs ZERO writes.)
 *
 * Usage:
 *   node scripts/backfill-correlation-id.cjs --dry-run    # preview, no Brain touch
 *   node scripts/backfill-correlation-id.cjs --execute    # ADMIN ONLY; writes
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const correlation = require('../lib/core/correlation.cjs');
const labelIndex = require('../lib/core/correlation-label-index.cjs');

const PLUGIN_ROOT = path.resolve(__dirname, '..');

// The LOCAL artifact path the correlation_labels index is written to. This is a
// LOCAL sibling index file the room loader folds into
// roomState.brainSections.correlation_labels (mirroring how
// framework_chain_predictions reaches the recommender). It is NOT sent to the
// Brain. Choice rationale: a dedicated sibling file keeps the index a single,
// machine-parseable artifact the recommender reads synchronously, and keeps the
// backfill's local write independent of any per-room BRAIN.md layout.
const LOCAL_INDEX_PATH = path.join(PLUGIN_ROOT, 'data', 'correlation-labels-index.txt');

// Optional local fixture for the dry-run read set. When absent, the built-in
// representative set below is used. The fixture is a JSON array of
// { canonical_name, primary_label, edge_degree } rows.
const FIXTURE_PATH = path.join(PLUGIN_ROOT, 'data', 'correlation-backfill-fixture.json');

// The LOCKED clean/held partition boundary. A node whose name is <= 80 chars is
// CLEAN (gets the 3-property backfill); a node whose name is > 80 chars is HELD
// (its name holds a description paragraph -- a Phase 132 cleanup candidate -- so
// it gets ONLY correlation_status, never a correlation_id). LOCKED by contract.
const CLEAN_NAME_MAX_LEN = 80;

// The locked literal enums written by the clean / held paths.
const CORRELATION_SCOPE = 'curated-v1';
const HELD_STATUS = 'held-name-not-canonical';

// A small built-in representative read set for the dry-run preview when no
// local fixture is present. These are generic, already-public methodology
// handles + label enums + plausible integer degrees -- NOT user content. Rows
// carry `all_labels` (the full label set) so resolvePrimaryLabel runs over the
// same shape the live read produces; primary_label is resolved in Node via the
// LOCKED priority order. The set demonstrates:
//   - a genuine CROSS-LABEL duplicate under the locked priority order: the same
//     name 'The Other Way Round' carried by a :Technique node AND (separately)
//     by a node that is both :Framework and :Technique -- the latter resolves to
//     Framework (higher priority), so the two rows produce two DISTINCT
//     primary_labels and thus two distinct correlation_ids. This is the
//     disambiguation data Plan 02's no-fork canonical pick consumes. (Note: the
//     :Technique-only row is the LOCKED anchor 4210289a0ca1596b.)
//   - a multi-label node whose label set overlaps the 10 (Framework + Tool):
//     'Lean Canvas' resolves to Framework, never Tool.
//   - one HELD node whose name is > 80 chars so the captured Cypher exercises
//     the held correlation_status path.
const BUILTIN_DRYRUN_ROWS = [
  { canonical_name: 'Beautiful Question Framework', all_labels: ['Framework'], edge_degree: 11 },
  { canonical_name: 'Jobs-to-be-Done', all_labels: ['Framework'], edge_degree: 14 },
  { canonical_name: 'HEART Framework', all_labels: ['Framework'], edge_degree: 8 },
  { canonical_name: 'Six Thinking Hats', all_labels: ['Framework'], edge_degree: 12 },
  { canonical_name: 'SWOT Analysis', all_labels: ['Framework'], edge_degree: 9 },
  { canonical_name: 'Porter Five Forces', all_labels: ['Framework'], edge_degree: 7 },
  { canonical_name: 'Blue Ocean Strategy', all_labels: ['Framework'], edge_degree: 6 },
  // Multi-label node overlapping the 10 -> Framework wins over Tool.
  { canonical_name: 'Lean Canvas', all_labels: ['Tool', 'Framework'], edge_degree: 10 },
  // Cross-label duplicate (both rows in the priority list -> two distinct ids):
  // the :Technique-only row IS the LOCKED anchor (4210289a0ca1596b).
  { canonical_name: 'The Other Way Round', all_labels: ['Technique'], edge_degree: 5 },
  { canonical_name: 'The Other Way Round', all_labels: ['Framework', 'Technique'], edge_degree: 9 },
  // HELD example: name > 80 chars (a description paragraph stored as a name).
  // It gets correlation_status only -- NO correlation_id -- per the contract.
  {
    canonical_name:
      'A method for inverting the problem statement so the team reasons backward from the undesired outcome instead of forward from the goal, surfacing hidden constraints',
    all_labels: ['Method'],
    edge_degree: 4,
  },
];

// The LOCKED 10 methodology labels (mirror of LABEL_PRIORITY -- the scope is the
// set of nodes carrying AT LEAST ONE of these). Reused from the label-index
// module so scope + priority cannot drift.
const SCOPE_LABELS = labelIndex.LABEL_PRIORITY;

// resolvePrimaryLabel is OWNED by lib/core/correlation-label-index.cjs (the
// LOCKED priority order). Reused here per Canon Part 7 so the backfill's
// primary_label resolution and the local index's labels are the same function.
const resolvePrimaryLabel = labelIndex.resolvePrimaryLabel;

// The READ-ONLY Cypher that enumerates the active scope set when --execute (or
// --dry-run --read-brain). NO write verb. SCOPE (locked contract section 2):
// active nodes (NOT :Archived) that carry at least one of the 10 methodology
// labels AND have a non-null name. primary_label is resolved in Node after the
// read via resolvePrimaryLabel (the LOCKED priority order) -- head(labels(n))
// is not order-guaranteed across multi-label nodes.
const READ_CYPHER =
  "MATCH (n) WHERE NOT 'Archived' IN labels(n) AND n.name IS NOT NULL " +
  'AND any(l IN labels(n) WHERE l IN $scopeLabels) ' +
  'RETURN n.name AS canonical_name, labels(n) AS all_labels, size((n)--()) AS edge_degree';

// The idempotent per-node CLEAN write Cypher (size(name) <= 80). MATCH the node
// by $name, guard the label, SET exactly the THREE locked scalars. SET to a
// value-equal scalar is a no-op, so a second run changes nothing (idempotent).
// Params are $-bound, never interpolated. NO correlation_backfill_version, NO
// created_by:'phase-132-curation' (Phase-132-reserved).
const WRITE_CYPHER_CLEAN =
  'MATCH (n {name: $name}) WHERE $label IN labels(n) ' +
  'SET n.correlation_id = $cid, ' +
  'n.correlation_scope = $scope, ' +
  'n.correlation_backfilled_at = $ts';

// The idempotent per-node HELD write Cypher (size(name) > 80). The node gets
// ONLY correlation_status -- NO correlation_id, NO scope, NO timestamp. It is
// quarantined as a Phase 132 cleanup candidate.
const WRITE_CYPHER_HELD =
  'MATCH (n {name: $name}) WHERE $label IN labels(n) ' +
  'SET n.correlation_status = $status';

// Normalize a raw read row (either a built-in/fixture row carrying `all_labels`
// or already-shaped {canonical_name, primary_label}) into the canonical
// {canonical_name, primary_label, edge_degree} shape. primary_label is resolved
// via the LOCKED priority order when `all_labels` is present. The name is kept
// RAW (no trim) -- the locked hash is over the name AS STORED.
function normalizeRow(r) {
  if (!r || typeof r !== 'object') return null;
  const name = typeof r.canonical_name === 'string' ? r.canonical_name : null;
  if (name === null || name.length === 0) return null;
  let label = null;
  if (Array.isArray(r.all_labels)) {
    label = resolvePrimaryLabel(r.all_labels);
  } else if (typeof r.primary_label === 'string' && r.primary_label.length > 0) {
    label = r.primary_label;
  }
  if (label === null) return null;
  let deg = Number(r.edge_degree);
  if (!Number.isFinite(deg) || deg < 0) deg = 0;
  return { canonical_name: name, primary_label: label, edge_degree: Math.floor(deg) };
}

function loadDryRunRows() {
  // Prefer a local fixture if present; else use the built-in representative set.
  let raw = BUILTIN_DRYRUN_ROWS.slice();
  try {
    if (fs.existsSync(FIXTURE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
      if (Array.isArray(parsed) && parsed.length > 0) raw = parsed;
    }
  } catch (_e) {
    // fall through to the built-in set
  }
  return raw.map(normalizeRow).filter(function (x) { return x !== null; });
}

async function readBrainRows() {
  // READ-ONLY live enumeration. Used by --execute and by --dry-run --read-brain.
  // Performs NO write. Binds $scopeLabels (the 10 methodology labels). Returns
  // normalized {canonical_name, primary_label, edge_degree} rows (raw names).
  const brain = require('../lib/core/brain-client.cjs');
  if (!brain.isAvailable()) {
    throw new Error('Brain not available (no MINDRIAN_BRAIN_KEY) -- cannot enumerate live node set.');
  }
  const result = await brain.query(READ_CYPHER, { scopeLabels: SCOPE_LABELS });
  const records = (result && Array.isArray(result.records)) ? result.records : [];
  return records.map(normalizeRow).filter(function (x) { return x !== null; });
}

// Build the per-node write descriptors, partitioned CLEAN vs HELD by the LOCKED
// 80-char boundary. CLEAN nodes get the 3-property write (cid via the shared
// chokepoint over the RAW name so Brain + local agree by construction). HELD
// nodes (name > 80 chars) get ONLY correlation_status -- NO correlation_id.
// Returns { clean: [...], held: [...] }.
function buildWriteDescriptors(rows, nowIso) {
  const clean = [];
  const held = [];
  for (const r of rows) {
    // RAW name (no trim) -- the locked hash is over the name AS STORED. The
    // label may be safely trimmed (it is an enum, never padded in the graph).
    const name = typeof r.canonical_name === 'string' ? r.canonical_name : '';
    const label = typeof r.primary_label === 'string' ? r.primary_label.trim() : '';
    if (name.length === 0 || label.length === 0) continue;
    if (name.length > CLEAN_NAME_MAX_LEN) {
      // HELD: name holds a description paragraph. Quarantine (Phase 132 fixes).
      held.push({
        name: name,
        label: label,
        params: { name: name, label: label, status: HELD_STATUS },
      });
      continue;
    }
    const cid = correlation.computeCorrelationId(name, label);
    clean.push({
      name: name,
      label: label,
      cid: cid,
      params: {
        name: name,
        label: label,
        cid: cid,
        scope: CORRELATION_SCOPE,
        ts: nowIso,
      },
    });
  }
  return { clean: clean, held: held };
}

// Render the human-readable MERGE/SET Cypher preview. Clean nodes show the
// 3-property write; held nodes show the correlation_status-only write. Bound
// values are shown inline as a comment so the maintainer can read what WILL be
// sent; the actual --execute path binds them as $-params, never interpolates.
function renderCypherPreview(descriptors) {
  const blocks = [];
  for (const d of descriptors.clean) {
    blocks.push(
      '// CLEAN node: ' + d.name + ' :' + d.label + '\n' +
      WRITE_CYPHER_CLEAN + '\n' +
      '// $params = ' + JSON.stringify(d.params)
    );
  }
  for (const d of descriptors.held) {
    blocks.push(
      '// HELD node (name > ' + CLEAN_NAME_MAX_LEN + ' chars; correlation_status only): ' +
        d.name.slice(0, 60) + '... :' + d.label + '\n' +
      WRITE_CYPHER_HELD + '\n' +
      '// $params = ' + JSON.stringify(d.params)
    );
  }
  return blocks.join('\n\n');
}

// The LOCAL correlation_labels index carries ONLY clean (backfilled) rows --
// a held node has no canonical correlation_id, so it has no entry the no-fork
// canonical pick could resolve. cleanRows is the <= 80-char partition.
function cleanIndexRows(rows) {
  return rows.filter(function (r) {
    return typeof r.canonical_name === 'string' && r.canonical_name.length <= CLEAN_NAME_MAX_LEN;
  });
}

function writeLocalIndex(rows) {
  const body = labelIndex.serializeLabelIndex(cleanIndexRows(rows));
  const header =
    '# correlation_labels (LOCAL index; Canon Part 8 LOCAL -> LOCAL)\n' +
    '# canonical_name | primary_label | edge_degree\n' +
    '# Generated by scripts/backfill-correlation-id.cjs. Never egresses to Brain.\n';
  fs.mkdirSync(path.dirname(LOCAL_INDEX_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_INDEX_PATH, header + body + '\n', 'utf8');
  return LOCAL_INDEX_PATH;
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const readBrain = args.includes('--read-brain');
  // Default to dry-run when --execute is absent (mirrors seed-brain-commands).
  const dryRun = args.includes('--dry-run') || !execute;

  const nowIso = new Date().toISOString();

  // ---- Resolve the read node set ----
  let rows;
  if (execute || (dryRun && readBrain)) {
    rows = await readBrainRows(); // READ-ONLY enumeration; zero writes here.
  } else {
    rows = loadDryRunRows(); // LOCAL fixture / built-in; zero Brain touch.
  }

  const descriptors = buildWriteDescriptors(rows, nowIso);
  const cypherPreview = renderCypherPreview(descriptors);
  const indexBody = labelIndex.serializeLabelIndex(cleanIndexRows(rows));

  if (dryRun) {
    console.log('=== DRY RUN: correlation_id backfill (NO Brain write) ===');
    console.log('Read set source: ' + (readBrain ? 'LIVE read-only Brain enumeration' : 'LOCAL fixture/built-in'));
    console.log('');
    console.log('--- MERGE/SET Cypher (per-node, $-bound on --execute) ---');
    console.log(cypherPreview);
    console.log('');
    console.log('--- correlation_labels index (LOCAL artifact; clean rows only; never egresses) ---');
    console.log(indexBody);
    console.log('');
    console.log('--- Summary ---');
    console.log('nodes scanned:    ' + rows.length);
    console.log('clean (backfilled): ' + descriptors.clean.length + ' (3-property write: correlation_id + correlation_scope + correlation_backfilled_at)');
    console.log('held (quarantined): ' + descriptors.held.length + ' (correlation_status=' + HELD_STATUS + ' only; NO correlation_id)');
    console.log('writes emitted:   ' + (descriptors.clean.length + descriptors.held.length) + ' (dry-run; none executed)');
    console.log('index rows:       ' + indexBody.split('\n').filter(function (l) { return l.length > 0; }).length);
    console.log('correlation_scope: ' + CORRELATION_SCOPE);
    console.log('');
    console.log('Run with --execute (ADMIN ONLY, write-capable MINDRIAN_BRAIN_KEY) to apply.');
    process.exit(0);
  }

  // ---- EXECUTE path (ADMIN ONLY; not run during Plan 130.7-01 execution) ----
  const brain = require('../lib/core/brain-client.cjs');
  if (!brain.isAvailable()) {
    console.error('ERROR: --execute requires a write-capable MINDRIAN_BRAIN_KEY (isAvailable() === false).');
    process.exit(1);
  }
  console.log('=== EXECUTE: correlation_id backfill ===');
  let wrote = 0;
  let failed = 0;
  for (const d of descriptors.clean) {
    try {
      await brain.query(WRITE_CYPHER_CLEAN, d.params); // $-bound; 3-property clean write.
      wrote += 1;
    } catch (e) {
      failed += 1;
      console.error('  clean write failed for ' + d.name + ' :' + d.label + ' -- ' + (e && e.message ? e.message : e));
    }
  }
  for (const d of descriptors.held) {
    try {
      await brain.query(WRITE_CYPHER_HELD, d.params); // $-bound; correlation_status only.
      wrote += 1;
    } catch (e) {
      failed += 1;
      console.error('  held write failed for ' + d.name.slice(0, 60) + '... :' + d.label + ' -- ' + (e && e.message ? e.message : e));
    }
  }
  const indexPath = writeLocalIndex(rows);
  console.log('');
  console.log('--- Summary ---');
  console.log('nodes scanned:    ' + rows.length);
  console.log('clean (backfilled): ' + descriptors.clean.length);
  console.log('held (quarantined): ' + descriptors.held.length);
  console.log('writes executed:  ' + wrote);
  console.log('writes failed:    ' + failed);
  console.log('local index:      ' + indexPath);
  console.log('correlation_scope: ' + CORRELATION_SCOPE);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(function (e) {
  console.error('FATAL: ' + (e && e.message ? e.message : e));
  process.exit(1);
});
