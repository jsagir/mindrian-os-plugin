'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 158-04 -- orchestrator purity tripwire (Part 9 / SC-07).
 * ============================================================================
 * A source-grep tripwire mirroring the Phase 148 / Phase 110 zero-egress sweep:
 * lib/hmi/dial-reach-orchestrator.cjs (buildReachList / _resolveReachScore) must
 * make ZERO db / fs / Brain / async calls in its LIVE code. The penalty fold
 * runs UPSTREAM on the engine arm (computeReachPenalties, db open); the
 * orchestrator only ever sees scalars + a Set, so it stays a PURE renderer
 * (SC-07: db is NEVER threaded into dial-reach-orchestrator).
 *
 * Comment lines are stripped before grepping so the file's own header prose
 * describing the purity invariant ("ZERO live Brain calls", "no fs write", "no
 * db write") does not self-invalidate the gate (grep-gate hygiene, T-158-04-04).
 *
 * Deterministic, db-free, source-only. NO RNG, NO live Brain. NO em-dashes
 * (CLAUDE.md HARD RULE). Hyphens only. CJS.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ORCH_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs');

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// Strip comment lines (whole-line // or block-comment body lines starting with
// optional whitespace then // or * or /*) so header prose never trips the grep.
// This is the comment-stripped-source idiom the run-all-158.sh sweeps also use.
function executableSource(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');
}

console.log('test-158-reach-orchestrator-pure.cjs (Part 9 / SC-07): orchestrator is a pure renderer');

const SRC = executableSource(ORCH_PATH);

// The forbidden tokens: any db open, any fs read/write, any network egress, any
// Brain-client require, any await (the orchestrator is synchronous by contract).
const FORBIDDEN = [
  { label: "require('node:sqlite')", re: /require\(['"]node:sqlite/ },
  { label: 'better-sqlite3', re: /better-sqlite3/ },
  { label: 'fs.read / fs.write', re: /\bfs\.(read|write)/ },
  { label: 'fetch(', re: /fetch\(/ },
  { label: 'http(s) URL', re: /https?:\/\// },
  { label: 'brain-client', re: /brain-client/ },
  { label: 'await', re: /\bawait\b/ },
  // A db handle threaded in would be the SC-07 breach: no roomState.db read, no
  // db parameter, no navigation require in the orchestrator's live code.
  { label: 'navigation require', re: /require\(['"][^'"]*navigation/ },
];

// ---------------------------------------------------------------------------
// Test 1: the orchestrator's executable source contains none of the forbidden
// db / fs / Brain / await tokens.
// ---------------------------------------------------------------------------
check('dial-reach-orchestrator executable source contains zero db/fs/Brain/await tokens', () => {
  for (const f of FORBIDDEN) {
    assert.ok(
      !f.re.test(SRC),
      'forbidden token in orchestrator live code: ' + f.label
    );
  }
});

// ---------------------------------------------------------------------------
// Test 2: the orchestrator's ONLY require is the f-selector-ranker (the shipped
// D4 blend, itself zero-Brain LOCAL-only). No other require is present.
// ---------------------------------------------------------------------------
check('the orchestrator requires ONLY f-selector-ranker.cjs (no db/navigation/fs module)', () => {
  const requireLines = SRC
    .split('\n')
    .filter((line) => /\brequire\(/.test(line));
  assert.ok(requireLines.length >= 1, 'expected at least one require line');
  for (const line of requireLines) {
    assert.ok(
      /f-selector-ranker\.cjs/.test(line),
      'the only require must be f-selector-ranker.cjs; found: ' + line.trim()
    );
  }
});

// ---------------------------------------------------------------------------
// Test 3: the comment-stripping is real -- the RAW source DOES mention the
// purity invariant prose (so the gate is genuinely guarding executable lines,
// not merely a file that happens to be clean).
// ---------------------------------------------------------------------------
check('comment-strip hygiene is load-bearing (raw source mentions the invariant in prose)', () => {
  const raw = fs.readFileSync(ORCH_PATH, 'utf8');
  assert.ok(
    /Brain/.test(raw),
    'the raw source should describe the Brain-boundary invariant in a comment (proving the strip matters)'
  );
});

console.log('');
console.log('PASS test-158-reach-orchestrator-pure.cjs (' + passed + ' checks)');
process.exit(0);
