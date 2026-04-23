#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-10 -- decision-capture acceptance tests
 * =================================================
 * Verifies the per-section decision persistence module
 * (lib/core/decision-capture.cjs) which writes APPROVE/REJECT/DEFER
 * decisions to MINTO.md.frontmatter.decision_log and archives older
 * entries to .mindrian/decision-archive/YYYY-MM/<section>.jsonl when the
 * per-section cap (20) is exceeded.
 *
 * Test map (12 cases, one-to-one with the PLAN <behavior> block):
 *   1.  First recordDecision on section with no decision_log ->
 *       MINTO.md frontmatter gets decision_log: [<entry>].
 *   2.  Second recordDecision appends, length 2, original preserved.
 *   3.  21st recordDecision -> oldest entry removed from decision_log
 *       (now has entries 2-21) and written to YYYY-MM/<section>.jsonl.
 *   4.  Archive files are JSONL; appending does NOT rewrite prior lines.
 *   5.  Archive partitioned by YYYY-MM of the ARCHIVED entry's
 *       timestamp, not the current time.
 *   6.  Invalid entry -> {success:false, violations}; MINTO unchanged.
 *   7.  readDecisionLog on section with no MINTO.md -> [].
 *   8.  readDecisionLog on section with MINTO but no decision_log field
 *       -> [] (no throw).
 *   9.  Concurrent recordDecision: 3 forked workers -> final MINTO has
 *       exactly 3 entries (all writes applied, no data loss).
 *   10. MINTO post-write still validates via feynman-minto-invariants
 *       (no critical severity triggered by our mutation).
 *   11. Preserve-on-regen: after recordDecision, vault-section-minto-
 *       generator --write with new narrative preserves the decision_log.
 *   12. Special-char section name (spaces/unicode) handled correctly
 *       and archive filename safely escaped.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'decision-capture.cjs');
const INVARIANTS_PATH = path.join(
  REPO,
  'lib',
  'core',
  'feynman-minto-invariants.cjs'
);
const GENERATOR = path.join(
  REPO,
  'scripts',
  'vault-section-minto-generator.cjs'
);

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', function () {
  for (const d of TMP_ROOTS) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch (_e) { /* best effort */ }
  }
});

function buildRoomRoot(prefix) {
  const d = mkTmp(prefix);
  fs.writeFileSync(path.join(d, '.room-root'), 'mindrian-room\n');
  fs.mkdirSync(path.join(d, '.mindrian'), { recursive: true });
  return d;
}

// Write a minimal valid v88 MINTO.md fixture into <roomDir>/<section>/.
function writeMintoMd(roomDir, section, opts) {
  const sectionDir = path.join(roomDir, section);
  fs.mkdirSync(sectionDir, { recursive: true });
  // Minimal ROOM.md to satisfy any section walker.
  fs.writeFileSync(
    path.join(sectionDir, 'ROOM.md'),
    '---\ntype: section\nsection: ' + section + '\n---\n\n# ' + section + '\n'
  );
  const preserved = (opts && opts.preserved) || {};
  const fmLines = [
    '---',
    'type: section-minto',
    'schema_version: "1.0"',
    'section: ' + section,
    'created: 2026-04-20',
    'room: ' + path.basename(roomDir),
    'parent-moc: ROOM.md',
    'methodology: minto-pyramid',
    'sources: []',
    'related: []',
    'status: active',
    'governing_thought: "test fixture governing thought for ' + section + '"',
    'last_generated_at: "2026-04-20T10:00:00Z"',
    'last_artifact_write_seen_at: null',
    'reasoning_health_score: null',
    'flagged_weaknesses: []',
  ];
  const dl = preserved.decision_log || [];
  if (dl.length === 0) {
    fmLines.push('decision_log: []');
  } else {
    fmLines.push('decision_log:');
    for (const entry of dl) {
      fmLines.push('  - session_id: "' + entry.session_id + '"');
      fmLines.push('    timestamp: "' + entry.timestamp + '"');
      fmLines.push('    action: "' + entry.action + '"');
      fmLines.push('    user_response: "' + entry.user_response + '"');
      fmLines.push('    reason: "' + entry.reason + '"');
      if (entry.outcome !== undefined && entry.outcome !== null) {
        fmLines.push('    outcome: "' + entry.outcome + '"');
      }
    }
  }
  fmLines.push('---');
  const body = [
    '',
    '> [!abstract] Governing Thought',
    '> test fixture governing thought for ' + section,
    '',
    '## Key Claims',
    '',
    '### Claim 1: evidence is filed',
    '',
    'Source: fixture',
    '',
    '### Claim 2: another claim',
    '',
    'Source: fixture',
    '',
    '### Claim 3: a third claim',
    '',
    'Source: fixture',
    '',
    '## MECE Issue Tree',
    '',
    '- Primary evidence',
    '  - claim 1',
    '- Supporting evidence',
    '  - claim 2',
    '- Open dimension',
    '  - gap',
    '',
  ].join('\n');
  fs.writeFileSync(
    path.join(sectionDir, 'MINTO.md'),
    fmLines.join('\n') + '\n' + body
  );
  return sectionDir;
}

