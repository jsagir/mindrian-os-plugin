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
 *                                              was not built from the current sources, when a dist
 *                                              byte differs from the manifest, or when the dist
 *                                              fails the build's own output checks
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
 *   - Canon Part 8 / D-01 (CANON369 check C2): the dist names no outside host except the reviewed
 *     inert ones. The vendor bundles carry doc links, schema ids and CDN-fallback links (RxDB error
 *     text, emoji-mart data URLs); the build rewrites the CDN and RxDB names to the reserved
 *     .invalid top-level domain (RFC 2606), and every other http, https, ws or wss host must be in
 *     INERT_HOSTS below (a positive allow-list, each with its reason), so a NEW host fails the build
 *     and --check. The runtime control stays the shell's CSP connect-src 'self' (egress-and-canon C1).
 *   - D-06: no GPL-3.0 @blocknote/xl-* package in the bundle or in ui/shell's lockfile.
 *
 * Source hash: sha256 over the sorted (relative path, content hash) pairs of every file under
 * ui/shell and ui/shared (skipping node_modules, .next, generated typings and tsbuildinfo) plus
 * this script itself (so a change of build recipe is also a stale dist). The lockfiles are
 * ordinary files under those directories, so they are covered. It ALSO covers what the dist runs
 * against: the resolved version and integrity of each RUNTIME_PACKAGES entry (next, react,
 * react-dom, ajv), read from the root npm-shrinkwrap.json. The whole root package.json and the whole
 * shrinkwrap are deliberately NOT hashed: Phase 369.1 edits the "files" list and prunes the sharp
 * entries, neither of which changes a byte the dist runs, and hashing them would stale a good dist on
 * every such edit. A bump of a runtime package does change what the dist runs against, so it stales.
 *
 * Byte manifest: manifest.json also carries "files", a sha256 per dist file (manifest.json itself
 * excluded). --check re-hashes every file, refuses an extra, missing or non-regular file and re-runs
 * verifyOutput (hosts, bare imports, build-machine paths, GPL names) on the committed bytes, so a hand
 * edit of a dist file is caught even though the manifest is untouched.
 *
 * Walled install: a build refuses to run over a ui/shell/node_modules whose hidden lockfile drifted
 * from ui/shell/package-lock.json (npm install instead of npm ci, a hand-patched package). The
 * sha256 of that hidden lockfile is recorded in the manifest as installLockSha256 (information, not
 * part of --check, which must work on a machine that has no ui/shell/node_modules).
 *
 * Test seam: BUILD_UI_SHELL_DIST points --check (only) at a copy of the dist. The build refuses to
 * run while it is set, and no code path removes a directory unless its real path is this repo's
 * lib/ui-shell/dist (assertDistRemovable).
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
// The committed dist. The build only ever writes and removes this directory.
const DIST_DIR = path.join(REPO_ROOT, 'lib', 'ui-shell', 'dist');
// Test seam (the CHECK_PAYLOAD_CEILING_ROOT precedent): BUILD_UI_SHELL_DIST points --check, and only --check,
// at a copy of the dist. It is read inside check() alone; build() refuses to run while it is set (WR-17).
const SEAM_ENV = 'BUILD_UI_SHELL_DIST';
const ROOT_SHRINKWRAP = path.join(REPO_ROOT, 'npm-shrinkwrap.json');
const SELF = path.join(REPO_ROOT, 'scripts', 'build-ui-shell.cjs');

const STALE_MESSAGE = 'lib/ui-shell/dist is stale: run node scripts/build-ui-shell.cjs and commit lib/ui-shell/dist';
const REQUIRED_MANIFEST_KEYS = ['serverEntry', 'clientDir', 'sourceHash', 'builtAt', 'chassis', 'node_floor', 'files'];

