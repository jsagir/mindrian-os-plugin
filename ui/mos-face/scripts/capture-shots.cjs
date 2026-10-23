#!/usr/bin/env node
// 380-03: the real-terminal capture CLI (MOD380-01).
//
// Why: the mos-brand book asks that the panel is measured on a real terminal screen, never from
// props alone. This CLI turns a real Claude Code session into PNG files with no human step:
//   a private tmux server holds a real pseudo-terminal
//   tmux capture-pane -e reads the screen with its colors
//   lib/ansi-page.cjs turns the ANSI text into one self-contained HTML page
//   the global Playwright CLI takes the PNG from a file:// page.
// It never submits a model prompt and never calls a model. The default session runs in a scratch config
// folder, a scratch HOME and a throwaway rooms home, so nothing real is read or written (T-380-09).
//
// Limit, stated: the capture shows tmux's screen drawn with the harness font (DejaVu Sans Mono) on the
// harness ink background. The person's own terminal font and theme can differ.
//
// Exit codes: 0 done, 1 a scenario failed, 2 bad arguments, 77 ENV GAP (one plain sentence).
// Build tooling (CJS, node built-ins only, process.argv switch router). Hyphens only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const P = require('./lib/ansi-page.cjs');
const T = require('./lib/tmux-session.cjs');

const SCENARIOS = {
  wide: { cols: 120, rows: 40, env: [], note: 'wide terminal' },
  std: { cols: 80, rows: 24, env: [], note: 'the 80 by 24 floor' },
  narrow: { cols: 50, rows: 30, env: [], note: 'under 60 columns' },
  nocolor: { cols: 80, rows: 24, env: ['NO_COLOR=1'], note: 'NO_COLOR set' },
  small: { cols: 28, rows: 20, env: [], note: 'under the 30 column floor (the too-small state)' },
  chip: { cols: 100, rows: 30, env: [], note: 'reply chip from a resumed synthetic transcript', resume: true },
};
const DEFAULT_SCENARIOS = ['wide', 'std', 'narrow', 'nocolor', 'small'];

const USAGE = [
  'Usage: node scripts/capture-shots.cjs --plugin <folder> --out <folder> [options]',
  '',
  'Turns a real Claude Code session into PNG, ANSI, text and HTML files, one set per scenario.',
  '',
  'Options:',
  '  --plugin <folder>       the plugin folder passed to claude --plugin-dir (repeat for more than one)',
  '  --out <folder>          where the files go',
  '  --scenarios <list>      comma list of: wide (120x40), std (80x24), narrow (50x30), nocolor (80x24, NO_COLOR),',
  '                          small (28x20), chip (100x30, resumed synthetic transcript). Default: wide,std,narrow,nocolor,small',
  '  --program <command>     test mode: run this shell command instead of claude (no login needed)',
  '  --keys <command>        one allow-listed slash command, typed after the panel shows (never a prompt)',
  '  --settle-ms <n>         wait this long after the screen is ready (default 2500)',
  '  --wait-text <text>      wait until this text is on the screen (default: /m:os; 60 second limit)',
  '  --config scratch|real   scratch (default): scratch config folder, HOME and rooms home.',
  '                          real: the session as the person sees it (their plugins and status line).',
  '                          Nothing is written by hand into the real ~/.claude. The files may show real room names.',
  '  --session-home          fill the scratch HOME with the status line files (next move, Theo health, room health,',
  '                          stance, voice mark, update check, install record, and in the demo room the mode, the recorded',
  '                          job and the stale list), in the formats the plugin readers accept, so the panel shows real',
  '                          values for every status line field (plan 380-15, D-08). Scratch config only; HOME goes to',
  '                          the session only and nothing is written into the real home',
  '  --reply-text <text>     the assistant line of the chip scenario (default: a fixed test sentence)',
  '  --help                  this text',
  '',
  'Exit codes: 0 done, 1 a scenario failed, 2 bad arguments, 77 ENV GAP.',
].join('\n');

class UsageError extends Error {}

