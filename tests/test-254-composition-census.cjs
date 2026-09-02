#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 254 Plan 04 Task 1 -- COMP-01 census RED suite.
 *
 * Ground truth is SOURCE, not the wire (contrast lib/mcp/no-instructions.
 * test.cjs, which spawns a real server because ITS ground truth is the
 * wire). This suite walks lib/mcp/ recursively, comment-strips every *.cjs
 * file with the codeOf() helper reused verbatim from
 * tests/test-reader-r4-structural-184.cjs (lines 24-45), and looks for an
 * executable REQUIRE EXPRESSION of brain-client.cjs or chain-recommender.cjs
 * -- never a bare substring. Scanning for the expression rather than the
 * substring is load-bearing: it means lib/mcp/brain-composition-census.cjs
 * can hold plain quoted path strings as DATA (the `file:` values on each
 * declared entry) without ever matching its own scan, so no self-exclusion
 * hack is needed anywhere in this file or that one.
 *
 * Arms (8, plus a RED-first module-load guard):
 *   0. census module loads -- guarded require(), reports a failing
 *      "census module loads" arm instead of an uncaught MODULE_NOT_FOUND
 *      stack when the declaration module does not exist yet (Plans 01/03
 *      RED-first discipline).
 *   1. declared covers discovered -- every file the scanner finds with a
 *      reach token appears as the `file` of at least one COMPOSITION_SITES
 *      entry. Failure names the specific offending path(s).
 *   2. discovered covers declared -- every entry's `file` exists on disk;
 *      every entry with `reaches_brain: true` is also a file the scanner
 *      independently found a reach token in (a reaching claim for a file
 *      that no longer reaches is a stale entry -- Plan 03's
 *      dangling_declaration discipline, applied here to reach claims rather
 *      than to non-reaching provenance-only entries like the disclosure leg
 *      or the indirect dispatch, which legitimately have no reach token of
 *      their own to be found by).
 *   3. no own wire -- zero lib/mcp/ files contain, on a comment-stripped
 *      line, fetch(, require('node:http, require('node:https, require
 *      ('http'), or require('https'). Every Brain-reaching path under
 *      lib/mcp/ must transit lib/core/brain-client.cjs::callTool.
 *   4. bound stated -- every entry with reaches_brain === true carries a
 *      numeric bound_ms > 0.
 *   5. belt named -- every entry with reaches_brain === true carries
 *      belt: 'callTool'.
 *   6. reason required -- validateSites() throws on an empty reason and
 *      accepts the live declaration.
 *   7. provenance discoverable -- each of lib/mcp/brain-router.cjs,
 *      lib/mcp/tools/sensors.cjs and lib/mcp/tool-router.cjs contains the
 *      string 'brain-composition-census' somewhere in the file (Task 3's
 *      output; expected RED until Task 3 lands).
 *   8. identity, not count -- the declaration module's own comment-stripped
 *      source contains no numeric site-count comparison other than against
 *      0 (Pitfall 8's discipline: a frozen literal count would have to be
 *      edited every time a site is legitimately added).
 *
 * CRITICAL, a real trap named by the plan: this file must never write the
 * literal `isAvailable(` or `ensureAvailable(` on an executable line --
 * tests/test-252-guard-census.cjs's census.1 fails the build for any
 * UNCLASSIFIED file carrying one, and this file is not in that frozen
 * classification. Nothing in this suite needs either token, so none appear.
 *
 * Zero Brain, zero network, zero server spawn. node:assert + node:fs +
 * node:path + the declaration module only. Hyphens only, no em-dashes.
 *
 * Run: node tests/test-254-composition-census.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CENSUS_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'brain-composition-census.cjs');
const MCP_DIR = path.join(REPO_ROOT, 'lib', 'mcp');

let mod = null;
let loadError = null;
try {
  mod = require('../lib/mcp/brain-composition-census.cjs');
} catch (e) {
  loadError = e;
}

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    process.stdout.write('  ok    ' + name + '\n');
    pass += 1;
  } catch (e) {
    process.stdout.write('  FAIL  ' + name + ' -- ' + (e && e.message ? e.message : String(e)) + '\n');
    fail += 1;
  }
}

// codeOf: comment-stripping helper, reused verbatim from
// tests/test-reader-r4-structural-184.cjs lines 24-45 (full-line-comment
// strip -- adequate here because every scan below looks for a full require(
// ... ) expression or a full-line-only token, never a mid-line pattern that
// a partial strip could misfire on).
function codeOf(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');
}

function walkCjs(dir) {
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkCjs(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.cjs')) out.push(full);
  }
  return out;
}

const ALL_MCP_FILES = walkCjs(MCP_DIR);

// The REQUIRE EXPRESSION, not a bare substring -- see header note.
const REACH_RE = /require\(\s*['"][^'"]*(?:brain-client|chain-recommender)\.cjs['"]\s*\)/;

function reachDiscoveredFiles() {
  const found = new Set();
  for (const f of ALL_MCP_FILES) {
    const code = codeOf(f);
    if (REACH_RE.test(code)) {
      found.add(path.relative(REPO_ROOT, f).split(path.sep).join('/'));
    }
  }
  return found;
}

