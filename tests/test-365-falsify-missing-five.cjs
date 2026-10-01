'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 365 Plan 03 Task 1 -- falsification test 3 (the missing five), as a
 * CHARACTERIZATION test.
 *
 * Property under test (365-INPUT.md "Property falsification tests", item 3):
 * claims cover items 1-4 and 6-7 of a continuous seven-item set (the days of a
 * seven-day weekly schedule, Friday never mentioned). Does any gap scan name
 * the missing item? Predicted FALSIFIED: the gap scans map the record, not the
 * world, so the scans cannot name what nobody wrote down.
 *
 * Scans driven (all read-only, all local):
 *   - lib/core/navigation/insights.cjs findUnsupportedClaims
 *   - lib/core/navigation/research-preflight.cjs getResearchPreflight (its
 *     evidence_gaps field)
 *   - scripts/analyze-room (the Section 1 gap lines)
 *
 * Characterization semantics: exit 0 while the observed outcome matches the
 * entry for key "missing_five" in tests/fixtures/365-falsification-record.json;
 * exit 1 with RECORD MISMATCH when it flips. The record is written only when
 * RECORD_365_FALSIFICATION=1 (T-365-12). No RED-365 token is ever printed here:
 * this is a recorded property of today's code, not a red 365 will heal (B4 is
 * blocked on the ladder).
 *
 * Exit codes: 0 match, 1 mismatch or error, 77 python3 or git unavailable.
 * No model, no Jev, no network. No em-dashes (CLAUDE.md HARD RULE).
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const guard = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RECORD_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '365-falsification-record.json');
const KEY = 'missing_five';
const PROPERTY = 'claims covering items 1-4 and 6-7 of a continuous seven-item set: does any gap scan name item 5';

function probeTool(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
if (!probeTool('python3', ['--version']) || !probeTool('git', ['--version'])) {
  console.log('ENV GAP: python3 or git unavailable; falsification test missing_five SKIPPED');
  process.exit(77);
}

const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const insights = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'insights.cjs'));
const preflight = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'research-preflight.cjs'));

// The continuous seven-item set: item 5 (Friday) is never written down anywhere.
const DAYS = [
  { n: 1, name: 'Monday', section: 'problem-definition' },
  { n: 2, name: 'Tuesday', section: 'problem-definition' },
  { n: 3, name: 'Wednesday', section: 'market-analysis' },
  { n: 4, name: 'Thursday', section: 'market-analysis' },
  // item 5 intentionally absent
  { n: 6, name: 'Saturday', section: 'solution-design' },
  { n: 7, name: 'Sunday', section: 'solution-design' },
];
const MISSING = 'friday';

function buildRoom(roomDir) {
  fs.mkdirSync(roomDir, { recursive: true });
  for (const d of DAYS) {
    const dir = path.join(roomDir, d.section);
    fs.mkdirSync(dir, { recursive: true });
    const body = '# ' + d.name + ' shift\n\n'
      + 'The weekly schedule runs continuously across seven days. Day ' + d.n
      + ' of the cycle is ' + d.name + ': the line runs two shifts and the crew rotates at noon.\n';
    fs.writeFileSync(path.join(dir, d.name.toLowerCase() + '.md'), body, 'utf8');
  }
  const db = openRoomDb(roomDir);
  try {
    for (const d of DAYS) {
      const res = navigation.writeClaimNode(db, {
        knowledge_type: 'fact',
        text: 'On ' + d.name + ' (day ' + d.n + ' of seven) the line runs two shifts.',
        sessionId: 'falsify-365-missing-five',
        sourceSegment: 'day-' + d.n,
      });
      assert.ok(res && res.ok === true, 'claim write failed: ' + JSON.stringify(res));
      const conf = navigation.confirmNode(db, res.node_id, 'navigator', 'fixture');
      assert.ok(conf && conf.ok === true, 'confirmNode failed: ' + JSON.stringify(conf));
    }
  } finally {
    closeRoomDb(db);
  }
}

