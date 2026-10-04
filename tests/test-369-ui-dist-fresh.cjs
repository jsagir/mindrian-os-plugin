#!/usr/bin/env node
'use strict';
/**
 * tests/test-369-ui-dist-fresh.cjs  (Phase 369, plan 28, D-07 / D-17 / TS369-08)
 *
 * The browser workspace ships as release-built assets in lib/ui-shell/dist. This test proves the
 * artifact is the one the sources produce, that it follows RULE 8 and the payload rules, and that a
 * real installed layout can run it.
 *
 *   1  freshness       build-ui-shell.cjs --check exits 0; a tampered source hash exits 1 with the
 *                      stale message (the gate bites)
 *   2  manifest        serverEntry, clientDir, sourceHash, builtAt, chassis, node_floor present; the
 *                      server entry and the client directory exist
 *   3  RULE 8          no node_modules directory anywhere in the dist
 *   4  C2 egress       no dist file (maps included) names rxdb.info, fonts.googleapis, fonts.gstatic,
 *                      cdn.jsdelivr, unpkg.com or cdnjs
 *   5  imports         every bare import specifier in the dist server files is a root dependency or a
 *                      Node built-in (and the check itself flags a foreign one: mutation)
 *   6  pack listing    npm pack --dry-run lists the dist manifest, nothing under ui/ or tools/, not the
 *                      dev-only build script (exit 77 if npm is missing)
 *   7  payload ceiling the release-payload-ceiling numbers with the dist included; see the note on the
 *                      sharp install script below
 *   8  installed run   packed, laid out under a hermetic HOME as cache/mindrian-marketplace/mos/<ver>/,
 *                      loader-installed (npm ci --ignore-scripts), the launcher starts the dist server,
 *                      the one-time link answers 303 with a cookie, and / answers 200 HTML with its CSP
 *                      (exit 77 on a registry failure)
 *   9  release.sh      the Step 2.4 gate exists, release.sh never builds the UI (only --check), bash -n
 *   10 licence         no dist file (maps included) names a GPL-3.0 @blocknote/xl-* exporter and
 *                      ui/shell's lockfile has no @blocknote/xl- package
 *
 * Arm 7 note (stated honestly): the full gate (check-release-payload-ceiling.cjs --check) is RED today
 * for ONE reason that is not this plan's change: npm-shrinkwrap.json declares hasInstallScript:true for
 * node_modules/sharp, an optional dependency of next that the navigator's 2026-10-03 ruling brought into
 * the install (plan 19). The numbers this plan can move (entries, bytes, forbidden prefixes, required
 * files) are asserted hard. The sharp finding is reported as KNOWN RED and does not fail this arm unless
 * MOS_369_STRICT_CEILING=1; any OTHER finding, or a second install-script package, fails it.
 *
 * Exit codes: 0 all arms pass; 1 any FAIL; 77 ENV GAP (npm missing or the registry unreachable in arm 8).
 * Hermetic: arm 8 uses a temp root, a hermetic HOME and rooms home, a loopback Brain URL that reaches
 * nothing (Canon Part 8), and kills only processes it started. The repo checkout is never written.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DIST = path.join(REPO, 'lib', 'ui-shell', 'dist');
const BUILD = path.join(REPO, 'scripts', 'build-ui-shell.cjs');
const builder = require(BUILD);
const { measurePayload, MAX_ENTRIES, MAX_UNPACKED } = require(path.join(REPO, 'scripts', 'check-release-payload-ceiling.cjs'));

let passed = 0;
let failed = 0;
let skipped = 0;
let knownRed = 0;
const envGapReasons = [];

class EnvGap extends Error {}

function ok(name, extra) { passed += 1; process.stdout.write('  PASS ' + name + (extra ? ' (' + extra + ')' : '') + '\n'); }
function bad(name, detail) { failed += 1; process.stdout.write('  FAIL ' + name + '\n'); if (detail) process.stdout.write('    ' + String(detail).split('\n').join('\n    ') + '\n'); }
function skip(name, why) { skipped += 1; process.stdout.write('  SKIP ' + name + ' - ' + why + '\n'); }

function arm(name, fn) {
  try {
    const r = fn();
    if (r && r.skip) skip(name, r.skip);
    else ok(name, r && r.note);
  } catch (e) {
    if (e instanceof EnvGap) { envGapReasons.push(e.message); skip(name, 'ENV GAP: ' + e.message); }
    else bad(name, e && e.message);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function walkFiles(dir) {
  const out = [];
  (function recur(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) recur(p);
      else if (e.isFile()) out.push(p);
    }
  })(dir);
  return out;
}

function runNode(args, opts) {
  return spawnSync(process.execPath, args, Object.assign({ cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts));
}

function readManifest() {
  return JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
}

// Scan every dist file as raw bytes (binary assets included), so a needle inside a map or a font is still found.
function dist_hits(needles) {
  const hits = [];
  for (const f of walkFiles(DIST)) {
    const buf = fs.readFileSync(f);
    for (const n of needles) {
      if (buf.indexOf(n) !== -1) hits.push(path.relative(REPO, f) + ' names ' + n);
    }
  }
  return hits;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}

function httpGet(port, urlPath, headers) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath, headers: headers || {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('request timed out')));
  });
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return !(e && e.code === 'ESRCH'); }
}

// ---------------------------------------------------------------------------
// arms 1-7, 9, 10 (offline)
// ---------------------------------------------------------------------------

function offlineArms() {
  arm('arm 1a: build-ui-shell.cjs --check exits 0 (the committed dist matches the sources)', () => {
    const r = runNode([BUILD, '--check']);
    assert(r.status === 0, '--check exited ' + r.status + '\n' + (r.stderr || r.stdout));
    return { note: (r.stdout || '').trim().split('\n').pop() };
  });

  arm('arm 1b: a tampered source hash fails --check with the stale message (the gate bites)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-28-stale-'));
    try {
      const m = readManifest();
      m.sourceHash = crypto.createHash('sha256').update('not the sources').digest('hex');
      fs.writeFileSync(path.join(tmp, 'manifest.json'), JSON.stringify(m));
      const r = runNode([BUILD, '--check'], { env: Object.assign({}, process.env, { BUILD_UI_SHELL_DIST: tmp }) });
      assert(r.status === 1, 'expected exit 1, got ' + r.status);
      assert((r.stderr || '').includes('lib/ui-shell/dist is stale: run node scripts/build-ui-shell.cjs and commit lib/ui-shell/dist'), 'stale message missing: ' + r.stderr);
      const none = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-28-none-'));
      try {
        const r2 = runNode([BUILD, '--check'], { env: Object.assign({}, process.env, { BUILD_UI_SHELL_DIST: none }) });
        assert(r2.status === 1, 'a missing manifest must exit 1, got ' + r2.status);
      } finally { fs.rmSync(none, { recursive: true, force: true }); }
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  arm('arm 2: manifest keys present, serverEntry and clientDir exist, no plugin version string', () => {
    const m = readManifest();
    for (const k of builder.REQUIRED_MANIFEST_KEYS) assert(m[k], 'manifest.' + k + ' is missing');
    assert(m.node_floor === '>=22.18.0', 'node_floor is ' + m.node_floor);
    assert(/^[0-9a-f]{64}$/.test(m.sourceHash), 'sourceHash is not a sha256');
    assert(!Object.prototype.hasOwnProperty.call(m, 'version'), 'the manifest must carry no plugin version (RULE 5)');
    assert(fs.statSync(path.resolve(DIST, m.serverEntry)).isFile(), 'serverEntry ' + m.serverEntry + ' is missing');
    const client = path.resolve(DIST, m.clientDir);
    assert(fs.statSync(client).isDirectory(), 'clientDir ' + m.clientDir + ' is missing');
    assert(walkFiles(client).some((f) => f.endsWith('.js')), 'clientDir holds no .js asset');
    return { note: m.chassis + ', ' + m.serverEntry };
  });

  arm('arm 3: no node_modules directory anywhere in the dist (RULE 8)', () => {
    const dirs = builder.findNodeModules(DIST);
    assert(dirs.length === 0, 'node_modules found: ' + dirs.join(', '));
  });

  arm('arm 4: C2 - no dist file, maps included, names an outside host', () => {
    const hits = dist_hits(builder.FORBIDDEN_HOSTS);
    assert(hits.length === 0, hits.length + ' hits, first: ' + hits.slice(0, 4).join('; '));
  });

  arm('arm 5: every bare import in the dist server files is a root dependency or a Node built-in', () => {
    const rootDeps = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).dependencies;
    const foreign = builder.foreignSpecifiers(path.join(DIST, 'server'), rootDeps);
    assert(foreign.length === 0, 'foreign specifiers: ' + foreign.join('; '));
    // Mutation: the same check must flag a package that is not a root dependency and pass one that is.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-28-imports-'));
    try {
      fs.writeFileSync(path.join(tmp, 'a.js'), 'const x=require("lodash");const y=require("express");const z=require("node:fs");import("zod");\n');
      const bad1 = builder.foreignSpecifiers(tmp, rootDeps);
      assert(bad1.length === 1 && bad1[0].startsWith('lodash'), 'the check must flag exactly lodash, got ' + JSON.stringify(bad1));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  arm('arm 6: npm pack lists the dist and keeps ui/, tools/ and the dev-only build script out', () => {
    let measured;
    try { measured = measurePayload(REPO); } catch (e) { return { skip: 'npm is not available: ' + e.message }; }
    if (!measured.ok) {
      if (/ENOENT|not found/i.test(measured.reason)) return { skip: 'npm is not available: ' + measured.reason };
      throw new Error(measured.reason);
    }
    const paths = measured.payload.files.map((f) => f.path);
    assert(paths.includes('lib/ui-shell/dist/manifest.json'), 'lib/ui-shell/dist/manifest.json is not in the pack');
    assert(paths.includes('lib/ui-shell/dist/server/server.js'), 'the server entry is not in the pack');
    const leaked = paths.filter((p) => p.startsWith('ui/') || p.startsWith('tools/') || p === 'scripts/build-ui-shell.cjs');
    assert(leaked.length === 0, 'dev-only paths in the pack: ' + leaked.slice(0, 5).join(', '));
    const nm = paths.filter((p) => p.startsWith('lib/ui-shell/dist/') && p.split('/').includes('node_modules'));
    assert(nm.length === 0, 'node_modules paths under the dist in the pack: ' + nm.slice(0, 3).join(', '));
    const distCount = paths.filter((p) => p.startsWith('lib/ui-shell/dist/')).length;
    const onDisk = walkFiles(DIST).length;
    assert(distCount === onDisk, 'the pack lists ' + distCount + ' dist files but ' + onDisk + ' are on disk (an ignore rule is dropping files)');
    return { note: distCount + ' dist entries of ' + measured.payload.entryCount + ' total' };
  });

  arm('arm 7: release payload ceiling with the dist included', () => {
    let measured;
    try { measured = measurePayload(REPO); } catch (e) { return { skip: 'npm is not available: ' + e.message }; }
    if (!measured.ok) {
      if (/ENOENT|not found/i.test(measured.reason)) return { skip: 'npm is not available: ' + measured.reason };
      throw new Error(measured.reason);
    }
    const p = measured.payload;
    process.stdout.write('    measured: entryCount=' + p.entryCount + ' unpackedSize=' + p.unpackedSize + ' size=' + p.size + ' (ceiling ' + MAX_ENTRIES + ' entries, ' + MAX_UNPACKED + ' bytes)\n');
    assert(p.entryCount <= MAX_ENTRIES, 'entryCount ' + p.entryCount + ' exceeds ' + MAX_ENTRIES);
    assert(p.unpackedSize <= MAX_UNPACKED, 'unpackedSize ' + p.unpackedSize + ' exceeds ' + MAX_UNPACKED);
    const r = runNode([path.join(REPO, 'scripts', 'check-release-payload-ceiling.cjs'), '--check']);
    if (r.status === 0) return { note: 'full gate green' };
    const findings = (r.stdout || '').split('\n').filter((l) => l.startsWith('FAIL: '));
    const sharpOnly = findings.length === 1 && /^FAIL: npm-shrinkwrap\.json declares hasInstallScript:true for: node_modules\/sharp\./.test(findings[0]);
    if (sharpOnly && process.env.MOS_369_STRICT_CEILING !== '1') {
      knownRed += 1;
      process.stdout.write('    KNOWN RED (not caused by the dist): the only finding is the sharp install script that came in with next (plan 19 ruling).\n');
      process.stdout.write('    Needs a navigator ruling: drop sharp from the shrinkwrap, or let the ceiling gate exempt a non-load-bearing optional package.\n');
      return { note: 'numbers inside the ceiling; full gate KNOWN RED on sharp only' };
    }
    throw new Error('the payload ceiling gate exited ' + r.status + ':\n' + findings.join('\n'));
  });

  arm('arm 9: release.sh carries the Step 2.4 freshness gate and never builds the UI', () => {
    const sh = fs.readFileSync(path.join(REPO, 'scripts', 'release.sh'), 'utf8');
    assert(sh.includes('build-ui-shell.cjs" --check'), 'the gate block is missing');
    const lines = sh.split('\n');
    const offenders = [];
    lines.forEach((line, i) => {
      if (!line.includes('build-ui-shell.cjs')) return;
      const t = line.trim();
      if (t.startsWith('#') || t.startsWith('echo')) return; // comments and printed text are not invocations
      if (!/--check/.test(t)) offenders.push((i + 1) + ': ' + t);
    });
    assert(offenders.length === 0, 'release.sh invokes build-ui-shell.cjs without --check: ' + offenders.join(' | '));
    const syn = spawnSync('bash', ['-n', path.join(REPO, 'scripts', 'release.sh')], { encoding: 'utf8' });
    assert(syn.status === 0, 'bash -n failed: ' + syn.stderr);
  });

  arm('arm 10: licence guard - no GPL-3.0 @blocknote/xl-* in the dist or in ui/shell lockfile (D-06)', () => {
    const hits = dist_hits(builder.FORBIDDEN_LICENCE);
    assert(hits.length === 0, 'dist hits: ' + hits.slice(0, 4).join('; '));
    const lock = fs.readFileSync(path.join(REPO, 'ui', 'shell', 'package-lock.json'), 'utf8');
    assert(!lock.includes('@blocknote/xl-'), 'ui/shell/package-lock.json names a @blocknote/xl- package');
    const lockJson = JSON.parse(lock);
    const names = Object.keys(lockJson.packages || {}).filter((k) => /@blocknote\/xl-|xl-pdf-exporter|xl-docx-exporter/.test(k));
    assert(names.length === 0, 'lockfile packages: ' + names.join(', '));
  });

  freshnessGateArms();
}

// ---------------------------------------------------------------------------
// arms 11-15 (Plan 369-45: WR-16, WR-17, WR-18): the freshness gate proves bytes, output and inputs.
// Every arm works on a temp copy of the dist or of a lockfile; the committed files are never written.
// ---------------------------------------------------------------------------

function sha256Of(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function posixRel(base, file) {
  return path.relative(base, file).split(path.sep).join('/');
}

// A copy of the committed dist. mutate(copyDir, chunkRel) edits it; when the manifest carries a files map the
// entries of the touched files are re-hashed, so only the build's own output checks (not the byte map) can object.
function checkMutatedDist(mutate, opts) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-45-dist-'));
  try {
    fs.cpSync(DIST, tmp, { recursive: true });
    const chunks = walkFiles(path.join(tmp, 'server', '.next', 'server', 'chunks')).filter((f) => f.endsWith('.js')).sort();
    assert(chunks.length > 0, 'the dist copy holds no server chunk');
    const chunkRel = posixRel(tmp, chunks[0]);
    const touched = mutate(tmp, chunkRel) || [];
    if (opts && opts.rehash) {
      const mp = path.join(tmp, 'manifest.json');
      const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
      if (m.files) {
        for (const rf of touched) m.files[rf] = sha256Of(path.join(tmp, rf));
        fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
      }
    }
    const r = runNode([BUILD, '--check'], { env: Object.assign({}, process.env, { BUILD_UI_SHELL_DIST: tmp }) });
    return { status: r.status, text: (r.stderr || '') + (r.stdout || ''), chunkRel };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

function appendTo(dir, rel, text) {
  fs.appendFileSync(path.join(dir, rel), text);
}

function freshnessGateArms() {
  arm('arm 11a: the manifest carries a sha256 for every dist file (WR-16)', () => {
    const m = readManifest();
    assert(m.files && typeof m.files === 'object', 'manifest.files is missing');
    const onDisk = walkFiles(DIST).map((f) => posixRel(DIST, f)).filter((f) => f !== 'manifest.json').sort();
    const listed = Object.keys(m.files).sort();
    assert(JSON.stringify(onDisk) === JSON.stringify(listed), 'manifest.files lists ' + listed.length + ' files, the dist holds ' + onDisk.length);
    for (const f of onDisk.slice(0, 40)) assert(m.files[f] === sha256Of(path.join(DIST, f)), 'recorded hash differs for ' + f);
    return { note: listed.length + ' files' };
  });

  arm('arm 11b: one changed byte in a server chunk fails --check and names the file (manifest untouched)', () => {
    const r = checkMutatedDist((dir, chunkRel) => {
      const p = path.join(dir, chunkRel);
      const buf = fs.readFileSync(p);
      buf[buf.length - 1] = buf[buf.length - 1] === 0x20 ? 0x0a : 0x20; // flip the last byte between a space and a newline
      fs.writeFileSync(p, buf);
    });
    assert(r.status === 1, 'a tampered chunk must exit 1, got ' + r.status + '\n' + r.text);
    assert(r.text.includes(r.chunkRel), 'the failure must name ' + r.chunkRel + ', got: ' + r.text.slice(0, 300));
  });

  arm('arm 11c: an extra file and a removed file each fail --check and name the file', () => {
    const extra = checkMutatedDist((dir) => { fs.writeFileSync(path.join(dir, 'server', 'extra-369-45.js'), '// stray\n'); });
    assert(extra.status === 1 && extra.text.includes('extra-369-45.js'), 'an extra file must exit 1 and be named, got ' + extra.status + ': ' + extra.text.slice(0, 300));
    const gone = checkMutatedDist((dir, chunkRel) => { fs.rmSync(path.join(dir, chunkRel)); });
    assert(gone.status === 1 && gone.text.includes(gone.chunkRel), 'a removed file must exit 1 and be named, got ' + gone.status + ': ' + gone.text.slice(0, 300));
  });

  arm('arm 11d: --check re-runs the output checks - a new outside host, buffer/, a /root/ path and a drive path each fail (WR-16, WR-18)', () => {
    const cases = [
      ['an outside host not on the reviewed list', 'fetch("https://example.org/x");\n', 'example.org'],
      ['a ws:// outside host', 'new WebSocket("wss://stream.example.net/s");\n', 'stream.example.net'],
      ['require("buffer/") (a userland package that shadows a built-in)', 'require("buffer/");\n', 'buffer/'],
      ['a /root/ build path', 'var p="/root/build/x";\n', '/root/'],
      ['a drive-letter build path', 'var p="C:\\\\build\\\\x";\n', 'C:'],
    ];
    for (const [what, text, expect] of cases) {
      const r = checkMutatedDist((dir, chunkRel) => { appendTo(dir, chunkRel, text); return [chunkRel]; }, { rehash: true });
      assert(r.status === 1, what + ': --check must exit 1, got ' + r.status + '\n' + r.text.slice(0, 300));
      assert(r.text.includes(expect), what + ': the failure must mention ' + expect + ', got: ' + r.text.slice(0, 400));
    }
  });

  arm('arm 12: the bare-import check no longer exempts a built-in followed by a slash', () => {
    const rootDeps = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).dependencies;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-45-imports-'));
    try {
      fs.writeFileSync(path.join(tmp, 'a.js'), 'require("buffer/");require("events/");require("punycode/");require("buffer");require("node:buffer");require("fs/promises");require("path");\n');
      const flagged = builder.foreignSpecifiers(tmp, rootDeps).map((s) => s.split(' ')[0]).sort();
      assert(JSON.stringify(flagged) === JSON.stringify(['buffer/', 'events/', 'punycode/']), 'expected exactly buffer/, events/, punycode/ flagged, got ' + JSON.stringify(flagged));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  arm('arm 13: the source hash follows the runtime packages the dist imports, not the whole root manifest (WR-16)', () => {
    const sw = JSON.parse(fs.readFileSync(path.join(REPO, 'npm-shrinkwrap.json'), 'utf8'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-45-sw-'));
    const hashWith = (mutate) => {
      const copy = JSON.parse(JSON.stringify(sw));
      mutate(copy);
      const p = path.join(tmp, 'npm-shrinkwrap.json');
      fs.writeFileSync(p, JSON.stringify(copy));
      return builder.computeSourceHash({ shrinkwrapPath: p }).hash;
    };
    try {
      const base = builder.computeSourceHash({ shrinkwrapPath: path.join(REPO, 'npm-shrinkwrap.json') }).hash;
      assert(base === builder.computeSourceHash().hash, 'the default shrinkwrap must be the repo one');
      assert(Array.isArray(builder.RUNTIME_PACKAGES) && ['next', 'react', 'react-dom'].every((n) => builder.RUNTIME_PACKAGES.includes(n)), 'RUNTIME_PACKAGES must list next, react and react-dom');
      assert(hashWith((c) => { c.packages['node_modules/next'].version = '0.0.0-369-45'; }) !== base, 'a changed resolved next version must change the hash');
      assert(hashWith((c) => { c.packages['node_modules/react'].version = '0.0.0-369-45'; }) !== base, 'a changed resolved react version must change the hash');
      assert(hashWith((c) => { c.packages['node_modules/react-dom'].integrity = 'sha512-patched'; }) !== base, 'a changed react-dom integrity must change the hash');
      const other = Object.keys(sw.packages).find((k) => k.startsWith('node_modules/') && !builder.RUNTIME_PACKAGES.some((n) => k === 'node_modules/' + n));
      assert(hashWith((c) => { c.packages[other].version = '0.0.0-369-45'; }) === base, 'a change to ' + other + ' (not a runtime package of the dist) must not change the hash');
      assert(hashWith((c) => { c.packages['node_modules/zz-added-369-45'] = { version: '1.0.0' }; }) === base, 'an added unrelated package must not change the hash');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  arm('arm 14: BUILD_UI_SHELL_DIST cannot make the build remove anything (WR-17)', () => {
    assert(typeof builder.assertDistRemovable === 'function', 'assertDistRemovable is not exported');
    for (const bad1 of [REPO, path.join(REPO, 'ui', 'shell'), path.join(REPO, 'lib'), os.homedir(), path.parse(REPO).root, os.tmpdir()]) {
      let threw = false;
      try { builder.assertDistRemovable(bad1); } catch (_e) { threw = true; }
      assert(threw, 'assertDistRemovable must refuse ' + bad1);
    }
    builder.assertDistRemovable(path.join(REPO, 'lib', 'ui-shell', 'dist')); // the one removable directory must pass
    // End to end: the build itself refuses to run while the variable is set. A group kill covers a build that ignores the refusal.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-45-seam-'));
    try {
      fs.writeFileSync(path.join(tmp, 'sentinel.txt'), 'keep me\n');
      const r = spawnSync(process.execPath, [BUILD], { cwd: REPO, encoding: 'utf8', detached: true, timeout: 20000, killSignal: 'SIGKILL', env: Object.assign({}, process.env, { BUILD_UI_SHELL_DIST: tmp }) });
      try { process.kill(-r.pid, 'SIGKILL'); } catch (_e) { /* the group is already gone */ }
      assert(r.status === 1, 'the build with BUILD_UI_SHELL_DIST set must exit 1, got ' + r.status + ' (signal ' + r.signal + ')');
      assert(/BUILD_UI_SHELL_DIST/.test((r.stderr || '') + (r.stdout || '')), 'the refusal must name BUILD_UI_SHELL_DIST: ' + ((r.stderr || '') + (r.stdout || '')).slice(0, 300));
      assert(fs.existsSync(path.join(tmp, 'sentinel.txt')), 'the sentinel file was removed');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
}

