#!/usr/bin/env node
'use strict';
// Phase 400.2-04: quick mode as a code path. quickLook, the two additive route fields and the MCP quick path.
// Legs Q1 to Q6 (task 1) and Q7, Q8 (task 2). Legs Q9 and Q10 come in plan 16.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const OPS_PATH = path.join(ROOT, 'lib', 'core', 'persona-ops.cjs');
const ROUTER_PATH = path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs');
const ops = require(OPS_PATH);

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const HATS = ['white', 'red', 'black', 'yellow', 'green', 'blue'];
const tmpRoots = [];

function put(room, rel, text) {
  const abs = path.join(room, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text, 'utf8');
}

function makeRoom() {
  const room = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-4002-quick-'));
  tmpRoots.push(room);
  put(room, 'STATE.md', '---\nventure: Harbor Light Studio\nstage: seed\n---\n\n# Harbor Light Studio\n\nA test venture.\n');
  put(room, 'problem-definition/core-problem.md', '# Core problem\nSmall studios lose clients at the hand-off.\n');
  put(room, 'market-analysis/size.md', '# Size\nAbout 4000 studios in the region.\n');
  return room;
}

function writeHatFile(room, name, fm, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) lines.push(k + ': ' + v);
  lines.push('---', '', body || '# Persona', '');
  put(room, path.join('personas', name), lines.join('\n'));
}

// Q1
check('Q1. quickLook starts with mode quick and QUICK_NOTICE', () => {
  const room = makeRoom();
  const out = ops.quickLook(room);
  const keys = Object.keys(out);
  assert.equal(keys[0], 'mode');
  assert.equal(keys[1], 'notice');
  assert.equal(out.mode, 'quick');
  assert.equal(out.notice, ops.QUICK_NOTICE);
  assert.ok(JSON.stringify(out).startsWith('{"mode":"quick","notice":'));
});

// Q2
check('Q2. no personas directory: six hats on the fixed discipline, no error key', () => {
  const room = makeRoom();
  assert.equal(fs.existsSync(path.join(room, 'personas')), false);
  const out = ops.quickLook(room);
  assert.deepEqual(Object.keys(out.hats), HATS);
  for (const h of HATS) {
    assert.equal(out.hats[h].source, 'fixed_discipline', h);
    assert.equal(out.hats[h].text, ops.HAT_DISCIPLINE[h], h);
  }
  assert.deepEqual(out.fixed_discipline_hats, HATS);
  assert.equal('error' in out, false);
  assert.equal(out.artifact, null);
});

// Q3
check('Q3. only a fresh persona is used; stale, unaccepted and preview-only are named as fixed discipline', () => {
  const room = makeRoom();
  const fp = ops.roomFingerprint(room);
  const old = 'a'.repeat(64);
  writeHatFile(room, 'black-harbor.md', { hat: 'black', built_by: 'persona-analyst', persona_status: 'accepted', room_fingerprint: '"' + fp + '"' }, '# Black persona\nFRESH-BLACK-MARK\n');
  writeHatFile(room, 'white-harbor.md', { hat: 'white', built_by: 'persona-analyst', persona_status: 'accepted', room_fingerprint: '"' + old + '"' }, '# White\nSTALE-WHITE-MARK\n');
  writeHatFile(room, 'yellow-harbor.md', { hat: 'yellow', built_by: 'persona-analyst', persona_status: 'proposed', room_fingerprint: '"' + fp + '"' }, '# Yellow\nUNACCEPTED-YELLOW-MARK\n');
  writeHatFile(room, 'green-harbor.md', { hat: 'green', domain: 'harbor', preview_notice: '"QUICK PREVIEW"' }, '# Green\nPREVIEW-GREEN-MARK\n');
  const out = ops.quickLook(room);
  assert.equal(out.hats.black.source, 'persona_file');
  assert.ok(out.hats.black.text.includes('FRESH-BLACK-MARK'));
  for (const h of ['white', 'red', 'yellow', 'green', 'blue']) {
    assert.equal(out.hats[h].source, 'fixed_discipline', h);
    assert.equal(out.hats[h].text, ops.HAT_DISCIPLINE[h], h);
  }
  assert.deepEqual(out.fixed_discipline_hats, ['white', 'red', 'yellow', 'green', 'blue']);
  const all = JSON.stringify(out);
  for (const mark of ['STALE-WHITE-MARK', 'UNACCEPTED-YELLOW-MARK', 'PREVIEW-GREEN-MARK']) {
    assert.equal(all.includes(mark), false, mark);
  }
});

// Q4
check('Q4. no tension map and no perspectives key; an artifact is carried as text', () => {
  const room = makeRoom();
  const art = path.join(room, 'problem-definition', 'core-problem.md');
  const out = ops.quickLook(room, art);
  assert.equal('tension_map' in out, false);
  assert.equal('perspectives' in out, false);
  assert.ok(out.artifact.includes('Small studios lose clients'));
  assert.equal(ops.quickLook(room, path.join(room, 'missing.md')).artifact, null);
});

// Q5 (NEGATIVE)
check('Q5. quick mode makes zero requests and requires no research module', () => {
  const room = makeRoom();
  let requests = 0;
  const savedFetch = globalThis.fetch;
  const saved = [];
  function wrap(mod, name) {
    const orig = mod[name];
    saved.push([mod, name, orig]);
    mod[name] = function () { requests += 1; throw new Error('network blocked in test'); };
  }
  globalThis.fetch = function () { requests += 1; throw new Error('fetch blocked in test'); };
  for (const m of [http, https]) { wrap(m, 'request'); wrap(m, 'get'); }
  try {
    const out = ops.quickLook(room);
    assert.equal(out.mode, 'quick');
  } finally {
    globalThis.fetch = savedFetch;
    for (const [mod, name, orig] of saved) mod[name] = orig;
  }
  assert.equal(requests, 0);
  const src = ops.quickLook.toString();
  assert.equal(/require\s*\(/.test(src), false, 'quickLook holds no require');
  assert.equal(/research|corpus|lens/i.test(src), false, 'quickLook names no research, corpus or lens module');
});

// Q6
check('Q6. the route answer keeps routed and route_to and gains surface_note and quick_available', () => {
  const room = makeRoom();
  const out = ops.generatePersonas(room);
  assert.equal(out.routed, true);
  assert.equal(out.route_to, '/mos:persona --parallel');
  assert.equal(out.surface_note, ops.DEEP_SURFACE_NOTE);
  assert.equal(out.quick_available, true);
  assert.equal(fs.existsSync(path.join(room, 'personas')), false);
  assert.equal(ops.DEEP_SURFACE_NOTE, 'Deep review needs separate agents and a local shell. It runs in Claude Code. Here I can give the fast look, which is one pass and not an independent review.');
});

// F11 (kept)
check('F11. invokePersona stays at line 550', () => {
  const lines = fs.readFileSync(OPS_PATH, 'utf8').split('\n');
  assert.ok(lines[549].startsWith('function invokePersona('), lines[549]);
});

for (const r of tmpRoots) fs.rmSync(r, { recursive: true, force: true });
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
