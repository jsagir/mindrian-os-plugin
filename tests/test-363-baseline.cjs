#!/usr/bin/env node
'use strict';

// Phase 363 (Deep Research Planner) Plan 01 Task 1 - pre-phase baseline test.
//
// Proves that tests/fixtures/363-pre-phase.json faithfully pins the state of
// this repo the instant before any Phase 363 edit landed: the base commit,
// the registry digests, the full-text, body and frontmatter-key fingerprints
// of the eight command files 363 touches or must leave alone, the exact
// anchor paragraphs later plans amend (research.md auto-dispatch rule, the
// whitespace routing table, the scout / scheduled-tasks zero-egress
// sentences), the count of commands carrying the quick-pass ask line, and
// the dependency sets (D-01, DRP363-18).
//
// This test NEVER reads the working-tree copy of a command file: later 363
// plans legitimately edit them. Every value is recomputed from
// `git show <base_sha>:<path>` and compared with the fixture.
//
// The extraction helpers are exported so later test-363-*.cjs files reuse
// the exact same slice rules instead of re-deriving them.
//
// exit 0  -> PASSED (all seven legs)
// exit 1  -> FAILED
// exit 77 -> SKIPPED (ENV GAP: git unavailable)
//
// House rule: hyphens only; the two dash characters appear below only as
// JavaScript unicode escapes.

const { scrubVendorKey, installNetGuard } = require('./helpers/hygiene-355.cjs');
scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
const NET = installNetGuard();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', '363-pre-phase.json');

const REGISTRY_PATHS = [
  'data/command-registry.json',
  'data/connector-registry.json',
  'data/mcp-tool-connectors.json',
  'data/harness-manifest.json',
  'data/floor-ledger.json',
];

const COMMAND_PATHS = [
  'commands/map-unknowns.md',
  'commands/root-cause.md',
  'commands/think-hats.md',
  'commands/diffusion.md',
  'commands/whitespace.md',
  'commands/research.md',
  'commands/scout.md',
  'commands/scheduled-tasks.md',
];

const QUICK_PASS_LINE = 'Ask: "Quick pass or deep dive?"';
const EM_DASH = '—';
const EN_DASH = '–';

// --- helpers ---------------------------------------------------------------

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitShow(sha, filePath) {
  return git(['show', `${sha}:${filePath}`]);
}

function gitLsTree(sha, dir) {
  return git(['ls-tree', '--name-only', sha, dir + '/'])
    .split('\n')
    .filter(Boolean);
}

// Split a markdown file into { frontmatter, body }. The frontmatter is the
// text between the first line `---` and the next line `---`; the body is the
// text after that closing line. A file without frontmatter has body = text.
function splitFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return { frontmatter: null, body: text };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      return {
        frontmatter: lines.slice(1, i).join('\n'),
        body: lines.slice(i + 1).join('\n'),
      };
    }
  }
  return { frontmatter: null, body: text };
}

function frontmatterKeys(text) {
  const { frontmatter } = splitFrontmatter(text);
  if (frontmatter === null) return [];
  const keys = [];
  for (const line of frontmatter.split('\n')) {
    const m = /^([A-Za-z0-9_][A-Za-z0-9_-]*):/.exec(line);
    if (m) keys.push(m[1]);
  }
  return keys;
}

function commandFingerprint(text) {
  return {
    body_sha256: sha256(splitFrontmatter(text).body),
    frontmatter_keys: frontmatterKeys(text),
    sha256: sha256(text),
  };
}

// research.md: the paragraph that starts "**Auto-dispatch rule" and runs to
// the next blank line.
function extractAutoDispatchParagraph(text) {
  const start = text.indexOf('**Auto-dispatch rule');
  if (start === -1) return null;
  const end = text.indexOf('\n\n', start);
  if (end === -1) return null;
  return text.slice(start, end);
}

// whitespace.md: every table line under "## Subcommand Routing" up to the
// next heading.
function extractWhitespaceRoutingLines(text) {
  const lines = text.split('\n');
  const start = lines.indexOf('## Subcommand Routing');
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) break;
    if (lines[i].startsWith('|')) out.push(lines[i]);
  }
  return out.length ? out : null;
}

