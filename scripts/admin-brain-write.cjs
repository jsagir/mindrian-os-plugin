#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1 Plan 04 -- one-shot Brain-write wrapper for the v1.11.0
 * milestone canon edge: USES_TECHNIQUE from rss-phase-1 to
 * tech-domain-analysis. ONE write only. Reads MINDRIAN_BRAIN_KEY
 * from env (admin gate enforced by commands/admin.md Step 1).
 *
 * Exit codes:
 *   0  -> success (edge merged or already exists; result printed)
 *   2  -> pre-write check failed (one or both target nodes missing)
 *   1  -> write call failed (Brain unreachable, plan-gated, or Cypher error)
 *
 * Usage:
 *   node scripts/admin-brain-write.cjs --dry-run     (pre-check + show MERGE Cypher; do NOT mutate)
 *   node scripts/admin-brain-write.cjs --execute     (pre-check + MERGE + audit append)
 *
 * Audit log destination: ~/.mindrian/admin-brain-write.jsonl (one JSON line per invocation).
 * Canon Part 8: this write carries ONE methodology-canon edge with TWO frozen node IDs;
 * zero user data, zero artifact bytes, zero meeting fragments.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Resolve plugin root from this script's location (scripts/ is a sibling of lib/).
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const brainClient = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'brain-client.cjs'));

// FROZEN canonical node IDs (CONTEXT.md USES_TECHNIQUE workflow):
const SOURCE_NODE = { label: 'ProcessStep', id: 'rss-phase-1' };
const TARGET_NODE = { label: 'Technique',   id: 'tech-domain-analysis' };
const EDGE_TYPE   = 'USES_TECHNIQUE';

// Pre-write read: confirm BOTH nodes exist. Identifiers are hardcoded
// string literals; no user-controlled interpolation.
const PRE_WRITE_CYPHER =
  'MATCH (p:ProcessStep {id: "rss-phase-1"}), (t:Technique {id: "tech-domain-analysis"}) ' +
  'RETURN count(p) AS p_count, count(t) AS t_count';

// MERGE: idempotent. Re-running yields 0 new edges if already present.
// Returns count of edges in the resulting MATCH.
const MERGE_CYPHER =
  'MATCH (p:ProcessStep {id: "rss-phase-1"}), (t:Technique {id: "tech-domain-analysis"}) ' +
  'MERGE (p)-[r:USES_TECHNIQUE]->(t) ' +
  'RETURN count(r) AS edges_after';

// Rollback (NOT executed; captured for evidence doc):
const ROLLBACK_CYPHER =
  'MATCH (p:ProcessStep {id: "rss-phase-1"})-[r:USES_TECHNIQUE]->(t:Technique {id: "tech-domain-analysis"}) ' +
  'DELETE r ' +
  'RETURN count(r) AS edges_deleted';

function getAuditPath() {
  return path.join(os.homedir(), '.mindrian', 'admin-brain-write.jsonl');
}

function appendAudit(entry) {
  try {
    const auditPath = getAuditPath();
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(auditPath, line);
  } catch (err) {
    process.stderr.write('admin-brain-write: audit append failed: ' + String(err && err.message) + '\n');
  }
}

