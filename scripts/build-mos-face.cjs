#!/usr/bin/env node
'use strict';

/*
 * scripts/build-mos-face.cjs -- Phase 380 Plan 08 (D-05, MOD380-04, CLAUDE.md D-17).
 *
 * WHAT: the maintainer's release step for the /m:os face panel mod. It compiles the walled
 * ui/mos-face package (TypeScript and TSX hook modules) to plain JavaScript modules in
 * lib/mos-face/dist, which is committed and ships through the existing "lib" entry of the root
 * package.json "files". It is the Phase 369 lib/ui-shell/dist precedent (scripts/build-ui-shell.cjs)
 * applied to the mod: built by the maintainer, committed, checked. This script itself never ships
 * (a files-array exclusion in the root package.json).
 *
 *   node scripts/build-mos-face.cjs            build (needs ui/mos-face/node_modules; see below)
 *   node scripts/build-mos-face.cjs --check    freshness gate: exit 1 when the committed dist was not
 *                                              built from the current sources, when a dist byte
 *                                              differs from the manifest, or when the dist fails the
 *                                              output rules. It needs no node_modules.
 *
 * WHY it has this shape:
 *   - D-05: only built assets ship. Nothing is built on a user's machine, and scripts/release.sh does
 *     not run the build. The gate runs inside tests/run-all-380.sh (tests/test-380-build.cjs).
 *   - The engine loads .ts, .tsx, .js and .mjs hook modules as ES modules and compiles JSX to bare h
 *     calls (the declaration file header says so). So the build is a plain tsc emit: no bundler, no
 *     new package. The emitted modules keep the extensionless relative imports of the source. The
 *     real engine decides whether that is enough (test-380-build.cjs B8). IMPORT_REWRITE below is the
 *     switch for a post-emit step that appends .js to relative import specifiers; the manifest
 *     records the value as importRewrite.
 *   - The type declarations (types/index.d.ts) are copied beside the modules, and the canon face
 *     asset and its renderer (ui/mos-face/assets) are copied byte for byte to dist/assets: the panel
 *     reads the asset from lib/mos-face/dist/assets when the dev folder is absent (hooks/theo-face.ts).
 *
 * Output rules (verifyOutput, run at build time and again by --check on the committed bytes):
 *   no .ts or .tsx file (a .d.ts under types/ is a declaration, not source); no require call and no
 *   import() call; every bare import is claude-code; no build-machine path; no network host other than
 *   www.mindrian-os.com; no em-dash or en-dash; no banned copy word in a string literal (the word list
 *   mirrors tests/test-380-copy.cjs, and test-380-build.cjs checks that the two lists agree). The
 *   renderer asset is a data file (never loaded by the engine as a module): it is checked for dashes
 *   and build paths only.
 *
 * Source hash: sha256 over the sorted (relative path, content hash) pairs of every file under ui/mos-face
 * except node_modules, .claude-plugin/types (engine-laid), tests, panel.test.tsx, scripts/capture-shots.cjs,
 * scripts/lib and README.md, plus this script. ui/mos-face/package-lock.json is an ordinary file under
 * that folder, so the lockfile is covered.
 *
 * Walled install: a build refuses to run over a ui/mos-face/node_modules that drifted from
 * ui/mos-face/package-lock.json (npm install instead of npm ci, a hand-patched package), or whose
 * typescript version differs from the lockfile.
 *
 * Test seam: BUILD_MOS_FACE_DIST points --check (only) at a copy of the dist. The build refuses to run
 * while it is set, and no code path removes a directory unless its real path is this repo's
 * lib/mos-face/dist (assertDistRemovable).
 *
 * Prerequisite (walled install, never the root manifest): cd ui/mos-face && npm ci --ignore-scripts.
 *
 * House rules: CJS, built-ins only, switch-case router, hyphens only, no emoji.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const MOD_DIR = path.join(REPO_ROOT, 'ui', 'mos-face');
// The committed dist. The build only ever writes and removes this directory.
const DIST_DIR = path.join(REPO_ROOT, 'lib', 'mos-face', 'dist');
// Test seam (the build-ui-shell precedent): points --check, and only --check, at a copy of the dist.
const SEAM_ENV = 'BUILD_MOS_FACE_DIST';
const SELF = path.join(REPO_ROOT, 'scripts', 'build-mos-face.cjs');

const STALE_MESSAGE = 'lib/mos-face/dist is stale: run node scripts/build-mos-face.cjs and commit lib/mos-face/dist';
const REQUIRED_MANIFEST_KEYS = ['schema', 'builder', 'sourceHash', 'typescript', 'files'];
const BUILDER = 'scripts/build-mos-face.cjs';
// Decided by the real-engine proof (tests/test-380-build.cjs B8). See the header.
const IMPORT_REWRITE = false;

// Not source of the dist: installs, the engine-laid declaration folder, tests, the screenshot harness, the readme.
const SKIP_REL = new Set(['.claude-plugin/types', 'tests', 'scripts/capture-shots.cjs', 'scripts/lib', 'README.md', 'panel.test.tsx']);
const SKIP_FILES = new Set(['.DS_Store']);

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const ALLOWED_HOSTS = new Set(['www.mindrian-os.com']);
const ALLOWED_BARE = new Set(['claude-code']);
const HOST_RE = /\b(?:https?|wss?):\/\/([A-Za-z0-9._-]+)/g;
const ABS_PATH_PREFIXES = ['home', 'Users', 'root', 'opt', 'var', 'srv', 'mnt', 'runner', '__w', 'tmp'];
const ABS_PATH_RE = new RegExp('(?:^|[^A-Za-z0-9_.~-])(/(?:' + ABS_PATH_PREFIXES.join('|') + ')/)', 'g');
const DRIVE_PATH_RE = /(?:^|[^A-Za-z0-9_])([A-Za-z]:\\{1,2})[A-Za-z0-9_$.]/g;

// The copy rules of plan 380-06 (mirror of tests/test-380-copy.cjs WORD_RULES; test-380-build.cjs B13 compares the names).
const COMMAND_NAME = /\/mos:[a-z0-9-]+/g;
const HOST_NAME = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|dev|app|test)\b/gi;
const WORD_RULES = [
  ['ICM', /\bICM\b/i],
  ['Brain', /\bBrain\b/i],
  ['MCP', /\bMCP\b/i],
  ['Aura', /\bAura\b/i],
  ['Larry', /\bLarry\b/i],
  ['the book', /\bthe book\b/i],
  ['Aronhime', /Aronhime/i],
  ['Lawrence', /Lawrence/i],
  ['Johns Hopkins', /Johns Hopkins/i],
  ['JHU', /\bJHU\b/],
  ['revolutionary', /\brevolutionary\b/i],
  ['game-changing', /\bgame-chang(ing|er)\b/i],
  ['supercharge', /\bsupercharg/i],
  ['unlimited potential', /\bunlimited potential\b/i],
  ['instant insight', /\binstant insight\b/i],
  ['AI workforce', /\bAI workforce\b/i],
  ['autonomous strategist', /\bautonomous strategist\b/i],
  ['unchecked superlative', /\b(ever published|most rigorous)\b/i],
];
// Strings that are file names, not words the person reads (the ALLOWED list of tests/test-380-copy.cjs).
const ALLOWED_STRINGS = ['/brain-prewarm.json', '~/.mindrian/bridge/brain-health.json', '/bridge/brain-health.json'];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// ---- source hash ------------------------------------------------------------------------------

/** Every source file under ui/mos-face as posix paths relative to it, sorted. */
function listSourceFiles(modDir) {
  const root = modDir || MOD_DIR;
  const files = [];
  (function recur(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const r = toPosix(path.relative(root, abs));
      if (SKIP_REL.has(r)) continue;
      if (e.isDirectory()) {
        if (e.name === 'node_modules') continue;
        recur(abs);
      } else if (e.isFile()) {
        if (SKIP_FILES.has(e.name)) continue;
        files.push(r);
      }
    }
  })(root);
  files.sort();
  return files;
}

