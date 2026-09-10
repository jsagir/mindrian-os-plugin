#!/usr/bin/env node
'use strict';

/*
 * scripts/check-release-payload-ceiling.cjs -- Phase 341 Plan 04 (D-08).
 *
 * WHAT: asserts the published npm tarball (measured via `npm pack --dry-run
 * --json`, offline by construction -- it reads only the working tree and
 * makes no registry call) stays under the entry-count and unpacked-byte
 * ceilings the Claude Code plugin loader documents (20,000 entries, 256 MiB),
 * carries the two artifacts a slim install cannot function without
 * (npm-shrinkwrap.json, .claude-plugin/plugin.json), never carries a path
 * this repo's own release ceremony would refuse to publish, and carries zero
 * install-time lifecycle scripts across its dependency set.
 *
 * WHY: the platform does NOT enforce the 256 MiB / 20,000-entry ceiling on
 * the npm source path. In Claude Code 2.1.266 that check lives in one
 * function reachable only from the `command` source type -- an npm-source
 * plugin never reaches it. This policy is the ONLY enforcement that will
 * ever exist for this artifact.
 *
 * Canon Part 8 (Graph Boundary): local filesystem plus one local npm spawn,
 * zero network, zero Brain reach. `npm pack --dry-run --json` makes no
 * registry call (npm's own documented behavior for --dry-run).
 *
 * Test seam: CHECK_PAYLOAD_CEILING_ROOT overrides the root directory
 * measured, so a spawn-level test can point --check at a synthetic
 * violating tree without touching this repo's own tarball.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv
 * routing.
 */

const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { resolveNpmCli } = require('../lib/core/npm-cli-resolve.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

// MAX_ENTRIES / MAX_UNPACKED: the Claude Code plugin loader's own documented
// ceiling (256 MiB unpacked, 20,000 entries), adopted here as this repo's own
// policy limits -- see the header comment above for why enforcement must
// live here rather than in the platform.
const MAX_ENTRIES = 20000;
const MAX_UNPACKED = 268435456; // 256 MiB

const FORBIDDEN_PREFIXES = [
  'docs/',
  '.planning/',
  'tests/',
  'mcp-server-brain/',
  'cypher/',
  'dist/',
  'lib/wiki/editor-src/',
];

function usage() {
  return 'usage: node scripts/check-release-payload-ceiling.cjs --check';
}

/**
 * measurePayload(rootDir) -> the parsed `npm pack --dry-run --json` first
 * element. Spawns via resolveNpmCli() with an argv array, cwd: rootDir,
 * encoding utf8, a 120000ms timeout, and input:'' so a runner that reads
 * stdin synchronously never hangs. Parses defensively: a malformed spawn or
 * parse is a FAILURE, never a pass.
 */
function measurePayload(rootDir) {
  const descriptor = resolveNpmCli();
  const argv = descriptor.baseArgs.concat(['pack', '--dry-run', '--json']);
  const result = spawnSync(descriptor.command, argv, {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: 120000,
    input: '',
    shell: !!descriptor.shell,
  });

  if (result.error) {
    return { ok: false, reason: 'npm pack spawn failed: ' + result.error.message };
  }
  if (result.status !== 0) {
    const stderrText = (result.stderr || '').trim();
    return { ok: false, reason: 'npm pack exited ' + result.status + (stderrText ? ': ' + stderrText.slice(0, 500) : '') };
  }
  const stdoutText = result.stdout;
  if (!stdoutText || !stdoutText.trim()) {
    return { ok: false, reason: 'npm pack produced no stdout' };
  }

  let parsed;
  try {
    parsed = JSON.parse(stdoutText);
  } catch (e) {
    return { ok: false, reason: 'npm pack --dry-run --json output did not parse as JSON: ' + e.message };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false, reason: 'npm pack --dry-run --json output is not a non-empty array' };
  }

  const entry = parsed[0];
  if (!entry || typeof entry !== 'object') {
    return { ok: false, reason: 'npm pack --dry-run --json first element is not an object' };
  }
  if (!Array.isArray(entry.files)) {
    return { ok: false, reason: 'npm pack --dry-run --json first element has no files array' };
  }
  for (const f of entry.files) {
    if (!f || typeof f !== 'object' || typeof f.path !== 'string') {
      return { ok: false, reason: 'npm pack --dry-run --json files array contains a non-string path entry' };
    }
  }

  return { ok: true, payload: entry };
}

/**
 * check(rootDir) -> { ok, findings: [] }. Seven assertions, each producing a
 * named finding on failure.
 */
