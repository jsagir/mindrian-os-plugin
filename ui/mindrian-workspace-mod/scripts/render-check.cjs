#!/usr/bin/env node
// 369.26-09: the spike-008 rendered check for the Mindrian Workspace band and pane shell.
//
// WHAT IT DOES (plain English): it starts a real Claude Code session inside a hidden tmux screen,
// with this mod loaded and the fixture data switched on (no model call, no room), at a fixed
// terminal size. It reads the screen back WITH its colors, turns that into a grid of cells, and
// checks each UI-SPEC 17.2 item it can reach: did the blocks really paint, does the logo line up,
// does the ten-cell bar draw, does a hotkey fire, what happens under NO_COLOR. It writes the raw
// capture, a text copy, an HTML picture and a JSON analysis for every run, and one INTERIM.md
// with a row per item and the fallback chosen for any item that failed.
//
// THE ONE COMMAND (run it in your own terminal where `claude` is logged in):
//
//   node ui/mindrian-workspace-mod/scripts/render-check.cjs --all
//
// Exit codes: 0 ran and wrote results; 1 a run failed (engine refusal or the band never drew);
// 2 bad command line; 77 ENV GAP (tmux or claude missing, or claude not logged in): nothing is
// faked and nothing is written.
//
// SAFETY: every run starts in a fresh scratch folder, with MINDRIAN_ROOMS_HOME pointed at an
// empty one, the sample switched on (MOS_WORKSPACE_SAMPLE) and no prompt ever submitted. The tmux
// server is its own (a private socket named mos-ws-<pid>), so the script cannot see, list or kill
// any of your tmux sessions; it removes only the one it made, and the scratch folder.
//
// Build tooling: CJS, node built-ins only. Not the mod's runtime source.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const G = require('./lib/ansi-grid.cjs');

const MOD = path.resolve(__dirname, '..');
const REPO = path.resolve(MOD, '..', '..');
const DEFAULT_OUT = path.join(REPO, '.planning', 'spikes', '008-mods-types-and-surfaces', 'render-check');
const PALETTE_PATH = path.join(MOD, 'assets', 'palette.json');

// UI-SPEC 17.2: the twelve checks, the plan that closes the ones this plan cannot reach, and the
// fallback the spec already allows if the check fails.
const ITEMS = [
  { n: 1, name: 'Box backgroundColor paints a solid block (hex string)', fallback: 'plain mode (UI-SPEC section 12); the words still read', later: null },
  { n: 2, name: 'The 10x3 and 9x1 logos line up cell for cell, no seams', fallback: 'the text mark B01 (M:OS) instead of the logo', later: null },
  { n: 3, name: 'Ten 1-column cells draw a contiguous run; the middle dot draws; 62 percent gives 6', fallback: 'drop the bar; the number remains', later: null },
  { n: 4, name: 'The half-block glyph stacks red over yellow in one cell (optional)', fallback: 'side by side (already the default)', later: 'plan 17' },
  { n: 5, name: 'Text dimColor is present (readability is the human\'s)', fallback: 'bold or plain weight instead of dim; no grey', later: null },
  { n: 6, name: 'A Button inside a bordered Box keeps hotkey, focus and wrapped label', fallback: 'the engine\'s plain 1: label form', later: 'plan 14' },
  { n: 7, name: 'A hotkey fires with the prompt box focused (typed o)', fallback: 'o and h only after focus moves; the workspace command opens the pane', later: null },
  { n: 8, name: 'The band\'s width when the pane is docked, and what maxRows includes', fallback: 'no change: tiers already follow the props', later: null },
  { n: 9, name: 'The engine\'s own Pane title or chrome', fallback: 'keep P00 short', later: null },
  { n: 10, name: 'The middle dot U+00B7 bytes reach the screen (font rendering is the human\'s)', fallback: 'use > and . instead of the triangle and the middle dot', later: null },
  { n: 11, name: 'What NO_COLOR and TERM=dumb do to backgroundColor', fallback: 'no change needed: blocks still read as labeled text', later: null },
  { n: 12, name: 'Truncation with wrap="truncate-end" inside a growing block', fallback: 'a shorter label', later: 'plan 17' },
];

// The matrix --all runs (UI-SPEC 10.7 sizes plus the three behaviour runs).
const MATRIX = [
  { label: 'wide-160x45-none', sample: 'wide', size: '160x45', pane: 'none' },
  { label: 'wide-160x45-open', sample: 'wide', size: '160x45', pane: 'open' },
  { label: 'missing-160x45-none', sample: 'missing', size: '160x45', pane: 'none' },
  { label: 'missing-160x45-open', sample: 'missing', size: '160x45', pane: 'open' },
  { label: 'narrow-160x45-none', sample: 'narrow', size: '160x45', pane: 'none' },
  { label: 'narrow-160x45-open', sample: 'narrow', size: '160x45', pane: 'open' },
  { label: 'wide-110x30-open', sample: 'wide', size: '110x30', pane: 'open' },
  { label: 'wide-120x40-open', sample: 'wide', size: '120x40', pane: 'open' },
  { label: 'wide-200x60-open', sample: 'wide', size: '200x60', pane: 'open' },
  { label: 'wide-80x24-none', sample: 'wide', size: '80x24', pane: 'none' },
  { label: 'wide-72x30-none', sample: 'wide', size: '72x30', pane: 'none' },
  { label: 'narrow-55x40-none', sample: 'narrow', size: '55x40', pane: 'none' },
  { label: 'wide-160x45-keys-o', sample: 'wide', size: '160x45', pane: 'none', keys: 'o' },
  { label: 'wide-160x45-no-color', sample: 'wide', size: '160x45', pane: 'none', env: ['NO_COLOR=1'] },
  { label: 'wide-160x45-term-dumb', sample: 'wide', size: '160x45', pane: 'none', env: ['TERM=dumb'] },
];

