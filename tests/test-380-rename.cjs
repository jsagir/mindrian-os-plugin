// 380-09 follow-up: the state owner is mos-face in the SOURCE and mos only in the BUILT dist (owner ruling 2026-10-24).
//
// Why: the engine lets only the plugin named by the owner write a value, and the shipped plugin is named mos.
// A source plugin named mos, loaded with claude --plugin-dir ui/mos-face, replaces the installed mos plugin
// (docs: plugins/loading, "Name conflicts"). So the source keeps the name mos-face and the build rewrites the owner.
//
// Legs:
//   R1  ui/mos-face/.claude-plugin/plugin.json name is mos-face.
//   R2  ui/mos-face/hooks/register.tsx: every atom owner literal is mos-face (40 atoms: 37 and the 3 room tree atoms of plan 380-18), none is mos.
//   R3  ui/mos-face/types/index.d.ts: the PluginState key is mos-face, not mos.
//   R4  lib/mos-face/dist/register.js: every atom owner literal is mos (same count as the source), none is mos-face.
//   R5  lib/mos-face/dist/types/index.d.ts: the PluginState key is mos, not mos-face.
//   R6  the dist holds zero mos-face owner literals in any file.
//   R7  the build script holds the owner rewrite and a leftover check (so the build fails on a leftover).
//   R8  the dist file names, the folder name and the prose /mos-face command text stay.
//
// CJS, Node built-ins only. Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'ui', 'mos-face');
const DIST = path.join(ROOT, 'lib', 'mos-face', 'dist');

let passed = 0;
let failed = 0;
function check(label, ok, detail) {
  if (ok) { passed += 1; console.log('  ok   ' + label); }
  else { failed += 1; console.log('  FAIL ' + label + (detail ? ' :: ' + detail : '')); }
}
const read = (p) => fs.readFileSync(p, 'utf8');
/** The atom owner literals: plugin: 'x' inside an atom key object. */
function owners(text) {
  const out = [];
  const re = /\bplugin:\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}
/** The PluginState keys: a quoted key opening an object at four spaces of indent. */
function typeKeys(text) {
  const out = [];
  const re = /^ {4}'([^']+)': \{$/gm;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}
function tally(list) {
  const t = {};
  for (const x of list) t[x] = (t[x] || 0) + 1;
  return JSON.stringify(t);
}

const srcOwners = owners(read(path.join(SRC, 'hooks', 'register.tsx')));
const distOwners = owners(read(path.join(DIST, 'register.js')));
const srcKeys = typeKeys(read(path.join(SRC, 'types', 'index.d.ts')));
const distKeys = typeKeys(read(path.join(DIST, 'types', 'index.d.ts')));

const pj = JSON.parse(read(path.join(SRC, '.claude-plugin', 'plugin.json')));
check('R1 source package name is mos-face', pj.name === 'mos-face', 'name=' + pj.name);
check('R2 source atoms are owned by mos-face', srcOwners.length === 40 && srcOwners.every((o) => o === 'mos-face'), tally(srcOwners));
check('R3 source PluginState key is mos-face', srcKeys.length === 1 && srcKeys[0] === 'mos-face', JSON.stringify(srcKeys));
check('R4 dist atoms are owned by mos', distOwners.length === srcOwners.length && distOwners.every((o) => o === 'mos'), tally(distOwners));
check('R5 dist PluginState key is mos', distKeys.length === 1 && distKeys[0] === 'mos', JSON.stringify(distKeys));

const left = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|ts|json)$/.test(e.name) && e.name !== 'manifest.json') {
      const t = read(p);
      if (owners(t).includes('mos-face') || typeKeys(t).includes('mos-face')) left.push(path.relative(DIST, p));
    }
  }
})(DIST);
check('R6 the dist holds no mos-face owner literal', left.length === 0, left.join(', '));

const build = read(path.join(ROOT, 'scripts', 'build-mos-face.cjs'));
check('R7 the build rewrites the owner and checks for a leftover', /rewriteOwner/.test(build) && /leftover/i.test(build));
check('R8 prose command text stays', /\/mos-face/.test(read(path.join(DIST, 'register.js'))) && fs.existsSync(path.join(ROOT, 'lib', 'mos-face', 'dist')));

console.log('test-380-rename: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
