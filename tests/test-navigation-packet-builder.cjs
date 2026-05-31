'use strict';
// Phase 109-07 test: buildBrainPacket shape per CONTEXT D-06. NAV-109-06.
// 10 GREEN assertions covering shape, required-field presence, nearest_claims topK,
// banked_opportunities scalar policy, constraints literal, _mocks seam, defaults
// for missing operator/jtbd/stage, focus_node summary truncation, token budget,
// passthrough job parameter.

const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

function makeRoom(opts) {
  const o = opts || {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-packet-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  const insN = db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)");
  insN.run('room:test', 'room', '{}', 'fixture', 1.0, 'confirmed', nowMs, nowMs, null);
  // Focus is a decision with a long summary (tests truncation).
  const longSummary = 'A'.repeat(200);
  insN.run('decision:focus', 'decision', JSON.stringify({ summary: longSummary }), 'fixture/d.md', 0.7, 'confirmed', nowMs, nowMs, 'design');
  // 6 claims (proves topK=5 truncation).
  for (let i = 1; i <= 6; i++) {
    insN.run('claim:c' + i, 'claim', JSON.stringify({ summary: 'claim ' + i, body: 'RAW BODY ' + i }), 'fixture/c' + i + '.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  }
  insN.run('assumption:a1', 'assumption', JSON.stringify({ claim: 'risky', body: 'RAW ASSUMPTION BODY' }), 'fixture/a1.md', 0.4, 'proposed', nowMs, nowMs, 'design');
  // Opportunities for banked_opportunities scalar test.
  insN.run('opportunity:hi', 'opportunity', JSON.stringify({ hsi_score: 85, tags: ['fintech', 'b2b'], body: 'RAW OPP BODY hi' }), 'fixture/oh.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  insN.run('opportunity:mid', 'opportunity', JSON.stringify({ hsi_score: 50, tags: ['biotech'], body: 'RAW OPP BODY mid' }), 'fixture/om.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  insN.run('opportunity:lo', 'opportunity', JSON.stringify({ hsi_score: 20, tags: ['climate'], body: 'RAW OPP BODY lo' }), 'fixture/ol.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  for (let i = 1; i <= 6; i++) insE.run('decision:focus', 'claim:c' + i, 'INFORMS');
  insE.run('decision:focus', 'assumption:a1', 'ASSUMES');
  insE.run('decision:focus', 'opportunity:hi', 'BANKED_BY');
  insE.run('decision:focus', 'opportunity:mid', 'BANKED_BY');
  insE.run('decision:focus', 'opportunity:lo', 'BANKED_BY');
  // Add a CONTRADICTS pair so contradictions returns at least 1.
  insE.run('claim:c1', 'claim:c2', 'CONTRADICTS');
  // Set identity.stage if requested. The identity table requires updated_at NOT NULL
  // (per memory-ops.cjs schema); pass a non-null ISO timestamp.
  if (o.stage) {
    db.prepare("INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES ('stage', ?, ?)").run(o.stage, new Date().toISOString());
  }
  return { tmp, db };
}

function cleanup(tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }

function defaultMocks() {
  return {
    jtbd: { getCurrent: () => ({ current: null }) },
    operator: { getCurrent: () => ({ current: null }) },
  };
}

async function test1_shape() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    // Phase 110-02: origin + privacy_mode added to the top-level key set (D-08 + D-09).
    for (const k of ['packet_version', 'job', 'room_stage', 'origin', 'privacy_mode', 'active_context', 'local_graph_summary', 'constraints']) {
      ok(k in p, 'top-level key present: ' + k);
    }
    for (const k of ['jtbd', 'operator', 'focus_node']) ok(k in p.active_context);
    for (const k of ['nearest_claims', 'nearest_assumptions', 'contradictions', 'unsupported_claims', 'recent_changes', 'banked_opportunities']) ok(k in p.local_graph_summary);
    db.close();
  } finally { cleanup(tmp); }
}

async function test2_packetVersion() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'job', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    equal(p.packet_version, '1.0');
    db.close();
  } finally { cleanup(tmp); }
}

async function test3_jobPassthrough() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'arbitrary_job_string', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    equal(p.job, 'arbitrary_job_string');
    db.close();
  } finally { cleanup(tmp); }
}

async function test4_roomStageDefault() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'job', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    equal(p.room_stage, 'unknown', 'defaults to unknown when identity.stage absent');
    db.close();
  } finally { cleanup(tmp); }

  const { tmp: tmp2, db: db2 } = makeRoom({ stage: 'discovery' });
  try {
    const p2 = await navigation.buildBrainPacket(db2, 'job', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    equal(p2.room_stage, 'discovery', 'reads identity.stage when present');
    db2.close();
  } finally { cleanup(tmp2); }
}

