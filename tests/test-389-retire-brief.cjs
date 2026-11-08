#!/usr/bin/env node
// Phase 389 plan 09: the old brief command and its skill are soft-alias stubs (owner D5 APPROVE, D8 APPROVE).
// Node built-ins only. Plain counters. Hyphens only. Exit 1 on a failure.
//
// D8 APPROVE branch only: /mos:mva-brief stays one release as a stub that forwards to /mos:structure-argument.
// No deprecation entry is written while the command is still in the registry (the drift check fails an entry
// whose command is back in the registry). Plan 14 or the release after the alias removes the stub and writes it.
//
// Tests
//   1  both stub files: frontmatter and body
//   2  registry rows: no WIRED row for the old surface, one EXCLUDED row each, no sub_mode mva-brief
//   3  no deprecation entry yet
//   4  other references handled: blueprints, section schema (template and fixture), nudge test, orchestrator test
//   5  room-naming-selector: the writer-less read stays (answer f of 389-CALLERS.md), no writer anywhere
//   6  no tracked file outside the allowed set names mva-brief as a thing to run
//   7  no en dash or em dash in the files this plan touched
//   8  mutation arm: the finders flag bad synthetic input
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed += 1; console.log('ok   ' + name); }
  else { failed += 1; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function readJson(rel) { return JSON.parse(read(rel)); }

// ---- finders (used on the real tree and on synthetic text in the mutation arm) ----
function frontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  return end === -1 ? null : text.slice(4, end);
}
function body(text) {
  const end = text.indexOf('\n---', 4);
  return end === -1 ? text : text.slice(end + 4);
}
function stubProblems(text) {
  const out = [];
  const fm = frontmatter(text);
  if (fm === null) return ['no frontmatter'];
  const b = body(text);
  if (!/^deprecated:\s*true\s*$/m.test(fm)) out.push('deprecated true missing');
  if (!/^deprecated_redirect:\s*"?structure-argument"?\s*$/m.test(fm)) out.push('deprecated_redirect structure-argument missing');
  if (!/^deprecated_removal:\s*"?v?\d+\.\d+\.\d+(-beta\.\d+)?"?\s*$/m.test(fm)) out.push('deprecated_removal version missing');
  if (!/^connector:\s*\n\s+excluded:\s*true\s*\n\s+reason:\s*".{12,}"/m.test(fm)) out.push('connector excluded true with a reason missing');
  if (!/soft-alias-runner\.cjs/.test(b) || !/--from mva-brief --to structure-argument/.test(b)) out.push('soft-alias-runner call missing');
  for (const bad of ['scripts/mva-run.cjs', 'mva-run.cjs', 'instant_brief', 'SENS-01', 'hierarchy_rank', 'resolveOption2', 'sub_mode']) {
    if (text.includes(bad)) out.push('still names ' + bad);
  }
  if (/\brouter\b/i.test(text)) out.push('still names the router');
  return out;
}

// ---- Test 1 ----
for (const f of ['commands/mva-brief.md', 'skills/mva-brief/SKILL.md']) {
  if (!exists(f)) { check('Test 1: ' + f + ' exists (D8 APPROVE keeps the stub)', false, 'missing'); continue; }
  const p = stubProblems(read(f));
  check('Test 1: ' + f + ' is a clean soft-alias stub', p.length === 0, p.join('; '));
}
{
  const cmd = exists('commands/mva-brief.md') ? read('commands/mva-brief.md') : '';
  check('Test 1: the command stub teaches /mos:structure-argument', /teaching:[^\n]*\/mos:structure-argument/.test(cmd));
  check('Test 1: the command stub declares hitl_shape F.0', /^hitl_shape:\s*"F\.0"/m.test(cmd));
  check('Test 1: the command stub no longer claims the old interactive_first_reward', !/interactive_first_reward:\s*instant_brief/.test(cmd));
  check('Test 1: the command stub uses the opt-out value the heal stub uses (the reward linter accepts it)', /^interactive_first_reward:\s*"--none \(diagnostic surface\)"/m.test(cmd));
}

