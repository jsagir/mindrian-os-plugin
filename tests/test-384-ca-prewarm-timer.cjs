#!/usr/bin/env node
'use strict';

/*
 * Phase 384 plan 17 (C-A, owner decision 9): checks for lib/core/brain-prewarm.cjs.
 *
 * Groups, chosen by the first argument:
 *   parity  (default, no argument): marker keys, return value, no stdout, early result,
 *           timeout path. Passes on the code before and after the timer fix.
 *   all     parity plus mechanism.
 * The mechanism group (no armed timer after the probe answers, child exit time) is added
 * by the next commit. A run with no argument skips it, so a revert of the fix leaves a
 * no-argument run green.
 *
 * Node built-ins only. The probe is injected, so brain-client is never loaded and no
 * network call is made. Temporary folders are removed at the end. The Brain is never
 * contacted and no real room or home folder is read.
 *
 * No em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const PREWARM = path.join(__dirname, '..', 'lib', 'core', 'brain-prewarm.cjs');
const { prewarm, markerPath } = require(PREWARM);

const group = process.argv[2] || 'parity';
if (!['parity', 'mechanism', 'all'].includes(group)) {
  process.stderr.write('usage: test-384-ca-prewarm-timer.cjs [parity|mechanism|all]\n');
  process.exit(2);
}

let failed = 0;
const tmpDirs = [];
function mkTmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-ca-'));
  tmpDirs.push(d);
  return d;
}
function check(name, cond, note) {
  if (cond) {
    process.stdout.write('ok ' + name + (note ? ' (' + note + ')' : '') + '\n');
  } else {
    failed += 1;
    process.stdout.write('FAIL ' + name + (note ? ' (' + note + ')' : '') + '\n');
  }
}
const FIXED = () => new Date('2026-01-02T03:04:05.000Z');
function timeouts() {
  return process.getActiveResourcesInfo().filter((n) => n === 'Timeout').length;
}

async function parityGroup() {
  // P1 marker keys and return value, four probe shapes.
  const shapes = [
    ['object', async () => ({ ok: true, body: 'SECRET-BODY-CANARY' }), true],
    ['null', async () => null, false],
    ['reject', async () => { throw new Error('boom'); }, false],
    ['never', () => new Promise(() => {}), false],
  ];
  for (const [label, probe, wantOk] of shapes) {
    const home = mkTmp();
    const ret = await prewarm({ probe, originHost: 'example.test', homeDir: home, timeoutMs: 100, now: FIXED });
    const fileText = fs.readFileSync(markerPath(home), 'utf8');
    const onDisk = JSON.parse(fileText);
    const keys = Object.keys(onDisk).sort().join(',');
    check('P1 marker keys (' + label + ')', keys === 'at,ok,origin_host', keys);
    check('P1 marker values (' + label + ')',
      onDisk.ok === wantOk && onDisk.origin_host === 'example.test' && onDisk.at === '2026-01-02T03:04:05.000Z');
    check('P1 return equals file (' + label + ')', JSON.stringify(ret) === JSON.stringify(onDisk));
    check('P1 no body in marker (' + label + ')', !fileText.includes('SECRET-BODY-CANARY'));
  }

  // P2 no stdout and no stderr from a child run.
  {
    const home = mkTmp();
    const code = 'const {prewarm}=require(' + JSON.stringify(PREWARM) + ');' +
      'prewarm({probe:async()=>({ok:true}),originHost:"example.test",timeoutMs:300}).then(()=>{});';
    const env = Object.assign({}, process.env, { MINDRIAN_HOME: home });
    delete env.MINDRIAN_DEBUG;
    const r = cp.spawnSync(process.execPath, ['-e', code], { env, encoding: 'utf8', timeout: 20000 });
    check('P2 child exit 0', r.status === 0, 'status ' + r.status);
    check('P2 child stdout empty', r.stdout === '');
    check('P2 child stderr empty', r.stderr === '');
    check('P2 child wrote marker', fs.existsSync(path.join(home, 'brain-prewarm.json')));
  }

  // P3 early result: prewarm settles at once when the probe answers at once.
  {
    const home = mkTmp();
    const t0 = Date.now();
    await prewarm({ probe: async () => ({ ok: true }), originHost: 'example.test', homeDir: home, timeoutMs: 20000, now: FIXED });
    const ms = Date.now() - t0;
    check('P3 settles before the timer', ms < 1000, ms + ' ms');
  }

  // M3 timeout path: a probe that never settles resolves after timeoutMs with ok false.
  {
    const home = mkTmp();
    const t0 = Date.now();
    const ret = await prewarm({ probe: () => new Promise(() => {}), originHost: 'example.test', homeDir: home, timeoutMs: 100, now: FIXED });
    const ms = Date.now() - t0;
    check('M3 timeout path resolves after timeoutMs', ms >= 90 && ms < 1500 && ret.ok === false, ms + ' ms');
  }
}

async function main() {
  if (group === 'parity' || group === 'all') await parityGroup();
  process.stdout.write(failed === 0 ? 'ca-prewarm: ALL PASS\n' : 'ca-prewarm: ' + failed + ' FAILED\n');
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
  // An unfixed prewarm leaves its timer armed; exit explicitly so a red run does not hang.
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write('ca-prewarm: error ' + (e && e.message ? e.message : String(e)) + '\n');
  process.exit(1);
});
