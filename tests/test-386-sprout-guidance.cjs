#!/usr/bin/env node
'use strict';

/**
 * Phase 386 plan 43 (E-SPROUT-GUIDE): doc test for the sprout guidance.
 *
 * The persona skill, the Brain connector skill, the Brain query patterns
 * reference and the brain-query agent each tell the model that composes a Brain
 * call to send sprouts and never a body, and what to do when a call is refused
 * with sprouts_required. The route name is read from the sprout_route line of
 * the plan 386-42 RCA, never hard coded. Arm SG5 pins the 2000 byte runtime
 * instructions and the skill mirrors (they must not change).
 *
 * Node built-ins only. No em dash, no en dash.
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const RCA = path.join(REPO, '.planning', 'debug', 'part8-no-split-route-for-bodies-and-private-claims.md');
const CLAIM_TYPES = ['fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption'];
const RULE = /sprouts? and never a body/i;

function read(rel) { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }
function check(cond, msg) { if (!cond) throw new Error(msg); }
function routeName() {
  const m = fs.readFileSync(RCA, 'utf8').match(/^sprout_route: (.+)$/m);
  check(m, 'RCA has no sprout_route line');
  return m[1].trim();
}
// Lines from the first line that matches startRe up to (not including) the
// next line that matches endRe. Empty string when the start is missing.
function slice(text, startRe, endRe) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => startRe.test(l));
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (endRe.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

const arms = [];
function arm(label, fn) { arms.push({ label: label, fn: fn }); }

arm('SG1', () => {
  const route = routeName();
  const sec = slice(read('skills/larry-personality/SKILL.md'), /^##+ Composing a Brain call/, /^## /);
  check(sec.length > 0, 'no heading that starts "Composing a Brain call"');
  ['sprouts_required', 'claim_write', route].forEach((w) => check(sec.indexOf(w) !== -1, 'section lacks ' + w));
  CLAIM_TYPES.forEach((t) => check(sec.indexOf(t) !== -1, 'section lacks claim type ' + t));
  check(/12 words/.test(sec), 'section lacks the 12 words limit');
  check(RULE.test(sec), 'section lacks the rule "sprouts and never a body"');
});

arm('SG2', () => {
  const sec = slice(read('references/brain/query-patterns.md'), /^## How to Use/, /^(## |---)/);
  check(sec.length > 0, 'no section How to Use');
  check(RULE.test(sec), 'How to Use lacks the sprout rule');
  ['sprouts_required', 'claim_write'].forEach((w) => check(sec.indexOf(w) !== -1, 'How to Use lacks ' + w));
});

arm('SG3', () => {
  const sec = slice(read('agents/brain-query.md'), /^2\.\s+\*\*Execute\*\*/, /^3\.\s+\*\*/);
  check(sec.length > 0, 'no Execute step');
  check(RULE.test(sec), 'Execute step lacks the sprout rule');
  ['sprouts_required', 'claim_write'].forEach((w) => check(sec.indexOf(w) !== -1, 'Execute step lacks ' + w));
});

arm('SG4', () => {
  const sec = slice(read('skills/brain-connector/SKILL.md'), /^## Primary Tool: brain_ask/, /^## /);
  check(sec.length > 0, 'no section Primary Tool: brain_ask');
  check(sec.indexOf('sprouts_required') !== -1, 'section lacks sprouts_required');
  check(RULE.test(sec), 'section lacks the sprout rule');
});

arm('SG5', () => {
  const len = cp.execFileSync(process.execPath, ['-e', "process.stdout.write(String(Buffer.byteLength(require('./lib/mcp/runtime-instructions.cjs').RUNTIME_INSTRUCTIONS,'utf8')))"], { cwd: REPO, encoding: 'utf8' });
  check(len === '2000', 'runtime instructions must be exactly 2000 bytes, got ' + len);
  const r = cp.spawnSync(process.execPath, ['scripts/build-skill-mirrors.cjs', '--check'], { cwd: REPO, encoding: 'utf8' });
  check(r.status === 0, 'node scripts/build-skill-mirrors.cjs --check exits 0, got ' + r.status);
});

let failed = 0;
arms.forEach((a) => {
  try {
    a.fn();
    process.stdout.write('ok - ' + a.label + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('FAIL - ' + a.label + ': ' + String(e && e.message ? e.message : e).split('\n')[0] + '\n');
  }
});
process.stdout.write(failed === 0 ? 'ALL PASS\n' : failed + ' arm(s) failed\n');
process.exit(failed === 0 ? 0 : 1);
