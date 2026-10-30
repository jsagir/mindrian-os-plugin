#!/usr/bin/env node
'use strict';
/*
 * Phase 369.6 plan 12: the static per-turn voice and operation line (D-16, D-34, D-44, R-06).
 *
 * Seven behaviors, each a PASS or FAIL line:
 *   B1 a plain prompt: stdout holds REMINDER_LINE exactly once, before any GRAPH FINDINGS or NAVIGATION DECISION block
 *   B2 a slash prompt and an empty stdin: no line (the silent-exit contract holds)
 *   B3 MINDRIAN_VOICE_REMINDER=0: no line
 *   B4 the line sits outside the navigation block: the suppress marker path cannot remove it
 *   B5 a JSON envelope the hook writes stays the first bytes of stdout, unchanged
 *   B6 the line stays inside REMINDER_BUDGET_BYTES and holds no dash pause, room name, path, user text or Brain call
 *   B7 the parity leg: the classifier requires the constant and holds no literal copy
 *
 * Hermetic (Codex C1): every spawn runs under isolatedEnv of scripts/isolate-larry-voice.cjs inside a scratch
 * root; installNetGuard counts fetch calls in the test process. No network, no live model, no ~/MindrianRooms.
 *
 * Run: node tests/test-3696-voice-reminder.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { installNetGuard } = require('./helpers/hygiene-355.cjs');

const NET = installNetGuard();
const ROOT = path.resolve(__dirname, '..');
const IC_PATH = path.join(ROOT, 'scripts', 'intent-classifier.cjs');
const ID_PATH = path.join(ROOT, 'lib', 'hmi', 'larry-identity.cjs');
const { makeScratch, isolatedEnv } = require(path.join(ROOT, 'scripts', 'isolate-larry-voice.cjs'));
const ID = require(ID_PATH);
const { writeSessionBinding } = require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs'));

const results = [];
function check(name, ok, detail) {
  results.push(!!ok);
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !detail ? '' : ' (' + detail + ')'));
  return !!ok;
}

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const scratch = makeScratch('voice-reminder-3696-');

// A rooms home with a bound primary room and one off-scope room, so a binding-gate envelope fires.
const PRIMARY = 'quantum-bakery';
const OFFSCOPE = 'copper-ledger';
const SESSION = 'sess-3696-voice-reminder';
function writeRoom(slug, project, heading, phrase) {
  fs.mkdirSync(path.join(scratch.rooms, slug), { recursive: true });
  fs.writeFileSync(path.join(scratch.rooms, slug, 'STATE.md'), '---\nproject: ' + project + '\n---\n# ' + heading + '\n' + phrase + '\n');
}
writeRoom(PRIMARY, 'Sourdough Croissant Bakery', 'Quantum Bakery', 'Oven Baking Schedule');
writeRoom(OFFSCOPE, 'Invoice Ledger Billing', 'Copper Ledger', 'Accounts Payable Register');
fs.mkdirSync(path.join(scratch.rooms, '.rooms'), { recursive: true });
const registry = { active: PRIMARY, rooms: {} };
registry.rooms[PRIMARY] = { slug: PRIMARY };
registry.rooms[OFFSCOPE] = { slug: OFFSCOPE };
fs.writeFileSync(path.join(scratch.rooms, '.rooms', 'registry.json'), JSON.stringify(registry, null, 2));
writeSessionBinding(SESSION, { bound: [PRIMARY], primary: PRIMARY }, { home: scratch.rooms });
const SESSION_OFF = SESSION + '-off';
writeSessionBinding(SESSION_OFF, { bound: [PRIMARY], primary: PRIMARY }, { home: scratch.rooms });

function spawnClassifier(input, extraEnv) {
  const env = Object.assign(isolatedEnv(scratch), { CLAUDE_SESSION_ID: SESSION }, extraEnv || {});
  return spawnSync(process.execPath, [IC_PATH], { input: input, encoding: 'utf8', env: env, timeout: 30000 });
}
function count(hay, needle) {
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1) { n += 1; i = hay.indexOf(needle, i + needle.length); }
  return n;
}

const PLAIN = JSON.stringify({ prompt: 'what should I look at first for the pricing assumption' });
const OFFSCOPE_PROMPT = 'let us review the invoice ledger billing accounts payable register process for this week please';

// ---- the constant -----------------------------------------------------------------------------------------
check('B0 the constant exports REMINDER_LINE, REMINDER_BUDGET_BYTES and shouldEmitVoiceReminder',
  typeof ID.REMINDER_LINE === 'string' && ID.REMINDER_LINE.length > 0
  && Number.isInteger(ID.REMINDER_BUDGET_BYTES) && typeof ID.shouldEmitVoiceReminder === 'function');
if (typeof ID.REMINDER_LINE !== 'string') {
  console.log('PASS: ' + results.filter(Boolean).length + ' FAIL: ' + results.filter(function (r) { return !r; }).length);
  process.exit(1);
}
const LINE = ID.REMINDER_LINE;

// ---- B1 a plain prompt ------------------------------------------------------------------------------------
{
  const r = spawnClassifier(PLAIN);
  const out = r.stdout || '';
  const at = out.indexOf(LINE);
  const gf = out.indexOf('GRAPH FINDINGS');
  const nd = out.indexOf('NAVIGATION DECISION');
  check('B1a a plain prompt exits 0', r.status === 0, 'status ' + r.status + ' ' + (r.stderr || '').slice(0, 200));
  check('B1b stdout holds REMINDER_LINE exactly once', count(out, LINE) === 1, 'count ' + count(out, LINE));
  check('B1c the line comes before any GRAPH FINDINGS or NAVIGATION DECISION block',
    at !== -1 && (gf === -1 || at < gf) && (nd === -1 || at < nd));
  check('B1d the line is a whole line of stdout', out.split('\n').indexOf(LINE) !== -1);
}

// ---- B2 slash prompt and empty stdin ----------------------------------------------------------------------
{
  const slash = spawnClassifier(JSON.stringify({ prompt: '/mos:status' }));
  check('B2a a slash prompt carries no line', slash.status === 0 && (slash.stdout || '').indexOf(LINE) === -1);
  const lead = spawnClassifier(JSON.stringify({ prompt: '   /gsd-quick fix a typo' }));
  check('B2b a slash prompt after leading spaces carries no line', (lead.stdout || '').indexOf(LINE) === -1);
  const empty = spawnClassifier('');
  check('B2c empty stdin: exit 0 and empty stdout (the silent-exit contract)', empty.status === 0 && (empty.stdout || '') === '', JSON.stringify((empty.stdout || '').slice(0, 80)));
  const blank = spawnClassifier(JSON.stringify({ prompt: '   ' }));
  check('B2d a blank prompt carries no line', (blank.stdout || '').indexOf(LINE) === -1);
}

// ---- B3 the off switch ------------------------------------------------------------------------------------
{
  const off = spawnClassifier(PLAIN, { MINDRIAN_VOICE_REMINDER: '0' });
  check('B3a MINDRIAN_VOICE_REMINDER=0 carries no line', off.status === 0 && (off.stdout || '').indexOf(LINE) === -1);
  const on1 = spawnClassifier(PLAIN, { MINDRIAN_VOICE_REMINDER: '1' });
  check('B3b MINDRIAN_VOICE_REMINDER=1 keeps the line (on by default)', count(on1.stdout || '', LINE) === 1);
  check('B3c shouldEmitVoiceReminder truth table',
    ID.shouldEmitVoiceReminder('hello', {}) === true
    && ID.shouldEmitVoiceReminder('hello', { MINDRIAN_VOICE_REMINDER: '0' }) === false
    && ID.shouldEmitVoiceReminder('', {}) === false
    && ID.shouldEmitVoiceReminder('  /mos:x', {}) === false
    && ID.shouldEmitVoiceReminder('hello', undefined) === true
    && ID.shouldEmitVoiceReminder(undefined, {}) === false);
}

// ---- B4 outside the navigation block ----------------------------------------------------------------------
{
  const ic = require(IC_PATH);
  const src = fs.readFileSync(IC_PATH, 'utf8');
  check('B4a the suppress marker and the budget are untouched constants that do not hold the line',
    ic.NAV_UNCHANGED_MARKER.indexOf(LINE) === -1 && ic.NAV_UNCHANGED_MARKER === '[NAV DECISION unchanged - prior block stands]'
    && ic.NAV_BLOCK_BUDGET_BYTES === 1100);
  const block = ic.renderEngineDecisionWithDial({ fire_skill: 'discover', suppress_skills: [], decision_trace: { brain_md_tier_mode: 'tier_0', chosen_rationale: 'first reason' } },
    { source: 'engine' }, '', { cortexNodes: [] });
  check('B4b the navigation block render does not hold the line', typeof block === 'string' && block.indexOf(LINE) === -1);
  const mainAt = src.indexOf('const code = main();');
  const callAt = src.indexOf('emitVoiceReminder();', mainAt);
  const injectAt = src.indexOf('injectGraphFindings(injectionStart);', mainAt);
  check('B4c emitVoiceReminder() is called once, after main() and before injectGraphFindings',
    mainAt !== -1 && callAt > mainAt && callAt < injectAt && count(src, 'emitVoiceReminder();') === 1);
  // A second identical turn: whatever the navigation block does (full or the marker), the line is still there.
  const t1 = spawnClassifier(PLAIN);
  const t2 = spawnClassifier(PLAIN);
  check('B4d a repeated identical turn still carries the line once', count(t1.stdout || '', LINE) === 1 && count(t2.stdout || '', LINE) === 1);
  if ((t2.stdout || '').indexOf(ic.NAV_UNCHANGED_MARKER) !== -1) {
    check('B4e on a turn that carries the unchanged marker the line is present', (t2.stdout || '').indexOf(LINE) !== -1);
  }
}

// ---- B5 a JSON envelope stays first ------------------------------------------------------------------------
{
  const on = spawnClassifier(JSON.stringify({ prompt: OFFSCOPE_PROMPT }));
  const off = spawnClassifier(JSON.stringify({ prompt: OFFSCOPE_PROMPT }), { MINDRIAN_VOICE_REMINDER: '0', CLAUDE_SESSION_ID: SESSION_OFF });
  const out = on.stdout || '';
  check('B5a the binding-gate fixture writes a JSON envelope first', out.charAt(0) === '{', JSON.stringify(out.slice(0, 60)));
  let envelopeText = '';
  if (out.charAt(0) === '{') {
    // The envelope is the first line; it must parse and must not contain the line.
    envelopeText = out.split('\n')[0];
    let parsedOk = false;
    try { JSON.parse(envelopeText); parsedOk = true; } catch (_e) { parsedOk = false; }
    check('B5b the first line of stdout parses as one JSON value', parsedOk);
    check('B5c the envelope does not hold the line, the line follows it', envelopeText.indexOf(LINE) === -1 && out.indexOf(LINE) > envelopeText.length - 1);
    const offFirst = (off.stdout || '').split('\n')[0];
    check('B5d the envelope bytes are the same with the line off (same prompt, a second bound session)', offFirst === envelopeText, JSON.stringify(offFirst.slice(0, 80)));
  } else {
    check('B5b the envelope leg ran', false, 'no envelope on the fixture');
  }
}

// ---- B6 the line itself -----------------------------------------------------------------------------------
{
  const bytes = Buffer.byteLength(LINE, 'utf8');
  check('B6a Buffer.byteLength(REMINDER_LINE) is at most REMINDER_BUDGET_BYTES, and the ceiling is the next multiple of 50',
    bytes <= ID.REMINDER_BUDGET_BYTES && ID.REMINDER_BUDGET_BYTES % 50 === 0 && ID.REMINDER_BUDGET_BYTES - bytes < 50, bytes + ' of ' + ID.REMINDER_BUDGET_BYTES);
  console.log('INFO REMINDER_LINE bytes ' + bytes + ' ceiling ' + ID.REMINDER_BUDGET_BYTES);
  check('B6b no em dash, no en dash, no spaced double hyphen', LINE.indexOf(EM) === -1 && LINE.indexOf(EN) === -1 && !/\s--\s/.test(LINE));
  check('B6c one line, ASCII, no newline', LINE.indexOf('\n') === -1 && /^[\x20-\x7e]+$/.test(LINE));
  check('B6d no room name, no path, no id, no user text',
    LINE.indexOf(PRIMARY) === -1 && LINE.indexOf(OFFSCOPE) === -1 && !/[\\/]/.test(LINE) && !/[0-9a-f]{8}-[0-9a-f]{4}/.test(LINE) && LINE.indexOf('pricing assumption') === -1);
  check('B6e the line opens the contract: glyph and label, silent operation, own knowledge, the suggested step',
    /Larry \| MindrianOS/.test(LINE) && /silently/.test(LINE) && /own knowledge/.test(LINE) && /suggested step/.test(LINE));
  check('B6f the line names no tool, server, database or Brain', !/\b(MCP|brain_|Brain|server|database|SQLite|room\.db|hook|tool)\b/i.test(LINE));
  const idSrc = fs.readFileSync(ID_PATH, 'utf8');
  check('B6g larry-identity.cjs has no network or Brain reference', !/fetch\(|brain_|https?:/.test(idSrc));
  check('B6h the module requires only voice-color-mark', (idSrc.match(/require\(['"][^'"]+['"]\)/g) || []).length === 1);
  const CARRIER = ID.CARRIERS.find(function (c) { return c.path === 'scripts/intent-classifier.cjs'; });
  check('B6i CARRIERS lists the classifier as (cli, rendered) and VERSION is 7 or later', !!CARRIER && CARRIER.surface === 'cli' && CARRIER.mode === 'rendered' && Number(ID.VERSION) >= 7);
}

// ---- B7 the parity leg ------------------------------------------------------------------------------------
{
  const src = fs.readFileSync(IC_PATH, 'utf8');
  check('B7a the classifier requires lib/hmi/larry-identity.cjs', /larry-identity/.test(src));
  check('B7b the classifier holds no literal copy of REMINDER_LINE or its opening words',
    src.indexOf(LINE) === -1 && src.indexOf(LINE.slice(0, 40)) === -1);
  check('B7c the helper is fail-silent (a try around the require and the write)',
    /function emitVoiceReminder\(\)\s*\{\s*try\s*\{/.test(src));
}

check('NET no network call in the test process', NET.attempts() === 0);

try { fs.rmSync(scratch.root, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

const pass = results.filter(Boolean).length;
const fail = results.length - pass;
console.log('PASS: ' + pass + ' FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);