test('census module loads', function () {
  if (loadError) throw loadError;
  assert.ok(mod, 'module exports something');
  assert.ok(Array.isArray(mod.COMPOSITION_SITES), 'COMPOSITION_SITES is an array');
  assert.strictEqual(typeof mod.validateSites, 'function', 'validateSites is exported as a function');
});

test('Arm 1: declared covers discovered', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const discovered = reachDiscoveredFiles();
  const declaredFiles = new Set(mod.COMPOSITION_SITES.map(function (e) { return e.file; }));
  const missing = [];
  for (const f of discovered) {
    if (!declaredFiles.has(f)) missing.push(f);
  }
  assert.strictEqual(missing.length, 0, 'undeclared reach site(s): ' + JSON.stringify(missing));
});

test('Arm 2: discovered covers declared (no stale entries)', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const discovered = reachDiscoveredFiles();
  const missingFromDisk = [];
  const staleReachClaim = [];
  for (const entry of mod.COMPOSITION_SITES) {
    const full = path.join(REPO_ROOT, entry.file);
    if (!fs.existsSync(full)) {
      missingFromDisk.push(entry.file);
      continue;
    }
    if (entry.reaches_brain === true && !discovered.has(entry.file)) {
      staleReachClaim.push(entry.file + ' :: ' + (entry.handler || '?'));
    }
  }
  assert.strictEqual(missingFromDisk.length, 0, 'declared file(s) missing from disk: ' + JSON.stringify(missingFromDisk));
  assert.strictEqual(staleReachClaim.length, 0, 'declared reaches_brain:true site(s) no longer contain a reach require: ' + JSON.stringify(staleReachClaim));
});

test('Arm 3: no lib/mcp/ file opens its own wire', function () {
  const WIRE_PATTERNS = [
    /\bfetch\(/,
    /require\(\s*['"]node:https?/,
    /require\(\s*['"]http['"]\s*\)/,
    /require\(\s*['"]https['"]\s*\)/,
  ];
  const offenders = [];
  for (const f of ALL_MCP_FILES) {
    const code = codeOf(f);
    if (WIRE_PATTERNS.some(function (re) { return re.test(code); })) {
      offenders.push(path.relative(REPO_ROOT, f).split(path.sep).join('/'));
    }
  }
  assert.strictEqual(offenders.length, 0, 'file(s) under lib/mcp/ open a wire outside brain-client.cjs::callTool: ' + JSON.stringify(offenders));
});

test('Arm 4: every reaching entry states a numeric bound_ms > 0', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const bad = mod.COMPOSITION_SITES
    .filter(function (e) { return e.reaches_brain === true && !(typeof e.bound_ms === 'number' && e.bound_ms > 0); })
    .map(function (e) { return e.file + ' :: ' + (e.handler || '?'); });
  assert.strictEqual(bad.length, 0, 'reaching entry missing a numeric bound_ms > 0: ' + JSON.stringify(bad));
});

test('Arm 5: every reaching entry names belt: callTool', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const bad = mod.COMPOSITION_SITES
    .filter(function (e) { return e.reaches_brain === true && e.belt !== 'callTool'; })
    .map(function (e) { return e.file + ' :: ' + (e.handler || '?'); });
  assert.strictEqual(bad.length, 0, "reaching entry missing belt: 'callTool': " + JSON.stringify(bad));
});

test('Arm 6: validateSites enforces a non-empty reason', function () {
  if (!mod) throw new Error('module not loaded, arm skipped');
  const template = mod.COMPOSITION_SITES.find(function (e) { return e.reaches_brain === true; });
  assert.ok(template, 'sanity: at least one reaching entry exists to clone');
  assert.throws(function () {
    mod.validateSites([Object.assign({}, template, { reason: '' })]);
  }, 'validateSites must throw on an empty reason');
  assert.doesNotThrow(function () {
    mod.validateSites(mod.COMPOSITION_SITES);
  }, 'validateSites must accept the live declaration');
});

test('Arm 7: each call site carries the brain-composition-census provenance string', function () {
  const files = [
    path.join(REPO_ROOT, 'lib', 'mcp', 'brain-router.cjs'),
    path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'),
    path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs'),
  ];
  const missing = [];
  for (const f of files) {
    if (!fs.existsSync(f)) { missing.push(path.relative(REPO_ROOT, f)); continue; }
    const raw = fs.readFileSync(f, 'utf8');
    if (raw.indexOf('brain-composition-census') === -1) missing.push(path.relative(REPO_ROOT, f));
  }
  assert.strictEqual(missing.length, 0, "file(s) missing the 'brain-composition-census' provenance string: " + JSON.stringify(missing));
});

test('Arm 8: the declaration module never hardcodes a site count (identity, not count)', function () {
  if (loadError) throw new Error('module not loaded, arm skipped');
  const src = fs.readFileSync(CENSUS_PATH, 'utf8');
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  const matches = stripped.match(/\.length\s*[=!<>]==?\s*\d+/g) || [];
  const nonZero = matches.filter(function (m) { return !/\.length\s*[=!<>]==?\s*0\b/.test(m); });
  assert.strictEqual(nonZero.length, 0, 'declaration module contains a numeric site-count comparison: ' + JSON.stringify(nonZero));
});

process.stdout.write('\ntest-254-composition-census.cjs: ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail === 0 ? 0 : 1);