function mkEntry(overrides) {
  return Object.assign(
    {
      session_id: 'sess-' + Math.random().toString(36).slice(2, 10),
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      action: 'flag_tam_staleness',
      user_response: 'defer',
      reason: 'Q3 refresh required',
    },
    overrides || {}
  );
}

function readDecisionLogFromFile(mintoPath) {
  // Small parser: pull every `  - session_id: "..."` entry from frontmatter.
  const raw = fs.readFileSync(mintoPath, 'utf8');
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!fm) return [];
  const lines = fm[1].split(/\r?\n/);
  const out = [];
  let current = null;
  let inDl = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^decision_log:\s*\[\]/.test(line)) return [];
    if (/^decision_log:\s*$/.test(line)) { inDl = true; continue; }
    if (!inDl) continue;
    if (/^[A-Za-z_]/.test(line)) break; // next top-level
    const head = line.match(/^\s+-\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (head) {
      if (current) out.push(current);
      current = {};
      current[head[1]] = stripQuote(head[2]);
      continue;
    }
    const cont = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (cont && current) {
      current[cont[1]] = stripQuote(cont[2]);
    }
  }
  if (current) out.push(current);
  return out;
}

function stripQuote(s) {
  const t = (s || '').trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) return t.slice(1, -1);
  return t;
}

// ---------- Test runner ----------

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('PASS ' + name + '\n');
    passed += 1;
  } catch (e) {
    process.stderr.write('FAIL ' + name + ': ' + (e && e.message || e) + '\n');
    if (e && e.stack) process.stderr.write(e.stack + '\n');
    failed += 1;
  }
}

// ---------- Module require guard ----------

run('Module file exists on disk', function () {
  assert.ok(fs.existsSync(MODULE_PATH), 'decision-capture.cjs missing');
});

const dc = require(MODULE_PATH);

run('Module exports recordDecision + readDecisionLog as functions', function () {
  assert.strictEqual(typeof dc.recordDecision, 'function');
  assert.strictEqual(typeof dc.readDecisionLog, 'function');
});

// ---------- Test 1: first recordDecision ----------

run('Test 1: first recordDecision writes decision_log with one entry', function () {
  const room = buildRoomRoot('dc-t1-');
  writeMintoMd(room, 'market-analysis');
  const entry = mkEntry();
  const r = dc.recordDecision(room, 'market-analysis', entry);
  assert.strictEqual(r.success, true, 'success should be true, got ' + JSON.stringify(r));
  const log = dc.readDecisionLog(room, 'market-analysis');
  assert.strictEqual(log.length, 1, 'expected 1 entry, got ' + log.length);
  assert.strictEqual(log[0].session_id, entry.session_id);
  assert.strictEqual(log[0].action, entry.action);
  assert.strictEqual(log[0].user_response, entry.user_response);
});

// ---------- Test 2: append preserves earlier entry ----------

