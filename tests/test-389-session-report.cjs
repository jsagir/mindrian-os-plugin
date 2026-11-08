#!/usr/bin/env node
// Phase 389 plan 11: /mos:mva-report is renamed to /mos:session-report (owner D7 APPROVE, D8 APPROVE).
// Node built-ins only. Plain counters. Hyphens only. Exit 1 on a failure.
//
// D7 APPROVE: the command and the skill move with git mv; the body is the old body with the name replaced, nothing else.
// D8 APPROVE: /mos:mva-report stays one release as a soft-alias stub that forwards to /mos:session-report.
// D8 NO-ALIAS: no stub; one deprecation entry names the replacement (branch kept so the test follows the card).
//
// Tests
//   1  the new files exist and equal the HEAD blobs of the old files with the name replaced, byte for byte
//   2  frontmatter facts of the new command (excluded, shape, layer, reward citation, teaching and help_jtbd)
//   3  the old name: stub (D8 APPROVE) or removed plus deprecation entry (D8 NO-ALIAS)
//   4  registries and generated copies: the new name is registered and excluded, the stub is excluded, no WIRED row
//   5  no tracked file outside the allowed set names mva-report; the mos-face descriptor files name session-report
//   6  no en dash or em dash in the files this plan touched
//   7  mutation arm: the finders flag bad synthetic input
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PHASE = '.planning/phases/389-pyramid-seed-and-full-replaces-the-mva-family';
// Blob ids of the old files at the HEAD before this plan (git rev-parse HEAD~:path at plan start).
const OLD_CMD_BLOB = '600a7e6442e74aadef182755f9f31ff9c26a37d6';
const OLD_SKILL_BLOB = 'db2594d144123afecf56f4aa86cc1d8b03f3ac3f';
const OLD = 'mva-report';
const NEW = 'session-report';
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed += 1; console.log('ok   ' + name); }
  else { failed += 1; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); }
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function readJson(rel) { return JSON.parse(read(rel)); }
function blob(id) { return cp.execFileSync('git', ['cat-file', 'blob', id], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 24 }); }
function frontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 4);
  return end === -1 ? null : text.slice(4, end);
}
function body(text) {
  const end = text.indexOf('\n---', 4);
  return end === -1 ? text : text.slice(end + 4);
}
function field(fm, key) {
  const m = new RegExp('^' + key + ':\\s*(.*)$', 'm').exec(fm);
  return m ? m[1] : null;
}
function renamed(text) { return text.split(OLD).join(NEW); }

