'use strict';
/*
 * Phase 118-00 Plan 00 -- mva-detect.cjs smoke test (Task 2 verification).
 *
 * Spawns `node scripts/mva-detect.cjs` as a child with stdin JSON payload
 * and asserts:
 *   - exit code 0
 *   - completes in < 1500ms (the hook budget)
 *   - state file ~/.mindrian/mva/<session-id>.json written for venture prompt
 *   - state file contains hebrew_refusal:true for Hebrew prompt
 *   - state file UNWRITTEN for non-venture prompt
 *   - telemetry jsonl gains one event per run
 *
 * Tests use a tmpdir HOME so the real ~/.mindrian is never touched.
 *
 * Pure CJS, node built-ins only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOK = path.resolve(__dirname, '..', '..', 'scripts', 'mva-detect.cjs');

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n' + (err && err.stack ? err.stack : String(err)) + '\n');
    failed += 1;
  }
}

function withTmpHome(fn) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mva-smoke-'));
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    return fn(tmpHome);
  } finally {
    process.env.HOME = prevHome;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) {}
  }
}

function spawnHook(stdinStr, env) {
  const t0 = Date.now();
  const res = spawnSync(process.execPath, [HOOK], {
    input: stdinStr,
    encoding: 'utf8',
    env: Object.assign({}, process.env, env || {}),
    timeout: 3000,
  });
  return { res, elapsed: Date.now() - t0 };
}

// ---------- S1 venture sentence -> state file written; exit 0; under budget ----------

run('S1 venture sentence -> state file written + telemetry + sub-1500ms', () => {
  withTmpHome((tmpHome) => {
    const sessionId = 'smoke-session-S1';
    const { res, elapsed } = spawnHook(
      JSON.stringify({ prompt: 'I have an idea for a couples finance app' }),
      { HOME: tmpHome, CLAUDE_SESSION_ID: sessionId, ANTHROPIC_API_KEY: '' }
    );
    assert.equal(res.status, 0, 'hook must exit 0; stderr=' + (res.stderr || ''));
    assert.ok(elapsed < 1500, 'hook must complete under 1500ms; got ' + elapsed + 'ms');
    const stateFile = path.join(tmpHome, '.mindrian', 'mva', sessionId + '.json');
    assert.ok(fs.existsSync(stateFile), 'state file must exist at ' + stateFile);
    const body = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.ok(body.sentence_sha256 && body.sentence_sha256.length === 64,
      'state must carry sentence_sha256 (64 hex chars); got ' + body.sentence_sha256);
    assert.equal(body.locale, 'en');
    assert.equal(body.pipeline_status, 'pending');
    assert.ok(body.classifier_source === 'heuristic' || body.classifier_source === 'heuristic_fallback',
      'classifier_source must be heuristic/heuristic_fallback; got ' + body.classifier_source);
    // Raw sentence must NOT appear in state file
    const rawState = fs.readFileSync(stateFile, 'utf8');
    assert.equal(rawState.indexOf('couples finance app'), -1,
      'state file must NEVER contain raw prompt text');
    // Telemetry
    const tFile = path.join(tmpHome, '.mindrian', 'telemetry', 'v1.13', 'mva.jsonl');
    assert.ok(fs.existsSync(tFile), 'telemetry file must exist at ' + tFile);
    const lines = fs.readFileSync(tFile, 'utf8').trim().split('\n').filter(Boolean);
    assert.equal(lines.length, 1, 'expected exactly 1 telemetry line; got ' + lines.length);
    const ev = JSON.parse(lines[0]);
    assert.equal(ev.event, 'mva_classified');
    assert.equal(ev.venture, true);
    assert.equal(ev.sha256_of_sentence, body.sentence_sha256);
    assert.equal(typeof ev.classified_in_ms, 'number');
    // Telemetry must NOT contain raw prompt
    assert.equal(lines[0].indexOf('couples finance app'), -1,
      'telemetry must NEVER contain raw prompt text');
  });
});

// ---------- S2 non-venture sentence -> NO state file; exit 0 ----------

run('S2 non-venture sentence -> no state file; exit 0', () => {
  withTmpHome((tmpHome) => {
    const sessionId = 'smoke-session-S2';
    const { res } = spawnHook(
      JSON.stringify({ prompt: 'fix the failing test in foo.test.js' }),
      { HOME: tmpHome, CLAUDE_SESSION_ID: sessionId, ANTHROPIC_API_KEY: '' }
    );
    assert.equal(res.status, 0);
    const stateFile = path.join(tmpHome, '.mindrian', 'mva', sessionId + '.json');
    assert.equal(fs.existsSync(stateFile), false,
      'state file must NOT exist for non-venture prompt; found ' + stateFile);
    // Telemetry MUST still be appended (we record classification outcomes for analysis)
    const tFile = path.join(tmpHome, '.mindrian', 'telemetry', 'v1.13', 'mva.jsonl');
    assert.ok(fs.existsSync(tFile));
    const ev = JSON.parse(fs.readFileSync(tFile, 'utf8').trim().split('\n')[0]);
    assert.equal(ev.venture, false);
  });
});

// ---------- S3 Hebrew sentence -> hebrew_refusal state; exit 0 ----------

run('S3 Hebrew sentence -> hebrew_refusal:true in state; exit 0 (LD1)', () => {
  withTmpHome((tmpHome) => {
    const sessionId = 'smoke-session-S3';
    const { res } = spawnHook(
      JSON.stringify({ prompt: 'יש לי רעיון לאפליקציה לזוגות מתחתנים' }),
      { HOME: tmpHome, CLAUDE_SESSION_ID: sessionId, ANTHROPIC_API_KEY: '' }
    );
    assert.equal(res.status, 0);
    const stateFile = path.join(tmpHome, '.mindrian', 'mva', sessionId + '.json');
    assert.ok(fs.existsSync(stateFile), 'Hebrew refusal must still write a state file');
    const body = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    assert.equal(body.hebrew_refusal, true);
    assert.equal(body.locale, 'he');
    assert.equal(body.classifier_source, 'language_detect');
    // Raw Hebrew sentence must NOT appear in state file
    const rawState = fs.readFileSync(stateFile, 'utf8');
    assert.equal(rawState.indexOf('יש לי רעיון'), -1,
      'state file must NEVER contain raw Hebrew prompt text');
  });
});

// ---------- S4 no stdin payload -> exit 0 silently ----------

run('S4 empty stdin -> exit 0 silently', () => {
  withTmpHome((tmpHome) => {
    const sessionId = 'smoke-session-S4';
    const { res } = spawnHook('', { HOME: tmpHome, CLAUDE_SESSION_ID: sessionId });
    assert.equal(res.status, 0);
    const stateFile = path.join(tmpHome, '.mindrian', 'mva', sessionId + '.json');
    assert.equal(fs.existsSync(stateFile), false);
  });
});

// ---------- S5 malformed JSON -> exit 0 silently ----------

run('S5 malformed stdin JSON -> exit 0 silently; no state mutation', () => {
  withTmpHome((tmpHome) => {
    const sessionId = 'smoke-session-S5';
    const { res } = spawnHook('not-json-at-all', { HOME: tmpHome, CLAUDE_SESSION_ID: sessionId });
    assert.equal(res.status, 0);
    const stateFile = path.join(tmpHome, '.mindrian', 'mva', sessionId + '.json');
    assert.equal(fs.existsSync(stateFile), false);
  });
});

// ---------- S6 Canon Part 8 source-grep sweep ----------

run('S6 Canon Part 8 sweep: no Brain MCP / brain-client refs in hook + classifier + state', () => {
  const files = [
    path.resolve(__dirname, '..', '..', 'scripts', 'mva-detect.cjs'),
    path.resolve(__dirname, 'mva-classifier.cjs'),
    path.resolve(__dirname, 'mva-state.cjs'),
  ];
  // Phase 239 (BRAIN-01) verdict: this is a ZERO-REFERENCE census, not a
  // tool-name-liveness fixture -- it asserts these three MVA files contain
  // NO Brain reference at all, dead or live, in any of four independent
  // forms (a brain-client require, the superseded bare mcp__brain_ prefix,
  // or the bare words brain_query / brain_search). /mcp__brain_/ is
  // therefore left UNCHANGED and not updated to the live
  // mcp__(?:plugin_...)?mindrian-brain__.* shape: doing so would narrow this
  // guard to catch only ONE specific dead literal instead of the whole
  // superseded family, weakening a defense-in-depth negative-literal set
  // into a single-string tripwire. Canon Part 8: MVA is deliberately
  // Brain-free, so this sweep must reject Brain references in ANY form,
  // not track which specific name currently happens to be live.
  const forbidden = [
    /require\(['"][^'"]*brain-client['"]\)/,
    /mcp__brain_/,
    /brain_query/,
    /brain_search/,
  ];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const re of forbidden) {
      assert.ok(!re.test(src),
        'Canon Part 8 forbidden token ' + re + ' found in ' + path.basename(f));
    }
  }
});

// ---------- Summary ----------

process.stderr.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