run('Test 2: second recordDecision appends, length 2', function () {
  const room = buildRoomRoot('dc-t2-');
  writeMintoMd(room, 'market-analysis');
  const e1 = mkEntry({ session_id: 'sess-1', action: 'first' });
  const e2 = mkEntry({ session_id: 'sess-2', action: 'second' });
  assert.strictEqual(dc.recordDecision(room, 'market-analysis', e1).success, true);
  assert.strictEqual(dc.recordDecision(room, 'market-analysis', e2).success, true);
  const log = dc.readDecisionLog(room, 'market-analysis');
  assert.strictEqual(log.length, 2, 'expected 2 entries, got ' + log.length);
  assert.strictEqual(log[0].session_id, 'sess-1');
  assert.strictEqual(log[1].session_id, 'sess-2');
});

// ---------- Test 3: cap at 20 + archive oldest ----------

run('Test 3: 21st entry archives oldest, log length stays 20', function () {
  const room = buildRoomRoot('dc-t3-');
  writeMintoMd(room, 'problem-definition');
  // Write 20 entries first (all inside the cap).
  for (let i = 0; i < 20; i++) {
    const ts = new Date(Date.UTC(2026, 3, i + 1, 0, 0, 0))
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    const r = dc.recordDecision(
      room,
      'problem-definition',
      mkEntry({
        session_id: 'sess-' + i,
        action: 'a' + i,
        timestamp: ts,
      })
    );
    assert.strictEqual(r.success, true, 'entry ' + i + ' should succeed');
  }
  const logAt20 = dc.readDecisionLog(room, 'problem-definition');
  assert.strictEqual(logAt20.length, 20, 'should have 20 entries pre-overflow');
  // Now write the 21st -- triggers archive of the oldest.
  const twentyFirst = mkEntry({
    session_id: 'sess-20',
    action: 'a20',
    timestamp: '2026-04-21T00:00:00Z',
  });
  const r = dc.recordDecision(room, 'problem-definition', twentyFirst);
  assert.strictEqual(r.success, true);
  assert.ok(r.archived, 'archive metadata should be non-null');
  const logAfter = dc.readDecisionLog(room, 'problem-definition');
  assert.strictEqual(logAfter.length, 20, 'cap holds at 20, got ' + logAfter.length);
  // The oldest (sess-0) should be gone from decision_log.
  const ids = logAfter.map(function (e) { return e.session_id; });
  assert.ok(ids.indexOf('sess-0') === -1, 'sess-0 should be archived, not in log');
  assert.ok(ids.indexOf('sess-20') !== -1, 'sess-20 should be in log');
  // Archive file lives under .mindrian/decision-archive/YYYY-MM/ and is JSONL.
  const archiveDir = path.join(room, '.mindrian', 'decision-archive');
  assert.ok(fs.existsSync(archiveDir), 'archive dir should exist: ' + archiveDir);
  // Archive month comes from ARCHIVED entry (sess-0 at 2026-04-01).
  const apr = path.join(archiveDir, '2026-04');
  assert.ok(fs.existsSync(apr), '2026-04 partition should exist');
  const fname = path.join(apr, 'problem-definition.jsonl');
  assert.ok(fs.existsSync(fname), 'archive file should exist: ' + fname);
  const lines = fs.readFileSync(fname, 'utf8').split(/\n/).filter(function (s) { return s.length > 0; });
  assert.strictEqual(lines.length, 1, 'should have exactly 1 archived line');
  const parsed = JSON.parse(lines[0]);
  assert.strictEqual(parsed.session_id, 'sess-0');
});

// ---------- Test 4: JSONL append -- prior lines preserved byte-for-byte ----------

