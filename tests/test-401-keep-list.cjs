#!/usr/bin/env node
'use strict';

// Phase 401 slice 1; design section 5; owner ruling of 2026-11-18: retired means blocked, not ignored.
// Ruling O1 keeps the folder name in the guard checks.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const childProcess = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const KEEP_A = [
  'tests/test-260906-gr1-brain-shaped-tool-gate.cjs','tests/test-260917-dgf-part8-hook-disposition.cjs','tests/test-386-b2-brain-write-blocked.cjs','tests/test-386-web-credential-hook.cjs','tests/test-395-egress-leaks.cjs','tests/test-396-theo-route-matrix.cjs','tests/test-brain-response-sanitize.cjs','tests/test-366-guard-navigator-release.cjs','tests/test-245-brain-envelope-shape.cjs','tests/fixtures/392-part8-replay/route-matrix.json','tests/test-391-agent-tools-naming.cjs',
  'lib/core/brain-response-sanitize.cjs','scripts/part8-egress-guard-hook.cjs','scripts/brain-response-sanitize-hook.cjs','lib/core/security/agentshield-scanner.cjs','scripts/measure-hook-cold-start.cjs','tools/perf/perf-harness.cjs','scripts/migrate-skill-frontmatter.cjs','lib/memory/run-feynman-tests.cjs','tests/run-all-296.sh','CHANGELOG.md','docs/2026-05-12-brain-query-path-optimization.md','docs/257-NOTE-part8-enforcement-locus-rulings.md',
  'r-and-d/breakthrough-engines/engines/analogies/agents/analogy-query-fetcher.md','r-and-d/breakthrough-engines/engines/analogies/commands/find-analogies.md','r-and-d/breakthrough-engines/engines/analogies/skills/find-analogies/SKILL.md','r-and-d/breakthrough-engines/engines/bono/agents/persona-analyst.md','r-and-d/breakthrough-engines/engines/rs/rs-experts/commands/rs-experts.md','r-and-d/breakthrough-engines/engines/rs/rs-experts/skills/rs-experts/SKILL.md','r-and-d/breakthrough-engines/engines/rs/rs-explain/commands/rs-explain.md','r-and-d/breakthrough-engines/engines/rs/rs-explain/skills/rs-explain/SKILL.md','r-and-d/breakthrough-engines/engines/rs/rs-fetch/commands/rs-fetch.md','r-and-d/breakthrough-engines/engines/rs/rs-fetch/skills/rs-fetch/SKILL.md','r-and-d/breakthrough-engines/engines/rs/rs-thesis/commands/rs-thesis.md','r-and-d/breakthrough-engines/engines/rs/rs-thesis/skills/rs-thesis/SKILL.md'
];
const KEEP_K = ['scripts/release.sh','scripts/check-release-payload-ceiling.cjs','tests/test-341-payload-shrinkwrap-present.cjs','tests/test-267-mcpv2-sdk-era.cjs','lib/core/room-auto-create.test.cjs','lib/core/venture-shape-nudge.test.cjs','tests/test-room-auto-create-fingerprint-integration.cjs','tests/test-render-v2-provenance.cjs','lib/core/room-auto-create.cjs','lib/core/breakthrough/detectors.cjs'];
// Phase 401 slice 2, AC2.2; a new file that holds the literal must fail this leg; owner ruling O1.
const EXPECTED_K = [...KEEP_K, 'data/capability-ledger.json', 'tests/test-401-keep-list.cjs', 'tools/401/measure.cjs', 'tests/test-401-brain-backend-retired.cjs'];
const A = 'mcp__mindrian-brain__', K = 'mcp-server-brain', RETIRED = 'pws-brain-mcp';
const read = (root, rel) => { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch (_) { return null; } };
function l1(root) {
  const errors = [];
  const hooks = read(root, 'hooks/hooks.json');
  let matchers = [];
  try { matchers = Object.values(JSON.parse(hooks).hooks || {}).flat().map((x) => x.matcher).filter((x) => typeof x === 'string' && x.includes('mindrian-brain')); } catch (_) {}
  if (matchers.length < 2 || matchers.some((x) => !x.includes(RETIRED))) errors.push('hooks matchers');
  const sanitizer = read(root, 'lib/core/brain-response-sanitize.cjs') || '';
  const decl = /^const BRAIN_SHAPED_TOOL_MATCHER = ([^;]+);/m.exec(sanitizer);
  let literal = '';
  if (decl) { try { literal = Function('return (' + decl[1] + ')')(); } catch (_) {} }
  if (!decl || typeof literal !== 'string' || !literal.includes(RETIRED)) errors.push('sanitizer declaration');
  if (root === ROOT) {
    try { const mod = require(path.join(root, 'lib/core/brain-response-sanitize.cjs')); if (mod.BRAIN_SHAPED_TOOL_MATCHER !== literal) errors.push('sanitizer export mismatch'); }
    catch (_) { errors.push('sanitizer export unavailable'); }
  }
  let data; try { data = JSON.parse(read(root, 'data/theo-tool-classes.json')); } catch (_) { data = {}; }
  if (!Array.isArray(data.retired_servers) || !data.retired_servers.some((x) => String(x).includes(RETIRED))) errors.push('retired_servers');
  return { ok: errors.length === 0, errors };
}
function listLeg(root, paths, literal, id) {
  const missing = paths.filter((rel) => { const body = read(root, rel); return body === null || !body.includes(literal); });
  return { ok: missing.length === 0, errors: missing.map((p) => id + ' missing ' + p) };
}
function l2(root) { return listLeg(root, KEEP_A, A, 'L2'); }
function trackedPaths(root) {
  if (fs.existsSync(path.join(root, '.git'))) {
    return childProcess.execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  }
  const found = [];
  function walk(dir, rel) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const child = rel ? rel + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), child);
      else found.push(child);
    }
  }
  walk(root, '');
  return found;
}
function l3(root) {
  const paths = trackedPaths(root).filter((rel) => !rel.startsWith('docs/') && !rel.startsWith('.planning/') && rel !== 'CHANGELOG.md');
  const actual = paths.filter((rel) => { const body = read(root, rel); return body !== null && body.includes(K); }).sort();
  const expected = EXPECTED_K.slice().sort();
  const extra = actual.filter((rel) => !expected.includes(rel));
  const missing = expected.filter((rel) => !actual.includes(rel));
  const errors = [];
  if (extra.length) errors.push('L3 extra ' + extra.join(', '));
  if (missing.length) errors.push('L3 missing ' + missing.join(', '));
  return { ok: errors.length === 0, errors };
}
function copyPaths(root, dest, paths) { for (const rel of paths) { const from = path.join(root, rel), to = path.join(dest, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); } }
function mutateFile(root, rel, from, to) { const f = path.join(root, rel), s = fs.readFileSync(f, 'utf8'); fs.writeFileSync(f, s.replace(from, to)); }
function mutationArms(root) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), '401-keep-list-'));
  const results = [];
  const expectFail = (name, paths, leg, setup) => {
    const dir = path.join(base, name); fs.mkdirSync(dir);
    try { copyPaths(root, dir, paths); setup(dir); results.push({ name, passed: !leg(dir).ok }); }
    catch (e) { results.push({ name, passed: false, error: e.message }); }
  };
  try {
    const l1paths = ['hooks/hooks.json','lib/core/brain-response-sanitize.cjs','data/theo-tool-classes.json'];
    expectFail('hook', l1paths, l1, (d) => mutateFile(d, 'hooks/hooks.json', RETIRED, 'removed-server'));
    expectFail('declaration', l1paths, l1, (d) => { const f = path.join(d, 'lib/core/brain-response-sanitize.cjs'); const body = fs.readFileSync(f, 'utf8'); fs.writeFileSync(f, body.replace(/^(const BRAIN_SHAPED_TOOL_MATCHER = .*?)pws-brain-mcp(.*;)/m, '$1removed-server$2')); });
    expectFail('retired', l1paths, l1, (d) => mutateFile(d, 'data/theo-tool-classes.json', RETIRED, 'removed-server'));
    const expectPathFail = (name, paths, rel, leg, setup) => {
      const dir = path.join(base, name); fs.mkdirSync(dir);
      try { copyPaths(root, dir, paths); setup(dir); const result = leg(dir); results.push({ name, passed: !result.ok && result.errors.some((error) => error.includes(rel)) }); }
      catch (e) { results.push({ name, passed: false, error: e.message }); }
    };
    expectPathFail('keep-a', [KEEP_A[0]], KEEP_A[0], l2, (d) => mutateFile(d, KEEP_A[0], new RegExp(A, 'g'), ''));
    expectPathFail('keep-k', [KEEP_K[0]], KEEP_K[0], l3, (d) => mutateFile(d, KEEP_K[0], new RegExp(K, 'g'), ''));
    expectPathFail('new-keep-k', [...EXPECTED_K], 'tests/planted-401-extra.cjs', l3, (d) => {
      const f = path.join(d, 'tests/planted-401-extra.cjs');
      fs.writeFileSync(f, K);
    });
    const control = path.join(base, 'control'); fs.mkdirSync(control); copyPaths(root, control, [...new Set([...l1paths, ...KEEP_A, ...EXPECTED_K])]);
    const feynmanPath = path.join(control, 'lib/memory/run-feynman-tests.cjs');
    fs.writeFileSync(feynmanPath, fs.readFileSync(feynmanPath, 'utf8').split(K).join(''));
    const controlResult = [l1(control), l2(control), l3(control)];
    results.push({ name: 'control', passed: controlResult.every((result) => result.ok), error: controlResult.flatMap((result) => result.errors || []).join(', ') });
    return results;
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
}
function main(root) {
  let passed = 0, failed = 0;
  const report = (id, label, result) => { if (result.ok) { passed++; console.log('ok: ' + id + ' ' + label); }
    else { failed++; console.log('FAIL: ' + id + ' ' + label + ' -- ' + result.errors.join(', ')); } };
  report('L1', 'retired literal', l1(root)); report('L2', 'KEEP_A', l2(root)); report('L3', 'KEEP_K', l3(root));
  const arms = mutationArms(root), bad = arms.filter((x) => !x.passed);
  if (!bad.length) { passed++; console.log('ok: L4 mutation arms'); } else { failed++; console.log('FAIL: L4 mutation arms -- ' + bad.map((x) => x.name + (x.error ? ': ' + x.error : '')).join(', ')); }
  console.log('test-401-keep-list: ' + passed + ' passed, ' + failed + ' failed');
  if (failed) process.exitCode = 1;
}
if (require.main === module) {
  const at = process.argv.indexOf('--root');
  if (process.argv.some((x) => x.startsWith('--') && x !== '--root') || (at >= 0 && !process.argv[at + 1])) { console.error('Usage: node tests/test-401-keep-list.cjs [--root <dir>]'); process.exitCode = 2; }
  else main(at >= 0 ? path.resolve(process.argv[at + 1]) : ROOT);
}
module.exports = { l1, l2, l3, KEEP_A, KEEP_K, EXPECTED_K };
