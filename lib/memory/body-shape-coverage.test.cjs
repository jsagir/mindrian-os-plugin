#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-01 Task 2 -- Body-shape coverage acceptance tests.
 *
 * Verifies scripts/audit-body-shape-coverage.cjs and output-styles/destijl.md.
 * The audit script is the CI tripwire that scans commands/*.md frontmatter for
 * body_shape: presence and a valid value from the locked vocabulary. The
 * output style is the system-prompt-enforced 4-zone De Stijl format that lifts
 * SKILL.md from skill-instruction-suggested to force-for-plugin-enforced.
 *
 * Canon references:
 *   Part 3 UI Ruling System -- this test enforces the body_shape contract
 *           that the ruling system depends on.
 *   Part 7 Reuse Before Build -- no new commands are created; this is a
 *           pure compliance + infrastructure pass.
 *   Part 8 Graph Boundary -- audit script + output style add zero network
 *           surface, zero Brain calls, zero telemetry egress.
 *
 * Test map (7 cases, one-to-one with PLAN Task 2 <behavior>):
 *
 *   1.  output-styles/destijl.md exists and parses as valid YAML frontmatter
 *       + markdown body.
 *   2.  Frontmatter contains exactly `force-for-plugin: true` AND
 *       `keep-coding-instructions: true` (literal string match).
 *   3.  Body documents the four zones in fixed order matching SKILL.md
 *       Section 1: Header Panel / Content Body / Intelligence Strip /
 *       Action Footer.
 *   4.  Body documents the 5+2 body shapes (A, B, C, D, E + F family)
 *       mapping to the SKILL.md Section 2 vocabulary.
 *   5.  scripts/audit-body-shape-coverage.cjs exits 0 against the live
 *       commands/ directory (post-Task-1 state). Exits 1 against a
 *       synthetic fixture with a command missing body_shape:.
 *   6.  The audit script reports per-category counts (A / B / C / D / E /
 *       F.x / methodology) in --json mode.
 *   7.  Every body_shape: value in commands/*.md is one of the locked
 *       vocabulary {A, B, C, D, E, F.0..F.6, methodology}. The audit
 *       script flags any other value.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const DESTIJL_PATH = path.join(REPO, 'output-styles', 'destijl.md');
const AUDIT_PATH = path.join(REPO, 'scripts', 'audit-body-shape-coverage.cjs');
const COMMANDS_DIR = path.join(REPO, 'commands');

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

function readDestijl() {
  return fs.readFileSync(DESTIJL_PATH, 'utf8');
}

function loadAudit() {
  try { delete require.cache[require.resolve(AUDIT_PATH)]; } catch (_) {}
  return require(AUDIT_PATH);
}

// Run audit script as a subprocess (mirrors how CI will invoke it).
// Returns { code, stdout, stderr }.
function runAudit(args, env) {
  const result = { code: 0, stdout: '', stderr: '' };
  try {
    result.stdout = execFileSync('node', [AUDIT_PATH, ...(args || [])], {
      env: Object.assign({}, process.env, env || {}),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    result.code = (e && typeof e.status === 'number') ? e.status : 1;
    result.stdout = (e && e.stdout) ? e.stdout.toString() : '';
    result.stderr = (e && e.stderr) ? e.stderr.toString() : '';
  }
  return result;
}

// ---------- Tests ----------

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    failed++;
    failures.push({ name, error: e });
    console.log('  FAIL  ' + name);
    console.log('         ' + (e && e.message ? e.message : String(e)));
  }
}

console.log('Phase 121.5-01 Task 2 -- body-shape-coverage acceptance suite');
console.log('');

// Test 1: destijl.md exists and parses
test('Test 1: output-styles/destijl.md exists with frontmatter + body', () => {
  assert.ok(fs.existsSync(DESTIJL_PATH), 'output-styles/destijl.md missing');
  const text = readDestijl();
  const fm = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(fm, 'destijl.md does not parse as frontmatter + body');
  assert.ok(fm[1].length > 0, 'frontmatter is empty');
  assert.ok(fm[2].length > 100, 'body is too short (< 100 chars)');
});

// Test 2: force-for-plugin + keep-coding-instructions present
test('Test 2: frontmatter has force-for-plugin: true AND keep-coding-instructions: true', () => {
  const text = readDestijl();
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, 'no frontmatter found');
  assert.ok(/^force-for-plugin:\s*true\s*$/m.test(fm[1]),
    'force-for-plugin: true not found in frontmatter');
  assert.ok(/^keep-coding-instructions:\s*true\s*$/m.test(fm[1]),
    'keep-coding-instructions: true not found in frontmatter');
});

// Test 3: 4 zones documented in fixed order
test('Test 3: body documents 4 zones in SKILL.md Section 1 order', () => {
  const text = readDestijl();
  const idxHeader = text.indexOf('Header Panel');
  const idxBody = text.indexOf('Content Body');
  const idxStrip = text.indexOf('Intelligence Strip');
  const idxFooter = text.indexOf('Action Footer');
  assert.ok(idxHeader > 0, 'Header Panel zone not documented');
  assert.ok(idxBody > idxHeader, 'Content Body must come after Header Panel');
  assert.ok(idxStrip > idxBody, 'Intelligence Strip must come after Content Body');
  assert.ok(idxFooter > idxStrip, 'Action Footer must come after Intelligence Strip');
});

// Test 4: 5+2 body shapes documented
test('Test 4: body documents shapes A, B, C, D, E + F family + methodology', () => {
  const text = readDestijl();
  // Each shape letter must appear in the shape table or shape documentation.
  // Use regex to find the shape table row pattern: "| <letter> |" or "Shape <letter>".
  for (const shape of ['A', 'B', 'C', 'D', 'E']) {
    const re = new RegExp('(\\|\\s*' + shape + '\\s*\\||Shape\\s+' + shape + '\\b)');
    assert.ok(re.test(text), 'Shape ' + shape + ' not documented in body');
  }
  // F family members
  for (const fSub of ['F.0', 'F.1', 'F.2', 'F.3', 'F.4', 'F.5', 'F.6']) {
    const re = new RegExp('\\b' + fSub.replace('.', '\\.') + '\\b');
    assert.ok(re.test(text), fSub + ' not documented in body');
  }
  assert.ok(/methodology/i.test(text), 'methodology not documented in body');
});

// Test 5a: audit script exits 0 against live commands/ (post-Task-1 state)
test('Test 5a: audit exits 0 against live commands/ (100% coverage)', () => {
  assert.ok(fs.existsSync(AUDIT_PATH), 'audit script missing');
  const r = runAudit([]);
  if (r.code !== 0) {
    console.log('         stdout: ' + r.stdout);
    console.log('         stderr: ' + r.stderr);
  }
  assert.strictEqual(r.code, 0, 'audit script exited non-zero on live repo');
});

// Test 5b: audit exits 1 on synthetic fixture missing body_shape
test('Test 5b: audit exits 1 on synthetic command missing body_shape', () => {
  const tmp = mkTmp('body-shape-audit-');
  const cmdsDir = path.join(tmp, 'commands');
  fs.mkdirSync(cmdsDir, { recursive: true });
  // Good file
  fs.writeFileSync(path.join(cmdsDir, 'good.md'),
    '---\nname: good\ndescription: test\nbody_shape: A\n---\n# good\n');
  // Bad file (missing body_shape)
  fs.writeFileSync(path.join(cmdsDir, 'bad.md'),
    '---\nname: bad\ndescription: test\n---\n# bad\n');

  // Audit accepts a --dir override.
  const r = runAudit(['--dir', cmdsDir]);
  assert.notStrictEqual(r.code, 0,
    'audit must fail when a command is missing body_shape (got exit 0)');
});

// Test 6: --json mode reports per-category counts
test('Test 6: --json mode reports histogram per category', () => {
  const r = runAudit(['--json']);
  assert.strictEqual(r.code, 0, 'audit --json exited non-zero');
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch (e) {
    assert.fail('--json output not valid JSON: ' + e.message);
  }
  assert.ok(parsed && typeof parsed === 'object', '--json must emit object');
  assert.ok(typeof parsed.total === 'number', 'total missing in --json output');
  assert.ok(parsed.histogram && typeof parsed.histogram === 'object',
    'histogram missing in --json output');
  // At least 3 distinct shape categories should appear in a healthy repo
  // (proves the sweep is a spread, not a monoculture).
  const keys = Object.keys(parsed.histogram);
  assert.ok(keys.length >= 3,
    'histogram has < 3 distinct shapes -- monoculture detected: ' + keys.join(','));
});

// Test 7: all body_shape values in live repo are in the locked vocabulary
test('Test 7: every body_shape value in commands/*.md is in locked vocab', () => {
  const { VALID_SHAPES } = loadAudit();
  assert.ok(VALID_SHAPES && typeof VALID_SHAPES.has === 'function',
    'audit must export VALID_SHAPES Set');
  // Sanity-check the vocabulary itself
  for (const v of ['A', 'B', 'C', 'D', 'E',
                   'F.0', 'F.1', 'F.2', 'F.3', 'F.4', 'F.5', 'F.6',
                   'methodology']) {
    assert.ok(VALID_SHAPES.has(v), 'VALID_SHAPES missing required value: ' + v);
  }
  // Now scan live commands and validate each
  const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'));
  const offenders = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(COMMANDS_DIR, f), 'utf8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) { offenders.push(f + ' (no frontmatter)'); continue; }
    const m = fm[1].match(/^body_shape:\s*(.+)$/m);
    if (!m) { offenders.push(f + ' (no body_shape)'); continue; }
    // Strip trailing parenthetical (e.g. "B (Semantic Tree)" -> "B")
    let v = m[1].trim().replace(/\s*\(.*\)\s*$/, '');
    // Strip surrounding quotes if present
    v = v.replace(/^['"]|['"]$/g, '');
    if (!VALID_SHAPES.has(v)) {
      offenders.push(f + ' = "' + m[1].trim() + '" (extracted: "' + v + '")');
    }
  }
  if (offenders.length) {
    assert.fail('commands with invalid body_shape values:\n  ' + offenders.join('\n  '));
  }
});

// ---------- Summary ----------

console.log('');
console.log('========================================');
console.log('Tests: ' + (passed + failed) + ' total, ' + passed + ' passed, ' + failed + ' failed');
console.log('========================================');

if (failed > 0) {
  console.log('');
  console.log('Failures:');
  for (const f of failures) {
    console.log('  - ' + f.name);
  }
  process.exit(1);
}

process.exit(0);