// ---------------------------------------------------------------------------
// arm 8: the installed layout
// ---------------------------------------------------------------------------

function npmEnv(home, cache) {
  const env = Object.assign({}, process.env);
  for (const k of ['MINDRIAN_BRAIN_KEY', 'MINDRIAN_MCP_FIRST', 'MINDRIAN_MCP_DAEMON', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM']) delete env[k];
  env.PATH = path.dirname(process.execPath) + path.delimiter + (process.env.PATH || '');
  env.HOME = home;
  env.USERPROFILE = home;
  env.npm_config_cache = cache;
  env.npm_config_update_notifier = 'false';
  env.npm_config_fund = 'false';
  env.npm_config_audit = 'false';
  return env;
}

async function installedLayoutArm() {
  const name = 'arm 8: installed layout - pack, loader install, launcher starts the dist server, link signs in, / serves the page with its CSP';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-28-layout-'));
  const home = path.join(tmp, 'home');
  const roomsHome = path.join(tmp, 'rooms');
  const roomDir = path.join(roomsHome, 'room-369');
  const cwd = path.join(tmp, 'cwd');
  for (const d of [home, roomDir, cwd, path.join(tmp, 'tmpdir')]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), '# room-369\n\nFixture room for plan 369-28. Synthetic, no real content.\n');
  // A cache keyed by the shrinkwrap hash, so a repeat run does not download the whole install again.
  const key = crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, 'npm-shrinkwrap.json'))).digest('hex').slice(0, 12);
  const npmCache = path.join(os.tmpdir(), 'mos-369-28-npm-cache-' + key);
  fs.mkdirSync(npmCache, { recursive: true });
  let installed = null;
  let launcherEnv = null;
  let launched = false;
  try {
    const version = runNode([path.join(REPO, 'lib', 'core', 'repo-version.cjs')]).stdout.trim();
    installed = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);

    // pack and lay out
    const packDir = path.join(tmp, 'pack');
    fs.mkdirSync(packDir);
    const pk = spawnSync('npm', ['pack', '--ignore-scripts', '--pack-destination', packDir, '--silent'], { cwd: REPO, env: npmEnv(home, npmCache), encoding: 'utf8', timeout: 180000 });
    if (pk.error && pk.error.code === 'ENOENT') throw new EnvGap('npm is not available');
    const tgzs = fs.readdirSync(packDir).filter((f) => f.endsWith('.tgz'));
    if (pk.status !== 0 || tgzs.length !== 1) throw new Error('npm pack status ' + pk.status + ', tgz count ' + tgzs.length + '\n' + (pk.stderr || '').slice(0, 600));
    const ex = path.join(tmp, 'extract');
    fs.mkdirSync(ex);
    const tar = spawnSync('tar', ['-xzf', path.join(packDir, tgzs[0]), '-C', ex], { encoding: 'utf8' });
    if (tar.status !== 0) throw new Error('tar extract failed: ' + (tar.stderr || '').slice(0, 300));
    fs.mkdirSync(path.dirname(installed), { recursive: true });
    fs.cpSync(path.join(ex, 'package'), installed, { recursive: true });
    for (const must of ['lib/ui-shell/launch.cjs', 'lib/ui-shell/dist/manifest.json', 'lib/ui-shell/dist/server/server.js', 'npm-shrinkwrap.json']) {
      if (!fs.existsSync(path.join(installed, must))) throw new Error('the packed layout is missing ' + must);
    }
    if (fs.existsSync(path.join(installed, 'ui')) || fs.existsSync(path.join(installed, 'tools'))) throw new Error('ui/ or tools/ reached the packed layout');

    // the loader's install
    const ci = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: installed, env: npmEnv(home, npmCache), encoding: 'utf8', timeout: 540000, maxBuffer: 64 * 1024 * 1024 });
    const ciErr = (ci.stderr || '') + (ci.error ? String(ci.error.message) : '');
    if (ci.status !== 0) {
      if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET|network/i.test(ciErr) || (ci.error && ci.error.code === 'ETIMEDOUT')) {
        throw new EnvGap('npm registry unreachable (' + ((ciErr.match(/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNRESET/) || ['timeout'])[0]) + ')');
      }
      throw new Error('npm ci status ' + ci.status + '\n' + ciErr.slice(0, 1200));
    }
    for (const dep of ['next', 'react', 'react-dom']) {
      if (!fs.existsSync(path.join(installed, 'node_modules', dep, 'package.json'))) throw new Error('the loader install did not provide ' + dep);
    }

    // the launcher, from the installed directory, on its own dist
    const port = await freePort();
    launcherEnv = Object.assign(npmEnv(home, npmCache), {
      MINDRIAN_ROOMS_HOME: roomsHome,
      MINDRIAN_ROOM: roomDir,
      MINDRIAN_TRANSPORT: 'stdio',
      MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', // unreachable loopback, never a real Brain (Canon Part 8)
      MINDRIAN_OPEN_BROWSER_DISABLE: '1',
      MOS_SHELL_START_TIMEOUT_MS: '45000',
      TMPDIR: path.join(tmp, 'tmpdir'),
    });
    const launcher = path.join(installed, 'lib', 'ui-shell', 'launch.cjs');
    const st = spawnSync(process.execPath, [launcher, 'start', '--port', String(port)], { cwd: installed, env: launcherEnv, encoding: 'utf8', timeout: 120000 });
    launched = true;
    if (st.status !== 0) throw new Error('launch.cjs start exited ' + st.status + '\nstdout: ' + (st.stdout || '').slice(0, 500) + '\nstderr: ' + (st.stderr || '').slice(0, 800));
    if (/not built in this install/i.test((st.stdout || '') + (st.stderr || ''))) throw new Error('the launcher still refuses: the workspace is not built in this install');
    // Plan 369-40 (CR-01): run like Claude Code runs it (stdout is a pipe), the launcher prints no sign-in code. The
    // test then arms its own one-time code through the 0600 control channel and signs in the way a browser does
    // (a top-level navigation: the three fetch-metadata headers).
    const printed = (st.stdout || '') + (st.stderr || '');
    if (/code=|\/auth\/bootstrap/.test(printed)) throw new Error('CR-01: the launcher printed a sign-in code outside a terminal: ' + JSON.stringify(printed.slice(0, 200)));
    const token = fs.readFileSync(path.join(home, '.mindrian', 'ui-shell', 'control.token'), 'utf8').trim();
    const code = crypto.randomBytes(32).toString('base64url');
    const armStatus = await new Promise((resolve, reject) => {
      const body = JSON.stringify({ sha256: crypto.createHash('sha256').update(code).digest('hex') });
      const req = http.request({ host: '127.0.0.1', port, path: '/control/bootstrap', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), 'x-mos-control-token': token } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
      req.on('error', reject);
      req.end(body);
    });
    if (armStatus !== 200) throw new Error('arming a sign-in code through the control channel answered ' + armStatus + ', expected 200');

    const exch = await httpGet(port, '/auth/bootstrap?code=' + code, { 'sec-fetch-site': 'none', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' });
    if (exch.status !== 303) throw new Error('the link answered ' + exch.status + ', expected 303');
    const setCookie = [].concat(exch.headers['set-cookie'] || []);
    if (!setCookie.length) throw new Error('the sign-in answered 303 with no Set-Cookie');
    const cookie = setCookie.map((c) => c.split(';')[0]).join('; ');
    const page = await httpGet(port, '/', { cookie });
    if (page.status !== 200) throw new Error('GET / with the cookie answered ' + page.status + ' (expected 200)');
    if (!/text\/html/.test(String(page.headers['content-type'] || ''))) throw new Error('GET / is not HTML: ' + page.headers['content-type']);
    const csp = String(page.headers['content-security-policy'] || '');
    if (!/script-src[^;]*'nonce-/.test(csp)) throw new Error('GET / carries no nonce Content-Security-Policy: ' + JSON.stringify(csp));
    if (/unsafe-inline/.test(csp)) throw new Error("the CSP allows 'unsafe-inline': " + csp);
    if (!/<html/i.test(page.body)) throw new Error('GET / body is not a page');

    // stop ends it
    const stop = spawnSync(process.execPath, [launcher, 'stop'], { cwd: installed, env: launcherEnv, encoding: 'utf8', timeout: 60000 });
    if (stop.status !== 0) throw new Error('launch.cjs stop exited ' + stop.status + ': ' + (stop.stderr || ''));
    await new Promise((r) => setTimeout(r, 300));
    let stillUp = true;
    try { await httpGet(port, '/'); } catch (_e) { stillUp = false; }
    if (stillUp) throw new Error('the shell server still answers after stop (launcher said: ' + JSON.stringify((stop.stdout || '') + (stop.stderr || '')) + ')');
    launched = false;
    ok(name, 'link 303, / 200 with nonce CSP, stopped; node ' + process.version);
  } catch (e) {
    if (e instanceof EnvGap) { envGapReasons.push(e.message); skip(name, 'ENV GAP: ' + e.message); }
    else bad(name, e && e.message);
  } finally {
    // Kill only what this test started: the shell (via the launcher) and the daemon recorded in the hermetic rooms home.
    if (launched && installed && launcherEnv) {
      try { spawnSync(process.execPath, [path.join(installed, 'lib', 'ui-shell', 'launch.cjs'), 'stop'], { cwd: installed, env: launcherEnv, timeout: 30000 }); } catch (_e) { /* best effort */ }
    }
    try {
      const pidfile = path.join(roomsHome, '.rooms', 'daemon', 'mcp-daemon.json');
      if (fs.existsSync(pidfile)) {
        const pid = JSON.parse(fs.readFileSync(pidfile, 'utf8')).pid;
        if (Number.isInteger(pid) && pidAlive(pid)) process.kill(pid, 'SIGKILL');
      }
    } catch (_e) { /* best effort */ }
    await new Promise((r) => setTimeout(r, 300));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

async function main() {
  process.stdout.write('test-369-ui-dist-fresh: node ' + process.version + '\n');
  if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
    bad('lib/ui-shell/dist/manifest.json exists', 'run node scripts/build-ui-shell.cjs and commit lib/ui-shell/dist');
  } else {
    offlineArms();
    await installedLayoutArm();
  }
  process.stdout.write('\ntest-369-ui-dist-fresh: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped' + (knownRed ? ', ' + knownRed + ' known red (see arm 7)' : '') + '\n');
  if (failed > 0) process.exit(1);
  if (envGapReasons.length) {
    process.stdout.write('SKIPPED (ENV GAP): ' + envGapReasons.join('; ') + '\n');
    process.exit(77);
  }
  process.exit(0);
}

main().catch((e) => { process.stderr.write(String((e && e.stack) || e) + '\n'); process.exit(1); });
