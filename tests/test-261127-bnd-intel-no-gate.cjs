#!/usr/bin/env node
'use strict';

/*
 * Quick 261127-bnd intel-gate: finding F8, Canon Part 9.
 *
 * Reason: runIntelPipeline used a default gate that approved every stage,
 * so a caller that supplied no gateFn ran the research fan and wrote to the
 * room with no approval. After the fix a run that is not a dry run and has
 * no gateFn halts at the calibrate gate: it fetches nothing and writes
 * nothing. A dry run still returns the plan with no gate.
 *
 * Isolation: the temp HOME, USERPROFILE, MINDRIAN_HOME, MINDRIAN_ROOMS_HOME
 * and MINDRIAN_BRAIN_URL=http://127.0.0.1:9 are set before the first
 * require of plugin code; the session variables are removed. Every seam is
 * a stub that counts its calls, and a stub fetch counts its calls.
 *
 * Node built-in modules only. Synthetic text only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bnd-ig-')));
const HOME = path.join(TMP, 'h');
const MH = path.join(HOME, '.mindrian');
const RH = path.join(TMP, 'rooms');
for (const d of [MH, RH]) fs.mkdirSync(d, { recursive: true });
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_HOME = MH;
process.env.MINDRIAN_ROOMS_HOME = RH;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_ROOM;

let FETCH_CALLS = 0;
globalThis.fetch = async function stubFetch() { FETCH_CALLS += 1; throw new Error('network call in test'); };

const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'lib', 'core', 'intel-pipeline.cjs');
const { runIntelPipeline } = require(SRC);

let roomN = 0;
function newRoom() {
  roomN += 1;
  const room = path.join(TMP, 'room-' + roomN);
  fs.mkdirSync(path.join(room, 'problem-definition'), { recursive: true });
  fs.writeFileSync(path.join(room, 'problem-definition', 'alpha.md'), '---\ntitle: Alpha\n---\n\n# Alpha\n\nSynthetic text.\n');
  return room;
}

function listFiles(dir) {
  const out = [];
  (function w(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { out.push(path.relative(dir, p) + '/'); w(p); } else out.push(path.relative(dir, p));
    }
  })(dir);
  return out.sort();
}

// seams: stub seams that count their calls.
function seams() {
  const n = { research: 0, compute: 0, write: 0, set: 0, rollup: 0 };
  const s = {
    jtbdFns: {
      getCurrent: () => ({ jtbd: 'validate-idea', confidence: 0.72, evidence: ['seed'] }),
      setCurrent: () => { n.set += 1; },
    },
    planFn: () => ({ agents: 3, budget: { effective: 120000, remaining: 200000 } }),
    researchFn: (dim) => { n.research += 1; return { findings: [{ text: 'f-' + dim, dimension: dim }], quality: 'ok' }; },
    computeFn: () => { n.compute += 1; return { ok: true }; },
    writeFn: () => { n.write += 1; return { ok: true, claim_ids: ['c1'] }; },
    bankRollupFn: () => { n.rollup += 1; return { ok: true }; },
    caps: { fan: 3 },
  };
  return { n, s };
}

function assert(c, m) { if (!c) throw new Error(m); }
function allZero(n) { return n.research === 0 && n.compute === 0 && n.write === 0 && n.set === 0 && n.rollup === 0; }

const CASES = [
  ['G1', 'no gateFn: the run halts at calibrate and does nothing', async function () {
    const room = newRoom();
    const before = listFiles(room);
    const f0 = FETCH_CALLS;
    const { n, s } = seams();
    const res = await runIntelPipeline(Object.assign({ roomDir: room, db: {} }, s));
    assert(res.halted === true && res.halt_stage === 'calibrate' && res.ok === false, 'result ' + JSON.stringify({ ok: res.ok, halted: res.halted, halt_stage: res.halt_stage }));
    assert(allZero(n), 'calls ' + JSON.stringify(n));
    assert(FETCH_CALLS === f0, 'fetch calls ' + (FETCH_CALLS - f0));
    assert(JSON.stringify(listFiles(room)) === JSON.stringify(before), 'room files changed');
    const st = (res.stages || []).find((e) => e.stage === 'calibrate' && e.status === 'halted');
    assert(st && typeof st.disclosure === 'string' && st.disclosure.includes('no approval gate was supplied'), 'stage ' + JSON.stringify(res.stages));
  }],
  ['G2', 'dryRun with no gateFn returns the plan and does nothing', async function () {
    const { n, s } = seams();
    const res = await runIntelPipeline(Object.assign({ roomDir: newRoom(), db: {}, dryRun: true }, s));
    assert(res.dry_run === true && res.plan, 'result ' + JSON.stringify({ dry_run: res.dry_run }));
    assert(allZero(n), 'calls ' + JSON.stringify(n));
  }],
  ['G3', 'a gateFn that approves all: the run ends ok', async function () {
    const { n, s } = seams();
    const res = await runIntelPipeline(Object.assign({ roomDir: newRoom(), db: {}, gateFn: () => ({ approved: true }) }, s));
    assert(res.ok === true, 'ok ' + res.ok + ' halt ' + res.halt_stage);
    assert(n.research >= 1 && n.write === 1, 'calls ' + JSON.stringify(n));
  }],
  ['G4', 'a gateFn that rejects at calibrate keeps the text of today', async function () {
    const { s } = seams();
    const res = await runIntelPipeline(Object.assign({ roomDir: newRoom(), db: {}, gateFn: (ctx) => ({ approved: ctx.stage !== 'calibrate' }) }, s));
    const st = (res.stages || []).find((e) => e.stage === 'calibrate' && e.status === 'halted');
    assert(st && st.disclosure === 'navigator rejected at the calibrate gate', 'stage ' + JSON.stringify(res.stages));
  }],
  ['G5', 'the source line that assigns gateFn does not approve by default', async function () {
    const lines = fs.readFileSync(SRC, 'utf8').split('\n').filter((l) => /\bconst gateFn\s*=/.test(l));
    assert(lines.length === 1, lines.length + ' assignment line(s)');
    assert(!lines[0].includes('approved: true'), 'line: ' + lines[0].trim());
  }],
];

async function main() {
  let p = 0;
  let f = 0;
  const failures = [];
  try {
    for (const [id, name, fn] of CASES) {
      try { await fn(); p += 1; process.stdout.write('  ok   ' + id + ' ' + name + '\n'); }
      catch (err) { f += 1; failures.push(id + ': ' + (err && err.message ? err.message : String(err))); process.stdout.write('  FAIL ' + id + ' ' + name + '\n'); }
    }
  } finally {
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  process.stdout.write('261127-bnd intel-gate: ' + p + ' passed, ' + f + ' failed\n');
  for (const m of failures) process.stdout.write('    ' + m.slice(0, 600) + '\n');
  if (FETCH_CALLS !== 0) process.stdout.write('    fetch calls: ' + FETCH_CALLS + ' (want 0)\n');
  process.exit(f || FETCH_CALLS ? 1 : 0);
}

main();
