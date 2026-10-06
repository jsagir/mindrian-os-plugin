// 369.26-09: an ANSI grid parser and the paint, logo and bar checks for the render check.
//
// Why this exists: `tmux capture-pane -p -e` returns the visible screen WITH colour escapes, which
// is how a real render becomes machine-readable. parseAnsi turns that text into a grid of cells;
// the check functions then ask, in terms of UI-SPEC 17.2, whether the band really painted.
//
// Build tooling (CJS, node built-ins only, pure functions, no I/O). Not the mod's runtime source.
//
// Colour values are small canonical strings so they compare with ===:
//   '#rrggbb'  truecolor  (SGR 38;2 / 48;2)
//   '@n'       256-colour index n, 0-255  (SGR 38;5 / 48;5)
//   '$n'       basic or bright colour n, 0-15  (SGR 30-37, 40-47, 90-97, 100-107)
//   null       the terminal's default
// Xterm default values are assumed for '@n' and '$n' (a terminal theme can differ; that is a
// limit of any capture and is stated, not hidden).
'use strict';

const ESC = '\u001b';

// The five logo colours plus the frame. 'mondrian_white' is the same value as 'cream', so it is
// left out; the candidates the nearest-colour search may choose from.
const BAND_KEYS = ['mondrian_red', 'mondrian_blue', 'mondrian_yellow', 'mondrian_black', 'cream', 'success_green'];

// LEGACY (C-32): the five-rectangle logo is retired from the mod; these tables stay only for the
// parser's own fixtures (tests/test-369.26-render-parser.cjs). UI-SPEC 6.3, cell for cell. 'frame' means mondrian_black (or the terminal default, see opts).
const LOGO_TALL = [
  ['mondrian_blue', 'mondrian_blue', 'mondrian_blue', 'frame', 'mondrian_red', 'mondrian_red', 'frame', 'cream', 'frame', 'success_green'],
  ['mondrian_blue', 'mondrian_blue', 'mondrian_blue', 'frame', 'mondrian_yellow', 'mondrian_yellow', 'frame', 'cream', 'frame', 'success_green'],
  ['mondrian_blue', 'mondrian_blue', 'mondrian_blue', 'frame', 'mondrian_yellow', 'mondrian_yellow', 'frame', 'cream', 'frame', 'frame'],
];
// 9 columns by 1 row: blue 2, frame 1, red 1, yellow 1, frame 1, cream 1, frame 1, green 1.
const LOGO_COMPACT = [['mondrian_blue', 'mondrian_blue', 'frame', 'mondrian_red', 'mondrian_yellow', 'frame', 'cream', 'frame', 'success_green']];

