/**
 * MindrianOS Plugin - MOAT-02 kuzu-reintroduction gate tests
 *
 * Twelve legs proving scripts/check-kuzu-reintroduction.cjs is a real control
 * and not a decoration:
 *   - it passes on the live tree through the DEFAULT root, which is the path
 *     scripts/verify-release actually invokes
 *   - it fires at three independent seeded reintroduction shapes (a live
 *     require, a package.json dependency key, a package-lock package path key)
 *   - it exits 2 rather than passing at two independent scanner-failure shapes
 *     (a missing root, and a root with nothing to scan)
 *   - its allowlist is size-fenced, because growing an allowlist is how a gate
 *     like this gets neutered without anyone noticing
 *   - the dead docs/MOAT-MANDATE.md prose is really gone and really replaced
 *   - the gate is really WIRED into verify-release, asserted after comment
 *     stripping so a banner comment cannot stand in for the gate
 *   - the new script makes zero network reach (Canon Part 8), asserted by a
 *     sweep that first proves itself against synthetic planted tokens
 *
 * Fully hermetic: every fixture lives under mkdtemp, nothing is written inside
 * the repository, and the live tree is only ever read.
 *
 * Run: node tests/test-242-kuzu-reintroduction-gate.cjs
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-kuzu-reintroduction.cjs');
const VERIFY_RELEASE = path.join(REPO_ROOT, 'scripts', 'verify-release');
const MOAT_MANDATE = path.join(REPO_ROOT, 'docs', 'MOAT-MANDATE.md');

// --- Helpers ---

function runGate(args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

// A scratch root with a valid manifest, no kuzu anywhere, and one clean source
// file so the walk finds something and the zero-files exit-2 guard stays quiet.
function makeScratchRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-242-kuzu-'));
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'mindrian-242-scratch', version: '0.0.0', private: true, dependencies: {} }, null, 2) + '\n',
    'utf8'
  );
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'lib', 'clean.cjs'),
    "'use strict';\nconst path = require('node:path');\nmodule.exports = { path };\n",
    'utf8'
  );
  return root;
}

// A scratch root with a manifest but NO source files at all.
function makeEmptyScratchRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mindrian-242-kuzu-'));
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'mindrian-242-empty', version: '0.0.0', private: true }, null, 2) + '\n',
    'utf8'
  );
  return root;
}

function cleanup(root) {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch (_e) {
    // ignore cleanup errors
  }
}

// This test file is one of the two ALLOWLIST entries precisely so its own
// source may carry the literal forbidden strings the fixtures below seed.
function seedRequireFixture(root) {
  const target = path.join(root, 'lib', 'clean.cjs');
  fs.appendFileSync(target, "const kuzu = require('kuzu');\nmodule.exports.kuzu = kuzu;\n", 'utf8');
  return path.relative(root, target).split(path.sep).join('/');
}

function seedDependencyFixture(root) {
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(
      { name: 'mindrian-242-scratch', version: '0.0.0', private: true, dependencies: { kuzu: '^0.11.3' } },
      null,
      2
    ) + '\n',
    'utf8'
  );
}

function seedLockFixture(root) {
  fs.writeFileSync(
    path.join(root, 'package-lock.json'),
    JSON.stringify(
      {
        name: 'mindrian-242-scratch',
        version: '0.0.0',
        lockfileVersion: 3,
        requires: true,
        packages: {
          '': { name: 'mindrian-242-scratch', version: '0.0.0' },
          'node_modules/kuzu': { version: '0.11.3', resolved: '', integrity: '' },
        },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
}

// Strip whole-line comments so header prose can neither trip a grep nor satisfy one.
function stripCommentLines(text) {
  return text
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|#)/.test(line))
    .join('\n');
}

const PART8_PATTERNS = [
  { label: 'https/http URL', re: /https?:\/\// },
  { label: 'fetch(', re: /fetch\(/ },
  { label: 'axios', re: /axios/ },
  { label: 'WebFetch', re: /WebFetch/ },
  { label: 'brain host', re: /mindrian-brain\.onrender\.com/ },
  { label: 'anthropic api host', re: /api\.anthropic\.com/ },
];

// The live-tree run is expensive (roughly 1900 files), so run it once and share
// the result between leg 1 and leg 8.
let liveTreeResult = null;
function liveTree() {
  if (liveTreeResult === null) liveTreeResult = runGate([]);
  return liveTreeResult;
}

// --- Legs ---

describe('MOAT-02: kuzu-reintroduction gate', () => {
  it('leg 1: passes (exit 0) on the current, unmodified tree', () => {
    const result = liveTree();
    assert.equal(
      result.status,
      0,
      'default-root run must exit 0 on the live tree. stdout=' + result.stdout + ' stderr=' + result.stderr
    );
    assert.match(result.stdout, /PASS/, 'a clean run must print a PASS line');
  });

  it('leg 2: passes (exit 0) on a clean scratch root', () => {
    const root = makeScratchRoot();
    try {
      const result = runGate(['--root', root]);
      assert.equal(result.status, 0, 'clean scratch root must exit 0. stderr=' + result.stderr);
    } finally {
      cleanup(root);
    }
  });

  it('leg 3: fails (exit 1) on a seeded live require', () => {
    const root = makeScratchRoot();
    try {
      assert.equal(runGate(['--root', root]).status, 0, 'scratch root must start clean');
      const seededRel = seedRequireFixture(root);
      const result = runGate(['--root', root]);
      assert.equal(result.status, 1, 'a seeded live require must exit 1');
      const output = result.stdout + result.stderr;
      assert.ok(output.includes(seededRel), 'output must name the seeded file ' + seededRel + '. Got: ' + output);
    } finally {
      cleanup(root);
    }
  });

  it('leg 4: fails (exit 1) on a seeded package.json dependency', () => {
    const root = makeScratchRoot();
    try {
      assert.equal(runGate(['--root', root]).status, 0, 'scratch root must start clean');
      seedDependencyFixture(root);
      const result = runGate(['--root', root]);
      assert.equal(result.status, 1, 'a seeded dependency key must exit 1');
      const output = result.stdout + result.stderr;
      assert.match(output, /package\.json:\d+/, 'output must name package.json with a line number. Got: ' + output);
    } finally {
      cleanup(root);
    }
  });

  it('leg 5: fails (exit 1) on a seeded package-lock node_modules path', () => {
    const root = makeScratchRoot();
    try {
      assert.equal(runGate(['--root', root]).status, 0, 'scratch root must start clean');
      seedLockFixture(root);
      const result = runGate(['--root', root]);
      assert.equal(result.status, 1, 'a seeded lockfile package path must exit 1');
      const output = result.stdout + result.stderr;
      assert.match(output, /package-lock\.json:\d+/, 'output must name package-lock.json. Got: ' + output);
    } finally {
      cleanup(root);
    }
  });

  it('leg 6: exits 2 on a missing root', () => {
    const missing = path.join(os.tmpdir(), 'definitely-not-a-real-root-242');
    const result = runGate(['--root', missing]);
    assert.equal(result.status, 2, 'a missing root is a scanner failure, not a pass and not a violation');
  });

  it('leg 7: exits 2 rather than passing when there is nothing to scan', () => {
    const root = makeEmptyScratchRoot();
    try {
      const result = runGate(['--root', root]);
      assert.equal(result.status, 2, 'a scanner that scanned nothing must never report PASS');
    } finally {
      cleanup(root);
    }
  });

  it('leg 8: does not false-positive on the six legitimate historical kuzu mentions', () => {
    const legitimate = [
      'bin/mindrian-tools.cjs',
      'lib/core/graph-ops.cjs',
      'scripts/hsi-to-graph.cjs',
      'scripts/causal-to-graph.cjs',
      'scripts/migrate-lazygraph.cjs',
      'scripts/whitespace-to-graph.cjs',
    ];
    for (const rel of legitimate) {
      const content = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      assert.ok(
        /kuzu/i.test(content),
        rel + ' must still contain the string kuzu, otherwise this fence proves nothing'
      );
    }
    // The two facts together ARE the fence. Either one alone proves nothing.
    assert.equal(liveTree().status, 0, 'the live tree must still pass while all six files keep their kuzu mentions');
  });

  it('leg 9: allowlist is size-fenced at exactly two documented entries', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const block = src.match(/const ALLOWLIST = new Set\(\[([\s\S]*?)\]\);/);
    assert.ok(block, 'could not find the ALLOWLIST literal in the gate source');
    // Drop trailing // comments first: the written reasons contain apostrophes.
    const body = block[1]
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, ''))
      .join('\n');
    const entries = (body.match(/'[^']*'/g) || []).map((s) => s.slice(1, -1));
    assert.equal(entries.length, 2, 'ALLOWLIST must hold exactly two entries, got: ' + JSON.stringify(entries));
    assert.deepEqual(
      entries.slice().sort(),
      ['scripts/check-kuzu-reintroduction.cjs', 'tests/test-242-kuzu-reintroduction-gate.cjs'].sort(),
      'ALLOWLIST members must be exactly the gate itself and this test file'
    );
  });

  it('leg 10: the dead KuzuDB checklist prose is gone and replaced', () => {
    const doc = fs.readFileSync(MOAT_MANDATE, 'utf8');
    const dead = (doc.match(/Does this work without KuzuDB edges/g) || []).length;
    const pointer = (doc.match(/check-kuzu-reintroduction\.cjs/g) || []).length;
    assert.equal(dead, 0, 'the dead prose question must be gone');
    assert.equal(pointer, 1, 'the replacement must point at the gate exactly once (two-sided, so an emptied file fails)');
  });

  it('leg 11: the gate is wired into verify-release, not merely present on disk', () => {
    const raw = fs.readFileSync(VERIFY_RELEASE, 'utf8');
    const executable = raw
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
    const hits = (executable.match(/check-kuzu-reintroduction\.cjs/g) || []).length;
    assert.equal(hits, 1, 'comment-stripped verify-release must invoke the gate exactly once, got ' + hits);
    assert.match(raw, /17\. Kuzu Reintroduction Gate/, 'section 17 heading must exist');
  });

  it('leg 12: Part 8 sweep - the new script makes zero network reach', () => {
    // Negative self-test FIRST: a grep gate that quietly stopped matching looks
    // exactly like a clean file, so the sweep proves itself before it is trusted.
    const plantedExecutable = [
      "  const u = 'https://example.com/api';",
      "  const u2 = 'http://example.com/api';",
      '  const r = await fetch(url);',
      "  const client = require('axios');",
      "  const tool = 'WebFetch';",
      "  const host = 'mindrian-brain.onrender.com';",
      "  const h = 'api.anthropic.com';",
    ];
    for (const line of plantedExecutable) {
      const stripped = stripCommentLines(line);
      const caught = PART8_PATTERNS.some((p) => p.re.test(stripped));
      assert.ok(caught, 'the Part 8 sweep is blind to a planted executable token: ' + line);
    }
    const plantedComment = '// never fetch( from https://mindrian-brain.onrender.com via axios';
    assert.equal(
      stripCommentLines(plantedComment).trim(),
      '',
      'a comment line naming egress must be stripped before the sweep, not matched'
    );

    // Now the real sweep.
    const executable = stripCommentLines(fs.readFileSync(SCRIPT, 'utf8'));
    for (const p of PART8_PATTERNS) {
      assert.ok(
        !p.re.test(executable),
        'forbidden egress token on an executable line of ' + path.basename(SCRIPT) + ': ' + p.label
      );
    }
  });
});
