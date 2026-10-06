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

// ---- 369.26-17: the script runner, the live room, the probe and the final report ------------------

const liveDirCount = () => fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('mos-ws-live-')).length;
const liveBefore = liveDirCount();

scenario('17 script runner: type, key, burst and capture reach the real screen in order; inspect without a live room says so', () => {
  const script = path.join(TMP, 's-keys.txt');
  fs.writeFileSync(script, 'wait 300\ncapture one\ntype abc\nkey Enter\nburst x y\nwait 300\ncapture two\ninspect nothing\n');
  const { r, out, json } = runRc('script', ['FAKE_MODE=good'], ['--script', script]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(Object.keys(json.frames), ['one', 'two']);
  assert.ok(/abc/.test(json.frames.two) && !/abc/.test(json.frames.one), 'typed text shows only in the later frame');
  assert.ok(/xy/.test(json.frames.two), 'a burst of two keys went in as one command');
  assert.ok(json.inspections.nothing.error, 'no live room: said so, nothing faked');
  for (const ext of ['ansi', 'txt', 'html']) assert.ok(fs.statSync(path.join(out, 'script-two.' + ext)).size > 0, ext);
});

scenario('17 live run: a hermetic room is built, read back (no decision yet), and removed with its child process', () => {
  const script = path.join(TMP, 's-live.txt');
  fs.writeFileSync(script, 'wait 200\ninspect before\n');
  const { r, json } = runRc('live', ['FAKE_MODE=good'], ['--live', '--script', script]);
  if (/ENV GAP/.test(r.stdout)) { process.stdout.write('    SKIPPED live arm (ENV GAP: MCP client package missing)\n'); return; }
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.strictEqual(json.inspections.before.readable, true);
  assert.deepStrictEqual(json.inspections.before.decisionNodes, []);
  assert.strictEqual(json.inspections.before.gateAnswer.found, false);
  assert.strictEqual(liveDirCount(), liveBefore, 'the live room folder was removed');
});

scenario('17 half-block probe: the three-file throwaway mod is written outside the repo, validates, and the glyph check reads red over yellow', () => {
  const mod = require(RC);
  const dir = path.join(TMP, 'probe-mod');
  mod.writeHalfblockProbe(dir);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['.claude-plugin', 'hooks', 'src']);
  assert.ok(!path.resolve(dir).startsWith(REPO), 'not under the repo');
  assert.ok(fs.readFileSync(path.join(dir, 'src', 'register.tsx'), 'utf8').includes('u2580'));
  const v = spawnSync('claude', ['plugin', 'validate', dir], { encoding: 'utf8', timeout: 60000 });
  if (!v.error) assert.ok(/Validation passed/.test(v.stdout + v.stderr), v.stdout + v.stderr);
  const G = require(path.join(REPO, 'ui', 'mindrian-workspace-mod', 'scripts', 'lib', 'ansi-grid.cjs'));
  const E = String.fromCharCode(27);
  const pal = JSON.parse(fs.readFileSync(path.join(REPO, 'ui', 'mindrian-workspace-mod', 'assets', 'palette.json'), 'utf8'));
  const good = G.parseAnsi(E + '[38;2;166;61;47m' + E + '[48;2;200;164;60m▀' + E + '[0m', 4, 1);
  assert.strictEqual(mod.analyzeHalfblock(good, pal).result, 'PASS');
  const bad = G.parseAnsi(E + '[38;2;166;61;47m▀' + E + '[0m', 4, 1);
  assert.strictEqual(mod.analyzeHalfblock(bad, pal).result, 'FAIL');
  assert.strictEqual(mod.analyzeHalfblock(G.parseAnsi('plain', 4, 1), pal).result, 'FAIL');
});

