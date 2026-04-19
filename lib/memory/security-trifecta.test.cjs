'use strict';

/**
 * Security Trifecta Tests (Phase 87-01)
 * ======================================
 * Proves SEC-01 + SEC-02 + SEC-03 defences in brain-client.cjs and
 * intelligence-cascade.cjs. Runs inside the feynman harness.
 *
 * SEC-01: sanitizeCypherInput() strips every non-whitelist character before
 *         a user-origin string reaches a Cypher interpolation site.
 * SEC-02: checkFilePermissions() refuses .env files with any group/world bit
 *         set (mode & 0o077 != 0). Must allow 0600, reject 0644.
 * SEC-03: intelligence-cascade.cjs uses HSI_TIMEOUT_MS = 30000 at all 12
 *         compute-* / detect-reverse-salients / hsi-to-graph spawn sites.
 *         The two intentional 15000ms sites (presentation) stay intact.
 *
 * Exit 0 on pass, 1 on any failure.
 * Run: node lib/memory/security-trifecta.test.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const brainClient = require('../core/brain-client.cjs');
const { sanitizeCypherInput, checkFilePermissions } = brainClient._test || {};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    process.stdout.write('  ok  ' + name + '\n');
    passed++;
  } catch (err) {
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err.message || err) + '\n');
    failed++;
  }
}

// ---------------------------------------------------------------------------
// SEC-01: sanitizeCypherInput
// ---------------------------------------------------------------------------

test('sanitizeCypherInput exported via module.exports._test', () => {
  assert.equal(typeof sanitizeCypherInput, 'function');
});

test('sanitizeCypherInput passes clean alphanumerics through', () => {
  assert.equal(sanitizeCypherInput('hello'), 'hello');
  assert.equal(sanitizeCypherInput('Framework 42'), 'Framework 42');
});

test('sanitizeCypherInput strips Cypher injection payload', () => {
  // Classic injection attempt: quotes, semicolons, comment, backtick,
  // newline, curly braces, dollar sign, backslash.
  const payload = 'DROP TABLE; --"`\n${var}';
  const result = sanitizeCypherInput(payload);
  assert.equal(result, 'DROPTABLE--var');
});

test('sanitizeCypherInput strips every forbidden metachar', () => {
  const hostile = 'a"b\'c`d{e}f$g\\h';
  const out = sanitizeCypherInput(hostile);
  assert.ok(!out.includes('"'), 'double quote survived');
  assert.ok(!out.includes("'"), 'single quote survived');
  assert.ok(!out.includes('`'), 'backtick survived');
  assert.ok(!out.includes('{'), 'open brace survived');
  assert.ok(!out.includes('}'), 'close brace survived');
  assert.ok(!out.includes('$'), 'dollar sign survived');
  assert.ok(!out.includes('\\'), 'backslash survived');
});

test('sanitizeCypherInput preserves whitelist: letters, digits, space, dot, underscore, dash', () => {
  const ok = 'Name-with_underscore.and-dash 42';
  assert.equal(sanitizeCypherInput(ok), ok);
});

test('sanitizeCypherInput handles null/undefined/non-string without crashing', () => {
  assert.equal(sanitizeCypherInput(null), '');
  assert.equal(sanitizeCypherInput(undefined), '');
  assert.equal(sanitizeCypherInput(42), '42');
  assert.equal(sanitizeCypherInput(false), 'false');
});

test('sanitizeCypherInput newline stripped (no Cypher comment injection)', () => {
  const out = sanitizeCypherInput('abc\n// injected\ndef');
  assert.ok(!out.includes('\n'));
  assert.ok(!out.includes('/'));
});

// ---------------------------------------------------------------------------
// SEC-02: checkFilePermissions
// ---------------------------------------------------------------------------

test('checkFilePermissions exported via module.exports._test', () => {
  assert.equal(typeof checkFilePermissions, 'function');
});

// Linux/macOS-only semantics. On Windows the helper returns true (documented).
const isWin = process.platform === 'win32';

test('checkFilePermissions accepts 0600', () => {
  if (isWin) {
    process.stdout.write('        (skipped on win32)\n');
    return;
  }
  const tmpFile = path.join(os.tmpdir(), `sec-trifecta-0600-${Date.now()}.env`);
  fs.writeFileSync(tmpFile, 'MINDRIAN_BRAIN_KEY=test\n');
  fs.chmodSync(tmpFile, 0o600);
  try {
    assert.equal(checkFilePermissions(tmpFile), true);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_e) {}
  }
});

test('checkFilePermissions rejects 0644 (group-readable)', () => {
  if (isWin) {
    process.stdout.write('        (skipped on win32)\n');
    return;
  }
  const tmpFile = path.join(os.tmpdir(), `sec-trifecta-0644-${Date.now()}.env`);
  fs.writeFileSync(tmpFile, 'MINDRIAN_BRAIN_KEY=test\n');
  fs.chmodSync(tmpFile, 0o644);
  try {
    assert.equal(checkFilePermissions(tmpFile), false);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_e) {}
  }
});

test('checkFilePermissions rejects 0664 (group-writable too)', () => {
  if (isWin) {
    process.stdout.write('        (skipped on win32)\n');
    return;
  }
  const tmpFile = path.join(os.tmpdir(), `sec-trifecta-0664-${Date.now()}.env`);
  fs.writeFileSync(tmpFile, 'MINDRIAN_BRAIN_KEY=test\n');
  fs.chmodSync(tmpFile, 0o664);
  try {
    assert.equal(checkFilePermissions(tmpFile), false);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_e) {}
  }
});

test('checkFilePermissions accepts 0400 (read-only owner)', () => {
  if (isWin) {
    process.stdout.write('        (skipped on win32)\n');
    return;
  }
  const tmpFile = path.join(os.tmpdir(), `sec-trifecta-0400-${Date.now()}.env`);
  fs.writeFileSync(tmpFile, 'MINDRIAN_BRAIN_KEY=test\n');
  fs.chmodSync(tmpFile, 0o400);
  try {
    assert.equal(checkFilePermissions(tmpFile), true);
  } finally {
    try {
      fs.chmodSync(tmpFile, 0o600);
      fs.unlinkSync(tmpFile);
    } catch (_e) {}
  }
});

test('checkFilePermissions returns false for nonexistent file', () => {
  const missing = path.join(os.tmpdir(), `sec-trifecta-missing-${Date.now()}.env`);
  assert.equal(checkFilePermissions(missing), false);
});

// ---------------------------------------------------------------------------
// SEC-03: HSI_TIMEOUT_MS is 30000 at all 12 cascade spawn sites.
// Shared invariant: test runs alongside Task 1-2's grep-based verification.
// ---------------------------------------------------------------------------

test('intelligence-cascade.cjs defines HSI_TIMEOUT_MS = 30000', () => {
  const cascadePath = path.resolve(__dirname, '..', 'core', 'intelligence-cascade.cjs');
  const src = fs.readFileSync(cascadePath, 'utf8');
  assert.match(
    src,
    /const\s+HSI_TIMEOUT_MS\s*=\s*30000/,
    'HSI_TIMEOUT_MS = 30000 constant not found'
  );
});

test('intelligence-cascade.cjs uses HSI_TIMEOUT_MS at exactly 12 sites', () => {
  const cascadePath = path.resolve(__dirname, '..', 'core', 'intelligence-cascade.cjs');
  const src = fs.readFileSync(cascadePath, 'utf8');
  const matches = src.match(/timeout:\s*HSI_TIMEOUT_MS/g) || [];
  assert.equal(
    matches.length,
    12,
    `expected 12 timeout: HSI_TIMEOUT_MS sites, got ${matches.length}`
  );
});

test('intelligence-cascade.cjs has zero remaining timeout: 5000 sites', () => {
  const cascadePath = path.resolve(__dirname, '..', 'core', 'intelligence-cascade.cjs');
  const src = fs.readFileSync(cascadePath, 'utf8');
  const matches = src.match(/timeout:\s*5000/g) || [];
  assert.equal(
    matches.length,
    0,
    `expected 0 remaining timeout: 5000 sites, got ${matches.length}`
  );
});

test('intelligence-cascade.cjs preserves 2 intentional timeout: 15000 sites', () => {
  const cascadePath = path.resolve(__dirname, '..', 'core', 'intelligence-cascade.cjs');
  const src = fs.readFileSync(cascadePath, 'utf8');
  const matches = src.match(/timeout:\s*15000/g) || [];
  assert.equal(
    matches.length,
    2,
    `expected 2 preserved timeout: 15000 sites, got ${matches.length}`
  );
});

// ---------------------------------------------------------------------------
// Integration cross-check: brain-client.cjs uses sanitizeCypherInput at 8 sites
// and zero legacy .replace(/"/g, '\\"') patterns remain.
// ---------------------------------------------------------------------------

test('brain-client.cjs calls sanitizeCypherInput at 8 sites (plus definition)', () => {
  const brainPath = path.resolve(__dirname, '..', 'core', 'brain-client.cjs');
  const src = fs.readFileSync(brainPath, 'utf8');
  const matches = src.match(/sanitizeCypherInput\s*\(/g) || [];
  // 1 definition + 8 call sites = 9 (+1 _test export ref = 10).
  assert.ok(
    matches.length >= 9,
    `expected >= 9 sanitizeCypherInput occurrences, got ${matches.length}`
  );
});

test('brain-client.cjs has zero legacy .replace(/"/g, ...) injection patterns', () => {
  const brainPath = path.resolve(__dirname, '..', 'core', 'brain-client.cjs');
  const src = fs.readFileSync(brainPath, 'utf8');
  const matches = src.match(/\.replace\(\/"\/g/g) || [];
  assert.equal(
    matches.length,
    0,
    `expected 0 legacy double-quote escape patterns, got ${matches.length}`
  );
});

test('brain-client.cjs guards .env reads with checkFilePermissions', () => {
  const brainPath = path.resolve(__dirname, '..', 'core', 'brain-client.cjs');
  const src = fs.readFileSync(brainPath, 'utf8');
  const matches = src.match(/checkFilePermissions\s*\(/g) || [];
  // 1 definition + 2 getApiKey call sites (cwd .env + ~/.mindrian.env) = 3.
  assert.ok(
    matches.length >= 3,
    `expected >= 3 checkFilePermissions occurrences, got ${matches.length}`
  );
});

// ---------------------------------------------------------------------------

process.stdout.write('\n');
process.stdout.write(`${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.stdout.write('FAIL\n');
  process.exit(1);
}
process.stdout.write('PASS\n');