// ---- Test 2 ----
{
  const reg = readJson('data/connector-registry.json');
  const flat = JSON.stringify(reg);
  check('Test 2: connector-registry has no sub_mode mva-brief', !/"sub_mode":\s*"mva-brief"/.test(flat));
  const sens = reg.sensor_index && reg.sensor_index['SENS-01'];
  check('Test 2: the SENS-01 reverse map no longer lists /mos:mva-brief', Array.isArray(sens) && !sens.includes('/mos:mva-brief') && sens.length > 0);
  check('Test 2: connector-registry has no connector row for /mos:mva-brief or skill:mva-brief',
    !(reg.connectors || []).some((r) => r && (r.surface === '/mos:mva-brief' || r.surface === 'skill:mva-brief')));
  const led = readJson('data/connector-coverage-ledger.json');
  const rows = (Array.isArray(led) ? led : (led.surfaces || led.rows || led.ledger || Object.values(led).find((v) => Array.isArray(v)) || []));
  const mine = rows.filter((r) => r && (r.surface === '/mos:mva-brief' || r.surface === 'skill:mva-brief'));
  check('Test 2: the coverage ledger holds exactly 2 rows for the stubs', mine.length === 2, String(mine.length));
  check('Test 2: both coverage rows are state excluded', mine.length === 2 && mine.every((r) => r.state === 'excluded'), JSON.stringify(mine));
  const proj = JSON.stringify(readJson('data/brain-orchestration-projection.json'));
  check('Test 2: projection has no sub_mode:mva-brief node', !/"id":\s*"sub_mode:mva-brief"/.test(proj));
  const pj = readJson('data/brain-orchestration-projection.json');
  const node = (pj.nodes || []).find((n) => n && n.id === 'command:/mos:mva-brief');
  check('Test 2: the projection node for /mos:mva-brief holds no ranking, no reach and no sensor trigger (it is excluded)',
    !!node && !node.ranking && !node.reach_id && !node.hierarchy_rank && !node.sensor_triggers && !node.chain_provenance, JSON.stringify(node));
}

// ---- Test 3 ----
{
  const dep = readJson('data/command-deprecations.json');
  const entries = (dep.deprecations || []).filter((e) => e.command === '/mos:mva-brief');
  check('Test 3: no deprecation entry for /mos:mva-brief while the stub is in the registry', entries.length === 0, String(entries.length));
}

// ---- Test 4 ----
{
  const bp = read('data/room-blueprints.json');
  check('Test 4: data/room-blueprints.json no longer names mva-brief', !/mva-brief/.test(bp));
  const j = JSON.parse(bp);
  const ven = j.venture || (j.families && j.families.venture) || {};
  check('Test 4: venture arrival_assets keeps defined-venture and gains seed-pyramid',
    Array.isArray(ven.arrival_assets) && ven.arrival_assets.includes('defined-venture') && ven.arrival_assets.includes('seed-pyramid'));
  check('Test 4: venture default_methodologies names structure-argument, diagnose, lean-canvas',
    Array.isArray(ven.default_methodologies) && ['structure-argument', 'diagnose', 'lean-canvas'].every((m) => ven.default_methodologies.includes(m)) && ven.default_methodologies.length === 3);
  for (const f of ['templates/room-skeleton/references/SECTION-SCHEMA.md', 'data/harness-fixtures/converged-room/references/SECTION-SCHEMA.md']) {
    const t = read(f);
    check('Test 4: ' + f + ' venture row names structure-argument and not mva-brief',
      /\| venture \| structure-argument, diagnose, lean-canvas \|/.test(t) && !/mva-brief/.test(t));
  }
  check('Test 4: the two schema copies stay byte equal',
    read('templates/room-skeleton/references/SECTION-SCHEMA.md') === read('data/harness-fixtures/converged-room/references/SECTION-SCHEMA.md'));
  check('Test 4: lib/core/venture-shape-nudge.test.cjs names no mva-brief', !/mva-brief/.test(read('lib/core/venture-shape-nudge.test.cjs')));
  check('Test 4: lib/core/mva-orchestrator.test.cjs names no mva-brief (its command legs went with the old command body)', !/mva-brief/.test(read('lib/core/mva-orchestrator.test.cjs')));
}

