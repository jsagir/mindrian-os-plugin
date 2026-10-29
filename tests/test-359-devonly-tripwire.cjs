#!/usr/bin/env node
/**
 * Phase 359 Plan 08 Task 2: the dev-only and vendor tripwires.
 *
 * Gates FORK359-09, FORK359-10 (SPEC R9 and R10; threat T-359-38).
 *
 * The 359 and 357 measuring tools (forward harness, permission probe,
 * moonshot scorer, replay, corpus loader, labeler) are DEV-TIME scripts.
 * They must never be reachable from a runtime path (lib/ or hooks/), must
 * never name the vendor host, and the live forward harness must never run in
 * CI. Each leg is a source scan with pure comment lines excluded, and each
 * prints its own scanned-file count so a silent zero-file scan cannot pass.
 *
 * Legs:
 *   D1 no non-comment line under lib/ or hooks/ names a dev script
 *   D2 no file under lib/ or hooks/ contains api.typesafe.ai
 *   D3 hooks/hooks.json names no dev script
 *   D4 lib/core/fork-declaration.cjs requires only ../hmi/voice-color-mark.cjs
 *   D5 package.json scripts and .github/workflows never name a live 359 script
 *
 * Test hygiene: no network, no spawn, reads source only; nothing is written.
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

let PASS = 0;
let FAIL = 0;
function check(label, cond, detail) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label + (detail ? ' -- ' + detail : '')); }
}

const DEV_SCRIPTS = [
  'forward-fork-scenarios-359',
  'fork359-permission-probe',
  'score-moonshots-359',
  'replay-card-fire',
  'card-fire-replay-corpus',
  'label-card-fire-replay',
];
const LIVE_359_SCRIPTS = [
  'forward-fork-scenarios-359',
  'fork359-permission-probe',
  'score-moonshots-359',
];
const SCAN_EXT = new Set(['.cjs', '.js', '.mjs', '.sh', '.json']);

function isPureLineComment(line, ext) {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return true;
  if (ext === '.sh' && t.startsWith('#')) return true;
  return false;
}

function listFilesRecursive(dirAbs, out) {
  out = out || [];
  let entries;
  try { entries = fs.readdirSync(dirAbs, { withFileTypes: true }); } catch (_e) { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dirAbs, e.name);
    if (e.isDirectory()) listFilesRecursive(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

function nonCommentLines(fileAbs) {
  const ext = path.extname(fileAbs);
  let raw;
  try { raw = fs.readFileSync(fileAbs, 'utf8'); } catch (_e) { return []; }
  return raw.split(/\r?\n/).filter(function (l) { return !isPureLineComment(l, ext); });
}

const runtimeFiles = []
  .concat(listFilesRecursive(path.join(REPO, 'lib')))
  .concat(listFilesRecursive(path.join(REPO, 'hooks')))
  .filter(function (f) { return SCAN_EXT.has(path.extname(f)); });

console.log('test-359-devonly-tripwire');
console.log('scanned ' + runtimeFiles.length + ' runtime files under lib/ and hooks/');
check('scan is not vacuous (more than 20 runtime files)', runtimeFiles.length > 20);

// D1
{
  const hits = [];
  for (const f of runtimeFiles) {
    for (const line of nonCommentLines(f)) {
      for (const name of DEV_SCRIPTS) {
        if (line.indexOf(name) !== -1) hits.push(path.relative(REPO, f) + ' names ' + name);
      }
    }
  }
  check('D1: no non-comment line under lib/ or hooks/ names a 359 or 357 dev script', hits.length === 0, hits.slice(0, 5).join('; '));
}

// D2
{
  const allRuntime = []
    .concat(listFilesRecursive(path.join(REPO, 'lib')))
    .concat(listFilesRecursive(path.join(REPO, 'hooks')));
  const hits = [];
  for (const f of allRuntime) {
    let raw = '';
    try { raw = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
    if (raw.indexOf('api.typesafe.ai') !== -1) hits.push(path.relative(REPO, f));
  }
  check('D2: api.typesafe.ai appears nowhere under lib/ or hooks/ (' + allRuntime.length + ' files)', hits.length === 0, hits.slice(0, 5).join('; '));
}

// D3
{
  const hooksJson = path.join(REPO, 'hooks', 'hooks.json');
  let raw = '';
  try { raw = fs.readFileSync(hooksJson, 'utf8'); } catch (_e) { raw = ''; }
  check('D3: hooks/hooks.json exists and is non-empty', raw.length > 0);
  const hits = DEV_SCRIPTS.filter(function (n) { return raw.indexOf(n) !== -1; });
  check('D3: hooks/hooks.json names no dev script', hits.length === 0, hits.join(', '));
}

// D4
{
  const fdPath = path.join(REPO, 'lib', 'core', 'fork-declaration.cjs');
  const lines = nonCommentLines(fdPath);
  check('D4: lib/core/fork-declaration.cjs exists', lines.length > 0);
  const reqs = [];
  const re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const line of lines) {
    let m;
    while ((m = re.exec(line)) !== null) reqs.push(m[1]);
  }
  const allowed = new Set(['../hmi/voice-color-mark.cjs']);
  const extra = reqs.filter(function (r) { return !allowed.has(r); });
  check('D4: fork-declaration.cjs requires only ../hmi/voice-color-mark.cjs (found ' + reqs.length + ')', extra.length === 0, extra.join(', '));
}

// D5
{
  let pkg = {};
  try { pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')); } catch (_e) { pkg = {}; }
  const scriptValues = Object.values(pkg.scripts || {}).map(String);
  const pkgHits = [];
  for (const v of scriptValues) {
    for (const n of LIVE_359_SCRIPTS) if (v.indexOf(n) !== -1) pkgHits.push('package.json scripts names ' + n);
  }
  check('D5: package.json scripts (' + scriptValues.length + ') name no live 359 script', pkgHits.length === 0, pkgHits.join('; '));

  const wfDir = path.join(REPO, '.github', 'workflows');
  const wfFiles = listFilesRecursive(wfDir);
  const wfHits = [];
  for (const f of wfFiles) {
    let raw = '';
    try { raw = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
    for (const n of LIVE_359_SCRIPTS) if (raw.indexOf(n) !== -1) wfHits.push(path.relative(REPO, f) + ' names ' + n);
  }
  check('D5: .github/workflows (' + wfFiles.length + ' files) never name a live 359 script', wfHits.length === 0, wfHits.join('; '));
}

console.log('');
console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
