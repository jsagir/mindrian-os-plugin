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
const EXPECT_V2 = ['bin/mindrian-brain-mcp-client.cjs'];

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
// Phase 267 Plan 05 correction: this arm originally checked
// mod.SUPPORTED_PROTOCOL_VERSIONS for the literal '2026-07-28'. Measured
// against the REAL installed v2.1.0 package (the first time this repo ever
// installed it): SUPPORTED_PROTOCOL_VERSIONS is DELIBERATELY the legacy
// `initialize`-only list (five 2025-and-earlier revisions) and will never
// carry a modern-era string -- the SDK's own internal source comment names
// this "G-D2-4: no public modern-version constant ships before era-aware
// list semantics exist". There is no public export naming 2026-07-28 today.
// Rewritten to what the package genuinely proves: (a) serveStdio,
// createMcpHandler and isLegacyRequest are v2-only symbols with no v1
// analog -- their presence alone falsifies "this could still be v1"; (b) a
// grep-based marker check over the package's own compiled dist output,
// mirroring Arm A's falsification style, for the modern-era literal
// '2026-07-28' appearing in real (non-comment) code, not just in a doc
// comment. The full dual-era proof on the actual wire lives in
// tests/test-267-mcpv2-brain-shim.cjs (MCPV2-11) -- this arm only falsifies
// "the installed package cannot possibly be v2".
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

  const mainOnlySymbols = ['createMcpHandler', 'isLegacyRequest'];
  const missingSymbols = mainOnlySymbols.filter((s) => typeof mod[s] !== 'function');

  // serveStdio lives on the package's /stdio subpath export, not the main
  // entry point (verified live: require('@modelcontextprotocol/server')'s
  // own export list does not include it).
  let stdioMod;
  try {
    stdioMod = require('@modelcontextprotocol/server/stdio');
  } catch (e) {
    fail(label, `@modelcontextprotocol/server/stdio require() threw: ${e.message}`);
    return;
  }
  if (typeof stdioMod.serveStdio !== 'function') missingSymbols.push('stdio:serveStdio');

  if (missingSymbols.length > 0) {
    fail(label, `missing v2-only export(s), cannot be a genuine v2 install: ${missingSymbols.join(', ')}`);
    return;
  }

  const distDir = path.dirname(serverPkg);
  const distFiles = walkFiles(distDir, ['.cjs', '.js']);
  let foundModernLiteral = false;
  for (const file of distFiles) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (_e) {
      continue;
    }
    const active = nonCommentLines(content).join('\n');
    if (active.indexOf('2026-07-28') !== -1) {
      foundModernLiteral = true;
      break;
    }
  }
  if (!foundModernLiteral) {
    fail(label, `no compiled dist file under ${path.relative(REPO_ROOT, distDir)} contains the '2026-07-28' code literal`);
    return;
  }

  pass(label, `v2-only exports present (${mainOnlySymbols.concat('stdio:serveStdio').join(', ')}) and the modern-era literal is compiled into the package's own dist output`);
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
