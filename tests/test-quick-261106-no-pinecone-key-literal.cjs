#!/usr/bin/env node
// Quick task 261106-pinecone-key-default.
// Gate 1: no tracked file holds a Pinecone key literal (the prefix followed by 20 or more key characters).
// Gate 2: scripts/consolidate-pinecone.py exits with code 2 and a clear message when PINECONE_API_KEY
//         is missing or empty, and the message does not hold any key value.
// The pattern is built from parts so this file does not match its own gate.
// Usage: node tests/test-quick-261106-no-pinecone-key-literal.cjs
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const PREFIX = ['pc', 'sk', '_'].join('');
const KEY_RE = new RegExp(PREFIX + '[A-Za-z0-9_]{20,}');

function gate1() {
  const ls = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 });
  assert.strictEqual(ls.status, 0, 'git ls-files failed');
  const files = ls.stdout.toString('utf8').split('\0').filter(Boolean);
  const hits = [];
  for (const rel of files) {
    const abs = path.join(ROOT, rel);
    let buf;
    try {
      const st = fs.lstatSync(abs);
      if (!st.isFile()) continue;
      buf = fs.readFileSync(abs);
    } catch (_) {
      continue; // deleted or unreadable in the working tree
    }
    if (buf.includes(0)) continue; // binary
    if (KEY_RE.test(buf.toString('latin1'))) hits.push(rel); // report the path only, never the match
  }
  assert.deepStrictEqual(hits, [], 'tracked files hold a key literal: ' + hits.join(', '));
}

function gate2() {
  const script = path.join(ROOT, 'scripts', 'consolidate-pinecone.py');
  const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-stub-'));
  try {
    fs.writeFileSync(path.join(stubDir, 'pinecone.py'), 'class Pinecone:\n    def __init__(self, *a, **k):\n        raise SystemExit(77)\n');
    const base = { ...process.env, PYTHONPATH: stubDir };
    delete base.PINECONE_API_KEY;
    const cases = [
      { label: 'missing', env: base },
      { label: 'empty', env: { ...base, PINECONE_API_KEY: '' } },
      { label: 'blank', env: { ...base, PINECONE_API_KEY: '   ' } },
    ];
    // cwd is the stub directory so the stub shadows the real pinecone package
    for (const c of cases) {
      const r = spawnSync('python3', [script], { cwd: stubDir, env: c.env, encoding: 'utf8', timeout: 20000 });
      assert.strictEqual(r.status, 2, c.label + ': expected exit code 2, got ' + r.status);
      assert.match(r.stderr, /PINECONE_API_KEY/, c.label + ': stderr must name PINECONE_API_KEY');
      assert.ok(!KEY_RE.test(r.stdout + r.stderr), c.label + ': output must not hold a key literal');
    }
  } finally {
    fs.rmSync(stubDir, { recursive: true, force: true });
  }
}

gate1();
gate2();
console.log('PASS test-quick-261106-no-pinecone-key-literal');
