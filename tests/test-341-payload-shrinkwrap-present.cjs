#!/usr/bin/env node
'use strict';

/*
 * Phase 341, D-04 -- the shrinkwrap-in-payload tripwire.
 *
 * WHAT: the published npm tarball MUST carry npm-shrinkwrap.json at its root.
 *
 * WHY (measured on npm 10.9.8, 341-RESEARCH.md "F-6. npm packaging behavior"):
 * with a `files` allowlist present, npm treats npm-shrinkwrap.json as an
 * ordinary file and DROPS it from the pack payload unless it is named
 * explicitly. The Claude Code loader then finds a package.json with no
 * supported lockfile at the plugin root and, per its own documentation
 * (341-FINDINGS.md, verbatim): "A plugin with a package.json and no lockfile
 * is skipped without a log entry." Both alwaysLoad MCP servers then fail on
 * require, with nothing in any log to explain why.
 *
 * TDD posture: this file lands RED on today's package.json (files has no
 * npm-shrinkwrap.json entry) and can only be made green by plan 341-04's
 * real packaging cut.
 *
 * Canon Part 8 (Graph Boundary): local filesystem reads plus one local npm
 * spawn (npm pack --dry-run --json), zero network, zero registry call.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const { resolveNpmCli } = require(path.join(REPO_ROOT, 'lib', 'core', 'npm-cli-resolve.cjs'));

let PASS = 0;
let FAIL = 0;

function ok(label) {
  console.log('ok   ' + label);
  PASS += 1;
}

function fail(label, detail) {
  console.log('FAIL ' + label + (detail ? ' -- ' + detail : ''));
  FAIL += 1;
}

// npm pack --dry-run --json is offline by construction: it reads only the
// working tree and makes no registry call.
function packPayload() {
  const descriptor = resolveNpmCli();
  const argv = descriptor.baseArgs.concat(['pack', '--dry-run', '--json']);
  const r = spawnSync(descriptor.command, argv, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120000,
    shell: descriptor.shell,
  });
  if (r.status !== 0) {
    throw new Error('npm pack --dry-run --json exited ' + r.status + ': ' + String(r.stderr || '').slice(0, 500));
  }
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch (e) {
    throw new Error('npm pack --dry-run --json produced unparseable JSON: ' + (e && e.message));
  }
  assert.ok(Array.isArray(parsed) && parsed.length > 0, 'npm pack --dry-run --json must return a non-empty array');
  const p = parsed[0];
  assert.ok(Array.isArray(p.files), 'npm pack payload must carry a files array');
  return p;
}

let payload;
try {
  payload = packPayload();
} catch (e) {
  fail('arm 0: npm pack --dry-run --json produced a usable payload', e && e.message);
  console.log('PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(1);
}

// ARM 1 -- the payload contains the lockfile.
try {
  const hasShrinkwrap = payload.files.some(function (f) { return f.path === 'npm-shrinkwrap.json'; });
  assert.ok(
    hasShrinkwrap,
    'npm-shrinkwrap.json missing from pack payload; add "npm-shrinkwrap.json" to package.json "files"'
  );
  ok('arm 1: npm-shrinkwrap.json present in pack payload');
} catch (e) {
  fail('arm 1: npm-shrinkwrap.json present in pack payload', e && e.message);
}

// ARM 2 -- the manifest sits at the package root.
try {
  const hasManifest = payload.files.some(function (f) { return f.path === '.claude-plugin/plugin.json'; });
  assert.ok(
    hasManifest,
    '.claude-plugin/plugin.json missing from pack payload; a missing manifest does not hard-fail -- the loader ' +
      'SILENTLY synthesizes a manifest whose name is the internal staging label, so the plugin loads under the ' +
      'wrong name'
  );
  ok('arm 2: .claude-plugin/plugin.json present at package root');
} catch (e) {
  fail('arm 2: .claude-plugin/plugin.json present at package root', e && e.message);
}

// ARM 3 -- the entry and byte ceilings. 20000 entries / 268435456 bytes (256
// MiB) are the platform's documented plugin ceiling and this repo's own
// policy limits, because Claude Code 2.1.266 reaches that check ONLY from
// the `command` source type, never from the `npm` path (341-RESEARCH.md F-4).
try {
  assert.ok(payload.entryCount <= 20000, 'entryCount ' + payload.entryCount + ' exceeds the 20000-entry ceiling');
  assert.ok(
    payload.unpackedSize <= 268435456,
    'unpackedSize ' + payload.unpackedSize + ' exceeds the 268435456-byte (256 MiB) ceiling'
  );
  ok('arm 3: entryCount <= 20000 and unpackedSize <= 268435456');
} catch (e) {
  fail('arm 3: entryCount <= 20000 and unpackedSize <= 268435456', e && e.message);
}

// ARM 4 -- forbidden paths. scripts/release.sh is named explicitly: its own
// Step 9.5 payload gate greps its own pack output for the unanchored pattern
// release.sh and exit 1s on a match, so a tarball containing it CANNOT be
// published by the current release script.
try {
  const forbiddenPrefixes = [
    'docs/', '.planning/', 'mcp-server-brain/', 'tests/', 'lib/wiki/editor-src/', 'dist/', 'cypher/', '.env',
  ];
  const offenders = payload.files.filter(function (f) {
    if (f.path === 'scripts/release.sh') return true;
    return forbiddenPrefixes.some(function (prefix) { return f.path.startsWith(prefix); });
  });
  assert.strictEqual(
    offenders.length,
    0,
    'forbidden path(s) in pack payload: ' + offenders.map(function (f) { return f.path; }).join(', ') +
      ' (scripts/release.sh especially: its Step 9.5 payload gate greps its own pack output for the unanchored ' +
      'pattern release.sh and exit 1s, so a tarball containing it CANNOT be published by the current release script)'
  );
  ok(
    'arm 4: no forbidden path in pack payload ' +
      '(scripts/release.sh, docs/, .planning/, mcp-server-brain/, tests/, lib/wiki/editor-src/, dist/, cypher/, .env)'
  );
} catch (e) {
  fail('arm 4: no forbidden path in pack payload', e && e.message);
}

console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL > 0 ? 1 : 0);
