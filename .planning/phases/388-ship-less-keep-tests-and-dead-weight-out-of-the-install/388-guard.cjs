#!/usr/bin/env node
// Phase 388 scope guard. Proves that a measuring plan changed no product file.
// Node built-ins only. Hyphens only.
//
// Why a snapshot: a peer session has uncommitted edits in the same tree, so a plain
// git status check would fail for edits that are not ours. The snapshot stores the
// status lines at the start. check reports only lines that are new since then.
//
// Commands:
//   snapshot NN                 store sorted git status lines in <git-dir>/mos388-snap-NN.txt
//   check NN allow1 allow2 ...  exit 1 and print each new path that is not allowed
//   commit-files SHA allow...   exit 1 and print each path of the commit that is not allowed
//   selftest                    tests 1 to 4 in a temporary repo
// An allow entry that ends in a slash allows every path under it. Any other entry allows one path.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd: cwd || process.cwd(), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + (r.stderr || '').trim());
  return r.stdout;
}

function gitDir(cwd) {
  return path.resolve(cwd || process.cwd(), git(['rev-parse', '--git-dir'], cwd).trim());
}

function statusLines(cwd) {
  const out = git(['status', '--porcelain', '--untracked-files=all'], cwd);
  return out.split('\n').filter(Boolean).sort();
}

function pathOfLine(line) {
  let p = line.slice(3);
  const arrow = p.indexOf(' -> ');
  if (arrow !== -1) p = p.slice(arrow + 4);
  if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
  return p;
}

function allowed(p, allow) {
  return allow.some((a) => (a.endsWith('/') ? p.startsWith(a) : p === a));
}

function snapFile(nn, cwd) {
  return path.join(gitDir(cwd), 'mos388-snap-' + nn + '.txt');
}

function snapshot(nn, cwd) {
  fs.writeFileSync(snapFile(nn, cwd), statusLines(cwd).join('\n') + '\n');
}

function check(nn, allow, cwd) {
  const before = new Set(fs.readFileSync(snapFile(nn, cwd), 'utf8').split('\n').filter(Boolean));
  const fresh = statusLines(cwd).filter((l) => !before.has(l));
  return fresh.map(pathOfLine).filter((p) => !allowed(p, allow));
}

function commitFiles(sha, allow, cwd) {
  const names = git(['show', '--name-only', '--format=', sha], cwd).split('\n').filter(Boolean);
  return names.filter((p) => !allowed(p, allow));
}

function selftest() {
  const failures = [];
  const ok = (cond, msg) => { if (!cond) failures.push(msg); };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos388-guard-'));
  try {
    const g = (...a) => git(a, tmp);
    g('init', '-q');
    g('config', 'user.email', 't@example.invalid');
    g('config', 'user.name', 't');
    fs.mkdirSync(path.join(tmp, 'phase'));
    fs.mkdirSync(path.join(tmp, 'prod'));
    fs.writeFileSync(path.join(tmp, 'prod', 'a.txt'), 'a\n');
    fs.writeFileSync(path.join(tmp, 'prod', 'peer.txt'), 'p\n');
    g('add', '-A');
    g('commit', '-q', '-m', 'base');
    // peer dirty file at snapshot time
    fs.writeFileSync(path.join(tmp, 'prod', 'peer.txt'), 'p2\n');
    snapshot('t', tmp);
    // test 1: new file under allowed prefix passes
    fs.writeFileSync(path.join(tmp, 'phase', 'n.txt'), 'n\n');
    ok(check('t', ['phase/'], tmp).length === 0, 'test 1: allowed new file must pass');
    // test 3a: file dirty at snapshot and still dirty is not an offender
    ok(check('t', ['phase/'], tmp).indexOf('prod/peer.txt') === -1, 'test 3a: pre-dirty file must not count');
    // test 2: new file outside the prefix fails and is named
    fs.writeFileSync(path.join(tmp, 'prod', 'x.txt'), 'x\n');
    const off = check('t', ['phase/'], tmp);
    ok(off.length === 1 && off[0] === 'prod/x.txt', 'test 2: outside file must be named, got ' + JSON.stringify(off));
    fs.unlinkSync(path.join(tmp, 'prod', 'x.txt'));
    // test 3b: clean at snapshot, modified later, counts
    fs.writeFileSync(path.join(tmp, 'prod', 'a.txt'), 'a2\n');
    const off2 = check('t', ['phase/'], tmp);
    ok(off2.indexOf('prod/a.txt') !== -1, 'test 3b: later modified file must count');
    g('checkout', '--', 'prod/a.txt');
    // test 4: commit-files
    fs.writeFileSync(path.join(tmp, 'phase', 'm.txt'), 'm\n');
    fs.writeFileSync(path.join(tmp, 'prod', 'y.txt'), 'y\n');
    g('add', 'phase/m.txt', 'prod/y.txt');
    g('commit', '-q', '-m', 'mixed', '--only', 'phase/m.txt', 'prod/y.txt');
    const sha = g('rev-parse', 'HEAD').trim();
    const bad = commitFiles(sha, ['phase/'], tmp);
    ok(bad.length === 1 && bad[0] === 'prod/y.txt', 'test 4: disallowed commit path must be named, got ' + JSON.stringify(bad));
    ok(commitFiles(sha, ['phase/', 'prod/y.txt'], tmp).length === 0, 'test 4b: fully allowed commit must pass');
  } catch (e) {
    failures.push('selftest crashed: ' + e.message);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (failures.length) {
    for (const f of failures) console.error('FAIL ' + f);
    return 1;
  }
  console.log('guard selftest: 4 tests passed');
  return 0;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'selftest') process.exit(selftest());
  if (cmd === 'snapshot') { snapshot(rest[0]); console.log('snapshot ' + rest[0] + ' written'); return; }
  if (cmd === 'check') {
    const off = check(rest[0], rest.slice(1));
    if (off.length) { for (const p of off) console.log('OFFENDER ' + p); process.exit(1); }
    console.log('guard check ' + rest[0] + ': no path outside the allowed set');
    return;
  }
  if (cmd === 'commit-files') {
    const bad = commitFiles(rest[0], rest.slice(1));
    if (bad.length) { for (const p of bad) console.log('OFFENDER ' + p); process.exit(1); }
    console.log('guard commit-files ' + rest[0] + ': all paths allowed');
    return;
  }
  console.error('usage: 388-guard.cjs snapshot NN | check NN allow... | commit-files SHA allow... | selftest');
  process.exit(2);
}

if (require.main === module) main();
module.exports = { snapshot, check, commitFiles, statusLines };
