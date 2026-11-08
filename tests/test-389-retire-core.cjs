#!/usr/bin/env node
// Phase 389 plan 10 (owner card D6 APPROVE): the old brief pipeline core is retired.
// This test pins that the core files are gone, that nothing requires, spawns or joins a
// path to them, that the telemetry rule holds, that the two test runners list only live
// files, and that the room naming integration test no longer reads the orchestrator.
// Node built-ins only. Plain counters. Hyphens only. Exit 1 on a failure.
//
// Telemetry finding (Task 1, PROVEN by reading the code): a reader of the legacy file
// ~/.mindrian/telemetry/v1.13/mva.jsonl REMAINS after this plan. scripts/migrate-telemetry-v1.cjs
// (SOURCES[0], line 77) reads it and validates every row against lib/core/telemetry/schema.cjs
// (ALLOWED_FIELDS, validateEventPayload); a row whose event name left the schema is
// quarantined as unknown_event. So the six mva_* names stay frozen as history and the shim
// lib/core/mva-telemetry.cjs is removed. Test 4 pins exactly that outcome.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PHASE_DIR = path.join(ROOT, '.planning', 'phases', '389-pyramid-seed-and-full-replaces-the-mva-family');
let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log('ok   ' + name);
  } else {
    failed += 1;
    console.log('FAIL ' + name + (detail ? ' :: ' + detail : ''));
  }
}
const rel = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(rel(p));
const read = (p) => fs.readFileSync(rel(p), 'utf8');

// Files this plan removes (Task 2 step 4). lib/agents/mva is a folder.
const REMOVED = [
  'lib/core/mva-orchestrator.cjs',
  'lib/core/mva-orchestrator.test.cjs',
  'lib/core/mva-state.cjs',
  'lib/core/mva-progressive-renderer.cjs',
  'lib/core/mva-progressive-renderer.test.cjs',
  'lib/core/mva-telemetry.cjs',
  'lib/core/mva-telemetry.test.cjs',
  'scripts/mva-run.cjs',
  'lib/agents/mva',
  'data/mva-agent-prompts.json',
  'tests/test-mva-dror-harness.cjs',
];

