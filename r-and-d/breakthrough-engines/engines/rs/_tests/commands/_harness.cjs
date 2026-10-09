'use strict';
// Stages shipped files plus hand-made stubs into a temp tree so the files can
// be required without the missing plugin modules. Never writes inside the
// package or research/ trees.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PKG = path.resolve(__dirname, '..', '..');           // package-2026/rs
function stage(copies, extraStubs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-cmd-tests-'));
  process.on('exit', function () { try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
  fs.mkdirSync(path.join(root, 'lib', 'core'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  const stubDir = path.join(__dirname, 'stubs');
  for (const f of fs.readdirSync(stubDir)) {
    // stubs/lib-core-* are placed in lib/core, stubs/scripts-* in scripts
    if (f.startsWith('scripts-')) fs.copyFileSync(path.join(stubDir, f), path.join(root, 'scripts', f.slice('scripts-'.length)));
    else fs.copyFileSync(path.join(stubDir, f), path.join(root, 'lib', 'core', f));
  }
  for (const rel of copies) {
    const src = path.join(PKG, rel);
    const dest = rel.includes('/scripts/') ? path.join(root, 'scripts', path.basename(rel)) : path.join(root, 'lib', 'core', path.basename(rel));
    fs.copyFileSync(src, dest);
  }
  for (const k of Object.keys(extraStubs || {})) fs.writeFileSync(path.join(root, k), extraStubs[k]);
  return root;
}
module.exports = { stage, PKG };
