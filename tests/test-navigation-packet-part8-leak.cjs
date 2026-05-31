'use strict';
// Phase 109-07 test: Part 8 leak tripwires (5-tripwire pattern per RESEARCH section 12.5).
// 8 specific assertions on JSON.stringify(packet). Adversarial: seeds forbidden content into
// node properties (raw bodies, transcripts, emails, secret paths) and asserts ZERO leak in
// the serialized packet. NAV-109-06.

const { ok } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-packet-leak-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  const insN = db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)");
  insN.run('room:test', 'room', '{}', 'fixture', 1.0, 'confirmed', nowMs, nowMs, null);
  // Seed forbidden content into properties to prove the builder strips it.
  const transcript = 'B'.repeat(800);
  insN.run('decision:focus', 'decision', JSON.stringify({ summary: 'short', body: 'SECRET RAW DECISION BODY', transcript }), '/home/jsagi/secret/path/decision.md', 0.7, 'confirmed', nowMs, nowMs, 'design');
  insN.run('claim:c1', 'claim', JSON.stringify({ summary: 'short', body: 'SECRET RAW CLAIM BODY', email: 'leak@example.com' }), '/home/jsagi/secret/c1.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  insN.run('assumption:a1', 'assumption', JSON.stringify({ claim: 'short claim', body: 'SECRET RAW ASSUMPTION' }), '/home/jsagi/a1.md', 0.5, 'proposed', nowMs, nowMs, 'design');
  insN.run('opportunity:hi', 'opportunity', JSON.stringify({ hsi_score: 85, tags: ['fintech', 'b2b'], body: 'SECRET RAW OPP BODY VERY LONG ' + 'x'.repeat(200), mirror_solution: 'SECRET MIRROR' }), '/home/jsagi/oh.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  insE.run('decision:focus', 'claim:c1', 'INFORMS');
  insE.run('decision:focus', 'assumption:a1', 'ASSUMES');
  insE.run('decision:focus', 'opportunity:hi', 'BANKED_BY');
  return { tmp, db };
}

function cleanup(tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }

// H5 fixture: a room whose prose-bearing fields (focus summary, claim summaries) carry a
// distinctive token (SECRETPROSE123). Includes a CONTRADICTS pair so contradictions populate,
// and a brain_excerpts APPROVE row so allow_excerpts can resolve up for the opt-in assertion.
function makeProseRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-packet-h5-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  const insN = db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)");
  insN.run('room:test', 'room', '{}', 'fixture', 1.0, 'confirmed', nowMs, nowMs, null);
  // Focus claim with the distinctive prose token in its summary.
  insN.run('claim:p1', 'claim', JSON.stringify({ summary: 'SECRETPROSE123 the core thesis is unproven' }), 'fixture/p1.md', 0.7, 'confirmed', nowMs, nowMs, 'design');
  insN.run('claim:p2', 'claim', JSON.stringify({ summary: 'SECRETPROSE123 contradicts the thesis directly' }), 'fixture/p2.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  insN.run('assumption:p3', 'assumption', JSON.stringify({ claim: 'SECRETPROSE123 a risky assumption' }), 'fixture/p3.md', 0.5, 'proposed', nowMs, nowMs, 'design');
  // brain_excerpts APPROVE row so allow_excerpts resolves up (Part-3 Decision Gate).
  insN.run('decision:excerpt-approval', 'decision', JSON.stringify({ summary: 'brain_excerpts approved' }), 'fixture/approve.md', 0.9, 'confirmed', nowMs, nowMs, 'design');
  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  insE.run('claim:p1', 'claim:p2', 'CONTRADICTS');
  insE.run('claim:p1', 'assumption:p3', 'ASSUMES');
  return { tmp, db };
}

function defaultMocks() { return { jtbd: { getCurrent: () => ({ current: null }) }, operator: { getCurrent: () => ({ current: null }) } }; }

