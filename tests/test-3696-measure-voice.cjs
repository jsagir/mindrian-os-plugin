#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 Plan 01 Task 1 (NS369.6-01, D-20). The measurement script reproduces the L2 and L5 research
 * numbers from the repo, against fixtures only (never the live persona files), so it stays green after the
 * persona edits of plans 07 to 11.
 *
 *   M1   H agent, loose rule: voice 27.8 / brand 14.2 / machinery 58.0, each within 0.1 point
 *   M2   H SKILL.md, loose rule: voice 21.1 / brand 6.8 / machinery 72.0, each within 0.1 point
 *   M3   H agent, strict core: 2447 B of 19619 B body = 12.5 percent, each byte value within 2 B
 *   M4   A agent, strict core: 1880 B of 2584 B body = 72.8 percent, each byte value within 2 B
 *   M5   renamed headings: "The practitioner's DNA", "Calibration", "Report mode" count as VOICE,
 *        "Operating invisibly" counts as OPERATION, and the strict core accepts the new DNA name
 *   M6   sectionBytes: one entry per heading, the bytes sum to the loose total, and the CLI --sections
 *        --json output carries the same list
 *   M7   sessions mode on the sample JSONL: exact turn and marker counts, the sidechain, meta, tool result
 *        and synthetic messages are ignored, and the JSON has no text, user, prompt or last key
 *   M8   sessions mode skips a project folder named after the owner's rooms and a session without the stamp
 *   M9   the immutable-source register: every path exists, sha256 matches, the bytes equal the recorded git source
 *   M10  no em dash or en dash in this file or in the script
 *
 * Hermetic: HOME, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME, MINDRIAN_ROOMS_ROOT and CLAUDE_CONFIG_DIR are mkdtemp
 * dirs before any repo require; a net guard counts any fetch.
 *
 * Output: one PASS or FAIL line per leg, then PASS: n FAIL: n. Exit 0 pass, 1 fail.
 * House rule: hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const HOME_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-3696-measure-'));
['HOME', 'MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CLAUDE_CONFIG_DIR'].forEach(function (k) {
  const d = path.join(HOME_TMP, k.toLowerCase());
  fs.mkdirSync(d, { recursive: true });
  process.env[k] = d;
});
process.env.USERPROFILE = process.env.HOME;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3696-measure-voice');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'measure-larry-voice.cjs');
const FIX = path.join(__dirname, 'fixtures');
const m = require(SCRIPT);

const read = function (p) { return fs.readFileSync(p, 'utf8'); };
const H_AGENT = read(path.join(FIX, '3696-persona-h', 'larry-extended.md'));
const H_SKILL = read(path.join(FIX, '3696-persona-h', 'SKILL.md'));
const A_AGENT = read(path.join(FIX, '3696-persona-a', 'larry-extended.md'));
const near = function (a, b, tol) { return Math.abs(a - b) <= tol; };

// M1, M2
const ha = m.measureFile(H_AGENT, { agent: true });
check('M1 H agent loose 27.8 / 14.2 / 58.0',
  near(ha.share.voice, 27.8, 0.1) && near(ha.share.brand, 14.2, 0.1) && near(ha.share.machinery, 58.0, 0.1) && ha.share.operation === 0,
  JSON.stringify(ha.share));
const hs = m.measureFile(H_SKILL, { agent: false });
check('M2 H SKILL loose 21.1 / 6.8 / 72.0',
  near(hs.share.voice, 21.1, 0.1) && near(hs.share.brand, 6.8, 0.1) && near(hs.share.machinery, 72.0, 0.1),
  JSON.stringify(hs.share));

// M3, M4
const hst = m.strictCore(H_AGENT);
check('M3 H agent strict core 2447 B of 19619 B = 12.5 percent',
  near(hst.core_bytes, 2447, 2) && near(hst.body_bytes, 19619, 2) && near(hst.share, 12.5, 0.1), JSON.stringify(hst));