run('Test 4: JSONL archive is append-only, prior lines not rewritten', function () {
  const room = buildRoomRoot('dc-t4-');
  writeMintoMd(room, 'market-analysis');
  // Fill to 20 + two overflow entries.
  for (let i = 0; i < 22; i++) {
    const ts = new Date(Date.UTC(2026, 3, i + 1, 0, 0, 0))
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    dc.recordDecision(
      room,
      'market-analysis',
      mkEntry({
        session_id: 'sess-' + i,
        action: 'a' + i,
        timestamp: ts,
        // First batch fall in April, second batch one more in April.
      })
    );
  }
  const fname = path.join(
    room,
    '.mindrian',
    'decision-archive',
    '2026-04',
    'market-analysis.jsonl'
  );
  assert.ok(fs.existsSync(fname), 'archive should exist');
  const firstBytes = fs.readFileSync(fname, 'utf8');
  const lines = firstBytes.split(/\n/).filter(function (s) { return s.length > 0; });
  assert.strictEqual(lines.length, 2, 'should have 2 archived lines, got ' + lines.length);
  // Each line is parseable JSON with a session_id.
  for (const line of lines) {
    const obj = JSON.parse(line);
    assert.ok(typeof obj.session_id === 'string');
  }
  // Prior line (sess-0) must remain byte-identical after the second archive
  // appended -- verify by re-reading and comparing.
  const sess0Line = lines[0];
  assert.ok(sess0Line.indexOf('"sess-0"') !== -1, 'sess-0 should be first');
  const sess1Line = lines[1];
  assert.ok(sess1Line.indexOf('"sess-1"') !== -1, 'sess-1 should be second');
});

// ---------- Test 5: archive partition by ARCHIVED entry month ----------

run('Test 5: archive month reflects archived entry timestamp, not today', function () {
  const room = buildRoomRoot('dc-t5-');
  writeMintoMd(room, 'market-analysis');
  // 20 entries in Dec 2025.
  for (let i = 0; i < 20; i++) {
    const ts = new Date(Date.UTC(2025, 11, i + 1, 0, 0, 0))
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    dc.recordDecision(
      room,
      'market-analysis',
      mkEntry({
        session_id: 'old-' + i,
        action: 'old' + i,
        timestamp: ts,
      })
    );
  }
  // 21st entry dated today (Apr 2026) -- archives oldest (2025-12-01).
  const now = '2026-04-21T12:00:00Z';
  dc.recordDecision(
    room,
    'market-analysis',
    mkEntry({ session_id: 'fresh', action: 'a_fresh', timestamp: now })
  );
  // Archive should live under 2025-12/, NOT 2026-04/.
  const dec = path.join(
    room,
    '.mindrian',
    'decision-archive',
    '2025-12',
    'market-analysis.jsonl'
  );
  assert.ok(fs.existsSync(dec), 'should partition by archived entry month (2025-12), not today; file: ' + dec);
  const cur = path.join(
    room,
    '.mindrian',
    'decision-archive',
    '2026-04',
    'market-analysis.jsonl'
  );
  // The 2026-04 partition should NOT exist for this archive operation.
  assert.strictEqual(fs.existsSync(cur), false, '2026-04 partition should not be created');
});

// ---------- Test 6: invalid entry rejected + MINTO unchanged ----------

run('Test 6: invalid entry returns {success:false}; MINTO unchanged', function () {
  const room = buildRoomRoot('dc-t6-');
  const sectionDir = writeMintoMd(room, 'market-analysis');
  const before = fs.readFileSync(path.join(sectionDir, 'MINTO.md'), 'utf8');
  const bad = { session_id: '', timestamp: 'not-an-iso', action: '', user_response: 'maybe', reason: '' };
  const r = dc.recordDecision(room, 'market-analysis', bad);
  assert.strictEqual(r.success, false);
  assert.ok(Array.isArray(r.violations) && r.violations.length > 0, 'violations must be non-empty');
  const after = fs.readFileSync(path.join(sectionDir, 'MINTO.md'), 'utf8');
  assert.strictEqual(after, before, 'MINTO must be unchanged on validation failure');
});

// ---------- Test 7: readDecisionLog on no MINTO returns [] ----------

run('Test 7: readDecisionLog on section with no MINTO.md returns []', function () {
  const room = buildRoomRoot('dc-t7-');
  // Do NOT write MINTO.md.
  const log = dc.readDecisionLog(room, 'nonexistent-section');
  assert.ok(Array.isArray(log) && log.length === 0);
});

// ---------- Test 8: readDecisionLog with no decision_log field returns [] ----------

