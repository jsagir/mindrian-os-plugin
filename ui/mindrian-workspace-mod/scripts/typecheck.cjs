// Type-checks the mod with tsc -p, reusing a TypeScript that is already installed.
//
// This installs nothing: the mod declares no dependency. It looks for the lockfile-pinned
// TypeScript of tools/ts-check first, then ui/shell, the same order as
// tools/ts-check/check.cjs resolveTsc. The declaration file is laid first (lay-types.cjs).
// Exit 77 = no compiler found or no declaration file (ENV GAP), otherwise tsc's own status.
// CJS, Node built-ins only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MOD = path.resolve(__dirname, '..');
const REPO = path.resolve(MOD, '..', '..');

function resolveTsc() {
  for (const pkgDir of [path.join(REPO, 'tools', 'ts-check'), path.join(REPO, 'ui', 'shell')]) {
    const pkgJson = path.join(pkgDir, 'node_modules', 'typescript', 'package.json');
    if (!fs.existsSync(pkgJson)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin && pkg.bin.tsc;
    if (!bin) continue;
    const abs = path.join(path.dirname(pkgJson), bin);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

const laid = spawnSync(process.execPath, [path.join(__dirname, 'lay-types.cjs')], { stdio: 'inherit' });
if (laid.status !== 0) process.exit(laid.status === 77 ? 77 : 1);

const tsc = resolveTsc();
if (!tsc) {
  process.stdout.write('typecheck: no TypeScript found: run npm --prefix tools/ts-check ci --ignore-scripts\n');
  process.exit(77);
}

const r = spawnSync(process.execPath, [tsc, '-p', MOD], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
