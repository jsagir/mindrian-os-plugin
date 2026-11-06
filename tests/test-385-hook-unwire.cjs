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

function loadHooks(file) {
  return JSON.parse(fs.readFileSync(file || HOOKS_JSON, 'utf8'));
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

function census(file) {
  const doc = loadHooks(file);
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
  // Optional next argument: a hooks.json file path (default hooks/hooks.json).
  const ci = process.argv.indexOf('--census');
  const fileArg = process.argv[ci + 1];
  console.log(JSON.stringify(census(fileArg && !fileArg.startsWith('--') ? path.resolve(fileArg) : undefined)));
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

// ---- Plan 385-10: query-efficiency telemetry on Grep and Glob only ----
const QE_SCRIPT = path.join(ROOT, 'scripts', 'query-efficiency-telemetry.cjs');

function runQe(stdinObj) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p385-10-'));
  try {
    const home = path.join(tmp, 'home');
    const room = path.join(tmp, 'room');
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(room, { recursive: true });
    fs.writeFileSync(path.join(room, '.room-root'), '');
    fs.writeFileSync(path.join(room, 'a.md'), '# t\nhello world body text here\n');
    const env = Object.assign({}, process.env, { HOME: home, MOS_COMMAND_CONTEXT: '/mos:x' });
    const r = spawnSync(process.execPath, [QE_SCRIPT], {
      cwd: room,
      input: JSON.stringify(stdinObj),
      encoding: 'utf8',
      env,
    });
    const homeFiles = listFiles(home);
    const jsonl = path.join(home, '.mindrian', 'telemetry', 'query-efficiency.jsonl');
    const lines = fs.existsSync(jsonl) ? fs.readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).length : 0;
    return { r, homeFiles, lines };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

check('query-efficiency on a real-shape Read result gives no stdout and writes no file', () => {
  const { r, homeFiles } = runQe({
    hook_event_name: 'PostToolUse',
    tool_name: 'Read',
    tool_input: { file_path: 'a.md' },
    tool_response: { type: 'text', file: { filePath: 'a.md', content: '# t\nhello world body text here', numLines: 2, startLine: 1, totalLines: 2 } },
  });
  assert.strictEqual(r.status, 0, 'exit code ' + r.status);
  assert.strictEqual(r.stdout, '', 'stdout ' + JSON.stringify(r.stdout));
  assert.deepStrictEqual(homeFiles, [], 'files under HOME: ' + homeFiles.join(', '));
});

check('control: query-efficiency on a Grep result still prints the advisory and appends one row', () => {
  const { r, lines } = runQe({
    hook_event_name: 'PostToolUse',
    tool_name: 'Grep',
    tool_input: { pattern: 'x' },
    tool_response: { content: 'a.md:1:# t\nhello world body text here' },
  });
  assert.strictEqual(r.status, 0, 'exit code ' + r.status);
  assert.ok(r.stdout.includes('query efficiency'), 'stdout ' + JSON.stringify(r.stdout));
  assert.strictEqual(lines, 1, 'jsonl rows ' + lines);
});

check('the query-efficiency PostToolUse group has matcher Grep|Glob, timeout 3 and one command', () => {
  const doc = loadHooks();
  const groups = ((doc.hooks && doc.hooks.PostToolUse) || []).filter((g) =>
    (g.hooks || []).some((h) => h && typeof h.command === 'string' && h.command.includes('query-efficiency-telemetry.cjs')));
  assert.strictEqual(groups.length, 1, 'groups ' + groups.length);
  assert.strictEqual(groups[0].matcher, 'Grep|Glob', 'matcher ' + groups[0].matcher);
  assert.strictEqual(groups[0].hooks.length, 1, 'commands ' + groups[0].hooks.length);
  assert.strictEqual(groups[0].hooks[0].timeout, 3, 'timeout ' + groups[0].hooks[0].timeout);
});

// ---- Plan 385-11: the SlashCommand command-invocation telemetry hook ----
const TCI_SCRIPT = path.join(ROOT, 'scripts', 'telemetry-command-invocation.cjs');

function runTci(extraEnv) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p385-11-'));
  try {
    const home = path.join(tmp, 'home');
    fs.mkdirSync(home, { recursive: true });
    const env = Object.assign({}, process.env, { HOME: home });
    for (const k of ['CLAUDE_TOOL_COMMAND', 'CLAUDE_TOOL_OUTCOME', 'CLAUDE_TOOL_DURATION_MS', 'CLAUDE_SESSION_ID']) delete env[k];
    Object.assign(env, extraEnv || {});
    const r = spawnSync(process.execPath, [TCI_SCRIPT], {
      input: JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'SlashCommand',
        tool_input: { command: '/mos:status' },
        tool_response: { success: true },
      }),
      encoding: 'utf8',
      env,
    });
    return { r, homeFiles: listFiles(home) };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

check('telemetry-command-invocation with the live payload and no CLAUDE_TOOL_COMMAND gives no stdout and writes no file', () => {
  const { r, homeFiles } = runTci({});
  assert.strictEqual(r.status, 0, 'exit code ' + r.status);
  assert.strictEqual(r.stdout, '', 'stdout ' + JSON.stringify(r.stdout));
  assert.deepStrictEqual(homeFiles, [], 'files under HOME: ' + homeFiles.join(', '));
});

check('control: telemetry-command-invocation with CLAUDE_TOOL_COMMAND=/mos:scout still writes a telemetry file', () => {
  const { r, homeFiles } = runTci({ CLAUDE_TOOL_COMMAND: '/mos:scout' });
  assert.strictEqual(r.status, 0, 'exit code ' + r.status);
  assert.ok(homeFiles.some((f) => f.startsWith(path.join('.mindrian', 'telemetry'))), 'no file under .mindrian/telemetry: ' + homeFiles.join(', '));
});

check('no PostToolUse command runs telemetry-command-invocation.cjs and no PostToolUse group has the matcher SlashCommand', () => {
  const doc = loadHooks();
  const cmds = commandsOf(doc, 'PostToolUse').filter((c) => c.command.includes('telemetry-command-invocation.cjs'));
  assert.strictEqual(cmds.length, 0, cmds.length + ' PostToolUse command(s) still run telemetry-command-invocation.cjs');
  const groups = ((doc.hooks && doc.hooks.PostToolUse) || []).filter((g) => g.matcher === 'SlashCommand');
  assert.strictEqual(groups.length, 0, groups.length + ' PostToolUse group(s) still have the matcher SlashCommand');
});

// ---- Plan 385-13: the hmi-compliance-poll Stop hook ----
const POLL_SCRIPT = path.join(ROOT, 'scripts', 'hmi-compliance-poll.cjs');

function runPollStop() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p385-13-'));
  try {
    const roomsHome = path.join(tmp, 'rooms');
    const room = path.join(tmp, 'room-r1');
    fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
    fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(room, '.room-root'), '');
    fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'),
      JSON.stringify({ version: 1, active: 'r1', rooms: { r1: { abs_path: room } } }));
    const home = path.join(tmp, 'home');
    fs.mkdirSync(home);
    const r = spawnSync(process.execPath, [POLL_SCRIPT, '--hook'], {
      input: JSON.stringify({ hook_event_name: 'Stop', session_id: 's1', stop_hook_active: false }),
      encoding: 'utf8',
      env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome, HOME: home }),
    });
    const mindrianFiles = fs.readdirSync(path.join(room, '.mindrian')).sort();
    return { r, mindrianFiles };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

