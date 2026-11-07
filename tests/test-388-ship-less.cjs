#!/usr/bin/env node
'use strict';

/*
 * Phase 388 plan 04: ship less.
 *
 * The owner approved 22 package.json "files" negation patterns (decision card
 * 388-DECISION.md, answer APPROVE, baseline stays shipped). They take shipped test
 * files, two test runners, Python bytecode caches, three data files and one HTML
 * template out of the npm package. The repo keeps all of them.
 *
 * Arms:
 *   arm 1  the pack payload holds no path that matches an approved pattern
 *   arm 2  the pack payload holds every must-ship path (hooks, MCP entries, bins, baseline, shrinkwrap)
 *   arm 3  unpackedSize stays within a tripwire of the approved after size (not a budget)
 *   arm 4  the matcher can fail: it flags a planted path per pattern and spares the must-keep paths
 *   arm 5  npm honors each pattern: in a synthetic tree the target leaves and the sibling stays
 *   arm 6  package.json files holds each pattern once and no entry starts with tests, docs, tools or ui
 *
 * The constants below are copied from the decision card because .planning is not tracked.
 * Offline: local npm spawns only (npm pack --dry-run --json --ignore-scripts), no network, no publish.
 * Hyphens only.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');

const APPROVED = [
  '!data/arbitration-rule-catalogue.json',
  '!data/capability-map-registry.json',
  '!data/connector-out-of-spine-allowlist.json',
  '!lib/__pycache__/*.pyc',
  '!lib/conversation/*.test.cjs',
  '!lib/core/*.test.cjs',
  '!lib/core/__pycache__/*.pyc',
  '!lib/core/breakthrough/*.test.cjs',
  '!lib/core/migrations/*.test.cjs',
  '!lib/core/navigation/*.test.cjs',
  '!lib/core/security/*.test.cjs',
  '!lib/core/telemetry/*.test.cjs',
  '!lib/core/temporal/*.test.cjs',
  '!lib/hmi/*.test.cjs',
  '!lib/import/*.test.cjs',
  '!lib/import/run-all-tests.cjs',
  '!lib/mcp/app-html/mindrian-platform.html',
  '!lib/memory/!(feynman-prompts-drift|post-compact-reinjection).test.cjs',
  '!lib/memory/run-feynman-tests.cjs',
  '!lib/render/*.test.cjs',
  '!lib/vault/*.test.cjs',
  '!lib/workflow/*.test.cjs',
];
const BASELINE = 'evals/eureka/212-critic-baseline.json';
const APPROVED_AFTER_UNPACKED = 43425555;
const TRIPWIRE = 5242880;
const KEPT_TESTS = ['lib/memory/feynman-prompts-drift.test.cjs', 'lib/memory/post-compact-reinjection.test.cjs'];

let passed = 0;
let failed = 0;
function ok(label) { passed += 1; process.stdout.write('PASS: ' + label + '\n'); }
function bad(label, detail) { failed += 1; process.stdout.write('FAIL: ' + label + (detail ? '\n    ' + detail : '') + '\n'); }

// ---------------------------------------------------------------- matcher (pure)

function escapeRe(s) { return s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); }

// Translate one files pattern (without its leading bang) to a regex source.
// Supports * (no slash) and one extglob !(a|b) that matches any single-segment text other than a or b.
function toRegexSource(pat) {
  const i = pat.indexOf('!(');
  if (i === -1) return pat.split('*').map(escapeRe).join('[^/]*');
  const j = pat.indexOf(')', i);
  const alts = pat.slice(i + 2, j).split('|').map(escapeRe).join('|');
  const head = toRegexSource(pat.slice(0, i));
  const rest = toRegexSource(pat.slice(j + 1));
  return head + '(?:(?!(?:' + alts + ')' + rest + '$)[^/]*)' + rest;
}

function matches(pattern, p) {
  return new RegExp('^' + toRegexSource(pattern.replace(/^!/, '')) + '$').test(p);
}

function flagged(p) { return APPROVED.some((pat) => matches(pat, p)); }

// A path that a pattern must remove, and a sibling in the same folder that it must keep.
function plant(pattern) {
  const pat = pattern.replace(/^!/, '');
  const target = pat.replace(/!\([^)]*\)/g, 'zz').replace(/\*/g, 'zz');
  const dir = path.posix.dirname(target);
  return { target, sibling: dir + '/keep-sibling.txt' };
}