// The sentence (split on ". " boundaries inside one line) that contains
// "zero-egress". Returns the first such sentence, trailing period kept.
function extractZeroEgressSentence(text) {
  for (const line of text.split('\n')) {
    const idx = line.indexOf('zero-egress');
    if (idx === -1) continue;
    let s = line.lastIndexOf('. ', idx);
    s = s === -1 ? 0 : s + 2;
    let e = line.indexOf('. ', idx);
    e = e === -1 ? line.length : e + 1;
    return line.slice(s, e);
  }
  return null;
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    n += 1;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

function quickPassLineCount(sha) {
  let n = 0;
  for (const p of gitLsTree(sha, 'commands')) {
    if (!p.endsWith('.md')) continue;
    const lines = gitShow(sha, p).split('\n');
    if (lines.includes(QUICK_PASS_LINE)) n += 1;
  }
  return n;
}

function depsFromTexts(pkgText, shrinkText) {
  const pkg = JSON.parse(pkgText);
  const shrink = JSON.parse(shrinkText);
  const pj = [];
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const set = pkg[field] || {};
    for (const name of Object.keys(set)) pj.push(`${field}:${name}@${set[name]}`);
  }
  pj.sort();
  const keys = Object.keys(shrink.packages || {}).sort();
  return {
    package_json: pj,
    package_json_sha256: sha256(pj.join('\n')),
    shrinkwrap_packages_count: keys.length,
    shrinkwrap_packages_sha256: sha256(keys.join('\n')),
  };
}

function depsAt(sha) {
  return depsFromTexts(gitShow(sha, 'package.json'), gitShow(sha, 'npm-shrinkwrap.json'));
}

function depsInWorkingTree() {
  return depsFromTexts(
    fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'npm-shrinkwrap.json'), 'utf8')
  );
}

function anchorsAt(sha) {
  return {
    'commands/research.md': [extractAutoDispatchParagraph(gitShow(sha, 'commands/research.md'))],
    'commands/scheduled-tasks.md': [extractZeroEgressSentence(gitShow(sha, 'commands/scheduled-tasks.md'))],
    'commands/scout.md': [extractZeroEgressSentence(gitShow(sha, 'commands/scout.md'))],
    'commands/whitespace.md': extractWhitespaceRoutingLines(gitShow(sha, 'commands/whitespace.md')),
  };
}

// Recursively sort object keys (arrays keep their order) for a stable file.
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}

// computeFixture(sha) - the single function the fixture was generated with.
function computeFixture(sha, capturedAt) {
  const registry = {};
  for (const p of REGISTRY_PATHS) registry[p] = sha256(gitShow(sha, p));
  const commands = {};
  for (const p of COMMAND_PATHS) commands[p] = commandFingerprint(gitShow(sha, p));
  return sortKeys({
    anchors: anchorsAt(sha),
    base_sha: sha,
    captured_at: capturedAt,
    commands,
    deps: depsAt(sha),
    note:
      'Pinned before any Phase 363 edit landed (base_sha = PLAN_BASE of 363-01). Every later 363 test reads this fixture as the pre-phase truth; tests/test-363-baseline.cjs recomputes every value from git objects.',
    quick_pass_line_count: quickPassLineCount(sha),
    registry,
  });
}

function loadFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

module.exports = {
  sha256,
  gitShow,
  splitFrontmatter,
  frontmatterKeys,
  commandFingerprint,
  extractAutoDispatchParagraph,
  extractWhitespaceRoutingLines,
  extractZeroEgressSentence,
  countOccurrences,
  quickPassLineCount,
  depsAt,
  depsInWorkingTree,
  computeFixture,
  loadFixture,
  sortKeys,
  FIXTURE_PATH,
  REGISTRY_PATHS,
  COMMAND_PATHS,
  QUICK_PASS_LINE,
};

// --- runner ------------------------------------------------------------------

