// Copies the canonical files the mod reads at run time into ui/mindrian-workspace-mod/assets.
//
// Why: `claude --plugin-dir ui/mindrian-workspace-mod` makes the plugin root the package folder,
// so the mod can read only files inside it ($.fs.read of $.plugin.root). The canonical files sit
// outside it, so the mod owns a derived byte copy of each, guarded by
// tests/test-369.26-palette-sync.cjs. The canonical files are never edited here.
//
// Usage:
//   node ui/mindrian-workspace-mod/scripts/sync-assets.cjs           copy every pair
//   node ui/mindrian-workspace-mod/scripts/sync-assets.cjs --check   exit 1 on any drift, write nothing
//
// Plan 15 appends its two registry files to ASSETS. CJS, Node built-ins only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MOD = path.resolve(__dirname, '..');
const REPO = path.resolve(MOD, '..', '..');

// { from: repo-relative canonical file, to: mod-relative asset }. palette.json stays first.
const ASSETS = [
  { from: 'references/visual/palette.json', to: 'assets/palette.json' },
  // The canon snapshot plan 16's Part 8 check validates a lookup handle against.
  { from: 'data/framework-names.json', to: 'assets/framework-names.json' },
];

function status(pair) {
  const from = path.join(REPO, pair.from);
  const to = path.join(MOD, pair.to);
  if (!fs.existsSync(from)) return { state: 'no-source', from, to };
  if (!fs.existsSync(to)) return { state: 'missing', from, to };
  return { state: fs.readFileSync(from).equals(fs.readFileSync(to)) ? 'equal' : 'drift', from, to };
}

const check = process.argv.includes('--check');
let bad = 0;

for (const pair of ASSETS) {
  const s = status(pair);
  const name = pair.to;
  if (s.state === 'no-source') {
    process.stdout.write('FAIL ' + name + ': canonical source ' + pair.from + ' is missing\n');
    bad += 1;
  } else if (s.state === 'equal') {
    process.stdout.write('ok   ' + name + ': equal to ' + pair.from + '\n');
  } else if (check) {
    process.stdout.write('FAIL ' + name + ': ' + (s.state === 'missing' ? 'asset is missing' : 'differs from ' + pair.from) + '\n');
    bad += 1;
  } else {
    fs.mkdirSync(path.dirname(s.to), { recursive: true });
    fs.copyFileSync(s.from, s.to);
    process.stdout.write('sync ' + name + ': copied from ' + pair.from + ' (' + s.state + ')\n');
  }
}

process.exit(bad === 0 ? 0 : 1);
