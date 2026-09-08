#!/usr/bin/env node
'use strict';

/**
 * tests/test-298-voice-log.cjs -- Phase 298 (harness-as-code) Plan 07, Task 3.
 *
 * Proves R-08 (voice log Stop hook). Carries the VALIDATION.md T-298-18 row:
 *   T-298-18 R-08 voice log Stop hook: always {continue: true}; log line only
 *     under MINDRIAN_HOME; never throws
 *
 * SUBJECT: scripts/check-voice-style.cjs
 *
 * Anti-vacuous-pass contract (T-233-04 false-success class): while SUBJECT is
 * absent this test SKIPs and exits 0. The moment SUBJECT lands, this test
 * FAILs (exit 1) until ASSERTIONS_IMPLEMENTED is flipped to true and the
 * PENDING checklist below is actually implemented -- it can never pass
 * vacuously in between.
 *
 * Isolation: process.env.MINDRIAN_HOME is set to an fs.mkdtempSync scratch
 * directory for the whole file and passed through to every spawned process,
 * so the real ~/.mindrian is never touched (verified below by an mtime/byte
 * comparison against the real path, taken before and after the run).
 *
 * Run: node tests/test-298-voice-log.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUBJECT = path.join(REPO_ROOT, 'scripts', 'check-voice-style.cjs');
const TEST_NAME = 'test-298-voice-log.cjs';

const ASSERTIONS_IMPLEMENTED = true;

const PENDING = [
  'evaluatePromotion called twice leaves the log file mtime unchanged -- owned by plan 298-08, which lands evaluatePromotion itself; not implemented here.',
];

let passCount = 0;
let failCount = 0;
function record(name, fn) {
  try {
    fn();
    process.stdout.write('  ok  ' + name + '\n');
    passCount += 1;
  } catch (err) {
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : err) + '\n');
    failCount += 1;
  }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg || 'assertion failed') + ' -- expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function assertTrue(actual, msg) {
  if (actual !== true) {
    throw new Error((msg || 'assertion failed') + ' -- expected true, got ' + JSON.stringify(actual));
  }
}

function main() {
  if (!fs.existsSync(SUBJECT)) {
    process.stdout.write('SKIP ' + TEST_NAME + ' (missing ' + SUBJECT + ')\n');
    process.exit(0);
  }

  if (!ASSERTIONS_IMPLEMENTED) {
    process.stdout.write('FAIL ' + TEST_NAME + ': subject landed but assertions are still a stub\n');
    process.stdout.write('PENDING:\n');
    PENDING.forEach((line) => process.stdout.write('  - ' + line + '\n'));
    process.exit(1);
  }

  // -------------------------------------------------------------------
  // Isolation: MINDRIAN_HOME (the set) plus its pass-through to every
  // spawned process (the second use), so the real ~/.mindrian is never
  // touched by this run.
  // -------------------------------------------------------------------
  const REAL_HOME = process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
  const REAL_LOG = path.join(REAL_HOME, 'voice-style.jsonl');
  const realLogExistedBefore = fs.existsSync(REAL_LOG);
  const realLogSizeBefore = realLogExistedBefore ? fs.statSync(REAL_LOG).size : null;

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), '298-voice-log-'));
  process.env.MINDRIAN_HOME = TMP;
  const FIX_DIR = path.join(TMP, 'fixtures');
  fs.mkdirSync(FIX_DIR, { recursive: true });
  const LOG_PATH = path.join(TMP, 'voice-style.jsonl');

  function writeTranscript(name, lines) {
    const fp = path.join(FIX_DIR, name);
    fs.writeFileSync(fp, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
    return fp;
  }

  function assistantTurn(text) {
    return {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text }],
      },
    };
  }

  function userTurn(text) {
    return { type: 'user', message: { role: 'user', content: text } };
  }

  function readLogLines() {
    if (!fs.existsSync(LOG_PATH)) return [];
    return fs
      .readFileSync(LOG_PATH, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l));
  }

  function runHook(stdinPayload) {
    const res = spawnSync('node', [SUBJECT], {
      input: stdinPayload,
      encoding: 'utf8',
      env: Object.assign({}, process.env, { MINDRIAN_HOME: TMP }),
    });
    let parsed = null;
    try {
      parsed = JSON.parse((res.stdout || '').trim());
    } catch (_e) {
      parsed = null;
    }
    return { res, env: parsed };
  }

  // A real approved De Stijl glyph (blue square, "building"), per
  // lib/hmi/voice-color-mark.cjs's MARK_GLYPHS -- not an invented one.
  const BLUE_SQUARE = '\u{1F7E6}';
  // A NON-De-Stijl colored square (green), per voice-color-mark.cjs's
  // NON_DESTIJL_GLYPHS -- a spoof glyph that detectVoiceMark rejects as
  // {hasMark:false, valid:false}: genuinely no valid voice mark present,
  // distinct from the native-host case (plain text, no glyph at all),
  // which detectVoiceMark treats as valid (the absence IS the signal).
  const GREEN_SQUARE_SPOOF = '\u{1F7E9}';
  // The em dash, written as a JavaScript escape (locked_constraints: this
  // test source itself stays hyphens-only).
  const EM_DASH = '\u2014';

  // -------------------------------------------------------------------
  // Case 1: a turn whose assistant text carries a U+2014 -- one new
  // voice-hyphens-only row, continue:true, exit 0.
  // -------------------------------------------------------------------
  record('a turn with a U+2014 em dash produces one voice-hyphens-only row', () => {
    const before = readLogLines().length;
    const fp = writeTranscript('dash-turn.jsonl', [
      userTurn('tell me about the plan'),
      assistantTurn('\u{1F7E6} building the plan' + EM_DASH + 'here it is, with hyphens too.'),
    ]);
    const { res, env } = runHook(JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: 'sess-dash' }));
    assertEqual(res.status, 0, 'exit code');
    assertTrue(!!env, 'stdout parses to an object');
    assertEqual(env.continue, true, 'continue is true');
    assertTrue(!('hookSpecificOutput' in env), 'no hookSpecificOutput key');
    const after = readLogLines();
    assertEqual(after.length, before + 1, 'exactly one new line');
    const newRow = after[after.length - 1];
    assertEqual(newRow.policy_id, 'voice-hyphens-only', 'policy_id on the new row');
  });

  // -------------------------------------------------------------------
  // Case 2: a clean turn -- opens with a real approved glyph, uses only
  // hyphens -- zero new rows.
  // -------------------------------------------------------------------
  record('a clean glyph-bearing hyphens-only turn produces zero new rows', () => {
    const before = readLogLines().length;
    const fp = writeTranscript('clean-turn.jsonl', [
      userTurn('what is the plan'),
      assistantTurn(BLUE_SQUARE + ' building - a clean, hyphen-only turn with the approved glyph.'),
    ]);
    const { res, env } = runHook(JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: 'sess-clean' }));
    assertEqual(res.status, 0, 'exit code');
    assertTrue(!!env, 'stdout parses to an object');
    assertEqual(env.continue, true, 'continue is true');
    assertTrue(!('hookSpecificOutput' in env), 'no hookSpecificOutput key');
    const after = readLogLines();
    assertEqual(after.length, before, 'zero new lines');
  });

  // -------------------------------------------------------------------
  // Case 3: a turn with no VALID voice mark -- a spoofed non-De-Stijl
  // leading glyph, which detectVoiceMark rejects as {hasMark:false,
  // valid:false} (distinct from plain hyphens-only text with no glyph at
  // all, which detectVoiceMark treats as the valid native-host case) --
  // one new voice-glyph-present row.
  // -------------------------------------------------------------------
  record('a turn with no valid voice mark produces one voice-glyph-present row', () => {
    const before = readLogLines().length;
    const fp = writeTranscript('no-mark-turn.jsonl', [
      userTurn('go ahead'),
      assistantTurn(GREEN_SQUARE_SPOOF + ' here is the plan with only hyphens - no valid glyph at the start.'),
    ]);
    const { res, env } = runHook(JSON.stringify({ hook_event_name: 'Stop', transcript_path: fp, session_id: 'sess-nomark' }));
    assertEqual(res.status, 0, 'exit code');
    assertTrue(!!env, 'stdout parses to an object');
    assertEqual(env.continue, true, 'continue is true');
    assertTrue(!('hookSpecificOutput' in env), 'no hookSpecificOutput key');
    const after = readLogLines();
    assertEqual(after.length, before + 1, 'exactly one new line');
    const newRow = after[after.length - 1];
    assertEqual(newRow.policy_id, 'voice-glyph-present', 'policy_id on the new row');
  });

  // -------------------------------------------------------------------
  // Case 4: a malformed (non-JSON) stdin payload -- still continue:true,
  // exit 0, and stderr never carries a raw stack.
  // -------------------------------------------------------------------
  record('a malformed stdin payload still produces continue:true and exit 0', () => {
    const { res, env } = runHook('this is not json at all {{{');
    assertEqual(res.status, 0, 'exit code');
    assertTrue(!!env, 'stdout parses to an object');
    assertEqual(env.continue, true, 'continue is true');
    assertTrue(!('hookSpecificOutput' in env), 'no hookSpecificOutput key');
    const stderr = res.stderr || '';
    const stderrOk = stderr === '' || stderr.indexOf('[check-voice-style] uncaught:') === 0;
    assertTrue(stderrOk, 'stderr is empty or carries only the uncaught-prefix line, never a raw stack');
  });

  // -------------------------------------------------------------------
  // Case 5: a missing transcript_path -- degrades safely, continue:true,
  // exit 0, no hookSpecificOutput.
  // -------------------------------------------------------------------
  record('a missing transcript_path still produces continue:true and exit 0', () => {
    const { res, env } = runHook(
      JSON.stringify({ hook_event_name: 'Stop', transcript_path: path.join(FIX_DIR, 'does-not-exist.jsonl'), session_id: 'sess-missing' })
    );
    assertEqual(res.status, 0, 'exit code');
    assertTrue(!!env, 'stdout parses to an object');
    assertEqual(env.continue, true, 'continue is true');
    assertTrue(!('hookSpecificOutput' in env), 'no hookSpecificOutput key');
  });

  // -------------------------------------------------------------------
  // Isolation proof: the real ~/.mindrian/voice-style.jsonl (or its
  // absence) is unchanged by this entire run.
  // -------------------------------------------------------------------
  record('the real MINDRIAN_HOME voice-style.jsonl is untouched by this run', () => {
    const existsAfter = fs.existsSync(REAL_LOG);
    assertEqual(existsAfter, realLogExistedBefore, 'presence/absence unchanged');
    if (realLogExistedBefore) {
      assertEqual(fs.statSync(REAL_LOG).size, realLogSizeBefore, 'byte size unchanged');
    }
  });

  try {
    fs.rmSync(TMP, { recursive: true, force: true });
  } catch (_e) {
    /* best-effort cleanup */
  }

  process.stdout.write(TEST_NAME + ': ' + passCount + ' passed, ' + failCount + ' failed\n');
  if (failCount > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
