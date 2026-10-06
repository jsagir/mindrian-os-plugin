// 369.26-09: a fake terminal program for proving the render-check harness without Claude Code.
//
// It prints a band like the WIDE concept using KNOWN ANSI, at fixed positions, then sits still so
// tmux can capture it. FAKE_MODE picks what it draws:
//   good     truecolor band in the C-30 and C-32 design: the M:OS text mark (bold, cream on black),
//            a paper place block, a black waiting block, a paper context block with a 6-of-10
//            bar (F4: a black track, a black cap at each end, a paper fill, paper dots), paper
//            purpose and next rows, a normal-weight black hint (C-28, C-29); a prompt box under it
//   mutated  the same, but the M:OS mark is drawn without bold
//   flat     the same words with no color escapes at all and no logo
//   trust-no   the workspace trust dialog first, laid out like claude 2.1.290: "No, exit" is the FIRST row
//              and selected by default. Down/Up move the pointer; Enter on "No, exit" ends the program
//              with exit code 1 (what the real claude does); Enter on "Yes, I trust this folder" clears
//              the screen and draws the good band.
//   trust-yes  the same dialog with "Yes, I trust this folder" selected by default (Enter there draws the band)
//   trust-yes-first  the dialog with the Yes row FIRST and selected (the other row order)
// FAKE_AC=<mode> adds a live prompt line and a slash autocomplete (F1), so the harness open step is proven
// against the failure of the real run: the list highlights a DIFFERENT command first. The fake logs what
// ran to the file in FAKE_AC_LOG: "RAN mod <token>" for the mod command, "MODEL_TURN <token>" for any other
// command (a real session would start a model turn). Modes:
//   right         list [/workspace, /icm-workspace-architect], the mod command highlighted first
//   wrong-first   list [/icm-workspace-architect, /workspace], the WRONG one highlighted; Down moves it
//   down-ignored  like wrong-first, but Down does nothing (the mod command can never be reached)
//   not-in-list   list [/icm-workspace-architect, /workspace-notes]; no mod command at all
//   no-list       no list is drawn; Enter runs the typed text as it is
//   unreadable    like wrong-first, but every row has the same style (the highlight cannot be read)
//   qualified     "/workspace" lists only the wrong command; "/mindrian-workspace:workspace" lists the mod command
//   pointer       like wrong-first, but the highlighted row carries a pointer glyph instead of a color
// FAKE_PANE=1 also draws a pane title row and a tab strip starting at column 95.
// Not a mod, not shipped: test tooling only.
'use strict';

const E = String.fromCharCode(27);
const CSI = E + '[';
const DOT = String.fromCharCode(0x00b7);
const rawMode = process.env.FAKE_MODE || 'good';
const trustMode = /^trust-/.test(rawMode);
const mode = trustMode ? 'good' : rawMode;
const pane = process.env.FAKE_PANE === '1';

const HEX = {
  B: [30, 58, 110], R: [166, 61, 47], Y: [200, 164, 60], K: [13, 13, 13], C: [245, 240, 232], G: [45, 107, 74],
};
const bg = (k) => (mode === 'flat' ? '' : CSI + '48;2;' + HEX[k].join(';') + 'm');
const fg = (k) => (mode === 'flat' ? '' : CSI + '38;2;' + HEX[k].join(';') + 'm');
const reset = mode === 'flat' ? '' : CSI + '0m';
const at = (row, col) => CSI + (row + 1) + ';' + (col + 1) + 'H';

function drawBand() {
let out = CSI + '2J' + CSI + 'H';

const bold = mode === 'flat' || mode === 'mutated' ? '' : CSI + '1m';
for (let r = 0; r < 3; r += 1) {
  out += at(r, 0);
  if (mode === 'flat') out += r === 0 ? 'M:OS' : '';
  else out += bg('K') + fg('C') + bold + (r === 0 ? ' M:OS ' : '      ');
  out += reset;
}

const WIDTH = 91;
// row 0: place (paper), frame, waiting (black, bold cream), frame, context (paper block with the bar)
out += at(0, 10) + bg('C') + fg('K') + " You're in: Funding (sample) " + reset;
out += at(0, 38) + bg('K') + ' ' + reset;
out += at(0, 39) + bg('K') + fg('C') + CSI + '1m' + ' A decision is waiting ' + reset;
out += at(0, 62) + bg('K') + ' ' + reset;
out += at(0, 63) + bg('C') + fg('K') + ' Context used: 62% ' + reset;
let bar = '';
// F4: a black cap, ten cells (filled = paper, empty = a paper dot on black), a black cap.
bar += mode === 'flat' ? '[' : bg('K') + ' ' + reset;
for (let i = 0; i < 10; i += 1) bar += i < 6 ? (mode === 'flat' ? '#' : bg('C') + ' ' + reset) : bg('K') + fg('C') + DOT + reset;
bar += mode === 'flat' ? ']' : bg('K') + ' ' + reset;
out += at(0, 82) + bar;
// rows 1 and 2: cream, black text, grown to the full width
const purpose = ' This folder is for: building the funding case (sample)';
const next = ' Next: look at the evidence (sample)';
out += at(1, 10) + bg('C') + fg('K') + purpose.padEnd(WIDTH - 10) + reset;
out += at(2, 10) + bg('C') + fg('K') + next.padEnd(WIDTH - 10) + reset;
out += at(2, 62) + bg('C') + fg('K') + '/workspace: Open workspace' + reset;
// the prompt box under the band
out += at(3, 0) + String.fromCharCode(0x256d) + String.fromCharCode(0x2500).repeat(WIDTH - 2) + String.fromCharCode(0x256e);
out += at(4, 0) + String.fromCharCode(0x2502) + ' >' + ' '.repeat(WIDTH - 4) + String.fromCharCode(0x2502);
out += at(5, 0) + String.fromCharCode(0x2570) + String.fromCharCode(0x2500).repeat(WIDTH - 2) + String.fromCharCode(0x256f);

if (pane) {
  out += at(8, 95) + 'Mindrian workspace';
  out += at(9, 95) + 'Room Think Sources Review';
  out += at(10, 95) + 'Esc: Close';
}
out += at(12, 0);

process.stdout.write(out);
}

