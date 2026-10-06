// 369.26-09: the render-check harness proven end to end WITHOUT Claude Code.
//
// Why: the live capture needs a logged-in Claude, which is not always here (ENV GAP). What can be
// proven anywhere is the path from "a program prints known ANSI" through a real tmux capture, the
// parser, the item checks, the files written and the cleanup. A fake terminal program
// (tests/fixtures/369.26-render-fake-tty.cjs) plays the part of the screen; a fake `claude` that
// reports loggedIn false proves the exit-77 path. No real session, room or network is touched.
//
// Exit 77 when tmux is not installed (ENV GAP, never a pass). Plain counters, nonzero exit tail.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const RC = path.join(REPO, 'ui', 'mindrian-workspace-mod', 'scripts', 'render-check.cjs');
const FAKE = path.join(REPO, 'tests', 'fixtures', '369.26-render-fake-tty.cjs');

const tmuxV = spawnSync('tmux', ['-V'], { encoding: 'utf8' });
if (tmuxV.error || tmuxV.status !== 0) {
  process.stdout.write('SKIPPED: tmux is not installed (ENV GAP)\n');
  process.exit(77);
}

let passed = 0;
let failed = 0;
function scenario(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok ' + name + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL ' + name + '\n    ' + (e.stack || e.message || String(e)) + '\n');
  }
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369.26-harness-'));
const scratchCount = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('mos-ws-scratch-')).length;
const harnessTmuxProcs = () => {
  const ps = spawnSync('ps', ['-eo', 'args'], { encoding: 'utf8' }).stdout || '';
  return ps.split('\n').filter((l) => /tmux .*-L mos-ws-/.test(l) && !/grep/.test(l)).length;
};

function runRc(label, env, extra) {
  const out = path.join(TMP, label);
  const args = [RC, '--program', 'node ' + FAKE, '--size', '120x30', '--label', label, '--out', out, '--timeout', '30'];
  for (const e of env) args.push('--env', e);
  const r = spawnSync('node', args.concat(extra || []), { encoding: 'utf8', timeout: 90000 });
  let json = null;
  try { json = JSON.parse(fs.readFileSync(path.join(out, label + '.json'), 'utf8')); } catch (e) { json = null; }
  return { r, out, json };
}

const before = scratchCount();

scenario('good known ANSI: tmux capture to parser to checks gives PASS on items 1, 2, 3, 5, 10', () => {
  const { r, out, json } = runRc('good', ['FAKE_MODE=good']);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(json, 'json written');
  assert.strictEqual(json.status, 'ok');
  for (const n of ['1', '2', '3', '5', '10']) assert.strictEqual(json.items[n] && json.items[n].result, 'PASS', 'item ' + n + ': ' + JSON.stringify(json.items[n]));
  assert.strictEqual(json.items['3'].data.filled, 6);
  assert.strictEqual(json.items['2'].data.variant, 'tall');
  assert.ok(json.info.sgrForms['48;2'] > 0, 'truecolor background escapes were captured through tmux');
  for (const ext of ['ansi', 'txt', 'html', 'json']) assert.ok(fs.statSync(path.join(out, 'good.' + ext)).size > 0, ext);
  assert.ok(fs.readFileSync(path.join(out, 'good.html'), 'utf8').startsWith('<!doctype html>'));
  assert.ok(fs.readFileSync(path.join(out, 'good.ansi'), 'utf8').includes('\u001b[48;2;30;58;110m'), 'the blue fill is in the raw capture');
});

scenario('mutated logo: one wrong cell is named, the blocks still pass', () => {
  const { json } = runRc('mutated', ['FAKE_MODE=mutated']);
  assert.ok(json);
  assert.strictEqual(json.items['1'].result, 'PASS');
  assert.strictEqual(json.items['2'].result, 'FAIL');
  assert.ok(/row 1 col 4 wanted mondrian_yellow got mondrian_red/.test(json.items['2'].detail), json.items['2'].detail);
});

scenario('flat output with no colors: item 1 FAILS (no fill), item 2 does not pass', () => {
  const { json } = runRc('flat', ['FAKE_MODE=flat']);
  assert.ok(json);
  assert.strictEqual(json.items['1'].result, 'FAIL');
  assert.notStrictEqual(json.items['2'].result, 'PASS');
  assert.strictEqual(json.info.hasBackground, false);
});

scenario('NO_COLOR run reports what the host did and skips the paint items', () => {
  const { json } = runRc('nocolor', ['FAKE_MODE=flat', 'NO_COLOR=1']);
  assert.ok(json);
  assert.strictEqual(json.items['11'].result, 'PASS');
  assert.strictEqual(json.items['11'].data.keptFill, false);
  assert.strictEqual(json.items['1'], undefined);
  assert.strictEqual(json.items['3'], undefined);
});

