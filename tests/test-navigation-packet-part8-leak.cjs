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
    process.stdout.write('test-navigation-packet-part8-leak: PASS (8 tripwires)\n');
    process.exit(0);
  } catch (err) {
    process.stderr.write('test-navigation-packet-part8-leak: FAIL: ' + err.message + '\n' + err.stack + '\n');
    process.exit(1);
  } finally {
    cleanup(tmp);
  }
}

run();
