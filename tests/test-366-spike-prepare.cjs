#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 plan 01: scripts/spike-366-prepare.cjs builds the spike substrate.
 * prepare --out <tmp> copies the three 355 fixture rooms into a fresh mkdtemp
 * dir, builds room.db in each copy, runs entity extraction offline, writes a
 * manifest; the source tree is byte-identical before and after; --out outside
 * os.tmpdir() or carrying .. refuses with exit 2; free text on argv refuses
 * with exit 2; zero network attempts.
 * Exit 77 (ENV GAP) when node:sqlite is missing, or when every check passed
 * but entity-extract reports the local embedding model absent. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

// The local embedding model cache is read-only model weights, not room state:
// point the child at the machine cache (resolved BEFORE HOME is isolated) so
// tier-2a can run; when it is absent the leg is an ENV GAP, not a failure.
const REAL_HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
if (!process.env.MINDRIAN_MODEL_CACHE) {
  const cache = path.join(REAL_HOME, '.mindrian', 'model-cache');
  if (fs.existsSync(cache)) process.env.MINDRIAN_MODEL_CACHE = cache;
}
// the side directory the eureka deps (transformers.js) resolve from, same reason
if (!process.env.MINDRIAN_EUREKA_DEPS_ROOT) {
  const deps = path.join(REAL_HOME, '.mindrian', 'eureka-deps');
  if (fs.existsSync(deps)) process.env.MINDRIAN_EUREKA_DEPS_ROOT = deps;
}

// Isolate from the machine's real rooms BEFORE any repo module loads.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-sp-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-sp-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: function () { return 0; }, restore: function () {} };
const C = hygiene.makeChecker('test-366-spike-prepare');

const SCRIPT = path.join(REPO_ROOT, 'scripts/spike-366-prepare.cjs');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests/fixtures/355-rooms');
const spike = require(SCRIPT);

function hashTree(dir) {
  const h = crypto.createHash('sha256');
  (function walk(rel) {
    fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }).forEach(function (e) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { h.update('D ' + r + '\n'); walk(r); } else { h.update('F ' + r + '\n'); h.update(fs.readFileSync(path.join(dir, r))); }
    });
  })('');
  return h.digest('hex');
}

function cli(args) {
  return spawnSync(process.execPath, [SCRIPT].concat(args), { cwd: REPO_ROOT, encoding: 'utf8', env: process.env, timeout: 600000 });
}

(async function main() {
  const before = hashTree(FIXTURE_ROOT);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-sp-out-'));
  let modelAbsent = false;
  try {
    // refusals (exit 2)
    C.check('--out /etc refuses with exit 2', cli(['prepare', '--out', '/etc']).status === 2);
    C.check('--out with .. refuses with exit 2', cli(['prepare', '--out', path.join(os.tmpdir(), '..', 'etc')]).status === 2);
    C.check('free text on argv refuses with exit 2', cli(['prepare', '--out', out, 'find me something']).status === 2);
    C.check('missing subcommand refuses with exit 2', cli(['--out', out]).status === 2);
    C.check('--out under the fixture tree refuses with exit 2', cli(['prepare', '--out', path.join(FIXTURE_ROOT, 'x')]).status === 2);

    // guardSpikePath
    let threw = false;
    try { spike.guardSpikePath(path.join(FIXTURE_ROOT + '-evil', 'x'), [FIXTURE_ROOT]); } catch (_e) { threw = true; }
    C.check('guardSpikePath refuses a sibling-prefix path', threw);
    C.check('guardSpikePath accepts a path inside the root', typeof spike.guardSpikePath(path.join(out, 'a'), [os.tmpdir()]) === 'string');

    // prepare (in-process, under the net guard)
    const res = await spike.prepare({ out: out });
    const m = JSON.parse(fs.readFileSync(res.manifest_path, 'utf8'));
    C.check('prepare ok', res.ok === true, JSON.stringify(m.rooms.map(function (r) { return [r.name, r.rebuild, r.entity_extract && r.entity_extract.state]; })));
    C.check('work dir is a fresh spike-366- dir under --out', path.dirname(res.out_dir) === fs.realpathSync(out) && /^spike-366-/.test(path.basename(res.out_dir)));
    C.check('manifest schema', m.schema === 'mos.spike-366-substrate/1' && typeof m.prepared_at === 'string');
    C.check('three rooms in the manifest', m.rooms.map(function (r) { return r.name; }).join(',') === 'room-control,room-extend,room-ill-defined');
    m.rooms.forEach(function (r) {
      C.check(r.name + ': room.db built in the copy', fs.existsSync(path.join(res.out_dir, r.name, '.mindrian', 'room.db')));
      C.check(r.name + ': fixture_sha256 of the source', /^[0-9a-f]{64}$/.test(r.fixture_sha256) && r.fixture_sha256 === spike.treeSha256(path.join(FIXTURE_ROOT, r.name)));
      C.check(r.name + ': node count and edge counts by type', r.node_count > 0 && r.edge_counts && typeof r.edge_counts === 'object' && r.edge_counts.BELONGS_TO > 0, JSON.stringify(r.edge_counts));
      C.check(r.name + ': DESCRIBES edge count recorded', typeof r.describes_edges === 'number');
      C.check(r.name + ': entity tiers recorded', Array.isArray(r.entity_extract.tiers_ran) && r.entity_extract.tiers_ran.indexOf('tier1_rules') !== -1, JSON.stringify(r.entity_extract));
      C.check(r.name + ': no model escalation (offline)', r.entity_extract.tiers_ran.indexOf('tier2b_model') === -1 && r.entity_extract.tier2_model === 0);
      C.check(r.name + ': offline child made zero network attempts', r.entity_extract.blocked_network_attempts === 0, String(r.entity_extract.blocked_network_attempts));
      if (r.entity_extract.local_model !== 'present') modelAbsent = true;
    });

    // CLI happy path prints the manifest path as JSON
    const run = cli(['prepare', '--out', out]);
    let printed = null;
    try { printed = JSON.parse(String(run.stdout).trim().split('\n').pop()); } catch (_e) { printed = null; }
    C.check('CLI prepare exits 0 and prints the manifest path', run.status === 0 && printed && fs.existsSync(printed.manifest), String(run.stderr).slice(0, 300));

    C.check('source tree byte-identical before and after', hashTree(FIXTURE_ROOT) === before);
    C.check('nothing written under tests/fixtures/355-rooms', !fs.existsSync(path.join(FIXTURE_ROOT, 'room-control', '.mindrian')));
  } catch (e) {
    C.check('test threw', false, String(e && e.stack ? e.stack : e).slice(0, 600));
  }
  const attempts = typeof net.attempts === 'function' ? net.attempts() : 0;
  C.check('zero network attempts', attempts === 0, String(attempts));
  net.restore();
  try { fs.rmSync(out, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  const code = C.summary();
  if (code === 0 && modelAbsent) {
    process.stdout.write('ENV GAP: entity-extract reports the local embedding model absent (tier-2a did not run); substrate recorded, not a failure\n');
    process.exit(77);
  }
  process.exit(code);
})().catch(function (err) {
  process.stderr.write('test-366-spike-prepare THREW: ' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
