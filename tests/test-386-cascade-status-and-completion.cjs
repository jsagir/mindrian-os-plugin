'use strict';
/*
 * Phase 386 plan 15, defect B7 (2 linked defects).
 *
 * Status: scripts/post-write must write the real cascade status into
 * last-cascade.json (skipped, failed or complete).
 * Duplicates: scripts/memory-completion-detector.cjs must count a completion
 * once per cascade record, and never for a skipped or failed record.
 *
 * Canon Part 8: fixture rooms in a temporary folder and a temporary HOME.
 * The test reads status words and counts only. It never prints file content.
 *
 * Arms:
 *   W1 skipped cascade (default layout) writes cascade_status skipped, advisory has no queued or complete
 *   W2 a real cascade (rooms layout) keeps cascade_status complete (pin)
 *   W3 a failed cascade writes cascade_status failed
 *   W4 post-write then detector on a skipped or failed cascade records no completion
 *   W5 the detector run twice on one complete record records 1 completion
 *   W6 a new cascade record with a matching pattern records a new completion (pin)
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const POST_WRITE = path.join(REPO, 'scripts', 'post-write');
const DETECTOR = path.join(REPO, 'scripts', 'memory-completion-detector.cjs');

const TMPS = [];
process.on('exit', () => { for (const d of TMPS) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} } });

let failed = 0;
function check(label, cond, detail) {
  if (cond) { console.log('ok - ' + label); return; }
  failed += 1;
  console.log('FAIL - ' + label + (detail ? ' :: ' + detail : ''));
}

// layout 'work' = no /room/ or /rooms/ in the path (cascade skips).
// layout 'rooms' = a real cascade can run.
function mkRoom(layout) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't386-15-'));
  TMPS.push(tmp);
  const home = path.join(tmp, 'home');
  const roomsHome = path.join(home, 'MindrianRooms');
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.mkdirSync(path.join(roomsHome, '.memory'), { recursive: true });
  const base = layout === 'rooms'
    ? path.join(tmp, 'rooms', 'venture')
    : path.join(tmp, 'work', 'venture');
  const secDir = path.join(base, 'market-analysis', 'x');
  fs.mkdirSync(secDir, { recursive: true });
  fs.mkdirSync(path.join(base, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(base, 'STATE.md'), '# State\n');
  fs.writeFileSync(path.join(base, '.room-root'), '');
  fs.writeFileSync(path.join(base, 'market-analysis', 'ROOM.md'), '# market-analysis\n');
  const file = path.join(secDir, 'a.md');
  fs.writeFileSync(file, '# Note\n\nSynthetic text.\n');
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify({
    version: 1, active: 'venture', rooms: [{ slug: 'venture', path: 'venture', abs_path: base }],
  }));
  fs.writeFileSync(path.join(roomsHome, '.memory', 'jtbd-history.json'), JSON.stringify({ version: 1, rooms: {}, last_updated: null }));
  fs.writeFileSync(path.join(base, '.mindrian', 'jtbd-state.json'), JSON.stringify({
    version: 1,
    current: { jtbd: 'understand-market', confidence: 0.9, entered_at: new Date().toISOString(), evidence: ['t'], expires_at: null },
    history: [],
  }));
  const env = Object.assign({}, process.env, { HOME: home, MINDRIAN_ROOMS_HOME: roomsHome });
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_ROOM_DIR;
  return { tmp, home, roomsHome, base, file, env };
}

function runPostWrite(fx, extraEnv) {
  const env = Object.assign({}, fx.env, extraEnv || {});
  const r = spawnSync('bash', [POST_WRITE], {
    cwd: fx.base,
    env,
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: fx.file }, session_id: 'sess-1' }),
    encoding: 'utf8',
    timeout: 120000,
  });
  let advisory = '';
  try { advisory = JSON.parse(r.stdout).hookSpecificOutput.additionalContext || ''; } catch (_) { advisory = ''; }
  return { status: r.status, advisory };
}

function readCascade(fx) {
  try { return JSON.parse(fs.readFileSync(path.join(fx.base, '.mindrian', 'last-cascade.json'), 'utf8')); }
  catch (_) { return null; }
}

function runDetector(fx) {
  return spawnSync(process.execPath, [DETECTOR], {
    env: Object.assign({}, fx.env, { CLAUDE_ROOM_DIR: fx.base }),
    encoding: 'utf8',
    timeout: 30000,
  });
}

function completions(fx) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(fx.roomsHome, '.memory', 'jtbd-history.json'), 'utf8'));
    return ((m.rooms && m.rooms.venture && m.rooms.venture.completed) || []).length;
  } catch (_) { return -1; }
}

function writeRecord(fx, status, ts) {
  fs.writeFileSync(path.join(fx.base, '.mindrian', 'last-cascade.json'), JSON.stringify({
    timestamp: ts,
    file_path: fx.file,
    section: 'market-analysis',
    cascade_status: status,
    classification: { edges_added: [], state_md_section: null },
  }));
}

// A node stub that always fails, put first on PATH, makes the cascade child fail.
function failingNodeEnv(fx) {
  const bin = path.join(fx.tmp, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  return { PATH: bin + path.delimiter + process.env.PATH };
}

// W1
{
  const fx = mkRoom('work');
  const r = runPostWrite(fx);
  const c = readCascade(fx);
  check('W1 skipped cascade writes cascade_status skipped',
    r.status === 0 && c && c.cascade_status === 'skipped',
    'status=' + r.status + ' cascade_status=' + (c && c.cascade_status));
  check('W1 the advisory for a skipped cascade says neither queued nor complete',
    !/queued|complete/i.test(r.advisory), 'advisory words=' + r.advisory.split(/\s+/).slice(0, 4).join(' '));
}

// W2
{
  const fx = mkRoom('rooms');
  const r = runPostWrite(fx);
  const c = readCascade(fx);
  check('W2 a real cascade keeps cascade_status complete',
    r.status === 0 && c && c.cascade_status === 'complete',
    'status=' + r.status + ' cascade_status=' + (c && c.cascade_status));
}

// W3
{
  const fx = mkRoom('rooms');
  const r = runPostWrite(fx, failingNodeEnv(fx));
  const c = readCascade(fx);
  check('W3 a failed cascade writes cascade_status failed',
    r.status === 0 && c && c.cascade_status === 'failed',
    'status=' + r.status + ' cascade_status=' + (c && c.cascade_status));
}

// W4: end to end, post-write writes the record, the detector reads it.
{
  const fx = mkRoom('work');
  runPostWrite(fx); // skipped cascade
  runDetector(fx);
  check('W4 a skipped cascade records no completion', completions(fx) === 0, 'count=' + completions(fx));

  const fx2 = mkRoom('rooms');
  runPostWrite(fx2, failingNodeEnv(fx2)); // failed cascade
  runDetector(fx2);
  check('W4 a failed cascade records no completion', completions(fx2) === 0, 'count=' + completions(fx2));
}

// W5
{
  const fx = mkRoom('rooms');
  writeRecord(fx, 'complete', '2026-11-06T10:00:00Z');
  runDetector(fx);
  runDetector(fx);
  check('W5 the same complete record is counted once', completions(fx) === 1, 'count=' + completions(fx));
}

// W6
{
  const fx = mkRoom('rooms');
  writeRecord(fx, 'complete', '2026-11-06T10:00:00Z');
  runDetector(fx);
  writeRecord(fx, 'complete', '2026-11-06T10:00:05Z');
  runDetector(fx);
  check('W6 a new cascade record is counted as a new completion', completions(fx) === 2, 'count=' + completions(fx));
}

process.exit(failed ? 1 : 0);