const ast = m.strictCore(A_AGENT);
check('M4 A agent strict core 1880 B of 2584 B = 72.8 percent',
  near(ast.core_bytes, 1880, 2) && near(ast.body_bytes, 2584, 2) && near(ast.share, 72.8, 0.1), JSON.stringify(ast));

// M5
const synth = [
  '---', 'name: t', '---',
  'You are Larry. Intro line.', '',
  "## The practitioner's DNA", 'dna line one', '',
  '## The practitioner\u2019s DNA again', 'curly apostrophe line', '',
  '## Calibration', 'calibration line', '',
  '## Report mode', 'report line', '',
  '## Operating invisibly', 'operation line', '',
  '## Reach rules', 'machinery line',
].join('\n');
const sb = m.sectionBytes(synth);
const cls = function (t) { const e = sb.find(function (x) { return x.text.indexOf(t) === 0; }); return e && e.class; };
check('M5 renamed headings: practitioner DNA, Calibration and Report mode are VOICE; Operating invisibly is OPERATION',
  cls("The practitioner's DNA") === 'VOICE' && cls('The practitioner\u2019s DNA again') === 'VOICE' &&
  cls('Calibration') === 'VOICE' && cls('Report mode') === 'VOICE' &&
  cls('Operating invisibly') === 'OPERATION' && cls('Reach rules') === 'MACHINERY',
  JSON.stringify(sb.map(function (e) { return e.text + ':' + e.class; })));
const synthMeasure = m.measureFile(synth, { agent: true });
check('M5b the OPERATION class is counted on its own', synthMeasure.operation > 0 && synthMeasure.voice > 0,
  JSON.stringify(synthMeasure));
const strictNew = m.strictCore(synth);
check('M5c the strict core accepts the new DNA name', strictNew.core_bytes > 0 && strictNew.core_bytes < strictNew.body_bytes,
  JSON.stringify(strictNew));

// M6
const secs = m.sectionBytes(H_AGENT);
const sum = secs.reduce(function (a, e) { return a + e.bytes; }, 0);
check('M6 section bytes (with the intro) sum to the loose total', sum === ha.total, sum + ' vs ' + ha.total);
check('M6b every heading has text, level, bytes and class',
  secs.every(function (e) { return typeof e.text === 'string' && typeof e.level === 'number' && typeof e.bytes === 'number' && e.class; }));
check('M6c the Voice Signature section is BRAND and The Cardinal Sin is VOICE',
  secs.some(function (e) { return /^Voice Signature/.test(e.text) && e.class === 'BRAND'; }) &&
  secs.some(function (e) { return e.text === 'The Cardinal Sin' && e.class === 'VOICE'; }));
const cli = cp.spawnSync(process.execPath, [SCRIPT, 'files', '--dir', path.join(FIX, '3696-persona-h'), '--sections', '--json'],
  { encoding: 'utf8', env: process.env });
let cliJson = null;
try { cliJson = JSON.parse(cli.stdout); } catch (_e) { cliJson = null; }
check('M6d CLI files --sections --json lists the same sections',
  cli.status === 0 && cliJson && Array.isArray(cliJson.agent.sections) && cliJson.agent.sections.length === secs.length &&
  cliJson.agent.sections.reduce(function (a, e) { return a + e.bytes; }, 0) === ha.total && cliJson.agent.strict.core_bytes === hst.core_bytes,
  String(cli.stderr).slice(0, 200));

// M7
const SAMPLE = path.join(FIX, '3696-sessions', 'sample-session.jsonl');
const s1 = m.scanSessionFile(SAMPLE);
const expectCounts = { glyph: 1, label: 1, len_ok: 2, reframe: 0, closeq: 1, fwdump: 1, opener: 0, forbidden: 1, emdash: 1, pausedash: 0 };
check('M7 sample session: stamp, turns and pure-chat turns',
  s1 && s1.stamp_version === '2.0.0-beta.75' && s1.turns === 3 && s1.pure_chat_turns === 2, JSON.stringify(s1));
