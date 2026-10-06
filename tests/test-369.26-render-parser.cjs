// 369.26-09 Task 1: unit tests for the ANSI grid parser and the paint, logo and bar checks.
//
// Why: the render check turns a real `tmux capture-pane -p -e` capture into a cell grid and asks
// "did the band really paint?". The checks themselves must be proven on KNOWN input first, or a
// real capture could pass or fail for the wrong reason. Canned captures are built with
// String.fromCharCode(27) so this file stays plain ASCII (U+00B7 is spelled as an escape).
//
// Plain counters, nonzero exit tail (house harness). No I/O, no tmux, no Claude.
'use strict';

const assert = require('node:assert');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'ui', 'mindrian-workspace-mod', 'scripts', 'lib', 'ansi-grid.cjs');

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

let G;
try {
  G = require(LIB);
} catch (e) {
  process.stdout.write('  FAIL load ' + LIB + '\n    ' + e.message + '\n');
  process.stdout.write('\n0 passed, 1 failed (library missing)\n');
  process.exit(1);
}

const E = String.fromCharCode(27);
const DOT = String.fromCharCode(0x00b7);
const sgr = (p) => E + '[' + p + 'm';
const bgHex = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return sgr('48;2;' + ((n >> 16) & 255) + ';' + ((n >> 8) & 255) + ';' + (n & 255));
};
const RESET = sgr('0');

const PALETTE = {
  base: {
    mondrian_red: '#A63D2F',
    mondrian_blue: '#1E3A6E',
    mondrian_yellow: '#C8A43C',
    mondrian_black: '#0D0D0D',
    mondrian_white: '#F5F0E8',
    cream: '#F5F0E8',
    gray_meta: '#A09A90',
    success_green: '#2D6B4A',
  },
};
const HEX = PALETTE.base;

// The logo written by hand from UI-SPEC 6.3 (not built from the library's own table).
// B=blue R=red Y=yellow K=frame C=cream G=green
const LOGO_TALL_HAND = ['BBBKRRKCKG', 'BBBKYYKCKG', 'BBBKYYKCKK'];
const LOGO_COMPACT_HAND = 'BBKRYKCKG';
const KEYHEX = { B: HEX.mondrian_blue, R: HEX.mondrian_red, Y: HEX.mondrian_yellow, K: HEX.mondrian_black, C: HEX.cream, G: HEX.success_green };

function paintRow(letters) {
  let s = '';
  for (const l of letters) s += bgHex(KEYHEX[l]) + ' ';
  return s + RESET;
}

scenario('parseAnsi: three adjacent truecolor runs parse to exactly those runs', () => {
  const cap = bgHex(HEX.mondrian_blue) + ' '.repeat(20) + sgr('49') + ' ' + bgHex(HEX.mondrian_yellow) + ' '.repeat(10) + RESET;
  const grid = G.parseAnsi(cap, 31, 1);
  assert.strictEqual(grid.cols, 31);
  assert.deepStrictEqual(G.bgRuns(grid, 0), [
    { bg: '#1e3a6e', from: 0, to: 19 },
    { bg: null, from: 20, to: 20 },
    { bg: '#c8a43c', from: 21, to: 30 },
  ]);
  assert.strictEqual(grid.forms['48;2'], 2);
});

scenario('parseAnsi: 256-color, basic, bright, bold, dim, inverse and their resets', () => {
  const cap =
    sgr('48;5;24') + 'a' + sgr('38;5;196') + 'b' + sgr('41') + 'c' + sgr('104') + 'd' + sgr('0') +
    sgr('1') + 'e' + sgr('2') + 'f' + sgr('22') + 'g' + sgr('7') + 'h' + sgr('27') + 'i' + sgr('31') + 'j' + sgr('39') + 'k';
  const g = G.parseAnsi(cap, 12, 1);
  const c = g.cells[0];
  assert.strictEqual(c[0].bg, '@24');
  assert.strictEqual(c[1].fg, '@196');
  assert.strictEqual(c[1].bg, '@24');
  assert.strictEqual(c[2].bg, '$1');
  assert.strictEqual(c[3].bg, '$12');
  assert.strictEqual(c[4].bg, null);
  assert.strictEqual(c[4].bold, true);
  assert.strictEqual(c[5].dim, true);
  assert.strictEqual(c[5].bold, true);
  assert.strictEqual(c[6].bold, false);
  assert.strictEqual(c[6].dim, false);
  assert.strictEqual(c[7].inverse, true);
  assert.strictEqual(c[8].inverse, false);
  assert.strictEqual(c[9].fg, '$1');
  assert.strictEqual(c[10].fg, null);
  assert.deepStrictEqual(G.colorToRgb('@24'), [0, 95, 135]);
  assert.deepStrictEqual(G.colorToRgb('#1e3a6e'), [30, 58, 110]);
  assert.deepStrictEqual(G.colorToRgb(null), null);
});

scenario('parseAnsi: CR and LF end rows, short rows pad, tabs expand, non-SGR escapes are ignored', () => {
  const cap = 'ab\r\ncd\nef\tg' + E + '[2K' + E + ']0;a title' + String.fromCharCode(7) + E + '[1;1H' + 'z';
  const g = G.parseAnsi(cap, 12, 5);
  assert.strictEqual(g.rows, 5);
  assert.strictEqual(g.cells.length, 5);
  for (const row of g.cells) assert.strictEqual(row.length, 12);
  assert.strictEqual(G.rowText(g, 0), 'ab');
  assert.strictEqual(G.rowText(g, 1), 'cd');
  assert.strictEqual(G.rowText(g, 2), 'ef      gz');
  assert.strictEqual(g.cells[4][0].ch, ' ');
});