async function test5_activeContextDefaults() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'job', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    equal(p.active_context.jtbd, null, 'jtbd null when no active');
    equal(p.active_context.operator, 'JUST_TALK', 'operator defaults to JUST_TALK');
    equal(p.active_context.focus_node.id, 'decision:focus');
    equal(p.active_context.focus_node.type, 'decision');
    ok(typeof p.active_context.focus_node.summary === 'string');
    db.close();
  } finally { cleanup(tmp); }
}

async function test6_focusSummaryTruncation() {
  // H5 fix: under the DEFAULT local_summary_only mode the focus summary is a sha256 HASH of
  // the prose, never the prose itself. The long 'A'.repeat(200) prose must NOT appear; the
  // value must be a 'sha256:'-prefixed 71-char hash and stay within the 120 cap. Under the
  // explicit allow_excerpts opt-in, the truncated excerpt (<=120, ending '...') is restored.
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'job', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    const s = p.active_context.focus_node.summary;
    ok(s.length <= 120, 'summary <= 120 chars (got ' + s.length + ')');
    // Default mode: hash, NOT prose.
    ok(/^sha256:[0-9a-f]{64}$/.test(s), 'default-mode summary is a sha256 hash (got ' + s + ')');
    ok(!/A{10}/.test(s), 'default-mode summary carries no raw prose');
    db.close();
  } finally { cleanup(tmp); }

  // allow_excerpts: requires a brain_excerpts APPROVE row. Seed one so the mode resolves
  // up to allow_excerpts, then assert the excerpt (truncated prose) is restored.
  const { tmp: tmp2, db: db2 } = makeRoom();
  try {
    const nowMs = Date.now();
    db2.prepare(
      "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES (?, 'decision', ?, 'fixture', 'user', 0.9, 'confirmed', ?, ?, 'design')"
    ).run('decision:excerpt-approval', JSON.stringify({ summary: 'brain_excerpts approved' }), nowMs, nowMs);
    const p2 = await navigation.buildBrainPacket(db2, 'job', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test', privacyMode: 'allow_excerpts' });
    equal(p2.privacy_mode, 'allow_excerpts', 'allow_excerpts resolves up given the brain_excerpts APPROVE row');
    const s2 = p2.active_context.focus_node.summary;
    ok(s2.length <= 120, 'excerpt summary <= 120 chars (got ' + s2.length + ')');
    ok(/^A+\.\.\.$/.test(s2), 'allow_excerpts restores the truncated prose excerpt (got ' + s2.slice(0, 20) + '...)');
    ok(s2.endsWith('...'), 'truncated excerpt ends with ...');
    db2.close();
  } finally { cleanup(tmp2); }
}

async function test7_nearestClaimsTopK() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'job', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    ok(p.local_graph_summary.nearest_claims.length <= 5, 'topK=5 enforced (got ' + p.local_graph_summary.nearest_claims.length + ')');
    for (const c of p.local_graph_summary.nearest_claims) {
      for (const k of ['id', 'type', 'summary', 'depth', 'edgeTypeIn', 'score', 'reviewStatus', 'lastSeenAt']) ok(k in c, 'nearest_claim entry has key ' + k);
      // Forbidden raw fields:
      ok(!('body' in c), 'no body field in nearest_claim');
      ok(!('properties' in c), 'no properties field in nearest_claim');
    }
    db.close();
  } finally { cleanup(tmp); }
}

async function test8_bankedOpportunitiesScalar() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'job', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    const bo = p.local_graph_summary.banked_opportunities;
    ok(typeof bo === 'object' && bo !== null);
    ok('count' in bo && typeof bo.count === 'number');
    ok(Array.isArray(bo.items));
    ok(bo.items.length <= 3, 'top-3 enforced (got ' + bo.items.length + ')');
    for (const it of bo.items) {
      for (const k of ['id_hash', 'tags', 'hsi_band', 'composite_score']) ok(k in it, 'banked item has ' + k);
      ok(/^[0-9a-f]{12}$/.test(it.id_hash), 'id_hash is 12-char hex: ' + it.id_hash);
      ok(['high', 'medium', 'low'].includes(it.hsi_band), 'hsi_band valid: ' + it.hsi_band);
      ok(typeof it.composite_score === 'number');
      // Forbidden raw fields:
      ok(!('opportunityId' in it), 'no raw opportunityId');
      ok(!('hsiScore' in it), 'no raw hsiScore');
      ok(!('body' in it), 'no body');
    }
    db.close();
  } finally { cleanup(tmp); }
}

