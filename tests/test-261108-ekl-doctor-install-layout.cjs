// 261108-ekl task 2: doctor self-skips the dogfood pass and 4 repo-only acceptance points in an
// install layout, and keeps every gate blocking in a repo checkout.
//
// Legs:
//   D1  detectPluginLayout(stub install) -> 'install', missing ['tests/', '.git', 'scripts/release.sh'].
//   D2  detectPluginLayout(REPO) -> 'repo', missing [].
//   D3  runDogfoodAcceptance on the stub install: 6 SKIP points, 0 failed, 6 skipped.
//   D4  runAcceptance on the stub install, the 4 repo-only ids: 4 SKIP points, none failed.
//   D5  a stub repo (tests/, scripts/release.sh, git init + commit) reads 'repo'; the points still run
//       and still fail (driver missing, missing step names).
//   D6  no reason text holds the string "failed:" (the run-all roll-up greps that token).
// CJS, Node built-ins only. Hermetic: no network. Hyphens only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.env.MINDRIAN_ACCEPTANCE_PROGRESS = '0';

const REPO = path.resolve(__dirname, '..');
const shared = require(path.join(REPO, 'lib', 'core', 'doctor', 'shared.cjs'));
const doctor = require(path.join(REPO, 'scripts', 'doctor.cjs'));

let passed = 0;
let failed = 0;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) { passed += 1; say('  ok ' + msg); } else { failed += 1; say('  FAIL ' + msg); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'ekl-doctor-'));
function mkDir(rel) {
  const p = path.join(SCRATCH, rel);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

const REPO_ONLY_IDS = ['version-of-record-published', 'verify-release-clean-tree', 'release-dry-run-output', 'cross-connection-honesty'];

async function main() {
  // Stub install: plugin.json and an empty scripts/ dir only.
  const stubInstall = mkDir('install');
  fs.mkdirSync(path.join(stubInstall, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(stubInstall, '.claude-plugin', 'plugin.json'), '{"name":"stub","version":"0.0.0"}', 'utf8');
  fs.mkdirSync(path.join(stubInstall, 'scripts'), { recursive: true });
  const tmpHome = mkDir('home');

  say('D1 detectPluginLayout on a stub install');
  check(typeof shared.detectPluginLayout === 'function', 'D1 detectPluginLayout is exported');
  const l1 = shared.detectPluginLayout(stubInstall);
  check(l1 && l1.layout === 'install', 'D1 layout is install');
  check(l1 && eq(l1.missing, ['tests/', '.git', 'scripts/release.sh']), 'D1 missing lists the 3 markers in order');

  say('D2 detectPluginLayout on the repo');
  const l2 = shared.detectPluginLayout(REPO);
  check(l2 && l2.layout === 'repo', 'D2 layout is repo');
  check(l2 && eq(l2.missing, []), 'D2 missing is empty');

  say('D3 dogfood on a stub install');
  const d3 = await doctor.runDogfoodAcceptance({ pluginRoot: stubInstall });
  check(d3.points.length === 6, 'D3 6 points');
  check(d3.points.every(function (p) { return p.ok === true && p.skipped === true; }), 'D3 every point ok and skipped');
  check(d3.points.every(function (p) { return p.detail && String(p.detail.reason).indexOf('dev harness tests/ not present in this layout') === 0; }), 'D3 reason starts with the dev harness text');
  check(eq(d3.failed_points, []), 'D3 failed_points is empty');
  check(d3.summary.failed === 0 && d3.summary.skipped === 6, 'D3 summary failed 0, skipped 6');
  check(typeof doctor.pointTag === 'function' && d3.points.every(function (p) { return doctor.pointTag(p) === 'SKIP'; }), 'D3 pointTag is SKIP');

  say('D4 acceptance on a stub install');
  const d4 = await doctor.runAcceptance({ home: tmpHome, pluginRoot: stubInstall, onlyPoints: REPO_ONLY_IDS.join(',') });
  check(d4.points.length === 4, 'D4 4 points');
  check(d4.points.every(function (p) { return p.ok === true && p.skipped === true; }), 'D4 every point ok and skipped');
  check(d4.points.every(function (p) { return p.detail && String(p.detail.reason).indexOf('repo-only point, not a repo checkout') === 0; }), 'D4 reason starts with the repo-only text');
  check(eq(d4.failed_points, []), 'D4 failed_points is empty');
  check(d4.summary.skipped === 4 && d4.summary.failed === 0, 'D4 summary skipped 4, failed 0');

  say('D5 a stub repo keeps the points blocking');
  const stubRepo = mkDir('repo');
  fs.mkdirSync(path.join(stubRepo, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(stubRepo, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(stubRepo, 'scripts', 'release.sh'), '#!/usr/bin/env bash\nexit 0\n', 'utf8');
  fs.writeFileSync(path.join(stubRepo, 'README.md'), 'stub\n', 'utf8');
  const git = function (args) {
    return spawnSync('git', ['-c', 'user.email=t@example.invalid', '-c', 'user.name=t', '-C', stubRepo].concat(args), { encoding: 'utf8' });
  };
  git(['init', '-q']);
  git(['add', 'README.md', 'scripts/release.sh']);
  git(['commit', '-q', '-m', 'stub']);
  const l5 = shared.detectPluginLayout(stubRepo);
  check(l5 && l5.layout === 'repo', 'D5 stub repo reads repo');
  const d5 = await doctor.runDogfoodAcceptance({ pluginRoot: stubRepo });
  check(d5.points.length === 6 && d5.points.every(function (p) { return !p.skipped && p.ok === false; }), 'D5 dogfood points are not skipped and fail');
  check(d5.points.every(function (p) { return String(p.finding).indexOf('driver missing:') === 0; }), 'D5 dogfood finding is driver missing');
  const d5b = await doctor.runAcceptance({ home: tmpHome, pluginRoot: stubRepo, onlyPoints: 'verify-release-clean-tree,release-dry-run-output' });
  check(d5b.points.length === 2 && d5b.points.every(function (p) { return !p.skipped; }), 'D5 acceptance points are not skipped');
  const dry = d5b.points.find(function (p) { return p.id === 'release-dry-run-output'; });
  check(dry && dry.ok === false && String(dry.finding).indexOf('missing step names') === 0, 'D5 release-dry-run-output still blocks (missing step names)');

  say('D6 no reason holds "failed:"');
  const reasons = d3.points.concat(d4.points).map(function (p) { return String(p.detail && p.detail.reason); });
  check(reasons.every(function (r) { return r.indexOf('failed:') === -1; }), 'D6 no reason holds the failed: token');
}

main().then(function () {
  try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  say('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}).catch(function (e) {
  try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  say('FAIL threw: ' + (e && e.stack || e));
  process.exit(1);
});
