#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 383 Plan 02 Task 1 (QA383-02, QA383-03). Wave 0, RED-first.
 *
 * The no-room session must route a stated method need to a method (Mode 1 stops saying "no methodology
 * routing"), must say that nothing from the talk is remembered, and Larry must name missing room tools.
 *
 *   N1  Mode 1 paragraph of the Mode Behavior string: new routing words present, old refusal words gone (RED)
 *   N2  no-room branch text says `nothing from this talk is remembered` (RED)
 *   N3  agents/larry-extended.md says `nothing from this talk is remembered` and `room tools are missing` (RED)
 *   N4  guard: /mos:scientific-roadmap is in the command registry and is model-invocable
 *   N5  report: the size of the model-invocable listing (entries and description characters)
 *   N6  guard: bash -n scripts/session-start
 *
 * Hermetic: HOME and the rooms variables point into one mkdtemp dir. Nothing is written outside it.
 * Output: one PASS, FAIL or PENDING line per leg, then a last line PASS: n FAIL: n PENDING: n.
 * House rule: hyphens only.
 */

const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const H = require('./helpers/harness-383.cjs');
const { env } = H.hermeticEnv('routing');
H.applyEnv(env);

const ROOT = path.resolve(__dirname, '..');
const R = H.reporter('test-383-no-room-routing');

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

const SESSION_START = read('scripts/session-start');
const LARRY = read('agents/larry-extended.md');

// The line of scripts/session-start that holds the Mode Behavior string.
const modeLine = SESSION_START.split('\n').find(function (l) { return l.indexOf('## Mode Behavior Instructions') !== -1; }) || '';
// The lines from MODE_MENU= to the Mode Behavior line (the whole no-room branch text).
const allLines = SESSION_START.split('\n');
const menuIdx = allLines.findIndex(function (l) { return /^\s*MODE_MENU=/.test(l); });
const modeIdx = allLines.findIndex(function (l) { return l.indexOf('## Mode Behavior Instructions') !== -1; });
const branchText = menuIdx >= 0 && modeIdx >= menuIdx ? allLines.slice(menuIdx, modeIdx + 1).join('\n') : '';

// ---- N1
(function () {
  const a = modeLine.indexOf('**Mode 1 (Just Talk):**');
  const b = modeLine.indexOf('**Mode 2');
  if (a < 0 || b < a) { R.fail('N1 Mode 1 paragraph found', 'could not extract the Mode 1 paragraph from scripts/session-start'); return; }
  const para = modeLine.slice(a, b);
  const need = ['names a method need', 'I know what I want, I need the how', 'offer /mos:new-project'];
  const gone = ['No methodology routing', 'Do NOT suggest /mos:new-project unprompted'];
  const missing = need.filter(function (s) { return para.indexOf(s) === -1; });
  const present = gone.filter(function (s) { return para.indexOf(s) !== -1; });
  if (missing.length === 0 && present.length === 0) R.pass('N1 Mode 1 paragraph routes a stated method need');
  else R.fail('N1 Mode 1 paragraph routes a stated method need',
    'missing: ' + JSON.stringify(missing) + '; still present: ' + JSON.stringify(present));
})();

// ---- N2
if (branchText.indexOf('nothing from this talk is remembered') !== -1) R.pass('N2 no-room branch says nothing is remembered');
else R.fail('N2 no-room branch says nothing is remembered', 'phrase absent from the lines MODE_MENU= to the Mode Behavior line (' + branchText.split('\n').length + ' lines read)');

// ---- N3
(function () {
  const need = ['nothing from this talk is remembered', 'room tools are missing'];
  const missing = need.filter(function (s) { return LARRY.indexOf(s) === -1; });
  if (missing.length === 0) R.pass('N3 larry-extended names the no-room limit and missing room tools');
  else R.fail('N3 larry-extended names the no-room limit and missing room tools', 'missing in agents/larry-extended.md: ' + JSON.stringify(missing));
})();

// ---- N4 guard
(function () {
  let reg;
  try { reg = JSON.parse(read('data/command-registry.json')); } catch (e) { R.fail('N4 scientific-roadmap is registered and model-invocable', 'registry unreadable: ' + e.message); return; }
  const found = Array.isArray(reg.commands) && reg.commands.some(function (c) { return c && c.command === '/mos:scientific-roadmap'; });
  const fm = frontmatter(read('commands/scientific-roadmap.md'));
  const disabled = /^disable-model-invocation:\s*true\s*$/m.test(fm);
  if (found && !disabled) R.pass('N4 guard: scientific-roadmap is registered and model-invocable');
  else R.fail('N4 guard: scientific-roadmap is registered and model-invocable', 'in registry: ' + found + '; disable-model-invocation: ' + disabled);
})();

// ---- N5 report
function frontmatter(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return '';
  const end = lines.indexOf('---', 1);
  return end < 0 ? '' : lines.slice(1, end).join('\n');
}

function descriptionChars(fm) {
  const lines = fm.split('\n');
  const i = lines.findIndex(function (l) { return /^description:/.test(l); });
  if (i < 0) return 0;
  const rest = lines[i].replace(/^description:\s*/, '');
  if (/^[>|][+-]?\s*$/.test(rest)) {
    let total = 0;
    for (let j = i + 1; j < lines.length; j++) {
      if (!/^\s+\S/.test(lines[j])) break;
      total += lines[j].trim().length;
    }
    return total;
  }
  let v = rest.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v.length;
}

(function () {
  const files = [];
  const cmdDir = path.join(ROOT, 'commands');
  for (const f of fs.readdirSync(cmdDir)) if (f.endsWith('.md')) files.push(path.join(cmdDir, f));
  const skDir = path.join(ROOT, 'skills');
  for (const d of fs.readdirSync(skDir)) {
    const p = path.join(skDir, d, 'SKILL.md');
    if (fs.existsSync(p)) files.push(p);
  }
  let entries = 0;
  let chars = 0;
  for (const f of files) {
    const fm = frontmatter(fs.readFileSync(f, 'utf8'));
    if (/^disable-model-invocation:\s*true\s*$/m.test(fm)) continue;
    entries += 1;
    chars += descriptionChars(fm);
  }
  console.log('LISTING entries=' + entries + ' description_chars=' + chars + ' method=commands/*.md+skills/*/SKILL.md minus disable-model-invocation');
  R.pass('N5 report: listing size measured');
})();

// ---- N6 guard
(function () {
  const r = cp.spawnSync('bash', ['-n', path.join(ROOT, 'scripts', 'session-start')], { encoding: 'utf8', env: env });
  if (r.status === 0) R.pass('N6 guard: bash -n scripts/session-start exits 0');
  else R.fail('N6 guard: bash -n scripts/session-start exits 0', 'exit ' + r.status + ' ' + String(r.stderr || '').slice(0, 200));
})();

R.done();