// ---------------------------------------------------------------- pack helper

function pack(dir, env) {
  const r = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    timeout: 240000,
    env: Object.assign({}, process.env, { npm_config_offline: 'true', npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' }, env || {}),
  });
  if (r.error && r.error.code === 'ENOENT') return { missing: true };
  if (r.status !== 0) return { error: 'status ' + r.status + ' ' + String(r.stderr).slice(0, 300) };
  try {
    const e = JSON.parse(r.stdout)[0];
    return { files: e.files.map((f) => f.path), unpackedSize: e.unpackedSize, entryCount: e.entryCount };
  } catch (err) { return { error: 'bad json: ' + String(err.message) }; }
}

// ---------------------------------------------------------------- arms

const real = pack(REPO);
if (real.missing) { process.stdout.write('SKIPPED (ENV GAP): npm is not on the path\n'); process.exit(77); }

if (real.error) {
  bad('npm pack --dry-run --json ran and printed a file list', real.error);
} else {
  const packed = real.files;
  const set = new Set(packed);

  // arm 1
  const shipped = packed.filter(flagged);
  if (shipped.length === 0) ok('arm 1: the pack payload holds no path that matches an approved pattern');
  else bad('arm 1: the pack payload holds no path that matches an approved pattern', shipped.length + ' excluded path(s) still ship; first 10: ' + shipped.slice(0, 10).join(', '));

  // arm 2
  const must = new Set([
    'hooks/hooks.json', 'scripts/mindrian-mcp-server.cjs', 'scripts/mindrian-brain-mcp-client.cjs',
    'bin/cli.js', 'bin/mindrian-mcp-server.cjs', '.claude-plugin/plugin.json', 'npm-shrinkwrap.json',
    '.mcp.json', 'settings.json', 'package.json', BASELINE,
  ].concat(KEPT_TESTS));
  const addFromText = (text) => {
    const re = /\$\{?CLAUDE_PLUGIN_ROOT\}?\/([A-Za-z0-9_.\/-]+)/g;
    let m;
    while ((m = re.exec(text))) must.add(m[1].replace(/[.,;:)]+$/, ''));
  };
  try {
    const walk = (v) => {
      if (typeof v === 'string') addFromText(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(JSON.parse(fs.readFileSync(path.join(REPO, 'hooks/hooks.json'), 'utf8')));
    walk(JSON.parse(fs.readFileSync(path.join(REPO, '.mcp.json'), 'utf8')));
    const pj = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
    for (const v of Object.values(pj.bin || {})) must.add(String(v).replace(/^\.\//, ''));
  } catch (e) { bad('arm 2: hooks.json, .mcp.json and package.json parse', String(e.message)); }
  // only files that exist in the repo can be demanded of the payload
  const mustList = [...must].filter((p) => fs.existsSync(path.join(REPO, p)) && fs.statSync(path.join(REPO, p)).isFile());
  const missing = mustList.filter((p) => !set.has(p));
  if (missing.length === 0) ok('arm 2: the pack payload holds all ' + mustList.length + ' must-ship paths');
  else bad('arm 2: the pack payload holds every must-ship path', 'missing: ' + missing.join(', '));

  // arm 3
  if (real.unpackedSize <= APPROVED_AFTER_UNPACKED + TRIPWIRE) ok('arm 3: unpackedSize ' + real.unpackedSize + ' is within ' + TRIPWIRE + ' bytes of the approved ' + APPROVED_AFTER_UNPACKED);
  else bad('arm 3: unpackedSize is within the tripwire of the approved after size', real.unpackedSize + ' > ' + (APPROVED_AFTER_UNPACKED + TRIPWIRE));
}

// arm 4: the matcher can fail
{
  const notPlanted = [];
  for (const pat of APPROVED) {
    const { target } = plant(pat);
    if (!flagged(target)) notPlanted.push(pat + ' -> ' + target);
  }
  const mustKeep = [BASELINE, 'hooks/hooks.json', 'commands/mos-help.md', 'lib/core/graph.cjs', 'lib/core/navigation.cjs', 'scripts/doctor.cjs', 'data/framework-names.json'].concat(KEPT_TESTS);
  const wronglyFlagged = mustKeep.filter(flagged);
  if (notPlanted.length === 0 && wronglyFlagged.length === 0) ok('arm 4: the matcher flags a planted path for all ' + APPROVED.length + ' patterns and spares the must-keep paths');
  else bad('arm 4: the matcher flags every planted path and spares the must-keep paths', 'not flagged: ' + notPlanted.join('; ') + ' | wrongly flagged: ' + wronglyFlagged.join(', '));
}

// arm 5: npm honors each pattern in a synthetic tree
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos388-synth-'));
  try {
    const targets = [];
    const siblings = new Set();
    for (const pat of APPROVED) {
      const { target, sibling } = plant(pat);
      targets.push({ pat, target, sibling });
      for (const f of [target, sibling]) {
        fs.mkdirSync(path.join(tmp, path.dirname(f)), { recursive: true });
        fs.writeFileSync(path.join(tmp, f), 'x\n');
      }
      siblings.add(sibling);
    }
    for (const f of KEPT_TESTS) { fs.writeFileSync(path.join(tmp, f), 'x\n'); siblings.add(f); }
    const tops = [...new Set(APPROVED.map((p) => p.replace(/^!/, '').split('/')[0]))];
    const writePj = (extra) => fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ name: 'mos388-synth', version: '0.0.0', files: tops.concat(extra) }, null, 2));
    writePj([]);
    const base = pack(tmp);
    if (base.error || base.missing) bad('arm 5: the synthetic baseline pack ran', base.error || 'npm missing');
    else {
      const baseSet = new Set(base.files);
      const problems = [];
      for (const t of targets) {
        if (!baseSet.has(t.target)) problems.push('baseline lacks target ' + t.target);
        if (!baseSet.has(t.sibling)) problems.push('baseline lacks sibling ' + t.sibling);
      }
      for (const f of KEPT_TESTS) if (!baseSet.has(f)) problems.push('baseline lacks ' + f);
      for (const t of targets) {
        writePj([t.pat]);
        const one = pack(tmp);
        if (one.error) { problems.push('pack with ' + t.pat + ' failed: ' + one.error); continue; }
        const s = new Set(one.files);
        if (s.has(t.target)) problems.push(t.pat + ' did not remove ' + t.target);
        if (!s.has(t.sibling)) problems.push(t.pat + ' removed its sibling ' + t.sibling);
      }
      writePj(APPROVED);
      const all = pack(tmp);
      if (all.error) problems.push('combined pack failed: ' + all.error);
      else {
        const s = new Set(all.files);
        for (const t of targets) if (s.has(t.target)) problems.push('combined: ' + t.target + ' still ships');
        for (const f of siblings) if (!s.has(f)) problems.push('combined: ' + f + ' was removed');
      }
      if (problems.length === 0) ok('arm 5: npm removes the target and keeps the sibling for each of the ' + APPROVED.length + ' patterns, alone and combined');
      else bad('arm 5: npm honors each pattern', problems.slice(0, 8).join('; '));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// arm 6: package.json files
try {
  const files = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).files;
  const notOnce = APPROVED.filter((p) => files.filter((f) => f === p).length !== 1);
  const forbidden = files.filter((f) => /^!?(tests|docs|tools|ui)(\/|$)/.test(f));
  if (notOnce.length === 0 && forbidden.length === 0) ok('arm 6: package.json files holds each approved pattern once and no tests, docs, tools or ui entry');
  else bad('arm 6: package.json files holds each approved pattern once', 'not exactly once: ' + notOnce.join(', ') + ' | forbidden: ' + forbidden.join(', '));
} catch (e) { bad('arm 6: package.json parses', String(e.message)); }

process.stdout.write('\nRESULT: PASS=' + passed + ' FAIL=' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);
