#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-01 Task 2 -- backfill-correlation-id.cjs
 * ====================================================
 * The one-time, idempotent, reversible backfill that stamps a deterministic
 * correlation_id scalar onto every ACTIVE teaching-graph methodology node, AND
 * emits the LOCAL correlation_labels index (canonical_name -> {primary_label,
 * edge_degree}) that Plan 02's no-fork canonical pick consumes WITHOUT a live
 * Cypher.
 *
 * It mirrors scripts/seed-brain-commands.cjs:
 *   --dry-run (DEFAULT) prints the generated MERGE/SET Cypher + the serialized
 *     correlation_labels index + a count summary, then exit(0) WITHOUT touching
 *     the Brain.
 *   --execute requires isAvailable() (a write-capable MINDRIAN_BRAIN_KEY, the
 *     SAME gate seed-brain-commands.cjs --execute uses) and runs each write via
 *     brain-client.query with $-bound params, then writes the local index.
 *
 * THE HASH IS OWNED BY lib/core/correlation.cjs.
 * ==============================================
 * correlation_id = computeCorrelationId(canonical_name, primary_label),
 * computed IN NODE.JS (never in Cypher), so the Brain value and the local
 * recommender value are identical BY CONSTRUCTION. It is name-based and
 * embedding-INDEPENDENT (safe under Phase 134 / 127.1 vector-substrate swaps).
 *
 * CANON PART 8 (Graph Boundary) -- the ONLY values that EVER move toward Brain:
 * ============================================================================
 *   $name  -- a generic methodology/framework handle (already public in the
 *             teaching graph; a node name, not user content)
 *   $label -- the node's primary label enum (e.g. 'Framework')
 *   $cid   -- the computed hex correlation_id scalar
 *   $version, $ts -- the audit stamp (integer + ISO timestamp)
 * ZERO artifact bodies, ZERO room content, ZERO meeting text, ZERO PII cross
 * the boundary. The correlation_labels index is a LOCAL artifact (LOCAL ->
 * LOCAL: YES) and NEVER egresses. The read Cypher selects only n.name + the
 * label enum + the integer degree -- never a property that could carry user
 * content. No destructive verbs anywhere: the backfill only ADDS the scalar
 * property + the audit stamp; it never relabels, never removes a node, never
 * touches an edge. Reversible via the correlation_backfill_version stamp.
 *
 * THE READ NODE SET (where the (name,label,degree) rows come from):
 * ================================================================
 *   --execute  -- enumerated LIVE from the Brain via a READ-ONLY Cypher:
 *       MATCH (n) WHERE NOT 'Archived' IN labels(n) AND n.name IS NOT NULL
 *       RETURN n.name AS canonical_name,
 *              head(labels(n)) AS primary_label,
 *              size((n)--()) AS edge_degree
 *     (excludes :Archived per curation-audit section 9; primary_label is the
 *      first/most-specific label, with a methodology-preferring tie-break.)
 *   --dry-run  -- built from a LOCAL fixture (data/correlation-backfill-fixture.json
 *      when present, else a small built-in representative set). The dry-run
 *      NEVER touches the Brain -- not even a read -- so the captured Cypher is a
 *      pure preview the maintainer approves before any --execute go-ahead.
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