const XTERM_BASIC = [
  [0, 0, 0], [205, 0, 0], [0, 205, 0], [205, 205, 0], [0, 0, 238], [205, 0, 205], [0, 205, 205], [229, 229, 229],
  [127, 127, 127], [255, 0, 0], [0, 255, 0], [255, 255, 0], [92, 92, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
];
const CUBE = [0, 95, 135, 175, 215, 255];

function emptyCell() {
  return { ch: ' ', fg: null, bg: null, bold: false, dim: false, inverse: false };
}

function hex2(n) {
  return (n < 16 ? '0' : '') + n.toString(16);
}

function clamp255(n) {
  return Math.max(0, Math.min(255, n | 0));
}

// Terminal column width of a code point: 0 combining, 2 wide, else 1 (a small table, enough for
// what the band draws; the glyphs the spec cares about are all width 1).
function cellWidth(cp) {
  if ((cp >= 0x0300 && cp <= 0x036f) || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0xfe00 && cp <= 0xfe0f)) return 0;
  if (
    (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1f64f) || (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  ) return 2;
  return 1;
}

function colorToRgb(c) {
  if (c === null || c === undefined) return null;
  if (c[0] === '#') {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  if (c[0] === '$') return XTERM_BASIC[Number(c.slice(1))] || null;
  if (c[0] === '@') {
    const n = Number(c.slice(1));
    if (n < 16) return XTERM_BASIC[n];
    if (n < 232) {
      const i = n - 16;
      return [CUBE[Math.floor(i / 36)], CUBE[Math.floor(i / 6) % 6], CUBE[i % 6]];
    }
    const v = 8 + 10 * (n - 232);
    return [v, v, v];
  }
  return null;
}

function rgbToHex(rgb) {
  return '#' + hex2(rgb[0]) + hex2(rgb[1]) + hex2(rgb[2]);
}

// Apply one SGR parameter list to a pen. forms is a counter of the escape forms seen.
function applySgr(pen, rawParams, forms) {
  const bump = (k) => { forms[k] = (forms[k] || 0) + 1; };
  const toks = rawParams === '' ? ['0'] : rawParams.split(';');
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i];
    if (t.indexOf(':') !== -1) {
      // colon form: 38:2::r:g:b, 38:2:r:g:b, 38:5:n (underline styles such as 4:3 are ignored)
      const p = t.split(':');
      const which = p[0];
      if (which === '38' || which === '48') {
        let colour = null;
        if (p[1] === '2') {
          const nums = p.slice(2).filter((x) => x !== '').map(Number);
          const last3 = nums.slice(-3);
          if (last3.length === 3) colour = rgbToHex(last3.map(clamp255));
          bump(which + ';2');
        } else if (p[1] === '5') {
          colour = '@' + clamp255(Number(p[2]));
          bump(which + ';5');
        }
        if (colour !== null) pen[which === '38' ? 'fg' : 'bg'] = colour;
      }
      continue;
    }
    const n = t === '' ? 0 : Number(t);
    if (n === 0) { pen.fg = null; pen.bg = null; pen.bold = false; pen.dim = false; pen.inverse = false; }
    else if (n === 1) pen.bold = true;
    else if (n === 2) pen.dim = true;
    else if (n === 7) pen.inverse = true;
    else if (n === 22) { pen.bold = false; pen.dim = false; }
    else if (n === 27) pen.inverse = false;
    else if (n === 39) pen.fg = null;
    else if (n === 49) pen.bg = null;
    else if ((n >= 30 && n <= 37)) { pen.fg = '$' + (n - 30); bump('basic-fg'); }
    else if ((n >= 90 && n <= 97)) { pen.fg = '$' + (n - 90 + 8); bump('basic-fg'); }
    else if ((n >= 40 && n <= 47)) { pen.bg = '$' + (n - 40); bump('basic-bg'); }
    else if ((n >= 100 && n <= 107)) { pen.bg = '$' + (n - 100 + 8); bump('basic-bg'); }
    else if (n === 38 || n === 48) {
      const mode = toks[i + 1];
      if (mode === '5') {
        pen[n === 38 ? 'fg' : 'bg'] = '@' + clamp255(Number(toks[i + 2]));
        bump(n + ';5');
        i += 2;
      } else if (mode === '2') {
        pen[n === 38 ? 'fg' : 'bg'] = rgbToHex([Number(toks[i + 2]), Number(toks[i + 3]), Number(toks[i + 4])].map(clamp255));
        bump(n + ';2');
        i += 4;
      }
    }
    // every other parameter (italic, underline, strike, ...) changes nothing the checks read
  }
}

