#!/usr/bin/env node
// Phase 385 plan 08: the operator-update Stop hook entry is unwired (the Stop case is a constant no-op).
// Later plans (385-09, 385-10, 385-11) add their behaviours to this file.
// Usage: node tests/test-385-hook-unwire.cjs           run the behaviours
//        node tests/test-385-hook-unwire.cjs --census  print hook command counts as one JSON line
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_JSON = path.join(ROOT, 'hooks', 'hooks.json');
const SCRIPT = path.join(ROOT, 'scripts', 'operator-update.cjs');

function loadHooks() {
  return JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
}

function commandsOf(doc, event) {
  const out = [];
  for (const group of (doc.hooks && doc.hooks[event]) || []) {
    for (const h of group.hooks || []) {
      if (h && h.type === 'command') out.push({ command: h.command || '', matcher: group.matcher });
    }
  }
  return out;
}

function census() {
  const doc = loadHooks();
  const res = { total: 0 };
  for (const event of Object.keys(doc.hooks || {})) {
    const n = commandsOf(doc, event).length;
    res[event] = n;
    res.total += n;
  }
  for (const tool of ['Write', 'Read', 'Grep', 'Glob', 'Bash', 'SlashCommand', 'AskUserQuestion']) {
    let n = 0;
    for (const group of (doc.hooks && doc.hooks.PostToolUse) || []) {
      const m = group.matcher;
      const hit = m === undefined || m === '' || m === '*' ? true : new RegExp('^(?:' + m + ')$').test(tool);
      if (hit) n += (group.hooks || []).filter((h) => h && h.type === 'command').length;
    }
    res['PostToolUse:' + tool] = n;
  }
  return res;
}

if (process.argv.includes('--census')) {
  console.log(JSON.stringify(census()));
  process.exit(0);
}

function listFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p) + ':' + fs.statSync(p).size);
    }
  })(dir);
  return out.sort();
}

function runStop(shape) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p385-08-'));
  try {
    const roomsHome = path.join(tmp, 'rooms');
    const roomDir = path.join(tmp, 'room-r1');
    fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
    fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(roomDir, '.room-root'), '');
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# state\n');
    const reg = shape === 'real'
      ? { version: 1, active: 'r1', rooms: { r1: { abs_path: roomDir } } }
      : { active_room: 'r1', rooms: [{ slug: 'r1', abs_path: roomDir }] };
    fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify(reg));
    const home = path.join(tmp, 'home');
    fs.mkdirSync(home);
    const before = listFiles(tmp);
    const r = spawnSync(process.execPath, [SCRIPT], {
      input: JSON.stringify({ hook_event_name: 'Stop' }),
      encoding: 'utf8',
      env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome, HOME: home }),
    });
    const after = listFiles(tmp);
    return { r, before, after };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + ': ' + e.message);
  }
}

for (const shape of ['real', 'legacy']) {
  check('Stop event gives the constant no-op envelope and writes nothing (' + shape + ' registry shape)', () => {
    const { r, before, after } = runStop(shape);
    assert.strictEqual(r.status, 0, 'exit code ' + r.status);
    assert.strictEqual(r.stdout, '{"continue":true,"suppressOutput":true}', 'stdout ' + r.stdout);
    assert.deepStrictEqual(after, before, 'the file list changed');
  });
}

check('no command in the Stop array runs operator-update.cjs', () => {
  const hits = commandsOf(loadHooks(), 'Stop').filter((c) => c.command.includes('operator-update.cjs'));
  assert.strictEqual(hits.length, 0, hits.length + ' Stop command(s) still run operator-update.cjs');
});

check('PostToolUse and UserPromptSubmit each keep exactly one operator-update.cjs command', () => {
  const doc = loadHooks();
  for (const ev of ['PostToolUse', 'UserPromptSubmit']) {
    const n = commandsOf(doc, ev).filter((c) => c.command.includes('operator-update.cjs')).length;
    assert.strictEqual(n, 1, ev + ' has ' + n + ' operator-update.cjs commands');
  }
});

