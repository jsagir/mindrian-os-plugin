// 380-03 shots harness test (MOD380-01): the real-terminal capture harness of ui/mos-face.
//
// Why: the mos-brand book asks that the panel is measured on a real terminal screen. The harness
// holds a real pseudo-terminal in a private tmux server, reads the screen with its colors, builds a
// self-contained HTML page and takes a PNG with the global Playwright CLI. This test proves the
// pieces: legs P1 to P9 are hermetic unit legs; leg S1 runs the real tmux and Playwright path on a
// fixed ANSI program (no claude session, no model call). Exit 77 when tmux or playwright is missing.
// Plain counters, nonzero exit tail (house harness). CJS, Node built-ins only. Hyphens only.
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const SCRIPTS = path.join(REPO, 'ui', 'mos-face', 'scripts');
const PAGE_PATH = path.join(SCRIPTS, 'lib', 'ansi-page.cjs');
const TMUX_PATH = path.join(SCRIPTS, 'lib', 'tmux-session.cjs');
const CLI_PATH = path.join(SCRIPTS, 'capture-shots.cjs');

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}
function scenario(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}

// dash characters built at run time so this file holds none
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const ESC = String.fromCharCode(27);
const POINTER = String.fromCharCode(0x276f);
const HALF = String.fromCharCode(0x2584);

const tmpDirs = [];
function mktemp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-shots-test-' + tag + '-'));
  tmpDirs.push(d);
  return d;
}

const SAMPLE_BG = {
  blue: [31, 63, 191],
  red: [200, 30, 30],
  yellow: [250, 200, 0],
  black: [17, 17, 17],
  white: [245, 242, 230],
};
function bgRun(rgb, text) { return ESC + '[48;2;' + rgb.join(';') + 'm' + text + ESC + '[0m'; }
function sampleAnsi() {
  let s = '';
  for (const k of Object.keys(SAMPLE_BG)) s += bgRun(SAMPLE_BG[k], '   ') + ' ' + k + '\n';
  s += ESC + '[1mbold line' + ESC + '[0m\n';
  s += ESC + '[2mdim line' + ESC + '[0m\n';
  s += ESC + '[38;2;250;200;0m' + ESC + '[48;2;200;30;30m' + HALF.repeat(6) + ESC + '[0m\n';
  s += ESC + '[7minverse run' + ESC + '[0m\n';
  return s;
}

// P1 to P3: the ANSI page builder
let page = null;
let pageLoadError = null;
try { page = require(PAGE_PATH); } catch (e) { pageLoadError = e; }
function needPage() { if (!page) throw pageLoadError || new Error('ansi-page.cjs is missing'); }

scenario('P1 parseAnsi: cell colors equal the sample and toHtml holds one span per style run and every text line', () => {
  needPage();
  const grid = page.parseAnsi(sampleAnsi(), 40, 12);
  const names = Object.keys(SAMPLE_BG);
  names.forEach((k, row) => {
    const want = '#' + SAMPLE_BG[k].map((n) => (n < 16 ? '0' : '') + n.toString(16)).join('');
    for (let c = 0; c < 3; c += 1) assert.strictEqual(grid.cells[row][c].bg, want, k + ' cell ' + c);
    assert.strictEqual(grid.cells[row][3].bg, null, k + ' gap cell has no fill');
  });
  assert.strictEqual(grid.cells[5][0].bold, true);
  assert.strictEqual(grid.cells[6][0].dim, true);
  assert.strictEqual(grid.cells[7][0].ch, HALF);
  assert.strictEqual(grid.cells[7][0].fg, '#fac800');
  assert.strictEqual(grid.cells[7][0].bg, '#c81e1e');
  assert.strictEqual(grid.cells[8][0].inverse, true);
  const html = page.toHtml(grid, { title: 'p1' });
  const spans = (html.match(/<span/g) || []).length;
  assert.ok(spans >= 5 + 5 + 4, 'at least one span per style run, got ' + spans);
  for (const word of ['blue', 'red', 'yellow', 'black', 'white', 'bold line', 'dim line', 'inverse run']) {
    assert.ok(html.includes(word), 'html holds ' + word);
  }
  assert.ok(html.includes('id="screen"'), 'the pre element has the id screen');
  assert.ok(html.includes('background:#1f3fbf'), 'cobalt background is in the page');
});

