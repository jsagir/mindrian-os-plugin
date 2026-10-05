#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 01 (FZERO-02): the Phase 0 status table and its raw fixtures stay together.
 *
 * WHY THIS TEST EXISTS. 369.25-PHASE0-STATUS.md names six measured rows (R1 to R6). Each row cites a fixture folder
 * under .planning/phases/369.25-.../fixtures/phase0/ holding the exact command (cmd.txt) and the raw output. This
 * test fails when a row loses its fixture, a fixture JSON stops parsing, a row's Status cell leaves the four-word
 * legend, or the files gain an em dash or en dash. It reads only files; it measures nothing and writes nothing.
 *
 * .planning/ is not shipped to a user's install, so the test Skips (with the reason named) when the phase directory
 * is absent instead of failing a checkout that does not carry it.
 *
 * Arms: one per row (R1 to R6), then the status table (six IDs, legal Status words), the fixture builder, the dash guard.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PHASE = path.join(ROOT, '.planning', 'phases', '369.25-feyminto-and-room-identity-spoken-369-3a-the-one-authority-p');
const FIX = path.join(PHASE, 'fixtures', 'phase0');
const STATUS = path.join(PHASE, '369.25-PHASE0-STATUS.md');
const BUILDER = path.join(ROOT, 'tests', 'fixtures', 'never-ready-room', 'build-fixture.cjs');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const LEGEND = ['reproduced', 'fixed', 'obsolete', 'needs evidence'];

let passed = 0;
let failed = 0;
let skipped = 0;
class Skip extends Error {}
function arm(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    if (e instanceof Skip) { skipped += 1; console.log('SKIP ' + name + ': ' + e.message); return; }
    failed += 1;
    console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }

const HAVE_PHASE = fs.existsSync(STATUS) && fs.existsSync(FIX);
function needPhase() { if (!HAVE_PHASE) throw new Skip('the 369.25 phase directory is not in this checkout (.planning/ is not shipped)'); }

function jsonFilesUnder(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsonFilesUnder(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

// the files each row must carry, beyond cmd.txt and every .json parsing
const ROWS = {
  'R1-referrers': ['referrers.json', 'referrers-summary.txt'],
  'R2-slug-identity-version': ['head-room-db.json', 'slug-identity-versions.txt'],
  'R3-never-ready': ['timeline.json', 'step1-post-write.txt', 'step3-on-stop.txt', 'step4a-session-start.txt', 'step5a-backfill-no-approval.json', 'step5b-backfill-approved-empty-allowlist.json', 'step6-room-db-creator-probes.json', 'lead1-callers.txt'],
  'R4-walk-before': ['icm-walk-before-a.json', 'icm-walk-before-b.json', 'before-rows.json'],
  'R5-brain-no-signal': ['brain-no-signal.txt', 'brain-raw.txt', 'listing-before.txt', 'listing-after.txt'],
  'R6-three-source-diff': ['three-source-diff.json'],
};

Object.keys(ROWS).forEach((row) => {
  arm(row + ' fixture folder, cmd.txt, named files present and every .json parses', () => {
    needPhase();
    const dir = path.join(FIX, row);
    check(fs.existsSync(dir), 'missing folder ' + dir);
    check(fs.existsSync(path.join(dir, 'cmd.txt')), row + ' has no cmd.txt');
    ROWS[row].forEach((f) => check(fs.existsSync(path.join(dir, f)), row + ' is missing ' + f));
    jsonFilesUnder(dir).forEach((f) => {
      try { JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(path.relative(FIX, f) + ' does not parse: ' + e.message); }
    });
  });
});

arm('R1 referrers.json has one entry per referrer file and the summary states the three counts and the delta', () => {
  needPhase();
  const r = JSON.parse(fs.readFileSync(path.join(FIX, 'R1-referrers', 'referrers.json'), 'utf8'));
  check(Array.isArray(r) && r.length > 0, 'referrers.json is not a non-empty array');
  ['MINTO', 'FEYNMAN', 'BRAIN'].forEach((face) => check(r.some((x) => x.face === face), 'no entries for ' + face));
  r.forEach((x) => check(['reader', 'writer', 'both', 'mention'].includes(x.role), x.path + ' has role ' + x.role));
  const s = fs.readFileSync(path.join(FIX, 'R1-referrers', 'referrers-summary.txt'), 'utf8');
  ['MINTO.md:', 'FEYNMAN.md:', 'BRAIN.md:'].forEach((k) => check(s.includes(k) && /delta -?\d+/.test(s), 'summary lacks ' + k + ' or a delta'));
});

arm('status table names R1 to R6 once each with a Status cell from the four-word legend', () => {
  needPhase();
  const lines = fs.readFileSync(STATUS, 'utf8').split('\n').filter((l) => /^\| R[1-6] /.test(l));
  check(lines.length === 6, 'expected 6 table rows, found ' + lines.length);
  ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'].forEach((id) => {
    const rows = lines.filter((l) => l.startsWith('| ' + id + ' '));
    check(rows.length === 1, id + ' appears ' + rows.length + ' times');
    const cells = rows[0].split('|').map((c) => c.trim());
    check(LEGEND.includes(cells[3]), id + ' Status cell "' + cells[3] + '" is not one of ' + LEGEND.join(' / '));
    check(cells[5].indexOf('R' + id.slice(1) + '-') === 0 || cells[5].indexOf('`R' + id.slice(1) + '-') === 0, id + ' fixture cell does not cite its folder');
  });
});

arm('the never-ready fixture builder exists and builds 11 artifacts in a temp dir, nothing outside it', () => {
  check(fs.existsSync(BUILDER), 'missing ' + BUILDER);
  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-nrr-'));
  try {
    const { buildNeverReadyRoom } = require(BUILDER);
    const r = buildNeverReadyRoom(tmp, { slug: 'never-ready-fixture' });
    check(r.artifacts.length === 11, 'expected 11 artifacts, got ' + r.artifacts.length);
    check(r.artifacts.every((f) => fs.existsSync(f) && f.startsWith(tmp)), 'an artifact is missing or outside the target');
    check(!fs.existsSync(path.join(r.roomDir, '.mindrian', 'room.db')), 'the fixture must have no room.db');
    check(fs.existsSync(path.join(r.roomDir, '.room-root')), 'the fixture must carry a .room-root sentinel');
    let refused = false;
    try { buildNeverReadyRoom(path.join(os.homedir(), 'MindrianRooms', 'p0-should-refuse')); } catch (_e) { refused = true; }
    check(refused, 'a target under ~/MindrianRooms must be refused');
    check(!fs.existsSync(path.join(os.homedir(), 'MindrianRooms', 'p0-should-refuse')), 'the refused target was created');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

arm('dash guard: no em dash or en dash in the status file, every fixture file, the builder or this test', () => {
  const files = [BUILDER, __filename];
  if (HAVE_PHASE) {
    files.push(STATUS);
    (function walk(dir) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p); else files.push(p);
      });
    })(FIX);
  }
  files.forEach((f) => {
    const t = fs.readFileSync(f, 'utf8');
    check(t.indexOf(EM) === -1 && t.indexOf(EN) === -1, 'a dash character is in ' + path.relative(ROOT, f));
  });
});

console.log('\n369.25 Phase 0 fixtures: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
process.exit(failed === 0 ? 0 : 1);
