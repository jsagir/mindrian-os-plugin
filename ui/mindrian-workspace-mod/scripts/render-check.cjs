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
const P = require('./lib/live-pure.cjs');

const MOD = path.resolve(__dirname, '..');
const REPO = path.resolve(MOD, '..', '..');
const DEFAULT_OUT = path.join(REPO, '.planning', 'spikes', '008-mods-types-and-surfaces', 'render-check');
const PALETTE_PATH = path.join(MOD, 'assets', 'palette.json');
const DECK_PATH = path.join(MOD, 'src', 'copy', 'deck.ts');
const IDS_PATH = path.join(MOD, 'src', 'runtime', 'ids.ts');

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

// The tmux SERVER is started by the first tmux call (new-session), and a new session's environment
// comes from the server's start environment. So whatever the child must see (the login token, HOME)
// has to be in the environment of that first spawn. `env` is that explicit environment.
function makeTmux(sock, env) {
  const base = ['-L', sock, '-f', '/dev/null'];
  return (args) => spawnSync('tmux', base.concat(args), { encoding: 'utf8', timeout: 20000, env: env || process.env });
}

// Secrets travel only through the tmux server's own environment (never on a command line, where
// `ps` would show them) and are scrubbed from every file and every line the harness prints.
const SECRET_NAMES = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
// Not secret, so they ride on the `env` prefix of the child command: where claude keeps its login and config.
const PASS_PLAIN = ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'XDG_RUNTIME_DIR', 'CLAUDE_CONFIG_DIR'];
// The exit marker the child command prints after claude (or the test program) ends.
const EXIT_RE = /CLAUDE_EXIT=(\d+)/;
// How long the pane stays alive after the child ends, so the screen can be read back.
const LINGER_SEC = 6;

function secretValues(env) {
  return SECRET_NAMES.map((n) => env[n]).filter((v) => typeof v === 'string' && v.length >= 8);
}

function scrubWith(secrets) {
  return (text) => {
    let t = String(text === undefined || text === null ? '' : text);
    for (const s of secrets) t = t.split(s).join('[secret removed]');
    return t;
  };
}

function lastLines(text, n) {
  const lines = String(text || '').split('\n');
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.slice(-n);
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
  const hints = firstOf(left, ['/workspace: Open workspace', '/workspace: Help', 'Open workspace', 'Get help']);
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
    const unf = G.findText(grid, 'to use the workspace keys');
    info.paneFocus = foc ? 'focused (the hint line shows Esc: Close)' : unf ? 'not focused (the pane shows "Type /workspace to use the workspace keys")' : 'unknown (neither hint was found)';
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

// ---- the workspace trust dialog ----------------------------------------------------------------

// The dialog lists its choices as rows and marks the selected one with a pointer (U+276F or >). In
// claude 2.1.290 the first row is "No, exit" and it is the one selected by default, so a plain Enter
// quits the session with code 1. This reads which row carries the pointer, from the plain screen text.
//   state: 'absent' (no dialog on screen), 'yes' (the pointer is on "Yes, I trust this folder"),
//          'no' (the pointer is on a different row, normally "No, exit"), 'unknown' (dialog seen but no
//          pointer row could be read)
const TRUST_SEEN_RE = /Do you trust the files in this folder|trust this folder|Yes, I trust/i;
function trustDialogState(screen) {
  const text = String(screen || '');
  if (!TRUST_SEEN_RE.test(text)) return { state: 'absent', selected: null, rows: [] };
  const rows = [];
  let selected = null;
  for (const line of text.split('\n')) {
    const m = /^\s*([❯›>])?\s*((?:Yes|No)\b[^\n]*?)\s*$/.exec(line);
    if (!m) continue;
    rows.push(m[2]);
    if (m[1]) selected = m[2];
  }
  if (selected === null) return { state: 'unknown', selected, rows };
  return { state: /^Yes\b/i.test(selected) ? 'yes' : 'no', selected, rows };
}

// ---- one run ---------------------------------------------------------------------------------

// The screen as two coherent blocks of text (everything left of a docked pane, then the pane), so a
// sentence that wraps inside the pane is still one sentence for a text search.
function frameText(grid) {
  const tab = findTabStrip(grid);
  const paneCol = tab && tab.col > grid.cols / 3 ? Math.max(0, tab.col - 1) : null;
  if (paneCol === null) return rowsText(grid).join('\n');
  return rowsText(sliceGrid(grid, 0, paneCol)).join('\n') + '\n' + rowsText(sliceGrid(grid, paneCol, grid.cols)).join('\n');
}

function readDeckSafe() {
  try { return P.readDeck(DECK_PATH); } catch (e) { return {}; }
}

// The three-file throwaway mod for item 4: one cell of the half-block glyph, red over yellow. Written
// under the scratch folder, never under the repo.
function writeHalfblockProbe(dir) {
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'mos-halfblock-probe', version: '0.0.1', description: 'Throwaway render probe: draws the half-block glyph red over yellow in one cell.', author: { name: 'MindrianOS' } }, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'hooks', 'hooks.json'), JSON.stringify({ modules: ['../src/register.tsx'] }, null, 2) + '\n');
  fs.writeFileSync(
    path.join(dir, 'src', 'register.tsx'),
    [
      "import type { Register } from 'claude-code'",
      '',
      'export const register: Register = (on) => {',
      "  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {",
      '    const { Box, Text } = $.ui.resolve(e)',
      '    return (',
      '      <Box flexDirection="row">',
      '        <Text color="#A63D2F" backgroundColor="#C8A43C">{\'\\u2580\'}</Text>',
      "        <Text>{' half-block probe'}</Text>",
      '      </Box>',
      '    )',
      '  })',
      '}',
      '',
    ].join('\n'),
  );
  return dir;
}

