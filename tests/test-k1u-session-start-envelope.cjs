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

  // --- T23: budget, order, pointers, doctrine (quick 261013-k1u Task 2) ----
  const DOCTRINE_REL = path.join('references', 'personality', 'session-start-doctrine.md');
  const ENCODER_RUNS = ['minimal', 'balanced', 'rich', 'cursor', 'cold'];

  ok('T23 unit: DEFAULT_BUDGET_CHARS is pinned at 9000 and is below CLAUDE_CODE_INLINE_LIMIT (10000)', () => {
    const env = require(ENVELOPE_MODULE);
    assert.equal(env.DEFAULT_BUDGET_CHARS, 9000);
    assert.equal(env.CLAUDE_CODE_INLINE_LIMIT, 10000);
    assert.ok(env.DEFAULT_BUDGET_CHARS < env.CLAUDE_CODE_INLINE_LIMIT);
  });

  for (const name of ['minimal', 'balanced', 'rich', 'cursor', 'cold', 'fallback']) {
    ok('T23 ' + name + ' run: additionalContext is at most 9,000 characters', () => {
      const r = run(name);
      assertParsed(r);
      assert.ok(r.ctx.length <= 9000, name + ': context is ' + r.ctx.length + ' characters (budget 9000)');
    });
  }

  ok('T23 rich order: Larry identity, room identity, stage, nudges, doctrine, NAV contract, Pointers', () => {
    const r = run('rich');
    assertParsed(r);
    const c = r.ctx;
    const iLarry = c.indexOf('You are Larry');
    const iScoped = c.indexOf('You are scoped to the room: venture');
    const iArc = c.indexOf('## ACTIVE ROOM CONTEXT');
    const iStage = c.indexOf('venture_stage:');
    const iNudges = c.indexOf('## Your Nudges for This Session');
    const iDoc = c.indexOf('## SESSION DOCTRINE');
    const iNav = c.indexOf('## NAVIGATION CARD-FIRE CONTRACT');
    const iPtr = c.indexOf('## Pointers');
    const iMem = c.indexOf('ACTIVE ROOM MEMORY');
    const pos = JSON.stringify({ iLarry, iScoped, iArc, iStage, iNudges, iDoc, iNav, iPtr, iMem });
    assert.ok(iLarry >= 0 && iLarry < 100, '"You are Larry" not in the first 100 characters: ' + pos);
    assert.ok(iScoped >= 0 && iScoped < 2000, 'room identity not in the first 2,000 characters: ' + pos);
    assert.ok(iLarry < iArc && iArc < iStage && iStage < iDoc && iDoc < iNav && iNav < iPtr, 'order broken: ' + pos);
    assert.ok(iNudges > iStage && iNudges < iDoc, 'nudges heading not inline between the stage and the doctrine: ' + pos);
    if (iMem >= 0) assert.ok(iMem < iNudges, 'room memory is inline but not before the nudges: ' + pos);
  });

  ok('T23 rich pointer: EDGE lines and Room Map boxes are not inline; the full file holds them and the Pointers block names it', () => {
    const r = run('rich');
    assertParsed(r);
    assert.ok(!/^\s*EDGE:/m.test(r.ctx), 'an EDGE: line is inline');
    assert.ok(!r.ctx.includes('┌─'), 'a Room Map box line is inline');
    assert.ok(typeof r.fullText === 'string', 'no full session context file at ' + r.fullFile);
    for (const needle of ['## Proactive Room Intelligence', 'EDGE:', '┌─', 'NAVIGATION CARD-FIRE CONTRACT']) {
      assert.ok(r.fullText.includes(needle), 'the full file lacks ' + JSON.stringify(needle));
    }
    const m = /- Full session context: (.+?)\. Shortened or left out here: ([^\n]+?)\. Read that file/.exec(r.ctx);
    assert.ok(m, 'no "Full session context:" pointer line inline');
    assert.equal(m[1], r.fullFile, 'the pointer names another path');
    assert.ok(m[2].includes('proactive room intelligence'), 'the pointer labels lack the proactive block: ' + m[2]);
    assert.ok(m[2].includes('room state (Room Map'), 'the pointer labels lack the Room Map: ' + m[2]);
  });

  for (const name of ENCODER_RUNS) {
    ok('T23 ' + name + ' run: NAV card-fire contract and the compact doctrine are inline; the doctrine pointer resolves', () => {
      const r = run(name);
      assertParsed(r);
      const c = r.ctx;
      assert.ok(c.includes('## NAVIGATION CARD-FIRE CONTRACT'), 'NAV contract heading not inline');
      assert.ok(c.includes('[FIRE-IF-FORK]'), '[FIRE-IF-FORK] not inline');
      for (const needle of ['skills/ui-system/SKILL.md', 'scripts/generate-standalone', 'initialPrompt']) {
        assert.ok(c.includes(needle), 'the compact doctrine lacks ' + needle);
      }
      const m = /- Full doctrine text: ([^\n]+)/.exec(c);
      assert.ok(m, 'no "Full doctrine text:" line');
      assert.ok(m[1].endsWith(DOCTRINE_REL), 'the doctrine pointer names ' + m[1]);
      assert.ok(fs.existsSync(m[1]), 'the doctrine file does not exist at ' + m[1]);
    });
  }

  ok('T23 cold first-install: onboarding inline and nothing was cut (no "Full session context:" line)', () => {
    const r = run('cold');
    assertParsed(r);
    assert.ok(r.ctx.includes('[MindrianOS Onboarding] First install detected.'));
    assert.ok(!r.ctx.includes('Full session context:'), 'the cold context names a full file, so something was cut');
  });

  ok('T23 fallback: the markers are removed (the context starts with the Larry identity)', () => {
    const r = run('fallback');
    assertParsed(r);
    assert.ok(r.ctx.startsWith('[MindrianOS v'), 'fallback context starts with ' + JSON.stringify(r.ctx.slice(0, 40)));
  });

  const hasPython = spawnSync('python3', ['--version'], { stdio: 'ignore' }).status === 0;
  ok('T23 rich: the SEALED ROOMS block is inline (required block)' + (hasPython ? '' : ' [skipped: no python3]'), () => {
    if (!hasPython) return;
    const r = run('rich');
    assertParsed(r);
    assert.ok(r.ctx.includes('## SEALED ROOMS'), 'SEALED ROOMS not inline');
  });

  ok('T23 doctrine file: the moved stable-prefix sentences exist line for line', () => {
    const ref = fs.readFileSync(path.join(REPO_ROOT, DOCTRINE_REL), 'utf8');
    for (const s of [
      'All /mos: command output MUST follow the 4-zone anatomy from skills/ui-system/SKILL.md:',
      'Symbol vocabulary: use ONLY these glyphs:',
      'NEVER generate HTML by hand',
      'Improvised HTML will always be inferior to the real template',
      "Larry's response to initialPrompt IS the greeting",
      'On Desktop and Cowork, no SessionStart hook fires',
    ]) {
      assert.ok(ref.includes(s), 'the doctrine file lacks: ' + s);
    }
  });

  // --- Unit: assembleContext on synthetic blocks ----------------------------
  function lines(prefix, count, width) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(repeatTo(prefix + ' line ' + i + ' ', width));
    return out.join('\n') + '\n';
  }
  const UNIT_OPTS = { budget: 9000, fullFilePath: '/rooms/venture/.mindrian/session-context.txt', doctrinePath: '/plugin/' + DOCTRINE_REL.split(path.sep).join('/') };

  ok('unit assembleContext: required pieces present; optional pieces follow rank, not input order', () => {
    const env = require(ENVELOPE_MODULE);
    const r = env.assembleContext([
      { id: 'nudges', text: '\n\nNUDGES-BLOCK' },
      { id: 'doctrine', text: '\n\nDOCTRINE-BLOCK' },
      { id: 'room-memory', text: '\n\nMEMORY-BLOCK' },
      { id: 'identity', text: 'IDENTITY-BLOCK' },
      { id: 'room-identity', text: '\n\nROOM-IDENTITY-BLOCK' },
    ], UNIT_OPTS);
    const c = r.inline;
    const order = ['IDENTITY-BLOCK', 'ROOM-IDENTITY-BLOCK', 'MEMORY-BLOCK', 'NUDGES-BLOCK', 'DOCTRINE-BLOCK', '## Pointers'].map((s) => c.indexOf(s));
    assert.ok(order.every((v) => v >= 0), 'a piece is missing: ' + JSON.stringify(order));
    for (let i = 1; i < order.length; i++) assert.ok(order[i - 1] < order[i], 'rank order broken: ' + JSON.stringify(order));
    assert.ok(c.includes('- Full doctrine text: ' + UNIT_OPTS.doctrinePath), 'the doctrine pointer is missing');
    assert.ok(!c.includes('Full session context:'), 'nothing was cut, but the full-file pointer is present');
    assert.equal(r.cut.length, 0);
  });

  ok('unit assembleContext: a cap cuts at a line end and adds the cut note; the full text keeps the whole block', () => {
    const env = require(ENVELOPE_MODULE);
    const cap = env.BLOCK_POLICY['room-memory'].cap;
    const mem = '\n\nACTIVE ROOM MEMORY\n' + lines('mem', 120, 60);
    const r = env.assembleContext([
      { id: 'identity', text: 'IDENTITY' },
      { id: 'room-memory', text: mem },
    ], UNIT_OPTS);
    const start = r.inline.indexOf('\n\nACTIVE ROOM MEMORY');
    const noteAt = r.inline.indexOf(env.CUT_NOTE);
    assert.ok(start >= 0 && noteAt > start, 'the cut note is missing');
    const kept = r.inline.slice(start, noteAt);
    assert.ok(kept.length + env.CUT_NOTE.length <= cap, 'the cut piece is above its cap: ' + (kept.length + env.CUT_NOTE.length));
    assert.ok(mem.startsWith(kept) && mem[kept.length] === '\n', 'the cut is not at a line end');
    assert.ok(r.cut.some((x) => x.id === 'room-memory'), 'the cut list lacks room-memory');
    assert.ok(r.inline.includes('- Full session context: ' + UNIT_OPTS.fullFilePath + '.'), 'the full-file pointer is missing');
    assert.ok(r.full.includes(mem), 'the full text lacks the whole memory block');
  });

  ok('unit assembleContext: a piece with fewer than 200 characters of room is left out and listed', () => {
    const env = require(ENVELOPE_MODULE);
    const r = env.assembleContext([
      { id: 'identity', text: repeatTo('I', 2300) }, // 3000 - 2300 - 600 = 100 characters of room
      { id: 'proactive', text: '\n\n## Proactive Room Intelligence\n' + lines('p', 10, 40) },
    ], Object.assign({}, UNIT_OPTS, { budget: 3000 }));
    assert.ok(!r.inline.includes('## Proactive Room Intelligence'), 'the proactive piece is inline');
    assert.ok(r.cut.some((x) => x.id === 'proactive'), 'the cut list lacks proactive');
    assert.ok(/Shortened or left out here: [^\n]*proactive room intelligence/.test(r.inline), 'the pointer does not list proactive');
    assert.ok(r.inline.length <= 3000, 'above the budget: ' + r.inline.length);
  });

  ok('unit assembleContext: required pieces above the budget are hard-cut; the result is at most the budget', () => {
    const env = require(ENVELOPE_MODULE);
    const r = env.assembleContext([
      { id: 'identity', text: lines('id', 120, 60) },
      { id: 'doctrine', text: lines('doc', 120, 60) },
    ], UNIT_OPTS);
    assert.ok(r.inline.length <= 9000, 'above the budget: ' + r.inline.length);
    assert.ok(r.inline.includes('## Pointers'), 'the Pointers block is missing');
    assert.ok(r.inline.includes('- Full doctrine text: '), 'the doctrine pointer is missing');
  });

  ok('unit assembleContext: room-state head is required, the body drops box lines and is optional', () => {
    const env = require(ENVELOPE_MODULE);
    const rs = '\\n\\n--- DYNAMIC SESSION CONTEXT ---\\n\\n[Room State]\\n---\ncomputed: x\nventure_stage: Discovery\n---\n# Data Room State\n\n## Room Map\n\n'
      + '┌─a───┐\n│ x │\n└────┘\n\n## Sections\n| a | 1 |\n';
    const r = env.assembleContext([{ id: 'identity', text: 'ID' }, { id: 'room-state', text: rs }], UNIT_OPTS);
    assert.ok(r.inline.includes('venture_stage: Discovery'), 'the head is not inline');
    assert.ok(r.inline.includes('## Sections'), 'the body is not inline');
    assert.ok(!r.inline.includes('┌─'), 'a box line is inline');
    assert.ok(r.full.includes('┌─'), 'the full text lacks the box line');
    assert.ok(r.cut.some((x) => x.id === 'room-state-body'), 'the shortened body is not listed');
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