if (require.main === module) {
  try {
    git(['--version']);
  } catch (_e) {
    console.log('SKIPPED (ENV GAP): git is not available');
    process.exit(77);
  }

  let fixture;
  try {
    fixture = loadFixture();
  } catch (err) {
    console.log(`FAIL: fixture not readable at ${FIXTURE_PATH} -- ${err.message}`);
    process.exit(1);
  }

  let pass = 0;
  let fail = 0;
  function leg(name, fn) {
    try {
      fn();
      console.log(`PASS: ${name}`);
      pass += 1;
    } catch (err) {
      console.log(`FAIL: ${name} -- ${err && err.message ? err.message : err}`);
      fail += 1;
    }
  }

  const base = fixture.base_sha;

  leg('1 base_sha is 40-hex and an ancestor of HEAD', () => {
    if (!/^[0-9a-f]{40}$/.test(base)) throw new Error(`base_sha is not 40-hex: ${base}`);
    git(['merge-base', '--is-ancestor', base, 'HEAD']);
  });

  leg('2 every registry digest recomputes from git show <base_sha>', () => {
    const keys = Object.keys(fixture.registry || {}).sort();
    if (!deepEqual(keys, REGISTRY_PATHS.slice().sort())) throw new Error('registry key set differs');
    for (const p of keys) {
      const got = sha256(gitShow(base, p));
      if (got !== fixture.registry[p]) throw new Error(`${p}: got ${got}, fixture ${fixture.registry[p]}`);
    }
  });

  leg('3 every command digest, body digest and frontmatter key list recomputes', () => {
    const keys = Object.keys(fixture.commands || {}).sort();
    if (!deepEqual(keys, COMMAND_PATHS.slice().sort())) throw new Error('command key set differs');
    for (const p of keys) {
      const got = commandFingerprint(gitShow(base, p));
      const want = fixture.commands[p];
      if (got.sha256 !== want.sha256) throw new Error(`${p}: sha256 mismatch`);
      if (got.body_sha256 !== want.body_sha256) throw new Error(`${p}: body_sha256 mismatch`);
      if (!deepEqual(got.frontmatter_keys, want.frontmatter_keys)) throw new Error(`${p}: frontmatter_keys mismatch`);
      if (!want.frontmatter_keys.length) throw new Error(`${p}: no frontmatter keys pinned`);
    }
  });

  leg('4 every anchor string occurs exactly once at base_sha', () => {
    const paths = Object.keys(fixture.anchors || {});
    if (paths.length !== 4) throw new Error(`expected 4 anchored files, got ${paths.length}`);
    let n = 0;
    for (const p of paths) {
      const text = gitShow(base, p);
      for (const a of fixture.anchors[p]) {
        if (typeof a !== 'string' || !a.length) throw new Error(`${p}: empty anchor`);
        const c = countOccurrences(text, a);
        if (c !== 1) throw new Error(`${p}: anchor occurs ${c} times: ${a.slice(0, 60)}`);
        n += 1;
      }
    }
    if (!fixture.anchors['commands/research.md'][0].includes('NEVER auto-fires')) {
      throw new Error('research.md anchor is not the auto-dispatch rule');
    }
    for (const p of ['commands/scout.md', 'commands/scheduled-tasks.md']) {
      if (!fixture.anchors[p][0].includes('zero-egress')) throw new Error(`${p}: anchor lacks zero-egress`);
    }
    if (!fixture.anchors['commands/whitespace.md'].some((l) => l.includes('`external`'))) {
      throw new Error('whitespace routing table lacks the external row');
    }
    if (n < 4) throw new Error('too few anchors');
  });

  leg('5 quick_pass_line_count recomputes at base_sha', () => {
    const got = quickPassLineCount(base);
    if (got !== fixture.quick_pass_line_count) {
      throw new Error(`got ${got}, fixture ${fixture.quick_pass_line_count}`);
    }
    if (got < 1) throw new Error('count must be positive');
  });

  leg('6 dependency sets recompute at base_sha', () => {
    const got = depsAt(base);
    if (!deepEqual(sortKeys(got), sortKeys(fixture.deps))) throw new Error('deps differ from fixture');
  });

  leg('7 the fixture file holds no em-dash or en-dash', () => {
    const raw = fs.readFileSync(FIXTURE_PATH, 'utf8');
    if (raw.includes(EM_DASH) || raw.includes(EN_DASH)) throw new Error('dash character found in fixture');
    if (NET.attempts() !== 0) throw new Error('a network attempt was made');
  });

  console.log(`PASSED=${pass} FAILED=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}