scenario('parseAnsi: a colon-separated truecolor form and a wide character keep columns right', () => {
  const cap = E + '[48:2::30:58:110m' + 'x' + E + '[0m' + String.fromCharCode(0x4e2d) + 'y';
  const g = G.parseAnsi(cap, 6, 1);
  assert.strictEqual(g.cells[0][0].bg, '#1e3a6e');
  assert.strictEqual(g.cells[0][1].ch, String.fromCharCode(0x4e2d));
  assert.strictEqual(g.cells[0][2].ch, '');
  assert.strictEqual(g.cells[0][3].ch, 'y');
});

scenario("findText: finds the first match across colour changes, null when absent", () => {
  const cap = sgr('1') + "You're " + sgr('48;5;24') + 'in:' + sgr('0') + ' Funding\nsecond row You\'re in:';
  const g = G.parseAnsi(cap, 40, 3);
  assert.deepStrictEqual(G.findText(g, "You're in:"), { row: 0, col: 0, endCol: 10 });
  assert.deepStrictEqual(G.findText(g, 'Funding'), { row: 0, col: 11, endCol: 18 });
  assert.strictEqual(G.findText(g, 'not drawn'), null);
  assert.strictEqual(G.findText(g, "You're in:", { fromRow: 1 }).row, 1);
});

scenario('toHtml: self-contained, starts with a doctype, escapes markup, deterministic', () => {
  const cap = bgHex(HEX.mondrian_blue) + '<b> & x' + RESET + sgr('2') + ' dim' + RESET;
  const g = G.parseAnsi(cap, 20, 2);
  const a = G.toHtml(g, { title: 'probe' });
  const b = G.toHtml(G.parseAnsi(cap, 20, 2), { title: 'probe' });
  assert.strictEqual(a, b);
  assert.ok(a.startsWith('<!doctype html>'));
  assert.ok(a.includes('&lt;b&gt; &amp; x'));
  assert.ok(a.includes('background:#1e3a6e'));
  assert.ok(a.includes('opacity'));
  assert.ok(!/<script/i.test(a));
});

scenario('checkPaint: exact colour, a quantized 256-colour value reports its distance, a wrong block fails', () => {
  const cap =
    bgHex(HEX.mondrian_blue) + " You're in: Funding " + RESET + ' ' +
    sgr('48;5;24') + ' A decision is waiting ' + RESET + ' ' +
    bgHex(HEX.cream) + ' Next: look ' + RESET;
  const g = G.parseAnsi(cap, 80, 1);
  const out = G.checkPaint(g, PALETTE, [
    { name: 'place', text: "You're in:", key: 'mondrian_blue' },
    { name: 'waiting-as-quantized', text: 'A decision', key: 'mondrian_blue' },
    { name: 'waiting-wrong-key', text: 'A decision', key: 'mondrian_yellow' },
    { name: 'next', text: 'Next:', key: 'cream' },
    { name: 'absent', text: 'nothing here', key: 'cream' },
  ]);
  const by = Object.fromEntries(out.map((r) => [r.name, r]));
  assert.strictEqual(by.place.found, true);
  assert.strictEqual(by.place.bgMatches, true);
  assert.strictEqual(by.place.distance, 0);
  assert.strictEqual(by.place.quantized, false);
  assert.strictEqual(by.place.contiguousCells, ' You\'re in: Funding '.length);
  assert.strictEqual(by['waiting-as-quantized'].bgMatches, true);
  assert.strictEqual(by['waiting-as-quantized'].quantized, true);
  assert.ok(by['waiting-as-quantized'].distance > 0);
  assert.strictEqual(by['waiting-wrong-key'].bgMatches, false);
  assert.strictEqual(by.next.bgMatches, true);
  assert.strictEqual(by.absent.found, false);
  assert.strictEqual(by.absent.bgMatches, false);
});

scenario('checkLogo: the hand-written 10x3 and 9x1 logos pass, with an origin that is not the corner', () => {
  const tall = LOGO_TALL_HAND.map((r) => ' '.repeat(3) + paintRow(r)).join('\n');
  const g = G.parseAnsi(tall, 30, 3);
  const r = G.checkLogo(g, { row: 0, col: 3 }, 'tall', PALETTE);
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(r.mismatch, null);
  assert.strictEqual(r.checked, 30);
  const found = G.findLogo(g, PALETTE, 'tall');
  assert.deepStrictEqual(found.origin, { row: 0, col: 3 });
  assert.strictEqual(found.ok, true);

  const compact = G.parseAnsi('  ' + paintRow(LOGO_COMPACT_HAND), 20, 1);
  const rc = G.checkLogo(compact, { row: 0, col: 2 }, 'compact', PALETTE);
  assert.strictEqual(rc.ok, true, JSON.stringify(rc));
  assert.strictEqual(rc.checked, 9);
});

scenario('checkLogo mutation: one flipped cell is reported with its place, expected and got', () => {
  const rows = LOGO_TALL_HAND.slice();
  rows[1] = rows[1].slice(0, 4) + 'R' + rows[1].slice(5); // yellow became red at row 1 col 4
  const g = G.parseAnsi(rows.map((r) => paintRow(r)).join('\n'), 12, 3);
  const r = G.checkLogo(g, { row: 0, col: 0 }, 'tall', PALETTE);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(r.mismatch, { row: 1, col: 4, expected: 'mondrian_yellow', got: 'mondrian_red' });
  assert.strictEqual(G.findLogo(g, PALETTE, 'tall').ok, false);
});