/** sha256 over the sorted (path, content hash) list of the sources and this script. opts.modDir and opts.self point a test at a copy. */
function computeSourceHash(opts) {
  const modDir = (opts && opts.modDir) || MOD_DIR;
  const self = (opts && opts.self) || SELF;
  const h = crypto.createHash('sha256');
  const entries = listSourceFiles(modDir).map((f) => ['ui/mos-face/' + f, sha256File(path.join(modDir, f))]);
  entries.push(['@recipe/scripts/build-mos-face.cjs', sha256File(self)]);
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [f, d] of entries) h.update(f + '\0' + d + '\n');
  return { hash: h.digest('hex'), fileCount: entries.length };
}

// ---- the reader of emitted JavaScript -----------------------------------------------------------

/**
 * A small reader for plain JavaScript (the compiler output). It returns the text parts a person could
 * see (the contents of single quote, double quote and template strings, each template part on its own),
 * the code with every string, comment and regex literal blanked, and the import specifiers. It throws
 * on a string that runs over a line, which is what a misread looks like (the build then fails closed).
 */
function readJs(source) {
  const specs = [];
  const src = source.replace(/^[ \t]*(?:import|export)\b[^;]*?\bfrom\s*(['"])([^'"\n]*)\1/gm, (m, q, s) => {
    specs.push(s);
    return m.replace(/[^\n]/g, ' ');
  }).replace(/^[ \t]*import\s*(['"])([^'"\n]*)\1/gm, (m, q, s) => {
    specs.push(s);
    return m.replace(/[^\n]/g, ' ');
  });
  const n = src.length;
  const parts = [];
  let blank = '';
  let prev = '';
  let line = 1;
  let i = 0;
  const REGEX_AFTER = '(,=:[!&|?{;';
  const fail = (what) => { throw new Error(what + ' at line ' + line); };
  const unescape = (ch) => (ch === 'n' ? '\n' : ch === 't' ? '\t' : ch);

  function lexString(quote) {
    const at = line;
    let text = '';
    i += 1;
    while (i < n && src[i] !== quote) {
      if (src[i] === '\n') fail('unterminated string');
      if (src[i] === '\\') { text += src[i + 1] === undefined ? '' : unescape(src[i + 1]); i += 2; continue; }
      text += src[i];
      i += 1;
    }
    if (i >= n) fail('unterminated string');
    i += 1;
    parts.push({ text, line: at });
    blank += '"';
    prev = '"';
  }
  function lexTemplate() {
    let at = line;
    let text = '';
    i += 1;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { text += src[i + 1] === undefined ? '' : unescape(src[i + 1]); i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        parts.push({ text, line: at });
        text = '';
        i += 2;
        lexCode(true);
        at = line;
        continue;
      }
      if (src[i] === '\n') line += 1;
      text += src[i];
      i += 1;
    }
    if (i >= n) fail('unterminated template');
    i += 1;
    parts.push({ text, line: at });
    blank += '"';
    prev = '"';
  }
  function lexRegex() {
    i += 1;
    let inClass = false;
    while (i < n && (src[i] !== '/' || inClass)) {
      if (src[i] === '\n') fail('unterminated regex');
      if (src[i] === '\\') { i += 2; continue; }
      if (src[i] === '[') inClass = true;
      else if (src[i] === ']') inClass = false;
      i += 1;
    }
    i += 1;
    while (i < n && /[a-z]/.test(src[i])) i += 1;
    blank += '"';
    prev = '"';
  }
  function lexCode(inTemplateExpr) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === '/' && d === '/') {
        while (i < n && src[i] !== '\n') i += 1;
      } else if (c === '/' && d === '*') {
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') { line += 1; blank += '\n'; }
          i += 1;
        }
        i += 2;
      } else if (c === "'" || c === '"') {
        lexString(c);
      } else if (c === '`') {
        lexTemplate();
      } else if (c === '/' && (prev === '' || REGEX_AFTER.includes(prev))) {
        lexRegex();
      } else if (c === '}' && inTemplateExpr && depth === 0) {
        i += 1;
        return;
      } else {
        if (c === '{') depth += 1;
        if (c === '}') depth -= 1;
        if (c === '\n') line += 1;
        blank += c;
        if (!/\s/.test(c)) prev = c;
        i += 1;
      }
    }
  }
  lexCode(false);
  return { parts, code: blank, specs };
}

