#!/usr/bin/env node
'use strict';

/**
 * Quick 260911-iko -- RED-first coverage for the opaque per-install id
 * (lib/core/install-id.cjs) and, once Task 2 lands, the wire header, the
 * doctor rotation flag, and the L0 presence row.
 *
 * Task 1 arms (1-12): node:test plus node built-ins only. Zero network,
 * zero spawn. Every arm uses a fresh fs.mkdtempSync homeDir so no arm's
 * write bleeds into another's assertions (the freshHomeDir() helper mirrors
 * tests/test-339-brain-prewarm-cold-start.cjs).
 *
 * Task 2 arms (13-16) are appended below once the wire header, the doctor
 * flag, and the L0 row exist.
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const installIdModulePath = path.join(REPO_ROOT, 'lib', 'core', 'install-id.cjs');
const {
  getInstallId,
  peekInstallId,
  resetInstallId,
  installIdPath,
  installIdHeaderName,
} = require(installIdModulePath);
const { markerPath } = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-prewarm.cjs'));

const ID_SHAPE_RE = /^[a-f0-9]{32}$/;
const THEO_SHAPE_RE = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * A fresh tmp homeDir per arm so no arm's write can bleed into another's
 * assertions.
 */
function freshHomeDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'install-id-test-'));
}

// codeOf: comment-stripping helper, the same idiom
// tests/test-339-brain-prewarm-cold-start.cjs reuses from
// tests/test-254-composition-census.cjs / tests/test-reader-r4-structural-184.cjs
// -- full-line-comment strip only.
function codeOf(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');
}

// ---------------------------------------------------------------------------
// Arm 1: mint-once (D-02)
// ---------------------------------------------------------------------------
test('Arm 1: two getInstallId calls return the identical string; the state dir holds exactly one id file', () => {
  const homeDir = freshHomeDir();
  const first = getInstallId({ homeDir });
  const second = getInstallId({ homeDir });
  assert.equal(typeof first, 'string');
  assert.equal(first, second);

  const entries = fs.readdirSync(homeDir).filter((f) => f.endsWith('.json'));
  assert.deepEqual(entries, ['theo-install-id.json']);
});

// ---------------------------------------------------------------------------
// Arm 2: shape (D-01)
// ---------------------------------------------------------------------------
test('Arm 2: the value matches both the plugin shape and Theo\'s accepted shape', () => {
  const homeDir = freshHomeDir();
  const id = getInstallId({ homeDir });
  assert.match(id, ID_SHAPE_RE);
  assert.match(id, THEO_SHAPE_RE);
});

// ---------------------------------------------------------------------------
// Arm 3: file shape (D-02)
// ---------------------------------------------------------------------------
test('Arm 3: the file holds exactly {id, minted_at} and minted_at parses to a valid Date', () => {
  const homeDir = freshHomeDir();
  getInstallId({ homeDir });
  const raw = fs.readFileSync(installIdPath(homeDir), 'utf8');
  const parsed = JSON.parse(raw);
  assert.deepEqual(Object.keys(parsed).sort(), ['id', 'minted_at']);
  const d = new Date(parsed.minted_at);
  assert.equal(Number.isNaN(d.getTime()), false, 'minted_at must parse to a valid Date');
});

// ---------------------------------------------------------------------------
// Arm 4: mode (D-02)
// ---------------------------------------------------------------------------
test('Arm 4: the file is written at mode 0600', (t) => {
  if (process.platform === 'win32') {
    t.skip('mode bits are not meaningful on win32; skipping the 0600 assertion');
    return;
  }
  const homeDir = freshHomeDir();
  getInstallId({ homeDir });
  const mode = fs.statSync(installIdPath(homeDir)).mode & 0o777;
  assert.equal(mode, 0o600);
});

// ---------------------------------------------------------------------------
// Arm 5: reset rotates (D-05)
// ---------------------------------------------------------------------------
test('Arm 5: resetInstallId returns a different valid id, persists it, and getInstallId picks it up', () => {
  const homeDir = freshHomeDir();
  const original = getInstallId({ homeDir });
  const rotated = resetInstallId({ homeDir });
  assert.match(rotated, ID_SHAPE_RE);
  assert.notEqual(rotated, original);

  const raw = fs.readFileSync(installIdPath(homeDir), 'utf8');
  assert.equal(JSON.parse(raw).id, rotated);

  const readAfter = getInstallId({ homeDir });
  assert.equal(readAfter, rotated);
});

// ---------------------------------------------------------------------------
// Arm 6: invalid content re-mints (D-02)
// ---------------------------------------------------------------------------
test('Arm 6: a corrupted or invalid file re-mints a fresh valid id and rewrites the file', () => {
  const homeDir1 = freshHomeDir();
  fs.writeFileSync(installIdPath(homeDir1), JSON.stringify({ id: 'nope' }), 'utf8');
  const id1 = getInstallId({ homeDir: homeDir1 });
  assert.match(id1, ID_SHAPE_RE);
  assert.equal(JSON.parse(fs.readFileSync(installIdPath(homeDir1), 'utf8')).id, id1);

  const homeDir2 = freshHomeDir();
  fs.writeFileSync(installIdPath(homeDir2), 'not json at all', 'utf8');
  const id2 = getInstallId({ homeDir: homeDir2 });
  assert.match(id2, ID_SHAPE_RE);
  assert.equal(JSON.parse(fs.readFileSync(installIdPath(homeDir2), 'utf8')).id, id2);
});

