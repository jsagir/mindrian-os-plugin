'use strict';
/*
 * Phase 184 -- READER-04 STRUCTURAL guard.
 *
 * Proves decide()'s projection READER is a reader, never a firer -- STRUCTURALLY,
 * not by promise. The test FAILS if a firing path is ever introduced:
 *
 *   (1) the reader + harness modules require ONLY a closed allow-list (node:fs,
 *       node:path, and the sibling reader). They import NO chain-executor, NO
 *       act-command, NO framework-runner, NO command invoker, NO child_process.
 *   (2) the reader + harness source carry ZERO firing tokens (runChain /
 *       chain-executor / act-command / framework-runner / spawnSync / execSync /
 *       child_process / runWorkflow).
 *   (3) navigation-engine.cjs gains NO require of chain-executor / act-command and
 *       carries NO `runChain` literal -- decide() has no code path to firing a
 *       capability (the framework-chain-composer it DOES require only PROPOSES an
 *       offer; it never fires, and its name matches none of the firing tokens).
 *   (4) the reader module exports only reader-shaped functions: no exported key
 *       named run/fire/execute/invoke that would betray a firing surface.
 *
 * Canon Part 8: no Brain / network call. hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const READER_FILE = path.join(REPO_ROOT, 'lib', 'core', 'reader', 'decide-projection-reader.cjs');
const HARNESS_FILE = path.join(REPO_ROOT, 'lib', 'core', 'reader', 'ab-harness.cjs');
const ENGINE_FILE = path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass += 1; }

// strip full-line comments so a header that NAMES a forbidden token in prose cannot
// self-trip the structural sweep (the grep-gate-hygiene rule, mirroring run-all-183).
function codeOf(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); })
    .join('\n');
}

// the closed firing-token set. Any of these in the reader surface is a firing path.
const FIRING_TOKENS = [
  'chain-executor',
  'runChain',
  'act-command',
  'framework-runner',
  'spawnSync',
  'execSync',
  'child_process',
  'runWorkflow',
];

// (1) require allow-list over the reader + harness modules.
(function () {
  const ALLOWED = new Set(['node:fs', 'node:path', './decide-projection-reader.cjs']);
  for (const file of [READER_FILE, HARNESS_FILE]) {
    const code = codeOf(file);
    const re = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    const reqs = [];
    while ((m = re.exec(code)) !== null) reqs.push(m[1]);
    const offenders = reqs.filter(function (r) { return !ALLOWED.has(r); });
    ok('R4: ' + path.basename(file) + ' requires only the closed reader allow-list (offenders: ' + JSON.stringify(offenders) + ')',
       offenders.length === 0);
  }
})();

// (2) zero firing tokens in the reader + harness source.
(function () {
  for (const file of [READER_FILE, HARNESS_FILE]) {
    const code = codeOf(file);
    for (const tok of FIRING_TOKENS) {
      ok('R4: ' + path.basename(file) + ' carries no firing token: ' + tok, code.indexOf(tok) === -1);
    }
  }
})();

// (3) decide() / navigation-engine.cjs has no firing path introduced by READER.
(function () {
  const code = codeOf(ENGINE_FILE);
  ok('R4: navigation-engine.cjs has no require of chain-executor',
     /require\s*\(\s*['"][^'"]*chain-executor[^'"]*['"]\s*\)/.test(code) === false);
  ok('R4: navigation-engine.cjs has no require of act-command',
     /require\s*\(\s*['"][^'"]*act-command[^'"]*['"]\s*\)/.test(code) === false);
  ok('R4: navigation-engine.cjs carries no runChain literal', code.indexOf('runChain') === -1);
  // it DOES require the reader (the READER wiring anchor) -- positive proof the read landed.
  ok('R4: navigation-engine.cjs requires the projection reader (READER wired)',
     /require\s*\(\s*['"]\.\/reader\/decide-projection-reader\.cjs['"]\s*\)/.test(code) === true);
})();

// (4) the reader exports are reader-shaped: no run/fire/execute/invoke surface.
(function () {
  const mod = require(READER_FILE);
  const keys = Object.keys(mod);
  const firingKey = keys.filter(function (k) { return /^(run|fire|execute|invoke)/i.test(k); });
  ok('R4: the reader exports no run/fire/execute/invoke surface (keys: ' + JSON.stringify(keys) + ')',
     firingKey.length === 0);
})();

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-reader-r4-structural-184.cjs: PASSED');
process.exit(0);