async function test9_constraintsLiteral() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'job', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    deepEqual(p.constraints, { privacy: 'no_raw_artifact_text', max_tokens: 1200 });
    db.close();
  } finally { cleanup(tmp); }
}

async function test10_tokenBudget() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    const sz = JSON.stringify(p).length;
    ok(sz / 4 < 1200, 'packet within 1200 token budget (got ' + (sz / 4).toFixed(1) + ')');
    db.close();
  } finally { cleanup(tmp); }
}

// Phase 110-02 regression touches (PACKET-110-06 + PACKET-110-07):
// Assert the new top-level fields land without disturbing the existing assertions above.
// origin: 'navigation_api' is the D-08 layer-1 provenance stamp. privacy_mode is the
// resolvePrivacyMode output -- default 'local_summary_only' when no roomDir / no per-call
// override; per-call beats config beats default; 'allow_excerpts' caps down absent the
// Part-3 APPROVE row. constraints.privacy stays as a separate human-readable note.

async function test11_originStamp() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    equal(p.origin, 'navigation_api', 'packet stamps origin: navigation_api (D-08 layer 1)');
    db.close();
  } finally { cleanup(tmp); }
}

async function test12_privacyModeDefault() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    ok(['local_summary_only', 'allow_filenames', 'allow_excerpts'].includes(p.privacy_mode), 'packet carries a valid privacy_mode: ' + p.privacy_mode);
    equal(p.privacy_mode, 'local_summary_only', 'default is local_summary_only when no roomDir / no per-call override');
    // constraints.privacy stays as separate human-readable note (NOT replaced by privacy_mode):
    equal(p.constraints.privacy, 'no_raw_artifact_text');
    db.close();
  } finally { cleanup(tmp); }
}

async function test13_privacyModePerCallOverride() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test', privacyMode: 'allow_filenames' });
    equal(p.privacy_mode, 'allow_filenames', 'per-call privacyMode beats default');
    db.close();
  } finally { cleanup(tmp); }
}

async function test14_privacyModeConfigRead() {
  const { tmp, db } = makeRoom();
  const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-110-02-cfg-'));
  try {
    fs.writeFileSync(path.join(cfgDir, '.config.json'), JSON.stringify({ preferences: { brain_privacy_mode: 'allow_filenames' } }));
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test', roomDir: cfgDir });
    equal(p.privacy_mode, 'allow_filenames', '.config.json preferences.brain_privacy_mode honored when no per-call override');
    db.close();
  } finally { cleanup(tmp); try { fs.rmSync(cfgDir, { recursive: true, force: true }); } catch (_) { /* ignore */ } }
}

async function test15_privacyModeAllowExcerptsCapsDown() {
  const { tmp, db } = makeRoom();
  try {
    // allow_excerpts requires a brain_excerpts APPROVE row in the room graph; no such row was seeded
    // by makeRoom() -- the helper must cap down to local_summary_only (config caps, never raises).
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test', privacyMode: 'allow_excerpts' });
    equal(p.privacy_mode, 'local_summary_only', 'allow_excerpts caps down to local_summary_only absent brain_excerpts APPROVE row');
    db.close();
  } finally { cleanup(tmp); }
}

async function test16_privacyModeUnrecognizedValue() {
  const { tmp, db } = makeRoom();
  try {
    const p = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test', privacyMode: 'garbage_mode' });
    equal(p.privacy_mode, 'local_summary_only', 'unrecognized privacyMode falls back to default');
    db.close();
  } finally { cleanup(tmp); }
}

// Phase 125-03: buildBrainPacket is now async (it awaits an internal helper
// that may fetch a Brain Cypher slice for framework_chain_hint). The runner
// awaits each test function so the sync-vs-async migration is contained.
async function run() {
  const tests = [test1_shape, test2_packetVersion, test3_jobPassthrough, test4_roomStageDefault, test5_activeContextDefaults, test6_focusSummaryTruncation, test7_nearestClaimsTopK, test8_bankedOpportunitiesScalar, test9_constraintsLiteral, test10_tokenBudget, test11_originStamp, test12_privacyModeDefault, test13_privacyModePerCallOverride, test14_privacyModeConfigRead, test15_privacyModeAllowExcerptsCapsDown, test16_privacyModeUnrecognizedValue];
  let pass = 0; let fail = 0;
  for (const t of tests) {
    try { await t(); pass++; process.stdout.write('PASS ' + t.name + '\n'); }
    catch (err) { fail++; process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + err.stack + '\n'); }
  }
  process.stdout.write('test-navigation-packet-builder: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
