#!/usr/bin/env node
'use strict';

/*
 * Phase 369.1 plan 01 (DPI-08, D-06): the marketplace repo is clean.
 * ================================================================
 * /home/jsagi/dev/mindrian-marketplace is a public release surface. Today
 * origin/master carries a committed .next/ build directory and no .gitignore.
 * This test reads origin/master through git only (fetch, ls-tree, show) and
 * never edits that repo or its working tree.
 *
 * Passes only when origin/master:
 *   - has no .next entry,
 *   - has a .gitignore that lists .next/ and node_modules/ and has no line
 *     that ignores plugins (the Desktop copy lives under plugins/).
 *
 * Exit: 1 on any FAIL, 77 with an "ENV GAP:" line when the repo directory is
 * missing or the fetch fails, else 0. Hyphens only.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const MARKETPLACE = process.env.MOS_369_1_MARKETPLACE_DIR || '/home/jsagi/dev/mindrian-marketplace';

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: marketplace-clean ' + name); }
function fail(name, why) { failed += 1; console.log('FAIL: marketplace-clean ' + name + ' -- ' + why); }

function git(args) {
  const env = Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' });
  const r = spawnSync('git', ['-C', MARKETPLACE].concat(args), { encoding: 'utf8', env, timeout: 60000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

function envGap(reason) {
  console.log('ENV GAP: ' + reason);
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  process.exit(77);
}

if (!fs.existsSync(MARKETPLACE)) envGap('marketplace repo directory missing: ' + MARKETPLACE);

const fetched = git(['fetch', 'origin', 'master']);
if (fetched.error || fetched.status !== 0) {
  envGap('git fetch origin master failed in ' + MARKETPLACE + ': ' + (fetched.stderr || String(fetched.error)).trim().split('\n').slice(-1)[0]);
}

try {
  const tree = git(['ls-tree', 'origin/master', '--name-only']);
  if (tree.status !== 0) {
    fail('ls-tree', 'git ls-tree origin/master exited ' + tree.status + ': ' + tree.stderr.trim());
  } else {
    const names = tree.stdout.split('\n').filter(Boolean);
    if (names.includes('.next')) fail('no .next', 'origin/master still tracks .next (the committed build directory)');
    else pass('no .next on origin/master');

    if (!names.includes('.gitignore')) {
      fail('has .gitignore', 'origin/master has no .gitignore (tree: ' + names.join(', ') + ')');
    } else {
      pass('.gitignore present on origin/master');
      const body = git(['show', 'origin/master:.gitignore']);
      if (body.status !== 0) {
        fail('read .gitignore', 'git show origin/master:.gitignore exited ' + body.status);
      } else {
        const lines = body.stdout.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
        const has = (re) => lines.some((l) => re.test(l));
        if (has(/^\/?\.next\/?$/)) pass('.gitignore lists .next/');
        else fail('.gitignore lists .next/', 'no .next/ line (lines: ' + lines.join(' | ') + ')');
        if (has(/^\/?node_modules\/?$/)) pass('.gitignore lists node_modules/');
        else fail('.gitignore lists node_modules/', 'no node_modules/ line (lines: ' + lines.join(' | ') + ')');
        const bad = lines.filter((l) => /^!?\/?plugins(\/.*)?\*?$/.test(l) && !l.startsWith('!'));
        if (bad.length === 0) pass('.gitignore does not ignore plugins');
        else fail('.gitignore does not ignore plugins', 'ignores plugins: ' + bad.join(' | '));
      }
    }
  }
} catch (e) {
  fail('harness', e && e.message ? e.message : String(e));
}

console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
process.exit(failed > 0 ? 1 : 0);
