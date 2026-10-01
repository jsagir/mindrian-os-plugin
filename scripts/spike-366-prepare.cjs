#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 plan 01 (D-05, research correction): the spike substrate preparer.
 *
 * The three Phase 355 fixture rooms (tests/fixtures/355-rooms) ship as bare
 * folders, so a recall over them reads substrate_unavailable. This script
 * COPIES each room into a fresh fs.mkdtempSync directory under an --out root
 * that must sit under os.tmpdir(), builds room.db in each copy through the
 * indexer's own rebuild entry (lib/core/graph-ops.cjs rebuildGraph, no raw
 * SQL), mints the memory_artifact anchors entity-extract reads through
 * (lib/core/memory/reconcile-memory-runner.cjs, the session-start reconcile),
 * runs scripts/entity-extract.cjs on the copy as an OFFLINE child
 * process, and writes <tmp>/manifest.json (schema mos.spike-366-substrate/1).
 *
 * Never run in place: the source tree is READ only (copy and hash). Nothing is
 * ever written under tests/fixtures/.
 *
 * OFFLINE CHILD (Pitfall 10, T-366-03). entity-extract has no --offline flag
 * yet (Phase 368 owns that guard), so the child is a node -e wrapper that,
 * before entity-extract loads: closes the tier-2b key gate (resolveAnthropicKey
 * returns null, so the Haiku escalation never runs), flips transformers.js
 * allowRemoteModels to false (cache-only model loads), and replaces fetch,
 * http(s).request/get and net.connect with counting throwers. It reports the
 * blocked attempt count; the manifest records it per room. The child env drops
 * every vendor key. Tiers that ran are read from the child's status.json.
 *
 * Usage:
 *   node scripts/spike-366-prepare.cjs prepare --out <dir under os.tmpdir()>
 * Exit codes: 0 ok, 1 a room failed to prepare, 2 refused (bad argv or path).
 *
 * CJS, node built-ins only, switch-case argv, no free text on argv. Prints only
 * paths and counts. Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
// read side only: copied from, hashed, never written
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', '355-rooms');
const ROOMS = Object.freeze(['room-control', 'room-extend', 'room-ill-defined']);
const SCHEMA = 'mos.spike-366-substrate/1';
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

const VENDOR_ENV_KEYS = Object.freeze([
  'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'TYPESAFE_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY',
  'TAVILY_API_KEY', 'PINECONE_API_KEY', 'HF_TOKEN', 'HUGGING_FACE_HUB_TOKEN',
]);

// ---------------------------------------------------------------------------
// guardSpikePath(candidate, allowedRoots): realpath + path.sep-bounded prefix
// containment (sibling of measure-355-hit-rate guardRoomPath, which is bound to
// the fixture root alone). A candidate that does not exist yet is resolved
// through the realpath of its nearest existing ancestor, so a symlinked parent
// cannot escape. Throws on anything outside every allowed root. Returns the
// resolved path on success.
// ---------------------------------------------------------------------------
function realOrAncestor(p) {
  const resolved = path.resolve(p);
  let cur = resolved;
  const tail = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(cur), ...tail.reverse());
    } catch (_e) {
      const parent = path.dirname(cur);
      if (parent === cur) return resolved;
      tail.push(path.basename(cur));
      cur = parent;
    }
  }
}

function guardSpikePath(candidate, allowedRoots) {
  if (typeof candidate !== 'string' || !candidate) throw new Error('guardSpikePath: refused -- empty path');
  if (candidate.split(/[\\/]+/).indexOf('..') !== -1) {
    throw new Error('guardSpikePath: refused -- ' + candidate + ' carries a .. segment');
  }
  const real = realOrAncestor(candidate);
  const roots = Array.isArray(allowedRoots) ? allowedRoots : [];
  for (let i = 0; i < roots.length; i += 1) {
    const root = realOrAncestor(roots[i]);
    if (real === root || real.indexOf(root + path.sep) === 0) return real;
  }
  throw new Error('guardSpikePath: refused -- ' + candidate + ' does not resolve inside an allowed root');
}

// ---------------------------------------------------------------------------
// fixture_sha256 of a source room: sha256 over the sorted relative paths and
// bytes of every file (label-355-gold hashes its items file the same way, one
// sha256 over the content; a room is a tree, so its files are folded in a
// stable order). Read-only.
// ---------------------------------------------------------------------------
function listFiles(dir, rel, out) {
  const entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  entries.forEach(function (e) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) listFiles(dir, r, out);
    else if (e.isFile()) out.push(r);
  });
  return out;
}

function treeSha256(dir) {
  const h = crypto.createHash('sha256');
  listFiles(dir, '', []).forEach(function (r) {
    h.update(r + '\u0000');
    h.update(fs.readFileSync(path.join(dir, r)));
    h.update('\u0000');
  });
  return h.digest('hex');
}

