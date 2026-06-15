'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-04 -- Part 9 chokepoint source tripwire (RJP-07).
 * ============================================================================
 * Proves the reach-penalty / reader path reads room memory ONLY through the
 * lib/core/navigation.cjs chokepoint (Canon Part 9 / Phase 109): no direct
 * sqlite handle, no better-sqlite3 require, no node:sqlite require, no fs read of
 * room data. The reader is the ONLY 158 module that touches room.db (the
 * orchestrator's purity is proven separately in
 * test-158-reach-orchestrator-pure.cjs); this suite guards the read path.
 *
 *   Test 1: the reader requires ../core/navigation.cjs and uses findRecentChanges
 *           (the shipped chokepoint read).
 *   Test 2: the reader's executable source contains none of the forbidden
 *           direct-db / fs tokens (comment lines stripped first so header prose
 *           mentioning sqlite/fs never trips the gate -- T-158-04-04).
 *   Test 3: navigation.cjs is the ONLY non-relative-core require beyond node:
 *           builtins (no second db/fs module sneaks in).
 *
 * Deterministic, source-only. NO RNG, NO live Brain. NO em-dashes (CLAUDE.md
 * HARD RULE). Hyphens only. CJS.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const READER_PATH = path.join(REPO_ROOT, 'lib', 'workflow', 'reach-reject-reader.cjs');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

function executableSource(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

console.log('test-158-reach-part9-chokepoint.cjs (RJP-07): reads ONLY via navigation.cjs');

const SRC = executableSource(READER_PATH);

// ---------------------------------------------------------------------------
// Test 1: the reader reads through the navigation chokepoint.
// ---------------------------------------------------------------------------
check('reach-reject-reader requires ../core/navigation.cjs and uses findRecentChanges', () => {
  assert.ok(
    /require\(['"]\.\.\/core\/navigation\.cjs['"]\)/.test(SRC),
    'the reader must require ../core/navigation.cjs (the Part 9 chokepoint)'
  );
  assert.ok(
    /navigation\.findRecentChanges\(/.test(SRC),
    'the reader must read via navigation.findRecentChanges (the shipped chokepoint read)'
  );
});

// ---------------------------------------------------------------------------
// Test 2: no direct-db / fs token in the executable source.
// ---------------------------------------------------------------------------
check('reach-reject-reader executable source has no direct sqlite / better-sqlite3 / fs read', () => {
  const FORBIDDEN = [
    { label: "require('node:sqlite')", re: /require\(['"]node:sqlite/ },
    { label: 'DatabaseSync', re: /\bDatabaseSync\b/ },
    { label: 'better-sqlite3', re: /better-sqlite3/ },
    { label: "require('sqlite')", re: /require\(['"]sqlite/ },
    { label: 'fs.read', re: /\bfs\.read/ },
    { label: 'fs.write', re: /\bfs\.write/ },
    { label: 'readFileSync', re: /readFileSync/ },
    { label: 'fetch(', re: /fetch\(/ },
    { label: 'http(s) URL', re: /https?:\/\// },
    { label: 'brain-client', re: /brain-client/ },
  ];
  for (const f of FORBIDDEN) {
    assert.ok(!f.re.test(SRC), 'forbidden direct-db/fs token in the reader live code: ' + f.label);
  }
});

// ---------------------------------------------------------------------------
// Test 3: navigation.cjs is the ONLY require beyond node: builtins.
// ---------------------------------------------------------------------------
check('navigation.cjs is the reader ONLY require (no second db/fs module)', () => {
  const requireLines = SRC.split('\n').filter((line) => /\brequire\(/.test(line));
  assert.ok(requireLines.length >= 1, 'expected at least one require line');
  for (const line of requireLines) {
    const isNav = /core\/navigation\.cjs/.test(line);
    const isNodeBuiltin = /require\(['"]node:/.test(line);
    assert.ok(
      isNav || isNodeBuiltin,
      'the reader may only require navigation.cjs or node: builtins; found: ' + line.trim()
    );
  }

  // Hygiene proof: the RAW source DOES mention sqlite/fs in a comment (documenting
  // the absence), so the comment-strip is genuinely load-bearing.
  const raw = fs.readFileSync(READER_PATH, 'utf8');
  assert.ok(/sqlite/.test(raw), 'the raw source documents the no-direct-sqlite contract in a comment');
});

console.log('');
console.log('PASS test-158-reach-part9-chokepoint.cjs (' + passed + ' checks)');
process.exit(0);
