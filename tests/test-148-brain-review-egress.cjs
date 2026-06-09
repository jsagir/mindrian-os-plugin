'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 148-05 Task 3 -- IRW-08 adversarial Brain-review egress test.
 * =================================================================
 * MIRRORS tests/test-navigation-packet-part8-leak.cjs (the 9-tripwire pattern).
 * The Brain-review packet is the single highest-risk path in the phase: a finding
 * body egressed via Brain review is a Canon Part 8 constitutional breach. This
 * test FEEDS the packet builder findings carrying forbidden user-content strings
 * (artifact body, numbers, names, emails, secret paths) and asserts that NONE of
 * them reach the built packet -- only generic framework handles + a contradiction
 * COUNT + enum scalars survive. It also asserts auditQueryString default-denies a
 * smuggled body in the framework slot, and that a Brain response is sanitized.
 *
 * Plain node:assert/strict; PASS line on stdout; non-zero exit on failure.
 *
 * NO em-dashes / en-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const reviewPacket = require(path.join(REPO_ROOT, 'lib', 'hmi', 'brain-review-packet.cjs'));
const egress = require(path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs'));

// A distinctive forbidden token seeded into every node body. If it appears
// ANYWHERE in the serialized packet, the body leaked.
const SECRET = 'SECRETFINDINGBODY42';

// ---------------------------------------------------------------------------
// Build an adversarial room: a focus node with CONTRADICTS neighbors whose
// bodies are stuffed with forbidden user content (the SECRET token, an email, a
// money figure, a name, an absolute path).
// ---------------------------------------------------------------------------
function makeAdversarialRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-148-brain-review-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  const insN = db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) " +
    "VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)"
  );
  insN.run('room:test', 'room', '{}', 'fixture', 1.0, 'confirmed', nowMs, nowMs, null);
  // The focus node the Brain review centers on.
  insN.run('section:problem-definition', 'section', JSON.stringify({
    summary: SECRET + ' the core thesis is the regulated buyer',
  }), '/home/jsagi/secret/section.md', 0.9, 'confirmed', nowMs, nowMs, 'problem-definition');
  // Two claims that CONTRADICT the focus, bodies stuffed with forbidden content.
  insN.run('claim:c1', 'claim', JSON.stringify({
    summary: SECRET + ' revenue is $5M and contact is alice@example.com',
    body: SECRET + ' Bob Smith said the model is wrong',
  }), '/home/jsagi/secret/c1.md', 0.7, 'confirmed', nowMs, nowMs, 'problem-definition');
  insN.run('claim:c2', 'claim', JSON.stringify({
    summary: SECRET + ' the TAM is 1234567 and the date is 2026-01-01',
  }), '/home/jsagi/secret/c2.md', 0.6, 'confirmed', nowMs, nowMs, 'problem-definition');
  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  insE.run('section:problem-definition', 'claim:c1', 'CONTRADICTS');
  insE.run('section:problem-definition', 'claim:c2', 'CONTRADICTS');
  return { tmp, db };
}

function cleanup(tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }

