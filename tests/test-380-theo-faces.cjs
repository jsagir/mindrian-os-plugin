// 380-12 canon Theo faces gate (D-10, MOD380-09, T-380-46, T-380-47, T-380-48, T-380-50).
//
// The claim: the canon Theo face asset sits in ui/mos-face/assets byte for byte, nothing is
// hand-copied from it, and the fixture that the engine tests use equals what the canon renderer
// itself draws.
//
// Legs:
//   F1  the two copied files have the pinned sha256 values always, and are byte-identical to the
//       canon files in the book checkout when it is present (that part is skipped, with a note,
//       when the checkout is absent). A changed byte fails and says a recopy must be deliberate
//       and cited.
//   F2  the asset JSON holds exactly the 11 ids in order with the visible labels of the asset, a
//       non-empty source and a full pose for each.
//   F3  the poses embedded in the renderer asset equal the poses of the JSON.
//   F4  the fixture (tests/face-fixture.ts) holds the asset text and the attributes that the canon
//       renderer sets for each state: the generator --check passes, the fixture asset text equals
//       the asset file, and every state has the 9 records.
//   F5  no pose tuple (e1, e2, s, r) of the asset is written in a source file under
//       ui/mos-face/hooks. One legacy file is named and exempt until plan 380-13 removes it.
// CJS, Node built-ins only. Hermetic: no network, no write. Hyphens only.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const MOD = path.join(REPO, 'ui', 'mos-face');
const ASSETS = path.join(MOD, 'assets');
const HOOKS = path.join(MOD, 'hooks');
const BOOK = '/home/jsagi/mos-brand';
const CANON_DIR = path.join(BOOK, 'segments', 'identity', 'theo', 'entries', '2026-10-19');

const JSON_NAME = 'asset-fa8504998f.json';
const JS_NAME = 'asset-d96217b320.js';
const PINS = {
  [JSON_NAME]: 'e54e7c6a3c11a039059fb47833b09e865cd3981e2910b4f13571e87c06682da2',
  [JS_NAME]: '9ba50a842158058aabc91356eea3f12c7de0ade619c13c7b3ad1cc6b50ce0d75',
};
const IDS = ['rest', 'listen', 'search', 'found', 'challenge', 'contradiction', 'reframe', 'limit', 'decision', 'boundary', 'handover'];
const LABELS = ['Rest', 'Listening', 'Searching', 'Found', 'Challenge', 'Contradiction', 'Reframe', 'Nothing found', 'Your decision', 'Boundary', 'Handover'];
// Plan 380-13 removed the older drawn poses from hooks/face.ts, so no hook file is exempt from F5 any more.

