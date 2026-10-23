// 380-08 build gate (D-05, MOD380-04, MOD380-01, MOD380-09, T-380-29 to T-380-32, T-380-SC).
//
// The claim: lib/mos-face/dist is built from the walled package ui/mos-face by scripts/build-mos-face.cjs,
// is fresh against the current sources, holds only plain JavaScript modules (plus the type declarations,
// the canon face assets and a manifest), the build tool never ships, and the dist loads in the real
// engine from a folder that holds nothing else.
//
// Legs:
//   B1  node scripts/build-mos-face.cjs --check exits 0 on the committed dist.
//   B2  a changed source byte (in a scratch copy of the package) makes --check exit 1 and name both hashes; a file that is
//       not a source (README, a test) does not; a changed byte of the build script itself does.
//   B3  a changed byte in a copy of a dist file makes --check exit 1 and name the file.
//   B4  an extra file, a missing file and a symlink in a copy of the dist make --check exit 1.
//   B5  the output rules hold on the committed dist (found twice: by the script and by an independent scan here), and
//       each rule catches its planted violation (mutations on a scratch copy), while a comment is not a violation.
//   B6  npm pack --dry-run lists the dist files, no ui/ or tools/ path, no .ts or .tsx file other than a declaration,
//       and not scripts/build-mos-face.cjs.
//   B7  the commit that added the files-array exclusion changed package.json by that one entry and nothing else; the
//       dependency fields are byte-equal.
//   B8  real engine: a throwaway plugin folder that holds only the dist answers /mos-text in claude -p. Exit 77 when
//       claude is missing or not logged in.
//   B9  the build refuses a drifted walled install (typescript version differs from the lockfile), a missing install
//       and a set test seam, and removes nothing; assertDistRemovable accepts only the dist of its own repo.
//   B10 assets: dist/assets holds byte copies of the two canon face files with the pinned sha256 values of
//       tests/test-380-theo-faces.cjs, the manifest lists both, and readFaceAsset reads the asset from the dist path of
//       the BUILT module in a folder that holds no dev assets.
//   B11 the build is reproducible: a build in a scratch copy of the repo gives the committed dist, byte for byte
//       (skipped with a note when the walled install is absent).
//   B12 the manifest has the planned shape.
//   B13 the banned-word list of the build equals the list of tests/test-380-copy.cjs; the dist is not git-ignored;
//       this test and the build script hold no em-dash or en-dash.
//
// CJS, Node built-ins only. Hermetic: every file this test writes sits in a scratch folder; npm and the engine run
// with a scratch HOME. The real home is never passed to a function that writes. Hyphens only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mos-face');
const DIST = path.join(REPO, 'lib', 'mos-face', 'dist');
const BUILD = path.join(REPO, 'scripts', 'build-mos-face.cjs');
const build = require(BUILD);

