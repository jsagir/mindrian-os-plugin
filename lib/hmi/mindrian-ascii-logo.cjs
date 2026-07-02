'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * mindrian-ascii-logo.cjs - the MINDRIAN terminal logo (De Stijl / Mondrian).
 *
 * Design contract (navigator-confirmed banner rule, 2026-05 + 2026-07-02):
 *   - Same-size block letters, Mondrian BACKGROUND-COLOR ZONES per letter
 *     GROUP: MIN on red, DRI on yellow, AN on blue, framed by a black grid.
 *   - Tagline + "larry --navigate" prompt underneath.
 *   - Degrades to plain monochrome when NO_COLOR is set or stdout is not a
 *     TTY (README / logs stay clean).
 *
 * Consumers: /mos:update post-update banner (F8 restart cue), /mos:splash
 * (optional), any first-touch surface that wants the mark.
 *
 * CLI: node lib/hmi/mindrian-ascii-logo.cjs [--plain]
 */

const RESET = '\x1b[0m';
// Mondrian primaries as ANSI backgrounds + readable foregrounds.
const Z = {
  red:    { bg: '\x1b[48;5;160m', fg: '\x1b[97m' },  // red block, white letters
  yellow: { bg: '\x1b[48;5;220m', fg: '\x1b[30m' },  // yellow block, black letters
  blue:   { bg: '\x1b[48;5;26m',  fg: '\x1b[97m' },  // blue block, white letters
  grid:   { fg: '\x1b[1;37m' },                      // bold white grid on black
  dim:    { fg: '\x1b[2;37m' },
};

// 6-row ANSI-shadow block font, one entry per letter, SAME height (rule: same-size letters).
const F = {
  M: ['███╗   ███╗', '████╗ ████║', '██╔████╔██║', '██║╚██╔╝██║', '██║ ╚═╝ ██║', '╚═╝     ╚═╝'],
  I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  N: ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
  D: ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
  R: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
  A: [' █████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
};

// The three Mondrian zones: letter groups with their palette.
const ZONES = [
  { letters: ['M', 'I', 'N'], zone: 'red' },
  { letters: ['D', 'R', 'I'], zone: 'yellow' },
  { letters: ['A', 'N'], zone: 'blue' },
];

const TAGLINE = "Stuck on a decision you can't name? Let's find the shape of it.";
const PROMPT = '❯ larry --navigate';

function zoneRows(zone) {
  // Render one zone's letters side by side (1 space between letters), 6 rows.
  const rows = [];
  for (let r = 0; r < 6; r++) {
    rows.push(zone.letters.map((L) => F[L][r]).join(' '));
  }
  return rows;
}

function buildLogo(opts) {
  const color = opts && Object.prototype.hasOwnProperty.call(opts, 'color')
    ? !!opts.color
    : (process.stdout.isTTY && !process.env.NO_COLOR);

  const zones = ZONES.map(zoneRows);
  const widths = zones.map((rows) => rows[0].length);
  const lines = [];

  // Black grid frame: top border with zone dividers (the Mondrian grid).
  const gTop = '┏' + widths.map((w) => '━'.repeat(w + 2)).join('┳') + '┓';
  const gBot = '┗' + widths.map((w) => '━'.repeat(w + 2)).join('┻') + '┛';
  const G = (s) => (color ? Z.grid.fg + s + RESET : s);

  lines.push(G(gTop));
  for (let r = 0; r < 6; r++) {
    let line = G('┃');
    zones.forEach((rows, zi) => {
      const z = Z[ZONES[zi].zone];
      const cell = ' ' + rows[r] + ' ';
      line += color ? z.bg + z.fg + cell + RESET : cell;
      line += G('┃');
    });
    lines.push(line);
  }
  lines.push(G(gBot));
  lines.push('');
  lines.push(color ? Z.dim.fg + '  ' + TAGLINE + RESET : '  ' + TAGLINE);
  lines.push(color ? '  ' + Z.grid.fg + PROMPT + RESET : '  ' + PROMPT);
  return lines.join('\n');
}

module.exports = { buildLogo, TAGLINE, PROMPT };

if (require.main === module) {
  const plain = process.argv.includes('--plain');
  process.stdout.write(buildLogo(plain ? { color: false } : {}) + '\n');
}