const { tmp, db } = makeAdversarialRoom();
try {
  // -----------------------------------------------------------------------
  // 1. Build the packet with a CLEAN generic framework handle + a Brain response
  //    that carries PII (must be sanitized). The packet must surface the local
  //    contradiction COUNT (2) but ZERO finding body.
  // -----------------------------------------------------------------------
  const packet = reviewPacket.buildBrainReviewPacket({
    db: db,
    focusNodeId: 'section:problem-definition',
    framework: 'SWOT',
    phaseId: 2,
    tierMode: 'mode_a',
    brainResponse: 'Chain SWOT to Porter Five Forces. Reach alice@example.com or call 555-123-4567.',
  });
  const serialized = JSON.stringify(packet);

  // Tripwire 1: the SECRET finding-body token leaks NOWHERE.
  ok(!serialized.includes(SECRET), 'tripwire 1: no finding-body token in the packet');

  // Tripwire 2: no absolute /home or /secret path component.
  ok(!/\/home\//.test(serialized), 'tripwire 2: no /home absolute path leaked');
  ok(!/\/secret\//.test(serialized), 'tripwire 2: no /secret path component leaked');

  // Tripwire 3: no raw email survives anywhere (the Brain line is sanitized).
  ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(serialized), 'tripwire 3: no email address survives');

  // Tripwire 4: no raw phone number survives.
  ok(!/\b\d{3}[-.]\d{3}[-.]\d{4}\b/.test(serialized), 'tripwire 4: no phone number survives');

  // Tripwire 5: no money figure or large raw number from a body survives.
  ok(!/\$\d/.test(serialized), 'tripwire 5: no money figure survives');
  ok(!serialized.includes('1234567'), 'tripwire 5: no raw TAM number survives');

  // Tripwire 6: the local contradiction COUNT is surfaced (2), proving
  // contradictions ARE detected locally without any body crossing.
  equal(packet.local.contradiction_count, 2, 'tripwire 6: local contradiction count == 2 (detected locally)');

  // Tripwire 7: framework_handles contains ONLY the audited generic handle.
  ok(Array.isArray(packet.local.framework_handles), 'tripwire 7: framework_handles is an array');
  for (const h of packet.local.framework_handles) {
    equal(typeof h, 'string', 'tripwire 7: handle is a string');
    ok(h.length <= 40 && !h.includes(SECRET), 'tripwire 7: handle is a short generic token, no body');
  }
  ok(packet.local.framework_handles.indexOf('SWOT') !== -1, 'tripwire 7: the clean SWOT handle survives');

  // Tripwire 8: the methodology question is the generic chain form only.
  equal(packet.methodology_question, 'what chains from SWOT at phase 2?',
    'tripwire 8: methodology question is the generic chain form (handle + phase id only)');

  // Tripwire 9 (the smuggle): a forbidden body in the framework slot is
  // default-DENIED by auditQueryString -> methodology_question becomes null and
  // the handle never reaches framework_handles.
  const smuggled = reviewPacket.buildBrainReviewPacket({
    db: db,
    focusNodeId: 'section:problem-definition',
    framework: SECRET + ' my financial model shows $5M revenue for Bob Smith',
    tierMode: 'mode_a',
    brainResponse: 'ignored',
  });
  equal(smuggled.methodology_question, null, 'tripwire 9: smuggled body in framework slot -> null question (default-deny)');
  ok(!JSON.stringify(smuggled).includes(SECRET), 'tripwire 9: smuggled body never reaches the packet');
  ok(smuggled.local.framework_handles.indexOf(SECRET) === -1, 'tripwire 9: smuggled handle never enters framework_handles');

  // Direct auditQueryString assertion: it THROWS on a forbidden body.
  let threw = false;
  try {
    egress.auditQueryString(SECRET + ' revenue $5M alice@example.com', 'brain-review');
  } catch (_e) {
    threw = true;
  }
  ok(threw, 'tripwire 9: auditQueryString default-denies (throws on) a smuggled body');

  // Degrade assertion: Brain-unreachable (mode_b) omits the Brain line, never blocks.
  const degraded = reviewPacket.buildBrainReviewPacket({
    db: db,
    focusNodeId: 'section:problem-definition',
    framework: 'JTBD',
    tierMode: 'mode_b',
    brainResponse: 'should be omitted on mode_b',
  });
  equal(degraded.brain_line, null, 'degrade: mode_b omits the Brain line');
  equal(degraded.degraded, true, 'degrade: mode_b packet is marked degraded (local-only)');
  equal(degraded.local.contradiction_count, 2, 'degrade: local contradictions still surface when Brain is unreachable');

  db.close();
  process.stdout.write('PASS test-148-brain-review-egress.cjs (IRW-08: 9 tripwires; zero user-content egress; auditQueryString default-deny; local-degrade)\n');
  process.exit(0);
} catch (err) {
  process.stderr.write('FAIL test-148-brain-review-egress.cjs: ' + err.message + '\n' + (err.stack || '') + '\n');
  process.exit(1);
} finally {
  cleanup(tmp);
}