scenario('P2 toHtml is deterministic and self-contained', () => {
  needPage();
  const a = page.toHtml(page.parseAnsi(sampleAnsi(), 40, 12), { title: 't' });
  const b = page.toHtml(page.parseAnsi(sampleAnsi(), 40, 12), { title: 't' });
  assert.strictEqual(a, b);
  assert.ok(!/<script/i.test(a), 'no script tag');
  assert.ok(!/https?:\/\//i.test(a), 'no external url');
  assert.ok(!/<link|@import|url\(/i.test(a), 'no linked resource');
  const size = page.pageSize(page.parseAnsi(sampleAnsi(), 40, 12));
  assert.ok(size.width > 0 && size.height > 0, 'pageSize returns a pixel viewport');
  const wide = page.pageSize(page.parseAnsi('x', 120, 40));
  assert.ok(wide.width > size.width && wide.height > size.height, 'a larger grid needs a larger viewport');
});

scenario('P3 a wide character takes 2 cells and keeps the columns aligned', () => {
  needPage();
  const wideCh = String.fromCodePoint(0x4e2d);
  assert.strictEqual(page.cellWidth(wideCh.codePointAt(0)), 2);
  assert.strictEqual(page.cellWidth('a'.codePointAt(0)), 1);
  const grid = page.parseAnsi('a' + wideCh + 'b', 10, 1);
  assert.strictEqual(grid.cells[0][0].ch, 'a');
  assert.strictEqual(grid.cells[0][1].ch, wideCh);
  assert.strictEqual(grid.cells[0][2].ch, '');
  assert.strictEqual(grid.cells[0][3].ch, 'b');
});

// P4 to P9: the tmux session helper
let ts = null;
let tsLoadError = null;
try { ts = require(TMUX_PATH); } catch (e) { tsLoadError = e; }
function needTs() { if (!ts) throw tsLoadError || new Error('tmux-session.cjs is missing'); }

scenario('P4 the slash allow-list accepts registered /mos-* commands and nothing else', () => {
  needTs();
  for (const good of ['/mos-text', '/mos-words', '/mos-refresh', '/mos-state', '/mos-plain', '/mos-face', '/theo-calls']) {
    assert.strictEqual(ts.isAllowedSlash(good), true, good);
  }
  for (const bad of ['/mos-evil', 'mos-text', 'hello', '', '/mos-text\n', '/mos-text\r', '/mos-text now', '/mos-text\n/mos-words', ' /mos-text', '/clear', '/mos-ask', '/mos-advice', null, undefined, 42]) {
    assert.strictEqual(ts.isAllowedSlash(bad), false, JSON.stringify(bad));
  }
  assert.throws(() => ts.assertAllowedSlash('/mos-evil'), /not allow-listed/);
  assert.doesNotThrow(() => ts.assertAllowedSlash('/mos-text'));
});

scenario('P5 trustDialogState: absent, yes and no, from the render-check dialog screens', () => {
  needTs();
  const dlg = (a, b) => ' Quick safety check: Is this a project you trust?\n\n Security guide\n\n ' + a + '\n   ' + b + '\n\n Enter to confirm\n';
  assert.strictEqual(ts.trustDialogState('> hello\n  the band is drawn\n').state, 'absent');
  assert.strictEqual(ts.trustDialogState('').state, 'absent');
  const noFirst = ts.trustDialogState(dlg(POINTER + ' No, exit', 'Yes, I trust this folder'));
  assert.strictEqual(noFirst.state, 'no');
  assert.strictEqual(noFirst.selected, 'No, exit');
  const yesFirst = ts.trustDialogState(dlg(POINTER + ' Yes, I trust this folder', 'No, exit'));
  assert.strictEqual(yesFirst.state, 'yes');
  assert.strictEqual(ts.trustDialogState(dlg('  No, exit', POINTER + ' Yes, I trust this folder')).state, 'yes');
  assert.strictEqual(ts.trustDialogState(dlg('  No, exit', 'Yes, I trust this folder')).state, 'unknown');
  const numbered = ts.trustDialogState(dlg(POINTER + ' 1. Yes, I trust this folder', '2. No, exit'));
  assert.strictEqual(numbered.state, 'yes');
  const numberedNo = ts.trustDialogState(dlg(POINTER + ' 1. No, exit', '2. Yes, I trust this folder'));
  assert.strictEqual(numberedNo.state, 'no');
});

scenario('P6 the child environment drops the five names unless a scenario sets one, and sets COLORTERM truecolor', () => {
  needTs();
  const base = { PATH: '/bin', HOME: '/h', NO_COLOR: '1', CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'x', CLAUDE_CODE_SESSION_ID: 'y', CLAUDE_ACTIVE_ROOM: 'z' };
  const plain = ts.buildChildEnv({ base, scenarioEnv: [], configDir: '/scratch/cfg', roomsHome: '/scratch/rooms' });
  for (const n of ['NO_COLOR', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM']) {
    assert.ok(plain.unset.includes(n), 'unset ' + n);
    assert.strictEqual(plain.set[n], undefined, 'not set ' + n);
  }
  assert.strictEqual(plain.set.COLORTERM, 'truecolor');
  assert.strictEqual(plain.set.CLAUDE_CONFIG_DIR, '/scratch/cfg');
  assert.strictEqual(plain.set.MINDRIAN_ROOMS_HOME, '/scratch/rooms');
  const nc = ts.buildChildEnv({ base, scenarioEnv: ['NO_COLOR=1'], configDir: '/c', roomsHome: '/r' });
  assert.strictEqual(nc.set.NO_COLOR, '1');
  assert.ok(!nc.unset.includes('NO_COLOR'));
  assert.ok(nc.unset.includes('CLAUDECODE'));
  const own = ts.buildChildEnv({ base, scenarioEnv: ['COLORTERM=24bit'], configDir: '/c', roomsHome: '/r' });
  assert.strictEqual(own.set.COLORTERM, '24bit');
  const prefix = ts.envPrefix(nc);
  assert.ok(prefix.startsWith('env '));
  assert.ok(prefix.includes("NO_COLOR='1'"));
  assert.ok(prefix.includes('-u CLAUDECODE'));
  assert.ok(!prefix.includes('-u NO_COLOR'));
});

scenario('P6b inherited session markers are removed too, secrets and our own names stay', () => {
  needTs();
  const base = { PATH: '/bin', CLAUDE_CODE_CHILD_SESSION: '1', CLAUDE_PLUGIN_DATA: '/x', CLAUDE_EFFORT: 'high', MINDRIAN_BRAIN_KEY: 'k', TMUX: '/t,1,0', TMUX_PANE: '%1', CLAUDE_CODE_OAUTH_TOKEN: 'tokentokentoken', ANTHROPIC_API_KEY: 'keykeykeykey' };
  const e = ts.buildChildEnv({ base, scenarioEnv: [], configDir: '/c', roomsHome: '/r' });
  for (const n of ['CLAUDE_CODE_CHILD_SESSION', 'CLAUDE_PLUGIN_DATA', 'CLAUDE_EFFORT', 'MINDRIAN_BRAIN_KEY', 'TMUX', 'TMUX_PANE']) assert.ok(e.unset.includes(n), 'unset ' + n);
  for (const n of ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'CLAUDE_CONFIG_DIR', 'MINDRIAN_ROOMS_HOME']) assert.ok(!e.unset.includes(n), 'kept ' + n);
  assert.strictEqual(new Set(e.unset).size, e.unset.length, 'no name twice');
});

scenario('P7 no em-dash and no en-dash in the new files', () => {
  const files = [PAGE_PATH, TMUX_PATH, CLI_PATH, __filename];
  const hits = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, 'utf8');
    if (s.includes(EM) || s.includes(EN)) hits.push(path.basename(f));
  }
  assert.deepStrictEqual(hits, []);
  assert.ok(fs.existsSync(PAGE_PATH) && fs.existsSync(TMUX_PATH), 'both helper files exist');
});