// The banned things found in one text. Empty list = clean.
function bannedIn(text) {
  const found = [];
  if (text.includes(EM_DASH)) found.push('em-dash');
  if (text.includes(EN_DASH)) found.push('en-dash');
  if (/ -- /.test(text)) found.push('double-hyphen');
  const words = text.replace(COMMAND_NAME, ' ').replace(HOST_NAME, ' ');
  for (const [name, rule] of WORD_RULES) if (rule.test(words)) found.push(name);
  return found;
}

// ---- output rules -------------------------------------------------------------------------------

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  (function recur(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recur(p);
      else out.push({ abs: p, rel: toPosix(path.relative(dir, p)), regular: e.isFile() });
    }
  })(dir);
  return out;
}

/** Relative posix path to sha256 for every file under the dist except manifest.json, plus problems for non-regular entries. */
function distFileMap(dir) {
  const files = {};
  const problems = [];
  for (const f of walkFiles(dir)) {
    if (!f.regular) problems.push(f.rel + ' is not a regular file');
    else if (f.rel !== 'manifest.json') files[f.rel] = sha256File(f.abs);
  }
  return { files, problems };
}

/**
 * The output rules. Returns a list of problem sentences (empty = clean). distDir holds the modules at its top,
 * types/ and assets/. repoRoot is the build-machine root to refuse inside the text (default: this repo).
 */
