#!/usr/bin/env node
'use strict';

/*
 * Quick 261127-bnd admin: finding F10.
 *
 * Reason: the `orchestration` tool answered `{ command: 'admin' }` with the
 * full text of commands/admin.md and the room state. lib/mcp has no
 * identity check, so the admin text must never leave through this server.
 * After the fix the answer is one fixed line on every surface, with no
 * echo of the context and no Suggested Next. The enum and the description
 * stay unchanged (pinned fixtures).
 *
 * Isolation: the temp HOME, USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME
 * and MINDRIAN_BRAIN_URL=http://127.0.0.1:9 are set before the first
 * require of plugin code; the session variables are removed.
 *
 * Node built-in modules only. Synthetic text only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bnd-adm-')));
const HOME = path.join(TMP, 'h');
const MH = path.join(HOME, '.mindrian');
const RH = path.join(TMP, 'rooms');
const ROOM = path.join(TMP, 'room');
for (const d of [MH, RH, path.join(ROOM, 'problem-definition')]) fs.mkdirSync(d, { recursive: true });
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_HOME = MH;
process.env.MINDRIAN_ROOMS_HOME = RH;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_ROOM;

const REPO = path.resolve(__dirname, '..');
const { registerRouterTools } = require('../lib/mcp/tool-router.cjs');

const ADMIN_NOT_AVAILABLE_LINE = 'Not available here: this server does not run the admin command and does not return its text. Nothing ran and nothing changed.';

function orchestration(surface) {
  const captured = new Map();
  const stub = {
    tool: (name, description, schema, handler) => { captured.set(name, handler); },
    registerTool: (name, config, handler) => { captured.set(name, handler); },
  };
  registerRouterTools(stub, ROOM, REPO, { full: '' }, surface);
  const h = captured.get('orchestration');
  if (typeof h !== 'function') throw new Error('orchestration not registered');
  return (args) => h(args, {});
}

function text(res) { return (res && res.content && res.content[0] && res.content[0].text) || ''; }
function assert(c, m) { if (!c) throw new Error(m); }

const CASES = [
  ['A1', 'admin returns the fixed line on the 3 surfaces', async function () {
    for (const s of ['cli', 'desktop', 'cowork']) {
      const t = text(await orchestration(s)({ command: 'admin' }));
      assert(t === ADMIN_NOT_AVAILABLE_LINE, s + ': ' + t.length + ' characters: ' + t.slice(0, 120));
    }
  }],
  ['A2', 'the admin answer holds no text of commands/admin.md', async function () {
    const t = text(await orchestration('cli')({ command: 'admin' }));
    const long = fs.readFileSync(path.join(REPO, 'commands', 'admin.md'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l.length >= 40);
    const hit = long.find((l) => t.includes(l));
    assert(!hit, 'holds a line of commands/admin.md: ' + (hit || '').slice(0, 120));
    for (const s of ['brain-admin.cjs', '### Reference', '### Room State']) assert(!t.includes(s), 'holds ' + s);
  }],
  ['A3', 'admin with a context and a room gives the same line, no echo', async function () {
    const t = text(await orchestration('cli')({ command: 'admin', context: 'list keys', room: 'x' }));
    assert(t === ADMIN_NOT_AVAILABLE_LINE, 'answer: ' + t.slice(0, 160));
  }],
  ['A4', 'onboard still returns its reference', async function () {
    const t = text(await orchestration('cli')({ command: 'onboard' }));
    assert(t.includes('### Reference'), 'answer: ' + t.slice(0, 160));
  }],
];

async function main() {
  let p = 0;
  let f = 0;
  const failures = [];
  try {
    for (const [id, name, fn] of CASES) {
      try { await fn(); p += 1; process.stdout.write('  ok   ' + id + ' ' + name + '\n'); }
      catch (err) { f += 1; failures.push(id + ': ' + (err && err.message ? err.message : String(err))); process.stdout.write('  FAIL ' + id + ' ' + name + '\n'); }
    }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  process.stdout.write('261127-bnd admin: ' + p + ' passed, ' + f + ' failed\n');
  for (const m of failures) process.stdout.write('    ' + m.slice(0, 600) + '\n');
  process.exit(f ? 1 : 0);
}

main();