scenario('P8 the scratch config: credentials symlink, trusted scratch folder only, EnvGap when the login file is missing, nothing written into the real config folder', () => {
  needTs();
  const fakeHome = mktemp('home');
  fs.mkdirSync(path.join(fakeHome, '.claude'));
  const cred = path.join(fakeHome, '.claude', '.credentials.json');
  const before = fs.readdirSync(path.join(fakeHome, '.claude')).sort();
  assert.throws(() => ts.buildScratchConfig({ root: mktemp('cfgroot-a'), workDir: mktemp('wd-a'), homeDir: fakeHome }), (e) => e instanceof ts.EnvGap);
  fs.writeFileSync(cred, '{"fake":"login"}');
  const before2 = fs.readdirSync(path.join(fakeHome, '.claude')).sort();
  const root = mktemp('cfgroot');
  const workDir = mktemp('wd');
  const built = ts.buildScratchConfig({ root, workDir, homeDir: fakeHome });
  assert.ok(fs.lstatSync(path.join(built.configDir, '.credentials.json')).isSymbolicLink(), 'credentials is a symlink');
  assert.strictEqual(fs.readlinkSync(path.join(built.configDir, '.credentials.json')), cred);
  const cfg = JSON.parse(fs.readFileSync(path.join(built.configDir, '.claude.json'), 'utf8'));
  assert.strictEqual(cfg.hasCompletedOnboarding, true);
  assert.strictEqual(cfg.theme, 'dark');
  const keys = Object.keys(cfg.projects);
  assert.strictEqual(keys.length, 1, 'exactly one trusted folder');
  assert.strictEqual(keys[0], fs.realpathSync(workDir));
  assert.strictEqual(cfg.projects[keys[0]].hasTrustDialogAccepted, true);
  assert.deepStrictEqual(fs.readdirSync(path.join(fakeHome, '.claude')).sort(), before2, 'real config folder unchanged');
  assert.notDeepStrictEqual(before, before2);
  // a config folder inside the real config folder is refused
  assert.throws(() => ts.buildScratchConfig({ root: path.join(fakeHome, '.claude', 'x'), workDir, homeDir: fakeHome }), /real config folder/);
  assert.deepStrictEqual(fs.readdirSync(path.join(fakeHome, '.claude')).sort(), before2, 'still unchanged after the refusal');
});

