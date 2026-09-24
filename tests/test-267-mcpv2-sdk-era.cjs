#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 01 (MCPV2-01) -- the SDK-era falsification test.
 * ==========================================================================
 * A bumped SDK version number is never counted as 2026-07-28 adoption
 * (Pitfall 1). This test decides adoption by which package each entry point
 * REQUIRES, not by a version literal.
 *
 * Four arms, each independently gated so the file stays meaningful across
 * every wave of the migration:
 *   Arm A - falsification: if the v1 SDK is installed, prove its own
 *           dist/cjs/types.js does NOT implement 2026-07-28 (ten marker
 *           grep, all must be zero). Trap: `input_required` is a v1 Tasks
 *           status enum value, not one of the ten markers -- do not add it.
 *   Arm B - if the v2 `@modelcontextprotocol/server` package resolves,
 *           assert its SUPPORTED_PROTOCOL_VERSIONS includes both eras.
 *   Arm C - migration ledger: EXPECT_V2 starts EMPTY in this plan; each
 *           migrating plan appends the file paths it moved to v2.
 *   Arm D - v1-removed sweep: only runs once package.json no longer
 *           declares @modelcontextprotocol/sdk as a dependency (267-17).
 *
 * Exit 1 on any FAIL. Exit 77 only if every arm SKIPs (no v1, no v2, empty
 * ledger, sdk still a dependency -- an environment with nothing to check).
 *
 * No em-dashes anywhere (hyphens only). CJS, Node built-ins only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Arm C migration ledger. Empty in 267-01 (locked_stage W0: "this plan
// changes no production file"). Each later migrating plan appends its own
// entry paths here (absolute-from-repo-root, forward slashes).
// ---------------------------------------------------------------------------
const EXPECT_V2 = [];

let passCount = 0;
let failCount = 0;
let skipCount = 0;

function pass(label, detail) {
  passCount += 1;
  console.log(`PASS: ${label}${detail ? ' -- ' + detail : ''}`);
}

function fail(label, detail) {
  failCount += 1;
  console.log(`FAIL: ${label}${detail ? ' -- ' + detail : ''}`);
}

function skip(label, detail) {
  skipCount += 1;
  console.log(`SKIP: ${label}${detail ? ' -- ' + detail : ''}`);
}

function walkFiles(startDir, exts) {
  const out = [];
  function recur(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(REPO_ROOT, full);
      if (entry.name === 'node_modules') continue;
      if (rel === 'mcp-server-brain' || rel.startsWith('mcp-server-brain' + path.sep)) continue;
      if (entry.isDirectory()) {
        recur(full);
      } else if (exts.some((ext) => entry.name.endsWith(ext))) {
        out.push(full);
      }
    }
  }
  recur(startDir);
  return out;
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*');
}

function nonCommentLines(source) {
  return source.split('\n').filter((line) => !isCommentLine(line));
}

// =============================================================================
// Arm A: v1 falsification
// =============================================================================
function armA() {
  const label = 'Arm A (v1 falsification)';
  const typesPath = path.join(REPO_ROOT, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs', 'types.js');
  if (!fs.existsSync(typesPath)) {
    skip(label, 'v1 SDK not installed under node_modules');
    return;
  }

  const source = fs.readFileSync(typesPath, 'utf8');
  const versionMatch = source.match(/LATEST_PROTOCOL_VERSION\s*=\s*'([^']+)'/);
  const latestVersion = versionMatch ? versionMatch[1] : null;

  if (latestVersion === '2026-07-28') {
    fail(label, `dist/cjs/types.js LATEST_PROTOCOL_VERSION is '2026-07-28' -- v1 now implements the modern era`);
    return;
  }

  const markers = [
    'server/discover',
    'inputResponses',
    'inputRequests',
    'requestState',
    'Mcp-Method',
    'Mcp-Name',
    'ttlMs',
    'cacheScope',
    'resultType',
    '2026-07-28',
  ];
  const distDir = path.join(REPO_ROOT, 'node_modules', '@modelcontextprotocol', 'sdk', 'dist', 'cjs');
  const jsFiles = walkFiles(distDir, ['.js']);
  const nonZero = [];
  for (const marker of markers) {
    let count = 0;
    for (const file of jsFiles) {
      let content;
      try {
        content = fs.readFileSync(file, 'utf8');
      } catch (_e) {
        continue;
      }
      if (content.indexOf(marker) !== -1) count += 1;
    }
    if (count !== 0) nonZero.push(`${marker}=${count}`);
  }

  if (nonZero.length > 0) {
    fail(label, `non-zero marker counts: ${nonZero.join(', ')}`);
    return;
  }

  pass(
    label,
    `v1 installed (LATEST_PROTOCOL_VERSION='${latestVersion}'): does NOT implement 2026-07-28 (a version bump is not adoption)`
  );
}