// The root packages the dist runs against (the server output imports them, or the Next server loads them). Their resolved
// versions are part of the source hash; verifyOutput refuses a bare import of any other package, so this list cannot go stale quietly.
const RUNTIME_PACKAGES = ['next', 'react', 'react-dom', 'ajv'];

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
// WR-18: a positive allow-list. Every http, https, ws or wss host the dist names must be here (or end in .invalid, the
// reserved never-resolves name the rewrites above produce). Each entry is text that nothing fetches: a doc link in an
// error message, a schema id, a URL() parsing placeholder. The runtime control is the CSP connect-src 'self'.
const INERT_HOSTS = new Map([
  ['nextjs.org', 'Next.js documentation links inside error and warning text'],
  ['react.dev', 'React error-decoder link built into minified error messages'],
  ['github.com', 'issue and documentation links inside vendor error text'],
  ['raw.githubusercontent.com', 'ajv meta-schema $id strings (identifiers, never fetched)'],
  ['json-schema.org', 'JSON Schema $schema and $id identifiers'],
  ['www.w3.org', 'XML, SVG and XHTML namespace identifiers'],
  ['prosemirror.net', 'ProseMirror documentation link inside an error message'],
  ['tinyurl.com', 'short link inside the idb "IndexedDB API missing" message text'],
  ['bit.ly', 'short link inside the idb "Transaction committed too early" message text'],
  ['datatracker.ietf.org', 'RFC reference inside vendor comments and messages'],
  ['127.0.0.1', 'loopback: the shell talks to its own daemon here, nothing leaves the machine'],
  ['localhost', 'loopback: Next test-proxy helper default, nothing leaves the machine'],
  ['a', 'placeholder base for new URL() parsing and feature probes, not a host'],
  ['n', 'placeholder base for new URL() parsing, not a host'],
  ['x', 'placeholder host in a URL() feature probe, not a host'],
]);
const INERT_HOST_SUFFIXES = ['.invalid'];
const HOST_RE = /\b(?:https?|wss?):\/\/([A-Za-z0-9._-]+)/g;
const FORBIDDEN_LICENCE = ['@blocknote/xl-', 'xl-pdf-exporter', 'xl-docx-exporter'];

// Bare specifiers that look like imports but are inert text inside vendor code generators. ajv writes
// the string require("ajv-formats/dist/formats") into JavaScript it would generate for a standalone
// validator; nothing here ever runs that generated source, and the string is never executed as a
// require of this bundle.
// 'rxdb/plugins/' is the head of an RxDB error message ("import { X } from 'rxdb/plugins/" + name); it is text, not a module path.
const INERT_SPECIFIERS = new Set(['ajv-formats/dist/formats', 'rxdb/plugins/']);

// WR-18: any absolute build-machine path prefix fails the build. No reviewed exception is needed today; a vendor string that
// legitimately holds one goes into INERT_PATH_STRINGS with its reason, never into a weaker pattern.
const ABS_PATH_PREFIXES = ['home', 'Users', 'root', 'opt', 'var', 'srv', 'mnt', 'runner', '__w', 'tmp'];
const ABS_PATH_RE = new RegExp('(?:^|[^A-Za-z0-9_.~-])(/(?:' + ABS_PATH_PREFIXES.join('|') + ')/)', 'g');
const DRIVE_PATH_RE = /(?:^|[^A-Za-z0-9_])([A-Za-z]:\\{1,2})[A-Za-z0-9_$.]/g;
const INERT_PATH_STRINGS = new Set([]);

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

/**
 * The resolved version and integrity of each RUNTIME_PACKAGES entry, from the root shrinkwrap. A missing entry is an error: the
 * dist cannot be called fresh against a package the loader would not install.
 */
function runtimePackageEntries(shrinkwrapPath) {
  const sw = readJson(shrinkwrapPath || ROOT_SHRINKWRAP);
  const packages = (sw && sw.packages) || {};
  return RUNTIME_PACKAGES.map((name) => {
    const e = packages['node_modules/' + name];
    if (!e || !e.version) throw new Error('npm-shrinkwrap.json has no resolved version for the runtime package ' + name);
    return ['@runtime/' + name, e.version + ' ' + (e.integrity || 'no-integrity')];
  });
}

/**
 * sha256 over the sorted (path, content hash) list of the sources, this script, and the resolved runtime packages.
 * opts.shrinkwrapPath lets a test point the runtime-package read at a copy.
 */
