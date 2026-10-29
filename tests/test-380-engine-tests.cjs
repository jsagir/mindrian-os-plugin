// 380 engine-test wrapper (D-06, MOD380-02, T-380-03): run `claude plugin test` on ui/mos-face
// and pin the result.
//
// Why: the mod was built without GSD and its handoff claimed 29 tests. The count is measured, not
// trusted: panel.test.tsx declares 34, the engine must pass all of them, and the pass count must
// equal the number of test( declarations found on disk. No original test may be deleted.
// Exit codes: 0 all pass; 1 any failure; 77 the claude CLI is missing (the aggregator treats 77
// from this leg as a FAIL, never a silent skip). Hermetic: needs no network. Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mos-face');
const ORIGINAL_COUNT = 34;
const TIMEOUT_MS = 240000;

let failed = 0;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) say('  ok ' + msg);
  else { failed += 1; say('  FAIL ' + msg); }
}

function onPath(bin) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  return r.status === 0;
}

function declaredTests(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || (e.name === 'types' && d.endsWith('.claude-plugin'))) continue;
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else if (/\.test\.tsx?$/.test(e.name)) {
        const n = (fs.readFileSync(abs, 'utf8').match(/^test\(/gm) || []).length;
        out[path.relative(MOD, abs).split(path.sep).join('/')] = n;
      }
    }
  };
  walk(dir);
  return out;
}

if (!onPath('claude')) {
  say('SKIPPED (ENV GAP): the claude CLI is not on PATH');
  process.exit(77);
}

const declared = declaredTests(MOD);
const total = Object.values(declared).reduce((a, b) => a + b, 0);
const panelCount = declared['panel.test.tsx'];

const run = spawnSync('claude', ['plugin', 'test', '.'], {
  cwd: MOD,
  encoding: 'utf8',
  timeout: TIMEOUT_MS,
  env: Object.assign({}, process.env, { NO_COLOR: '1' }),
});
const text = ((run.stdout || '') + '\n' + (run.stderr || '')).replace(/\x1b\[[0-9;]*m/g, '');

const passMatch = text.match(/^\s*(\d+)\s+pass\b/m);
const failMatch = text.match(/^\s*(\d+)\s+fail\b/m);
const ranMatch = text.match(/Ran\s+(\d+)\s+tests?\s+across\s+(\d+)\s+files?/);

check(!run.error, 'claude plugin test ran' + (run.error ? ' (' + run.error.message + ')' : ''));
check(passMatch !== null, 'a pass count was printed');
check(failMatch !== null, 'a fail count was printed');
check(ranMatch !== null, 'a "Ran N tests across K files" line was printed');

const pass = passMatch ? Number(passMatch[1]) : -1;
const nfail = failMatch ? Number(failMatch[1]) : -1;

check(run.status === 0, 'claude plugin test exit code is 0 (got ' + run.status + ')');
check(nfail === 0, 'fail count is 0 (got ' + nfail + ')');
check(pass === total, 'pass count (' + pass + ') equals the test( declarations on disk (' + total + ')');
check(ranMatch !== null && Number(ranMatch[1]) === pass + (nfail > 0 ? nfail : 0), 'Ran line agrees with the pass count');
check(panelCount === ORIGINAL_COUNT, 'panel.test.tsx declares exactly ' + ORIGINAL_COUNT + ' (the originals stay, got ' + panelCount + ')');

if (failed) {
  say('\nengine output follows:');
  say(text.split('\n').slice(-40).join('\n'));
  process.exit(1);
}
say('engine tests: ' + pass + ' pass, 0 fail (' + ORIGINAL_COUNT + ' original plus ' + (pass - ORIGINAL_COUNT) + ' added)');
process.exit(0);
