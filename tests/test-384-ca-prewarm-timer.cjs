#!/usr/bin/env node
'use strict';

/*
 * Phase 384 plan 17 (C-A, owner decision 9): checks for lib/core/brain-prewarm.cjs.
 *
 * Groups, chosen by the first argument:
 *   parity  (default, no argument): marker keys, return value, no stdout, early result,
 *           timeout path. Passes on the code before and after the timer fix.
 *   all     parity plus mechanism.
 *   mechanism  no armed timer after the probe answers (M1), child exit time (M2), no armed
 *           timer after the timeout path (M3). RED on code without the timer fix.
 * A run with no argument skips the mechanism group, so a revert of the fix and of this
 * group leaves a no-argument run green.
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

async function mechanismGroup() {
  // M1 no armed timer after the probe answers or fails.
  for (const [label, probe] of [
    ['answer', async () => ({ ok: true })],
    ['reject', async () => { throw new Error('boom'); }],
  ]) {
    const home = mkTmp();
    const before = timeouts();
    await prewarm({ probe, originHost: 'example.test', homeDir: home, timeoutMs: 20000, now: FIXED });
    const after = timeouts();
    check('M1 no armed Timeout after prewarm (' + label + ')', after === before, 'before ' + before + ', after ' + after);
  }

  // M2 a child that only runs prewarm exits soon after the probe answers.
  {
    const home = mkTmp();
    const code = 'const {prewarm}=require(' + JSON.stringify(PREWARM) + ');' +
      'prewarm({probe:async()=>({ok:true}),originHost:"example.test",timeoutMs:8000}).then(()=>{});';
    const env = Object.assign({}, process.env, { MINDRIAN_HOME: home });
    delete env.MINDRIAN_DEBUG;
    const t0 = Date.now();
    const r = cp.spawnSync(process.execPath, ['-e', code], { env, encoding: 'utf8', timeout: 30000 });
    const ms = Date.now() - t0;
    check('M2 child exits within 3000 ms (timeoutMs 8000)', r.status === 0 && ms < 3000, 'status ' + r.status + ', ' + ms + ' ms');
  }

  // M3b the timeout path leaves no Timeout entry either.
  {
    const home = mkTmp();
    const before = timeouts();
    await prewarm({ probe: () => new Promise(() => {}), originHost: 'example.test', homeDir: home, timeoutMs: 100, now: FIXED });
    check('M3 no armed Timeout after the timeout path', timeouts() === before, 'before ' + before + ', after ' + timeouts());
  }
}

async function main() {
  if (group === 'parity' || group === 'all') await parityGroup();
  if (group === 'mechanism' || group === 'all') await mechanismGroup();
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