// The seven tokens a caller would name (the card list).
const CORE_RE = /mva-orchestrator|mva-state|mva-progressive-renderer|mva-telemetry|mva-run|lib\/agents\/mva|mva-agent-prompts/;
const isCommentLine = (l) => /^\s*(\*|\/\/|#|\/\*)/.test(l);
function codeNames(text) {
  return text.split('\n').filter((l) => CORE_RE.test(l) && !isCommentLine(l));
}

// ---- Mutation arm: the finders are not vacuous ----
check('Mutation: the token finder flags a require of the orchestrator', codeNames("const o = require('./mva-orchestrator.cjs');").length === 1);
check('Mutation: the token finder flags a path join of mva-run', codeNames("path.join(__dirname, 'mva-run.cjs')").length === 1);
check('Mutation: the token finder flags the agents folder', codeNames("require('../agents/mva/index.cjs') // lib/agents/mva").length === 1);
check('Mutation: the token finder passes a comment line and a clean line', codeNames(' * see lib/core/mva-state.cjs\nconst a = 1;').length === 0);

// ---- Test 1: the removed files are gone ----
for (const f of REMOVED) {
  check('Test 1: ' + f + ' does not exist', !exists(f));
}

// ---- Test 2: the caller scan finds 0 callers of the seven tokens ----
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't389-10-scan-'));
  const out = path.join(tmp, 'scan.tsv');
  const r = cp.spawnSync('node', [path.join(PHASE_DIR, '389-caller-scan.cjs'), 'scan', '--out', out], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  check('Test 2: the caller scan runs', r.status === 0, (r.stderr || '').slice(0, 200));
  let rows = [];
  try { rows = fs.readFileSync(out, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t')); } catch (e) { /* reported by the next check */ }
  check('Test 2: the scan wrote rows', rows.length > 0);
  const TOKENS = new Set(['mva-orchestrator', 'mva-state', 'mva-progressive-renderer', 'mva-telemetry', 'mva-run', 'lib/agents/mva', 'mva-agent-prompts']);
  const callers = rows.filter((c) => TOKENS.has(c[0]) && ['require', 'spawn', 'path-string'].includes(c[3]));
  const outside = callers.filter((c) => !/^(\.planning|r-and-d|docs)\//.test(c[1]) && c[1] !== 'CHANGELOG.md');
  check('Test 2: 0 hits of class require, spawn or path-string for the seven core tokens', outside.length === 0,
    outside.map((c) => c[0] + ' in ' + c[1]).join('; '));
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

// ---- Test 3: the two test runners name only files that exist ----
{
  const sh = read('tests/run-all-118.sh');
  const entries = [];
  for (const l of sh.split('\n')) {
    const m = l.match(/^\s*(\.{1,2}\/[A-Za-z0-9_./-]+\.(cjs|sh))\s*$/);
    if (m) entries.push(m[1]);
  }
  check('Test 3: run-all-118.sh lists at least 8 suites', entries.length >= 8, String(entries.length));
  const missing = entries.filter((e) => !fs.existsSync(path.join(ROOT, 'tests', e)));
  check('Test 3: every suite of run-all-118.sh exists', missing.length === 0, missing.join(', '));
  check('Test 3: run-all-118.sh names no removed file', codeNames(sh.split('\n').filter((l) => !isCommentLine(l)).join('\n')).length === 0);
  const fey = read('lib/memory/run-feynman-tests.cjs');
  const paths = [];
  for (const l of fey.split('\n')) {
    if (isCommentLine(l)) continue;
    const m = l.match(/path\.join\(REPO_ROOT,\s*([^)]*)\)/);
    if (!m) continue;
    const parts = m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    if (CORE_RE.test(parts.join('/')) || /dror/.test(parts.join('/'))) paths.push(parts.join('/'));
  }
  check('Test 3: run-feynman-tests.cjs lists no removed test path', paths.length === 0, paths.join(', '));
}

// ---- Test 4: the telemetry rule (a reader remains, so the names stay frozen, the shim goes) ----
{
  const schema = read('lib/core/telemetry/schema.cjs');
  const NAMES = ['mva_pipeline_started', 'mva_agent_returned', 'mva_brief_rendered', 'mva_option_selected', 'mva_brief_deployed', 'mva_pipeline_failed'];
  check('Test 4: schema.cjs keeps all six mva_* names (a reader remains)', NAMES.every((n) => schema.indexOf("'" + n + "'") !== -1));
  check('Test 4: schema.cjs says the six names are frozen history', /frozen history/i.test(schema));
  check('Test 4: schema.cjs does not call lib/core/mva-telemetry.cjs a mirror source any more', !/must mirror lib\/core\/mva-telemetry/.test(schema));
  const doc = read('docs/TELEMETRY-SCHEMA.md');
  check('Test 4: docs/TELEMETRY-SCHEMA.md keeps the six names and says frozen history', NAMES.every((n) => doc.indexOf(n) !== -1) && /frozen history/i.test(doc));
  check('Test 4: docs/TELEMETRY-SCHEMA.md does not call the shim a live writer', !/Source: `lib\/core\/mva-telemetry\.cjs` shim/.test(doc));
  check('Test 4: the shim lib/core/mva-telemetry.cjs does not exist', !exists('lib/core/mva-telemetry.cjs'));
  // Fixture: one old line, read through every remaining reader without a throw.
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 't389-10-home-'));
  const v113 = path.join(tmpHome, '.mindrian', 'telemetry', 'v1.13');
  fs.mkdirSync(v113, { recursive: true });
  const old = { event: 'mva_pipeline_started', timestamp: '2026-05-10T12:00:00.000Z', sentence_sha256: 'a'.repeat(64) };
  fs.writeFileSync(path.join(v113, 'mva.jsonl'), JSON.stringify(old) + '\n');
  const savedHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    let res = null;
    let threw = null;
    try {
      const mig = require(rel('scripts/migrate-telemetry-v1.cjs'));
      res = mig.migrateOne(mig.SOURCES[0]);
    } catch (e) { threw = e; }
    check('Test 4: the migration reader takes the old line without a throw', threw === null, threw && threw.message);
    check('Test 4: the old line is migrated, not quarantined', res && res.migrated === 1 && res.quarantined === 0, JSON.stringify(res));
    check('Test 4: the user file is renamed by the migration, not deleted (backup stays)', fs.existsSync(path.join(v113, 'mva.jsonl.pre-v121.bak')));
    let eventCount = -1;
    threw = null;
    try {
      const consumer = require(rel('lab/apo/telemetry-consumer.cjs'));
      eventCount = consumer.readTelemetry(v113, { silent: true }).eventCount;
    } catch (e) { threw = e; }
    check('Test 4: the lab consumer reads the migrated shard with the old event without a throw', threw === null && eventCount === 1, threw ? threw.message : String(eventCount));
  } finally {
    process.env.HOME = savedHome;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
}

// ---- Test 5: the 12 challenge questions live in the Seed reference; the cells need no old agent ----
{
  const PROMPT_HEADS = [
    'How does the person who',
    'What does success look like',
    'If your strongest competitor copied',
    'What single assumption would, if',
    'Who would be furious if',
    'What would have to be',
    'Where is the smartest critic',
    'What part of this would',
    'If you had to ship',
    'What is the smallest experiment',
    'Whose calendar do you need',
    'What does the second version',
  ];
  const ref = read('references/methodology/structure-argument.md').replace(/\s+/g, ' ');
  const lost = PROMPT_HEADS.filter((h) => ref.indexOf(h) === -1);
  check('Test 5: the Seed reference holds all 12 summary heads', lost.length === 0, lost.join(' | '));
  const cells = read('lib/core/pyramid-seed-cells.cjs');
  check('Test 5: the Seed cells module requires nothing from lib/agents', !/require\([^)]*agents\//.test(cells));
}

// ---- Test 6: the live non-family files name no removed file as a thing to require or run ----
for (const f of ['scripts/first-install-router.cjs', 'scripts/session-start', 'lib/core/room-naming-selector.cjs']) {
  check('Test 6: ' + f + ' requires or runs none of the removed files', codeNames(read(f)).length === 0, codeNames(read(f)).join(' | ').slice(0, 200));
}

// ---- Test 7: no em dash or en dash in the files this plan touches ----
{
  const dashRe = new RegExp('[\\u2013\\u2014]');
  const TOUCHED = [
    'tests/test-389-retire-core.cjs',
    'tests/test-room-naming-selector-integration.cjs',
    'scripts/room-naming-selector.cjs',
    'lib/core/room-naming-selector.cjs',
    'lib/core/llm-name-suggester.cjs',
    'lib/core/navigation.cjs',
    'lib/core/telemetry/schema.cjs',
    'lib/core/telemetry/schema.test.cjs',
    'lib/core/telemetry/writer.cjs',
    'docs/TELEMETRY-SCHEMA.md',
    'scripts/session-start',
    'data/first-reward-surfaces.json',
    'tests/test-121-01-scaffold.sh',
    'tests/test-121-03-room-receipt-emit.cjs',
    'tests/test-121-04-canon-part-8-audit.sh',
    'tests/test-220-part8-egress.cjs',
    'tests/test-252-guard-census.cjs',
    'tests/run-all-118.sh',
    'lib/memory/run-feynman-tests.cjs',
    'tests/test-389-retire-option.cjs',
    'tests/test-389-retire-brief.cjs',
    'tests/test-389-first-install-seed.cjs',
  ];
  const bad = TOUCHED.filter((f) => exists(f) && dashRe.test(read(f)));
  check('Test 7: no em dash or en dash in the touched files', bad.length === 0, bad.join(', '));
}

// ---- Test 8: the room naming integration test reads no removed file and keeps its leg count ----
{
  const HEAD_LEG_COUNT = 6; // git show HEAD:tests/test-room-naming-selector-integration.cjs | grep -c "^test(" at Task 1
  const t = read('tests/test-room-naming-selector-integration.cjs');
  check('Test 8: the integration test names none of the removed files', !CORE_RE.test(t), (t.match(CORE_RE) || [''])[0]);
  check('Test 8: the integration test does not name the orchestrator hook block', !/phase-119-01-naming-selector-hook/.test(t));
  const legs = (t.match(/^test\(/gm) || []).length;
  check('Test 8: the integration test keeps ' + HEAD_LEG_COUNT + ' test( legs', legs === HEAD_LEG_COUNT, String(legs));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't389-10-rns-'));
  const env = Object.assign({}, process.env, { HOME: tmp });
  delete env.ANTHROPIC_API_KEY;
  const r = cp.spawnSync('node', [rel('tests/test-room-naming-selector-integration.cjs')], { cwd: ROOT, encoding: 'utf8', env });
  check('Test 8: the integration test exits 0', r.status === 0, ((r.stdout || '') + (r.stderr || '')).slice(-300));
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

console.log('');
console.log('test-389-retire-core: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