// parseAnsi(text, cols, rows): a `tmux capture-pane -p -e` string to a grid.
// Returns { cols, rows, cells, forms, overflow } where cells[r][c] = { ch, fg, bg, bold, dim, inverse }.
// A wide character takes two cells: the first holds it, the second holds ch ''.
function parseAnsi(text, cols, rows) {
  const cells = [];
  const forms = {};
  let overflow = 0;
  const pen = { fg: null, bg: null, bold: false, dim: false, inverse: false };
  const newRow = () => {
    const r = [];
    for (let c = 0; c < cols; c += 1) r.push(emptyCell());
    cells.push(r);
    return r;
  };
  newRow();
  let row = 0;
  let col = 0;
  const put = (ch, w) => {
    if (col + w > cols) { overflow += 1; col += w; return; }
    const cell = cells[row][col];
    cell.ch = ch; cell.fg = pen.fg; cell.bg = pen.bg; cell.bold = pen.bold; cell.dim = pen.dim; cell.inverse = pen.inverse;
    if (w === 2) {
      const next = cells[row][col + 1];
      next.ch = ''; next.fg = pen.fg; next.bg = pen.bg; next.bold = pen.bold; next.dim = pen.dim; next.inverse = pen.inverse;
    }
    col += w;
  };
  const lineBreak = () => {
    row += 1;
    col = 0;
    if (row >= cells.length) newRow();
  };
  let pendingBreak = false; // a trailing newline does not start a new, empty row
  const s = String(text);
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ESC) {
      const nx = s[i + 1];
      if (nx === '[') {
        let j = i + 2;
        while (j < s.length && !/[@-~]/.test(s[j])) j += 1;
        const final = s[j];
        if (final === 'm') applySgr(pen, s.slice(i + 2, j), forms);
        i = j + 1;
        continue;
      }
      if (nx === ']') {
        let j = i + 2;
        while (j < s.length && s[j] !== '\u0007' && !(s[j] === ESC && s[j + 1] === '\\')) j += 1;
        i = s[j] === ESC ? j + 2 : j + 1;
        continue;
      }
      i += 2;
      continue;
    }
    if (ch === '\r') {
      if (s[i + 1] === '\n') i += 1;
      pendingBreak = true;
      i += 1;
      if (i >= s.length) break;
      lineBreak();
      pendingBreak = false;
      continue;
    }
    if (ch === '\n') {
      pendingBreak = true;
      i += 1;
      if (i >= s.length) break;
      lineBreak();
      pendingBreak = false;
      continue;
    }
    if (ch === '\t') {
      const stop = Math.min(cols, (Math.floor(col / 8) + 1) * 8);
      while (col < stop) put(' ', 1);
      i += 1;
      continue;
    }
    if (ch < ' ' || ch === '\u007f') { i += 1; continue; }
    const cp = s.codePointAt(i);
    const chs = String.fromCodePoint(cp);
    const w = cellWidth(cp);
    if (w === 0) {
      // combining: attach to the cell before it
      const prev = col > 0 ? cells[row][col - 1] : null;
      if (prev) prev.ch += chs;
    } else {
      put(chs, w);
    }
    i += chs.length;
  }
  void pendingBreak;
  while (cells.length < rows) newRow();
  return { cols, rows: cells.length, cells, forms, overflow };
}

function rowText(grid, row) {
  const r = grid.cells[row];
  if (!r) return '';
  let s = '';
  for (const c of r) s += c.ch;
  return s.replace(/\s+$/, '');
}

function gridText(grid) {
  const out = [];
  for (let r = 0; r < grid.rows; r += 1) out.push(rowText(grid, r));
  return out.join('\n').replace(/\n+$/, '');
}

// findText(grid, needle, opts): { row, col, endCol } of the first match (endCol is exclusive), or
// null. Colour changes between cells do not matter. opts.fromRow starts the search lower down.
function findText(grid, needle, opts) {
  const from = (opts && opts.fromRow) || 0;
  for (let r = from; r < grid.rows; r += 1) {
    let s = '';
    const map = [];
    const row = grid.cells[r];
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c].ch;
      for (let k = 0; k < ch.length; k += 1) { s += ch[k]; map.push(c); }
    }
    const idx = s.indexOf(needle);
    if (idx !== -1) {
      const endIdx = idx + needle.length - 1;
      const lastCol = map[endIdx];
      let end = lastCol + 1;
      while (end < row.length && row[end].ch === '') end += 1;
      return { row: r, col: map[idx], endCol: end };
    }
  }
  return null;
}