scenario('P9 the transcript builder writes two linked JSON lines at the slug path, reply text unchanged', () => {
  needTs();
  const configDir = mktemp('tcfg');
  const workDir = '/tmp/a.b/c-d';
  const reply = '🟦 **Larry | MindrianOS** one plain sentence.';
  const t = ts.buildTranscript({ configDir, workDir, sessionId: '11111111-2222-4333-8444-555555555555', replyText: reply, version: '2.1.309' });
  assert.strictEqual(ts.projectSlug(workDir), '-tmp-a-b-c-d');
  assert.strictEqual(t.path, path.join(configDir, 'projects', '-tmp-a-b-c-d', '11111111-2222-4333-8444-555555555555.jsonl'));
  const lines = fs.readFileSync(t.path, 'utf8').split('\n').filter((l) => l !== '').map((l) => JSON.parse(l));
  assert.strictEqual(lines.length, 2);
  assert.strictEqual(lines[0].type, 'user');
  assert.strictEqual(lines[0].message.role, 'user');
  assert.strictEqual(typeof lines[0].message.content, 'string');
  assert.strictEqual(lines[0].parentUuid, null);
  assert.strictEqual(lines[1].type, 'assistant');
  assert.strictEqual(lines[1].message.role, 'assistant');
  assert.strictEqual(lines[1].message.content[0].type, 'text');
  assert.strictEqual(lines[1].message.content[0].text, reply);
  assert.strictEqual(lines[1].parentUuid, lines[0].uuid);
  for (const l of lines) {
    assert.strictEqual(l.isSidechain, false);
    assert.strictEqual(l.sessionId, '11111111-2222-4333-8444-555555555555');
    assert.strictEqual(l.cwd, workDir);
    assert.strictEqual(l.version, '2.1.309');
    assert.ok(typeof l.uuid === 'string' && l.uuid.length > 10);
    assert.ok(!Number.isNaN(Date.parse(l.timestamp)));
  }
});