scenario('checkLogo: a logo with no background fill at all (text only) fails and says what it found', () => {
  const g = G.parseAnsi('M:OS\n\n', 12, 3);
  const r = G.checkLogo(g, { row: 0, col: 0 }, 'tall', PALETTE);
  assert.strictEqual(r.ok, false);
  assert.ok(r.mismatch && r.mismatch.got !== undefined);
});

// F4 (2026-10-06 real run): the bar is a black track with a black cap at each end, a paper fill and
// paper dots on the black. A canned bar segment: cap, `filled` paper cells, `empty` dots, cap.
const fgHex = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return sgr('38;2;' + ((n >> 16) & 255) + ';' + ((n >> 8) & 255) + ';' + (n & 255));
};
function barSeg(filled, o) {
  const opt = Object.assign({ fillBg: HEX.cream, dotBg: HEX.mondrian_black, dotFg: HEX.cream, capBg: HEX.mondrian_black }, o || {});
  let t = bgHex(opt.capBg) + ' ';
  for (let i = 0; i < 10; i += 1) t += i < filled ? bgHex(opt.fillBg) + ' ' : bgHex(opt.dotBg) + fgHex(opt.dotFg) + DOT;
  return t + bgHex(opt.capBg) + ' ' + RESET;
}

scenario('checkBar and locateBar: cap, ten cells, cap; six filled at 62 percent, empty cells are U+00B7, the fill shows on the track', () => {
  const cap = bgHex(HEX.cream) + 'Context used: 62% ' + RESET + barSeg(6);
  const g = G.parseAnsi(cap, 40, 1);
  const col = G.locateBar(g, 0, 0, PALETTE);
  assert.strictEqual(col, 'Context used: 62% '.length + 1, 'the first of the ten cells, after the left cap');
  const r = G.checkBar(g, 0, col, PALETTE, { percent: 62 });
  assert.strictEqual(r.total, 10);
  assert.strictEqual(r.filled, 6);
  assert.strictEqual(r.empty, 4);
  assert.strictEqual(r.emptyAreDots, true);
  assert.strictEqual(r.capsOk, true);
  assert.strictEqual(r.fillVisible, true);
  assert.strictEqual(r.dotsVisible, true);
  assert.strictEqual(r.expectedFilled, 6);
  assert.strictEqual(r.roundingOk, true);
  assert.strictEqual(r.ok, true);
});

scenario('checkBar F4: a fill with the color of the track behind it FAILS (the bug of the real run), whatever the cause', () => {
  // The fill is paper but the empty cells sit on paper too: the fill and the track are one color.
  const same = G.parseAnsi(barSeg(6, { dotBg: HEX.cream, dotFg: HEX.mondrian_black }), 20, 1);
  const rs = G.checkBar(same, 0, G.locateBar(same, 0, 0, PALETTE), PALETTE, { percent: 62 });
  assert.strictEqual(rs.fillVisible, false);
  assert.strictEqual(rs.ok, false);
  // A dot with its own background color is invisible too.
  const blind = G.parseAnsi(barSeg(6, { dotFg: HEX.mondrian_black }), 20, 1);
  const rb = G.checkBar(blind, 0, G.locateBar(blind, 0, 0, PALETTE), PALETTE, { percent: 62 });
  assert.strictEqual(rb.dotsVisible, false);
  assert.strictEqual(rb.ok, false);
  // The old bar (black fill on the paper block, paper dots, no caps) is not a bar any more: not found.
  const old = G.parseAnsi(bgHex(HEX.cream) + 'x ' + bgHex(HEX.mondrian_black) + ' '.repeat(6) + bgHex(HEX.cream) + fgHex(HEX.mondrian_black) + DOT.repeat(4) + RESET, 30, 1);
  assert.strictEqual(G.locateBar(old, 0, 0, PALETTE), null);
  // A bar whose fill is black on a black track (caps and fill one color): the cells are not paper, so no bar.
  const blackFill = G.parseAnsi(barSeg(6, { fillBg: HEX.mondrian_black }), 20, 1);
  assert.strictEqual(G.locateBar(blackFill, 0, 0, PALETTE), null);
});

scenario('checkBar mutation: five filled at 62, a space for an empty cell, a short bar and a missing cap each fail', () => {
  const five = G.parseAnsi(barSeg(5), 20, 1);
  const r5 = G.checkBar(five, 0, G.locateBar(five, 0, 0, PALETTE), PALETTE, { percent: 62 });
  assert.strictEqual(r5.filled, 5);
  assert.strictEqual(r5.roundingOk, false);
  assert.strictEqual(r5.ok, false);

  const spaceEmpty = G.parseAnsi(bgHex(HEX.mondrian_black) + ' ' + (bgHex(HEX.cream) + ' ').repeat(6) + bgHex(HEX.mondrian_black) + DOT.repeat(3) + ' ' + RESET, 20, 1);
  assert.strictEqual(G.locateBar(spaceEmpty, 0, 0, PALETTE), null);

  const short = G.parseAnsi(bgHex(HEX.mondrian_black) + ' ' + (bgHex(HEX.cream) + ' ').repeat(6) + bgHex(HEX.mondrian_black) + fgHex(HEX.cream) + DOT.repeat(2) + bgHex(HEX.mondrian_black) + ' ' + RESET, 20, 1);
  assert.strictEqual(G.locateBar(short, 0, 0, PALETTE), null);

  // No right cap: the bar edge would merge into the paper block at 100 percent, so it is not accepted.
  const noCap = G.parseAnsi(bgHex(HEX.mondrian_black) + ' ' + (bgHex(HEX.cream) + ' ').repeat(10) + RESET, 20, 1);
  assert.strictEqual(G.locateBar(noCap, 0, 0, PALETTE), null);
  // 100 and 0 percent keep their edges.
  const full = G.parseAnsi(barSeg(10), 20, 1);
  assert.strictEqual(G.checkBar(full, 0, G.locateBar(full, 0, 0, PALETTE), PALETTE, { percent: 100 }).ok, true);
  const none = G.parseAnsi(barSeg(0), 20, 1);
  assert.strictEqual(G.checkBar(none, 0, G.locateBar(none, 0, 0, PALETTE), PALETTE, { percent: 0 }).ok, true);
});

