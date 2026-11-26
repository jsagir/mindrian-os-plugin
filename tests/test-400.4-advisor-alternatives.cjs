#!/usr/bin/env node
'use strict';
// Phase 400.4 plan 02 (QA-F4): with the decision advisor on and a shortlist state ok or no_strong_pick, the alternatives
// of composeNextMove are the shortlist options in order, minus the primary; ledger moves follow. The primary is unchanged.
//
// Legs N1 to N8:
//   N1 the QA repro: advisor rank 2 (analyze-systems) is offered; the ledger move follows it.
//   N2 a shortlist whose only option is the primary: the alternatives equal the base alternatives.
//   N3 an option that is not a command on this install, or that ran to a verified result, is never offered.
//   N4 a top tie (no_strong_pick, unordered): the tied group in public order, minus the primary, then the ledger order.
//   N5 advisor off: the output equals the base output byte for byte.
//   N6 the primary equals the base primary for the same input (advisor on).
//   N7 an advisor alternative lists 'the decision advisor' in its sources; no why string holds a decimal number.
//   N8 the chaotic domain (effect no_fit) keeps the base alternatives.
// The base is lib/core/feyminto/next-move.cjs at b0b71ecc5, read from git (the precedent of test-400-advisor-consumers).
// Node built-ins only. No network. Never reads a real room. Hyphens only in this file.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'b0b71ecc5';
delete process.env.MINDRIAN_DECISION_ADVISOR;
delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;