function parseArgs(argv) {
  const a = { plugins: [], out: null, scenarios: DEFAULT_SCENARIOS.slice(), program: null, keys: null, settleMs: 2500, waitText: null, config: 'scratch', replyText: null, sessionHome: false, help: false };
  const needValue = (i, flag) => {
    if (i + 1 >= argv.length) throw new UsageError(flag + ' needs a value');
    return argv[i + 1];
  };
  for (let i = 0; i < argv.length; i += 1) {
    const f = argv[i];
    switch (f) {
      case '--help': case '-h': a.help = true; break;
      case '--plugin': a.plugins.push(needValue(i, f)); i += 1; break;
      case '--out': a.out = needValue(i, f); i += 1; break;
      case '--scenarios': a.scenarios = needValue(i, f).split(',').map((s) => s.trim()).filter(Boolean); i += 1; break;
      case '--program': a.program = needValue(i, f); i += 1; break;
      case '--keys': a.keys = needValue(i, f); i += 1; break;
      case '--settle-ms': a.settleMs = Number(needValue(i, f)); i += 1; break;
      case '--wait-text': a.waitText = needValue(i, f); i += 1; break;
      case '--config': a.config = needValue(i, f); i += 1; break;
      case '--reply-text': a.replyText = needValue(i, f); i += 1; break;
      case '--session-home': a.sessionHome = true; break;
      default: throw new UsageError('unknown option ' + f);
    }
  }
  if (a.help) return a;
  if (a.plugins.length === 0 && !a.program) throw new UsageError('--plugin is required');
  if (!a.out) throw new UsageError('--out is required');
  if (!Number.isFinite(a.settleMs) || a.settleMs < 0) throw new UsageError('--settle-ms must be a number');
  if (a.config !== 'scratch' && a.config !== 'real') throw new UsageError('--config must be scratch or real');
  for (const s of a.scenarios) if (!SCENARIOS[s]) throw new UsageError('unknown scenario ' + s + ' (want ' + Object.keys(SCENARIOS).join(', ') + ')');
  if (a.sessionHome && a.config === 'real') throw new UsageError('--session-home needs the scratch config: it writes fixture files into a scratch home, never into the real one');
  if (a.keys !== null && !T.isAllowedSlash(a.keys)) throw new UsageError('--keys must be one allow-listed command (' + T.ALLOWED_SLASH.join(', ') + ')');
  if (a.scenarios.includes('chip') && (a.config === 'real' || a.program)) throw new UsageError('the chip scenario needs the scratch config and a real claude session (it writes a synthetic transcript into the scratch config folder only)');
  return a;
}

// A throwaway rooms home under the scratch HOME: a registry that names one active room demo-room and a
// STATE.md with a venture stage and two sections (market-analysis with 3 entries, problem-definition with 0).
function buildRoomsHome(scratchHome) {
  const roomsHome = path.join(scratchHome, 'MindrianRooms');
  const room = path.join(roomsHome, 'demo-room');
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.mkdirSync(path.join(room, 'market-analysis'), { recursive: true });
  fs.mkdirSync(path.join(room, 'problem-definition'), { recursive: true });
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify({ active: 'demo-room', rooms: { 'demo-room': { path: room } }, sessions: {} }, null, 2) + '\n');
  const state = [
    '---', 'current_room: demo-room', 'venture_stage: Discovery', 'total_entries: 3', '---', '',
    '# Demo room', '', '## Sections', '',
    '| Section | Entries | Progress | Status | Updated |', '|---|---|---|---|---|',
    '| market-analysis | 3 | ###..... | active | 2026-10-01 |',
    '| problem-definition | 0 | ........ | empty | 2026-10-01 |', '',
  ].join('\n');
  fs.writeFileSync(path.join(room, 'STATE.md'), state);
  fs.writeFileSync(path.join(room, 'ROOM.md'), '# Demo room\n\nA throwaway room for the screenshot harness.\n');
  for (let i = 1; i <= 3; i += 1) fs.writeFileSync(path.join(room, 'market-analysis', 'entry-' + i + '.md'), '# Entry ' + i + '\n');
  return roomsHome;
}

function screenshot(htmlPath, pngPath, size) {
  const args = ['screenshot', '--viewport-size', size.width + ',' + size.height, '--wait-for-selector', '#screen', '--wait-for-timeout', '400', pathToFileURL(htmlPath).href, pngPath];
  const r = spawnSync('playwright', args, { encoding: 'utf8', timeout: 90000 });
  if (r.status !== 0) throw new Error('playwright screenshot failed: ' + String(r.stderr || r.stdout || r.error || '').trim().split('\n').slice(-3).join(' | '));
}

