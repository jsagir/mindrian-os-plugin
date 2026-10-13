#!/usr/bin/env node
'use strict';
/**
 * tests/test-k1u-session-start-envelope.cjs (quick 261013-k1u, SEED-128 T14)
 *
 * Proves that scripts/session-start prints valid JSON in every tier, in both
 * envelope shapes, on the cold first-install path and on the bash fallback
 * path, with no ANSI colour code and no C0 control byte inside the JSON
 * string.
 *
 * Why: Claude Code 2.1.296 drops the whole session-start context when the
 * hook stdout is invalid JSON (debug entry X-1, runtime CONFIRMED). The old
 * bash envelope passed ESC bytes from the Room Map and the EDGE lines into
 * the JSON string.
 *
 * Fixture: a synthetic room only (never a copy of a real room, debug entry
 * I-7). Scratch HOME, refused Brain origin (Canon Part 8), env allowlist.
 *
 * Exports buildFixture and runSessionStart so a live harness can reuse the
 * fixture. The checks run only when this file is the main module.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SESSION_START = path.join(REPO_ROOT, 'scripts', 'session-start');
const ENVELOPE_MODULE = path.join(REPO_ROOT, 'lib', 'core', 'session-context-envelope.cjs');

const SECTION_NAMES = [
  'problem-definition', 'market-analysis', 'solution-design', 'competitive-analysis',
  'business-model', 'team-execution', 'legal-ip', 'financial-model', 'go-to-market',
  'customer-discovery', 'risk-register', 'funding-strategy', 'technology', 'partnerships',
];

function repeatTo(text, n) {
  let out = '';
  while (out.length < n) out += text;
  return out.slice(0, n);
}

/**
 * Build a synthetic room under baseDir.
 *   rooms-home/venture/            the room (.room-root, .mindrian/, STATE.md, USER.md, .learnings.md)
 *   rooms-home/venture/<section>/  ROOM.md, MINTO.md and filesPerSection entry files
 *   rooms-home/.rooms/registry.json active "venture"
 *   rooms-home/sealed-lab/GUARDRAIL.md when sealed is true
 *   work/venture/                  an alternate cwd (basename matches the room)
 *   home/                          the scratch HOME
 */
function buildFixture(baseDir, opts) {
  const o = Object.assign({ sections: 3, filesPerSection: 2, sealed: false }, opts || {});
  const roomsHome = path.join(baseDir, 'rooms-home');
  const roomDir = path.join(roomsHome, 'venture');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '---\nproject: Fixture Venture\n---\n# State\n');
  fs.writeFileSync(path.join(roomDir, 'USER.md'),
    '# About the user\n\n' + repeatTo('The user is a founder who tests a wedge in a narrow market and wants honest pressure on each claim. ', 1500) + '\n');
  fs.writeFileSync(path.join(roomDir, '.learnings.md'),
    '# Learnings\n\n' + repeatTo('- The user prefers short answers and one next move per turn.\n', 800));
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify({
    active: 'venture',
    rooms: { venture: { path: roomDir, status: 'active', venture_name: 'Fixture Venture' } },
  }, null, 2));
  const secs = SECTION_NAMES.slice(0, o.sections);
  const now = new Date().toISOString();
  secs.forEach((s, idx) => {
    const d = path.join(roomDir, s);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'ROOM.md'), '# ' + s + '\n\nIdentity text for ' + s + '.\n');
    const gt = 'Governing thought for ' + s + ' is that the wedge holds.';
    fs.writeFileSync(path.join(d, 'MINTO.md'), [
      '---', 'schema_version: 88', 'governing_thought: "' + gt + '"',
      'last_generated_at: "' + now + '"', 'last_artifact_write_seen_at: "' + now + '"',
      'reasoning_health_score: 0.75', 'flagged_weaknesses: []', 'decision_log: []', '---', '',
      '# Governing Thought', '', gt, '', '# Claim 1', '', 'Supporting claim.', '',
    ].join('\n'));
    const next = secs[(idx + 1) % secs.length];
    for (let i = 0; i < o.filesPerSection; i++) {
      fs.writeFileSync(path.join(d, s + '-entry-' + i + '.md'),
        '---\ntitle: entry ' + i + '\nstatus: active\n---\n# Entry ' + i + '\n\n' +
        'This entry mentions market wedge customer pricing and [[' + next + ']] assumption risk.\n');
    }
  });
  if (o.sealed) {
    const sealedDir = path.join(roomsHome, 'sealed-lab');
    fs.mkdirSync(sealedDir, { recursive: true });
    fs.writeFileSync(path.join(sealedDir, 'GUARDRAIL.md'),
      '# Guardrail\n\nDo not share lab data with any other room.\nDo not name the partner lab.\nDo not export raw results.\n');
  }
  const workDir = path.join(baseDir, 'work', 'venture');
  fs.mkdirSync(workDir, { recursive: true });
  const home = path.join(baseDir, 'home');
  fs.mkdirSync(home, { recursive: true });
  return { baseDir, roomsHome, roomDir, workDir, home, sections: secs };
}