// Item 4: is there a cell holding U+2580 whose foreground is red and whose background is yellow.
function analyzeHalfblock(grid, palette) {
  for (let r = 0; r < grid.rows; r += 1) {
    for (let c = 0; c < grid.cols; c += 1) {
      const cell = grid.cells[r][c];
      if (cell.ch !== '\u2580') continue;
      const fg = G.nearest(cell.fg, palette, ['mondrian_red', 'mondrian_yellow', 'mondrian_blue', 'cream', 'mondrian_black']);
      const bg = G.nearest(cell.bg, palette, ['mondrian_red', 'mondrian_yellow', 'mondrian_blue', 'cream', 'mondrian_black']);
      const ok = !!fg && !!bg && fg.key === 'mondrian_red' && bg.key === 'mondrian_yellow';
      return { result: ok ? 'PASS' : 'FAIL', detail: 'U+2580 found at row ' + r + ', col ' + c + ': foreground ' + (fg ? fg.key : 'default') + ', background ' + (bg ? bg.key : 'default') + (ok ? ' (red over yellow in one cell)' : ' (not red over yellow)'), data: { row: r, col: c } };
    }
  }
  return { result: 'FAIL', detail: 'no U+2580 cell reached the screen (the probe band did not draw or the glyph was dropped)', data: {} };
}

// Open the workspace pane by its slash command (never by a hotkey, so a script does not depend on
// item 7). The slash name is read off the screen the way a person would see it.
async function openPane(h, tab) {
  h.keysLit('/workspace');
  await sleep(1200);
  const seen = h.cap();
  const found = seen.match(/\/(?:[\w.-]+:)?workspace\b[\w.:-]*/g) || [];
  found.sort((a, b) => b.length - a.length);
  const slash = found[0] || '/workspace';
  h.res.slashName = slash;
  if (slash !== '/workspace') { h.keyName('C-u'); await sleep(300); h.keysLit(slash); await sleep(600); }
  if (tab) { h.keysLit(' ' + tab); await sleep(400); }
  let opened = false;
  for (let attempt = 0; attempt < 3 && !opened; attempt += 1) {
    h.keyName('Enter');
    for (let w = 0; w < 10 && !opened; w += 1) {
      await sleep(500);
      const screen = h.cap();
      opened = G.findText(G.parseAnsi(screen, h.cols, h.rows), 'Sources') !== null && /Room/.test(screen) && /Review/.test(screen);
    }
  }
  h.res.paneOpenedByCommand = opened;
  return opened;
}

