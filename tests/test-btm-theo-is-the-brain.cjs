#!/usr/bin/env node
'use strict';
/**
 * tests/test-btm-theo-is-the-brain.cjs (quick 261019-btm)
 *
 * Proves that no file Larry reads names a retired Brain route.
 *
 * Why: Theo is the Brain since Phase 339 (2026-09-03). The brain-connector
 * skill sent Larry on Desktop and Cowork to the tools of the retired
 * pws-brain-mcp server until 2026-10-19. The /mos:pws-brain harness compared
 * two backends that both left production on 2026-07-22. Quick 261019-btm
 * retired the command and rewrote the route. This test keeps both fixed.
 *
 * Scan set: the Larry-facing directories (SCAN_DIRS) and files (SCAN_FILES).
 * Three tokens are retired as a Brain route: pws-brain-mcp, Memgraph and
 * mindrian-brain.onrender.com.
 *
 * Allow-list rule: ALLOWLIST holds exactly the files that keep a token as a
 * dated historical record. Each entry carries a reason. A stale entry (the
 * file is gone, or it has no hit left) fails, so the list cannot rot.
 *
 * Not scanned: the guard files (hook matchers and sanitize code must keep
 * catching a legacy pws-brain-mcp connector), docs, dist, tests, .planning
 * and CHANGELOG.md. They are guard code or history.
 *
 * No network, no git call, no child process. The checks run only when this
 * file is the main module.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const TOKENS = [
  { label: 'pws-brain-mcp', re: /pws-brain-mcp/i },
  { label: 'mindrian-brain.onrender.com', re: /mindrian-brain\.onrender\.com/i },
  { label: 'memgraph', re: /\bmemgraph\b/i },
];

const SCAN_DIRS = [
  'agents', 'skills', 'commands', 'references', 'output-styles',
  'pipelines', 'templates', 'lib/mcp',
];

const SCAN_FILES = [
  'scripts/mindrian-mcp-server.cjs',
  'scripts/mindrian-brain-mcp-client.cjs',
  'bin/mindrian-brain-mcp-client.cjs',
  'scripts/power-demo-prompt.md',
  '.mcp.json',
];

const ALLOWLIST = {
  'lib/mcp/brain-composition-census.cjs':
    'Phase 254/257 ruling record in a code comment, marked historical by quick 261019-btm; never sent to the model',
  'references/capability-radar/changelog-cache.md':
    'dated radar view rendered from data/capability-ledger.json (the Claude Code 2.1.280 entry, 2026-09-22); only /mos:radar --fetch regenerates it; an observation, not a route',
};

/** Return the labels of the retired tokens found in text. */
function scanText(text) {
  const found = [];
  for (const t of TOKENS) {
    if (t.re.test(text)) found.push(t.label);
  }
  return found;
}

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) out.push(full);
  }
}

function isBinary(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(8000);
    const n = fs.readSync(fd, buf, 0, 8000, 0);
    return buf.subarray(0, n).includes(0);
  } catch (_e) {
    return true;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_e) { /* ignore */ } }
  }
}

/** Return [{file, line, token}] for every matching line in the scan set. */
function scanTree(root) {
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(root, d), files);
  for (const f of SCAN_FILES) {
    const full = path.join(root, f);
    if (fs.existsSync(full)) files.push(full);
  }
  const hits = [];
  for (const full of files) {
    if (isBinary(full)) continue;
    let text;
    try { text = fs.readFileSync(full, 'utf8'); } catch (_e) { continue; }
    const rel = path.relative(root, full).split(path.sep).join('/');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      for (const token of scanText(lines[i])) {
        hits.push({ file: rel, line: i + 1, token });
      }
    }
  }
  return hits;
}

function collectMatchers(node, out) {
  if (Array.isArray(node)) {
    for (const n of node) collectMatchers(n, out);
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      if (k === 'matcher' && typeof node[k] === 'string') out.push(node[k]);
      else collectMatchers(node[k], out);
    }
  }
}