// ---- the owner tokens ----
function tokens() {
  const r = cp.spawnSync('node', [path.join(PHASE, '389-decision.cjs'), 'gate', path.join(PHASE, '389-DECISION.md'), 'D7', 'D8'],
    { cwd: ROOT, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const t = {};
  for (const m of out.matchAll(/^(D\d+) (\S+) /gm)) t[m[1]] = m[2];
  return { gate: r.status === 0 && /GATE PASS/.test(out), d7: t.D7, d8: t.D8, out };
}
const tok = tokens();
check('Gate: D7 and D8 gate prints GATE PASS', tok.gate, tok.out.trim());
check('Gate: D7 is APPROVE (otherwise this plan changes nothing)', tok.d7 === 'APPROVE', String(tok.d7));
const ALIAS = tok.d8 !== 'NO-ALIAS';

// ---- Test 1 ----
const oldCmd = blob(OLD_CMD_BLOB);
const oldSkill = blob(OLD_SKILL_BLOB);
for (const f of ['commands/session-report.md', 'skills/session-report/SKILL.md']) {
  check('Test 1: ' + f + ' exists', exists(f));
}
if (exists('commands/session-report.md')) {
  const t = read('commands/session-report.md');
  check('Test 1: the command body equals the old HEAD body with the name replaced, byte for byte', body(t) === body(renamed(oldCmd)));
  check('Test 1: the whole command file equals the old HEAD blob with the name replaced (nothing else changed)', t === renamed(oldCmd));
} else {
  check('Test 1: the command body equals the old HEAD body with the name replaced, byte for byte', false, 'missing');
  check('Test 1: the whole command file equals the old HEAD blob with the name replaced (nothing else changed)', false, 'missing');
}
if (exists('skills/session-report/SKILL.md')) {
  const t = read('skills/session-report/SKILL.md');
  check('Test 1: the skill body equals the old HEAD body with the name replaced, byte for byte', body(t) === body(renamed(oldSkill)));
  check('Test 1: the whole skill file equals the old HEAD blob with the name replaced', t === renamed(oldSkill));
} else {
  check('Test 1: the skill body equals the old HEAD body with the name replaced, byte for byte', false, 'missing');
  check('Test 1: the whole skill file equals the old HEAD blob with the name replaced', false, 'missing');
}

// ---- Test 2 ----
if (exists('commands/session-report.md')) {
  const t = read('commands/session-report.md');
  const fm = frontmatter(t) || '';
  const ofm = frontmatter(oldCmd);
  check('Test 2: connector excluded true with a reason', /^connector:\s*\n\s+excluded:\s*true\s*\n\s+reason:\s*".{12,}"/m.test(fm));
  check('Test 2: hitl_shape none with its hitl_why', field(fm, 'hitl_shape') === '"none"' && /^hitl_why:\s*".{12,}"/m.test(fm));
  check('Test 2: layer harness', field(fm, 'layer') === '"harness"');
  check('Test 2: same argument-hint and serves_jtbd as the old command',
    field(fm, 'argument-hint') === field(ofm, 'argument-hint') && field(fm, 'serves_jtbd') === field(ofm, 'serves_jtbd'));
  check('Test 2: help_jtbd equals the old text', field(fm, 'help_jtbd') === field(ofm, 'help_jtbd'));
  check('Test 2: teaching equals the old text with the name replaced and names /mos:session-report',
    field(fm, 'teaching') === renamed(field(ofm, 'teaching')) && /run \/mos:session-report\./.test(field(fm, 'teaching') || ''));
  const cite = /first delivery at commands\/session-report\.md:(\d+)/.exec(fm);
  const oldCite = /first delivery at commands\/mva-report\.md:(\d+)/.exec(ofm);
  check('Test 2: the first-delivery comment cites commands/session-report.md', !!cite);
  if (cite && oldCite) {
    const lines = t.split('\n');
    const oldLines = oldCmd.split('\n');
    check('Test 2: the cited line is the same line as before (the read-back instruction)',
      cite[1] === oldCite[1] && lines[Number(cite[1]) - 1] === oldLines[Number(oldCite[1]) - 1] && /Read back over THIS conversation/.test(lines[Number(cite[1]) - 1]),
      'cites ' + cite[1]);
  }
  check('Test 2: interactive_first_reward stays methodology_reframe', field(fm, 'interactive_first_reward') === 'methodology_reframe');
  check('Test 2: not deprecated (it is the live command)', !/^deprecated:/m.test(fm));
}

// ---- Test 3 ----
function stubProblems(text) {
  const out = [];
  const fm = frontmatter(text);
  if (fm === null) return ['no frontmatter'];
  const b = body(text);
  if (!/^deprecated:\s*true\s*$/m.test(fm)) out.push('deprecated true missing');
  if (!/^deprecated_redirect:\s*"?session-report"?\s*$/m.test(fm)) out.push('deprecated_redirect session-report missing');
  if (!/^deprecated_removal:\s*"?v?\d+\.\d+\.\d+(-beta\.\d+)?"?\s*$/m.test(fm)) out.push('deprecated_removal version missing');
  if (!/^connector:\s*\n\s+excluded:\s*true\s*\n\s+reason:\s*".{12,}"/m.test(fm)) out.push('connector excluded true with a reason missing');
  if (!/soft-alias-runner\.cjs/.test(b) || !/--from mva-report --to session-report/.test(b)) out.push('soft-alias-runner call missing');
  if (/^# Conversation-flow report/m.test(text)) out.push('still holds the report template');
  return out;
}
{
  const dep = readJson('data/command-deprecations.json');
  const entries = (dep.deprecations || []).filter((e) => e.command === '/mos:mva-report');
  if (ALIAS) {
    for (const f of ['commands/mva-report.md', 'skills/mva-report/SKILL.md']) {
      if (!exists(f)) { check('Test 3: ' + f + ' exists (D8 APPROVE keeps the stub)', false, 'missing'); continue; }
      const p = stubProblems(read(f));
      check('Test 3: ' + f + ' is a clean soft-alias stub', p.length === 0, p.join('; '));
    }
    const cmd = exists('commands/mva-report.md') ? read('commands/mva-report.md') : '';
    check('Test 3: the stub teaches /mos:session-report', /teaching:[^\n]*\/mos:session-report/.test(cmd));
    check('Test 3: the stub uses the opt-out reward value the other stubs use', /^interactive_first_reward:\s*"--none \(diagnostic surface\)"/m.test(cmd));
    check('Test 3: the stub declares hitl_shape F.0 with a hitl_why', /^hitl_shape:\s*"F\.0"/m.test(cmd) && /^hitl_why:\s*".{12,}"/m.test(cmd));
    check('Test 3: no deprecation entry for /mos:mva-report while the stub is in the registry', entries.length === 0, String(entries.length));
  } else {
    check('Test 3: both old files are absent (D8 NO-ALIAS)', !exists('commands/mva-report.md') && !exists('skills/mva-report/SKILL.md'));
    const e = entries[0] || {};
    check('Test 3: exactly one deprecation entry for /mos:mva-report with replaced_by /mos:session-report',
      entries.length === 1 && e.replaced_by === '/mos:session-report' && e.decided_by === 'navigator' && !!e.date && !!e.reason && !!e.retired_in);
  }
}

// ---- Test 4 ----
{
  const reg = readJson('data/command-registry.json');
  const rows = reg.commands || [];
  const nw = rows.find((r) => r.command === '/mos:session-report');
  const od = rows.find((r) => r.command === '/mos:mva-report');
  check('Test 4: command-registry has /mos:session-report', !!nw);
  check(ALIAS ? 'Test 4: command-registry keeps /mos:mva-report as the stub (teaching names the replacement)' : 'Test 4: command-registry has no /mos:mva-report',
    ALIAS ? !!od && /\/mos:session-report/.test(od.teaching || '') : !od);
  const cr = readJson('data/connector-registry.json');
  const wired = (cr.connectors || []).filter((r) => r && /session-report|mva-report/.test(r.surface || ''));
  check('Test 4: connector-registry holds no WIRED row for either name', wired.length === 0, JSON.stringify(wired));
  const led = readJson('data/connector-coverage-ledger.json');
  const lrows = (Array.isArray(led) ? led : (led.surfaces || led.rows || led.ledger || Object.values(led).find((v) => Array.isArray(v)) || []));
  const mineNew = lrows.filter((r) => r && (r.surface === '/mos:session-report' || r.surface === 'skill:session-report'));
  const mineOld = lrows.filter((r) => r && (r.surface === '/mos:mva-report' || r.surface === 'skill:mva-report'));
  check('Test 4: the coverage ledger holds 2 excluded rows for the new name', mineNew.length === 2 && mineNew.every((r) => r.state === 'excluded'), JSON.stringify(mineNew));
  check(ALIAS ? 'Test 4: the coverage ledger holds 2 excluded rows for the stub' : 'Test 4: the coverage ledger holds no row for the old name',
    ALIAS ? mineOld.length === 2 && mineOld.every((r) => r.state === 'excluded') : mineOld.length === 0, JSON.stringify(mineOld));
  const pj = readJson('data/brain-orchestration-projection.json');
  const node = (pj.nodes || []).find((n) => n && n.id === 'command:/mos:session-report');
  check('Test 4: the projection node for /mos:session-report exists and holds no ranking and no reach (excluded)',
    !!node && !node.ranking && !node.reach_id && !node.hierarchy_rank && !node.sensor_triggers, JSON.stringify(node));
  const hg = readJson('data/help-groups.json');
  const inGroup = (name) => (hg.groups || []).some((g) => (g.commands || []).includes(name));
  check('Test 4: help-groups lists session-report in a group', inGroup('session-report'));
  check(ALIAS ? 'Test 4: help-groups moves mva-report out of the groups and into deprecated_aliases (as heal)' : 'Test 4: help-groups holds no mva-report',
    ALIAS ? !inGroup('mva-report') && hg.deprecated_aliases && hg.deprecated_aliases['mva-report'] === 'session-report'
      : !inGroup('mva-report') && !(hg.deprecated_aliases && hg.deprecated_aliases['mva-report']));
  const lb = readJson('data/layer-backfill.json');
  const hb = readJson('data/hitl-shape-backfill.json');
  check('Test 4: layer-backfill and hitl-shape-backfill have a key for the new command',
    !!lb['commands/session-report.md'] && !!hb['commands/session-report.md']);
  const rel = readJson('data/section-command-relevance.json');
  const relText = JSON.stringify(rel);
  check('Test 4: section-command-relevance lists session-report', /"session-report"/.test(relText));
  check('Test 4: the workspace-mod command registry copy names the new command', /"command": "\/mos:session-report"/.test(read('ui/mindrian-workspace-mod/assets/command-registry.json')));
}

// ---- Test 5 ----
const ALLOWED_OLD_NAME = new Set([
  'commands/mva-report.md', 'skills/mva-report/SKILL.md',
  'data/command-deprecations.json', 'tests/fixtures/341-registry-drift-baseline.json',
  'tests/test-389-session-report.cjs', 'CHANGELOG.md',
  // generated or add-only data that must hold the stub row (D8 APPROVE) or the history of the old name
  'data/command-registry.json', 'data/connector-coverage-ledger.json', 'data/brain-orchestration-projection.json',
  'data/orchestration-command-ledger.json', 'data/command-irreversibility-ledger.json', 'data/jev-labels/command-irreversibility.json',
  'data/help-groups.json', 'data/layer-backfill.json', 'data/hitl-shape-backfill.json', 'data/render-coverage-registry.json',
  'ui/mindrian-workspace-mod/assets/command-registry.json', 'ui/mos-face/hooks/commands.ts', 'lib/mos-face/dist/commands.js',
]);
function oldNameHits(files, readFn) {
  const hits = [];
  for (const f of files) {
    if (f.startsWith('.planning/') || f.startsWith('dist/') || f.startsWith('r-and-d/')) continue;
    if (ALLOWED_OLD_NAME.has(f)) continue;
    // a document whose file name starts with a date is history
    if (/(^|\/)\d{4}-\d{2}-\d{2}[^/]*$/.test(f)) continue;
    let t;
    try { t = readFn(f); } catch (e) { continue; }
    if (t.includes(OLD)) hits.push(f);
  }
  return hits;
}
{
  const files = cp.execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
  const hits = oldNameHits(files, read);
  check('Test 5: no tracked file outside the allowed set names mva-report', hits.length === 0, hits.join(', '));
  const fc = read('ui/mos-face/scripts/face-commands.cjs');
  check('Test 5: face-commands.cjs override map names /mos:session-report and not /mos:mva-report',
    /'\/mos:session-report':/.test(fc) && !/'\/mos:mva-report':/.test(fc));
  const ct = read('ui/mos-face/hooks/commands.ts');
  check('Test 5: hooks/commands.ts WHY names /mos:session-report', /"\/mos:session-report": "When you have finished a conversation with Theo/.test(ct));
  const cj = read('lib/mos-face/dist/commands.js');
  check('Test 5: dist/commands.js WHY names /mos:session-report', /"\/mos:session-report": "When you have finished a conversation with Theo/.test(cj));
  const m = read('scripts/migrate-skill-frontmatter.cjs');
  check('Test 5: migrate-skill-frontmatter.cjs list names session-report', /'session-report'/.test(m));
}

// ---- Test 6 ----
{
  const touched = ['commands/session-report.md', 'skills/session-report/SKILL.md', 'commands/mva-report.md', 'skills/mva-report/SKILL.md',
    'tests/test-389-session-report.cjs', 'scripts/migrate-skill-frontmatter.cjs', 'tests/test-192-menu-sweep-live-selectors.cjs',
    'ui/mos-face/scripts/face-commands.cjs', 'ui/mos-face/hooks/commands.ts'].filter(exists);
  const bad = touched.filter((f) => { const t = read(f); return t.includes(EM) || t.includes(EN); });
  check('Test 6: no en dash or em dash in the files this plan touched', bad.length === 0, bad.join(', '));
}

// ---- Test 7: mutation arm ----
{
  check('Test 7: stubProblems flags a stub that still holds the report template',
    stubProblems('---\ndeprecated: true\ndeprecated_redirect: "session-report"\ndeprecated_removal: "v2.0.0-beta.84"\nconnector:\n  excluded: true\n  reason: "a reason that is long enough"\n---\nnode soft-alias-runner.cjs --from mva-report --to session-report\n# Conversation-flow report\n').length > 0);
  check('Test 7: stubProblems accepts a clean stub',
    stubProblems('---\ndeprecated: true\ndeprecated_redirect: "session-report"\ndeprecated_removal: "v2.0.0-beta.84"\nconnector:\n  excluded: true\n  reason: "a reason that is long enough"\n---\nnode soft-alias-runner.cjs --from mva-report --to session-report\n').length === 0);
  check('Test 7: oldNameHits flags an undated file that names the old command',
    oldNameHits(['docs/x.md', 'docs/2026-07-01-x.md', 'docs/y.md'], (f) => (f === 'docs/y.md' ? 'ok' : 'run /mos:mva-report')).join() === 'docs/x.md');
  check('Test 7: renamed() replaces every occurrence', renamed('a mva-report b mva-report') === 'a session-report b session-report');
}

console.log('\ntest-389-session-report: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