// The colour a cell shows as its fill: the background, or the foreground when inverse is on.
function effectiveBg(cell) {
  return cell.inverse ? cell.fg : cell.bg;
}

// bgRuns(grid, row): [{ bg, from, to }] with to inclusive. A null bg is the terminal default.
function bgRuns(grid, row) {
  const cells = grid.cells[row] || [];
  const runs = [];
  for (let c = 0; c < cells.length; c += 1) {
    const bg = effectiveBg(cells[c]);
    const last = runs[runs.length - 1];
    if (last && last.bg === bg) last.to = c;
    else runs.push({ bg, from: c, to: c });
  }
  return runs;
}

// ---- palette comparison ----------------------------------------------------------------------

function paletteMap(palette, keys) {
  const base = (palette && palette.base) || palette || {};
  const want = keys || BAND_KEYS;
  const map = {};
  for (const k of want) if (typeof base[k] === 'string') map[k] = base[k].toLowerCase();
  return map;
}

// nearest(colour, palette): { key, keys, hex, distance } where keys lists every candidate tied for
// nearest. distance is Euclidean RGB distance (0 means an exact match). null for a default colour.
function nearest(colour, palette, keys) {
  const rgb = colorToRgb(colour);
  if (!rgb) return null;
  const map = paletteMap(palette, keys);
  let best = null;
  let tied = [];
  for (const k of Object.keys(map)) {
    const h = colorToRgb(map[k]);
    const d = Math.sqrt((h[0] - rgb[0]) ** 2 + (h[1] - rgb[1]) ** 2 + (h[2] - rgb[2]) ** 2);
    if (best === null || d < best.distance - 1e-9) { best = { key: k, hex: map[k], distance: d }; tied = [k]; }
    else if (Math.abs(d - best.distance) <= 1e-9) tied.push(k);
  }
  if (best === null) return null;
  best.keys = tied;
  best.distance = Math.round(best.distance * 100) / 100;
  return best;
}

// checkPaint(grid, palette, expectations): one result per expectation. An expectation is
// { name, key, text } (find the text, read the fill under its first cell) or { name, key, row, col }.
// Result: { name, found, row, col, bg, nearest, distance, quantized, bgMatches, contiguousCells }.
// A host that quantizes colours shows up as quantized true with its distance, not as a silent pass.
function checkPaint(grid, palette, expectations) {
  const out = [];
  for (const ex of expectations) {
    const res = { name: ex.name, key: ex.key, found: false, row: null, col: null, bg: null, nearest: null, distance: null, quantized: false, bgMatches: false, contiguousCells: 0 };
    let pos = null;
    if (ex.text !== undefined) {
      const f = findText(grid, ex.text);
      if (f) pos = { row: f.row, col: f.col };
    } else if (ex.row !== undefined && ex.col !== undefined) {
      pos = { row: ex.row, col: ex.col };
    }
    if (pos && grid.cells[pos.row] && grid.cells[pos.row][pos.col]) {
      res.found = true;
      res.row = pos.row;
      res.col = pos.col;
      const bg = effectiveBg(grid.cells[pos.row][pos.col]);
      res.bg = bg;
      const nr = nearest(bg, palette);
      if (nr) {
        res.nearest = nr.key;
        res.distance = nr.distance;
        res.quantized = nr.distance > 0;
        res.bgMatches = nr.keys.indexOf(ex.key) !== -1;
      }
      const run = bgRuns(grid, pos.row).find((r) => pos.col >= r.from && pos.col <= r.to);
      res.contiguousCells = run && run.bg !== null ? run.to - run.from + 1 : 0;
    }
    out.push(res);
  }
  return out;
}

// ---- the logo --------------------------------------------------------------------------------

function logoTable(variant) {
  return variant === 'compact' ? LOGO_COMPACT : LOGO_TALL;
}