check('hmi-compliance-poll --hook with a Stop payload gives the constant envelope and writes only last-hmi-poll.json', () => {
  const { r, mindrianFiles } = runPollStop();
  assert.strictEqual(r.status, 0, 'exit code ' + r.status);
  assert.strictEqual(r.stdout, '{"continue":true,"suppressOutput":true}', 'stdout ' + r.stdout);
  assert.deepStrictEqual(mindrianFiles, ['last-hmi-poll.json'], 'files under .mindrian: ' + mindrianFiles.join(', '));
});

check('no production file reads last-hmi-poll except hmi-compliance-poll.cjs and hmi-status-command.cjs', () => {
  const r = spawnSync('git', ['grep', '-l', '-I', 'last-hmi-poll', '--', 'scripts', 'lib', 'hooks', 'commands', 'skills', 'agents'],
    { cwd: ROOT, encoding: 'utf8' });
  const files = r.stdout.split('\n').filter(Boolean)
    .filter((f) => !/(^|\/)test-[^/]*$/.test(f) && !/\.test\.cjs$/.test(f))
    .sort();
  assert.deepStrictEqual(files, ['scripts/hmi-compliance-poll.cjs', 'scripts/hmi-status-command.cjs'], 'files: ' + files.join(', '));
});

check('no command in the Stop array runs hmi-compliance-poll.cjs and the run-hook.cmd on-stop entry stays', () => {
  const cmds = commandsOf(loadHooks(), 'Stop');
  const hits = cmds.filter((c) => c.command.includes('hmi-compliance-poll.cjs'));
  assert.strictEqual(hits.length, 0, hits.length + ' Stop command(s) still run hmi-compliance-poll.cjs');
  const onStop = cmds.filter((c) => c.command.includes('run-hook.cmd" on-stop'));
  assert.strictEqual(onStop.length, 1, 'run-hook.cmd on-stop entries: ' + onStop.length);
});

