#!/usr/bin/env node
'use strict';

/*
 * Quick 261118-o1d: the Theo health file (~/.mindrian/bridge/brain-health.json)
 * gets a writer (lib/core/brain-prewarm.cjs) and a 15-minute TTL on every reader,
 * so one old 'error' no longer pins "Theo is off".
 *
 * Arms:
 *   H1  readBrainHealth: null when the file does not exist.
 *   H2  null for non-JSON, a JSON array or non-object, a missing at, an unparseable at.
 *   H3  null when at is 16 minutes before now, and 16 minutes after now.
 *   H4  'error' for status error at now; 'ok' for status ok at 14 minutes before now.
 *   H5  prewarm with an answering probe writes the file: keys exactly at, origin_host, status.
 *   H6  a rejecting probe and a null probe write status 'error'.
 *   H7  a probe that never settles writes no health file; the marker still says ok false.
 *   H8  prewarm does not throw when the health write fails; return value keeps three keys.
 *   H9  after a health write the bridge folder holds only brain-health.json.
 *   H10 prewarm writes nothing to stdout.
 *   H11 scripts/context-monitor: fresh error = red BRAIN, old error = green, no at = green.
 *   S6  the panel TTL literal (ui/mos-face/hooks/status.ts and lib/mos-face/dist/status.js)
 *       equals BRAIN_HEALTH_TTL_MS, and the dist holds brainFromHealth.
 *
 * Node built-ins only. Every probe is injected, so brain-client is never loaded and no
 * network call is made. Temporary folders are removed at the end.
 *
 * No em dashes or en dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const PREWARM = path.join(ROOT, 'lib', 'core', 'brain-prewarm.cjs');
const mod = require(PREWARM);

let failed = 0;
const tmpDirs = [];
function mkTmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-o1d-'));
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

const NOW_MS = Date.parse('2026-11-18T12:00:00.000Z');
const MIN = 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

function writeHealth(home, text) {
  const p = path.join(home, 'bridge', 'brain-health.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof text === 'string' ? text : JSON.stringify(text), 'utf8');
  return p;
}
function read(home, nowMs) {
  return mod.readBrainHealth({ homeDir: home, nowMs: nowMs === undefined ? NOW_MS : nowMs });
}

async function main() {
  check('E0 exports', typeof mod.readBrainHealth === 'function' && typeof mod.healthPath === 'function'
    && mod.BRAIN_HEALTH_TTL_MS === 900000, 'readBrainHealth, healthPath, BRAIN_HEALTH_TTL_MS');
  if (typeof mod.readBrainHealth !== 'function') return;

  // H1
  {
    const home = mkTmp();
    check('H1 missing file is null', read(home) === null);
  }
  // H2
  {
    const home = mkTmp();
    const cases = [
      ['not json {', 'text not JSON'],
      ['[1,2]', 'JSON array'],
      ['"error"', 'JSON string'],
      ['null', 'JSON null'],
      [{ status: 'error' }, 'missing at'],
      [{ status: 'error', at: 'yesterday-ish' }, 'unparseable at'],
      [{ status: 'error', at: 12345 }, 'at is a number'],
    ];
    for (const [text, label] of cases) {
      writeHealth(home, text);
      check('H2 null for ' + label, read(home) === null);
    }
  }
  // H3
  {
    const home = mkTmp();
    writeHealth(home, { status: 'error', at: iso(NOW_MS - 16 * MIN) });
    check('H3 16 minutes old is null', read(home) === null);
    writeHealth(home, { status: 'error', at: iso(NOW_MS + 16 * MIN) });
    check('H3 16 minutes in the future is null', read(home) === null);
  }
  // H4
  {
    const home = mkTmp();
    writeHealth(home, { status: 'error', at: iso(NOW_MS) });
    check('H4 fresh error is error', read(home) === 'error');
    writeHealth(home, { status: 'ok', at: iso(NOW_MS - 14 * MIN) });
    check('H4 14 minutes old ok is ok', read(home) === 'ok');
  }

  // H5
  {
    const home = mkTmp();
    const r = await mod.prewarm({
      probe: async () => ({ ok: true, body: 'SECRET-BODY-CANARY' }),
      originHost: 'theo.example', now: () => new Date(NOW_MS), homeDir: home, timeoutMs: 2000,
    });
    const p = mod.healthPath(home);
    const exists = fs.existsSync(p);
    const text = exists ? fs.readFileSync(p, 'utf8') : '';
    let o = null;
    try { o = JSON.parse(text); } catch (_e) { /* leave null */ }
    check('H5 file written', exists);
    check('H5 keys exactly at, origin_host, status', !!o && Object.keys(o).sort().join(',') === 'at,origin_host,status',
      o ? Object.keys(o).join(',') : 'no object');
    check('H5 status ok', !!o && o.status === 'ok');
    check('H5 at is now()', !!o && o.at === iso(NOW_MS));
    check('H5 origin_host', !!o && o.origin_host === 'theo.example');
    check('H5 no body canary', !text.includes('CANARY'));
    check('H5 return keeps three keys', Object.keys(r).sort().join(',') === 'at,ok,origin_host');
    // H9
    const left = fs.readdirSync(path.join(home, 'bridge'));
    check('H9 only brain-health.json in bridge', left.length === 1 && left[0] === 'brain-health.json', left.join(','));
  }
  // H6
  {
    const shapes = [['rejecting probe', async () => { throw new Error('boom'); }], ['null probe', async () => null]];
    for (const [label, probe] of shapes) {
      const home = mkTmp();
      await mod.prewarm({ probe, originHost: 'theo.example', now: () => new Date(NOW_MS), homeDir: home, timeoutMs: 2000 });
      let o = null;
      try { o = JSON.parse(fs.readFileSync(mod.healthPath(home), 'utf8')); } catch (_e) { /* null */ }
      check('H6 ' + label + ' writes error', !!o && o.status === 'error');
    }
  }
  // H7
  {
    const home = mkTmp();
    const r = await mod.prewarm({
      probe: () => new Promise(() => {}),
      originHost: 'theo.example', now: () => new Date(NOW_MS), homeDir: home, timeoutMs: 100,
    });
    check('H7 no health file on timeout', !fs.existsSync(mod.healthPath(home)));
    const marker = JSON.parse(fs.readFileSync(mod.markerPath(home), 'utf8'));
    check('H7 marker ok false', marker.ok === false && r.ok === false);
  }
  // H8
  {
    const home = mkTmp();
    fs.writeFileSync(path.join(home, 'bridge'), 'i am a file, not a folder', 'utf8');
    let threw = false;
    let r = null;
    try {
      r = await mod.prewarm({
        probe: async () => ({ ok: true }),
        originHost: 'theo.example', now: () => new Date(NOW_MS), homeDir: home, timeoutMs: 2000,
      });
    } catch (_e) { threw = true; }
    check('H8 no throw when the health write fails', !threw);
    check('H8 return keeps three keys', !!r && Object.keys(r).sort().join(',') === 'at,ok,origin_host');
  }
  // H10
  {
    const home = mkTmp();
    const code = 'const m=require(' + JSON.stringify(PREWARM) + ');'
      + 'm.prewarm({probe:async()=>({ok:true}),originHost:"h",homeDir:' + JSON.stringify(home) + ',timeoutMs:2000}).then(()=>process.exit(0));';
    const c = cp.spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
    check('H10 child exit 0', c.status === 0, 'status ' + c.status);
    check('H10 stdout is empty', c.stdout === '', JSON.stringify(c.stdout));
  }

  // H11
  {
    const visual = require(path.join(ROOT, 'lib', 'core', 'visual-ops.cjs'));
    const RED = visual.ANSI.red + 'BRAIN';
    const GREEN = visual.ANSI.green + 'BRAIN';
    const SCRIPT = path.join(ROOT, 'scripts', 'context-monitor');
    const run = (healthObj) => {
      const tmp = mkTmp();
      fs.mkdirSync(path.join(tmp, '.mindrian', 'bridge'), { recursive: true });
      fs.mkdirSync(path.join(tmp, 'room', '.mindrian'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'STATE.md'), '---\nphase: test\n---\n');
      fs.writeFileSync(path.join(tmp, '.mindrian', 'bridge', 'brain-health.json'), JSON.stringify(healthObj));
      const env = { ...process.env, HOME: tmp, USERPROFILE: tmp };
      delete env.MINDRIAN_HOME;
      const payload = {
        model: { display_name: 'Sonnet' },
        workspace: { current_dir: tmp },
        context_window: { used_percentage: 25, remaining_percentage: 75, context_window_size: 200000 },
      };
      return cp.spawnSync(process.execPath, [SCRIPT], { input: JSON.stringify(payload), cwd: tmp, env, encoding: 'utf8' });
    };
    const fresh = run({ status: 'error', at: new Date().toISOString() });
    const old = run({ status: 'error', at: new Date(Date.now() - 16 * MIN).toISOString() });
    const noAt = run({ status: 'error' });
    // The d02 fixture renders the compact one-line form: no BRAIN word, but a "brain on" chip
    // (the brain emoji then "on") shows when detectBrainStatus says connected and is absent
    // when it says disconnected. The red and green BRAIN forms are checked too when present.
    const strip = (t) => t.replace(/\x1b\[[0-9;]*m/g, '');
    const chip = '\u{1F9E0}on';
    const isConn = (r) => strip(r.stdout).includes(chip) || r.stdout.includes(GREEN);
    const isDisc = (r) => !strip(r.stdout).includes(chip) && !r.stdout.includes(GREEN);
    check('H11 baseline fixture renders (exit 0)', fresh.status === 0 && old.status === 0 && noAt.status === 0);
    check('H11 fresh error is the off form', isDisc(fresh) || fresh.stdout.includes(RED));
    check('H11 old error is the on form', isConn(old) && !old.stdout.includes(RED));
    check('H11 error without at is the on form', isConn(noAt) && !noAt.stdout.includes(RED));
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const m = src.match(/function detectBrainStatus\(\)\s*\{([\s\S]*?)\n\}/);
    const body = m ? m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') : '';
    check('H11 detectBrainStatus calls readBrainHealth', /readBrainHealth\(/.test(body));
  }
}

main().then(() => {
  for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }
  process.stdout.write(failed === 0 ? 'ALL PASS\n' : 'FAILED: ' + failed + '\n');
  process.exit(failed === 0 ? 0 : 1);
}).catch((e) => {
  for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }
  process.stdout.write('ERROR ' + (e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
