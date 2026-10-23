// 380-07 decisions gate (D-01, D-02, N2, N4, N5, N6, N7, N9, T-380-26, T-380-27).
//
// The claim: the colors and state names of the face panel follow the canon (mos-brand book
// e947a5d, read only, /home/jsagi/mos-brand), and every decision the book does not rule is
// written down in ui/mos-face/README.md with its default and its book segment.
// The behavior proofs (contrast numbers, exact names, poses, raster points) are the tests in
// ui/mos-face/tests/colors.test.tsx, run by tests/test-380-engine-tests.cjs. The engine tests read
// no file, so the static scans live here.
//
// Legs:
//   K1s  the hex literals of face.ts are the seven canon tokens, nothing else (plan 380-13: HOLLOW is gone).
//   K3s  no JSX or style in the hook sources draws YELLOW as a text color.
//   K6s  no hex literal in the hook sources is green (green channel over red and blue by 40).
//   T1   tests/canon.ts equals the canon asset at e947a5d (when the book checkout is present).
//   D1   the README section Decisions has an entry for N2, N4, N5, N6, N7 and N9; each cites
//        "mos-brand book e947a5d" and at least one segment path; every cited path exists in the
//        book at e947a5d (when the checkout is present).
//   D2   the README state table equals the LABEL map of face.ts (11 states, the asset labels) and
//        lists each state as mapped to an event or unmapped with a reason (plan 380-13: only Reframe).
//   D3   the README says Desktop and Cowork get no panel and calls it a deliberate skip.
//   D4   ui/mindrian-workspace-mod stays dev-only (its README says so and the root package does
//        not ship it); if it ever ships, two panes can draw and a person must decide.
//   D5   the README states that the terminal segment is proposed.
//   D6   the README records that HOLLOW was removed by D-10 (plan 380-13).
//   D7   the README records the geometry rule (canon asset, number for number) and the asset hash.
//   D8   (plan 380-13) the README section Visual change records the deliberate visual change: the
//        retired and the added pins, the old and new models, the book spelling conflict and the
//        deferred crew style; and D-11, secondary text stays dimmed paper.
// CJS, Node built-ins only. Hermetic: no network, no write. Read-only use of git on the book.
// Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mos-face');
const HOOKS = path.join(MOD, 'hooks');
const BOOK = '/home/jsagi/mos-brand';
const REF = 'e947a5d';
const ASSET = 'segments/identity/theo/entries/2026-10-19/asset-fa8504998f.json';