const JSON_NAME = 'asset-fa8504998f.json';
const JS_NAME = 'asset-d96217b320.js';
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
let engineGap = null;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) { passed += 1; say('  ok ' + msg); } else { failed += 1; say('  FAIL ' + msg); }
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'test-380-build-'));
process.on('exit', () => { try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (e) { /* best effort */ } });
let counter = 0;
function scratch(name) {
  counter += 1;
  const dir = path.join(ROOT, String(counter).padStart(2, '0') + '-' + name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
// A scratch HOME for every child: the real home is never written.
const HOME = scratch('home');
function childEnv(extra) {
  const env = Object.assign({}, process.env, { HOME, USERPROFILE: HOME, MINDRIAN_ROOMS_HOME: path.join(HOME, 'rooms'), npm_config_cache: path.join(HOME, 'npm-cache'), NO_COLOR: '1' });
  for (const k of Object.keys(env)) if (/^(CLAUDE_|CLAUDECODE|BUILD_MOS_FACE)/.test(k)) delete env[k];
  return Object.assign(env, extra || {});
}
function node(args, opts) {
  const o = opts || {};
  return spawnSync(process.execPath, args, { cwd: o.cwd || REPO, env: childEnv(o.env), encoding: 'utf8', timeout: o.timeout || 120000 });
}
function copyTree(from, to, filter) {
  // A missing source (the dist before the first build) gives an empty folder, so the legs fail by assertion, not by crash.
  if (!fs.existsSync(from)) { fs.mkdirSync(to, { recursive: true }); return; }
  fs.cpSync(from, to, { recursive: true, filter: filter || (() => true) });
}
const noModules = (src) => path.basename(src) !== 'node_modules';

// A scratch repo: the build script, a copy of the package (no node_modules) and optionally a copy of the dist.
function scratchRepo(name, withDist) {
  const root = scratch(name);
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.copyFileSync(BUILD, path.join(root, 'scripts', 'build-mos-face.cjs'));
  copyTree(MOD, path.join(root, 'ui', 'mos-face'), noModules);
  if (withDist) copyTree(DIST, path.join(root, 'lib', 'mos-face', 'dist'));
  return root;
}
function listFiles(dir) {
  return build.distFileMap(dir);
}

// ---- B1 ------------------------------------------------------------------------------------
say('B1 fresh');
{
  check(fs.existsSync(path.join(DIST, 'manifest.json')), 'lib/mos-face/dist/manifest.json exists');
  const r = node([BUILD, '--check']);
  check(r.status === 0, '--check exits 0 on the committed dist' + (r.status === 0 ? '' : ' (got ' + r.status + ': ' + (r.stderr || '').slice(0, 300) + ')'));
  check(/is fresh/.test(r.stdout || ''), '--check says the dist is fresh');
}

// ---- B2 ------------------------------------------------------------------------------------
say('B2 stale source');
{
  const root = scratchRepo('b2', true);
  const script = path.join(root, 'scripts', 'build-mos-face.cjs');
  const seam = { BUILD_MOS_FACE_DIST: path.join(root, 'lib', 'mos-face', 'dist') };
  const base = node([script, '--check'], { env: seam });
  check(base.status === 0, 'control: the scratch copy of the repo is fresh (' + base.status + ')');
  fs.appendFileSync(path.join(root, 'ui', 'mos-face', 'README.md'), 'x');
  fs.appendFileSync(path.join(root, 'ui', 'mos-face', 'tests', 'canon.ts'), ' ');
  fs.appendFileSync(path.join(root, 'ui', 'mos-face', 'panel.test.tsx'), ' ');
  const ex = node([script, '--check'], { env: seam });
  check(ex.status === 0, 'a changed README, test file or panel test does not stale the dist (' + ex.status + ')');
  fs.appendFileSync(path.join(root, 'ui', 'mos-face', 'hooks', 'job.ts'), ' ');
  const r = node([script, '--check'], { env: seam });
  check(r.status === 1, 'one changed source byte: --check exits 1 (got ' + r.status + ')');
  check(/recorded [0-9a-f]{16}, current [0-9a-f]{16}/.test(r.stderr || ''), 'the message names the recorded and the current hash');
  check(/lib\/mos-face\/dist is stale/.test(r.stderr || ''), 'the message says the dist is stale');
  const root2 = scratchRepo('b2-self', true);
  fs.appendFileSync(path.join(root2, 'scripts', 'build-mos-face.cjs'), '\n// changed recipe\n');
  const r2 = node([path.join(root2, 'scripts', 'build-mos-face.cjs'), '--check'], { env: { BUILD_MOS_FACE_DIST: path.join(root2, 'lib', 'mos-face', 'dist') } });
  check(r2.status === 1, 'a changed build script stales the dist (got ' + r2.status + ')');
  const root3 = scratchRepo('b2-lock', true);
  fs.appendFileSync(path.join(root3, 'ui', 'mos-face', 'package-lock.json'), ' ');
  const r3 = node([path.join(root3, 'scripts', 'build-mos-face.cjs'), '--check'], { env: { BUILD_MOS_FACE_DIST: path.join(root3, 'lib', 'mos-face', 'dist') } });
  check(r3.status === 1, 'a changed lockfile stales the dist (got ' + r3.status + ')');
}

// ---- B3 and B4 -----------------------------------------------------------------------------
say('B3 stale dist byte');
{
  const copy = scratch('b3');
  copyTree(DIST, copy);
  const file = path.join(copy, 'job.js');
  const buf = fs.readFileSync(file);
  buf[buf.length - 2] = buf[buf.length - 2] === 0x20 ? 0x21 : 0x20;
  fs.writeFileSync(file, buf);
  const r = node([BUILD, '--check'], { env: { BUILD_MOS_FACE_DIST: copy } });
  check(r.status === 1, 'one changed dist byte: --check exits 1 (got ' + r.status + ')');
  check(/job\.js differs from its recorded sha256/.test(r.stderr || ''), 'the message names job.js');
  const asset = scratch('b3-asset');
  copyTree(DIST, asset);
  fs.appendFileSync(path.join(asset, 'assets', JSON_NAME), ' ');
  const r2 = node([BUILD, '--check'], { env: { BUILD_MOS_FACE_DIST: asset } });
  check(r2.status === 1 && new RegExp(JSON_NAME).test(r2.stderr || ''), 'a changed byte of the canon asset copy is caught and named');
}
say('B4 extra and missing');
{
  const extra = scratch('b4-extra');
  copyTree(DIST, extra);
  fs.writeFileSync(path.join(extra, 'extra.js'), 'export const x = 1\n');
  const r = node([BUILD, '--check'], { env: { BUILD_MOS_FACE_DIST: extra } });
  check(r.status === 1 && /extra\.js is in the dist but not recorded/.test(r.stderr || ''), 'an extra file: --check exits 1 and names it (got ' + r.status + ')');
  const gone = scratch('b4-gone');
  copyTree(DIST, gone);
  fs.rmSync(path.join(gone, 'meter.js'));
  const r2 = node([BUILD, '--check'], { env: { BUILD_MOS_FACE_DIST: gone } });
  check(r2.status === 1 && /meter\.js is recorded in the manifest but missing/.test(r2.stderr || ''), 'a missing file: --check exits 1 and names it (got ' + r2.status + ')');
  const link = scratch('b4-link');
  copyTree(DIST, link);
  fs.rmSync(path.join(link, 'bind.js'));
  fs.symlinkSync(path.join(DIST, 'bind.js'), path.join(link, 'bind.js'));
  const r3 = node([BUILD, '--check'], { env: { BUILD_MOS_FACE_DIST: link } });
  check(r3.status === 1, 'a symlink in place of a file: --check exits 1 (got ' + r3.status + ')');
  const none = scratch('b4-none');
  const r4 = node([BUILD, '--check'], { env: { BUILD_MOS_FACE_DIST: none } });
  check(r4.status === 1 && /no manifest\.json/.test(r4.stderr || ''), 'no manifest: --check exits 1');
  const bad = scratch('b4-bad');
  copyTree(DIST, bad);
  fs.writeFileSync(path.join(bad, 'manifest.json'), '{ not json');
  const r5 = node([BUILD, '--check'], { env: { BUILD_MOS_FACE_DIST: bad } });
  check(r5.status === 1 && /does not parse/.test(r5.stderr || ''), 'a manifest that does not parse: --check exits 1');
}

// ---- B5 ------------------------------------------------------------------------------------
say('B5 output rules');
{
  const problems = build.verifyOutput(DIST);
  check(problems.length === 0, 'verifyOutput finds no problem in the committed dist' + (problems.length ? ': ' + problems.slice(0, 3).join('; ') : ''));
  // An independent scan, so the build is not the only judge of its own rules.
  const files = listFiles(DIST).files;
  const names = Object.keys(files);
  const sources = names.filter((n) => /\.(tsx?|mts|cts)$/.test(n) && !/^types\/[^/]+\.d\.ts$/.test(n));
  check(sources.length === 0, 'no .ts or .tsx file (a declaration under types/ is not source)');
  const modules = names.filter((n) => /\.js$/.test(n) && !n.startsWith('assets/'));
  check(modules.length >= 17, 'the dist holds the hook modules (' + modules.length + ')');
  let bad = [];
  for (const n of modules) {
    const text = fs.readFileSync(path.join(DIST, n), 'utf8');
    for (const m of text.matchAll(/^[ \t]*(?:import|export)\b[^;]*?\bfrom\s*(['"])([^'"\n]*)\1/gm)) {
      if (!m[2].startsWith('./') && m[2] !== 'claude-code') bad.push(n + ' imports ' + m[2]);
    }
    if (/^[ \t]*(?:const|let|var)\b.*=\s*require\(/m.test(text)) bad.push(n + ' holds a require call');
  }
  check(bad.length === 0, 'every bare import is claude-code and no module holds a require call' + (bad.length ? ': ' + bad.join('; ') : ''));
  const all = names.map((n) => fs.readFileSync(path.join(DIST, n), 'latin1')).join('\n') + fs.readFileSync(path.join(DIST, 'manifest.json'), 'latin1');
  check(!/\/home\/|\/Users\//.test(all) && !all.includes(REPO), 'no build-machine path in any dist byte');
  check(!all.includes(String.fromCharCode(0xe2, 0x80, 0x94)) && !all.includes(String.fromCharCode(0xe2, 0x80, 0x93)), 'no em-dash or en-dash byte sequence in any dist byte');
  const hosts = new Set();
  for (const n of modules) for (const m of fs.readFileSync(path.join(DIST, n), 'utf8').matchAll(/\bhttps?:\/\/([A-Za-z0-9._-]+)/g)) hosts.add(m[1]);
  check(Array.from(hosts).every((h) => h === 'www.mindrian-os.com'), 'every network host named in a module is www.mindrian-os.com (' + Array.from(hosts).join(', ') + ')');

  // Mutations: each rule catches its planted violation on a scratch copy, and a comment is not a violation.
  function mutate(label, file, content, expect) {
    const copy = scratch('b5-' + label.replace(/[^a-z0-9]+/gi, '-'));
    copyTree(DIST, copy);
    fs.writeFileSync(path.join(copy, file), content);
    const p = build.verifyOutput(copy);
    check(p.some((s) => expect.test(s)), 'mutation: ' + label + ' is refused' + (p.some((s) => expect.test(s)) ? '' : ' (problems: ' + p.join('; ') + ')'));
  }
  mutate('a .ts file', 'zz.ts', 'export const a = 1\n', /TypeScript source file/);
  mutate('a .tsx file', 'zz.tsx', 'export const a = 1\n', /TypeScript source file/);
  mutate('a require call', 'zz.js', 'const fs = require("fs")\n', /require call/);
  mutate('an import call', 'zz.js', 'const m = await import("./x.js")\n', /import\(\) call/);
  mutate('a bare import', 'zz.js', "import { a } from 'lodash'\nexport const b = a\n", /bare import other than claude-code \(lodash\)/);
  mutate('a node: import', 'zz.js', "import fs from 'node:fs'\nexport const b = fs\n", /bare import other than claude-code \(node:fs\)/);
  mutate('a build-machine path', 'zz.js', 'export const p = "/home/someone/x"\n', /build-machine path/);
  mutate('a drive path', 'zz.js', 'export const p = "C:\\\\Users\\\\someone"\n', /build-machine path/);
  mutate('a foreign host', 'zz.js', 'export const u = "https://evil.example.org/x"\n', /host other than www\.mindrian-os\.com \(evil\.example\.org\)/);
  mutate('an em-dash', 'zz.js', 'export const t = "a ' + EM + ' b"\n', /em-dash/);
  mutate('an en-dash', 'zz.js', 'export const t = "a ' + EN + ' b"\n', /en-dash/);
  mutate('a foreign host in a comment (comments are scanned for hosts too)', 'zz.js', '// see https://evil.example.org/x\nexport const a = 1\n', /host other than www\.mindrian-os\.com \(evil\.example\.org\)/);
  mutate('a banned word (Brain)', 'zz.js', 'export const t = "ask the Brain"\n', /banned copy word.*Brain/);
  mutate('a banned word (Larry)', 'zz.js', 'export const t = `hello ${1} Larry`\n', /banned copy word.*Larry/);
  mutate('a banned phrase (supercharge)', 'zz.js', "export const t = 'supercharge it'\n", /banned copy word.*supercharge/);
  mutate('a .map file', 'zz.js.map', '{}', /file kind the dist does not hold/);
  mutate('a path in a renderer asset', path.join('assets', JS_NAME), 'var p = "/home/x/y"\n', /build-machine path/);

  const ok = scratch('b5-controls');
  copyTree(DIST, ok);
  fs.writeFileSync(path.join(ok, 'zz.js'), [
    '// the Brain and Larry and require("x") are only a comment here',
    '/* import("y") em block comment with Brain */',
    'const re = /Brain|require\\(/g',
    'export const f = "/brain-prewarm.json"',
    'export const g = "/mos:brain-derive"',
    'export const h = "https://www.mindrian-os.com/"',
    '',
  ].join('\n'));
  const pc = build.verifyOutput(ok);
  check(pc.length === 0, 'controls: a comment, a regex, a file name, a command name and the allowed host are not violations' + (pc.length ? ' (' + pc.join('; ') + ')' : ''));
}

// ---- B6 ------------------------------------------------------------------------------------
say('B6 tarball');
{
  const pack = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: REPO, env: childEnv(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 300000 });
  if (pack.error && pack.error.code === 'ENOENT') {
    say('  note: npm is not available, the tarball leg is an environment gap');
    check(false, 'npm is available for the tarball leg');
  } else {
    check(pack.status === 0, 'npm pack --dry-run ran' + (pack.status === 0 ? '' : ' (' + (pack.stderr || '').slice(0, 300) + ')'));
    let paths = [];
    try { paths = JSON.parse(pack.stdout.slice(pack.stdout.indexOf('['))) [0].files.map((f) => f.path); } catch (e) { paths = []; }
    check(paths.length > 100, 'the pack list is not empty (' + paths.length + ')');
    const wantDist = Object.keys(listFiles(DIST).files).map((n) => 'lib/mos-face/dist/' + n).concat(['lib/mos-face/dist/manifest.json']);
    const missing = wantDist.filter((p) => !paths.includes(p));
    check(missing.length === 0, 'every dist file is in the tarball (' + wantDist.length + ' files)' + (missing.length ? ': missing ' + missing.slice(0, 3).join(', ') : ''));
    const walled = paths.filter((p) => /^(ui|tools)\//.test(p));
    check(walled.length === 0, 'no path that starts with ui/ or tools/' + (walled.length ? ': ' + walled.slice(0, 3).join(', ') : ''));
    check(!paths.includes('scripts/build-mos-face.cjs'), 'scripts/build-mos-face.cjs is not in the tarball');
    const src = paths.filter((p) => p.startsWith('lib/mos-face/') && /\.(tsx?|mts|cts)$/.test(p) && !/\.d\.ts$/.test(p));
    check(src.length === 0, 'no TypeScript source under lib/mos-face in the tarball');
    check(paths.includes('scripts/build-ui-shell.cjs') === false, 'control: the older build tool exclusion still holds');
  }
}

// ---- B7 ------------------------------------------------------------------------------------
say('B7 root manifest');
{
  const EXCLUSION = '!scripts/build-mos-face.cjs';
  const rootPkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));
  check(Array.isArray(rootPkg.files) && rootPkg.files.filter((f) => f === EXCLUSION).length === 1, 'package.json files holds the exclusion exactly once');
  check(rootPkg.files.indexOf(EXCLUSION) === rootPkg.files.indexOf('!scripts/build-ui-shell.cjs') + 1, 'the exclusion sits beside !scripts/build-ui-shell.cjs');
  const git = (args) => spawnSync('git', ['-C', REPO].concat(args), { encoding: 'utf8', env: childEnv() });
  const intro = git(['log', '--format=%H', '-S' + EXCLUSION, '--', 'package.json']);
  const commits = (intro.stdout || '').split('\n').filter(Boolean);
  let baseText;
  let nextText;
  if (intro.status !== 0) {
    check(false, 'git log ran');
  } else if (commits.length === 0) {
    // Not committed yet: compare the working file with HEAD.
    baseText = git(['show', 'HEAD:package.json']).stdout;
    nextText = fs.readFileSync(path.join(REPO, 'package.json'), 'utf8');
    say('  note: the exclusion is not committed yet; compared with HEAD');
  } else {
    const first = commits[commits.length - 1];
    baseText = git(['show', first + '~1:package.json']).stdout;
    nextText = git(['show', first + ':package.json']).stdout;
    say('  note: compared the introducing commit ' + first.slice(0, 9) + ' with its parent');
  }
  if (baseText !== undefined) {
    const a = JSON.parse(baseText);
    const b = JSON.parse(nextText);
    const keysA = Object.keys(a).sort().join(',');
    const keysB = Object.keys(b).sort().join(',');
    check(keysA === keysB, 'the same top-level keys');
    const others = Object.keys(a).filter((k) => k !== 'files');
    check(others.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k])), 'every field other than files is equal (dependencies, devDependencies, scripts, version)');
    const added = b.files.filter((f) => !a.files.includes(f));
    const removed = a.files.filter((f) => !b.files.includes(f));
    check(added.length === 1 && added[0] === EXCLUSION && removed.length === 0, 'the files array gained exactly the exclusion and lost nothing');
    check(b.files.filter((f) => f !== EXCLUSION).join('|') === a.files.join('|'), 'the other files entries keep their order');
    const lineDiff = nextText.split('\n').filter((l) => !baseText.split('\n').includes(l));
    check(lineDiff.length === 1, 'one added line in the text of package.json (' + lineDiff.length + ')');
  }
  const sw = git(['diff', '--name-only', 'HEAD', '--', 'npm-shrinkwrap.json']);
  check((sw.stdout || '').trim() === '', 'npm-shrinkwrap.json has no uncommitted change');
}

// ---- B10 (before the engine leg: it uses the same copy) --------------------------------------
say('B10 assets');
{
  const faces = fs.readFileSync(path.join(REPO, 'tests', 'test-380-theo-faces.cjs'), 'utf8');
  const pin = (name) => {
    const m = faces.match(new RegExp("\\[" + name.replace(/_/g, '_') + "\\]:\\s*'([0-9a-f]{64})'"));
    return m ? m[1] : null;
  };
  const pins = { [JSON_NAME]: pin('JSON_NAME'), [JS_NAME]: pin('JS_NAME') };
  check(pins[JSON_NAME] !== null && pins[JS_NAME] !== null, 'the pins were read from tests/test-380-theo-faces.cjs');
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
  for (const name of [JSON_NAME, JS_NAME]) {
    const copy = path.join(DIST, 'assets', name);
    check(fs.existsSync(copy) && sha(fs.readFileSync(copy)) === pins[name], 'dist/assets/' + name + ' has the pinned sha256');
    check(fs.existsSync(copy) && fs.readFileSync(copy).equals(fs.readFileSync(path.join(MOD, 'assets', name))), 'dist/assets/' + name + ' is a byte copy of ui/mos-face/assets/' + name);
    check(manifest.files && manifest.files['assets/' + name] === pins[name], 'the manifest lists assets/' + name + ' with the same sha256');
  }
  const inAssets = fs.readdirSync(path.join(DIST, 'assets')).sort();
  check(inAssets.join(',') === [JS_NAME, JSON_NAME].sort().join(','), 'dist/assets holds exactly the two canon files (' + inAssets.join(', ') + ')');

  // The BUILT module reads the asset from the dist path, in a plugin root that holds no dev assets.
  const root = scratch('b10-root');
  copyTree(path.join(DIST, 'assets'), path.join(root, 'lib', 'mos-face', 'dist', 'assets'));
  const modDir = scratch('b10-mod');
  fs.copyFileSync(path.join(DIST, 'theo-face.js'), path.join(modDir, 'theo-face.mjs'));
  const world = (pluginRoot) => ({
    plugin: { root: pluginRoot },
    fs: { read: (p) => fs.promises.readFile(p, 'utf8') },
  });
  import(pathToFileURL(path.join(modDir, 'theo-face.mjs')).href).then(async (face) => {
    check(Array.isArray(face.FACE_ASSET_PATHS) && face.FACE_ASSET_PATHS[1] === 'lib/mos-face/dist/assets/' + JSON_NAME, 'the built module names the dist path as its second place');
    check(!fs.existsSync(path.join(root, 'assets')), 'the scratch plugin root holds no dev assets folder');
    const got = await face.readFaceAsset(world(root));
    check(got.asset !== null && got.path === 'lib/mos-face/dist/assets/' + JSON_NAME, 'readFaceAsset of the built module reads the asset from the dist path (' + got.path + ')');
    check(got.asset !== null && got.asset.states.length === 11, 'the asset read from the dist path has the 11 canon states');
    const dev = scratch('b10-dev');
    copyTree(path.join(MOD, 'assets'), path.join(dev, 'assets'));
    const gotDev = await face.readFaceAsset(world(dev));
    check(gotDev.path === 'assets/' + JSON_NAME, 'with a dev folder present the dev path wins (' + gotDev.path + ')');
    const damaged = scratch('b10-damaged');
    fs.mkdirSync(path.join(damaged, 'lib', 'mos-face', 'dist', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(damaged, 'lib', 'mos-face', 'dist', 'assets', JSON_NAME), '{"states": []}');
    const gotBad = await face.readFaceAsset(world(damaged));
    check(gotBad.asset === null && gotBad.path === null && gotBad.reason !== '', 'a damaged dist asset gives no face and a plain reason');
    const empty = scratch('b10-empty');
    const gotNone = await face.readFaceAsset(world(empty));
    check(gotNone.asset === null && gotNone.reason !== '', 'no asset at all gives no face and a plain reason');
    finish();
  }).catch((e) => {
    check(false, 'the built theo-face module loads in Node (' + (e && e.message ? e.message : e) + ')');
    finish();
  });
}

// The remaining legs run in finish(), after the asynchronous import of B10.
function finish() {
  b8();
  b9();
  b11();
  b12();
  b13();
  say('');
  say('test-380-build: passed=' + passed + ' failed=' + failed + (engineGap ? ' engine=ENV GAP (' + engineGap + ')' : ''));
  if (failed > 0) process.exit(1);
  if (engineGap) process.exit(77);
  process.exit(0);
}

// ---- B8 ------------------------------------------------------------------------------------
function b8() {
  say('B8 real engine');
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], { encoding: 'utf8' });
  if (which.status !== 0) { engineGap = 'the claude CLI is not on PATH'; say('  SKIPPED: ' + engineGap); return; }
  // The login file is read through a symlink in a scratch config folder; nothing is written in the real config folder.
  const realConfig = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const credentials = path.join(realConfig, '.credentials.json');
  if (!fs.existsSync(credentials)) { engineGap = 'no Claude login file'; say('  SKIPPED: ' + engineGap); return; }

  const base = scratch('b8');
  const plugin = path.join(base, 'plugin');
  fs.mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(plugin, 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mos-face', version: '0.1.0', description: 'The face panel, loaded from the built files only.' }, null, 2) + '\n');
  fs.writeFileSync(path.join(plugin, 'hooks', 'hooks.json'), JSON.stringify({ modules: ['../lib/mos-face/dist/register.js'] }) + '\n');
  copyTree(DIST, path.join(plugin, 'lib', 'mos-face', 'dist'));
  const top = fs.readdirSync(plugin).sort().join(',');
  check(top === '.claude-plugin,hooks,lib', 'the throwaway plugin folder holds only the manifest, the hooks file and the dist (' + top + ')');

  const cfg = path.join(base, 'config');
  fs.mkdirSync(cfg, { recursive: true });
  fs.symlinkSync(credentials, path.join(cfg, '.credentials.json'));
  const work = path.join(base, 'work');
  fs.mkdirSync(work, { recursive: true });
  fs.writeFileSync(path.join(cfg, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, theme: 'dark', numStartups: 1 }) + '\n');

  const env = childEnv({ CLAUDE_CONFIG_DIR: cfg });
  const r = spawnSync('claude', ['-p', '/mos-text', '--plugin-dir', plugin], { cwd: work, env, encoding: 'utf8', timeout: 180000, input: '' });
  const out = String(r.stdout || '') + '\n' + String(r.stderr || '');
  if (/not logged in|please run \/login|invalid api key|authentication/i.test(out) && !/\/m:os state/.test(out)) {
    engineGap = 'claude is not logged in'; say('  SKIPPED: ' + engineGap); return;
  }
  const scrubbed = out.split(base).join('BASE').split(HOME).join('HOME');
  const line = scrubbed.split('\n').find((l) => l.includes('/m:os state')) || '';
  say('  engine line: ' + (line || '(none)'));
  check(r.status === 0, 'claude -p /mos-text exits 0 (got ' + r.status + ')');
  check(line !== '', 'the output holds a line with /m:os state, printed by the dist module');
  check(/WRITES TO:/.test(out) && /NEXT:/.test(out), 'the output holds the WRITES TO and NEXT lines of the panel text');
  if (line === '') say('  engine output (first 600 characters): ' + scrubbed.slice(0, 600).replace(/\n/g, ' | '));
}

// ---- B9 ------------------------------------------------------------------------------------
function b9() {
  say('B9 refuse a drifted walled install');
  const script = (root) => path.join(root, 'scripts', 'build-mos-face.cjs');
  const sentinelOf = (root) => {
    const dist = path.join(root, 'lib', 'mos-face', 'dist');
    fs.mkdirSync(dist, { recursive: true });
    fs.writeFileSync(path.join(dist, 'sentinel.txt'), 'keep');
    return path.join(dist, 'sentinel.txt');
  };
  // A node_modules that holds a typescript of the wrong version.
  const root = scratchRepo('b9-drift', false);
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'ui', 'mos-face', 'package-lock.json'), 'utf8'));
  const locked = lock.packages['node_modules/typescript'].version;
  const nm = path.join(root, 'ui', 'mos-face', 'node_modules', 'typescript');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), JSON.stringify({ name: 'typescript', version: '0.0.1' }));
  const keep = sentinelOf(root);
  const r = node([script(root)]);
  check(r.status === 1, 'a typescript of another version: the build exits 1 (got ' + r.status + ')');
  check(/installed typescript is 0\.0\.1 but .*package-lock\.json says /.test(r.stderr || '') && (r.stderr || '').includes(locked), 'the message names both versions');
  check(/npm ci --ignore-scripts/.test(r.stderr || ''), 'the message names the one fix');
  check(fs.existsSync(keep), 'the committed dist of the scratch repo is untouched');

  const root2 = scratchRepo('b9-missing', false);
  const keep2 = sentinelOf(root2);
  const r2 = node([script(root2)]);
  check(r2.status === 1 && /npm ci --ignore-scripts/.test(r2.stderr || ''), 'no node_modules: the build exits 1 and prints the one fix');
  check(fs.existsSync(keep2), 'the dist is untouched when node_modules is missing');

  const root3 = scratchRepo('b9-seam', true);
  const r3 = node([script(root3)], { env: { BUILD_MOS_FACE_DIST: path.join(root3, 'lib', 'mos-face', 'dist') } });
  check(r3.status === 1 && /test seam for --check only/.test(r3.stderr || ''), 'with the test seam set the build refuses');

  // The hidden lockfile of the install must match the lock entries.
  const root4 = scratchRepo('b9-hidden', false);
  const nm4 = path.join(root4, 'ui', 'mos-face', 'node_modules');
  fs.mkdirSync(path.join(nm4, 'typescript'), { recursive: true });
  fs.writeFileSync(path.join(nm4, 'typescript', 'package.json'), JSON.stringify({ name: 'typescript', version: locked }));
  fs.writeFileSync(path.join(nm4, '.package-lock.json'), JSON.stringify({ packages: { 'node_modules/typescript': { version: locked, resolved: 'https://example.invalid/x.tgz', integrity: 'sha512-none' } } }));
  const r4 = node([script(root4)]);
  check(r4.status === 1 && /drifted from package-lock\.json/.test(r4.stderr || ''), 'a hidden lockfile that differs from package-lock.json: the build exits 1');

  // assertDistRemovable: only the dist of its own repo, by real path.
  const repo = scratch('b9-removable');
  const own = path.join(repo, 'lib', 'mos-face', 'dist');
  fs.mkdirSync(own, { recursive: true });
  const refuses = (dir, label) => {
    let threw = false;
    try { build.assertDistRemovable(dir, { repoRoot: repo }); } catch (e) { threw = /refusing to remove/.test(e.message); }
    check(threw, 'assertDistRemovable refuses ' + label);
  };
  let ok = true;
  try { build.assertDistRemovable(own, { repoRoot: repo }); } catch (e) { ok = false; }
  check(ok, 'assertDistRemovable accepts the dist of its own repo');
  refuses(repo, 'the repo root');
  refuses(path.join(repo, 'lib'), 'the lib folder');
  refuses(path.join(repo, 'lib', 'ui-shell', 'dist'), 'the other dist');
  refuses(HOME, 'a home folder (the scratch one)');
  refuses(os.tmpdir(), 'the temp folder');
  const alias = path.join(repo, 'alias');
  fs.symlinkSync(os.tmpdir(), alias);
  refuses(alias, 'a symlink to another folder');
  refuses(path.join(repo, 'x', 'lib', 'mos-face', 'dist'), 'a path that only ends alike');
}