// ---------------------------------------------------------------------------
// Arm 7: unwritable dir returns null without throwing (D-04)
// ---------------------------------------------------------------------------
test('Arm 7: a homeDir living under a regular file returns null without throwing', () => {
  const parent = freshHomeDir();
  const regularFile = path.join(parent, 'i-am-a-file');
  fs.writeFileSync(regularFile, 'x', 'utf8');
  const bogusHomeDir = path.join(regularFile, 'nested', 'homedir');

  let result;
  assert.doesNotThrow(() => {
    result = getInstallId({ homeDir: bogusHomeDir });
  });
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Arm 8: no identity substring (D-03/D-07)
// ---------------------------------------------------------------------------
test('Arm 8: the raw file text contains no hostname, username, cwd, homeDir path, or key-canary substring', () => {
  const homeDir = freshHomeDir();
  const canary = 'CANARY-260911-iko-brain-key-tripwire';
  const prevKey = process.env.MINDRIAN_BRAIN_KEY;
  process.env.MINDRIAN_BRAIN_KEY = canary;
  try {
    getInstallId({ homeDir });
  } finally {
    if (prevKey === undefined) delete process.env.MINDRIAN_BRAIN_KEY;
    else process.env.MINDRIAN_BRAIN_KEY = prevKey;
  }

  const raw = fs.readFileSync(installIdPath(homeDir), 'utf8');
  assert.equal(raw.includes(os.hostname()), false, 'hostname must not survive into the file');
  assert.equal(raw.includes(os.userInfo().username), false, 'username must not survive into the file');
  assert.equal(raw.includes(process.cwd()), false, 'cwd must not survive into the file');
  assert.equal(raw.includes(homeDir), false, 'the homeDir path itself must not survive into the file');
  assert.equal(raw.includes(canary), false, 'the Brain-key canary must not survive into the file');
});

// ---------------------------------------------------------------------------
// Arm 9: source-shape scan (D-07)
// ---------------------------------------------------------------------------
test('Arm 9: lib/core/install-id.cjs, comments stripped, contains zero identity-derivation tokens', () => {
  const code = codeOf(installIdModulePath);
  const forbidden = [
    'os.hostname',
    'os.userInfo',
    'process.env.USER',
    'process.env.USERNAME',
    'process.env.LOGNAME',
    'process.cwd',
    'MINDRIAN_BRAIN_KEY',
    'resolve-brain-key',
    'createHash',
  ];
  for (const token of forbidden) {
    assert.equal(
      code.includes(token),
      false,
      'forbidden identity-derivation token found in comment-stripped source: ' + token
    );
  }
});

// ---------------------------------------------------------------------------
// Arm 10: state-dir drift guard (D-02)
// ---------------------------------------------------------------------------
test('Arm 10: installIdPath and brain-prewarm markerPath resolve to the same directory (explicit arg, env override, and default)', () => {
  // Explicit homeDir argument.
  const explicitHome = freshHomeDir();
  assert.equal(path.dirname(installIdPath(explicitHome)), path.dirname(markerPath(explicitHome)));

  // MINDRIAN_HOME env override.
  const envHome = freshHomeDir();
  const prevEnv = process.env.MINDRIAN_HOME;
  process.env.MINDRIAN_HOME = envHome;
  try {
    assert.equal(path.dirname(installIdPath(undefined)), path.dirname(markerPath(undefined)));
  } finally {
    if (prevEnv === undefined) delete process.env.MINDRIAN_HOME;
    else process.env.MINDRIAN_HOME = prevEnv;
  }

  // No-argument default (no MINDRIAN_HOME set).
  const prevEnv2 = process.env.MINDRIAN_HOME;
  delete process.env.MINDRIAN_HOME;
  try {
    assert.equal(path.dirname(installIdPath()), path.dirname(markerPath()));
  } finally {
    if (prevEnv2 !== undefined) process.env.MINDRIAN_HOME = prevEnv2;
  }
});

// ---------------------------------------------------------------------------
// Arm 11: peek never mints (D-03)
// ---------------------------------------------------------------------------
test('Arm 11: peekInstallId on a fresh homeDir returns null and creates no file; after a getInstallId it returns the same id', () => {
  const homeDir = freshHomeDir();
  const before = peekInstallId({ homeDir });
  assert.equal(before, null);
  assert.equal(fs.existsSync(installIdPath(homeDir)), false, 'peekInstallId must not create a file');

  const minted = getInstallId({ homeDir });
  const after = peekInstallId({ homeDir });
  assert.equal(after, minted);
});

// ---------------------------------------------------------------------------
// Arm 12: header name constant (D-01)
// ---------------------------------------------------------------------------
test('Arm 12: installIdHeaderName is the exact lowercase constant', () => {
  assert.equal(installIdHeaderName, 'x-theo-install-id');
  assert.equal(installIdHeaderName, installIdHeaderName.toLowerCase());
});
