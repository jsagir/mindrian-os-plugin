#!/usr/bin/env node
'use strict';

/*
 * scripts/build-ui-shell.cjs -- Phase 369 Plan 28 (D-07, D-17, RULE 8).
 *
 * WHAT: the maintainer's release step for the browser workspace. It builds the walled ui/shell
 * package (Next chassis, bake-off winner) and writes the result to lib/ui-shell/dist/, which is
 * committed and ships through the existing "lib" entry in package.json "files". It is the Phase
 * 232 editor-dist precedent applied to the UI shell: built by the maintainer, committed, checked.
 *
 *   node scripts/build-ui-shell.cjs            build (needs ui/shell/node_modules; see below)
 *   node scripts/build-ui-shell.cjs --check    freshness gate: exit 1 when the committed dist
 *                                              was not built from the current sources
 *
 * WHY it exists in this shape:
 *   - D-07: release-built assets. Nothing is ever built on a user's machine, and
 *     scripts/release.sh never runs the build; Step 2.4 only runs --check.
 *   - RULE 8: the dist carries no node_modules tree. The navigator ruled (2026-10-03, "Next as a
 *     per-machine dependency", see 369-BAKEOFF-DECISION.md) that next, react and react-dom are
 *     root dependencies the loader installs from npm-shrinkwrap.json, so the Next standalone
 *     server resolves them by walking up to the plugin root's node_modules. This script fails
 *     closed if the output holds a node_modules directory or a bare import that is neither a
 *     Node built-in nor a root dependency.
 *   - Canon Part 8 / D-01 (CANON369 check C2): no file names an outside host. The vendor bundles
 *     carry a few inert doc and CDN-fallback links (RxDB error text, emoji-mart data URLs); the
 *     build rewrites those host names to the reserved .invalid top-level domain (RFC 2606), the
 *     same method the agent-native bake-off build used, and fails if any remain.
 *   - D-06: no GPL-3.0 @blocknote/xl-* package in the bundle or in ui/shell's lockfile.
 *
 * Source hash: sha256 over the sorted (relative path, content hash) pairs of every file under
 * ui/shell and ui/shared (skipping node_modules, .next, generated typings and tsbuildinfo) plus
 * this script itself (so a change of build recipe is also a stale dist). The lockfiles are
 * ordinary files under those directories, so they are covered.
 *
 * Prerequisite (walled install, never the root manifest): cd ui/shell && npm ci --install-links
 * --ignore-scripts. ui/shell/node_modules/mos-ui-shared is a COPY of ui/shared; this script
 * refreshes that copy from ui/shared before building so the build always matches the hashed
 * sources.
 *
 * House rules: CJS, built-ins only, switch-case router, hyphens only, no emoji.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { builtinModules } = require('node:module');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHELL_DIR = path.join(REPO_ROOT, 'ui', 'shell');
const SHARED_DIR = path.join(REPO_ROOT, 'ui', 'shared');
// Test seam (the CHECK_PAYLOAD_CEILING_ROOT precedent): BUILD_UI_SHELL_DIST points --check at a tampered copy.
const DIST_DIR = process.env.BUILD_UI_SHELL_DIST ? path.resolve(process.env.BUILD_UI_SHELL_DIST) : path.join(REPO_ROOT, 'lib', 'ui-shell', 'dist');
const SELF = path.join(REPO_ROOT, 'scripts', 'build-ui-shell.cjs');

const STALE_MESSAGE = 'lib/ui-shell/dist is stale: run node scripts/build-ui-shell.cjs and commit lib/ui-shell/dist';
const REQUIRED_MANIFEST_KEYS = ['serverEntry', 'clientDir', 'sourceHash', 'builtAt', 'chassis', 'node_floor'];

// Directories and files that are never source: installs, build output, generated typings.
const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'coverage']);
const SKIP_FILES = new Set(['next-env.d.ts', '.DS_Store']);
const SKIP_SUFFIX = ['.tsbuildinfo'];

// Outside-host names the vendor bundles carry as inert text or unused fallbacks, and the reserved
// .invalid name each becomes. Order matters: the longer, more specific form first.
const HOST_REWRITES = [
  ['rxdb.info', 'rxdb.invalid'],
  ['cdn.jsdelivr.net', 'cdn-blocked.invalid'],
  ['cdn.jsdelivr', 'cdn-blocked.invalid'],
  ['fonts.googleapis.com', 'fonts-blocked.invalid'],
  ['fonts.googleapis', 'fonts-blocked.invalid'],
  ['fonts.gstatic.com', 'fonts-blocked.invalid'],
  ['fonts.gstatic', 'fonts-blocked.invalid'],
  ['unpkg.com', 'unpkg-blocked.invalid'],
  ['cdnjs.cloudflare.com', 'cdn-blocked.invalid'],
  ['cdnjs', 'cdn-blocked'],
];
const FORBIDDEN_HOSTS = ['rxdb.info', 'fonts.googleapis', 'fonts.gstatic', 'cdn.jsdelivr', 'unpkg.com', 'cdnjs'];
const FORBIDDEN_LICENCE = ['@blocknote/xl-', 'xl-pdf-exporter', 'xl-docx-exporter'];

// Bare specifiers that look like imports but are inert text inside vendor code generators. ajv writes
// the string require("ajv-formats/dist/formats") into JavaScript it would generate for a standalone
// validator; nothing here ever runs that generated source, and the string is never executed as a
// require of this bundle.
const INERT_SPECIFIERS = new Set(['ajv-formats/dist/formats']);

// Built with String.fromCharCode so this file itself carries no literal em or en dash.
const EM_DASH = new RegExp(String.fromCharCode(0x2014), 'g');
const EN_DASH = new RegExp(String.fromCharCode(0x2013), 'g');

const BINARY_EXT = new Set(['.woff', '.woff2', '.ttf', '.otf', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.avif']);

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function rel(p) {
  return toPosix(path.relative(REPO_ROOT, p));
}

function walk(dir, visit, skipDirs) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (skipDirs && skipDirs.has(e.name)) continue;
      walk(p, visit, skipDirs);
    } else if (e.isFile()) {
      visit(p);
    }
  }
}

/** Every source file under ui/shell and ui/shared, as repo-relative posix paths, sorted. */
function listSourceFiles() {
  const files = [];
  for (const root of [SHELL_DIR, SHARED_DIR]) {
    if (!fs.existsSync(root)) continue;
    walk(
      root,
      (p) => {
        const base = path.basename(p);
        if (SKIP_FILES.has(base)) return;
        if (SKIP_SUFFIX.some((s) => base.endsWith(s))) return;
        files.push(rel(p));
      },
      SKIP_DIRS
    );
  }
  files.sort();
  return files;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** sha256 over the sorted (path, content hash) list of the sources plus this script. */
function computeSourceHash() {
  const h = crypto.createHash('sha256');
  const entries = listSourceFiles().map((f) => [f, sha256File(path.join(REPO_ROOT, f))]);
  entries.push(['@recipe/scripts/build-ui-shell.cjs', sha256File(SELF)]);
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [f, d] of entries) h.update(f + '\0' + d + '\n');
  return { hash: h.digest('hex'), fileCount: entries.length };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findNodeModules(dir) {
  const hits = [];
  if (!fs.existsSync(dir)) return hits;
  (function recur(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const p = path.join(d, e.name);
      if (e.name === 'node_modules') hits.push(rel(p));
      else recur(p);
    }
  })(dir);
  return hits;
}

