#!/usr/bin/env node
'use strict';

/*
 * Phase 276, plan 276-01, Task 3 -- the RED proof for TOOLHON-01 (the dead
 * switch (command) branch splitter) plus the TOOLHON-05 boundary
 * enumeration assertion.
 *
 * Written FIRST (TDD RED): observed FAILING against the pre-fix
 * scripts/check-tool-honesty.cjs's splitBranches, per the 209b604f (RED) /
 * 75278850 (GREEN) precedent this exact script was originally built under.
 * Do NOT fix the detector in this file or in scripts/check-tool-honesty.cjs
 * -- that is plan 276-06's one-line GREEN fix. This plan's own success
 * criterion is `node tests/test-276-tool-honesty-switch-branches.cjs`
 * exiting 1 at the end of the plan.
 *
 * THE DEFECT (scripts/check-tool-honesty.cjs:529, :538-541). The case-label
 * regex runs over `masked`, the output of maskNonCode, in which every
 * string literal is blanked including its delimiters. `\bcase\s+` is
 * greedy, so it swallows the blanked-out quoted command value too; `idx`
 * lands on the `:` that follows, `qc` is `':'`, and the label is silently
 * discarded. branchMap is therefore always {} for a switch-dispatched tool,
 * and every command in that tool shares the whole handler body as its
 * "own" text -- a single write anywhere makes every command in a 15/13/5-
 * command tool report a reachable write, at 33x scale across room_state /
 * room_content / room_graph (276-RESEARCH.md, Detector Bug D-1).
 *
 * Canon Part 8: LOCAL only. This file requires scripts/check-tool-honesty.cjs
 * and calls its exported scanAll / splitBranches (neither ever calls
 * process.exit, so both are safe inside a test) plus the raw text-scanning
 * primitives (maskNonCode, scanBalanced, splitTopLevelArgs,
 * extractStringLiteralConcat) the checker itself exports, used here ONLY to
 * locate a handler body the same way scanAll's own internal
 * extractHandlerBody does -- extractHandlerBody itself is not exported, so
 * this file reproduces its four-line shape from the exported primitives
 * rather than re-reading source text for behavior. No em-dashes (checked
 * via the escape sequence \u2014 below, never a literal glyph).
 *
 * Run: node tests/test-276-tool-honesty-switch-branches.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs');
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'tool-honesty');
const TOOL_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');

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
  process.stdout.write(
    '\n  ' + passed + ' passed, ' + failed + ' failed' +
    ' (assertions: TOOLHON01_SPLIT, TOOLHON01_VERDICT, TOOLHON01_LIVE_TREE,' +
    ' TOOLHON05_BOUNDARIES, HYGIENE, FALSE_VERIFICATION_COMMENT)\n'
  );
  if (failed > 0) {
    process.stdout.write('\nFailures:\n');
    for (const m of failMessages) process.stdout.write('  - ' + m + '\n');
  }
  process.exit(failed === 0 ? 0 : 1);
}

if (!fs.existsSync(SCRIPT_PATH)) {
  check('scripts/check-tool-honesty.cjs exists', false, 'not found at ' + SCRIPT_PATH);
  finish();
}

// eslint-disable-next-line import/no-dynamic-require
const checker = require(SCRIPT_PATH);

function fixtureFile(name) {
  return { absPath: path.join(FIXTURES_DIR, name), relPath: 'tests/fixtures/tool-honesty/' + name };
}

// extractHandlerBodyViaPrimitives(handlerArgText) -- reproduces
// check-tool-honesty.cjs's own (unexported) extractHandlerBody using only
// its exported primitives, so this file locates a handler body the same
// way scanAll does without duplicating splitBranches itself.
function extractHandlerBodyViaPrimitives(handlerArgText) {
  const masked = checker.maskNonCode(handlerArgText);
  const arrowIdx = masked.indexOf('=>');
  if (arrowIdx === -1) return null;
  let i = arrowIdx + 2;
  while (i < masked.length && /\s/.test(masked[i])) i += 1;
  if (masked[i] !== '{') return null;
  const close = checker.scanBalanced(masked, i);
  if (close === -1) return null;
  return handlerArgText.slice(i + 1, close);
}

// locateToolCallHandlerBody(fileText, toolName) -- finds the server.tool(
// call whose first argument is toolName, and returns its handler body text,
// using only checker.maskNonCode / checker.scanBalanced /
// checker.splitTopLevelArgs / checker.extractStringLiteralConcat -- the
// exact primitives scanAll's own findServerToolCalls uses.
function locateToolCallHandlerBody(fileText, toolName) {
  const masked = checker.maskNonCode(fileText);
  const re = /server\.tool\s*\(/g;
  let m;
  while ((m = re.exec(masked)) !== null) {
    const openParen = masked.indexOf('(', m.index);
    if (openParen === -1) continue;
    const closeParen = checker.scanBalanced(masked, openParen);
    if (closeParen === -1) continue;
    const innerText = fileText.slice(openParen + 1, closeParen);
    const args = checker.splitTopLevelArgs(innerText);
    if (args.length < 4) continue;
    const name = checker.extractStringLiteralConcat(args[0]);
    if (name !== toolName) continue;
    return extractHandlerBodyViaPrimitives(args[3]);
  }
  return null;
}

// ---------------------------------------------------------------------------
// TOOLHON01_SPLIT -- splitBranches on the switch-dispatch fixture's own
// handler body must return a branchMap with BOTH command keys. This is the
// direct proof of D-1, and it fails today: the pre-fix splitter's case-label
// regex is applied against maskNonCode's blanked-string output, so every
// case label is discarded and branchMap is always {}.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- TOOLHON01_SPLIT --\n');
{
  const fixturePath = path.join(FIXTURES_DIR, 'switch-dispatch.cjs');
  const fixtureText = fs.readFileSync(fixturePath, 'utf8');
  const handlerBodyText = locateToolCallHandlerBody(fixtureText, 'fixture_switch');
  check('fixture_switch handler body was located', !!handlerBodyText);
  const { branchMap } = checker.splitBranches(handlerBodyText || '');
  const keys = Object.keys(branchMap);
  check(
    'splitBranches on fixture_switch recognizes a write-thing branch',
    keys.includes('write-thing'),
    'branchMap keys=' + JSON.stringify(keys)
  );
  check(
    'splitBranches on fixture_switch recognizes an echo-thing branch',
    keys.includes('echo-thing'),
    'branchMap keys=' + JSON.stringify(keys)
  );
}

// ---------------------------------------------------------------------------
// TOOLHON01_VERDICT -- the honest statement of the bug through the public
// scanAll API: today BOTH commands report the write-branch's reachability,
// because both share the identical effectiveText (the whole handler body,
// since branchMap is {}). echo-thing must NOT carry the write reason.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- TOOLHON01_VERDICT --\n');
{
  const { rows } = checker.scanAll({ files: [fixtureFile('switch-dispatch.cjs')] });
  const echoRow = rows.find((r) => r.tool === 'fixture_switch' && r.command === 'echo-thing');
  const writeRow = rows.find((r) => r.tool === 'fixture_switch' && r.command === 'write-thing');
  check('fixture_switch.echo-thing row was scanned', !!echoRow, 'rows=' + JSON.stringify(rows));
  check('fixture_switch.write-thing row was scanned', !!writeRow, 'rows=' + JSON.stringify(rows));
  check(
    'fixture_switch.echo-thing does NOT carry the reason "a write primitive is reachable"',
    !!echoRow && echoRow.reason !== 'a write primitive is reachable',
    'echoRow=' + JSON.stringify(echoRow)
  );
  check(
    'fixture_switch.write-thing DOES carry the reason "a write primitive is reachable"',
    !!writeRow && writeRow.reason === 'a write primitive is reachable',
    'writeRow=' + JSON.stringify(writeRow)
  );
}

// ---------------------------------------------------------------------------
// TOOLHON01_LIVE_TREE -- the same defect against the real tree: room_content
// (15-command vocabulary, 276-RESEARCH.md's D-1 measurement table) must
// recognize more than 0 branches. Not hard-coded to a count, so this
// assertion survives a future vocabulary change.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- TOOLHON01_LIVE_TREE --\n');
{
  const routerText = fs.readFileSync(TOOL_ROUTER_PATH, 'utf8');
  const handlerBodyText = locateToolCallHandlerBody(routerText, 'room_content');
  check('room_content handler body was located in lib/mcp/tool-router.cjs', !!handlerBodyText);
  const { branchMap } = checker.splitBranches(handlerBodyText || '');
  const recognizedCount = Object.keys(branchMap).length;
  check(
    'splitBranches recognizes more than 0 branches in the live room_content handler',
    recognizedCount > 0,
    'recognizedCount=' + recognizedCount + ' keys=' + JSON.stringify(Object.keys(branchMap))
  );
}

// ---------------------------------------------------------------------------
// TOOLHON05_BOUNDARIES -- the script header must enumerate every known
// detector boundary by identifier (276-RESEARCH.md "Detector Boundaries"):
// B-1 argument-gated writes, B-2 barrel re-exports, B-3 subprocess-mediated
// writes, B-4 dispatch-shape coverage, B-5 write-primitive semantics, and
// B-6 (minted by this phase): parameter .describe() strings are never
// scanned -- scanAll reads only the second positional argument to
// server.tool(, discovered while tracing graph_write's read_version
// describe string. Fails today: the header carries no B-N identifiers.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- TOOLHON05_BOUNDARIES --\n');
{
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  for (const id of ['B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'B-6']) {
    check('script header enumerates ' + id, src.includes(id), 'not found: ' + id);
  }
}

// ---------------------------------------------------------------------------
// HYGIENE -- matching test-ljj-tool-honesty.cjs:216-220. Checked via the
// Unicode escape sequence \u2014, never a literal em-dash character, so
// THIS file's own source stays clean under the repo-wide no-em-dash fence.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- HYGIENE --\n');
{
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const hasEmDash = src.indexOf('\u2014') !== -1;
  check('scripts/check-tool-honesty.cjs source contains no em-dash', !hasEmDash);
}

// ---------------------------------------------------------------------------
// FALSE_VERIFICATION_COMMENT -- scripts/check-tool-honesty.cjs:559-565's
// comment claims the fall-through grouping was "verified against real
// fall-through in this codebase." That verification cannot have happened:
// the switch path never produced a label to verify against, because every
// case label was discarded by D-1. This assertion is about the comment's
// own claim, not a count literal, so it reads the raw source directly
// rather than stripping comments first. Fails today: the false claim is
// still there.
// ---------------------------------------------------------------------------
process.stdout.write('\n-- FALSE_VERIFICATION_COMMENT --\n');
{
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const hasFalseClaim = src.includes('verified against real fall-through');
  check(
    'scripts/check-tool-honesty.cjs no longer claims the fall-through grouping was ' +
      'verified against real fall-through (it never was; the switch path produced no label)',
    !hasFalseClaim,
    'false claim still present: ' + hasFalseClaim
  );
}

finish();
