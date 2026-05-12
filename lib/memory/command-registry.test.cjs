#!/usr/bin/env node
'use strict';

/**
 * Phase 122-02 -- command-registry generator + drift-tripwire tests.
 *
 * Registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] (since 122-01).
 * The bash-runner entrypoint tests/test-command-registry.cjs re-requires this
 * file (no duplication). Run: node lib/memory/command-registry.test.cjs
 * Exit 0 on pass, throws (assert) on any fail.
 *
 * Four assertion groups:
 *   1. `node scripts/build-command-registry.cjs --check` exits 0 -- the
 *      committed registry is non-stale AND every frameworks: entry resolves.
 *   2. data/command-registry.json shape: ontology_ref, commands.length ==
 *      count of commands/*.md, every command has kind in {methodology, utility,
 *      meta}, Array.isArray(frameworks), typeof autonomous_safe === 'boolean',
 *      and framework_index is the exact inverse of commands (round-trip).
 *   3. Algorithmic-cohort assertion: a representative subset of the
 *      computational cohort is registered as kind: methodology with a
 *      non-empty frameworks list (cohort must be chain-composable before the
 *      utility commands -- CRITICAL PATH, .planning/WORKFLOW-LAYER-SPEC.md).
 *   4. Canon Part 8 grep guard: no `/mos:` literal adjacent to a
 *      brain/query/fetch/http token in lib/workflow/ (or lib/brain/chain-
 *      recommender.cjs if it exists); lib/workflow/command-resolver.cjs (if it
 *      exists) does not require brain-client; the generator contains no
 *      write-Cypher. (Harmless before 122-03/04 ship those files.)
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'command-registry.json');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const GENERATOR = path.join(REPO_ROOT, 'scripts', 'build-command-registry.cjs');
const KIND_ENUM = ['methodology', 'utility', 'meta'];

// The representative algorithmic-cohort subset. Each must be a registered
// command, kind: methodology, frameworks.length > 0.
const COHORT = [
  '/mos:score-innovation',
  '/mos:whitespace',
  '/mos:explore-domains',
  '/mos:research',
  '/mos:think-hats',
  '/mos:rs-fetch',
  '/mos:find-bottlenecks',
  '/mos:diagnostics',
  '/mos:analyze-needs',
  '/mos:validate',
  '/mos:grade',
  '/mos:structure-argument',
];

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

// ---------------------------------------------------------------------------
// 1. --check exits 0
// ---------------------------------------------------------------------------
test('build-command-registry.cjs --check exits 0 (non-stale, all frameworks resolve)', () => {
  const r = spawnSync('node', [GENERATOR, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.strictEqual(
    r.status,
    0,
    'command-registry must not be stale and must have no unresolvable framework. stderr: ' +
      (r.stderr || '').trim()
  );
});

// ---------------------------------------------------------------------------
// 2. registry shape + inverse-map round-trip
// ---------------------------------------------------------------------------
test('registry shape: ontology_ref + commands count + per-command fields + inverse map', () => {
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  assert.strictEqual(reg.ontology_ref, 'data/framework-names.json', 'ontology_ref points at the snapshot');
  assert.ok(typeof reg.generated_note === 'string' && reg.generated_note.length > 0, 'generated_note present');
  assert.ok(Array.isArray(reg.commands), 'commands is an array');
  assert.ok(reg.framework_index && typeof reg.framework_index === 'object', 'framework_index is an object');
  assert.ok(Array.isArray(reg.curated_chains), 'curated_chains is an array');

  const mdCount = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md')).length;
  assert.strictEqual(reg.commands.length, mdCount, 'one registry entry per commands/*.md file');

  for (const c of reg.commands) {
    assert.ok(typeof c.command === 'string' && c.command.startsWith('/mos:'), 'command is a /mos: string: ' + c.command);
    assert.ok(KIND_ENUM.includes(c.kind), 'kind is one of methodology|utility|meta: ' + c.command + ' -> ' + c.kind);
    assert.ok(Array.isArray(c.frameworks), 'frameworks is an array: ' + c.command);
    assert.strictEqual(typeof c.autonomous_safe, 'boolean', 'autonomous_safe is a boolean: ' + c.command);
    assert.ok('produces' in c, 'produces key present: ' + c.command);
    assert.ok(Array.isArray(c.inputs), 'inputs is an array: ' + c.command);
    assert.ok('body_shape' in c, 'body_shape key present: ' + c.command);
  }

  // framework_index is the EXACT inverse of commands:
  //   (a) for every command c and every fw in c.frameworks, framework_index[fw]
  //       includes c.command;
  //   (b) framework_index has no key not produced by some command, and no
  //       command listed under a framework it does not declare.
  const declared = {}; // fw -> Set(commands)
  for (const c of reg.commands) {
    for (const fw of c.frameworks) {
      if (!declared[fw]) declared[fw] = new Set();
      declared[fw].add(c.command);
    }
  }
  // (a)
  for (const c of reg.commands) {
    for (const fw of c.frameworks) {
      assert.ok(Array.isArray(reg.framework_index[fw]), 'framework_index has key for ' + fw);
      assert.ok(reg.framework_index[fw].includes(c.command), 'framework_index[' + fw + '] includes ' + c.command);
    }
  }
  // (b)
  const idxKeys = Object.keys(reg.framework_index);
  assert.deepStrictEqual(
    idxKeys.slice().sort(),
    Object.keys(declared).sort(),
    'framework_index keys == set of frameworks declared by some command'
  );
  for (const fw of idxKeys) {
    for (const cmd of reg.framework_index[fw]) {
      assert.ok(declared[fw].has(cmd), 'framework_index[' + fw + '] only lists commands that declare ' + fw + ': ' + cmd);
    }
    // No duplicate command under a single framework.
    assert.strictEqual(
      new Set(reg.framework_index[fw]).size,
      reg.framework_index[fw].length,
      'no duplicate command under framework ' + fw
    );
  }
});

// ---------------------------------------------------------------------------
// 3. algorithmic-cohort assertion
// ---------------------------------------------------------------------------
test('algorithmic cohort is registered as methodology with non-empty frameworks', () => {
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const byCmd = new Map(reg.commands.map((c) => [c.command, c]));
  for (const slug of COHORT) {
    const c = byCmd.get(slug);
    assert.ok(c, 'cohort command registered: ' + slug);
    assert.strictEqual(c.kind, 'methodology', 'cohort command is kind: methodology: ' + slug);
    assert.ok(c.frameworks.length > 0, 'cohort command has a non-empty frameworks list: ' + slug);
  }
});

// ---------------------------------------------------------------------------
// 4. Canon Part 8 grep guard
// ---------------------------------------------------------------------------
function listCjs(dir) {
  let out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listCjs(full));
    else if (e.isFile() && e.name.endsWith('.cjs')) out.push(full);
  }
  return out;
}

test('Canon Part 8: no /mos: command literal adjacent to a Brain-query token in lib/workflow/', () => {
  const files = listCjs(path.join(REPO_ROOT, 'lib', 'workflow'));
  const recommender = path.join(REPO_ROOT, 'lib', 'brain', 'chain-recommender.cjs');
  if (fs.existsSync(recommender)) files.push(recommender);

  const BRAIN_TOKEN = /\b(brain|query|fetch|http)\b/i;
  const MOS_LITERAL = /\/mos:[a-z][a-z0-9-]*/;
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!MOS_LITERAL.test(line)) continue;
      // Check the line itself and its immediate neighbors (a ~3-line window
      // ~= 80 chars of context) for a Brain-query token.
      const window = [lines[i - 1] || '', line, lines[i + 1] || ''].join('\n');
      assert.ok(
        !BRAIN_TOKEN.test(window),
        'Canon Part 8 breach risk: a /mos: literal sits next to a brain/query/fetch/http token in ' +
          path.relative(REPO_ROOT, f) +
          ':' +
          (i + 1) +
          ' -- commands must never reach the Brain'
      );
    }
  }
});

test('Canon Part 8: command-resolver.cjs (if present) does not require brain-client', () => {
  const resolver = path.join(REPO_ROOT, 'lib', 'workflow', 'command-resolver.cjs');
  if (!fs.existsSync(resolver)) return; // not shipped until 122-03 -- harmless
  const src = fs.readFileSync(resolver, 'utf8');
  assert.ok(
    !/require\(\s*['"][^'"]*brain-client[^'"]*['"]\s*\)/.test(src),
    'lib/workflow/command-resolver.cjs must not require brain-client -- the resolver is pure and never touches the Brain'
  );
});

test('Canon Part 8: the registry generator contains no write-Cypher', () => {
  const src = fs.readFileSync(GENERATOR, 'utf8');
  assert.ok(
    !/\b(CREATE|MERGE|SET|DELETE|DETACH)\s/i.test(src),
    'scripts/build-command-registry.cjs must contain no write-Cypher keyword -- the only Brain touch is a read-only brain.query in --refresh-names'
  );
});

process.stdout.write('command-registry.test.cjs: ' + passed + ' assertion group(s) PASSED\n');
process.exit(0);