scenario('P10 scrub replaces the home path with HOME', () => {
  needTs();
  const s = ts.scrubWith(['/home/zed/secretdir'], '/home/zed')('see /home/zed/x and /home/zed/secretdir');
  assert.ok(!s.includes('/home/zed'), s);
  assert.ok(s.includes('HOME/x'));
});

// P11 and P12 (plan 380-15, D-08): --session-home, the status line fixture home.
function readerReport(home, room) {
  // The plugin's own readers, run with HOME set to the scratch home: the files are in the formats they accept.
  const code = [
    "const r = (p) => require(require('node:path').join(process.argv[1], p));",
    "const out = {",
    "  next: r('lib/statusline/next-move-cache.cjs').readNextMove(),",
    "  stance: r('lib/core/stance-state.cjs').readStance(),",
    "  health: r('lib/statusline/cockpit-signals.cjs').readHealthStatus(),",
    "  glyph: r('lib/statusline/cockpit-signals.cjs').readVoiceGlyph(),",
    "  postUpdate: r('lib/statusline/cockpit-signals.cjs').readPostUpdateVerification(),",
    "  update: r('lib/statusline/version-resolver.cjs').resolveVersion().update_available_version,",
    "  operator: r('lib/conversation/operator.cjs').getCurrent(process.argv[2]).current,",
    "  job: (r('lib/hmi/jtbd-state.cjs').getCurrent(process.argv[2]) || {}).jtbd,",
    "};",
    "process.stdout.write(JSON.stringify(out));",
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', code, REPO, room], { encoding: 'utf8', env: Object.assign({}, process.env, { HOME: home, USERPROFILE: home }) });
  return JSON.parse(r.stdout);
}

scenario('P11 session home: the fixture files are in the formats the plugin readers accept, and every file is inside the scratch home', () => {
  needTs();
  const root = mktemp('p11');
  const fx = ts.buildStatusFixture(root);
  const got = readerReport(fx.home, fx.room);
  assert.strictEqual(got.next, 'map unknowns');
  assert.strictEqual(got.stance, 'redteam');
  assert.strictEqual(got.health, 'sound');
  assert.ok(typeof got.glyph === 'string' && got.glyph.length > 0, 'a voice glyph is read');
  assert.strictEqual(got.update, '9.9.9');
  assert.strictEqual(got.operator, 'BUILD_ROOM');
  assert.strictEqual(got.job, 'find-bottleneck');
  assert.strictEqual(got.postUpdate, false, 'a healthy fixture writes no failed verification');
  const all = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const a = path.join(d, e.name); if (e.isDirectory()) walk(a); else all.push(a); } })(root);
  assert.ok(all.length >= 12, 'files written: ' + all.length);
  for (const f of all) assert.ok(f.startsWith(root + path.sep), f + ' is inside ' + root);
});

scenario('P11b session home: the home folder of the running process and a room outside the scratch home are refused, with nothing written', () => {
  needTs();
  // The "real home" is played by a scratch folder: the child process has HOME set to it, so if the guard
  // ever failed, the fixture would land in that scratch folder and never in the person's own home.
  const pretendReal = mktemp('p11b-real');
  const code = [
    'const T = require(process.argv[1]);',
    "let msg = 'no error';",
    "try { T.writeStatusFiles({ homeDir: process.argv[2], roomDir: process.argv[2] + '/MindrianRooms/demo-room' }); } catch (e) { msg = e.message; }",
    'process.stdout.write(msg);',
  ].join('\n');
  const r = spawnSync(process.execPath, ['-e', code, TMUX_PATH, pretendReal], { encoding: 'utf8', env: Object.assign({}, process.env, { HOME: pretendReal, USERPROFILE: pretendReal }) });
  assert.ok(/real home/.test(r.stdout), 'the process home is refused: ' + r.stdout);
  assert.deepStrictEqual(fs.readdirSync(pretendReal), [], 'nothing was written');
  const scratch = mktemp('p11b');
  assert.throws(() => ts.writeStatusFiles({ homeDir: scratch, roomDir: path.join(os.tmpdir(), 'elsewhere-room') }), /not inside the scratch home/);
  assert.deepStrictEqual(fs.readdirSync(scratch), []);
});