scenario('pane open: tab strip and title found, the pane column and band edge are measured', () => {
  const { json } = runRc('pane', ['FAKE_MODE=good', 'FAKE_PANE=1'], ['--pane', 'open']);
  assert.ok(json);
  assert.strictEqual(json.items['9'].result, 'PASS');
  assert.strictEqual(json.items['9'].data.titleDrawn, true);
  assert.strictEqual(json.info.paneOpened, true);
  assert.strictEqual(json.info.paneCol, 94);
  assert.strictEqual(json.items['8'].data.topRow, 0);
  assert.ok(/focused/.test(json.info.paneFocus), json.info.paneFocus);
  assert.strictEqual(json.items['2'].result, 'PASS');
});

scenario('a program that never draws the band: the run reports band_not_drawn, exit 1, and still cleans up', () => {
  const out = path.join(TMP, 'never');
  const r = spawnSync('node', [RC, '--program', 'sleep 30', '--size', '100x20', '--label', 'never', '--out', out, '--timeout', '4'], { encoding: 'utf8', timeout: 60000 });
  assert.strictEqual(r.status, 1, r.stdout + r.stderr);
  const json = JSON.parse(fs.readFileSync(path.join(out, 'never.json'), 'utf8'));
  assert.strictEqual(json.status, 'band_not_drawn');
});

scenario('not logged in: exit 77 with the plain-English sentence and nothing written', () => {
  const bin = path.join(TMP, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, 'claude'),
    '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "9.9.9 (fake)"; exit 0; fi\nif [ "$1" = "auth" ]; then echo \'{"loggedIn": false}\'; exit 0; fi\nexit 3\n',
    { mode: 0o755 },
  );
  const out = path.join(TMP, 'nologin');
  const r = spawnSync('node', [RC, '--sample', 'wide', '--out', out], { encoding: 'utf8', env: Object.assign({}, process.env, { PATH: bin + path.delimiter + process.env.PATH }), timeout: 60000 });
  assert.strictEqual(r.status, 77, r.stdout + r.stderr);
  assert.ok(/not logged in/.test(r.stdout), r.stdout);
  assert.ok(/Nothing was faked and nothing was written/.test(r.stdout));
  assert.strictEqual(fs.existsSync(out), false, 'no output folder was created');
});

scenario('--help exits 0 and names the one command; a bad option exits 2', () => {
  const h = spawnSync('node', [RC, '--help'], { encoding: 'utf8' });
  assert.strictEqual(h.status, 0);
  assert.ok(h.stdout.includes('node ui/mindrian-workspace-mod/scripts/render-check.cjs --all'));
  const b = spawnSync('node', [RC, '--nope'], { encoding: 'utf8' });
  assert.strictEqual(b.status, 2);
});

scenario('INTERIM.md: pending form has twelve rows; a real roll-up has twelve, names plans for 4 and 6, keeps the navigator answer', () => {
  const dir = path.join(TMP, 'interim');
  const w = spawnSync('node', [RC, '--write-pending', '--out', dir], { encoding: 'utf8' });
  assert.strictEqual(w.status, 0, w.stderr);
  const pending = fs.readFileSync(path.join(dir, 'INTERIM.md'), 'utf8');
  for (let n = 1; n <= 12; n += 1) assert.ok(new RegExp('^\\| ' + n + ' \\|', 'm').test(pending), 'row ' + n);
  assert.ok(/PENDING/.test(pending));
  assert.ok(pending.includes('node ui/mindrian-workspace-mod/scripts/render-check.cjs --all'));

  const mod = require(RC);
  const good = JSON.parse(fs.readFileSync(path.join(TMP, 'good', 'good.json'), 'utf8'));
  const md = mod.buildInterim([good], { generated: 'x', host: 'y' }, null);
  for (let n = 1; n <= 12; n += 1) assert.ok(new RegExp('^\\| ' + n + ' \\|', 'm').test(md), 'real row ' + n);
  assert.ok(/^\| 4 \|.*NOT REACHED/m.test(md));
  assert.ok(/^\| 6 \|.*NOT REACHED/m.test(md));
  assert.ok(/plan 14/.test(md) && /plan 17/.test(md));
  assert.ok(/^\| 1 \|.*PASS/m.test(md));

  fs.writeFileSync(path.join(dir, 'INTERIM.md'), md.slice(0, md.indexOf('## Navigator answer')) + '## Navigator answer\n\napproved by test\n');
  mod.writeInterim(dir, [good], { generated: 'z', host: 'h' });
  assert.ok(fs.readFileSync(path.join(dir, 'INTERIM.md'), 'utf8').includes('approved by test'), 'the navigator answer survives a re-run');
});

scenario('cleanup: no scratch folder and no private tmux server is left behind', () => {
  assert.strictEqual(scratchCount(), before);
  assert.strictEqual(harnessTmuxProcs(), 0);
});

fs.rmSync(TMP, { recursive: true, force: true });
process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
