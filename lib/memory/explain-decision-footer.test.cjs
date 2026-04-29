#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 94-09 -- /mos:explain-decision Action Footer fixture tests
 * =================================================================
 * Per QA handoff Section 3 FIX-8: scripts/explain-decision-command.cjs
 * renderTrace() output ends with `---` and no Next: action footer. The
 * 4-zone Action Footer rule in skills/ui-system/SKILL.md (Section 1
 * Zone 4: "NEVER omitted") is violated for /mos:explain-decision.
 *
 * Plan 94-09 appends an Action Footer at the END of the rendered output,
 * AFTER the existing closing `---` separator. The footer offers 3
 * canonical /mos:* commands (status / act / suggest-next) per the QA
 * handoff Section 3 FIX-8 verbatim suggestion.
 *
 * Canon Part 7 (Reuse Before Build): extends scripts/explain-decision-
 * command.cjs renderTrace() output by appending a footer. The 9 trace
 * fields covered by lib/memory/explain-decision-command.test.cjs Tests
 * 1-12 are byte-identical before the footer; the new footer is purely
 * additive at the tail.
 *
 * Canon Part 3 (Tri-Context Decision Gate): the footer offers verbs
 * from the canonical 10-verb vocabulary (status -> Synthesize, act ->
 * Run Methodology, suggest-next -> Free-Text / Spawn Sub-Agent). No
 * new verbs introduced.
 *
 * Test map:
 *   T1 footer presence: last 5 lines of stdout contain literal 'Next:'
 *   T2 footer content: footer contains at least 2 /mos: command refs
 *   T3 non-regression: existing renderTrace prefix output (header +
 *      9 trace fields + closing `---`) remains intact when the footer
 *      is appended. Verified by checking that all existing markers
 *      (Tier Mode, BRAIN.md signal, Five-Signal Triangulation, Chosen
 *      rationale, the closing `---`) are still present and in order.
 *   T4 graceful empty path: when the trace is empty (no decisions
 *      recorded yet), the footer STILL renders. Stdout still contains
 *      'Next:' substring.
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '94-09-' + label + '-'));
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
    at: '2026-04-29T12:00:0' + (turn % 10) + '.000Z',
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
// Tests T1-T4 (Plan 94-09 Action Footer)
// =========================================================

run('T1 footer presence: last 5 lines of stdout contain literal Next:', () => {
  const fix = makeRoomsFixture('t1');
  writeTraceFile(fix.roomDir, 'sid-t1', [makeTrace(1)]);
  const res = runCommand(fix.roomDir, [], { CLAUDE_SESSION_ID: 'sid-t1' });
  assert.equal(res.status, 0, 'exit 0; stderr: ' + (res.stderr || ''));
  const out = res.stdout || '';
  // Trim trailing whitespace then split into lines.
  const lines = out.replace(/\s+$/, '').split('\n');
  const last5 = lines.slice(-5).join('\n');
  assert.equal(
    last5.indexOf('Next:') !== -1,
    true,
    'expected "Next:" in last 5 lines; got last 5 lines:\n' + last5 + '\n\nFull output:\n' + out
  );
});

run('T2 footer content: at least 2 /mos: command refs in footer', () => {
  const fix = makeRoomsFixture('t2');
  writeTraceFile(fix.roomDir, 'sid-t2', [makeTrace(1)]);
  const res = runCommand(fix.roomDir, [], { CLAUDE_SESSION_ID: 'sid-t2' });
  assert.equal(res.status, 0, 'exit 0; stderr: ' + (res.stderr || ''));
  const out = res.stdout || '';
  // Locate the Next: marker and count /mos: occurrences AFTER it. The
  // pre-94-09 output may already contain /mos: in advisory paths or
  // in the chosen_rationale body. We isolate the footer by anchoring
  // on the literal 'Next:' substring.
  const idx = out.indexOf('Next:');
  assert.equal(
    idx !== -1,
    true,
    'expected "Next:" anchor; got:\n' + out
  );
  const footer = out.slice(idx);
  const matches = footer.match(/\/mos:/g) || [];
  assert.equal(
    matches.length >= 2,
    true,
    'expected at least 2 /mos: commands in footer; found '
      + matches.length + ' in:\n' + footer
  );
});

