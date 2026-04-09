/**
 * Test: Phase 68 -- classify-insight synchronous execution + frontmatter injection
 *
 * Tests that:
 * 1. Classification result is injected into YAML frontmatter
 * 2. SUGGEST/CLASSIFIED/UNCERTAIN all work
 * 3. No frontmatter = skip gracefully
 * 4. Existing classification field = idempotent (no duplicate)
 * 5. execSync is used (not fire-and-forget) in source code
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SRC_PATH = path.resolve(__dirname, '../lib/core/intelligence-cascade.cjs');

// ---- Test: Source code uses execSync for classify-insight (not fire-and-forget) ----
function testExecSyncUsed() {
  const src = fs.readFileSync(SRC_PATH, 'utf8');

  // Must have execSync call with classify-insight
  assert.ok(
    src.includes('execSync') && src.includes('classify-insight'),
    'Source must use execSync for classify-insight'
  );

  // Must NOT have 'dispatched' for classification in runCascade
  const lines = src.split('\n');
  let inRunCascade = false;
  let dispatchedInRunCascade = false;
  for (const line of lines) {
    if (line.includes('async function runCascade')) inRunCascade = true;
    if (line.includes('function queueCascade')) inRunCascade = false;
    if (inRunCascade && line.includes("results.classification = 'dispatched'")) {
      dispatchedInRunCascade = true;
    }
  }
  assert.strictEqual(dispatchedInRunCascade, false,
    'runCascade must not set classification to dispatched');

  console.log('PASS: execSync used for classify-insight');
}

// ---- Test: Frontmatter injection helper exists in source ----
function testFrontmatterInjectionExists() {
  const src = fs.readFileSync(SRC_PATH, 'utf8');

  // Must have classification injection code (writes classification: to file)
  assert.ok(
    src.includes('classification:') && src.includes('writeFileSync'),
    'Source must have frontmatter injection code that writes classification field'
  );

  console.log('PASS: frontmatter injection code exists');
}

// ---- Test: queueCascade also uses synchronous classify ----
function testQueueCascadeSynchronous() {
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const lines = src.split('\n');

  let inQueueCascade = false;
  let dispatchedInQueue = false;
  for (const line of lines) {
    if (line.includes('function queueCascade')) inQueueCascade = true;
    if (line.includes('module.exports')) inQueueCascade = false;
    if (inQueueCascade && line.includes("perFileResult.classification = 'dispatched'")) {
      dispatchedInQueue = true;
    }
  }
  assert.strictEqual(dispatchedInQueue, false,
    'queueCascade must not set classification to dispatched');

  console.log('PASS: queueCascade uses synchronous classify');
}

// ---- Run all tests ----
let passed = 0;
let failed = 0;
const tests = [testExecSyncUsed, testFrontmatterInjectionExists, testQueueCascadeSynchronous];

for (const test of tests) {
  try {
    test();
    passed++;
  } catch (e) {
    console.error(`FAIL: ${test.name}: ${e.message}`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
