#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 226-02 -- the D7 honest-cause degrade test (REQ-6) + the REQ-8 leg 3
 * proof that the reasoning branch never fires speculatively.
 *
 * THE FAILURE THIS FORBIDS (the "David" proving case, 2026-07-14)
 *   /mos:eureka returned pairs_scored:0 and rendered "not enough entries", which
 *   is true of the SYMPTOM but false of the CAUSE (the encoder was never fetched).
 *   A degrade path that misdescribes WHY it degraded sends the navigator to add
 *   content when the real blocker is infrastructural. Honest calibration includes
 *   an honest reason.
 *
 * Three legs:
 *   Leg 1 (encoder_unavailable): the encoder is forced unavailable; the cause is
 *     named, pairs.json is seeded, and the render never says "not enough entries".
 *   Leg 2 (below_floor): the encoder RAN (offline stub) but the room scored zero
 *     pairs; the cause is 'below_floor' and the render names it.
 *   Leg 3 (no false trigger, REQ-8): a healthy multi-entry offline run ends with
 *     degrade_cause null/absent and NO reasoning workdir seeded.
 *
 * Runs under NODE_OPTIONS=--require tests/eureka-offline-preload.cjs (zero network).
 * Standalone: node tests/test-226-degrade-cause.cjs. node:assert strict, node
 * built-ins + in-repo requires only. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const runner = require(path.join(REPO_ROOT, 'scripts', 'eureka-portfolio-report.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const POOL_A = ['photon', 'lattice', 'entropy', 'plasma', 'quantum', 'resonance'];
const POOL_B = ['enzyme', 'protein', 'membrane', 'genome', 'mitosis', 'receptor'];

function bodyFor(idx, pool) {
  const a = pool[idx % pool.length];
  const b = pool[(idx + 2) % pool.length];
  return 'The ' + a + ' governs the ' + b + ' behavior under load, exploring how ' + a
    + ' and ' + b + ' couple across the boundary of this domain in several sentences.';
}

// makeRoom(n): a hermetic room.db with n nodes (first ceil(n/2) physics, rest
// biology) + matching markdown entries on disk. Returns the room dir.
function makeRoom(n) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-226-dc-'));
  const db = openRoomDb(dir, { allowExtension: true });
  const now = new Date().toISOString();
  const ins = db.prepare(
    'INSERT INTO nodes(id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)'
  );
  const half = Math.ceil(n / 2);
  for (let i = 1; i <= n; i += 1) {
    const id = 'C' + String(i).padStart(5, '0');
    const inA = i <= half;
    const section = inA ? 'physics' : 'biology';
    const body = bodyFor(i, inA ? POOL_A : POOL_B);
    ins.run(id, 'Claim', JSON.stringify({ text: body, section: section, parentId: inA ? 'DOM_A' : 'DOM_B' }),
      'fixture://' + id, 'import', now, now);
    const secDir = path.join(dir, section);
    fs.mkdirSync(secDir, { recursive: true });
    fs.writeFileSync(path.join(secDir, id + '.md'), '# ' + section + ' tech ' + i + '\n\n' + body + '\n', 'utf8');
  }
  closeRoomDb(db);
  return dir;
}

// makeGraph(graphPath, nodeCount, edges): a minimal idea-graph over C-number ids.
function makeGraph(graphPath, nodeCount, edges) {
  const nodes = [];
  const half = Math.ceil(nodeCount / 2);
  for (let i = 1; i <= nodeCount; i += 1) {
    const id = 'C' + String(i).padStart(5, '0');
    const inA = i <= half;
    nodes.push({
      data: {
        id: id, cnumber: id, title: (inA ? 'physics tech ' : 'biology tech ') + i,
        primary_tier: 1, pair_count: 5 + i, degree: 10 + i,
        section: inA ? 'physics' : 'biology',
        primary_problem: (inA ? 'energy gap ' : 'signaling gap ') + i,
        problems: [(inA ? 'energy gap ' : 'signaling gap ') + i],
      },
    });
  }
  const edgeEls = edges.map(function (e) {
    return { data: { type: 'CONVERGES', source: e[0], target: e[1], shared_problems: ['bridge'] } };
  });
  fs.writeFileSync(graphPath,
    JSON.stringify({ meta: { honest_nouns: '226 degrade fixture' }, elements: { nodes: nodes, edges: edgeEls } }),
    'utf8');
}

async function leg1EncoderUnavailable() {
  const dir = makeRoom(4);
  const graphPath = path.join(dir, 'g.json');
  makeGraph(graphPath, 4, [['C00001', 'C00003']]);
  const workdir = path.join(dir, 'wd');
  const outPath = path.join(dir, 'r.md');
  const jsonPath = path.join(dir, 'r.json');
  // No --offline: the _forceUnavailable seam short-circuits getEncoder before any
  // model load (the offline encodeFn seam would otherwise win). Zero network.
  const code = await runner.main([
    '--db', dir, '--graph', graphPath, '--pairs', 'graph',
    '--out', outPath, '--json', jsonPath, '--reasoning-workdir', workdir,
    '--force-encoder-unavailable',
  ]);
  assert.strictEqual(code, 0, 'leg1 main() exits 0');
  const prov = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).provenance;
  assert.strictEqual(prov.degrade_cause, 'encoder_unavailable', "leg1 degrade_cause is 'encoder_unavailable'");
  assert.ok(fs.existsSync(path.join(workdir, 'pairs.json')), 'leg1 seeded pairs.json in the reasoning workdir');
  const md = fs.readFileSync(outPath, 'utf8');
  assert.ok(/encoder_unavailable/.test(md), 'leg1 render names the encoder_unavailable cause');
  assert.ok(md.toLowerCase().indexOf('not enough entries') === -1,
    'leg1 render does NOT say "not enough entries" (the David misdiagnosis)');
  assert.ok(/INFRASTRUCTURAL/.test(md), 'leg1 render calls the blocker infrastructural, not a content gap');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

async function leg2BelowFloor() {
  // A single-node room: the encoder RUNS (offline stub -> idx.embedded true) but no
  // pair can be scored, so scored.length === 0 -> 'below_floor'.
  const dir = makeRoom(1);
  const graphPath = path.join(dir, 'g.json');
  // The graph cites a pair whose second endpoint is NOT in the room, so nothing scores.
  makeGraph(graphPath, 2, [['C00001', 'C00002']]);
  const workdir = path.join(dir, 'wd');
  const outPath = path.join(dir, 'r.md');
  const jsonPath = path.join(dir, 'r.json');
  const code = await runner.main([
    '--db', dir, '--graph', graphPath, '--pairs', 'graph', '--offline',
    '--out', outPath, '--json', jsonPath, '--reasoning-workdir', workdir,
  ]);
  assert.strictEqual(code, 0, 'leg2 main() exits 0');
  const prov = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).provenance;
  assert.strictEqual(prov.encoder_unavailable, false, 'leg2 the encoder genuinely ran (encoder_unavailable false)');
  assert.strictEqual(prov.pairs_scored, 0, 'leg2 scored zero pairs');
  assert.strictEqual(prov.degrade_cause, 'below_floor', "leg2 degrade_cause is 'below_floor'");
  const md = fs.readFileSync(outPath, 'utf8');
  assert.ok(/below_floor/.test(md), 'leg2 render names the below_floor cause');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

async function leg3NoFalseTrigger() {
  // A healthy multi-entry room with cited pairs both present: scored > 0, the
  // reasoning branch must NOT fire (REQ-8 / SEED req 2: never speculative).
  const dir = makeRoom(6);
  const graphPath = path.join(dir, 'g.json');
  makeGraph(graphPath, 6, [['C00001', 'C00004'], ['C00002', 'C00005']]);
  const workdir = path.join(dir, 'wd');
  const outPath = path.join(dir, 'r.md');
  const jsonPath = path.join(dir, 'r.json');
  const code = await runner.main([
    '--db', dir, '--graph', graphPath, '--pairs', 'graph', '--offline',
    '--out', outPath, '--json', jsonPath, '--reasoning-workdir', workdir,
  ]);
  assert.strictEqual(code, 0, 'leg3 main() exits 0');
  const prov = JSON.parse(fs.readFileSync(jsonPath, 'utf8')).provenance;
  assert.ok(prov.pairs_scored > 0, 'leg3 the healthy run scored at least one pair (got ' + prov.pairs_scored + ')');
  assert.ok(prov.degrade_cause === null || typeof prov.degrade_cause === 'undefined',
    'leg3 degrade_cause is null/absent on a healthy run (got ' + JSON.stringify(prov.degrade_cause) + ')');
  assert.ok(!fs.existsSync(workdir),
    'leg3 NO reasoning workdir was seeded (the branch never fired speculatively)');
  assert.strictEqual(prov.run_mode.indexOf('reasoning'), -1,
    'leg3 run_mode is an embedded label, never reasoning');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

async function main() {
  await leg1EncoderUnavailable();
  await leg2BelowFloor();
  await leg3NoFalseTrigger();
  process.stdout.write('test-226-degrade-cause: PASS (3 legs: encoder_unavailable named, below_floor named, no speculative trigger)\n');
}

main().then(function () { process.exit(0); }, function (err) {
  process.stderr.write('test-226-degrade-cause: FAIL\n' + String(err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
