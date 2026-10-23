// Type-checks the mos-face mod with tsc -p.
//
// Steps: lay the engine declaration file (lay-types.cjs), find a TypeScript compiler, run
// tsc -p on this folder. The compiler comes from ui/mos-face/node_modules (npm ci
// --ignore-scripts, pinned by the lockfile) first, then from tools/ts-check.
// Exit 0 = clean, 1 = type error, 77 = no compiler or no declaration file (ENV GAP).
// CJS, Node built-ins only. No network.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MOD = path.resolve(__dirname, '..');
const REPO = path.resolve(MOD, '..', '..');

function resolveTsc() {
  for (const pkgDir of [MOD, path.join(REPO, 'tools', 'ts-check')]) {
    const pkgJson = path.join(pkgDir, 'node_modules', 'typescript', 'package.json');
    if (!fs.existsSync(pkgJson)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin && pkg.bin.tsc;
    if (!bin) continue;
    const abs = path.join(path.dirname(pkgJson), bin);
    if (fs.existsSync(abs)) return { abs, version: pkg.version, from: pkgDir };
  }
  return null;
}

const laid = spawnSync(process.execPath, [path.join(__dirname, 'lay-types.cjs')], { stdio: 'inherit' });
if (laid.status !== 0) process.exit(laid.status === 77 ? 77 : 1);

const tsc = resolveTsc();
if (!tsc) {
  process.stdout.write('typecheck: no TypeScript found. One fix: run npm ci --ignore-scripts in ui/mos-face\n');
  process.exit(77);
}
process.stdout.write('typecheck: TypeScript ' + tsc.version + ' from ' + tsc.from + '\n');

const r = spawnSync(process.execPath, [tsc.abs, '-p', MOD], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