// What a cell shows, as a palette key: 'default' for no fill, or the nearest candidate key.
function cellKey(cell, palette) {
  const bg = effectiveBg(cell);
  if (bg === null) return { key: 'default', distance: 0 };
  const nr = nearest(bg, palette);
  return nr ? { key: nr.key, keys: nr.keys, distance: nr.distance } : { key: 'unknown', distance: 0 };
}

function expectedMatches(expected, got, opts) {
  if (expected === 'frame') {
    if (got.key === 'mondrian_black') return true;
    return got.key === 'default' && !(opts && opts.defaultIsFrame === false);
  }
  return got.keys ? got.keys.indexOf(expected) !== -1 : got.key === expected;
}

// checkLogo(grid, origin, variant, palette, opts): compare the 10x3 (or 9x1) region to UI-SPEC 6.3.
// opts.defaultIsFrame (default true): an unfilled cell counts as the frame cell (black terminal).
// Returns { ok, variant, origin, checked, mismatch, maxDistance, unpaintedFrame }; mismatch is the
// FIRST cell that differs, { row, col, expected, got }, or null.
function checkLogo(grid, origin, variant, palette, opts) {
  const table = logoTable(variant);
  const res = { ok: true, variant: variant || 'tall', origin, checked: 0, mismatch: null, maxDistance: 0, unpaintedFrame: 0 };
  for (let r = 0; r < table.length; r += 1) {
    for (let c = 0; c < table[r].length; c += 1) {
      const gr = origin.row + r;
      const gc = origin.col + c;
      const cell = grid.cells[gr] && grid.cells[gr][gc];
      res.checked += 1;
      const got = cell ? cellKey(cell, palette) : { key: 'outside-grid', distance: 0 };
      const expected = table[r][c] === 'frame' ? 'mondrian_black' : table[r][c];
      if (!expectedMatches(table[r][c], got, opts)) {
        if (res.mismatch === null) res.mismatch = { row: r, col: c, expected, got: got.key };
        res.ok = false;
      } else {
        if (got.distance > res.maxDistance) res.maxDistance = got.distance;
        if (table[r][c] === 'frame' && got.key === 'default') res.unpaintedFrame += 1;
      }
    }
  }
  return res;
}

// findLogo(grid, palette, variant, opts): the best-matching origin anywhere on the grid (fewest
// mismatching cells; the first one on a tie), so the check does not depend on guessing where the
// band sits. Returns { origin, mismatches, ok, detail } where detail is checkLogo at that origin.
function findLogo(grid, palette, variant, opts) {
  const table = logoTable(variant);
  const h = table.length;
  const w = table[0].length;
  let best = null;
  for (let r = 0; r + h <= grid.rows; r += 1) {
    for (let c = 0; c + w <= grid.cols; c += 1) {
      let bad = 0;
      for (let y = 0; y < h && (best === null || bad < best.mismatches); y += 1) {
        for (let x = 0; x < w; x += 1) {
          const got = cellKey(grid.cells[r + y][c + x], palette);
          if (!expectedMatches(table[y][x], got, opts)) bad += 1;
        }
      }
      if (best === null || bad < best.mismatches) best = { origin: { row: r, col: c }, mismatches: bad };
      if (best.mismatches === 0) break;
    }
    if (best && best.mismatches === 0) break;
  }
  if (best === null) return { origin: null, mismatches: h * w, ok: false, detail: null };
  const detail = checkLogo(grid, best.origin, variant, palette, opts);
  return { origin: best.origin, mismatches: best.mismatches, ok: detail.ok, detail };
}

// ---- the context bar -------------------------------------------------------------------------

const DOT = '·';
// F4 (2026-10-06 real run): the bar is a black track with a paper fill and a black cap cell at each
// end: cap, ten cells (filled = a space on paper, empty = U+00B7), cap. The old bar (black fill on the
// paper block) read as a gap on the black band, so a bar whose filled cells share a color with the
// track behind it is a FAILURE here, never a pass (fillVisible).
const FILL_KEYS = ['cream'];
const TRACK_KEYS = ['mondrian_black'];

function isBlank(cell) { return cell.ch === ' ' || cell.ch === ''; }