function run() {
  let passed = 0;
  let failed = 0;
  function check(name, fn) {
    try {
      fn();
      passed += 1;
      console.log('PASS: ' + name);
    } catch (err) {
      failed += 1;
      const msg = String(err && err.message ? err.message : err);
      const lines = msg.split('\n');
      console.log('FAIL: ' + name + ': ' + lines[0]);
      for (const l of lines.slice(1)) console.log(l);
    }
  }

  check('C1 negative control: scanText flags the retired routes and spares the live ones', () => {
    assert.deepStrictEqual(scanText('Larry reaches the Brain via the `pws-brain-mcp` MCP tools'), ['pws-brain-mcp']);
    assert.deepStrictEqual(scanText('https://mindrian-brain.onrender.com'), ['mindrian-brain.onrender.com']);
    assert.deepStrictEqual(scanText('the unified Memgraph backend'), ['memgraph']);
    assert.deepStrictEqual(scanText('index `pws-brain`, namespace `tools`'), []);
    assert.deepStrictEqual(scanText('https://theo-mcp.onrender.com'), []);
  });

  const hits = scanTree(REPO_ROOT);

  check('C2 scan: no Larry-facing file outside the allow-list names a retired Brain route', () => {
    const bad = hits.filter((h) => !Object.prototype.hasOwnProperty.call(ALLOWLIST, h.file));
    if (bad.length > 0) {
      throw new Error(bad.length + ' hit(s) outside the allow-list:\n' +
        bad.map((h) => '  ' + h.file + ':' + h.line + ':' + h.token).join('\n'));
    }
  });

  check('C3 allow-list hygiene: each entry exists and still has a hit', () => {
    const stale = [];
    for (const rel of Object.keys(ALLOWLIST)) {
      if (!fs.existsSync(path.join(REPO_ROOT, rel))) { stale.push(rel + ' (missing)'); continue; }
      if (!hits.some((h) => h.file === rel)) stale.push(rel + ' (no hit left)');
    }
    assert.strictEqual(stale.length, 0, 'stale allow-list entries: ' + stale.join(', '));
  });

  check('C4 retirement: /mos:pws-brain is gone and recorded as retired', () => {
    assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'commands', 'pws-brain.md')), 'commands/pws-brain.md exists');
    assert.ok(!fs.existsSync(path.join(REPO_ROOT, 'skills', 'pws-brain')), 'skills/pws-brain exists');
    const registry = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'command-registry.json'), 'utf8'));
    const text = JSON.stringify(registry);
    assert.ok(!/\/mos:pws-brain"/.test(text), 'data/command-registry.json lists /mos:pws-brain');
    const dep = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'data', 'command-deprecations.json'), 'utf8'));
    const entry = (dep.deprecations || []).find((d) => d.command === '/mos:pws-brain');
    assert.ok(entry, 'data/command-deprecations.json has no /mos:pws-brain entry');
    assert.strictEqual(entry.replaced_by, null, 'replaced_by must be null');
  });

  check('C5 route: the brain-connector enrichment section names the Theo route', () => {
    const lines = fs.readFileSync(path.join(REPO_ROOT, 'skills', 'brain-connector', 'SKILL.md'), 'utf8').split('\n');
    const start = lines.findIndex((l) => l.startsWith('## Enrichment-Queue Auto-Append'));
    assert.ok(start !== -1, 'section "## Enrichment-Queue Auto-Append" not found');
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i += 1) {
      if (lines[i].startsWith('## ')) { end = i; break; }
    }
    const section = lines.slice(start, end).join('\n');
    const missing = ['mindrian-brain', 'scripts/mindrian-brain-mcp-client.cjs', 'lib/core/brain-client.cjs', 'theo-mcp.onrender.com']
      .filter((s) => !section.includes(s));
    assert.strictEqual(missing.length, 0, 'section lacks: ' + missing.join(', '));
  });

  check('C6 guard pin: the matchers still catch a legacy pws-brain-mcp connector', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'brain-response-sanitize.cjs'), 'utf8');
    const line = src.split('\n').find((l) => l.startsWith('const BRAIN_TOOL_MATCHER ='));
    assert.ok(line, 'const BRAIN_TOOL_MATCHER line not found');
    assert.ok(line.includes('pws-brain-mcp'), 'BRAIN_TOOL_MATCHER no longer names pws-brain-mcp');
    const hooks = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'hooks', 'hooks.json'), 'utf8'));
    const matchers = [];
    collectMatchers(hooks, matchers);
    const brain = matchers.filter((m) => m.includes('mindrian-brain'));
    assert.ok(brain.length >= 2, 'expected at least 2 matchers naming mindrian-brain, found ' + brain.length);
    const lacking = brain.filter((m) => !m.includes('pws-brain-mcp'));
    assert.strictEqual(lacking.length, 0, lacking.length + ' matcher(s) name mindrian-brain but not pws-brain-mcp');
  });

  console.log('test-btm: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}

if (require.main === module) run();

module.exports = { TOKENS, SCAN_DIRS, SCAN_FILES, ALLOWLIST, scanText, scanTree };
