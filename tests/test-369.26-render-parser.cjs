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

scenario('checkBar and locateBar: ten cells, six filled at 62 percent, empty cells are U+00B7', () => {
  const filled = bgHex(HEX.mondrian_yellow) + ' ';
  const bar = filled.repeat(6) + RESET + DOT.repeat(4);
  const cap = 'Context used: 62% ' + bar;
  const g = G.parseAnsi(cap, 40, 1);
  const col = G.locateBar(g, 0, 0, PALETTE);
  assert.strictEqual(col, 'Context used: 62% '.length);
  const r = G.checkBar(g, 0, col, PALETTE, { percent: 62 });
  assert.strictEqual(r.total, 10);
  assert.strictEqual(r.filled, 6);
  assert.strictEqual(r.empty, 4);
  assert.strictEqual(r.emptyAreDots, true);
  assert.strictEqual(r.expectedFilled, 6);
  assert.strictEqual(r.roundingOk, true);
  assert.strictEqual(r.ok, true);
});

scenario('checkBar mutation: five filled at 62, a space for an empty cell, and a short bar each fail', () => {
  const filled = bgHex(HEX.mondrian_yellow) + ' ';
  const five = G.parseAnsi(filled.repeat(5) + RESET + DOT.repeat(5), 20, 1);
  const r5 = G.checkBar(five, 0, 0, PALETTE, { percent: 62 });
  assert.strictEqual(r5.filled, 5);
  assert.strictEqual(r5.roundingOk, false);
  assert.strictEqual(r5.ok, false);

  const spaceEmpty = G.parseAnsi(filled.repeat(6) + RESET + DOT.repeat(3) + ' ', 20, 1);
  const rs = G.checkBar(spaceEmpty, 0, 0, PALETTE, { percent: 62 });
  assert.strictEqual(rs.total < 10 || rs.emptyAreDots === false, true);
  assert.strictEqual(rs.ok, false);

  const short = G.parseAnsi(filled.repeat(6) + RESET + DOT.repeat(2), 20, 1);
  assert.strictEqual(G.checkBar(short, 0, 0, PALETTE, { percent: 62 }).ok, false);
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

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed ? 1 : 0);
