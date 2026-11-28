'use strict';
/*
 * Phase 400.5 plan 02 (plan 13 Task 1): the one case list, fixture builder and mask set of the UserPromptSubmit
 * parity tests. tests/test-400.4-hook-run-exports.cjs (plan 12) and tests/test-400.4-dispatch-parity.cjs both
 * require this file, so the two tests use one case list.
 *
 * Every fixture is a fresh copy under the OS temp dir. HOME, USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME and the
 * cwd of each child point at the copy. Nothing touches the real home or the real rooms home.
 * Node built-ins only. Hyphens only, no dash characters.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const isoHelpers = require(path.join(ROOT, 'tests', 'helpers', 'isolated-home-36925.cjs'));

// The six UserPromptSubmit scripts in check order, with the argv of their old hooks.json entries.
const SCRIPTS = [
  { id: 'admin-command-gate', file: 'scripts/admin-command-gate.cjs', argv: [] },
  { id: 'intent-classifier', file: 'scripts/intent-classifier.cjs', argv: [] },
  { id: 'first-install-router', file: 'scripts/first-install-router.cjs', argv: [] },
  { id: 'brain-derivation-drain', file: 'scripts/brain-derivation-drain.cjs', argv: [] },
  { id: 'jtbd-update', file: 'scripts/jtbd-update.cjs', argv: ['userprompt'] },
  { id: 'auto-explore-drain', file: 'scripts/auto-explore-drain.cjs', argv: [] },
];

const SESSION_ID = 'sess-400412';

function promptJson(prompt) {
  return function (ctx) {
    return JSON.stringify({ prompt, session_id: SESSION_ID, cwd: ctx.cwd, hook_event_name: 'UserPromptSubmit' });
  };
}

const CASES = [
  { id: 'E1', fixture: 'virgin', input: () => '' },
  { id: 'E2', fixture: 'virgin', input: () => 'not json' },
  { id: 'E3', fixture: 'room', input: promptJson('hello there') },
  { id: 'E4', fixture: 'room', input: promptJson('/mos:admin') },
  { id: 'E5', fixture: 'room', input: promptJson('what should I work on next for this venture') },
  { id: 'E6', fixture: 'virgin', input: promptJson('hello') },
];

// ---------- fixtures ----------

const TMP = fs.realpathSync(os.tmpdir());
const PREFIX = 'mos400412-';
const TEMPLATES = {};
const TO_REMOVE = [];
process.on('exit', () => { for (const d of TO_REMOVE) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } } });

function buildTemplate(kind) {
  if (TEMPLATES[kind]) return TEMPLATES[kind];
  const root = fs.mkdtempSync(path.join(TMP, PREFIX));
  TO_REMOVE.push(root);
  const roomsHome = path.join(root, 'rooms');
  fs.mkdirSync(roomsHome, { recursive: true });
  if (kind === 'room') {
    const saved = Object.assign({}, process.env);
    try {
      isoHelpers.birthFixtureRoom({ iso: { home: root, roomsHome }, slug: 'qa-fixture', ventureText: 'A fixture venture for the 400.4 run export tests' });
    } finally {
      for (const k of Object.keys(process.env)) { if (!(k in saved)) delete process.env[k]; }
      Object.assign(process.env, saved);
    }
  }
  TEMPLATES[kind] = { root, kind };
  return TEMPLATES[kind];
}

function rewritePaths(dir, from, to) {
  // Same-length names, so a byte replace keeps every file valid (a sqlite page included).
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) rewritePaths(p, from, to);
    else if (e.isFile()) {
      const buf = fs.readFileSync(p);
      if (buf.indexOf(from) === -1) continue;
      fs.writeFileSync(p, Buffer.from(buf.toString('latin1').split(from).join(to), 'latin1'));
    }
  }
}

// freshCopy(kind): a new copy of the 'room' or 'virgin' template. Returns the paths and a cleanup function.
function freshCopy(kind) {
  const tpl = buildTemplate(kind);
  const root = fs.mkdtempSync(path.join(TMP, PREFIX));
  TO_REMOVE.push(root);
  fs.cpSync(tpl.root, root, { recursive: true });
  if (root.length !== tpl.root.length) throw new Error('fixture root names differ in length');
  rewritePaths(root, tpl.root, root);
  const roomDir = path.join(root, 'rooms', 'qa-fixture');
  return {
    root,
    home: root,
    roomsHome: path.join(root, 'rooms'),
    roomDir,
    cwd: kind === 'room' ? roomDir : root,
    cleanup() { try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ } },
  };
}

// buildCaseFixture(c): a fresh copy of the fixture that case c names.
function buildCaseFixture(c) { return freshCopy(c && c.fixture ? c.fixture : 'room'); }

function childEnv(fx, extra) {
  const env = {
    PATH: process.env.PATH,
    HOME: fx.home,
    USERPROFILE: fx.home,
    MINDRIAN_HOME: path.join(fx.home, '.mindrian'),
    MINDRIAN_ROOMS_HOME: fx.roomsHome,
    CLAUDE_PLUGIN_ROOT: ROOT,
    USER: 'randomcustomer',
    USERNAME: 'randomcustomer',
    MINDRIAN_ADMIN_IDENTITY_PATH: path.join(fx.root, 'no-such-admin-identity.json'),
    TMPDIR: TMP,
  };
  return Object.assign(env, extra || {});
}

// ---------- masks ----------

const MASKS = [
  'the fixture copy root path -> <ROOT>',
  'node process warning lines (a line that starts with (node:PID), and the --trace-warnings hint) are dropped (the CLI shows them, a sink never does)',
  'ISO timestamps -> <TS>',
  'a number followed by ms -> <N>ms',
];
function maskOutput(text, root) {
  let t = String(text || '');
  if (root) t = t.split(root).join('<ROOT>');
  t = t.split('\n').filter((l) => !/^\(node:\d+\)|--trace-warnings/.test(l)).join('\n');
  t = t.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z?/g, '<TS>');
  t = t.replace(/\b\d+(\.\d+)?ms\b/g, '<N>ms');
  return t;
}
function maskResult(r, root) {
  return { code: r.code, stdout: maskOutput(r.stdout, root), stderr: maskOutput(r.stderr, root) };
}

// ---------- runners ----------

function spawnNode(args, input, fx, extraEnv) {
  const t0 = Date.now();
  const res = spawnSync('node', args, {
    input: input === undefined ? '' : input,
    env: childEnv(fx, extraEnv),
    cwd: fx.cwd,
    encoding: 'utf8',
    timeout: 60000,
  });
  return { code: res.status === null ? -1 : res.status, stdout: res.stdout || '', stderr: res.stderr || '', ms: Date.now() - t0 };
}

// runSeparate(fx, input, env): the six CLIs in check order with the hooks.json argv, each on the same copy.
function runSeparate(fx, input, extraEnv) {
  return SCRIPTS.map((s) => Object.assign({ id: s.id }, spawnNode([path.join(ROOT, s.file)].concat(s.argv), input, fx, extraEnv)));
}

// runDispatcher(fx, input, env): the dispatcher CLI once on the copy.
function runDispatcher(fx, input, extraEnv) {
  return spawnNode([path.join(ROOT, 'scripts', 'userprompt-dispatch.cjs')], input, fx, extraEnv);
}

module.exports = {
  ROOT, TMP, SCRIPTS, SESSION_ID, CASES, MASKS,
  buildTemplate, buildCaseFixture, freshCopy, childEnv, maskOutput, maskResult, runSeparate, runDispatcher,
};