function trustDialog() {
  const rows = rawMode === 'trust-yes-first' ? ['Yes, I trust this folder', 'No, exit'] : ['No, exit', 'Yes, I trust this folder'];
  let sel = rawMode === 'trust-no' ? rows.indexOf('No, exit') : rows.indexOf('Yes, I trust this folder');
  const paint = () => {
    let o = CSI + '2J' + CSI + 'H';
    o += ' Accessing workspace:\n\n /tmp/fake-scratch/cwd\n\n Quick safety check: Is this a project you created or one you trust?\n\n Security guide\n\n';
    rows.forEach((r, i) => { o += (i === sel ? ' ' + String.fromCharCode(0x276f) + ' ' : '   ') + r + '\n'; });
    o += '\n Enter to confirm \u00b7 Esc to cancel\n';
    process.stdout.write(o);
  };
  paint();
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => {
    if (/\u001b(\[|O)B/.test(d)) { sel = (sel + 1) % rows.length; paint(); }
    else if (/\u001b(\[|O)A/.test(d)) { sel = (sel + rows.length - 1) % rows.length; paint(); }
    else if (/[\r\n]/.test(d)) {
      if (/^No/.test(rows[sel])) process.exit(1);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      drawBand();
    }
  });
}

// ---- FAKE_AC: a live prompt line and a slash autocomplete -------------------------------------------
function autocomplete() {
  const fs = require('node:fs');
  const acMode = process.env.FAKE_AC;
  const log = (line) => { if (process.env.FAKE_AC_LOG) fs.appendFileSync(process.env.FAKE_AC_LOG, line + '\n'); };
  const MOD = { token: '/workspace', desc: 'Mindrian workspace (mindrian-workspace)', mod: true };
  const MODQ = { token: '/mindrian-workspace:workspace', desc: 'Mindrian workspace', mod: true };
  const WRONG = { token: '/icm-workspace-architect', desc: 'Design a workspace (mos)', mod: false };
  const WRONG2 = { token: '/workspace-notes', desc: 'Notes (another plugin)', mod: false };
  const WIDTH = 91;
  let buf = '';
  let hi = 0;
  let ran = '';
  const listFor = (text) => {
    if (!/^\/./.test(text) || acMode === 'no-list') return [];
    if (acMode === 'qualified') return text === '/mindrian-workspace:workspace' ? [MODQ] : (text.startsWith('/workspace') ? [WRONG] : []);
    if (!text.startsWith('/workspace')) return [];
    if (acMode === 'right') return [MOD, WRONG];
    if (acMode === 'not-in-list') return [WRONG, WRONG2];
    return [WRONG, MOD];
  };
  const paint = () => {
    const list = listFor(buf);
    if (hi >= list.length) hi = 0;
    let o = at(4, 0) + String.fromCharCode(0x2502) + ' > ' + (buf + ' '.repeat(Math.max(0, WIDTH - 5))).slice(0, WIDTH - 5) + String.fromCharCode(0x2502);
    for (let r = 6; r < 12; r += 1) o += at(r, 0) + ' '.repeat(90);
    list.forEach((it, i) => {
      const on = i === hi;
      const pointer = acMode === 'pointer' ? (on ? String.fromCharCode(0x276f) + ' ' : '  ') : '  ';
      const style = acMode === 'pointer' || acMode === 'unreadable' ? '' : (on ? CSI + '1m' + CSI + '38;5;105m' : '');
      o += at(6 + i, 0) + pointer + style + it.token + reset + '   ' + it.desc;
    });
    o += ran ? at(13, 0) + ran : '';
    o += at(4, 4 + buf.length);
    process.stdout.write(o);
  };
  const run = () => {
    const list = listFor(buf);
    const target = list.length ? list[hi] : { token: buf.trim().split(/\s+/)[0], mod: /^\/(?:[\w.-]+:)?workspace$/.test(buf.trim().split(/\s+/)[0]) };
    if (target.mod) {
      log('RAN mod ' + target.token);
      ran = '/workspace ran';
      process.stdout.write(at(8, 95) + 'Mindrian workspace' + at(9, 95) + 'Room Think Sources Review' + at(10, 95) + 'Esc: Close');
    } else {
      log('MODEL_TURN ' + target.token);
      ran = 'Larry is working (a model turn started by ' + target.token + ')';
    }
    buf = '';
    hi = 0;
  };
  process.stdin.setRawMode(true);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => {
    if (/\u001b(\[|O)B/.test(d)) { if (acMode !== 'down-ignored') { const n = listFor(buf).length; if (n) hi = (hi + 1) % n; } }
    else if (/\u001b(\[|O)A/.test(d)) { const n = listFor(buf).length; if (n) hi = (hi + n - 1) % n; }
    else if (d === '\u0015') { buf = ''; hi = 0; }
    else if (/^[\r\n]$/.test(d)) { if (buf !== '') run(); }
    else if (/^[ -~]+$/.test(d)) { buf += d; hi = 0; }
    paint();
  });
  paint();
}

if (trustMode) trustDialog(); else drawBand();
if (process.env.FAKE_AC && !trustMode) autocomplete();
setInterval(() => {}, 60000);