run('T3 non-regression: existing renderTrace markers preserved before footer', () => {
  const fix = makeRoomsFixture('t3');
  writeTraceFile(fix.roomDir, 'sid-t3', [makeTrace(1)]);
  const res = runCommand(fix.roomDir, [], { CLAUDE_SESSION_ID: 'sid-t3' });
  assert.equal(res.status, 0, 'exit 0; stderr: ' + (res.stderr || ''));
  const out = res.stdout || '';
  // The 9 trace-field markers from lib/memory/explain-decision-command.test.cjs
  // Tests 1-4 must all still appear in the output.
  const requiredMarkers = [
    'Navigation Engine Decision Trace', // header
    'Turn 1',                            // structural turn
    'Tier Mode',                         // brain_md_tier_mode label
    'mode_a',                            // tier_mode value
    'BRAIN.md signal',                   // section header
    'version:',
    'staleness:',
    'stale_reason:',
    'weight_applied:',
    'sections_consumed:',
    'RECOMMENDED marker',
    'rendered:',
    'highest_confidence:',
    'Five-Signal Triangulation',
    'ICM scope',
    'SQL signals',
    'Feynman-MINTO',
    'BRAIN patterns',
    'Intent + Persona',
    'Chosen rationale',                  // chosen_rationale section
    'pattern_matches',                   // brain_md_sections_consumed value
    'market-analysis',                   // icm_scope.section value
    'Customers will pay',                // minto_reasoning.governing_thought
    'Researcher',                        // intent_persona.larry_persona
    'Mode A: BRAIN.md fresh',            // chosen_rationale verbatim prefix
  ];
  for (const m of requiredMarkers) {
    assert.equal(
      out.indexOf(m) !== -1,
      true,
      'pre-94-09 marker missing after footer append: "' + m + '"'
        + '\nFull output:\n' + out
    );
  }
  // The closing `---` separator MUST appear BEFORE the Next: footer.
  // Pre-94-09 output ended with `---\n`. Plan 94-09 appends the footer
  // AFTER that `---`, so the order is: ...content... `---` ... `Next:`.
  const sepIdx = out.lastIndexOf('\n---');
  const nextIdx = out.indexOf('Next:');
  assert.equal(
    sepIdx !== -1,
    true,
    'closing `---` separator missing; got:\n' + out
  );
  assert.equal(
    nextIdx !== -1,
    true,
    '"Next:" footer missing; got:\n' + out
  );
  assert.equal(
    sepIdx < nextIdx,
    true,
    'closing `---` must precede the Next: footer; sepIdx=' + sepIdx
      + ' nextIdx=' + nextIdx + '\nFull output:\n' + out
  );
});

run('T4 graceful empty path: footer renders when no decisions yet', () => {
  // Empty traces array. Pre-94-09 the script prints the
  // "No decisions recorded for this session." advisory and exits 0
  // with no footer. Plan 94-09 appends the footer to the empty path
  // too, so the user always gets a navigable next step.
  const fix = makeRoomsFixture('t4');
  writeTraceFile(fix.roomDir, 'empty-sid', []);
  const res = runCommand(fix.roomDir, [], { CLAUDE_SESSION_ID: 'empty-sid' });
  assert.equal(res.status, 0, 'exit 0; stderr: ' + (res.stderr || ''));
  const out = res.stdout || '';
  // Empty-path advisory still rendered.
  assert.equal(
    out.indexOf('No decisions recorded') !== -1,
    true,
    'empty-path advisory missing; got:\n' + out
  );
  // Footer rendered too.
  assert.equal(
    out.indexOf('Next:') !== -1,
    true,
    'expected "Next:" footer on empty-path output; got:\n' + out
  );
  // At least 2 /mos: command refs after the Next: anchor.
  const idx = out.indexOf('Next:');
  const footer = out.slice(idx);
  const matches = footer.match(/\/mos:/g) || [];
  assert.equal(
    matches.length >= 2,
    true,
    'expected at least 2 /mos: commands in empty-path footer; found '
      + matches.length + ' in:\n' + footer
  );
});

// ---------- Reporter ----------

process.stdout.write('\n');
process.stdout.write('explain-decision-footer: ' + passed + '/' + (passed + failed) + ' passed\n');
if (failed > 0) {
  process.exit(1);
}
process.exit(0);
