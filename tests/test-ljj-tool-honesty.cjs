#!/usr/bin/env node
'use strict';

/*
 * Quick 260903-ljj Task 1 -- the nine-assertion gate suite for
 * scripts/check-tool-honesty.cjs.
 *
 * Written FIRST (TDD RED): scripts/check-tool-honesty.cjs does not exist yet
 * when this file is authored. Nine named assertions, no more:
 *
 *   NEGATION_REGRESSION      - the load-bearing regression fixture: meeting
 *                               (the already-fixed RCA subject) must never
 *                               appear in the live HIGH RISK list.
 *   POSITIVE_SYNTHETIC       - a fixture claiming a write with no reachable
 *                               write primitive classifies HIGH RISK.
 *   NEGATED_SYNTHETIC        - the same fixture, with a negation sentence
 *                               appended to the description, classifies OK.
 *   BANNER_SYNTHETIC         - the same fixture, with a noWriteBanner( call
 *                               in the branch body, classifies OK.
 *   DEPTH1_NO_FALSE_POSITIVE - a branch calling ops.persist() where the
 *                               sibling module's persist() body writes,
 *                               classifies OK via one-hop resolution.
 *   LIVE_WRITER_OK           - artifact_file (lib/mcp/tools/views.cjs)
 *                               classifies OK against the live tree.
 *   ADVISORY_EXIT             - `--check` always exits 0 and enumerates.
 *   STRICT_EXIT               - `--check --strict` exits 1 iff findings exist.
 *   HYGIENE                   - no em-dash, no frozen tool/branch/command
 *                               count literal in the script source.
 *
 * Canon Part 8: LOCAL only. No network, no Brain, no room.db writes -- this
 * file spawns the checker as a read-only static analyzer and reads fixture
 * files from disk. No em-dashes.
 *
 * Run: node tests/test-ljj-tool-honesty.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'check-tool-honesty.cjs');
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'tool-honesty');

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
    ' (9 assertions: NEGATION_REGRESSION, POSITIVE_SYNTHETIC, NEGATED_SYNTHETIC,' +
    ' BANNER_SYNTHETIC, DEPTH1_NO_FALSE_POSITIVE, LIVE_WRITER_OK, ADVISORY_EXIT,' +
    ' STRICT_EXIT, HYGIENE)\n'
  );
  if (failed > 0) {
    process.stdout.write('\nFailures:\n');
    for (const m of failMessages) process.stdout.write('  - ' + m + '\n');
  }
  process.exit(failed === 0 ? 0 : 1);
}

if (!fs.existsSync(SCRIPT_PATH)) {
  process.stdout.write('RED: ' + SCRIPT_PATH + ' does not exist yet.\n');
  check('scripts/check-tool-honesty.cjs exists', false, 'not found at ' + SCRIPT_PATH);
  finish();
}

// eslint-disable-next-line import/no-dynamic-require
const checker = require(SCRIPT_PATH);

function fixtureFile(name) {
  return { absPath: path.join(FIXTURES_DIR, name), relPath: 'tests/fixtures/tool-honesty/' + name };
}

// ---------------------------------------------------------------------------
// NEGATION_REGRESSION
// ---------------------------------------------------------------------------
process.stdout.write('\n-- NEGATION_REGRESSION --\n');
{
  const report = checker.checkTree();
  const meetingHighRisk = report.highRisk.filter((r) => r.tool === 'meeting');
  check(
    'checkTree() over the live tree returns no HIGH RISK entry whose tool is meeting',
    meetingHighRisk.length === 0,
    'found: ' + JSON.stringify(meetingHighRisk)
  );
}

// ---------------------------------------------------------------------------
// POSITIVE_SYNTHETIC
// ---------------------------------------------------------------------------
process.stdout.write('\n-- POSITIVE_SYNTHETIC --\n');
{
  const { rows } = checker.scanAll({ files: [fixtureFile('positive.cjs')] });
  const row = rows.find((r) => r.tool === 'fixture_positive');
  check('fixture_positive row was scanned', !!row, 'rows=' + JSON.stringify(rows));
  check(
    'fixture_positive classifies HIGH_RISK (STRONG claim, no reachable write)',
    !!row && row.verdict === 'HIGH_RISK',
    'row=' + JSON.stringify(row)
  );
}

// ---------------------------------------------------------------------------
// NEGATED_SYNTHETIC
// ---------------------------------------------------------------------------
process.stdout.write('\n-- NEGATED_SYNTHETIC --\n');
{
  const { rows } = checker.scanAll({ files: [fixtureFile('negated.cjs')] });
  const row = rows.find((r) => r.tool === 'fixture_negated');
  check('fixture_negated row was scanned', !!row, 'rows=' + JSON.stringify(rows));
  check(
    'fixture_negated classifies OK (global no-write disclaimer cancels the claim)',
    !!row && row.verdict === 'OK',
    'row=' + JSON.stringify(row)
  );
}

// ---------------------------------------------------------------------------
// BANNER_SYNTHETIC
// ---------------------------------------------------------------------------
process.stdout.write('\n-- BANNER_SYNTHETIC --\n');
{
  const { rows } = checker.scanAll({ files: [fixtureFile('banner.cjs')] });
  const row = rows.find((r) => r.tool === 'fixture_banner');
  check('fixture_banner row was scanned', !!row, 'rows=' + JSON.stringify(rows));
  check(
    'fixture_banner classifies OK (in-band noWriteBanner( marker in the branch body)',
    !!row && row.verdict === 'OK',
    'row=' + JSON.stringify(row)
  );
}

// ---------------------------------------------------------------------------
// DEPTH1_NO_FALSE_POSITIVE
// ---------------------------------------------------------------------------
process.stdout.write('\n-- DEPTH1_NO_FALSE_POSITIVE --\n');
{
  const { rows } = checker.scanAll({ files: [fixtureFile('depth1-branch.cjs')] });
  const row = rows.find((r) => r.tool === 'fixture_depth1');
  check('fixture_depth1 row was scanned', !!row, 'rows=' + JSON.stringify(rows));
  check(
    'fixture_depth1 classifies OK via one-hop resolution into ops.persist()',
    !!row && row.verdict === 'OK',
    'row=' + JSON.stringify(row)
  );
}

// ---------------------------------------------------------------------------
// LIVE_WRITER_OK
// ---------------------------------------------------------------------------
process.stdout.write('\n-- LIVE_WRITER_OK --\n');
{
  const viewsPath = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'views.cjs');
  const { rows } = checker.scanAll({ files: [{ absPath: viewsPath, relPath: 'lib/mcp/tools/views.cjs' }] });
  const row = rows.find((r) => r.tool === 'artifact_file');
  check('artifact_file row was scanned', !!row, 'rows=' + JSON.stringify(rows.map((r) => r.tool + '.' + r.command)));
  check(
    'artifact_file classifies OK against the live tree (writes via fileArtifact -> writeFileSync + logMemoryEvent)',
    !!row && row.verdict === 'OK',
    'row=' + JSON.stringify(row)
  );
}

// ---------------------------------------------------------------------------
// ADVISORY_EXIT
// ---------------------------------------------------------------------------
process.stdout.write('\n-- ADVISORY_EXIT --\n');
{
  const r = spawnSync('node', [SCRIPT_PATH, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
  check('`--check` exits 0 regardless of live HIGH RISK count', r.status === 0,
    'status=' + r.status + ' stderr=' + (r.stderr || '').slice(0, 400));
  const report = checker.checkTree();
  if (report.highRisk.length > 0) {
    check('`--check` stderr enumerates at least one finding when findings exist',
      /WARN:\s+-\s+/.test(r.stderr || ''), 'stderr=' + (r.stderr || '').slice(0, 800));
  } else {
    check('`--check` prints an OK summary line when the live tree has 0 high-risk findings',
      /check-tool-honesty: OK/.test(r.stdout || ''), 'stdout=' + (r.stdout || ''));
  }
}

// ---------------------------------------------------------------------------
// STRICT_EXIT
// ---------------------------------------------------------------------------
process.stdout.write('\n-- STRICT_EXIT --\n');
{
  const report = checker.checkTree();
  const r = spawnSync('node', [SCRIPT_PATH, '--check', '--strict'], { encoding: 'utf8', cwd: REPO_ROOT });
  const expectedStatus = report.highRisk.length > 0 ? 1 : 0;
  check('`--check --strict` exit code matches whether HIGH RISK entries exist (expected ' + expectedStatus + ')',
    r.status === expectedStatus,
    'status=' + r.status + ' highRiskCount=' + report.highRisk.length + ' stderr=' + (r.stderr || '').slice(0, 400));
}

// ---------------------------------------------------------------------------
// HYGIENE
// ---------------------------------------------------------------------------
process.stdout.write('\n-- HYGIENE --\n');
{
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const hasEmDash = /—/.test(src);
  check('script source contains no em-dash', !hasEmDash);

  // Strip full-line // comments, block comments, and JSDoc-style lines before
  // grepping for a frozen count literal, per this repo's grep-gate hygiene
  // rule (a comment mentioning a number must not self-invalidate the gate).
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\*/.test(line))
    .join('\n');
  const FROZEN_COUNT_PATTERNS = [
    /=\s*36\b/, /=\s*11\b/, /=\s*24\b/,
    /\b36\s+tool/i, /\b11\s+tool/i, /\b24\s+tool/i,
    /\b36\s+branch/i, /\b126\s+branch/i,
  ];
  const hits = FROZEN_COUNT_PATTERNS.filter((re) => re.test(stripped));
  check('script source (comments stripped) carries no frozen tool/branch/command count literal',
    hits.length === 0, 'matched patterns: ' + hits.map(String).join(', '));
}

finish();