function keyOfBg(cell, palette) {
  const bg = effectiveBg(cell);
  if (bg === null) return null;
  const nr = nearest(bg, palette);
  return nr ? nr.keys : null;
}

// 'cap' (a black space), 'filled' (a space on paper), 'empty' (U+00B7), or 'other'.
function barKind(cell, palette) {
  if (cell.ch === DOT) return 'empty';
  if (!isBlank(cell)) return 'other';
  const keys = keyOfBg(cell, palette);
  if (!keys) return 'other';
  if (keys.some((k) => TRACK_KEYS.indexOf(k) !== -1)) return 'cap';
  if (keys.some((k) => FILL_KEYS.indexOf(k) !== -1)) return 'filled';
  return 'other';
}

// locateBar(grid, row, fromCol, palette): the column of the FIRST of the ten bar cells, or null.
// The ten cells (each a filled cell or U+00B7) must sit between a black cap on the left and a black
// cap on the right, so a paper space of the block around the bar is never mistaken for a fill.
function locateBar(grid, row, fromCol, palette) {
  const cells = grid.cells[row];
  if (!cells) return null;
  for (let c = Math.max(fromCol, 1); c + 11 <= cells.length; c += 1) {
    if (barKind(cells[c - 1], palette) !== 'cap') continue;
    let ok = true;
    for (let k = 0; k < 10; k += 1) {
      const kind = barKind(cells[c + k], palette);
      if (kind !== 'filled' && kind !== 'empty') { ok = false; break; }
    }
    if (ok && barKind(cells[c + 10], palette) === 'cap') return c;
  }
  return null;
}

// checkBar(grid, row, startCol, palette, opts): count the ten-cell bar from startCol (the first cell
// after the left cap, as locateBar returns it).
// opts.percent: also check the rounding rule, filled = Math.round(percent / 10).
// Returns { total, filled, empty, filledFromLeft, emptyAreDots, capsOk, fillVisible, dotsVisible, fillBg, trackBg,
//           expectedFilled, roundingOk, ok }. fillVisible is false when any filled cell has the same
// color as a cap or as the background of an empty cell (the F4 failure).
function checkBar(grid, row, startCol, palette, opts) {
  const cells = grid.cells[row] || [];
  let total = 0;
  let filled = 0;
  let empty = 0;
  let sawEmpty = false;
  let filledFromLeft = true;
  const fillBgs = new Set();
  const trackBgs = new Set();
  let dotsVisible = true;
  const capL = startCol > 0 ? cells[startCol - 1] : null;
  const capR = cells[startCol + 10];
  const capsOk = !!capL && !!capR && barKind(capL, palette) === 'cap' && barKind(capR, palette) === 'cap';
  if (capL) trackBgs.add(effectiveBg(capL));
  if (capR) trackBgs.add(effectiveBg(capR));
  for (let k = 0; k < 10; k += 1) {
    const cell = cells[startCol + k];
    const kind = cell ? barKind(cell, palette) : 'other';
    if (kind !== 'filled' && kind !== 'empty') break;
    total += 1;
    if (kind === 'filled') { filled += 1; fillBgs.add(effectiveBg(cell)); if (sawEmpty) filledFromLeft = false; }
    else {
      empty += 1; sawEmpty = true; trackBgs.add(effectiveBg(cell));
      if (cell.fg === null || cell.fg === effectiveBg(cell)) dotsVisible = false;
    }
  }
  // An empty cell that was drawn as a space or a block is not a dot.
  let emptyAreDots = true;
  for (let k = 0; k < 10; k += 1) {
    const cell = cells[startCol + k];
    if (!cell) { emptyAreDots = false; break; }
    if (barKind(cell, palette) === 'filled') continue;
    if (cell.ch !== DOT) { emptyAreDots = false; break; }
  }
  let fillVisible = true;
  for (const f of fillBgs) {
    if (f === null || trackBgs.has(f)) fillVisible = false;
  }
  const res = { total, filled, empty, filledFromLeft, emptyAreDots, capsOk, fillVisible, dotsVisible, fillBg: Array.from(fillBgs), trackBg: Array.from(trackBgs), expectedFilled: null, roundingOk: null, ok: false };
  if (opts && typeof opts.percent === 'number') {
    res.expectedFilled = Math.round(opts.percent / 10);
    res.roundingOk = filled === res.expectedFilled;
  }
  res.ok = total === 10 && emptyAreDots && filledFromLeft && capsOk && fillVisible && dotsVisible && (res.roundingOk === null || res.roundingOk === true);
  return res;
}