function check(rootDir) {
  const findings = [];
  const measured = measurePayload(rootDir);

  if (!measured.ok) {
    findings.push('measurePayload failed: ' + measured.reason);
    return { ok: false, findings };
  }

  const payload = measured.payload;
  const paths = payload.files.map(function (f) { return f.path; });
  const pathSet = new Set(paths);

  console.log(
    'check-release-payload-ceiling: entryCount=' + payload.entryCount +
      ' unpackedSize=' + payload.unpackedSize +
      ' size=' + payload.size
  );

  // 1. entryCount <= MAX_ENTRIES
  if (!(typeof payload.entryCount === 'number' && payload.entryCount <= MAX_ENTRIES)) {
    findings.push(
      'entryCount ' + payload.entryCount + ' exceeds the ceiling of ' + MAX_ENTRIES +
        ' entries. Remove or negate directories in package.json "files".'
    );
  }

  // 2. unpackedSize <= MAX_UNPACKED
  if (!(typeof payload.unpackedSize === 'number' && payload.unpackedSize <= MAX_UNPACKED)) {
    findings.push(
      'unpackedSize ' + payload.unpackedSize + ' exceeds the ceiling of ' + MAX_UNPACKED +
        ' bytes (256 MiB). Remove or negate large directories in package.json "files".'
    );
  }

  // 3. the payload contains npm-shrinkwrap.json (the silent-failure tripwire)
  if (!pathSet.has('npm-shrinkwrap.json')) {
    findings.push(
      'npm-shrinkwrap.json is NOT in the pack payload. Remedy: add "npm-shrinkwrap.json" ' +
        'to package.json "files". Consequence if unfixed: the loader skips the dependency ' +
        'install WITHOUT a log entry, and both alwaysLoad MCP servers fail on require.'
    );
  }

  // 4. the payload contains .claude-plugin/plugin.json
  if (!pathSet.has('.claude-plugin/plugin.json')) {
    findings.push(
      '.claude-plugin/plugin.json is NOT in the pack payload. Without it the loader ' +
        'silently synthesizes a manifest named after its internal staging label.'
    );
  }

  // 5. no path equals scripts/release.sh and none starts with scripts/release-lib/
  if (pathSet.has('scripts/release.sh')) {
    findings.push(
      'scripts/release.sh IS in the pack payload. release.sh Step 9.5 refuses to publish ' +
        'a tarball containing it; negate "!scripts/release.sh" in package.json "files".'
    );
  }
  if (paths.some(function (p) { return p.startsWith('scripts/release-lib/'); })) {
    findings.push(
      'scripts/release-lib/ IS in the pack payload; negate "!scripts/release-lib" in ' +
        'package.json "files".'
    );
  }

  // 6. no path starts with any forbidden prefix, and no path matches ^\.env
  for (const prefix of FORBIDDEN_PREFIXES) {
    const hit = paths.find(function (p) { return p.startsWith(prefix); });
    if (hit) {
      findings.push('forbidden path "' + hit + '" (matches "' + prefix + '") is in the pack payload.');
    }
  }
  const envHit = paths.find(function (p) { return /^\.env/.test(p); });
  if (envHit) {
    findings.push('forbidden path "' + envHit + '" matches ^\\.env and is in the pack payload.');
  }

  // 7. zero lifecycle scripts across the shrinkwrap's package set, and none
  //    of preinstall/install/postinstall/prepare in the payload's root
  //    package.json. Security assertion: the loader's FIRST install passes
  //    NO --ignore-scripts, so a dependency that gains a lifecycle script
  //    would execute on every user machine.
  const shrinkwrapPath = path.join(rootDir, 'npm-shrinkwrap.json');
  if (fs.existsSync(shrinkwrapPath)) {
    try {
      const shrinkwrap = JSON.parse(fs.readFileSync(shrinkwrapPath, 'utf8'));
      const packages = shrinkwrap.packages && typeof shrinkwrap.packages === 'object' ? shrinkwrap.packages : {};
      const withInstallScript = Object.keys(packages).filter(function (k) {
        return packages[k] && packages[k].hasInstallScript === true;
      });
      if (withInstallScript.length) {
        findings.push(
          'npm-shrinkwrap.json declares hasInstallScript:true for: ' + withInstallScript.join(', ') +
            '. The loader\'s FIRST install passes no --ignore-scripts, so these would execute ' +
            'on every user machine.'
        );
      }
    } catch (e) {
      findings.push('could not parse npm-shrinkwrap.json to check hasInstallScript: ' + e.message);
    }
  } else {
    findings.push('npm-shrinkwrap.json does not exist on disk at ' + shrinkwrapPath + '; cannot check hasInstallScript.');
  }

  const rootPkgPath = path.join(rootDir, 'package.json');
  try {
    const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
    const scripts = rootPkg.scripts && typeof rootPkg.scripts === 'object' ? rootPkg.scripts : {};
    ['preinstall', 'install', 'postinstall', 'prepare'].forEach(function (name) {
      if (Object.prototype.hasOwnProperty.call(scripts, name)) {
        findings.push('root package.json declares a "' + name + '" lifecycle script; the loader\'s FIRST install has no --ignore-scripts.');
      }
    });
  } catch (e) {
    findings.push('could not parse ' + rootPkgPath + ' to check lifecycle scripts: ' + e.message);
  }

  return { ok: findings.length === 0, findings };
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 1 && argv[0] === '--check') {
    const rootDir = process.env.CHECK_PAYLOAD_CEILING_ROOT || REPO_ROOT;
    const result = check(rootDir);
    if (result.findings.length === 0) {
      console.log('check-release-payload-ceiling: OK (0 findings)');
    } else {
      for (const f of result.findings) {
        console.log((result.ok ? 'INFO: ' : 'FAIL: ') + f);
      }
    }
    process.exit(result.ok ? 0 : 1);
    return;
  }

  console.error(usage());
  process.exit(2);
}

if (require.main === module) {
  main();
}

module.exports = { measurePayload, check, MAX_ENTRIES, MAX_UNPACKED };