function runScans(roomDir) {
  const db = openRoomDb(roomDir);
  let unsupported;
  let pre;
  try {
    unsupported = insights.findUnsupportedClaims(db, 'room:' + roomDir);
    pre = preflight.getResearchPreflight(db, { roomDir: roomDir });
  } finally {
    closeRoomDb(db);
  }
  const ar = spawnSync('bash', [path.join(REPO_ROOT, 'scripts', 'analyze-room'), roomDir], {
    encoding: 'utf8', timeout: 30000,
  });
  if (ar.error) throw ar.error;
  const arLines = String(ar.stdout || '').split('\n').filter((l) => l.length > 0);
  const gapLines = arLines.filter((l) => /^(GAP:|STRUCTURAL_GAP:)/.test(l));
  return {
    unsupportedText: JSON.stringify(unsupported),
    preflightGapText: JSON.stringify(pre.evidence_gaps),
    analyzeText: arLines.join('\n'),
    counts: {
      find_unsupported_claims: unsupported.length,
      preflight_evidence_gaps: pre.evidence_gaps.length,
      analyze_room_gap_lines: gapLines.length,
    },
    gapLines: gapLines,
  };
}

function observe() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-365-falsify-five-'));
  try {
    const roomDir = path.join(root, 'room');
    buildRoom(roomDir);
    const scans = runScans(roomDir);
    const re = new RegExp(MISSING, 'i');
    const named = {
      find_unsupported_claims: re.test(scans.unsupportedText),
      preflight_evidence_gaps: re.test(scans.preflightGapText),
      analyze_room: re.test(scans.analyzeText),
    };
    const anyNames = named.find_unsupported_claims || named.preflight_evidence_gaps || named.analyze_room;
    return {
      observed: anyNames ? 'NOT_FALSIFIED' : 'FALSIFIED',
      observed_detail: {
        missing_item: MISSING,
        scans_naming_missing_item: named,
        gap_counts: scans.counts,
        analyze_room_gap_lines: scans.gapLines,
      },
    };
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

function readRecord() {
  try { return JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8')); } catch (_e) { return null; }
}

function writeRecordEntry(entry) {
  let rec = readRecord();
  if (!rec || rec.schema !== 'mos.365-falsification-record/1') {
    rec = { schema: 'mos.365-falsification-record/1', base_sha: '', records: [] };
  }
  const base = process.env.RECORD_365_BASE_SHA;
  if (base) rec.base_sha = base;
  if (!rec.base_sha) {
    const g = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: REPO_ROOT });
    rec.base_sha = String(g.stdout || '').trim();
  }
  const idx = rec.records.findIndex((r) => r.test === KEY);
  if (idx >= 0) rec.records[idx] = entry; else rec.records.push(entry);
  fs.mkdirSync(path.dirname(RECORD_PATH), { recursive: true });
  fs.writeFileSync(RECORD_PATH, JSON.stringify(rec, null, 2) + '\n', 'utf8');
}

function main() {
  const obs = observe();
  assert.equal(guard.attempts(), 0, 'network attempted during missing_five');

  if (process.env.RECORD_365_FALSIFICATION === '1') {
    writeRecordEntry({
      test: KEY,
      property: PROPERTY,
      predicted: 'FALSIFIED',
      observed: obs.observed,
      observed_detail: obs.observed_detail,
      writers_driven: [
        'lib/core/navigation/insights.cjs findUnsupportedClaims',
        'lib/core/navigation/research-preflight.cjs getResearchPreflight evidence_gaps',
        'scripts/analyze-room Section 1 gap lines',
      ],
      recorded_at: new Date().toISOString(),
    });
    console.log('RECORDED ' + KEY + ': ' + obs.observed);
    return 0;
  }

  const rec = readRecord();
  const entry = rec && Array.isArray(rec.records) ? rec.records.find((r) => r.test === KEY) : null;
  if (!entry) {
    console.log('RECORD MISMATCH: no entry for ' + KEY + '; run with RECORD_365_FALSIFICATION=1 and update tests/fixtures/365-falsification-record.json with the navigator');
    return 1;
  }
  let flipped = null;
  if (entry.observed !== obs.observed) {
    flipped = 'observed ' + entry.observed + ' -> ' + obs.observed;
  } else {
    try {
      assert.deepEqual(obs.observed_detail, entry.observed_detail);
    } catch (_e) {
      flipped = 'observed_detail changed: now ' + JSON.stringify(obs.observed_detail);
    }
  }
  if (flipped) {
    console.log('RECORD MISMATCH: ' + flipped + '; update tests/fixtures/365-falsification-record.json with the navigator');
    return 1;
  }
  console.log(obs.observed === 'FALSIFIED' ? 'FALSIFIED (as predicted)' : 'MATCHES RECORD (' + obs.observed + ')');
  console.log('gap counts: ' + JSON.stringify(obs.observed_detail.gap_counts));
  return 0;
}

let code;
try {
  code = main();
} catch (e) {
  console.log('TEST ERROR: ' + (e && e.stack ? e.stack : e));
  code = 1;
}
process.exit(code);