// =============================================================================
// Arm B: v2 support check
// =============================================================================
function armB() {
  const label = 'Arm B (v2 era support)';
  let serverPkg;
  try {
    serverPkg = require.resolve('@modelcontextprotocol/server');
  } catch (_e) {
    skip(label, '@modelcontextprotocol/server does not resolve');
    return;
  }

  let mod;
  try {
    mod = require(serverPkg);
  } catch (e) {
    fail(label, `resolved but require() threw: ${e.message}`);
    return;
  }

  const supported = mod.SUPPORTED_PROTOCOL_VERSIONS;
  if (!Array.isArray(supported)) {
    fail(label, 'SUPPORTED_PROTOCOL_VERSIONS is not exported as an array');
    return;
  }
  const hasModern = supported.includes('2026-07-28');
  const hasLegacy = supported.includes('2025-11-25');
  if (!hasModern || !hasLegacy) {
    fail(label, `SUPPORTED_PROTOCOL_VERSIONS=${JSON.stringify(supported)} missing an expected era`);
    return;
  }
  pass(label, `SUPPORTED_PROTOCOL_VERSIONS includes both 2026-07-28 and 2025-11-25`);
}

// =============================================================================
// Arm C: migration ledger
// =============================================================================
function armC() {
  const label = 'Arm C (migration ledger)';
  if (EXPECT_V2.length === 0) {
    skip(label, 'EXPECT_V2 is empty (no file migrated to v2 yet)');
    return;
  }

  const v2Packages = ['@modelcontextprotocol/server', '@modelcontextprotocol/client', '@modelcontextprotocol/node'];
  let allOk = true;
  for (const relPath of EXPECT_V2) {
    const fullPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(fullPath)) {
      fail(label, `${relPath}: file does not exist`);
      allOk = false;
      continue;
    }
    const source = fs.readFileSync(fullPath, 'utf8');
    const activeLines = nonCommentLines(source);
    const requireLinePattern = /(?:require|requireWithHeal)\(/;

    const referencesV2 = activeLines.some(
      (line) => requireLinePattern.test(line) && v2Packages.some((pkg) => line.includes(pkg))
    );
    const referencesV1 = activeLines.some(
      (line) => requireLinePattern.test(line) && line.includes('@modelcontextprotocol/sdk')
    );

    if (!referencesV2) {
      fail(label, `${relPath}: no require(/requireWithHeal( references a v2 package`);
      allOk = false;
    }
    if (referencesV1) {
      fail(label, `${relPath}: still references @modelcontextprotocol/sdk in a require(/requireWithHeal( call`);
      allOk = false;
    }
    if (referencesV2 && !referencesV1) {
      pass(label, `${relPath}: v2-only`);
    }
  }
  if (!allOk) return;
}

// =============================================================================
// Arm D: v1-removed sweep
// =============================================================================
function armD() {
  const label = 'Arm D (v1 removed)';
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  } catch (e) {
    fail(label, `could not read package.json: ${e.message}`);
    return;
  }
  const deps = pkg.dependencies || {};
  if (Object.prototype.hasOwnProperty.call(deps, '@modelcontextprotocol/sdk')) {
    skip(label, 'package.json still declares @modelcontextprotocol/sdk as a dependency');
    return;
  }

  const dirs = ['bin', 'lib', 'scripts', 'tests'].map((d) => path.join(REPO_ROOT, d));
  const files = dirs.flatMap((d) => walkFiles(d, ['.cjs', '.js']));
  const hits = [];
  for (const file of files) {
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch (_e) {
      continue;
    }
    const activeLines = nonCommentLines(source);
    activeLines.forEach((line, idx) => {
      if (
        line.includes("require('@modelcontextprotocol/sdk") ||
        line.includes('requireWithHeal(\'@modelcontextprotocol/sdk') ||
        line.includes('require("@modelcontextprotocol/sdk') ||
        line.includes('requireWithHeal("@modelcontextprotocol/sdk')
      ) {
        hits.push(`${path.relative(REPO_ROOT, file)}:${idx + 1}`);
      }
    });
  }

  if (hits.length > 0) {
    fail(label, `v1 SDK still required at: ${hits.join(', ')}`);
    return;
  }
  pass(label, 'zero remaining @modelcontextprotocol/sdk require()/requireWithHeal() references');
}

armA();
armB();
armC();
armD();

console.log('');
console.log(`RESULT: PASS=${passCount} FAIL=${failCount} SKIP=${skipCount}`);

if (failCount > 0) {
  process.exit(1);
}
if (passCount === 0 && skipCount > 0) {
  process.exit(77);
}
process.exit(0);