const BAND_READY = /\(sample\)|You're in|You're not in|M:OS/;
const DOT = '\u00b7';

let runCounter = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

class EnvGap extends Error {}

// ---- preflight -------------------------------------------------------------------------------

function run(cmd, args, opts) {
  return spawnSync(cmd, args, Object.assign({ encoding: 'utf8', timeout: 20000 }, opts || {}));
}

// Throws EnvGap with a plain-English sentence when the machine cannot do the live capture.
function preflight(opts) {
  const t = run('tmux', ['-V']);
  if (t.error || t.status !== 0) {
    throw new EnvGap('tmux is not installed or not on PATH, so the screen cannot be captured. Install tmux (for example: sudo apt install tmux), then run this same command again. Nothing was faked and nothing was written.');
  }
  if (opts.program) return { tmux: t.stdout.trim(), claude: null, login: 'not needed (--program test mode)' };
  const v = run('claude', ['--version']);
  if (v.error || v.status !== 0) {
    throw new EnvGap('Claude Code (the `claude` command) is not on PATH, so there is no session to capture. Install it or fix PATH, then run this same command again. Nothing was faked and nothing was written.');
  }
  const a = run('claude', ['auth', 'status']);
  let loggedIn = null;
  try {
    loggedIn = JSON.parse(a.stdout).loggedIn;
  } catch (e) {
    loggedIn = null;
  }
  if (loggedIn === false) {
    throw new EnvGap('Claude Code is not logged in in this terminal, so a real session cannot start and there is nothing to capture. Run `claude`, log in once (type /login), then run this same command again. Nothing was faked and nothing was written.');
  }
  return { tmux: t.stdout.trim(), claude: v.stdout.trim(), login: loggedIn === true ? 'logged in' : 'unknown (auth status was not readable; continuing)' };
}

// ---- tmux ------------------------------------------------------------------------------------

function makeTmux(sock) {
  const base = ['-L', sock, '-f', '/dev/null'];
  return (args) => spawnSync('tmux', base.concat(args), { encoding: 'utf8', timeout: 20000 });
}

function parseSize(size) {
  const m = /^(\d+)x(\d+)$/.exec(size || '');
  if (!m) throw new Error('bad --size ' + size + ' (want COLSxROWS, for example 160x45)');
  return { cols: Number(m[1]), rows: Number(m[2]) };
}

// ---- grid helpers ----------------------------------------------------------------------------

// A copy of the grid limited to columns [from, to), so a search can be kept left of a docked pane.
function sliceGrid(grid, from, to) {
  const cells = grid.cells.map((r) => r.slice(from, to));
  return { cols: cells[0] ? cells[0].length : 0, rows: grid.rows, cells, forms: grid.forms, overflow: grid.overflow };
}

function rowsText(grid) {
  const out = [];
  for (let r = 0; r < grid.rows; r += 1) out.push(G.rowText(grid, r));
  return out;
}

function findTabStrip(grid) {
  for (let r = 0; r < grid.rows; r += 1) {
    const t = G.rowText(grid, r);
    if (/Room/.test(t) && /Think/.test(t) && /Sources/.test(t) && /Review/.test(t)) {
      const f = G.findText(grid, 'Room', { fromRow: r });
      return { row: r, col: f && f.row === r ? f.col : t.indexOf('Room') };
    }
  }
  return null;
}

// ---- analysis of one capture ----------------------------------------------------------------

function loadPalette() {
  return JSON.parse(fs.readFileSync(PALETTE_PATH, 'utf8'));
}

function firstOf(grid, texts) {
  for (const t of texts) {
    const f = G.findText(grid, t);
    if (f) return Object.assign({ text: t }, f);
  }
  return null;
}