scenario('17 final report: twelve item rows, every live step PENDING-HUMAN with no frames, and the navigator answer left open', () => {
  const mod = require(RC);
  const P = require(path.join(REPO, 'ui', 'mindrian-workspace-mod', 'scripts', 'lib', 'live-pure.cjs'));
  const fake = { label: 'live-roundtrip', sample: '(live room)', size: '160x45', pane: 'none', env: [], script: 'roundtrip', status: 'ok', files: { html: 'live-roundtrip.html' }, items: {}, info: {}, host: {}, frames: {}, inspections: {}, judgement: { kind: 'roundtrip', verdicts: P.judgeRoundTrip({ frames: {}, inspection: {}, deck: {} }) } };
  const md = mod.buildFinalReport([fake], { generated: 'now', host: 'test' });
  for (let n = 1; n <= 12; n += 1) assert.ok(new RegExp('^\\| ' + n + ' \\|', 'm').test(md), 'row ' + n);
  assert.ok(/PENDING-HUMAN/.test(md));
  assert.ok(!/\| PASS \|/.test(md.split('## Live gate round trip')[1].split('## MCP')[0]), 'no live step is passed without a frame');
  assert.ok(/Navigator answer[\s\S]*\(not yet given\)/.test(md));
  assert.ok(!/\u2014/.test(md), 'no em-dash');
  const runs = mod.finalRuns(null);
  assert.strictEqual(new Set(runs.map((x) => x.label)).size, runs.length, 'labels are unique');
  for (const sample of ['wide', 'narrow', 'missing']) for (const size of ['55x40', '80x24', '110x30', '120x40', '160x45', '200x60']) for (const pane of ['none', 'open']) assert.ok(runs.some((x) => x.label === 'size-' + sample + '-' + size + '-' + pane), sample + size + pane);
  for (const sample of ['empty', 'limit', 'drift', 'broken', 'several', 'nofile', 'noroom', 'unreadable']) assert.ok(runs.some((x) => x.label === 'state-' + sample + '-160x45') && runs.some((x) => x.label === 'state-' + sample + '-55x40'), sample);
  assert.ok(runs.some((x) => x.label === 'size-wide-72x30-none'));
  assert.ok(runs.some((x) => x.probe === 'halfblock') && runs.some((x) => x.listMcp));
  assert.strictEqual(runs.filter((x) => x.live).length, 4);
});

scenario('17 --final not logged in: exit 77, nothing written', () => {
  const bin = path.join(TMP, 'bin2');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "9.9.9 (fake)"; exit 0; fi\nif [ "$1" = "auth" ]; then echo \'{"loggedIn": false}\'; exit 0; fi\nexit 3\n', { mode: 0o755 });
  const out = path.join(TMP, 'finalnologin');
  const r = spawnSync('node', [RC, '--final', '--out', out], { encoding: 'utf8', env: Object.assign({}, process.env, { PATH: bin + path.delimiter + process.env.PATH }), timeout: 60000 });
  assert.strictEqual(r.status, 77, r.stdout + r.stderr);
  assert.strictEqual(fs.existsSync(out), false);
});

scenario('17 gate probe: the no-login measurements run in a hermetic room and say what the runtime does', () => {
  const GP = path.join(REPO, 'ui', 'mindrian-workspace-mod', 'scripts', 'gate-probe.cjs');
  const r = spawnSync('node', [GP], { encoding: 'utf8', timeout: 120000 });
  if (r.status === 77) { process.stdout.write('    SKIPPED gate probe (ENV GAP: MCP client package missing)\n'); return; }
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  const m = JSON.parse(r.stdout);
  assert.strictEqual(m.binding.env_only.room_binding.bound, false, 'CLAUDE_ACTIVE_ROOM alone does not bind');
  assert.strictEqual(m.binding.binding_file.room_binding.bound, true, 'a binding file for the session id does');
  assert.strictEqual(m.direct_press.reply.reason, 'unknown_gate');
  assert.strictEqual(m.direct_press.room_records_unchanged, true);
  assert.strictEqual(m.session_mismatch.reply.reason, 'session_mismatch');
  assert.strictEqual(m.mirror.ok, true);
  assert.strictEqual(m.mirror.new_id_differs, true);
  assert.strictEqual(m.mirror.records_unchanged, true);
  assert.strictEqual(m.decide_later.records_identical_across_reads, true);
  assert.strictEqual(m.answer.exactly_one_decision, true);
  assert.strictEqual(m.answer.recorded_route, 'mcp_relayed');
  assert.strictEqual(m.answer.owner_afterwards.answered_elsewhere, true);
  assert.strictEqual(m.card_pending.claude_code_cli_declaring_elicitation.elicitation, false);
  assert.strictEqual(typeof m.servers.mindrian_brain.wanted_present.framework_techniques, 'boolean');
  assert.deepStrictEqual(m.servers.manifest.names_claude_code_gives_them, ['plugin:mos:mindrian-os', 'plugin:mos:mindrian-brain']);
  assert.strictEqual(fs.readdirSync(os.tmpdir()).filter((n) => n.startsWith('mos-ws-gateprobe-')).length, 0, 'the probe removed its folders');
});

scenario('cleanup: no scratch folder and no private tmux server is left behind', () => {
  assert.strictEqual(scratchCount(), before);
  assert.strictEqual(harnessTmuxProcs(), 0);
  assert.strictEqual(liveDirCount(), liveBefore);
});

fs.rmSync(TMP, { recursive: true, force: true });
process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
