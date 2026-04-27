#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-05 -- /mos:explain-decision command fixture tests
 * ===========================================================
 * Exercises scripts/explain-decision-command.cjs and the slash command
 * markdown at commands/explain-decision.md. The command is the user-
 * facing audit surface for the Navigation Engine: it reads
 * .mindrian/decision-traces/<session>.json (written by Plan 91-02) and
 * renders human-readable trace output.
 *
 * Canon Part 3 (Tri-Context Decision Gate, Section 8 trace contract):
 * every decision must be explainable. The command renders all 8 brain_md_*
 * fields plus 5 structural trace fields per turn.
 *
 * Canon Part 4 (Every Choice Is Graph Data): the command READS from the
 * graph-data surface (decision-traces/*.json) that Plan 91-02 writes. It
 * never writes back; it is a pure audit lens.
 *
 * Canon Part 8 (Graph Boundary): zero network surface. Reads only LOCAL
 * .mindrian/decision-traces/. Test 11 source-scans for forbidden Brain /
 * fetch / curl references.
 *
 * Test map:
 *   Tests 1-12: command semantics + rendering + flags + fallback (Task 1).
 *     1.  Happy path: 1 trace renders header + body
 *     2.  All 8 Section 8 fields rendered
 *     3.  All 5 structural trace fields rendered
 *     4.  chosen_rationale rendered verbatim
 *     5.  --last N flag renders N most recent traces with header
 *     6.  --last clamp: --last 999 -> never throws, renders all available
 *     7.  --session SESSIONID flag overrides default resolution
 *     8.  Default session resolution: env -> current-session.json -> mtime
 *     9.  Absent session file: 'No decisions recorded' advisory, exit 0
 *     10. Malformed session file: parse-error advisory, exit 0
 *     11. Zero network surface (source scan)
 *     12. De Stijl glyph vocabulary on tier_mode classifier
 *   Tests 13-14: command markdown lint (Task 2).
 *     13. commands/explain-decision.md frontmatter present
 *     14. description length under 60 chars
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(REPO, 'scripts/explain-decision-command.cjs');
const COMMAND_MD_PATH = path.join(REPO, 'commands/explain-decision.md');

// ---------- Test scaffolding ----------

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n');
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    failed += 1;
  }
}

// ---------- Fixture builders ----------

const TMPDIRS = [];

process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

function makeRoomsFixture(label) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '91-05-' + label + '-'));
  TMPDIRS.push(tmp);
  const root = path.join(tmp, 'MindrianRooms');
  fs.mkdirSync(root, { recursive: true });
  const roomDir = path.join(root, 'fixture-room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '---\nproject: fixture room\n---\n\n# Fixture Room\n'
  );
  const regDir = path.join(root, '.rooms');
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(
    path.join(regDir, 'registry.json'),
    JSON.stringify({
      version: 1,
      active: 'fixture-room',
      rooms: {
        'fixture-room': { path: 'fixture-room' },
      },
    }, null, 2)
  );
  return { tmp: tmp, root: root, roomDir: roomDir };
}

function writeTraceFile(roomDir, sessionId, traces) {
  const dir = path.join(roomDir, '.mindrian', 'decision-traces');
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, sessionId + '.json');
  fs.writeFileSync(
    fp,
    JSON.stringify(
      { version: 1, session_id: sessionId, traces: traces },
      null,
      2
    )
  );
  return fp;
}

function makeTrace(turn, overrides) {
  const base = {
    turn: turn,
    at: '2026-04-27T12:00:0' + (turn % 10) + '.000Z',
    elapsed_ms: 12,
    brain_md_version: 1,
    brain_md_staleness: 'fresh',
    brain_md_stale_reason: null,
    brain_md_weight_applied: 1.0,
    brain_md_recommended_confidence: 0.85,
    brain_md_recommended_marker_rendered: true,
    brain_md_tier_mode: 'mode_a',
    brain_md_sections_consumed: ['pattern_matches', 'wicked_indicators'],
    icm_scope: { section: 'market-analysis', scope_path: 'fixture-room/market-analysis' },
    sql_signals: { edge_counts: 12, contradictions: 1, convergences: 3 },
    minto_reasoning: {
      governing_thought: 'Customers will pay for clarity',
      reasoning_health_score: 0.7,
      is_stale: false,
    },
    intent_persona: {
      larry_persona: 'Researcher',
      brain_persona: 'Implicit',
      detection_confidence: 0.6,
    },
    chosen_rationale: 'Mode A: BRAIN.md fresh; pattern_matches confidence above 0.7 floor.',
  };
  return Object.assign({}, base, overrides || {});
}

function runCommand(roomDir, args, extraEnv) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_ROOMS_HOME: path.dirname(roomDir),
    MINDRIAN_ROOMS_ROOT: path.dirname(roomDir),
  }, extraEnv || {});
  return spawnSync(process.execPath, [SCRIPT_PATH].concat(args || []), {
    env: env,
    encoding: 'utf8',
    timeout: 5000,
  });
}

// =========================================================
// Tests 1-12 (Task 1)
// =========================================================

run('Test 1: happy path -- 1 trace renders header + body', () => {
  const fix = makeRoomsFixture('t01');
  writeTraceFile(fix.roomDir, 'sid-t01', [makeTrace(1)]);
  const res = runCommand(fix.roomDir, [], { CLAUDE_SESSION_ID: 'sid-t01' });
  assert.equal(res.status, 0, 'exit 0; stderr: ' + (res.stderr || ''));
  const out = res.stdout || '';
  assert.equal(
    out.indexOf('Navigation Engine Decision Trace') !== -1,
    true,
    'expected header; got: ' + out.slice(0, 200)
  );
  assert.equal(
    out.indexOf('Turn 1') !== -1,
    true,
    'expected turn marker; got: ' + out.slice(0, 200)
  );
  assert.equal(
    out.indexOf('sid-t01') !== -1,
    true,
    'expected session id in output'
  );
});

run('Test 2: all 8 Section 8 brain_md_* fields rendered', () => {
  const fix = makeRoomsFixture('t02');
  writeTraceFile(fix.roomDir, 'sid-t02', [makeTrace(1)]);
  const res = runCommand(fix.roomDir, [], { CLAUDE_SESSION_ID: 'sid-t02' });
  assert.equal(res.status, 0);
  const out = res.stdout || '';
  // 8 Section 8 fields per plan: brain_md_version, staleness, stale_reason,
  // weight_applied, recommended_confidence, marker_rendered, tier_mode,
  // sections_consumed.
  const required = [
    'version:',          // brain_md_version
    'staleness:',        // brain_md_staleness
    'stale_reason:',     // brain_md_stale_reason
    'weight_applied:',   // brain_md_weight_applied
    'highest_confidence:', // brain_md_recommended_confidence
    'rendered:',         // brain_md_recommended_marker_rendered
    'sections_consumed:', // brain_md_sections_consumed
  ];
  for (const tok of required) {
    assert.equal(out.indexOf(tok) !== -1, true,
      'missing required token "' + tok + '" in output:\n' + out);
  }
  // tier_mode rendered as a header label "Tier Mode"
  assert.equal(out.indexOf('Tier Mode') !== -1, true,
    'missing Tier Mode header; got: ' + out);
  assert.equal(out.indexOf('mode_a') !== -1, true,
    'tier_mode value missing; got: ' + out);
});

run('Test 3: all 5 structural trace fields rendered', () => {
  const fix = makeRoomsFixture('t03');
  writeTraceFile(fix.roomDir, 'sid-t03', [makeTrace(1)]);
  const res = runCommand(fix.roomDir, [], { CLAUDE_SESSION_ID: 'sid-t03' });
  assert.equal(res.status, 0);
  const out = res.stdout || '';
  const tokens = [
    'ICM scope',
    'SQL signals',
    'Feynman-MINTO',
    'BRAIN patterns',
    'Intent + Persona',
  ];
  for (const t of tokens) {
    assert.equal(out.indexOf(t) !== -1, true,
      'missing structural label "' + t + '" in output:\n' + out);
  }
  // Verify ICM scope value rendered.
  assert.equal(out.indexOf('market-analysis') !== -1, true,
    'icm_scope.section value missing');
  // SQL signals scalars.
  assert.equal(out.indexOf('12') !== -1, true, 'edge_counts value missing');
  // governing_thought truncated or full.
  assert.equal(out.indexOf('Customers will pay') !== -1, true,
    'governing_thought missing');
  // BRAIN patterns: section keys list.
  assert.equal(out.indexOf('pattern_matches') !== -1, true,
    'BRAIN sections_consumed missing');
  // Intent persona.
  assert.equal(out.indexOf('Researcher') !== -1, true,
    'larry_persona missing');
});

run('Test 4: chosen_rationale rendered verbatim', () => {
  const fix = makeRoomsFixture('t04');
  const rationale = 'Mode A: BRAIN.md fresh; pattern_matches confidence above 0.7 floor.';
  writeTraceFile(fix.roomDir, 'sid-t04', [makeTrace(1, { chosen_rationale: rationale })]);
  const res = runCommand(fix.roomDir, [], { CLAUDE_SESSION_ID: 'sid-t04' });
  assert.equal(res.status, 0);
  const out = res.stdout || '';
  assert.equal(out.indexOf(rationale) !== -1, true,
    'rationale not rendered verbatim; expected:\n' + rationale + '\ngot:\n' + out);
});

run('Test 5: --last N flag renders N most recent traces with header', () => {
  const fix = makeRoomsFixture('t05');
  const traces = [];
  for (let i = 1; i <= 5; i += 1) traces.push(makeTrace(i, {
    chosen_rationale: 'rationale-for-turn-' + i,
  }));
  writeTraceFile(fix.roomDir, 'sid-t05', traces);
  const res = runCommand(fix.roomDir, ['--last', '3'], { CLAUDE_SESSION_ID: 'sid-t05' });
  assert.equal(res.status, 0, 'exit 0; stderr: ' + (res.stderr || ''));
  const out = res.stdout || '';
  // Header advertises last 3 decisions.
  assert.equal(out.indexOf('Last 3 decisions') !== -1, true,
    'expected "Last 3 decisions" header; got:\n' + out.slice(0, 300));
  // Most-recent 3 turns (3, 4, 5) present; oldest two (1, 2) absent.
  assert.equal(out.indexOf('rationale-for-turn-5') !== -1, true,
    'turn 5 rationale missing');
  assert.equal(out.indexOf('rationale-for-turn-4') !== -1, true,
    'turn 4 rationale missing');
  assert.equal(out.indexOf('rationale-for-turn-3') !== -1, true,
    'turn 3 rationale missing');
  assert.equal(out.indexOf('rationale-for-turn-1') === -1, true,
    'turn 1 rationale should NOT appear in --last 3');
  assert.equal(out.indexOf('rationale-for-turn-2') === -1, true,
    'turn 2 rationale should NOT appear in --last 3');
});

run('Test 6: --last clamp -- 999 never throws; renders all available', () => {
  const fix = makeRoomsFixture('t06');
  const traces = [];
  for (let i = 1; i <= 4; i += 1) traces.push(makeTrace(i, {
    chosen_rationale: 'r-turn-' + i,
  }));
  writeTraceFile(fix.roomDir, 'sid-t06', traces);
  const res = runCommand(fix.roomDir, ['--last', '999'], { CLAUDE_SESSION_ID: 'sid-t06' });
  assert.equal(res.status, 0, 'exit 0; stderr: ' + (res.stderr || ''));
  const out = res.stdout || '';
  // All 4 rationales present (clamped to 4 available).
  for (let i = 1; i <= 4; i += 1) {
    assert.equal(out.indexOf('r-turn-' + i) !== -1, true,
      'turn ' + i + ' rationale missing under --last 999 clamp');
  }
});

run('Test 7: --session SESSIONID flag overrides default resolution', () => {
  const fix = makeRoomsFixture('t07');
  // Two distinct session files; CLAUDE_SESSION_ID points at "default-sid"
  // but --session arg points at "other-sid". Command must read the
  // explicit flag's file.
  writeTraceFile(fix.roomDir, 'default-sid',
    [makeTrace(1, { chosen_rationale: 'default-session-rationale' })]);
  writeTraceFile(fix.roomDir, 'other-sid',
    [makeTrace(1, { chosen_rationale: 'OTHER-session-rationale' })]);
  const res = runCommand(fix.roomDir, ['--session', 'other-sid'], {
    CLAUDE_SESSION_ID: 'default-sid',
  });
  assert.equal(res.status, 0);
  const out = res.stdout || '';
  assert.equal(out.indexOf('OTHER-session-rationale') !== -1, true,
    '--session flag should override env; expected OTHER rationale');
  assert.equal(out.indexOf('default-session-rationale') === -1, true,
    'default session rationale must NOT appear when --session is used');
});

run('Test 8: default session resolution -- env -> current-session.json -> mtime', () => {
  const fix = makeRoomsFixture('t08');
  // Path A: CLAUDE_SESSION_ID env hint takes priority.
  writeTraceFile(fix.roomDir, 'env-sid',
    [makeTrace(1, { chosen_rationale: 'rationale-from-env' })]);
  writeTraceFile(fix.roomDir, 'pointer-sid',
    [makeTrace(1, { chosen_rationale: 'rationale-from-pointer' })]);
  // Write pointer file too -- env should win.
  const pointerPath = path.join(fix.roomDir, '.mindrian', 'current-session.json');
  fs.writeFileSync(pointerPath, JSON.stringify({ session_id: 'pointer-sid' }));
  const resA = runCommand(fix.roomDir, [], { CLAUDE_SESSION_ID: 'env-sid' });
  assert.equal(resA.status, 0);
  assert.equal((resA.stdout || '').indexOf('rationale-from-env') !== -1, true,
    'env hint should take priority; got:\n' + (resA.stdout || ''));

  // Path B: no env -> pointer file resolves session.
  const fix2 = makeRoomsFixture('t08b');
  writeTraceFile(fix2.roomDir, 'pointer-sid-2',
    [makeTrace(1, { chosen_rationale: 'rationale-from-pointer-2' })]);
  fs.writeFileSync(
    path.join(fix2.roomDir, '.mindrian', 'current-session.json'),
    JSON.stringify({ session_id: 'pointer-sid-2' })
  );
  const envB = Object.assign({}, process.env);
  delete envB.CLAUDE_SESSION_ID;
  envB.MINDRIAN_ROOMS_HOME = path.dirname(fix2.roomDir);
  envB.MINDRIAN_ROOMS_ROOT = path.dirname(fix2.roomDir);
  const resB = spawnSync(process.execPath, [SCRIPT_PATH], {
    env: envB, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(resB.status, 0,
    'pointer fallback exit non-zero: ' + (resB.stderr || ''));
  assert.equal((resB.stdout || '').indexOf('rationale-from-pointer-2') !== -1,
    true,
    'pointer file should resolve session when env absent; got:\n' +
    (resB.stdout || ''));

  // Path C: no env, no pointer -> mtime fallback picks newest trace file.
  const fix3 = makeRoomsFixture('t08c');
  // Write older file first.
  const oldFp = writeTraceFile(fix3.roomDir, 'older-sid',
    [makeTrace(1, { chosen_rationale: 'rationale-older' })]);
  // Force older mtime back 60s.
  const olderTime = new Date(Date.now() - 60000);
  fs.utimesSync(oldFp, olderTime, olderTime);
  // Newer file (default mtime = now).
  writeTraceFile(fix3.roomDir, 'newer-sid',
    [makeTrace(1, { chosen_rationale: 'rationale-newer' })]);
  const envC = Object.assign({}, process.env);
  delete envC.CLAUDE_SESSION_ID;
  envC.MINDRIAN_ROOMS_HOME = path.dirname(fix3.roomDir);
  envC.MINDRIAN_ROOMS_ROOT = path.dirname(fix3.roomDir);
  const resC = spawnSync(process.execPath, [SCRIPT_PATH], {
    env: envC, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(resC.status, 0);
  assert.equal((resC.stdout || '').indexOf('rationale-newer') !== -1, true,
    'mtime fallback should pick newest trace file');
});

run('Test 9: absent session file -- advisory message, exit 0', () => {
  const fix = makeRoomsFixture('t09');
  // No trace files written. Run with explicit nonexistent session.
  const res = runCommand(fix.roomDir, ['--session', 'nonexistent-sid'], {});
  assert.equal(res.status, 0,
    'absent file should exit 0 (advisory); got ' + res.status);
  const out = res.stdout || '';
  assert.equal(out.indexOf('No decisions recorded') !== -1, true,
    'expected "No decisions recorded" advisory; got:\n' + out);
});

run('Test 10: malformed session file -- parse-error advisory, exit 0', () => {
  const fix = makeRoomsFixture('t10');
  const dir = path.join(fix.roomDir, '.mindrian', 'decision-traces');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bad-sid.json'), '{ not valid json :::');
  const res = runCommand(fix.roomDir, ['--session', 'bad-sid'], {});
  assert.equal(res.status, 0,
    'malformed file should exit 0 (advisory); got ' + res.status);
  const out = res.stdout || '';
  assert.equal(out.indexOf('could not be parsed') !== -1, true,
    'expected "could not be parsed" advisory; got:\n' + out);
});

run('Test 11: zero network surface (Canon Part 8 source scan)', () => {
  // The script must NEVER reach for the Brain or any HTTP/HTTPS endpoint.
  // Source-scan parity with the gate Plan 91-02 + 91-04 use.
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  // Regex matches: brain-client.{query|search|smartSearch}, fetch(, curl ,
  // https:, http: (other than commented mentions). We strip line comments
  // first to allow citations in JSDoc.
  const stripped = src.replace(/^\s*\*.*$/gm, '').replace(/^\s*\/\/.*$/gm, '');
  const forbidden = /(brain-client\.(query|search|smartSearch))|(\bfetch\s*\()|(\bcurl\s)|(https?:\/\/)/;
  const m = stripped.match(forbidden);
  assert.equal(
    m === null,
    true,
    'forbidden network reference in script:\n' + (m ? m[0] : '')
  );
});

run('Test 12: De Stijl glyph vocabulary on tier_mode classifier', () => {
  // mode_a + weight_applied 1.0 -> "check"
  // mode_a + weight_applied 0.5 (between 0.3 and 0.7) -> "warn"
  // tier_0 -> "low" or "--"
  const fixA = makeRoomsFixture('t12a');
  writeTraceFile(fixA.roomDir, 'sid-a',
    [makeTrace(1, { brain_md_tier_mode: 'mode_a', brain_md_weight_applied: 1.0 })]);
  const resA = runCommand(fixA.roomDir, [], { CLAUDE_SESSION_ID: 'sid-a' });
  assert.equal(resA.status, 0);
  const outA = resA.stdout || '';
  assert.equal(outA.indexOf('check') !== -1, true,
    'mode_a + 1.0 should classify "check"; got:\n' + outA);

  const fixB = makeRoomsFixture('t12b');
  writeTraceFile(fixB.roomDir, 'sid-b',
    [makeTrace(1, { brain_md_tier_mode: 'mode_a', brain_md_weight_applied: 0.5 })]);
  const resB = runCommand(fixB.roomDir, [], { CLAUDE_SESSION_ID: 'sid-b' });
  assert.equal(resB.status, 0);
  const outB = resB.stdout || '';
  assert.equal(outB.indexOf('warn') !== -1, true,
    'mode_a + 0.5 should classify "warn"; got:\n' + outB);

  const fixC = makeRoomsFixture('t12c');
  writeTraceFile(fixC.roomDir, 'sid-c',
    [makeTrace(1, {
      brain_md_tier_mode: 'tier_0',
      brain_md_weight_applied: 0.0,
      brain_md_recommended_marker_rendered: false,
    })]);
  const resC = runCommand(fixC.roomDir, [], { CLAUDE_SESSION_ID: 'sid-c' });
  assert.equal(resC.status, 0);
  const outC = resC.stdout || '';
  assert.equal(outC.indexOf('low') !== -1 || outC.indexOf('--') !== -1, true,
    'tier_0 should classify "low" or "--"; got:\n' + outC);
});

// =========================================================
// Tests 13-14 (Task 2 -- command markdown lint)
// =========================================================

function commandMdShipped() {
  return fs.existsSync(COMMAND_MD_PATH);
}

if (commandMdShipped()) {
  run('Test 13: commands/explain-decision.md frontmatter present', () => {
    const md = fs.readFileSync(COMMAND_MD_PATH, 'utf8');
    // Frontmatter delimiters at top.
    assert.equal(md.slice(0, 4) === '---\n' || md.slice(0, 4) === '---\r', true,
      'must start with --- frontmatter delimiter');
    const fmEnd = md.indexOf('\n---', 4);
    assert.equal(fmEnd > 0, true, 'frontmatter must close with ---');
    const fm = md.slice(4, fmEnd);
    // Required keys.
    assert.equal(/^description:/m.test(fm), true,
      'frontmatter must declare description');
    assert.equal(/^argument-hint:/m.test(fm), true,
      'frontmatter must declare argument-hint');
    assert.equal(/^disable-model-invocation:/m.test(fm), true,
      'frontmatter must declare disable-model-invocation');
    // disable-model-invocation must be true (explicit user-invoked).
    assert.equal(/^disable-model-invocation:\s*true/m.test(fm), true,
      'disable-model-invocation must be true for explicit user audit command');
    // argument-hint includes both flags.
    assert.equal(/--last/.test(fm), true,
      'argument-hint must mention --last');
    assert.equal(/--session/.test(fm), true,
      'argument-hint must mention --session');
  });

  run('Test 14: description length under 60 chars', () => {
    const md = fs.readFileSync(COMMAND_MD_PATH, 'utf8');
    const m = md.match(/^description:\s*(.+)$/m);
    assert.equal(m !== null, true, 'description must be parseable');
    const desc = m[1].trim().replace(/^["']|["']$/g, '');
    assert.equal(desc.length < 60, true,
      'description must be under 60 chars; got ' + desc.length + ' (' + desc + ')');
  });
} else {
  process.stdout.write(
    'skip Tests 13-14 (commands/explain-decision.md not yet shipped; gate clears in Task 2)\n'
  );
}

// =========================================================
// Summary
// =========================================================

process.stdout.write('\n' + passed + '/' + (passed + failed) + ' passed\n');
if (failed > 0) process.exit(1);
process.exit(0);