// ---------------------------------------------------------------------------
// offline entity-extract child
// ---------------------------------------------------------------------------
const CHILD_CODE = [
  "'use strict';",
  "const path = require('node:path');",
  'const repo = process.argv[1]; const room = process.argv[2];',
  'let blocked = 0;',
  "function deny() { blocked += 1; throw new Error('offline: spike-366-prepare blocks network in entity-extract'); }",
  'globalThis.fetch = deny;',
  "for (const m of ['http', 'https']) { const mod = require(m); mod.request = deny; mod.get = deny; }",
  "const net = require('net'); net.connect = deny; net.createConnection = deny;",
  "try { const r = require(path.join(repo, 'lib/core/eureka-deps-resolver.cjs')); const t = r.requireEurekaDep('@huggingface/transformers'); if (t && t.env) t.env.allowRemoteModels = false; } catch (_e) { /* dep absent */ }",
  "const mva = require(path.join(repo, 'lib/core/mva-classifier.cjs'));",
  'mva.resolveAnthropicKey = function () { return null; };',
  "const ee = require(path.join(repo, 'scripts/entity-extract.cjs'));",
  "Promise.resolve(ee.main([room, 'run'])).then(function (code) {",
  "  process.stdout.write('\\nSPIKE366_OFFLINE ' + JSON.stringify({ blocked_network_attempts: blocked }) + '\\n');",
  '  process.exit(code);',
  "}, function (e) { process.stderr.write(String(e && e.message || e) + '\\n'); process.exit(1); });",
].join('\n');

function childEnv() {
  const env = Object.assign({}, process.env);
  VENDOR_ENV_KEYS.forEach(function (k) { delete env[k]; });
  delete env.NODE_OPTIONS;
  return env;
}