scenario('summarize: reports which SGR forms were seen, whether any background exists, and dim use', () => {
  const g = G.parseAnsi(bgHex(HEX.mondrian_blue) + 'a' + sgr('38;5;100') + sgr('2') + 'b' + sgr('41') + 'c' + RESET, 5, 1);
  const s = G.summarize(g);
  assert.strictEqual(s.hasBackground, true);
  assert.strictEqual(s.forms['48;2'], 1);
  assert.strictEqual(s.forms['38;5'], 1);
  assert.strictEqual(s.forms['basic-bg'], 1);
  assert.strictEqual(s.dimCells, 2); // b and c: dim stays on until a reset
  const none = G.summarize(G.parseAnsi('plain text', 12, 1));
  assert.strictEqual(none.hasBackground, false);
  assert.strictEqual(none.dimCells, 0);
});


// ---- F3: the checks follow the current UI-SPEC (C-28 to C-32), on canned captures ---------------------

const RC = require(path.join(REPO, 'ui', 'mindrian-workspace-mod', 'scripts', 'render-check.cjs'));
const WHITE = HEX.cream;
const BLACK = HEX.mondrian_black;
const seg = (bg, fg, text, flags) => (bg ? bgHex(bg) : sgr('49')) + (fg ? fgHex(fg) : '') + (flags && flags.bold ? sgr('1') : '') + (flags && flags.dim ? sgr('2') : '') + text + RESET;
const RULE = String.fromCharCode(0x2500).repeat(60);
const markCell = (first) => seg(BLACK, WHITE, first ? ' M:OS ' : '      ', { bold: true });
// A three-row band at the wide tier. o.pct is the context percent; o.bar draws the ten-cell bar.
function wideBand(o) {
  const opt = Object.assign({ pct: 62, bar: true, hint: seg(WHITE, BLACK, '/workspace: Open workspace'), chip: false, next: true }, o || {});
  const ctx = opt.pct >= 80
    ? seg(BLACK, WHITE, ' Context used: ' + opt.pct + '%. Save your thinking now. ', { bold: true }) + (opt.chip ? seg(BLACK, WHITE, ' [ Save my thinking ] ') : '')
    : seg(WHITE, BLACK, ' Context used: ' + opt.pct + '% ') + (opt.bar ? barSeg(Math.round(opt.pct / 10)) : '');
  const r0 = markCell(true) + seg(WHITE, BLACK, " You're in: Funding (sample) ") + seg(BLACK, null, ' ') + seg(BLACK, WHITE, ' A decision is waiting ', { bold: true }) + seg(BLACK, null, ' ') + ctx;
  const r1 = markCell(false) + seg(WHITE, BLACK, ' This folder is for: building the funding case (sample) ');
  const r2 = markCell(false) + (opt.next ? seg(WHITE, BLACK, ' Next: look at the evidence (sample) ') + '   ' + opt.hint : '');
  return [r0, r1, r2, RULE, '> ', RULE, '  statusline: Next: Run Methodology'];
}
const screenOf = (rows) => rows.join('\n');
const analyzeCanned = (rows, ctx) => {
  const text = screenOf(rows);
  const grid = G.parseAnsi(text, 140, 12);
  return RC.analyze(grid, text, Object.assign({ palette: PALETTE, keys: null, pane: 'none', sizeCols: 140, noColorRun: false, env: [] }, ctx || {}));
};

scenario('F3 item 3: the new bar passes; the old black-fill bar and a bar-less 62 percent band FAIL', () => {
  const ok = analyzeCanned(wideBand());
  assert.strictEqual(ok.items[3].result, 'PASS', ok.items[3].detail);
  assert.strictEqual(ok.items[3].data.filled, 6);
  assert.strictEqual(ok.items[10].result, 'PASS');
  const missing = analyzeCanned(wideBand({ bar: false }));
  assert.strictEqual(missing.items[3].result, 'FAIL');
  assert.ok(/no ten-cell bar/.test(missing.items[3].detail), missing.items[3].detail);
  const rows = wideBand({ bar: false });
  rows[0] = rows[0] + bgHex(WHITE) + ' ' + bgHex(BLACK) + ' '.repeat(6) + bgHex(WHITE) + fgHex(BLACK) + DOT.repeat(4) + RESET; // the old F4 bar
  const old = analyzeCanned(rows);
  assert.strictEqual(old.items[3].result, 'FAIL');
});

