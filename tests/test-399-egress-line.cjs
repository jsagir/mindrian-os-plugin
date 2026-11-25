#!/usr/bin/env node
'use strict';
// Phase 399 plan 05 task 1 (I-11): the decision_advisor egress line is declared, off by default,
// and a room override cannot widen it.
//   E1  line present, allowed false
//   E2  a room override cannot turn it on (named in ignored); one turning it off keeps it off
//   E3  offline keeps it off
//   E4  lineForProvider maps gemini_decision and jev_decision; typesafe stays judge_jev
//   E5  entry shape: endpoint, default, scope, providers, paths; scope names D-03 and the Deferred ruling
// No network. Hyphens only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const egress = require(path.join(REPO, 'lib/core/research-planner/egress-policy.cjs'));
const LINE = 'decision_advisor';
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-399-egress-'));
let pass = 0;
let fail = 0;
function leg(name, fn) {
  let ok;
  try { ok = fn(); } catch (e) { ok = 'threw: ' + String(e && e.message); }
  if (ok === true) { pass += 1; console.log('PASS: ' + name); } else { fail += 1; console.log('FAIL: ' + name + ' (' + String(ok) + ')'); }
}
function mkRoom(name, override) {
  const dir = path.join(scratch, name);
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  if (override) fs.writeFileSync(path.join(dir, '.mindrian', 'egress-policy.json'), JSON.stringify(override));
  return dir;
}

try {
  leg('E1 decision_advisor line exists and is off', () => {
    const p = egress.loadEgressPolicy(mkRoom('e1'));
    return (Object.prototype.hasOwnProperty.call(p.lines, LINE) && p.lines[LINE].allowed === false && egress.lineAllowed(p, LINE) === false) || JSON.stringify(p.lines[LINE]);
  });
  leg('E2 a room override cannot turn it on; an off override keeps it off', () => {
    const on = egress.loadEgressPolicy(mkRoom('e2a', { lines: { [LINE]: { default: true } } }));
    const named = on.ignored.some((x) => /decision_advisor/.test(String(x)));
    const off = egress.loadEgressPolicy(mkRoom('e2b', { lines: { [LINE]: { default: false } } }));
    return (egress.lineAllowed(on, LINE) === false && named && egress.lineAllowed(off, LINE) === false) || JSON.stringify({ ignored: on.ignored });
  });
  leg('E3 offline keeps it off', () => {
    const p = egress.loadEgressPolicy(mkRoom('e3'), { offline: true });
    return egress.lineAllowed(p, LINE) === false || 'allowed offline';
  });
  leg('E4 provider mapping', () => {
    const got = ['gemini_decision', 'jev_decision', 'decision_relay', 'typesafe'].map(egress.lineForProvider).join(',');
    return got === 'decision_advisor,decision_advisor,decision_advisor,judge_jev' || got;
  });
  leg('E5 entry shape and scope text', () => {
    const doc = JSON.parse(fs.readFileSync(path.join(REPO, 'data/egress-policy.json'), 'utf8'));
    const e = doc.lines[LINE];
    if (!e) return 'no entry';
    const keys = Object.keys(e).sort().join(',');
    const pathsOk = e.paths && Object.keys(e.paths).sort().join(',') === 'decision_relay,gemini_decision,jev_decision' && e.paths.decision_relay === '/v1/decide' && e.paths.jev_decision === '/v1/systemone' &&
      (e.paths.gemini_decision === null || typeof e.paths.gemini_decision === 'string');
    const scopeOk = /D-03/.test(e.scope) && /labels only/.test(e.scope) && /user access/.test(e.scope) && /Deferred/.test(e.scope);
    return (keys === 'default,endpoint,paths,providers,scope' && e.default === false && pathsOk && scopeOk && e.providers.join(',') === 'gemini_decision,jev_decision,decision_relay') || JSON.stringify({ keys, pathsOk, scopeOk });
  });
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
console.log('--- test-399-egress-line ---');
console.log('PASS: ' + pass + ' FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);