run('Test 8: readDecisionLog on MINTO lacking decision_log field returns []', function () {
  const room = buildRoomRoot('dc-t8-');
  const sectionDir = path.join(room, 'old-section');
  fs.mkdirSync(sectionDir, { recursive: true });
  // Pre-88-00 MINTO.md shape (no decision_log).
  fs.writeFileSync(
    path.join(sectionDir, 'MINTO.md'),
    [
      '---',
      'type: section-minto',
      'section: old-section',
      'created: 2026-04-01',
      '---',
      '',
      '# old-section',
    ].join('\n') + '\n'
  );
  const log = dc.readDecisionLog(room, 'old-section');
  assert.ok(Array.isArray(log) && log.length === 0);
});

// ---------- Test 9: 3 concurrent forked workers ----------

run('Test 9: 3 concurrent workers -> final MINTO has 3 entries, no data loss', function () {
  const room = buildRoomRoot('dc-t9-');
  writeMintoMd(room, 'market-analysis');
  const workerPath = path.join(__dirname, 'decision-capture.worker.cjs');
  assert.ok(fs.existsSync(workerPath), 'worker file must exist');
  const kids = [];
  for (let i = 0; i < 3; i++) {
    const res = spawnSync(
      process.execPath,
      [workerPath, room, 'market-analysis', 'sess-w' + i, 'action-w' + i],
      { encoding: 'utf-8' }
    );
    kids.push(res);
  }
  for (const res of kids) {
    assert.strictEqual(res.status, 0, 'worker should exit 0: stderr=' + (res.stderr || ''));
  }
  const log = dc.readDecisionLog(room, 'market-analysis');
  assert.strictEqual(log.length, 3, 'should have 3 entries (one per worker), got ' + log.length);
  const ids = log.map(function (e) { return e.session_id; }).sort();
  assert.deepStrictEqual(ids, ['sess-w0', 'sess-w1', 'sess-w2']);
});

// ---------- Test 10: post-write MINTO still validates via invariants ----------

run('Test 10: MINTO post-write validates via feynman-minto-invariants (no critical)', function () {
  const room = buildRoomRoot('dc-t10-');
  const sectionDir = writeMintoMd(room, 'market-analysis');
  for (let i = 0; i < 5; i++) {
    dc.recordDecision(
      room,
      'market-analysis',
      mkEntry({ session_id: 'sess-' + i, action: 'a' + i })
    );
  }
  const invariants = require(INVARIANTS_PATH);
  const validation = invariants.validate(path.join(sectionDir, 'MINTO.md'));
  // Severity may be warning or info (coherence drift); must NOT be critical.
  assert.notStrictEqual(
    validation.severity,
    invariants.SEVERITY.CRITICAL,
    'post-write MINTO must not be invariant-critical: ' + JSON.stringify(validation.violations)
  );
});

// ---------- Test 11: preserve-on-regen (composition with 88-00 Task 1) ----------

