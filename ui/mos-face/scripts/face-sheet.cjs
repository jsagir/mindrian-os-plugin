// Contact sheet of the canon Theo faces (Phase 380 plan 13, D-10, MOD380-09, test W11).
//
// What it makes: one PNG with two rows of 11 cells. The top row is the canon renderer's own SVG face
// for each state (assets/asset-d96217b320.js, mounted in the page with the state as its initial state
// and reduced motion on, so it draws at once). The bottom row is the panel's block face for the same
// state: the half-block text that tests/face-sheet.test.ts prints, read back with the ANSI parser of
// the capture pipeline of plan 380-03 (scripts/lib/ansi-page.cjs, parseAnsi and colorToRgb) and drawn
// as square pixels, two for each terminal cell (the top half takes the foreground color, the bottom
// half the background color, as the half block glyph does). The pipeline's own page writer, toHtml,
// draws the half block with a font glyph, and at this font that glyph leaves a dark seam between rows
// (seen in the first sheet of plan 380-13); the square pixels show the same colors without the seam.
// The label of the asset sits under each cell. Put side by side, a difference of plane color, bar tilt or eye size
// between the canon and the panel can be seen at a glance.
//
// How:
//   1. run `claude plugin test .` in ui/mos-face and read the block between the lines
//      FACESHEET_BEGIN and FACESHEET_END (one block per state: a line "FACE <id> <label>" and
//      the rows of the face);
//   2. build one self-contained HTML page (the canon renderer is inlined as a script, so the page
//      needs no network);
//   3. photograph it with the global Playwright CLI (playwright screenshot --viewport-size
//      --wait-for-timeout).
//
// Usage:  node ui/mos-face/scripts/face-sheet.cjs --out <file.png> [--html <file.html>]
// Exit:   0 made, 1 failed, 77 the claude CLI or the Playwright CLI is missing (ENV GAP).
// CJS, Node built-ins and the Playwright CLI only. No network. Hyphens only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const P = require('./lib/ansi-page.cjs');

const MOD = path.resolve(__dirname, '..');
const RENDERER = path.join(MOD, 'assets', 'asset-d96217b320.js');
const SIZE = 12; // cells across; the test prints this size
const PIX = 10; // px of one square pixel of the panel face (a terminal cell is 1 pixel wide and 2 high)
const FACE_PX = SIZE * PIX; // the canon SVG is drawn at the size of the block face

function args() {
  const out = { out: '', html: '' };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === '--out') out.out = a[++i] || '';
    else if (a[i] === '--html') out.html = a[++i] || '';
    else {
      process.stderr.write('usage: node ui/mos-face/scripts/face-sheet.cjs --out <file.png> [--html <file.html>]\n');
      process.exit(2);
    }
  }
  if (out.out === '') {
    process.stderr.write('face-sheet: --out <file.png> is required\n');
    process.exit(2);
  }
  return out;
}

// The text that the harness prints for an escape: the test prints the characters backslash, u, 0, 0,
// 1, b, so both that and a real escape are read.
function unescapeAnsi(text) {
  return text.replace(/\\u001b/gi, '\u001b');
}