function isTextFile(file) {
  if (BINARY_EXT.has(path.extname(file).toLowerCase())) return false;
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(Math.min(8192, fs.statSync(file).size));
    fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.indexOf(0) === -1;
  } finally {
    fs.closeSync(fd);
  }
}

function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  walk(dir, (p) => out.push(p), null);
  return out;
}

/**
 * Bare import specifiers in the dist's JavaScript, with the file each came from. Matches the forms a
 * bundler leaves behind: require("x"), import("x"), from"x", import"x" (double or single quotes,
 * or a template literal with no placeholder). Relative and absolute specifiers are skipped.
 */
function bareSpecifiers(distDir) {
  const found = new Map();
  const patterns = [
    /\brequire\(\s*["'`]([^"'`\s)]+)["'`]\s*\)/g,
    /\bimport\(\s*["'`]([^"'`\s)]+)["'`]\s*\)/g,
    /\bfrom\s*["'`]([^"'`\s]+)["'`]/g,
    /(?:^|[;}\n])\s*import\s*["']([^"'\s]+)["']/g,
  ];
  for (const f of listFiles(distDir)) {
    if (!/\.(?:js|mjs|cjs)$/.test(f)) continue;
    // Comment-only lines document imports (the Turbopack runtime describes a require of "something"); they are text, not imports.
    const src = fs.readFileSync(f, 'utf8').replace(/^[ \t]*\/\/.*$/gm, '');
    for (const re of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) {
        const spec = m[1];
        if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) continue;
        // A trailing slash is a prefix inside a message ("import { X } from 'rxdb/plugins/" + name), not a module path.
        if (spec.endsWith('/')) continue;
        if (!/^(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+(?:\/[^\s]*)?$/i.test(spec)) continue;
        if (!found.has(spec)) found.set(spec, rel(f));
      }
    }
  }
  return found;
}

function packageNameOf(spec) {
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Bare specifiers that are neither a Node built-in nor a root dependency (and not an inert string). */
function foreignSpecifiers(distDir, rootDeps) {
  const builtins = new Set(builtinModules.concat(builtinModules.map((m) => m.replace(/^node:/, ''))));
  const bad = [];
  for (const [spec, file] of bareSpecifiers(distDir)) {
    if (INERT_SPECIFIERS.has(spec)) continue;
    const name = packageNameOf(spec);
    if (builtins.has(spec) || builtins.has(name)) continue;
    if (Object.prototype.hasOwnProperty.call(rootDeps, name)) continue;
    bad.push(spec + ' (in ' + file + ')');
  }
  return bad;
}

/** Every dist file that holds one of the needles (text files only). */
function filesContaining(dir, needles) {
  const hits = [];
  for (const f of listFiles(dir)) {
    if (!isTextFile(f)) continue;
    const s = fs.readFileSync(f, 'utf8');
    for (const n of needles) {
      if (s.indexOf(n) !== -1) hits.push(rel(f) + ' names ' + n);
    }
  }
  return hits;
}

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, Object.assign({ stdio: 'inherit' }, opts));
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(path.basename(cmd) + ' ' + args.join(' ') + ' exited ' + r.status);
}

/** ui/shell/node_modules/mos-ui-shared is a copy of ui/shared (install-links lockfile shape): refresh it. */
function syncSharedCopy() {
  const copy = path.join(SHELL_DIR, 'node_modules', 'mos-ui-shared');
  if (!fs.existsSync(copy)) {
    throw new Error('ui/shell/node_modules/mos-ui-shared is missing. Fix: cd ui/shell && npm ci --install-links --ignore-scripts');
  }
  if (fs.lstatSync(copy).isSymbolicLink()) return 'symlink (nothing to refresh)';
  fs.rmSync(path.join(copy, 'src'), { recursive: true, force: true });
  fs.cpSync(path.join(SHARED_DIR, 'src'), path.join(copy, 'src'), { recursive: true });
  for (const name of ['package.json', 'README.md']) {
    if (fs.existsSync(path.join(SHARED_DIR, name))) fs.copyFileSync(path.join(SHARED_DIR, name), path.join(copy, name));
  }
  if (fs.existsSync(path.join(SHARED_DIR, 'scripts'))) {
    fs.rmSync(path.join(copy, 'scripts'), { recursive: true, force: true });
    fs.cpSync(path.join(SHARED_DIR, 'scripts'), path.join(copy, 'scripts'), { recursive: true });
  }
  return 'refreshed from ui/shared';
}

/**
 * Post-process the copied output: a build writes the maintainer's absolute path into server.js and
 * required-server-files.json (neutralised to "."; the server chdirs to its own directory), host names
 * become .invalid, literal em and en dashes in scripts become escapes, and a source map that embeds an
 * absolute path is removed.
 */
function sanitize(serverDir) {
  const roots = [SHELL_DIR, REPO_ROOT, path.dirname(REPO_ROOT)].map(toPosix);
  const stats = { pathScrubbed: 0, hostsRewritten: 0, dashEscaped: 0, mapsRemoved: 0 };
  for (const f of listFiles(serverDir)) {
    if (!isTextFile(f)) continue;
    let s = fs.readFileSync(f, 'utf8');
    const before = s;
    if (f.endsWith('.map') && /["':\s](?:\/(?:home|Users|root|tmp)\/|[A-Za-z]:[\\/])/.test(s)) {
      fs.rmSync(f);
      stats.mapsRemoved += 1;
      continue;
    }
    for (const r of roots.slice(0, 2)) {
      if (s.indexOf(r) !== -1) s = s.split(r).join('.');
    }
    if (s !== before) stats.pathScrubbed += 1;
    const afterPath = s;
    for (const [from, to] of HOST_REWRITES) {
      if (s.indexOf(from) !== -1) s = s.split(from).join(to);
    }
    if (s !== afterPath) stats.hostsRewritten += 1;
    const afterHost = s;
    if (/\.(?:js|mjs|cjs|json)$/.test(f)) {
      s = s.replace(EM_DASH, '\\u2014').replace(EN_DASH, '\\u2013');
    } else {
      s = s.replace(EM_DASH, '-').replace(EN_DASH, '-');
    }
    if (s !== afterHost) stats.dashEscaped += 1;
    if (s !== before) fs.writeFileSync(f, s);
  }
  return stats;
}

function verifyOutput(distDir, serverDir, rootDeps) {
  const problems = [];
  const nm = findNodeModules(distDir);
  if (nm.length) problems.push('RULE 8: the dist holds node_modules: ' + nm.slice(0, 5).join(', '));
  const foreign = foreignSpecifiers(serverDir, rootDeps);
  if (foreign.length) problems.push('RULE 8: bare imports that are not a root dependency or a Node built-in: ' + foreign.join('; '));
  const hosts = filesContaining(distDir, FORBIDDEN_HOSTS);
  if (hosts.length) problems.push('C2: outside host names remain: ' + hosts.slice(0, 5).join('; '));
  const lic = filesContaining(distDir, FORBIDDEN_LICENCE);
  if (lic.length) problems.push('D-06: GPL-3.0 xl-* exporter names in the dist: ' + lic.slice(0, 5).join('; '));
  const abs = filesContaining(distDir, [toPosix(REPO_ROOT), '/home/', '/Users/']);
  if (abs.length) problems.push('absolute build-machine path in the dist: ' + abs.slice(0, 5).join('; '));
  return problems;
}

function build() {
  const rootPkg = readJson(path.join(REPO_ROOT, 'package.json'));
  const rootDeps = rootPkg.dependencies || {};

  const lock = fs.readFileSync(path.join(SHELL_DIR, 'package-lock.json'), 'utf8');
  if (lock.indexOf('@blocknote/xl-') !== -1) {
    throw new Error('D-06: ui/shell/package-lock.json names a GPL-3.0 @blocknote/xl-* package');
  }
  if (!fs.existsSync(path.join(SHELL_DIR, 'node_modules', 'next', 'dist', 'bin', 'next'))) {
    throw new Error('ui/shell/node_modules is not installed. Fix: cd ui/shell && npm ci --install-links --ignore-scripts');
  }

  console.log('build-ui-shell: shared copy ' + syncSharedCopy());
  const src = computeSourceHash();
  console.log('build-ui-shell: source hash ' + src.hash.slice(0, 16) + ' over ' + src.fileCount + ' files');

  const env = Object.assign({}, process.env, {
    NEXT_TELEMETRY_DISABLED: '1',
    DO_NOT_TRACK: '1',
    NODE_ENV: 'production',
    MOS_UI_BUILD_ID: src.hash.slice(0, 20),
  });
  // Next reads NODE_ENV itself; leaving a development value in the caller's shell would break the build.
  run(process.execPath, [path.join(SHELL_DIR, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], { cwd: SHELL_DIR, env });
  run(process.execPath, [path.join(SHELL_DIR, 'scripts', 'postbuild.mjs')], { cwd: SHELL_DIR, env });

  const standalone = path.join(SHELL_DIR, '.next', 'standalone');
  if (!fs.existsSync(path.join(standalone, 'server.js'))) throw new Error('the build produced no .next/standalone/server.js');

  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  const serverDir = path.join(DIST_DIR, 'server');
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.cpSync(standalone, serverDir, {
    recursive: true,
    filter: (from) => path.basename(from) !== 'node_modules',
  });

  const stats = sanitize(serverDir);
  console.log(
    'build-ui-shell: sanitised (' + stats.pathScrubbed + ' files path-scrubbed, ' + stats.hostsRewritten +
      ' files host-rewritten, ' + stats.dashEscaped + ' files dash-escaped, ' + stats.mapsRemoved + ' maps removed)'
  );

  const problems = verifyOutput(DIST_DIR, serverDir, rootDeps);
  if (problems.length) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    throw new Error('the build output was refused and removed:\n  - ' + problems.join('\n  - '));
  }

  const chassisPkg = readJson(path.join(SHELL_DIR, 'node_modules', 'next', 'package.json'));
  const manifest = {
    serverEntry: 'server/server.js',
    clientDir: 'server/.next/static',
    sourceHash: src.hash,
    builtAt: new Date().toISOString(),
    chassis: 'next@' + chassisPkg.version,
    node_floor: (rootPkg.engines && rootPkg.engines.node) || '>=22.18.0',
  };
  fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const all = listFiles(DIST_DIR);
  const bytes = all.reduce((n, f) => n + fs.statSync(f).size, 0);
  console.log('build-ui-shell: wrote lib/ui-shell/dist (' + all.length + ' files, ' + bytes + ' bytes), no node_modules');
}

function check() {
  const manifestPath = path.join(DIST_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(STALE_MESSAGE + ' (no manifest.json)');
    return 1;
  }
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (e) {
    console.error(STALE_MESSAGE + ' (manifest.json does not parse)');
    return 1;
  }
  const missing = REQUIRED_MANIFEST_KEYS.filter((k) => !manifest[k]);
  if (missing.length) {
    console.error(STALE_MESSAGE + ' (manifest lacks ' + missing.join(', ') + ')');
    return 1;
  }
  const now = computeSourceHash();
  if (manifest.sourceHash !== now.hash) {
    console.error(STALE_MESSAGE);
    console.error('  recorded ' + manifest.sourceHash.slice(0, 16) + ', current ' + now.hash.slice(0, 16));
    return 1;
  }
  if (!fs.existsSync(path.resolve(DIST_DIR, manifest.serverEntry))) {
    console.error(STALE_MESSAGE + ' (serverEntry ' + manifest.serverEntry + ' is missing)');
    return 1;
  }
  const nm = findNodeModules(DIST_DIR);
  if (nm.length) {
    console.error('lib/ui-shell/dist holds a node_modules tree (RULE 8): ' + nm.slice(0, 3).join(', '));
    return 1;
  }
  console.log('build-ui-shell: lib/ui-shell/dist is fresh (source hash ' + now.hash.slice(0, 16) + ', ' + now.fileCount + ' files)');
  return 0;
}

function usage() {
  return 'usage: node scripts/build-ui-shell.cjs [--check]';
}

function main(argv) {
  const arg = argv[0] || 'build';
  if (argv.length > 1) {
    console.error(usage());
    return 2;
  }
  switch (arg) {
    case 'build':
    case '--build':
      try {
        build();
        return 0;
      } catch (e) {
        console.error('build-ui-shell: FAILED: ' + (e && e.message ? e.message : e));
        return 1;
      }
    case '--check':
      return check();
    default:
      console.error(usage());
      return 2;
  }
}

if (require.main === module) {
  process.exit(main(process.argv.slice(2)));
}

module.exports = {
  computeSourceHash,
  listSourceFiles,
  bareSpecifiers,
  foreignSpecifiers,
  filesContaining,
  findNodeModules,
  FORBIDDEN_HOSTS,
  FORBIDDEN_LICENCE,
  REQUIRED_MANIFEST_KEYS,
  STALE_MESSAGE,
  DIST_DIR,
};
