#!/usr/bin/env node
'use strict';

/*
 * Phase 172-01 Task 3 -- the coverage-ledger test (Canon Part 11 R1/R9).
 *
 * Fences the wired-XOR-excluded coverage ledger + the EXCLUDE state:
 *   Test 1: coverageReport().surfaces covers EVERY file under commands/ +
 *           skills/ + agents/ (count parity with listSourceFiles()).
 *   Test 2: an in-memory connector fixture with excluded:true + reason
 *           classifies as `excluded` (never gap).
 *   Test 3: an in-memory connector fixture with excluded:true and NO reason is
 *           rejected (build error reported), not silently dark.
 *   Test 4: the committed ledger counts.wired + counts.excluded + counts.gap
 *           === total surfaces (the XOR invariant: no surface in two buckets).
 *   Plus: STALE byte-check (a mutated ledger differs from serializeLedger), and
 *         a Part 8 planted-secret tripwire (no room/ path, no @-email pattern in
 *         any ledger value).
 *
 * Exercises the exported coverageReport() + serializeLedger() + classifySurface()
 * directly: zero subprocess, zero Brain, zero network. House rule: hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GENERATOR = path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs');
const gen = require(GENERATOR);
const { coverageReport, serializeLedger, classifySurface, listSourceFiles } = gen;

const LEDGER_PATH = path.join(REPO_ROOT, 'data', 'connector-coverage-ledger.json');

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log('  ok  ' + label);
  } else {
    console.error('  FAIL  ' + label);
    failures += 1;
  }
}

// ---------------------------------------------------------------------------
// Test 1: count parity -- coverageReport() classifies EVERY surface.
// ---------------------------------------------------------------------------
// Phase 235-02 (CIRS-02) widened the census: coverageReport() now ALSO walks
// every claimed MCP tool file (source:'mcp_tool'), so the old bare
// surfaces.length === listSourceFiles().length identity no longer holds. The
// parity check is split rather than relaxed: the command+skill+agent SLICE must
// still cover every such file exactly, and the FULL census must equal that total
// plus the MCP claimed-source count. Nothing may fall outside both slices.
{
  const report = coverageReport();
  const total = listSourceFiles().length;
  const fileSourced = report.surfaces.filter(
    (s) => s.source === 'command' || s.source === 'skill' || s.source === 'agent'
  );
  assert(
    Array.isArray(report.surfaces) && fileSourced.length === total,
    'coverageReport() covers every command+skill+agent file (' +
      fileSourced.length + ' === ' + total + ')'
  );
  const mcpClaimed = gen.listMcpToolClaimedSources().length;
  assert(
    report.surfaces.length === total + mcpClaimed,
    'coverageReport().surfaces === command+skill+agent files + claimed MCP tool files (' +
      report.surfaces.length + ' === ' + total + ' + ' + mcpClaimed + ')'
  );
  assert(
    report.surfaces.every(
      (s) =>
        typeof s.surface === 'string' &&
        typeof s.source === 'string' &&
        (s.state === 'wired' || s.state === 'excluded' || s.state === 'gap')
    ),
    'every surface is {surface, source, state in {wired,excluded,gap}}'
  );
}

// ---------------------------------------------------------------------------
// Test 2: an excluded:true + reason surface classifies as `excluded`, not gap.
// Drives classifySurface() against an in-memory fixture file written to a temp
// path so the parser walks a real frontmatter block.
// ---------------------------------------------------------------------------
const os = require('node:os');
function writeFixture(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-ledger-'));
  const file = path.join(dir, 'fixture.md');
  fs.writeFileSync(file, body);
  return { dir, file };
}
function cleanup(fx) {
  try {
    fs.rmSync(fx.dir, { recursive: true, force: true });
  } catch (_e) {
    /* ignore */
  }
}

{
  const fx = writeFixture(
    [
      '---',
      'name: excluded-with-reason',
      'connector:',
      '  excluded: true',
      '  reason: "pure utility command, no thinking surface to wire"',
      '---',
      '# body',
      '',
    ].join('\n')
  );
  const c = classifySurface({ kind: 'command', file: fx.file, base: 'excluded-with-reason' });
  assert(c.state === 'excluded', 'excluded:true + reason classifies as `excluded`');
  assert(c.state !== 'gap', 'an excluded surface is NEVER classified as `gap`');
  assert(!c.error, 'an excluded surface WITH a reason carries no build error');
  cleanup(fx);
}

// ---------------------------------------------------------------------------
// Test 3: excluded:true with NO reason is rejected (build error), not dark.
// ---------------------------------------------------------------------------
{
  const fx = writeFixture(
    [
      '---',
      'name: excluded-no-reason',
      'connector:',
      '  excluded: true',
      '---',
      '# body',
      '',
    ].join('\n')
  );
  const c = classifySurface({ kind: 'command', file: fx.file, base: 'excluded-no-reason' });
  assert(c.state === 'excluded', 'excluded:true with no reason still lands in excluded (not gap)');
  assert(
    typeof c.error === 'string' && c.error.indexOf('no reason') !== -1,
    'excluded:true with NO reason is rejected as a build error (D-172-a)'
  );
  cleanup(fx);
}

// ---------------------------------------------------------------------------
// Test 4: the committed ledger XOR invariant -- wired + excluded + gap === total.
// ---------------------------------------------------------------------------
{
  const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  const c = ledger.counts;
  const sum = c.wired + c.excluded + c.gap;
  assert(
    sum === ledger.surfaces.length,
    'committed ledger: wired + excluded + gap === surfaces.length (XOR invariant, ' +
      sum + ' === ' + ledger.surfaces.length + ')'
  );
  assert(
    Object.keys(ledger).join(',') === 'generated_note,counts,surfaces',
    'committed ledger top-level keys are exactly generated_note, counts, surfaces'
  );
}

// ---------------------------------------------------------------------------
// STALE byte-check: serializeLedger(coverageReport()) matches the on-disk ledger
// byte-for-byte, AND a mutated ledger differs (the --check STALE discipline).
// ---------------------------------------------------------------------------
{
  const fresh = serializeLedger(coverageReport());
  const onDisk = fs.readFileSync(LEDGER_PATH, 'utf8');
  assert(fresh === onDisk, 'serializeLedger() matches the committed ledger byte-for-byte (not stale)');

  const mutated = JSON.parse(onDisk);
  mutated.surfaces = mutated.surfaces.slice(1); // drop one -> stale
  const mutatedReport = { surfaces: mutated.surfaces, counts: mutated.counts };
  assert(
    serializeLedger(mutatedReport) !== onDisk,
    'a mutated (surface-dropped) ledger differs byte-for-byte (STALE is detectable)'
  );
}

// ---------------------------------------------------------------------------
// Part 8 planted-secret tripwire: no ledger value carries a room/ path or an
// @-email pattern (the ledger carries ONLY {surface, source, state} machinery).
// ---------------------------------------------------------------------------
{
  const raw = fs.readFileSync(LEDGER_PATH, 'utf8');
  assert(raw.indexOf('room/') === -1, 'ledger carries no room/ path (Part 8)');
  assert(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(raw), 'ledger carries no email pattern (Part 8)');
}

if (failures > 0) {
  console.error('\ntest-connector-coverage-ledger: ' + failures + ' FAILURE(S)');
  process.exit(1);
}
console.log('\ntest-connector-coverage-ledger: PASS (4 behaviors + STALE + Part 8 tripwire)');
