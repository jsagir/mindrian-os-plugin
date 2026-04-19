/**
 * MCP Input Validation Tests (Phase 87-05)
 *
 * BSL 1.1. Copyright (c) Mindrian 2026.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Proves three security primitives in lib/mcp/tool-router.cjs:
 *
 *   1. SECTION_RE -- Zod regex /^[a-z0-9-]+$/ accepts valid section names,
 *      rejects traversal tokens, whitespace, Unicode control codes, caps.
 *   2. safeResolveSection(roomDir, section) -- throws on any resolved path
 *      that escapes roomDir; returns roomDir for null/empty; returns
 *      roomDir/section for valid input.
 *   3. opportunitySchema -- accepts {title: string(>=1)}; rejects empty
 *      title, missing title, null, non-string title.
 *
 * These three primitives close CASCADE-03 and CASCADE-05. Breaking any
 * assertion here means an MCP tool caller can pass `../../etc/passwd`
 * or embedded newlines and reach arbitrary filesystem paths.
 *
 * @license BSL-1.1
 * @copyright 2026 Mindrian / PWS
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const { _test } = require('../mcp/tool-router.cjs');
assert.ok(_test, 'tool-router.cjs must export _test block for validation primitives');

const { safeResolveSection, SECTION_RE, opportunitySchema, sectionOptional } = _test;
assert.ok(SECTION_RE instanceof RegExp, 'SECTION_RE must be a RegExp');
assert.ok(typeof safeResolveSection === 'function', 'safeResolveSection must be a function');
assert.ok(opportunitySchema && typeof opportunitySchema.parse === 'function', 'opportunitySchema must be a Zod schema');
assert.ok(sectionOptional && typeof sectionOptional.parse === 'function', 'sectionOptional must be a Zod schema');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    process.stdout.write('  ok  ' + name + '\n');
    passed++;
  } catch (err) {
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err.stack || err.message || err) + '\n');
    failed++;
  }
}

// ---------------------------------------------------------------------------
// SECTION_RE: valid shapes
// ---------------------------------------------------------------------------

test('SECTION_RE accepts problem-definition', () => {
  assert.strictEqual(SECTION_RE.test('problem-definition'), true);
});

test('SECTION_RE accepts market-analysis', () => {
  assert.strictEqual(SECTION_RE.test('market-analysis'), true);
});

test('SECTION_RE accepts team-execution', () => {
  assert.strictEqual(SECTION_RE.test('team-execution'), true);
});

test('SECTION_RE accepts single word', () => {
  assert.strictEqual(SECTION_RE.test('team'), true);
});

test('SECTION_RE accepts digits', () => {
  assert.strictEqual(SECTION_RE.test('phase-87-sub5'), true);
});

// ---------------------------------------------------------------------------
// SECTION_RE: invalid shapes (traversal, whitespace, control, caps)
// ---------------------------------------------------------------------------

test('SECTION_RE rejects ../etc/passwd', () => {
  assert.strictEqual(SECTION_RE.test('../etc/passwd'), false);
});

test('SECTION_RE rejects forward slash', () => {
  assert.strictEqual(SECTION_RE.test('a/b'), false);
});

test('SECTION_RE rejects backslash', () => {
  assert.strictEqual(SECTION_RE.test('a\\b'), false);
});

test('SECTION_RE rejects space', () => {
  assert.strictEqual(SECTION_RE.test('section with space'), false);
});

test('SECTION_RE rejects newline', () => {
  assert.strictEqual(SECTION_RE.test('section\n'), false);
});

test('SECTION_RE rejects Unicode control code (U+0000)', () => {
  assert.strictEqual(SECTION_RE.test('section\u0000'), false);
});

test('SECTION_RE rejects capitals', () => {
  assert.strictEqual(SECTION_RE.test('Section-Caps'), false);
});

test('SECTION_RE rejects underscore (not in charset)', () => {
  assert.strictEqual(SECTION_RE.test('snake_case'), false);
});

test('SECTION_RE rejects empty string', () => {
  assert.strictEqual(SECTION_RE.test(''), false);
});

test('SECTION_RE rejects dot-prefix (.reasoning attack)', () => {
  assert.strictEqual(SECTION_RE.test('.reasoning'), false);
});

// ---------------------------------------------------------------------------
// sectionOptional Zod schema: undefined OK, valid OK, invalid throws
// ---------------------------------------------------------------------------

test('sectionOptional parses undefined as undefined', () => {
  assert.strictEqual(sectionOptional.parse(undefined), undefined);
});

test('sectionOptional parses valid section', () => {
  assert.strictEqual(sectionOptional.parse('problem-definition'), 'problem-definition');
});

test('sectionOptional throws on traversal', () => {
  assert.throws(() => sectionOptional.parse('../etc'));
});

test('sectionOptional throws on capitals', () => {
  assert.throws(() => sectionOptional.parse('Team'));
});

// ---------------------------------------------------------------------------
// safeResolveSection: traversal rejected
// ---------------------------------------------------------------------------

const roomDir = path.resolve('/tmp/room-test-87-05');

test('safeResolveSection throws on ../../etc traversal', () => {
  assert.throws(() => safeResolveSection(roomDir, '../../etc'), /traversal rejected/);
});

test('safeResolveSection throws on ../../.. traversal', () => {
  assert.throws(() => safeResolveSection(roomDir, '../../..'), /traversal rejected/);
});

test('safeResolveSection throws on absolute-path section (/etc/passwd)', () => {
  assert.throws(() => safeResolveSection(roomDir, '/etc/passwd'), /traversal rejected/);
});

// ---------------------------------------------------------------------------
// safeResolveSection: valid inputs
// ---------------------------------------------------------------------------

test('safeResolveSection returns roomDir/section for valid input', () => {
  const resolved = safeResolveSection(roomDir, 'valid-section');
  assert.ok(resolved.startsWith(roomDir), 'resolved must live inside roomDir');
  assert.ok(resolved.endsWith('valid-section'), 'resolved must end with section name');
});

test('safeResolveSection returns roomDir for empty section', () => {
  assert.strictEqual(safeResolveSection(roomDir, ''), roomDir);
});

test('safeResolveSection returns roomDir for null section', () => {
  assert.strictEqual(safeResolveSection(roomDir, null), roomDir);
});

test('safeResolveSection returns roomDir for undefined section', () => {
  assert.strictEqual(safeResolveSection(roomDir, undefined), roomDir);
});

// ---------------------------------------------------------------------------
// opportunitySchema: accepts valid, rejects malformed
// ---------------------------------------------------------------------------

test('opportunitySchema parses {title: "valid"}', () => {
  assert.doesNotThrow(() => opportunitySchema.parse({ title: 'valid opp' }));
});

test('opportunitySchema parses full payload', () => {
  assert.doesNotThrow(() => opportunitySchema.parse({
    title: 'NSF SBIR Phase I',
    program: 'SBIR Phase I',
    funder: 'NSF',
    amount: 305000,
    deadline: '2026-06-01',
    source: 'grants.gov',
    relevance_score: 0.85,
  }));
});

test('opportunitySchema passthrough keeps unknown fields', () => {
  const parsed = opportunitySchema.parse({
    title: 'with extras',
    customField: 'should-pass-through',
  });
  assert.strictEqual(parsed.customField, 'should-pass-through');
});

test('opportunitySchema rejects empty title', () => {
  assert.throws(() => opportunitySchema.parse({ title: '' }));
});

test('opportunitySchema rejects missing title', () => {
  assert.throws(() => opportunitySchema.parse({ funder: 'NSF' }));
});

test('opportunitySchema rejects null', () => {
  assert.throws(() => opportunitySchema.parse(null));
});

test('opportunitySchema rejects non-string title (number)', () => {
  assert.throws(() => opportunitySchema.parse({ title: 123 }));
});

test('opportunitySchema rejects non-object (string)', () => {
  assert.throws(() => opportunitySchema.parse('not-an-object'));
});

test('opportunitySchema rejects title exceeding max length', () => {
  const longTitle = 'x'.repeat(501);
  assert.throws(() => opportunitySchema.parse({ title: longTitle }));
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

process.stdout.write('\nmcp-input-validation: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