// ---- Plan 385-14: the operator-update PostToolUse and UserPromptSubmit hooks ----
function runOperator(stdinObj) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p385-14-'));
  try {
    const roomsHome = path.join(tmp, 'rooms');
    const roomDir = path.join(tmp, 'room-r1');
    fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
    fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(roomDir, '.room-root'), '');
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# state\n');
    fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'),
      JSON.stringify({ version: 1, active: 'r1', rooms: { r1: { abs_path: roomDir } } }));
    const home = path.join(tmp, 'home');
    fs.mkdirSync(home);
    const stdin = JSON.parse(JSON.stringify(stdinObj).split('<room>').join(roomDir));
    const before = listFiles(tmp);
    const r = spawnSync(process.execPath, [SCRIPT], {
      input: JSON.stringify(stdin),
      encoding: 'utf8',
      env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: roomsHome, HOME: home }),
    });
    const after = listFiles(tmp);
    return { r, before, after };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

for (const payload of [
  { hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion', tool_input: { question: 'q' } },
  { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: '<room>/a.md' } },
]) {
  check('operator-update PostToolUse (' + payload.tool_name + ') gives the constant envelope and writes nothing (real registry shape)', () => {
    const { r, before, after } = runOperator(payload);
    assert.strictEqual(r.status, 0, 'exit code ' + r.status);
    assert.strictEqual(r.stdout, '{"continue":true,"suppressOutput":true}', 'stdout ' + r.stdout);
    assert.deepStrictEqual(after, before, 'the file list changed');
  });
}

check('operator-update UserPromptSubmit gives the constant envelope and writes nothing (real registry shape)', () => {
  const { r, before, after } = runOperator({ hook_event_name: 'UserPromptSubmit', prompt: 'let us file a new section about pricing' });
  assert.strictEqual(r.status, 0, 'exit code ' + r.status);
  assert.strictEqual(r.stdout, '{"continue":true,"suppressOutput":true}', 'stdout ' + r.stdout);
  assert.deepStrictEqual(after, before, 'the file list changed');
});

check('module contract: operator-update.cjs exports contributeOperator and contributeJtbd, and sessionstart-coordinator.cjs loads it', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p385-14m-'));
  try {
    const r = spawnSync(process.execPath, ['-e',
      "const m=require(process.argv[1]);process.stdout.write(typeof m.contributeOperator+','+typeof m.contributeJtbd)", SCRIPT], {
      encoding: 'utf8',
      env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: path.join(tmp, 'rooms'), HOME: path.join(tmp, 'home') }),
    });
    assert.strictEqual(r.stdout, 'function,function', 'exports ' + r.stdout + ' ' + r.stderr);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const coord = fs.readFileSync(path.join(ROOT, 'scripts', 'sessionstart-coordinator.cjs'), 'utf8');
  const n = coord.split('operator-update.cjs').length - 1;
  assert.ok(n >= 2, 'sessionstart-coordinator.cjs names operator-update.cjs ' + n + ' time(s)');
});

check('no command in any hooks.json event runs operator-update.cjs', () => {
  const doc = loadHooks();
  const hits = [];
  for (const ev of Object.keys(doc.hooks || {})) {
    for (const c of commandsOf(doc, ev)) if (c.command.includes('operator-update.cjs')) hits.push(ev);
  }
  assert.strictEqual(hits.length, 0, 'still run operator-update.cjs: ' + hits.join(', '));
});

process.exit(failed ? 1 : 0);
