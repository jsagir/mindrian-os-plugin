#!/usr/bin/env node
'use strict';

/**
 * Phase 250 Plan 01, Task 3 (HONEST-01) -- the doctrine grep fence.
 * ==========================================================================
 * Proves the silent-fallback doctrine phrases are DEAD everywhere they are
 * shipped as instruction text: skills/, commands/, agents/, dist/. Scoped
 * (Pitfall 6) -- NOT lib/, NOT docs/ (those red-flood on legitimate
 * env-parse comments and ride Phase 252's sweep; the doc-level rewrite is
 * plan 250-02/250-03 territory).
 *
 * The closed pattern list (research Pitfall 6 -- exactly these two, no
 * widening):
 *   - /silent fallback/i
 *   - /never mention (failures|this bookkeeping)/i
 *
 * This test is a fence: it PASSES only when zero matches exist. Run BEFORE
 * the SKILL.md rewrite, it demonstrably FAILS against the live kill list
 * (skills/brain-connector/SKILL.md lines 31/100/126 + both dist mirrors at
 * lines 27/96 -- 7 known hits, this fence's own can-fail proof). Run AFTER
 * the rewrite + dist rebuild, it passes.
 *
 * node --test, CJS, node:assert/strict + node:fs only. No new deps.
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');

// Closed 2-pattern list. Widening this list is out of scope for this fence
// (research Pitfall 6).
const FORBIDDEN = [
  /silent fallback/i,
  /never mention (failures|this bookkeeping)/i,
];

// Scoped to instruction/shipped surfaces only.
const SCOPE_DIRS = ['skills', 'commands', 'agents', 'dist'];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (entry.isFile() && /\.(md|cjs|js|json)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function scanFile(filePath) {
  const hits = [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    for (const pattern of FORBIDDEN) {
      if (pattern.test(line)) {
        hits.push({ file: filePath, line: idx + 1, pattern: pattern.source, text: line.trim() });
      }
    }
  });
  return hits;
}

function scanScope() {
  const allHits = [];
  for (const dir of SCOPE_DIRS) {
    const dirPath = path.join(REPO_ROOT, dir);
    const files = walk(dirPath, []);
    for (const f of files) {
      allHits.push(...scanFile(f));
    }
  }
  return allHits;
}

test('Doctrine fence: zero silent-fallback / never-mention-failures hits in skills/, commands/, agents/, dist/', () => {
  const hits = scanScope();
  if (hits.length > 0) {
    const report = hits.map((h) => h.file + ':' + h.line + ' -- ' + h.text).join('\n');
    assert.fail('Doctrine phrase(s) still present:\n' + report);
  }
  assert.equal(hits.length, 0);
});

test('Doctrine fence self-check: the pattern list is exactly the closed two-pattern set (no widening)', () => {
  assert.equal(FORBIDDEN.length, 2, 'the fence must carry exactly two patterns per research Pitfall 6');
  assert.equal(FORBIDDEN[0].source, 'silent fallback');
  assert.equal(FORBIDDEN[1].source, 'never mention (failures|this bookkeeping)');
});
