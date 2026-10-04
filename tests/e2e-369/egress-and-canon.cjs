#!/usr/bin/env node
'use strict';

/*
 * tests/e2e-369/egress-and-canon.cjs -- Phase 369-29 (CANON369-07): the eleven CANON369 checks of 369-UI-SPEC.md, C1 to
 * C11, run against the BUILT, SHIPPED shell (lib/ui-shell/dist), started the way a person starts it
 * (node lib/ui-shell/launch.cjs start), across the full recoverable journey: open a room, read Work, Evidence, Decisions,
 * Deliverables and Graph, open the Status panel and the room-switch dialog, and walk a gate through ready, saving,
 * recorded (approve), recorded (reject), stale_subject and a persistence failure, each at 1280 px and at 390 px.
 *
 * What is measured, not eyeballed (Canon s4, Canon Part 8, D-01, D-11):
 *   C1  every request, websocket and EventSource host is 127.0.0.1; no iframe with a non-same-origin src
 *   C2  static scan of every file in the dist (js, css, html, map, fonts, json) for outside hosts
 *   C3  computed border radius is 0px on every element and ::before and ::after, except [data-mark="circle"]
 *   C4  ochre is never text; an ochre fill or border on paper carries a 1 px ink outline
 *   C5  text contrast by a WCAG luminance computation in the library (4.5:1; 3:1 at 24 px, or 18.66 px bold)
 *   C6  Fraunces, DM Sans, JetBrains Mono and Bodoni Moda are loaded, and every font file came from 127.0.0.1
 *   C7  every [data-tile] has its written status in its row and its accessible name
 *   C8  per screen: one h1, at most one primary action, one circle mark and one ochre triangle
 *   C9  colours: the shell's own built CSS holds only token colours; every computed colour on every screen is a token
 *   C10 under prefers-reduced-motion no animation runs, after load and after a gate answer, and the recorded status shows
 *   C11 zero U+2014 and U+2013 in the dist's built strings
 * Screenshots go to tests/e2e-369/output/screenshots/ (git-ignored) for plan 30's visual review: composition is for a human.
 *
 * Exit 77 only when Playwright, Chromium, the dist or the root node_modules are absent; never to hide a failing check.
 * Hermetic: temp HOME, a hermetic flag-ON daemon (MINDRIAN_TEST_MODE=1 for plan 26's test-only fault markers), never
 * ~/MindrianRooms. Kills only what it started. Canon Part 8: loopback only. Canon Part 9: tests/ is allow-listed for raw
 * SQL; the seed goes through the write door, plus the UPDATEs that stand in for another session. Hyphens only.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
// Playwright finds its browsers under the real HOME; keep that path before the hermetic HOME replaces it.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(os.homedir(), '.cache', 'ms-playwright');
const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-369-canon-'));
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const pw = require('./lib/pw.cjs');
const C = require('./lib/canon-checks.cjs');
const D = require('../helpers/mcp-daemon-369.cjs');

const DIST = path.join(REPO, 'lib', 'ui-shell', 'dist');
const LAUNCH = path.join(REPO, 'lib', 'ui-shell', 'launch.cjs');
const SHOTS = path.join(__dirname, 'output', 'screenshots');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const GAP = (msg) => {
  console.log('SKIPPED (ENV GAP): ' + msg);
  process.exit(pw.SKIP_EXIT_CODE);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = JSON.stringify;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

const QUESTION = 'What would make this customer problem worth solving?';
const NODE = 'node-canon-369';
const ITEM_DOC = 'evidence/interview.md';
const DELIVERABLE_DOC = 'deliverables/pilot-plan.md';
const OUTSIDE_HOSTS = ['rxdb.info', 'fonts.googleapis', 'fonts.gstatic', 'cdn.jsdelivr', 'unpkg.com', 'cdnjs'];
const ANALYTICS_HOSTS = ['google-analytics.com', 'googletagmanager.com', 'clarity.ms', 'plausible.io', 'posthog.com', 'segment.io', 'vitals.vercel-insights'];
const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.htm', '.map', '.json', '.txt', '.rsc', '.svg', '.xml', '.webmanifest', '.md']);
const FONT_FAMILIES = ['Fraunces', 'DM Sans', 'JetBrains Mono', 'Bodoni Moda'];

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
    s.on('error', reject);
  });
}

async function waitUntil(fn, ms, what, step) {
  const end = Date.now() + ms;
  for (;;) {
    let value;
    try {
      value = await fn();
    } catch (_e) {
      value = false;
    }
    if (value) return value;
    if (Date.now() > end) throw new Error('timeout waiting for ' + what);
    await sleep(step || 50);
  }
}

function walkFiles(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, out);
    else if (ent.isFile()) out.push(full);
  }
  return out;
}

function lineCol(text, index) {
  let line = 1;
  let last = -1;
  for (let i = text.indexOf('\n'); i !== -1 && i < index; i = text.indexOf('\n', i + 1)) {
    line += 1;
    last = i;
  }
  return { line, col: index - last };
}

// ---------------------------------------------------------------------------------------------
// Child writers: every write goes through the write door in its own process, as a hook would
// ---------------------------------------------------------------------------------------------

const PRELUDE =
  'const { openRoomDb, closeRoomDb } = require(' + J(path.join(REPO, 'lib', 'core', 'room-db.cjs')) + ');' +
  'const { insertNode } = require(' + J(path.join(REPO, 'lib', 'core', 'node-insert.cjs')) + ');' +
  'const navigation = require(' + J(path.join(REPO, 'lib', 'core', 'navigation.cjs')) + ');' +
  'const frames = require(' + J(path.join(REPO, 'lib', 'core', 'frame-provenance.cjs')) + ');';

function runChild(body, env) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn('node', ['-e', PRELUDE + '(async () => {' + body + '})().catch((e) => { console.error(String(e && e.stack || e)); process.exit(1); });'], {
      env: Object.assign({}, env || process.env, { HOME: HERMETIC, USERPROFILE: HERMETIC }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => { out += c.toString('utf8'); });
    child.stderr.on('data', (c) => { err += c.toString('utf8'); });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) return reject(new Error('child failed (' + code + '): ' + err.slice(-400)));
      try {
        resolve(JSON.parse(out.trim().split('\n').pop()));
      } catch (_e) {
        resolve(null);
      }
    });
  });
}

// The fixture room: a governing question, evidence with a CONTRADICTS pair (one with a real source document), a claim a
// person confirmed, a recorded decision and a deliverable with a real Markdown file.
function seedRoom(roomDir, env) {
  fs.mkdirSync(path.join(roomDir, 'evidence'), { recursive: true });
  fs.mkdirSync(path.join(roomDir, 'deliverables'), { recursive: true });
  fs.writeFileSync(
    path.join(roomDir, ITEM_DOC),
    '---\nsection: evidence\n---\n# Interview notes\n\nThe buyer said the pilot fee is the sticking point.\n\n- Budget is set in January\n- The pilot must show a result in 30 days\n\n[a link](https://example.invalid/)\n'
  );
  fs.writeFileSync(path.join(roomDir, DELIVERABLE_DOC), '# Pilot plan\n\nThree steps to a result inside 30 days.\n\n1. Agree the scope\n2. Run the pilot\n3. Review the result\n');
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'try {' +
      "const q = frames.setGoverningQuestion(db, " + J(roomDir) + ", { text: " + J(QUESTION) + ", origin: 'chosen' });" +
      "if (!q.ok) throw new Error('question: ' + JSON.stringify(q));" +
      "const claim = (text, tag) => { const r = navigation.writeClaimNode(db, { knowledge_type: 'fact', text, sessionId: 'canon-' + tag }); if (!r.ok) throw new Error('claim: ' + JSON.stringify(r)); return r.node_id; };" +
      "const a = claim('Demand assumption: pilots will pay for a result', 'a');" +
      "const b = claim('Interview excerpt: the buyer refuses a pilot fee', 'b');" +
      "const c = claim('Pricing claim: the pilot costs 1200 a month', 'c');" +
      "const e = navigation.writeEdge(db, { source_id: a, target_id: b, edge_type: 'CONTRADICTS', properties: { origin: 'e2e-369' } });" +
      "if (!e.ok) throw new Error('edge: ' + JSON.stringify(e));" +
      "const p = navigation.promoteNodeStatus(db, c, 'proposed', 'confirmed', 'user', 'e2e-369');" +
      "if (!p.ok) throw new Error('promote: ' + JSON.stringify(p));" +
      "db.prepare('UPDATE nodes SET source_path = ? WHERE id = ?').run(" + J(ITEM_DOC) + ", a);" +
      "insertNode(db, 'decision:e2e-canon-1', 'decision', JSON.stringify({ title: 'Run the pilot at the lower fee', gate_id: 'gate-e2e-1', subject_node_id: c }), { epistemic_type: 'decision', review_status: 'confirmed' });" +
      "insertNode(db, 'artifact:e2e-canon-1', 'Artifact', JSON.stringify({ title: 'Pilot plan', section: 'deliverables', file: " + J(DELIVERABLE_DOC) + " }), { epistemic_type: 'observation' });" +
      'console.log(JSON.stringify({ a, b, c }));' +
      '} finally { closeRoomDb(db); }',
    env
  );
}

function writeClaim(roomDir, text, tag, env) {
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'try { const r = navigation.writeClaimNode(db, { knowledge_type: ' + "'fact'" + ', text: ' + J(text) + ', sessionId: ' + J('canon-' + tag) + ' }); if (!r.ok) throw new Error(JSON.stringify(r));' +
      'console.log(JSON.stringify({ id: r.node_id })); } finally { closeRoomDb(db); }',
    env
  );
}

// One proposed claim that names the node id, newest in the room. A sourced claim points at a source node (the room's own
// record recommends "approve"); an unsourced one is recommended "hold".
let claimCounter = 0;
function newClaim(roomDir, tag, sourced, env) {
  claimCounter += 1;
  const n = claimCounter;
  const text = 'Pilot note ' + tag + ' about ' + NODE + ': the person must click to confirm (' + n + ').';
  return runChild(
    'const db = openRoomDb(' + J(roomDir) + ');' +
      'try {' +
      "const c = navigation.writeClaimNode(db, { knowledge_type: 'fact', text: " + J(text) + ", sessionId: 'canon-' + " + J(tag + n) + " });" +
      "if (!c.ok) throw new Error('claim: ' + JSON.stringify(c));" +
      'let src = null;' +
      (sourced
        ? "const s = navigation.writeEvidenceClaim(db, { topic: " + J('Interview source ' + tag) + ", source: 'e2e-369', url: " + J('https://example.org/369/canon/' + n) + ", retrieved_at: '2026-10-01T00:00:00Z', evidence_tier: 'Academic', summary: 'interview', sessionId: 'canon-src-' + " + J(tag + n) + " });" +
          "if (!s.ok) throw new Error('source: ' + JSON.stringify(s));" +
          'src = s.node_id || s.id;' +
          "const e = navigation.writeEdge(db, { source_id: c.node_id, target_id: src, edge_type: 'SOURCED_FROM', properties: { origin: 'e2e-369' } });" +
          "if (!e.ok) throw new Error('edge: ' + JSON.stringify(e));" +
          "db.prepare('UPDATE nodes SET source_path = ? WHERE id = ?').run(" + J(ITEM_DOC) + ', src);'
        : '') +
      'console.log(JSON.stringify({ claim: c.node_id, source: src }));' +
      '} finally { closeRoomDb(db); }',
    env
  );
}

// ---------------------------------------------------------------------------------------------
// The record of the run
// ---------------------------------------------------------------------------------------------

const V = {}; // check id -> offender lines
const NOTES = {}; // check id -> measured facts for the PASS line
for (let i = 1; i <= 11; i += 1) { V['C' + i] = []; NOTES['C' + i] = []; }
V.CSP = [];
V.ENV = [];
const screens = []; // { n, name, width, file }
const SEEN_FONTS = new Set();
let lowestContrast = null;
let runsMeasured = 0;
let colourClasses = new Set();

function offend(check, label, items, fmt) {
  for (const it of items) V[check].push('[' + label + '] ' + fmt(it));
}

// run-all-369.sh's long-dash guard greps every file under tests/e2e-369, binary ones included, for the UTF-8 bytes of U+2014
// and U+2013. A compressed image holds those three bytes by chance about once in four runs, so a screenshot that does is
// taken again as a JPEG (a different byte stream) until it is clean. The picture is the same; only the encoding differs.
const DASH_BYTES = [Buffer.from([0xe2, 0x80, 0x94]), Buffer.from([0xe2, 0x80, 0x93])];
const hasDashBytes = (buf) => DASH_BYTES.some((b) => buf.indexOf(b) !== -1);
async function shoot(p, base) {
  const png = path.join(SHOTS, base + '.png');
  await p.screenshot({ path: png, fullPage: true });
  if (!hasDashBytes(fs.readFileSync(png))) return png;
  fs.rmSync(png, { force: true });
  for (let q = 92; q >= 60; q -= 2) {
    const jpg = path.join(SHOTS, base + '.jpg');
    await p.screenshot({ path: jpg, fullPage: true, type: 'jpeg', quality: q });
    if (!hasDashBytes(fs.readFileSync(jpg))) return jpg;
  }
  throw new Error('no screenshot encoding of ' + base + ' is free of the dash byte sequences');
}

// Negative controls: each walker must catch a planted offender and stay quiet on a clean twin, so a PASS below can
// never be a walker that sees nothing. No network: the page is built with setContent and the iframe is a data: URL.
async function negativeControls(browser) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const p = await ctx.newPage();
  const lines = [];
  const bad = [];
  const expect = (name, got, want) => {
    const ok = want(got);
    lines.push((ok ? 'ok   ' : 'FAIL ') + name);
    if (!ok) bad.push(name + ': ' + J(got).slice(0, 200));
  };
  const head = '<style>body{background:#F5F0E6;color:#14202B;font:16px Arial}.tile-status{font-size:12px}</style>';
  const clean = head + '<h1>One</h1><p>Body text</p><span data-tile="red"><span class="tile-mark" aria-hidden="true"></span><span class="tile-status">REJECTED</span></span>' +
    '<span style="display:inline-block;width:10px;height:10px;background:#D49A20;border:1px solid #14202B"></span>';
  const dirty = head + '<h1>One</h1><h1>Two</h1><div id="r" style="border-radius:8px">round</div><p id="o" style="color:#D49A20">ochre text</p>' +
    '<p id="l" style="color:#BBBBBB">low contrast</p><span id="f" style="display:inline-block;width:10px;height:10px;background:#D49A20"></span>' +
    '<span data-tile="red"><span class="tile-mark" aria-hidden="true"></span></span><div style="background:#00FF00;width:5px;height:5px"></div>' +
    '<style>@keyframes spin{from{opacity:.2}to{opacity:1}}</style><i id="a" style="display:block;animation:spin 5s linear infinite">x</i>' +
    '<iframe src="data:text/html,x" title="outside"></iframe>';
  await p.setContent(clean);
  expect('clean page: no radius offender', await C.radiusViolations(p), (x) => x.length === 0);
  expect('clean page: no ochre offender (an ochre square with a 1px ink outline is allowed)', await C.ochreViolations(p), (x) => x.length === 0);
  expect('clean page: no contrast offender', await C.walkTextContrast(p), (x) => x.length === 0);
  expect('clean page: no tile offender', await C.tileViolations(p), (x) => x.length === 0);
  expect('clean page: no colour offender', await C.computedColourViolations(p), (x) => x.length === 0);
  expect('clean page: one h1', await C.countPerView(p), (x) => x.h1 === 1);
  await p.setContent(dirty);
  expect('planted: a rounded box is found', await C.radiusViolations(p), (x) => x.some((o) => /div#r/.test(o.path)));
  const ochre = await C.ochreViolations(p);
  expect('planted: ochre text is found', ochre, (x) => x.some((o) => /ochre text/.test(o.reason)));
  expect('planted: a bare ochre fill on paper is found', ochre, (x) => x.some((o) => /span#f/.test(o.path) && /fill/.test(o.reason)));
  expect('planted: low contrast text is found', await C.walkTextContrast(p), (x) => x.some((o) => /p#l/.test(o.path) && o.ratio < 4.5));
  expect('planted: a tile without its words is found', await C.tileViolations(p), (x) => x.some((o) => /no written status/.test(o.reason)));
  expect('planted: a non-token colour is found', await C.computedColourViolations(p), (x) => x.some((o) => /0,255,0/.test(o.reason)));
  expect('planted: two h1 are counted', await C.countPerView(p), (x) => x.h1 === 2);
  expect('planted: a running animation is found', await C.runningAnimations(p), (x) => x.some((o) => /i#a/.test(o.path)));
  expect('planted: an outside iframe is found', await C.iframeViolations(p, 'http://127.0.0.1:1'), (x) => x.length === 1);
  expect('planted: a non-token colour in built CSS is found with its line and column', C.colourViolations('a{color:#123456}\nb{border:1px solid red}', 'x.css'), (x) => x.length === 2 && x[0].line === 1 && x[1].line === 2);
  expect('clean CSS: tokens, transparent and color-mix of tokens pass', C.colourViolations('a{color:var(--ink);background:#f5f0e6;outline:2px solid #0000;border-color:color-mix(in srgb,var(--paper) 75%,transparent)}', 'x.css'), (x) => x.length === 0);
  await ctx.close();
  return { lines, bad };
}

async function main() {
  const t0 = Date.now();
  if (!pw.resolvePlaywright()) GAP('Playwright is not installed (spike 006 install or a walled dev package)');
  const manifestFile = path.join(DIST, 'manifest.json');
  if (!fs.existsSync(manifestFile)) GAP('the shell dist is absent (lib/ui-shell/dist/manifest.json): run node scripts/build-ui-shell.cjs');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  if (!fs.existsSync(path.join(DIST, manifest.serverEntry))) GAP('the dist names a server entry that is missing: ' + manifest.serverEntry);
  const rootNm = path.join(REPO, 'node_modules');
  if (!fs.existsSync(path.join(rootNm, 'next', 'package.json')) || !fs.existsSync(path.join(rootNm, 'react-dom', 'package.json'))) {
    GAP('the root node_modules does not carry next and react-dom (run npm ci --ignore-scripts at the repo root)');
  }

  console.log('Phase 369-29 egress and canon (CANON369-07), built shell, real browser');
  console.log('  dist: source hash ' + String(manifest.sourceHash).slice(0, 16) + ', built ' + manifest.builtAt + ', ' + manifest.chassis);

  // The calibration comes first: the walker is only as good as the canon's own numbers.
  const cal = C.selfTest();
  for (const l of cal.lines) console.log('    calibration ' + l);
  if (!cal.ok) {
    console.log('FAIL calibration: contrastRatio does not reproduce the canon measured pairs');
    process.exit(1);
  }

  // ---- static: C2, C9 (built CSS), C11 over every file in the dist ----
  const files = walkFiles(DIST, []);
  let scannedBytes = 0;
  let textFiles = 0;
  const cssFiles = [];
  for (const f of files) {
    const rel = path.relative(REPO, f);
    const ext = path.extname(f).toLowerCase();
    const buf = fs.readFileSync(f);
    scannedBytes += buf.length;
    // C2 scans every file, fonts and images included: the bytes are read as latin1 so a host name is found in any of them.
    const hay = buf.toString('latin1').toLowerCase();
    for (const host of OUTSIDE_HOSTS.concat(ANALYTICS_HOSTS)) {
      const at = hay.indexOf(host);
      if (at !== -1) {
        const lc = lineCol(hay, at);
        V.C2.push(rel + ':' + lc.line + ':' + lc.col + ' names ' + host);
      }
    }
    if (TEXT_EXT.has(ext)) {
      textFiles += 1;
      const text = buf.toString('utf8');
      for (const [ch, name] of [[EM, 'U+2014'], [EN, 'U+2013']]) {
        let at = text.indexOf(ch);
        let guard = 0;
        while (at !== -1 && guard < 5) {
          const lc = lineCol(text, at);
          V.C11.push(rel + ':' + lc.line + ':' + lc.col + ' holds ' + name + ' near "' + text.slice(Math.max(0, at - 20), at + 20).replace(/\s+/g, ' ') + '"');
          at = text.indexOf(ch, at + 1);
          guard += 1;
        }
      }
      if (ext === '.css') cssFiles.push({ rel, text });
    }
  }
  NOTES.C2.push(files.length + ' files, ' + (scannedBytes / 1048576).toFixed(1) + ' MiB, ' + (OUTSIDE_HOSTS.length + ANALYTICS_HOSTS.length) + ' host names');
  NOTES.C11.push(textFiles + ' text files');
  const shellCss = [];
  const vendorCss = [];
  for (const f of cssFiles) {
    // The shell's own stylesheet declares the token sheet; a vendor stylesheet (the document display's) does not.
    if (/--ink\s*:\s*#/i.test(f.text)) shellCss.push(f);
    else vendorCss.push(f);
  }
  if (shellCss.length === 0) V.C9.push('no built stylesheet declares the token sheet (--ink): the shell CSS cannot be identified');
  let shellColours = 0;
  for (const f of shellCss) {
    const v = C.colourViolations(f.text, f.rel);
    shellColours += (f.text.match(/#[0-9a-fA-F]{3,8}\b|color-mix\(/g) || []).length;
    for (const x of v) V.C9.push(x.file + ':' + x.line + ':' + x.col + ' ' + x.reason + ' "' + x.literal + '"');
  }
  let vendorOutside = 0;
  for (const f of vendorCss) vendorOutside += C.colourViolations(f.text, f.rel).length;
  NOTES.C9.push(shellCss.length + ' shell stylesheet(s), ' + shellColours + ' colour literals, all tokens or color-mix of tokens; ' + vendorCss.length + ' vendor stylesheet(s) with ' + vendorOutside + ' literals judged by what they draw (computed-colour walk below)');

  // ---- the browser run ----
  let launched;
  try {
    launched = await pw.launch();
  } catch (e) {
    GAP('Chromium could not launch: ' + String(e.message || e).split('\n')[0]);
  }
  const { browser } = launched;

  const nc = await negativeControls(browser);
  for (const l of nc.lines) console.log('    control ' + l);
  if (nc.bad.length) {
    console.log('FAIL negative controls: a walker did not catch a planted offender');
    for (const b of nc.bad) console.log('       ' + b);
    await browser.close().catch(() => {});
    process.exit(1);
  }

  let daemon;
  try {
    daemon = await D.startDaemon({
      rooms: [
        { slug: 'room-v', variant: 'wide', migrate: true },
        { slug: 'room-q', variant: 'wide', migrate: true },
      ],
      extraEnv: { MINDRIAN_TEST_MODE: '1' },
    });
  } catch (err) {
    await browser.close().catch(() => {});
    GAP('the hermetic daemon could not start (' + String(err && err.message).slice(0, 200) + ')');
  }
  const roomV = daemon.roomDirs['room-v'];
  const ids = await seedRoom(roomV, daemon.env);

  const shellPort = await freePort();
  const launchEnv = Object.assign({}, process.env, {
    HOME: HERMETIC, USERPROFILE: HERMETIC, MINDRIAN_ROOMS_HOME: daemon.roomsHome,
    MOS_PROPOSAL_SOURCE: 'adapter', MINDRIAN_TEST_MODE: '1', MOS_SHELL_START_TIMEOUT_MS: '90000',
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', NEXT_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1',
  });
  delete launchEnv.CLAUDE_CODE_SESSION_ID;
  delete launchEnv.CLAUDE_ACTIVE_ROOM;
  // Plan 369-40 (CR-01): launch.cjs run like Claude Code runs it (stdout is a pipe, not a terminal) prints no sign-in
  // code. Every start asserts that, then the test arms its OWN one-time code through the 0600 control channel
  // (the gate-button.cjs pattern) and signs in with /auth/bootstrap?code=, which page.goto sends as a navigation.
  const CONTROL_POST = "const h=require('node:http');const a=process.argv.slice(1);const q=h.request({host:'127.0.0.1',port:Number(a[0]),path:'/control/bootstrap',method:'POST',headers:{'content-type':'application/json','x-mos-control-token':a[1]}},(r)=>{r.resume();r.on('end',()=>process.exit(r.statusCode===200?0:2));});q.on('error',()=>process.exit(3));q.end(a[2]);";
  function startLink() {
    const r = cp.spawnSync(process.execPath, [LAUNCH, 'start', '--port', String(shellPort)], { env: launchEnv, encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) throw new Error('launch.cjs start failed (' + r.status + '): ' + String(r.stderr || r.stdout).slice(-500));
    const printed = String(r.stdout) + String(r.stderr);
    if (/code=|\/auth\/bootstrap/.test(printed)) throw new Error('CR-01: launch.cjs printed a sign-in code outside a terminal: ' + printed.slice(0, 200));
    const tokenFile = launchEnv.MOS_SHELL_CONTROL_TOKEN_FILE || path.join(HERMETIC, '.mindrian', 'ui-shell', 'control.token');
    const token = fs.readFileSync(tokenFile, 'utf8').trim();
    const code = crypto.randomBytes(32).toString('base64url');
    const arm = cp.spawnSync(process.execPath, ['-e', CONTROL_POST, String(shellPort), token, JSON.stringify({ sha256: crypto.createHash('sha256').update(code).digest('hex') })], { encoding: 'utf8', timeout: 20000 });
    if (arm.status !== 0) throw new Error('arming a sign-in code through the control channel failed (' + arm.status + ')');
    return 'http://127.0.0.1:' + shellPort + '/auth/bootstrap?code=' + code;
  }
  const origin = 'http://127.0.0.1:' + shellPort;

  // One egress capture for the whole run (every page of every context): request, websocket and EventSource.
  const requests = []; // { url, type }
  const types = {};
  const cspEvents = [];
  const consoleErrors = [];
  async function newCtx(opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 900 } }, opts || {}));
    ctx.on('request', (r) => {
      requests.push({ url: r.url(), type: r.resourceType() });
      types[r.resourceType()] = (types[r.resourceType()] || 0) + 1;
    });
    await ctx.exposeFunction('__cspReport', (line) => { cspEvents.push(line); });
    await ctx.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => window.__cspReport(e.violatedDirective + ' ' + e.blockedURI + ' ' + e.sourceFile + ':' + e.lineNumber));
    });
    return ctx;
  }
  function watch(p) {
    p.on('websocket', (ws) => { requests.push({ url: ws.url(), type: 'websocket' }); types.websocket = (types.websocket || 0) + 1; });
    p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    p.on('pageerror', (e) => consoleErrors.push(String((e && e.message) || e)));
  }

  let ctx1 = null;
  let ctx2 = null;
  let page = null;
  try {
    // Start the shell the way a person does, through the launcher, against the shipped dist.
    const link1 = startLink();
    ctx1 = await newCtx();
    page = await ctx1.newPage();
    watch(page);

    const act = (p, name, body) =>
      p.evaluate(
        async ({ name, body }) => {
          const csrf = document.querySelector('meta[name="mos-csrf"]').getAttribute('content');
          const res = await fetch('/api/actions/' + name, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-mos-csrf': csrf }, body: JSON.stringify(body || {}) });
          return res.json();
        },
        { name, body }
      );
    async function mint(p, tag, sourced) {
      const made = await newClaim(roomV, tag, sourced, daemon.env);
      const asked = await act(p, 'askClaude', { selectedNodeId: NODE, question: 'Should this claim be confirmed?' });
      assert.strictEqual(asked.ok, true, 'the proposal minted a gate: ' + J(asked));
      assert.strictEqual(asked.subject_node_id, made.claim, 'the proposal is about the claim just filed');
      return { gate: asked.gate_id, claim: made.claim, source: made.source };
    }
    async function openRoom(p, slug) {
      await p.goto(origin + '/?rooms');
      const row = p.locator('.room-list-row', { hasText: slug });
      await row.waitFor({ timeout: 30000 });
      await row.getByText('Open this room').click();
      await p.getByRole('button', { name: /^Switch to/ }).click({ timeout: 2500 }).catch(() => {});
      await p.waitForFunction((s) => document.querySelector('.rs-name') && document.querySelector('.rs-name').textContent === s, slug, { timeout: 30000 });
    }
    async function go(p, urlPath) {
      await p.goto(origin + urlPath);
      await p.waitForSelector('#view h1', { timeout: 30000 });
    }
    const waitCurrent = (p) =>
      p.waitForFunction(() => { const el = document.querySelector('[data-row="browser-copy"]'); return !!el && el.getAttribute('data-copy-state') === 'current'; }, null, { timeout: 45000 });
    const waitWork = (p, state) => p.waitForSelector('.work-since[data-state="' + state + '"]', { timeout: 45000 });
    async function openGate(p, gateId, state) {
      await p.goto(origin + '/gate/' + encodeURIComponent(gateId));
      await p.waitForSelector('#view .gate-card[data-state="' + (state || 'ready') + '"]', { timeout: 45000 });
    }
    const primary = (p) => p.locator('#view .ab[data-variant="primary"]');

    // Let entry motion finish before a screen is measured (opacity mid-fade would be measured as a colour).
    async function settle(p) {
      await p.evaluate(async () => {
        await document.fonts.ready;
        for (let i = 0; i < 3; i += 1) {
          await Promise.race([
            Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
            new Promise((r) => setTimeout(r, 3000)),
          ]);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        }
      });
    }

    async function inspect(p, name, width) {
      const label = name + ' @' + width;
      await settle(p);
      const n = screens.filter((s) => s.width === width).length + 1;
      const file = await shoot(p, String(n).padStart(2, '0') + '-' + name + '-' + width);
      screens.push({ n, name, width, file });

      const counts = await C.countPerView(p);
      if (counts.h1 !== 1) V.C8.push('[' + label + '] ' + counts.h1 + ' h1 elements, exactly one is the rule');
      if (counts.primary > 1) V.C8.push('[' + label + '] ' + counts.primary + ' primary actions (.ab[data-variant="primary"])');
      if (counts.circle > 1) V.C8.push('[' + label + '] ' + counts.circle + ' circle marks ([data-mark="circle"])');
      if (counts.triangle > 1) V.C8.push('[' + label + '] ' + counts.triangle + ' ochre triangles');

      offend('C3', label, await C.radiusViolations(p), (x) => x.path + ' has ' + x.radius);
      offend('C4', label, await C.ochreViolations(p), (x) => x.path + ': ' + x.reason);
      const tc = await C.measureTextContrast(p);
      runsMeasured += tc.count;
      if (tc.lowest && (!lowestContrast || tc.lowest.ratio / tc.lowest.need < lowestContrast.ratio / lowestContrast.need)) lowestContrast = Object.assign({ label }, tc.lowest);
      offend('C5', label, tc.violations, (x) => x.path + ' "' + x.text + '": ' + x.reason);
      offend('C7', label, await C.tileViolations(p), (x) => x.path + ': ' + x.reason);
      offend('C9', label, await C.computedColourViolations(p), (x) => x.path + ': ' + x.reason);
      offend('C1', label, await C.iframeViolations(p, origin), (x) => x.path + ' iframe src ' + x.src);
      const fonts = await p.evaluate(() => Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => String(f.family).replace(/["']/g, '')));
      for (const f of fonts) SEEN_FONTS.add(f);
      return counts;
    }

    // One screen at both widths. `ready` re-asserts the state after the resize if the page needs it.
    async function bothWidths(name, ready) {
      await inspect(page, name, 1280);
      await page.setViewportSize({ width: 390, height: 844 });
      try {
        await sleep(350);
        if (ready) await ready();
        await inspect(page, name, 390);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 0) V.C8.push('[' + name + ' @390] the page scrolls sideways by ' + overflow + ' px');
      } finally {
        await page.setViewportSize({ width: 1280, height: 900 });
        await sleep(250);
      }
    }

    fs.rmSync(SHOTS, { recursive: true, force: true });
    fs.mkdirSync(SHOTS, { recursive: true });
    let step = 'sign in';
    const stage = (s) => { step = s; process.stdout.write('  ... ' + s + '\n'); };

    stage('sign in through the launcher link');
    await page.goto(link1);
    await page.waitForSelector('header.shell-header', { timeout: 45000 });

    // The rooms list is a view too.
    stage('rooms list');
    await page.goto(origin + '/?rooms');
    await page.locator('.room-list-row', { hasText: 'room-v' }).waitFor({ timeout: 30000 });
    await bothWidths('rooms-list');

    stage('Work, first visit');
    await openRoom(page, 'room-v');
    await page.waitForSelector('#view h1[data-question]', { timeout: 45000 });
    await waitWork(page, 'holds-now');
    await bothWidths('work-first-visit');

    stage('Work with changes');
    const gW = await mint(page, 'work', true);
    await waitCurrent(page);
    await sleep(900);
    await go(page, '/evidence');
    await sleep(600);
    await writeClaim(roomV, 'Interview excerpt, site visit two', 'new1', daemon.env);
    await go(page, '/');
    await waitWork(page, 'changes');
    await page.waitForSelector('.work-since .item-row', { timeout: 30000 });
    await bothWidths('work-with-changes', async () => { await page.waitForSelector('.work-since .item-row', { timeout: 15000 }); });

    stage('Evidence with a document open');
    await go(page, '/evidence');
    await page.waitForSelector('.ev-list .item-row', { timeout: 45000 });
    await page.locator('.ev-list .item-row-title', { hasText: 'Demand assumption' }).click();
    await page.waitForFunction(() => { const el = document.querySelector('.doc-display'); return !!el && el.textContent.includes('Interview notes'); }, null, { timeout: 45000 });
    await bothWidths('evidence-document', async () => {
      await page.waitForFunction(() => { const el = document.querySelector('.doc-display'); return !!el && el.textContent.includes('Interview notes'); }, null, { timeout: 15000 });
    });

    stage('Decisions');
    await go(page, '/decisions');
    await page.waitForSelector('[data-group="settled"] .item-row', { timeout: 45000 });
    await page.waitForSelector('[data-group="waiting"] .item-row', { timeout: 45000 });
    await bothWidths('decisions');

    stage('Deliverables with a document open');
    await go(page, '/deliverables');
    await page.waitForSelector('.ev-list .item-row', { timeout: 45000 });
    await page.locator('.ev-list .item-row-title', { hasText: 'Pilot plan' }).click();
    await page.waitForFunction(() => { const el = document.querySelector('.doc-display'); return !!el && el.textContent.includes('Three steps to a result'); }, null, { timeout: 45000 });
    await bothWidths('deliverable-document', async () => {
      await page.waitForFunction(() => { const el = document.querySelector('.doc-display'); return !!el && el.textContent.includes('Three steps to a result'); }, null, { timeout: 15000 });
    });

    stage('Graph');
    await go(page, '/graph?item=' + encodeURIComponent(ids.a));
    await page.waitForSelector('[data-graph="item"] .linked-row', { timeout: 45000 });
    await bothWidths('graph');

    stage('Status panel');
    await go(page, '/');
    await page.waitForSelector('.work-panel .ab', { timeout: 45000 });
    await waitCurrent(page);
    await page.locator('header.shell-header').getByRole('button', { name: 'Status', exact: true }).click();
    await page.waitForSelector('#status-panel[data-open="true"]', { timeout: 10000 });
    await bothWidths('status-panel', async () => { await page.waitForSelector('#status-panel[data-open="true"]', { timeout: 10000 }); });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#status-panel[data-open="false"]', { timeout: 10000 }).catch(() => {});

    stage('room-switch dialog');
    await go(page, '/');
    await page.waitForSelector('.work-panel .ab', { timeout: 45000 });
    await page.locator('.rs-trigger').click();
    await page.locator('[role="option"]', { hasText: 'room-q' }).click();
    await page.waitForSelector('dialog[open]', { timeout: 15000 });
    await bothWidths('room-switch-dialog', async () => { await page.waitForSelector('dialog[open]', { timeout: 10000 }); });
    await page.getByRole('button', { name: 'Stay here' }).click();
    await page.waitForSelector('dialog[open]', { state: 'detached', timeout: 10000 }).catch(() => {});

    // ---- the gate, state by state ----
    stage('gate: ready');
    const g1 = await mint(page, 'g1', true);
    await openGate(page, g1.gate);
    await page.waitForSelector('.gate-subject .tile', { timeout: 60000 });
    await page.waitForSelector('aside.gate-evidence, details.gate-evidence', { timeout: 30000 });
    await bothWidths('gate-ready', async () => { await page.waitForSelector('.gate-subject .tile', { timeout: 15000 }); });

    stage('gate: saving');
    let release = null;
    const held = new Promise((r) => { release = r; });
    await page.route('**/api/actions/approveDecision', async (route) => {
      await held;
      await route.continue();
    });
    try {
      await primary(page).click();
      await page.waitForSelector('#view .gate-card[data-state="saving"]', { timeout: 15000 });
      await bothWidths('gate-saving', async () => { await page.waitForSelector('#view .gate-card[data-state="saving"]', { timeout: 10000 }); });
    } finally {
      release();
    }
    await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 45000 });
    await page.unroute('**/api/actions/approveDecision');

    stage('gate: recorded, approve');
    await bothWidths('gate-recorded-approve', async () => { await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 10000 }); });

    stage('gate: recorded, reject');
    const g2 = await mint(page, 'g2', false);
    await openGate(page, g2.gate);
    await page.locator('#view .ab[data-variant="secondary"]', { hasText: 'Reject' }).click();
    await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 45000 });
    await bothWidths('gate-recorded-reject', async () => { await page.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 10000 }); });

    stage('gate: stale_subject refusal');
    const g3 = await mint(page, 'g3', true);
    await openGate(page, g3.gate);
    const upd = cp.spawnSync('node', ['-e',
      "const { DatabaseSync } = require('node:sqlite');" +
      "const db = new DatabaseSync(process.argv[1]); db.exec('PRAGMA busy_timeout = 5000');" +
      "db.prepare('UPDATE nodes SET last_seen_at = ? WHERE id = ?').run(Date.now(), process.argv[2]); db.close();",
      path.join(roomV, '.mindrian', 'room.db'), g3.claim,
    ], { encoding: 'utf8' });
    assert.strictEqual(upd.status, 0, upd.stderr);
    await primary(page).click();
    await page.waitForSelector('#view .gate-card[data-state="refused"]', { timeout: 45000 });
    await bothWidths('gate-stale-subject', async () => { await page.waitForSelector('#view .gate-card[data-state="refused"]', { timeout: 10000 }); });

    stage('gate: persistence failure');
    const g4 = await mint(page, 'g4', true);
    await openGate(page, g4.gate);
    const marker = path.join(roomV, '.mindrian', '.test-fault-gate-persist');
    fs.writeFileSync(marker, 'x');
    await primary(page).click();
    await page.waitForSelector('#view .gate-error .inline-error', { timeout: 45000 });
    await bothWidths('gate-persistence-failure', async () => { await page.waitForSelector('#view .gate-error .inline-error', { timeout: 10000 }); });
    try { fs.unlinkSync(marker); } catch (_e) { /* consumed */ }

    // ---- C10: reduced motion, in a second browser session signed in through the launcher again ----
    stage('reduced motion (C10)');
    const control = await (async () => {
      await go(page, '/');
      return page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    })();
    ctx2 = await newCtx({ reducedMotion: 'reduce' });
    const p2 = await ctx2.newPage();
    watch(p2);
    const link2 = startLink();
    await p2.goto(link2);
    await p2.waitForSelector('header.shell-header', { timeout: 45000 });
    assert.strictEqual(await p2.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches), true, 'the second context reports reduced motion');
    await openRoom(p2, 'room-v');
    const sample = async (where) => {
      const early = await C.runningAnimations(p2);
      await sleep(120);
      const later = await C.runningAnimations(p2);
      for (const a of early.concat(later)) V.C10.push('[' + where + '] running animation ' + a.name + ' on ' + a.path + ' (active duration ' + a.activeDuration + ' ms)');
    };
    await go(p2, '/');
    await sample('Work after load');
    await go(p2, '/evidence');
    await sample('Evidence after load');
    const g5 = await mint(p2, 'g5', true);
    await openGate(p2, g5.gate);
    await sample('gate after load');
    await primary(p2).click();
    await p2.waitForSelector('#view .gate-card[data-state="recorded"]', { timeout: 45000 });
    await sample('gate after the answer');
    const statusBox = await p2.locator('.gate-status').first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { w: r.width, h: r.height, top: r.top, opacity: cs.opacity, visibility: cs.visibility, text: el.textContent.replace(/\s+/g, ' ').trim() };
    });
    if (!(statusBox.w > 0 && statusBox.h > 0 && statusBox.opacity === '1' && statusBox.visibility === 'visible' && statusBox.text.length > 0)) {
      V.C10.push('the recorded status is not visible under reduced motion: ' + J(statusBox));
    }
    const sq = await p2.locator('.gate-status .sm[data-mark="square"]').count();
    if (sq !== 1) V.C10.push('the rust completion square is missing under reduced motion (' + sq + ')');
    NOTES.C10.push('control: ' + control + ' animation(s) running on Work without the preference; recorded status "' + statusBox.text + '" visible');
    await inspect(p2, 'reduced-motion-gate-recorded', 1280);

    // ---- C1, C6 over the whole capture ----
    const hostOf = (u) => { try { const x = new URL(u); return x.host || null; } catch (_e) { return null; } };
    const hosts = [];
    for (const r of requests) {
      const h = hostOf(r.url);
      if (h && !hosts.includes(h)) hosts.push(h);
    }
    for (const h of hosts) {
      if (!(h === '127.0.0.1' || h.indexOf('127.0.0.1:') === 0)) {
        const first = requests.find((r) => hostOf(r.url) === h);
        V.C1.push('request to ' + h + ' (' + first.type + ') ' + first.url.slice(0, 120));
      }
    }
    for (const r of requests) {
      if (!/^(data:|blob:|about:)/.test(r.url) && hostOf(r.url) === null) V.C1.push('request with no host: ' + r.url.slice(0, 100));
    }
    const eventSource = requests.filter((r) => r.type === 'eventsource').length;
    NOTES.C1.push(requests.length + ' requests (' + Object.keys(types).sort().map((k) => k + ' ' + types[k]).join(', ') + '); hosts: ' + hosts.join(', ') + '; iframes checked on ' + screens.length + ' screens');
    if (eventSource === 0) V.C1.push('the capture saw no EventSource request: the event-stream leg of C1 was not exercised');

    const fontReqs = requests.filter((r) => /\.woff2?(\?|$)/.test(r.url) || r.type === 'font');
    const fontHosts = [];
    for (const r of fontReqs) {
      const h = hostOf(r.url);
      if (h && !fontHosts.includes(h)) fontHosts.push(h);
    }
    for (const fam of FONT_FAMILIES) if (![...SEEN_FONTS].some((f) => f.toLowerCase().startsWith(fam.toLowerCase()))) V.C6.push(fam + ' never reported loaded in document.fonts (seen: ' + [...SEEN_FONTS].join(', ') + ')');
    if (fontReqs.length === 0) V.C6.push('no font file request was captured');
    for (const h of fontHosts) if (!(h === '127.0.0.1' || h.indexOf('127.0.0.1:') === 0)) V.C6.push('a font file came from ' + h);
    NOTES.C6.push([...SEEN_FONTS].sort().join(', ') + ' loaded; ' + fontReqs.length + ' font requests from ' + fontHosts.join(', '));

    NOTES.C3.push(screens.length + ' screen captures, every element and ::before ::after');
    NOTES.C4.push(screens.length + ' screen captures');
    NOTES.C5.push(runsMeasured + ' text runs measured' + (lowestContrast ? '; tightest margin ' + lowestContrast.ratio + ':1 against ' + lowestContrast.need + ':1 on [' + lowestContrast.label + '] ' + lowestContrast.path + ' "' + lowestContrast.text + '"' : ''));
    NOTES.C7.push('every [data-tile] on ' + screens.length + ' captures');
    NOTES.C8.push(screens.length + ' screen captures');
    NOTES.C9.push('computed colours checked on ' + screens.length + ' captures');

    for (const e of cspEvents) V.CSP.push(e);
    const badConsole = consoleErrors.filter((m) => !/Failed to load resource|net::ERR|ERR_CONNECTION|ERR_FAILED|the server responded with a status|EventSource|aborted|Failed to fetch|TypeError: Load failed/i.test(m));
    for (const m of badConsole) V.CSP.push('console error: ' + m.slice(0, 160));
    void step;
  } catch (err) {
    V.ENV.push('the walk stopped: ' + String((err && err.stack) || err).split('\n').slice(0, 6).join(' | '));
  } finally {
    await browser.close().catch(() => {});
    // Kill only what this run started: the shell through its own launcher, the daemon through the helper.
    try { cp.spawnSync(process.execPath, [LAUNCH, 'stop'], { env: launchEnv, encoding: 'utf8', timeout: 20000 }); } catch (_e) { /* best effort */ }
    await D.stopDaemon(daemon);
  }

  // ---- report ----
  const LABELS = {
    C1: 'egress: only 127.0.0.1, no outside iframe',
    C2: 'the built assets name no outside host',
    C3: 'radius 0 except the one circle',
    C4: 'ochre is never text, never a bare fill on paper',
    C5: 'contrast 4.5:1 body, 3:1 large',
    C6: 'four fonts bundled, loaded, served from 127.0.0.1',
    C7: 'tiles never carry a state alone',
    C8: 'one h1, one primary action, one circle, one triangle per screen',
    C9: 'every colour is a token',
    C10: 'reduced motion: nothing runs, the recorded status shows',
    C11: 'no em-dash or en-dash in the built strings',
  };
  let failed = 0;
  console.log('');
  for (let i = 1; i <= 11; i += 1) {
    const id = 'C' + i;
    if (V[id].length === 0) {
      console.log('PASS ' + id + ' ' + LABELS[id] + (NOTES[id].length ? ' [' + NOTES[id].join('; ') + ']' : ''));
    } else {
      failed += 1;
      console.log('FAIL ' + id + ' ' + LABELS[id] + ' (' + V[id].length + ' offender' + (V[id].length === 1 ? '' : 's') + ')');
      for (const line of V[id].slice(0, 25)) console.log('       ' + line);
      if (V[id].length > 25) console.log('       ... and ' + (V[id].length - 25) + ' more');
    }
  }
  if (V.CSP.length === 0) console.log('PASS CSP no Content-Security-Policy violation event and no unexpected console or page error');
  else {
    failed += 1;
    console.log('FAIL CSP ' + V.CSP.length + ' violation or console error');
    for (const line of V.CSP.slice(0, 10)) console.log('       ' + line);
  }
  if (V.ENV.length) {
    failed += 1;
    console.log('FAIL the walk could not finish');
    for (const line of V.ENV) console.log('       ' + line);
  }
  const shots = fs.existsSync(SHOTS) ? fs.readdirSync(SHOTS).filter((f) => /\.(png|jpg)$/.test(f)).length : 0;
  console.log('screenshots: ' + shots + ' in tests/e2e-369/output/screenshots/ (' + screens.filter((s) => s.width === 1280).length + ' screens at 1280 px, ' + screens.filter((s) => s.width === 390).length + ' at 390 px)');
  if (shots < 28) {
    failed += 1;
    console.log('FAIL fewer than 28 screenshots (' + shots + '): the walk has 14 screens at two widths');
  }
  const own = fs.readFileSync(__filename, 'utf8');
  if (own.includes(EM) || own.includes(EN)) {
    failed += 1;
    console.log('FAIL dash guard: this file carries a dash character');
  }
  console.log((failed ? failed + ' check(s) failed' : 'PASS: C1 through C11') + ' in ' + Math.round((Date.now() - t0) / 1000) + ' s');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL ' + String((err && err.stack) || err));
  process.exit(1);
});