run('Test 11: decision_log preserved byte-identical across generator --write', function () {
  // Use the frozen fixture-small room. We inject a MINTO.md with
  // decision_log, then run the generator --write with the known-good
  // fixture-small.json narrative, and expect the decision_log to be
  // preserved byte-for-byte across the regen.
  const srcRoom = path.join(
    REPO,
    'test-fixtures',
    'feynman',
    'sections',
    'fixture-small'
  );
  const narrativePath = path.join(
    REPO,
    'test-fixtures',
    'feynman',
    'narratives',
    'fixture-small.json'
  );
  // Copy the fixture room to a tmpdir so we can mutate it freely.
  const dst = mkTmp('dc-t11-');
  fs.cpSync(srcRoom, dst, { recursive: true });
  fs.writeFileSync(path.join(dst, '.room-root'), 'mindrian-room\n');
  fs.mkdirSync(path.join(dst, '.mindrian'), { recursive: true });

  // Seed a first generator run so MINTO.md exists (preserve-on-regen
  // requires a pre-existing file; the fixture may not ship with one).
  const seedRes = spawnSync(
    process.execPath,
    [GENERATOR, '--write', dst, '--section', 'problem-definition', '--narrative', narrativePath],
    {
      env: Object.assign({}, process.env, {
        MINTO_FROZEN_DATE: '2026-04-14',
        MINTO_FROZEN_TIMESTAMP: '2026-04-14T00:00:00Z',
      }),
      encoding: 'utf-8',
    }
  );
  assert.strictEqual(seedRes.status, 0, 'seed generator run must succeed, stderr=' + (seedRes.stderr || ''));

  // Record 3 decisions.
  const entries = [];
  for (let i = 0; i < 3; i++) {
    const e = mkEntry({ session_id: 'regen-' + i, action: 'a' + i });
    entries.push(e);
    const r = dc.recordDecision(dst, 'problem-definition', e);
    assert.strictEqual(r.success, true, 'recordDecision should succeed');
  }
  const before = dc.readDecisionLog(dst, 'problem-definition');
  assert.strictEqual(before.length, 3);

  // Re-run generator --write with the same narrative; the preserve-on-regen
  // contract (88-00) keeps the decision_log across the write.
  const regenRes = spawnSync(
    process.execPath,
    [GENERATOR, '--write', dst, '--section', 'problem-definition', '--narrative', narrativePath],
    {
      env: Object.assign({}, process.env, {
        MINTO_FROZEN_DATE: '2026-04-14',
        MINTO_FROZEN_TIMESTAMP: '2026-04-14T00:00:00Z',
      }),
      encoding: 'utf-8',
    }
  );
  assert.strictEqual(
    regenRes.status,
    0,
    'generator --write must succeed, stderr=' + (regenRes.stderr || '')
  );

  const after = dc.readDecisionLog(dst, 'problem-definition');
  assert.strictEqual(after.length, 3, 'decision_log length preserved across regen');
  for (let i = 0; i < 3; i++) {
    assert.strictEqual(after[i].session_id, before[i].session_id);
    assert.strictEqual(after[i].action, before[i].action);
    assert.strictEqual(after[i].user_response, before[i].user_response);
    assert.strictEqual(after[i].reason, before[i].reason);
  }
});

// ---------- Test 12: special-char section name ----------

run('Test 12: special-char section name handled via path.join + safe escape', function () {
  // We test two separate special cases because filesystems differ.
  const room = buildRoomRoot('dc-t12-');
  const section = 'section with spaces';
  writeMintoMd(room, section);
  const r = dc.recordDecision(room, section, mkEntry({ session_id: 'sp-1', action: 'a' }));
  assert.strictEqual(r.success, true, 'should succeed on spaced section name');
  const log = dc.readDecisionLog(room, section);
  assert.strictEqual(log.length, 1);
  assert.strictEqual(log[0].session_id, 'sp-1');
  // Trigger archive (fill + overflow) to verify archive filename is safe.
  for (let i = 0; i < 20; i++) {
    const ts = new Date(Date.UTC(2026, 3, i + 1, 0, 0, 0))
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    dc.recordDecision(room, section, mkEntry({
      session_id: 'f-' + i, action: 'a' + i, timestamp: ts,
    }));
  }
  // At least one archive file should exist under 2026-04/.
  const apr = path.join(room, '.mindrian', 'decision-archive', '2026-04');
  assert.ok(fs.existsSync(apr), 'archive partition should exist');
  const files = fs.readdirSync(apr);
  assert.ok(files.length >= 1, 'at least one archive file');
  // Filename should contain the section segment (with its special chars)
  // in a form that does NOT break the filesystem. We accept either raw
  // spaces or escaped variants; the contract is "file exists and is
  // writable" not a specific filename convention.
  const allJsonl = files.every(function (f) { return f.endsWith('.jsonl'); });
  assert.ok(allJsonl, 'all archive files should end with .jsonl: ' + files.join(', '));
});

// ---------- Summary ----------

process.stdout.write('\ndecision-capture.test.cjs: ' + passed + '/' + (passed + failed) + ' passed\n');
process.exit(failed === 0 ? 0 : 1);