// analyze(grid, ansiText, ctx): one entry per UI-SPEC 17.2 item this run can speak to. An item the
// run does not test is simply absent. Each entry: { result, detail, data }. result is PASS, FAIL
// or INCONCLUSIVE; the rollup turns "no run tested it" into NOT REACHED.
function analyze(grid, ansiText, ctx) {
  const palette = ctx.palette;
  const items = {};
  const summary = G.summarize(grid);
  const noColorRun = !!ctx.noColorRun;
  const tab = findTabStrip(grid);
  const paneCol = tab && tab.col > grid.cols / 3 ? Math.max(0, tab.col - 1) : null;
  const left = paneCol ? sliceGrid(grid, 0, paneCol) : grid;
  const bandAnchor = firstOf(left, ["Next:", "You're in:", "You're not in", 'Funding (sample)', 'M:OS']);
  const bandDrawn = bandAnchor !== null;

  const info = {
    termCols: grid.cols,
    termRows: grid.rows,
    paneCol,
    bandDrawn,
    sgrForms: summary.forms,
    hasBackground: summary.hasBackground,
    bgCells: summary.bgCells,
    dimCells: summary.dimCells,
    middleDotsOnScreen: (ansiText.match(new RegExp(DOT, 'g')) || []).length,
  };

  if (!bandDrawn) {
    return { items, info, summary };
  }

  // 1: every block that is drawn sits on the right fill.
  if (!noColorRun) {
    const exp = [
      { name: 'place', texts: ["You're in:", 'Funding (sample)'], key: 'mondrian_blue' },
      { name: 'waiting', texts: ['A decision is waiting', 'decisions are waiting', 'decision waiting'], key: 'mondrian_yellow' },
      { name: 'purpose', texts: ['This folder is for:'], key: 'cream' },
      { name: 'next', texts: ['Next:'], key: 'cream' },
    ];
    const checks = [];
    for (const e of exp) {
      const hit = firstOf(left, e.texts);
      if (!hit) continue;
      const r = G.checkPaint(left, palette, [{ name: e.name, key: e.key, row: hit.row, col: hit.col }])[0];
      checks.push(r);
    }
    if (!summary.hasBackground) {
      items[1] = { result: 'FAIL', detail: 'no background escape reached the screen at all; the blocks have no fill.', data: { checks } };
    } else if (checks.length === 0) {
      items[1] = { result: 'INCONCLUSIVE', detail: 'the band was drawn but none of the four block labels was found to read the fill under.', data: { checks } };
    } else {
      const bad = checks.filter((c) => !c.bgMatches);
      const quant = checks.filter((c) => c.quantized);
      if (bad.length > 0) {
        items[1] = { result: 'FAIL', detail: 'wrong fill under: ' + bad.map((c) => c.name + ' (wanted ' + c.key + ', got ' + (c.nearest || 'default') + ', distance ' + c.distance + ')').join('; '), data: { checks } };
      } else {
        items[1] = {
          result: 'PASS',
          detail: checks.map((c) => c.name + ' ' + c.contiguousCells + ' cells ' + c.nearest).join('; ') + (quant.length ? '; the host quantized colors (max distance ' + Math.max.apply(null, quant.map((c) => c.distance)) + ')' : '; exact colors'),
          data: { checks },
        };
      }
    }

    // 2: logo. The band has three rows (a "Next:" row) when it draws the tall logo and one row
    // when it draws the compact one, so that tells which table the logo must match. Matching the
    // other table by accident (a window of the tall logo can look like the compact one) does not count.
    const wantVariant = G.findText(left, 'Next:') ? 'tall' : 'compact';
    const found = G.findLogo(left, palette, wantVariant);
    if (found.ok) {
      items[2] = { result: 'PASS', detail: wantVariant + ' ' + (wantVariant === 'tall' ? '10x3' : '9x1') + ' logo matches UI-SPEC 6.3 at row ' + found.origin.row + ', col ' + found.origin.col, data: { variant: wantVariant, origin: found.origin } };
    } else if (G.findText(left, 'M:OS')) {
      items[2] = { result: 'INCONCLUSIVE', detail: 'the band drew the text mark M:OS instead of a logo (the design does this below 30 columns or when there is no room for the mark).', data: { variant: 'text' } };
    } else {
      const mm = found.detail && found.detail.mismatch;
      items[2] = {
        result: 'FAIL',
        detail: 'the ' + wantVariant + ' logo does not match: ' + found.mismatches + ' wrong cells at its closest place' + (mm ? ' (first: row ' + mm.row + ' col ' + mm.col + ' wanted ' + mm.expected + ' got ' + mm.got + ')' : ''),
        data: { variant: wantVariant, mismatches: found.mismatches, origin: found.origin },
      };
    }
    info.logoVariant = items[2].data && items[2].data.variant && items[2].result === 'PASS' ? items[2].data.variant : null;
  }

  // 3 and 10: the context bar and the middle dot
  const ctxText = G.findText(left, 'Context used:');
  if (ctxText && !noColorRun) {
    const pm = /Context used: (\d+)%/.exec(G.rowText(left, ctxText.row).slice(ctxText.col));
    const percent = pm ? Number(pm[1]) : undefined;
    const col = G.locateBar(left, ctxText.row, ctxText.endCol, palette);
    const bandWidth = left.cols - 5;
    const barExpected = bandWidth >= 84;
    if (col === null) {
      if (barExpected) {
        items[3] = { result: 'FAIL', detail: 'no ten-cell bar found on the Context row although the band is ' + bandWidth + ' columns wide (84 or more needs the bar).', data: { percent } };
      }
    } else {
      const b = G.checkBar(left, ctxText.row, col, palette, { percent });
      items[3] = {
        result: b.ok ? 'PASS' : 'FAIL',
        detail: 'bar at col ' + col + ': ' + b.total + ' cells, ' + b.filled + ' filled (rule gives ' + b.expectedFilled + ' at ' + percent + ' percent), empty cells ' + (b.emptyAreDots ? 'are U+00B7' : 'are NOT U+00B7') + ', filled run ' + (b.filledFromLeft ? 'contiguous from the left' : 'broken'),
        data: b,
      };
      items[10] = b.empty > 0 && b.emptyAreDots
        ? { result: 'PASS', detail: 'U+00B7 reached the screen in ' + b.empty + ' empty bar cells (' + info.middleDotsOnScreen + ' on screen). Whether the font draws it is the human\'s check.', data: {} }
        : { result: 'FAIL', detail: 'the empty bar cells are not U+00B7 on the screen.', data: {} };
    }
  }

  // 5: dim present, only judged when a dim-styled hint could have been drawn
  const hints = firstOf(left, ['Open workspace', 'Get help']);
  if (hints && !noColorRun) {
    items[5] = summary.dimCells > 0
      ? { result: 'PASS', detail: 'SGR 2 (dim) reached ' + summary.dimCells + ' cells. Readability on black and on cream is the human\'s check.', data: {} }
      : { result: 'FAIL', detail: 'the hint row was drawn but no dim attribute reached the screen.', data: {} };
  }

  // 7: a typed `o` fired or went into the prompt
  if (ctx.keys) {
    const opened = tab !== null;
    const typed = rowsText(grid).some((t) => new RegExp('[>\u276f]\\s*' + ctx.keys.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[\u2502|]?\\s*$').test(t));
    if (opened) items[7] = { result: 'PASS', detail: 'typing "' + ctx.keys + '" with the prompt box focused opened the pane (the hotkey fired).', data: { opened, typed } };
    else if (typed) items[7] = { result: 'FAIL', detail: 'typing "' + ctx.keys + '" went into the prompt box; the hotkey did not fire.', data: { opened, typed } };
    else items[7] = { result: 'INCONCLUSIVE', detail: 'typing "' + ctx.keys + '" neither opened the pane nor showed in the prompt line; read the capture.', data: { opened, typed } };
  }

  // 8: band width and rows, with the pane docked or not
  if (bandAnchor) {
    let right = -1;
    for (let c = left.cols - 1; c >= 0; c -= 1) {
      if (G.effectiveBg(left.cells[bandAnchor.row][c]) !== null) { right = c; break; }
    }
    let promptTop = null;
    for (let r = bandAnchor.row + 1; r < left.rows; r += 1) {
      if (/^\s*[\u256d\u250c]/.test(G.rowText(left, r))) { promptTop = r; break; }
    }
    const logoTop = items[2] && items[2].data && items[2].data.origin ? items[2].data.origin.row : bandAnchor.row;
    info.band = {
      anchorRow: bandAnchor.row,
      topRow: logoTop,
      filledRightEdge: right >= 0 ? right + 1 : null,
      promptTopRow: promptTop,
      rowsAboveTheirPrompt: promptTop !== null ? promptTop - logoTop : null,
    };
    items[8] = {
      result: 'PASS',
      detail: 'terminal ' + grid.cols + 'x' + grid.rows + (paneCol ? ', pane starts at col ' + paneCol : ', no pane docked') +
        '; band fill reaches col ' + (right >= 0 ? right + 1 : 'n/a') + (promptTop !== null ? '; band top row ' + logoTop + ', prompt box top row ' + promptTop + ' (' + (promptTop - logoTop) + ' rows between)' : '; prompt box top not found'),
      data: info.band,
    };
  }

  // 9: the engine's own pane title, 12: truncation and overflow
  if (ctx.pane === 'open') {
    if (!tab) {
      items[9] = { result: 'INCONCLUSIVE', detail: 'the pane did not open in this run, so its title could not be read.', data: {} };
    } else {
      const title = G.findText(grid, 'Mindrian workspace');
      items[9] = { result: 'PASS', detail: title ? 'the engine drew the pane title "Mindrian workspace" at row ' + title.row + ', col ' + title.col : 'the engine drew no title row; the tab strip is the first row of the pane (row ' + tab.row + ')', data: { titleDrawn: !!title, tabRow: tab.row } };
    }
    info.paneOpened = tab !== null;
    const foc = G.findText(grid, 'Esc: Close');
    const unf = G.findText(grid, 'Press o to use the workspace keys');
    info.paneFocus = foc ? 'focused (the hint line shows Esc: Close)' : unf ? 'not focused (the pane shows "Press o to use the workspace keys")' : 'unknown (neither hint was found)';
  }
  if (ctx.sizeCols !== undefined && ctx.sizeCols <= 72 && !noColorRun) {
    const ell = rowsText(left).some((t) => t.indexOf('\u2026') !== -1);
    const labelsIntact = !!firstOf(left, ["You're in:", 'Funding (sample)', 'M:OS']);
    items[12] = ell
      ? { result: 'PASS', detail: 'truncate-end drew an ellipsis on a band row at ' + ctx.sizeCols + ' columns.', data: {} }
      : { result: 'INCONCLUSIVE', detail: 'no ellipsis at ' + ctx.sizeCols + ' columns: the sample folder name is short, so nothing needed truncating; ' + (labelsIntact ? 'labels intact, no row overflow (' + grid.overflow + ' cells over).' : 'labels NOT intact.') + ' Plan 17 forces a long folder name.', data: {} };
  }

  // 11: NO_COLOR or TERM=dumb
  if (noColorRun) {
    const words = !!firstOf(left, ["You're in:", 'Funding (sample)', 'M:OS']);
    items[11] = words
      ? { result: 'PASS', detail: ctx.env.join(' ') + ': the band words are drawn; the host ' + (summary.hasBackground ? 'KEPT background fills (' + summary.bgCells + ' cells)' : 'stripped all background fills') + '; text mark ' + (G.findText(left, 'M:OS') ? 'M:OS shown' : 'not shown') + '.', data: { keptFill: summary.hasBackground, textMark: !!G.findText(left, 'M:OS') } }
      : { result: 'FAIL', detail: ctx.env.join(' ') + ': no band words reached the screen.', data: {} };
  }

  return { items, info, summary };
}

// ---- one run ---------------------------------------------------------------------------------

async function runOne(opts) {
  const { cols, rows } = parseSize(opts.size);
  runCounter += 1;
  const sock = 'mos-ws-' + process.pid + '-' + runCounter;
  const name = sock;
  const tmux = makeTmux(sock);
  const out = path.resolve(opts.out);
  fs.mkdirSync(out, { recursive: true });
  const label = opts.label || (opts.sample + '-' + opts.size + '-' + opts.pane);
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ws-scratch-'));
  const cwd = path.join(scratchRoot, 'cwd');
  const roomsHome = path.join(scratchRoot, 'rooms');
  const debugLog = path.join(scratchRoot, 'debug.log');
  fs.mkdirSync(cwd);
  fs.mkdirSync(roomsHome);

  const envList = (opts.env || []).slice();
  const noColorRun = envList.some((e) => /^NO_COLOR=./.test(e) || e === 'TERM=dumb');
  const assigns = ['MOS_WORKSPACE_SAMPLE=' + opts.sample, 'MINDRIAN_ROOMS_HOME=' + roomsHome].concat(envList);
  if (process.env.COLORTERM && !envList.some((e) => e.startsWith('COLORTERM='))) assigns.push('COLORTERM=' + process.env.COLORTERM);
  const unsets = ['NO_COLOR', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM'];
  let inner;
  if (opts.program) inner = 'sh -c ' + shq(opts.program);
  else inner = 'claude --plugin-dir ' + shq(MOD) + ' --debug-file ' + shq(debugLog);
  const command = 'env ' + unsets.map((u) => '-u ' + u).join(' ') + ' ' + assigns.map(shq).join(' ') + ' ' + inner;

  const res = {
    label, sample: opts.sample, size: opts.size, pane: opts.pane, keys: opts.keys || null, env: envList,
    status: 'started', answered: [], slashName: null, files: {}, logCounts: {}, host: {},
    items: {}, info: {},
  };
  const fail = (s) => { if (res.status === 'started') res.status = s; };
  let screen = '';
  try {
    const ns = tmux(['new-session', '-d', '-s', name, '-x', String(cols), '-y', String(rows), '-c', cwd, command]);
    if (ns.status !== 0) throw new Error('tmux new-session failed: ' + (ns.stderr || '').trim());
    res.host.defaultTerminal = (tmux(['show-options', '-gv', 'default-terminal']).stdout || '').trim();
    res.host.colorterm = process.env.COLORTERM || '(unset)';
    res.host.tmux = (run('tmux', ['-V']).stdout || '').trim();

    const cap = () => (tmux(['capture-pane', '-p', '-t', name]).stdout || '');
    const alive = () => tmux(['has-session', '-t', name]).status === 0;
    const keysLit = (s) => tmux(['send-keys', '-t', name, '-l', s]);
    const keyName = (k) => tmux(['send-keys', '-t', name, k]);

    // wait for the band (answering a trust or onboarding dialog only when its text is recognized)
    const readyRe = opts.readyText ? new RegExp(opts.readyText) : BAND_READY;
    const deadline = Date.now() + (opts.timeoutSec || 60) * 1000;
    let ready = false;
    while (Date.now() < deadline) {
      screen = cap();
      if (/Do you trust the files in this folder|trust this folder|Yes, I trust/i.test(screen) && !opts.program) {
        keyName('Enter');
        res.answered.push('trust dialog: pressed Enter (Yes, trust this scratch folder)');
        await sleep(1500);
        continue;
      }
      if (/Press Enter to continue/i.test(screen) && !opts.program) {
        keyName('Enter');
        res.answered.push('"Press Enter to continue" dialog: pressed Enter');
        await sleep(1500);
        continue;
      }
      if (readyRe.test(screen)) { ready = true; break; }
      if (!alive()) break;
      await sleep(500);
    }
    if (!ready) {
      fail(alive() ? 'band_not_drawn' : 'session_exited');
    } else {
      await sleep(1200);
      if (opts.pane === 'open') {
        keysLit('/workspace');
        await sleep(1200);
        const seen = cap();
        const found = seen.match(/\/(?:[\w.-]+:)?workspace\b[\w.:-]*/g) || [];
        found.sort((a, b) => b.length - a.length);
        const slash = found[0] || '/workspace';
        res.slashName = slash;
        if (slash !== '/workspace') { keyName('C-u'); await sleep(300); keysLit(slash); await sleep(600); }
        let opened = false;
        for (let attempt = 0; attempt < 3 && !opened; attempt += 1) {
          keyName('Enter');
          for (let w = 0; w < 10 && !opened; w += 1) {
            await sleep(500);
            screen = cap();
            opened = G.findText(G.parseAnsi(screen, cols, rows), 'Sources') !== null && /Room/.test(screen) && /Review/.test(screen);
          }
        }
        res.paneOpenedByCommand = opened;
      }
      if (opts.keys) {
        keysLit(opts.keys);
        await sleep(1800);
      }
    }

    // capture with colors, always (a failed run keeps its last screen for diagnosis)
    const ansi = tmux(['capture-pane', '-p', '-e', '-t', name]).stdout || '';
    const plain = tmux(['capture-pane', '-p', '-t', name]).stdout || '';
    const grid = G.parseAnsi(ansi, cols, rows);
    const palette = loadPalette();
    const a = analyze(grid, ansi, { palette, keys: opts.keys || null, pane: opts.pane, sizeCols: cols, noColorRun, env: envList });
    res.items = a.items;
    res.info = a.info;
    res.info.sgrForms = a.summary.forms;
    if (ready === false) {
      res.items = {};
    }

    fs.writeFileSync(path.join(out, label + '.ansi'), ansi);
    fs.writeFileSync(path.join(out, label + '.txt'), plain);
    fs.writeFileSync(path.join(out, label + '.html'), G.toHtml(grid, { title: label }));
    res.files = { ansi: label + '.ansi', txt: label + '.txt', html: label + '.html', json: label + '.json' };

    // the engine's own refusals, from its debug log
    let log = '';
    try { log = fs.readFileSync(debugLog, 'utf8'); } catch (e) { log = ''; }
    const lines = log.split('\n');
    const hard = lines.filter((l) => /does not validate|threw while drawn|nothing was drawn/i.test(l));
    const refused = lines.filter((l) => /refused/i.test(l) && /workspace|ui\.|render|plugin|mod\b/i.test(l));
    res.logCounts = { doesNotValidate: lines.filter((l) => /does not validate/i.test(l)).length, refused: refused.length, threwWhileDrawn: lines.filter((l) => /threw while drawn/i.test(l)).length, nothingWasDrawn: lines.filter((l) => /nothing was drawn/i.test(l)).length, logLines: lines.length };
    res.logEvidence = hard.concat(refused).slice(0, 5);
    if (hard.length + refused.length > 0) fail('engine_refused');
    if (res.status === 'started') res.status = 'ok';
  } finally {
    tmux(['kill-session', '-t', name]);
    try { fs.rmSync(scratchRoot, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
  fs.writeFileSync(path.join(out, label + '.json'), JSON.stringify(res, null, 2) + '\n');
  return res;
}

// ---- roll-up and INTERIM.md ---------------------------------------------------------------------

function rollUp(results) {
  const rows = [];
  for (const it of ITEMS) {
    const hits = [];
    for (const r of results) if (r.items && r.items[it.n]) hits.push({ run: r, entry: r.items[it.n] });
    let result;
    let evidence = '';
    let detail = '';
    if (it.later && hits.length === 0) {
      result = 'NOT REACHED';
      detail = 'needs a component built in ' + it.later + '; ' + it.later + ' closes it';
    } else if (hits.length === 0) {
      result = 'NOT REACHED';
      detail = 'no run produced the evidence for this item (see the run table for failed runs); plan 17 closes it';
    } else {
      const fails = hits.filter((h) => h.entry.result === 'FAIL');
      const passes = hits.filter((h) => h.entry.result === 'PASS');
      if (fails.length) { result = 'FAIL'; evidence = fails.map((h) => h.run.files.html || h.run.label).slice(0, 3).join(', '); detail = fails.map((h) => h.run.label + ': ' + h.entry.detail).slice(0, 3).join(' | '); }
      else if (passes.length) { result = 'PASS'; evidence = passes[0].run.files.html || passes[0].run.label; detail = passes.map((h) => h.run.label + ': ' + h.entry.detail).slice(0, 2).join(' | '); }
      else { result = 'INCONCLUSIVE (plan 17 closes it)'; evidence = hits[0].run.files.html || hits[0].run.label; detail = hits.map((h) => h.run.label + ': ' + h.entry.detail).slice(0, 2).join(' | '); }
    }
    rows.push({ n: it.n, name: it.name, result, evidence, detail, fallback: it.fallback, later: it.later });
  }
  return rows;
}

function sgrFormsSeen(results) {
  const all = {};
  for (const r of results) for (const [k, v] of Object.entries((r.info && r.info.sgrForms) || {})) all[k] = (all[k] || 0) + v;
  const keys = Object.keys(all).sort();
  return keys.length ? keys.map((k) => k + ' x' + all[k]).join(', ') : 'none';
}

const cellText = (s) => String(s).replace(/\|/g, '/').replace(/\n/g, ' ');

function buildInterim(results, meta, preserved) {
  const lines = [];
  lines.push('# Spike 008 interim render check (plan 369.26-09)');
  lines.push('');
  lines.push('Written by `node ui/mindrian-workspace-mod/scripts/render-check.cjs --all`. Items 1 to 3, 5, 7 to 12 of UI-SPEC 17.2 that can be measured before the tab bodies exist; plan 17 runs the full twelve on the finished mod.');
  lines.push('');
  if (meta.pending) {
    lines.push('## STATUS: PENDING (the live run has not happened)');
    lines.push('');
    lines.push('ENV GAP: the agent that built this harness had no logged-in Claude Code (`claude auth status` reported loggedIn false), so no real capture exists yet and none was faked. The harness itself is proven against a fake terminal program (tests/test-369.26-render-harness.cjs). Every row below is PENDING until the navigator runs, in their own logged-in terminal from the repo root:');
    lines.push('');
    lines.push('    node ui/mindrian-workspace-mod/scripts/render-check.cjs --all');
    lines.push('');
    lines.push('That command overwrites this file with the real results, and keeps the "Navigator answer" section below.');
    lines.push('');
  } else {
    lines.push('Generated: ' + meta.generated + '. Host: ' + meta.host + '.');
    lines.push('');
    lines.push('SGR color forms seen across all runs: ' + sgrFormsSeen(results) + '. (38;2 and 48;2 are truecolor, 38;5 and 48;5 are 256-color, basic-fg and basic-bg are the 16 colors. If only 256-color forms show up the host quantized the hex values, and the "distance" in the item 1 row says by how much.)');
    lines.push('');
    lines.push('## Runs');
    lines.push('');
    lines.push('| Run | Sample | Size | Pane | Status | Evidence |');
    lines.push('|---|---|---|---|---|---|');
    for (const r of results) {
      lines.push('| ' + [r.label, r.sample, r.size, r.pane + (r.keys ? ' + keys "' + r.keys + '"' : '') + (r.env.length ? ' ' + r.env.join(' ') : ''), r.status + (r.logEvidence && r.logEvidence.length ? ' (' + r.logEvidence.length + ' engine log lines, see json)' : ''), r.files.html || ''].map(cellText).join(' | ') + ' |');
    }
    lines.push('');
  }
  lines.push('## UI-SPEC 17.2 results');
  lines.push('');
  lines.push('| # | Check | Result | Evidence file (under interim/) | If it fails, the fallback chosen |');
  lines.push('|---|---|---|---|---|');
  const rows = meta.pending ? ITEMS.map((it) => ({ n: it.n, name: it.name, result: it.later ? 'NOT REACHED (' + it.later + ' closes it)' : 'PENDING (live run needed)', evidence: '', detail: '', fallback: it.fallback })) : rollUp(results);
  for (const r of rows) {
    lines.push('| ' + [r.n, r.name, r.result, r.evidence, r.fallback].map(cellText).join(' | ') + ' |');
  }
  lines.push('');
  lines.push('### What each result is based on');
  lines.push('');
  for (const r of rows) lines.push('- Item ' + r.n + ' (' + r.result + '): ' + (r.detail || (meta.pending ? 'no live run yet.' : '')));
  lines.push('');
  lines.push('## Two answers the build needs');
  lines.push('');
  if (meta.pending) {
    lines.push('1. Did the pane open with focus when the composer was empty? PENDING (live run).');
    lines.push('2. How many columns did the band get with the pane docked (item 8)? PENDING (live run).');
  } else {
    const opens = results.filter((r) => r.pane === 'open');
    lines.push('1. Did the pane open with focus when the composer was empty? ' + (opens.length ? opens.map((r) => r.label + ': ' + (r.info.paneFocus || 'unknown') + (r.info.paneOpened === false ? ' (the pane did not open)' : '')).join('; ') : 'no pane run.'));
    lines.push('2. How many columns did the band get with the pane docked (item 8)? ' + (opens.length ? opens.map((r) => r.label + ': ' + (r.info.paneCol ? 'pane starts at col ' + r.info.paneCol + ', band fill reaches col ' + ((r.info.band && r.info.band.filledRightEdge) || 'n/a') : 'no dock seen (inline or not open)')).join('; ') : 'no pane run.'));
    const slash = results.map((r) => r.slashName).filter(Boolean);
    if (slash.length) lines.push('3. The slash name the session listed for the command: ' + slash[0] + '.');
  }
  lines.push('');
  lines.push('## Fallback decisions (plans 10 to 14 read this before building)');
  lines.push('');
  const failed = rows.filter((r) => r.result === 'FAIL');
  if (meta.pending) lines.push('None yet: decided after the live run. Until then every plan keeps the primary design.');
  else if (failed.length === 0) lines.push('No item failed: every plan keeps the primary design. Items marked NOT REACHED or INCONCLUSIVE stay open for the plan named.');
  else for (const f of failed) lines.push('- Item ' + f.n + ' FAILED: ' + f.fallback + '.');
  lines.push('');
  lines.push(preserved || '## Navigator answer\n\n(not yet given: the navigator reads the HTML captures under interim/ and replies here, then plans 10 to 14 may depend on this paint)\n');
  return lines.join('\n') + '\n';
}

function preservedNavigatorAnswer(file) {
  try {
    const t = fs.readFileSync(file, 'utf8');
    const i = t.indexOf('## Navigator answer');
    if (i === -1) return null;
    const body = t.slice(i);
    return /\(not yet given/.test(body) ? null : body;
  } catch (e) {
    return null;
  }
}

function writeInterim(dir, results, meta) {
  const file = path.join(dir, 'INTERIM.md');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, buildInterim(results, meta, preservedNavigatorAnswer(file)));
  return file;
}

// ---- command line ------------------------------------------------------------------------------

const HELP = [
  'render-check: capture the real Claude Code screen with the Mindrian Workspace mod loaded and check it (UI-SPEC 17.2).',
  '',
  'The one command (in your own logged-in terminal, from the repo root):',
  '  node ui/mindrian-workspace-mod/scripts/render-check.cjs --all',
  '',
  'Options:',
  '  --all                    run the whole matrix; write captures to <out>/interim/ and <out>/INTERIM.md',
  '  --sample <name>          wide | narrow | missing | empty ... (MOS_WORKSPACE_SAMPLE), default wide',
  '  --size <COLSxROWS>       terminal size, default 160x45',
  '  --pane none|open         open the workspace pane with its slash command, default none',
  '  --keys <text>            type this after the band is up (tests hotkeys)',
  '  --env KEY=VAL            set an environment variable in the session (repeatable; NO_COLOR, TERM)',
  '  --out <dir>              single run: where the files go; --all: the render-check folder',
  '  --label <name>           single run: file name stem',
  '  --timeout <sec>          wait for the band, default 60',
  '  --program <cmd>          test mode: run this command in the tmux window instead of claude (no login needed)',
  '  --ready-text <regex>     test mode: the text that means the program has drawn',
  '  --write-pending          write a PENDING INTERIM.md (no live run yet) and exit',
  '',
  'Exit: 0 ok, 1 a run failed, 2 bad arguments, 77 ENV GAP (no tmux, no claude, or not logged in).',
].join('\n');

function parseArgs(argv) {
  const o = { sample: 'wide', size: '160x45', pane: 'none', env: [], all: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const val = () => { i += 1; if (i >= argv.length) throw new Error('missing value after ' + a); return argv[i]; };
    if (a === '--all') o.all = true;
    else if (a === '--sample') o.sample = val();
    else if (a === '--size') o.size = val();
    else if (a === '--pane') { o.pane = val(); if (o.pane !== 'none' && o.pane !== 'open') throw new Error('--pane wants none or open'); }
    else if (a === '--keys') o.keys = val();
    else if (a === '--env') { const v = val(); if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(v)) throw new Error('--env wants KEY=VAL'); o.env.push(v); }
    else if (a === '--out') o.out = val();
    else if (a === '--label') o.label = val();
    else if (a === '--timeout') o.timeoutSec = Number(val());
    else if (a === '--program') o.program = val();
    else if (a === '--ready-text') o.readyText = val();
    else if (a === '--write-pending') o.writePending = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else throw new Error('unknown option ' + a);
  }
  return o;
}

async function main(argv) {
  let o;
  try { o = parseArgs(argv); } catch (e) { process.stderr.write('render-check: ' + e.message + '\n\n' + HELP + '\n'); return 2; }
  if (o.help) { process.stdout.write(HELP + '\n'); return 0; }
  if (o.writePending) {
    const dir = path.resolve(o.out || DEFAULT_OUT);
    process.stdout.write('wrote ' + writeInterim(dir, [], { pending: true }) + '\n');
    return 0;
  }
  let host;
  try { host = preflight(o); } catch (e) {
    if (e instanceof EnvGap) { process.stdout.write('ENV GAP (exit 77): ' + e.message + '\n'); return 77; }
    throw e;
  }
  process.stdout.write('render-check: ' + host.tmux + '; claude ' + (host.claude || '(test program)') + '; ' + host.login + '\n');

  if (!o.all) {
    const out = o.out || path.join(DEFAULT_OUT, 'interim');
    const r = await runOne(Object.assign({}, o, { out }));
    process.stdout.write(summaryLine(r) + '\n');
    return r.status === 'ok' ? 0 : 1;
  }

  const out = path.resolve(o.out || DEFAULT_OUT);
  const interim = path.join(out, 'interim');
  const results = [];
  let bad = 0;
  for (const m of MATRIX) {
    process.stdout.write('running ' + m.label + ' ...\n');
    const r = await runOne(Object.assign({}, o, m, { out: interim, env: o.env.concat(m.env || []), program: o.program }));
    results.push(r);
    process.stdout.write('  ' + summaryLine(r) + '\n');
    if (r.status !== 'ok') bad += 1;
  }
  const file = writeInterim(out, results, {
    generated: new Date().toISOString(),
    host: host.tmux + ', claude ' + host.claude + ', COLORTERM ' + (process.env.COLORTERM || '(unset)') + ', default-terminal ' + ((results[0] && results[0].host.defaultTerminal) || '?'),
  });
  process.stdout.write('\nwrote ' + file + '\nopen the .html files under ' + interim + ' in a browser and read INTERIM.md.\n');
  return bad ? 1 : 0;
}

function summaryLine(r) {
  const parts = Object.keys(r.items).sort((a, b) => a - b).map((k) => k + ':' + r.items[k].result);
  return r.label + ' -> ' + r.status + (parts.length ? ' [' + parts.join(' ') + ']' : '') + (r.status === 'band_not_drawn' ? ' (the band never appeared; see ' + (r.files.txt || 'the capture') + ')' : '');
}

module.exports = { analyze, rollUp, buildInterim, writeInterim, runOne, preflight, MATRIX, ITEMS, sliceGrid, findTabStrip };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { process.stderr.write('render-check: ' + (e.stack || e.message) + '\n'); process.exit(1); });
}