async function captureOne(name, args, env) {
  const sc = SCENARIOS[name];
  const out = path.resolve(args.out);
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-face-shots-'));
  const sock = 'mos-face-' + process.pid + '-' + name;
  const entry = { name, columns: sc.cols, rows: sc.rows, note: sc.note, status: 'started', envNames: [], answered: [], files: {}, truecolor: null, capturedAt: null };
  const real = args.config === 'real';
  const home = process.env.HOME || os.homedir();
  const secrets = T.secretValues(process.env);
  const scrub = T.scrubWith(secrets, home);
  let session = null;
  const fail = (s) => { if (entry.status === 'started') entry.status = s; };
  try {
    const workDir = path.join(scratchRoot, 'work');
    fs.mkdirSync(workDir);
    let scratchHome = null;
    let configDir = null;
    let roomsHome;
    if (real) {
      roomsHome = buildRoomsHome(path.join(scratchRoot, 'rooms-home'));
    } else if (args.program) {
      scratchHome = path.join(scratchRoot, 'home');
      roomsHome = buildRoomsHome(scratchHome);
    } else {
      scratchHome = path.join(scratchRoot, 'home');
      roomsHome = buildRoomsHome(scratchHome);
      configDir = T.buildScratchConfig({ root: scratchRoot, workDir }).configDir;
    }
    if (args.sessionHome) {
      // The status line files go into the scratch HOME only; writeStatusFiles refuses the real home.
      const written = T.writeStatusFiles({ homeDir: scratchHome, roomDir: path.join(roomsHome, 'demo-room') });
      entry.sessionHome = written.map((f) => path.relative(scratchHome, f).split(path.sep).join('/'));
    }
    const childEnv = T.buildChildEnv({ base: process.env, scenarioEnv: sc.env, configDir, roomsHome, homeDir: scratchHome });
    entry.envNames = childEnv.names.concat(childEnv.unset.map((n) => '-' + n));

    let inner;
    let sessionId = null;
    if (args.program) {
      inner = 'sh -c ' + T.shq(args.program);
    } else {
      inner = 'claude ' + args.plugins.map((d) => '--plugin-dir ' + T.shq(path.resolve(d))).join(' ');
      if (sc.resume) {
        sessionId = crypto.randomUUID();
        const ver = (T.run('claude', ['--version']).stdout || '').trim().split(/\s+/)[0] || '2.1.309';
        T.buildTranscript({ configDir, workDir: fs.realpathSync(workDir), sessionId, replyText: args.replyText === null ? undefined : args.replyText, version: ver });
        inner += ' --resume ' + sessionId;
      }
    }
    const command = T.envPrefix(childEnv) + ' ' + inner + '; echo "CLAUDE_EXIT=$?"; sleep ' + T.LINGER_SEC;
    session = T.startSession({ sock, cols: sc.cols, rows: sc.rows, cwd: workDir, command, env: process.env });
    entry.terminal = { defaultTerminal: session.option('default-terminal'), term: 'set by tmux, not by the harness' };

    const waitText = args.waitText !== null ? args.waitText : (args.program ? '' : '/m:os');
    const deadline = Date.now() + 60000;
    let ready = false;
    let exited = false;
    let quietUntil = 0;
    while (Date.now() < deadline) {
      const screen = session.cap();
      if (T.EXIT_RE.test(screen)) { exited = true; break; }
      if (Date.now() >= quietUntil) {
        const step = await T.answerTrust(session, screen, entry.answered);
        if (step === 'answered' || step === 'gone') { quietUntil = Date.now() + 1500; await T.sleep(150); continue; }
        if (step === 'waiting') { await T.sleep(150); continue; }
        if (step === 'refused') { fail('trust_dialog_unanswered'); break; }
        if (!args.program && /Press Enter to continue/i.test(screen)) {
          session.keyName('Enter');
          entry.answered.push('"Press Enter to continue" dialog: pressed Enter');
          quietUntil = Date.now() + 1500;
          await T.sleep(150);
          continue;
        }
      }
      if (waitText !== '' ? screen.includes(waitText) : screen.trim() !== '') { ready = true; break; }
      if (!session.alive()) break;
      await T.sleep(400);
    }
    if (!ready) fail(exited || !session.alive() ? 'session_exited' : 'wait_text_not_seen');
    else {
      await T.sleep(args.settleMs);
      if (args.keys) {
        const sent = await T.submitSlashSafely(session, args.keys);
        entry.answered.push('slash step: ' + sent.notes.join(' ; '));
        if (!sent.ok) fail('slash_step_unsafe');
        else await T.sleep(args.settleMs);
      }
    }

    // always keep the last screen, also from a failed run, so the failure can be read
    const ansi = scrub(session.capAnsi());
    const plain = scrub(session.cap());
    entry.truecolor = /38;2;|48;2;/.test(ansi);
    const grid = P.parseAnsi(ansi, sc.cols, sc.rows);
    fs.mkdirSync(out, { recursive: true });
    const files = { png: name + '.png', ansi: name + '.ansi', txt: name + '.txt', html: name + '.html' };
    fs.writeFileSync(path.join(out, files.ansi), ansi);
    fs.writeFileSync(path.join(out, files.txt), plain);
    fs.writeFileSync(path.join(out, files.html), P.toHtml(grid, { title: name + ' ' + sc.cols + 'x' + sc.rows }));
    entry.files = files;
    screenshot(path.join(out, files.html), path.join(out, files.png), P.pageSize(grid));
    entry.capturedAt = new Date().toISOString();
    if (entry.status === 'started') entry.status = 'ok';
  } catch (e) {
    if (e instanceof T.EnvGap) throw e;
    entry.status = 'error';
    entry.error = scrub(String((e && e.message) || e));
  } finally {
    if (session) session.kill();
    // claude needs a moment to leave after the hangup; remove the scratch folders only then
    await T.sleep(session ? 1500 : 0);
    try { fs.rmSync(scratchRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }); } catch (e) { /* best effort */ }
  }
  return entry;
}

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    if (e instanceof UsageError) { process.stderr.write('capture-shots: ' + e.message + '\n\n' + USAGE + '\n'); return 2; }
    throw e;
  }
  if (args.help) { process.stdout.write(USAGE + '\n'); return 0; }
  let info;
  try {
    info = T.preflight({ program: args.program });
  } catch (e) {
    if (e instanceof T.EnvGap) { process.stderr.write('ENV GAP: ' + e.message + '\n'); return 77; }
    throw e;
  }
  const results = [];
  let gap = null;
  for (const name of args.scenarios) {
    process.stdout.write('capturing ' + name + ' (' + SCENARIOS[name].cols + 'x' + SCENARIOS[name].rows + ') ...\n');
    try {
      const r = await captureOne(name, args, info);
      results.push(r);
      process.stdout.write('  ' + name + ': ' + r.status + (r.error ? ' (' + r.error + ')' : '') + '\n');
    } catch (e) {
      if (e instanceof T.EnvGap) { gap = e; break; }
      throw e;
    }
  }
  if (gap) { process.stderr.write('ENV GAP: ' + gap.message + '\n'); return 77; }
  const index = {
    tool: 'ui/mos-face/scripts/capture-shots.cjs (plan 380-03)',
    claude: info.claude, tmux: info.tmux, playwright: info.playwright, mode: args.program ? 'program (test mode)' : 'claude session', config: args.config,
    colorNote: results.every((r) => r.truecolor) ? 'truecolor sequences (38;2 or 48;2) are present in every capture' : 'a capture without truecolor sequences means colors were rounded to 256 or the screen has no color',
    limit: 'the capture shows tmux screen drawn with the harness font and ink background; the person terminal font and theme can differ',
    scenarios: results,
  };
  fs.mkdirSync(path.resolve(args.out), { recursive: true });
  fs.writeFileSync(path.join(path.resolve(args.out), 'index.json'), JSON.stringify(index, null, 2) + '\n');
  return results.every((r) => r.status === 'ok') ? 0 : 1;
}

main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { process.stderr.write('capture-shots: ' + ((e && e.stack) || e) + '\n'); process.exit(1); });