let passed = 0;
let failed = 0;
function say(s) { process.stdout.write(s + '\n'); }
function check(cond, msg) {
  if (cond) { passed += 1; say('  ok ' + msg); } else { failed += 1; say('  FAIL ' + msg); }
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ---- F1 ------------------------------------------------------------------------------------
say('F1 hash');
const bookHere = fs.existsSync(path.join(CANON_DIR, JSON_NAME));
let bookHead = 'absent';
if (bookHere) {
  const r = spawnSync('git', ['-C', BOOK, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  bookHead = r.status === 0 ? r.stdout.trim() : 'unknown';
}
say('  note book checkout HEAD seen: ' + bookHead);
for (const name of [JSON_NAME, JS_NAME]) {
  const have = fs.readFileSync(path.join(ASSETS, name));
  check(sha(have) === PINS[name],
    name + ' sha256 equals the pin (a changed byte means a recopy; a recopy must be deliberate and cited to the book segment)');
  if (bookHere) {
    const canon = fs.readFileSync(path.join(CANON_DIR, name));
    check(Buffer.compare(have, canon) === 0, name + ' is byte-identical to the canon file in the book checkout');
    check(sha(canon) === PINS[name], name + ' canon file sha256 equals the pin');
  } else {
    say('  skip ' + name + ' byte comparison with the canon file (the book checkout is absent; the pinned hash above still ran)');
  }
}

// ---- F2 ------------------------------------------------------------------------------------
say('F2 structure');
const assetText = fs.readFileSync(path.join(ASSETS, JSON_NAME), 'utf8');
let asset = null;
try { asset = JSON.parse(assetText); } catch { asset = null; }
check(asset !== null, 'the asset parses as JSON');
const states = asset && Array.isArray(asset.states) ? asset.states : [];
check(states.length === 11, 'the asset holds 11 states (got ' + states.length + ')');
check(JSON.stringify(states.map((s) => s.id)) === JSON.stringify(IDS), 'the ids are the 11 canon ids in order');
check(JSON.stringify(states.map((s) => s.label)) === JSON.stringify(LABELS), 'the labels are the visible labels of the asset (Searching, Nothing found, Your decision and the rest)');
const isTuple = (v, n) => Array.isArray(v) && v.length === n && v.every((x) => typeof x === 'number' && Number.isFinite(x));
for (const s of states) {
  const p = s.pose || {};
  check(typeof s.source === 'string' && s.source.trim() !== '', s.id + ' has a non-empty source');
  check(isTuple(p.e1, 4) && isTuple(p.e2, 4) && isTuple(p.s, 5) && isTuple(p.r, 2)
    && typeof p.plane === 'string' && typeof p.c1 === 'string' && typeof p.c2 === 'string' && typeof p.hollow === 'boolean',
  s.id + ' has a full pose (e1, e2, s, r, plane, c1, c2, hollow)');
}

// ---- F3 ------------------------------------------------------------------------------------
say('F3 consistency of the renderer poses with the JSON');
const jsText = fs.readFileSync(path.join(ASSETS, JS_NAME), 'utf8');
const m = jsText.match(/const poses=(\{.*?\});const NS=/s);
let embedded = null;
try { embedded = m ? JSON.parse(m[1]) : null; } catch { embedded = null; }
check(embedded !== null, 'the poses object is found in the renderer asset and parses');
if (embedded) {
  check(JSON.stringify(Object.keys(embedded)) === JSON.stringify(IDS), 'the renderer holds the same 11 ids in order');
  for (const s of states) {
    const e = embedded[s.id];
    check(!!e && e.label === s.label && JSON.stringify(e.pose) === JSON.stringify(s.pose), s.id + ': renderer pose and label equal the JSON');
  }
}

// ---- F4 ------------------------------------------------------------------------------------
say('F4 renderer cross-check (fixture)');
const gen = spawnSync(process.execPath, [path.join(MOD, 'scripts', 'theo-faces.cjs'), '--check'], { encoding: 'utf8', timeout: 60000 });
check(gen.status === 0, 'theo-faces.cjs --check exits 0' + (gen.status === 0 ? '' : ': ' + (gen.stdout || '') + (gen.stderr || '')));
const fixText = fs.readFileSync(path.join(MOD, 'tests', 'face-fixture.ts'), 'utf8');
const lit = fixText.match(/export const ASSET_TEXT: string = (".*")\n/);
let fixAsset = null;
try { fixAsset = lit ? JSON.parse(lit[1]) : null; } catch { fixAsset = null; }
check(fixAsset === assetText, 'the fixture asset text equals the asset file text');
const canonLit = fixText.match(/export const CANON: Record<string, CanonRecord\[\]> = (\{[\s\S]*\})\n/);
let canonObj = null;
try { canonObj = canonLit ? JSON.parse(canonLit[1]) : null; } catch { canonObj = null; }
check(canonObj !== null && JSON.stringify(Object.keys(canonObj)) === JSON.stringify(IDS), 'the fixture CANON holds the 11 ids in order');
if (canonObj) {
  for (const id of IDS) {
    const names = (canonObj[id] || []).map((r) => r.part).join(',');
    check(names === 'ground,plane,vertical,horizontal,bar,barRect,one,two,frame', id + ': the fixture holds the 9 records in draw order');
  }
}
check(fixText.includes(sha(Buffer.from(assetText, 'utf8'))) && fixText.includes(sha(Buffer.from(jsText, 'utf8'))), 'the fixture header names the sha256 of both canon files');

// ---- F5 ------------------------------------------------------------------------------------
say('F5 no hand-copied pose numbers in the hooks');
const tupleRe = (t) => new RegExp('(?<![0-9.-])' + t.map((n) => String(n).replace('-', '\\-')).join('\\s*,\\s*') + '(?![0-9.])');
const hookFiles = fs.readdirSync(HOOKS).filter((f) => /\.(ts|tsx|cjs|js)$/.test(f));
check(hookFiles.includes('theo-face.ts') || !fs.existsSync(path.join(HOOKS, 'theo-face.ts')), 'the hooks folder lists its files');
let scanned = 0;
for (const f of hookFiles) {
  const text = fs.readFileSync(path.join(HOOKS, f), 'utf8');
  scanned += 1;
  const hits = [];
  for (const s of states) {
    for (const key of ['e1', 'e2', 's', 'r']) {
      if (tupleRe(s.pose[key]).test(text)) hits.push(s.id + '.' + key + ' [' + s.pose[key].join(',') + ']');
    }
  }
  check(hits.length === 0, 'hooks/' + f + ' holds no pose tuple' + (hits.length ? ' (found ' + hits.join('; ') + ')' : ''));
}
check(scanned >= 10, 'F5 scanned at least 10 hook files (got ' + scanned + ')');
// The scan can say yes: a planted tuple is found.
const probe = states[0] ? 'const x = [' + states[0].pose.e1.join(', ') + ']' : '';
check(states[0] !== undefined && tupleRe(states[0].pose.e1).test(probe), 'F5 self-test: a planted tuple is found by the scan');

say('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