scenario('P11c session home: the option is in the help, and it is refused with the real config', () => {
  const help = spawnSync(process.execPath, [CLI_PATH, '--help'], { encoding: 'utf8' });
  assert.ok(help.stdout.includes('--session-home'));
  const bad = spawnSync(process.execPath, [CLI_PATH, '--session-home', '--config', 'real', '--plugin', 'x', '--out', mktemp('p11c')], { encoding: 'utf8' });
  assert.strictEqual(bad.status, 2);
  assert.ok(/never into the real one/.test(bad.stderr));
});

scenario('P11d session home: a health, post-update and operator variant also reads back (the drift and restart states)', () => {
  needTs();
  const fx = ts.buildStatusFixture(mktemp('p11d'), { health: 'drift', postUpdate: true, operator: 'DECISION_GATE', stance: 'ask' });
  const got = readerReport(fx.home, fx.room);
  assert.strictEqual(got.health, 'drift');
  assert.strictEqual(got.operator, 'DECISION_GATE');
  assert.strictEqual(got.stance, 'ask');
  // Quick 261029-pnl: the restart cue is the session-start verification result (Phase 341-08), read by the
  // plugin's own reader. The fixture writes that state file, so the reader says true.
  assert.strictEqual(got.postUpdate, true);
  assert.ok(fs.existsSync(path.join(fx.home, '.mindrian', 'session-verify', 'state.json')));
});

// ---- S1: the real self-test (tmux, a fixed ANSI program, Playwright) -------------------------

function onPath(bin) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  return r.status === 0;
}