// A small built-in representative read set for the dry-run preview when no
// local fixture is present. These are generic, already-public methodology
// handles + label enums + plausible integer degrees -- NOT user content. It
// includes a cross-label-duplicate (HEART Framework under Framework AND Product,
// Jobs-to-be-Done under Framework AND Concept) so the dry-run exercises the
// exact disambiguation data Plan 02 consumes.
const BUILTIN_DRYRUN_ROWS = [
  { canonical_name: 'Beautiful Question Framework', primary_label: 'Framework', edge_degree: 11 },
  { canonical_name: 'Jobs-to-be-Done', primary_label: 'Framework', edge_degree: 14 },
  { canonical_name: 'Jobs-to-be-Done', primary_label: 'Concept', edge_degree: 3 },
  { canonical_name: 'HEART Framework', primary_label: 'Framework', edge_degree: 8 },
  { canonical_name: 'HEART Framework', primary_label: 'Product', edge_degree: 2 },
  { canonical_name: 'Six Thinking Hats', primary_label: 'Framework', edge_degree: 12 },
  { canonical_name: 'SWOT Analysis', primary_label: 'Framework', edge_degree: 9 },
  { canonical_name: 'Porter Five Forces', primary_label: 'Framework', edge_degree: 7 },
  { canonical_name: 'Blue Ocean Strategy', primary_label: 'Framework', edge_degree: 6 },
  { canonical_name: 'Lean Canvas', primary_label: 'Framework', edge_degree: 10 },
];

// The READ-ONLY Cypher that enumerates the active node set when --execute (or
// --dry-run --read-brain). NO write verb. Excludes :Archived (curation-audit
// section 9). primary_label is the head label; the methodology-preferring
// tie-break for multi-label nodes (Framework over Concept, curation-audit
// section 13) is applied in Node after the read (resolvePrimaryLabel) since
// head(labels(n)) alone is not order-guaranteed across multi-label nodes.
const READ_CYPHER =
  "MATCH (n) WHERE NOT 'Archived' IN labels(n) AND n.name IS NOT NULL " +
  'RETURN n.name AS canonical_name, labels(n) AS all_labels, size((n)--()) AS edge_degree';

// Methodology-preferring label priority for the multi-label tie-break
// (curation-audit section 13: a node that is both :Framework and :Concept is a
// Framework for correlation purposes). Lower index = higher priority.
const LABEL_PRIORITY = ['Framework', 'Methodology', 'Tool', 'Pattern', 'Product', 'Concept', 'DictionaryTerm'];

function resolvePrimaryLabel(allLabels) {
  if (!Array.isArray(allLabels) || allLabels.length === 0) return null;
  const labels = allLabels.filter(function (l) { return typeof l === 'string' && l.length > 0; });
  if (labels.length === 0) return null;
  let best = null;
  let bestRank = Infinity;
  for (const l of labels) {
    const rank = LABEL_PRIORITY.indexOf(l);
    const effective = rank === -1 ? LABEL_PRIORITY.length : rank;
    if (effective < bestRank) { bestRank = effective; best = l; }
  }
  // If nothing matched the priority list, fall back to the first label as-stored.
  return best !== null ? best : labels[0];
}

// The idempotent per-node write Cypher. MATCH the node by $name, guard the
// label, SET the scalar correlation_id + the audit stamp. SET to a value-equal
// scalar is a no-op, so a second run changes nothing (idempotent). Params are
// $-bound, never interpolated.
const WRITE_CYPHER =
  'MATCH (n {name: $name}) WHERE $label IN labels(n) ' +
  'SET n.correlation_id = $cid, ' +
  'n.correlation_backfill_version = $version, ' +
  'n.correlation_backfilled_at = $ts';

