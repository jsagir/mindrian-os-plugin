#!/usr/bin/env node
'use strict';
// Phase 399-04: no network, no vendor host, no key under lib/core/decision-advisor/ (FN1, FN3 mutation control);
// no non-comment line under lib/ or hooks/ names a 399 dev script (FN2).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FENCED = path.join(ROOT, 'lib', 'core', 'decision-advisor');

let failed = 0;
let passed = 0;
function check(label, ok, detail) {
  if (ok) {
    passed += 1;
    console.log('ok: ' + label);
  } else {
    failed += 1;
    console.log('FAIL: ' + label + (detail ? ' -- ' + detail : ''));
  }
}

function listFiles(dir, out) {
  out = out || [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}

function isPureLineComment(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

const REQUIRE_BANNED = /(?:require|import)\s*\(?\s*['"](?:node:)?(?:http|https|net|tls|undici)['"]|(?:require|import)\s*\(?\s*['"][^'"]*brain-client[^'"]*['"]|(?:require|import)\s*\(?\s*['"][^'"]*\bscripts\/[^'"]*['"]/;
const ENV_READ = /process\s*\.\s*env\s*(?:\.\s*([A-Za-z_][A-Za-z0-9_]*)|\[)/g;
const LITERALS = ['api.typesafe.ai', 'generativelanguage', '_API_KEY', 'fetch('];

// Returns a list of violation strings for one file's raw text. Comments are scanned too.
function fenceViolations(raw) {
  const hits = [];
  for (const lit of LITERALS) if (raw.indexOf(lit) !== -1) hits.push('literal ' + lit);
  if (REQUIRE_BANNED.test(raw)) hits.push('banned require');
  let m;
  ENV_READ.lastIndex = 0;
  while ((m = ENV_READ.exec(raw)) !== null) {
    if (!m[1] || m[1].indexOf('MINDRIAN_DECISION_ADVISOR') !== 0) hits.push('env read ' + (m[1] || '[...]'));
  }
  return hits;
}

// FN1
{
  const files = listFiles(FENCED);
  check('FN1: the scan is not vacuous (at least 5 files: 4 modules and ROOM.md)', files.length >= 5, String(files.length));
  const bad = [];
  for (const f of files) {
    const v = fenceViolations(fs.readFileSync(f, 'utf8'));
    for (const x of v) bad.push(path.relative(ROOT, f) + ': ' + x);
  }
  check('FN1: no network module, vendor host, key name, env read, scripts/ require or fetch under lib/core/decision-advisor/', bad.length === 0, bad.join('; '));
}

// FN2
{
  const DEV_NAMES = [
    'decision-advisor-transport',
    'derive-decision-fixture',
    'build-decision-advisor-table',
    'refresh-run-step-capabilities',
    'bench-decision-routing',
  ];
  const files = []
    .concat(listFiles(path.join(ROOT, 'lib')))
    .concat(listFiles(path.join(ROOT, 'hooks')))
    .filter((f) => /\.(cjs|js|mjs|ts|sh|json)$/.test(f));
  const hits = [];
  for (const f of files) {
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      if (isPureLineComment(line)) continue;
      for (const n of DEV_NAMES) if (line.indexOf(n) !== -1) hits.push(path.relative(ROOT, f) + ' names ' + n);
    }
  }
  check('FN2: no non-comment line under lib/ or hooks/ names a 399 dev script (' + files.length + ' files)', hits.length === 0, hits.slice(0, 5).join('; '));
  check('FN2: the scan is not vacuous (more than 20 files)', files.length > 20);
}

// FN3 mutation control: a scratch file with a key read must be caught by the same check, then removed.
{
  const scratch = path.join(FENCED, '__scratch_399_fence.cjs');
  let caught = false;
  try {
    fs.writeFileSync(scratch, "'use strict';\nconst x = process.env.GEMINI_API_KEY;\nmodule.exports = { x };\n");
    const v = fenceViolations(fs.readFileSync(scratch, 'utf8'));
    caught = v.some((s) => s.indexOf('env read GEMINI_API_KEY') === 0) && v.indexOf('literal _API_KEY') !== -1;
    const whole = listFiles(FENCED).some((f) => fenceViolations(fs.readFileSync(f, 'utf8')).length > 0);
    caught = caught && whole;
  } finally {
    try { fs.unlinkSync(scratch); } catch (_e) { /* tolerant */ }
  }
  check('FN3: a scratch file reading GEMINI_API_KEY is caught by the FN1 scan', caught);
  check('FN3: the scratch file is removed', !fs.existsSync(scratch));
  // Second control: a network require and a vendor host are caught.
  check('FN3: a node:https require is caught', fenceViolations("const h = require('node:https');").length > 0);
  check('FN3: an env read of a MINDRIAN_DECISION_ADVISOR name is allowed', fenceViolations('const a = process.env.MINDRIAN_DECISION_ADVISOR_ON;').length === 0);
  check('FN3: a bracket env read is caught', fenceViolations("const a = process.env['X'];").length > 0);
}

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
console.log('>>> test-399-advisor-fence.cjs: PASSED');
