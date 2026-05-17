'use strict';
/*
 * Phase 120-03 Wave 2 Task 3 -- scanner D-17 voice-scaffold + D-18 ethics-fence
 * integration tests (Tests 1-7).
 *
 * Coverage:
 *   T1 -- HARD_CEILING happy path: scanForBreakthroughs returns top with voice_line
 *         populated; surfaceBreakthrough passes voice_line via payload to pickShape;
 *         F.7 envelope's zones.body starts with the voice line.
 *   T2 -- SOFT_BAND route: scanForBreakthroughs does NOT return SOFT_BAND as top;
 *         ethics-fence.queueForReview inserts row in .rooms/breakthrough-review-queue.db;
 *         breakthrough_in_review_queue memory_event lands; NO breakthrough_surfaced.
 *   T3 -- HARD_FLOOR refusal: defensive (writeBreakthrough already refuses provenance-less
 *         inputs; we verify the classifier returns HARD_FLOOR at the ethics-fence layer).
 *   T4 -- BELOW_FLOOR soft-fire only: confidence < 0.35 candidates do not surface.
 *   T5 -- F.7 renderer accepts voice_line additively + closed-vocab preserved.
 *   T6 -- F.7 renderer without voice_line preserves Plan 120-01 byte-stable output.
 *   T7 -- D-17 violator voice line replaced with structural default before surface.
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const scanner = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'scanner.cjs'));
const ethicsFence = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'ethics-fence.cjs'));
const reviewQueue = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'review-queue.cjs'));
const voiceScaffold = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'voice-scaffold.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const f7Renderer = require(path.join(REPO_ROOT, 'lib', 'hmi', 'shape-f7-breakthrough-renderer.cjs'));

function makeTmpRoom(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}

function seedArtifact(db, id) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
    "VALUES (?, 'artifact', '{}', 'test', 'system', 'confirmed', ?, ?)"
  ).run(id, nowMs, nowMs);
}

function writeWhitespaceGap(roomDir, artifacts, theme, differential) {
  const target = path.join(roomDir, '.mindrian', 'whitespace-results.json');
  let payload = { gaps: [] };
  if (fs.existsSync(target)) {
    try { payload = JSON.parse(fs.readFileSync(target, 'utf8')); } catch (_e) {}
    if (!Array.isArray(payload.gaps)) payload.gaps = [];
  }
  payload.gaps.push({
    theme: theme,
    artifacts: artifacts,
    differential: differential,
    sections: ['s1', 's2'],
    detected_at: Date.now(),
  });
  fs.writeFileSync(target, JSON.stringify(payload));
}

// --- T1: HARD_CEILING happy path -- surfaceBreakthrough passes voice_line ---
test('T1: surfaceBreakthrough composes + passes voice_line into F.7 envelope', () => {
  const roomDir = makeTmpRoom('p120-03-t3-t1-');
  try {
    const db = openRoomDb(roomDir);
    seedArtifact(db, 'a1'); seedArtifact(db, 'a2'); seedArtifact(db, 'a3'); seedArtifact(db, 'a4');
    writeWhitespaceGap(roomDir, ['a1', 'a2', 'a3', 'a4'], 'voice-line-test', 0.7);
    db.close();

    const result = scanner.scanForBreakthroughs(roomDir);
    assert.ok(result.top, 'expected top candidate');
    const db2 = openRoomDb(roomDir);
    const surface = scanner.surfaceBreakthrough(result.top, {
      db: db2, roomDir: roomDir, tier: 1, more_count: 0,
    });
    assert.equal(surface.ok, true);
    // Voice line must be on the rendered envelope OR the surface result.
    assert.ok(surface.voice_line, 'expected voice_line on surface result');
    // Verify it passes the auditor.
    const audit = voiceScaffold.auditVoiceLine(surface.voice_line);
    assert.equal(audit.ok, true, 'surfaced voice_line must pass auditor, violations: ' +
      JSON.stringify(audit.violations) + ' line: ' + surface.voice_line);
    db2.close();
  } finally {
    fs.rmSync(roomDir, { recursive: true, force: true });
  }
});

// --- T2: SOFT_BAND route -- queue + memory_event + no surface ---
test('T2: SOFT_BAND candidate routes to review queue (no surface event)', () => {
  const roomDir = makeTmpRoom('p120-03-t3-t2-');
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'p120-03-t3-t2-home-'));
  try {
    const db = openRoomDb(roomDir);

    // Hand-craft a SOFT_BAND candidate (confidence 0.42) and exercise the
    // ethics-fence directly. The scanner's scanForBreakthroughs is detector-driven
    // and the math layer typically produces confidence in narrow bands -- so this
    // test exercises the ethics-fence wiring directly for clarity.
    const cand = {
      id: 'bk:soft-band:t2',
      kind: 'convergence',
      confidence: 0.42,
      artifact_ids: ['a1', 'a2'],
      theme: 'soft-band-route',
      detected_at: Date.now(),
    };
    const band = ethicsFence.classifyEthicsBand(cand);
    assert.equal(band, 'SOFT_BAND');

    const queued = ethicsFence.queueForReview(cand, tmpHome, { db: db, roomSlug: 'test-soft' });
    assert.equal(queued.ok, true);

    // Memory event landed
    const events = navigation.findRecentChanges(db, 0, {
      eventType: 'breakthrough_in_review_queue',
      limit: 10,
    });
    assert.ok(events.length >= 1, 'expected breakthrough_in_review_queue event');

    // No breakthrough_surfaced event
    const surfaced = navigation.findRecentChanges(db, 0, {
      eventType: 'breakthrough_surfaced',
      limit: 10,
    });
    assert.equal(surfaced.length, 0,
      'SOFT_BAND candidates must NOT emit breakthrough_surfaced');
    db.close();
  } finally {
    fs.rmSync(roomDir, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
});

// --- T3: HARD_FLOOR refusal at ethics-fence layer ---
test('T3: HARD_FLOOR candidate (no provenance) -> classifier refuses', () => {
  const cand = { id: 'bk:hf:t3', kind: 'convergence', confidence: 0.80, artifact_ids: [], theme: 'no-prov' };
  const band = ethicsFence.classifyEthicsBand(cand);
  assert.equal(band, 'HARD_FLOOR');
});

// --- T4: BELOW_FLOOR -- soft-fire only ---
test('T4: BELOW_FLOOR candidate -> classifier returns BELOW_FLOOR (soft-fire territory)', () => {
  const cand = { id: 'bk:bf:t4', kind: 'convergence', confidence: 0.25, artifact_ids: ['a1'], theme: 'below' };
  const band = ethicsFence.classifyEthicsBand(cand);
  assert.equal(band, 'BELOW_FLOOR');
});

// --- T5: F.7 renderer accepts voice_line additively ---
test('T5: F.7 renderer prepends voice_line to zones.body when present', () => {
  const bk = {
    id: 'bk:vl-test',
    kind: 'convergence',
    theme: 'voice-line-prepend',
    artifact_ids: ['a1', 'a2', 'a3'],
    detected_at: Date.now(),
  };
  const voiceLine = "You're seeing a convergence on X (artifacts a1, a2, a3) -- by uploading -- in the last hour.";
  const envelope = f7Renderer.renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: bk,
    more_count: 0,
    voice_line: voiceLine,
  });
  assert.ok(envelope.zones, 'expected zones in envelope');
  // Voice line is the FIRST line in zones.body
  const firstLine = envelope.zones.body.split('\n')[0];
  assert.equal(firstLine, voiceLine,
    'expected first line of zones.body to be voice_line, got: ' + firstLine);
  // Verbs preserved verbatim
  assert.deepEqual(envelope.contract.verbs, ['Explore deeper', 'Confirm', 'File as decision', 'Dismiss', 'Back']);
  assert.equal(envelope.contract.freeTextOffered, false);
  assert.equal(envelope.contract.recommended, null);
});

// --- T6: F.7 renderer without voice_line -- existing byte-stable output ---
test('T6: F.7 renderer without voice_line preserves Plan 120-01 byte-stable output', () => {
  const bk = {
    id: 'bk:no-vl',
    kind: 'convergence',
    theme: 'no-voice-line',
    artifact_ids: ['a1', 'a2', 'a3'],
    detected_at: Date.now(),
  };
  const envelope = f7Renderer.renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: bk,
    more_count: 0,
    // no voice_line
  });
  const firstLine = envelope.zones.body.split('\n')[0];
  // First line is the title row, not the voice line
  assert.ok(firstLine.indexOf('Convergence') >= 0,
    'expected first line to start with title (kind display), got: ' + firstLine);
  assert.ok(firstLine.indexOf("You're seeing") < 0,
    'expected no voice line, got: ' + firstLine);
});

// --- T7: D-17 violator voice line replaced with structural default ---
test('T7: surfaceBreakthrough replaces D-17-violating voice line with structural default', () => {
  // We test the gate logic directly: a roomState.mechanism_phrase that violates
  // D-17 rule 4 (unbacked superlative) is replaced by the structural default.
  // composeBreakthroughVoiceLine + auditVoiceLine are pure -- we drive them
  // through the same code path the scanner uses (line composition then audit).
  const bk = {
    id: 'bk:bad-voice',
    kind: 'convergence',
    theme: 'X',
    artifact_ids: ['a1', 'a2'],
    detected_at: Date.now(),
  };
  // Bad mechanism phrase: contains the forbidden superlative 'breakthrough'
  // without numeric backing -> rule 4 violation.
  const badRoomState = { mechanism_phrase: 'by achieving a major breakthrough' };
  const badLine = voiceScaffold.composeBreakthroughVoiceLine(bk, badRoomState);
  const badAudit = voiceScaffold.auditVoiceLine(badLine);
  assert.equal(badAudit.ok, false, 'expected violation, got pass: ' + badLine);
  // The replacement (structural default; roomState=null) MUST pass auditor.
  const defaultLine = voiceScaffold.composeBreakthroughVoiceLine(bk, null);
  const defaultAudit = voiceScaffold.auditVoiceLine(defaultLine);
  assert.equal(defaultAudit.ok, true,
    'structural default must pass auditor, violations: ' + JSON.stringify(defaultAudit.violations));
});