// ---- Test 5 ----
{
  const sel = read('scripts/room-naming-selector.cjs');
  check('Test 5: the selector still reads <room>/.mindrian/mva-brief.json (older rooms may hold the file)', /path\.join\(roomDir, '\.mindrian', 'mva-brief\.json'\)/.test(sel));
  check('Test 5: the selector comment records that no writer exists (389-CALLERS answer f)', /no writer/i.test(sel) && /389/.test(sel));
  const files = cp.execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
  const writers = [];
  for (const f of files) {
    if (f.startsWith('.planning/') || f.startsWith('dist/') || f === 'CHANGELOG.md') continue;
    if (f === 'scripts/room-naming-selector.cjs' || f === 'tests/test-389-retire-brief.cjs') continue;
    let t;
    try { t = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
    if (t.includes('mva-brief.json')) writers.push(f);
  }
  check('Test 5: no other tracked file names mva-brief.json (no writer, no second reader)', writers.length === 0, writers.join(', '));
}

// ---- Test 6 ----
const ALLOWED_PREFIX = ['.planning/', 'dist/'];
const ALLOWED_FILE = new Set([
  'CHANGELOG.md',
  'evals/eureka/211-room-report.md',
  'commands/mva-brief.md',
  'skills/mva-brief/SKILL.md',
  // generated or hand-kept registry rows for the stub (the command is still a registered, excluded surface)
  'data/command-registry.json', 'data/connector-registry.json', 'data/connector-coverage-ledger.json',
  'data/brain-orchestration-projection.json', 'data/orchestration-command-ledger.json', 'data/render-coverage-registry.json',
  'data/section-command-ledger.json', 'data/section-command-relevance.json', 'data/help-groups.json',
  'data/hitl-shape-backfill.json', 'data/layer-backfill.json', 'data/jev-labels/command-irreversibility.json',
  'data/command-irreversibility-ledger.json', 'tests/fixtures/341-registry-drift-baseline.json',
  'ui/mindrian-workspace-mod/assets/command-registry.json', 'ui/mos-face/hooks/commands.ts', 'lib/mos-face/dist/commands.js',
  'docs/COMPONENT-INVENTORY.md',
  'docs/2026-09-23-HANDOFF-phase-356-irreversibility-ledger.md',
  'scripts/room-naming-selector.cjs',
  'tests/test-389-stale-text.cjs',
]);
function namesBrief(t) { return /mva-brief/.test(t); }
{
  const files = cp.execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
  const hits = [];
  for (const f of files) {
    if (ALLOWED_FILE.has(f) || ALLOWED_PREFIX.some((p) => f.startsWith(p))) continue;
    if (f.startsWith('tests/test-389-')) continue;
    let t;
    try { t = fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch (e) { continue; }
    if (namesBrief(t)) hits.push(f);
  }
  check('Test 6: no tracked file outside the allowed set names mva-brief', hits.length === 0, hits.join(', '));
  const inv = read('docs/COMPONENT-INVENTORY.md').split('\n').filter((l) => /mva-brief/.test(l));
  check('Test 6: the component inventory marks mva-brief as deprecated and points to structure-argument',
    inv.length === 1 && /deprecated/i.test(inv[0]) && /structure-argument/.test(inv[0]), inv.join(' | '));
}

// ---- Test 7 ----
{
  const touched = [
    'commands/mva-brief.md', 'skills/mva-brief/SKILL.md', 'data/room-blueprints.json',
    'templates/room-skeleton/references/SECTION-SCHEMA.md', 'data/harness-fixtures/converged-room/references/SECTION-SCHEMA.md',
    'lib/core/venture-shape-nudge.test.cjs', 'scripts/room-naming-selector.cjs',
    'docs/COMPONENT-INVENTORY.md', 'tests/test-389-stale-text.cjs', 'tests/test-389-retire-brief.cjs',
  ];
  const dashRe = new RegExp('[\\u2013\\u2014]');
  const hits = touched.filter((f) => exists(f) && dashRe.test(read(f)));
  check('Test 7: no en dash or em dash in ' + touched.length + ' files', hits.length === 0, hits.join(', '));
}

// ---- Test 8: mutation arm ----
{
  const good = '---\nname: x\ndeprecated: true\ndeprecated_redirect: "structure-argument"\ndeprecated_removal: "v2.0.0-beta.84"\nconnector:\n  excluded: true\n  reason: "Deprecated alias, nothing to reach."\n---\n\nRun node soft-alias-runner.cjs --from mva-brief --to structure-argument\n';
  check('Test 8: the stub finder passes a clean synthetic stub', stubProblems(good).length === 0, stubProblems(good).join('; '));
  check('Test 8: the stub finder flags mva-run.cjs', stubProblems(good + 'node scripts/mva-run.cjs').length > 0);
  check('Test 8: the stub finder flags instant_brief', stubProblems(good.replace('name: x', 'name: x\ninteractive_first_reward: instant_brief')).length > 0);
  check('Test 8: the stub finder flags a missing connector.excluded', stubProblems(good.replace('excluded: true', 'excluded: false')).length > 0);
  check('Test 8: the stub finder flags the stale router footer', stubProblems(good + 'the router reads the brief side file through resolveOption2').length > 0);
  check('Test 8: the finder flags a synthetic text that names the old command', namesBrief('run /mos:mva-brief now') && !namesBrief('run /mos:structure-argument now'));
}

console.log('');
console.log('test-389-retire-brief: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
