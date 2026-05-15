/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-04 Plan 04 Task 1 -- resolve-vercel-key tests.
 *
 * Mirrors test patterns from lib/core/resolve-brain-key.cjs tests.
 * Precedence per LD2: process.env.VERCEL_TOKEN -> <home>/.mindrian.env ->
 * <cwd>/.env -> null.
 *
 * Quote-stripping: handles both `VERCEL_TOKEN="abc"` (double-quoted) and
 * `VERCEL_TOKEN=abc` (raw) per feedback_gmail_qp_env_var_corruption.md.
 *
 * VERCEL_PROJECT_NAME is exported as the constant 'mindrianos-briefs'.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function _mkTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mva-vercel-key-test-'));
}

function _cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

// Force-reload module after env mutation
function _freshRequire() {
  const p = require.resolve('./resolve-vercel-key.cjs');
  delete require.cache[p];
  return require('./resolve-vercel-key.cjs');
}

test('Test 1: process.env.VERCEL_TOKEN takes precedence over file', () => {
  const home = _mkTmpHome();
  try {
    fs.writeFileSync(path.join(home, '.mindrian.env'),
      'VERCEL_TOKEN="from-file"\n', { mode: 0o600 });
    const prev = process.env.VERCEL_TOKEN;
    process.env.VERCEL_TOKEN = 'from-env';
    try {
      const { resolveVercelKey } = _freshRequire();
      const r = resolveVercelKey({ home });
      assert.equal(r, 'from-env');
    } finally {
      if (prev === undefined) { delete process.env.VERCEL_TOKEN; }
      else { process.env.VERCEL_TOKEN = prev; }
    }
  } finally {
    _cleanup(home);
  }
});

test('Test 2: ~/.mindrian.env with quoted VERCEL_TOKEN resolves correctly', () => {
  const home = _mkTmpHome();
  try {
    fs.writeFileSync(path.join(home, '.mindrian.env'),
      'OTHER_VAR=ignore\nVERCEL_TOKEN="abc123"\n', { mode: 0o600 });
    const prev = process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_TOKEN;
    try {
      const { resolveVercelKey } = _freshRequire();
      const r = resolveVercelKey({ home, cwd: home });
      assert.equal(r, 'abc123');
    } finally {
      if (prev !== undefined) process.env.VERCEL_TOKEN = prev;
    }
  } finally {
    _cleanup(home);
  }
});

test('Test 3: no env + no file = null', () => {
  const home = _mkTmpHome();
  try {
    const prev = process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_TOKEN;
    try {
      const { resolveVercelKey } = _freshRequire();
      const r = resolveVercelKey({ home, cwd: home });
      assert.equal(r, null);
    } finally {
      if (prev !== undefined) process.env.VERCEL_TOKEN = prev;
    }
  } finally {
    _cleanup(home);
  }
});

test('Test 4: ~/.mindrian.env with unquoted VERCEL_TOKEN resolves correctly', () => {
  const home = _mkTmpHome();
  try {
    fs.writeFileSync(path.join(home, '.mindrian.env'),
      'VERCEL_TOKEN=raw-no-quotes\n', { mode: 0o600 });
    const prev = process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_TOKEN;
    try {
      const { resolveVercelKey } = _freshRequire();
      const r = resolveVercelKey({ home, cwd: home });
      assert.equal(r, 'raw-no-quotes');
    } finally {
      if (prev !== undefined) process.env.VERCEL_TOKEN = prev;
    }
  } finally {
    _cleanup(home);
  }
});

test('Test 5: VERCEL_PROJECT_NAME exported constant === mindrianos-briefs', () => {
  const { VERCEL_PROJECT_NAME } = _freshRequire();
  assert.equal(VERCEL_PROJECT_NAME, 'mindrianos-briefs');
});

test('Test 5b: CWD .env fallback when ~/.mindrian.env absent', () => {
  const home = _mkTmpHome();
  const cwd = _mkTmpHome();
  try {
    fs.writeFileSync(path.join(cwd, '.env'),
      'VERCEL_TOKEN="from-cwd-env"\n', { mode: 0o600 });
    const prev = process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_TOKEN;
    try {
      const { resolveVercelKey } = _freshRequire();
      const r = resolveVercelKey({ home, cwd });
      assert.equal(r, 'from-cwd-env');
    } finally {
      if (prev !== undefined) process.env.VERCEL_TOKEN = prev;
    }
  } finally {
    _cleanup(home);
    _cleanup(cwd);
  }
});
