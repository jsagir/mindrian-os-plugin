#!/usr/bin/env node
'use strict';

/*
 * Quick 261127-bnd rs-explain, finding F1 (Canon Part 8).
 *
 * /mos:rs-explain must answer a room question from the room's own room.db
 * and make 0 network calls. Before this quick the script sent the Cypher
 * text of the translator, with the room slug or the topic words, to the
 * remote methodology server through brain-client (the comment said "Aura
 * local instance"; that was false).
 *
 * executeBundle cannot run alone: _lazyLoad is private and only main()
 * calls it, so a direct call finds brainClient null and makes no call.
 * So each case drives main() in a child process (this file starts itself
 * with --case <id>), with a stub globalThis.fetch that records each call.
 *
 * Isolation: HOME, USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME and
 * MINDRIAN_BRAIN_URL (http://127.0.0.1:9) are set in the child before the
 * first require of plugin code; CLAUDE_ACTIVE_ROOM, CLAUDE_CODE_SESSION_ID
 * and MINDRIAN_ROOM are removed first. No socket is opened.
 *
 * Node built-in modules only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts', 'rs-explain-command.cjs');

const SLUG_Q = 'Show me reverse salients in my solarlocker room';
const TOPIC_Q = 'Who are experts on perovskite cold storage?';
const METHOD_Q = 'What frameworks chain into RS Discovery?';

// ---------------------------------------------------------------- child ---

async function childMain(caseId, spec) {
  const fetchCalls = [];
  globalThis.fetch = async function (url, init) {
    let body = null;
    try { body = init && init.body ? JSON.parse(String(init.body)) : null; } catch (_) { body = null; }
    fetchCalls.push({
      method: body && body.method ? body.method : null,
      tool: body && body.params && body.params.name ? body.params.name : null,
      args: body && body.params && body.params.arguments ? body.params.arguments : null,
    });
    const id = body && body.id != null ? body.id : 1;
    const result = body && body.method === 'initialize'
      ? { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'stub', version: '0' } }
      : { content: [{ type: 'text', text: JSON.stringify({ records: [] }) }] };
    const text = JSON.stringify({ jsonrpc: '2.0', id: id, result: result });
    return {
      ok: true,
      status: 200,
      headers: { get: function (k) { return /content-type/i.test(k) ? 'application/json' : null; } },
      json: async function () { return JSON.parse(text); },
      text: async function () { return text; },
    };
  };

  const room = spec.room;
  // Bind before the first require of plugin code: the room lexicon of the
  // Part 8 guard is read when the guard loads.
  process.env.MINDRIAN_ROOM = room;
  if (spec.bound) process.env.CLAUDE_ACTIVE_ROOM = room;
  // Room fixture: a folder named solarlocker with a ROOM.md and a room.db.
  fs.mkdirSync(room, { recursive: true });
  fs.writeFileSync(path.join(room, 'ROOM.md'), '---\nroom_id: solarlocker\n---\n# solarlocker\n');
  const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
  const opened = await lazygraph.openGraph(room);
  if (spec.seed) {
    opened.conn.prepare('INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)').run(
      'bnd-d1', 'RSDiscovery', JSON.stringify({
        thesis: 'synthetic thesis',
        classification: 'structural_transfer',
        breakthrough_score: 5,
        room_id: 'solarlocker',
        created_at: '2026-01-02T00:00:00Z',
      })
    );
  }
  await lazygraph.closeGraph(opened.db);

  const out = [];
  const realWrite = process.stdout.write.bind(process.stdout);
  const realExit = process.exit;
  let exitCode = null;
  process.stdout.write = function (s) { out.push(String(s)); return true; };
  process.exit = function (code) { exitCode = code == null ? 0 : code; throw new Error('__BND_EXIT__'); };
  process.argv = ['node', SCRIPT, spec.q].concat(spec.json ? ['--json'] : []);
  let unhandled = null;
  try {
    const mod = require(SCRIPT);
    await mod.main();
  } catch (err) {
    if (!(err && err.message === '__BND_EXIT__')) unhandled = err && err.message ? err.message : String(err);
  }
  process.stdout.write = realWrite;
  process.exit = realExit;
  const stdout = out.join('');
  let parsed = null;
  if (spec.json) { try { parsed = JSON.parse(stdout); } catch (_) { parsed = null; } }
  realWrite(JSON.stringify({ caseId, exitCode, unhandled, fetchCalls, stdout, parsed }) + '\n');
}

// --------------------------------------------------------------- parent ---

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bnd-rsx-'));

function runChild(caseId, spec) {
  const caseDir = fs.mkdtempSync(path.join(TMP, 'c-'));
  const home = path.join(caseDir, 'home');
  fs.mkdirSync(path.join(home, '.mindrian'), { recursive: true });
  fs.mkdirSync(path.join(caseDir, 'rooms'), { recursive: true });
  const env = Object.assign({}, process.env);
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.MINDRIAN_ROOM;
  env.HOME = home;
  env.USERPROFILE = home;
  env.MINDRIAN_HOME = path.join(home, '.mindrian');
  env.MINDRIAN_ROOMS_HOME = path.join(caseDir, 'rooms');
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  const full = Object.assign({ room: path.join(caseDir, 'rooms', 'solarlocker') }, spec);
  const r = spawnSync(process.execPath, ['--no-warnings', __filename, '--case', caseId, JSON.stringify(full)], {
    cwd: caseDir, env: env, encoding: 'utf8', timeout: 60000,
  });
  const lines = String(r.stdout || '').trim().split('\n');
  const last = lines[lines.length - 1];
  try { return JSON.parse(last); } catch (_) {
    throw new Error('child gave no JSON line; status=' + r.status + ' stderr=' + String(r.stderr || '').slice(-400));
  }
}

function bodyOf(file) {
  const t = fs.readFileSync(file, 'utf8');
  const m = t.match(/^---\n[\s\S]*?\n---\n/);
  return m ? t.slice(m[0].length) : t;
}

function zeroFetch(res) {
  if (res.unhandled) throw new Error('unhandled: ' + res.unhandled);
  if (res.fetchCalls.length !== 0) {
    throw new Error('expected 0 fetch calls, got ' + res.fetchCalls.length + ': ' + JSON.stringify(res.fetchCalls));
  }
}

const CASES = [
  ['D1', 'no bound room, slug question, 0 fetch calls', function () {
    zeroFetch(runChild('D1', { q: SLUG_Q, json: true, bound: false }));
  }],
  ['D2', 'bound room, slug question, 0 fetch calls', function () {
    zeroFetch(runChild('D2', { q: SLUG_Q, json: true, bound: true }));
  }],
  ['D3', 'bound room, topic question, 0 fetch calls', function () {
    zeroFetch(runChild('D3', { q: TOPIC_Q, json: true, bound: true }));
  }],
  ['D4', 'no bound room, topic question, 0 fetch calls', function () {
    zeroFetch(runChild('D4', { q: TOPIC_Q, json: true, bound: false }));
  }],
  ['D5', 'no bound room, methodology question, 0 fetch calls', function () {
    zeroFetch(runChild('D5', { q: METHOD_Q, json: true, bound: false }));
  }],
  ['L1', 'bound room with a seeded discovery answers from the local SQL leg', function () {
    const res = runChild('L1', { q: SLUG_Q, json: true, bound: true, seed: true });
    if (res.unhandled) throw new Error('unhandled: ' + res.unhandled);
    if (!res.parsed) throw new Error('no JSON on stdout: ' + res.stdout.slice(0, 300));
    const qr = res.parsed.query_results;
    if (qr._sql_error !== undefined) throw new Error('_sql_error: ' + qr._sql_error);
    const theses = (qr.rows || []).map(function (r) { return r.thesis; });
    if (theses.length !== 1 || theses[0] !== 'synthetic thesis') throw new Error('rows: ' + JSON.stringify(theses));
  }],
  ['N1', 'topic question without --json names /mos:rs-experts', function () {
    const res = runChild('N1', { q: TOPIC_Q, json: false, bound: false });
    if (res.unhandled) throw new Error('unhandled: ' + res.unhandled);
    if (res.exitCode !== 0) throw new Error('exit ' + res.exitCode);
    if (res.stdout.indexOf('/mos:rs-experts') === -1) throw new Error('stdout: ' + res.stdout.slice(0, 400));
  }],
  ['S1', 'the script holds no remote Cypher leg', function () {
    const t = fs.readFileSync(SCRIPT, 'utf8');
    const bad = ['brainClient.query(', '_cypher_degraded', '_cypher_error', 'aura_unreachable'].filter(function (s) { return t.indexOf(s) !== -1; });
    if (bad.length) throw new Error('found: ' + bad.join(', '));
  }],
  ['S2', 'a Cypher-only bundle is kind fallback', function () {
    const mod = require(SCRIPT);
    const k = mod.inferKindFromBundle({ cypher: 'x', sql: null, brain_query: null });
    if (k !== 'fallback') throw new Error('kind ' + k);
  }],
  ['S3', 'the body of commands/rs-explain.md does not name Aura', function () {
    const b = bodyOf(path.join(REPO, 'commands', 'rs-explain.md'));
    const lines = b.split('\n').filter(function (l) { return /Aura/.test(l); });
    if (lines.length) throw new Error(lines.length + ' line(s): ' + lines[0].slice(0, 120));
  }],
];

function parentMain() {
  let p = 0;
  let f = 0;
  const failures = [];
  try {
    for (const [id, name, fn] of CASES) {
      try { fn(); p += 1; process.stdout.write('  ok   ' + id + ' ' + name + '\n'); }
      catch (err) { f += 1; failures.push(id + ': ' + (err && err.message ? err.message : String(err))); process.stdout.write('  FAIL ' + id + ' ' + name + '\n'); }
    }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  process.stdout.write('261127-bnd rs-explain: ' + p + ' passed, ' + f + ' failed\n');
  for (const m of failures) process.stdout.write('    ' + m.slice(0, 600) + '\n');
  process.exit(f ? 1 : 0);
}

const ci = process.argv.indexOf('--case');
if (ci !== -1) {
  fs.rmSync(TMP, { recursive: true, force: true });
  childMain(process.argv[ci + 1], JSON.parse(process.argv[ci + 2])).catch(function (err) {
    process.stdout.write(JSON.stringify({ caseId: process.argv[ci + 1], unhandled: 'child: ' + (err && err.stack ? err.stack : String(err)), fetchCalls: [], stdout: '' }) + '\n');
  });
} else {
  parentMain();
}
