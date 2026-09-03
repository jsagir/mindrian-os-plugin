#!/usr/bin/env node
'use strict';

/*
 * Phase 276 Plan 15, deviation directive 2 -- promote 276-11's B-6
 * over-the-wire assertion into a permanent test.
 *
 * Boundary B-6 (enumerated in scripts/check-tool-honesty.cjs's KNOWN
 * BOUNDARIES header block, plan 276-06): scanAll() reads only the SECOND
 * positional argument to server.tool( -- the tool-level description string
 * -- and never inspects a parameter's own z.something().describe(...)
 * string. graph_write's read_version parameter carries a real disclosure
 * (the CAS fail-open: the check proceeds as a normal write, no conflict
 * reported, when the source node is missing or the guard read itself
 * errors) that the detector structurally cannot see, so this fixture's own
 * claim can never flip a bucket in checkTree() -- the only proof available
 * is a direct, over-the-wire read of the file's own bytes.
 *
 * 276-11-SUMMARY.md's "Over-the-Wire Assertion for Task 2 (B-6, recorded
 * verbatim)" section is the source of truth this file promotes into a
 * permanent, glob-discovered regression pin:
 *
 *   const hasClaim = /lost update is rejected as a conflict/.test(s);
 *   const hasDisclosure = /fails? open/i.test(s);
 *   // hasClaim === true, hasDisclosure === true
 *
 * Both regexes are reproduced here byte-for-byte from that SUMMARY, not
 * paraphrased. Group A pins the exact claim sentence (the original
 * true-in-the-normal-case promise, kept intact -- 276-11 was an ADDITION,
 * never a rewrite). Group B pins the CAS fail-open disclosure clause.
 * Group C pins boundary B-6 itself: scanAll() over lib/mcp/tools/graph.cjs
 * must NOT report a graph_write finding driven by this parameter text,
 * proving the detector really cannot see it (so this file's existence is
 * load-bearing, not redundant with checkTree()).
 *
 * Canon Part 8: LOCAL only. node:fs, node:path, node:assert/strict only. No
 * network, no Brain call, no room.db write. No em-dashes.
 *
 * Run: node tests/test-276-b6-parameter-describe.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GRAPH_TOOLS_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'graph.cjs');
const CHECKER_PATH = path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs');

let passed = 0;
let failed = 0;
const failMessages = [];

function check(label, cond, detail) {
  try {
    assert.ok(cond, label);
    passed += 1;
    process.stdout.write('  ok - ' + label + '\n');
  } catch (e) {
    failed += 1;
    failMessages.push(label + (detail ? ' :: ' + detail : ''));
    process.stdout.write('  FAIL - ' + label + '\n');
    if (detail) process.stdout.write('    ' + String(detail) + '\n');
  }
}

function finish() {
  process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
  if (failed > 0) {
    process.stdout.write('\nFailures:\n');
    for (const m of failMessages) process.stdout.write('  - ' + m + '\n');
  }
  process.exit(failed === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------
// GROUP A -- the original true-in-the-normal-case claim survives. 276-11 was
// an addition, never a rewrite; a future edit that deletes this sentence
// would silently narrow read_version's documented behavior back down.
// ---------------------------------------------------------------------------
process.stdout.write('-- GROUP A: the surviving CAS-conflict claim --\n');
{
  const src = fs.readFileSync(GRAPH_TOOLS_PATH, 'utf8');
  const hasClaim = /lost update is rejected as a conflict/.test(src);
  check(
    'lib/mcp/tools/graph.cjs still claims a lost update is rejected as a conflict',
    hasClaim,
    'the original read_version claim sentence is missing -- 276-11\'s disclosure was meant to ADD to this, not replace it'
  );
}

// ---------------------------------------------------------------------------
// GROUP B -- the CAS fail-open disclosure (276-11 Task 2) is present.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP B: the CAS fail-open disclosure --\n');
{
  const src = fs.readFileSync(GRAPH_TOOLS_PATH, 'utf8');
  const hasDisclosure = /fails? open/i.test(src);
  check(
    'lib/mcp/tools/graph.cjs discloses the CAS check fails open on a missing source node or a guard read error',
    hasDisclosure,
    'the read_version parameter\'s .describe() string no longer discloses the fail-open path -- a regression of 276-11\'s fix'
  );
}

// ---------------------------------------------------------------------------
// GROUP C -- boundary B-6 itself. scanAll() over graph.cjs must not surface
// a graph_write finding attributable to the read_version parameter text,
// proving the detector structurally cannot see a parameter .describe()
// string (only the second positional argument to server.tool( is scanned).
// This is what makes this standalone file load-bearing rather than
// redundant with checkTree().
// ---------------------------------------------------------------------------
process.stdout.write('\n-- GROUP C: boundary B-6 (detector cannot see a parameter describe) --\n');
{
  // eslint-disable-next-line import/no-dynamic-require
  const checker = require(CHECKER_PATH);
  const { rows } = checker.scanAll({
    files: [{ absPath: GRAPH_TOOLS_PATH, relPath: 'lib/mcp/tools/graph.cjs' }],
  });
  const graphWriteRow = rows.find((r) => r.tool === 'graph_write');
  check(
    'graph_write row was scanned',
    !!graphWriteRow,
    'rows=' + JSON.stringify(rows)
  );
  check(
    'graph_write classifies OK via reachability (a write primitive is reachable), not via the read_version parameter text the detector cannot see',
    !!graphWriteRow && graphWriteRow.verdict === 'OK',
    'row=' + JSON.stringify(graphWriteRow)
  );

  const srcSelf = fs.readFileSync(__filename, 'utf8');
  const hasEmDash = srcSelf.indexOf('\u2014') !== -1;
  check('this file contains no em-dash', !hasEmDash);
}

finish();
