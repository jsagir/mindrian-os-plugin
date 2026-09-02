'use strict';

/**
 * Phase 262 Plan 03 (FLOOR-02) -- the never-deleted clause made machine-checkable.
 *
 * FLOOR-02's contract is "coverage kept, assertion inverted, never deleted"; this
 * suite is the machine-checkable half of "never deleted" -- it fails red the
 * moment the keyless acceptance fixture is removed instead of repurposed.
 * The fixture name `no-identity-refusal` comes from the ratified wording in
 * `docs/AMENDMENT-2026-08-DECISIONS-1-AND-8.md` ledger item 5 ("repurposed into
 * a no-identity refusal fixture").
 * Zero-network: this suite reads only committed files (fs.readdirSync /
 * fs.readFileSync against the tests/fixtures tree), never touches the Brain.
 *
 * No em-dashes.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ACCEPTANCE_ROOT = path.join(__dirname, '..', 'tests', 'fixtures', '127-03-acceptance');
const NO_IDENTITY_DIR = path.join(ACCEPTANCE_ROOT, 'no-identity-refusal');
const NO_IDENTITY_README = path.join(NO_IDENTITY_DIR, 'README.md');
const LEGACY_DIR = path.join(ACCEPTANCE_ROOT, 'tier-0-no-key');

test('no-identity-refusal fixture directory exists', () => {
  assert.equal(fs.existsSync(NO_IDENTITY_DIR), true, `expected ${NO_IDENTITY_DIR} to exist`);
  assert.equal(fs.statSync(NO_IDENTITY_DIR).isDirectory(), true, 'no-identity-refusal must be a directory');
});

test('no-identity-refusal README exists and is non-empty', () => {
  assert.equal(fs.existsSync(NO_IDENTITY_README), true, `expected ${NO_IDENTITY_README} to exist`);
  const contents = fs.readFileSync(NO_IDENTITY_README, 'utf8');
  assert.ok(contents.trim().length > 0, 'README must be non-empty');
});

test('README asserts refusal', () => {
  const contents = fs.readFileSync(NO_IDENTITY_README, 'utf8');
  assert.match(contents, /refus/i, 'README must assert refusal');
});

test('README does not carry the dead-doctrine availability claims', () => {
  const contents = fs.readFileSync(NO_IDENTITY_README, 'utf8');
  assert.doesNotMatch(contents, /works without a key/i, 'dead-doctrine claim "works without a key" must be gone, not supplemented');
  assert.doesNotMatch(contents, /gets unblocked/i, 'dead-doctrine claim "gets unblocked" must be gone, not supplemented');
});

test('README names the byte-locked wire string verbatim', () => {
  const contents = fs.readFileSync(NO_IDENTITY_README, 'utf8');
  assert.match(contents, /DIRECTOR_NOT_AVAILABLE/, 'README must name DIRECTOR_NOT_AVAILABLE verbatim');
});

test('the never-deleted clause: sibling fixture set is intact (exactly four, repurposed not dropped)', () => {
  const entries = fs.readdirSync(ACCEPTANCE_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  assert.deepEqual(
    entries,
    ['clean-install', 'lawrence-state', 'no-identity-refusal', 'with-key'],
    'a fixture count/name mismatch means the keyless fixture was deleted rather than repurposed, the exact outcome FLOOR-02 exists to forbid'
  );
});

test('the legacy pre-inversion directory no longer exists (renamed, not copied)', () => {
  assert.equal(fs.existsSync(LEGACY_DIR), false, `${LEGACY_DIR} must not exist; the fixture must be a rename, not a copy leaving two`);
});
