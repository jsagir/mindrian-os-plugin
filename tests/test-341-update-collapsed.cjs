#!/usr/bin/env node
'use strict';
/*
 * tests/test-341-update-collapsed.cjs
 *
 * Phase 341 plan 08 Task 3. Grep tripwire in the tests/test-213-part8-boundary.cjs
 * idiom. It pins the collapse of /mos:update to Check, Confirm, Loader, Verify
 * (D-07) and keeps the surviving pieces true, so a future cleanup cannot delete
 * the wrong thing.
 *
 * EXCLUSIONS (named, per the plan): the live-tree scan for the retired touch-file
 * literal covers commands/, scripts/, lib/, hooks/, bin/, data/ and tests/. It
 * EXCLUDES CHANGELOG.md, docs/autopsies/ and .planning/ (history), and dist/
 * (a generated bundle rebuilt at release). The literal is built from two pieces
 * below so this file never spells it.
 *
 * Arms:
 *   1. commands/update.md has exactly four "### Step " headings.
 *   2. the retired touch-file literal appears nowhere in the live tree.
 *   3. scripts/post-update-activation.cjs does not exist.
 *   4. scripts/doctor.cjs has no post-update flag.
 *   5. scripts/doctor.cjs STILL has the activation-reached-the-wire point.
 *   6. hooks/hooks.json parses, STILL registers the preflight host and the
 *      npm-reconcile backstop.
 *   7. the SessionStart hook count is unchanged at 9 (D-07a: no tenth hook).
 *   8. scripts/check-version-and-sha.cjs has no GitHub tag-ref call and no
 *      hotfix STATUS value.
 *
 * Zero network, zero spawn.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

let PASS = 0;
let FAIL = 0;
function arm(name, fn) {
  try {
    fn();
    PASS += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    FAIL += 1;
    console.log('FAIL: ' + name);
    console.log('  ' + (e && e.message ? e.message : e));
  }
}
function read(rel) { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }

const RETIRED_TOUCH_FILE = 'post-update-' + 'restart-pending';
const RETIRED_FLAG = '--post-' + 'update';
const SCAN_DIRS = ['commands', 'scripts', 'lib', 'hooks', 'bin', 'data', 'tests'];
const SKIP_DIR_NAMES = new Set(['node_modules', '.git', '__pycache__']);

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
  for (const e of entries) {
    if (SKIP_DIR_NAMES.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.isFile()) out.push(full);
  }
}

arm('commands/update.md has exactly four "### Step " headings', () => {
  const n = read('commands/update.md').split('\n').filter((l) => /^### Step /.test(l)).length;
  if (n !== 4) throw new Error('step headings: ' + n);
});

arm('the retired touch-file literal appears nowhere in the live tree', () => {
  const hits = [];
  for (const d of SCAN_DIRS) {
    const files = [];
    walk(path.join(REPO, d), files);
    for (const f of files) {
      let st;
      try { st = fs.statSync(f); } catch (_e) { continue; }
      if (st.size > 4 * 1024 * 1024) continue;
      let txt;
      try { txt = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
      if (txt.indexOf(RETIRED_TOUCH_FILE) !== -1) hits.push(path.relative(REPO, f));
    }
  }
  if (hits.length) throw new Error('literal found in: ' + hits.join(', '));
});

arm('scripts/post-update-activation.cjs does not exist', () => {
  if (fs.existsSync(path.join(REPO, 'scripts', 'post-update-activation.cjs'))) throw new Error('file still exists');
});

arm('scripts/doctor.cjs has no post-update flag', () => {
  const src = read('scripts/doctor.cjs');
  if (src.indexOf("'" + RETIRED_FLAG + "'") !== -1) throw new Error('flag literal present');
  if (src.indexOf('flags.postUpdate') !== -1) throw new Error('flags.postUpdate present');
});

arm('scripts/doctor.cjs STILL has the activation-reached-the-wire point', () => {
  if (read('scripts/doctor.cjs').indexOf("id: 'activation-reached-the-wire'") === -1) {
    throw new Error('the surviving acceptance point is gone');
  }
});

arm('hooks/hooks.json parses and STILL registers the preflight host and the npm-reconcile backstop', () => {
  const raw = read('hooks/hooks.json');
  JSON.parse(raw);
  if (raw.indexOf('sessionstart-post-update-preflight') === -1) throw new Error('preflight host missing');
  if (raw.indexOf('sessionstart-npm-reconcile') === -1) throw new Error('npm-reconcile backstop missing');
});

arm('SessionStart hook count is unchanged at 9', () => {
  const j = JSON.parse(read('hooks/hooks.json'));
  const n = j.hooks.SessionStart.length;
  console.log('  measured SessionStart entries: ' + n);
  if (n !== 9) throw new Error('SessionStart entries: ' + n);
});

arm('scripts/check-version-and-sha.cjs has no GitHub tag-ref call and no hotfix STATUS', () => {
  const src = read('scripts/check-version-and-sha.cjs');
  if (src.indexOf('api.github.com') !== -1) throw new Error('api.github.com present');
  if (src.indexOf('SHA_DIFFERS_INVERSION_HOTFIX') !== -1) throw new Error('hotfix STATUS present');
});

console.log('\nupdate-collapsed: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