function computeSourceHash(opts) {
  const h = crypto.createHash('sha256');
  const entries = listSourceFiles().map((f) => [f, sha256File(path.join(REPO_ROOT, f))]);
  entries.push(['@recipe/scripts/build-ui-shell.cjs', sha256File(SELF)]);
  for (const e of runtimePackageEntries(opts && opts.shrinkwrapPath)) entries.push(e);
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
    // WR-18: only an exact built-in name passes. "buffer/", "events/index" and "punycode/" begin with a built-in name but
    // resolve to the npm package of that name, which the dist does not carry.
    if (builtins.has(spec)) continue;
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

function isInertHost(host) {
  if (INERT_HOSTS.has(host)) return true;
  return INERT_HOST_SUFFIXES.some((suf) => host.endsWith(suf));
}

/**
 * WR-18: every http, https, ws or wss host named anywhere in the dist (maps and binaries included, read as latin1 so a host inside
 * a font or a map is still found) that is NOT on the reviewed INERT_HOSTS list. A URL built at run time ("https://" + x) names no host
 * here; the shell's CSP connect-src 'self' and egress-and-canon C1 are the control for that.
 */
function outsideHosts(dir) {
  const bad = [];
  for (const f of listFiles(dir)) {
    const s = fs.readFileSync(f).toString('latin1');
    const seen = new Set();
    HOST_RE.lastIndex = 0;
    let m;
    while ((m = HOST_RE.exec(s)) !== null) {
      const host = m[1].toLowerCase().replace(/[._-]+$/, '');
      if (!host || seen.has(host)) continue;
      seen.add(host);
      if (!isInertHost(host)) bad.push(host + ' (in ' + rel(f) + ')');
    }
  }
  return bad;
}

/** WR-18: any absolute build-machine path prefix (/home/, /Users/, /root/, /opt/, ..., a drive letter) or the repo root itself. */
function absolutePaths(dir) {
  const bad = [];
  const root = toPosix(REPO_ROOT);
  for (const f of listFiles(dir)) {
    // Skip fonts and images by extension (not by sniffing, which a NUL byte in a script would defeat): the drive-letter pattern
    // matches arbitrary bytes inside them, and they carry no build path.
    if (BINARY_EXT.has(path.extname(f).toLowerCase())) continue;
    const s = fs.readFileSync(f).toString('latin1');
    const hits = new Set();
    if (s.indexOf(root) !== -1) hits.add(root);
    for (const re of [ABS_PATH_RE, DRIVE_PATH_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(s)) !== null) hits.add(m[1]);
    }
    for (const h of hits) {
      if (!INERT_PATH_STRINGS.has(h)) bad.push(h + ' (in ' + rel(f) + ')');
    }
  }
  return bad;
}

/** Bare imports of a root package the source hash does not follow (a package outside RUNTIME_PACKAGES). */
function unhashedRuntimeImports(serverDir) {
  const builtins = new Set(builtinModules.concat(builtinModules.map((m) => m.replace(/^node:/, ''))));
  const bad = [];
  for (const [spec, file] of bareSpecifiers(serverDir)) {
    if (INERT_SPECIFIERS.has(spec) || builtins.has(spec)) continue;
    const name = packageNameOf(spec);
    if (!RUNTIME_PACKAGES.includes(name)) bad.push(name + ' (in ' + file + ')');
  }
  return Array.from(new Set(bad));
}

/**
 * The directories the build may remove: only this repo's lib/ui-shell/dist, by real path (WR-17). A symlink, a parent, the repo
 * root, a home directory or a path that merely ends alike all fail.
 */
function assertDistRemovable(dir) {
  const want = path.join(REPO_ROOT, 'lib', 'ui-shell', 'dist');
  let real;
  try {
    real = fs.realpathSync(dir);
  } catch (e) {
    real = path.resolve(dir); // a directory that does not exist yet cannot be resolved; compare the lexical path
  }
  let wantReal;
  try { wantReal = fs.realpathSync(want); } catch (e) { wantReal = want; }
  if (real !== wantReal && real !== want) {
    throw new Error('refusing to remove ' + dir + ': only ' + want + ' may be removed by the build');
  }
}

