'use strict';
/*
 * Phase 117-01 Wave 1 -- real assertions for explored-materials-store.cjs.
 * Replaces the Phase 117-00 Wave 0 stub (which only verified EVENT_TYPES).
 *
 * Tests (15 real assertions):
 *  1.  computeMaterialId determinism (same inputs -> same 32-char hex)
 *  2.  computeMaterialId second-precision (mtime within same second yields same id)
 *  3.  appendMaterial creates JSONL file + appends one line + newline
 *  4.  readMaterials applies LWW (3 appends with same material_id -> ARRAY size 1)
 *  5.  findLatest returns most-recent entry by fired_at
 *  6.  markCompleted appends transition entry (state=completed, finding_count=3)
 *  7.  markFailed appends transition entry (state=failed, suppress_reason)
 *  8.  sweepStaleInFlight transitions stale entries to failed
 *  9.  validateEntryShape rejects USER_CONTENT_KEY_DENYLIST keys
 * 10.  readMaterials('non-existent-slug') returns []
 * 11.  Corrupt JSONL line silently skipped
 * 12.  jsonlPath uses os.homedir() (NOT plugin repo cwd)
 * 13.  Module does NOT call console.log or process.stdout.write
 * 14.  Module does NOT require room-db.cjs
 * 15.  Module does NOT require any brain-client module
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const store = require('../lib/memory/explored-materials-store.cjs');

// Per-test temp slug to avoid stepping on real user data.
function freshSlug() {
  return 'phase-117-01-test-' + process.pid + '-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8);
}

function cleanup(slug) {
  try { fs.rmSync(store.jsonlPath(slug), { force: true }); } catch (_e) { /* tolerate */ }
}

// 1. computeMaterialId determinism
test('computeMaterialId is deterministic across runs', () => {
  const a = store.computeMaterialId('/abs/room', 'problem-definition/cv.md', 1746543210123);
  const b = store.computeMaterialId('/abs/room', 'problem-definition/cv.md', 1746543210123);
  assert.equal(a, b);
  assert.equal(a.length, 32);
  assert.match(a, /^[0-9a-f]{32}$/);
});

// 2. Second-precision per RESEARCH Section 4.5
test('computeMaterialId floors mtime to seconds', () => {
  const a = store.computeMaterialId('/abs/room', 'cv.md', 1746543210123);
  const b = store.computeMaterialId('/abs/room', 'cv.md', 1746543210999);
  const c = store.computeMaterialId('/abs/room', 'cv.md', 1746543211000);
  assert.equal(a, b, 'same second -> same id');
  assert.notEqual(a, c, 'different second -> different id');
});

// 3. appendMaterial creates JSONL + appends line
test('appendMaterial creates JSONL file under os.homedir() and appends', () => {
  const slug = freshSlug();
  try {
    const matId = store.computeMaterialId('/abs/room', 'cv.md', 1746543210000);
    const r = store.appendMaterial(slug, {
      material_id: matId,
      file_path_sha256: '9f8a000000000000',
      relative_file_path: 'cv.md',
      mtime_seconds: 1746543210,
      fired_at: 1746543220000,
      state: 'queued',
      finding_count: null,
      surfaced: false,
      user_response: null,
      responded_at: null,
      suppress_reason: null,
      in_flight_since: null,
    });
    assert.equal(r.ok, true);
    assert.ok(fs.existsSync(r.path));
    const raw = fs.readFileSync(r.path, 'utf8');
    assert.ok(raw.endsWith('\n'));
    assert.equal(raw.split('\n').filter(Boolean).length, 1);
  } finally {
    cleanup(slug);
  }
});

// 4. LWW replay: 3 appends with same material_id => ARRAY of size 1
test('readMaterials applies LWW replay by material_id', () => {
  const slug = freshSlug();
  try {
    const matId = store.computeMaterialId('/abs/room', 'cv.md', 1746543210000);
    const baseEntry = {
      material_id: matId,
      file_path_sha256: '9f8a000000000000',
      relative_file_path: 'cv.md',
      mtime_seconds: 1746543210,
      fired_at: 1746543220000,
      state: 'queued',
      finding_count: null,
      surfaced: false,
      user_response: null,
      responded_at: null,
      suppress_reason: null,
      in_flight_since: null,
    };
    store.appendMaterial(slug, baseEntry);
    store.appendMaterial(slug, Object.assign({}, baseEntry, { state: 'in_flight', in_flight_since: 1746543221000, fired_at: 1746543221000 }));
    store.appendMaterial(slug, Object.assign({}, baseEntry, { state: 'completed', finding_count: 3, fired_at: 1746543222000 }));
    const all = store.readMaterials(slug);
    assert.equal(all.length, 1, 'LWW collapses to 1 entry per material_id');
    assert.equal(all[0].state, 'completed');
    assert.equal(all[0].finding_count, 3);
  } finally {
    cleanup(slug);
  }
});