scenario('F3 item 3: the limit state (80 and over) is words and a fix chip with NO bar; a bar there, or a missing chip, FAILS', () => {
  const ok = analyzeCanned(wideBand({ pct: 85, chip: true }));
  assert.strictEqual(ok.items[3].result, 'PASS', ok.items[3].detail);
  assert.strictEqual(ok.items[3].data.limit, true);
  assert.strictEqual(ok.items[3].data.chip, true);
  const noChip = analyzeCanned(wideBand({ pct: 85, chip: false }));
  assert.strictEqual(noChip.items[3].result, 'FAIL');
  assert.ok(/fix chip/.test(noChip.items[3].detail), noChip.items[3].detail);
  const rows = wideBand({ pct: 85, chip: true });
  rows[0] = rows[0] + seg(WHITE, BLACK, ' ') + barSeg(9);
  const withBar = analyzeCanned(rows);
  assert.strictEqual(withBar.items[3].result, 'FAIL');
  assert.ok(/no bar/.test(withBar.items[3].detail), withBar.items[3].detail);
  // The limit block is a black block (C-32): item 1 reads it as one.
  assert.strictEqual(ok.items[1].result, 'PASS', ok.items[1].detail);
  assert.ok(ok.items[1].data.checks.some((c) => c.name === 'context-limit' && c.bgMatches));
});

scenario('F3 item 5: a band hint is normal-weight black on cream; a dim hint (the old design) FAILS, a bold or wrongly colored one too', () => {
  assert.strictEqual(analyzeCanned(wideBand()).items[5].result, 'PASS');
  const dim = analyzeCanned(wideBand({ hint: seg(WHITE, BLACK, '/workspace: Open workspace', { dim: true }) }));
  assert.strictEqual(dim.items[5].result, 'FAIL');
  assert.ok(/dim/.test(dim.items[5].detail), dim.items[5].detail);
  const bold = analyzeCanned(wideBand({ hint: seg(WHITE, BLACK, '/workspace: Open workspace', { bold: true }) }));
  assert.strictEqual(bold.items[5].result, 'FAIL');
  const pale = analyzeCanned(wideBand({ hint: seg(WHITE, HEX.mondrian_blue, '/workspace: Open workspace') }));
  assert.strictEqual(pale.items[5].result, 'FAIL');
  assert.ok(/not black/.test(pale.items[5].detail), pale.items[5].detail);
});