let passed = 0;
let failed = 0;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) { passed += 1; say('  ok ' + msg); } else { failed += 1; say('  FAIL ' + msg); }
}
const read = (p) => fs.readFileSync(p, 'utf8');
function git(args) {
  return spawnSync('git', ['-C', BOOK, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
const bookHere = fs.existsSync(path.join(BOOK, '.git')) && git(['cat-file', '-e', REF + ':' + ASSET]).status === 0;

const face = read(path.join(HOOKS, 'face.ts'));
const hookFiles = fs.readdirSync(HOOKS).filter((f) => /\.(ts|tsx)$/.test(f));

// ---- K1s -------------------------------------------------------------------------------------
say('K1s color literals of face.ts');
{
  const found = new Set((face.match(/#[0-9A-Fa-f]{6}\b/g) || []).map((s) => s.toUpperCase()));
  const expected = new Set(['#F7F5EE', '#111111', '#FFFFFF', '#1F3FBF', '#D6281F', '#F2C200', '#4B4943']);
  check([...found].sort().join(',') === [...expected].sort().join(','), 'face.ts holds exactly the seven canon tokens (no HOLLOW): ' + [...found].sort().join(' '));
}

// ---- K3s -------------------------------------------------------------------------------------
say('K3s no yellow text');
{
  const hits = [];
  for (const f of hookFiles) {
    const src = read(path.join(HOOKS, f));
    src.split('\n').forEach((line, i) => {
      if (/\bcolor=\{\s*YELLOW\s*\}/.test(line) || /=\s*\{\s*color:\s*YELLOW\b/.test(line) || /\bcolor=["']#F2C200["']/i.test(line)) hits.push(f + ':' + (i + 1));
    });
  }
  check(hits.length === 0, 'no color={YELLOW} in the JSX or the style objects' + (hits.length ? ' (' + hits.join(', ') + ')' : ''));
  // The chip ground may be yellow (MOVE_BG) with ink text (MOVE_FG).
  check(/yellow:\s*INK/.test(face) && /yellow:\s*YELLOW/.test(face), 'the yellow chip is yellow ground with ink text');
  // The static scan must be able to fail: a self-test of the patterns. A pixel fill such as a
  // canvas cell (meter.ts, with the percent printed beside it) is not text and is not scanned.
  check(/\bcolor=\{\s*YELLOW\s*\}/.test('<Text color={YELLOW}>x</Text>'), 'self-test: the yellow pattern catches color={YELLOW}');
  check(/=\s*\{\s*color:\s*YELLOW\b/.test('const warn = { color: YELLOW } as const'), 'self-test: the yellow pattern catches a text style object');
}

// ---- K6s -------------------------------------------------------------------------------------
say('K6s no green');
{
  const bad = [];
  for (const f of hookFiles) {
    const src = read(path.join(HOOKS, f));
    for (const m of src.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(m.slice(i, i + 2), 16));
      if (g > r + 40 && g > b + 40) bad.push(f + ' ' + m);
    }
  }
  check(bad.length === 0, 'no hex literal in the hook sources is green' + (bad.length ? ' (' + bad.join(', ') + ')' : ''));
  const rgbBad = [];
  for (const f of hookFiles) {
    if (/\bcolor=["'](green|lime)|backgroundColor=["'](green|lime)|color:\s*["'](green|lime)/i.test(read(path.join(HOOKS, f)))) rgbBad.push(f);
  }
  check(rgbBad.length === 0, 'no named green color in the hook sources');
}

// ---- T1 --------------------------------------------------------------------------------------
say('T1 the tests/canon.ts table equals the canon asset');
if (!bookHere) {
  say('  skip the book checkout or ' + REF + ' is not here (the table is not compared)');
} else {
  const canonTs = read(path.join(MOD, 'tests', 'canon.ts'));
  const raw = git(['show', REF + ':' + ASSET]).stdout;
  const sha = require('node:crypto').createHash('sha256').update(raw).digest('hex');
  check(canonTs.includes(sha), 'canon.ts records the sha256 of the asset at ' + REF + ' (' + sha.slice(0, 12) + ')');
  const m = canonTs.match(/const CANON_STATES_JSON = '([^']*)'/);
  check(!!m, 'canon.ts holds the table as one JSON text');
  if (m) {
    const mine = JSON.parse(m[1]);
    const book = JSON.parse(raw).states;
    check(mine.length === 11 && book.length === 11, 'eleven states in the table and in the asset');
    let same = true;
    for (const s of book) {
      const t = mine.find((x) => x.id === s.id);
      const want = { e1: s.pose.e1, e2: s.pose.e2, s: s.pose.s, r: s.pose.r, plane: s.pose.plane, c1: s.pose.c1, c2: s.pose.c2, hollow: s.pose.hollow };
      if (!t || JSON.stringify(t.pose) !== JSON.stringify(want) || t.assetLabel !== s.label) same = false;
    }
    check(same, 'every pose and label of the table equals the asset, value for value');
  }
}

// ---- D1 to D7 --------------------------------------------------------------------------------
const readme = read(path.join(MOD, 'README.md'));
const at = readme.indexOf('\n## Decisions');
const decisions = at >= 0 ? readme.slice(at) : '';
// Cut at the next level-2 heading.
const section = decisions.replace(/^\n## Decisions/, '').split(/\n## /)[0];

say('D1 the Decisions section');
check(at >= 0 && section.trim().length > 200, 'the README has a section Decisions with content');
const entryOf = (id) => {
  const re = new RegExp('\\n### ' + id + '\\b[^\\n]*\\n([\\s\\S]*?)(?=\\n### |$)');
  const m = ('\n' + section).match(re);
  return m ? m[1] : '';
};
const cited = new Set();
for (const id of ['N2', 'N4', 'N5', 'N6', 'N7', 'N9']) {
  const body = entryOf(id);
  check(body.length > 40, id + ' has an entry');
  check(/mos-brand book e947a5d/.test(body), id + ' cites "mos-brand book e947a5d"');
  const paths = body.match(/`segments\/[a-z0-9\/.-]+`/g) || [];
  check(paths.length > 0 || /references\/[a-z-]+\.md/.test(body), id + ' cites a segment path');
  for (const p of paths) cited.add(p.replace(/`/g, ''));
}
if (bookHere) {
  const missing = [...cited].filter((p) => git(['cat-file', '-e', REF + ':' + p]).status !== 0);
  check(cited.size > 0 && missing.length === 0, 'every cited segment path exists in the book at ' + REF + ' (' + cited.size + ' paths)' + (missing.length ? ' missing: ' + missing.join(', ') : ''));
} else {
  say('  skip the cited paths are not compared (no book checkout)');
}
check(/Owner decision needed|navigator ruling of 2026-10-23/.test(entryOf('N2')) && /C-32/.test(entryOf('N2')), 'N2 names C-32 and the ruling that supersedes it for this panel');
check(/attention, never proof/.test(entryOf('N2')) && /no green/i.test(entryOf('N2')), 'N2 says blue is attention, never proof, and that there is no green state');

say('D2 the state table');
{
  const body = entryOf('N9');
  const labelMap = {};
  const lm = face.match(/export const LABEL[^{]*\{([\s\S]*?)\n\}/);
  if (lm) for (const m of lm[1].matchAll(/(\w+):\s*'([^']+)'/g)) labelMap[m[1]] = m[2];
  check(Object.keys(labelMap).length === 11, 'face.ts LABEL holds 11 states');
  // Plan 380-13: the columns are Drawn label | State id | Mapping | Event or reason | Book spelling.
  const rows = body.split('\n').filter((l) => /^\|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const byLabel = {};
  for (const r of rows) byLabel[r[0]] = r;
  let wrong = [];
  for (const [state, label] of Object.entries(labelMap)) {
    const row = byLabel[label];
    if (!row || row[1] !== state) wrong.push(state + ' ' + label);
  }
  check(Object.keys(labelMap).length === 11 && wrong.length === 0, 'the 11 drawn states appear with their state id and their label' + (wrong.length ? ' (wrong: ' + wrong.join(', ') + ')' : ''));
  const kinds = Object.values(labelMap).map((label) => (byLabel[label] || [])[2]);
  check(kinds.every((k) => k === 'mapped' || k === 'unmapped'), 'each state says mapped or unmapped');
  const unmapped = Object.values(labelMap).filter((label) => (byLabel[label] || [])[2] === 'unmapped');
  check(unmapped.join(',') === 'Reframe', 'only Reframe is unmapped' + (unmapped.length ? ' (' + unmapped.join(', ') + ')' : ''));
  for (const n of unmapped) check((byLabel[n][3] || '').length > 20, n + ' is unmapped and has a reason');
  for (const [label, row] of Object.entries(byLabel)) if (row[2] === 'mapped') check((row[3] || '').length > 20, label + ' is mapped and names its event');
  // The two spellings the book states table uses in older words are recorded.
  check(byLabel['Searching'] && byLabel['Searching'][4] === 'Search' && byLabel['Nothing found'] && byLabel['Nothing found'][4] === 'Limit', 'the table records the book spelling Search and Limit beside Searching and Nothing found');
  // The mapping in face-events.ts and the table agree on which state is unmapped.
  const events = read(path.join(HOOKS, 'face-events.ts'));
  const un = (events.match(/export const UNMAPPED_STATES[^=]*=\s*\[([^\]]*)\]/) || [])[1] || '';
  check(un.replace(/[\s']/g, '') === 'reframe', 'face-events.ts lists reframe, and only reframe, as unmapped');
}

say('D3 surfaces');
{
  const body = entryOf('N7');
  check(/Desktop/.test(body) && /Cowork/.test(body) && /no panel/i.test(body), 'N7 says Desktop and Cowork get no panel');
  check(/deliberate skip/i.test(body), 'N7 calls it a deliberate skip');
}

say('D4 the workspace mod stays dev-only');
{
  const wm = path.join(REPO, 'ui', 'mindrian-workspace-mod', 'README.md');
  check(fs.existsSync(wm) && /Dev-only load/i.test(read(wm)), 'ui/mindrian-workspace-mod/README.md still says dev-only load');
  const pkg = JSON.parse(read(path.join(REPO, 'package.json')));
  const files = (pkg.files || []).join('\n');
  check(!/mindrian-workspace-mod/.test(files), 'the root package.json files list does not ship ui/mindrian-workspace-mod');
  check(/mindrian-workspace-mod/.test(entryOf('N4')) && /dev-only/i.test(entryOf('N4')), 'N4 names the clash with the workspace mod and says it is dev-only');
  check(/two status lines|both are kept/i.test(entryOf('N4')), 'N4 states the default: both lines are kept');
}

say('D5 the terminal segment is proposed');
{
  let ok = true;
  for (const id of ['N4', 'N5', 'N6', 'N7']) if (!/experience\/terminal/.test(entryOf(id)) || !/proposed/i.test(entryOf(id))) ok = false;
  check(ok, 'N4, N5, N6 and N7 each cite experience/terminal and mark it proposed');
  check(/proposed/i.test(entryOf('N5')) && /\/mos-words/.test(entryOf('N5')) && /\/mos-\*/.test(entryOf('N5')) && /\/mos:\*/.test(entryOf('N5')), 'N5 keeps /mos-* and /mos-words, names the colon names of the plugin and says plan 11 proposes a segment');
  check(/dimmed paper/i.test(entryOf('N6')) && /4\.\d\d/.test(entryOf('N6')), 'N6 names dimmed paper and gives a measured contrast');
}

say('D6 HOLLOW');
{
  const body = entryOf('HOLLOW');
  check(/#8F8B80/.test(body) && /removed/i.test(body) && /D-10/.test(body), 'a HOLLOW entry records that #8F8B80 was removed by D-10');
  check(!/HOLLOW/.test(face.replace(/^\s*\/\/.*$/gm, '')), 'face.ts has no HOLLOW outside a comment');
}

say('D7 geometry');
{
  const body = entryOf('GEOMETRY');
  check(/asset-fa8504998f\.json/.test(body) && /asset-d96217b320\.js/.test(body), 'a GEOMETRY entry cites the canon asset and its renderer');
  check(/e54e7c6a3c11a039059fb47833b09e865cd3981e2910b4f13571e87c06682da2/.test(body), 'the GEOMETRY entry records the sha256 of the asset');
  check(/number for number/.test(body), 'the GEOMETRY entry states the rule: number for number, never a redraw');
  check(/words-only line face/.test(body) && /never falls back to typed numbers/.test(body), 'the GEOMETRY entry states the fallback: the words-only line face, never typed numbers');
}

say('D8 the visual change');
{
  const at8 = readme.indexOf('\n## Visual change');
  const sec = at8 >= 0 ? readme.slice(at8).split(/\n## /)[1] || '' : '';
  check(at8 >= 0 && (readme.match(/^## Visual change/gm) || []).length === 1, 'the README has one section Visual change');
  check(/deliberate visual change, not a refactor/.test(sec), 'it says deliberate visual change, not a refactor');
  check(/2026-10-23/.test(sec) && /\b120\b/.test(sec) && /\b102\b/.test(sec) && /\b44\b/.test(sec), 'it gives the date and the counts 120, 102 and 44');
  check(/\b84\b/.test(sec) && /\b18\b/.test(sec) && /meter-pin/.test(sec), 'it says what the 120 were (84 state, 18 crew, 18 canvas) and where the canvas pins went');
  check(/[0-9a-f]{64}/.test(sec), 'it records the sha256 of the old pin table');
  check(/Old state to new state/.test(sec) && /Nothing found/.test(sec) && /Search/.test(sec), 'it holds the old to new state table');
  check(/crew/i.test(sec) && /Deferred/.test(sec) && /identity\/robots/.test(sec), 'it lists the dropped crew style as deferred, with its canon source');
  check(/dimmed paper/.test(sec) && /No hex is invented/.test(sec), 'it states D-11: dimmed paper, no invented hex');
  check(!fs.existsSync(path.join(MOD, 'tests', 'raster-pin.test.ts')) && fs.existsSync(path.join(MOD, 'tests', 'meter-pin.test.ts')) && fs.existsSync(path.join(MOD, 'tests', 'theo-face-pin.test.ts')), 'raster-pin.test.ts is gone, meter-pin.test.ts and theo-face-pin.test.ts stand');
}

say('');
say('passed ' + passed + ', failed ' + failed);
process.exit(failed === 0 ? 0 : 1);