function verifyOutput(distDir, repoRoot) {
  const root = toPosix(repoRoot || REPO_ROOT);
  const problems = [];
  for (const f of walkFiles(distDir)) {
    const name = path.posix.basename(f.rel);
    const top = f.rel.split('/')[0];
    if (!f.regular) { problems.push(f.rel + ' is not a regular file'); continue; }
    if (f.rel.split('/').includes('node_modules')) problems.push(f.rel + ': the dist holds a node_modules folder');
    const isDecl = /\.d\.ts$/.test(name) && top === 'types';
    if (/\.(?:tsx|mts|cts)$/.test(name) || (/\.ts$/.test(name) && !isDecl)) {
      problems.push(f.rel + ': a TypeScript source file (.ts, .tsx) must not ship');
      continue;
    }
    if (!(/\.(?:js|json)$/.test(name) || isDecl)) {
      problems.push(f.rel + ': a file kind the dist does not hold');
      continue;
    }
    const text = fs.readFileSync(f.abs).toString('utf8');
    if (text.includes(EM_DASH)) problems.push(f.rel + ': holds an em-dash');
    if (text.includes(EN_DASH)) problems.push(f.rel + ': holds an en-dash');
    const paths = new Set();
    if (text.indexOf(root) !== -1) paths.add(root);
    for (const re of [ABS_PATH_RE, DRIVE_PATH_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) paths.add(m[1]);
    }
    for (const p of paths) problems.push(f.rel + ': names a build-machine path (' + p + ')');

    // Module rules: only the emitted JavaScript modules. The renderer asset is a data file the engine never loads as a module.
    const isModule = /\.js$/.test(name) && top !== 'assets';
    if (!isModule) continue;
    let read;
    try {
      read = readJs(text);
    } catch (e) {
      problems.push(f.rel + ': the output reader could not read the file (' + (e && e.message ? e.message : e) + ')');
      continue;
    }
    if (/\brequire\s*\(/.test(read.code)) problems.push(f.rel + ': holds a require call');
    if (/\bimport\s*\(/.test(read.code)) problems.push(f.rel + ': holds an import() call');
    for (const spec of read.specs) {
      if (spec.startsWith('./') || spec.startsWith('../')) continue;
      if (!ALLOWED_BARE.has(spec)) problems.push(f.rel + ': a bare import other than claude-code (' + spec + ')');
    }
    const seen = new Set();
    HOST_RE.lastIndex = 0;
    let hm;
    while ((hm = HOST_RE.exec(text)) !== null) {
      const host = hm[1].toLowerCase().replace(/[._-]+$/, '');
      if (!host || seen.has(host)) continue;
      seen.add(host);
      if (!ALLOWED_HOSTS.has(host)) problems.push(f.rel + ': names a network host other than www.mindrian-os.com (' + host + ')');
    }
    for (const part of read.parts) {
      let t = part.text;
      for (const a of ALLOWED_STRINGS) t = t.split(a).join(' ');
      const hits = bannedIn(t);
      if (hits.length) problems.push(f.rel + ' line ' + part.line + ': a banned copy word in a string literal (' + hits.join(', ') + ')');
    }
  }
  return problems;
}

/**
 * The directories the build may remove: only this repo's lib/mos-face/dist, by real path. A symlink, a parent, the repo
 * root, a home directory or a path that merely ends alike all fail. opts.repoRoot points a test at a scratch repo.
 */
function assertDistRemovable(dir, opts) {
  const repoRoot = (opts && opts.repoRoot) || REPO_ROOT;
  const want = path.join(repoRoot, 'lib', 'mos-face', 'dist');
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

// ---- walled install -----------------------------------------------------------------------------

/**
 * ui/mos-face/node_modules must be what ui/mos-face/package-lock.json says (npm ci, not npm install, no hand patch):
 * the typescript version equals the lockfile, and every package in the hidden lockfile matches its lock entry.
 * Returns the installed typescript version.
 */
function assertWalledInstall(modDir) {
  const mod = modDir || MOD_DIR;
  const FIX = 'Fix: cd ui/mos-face && npm ci --ignore-scripts';
  const tsPkgPath = path.join(mod, 'node_modules', 'typescript', 'package.json');
  if (!fs.existsSync(tsPkgPath)) throw new Error('ui/mos-face/node_modules is not installed. ' + FIX);
  const lock = (readJson(path.join(mod, 'package-lock.json')).packages) || {};
  const installed = readJson(tsPkgPath).version;
  const locked = lock['node_modules/typescript'] && lock['node_modules/typescript'].version;
  if (!locked || installed !== locked) {
    throw new Error('the installed typescript is ' + installed + ' but ui/mos-face/package-lock.json says ' + locked + '. ' + FIX);
  }
  const hiddenPath = path.join(mod, 'node_modules', '.package-lock.json');
  if (fs.existsSync(hiddenPath)) {
    const hidden = (readJson(hiddenPath).packages) || {};
    const drift = [];
    for (const key of Object.keys(hidden)) {
      const want = lock[key];
      if (!want) { drift.push(key + ' is installed but not in package-lock.json'); continue; }
      for (const field of ['version', 'resolved', 'integrity']) {
        if (want[field] !== hidden[key][field]) drift.push(key + ' ' + field + ' differs from package-lock.json');
      }
    }
    if (drift.length) {
      throw new Error('ui/mos-face/node_modules drifted from package-lock.json (' + drift.length + '): ' + drift.slice(0, 5).join('; ') + '. ' + FIX);
    }
  }
  return installed;
}

// ---- build --------------------------------------------------------------------------------------

/** Append .js to every relative import specifier that has no extension (only used when IMPORT_REWRITE is true). */
function rewriteImports(dir) {
  for (const f of walkFiles(dir)) {
    if (!/\.js$/.test(f.rel) || f.rel.startsWith('assets/')) continue;
    const text = fs.readFileSync(f.abs, 'utf8');
    const out = text
      .replace(/^([ \t]*(?:import|export)\b[^;]*?\bfrom\s*)(['"])(\.{1,2}\/[^'"\n]*)\2/gm, (m, a, q, s) => a + q + (/\.[A-Za-z]+$/.test(s) ? s : s + '.js') + q)
      .replace(/^([ \t]*import\s*)(['"])(\.{1,2}\/[^'"\n]*)\2/gm, (m, a, q, s) => a + q + (/\.[A-Za-z]+$/.test(s) ? s : s + '.js') + q);
    if (out !== text) fs.writeFileSync(f.abs, out);
  }
}

function build() {
  if (process.env[SEAM_ENV]) {
    throw new Error(SEAM_ENV + ' is a test seam for --check only and is set in this environment; unset it to build (the build writes lib/mos-face/dist and nothing else)');
  }
  const tsVersion = assertWalledInstall(MOD_DIR);

  const laid = spawnSync(process.execPath, [path.join(MOD_DIR, 'scripts', 'lay-types.cjs')], { stdio: 'inherit' });
  if (laid.status !== 0) {
    const err = new Error('the engine declaration file could not be laid (see above)');
    err.exitCode = laid.status === 77 ? 77 : 1;
    throw err;
  }

  const src = computeSourceHash();
  console.log('build-mos-face: source hash ' + src.hash.slice(0, 16) + ' over ' + src.fileCount + ' files, typescript ' + tsVersion);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-mos-face-'));
  try {
    const emitDir = path.join(tmp, 'emit');
    const stage = path.join(tmp, 'stage');
    const tsc = path.join(MOD_DIR, 'node_modules', 'typescript', 'bin', 'tsc');
    const r = spawnSync(process.execPath, [tsc, '-p', path.join(MOD_DIR, 'tsconfig.build.json'), '--outDir', emitDir], { cwd: MOD_DIR, stdio: 'inherit' });
    if (r.error || r.status !== 0) throw new Error('tsc failed (exit ' + (r.error ? r.error.message : r.status) + ')');

    fs.mkdirSync(stage, { recursive: true });
    for (const f of walkFiles(emitDir)) {
      if (!/\.js$/.test(f.rel)) throw new Error('the compiler wrote an unexpected file: ' + f.rel);
      fs.mkdirSync(path.dirname(path.join(stage, f.rel)), { recursive: true });
      fs.copyFileSync(f.abs, path.join(stage, f.rel));
    }
    if (IMPORT_REWRITE) rewriteImports(stage);
    fs.mkdirSync(path.join(stage, 'types'), { recursive: true });
    fs.copyFileSync(path.join(MOD_DIR, 'types', 'index.d.ts'), path.join(stage, 'types', 'index.d.ts'));
    fs.mkdirSync(path.join(stage, 'assets'), { recursive: true });
    for (const name of fs.readdirSync(path.join(MOD_DIR, 'assets')).sort()) {
      fs.copyFileSync(path.join(MOD_DIR, 'assets', name), path.join(stage, 'assets', name));
    }

    const problems = verifyOutput(stage);
    if (problems.length) {
      throw new Error('the build output was refused (the committed dist is untouched):\n  - ' + problems.join('\n  - '));
    }

    const map = distFileMap(stage);
    if (map.problems.length) throw new Error('the build output was refused: ' + map.problems.join('; '));
    const manifest = {
      schema: 1,
      builder: BUILDER,
      sourceHash: src.hash,
      typescript: tsVersion,
      importRewrite: IMPORT_REWRITE,
      files: map.files,
    };
    fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

    assertDistRemovable(DIST_DIR);
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(DIST_DIR), { recursive: true });
    fs.cpSync(stage, DIST_DIR, { recursive: true });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  const all = walkFiles(DIST_DIR);
  for (const f of all) console.log('build-mos-face:   ' + f.rel + ' (' + fs.statSync(f.abs).size + ' bytes)');
  console.log('build-mos-face: wrote lib/mos-face/dist (' + all.length + ' files)');
}

function check() {
  // The seam is read here and nowhere else.
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
  if (missing.length || typeof manifest.importRewrite !== 'boolean') {
    console.error(STALE_MESSAGE + ' (manifest lacks ' + missing.concat(typeof manifest.importRewrite !== 'boolean' ? ['importRewrite'] : []).join(', ') + ')');
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

  // The committed bytes are the bytes the build recorded.
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

  // The build's own output rules, re-run on the committed bytes.
  const problems = verifyOutput(distDir);
  if (problems.length) {
    console.error('lib/mos-face/dist fails the build output rules:');
    for (const p of problems) console.error('  - ' + p);
    return 1;
  }
  console.log('build-mos-face: lib/mos-face/dist is fresh (source hash ' + now.hash.slice(0, 16) + ', ' + now.fileCount + ' source files, ' + Object.keys(recorded).length + ' dist files verified)');
  return 0;
}

function usage() {
  return 'usage: node scripts/build-mos-face.cjs [--check]';
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
        console.error('build-mos-face: FAILED: ' + (e && e.message ? e.message : e));
        return e && e.exitCode ? e.exitCode : 1;
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
  readJs,
  bannedIn,
  verifyOutput,
  assertDistRemovable,
  assertWalledInstall,
  distFileMap,
  WORD_RULES,
  ALLOWED_STRINGS,
  REQUIRED_MANIFEST_KEYS,
  STALE_MESSAGE,
  IMPORT_REWRITE,
  DIST_DIR,
};
