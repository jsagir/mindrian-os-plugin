#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 01 (MCPV2-19) -- manifest/lockfile/shrinkwrap lockstep and
 * single-instance checks.
 * ==========================================================================
 * Every dependency plan in this phase runs this test after touching
 * package.json, package-lock.json, or npm-shrinkwrap.json. It has nothing to
 * do with the SDK era; it exists so a v2 package landing in one manifest but
 * not another is caught immediately, not discovered at release time
 * (RULE 8 / Phase 341's npm-shrinkwrap.json supersession of vendored
 * node_modules).
 *
 * Checks:
 *   1. package.json `dependencies` deep-equals npm-shrinkwrap.json and
 *      package-lock.json's `packages[""].dependencies`.
 *   2. The two lockfiles' `packages` maps deep-equal after deleting the root
 *      entry's `version` field and the top-level `version` field (today they
 *      differ only there -- a real root-version bump is a release-process
 *      concern, not this test's).
 *   3. npm-shrinkwrap.json has zero entries with `dev: true`.
 *   4. If any node_modules/**\/@modelcontextprotocol/core/package.json
 *      exists, exactly one distinct version is installed (a second core
 *      instance would reintroduce a class-identity crossing).
 *   5. Exactly one distinct installed `zod` version across node_modules.
 *   6. Every `@modelcontextprotocol/*` name in package.json dependencies has
 *      a `disposition: "VETTED"` entry in
 *      references/security/cve-db.json surfaces.supply_chain.allowlist.
 *
 * No em-dashes anywhere (hyphens only). CJS, Node built-ins only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

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

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i += 1) {
    if (aKeys[i] !== bKeys[i]) return false;
  }
  return aKeys.every((k) => deepEqual(a[k], b[k]));
}

function findInstalledVersions(pkgName) {
  const versions = new Set();
  const nmRoot = path.join(REPO_ROOT, 'node_modules');

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === pkgName || (pkgName.startsWith('@') && entry.name === pkgName.split('/')[1] && path.basename(dir) === pkgName.split('/')[0])) {
        const pkgJsonPath = path.join(full, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          try {
            const pj = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            if (pj.name === pkgName && pj.version) versions.add(pj.version);
          } catch (_e) {
            /* skip unreadable package.json */
          }
        }
      }
      // Descend into node_modules and scoped dirs to find nested/hoisted copies.
      if (entry.name === 'node_modules' || entry.name.startsWith('@') || entry.name === pkgName.split('/').pop()) {
        walk(full);
      }
    }
  }
  walk(nmRoot);
  return [...versions];
}

// -----------------------------------------------------------------------
// Check 1: package.json dependencies == both lockfiles' root dependencies
// -----------------------------------------------------------------------
function check1() {
  const label = 'Check 1 (manifest deps == lockfile root deps)';
  const pkg = readJson('package.json');
  const shrink = readJson('npm-shrinkwrap.json');
  const lock = readJson('package-lock.json');

  const pkgDeps = pkg.dependencies || {};
  const shrinkDeps = (shrink.packages && shrink.packages[''] && shrink.packages[''].dependencies) || {};
  const lockDeps = (lock.packages && lock.packages[''] && lock.packages[''].dependencies) || {};

  if (!deepEqual(pkgDeps, shrinkDeps)) {
    fail(label, `package.json vs npm-shrinkwrap.json dependencies differ: ${JSON.stringify(pkgDeps)} vs ${JSON.stringify(shrinkDeps)}`);
    return;
  }
  if (!deepEqual(pkgDeps, lockDeps)) {
    fail(label, `package.json vs package-lock.json dependencies differ: ${JSON.stringify(pkgDeps)} vs ${JSON.stringify(lockDeps)}`);
    return;
  }
  pass(label, `${Object.keys(pkgDeps).length} dependencies agree across all three files`);
}