function runOfflineExtract(roomCopy) {
  const r = spawnSync(process.execPath, ['-e', CHILD_CODE, REPO_ROOT, roomCopy], {
    cwd: roomCopy,
    env: childEnv(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = String(r.stdout || '');
  let blocked = null;
  const m = stdout.match(/SPIKE366_OFFLINE (\{.*\})/);
  if (m) { try { blocked = JSON.parse(m[1]).blocked_network_attempts; } catch (_e) { blocked = null; } }
  let status = null;
  try { status = JSON.parse(fs.readFileSync(path.join(roomCopy, '.mindrian', 'entity-extract', 'status.json'), 'utf8')); } catch (_e) { status = null; }
  return { exit: r.status, signal: r.signal || null, timed_out: !!(r.error && r.error.code === 'ETIMEDOUT'), blocked_network_attempts: blocked, status: status };
}

function tiersFrom(status) {
  const s = status || {};
  const tiers = [];
  if (s.state === 'done') tiers.push('tier1_rules');
  if ((s.tier2_embedding || 0) > 0 || (s.tier2_low_confidence || 0) > 0) tiers.push('tier2a_local_embedding');
  if ((s.tier2_model || 0) > 0) tiers.push('tier2b_model');
  const embeddingRan = tiers.indexOf('tier2a_local_embedding') !== -1;
  return {
    tiers_ran: tiers,
    local_model: s.state === 'done' ? (embeddingRan ? 'present' : 'absent_or_unused') : 'unknown',
    classifier_source: s.classifier_source || null,
  };
}

// ---------------------------------------------------------------------------
// graph counts (read-only, through the room-db door)
// ---------------------------------------------------------------------------
function graphCounts(roomCopy) {
  const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
  const db = roomDb.openRoomDb(roomCopy);
  try {
    const nodes = db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n;
    const byType = {};
    db.prepare('SELECT type, COUNT(*) AS n FROM edges GROUP BY type ORDER BY type').all().forEach(function (r) { byType[r.type] = r.n; });
    return { node_count: nodes, edge_counts: byType, describes_edges: byType.DESCRIBES || 0 };
  } finally {
    roomDb.closeRoomDb(db);
  }
}

function reconcileAnchors(roomCopy) {
  const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
  const runner = require(path.join(REPO_ROOT, 'lib/core/memory/reconcile-memory-runner.cjs'));
  const db = roomDb.openRoomDb(roomCopy);
  try {
    return runner.reconcileMemoryArtifacts(roomCopy, { db: db }) || { upserted: 0, edges: 0 };
  } finally {
    roomDb.closeRoomDb(db);
  }
}

// ---------------------------------------------------------------------------
// prepare
// ---------------------------------------------------------------------------
async function prepare(opts) {
  const o = opts || {};
  const tmpRoot = os.tmpdir();
  const outReal = guardSpikePath(o.out, [tmpRoot]);
  fs.mkdirSync(outReal, { recursive: true });
  const work = fs.mkdtempSync(path.join(outReal, 'spike-366-'));
  guardSpikePath(work, [tmpRoot]);

  const graphOps = require(path.join(REPO_ROOT, 'lib/core/graph-ops.cjs'));
  const rooms = [];
  let ok = true;
  for (const name of ROOMS) {
    const src = guardSpikePath(path.join(FIXTURE_ROOT, name), [FIXTURE_ROOT]);
    const dest = path.join(work, name);
    guardSpikePath(dest, [work]);
    const sha = treeSha256(src);
    fs.cpSync(src, dest, { recursive: true, filter: function (p) { return path.basename(p) !== '.mindrian'; } });

    const entry = { name: name, fixture_sha256: sha, room_dir: dest };
    try {
      const rb = await graphOps.rebuildGraph(dest);
      entry.rebuild = { success: !!(rb && rb.success), artifacts: rb && rb.artifacts, sections: rb && rb.sections };
    } catch (e) {
      entry.rebuild = { success: false, error: String(e && e.message || e).split('\n')[0] };
    }
    // memory_artifact anchors: entity-extract collects artifact prose through
    // memory_artifact nodes (exact files, then a section's ROOM anchor), which
    // the indexer rebuild does not mint. The same idempotent reconcile the
    // session-start slot runs mints them (writers through navigation.cjs).
    try {
      const rec = reconcileAnchors(dest);
      entry.memory_reconcile = { ok: true, upserted: rec.upserted, edges: rec.edges };
    } catch (e) {
      entry.memory_reconcile = { ok: false, error: String(e && e.message || e).split('\n')[0] };
    }
    const ex = runOfflineExtract(dest);
    const t = tiersFrom(ex.status);
    entry.entity_extract = {
      exit: ex.exit,
      timed_out: ex.timed_out,
      state: ex.status ? ex.status.state : null,
      artifacts: ex.status ? ex.status.artifacts : null,
      entities: ex.status ? ex.status.entities : null,
      entities_what: ex.status ? ex.status.entities_what : null,
      terms_why: ex.status ? ex.status.terms_why : null,
      tier2_escalated: ex.status ? ex.status.tier2_escalated : null,
      tier2_low_confidence: ex.status ? ex.status.tier2_low_confidence : null,
      tier2_model: ex.status ? ex.status.tier2_model : null,
      tiers_ran: t.tiers_ran,
      local_model: t.local_model,
      classifier_source: t.classifier_source,
      blocked_network_attempts: ex.blocked_network_attempts,
    };
    try { Object.assign(entry, graphCounts(dest)); } catch (e) { entry.counts_error = String(e && e.message || e).split('\n')[0]; }
    if (!entry.rebuild.success || !entry.memory_reconcile.ok || ex.exit !== 0 || entry.entity_extract.state !== 'done' || entry.counts_error) ok = false;
    rooms.push(entry);
  }

  const manifest = { schema: SCHEMA, prepared_at: new Date().toISOString(), out_dir: work, source: 'tests/fixtures/355-rooms', rooms: rooms };
  const manifestPath = path.join(work, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  return { ok: ok, manifest_path: manifestPath, out_dir: work, manifest: manifest };
}

// ---------------------------------------------------------------------------
// CLI: switch-case argv, no free text
// ---------------------------------------------------------------------------
const USAGE = 'usage: node scripts/spike-366-prepare.cjs prepare --out <dir under os.tmpdir()>';

function refuse(what) {
  process.stderr.write('spike-366-prepare: refused -- ' + what + '\n' + USAGE + '\n');
  return 2;
}

function parseArgv(argv) {
  const out = { sub: null, out: null, error: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case 'prepare':
        if (out.sub) { out.error = 'subcommand given twice'; return out; }
        out.sub = 'prepare'; break;
      case '--out':
        if (out.out !== null) { out.error = '--out given twice'; return out; }
        out.out = argv[i + 1];
        i += 1;
        if (typeof out.out !== 'string' || !out.out || out.out.indexOf('--') === 0) { out.error = '--out needs a directory'; return out; }
        break;
      default:
        out.error = 'unexpected argument (no free text on argv)';
        return out;
    }
  }
  return out;
}

async function cliMain(argv) {
  const a = parseArgv(argv);
  if (a.error) return refuse(a.error);
  if (a.sub !== 'prepare') return refuse('missing subcommand');
  if (!a.out) return refuse('--out is required');
  try {
    guardSpikePath(a.out, [os.tmpdir()]);
  } catch (_e) {
    return refuse('--out must resolve under os.tmpdir() with no .. segment');
  }
  let res;
  try {
    res = await prepare({ out: a.out });
  } catch (e) {
    process.stderr.write('spike-366-prepare: failed -- ' + String(e && e.message || e).split('\n')[0] + '\n');
    return 1;
  }
  process.stdout.write(JSON.stringify({ ok: res.ok, manifest: res.manifest_path }) + '\n');
  return res.ok ? 0 : 1;
}

if (require.main === module) {
  cliMain(process.argv.slice(2)).then(function (code) { process.exitCode = code; }, function (e) {
    process.stderr.write('spike-366-prepare: failed -- ' + String(e && e.message || e).split('\n')[0] + '\n');
    process.exitCode = 1;
  });
}

module.exports = { prepare, guardSpikePath, treeSha256, cliMain, ROOMS, SCHEMA };
