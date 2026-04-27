#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 05 -- /mos:rs-thesis CLI wrapper.
 *
 * Tier-aware thesis lookup by discovery_id. Tier 1 path runs an Aura
 * Cypher MATCH on (rs:RSDiscovery {id: $discovery_id}) via the existing
 * brain-client.cjs Aura session chokepoint. Tier 0 path falls back to
 * SQLite SELECT against room.db via lazygraph-ops.cjs queryGraph.
 *
 * Usage:
 *   node scripts/rs-thesis-command.cjs <discovery_id>
 *   node scripts/rs-thesis-command.cjs <discovery_id> --json
 *   node scripts/rs-thesis-command.cjs <discovery_id> --tier tier0
 *
 * Exit codes:
 *   0  success
 *   1  invocation error (missing id, no thesis found, ExternalEgressViolation)
 *   2  prerequisite missing
 *
 * Canon Part 8: discovery_id is parameterized in BOTH backends. NO string
 * concatenation. Audited via auditQueryString BEFORE binding. Brain query
 * is NOT issued; this is a LOCAL-only lookup.
 */

const path = require('path');

let lazygraphOps = null;
let brainClient = null;
let egressPrompts = null;

function _lazyLoad() {
  if (!lazygraphOps) lazygraphOps = require(path.join(__dirname, '..', 'lib', 'core', 'lazygraph-ops.cjs'));
  if (!brainClient) brainClient = require(path.join(__dirname, '..', 'lib', 'core', 'brain-client.cjs'));
  if (!egressPrompts) egressPrompts = require(path.join(__dirname, '..', 'lib', 'core', 'rs-egress-prompts.cjs'));
}

function parseArgs(argv) {
  const args = { discoveryId: null, json: false, tier: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--json') { args.json = true; continue; }
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a === '--tier' && i + 1 < rest.length) { args.tier = rest[i + 1]; i += 1; continue; }
    if (!args.discoveryId) { args.discoveryId = a; continue; }
  }
  return args;
}

function printError(what, why, fix) {
  process.stderr.write('x ' + what + '\n');
  process.stderr.write('  Why: ' + why + '\n');
  process.stderr.write('  Fix: ' + fix + '\n');
}

function printHelp() {
  process.stdout.write([
    '',
    'Usage: node scripts/rs-thesis-command.cjs <discovery_id> [options]',
    '',
    'Read the thesis text for a prior RSDiscovery by discovery_id.',
    'Tier dispatch: Aura first (Tier 1) on AuraUnreachableError fallback to SQLite (Tier 0).',
    '',
    'Options:',
    '  --json          structured JSON output for Desktop MCP',
    '  --tier <tier>   force tier0 or tier1 explicitly (skips detection)',
    '',
  ].join('\n'));
}

function renderTranscript(thesis, meta, tier, fallbackReason) {
  process.stdout.write('\n');
  const fallbackTag = fallbackReason ? (' (fallback: ' + fallbackReason + ')') : '';
  process.stdout.write('-- rs-thesis -- ' + (meta.id || meta.discovery_id || '<id>') + ' -- Tier: ' + tier + fallbackTag + ' --\n\n');
  process.stdout.write('  Thesis:\n');
  process.stdout.write('    ' + (thesis || '(no thesis recorded)') + '\n\n');
  process.stdout.write('  Field                 Value\n');
  process.stdout.write('  ' + '-'.repeat(60) + '\n');
  process.stdout.write('  rs_type               ' + (meta.rs_type || 'n/a') + '\n');
  process.stdout.write('  breakthrough_score    ' + (meta.breakthrough_score == null ? 'n/a' : String(meta.breakthrough_score)) + '\n');
  process.stdout.write('  room_slug             ' + (meta.room_slug || 'n/a') + '\n');
  process.stdout.write('  created_at            ' + (meta.created_at || 'n/a') + '\n');
  if (fallbackReason) {
    process.stdout.write('\n  ! DEGRADED_NOTE: read from local SQLite mirror (' + fallbackReason + ')\n');
  }
  process.stdout.write('\n  -> Bank Opportunity         (Canon Part 3 verb)\n');
  process.stdout.write('  -> Devil\'s Advocate         /mos:challenge-assumptions\n');
  process.stdout.write('  -> Synthesize               /mos:reflect\n\n');
}

function detectTier(opts) {
  if (opts && (opts.tier === 'tier0' || opts.tier === 'tier1')) return opts.tier;
  if (opts && opts.driver && typeof opts.driver.session === 'function') return 'tier1';
  if (opts && typeof opts.aura_url === 'string' && opts.aura_url.length > 0) return 'tier1';
  if (typeof process.env.NEO4J_URI === 'string' && process.env.NEO4J_URI.length > 0) return 'tier1';
  if (brainClient && typeof brainClient.isAvailable === 'function' && brainClient.isAvailable()) return 'tier1';
  return 'tier0';
}