async function runOne(opts) {
  const { cols, rows } = parseSize(opts.size);
  runCounter += 1;
  const sock = 'mos-ws-' + process.pid + '-' + runCounter;
  const name = sock;
  const tmux = makeTmux(sock, Object.assign({}, process.env));
  const out = path.resolve(opts.out);
  fs.mkdirSync(out, { recursive: true });
  const label = opts.label || (opts.sample + '-' + opts.size + '-' + opts.pane);
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-ws-scratch-'));
  let cwd = path.join(scratchRoot, 'cwd');
  let roomsHome = path.join(scratchRoot, 'rooms');
  const debugLog = path.join(scratchRoot, 'debug.log');
  fs.mkdirSync(cwd);
  fs.mkdirSync(roomsHome);

  // A live run: a hermetic room with one raised card, the sample switch OFF, the session bound.
  let live = null;
  let LR = null;
  if (opts.live) {
    LR = require('./lib/live-room.cjs');
    live = await LR.buildLiveRoom({ folderName: opts.folderName });
    cwd = live.folderDir;
    roomsHome = live.roomsHome;
  }
  const probeDir = opts.probe === 'halfblock' ? writeHalfblockProbe(path.join(scratchRoot, 'halfblock-probe')) : null;

  const envList = (opts.env || []).slice();
  const noColorRun = envList.some((e) => /^NO_COLOR=./.test(e) || e === 'TERM=dumb');
  const assigns = (live ? [] : ['MOS_WORKSPACE_SAMPLE=' + opts.sample]).concat(['MINDRIAN_ROOMS_HOME=' + roomsHome], envList);
  if (live) assigns.push('CLAUDE_ACTIVE_ROOM=' + live.slug, 'CLAUDE_CODE_SESSION_ID=' + live.sessionId);
  // The parent's COLORTERM (the navigator exports truecolor) reaches the child as truecolor, unless a --env says otherwise.
  if (process.env.COLORTERM && !envList.some((e) => e.startsWith('COLORTERM='))) assigns.push('COLORTERM=truecolor');
  // Where claude keeps its login: pass HOME and the XDG and config folders through by name, so a
  // different HOME can never be the reason a harness session is logged out.
  const passedPlain = [];
  for (const n of PASS_PLAIN) {
    const v = n === 'HOME' ? (process.env.HOME || os.homedir()) : process.env[n];
    if (v && !envList.some((e) => e.startsWith(n + '='))) { assigns.push(n + '=' + v); passedPlain.push(n); }
  }
  if (opts.program) assigns.push('MOS_RENDER_DEBUG_LOG=' + debugLog);
  const unsets = ['NO_COLOR', 'CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM'];
  let inner;
  if (opts.program) inner = 'sh -c ' + shq(opts.program);
  else {
    const dirs = probeDir ? [probeDir] : [MOD].concat(opts.repoPlugin ? [REPO] : []);
    inner = 'claude ' + dirs.map((d) => '--plugin-dir ' + shq(d)).join(' ') + (live ? ' --session-id ' + shq(live.sessionId) : '') + ' --debug-file ' + shq(debugLog);
  }
  // After the child ends, print its exit code and linger a few seconds, so the screen still shows the
  // code and any last error when the session dies (a session that exits at once used to vanish with it).
  const command = 'env ' + unsets.map((u) => '-u ' + u).join(' ') + ' ' + assigns.map(shq).join(' ') + ' ' + inner + '; echo "CLAUDE_EXIT=$?"; sleep ' + LINGER_SEC;
  const secrets = secretValues(process.env);
  const scrub = scrubWith(secrets);
  const passedSecretNames = SECRET_NAMES.filter((n) => typeof process.env[n] === 'string' && process.env[n].length > 0);

  const res = {
    label, sample: live ? '(live room)' : opts.sample, size: opts.size, pane: opts.pane, keys: opts.keys || null, env: envList,
    status: 'started', answered: [], slashName: null, files: {}, logCounts: {}, host: {},
    items: {}, info: {}, frames: {}, inspections: {}, judgement: null, mcp: null, script: opts.scriptName || null,
  };
  // Names only, never values: what the child was handed and what was taken away, for diffing against a plain run.
  res.host.envHandedOver = {
    removedFromChild: unsets.filter((u) => process.env[u] !== undefined),
    passedByName: passedPlain.concat(passedSecretNames),
    secretsPassedThroughServerEnvironment: passedSecretNames,
    colorterm: assigns.find((a) => a.startsWith('COLORTERM=')) ? assigns.find((a) => a.startsWith('COLORTERM=')).slice(10) : '(unset)',
    term: 'set by tmux (default-terminal), not by the harness',
    cwd: 'a fresh scratch folder under ' + os.tmpdir(),
  };
  const fail = (s) => { if (res.status === 'started') res.status = s; };
  let screen = '';
  let exitCode = null;
  let lastBeforeExit = '';
  let debugKept = false;
  const keepDebugLog = () => {
    if (debugKept) return;
    debugKept = true;
    let text;
    try { text = fs.readFileSync(debugLog, 'utf8'); } catch (e) { text = ''; }
    if (text.trim() === '') text = 'No debug log lines were written: the session ended before it wrote anything to ' + path.basename(debugLog) + (opts.program ? ' (test program mode, no claude).' : '.') + '\n';
    const kept = label + '.debug.log';
    fs.writeFileSync(path.join(out, kept), scrub(text));
    res.files.debugLog = kept;
    res.debugTail = lastLines(scrub(text), 15);
  };
  try {
    const ns = tmux(['new-session', '-d', '-s', name, '-x', String(cols), '-y', String(rows), '-c', cwd, command]);
    if (ns.status !== 0) throw new Error('tmux new-session failed: ' + scrub((ns.stderr || '').trim()));
    res.host.defaultTerminal = (tmux(['show-options', '-gv', 'default-terminal']).stdout || '').trim();
    res.host.colorterm = process.env.COLORTERM || '(unset)';
    res.host.tmux = (run('tmux', ['-V']).stdout || '').trim();

    const cap = () => (tmux(['capture-pane', '-p', '-t', name]).stdout || '');
    const alive = () => tmux(['has-session', '-t', name]).status === 0;
    const keysLit = (s) => tmux(['send-keys', '-t', name, '-l', s]);
    const keyName = (k) => tmux(['send-keys', '-t', name, k]);
    const h = { cap, keysLit, keyName, cols, rows, res };

    // wait for the band (answering a trust or onboarding dialog only when its text is recognized)
    const readyRe = opts.readyText ? new RegExp(opts.readyText) : probeDir ? /half-block probe/ : BAND_READY;
    const deadline = Date.now() + (opts.timeoutSec || 60) * 1000;
    let ready = false;
    let exited = false;
    // After a keypress the screen is read every 150 ms (not every 500 ms), and the dialog is not
    // answered again for 1.5 s, so a session that dies right after Enter is still caught on screen.
    let quietUntil = 0;
    let fastUntil = 0;
    const pressed = () => { quietUntil = Date.now() + 1500; fastUntil = Date.now() + 10000; };
    while (Date.now() < deadline) {
      screen = cap();
      const em = EXIT_RE.exec(screen);
      if (em) { exitCode = Number(em[1]); exited = true; break; }
      if (screen.trim() !== '') lastBeforeExit = screen;
      const quiet = Date.now() < quietUntil;
      const trust = quiet ? { state: 'absent' } : trustDialogState(screen);
      if (trust.state !== 'absent') {
        // Never press Enter while the pointer sits on "No, exit" (the default in claude 2.1.290): move
        // the pointer to the "Yes, I trust this folder" row first, re-reading the screen after each key.
        // No readable pointer row yet (the dialog is still drawing): press nothing, read again.
        if (trust.state === 'unknown') {
          if (!res.answered.some((a) => /pointer row not readable/.test(a))) res.answered.push('trust dialog: pointer row not readable yet; pressed nothing, reading again');
          await sleep(150);
          continue;
        }
        let cur = trust;
        const moves = [];
        const order = ['Down', 'Down', 'Up', 'Down'];
        for (let i = 0; i < order.length && cur.state !== 'yes'; i += 1) {
          keyName(order[i]);
          moves.push(order[i]);
          await sleep(250);
          screen = cap();
          if (EXIT_RE.test(screen)) break;
          cur = trustDialogState(screen);
          if (cur.state === 'absent') break;
        }
        if (cur.state === 'yes') {
          keyName('Enter');
          res.answered.push('trust dialog: ' + (moves.length ? 'the pointer was on "' + trust.selected + '"; pressed ' + moves.join(', ') + ' until it sat on "' + cur.selected + '"; ' : 'the pointer was already on "' + cur.selected + '"; ') + 'then pressed Enter (chose: Yes, I trust this folder)');
          pressed();
          await sleep(150);
          continue;
        }
        if (cur.state === 'absent') continue; // the dialog went away or the session ended; the next read says which
        res.answered.push('trust dialog: could not put the pointer on "Yes, I trust this folder" (pressed ' + (moves.join(', ') || 'nothing') + '; pointer on "' + (cur.selected || 'no readable row') + '"); did NOT press Enter');
        fail('trust_dialog_unanswered');
        break;
      }
      if (!quiet && /Press Enter to continue/i.test(screen) && !opts.program) {
        keyName('Enter');
        res.answered.push('"Press Enter to continue" dialog: pressed Enter');
        pressed();
        await sleep(150);
        continue;
      }
      if (readyRe.test(screen)) { ready = true; break; }
      if (!alive()) break;
      await sleep(Date.now() < fastUntil ? 150 : 500);
    }
    if (!ready) {
      fail(exited || !alive() ? 'session_exited' : 'band_not_drawn');
    } else {
      await sleep(1200);
      if (opts.pane === 'open') await openPane(h, null);
      if (opts.keys) {
        keysLit(opts.keys);
        await sleep(1800);
      }
      if (opts.listMcp) {
        keysLit('/mcp');
        await sleep(600);
        keyName('Enter');
        await sleep(3500);
        const mcpAnsi = scrub(tmux(['capture-pane', '-p', '-e', '-t', name]).stdout || '');
        const mcpText = scrub(cap());
        fs.writeFileSync(path.join(out, label + '-mcp.ansi'), mcpAnsi);
        fs.writeFileSync(path.join(out, label + '-mcp.txt'), mcpText);
        const parsed = P.parseMcpServerNames(mcpText);
        const ids = fs.readFileSync(IDS_PATH, 'utf8');
        const want = (key) => { const m = new RegExp(key + " = '([^']+)'").exec(ids); return m ? m[1] : null; };
        res.mcp = { names: parsed.names, statuses: parsed.statuses, mindrian: Object.assign({ expected: want('MINDRIAN_SERVER') }, P.compareServerName(parsed.names, want('MINDRIAN_SERVER') || '')), brain: Object.assign({ expected: want('BRAIN_SERVER') }, P.compareServerName(parsed.names, want('BRAIN_SERVER') || '')), files: [label + '-mcp.ansi', label + '-mcp.txt'] };
        keyName('Escape');
        await sleep(800);
      }
      if (opts.script) {
        for (const step of opts.script) {
          if (step.op === 'wait') await sleep(step.ms);
          else if (step.op === 'type') keysLit(step.text);
          else if (step.op === 'key') keyName(step.name);
          else if (step.op === 'burst') tmux(['send-keys', '-t', name].concat(step.keys));
          else if (step.op === 'open') await openPane(h, step.tab || null);
          else if (step.op === 'capture') {
            const a = scrub(tmux(['capture-pane', '-p', '-e', '-t', name]).stdout || '');
            const t = scrub(tmux(['capture-pane', '-p', '-t', name]).stdout || '');
            const g = G.parseAnsi(a, cols, rows);
            res.frames[step.name] = frameText(g);
            fs.writeFileSync(path.join(out, label + '-' + step.name + '.ansi'), a);
            fs.writeFileSync(path.join(out, label + '-' + step.name + '.txt'), t);
            fs.writeFileSync(path.join(out, label + '-' + step.name + '.html'), G.toHtml(g, { title: label + ' ' + step.name }));
          } else if (step.op === 'inspect') {
            if (!live) res.inspections[step.name] = { error: 'no live room in this run' };
            else {
              try { res.inspections[step.name] = LR.inspectLiveRoom({ roomsHome: live.roomsHome, slug: live.slug, gateId: live.gateId }); } catch (e) { res.inspections[step.name] = { error: String(e && e.message || e) }; }
            }
          }
        }
      }
    }

    // capture with colors, always (a failed run keeps its last screen for diagnosis)
    let ansi = scrub(tmux(['capture-pane', '-p', '-e', '-t', name]).stdout || '');
    let plain = scrub(tmux(['capture-pane', '-p', '-t', name]).stdout || '');
    const lateExit = EXIT_RE.exec(plain);
    if (lateExit && exitCode === null) exitCode = Number(lateExit[1]);
    // A session that ended after the band drew is still an ended session, not a pass.
    if (lateExit && ready) fail('session_exited');
    // Never leave a silent empty capture: say in plain English what happened and where to look.
    if (res.status === 'session_exited' || (!ready && plain.trim() === '')) {
      const code = exitCode === null ? 'unknown (the session was gone before the exit code could be read)' : String(exitCode);
      const sentence = (ready ? 'The session ended after the band drew' : 'The session ended before anything drew') + '; exit code ' + code + '; see ' + label + '.debug.log.';
      const before = scrub(lastBeforeExit).trim() !== '' ? '\n\n--- the last screen seen before the session ended ---\n' + scrub(lastBeforeExit).replace(/\s+$/, '') + '\n' : '';
      const atEnd = plain.trim() !== '' ? '\n\n--- the screen when the session ended ---\n' + plain.replace(/\s+$/, '') + '\n' : '';
      plain = sentence + before + atEnd;
      if (ansi.trim() === '') ansi = sentence + '\n';
      res.exitCode = exitCode;
    }
    const grid = G.parseAnsi(ansi, cols, rows);
    const palette = loadPalette();
    const a = analyze(grid, ansi, { palette, keys: opts.keys || null, pane: opts.pane, sizeCols: cols, noColorRun, env: envList });
    res.items = a.items;
    res.info = a.info;
    res.info.sgrForms = a.summary.forms;
    if (probeDir && ready) res.items[4] = analyzeHalfblock(grid, palette);
    if (ready === false) {
      res.items = {};
    }

    fs.writeFileSync(path.join(out, label + '.ansi'), ansi);
    fs.writeFileSync(path.join(out, label + '.txt'), plain);
    fs.writeFileSync(path.join(out, label + '.html'), G.toHtml(grid, { title: label }));
    res.files = { ansi: label + '.ansi', txt: label + '.txt', html: label + '.html', json: label + '.json' };

    // what the script's frames and the room say, judged by the fixed rules in lib/live-pure.cjs
    if (ready && opts.script && opts.scriptName) res.judgement = judgeScript(opts.scriptName, res, readDeckSafe());
    if (ready && res.judgement && opts.scriptName === 'roundtrip') {
      const by = Object.fromEntries(res.judgement.verdicts.map((v) => [v.id, v]));
      if (by.c && by.c.result === 'PASS') res.items[6] = { result: 'PASS', detail: 'a digit press reached the boxed choice button (the runtime answered it); the wrapped label and the look are the human\'s check', data: {} };
      else if (by.e && by.e.result === 'PASS') res.items[6] = { result: 'PASS', detail: 'the digit press saved the decision through the boxed button; the wrapped label and the look are the human\'s check', data: {} };
    }
    if (ready && res.judgement && res.judgement.kind === 'key') {
      const v = res.judgement.verdicts[0];
      res.items[7] = { result: v.result === 'PENDING-HUMAN' ? 'INCONCLUSIVE' : v.result, detail: opts.scriptName + ': ' + v.detail, data: { script: opts.scriptName } };
    }

    // the engine's own refusals, from its debug log
    let log = '';
    try { log = fs.readFileSync(debugLog, 'utf8'); } catch (e) { log = ''; }
    const lines = log.split('\n');
    const hard = lines.filter((l) => /does not validate|threw while drawn|nothing was drawn/i.test(l));
    const refused = lines.filter((l) => /refused/i.test(l) && /workspace|ui\.|render|plugin|mod\b/i.test(l));
    res.logCounts = { doesNotValidate: lines.filter((l) => /does not validate/i.test(l)).length, refused: refused.length, threwWhileDrawn: lines.filter((l) => /threw while drawn/i.test(l)).length, nothingWasDrawn: lines.filter((l) => /nothing was drawn/i.test(l)).length, logLines: lines.length };
    res.logEvidence = hard.concat(refused).slice(0, 5).map(scrub);
    if (hard.length + refused.length > 0) fail('engine_refused');
    if (res.status === 'started') res.status = 'ok';
    // Any run that did not come out ok keeps its debug log next to its captures.
    if (res.status !== 'ok') keepDebugLog();
  } finally {
    // (also when an error escapes above: the log is the evidence)
    if (res.status !== 'ok') { try { keepDebugLog(); } catch (e) { /* best effort */ } }
    tmux(['kill-session', '-t', name]);
    tmux(['kill-server']);
    if (live) { try { await live.close(); } catch (e) { /* best effort */ } }
    try { fs.rmSync(scratchRoot, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
  fs.writeFileSync(path.join(out, label + '.json'), JSON.stringify(res, null, 2) + '\n');
  if (res.status === 'session_exited') reportEnded(res, out);
  return res;
}

// After a session that ended: the exit code, what the child was handed (names only) and the last 15
// lines of the kept debug log, in the console, so the navigator can paste it as it is.
function reportEnded(res, out) {
  const w = (s) => process.stdout.write(s + '\n');
  const env = (res.host && res.host.envHandedOver) || {};
  w('  SESSION ENDED: ' + res.label + ' (exit code ' + (res.exitCode === null || res.exitCode === undefined ? 'unknown' : res.exitCode) + ').');
  w('  The child was handed (names only): passed through ' + ((env.passedByName || []).join(', ') || 'nothing') + '; removed ' + ((env.removedFromChild || []).join(', ') || 'nothing') + '; COLORTERM ' + (env.colorterm || '(unset)') + '.');
  w('  Last screen text: ' + path.join(out, res.files.txt || (res.label + '.txt')));
  w('  Last 15 lines of ' + path.join(out, res.files.debugLog || (res.label + '.debug.log')) + ':');
  for (const l of res.debugTail || []) w('    | ' + l);
}

// judgeScript: the verdicts for a preset, from its frames and read-backs. A frame that was not
// captured stays PENDING-HUMAN (see lib/live-pure.cjs); nothing is guessed.
function judgeScript(scriptName, res, deck) {
  const ins = res.inspections;
  if (scriptName === 'roundtrip') return { kind: 'roundtrip', verdicts: P.judgeRoundTrip({ frames: res.frames, inspection: ins, deck }) };
  if (scriptName === 'decide-later') return { kind: 'decide-later', verdicts: [P.judgeDecideLater({ before: ins.before, after: ins.after, frames: res.frames, deck })] };
  if (scriptName === 'double-press') return { kind: 'double-press', verdicts: [P.judgeDoublePress({ after: ins.after })] };
  const typed = { 'o-empty': 'o', 'o-after-text': 'helloo', 'h-empty': 'h', 'digit-in-pane': '1' }[scriptName];
  if (typed !== undefined) return { kind: 'key', verdicts: [P.judgeKeyRun(scriptName, typed, res.frames, deck)] };
  return null;
}

// ---- roll-up and INTERIM.md ---------------------------------------------------------------------

function rollUp(results, mode) {
  const finalMode = mode === 'final';
  const rows = [];
  for (const it of ITEMS) {
    const hits = [];
    for (const r of results) if (r.items && r.items[it.n]) hits.push({ run: r, entry: r.items[it.n] });
    let result;
    let evidence = '';
    let detail = '';
    if (finalMode && hits.length === 0) {
      result = 'NOT REACHED';
      detail = 'no run produced the evidence for this item; see the run table for failed or skipped runs';
    } else if (it.later && hits.length === 0) {
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
      else { result = finalMode ? 'INCONCLUSIVE (read the evidence)' : 'INCONCLUSIVE (plan 17 closes it)'; evidence = hits[0].run.files.html || hits[0].run.label; detail = hits.map((h) => h.run.label + ': ' + h.entry.detail).slice(0, 2).join(' | '); }
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
  'The final check (plan 369.26-17), on the finished mod:',
  '  --final                  run everything: the size matrix, every state, the key runs, the probes and the live gate round trips;',
  '                           write <out>/final/ (captures, summary.json, FINAL-RUN.md). One command, in your own logged-in terminal:',
  '                             node ui/mindrian-workspace-mod/scripts/render-check.cjs --final',
  '  --group <name>           with --final: size | states | keys | probes | live (default all)',
  '  --live                   build a hermetic room with one raised card; sample switch OFF; the session bound to the room',
  '  --script <name|file>     play a key script after the band is up; a preset name (roundtrip, decide-later, double-press,',
  '                           o-empty, o-after-text, h-empty, digit-in-pane) or a file of steps (wait, type, key, burst, open, capture, inspect)',
  '  --probe halfblock        load a throwaway three-file mod that draws U+2580 red over yellow (item 4)',
  '  --list-mcp               type /mcp and record the server names the session lists',
  '  --folder-name <name>     live room: the folder name (a long one proves truncation, item 12)',
  '  --repo-plugin            also load this repo as a plugin (its servers), when the installed plugin is missing or older',
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
    else if (a === '--live') o.live = true;
    else if (a === '--script') o.scriptArg = val();
    else if (a === '--probe') { o.probe = val(); if (o.probe !== 'halfblock') throw new Error('--probe wants halfblock'); }
    else if (a === '--list-mcp') o.listMcp = true;
    else if (a === '--folder-name') o.folderName = val();
    else if (a === '--repo-plugin') o.repoPlugin = true;
    else if (a === '--final') o.final = true;
    else if (a === '--group') o.group = val();
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

  if (o.scriptArg) {
    try { Object.assign(o, resolveScript(o.scriptArg)); } catch (e) { process.stderr.write('render-check: ' + e.message + '\n'); return 2; }
  }

  if (o.final) return runFinal(o, host);

  if (!o.all) {
    const out = o.out || path.join(DEFAULT_OUT, 'interim');
    let r;
    try { r = await runOne(Object.assign({}, o, { out })); } catch (e) {
      if (e && e.envGap) { process.stdout.write(e.message + '\n'); return 77; }
      throw e;
    }
    process.stdout.write(summaryLine(r) + '\n');
    if (r.judgement) for (const v of r.judgement.verdicts) process.stdout.write('  ' + v.id + ': ' + v.result + ' - ' + v.detail + '\n');
    if (r.mcp) process.stdout.write('  /mcp names: ' + (r.mcp.names.join(', ') || '(none parsed; read the -mcp.txt capture)') + '\n');
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

// --script value: a preset name (optionally preset:name) or a file path.
function resolveScript(arg) {
  const name = arg.replace(/^preset:/, '');
  if (Object.prototype.hasOwnProperty.call(P.PRESETS, name)) return { script: P.parseScript(P.PRESETS[name]), scriptName: name };
  if (!fs.existsSync(arg)) throw new Error('--script ' + arg + ' is neither a preset (' + Object.keys(P.PRESETS).join(', ') + ') nor a file');
  return { script: P.parseScript(fs.readFileSync(arg, 'utf8')), scriptName: path.basename(arg, path.extname(arg)) };
}

const FINAL_SIZES = ['55x40', '80x24', '110x30', '120x40', '160x45', '200x60'];
const LONG_FOLDER = 'Funding-and-grant-applications-for-the-first-three-pilot-sites';

// The runs of the final check, by group. A run is { label, ...runOne options }.
function finalRuns(group) {
  const all = [];
  const add = (g, run) => { if (!group || group === g) all.push(Object.assign({ group: g }, run)); };
  for (const sample of ['wide', 'narrow', 'missing']) {
    for (const size of FINAL_SIZES) for (const pane of ['none', 'open']) add('size', { label: 'size-' + sample + '-' + size + '-' + pane, sample, size, pane });
  }
  add('size', { label: 'size-wide-72x30-none', sample: 'wide', size: '72x30', pane: 'none' });
  for (const sample of ['empty', 'limit', 'drift', 'broken', 'several', 'nofile', 'noroom', 'unreadable']) {
    for (const size of ['160x45', '55x40']) add('states', { label: 'state-' + sample + '-' + size, sample, size, pane: 'none' });
  }
  for (const name of ['o-empty', 'o-after-text', 'h-empty', 'digit-in-pane']) {
    add('keys', Object.assign({ label: 'key-' + name, sample: 'wide', size: '160x45', pane: 'none', scriptName: name, script: P.parseScript(P.PRESETS[name]) }));
  }
  add('keys', { label: 'color-no-color', sample: 'wide', size: '160x45', pane: 'none', env: ['NO_COLOR=1'] });
  add('keys', { label: 'color-term-dumb', sample: 'wide', size: '160x45', pane: 'none', env: ['TERM=dumb'] });
  add('probes', { label: 'probe-halfblock', sample: 'wide', size: '160x45', pane: 'none', probe: 'halfblock' });
  add('probes', { label: 'probe-list-mcp', sample: 'wide', size: '160x45', pane: 'none', listMcp: true });
  for (const name of ['roundtrip', 'decide-later', 'double-press']) {
    add('live', { label: 'live-' + name, sample: 'wide', size: '160x45', pane: 'none', live: true, scriptName: name, script: P.parseScript(P.PRESETS[name]) });
  }
  add('live', { label: 'live-long-folder-72x30', sample: 'wide', size: '72x30', pane: 'none', live: true, folderName: LONG_FOLDER });
  return all;
}

function mdCell(s) { return String(s === undefined || s === null ? '' : s).replace(/\|/g, '/').replace(/\n/g, ' '); }

function buildFinalReport(results, meta) {
  const L = [];
  L.push('# Spike 008 final render check: machine measurements (plan 369.26-17)');
  L.push('');
  L.push('Generated ' + meta.generated + '. Host: ' + meta.host + '. Written by `node ui/mindrian-workspace-mod/scripts/render-check.cjs --final`.');
  L.push('');
  L.push('Every row below is MEASURED BY A MACHINE from a real capture. A PASS here means the paint and the keys behaved; whether it LOOKS right is still the person\'s reading of the HTML pictures next to it. Nothing here is a verdict: the verdict is written in RESULTS.md after the person has read this.');
  L.push('');
  L.push('## Runs');
  L.push('');
  L.push('| Run | Sample | Size | Pane | Status | Evidence |');
  L.push('|---|---|---|---|---|---|');
  for (const r of results) {
    L.push('| ' + [r.label, r.sample, r.size, r.pane + (r.script ? ' + script ' + r.script : '') + (r.env.length ? ' ' + r.env.join(' ') : ''), r.status + (r.logEvidence && r.logEvidence.length ? ' (' + r.logEvidence.length + ' engine log lines, see json)' : ''), r.files.html || ''].map(mdCell).join(' | ') + ' |');
  }
  L.push('');
  L.push('## UI-SPEC 17.2 items (machine part)');
  L.push('');
  L.push('| # | Check | Result | Evidence file | Measured | If it fails, the fallback |');
  L.push('|---|---|---|---|---|---|');
  const rows = rollUp(results, 'final');
  for (const r of rows) L.push('| ' + [r.n, r.name, r.result, r.evidence, r.detail, r.fallback].map(mdCell).join(' | ') + ' |');
  L.push('');
  const live = results.filter((r) => r.judgement && r.judgement.kind !== 'key');
  L.push('## Live gate round trip');
  L.push('');
  if (live.length === 0) L.push('PENDING-HUMAN: no live run produced a read-back in this run.');
  for (const r of live) {
    L.push('### ' + r.label);
    L.push('');
    L.push('| Step | Result | What was measured |');
    L.push('|---|---|---|');
    for (const v of r.judgement.verdicts) L.push('| ' + [v.id + ': ' + v.step, v.result, v.detail].map(mdCell).join(' | ') + ' |');
    const ins = r.inspections || {};
    const a = ins.after;
    if (a && a.gateAnswer) L.push('', 'Recorded answer route read from the room: `answered_via = ' + (a.gateAnswer.answeredVia || 'n/a') + '`; decision nodes: ' + (a.decisionNodes || []).length + '; records hash before ' + ((ins.before && ins.before.recordsHash) || 'n/a') + ', after ' + a.recordsHash + '.');
    L.push('');
  }
  const mcp = results.find((r) => r.mcp);
  L.push('## MCP server names (item for ids.ts)');
  L.push('');
  if (!mcp) L.push('PENDING-HUMAN: the `/mcp` capture did not run.');
  else {
    L.push('Names parsed from the real `/mcp` screen: ' + (mcp.mcp.names.length ? mcp.mcp.names.map((n) => '`' + n + '`').join(', ') : '(none parsed: read `' + mcp.mcp.files.join('` or `') + '`)') + '.');
    L.push('');
    L.push('- MINDRIAN_SERVER `' + mcp.mcp.mindrian.expected + '`: ' + mcp.mcp.mindrian.verdict + (mcp.mcp.mindrian.verdict === 'differs' ? ' (closest: ' + mcp.mcp.mindrian.closest.join(', ') + ')' : ''));
    L.push('- BRAIN_SERVER `' + mcp.mcp.brain.expected + '`: ' + mcp.mcp.brain.verdict + (mcp.mcp.brain.verdict === 'differs' ? ' (closest: ' + mcp.mcp.brain.closest.join(', ') + ')' : ''));
  }
  L.push('');
  L.push('## Numbers for the UNVERIFIED risks');
  L.push('');
  const docked = results.filter((r) => r.pane === 'open' && r.info && r.info.band);
  L.push('| Risk | Measured |');
  L.push('|---|---|');
  L.push('| R-02 band width and rows when docked | ' + (docked.length ? docked.map((r) => r.label + ': pane at col ' + (r.info.paneCol === null || r.info.paneCol === undefined ? 'n/a' : r.info.paneCol) + ', band fill to col ' + r.info.band.filledRightEdge + ', rows between band top and prompt ' + r.info.band.rowsAboveTheirPrompt).join('; ') : 'PENDING-HUMAN (no docked run)') + ' |');
  const keyRuns = results.filter((r) => r.judgement && r.judgement.kind === 'key');
  L.push('| R-03 hotkeys with the prompt focused | ' + (keyRuns.length ? keyRuns.map((r) => r.script + ': ' + r.judgement.verdicts[0].result + ' (' + r.judgement.verdicts[0].detail + ')').join('; ') : 'PENDING-HUMAN') + ' |');
  const nc = results.filter((r) => r.items && r.items[11]);
  L.push('| R-15 NO_COLOR and TERM=dumb | ' + (nc.length ? nc.map((r) => r.label + ': ' + r.items[11].detail).join('; ') : 'PENDING-HUMAN') + ' |');
  const dim = results.find((r) => r.items && r.items[5]);
  L.push('| R-18 dim text | ' + (dim ? dim.label + ': ' + dim.items[5].detail : 'PENDING-HUMAN') + ' |');
  const titles = results.filter((r) => r.items && r.items[9]);
  L.push('| R-21 engine pane title | ' + (titles.length ? titles.slice(0, 3).map((r) => r.label + ': ' + r.items[9].detail).join('; ') : 'PENDING-HUMAN') + ' |');
  const dots = results.find((r) => r.items && r.items[10]);
  L.push('| R-26 glyph bytes (the middle dot) | ' + (dots ? dots.label + ': ' + dots.items[10].detail : 'PENDING-HUMAN') + ' |');
  const hb = results.find((r) => r.items && r.items[4]);
  L.push('| R-19 / R-26 half-block glyph | ' + (hb ? hb.label + ': ' + hb.items[4].detail : 'PENDING-HUMAN') + ' |');
  L.push('');
  L.push('## What the machine cannot judge (the person reads the HTML pictures)');
  L.push('');
  L.push('Item 1 to 3 and 5: whether the blocks, the logo cells, the ten-cell bar and the dim text LOOK right and read on black and on cream. Item 6: whether the boxed choice buttons look right and wrap. Item 10: whether the triangle and the middle dot draw in your terminal font. Item 12: whether the shortened folder name reads well.');
  L.push('');
  L.push('## Navigator answer');
  L.push('');
  L.push('(not yet given)');
  L.push('');
  return L.join('\n');
}

async function runFinal(o, host) {
  const out = path.resolve(o.out || DEFAULT_OUT);
  const dir = path.join(out, 'final');
  fs.mkdirSync(dir, { recursive: true });
  const runs = finalRuns(o.group || null);
  const results = [];
  let bad = 0;
  for (const run of runs) {
    process.stdout.write('running ' + run.label + ' ...\n');
    let r;
    try {
      r = await runOne(Object.assign({}, o, run, { out: dir, env: (o.env || []).concat(run.env || []), program: o.program, label: run.label }));
    } catch (e) {
      if (e && e.envGap) { process.stdout.write(e.message + '\n'); return 77; }
      throw e;
    }
    results.push(r);
    process.stdout.write('  ' + summaryLine(r) + '\n');
    if (r.judgement) for (const v of r.judgement.verdicts) process.stdout.write('    ' + v.id + ': ' + v.result + ' - ' + v.detail + '\n');
    if (r.status !== 'ok') bad += 1;
  }
  const meta = { generated: new Date().toISOString(), host: host.tmux + ', claude ' + host.claude + ', COLORTERM ' + (process.env.COLORTERM || '(unset)') + ', default-terminal ' + ((results[0] && results[0].host.defaultTerminal) || '?') };
  fs.writeFileSync(path.join(dir, 'FINAL-RUN.md'), buildFinalReport(results, meta));
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(results.map((r) => ({ label: r.label, status: r.status, size: r.size, pane: r.pane, items: r.items, judgement: r.judgement, mcp: r.mcp, inspections: r.inspections, info: r.info })), null, 2) + '\n');
  process.stdout.write('\nwrote ' + path.join(dir, 'FINAL-RUN.md') + '\nopen the .html files under ' + dir + ' in a browser, read FINAL-RUN.md, then fill RESULTS.md from the template.\n');
  return bad ? 1 : 0;
}

function summaryLine(r) {
  const parts = Object.keys(r.items).sort((a, b) => a - b).map((k) => k + ':' + r.items[k].result);
  return r.label + ' -> ' + r.status + (parts.length ? ' [' + parts.join(' ') + ']' : '') + (r.status === 'band_not_drawn' ? ' (the band never appeared; see ' + (r.files.txt || 'the capture') + ')' : '') + (r.status === 'session_exited' ? ' (the session ended; see ' + (r.files.txt || 'the capture') + ' and ' + (r.files.debugLog || 'the debug log') + ')' : '');
}

module.exports = { analyze, rollUp, buildInterim, writeInterim, runOne, preflight, MATRIX, ITEMS, sliceGrid, findTabStrip, frameText, finalRuns, buildFinalReport, resolveScript, writeHalfblockProbe, analyzeHalfblock, judgeScript, trustDialogState };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { process.stderr.write('render-check: ' + (e.stack || e.message) + '\n'); process.exit(1); });
}
