// 369.26-09: a fake terminal program for proving the render-check harness without Claude Code.
//
// It prints a band like the WIDE concept using KNOWN ANSI, at fixed positions, then sits still so
// tmux can capture it. FAKE_MODE picks what it draws:
//   good     truecolor band: logo, blue place, yellow waiting, black context with a 6-of-10 bar,
//            cream purpose and next rows, a dim hint; a prompt box under it
//   mutated  the same, but one logo cell (row 1, col 4: yellow) is painted red
//   flat     the same words with no color escapes at all and no logo
//   trust-no   the workspace trust dialog first, laid out like claude 2.1.290: "No, exit" is the FIRST row
//              and selected by default. Down/Up move the pointer; Enter on "No, exit" ends the program
//              with exit code 1 (what the real claude does); Enter on "Yes, I trust this folder" clears
//              the screen and draws the good band.
//   trust-yes  the same dialog with "Yes, I trust this folder" selected by default (Enter there draws the band)
//   trust-yes-first  the dialog with the Yes row FIRST and selected (the other row order)
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
const dim = mode === 'flat' ? '' : CSI + '2m';
const at = (row, col) => CSI + (row + 1) + ';' + (col + 1) + 'H';

function drawBand() {
let out = CSI + '2J' + CSI + 'H';

const LOGO = ['BBBKRRKCKG', 'BBBKYYKCKG', 'BBBKYYKCKK'];
if (mode === 'mutated') LOGO[1] = LOGO[1].slice(0, 4) + 'R' + LOGO[1].slice(5);
for (let r = 0; r < 3; r += 1) {
  out += at(r, 0);
  if (mode === 'flat') out += r === 0 ? 'M:OS' : '';
  else for (const k of LOGO[r]) out += bg(k) + ' ';
  out += reset;
}

const WIDTH = 91;
// row 0: place (blue), frame, waiting (yellow), frame, context (black block with the bar)
out += at(0, 10) + bg('B') + fg('C') + " You're in: Funding (sample) " + reset;
out += at(0, 38) + bg('K') + ' ' + reset;
out += at(0, 39) + bg('Y') + fg('K') + ' A decision is waiting ' + reset;
out += at(0, 62) + bg('K') + ' ' + reset;
out += at(0, 63) + bg('K') + fg('C') + 'Context used: 62% ' + reset;
let bar = '';
for (let i = 0; i < 10; i += 1) bar += i < 6 ? (mode === 'flat' ? '#' : bg('Y') + ' ' + reset) : DOT;
out += at(0, 81) + bar;
// rows 1 and 2: cream, black text, grown to the full width
const purpose = ' This folder is for: building the funding case (sample)';
const next = ' Next: look at the evidence (sample)';
out += at(1, 10) + bg('C') + fg('K') + purpose.padEnd(WIDTH - 10) + reset;
out += at(2, 10) + bg('C') + fg('K') + next.padEnd(WIDTH - 10) + reset;
out += at(2, 62) + bg('C') + dim + fg('K') + '/workspace: Open workspace' + reset;
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

if (trustMode) trustDialog(); else drawBand();
setInterval(() => {}, 60000);