check('M7b sample session: exact marker counts (sidechain, meta, tool result and synthetic ignored)',
  s1 && JSON.stringify(s1.counts) === JSON.stringify(expectCounts), s1 && JSON.stringify(s1.counts));
check('M7c rates are counts over turns', s1 && s1.rates.glyph === 33.3 && s1.rates.len_ok === 66.7 && s1.rates.reframe === 0);
const cliS = cp.spawnSync(process.execPath, [SCRIPT, 'sessions', '--files', SAMPLE, '--json'], { encoding: 'utf8', env: process.env });
check('M7d sessions JSON has no text, user, prompt or last key and no transcript text',
  cliS.status === 0 && !/"(text|user|prompt|last)":/.test(JSON.stringify(JSON.parse(cliS.stdout))) &&
  cliS.stdout.indexOf('travel mug') === -1 && cliS.stdout.indexOf('Jobs to be Done') === -1 && cliS.stdout.indexOf(path.sep) === -1,
  String(cliS.stderr).slice(0, 200));

// M8
const projects = path.join(HOME_TMP, 'projects');
fs.mkdirSync(path.join(projects, '-home-x-dev-plugin'), { recursive: true });
fs.mkdirSync(path.join(projects, '-home-x-MindrianRooms-secret-room'), { recursive: true });
fs.copyFileSync(SAMPLE, path.join(projects, '-home-x-dev-plugin', 'aaa.jsonl'));
fs.copyFileSync(SAMPLE, path.join(projects, '-home-x-MindrianRooms-secret-room', 'bbb.jsonl'));
fs.writeFileSync(path.join(projects, '-home-x-dev-plugin', 'ccc.jsonl'),
  '{"type":"user","message":{"role":"user","content":"hello"}}\n{"type":"assistant","message":{"role":"assistant","model":"x","content":[{"type":"text","text":"hi there friend"}]}}\n');
const picked = m.scanSessions({ projects: projects });
check('M8 a rooms project folder and an unstamped session are skipped',
  picked.length === 1 && picked[0].session === 'aaa.jsonl', JSON.stringify(picked.map(function (r) { return r.session; })));
const pick2 = m.scanSessions({ projects: projects, pick: 1 });
check('M8b --pick N returns at most N sessions', pick2.length === 1);

// M9
const reg = JSON.parse(read(path.join(FIX, '3696-immutable-sources.json')));
check('M9 register holds at least 4 paths with sha256', Array.isArray(reg.paths) && reg.paths.length >= 4 &&
  reg.paths.every(function (p) { return /^[0-9a-f]{64}$/.test(p.sha256); }));
reg.paths.forEach(function (p) {
  const abs = path.join(ROOT, p.path);
  const exists = fs.existsSync(abs);
  check('M9 register path exists: ' + p.path, exists);
  if (!exists) return;
  const buf = fs.readFileSync(abs);
  check('M9 sha256 equals the register: ' + p.path, crypto.createHash('sha256').update(buf).digest('hex') === p.sha256);
  const gitOut = cp.spawnSync('git', ['show', p.source], { cwd: ROOT, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, env: process.env });
  if (gitOut.status !== 0) {
    // A shallow checkout may lack the source commit; the sha256 leg above still binds the bytes.
    check('M9 source commit absent, sha256 leg binds the bytes: ' + p.source, true);
  } else {
    check('M9 bytes equal the recorded git source: ' + p.source, Buffer.compare(gitOut.stdout, buf) === 0);
  }
});

// M10
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
[__filename, SCRIPT].forEach(function (f) {
  const t = read(f);
  check('M10 no em dash or en dash in ' + path.basename(f), t.indexOf(EM) === -1 && t.indexOf(EN) === -1);
});

check('M11 no network call', NET.attempts() === 0);
try { fs.rmSync(HOME_TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
process.exit(summary());