/** Relative posix path -> sha256 for every file under the dist except manifest.json, plus problems for non-regular entries. */
function distFileMap(dir) {
  const files = {};
  const problems = [];
  (function recur(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const p = path.join(d, e.name);
      const r = toPosix(path.relative(dir, p));
      if (e.isDirectory()) recur(p);
      else if (e.isFile()) {
        if (r !== 'manifest.json') files[r] = sha256File(p);
      } else problems.push(r + ' is not a regular file');
    }
  })(dir);
  return { files, problems };
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
  const roots = [SHELL_DIR, REPO_ROOT].map(toPosix);
  const stats = { pathScrubbed: 0, hostsRewritten: 0, dashEscaped: 0, mapsRemoved: 0 };
  for (const f of listFiles(serverDir)) {
    if (!isTextFile(f)) continue;
    let s = fs.readFileSync(f, 'utf8');
    const before = s;
    ABS_PATH_RE.lastIndex = 0;
    DRIVE_PATH_RE.lastIndex = 0;
    if (f.endsWith('.map') && (ABS_PATH_RE.test(s) || DRIVE_PATH_RE.test(s))) {
      fs.rmSync(f);
      stats.mapsRemoved += 1;
      continue;
    }
    for (const r of roots) {
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
  const unhashed = unhashedRuntimeImports(serverDir);
  if (unhashed.length) problems.push('WR-16: bare imports of packages the source hash does not follow (add them to RUNTIME_PACKAGES): ' + unhashed.join('; '));
  const hosts = outsideHosts(distDir);
  if (hosts.length) problems.push('C2: outside hosts not on the reviewed INERT_HOSTS list: ' + hosts.slice(0, 5).join('; '));
  const lic = filesContaining(distDir, FORBIDDEN_LICENCE);
  if (lic.length) problems.push('D-06: GPL-3.0 xl-* exporter names in the dist: ' + lic.slice(0, 5).join('; '));
  const abs = absolutePaths(distDir);
  if (abs.length) problems.push('absolute build-machine path in the dist: ' + abs.slice(0, 5).join('; '));
  return problems;
}

/**
 * ui/shell/node_modules must be what ui/shell/package-lock.json says (npm ci, not npm install, no hand patch): every installed
 * package in the hidden lockfile matches the lock entry (version, resolved, integrity) and the package's own package.json version, and
 * a lock entry the install lacks is an optional (platform) package. Returns the sha256 of the hidden lockfile for the manifest.
 */
function assertWalledInstallMatchesLock() {
  const hiddenPath = path.join(SHELL_DIR, 'node_modules', '.package-lock.json');
  if (!fs.existsSync(hiddenPath)) {
    throw new Error('ui/shell/node_modules/.package-lock.json is missing. Fix: cd ui/shell && npm ci --install-links --ignore-scripts');
  }
  const lock = (readJson(path.join(SHELL_DIR, 'package-lock.json')).packages) || {};
  const hidden = (readJson(hiddenPath).packages) || {};
  const drift = [];
  for (const key of Object.keys(hidden)) {
    const want = lock[key];
    if (!want) { drift.push(key + ' is installed but not in package-lock.json'); continue; }
    for (const field of ['version', 'resolved', 'integrity']) {
      if (want[field] !== hidden[key][field]) drift.push(key + ' ' + field + ' differs from package-lock.json');
    }
    if (hidden[key].link) continue;
    const pj = path.join(SHELL_DIR, key, 'package.json');
    if (fs.existsSync(pj)) {
      let v = null;
      try { v = readJson(pj).version; } catch (e) { v = null; }
      if (want.version && v !== want.version) drift.push(key + ' on disk is ' + v + ', the lock says ' + want.version);
    } else {
      drift.push(key + ' has no package.json on disk');
    }
  }
  for (const key of Object.keys(lock)) {
    if (!key || hidden[key]) continue;
    if (!lock[key].optional) drift.push(key + ' is in package-lock.json but not installed');
  }
  if (drift.length) {
    throw new Error('ui/shell/node_modules drifted from ui/shell/package-lock.json (' + drift.length + '): ' + drift.slice(0, 5).join('; ') +
      '. Fix: cd ui/shell && npm ci --install-links --ignore-scripts');
  }
  return sha256File(hiddenPath);
}

function build() {
  if (process.env[SEAM_ENV]) {
    throw new Error(SEAM_ENV + ' is a test seam for --check only and is set in this environment; unset it to build (the build writes lib/ui-shell/dist and nothing else)');
  }
  const rootPkg = readJson(path.join(REPO_ROOT, 'package.json'));
  const rootDeps = rootPkg.dependencies || {};

  const lock = fs.readFileSync(path.join(SHELL_DIR, 'package-lock.json'), 'utf8');
  if (lock.indexOf('@blocknote/xl-') !== -1) {
    throw new Error('D-06: ui/shell/package-lock.json names a GPL-3.0 @blocknote/xl-* package');
  }
  if (!fs.existsSync(path.join(SHELL_DIR, 'node_modules', 'next', 'dist', 'bin', 'next'))) {
    throw new Error('ui/shell/node_modules is not installed. Fix: cd ui/shell && npm ci --install-links --ignore-scripts');
  }

  const installLockSha256 = assertWalledInstallMatchesLock();
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

  assertDistRemovable(DIST_DIR);
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
    assertDistRemovable(DIST_DIR);
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
    installLockSha256,
    files: null,
  };
  const map = distFileMap(DIST_DIR);
  if (map.problems.length) {
    assertDistRemovable(DIST_DIR);
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    throw new Error('the build output was refused and removed: ' + map.problems.join('; '));
  }
  manifest.files = map.files;
  fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const all = listFiles(DIST_DIR);
  const bytes = all.reduce((n, f) => n + fs.statSync(f).size, 0);
  console.log('build-ui-shell: wrote lib/ui-shell/dist (' + all.length + ' files, ' + bytes + ' bytes), no node_modules');
}