// 5. findLatest returns most-recent by fired_at
test('findLatest returns most-recent entry per material_id', () => {
  const slug = freshSlug();
  try {
    const matId = store.computeMaterialId('/abs/room', 'cv.md', 1746543210000);
    const baseEntry = {
      material_id: matId,
      file_path_sha256: '9f8a000000000000',
      relative_file_path: 'cv.md',
      mtime_seconds: 1746543210,
      fired_at: 1000,
      state: 'queued',
      finding_count: null,
      surfaced: false,
      user_response: null,
      responded_at: null,
      suppress_reason: null,
      in_flight_since: null,
    };
    store.appendMaterial(slug, Object.assign({}, baseEntry, { fired_at: 1000 }));
    store.appendMaterial(slug, Object.assign({}, baseEntry, { fired_at: 5000, state: 'completed' }));
    store.appendMaterial(slug, Object.assign({}, baseEntry, { fired_at: 3000, state: 'in_flight' }));
    const latest = store.findLatest(slug, matId);
    assert.ok(latest);
    assert.equal(latest.fired_at, 5000);
    assert.equal(latest.state, 'completed');
    assert.equal(store.findLatest(slug, '0'.repeat(32)), null);
  } finally {
    cleanup(slug);
  }
});

// 6. markCompleted
test('markCompleted appends transition with finding_count', () => {
  const slug = freshSlug();
  try {
    const matId = store.computeMaterialId('/abs/room', 'cv.md', 1746543210000);
    store.appendMaterial(slug, {
      material_id: matId,
      file_path_sha256: '9f8a000000000000',
      relative_file_path: 'cv.md',
      mtime_seconds: 1746543210,
      fired_at: 1000,
      state: 'in_flight',
      finding_count: null,
      surfaced: false,
      user_response: null,
      responded_at: null,
      suppress_reason: null,
      in_flight_since: 999,
    });
    const r = store.markCompleted(slug, matId, { finding_count: 3 });
    assert.equal(r.ok, true);
    const latest = store.findLatest(slug, matId);
    assert.equal(latest.state, 'completed');
    assert.equal(latest.finding_count, 3);
    assert.equal(latest.in_flight_since, null);
  } finally {
    cleanup(slug);
  }
});

// 7. markFailed
test('markFailed appends transition with suppress_reason', () => {
  const slug = freshSlug();
  try {
    const matId = store.computeMaterialId('/abs/room', 'cv.md', 1746543210000);
    const r = store.markFailed(slug, matId, 'all_pipelines_empty');
    assert.equal(r.ok, true);
    const latest = store.findLatest(slug, matId);
    assert.equal(latest.state, 'failed');
    assert.equal(latest.suppress_reason, 'all_pipelines_empty');
    // Invalid suppress reason rejected
    const bad = store.markFailed(slug, matId, 'not_a_real_reason');
    assert.equal(bad.ok, false);
  } finally {
    cleanup(slug);
  }
});

// 8. sweepStaleInFlight (5min stale)
test('sweepStaleInFlight transitions stale in_flight entries to failed', () => {
  const slug = freshSlug();
  try {
    const matId = store.computeMaterialId('/abs/room', 'cv.md', 1746543210000);
    const sixMinAgo = Date.now() - (6 * 60 * 1000);
    store.appendMaterial(slug, {
      material_id: matId,
      file_path_sha256: '9f8a000000000000',
      relative_file_path: 'cv.md',
      mtime_seconds: 1746543210,
      fired_at: sixMinAgo,
      state: 'in_flight',
      finding_count: null,
      surfaced: false,
      user_response: null,
      responded_at: null,
      suppress_reason: null,
      in_flight_since: sixMinAgo,
    });
    const r = store.sweepStaleInFlight(slug, { staleMs: 300000 });
    assert.equal(r.ok, true);
    assert.equal(r.swept, 1);
    const latest = store.findLatest(slug, matId);
    assert.equal(latest.state, 'failed');
    assert.equal(latest.suppress_reason, 'rate_limited');
  } finally {
    cleanup(slug);
  }
});