// ---- Plan 385-09: the jtbd-update Stop leg ----
const JTBD_SCRIPT = path.join(ROOT, 'scripts', 'jtbd-update.cjs');

function runJtbdStop(extraEnv, stdinObj) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p385-09-'));
  try {
    const roomsHome = path.join(tmp, 'rooms');
    const room = path.join(tmp, 'room-r1');
    fs.mkdirSync(roomsHome, { recursive: true });
    fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(room, '.room-root'), '');
    fs.writeFileSync(path.join(room, 'STATE.md'),
      '## Decisions\n' +
      '- 2026-04-29 Run Methodology rs-fetch [methodology: /mos:rs-fetch]\n' +
      '- 2026-04-28 Run Methodology rs-fetch [methodology: /mos:rs-fetch]\n');
    fs.writeFileSync(path.join(room, '.mindrian', 'conversation-operator.json'), JSON.stringify({
      schema_version: '1.0.0',
      current: 'METHODOLOGY',
      previous: 'JUST_TALK',
      entered_at: new Date().toISOString(),
      context: { active_room: 'test', active_section: null, methodology_in_flight: null, decision_gate_pending: null },
      history: [],
    }));
    const env = Object.assign({}, process.env, {
      MINDRIAN_ROOMS_HOME: roomsHome,
      CLAUDE_ACTIVE_ROOM: room,
      HOME: path.join(tmp, 'home'),
    });
    delete env.CLAUDE_LAST_RESPONSE;
    delete env.CLAUDE_USER_MESSAGE;
    Object.assign(env, extraEnv || {});
    const before = listFiles(tmp);
    const r = spawnSync(process.execPath, [JTBD_SCRIPT, 'stop'], {
      input: JSON.stringify(stdinObj),
      encoding: 'utf8',
      env,
    });
    const after = listFiles(tmp);
    return { r, before, after };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const LIVE_STOP = {
  hook_event_name: 'Stop',
  session_id: 's1',
  transcript_path: '/nonexistent',
  stop_hook_active: false,
  last_assistant_message: 'Larry: I will run /mos:rs-fetch now.',
};

check('jtbd-update stop with the live Stop payload gives no stdout and writes no file', () => {
  const { r, before, after } = runJtbdStop({}, LIVE_STOP);
  assert.strictEqual(r.status, 0, 'exit code ' + r.status);
  assert.strictEqual(r.stdout, '', 'stdout ' + JSON.stringify(r.stdout));
  assert.deepStrictEqual(after, before, 'the file list changed');
});

check('control: the same room does write state when the reply text reaches the script', () => {
  const { r, before, after } = runJtbdStop(
    { CLAUDE_LAST_RESPONSE: 'Larry: I will run /mos:rs-fetch to find the bottleneck.', CLAUDE_USER_MESSAGE: 'where is the bottleneck' },
    LIVE_STOP);
  assert.strictEqual(r.status, 0, 'exit code ' + r.status);
  assert.notDeepStrictEqual(after, before, 'the control run wrote nothing, so the room did not resolve');
});

check('no command in the Stop array runs jtbd-update.cjs', () => {
  const hits = commandsOf(loadHooks(), 'Stop').filter((c) => c.command.includes('jtbd-update.cjs'));
  assert.strictEqual(hits.length, 0, hits.length + ' Stop command(s) still run jtbd-update.cjs');
});

check('UserPromptSubmit keeps exactly one jtbd-update.cjs userprompt command', () => {
  const n = commandsOf(loadHooks(), 'UserPromptSubmit').filter((c) => c.command.includes('jtbd-update.cjs" userprompt')).length;
  assert.strictEqual(n, 1, 'UserPromptSubmit has ' + n + ' jtbd-update.cjs userprompt commands');
});

process.exit(failed ? 1 : 0);