// Phase 125-03: buildBrainPacket is now async; run() awaits it.
async function run() {
  const { tmp, db } = makeRoom();
  try {
    const packet = await navigation.buildBrainPacket(db, 'suggest_next_move', 'decision:focus', { _mocks: defaultMocks(), roomId: 'test' });
    const serialized = JSON.stringify(packet);

    // Tripwire 1: no SECRET RAW BODY strings leaked.
    ok(!/SECRET RAW DECISION BODY/.test(serialized), 'tripwire 1: no decision body leak');
    ok(!/SECRET RAW CLAIM BODY/.test(serialized), 'tripwire 1: no claim body leak');
    ok(!/SECRET RAW ASSUMPTION/.test(serialized), 'tripwire 1: no assumption body leak');
    ok(!/SECRET RAW OPP BODY/.test(serialized), 'tripwire 1: no opportunity body leak');
    ok(!/SECRET MIRROR/.test(serialized), 'tripwire 1: no mirror_solution leak');

    // Tripwire 2: no absolute paths outside the room slug.
    ok(!/\/home\/jsagi\//.test(serialized), 'tripwire 2: no absolute /home path');
    ok(!/\/secret\//.test(serialized), 'tripwire 2: no /secret/ path component leaked');

    // Tripwire 3: no email addresses.
    ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(serialized), 'tripwire 3: no email addresses');

    // Tripwire 4: no transcript-like long strings (>500 chars in any single string field).
    function deepFindLong(obj, depth) {
      if (depth > 10) return false;
      if (typeof obj === 'string') return obj.length > 500;
      if (Array.isArray(obj)) return obj.some((x) => deepFindLong(x, depth + 1));
      if (obj && typeof obj === 'object') return Object.values(obj).some((x) => deepFindLong(x, depth + 1));
      return false;
    }
    ok(!deepFindLong(packet, 0), 'tripwire 4: no string field exceeds 500 chars');

    // Tripwire 5: every banked_opportunities item id_hash is exactly 12-char hex.
    for (const it of packet.local_graph_summary.banked_opportunities.items) {
      ok(/^[0-9a-f]{12}$/.test(it.id_hash), 'tripwire 5: id_hash 12-char hex (got ' + it.id_hash + ')');
    }

    // Tripwire 6: tags only contain generic domain strings (not raw bodies).
    for (const it of packet.local_graph_summary.banked_opportunities.items) {
      for (const tag of it.tags) {
        ok(typeof tag === 'string', 'tag is string');
        ok(tag.length <= 30, 'tag is short generic domain (got len ' + tag.length + ')');
        ok(!/SECRET/.test(tag), 'no SECRET marker in tag');
      }
    }

    // Tripwire 7: hsi_band always in {high, medium, low}.
    for (const it of packet.local_graph_summary.banked_opportunities.items) {
      ok(['high', 'medium', 'low'].includes(it.hsi_band), 'tripwire 7: hsi_band in enum');
    }

    // Tripwire 8: composite_score rounded to 2 decimals (toFixed(2) round-trip).
    for (const it of packet.local_graph_summary.banked_opportunities.items) {
      const round = Math.round(it.composite_score * 100) / 100;
      ok(Math.abs(it.composite_score - round) < 1e-9, 'tripwire 8: composite_score 2-decimal rounded (got ' + it.composite_score + ')');
    }

    db.close();

    // -----------------------------------------------------------------------
    // Tripwire 9 (review finding H5): the value-space leak. Under the DEFAULT
    // local_summary_only mode a node's prose summary/explanation crosses to the
    // Brain as a sha256 HASH, never as raw prose. Seed a distinctive prose token
    // (SECRETPROSE123) into the summary/claim/explanation fields and prove it
    // appears NOWHERE in the serialized packet, and that the focus summary is a
    // sha256 hash. Then prove the SAME token IS present (as an excerpt) under the
    // explicit allow_excerpts opt-in.
    // -----------------------------------------------------------------------
    const { tmp: tmp2, db: db2 } = makeProseRoom();
    try {
      // (a) default mode -> the prose token must NOT leak.
      const def = await navigation.buildBrainPacket(db2, 'detect_contradiction', 'claim:p1', { _mocks: defaultMocks(), roomId: 'test' });
      const defSerialized = JSON.stringify(def);
      ok(!/SECRETPROSE123/.test(defSerialized), 'tripwire 9: SECRETPROSE123 appears NOWHERE under default local_summary_only mode');
      ok(/^sha256:[0-9a-f]{64}$/.test(def.active_context.focus_node.summary), 'tripwire 9: default-mode focus summary is a sha256 hash (got ' + def.active_context.focus_node.summary + ')');
      // Every nearest_claims summary and every explanation must also be a hash (or empty sentinel hash).
      for (const c of def.local_graph_summary.nearest_claims) {
        ok(/^sha256:[0-9a-f]{64}$/.test(c.summary), 'tripwire 9: nearest_claim summary is a hash under default mode (got ' + c.summary + ')');
      }
      for (const co of def.local_graph_summary.contradictions) {
        if (co.explanation !== null) {
          ok(/^sha256:[0-9a-f]{64}$/.test(co.explanation), 'tripwire 9: contradiction explanation is a hash under default mode (got ' + co.explanation + ')');
        }
      }

      // (b) allow_excerpts (requires a brain_excerpts APPROVE row, seeded by makeProseRoom)
      // -> the prose excerpt IS present.
      const exc = await navigation.buildBrainPacket(db2, 'detect_contradiction', 'claim:p1', { _mocks: defaultMocks(), roomId: 'test', privacyMode: 'allow_excerpts' });
      ok(exc.privacy_mode === 'allow_excerpts', 'tripwire 9: allow_excerpts resolves up given the brain_excerpts APPROVE row');
      const excSerialized = JSON.stringify(exc);
      ok(/SECRETPROSE123/.test(excSerialized), 'tripwire 9: SECRETPROSE123 IS present as an excerpt under explicit allow_excerpts opt-in');
      db2.close();
    } finally { cleanup(tmp2); }

    process.stdout.write('test-navigation-packet-part8-leak: PASS (9 tripwires)\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write('test-navigation-packet-part8-leak: FAIL: ' + err.message + '\n' + err.stack + '\n');
    process.exit(1);
  } finally {
    cleanup(tmp);
  }
}

run();