// -----------------------------------------------------------------------
// Check 2: the two lockfiles' packages maps agree (root version excluded)
// -----------------------------------------------------------------------
function check2() {
  const label = 'Check 2 (lockfiles packages maps agree, root version excluded)';
  const shrink = readJson('npm-shrinkwrap.json');
  const lock = readJson('package-lock.json');

  const shrinkPackages = JSON.parse(JSON.stringify(shrink.packages || {}));
  const lockPackages = JSON.parse(JSON.stringify(lock.packages || {}));
  if (shrinkPackages['']) delete shrinkPackages[''].version;
  if (lockPackages['']) delete lockPackages[''].version;

  if (!deepEqual(shrinkPackages, lockPackages)) {
    fail(label, 'packages maps differ beyond the root version field');
    return;
  }
  pass(label, 'packages maps identical (root version field excluded by design)');
}

// -----------------------------------------------------------------------
// Check 3: npm-shrinkwrap.json has zero dev:true entries
// -----------------------------------------------------------------------
function check3() {
  const label = 'Check 3 (npm-shrinkwrap.json zero dev entries)';
  const shrink = readJson('npm-shrinkwrap.json');
  const devEntries = Object.entries(shrink.packages || {}).filter(([, v]) => v && v.dev === true);
  if (devEntries.length > 0) {
    fail(label, `${devEntries.length} dev:true entries: ${devEntries.slice(0, 5).map(([k]) => k).join(', ')}`);
    return;
  }
  pass(label, 'zero dev:true entries');
}

// -----------------------------------------------------------------------
// Check 4: single installed @modelcontextprotocol/core version (if present)
// -----------------------------------------------------------------------
function check4() {
  const label = 'Check 4 (single @modelcontextprotocol/core instance)';
  const versions = findInstalledVersions('@modelcontextprotocol/core');
  if (versions.length === 0) {
    pass(label, 'no @modelcontextprotocol/core installed (v1-only tree today)');
    return;
  }
  if (versions.length > 1) {
    fail(label, `multiple @modelcontextprotocol/core versions installed: ${versions.join(', ')}`);
    return;
  }
  pass(label, `exactly one @modelcontextprotocol/core version installed: ${versions[0]}`);
}

// -----------------------------------------------------------------------
// Check 5: single installed zod version
// -----------------------------------------------------------------------
function check5() {
  const label = 'Check 5 (single zod instance)';
  const versions = findInstalledVersions('zod');
  if (versions.length === 0) {
    fail(label, 'zod not found anywhere under node_modules');
    return;
  }
  if (versions.length > 1) {
    fail(label, `multiple zod versions installed: ${versions.join(', ')}`);
    return;
  }
  pass(label, `exactly one zod version installed: ${versions[0]}`);
}

// -----------------------------------------------------------------------
// Check 6: every @modelcontextprotocol/* dependency is VETTED
// -----------------------------------------------------------------------
function check6() {
  const label = 'Check 6 (supply-chain allowlist covers every @modelcontextprotocol/* dependency)';
  const pkg = readJson('package.json');
  const cveDb = readJson('references/security/cve-db.json');
  const allowlist = (cveDb.surfaces && cveDb.surfaces.supply_chain && cveDb.surfaces.supply_chain.allowlist) || [];
  const allowMap = new Map(allowlist.map((e) => [e.name, e]));

  const mcpDeps = Object.keys(pkg.dependencies || {}).filter((k) => k.startsWith('@modelcontextprotocol/'));
  const missing = [];
  const notVetted = [];
  for (const dep of mcpDeps) {
    const entry = allowMap.get(dep);
    if (!entry) {
      missing.push(dep);
    } else if (entry.disposition !== 'VETTED') {
      notVetted.push(dep);
    }
  }
  if (missing.length > 0 || notVetted.length > 0) {
    fail(label, `missing=${JSON.stringify(missing)} notVetted=${JSON.stringify(notVetted)}`);
    return;
  }
  pass(label, `${mcpDeps.length} @modelcontextprotocol/* dependencies all VETTED: ${mcpDeps.join(', ')}`);
}

check1();
check2();
check3();
check4();
check5();
check6();

console.log('');
console.log(`RESULT: PASS=${passCount} FAIL=${failCount}`);
process.exit(failCount > 0 ? 1 : 0);
