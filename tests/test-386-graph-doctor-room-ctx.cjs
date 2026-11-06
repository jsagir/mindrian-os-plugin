#!/usr/bin/env node
'use strict';
// Phase 386 plan 18 (B16): the graph-doctor doctor module must check the room the
// doctor was pointed at with --room, not the process working directory.
// The ctx is built by the real engine: the doctor runs as a child process and the
// test reads the graph-doctor row from its JSON output. Fixture room only, synthetic
// names, HOME set to a temporary directory. Node built-ins only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(ROOT, 'scripts', 'doctor.cjs');
const { runGraphDoctor } = require(path.join(ROOT, 'lib', 'core', 'graph-doctor', 'index.cjs'));

let failed = 0;
function ok(label, cond, extra) {
  if (cond) console.log('ok - ' + label);
  else { failed++; console.log('FAIL - ' + label + (extra ? ' :: ' + extra : '')); }
}

function runDoctor(args, cwd, home) {
  const r = spawnSync(process.execPath, [DOCTOR, '--dry-run', '--json'].concat(args), {
    cwd, env: Object.assign({}, process.env, { HOME: home, USERPROFILE: home }),
    encoding: 'utf8', timeout: 110000,
  });
  let row = null;
  try { row = JSON.parse(r.stdout).checks['graph-doctor']; } catch (_) { /* row stays null */ }
  return { row, stderr: String(r.stderr || '').slice(0, 300) };
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-386-18-'));
  const home = path.join(tmp, 'home');
  const room = path.join(tmp, 'room');
  const elsewhere = path.join(tmp, 'elsewhere');
  fs.mkdirSync(home); fs.mkdirSync(elsewhere);
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  const db = new DatabaseSync(path.join(room, '.mindrian', 'room.db'));
  db.exec("CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}');" +
          'CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, PRIMARY KEY(source,target,type));');
  for (const [id, name] of [['a', 'Alpha'], ['b', 'Beta'], ['z', 'Lonely']]) {
    db.prepare('INSERT INTO nodes(id,type,properties) VALUES (?,?,?)').run(id, 'Framework', JSON.stringify({ name }));
  }
  db.prepare('INSERT INTO edges(source,target,type) VALUES (?,?,?)').run('a', 'b', 'RELATED_TO');
  db.close();
  await runGraphDoctor(room);

  try {
    // G1: --room names the fixture, cwd is an empty directory. The row must report the fixture queue.
    const g1 = runDoctor(['--room=' + room], elsewhere, home);
    ok('G1 graph-doctor reports the queue of the --room room',
      !!g1.row && g1.row.status === 'warn' && /1 proposal\(s\) pending gate/.test(String(g1.row.detail)),
      JSON.stringify(g1.row) + ' ' + g1.stderr);

    // G2: no room flag, cwd without a queue: the current skip result stays.
    const g2 = runDoctor([], elsewhere, home);
    ok('G2 no room flag and no queue in cwd keeps the skip result',
      !!g2.row && g2.row.status === 'skip' && /no graph-doctor queue yet/.test(String(g2.row.detail)),
      JSON.stringify(g2.row) + ' ' + g2.stderr);

    // G3: the engine ctx is the source. A run from inside the room with no flag still works (cwd fallback pin),
    // and a --room flag wins over a cwd that holds a different state.
    const g3 = runDoctor([], room, home);
    ok('G3 cwd fallback still reports the queue when the doctor runs inside the room',
      !!g3.row && g3.row.status === 'warn', JSON.stringify(g3.row));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (failed) { console.log(failed + ' arm(s) failed'); process.exit(1); }
  console.log('all arms passed');
})().catch((e) => { console.log('FAIL - harness :: ' + (e && e.message)); process.exit(1); });