scenario('F3 item 1: the band is read by its own rows; "Next:" in the statusline or a pane never counts (the one-row band has no Next row)', () => {
  // One-row band (55 columns): the mark cell is one row tall; the statusline says "Next:" in default colors.
  const one = [markCell(true) + seg(WHITE, BLACK, ' Funding (sample) ') + seg(BLACK, null, ' ') + seg(BLACK, WHITE, ' 1 decision waiting ', { bold: true }), '  plugin notice', RULE, '> ', RULE, '  statusline: Next: Run Methodology'];
  const a = analyzeCanned(one, { sizeCols: 55 });
  assert.strictEqual(a.items[1].result, 'PASS', a.items[1].detail);
  assert.deepStrictEqual(a.items[1].data.checks.map((c) => c.name).sort(), ['place', 'waiting']);
  assert.deepStrictEqual(a.info.bandRows, { top: 0, end: 1, promptTop: 2 });
  // A Next row that IS in the band and has the wrong fill still FAILS (the check is not weakened).
  const rows = wideBand();
  rows[2] = markCell(false) + ' Next: look at the evidence (sample) ';
  const bad = analyzeCanned(rows);
  assert.strictEqual(bad.items[1].result, 'FAIL');
  assert.ok(/next \(wanted cream/.test(bad.items[1].detail), bad.items[1].detail);
  // A waiting block that is not black FAILS.
  const rows2 = wideBand();
  rows2[0] = rows2[0].replace(bgHex(BLACK) + fgHex(WHITE) + sgr('1') + ' A decision is waiting ', bgHex(WHITE) + fgHex(BLACK) + sgr('1') + ' A decision is waiting ');
  const wrong = analyzeCanned(rows2);
  assert.strictEqual(wrong.items[1].result, 'FAIL');
  assert.ok(/waiting \(wanted mondrian_black/.test(wrong.items[1].detail), wrong.items[1].detail);
});

scenario('F3 an open pane that covers the band: no band item is read from the pane or the statusline; item 8 says why, item 9 reads the pane', () => {
  const tab = seg(null, null, ' [ Room ] [ Think ] [ Sources ]  > Review ');
  const covered = [tab, seg(WHITE, BLACK, ' A decision is waiting for you '), seg(WHITE, BLACK, ' Esc: Close '), '', RULE, '> ', RULE, '  statusline: Next: Run Methodology'];
  const a = analyzeCanned(covered, { pane: 'open', sizeCols: 55 });
  assert.strictEqual(a.items[1], undefined);
  assert.strictEqual(a.items[2], undefined);
  assert.strictEqual(a.items[3], undefined);
  assert.strictEqual(a.items[5], undefined);
  assert.strictEqual(a.items[8].result, 'INCONCLUSIVE');
  assert.ok(/not on the screen/.test(a.items[8].detail), a.items[8].detail);
  assert.strictEqual(a.items[9].result, 'PASS');
  assert.strictEqual(a.info.paneOpened, true);
});

scenario('F3 item 2: the plain M:OS mark (C-32) is the only logo read; the retired rectangle logo is never expected', () => {
  const a = analyzeCanned(wideBand());
  assert.strictEqual(a.items[2].result, 'PASS');
  assert.strictEqual(a.items[2].data.variant, 'text');
  const notBold = wideBand();
  notBold[0] = notBold[0].replace(sgr('1') + ' M:OS ', ' M:OS ');
  assert.strictEqual(analyzeCanned(notBold).items[2].result, 'FAIL');
});

scenario('F3 ITEMS: items 3 and 5 are renamed to the current design (no ten-cell bar at the limit, no dim hint)', () => {
  const byN = Object.fromEntries(RC.ITEMS.map((i) => [i.n, i.name]));
  assert.ok(/limit/.test(byN[3]) && /caps/.test(byN[3]), byN[3]);
  assert.ok(/never dim/.test(byN[5]), byN[5]);
  assert.ok(/M:OS|mark/.test(byN[2]) || /logos/.test(byN[2]), byN[2]);
});

// ---- 369.26-17: the pure additions for the final render check (records hash, MCP name parsing,
// script runner, deck lookup, round trip judging) and the live fixture room ----------------------

const LIB_DIR = path.join(REPO, 'ui', 'mindrian-workspace-mod', 'scripts', 'lib');
const requireLive = (name) => require(path.join(LIB_DIR, name));

scenario('17 hashRecords: stable under row and key order, changes when a row changes, 64 hex', () => {
  const P = requireLive('live-pure.cjs');
  const a = P.hashRecords([{ id: 'x', type: 'decision', n: 1 }, { id: 'y', type: 'claim' }]);
  const b = P.hashRecords([{ type: 'claim', id: 'y' }, { n: 1, type: 'decision', id: 'x' }]);
  assert.strictEqual(a, b);
  assert.ok(/^[0-9a-f]{64}$/.test(a));
  assert.notStrictEqual(a, P.hashRecords([{ id: 'x', type: 'decision', n: 2 }, { id: 'y', type: 'claim' }]));
  assert.notStrictEqual(a, P.hashRecords([{ id: 'x', type: 'decision', n: 1 }]));
  assert.strictEqual(P.hashRecords([]), P.hashRecords([]));
});

scenario('17 parseMcpServerNames: reads plugin-qualified names and status words out of canned /mcp text', () => {
  const P = requireLive('live-pure.cjs');
  const canned = [
    'Manage MCP servers',
    '3 servers',
    '',
    '  Plugin MCPs',
    '  ❯ plugin:mos:mindrian-os · ✔ connected',
    '    plugin:mos:mindrian-brain · ✔ connected',
    '  User MCPs',
    '    notion · ✘ failed',
    '',
    '  https://code.claude.com/docs/en/mcp for help',
  ].join('\n');
  const r = P.parseMcpServerNames(canned);
  assert.ok(r.names.includes('plugin:mos:mindrian-os'), JSON.stringify(r));
  assert.ok(r.names.includes('plugin:mos:mindrian-brain'));
  assert.ok(r.names.includes('notion'));
  assert.strictEqual(r.statuses['plugin:mos:mindrian-os'], 'connected');
  assert.strictEqual(r.statuses.notion, 'failed');
  assert.deepStrictEqual(P.parseMcpServerNames('nothing here').names, []);
  assert.strictEqual(P.compareServerName(r.names, 'plugin:mos:mindrian-os').verdict, 'match');
  const miss = P.compareServerName(['plugin:mos:other-os', 'notion'], 'plugin:mos:mindrian-os');
  assert.strictEqual(miss.verdict, 'differs');
  assert.deepStrictEqual(miss.closest, ['plugin:mos:other-os']);
  assert.strictEqual(P.compareServerName([], 'x').verdict, 'not_seen');
});

scenario('17 parseScript: keys, waits, captures, bursts and inspects parse in order; a bad line names its number', () => {
  const P = requireLive('live-pure.cjs');
  const steps = P.parseScript(['# the round trip', 'wait 1500', 'type o', '', 'capture opened', 'burst 1 1', 'key Enter', 'inspect after'].join('\n'));
  assert.deepStrictEqual(steps, [
    { op: 'wait', ms: 1500 },
    { op: 'type', text: 'o' },
    { op: 'capture', name: 'opened' },
    { op: 'burst', keys: ['1', '1'] },
    { op: 'key', name: 'Enter' },
    { op: 'inspect', name: 'after' },
  ]);
  assert.deepStrictEqual(P.parseScript('type hello world')[0], { op: 'type', text: 'hello world' });
  assert.throws(() => P.parseScript('wait soon'), /line 1/);
  assert.throws(() => P.parseScript('type a\nfly away'), /line 2/);
  assert.throws(() => P.parseScript('burst'), /line 1/);
  for (const name of Object.keys(P.PRESETS)) assert.ok(P.parseScript(P.PRESETS[name]).length > 0, 'preset ' + name);
  for (const need of ['roundtrip', 'decide-later', 'double-press', 'o-empty', 'o-after-text', 'digit-in-pane', 'h-empty']) assert.ok(P.PRESETS[need], 'preset ' + need);
});

scenario('17 deckStringFrom: reads a deck line, decodes escapes, and refuses an unknown id', () => {
  const P = requireLive('live-pure.cjs');
  const src = "export const COPY = {\n  'D24': 'Saved to your data room: {label}.',\n  'B67': ' \\u00b7 ',\n  'B10': \"You're in: {folder}\",\n}\n";
  assert.strictEqual(P.deckStringFrom(src, 'D24'), 'Saved to your data room: {label}.');
  assert.strictEqual(P.deckStringFrom(src, 'B67'), ' ' + DOT + ' ');
  assert.strictEqual(P.deckStringFrom(src, 'B10'), "You're in: {folder}");
  assert.strictEqual(P.deckStringFrom(src, 'Z99'), null);
  const real = P.readDeck(path.join(REPO, 'ui', 'mindrian-workspace-mod', 'src', 'copy', 'deck.ts'));
  assert.strictEqual(real.D24, 'You chose {label}. Saved to your data room.');
  // The saved-sentence match is the persistence claim after the label (C-30), not the words "You chose".
  assert.strictEqual(P.deckPrefix(real.D24), 'Saved to your data room');
  assert.strictEqual(P.deckPrefix('Saved to your data room: {label}.'), 'Saved to your data room');
  assert.ok(real.E01 && real.E04 && real.P115 && real.B60);
});

scenario('17 judgeRoundTrip: the verdicts follow the frames and the room, and a missing frame stays PENDING', () => {
  const P = requireLive('live-pure.cjs');
  const deck = { B60: 'A decision is waiting', P110: 'A decision is waiting for you', E01: 'This decision card is not one this window drew. Ask for it again.', E04: 'E04 words', P115: 'Ask it here', D23: 'Saving your decision', D24Prefix: 'Saved to your data room' };
  const frames = {
    band: 'You are in: Funding   A decision is waiting   This folder is for: x (sample)',
    opened: 'Room Think Sources Review\nA decision is waiting for you\n[1] Yes, go with it',
    direct: 'A decision is waiting for you\nThis decision card is not one this window drew. Ask for it again.\nAsk it here',
    mirrored: 'A decision is waiting for you\n[1] Yes, go with it',
    saved: 'Saved to your data room: Yes, go with it.',
  };
  const inspection = { after: { decisionNodes: ['decision:gate:g2'], gateAnswer: { found: true, verdict: 'approve', chosen: ['yes'], answeredVia: 'mcp_relayed' }, recordsHash: 'h2' }, before: { decisionNodes: [], gateAnswer: { found: false }, recordsHash: 'h1' } };
  const v = P.judgeRoundTrip({ frames, inspection, deck });
  const by = Object.fromEntries(v.map((x) => [x.id, x]));
  assert.strictEqual(by.a.result, 'PASS');
  assert.strictEqual(by.b.result, 'PASS');
  assert.strictEqual(by.c.result, 'PASS');
  assert.strictEqual(by.d.result, 'PASS');
  assert.strictEqual(by.e.result, 'PASS');
  assert.strictEqual(by.f.result, 'PASS');
  assert.ok(/mcp_relayed/.test(by.f.detail));
  assert.strictEqual(by.saving.result, 'PENDING-HUMAN');

  // saved shown with nothing in the room is the one failure that matters most
  const lie = P.judgeRoundTrip({ frames, inspection: { after: { decisionNodes: [], gateAnswer: { found: false }, recordsHash: 'h1' }, before: inspection.before }, deck });
  assert.strictEqual(lie.find((x) => x.id === 'e').result, 'FAIL');
  assert.strictEqual(lie.find((x) => x.id === 'f').result, 'FAIL');
  // a saved sentence in a frame BEFORE the press is also a failure
  const early = P.judgeRoundTrip({ frames: Object.assign({}, frames, { direct: frames.direct + '\nSaved to your data room: Yes.' }), inspection, deck });
  assert.strictEqual(early.find((x) => x.id === 'c').result, 'FAIL');
  // no frames at all: everything is PENDING-HUMAN, nothing is faked
  const none = P.judgeRoundTrip({ frames: {}, inspection: {}, deck });
  assert.ok(none.every((x) => x.result === 'PENDING-HUMAN'), JSON.stringify(none));
});

scenario('17 judgeDecideLater and judgeDoublePress: hash equality and exactly one decision node', () => {
  const P = requireLive('live-pure.cjs');
  const ok = P.judgeDecideLater({ before: { recordsHash: 'h' }, after: { recordsHash: 'h' }, frames: { after: 'A decision is waiting' }, deck: { B60: 'A decision is waiting' } });
  assert.strictEqual(ok.result, 'PASS');
  assert.strictEqual(P.judgeDecideLater({ before: { recordsHash: 'h' }, after: { recordsHash: 'z' }, frames: { after: 'A decision is waiting' }, deck: { B60: 'A decision is waiting' } }).result, 'FAIL');
  assert.strictEqual(P.judgeDecideLater({ before: null, after: null, frames: {}, deck: {} }).result, 'PENDING-HUMAN');
  assert.strictEqual(P.judgeDoublePress({ after: { decisionNodes: ['d1'] } }).result, 'PASS');
  assert.strictEqual(P.judgeDoublePress({ after: { decisionNodes: ['d1', 'd2'] } }).result, 'FAIL');
  assert.strictEqual(P.judgeDoublePress({ after: null }).result, 'PENDING-HUMAN');
});

scenario('17 live-room: exports exactly buildLiveRoom and inspectLiveRoom and never names the real rooms home', () => {
  const L = requireLive('live-room.cjs');
  assert.deepStrictEqual(Object.keys(L).sort(), ['buildLiveRoom', 'inspectLiveRoom']);
  const src = require('node:fs').readFileSync(path.join(LIB_DIR, 'live-room.cjs'), 'utf8');
  assert.ok(!/MindrianRooms/.test(src), 'the helper never names ~/MindrianRooms');
  assert.ok(!/\u2014/.test(src), 'no em-dash');
});

(async () => {
  let client = true;
  try { require('@modelcontextprotocol/client'); } catch (e) { client = false; }
  if (!client) {
    process.stdout.write('  SKIPPED live-room round trip (ENV GAP: @modelcontextprotocol/client cannot be loaded)\n');
  } else {
    const fs = require('node:fs');
    const os = require('node:os');
    let L = null;
    try { L = requireLive('live-room.cjs'); } catch (e) { L = null; }
    const P = (() => { try { return requireLive('live-pure.cjs'); } catch (e) { return null; } })();
    let live = null;
    let mod = null;
    try {
      if (!L || !P) throw new Error('live-room.cjs or live-pure.cjs is missing');
      const { cliClient } = require(path.join(REPO, 'tests', 'helpers', 'cli-gate-369.cjs'));
      live = await L.buildLiveRoom({});
      assert.ok(live.roomsHome.startsWith(os.tmpdir()), 'the rooms home is under the OS temp dir');
      assert.ok(/^gate-/.test(live.gateId), 'a raised gate id: ' + live.gateId);
      assert.ok(fs.existsSync(path.join(live.folderDir, 'ROOM.md')), 'the folder holds a ROOM.md');
      assert.ok(/\(sample\)/.test(fs.readFileSync(path.join(live.folderDir, 'ROOM.md'), 'utf8')), 'the purpose is marked (sample)');
      const before = L.inspectLiveRoom({ roomsHome: live.roomsHome, slug: live.slug, gateId: live.gateId });
      assert.deepStrictEqual(before.decisionNodes, []);
      assert.strictEqual(before.gateAnswer.found, false);
      assert.ok(/^[0-9a-f]{64}$/.test(before.recordsHash));
      const again = L.inspectLiveRoom({ roomsHome: live.roomsHome, slug: live.slug, gateId: live.gateId });
      assert.strictEqual(again.recordsHash, before.recordsHash, 'reading the room twice does not change it');

      // another session of the same room: lists the card, is refused a direct answer, mirrors, answers once
      mod = await cliClient({ roomsHome: live.roomsHome, home: live.home, sessionId: 'live-room-test-mod' });
      await mod.bind(live.slug);
      const listed = await mod.call('gate_list', {});
      assert.strictEqual(listed.ok, true, JSON.stringify(listed));
      assert.strictEqual(listed.count, 1);
      assert.strictEqual(listed.gates[0].gate_id, live.gateId);
      assert.deepStrictEqual(listed.gates[0].options.map((o) => o.id), ['yes', 'later', 'no']);
      assert.strictEqual(listed.gates[0].options[0].recommended, true);
      const direct = await mod.call('gate_answer', { gate_id: live.gateId, chosen: ['yes'], verdict: 'approve' });
      assert.strictEqual(direct.ok, false);
      assert.strictEqual(direct.reason, 'unknown_gate');
      assert.strictEqual(L.inspectLiveRoom({ roomsHome: live.roomsHome, slug: live.slug, gateId: live.gateId }).recordsHash, before.recordsHash, 'a refused press and a read write nothing');
      const m = await mod.call('gate_render', { mirror_of: live.gateId, options: listed.gates[0].options.map((o) => ({ id: o.id, label: o.id })) });
      assert.strictEqual(m.ok, true, JSON.stringify(m));
      assert.strictEqual(L.inspectLiveRoom({ roomsHome: live.roomsHome, slug: live.slug, gateId: live.gateId }).recordsHash, before.recordsHash, 'a mirror leaves no record of its own');
      const [a1, a2] = await Promise.all([
        mod.call('gate_answer', { gate_id: m.gate_id, chosen: ['yes'], verdict: 'approve' }),
        mod.call('gate_answer', { gate_id: m.gate_id, chosen: ['yes'], verdict: 'approve' }),
      ]);
      assert.strictEqual(a1.ok && a2.ok, true, JSON.stringify([a1, a2]));
      const after = L.inspectLiveRoom({ roomsHome: live.roomsHome, slug: live.slug, gateId: live.gateId });
      assert.strictEqual(after.decisionNodes.length, 1, 'two presses at once leave exactly one decision node');
      assert.strictEqual(after.gateAnswer.found, true);
      assert.strictEqual(after.gateAnswer.verdict, 'approve');
      assert.deepStrictEqual(after.gateAnswer.chosen, ['yes']);
      assert.strictEqual(after.gateAnswer.answeredVia, 'mcp_relayed');
      assert.notStrictEqual(after.recordsHash, before.recordsHash);
      passed += 1;
      process.stdout.write('  ok 17 live-room: a real raised card is listed, refused directly, mirrored without a record, saved once, and read back as mcp_relayed\n');
    } catch (e) {
      failed += 1;
      process.stdout.write('  FAIL 17 live-room round trip\n    ' + (e.stack || e.message || String(e)) + '\n');
    } finally {
      if (mod) { try { await mod.close(); } catch (e) { /* best effort */ } }
      if (live) {
        const home = live.roomsHome;
        try { await live.close(); } catch (e) { /* best effort */ }
        try {
          assert.ok(!fs.existsSync(home), 'close() removes the live room: ' + home);
          passed += 1;
          process.stdout.write('  ok 17 live-room close removes the hermetic rooms home\n');
        } catch (e) {
          failed += 1;
          process.stdout.write('  FAIL 17 live-room cleanup\n    ' + e.message + '\n');
        }
      }
    }
  }
  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed ? 1 : 0);
})();