function loadDryRunRows() {
  // Prefer a local fixture if present; else use the built-in representative set.
  try {
    if (fs.existsSync(FIXTURE_PATH)) {
      const raw = fs.readFileSync(FIXTURE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_e) {
    // fall through to the built-in set
  }
  return BUILTIN_DRYRUN_ROWS.slice();
}

async function readBrainRows() {
  // READ-ONLY live enumeration. Used by --execute and by --dry-run --read-brain.
  // Performs NO write. Returns normalized {canonical_name, primary_label,
  // edge_degree} rows.
  const brain = require('../lib/core/brain-client.cjs');
  if (!brain.isAvailable()) {
    throw new Error('Brain not available (no MINDRIAN_BRAIN_KEY) -- cannot enumerate live node set.');
  }
  const result = await brain.query(READ_CYPHER);
  const records = (result && Array.isArray(result.records)) ? result.records : [];
  const rows = [];
  for (const rec of records) {
    const name = typeof rec.canonical_name === 'string' ? rec.canonical_name : null;
    if (name === null || name.trim().length === 0) continue;
    const label = resolvePrimaryLabel(rec.all_labels);
    if (label === null) continue;
    let deg = Number(rec.edge_degree);
    if (!Number.isFinite(deg) || deg < 0) deg = 0;
    rows.push({ canonical_name: name, primary_label: label, edge_degree: Math.floor(deg) });
  }
  return rows;
}

// Build the per-node write descriptors: {name, label, cid, params}. The cid is
// computed via the shared chokepoint so Brain and local agree by construction.
function buildWriteDescriptors(rows, nowIso) {
  const out = [];
  for (const r of rows) {
    const name = typeof r.canonical_name === 'string' ? r.canonical_name.trim() : '';
    const label = typeof r.primary_label === 'string' ? r.primary_label.trim() : '';
    if (name.length === 0 || label.length === 0) continue;
    const cid = correlation.computeCorrelationId(name, label);
    out.push({
      name: name,
      label: label,
      cid: cid,
      params: {
        name: name,
        label: label,
        cid: cid,
        version: correlation.CORRELATION_VERSION,
        ts: nowIso,
      },
    });
  }
  return out;
}

// Render the human-readable MERGE/SET Cypher preview (with the bound values
// shown inline as a comment so the maintainer can read what WILL be sent; the
// actual --execute path binds them as $-params, never interpolates).
function renderCypherPreview(descriptors) {
  const blocks = [];
  for (const d of descriptors) {
    blocks.push(
      '// node: ' + d.name + ' :' + d.label + '\n' +
      WRITE_CYPHER + '\n' +
      '// $params = ' + JSON.stringify(d.params)
    );
  }
  return blocks.join('\n\n');
}

function writeLocalIndex(rows) {
  const body = labelIndex.serializeLabelIndex(rows);
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
  const indexBody = labelIndex.serializeLabelIndex(rows);

  if (dryRun) {
    console.log('=== DRY RUN: correlation_id backfill (NO Brain write) ===');
    console.log('Read set source: ' + (readBrain ? 'LIVE read-only Brain enumeration' : 'LOCAL fixture/built-in'));
    console.log('');
    console.log('--- MERGE/SET Cypher (per-node, $-bound on --execute) ---');
    console.log(cypherPreview);
    console.log('');
    console.log('--- correlation_labels index (LOCAL artifact; never egresses) ---');
    console.log(indexBody);
    console.log('');
    console.log('--- Summary ---');
    console.log('nodes scanned:    ' + rows.length);
    console.log('ids computed:     ' + descriptors.length);
    console.log('writes emitted:   ' + descriptors.length + ' (dry-run; none executed)');
    console.log('index rows:       ' + indexBody.split('\n').filter(function (l) { return l.length > 0; }).length);
    console.log('correlation_version: ' + correlation.CORRELATION_VERSION);
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
  for (const d of descriptors) {
    try {
      await brain.query(WRITE_CYPHER, d.params); // $-bound params; never interpolated.
      wrote += 1;
    } catch (e) {
      failed += 1;
      console.error('  write failed for ' + d.name + ' :' + d.label + ' -- ' + (e && e.message ? e.message : e));
    }
  }
  const indexPath = writeLocalIndex(rows);
  console.log('');
  console.log('--- Summary ---');
  console.log('nodes scanned:    ' + rows.length);
  console.log('ids computed:     ' + descriptors.length);
  console.log('writes executed:  ' + wrote);
  console.log('writes failed:    ' + failed);
  console.log('local index:      ' + indexPath);
  console.log('correlation_version: ' + correlation.CORRELATION_VERSION);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(function (e) {
  console.error('FATAL: ' + (e && e.message ? e.message : e));
  process.exit(1);
});
