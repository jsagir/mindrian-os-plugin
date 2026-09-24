#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 03 (MCPV2-03) -- the zod 3 -> 4 wire-contract test.
 * ==========================================================================
 * TDD RED on the unchanged tree (zod 3 installed): check (b) fails because
 * the accepted zod-4 delta is not yet present. TDD GREEN once 267-03 Task 2
 * bumps zod to 4.x in lockstep with @modelcontextprotocol/sdk@1.30.1.
 *
 * Four checks, all against tests/fixtures/267/wire-snapshot-zod3.json (the
 * 267-01 baseline) and tests/fixtures/267/zod4-accepted-deltas.json (this
 * plan's own accepted-delta ledger, measured on a scratch zod@4 install
 * BEFORE the repo's own dependency bump):
 *
 *   (a) Every tool and prompt description is byte-identical to the zod 3
 *       snapshot, in EITHER zod state. A description diff is never accepted
 *       (CTX C-8: no em-dashes / Feynman prose is a stated invariant, and no
 *       zod version bump should ever silently reword a tool description).
 *   (b) Read the installed zod major from node_modules/zod/package.json.
 *       If 4: the observed diff set (excluding any diff matching an entry in
 *       app_views_schema_fix or prompts_fix -- reserved for 267-09/267-10,
 *       both empty today) must EQUAL zod4_additionalProperties_dropped plus
 *       zod4_other exactly, set-wise (matched on kind+name+field, same
 *       granularity mcp-wire-267.cjs's compareToSnapshot already uses).
 *       Extra drift beyond the pinned set FAILS. A pinned delta that stops
 *       reproducing also FAILS (so a future zod 4.x patch that restores
 *       stricter behavior is visible, not silently accepted).
 *       If 3: FAIL, printing "zod 3 installed: accepted zod-4 delta not yet
 *       present" (this is the RED state on the unchanged tree).
 *   (c) All 6 brain-shim tools' normalized inputSchema still advertises
 *       additionalProperties:false in both zod states (the Part 8
 *       undeclared-key guard, bin/mindrian-brain-mcp-client.cjs:118-145,
 *       untouched by this plan).
 *   (d) The production zod importer set (files under bin/, lib/, scripts/,
 *       hooks/ whose non-comment source requires zod, same scan rule as
 *       267-01's zod-importers-baseline.txt) is a subset of that baseline,
 *       except files under lib/mcp/ or bin/ (CTX zod boundary discipline:
 *       zod belongs only at the MCP input boundary; any NEW zod importer
 *       elsewhere is exactly the drift this check exists to catch).
 *
 * No em-dashes anywhere (hyphens only). CJS, Node built-ins only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const {
  hermeticEnv,
  wireSnapshot,
  compareToSnapshot,
  LOCAL_SERVER,
  BRAIN_SHIM,
} = require(path.join(REPO_ROOT, 'tests', 'helpers', 'mcp-wire-267.cjs'));

let passCount = 0;
let failCount = 0;

function pass(label, detail) {
  passCount += 1;
  console.log(`PASS: ${label}${detail ? ' -- ' + detail : ''}`);
}

function fail(label, detail) {
  failCount += 1;
  console.log(`FAIL: ${label}${detail ? ' -- ' + detail : ''}`);
}

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8'));
}

function tripletKey(d) {
  return `${d.kind}\u0000${d.name}\u0000${d.field}`;
}

// ---------------------------------------------------------------------------
// Same scan rule as 267-01's tests/fixtures/267/zod-importers-baseline.txt:
// every non-test production file under bin/, lib/, scripts/, hooks/ whose
// non-comment source contains require('zod / require("zod / requireWithHeal('zod
// (this includes the zod/v4 subpath).
// ---------------------------------------------------------------------------
function scanZodImporters() {
  const roots = ['bin', 'lib', 'scripts', 'hooks'];
  const found = [];
  const zodReqRe = /require\(\s*['"]zod|requireWithHeal\(\s*['"]zod/;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true });
    } catch (_e) {
      return;
    }
    for (const entry of entries) {
      const relPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(relPath);
        continue;
      }
      if (!entry.name.endsWith('.cjs') && !entry.name.endsWith('.js')) continue;
      if (entry.name.includes('.test.') || relPath.includes(`${path.sep}tests${path.sep}`)) continue;
      if (/test-\d/.test(entry.name)) continue;
      let src;
      try {
        src = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
      } catch (_e) {
        continue;
      }
      // Strip // and /* */ comments crudely before matching, mirroring the
      // 267-01 "non-comment source" rule closely enough for this gate's
      // purpose (a comment-only mention should not count as an importer).
      const stripped = src
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n');
      if (zodReqRe.test(stripped)) {
        found.push(relPath.split(path.sep).join('/'));
      }
    }
  }
  for (const r of roots) walk(r);
  return found.sort();
}

async function main() {
  const zod3Snapshot = readJson('tests/fixtures/267/wire-snapshot-zod3.json');
  const acceptedDeltas = readJson('tests/fixtures/267/zod4-accepted-deltas.json');

  const localEnv = hermeticEnv({});
  const brainEnv = hermeticEnv({});
  let liveLocal;
  let liveBrain;
  try {
    liveLocal = await wireSnapshot(LOCAL_SERVER, { env: localEnv.env, timeoutMs: 30000 });
    liveBrain = await wireSnapshot(BRAIN_SHIM, { env: brainEnv.env, timeoutMs: 30000 });
  } finally {
    localEnv.cleanup();
    brainEnv.cleanup();
  }

  // Unfiltered diff set (acceptedDeltas=[] so nothing is pre-excluded) --
  // every check below reasons over this same raw set.
  const rawDiffs = compareToSnapshot(liveLocal, zod3Snapshot.local, []).concat(
    compareToSnapshot(liveBrain, zod3Snapshot.brain, [])
  );

  // -------------------------------------------------------------------
  // Check (a): zero description diffs, tools or prompts, either zod state.
  // -------------------------------------------------------------------
  const descriptionDiffs = rawDiffs.filter((d) => d.field === 'description');
  if (descriptionDiffs.length > 0) {
    fail(
      'Check (a) (zero description diffs)',
      `${descriptionDiffs.length} description diff(s): ${descriptionDiffs.map((d) => `${d.kind}:${d.name}`).join(', ')}`
    );
  } else {
    pass('Check (a) (zero description diffs)', 'every tool and prompt description byte-identical to the zod 3 snapshot');
  }

  // -------------------------------------------------------------------
  // Check (b): installed zod major gates RED (3) vs pinned-delta GREEN (4).
  // -------------------------------------------------------------------
  const zodPkg = readJson('node_modules/zod/package.json');
  const zodMajor = parseInt(String(zodPkg.version).split('.')[0], 10);

  if (zodMajor === 3) {
    fail('Check (b) (accepted zod-4 delta present)', 'zod 3 installed: accepted zod-4 delta not yet present');
  } else if (zodMajor === 4) {
    const reservedKeys = new Set(
      []
        .concat(acceptedDeltas.app_views_schema_fix || [])
        .concat(acceptedDeltas.prompts_fix || [])
        .map(tripletKey)
    );
    const observedAfterReserved = rawDiffs.filter((d) => !reservedKeys.has(tripletKey(d)));
    const observedKeys = new Set(observedAfterReserved.map(tripletKey));

    const pinnedList = []
      .concat(acceptedDeltas.zod4_additionalProperties_dropped || [])
      .concat(acceptedDeltas.zod4_other || []);
    const pinnedKeys = new Set(pinnedList.map(tripletKey));

    const extras = [...observedKeys].filter((k) => !pinnedKeys.has(k));
    const missing = [...pinnedKeys].filter((k) => !observedKeys.has(k));

    if (extras.length > 0 || missing.length > 0) {
      fail(
        'Check (b) (observed zod-4 diff set equals pinned accepted set)',
        `extras=${JSON.stringify(extras.map((k) => k.split('\u0000').join(':')))} missing=${JSON.stringify(missing.map((k) => k.split('\u0000').join(':')))}`
      );
    } else {
      pass(
        'Check (b) (observed zod-4 diff set equals pinned accepted set)',
        `${pinnedKeys.size} pinned deltas reproduced exactly, zero extras`
      );
    }
  } else {
    fail('Check (b) (accepted zod-4 delta present)', `unexpected zod major ${zodMajor} (installed version ${zodPkg.version}), neither 3 nor 4`);
  }

  // -------------------------------------------------------------------
  // Check (c): all 6 brain-shim tools keep additionalProperties:false.
  // -------------------------------------------------------------------
  const brainTools = liveBrain.tools || [];
  const missingGuard = brainTools.filter((t) => !t.inputSchema || t.inputSchema.additionalProperties !== false);
  if (brainTools.length !== 6) {
    fail('Check (c) (6 brain tools advertise additionalProperties:false)', `expected 6 brain tools, found ${brainTools.length}: ${brainTools.map((t) => t.name).join(', ')}`);
  } else if (missingGuard.length > 0) {
    fail(
      'Check (c) (6 brain tools advertise additionalProperties:false)',
      `${missingGuard.length} tool(s) missing the guard: ${missingGuard.map((t) => t.name).join(', ')}`
    );
  } else {
    pass('Check (c) (6 brain tools advertise additionalProperties:false)', brainTools.map((t) => t.name).join(', '));
  }

  // -------------------------------------------------------------------
  // Check (d): zod importer set stays inside the CTX boundary.
  // -------------------------------------------------------------------
  const baselineSet = new Set(
    fs
      .readFileSync(path.join(REPO_ROOT, 'tests/fixtures/267/zod-importers-baseline.txt'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  );
  const currentImporters = scanZodImporters();
  const outOfBoundary = currentImporters.filter((f) => {
    if (f.startsWith('lib/mcp/') || f.startsWith('bin/')) return false;
    return !baselineSet.has(f);
  });
  if (outOfBoundary.length > 0) {
    fail(
      'Check (d) (zod importer set stays inside the CTX boundary)',
      `${outOfBoundary.length} new zod importer(s) outside lib/mcp/, bin/, and the baseline: ${outOfBoundary.join(', ')}`
    );
  } else {
    pass(
      'Check (d) (zod importer set stays inside the CTX boundary)',
      `${currentImporters.length} zod importers, all inside lib/mcp/, bin/, or the recorded baseline`
    );
  }

  console.log('');
  console.log(`RESULT: PASS=${passCount} FAIL=${failCount}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