async function readThesisTier0(discoveryId, roomDir) {
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const conn = await lazygraphOps.openGraph(roomDir);
  try {
    const sql = 'SELECT id, thesis, rs_type, breakthrough_score, room_slug, created_at FROM rs_discoveries WHERE id = ? LIMIT 1';
    const rows = await lazygraphOps.queryGraph(conn, sql, [discoveryId]);
    if (!rows || rows.length === 0) return null;
    const row = rows[0];
    return {
      thesis: row.thesis || null,
      meta: {
        id: row.id,
        rs_type: row.rs_type,
        breakthrough_score: row.breakthrough_score,
        room_slug: row.room_slug,
        created_at: row.created_at,
      },
    };
  } finally {
    if (typeof lazygraphOps.closeGraph === 'function') await lazygraphOps.closeGraph(conn);
    void dbPath; // referenced for future symbolic helpers
  }
}

async function readThesisTier1(discoveryId) {
  const cypher = 'MATCH (rs:RSDiscovery {id: $discovery_id}) RETURN rs.thesis AS thesis, rs.id AS id, rs.rs_type AS rs_type, rs.breakthrough_score AS breakthrough_score, rs.room_slug AS room_slug, rs.created_at AS created_at LIMIT 1';
  // Bind via brainClient.query (existing chokepoint). The Aura local instance
  // exposes the same MCP-style query shape that brainClient already wraps.
  const result = await brainClient.query(cypher, { discovery_id: discoveryId });
  if (!result || !Array.isArray(result.records) || result.records.length === 0) return null;
  const r = result.records[0];
  return {
    thesis: r.thesis || null,
    meta: {
      id: r.id,
      rs_type: r.rs_type,
      breakthrough_score: r.breakthrough_score,
      room_slug: r.room_slug,
      created_at: r.created_at,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.discoveryId) {
    printError('No discovery_id provided', 'rs-thesis requires a discovery_id argument', '/mos:rs-thesis <discovery_id>');
    process.exit(1);
  }

  try {
    _lazyLoad();
  } catch (err) {
    printError('Library module load failed', err && err.message ? err.message : String(err), 'verify lib/core/lazygraph-ops.cjs and lib/core/brain-client.cjs exist');
    process.exit(2);
  }

  // Canon Part 8 input audit on the bound parameter BEFORE either backend touches it.
  try {
    egressPrompts.auditQueryString(args.discoveryId, 'rs-thesis-command-input');
  } catch (err) {
    if (err && err.name === 'ExternalEgressViolation') {
      printError('Canon Part 8 audit failed', 'forbidden bytes in discovery_id (' + (err.meta && err.meta.surface ? err.meta.surface : 'unknown surface') + ')', 'rephrase the discovery_id without user-content placeholders');
      process.exit(1);
    }
    throw err;
  }

  const opts = {
    tier: args.tier,
    room_dir: process.env.MINDRIAN_ROOM || process.cwd(),
  };

  const tier = detectTier(opts);
  let result = null;
  let actualTier = tier;
  let fallbackReason = null;

  if (tier === 'tier1') {
    try {
      result = await readThesisTier1(args.discoveryId);
    } catch (err) {
      if (err && (err.name === 'AuraUnreachableError' || /unreachable|connect|ECONNREFUSED/i.test(err.message || ''))) {
        // Tier 1 -> Tier 0 fallback per 89.3 graceful pattern
        actualTier = 'tier0';
        fallbackReason = 'aura_unreachable';
        result = await readThesisTier0(args.discoveryId, opts.room_dir);
      } else {
        throw err;
      }
    }
  } else {
    result = await readThesisTier0(args.discoveryId, opts.room_dir);
  }

  if (!result) {
    printError('Discovery not found', 'no row matched discovery_id ' + args.discoveryId + ' in either backend', '/mos:rs-fetch <topic>');
    process.exit(1);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({ tier: actualTier, fallback_reason: fallbackReason, thesis: result.thesis, meta: result.meta }, null, 2) + '\n');
    process.exit(0);
  }

  renderTranscript(result.thesis, result.meta, actualTier, fallbackReason);
  process.exit(0);
}

if (require.main === module) {
  main().catch(function (err) {
    process.stderr.write('rs-thesis unhandled: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  });
}

module.exports = { main, parseArgs, detectTier, renderTranscript };