function readBlocks() {
  const r = spawnSync('claude', ['plugin', 'test', '.'], { cwd: MOD, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024 });
  if (r.error && r.error.code === 'ENOENT') {
    process.stderr.write('face-sheet: the claude CLI is missing (ENV GAP)\n');
    process.exit(77);
  }
  // The harness prints console.log lines on stderr and the test report on stdout: read both.
  const lines = (String(r.stderr || '') + '\n' + String(r.stdout || '')).split('\n');
  const begin = lines.findIndex((l) => l.trim() === 'FACESHEET_BEGIN');
  const end = lines.findIndex((l) => l.trim() === 'FACESHEET_END');
  if (begin < 0 || end < begin) {
    process.stderr.write('face-sheet: the test output has no FACESHEET block (exit ' + r.status + ')\n' + String(r.stdout || '').split('\n').slice(-12).join('\n') + '\n');
    process.exit(1);
  }
  const blocks = [];
  for (const raw of lines.slice(begin + 1, end)) {
    const line = raw.replace(/\r$/, '');
    const head = /^FACE (\w+) (.+)$/.exec(line);
    if (head) blocks.push({ id: head[1], label: head[2], rows: [] });
    else if (blocks.length > 0 && line !== '') blocks[blocks.length - 1].rows.push(unescapeAnsi(line));
  }
  return blocks;
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// One block face as square pixels: the cells of the parsed ANSI text, two pixels high each.
function blockHtml(block) {
  const grid = P.parseAnsi(block.rows.join('\n'), SIZE, block.rows.length);
  const hex = (color) => {
    const rgb = P.colorToRgb(color);
    return rgb ? P.rgbToHex(rgb) : '#ff00ff';
  };
  let out = '';
  for (let r = 0; r < block.rows.length; r += 1) {
    for (const half of ['fg', 'bg']) {
      for (let c = 0; c < SIZE; c += 1) {
        const cell = grid.cells[r][c];
        out += '<i style="background:' + hex(half === 'fg' ? cell.fg : cell.bg) + '"></i>';
      }
    }
  }
  return out;
}

function pageOf(blocks) {
  const renderer = fs.readFileSync(RENDERER, 'utf8');
  const cellW = FACE_PX + 22;
  const top = blocks.map((b) => '<div class="cell"><div class="svg" data-state="' + esc(b.id) + '"></div><div class="lab">' + esc(b.label) + '</div></div>').join('');
  const bottom = blocks.map((b) => '<div class="cell"><div class="blk">' + blockHtml(b) + '</div><div class="lab">' + esc(b.label) + '</div></div>').join('');
  const css =
    'html,body{margin:0;background:' + P.SCREEN_BG + ';color:#e5e5e5;font-family:"DejaVu Sans Mono","Liberation Mono",monospace;font-size:12px}' +
    '#sheet{padding:12px}.row{display:flex;gap:0}.cap{margin:10px 0 6px 0;font-size:12px;color:#e5e5e5}' +
    '.cell{width:' + cellW + 'px;box-sizing:border-box;padding:0 6px}.lab{text-align:center;margin-top:5px;font-size:11px;color:#e5e5e5}' +
    '.svg{width:' + FACE_PX + 'px;height:' + FACE_PX + 'px}.svg svg{width:100%;height:100%;display:block}' +
    '.blk{display:grid;grid-template-columns:repeat(' + SIZE + ',' + PIX + 'px);grid-auto-rows:' + PIX + 'px;width:' + FACE_PX + 'px;height:' + FACE_PX + 'px}' +
    '.blk i{display:block}';
  return (
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Theo faces: canon and panel</title>\n<style>' + css + '</style></head>\n' +
    '<body><div id="sheet">' +
    '<div class="cap">Top row: the canon renderer (asset-d96217b320.js), SVG. Bottom row: the panel, ' + SIZE + ' by ' + SIZE + ' block cells from the same asset (hooks/theo-face.ts).</div>' +
    '<div class="row" id="top">' + top + '</div>' +
    '<div class="cap">Panel block faces, rasterized at ' + SIZE + ' cells:</div>' +
    '<div class="row" id="bottom">' + bottom + '</div>' +
    '</div>\n' +
    '<script>' + renderer + '</script>\n' +
    '<script>for (const el of document.querySelectorAll(".svg")) { window.MosTheo.mount(el, { initial: el.dataset.state, reducedMotion: true }); } document.body.dataset.ready = "1";</script>\n' +
    '</body></html>\n'
  );
}

function main() {
  const a = args();
  const blocks = readBlocks();
  if (blocks.length !== 11) {
    process.stderr.write('face-sheet: expected 11 blocks, got ' + blocks.length + '\n');
    return 1;
  }
  const html = pageOf(blocks);
  const htmlPath = a.html !== '' ? path.resolve(a.html) : path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-face-sheet-')), 'sheet.html');
  fs.writeFileSync(htmlPath, html);
  const cellW = FACE_PX + 22;
  const width = Math.ceil(11 * cellW + 24);
  const height = Math.ceil(2 * (FACE_PX + 36) + 80);
  const out = path.resolve(a.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const shot = ['screenshot', '--viewport-size', width + ',' + height, '--wait-for-selector', 'body[data-ready="1"]', '--wait-for-timeout', '600'];
  shot.push(pathToFileURL(htmlPath).href, out);
  const r = spawnSync('playwright', shot, { encoding: 'utf8', timeout: 90000 });
  if (r.error && r.error.code === 'ENOENT') {
    process.stderr.write('face-sheet: the Playwright CLI is missing (ENV GAP)\n');
    return 77;
  }
  if (r.status !== 0) {
    process.stderr.write('face-sheet: playwright screenshot failed: ' + String(r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' | ') + '\n');
    return 1;
  }
  process.stdout.write('face-sheet: ' + blocks.length + ' states, ' + width + 'x' + height + ' px, wrote ' + out + '\n');
  return 0;
}

process.exit(main());