// ---- a one-look summary ------------------------------------------------------------------------

function summarize(grid) {
  let bgCells = 0;
  let dimCells = 0;
  let boldCells = 0;
  let inverseCells = 0;
  const bgs = {};
  for (const row of grid.cells) {
    for (const c of row) {
      const bg = effectiveBg(c);
      if (bg !== null) { bgCells += 1; bgs[bg] = (bgs[bg] || 0) + 1; }
      if (c.dim) dimCells += 1;
      if (c.bold) boldCells += 1;
      if (c.inverse) inverseCells += 1;
    }
  }
  return { forms: Object.assign({}, grid.forms), hasBackground: bgCells > 0, bgCells, dimCells, boldCells, inverseCells, backgrounds: bgs };
}

// ---- html ------------------------------------------------------------------------------------

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function styleOf(cell) {
  const fg = cell.inverse ? cell.bg : cell.fg;
  const bg = cell.inverse ? cell.fg : cell.bg;
  const parts = [];
  const fgRgb = colorToRgb(fg);
  const bgRgb = colorToRgb(bg);
  if (fgRgb) parts.push('color:' + rgbToHex(fgRgb));
  if (bgRgb) parts.push('background:' + rgbToHex(bgRgb));
  if (cell.bold) parts.push('font-weight:bold');
  if (cell.dim) parts.push('opacity:.6');
  return parts.join(';');
}

// toHtml(grid, opts): a self-contained, deterministic HTML document, one span per run of cells
// that share a style, inside a monospace pre. The page background is black and the default text
// is light grey; the terminal's own default colours are unknown, so this is a stand-in.
function toHtml(grid, opts) {
  const title = esc((opts && opts.title) || 'render check capture');
  const lines = [];
  for (let r = 0; r < grid.rows; r += 1) {
    const cells = grid.cells[r];
    let last = cells.length - 1;
    while (last >= 0 && cells[last].ch === ' ' && styleOf(cells[last]) === '') last -= 1;
    let html = '';
    let runStyle = null;
    let runText = '';
    const flush = () => {
      if (runStyle === null) return;
      html += '<span' + (runStyle === '' ? ' class="d"' : ' style="' + runStyle + '"') + '>' + esc(runText) + '</span>';
      runText = '';
    };
    for (let c = 0; c <= last; c += 1) {
      const st = styleOf(cells[c]);
      if (st !== runStyle) { flush(); runStyle = st; }
      runText += cells[c].ch;
    }
    flush();
    lines.push(html);
  }
  return (
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>' + title + '</title>\n' +
    '<style>body{margin:0;background:#000;} pre{margin:0;padding:12px;background:#000;color:#e5e5e5;' +
    'font:14px/1.15 "DejaVu Sans Mono",Menlo,Consolas,monospace;} .d{color:#e5e5e5}</style></head>\n' +
    '<body><pre>' + lines.join('\n') + '</pre></body></html>\n'
  );
}

module.exports = {
  parseAnsi,
  rowText,
  gridText,
  findText,
  bgRuns,
  effectiveBg,
  colorToRgb,
  nearest,
  checkPaint,
  checkLogo,
  findLogo,
  locateBar,
  checkBar,
  summarize,
  toHtml,
  BAND_KEYS,
  LOGO_TALL,
  LOGO_COMPACT,
};