function check() {
  // The seam is read here and nowhere else (WR-17).
  const distDir = process.env[SEAM_ENV] ? path.resolve(process.env[SEAM_ENV]) : DIST_DIR;
  const manifestPath = path.join(distDir, 'manifest.json');
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
  let now;
  try {
    now = computeSourceHash();
  } catch (e) {
    console.error(STALE_MESSAGE + ' (' + (e && e.message ? e.message : e) + ')');
    return 1;
  }
  if (manifest.sourceHash !== now.hash) {
    console.error(STALE_MESSAGE);
    console.error('  recorded ' + manifest.sourceHash.slice(0, 16) + ', current ' + now.hash.slice(0, 16));
    return 1;
  }
  if (!fs.existsSync(path.resolve(distDir, manifest.serverEntry))) {
    console.error(STALE_MESSAGE + ' (serverEntry ' + manifest.serverEntry + ' is missing)');
    return 1;
  }
  const nm = findNodeModules(distDir);
  if (nm.length) {
    console.error('lib/ui-shell/dist holds a node_modules tree (RULE 8): ' + nm.slice(0, 3).join(', '));
    return 1;
  }

  // WR-16: the committed bytes are the bytes the build recorded.
  const actual = distFileMap(distDir);
  const recorded = manifest.files && typeof manifest.files === 'object' ? manifest.files : {};
  const byteProblems = actual.problems.slice();
  for (const f of Object.keys(recorded)) {
    if (!Object.prototype.hasOwnProperty.call(actual.files, f)) byteProblems.push(f + ' is recorded in the manifest but missing from the dist');
    else if (actual.files[f] !== recorded[f]) byteProblems.push(f + ' differs from its recorded sha256');
  }
  for (const f of Object.keys(actual.files)) {
    if (!Object.prototype.hasOwnProperty.call(recorded, f)) byteProblems.push(f + ' is in the dist but not recorded in the manifest');
  }
  if (byteProblems.length) {
    console.error(STALE_MESSAGE + ' (the dist bytes do not match manifest.files)');
    for (const p of byteProblems.slice(0, 10)) console.error('  - ' + p);
    if (byteProblems.length > 10) console.error('  ... and ' + (byteProblems.length - 10) + ' more');
    return 1;
  }

  // WR-16: the build's own output checks, re-run on the committed bytes.
  const rootDeps = readJson(path.join(REPO_ROOT, 'package.json')).dependencies || {};
  const problems = verifyOutput(distDir, path.join(distDir, 'server'), rootDeps);
  if (problems.length) {
    console.error('lib/ui-shell/dist fails the build output checks:');
    for (const p of problems) console.error('  - ' + p);
    return 1;
  }
  console.log('build-ui-shell: lib/ui-shell/dist is fresh (source hash ' + now.hash.slice(0, 16) + ', ' + now.fileCount + ' files, ' + Object.keys(recorded).length + ' dist files verified)');
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
  outsideHosts,
  absolutePaths,
  assertDistRemovable,
  distFileMap,
  INERT_HOSTS,
  RUNTIME_PACKAGES,
  FORBIDDEN_LICENCE,
  REQUIRED_MANIFEST_KEYS,
  STALE_MESSAGE,
  DIST_DIR,
};