// 9. USER_CONTENT_KEY_DENYLIST rejection (Canon Part 8)
test('validateEntryShape rejects USER_CONTENT_KEY_DENYLIST keys', () => {
  const matId = '0'.repeat(32);
  const baseValid = {
    material_id: matId,
    state: 'queued',
    mtime_seconds: 1746543210,
    fired_at: 1746543220000,
  };
  // Each denylist key triggers canon_part_8_violation
  for (const key of ['body_text', 'source_title', 'target_title', 'artifact_body', 'note_content', 'transcript_content', 'meeting_summary', 'cv_content', 'file_content']) {
    const e = Object.assign({}, baseValid, { [key]: 'forbidden user content' });
    const r = store.validateEntryShape(e);
    assert.equal(r.ok, false, 'denylist key ' + key + ' must be rejected');
    assert.equal(r.reason, 'canon_part_8_violation');
    assert.equal(r.offending_key, key);
  }
  // Valid entry passes
  assert.equal(store.validateEntryShape(baseValid).ok, true);
  assert.ok(store.USER_CONTENT_KEY_DENYLIST.has('body_text'));
  assert.ok(store.USER_CONTENT_KEY_DENYLIST.has('source_title'));
});

// 10. readMaterials on non-existent slug -> []
test('readMaterials returns [] for non-existent slug (no throw, no file creation)', () => {
  const slug = freshSlug();
  const result = store.readMaterials(slug);
  assert.deepEqual(result, []);
  assert.equal(fs.existsSync(store.jsonlPath(slug)), false);
});

// 11. Corrupt JSONL line silently skipped
test('readMaterials silently skips corrupt JSONL lines', () => {
  const slug = freshSlug();
  try {
    const file = store.jsonlPath(slug);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const matId = store.computeMaterialId('/abs/room', 'cv.md', 1746543210000);
    const validEntry = {
      material_id: matId,
      file_path_sha256: '9f8a000000000000',
      relative_file_path: 'cv.md',
      mtime_seconds: 1746543210,
      fired_at: 1746543220000,
      state: 'queued',
      finding_count: null,
      surfaced: false,
      user_response: null,
      responded_at: null,
      suppress_reason: null,
      in_flight_since: null,
    };
    fs.writeFileSync(file, JSON.stringify(validEntry) + '\n{not json at all\n' + JSON.stringify(validEntry) + '\n');
    const all = store.readMaterials(slug);
    assert.equal(all.length, 1, 'corrupt line skipped, valid lines collapsed via LWW');
  } finally {
    cleanup(slug);
  }
});

// 12. JSONL location is OUTSIDE plugin repo (workspace-guard-clean)
test('jsonlPath uses os.homedir(), NOT plugin repo cwd', () => {
  const p = store.jsonlPath('foo');
  assert.ok(p.startsWith(os.homedir()), 'JSONL path must be under os.homedir() per CLAUDE.md workspace guard');
  assert.ok(p.includes('.mindrian'));
  assert.ok(p.includes('explored-materials'));
  // Must NOT live inside the plugin repo
  assert.ok(!p.startsWith(process.cwd()), 'JSONL path must NOT live inside plugin repo');
});

// Strip line + block comments so anti-pattern checks only scan executable code.
function stripComments(src) {
  // Block comments first.
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Then line comments.
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

// 13. Module does NOT call console.log or process.stdout.write (anti-pattern grep on executable code)
test('explored-materials-store.cjs executable code has no console.log + no process.stdout.write', () => {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'lib', 'memory', 'explored-materials-store.cjs'), 'utf8');
  const code = stripComments(raw);
  assert.equal(code.includes('console.log'), false, 'forbidden side-channel: console.log');
  assert.equal(code.includes('process.stdout.write'), false, 'forbidden side-channel: process.stdout.write');
});

// 14. Module does NOT require room-db.cjs (Phase 109 D-06 chokepoint)
test('explored-materials-store.cjs does NOT require room-db.cjs', () => {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'lib', 'memory', 'explored-materials-store.cjs'), 'utf8');
  const code = stripComments(raw);
  assert.equal(/require\(['"](\.\.?\/)+(lib\/)?core\/room-db/.test(code), false, 'Phase 109 D-06 chokepoint must be preserved');
});

// 15. Module does NOT require any brain-client module (Canon Part 8 boundary)
test('explored-materials-store.cjs executable code does NOT require brain-client', () => {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'lib', 'memory', 'explored-materials-store.cjs'), 'utf8');
  const code = stripComments(raw);
  assert.equal(/require\([^)]*brain[-_]client/.test(code), false, 'Canon Part 8 boundary must be preserved');
});
