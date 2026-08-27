#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 267.3 Plan 02 -- the out-of-frontmatter first-reward declaration path
 * ======================================================================
 * The gap this pins, stated plainly: the reward-before-investment guard reads
 * `interactive_first_reward` out of `commands/*.md` frontmatter. A bash hook
 * has no frontmatter block, so `scripts/session-start` -- which emits the very
 * first prose a new user ever sees -- had no way to declare anything, and the
 * guard could not reach it. Ruling D-A (267.3-DECISIONS.md) put the
 * declaration in a sibling registry, `data/first-reward-surfaces.json`, read by
 * `scanDeclaredSurfaces()`.
 *
 * A registry that a gate trusts is only as good as its fail-closed behavior, so
 * every way a record can be wrong gets its own named test here:
 *
 *   1  a fully valid record is compliant
 *   2  a reward value outside REWARD_TYPES is invalid_value
 *   3  no interactive_first_reward key at all is missing_field
 *   4  a `file` that is not on disk is file_not_found, so a declaration cannot
 *      outlive the surface it describes
 *   5  an empty or absent `why` is missing_why
 *   6  a `kind` outside the registry's own kind_vocabulary is invalid_kind
 *   7  two records sharing an `id` is duplicate_id
 *   8  an unreadable or unparseable registry is registry_read_error, returned
 *      rather than thrown: a gate that crashes is worse than a gate that reports
 *   9  an empty surfaces array is ok, with three empty buckets and no throw
 *   10 the pre-existing commands/*.md frontmatter path is untouched by all of it
 *   11 the CLI --surfaces mode exits 1 and names the offending surface id
 *   12 the CLI --surfaces mode exits 0 on a clean fixture registry
 *
 * Tests 11 and 12 build a real temp repo (a directory holding
 * data/first-reward-surfaces.json plus the files its records reference) and
 * pass it as the CLI's repoRoot argument, so the argument is genuinely
 * exercised rather than silently defaulting to this checkout.
 *
 * Hermetic: every fixture lives under fs.mkdtempSync(os.tmpdir()). This suite
 * never writes into the repository.
 *
 * Pure CJS, node built-ins only, zero npm deps. No em-dashes, no emoji.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const LINTER_PATH = path.join(REPO_ROOT, 'lib', 'core', 'mva-rule-linter.cjs');
const CLI_PATH = path.join(REPO_ROOT, 'scripts', 'check-reward-before-investment.cjs');

const { scanDeclaredSurfaces, scanCommands, REWARD_TYPES } = require(LINTER_PATH);

let passed = 0;
let failed = 0;

function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write(
      'FAIL ' + name + '\n' + (err && err.stack ? err.stack : String(err)) + '\n'
    );
    failed += 1;
  }
}

// ---------- fixture helpers ----------

const KINDS = ['shell_script', 'injected_prose', 'cjs'];
const A_VALID_REWARD = [...REWARD_TYPES][0];

function mkFixtureRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frs-267.3-'));
  // The surface a valid record points at.
  fs.writeFileSync(path.join(dir, 'surface.sh'), '#!/usr/bin/env bash\necho hi\n', 'utf8');
  return dir;
}

function baseRegistry(surfaces) {
  return {
    version: 1,
    canon_parts: ['Part 7', 'Part 11'],
    _doc: {
      purpose: 'fixture registry for the 267.3 suite',
      reward_vocabulary: [...REWARD_TYPES],
      kind_vocabulary: KINDS,
      record_shape: {},
      validation_rule: 'fixture',
      default_on_miss: 'reject (fail closed)',
      surface_count_principle: 'surfaces.length, read at check time',
    },
    surfaces: surfaces || [],
  };
}

function validRecord(overrides) {
  return Object.assign(
    {
      id: 'session-start:FIRST_INSTALL',
      file: 'surface.sh',
      kind: 'shell_script',
      anchor: 'FIRST_INSTALL',
      interactive_first_reward: A_VALID_REWARD,
      why: 'The first thing a new install prints is the reward, before any question.',
    },
    overrides || {}
  );
}

// Write a registry into `dir` and return its path.
function writeRegistry(dir, surfaces) {
  const p = path.join(dir, 'registry.json');
  fs.writeFileSync(p, JSON.stringify(baseRegistry(surfaces), null, 2), 'utf8');
  return p;
}

// Build a temp repo shaped like the real one: <root>/data/first-reward-surfaces.json
// plus the referenced surface file, so the CLI's repoRoot argument is real.
function mkTempRepo(surfaces) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'frs-repo-267.3-'));
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'surface.sh'), '#!/usr/bin/env bash\necho hi\n', 'utf8');
  fs.writeFileSync(
    path.join(root, 'data', 'first-reward-surfaces.json'),
    JSON.stringify(baseRegistry(surfaces), null, 2),
    'utf8'
  );
  return root;
}

// ---------- 1: a valid record is compliant ----------

run('1 valid record -> compliant, ok:true, value echoed', () => {
  const dir = mkFixtureRoot();
  const r = scanDeclaredSurfaces(writeRegistry(dir, [validRecord()]), dir);
  assert.equal(r.ok, true, 'expected ok:true; got ' + JSON.stringify(r));
  assert.equal(r.compliant.length, 1);
  assert.equal(r.missing.length, 0);
  assert.equal(r.invalid.length, 0);
  assert.equal(r.compliant[0].value, A_VALID_REWARD);
  assert.equal(r.compliant[0].id, 'session-start:FIRST_INSTALL');
});

// ---------- 2: value outside the enum ----------

run('2 reward value outside REWARD_TYPES -> invalid_value with the value echoed', () => {
  const dir = mkFixtureRoot();
  const r = scanDeclaredSurfaces(
    writeRegistry(dir, [validRecord({ interactive_first_reward: 'diagnostic_report' })]),
    dir
  );
  assert.equal(r.ok, false);
  assert.equal(r.invalid.length, 1);
  assert.equal(r.invalid[0].reason, 'invalid_value');
  assert.equal(r.invalid[0].value, 'diagnostic_report');
});

// ---------- 3: no interactive_first_reward key ----------

run('3 no interactive_first_reward key -> missing_field', () => {
  const dir = mkFixtureRoot();
  const rec = validRecord();
  delete rec.interactive_first_reward;
  const r = scanDeclaredSurfaces(writeRegistry(dir, [rec]), dir);
  assert.equal(r.ok, false);
  assert.equal(r.missing.length, 1);
  assert.equal(r.missing[0].reason, 'missing_field');
});

// ---------- 4: the declaration cannot outlive its surface ----------

run('4 file not on disk -> file_not_found (a declaration cannot outlive its surface)', () => {
  const dir = mkFixtureRoot();
  const r = scanDeclaredSurfaces(
    writeRegistry(dir, [validRecord({ file: 'scripts/deleted-surface.sh' })]),
    dir
  );
  assert.equal(r.ok, false);
  assert.equal(r.missing.length, 1);
  assert.equal(r.missing[0].reason, 'file_not_found');
});

// ---------- 5: empty or absent why ----------

run('5 empty or absent why -> missing_why', () => {
  const dir = mkFixtureRoot();

  const rEmpty = scanDeclaredSurfaces(writeRegistry(dir, [validRecord({ why: '' })]), dir);
  assert.equal(rEmpty.missing.length, 1);
  assert.equal(rEmpty.missing[0].reason, 'missing_why');

  const rBlank = scanDeclaredSurfaces(writeRegistry(dir, [validRecord({ why: '   ' })]), dir);
  assert.equal(rBlank.missing[0].reason, 'missing_why', 'whitespace-only why must not pass');

  const noWhy = validRecord();
  delete noWhy.why;
  const rAbsent = scanDeclaredSurfaces(writeRegistry(dir, [noWhy]), dir);
  assert.equal(rAbsent.missing[0].reason, 'missing_why');
});

// ---------- 6: kind outside the registry's own vocabulary ----------

run('6 kind outside _doc.kind_vocabulary -> invalid_kind', () => {
  const dir = mkFixtureRoot();
  const r = scanDeclaredSurfaces(writeRegistry(dir, [validRecord({ kind: 'markdown_page' })]), dir);
  assert.equal(r.ok, false);
  assert.equal(r.invalid.length, 1);
  assert.equal(r.invalid[0].reason, 'invalid_kind');
});

// ---------- 7: duplicate ids ----------

run('7 two records sharing an id -> duplicate_id', () => {
  const dir = mkFixtureRoot();
  const r = scanDeclaredSurfaces(
    writeRegistry(dir, [validRecord(), validRecord({ anchor: 'UPDATE' })]),
    dir
  );
  assert.equal(r.ok, false);
  assert.ok(
    r.invalid.some((x) => x.reason === 'duplicate_id'),
    'expected a duplicate_id verdict; got ' + JSON.stringify(r.invalid)
  );
});

// ---------- 8: an unreadable or unparseable registry reports, never throws ----------

run('8 unreadable or unparseable registry -> registry_read_error, no throw', () => {
  const dir = mkFixtureRoot();

  const rAbsent = scanDeclaredSurfaces(path.join(dir, 'does-not-exist.json'), dir);
  assert.equal(rAbsent.ok, false);
  assert.equal(rAbsent.missing.length, 1);
  assert.equal(rAbsent.missing[0].reason, 'registry_read_error');

  const badPath = path.join(dir, 'broken.json');
  fs.writeFileSync(badPath, '{ "version": 1, "surfaces": [', 'utf8');
  const rBroken = scanDeclaredSurfaces(badPath, dir);
  assert.equal(rBroken.ok, false);
  assert.equal(rBroken.missing[0].reason, 'registry_read_error');

  const noArrayPath = path.join(dir, 'no-array.json');
  fs.writeFileSync(noArrayPath, '{ "version": 1, "surfaces": "nope" }', 'utf8');
  const rNoArray = scanDeclaredSurfaces(noArrayPath, dir);
  assert.equal(rNoArray.ok, false, 'a non-array surfaces field must fail closed');
  assert.equal(rNoArray.missing[0].reason, 'registry_read_error');
});

// ---------- 9: an empty registry is not a failure ----------

run('9 empty surfaces array -> ok:true, three empty buckets, no throw', () => {
  const dir = mkFixtureRoot();
  const r = scanDeclaredSurfaces(writeRegistry(dir, []), dir);
  assert.equal(r.ok, true);
  assert.equal(r.compliant.length + r.missing.length + r.invalid.length, 0);
});

// ---------- 10: the frontmatter path is untouched ----------

run('10 no regression: scanCommands over the live commands/ tree is unchanged', () => {
  const r = scanCommands(path.join(REPO_ROOT, 'commands'));
  assert.equal(r.invalid.length, 0, 'the frontmatter path must report zero invalid');
  assert.ok(
    r.compliant.length + r.missing.length > 100,
    'expected the whole command tree to be scanned; got ' +
      (r.compliant.length + r.missing.length)
  );
  assert.ok(r.compliant.length >= 46, 'the already-compliant commands must stay compliant; got ' + r.compliant.length);
});

// ---------- 11: CLI --surfaces fails and names the offender ----------

run('11 CLI --surfaces: a bad value exits 1 and names the offending surface id', () => {
  const root = mkTempRepo([validRecord({ id: 'session-start:BAD', interactive_first_reward: 'nonsense' })]);
  const res = spawnSync(process.execPath, [CLI_PATH, '--surfaces', root], { encoding: 'utf8' });
  const combined = (res.stdout || '') + (res.stderr || '');
  assert.equal(res.status, 1, 'expected exit 1 on an invalid record; got ' + res.status + '\n' + combined);
  assert.ok(
    /session-start:BAD/.test(combined),
    'expected the offending surface id in the output; got: ' + combined
  );
  assert.ok(
    /nonsense/.test(combined),
    'expected the offending value in the output; got: ' + combined
  );
});

// ---------- 12: CLI --surfaces passes on a clean registry ----------

run('12 CLI --surfaces: a clean fixture registry exits 0 and counts from surfaces.length', () => {
  const root = mkTempRepo([validRecord()]);
  const res = spawnSync(process.execPath, [CLI_PATH, '--surfaces', root], { encoding: 'utf8' });
  const combined = (res.stdout || '') + (res.stderr || '');
  assert.equal(res.status, 0, 'expected exit 0 on a clean registry; got ' + res.status + '\n' + combined);
  assert.ok(
    /scanning 1 declared surfaces/.test(res.stdout || ''),
    'expected the count to come from the registry surfaces.length; got: ' + res.stdout
  );
  assert.ok(
    /session-start:FIRST_INSTALL/.test(res.stdout || ''),
    'expected the surface id listed; got: ' + res.stdout
  );

  // And the empty registry, which is the state this plan ships: still exit 0.
  const emptyRoot = mkTempRepo([]);
  const resEmpty = spawnSync(process.execPath, [CLI_PATH, '--surfaces', emptyRoot], {
    encoding: 'utf8',
  });
  assert.equal(resEmpty.status, 0, 'an empty registry has nothing to judge; expected exit 0');
  assert.ok(/scanning 0 declared surfaces/.test(resEmpty.stdout || ''));
});

// ---------- summary ----------

process.stdout.write(
  '\n267.3 surface-declarations: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed > 0 ? 1 : 0);