// Neo4j Bolt driver returns Integers as { low: number, high: number }.
// Convert any of (number | { low, high } | other) to plain JS number.
function toNumber(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && typeof value.low === 'number') {
    // For typical row counts, high is 0 and low is the value. We accept the
    // narrowing because Cypher count() never exceeds Number.MAX_SAFE_INTEGER
    // for any sane methodology graph.
    return value.low + (value.high || 0) * 0x100000000;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function extractCount(record, primaryKey, fallbackIndex) {
  // brain-client.query returns the parsed Neo4j JSON content directly:
  //   - Most common: an Array<{ <fieldName>: <value> }> (records array).
  //   - Sometimes wrapped in { records: [...] } (older shape).
  //   - Field values may be plain numbers or Neo4j Integer { low, high }.
  if (record == null) return 0;
  if (record[primaryKey] != null) return toNumber(record[primaryKey]);
  if (record[fallbackIndex] != null) return toNumber(record[fallbackIndex]);
  // Last-resort: scan values for a numeric or Neo4j Integer.
  const vals = Object.values(record);
  for (const v of vals) {
    const n = toNumber(v);
    if (typeof v === 'number' || (v && typeof v === 'object' && 'low' in v)) return n;
  }
  return 0;
}

// Normalize brain-client.query output into a plain records array.
// Accepts: Array<record>  |  { records: Array<record> }  |  null
function normalizeRecords(result) {
  if (result == null) return null;
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.records)) return result.records;
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const execute = args.includes('--execute');
  if (!dryRun && !execute) {
    process.stderr.write('Usage: admin-brain-write.cjs --dry-run | --execute\n');
    process.exit(2);
  }

  if (!brainClient.isAvailable()) {
    process.stderr.write('admin-brain-write: MINDRIAN_BRAIN_KEY not set; Brain unreachable\n');
    appendAudit({ outcome: 'aborted', reason: 'brain_unavailable', edge: EDGE_TYPE });
    process.exit(1);
  }

  // Stage 1: pre-write read. Confirm both target nodes exist.
  process.stdout.write('Stage 1 (pre-check): ' + PRE_WRITE_CYPHER + '\n');
  const pre = await brainClient.query(PRE_WRITE_CYPHER);
  const preRecords = normalizeRecords(pre);
  if (!preRecords || preRecords.length === 0) {
    process.stderr.write('admin-brain-write: pre-check returned no records (Brain or query error)\n');
    appendAudit({ outcome: 'aborted', reason: 'pre_check_no_records', edge: EDGE_TYPE });
    process.exit(2);
  }
  const rec = preRecords[0];
  const pCount = extractCount(rec, 'p_count', 0);
  const tCount = extractCount(rec, 't_count', 1);
  process.stdout.write('  source ' + SOURCE_NODE.id + ' count=' + pCount + '\n');
  process.stdout.write('  target ' + TARGET_NODE.id + ' count=' + tCount + '\n');
  if (pCount < 1 || tCount < 1) {
    process.stderr.write('admin-brain-write: one or both target nodes missing; aborting\n');
    appendAudit({
      outcome: 'aborted', reason: 'target_node_missing',
      source_count: pCount, target_count: tCount, edge: EDGE_TYPE,
    });
    process.exit(2);
  }

  // Stage 2: dry-run vs execute.
  if (dryRun) {
    process.stdout.write('Stage 2 (dry-run): would execute MERGE\n');
    process.stdout.write('  Cypher: ' + MERGE_CYPHER + '\n');
    process.stdout.write('  Rollback (not executed): ' + ROLLBACK_CYPHER + '\n');
    appendAudit({ outcome: 'dry_run', edge: EDGE_TYPE, cypher: MERGE_CYPHER });
    process.exit(0);
  }

  process.stdout.write('Stage 2 (execute): ' + MERGE_CYPHER + '\n');
  const merge = await brainClient.write(MERGE_CYPHER);
  const mergeRecords = normalizeRecords(merge);
  if (!mergeRecords || mergeRecords.length === 0) {
    process.stderr.write('admin-brain-write: MERGE returned no records (write may have failed)\n');
    appendAudit({ outcome: 'failed', reason: 'merge_no_records', edge: EDGE_TYPE });
    process.exit(1);
  }
  const mrec = mergeRecords[0];
  const edgesAfter = extractCount(mrec, 'edges_after', 0);
  process.stdout.write('  edges_after=' + edgesAfter + '\n');
  appendAudit({
    outcome: 'success',
    edge: EDGE_TYPE,
    source: SOURCE_NODE.id,
    target: TARGET_NODE.id,
    edges_after: edgesAfter,
    cypher: MERGE_CYPHER,
    rollback_cypher: ROLLBACK_CYPHER,
  });
  process.exit(0);
}

main().catch(function (err) {
  process.stderr.write('admin-brain-write: unexpected: ' + String(err && err.message) + '\n');
  appendAudit({ outcome: 'failed', reason: 'unexpected_throw', err: String(err && err.message) });
  process.exit(1);
});