function pngSize(buf) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(sig)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function selfTest() {
  if (!onPath('tmux') || !onPath('playwright')) {
    process.stdout.write('  SKIP S1 (ENV GAP: tmux or the Playwright CLI is missing)\n');
    return 77;
  }
  if (!fs.existsSync(CLI_PATH)) {
    process.stdout.write('  PENDING S1 (capture-shots.cjs is written by task 2 of plan 380-03)\n');
    return 0;
  }
  const out = mktemp('s1');
  // the fixed program: five canon colors as truecolor blocks, bold, dim, a half-block row
  const programFile = path.join(mktemp('prog'), 'sample.sh');
  // the program honors NO_COLOR like a well-behaved terminal program: no escape sequences at all
  const lines = ['if [ -n "$NO_COLOR" ]; then'];
  for (const k of Object.keys(SAMPLE_BG)) lines.push("  printf '     %s block\\n' " + k);
  lines.push("  printf 'bold sample line\\n'", "  printf 'dim sample line\\n'", "  printf '######  half sample row\\n'", 'else');
  for (const k of Object.keys(SAMPLE_BG)) lines.push("  printf '\\033[48;2;" + SAMPLE_BG[k].join(';') + "m     \\033[0m " + k + " block\\n'");
  lines.push("  printf '\\033[1mbold sample line\\033[0m\\n'");
  lines.push("  printf '\\033[2mdim sample line\\033[0m\\n'");
  lines.push("  printf '\\033[38;2;250;200;0m\\033[48;2;200;30;30m\\342\\226\\204\\342\\226\\204\\342\\226\\204\\342\\226\\204\\342\\226\\204\\342\\226\\204\\033[0m half sample row\\n'");
  lines.push('fi', 'sleep 20');
  fs.writeFileSync(programFile, lines.join('\n') + '\n');
  const r = spawnSync('node', [CLI_PATH, '--plugin', path.join(REPO, 'ui', 'mos-face'), '--out', out, '--scenarios', 'std,nocolor', '--program', 'sh ' + programFile, '--wait-text', 'half sample row', '--settle-ms', '800'], { encoding: 'utf8', timeout: 180000 });
  if (r.status === 77) {
    process.stdout.write('  SKIP S1 (ENV GAP): ' + (r.stdout + r.stderr).trim().split('\n').slice(-1)[0] + '\n');
    return 77;
  }
  scenario('S1 the capture CLI exits 0 on the fixed program', () => {
    assert.strictEqual(r.status, 0, 'exit ' + r.status + '\n' + r.stdout + r.stderr);
  });
  for (const name of ['std', 'nocolor']) {
    scenario('S1 ' + name + ' PNG is a real PNG, large enough, with a sane size', () => {
      const f = path.join(out, name + '.png');
      assert.ok(fs.existsSync(f), 'png exists');
      const buf = fs.readFileSync(f);
      assert.ok(buf.length > 2000, 'png larger than 2000 bytes, got ' + buf.length);
      const size = pngSize(buf);
      assert.ok(size, 'png signature bytes');
      assert.ok(size.width >= 400 && size.height >= 300, 'size ' + size.width + 'x' + size.height);
    });
    scenario('S1 ' + name + ' text capture holds the sample words', () => {
      const txt = fs.readFileSync(path.join(out, name + '.txt'), 'utf8');
      for (const w of ['blue block', 'red block', 'yellow block', 'black block', 'white block', 'bold sample line', 'dim sample line', 'half sample row']) {
        assert.ok(txt.includes(w), name + ' text holds ' + w);
      }
    });
  }
  scenario('S1 std ANSI capture holds the cobalt sequence 1F3FBF (RGB 31 63 191)', () => {
    const ansi = fs.readFileSync(path.join(out, 'std.ansi'), 'utf8');
    assert.ok(/48;2;31;63;191/.test(ansi), 'cobalt background sequence');
  });
  scenario('S1 nocolor ANSI capture holds no 48;2 sequence', () => {
    const ansi = fs.readFileSync(path.join(out, 'nocolor.ansi'), 'utf8');
    assert.ok(!/48;2/.test(ansi), 'no truecolor background sequence');
  });
  scenario('S1 index.json names both scenarios and the files', () => {
    const idx = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8'));
    const names = idx.scenarios.map((s) => s.name).sort();
    assert.deepStrictEqual(names, ['nocolor', 'std']);
    for (const s of idx.scenarios) {
      assert.ok(s.files.png && s.files.ansi && s.files.txt && s.files.html);
      assert.ok(Array.isArray(s.envNames));
    }
  });
  // S2 (plan 380-15): the same fixed program under --session-home. The program lists the scratch HOME,
  // so the files are proven to sit in the home the session sees, and nothing is read from the real one.
  {
    const out2 = mktemp('s2');
    const prog = path.join(mktemp('prog2'), 'home.sh');
    fs.writeFileSync(prog, 'echo "HOMEROOT $HOME"\nls "$HOME/.mindrian" | sed "s/^/MIND /"\ncat "$HOME/.mindrian/next-move.json"\nsleep 20\n');
    const r2 = spawnSync('node', [CLI_PATH, '--plugin', path.join(REPO, 'ui', 'mos-face'), '--out', out2, '--scenarios', 'std', '--program', 'sh ' + prog, '--wait-text', 'map unknowns', '--session-home', '--settle-ms', '800'], { encoding: 'utf8', timeout: 180000 });
    scenario('S2 --session-home: the session sees the status files in its own scratch HOME', () => {
      assert.strictEqual(r2.status, 0, 'exit ' + r2.status + '\n' + r2.stdout + r2.stderr);
      const txt = fs.readFileSync(path.join(out2, 'std.txt'), 'utf8');
      for (const w of ['MIND next-move.json', 'MIND room-health.json', 'MIND stance-state.json', 'MIND update-check.json', 'MIND install-state.json', 'map unknowns']) assert.ok(txt.includes(w), 'the screen holds ' + w);
      const idx = JSON.parse(fs.readFileSync(path.join(out2, 'index.json'), 'utf8'));
      assert.ok(idx.scenarios[0].sessionHome.includes('.mindrian/next-move.json'));
      assert.ok(idx.scenarios[0].sessionHome.some((f) => /conversation-operator\.json$/.test(f)));
    });
  }
  if (process.env.MOS_SHOTS_KEEP) {
    process.stdout.write('  kept S1 output in ' + out + '\n');
    tmpDirs.splice(tmpDirs.indexOf(out), 1);
  }
  return 0;
}

let tail = 0;
if (process.argv.includes('--unit-only')) process.stdout.write('  S1 skipped by --unit-only\n');
else tail = selfTest();

for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best effort */ } }

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed) process.exit(1);
process.exit(tail === 77 ? 77 : 0);