let failed = 0;
let passed = 0;
function check(label, fn) {
  try { fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e))); }
}
function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return fn(); } finally { for (const k of Object.keys(vars)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
}

const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
const PR = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-400.4-02-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

function loadBase(rel) {
  const r = spawnSync('git', ['show', BASE + ':' + rel], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) return null;
  const realDir = path.dirname(path.join(ROOT, rel));
  const src = r.stdout
    .replace(/require\((['"])(\.\.?\/[^'"]+)\1\)/g, (_m, _q, p) => 'require(' + JSON.stringify(path.resolve(realDir, p)) + ')')
    .replace(/\b__dirname\b/g, JSON.stringify(realDir));
  const file = path.join(TMP, 'base-' + path.basename(rel));
  fs.writeFileSync(file, src);
  return require(file);
}
const NM0 = loadBase('lib/core/feyminto/next-move.cjs');

const ON = { MINDRIAN_DECISION_ADVISOR: 'on' };
const OFF = { MINDRIAN_DECISION_ADVISOR: undefined };
const JOB = 'find-problem'; // beautiful-question, analyze-systems, causal and user-needs all serve it in the registry
const BQ = 'beautiful-question';
const AS = 'analyze-systems';
const CA = 'causal';
const UN = 'user-needs';

const capabilityFor = () => ({ known: true, cli: 'runnable', mcp: 'runnable', label: 'runnable (test)' });
const sel = (state, options, extra) => Object.assign({
  state, key_used: '*', no_strong_pick: state === 'no_strong_pick', top_tie: options.length ? 1 : 0, table_version: '400-4-vT',
  options: options.map((o, i) => ({ command: '/mos:' + o[0], band: o[1], rank: i + 1, calibrated: o[2] })),
}, extra || {});
const ledger = (names) => [{ source: 'section_ledger', items: names.map((n) => ({ id: '/mos:' + n })) }];
// jobFit puts the three non-rank-2 commands level, so the advisor rank 2 command is the one the base slice cuts off.
const JOBFIT = { [BQ]: 2, [CA]: 2, [UN]: 2, [AS]: 0 };
function input(extra) {
  return Object.assign({
    jobId: JOB, jobFit: JOBFIT, surface: 'mcp', face: { asked: false, commands: [] },
    ledgerCandidates: ledger([CA, UN]), attempted: [], need: {}, capabilityFor, sources: null,
  }, extra || {});
}
const order = (m) => (m.primary ? [m.primary.command] : []).concat(m.alternatives.map((a) => a.command));
const alts = (m) => m.alternatives.map((a) => a.command);

const SL_REPRO = sel('ok', [[BQ, 'strong', 0.95], [AS, 'strong', 0.9], [CA, 'possible', 0.6]]);
const SL_ONLY_PRIMARY = sel('ok', [[BQ, 'strong', 0.95]]);
const SL_TIE = sel('ok', [[BQ, 'strong', 1], [AS, 'strong', 1], [CA, 'strong', 1]], { top_tie: 3 });

check('fixture: the base module loads and the registry has the four commands', () => {
  assert.ok(NM0 && typeof NM0.composeNextMove === 'function', 'base next-move.cjs loads from git ' + BASE);
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands;
  [BQ, AS, CA, UN].forEach((n) => {
    const e = reg.find((c) => c.command === '/mos:' + n);
    assert.ok(e && e.serves_jtbd.indexOf(JOB) !== -1, n + ' serves ' + JOB);
  });
});

check('N1 repro: alternatives are advisor rank 2 then rank 3, not the ledger moves', () => {
  withEnv(ON, () => {
    const base = NM0.composeNextMove(input({ advisorShortlist: SL_REPRO }));
    assert.deepEqual(alts(base), [CA, UN], 'the base drops advisor rank 2 (the QA-F4 defect)');
    const m = NM.composeNextMove(input({ advisorShortlist: SL_REPRO }));
    assert.equal(m.primary.command, BQ);
    assert.deepEqual(alts(m), [AS, CA]);
  });
});

check('N2 a shortlist whose only option is the primary: the alternatives equal the base alternatives', () => {
  withEnv(ON, () => {
    const base = NM0.composeNextMove(input({ advisorShortlist: SL_ONLY_PRIMARY }));
    const m = NM.composeNextMove(input({ advisorShortlist: SL_ONLY_PRIMARY }));
    assert.equal(m.primary.command, BQ);
    assert.deepEqual(alts(m), alts(base));
    assert.deepEqual(alts(m), [CA, UN]);
    assert.equal(JSON.stringify(m), JSON.stringify(base));
  });
});

check('N3 an option that is not a command here, or that already ran verified, is skipped', () => {
  withEnv(ON, () => {
    const noAs = (name, o) => (name === AS ? { known: false } : capabilityFor(name, o));
    const m = NM.composeNextMove(input({ advisorShortlist: SL_REPRO, capabilityFor: noAs }));
    assert.equal(m.primary.command, BQ);
    assert.deepEqual(alts(m), [CA, UN], 'analyze-systems is not a command here: never offered');
    const nullCap = (name, o) => (name === AS ? null : capabilityFor(name, o));
    assert.deepEqual(alts(NM.composeNextMove(input({ advisorShortlist: SL_REPRO, capabilityFor: nullCap }))), [CA, UN]);
    const done = NM.composeNextMove(input({ advisorShortlist: SL_REPRO, attempted: [{ command: '/mos:' + CA, status: 'terminal', verified: true }] }));
    assert.equal(done.primary.command, BQ);
    assert.deepEqual(alts(done), [AS, UN], 'causal ran to a verified result: never offered; the ledger move follows');
    const all = [done.primary].concat(done.alternatives).map((x) => x.command);
    assert.equal(all.indexOf(CA), -1);
  });
});

check('N4 a top tie: alternatives follow the tied group in public order, minus the primary, then the ledger order', () => {
  withEnv(ON, () => {
    const inp = input({ advisorShortlist: SL_TIE, sources: { contract: { names: [BQ] }, navigator_table: { names: [] } } });
    const base = NM0.composeNextMove(inp);
    const m = NM.composeNextMove(inp);
    assert.equal(m.advisor.state, 'no_strong_pick');
    assert.equal(m.advisor.unordered, true);
    assert.equal(m.primary.command, base.primary.command);
    const pub = m.advisor.options.map((o) => o.command.replace(/^\/mos:/, ''));
    const expected = pub.filter((n) => n !== m.primary.command)
      .concat(order(base).filter((n) => n !== base.primary.command && pub.indexOf(n) === -1))
      .slice(0, 2);
    assert.deepEqual(alts(m), expected);
    assert.equal(PR.hasRawNumber(m.advisor), false);
  });
});

check('N5 advisor off: the output equals the base output byte for byte', () => {
  withEnv(OFF, () => {
    [SL_REPRO, SL_ONLY_PRIMARY, SL_TIE, undefined].forEach((s, i) => {
      const inp = input({ advisorShortlist: s });
      assert.equal(JSON.stringify(NM.composeNextMove(inp)), JSON.stringify(NM0.composeNextMove(inp)), 'case ' + i);
    });
    withEnv({ MINDRIAN_DECISION_ADVISOR: 'ON' }, () => {
      const inp = input({ advisorShortlist: SL_REPRO });
      assert.equal(JSON.stringify(NM.composeNextMove(inp)), JSON.stringify(NM0.composeNextMove(inp)), 'not exactly on');
    });
  });
});

check('N6 the primary equals the base primary for N1, N2 and N4 (advisor on)', () => {
  withEnv(ON, () => {
    [input({ advisorShortlist: SL_REPRO }), input({ advisorShortlist: SL_ONLY_PRIMARY }), input({ advisorShortlist: SL_TIE, sources: { contract: { names: [BQ] }, navigator_table: { names: [] } } })].forEach((inp, i) => {
      const base = NM0.composeNextMove(inp);
      const m = NM.composeNextMove(inp);
      assert.equal(JSON.stringify(m.primary), JSON.stringify(base.primary), 'case ' + i);
      assert.equal(m.why, base.why, 'case ' + i);
    });
  });
});

check('N7 an advisor alternative names the decision advisor; no why string holds a decimal number', () => {
  withEnv(ON, () => {
    const m = NM.composeNextMove(input({ advisorShortlist: SL_REPRO }));
    const a = m.alternatives.find((x) => x.command === AS);
    assert.ok(a, 'analyze-systems is offered');
    assert.ok(a.sources.indexOf('the decision advisor') !== -1, a.sources.join(', '));
    const c = m.alternatives.find((x) => x.command === CA);
    assert.ok(c.sources.indexOf('the decision advisor') !== -1, 'a ledger move the advisor also lists names the advisor too');
    [m.primary].concat(m.alternatives).forEach((x) => assert.equal(PR.hasRawNumber(x.why), false, x.why));
    assert.equal(/\d\.\d/.test(JSON.stringify(m.alternatives.map((x) => x.why))), false);
    const t = NM.toTierCandidates(m);
    assert.deepEqual(t[0].items.map((i) => i.id), [BQ, AS, CA], 'decide() gets the same alternatives');
  });
});

check('N8 the chaotic domain (effect no_fit) keeps the base alternatives: the table is not an order there', () => {
  withEnv(ON, () => {
    const chaotic = sel('no_strong_pick', [[BQ, 'strong', 0.95], [AS, 'strong', 0.9]], { domain: { id: 'chaotic', effect: 'no_fit', fits: [] } });
    const base = NM0.composeNextMove(input({ advisorShortlist: chaotic }));
    const m = NM.composeNextMove(input({ advisorShortlist: chaotic }));
    assert.equal(m.advisor.domain.effect, 'no_fit');
    assert.deepEqual(alts(m), alts(base));
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