// ---- B11 -----------------------------------------------------------------------------------
function b11() {
  say('B11 reproducible build');
  const nm = path.join(MOD, 'node_modules');
  if (!fs.existsSync(path.join(nm, 'typescript', 'package.json'))) {
    say('  note: ui/mos-face/node_modules is absent; the reproducibility leg needs the walled install (cd ui/mos-face && npm ci --ignore-scripts) and is skipped');
    return;
  }
  const root = scratchRepo('b11', false);
  fs.symlinkSync(nm, path.join(root, 'ui', 'mos-face', 'node_modules'));
  const r = node([path.join(root, 'scripts', 'build-mos-face.cjs')], { timeout: 240000 });
  check(r.status === 0, 'a build in a scratch copy of the repo exits 0' + (r.status === 0 ? '' : ' (' + (r.stderr || r.stdout || '').slice(0, 400) + ')'));
  const built = path.join(root, 'lib', 'mos-face', 'dist');
  const a = listFiles(built);
  const b = listFiles(DIST);
  check(JSON.stringify(a.files) === JSON.stringify(b.files), 'the scratch build holds the same files with the same sha256 as the committed dist');
  check(fs.existsSync(path.join(built, 'manifest.json')) && fs.readFileSync(path.join(built, 'manifest.json'), 'utf8') === fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'), 'the scratch manifest equals the committed manifest');
  const again = node([path.join(root, 'scripts', 'build-mos-face.cjs')], { timeout: 240000 });
  check(again.status === 0 && JSON.stringify(listFiles(built).files) === JSON.stringify(a.files), 'a second build gives the same bytes');
  check(build.verifyOutput(built).length === 0, 'the scratch build passes the output rules');
}

// ---- B12 -----------------------------------------------------------------------------------
function b12() {
  say('B12 manifest');
  const m = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
  check(m.schema === 1, 'schema is 1');
  check(m.builder === 'scripts/build-mos-face.cjs', 'builder names the script');
  check(/^[0-9a-f]{64}$/.test(m.sourceHash || ''), 'sourceHash is a sha256');
  const lock = JSON.parse(fs.readFileSync(path.join(MOD, 'package-lock.json'), 'utf8'));
  check(m.typescript === lock.packages['node_modules/typescript'].version, 'typescript equals the lockfile (' + m.typescript + ')');
  check(typeof m.importRewrite === 'boolean' && m.importRewrite === build.IMPORT_REWRITE, 'importRewrite is a boolean equal to the script switch (' + m.importRewrite + ')');
  const keys = Object.keys(m.files || {});
  check(keys.length > 0 && keys.join('|') === keys.slice().sort().join('|'), 'files are listed in sorted order');
  check(!keys.includes('manifest.json'), 'the manifest does not list itself');
  check(!Object.prototype.hasOwnProperty.call(m, 'builtAt'), 'no timestamp, so a rebuild is byte-identical');
  const expected = ['advice', 'bind', 'commands', 'face', 'glossary', 'lines', 'meter', 'paths', 'probe', 'source', 'voice', 'register'];
  check(expected.every((n) => keys.includes(n + '.js')), 'plain .js modules exist for register, advice, bind, commands, face, glossary, lines, meter, paths, probe, source and voice');
  check(keys.includes('types/index.d.ts'), 'the type declarations are copied to types/index.d.ts');
  check(fs.readFileSync(path.join(DIST, 'types', 'index.d.ts')).equals(fs.readFileSync(path.join(MOD, 'types', 'index.d.ts'))), 'types/index.d.ts is a byte copy of the package declarations');
  check(!keys.some((k) => /\.(tsx?|map)$/.test(k) && !/\.d\.ts$/.test(k)), 'no .ts, .tsx or .map entry in the manifest');
}

// ---- B13 -----------------------------------------------------------------------------------
function b13() {
  say('B13 word list, ignore, dash fence');
  const copyTest = fs.readFileSync(path.join(REPO, 'tests', 'test-380-copy.cjs'), 'utf8');
  const block = copyTest.slice(copyTest.indexOf('const WORD_RULES = ['), copyTest.indexOf('];', copyTest.indexOf('const WORD_RULES = [')));
  const namesCopy = Array.from(block.matchAll(/^\s*\['([^']+)',\s*(\/.*\/[a-z]*)\],?\s*$/gm)).map((m) => m[1] + ' ' + m[2]);
  const namesBuild = build.WORD_RULES.map((r) => r[0] + ' ' + String(r[1]));
  check(namesCopy.length >= 15 && namesCopy.join('\n') === namesBuild.join('\n'), 'the banned-word list of the build equals the list of tests/test-380-copy.cjs (' + namesBuild.length + ' rules)');
  const allowedCopy = Array.from(copyTest.matchAll(/\{ file: '[a-z.]+', text: '([^']+)' \}/g)).map((m) => m[1]);
  check(allowedCopy.length > 0 && allowedCopy.every((a) => build.ALLOWED_STRINGS.includes(a)) && build.ALLOWED_STRINGS.length === allowedCopy.length, 'the allowed file-name strings equal the list of tests/test-380-copy.cjs');
  // git check-ignore -q takes one path at a time: exit 1 = not ignored.
  const notIgnored = ['lib/mos-face/dist/register.js', 'lib/mos-face/dist/manifest.json', 'lib/mos-face/dist/assets/' + JSON_NAME, 'lib/mos-face/dist/types/index.d.ts']
    .map((p) => spawnSync('git', ['-C', REPO, 'check-ignore', '-q', p], { encoding: 'utf8' }).status);
  check(notIgnored.every((c) => c === 1), 'no dist file is git-ignored (' + notIgnored.join(',') + ')');
  for (const f of [BUILD, __filename]) {
    const t = fs.readFileSync(f, 'utf8');
    check(!t.includes(EM) && !t.includes(EN), path.basename(f) + ' holds no em-dash or en-dash');
  }
}