/**
 * Run scripts/session-start once against a fixture.
 * opts: { key, cwd, home, roomsHome, extraEnv, fullFile }
 * stdout and stderr go to files, so the call returns at bash exit and a
 * background job that holds a pipe cannot delay it (debug entry F6).
 */
function runSessionStart(fx, opts) {
  const o = opts || {};
  const key = o.key || 'run';
  const runDir = path.join(fx.baseDir, 'runs', key);
  fs.mkdirSync(runDir, { recursive: true });
  const home = o.home || fx.home;
  fs.mkdirSync(home, { recursive: true });
  const tmpDir = path.join(fx.baseDir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const cwd = o.cwd || fx.roomDir;
  const roomsHome = o.roomsHome || fx.roomsHome;
  const fullFile = o.fullFile || path.join(fx.roomDir, '.mindrian', 'session-context.txt');
  try { fs.rmSync(fullFile, { force: true }); } catch (_e) { /* absent */ }
  const env = {
    PATH: process.env.PATH || '/usr/bin:/bin',
    HOME: home,
    TMPDIR: tmpDir,
    PWD: cwd,
    MINDRIAN_ROOMS_HOME: roomsHome,
    MINDRIAN_ROOMS_ROOT: roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
    SESSION_START_NODE_PREFLIGHT_SKIP: '1',
    MINDRIAN_DOGFOOD_DRAIN_SKIP: '1',
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    MINDRIAN_BRAIN_PREWARM_TIMEOUT_MS: '1000',
  };
  Object.assign(env, o.extraEnv || {});
  const outPath = path.join(runDir, 'stdout');
  const errPath = path.join(runDir, 'stderr');
  const outFd = fs.openSync(outPath, 'w');
  const errFd = fs.openSync(errPath, 'w');
  const t0 = Date.now();
  let res;
  try {
    res = spawnSync('bash', [SESSION_START], { cwd, env, stdio: ['ignore', outFd, errFd], timeout: 180000 });
  } finally {
    fs.closeSync(outFd);
    fs.closeSync(errFd);
  }
  const ms = Date.now() - t0;
  const stdoutBuf = fs.readFileSync(outPath);
  const stdout = stdoutBuf.toString('utf8');
  let parsed = null;
  let parseError = null;
  try { parsed = JSON.parse(stdout); } catch (e) { parseError = e.message; }
  let ctx = null;
  let sysMsg = null;
  if (parsed) {
    if (parsed.hookSpecificOutput && typeof parsed.hookSpecificOutput.additionalContext === 'string') {
      ctx = parsed.hookSpecificOutput.additionalContext;
    } else if (typeof parsed.additional_context === 'string') {
      ctx = parsed.additional_context;
    }
    sysMsg = parsed.systemMessage;
  }
  let fullText = null;
  try { fullText = fs.readFileSync(fullFile, 'utf8'); } catch (_e) { fullText = null; }
  return {
    key, status: res.status, signal: res.signal, error: res.error, ms,
    stdoutBuf, stdout, stderr: fs.readFileSync(errPath, 'utf8'),
    parsed, parseError, ctx, sysMsg, fullFile, fullText,
  };
}

module.exports = { buildFixture, runSessionStart, SECTION_NAMES };

// ---------------------------------------------------------------------------
// Checks (main module only)
// ---------------------------------------------------------------------------
if (require.main === module) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'k1u-envelope-'));
  process.on('exit', () => { try { fs.rmSync(base, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

  let pass = 0;
  let fail = 0;
  function ok(desc, fn) {
    try {
      fn();
      pass += 1;
      console.log('  ok   ' + desc);
    } catch (e) {
      fail += 1;
      console.log('  FAIL ' + desc);
      console.log('       ' + String((e && e.message) || e).split('\n').join('\n       '));
    }
  }

  const large = buildFixture(path.join(base, 'large'), { sections: 14, filesPerSection: 3, sealed: true });

  const memo = {};
  function run(name) {
    if (memo[name]) return memo[name];
    let r;
    const freshHome = path.join(base, 'homes', name);
    switch (name) {
      case 'minimal':
      case 'balanced':
      case 'rich':
        r = runSessionStart(large, { key: name, home: freshHome, extraEnv: { MINDRIAN_CONTEXT_TIER: name } });
        break;
      case 'cursor':
        r = runSessionStart(large, { key: name, home: freshHome, extraEnv: { MINDRIAN_CONTEXT_TIER: 'minimal', CURSOR_PLUGIN_ROOT: REPO_ROOT } });
        break;
      case 'fallback':
        r = runSessionStart(large, { key: name, home: freshHome, extraEnv: { MINDRIAN_CONTEXT_TIER: 'minimal', MINDRIAN_SESSION_CONTEXT_FALLBACK: '1' } });
        break;
      case 'cold': {
        // Fresh HOME, cwd outside any room, an empty rooms home: the first-install branch.
        const coldCwd = path.join(base, 'cold-cwd');
        const emptyRooms = path.join(base, 'cold-rooms');
        fs.mkdirSync(coldCwd, { recursive: true });
        fs.mkdirSync(emptyRooms, { recursive: true });
        r = runSessionStart(large, {
          key: name, home: freshHome, cwd: coldCwd, roomsHome: emptyRooms,
          fullFile: path.join(freshHome, '.mindrian', 'session-context.txt'),
        });
        break;
      }
      default:
        throw new Error('unknown run ' + name);
    }
    memo[name] = r;
    return r;
  }

  const ANSI_RESIDUE = /\[\d+(;\d+)*m/;

  function assertParsed(r) {
    assert.equal(r.status, 0, r.key + ': exit ' + r.status + ' signal ' + r.signal + ' stderr tail: ' + r.stderr.slice(-400));
    assert.ok(r.parsed, r.key + ': JSON.parse failed: ' + r.parseError);
    assert.equal(typeof r.ctx, 'string', r.key + ': no context string');
    assert.equal(typeof r.sysMsg, 'string', r.key + ': systemMessage is not a string');
  }

  function assertClean(r) {
    let bad = 0;
    let esc = 0;
    for (const b of r.stdoutBuf) {
      if (b === 0x1b) esc += 1;
      if (b < 0x20 && b !== 0x0a) bad += 1;
    }
    assert.equal(esc, 0, r.key + ': raw stdout holds ' + esc + ' ESC bytes');
    assert.equal(bad, 0, r.key + ': raw stdout holds ' + bad + ' bytes below 0x20 other than LF');
    const c0 = [];
    for (const ch of r.ctx) {
      const cp = ch.codePointAt(0);
      if (cp < 0x20 && cp !== 0x0a && cp !== 0x09) c0.push(cp);
    }
    assert.equal(c0.length, 0, r.key + ': parsed context holds C0 characters: ' + c0.slice(0, 8).join(','));
    const m = ANSI_RESIDUE.exec(r.ctx);
    assert.ok(!m, r.key + ': parsed context holds ANSI residue ' + (m && m[0]));
  }

  console.log('test-k1u-session-start-envelope (quick 261013-k1u)');

  // --- T14: tiers ---------------------------------------------------------
  for (const tier of ['minimal', 'balanced', 'rich']) {
    ok('T14 ' + tier + ' tier: exit 0, valid JSON, hook shape, tier override honored', () => {
      const r = run(tier);
      assertParsed(r);
      assert.equal(r.parsed.hookSpecificOutput.hookEventName, 'SessionStart');
      assert.ok(r.ctx.includes('[Context Tier: ' + tier), tier + ': context lacks "[Context Tier: ' + tier + '"');
    });
    ok('T14 ' + tier + ' tier: no ESC and no stray control byte in stdout or in the parsed context', () => {
      const r = run(tier);
      assertParsed(r);
      assertClean(r);
    });
  }

  ok('T14 Cursor flat shape (minimal tier): additional_context parses clean', () => {
    const r = run('cursor');
    assertParsed(r);
    assert.equal(typeof r.parsed.additional_context, 'string', 'flat shape lacks additional_context');
    assert.ok(!r.parsed.hookSpecificOutput, 'flat shape must not carry hookSpecificOutput');
    assertClean(r);
  });

  ok('T14 cold first-install path: parses clean and carries the onboarding block', () => {
    const r = run('cold');
    assertParsed(r);
    assertClean(r);
    assert.ok(r.ctx.includes('[MindrianOS Onboarding] First install detected.'), 'cold context lacks the onboarding line');
  });

  ok('T14 bash fallback path (MINDRIAN_SESSION_CONTEXT_FALLBACK=1): parses clean', () => {
    const r = run('fallback');
    assertParsed(r);
    assert.equal(r.parsed.hookSpecificOutput.hookEventName, 'SessionStart');
    assertClean(r);
  });

  // --- Unit: the encoder module ---------------------------------------------
  ok('unit sanitizeText: removes CSI, OSC, ESC plus one byte, NUL, GS and DEL; keeps LF, TAB and backslash-n; CR LF to LF', () => {
    const env = require(ENVELOPE_MODULE);
    const input = 'a\u001b[32mgreen\u001b[0m b\u001b]0;title\u0007c \u001b]8;;x\u001b\\d \u001bMe'
      + ' n\u0000u\u001dl\u007fl\tTAB\nLF\r\nCRLF lone\rCR lit\\n';
    const out = env.sanitizeText(input);
    assert.equal(out, 'agreen bc d e null\tTAB\nLF\nCRLF loneCR lit\\n');
  });

  ok('unit buildEnvelope: round-trips quotes, backslashes and non-ASCII in both shapes', () => {
    const env = require(ENVELOPE_MODULE);
    const ctx = 'He said "go" \\ C:\\Users\\nadia \u25a0 \u05e9\u05dc\u05d5\u05dd \ud83d\udfe5\nline2';
    const sm = 'loaded room: "x"';
    const hook = env.buildEnvelope({ context: ctx, systemMessage: sm, shape: 'hook' });
    const h = JSON.parse(hook);
    assert.equal(h.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.equal(h.hookSpecificOutput.additionalContext, ctx);
    assert.equal(h.systemMessage, sm);
    assert.ok(hook.endsWith('}\n'), 'envelope must end with one line feed');
    const flat = JSON.parse(env.buildEnvelope({ context: ctx, systemMessage: sm, shape: 'flat' }));
    assert.equal(flat.additional_context, ctx);
    assert.equal(flat.systemMessage, sm);
    assert.ok(!flat.hookSpecificOutput);
  });

  ok('unit splitMarkedContext: text before the first marker is "unmarked"; ids keep append order', () => {
    const env = require(ENVELOPE_MODULE);
    const G = env.MARKER;
    const blocks = env.splitMarkedContext('head' + G + 'a' + G + 'A1' + G + 'b' + G + 'B' + G + 'a' + G + 'A2');
    assert.deepEqual(blocks, [
      { id: 'unmarked', text: 'head' }, { id: 'a', text: 'A1' }, { id: 'b', text: 'B' }, { id: 'a', text: 'A2' },
    ]);
  });

  const total = pass + fail;
  if (fail === 0) {
    console.log('PASS: test-k1u-session-start-envelope (' + pass + ' of ' + total + ' checks)');
    process.exit(0);
  } else {
    console.log('FAIL: test-k1u-session-start-envelope (' + fail + ' of ' + total + ' checks failed, ' + pass + ' passed)');
    process.exit(1);
  }
}
